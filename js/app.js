import { PRODUCTS, CATEGORIES, PRIORITIES, GUIDES, CHECKED_AT, byId } from './data.js';
import { MEDIA } from './media.js';
import { REVIEW, SCORE_LABELS } from './review.js';
import { MODELS, has3D } from './models3d.js';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => Array.prototype.slice.call(el.querySelectorAll(s));
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (n) => '¥' + n.toLocaleString('zh-CN');
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const catOf = (id) => CATEGORIES.find((c) => c.id === id) || {};
const catName = (id) => catOf(id).en || id;
const thumb = (id) => `assets/thumbs/${id}.webp`;
const REDUCED = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
const AR_OK = (() => { try { const a = document.createElement('a'); return !!(a.relList && a.relList.supports && a.relList.supports('ar')); } catch (e) { return false; } })();
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* 隐私模式 */ } },
};
const OFFICIAL = {
  'iphone-duo': 'shop/buy-iphone/iphone-duo', 'iphone-18-pro-max': 'shop/buy-iphone/iphone-18-pro', 'iphone-18-pro': 'shop/buy-iphone/iphone-18-pro',
  'iphone-air': 'shop/buy-iphone/iphone-air', 'iphone-17': 'shop/buy-iphone/iphone-17', 'iphone-17e': 'shop/buy-iphone/iphone-17e', 'iphone-16': 'shop/buy-iphone/iphone-16',
  'macbook-neo': 'shop/buy-mac/macbook-neo', 'macbook-air': 'shop/buy-mac/macbook-air', 'macbook-pro': 'shop/buy-mac/macbook-pro',
  'macbook-pro-oled': 'shop/buy-mac/macbook-pro-proled-xdr', imac: 'shop/buy-mac/imac', 'mac-mini': 'shop/buy-mac/mac-mini', 'mac-studio': 'shop/buy-mac/mac-studio',
  'ipad-pro': 'shop/buy-ipad/ipad-pro', 'ipad-air': 'shop/buy-ipad/ipad-air', ipad: 'shop/buy-ipad/ipad', 'ipad-mini': 'shop/buy-ipad/ipad-mini',
  'watch-ultra-4': 'shop/buy-watch/apple-watch-ultra', 'watch-series-12': 'shop/buy-watch/apple-watch', 'watch-se-3': 'shop/buy-watch/apple-watch-se',
  'airpods-pro-3': 'shop/buy-airpods/airpods-pro-3', 'airpods-5': 'shop/buy-airpods/airpods-5', 'airpods-max-2': 'shop/buy-airpods/airpods-max-2',
  'vision-pro': 'shop/buy-vision/apple-vision-pro', homepod: 'shop/buy-homepod/homepod', 'homepod-mini': 'shop/buy-homepod/homepod-mini',
};
const CH_TITLE = {
  iphone: ['七款 iPhone，', '差别比你想的大。', '从 ¥5,299 的 17e 到 ¥15,999 的折叠屏，屏幕、影像、续航和重量各有取舍。'],
  mac: ['七款 Mac，', '先想清楚你要带着走吗。', '轻薄本、专业本还是桌面主机？内存和散热，比芯片名字更重要。'],
  ipad: ['四款 iPad，', '别为用不到的性能买单。', '追剧、记笔记、画画，还是当电脑用？刷新率和配件决定了体验。'],
  watch: ['三款手表，', '续航和健康功能是分水岭。', '一天一充还是两天一充，要不要心电图和血氧，决定你该选哪一款。'],
  airpods: ['三款 AirPods，', '舒适和降噪很难兼得。', '半入耳、入耳式和头戴式，各有各的场景。'],
  vision: ['Vision Pro，', '最震撼，也最需要冷静。', '它能带来任何屏幕都给不了的体验，但重量、续航和内容都是现实问题。'],
  home: ['两款 HomePod，', '只在苹果生态里好用。', '音质和智能家居中枢之外，你需要先确认家里都是苹果设备。'],
};

const state = { cat: 'all', max: Infinity, sort: 'rec', compare: store.get('gx-compare', []).filter((id) => byId[id]) };

/* ───────────── 媒体辅助 ───────────── */
function colorsOf(p) {
  const m = MEDIA[p.id];
  return m && m.colors.length ? m.colors : p.colors.map((c) => ({ name: c.name, hex: c.hex, views: [] }));
}
function photosOf(p, ci) {
  const m = MEDIA[p.id];
  const c = colorsOf(p)[ci];
  const own = c && c.views && c.views.length ? c.views : [m.main];
  return own.concat(m.gallery.filter((g) => own.indexOf(g) < 0));
}
function arOf(p, ci) {
  const c = colorsOf(p)[ci];
  return (c && c.ar) || MEDIA[p.id].ar || null;
}
function glowOf(p, ci) {
  const c = colorsOf(p)[ci || 0];
  const hex = (c && c.hex) || '#6b7cff';
  const n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  const lum = (r + g + b) / 3;
  return lum > 200 ? 'rgba(140, 150, 255, 0.2)' : `rgba(${r}, ${g}, ${b}, 0.32)`;
}
const modelColor = (id) => { const m = MODELS[id]; return m && m.fixed != null ? m.fixed : 0; };
const priceText = (p) => (p.price != null ? `${fmt(p.price)} 起` : esc(p.priceNote || '价格待核实'));
function factHTML(f) {
  const num = /^[\d.]+$/.test(f[0]);
  return `<div class="fact"><b ${num ? `data-n="${f[0]}"` : ''}>${esc(f[0])}<small>${esc(f[1])}</small></b><em>${esc(f[2])}</em></div>`;
}
function countUp(root) {
  if (REDUCED) return;
  $$('[data-n]', root).forEach((el) => {
    if (el.dataset.done) return; // 每个数字只滚动一次，来回滑动时不再重播
    el.dataset.done = '1';
    const target = parseFloat(el.dataset.n);
    const dec = (el.dataset.n.split('.')[1] || '').length;
    const unit = el.querySelector('small');
    const t0 = performance.now();
    const tick = (t) => {
      const k = Math.min(1, (t - t0) / 650);
      const v = target * (1 - Math.pow(1 - k, 3));
      el.firstChild.nodeValue = v.toFixed(dec);
      if (k < 1) requestAnimationFrame(tick);
    };
    if (!el.firstChild || el.firstChild.nodeType !== 3) el.insertBefore(document.createTextNode(''), unit);
    requestAnimationFrame(tick);
  });
}

