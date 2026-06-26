// Popup = your comment cockpit.
//  • theme chips open Threads search for that topic in the active tab
//  • "Показать подходящие" pulls relevant threads from the open Threads page
//  • per thread: generate a comment, then drop it into the native reply box
//  • manual box at the bottom for pasting any post
// Nothing is auto-published — you press Опублікувати in Threads yourself.

const $ = (id) => document.getElementById(id);

const THEMES = [
  { k: 'SEO',        q: 'SEO просування сайту' },
  { k: 'WooCommerce',q: 'woocommerce магазин товари' },
  { k: 'WordPress',  q: 'wordpress сайт' },
  { k: 'Стартапи',   q: 'стартап засновник продукт' },
  { k: 'Додатки',    q: 'розробка мобільного застосунку' },
  { k: 'Дети',       q: 'виховання дітей завдання винагорода' },
  { k: 'AI',         q: 'штучний інтелект автоматизація' }
];

$('settings').addEventListener('click', () => chrome.runtime.openOptionsPage());

// ---------- tab helpers ----------
function activeTab() {
  return new Promise(res => chrome.tabs.query({ active: true, currentWindow: true }, t => res(t && t[0])));
}
function isThreads(tab) { return tab && /https:\/\/www\.threads\.(com|net)\//.test(tab.url || ''); }
function tabSend(tabId, msg) {
  return new Promise(res => {
    try { chrome.tabs.sendMessage(tabId, msg, r => { if (chrome.runtime.lastError) res(null); else res(r); }); }
    catch (e) { res(null); }
  });
}
function bgDraft(text, author) {
  return new Promise(res => {
    try { chrome.runtime.sendMessage({ type: 'draft', text, author: author || '' }, r => { if (chrome.runtime.lastError) res({ ok: false, error: chrome.runtime.lastError.message }); else res(r); }); }
    catch (e) { res({ ok: false, error: String(e.message || e) }); }
  });
}

// ---------- messages ----------
function setMsg(text, isErr) { const m = $('msg'); m.className = isErr ? 'err' : ''; m.textContent = text || ''; }
function settingsLink() {
  const m = $('msg'); m.className = 'err'; m.textContent = 'Не задан ключ OpenRouter. ';
  const a = document.createElement('span'); a.className = 'hintlink'; a.textContent = 'Открыть настройки';
  a.addEventListener('click', () => chrome.runtime.openOptionsPage()); m.appendChild(a);
}

// ---------- theme chips ----------
function buildThemes() {
  const wrap = $('themes');
  THEMES.forEach(t => {
    const b = document.createElement('button'); b.className = 'theme'; b.textContent = t.k;
    b.addEventListener('click', () => openSearch(t.q));
    wrap.appendChild(b);
  });
}
async function openSearch(q) {
  const url = 'https://www.threads.com/search?q=' + encodeURIComponent(q) + '&serp_type=default';
  const tab = await activeTab();
  if (isThreads(tab)) chrome.tabs.update(tab.id, { url });
  else chrome.tabs.create({ url });
  setMsg('Открыл поиск Threads. Подождите пару секунд, прокрутите ленту и нажмите «Показать подходящие».', false);
  $('list').innerHTML = '';
}

// ---------- suggestions from the page ----------
async function loadSuggestions() {
  $('scan').disabled = true; setMsg('⏳ Читаю страницу…', false); $('list').innerHTML = '';
  const tab = await activeTab();
  if (!isThreads(tab)) {
    $('scan').disabled = false;
    setMsg('', false);
    const m = $('msg'); m.className = ''; m.textContent = 'Откройте Threads, чтобы подобрать ветки. ';
    const a = document.createElement('span'); a.className = 'hintlink'; a.textContent = 'Открыть Threads';
    a.addEventListener('click', () => chrome.tabs.create({ url: 'https://www.threads.com/' }));
    m.appendChild(a);
    return;
  }
  const resp = await tabSend(tab.id, { type: 'tcaCollect' });
  $('scan').disabled = false;
  if (!resp) { setMsg('Не удалось прочитать страницу. Обновите вкладку Threads (она должна быть открыта и прокручена).', true); return; }
  const items = resp.items || [];
  if (!items.length) { setMsg('Подходящих веток на этой странице не нашлось. Прокрутите ленту/поиск по теме и повторите.', false); return; }
  setMsg(items.length + ' подходящих веток на странице:', false);
  items.forEach(p => $('list').appendChild(renderItem(tab.id, p)));
}

function renderItem(tabId, p) {
  const it = document.createElement('div'); it.className = 'it';
  const meta = document.createElement('div'); meta.className = 'it-meta';
  const chip = document.createElement('span'); chip.className = 'it-chip'; chip.textContent = p.top || 'тема';
  const au = document.createElement('span'); au.className = 'it-author'; au.textContent = '@' + (p.author || '—');
  meta.append(chip, au); it.appendChild(meta);
  const sn = document.createElement('div'); sn.className = 'it-sn'; sn.textContent = (p.text || '').slice(0, 180); it.appendChild(sn);

  const row = document.createElement('div'); row.className = 'row';
  const open = document.createElement('button'); open.className = 'act'; open.textContent = '↗ Открыть';
  open.addEventListener('click', () => tabSend(tabId, { type: 'tcaFocus', id: p.id }));
  const gen = document.createElement('button'); gen.className = 'act primary'; gen.textContent = '✨ Комментарий';
  gen.addEventListener('click', () => genItem(tabId, it, p, gen));
  const sp = document.createElement('span'); sp.className = 'sp';
  row.append(open, sp, gen); it.appendChild(row);
  return it;
}

async function genItem(tabId, it, p, gen) {
  let box = it.querySelector('.it-draft');
  if (!box) { box = document.createElement('div'); box.className = 'it-draft'; it.appendChild(box); }
  box.innerHTML = '<div class="status">⏳ Пишу комментарий…</div>';
  gen.disabled = true;
  const resp = await bgDraft(p.text, p.author);
  gen.disabled = false;
  box.innerHTML = '';
  if (!resp || !resp.ok) {
    if (resp && /ключ|key|openrouter/i.test(resp.error || '')) { box.innerHTML = '<div class="status err">Нет ключа OpenRouter — откройте ⚙</div>'; }
    else box.innerHTML = '<div class="status err">⚠️ ' + ((resp && resp.error) || 'нет ответа') + '</div>';
    return;
  }
  const ta = document.createElement('textarea'); ta.value = resp.draft; ta.rows = 4; box.appendChild(ta);
  const row = document.createElement('div'); row.className = 'row';
  const count = document.createElement('span'); count.className = 'count';
  const upd = () => count.textContent = [...ta.value].length + '/500';
  upd(); ta.addEventListener('input', upd);
  const sp = document.createElement('span'); sp.className = 'sp';
  const ins = document.createElement('button'); ins.className = 'act primary'; ins.textContent = '📨 Вставить в ответ';
  ins.addEventListener('click', async () => {
    ins.textContent = '⏳…';
    try { await navigator.clipboard.writeText(ta.value); } catch (e) {} // reliable fallback from the focused popup
    await tabSend(tabId, { type: 'tcaFocus', id: p.id });
    const r = await tabSend(tabId, { type: 'tcaInsert', id: p.id, text: ta.value });
    ins.textContent = (r && r.method === 'inserted') ? '✓ В Threads' : '📋 Готово — Cmd+V';
    setTimeout(() => (ins.textContent = '📨 Вставить в ответ'), 2600);
  });
  const copy = document.createElement('button'); copy.className = 'act'; copy.textContent = '📋';
  copy.addEventListener('click', () => navigator.clipboard.writeText(ta.value).then(() => { copy.textContent = '✓'; setTimeout(() => (copy.textContent = '📋'), 1200); }));
  const regen = document.createElement('button'); regen.className = 'act'; regen.textContent = '↻';
  regen.addEventListener('click', () => genItem(tabId, it, p, gen));
  row.append(count, sp, ins, copy, regen); box.appendChild(row);
}

// ---------- manual box ----------
function manualGenerate() {
  const text = $('input').value.trim();
  if (!text) { setMsg('Вставьте текст поста в поле ниже.', true); $('input').focus(); return; }
  const wrap = $('manualWrap');
  wrap.innerHTML = '<div class="status" style="margin-top:9px">⏳ Пишу комментарий…</div>';
  $('gen').disabled = true;
  bgDraft(text, '').then(resp => {
    $('gen').disabled = false; wrap.innerHTML = '';
    if (!resp || !resp.ok) {
      if (resp && /ключ|key|openrouter/i.test(resp.error || '')) settingsLink();
      else wrap.innerHTML = '<div class="status err" style="margin-top:9px">⚠️ ' + ((resp && resp.error) || 'нет ответа') + '</div>';
      return;
    }
    const ta = document.createElement('textarea'); ta.value = resp.draft; ta.rows = 4; ta.style.marginTop = '9px'; wrap.appendChild(ta);
    const row = document.createElement('div'); row.className = 'row';
    const count = document.createElement('span'); count.className = 'count'; count.textContent = [...ta.value].length + '/500';
    ta.addEventListener('input', () => count.textContent = [...ta.value].length + '/500');
    const sp = document.createElement('span'); sp.className = 'sp';
    const copy = document.createElement('button'); copy.className = 'act primary'; copy.textContent = '📋 Скопировать';
    copy.addEventListener('click', () => navigator.clipboard.writeText(ta.value).then(() => { copy.textContent = '✓ Скопировано'; setTimeout(() => (copy.textContent = '📋 Скопировать'), 1500); }));
    const regen = document.createElement('button'); regen.className = 'act'; regen.textContent = '↻ Ещё';
    regen.addEventListener('click', manualGenerate);
    row.append(count, sp, regen, copy); wrap.appendChild(row);
  });
}

// ---------- background search now ----------
function pollNow() {
  $('pollNow').disabled = true;
  setMsg('⏳ Ищу новые посты по вашим темам в фоне…', false);
  try {
    chrome.runtime.sendMessage({ type: 'pollNow' }, (r) => {
      $('pollNow').disabled = false;
      if (chrome.runtime.lastError || !r) { setMsg('Не удалось запустить поиск. Перезагрузите расширение.', true); return; }
      if (!r.ok) { setMsg(r.error === 'busy' ? 'Поиск уже идёт, подождите.' : 'Поиск выключен в настройках (⚙).', true); return; }
      if (r.found > 0) setMsg('🔔 Нашёл ' + r.found + ' новых по теме «' + r.label + '». Список ниже:', false);
      else setMsg('Новых по теме «' + r.label + '» сейчас нет. Темы чередуются. Раньше найденное — ниже:', false);
      renderFound();
    });
  } catch (e) { $('pollNow').disabled = false; setMsg('Ошибка: ' + (e.message || e), true); }
}

// Posts discovered by the background search (separate from what's on the page).
function relTime(ts) {
  if (!ts) return '';
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return 'только что';
  const m = Math.floor(s / 60); if (m < 60) return m + ' мин';
  const h = Math.floor(m / 60); if (h < 24) return h + ' ч';
  return Math.floor(h / 24) + ' дн';
}
function renderFound() {
  chrome.storage.local.get('tcaFound', (o) => {
    const items = (o.tcaFound || []).slice(0, 30);
    $('list').innerHTML = '';
    if (!items.length) return;
    const bar = document.createElement('div'); bar.className = 'found-bar';
    const cnt = document.createElement('span'); cnt.textContent = items.length + ' найдено в фоне';
    const clr = document.createElement('button'); clr.className = 'act'; clr.textContent = '🗑 Очистить';
    clr.addEventListener('click', () => chrome.storage.local.set({ tcaFound: [] }, () => { $('list').innerHTML = ''; setMsg('Список найденного очищен.', false); }));
    bar.append(cnt, clr); $('list').appendChild(bar);
    items.forEach(p => $('list').appendChild(foundItem(p)));
  });
}
function foundItem(p) {
  const it = document.createElement('div'); it.className = 'it';
  const meta = document.createElement('div'); meta.className = 'it-meta';
  const chip = document.createElement('span'); chip.className = 'it-chip' + (p.lead ? ' lead' : ''); chip.textContent = (p.lead ? '🎯 ' : '') + (p.label || p.top || 'тема');
  const au = document.createElement('span'); au.className = 'it-author'; au.textContent = '@' + (p.author || '—');
  const tm = document.createElement('span'); tm.className = 'it-time'; tm.textContent = relTime(p.ts);
  meta.append(chip, au, tm); it.appendChild(meta);
  const sn = document.createElement('div'); sn.className = 'it-sn'; sn.textContent = (p.text || '').slice(0, 180); it.appendChild(sn);
  const row = document.createElement('div'); row.className = 'row';
  const open = document.createElement('button'); open.className = 'act'; open.textContent = '↗ Открыть';
  open.addEventListener('click', () => chrome.tabs.create({ url: p.url || 'https://www.threads.com/' }));
  const gen = document.createElement('button'); gen.className = 'act primary'; gen.textContent = '✨ Черновик';
  gen.addEventListener('click', () => genFound(it, p, gen));
  const sp = document.createElement('span'); sp.className = 'sp';
  row.append(open, sp, gen); it.appendChild(row);
  return it;
}
function genFound(it, p, gen) {
  let box = it.querySelector('.it-draft');
  if (!box) { box = document.createElement('div'); box.className = 'it-draft'; it.appendChild(box); }
  box.innerHTML = '<div class="status">⏳ Пишу комментарий…</div>'; gen.disabled = true;
  bgDraft(p.text, p.author).then((resp) => {
    gen.disabled = false; box.innerHTML = '';
    if (!resp || !resp.ok) { box.innerHTML = '<div class="status err">⚠️ ' + ((resp && resp.error) || 'нет ответа') + '</div>'; return; }
    const ta = document.createElement('textarea'); ta.value = resp.draft; ta.rows = 4; box.appendChild(ta);
    const row = document.createElement('div'); row.className = 'row';
    const sp = document.createElement('span'); sp.className = 'sp';
    const openb = document.createElement('button'); openb.className = 'act primary'; openb.textContent = '↗ Открыть и вставить';
    openb.addEventListener('click', () => { navigator.clipboard.writeText(ta.value).catch(() => {}); chrome.tabs.create({ url: p.url || 'https://www.threads.com/' }); });
    const copy = document.createElement('button'); copy.className = 'act'; copy.textContent = '📋';
    copy.addEventListener('click', () => navigator.clipboard.writeText(ta.value).then(() => { copy.textContent = '✓'; setTimeout(() => (copy.textContent = '📋'), 1200); }));
    row.append(sp, openb, copy); box.appendChild(row);
  });
}

// ---------- write a post for my own feed ----------
function bgPost(topic) {
  return new Promise(res => {
    try { chrome.runtime.sendMessage({ type: 'draftPost', topic }, r => { if (chrome.runtime.lastError) res({ ok: false, error: chrome.runtime.lastError.message }); else res(r); }); }
    catch (e) { res({ ok: false, error: String(e.message || e) }); }
  });
}
function seedTopics() { return (typeof TCA_POST_TOPICS !== 'undefined') ? TCA_POST_TOPICS.slice() : []; }
function renderPostTopics(topics) {
  const wrap = $('postThemes'); wrap.innerHTML = '';
  topics.forEach(t => {
    const b = document.createElement('button'); b.className = 'theme'; b.textContent = t;
    b.addEventListener('click', () => genPost(t));
    wrap.appendChild(b);
  });
}
function suggestTopics() {
  const btn = $('suggestTopics'); const o = btn.textContent; btn.disabled = true; btn.textContent = '⏳ Подбираю темы…';
  try {
    chrome.runtime.sendMessage({ type: 'suggestTopics' }, (r) => {
      btn.disabled = false; btn.textContent = o;
      if (chrome.runtime.lastError || !r) { renderPostTopics(seedTopics()); return; }
      if (!r.ok) { if (/ключ|key|openrouter/i.test(r.error || '')) settingsLink(); renderPostTopics(seedTopics()); return; }
      renderPostTopics(r.topics && r.topics.length ? r.topics : seedTopics());
    });
  } catch (e) { btn.disabled = false; btn.textContent = o; renderPostTopics(seedTopics()); }
}
async function genPost(topic) {
  topic = (topic || $('postInput').value).trim();
  if (!topic) { $('postInput').focus(); return; }
  const wrap = $('postWrap');
  wrap.innerHTML = '<div class="status" style="margin-top:9px">⏳ Пишу пост…</div>';
  $('genPost').disabled = true;
  const resp = await bgPost(topic);
  $('genPost').disabled = false; wrap.innerHTML = '';
  if (!resp || !resp.ok) {
    if (resp && /ключ|key|openrouter/i.test(resp.error || '')) { wrap.innerHTML = '<div class="status err" style="margin-top:9px">Нет ключа OpenRouter — откройте ⚙</div>'; }
    else wrap.innerHTML = '<div class="status err" style="margin-top:9px">⚠️ ' + ((resp && resp.error) || 'нет ответа') + '</div>';
    return;
  }
  const ta = document.createElement('textarea'); ta.value = resp.draft; ta.rows = 6; ta.style.marginTop = '9px'; wrap.appendChild(ta);
  const row = document.createElement('div'); row.className = 'row';
  const count = document.createElement('span'); count.className = 'count'; count.textContent = [...ta.value].length + '/500';
  ta.addEventListener('input', () => count.textContent = [...ta.value].length + '/500');
  const sp = document.createElement('span'); sp.className = 'sp';
  const copy = document.createElement('button'); copy.className = 'act primary'; copy.textContent = '📋 Скопировать';
  copy.addEventListener('click', () => navigator.clipboard.writeText(ta.value).then(() => { copy.textContent = '✓ Скопировано'; setTimeout(() => (copy.textContent = '📋 Скопировать'), 1500); }));
  const regen = document.createElement('button'); regen.className = 'act'; regen.textContent = '↻ Ещё';
  regen.addEventListener('click', () => genPost(topic));
  row.append(count, sp, regen, copy); wrap.appendChild(row);
}

// ---------- wire up ----------
buildThemes();
$('scan').addEventListener('click', loadSuggestions);
$('pollNow').addEventListener('click', pollNow);
$('suggestTopics').addEventListener('click', suggestTopics);
$('genPost').addEventListener('click', () => genPost());
$('gen').addEventListener('click', manualGenerate);
$('input').addEventListener('keydown', (e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') manualGenerate(); });

// Auto-load suggestions if we're already on Threads.
activeTab().then(tab => { if (isThreads(tab)) loadSuggestions(); });
