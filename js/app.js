import { PRODUCTS, CATEGORIES, PRIORITIES, GUIDES, CHECKED_AT, byId } from './data.js';
import { MEDIA } from './media.js';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => Array.prototype.slice.call(el.querySelectorAll(s));
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (n) => '¥' + n.toLocaleString('zh-CN');
const catName = (id) => (CATEGORIES.find((c) => c.id === id) || {}).en || id;
const priceHTML = (p) => (p.price != null ? `<b>${fmt(p.price)}</b><span>起</span>` : `<span class="na">${esc(p.priceNote || '价格待核实')}</span>`);
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
const officialUrl = (id) => 'https://www.apple.com.cn/' + (OFFICIAL[id] || '');
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* 隐私模式 */ } },
};
const AR_OK = (() => { try { const a = document.createElement('a'); return !!(a.relList && a.relList.supports && a.relList.supports('ar')); } catch (e) { return false; } })();
const FINE = window.matchMedia && matchMedia('(hover: hover) and (pointer: fine)').matches;
const REDUCED = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ───────────── 媒体 ───────────── */
function colorsOf(p) {
  const m = MEDIA[p.id];
  return m && m.colors.length ? m.colors : p.colors.map((c) => ({ name: c.name, hex: c.hex, views: [] }));
}
function mainOf(p, ci = 0) {
  const c = colorsOf(p)[ci];
  return (c && c.views[0]) || MEDIA[p.id].main;
}
function altOf(p, ci = 0) {
  const c = colorsOf(p)[ci];
  const pool = [].concat(c ? c.views.slice(1) : [], MEDIA[p.id].gallery);
  return pool.find((v) => v.bg !== 'photo') || null;
}
function slidesOf(p, ci) {
  const c = colorsOf(p)[ci];
  const own = c && c.views.length ? c.views : [MEDIA[p.id].main];
  return own.concat(MEDIA[p.id].gallery.filter((g) => own.indexOf(g) < 0));
}
function arOf(p, ci) {
  const c = colorsOf(p)[ci];
  return (c && c.ar) || MEDIA[p.id].ar || null;
}
function img(v, alt, cls = '', eager = false) {
  if (!v) return '';
  return `<img src="${v.src}" width="${v.w}" height="${v.h}" alt="${esc(alt)}" class="${cls}" ${eager ? '' : 'loading="lazy"'} decoding="async" draggable="false">`;
}

const state = {
  cat: 'all', max: Infinity, sort: 'rec',
  compare: store.get('gx-compare', []).filter((id) => byId[id]),
  cardColor: {},
};

/* ───────────── 通用 ───────────── */
$$('[data-count]').forEach((el) => (el.textContent = PRODUCTS.length));
$$('[data-checked]').forEach((el) => (el.textContent = CHECKED_AT));

let toastT;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.remove('show'), 1900);
}

const nav = $('#nav');
const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > $('#hero').offsetHeight - 60);
addEventListener('scroll', onScroll, { passive: true });
onScroll();

const io = 'IntersectionObserver' in window ? new IntersectionObserver((ents) => ents.forEach((e) => {
  if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
}), { rootMargin: '0px 0px -8% 0px' }) : null;
const reveal = (el) => (io ? io.observe(el) : el.classList.add('in'));
$$('.reveal').forEach(reveal);

