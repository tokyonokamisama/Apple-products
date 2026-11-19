const $ = id => document.getElementById(id);
const models = ['macbook-air','macbook-pro','mac-mini','macbook-neo','imac','mac-studio','macbook-pro-proled-xdr'].map(id => catalog.find(item => item.id === id));
const price = item => '¥' + item.price.toLocaleString('zh-CN');
let category = '全部机型';
function renderCards() {
  const results = models.filter(item => category === '全部机型' || category === item.type);
  const order = $('sort').value;
  if (order !== 'default') results.sort((a,b) => order === 'asc' ? a.price-b.price : b.price-a.price);
  $('cards').innerHTML = results.map(item => `<button class="card" data-id="${item.id}"><span class="photo"><img src="${item.image}" alt=""><span class="type">${item.type}</span></span><span class="info"><span class="chip">${item.chip}</span><strong class="modelname">${item.name}</strong><span class="bottom"><span class="cost">${price(item)} <small>起</small></span><span class="more">选购建议</span></span></span></button>`).join('');
}
document.querySelector('.filters').onclick = event => {
  if (!event.target.matches('button')) return;
  category = event.target.textContent;
  for (const button of event.currentTarget.children) button.setAttribute('aria-pressed',button.textContent === category);
  renderCards();
};
$('sort').onchange = renderCards;
function details(item) {
  return `<p><strong>${price(item)} 起</strong> · ${item.chip}</p><p>${item.description}</p><a href="${item.url}" target="_blank" rel="noopener">在 Apple 官网查看配置</a>`;
}
$('cards').onclick = event => {
  const card = event.target.closest('button');
  if (!card) return;
  const item = models.find(model => model.id === card.dataset.id);
  $('content').innerHTML = `<div class="kicker">选购建议</div><h2>${item.name}</h2><img class="detailimg" src="${item.image}" alt="${item.name}">${details(item)}`;
  $('dialog').showModal();
};
const selections = [0,1];
function renderComparison() {
  $('content').innerHTML = '<h2>机型对比</h2><div class="comparegrid">' + selections.map((index,column) => {
    const item = models[index];
    return `<section><select aria-label="第 ${column+1} 款机型" data-column="${column}">${models.map((m,i)=>`<option value="${i}" ${i === index ? 'selected' : ''} ${i === selections[1-column] ? 'disabled' : ''}>${m.name}</option>`).join('')}</select><img src="${item.image}" alt="${item.name}"><strong>${item.name}</strong>${details(item)}</section>`;
  }).join('') + '</div>';
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
