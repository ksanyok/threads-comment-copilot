// Service worker: drafts a comment via OpenRouter (called from the content script + popup).
importScripts('defaults.js'); // provides self.TCA_DEFAULTS (key, model, voice, guidelines)
importScripts('i18n.js'); // provides L() for localized notifications/errors
try { importScripts('config.local.js'); } catch (e) {} // optional local-only key; absent in the published build
const OPENROUTER = 'https://openrouter.ai/api/v1/chat/completions';
const TCA_BUILD = '1.1.2'; // shown in the card so you can confirm the worker is fresh (reload the EXTENSION to update it)

function getSettings() {
  return new Promise(res => chrome.storage.sync.get(TCA_DEFAULTS, res));
}

// Accumulate REAL spend (OpenRouter returns usage.cost in USD). Serialized to avoid lost updates.
let usageChain = Promise.resolve();
function addUsage(cost, tokens) {
  usageChain = usageChain.then(() => new Promise(res => {
    chrome.storage.local.get('tcaUsage', o => {
      const u = o.tcaUsage || { cost: 0, tokens: 0, calls: 0, since: Date.now() };
      u.cost += (+cost || 0); u.tokens += (+tokens || 0); u.calls += 1;
      chrome.storage.local.set({ tcaUsage: u }, res);
    });
  }));
  return usageChain;
}

function samplesBlock(samples) {
  return (samples && samples.length)
    ? '\nHOW I WRITE (real examples of MY posts/comments - match this voice and rhythm, do NOT copy the text):\n- ' + samples.map(x => String(x).replace(/\s+/g, ' ').slice(0, 200)).join('\n- ') + '\n'
    : '';
}