/* ───────────── 英雄区 ───────────── */
const FEATURED = [
  { id: 'iphone-duo', ci: 0, tag: '本季焦点', glow: 'rgba(170, 180, 215, 0.42)' },
  { id: 'iphone-18-pro', ci: 1, tag: '全新 Pro', glow: 'rgba(110, 160, 235, 0.5)' },
  { id: 'ipad-pro', ci: 0, tag: '串联 OLED', glow: 'rgba(160, 110, 255, 0.45)' },
  { id: 'imac', ci: 6, tag: 'M6 芯片', glow: 'rgba(170, 140, 230, 0.48)' },
  { id: 'homepod-mini', ci: 2, tag: '新配色', glow: 'rgba(70, 120, 210, 0.5)' },
];
const hero = { i: 0, timer: null, paused: false };
$('#heroImgs').innerHTML = FEATURED.map((f, i) => img(mainOf(byId[f.id], f.ci), byId[f.id].name, i ? '' : 'on', i === 0)).join('');
$('#heroDots').innerHTML = FEATURED.map((f, i) => `<button role="tab" aria-label="${esc(byId[f.id].name)}" data-hi="${i}"><i></i></button>`).join('');
function showHero(i) {
  const imgs = $$('#heroImgs img');
  imgs.forEach((im, k) => { im.classList.toggle('on', k === i); im.classList.toggle('out', k === hero.i && k !== i); });
  hero.i = i;
  const f = FEATURED[i], p = byId[f.id];
  $('#heroTag').textContent = f.tag;
  $('#heroName').textContent = p.name;
  $('#heroPrice').textContent = (p.price != null ? fmt(p.price) + ' 起 · ' : '') + p.tagline;
  $('#heroGlow').style.setProperty('--glow', f.glow);
  const dots = $$('#heroDots button');
  dots.forEach((b, k) => {
    b.classList.remove('on');
    b.classList.toggle('done', k < i);
    b.setAttribute('aria-selected', k === i);
  });
  void dots[i].offsetWidth; // 重启进度动画
  dots[i].classList.add('on');
  clearTimeout(hero.timer);
  if (!REDUCED) hero.timer = setTimeout(nextHero, 5200);
}
function nextHero() {
  if (hero.paused || document.hidden) { hero.timer = setTimeout(nextHero, 800); return; }
  showHero((hero.i + 1) % FEATURED.length);
}
$('#heroDots').addEventListener('click', (e) => { const b = e.target.closest('[data-hi]'); if (b) showHero(+b.dataset.hi); });
const openHero = () => openDetail(FEATURED[hero.i].id, { ci: FEATURED[hero.i].ci });
$('#heroOpen').addEventListener('click', openHero);
$('#heroImgs').addEventListener('click', openHero);
const stage = $('#heroStage');
if (FINE && !REDUCED) {
  stage.addEventListener('pointermove', (e) => {
    const r = stage.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
    $('#heroImgs').style.transform = `rotateY(${x * 10}deg) rotateX(${-y * 8}deg) translateZ(0)`;
  });
}
stage.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') { hero.paused = true; stage.classList.add('paused'); } });
stage.addEventListener('pointerleave', () => { hero.paused = false; stage.classList.remove('paused'); $('#heroImgs').style.transform = ''; });
showHero(0);

/* ───────────── 品类 ───────────── */
const TILE = {
  iphone: ['iphone-18-pro', 1, 'big'], mac: ['macbook-air', 0, 'wide'], ipad: ['ipad-pro', 0, ''], watch: ['watch-ultra-4', 0, ''],
  airpods: ['airpods-pro-3', 0, ''], vision: ['vision-pro', 0, ''], home: ['homepod-mini', 2, 'wide'],
};
$('#bento').innerHTML = CATEGORIES.map((c) => {
  const [pid, ci, size] = TILE[c.id];
  const n = PRODUCTS.filter((p) => p.cat === c.id).length;
  return `<button class="tile ${size} reveal" data-cat="${c.id}">
    <h3>${esc(c.en)}</h3><p>${esc(c.blurb)}</p><span class="count">${n} 款产品</span>${img(mainOf(byId[pid], ci), c.en)}
  </button>`;
}).join('');
$$('#bento .tile').forEach((el, i) => { el.style.transitionDelay = `${i * 50}ms`; reveal(el); });
$('#bento').addEventListener('click', (e) => {
  const t = e.target.closest('.tile');
  if (!t) return;
  setCat(t.dataset.cat);
  $('#lineup').scrollIntoView({ behavior: 'smooth' });
});

/* ───────────── 工具栏 ───────────── */
const seg = $('#seg');
seg.insertAdjacentHTML('beforeend', [{ id: 'all', en: '全部' }].concat(CATEGORIES).map((c) =>
  `<button role="tab" data-cat="${c.id}" aria-selected="${c.id === 'all'}">${esc(c.en === 'Apple Watch' ? 'Watch' : c.en === 'Vision Pro' ? 'Vision' : c.en)}</button>`).join(''));
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
  $$('button', seg).forEach((b) => { b.classList.toggle('on', b.dataset.cat === cat); b.setAttribute('aria-selected', b.dataset.cat === cat); });
  const on = $(`button[data-cat="${cat}"]`, seg);
  if (on && seg.scrollWidth > seg.clientWidth) seg.scrollTo({ left: on.offsetLeft - seg.clientWidth / 2 + on.offsetWidth / 2, behavior: 'smooth' });
  movePill();
  renderPaths();
  renderGrid();
}

const budget = $('#budget');
const BUDGET_MAX = +budget.max;
function budgetLabel() {
  const v = +budget.value;
  state.max = v >= BUDGET_MAX ? Infinity : v;
  $('#budgetVal').textContent = state.max === Infinity ? '不限' : fmt(v);
  budget.style.setProperty('--p', ((v - budget.min) / (budget.max - budget.min)) * 100 + '%');
}
budget.addEventListener('input', () => { budgetLabel(); renderGrid(); });
$('#sort').addEventListener('change', (e) => { state.sort = e.target.value; renderGrid(); });

