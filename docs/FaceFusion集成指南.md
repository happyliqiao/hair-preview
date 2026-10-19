# 腾讯云人脸融合 FaceFusion 集成指南

> 对应云函数：`cloudfunctions/genHairstyle/index.js`（可直接使用）。
> 官方文档：https://cloud.tencent.com/document/product/670（人脸融合）

## 一、开通与准备（一次性）

1. **开通服务**：腾讯云控制台 → 搜索「人脸融合」→ 开通（需企业实名认证，个人实名无法开通）。
2. **创建活动（ProjectId）**：人脸融合控制台 → 「活动管理」→ 新建活动，得到一个 **ProjectId**（活动 ID）。
3. **上传素材（ModelId）**：在活动里上传「素材图」（即每个发型×发色的模特模板图），每张素材对应一个 **ModelId**（素材 ID）。
   - 素材图要求：正面、清晰、单人、五官端正、无遮挡。
   - 把每个 ModelId 记入 `template` 集合的 `facefusionModelId` 字段（与 `hairstyleId`/`colorId` 关联）。
4. **获取密钥**：腾讯云控制台 → 访问管理 CAM → API 密钥 → 新建密钥，得到 **SecretId / SecretKey**。

## 二、云函数环境变量配置

在云开发控制台 → 云函数 → `genHairstyle` → 配置 → 环境变量，新增：

| 变量名 | 值 | 说明 |
|---|---|---|
| `TENCENT_SECRET_ID` | 你的 SecretId | 腾讯云鉴权 |
| `TENCENT_SECRET_KEY` | 你的 SecretKey | 腾讯云鉴权（敏感，勿泄） |
| `FACEFUSION_PROJECT_ID` | 你的 ProjectId | 人脸融合活动 ID |

> ModelId 不放在环境变量里，而是从 `template` 集合按「发型×发色」动态读取（见云函数第 1 步），这样新增发型/发色不用改代码。

## 三、SDK 调用说明

```js
const tencentcloud = require('tencentcloud-sdk-nodejs');
const FacefusionClient = tencentcloud.facefusion.v20181201.Client;

const client = new FacefusionClient({
  credential: { secretId, secretKey },
  region: 'ap-guangzhou',
  profile: { httpProfile: { endpoint: 'facefusion.tencentcloudapi.com' } }
});

const resp = await client.FaceFusion({
  ProjectId: process.env.FACEFUSION_PROJECT_ID,
  ModelId: modelId,
  Image: imageBase64,      // 顾客照片 base64（不含 data: 前缀）
  RspImgType: 'base64',    // 'base64' 或 'url'
  PornDetect: true,        // 鉴黄，建议开启（合规）
  CelebrityIdentify: false
});
// resp.Image 即结果图（base64 或 url，取决于 RspImgType）
```

### 关键参数表

| 参数 | 必填 | 说明 |
|---|---|---|
| `ProjectId` | 是 | 活动 ID |
| `ModelId` | 是 | 素材模板 ID |
| `Image` | 是 | 待融合的顾客照片，base64 编码，大小/格式要求见官方文档 |
| `RspImgType` | 是 | 结果返回方式：`base64`（推荐，云函数内直传）或 `url` |
| `PornDetect` | 否 | 是否鉴黄，默认 false，建议 true |
| `CelebrityIdentify` | 否 | 是否识别名人，默认 false |

> 注意：接口方法名与版本以控制台「API Explorer」生成的代码为准（产品 `facefusion`、版本 `2018-12-01`、动作 `FaceFusion`）。

## 四、常见错误码与处理

| 错误 | 含义 | 处理 |
|---|---|---|
| `FailedOperation.ImageDecodeFailed` | 图片解码失败 | 检查 base64 是否正确、图片是否损坏/过大 |
| `FailedOperation.ImageSizeExceed` | 图片过大 | 压缩顾客照片（建议宽高 ≤ 1080）后再传 |
| `FailedOperation.FaceDetectFailed` | 未检测到人脸 | 提示顾客正对镜头、光线充足 |
| `FailedOperation.ProjectNotExist` | 活动不存在 | 核对 ProjectId |
| `FailedOperation.ModelNotExist` | 素材不存在 | 核对 ModelId / template 映射 |
| `AuthFailure.*` | 鉴权失败 | 核对 SecretId/SecretKey、是否已开通服务 |
| `UnpaidOrder` / 欠费 | 账户欠费 | 去控制台充值 |

## 五、测试方法

**方式 A · API Explorer（推荐先测）**
腾讯云控制台 → 人脸融合 → API Explorer，直接填参数试一次，验证 ProjectId/ModelId/照片都正确。

**方式 B · 云函数本地测试**
在微信开发者工具里，对 `genHairstyle` 云函数点「云端测试」，传入：
```json
{ "photoFileID": "cloud://...jpg", "hairstyleId": "hair_01", "colorId": "color_03" }
```
观察返回的 `genId`，再到 `generation` 集合查该记录状态。

**方式 C · 小程序端到端**
小程序里完成「拍照 → 生成」全流程，看结果图是否回显。

## 六、成本说明

- 人脸融合按「调用次数」计费（资源包或按量），单价随调用量阶梯下降。
- 建议先在腾讯云领免费额度 / 买小资源包做验证，确认效果后按量扩容。
- 云函数运行时长、云存储流量另计（云开发按量付费）。

## 七、与代码骨架的对应关系

| 环节 | 位置 |
|---|---|
| 前端发起生成 | `miniprogram/pages/tryon/tryon.js` 的 `onCapture` |
| 云函数入口 | `cloudfunctions/genHairstyle/index.js` |
| 模板映射 | `template` 集合（`facefusionModelId` 字段） |
| 结果轮询 | `cloudfunctions/getGenResult/index.js` |
| 原图清理 | `cloudfunctions/cleanupTempPhoto/index.js`（定时触发） |
