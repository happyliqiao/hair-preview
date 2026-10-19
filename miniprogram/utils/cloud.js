// 云开发调用封装
const db = () => wx.cloud.database();
const _ = () => db().command;

/** 调用云函数 */
async function callFunction(name, data = {}) {
  const res = await wx.cloud.callFunction({ name, data });
  return res.result;
}

/** 拉取发型/发色目录（带前端缓存） */
async function getCatalog(force = false) {
  const app = getApp();
  const cached = app.globalData.catalog;
  if (!force && cached.hairstyles.length && cached.colors.length) {
    return cached;
  }
  const [hairstyles, colors] = await Promise.all([
    callFunction('getCatalog', { collection: 'hairstyle' }),
    callFunction('getCatalog', { collection: 'hairColor' })
  ]);
  app.globalData.catalog = {
    hairstyles: hairstyles.data || [],
    colors: colors.data || []
  };
  return app.globalData.catalog;
}

/** 上传照片到云存储（临时目录，原图用后即删） */
async function uploadPhoto(tempFilePath) {
  const ext = tempFilePath.split('.').pop() || 'jpg';
  const cloudPath = `user-photos/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const res = await wx.cloud.uploadFile({ cloudPath, filePath: tempFilePath });
  return res.fileID;
}

/** 发起 AI 生成 */
async function genHairstyle(payload) {
  return callFunction('genHairstyle', payload);
}

/** 轮询生成结果 */
async function getGenResult(id) {
  return callFunction('getGenResult', { id });
}

module.exports = {
  db, _, callFunction, getCatalog, uploadPhoto, genHairstyle, getGenResult
};
