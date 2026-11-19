const $ = id => document.getElementById(id);
const models = ['macbook-air','macbook-pro','mac-mini','macbook-neo','imac','mac-studio','macbook-pro-proled-xdr'].map(id => catalog.find(item => item.id === id));
const price = item => '¥' + item.price.toLocaleString('zh-CN');
let category = '全部机型';
function renderCards() {
  const results = models.filter(item => category === '全部机型' || category === item.type);
  const order = $('sort').value;
  if (order !== 'default') results.sort((a,b) => order === 'asc' ? a.price-b.price : b.price-a.price);
  $('cards').innerHTML = results.map(item => `<button class="card" data-id="${item.id}"><span class="photo"><img src="${item.image}" alt=""><span class="type">${item.type}</span></span><span class="info"><span class="chip">${item.chip}</span><strong class="modelname">${item.name}</strong><span class="quick">${specs[item.id].memory} 内存 · ${specs[item.id].storage} 存储</span><span class="bottom"><span class="cost">${price(item)} <small>起</small></span><span class="more">选购建议</span></span></span></button>`).join('');
}
document.querySelector('.filters').onclick = event => {
  if (!event.target.matches('button')) return;
  category = event.target.textContent;
  for (const button of event.currentTarget.children) button.setAttribute('aria-pressed',button.textContent === category);
  renderCards();
};
$('sort').onchange = renderCards;
const advice = {
  'macbook-neo': '适合文档、课程和浏览器作业。若每天同时开开发工具、视频会议和大量标签页，优先看看 Air 的内存，再决定是否加预算。',
  'macbook-air': '先按每天携带的距离选尺寸。经常同时运行开发工具和修图软件，优先留内存预算；照片可以归档到外置盘。持续导出长视频时再考虑 Pro。',
  'macbook-pro': '经常在外完成长时间编译、视频导出，主动散热更有价值。先按工程内存占用选容量；高分辨率特效和多机位剪辑再比较更高档芯片。',
  'macbook-pro-proled-xdr': '溢价优先给经常在机身屏幕上审看 HDR 素材的人。主要接外置参考屏，可先比较普通 Pro，把预算留给内存与项目盘。',
  'imac': '适合需要一次配齐屏幕与主机的固定工位。先确认 24 英寸适合桌面距离；已有满意的显示器，可比较 mini 的整套成本。',
  'mac-mini': '适合已有显示器和键鼠的桌面。把缺少的屏幕、摄像头和输入设备计入预算；从零搭桌面时再与 iMac 比总价。',
  'mac-studio': '持续渲染、复杂特效和大型工程更能用上这档性能。用手头最重的工程估内存和素材盘空间，同时为外接显示器预留预算。'
};
function showDetails(item) {
  const config = specs[item.id];
  $('content').innerHTML = `<h2 id="dialog-title">${item.name}</h2><p class="leadprice">${price(item)} 起</p><h3>起步配置</h3><dl class="facts">${[['芯片',config.chip],['统一内存',config.memory],['固态硬盘',config.storage],['显示屏',config.screen]].map(([label,value])=>`<dt>${label}</dt><dd>${value}</dd>`).join('')}</dl><h3>适合谁</h3><p>${item.description}</p><h3>预算怎么分配</h3><p>${advice[item.id]}</p><p class="source">价格与起步配置核对于 2026.11.19 · <a href="${item.url}" target="_blank" rel="noopener">数据来源</a></p>`;
  $('dialog').showModal();
}
$('cards').onclick = event => {
  const card = event.target.closest('[data-id]');
  if (card) showDetails(models.find(item => item.id === card.dataset.id));
};
const routes = {
  study:['macbook-neo'], travel:['macbook-air','macbook-neo'], pro:['macbook-pro'], hdr:['macbook-pro-proled-xdr','macbook-pro'],
  desk:['mac-mini'], all:['imac'], studio:['mac-studio','mac-mini']
};
function recommend() {
  const budget = $('budget').valueAsNumber;
  if (!Number.isFinite(budget) || budget < 0) {
    $('match').textContent = '请输入有效的预算金额。'; return;
  }
  const candidates = routes[$('use').value].map(id => models.find(item => item.id === id));
  const pick = candidates.find(item => item.price <= budget);
  if (!pick) {
    const lowest = candidates[candidates.length-1];
    $('match').textContent = `这个用途下，建议从 ${lowest.name} 看起，起价 ${price(lowest)}，距预算还差 ¥${(lowest.price-budget).toLocaleString('zh-CN')}。也可以切换用途，比较其他机型。`;
    return;
  }
  const tradeoff = {travel:'预算内可选 Neo。它更适合文档和轻量任务，多任务开发建议优先考虑 Air。',hdr:'预算内可选普通 Pro；若需要 PROLED XDR 版本，需提高预算。',studio:'预算内可选 mini；起价对应入门配置，重型工程需重新核算内存与芯片升级费用。'};
  $('match').innerHTML = `<strong>${pick.name} <span>${price(pick)} 起</span></strong><p>${pick === candidates[0] ? advice[pick.id] : tradeoff[$('use').value]}</p><button class="textbtn">查看起步配置</button>`;
  $('match').querySelector('button').onclick = () => showDetails(pick);
}
$('use').onchange = recommend;
$('budget').oninput = recommend;
recommend();
const selections = [0,1];
function renderComparison() {
  const pair = selections.map(i => models[i]);
  const fields = [
    ['国区起售价',item => price(item)], ['起步芯片',item => specs[item.id].chip],
    ['统一内存',item => specs[item.id].memory], ['固态硬盘',item => specs[item.id].storage],
    ['显示屏',item => specs[item.id].screen], ['适用场景',item => item.description],
    ['购买取舍',item => advice[item.id]]
  ];
  const heads = pair.map((item,col) => `<th scope="col"><select aria-label="第 ${col+1} 款机型" data-column="${col}">${models.map((m,i)=>`<option value="${i}" ${i===selections[col]?'selected':''} ${i===selections[1-col]?'disabled':''}>${m.name}</option>`).join('')}</select><img src="${item.image}" alt=""><span>${item.name}</span></th>`).join('');
  const rows = fields.map(([label,get])=>`<tr><th scope="row">${label}</th>${pair.map(item=>`<td>${get(item)}</td>`).join('')}</tr>`).join('');
  $('content').innerHTML = `<h2 id="dialog-title">机型对比</h2><table><thead><tr><td></td>${heads}</tr></thead><tbody>${rows}</tbody></table>`;
}
$('compare').onclick = () => { renderComparison(); $('dialog').showModal(); };
$('content').onchange = event => {
  const column = Number(event.target.dataset.column);
  selections[column] = Number(event.target.value);
  renderComparison();
  document.querySelector(`[data-column="${column}"]`).focus();
};
$('close').onclick = () => $('dialog').close();
$('dialog').onclick = event => { if (event.target === $('dialog') && !event.target.contains(document.elementFromPoint(event.clientX,event.clientY))) $('dialog').close(); };
const featured = [models[0],models[1],models[4]];
let current = 0;
function slide(direction) {
  current = (current + direction + featured.length) % featured.length;
  const item = featured[current];
  $('heroimg').src = 'assets/hero-' + item.id + '.webp';
  $('heroimg').alt = $('feature').textContent = item.name;
  $('count').textContent = '0' + (current+1) + ' / 03';
}
$('prev').onclick = () => slide(-1);
$('next').onclick = () => slide(1);
renderCards();