function buildMessages(s, text, author, product, tone, samples) {
  const lang = (s.language && s.language.toLowerCase() !== 'auto')
    ? `Write the comment in this language: ${s.language}.`
    : 'LANGUAGE: if the post is in English, reply in English; for ANY other language (including Russian or Ukrainian) reply in UKRAINIAN. Never reply in Russian.';

  const showcase = !product && (typeof tcaShowcase === 'function') && tcaShowcase(text);
  const showcaseBlock = showcase
    ? '\nSHOWCASE POST: the author invites people to share what they build / asks to present projects. If you have configured your own products, reply with a SHORT portfolio (2-4 sentences): lead with your flagship, then briefly mention 1-2 other products that fit, described accurately. Otherwise, briefly introduce what you do and add value. This may mention more than one product.\n'
    : '';
  const focusBlock = (product && product.name)
    ? `\nFOCUS PRODUCT: the user picked this post specifically to write about ${product.name}. Feature ${product.name} (${product.desc}).${product.url ? ' You may add its link once: ' + product.url + '.' : ''} Introduce it naturally and value-first, describe it accurately, no hard sell. Do not mention other products.\n`
    : '';
  const playful = !product && (typeof tcaIsPlayful === 'function') && tcaIsPlayful(text);
  const pref = ((s.tonePref || 'auto') + '').toLowerCase();
  let effTone = (tone === 'humor' || tone === 'mentor' || tone === 'neutral') ? tone : '';
  if (!effTone) {
    if (pref === 'humor' || pref === 'mentor' || pref === 'neutral') effTone = pref;
    else if (playful) effTone = 'humor'; // auto + a clearly playful/joke post
  }
  s.__effTone = effTone || (playful ? 'humor' : 'auto'); // surfaced back to the card so you can see what tone actually fired
  const toneBlock = effTone === 'humor' ? '\nTONE OVERRIDE (HIGHEST PRIORITY — overrides everything in RULES): be GENUINELY, punchily FUNNY — a sharp one-liner, absurd exaggeration, or an unexpected twist with a REAL punchline, like the funniest person in the comments. Be bold and cheeky, riff on a specific detail of the post. When replying in Ukrainian/Russian, do not be shy to open or spice a punchline with a playful colloquial exclamation (e.g. "йосип босий", "йобушки-воробушки", "ото халепа", "матінко рідна", "ну ти диви", "тю", "от халепа") when it fits the joke - keep them mild, never actually vulgar or offensive, and not in every single comment. BANNED: hedging ("можливо... або може"), bland observations, mini-essays, any product mention. On a genuine question you may still drop one concrete useful tip, but wrapped in a joke. The reply MUST make a reader actually smile or laugh.\n'
    : effTone === 'mentor' ? '\nTONE OVERRIDE (HIGHEST PRIORITY — overrides any tone guidance in RULES): write as a calm, experienced mentor — serious, structured, concrete step-by-step advice. No jokes, no sarcasm, no small talk.\n'
    : effTone === 'neutral' ? '\nTONE: friendly and natural — a normal human reply, neither joke-heavy nor a lecture.\n'
    : '';
  const playfulBlock = playful ? '\nThis post is a JOKE / banter — do NOT mention or pitch any product; just be genuinely funny and human.\n' : '';

  const system =
`You write short comments (replies) on Threads in the user's brand voice.
You are a thoughtful human commenter, not a marketer.

OUR VOICE / MANNER:
${s.voice}

RULES:
${s.guidelines}
${samplesBlock(samples)}${toneBlock}${playfulBlock}${showcaseBlock}${focusBlock}
HARD CONSTRAINTS:
- ${lang}
- Write in FIRST PERSON SINGULAR ("я", "мій"). NEVER "we/our" ("ми/наш").
- Use ONLY short hyphens "-". Never use long dashes "—" or "–".
- Write a COMPLETE comment that ends on a finished thought. NEVER stop mid-sentence.
- Length up to 480 characters. A normal comment is 1-3 sentences; a showcase portfolio is 2-4.
- Must be relevant and add genuine value (insight, experience, or a sincere question).
- Describe any product ACCURATELY (see RULES) — never invent vague positioning.
- No hashtags, no @mentions. NEVER copy or cite any link/URL from the post, and NEVER invent links to news or external sites. The ONLY link allowed is the official URL of YOUR OWN product when you feature it; otherwise include no link at all. One emoji max (only if natural).
- NEVER name or recommend any THIRD-PARTY product, app, brand, tool or company (no competitors, nothing you don't own — e.g. never NordPass, LastPass, Notion, etc.). The ONLY products you may mention are the user's own (in RULES). If none of them genuinely fit the post, write a useful or witty comment with NO product mention at all.
- ${focusBlock ? 'Feature exactly the FOCUS PRODUCT above, and only that one.' : showcase ? 'This is a showcase post: a short portfolio of your products (if configured) is expected.' : (playful || effTone === 'humor') ? 'Do NOT mention, pitch or name any product - this is a funny/banter reply; just be witty and human.' : 'Mention a product ONLY if truly relevant, softly, at most one. Do not force it.'}
- Output ONLY the comment text — no quotes, no preamble.`;

  const user = `Post by @${author || 'user'}:\n"""\n${(text || '').slice(0, 1500)}\n"""\n\nWrite one ${showcase ? 'short-portfolio ' : ''}comment.`;
  return [{ role: 'system', content: system }, { role: 'user', content: user }];
}

// Build a prompt for an ORIGINAL post to the user's own feed (not a reply).
function buildPostMessages(s, topic, samples) {
  const system =
`You write an original Threads POST for the user's OWN feed (not a reply), in their brand voice.

VOICE / MANNER:
${s.voice}

PRODUCTS & RULES (for accurate mentions and link):
${s.guidelines}
${samplesBlock(samples)}
HARD CONSTRAINTS:
- Write in FIRST PERSON SINGULAR ("я", "мій"). Never "we/our".
- Language: Ukrainian (unless the topic is clearly English).
- Strong first-line hook, then real value from my experience. Engaging and human, not an ad.
- Up to 500 characters. Use ONLY short hyphens "-", never long dashes.
- You MAY softly mention ONE of my products (with its official link) if it fits the topic naturally; otherwise none.
- A COMPLETE post, no cut-offs. Output ONLY the post text - no quotes, no preamble, no hashtags.`;
  const user = `Topic for my post: ${topic}\nWrite one post.`;
  return [{ role: 'system', content: system }, { role: 'user', content: user }];
}

