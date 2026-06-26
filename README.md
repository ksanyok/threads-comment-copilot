<div align="center">

<img src="icon128.png" width="88" height="88" alt="Threads Comment Assistant" />

# Threads Comment Assistant

**Reply on Threads in *your* voice — in one click.**
A Chrome extension that drafts thoughtful, on‑brand comments and posts with AI, right where you browse. You review and publish. Nothing is ever auto‑posted.

<sub>Manifest V3 · Chrome / Edge / Brave · Bring your own OpenRouter key · 100% local</sub>

</div>

---

## ✨ What it does

You scroll Threads. The extension quietly highlights the threads worth replying to, and writes a genuinely useful comment in your voice the moment you ask — then drops it straight into the native reply box for you to publish.

- **🎯 Finds the right threads.** Highlights posts that match your topics, and floats **lead** posts (questions, “looking for / how do I…”) to the top — the ones most likely to win you clients and followers.
- **✍️ Writes in your voice.** One click drafts a comment from your configured tone and style. Pick **Auto / Witty / Mentor** per comment.
- **📨 Drops it into the reply box.** Opens the post’s native composer and inserts the draft. You read it, tweak it, hit **Post**. Never automatic.
- **🗂 A side panel that works like a deck.** Tabs for **On‑page · All · Found · Product · History · Post**:
  - **Found** — a background search (every N minutes) surfaces fresh matching threads even when Threads isn’t on screen, with a desktop notification.
  - **Product** — pick one of your products and see only the posts where it fits; the comment is focused on that product.
  - **History** — everything you’ve written, so you never reply twice (written posts get a ✓ and are skipped).
  - **Post** — generate an original post for your **own** feed from AI‑suggested topics.
- **🔔 Stays out of your way.** Your own threads are excluded. Follows/likes on the Activity page are ignored — only real replies to you are surfaced.
- **🧠 Learns your style.** Picks up your past posts and comments as voice samples for better drafts.
- **💸 Cheap and fast.** Uses OpenRouter — choose any current model from a live, price‑tagged picker (defaults to a lightweight, inexpensive model).

> **Privacy first.** The extension talks only to OpenRouter (for generation) using **your** key. Your settings, samples and history stay in your browser. Nothing is posted on your behalf.

---

## 🚀 Install

### From source (developer mode)
1. Download or clone this repo.
2. Open `chrome://extensions` and turn on **Developer mode**.
3. Click **Load unpacked** and select the folder.
4. Click the toolbar icon → open **Settings (⚙)** → paste your [OpenRouter API key](https://openrouter.ai/keys) → **Save**.

That’s it. Open Threads and start replying.

*(A Chrome Web Store listing is on the way.)*

---

## ⚙️ Configuration

Everything is in **Settings** (gear icon in the popup):

| Setting | What it does |
| --- | --- |
| **OpenRouter API key** | Your key from [openrouter.ai/keys](https://openrouter.ai/keys). Stored only in your browser. |
| **AI model** | Live tiles from OpenRouter with **input/output prices**, search, and a “Recommended/All” toggle. |
| **Threads handle** | So your own posts aren’t suggested back to you. |
| **Voice / Guidelines** | How you write, and when (if ever) to mention your products. |
| **Language** | `auto` follows the post’s language. |
| **Auto‑search** | On/off and interval for the background topic search. |

### Make it *yours* (optional `config.local.js`)
For a personal, ready‑to‑go setup, create **`config.local.js`** (it’s `.gitignore`d — your secrets never get committed):

```js
(function () {
  if (typeof TCA_DEFAULTS === 'undefined') return;
  TCA_DEFAULTS.orKey   = 'sk-or-v1-...';      // your OpenRouter key
  TCA_DEFAULTS.myHandle = 'yourhandle';        // your Threads @handle, without @
  TCA_DEFAULTS.voice    = 'How you write…';
  TCA_DEFAULTS.guidelines = 'Your rules + products…';

  // Optional: products for the "Product" tab + focused comments
  if (typeof TCA_PRODUCTS !== 'undefined') {
    TCA_PRODUCTS.length = 0;
    TCA_PRODUCTS.push({
      key: 'myapp', name: 'MyApp', label: 'MyApp', url: 'myapp.com',
      desc: 'what MyApp is, accurately',
      match: ['keyword', 'another keyword']    // posts where MyApp fits
    });
  }
})();
```

The shipped build is **fully generic** — no key, no voice, no products. All personalization is yours and stays local.

---

## 🛠 How it works

- **Manifest V3.** A background service worker calls the OpenRouter Chat Completions API directly with your key. No server, no middleman.
- **Content script** reads the visible posts, scores relevance with simple keyword sets, and renders the overlay UI (highlights, side panel, composer card). It inserts drafts into Threads’ own reply box via `execCommand` and never clicks “Post”.
- **Storage.** `chrome.storage` keeps your settings (sync) and your samples/history/found posts (local).

```
defaults.js     shared config + relevance/topic logic (generic)
background.js    service worker: generation, background search, notifications
content.js       in‑page overlay: highlights, side panel, composer
options.*        settings UI (model picker, voice, products…)
popup.*          toolbar popup: suggestions, post writer
config.local.js  your local overrides (gitignored)
```

---

## 🔒 Privacy

- The only network calls are to **OpenRouter** (generation) and **Threads** (the pages you’re already on).
- Your API key, voice, products, samples and history never leave your browser except as part of the prompt you send to OpenRouter.
- The extension does not post, like, follow, or message on your behalf.

---

## 🤝 Contributing

Issues and PRs welcome. Keep the shipped code generic — personal data belongs in `config.local.js`.

## 📄 License

[MIT](LICENSE).
