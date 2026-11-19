import { PRODUCTS, CATEGORIES, PRIORITIES, GUIDES, CHECKED_AT, byId } from './data.js';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (n) => '¥' + n.toLocaleString('zh-CN');
const catName = (id) => CATEGORIES.find((c) => c.id === id)?.en ?? id;
const priceHTML = (p) => (p.price != null ? `<b>${fmt(p.price)}</b><span>起</span>` : `<span class="na">${esc(p.priceNote || '价格待核实')}</span>`);
const OFFICIAL = {
  iphone: 'https://www.apple.com.cn/iphone/', mac: 'https://www.apple.com.cn/mac/', ipad: 'https://www.apple.com.cn/ipad/',
  watch: 'https://www.apple.com.cn/watch/', airpods: 'https://www.apple.com.cn/airpods/', vision: 'https://www.apple.com.cn/apple-vision-pro/',
  home: 'https://www.apple.com.cn/tv-home/',
};
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* 隐私模式 */ } },
};

const state = {
  cat: 'all', max: 30000, sort: 'rec',
  compare: store.get('gx-compare', []).filter((id) => byId[id]),
  thumbs: {},
};

let THREE_OK = true;
let viewerMod = null;
const loadViewer = () => (viewerMod ||= import('./viewer.js'));

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
addEventListener('scroll', () => nav.classList.toggle('scrolled', scrollY > 20), { passive: true });

const io = new IntersectionObserver((ents) => ents.forEach((e) => {
  if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
}), { rootMargin: '0px 0px -8% 0px' });
$$('.reveal').forEach((el) => io.observe(el));

function thumbImg(id, cls = '') {
  const url = state.thumbs[id];
  return `<img data-thumb="${id}" ${url ? `src="${url}"` : ''} class="${cls} ${url ? 'ready' : ''}" alt="${esc(byId[id].name)} 3D 渲染图" draggable="false">`;
}
function applyThumb(id, url) {
  state.thumbs[id] = url;
  $$(`img[data-thumb="${id}"]`).forEach((img) => {
    img.src = url;
    img.onload = () => img.classList.add('ready');
  });
}

/* ───────────── 品类 Bento ───────────── */
const TILE = {
  iphone: ['iphone-18-pro', 'big', '#c8683a'], mac: ['macbook-air', 'wide', '#7ea4d6'], ipad: ['ipad-pro', '', '#8fa0ff'],
  watch: ['watch-ultra-4', '', '#ff8a3d'], airpods: ['airpods-pro-3', '', '#d8d8e8'], vision: ['vision-pro', '', '#b9a6ff'],
  home: ['homepod-mini', 'wide', '#f0cd5a'],
};
$('#bento').innerHTML = CATEGORIES.map((c) => {
  const [pid, size, col] = TILE[c.id];
  const n = PRODUCTS.filter((p) => p.cat === c.id).length;
  return `<button class="tile ${size} reveal" data-cat="${c.id}" style="--c:${col}">
    <h3>${esc(c.en)}</h3><p>${esc(c.blurb)}</p><span class="count">${n} 款产品</span>${thumbImg(pid)}
  </button>`;
}).join('');
$$('#bento .tile').forEach((el, i) => { el.style.transitionDelay = `${i * 50}ms`; io.observe(el); });
$('#bento').addEventListener('click', (e) => {
  const t = e.target.closest('.tile');
  if (!t) return;
  setCat(t.dataset.cat);
  $('#lineup').scrollIntoView({ behavior: 'smooth' });
});

/* ───────────── 工具栏 ───────────── */
const seg = $('#seg');
seg.insertAdjacentHTML('beforeend', [{ id: 'all', en: '全部' }, ...CATEGORIES].map((c) =>
  `<button role="tab" data-cat="${c.id}" aria-selected="${c.id === 'all'}">${esc(c.en === 'Apple Watch' ? 'Watch' : c.en === 'Vision Pro' ? 'Vision' : c.en === 'Home' ? '家居' : c.en)}</button>`).join(''));
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
function budgetLabel() {
  const v = +budget.value;
  state.max = v >= 30000 ? Infinity : v;
  $('#budgetVal').textContent = state.max === Infinity ? '不限' : fmt(v);
  budget.style.setProperty('--p', ((v - budget.min) / (budget.max - budget.min)) * 100 + '%');
}
budget.addEventListener('input', () => { budgetLabel(); renderGrid(); });
$('#sort').addEventListener('change', (e) => { state.sort = e.target.value; renderGrid(); });