// Suggest fresh post-topic ideas in the user's language/niche (on demand).
function buildTopicsMessages(s, samples) {
  const system =
`Suggest fresh topic ideas for the user's OWN Threads posts, in THEIR language (Ukrainian unless the samples are clearly another language) and niche.
Base them on the user's voice, products and real expertise. Vary the angle: case study, contrarian opinion, practical tip, behind-the-scenes, mistake-and-lesson.

VOICE:
${s.voice}
PRODUCTS:
${s.guidelines}
${samplesBlock(samples)}`;
  const user = 'Give exactly 8 topic ideas. Each a short phrase (3-8 words). One per line. No numbering, no quotes, no extra text.';
  return [{ role: 'system', content: system }, { role: 'user', content: user }];
}

function getSamples() {
  return new Promise(res => chrome.storage.local.get('tcaSamples', o => res((o.tcaSamples || []).slice(0, 6))));
}

// Keep only links to YOUR configured product domains; strip foreign/news links the model may pull from the post.
function allowedDomains() {
  try {
    return (typeof TCA_PRODUCTS !== 'undefined' ? TCA_PRODUCTS : [])
      .map(p => String(p.url || '').toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, ''))
      .filter(Boolean);
  } catch (e) { return []; }
}
const LINK_RE = /(https?:\/\/)?((?:[a-z0-9-]+\.)+(?:com|net|org|io|link|cloud|app|dev|co|ai|shop|store|info|biz|me|xyz|news|blog|site|online|tech|ua|ru|pl|de|uk|us|gg|tv))\b(\/[^\s)]*)?/gi;
function stripForeignLinks(text) {
  const allow = allowedDomains();
  return String(text).replace(LINK_RE, (m, proto, domain) => {
    const d = String(domain).toLowerCase().replace(/^www\./, '');
    if (allow.some(a => d === a || d.endsWith('.' + a))) return m; // keep your own product links
    return ''; // drop foreign links / news domains
  })
    .replace(/\[([^\]]*)\]\(\s*\)/g, '$1')  // markdown [text]() -> text (url was stripped)
    .replace(/\(\s*\[\s*\]\s*\)/g, '')      // ([]) leftover
    .replace(/\[\s*\]/g, '')                // []
    .replace(/\(\s*\)/g, '')                // ()
    .replace(/\s+([.,!?:;])/g, '$1')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