const PICKS = [
  ['多数人的 iPhone', 'iphone-17'], ['学生党 Mac', 'macbook-air'], ['尝鲜折叠', 'iphone-duo'],
  ['通勤降噪', 'airpods-pro-3'], ['记笔记画画', 'ipad-air'], ['户外长续航', 'watch-ultra-4'],
];
function renderPaths() {
  const list = state.cat === 'all' ? PICKS : GUIDES[state.cat] || [];
  $('#paths').innerHTML = list.map(([label, id], i) =>
    `<button class="path" data-open="${id}" style="--i:${i}">${esc(label)} <b>${esc(byId[id].name)}</b></button>`).join('');
}

/* ───────────── 产品网格 ───────────── */
const order = {};
PRODUCTS.forEach((p, i) => { order[p.id] = i; });
const relScore = (p) => parseInt(p.release, 10) * 12 + (parseInt(p.release.split('年')[1], 10) || 6);
function filtered() {
  const list = PRODUCTS.filter((p) => (state.cat === 'all' || p.cat === state.cat) && (p.price == null ? state.max === Infinity : p.price <= state.max));
  if (state.sort === 'asc') list.sort((a, b) => (a.price || 1e9) - (b.price || 1e9));
  else if (state.sort === 'desc') list.sort((a, b) => (b.price || -1) - (a.price || -1));
  else if (state.sort === 'new') list.sort((a, b) => relScore(b) - relScore(a) || order[a.id] - order[b.id]);
  return list;
}
const AR_ICON = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 2 3 7v10l9 5 9-5V7z"/><path d="M3 7l9 5 9-5M12 12v10"/></svg>';
function cardHTML(p, i) {
  const ci = state.cardColor[p.id] || 0;
  const cols = colorsOf(p);
  const alt = altOf(p, ci);
  const inCmp = state.compare.indexOf(p.id) >= 0;
  return `<article class="card ${alt ? 'has-alt' : ''}" data-id="${p.id}" style="--i:${i}" tabindex="0" aria-label="${esc(p.name)}，${p.price ? fmt(p.price) + ' 起' : ''}">
    <div class="card-media">
      ${p.badge ? `<span class="badge">${esc(p.badge)}</span>` : ''}
      ${MEDIA[p.id].ar ? `<span class="badge-ar">${AR_ICON}AR</span>` : ''}
      ${img(mainOf(p, ci), p.name, 'main', i < 4)}${alt ? img(alt, '', 'alt') : ''}
    </div>
    <div class="card-body">
      <span class="card-cat">${esc(catName(p.cat))}</span>
      <h3>${esc(p.name)}</h3>
      <p>${esc(p.tagline)}</p>
      <div class="dots" role="radiogroup" aria-label="${cols.length} 种配色">${cols.slice(0, 8).map((c, k) =>
        `<button class="${k === ci ? 'on' : ''}" data-ci="${k}" role="radio" aria-checked="${k === ci}" aria-label="${esc(c.name)}" title="${esc(c.name)}"><i style="--d:${c.hex}"></i></button>`).join('')}</div>
      <div class="card-foot">
        <div class="price">${priceHTML(p)}</div>
        <button class="cmp-toggle ${inCmp ? 'on' : ''}" data-cmp="${p.id}" aria-pressed="${inCmp}">
          <svg viewBox="0 0 24 24" width="12" height="12"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>对比
        </button>
      </div>
    </div>
  </article>`;
}
function renderGrid() {
  const list = filtered();
  $('#grid').innerHTML = list.map(cardHTML).join('');
  $('#empty').hidden = list.length > 0;
}
const grid = $('#grid');
grid.addEventListener('click', (e) => {
  const c = e.target.closest('[data-cmp]');
  if (c) { e.stopPropagation(); toggleCompare(c.dataset.cmp); return; }
  const card = e.target.closest('.card');
  if (!card) return;
  const dot = e.target.closest('[data-ci]');
  const p = byId[card.dataset.id];
  if (dot) {
    e.stopPropagation();
    const ci = +dot.dataset.ci;
    state.cardColor[p.id] = ci;
    $$('.dots button', card).forEach((b) => { b.classList.toggle('on', b === dot); b.setAttribute('aria-checked', b === dot); });
    const v = mainOf(p, ci);
    const im = $('img.main', card);
    if (v && im && im.getAttribute('src') !== v.src) {
      im.style.opacity = '0';
      setTimeout(() => { im.onload = () => { im.style.opacity = ''; }; im.src = v.src; }, 180);
    }
    const alt = altOf(p, ci), ai = $('img.alt', card);
    if (alt && ai) ai.src = alt.src;
    return;
  }
  openDetail(p.id, { ci: state.cardColor[p.id] || 0 });
});
grid.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.classList.contains('card')) openDetail(e.target.dataset.id);
});
document.addEventListener('click', (e) => {
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
  } else if (!want && has) {
    state.compare = state.compare.filter((x) => x !== id);
  }
  store.set('gx-compare', state.compare);
  syncCompare();
}
function syncCompare() {
  $$('[data-cmp]').forEach((b) => { const on = state.compare.indexOf(b.dataset.cmp) >= 0; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
  $('#tray').hidden = state.compare.length === 0;
  $('#trayItems').innerHTML = state.compare.map((id) => `<button class="tray-item" data-rm="${id}" aria-label="移除 ${esc(byId[id].name)}">${img(mainOf(byId[id]), byId[id].name)}</button>`).join('')
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
  const priced = ps.filter((p) => p.price != null);
  const minP = priced.length > 1 ? Math.min.apply(null, priced.map((p) => p.price)) : null;
  const diffOnly = $('#diffOnly').checked;
  const row = (label, vals) => {
    const same = vals.every((v) => v === vals[0]);
    if (diffOnly && same) return '';
    return `<tr class="${same ? 'same' : ''}"><td>${esc(label)}</td>${vals.map((v) => `<td>${v}</td>`).join('')}</tr>`;
  };
  $('#cmpTable').innerHTML = `
    <thead><tr><th></th>${ps.map((p) => `<th><div class="ph">${img(mainOf(p), p.name)}</div><h3>${esc(p.name)}</h3><button class="rm" data-rmc="${p.id}">移除</button></th>`).join('')}</tr></thead>
    <tbody>
      ${row('品类', ps.map((p) => esc(catName(p.cat))))}
      ${row('起售价', ps.map((p) => (p.price != null ? fmt(p.price) + (p.price === minP ? '<span class="best">最低</span>' : '') : esc(p.priceNote || '待核实'))))}
      ${row('发布', ps.map((p) => esc(p.release)))}
      ${keys.map((k) => row(k, ps.map((p) => esc(p.specs[k] || '—')))).join('')}
      ${row('亮点', ps.map((p) => p.highlights.map(esc).join('<br>')))}
      ${row('适合', ps.map((p) => esc(p.forWho)))}
      ${row('配色', ps.map((p) => colorsOf(p).map((c) => esc(c.name)).join('、')))}
      ${row('3D / AR', ps.map((p) => (MEDIA[p.id].ar ? '官方模型' : '—')))}
    </tbody>`;
}
$('#cmpTable').addEventListener('click', (e) => { const b = e.target.closest('[data-rmc]'); if (b) toggleCompare(b.dataset.rmc, false); });

/* ───────────── 图层 ───────────── */
const layers = [];
function lock(on) { document.documentElement.classList.toggle('locked', on); document.body.classList.toggle('locked', on); }
function openLayer(el) {
  if (!el.hidden) return;
  el.hidden = false;
  layers.push(el);
  lock(true);
}
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

/* ───────────── 详情 ───────────── */
let current = null;
const view = { ci: 0, slides: [], idx: 0, zoom: false };

function openDetail(id, opts = {}) {
  const p = byId[id];
  if (!p) return;
  const sheet = $('#detail');
  const wasOpen = !sheet.hidden;
  current = p;
  sheet.classList.remove('closing');
  openLayer(sheet);
  if (location.hash !== '#/' + id && history.replaceState) history.replaceState(null, '', '#/' + id);
  const ci = Math.max(0, Math.min(opts.ci || 0, colorsOf(p).length - 1));
  fillInfo(p);
  setColor(ci, true);
  if (wasOpen) $('#info').scrollTop = 0;
}

function fillInfo(p) {
  $('#dCat').textContent = catName(p.cat) + (p.badge ? ' · ' + p.badge : '');
  $('#dName').textContent = p.name;
  $('#dTag').textContent = p.tagline;
  $('#dPrice').innerHTML = p.price != null ? `${fmt(p.price)}<small>起</small>` : `<small style="margin:0">${esc(p.priceNote || '价格待核实')}</small>`;
  $('#dRelease').textContent = `发布于 ${p.release} · 国行官网价`;
  const cols = colorsOf(p);
  $('#dColors').innerHTML = cols.map((c, i) =>
    `<button class="swatch" role="radio" aria-label="${esc(c.name)}" title="${esc(c.name)}" data-ci="${i}" style="--s:${c.hex}"></button>`).join('');
  $('#dHighlights').innerHTML = p.highlights.map((h) => `<li>${esc(h)}</li>`).join('');
  $('#dSpecs').innerHTML = Object.keys(p.specs).map((k) => `<div><dt>${esc(k)}</dt><dd>${esc(p.specs[k])}</dd></div>`).join('');
  $('#dFor').textContent = p.forWho;
  $('#dNot').textContent = p.notFor;
  $('#dLink').href = officialUrl(p.id);
  const sibs = PRODUCTS.filter((x) => x.cat === p.cat);
  $('#dSiblings').innerHTML = sibs.map((x) => `<button class="sib ${x === p ? 'on' : ''}" data-sib="${x.id}"><div class="sib-img">${img(mainOf(x), x.name)}</div><span>${esc(x.name)}</span></button>`).join('');
  const sl = $('#dSiblings'), so = $('.on', sl);
  if (so) sl.scrollLeft = so.offsetLeft - sl.clientWidth / 2 + so.offsetWidth / 2;
  syncDetailCompare();
}
function syncDetailCompare() {
  const b = $('#dCompare');
  const on = state.compare.indexOf(current.id) >= 0;
  b.textContent = on ? '✓ 已在对比中' : '加入对比';
  b.classList.toggle('added', on);
}

function setColor(ci, reset) {
  const p = current;
  const cols = colorsOf(p);
  view.ci = ci;
  $$('#dColors .swatch').forEach((s, k) => { s.classList.toggle('on', k === ci); s.setAttribute('aria-checked', k === ci); });
  $('#dColorName').textContent = cols[ci] ? cols[ci].name : '';
  const keepIdx = reset ? 0 : view.idx;
  view.slides = slidesOf(p, ci);
  view.idx = Math.min(keepIdx, view.slides.length - 1);
  setZoom(false);
  $('#track').innerHTML = view.slides.map((v, k) => `<div class="slide ${v.bg === 'photo' ? 'photo' : ''}" data-k="${k}"><img data-src="${v.src}" width="${v.w}" height="${v.h}" alt="${esc(p.name)} 图 ${k + 1}" draggable="false"></div>`).join('');
  $('#thumbs').innerHTML = view.slides.map((v, k) => `<button class="thumb ${v.bg === 'photo' ? 'photo' : ''}" data-k="${k}" role="tab" aria-label="第 ${k + 1} 张">${img(v, '')}</button>`).join('');
  $('#thumbs').hidden = view.slides.length < 2;
  renderAR();
  goSlide(view.idx, true);
}

function renderAR() {
  const url = arOf(current, view.ci);
  const slot = $('#arSlot');
  if (!url) { slot.innerHTML = ''; return; }
  const label = `${AR_ICON.replace('width="12" height="12"', 'width="16" height="16"')}<span>AR 查看 3D</span>`;
  if (AR_OK) {
    // AR Quick Look：rel="ar" 链接的第一个子元素必须是 img
    const poster = mainOf(current, view.ci);
    slot.innerHTML = `<a class="ar-btn" rel="ar" href="${url}#allowsContentScaling=1"><img class="ar-img" src="${poster ? poster.src : ''}" alt="在 AR 中查看 ${esc(current.name)}">${label}</a>`;
  } else {
    slot.innerHTML = `<button class="ar-btn" id="arHelp">${label}</button>`;
  }
}
$('#arSlot').addEventListener('click', (e) => {
  if (!e.target.closest('#arHelp')) return;
  $('#arDownload').href = arOf(current, view.ci);
  openLayer($('#arInfo'));
});

function loadSlide(k) {
  const s = $(`#track .slide[data-k="${k}"] img`);
  if (s && !s.getAttribute('src')) s.src = s.dataset.src;
}
function goSlide(k, instant) {
  const n = view.slides.length;
  view.idx = Math.max(0, Math.min(n - 1, k));
  const track = $('#track');
  if (instant) track.classList.add('dragging');
  track.style.transform = `translate3d(${-view.idx * 100}%,0,0)`;
  if (instant) { void track.offsetWidth; track.classList.remove('dragging'); }
  [view.idx, view.idx + 1, view.idx - 1].forEach(loadSlide);
  $$('#track .slide').forEach((s, i) => s.classList.toggle('cur', i === view.idx));
  $$('#thumbs .thumb').forEach((t, i) => t.classList.toggle('on', i === view.idx));
  const ot = $('#thumbs .thumb.on'), tb = $('#thumbs');
  if (ot && tb.scrollWidth > tb.clientWidth) tb.scrollLeft = ot.offsetLeft - tb.clientWidth / 2 + ot.offsetWidth / 2;
  $('#vCount').textContent = n > 1 ? `${view.idx + 1} / ${n}` : '';
  $('#vPrev').disabled = view.idx === 0;
  $('#vNext').disabled = view.idx >= n - 1;
}
function setZoom(on, x, y) {
  view.zoom = on;
  $('#viewer').classList.toggle('zoomed', on);
  if (on) panTo(x, y);
}
function panTo(x, y) {
  const im = $('#track .slide.cur img');
  if (!im) return;
  const r = im.getBoundingClientRect();
  if (!r.width) return;
  const px = Math.max(0, Math.min(100, ((x - r.left) / r.width) * 100));
  const py = Math.max(0, Math.min(100, ((y - r.top) / r.height) * 100));
  im.style.transformOrigin = `${px}% ${py}%`;
}

// 拖动切换 / 轻点放大 / 放大后移动查看
(() => {
  const vw = $('#viewer'), track = $('#track');
  let sx = 0, sy = 0, dx = 0, down = false, moved = false, t0 = 0, pid = null;
  vw.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button, a')) return;
    down = true; moved = false; sx = e.clientX; sy = e.clientY; dx = 0; t0 = Date.now(); pid = e.pointerId;
  });
  vw.addEventListener('pointermove', (e) => {
    if (view.zoom) {
      if (e.pointerType === 'mouse' || down) panTo(e.clientX, e.clientY);
      if (down && (Math.abs(e.clientX - sx) > 6 || Math.abs(e.clientY - sy) > 6)) moved = true;
      return;
    }
    if (!down || e.pointerId !== pid) return;
    dx = e.clientX - sx;
    const dy = e.clientY - sy;
    if (!moved && Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) {
      moved = true;
      track.classList.add('dragging');
      try { vw.setPointerCapture(pid); } catch (err) { /* noop */ }
    }
    if (moved) {
      const n = view.slides.length;
      const edge = (view.idx === 0 && dx > 0) || (view.idx === n - 1 && dx < 0) ? 0.35 : 1;
      track.style.transform = `translate3d(calc(${-view.idx * 100}% + ${dx * edge}px),0,0)`;
    }
  });
  const end = (e) => {
    if (!down) return;
    down = false;
    track.classList.remove('dragging');
    if (view.zoom) { if (!moved) setZoom(false); return; }
    if (moved) {
      const w = vw.clientWidth;
      if (dx < -Math.min(80, w * 0.15)) goSlide(view.idx + 1);
      else if (dx > Math.min(80, w * 0.15)) goSlide(view.idx - 1);
      else goSlide(view.idx);
    } else if (Date.now() - t0 < 500 && e.type === 'pointerup') {
      setZoom(true, e.clientX, e.clientY);
      $('#vHint').classList.add('hide');
    }
  };
  vw.addEventListener('pointerup', end);
  vw.addEventListener('pointercancel', end);
  vw.addEventListener('wheel', (e) => {
    if (view.zoom || Math.abs(e.deltaX) < 30 || Math.abs(e.deltaX) < Math.abs(e.deltaY)) return;
    e.preventDefault();
    if (vw.dataset.lock) return;
    vw.dataset.lock = '1';
    goSlide(view.idx + (e.deltaX > 0 ? 1 : -1));
    setTimeout(() => { delete vw.dataset.lock; }, 500);
  }, { passive: false });
})();
$('#vPrev').addEventListener('click', () => { setZoom(false); goSlide(view.idx - 1); });
$('#vNext').addEventListener('click', () => { setZoom(false); goSlide(view.idx + 1); });
$('#thumbs').addEventListener('click', (e) => { const t = e.target.closest('[data-k]'); if (t) { setZoom(false); goSlide(+t.dataset.k); } });
$('#dColors').addEventListener('click', (e) => { const b = e.target.closest('[data-ci]'); if (b && current) setColor(+b.dataset.ci, true); });
$('#dCompare').addEventListener('click', () => current && toggleCompare(current.id));
$('#dSiblings').addEventListener('click', (e) => { const b = e.target.closest('[data-sib]'); if (b && b.dataset.sib !== current.id) openDetail(b.dataset.sib); });
$('.tabs').addEventListener('click', (e) => {
  const b = e.target.closest('[data-tab]');
  if (!b) return;
  $$('.tabs button').forEach((x) => x.classList.toggle('on', x === b));
  $('#tabSpecs').hidden = b.dataset.tab !== 'specs';
  $('#tabFit').hidden = b.dataset.tab !== 'fit';
});
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
  setTimeout(() => { closeLayer(sheet); sheet.classList.remove('closing'); current = null; $('#track').innerHTML = ''; }, 300);
  if (history.replaceState) history.replaceState(null, '', location.pathname + location.search);
}