const FEATURED = [
  ['多数人的 iPhone', 'iphone-17'], ['学生党 Mac', 'macbook-air'], ['尝鲜折叠', 'iphone-duo'],
  ['通勤降噪', 'airpods-pro-3'], ['记笔记画画', 'ipad-air'], ['户外长续航', 'watch-ultra-4'],
];
function renderPaths() {
  const list = state.cat === 'all' ? FEATURED : GUIDES[state.cat] || [];
  $('#paths').innerHTML = list.map(([label, id], i) =>
    `<button class="path" data-open="${id}" style="--i:${i}">${esc(label)} <b>${esc(byId[id].name)}</b></button>`).join('');
}

/* ───────────── 产品网格 ───────────── */
const order = Object.fromEntries(PRODUCTS.map((p, i) => [p.id, i]));
const relScore = (p) => parseInt(p.release, 10) * 12 + (parseInt(p.release.split('年')[1], 10) || 6);

function filtered() {
  let list = PRODUCTS.filter((p) => (state.cat === 'all' || p.cat === state.cat) && (p.price == null ? state.max === Infinity : p.price <= state.max));
  const pv = (p) => p.price ?? 1e9;
  if (state.sort === 'asc') list.sort((a, b) => pv(a) - pv(b));
  else if (state.sort === 'desc') list.sort((a, b) => (b.price ?? -1) - (a.price ?? -1));
  else if (state.sort === 'new') list.sort((a, b) => relScore(b) - relScore(a) || order[a.id] - order[b.id]);
  return list;
}