async function generate(s, messages, maxChars) {
  const r = await fetch(OPENROUTER, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + s.orKey, 'X-Title': 'Threads Comment Assistant' },
    body: JSON.stringify({
      model: s.model || 'google/gemini-2.5-flash-lite',
      max_tokens: 2000,
      temperature: 0.85,
      reasoning: { effort: 'low', exclude: true }, // harmless on non-reasoning models; caps thinking on ones that force it
      usage: { include: true }, // ask OpenRouter to report real cost (USD) + token totals
      messages
    })
  });
  const j = await r.json();
  if (!r.ok || j.error) return { ok: false, error: (j.error && j.error.message) || ('HTTP ' + r.status) };
  const cost = (j.usage && +j.usage.cost) || 0;
  const tokens = (j.usage && +j.usage.total_tokens) || 0;
  if (cost || tokens) addUsage(cost, tokens); // record actual spend (fire-and-forget, serialized)
  let out = (j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || '';
  out = String(out).trim().replace(/^["'«»“”\s]+|["'«»“”\s]+$/g, '').replace(/\s*[—–]\s*/g, ' - ');
  out = stripForeignLinks(out);
  const lim = maxChars || 480;
  if ([...out].length > lim) out = [...out].slice(0, lim - 1).join('') + '…';
  if (!out) return { ok: false, error: L('Пустой ответ модели.'), cost, tokens, build: TCA_BUILD };
  return { ok: true, draft: out, build: TCA_BUILD, tone: (s.__effTone || ''), cost, tokens };
}

const NO_KEY = { ok: false, error: L('Не задан ключ OpenRouter. Откройте настройки расширения (⚙).') };

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === 'draft') {
    (async () => {
      const s = await getSettings();
      if (!s.orKey) return sendResponse(NO_KEY);
      const samples = await getSamples();
      try { sendResponse(await generate(s, buildMessages(s, msg.text, msg.author, msg.product, msg.tone, samples), 480)); }
      catch (e) { sendResponse({ ok: false, error: String((e && e.message) || e) }); }
    })();
    return true;
  }
  if (msg && msg.type === 'draftPost') {
    (async () => {
      const s = await getSettings();
      if (!s.orKey) return sendResponse(NO_KEY);
      const samples = await getSamples();
      try { sendResponse(await generate(s, buildPostMessages(s, msg.topic, samples), 500)); }
      catch (e) { sendResponse({ ok: false, error: String((e && e.message) || e) }); }
    })();
    return true;
  }
  if (msg && msg.type === 'suggestTopics') {
    (async () => {
      const s = await getSettings();
      if (!s.orKey) return sendResponse(NO_KEY);
      const samples = await getSamples();
      try {
        const r = await generate(s, buildTopicsMessages(s, samples), 700);
        if (!r.ok) return sendResponse(r);
        const topics = r.draft.split('\n').map(x => x.replace(/^[\s\-\d.)•*]+/, '').trim()).filter(x => x.length > 3).slice(0, 8);
        sendResponse({ ok: true, topics: topics.length ? topics : (typeof TCA_POST_TOPICS !== 'undefined' ? TCA_POST_TOPICS.slice(0, 8) : []) });
      } catch (e) { sendResponse({ ok: false, error: String((e && e.message) || e) }); }
    })();
    return true;
  }
  if (msg && msg.type === 'pollNow') { poll(true).then(sendResponse); return true; }
});

// ---------- background topic search every N minutes ----------
const SEEN_KEY = 'tcaSeen';
const POLL_TOPICS = [
  ['SEO', 'SEO просування сайту'],
  ['WooCommerce', 'woocommerce магазин товари'],
  [L('Стартапы'), 'стартап засновник продукт'],
  ['WordPress', 'wordpress сайт'],
  [L('Дети'), 'виховання дітей завдання винагорода'],
  ['AI', 'штучний інтелект автоматизація'],
  [L('Приложения'), 'мобільний застосунок додаток']
];
let polling = false, rotateIdx = 0, lastPollUrl = null;

async function setupAlarm() {
  const s = await getSettings();
  await chrome.alarms.clear('tcaPoll');
  if (s.pollEnabled !== false) {
    const mins = Math.max(5, parseInt(s.pollMinutes, 10) || 15);
    chrome.alarms.create('tcaPoll', { periodInMinutes: mins, delayInMinutes: 1 });
  }
}
chrome.runtime.onInstalled.addListener(setupAlarm);
if (chrome.runtime.onStartup) chrome.runtime.onStartup.addListener(setupAlarm);
chrome.storage.onChanged.addListener((ch, area) => {
  if (area === 'sync' && (ch.pollEnabled || ch.pollMinutes)) setupAlarm();
});
chrome.alarms.onAlarm.addListener(a => { if (a.name === 'tcaPoll') poll(false); });
chrome.notifications.onClicked.addListener(() => { if (lastPollUrl) chrome.tabs.create({ url: lastPollUrl, active: true }); });
setupAlarm(); // also arm on worker (re)start

// On install/update/reload, re-inject the widget into already-open Threads tabs.
// (Content scripts aren't auto-re-injected, so the old in-page UI would go dead and
// its buttons would stop responding until a manual page refresh.)
chrome.runtime.onInstalled.addListener(() => {
  try {
    chrome.tabs.query({ url: ['https://www.threads.com/*', 'https://www.threads.net/*'] }, (tabs) => {
      for (const t of tabs || []) {
        if (!t.id) continue;
        chrome.scripting.insertCSS({ target: { tabId: t.id }, files: ['content.css'] }).catch(() => {});
        chrome.scripting.executeScript({ target: { tabId: t.id }, files: ['i18n.js', 'defaults.js', 'content.js'] }).catch(() => {});
      }
    });
  } catch (e) {}
});