/* ───────────── 通用 ───────────── */
$$('[data-count]').forEach((el) => (el.textContent = PRODUCTS.length));
$$('[data-checked]').forEach((el) => (el.textContent = CHECKED_AT));
let toastT;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.remove('show'), 2000);
}
const io = 'IntersectionObserver' in window ? new IntersectionObserver((ents) => ents.forEach((e) => {
  if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
}), { rootMargin: '0px 0px -8% 0px' }) : null;
const reveal = (el) => (io ? io.observe(el) : el.classList.add('in'));

/* ───────────── 3D 舞台 ───────────── */
let stage = null;
let owner = null; // 当前占用舞台的区域
let savedOwner = null;
const stageReady = import('./stage3d.js').then((mod) => {
  stage = new mod.Stage();
  stage.preload = mod.preload;
  return stage;
}).catch((e) => { console.error(e); return null; });

function claim(o) {
  owner = o;
  if (!stage) return;
  stage.mount(o.host);
}

/* ───────────── 开场 ───────────── */
const intro = { el: $('#intro'), beat: -1, pose: 'closed', ready: false };
stageReady.then((st) => {
  if (!st) { $('#introLoading').classList.add('done'); return; }
  claim({ kind: 'intro', host: $('#introStage') });
  intro.pose = 'closed';
  st.show('iphone-duo', { pose: 'closed', ci: 0, instantAngle: true, view: false }).then(() => {
    intro.ready = true;
    $('#introLoading').classList.add('done');
    onScroll();
  });
  st.setAngles(3.75, 0.1, true);
  st.preload('iphone-duo', 'open');
});
function introFrame(p) {
  const beat = p < 0.24 ? 0 : p < 0.5 ? 1 : p < 0.74 ? 2 : 3;
  if (beat !== intro.beat) {
    intro.beat = beat;
    $$('.beat').forEach((b, i) => b.classList.toggle('on', i === beat));
    if (beat === 3) countUp($('.beat[data-beat="3"]'));
  }
  $('#scrollCue').style.opacity = p > 0.02 ? 0 : 1;
  if (!stage || !intro.ready || !owner || owner.kind !== 'intro') return;
  // 关键帧：背面 → 侧面（切换为展开姿态）→ 正面
  let yaw;
  if (p < 0.36) yaw = lerp(3.75, 4.71, p / 0.36);
  else yaw = lerp(4.71, 6.8, clamp((p - 0.36) / 0.46, 0, 1));
  const want = p >= 0.36 ? 'open' : 'closed';
  if (want !== intro.pose || !stage.current || stage.current.id !== 'iphone-duo') {
    const swap = !!intro.pose && !!stage.current && stage.current.id === 'iphone-duo';
    intro.pose = want;
    stage.show('iphone-duo', { pose: want, ci: 0, keepAngle: true, swap });
  }
  stage.setAngles(yaw, lerp(0.08, 0.16, p));
  if (window.innerWidth >= 900) stage.setShift(0.2, 0);
  else stage.setShift(0, beat === 0 ? -0.12 : 0.16);
  stage.setZoom(p < 0.36 ? lerp(1.12, 0.95, p / 0.36) : p < 0.8 ? 0.95 : lerp(0.95, 1.25, (p - 0.8) / 0.2));
}

/* ───────────── 章节 ───────────── */
const chapters = [];
$('#chapters').innerHTML = CATEGORIES.map((c, ci) => {
  const items = PRODUCTS.filter((p) => p.cat === c.id);
  const t = CH_TITLE[c.id];
  const guides = GUIDES[c.id] || [];
  return `<section class="chapter" id="ch-${c.id}" data-cat="${c.id}">
    <header class="chapter-head reveal">
      <p class="ch-no">第 ${ci + 1} 章 · ${esc(c.en)}</p>
      <h2>${esc(t[0])}<br><span class="muted-h">${esc(t[1])}</span></h2>
      <p>${esc(t[2])}</p>
      ${guides.length > 1 ? `<div class="quick">${guides.map(([l, id]) => `<button data-open="${id}">${esc(l)} <b>${esc(byId[id].name)}</b></button>`).join('')}</div>` : ''}
    </header>
    <div class="story">
      <div class="s-stage">
        <div class="stage-host"></div>
        <img class="s-photo" alt="">
        <div class="s-loading done"><span></span></div>
        <span class="s-badge"></span>
        <button class="btn btn-small btn-ghost s-open">完整评测 →</button>
        <div class="s-label"><b></b><span></span></div>
      </div>
      <div class="s-cards">${items.map((p) => slideHTML(p)).join('')}</div>
    </div>
  </section>`;
}).join('');
function slideHTML(p) {
  const r = REVIEW[p.id];
  return `<article class="slide" data-id="${p.id}">
    <p class="slide-kicker">${priceText(p)} · ${esc(p.release)}${p.badge ? ` <span class="tag">${esc(p.badge)}</span>` : ''}</p>
    <h3>${esc(p.name)}</h3>
    <p class="slide-verdict">${esc(r.verdict)}</p>
    <div class="facts">${r.facts.map(factHTML).join('')}</div>
    <div class="pc">
      <ul class="pros">${r.pros.slice(0, 3).map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
      <ul class="cons">${r.cons.slice(0, 3).map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
    </div>
    <div class="slide-actions">
      <button class="btn btn-small btn-light" data-open="${p.id}">完整评测</button>
      <button class="btn btn-small btn-ghost" data-cmp="${p.id}">加入对比</button>
    </div>
  </article>`;
}
$$('.chapter').forEach((el) => {
  const st = $('.s-stage', el);
  chapters.push({ el, cat: el.dataset.cat, stageEl: st, host: $('.stage-host', st), photo: $('.s-photo', st), label: $('.s-label', st), badge: $('.s-badge', st), loading: $('.s-loading', st), slides: $$('.slide', el), active: null });
  reveal($('.chapter-head', el));
  $('.s-open', st).addEventListener('click', () => { const c = chapters.find((x) => x.el === el); if (c.active) openDetail(c.active); });
});
$('#cnInner').innerHTML = CATEGORIES.map((c) => `<a href="#ch-${c.id}" data-cat="${c.id}">${esc(c.en === 'Apple Watch' ? 'Watch' : c.en)}</a>`).join('');

