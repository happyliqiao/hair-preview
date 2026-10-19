const cloud = require('../../utils/cloud.js');
const defaultCatalog = require('../../data/defaultCatalog.js');
const FaceSession = require('../../ar/faceSession.js');
const Renderer = require('../../ar/renderer.js');
const StaticDetect = require('../../ar/staticDetect.js');
const overlay = require('../../ar/overlay.js');

Page({
  data: {
    fallback: false,           // 是否降级到 camera 组件模式
    hairstyles: [],
    colors: [],
    currentHairstyleId: '',
    currentColorId: '',
    faceDetected: false,
    generating: false,
    demo: false,               // 是否为演示模式（云端未接入时的本机合成）
    result: null               // { before, after }
  },

  onLoad() {
    this.faceSession = null;
    this.renderer = null;
    this.staticDetect = null;
    this.overlayCtx = null;
    this.overlaySize = null;
    this.lastRect = null;      // 最近一次人脸包围盒
    this._initOverlay();
    this._loadCatalog();
    this._initAR();
  },

  onUnload() {
    if (this.faceSession) this.faceSession.stop();
    if (this.staticDetect) this.staticDetect.stop();
  },

  _currentHairstyle() {
    return this.data.hairstyles.find((h) => h._id === this.data.currentHairstyleId);
  },
  _currentColor() {
    return this.data.colors.find((c) => c._id === this.data.currentColorId);
  },

  _initOverlay() {
    const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
    const w = info.windowWidth;
    const h = info.windowHeight;
    this.overlaySize = { width: w, height: h };
    wx.createSelectorQuery().select('#overlayCanvas').node().exec((res) => {
      const node = res && res[0] && res[0].node;
      if (!node) return;
      node.width = w;
      node.height = h;
      this.overlayCtx = node.getContext('2d');
    });
  },

  async _loadCatalog() {
    let hairstyles = defaultCatalog.hairstyles;
    let colors = defaultCatalog.colors;
    try {
      const catalog = await cloud.getCatalog();
      if (catalog.hairstyles && catalog.hairstyles.length) hairstyles = catalog.hairstyles;
      if (catalog.colors && catalog.colors.length) colors = catalog.colors;
    } catch (e) {
      // 云环境不可用 → 使用内置演示目录
    }
    this.setData({
      hairstyles,
      colors,
      currentHairstyleId: hairstyles[0] ? hairstyles[0]._id : '',
      currentColorId: colors[0] ? colors[0]._id : ''
    });
  },

  async _initAR() {
    if (FaceSession.isSupported()) {
      await this._initVKSession();
    } else {
      this._initFallback();
    }
  },

  async _initVKSession() {
    wx.createSelectorQuery().select('#arCanvas').node().exec(async (res) => {
      const canvas = res && res[0] && res[0].node;
      if (!canvas) return this._initFallback();
      try {
        this.renderer = new Renderer(canvas);
      } catch (e) {
        return this._initFallback();
      }
      this.faceSession = new FaceSession({
        onFrame: (frame) => {
          if (frame.texture) this.renderer.draw(frame.texture);
          const rect = overlay.computeFaceRectFromMesh(
            frame.mesh, this.overlaySize.width, this.overlaySize.height
          );
          this._redrawOverlay(rect);
        },
        onError: () => this._initFallback()
      });
      this.faceSession.start().catch(() => this._initFallback());
    });
  },

  _initFallback() {
    this.setData({ fallback: true });
    const ctx = wx.createCameraContext();
    this.staticDetect = new StaticDetect({
      onFace: ({ points, frameWidth, frameHeight }) => {
        const rect = overlay.computeFaceRect(
          points, frameWidth, frameHeight, this.overlaySize.width, this.overlaySize.height
        );
        this._redrawOverlay(rect);
      }
    });
    this.staticDetect.init(ctx);
  },

  _redrawOverlay(rect) {
    this.lastRect = rect;
    this.setData({ faceDetected: !!rect });
    if (!this.overlayCtx) return;
    const h = this._currentHairstyle();
    const c = this._currentColor();
    overlay.draw(this.overlayCtx, {
      width: this.overlaySize.width,
      height: this.overlaySize.height,
      rect,
      shape: h && h.shape,
      hex: c ? c.hex : '#4a2c1a'
    });
  },

  onPickHairstyle(e) {
    this.setData({ currentHairstyleId: e.currentTarget.dataset.id });
    this._redrawOverlay(this.lastRect);
  },

  onPickColor(e) {
    this.setData({ currentColorId: e.currentTarget.dataset.id });
    this._redrawOverlay(this.lastRect);
  },

  // ============ 拍照生成 ============
  async onCapture() {
    if (this.data.generating) return;
    this.setData({ generating: true, demo: false });

    // 1) 拍照（降级模式用 camera.takePhoto，主链路用 WebGL 截图）
    let photoPath = null;
    try {
      if (this.data.fallback && this.staticDetect) {
        photoPath = await this.staticDetect.takePhoto();
      } else if (this.renderer) {
        photoPath = await this.renderer.capture();
      }
    } catch (e) {
      console.warn('[capture] 拍照失败:', e);
    }
    if (!photoPath) {
      this.setData({ generating: false });
      wx.showToast({ title: '拍照失败，请重试', icon: 'none' });
      return;
    }

    // 2) 先尝试真实 AI 链路（云开发 + 云函数 + 腾讯云人脸融合）
    try {
      const real = await this._realGenerate(photoPath);
      this.setData({ result: real, demo: false, generating: false });
      return;
    } catch (e) {
      console.warn('[AI] 真实链路失败，转演示模式:', (e && e.message) || e);
    }

    // 3) 云端不可用 → 本机演示：把所选发型/发色合成到照片上
    try {
      const demo = await this._localComposite(photoPath);
      this.setData({ result: demo, demo: true, generating: false });
    } catch (e) {
      console.warn('[demo] 合成失败，直接展示原图:', e);
      this.setData({ result: { before: photoPath, after: photoPath }, demo: true, generating: false });
    }
  },

  /** 真实 AI 链路 */
  async _realGenerate(photoPath) {
    const fileID = await cloud.uploadPhoto(photoPath);
    const res = await cloud.genHairstyle({
      photoFileID: fileID,
      hairstyleId: this.data.currentHairstyleId,
      colorId: this.data.currentColorId
    });
    if (!res || !res.genId) throw new Error((res && res.msg) || '云函数未返回任务');
    const data = await this._pollResult(res.genId);
    return { before: photoPath, after: data.resultFileID };
  },

  /** 本机演示：把发型/发色直接合成到拍摄的照片上（无需云端） */
  async _localComposite(photoPath) {
    const info = await new Promise((res, rej) => {
      wx.getImageInfo({ src: photoPath, success: res, fail: rej });
    });
    const w = info.width;
    const h = info.height;

    const node = await this._getCanvasNode('#captureCanvas');
    node.width = w;
    node.height = h;
    const ctx = node.getContext('2d');

    // 画照片
    const img = node.createImage();
    await new Promise((res, rej) => {
      img.onload = res;
      img.onerror = rej;
      img.src = photoPath;
    });
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);

    // 在照片上检测人脸（失败则用居中位置）
    let rect = null;
    try {
      const imageData = ctx.getImageData(0, 0, w, h);
      const detect = await new Promise((res, rej) => {
        wx.faceDetect({
          frameBuffer: imageData.data.buffer,
          width: w,
          height: h,
          success: res,
          fail: rej
        });
      });
      const face = detect.faceInfo && detect.faceInfo[0];
      if (face && face.confidence > 0.5) {
        rect = overlay.computeFaceRect(face.points, w, h, w, h);
      }
    } catch (e) {
      console.warn('[demo] 人脸检测不可用，使用居中位置:', e);
    }
    if (!rect) rect = { x: w * 0.3, y: h * 0.22, w: w * 0.4, h: h * 0.5 };

    const hs = this._currentHairstyle();
    const co = this._currentColor();
    overlay.draw(ctx, {
      width: w,
      height: h,
      rect,
      shape: hs && hs.shape,
      hex: co ? co.hex : '#4a2c1a',
      clear: false
    });

    const tmp = await new Promise((res, rej) => {
      wx.canvasToTempFilePath({
        canvas: node,
        width: w,
        height: h,
        destWidth: w,
        destHeight: h,
        success: (r) => res(r.tempFilePath),
        fail: rej
      });
    });
    return { before: photoPath, after: tmp };
  },

  _getCanvasNode(selector) {
    return new Promise((res, rej) => {
      wx.createSelectorQuery().select(selector).node().exec((r) => {
        const n = r && r[0] && r[0].node;
        n ? res(n) : rej(new Error('canvas not found: ' + selector));
      });
    });
  },

  _pollResult(genId, timeout = 20000) {
    return new Promise((resolve, reject) => {
      const start = Date.now();
      const tick = async () => {
        try {
          const res = await cloud.getGenResult(genId);
          const data = res && res.data;
          if (!data) return reject(new Error((res && res.msg) || '生成失败'));
          if (data.status === 'success') return resolve(data);
          if (data.status === 'failed') return reject(new Error(data.errorMsg || '生成失败'));
          if (Date.now() - start > timeout) return reject(new Error('生成超时'));
          setTimeout(tick, 2000);
        } catch (e) {
          reject(e);
        }
      };
      tick();
    });
  },

  onSave() {
    if (!this.data.result) return;
    wx.saveImageToPhotosAlbum({
      filePath: this.data.result.after,
      success: () => wx.showToast({ title: '已保存', icon: 'success' }),
      fail: () => wx.showToast({ title: '请开启相册权限', icon: 'none' })
    });
  },

  onRetry() {
    this.setData({ result: null });
  },

  onBack() {
    wx.navigateBack({ fail: () => wx.exitMiniProgram() });
  },

  onShareAppMessage() {
    return { title: '看看我做完发型长啥样~', path: '/pages/tryon/tryon' };
  }
});
