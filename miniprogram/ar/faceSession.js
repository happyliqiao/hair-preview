/**
 * VKSession 实时人脸跟踪封装（主链路）
 * 依赖基础库 2.19.0+，部分机型/低版本微信不支持，需配合 staticDetect.js 降级。
 * 官方文档：https://developers.weixin.qq.com/miniprogram/dev/api/ai/visionkit/wx.createVKSession.html
 */
class FaceSession {
  /**
   * @param {Object} opts
   * @param {(frame: {texture:number, mesh:any, timestamp:number}) => void} opts.onFrame
   * @param {(err:Error) => void} opts.onError
   */
  constructor(opts = {}) {
    this.onFrame = opts.onFrame || (() => {});
    this.onError = opts.onError || (() => {});
    this.session = null;
    this.running = false;
  }

  /** 是否支持 VKSession */
  static isSupported() {
    return typeof wx.createVKSession === 'function';
  }

  /** 摄像头授权（scope.camera） */
  authorizeCamera() {
    return new Promise((resolve, reject) => {
      wx.getSetting({
        success: (res) => {
          if (res.authSetting['scope.camera']) return resolve();
          wx.authorize({
            scope: 'scope.camera',
            success: () => resolve(),
            fail: () => reject(new Error('CAMERA_DENIED'))
          });
        },
        fail: reject
      });
    });
  }

  async start() {
    if (this.running) return;
    await this.authorizeCamera();

    // 创建 VKSession：face 模式（mode 1 = 人脸检测）
    this.session = wx.createVKSession({
      track: {
        face: { mode: 1 }
      },
      version: 'v1'
    });

    this.session.on('update', (vkFrame) => this._handleFrame(vkFrame));
    this.session.on('error', (err) => this.onError(new Error('VKSession error: ' + (err && err.errMsg || err))));

    this.session.start((errno) => {
      if (errno) {
        this.onError(new Error('VKSession 启动失败，错误码: ' + errno));
        return;
      }
      this.running = true;
    });
  }

  _handleFrame(vkFrame) {
    if (!vkFrame) return;
    let texture = null;
    let mesh = null;
    try {
      texture = vkFrame.getCameraTexture(); // 相机纹理（WebGLTexture id）
      mesh = vkFrame.getFaceMesh();         // 人脸 3D 网格（顶点/索引，字段以官方文档为准）
    } catch (e) {
      this.onError(e);
    }
    this.onFrame({ texture, mesh, timestamp: Date.now() });
  }

  stop() {
    this.running = false;
    if (this.session) {
      try { this.session.destroy && this.session.destroy(); } catch (e) {}
      this.session = null;
    }
  }
}

module.exports = FaceSession;
