/**
 * 降级链路：camera 组件实时画面 + wx.faceDetect 静态关键点
 * 用于不支持 VKSession 的机型。检测按节流执行（约 300ms 一次），达到「准实时」。
 */
class StaticDetect {
  constructor(opts = {}) {
    this.onFace = opts.onFace || (() => {});   // 回调人脸关键点
    this.onError = opts.onError || (() => {});
    this.ctx = null;
    this.timer = null;
    this.lastDetect = 0;
    this.interval = opts.interval || 300;
  }

  /** 初始化：绑定 camera 组件帧回调 */
  init(cameraContext) {
    this.ctx = cameraContext;
    const listener = cameraContext.onCameraFrame((frame) => {
      const now = Date.now();
      if (now - this.lastDetect < this.interval) return;
      this.lastDetect = now;
      this._detect(frame);
    });
    listener.start();
  }

  _detect(frame) {
    wx.faceDetect({
      frameBuffer: frame.data,   // ArrayBuffer
      width: frame.width,
      height: frame.height,
      success: (res) => {
        // res.faceInfo: [{ confidence, points(106点) }]
        const face = res.faceInfo && res.faceInfo[0];
        if (face && face.confidence > 0.7) {
          this.onFace({ points: face.points, frameWidth: frame.width, frameHeight: frame.height });
        } else {
          this.onFace(null);
        }
      },
      fail: (err) => this.onError(err)
    });
  }

  /** 拍照：直接用 camera 组件 takePhoto（获得干净清晰原图） */
  takePhoto() {
    return new Promise((resolve, reject) => {
      this.ctx.takePhoto({
        quality: 'high',
        success: (res) => resolve(res.tempImagePath),
        fail: reject
      });
    });
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
  }
}

module.exports = StaticDetect;
