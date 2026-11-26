// 全站共用的 3D 舞台：一个 WebGL 画布，在首页、章节与评测页之间移动。
import * as THREE from '../vendor/three/three.module.min.js';
import { GLTFLoader } from '../vendor/three/GLTFLoader.js';
import { OrbitControls } from '../vendor/three/OrbitControls.js';
import { RoomEnvironment } from '../vendor/three/RoomEnvironment.js';
import { MeshoptDecoder } from '../vendor/three/meshopt_decoder.module.js';
import { MODELS } from './models3d.js';

const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const cache = new Map();
const MAX_CACHE = 7;
function load(url) {
  if (cache.has(url)) {
    const v = cache.get(url);
    cache.delete(url);
    cache.set(url, v); // LRU
    return v.p;
  }
  const entry = { p: new Promise((res, rej) => loader.load(url, res, undefined, rej)) };
  cache.set(url, entry);
  if (cache.size > MAX_CACHE) {
    const [oldUrl, old] = cache.entries().next().value;
    cache.delete(oldUrl);
    old.p.then((g) => { if (!g.__inUse) disposeGLTF(g); }).catch(() => {});
  }
  return entry.p;
}
function disposeGLTF(g) {
  g.scene.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
    ms.forEach((m) => { Object.keys(m).forEach((k) => { if (m[k] && m[k].isTexture) m[k].dispose(); }); m.dispose(); });
  });
}
export function preload(id, pose) {
  const m = MODELS[id];
  if (!m) return Promise.resolve();
  const url = m.poses[pose || m.pose || 'default'] || Object.values(m.poses)[0];
  return load(url).catch(() => {});
}

const ease = (t) => 1 - Math.pow(1 - t, 3);
const lerp = (a, b, t) => a + (b - a) * t;

let shadowTex = null;
function shadowTexture() {
  if (shadowTex) return shadowTex;
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, 'rgba(0,0,0,0.7)');
  g.addColorStop(0.5, 'rgba(0,0,0,0.25)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  shadowTex = new THREE.CanvasTexture(c);
  return shadowTex;
}