// Toolbar badge = number of pending lead ("hot") posts found in the background.
async function refreshBadge() {
  try {
    const o = await chrome.storage.local.get(['tcaFound', 'tcaCommented']);
    const done = new Set(o.tcaCommented || []);
    const n = (o.tcaFound || []).filter(p => p.lead && !done.has(p.id)).length;
    chrome.action.setBadgeBackgroundColor({ color: '#f59e0b' });
    chrome.action.setBadgeText({ text: n ? String(n) : '' });
  } catch (e) {}
}
chrome.storage.onChanged.addListener((ch, area) => {
  if (area === 'local' && (ch.tcaFound || ch.tcaCommented)) refreshBadge();
});
refreshBadge();

// Open a background tab, ask its content script for relevant posts, then close it.
function collectFromTab(tabId, timeout) {
  return new Promise(resolve => {
    const start = Date.now();
    const tick = () => {
      chrome.tabs.sendMessage(tabId, { type: 'tcaCollect' }, (resp) => {
        const err = chrome.runtime.lastError;
        if (err || !resp) {
          if (Date.now() - start > timeout) return resolve(null);
          return setTimeout(tick, 1500);
        }
        if (resp.items && resp.items.length) return resolve(resp.items);
        if (Date.now() - start > timeout) return resolve(resp.items || []);
        setTimeout(tick, 1500);
      });
    };
    setTimeout(tick, 3500); // give the SPA time to render search results
  });
}

async function poll(manual) {
  if (polling) return { ok: false, error: 'busy' };
  const s = await getSettings();
  if (!manual && s.pollEnabled === false) return { ok: false, error: 'disabled' };
  polling = true;
  let created = null;
  try {
    const [label, q] = POLL_TOPICS[rotateIdx % POLL_TOPICS.length]; rotateIdx++;
    const url = 'https://www.threads.com/search?q=' + encodeURIComponent(q) + '&serp_type=default';
    lastPollUrl = url;
    created = await chrome.tabs.create({ url, active: false });
    const items = await collectFromTab(created.id, 14000);
    await chrome.tabs.remove(created.id).catch(() => {});
    created = null;
    if (!items || !items.length) return { ok: true, found: 0, label };
    const store = await chrome.storage.local.get(SEEN_KEY);
    const seen = new Set(store[SEEN_KEY] || []);
    const fresh = items.filter(p => p.id && !seen.has(p.id));
    fresh.forEach(p => seen.add(p.id));
    await chrome.storage.local.set({ [SEEN_KEY]: [...seen].slice(-600) });
    if (fresh.length) {
      // keep the found posts so the widget can show them in a separate "Найдено" tab
      const fStore = await chrome.storage.local.get('tcaFound');
      const add = fresh.map(p => ({ id: p.id, author: p.author, text: p.text, url: p.url, top: p.top, lead: !!p.lead, label, ts: Date.now() }));
      const merged = [...add, ...(fStore.tcaFound || [])].filter((p, i, a) => a.findIndex(q => q.id === p.id) === i).slice(0, 60);
      await chrome.storage.local.set({ tcaFound: merged });
      const top = fresh[0];
      chrome.notifications.create('tcaPoll', {
        type: 'basic',
        iconUrl: 'icon128.png',
        title: L('🧵 $1 новых постов по теме: $2', fresh.length, label),
        message: (top.author ? '@' + top.author + ': ' : '') + (top.text || '').replace(/\s+/g, ' ').slice(0, 140),
        priority: 1
      });
    }
    return { ok: true, found: fresh.length, label };
  } catch (e) {
    if (created) chrome.tabs.remove(created.id).catch(() => {});
    return { ok: false, error: String((e && e.message) || e) };
  } finally {
    polling = false;
  }
}
