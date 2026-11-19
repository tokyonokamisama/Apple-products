// 程序化 3D 产品模型（Three.js）。所有模型均为示意造型，按真实比例近似建模。
// 每个 build 函数返回：{ group, view, setColor(hex), actions[], update(dt), dispose() }
import * as THREE from 'three';
import { toCreasedNormals } from 'three/addons/BufferGeometryUtils.js';

const PI = Math.PI;
const FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Display", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Helvetica Neue", Arial, sans-serif';

/* ───────────────────────── 工具 ───────────────────────── */

function rrShape(w, h, r, radii) {
  const [tl, tr, br, bl] = (radii || [r, r, r, r]).map((v) => Math.max(0, Math.min(v, w / 2, h / 2)));
  const x = -w / 2, y = -h / 2;
  const s = new THREE.Shape();
  s.moveTo(x + bl, y);
  s.lineTo(x + w - br, y);
  if (br) s.bezierCurveTo(x + w - br * 0.35, y, x + w, y + br * 0.35, x + w, y + br);
  s.lineTo(x + w, y + h - tr);
  if (tr) s.bezierCurveTo(x + w, y + h - tr * 0.35, x + w - tr * 0.35, y + h, x + w - tr, y + h);
  s.lineTo(x + tl, y + h);
  if (tl) s.bezierCurveTo(x + tl * 0.35, y + h, x, y + h - tl * 0.35, x, y + h - tl);
  s.lineTo(x, y + bl);
  if (bl) s.bezierCurveTo(x, y + bl * 0.35, x + bl * 0.35, y, x + bl, y);
  return s;
}

// 圆角厚板：XY 平面为轮廓，Z 为厚度，居中。材质组 0 = 正反面，1 = 侧边与倒角
function slab(w, h, d, r, o = {}) {
  const b = o.bevel ?? Math.min(d * 0.42, r * 0.9);
  const radii = o.radii ? o.radii.map((v) => Math.max(v - b, 0.0005)) : null;
  const shape = rrShape(w - 2 * b, h - 2 * b, Math.max(r - b, 0.0005), radii);
  const depth = Math.max(d - 2 * b, 0.0002);
  const g = new THREE.ExtrudeGeometry(shape, {
    depth, bevelEnabled: b > 0, bevelThickness: b, bevelSize: b,
    bevelSegments: o.bs ?? 5, curveSegments: o.cs ?? 14,
  });
  g.translate(0, 0, -depth / 2);
  return toCreasedNormals(g, 0.7);
}

// 平躺的厚板（厚度沿 Y）
function slabY(w, depthZ, t, r, o) {
  const g = slab(w, depthZ, t, r, o);
  g.rotateX(-PI / 2);
  return g;
}

function planeRR(w, h, r, radii, seg = 20) {
  const g = new THREE.ShapeGeometry(rrShape(w, h, r, radii), seg);
  const p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / w + 0.5, p.getY(i) / h + 0.5);
  uv.needsUpdate = true;
  return g;
}

function hexA(hex, a) {
  const c = new THREE.Color(hex);
  return `rgba(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)},${a})`;
}
function shade(hex, dl, ds = 0) {
  const c = new THREE.Color(hex), hsl = {};
  c.getHSL(hsl);
  c.setHSL(hsl.h, THREE.MathUtils.clamp(hsl.s + ds, 0, 1), THREE.MathUtils.clamp(hsl.l + dl, 0, 1));
  return '#' + c.getHexString();
}
function hueShift(hex, dh, l = null, s = null) {
  const c = new THREE.Color(hex), hsl = {};
  c.getHSL(hsl);
  c.setHSL((hsl.h + dh + 1) % 1, s ?? Math.max(hsl.s, 0.45), l ?? 0.5);
  return '#' + c.getHexString();
}

function ctxRR(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function canvasTex(W, H, draw, opts = {}) {
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  draw(ctx, W, H);
  const t = new THREE.CanvasTexture(c);
  if (!opts.linear) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (opts.repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...opts.repeat); }
  return t;
}

function blobs(ctx, W, H, base, list) {
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, W, H);
  for (const [x, y, r, col, a = 0.9] of list) {
    const R = r * Math.max(W, H);
    const g = ctx.createRadialGradient(x * W, y * H, 0, x * W, y * H, R);
    g.addColorStop(0, hexA(col, a));
    g.addColorStop(0.55, hexA(col, a * 0.35));
    g.addColorStop(1, hexA(col, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }
}

function palette(hex) {
  return [hueShift(hex, 0.0, 0.55, 0.7), hueShift(hex, 0.12, 0.5, 0.75), hueShift(hex, -0.15, 0.45, 0.7)];
}

/* ───────────────────────── 材质 ───────────────────────── */

const Mat = {
  metal: (hex, rough = 0.3) => new THREE.MeshPhysicalMaterial({ color: hex, metalness: 1, roughness: rough }),
  satin: (hex, rough = 0.42) => new THREE.MeshPhysicalMaterial({ color: hex, metalness: 0.85, roughness: rough, clearcoat: 0.2, clearcoatRoughness: 0.4 }),
  glass: (hex, rough = 0.42) => new THREE.MeshPhysicalMaterial({ color: hex, metalness: 0.25, roughness: rough, clearcoat: 1, clearcoatRoughness: 0.08 }),
  black: (rough = 0.12) => new THREE.MeshPhysicalMaterial({ color: 0x060607, metalness: 0.3, roughness: rough, clearcoat: 1, clearcoatRoughness: 0.04 }),
  plastic: (hex, rough = 0.35) => new THREE.MeshPhysicalMaterial({ color: hex, metalness: 0, roughness: rough, clearcoat: 0.5, clearcoatRoughness: 0.25 }),
  matte: (hex, rough = 0.85) => new THREE.MeshStandardMaterial({ color: hex, metalness: 0, roughness: rough }),
  screen: (tex, k = 1) => new THREE.MeshPhysicalMaterial({
    color: 0x000000, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: k,
    roughness: 0.06, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.02,
  }),
  basic: (hex) => new THREE.MeshBasicMaterial({ color: hex }),
};

function lens(r, o = {}) {
  const g = new THREE.Group();
  const ringMat = o.ringMat || Mat.metal('#77787d', 0.22);
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.02, 0.016, 48), ringMat);
  ring.rotation.x = PI / 2;
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.84, r * 0.84, 0.018, 48), Mat.black(0.05));
  glass.rotation.x = PI / 2;
  const coat = new THREE.Mesh(new THREE.RingGeometry(r * 0.34, r * 0.5, 40),
    new THREE.MeshPhysicalMaterial({ color: 0x0b0d22, metalness: 0.6, roughness: 0.1, iridescence: 1, iridescenceIOR: 1.6, clearcoat: 1 }));
  coat.position.z = 0.0092;
  const pupil = new THREE.Mesh(new THREE.CircleGeometry(r * 0.3, 32), Mat.black(0.02));
  pupil.position.z = 0.0094;
  g.add(ring, glass, coat, pupil);
  return g;
}

function dot(r, mat, segs = 28) {
  const m = new THREE.Mesh(new THREE.CircleGeometry(r, segs), mat);
  return m;
}

function onBack(obj, x, y, z) {
  obj.rotation.y = PI;
  obj.position.set(x, y, z);
  return obj;
}

// 闭合 / 非闭合的带状几何（表带、头带）。points: Vector2[]（截面平面坐标），map(a, b, side) → Vector3
function ribbon(points, width, thick, map, closed = true) {
  const n = points.length;
  const pos = [];
  const idx = [];
  for (let i = 0; i < n; i++) {
    const p0 = points[closed ? (i - 1 + n) % n : Math.max(i - 1, 0)];
    const p1 = points[closed ? (i + 1) % n : Math.min(i + 1, n - 1)];
    const t = new THREE.Vector2().subVectors(p1, p0).normalize();
    const nrm = new THREE.Vector2(-t.y, t.x);
    const P = points[i];
    const o = P.clone().addScaledVector(nrm, thick / 2);
    const inn = P.clone().addScaledVector(nrm, -thick / 2);
    for (const [q, s] of [[o, 1], [o, -1], [inn, -1], [inn, 1]]) {
      const v = map(q.x, q.y, s * width / 2);
      pos.push(v.x, v.y, v.z);
    }
  }
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const a = i * 4, b = ((i + 1) % n) * 4;
    for (let k = 0; k < 4; k++) {
      const k2 = (k + 1) % 4;
      idx.push(a + k, b + k, b + k2, a + k, b + k2, a + k2);
    }
  }
  if (!closed) {
    const e = (n - 1) * 4;
    idx.push(0, 1, 2, 0, 2, 3, e, e + 2, e + 1, e, e + 3, e + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function damp(cur, target, dt, k = 5) {
  return cur + (target - cur) * Math.min(1, dt * k);
}

function finalize(group, extra) {
  return {
    group,
    view: new THREE.Vector3(0.5, 0.2, 0.85),
    actions: [],
    update() {},
    setColor() {},
    dispose() {
      group.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
        ms.forEach((m) => {
          for (const k of ['map', 'emissiveMap', 'bumpMap', 'roughnessMap', 'alphaMap']) m[k]?.dispose?.();
          m.dispose();
        });
      });
    },
    ...extra,
  };
}

/* ───────────────────────── 屏幕纹理 ───────────────────────── */

