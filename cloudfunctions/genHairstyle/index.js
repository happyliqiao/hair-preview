// 云函数：调用腾讯云人脸融合 FaceFusion 生成效果图
// 前置：开通腾讯云人脸融合、创建素材库(ProjectId/ModelId)、配置环境变量
// 环境变量：TENCENT_SECRET_ID / TENCENT_SECRET_KEY / FACEFUSION_PROJECT_ID
const cloud = require('wx-server-sdk');
const tencentcloud = require('tencentcloud-sdk-nodejs');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

const FacefusionClient = tencentcloud.facefusion.v20181201.Client;
const REGION = 'ap-guangzhou';

exports.main = async (event) => {
  const { photoFileID, hairstyleId, colorId } = event;

  // 1. 解析融合模板 modelId（发型 × 发色 组合）
  let modelId;
  try {
    const tpl = await db.collection('template')
      .where({ hairstyleId, colorId, enabled: true })
      .limit(1)
      .get();
    if (!tpl.data.length) throw new Error('未找到对应的融合模板');
    modelId = tpl.data[0].facefusionModelId;
  } catch (e) {
    return { code: -1, msg: '模板解析失败: ' + e.message };
  }

  // 2. 写入处理中记录
  const genRes = await db.collection('generation').add({
    data: {
      hairstyleId, colorId,
      photoFileID,
      resultFileID: '',
      status: 'processing',
      errorMsg: '',
      createdAt: Date.now()
    }
  });
  const genId = genRes._id;

  // 3. 异步处理（不阻塞返回，用轮询拿结果）
  processPhoto(photoFileID, modelId, genId).catch(async (err) => {
    await db.collection('generation').doc(genId).update({
      data: { status: 'failed', errorMsg: err.message, finishedAt: Date.now() }
    });
  });

  return { code: 0, genId };
};

/** 下载照片 → 调 FaceFusion → 上传结果 → 更新状态 */
async function processPhoto(photoFileID, modelId, genId) {
  // 3.1 下载原图
  const dl = await cloud.downloadFile({ fileID: photoFileID });
  const imageBase64 = dl.fileContent.toString('base64');

  // 3.2 调腾讯云 FaceFusion
  const client = new FacefusionClient({
    credential: {
      secretId: process.env.TENCENT_SECRET_ID,
      secretKey: process.env.TENCENT_SECRET_KEY
    },
    region: REGION,
    profile: { httpProfile: { endpoint: 'facefusion.tencentcloudapi.com' } }
  });

  const resp = await client.FaceFusion({
    ProjectId: process.env.FACEFUSION_PROJECT_ID,
    ModelId: modelId,
    Image: imageBase64,
    RspImgType: 'base64',   // 返回 base64 结果图
    PornDetect: true,       // 开启鉴黄（合规）
    CelebrityIdentify: false
  });

  if (!resp || !resp.Image) throw new Error('FaceFusion 未返回结果');

  // 3.3 上传结果图到云存储
  const resultBuffer = Buffer.from(resp.Image, 'base64');
  const up = await cloud.uploadFile({
    cloudPath: `results/${genId}.jpg`,
    fileContent: resultBuffer
  });

  // 3.4 更新状态为成功
  await db.collection('generation').doc(genId).update({
    data: { resultFileID: up.fileID, status: 'success', finishedAt: Date.now() }
  });

  // 3.5 合规：删除临时原图
  try { await cloud.deleteFile({ fileList: [photoFileID] }); } catch (e) {}
}
