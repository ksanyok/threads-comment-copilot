# Privacy Policy — Threads Comment Assistant

_Last updated: 2026-06-26_

Threads Comment Assistant ("the extension") is a browser tool that helps you draft
comments and posts for Threads. We designed it to be private by default.

## What the extension stores
All of the following is stored **only in your browser** via `chrome.storage`, and is
never sent to the developer or any third party other than your chosen AI provider:

- Your **OpenRouter API key**.
- Your **settings** (voice, guidelines, model, language, handle, search options).
- **Voice samples** — snippets of your own posts/comments, used to match your style.
- **History** of drafts you generated, and posts the background search found.

## What is sent, and to whom
- **OpenRouter (`openrouter.ai`).** To generate a comment or post, the extension sends
  the relevant post text and your configured voice/guidelines/samples to OpenRouter
  using **your own API key**. This is the only external service the extension calls for
  generation. See OpenRouter's privacy policy at https://openrouter.ai/privacy.
- **Threads (`threads.com` / `threads.net`).** The extension runs on pages you already
  have open, reads visible posts, and (when you ask) opens Threads' own search and
  reply composer. It does **not** post, like, follow, or message on your behalf.

## What the extension does NOT do
- No analytics, telemetry, tracking, ads, or fingerprinting.
- No data is sent to the extension's developer.
- No selling or sharing of any data.
- Nothing is published to Threads automatically — you always review and click Post.

## Permissions
- `storage` — save your settings and local data in your browser.
- `alarms` — schedule the optional background topic search.
- `notifications` — tell you when new matching threads are found.
- Host access to `openrouter.ai`, `threads.com`, `threads.net` — to generate drafts and
  to read/assist on the Threads pages you use.

## Your control
Open the extension's Settings to change or remove your key and data at any time, or
remove the extension to delete everything it stored.

## Contact
Questions: ksanyokm@gmail.com