function activateSlide(ch, id) {
  if (ch.active === id) return;
  ch.active = id;
  const p = byId[id];
  ch.slides.forEach((s) => s.classList.toggle('on', s.dataset.id === id));
  const sl = ch.slides.find((s) => s.dataset.id === id);
  if (sl) countUp(sl);
  $('b', ch.label).textContent = p.name;
  $('span', ch.label).textContent = has3D(id) ? (AR_OK ? '官方 3D 模型 · 点“完整评测”可拖动' : '官方 3D 模型 · 点“完整评测”可拖动旋转') : '官方实拍图';
  ch.badge.textContent = has3D(id) ? '3D' : '实拍';
  ch.stageEl.style.setProperty('--glow', glowOf(p, modelColor(id)));
  if (has3D(id) && stage && owner && owner.ch === ch) {
    // 先把 3D 画面淡出，旧模型不会和新产品的占位图叠在一起；新模型就绪后再淡入
    const cached = stage.current && stage.current.id === id;
    if (!cached) ch.host.classList.add('fading');
    ch.photo.src = thumb(id);
    ch.photo.classList.add('on');
    ch.loading.classList.remove('done');
    const t0 = performance.now();
    stage.show(id, { ci: modelColor(id) }).then((ok) => {
      if (ch.active !== id) return;
      const wait = Math.max(0, 220 - (performance.now() - t0)); // 等淡出完成再切换
      setTimeout(() => {
        if (ch.active !== id) return;
        ch.loading.classList.add('done');
        ch.host.classList.remove('fading');
        if (ok) ch.photo.classList.remove('on');
      }, wait);
    });
  } else {
    ch.host.classList.add('fading');
    if (stage && owner && owner.ch === ch) stage.clear();
    ch.photo.src = thumb(id);
    ch.photo.classList.add('on');
    ch.loading.classList.add('done');
  }
}

/* ───────────── 滚动调度 ───────────── */
const nav = $('#nav');
let ticking = false;
function onScroll() {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(() => { ticking = false; frame(); });
}
addEventListener('scroll', onScroll, { passive: true });
addEventListener('resize', onScroll);
function frame() {
  const vh = window.innerHeight;
  const sy = window.scrollY;
  nav.classList.toggle('scrolled', sy > 40);
  const dh = document.documentElement.scrollHeight - vh;
  $('#navProgress').style.transform = `scaleX(${dh > 0 ? sy / dh : 0})`;
  const ir = intro.el.getBoundingClientRect();
  const p = clamp(-ir.top / (ir.height - vh), 0, 1);
  if (layers.length && layers[layers.length - 1].id === 'detail') { introFrame(p); return; }
  // 当前可见的章节
  const narrow = window.innerWidth < 1024;
  let refY = vh * 0.5;
  let active = null;
  for (const ch of chapters) {
    const r = ch.el.getBoundingClientRect();
    if (r.top < vh * 0.6 && r.bottom > vh * 0.4) { active = ch; break; }
  }
  $$('#cnInner a').forEach((a) => a.classList.toggle('on', !!active && a.dataset.cat === active.cat));
  if (ir.bottom > vh * 0.35 || !active) {
    if (stage && owner && owner.kind !== 'intro' && ir.bottom > vh * 0.35) {
      claim({ kind: 'intro', host: $('#introStage') });
      intro.pose = '';
    }
    introFrame(p);
    return;
  }
  // 竖屏时舞台固定在上方，参考线放在舞台下方的可读区域
  if (narrow) { const sb = active.stageEl.getBoundingClientRect().bottom; refY = sb + (vh - sb) * 0.3; }
  // 选出最接近参考线的卡片
  let best = null, bestD = Infinity, bestR = null;
  for (const s of active.slides) {
    const r = s.getBoundingClientRect();
    const c = narrow ? r.top : r.top + Math.min(r.height, vh) * 0.4;
    const d = Math.abs(c - refY);
    if (d < bestD) { bestD = d; best = s; bestR = r; }
  }
  if (stage && (!owner || owner.ch !== active)) {
    claim({ kind: 'chapter', ch: active, host: active.host });
    active.active = null;
  }
  if (best) {
    activateSlide(active, best.dataset.id);
    if (stage && has3D(best.dataset.id)) {
      const t = clamp((refY - bestR.top) / Math.max(bestR.height, 1), 0, 1);
      const v = MODELS[best.dataset.id].view;
      stage.setAngles(v[0] + (t - 0.45) * 1.1, v[1]);
      stage.setZoom(1);
      stage.setShift(0, 0);
    }
  }
}

/* ───────────── 全部产品 ───────────── */
const seg = $('#seg');
seg.insertAdjacentHTML('beforeend', [{ id: 'all', en: '全部' }].concat(CATEGORIES).map((c) =>
  `<button role="tab" data-cat="${c.id}">${esc(c.en === 'Apple Watch' ? 'Watch' : c.en === 'Vision Pro' ? 'Vision' : c.en)}</button>`).join(''));
function movePill() {
  const on = $('button.on', seg) || $('button', seg);
  const pill = $('.seg-pill', seg);
  pill.style.width = on.offsetWidth + 'px';
  pill.style.transform = `translateX(${on.offsetLeft}px)`;
}
seg.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) setCat(b.dataset.cat); });
addEventListener('resize', movePill);
function setCat(cat) {
  state.cat = cat;
  $$('button', seg).forEach((b) => b.classList.toggle('on', b.dataset.cat === cat));
  movePill();
  renderGrid();
}
const budget = $('#budget');
function budgetLabel() {
  const v = +budget.value;
  state.max = v >= +budget.max ? Infinity : v;
  $('#budgetVal').textContent = state.max === Infinity ? '不限' : fmt(v);
  budget.style.setProperty('--p', ((v - budget.min) / (budget.max - budget.min)) * 100 + '%');
}
budget.addEventListener('input', () => { budgetLabel(); renderGrid(); });
$('#sort').addEventListener('change', (e) => { state.sort = e.target.value; renderGrid(); });
function renderGrid() {
  const list = PRODUCTS.filter((p) => (state.cat === 'all' || p.cat === state.cat) && (p.price == null ? state.max === Infinity : p.price <= state.max));
  if (state.sort === 'asc') list.sort((a, b) => a.price - b.price);
  else if (state.sort === 'desc') list.sort((a, b) => b.price - a.price);
  else if (state.sort === 'value') list.sort((a, b) => REVIEW[b.id].scores[5] - REVIEW[a.id].scores[5]);
  $('#grid').innerHTML = list.map((p, i) => {
    const r = REVIEW[p.id];
    const on = state.compare.indexOf(p.id) >= 0;
    return `<article class="card" data-id="${p.id}" style="--i:${i}" tabindex="0">
      <div class="card-media">${p.badge ? `<span class="badge">${esc(p.badge)}</span>` : ''}${has3D(p.id) ? '<span class="badge-3d">3D</span>' : ''}
        <img class="card-img" src="${thumb(p.id)}" alt="${esc(p.name)}" loading="lazy" decoding="async"></div>
      <div class="card-body">
        <span class="card-cat">${esc(catName(p.cat))}</span>
        <h3>${esc(p.name)}</h3>
        <p class="cv">${esc(r.verdict)}</p>
        <div class="mini-pc"><span class="g">${esc(r.pros[0])}</span><span class="w">${esc(r.cons[0])}</span></div>
        <div class="card-foot"><div class="price"><b>${fmt(p.price)}</b><span>起</span></div>
          <button class="cmp-toggle ${on ? 'on' : ''}" data-cmp="${p.id}" aria-pressed="${on}"><svg viewBox="0 0 24 24" width="12" height="12"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>对比</button></div>
      </div></article>`;
  }).join('');
  $('#empty').hidden = list.length > 0;
}
$('#grid').addEventListener('click', (e) => {
  if (e.target.closest('[data-cmp]')) return;
  const c = e.target.closest('.card');
  if (c) openDetail(c.dataset.id);
});
$('#grid').addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.classList.contains('card')) openDetail(e.target.dataset.id); });
document.addEventListener('click', (e) => {
  const cmp = e.target.closest('[data-cmp]');
  if (cmp) { e.preventDefault(); e.stopPropagation(); toggleCompare(cmp.dataset.cmp); return; }
  const o = e.target.closest('[data-open]');
  if (o) { e.preventDefault(); openDetail(o.dataset.open); }
});

