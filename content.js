// Threads Comment Assistant — in-page layer.
//
//   • small green dot marks posts that match your topics (chip + ✍️ on hover)
//   • ✍️ → drafts a comment, opens the post's native reply box, drops it in
//   • floating 🧵 launcher: sidebar of suggestions (Тематические / Все) + topic search
//   • posts you already commented on are hidden; your own threads are excluded
//   • when new matching posts appear, the 🧵 pulses and an in-page note shows
// All UI is overlaid (fixed/absolute) so it never reflows Threads' layout.
// Nothing is auto-published — the draft lands in the reply box, you press Опублікувати.
(() => {
  'use strict';

  const REL = (typeof tcaRelevance === 'function') ? tcaRelevance : () => ({ score: 0, topics: [], top: '', lead: false });
  const KIND = (typeof tcaNotifKind === 'function') ? tcaNotifKind : () => 'post';
  let PRODUCTS = (typeof TCA_PRODUCTS !== 'undefined' && TCA_PRODUCTS.length) ? TCA_PRODUCTS : [];
  const PMATCH = (typeof tcaProductMatch === 'function') ? tcaProductMatch : () => false;
  // Products come from config.local.js via storage (content scripts can't load it).
  chrome.storage.local.get('tcaProductsOverride', (o) => { if (o && o.tcaProductsOverride && o.tcaProductsOverride.length) PRODUCTS = o.tcaProductsOverride; });
  chrome.storage.onChanged.addListener((ch, area) => { if (area === 'local' && ch.tcaProductsOverride) PRODUCTS = ch.tcaProductsOverride.newValue || []; });
  let MINE = ((typeof TCA_DEFAULTS !== 'undefined' && TCA_DEFAULTS.myHandle) || '').toLowerCase();
  chrome.storage.sync.get('myHandle', (o) => { if (o && typeof o.myHandle === 'string' && o.myHandle.trim()) MINE = o.myHandle.trim().toLowerCase(); });
  chrome.storage.onChanged.addListener((ch, area) => { if (area === 'sync' && ch.myHandle) MINE = String((ch.myHandle.newValue || '')).trim().toLowerCase(); });
  const index = new Map();      // post id -> live DOM element
  const knownRel = new Set();   // relevant ids already seen (for "new post" detection)
  let commented = new Set();    // post ids already commented on (persisted)
  let firstScan = true, pendingNew = 0;

  const COMMENTED_KEY = 'tcaCommented';
  chrome.storage.local.get(COMMENTED_KEY, (o) => { commented = new Set(o[COMMENTED_KEY] || []); scan(); });
  chrome.storage.onChanged.addListener((ch, area) => {
    if (area === 'local' && ch[COMMENTED_KEY]) { commented = new Set(ch[COMMENTED_KEY].newValue || []); scan(); }
  });
  function markCommented(id) {
    if (!id || commented.has(id)) return;
    commented.add(id);
    chrome.storage.local.set({ [COMMENTED_KEY]: [...commented].slice(-1000) });
  }

  // Learn my style: capture my own posts/comments as voice samples for generation.
  let sampleSet = new Set(), sampleT = null;
  chrome.storage.local.get('tcaSamples', (o) => { sampleSet = new Set(o.tcaSamples || []); });
  function captureSample(text) {
    text = String(text || '').replace(/\s+/g, ' ').trim();
    if (text.length < 40 || text.length > 600 || sampleSet.has(text)) return;
    sampleSet.add(text);
    clearTimeout(sampleT);
    sampleT = setTimeout(() => chrome.storage.local.set({ tcaSamples: [...sampleSet].slice(-50) }), 1500);
  }

  // History of what we wrote (newest first), so we can show it and block re-writing.
  function recordHistory(entry) {
    if (!entry || !entry.id) return;
    chrome.storage.local.get('tcaHistory', (o) => {
      let h = (o.tcaHistory || []).filter(x => x.id !== entry.id);
      h.unshift({ id: entry.id, author: entry.author || '', text: entry.text || '', ts: Date.now() });
      chrome.storage.local.set({ tcaHistory: h.slice(0, 200) });
    });
  }

  // ---------- post extraction ----------
  const NOISE = /^(підписатися|подписаться|follow|підписки|translate|перекласти|перевести|більше|ещё|more|поділитися|share|repost|reply|відповісти|ответить|like|подобається|нравится|\d+|\d+\s*(год|годин|хв|хвилин|day|days|h|m|d|тиж|нед|w|hours?|minutes?)\.?|·)$/i;

  function norm(s) { return String(s || '').replace(/ /g, ' ').replace(/[ \t]+/g, ' '); }
  function postText(c) {
    return norm(c.innerText).split('\n').map(l => l.trim()).filter(Boolean)
      .filter(l => !NOISE.test(l)).slice(0, 16).join('\n').slice(0, 1500);
  }
  function postAuthor(c) {
    const a = c.querySelector('a[href^="/@"]');
    return a ? (a.getAttribute('href') || '').replace('/@', '').split('/')[0] : '';
  }
  function postUrl(c) {
    const a = c.querySelector('a[href*="/post/"]');
    if (!a) return '';
    try { return new URL(a.getAttribute('href'), location.origin).href; } catch (e) { return a.getAttribute('href') || ''; }
  }
  function postId(c) {
    const u = postUrl(c);
    if (u) return u;
    const t = postText(c).slice(0, 80); let h = 0;
    for (const ch of t) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return 't' + h;
  }

  function findContainers() {
    const links = document.querySelectorAll('a[href*="/post/"]');
    const seen = new Set(); const out = [];
    links.forEach((a) => {
      let el = a.parentElement;
      while (el && el !== document.body) {
        const len = (el.innerText || '').trim().length;
        if (len >= 50 && len <= 3000) break;
        el = el.parentElement;
      }
      if (!el || el === document.body || seen.has(el)) return;
      seen.add(el); out.push(el);
    });
    return out;
  }

  function enrich(el) {
    const text = postText(el); const rel = REL(text);
    return { el, id: postId(el), author: postAuthor(el), url: postUrl(el), text, score: rel.score, top: rel.top, lead: rel.lead };
  }

  function collect() {
    const onActivity = /\/activity/i.test(location.pathname);
    const m = new Map();
    for (const el of findContainers()) {
      const author = postAuthor(el).toLowerCase();
      const urlHandle = (postUrl(el).toLowerCase().match(/\/@([^\/?#]+)/) || [])[1] || '';
      const text0 = postText(el);
      // follows / likes / reposts -> nothing to reply to (RU + UA wording)
      if (KIND(text0) === 'social') { stripUi(el); el.dataset.tcaUi = 'skip'; continue; }
      // exclude MY OWN threads in feeds — but NOT on the Activity page, where replies to my
      // posts (which link to my own permalink) are exactly what I want to answer.
      if (!onActivity && MINE && (author === MINE || urlHandle === MINE)) { el.dataset.tcaMine = '1'; captureSample(text0); continue; }
      const p = enrich(el);
      if (p.text.length < 30) continue;
      // "already replied by me" heuristic — skip it on Activity (the item embeds my own post link as context)
      if (!onActivity && MINE && author !== MINE && el.querySelector('a[href^="/@' + MINE + '"]')) markCommented(p.id);
      p.done = commented.has(p.id);
      const prev = m.get(p.id);
      if (!prev || p.score > prev.score) m.set(p.id, p);
      index.set(p.id, el);
    }
    return [...m.values()];
  }

  // ---------- per-post decoration (overlay only) ----------
  function stripUi(el) { el.querySelectorAll(':scope > .tca-dot, :scope > .tca-chip, :scope > .tca-btn, :scope > .tca-done-mark').forEach(n => n.remove()); }
  function decorate(p) {
    const el = p.el;
    if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
    if (p.done) {
      if (el.dataset.tcaUi !== 'done') {
        stripUi(el); el.dataset.tcaUi = 'done';
        const mark = document.createElement('div'); mark.className = 'tca-done-mark'; mark.innerHTML = ic('check', 13) + L('<span>написано</span>');
        el.appendChild(mark);
      }
      return;
    }
    if (el.dataset.tcaUi === 'done') { stripUi(el); el.dataset.tcaUi = ''; } // un-mark if it became not-done
    if (el.dataset.tcaUi === '1') return;
    el.dataset.tcaUi = '1';

    if (p.score >= 1) {
      const dot = document.createElement('div'); dot.className = 'tca-dot' + (p.lead ? ' lead' : ''); el.appendChild(dot);
      const chip = document.createElement('div'); chip.className = 'tca-chip' + (p.lead ? ' lead' : '');
      chip.textContent = (p.lead ? '🎯 ' : '💡 ') + (p.top || L('тема')); el.appendChild(chip);
    }
    const btn = document.createElement('button');
    btn.className = 'tca-btn' + (p.score >= 1 ? ' tca-btn-rel' : '');
    btn.type = 'button'; btn.innerHTML = ic('pencil', 16);
    btn.title = L('Сформировать комментарий и вставить в ответ');
    btn.addEventListener('click', (e) => {
      e.preventDefault(); e.stopPropagation();
      startComment({ el, id: p.id, author: p.author, text: postText(el) });
    });
    el.appendChild(btn);
  }

  // ---------- floating composer card ----------
  let cardEl = null, target = null;
  function card() { if (!cardEl) { cardEl = document.createElement('div'); cardEl.id = 'tca-card'; document.body.appendChild(cardEl); } return cardEl; }
  function closeCard() { if (cardEl) cardEl.classList.remove('open'); }

  function startComment(t, autoInsert) {
    target = t;
    hideNote();
    const c = card(); c.classList.add('open'); c.innerHTML = '';
    c.style.right = sidebarOpen ? '392px' : '18px'; // sit beside the sidebar, not on top of it
    const head = document.createElement('div'); head.className = 'tca-card-head';
    const h = document.createElement('span'); h.className = 'tca-card-title'; h.innerHTML = ic('logo', 16);
    const ht = document.createElement('span'); ht.textContent = L('Комментарий для @') + (t.author || '—'); h.appendChild(ht);
    const x = document.createElement('button'); x.className = 'tca-card-x'; x.innerHTML = ic('close', 18); x.onclick = closeCard;
    head.append(h, x); c.appendChild(head);
    const body = document.createElement('div'); body.className = 'tca-card-body';
    body.innerHTML = L('<div class="tca-status">⏳ Пишу комментарий…</div>');
    c.appendChild(body);
    sendDraft(t.text, t.author, (resp) => renderCard(resp, autoInsert !== false));
  }

  function renderCard(resp, autoInsert) {
    const body = card().querySelector('.tca-card-body'); if (!body) return;
    body.innerHTML = '';
    if (!resp || !resp.ok) {
      const e = document.createElement('div'); e.className = 'tca-status err';
      e.textContent = (resp && /ключ|key|openrouter/i.test(resp.error || '')) ? L('⚠️ Нет ключа OpenRouter — откройте ⚙ настройки.') : '⚠️ ' + ((resp && resp.error) || L('нет ответа'));
      body.appendChild(e); return;
    }
    const onPage = !!(target && target.el);
    const toneRow = document.createElement('div'); toneRow.className = 'tca-tone';
    [['auto', L('Авто')], ['humor', L('С юмором')], ['mentor', L('Менторски')]].forEach(([k, lbl]) => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'tca-tone-b' + (((target && target.tone) || 'auto') === k ? ' on' : ''); b.textContent = lbl;
      b.onclick = () => { if (target) target.tone = k; body.innerHTML = '<div class="tca-status">⏳…</div>'; sendDraft(target.text, target.author, (r) => renderCard(r, false)); };
      toneRow.appendChild(b);
    });
    body.appendChild(toneRow);
    const ta = document.createElement('textarea'); ta.className = 'tca-text'; ta.rows = 4; ta.value = resp.draft; body.appendChild(ta);
    const row = document.createElement('div'); row.className = 'tca-row';
    const cnt = document.createElement('span'); cnt.className = 'tca-count';
    const upd = () => cnt.textContent = [...ta.value].length + '/500'; upd(); ta.addEventListener('input', upd);
    const main = onPage
      ? mkBtn(L('Вставить в ответ'), () => doInsert(ta.value, main), 'send')
      : mkBtn(L('Открыть пост'), () => { navigator.clipboard.writeText(ta.value).catch(() => {}); window.open((target && target.url) || 'https://www.threads.com/', '_blank'); toast(L('Черновик скопирован. Откройте пост и вставьте (Cmd/Ctrl+V).')); }, 'open');
    const regen = mkBtn(L('Ещё'), () => { body.innerHTML = '<div class="tca-status">⏳…</div>'; sendDraft(target.text, target.author, (r) => renderCard(r, false)); }, 'refresh');
    const copy = mkBtn('', () => copyText(ta.value, copy), 'copy');
    row.append(cnt, spacer(), main, regen, copy); body.appendChild(row);
    const hint = document.createElement('div'); hint.className = 'tca-hint';
    hint.textContent = onPage ? L('Текст ляжет в окно ответа Threads. «Опублікувати» — вы сами.') : L('Это пост из фонового поиска. Откройте его и вставьте черновик.');
    body.appendChild(hint);
    if (autoInsert && onPage) doInsert(ta.value, main);
  }

  async function doInsert(text, btn) {
    const orig = btn ? btn.innerHTML : '';
    if (btn) btn.textContent = '⏳…';
    const r = await insertReply(target && target.el, text);
    if (target) { markCommented(target.id); recordHistory({ id: target.id, author: target.author, text }); }
    if (btn) { btn.textContent = r.method === 'inserted' ? L('✓ Вставлено') : L('📋 Cmd+V'); setTimeout(() => (btn.innerHTML = orig), 2600); }
    toast(r.method === 'inserted' ? L('Готово. Проверьте и нажмите «Опублікувати» в Threads.') : L('Скопировано в буфер. Откройте ответ и вставьте (Cmd/Ctrl+V).'));
  }

  function sendDraft(text, author, cb) {
    const product = target && target.product ? { name: target.product.name, desc: target.product.desc, url: target.product.url } : undefined;
    const tone = target && target.tone;
    try {
      chrome.runtime.sendMessage({ type: 'draft', text, author, product, tone }, (resp) => {
        if (chrome.runtime.lastError) cb({ ok: false, error: chrome.runtime.lastError.message });
        else cb(resp);
      });
    } catch (e) { cb({ ok: false, error: String(e.message || e) }); }
  }

  // ---------- thematic inline icons (consistent line style, currentColor) ----------
  const ICONS = {
    logo: '<path d="M21 11.5a8.5 8.5 0 0 1-12.3 7.6L3 21l1.9-5.7A8.5 8.5 0 1 1 21 11.5z"/><circle cx="12" cy="11.5" r="1.6" fill="currentColor" stroke="none"/>',
    pencil: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
    send: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
    refresh: '<path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M3 21v-5h5"/>',
    copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    close: '<path d="M18 6 6 18M6 6l12 12"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    open: '<path d="M7 17 17 7M8 7h9v9"/>',
    bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
    trash: '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>'
  };
  function ic(name, size) {
    return '<svg class="tca-ic" viewBox="0 0 24 24" width="' + (size || 16) + '" height="' + (size || 16) + '" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + (ICONS[name] || '') + '</svg>';
  }

  // ---------- reply insertion (fills native composer; never submits) ----------
  function findReplyControl(el) {
    for (const c of el.querySelectorAll('[aria-label], svg[aria-label]')) {
      const al = (c.getAttribute('aria-label') || '').toLowerCase();
      if (/repl|відповід|ответ|коментува|коментар|comment/.test(al)) {
        return c.closest('[role="button"],a[role="link"],div[tabindex],button') || c.parentElement;
      }
    }
    return null;
  }
  function waitFor(test, timeout) {
    return new Promise((resolve) => {
      const hit = test(); if (hit) return resolve(hit);
      const obs = new MutationObserver(() => { const f = test(); if (f) { obs.disconnect(); clearTimeout(to); resolve(f); } });
      obs.observe(document.documentElement, { childList: true, subtree: true });
      const to = setTimeout(() => { obs.disconnect(); resolve(null); }, timeout || 3500);
    });
  }
  async function insertReply(el, text) {
    try { await navigator.clipboard.writeText(text); } catch (e) {}
    if (!el) return { ok: true, method: 'clipboard' };
    const ctrl = findReplyControl(el);
    if (ctrl) ctrl.click();
    const box = await waitFor(() => {
      const scope = document.querySelector('[role="dialog"]') || document;
      const e = scope.querySelector('[contenteditable="true"][role="textbox"]') || scope.querySelector('[contenteditable="true"]');
      return (e && e.offsetParent !== null) ? e : null;
    }, 3500);
    if (!box) return { ok: true, method: 'clipboard' };
    box.focus();
    let inserted = false;
    try { inserted = document.execCommand('insertText', false, text); } catch (e) {}
    if (!inserted) {
      try {
        box.dispatchEvent(new InputEvent('beforeinput', { inputType: 'insertText', data: text, bubbles: true, cancelable: true }));
        inserted = document.execCommand('insertText', false, text);
      } catch (e) {}
    }
    return { ok: true, method: inserted ? 'inserted' : 'clipboard' };
  }

  // ---------- floating launcher + sidebar ----------
  let sidebarOpen = false, sidebarMode = 'rel', selectedProduct = null;
  function buildFab() {
    if (document.getElementById('tca-fab')) return;
    const fab = document.createElement('button');
    fab.id = 'tca-fab'; fab.type = 'button'; fab.title = L('Подходящие ветки для комментария');
    fab.innerHTML = ic('logo', 26) + '<span id="tca-fab-badge">0</span>';
    fab.addEventListener('click', () => (sidebarOpen ? closeSidebar() : openSidebar()));
    document.body.appendChild(fab);
  }
  function updateBadge(n) {
    const b = document.getElementById('tca-fab-badge');
    if (b) { b.textContent = n; b.style.display = n > 0 ? 'flex' : 'none'; }
  }
  function pulseFab() { const f = document.getElementById('tca-fab'); if (f) f.classList.add('pulse'); }
  function stopPulse() { const f = document.getElementById('tca-fab'); if (f) f.classList.remove('pulse'); }

  function showNote(n) {
    let el = document.getElementById('tca-note');
    if (!el) { el = document.createElement('div'); el.id = 'tca-note'; el.onclick = () => { openSidebar(); }; document.body.appendChild(el); }
    el.textContent = '🧵 ' + n + L(' новых тематических веток — открыть');
    el.classList.add('show');
  }
  function hideNote() { const el = document.getElementById('tca-note'); if (el) el.classList.remove('show'); }

  const SEARCHES = [
    ['SEO', 'SEO просування сайту'],
    ['WooCommerce', 'woocommerce магазин товари'],
    [L('Стартапы'), 'стартап засновник продукт'],
    ['WordPress', 'wordpress сайт'],
    [L('Дети'), 'виховання дітей завдання винагорода'],
    ['AI', 'штучний інтелект автоматизація']
  ];
  function openSidebar() {
    pendingNew = 0; hideNote(); stopPulse();
    let sb = document.getElementById('tca-sidebar');
    if (!sb) { sb = document.createElement('div'); sb.id = 'tca-sidebar'; document.body.appendChild(sb); }
    sb.innerHTML = '';

    const head = document.createElement('div'); head.className = 'tca-sb-head';
    const h = document.createElement('span'); h.textContent = L('🧵 Ветки для комментария');
    const x = document.createElement('button'); x.className = 'tca-sb-x'; x.textContent = '✕'; x.onclick = closeSidebar;
    head.append(h, x); sb.appendChild(head);

    const list = document.createElement('div'); list.className = 'tca-sb-list';
    const toggle = document.createElement('div'); toggle.className = 'tca-sb-toggle';
    const relB = document.createElement('button'); relB.textContent = L('На странице');
    const allB = document.createElement('button'); allB.textContent = L('Все');
    const foundB = document.createElement('button'); foundB.textContent = L('Найдено');
    const prodB = document.createElement('button'); prodB.textContent = L('Продукт');
    const histB = document.createElement('button'); histB.textContent = L('История');
    const postB = document.createElement('button'); postB.textContent = L('Пост');
    const setMode = (m) => { sidebarMode = m; relB.classList.toggle('on', m === 'rel'); allB.classList.toggle('on', m === 'all'); foundB.classList.toggle('on', m === 'found'); prodB.classList.toggle('on', m === 'product'); histB.classList.toggle('on', m === 'history'); postB.classList.toggle('on', m === 'post'); renderList(list); };
    relB.onclick = () => setMode('rel'); allB.onclick = () => setMode('all'); foundB.onclick = () => setMode('found'); prodB.onclick = () => setMode('product'); histB.onclick = () => setMode('history'); postB.onclick = () => setMode('post');
    toggle.append(relB, allB, foundB, prodB, histB, postB); sb.appendChild(toggle);
    chrome.storage.local.get('tcaFound', (o) => { const n = (o.tcaFound || []).length; if (n) foundB.textContent = L('Найдено ') + n; });

    const search = document.createElement('div'); search.className = 'tca-sb-search';
    const lbl = document.createElement('div'); lbl.className = 'tca-sb-lbl'; lbl.textContent = L('Искать по теме (даже то, чего нет в ленте):');
    const chips = document.createElement('div'); chips.className = 'tca-sb-chips';
    SEARCHES.forEach(([k, q]) => {
      const b = document.createElement('button'); b.className = 'tca-sb-chip'; b.textContent = '🔎 ' + k;
      b.onclick = () => window.open('https://www.threads.com/search?q=' + encodeURIComponent(q) + '&serp_type=default', '_blank');
      chips.appendChild(b);
    });
    search.append(lbl, chips); sb.appendChild(search);

    sb.appendChild(list);
    relB.classList.add('on');
    renderList(list);
    sb.classList.add('open'); sidebarOpen = true;
    if (cardEl && cardEl.classList.contains('open')) cardEl.style.right = '392px';
  }
  function renderList(list) {
    if (sidebarMode === 'found') return renderFound(list);
    if (sidebarMode === 'product') return renderProduct(list);
    if (sidebarMode === 'history') return renderHistory(list);
    if (sidebarMode === 'post') return renderPost(list);
    list.innerHTML = '';
    let items = collect();
    if (sidebarMode === 'rel') items = items.filter(p => p.score >= 1);
    items.sort((a, b) => (a.done - b.done) || (b.score - a.score)); // pending first, written ones below (marked)
    items = items.slice(0, 50);
    if (!items.length) {
      const e = document.createElement('div'); e.className = 'tca-sb-empty';
      e.textContent = sidebarMode === 'rel'
        ? L('Подходящих веток на странице нет. Откройте поиск по теме выше или прокрутите ленту.')
        : L('Постов на странице не найдено. Прокрутите ленту.');
      list.appendChild(e);
    } else {
      items.forEach(p => list.appendChild(sidebarItem(p)));
    }
  }
  function renderFound(list) {
    list.innerHTML = L('<div class="tca-sb-empty">Загрузка…</div>');
    chrome.storage.local.get(['tcaFound', COMMENTED_KEY], (o) => {
      const done = new Set(o[COMMENTED_KEY] || []);
      const items = (o.tcaFound || []).filter(p => !done.has(p.id)).slice(0, 40);
      list.innerHTML = '';
      if (!items.length) {
        const e = document.createElement('div'); e.className = 'tca-sb-empty';
        e.textContent = L('Фоновый поиск пока ничего не нашёл. Он идёт раз в N минут (⚙), либо нажмите «🔔 Поискать новые сейчас» в окне расширения.');
        list.appendChild(e); return;
      }
      const bar = document.createElement('div'); bar.className = 'tca-sb-clear';
      const cnt = document.createElement('span'); cnt.textContent = items.length + L(' найдено');
      const clr = document.createElement('button'); clr.textContent = L('🗑 Очистить');
      clr.onclick = () => chrome.storage.local.set({ tcaFound: [] }, () => renderFound(list));
      bar.append(cnt, clr); list.appendChild(bar);
      items.forEach(p => list.appendChild(foundItem(p)));
    });
  }
  function foundItem(p) {
    const it = document.createElement('div'); it.className = 'tca-it';
    const meta = document.createElement('div'); meta.className = 'tca-it-meta';
    const chip = document.createElement('span'); chip.className = 'tca-it-chip' + (p.lead ? ' lead' : ''); chip.textContent = (p.lead ? '🎯 ' : '') + (p.label || p.top || L('тема'));
    const au = document.createElement('span'); au.className = 'tca-it-author'; au.textContent = '@' + (p.author || '—');
    const tm = document.createElement('span'); tm.className = 'tca-it-time'; tm.textContent = relTime(p.ts);
    meta.append(chip, au, tm); it.appendChild(meta);
    const sn = document.createElement('div'); sn.className = 'tca-it-sn'; sn.textContent = (p.text || '').slice(0, 170); it.appendChild(sn);
    const row = document.createElement('div'); row.className = 'tca-it-row';
    const open = mkBtn(L('Открыть'), () => window.open(p.url || 'https://www.threads.com/', '_blank'), 'open'); open.classList.add('ghost');
    const gen = mkBtn(L('Черновик'), () => startComment({ el: null, id: p.id, author: p.author, text: p.text, url: p.url }, false), 'pencil');
    row.append(open, spacer(), gen); it.appendChild(row);
    return it;
  }
  function relTime(ts) {
    if (!ts) return '';
    const s = Math.floor((Date.now() - ts) / 1000);
    if (s < 60) return L('только что');
    const m = Math.floor(s / 60); if (m < 60) return m + L(' мин');
    const h = Math.floor(m / 60); if (h < 24) return h + L(' ч');
    return Math.floor(h / 24) + L(' дн');
  }
  // "🕘 История" tab — what you already wrote (so you don't write twice).
  function renderHistory(list) {
    list.innerHTML = L('<div class="tca-sb-empty">Загрузка…</div>');
    chrome.storage.local.get('tcaHistory', (o) => {
      const items = (o.tcaHistory || []).slice(0, 60);
      list.innerHTML = '';
      if (!items.length) {
        const e = document.createElement('div'); e.className = 'tca-sb-empty';
        e.textContent = L('Пока пусто. Здесь будут комментарии, которые вы уже написали.');
        list.appendChild(e); return;
      }
      const bar = document.createElement('div'); bar.className = 'tca-sb-clear';
      const cnt = document.createElement('span'); cnt.textContent = items.length + L(' записей');
      const clr = document.createElement('button'); clr.innerHTML = ic('trash') + L('<span>Очистить</span>');
      clr.onclick = () => chrome.storage.local.set({ tcaHistory: [] }, () => renderHistory(list));
      bar.append(cnt, clr); list.appendChild(bar);
      items.forEach(p => list.appendChild(historyItem(p)));
    });
  }
  function historyItem(p) {
    const it = document.createElement('div'); it.className = 'tca-it';
    const meta = document.createElement('div'); meta.className = 'tca-it-meta';
    const au = document.createElement('span'); au.className = 'tca-it-author'; au.textContent = '@' + (p.author || '—');
    const tm = document.createElement('span'); tm.className = 'tca-it-time'; tm.textContent = relTime(p.ts);
    meta.append(au, tm); it.appendChild(meta);
    const sn = document.createElement('div'); sn.className = 'tca-it-sn'; sn.textContent = (p.text || '').slice(0, 220); it.appendChild(sn);
    const row = document.createElement('div'); row.className = 'tca-it-row';
    const open = mkBtn(L('Открыть пост'), () => { if (index.get(p.id)) focusPost(p.id); else if (/^https?:/.test(p.id)) window.open(p.id, '_blank'); }, 'open'); open.classList.add('ghost');
    const copy = mkBtn(L('Копировать'), () => navigator.clipboard.writeText(p.text || ''), 'copy');
    row.append(open, spacer(), copy); it.appendChild(row);
    return it;
  }

  // "Пост" tab — write a post for your OWN feed (suggest topics on demand).
  function renderPost(list) {
    list.innerHTML = '';
    const intro = document.createElement('div'); intro.className = 'tca-sb-empty';
    intro.textContent = L('Пост себе в ленту. Нажмите «Запропонувати теми», выберите тему — сформирую пост в вашем стиле. Публикуете сами.');
    list.appendChild(intro);
    const chips = document.createElement('div'); chips.className = 'tca-sb-prod';
    const bar = document.createElement('div'); bar.className = 'tca-sb-prod';
    bar.appendChild(mkBtn(L('Запропонувати теми'), () => loadPostTopics(chips), 'refresh'));
    list.appendChild(bar); list.appendChild(chips);
    const wrap = document.createElement('div'); wrap.style.padding = '4px 14px 16px';
    const ta = document.createElement('textarea'); ta.className = 'tca-text'; ta.rows = 2; ta.placeholder = L('…или своя тема для поста'); wrap.appendChild(ta);
    const gen = mkBtn(L('Сгенерировать пост'), () => { const t = ta.value.trim(); if (t) startPost(t); }, 'pencil'); gen.style.marginTop = '8px';
    wrap.appendChild(gen); list.appendChild(wrap);
  }
  function loadPostTopics(chips) {
    chips.innerHTML = L('<div class="tca-sb-lbl">⏳ Подбираю темы…</div>');
    try {
      chrome.runtime.sendMessage({ type: 'suggestTopics' }, (r) => {
        chips.innerHTML = '';
        const seed = (typeof TCA_POST_TOPICS !== 'undefined') ? TCA_POST_TOPICS : [];
        const topics = (r && r.ok && r.topics && r.topics.length) ? r.topics : seed;
        if (!topics.length) { chips.innerHTML = L('<div class="tca-sb-lbl">Не удалось подобрать. Впишите тему вручную ниже.</div>'); return; }
        topics.forEach(t => { const b = document.createElement('button'); b.className = 'tca-prod-chip'; b.textContent = t; b.onclick = () => startPost(t); chips.appendChild(b); });
      });
    } catch (e) { chips.innerHTML = ''; }
  }
  function startPost(topic) {
    target = { post: true, topic };
    hideNote();
    const c = card(); c.classList.add('open'); c.innerHTML = '';
    c.style.right = sidebarOpen ? '392px' : '18px';
    const head = document.createElement('div'); head.className = 'tca-card-head';
    const h = document.createElement('span'); h.className = 'tca-card-title'; h.innerHTML = ic('pencil', 16);
    const ht = document.createElement('span'); ht.textContent = L('Пост: ') + topic.slice(0, 38); h.appendChild(ht);
    const x = document.createElement('button'); x.className = 'tca-card-x'; x.innerHTML = ic('close', 18); x.onclick = closeCard;
    head.append(h, x); c.appendChild(head);
    const body = document.createElement('div'); body.className = 'tca-card-body'; body.innerHTML = L('<div class="tca-status">⏳ Пишу пост…</div>'); c.appendChild(body);
    sendPost(topic, (resp) => renderPostCard(resp, topic));
  }
  function sendPost(topic, cb) {
    try { chrome.runtime.sendMessage({ type: 'draftPost', topic }, (r) => { if (chrome.runtime.lastError) cb({ ok: false, error: chrome.runtime.lastError.message }); else cb(r); }); }
    catch (e) { cb({ ok: false, error: String(e.message || e) }); }
  }
  function renderPostCard(resp, topic) {
    const body = card().querySelector('.tca-card-body'); if (!body) return;
    body.innerHTML = '';
    if (!resp || !resp.ok) {
      const e = document.createElement('div'); e.className = 'tca-status err';
      e.textContent = (resp && /ключ|key|openrouter/i.test(resp.error || '')) ? L('⚠️ Нет ключа OpenRouter — откройте ⚙ настройки.') : '⚠️ ' + ((resp && resp.error) || L('нет ответа'));
      body.appendChild(e); return;
    }
    const ta = document.createElement('textarea'); ta.className = 'tca-text'; ta.rows = 6; ta.value = resp.draft; body.appendChild(ta);
    const row = document.createElement('div'); row.className = 'tca-row';
    const cnt = document.createElement('span'); cnt.className = 'tca-count';
    const upd = () => cnt.textContent = [...ta.value].length + '/500'; upd(); ta.addEventListener('input', upd);
    const copy = mkBtn(L('Скопировать'), () => copyText(ta.value, copy), 'copy');
    const regen = mkBtn(L('Ещё'), () => { body.innerHTML = '<div class="tca-status">⏳…</div>'; sendPost(topic, (r) => renderPostCard(r, topic)); }, 'refresh');
    row.append(cnt, spacer(), regen, copy); body.appendChild(row);
    const hint = document.createElement('div'); hint.className = 'tca-hint'; hint.textContent = L('Скопируйте и вставьте в окно нового поста Threads. Публикуете вы сами.'); body.appendChild(hint);
  }
  // "🎯 Продукт" tab — pick a product, see posts where writing about it fits.
  function renderProduct(list) {
    list.innerHTML = '';
    const pc = document.createElement('div'); pc.className = 'tca-sb-prod';
    PRODUCTS.forEach(pr => {
      const b = document.createElement('button'); b.className = 'tca-prod-chip' + (selectedProduct === pr.key ? ' on' : ''); b.textContent = pr.label || pr.name;
      b.onclick = () => { selectedProduct = pr.key; renderProduct(list); };
      pc.appendChild(b);
    });
    list.appendChild(pc);
    if (!selectedProduct) {
      const e = document.createElement('div'); e.className = 'tca-sb-empty';
      e.textContent = L('Выберите продукт — покажу посты на странице, где о нём уместно написать, и сформирую комментарий с акцентом на него.');
      list.appendChild(e); return;
    }
    const prod = PRODUCTS.find(p => p.key === selectedProduct);
    let items = collect().filter(p => PMATCH(p.text, prod));
    items.sort((a, b) => (a.done - b.done) || (b.score - a.score)); items = items.slice(0, 50);
    if (!items.length) {
      const e = document.createElement('div'); e.className = 'tca-sb-empty';
      e.textContent = L('На странице нет постов под «') + prod.name + L('». Откройте поиск по теме (выше) и прокрутите ленту.');
      list.appendChild(e); return;
    }
    items.forEach(p => list.appendChild(productItem(p, prod)));
  }
  function productItem(p, prod) {
    const it = document.createElement('div'); it.className = 'tca-it' + (p.done ? ' done' : '');
    const meta = document.createElement('div'); meta.className = 'tca-it-meta';
    const chip = document.createElement('span'); chip.className = 'tca-it-chip' + (p.lead ? ' lead' : ''); chip.textContent = (p.lead ? '🎯 ' : '') + (p.top || prod.name);
    const au = document.createElement('span'); au.className = 'tca-it-author'; au.textContent = '@' + (p.author || '—');
    meta.append(chip, au);
    if (p.done) { const d = document.createElement('span'); d.className = 'tca-it-time done'; d.textContent = L('✓ написано'); meta.appendChild(d); }
    it.appendChild(meta);
    const sn = document.createElement('div'); sn.className = 'tca-it-sn'; sn.textContent = p.text.slice(0, 170); it.appendChild(sn);
    const row = document.createElement('div'); row.className = 'tca-it-row';
    const open = mkBtn(L('Открыть'), () => focusPost(p.id), 'open'); open.classList.add('ghost');
    let gen;
    if (p.done) { gen = mkBtn(L('Написано'), () => {}, 'check'); gen.disabled = true; }
    else gen = mkBtn(L('Про ') + prod.name, () => { gen.disabled = true; focusPost(p.id); startComment({ el: index.get(p.id), id: p.id, author: p.author, text: p.text, product: prod }); }, 'pencil');
    row.append(open, spacer(), gen); it.appendChild(row);
    return it;
  }
  function closeSidebar() { const sb = document.getElementById('tca-sidebar'); if (sb) sb.classList.remove('open'); sidebarOpen = false; if (cardEl && cardEl.classList.contains('open')) cardEl.style.right = '18px'; }
  function sidebarItem(p) {
    const it = document.createElement('div'); it.className = 'tca-it' + (p.done ? ' done' : '');
    const meta = document.createElement('div'); meta.className = 'tca-it-meta';
    const chip = document.createElement('span'); chip.className = 'tca-it-chip' + (p.score >= 1 ? '' : ' off'); chip.textContent = p.score >= 1 ? (p.top || L('тема')) : L('пост');
    const au = document.createElement('span'); au.className = 'tca-it-author'; au.textContent = '@' + (p.author || '—');
    meta.append(chip, au);
    if (p.done) { const d = document.createElement('span'); d.className = 'tca-it-time done'; d.textContent = L('✓ написано'); meta.appendChild(d); }
    it.appendChild(meta);
    const sn = document.createElement('div'); sn.className = 'tca-it-sn'; sn.textContent = p.text.slice(0, 170); it.appendChild(sn);
    const row = document.createElement('div'); row.className = 'tca-it-row';
    const open = mkBtn(L('Открыть'), () => focusPost(p.id), 'open'); open.classList.add('ghost');
    let gen;
    if (p.done) { gen = mkBtn(L('Написано'), () => {}, 'check'); gen.disabled = true; }
    else gen = mkBtn(L('Написать'), () => { gen.disabled = true; focusPost(p.id); startComment({ el: index.get(p.id), id: p.id, author: p.author, text: p.text }); }, 'pencil');
    row.append(open, spacer(), gen); it.appendChild(row);
    return it;
  }
  function focusPost(id) {
    const el = index.get(id); if (!el) return false;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.add('tca-flash'); setTimeout(() => el.classList.remove('tca-flash'), 1700);
    return true;
  }

  // ---------- helpers ----------
  function mkBtn(label, fn, iconName) {
    const b = document.createElement('button'); b.className = 'tca-act'; b.type = 'button';
    b.innerHTML = (iconName ? ic(iconName) : '') + (label ? '<span>' + label + '</span>' : '');
    b.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); fn(); });
    return b;
  }
  function spacer() { const s = document.createElement('span'); s.className = 'tca-spacer'; return s; }
  function copyText(v, btn) { navigator.clipboard.writeText(v).then(() => { const o = btn.innerHTML; btn.textContent = '✓'; setTimeout(() => (btn.innerHTML = o), 1200); }); }
  let toastT = null;
  function toast(msg) {
    let t = document.getElementById('tca-toast');
    if (!t) { t = document.createElement('div'); t.id = 'tca-toast'; document.body.appendChild(t); }
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 3500);
  }

  // ---------- messages from the popup ----------
  chrome.runtime.onMessage.addListener((msg, sender, send) => {
    if (!msg) return;
    if (msg.type === 'tcaPing') { send({ ok: true, host: location.host }); return true; }
    if (msg.type === 'tcaCollect') {
      const items = collect().filter(p => p.score >= 1 && !p.done).sort((a, b) => b.score - a.score).slice(0, 30)
        .map(p => ({ id: p.id, author: p.author, text: p.text, url: p.url, top: p.top, score: p.score, lead: !!p.lead }));
      send({ ok: true, items });
      return true;
    }
    if (msg.type === 'tcaFocus') { send({ ok: focusPost(msg.id) }); return true; }
    if (msg.type === 'tcaInsert') {
      insertReply(index.get(msg.id), msg.text).then((r) => { markCommented(msg.id); recordHistory({ id: msg.id, text: msg.text }); send(r); });
      return true;
    }
  });

  // ---------- scan loop ----------
  function scan() {
    const posts = collect();
    posts.forEach(decorate);
    const rel = posts.filter(p => p.score >= 1 && !p.done);
    buildFab(); updateBadge(rel.length);
    let fresh = 0;
    for (const p of rel) { if (!knownRel.has(p.id)) { knownRel.add(p.id); fresh++; } }
    const cardOpen = cardEl && cardEl.classList.contains('open');
    if (fresh > 0 && !firstScan && !sidebarOpen && !cardOpen) { pendingNew += fresh; pulseFab(); showNote(pendingNew); }
    firstScan = false;
    if (sidebarOpen) { const l = document.querySelector('#tca-sidebar .tca-sb-list'); if (l) renderList(l); }
  }
  let t = null;
  new MutationObserver(() => { clearTimeout(t); t = setTimeout(scan, 600); })
    .observe(document.documentElement, { childList: true, subtree: true });
  scan();
})();
