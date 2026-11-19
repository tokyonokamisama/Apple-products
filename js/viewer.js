import * as THREE from 'three';
import { OrbitControls } from 'three/addons/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/RoomEnvironment.js';
import { buildModel } from './models.js';

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

function makeRenderer(opts = {}) {
  const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance', ...opts });
  r.setPixelRatio(Math.min(devicePixelRatio || 1, opts.maxDpr || 2));
  r.toneMapping = THREE.ACESFilmicToneMapping;
  r.toneMappingExposure = 1.05;
  r.outputColorSpace = THREE.SRGBColorSpace;
  r.localClippingEnabled = true;
  r.setClearColor(0x000000, 0);
  return r;
}

function makeStage(renderer) {
  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  scene.environment = pmrem.fromScene(room, 0.035).texture;
  scene.environmentIntensity = 0.9;
  room.dispose?.();
  pmrem.dispose();
  const key = new THREE.DirectionalLight(0xffffff, 1.6);
  key.position.set(3, 5, 4);
  const rim = new THREE.DirectionalLight(0xbfd4ff, 1.1);
  rim.position.set(-4, 2, -3);
  const fill = new THREE.HemisphereLight(0xffffff, 0x222228, 0.35);
  scene.add(key, rim, fill);
  return scene;
}

let shadowTex;
function shadowTexture() {
  if (shadowTex) return shadowTex;
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, 'rgba(0,0,0,0.55)');
  g.addColorStop(0.45, 'rgba(0,0,0,0.25)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  shadowTex = new THREE.CanvasTexture(c);
  return shadowTex;
}

function addShadow(scene, box) {
  const size = box.getSize(new THREE.Vector3());
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2;
  m.scale.set(Math.max(size.x, size.z * 0.6) * 1.5, Math.max(size.z, size.x * 0.35) * 1.5, 1);
  m.position.set((box.min.x + box.max.x) / 2, box.min.y - 0.01, (box.min.z + box.max.z) / 2);
  m.renderOrder = -1;
  scene.add(m);
  return m;
}

function fitDistance(camera, radius, pad = 1.1) {
  const fov = THREE.MathUtils.degToRad(camera.fov);
  const fovH = 2 * Math.atan(Math.tan(fov / 2) * camera.aspect);
  const f = Math.min(fov, fovH);
  return (radius / Math.sin(f / 2)) * pad;
}

const ease = (t) => 1 - Math.pow(1 - t, 3);

/* ───────────── 详情页查看器 ───────────── */
export class Viewer {
  constructor(container) {
    this.container = container;
    this.renderer = makeRenderer();
    container.appendChild(this.renderer.domElement);
    this.scene = makeStage(this.renderer);
    this.camera = new THREE.PerspectiveCamera(30, 1, 0.01, 200);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    Object.assign(this.controls, {
      enableDamping: true, dampingFactor: 0.08, enablePan: false, rotateSpeed: 0.8, zoomSpeed: 0.8,
      autoRotate: !reduceMotion, autoRotateSpeed: 1.4,
    });
    this.controls.addEventListener('start', () => { this.interacting = true; this.onInteract?.(); });
    this.controls.addEventListener('end', () => { this.interacting = false; });
    this.clock = new THREE.Clock();
    this.running = false;
    this.camAnim = null;
    new ResizeObserver(() => this.resize()).observe(container);
    this.resize();
  }

  resize() {
    const { clientWidth: w, clientHeight: h } = this.container;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (this.radius) {
      const dist = fitDistance(this.camera, this.radius, 1.08);
      this.controls.minDistance = dist * 0.45;
      this.controls.maxDistance = dist * 2.2;
    }
  }

