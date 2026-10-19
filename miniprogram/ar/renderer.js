/**
 * WebGL 渲染器：绘制相机纹理 + 叠加图层 + 截图
 * 说明：本文件给出「相机帧上屏 + 截图」的最小可用管线；
 * 「发型 PNG 贴图对齐」与「发色色罩」按人脸网格/关键点做仿射变换的具体绘制代码
 * 需在此基础上扩展（见 drawOverlay 的 TODO）。
 */
class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.gl = null;
    this.program = null;
    this.buffers = null;
    this._initGL();
  }

  _initGL() {
    const gl = this.canvas.getContext('webgl');
    if (!gl) throw new Error('当前环境不支持 WebGL');
    this.gl = gl;

    const vs = `
      attribute vec2 aPos;
      attribute vec2 aTexCoord;
      varying vec2 vTexCoord;
      void main() { gl_Position = vec4(aPos, 0.0, 1.0); vTexCoord = aTexCoord; }
    `;
    const fs = `
      precision mediump float;
      varying vec2 vTexCoord;
      uniform sampler2D uSampler;
      void main() { gl_FragColor = texture2D(uSampler, vTexCoord); }
    `;

    const program = this._createProgram(vs, fs);
    this.program = program;

    // 全屏四边形（两个三角形）
    const verts = new Float32Array([
      -1, -1,  0, 0,
       1, -1,  1, 0,
      -1,  1,  0, 1,
      -1,  1,  0, 1,
       1, -1,  1, 0,
       1,  1,  1, 1
    ]);
    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);
    this.buffers = { vbo };

    gl.useProgram(program);
    const aPos = gl.getAttribLocation(program, 'aPos');
    const aTexCoord = gl.getAttribLocation(program, 'aTexCoord');
    gl.enableVertexAttribArray(aPos);
    gl.enableVertexAttribArray(aTexCoord);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 16, 0);
    gl.vertexAttribPointer(aTexCoord, 2, gl.FLOAT, false, 16, 8);
  }

  _createProgram(vsSrc, fsSrc) {
    const gl = this.gl;
    const compile = (type, src) => {
      const sh = gl.createShader(type);
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        throw new Error(gl.getShaderInfoLog(sh));
      }
      return sh;
    };
    const program = gl.createProgram();
    gl.attachShader(program, compile(gl.VERTEX_SHADER, vsSrc));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fsSrc));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(program));
    }
    return program;
  }

  /** 每帧绘制相机纹理 */
  draw(texture) {
    const gl = this.gl;
    const w = this.canvas.width;
    const h = this.canvas.height;
    gl.viewport(0, 0, w, h);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(this.program);

    // 相机纹理通常需要 Y 轴翻转，具体以真机表现为准
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.activeTexture(gl.TEXTURE0);
    const loc = gl.getUniformLocation(this.program, 'uSampler');
    gl.uniform1i(loc, 0);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  /**
   * 叠加发型贴图 / 发色色罩
   * TODO：基于人脸网格/关键点计算屏幕坐标，对发型 PNG 做仿射变换贴图；
   *       色罩用半透明多边形覆盖头发区域。
   */
  drawOverlay(faceScreenRect /* 人脸在屏幕上的包围盒 */, overlay /* 发型贴图或色罩描述 */) {
    // 占位：此处扩展叠加绘制
  }

  /** 截图当前画面 → 临时图片路径 */
  capture() {
    const gl = this.gl;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const pixels = new Uint8Array(w * h * 4);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

    // 翻转像素到 2D canvas
    return new Promise((resolve, reject) => {
      wx.createSelectorQuery()
        .select('#captureCanvas')
        .fields({ node: true, size: true })
        .exec((res) => {
          const node = res && res[0];
          if (!node) return reject(new Error('找不到截图 canvas'));
          const c2d = node.node;
          c2d.width = w; c2d.height = h;
          const ctx = c2d.getContext('2d');
          const img = ctx.createImageData(w, h);
          for (let y = 0; y < h; y++) {
            const src = y * w * 4;
            const dst = (h - y - 1) * w * 4;
            img.data.set(pixels.subarray(src, src + w * 4), dst);
          }
          ctx.putImageData(img, 0, 0);
          wx.canvasToTempFilePath({
            canvas: c2d,
            success: (r) => resolve(r.tempFilePath),
            fail: reject
          });
        });
    });
  }
}

module.exports = Renderer;
