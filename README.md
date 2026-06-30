# ClaudeRTL

**Right-to-left (Hebrew / Arabic) text support for the Claude Desktop app.**

A single JavaScript + CSS payload that detects right-to-left text in the Claude Desktop
UI and aligns it correctly — paragraphs, lists, tables, and even Hebrew/Arabic prose
that landed inside a code block — while keeping real code, LaTeX, and numbers
left-to-right.

It runs as a Chrome DevTools snippet. **It does no binary patching, no certificate
handling, and no integrity bypass — it only reads and styles the DOM.** Nothing is
written to disk, and it survives app updates.

> ⚠️ Unofficial community project. Not affiliated with or endorsed by Anthropic. A
> stopgap until Claude Desktop ships native RTL support.

---

## Features

- Detects RTL runs and aligns paragraphs, headings, lists, blockquotes, and table cells
  — in real time, including while a reply is still streaming in.
- Keeps **code** (`pre`, `code`, code-block containers) strictly left-to-right.
- Detects when a "code block" is actually **Hebrew/Arabic prose** (e.g. a report wrapped
  in a fence) and lets *those* read RTL, while real code stays LTR.
- Isolates **raw LaTeX** (`$x^2$`, `$$…$$`, `\(…\)`, `\[…\]`) as LTR islands inside RTL
  text, with a currency guard so `$5.99` stays plain text.
- Flips **Hebrew/Arabic tables** so the first column reads on the right; each cell keeps
  its own direction.
- Switches the **input box** direction live based on the first strong character.

---

## Quick start

This works on any Claude Desktop build and persists across restarts (the snippet is
saved in DevTools' own storage; you re-run it per session).

1. Open Claude Desktop and press **Ctrl+Alt+I** (Windows) / **Cmd-Option-I** (macOS) to
   open DevTools. *(You may see two DevTools windows — use the main one.)*
2. Go to the **Sources** tab → **Snippets** in the left panel (behind the `»` overflow
   if hidden) → **+ New snippet**, name it `claude-rtl`.
3. Paste the contents of [`claude-rtl.js`](claude-rtl.js) into the editor and press
   **Ctrl+S**.
4. Run it: **Ctrl+Enter** (or right-click the snippet → Run).

RTL applies immediately. Re-run it (click the snippet, then **Ctrl+Enter**) after
restarting Claude or after an update.

**Console fallback** (if you can't find Snippets): DevTools → **Console** tab → type
`allow pasting` and press Enter → paste the contents of `claude-rtl.js` → Enter. Same
effect, but you re-paste each session.

---

## How it works

`claude-rtl.js` injects a small stylesheet and runs a `MutationObserver`, so new and
streaming content is aligned automatically for the whole session. Direction is inferred
per element:

- **Direction**: first strong character, with a fallback that ignores leading filenames
  / URLs — so a Hebrew sentence opening with `patch.ps1` still reads RTL.
- **Code vs prose**: a code block flips to RTL only when strong-RTL letters outnumber
  Latin letters and code-symbol density is low. Real code — even with a Hebrew comment —
  stays LTR.
- **Tables**: the header row decides column direction; the first column tie-breaks.
- **Math**: unambiguous delimiters always isolate; single `$…$` only when it carries a
  real LaTeX signal (currency guard).
- Embedded LTR tokens (paths, package names, IDs) stay readable via
  `unicode-bidi: plaintext`.

The script exposes a `window.ClaudeRTL` API (`init`, `processAll`, `version`, …) and
auto-runs on load.

---

## Limitations

- **Not automatic.** The snippet must be re-run once per app session (a few keystrokes).
  There is no supported zero-click path that doesn't modify app files.
- **Heuristic, not perfect.** Direction is inferred from letter counts and character
  classes, so unusual mixes can occasionally guess wrong.
- **DevTools must be available** on your build for this to work. It generally is.

---

## Credits

Detection logic and CSS originate from
[`shraga100/claude-desktop-rtl-patch`](https://github.com/shraga100/claude-desktop-rtl-patch).
The LaTeX-isolation approach is credited there to
[Claude-UniMath](https://github.com/DavidiBellaire/Claude-UniMath) by Davidi Bellaire.

---

*Unofficial community project. "Claude" is a trademark of Anthropic; this project is not
affiliated with or endorsed by Anthropic.*