function cardHTML(p, i) {
  const inCmp = state.compare.includes(p.id);
  return `<article class="card" data-id="${p.id}" style="--i:${i};--c:${p.colors[0].hex}" tabindex="0" aria-label="${esc(p.name)}，${p.price ? fmt(p.price) + ' 起' : esc(p.priceNote || '')}">
    <div class="card-media">
      ${p.badge ? `<span class="badge">${esc(p.badge)}</span>` : ''}
      <span class="badge-3d"><svg viewBox="0 0 24 24" width="12" height="12"><path d="M12 2 3 7v10l9 5 9-5V7z M3 7l9 5 9-5 M12 12v10" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>3D 查看</span>
      ${thumbImg(p.id)}<div class="skeleton"></div>
    </div>
    <div class="card-body">
      <span class="card-cat">${esc(catName(p.cat))}</span>
      <h3>${esc(p.name)}</h3>
      <p>${esc(p.tagline)}</p>
      <div class="dots" aria-label="${p.colors.length} 种配色">${p.colors.slice(0, 7).map((c) => `<i style="--d:${c.hex}" title="${esc(c.name)}"></i>`).join('')}</div>
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
  if (card) openDetail(card.dataset.id);
});
grid.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.classList.contains('card')) openDetail(e.target.dataset.id);
});
// 卡片光斑与轻微倾斜
const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
if (fine) {
  grid.addEventListener('pointermove', (e) => {
    const card = e.target.closest('.card');
    if (!card) return;
    const r = card.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
    card.style.setProperty('--mx', x * 100 + '%');
    card.style.setProperty('--my', y * 100 + '%');
    card.style.transform = `perspective(900px) rotateX(${(0.5 - y) * 4}deg) rotateY(${(x - 0.5) * 5}deg) translateY(-4px)`;
  });
  grid.addEventListener('pointerout', (e) => {
    const card = e.target.closest('.card');
    if (card && !card.contains(e.relatedTarget)) card.style.transform = '';
  });
}

document.addEventListener('click', (e) => {
  const o = e.target.closest('[data-open]');
  if (o) { e.preventDefault(); openDetail(o.dataset.open); }
});

/* ───────────── 对比 ───────────── */
function toggleCompare(id, force) {
  const has = state.compare.includes(id);
  const want = force ?? !has;
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
  $$('[data-cmp]').forEach((b) => { const on = state.compare.includes(b.dataset.cmp); b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
  const tray = $('#tray');
  tray.hidden = state.compare.length === 0;
  $('#trayItems').innerHTML = state.compare.map((id) => `<button class="tray-item" data-rm="${id}" title="移除 ${esc(byId[id].name)}">${thumbImg(id)}</button>`).join('')
    + Array(3 - state.compare.length).fill('<span class="tray-slot"></span>').join('');
  $('#trayGo').disabled = state.compare.length < 2;
  $('#trayGo').style.opacity = state.compare.length < 2 ? 0.45 : 1;
  if (current) syncDetailCompare();
  if (!$('#compare').hidden) renderCompare();
}
$('#trayItems').addEventListener('click', (e) => { const b = e.target.closest('[data-rm]'); if (b) toggleCompare(b.dataset.rm, false); });
$('#trayClear').addEventListener('click', () => { state.compare = []; store.set('gx-compare', []); syncCompare(); });
$('#trayGo').addEventListener('click', () => { if (state.compare.length >= 2) openCompare(); else toast('再选一款就能对比了'); });

function openCompare() {
  renderCompare();
  openLayer($('#compare'));
}
$('#diffOnly').addEventListener('change', renderCompare);
function renderCompare() {
  const ps = state.compare.map((id) => byId[id]);
  if (ps.length < 2) { closeLayer($('#compare')); return; }
  const keys = [];
  ps.forEach((p) => Object.keys(p.specs).forEach((k) => { if (!keys.includes(k)) keys.push(k); }));
  const priced = ps.filter((p) => p.price != null);
  const minP = priced.length > 1 ? Math.min(...priced.map((p) => p.price)) : null;
  const diffOnly = $('#diffOnly').checked;
  const row = (label, vals) => {
    const same = vals.every((v) => v === vals[0]);
    if (diffOnly && same) return '';
    return `<tr class="${same ? 'same' : ''}"><td>${esc(label)}</td>${vals.map((v) => `<td>${v}</td>`).join('')}</tr>`;
  };
  $('#cmpTable').innerHTML = `
    <thead><tr><th></th>${ps.map((p) => `<th>${thumbImg(p.id)}<h3>${esc(p.name)}</h3><button class="rm" data-rmc="${p.id}">移除</button></th>`).join('')}</tr></thead>
    <tbody>
      ${row('品类', ps.map((p) => esc(catName(p.cat))))}
      ${row('起售价', ps.map((p) => (p.price != null ? fmt(p.price) + (p.price === minP ? '<span class="best">最低</span>' : '') : esc(p.priceNote || '待核实'))))}
      ${row('发布', ps.map((p) => esc(p.release)))}
      ${keys.map((k) => row(k, ps.map((p) => esc(p.specs[k] ?? '—')))).join('')}
      ${row('亮点', ps.map((p) => p.highlights.map(esc).join('<br>')))}
      ${row('适合', ps.map((p) => esc(p.forWho)))}
      ${row('配色', ps.map((p) => p.colors.map((c) => esc(c.name)).join('、')))}
    </tbody>`;
}
$('#cmpTable').addEventListener('click', (e) => { const b = e.target.closest('[data-rmc]'); if (b) toggleCompare(b.dataset.rmc, false); });

/* ───────────── 图层管理 ───────────── */
const layers = [];
function openLayer(el) {
  if (!el.hidden) return;
  el.hidden = false;
  layers.push(el);
  document.body.classList.add('locked');
}
function closeLayer(el) {
  if (el.hidden) return;
  const i = layers.indexOf(el);
  if (i >= 0) layers.splice(i, 1);
  el.hidden = true;
  if (!layers.length) document.body.classList.remove('locked');
}
$$('.sheet, .modal, .palette').forEach((el) => el.addEventListener('click', (e) => {
  if (e.target.closest('[data-close]')) (el.id === 'detail' ? closeDetail() : closeLayer(el));
}));

/* ───────────── 详情 ───────────── */
let viewer = null;
let current = null;
let model = null;

async function openDetail(id, { push = true } = {}) {
  const p = byId[id];
  if (!p) return;
  const sheet = $('#detail');
  const wasOpen = !sheet.hidden;
  current = p;
  openLayer(sheet);
  sheet.classList.remove('closing');
  if (push && location.hash !== '#/' + id) history.replaceState(null, '', '#/' + id);
  fillInfo(p, p.colors[0]);
  if (wasOpen) $('#info').scrollTo({ top: 0 });
  $('#stageLoading').classList.remove('done');
  if (!THREE_OK) { showNoGL(); return; }
  try {
    const mod = await loadViewer();
    if (current !== p) return;
    if (!viewer) {
      viewer = new mod.Viewer($('#viewer'));
      viewer.onInteract = () => $('#stageHint').classList.add('hide');
    }
    model = viewer.show(p, p.colors[0].hex);
    viewer.setAutoRotate($('#spin').classList.contains('on'));
    renderActions();
    $$('#views button').forEach((b) => b.classList.toggle('on', b.dataset.view === 'home'));
    requestAnimationFrame(() => $('#stageLoading').classList.add('done'));
  } catch (err) {
    console.error(err);
    THREE_OK = false;
    showNoGL();
  }
}

function showNoGL() {
  $('#stageLoading').classList.add('done');
  $('#viewer').innerHTML = `<div style="position:absolute;inset:0;display:grid;place-items:center;text-align:center;padding:24px;color:var(--muted)">
    <div>${state.thumbs[current.id] ? `<img src="${state.thumbs[current.id]}" style="max-width:420px;width:80%;margin:0 auto 12px">` : ''}你的浏览器暂不支持 WebGL，无法显示 3D 模型。</div></div>`;
}

function fillInfo(p, color) {
  $('#stageBg').style.setProperty('--c', color.hex);
  $('#dCat').textContent = catName(p.cat) + (p.badge ? ' · ' + p.badge : '');
  $('#dName').textContent = p.name;
  $('#dTag').textContent = p.tagline;
  $('#dPrice').innerHTML = p.price != null ? `${fmt(p.price)}<small>起</small>` : `<small style="margin:0">${esc(p.priceNote || '价格待核实')}</small>`;
  $('#dRelease').textContent = `发布于 ${p.release} · 国行参考价`;
  $('#dColors').innerHTML = p.colors.map((c, i) =>
    `<button class="swatch ${c === color ? 'on' : ''}" role="radio" aria-checked="${c === color}" aria-label="${esc(c.name)}" title="${esc(c.name)}" data-ci="${i}" style="--s:${c.hex}"></button>`).join('');
  $('#dColorName').textContent = color.name;
  $('#dHighlights').innerHTML = p.highlights.map((h) => `<li>${esc(h)}</li>`).join('');
  $('#dSpecs').innerHTML = Object.entries(p.specs).map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('');
  $('#dFor').textContent = p.forWho;
  $('#dNot').textContent = p.notFor;
  $('#dLink').href = OFFICIAL[p.cat];
  const sibs = PRODUCTS.filter((x) => x.cat === p.cat);
  $('#dSiblings').innerHTML = sibs.map((x) => `<button class="sib ${x === p ? 'on' : ''}" data-sib="${x.id}">${thumbImg(x.id)}<span>${esc(x.name)}</span></button>`).join('');
  const sl = $('#dSiblings'), so = $('.on', sl);
  if (so) sl.scrollLeft = so.offsetLeft - sl.clientWidth / 2 + so.offsetWidth / 2;
  syncDetailCompare();
}
function syncDetailCompare() {
  const b = $('#dCompare');
  const on = state.compare.includes(current.id);
  b.textContent = on ? '✓ 已在对比中' : '加入对比';
  b.classList.toggle('added', on);
}

function renderActions() {
  const box = $('#actions');
  const acts = model?.actions || [];
  box.innerHTML = acts.map((a, i) => `<button class="chip-btn ${a.on ? 'on' : ''}" data-act="${i}" aria-pressed="${a.on}">${esc(a.label)}</button>`).join('');
  box.previousElementSibling.hidden = false;
}

$('#dColors').addEventListener('click', (e) => {
  const b = e.target.closest('[data-ci]');
  if (!b || !current) return;
  const c = current.colors[+b.dataset.ci];
  model?.setColor(c.hex);
  $$('#dColors .swatch').forEach((s) => { s.classList.toggle('on', s === b); s.setAttribute('aria-checked', s === b); });
  $('#dColorName').textContent = c.name;
  $('#stageBg').style.setProperty('--c', c.hex);
});
$('#actions').addEventListener('click', (e) => {
  const b = e.target.closest('[data-act]');
  if (!b || !model) return;
  const a = model.actions[+b.dataset.act];
  a.on = !a.on;
  a.run(a.on);
  b.classList.toggle('on', a.on);
  b.setAttribute('aria-pressed', a.on);
});
$('#views').addEventListener('click', (e) => {
  const b = e.target.closest('[data-view]');
  if (!b || !viewer) return;
  viewer.look(b.dataset.view);
  $$('#views button').forEach((x) => x.classList.toggle('on', x === b));
  $('#spin').classList.remove('on');
  $('#spin').setAttribute('aria-pressed', 'false');
});
$('#spin').addEventListener('click', (e) => {
  const b = e.currentTarget;
  const on = !b.classList.contains('on');
  b.classList.toggle('on', on);
  b.setAttribute('aria-pressed', on);
  viewer?.setAutoRotate(on);
});
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
  setTimeout(() => {
    closeLayer(sheet);
    sheet.classList.remove('closing');
    viewer?.stop();
    viewer?.clear();
    model = null;
    current = null;
  }, 300);
  history.replaceState(null, '', location.pathname + location.search);
}

/* ───────────── 帮我选 ───────────── */
const quiz = { step: 0, cat: null, budget: null, pri: [] };
const BUDGETS = [
  { v: 2000, label: '2000 元以内', sub: '耳机、手表、音箱' },
  { v: 5000, label: '5000 元以内', sub: '入门手机、iPad' },
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
      <div class="opts">${[...CATEGORIES.map((c) => ({ id: c.id, label: c.en, sub: c.blurb })), { id: 'any', label: '都看看', sub: '全品类里帮我挑' }]
        .map((o, i) => `<button class="opt ${quiz.cat === o.id ? 'on' : ''}" data-q="cat" data-v="${o.id}" style="--i:${i}">${esc(o.label)}<small>${esc(o.sub)}</small></button>`).join('')}</div>`;
  } else if (quiz.step === 1) {
    el.innerHTML = `${steps}<h3 class="q-title">预算大概多少？</h3><p class="q-sub">按国行起售价计算，不含教育优惠和国家补贴。</p>
      <div class="opts">${BUDGETS.map((b, i) => `<button class="opt ${quiz.budget === b.v ? 'on' : ''}" data-q="budget" data-v="${b.v}" style="--i:${i}">${b.label}<small>${b.sub}</small></button>`).join('')}</div>
      <div class="q-nav"><button class="btn btn-ghost btn-small" data-q="back">← 上一步</button><span></span></div>`;
  } else if (quiz.step === 2) {
    el.innerHTML = `${steps}<h3 class="q-title">最看重什么？</h3><p class="q-sub">最多选三项。</p>
      <div class="opts">${PRIORITIES.map((p, i) => `<button class="opt ${quiz.pri.includes(p.id) ? 'on' : ''}" data-q="pri" data-v="${p.id}" style="--i:${i}">${esc(p.name)}</button>`).join('')}</div>
      <div class="q-nav"><button class="btn btn-ghost btn-small" data-q="back">← 上一步</button><button class="btn btn-primary btn-small" data-q="go" ${quiz.pri.length ? '' : 'disabled style="opacity:.45"'}>查看推荐</button></div>`;
  } else {
    const res = recommend();
    el.innerHTML = `${steps}<h3 class="q-title">为你挑选的结果</h3><p class="q-sub">点开可以 3D 查看并加入对比。</p>
      ${res.length ? `<div class="results">${res.map((r, i) => `<button class="result" data-open="${r.p.id}" style="--i:${i}">
        <span class="rank">No.${i + 1}</span>${thumbImg(r.p.id)}
        <div><h4>${esc(r.p.name)}</h4><span class="muted small">${r.p.price != null ? fmt(r.p.price) + ' 起' : esc(r.p.priceNote)}</span></div>
        <div class="match"><span>匹配度 ${r.pct}%</span><span class="bar"><i style="--w:${r.pct}%"></i></span></div>
        <ul class="reasons">${r.why.map((w) => `<li>${esc(w)}</li>`).join('')}</ul>
      </button>`).join('')}</div>` : '<p class="muted">这个预算下没有找到合适的产品，试试放宽预算或换个品类。</p>'}
      <div class="q-nav"><button class="btn btn-ghost btn-small" data-q="back">← 修改偏好</button><button class="btn btn-glass btn-small" data-q="reset">重新开始</button></div>`;
  }
}
function recommend() {
  const pool = PRODUCTS.filter((p) => quiz.cat === 'any' || p.cat === quiz.cat);
  const B = quiz.budget;
  const out = [];
  for (const p of pool) {
    if (p.price != null && B !== Infinity && p.price > B * 1.08) continue;
    const why = [];
    let s = 0, prio = 0;
    for (const k of quiz.pri) {
      const v = p.tags[k] || 0;
      s += v;
      prio += v;
      if (v >= 2) why.push(`${PRIORITIES.find((x) => x.id === k).name}是它的强项`);
    }
    if (p.price != null && B !== Infinity) {
      const use = p.price / B;
      s += use <= 1 ? 1 + use * 0.6 : 0.4;
      why.unshift(use <= 1 ? `在预算内（${fmt(p.price)} 起）` : '略超预算，但值得考虑');
    } else if (p.price == null) {
      s -= 0.6;
    } else {
      s += p.price / 30000;
    }
    out.push({ p, s, prio, why: why.slice(0, 3) });
  }
  out.sort((a, b) => b.s - a.s);
  const hits = out.filter((r) => r.prio > 0);
  const pick = hits.length ? hits : out;
  const maxS = quiz.pri.length * 3 + 1.6;
  return pick.slice(0, 3).map((r, i) => ({
    ...r,
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
    if (quiz.pri.includes(v)) quiz.pri = quiz.pri.filter((x) => x !== v);
    else if (quiz.pri.length < 3) quiz.pri.push(v);
    else toast('最多选择三项');
  }
  else if (q === 'go') { if (quiz.pri.length) quiz.step = 3; }
  else if (q === 'back') quiz.step = Math.max(0, quiz.step - 1);
  else if (q === 'reset') Object.assign(quiz, { step: 0, cat: null, budget: null, pri: [] });
  renderQuiz();
});

/* ───────────── 攻略 ───────────── */
const TIPS = [
  ['#30d158', '<path d="M3 10 12 5l9 5-9 5z M7 12v4c3 2 7 2 10 0v-4" />', '教育优惠', '在校大学生、新生和教职工可以在 Apple 教育商店购买 Mac 与 iPad，通常比标准零售价便宜，返校季还可能有额外礼遇。'],
  ['#2997ff', '<path d="M12 3v18M7 7h7a3 3 0 0 1 0 6H9a3 3 0 0 0 0 6h8" />', '国家补贴', '符合条件的手机、平板、手表和耳机可以享受以旧换新或数码产品购新补贴，实际到手价经常比官网低不少。各地政策不同，下单前查一下当地规则。'],
  ['#ff9f0a', '<path d="M4 12a8 8 0 0 1 14-5.3M20 12a8 8 0 0 1-14 5.3M18 3v4h-4M6 21v-4h4" />', '以旧换新', '官网和 Apple Store 可以把旧设备折抵为新机款，流程省心，但折抵价每隔一段时间会调整，可以和二手平台的回收价对比一下。'],
  ['#a78bfa', '<rect x="4" y="4" width="16" height="16" rx="3" /><path d="M8 9h8M8 13h8M8 17h5" />', '存储怎么选', '拍 4K 视频、存大量照片，手机建议 512GB 起。只是日常使用，256GB 起步已经够用。iCloud 只能缓解，不能完全替代本地空间。'],
  ['#ff7ab6', '<rect x="3" y="7" width="18" height="10" rx="2" /><path d="M7 7V5M11 7V5M15 7V5M19 7V5M7 19v-2M11 19v-2M15 19v-2" />', 'Mac 内存怎么选', 'Mac 的内存买了就不能升级。写代码、剪视频或跑本地模型，建议一步到位选更大的统一内存，它比加大硬盘更影响使用寿命。'],
  ['#5ac8fa', '<path d="M12 3 5 6v6c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6z" /><path d="m9 12 2 2 4-4" />', 'AppleCare+', '折叠屏、Vision Pro 这类维修成本高的设备，或者经常带出门的笔记本，可以考虑买 AppleCare+。也可以先看看信用卡或运营商的碎屏保障。'],
  ['#ffd60a', '<circle cx="12" cy="12" r="8" /><path d="M12 8v4l3 2" />', '什么时候买', '新品通常在秋季（9 月前后）和春季发布。临近发布时，旧款常有渠道降价，但官网很少直降。电商大促（618、双 11）往往是全年低价点。'],
  ['#64d2ff', '<path d="M4 7h16l-1.5 11a2 2 0 0 1-2 1.7h-9a2 2 0 0 1-2-1.7z M9 7V5a3 3 0 0 1 6 0v2" />', '官翻与授权店', 'Apple 官方翻新产品经过检测并更换外壳和电池，享受一年保修。授权经销商和电商自营也是正规渠道，价格更灵活，购买时注意保留发票。'],
];
$('#tipsGrid').innerHTML = TIPS.map(([c, svg, h, p], i) => `<article class="tip reveal" style="--c:${c};transition-delay:${(i % 4) * 60}ms">
  <div class="ic"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${svg}</svg></div>
  <h3>${h}</h3><p>${p}</p></article>`).join('');
$$('#tipsGrid .reveal').forEach((el) => io.observe(el));

/* ───────────── 搜索 ───────────── */
const qInput = $('#q');
let qSel = 0;
function searchIndex(p) {
  return [p.name, p.cat, catName(p.cat), p.badge, p.tagline, ...p.highlights, ...Object.values(p.specs), p.forWho].join(' ').toLowerCase();
}
const IDX = Object.fromEntries(PRODUCTS.map((p) => [p.id, searchIndex(p)]));
function renderSearch() {
  const terms = qInput.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const list = PRODUCTS.filter((p) => terms.every((t) => IDX[p.id].includes(t)));
  qSel = Math.min(qSel, Math.max(list.length - 1, 0));
  $('#qList').innerHTML = list.length ? list.map((p, i) => `<li role="option" class="${i === qSel ? 'on' : ''}" data-open="${p.id}" aria-selected="${i === qSel}">
    ${state.thumbs[p.id] ? thumbImg(p.id) : '<span class="ph"></span>'}
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
    $('#qList li.on')?.scrollIntoView({ block: 'nearest' });
  } else if (e.key === 'Enter' && items[qSel]) {
    closeLayer($('#search'));
    openDetail(items[qSel].dataset.open);
  }
});
$('#qList').addEventListener('click', (e) => { if (e.target.closest('[data-open]')) closeLayer($('#search')); }, true);

document.addEventListener('keydown', (e) => {
  const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName);
  if (e.key === 'Escape') {
    const top = layers[layers.length - 1];
    if (top) (top.id === 'detail' ? closeDetail() : closeLayer(top));
    return;
  }
  if (!typing && (e.key === '/' || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k'))) { e.preventDefault(); openSearch(); return; }
  if (!$('#detail').hidden && layers[layers.length - 1]?.id === 'detail' && !typing) {
    if (e.key === 'ArrowLeft') step(-1);
    if (e.key === 'ArrowRight') step(1);
  }
});

/* ───────────── 路由 ───────────── */
function route() {
  const m = location.hash.match(/^#\/([\w-]+)$/);
  if (m && byId[m[1]]) openDetail(m[1], { push: false });
}
addEventListener('hashchange', route);

/* ───────────── 英雄区与 3D 初始化 ───────────── */
function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch { return false; }
}

async function init3D() {
  const duo = byId['iphone-duo'];
  const sw = $('#heroSwatches');
  sw.innerHTML = duo.colors.map((c, i) => `<button class="swatch ${i ? '' : 'on'}" role="radio" aria-checked="${!i}" aria-label="${esc(c.name)}" title="${esc(c.name)}" data-hc="${c.hex}" style="--s:${c.hex}"></button>`).join('');
  if (!webglAvailable()) {
    THREE_OK = false;
    $('#heroStage').innerHTML = '<p class="muted" style="position:absolute;inset:0;display:grid;place-items:center">当前浏览器不支持 WebGL，3D 展示不可用。</p>';
    return;
  }
  try {
    const mod = await loadViewer();
    const hero = new mod.HeroStage($('#heroStage'), duo);
    sw.addEventListener('click', (e) => {
      const b = e.target.closest('[data-hc]');
      if (!b) return;
      hero.setColor(b.dataset.hc);
      $$('.swatch', sw).forEach((s) => { s.classList.toggle('on', s === b); s.setAttribute('aria-checked', s === b); });
    });
    // 先渲染首屏可见的，再渲染其他
    const first = ['iphone-18-pro', 'macbook-air', 'ipad-pro', 'watch-ultra-4', 'airpods-pro-3', 'vision-pro', 'homepod-mini'];
    const queue = [...first.map((id) => byId[id]), ...PRODUCTS.filter((p) => !first.includes(p.id))];
    await mod.renderThumbnails(queue, applyThumb);
  } catch (err) {
    console.error(err);
    THREE_OK = false;
  }
}

/* ───────────── 启动 ───────────── */
budgetLabel();
setCat('all');
renderQuiz();
syncCompare();
requestAnimationFrame(movePill);
document.fonts?.ready.then(movePill);
init3D();
route();
