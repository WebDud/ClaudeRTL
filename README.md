# claude-rtl-payload

**Right-to-left (Hebrew / Arabic) text support for the Claude Desktop app.**

A standalone JavaScript + CSS payload that detects right-to-left text in the Claude
Desktop UI and aligns it correctly — paragraphs, lists, tables, and even Hebrew/Arabic
prose that landed inside a code block — while keeping real code, LaTeX, and numbers
left-to-right.

It runs as a Chrome DevTools snippet. **It does no binary patching, no certificate
handling, and no integrity bypass — it only reads and styles the DOM.** Nothing is
written to disk, and it survives app updates.

> ⚠️ Unofficial, community project. Not affiliated with or endorsed by Anthropic. A
> stopgap until Claude Desktop ships native RTL support.

---

## Features

- Detects RTL runs and aligns paragraphs, headings, lists, blockquotes, and table cells
  — in real time, including while a reply is still streaming in.
- Keeps **code** (`pre`, `code`, code-block containers) strictly left-to-right.
- Detects when a "code block" is actually **Hebrew/Arabic prose** (e.g. a report Claude
  wrapped in a fence) and lets *those* read RTL, while real code stays LTR.
- Isolates **raw LaTeX** (`$x^2$`, `$$…$$`, `\(…\)`, `\[…\]`) as LTR islands inside RTL
  text, with a currency guard so `$5.99` stays plain text.
- Flips **Hebrew/Arabic tables** so the first column reads on the right; each cell keeps
  its own direction.
- Switches the **input box** direction live based on the first strong character.
- Embedded LTR tokens (paths, package names, IDs) stay readable via
  `unicode-bidi: plaintext`.

---

## Quick start (recommended: DevTools snippet)

This works on any Claude Desktop build and persists across restarts (the snippet is
saved in DevTools' own storage; you just re-run it per session).

1. Open Claude Desktop and press **Ctrl+Alt+I** (Windows) / **Cmd-Option-I** (macOS) to
   open DevTools. *(You may see two DevTools windows — use the main one.)*
2. Go to the **Sources** tab → **Snippets** in the left panel (behind the `»` overflow
   if hidden) → **+ New snippet**, name it `claude-rtl`.
3. Paste the contents of [`dist/claude-rtl.js`](dist/claude-rtl.js) into the editor and
   press **Ctrl+S**.
4. Run it: **Ctrl+Enter** (or right-click the snippet → Run).

RTL applies immediately. Re-run it (steps 3–4, click + Ctrl+Enter) after restarting
Claude or after an update.

**Console fallback** (if you can't find Snippets): DevTools → **Console** tab → type
`allow pasting` and Enter → paste `dist/claude-rtl.js` → Enter. Same effect, but you
re-paste each session.

## How it works

Three layers, joined at build time:

- **`src/rtl-core.js`** — pure, DOM-free detection engine; the single source of truth.
  Kept DOM-free so it's unit-testable in plain Node.
- **`src/rtl-payload.js`** — the DOM layer (an IIFE). Reads/styles the page, injects CSS,
  and runs a `MutationObserver` so new and streaming content is handled. Exposes a small
  `window.ClaudeRTL` API and auto-runs on load.
- **`tools/build.js`** — inlines the core into the payload at the `/*__RTL_CORE__*/`
  marker, producing the single injectable **`dist/claude-rtl.js`**.

Detection highlights:

- **Direction**: first-strong-character with a fallback that strips leading filenames /
  URLs, so a Hebrew sentence opening with `patch.ps1` still reads RTL.
- **Code-block prose vs real code** (`looksLikeRTLProse`): a block flips RTL only when
  strong-RTL letters outnumber Latin letters **and** code-symbol density is low. Real
  code — even with a Hebrew comment — stays LTR.
- **Tables**: header row decides column direction; first column tie-breaks.
- **Math**: unambiguous delimiters always isolate; single `$…$` only when it carries a
  real LaTeX signal (currency guard).

---

## Limitations

- **Not automatic.** The snippet must be re-run once per app session (a few keystrokes).
  There is no supported zero-click path that doesn't modify app files.
- **Heuristic, not perfect.** Direction is inferred from letter counts and character
  classes, so unusual mixes can occasionally guess wrong. Tunable (see above).
- **DevTools must be available** on your build for the snippet method. It generally is.


---

## Credits

Detection logic and CSS originate from
[`shraga100/claude-desktop-rtl-patch`](https://github.com/shraga100/claude-desktop-rtl-patch).
The LaTeX-isolation approach is credited there to
[Claude-UniMath](https://github.com/DavidiBellaire/Claude-UniMath) by Davidi Bellaire.

---

*Unofficial community project. "Claude" is a trademark of Anthropic; this project is not
affiliated with or endorsed by Anthropic.*
