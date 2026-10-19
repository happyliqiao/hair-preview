/**
 * 2D 叠加绘制：发型（程序化形状 / 图片）+ 发色
 * 绘制在 camera / WebGL 画面之上的透明 2D canvas 上。
 *
 * 说明：本模块是「实时粗看」的核心。程序化形状用颜色直接填充，
 * 因此「发型选择 + 发色选择」能实时联动；后续接入真实发型 PNG 时，
 * 改用 drawHairImage（贴图 + 色罩）。
 *
 * 注意：以下人脸包围盒→屏幕坐标的换算为「近似」实现，实际以真机为准，
 * 需要针对机型/分辨率做一次校准（调整 CALIB）。
 */

// 校准参数（按真机微调）
const CALIB = {
  hairLiftY: 0.10,   // 头发相对人脸包围盒顶部的上移比例
  hairWidth: 0.85    // 头发宽度 = 人脸宽度 × 该系数
};

/** 从 wx.faceDetect 106 关键点计算人脸屏幕包围盒 */
function computeFaceRect(points, frameW, frameH, canvasW, canvasH) {
  if (!points || !points.length) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  const sx = canvasW / frameW;
  const sy = canvasH / frameH;
  return {
    x: minX * sx,
    y: minY * sy,
    w: (maxX - minX) * sx,
    h: (maxY - minY) * sy
  };
}

/** 从 VKSession 人脸网格计算屏幕包围盒（近似，需真机校准） */
function computeFaceRectFromMesh(mesh, canvasW, canvasH) {
  const verts = mesh && (mesh.vertexData || mesh.vertices || mesh.points);
  if (!verts) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const stride = 3;
  for (let i = 0; i < verts.length; i += stride) {
    const x = verts[i], y = verts[i + 1];
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  if (!isFinite(minX)) return null;
  // 假设网格顶点 x/y 处于 [-1,1] 区间，映射到屏幕
  const span = 2;
  return {
    x: ((minX + 1) / span) * canvasW,
    y: ((minY + 1) / span) * canvasH,
    w: ((maxX - minX) / span) * canvasW,
    h: ((maxY - minY) / span) * canvasH
  };
}

/** 主入口：在 2D canvas 上绘制发型 + 发色
 *  opts.clear = false 时不清空画布（用于把发型叠加到已绘制的照片上） */
function draw(ctx, opts) {
  const { width, height, rect, shape, hex, clear = true } = opts;
  if (clear) ctx.clearRect(0, 0, width, height);
  if (!rect || !rect.w || !rect.h) return;
  drawHairShape(ctx, shape, rect, hex);
}

/** 程序化绘制发型形状（颜色直接填充） */
function drawHairShape(ctx, shape, rect, hex) {
  const cx = rect.x + rect.w / 2;
  const topY = rect.y + rect.h * CALIB.hairLiftY;
  const hw = rect.w * CALIB.hairWidth;      // 头发半宽
  const hh = rect.h * 0.8;                  // 头发半高

  ctx.save();
  ctx.fillStyle = hex;

  if (shape === 'long') {
    // 覆盖头顶的上半弧 + 两侧长发
    ctx.beginPath();
    ctx.ellipse(cx, topY, hw, hh, 0, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(cx - hw - 4, topY + hh * 0.2, hw * 0.5, rect.h * 1.35);
    ctx.fillRect(cx + hw * 0.5 + 4, topY + hh * 0.2, hw * 0.5, rect.h * 1.35);
  } else if (shape === 'curly') {
    // 卷发：一圈圆簇
    const cs = [
      [cx, topY + hh * 0.2, hw * 0.72],
      [cx - hw * 0.58, topY + hh * 0.5, hw * 0.48],
      [cx + hw * 0.58, topY + hh * 0.5, hw * 0.48],
      [cx - hw * 0.32, topY - hh * 0.18, hw * 0.42],
      [cx + hw * 0.32, topY - hh * 0.18, hw * 0.42]
    ];
    for (const [x, y, r] of cs) {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (shape === 'buzz') {
    // 清爽短发：薄薄一层
    ctx.beginPath();
    ctx.ellipse(cx, topY + hh * 0.18, hw * 0.92, hh * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // short（默认）：齐肩短发
    ctx.beginPath();
    ctx.ellipse(cx, topY + hh * 0.22, hw, hh * 0.72, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx - hw * 0.95, topY + hh * 0.85, hw * 0.35, hh * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx + hw * 0.95, topY + hh * 0.85, hw * 0.35, hh * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // 高光
  ctx.fillStyle = 'rgba(255,255,255,0.16)';
  ctx.beginPath();
  ctx.ellipse(cx - hw * 0.3, topY - hh * 0.08, hw * 0.34, hh * 0.22, -0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** 未来：真实发型 PNG 贴图 + 色罩（需发型 PNG 素材） */
function drawHairImage(ctx, rect, image, hex, opacity = 0.35) {
  // TODO: 按 rect 等比缩放 image 并定位到头顶；色罩叠加半透明颜色
}

module.exports = { draw, computeFaceRect, computeFaceRectFromMesh, drawHairImage };