  show(product, hex) {
    this.clear();
    this.camAnim = null;
    const model = buildModel(product, hex);
    this.model = model;
    this.pivot = new THREE.Group();
    this.pivot.add(model.group);
    this.scene.add(this.pivot);
    model.update(10);
    model.group.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(model.group);
    const center = box.getCenter(new THREE.Vector3());
    model.group.position.sub(center);
    box.translate(center.clone().negate());
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    this.radius = sphere.radius;
    this.shadow = addShadow(this.scene, box);
    this.home = model.view.clone().normalize();
    this.resize();
    const dist = fitDistance(this.camera, this.radius, 1.08);
    this.dist = dist;
    this.camera.near = dist / 60;
    this.camera.far = dist * 8;
    this.camera.updateProjectionMatrix();
    this.controls.target.set(0, 0, 0);
    this.camera.position.copy(this.home).multiplyScalar(dist);
    this.camera.lookAt(0, 0, 0);
    this.controls.update();
    // 入场动画
    this.intro = reduceMotion ? 1 : 0;
    this.start();
    return model;
  }

  clear() {
    if (this.pivot) {
      this.scene.remove(this.pivot);
      this.model.dispose();
      this.pivot = null;
      this.model = null;
    }
    if (this.shadow) {
      this.scene.remove(this.shadow);
      this.shadow.geometry.dispose();
      this.shadow.material.dispose();
      this.shadow = null;
    }
  }

  setAutoRotate(v) { this.controls.autoRotate = v; }

  // 视角预设：front / back / side / top / home
  look(preset) {
    const dirs = {
      home: this.home,
      front: new THREE.Vector3(0, 0.08, 1),
      back: new THREE.Vector3(0, 0.08, -1),
      side: new THREE.Vector3(1, 0.06, 0.02),
      top: new THREE.Vector3(0.0, 1, 0.25),
    };
    const dir = (dirs[preset] || this.home).clone().normalize();
    const from = this.camera.position.clone();
    const r = from.length();
    const to = dir.multiplyScalar(preset === 'home' ? this.dist : r);
    this.camAnim = { from, to, t: 0 };
    this.controls.autoRotate = false;
    this.onInteract?.();
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.clock.getDelta();
    const tick = () => {
      if (!this.running) return;
      this.raf = requestAnimationFrame(tick);
      const dt = Math.min(this.clock.getDelta(), 0.05);
      if (this.pivot && this.intro < 1) {
        this.intro = Math.min(1, this.intro + dt * 1.1);
        const e = ease(this.intro);
        this.pivot.rotation.y = (1 - e) * -1.4;
        this.pivot.position.y = (1 - e) * -this.radius * 0.25;
        this.pivot.scale.setScalar(0.86 + 0.14 * e);
      }
      if (this.camAnim) {
        const a = this.camAnim;
        a.t = Math.min(1, a.t + dt * 1.4);
        const e = ease(a.t);
        // 球面插值，保持距离
        const r = THREE.MathUtils.lerp(a.from.length(), a.to.length(), e);
        const v = a.from.clone().normalize().lerp(a.to.clone().normalize(), e).normalize();
        if (v.lengthSq() < 0.01) v.set(1, 0, 0);
        this.camera.position.copy(v.multiplyScalar(r));
        if (a.t >= 1) this.camAnim = null;
      }
      this.model?.update(dt);
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
    };
    tick();
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  snapshot() {
    this.renderer.render(this.scene, this.camera);
    return this.renderer.domElement.toDataURL('image/png');
  }
}

/* ───────────── 首页英雄区 ───────────── */
export class HeroStage {
  constructor(container, product) {
    this.container = container;
    this.renderer = makeRenderer({ maxDpr: 1.75 });
    container.appendChild(this.renderer.domElement);
    this.scene = makeStage(this.renderer);
    this.camera = new THREE.PerspectiveCamera(28, 1, 0.01, 100);
    this.model = buildModel(product);
    this.pivot = new THREE.Group();
    this.pivot.add(this.model.group);
    this.scene.add(this.pivot);
    this.model.update(10);
    const box = new THREE.Box3().setFromObject(this.model.group);
    const c = box.getCenter(new THREE.Vector3());
    this.model.group.position.sub(c);
    this.radius = box.getBoundingSphere(new THREE.Sphere()).radius;
    this.model.setLoop?.(!reduceMotion);
    this.mouse = new THREE.Vector2();
    this.smooth = new THREE.Vector2();
    this.scroll = 0;
    addEventListener('pointermove', (e) => {
      this.mouse.set((e.clientX / innerWidth) * 2 - 1, (e.clientY / innerHeight) * 2 - 1);
    }, { passive: true });
    new ResizeObserver(() => this.resize()).observe(container);
    this.resize();
    this.clock = new THREE.Clock();
    this.t = 0;
    const io = new IntersectionObserver(([en]) => (en.isIntersecting ? this.start() : this.stop()));
    io.observe(container);
  }