/* ───────────── 对比 ───────────── */
function toggleCompare(id, force) {
  const has = state.compare.indexOf(id) >= 0;
  const want = force == null ? !has : force;
  if (want && !has) {
    if (state.compare.length >= 3) { toast('最多同时对比 3 款，先移除一款吧'); return; }
    state.compare.push(id);
    toast(`已加入对比（${state.compare.length}/3）`);
  } else if (!want && has) state.compare = state.compare.filter((x) => x !== id);
  store.set('gx-compare', state.compare);
  syncCompare();
}
function syncCompare() {
  $$('[data-cmp]').forEach((b) => {
    const on = state.compare.indexOf(b.dataset.cmp) >= 0;
    b.classList.toggle('on', on);
    if (b.classList.contains('btn')) { b.textContent = on ? '✓ 已加入对比' : '加入对比'; b.classList.toggle('added', on); }
  });
  $('#tray').hidden = state.compare.length === 0;
  $('#trayItems').innerHTML = state.compare.map((id) => `<button class="tray-item" data-rm="${id}" aria-label="移除 ${esc(byId[id].name)}"><img src="${thumb(id)}" alt=""></button>`).join('')
    + new Array(3 - state.compare.length + 1).join('<span class="tray-slot"></span>');
  $('#trayGo').style.opacity = state.compare.length < 2 ? 0.45 : 1;
  if (current) syncDetailCompare();
  if (!$('#compare').hidden) renderCompare();
}
$('#trayItems').addEventListener('click', (e) => { const b = e.target.closest('[data-rm]'); if (b) toggleCompare(b.dataset.rm, false); });
$('#trayClear').addEventListener('click', () => { state.compare = []; store.set('gx-compare', []); syncCompare(); });
$('#trayGo').addEventListener('click', () => { if (state.compare.length >= 2) { renderCompare(); openLayer($('#compare')); } else toast('再选一款就能对比了'); });
$('#diffOnly').addEventListener('change', renderCompare);
function renderCompare() {
  const ps = state.compare.map((id) => byId[id]);
  if (ps.length < 2) { closeLayer($('#compare')); return; }
  const keys = [];
  ps.forEach((p) => Object.keys(p.specs).forEach((k) => { if (keys.indexOf(k) < 0) keys.push(k); }));
  const minP = Math.min.apply(null, ps.map((p) => p.price));
  const diff = $('#diffOnly').checked;
  const row = (label, vals, force) => {
    const same = vals.every((v) => v === vals[0]);
    if (diff && same && !force) return '';
    return `<tr class="${same ? 'same' : ''}"><td>${esc(label)}</td>${vals.map((v) => `<td>${v}</td>`).join('')}</tr>`;
  };
  const sameCat = ps.every((p) => p.cat === ps[0].cat);
  const labels = SCORE_LABELS[ps[0].cat];
  $('#cmpTable').innerHTML = `
    <thead><tr><th></th>${ps.map((p) => `<th><img src="${thumb(p.id)}" alt=""><h3>${esc(p.name)}</h3><button class="rm" data-rmc="${p.id}">移除</button></th>`).join('')}</tr></thead>
    <tbody>
      ${row('起售价', ps.map((p) => fmt(p.price) + (p.price === minP ? '<span class="best">最低</span>' : '')), true)}
      ${row('一句话', ps.map((p) => esc(REVIEW[p.id].verdict)), true)}
      ${sameCat ? labels.map((l, i) => row(l, ps.map((p) => { const v = REVIEW[p.id].scores[i]; return v ? `${v}<span class="bar"><i style="--w:${v * 10}%"></i></span>` : '—'; }))).join('') : ''}
      ${row('优点', ps.map((p) => `<ul class="cg">${REVIEW[p.id].pros.slice(0, 3).map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`), true)}
      ${row('缺点', ps.map((p) => `<ul class="cw">${REVIEW[p.id].cons.slice(0, 3).map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`), true)}
      ${keys.map((k) => row(k, ps.map((p) => esc(p.specs[k] || '—')))).join('')}
      ${row('发布', ps.map((p) => esc(p.release)))}
      ${row('适合', ps.map((p) => esc(REVIEW[p.id].buyIf)), true)}
    </tbody>`;
}
$('#cmpTable').addEventListener('click', (e) => { const b = e.target.closest('[data-rmc]'); if (b) toggleCompare(b.dataset.rmc, false); });

/* ───────────── 图层 ───────────── */
const layers = [];
function lock(on) { document.documentElement.classList.toggle('locked', on); document.body.classList.toggle('locked', on); }
function openLayer(el) { if (!el.hidden) return; el.hidden = false; layers.push(el); lock(true); }
function closeLayer(el) {
  if (el.hidden) return;
  const i = layers.indexOf(el);
  if (i >= 0) layers.splice(i, 1);
  el.hidden = true;
  if (!layers.length) lock(false);
}
$$('.sheet, .modal, .palette').forEach((el) => el.addEventListener('click', (e) => {
  if (e.target.closest('[data-close]')) (el.id === 'detail' ? closeDetail() : closeLayer(el));
}));

/* ───────────── 评测页 ───────────── */
let current = null;
const view = { ci: 0, tab: '3d', slides: [], idx: 0, zoom: false, pose: null };

function openDetail(id, opts = {}) {
  const p = byId[id];
  if (!p) return;
  const sheet = $('#detail');
  const wasOpen = !sheet.hidden;
  current = p;
  sheet.classList.remove('closing');
  if (!wasOpen) savedOwner = owner;
  openLayer(sheet);
  if (location.hash !== '#/' + id && history.replaceState) history.replaceState(null, '', '#/' + id);
  const cols = colorsOf(p);
  const ci = clamp(opts.ci != null ? opts.ci : (has3D(id) ? modelColor(id) : 0), 0, cols.length - 1);
  view.ci = ci;
  view.pose = has3D(id) ? (MODELS[id].pose || 'default') : null;
  fillInfo(p);
  $('#rTabs').hidden = !has3D(id);
  setTab(has3D(id) ? '3d' : 'photo');
  setColor(ci);
  if (wasOpen) $('#info').scrollTop = 0;
}

function fillInfo(p) {
  const r = REVIEW[p.id];
  $('#dCat').textContent = catName(p.cat) + (p.badge ? ' · ' + p.badge : '');
  $('#dName').textContent = p.name;
  $('#dVerdict').textContent = r.verdict;
  $('#dPrice').innerHTML = `${fmt(p.price)}<small>起</small>`;
  $('#dRelease').textContent = `发布于 ${p.release} · 国行官网价`;
  $('#dFacts').innerHTML = r.facts.map(factHTML).join('');
  countUp($('#dFacts'));
  const labels = SCORE_LABELS[p.cat];
  $('#dScores').innerHTML = labels.map((l, i) => {
    const v = r.scores[i];
    return `<div class="score ${v ? '' : 'na'}"><div><span>${esc(l)}</span><b>${v || '—'}</b></div><i style="--w:${v * 10}%"></i></div>`;
  }).join('');
  $('#dPC').innerHTML = `<div><h4>优点</h4><ul class="pros">${r.pros.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>
    <div><h4>缺点（官网不会告诉你）</h4><ul class="cons">${r.cons.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>`;
  $('#dPersuade').innerHTML = `<h4>为什么值得买</h4><p>${esc(r.persuade)}</p>`;
  $('#dFor').textContent = r.buyIf;
  $('#dNot').textContent = r.skipIf;
  $('#dAlts').innerHTML = r.alts.map(([why, id]) => {
    const a = byId[id];
    const d = a.price - p.price;
    return `<button class="alt" data-sib="${id}"><img src="${thumb(id)}" alt=""><span><b>${esc(a.name)}</b>${esc(why)}</span><em>${d === 0 ? '同价' : (d > 0 ? '贵 ' : '省 ') + fmt(Math.abs(d))}</em></button>`;
  }).join('');
  $('#dSpecs').innerHTML = Object.keys(p.specs).map((k) => `<div><dt>${esc(k)}</dt><dd>${esc(p.specs[k])}</dd></div>`).join('');
  $('#dLink').href = 'https://www.apple.com.cn/' + (OFFICIAL[p.id] || '');
  const m = MODELS[p.id];
  $('#dNote').textContent = (m && m.note ? m.note + '。' : '') + (m && m.fixed != null ? `3D 模型为${colorsOf(p)[m.fixed].name}，其他配色请看实拍图。` : '');
  $('#rStage').style.setProperty('--glow', glowOf(p, view.ci));
  syncDetailCompare();
}
function syncDetailCompare() {
  const b = $('#dCompare');
  const on = state.compare.indexOf(current.id) >= 0;
  b.textContent = on ? '✓ 已在对比中' : '加入对比';
  b.classList.toggle('added', on);
}

function setTab(tab) {
  view.tab = tab;
  $$('#rTabs button').forEach((b) => b.classList.toggle('on', b.dataset.rt === tab));
  const is3d = tab === '3d';
  $('#r3d').hidden = !is3d;
  $('#viewer').hidden = is3d;
  $('#thumbs').hidden = is3d || view.slides.length < 2;
  $('#rHint').hidden = !is3d;
  $('#spinBtn').hidden = !is3d;
  updatePoseBtn();
  if (is3d) {
    $('#rLoading').classList.remove('done');
    stageReady.then((st) => {
      if (!st || !current || view.tab !== '3d') return;
      claim({ kind: 'detail', host: $('#r3d') });
      st.setMode('free');
      st.controls.autoRotate = $('#spinBtn').classList.contains('on');
      st.onInteract = () => $('#rHint').classList.add('hide');
      const ci = MODELS[current.id].variants ? view.ci : modelColor(current.id);
      st.show(current.id, { ci, pose: view.pose }).then(() => { $('#rLoading').classList.add('done'); st.setMode('free'); });
    });
  } else {
    $('#rLoading').classList.add('done');
    renderSlides();
  }
}
$('#rTabs').addEventListener('click', (e) => { const b = e.target.closest('[data-rt]'); if (b && b.dataset.rt !== view.tab) setTab(b.dataset.rt); });

function setColor(ci) {
  const p = current;
  const cols = colorsOf(p);
  view.ci = ci;
  $('#dColors').innerHTML = cols.map((c, i) => `<button class="swatch ${i === ci ? 'on' : ''}" role="radio" aria-checked="${i === ci}" aria-label="${esc(c.name)}" title="${esc(c.name)}" data-ci="${i}" style="--s:${c.hex}"></button>`).join('');
  $('#dColorName').textContent = cols[ci] ? cols[ci].name : '';
  $('#rStage').style.setProperty('--glow', glowOf(p, ci));
  view.slides = photosOf(p, ci);
  view.idx = 0;
  renderAR();
  if (view.tab === 'photo') renderSlides();
}
$('#dColors').addEventListener('click', (e) => {
  const b = e.target.closest('[data-ci]');
  if (!b || !current) return;
  const ci = +b.dataset.ci;
  setColor(ci);
  const m = MODELS[current.id];
  if (view.tab === '3d' && m) {
    if (m.variants) stage && stage.setVariant(ci);
    else if (ci !== m.fixed) { toast(`3D 模型只有${colorsOf(current)[m.fixed].name}，已切换到实拍图`); setTab('photo'); }
  }
});
function updatePoseBtn() {
  const m = current && MODELS[current.id];
  const show = view.tab === '3d' && m && m.poseLabel;
  $('#poseBtn').hidden = !show;
  $('#poseDiv').hidden = !show;
  if (show) {
    const other = view.pose === 'open' ? 'closed' : 'open';
    $('#poseBtn').textContent = m.poseLabel[other];
  }
}
$('#poseBtn').addEventListener('click', () => {
  if (!stage || !current) return;
  view.pose = view.pose === 'open' ? 'closed' : 'open';
  updatePoseBtn();
  $('#rLoading').classList.remove('done');
  stage.setPose(view.pose).then(() => $('#rLoading').classList.add('done'));
});
$('#spinBtn').addEventListener('click', (e) => {
  const b = e.currentTarget;
  const on = !b.classList.contains('on');
  b.classList.toggle('on', on);
  b.setAttribute('aria-pressed', on);
  if (stage) { stage.controls.autoRotate = on; stage.controls.autoRotateSpeed = 1.6; stage.wake(); }
});

function renderAR() {
  const url = arOf(current, view.ci);
  const slot = $('#arSlot');
  if (!url) { slot.innerHTML = ''; return; }
  const icon = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 2 3 7v10l9 5 9-5V7z"/><path d="M3 7l9 5 9-5M12 12v10"/></svg>';
  if (AR_OK) slot.innerHTML = `<a class="ar-btn" rel="ar" href="${url}#allowsContentScaling=1"><img class="ar-img" src="${thumb(current.id)}" alt="在 AR 中查看 ${esc(current.name)}">${icon}AR</a>`;
  else slot.innerHTML = `<button class="ar-btn" id="arHelp">${icon}AR</button>`;
}
$('#arSlot').addEventListener('click', (e) => { if (e.target.closest('#arHelp')) openLayer($('#arInfo')); });

// 实拍图浏览
function renderSlides() {
  $('#track').innerHTML = view.slides.map((v, k) => `<div class="slide-img ${v.bg === 'photo' ? 'photo' : ''}" data-k="${k}"><img data-src="${v.src}" alt="${esc(current.name)} 图 ${k + 1}" draggable="false"></div>`).join('');
  $('#thumbs').innerHTML = view.slides.map((v, k) => `<button class="thumb ${v.bg === 'photo' ? 'photo' : ''}" data-k="${k}" aria-label="第 ${k + 1} 张"><img src="${v.src}" alt="" loading="lazy"></button>`).join('');
  $('#thumbs').hidden = view.tab !== 'photo' || view.slides.length < 2;
  goSlide(view.idx, true);
}
function goSlide(k, instant) {
  const n = view.slides.length;
  view.idx = clamp(k, 0, n - 1);
  const track = $('#track');
  if (instant) track.classList.add('dragging');
  track.style.transform = `translate3d(${-view.idx * 100}%,0,0)`;
  if (instant) { void track.offsetWidth; track.classList.remove('dragging'); }
  [view.idx, view.idx + 1, view.idx - 1].forEach((i) => { const im = $(`#track .slide-img[data-k="${i}"] img`); if (im && !im.getAttribute('src')) im.src = im.dataset.src; });
  $$('#track .slide-img').forEach((s, i) => s.classList.toggle('cur', i === view.idx));
  $$('#thumbs .thumb').forEach((t, i) => t.classList.toggle('on', i === view.idx));
  $('#vCount').textContent = n > 1 ? `${view.idx + 1} / ${n}` : '';
  $('#vPrev').disabled = view.idx === 0;
  $('#vNext').disabled = view.idx >= n - 1;
}
(() => {
  const vw = $('#viewer'), track = $('#track');
  let sx = 0, sy = 0, dx = 0, down = false, moved = false, t0 = 0;
  vw.addEventListener('pointerdown', (e) => { if (e.target.closest('button')) return; down = true; moved = false; sx = e.clientX; sy = e.clientY; dx = 0; t0 = Date.now(); });
  vw.addEventListener('pointermove', (e) => {
    if (view.zoom) {
      const im = $('#track .slide-img.cur img');
      if (im) { const r = im.getBoundingClientRect(); im.style.transformOrigin = `${clamp((e.clientX - r.left) / r.width * 100, 0, 100)}% ${clamp((e.clientY - r.top) / r.height * 100, 0, 100)}%`; }
      if (down && Math.abs(e.clientX - sx) + Math.abs(e.clientY - sy) > 8) moved = true;
      return;
    }
    if (!down) return;
    dx = e.clientX - sx;
    if (!moved && Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(e.clientY - sy)) { moved = true; track.classList.add('dragging'); }
    if (moved) track.style.transform = `translate3d(calc(${-view.idx * 100}% + ${dx}px),0,0)`;
  });
  const end = (e) => {
    if (!down) return;
    down = false;
    track.classList.remove('dragging');
    if (view.zoom) { if (!moved) { view.zoom = false; vw.classList.remove('zoomed'); } return; }
    if (moved) { if (dx < -60) goSlide(view.idx + 1); else if (dx > 60) goSlide(view.idx - 1); else goSlide(view.idx); }
    else if (Date.now() - t0 < 450 && e.type === 'pointerup') {
      view.zoom = true;
      vw.classList.add('zoomed');
      const im = $('#track .slide-img.cur img');
      if (im) { const r = im.getBoundingClientRect(); im.style.transformOrigin = `${clamp((e.clientX - r.left) / r.width * 100, 0, 100)}% ${clamp((e.clientY - r.top) / r.height * 100, 0, 100)}%`; }
    }
  };
  vw.addEventListener('pointerup', end);
  vw.addEventListener('pointercancel', end);
})();
$('#vPrev').addEventListener('click', () => goSlide(view.idx - 1));
$('#vNext').addEventListener('click', () => goSlide(view.idx + 1));
$('#thumbs').addEventListener('click', (e) => { const t = e.target.closest('[data-k]'); if (t) goSlide(+t.dataset.k); });
$('#dCompare').addEventListener('click', () => current && toggleCompare(current.id));
$('#dAlts').addEventListener('click', (e) => { const b = e.target.closest('[data-sib]'); if (b) openDetail(b.dataset.sib); });
function step(dir) {
  if (!current) return;
  const sibs = PRODUCTS.filter((x) => x.cat === current.cat);
  const all = sibs.length > 1 ? sibs : PRODUCTS;
  const i = all.indexOf(current);
  openDetail(all[(i + dir + all.length) % all.length].id);
}
$('#prevP').addEventListener('click', () => step(-1));
$('#nextP').addEventListener('click', () => step(1));

function closeDetail() {
  const sheet = $('#detail');
  if (sheet.hidden) return;
  sheet.classList.add('closing');
  setTimeout(() => {
    closeLayer(sheet);
    sheet.classList.remove('closing');
    current = null;
    view.zoom = false;
    $('#viewer').classList.remove('zoomed');
    if (stage) {
      stage.controls.autoRotate = false;
      stage.setMode('scroll');
      stage.clear();
      if (savedOwner) {
        claim(savedOwner);
        if (savedOwner.ch) savedOwner.ch.active = null;
        if (savedOwner.kind === 'intro') { intro.pose = ''; }
      }
    }
    onScroll();
  }, 300);
  if (history.replaceState) history.replaceState(null, '', location.pathname + location.search);
}

/* ───────────── 帮我选 ───────────── */
const quiz = { step: 0, cat: null, budget: null, pri: [] };
const BUDGETS = [
  { v: 2000, label: '2000 元以内', sub: '耳机、手表、音箱' }, { v: 5500, label: '5500 元以内', sub: '入门手机、iPad' },
  { v: 8000, label: '8000 元以内', sub: '主流机型' }, { v: 12000, label: '1.2 万以内', sub: 'Pro 级手机、轻薄本' },
  { v: 20000, label: '2 万以内', sub: '专业笔记本' }, { v: Infinity, label: '预算不设限', sub: '只要最合适' },
];
function renderQuiz() {
  const el = $('#finderCard');
  const steps = `<div class="steps">${[0, 1, 2].map((i) => `<i class="${i < quiz.step || quiz.step === 3 ? 'done' : ''}"></i>`).join('')}</div>`;
  if (quiz.step === 0) {
    el.innerHTML = `${steps}<h3 class="q-title">想买哪一类？</h3><p class="q-sub">还没想好就选“都看看”。</p>
      <div class="opts">${CATEGORIES.map((c) => ({ id: c.id, label: c.en, sub: c.blurb })).concat([{ id: 'any', label: '都看看', sub: '全品类里帮我挑' }])
        .map((o, i) => `<button class="opt ${quiz.cat === o.id ? 'on' : ''}" data-q="cat" data-v="${o.id}" style="--i:${i}">${esc(o.label)}<small>${esc(o.sub)}</small></button>`).join('')}</div>`;
  } else if (quiz.step === 1) {
    el.innerHTML = `${steps}<h3 class="q-title">预算大概多少？</h3><p class="q-sub">按国行官网起售价计算，不含教育优惠和国家补贴。</p>
      <div class="opts">${BUDGETS.map((b, i) => `<button class="opt ${quiz.budget === b.v ? 'on' : ''}" data-q="budget" data-v="${b.v}" style="--i:${i}">${b.label}<small>${b.sub}</small></button>`).join('')}</div>
      <div class="q-nav"><button class="btn btn-small btn-ghost" data-q="back">← 上一步</button><span></span></div>`;
  } else if (quiz.step === 2) {
    el.innerHTML = `${steps}<h3 class="q-title">最看重什么？</h3><p class="q-sub">最多选三项。</p>
      <div class="opts">${PRIORITIES.map((p, i) => `<button class="opt ${quiz.pri.indexOf(p.id) >= 0 ? 'on' : ''}" data-q="pri" data-v="${p.id}" style="--i:${i}">${esc(p.name)}</button>`).join('')}</div>
      <div class="q-nav"><button class="btn btn-small btn-ghost" data-q="back">← 上一步</button><button class="btn btn-small btn-light" data-q="go" ${quiz.pri.length ? '' : 'style="opacity:.45"'}>查看推荐</button></div>`;
  } else {
    const res = recommend();
    el.innerHTML = `${steps}<h3 class="q-title">为你挑选的结果</h3><p class="q-sub">每款都附上一条你需要接受的代价。</p>
      ${res.length ? `<div class="results">${res.map((r, i) => `<button class="result" data-open="${r.p.id}" style="--i:${i}">
        <span class="rank">No.${i + 1}</span><div class="ph"><img src="${thumb(r.p.id)}" alt=""></div>
        <div><h4>${esc(r.p.name)}</h4><span class="muted small">${fmt(r.p.price)} 起</span></div>
        <div class="match"><span>匹配度 ${r.pct}%</span><span class="bar"><i style="--w:${r.pct}%"></i></span></div>
        <ul class="reasons">${r.why.map((w) => `<li>${esc(w)}</li>`).join('')}<li class="w">${esc(REVIEW[r.p.id].cons[0])}</li></ul>
      </button>`).join('')}</div>` : '<p class="muted">这个预算下没有找到合适的产品，试试放宽预算或换个品类。</p>'}
      <div class="q-nav"><button class="btn btn-small btn-ghost" data-q="back">← 修改偏好</button><button class="btn btn-small btn-ghost" data-q="reset">重新开始</button></div>`;
  }
}
function recommend() {
  const pool = PRODUCTS.filter((p) => quiz.cat === 'any' || p.cat === quiz.cat);
  const B = quiz.budget;
  const out = [];
  pool.forEach((p) => {
    if (B !== Infinity && p.price > B * 1.08) return;
    const why = [];
    let s = 0, prio = 0;
    quiz.pri.forEach((k) => {
      const v = p.tags[k] || 0;
      s += v; prio += v;
      if (v >= 2) why.push(`${PRIORITIES.find((x) => x.id === k).name}是它的强项`);
    });
    if (B !== Infinity) { const use = p.price / B; s += use <= 1 ? 1 + use * 0.6 : 0.4; why.unshift(use <= 1 ? `在预算内（${fmt(p.price)} 起）` : '略超预算，但值得考虑'); }
    else s += p.price / 32000;
    out.push({ p, s, prio, why: why.slice(0, 2) });
  });
  out.sort((a, b) => b.s - a.s);
  const hits = out.filter((r) => r.prio > 0);
  const maxS = quiz.pri.length * 3 + 1.6;
  return (hits.length ? hits : out).slice(0, 3).map((r, i) => ({ p: r.p, pct: Math.round(clamp((r.s / maxS) * 100 + 18 - i * 3, 58, 98)), why: r.why.length ? r.why : [REVIEW[r.p.id].pros[0]] }));
}
$('#finderCard').addEventListener('click', (e) => {
  const b = e.target.closest('[data-q]');
  if (!b) return;
  const q = b.dataset.q, v = b.dataset.v;
  if (q === 'cat') { quiz.cat = v; quiz.step = 1; }
  else if (q === 'budget') { quiz.budget = v === 'Infinity' ? Infinity : +v; quiz.step = 2; }
  else if (q === 'pri') {
    if (quiz.pri.indexOf(v) >= 0) quiz.pri = quiz.pri.filter((x) => x !== v);
    else if (quiz.pri.length < 3) quiz.pri.push(v);
    else toast('最多选择三项');
  } else if (q === 'go') { if (quiz.pri.length) quiz.step = 3; else { toast('先选至少一项'); return; } }
  else if (q === 'back') quiz.step = Math.max(0, quiz.step - 1);
  else if (q === 'reset') Object.assign(quiz, { step: 0, cat: null, budget: null, pri: [] });
  renderQuiz();
});

/* ───────────── 攻略 ───────────── */
const TIPS = [
  ['#34d17b', '<path d="M3 10 12 5l9 5-9 5z M7 12v4c3 2 7 2 10 0v-4" />', '教育优惠', '在校大学生、新生和教职工可以在 Apple 教育商店购买 Mac 与 iPad，通常比标准零售价便宜，返校季还可能有额外礼遇。'],
  ['#2997ff', '<path d="M12 3v18M7 7h7a3 3 0 0 1 0 6H9a3 3 0 0 0 0 6h8" />', '国家补贴', '符合条件的手机、平板、手表和耳机可以享受以旧换新或数码产品购新补贴，实际到手价经常比官网低不少。各地政策不同，下单前查一下当地规则。'],
  ['#ff9f43', '<path d="M4 12a8 8 0 0 1 14-5.3M20 12a8 8 0 0 1-14 5.3M18 3v4h-4M6 21v-4h4" />', '以旧换新', '官网和 Apple Store 可以把旧设备折抵为新机款，流程省心，但折抵价会定期调整，可以和二手平台的回收价对比一下。'],
  ['#a78bfa', '<rect x="4" y="4" width="16" height="16" rx="3" /><path d="M8 9h8M8 13h8M8 17h5" />', '存储怎么选', '拍 4K 视频、存大量照片，手机建议 512GB 起。只是日常使用，256GB 起步已经够用。iCloud 只能缓解，不能完全替代本地空间。'],
  ['#ff6fae', '<rect x="3" y="7" width="18" height="10" rx="2" /><path d="M7 7V5M11 7V5M15 7V5M19 7V5M7 19v-2M11 19v-2M15 19v-2" />', 'Mac 内存怎么选', 'Mac 的内存买了就不能升级。写代码、剪视频或跑本地模型，建议一步到位选更大的统一内存，它比加大硬盘更影响使用寿命。'],
  ['#5ac8fa', '<path d="M12 3 5 6v6c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6z" /><path d="m9 12 2 2 4-4" />', 'AppleCare+', '折叠屏、Vision Pro 这类维修成本高的设备，或者经常带出门的笔记本，可以考虑买 AppleCare+。'],
  ['#ffd60a', '<circle cx="12" cy="12" r="8" /><path d="M12 8v4l3 2" />', '什么时候买', '新品通常在秋季（9 月前后）和春季发布。临近发布时，旧款常有渠道降价，但官网很少直降。电商大促往往是全年低价点。'],
  ['#64d2ff', '<path d="M4 7h16l-1.5 11a2 2 0 0 1-2 1.7h-9a2 2 0 0 1-2-1.7z M9 7V5a3 3 0 0 1 6 0v2" />', '官翻与授权店', 'Apple 官方翻新产品经过检测并更换外壳和电池，享受一年保修。授权经销商和电商自营也是正规渠道，价格更灵活。'],
];
$('#tipsGrid').innerHTML = TIPS.map(([c, svg, h, p], i) => `<article class="tip reveal" style="--c:${c};transition-delay:${(i % 4) * 60}ms"><div class="ic"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${svg}</svg></div><h3>${h}</h3><p>${p}</p></article>`).join('');
$$('.reveal').forEach(reveal);

/* ───────────── 搜索 ───────────── */
const qInput = $('#q');
let qSel = 0;
const IDX = {};
PRODUCTS.forEach((p) => {
  const r = REVIEW[p.id];
  IDX[p.id] = [p.name, p.cat, catName(p.cat), p.badge, p.tagline, r.verdict].concat(r.pros, r.cons, Object.keys(p.specs).map((k) => p.specs[k]), colorsOf(p).map((c) => c.name)).join(' ').toLowerCase();
});
function renderSearch() {
  const terms = qInput.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const list = PRODUCTS.filter((p) => terms.every((t) => IDX[p.id].indexOf(t) >= 0));
  qSel = Math.min(qSel, Math.max(list.length - 1, 0));
  $('#qList').innerHTML = list.length ? list.map((p, i) => `<li role="option" class="${i === qSel ? 'on' : ''}" data-open="${p.id}"><img src="${thumb(p.id)}" alt="" loading="lazy">
    <span class="t"><b>${esc(p.name)}</b><span>${esc(REVIEW[p.id].verdict)}</span></span><span class="p">${fmt(p.price)}</span></li>`).join('') : '<li class="none">没有找到匹配的产品</li>';
}
function openSearch() { openLayer($('#search')); qInput.value = ''; qSel = 0; renderSearch(); setTimeout(() => qInput.focus(), 30); }
$('#openSearch').addEventListener('click', openSearch);
qInput.addEventListener('input', () => { qSel = 0; renderSearch(); });
qInput.addEventListener('keydown', (e) => {
  const items = $$('#qList li[data-open]');
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); qSel = (qSel + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % Math.max(items.length, 1); renderSearch(); }
  else if (e.key === 'Enter' && items[qSel]) { closeLayer($('#search')); openDetail(items[qSel].dataset.open); }
});
$('#qList').addEventListener('click', (e) => { if (e.target.closest('[data-open]')) closeLayer($('#search')); }, true);
document.addEventListener('keydown', (e) => {
  const typing = /INPUT|TEXTAREA|SELECT/.test((document.activeElement || {}).tagName);
  const top = layers[layers.length - 1];
  if (e.key === 'Escape') { if (top) (top.id === 'detail' ? closeDetail() : closeLayer(top)); return; }
  if (!typing && (e.key === '/' || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k'))) { e.preventDefault(); openSearch(); return; }
  if (top && top.id === 'detail' && !typing && view.tab === 'photo') {
    if (e.key === 'ArrowLeft') goSlide(view.idx - 1);
    if (e.key === 'ArrowRight') goSlide(view.idx + 1);
  }
});

/* ───────────── 启动 ───────────── */
function route() { const m = location.hash.match(/^#\/([\w-]+)$/); if (m && byId[m[1]]) openDetail(m[1]); }
addEventListener('hashchange', route);
budgetLabel();
setCat('all');
renderQuiz();
syncCompare();
requestAnimationFrame(movePill);
frame();
route();
