# 发型 / 发色试戴小程序 · 可运行工程

原生微信小程序工程，已补全：实时 AR（VKSession）+ 降级链路（camera + wx.faceDetect）+ 实时发型/发色叠加（Canvas 程序化绘制）+ 4+1 个云函数 + 内置演示数据。**无云环境也能打开看到完整 UI 和实时叠加效果**。

## 目录结构

```
miniprogram-skeleton/
├── project.config.json              # 开发者工具项目配置（填 AppID）
├── miniprogram/
│   ├── app.js / app.json / app.wxss / sitemap.json
│   ├── utils/cloud.js               # 云开发封装
│   ├── data/defaultCatalog.js       # 内置演示目录（无云也能跑）
│   ├── ar/faceSession.js            # VKSession 实时人脸（主链路）
│   ├── ar/renderer.js               # WebGL 相机帧渲染 + 截图
│   ├── ar/staticDetect.js           # 降级链路 camera + wx.faceDetect
│   ├── ar/overlay.js                # 发型/发色叠加绘制（核心）
│   └── pages/tryon/                 # 试戴页
└── cloudfunctions/
    ├── getCatalog/                  # 拉取目录
    ├── genHairstyle/                # 腾讯云 FaceFusion 融合
    ├── getGenResult/                # 结果轮询
    ├── cleanupTempPhoto/            # 定时清理（合规）
    └── seedData/                    # 一键灌入示例数据
```

## 一、如何在微信开发者工具里打开（最快 3 分钟）

1. 打开微信开发者工具 → 点「导入项目」。
2. 目录选 `miniprogram-skeleton/`。
3. AppID 填你的（没有就用「测试号」，但云开发能力需真实 AppID）。
4. 导入后即可在模拟器看到**首页 → 授权 → 试戴 → 生成 → 结果**的完整界面和发型/发色切换（内置演示数据已生效，无需后端）。

> 模拟器没有摄像头，所以「实时画面 + 人脸叠加」要**真机预览**才能看到：点工具栏「预览」用手机扫码，授权摄像头后，对脸即可看到发型形状 + 发色实时叠加。

## 二、已能直接看到的东西（无需任何账号）

- 完整 5 屏界面与交互（内置 4 款发型 × 9 种发色）。
- 真机上：摄像头实时画面 + 发型形状 + 发色联动（Canvas 程序化绘制）。
- 发型/发色切换即时重绘。

## 二·五、关于「拍照生成效果图」失败（重要）

「拍照生成效果图」**依赖完整云端 AI 链路**：云开发环境 + 云函数部署 + 腾讯云人脸融合开通 + 素材模板。这些没配齐时，该按钮一定会失败（上传/调用云函数抛错）。

为让你在开发者工具里也能把流程跑通，已加**演示模式**：
- 点击「拍照生成」后，先尝试真实 AI；失败则**自动把所选发型/发色直接合成到刚拍的照片上**（本机 Canvas 完成，不需要云端）。
- 结果页会标注「演示」，并显示原图 vs 合成效果图。
- 真实失败原因会打印在开发者工具**控制台**（`[AI] 真实链路失败…`），方便排查。

> 演示模式的合成是「近似粗看」（用照片上检测到的人脸位置贴发型形状 + 颜色），不是真实 AI 融合效果。

## 三、接上后端后能做的事（需你的账号）

1. **云开发**：工具里点「云开发」开通环境，`app.js` 填环境 ID。
2. **灌数据**：云函数 `seedData` 云端测试执行一次 → 写入 `hairstyle`/`hairColor`/`template`。
3. **AI 生成效果图**：按 `FaceFusion集成指南.md` 开通腾讯云人脸融合、配 `genHairstyle` 环境变量、把 `template.facefusionModelId` 换成真实素材 ID。
4. 完成后，「拍照生成效果图」即可走通：拍照 → 上传 → FaceFusion 融合 → 结果回显 → 保存/分享。

## 四、完成度与待办（诚实清单）

| 模块 | 状态 |
|---|---|
| 工程结构 / 配置 / 云初始化 | ✅ 完成 |
| 内置演示数据 + 完整 UI | ✅ 完成 |
| 实时叠加（程序化发型 + 发色） | ✅ 完成（近似，需真机校准） |
| VKSession 启动 + 帧回调 | ✅ 完成（网格→屏幕坐标需按官方文档校准） |
| 降级链路 camera + faceDetect | ✅ 完成 |
| WebGL 相机帧渲染 + 截图 | ✅ 基础可用 |
| 云函数 ×5 | ✅ 完成（genHairstyle 需真实密钥/素材） |
| 真实发型 PNG 贴图对齐 | ⏳ 待做（有素材后替换程序化形状） |

**仍需你提供 / 我无法代做的**：
- 你的 AppID、云开发环境、腾讯云人脸融合账号（密钥、素材 ModelId）。
- 真实发型 PNG 素材（透明底正面图）与 FaceFusion 模板图。
- 真机上的坐标校准与效果调优（必须实机跑）。

## 五、关键 API 校准提示

- `VKFrame.getFaceMesh()` 的返回结构、相机纹理 Y 轴翻转、人脸网格→屏幕坐标的映射，**均需真机跑一次校准**，参考官方文档：
  https://developers.weixin.qq.com/miniprogram/dev/api/ai/visionkit/wx.createVKSession.html
- `wx.faceDetect` 关键点与屏幕的缩放关系，见 `ar/overlay.js` 的 `CALIB` 常量。

## 六、可选：生成 PNG 占位素材

`scripts/gen_assets.py`（需本机安装 Pillow）可生成发型透明 PNG/缩略图/模板图。当前工程用的是 Canvas 程序化绘制，不需要这些 PNG 也能跑；等你接入真实发型贴图时再用。