function phoneScreenTex(aspect, hex, o = {}) {
  const W = 512, H = Math.round(512 * aspect);
  return canvasTex(W, H, (ctx) => {
    const [a, b, c] = palette(hex);
    blobs(ctx, W, H, '#05060a', [[0.15, 0.2, 0.75, a], [0.95, 0.55, 0.7, b], [0.3, 1.0, 0.65, c], [0.7, 0.05, 0.4, b, 0.5]]);
    ctx.fillStyle = 'rgba(255,255,255,0.88)';
    ctx.textAlign = 'center';
    ctx.font = `500 ${W * 0.048}px ${FONT}`;
    ctx.fillText('11月19日 星期四', W / 2, H * 0.12);
    ctx.font = `600 ${W * 0.25}px ${FONT}`;
    ctx.fillText('10:24', W / 2, H * 0.12 + W * 0.26);
    // 小组件
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    const ww = W * 0.38;
    ctxRR(ctx, W * 0.08, H * 0.68, ww, ww * 0.9, W * 0.07); ctx.fill();
    ctxRR(ctx, W * 0.54, H * 0.68, ww, ww * 0.9, W * 0.07); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = `600 ${W * 0.075}px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.fillText('23°', W * 0.12, H * 0.68 + W * 0.12);
    ctx.font = `500 ${W * 0.04}px ${FONT}`;
    ctx.fillText('上海 · 多云', W * 0.12, H * 0.68 + W * 0.19);
    ctx.fillText('步数 8,412', W * 0.58, H * 0.68 + W * 0.12);
    ctx.fillStyle = hexA(b, 0.9);
    ctxRR(ctx, W * 0.58, H * 0.68 + W * 0.17, W * 0.26, W * 0.025, 4); ctx.fill();
    if (o.island !== false) {
      ctx.fillStyle = '#000';
      ctxRR(ctx, W * 0.34, H * 0.016, W * 0.32, W * 0.088, W * 0.044); ctx.fill();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctxRR(ctx, W * 0.33, H - W * 0.05, W * 0.34, W * 0.014, 4); ctx.fill();
  });
}

function tabletScreenTex(aspect, hex) {
  const W = 768, H = Math.round(768 * aspect);
  return canvasTex(W, H, (ctx) => {
    const [a, b, c] = palette(hex);
    blobs(ctx, W, H, '#07080d', [[0.1, 0.15, 0.7, a], [0.9, 0.4, 0.65, b], [0.4, 0.95, 0.6, c]]);
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = `600 ${W * 0.11}px ${FONT}`;
    ctx.fillText('10:24', W * 0.07, H * 0.12);
    ctx.font = `500 ${W * 0.03}px ${FONT}`;
    ctx.fillText('11月19日 星期四', W * 0.075, H * 0.12 + W * 0.05);
    const cols = 5, rows = 4, s = W * 0.12, gx = (W - cols * s) / (cols + 1);
    const hues = [0.58, 0.33, 0.08, 0.0, 0.75, 0.5, 0.13, 0.92, 0.62, 0.42, 0.03, 0.7, 0.18, 0.55, 0.86, 0.3, 0.0, 0.47, 0.66, 0.1];
    for (let r = 0; r < rows; r++) for (let q = 0; q < cols; q++) {
      const x = gx + q * (s + gx), y = H * 0.27 + r * (s + gx * 1.4);
      const col = new THREE.Color().setHSL(hues[(r * cols + q) % hues.length], 0.65, 0.55);
      const g = ctx.createLinearGradient(x, y, x, y + s);
      g.addColorStop(0, '#' + col.clone().offsetHSL(0, 0, 0.12).getHexString());
      g.addColorStop(1, '#' + col.getHexString());
      ctx.fillStyle = g;
      ctxRR(ctx, x, y, s, s, s * 0.24); ctx.fill();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctxRR(ctx, W * 0.12, H - W * 0.2, W * 0.76, W * 0.15, W * 0.05); ctx.fill();
    for (let i = 0; i < 6; i++) {
      const col = new THREE.Color().setHSL(i / 6, 0.6, 0.55);
      ctx.fillStyle = '#' + col.getHexString();
      ctxRR(ctx, W * 0.16 + i * W * 0.115, H - W * 0.18, W * 0.1, W * 0.1, W * 0.024); ctx.fill();
    }
  });
}

function macScreenTex(aspect, hex, notch) {
  const W = 1024, H = Math.round(1024 * aspect);
  return canvasTex(W, H, (ctx) => {
    const [a, b, c] = palette(hex);
    blobs(ctx, W, H, '#0a0b12', [[0.2, 0.8, 0.7, a], [0.8, 0.3, 0.7, b], [0.55, 1.0, 0.5, c], [0.0, 0.1, 0.45, c, 0.6]]);
    const mb = H * 0.035;
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.fillRect(0, 0, W, mb);
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = `600 ${mb * 0.55}px ${FONT}`;
    ctx.fillText('访达    文件    编辑    显示    前往    窗口', W * 0.03, mb * 0.7);
    ctx.textAlign = 'right';
    ctx.fillText('11月19日 周四 10:24', W * 0.97, mb * 0.7);
    ctx.textAlign = 'left';
    if (notch) { ctx.fillStyle = '#000'; ctxRR(ctx, W * 0.445, -10, W * 0.11, mb + 10, mb * 0.4); ctx.fill(); }
    // 窗口
    const wx = W * 0.14, wy = H * 0.16, ww = W * 0.52, wh = H * 0.56;
    ctx.fillStyle = 'rgba(28,28,32,0.82)';
    ctxRR(ctx, wx, wy, ww, wh, 14); ctx.fill();
    ['#ff5f57', '#febc2e', '#28c840'].forEach((col, i) => { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(wx + 22 + i * 20, wy + 20, 6, 0, PI * 2); ctx.fill(); });
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctxRR(ctx, wx + 16, wy + 44, ww * 0.26, wh - 60, 8); ctx.fill();
    for (let i = 0; i < 6; i++) { ctx.fillStyle = `rgba(255,255,255,${0.14 + (i === 1) * 0.2})`; ctxRR(ctx, wx + 26, wy + 60 + i * 30, ww * 0.2, 14, 5); ctx.fill(); }
    const gx = wx + ww * 0.32;
    for (let r = 0; r < 2; r++) for (let q = 0; q < 3; q++) {
      const col = new THREE.Color().setHSL((r * 3 + q) / 6 + 0.05, 0.55, 0.5);
      const g = ctx.createLinearGradient(0, wy, 0, wy + wh);
      g.addColorStop(0, '#' + col.getHexString());
      g.addColorStop(1, '#' + col.clone().offsetHSL(0.08, 0, -0.15).getHexString());
      ctx.fillStyle = g;
      ctxRR(ctx, gx + q * ww * 0.215, wy + 50 + r * wh * 0.44, ww * 0.19, wh * 0.38, 8); ctx.fill();
    }
    // 程序坞
    const dw = W * 0.5, dh = H * 0.075;
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctxRR(ctx, (W - dw) / 2, H - dh - H * 0.015, dw, dh, dh * 0.3); ctx.fill();
    for (let i = 0; i < 10; i++) {
      const col = new THREE.Color().setHSL(i / 10, 0.62, 0.56);
      ctx.fillStyle = '#' + col.getHexString();
      const s = dh * 0.72;
      ctxRR(ctx, (W - dw) / 2 + dh * 0.2 + i * (dw - dh * 0.4) / 10, H - dh - H * 0.015 + dh * 0.14, s, s, s * 0.24); ctx.fill();
    }
  });
}

function watchFaceTex(hex) {
  const S = 512;
  return canvasTex(S, Math.round(S * 1.2), (ctx, W, H) => {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'right';
    ctx.font = `600 ${W * 0.2}px ${FONT}`;
    ctx.fillText('10:09', W * 0.9, H * 0.22);
    ctx.fillStyle = hueShift(hex, 0, 0.62, 0.8);
    ctx.font = `600 ${W * 0.07}px ${FONT}`;
    ctx.fillText('周四 19', W * 0.9, H * 0.3);
    const cx = W * 0.5, cy = H * 0.64;
    [['#ff2d55', 0.3, 0.82], ['#a6ff00', 0.225, 0.64], ['#00e5ff', 0.15, 0.9]].forEach(([col, r, p]) => {
      ctx.lineWidth = W * 0.065; ctx.lineCap = 'round';
      ctx.strokeStyle = hexA(col, 0.22);
      ctx.beginPath(); ctx.arc(cx, cy, r * W, 0, PI * 2); ctx.stroke();
      ctx.strokeStyle = col;
      ctx.beginPath(); ctx.arc(cx, cy, r * W, -PI / 2, -PI / 2 + PI * 2 * p); ctx.stroke();
    });
  });
}

/* ───────────────────────── iPhone ───────────────────────── */

function buildPhone(p, hex) {
  const o = p.model;
  const { w, h, d, r } = o;
  const root = new THREE.Group();
  const frame = Mat.metal(hex, 0.28);
  const back = Mat.glass(hex, o.cam === 'plateau' ? 0.5 : 0.38);
  const b = d * 0.42;
  const body = new THREE.Mesh(slab(w, h, d, r, { bevel: b }), [back, frame]);
  root.add(body);

  // 正面：黑色玻璃 + 屏幕
  const bez = 0.022;
  const front = new THREE.Mesh(planeRR(w - 2 * b + 0.004, h - 2 * b + 0.004, r - b), Mat.black(0.05));
  front.position.z = d / 2 + 0.0006;
  const sw = w - 2 * bez, sh = h - 2 * bez;
  const screenTex = phoneScreenTex(sh / sw, hex);
  const screen = new THREE.Mesh(planeRR(sw, sh, r - bez), Mat.screen(screenTex));
  screen.position.z = d / 2 + 0.0012;
  root.add(front, screen);

  // 摄像头
  const bz = -d / 2;
  const tint = [frame, back];
  if (o.cam === 'plateau' || o.cam === 'bar') {
    const barH = o.cam === 'plateau' ? w * 0.47 : w * 0.21;
    const bar = new THREE.Mesh(slab(w - 2 * b - 0.01, barH, 0.026, Math.min(0.06, barH / 2), { bevel: 0.009 }), frame);
    const by = h / 2 - b - barH / 2 - 0.018;
    bar.position.set(0, by, bz - 0.006);
    root.add(bar);
    if (o.cam === 'plateau') {
      const lr = w * 0.1, lx = w * 0.2;
      const L = [[lx + lr * 0.05, by + lr * 1.15], [lx + lr * 0.05, by - lr * 1.15], [lx - lr * 1.95, by]];
      for (const [x, y] of L) root.add(onBack(lens(lr), x, y, bz - 0.02));
      const flash = dot(lr * 0.28, new THREE.MeshPhysicalMaterial({ color: '#f3ecd6', roughness: 0.3, emissive: '#2b2412' }));
      root.add(onBack(flash, -w * 0.22, by + lr * 0.9, bz - 0.0195));
      root.add(onBack(dot(lr * 0.3, Mat.black(0.2)), -w * 0.22, by - lr * 0.9, bz - 0.0195));
    } else {
      const lr = w * 0.075;
      root.add(onBack(lens(lr), w * 0.27, by, bz - 0.02));
      root.add(onBack(dot(lr * 0.4, Mat.black(0.2)), w * 0.1, by, bz - 0.0195));
      root.add(onBack(dot(lr * 0.32, new THREE.MeshPhysicalMaterial({ color: '#f3ecd6', roughness: 0.3 })), -w * 0.26, by, bz - 0.0195));
    }
  } else if (o.cam === 'dual') {
    const pw = w * 0.27, ph = w * 0.5;
    const pill = new THREE.Mesh(slab(pw, ph, 0.02, pw / 2, { bevel: 0.008 }), Mat.glass(shade(hex, -0.04), 0.12));
    tint.push(pill.material);
    const px = w / 2 - b - pw / 2 - 0.035, py = h / 2 - b - ph / 2 - 0.035;
    pill.position.set(px, py, bz - 0.004);
    root.add(pill);
    const lr = pw * 0.38;
    root.add(onBack(lens(lr), px, py + ph * 0.24, bz - 0.016));
    root.add(onBack(lens(lr), px, py - ph * 0.24, bz - 0.016));
    root.add(onBack(dot(lr * 0.3, new THREE.MeshPhysicalMaterial({ color: '#f3ecd6', roughness: 0.3 })), px - pw * 0.78, py + ph * 0.3, bz - 0.001));
  } else {
    const lr = w * 0.085;
    const px = w / 2 - b - lr - 0.045, py = h / 2 - b - lr - 0.045;
    root.add(onBack(lens(lr), px, py, bz - 0.008));
    root.add(onBack(dot(lr * 0.3, new THREE.MeshPhysicalMaterial({ color: '#f3ecd6', roughness: 0.3 })), px - lr * 1.7, py, bz - 0.001));
  }

  // 侧键
  const btn = (x, y, len, mat = frame) => {
    const m = new THREE.Mesh(slab(0.014, len, d * 0.32, 0.007, { bevel: 0.004 }), mat);
    m.position.set(x, y, 0);
    root.add(m);
  };
  btn(w / 2 + 0.004, h * 0.16, h * 0.11);
  btn(-w / 2 - 0.004, h * 0.18, h * 0.07);
  btn(-w / 2 - 0.004, h * 0.08, h * 0.07);
  btn(-w / 2 - 0.004, h * 0.3, h * 0.045);
  if (o.cam !== 'single') btn(w / 2 + 0.003, -h * 0.1, h * 0.065, Mat.black(0.1));

  const api = finalize(root, {
    view: new THREE.Vector3(0.5, 0.12, -0.86),
    setColor(hx) {
      for (const m of tint) m.color.set(m === tint[2] ? shade(hx, -0.04) : hx);
    },
  });
  api.actions = [{
    label: '亮屏', on: true, run(on) { screen.material.emissiveIntensity = on ? 1 : 0.0; },
  }];
  return api;
}

/* ───────────────────────── iPhone Duo（折叠） ───────────────────────── */

function buildFoldable(p, hex) {
  const root = new THREE.Group();
  const hw = 0.66, h = 1.52, d = 0.052, r = 0.11;
  const frame = Mat.metal(hex, 0.26);
  const back = Mat.glass(hex, 0.45);
  const b = d * 0.4;
  const bez = 0.022;

  const innerTex = canvasTex(1024, Math.round(1024 * (h - 2 * bez) / (2 * hw - 2 * bez)), (ctx, W, H) => {
    const [a, c2, c3] = palette(hex);
    blobs(ctx, W, H, '#05060a', [[0.1, 0.2, 0.6, a], [0.9, 0.3, 0.55, c2], [0.5, 0.95, 0.55, c3]]);
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = `600 ${W * 0.12}px ${FONT}`;
    ctx.fillText('10:24', W * 0.06, H * 0.16);
    ctx.font = `500 ${W * 0.026}px ${FONT}`;
    ctx.fillText('11月19日 星期四 · 上海 23°', W * 0.065, H * 0.16 + W * 0.045);
    const s = W * 0.1, gx = (W - 7 * s) / 8;
    for (let rr = 0; rr < 4; rr++) for (let q = 0; q < 7; q++) {
      const col = new THREE.Color().setHSL(((rr * 7 + q) * 0.137) % 1, 0.6, 0.55);
      ctx.fillStyle = '#' + col.getHexString();
      ctxRR(ctx, gx + q * (s + gx), H * 0.32 + rr * (s + gx * 1.3), s, s, s * 0.24); ctx.fill();
    }
  });
  const innerMat = Mat.screen(innerTex);

  function half(side) {
    // side: -1 = 左半（相对铰链在 -x），+1 = 右半
    const g = new THREE.Group();
    const radii = side < 0 ? [r, 0.012, 0.012, r] : [0.012, r, r, 0.012];
    const body = new THREE.Mesh(slab(hw, h, d, r, { bevel: b, radii }), [back, frame]);
    g.add(body);
    const frontR = radii.map((v) => Math.max(v - b, 0.001));
    const front = new THREE.Mesh(planeRR(hw - 2 * b + 0.004, h - 2 * b + 0.004, 0, frontR), Mat.black(0.05));
    front.position.z = d / 2 + 0.0006;
    g.add(front);
    // 内屏：铰链侧无边框
    const sw = hw - bez, sh = h - 2 * bez;
    const sr = side < 0 ? [r - bez, 0, 0, r - bez] : [0, r - bez, r - bez, 0];
    const sg = planeRR(sw, sh, 0, sr);
    const uv = sg.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setX(i, side < 0 ? uv.getX(i) * 0.5 : 0.5 + uv.getX(i) * 0.5);
    const screen = new THREE.Mesh(sg, innerMat);
    screen.position.set(side < 0 ? bez / 2 : -bez / 2, 0, d / 2 + 0.0012);
    g.add(screen);
    body.position.x = 0;
    return g;
  }

  const left = half(-1);
  left.position.x = -hw / 2;
  root.add(left);

  const pivot = new THREE.Group();
  pivot.position.set(0, 0, d / 2);
  const right = half(1);
  right.position.set(hw / 2, 0, -d / 2);
  pivot.add(right);
  root.add(pivot);

  // 外屏（右半背面）
  const ow = hw - 0.06, oh = h - 0.06;
  const outerTex = phoneScreenTex(oh / ow, hex);
  const outerBlack = new THREE.Mesh(planeRR(hw - 2 * b + 0.004, h - 2 * b + 0.004, r - b, [r - b, 0.001, 0.001, r - b]), Mat.black(0.05));
  const outer = new THREE.Mesh(planeRR(ow, oh, r - 0.03, [r - 0.03, 0.02, 0.02, r - 0.03]), Mat.screen(outerTex));
  outerBlack.rotation.y = PI; outer.rotation.y = PI;
  outerBlack.position.set(0, 0, -d / 2 - 0.0006);
  outer.position.set(0, 0, -d / 2 - 0.0012);
  right.add(outerBlack, outer);

  // 相机（左半背面）
  const barH = 0.3;
  const bar = new THREE.Mesh(slab(hw - 2 * b - 0.01, barH, 0.024, 0.06, { bevel: 0.009, radii: [0.06, 0.02, 0.02, 0.06] }), frame);
  bar.position.set(0, h / 2 - b - barH / 2 - 0.02, -d / 2 - 0.006);
  left.add(bar);
  const lr = 0.062;
  for (const [x, y] of [[0.17, 0.08], [0.17, -0.07], [0.02, 0]]) left.add(onBack(lens(lr), x, bar.position.y + y, -d / 2 - 0.02));
  left.add(onBack(dot(0.018, new THREE.MeshPhysicalMaterial({ color: '#f3ecd6' })), -0.13, bar.position.y + 0.06, -d / 2 - 0.0195));

  // 铰链脊
  const spineG = new THREE.Group();
  spineG.position.set(0, 0, d / 2);
  const spine = new THREE.Mesh(new THREE.CylinderGeometry(d, d, h - 0.08, 32, 1, false, PI / 2, PI), frame);
  spineG.add(spine);
  root.add(spineG);

  // 侧键
  const btn = new THREE.Mesh(slab(0.014, h * 0.1, d * 0.4, 0.007, { bevel: 0.004 }), frame);
  btn.position.set(hw + 0.004, h * 0.2, -d / 2);
  pivot.add(btn);

  let fold = 0, target = 0, loop = false, tLoop = 0;
  const api = finalize(root, {
    view: new THREE.Vector3(0.35, 0.12, 0.93),
    setColor(hx) { frame.color.set(hx); back.color.set(hx); },
    update(dt) {
      if (loop) {
        tLoop += dt;
        const ph = (tLoop % 7) / 7;
        target = ph < 0.42 ? 0 : ph < 0.5 ? 1 : ph < 0.92 ? 1 : 0;
      }
      fold = damp(fold, target, dt, 2.6);
      const e = fold < 0.5 ? 2 * fold * fold : 1 - Math.pow(-2 * fold + 2, 2) / 2;
      const ang = e * PI * 0.995;
      pivot.rotation.y = -ang;
      spineG.rotation.y = -ang / 2;
    },
    setLoop(v) { loop = v; },
    setFold(v) { target = v; },
  });
  api.actions = [{ label: '折叠', on: false, run(on) { target = on ? 1 : 0; } }];
  api.thumb = () => { fold = target = 0.32; api.update(0); };
  return api;
}

/* ───────────────────────── MacBook ───────────────────────── */

function buildLaptop(p, hex) {
  const o = p.model;
  const { w, d, t, lid: lt } = o;
  const root = new THREE.Group();
  const alu = Mat.satin(hex, 0.36);
  const base = new THREE.Mesh(slabY(w, d, t, 0.14, { bevel: t * 0.4 }), [alu, alu]);
  root.add(base);
  const top = t / 2;

  // 键盘区
  const kw = w * 0.8;
  const rows = [
    { hgt: 0.55, keys: [...Array(13).fill(1), 1.5] },
    { hgt: 1, keys: [...Array(13).fill(1), 1.5] },
    { hgt: 1, keys: [1.5, ...Array(13).fill(1)] },
    { hgt: 1, keys: [1.75, ...Array(11).fill(1), 1.75] },
    { hgt: 1, keys: [2.25, ...Array(10).fill(1), 2.25] },
    { hgt: 1, keys: [1, 1, 1, 1.25, 5, 1.25, 1, 1, 1, 1] },
  ];
  const unit = kw / 14.7;
  const count = rows.reduce((s, r) => s + r.keys.length, 0);
  const keyGeo = slabY(1, 1, 0.008, 0.12, { bevel: 0.003, cs: 4, bs: 2 });
  const keys = new THREE.InstancedMesh(keyGeo, Mat.matte('#141416', 0.55), count);
  const totalH = rows.reduce((s, r) => s + r.hgt, 0) * unit;
  const kd = totalH + unit * 0.4;
  const kz = -d / 2 + 0.16 + kd / 2;
  const well = new THREE.Mesh(planeRR(kw + unit * 0.4, kd, 0.03), Mat.matte('#0b0b0c', 0.9));
  well.rotation.x = -PI / 2;
  well.position.set(0, top + 0.0006, kz);
  root.add(well);
  let zc = kz - totalH / 2, i = 0;
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), ps = new THREE.Vector3();
  for (const row of rows) {
    const rowW = row.keys.reduce((s, k) => s + k, 0) * unit;
    let xc = -rowW / 2;
    for (const k of row.keys) {
      const kx = xc + (k * unit) / 2;
      ps.set(kx, top + 0.004, zc + (row.hgt * unit) / 2);
      sc.set(k * unit - unit * 0.16, 1, row.hgt * unit - unit * 0.16);
      m4.compose(ps, q, sc);
      keys.setMatrixAt(i++, m4);
      xc += k * unit;
    }
    zc += row.hgt * unit;
  }
  root.add(keys);

  const pad = new THREE.Mesh(planeRR(w * 0.4, d * 0.32, 0.035), Mat.satin(shade(hex, 0.02), 0.22));
  pad.rotation.x = -PI / 2;
  pad.position.set(0, top + 0.0007, (kz + kd / 2 + d / 2) / 2);
  root.add(pad);

  if (o.pro) {
    const grille = canvasTex(64, 512, (ctx, W, H) => {
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = '#000';
      for (let y = 6; y < H; y += 10) for (let x = 6; x < W; x += 10) { ctx.beginPath(); ctx.arc(x + ((y / 10) % 2) * 5, y, 2.4, 0, PI * 2); ctx.fill(); }
    });
    for (const sx of [-1, 1]) {
      const g = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.045, kd * 0.98), new THREE.MeshBasicMaterial({ map: grille, transparent: true, opacity: 0.75 }));
      g.rotation.x = -PI / 2;
      g.position.set(sx * (kw / 2 + w * 0.04), top + 0.0008, kz);
      root.add(g);
    }
  }

  // 屏幕盖
  const pivot = new THREE.Group();
  pivot.position.set(0, top, -d / 2 + 0.02);
  const lidMesh = new THREE.Mesh(slabY(w, d - 0.02, lt, 0.14, { bevel: lt * 0.4 }), [alu, alu]);
  lidMesh.position.set(0, lt / 2 + 0.012, (d - 0.02) / 2);
  pivot.add(lidMesh);
  const bezel = new THREE.Mesh(planeRR(w - 0.05, d - 0.07, 0.11), Mat.black(0.08));
  bezel.rotation.x = PI / 2;
  bezel.position.set(0, 0.0115, (d - 0.02) / 2);
  pivot.add(bezel);
  const sw = w - 0.13, sd = d - 0.2;
  const tex = macScreenTex(sd / sw, hex, o.notch);
  const scr = new THREE.Mesh(planeRR(sw, sd, o.notch ? 0.06 : 0.03, o.notch ? [0.06, 0.06, 0.005, 0.005] : null), Mat.screen(tex));
  scr.rotation.x = PI / 2;
  scr.position.set(0, 0.011, (d - 0.02) / 2 + 0.035);
  pivot.add(scr);
  root.add(pivot);

  // 铰链
  const hinge = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, w * 0.78, 24), Mat.satin(shade(hex, -0.15), 0.4));
  hinge.rotation.z = PI / 2;
  hinge.position.set(0, top - 0.005, -d / 2 + 0.03);
  root.add(hinge);

  // 侧面接口
  const portMat = Mat.matte('#0a0a0a', 0.6);
  for (let k = 0; k < (o.pro ? 3 : 2); k++) {
    const port = new THREE.Mesh(planeRR(0.085, t * 0.32, 0.014), portMat);
    port.rotation.y = -PI / 2;
    port.position.set(-w / 2 - 0.0008, 0, -d * 0.28 + k * 0.13);
    root.add(port);
  }

  let lid = 1, target = 1;
  const OPEN = (o.oled ? 112 : 108) * PI / 180;
  const api = finalize(root, {
    view: new THREE.Vector3(0.48, 0.42, 0.77),
    setColor(hx) { alu.color.set(hx); pad.material.color.set(shade(hx, 0.02)); hinge.material.color.set(shade(hx, -0.15)); },
    update(dt) {
      lid = damp(lid, target, dt, 3);
      pivot.rotation.x = -OPEN * lid;
      scr.material.emissiveIntensity = THREE.MathUtils.smoothstep(lid, 0.4, 0.9);
    },
  });
  api.actions = [{ label: '合上', on: false, run(on) { target = on ? 0 : 1; } }];
  return api;
}

/* ───────────────────────── iMac ───────────────────────── */

function buildIMac(p, hex) {
  const root = new THREE.Group();
  const W = 5.47, H = 4.1, D = 0.115, chin = 0.92;
  const backMat = Mat.satin(hex, 0.38);
  const chinMat = Mat.satin(shade(hex, 0.12, -0.05), 0.4);
  const panel = new THREE.Mesh(slab(W, H, D, 0.2, { bevel: 0.04 }), [backMat, backMat]);
  root.add(panel);
  const b = 0.04;
  const chinM = new THREE.Mesh(planeRR(W - 2 * b + 0.004, chin, 0, [0, 0, 0.16, 0.16]), chinMat);
  chinM.position.set(0, -H / 2 + b + chin / 2 - 0.002, D / 2 + 0.003);
  const topH = H - 2 * b - chin + 0.004;
  const bezel = new THREE.Mesh(planeRR(W - 2 * b + 0.004, topH, 0, [0.16, 0.16, 0, 0]), Mat.plastic('#ededeb', 0.25));
  bezel.position.set(0, H / 2 - b - topH / 2 + 0.002, D / 2 + 0.003);
  const sw = W - 0.34, sh = topH - 0.3;
  const tex = macScreenTex(sh / sw, hex, false);
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(sw, sh), Mat.screen(tex));
  scr.position.set(0, bezel.position.y, D / 2 + 0.007);
  root.add(chinM, bezel, scr);

  // 支架
  const sMat = Mat.satin(hex, 0.38);
  const len = 2.6, ang = 0.2;
  const leg = new THREE.Mesh(new THREE.BoxGeometry(1.45, len, 0.07), sMat);
  leg.position.set(0, -1.75, -0.42);
  leg.rotation.x = ang;
  const foot = new THREE.Mesh(slabY(1.45, 1.6, 0.07, 0.05, { bevel: 0.02 }), [sMat, sMat]);
  foot.position.set(0, -2.99, 0.05);
  root.add(leg, foot);

  return finalize(root, {
    view: new THREE.Vector3(0.42, 0.12, 0.9),
    setColor(hx) { backMat.color.set(hx); sMat.color.set(hx); chinMat.color.set(shade(hx, 0.12, -0.05)); },
  });
}

/* ───────────────────────── Mac mini / Studio ───────────────────────── */

function buildBox(p, hex, kind) {
  const root = new THREE.Group();
  const studio = kind === 'studio';
  const W = studio ? 1.97 : 1.27, Hh = studio ? 0.95 : 0.5, R = studio ? 0.3 : 0.24;
  const alu = Mat.satin(hex, 0.34);
  const body = new THREE.Mesh(slabY(W, W, Hh, R, { bevel: 0.05 }), [alu, alu]);
  root.add(body);
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(W * 0.36, W * 0.36, 0.03, 48), Mat.matte('#111', 0.7));
  foot.position.y = -Hh / 2 - 0.01;
  root.add(foot);

  const dark = Mat.matte('#050505', 0.5);
  const fz = W / 2 + 0.0008;
  const port = (x, y, w, h, r, z = fz, back = false) => {
    const m = new THREE.Mesh(planeRR(w, h, r), dark);
    m.position.set(x, y, back ? -z : z);
    if (back) m.rotation.y = PI;
    root.add(m);
  };
  if (studio) {
    port(-0.6, -0.1, 0.09, 0.035, 0.016); port(-0.45, -0.1, 0.09, 0.035, 0.016);
    port(0.45, -0.1, 0.24, 0.025, 0.01);
    for (let k = 0; k < 4; k++) port(-0.7 + k * 0.16, -0.2, 0.09, 0.035, 0.016, fz, true);
    port(0.2, -0.2, 0.13, 0.06, 0.01, fz, true); port(0.45, -0.2, 0.14, 0.07, 0.012, fz, true);
    // 背部散热孔
    const holes = new THREE.InstancedMesh(new THREE.CircleGeometry(0.011, 10), dark, 7 * 34);
    const m4 = new THREE.Matrix4(); let n = 0;
    for (let r = 0; r < 7; r++) for (let c = 0; c < 34; c++) {
      m4.makeRotationY(PI);
      m4.setPosition(-0.82 + c * 0.05 + (r % 2) * 0.025, 0.28 - r * 0.045, -fz);
      holes.setMatrixAt(n++, m4);
    }
    root.add(holes);
  } else {
    port(-0.35, 0, 0.075, 0.03, 0.014); port(-0.22, 0, 0.075, 0.03, 0.014);
    const jack = dot(0.017, dark); jack.position.set(0.3, 0, fz); root.add(jack);
    for (let k = 0; k < 3; k++) port(-0.4 + k * 0.13, 0, 0.075, 0.03, 0.014, fz, true);
    port(0.12, 0, 0.11, 0.045, 0.008, fz, true); port(0.32, 0, 0.1, 0.07, 0.01, fz, true);
  }
  const led = dot(0.008, new THREE.MeshBasicMaterial({ color: '#e8fff0' }));
  led.position.set(studio ? 0.85 : 0.52, studio ? -0.3 : -0.12, fz + 0.0002);
  root.add(led);

  return finalize(root, {
    view: new THREE.Vector3(0.55, 0.55, 0.65),
    setColor(hx) { alu.color.set(hx); },
  });
}

/* ───────────────────────── iPad ───────────────────────── */

function buildTablet(p, hex) {
  const o = p.model;
  const { w, h, d, r, bezel } = o;
  const root = new THREE.Group();
  const alu = Mat.satin(hex, 0.36);
  const b = d * 0.4;
  const body = new THREE.Mesh(slab(w, h, d, r, { bevel: b }), [alu, alu]);
  root.add(body);
  const front = new THREE.Mesh(planeRR(w - 2 * b + 0.004, h - 2 * b + 0.004, r - b), Mat.black(0.05));
  front.position.z = d / 2 + 0.0006;
  const sw = w - 2 * bezel, sh = h - 2 * bezel;
  const tex = tabletScreenTex(sh / sw, hex);
  const scr = new THREE.Mesh(planeRR(sw, sh, Math.max(r - bezel, 0.03)), Mat.screen(tex));
  scr.position.z = d / 2 + 0.0012;
  root.add(front, scr);

  const bz = -d / 2;
  const lr = w * 0.035;
  const cx = w / 2 - 0.12, cy = h / 2 - 0.12;
  if (o.cam === 'pro') {
    const mod = new THREE.Mesh(slab(0.2, 0.2, 0.014, 0.06, { bevel: 0.006 }), Mat.glass('#1a1a1c', 0.1));
    mod.position.set(cx - 0.03, cy - 0.03, bz - 0.004);
    root.add(mod);
    root.add(onBack(lens(lr * 1.15), cx - 0.065, cy + 0.005, bz - 0.012));
    root.add(onBack(dot(lr * 0.7, Mat.black(0.3)), cx - 0.065, cy - 0.065, bz - 0.0115));
    root.add(onBack(dot(lr * 0.4, new THREE.MeshPhysicalMaterial({ color: '#f3ecd6' })), cx + 0.005, cy - 0.065, bz - 0.0115));
  } else {
    root.add(onBack(lens(lr), cx, cy, bz - 0.006));
  }
  // 顶部按键与音量键
  const k1 = new THREE.Mesh(slab(0.16, 0.012, d * 0.36, 0.006, { bevel: 0.004 }), alu);
  k1.position.set(w / 2 - 0.3, h / 2 + 0.003, 0);
  const k2 = new THREE.Mesh(slab(0.012, 0.13, d * 0.36, 0.006, { bevel: 0.004 }), alu);
  k2.position.set(w / 2 + 0.003, h / 2 - 0.3, 0);
  root.add(k1, k2);

  // Apple Pencil
  const pencil = new THREE.Group();
  const pm = Mat.plastic('#f6f6f4', 0.3);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 1.5, 32), pm);
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.16, 32), pm);
  tip.position.y = -0.83;
  const nib = new THREE.Mesh(new THREE.SphereGeometry(0.01, 12, 8), Mat.plastic('#ddd', 0.5));
  nib.position.y = -0.91;
  pencil.add(shaft, tip, nib);
  pencil.position.set(w / 2 + 0.25, 0, 0.1);
  pencil.rotation.z = 0.08;
  pencil.visible = false;
  root.add(pencil);

  let pv = 0, pt = 0, t = 0;
  const api = finalize(root, {
    view: new THREE.Vector3(0.45, 0.15, 0.88),
    setColor(hx) { alu.color.set(hx); },
    update(dt) {
      t += dt;
      pv = damp(pv, pt, dt, 4);
      pencil.visible = pv > 0.01;
      pencil.scale.setScalar(Math.max(pv, 0.001));
      pencil.position.y = Math.sin(t * 1.6) * 0.03;
      pencil.position.x = w / 2 + 0.12 + pv * 0.13;
    },
  });
  api.actions = [{ label: 'Apple Pencil', on: false, run(on) { pt = on ? 1 : 0; } }];
  return api;
}

/* ───────────────────────── Apple Watch ───────────────────────── */

function buildWatch(p, hex) {
  const o = p.model;
  const s = o.size;
  const root = new THREE.Group();
  const ultra = o.ultra;
  const w = (ultra ? 0.44 : 0.4) * s, h = (ultra ? 0.49 : 0.48) * s, d = ultra ? 0.13 : 0.105;
  const caseMat = ultra ? Mat.satin(hex, 0.45) : Mat.metal(hex, 0.25);
  const body = new THREE.Mesh(slab(w, h, d, ultra ? 0.085 : w * 0.3, { bevel: ultra ? 0.03 : d * 0.46, bs: 8, cs: 18 }), [caseMat, caseMat]);
  root.add(body);

  const b = ultra ? 0.03 : d * 0.46;
  const glass = new THREE.Mesh(slab(w - (ultra ? 0.05 : 0.02), h - (ultra ? 0.05 : 0.02), 0.02, ultra ? 0.07 : w * 0.27, { bevel: ultra ? 0.004 : 0.009 }), Mat.black(0.03));
  glass.position.z = d / 2 - (ultra ? 0.0 : 0.004);
  root.add(glass);
  const sw = w - (ultra ? 0.09 : 0.06), sh = h - (ultra ? 0.09 : 0.06);
  const face = new THREE.Mesh(planeRR(sw, sh, ultra ? 0.05 : w * 0.22), Mat.screen(watchFaceTex(o.band)));
  face.position.z = d / 2 + 0.0105 - (ultra ? 0 : 0.004);
  root.add(face);

  // 数码表冠与侧键
  const crownMat = Mat.metal(shade(hex, -0.05), 0.3);
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.033 * s, 0.033 * s, 0.04, 40), crownMat);
  crown.rotation.z = PI / 2;
  crown.position.set(w / 2 + 0.016, h * 0.14, 0);
  root.add(crown);
  if (ultra) {
    const guard = new THREE.Mesh(slab(0.03, 0.2 * s, d * 0.7, 0.012, { bevel: 0.008 }), caseMat);
    guard.position.set(w / 2 + 0.008, h * 0.02, 0);
    root.add(guard);
    const act = new THREE.Mesh(slab(0.016, 0.12 * s, d * 0.4, 0.008, { bevel: 0.005 }), Mat.plastic('#ff6a1f', 0.35));
    act.position.set(-w / 2 - 0.004, h * 0.12, 0);
    root.add(act);
  }
  const side = new THREE.Mesh(slab(0.014, 0.1 * s, d * 0.36, 0.007, { bevel: 0.005 }), caseMat);
  side.position.set(w / 2 + 0.004, -h * 0.14, 0);
  root.add(side);
  // 背部传感器
  const sensor = new THREE.Mesh(new THREE.SphereGeometry(0.18 * s, 40, 16, 0, PI * 2, 0, 0.55), Mat.black(0.15));
  sensor.rotation.x = -PI / 2;
  sensor.scale.set(1, 0.18, 1);
  sensor.position.z = -d / 2 + 0.026;
  root.add(sensor);

  // 表带：包裹手腕的环
  const bandMat = new THREE.MeshStandardMaterial({ color: o.band, roughness: ultra ? 0.92 : 0.7, metalness: 0, side: THREE.DoubleSide });
  const pts = [];
  const A = 0.34 * s, B = 0.29, Cc = 0.25;
  for (let i = 0; i < 96; i++) {
    const a = (i / 96) * PI * 2;
    pts.push(new THREE.Vector2(A * Math.sin(a), -Cc + B * Math.cos(a)));
  }
  const band = new THREE.Mesh(ribbon(pts, w * 0.82, 0.03, (y, z, x) => new THREE.Vector3(x, y, z)), bandMat);
  root.add(band);

  return finalize(root, {
    view: new THREE.Vector3(0.45, 0.2, 0.87),
    setColor(hx) { caseMat.color.set(hx); crownMat.color.set(shade(hx, -0.05)); },
  });
}

/* ───────────────────────── AirPods ───────────────────────── */

function buildAirPods(p, hex) {
  const pro = p.model.pro;
  const root = new THREE.Group();
  const W = pro ? 0.606 : 0.5, H = pro ? 0.45 : 0.462, D = 0.215;
  const R = pro ? 0.15 : 0.17;
  const white = Mat.plastic(hex, 0.32);
  const inner = new THREE.MeshStandardMaterial({ color: '#d9d9d6', roughness: 0.6, side: THREE.BackSide });
  const split = H / 2 - H * 0.3;
  const geo = slab(W, H, D, R, { bevel: D * 0.46, bs: 8, cs: 20 });

  const planeBody = new THREE.Plane(new THREE.Vector3(0, -1, 0), split);
  const planeLid = new THREE.Plane(new THREE.Vector3(0, 1, 0), -split);
  const wBody = planeBody.clone(), wLid = planeLid.clone();
  const mats = [white.clone(), inner.clone(), white.clone(), inner.clone()];
  mats[0].clippingPlanes = mats[1].clippingPlanes = [wBody];
  mats[2].clippingPlanes = mats[3].clippingPlanes = [wLid];

  const body = new THREE.Mesh(geo, mats[0]);
  const bodyIn = new THREE.Mesh(geo, mats[1]);
  root.add(body, bodyIn);

  const floor = new THREE.Mesh(planeRR(W - 0.07, D - 0.06, 0.08), new THREE.MeshStandardMaterial({
    roughness: 0.7,
    map: canvasTex(512, 200, (ctx, cw, ch) => {
      ctx.fillStyle = '#e4e4e1'; ctx.fillRect(0, 0, cw, ch);
      for (const x of [0.3, 0.7]) {
        const g = ctx.createRadialGradient(cw * x, ch / 2, 2, cw * x, ch / 2, ch * 0.42);
        g.addColorStop(0, '#6b6b6b'); g.addColorStop(0.6, '#a6a6a4'); g.addColorStop(1, '#e4e4e1');
        ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(cw * x, ch / 2, ch * 0.4, ch * 0.34, 0, 0, PI * 2); ctx.fill();
      }
    }),
  }));
  floor.rotation.x = -PI / 2;
  floor.position.y = split - 0.004;
  root.add(floor);

  const pivot = new THREE.Group();
  pivot.position.set(0, split, -D / 2 + 0.03);
  const lid = new THREE.Mesh(geo, mats[2]);
  const lidIn = new THREE.Mesh(geo, mats[3]);
  lid.position.set(0, -split, D / 2 - 0.03);
  lidIn.position.copy(lid.position);
  pivot.add(lid, lidIn);
  root.add(pivot);

  // 指示灯
  const led = dot(0.008, new THREE.MeshBasicMaterial({ color: '#9dff9d' }));
  led.position.set(0, split - 0.07, D / 2 + 0.0005);
  root.add(led);
  if (pro) {
    const loop = new THREE.Mesh(new THREE.TorusGeometry(0.025, 0.006, 8, 24), Mat.metal('#bfc0c4', 0.3));
    loop.rotation.y = PI / 2;
    loop.position.set(W / 2 + 0.006, -H * 0.3, 0);
    root.add(loop);
  }

  // 耳机
  function bud(side) {
    const g = new THREE.Group();
    const m = Mat.plastic('#f7f7f5', 0.25);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.075, 32, 24), m);
    head.scale.set(1, 0.92, 1.12);
    const stemLen = pro ? 0.13 : 0.18;
    const stem = new THREE.Mesh(new THREE.CapsuleGeometry(0.024, stemLen, 8, 16), m);
    stem.position.set(0, -stemLen / 2 - 0.04, 0.025);
    stem.rotation.x = -0.12;
    g.add(head, stem);
    const grill = dot(0.03, Mat.matte('#2a2a2a', 0.8), 24);
    grill.position.set(side * 0.06, 0.005, 0.03);
    grill.rotation.y = side * 1.0;
    g.add(grill);
    if (pro) {
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.05, 24, 16), new THREE.MeshPhysicalMaterial({ color: '#ececea', roughness: 0.55, transmission: 0.15, thickness: 0.05 }));
      tip.scale.set(0.8, 1, 1);
      tip.position.set(side * 0.065, 0.01, 0.01);
      g.add(tip);
    }
    const tipCap = dot(0.016, Mat.metal('#c9cacd', 0.3), 20);
    tipCap.rotation.x = PI / 2;
    tipCap.position.set(0, -stemLen - 0.065, 0.028);
    g.add(tipCap);
    return g;
  }
  const buds = [bud(-1), bud(1)];
  buds.forEach((b2, k) => { root.add(b2); b2.userData.x = (k ? 1 : -1) * W * 0.2; });

  let open = 0, target = 0, t = 0;
  const api = finalize(root, {
    view: new THREE.Vector3(0.42, 0.38, 0.82),
    setColor() {},
    update(dt) {
      t += dt;
      open = damp(open, target, dt, 3.2);
      pivot.rotation.x = -open * 1.85;
      root.updateWorldMatrix(true, true);
      wBody.copy(planeBody).applyMatrix4(root.matrixWorld);
      wLid.copy(planeLid).applyMatrix4(lid.matrixWorld);
      const lift = THREE.MathUtils.smoothstep(open, 0.5, 1);
      buds.forEach((b2, k) => {
        const sd = k ? 1 : -1;
        b2.position.set(b2.userData.x + sd * lift * 0.12, split + 0.03 + lift * (0.34 + Math.sin(t * 1.5 + k) * 0.015), lift * 0.06);
        b2.rotation.set(lift * 0.15, sd * (0.3 + lift * 0.5), sd * lift * 0.25);
      });
    },
  });
  api.actions = [{ label: '打开充电盒', on: false, run(on) { target = on ? 1 : 0; } }];
  api.thumb = () => { open = target = 1; api.update(0); };
  return api;
}

/* ───────────────────────── AirPods Max ───────────────────────── */

function buildHeadphones(p, hex) {
  const root = new THREE.Group();
  const alu = Mat.satin(hex, 0.38);
  const fabric = new THREE.MeshStandardMaterial({ color: shade(hex, 0.1, -0.1), roughness: 0.95 });
  const steel = Mat.metal('#c7c8cc', 0.18);
  const cups = [];
  for (const s of [-1, 1]) {
    const g = new THREE.Group();
    const cup = new THREE.Mesh(slab(0.62, 0.74, 0.2, 0.2, { bevel: 0.06, bs: 6 }), [alu, alu]);
    const cushion = new THREE.Mesh(slab(0.58, 0.7, 0.13, 0.19, { bevel: 0.05, bs: 6 }), [fabric, fabric]);
    cushion.position.z = -0.15;
    g.add(cup, cushion);
    g.rotation.y = s * PI / 2;
    g.position.set(s * 0.82, 0, 0);
    cups.push(g);
    root.add(g);
    // 伸缩臂
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.32, 12), steel);
    arm.position.set(s * 0.82, 0.48, 0);
    root.add(arm);
    const yoke = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.014, 8, 20, PI), steel);
    yoke.position.set(s * 0.82, 0.38, 0);
    yoke.rotation.y = PI / 2;
    root.add(yoke);
  }
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.05, 32), alu);
  crown.position.set(0.86, 0.33, 0.15);
  root.add(crown);

  const arc = (rad, n = 64) => {
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * PI;
      pts.push(new THREE.Vector2(rad * Math.cos(a), 0.62 + rad * Math.sin(a) * 0.9));
    }
    return pts;
  };
  const canopy = new THREE.Mesh(ribbon(arc(0.8), 0.24, 0.025, (x, y, z) => new THREE.Vector3(x, y, z), false), new THREE.MeshStandardMaterial({ color: shade(hex, 0.06, -0.1), roughness: 0.9, side: THREE.DoubleSide }));
  root.add(canopy);
  for (const z of [-0.12, 0.12]) {
    const curve = new THREE.CatmullRomCurve3(arc(0.84, 48).map((v) => new THREE.Vector3(v.x, v.y, z)));
    const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 96, 0.014, 10), steel);
    root.add(tube);
  }

  return finalize(root, {
    view: new THREE.Vector3(0.55, 0.2, 0.8),
    setColor(hx) {
      alu.color.set(hx); fabric.color.set(shade(hx, 0.1, -0.1)); canopy.material.color.set(shade(hx, 0.06, -0.1));
    },
  });
}

/* ───────────────────────── Vision Pro ───────────────────────── */

function goggleShape(W, H, R) {
  const s = new THREE.Shape();
  const nb = H * 0.26;
  s.moveTo(-W / 2 + R, H / 2);
  s.lineTo(W / 2 - R, H / 2);
  s.bezierCurveTo(W / 2 - R * 0.3, H / 2, W / 2, H / 2 - R * 0.3, W / 2, H / 2 - R);
  s.lineTo(W / 2, -H / 2 + R);
  s.bezierCurveTo(W / 2, -H / 2 + R * 0.3, W / 2 - R * 0.3, -H / 2, W / 2 - R, -H / 2);
  s.lineTo(W * 0.17, -H / 2);
  s.bezierCurveTo(W * 0.1, -H / 2, W * 0.08, -H / 2 + nb, 0, -H / 2 + nb);
  s.bezierCurveTo(-W * 0.08, -H / 2 + nb, -W * 0.1, -H / 2, -W * 0.17, -H / 2);
  s.lineTo(-W / 2 + R, -H / 2);
  s.bezierCurveTo(-W / 2 + R * 0.3, -H / 2, -W / 2, -H / 2 + R * 0.3, -W / 2, -H / 2 + R);
  s.lineTo(-W / 2, H / 2 - R);
  s.bezierCurveTo(-W / 2, H / 2 - R * 0.3, -W / 2 + R * 0.3, H / 2, -W / 2 + R, H / 2);
  return s;
}

function bend(g, R, Rv = 0) {
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const a = x / R;
    let nx = (R + z) * Math.sin(a), nz = (R + z) * Math.cos(a) - R;
    if (Rv) nz -= (y * y) / (2 * Rv);
    p.setXYZ(i, nx, y, nz);
  }
  p.needsUpdate = true;
  g.computeVertexNormals();
  return toCreasedNormals(g, 0.7);
}
function bendPoint(x, y, z, R, Rv = 0) {
  const a = x / R;
  return new THREE.Vector3((R + z) * Math.sin(a), y, (R + z) * Math.cos(a) - R - (Rv ? (y * y) / (2 * Rv) : 0));
}

function buildVision(p, hex) {
  const root = new THREE.Group();
  const W = 1.55, H = 0.9, R = 0.34, BR = 1.05, RV = 2.6;
  const alu = Mat.satin(hex, 0.3);
  const ext = (shape, depth, bev) => {
    const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelSegments: 6, curveSegments: 32 });
    g.translate(0, 0, -depth / 2);
    return g;
  };
  // 铝框
  const frameGeo = bend(ext(goggleShape(W - 0.06, H - 0.06, R), 0.16, 0.03), BR, RV);
  const frame = new THREE.Mesh(frameGeo, [alu, alu]);
  root.add(frame);
  // 前玻璃
  // 用细分平面 + 轮廓遮罩做曲面玻璃，保证弯曲后表面平滑
  const GW = W - 0.1, GH = H - 0.1;
  const mask = canvasTex(512, Math.round(512 * GH / GW), (ctx, cw, ch) => {
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, cw, ch);
    ctx.save(); ctx.translate(cw / 2, ch / 2); ctx.scale(cw / GW, -ch / GH);
    const pts = goggleShape(GW, GH, R - 0.02).getPoints(48);
    ctx.beginPath(); pts.forEach((pt, i) => (i ? ctx.lineTo(pt.x, pt.y) : ctx.moveTo(pt.x, pt.y)));
    ctx.closePath(); ctx.fillStyle = '#fff'; ctx.fill(); ctx.restore();
  }, { linear: true });
  const glow = canvasTex(512, 256, (ctx, cw, ch) => {
    blobs(ctx, cw, ch, '#000', [[0.3, 0.55, 0.32, '#3a2a8c', 0.55], [0.7, 0.5, 0.32, '#1d5fa8', 0.5], [0.5, 0.45, 0.2, '#6b2fa0', 0.35]]);
  });
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x020203, metalness: 0, roughness: 0.04, clearcoat: 1, clearcoatRoughness: 0.02,
    emissive: 0xffffff, emissiveMap: glow, emissiveIntensity: 0.9,
    iridescence: 0.35, iridescenceIOR: 1.3, alphaMap: mask, alphaTest: 0.5,
  });
  const glassGeo = new THREE.PlaneGeometry(GW, GH, 96, 48).translate(0, 0, 0.125);
  const glass = new THREE.Mesh(bend(glassGeo, BR, RV), glassMat);
  root.add(glass);
  // 遮光罩
  const sealMat = new THREE.MeshStandardMaterial({ color: '#7d7e83', roughness: 0.95 });
  const sealGeo = bend(ext(goggleShape(W - 0.2, H - 0.16, R - 0.04), 0.2, 0.06).translate(0, 0, -0.2), BR, RV);
  const seal = new THREE.Mesh(sealGeo, sealMat);
  root.add(seal);

  // 音频带与头带
  const side = bendPoint(W / 2 - 0.08, 0, -0.06, BR, RV);
  const strapMat = Mat.matte('#d8d8da', 0.6);
  for (const s of [-1, 1]) {
    const strap = new THREE.Mesh(slab(0.32, 0.12, 0.05, 0.05, { bevel: 0.02 }), [strapMat, strapMat]);
    strap.rotation.y = s * PI / 2 - s * 0.25;
    strap.position.set(s * (side.x + 0.04), 0.02, side.z - 0.18);
    root.add(strap);
  }
  const knit = canvasTex(64, 512, (ctx, cw, ch) => {
    ctx.fillStyle = '#8a8b90'; ctx.fillRect(0, 0, cw, ch);
    for (let y = 0; y < ch; y += 6) { ctx.fillStyle = y % 12 ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.18)'; ctx.fillRect(0, y, cw, 3); }
  }, { repeat: [1, 8] });
  const bandPts = [];
  for (let i = 0; i <= 80; i++) {
    const a = 0.55 - (i / 80) * (PI + 1.1);
    bandPts.push(new THREE.Vector2(0.82 * Math.cos(a), -1.0 + 0.95 * Math.sin(a)));
  }
  const bandMat = new THREE.MeshStandardMaterial({ color: '#a0a1a6', roughness: 0.95, map: knit, side: THREE.DoubleSide });
  const band = new THREE.Mesh(ribbon(bandPts, 0.3, 0.05, (x, z, y) => new THREE.Vector3(x, y, z), false), bandMat);
  root.add(band);
  // 数码表冠与顶部按钮
  const cpos = bendPoint(W * 0.36, H / 2 - 0.05, -0.02, BR, RV);
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.05, 32), alu);
  crown.position.set(cpos.x, cpos.y + 0.02, cpos.z);
  const bpos = bendPoint(-W * 0.36, H / 2 - 0.05, -0.02, BR, RV);
  const topBtn = new THREE.Mesh(slab(0.16, 0.05, 0.04, 0.02, { bevel: 0.01 }), alu);
  topBtn.rotation.x = PI / 2;
  topBtn.position.set(bpos.x, bpos.y + 0.012, bpos.z);
  root.add(crown, topBtn);

  return finalize(root, {
    view: new THREE.Vector3(0.6, 0.2, 0.78),
    setColor(hx) { alu.color.set(hx); },
  });
}

/* ───────────────────────── 家居 ───────────────────────── */

function fabricTex(hex) {
  return canvasTex(256, 256, (ctx, W, H) => {
    ctx.fillStyle = hex; ctx.fillRect(0, 0, W, H);
    for (let y = 0; y < H; y += 8) for (let x = 0; x < W; x += 8) {
      ctx.fillStyle = 'rgba(0,0,0,0.16)';
      ctx.fillRect(x + ((y / 8) % 2) * 4, y, 4, 4);
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.fillRect(x + 4 - ((y / 8) % 2) * 4, y + 4, 4, 4);
    }
  }, { repeat: [24, 10] });
}

function siriTex() {
  return canvasTex(512, 512, (ctx, W, H) => {
    ctx.fillStyle = '#050507'; ctx.fillRect(0, 0, W, H);
    blobs(ctx, W, H, 'rgba(0,0,0,0)', [[0.42, 0.45, 0.28, '#ff3d8b', 0.9], [0.6, 0.5, 0.26, '#3d7bff', 0.9], [0.5, 0.62, 0.22, '#25e0c5', 0.8]]);
    const g = ctx.createRadialGradient(W / 2, H / 2, W * 0.36, W / 2, H / 2, W * 0.5);
    g.addColorStop(0, 'rgba(5,5,7,0)'); g.addColorStop(1, 'rgba(5,5,7,1)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  });
}

function buildHomePod(p, hex) {
  const mini = p.model.mini;
  const root = new THREE.Group();
  const pts = [];
  let topY, topR;
  if (mini) {
    const R = 0.49, a0 = -PI / 2 + 0.5, a1 = PI / 2 - 0.72;
    pts.push(new THREE.Vector2(0.001, R * Math.sin(a0)));
    for (let i = 0; i <= 48; i++) {
      const a = a0 + (i / 48) * (a1 - a0);
      pts.push(new THREE.Vector2(R * Math.cos(a), R * Math.sin(a)));
    }
    topY = R * Math.sin(a1); topR = R * Math.cos(a1);
    pts.push(new THREE.Vector2(0.001, topY));
  } else {
    const R = 0.71, Hh = 1.68, c = 0.26;
    pts.push(new THREE.Vector2(0.001, -Hh / 2));
    for (let i = 0; i <= 16; i++) { const a = -PI / 2 + (i / 16) * (PI / 2); pts.push(new THREE.Vector2(R - c + c * Math.cos(a), -Hh / 2 + c + c * Math.sin(a))); }
    for (let i = 0; i <= 16; i++) { const a = (i / 16) * (PI / 2); pts.push(new THREE.Vector2(R - c + c * Math.cos(a), Hh / 2 - c + c * Math.sin(a))); }
    topY = Hh / 2 - 0.005; topR = R - c;
    pts.push(new THREE.Vector2(0.001, topY));
  }
  const tex = fabricTex('#ffffff');
  const mat = new THREE.MeshStandardMaterial({ color: hex, roughness: 0.96, map: tex, bumpMap: tex, bumpScale: 0.6 });
  const body = new THREE.Mesh(new THREE.LatheGeometry(pts, 96), mat);
  root.add(body);
  const top = new THREE.Mesh(new THREE.CircleGeometry(topR * (mini ? 0.82 : 0.86), 64), Mat.screen(siriTex(), 1));
  top.material.color.set('#000');
  top.rotation.x = -PI / 2;
  top.position.y = topY + 0.003;
  root.add(top);
  const sym = canvasTex(256, 256, (ctx, W) => {
    ctx.clearRect(0, 0, W, W);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillRect(W * 0.18, W * 0.49, W * 0.1, W * 0.025);
    ctx.fillRect(W * 0.72, W * 0.49, W * 0.1, W * 0.025);
    ctx.fillRect(W * 0.7575, W * 0.4525, W * 0.025, W * 0.1);
  });
  const symM = new THREE.Mesh(new THREE.CircleGeometry(topR * 0.86, 48), new THREE.MeshBasicMaterial({ map: sym, transparent: true }));
  symM.rotation.x = -PI / 2;
  symM.position.y = topY + 0.005;
  root.add(symM);

  return finalize(root, {
    view: new THREE.Vector3(0.3, 0.4, 0.87),
    setColor(hx) { mat.color.set(hx); },
  });
}

function buildAppleTV(p, hex) {
  const root = new THREE.Group();
  const gloss = Mat.black(0.08);
  const matte = Mat.matte(hex, 0.55);
  const box = new THREE.Mesh(slabY(0.93, 0.93, 0.31, 0.2, { bevel: 0.03 }), [gloss, matte]);
  root.add(box);
  // Siri 遥控器
  const remote = new THREE.Group();
  const rm = Mat.satin('#c9cacd', 0.32);
  const rb = new THREE.Mesh(slabY(0.36, 1.36, 0.09, 0.12, { bevel: 0.03 }), [rm, rm]);
  remote.add(rb);
  const pad = new THREE.Mesh(new THREE.CircleGeometry(0.14, 48), Mat.black(0.2));
  pad.rotation.x = -PI / 2; pad.position.set(0, 0.0455, -0.38);
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.14, 0.152, 48), Mat.satin('#9fa0a4', 0.3));
  ring.rotation.x = -PI / 2; ring.position.set(0, 0.0458, -0.38);
  remote.add(pad, ring);
  [[-0.08, -0.1], [0.08, -0.1], [-0.08, 0.06], [0.08, 0.06], [0.08, 0.2]].forEach(([x, z]) => {
    const b = new THREE.Mesh(new THREE.CircleGeometry(0.045, 32), Mat.black(0.2));
    b.rotation.x = -PI / 2; b.position.set(x, 0.0456, z);
    remote.add(b);
  });
  remote.position.set(0.85, -0.11, 0.25);
  remote.rotation.y = -0.35;
  root.add(remote);
  return finalize(root, {
    view: new THREE.Vector3(0.45, 0.6, 0.66),
    setColor() {},
  });
}

function buildHomeView(p, hex) {
  const root = new THREE.Group();
  const shell = Mat.plastic(hex, 0.3);
  const baseTex = fabricTex('#ffffff');
  baseTex.repeat.set(16, 4);
  const baseMat = new THREE.MeshStandardMaterial({ color: hex, roughness: 0.95, map: baseTex, bumpMap: baseTex, bumpScale: 0.5 });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.45, 0.34, 72), baseMat);
  base.position.y = -0.62;
  root.add(base);
  const capTop = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.02, 72), shell);
  capTop.position.y = -0.44;
  root.add(capTop);
  const neck = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.36, 0.06), shell);
  neck.position.set(0, -0.28, -0.08);
  neck.rotation.x = -0.18;
  root.add(neck);
  const g = new THREE.Group();
  const panel = new THREE.Mesh(slab(1.25, 1.0, 0.07, 0.1, { bevel: 0.025 }), [shell, shell]);
  g.add(panel);
  const front = new THREE.Mesh(planeRR(1.205, 0.955, 0.08), Mat.black(0.05));
  front.position.z = 0.0356;
  const tex = canvasTex(1024, Math.round(1024 * 0.88 / 1.13), (ctx, W, H) => {
    blobs(ctx, W, H, '#07080c', [[0.1, 0.2, 0.6, '#ff8a3d', 0.55], [0.9, 0.8, 0.6, '#5a6bff', 0.6]]);
    ctx.fillStyle = '#fff';
    ctx.font = `600 ${W * 0.16}px ${FONT}`;
    ctx.fillText('10:24', W * 0.06, H * 0.32);
    ctx.font = `500 ${W * 0.032}px ${FONT}`;
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillText('11月19日 星期四 · 多云 23°', W * 0.065, H * 0.42);
    const tiles = [['客厅灯光', '已开 · 60%', '#ffcf5a'], ['空调', '制冷 24°', '#5ad1ff'], ['前门', '已上锁', '#7dff9a'], ['窗帘', '已打开', '#ff9bd2']];
    tiles.forEach(([t1, t2, col], i) => {
      const x = W * 0.06 + (i % 2) * W * 0.22, y = H * 0.52 + Math.floor(i / 2) * H * 0.22;
      ctx.fillStyle = 'rgba(255,255,255,0.14)'; ctxRR(ctx, x, y, W * 0.2, H * 0.19, 18); ctx.fill();
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x + 32, y + 34, 13, 0, PI * 2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = `600 ${W * 0.024}px ${FONT}`; ctx.fillText(t1, x + 20, y + H * 0.12);
      ctx.fillStyle = 'rgba(255,255,255,0.65)'; ctx.font = `500 ${W * 0.019}px ${FONT}`; ctx.fillText(t2, x + 20, y + H * 0.165);
    });
    ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctxRR(ctx, W * 0.53, H * 0.52, W * 0.41, H * 0.41, 22); ctx.fill();
    const gr = ctx.createLinearGradient(W * 0.55, H * 0.55, W * 0.92, H * 0.9);
    gr.addColorStop(0, '#ff6a88'); gr.addColorStop(1, '#ffb36a');
    ctx.fillStyle = gr; ctxRR(ctx, W * 0.55, H * 0.55, W * 0.13, W * 0.13, 14); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = `600 ${W * 0.026}px ${FONT}`; ctx.fillText('正在播放', W * 0.71, H * 0.6);
    ctx.fillStyle = 'rgba(255,255,255,0.65)'; ctx.font = `500 ${W * 0.02}px ${FONT}`; ctx.fillText('客厅 · HomePod', W * 0.71, H * 0.65);
    ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctxRR(ctx, W * 0.55, H * 0.84, W * 0.37, 6, 3); ctx.fill();
    ctx.fillStyle = '#fff'; ctxRR(ctx, W * 0.55, H * 0.84, W * 0.15, 6, 3); ctx.fill();
  });
  const scr = new THREE.Mesh(planeRR(1.13, 0.88, 0.05), Mat.screen(tex));
  scr.position.z = 0.0362;
  g.add(front, scr);
  g.position.set(0, 0.12, 0);
  g.rotation.x = -0.14;
  root.add(g);
  return finalize(root, {
    view: new THREE.Vector3(0.4, 0.2, 0.9),
    setColor(hx) { shell.color.set(hx); baseMat.color.set(hx); },
  });
}

/* ───────────────────────── 入口 ───────────────────────── */

export function buildModel(product, hex) {
  const color = hex || product.colors[0].hex;
  const t = product.model.type;
  switch (t) {
    case 'phone': return buildPhone(product, color);
    case 'foldable': return buildFoldable(product, color);
    case 'laptop': return buildLaptop(product, color);
    case 'imac': return buildIMac(product, color);
    case 'mini': return buildBox(product, color, 'mini');
    case 'studio': return buildBox(product, color, 'studio');
    case 'tablet': return buildTablet(product, color);
    case 'watch': return buildWatch(product, color);
    case 'airpods': return buildAirPods(product, color);
    case 'headphones': return buildHeadphones(product, color);
    case 'vision': return buildVision(product, color);
    case 'homepod': return buildHomePod(product, color);
    case 'appletv': return buildAppleTV(product, color);
    case 'homeview': return buildHomeView(product, color);
    default: throw new Error('未知模型类型 ' + t);
  }
}
