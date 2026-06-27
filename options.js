// Settings: voice/guidelines/key come pre-filled from defaults.js (+ optional
// config.local.js). The model is chosen from live OpenRouter tiles with prices.

function setVal(el, v) { if (el.type === 'checkbox') el.checked = !!v; else el.value = v; }
function getVal(el, def) {
  if (el.type === 'checkbox') return el.checked;
  if (el.type === 'number') { const n = parseInt(el.value, 10); return isNaN(n) ? def : n; }
  return el.value;
}

// ---------- model picker ----------
let MODELS = [], modelView = 'rec', selectedModel = '';
const REC = ['google/gemini-2.5-flash', 'google/gemini-2.5-flash-lite', 'google/gemini-3', 'openai/gpt-4o-mini', 'openai/gpt-4.1-mini', 'openai/gpt-5', 'anthropic/claude-3.5-haiku', 'anthropic/claude-haiku-4', 'anthropic/claude-sonnet-4', 'meta-llama/llama-3.3-70b', 'deepseek/deepseek-chat', 'x-ai/grok'];
function isRec(id) { return REC.some(r => id.indexOf(r) === 0 || id.indexOf(r) > -1); }
function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function price(p) { p = +p; if (!p) return '—'; const m = p * 1e6; return '$' + (m < 1 ? m.toFixed(3) : m.toFixed(2)); }
// Estimated cost of ONE typical comment (~2600 input + 160 output tokens) so the real
// price is tangible at selection time (per-million numbers are easy to misjudge).
function estComment(m) { try { return (+m.pricing.prompt) * 2600 + (+m.pricing.completion) * 160; } catch (e) { return 0; } }
function estFmt(c) { c = +c || 0; if (!c) return '—'; return '$' + (c >= 0.001 ? c.toFixed(4) : Number(c.toPrecision(2))); }
function estColor(c) { return c <= 0.001 ? '#1a7f37' : c <= 0.01 ? '#b26a00' : '#c0392b'; } // green / amber / red

async function loadModels() {
  const tiles = document.getElementById('modelTiles');
  try {
    const j = await (await fetch('https://openrouter.ai/api/v1/models')).json();
    MODELS = (j.data || []).filter(m => {
      const a = m.architecture || {};
      const out = a.output_modalities || [], inp = a.input_modalities || [];
      return (!out.length || out.includes('text')) && (!inp.length || inp.includes('text')) && m.pricing;
    });
    renderModels();
  } catch (e) { tiles.textContent = L('Не удалось загрузить модели (') + (e.message || e) + L('). Можно вписать id вручную в поиск и выбрать.'); }
}
function renderModels() {
  const tiles = document.getElementById('modelTiles');
  const q = (document.getElementById('modelSearch').value || '').toLowerCase().trim();
  let list = MODELS.slice();
  if (q) list = list.filter(m => (m.id + ' ' + (m.name || '')).toLowerCase().includes(q));
  else if (modelView === 'rec') list = list.filter(m => isRec(m.id));
  list.sort((a, b) => (+a.pricing.completion - +b.pricing.completion) || (+a.pricing.prompt - +b.pricing.prompt));
  list = list.slice(0, 120);
  // make sure the selected model is visible even if filtered out
  if (selectedModel && !list.some(m => m.id === selectedModel)) {
    const sel = MODELS.find(m => m.id === selectedModel); if (sel) list.unshift(sel);
  }
  tiles.innerHTML = '';
  if (!list.length) { tiles.textContent = L('Ничего не найдено.'); return; }
  list.forEach(m => {
    const t = document.createElement('div'); t.className = 'tile' + (m.id === selectedModel ? ' on' : '');
    const ec = estComment(m);
    t.innerHTML = '<div class="nm">' + esc(m.name || m.id) + '</div><div class="id">' + esc(m.id) + '</div>' +
      '<div class="est" style="font-weight:700;margin:3px 0 1px;color:' + estColor(ec) + '">≈ ' + estFmt(ec) + L(' / коммент') + '</div>' +
      L('<div class="pr">вход <b>') + price(m.pricing.prompt) + L('</b> · выход <b>') + price(m.pricing.completion) + '</b></div>';
    t.onclick = () => { selectedModel = m.id; document.getElementById('model').value = m.id; renderModels(); };
    tiles.appendChild(t);
  });
}

// ---------- load / save ----------
function load() {
  chrome.storage.sync.get(TCA_DEFAULTS, (s) => {
    for (const k in TCA_DEFAULTS) {
      const el = document.getElementById(k);
      if (el) setVal(el, s[k]);
    }
    selectedModel = s.model || TCA_DEFAULTS.model || '';
    document.getElementById('model').value = selectedModel;
    loadModels();
  });
}

document.getElementById('save').addEventListener('click', () => {
  const o = {};
  for (const k in TCA_DEFAULTS) {
    const el = document.getElementById(k);
    o[k] = el ? getVal(el, TCA_DEFAULTS[k]) : TCA_DEFAULTS[k];
  }
  chrome.storage.sync.set(o, () => {
    const st = document.getElementById('status');
    st.textContent = L('Сохранено ✓');
    setTimeout(() => (st.textContent = ''), 2000);
  });
});

document.getElementById('modelSearch').addEventListener('input', renderModels);
document.getElementById('tabRec').addEventListener('click', () => { modelView = 'rec'; document.getElementById('tabRec').classList.add('on'); document.getElementById('tabAll').classList.remove('on'); renderModels(); });
document.getElementById('tabAll').addEventListener('click', () => { modelView = 'all'; document.getElementById('tabAll').classList.add('on'); document.getElementById('tabRec').classList.remove('on'); renderModels(); });

if (typeof tcaLocalizeDom === 'function') tcaLocalizeDom();
load();
