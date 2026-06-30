// claude-rtl.js — built artifact. DO NOT EDIT BY HAND.
// Source: src/rtl-payload.js + src/rtl-core.js. Rebuild with `npm run build`.
// Built: 2026-06-30T13:40:26.254Z
// rtl-payload.js — DOM layer for the Claude RTL payload.
//
// This is the browser-side wrapper around the pure detection core. At build time,
// tools/build.js replaces the RTL-core marker below (an inline comment token) with
// the body of src/rtl-core.js, producing the standalone, injectable dist/claude-rtl.js.
//
// It auto-runs on load unless window.__CLAUDE_RTL_NO_AUTOINIT__ is set (used by the
// demo harness so the page can drive it manually). Either way it exposes a small API
// on window.ClaudeRTL.
//
// No binary patching, no certificate handling, no integrity bypass — this file only
// reads and styles the DOM.
;(function () {
    'use strict';
    if (typeof document === 'undefined') return;
    try {
        var VERSION = '1.0.0';
        var WRITING_SEL = '[data-testid="chat-input"]';

        // --- PURE DETECTION CORE (inlined from src/rtl-core.js by tools/build.js) ---
        // rtl-core.js — pure, DOM-free RTL / LaTeX detection logic.
        //
        // This is the SINGLE SOURCE OF TRUTH for the detection engine. It is intentionally
        // DOM-free so it stays unit-testable in plain Node. tools/build.js inlines the
        // body of this file into the injected payload (dist/claude-rtl.js) at build time,
        // stripping the module.exports guard at the bottom. test/rtl-core.test.js requires
        // this file directly.
        //
        // Detection logic adapted from shraga100/claude-desktop-rtl-patch (MIT). The
        // LaTeX-isolation approach is credited there to Claude-UniMath by Davidi Bellaire.
        'use strict';

        // Strong-RTL code-point ranges, [lo, hi] inclusive. Covers the modern living RTL
        // scripts plus common historic/astral ones. Tested against code points
        // (codePointAt), NOT UTF-16 code units, so astral blocks like Adlam work.
        var RTL_RANGES = [
            [0x0590, 0x05FF],   // Hebrew
            [0x0600, 0x06FF],   // Arabic
            [0x0700, 0x074F],   // Syriac
            [0x0750, 0x077F],   // Arabic Supplement
            [0x0780, 0x07BF],   // Thaana
            [0x07C0, 0x07FF],   // NKo
            [0x0800, 0x083F],   // Samaritan
            [0x0840, 0x085F],   // Mandaic
            [0x0860, 0x086F],   // Syriac Supplement
            [0x0870, 0x089F],   // Arabic Extended-B
            [0x08A0, 0x08FF],   // Arabic Extended-A
            [0xFB1D, 0xFB4F],   // Hebrew presentation forms
            [0xFB50, 0xFDFF],   // Arabic presentation forms-A
            [0xFE70, 0xFEFF],   // Arabic presentation forms-B
            [0x10800, 0x1083F], // Cypriot Syllabary block (incl. early RTL scripts)
            [0x10840, 0x1085F], // Imperial Aramaic
            [0x10A00, 0x10A5F], // Kharoshthi
            [0x10E60, 0x10E7F], // Rumi Numeral Symbols
            [0x1E800, 0x1E8DF], // Mende Kikakui
            [0x1E900, 0x1E95F], // Adlam
            [0x1EE00, 0x1EEFF]  // Arabic Mathematical Alphabetic Symbols
        ];

        // cp: a Unicode code point (from String.prototype.codePointAt).
        function isRTL(cp) {
            for (var i = 0; i < RTL_RANGES.length; i++) {
                if (cp >= RTL_RANGES[i][0] && cp <= RTL_RANGES[i][1]) return true;
            }
            return false;
        }

        // Does the string contain any strong-RTL character? Code-point aware (astral safe).
        function hasRTL(text) {
            if (!text) return false;
            for (var i = 0; i < text.length;) {
                var cp = text.codePointAt(i);
                if (isRTL(cp)) return true;
                i += cp > 0xFFFF ? 2 : 1;
            }
            return false;
        }

        // Direction of the first strong character: 'rtl', 'ltr', or null (no strong char).
        function firstStrong(text) {
            if (!text) return null;
            for (var i = 0; i < text.length;) {
                var cp = text.codePointAt(i);
                if (isRTL(cp)) return 'rtl';
                // ASCII Latin letters are strong-LTR.
                if ((cp >= 0x41 && cp <= 0x5A) || (cp >= 0x61 && cp <= 0x7A)) return 'ltr';
                i += cp > 0xFFFF ? 2 : 1;
            }
            return null;
        }

        // Remove leading LTR-only noise (filenames, URLs, paths, backtick-code) so a Hebrew
        // sentence that opens with "foo.js" or `code` still detects as RTL.
        function stripLeadingLTR(text) {
            return text
                .replace(/^[\s]*(?:[\w.\-]+\.[\w]{1,5})\s*/g, '')
                .replace(/https?:\/\/\S+/g, '')
                .replace(/[\w.\-]+[\/\\][\w.\-\/\\]+/g, '')
                .replace(/`[^`]+`/g, '');
        }

        // A "$...$" body is treated as math only when it carries a real LaTeX signal. This
        // is the currency guard: "$5.99" or "$5 to $10" lack the signal and stay text.
        var LATEX_SIGNAL = /[\\^_{}]|\b(?:frac|sqrt|sum|prod|int|lim|infty|cdot|times|div|leq|geq|neq|approx|partial|nabla|alpha|beta|gamma|delta|theta|lambda|mu|pi|sigma|omega|matrix|begin|end|left|right|text|mathbb|mathcal|vec|hat|bar|overline|underline)\b/;

        function hasLatexSignal(body) {
            return LATEX_SIGNAL.test(body);
        }

        // Find math regions as [start, end) index pairs over `text`. Unambiguous delimiters
        // ($$...$$, \[...\], \(...\)) always count; single $...$ only counts with a LaTeX
        // signal and only outside already-claimed regions.
        function findLatexRanges(text) {
            var ranges = [];
            if (!text) return ranges;

            function overlaps(s, e) {
                for (var i = 0; i < ranges.length; i++) {
                    if (s < ranges[i][1] && e > ranges[i][0]) return true;
                }
                return false;
            }
            function claim(re, requireSignal, bodyStart, bodyEnd) {
                var m;
                re.lastIndex = 0;
                while ((m = re.exec(text)) !== null) {
                    var start = m.index;
                    var end = m.index + m[0].length;
                    if (overlaps(start, end)) continue;
                    if (requireSignal) {
                        var body = m[0].slice(bodyStart, m[0].length - bodyEnd);
                        if (!hasLatexSignal(body)) continue;
                    }
                    ranges.push([start, end]);
                }
            }

            // Order matters: claim the unambiguous, greedier delimiters first.
            claim(/\$\$[\s\S]+?\$\$/g, false, 0, 0);
            claim(/\\\[[\s\S]+?\\\]/g, false, 0, 0);
            claim(/\\\([\s\S]+?\\\)/g, false, 0, 0);
            // Single $...$ — no newline inside, must carry a LaTeX signal (currency guard).
            claim(/\$[^$\n]+?\$/g, true, 1, 1);

            ranges.sort(function (a, b) { return a[0] - b[0]; });
            return ranges;
        }

        // Split text into alternating {type:'text'|'math', value} segments.
        function segmentText(text) {
            var segs = [];
            if (!text) return segs;
            var ranges = findLatexRanges(text);
            if (!ranges.length) {
                segs.push({ type: 'text', value: text });
                return segs;
            }
            var pos = 0;
            for (var i = 0; i < ranges.length; i++) {
                if (ranges[i][0] > pos) {
                    segs.push({ type: 'text', value: text.slice(pos, ranges[i][0]) });
                }
                segs.push({ type: 'math', value: text.slice(ranges[i][0], ranges[i][1]) });
                pos = ranges[i][1];
            }
            if (pos < text.length) segs.push({ type: 'text', value: text.slice(pos) });
            return segs;
        }

        // Classify a table cell's direction from its text. A cell counts as RTL if it
        // *contains* any RTL character — not merely if its first strong char is RTL. Header
        // labels often start with a Latin term ("blob ...", "ID ...") yet belong to a Hebrew
        // column, so first-strong is too weak here. Neutral cells (digits / punctuation only)
        // return null so they do not sway the majority.
        function cellDir(text) {
            if (hasRTL(text)) return 'rtl';
            if (firstStrong(text) === 'ltr') return 'ltr';
            return null;
        }

        // Decide a table's column direction from header / first-column cell dirs. Each input
        // is an array of 'rtl' | 'ltr' | null. Header wins; first column is the tie-breaker.
        // Returns 'rtl' (flip columns) or null (leave LTR).
        function tableDirFromCells(headerDirs, firstColDirs) {
            // First header is the semantic key column (row labels). If it's RTL and the first
            // data cell agrees, it's a Hebrew table regardless of how many entity names appear
            // as LTR in later headers.
            if (headerDirs && headerDirs[0] === 'rtl' &&
                    firstColDirs && firstColDirs[0] === 'rtl') return 'rtl';
            var h = majorityDir(headerDirs || []);
            if (h === 'rtl') return 'rtl';
            if (h === 'ltr') return null;
            var c = majorityDir(firstColDirs || []);
            return c === 'rtl' ? 'rtl' : null;
        }

        function majorityDir(dirs) {
            var r = 0, l = 0;
            for (var i = 0; i < dirs.length; i++) {
                if (dirs[i] === 'rtl') r++;
                else if (dirs[i] === 'ltr') l++;
            }
            if (r > l) return 'rtl';
            if (l > r) return 'ltr';
            return null;
        }

        // Decide whether a code block is actually RTL prose (e.g. a Hebrew report Claude
        // wrapped in a fence) rather than real code. Code blocks are normally pinned LTR, but
        // that's wrong when the content is prose. Signal: more strong-RTL letters than Latin
        // letters, and a low density of code punctuation. Real code — even with a Hebrew
        // comment or string — stays Latin-heavy and/or symbol-dense, so it returns false.
        var CODE_SYMBOLS = '{}[]();=<>|\\/`';

        function looksLikeRTLProse(text) {
            if (!hasRTL(text)) return false;
            var rtl = 0, latin = 0, sym = 0, total = 0;
            for (var i = 0; i < text.length;) {
                var cp = text.codePointAt(i);
                i += cp > 0xFFFF ? 2 : 1;
                total++;
                if (isRTL(cp)) rtl++;
                else if ((cp >= 0x41 && cp <= 0x5A) || (cp >= 0x61 && cp <= 0x7A)) latin++;
                else if (cp < 0x80 && CODE_SYMBOLS.indexOf(String.fromCharCode(cp)) >= 0) sym++;
            }
            if (rtl <= latin) return false;               // Latin-heavy -> treat as code
            if (sym / (total || 1) > 0.08) return false;   // symbol-dense -> real code
            return true;
        }
        // --- END PURE DETECTION CORE ---

        // Text of an element, excluding <code>/<pre> children (DOM-aware).
        function textWithoutCode(el) {
            var out = '';
            var nodes = el.childNodes;
            for (var i = 0; i < nodes.length; i++) {
                var n = nodes[i];
                if (n.nodeType === 3) { out += n.textContent; }
                else if (n.nodeType === 1 && n.tagName !== 'CODE' && n.tagName !== 'PRE') {
                    out += textWithoutCode(n);
                }
            }
            return out;
        }

        // --- PER-LINE DIRECTIONAL SPLITTING ---
        // A paragraph carrying multiple lines (via <br> or newlines), each in a
        // different script, would be mangled by a single dir. Defer to
        // unicode-bidi:plaintext so each line auto-picks direction from first-strong.
        var RTL_SPLIT_FLAG = 'data-rtl-split';
        var BR_OR_NL_SPLIT = /(<br\s*\/?>|\n)/i;

        function hasMultiScriptLines(el) {
            var src = el.textContent;
            if (!src) return false;
            if (!/[a-zA-Z]{2,}/.test(src)) return false;
            if (!hasRTL(src)) return false;
            return BR_OR_NL_SPLIT.test(el.innerHTML) || src.indexOf('\n') !== -1;
        }

        function splitToDirectionalSpans(el) {
            if (el.hasAttribute(RTL_SPLIT_FLAG)) return;
            // No innerHTML rewriting — that breaks React reconciliation. Defer to
            // unicode-bidi:plaintext: <br> is a paragraph separator in the Unicode
            // BiDi algorithm, so each line auto-picks its direction.
            el.setAttribute(RTL_SPLIT_FLAG, '1');
            if (el.hasAttribute('dir')) el.removeAttribute('dir');
            el.style.direction = '';
            el.style.textAlign = 'start';
            el.style.unicodeBidi = 'plaintext';
        }

        // If an element inherits RTL via a parent CSS class (not its own dir attr),
        // removing dir alone won't free it — pin direction:ltr.
        function resetDirOrPinLTR(el) {
            if (window.getComputedStyle(el).direction === 'rtl') {
                el.dir = 'ltr';
                el.style.direction = 'ltr';
                return;
            }
            if (el.hasAttribute('dir')) el.removeAttribute('dir');
            el.style.direction = '';
        }

        // --- HYBRID DIRECTION DETECTION ---

        // For DOM elements (output): 3-layer detection.
        function detectElDir(el) {
            var full = el.textContent || '';
            if (!hasRTL(full)) return null;
            // Layer 1: first-strong on text excluding <code> children.
            var noCode = textWithoutCode(el);
            var d = firstStrong(noCode);
            if (d === 'rtl') return 'rtl';
            // Layer 2: strip leading filenames/URLs, then first-strong.
            var stripped = stripLeadingLTR(noCode);
            d = firstStrong(stripped);
            if (d === 'rtl') return 'rtl';
            // Layer 3: RTL chars exist but hide behind code/filenames -> treat as RTL.
            return 'rtl';
        }

        // For plain text (input box, dialogs without DOM structure).
        function detectTextDir(text) {
            if (!text || !text.trim()) return null;
            var d = firstStrong(text);
            if (d === 'rtl') return 'rtl';
            if (!hasRTL(text)) return 'ltr';
            var stripped = stripLeadingLTR(text);
            d = firstStrong(stripped);
            if (d === 'rtl') return 'rtl';
            return 'rtl';
        }

        // --- ELEMENT PROCESSING ---

        // querySelectorAll that INCLUDES root itself if it matches.
        function qsa(root, sel) {
            var base = root.querySelectorAll ? root : document;
            var els = Array.prototype.slice.call(base.querySelectorAll(sel));
            if (root.matches && root.matches(sel)) els.unshift(root);
            return els;
        }

        var PRE_RTL_FLAG = 'data-rtl-pre';

        function setImportant(el, prop, val) { el.style.setProperty(prop, val, 'important'); }

        function forceCodeLTR(root) {
            qsa(root, 'pre, .code-block__code, .relative.group\\/copy').forEach(function (b) {
                if (looksLikeRTLProse(b.textContent || '')) {
                    // Hebrew/Arabic prose that happens to sit in a code fence — let it
                    // read RTL. unicode-bidi:plaintext keeps embedded LTR tokens
                    // (paths, IDs, package names) internally correct.
                    b.setAttribute(PRE_RTL_FLAG, 'rtl');
                    if (b.hasAttribute('dir')) b.removeAttribute('dir');
                    setImportant(b, 'direction', 'rtl');
                    setImportant(b, 'text-align', 'right');
                    setImportant(b, 'unicode-bidi', 'plaintext');
                } else {
                    if (b.getAttribute(PRE_RTL_FLAG) === 'rtl') {
                        b.removeAttribute(PRE_RTL_FLAG);
                        b.style.removeProperty('direction');
                        b.style.removeProperty('text-align');
                        b.style.removeProperty('unicode-bidi');
                    }
                    b.dir = 'ltr'; b.style.textAlign = 'left'; b.style.unicodeBidi = 'embed';
                }
            });
            qsa(root, 'code').forEach(function (c) {
                var pre = c.closest('pre, .code-block__code');
                if (pre && pre.getAttribute(PRE_RTL_FLAG) === 'rtl') {
                    // Override the generic code{direction:ltr} rule for prose blocks.
                    if (c.hasAttribute('dir')) c.removeAttribute('dir');
                    setImportant(c, 'direction', 'rtl');
                    setImportant(c, 'unicode-bidi', 'plaintext');
                    setImportant(c, 'text-align', 'right');
                    return;
                }
                if (!pre) c.dir = 'ltr';
            });
            // Rendered math (KaTeX/MathJax), if present, is an LTR island too.
            qsa(root, '.katex, .katex-display, mjx-container').forEach(function (m) {
                m.style.unicodeBidi = 'isolate'; m.style.direction = 'ltr';
            });
        }

        // --- RAW LaTeX ISOLATION ---
        // Claude Desktop (Windows) may show raw "$...$" text. Inside an RTL paragraph
        // the neutral $ \ { } chars scramble the formula, so isolate each math segment
        // in its own ltr / unicode-bidi:isolate span. Replace a single TEXT node with a
        // fragment (replaceChild) — never innerHTML — to stay gentle on React.
        var ISLAND_FLAG = 'data-rtl-island';

        function isolateMath(root) {
            if (typeof document.createTreeWalker !== 'function') return;
            var host = (root && root.nodeType === 1) ? root : document.body;
            if (!host) return;
            var walker = document.createTreeWalker(host, NodeFilter.SHOW_TEXT, {
                acceptNode: function (node) {
                    var v = node.nodeValue;
                    if (!v || (v.indexOf('$') === -1 && v.indexOf('\\') === -1)) return NodeFilter.FILTER_REJECT;
                    var p = node.parentElement;
                    if (!p) return NodeFilter.FILTER_REJECT;
                    if (p.tagName === 'SCRIPT' || p.tagName === 'STYLE') return NodeFilter.FILTER_REJECT;
                    if (p.closest('pre, code, .code-block__code, [' + ISLAND_FLAG + '], ' + WRITING_SEL)) return NodeFilter.FILTER_REJECT;
                    return NodeFilter.FILTER_ACCEPT;
                }
            });
            // Collect first — mutating during the walk invalidates the walker.
            var targets = [];
            var n;
            while ((n = walker.nextNode())) targets.push(n);
            targets.forEach(function (textNode) {
                var segs = segmentText(textNode.nodeValue);
                var hasMath = segs.some(function (s) { return s.type === 'math'; });
                if (!hasMath) return;
                var frag = document.createDocumentFragment();
                segs.forEach(function (s) {
                    if (s.type === 'math') {
                        var span = document.createElement('span');
                        span.setAttribute(ISLAND_FLAG, '1');
                        span.style.unicodeBidi = 'isolate';
                        span.style.direction = 'ltr';
                        span.textContent = s.value;
                        frag.appendChild(span);
                    } else {
                        frag.appendChild(document.createTextNode(s.value));
                    }
                });
                if (textNode.parentNode) textNode.parentNode.replaceChild(frag, textNode);
            });
        }

        // --- TABLE COLUMN ORDERING ---
        // A Hebrew table should read right-to-left (first column on the right). Per-cell
        // direction is handled by processText; here we only flip the whole table's
        // column order via dir="rtl" on a stable <table> element (no text surgery).
        var TABLE_FLAG = 'data-rtl-table';

        function processTables(root) {
            qsa(root, 'table').forEach(function (t) {
                if (t.getAttribute(TABLE_FLAG) === 'rtl') return;
                if (t.closest(WRITING_SEL)) return;
                var headerCells = Array.prototype.slice.call(t.querySelectorAll('thead th'));
                if (!headerCells.length) {
                    var firstRow = t.querySelector('tr');
                    if (firstRow) headerCells = Array.prototype.slice.call(firstRow.querySelectorAll('th, td'));
                }
                var headerDirs = headerCells.map(function (c) { return cellDir(c.textContent || ''); });
                var rows = Array.prototype.slice.call(t.querySelectorAll('tbody tr'));
                if (!rows.length) rows = Array.prototype.slice.call(t.querySelectorAll('tr')).slice(1);
                var firstColDirs = rows.map(function (r) {
                    var cell = r.querySelector('th, td');
                    return cell ? cellDir(cell.textContent || '') : null;
                });
                if (tableDirFromCells(headerDirs, firstColDirs) === 'rtl') {
                    t.setAttribute(TABLE_FLAG, 'rtl');
                    t.dir = 'rtl';
                    t.style.direction = 'rtl';
                }
            });
        }

        function processText(root) {
            // Standard text elements.
            qsa(root, 'p, li, h1, h2, h3, h4, h5, h6, blockquote, td, th, summary, label, dt, dd').forEach(function (el) {
                if (el.closest(WRITING_SEL) || el.closest('pre') || el.closest('.code-block__code')) return;
                if (el.hasAttribute(RTL_SPLIT_FLAG)) return;
                var dir = detectElDir(el);
                if (dir) {
                    if (dir === 'rtl' && hasMultiScriptLines(el)) {
                        splitToDirectionalSpans(el);
                        return;
                    }
                    el.dir = dir;
                    el.style.direction = dir;
                    if (el.tagName === 'LI') {
                        el.style.listStylePosition = (dir === 'rtl') ? 'inside' : '';
                        var parentList = el.closest('ul, ol');
                        if (parentList && dir === 'rtl' && !parentList.hasAttribute('dir')) {
                            parentList.dir = 'rtl';
                            parentList.style.direction = 'rtl';
                            var pl = getComputedStyle(parentList).paddingLeft;
                            if (parseFloat(pl) > 0) { parentList.style.paddingRight = pl; parentList.style.paddingLeft = '0'; }
                        }
                    }
                } else {
                    resetDirOrPinLTR(el);
                    if (el.tagName === 'LI') el.style.listStylePosition = '';
                }
            });

            // Lists.
            qsa(root, 'ul, ol').forEach(function (el) {
                if (el.closest(WRITING_SEL) || el.closest('pre')) return;
                var dir = detectElDir(el);
                if (dir === 'rtl') {
                    el.dir = 'rtl';
                    el.style.direction = 'rtl';
                    var pl = getComputedStyle(el).paddingLeft;
                    if (parseFloat(pl) > 0) { el.style.paddingRight = pl; el.style.paddingLeft = '0'; }
                } else {
                    resetDirOrPinLTR(el);
                    el.style.paddingRight = ''; el.style.paddingLeft = '';
                }
            });
        }

        // Universal: process ANY leaf text container (dialogs, tooltips, menus, etc.).
        function processContainers(root) {
            qsa(root, 'div, span, button, a, label').forEach(function (el) {
                if (el.closest('pre') || el.closest('code') || el.closest(WRITING_SEL)) return;
                if (el.hasAttribute(RTL_SPLIT_FLAG)) return;
                if (el.hasAttribute(ISLAND_FLAG)) return;
                var parent = el.parentElement;
                if (parent && parent.hasAttribute(RTL_SPLIT_FLAG)) return;
                if (el.querySelector('p, div, ul, ol, h1, h2, h3, h4, h5, h6, pre, table')) return;
                if (/^(P|LI|H[1-6]|BLOCKQUOTE|TD|TH|UL|OL)$/.test(el.tagName)) return;
                var text = (el.textContent || '').trim();
                if (text.length < 2) return;
                if (hasRTL(text)) {
                    if (hasMultiScriptLines(el)) {
                        splitToDirectionalSpans(el);
                    } else {
                        el.dir = detectTextDir(text) || 'rtl';
                        el.style.textAlign = 'start';
                    }
                } else if (el.hasAttribute('dir')) {
                    el.removeAttribute('dir');
                    el.style.textAlign = '';
                }
            });
        }

        // isComposer: the main chat composer reserves right-padding for its send
        // button when flipped RTL; other textareas don't have that button.
        function applyInputDir(el, isComposer) {
            var text = el.textContent || el.innerText || el.value || '';
            var dir = detectTextDir(text);
            // !important: form controls often ship with a CSS reset (e.g. a design
            // system's input-reset class) that pins direction/text-align on the
            // element itself, which otherwise beats our plain inline style.
            if (dir === 'rtl') {
                setImportant(el, 'direction', 'rtl');
                setImportant(el, 'text-align', 'right');
                if (isComposer) el.style.paddingRight = '25px';
            } else {
                setImportant(el, 'direction', 'ltr');
                setImportant(el, 'text-align', 'left');
                if (isComposer) el.style.paddingRight = '';
            }
        }

        function processInput() {
            document.querySelectorAll(WRITING_SEL).forEach(function (el) { applyInputDir(el, true); });
        }

        // Every <textarea> on the page (composer, drafts, editors, dialogs) — these
        // are form controls, so an ancestor's direction/text-align does NOT flip the
        // text rendered inside them; the style has to land on the textarea itself.
        // We don't skip ones nested under WRITING_SEL: that selector may match a
        // shared composer-component wrapper reused outside the main chat input too,
        // in which case processInput() only styles the wrapper, never the nested
        // <textarea> — so it still needs to be covered here. Many of these textareas
        // are also pre-filled programmatically with no 'input' event ever firing, so
        // they need to be swept here rather than rely solely on the input listener.
        function processTextareas(root) {
            qsa(root, 'textarea').forEach(function (el) {
                var isComposer = !!(el.closest && el.closest(WRITING_SEL));
                applyInputDir(el, isComposer);
            });
        }

        function processAll() {
            isolateMath(document.body);
            processText(document);
            processContainers(document.body);
            processTables(document.body);
            processInput();
            processTextareas(document.body);
            forceCodeLTR(document.body);
        }

        function injectStyles() {
            if (document.getElementById('claude-rtl-styles')) return;
            var s = document.createElement('style');
            s.id = 'claude-rtl-styles';
            s.textContent = [
                'p:not([dir]),li:not([dir]),h1:not([dir]),h2:not([dir]),h3:not([dir]),h4:not([dir]),h5:not([dir]),h6:not([dir]),blockquote:not([dir]),td:not([dir]),th:not([dir]),summary:not([dir]),label:not([dir]),legend:not([dir]),dt:not([dir]),dd:not([dir]),figcaption:not([dir]),caption:not([dir]){unicode-bidi:plaintext!important;text-align:start!important}',
                'pre:not([data-rtl-pre="rtl"]),.code-block__code:not([data-rtl-pre="rtl"]),.relative.group\\/copy:not([data-rtl-pre="rtl"]){unicode-bidi:embed!important;direction:ltr!important;text-align:left!important}',
                // Code blocks that are actually Hebrew/Arabic prose read RTL.
                'pre[data-rtl-pre="rtl"],.code-block__code[data-rtl-pre="rtl"]{unicode-bidi:plaintext!important;direction:rtl!important;text-align:right!important}',
                'code{unicode-bidi:isolate!important;direction:ltr!important}',
                // Raw LaTeX islands and rendered math are isolated LTR units.
                '[data-rtl-island]{unicode-bidi:isolate!important;direction:ltr!important}',
                '.katex,.katex-display,mjx-container{unicode-bidi:isolate!important;direction:ltr!important}',
                // Hebrew tables: flip column order; cells keep their own direction.
                'table[dir="rtl"]{direction:rtl!important}',
                '[dir]{text-align:start!important}[dir="rtl"]{direction:rtl!important}[dir="ltr"]{direction:ltr!important}',
                '[dir]>*:not([dir]):not(pre):not(code):not(.code-block__code){unicode-bidi:plaintext;text-align:start}'
            ].join('');
            document.head.appendChild(s);
        }

        function init() {
            injectStyles();
            processAll();

            // Input box live direction switching.
            document.addEventListener('input', function (e) {
                var t = e.target;
                if (!t || !(t.tagName === 'TEXTAREA' || t.tagName === 'INPUT' || t.isContentEditable)) return;
                applyInputDir(t, !!(t.closest && t.closest(WRITING_SEL)));
            }, true);

            // Watch DOM changes (throttle, not debounce — process DURING streaming).
            var pendingMuts = [];
            var obs = new MutationObserver(function (muts) {
                var relevant = false;
                for (var i = 0; i < muts.length; i++) {
                    if (muts[i].addedNodes.length > 0 || muts[i].type === 'characterData') { relevant = true; break; }
                }
                if (!relevant) return;
                for (var j = 0; j < muts.length; j++) pendingMuts.push(muts[j]);
                if (window._rtlT) return; // throttle: already scheduled
                window._rtlT = setTimeout(function () {
                    window._rtlT = null;
                    var toProcess = pendingMuts;
                    pendingMuts = [];
                    var roots = new Set();
                    toProcess.forEach(function (m) {
                        m.addedNodes.forEach(function (nn) { if (nn.nodeType === 1) roots.add(nn); });
                        if (m.type === 'characterData' && m.target.parentElement) roots.add(m.target.parentElement);
                    });
                    var expanded = new Set(roots);
                    roots.forEach(function (r) {
                        if (!r.closest) return;
                        var txt = r.closest('p, li, h1, h2, h3, h4, h5, h6, blockquote, td, th, summary, label, dt, dd');
                        if (txt) expanded.add(txt);
                        var list = r.closest('ul, ol');
                        if (list) expanded.add(list);
                        var tbl = r.closest('table');
                        if (tbl) expanded.add(tbl);
                    });
                    roots = expanded;
                    if (roots.size > 0 && roots.size <= 30) {
                        roots.forEach(function (r) {
                            isolateMath(r);
                            processText(r);
                            processContainers(r);
                            processTables(r);
                            processTextareas(r);
                            forceCodeLTR(r);
                        });
                        processInput();
                    } else {
                        processAll();
                    }
                }, 50);
            });
            obs.observe(document.body, { childList: true, subtree: true, characterData: true });
        }

        // Public API — lets a host page or the demo harness drive the payload manually,
        // and makes the version inspectable from DevTools.
        window.ClaudeRTL = {
            version: VERSION,
            init: init,
            processAll: processAll,
            injectStyles: injectStyles,
            detectTextDir: detectTextDir,
            detectElDir: detectElDir
        };

        if (!window.__CLAUDE_RTL_NO_AUTOINIT__) {
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', init);
            } else { init(); }
        }
    } catch (e) {
        if (typeof console !== 'undefined') console.error('[Claude RTL]', e);
    }
})();