/* ───────────── 帮我选 ───────────── */
const quiz = { step: 0, cat: null, budget: null, pri: [] };
const BUDGETS = [
  { v: 2000, label: '2000 元以内', sub: '耳机、手表、音箱' },
  { v: 5500, label: '5500 元以内', sub: '入门手机、iPad' },
  { v: 8000, label: '8000 元以内', sub: '主流机型' },
  { v: 12000, label: '1.2 万以内', sub: 'Pro 级手机、轻薄本' },
  { v: 20000, label: '2 万以内', sub: '专业笔记本' },
  { v: Infinity, label: '预算不设限', sub: '只要最合适' },
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
      <div class="q-nav"><button class="btn btn-small btn-plain" data-q="back">← 上一步</button><span></span></div>`;
  } else if (quiz.step === 2) {
    el.innerHTML = `${steps}<h3 class="q-title">最看重什么？</h3><p class="q-sub">最多选三项。</p>
      <div class="opts">${PRIORITIES.map((p, i) => `<button class="opt ${quiz.pri.indexOf(p.id) >= 0 ? 'on' : ''}" data-q="pri" data-v="${p.id}" style="--i:${i}">${esc(p.name)}</button>`).join('')}</div>
      <div class="q-nav"><button class="btn btn-small btn-plain" data-q="back">← 上一步</button><button class="btn btn-small btn-dark" data-q="go" ${quiz.pri.length ? '' : 'style="opacity:.45"'}>查看推荐</button></div>`;
  } else {
    const res = recommend();
    el.innerHTML = `${steps}<h3 class="q-title">为你挑选的结果</h3><p class="q-sub">点开可以看大图、加入对比。</p>
      ${res.length ? `<div class="results">${res.map((r, i) => `<button class="result" data-open="${r.p.id}" style="--i:${i}">
        <span class="rank">No.${i + 1}</span><div class="ph">${img(mainOf(r.p), r.p.name)}</div>
        <div><h4>${esc(r.p.name)}</h4><span class="muted small">${r.p.price != null ? fmt(r.p.price) + ' 起' : esc(r.p.priceNote)}</span></div>
        <div class="match"><span>匹配度 ${r.pct}%</span><span class="bar"><i style="--w:${r.pct}%"></i></span></div>
        <ul class="reasons">${r.why.map((w) => `<li>${esc(w)}</li>`).join('')}</ul>
      </button>`).join('')}</div>` : '<p class="muted">这个预算下没有找到合适的产品，试试放宽预算或换个品类。</p>'}
      <div class="q-nav"><button class="btn btn-small btn-plain" data-q="back">← 修改偏好</button><button class="btn btn-small btn-plain" data-q="reset">重新开始</button></div>`;
  }
}
function recommend() {
  const pool = PRODUCTS.filter((p) => quiz.cat === 'any' || p.cat === quiz.cat);
  const B = quiz.budget;
  const out = [];
  pool.forEach((p) => {
    if (p.price != null && B !== Infinity && p.price > B * 1.08) return;
    const why = [];
    let s = 0, prio = 0;
    quiz.pri.forEach((k) => {
      const v = p.tags[k] || 0;
      s += v; prio += v;
      if (v >= 2) why.push(`${PRIORITIES.find((x) => x.id === k).name}是它的强项`);
    });
    if (p.price != null && B !== Infinity) {
      const use = p.price / B;
      s += use <= 1 ? 1 + use * 0.6 : 0.4;
      why.unshift(use <= 1 ? `在预算内（${fmt(p.price)} 起）` : '略超预算，但值得考虑');
    } else if (p.price == null) s -= 0.6;
    else s += p.price / 32000;
    out.push({ p, s, prio, why: why.slice(0, 3) });
  });
  out.sort((a, b) => b.s - a.s);
  const hits = out.filter((r) => r.prio > 0);
  const pick = hits.length ? hits : out;
  const maxS = quiz.pri.length * 3 + 1.6;
  return pick.slice(0, 3).map((r, i) => ({
    p: r.p,
    pct: Math.round(Math.max(58, Math.min(98, (r.s / maxS) * 100 + 18 - i * 3))),
    why: r.why.length ? r.why : [r.p.forWho],
  }));
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
  ['#1f9d55', '<path d="M3 10 12 5l9 5-9 5z M7 12v4c3 2 7 2 10 0v-4" />', '教育优惠', '在校大学生、新生和教职工可以在 Apple 教育商店购买 Mac 与 iPad，通常比标准零售价便宜，返校季还可能有额外礼遇。'],
  ['#0071e3', '<path d="M12 3v18M7 7h7a3 3 0 0 1 0 6H9a3 3 0 0 0 0 6h8" />', '国家补贴', '符合条件的手机、平板、手表和耳机可以享受以旧换新或数码产品购新补贴，实际到手价经常比官网低不少。各地政策不同，下单前查一下当地规则。'],
  ['#d97706', '<path d="M4 12a8 8 0 0 1 14-5.3M20 12a8 8 0 0 1-14 5.3M18 3v4h-4M6 21v-4h4" />', '以旧换新', '官网和 Apple Store 可以把旧设备折抵为新机款，流程省心，但折抵价每隔一段时间会调整，可以和二手平台的回收价对比一下。'],
  ['#7b5cff', '<rect x="4" y="4" width="16" height="16" rx="3" /><path d="M8 9h8M8 13h8M8 17h5" />', '存储怎么选', '拍 4K 视频、存大量照片，手机建议 512GB 起。只是日常使用，256GB 起步已经够用。iCloud 只能缓解，不能完全替代本地空间。'],
  ['#e0457b', '<rect x="3" y="7" width="18" height="10" rx="2" /><path d="M7 7V5M11 7V5M15 7V5M19 7V5M7 19v-2M11 19v-2M15 19v-2" />', 'Mac 内存怎么选', 'Mac 的内存买了就不能升级。写代码、剪视频或跑本地模型，建议一步到位选更大的统一内存，它比加大硬盘更影响使用寿命。'],
  ['#0a84ff', '<path d="M12 3 5 6v6c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6z" /><path d="m9 12 2 2 4-4" />', 'AppleCare+', '折叠屏、Vision Pro 这类维修成本高的设备，或者经常带出门的笔记本，可以考虑买 AppleCare+。也可以先看看信用卡或运营商的碎屏保障。'],
  ['#c69200', '<circle cx="12" cy="12" r="8" /><path d="M12 8v4l3 2" />', '什么时候买', '新品通常在秋季（9 月前后）和春季发布。临近发布时，旧款常有渠道降价，但官网很少直降。电商大促（618、双 11）往往是全年低价点。'],
  ['#30a46c', '<path d="M4 7h16l-1.5 11a2 2 0 0 1-2 1.7h-9a2 2 0 0 1-2-1.7z M9 7V5a3 3 0 0 1 6 0v2" />', '官翻与授权店', 'Apple 官方翻新产品经过检测并更换外壳和电池，享受一年保修。授权经销商和电商自营也是正规渠道，价格更灵活，购买时注意保留发票。'],
];
$('#tipsGrid').innerHTML = TIPS.map(([c, svg, h, p], i) => `<article class="tip reveal" style="--c:${c};transition-delay:${(i % 4) * 60}ms">
  <div class="ic"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${svg}</svg></div>
  <h3>${h}</h3><p>${p}</p></article>`).join('');
$$('#tipsGrid .reveal').forEach(reveal);

/* ───────────── 搜索 ───────────── */
const qInput = $('#q');
let qSel = 0;
const IDX = {};
PRODUCTS.forEach((p) => {
  IDX[p.id] = [p.name, p.cat, catName(p.cat), p.badge, p.tagline].concat(p.highlights, Object.keys(p.specs).map((k) => p.specs[k]), [p.forWho], colorsOf(p).map((c) => c.name)).join(' ').toLowerCase();
});
function renderSearch() {
  const terms = qInput.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const list = PRODUCTS.filter((p) => terms.every((t) => IDX[p.id].indexOf(t) >= 0));
  qSel = Math.min(qSel, Math.max(list.length - 1, 0));
  $('#qList').innerHTML = list.length ? list.map((p, i) => `<li role="option" class="${i === qSel ? 'on' : ''}" data-open="${p.id}" aria-selected="${i === qSel}">
    <span class="pi">${img(mainOf(p), '')}</span>
    <span class="t"><b>${esc(p.name)}</b><span>${esc(catName(p.cat))} · ${esc(p.tagline)}</span></span>
    <span class="p">${p.price != null ? fmt(p.price) : '—'}</span></li>`).join('') : '<li class="none">没有找到匹配的产品</li>';
}
function openSearch() {
  openLayer($('#search'));
  qInput.value = '';
  qSel = 0;
  renderSearch();
  setTimeout(() => qInput.focus(), 30);
}
$('#openSearch').addEventListener('click', openSearch);
qInput.addEventListener('input', () => { qSel = 0; renderSearch(); });
qInput.addEventListener('keydown', (e) => {
  const items = $$('#qList li[data-open]');
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    qSel = (qSel + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % Math.max(items.length, 1);
    renderSearch();
    const on = $('#qList li.on');
    if (on) on.scrollIntoView({ block: 'nearest' });
  } else if (e.key === 'Enter' && items[qSel]) {
    closeLayer($('#search'));
    openDetail(items[qSel].dataset.open);
  }
});
$('#qList').addEventListener('click', (e) => { if (e.target.closest('[data-open]')) closeLayer($('#search')); }, true);

document.addEventListener('keydown', (e) => {
  const typing = /INPUT|TEXTAREA|SELECT/.test((document.activeElement || {}).tagName);
  if (e.key === 'Escape') {
    const top = layers[layers.length - 1];
    if (top) (top.id === 'detail' ? closeDetail() : closeLayer(top));
    return;
  }
  if (!typing && (e.key === '/' || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k'))) { e.preventDefault(); openSearch(); return; }
  const top = layers[layers.length - 1];
  if (top && top.id === 'detail' && !typing) {
    if (e.key === 'ArrowLeft') { setZoom(false); goSlide(view.idx - 1); }
    if (e.key === 'ArrowRight') { setZoom(false); goSlide(view.idx + 1); }
  }
});

/* ───────────── 路由与启动 ───────────── */
function route() {
  const m = location.hash.match(/^#\/([\w-]+)$/);
  if (m && byId[m[1]]) openDetail(m[1]);
}
addEventListener('hashchange', route);

budgetLabel();
setCat('all');
renderQuiz();
syncCompare();
requestAnimationFrame(movePill);
if (document.fonts && document.fonts.ready) document.fonts.ready.then(movePill);
route();