export class Stage {
  constructor() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance', preserveDrawingBuffer: false });
    this.renderer.setPixelRatio(dpr);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setClearColor(0x000000, 0);
    this.canvas = this.renderer.domElement;
    this.canvas.className = 'stage-canvas';
    this.scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    const key = new THREE.DirectionalLight(0xffffff, 1.4);
    key.position.set(2, 4, 3);
    const rim = new THREE.DirectionalLight(0xb9c8ff, 1.2);
    rim.position.set(-3, 1.5, -2);
    this.scene.add(key, rim, new THREE.HemisphereLight(0xffffff, 0x101014, 0.3));
    this.camera = new THREE.PerspectiveCamera(26, 1, 0.05, 50);
    this.holder = new THREE.Group(); // 承载当前模型，负责“滚动驱动”的旋转
    this.scene.add(this.holder);
    this.controls = new OrbitControls(this.camera, this.canvas);
    Object.assign(this.controls, { enableDamping: true, dampingFactor: 0.08, enablePan: false, rotateSpeed: 0.75, zoomSpeed: 0.7, minDistance: 2.2, maxDistance: 9, enabled: false });
    this.controls.addEventListener('start', () => { this.userTouched = true; this.onInteract && this.onInteract(); this.wake(); });
    this.controls.addEventListener('change', () => this.wake());
    this.applyTouch();
    this.yaw = 0; this.pitch = 0.15; this.tYaw = 0; this.tPitch = 0.15;
    this.zoom = 1; this.tZoom = 1;
    this.shift = [0, 0]; this.tShift = [0, 0];
    this.mode = 'scroll';
    this.token = 0;
    this.current = null; // { id, pose, ci, obj, gltf }
    this.anim = null;
    this.visible = false;
    this.awakeUntil = 0;
    this.clock = new THREE.Clock();
    this.ro = new ResizeObserver(() => { this.resize(); this.wake(); });
    this.io = new IntersectionObserver((ents) => { this.visible = ents[0].isIntersecting; if (this.visible) this.wake(); });
    this.io.observe(this.canvas);
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }

  mount(host) {
    if (this.host === host) return;
    if (this.host) this.ro.unobserve(this.host);
    this.host = host;
    host.appendChild(this.canvas);
    this.ro.observe(host);
    this.resize();
    this.wake();
  }

  resize() {
    if (!this.host) return;
    const w = this.host.clientWidth, h = this.host.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.placeCamera();
  }

  distance() {
    const v = THREE.MathUtils.degToRad(this.camera.fov);
    const hfov = 2 * Math.atan(Math.tan(v / 2) * this.camera.aspect);
    return (1 / Math.sin(Math.min(v, hfov) / 2)) * (this.fit || 1.08);
  }

  placeCamera() {
    if (this.mode === 'free') return;
    const d = this.distance() * this.zoom;
    this.camera.position.set(0, Math.sin(this.pitch) * d, Math.cos(this.pitch) * d);
    this.camera.lookAt(0, 0, 0);
  }

  wake(ms = 1200) { this.awakeUntil = Math.max(this.awakeUntil, performance.now() + ms); }

  // 滚动模式下画布不拦截触摸，保证 iPad 上可以正常滚动页面
  applyTouch() {
    const free = this.mode === 'free';
    this.canvas.style.touchAction = free ? 'none' : 'pan-y';
    this.canvas.style.pointerEvents = free ? 'auto' : 'none';
  }

  setMode(mode) {
    this.mode = mode;
    this.controls.enabled = mode === 'free';
    this.applyTouch();
    if (mode === 'free') {
      this.shift = [0, 0]; this.tShift = [0, 0]; this.camera.clearViewOffset();
      // 把当前的模型旋转转换为相机位置，切换时画面不跳
      const d = this.distance();
      const yaw = this.yaw;
      this.holder.rotation.set(0, 0, 0);
      this.camera.position.set(Math.sin(-yaw) * Math.cos(this.pitch) * d, Math.sin(this.pitch) * d, Math.cos(-yaw) * Math.cos(this.pitch) * d);
      this.controls.target.set(0, 0, 0);
      this.controls.update();
    } else {
      this.placeCamera();
    }
    this.wake();
  }

  // 滚动驱动：设置目标角度（带阻尼）
  setAngles(yaw, pitch, instant) {
    this.tYaw = yaw;
    if (pitch != null) this.tPitch = pitch;
    if (instant) { this.yaw = yaw; if (pitch != null) this.pitch = pitch; }
    this.wake();
  }
  setZoom(z) { this.tZoom = z; this.wake(); }
  // 画面偏移（占宽 / 高的比例），用于给文字留出空间
  setShift(x, y, instant) { this.tShift = [x, y]; if (instant) this.shift = [x, y]; this.wake(); }
  applyShift() {
    const w = this.renderer.domElement.width, h = this.renderer.domElement.height;
    const [x, y] = this.shift;
    if (Math.abs(x) < 0.0005 && Math.abs(y) < 0.0005) { if (this.camera.view) { this.camera.clearViewOffset(); } return; }
    this.camera.setViewOffset(w, h, -x * w, y * h, w, h);
  }

  async show(id, opts = {}) {
    const m = MODELS[id];
    if (!m) return false;
    const pose = opts.pose || m.pose || 'default';
    const ci = opts.ci == null ? 0 : opts.ci;
    if (this.current && this.current.id === id && this.current.pose === pose) {
      if (m.variants && ci !== this.current.ci) await this.setVariant(ci);
      return true;
    }
    const my = ++this.token;
    this.onLoading && this.onLoading(true);
    let gltf;
    try { gltf = await load(m.poses[pose]); } catch (e) { this.onLoading && this.onLoading(false); return false; }
    if (my !== this.token) return false;
    const obj = gltf.scene.clone(true);
    if (m.group) {
      obj.traverse((o) => {
        if (!o.isMesh) return;
        const path = (o.userData && o.userData.path) || (o.parent && o.parent.userData && o.parent.userData.path) || '';
        o.visible = path.indexOf(m.group) >= 0;
      });
    }
    const pivot = new THREE.Group();
    pivot.add(obj);
    // 只按可见网格计算包围盒，归一化到半径 1
    obj.updateMatrixWorld(true);
    const box = new THREE.Box3();
    obj.traverse((o) => {
      if (!o.isMesh || !o.visible) return;
      const mat = o.material;
      if (mat && mat.transparent && mat.opacity < 0.05) return;
      o.geometry.computeBoundingBox();
      box.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld));
    });
    const c = box.getCenter(new THREE.Vector3());
    const r = box.getSize(new THREE.Vector3()).length() / 2 || 1;
    obj.position.sub(c);
    pivot.scale.setScalar(1 / r);
    const sz = box.getSize(new THREE.Vector3()).multiplyScalar(1 / r);
    const sh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false, opacity: 0.85 }));
    sh.rotation.x = -Math.PI / 2;
    sh.scale.set(Math.max(sz.x, sz.z) * 1.35, Math.max(sz.x, sz.z) * 1.35, 1);
    sh.position.y = -sz.y / 2 - 0.004;
    sh.renderOrder = -1;
    const wrap = new THREE.Group();
    wrap.add(pivot, sh);
    const next = { id, pose, ci: -1, obj, wrap, gltf, model: m };
    if (m.variants) await this.setVariant(ci, next);
    if (my !== this.token) return false;
    gltf.__inUse = true;
    const prev = this.current;
    this.current = next;
    // 只保留上一台（用于淡出）和新的一台，其余一律移除，避免快速滚动时模型叠在一起
    if (this.anim && this.anim.prev) this.anim.prev = null;
    this.holder.children.slice().forEach((c) => { if (!prev || c !== prev.wrap) this.holder.remove(c); });
    this.holder.add(wrap);
    // 入场：轻微放大 + 旋转；旧模型淡出
    const fromYaw = opts.swap ? 0 : -0.5;
    this.anim = { t: 0, wrap, prev: prev && prev.wrap, fromYaw, fast: !!opts.swap };
    if (prev) prev.gltf.__inUse = false;
    if (opts.view !== false && !opts.keepAngle) {
      const [yaw, pitch] = m.view;
      this.setAngles(yaw, pitch, !!opts.instantAngle || this.mode === 'free');
      if (this.mode === 'free') this.setMode('free');
    }
    this.onLoading && this.onLoading(false);
    this.wake(1600);
    return true;
  }

  async setPose(pose) {
    if (!this.current) return;
    const cur = this.current;
    return this.show(cur.id, { pose, ci: cur.ci, keepAngle: true, swap: true });
  }

  async setVariant(ci, target) {
    const cur = target || this.current;
    if (!cur || !cur.model.variants) return;
    const parser = cur.gltf.parser;
    const jobs = [];
    cur.obj.traverse((o) => {
      const ext = o.userData && o.userData.gltfExtensions && o.userData.gltfExtensions.KHR_materials_variants;
      if (!ext) return;
      const mp = ext.mappings.find((x) => x.variants.indexOf(ci) >= 0);
      if (mp) jobs.push(parser.getDependency('material', mp.material).then((mat) => { o.material = mat; }));
    });
    await Promise.all(jobs);
    cur.ci = ci;
    this.wake();
  }

  clear() {
    this.token++;
    if (this.current) {
      this.current.gltf.__inUse = false;
      this.current = null;
    }
    this.anim = null;
    this.holder.children.slice().forEach((c) => this.holder.remove(c));
    this.wake();
  }

  loop() {
    requestAnimationFrame(this.loop);
    const dt = Math.min(this.clock.getDelta(), 0.05);
    const now = performance.now();
    if (!this.visible || !this.host || now > this.awakeUntil) return;
    // 入场动画
    if (this.anim) {
      const a = this.anim;
      a.t = Math.min(1, a.t + dt * (a.fast ? 4 : 1.8));
      const e = ease(a.t);
      a.wrap.scale.setScalar(lerp(a.fast ? 0.98 : 0.9, 1, e));
      a.wrap.rotation.y = lerp(a.fromYaw, 0, e);
      if (a.prev) {
        a.prev.scale.setScalar(lerp(1, 0.9, Math.min(1, a.t * 3)));
        if (a.t > 0.3 || a.fast) { this.holder.remove(a.prev); a.prev = null; }
      }
      if (a.t >= 1) {
        this.anim = null;
        // 动画结束时确保舞台上只有当前这一台
        const keep = this.current && this.current.wrap;
        this.holder.children.slice().forEach((c) => { if (c !== keep) this.holder.remove(c); });
      }
      this.wake(300);
    }
    if (this.mode === 'scroll') {
      const k = Math.min(1, dt * 6);
      this.yaw += (this.tYaw - this.yaw) * k;
      this.pitch += (this.tPitch - this.pitch) * k;
      this.zoom += (this.tZoom - this.zoom) * k;
      this.shift[0] += (this.tShift[0] - this.shift[0]) * k;
      this.shift[1] += (this.tShift[1] - this.shift[1]) * k;
      this.applyShift();
      this.holder.rotation.y = this.yaw;
      this.placeCamera();
      if (Math.abs(this.tYaw - this.yaw) > 0.0005 || Math.abs(this.tZoom - this.zoom) > 0.0005 || Math.abs(this.tShift[0] - this.shift[0]) > 0.001 || Math.abs(this.tShift[1] - this.shift[1]) > 0.001) this.wake(300);
    } else {
      this.controls.update();
      if (this.controls.autoRotate) this.wake(300);
    }
    this.renderer.render(this.scene, this.camera);
  }
}