  setColor(hex) { this.model.setColor(hex); }

  resize() {
    const { clientWidth: w, clientHeight: h } = this.container;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    const d = fitDistance(this.camera, this.radius, 1.05);
    this.camera.near = d / 60;
    this.camera.far = d * 8;
    this.camera.updateProjectionMatrix();
    this.camera.position.set(0, this.radius * 0.1, d);
    this.camera.lookAt(0, 0, 0);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.clock.getDelta();
    const tick = () => {
      if (!this.running) return;
      this.raf = requestAnimationFrame(tick);
      const dt = Math.min(this.clock.getDelta(), 0.05);
      this.t += dt;
      this.smooth.lerp(this.mouse, Math.min(1, dt * 3));
      const spin = reduceMotion ? 0 : Math.sin(this.t * 0.35) * 0.55;
      this.pivot.rotation.y = -0.35 + spin + this.smooth.x * 0.35;
      this.pivot.rotation.x = 0.08 + this.smooth.y * 0.12;
      this.pivot.position.y = reduceMotion ? 0 : Math.sin(this.t * 0.9) * this.radius * 0.02;
      this.model.update(dt);
      this.renderer.render(this.scene, this.camera);
    };
    tick();
  }

  stop() { this.running = false; cancelAnimationFrame(this.raf); }
}

/* ───────────── 缩略图批量渲染 ───────────── */
export async function renderThumbnails(products, onThumb, size = [720, 540]) {
  const renderer = makeRenderer({ preserveDrawingBuffer: true, maxDpr: 1 });
  renderer.setPixelRatio(1);
  renderer.setSize(size[0], size[1], false);
  const scene = makeStage(renderer);
  const camera = new THREE.PerspectiveCamera(26, size[0] / size[1], 0.01, 200);
  const idle = () => new Promise((r) => (window.requestIdleCallback ? requestIdleCallback(r, { timeout: 120 }) : setTimeout(r, 16)));
  for (const p of products) {
    await idle();
    const model = buildModel(p);
    model.update(10);
    model.thumb?.();
    scene.add(model.group);
    model.group.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(model.group);
    const c = box.getCenter(new THREE.Vector3());
    model.group.position.sub(c);
    box.translate(c.clone().negate());
    model.update(0);
    const shadow = addShadow(scene, box);
    const r = box.getBoundingSphere(new THREE.Sphere()).radius;
    const dir = (p.thumbView ? new THREE.Vector3(...p.thumbView) : model.view.clone()).normalize();
    const fd = fitDistance(camera, r, 1.02);
    camera.near = fd / 60;
    camera.far = fd * 8;
    camera.updateProjectionMatrix();
    camera.position.copy(dir.multiplyScalar(fd));
    camera.lookAt(0, 0, 0);
    renderer.render(scene, camera);
    const blob = await new Promise((res) => renderer.domElement.toBlob(res, 'image/webp', 0.9));
    const url = blob ? URL.createObjectURL(blob) : renderer.domElement.toDataURL('image/png');
    scene.remove(model.group, shadow);
    model.dispose();
    shadow.geometry.dispose();
    shadow.material.dispose();
    onThumb(p.id, url);
  }
  renderer.dispose();
  renderer.forceContextLoss();
}
