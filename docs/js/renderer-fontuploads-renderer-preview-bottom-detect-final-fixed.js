const SitelenRenderer = (() => {
  let __coreReady = null;
  let __coreHost = null;

  // Bridge references to helpers defined inside the preserved core scope
  let __bridgeGetFontPx = null;
  let __bridgeWordGapForPx = null;
  let __bridgePushGapIfNeeded = null;
  let __bridgeMakeRunElementFromCodepoints = null;
  let __bridgeParseTextSegmentToElements = null;
  let __bridgeParseQuoteSegmentToElements = null;
  let __bridgeParseInterpretedQuoteSegmentToElements = null;
  let __bridgeParseBracketSegmentToElements = null;
  let __bridgeFontsReadyForPx = null;
  let __bridgeWarmUpCanvasFontsOnce = null;
  let __bridgeRenderAllLinesToCanvas = null;
  let __bridgeDrawTextWithOptionalHalo = null;
  let __bridgeNormalizeTpGlyphKey = null;
  let __bridgeWordToUcsurCp = null;
  let __bridgeEmitRawUcsurCodepointsWithOptionalManualTallies = null;


  let __nanpaDebugSeq = 0;

  function nanpaDebugIsEnabled() {
    // Always-on instrumentation for diagnosing nanpa-linja-n numeric cartouche
    // parsing/render-run issues. No console setup calls are required.
    return true;
  }

  function nanpaDebugSafe(value, depth = 0) {
    if (value == null) return value;
    if (depth > 4) return "[max-depth]";
    if (typeof value === "number" || typeof value === "string" || typeof value === "boolean") return value;
    if (Array.isArray(value)) return value.slice(0, 80).map(v => nanpaDebugSafe(v, depth + 1));
    if (typeof value === "object") {
      const out = {};
      for (const [k, v] of Object.entries(value)) {
        if (k === "canvas") { out[k] = "[canvas]"; continue; }
        if (k === "_element") { out[k] = nanpaDebugSafe(v, depth + 1); continue; }
        out[k] = nanpaDebugSafe(v, depth + 1);
      }
      return out;
    }
    return String(value);
  }

  function nanpaDebugEmit(label, payload = {}) {
    if (!nanpaDebugIsEnabled()) return;
    const entry = {
      seq: ++__nanpaDebugSeq,
      label: String(label || "nanpa-debug"),
      ts: new Date().toISOString(),
      payload: nanpaDebugSafe(payload)
    };
    try {
      globalThis.__NANPA_DEBUG_LOGS__ = globalThis.__NANPA_DEBUG_LOGS__ || [];
      globalThis.__NANPA_DEBUG_LOGS__.push(entry);
      if (globalThis.__NANPA_DEBUG_LOGS__.length > 2000) globalThis.__NANPA_DEBUG_LOGS__.shift();
    } catch (_) {}
    try { console.log(`[nanpa-debug:${entry.seq}] ${entry.label}`, entry.payload); } catch (_) {}
  }

  function nanpaDebugTable(label, rows) {
    if (!nanpaDebugIsEnabled()) return;
    nanpaDebugEmit(label, { rows });
    try { console.table(rows); } catch (_) {}
  }

  function nanpaDebugCps(cps) {
    return Array.from(cps || []).map(cp => {
      const n = Number(cp);
      return Number.isFinite(n) ? ("U+" + n.toString(16).toUpperCase().padStart(4, "0")) : String(cp);
    });
  }

  function nanpaDebugElementSummary(el) {
    if (!el || typeof el !== "object") return el;
    return {
      type: el.type || null,
      sourceText: el.sourceText ?? null,
      sourceStart: el.sourceStart ?? null,
      sourceEnd: el.sourceEnd ?? null,
      sourceKind: el.sourceKind ?? null,
      sourceSegmentIndex: el.sourceSegmentIndex ?? null,
      fontFamily: el.fontFamily || null,
      fontRole: el.fontRole || null,
      w: el.w ?? null,
      h: el.h ?? null,
      cp: el.cp != null ? nanpaDebugCps([el.cp])[0] : null,
      cps: Array.isArray(el.cps) ? nanpaDebugCps(el.cps) : null,
      manualTallies: Array.isArray(el.manualTallies) ? el.manualTallies.slice() : null,
      isLiteralCartouche: !!el.isLiteralCartouche,
      isQuoted: !!el.isQuoted,
      isUnrecognized: !!el.isUnrecognized
    };
  }

  try {
    globalThis.enableNanpaDebug = function enableNanpaDebug() {
      globalThis.__NANPA_DEBUG__ = true;
      try { globalThis.localStorage && globalThis.localStorage.setItem("nanpaDebug", "1"); } catch (_) {}
      console.log("[nanpa-debug] enabled");
    };
    globalThis.disableNanpaDebug = function disableNanpaDebug() {
      globalThis.__NANPA_DEBUG__ = false;
      try { globalThis.localStorage && globalThis.localStorage.removeItem("nanpaDebug"); } catch (_) {}
      console.log("[nanpa-debug] disabled");
    };
    globalThis.clearNanpaDebugLogs = function clearNanpaDebugLogs() {
      globalThis.__NANPA_DEBUG_LOGS__ = [];
      __nanpaDebugSeq = 0;
      console.log("[nanpa-debug] logs cleared");
    };
    globalThis.copyNanpaDebugLogs = function copyNanpaDebugLogs() {
      const text = JSON.stringify(globalThis.__NANPA_DEBUG_LOGS__ || [], null, 2);
      if (globalThis.navigator?.clipboard?.writeText) {
        globalThis.navigator.clipboard.writeText(text).then(() => console.log("[nanpa-debug] logs copied to clipboard"));
      } else {
        console.log(text);
      }
      return text;
    };
  } catch (_) {}

  nanpaDebugEmit("debug:init", {
    alwaysOn: true,
    note: "Nanpa parser/renderer debug logs are enabled automatically. Reproduce the render and copy console output."
  });


  function ensureDomReady() {
    if (document.body) return Promise.resolve();
    return new Promise((resolve) => {
      window.addEventListener('DOMContentLoaded', () => resolve(), { once: true });
    });
  }

  function buildHiddenScaffold() {
    if (__coreHost) return __coreHost;
    const host = document.createElement('div');
    host.setAttribute('data-sitelen-renderer-core', 'true');
    host.style.cssText = 'position:fixed;left:-100000px;top:-100000px;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none;';
    host.innerHTML = `
      <div id="srStatus" role="status"></div>
      <input id="fgPick" type="color" value="#111111" />
      <input id="haloPick" type="color" value="#FFFFFF" />
      <input id="haloEnable" type="checkbox" />
      <select id="haloWidthSel"><option value="0" selected>0</option><option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="4">4</option><option value="5">5</option><option value="6">6</option></select>
      <select id="fontSizeSel">${[8,10,12,14,16,20,24,28,32,36,40,44,48,56,64,72,80,88,96,104,120,144].map(v => `<option value="${v}" ${v===56?'selected':''}>${v}</option>`).join('')}</select>
      <select id="alignSel"><option value="left" selected>left</option><option value="center">center</option><option value="right">right</option></select>
      <label><input type="radio" name="nlMode" value="traditional" checked />traditional</label>
      <label><input type="radio" name="nlMode" value="uniform" />uniform</label>
      <textarea id="textIn"></textarea>
      <canvas id="outCanvas" width="1" height="1"></canvas>
      <button id="btnRender" type="button">render</button>
      <button id="btnDownloadPng" type="button">png</button>
      <button id="btnDownloadPdf" type="button">pdf</button>
      <button id="btnImportTextMain" type="button">import</button>
      <button id="btnExportTextMain" type="button">export</button>
      <button id="btnImportTextPop" type="button">import</button>
      <button id="btnExportTextPop" type="button">export</button>
      <button id="btnPopoutTextIn" type="button">pop</button>
      <button id="btnCloseFloatingTextInEditor" type="button">close</button>
      <button id="btnTogglePopoutMain" type="button">toggle</button>
      <input id="filePickTextIn" type="file" />
      <a id="calculatorLink" href="#"></a>
      <a id="rendererLink" href="#"></a>
      <div id="floatingTextInEditor"></div>
      <div id="floatingTextInEditorHeader"></div>
      <textarea id="floatingTextInEditorTextarea"></textarea>
      <div id="floatingTextInEditorTitle"></div>
    `;
    document.body.appendChild(host);
    __coreHost = host;
    return host;
  }

  function parseCssSize(value, basePx) {
    if (value == null || value === '') return null;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    const s = String(value).trim();
    if (!s) return null;
    if (/^-?\d+(?:\.\d+)?$/.test(s)) return Number(s);
    const em = s.match(/^(-?\d+(?:\.\d+)?)em$/i);
    if (em) return Number(em[1]) * basePx;
    const px = s.match(/^(-?\d+(?:\.\d+)?)px$/i);
    if (px) return Number(px[1]);
    return null;
  }

  function parseImgArgs(argText) {
    const parts = [];
    let cur = '';
    let quote = null;
    let esc = false;
    let depth = 0;
    for (let i = 0; i < argText.length; i++) {
      const ch = argText[i];
      if (esc) { cur += ch; esc = false; continue; }
      if (ch === '\\') { cur += ch; esc = true; continue; }
      if (quote) {
        cur += ch;
        if (ch === quote) quote = null;
        continue;
      }
      if (ch === '"' || ch === "'") { quote = ch; cur += ch; continue; }
      if (ch === '(') { depth++; cur += ch; continue; }
      if (ch === ')') { if (depth > 0) depth--; cur += ch; continue; }
      if (ch === ',' && depth === 0) { parts.push(cur.trim()); cur = ''; continue; }
      cur += ch;
    }
    if (cur.trim()) parts.push(cur.trim());

    const stripQuotes = (v) => {
      const s = String(v ?? '').trim();
      if (s.length >= 2 && ((s[0] === '"' && s[s.length - 1] === '"') || (s[0] === "'" && s[s.length - 1] === "'"))) {
        return s.slice(1, -1);
      }
      return s;
    };

    const out = { src: '', w: null, h: null, alt: null, valign: 'baseline', wriggle: 8, transparent: true };
    if (parts.length === 0) return out;
    const first = parts[0];
    if (first.includes('=')) {
      // handled below
    } else {
      out.src = stripQuotes(first);
    }

    for (const p of parts.slice(out.src ? 1 : 0)) {
      const eq = p.indexOf('=');
      if (eq < 0) continue;
      const key = p.slice(0, eq).trim();
      const val = stripQuotes(p.slice(eq + 1).trim());
      if (key === 'src') out.src = val;
      else if (key === 'w') out.w = val;
      else if (key === 'h') out.h = val;
      else if (key === 'alt') out.alt = val;
      else if (key === 'valign') out.valign = val;
      else if (key === 'wriggle') out.wriggle = Number(val);
      else if (key === 'transparent') out.transparent = !/^(false|0|no|off)$/i.test(String(val));
    }
    return out;
  }

  function splitLineIntoAstSegments(line) {
    const s = String(line ?? '');
    const out = [];
    let i = 0;
    let start = 0;
    const pushText = (a, b) => { if (b > a) out.push({ kind: 'text', value: s.slice(a, b) }); };
    while (i < s.length) {
      const ch = s[i];
      if (ch === '[') {
        const j = s.indexOf(']', i + 1);
        if (j < 0) break;
        pushText(start, i);
        out.push({ kind: 'bracket', value: s.slice(i + 1, j) });
        i = j + 1; start = i; continue;
      }
      if (ch === '"' || ch === '“') {
        const openCh = ch;
        const closeCh = (openCh === '“') ? '”' : '"';
        let j = i + 1; let found = false;
        while (j < s.length) {
          const cj = s[j];
          const isClose = (cj === closeCh) || (openCh === '“' && cj === '"') || (openCh === '"' && cj === '”');
          if (isClose && s[j - 1] !== '\\') { found = true; break; }
          j++;
        }
        if (!found) break;
        pushText(start, i);
        out.push({
          kind: 'quote',
          value: s.slice(i + 1, j),
          openQuote: openCh,
          closeQuote: s[j],
          sourceStart: i,
          sourceEnd: j + 1
        });
        i = j + 1; start = i; continue;
      }
      if (s.startsWith('img(', i)) {
        let j = i + 4;
        let depth = 1;
        let quote = null;
        let esc = false;
        while (j < s.length) {
          const cj = s[j];
          if (esc) { esc = false; j++; continue; }
          if (cj === '\\') { esc = true; j++; continue; }
          if (quote) { if (cj === quote) quote = null; j++; continue; }
          if (cj === '"' || cj === "'") { quote = cj; j++; continue; }
          if (cj === '(') depth++;
          else if (cj === ')') { depth--; if (depth === 0) break; }
          j++;
        }
        if (j >= s.length) break;
        pushText(start, i);
        out.push({ kind: 'image', value: parseImgArgs(s.slice(i + 4, j)) });
        i = j + 1; start = i; continue;
      }
      i++;
    }
    pushText(start, s.length);
    return out;
  }

  const EARLY_TEXT_ALIAS_SUBSTITUTIONS = Object.freeze([
    ["'cartouche-start'", "["],
    ["'cartouche-end'", "]"],
    ["'zw-joiner'", "&"],
    ["'stack-joiner'", "-"],
    ["'nesting-joiner'", "+"],
    ["'ideographic-space'", " zz "],
    ["'long-start'", "("],
    ["'long-end'", ")"],
    ["'left-bracket'", " te "],
    ["'right-bracket'", " to "],
    ["'middle-dot'", "."],
    ["'colon'", ":"],
    ["'tally'", ","],
  ]);

  function replaceAllLiteral(haystack, needle, replacement) {
    return String(haystack ?? '').split(needle).join(replacement);
  }

  function preprocessTextAliases(input) {
    let s = String(input ?? '');
    for (const [needle, replacement] of EARLY_TEXT_ALIAS_SUBSTITUTIONS) {
      s = replaceAllLiteral(s, needle, replacement);
    }
    return s;
  }

  const STANDARD_SITELEN_PONA_ASCII_CORE_MODE = 'standard-sitelen-pona-ascii-core';
  const SITELEN_PONA_ASCII_EXTENDED_MODE = 'sitelen-pona-ascii-extended';

  function isStandardSitelenPonaAsciiCoreMode(parser = {}) {
    return String(parser?.mode || '') === STANDARD_SITELEN_PONA_ASCII_CORE_MODE;
  }

  function isSitelenPonaAsciiExtendedMode(parser = {}) {
    return String(parser?.mode || '') === SITELEN_PONA_ASCII_EXTENDED_MODE;
  }

  function normalizeAstInput(input, parser = {}) {
    // The strict standard ASCII core deliberately does not accept the renderer's
    // convenience text aliases (for example 'stack-joiner' or 'long-start').
    // Existing parser modes retain their previous alias preprocessing unchanged.
    const source = isStandardSitelenPonaAsciiCoreMode(parser)
      ? String(input ?? '')
      : preprocessTextAliases(input);
    return source.replace(/\r\n/g, '\n');
  }

  function isUnicodeScalarValue(cp) {
    return Number.isInteger(cp) && cp >= 0 && cp <= 0x10FFFF && !(cp >= 0xD800 && cp <= 0xDFFF);
  }

  function parseUnicodeCodepointHex(hexText) {
    const hex = String(hexText ?? "");
    if (!/^[0-9A-Fa-f]{1,6}$/.test(hex)) {
      throw new Error(`Invalid Unicode code point hexadecimal value: "${hex}"`);
    }
    const cp = Number.parseInt(hex, 16);
    if (!isUnicodeScalarValue(cp)) {
      throw new Error(`Invalid Unicode scalar value U+${hex.toUpperCase()}`);
    }
    return cp;
  }

  // Locate explicit U+... runs in ordinary renderer text. Horizontal whitespace
  // between consecutive valid escapes belongs to the source syntax only and is
  // deliberately omitted from the emitted codepoint run.
  function findRawUnicodeCodepointSequences(input) {
    const s = String(input ?? "");
    if (!s) return [];

    const tokenRe = /U\+([0-9A-Fa-f]{1,6})(?![0-9A-Fa-f])/gi;
    const tokens = [];
    let m;
    while ((m = tokenRe.exec(s)) !== null) {
      const cp = parseUnicodeCodepointHex(m[1]);
      tokens.push({
        index: m.index,
        end: tokenRe.lastIndex,
        sourceText: m[0],
        cp
      });
    }
    if (!tokens.length) return [];

    const groups = [];
    let current = null;
    for (const tok of tokens) {
      if (
        current &&
        /^[ \t]*$/.test(s.slice(current.end, tok.index))
      ) {
        current.end = tok.end;
        current.cps.push(tok.cp);
        current.sourceText = s.slice(current.index, current.end);
        continue;
      }
      current = {
        kind: "rawCodepoints",
        index: tok.index,
        end: tok.end,
        sourceText: tok.sourceText,
        cps: [tok.cp]
      };
      groups.push(current);
    }
    return groups;
  }

  function parseCompleteUnicodeCodepointInput(input) {
    const raw = String(input ?? "").trim();
    if (!raw) return [];

    if (/U\+/i.test(raw)) {
      const hits = findRawUnicodeCodepointSequences(raw);
      if (!hits.length) throw new Error("No valid U+ Unicode code points were found.");

      let pos = 0;
      const cps = [];
      for (const hit of hits) {
        if (!/^[ \t\r\n]*$/.test(raw.slice(pos, hit.index))) {
          throw new Error(`Invalid text between Unicode code points: "${raw.slice(pos, hit.index)}"`);
        }
        cps.push(...hit.cps);
        pos = hit.end;
      }
      if (!/^[ \t\r\n]*$/.test(raw.slice(pos))) {
        throw new Error(`Invalid text after Unicode code points: "${raw.slice(pos)}"`);
      }
      return cps;
    }

    // Preserve the older whitespace-separated bare-hex API form.
    return raw.split(/\s+/).map(parseUnicodeCodepointHex);
  }

  const DEFAULT_RENDERER_PARSER_OPTIONS = Object.freeze({
    // Shared renderer default: preserve the caller's physical input lines.
    breakLinesAtFullStops: false
  });

  function isSentenceFullStopAt(text, index) {
    const s = String(text ?? '');
    if (s[index] !== '.') return false;

    // A decimal point inside a number is not a sentence boundary. This covers
    // both ordinary decimals (1.25) and leading-decimal forms (.25 / -.25).
    const prev = index > 0 ? s[index - 1] : '';
    const next = index + 1 < s.length ? s[index + 1] : '';
    const isNumericDecimalPoint = /\d/.test(next) && (
      /\d/.test(prev) ||
      index === 0 ||
      /\s/.test(prev) ||
      /[+\-(,:=]/.test(prev)
    );
    return !isNumericDecimalPoint;
  }

  function splitSourceLineAtFullStops(line) {
    const s = String(line ?? '');
    const out = [];
    let start = 0;
    let quoteOpen = '';
    let squareDepth = 0;
    let parenDepth = 0;
    let braceDepth = 0;

    for (let i = 0; i < s.length; i++) {
      const ch = s[i];

      if (quoteOpen) {
        if (ch === '\\') {
          i += 1;
          continue;
        }
        const isClose =
          (quoteOpen === '“' && (ch === '”' || ch === '"')) ||
          (quoteOpen === '"' && (ch === '"' || ch === '”'));
        if (isClose) quoteOpen = '';
        continue;
      }

      if (ch === '"' || ch === '“') {
        quoteOpen = ch;
        continue;
      }
      if (ch === '[') { squareDepth += 1; continue; }
      if (ch === ']') { squareDepth = Math.max(0, squareDepth - 1); continue; }
      if (ch === '(') { parenDepth += 1; continue; }
      if (ch === ')') { parenDepth = Math.max(0, parenDepth - 1); continue; }
      if (ch === '{') { braceDepth += 1; continue; }
      if (ch === '}') { braceDepth = Math.max(0, braceDepth - 1); continue; }

      if (
        ch !== '.' ||
        squareDepth > 0 ||
        parenDepth > 0 ||
        braceDepth > 0 ||
        !isSentenceFullStopAt(s, i)
      ) continue;

      // Keep adjacent full stops together, so an ellipsis remains on one line.
      let end = i + 1;
      while (end < s.length && s[end] === '.' && isSentenceFullStopAt(s, end)) end += 1;
      out.push(s.slice(start, end));
      start = end;
      i = end - 1;
    }

    const tail = s.slice(start);
    if (tail.trim().length > 0 || out.length === 0) out.push(tail);
    return out;
  }

  function astFromInput(input, parser = {}) {
    const normalized = normalizeAstInput(input, parser);
    const parserOptions = {
      ...DEFAULT_RENDERER_PARSER_OPTIONS,
      ...(parser || {})
    };
    const lines = [];
    const sourceLines = normalized.split('\n');

    for (let sourceLineIndex = 0; sourceLineIndex < sourceLines.length; sourceLineIndex++) {
      const sourceLine = sourceLines[sourceLineIndex];
      const renderedSourceLines = parserOptions.breakLinesAtFullStops === true
        ? splitSourceLineAtFullStops(sourceLine)
        : [sourceLine];

      for (let sentenceIndexInSourceLine = 0; sentenceIndexInSourceLine < renderedSourceLines.length; sentenceIndexInSourceLine++) {
        const renderedSourceLine = renderedSourceLines[sentenceIndexInSourceLine];
        lines.push({
          type: 'line',
          index: lines.length,
          sourceLineIndex,
          sentenceIndexInSourceLine,
          sourceText: renderedSourceLine,
          children: splitLineIntoAstSegments(renderedSourceLine)
        });
      }
    }

    return {
      type: 'document',
      normalizedInput: normalized,
      parserOptions: {
        breakLinesAtFullStops: parserOptions.breakLinesAtFullStops === true
      },
      lines
    };
  }

  async function loadImageElementCanvas(desc, fontPx) {
    const src = desc?.src ? String(desc.src) : '';
    if (!src) return null;
    const img = new Image();
    img.decoding = 'async';
    img.src = src;
    if (!img.complete) await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; });
    const iw = img.naturalWidth || img.width;
    const ih = img.naturalHeight || img.height;
    if (!iw || !ih) return null;
    const targetH = parseCssSize(desc.h, fontPx) ?? (parseCssSize(desc.w, fontPx) ? null : fontPx);
    const targetW = parseCssSize(desc.w, fontPx) ?? null;
    let w = targetW;
    let h = targetH;
    if (w == null && h == null) h = fontPx;
    if (w == null) w = Math.max(1, Math.round((h * iw) / ih));
    if (h == null) h = Math.max(1, Math.round((w * ih) / iw));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w));
    c.height = Math.max(1, Math.round(h));
    const ctx = c.getContext('2d', { alpha: true });
    ctx.imageSmoothingEnabled = true;
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0, c.width, c.height);
    if (desc?.transparent !== false) {
      const imageData = ctx.getImageData(0, 0, c.width, c.height);
      const d = imageData.data;
      const wriggle = Number.isFinite(desc?.wriggle) ? Math.max(0, Number(desc.wriggle)) : 8;
      const kr = d[0], kg = d[1], kb = d[2], ka = d[3];
      for (let i = 0; i < d.length; i += 4) {
        if (Math.abs(d[i] - kr) <= wriggle && Math.abs(d[i+1] - kg) <= wriggle && Math.abs(d[i+2] - kb) <= wriggle && Math.abs(d[i+3] - ka) <= Math.max(8, wriggle)) {
          d[i+3] = 0;
        }
      }
      ctx.putImageData(imageData, 0, 0);
    }
    return {
      type: 'cartouche',
      canvas: c,
      w: c.width,
      h: c.height,
      baselineY: desc?.valign === 'center' ? Math.round(c.height * 0.75) : c.height,
      ascent: desc?.valign === 'center' ? Math.round(c.height * 0.75) : c.height,
      descent: desc?.valign === 'center' ? Math.max(0, c.height - Math.round(c.height * 0.75)) : 0,
      imageAlt: desc?.alt || null,
      isImage: true
    };
  }


  let FONT_FAMILY_TEXT = "TP-Nasin-Nanpa-Font";
  let FONT_FAMILY_CARTOUCHE = "TP-Cartouche-Font";
  let FONT_FAMILY_NUMBER = "TP-Cartouche-Font";
  let FONT_FAMILY_LITERAL = "Patrick-Head-Font";
  let FONT_FAMILY_LITERAL_CARTOUCHE = "TP-Nasin-Nanpa-Font";
  let FONT_FAMILY_UNKNOWN = "Patrick-Head-Font";

  const DEFAULT_FONT_RENDER_ADAPTER_ID = "identity";
  const __fontRenderAdapters = new Map();
  let __renderAdapterId = DEFAULT_FONT_RENDER_ADAPTER_ID;
  let __renderAdapterSettings = {};

  function normalizeRenderAdapterId(value) {
    const id = String(value ?? "").trim();
    return id || DEFAULT_FONT_RENDER_ADAPTER_ID;
  }

  function cloneRenderAdapterSettings(value) {
    return (value && typeof value === "object" && !Array.isArray(value)) ? { ...value } : {};
  }

  function identityCanonicalToRenderSpans(canonicalCps) {
    return Array.from(canonicalCps || []).map((_cp, index) => ({
      canonicalIndex: index,
      renderStart: index,
      renderEnd: index + 1
    }));
  }

  function validateRenderCodepoints(value) {
    if (!Array.isArray(value) && !(value && typeof value[Symbol.iterator] === "function")) return null;
    const out = Array.from(value, cp => Number(cp));
    if (out.some(cp => !isUnicodeScalarValue(cp))) return null;
    return out;
  }

  function normalizeCanonicalToRenderSpans(value, canonicalLength, renderLength) {
    if (!Array.isArray(value) || value.length !== canonicalLength) return null;
    const out = [];
    for (let i = 0; i < value.length; i++) {
      const item = value[i];
      const start = Number(item?.renderStart);
      const end = Number(item?.renderEnd);
      if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start || end > renderLength) return null;
      out.push({ canonicalIndex: i, renderStart: start, renderEnd: end });
    }
    return out;
  }

  function normalizeSyntheticCornerBrackets(value, canonicalLength, renderLength) {
    if (!Array.isArray(value)) return [];
    const out = [];
    for (const item of value) {
      const canonicalIndex = Number(item?.canonicalIndex);
      const renderStart = Number(item?.renderStart);
      const renderEnd = Number(item?.renderEnd);
      const codepoint = Number(item?.codepoint);
      if (!Number.isInteger(canonicalIndex) || canonicalIndex < 0 || canonicalIndex >= canonicalLength) continue;
      if (!Number.isInteger(renderStart) || !Number.isInteger(renderEnd) || renderStart < 0 || renderEnd <= renderStart || renderEnd > renderLength) continue;
      if (codepoint !== 0x300C && codepoint !== 0x300D) continue;
      out.push({
        canonicalIndex,
        renderStart,
        renderEnd,
        codepoint,
        side: codepoint === 0x300D ? 'right' : 'left'
      });
    }
    return out;
  }

  function identityFontRenderAdapter({ canonicalCps }) {
    const cps = Array.from(canonicalCps || []);
    return {
      renderCps: cps,
      canonicalToRenderSpans: identityCanonicalToRenderSpans(cps)
    };
  }

  __fontRenderAdapters.set(DEFAULT_FONT_RENDER_ADAPTER_ID, identityFontRenderAdapter);

  // Built-in adapters for fonts whose OpenType input contract differs from
  // canonical Common Sitelen Pona. The parser remains font-independent: these
  // functions receive canonical code points only and translate at render time.
  const SP_CP = Object.freeze({
    CARTOUCHE_START: 0xF1990,
    CARTOUCHE_END: 0xF1991,
    CARTOUCHE_EXTENSION: 0xF1992,
    DEPRECATED_LONG_PI_START: 0xF1993,
    DEPRECATED_LONG_PI_EXTENSION: 0xF1994,
    STACKING_JOINER: 0xF1995,
    SCALING_JOINER: 0xF1996,
    LONG_START: 0xF1997,
    LONG_END: 0xF1998,
    DEPRECATED_LONG_EXTENSION: 0xF1999,
    REVERSE_LONG_START: 0xF199A,
    REVERSE_LONG_END: 0xF199B,
    MIDDLE_DOT: 0xF199C,
    COLON: 0xF199D,
    TALLY: 0xF199E,
    ZWJ: 0x200D,
    IDEOGRAPHIC_SPACE: 0x3000,
    LEFT_CORNER: 0x300C,
    RIGHT_CORNER: 0x300D,
    NI: 0xF1941,
    NI_LEFT: 0xF1989,
    NI_UP: 0xF198A,
    NI_RIGHT: 0xF198B,
    SEWI: 0xF195A,
    SEWI_ALT: 0xF198C,
    JAKI: 0xF1910,
    KO: 0xF191C,
    PI: 0xF194D,
    LON: 0xF192C,
    MAJUNA: 0xF19A2,
    LINLUWI: 0xF19A4,
    KIKI: 0xF19A5,
    SU: 0xF19A6
  });

  const SP_JOINERS = new Set([SP_CP.ZWJ, SP_CP.STACKING_JOINER, SP_CP.SCALING_JOINER]);
  const SP_PREFERRED_WORD_NAMES = Object.freeze([
    'a','akesi','ala','alasa','ale','anpa','ante','anu','awen','e','en','esun','ijo','ike','ilo','insa','jaki','jan','jelo','jo','kala','kalama','kama','kasi','ken','kepeken','kili','kiwen','ko','kon','kule','kulupu','kute','la','lape','laso','lawa','len','lete','li','lili','linja','lipu','loje','lon','luka','lukin','lupa','ma','mama','mani','meli','mi','mije','moku','moli','monsi','mu','mun','musi','mute','nanpa','nasa','nasin','nena','ni','nimi','noka','o','olin','ona','open','pakala','pali','palisa','pan','pana','pi','pilin','pimeja','pini','pipi','poka','poki','pona','pu','sama','seli','selo','seme','sewi','sijelo','sike','sin','sina','sinpin','sitelen','sona','soweli','suli','suno','supa','suwi','tan','taso','tawa','telo','tenpo','toki','tomo','tu','unpa','uta','utala','walo','wan','waso','wawa','weka','wile','namako','kin','oko','kipisi','leko','monsuta','tonsi','jasima','kijetesantakalu','soko','meso','epiku','kokosila','lanpan','n','misikeke','ku','pake','apeja','majuna','powe','linluwi','kiki','su'
  ]);
  let __preferredWordByCp = null;
  const __fontRenderAdapterWarnings = new Set();

  function warnFontRenderAdapterOnce(adapterId, message) {
    const key = `${adapterId}:${message}`;
    if (__fontRenderAdapterWarnings.has(key)) return;
    __fontRenderAdapterWarnings.add(key);
    try { console.warn(`[font-render-adapter:${adapterId}] ${message}`); } catch (_) {}
  }

  function preferredWordByCp() {
    if (__preferredWordByCp) return __preferredWordByCp;
    const out = new Map();
    const source = (__bridgeWordToUcsurCp && typeof __bridgeWordToUcsurCp === 'object')
      ? __bridgeWordToUcsurCp
      : {};
    for (const word of SP_PREFERRED_WORD_NAMES) {
      const cp = Number(source[word]);
      if (isUnicodeScalarValue(cp) && !out.has(cp)) out.set(cp, word);
    }
    __preferredWordByCp = out;
    return out;
  }

  function stringToCodepoints(text) {
    return Array.from(String(text ?? ''), ch => ch.codePointAt(0));
  }

  function createMappedRenderBuilder(canonicalLength) {
    const renderCps = [];
    const spans = Array.from({ length: canonicalLength }, (_unused, canonicalIndex) => ({
      canonicalIndex,
      renderStart: null,
      renderEnd: null
    }));

    function attach(indices, start, end) {
      for (const rawIndex of (indices || [])) {
        const index = Number(rawIndex);
        if (!Number.isInteger(index) || index < 0 || index >= spans.length) continue;
        const span = spans[index];
        span.renderStart = span.renderStart == null ? start : Math.min(span.renderStart, start);
        span.renderEnd = span.renderEnd == null ? end : Math.max(span.renderEnd, end);
      }
    }

    return {
      get length() { return renderCps.length; },
      append(text, indices = []) {
        const start = renderCps.length;
        renderCps.push(...stringToCodepoints(text));
        attach(indices, start, renderCps.length);
      },
      appendCodepoints(cps, indices = []) {
        const start = renderCps.length;
        renderCps.push(...Array.from(cps || [], cp => Number(cp)));
        attach(indices, start, renderCps.length);
      },
      mark(indices = []) {
        attach(indices, renderCps.length, renderCps.length);
      },
      finish() {
        let cursor = 0;
        for (const span of spans) {
          if (span.renderStart == null || span.renderEnd == null) {
            span.renderStart = cursor;
            span.renderEnd = cursor;
          } else {
            cursor = span.renderEnd;
          }
        }
        return { renderCps, canonicalToRenderSpans: spans };
      }
    };
  }

  function splitCanonicalCells(cps, start = 0, end = cps.length) {
    const cells = [];
    let i = start;
    while (i < end) {
      const cp = cps[i];
      if (
        cp === SP_CP.CARTOUCHE_EXTENSION ||
        cp === SP_CP.DEPRECATED_LONG_EXTENSION ||
        cp === SP_CP.DEPRECATED_LONG_PI_EXTENSION ||
        cp === SP_CP.LONG_START ||
        cp === SP_CP.LONG_END ||
        cp === SP_CP.REVERSE_LONG_START ||
        cp === SP_CP.REVERSE_LONG_END
      ) {
        cells.push({ indices: [i], cps: [cp], controlOnly: true });
        i += 1;
        continue;
      }
      const indices = [i];
      const cellCps = [cp];
      i += 1;
      while (i + 1 < end && SP_JOINERS.has(cps[i])) {
        indices.push(i, i + 1);
        cellCps.push(cps[i], cps[i + 1]);
        i += 2;
      }
      cells.push({ indices, cps: cellCps, controlOnly: false });
    }
    return cells;
  }

  function replacementForUnsupported(settings = {}) {
    const configured = Number(settings.unsupportedReplacementCodepoint);
    return isUnicodeScalarValue(configured) ? configured : 0xFFFD;
  }

  function appendUnsupported(builder, index, cp, adapterId, settings, reason = 'unsupported code point') {
    warnFontRenderAdapterOnce(adapterId, `${reason}: U+${Number(cp).toString(16).toUpperCase()}`);
    builder.appendCodepoints([replacementForUnsupported(settings)], [index]);
  }

  function legacyWordEncoding(cp, kind, settings = {}) {
    if (cp === SP_CP.MIDDLE_DOT) return '.';
    if (cp === SP_CP.COLON) return ':';
    if (cp === SP_CP.IDEOGRAPHIC_SPACE) return kind === 'linja-lipamanka' ? 'zz' : '  ';

    if (cp === SP_CP.NI_LEFT) {
      if (kind === 'linja-sike') return 'ni';
      if (kind === 'linja-lipamanka') return 'ni<';
      return 'ni';
    }
    if (cp === SP_CP.NI_UP) {
      if (kind === 'linja-sike' || kind === 'linja-lipamanka') return 'ni^';
      return 'ni';
    }
    if (cp === SP_CP.NI_RIGHT) {
      if (kind === 'linja-sike' || kind === 'linja-lipamanka') return 'ni>';
      return 'ni';
    }
    if (cp === SP_CP.SEWI_ALT) {
      if (kind === 'linja-sike') return 'sewi1';
      return 'sewi';
    }
    if (
      (cp === SP_CP.LEFT_CORNER || cp === SP_CP.RIGHT_CORNER) &&
      (kind === 'linja-pona' || kind === 'linja-sike') &&
      String(settings.cornerBracketMode || '').trim().toLowerCase() === 'synthetic'
    ) {
      return String.fromCodePoint(cp);
    }
    if (cp === SP_CP.LEFT_CORNER && kind === 'linja-lipamanka') return 'te';
    if (cp === SP_CP.RIGHT_CORNER && kind === 'linja-lipamanka') return 'to';

    const word = preferredWordByCp().get(cp) || null;
    if (!word) return null;

    if (kind === 'linja-pona' && (cp === SP_CP.MAJUNA || cp === SP_CP.LINLUWI || cp === SP_CP.SU || cp === SP_CP.KIKI)) {
      return null;
    }
    if (kind === 'linja-lipamanka' && (cp === SP_CP.LINLUWI || cp === SP_CP.SU || cp === SP_CP.KIKI || cp > 0xF19A3)) {
      return null;
    }
    return word;
  }

  function appendLegacyCell(builder, cell, kind, adapterId, settings = {}) {
    const cps = cell.cps;
    const indices = cell.indices;
    if (cell.controlOnly) {
      builder.mark(indices);
      return true;
    }
    let pos = 0;
    while (pos < cps.length) {
      const cp = cps[pos];
      const canonicalIndex = indices[pos];
      const text = legacyWordEncoding(cp, kind, settings);
      if (text == null) appendUnsupported(builder, canonicalIndex, cp, adapterId, settings, 'font has no reliable glyph input');
      else builder.append(text, [canonicalIndex]);
      pos += 1;
      if (pos < cps.length) {
        const joiner = cps[pos];
        const joinerIndex = indices[pos];
        let operator = '-';
        if (kind === 'linja-lipamanka') {
          if (joiner === SP_CP.STACKING_JOINER) operator = '+';
          else if (joiner === SP_CP.SCALING_JOINER) operator = '-';
          else operator = String(settings.genericCompoundOperator || '-').slice(0, 1) || '-';
        }
        builder.append(operator, [joinerIndex]);
        pos += 1;
      }
    }
    return true;
  }

  function findCurrentLongGlyph(cps) {
    const start = cps.indexOf(SP_CP.LONG_START);
    if (start <= 0) return null;
    const end = cps.indexOf(SP_CP.LONG_END, start + 1);
    if (end < 0) return null;
    return { headIndex: start - 1, startIndex: start, endIndex: end };
  }

  function hasReverseLongGlyphControls(cps) {
    return cps.includes(SP_CP.REVERSE_LONG_START) || cps.includes(SP_CP.REVERSE_LONG_END);
  }

  function hasCanonicalLongGlyphControls(cps) {
    const source = Array.from(cps || []).map(Number);
    return source.some(cp =>
      cp === SP_CP.DEPRECATED_LONG_PI_START ||
      cp === SP_CP.DEPRECATED_LONG_PI_EXTENSION ||
      cp === SP_CP.LONG_START ||
      cp === SP_CP.LONG_END ||
      cp === SP_CP.REVERSE_LONG_START ||
      cp === SP_CP.REVERSE_LONG_END ||
      cp === SP_CP.DEPRECATED_LONG_EXTENSION
    );
  }

  function normalizeLongGlyphPresentation(value) {
    const normalized = String(value ?? '').trim().toLowerCase();
    if (normalized === 'connected' || normalized === 'decomposed') return normalized;
    return null;
  }

  function attachLongGlyphPresentation(result, presentation) {
    const normalized = normalizeLongGlyphPresentation(presentation);
    if (normalized && result && typeof result === 'object') result.longGlyphPresentation = normalized;
    return result;
  }

  function appendLegacyOrdinaryFallback(builder, cps, kind, adapterId, settings = {}) {
    let emittedCellCount = 0;
    for (const cell of splitCanonicalCells(cps)) {
      if (cell.controlOnly) {
        builder.mark(cell.indices);
        continue;
      }
      if (emittedCellCount > 0) builder.append(' ');
      appendLegacyCell(builder, cell, kind, adapterId, settings);
      emittedCellCount += 1;
    }
  }

  function adaptLegacyLinja(canonicalCps, kind, context = {}) {
    const adapterId = kind === 'linja-pona' ? 'linja-pona-legacy-v1' : 'linja-sike-legacy-v1';
    const settings = context.settings || {};
    const maxLongPiCells = Math.max(1, Math.min(3, Math.trunc(Number(settings.maxLongPiCells) || 3)));
    const cps = Array.from(canonicalCps || []);
    const builder = createMappedRenderBuilder(cps.length);

    function finishLegacyResult(longGlyphPresentation = null) {
      const result = attachLongGlyphPresentation(builder.finish(), longGlyphPresentation);
      if (String(settings.cornerBracketMode || '').trim().toLowerCase() !== 'synthetic') return result;
      const syntheticCornerBrackets = [];
      for (let canonicalIndex = 0; canonicalIndex < cps.length; canonicalIndex++) {
        const codepoint = cps[canonicalIndex];
        if (codepoint !== SP_CP.LEFT_CORNER && codepoint !== SP_CP.RIGHT_CORNER) continue;
        const span = result.canonicalToRenderSpans[canonicalIndex];
        if (!span || span.renderEnd <= span.renderStart) continue;
        syntheticCornerBrackets.push({
          canonicalIndex,
          renderStart: span.renderStart,
          renderEnd: span.renderEnd,
          codepoint,
          side: codepoint === SP_CP.RIGHT_CORNER ? 'right' : 'left'
        });
      }
      if (syntheticCornerBrackets.length) result.syntheticCornerBrackets = syntheticCornerBrackets;
      return result;
    }

    const isCartouche = cps.length >= 2 && cps[0] === SP_CP.CARTOUCHE_START && cps[cps.length - 1] === SP_CP.CARTOUCHE_END;
    if (isCartouche) {
      builder.append('[', [0]);
      const cells = splitCanonicalCells(cps, 1, cps.length - 1);
      for (const cell of cells) {
        if (cell.controlOnly) { builder.mark(cell.indices); continue; }
        builder.append('_', [cell.indices[0]]);
        appendLegacyCell(builder, cell, kind, adapterId, settings);
      }
      builder.append(']', [cps.length - 1]);
      return finishLegacyResult();
    }

    const longGlyph = findCurrentLongGlyph(cps);
    if (longGlyph) {
      const headCp = cps[longGlyph.headIndex];
      const cells = splitCanonicalCells(cps, longGlyph.startIndex + 1, longGlyph.endIndex);
      const usableCells = cells.filter(cell => !cell.controlOnly);
      const hasReverseLong = hasReverseLongGlyphControls(cps);
      if (!hasReverseLong && headCp === SP_CP.PI && usableCells.length >= 1 && usableCells.length <= maxLongPiCells) {
        builder.append('pi', [longGlyph.headIndex]);
        if (kind === 'linja-pona') {
          builder.append('+'.repeat(usableCells.length), [longGlyph.startIndex]);
          usableCells.forEach((cell, index) => {
            if (index > 0) builder.append(' ');
            appendLegacyCell(builder, cell, kind, adapterId, settings);
          });
        } else {
          builder.append('+', [longGlyph.startIndex]);
          usableCells.forEach(cell => {
            builder.append('__', [cell.indices[0]]);
            appendLegacyCell(builder, cell, kind, adapterId, settings);
          });
        }
        builder.mark([longGlyph.endIndex]);
        for (let i = 0; i < cps.length; i++) {
          if (i < longGlyph.headIndex || i > longGlyph.endIndex) {
            const text = legacyWordEncoding(cps[i], kind, settings);
            if (text == null) appendUnsupported(builder, i, cps[i], adapterId, settings);
            else builder.append(text, [i]);
          }
        }
        return finishLegacyResult('connected');
      }

      warnFontRenderAdapterOnce(adapterId, 'unsupported, reverse, or overlong long glyph rendered as ordinary cells');
      appendLegacyOrdinaryFallback(builder, cps, kind, adapterId, settings);
      return finishLegacyResult('decomposed');
    }

    // Basic normalization of the deprecated combining long-pi syntax.
    if (cps[0] === SP_CP.DEPRECATED_LONG_PI_START) {
      const cells = splitCanonicalCells(cps, 1, cps.length);
      const usableCells = cells.filter(cell => !cell.controlOnly);
      builder.append('pi', [0]);
      if (kind === 'linja-pona') builder.append('+'.repeat(Math.max(1, Math.min(maxLongPiCells, usableCells.length))), [0]);
      else builder.append('+', [0]);
      usableCells.slice(0, maxLongPiCells).forEach((cell, index) => {
        if (kind === 'linja-pona') { if (index > 0) builder.append(' '); }
        else builder.append('__', [cell.indices[0]]);
        appendLegacyCell(builder, cell, kind, adapterId, settings);
      });
      return finishLegacyResult('connected');
    }

    appendLegacyOrdinaryFallback(builder, cps, kind, adapterId, settings);
    return finishLegacyResult();
  }

  function nasinSitelenPuMonoMapCp(cp) {
    if (cp === SP_CP.NI_LEFT || cp === SP_CP.NI_UP || cp === SP_CP.NI_RIGHT) return SP_CP.NI;
    if (cp === SP_CP.SEWI_ALT) return SP_CP.SEWI;
    if (cp === SP_CP.MIDDLE_DOT) return '.'.codePointAt(0);
    if (cp === SP_CP.COLON) return ':'.codePointAt(0);
    if ((cp >= 0xF1900 && cp <= 0xF1988) || (cp >= 0xF19A0 && cp <= 0xF19A3) || cp === SP_CP.CARTOUCHE_START || cp === SP_CP.CARTOUCHE_END || cp === SP_CP.IDEOGRAPHIC_SPACE || cp === SP_CP.LEFT_CORNER || cp === SP_CP.RIGHT_CORNER) return cp;
    return null;
  }

  function nasinSitelenPuMonoAdapter({ canonicalCps, settings = {} }) {
    const adapterId = 'nasin-sitelen-pu-mono-v1';
    const cps = Array.from(canonicalCps || []);
    const builder = createMappedRenderBuilder(cps.length);
    for (let i = 0; i < cps.length; i++) {
      const cp = cps[i];
      if (SP_JOINERS.has(cp) || cp === SP_CP.LONG_START || cp === SP_CP.LONG_END || cp === SP_CP.REVERSE_LONG_START || cp === SP_CP.REVERSE_LONG_END || cp === SP_CP.CARTOUCHE_EXTENSION || cp === SP_CP.DEPRECATED_LONG_PI_START || cp === SP_CP.DEPRECATED_LONG_PI_EXTENSION || cp === SP_CP.DEPRECATED_LONG_EXTENSION) {
        builder.mark([i]);
        continue;
      }
      if (cp === SP_CP.TALLY) {
        appendUnsupported(builder, i, cp, adapterId, settings, 'combining tally requires renderer manual-tally mode');
        continue;
      }
      const mapped = nasinSitelenPuMonoMapCp(cp);
      if (mapped == null) appendUnsupported(builder, i, cp, adapterId, settings, 'font maps this code point to a placeholder or lacks it');
      else builder.appendCodepoints([mapped], [i]);
    }
    return attachLongGlyphPresentation(
      builder.finish(),
      hasCanonicalLongGlyphControls(cps) ? 'decomposed' : null
    );
  }

  function lipamankaCpNeedsTranslation(cp, settings = {}) {
    if (SP_JOINERS.has(cp) || cp === SP_CP.MIDDLE_DOT || cp === SP_CP.COLON || cp === SP_CP.TALLY || cp === SP_CP.NI_LEFT || cp === SP_CP.NI_UP || cp === SP_CP.NI_RIGHT || cp === SP_CP.SEWI_ALT || cp === SP_CP.LEFT_CORNER || cp === SP_CP.RIGHT_CORNER || cp === SP_CP.IDEOGRAPHIC_SPACE) return true;
    if (cp === SP_CP.LINLUWI || cp === SP_CP.KIKI || cp === SP_CP.SU || cp > 0xF19A3) return true;
    if (settings.deterministicAlternates !== false && (cp === SP_CP.JAKI || cp === SP_CP.KO)) return true;
    return false;
  }

  function lipamankaSequenceNeedsTranslation(cps, settings = {}) {
    if (cps.some(cp => lipamankaCpNeedsTranslation(cp, settings))) return true;
    if (hasReverseLongGlyphControls(cps)) return true;

    const longGlyph = findCurrentLongGlyph(cps);
    if (!longGlyph) return false;
    const headCp = cps[longGlyph.headIndex];
    return headCp !== SP_CP.PI && headCp !== SP_CP.LON;
  }

  function linjaLipamankaAdapter({ canonicalCps, settings = {} }) {
    const adapterId = 'linja-lipamanka-v1';
    const cps = Array.from(canonicalCps || []);
    if (!lipamankaSequenceNeedsTranslation(cps, settings)) {
      return identityFontRenderAdapter({ canonicalCps: cps });
    }

    const builder = createMappedRenderBuilder(cps.length);
    const isCartouche = cps.length >= 2 && cps[0] === SP_CP.CARTOUCHE_START && cps[cps.length - 1] === SP_CP.CARTOUCHE_END;
    if (isCartouche) {
      builder.append('[', [0]);
      const cells = splitCanonicalCells(cps, 1, cps.length - 1).filter(cell => !cell.controlOnly);
      cells.forEach((cell, index) => {
        if (index > 0) builder.append(' ');
        appendLegacyCell(builder, cell, 'linja-lipamanka', adapterId, settings);
      });
      builder.append(']', [cps.length - 1]);
      return builder.finish();
    }

    const longGlyph = findCurrentLongGlyph(cps);
    if (longGlyph) {
      const headCp = cps[longGlyph.headIndex];
      const headName = legacyWordEncoding(headCp, 'linja-lipamanka', settings);
      const supportedHead = headCp === SP_CP.PI || headCp === SP_CP.LON;
      const hasReverseLong = hasReverseLongGlyphControls(cps);
      const cells = splitCanonicalCells(cps, longGlyph.startIndex + 1, longGlyph.endIndex).filter(cell => !cell.controlOnly);
      if (!hasReverseLong && supportedHead && headName) {
        builder.append(headName, [longGlyph.headIndex]);
        builder.append('(', [longGlyph.startIndex]);
        cells.forEach((cell, index) => {
          if (index > 0) builder.append(' ');
          appendLegacyCell(builder, cell, 'linja-lipamanka', adapterId, settings);
        });
        builder.append(')', [longGlyph.endIndex]);
        return attachLongGlyphPresentation(builder.finish(), 'connected');
      }
      warnFontRenderAdapterOnce(adapterId, 'unsupported long-glyph head rendered as ordinary glyphs');
    }

    appendLegacyOrdinaryFallback(builder, cps, 'linja-lipamanka', adapterId, settings);
    return attachLongGlyphPresentation(
      builder.finish(),
      hasCanonicalLongGlyphControls(cps) ? 'decomposed' : null
    );
  }

  __fontRenderAdapters.set('linja-pona-legacy-v1', args => adaptLegacyLinja(args.canonicalCps, 'linja-pona', args));
  __fontRenderAdapters.set('linja-sike-legacy-v1', args => adaptLegacyLinja(args.canonicalCps, 'linja-sike', args));
  __fontRenderAdapters.set('nasin-sitelen-pu-mono-v1', nasinSitelenPuMonoAdapter);
  __fontRenderAdapters.set('linja-lipamanka-v1', linjaLipamankaAdapter);

  function registerFontRenderAdapter(id, adapter) {
    const normalizedId = normalizeRenderAdapterId(id);
    if (normalizedId === DEFAULT_FONT_RENDER_ADAPTER_ID) {
      throw new Error('The built-in "identity" render adapter cannot be replaced.');
    }
    if (typeof adapter !== "function") throw new TypeError("Render adapter must be a function.");
    __fontRenderAdapters.set(normalizedId, adapter);
    return normalizedId;
  }

  function unregisterFontRenderAdapter(id) {
    const normalizedId = normalizeRenderAdapterId(id);
    if (normalizedId === DEFAULT_FONT_RENDER_ADAPTER_ID) return false;
    return __fontRenderAdapters.delete(normalizedId);
  }

  function hasFontRenderAdapter(id) {
    return __fontRenderAdapters.has(normalizeRenderAdapterId(id));
  }

  function adaptCanonicalCodepointsForFont(canonicalCps, context = {}) {
    const canonical = validateRenderCodepoints(Array.from(canonicalCps || []));
    if (!canonical) throw new Error("Canonical render code points must be valid Unicode scalar values.");

    const requestedId = normalizeRenderAdapterId(context.renderAdapterId ?? __renderAdapterId);
    const sourceKind = String(context.sourceKind || "").toLowerCase();
    const rawUnicodeExact = sourceKind === "rawucsur" && context.adaptRawUnicode !== true && __renderAdapterSettings.adaptRawUnicode !== true;
    const bypass = context.bypassRenderAdapter === true || context.isLiteral === true || context.isLiteralCartouche === true || rawUnicodeExact;
    const adapter = bypass
      ? identityFontRenderAdapter
      : (__fontRenderAdapters.get(requestedId) || identityFontRenderAdapter);
    const effectiveId = bypass || !__fontRenderAdapters.has(requestedId)
      ? DEFAULT_FONT_RENDER_ADAPTER_ID
      : requestedId;

    try {
      const rawResult = adapter({
        canonicalCps: canonical.slice(),
        renderAdapterId: effectiveId,
        settings: cloneRenderAdapterSettings(__renderAdapterSettings),
        ...context
      });
      const result = Array.isArray(rawResult) ? { renderCps: rawResult } : (rawResult || {});
      const renderCps = validateRenderCodepoints(result.renderCps);
      if (!renderCps || (canonical.length > 0 && renderCps.length === 0)) throw new Error("Render adapter returned an invalid or empty code-point sequence.");
      const spans = normalizeCanonicalToRenderSpans(result.canonicalToRenderSpans, canonical.length, renderCps.length)
        || (renderCps.length === canonical.length ? identityCanonicalToRenderSpans(canonical) : canonical.map((_cp, index) => ({ canonicalIndex: index, renderStart: 0, renderEnd: renderCps.length })));
      const syntheticCornerBrackets = normalizeSyntheticCornerBrackets(
        result.syntheticCornerBrackets,
        canonical.length,
        renderCps.length
      );
      const longGlyphPresentation = normalizeLongGlyphPresentation(result.longGlyphPresentation)
        || (hasCanonicalLongGlyphControls(canonical) ? 'connected' : null);
      return {
        canonicalCps: canonical,
        renderCps,
        canonicalToRenderSpans: spans,
        syntheticCornerBrackets,
        longGlyphPresentation,
        renderAdapterId: effectiveId,
        requestedRenderAdapterId: requestedId,
        usedFallback: effectiveId !== requestedId
      };
    } catch (error) {
      try { console.warn(`[font-render-adapter] ${requestedId} failed; using identity.`, error); } catch (_) {}
      return {
        canonicalCps: canonical,
        renderCps: canonical.slice(),
        canonicalToRenderSpans: identityCanonicalToRenderSpans(canonical),
        syntheticCornerBrackets: [],
        longGlyphPresentation: hasCanonicalLongGlyphControls(canonical) ? 'connected' : null,
        renderAdapterId: DEFAULT_FONT_RENDER_ADAPTER_ID,
        requestedRenderAdapterId: requestedId,
        usedFallback: true
      };
    }
  }

  function getElementCanonicalCps(el) {
    if (!el || typeof el !== "object") return [];
    if (Array.isArray(el.canonicalCps)) return el.canonicalCps;
    if (Array.isArray(el.cps)) return el.cps;
    if (Number.isInteger(el.cp)) return [el.cp];
    return [];
  }

  function getElementRenderCps(el) {
    if (!el || typeof el !== "object") return [];
    if (Array.isArray(el.renderCps)) return el.renderCps;
    if (Number.isInteger(el.renderCp)) return [el.renderCp];
    return getElementCanonicalCps(el);
  }

  function getSyntheticCornerBracketCodepoint(el) {
    if (!el || typeof el !== 'object') return null;
    const instructions = Array.isArray(el.syntheticCornerBrackets) ? el.syntheticCornerBrackets : [];
    if (instructions.length !== 1) return null;
    const cp = Number(instructions[0]?.codepoint);
    const canonical = getElementCanonicalCps(el);
    if (canonical.length !== 1 || canonical[0] !== cp) return null;
    return (cp === SP_CP.LEFT_CORNER || cp === SP_CP.RIGHT_CORNER) ? cp : null;
  }

  function measureSyntheticCornerBracket(fontPx, codepoint) {
    const px = Math.max(1, Number(fontPx) || 1);
    const w = Math.max(1, Math.ceil(px * 0.36));
    const h = Math.max(1, Math.ceil(px * 0.76));
    const isRight = Number(codepoint) === SP_CP.RIGHT_CORNER;
    const lift = isRight ? 0 : Math.max(4, px * 0.18);
    const yTopFromBaseline = -(h * 0.82) - lift;
    const yBottomFromBaseline = yTopFromBaseline + h;
    return {
      chars: String.fromCodePoint(Number(codepoint)),
      ascent: Math.max(0, -yTopFromBaseline),
      descent: Math.max(0, yBottomFromBaseline),
      left: 0,
      w,
      h,
      px,
      syntheticCornerBracket: true,
      codepoint: Number(codepoint)
    };
  }

  function drawSyntheticCornerBracket(ctx, codepoint, x, baseline, {
    fontPx,
    widthPx,
    heightPx,
    fillCss = '#111111',
    halo = null
  } = {}) {
    if (!ctx) return;
    const cp = Number(codepoint);
    if (cp !== SP_CP.LEFT_CORNER && cp !== SP_CP.RIGHT_CORNER) return;
    const px = Math.max(1, Number(fontPx) || 1);
    const isRight = cp === SP_CP.RIGHT_CORNER;
    const strokeW = px <= 12 ? Math.max(1.0, px * 0.065) : Math.max(2.5, px * 0.065);
    const runW = Math.max(Number(widthPx) || 0, px * 0.36);
    const runH = Math.max(Number(heightPx) || 0, px * 0.76);
    const pad = Math.max(0.5, strokeW * 0.5);
    const xLeft = Number(x) + pad;
    const xRight = Number(x) + runW - pad;
    let yTop = Number(baseline) - runH * 0.82;
    if (!isRight) yTop -= Math.max(4, px * 0.18);
    const yBottom = yTop + runH;
    const arm = Math.max(px * 0.26, Math.min(runW * 0.82, px * 0.48));

    ctx.save();
    ctx.beginPath();
    ctx.lineCap = 'butt';
    ctx.lineJoin = 'miter';
    if (isRight) {
      ctx.moveTo(xRight - arm + strokeW * 0.5, yBottom - strokeW * 0.5);
      ctx.lineTo(xRight - strokeW * 0.5, yBottom - strokeW * 0.5);
      ctx.lineTo(xRight - strokeW * 0.5, yTop + strokeW * 0.5);
    } else {
      ctx.moveTo(xLeft + strokeW * 0.5, yBottom - strokeW * 0.5);
      ctx.lineTo(xLeft + strokeW * 0.5, yTop + strokeW * 0.5);
      ctx.lineTo(xLeft + arm - strokeW * 0.5, yTop + strokeW * 0.5);
    }

    const haloInfo = halo && typeof halo === 'object' ? halo : {};
    const haloEnabled = haloInfo.enabled === true && Number(haloInfo.widthPx) > 0;
    if (haloEnabled) {
      ctx.strokeStyle = String(haloInfo.color || '#FFFFFF');
      ctx.lineWidth = strokeW + Math.max(0, Number(haloInfo.widthPx) || 0) * 2;
      ctx.stroke();
    }
    ctx.strokeStyle = String(fillCss || '#111111');
    ctx.lineWidth = strokeW;
    ctx.stroke();
    ctx.restore();
  }

  function captureRenderFontState() {
    return {
      text: FONT_FAMILY_TEXT,
      cartouche: FONT_FAMILY_CARTOUCHE,
      number: FONT_FAMILY_NUMBER,
      literal: FONT_FAMILY_LITERAL,
      literalCartouche: FONT_FAMILY_LITERAL_CARTOUCHE,
      unknown: FONT_FAMILY_UNKNOWN,
      mixedStyle: __mixedStyle,
      showUnknownText: __showUnknownText,
      cartoucheCommaTallyMarks: __cartoucheCommaTallyMarks,
      cartoucheTallyMode: __cartoucheTallyMode,
      manualTallySmallFontLiftPx: __manualTallySmallFontLiftPx,
      manualTallySmallFontMaxPx: __manualTallySmallFontMaxPx,
      unknownTextDisplay: { ...__unknownTextDisplay },
      renderSpacing: { ...__renderSpacing },
      abbreviateNumericCartouches: __abbreviateNumericCartouches,
      preserveNumericCartoucheBreaksInAbbreviation: __preserveNumericCartoucheBreaksInAbbreviation,
      autoCartoucheStandaloneProperNames: __autoCartoucheStandaloneProperNames,
      relaxedNanpaLinjanParsing: __relaxedNanpaLinjanParsing,
      relaxedNanpaLinjanRendering: __relaxedNanpaLinjanRendering,
      nanpaColonParsing: __nanpaColonParsing,
      nanpaColonRendering: __nanpaColonRendering,
      enableHexParsing: __enableHexParsing,
      enableBinaryParsing: __enableBinaryParsing,
      enableBinaryRendering: __enableBinaryRendering,
      nasinNanpaPona: __nasinNanpaPona,
      renderAdapterId: __renderAdapterId,
      renderAdapterSettings: cloneRenderAdapterSettings(__renderAdapterSettings),
    };
  }

  function restoreRenderFontState(state) {
    if (!state) return;
    FONT_FAMILY_TEXT = state.text || FONT_FAMILY_TEXT;
    FONT_FAMILY_CARTOUCHE = state.cartouche || FONT_FAMILY_CARTOUCHE;
    FONT_FAMILY_NUMBER = state.number || FONT_FAMILY_NUMBER;
    FONT_FAMILY_LITERAL = state.literal || FONT_FAMILY_LITERAL;
    FONT_FAMILY_LITERAL_CARTOUCHE = state.literalCartouche || state.text || FONT_FAMILY_LITERAL_CARTOUCHE;
    FONT_FAMILY_UNKNOWN = state.unknown || FONT_FAMILY_UNKNOWN;
    if (state.mixedStyle === "short" || state.mixedStyle === "long") __mixedStyle = state.mixedStyle;
    __showUnknownText = !!state.showUnknownText;
    if (state.cartoucheCommaTallyMarks != null) __cartoucheCommaTallyMarks = !!state.cartoucheCommaTallyMarks;
    if (state.cartoucheTallyMode != null) __cartoucheTallyMode = normalizeCartoucheTallyMode(state.cartoucheTallyMode);
    __manualTallySmallFontLiftPx = normalizeOptionalNonNegativeNumber(state.manualTallySmallFontLiftPx);
    __manualTallySmallFontMaxPx = normalizePositiveNumber(state.manualTallySmallFontMaxPx, 12);
    __unknownTextDisplay = {
      style: "outline-box",
      colorMode: "auto",
      color: null,
      lineWidthPx: 1.5,
      paddingPx: 2,
      dash: false,
      ...(state.unknownTextDisplay || {})
    };
    __renderSpacing = { ...DEFAULT_RENDER_SPACING, ...(state.renderSpacing || {}) };
    __abbreviateNumericCartouches = !!state.abbreviateNumericCartouches;
    __preserveNumericCartoucheBreaksInAbbreviation = !!state.preserveNumericCartoucheBreaksInAbbreviation;
    __autoCartoucheStandaloneProperNames = !!state.autoCartoucheStandaloneProperNames;
    __relaxedNanpaLinjanParsing = !!state.relaxedNanpaLinjanParsing;
    __relaxedNanpaLinjanRendering = !!state.relaxedNanpaLinjanRendering;
    __nanpaColonParsing = !!state.nanpaColonParsing;
    __nanpaColonRendering = !!state.nanpaColonRendering;
    __enableHexParsing = !!state.enableHexParsing;
    __enableBinaryParsing = !!state.enableBinaryParsing;
    __enableBinaryRendering = !!state.enableBinaryRendering;
    __nasinNanpaPona = !!state.nasinNanpaPona;
    __renderAdapterId = normalizeRenderAdapterId(state.renderAdapterId);
    __renderAdapterSettings = cloneRenderAdapterSettings(state.renderAdapterSettings);
  }

  let __renderConfigScopeQueue = Promise.resolve();

  // mixedStyle lives in outer scope so applyRenderConfig can set it
  // and astToLineElements / lineToElements can read it via getMixedStyle()
  let __mixedStyle = "short";
  let __showUnknownText = false;

  // Numeric/date/time cartouche display abbreviation.
  // Default false preserves the existing full nanpa-linja-n cartouche output.
  let __abbreviateNumericCartouches = false;

 // When abbreviation is enabled, a full-cartouche break sequence
  // "nena e nena e" may be represented by one visible "e" codepoint.
  // This option defaults to false. Set it explicitly to true to show the
  // internal break as "e" in abbreviated numeric cartouches.
  let __preserveNumericCartoucheBreaksInAbbreviation = false;

  // Optional fallback for standalone capitalized proper-name words outside [].
  // Default to true preserves the existing unknown-text behavior.
  let __autoCartoucheStandaloneProperNames = true;

  // Relaxed nanpa-linja-n recognition/rendering. Defaults are strict/strict.
  let __relaxedNanpaLinjanParsing = false;
  let __relaxedNanpaLinjanRendering = false;

  // Alternative decimal head syntax is opt-in. Rendering implies parsing so
  // the renderer never emits syntax that the same configuration rejects.
  // Both stored flags default to false when omitted.
  let __nanpaColonParsing = false;
  let __nanpaColonRendering = false;

  // Hexadecimal recognition is opt-in. This flag affects parsing only; once a
  // source span has been classified as hexadecimal, its semantic run always
  // renders as hexadecimal. Re-parsing source text applies the current flag.
  let __enableHexParsing = false;

  // Binary recognition/rendering is opt-in. Both stored flags default false.
  // Rendering implies parsing, matching the established nanpa-colon flag model:
  // once a binary source has been classified, its semantic run renders as binary.
  let __enableBinaryParsing = false;
  let __enableBinaryRendering = false;

  // Optional conversion of eligible plain Arabic integer/decimal expressions
  // to ordinary Toki Pona words using nasin nanpa pona. Default false preserves
  // every existing numeric/cartouche code path.
  let __nasinNanpaPona = false;

  // Controls only ordinary, non-numeric, non-quoted cartouche parsing.
  // When true:  [meli,,] may produce cartouche tally marks.
  // When false: commas are separators/ignored and never emit/draw tally marks.
  // Outside cartouches, commas are never translated to tally marks.
  let __cartoucheCommaTallyMarks = true;

  // How comma/tally input inside an ordinary cartouche is rendered:
  //   "ucsur"  = default UCSUR behavior: comma becomes U+F199E.
  //   "comma"  = preserve comma U+002C for fonts that shape comma ligatures in HTML.
  //   "manual" = remove commas from the font run and draw tally strokes manually.
  let __cartoucheTallyMode = "ucsur";

  // Some font pairs need a tiny overlap between renderer-drawn tally marks and
  // the cartouche bottom rule at very small sizes. Null means use the built-in
  // family fallback; an explicit numeric value is a per-font configuration.
  let __manualTallySmallFontLiftPx = null;
  let __manualTallySmallFontMaxPx = 12;

  let __unknownTextDisplay = {
    style: "outline-box",
    colorMode: "auto",
    color: null,
    lineWidthPx: 1.5,
    paddingPx: 2,
    dash: false,
  };
  function getMixedStyle() { return (__mixedStyle === "long") ? "long" : "short"; }
  function setMixedStyle(v) { __mixedStyle = (v === "long") ? "long" : "short"; }
  function getShowUnknownText() { return !!__showUnknownText; }
  function setShowUnknownText(v) { __showUnknownText = !!v; }
  function getAbbreviateNumericCartouches() { return !!__abbreviateNumericCartouches; }
  function setAbbreviateNumericCartouches(v) { __abbreviateNumericCartouches = !!v; }
  function getPreserveNumericCartoucheBreaksInAbbreviation() {
    return !!__preserveNumericCartoucheBreaksInAbbreviation;
  }
  function setPreserveNumericCartoucheBreaksInAbbreviation(v) {
    __preserveNumericCartoucheBreaksInAbbreviation = !!v;
  }
  function getAutoCartoucheStandaloneProperNames() { return !!__autoCartoucheStandaloneProperNames; }
  function setAutoCartoucheStandaloneProperNames(v) { __autoCartoucheStandaloneProperNames = !!v; }
  function getRelaxedNanpaLinjanParsing() { return !!__relaxedNanpaLinjanParsing; }
  function setRelaxedNanpaLinjanParsing(v) { __relaxedNanpaLinjanParsing = !!v; }
  function getRelaxedNanpaLinjanRendering() { return !!__relaxedNanpaLinjanRendering; }
  function setRelaxedNanpaLinjanRendering(v) { __relaxedNanpaLinjanRendering = !!v; }
  function getNanpaColonParsing() { return !!(__nanpaColonParsing || __nanpaColonRendering); }
  function setNanpaColonParsing(v) { __nanpaColonParsing = !!v; }
  function getNanpaColonRendering() { return !!__nanpaColonRendering; }
  function setNanpaColonRendering(v) { __nanpaColonRendering = !!v; }
  function getEnableHexParsing() { return !!__enableHexParsing; }
  function setEnableHexParsing(v) { __enableHexParsing = !!v; }
  function getEnableBinaryParsing() { return !!(__enableBinaryParsing || __enableBinaryRendering); }
  function setEnableBinaryParsing(v) { __enableBinaryParsing = !!v; }
  function getEnableBinaryRendering() { return !!__enableBinaryRendering; }
  function setEnableBinaryRendering(v) { __enableBinaryRendering = !!v; }
  function getNasinNanpaPona() { return !!__nasinNanpaPona; }
  function setNasinNanpaPona(v) { __nasinNanpaPona = !!v; }
  function getCartoucheCommaTallyMarks() { return !!__cartoucheCommaTallyMarks; }
  function setCartoucheCommaTallyMarks(v) { __cartoucheCommaTallyMarks = !!v; }
  function normalizeCartoucheTallyMode(v) {
    const s = String(v ?? "").toLowerCase().trim();
    if (s === "manual" || s === "draw" || s === "draw-manual") return "manual";
    if (s === "comma" || s === "literal-comma" || s === "font-comma") return "comma";
    return "ucsur";
  }
  function getCartoucheTallyMode() { return normalizeCartoucheTallyMode(__cartoucheTallyMode); }
  function setCartoucheTallyMode(v) { __cartoucheTallyMode = normalizeCartoucheTallyMode(v); }
  function normalizeOptionalNonNegativeNumber(value) {
    if (value == null || value === "") return null;
    const n = Number(value);
    return Number.isFinite(n) ? Math.max(0, n) : null;
  }
  function normalizePositiveNumber(value, fallback) {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? n : fallback;
  }
  function resolveLongPiHeadWidthPx(fontPx, boxWidth, measuredHead, groupCount, configuredScale = null) {
    const px = Math.max(1, Number(fontPx) || 1);
    const width = Math.max(1, Number(boxWidth) || 1);
    const measured = Number(measuredHead);
    const groups = Math.max(1, Number(groupCount) || 1);
    const scale = Number(configuredScale);

    if (Number.isFinite(scale) && scale > 0) {
      return Math.max(1, Math.min(width, px * scale));
    }

    return Math.max(1, Math.min(
      Number.isFinite(measured) ? measured : px * 0.10,
      px * 0.12,
      width * 0.08,
      width / Math.max(6, groups * 3)
    ));
  }
  function isBuiltInSmallTallyLiftFamily(fontFamily) {
    const family = String(fontFamily || "").trim();
    return family === "TP-Cartouche-Font" ||
      family === "TP-Nasin-Sitelen-Pu-Mono-Nanpa-Linja-N-Font";
  }
  function manualTallySmallFontLiftFor(fontFamily, fontPx) {
    const px = Math.max(1, Number(fontPx) || 1);
    const maxPx = normalizePositiveNumber(__manualTallySmallFontMaxPx, 12);
    if (px > maxPx) return 0;
    const configured = normalizeOptionalNonNegativeNumber(__manualTallySmallFontLiftPx);
    if (configured != null) return configured;
    return isBuiltInSmallTallyLiftFamily(fontFamily) ? 1 : 0;
  }
  function getUnknownTextDisplay() { return { ...__unknownTextDisplay }; }
  function setUnknownTextDisplay(v = {}) {
    __unknownTextDisplay = {
      ...__unknownTextDisplay,
      ...v,
      style: String(v?.style || __unknownTextDisplay.style || "outline-box"),
      colorMode: String(v?.colorMode || __unknownTextDisplay.colorMode || "auto"),
      lineWidthPx: Number.isFinite(Number(v?.lineWidthPx)) ? Number(v.lineWidthPx) : (__unknownTextDisplay.lineWidthPx ?? 1.5),
      paddingPx: Number.isFinite(Number(v?.paddingPx)) ? Number(v.paddingPx) : (__unknownTextDisplay.paddingPx ?? 2),
      dash: (v?.dash != null) ? !!v.dash : !!__unknownTextDisplay.dash,
    };
  }

  const DEFAULT_RENDER_SPACING = Object.freeze({
    glyphGapScale: 0.22,
    glyphGapMinPx: 2,
    glyphGapMaxPx: 24,
    cartoucheLeadGapScale: 0.08,
    cartouchePadScale: 0.11,
    cartouchePadMinPx: 4,
    lineGapScale: 0.32,
    lineGapMinPx: 4,
    lineGapMaxPx: 40,
  });

  const RENDER_SPACING_PRESETS = Object.freeze({
    default: { ...DEFAULT_RENDER_SPACING },
    compact: {
      glyphGapScale: 0.06,
      glyphGapMinPx: 0,
      glyphGapMaxPx: 8,

      cartoucheLeadGapScale: 0.00,
      cartouchePadScale: 0.06,
      cartouchePadMinPx: 2,

      lineGapScale: 0.24,
      lineGapMinPx: 4,
      lineGapMaxPx: 32
    },
    comfortable: {
      glyphGapScale: 0.38,
      glyphGapMinPx: 6,
      glyphGapMaxPx: 42,

      cartoucheLeadGapScale: 0.18,
      cartouchePadScale: 0.14,
      cartouchePadMinPx: 5,

      lineGapScale: 0.55,
      lineGapMinPx: 10,
      lineGapMaxPx: 72
    },
  });

  let __renderSpacing = { ...DEFAULT_RENDER_SPACING };

  function normalizeRenderSpacingPreset(value) {
    const key = String(value ?? "default").trim().toLowerCase();
    return Object.prototype.hasOwnProperty.call(RENDER_SPACING_PRESETS, key) ? key : "default";
  }

  function nonNegativeFiniteOr(value, fallback) {
    const n = Number(value);
    return Number.isFinite(n) ? Math.max(0, n) : fallback;
  }

  function applyRenderSpacingConfig(layout = {}) {
    const presetKey = normalizeRenderSpacingPreset(layout.spacingPreset);
    const next = { ...RENDER_SPACING_PRESETS[presetKey] };

    if (layout.glyphGapScale != null) next.glyphGapScale = nonNegativeFiniteOr(layout.glyphGapScale, next.glyphGapScale);
    if (layout.glyphGapMinPx != null) next.glyphGapMinPx = nonNegativeFiniteOr(layout.glyphGapMinPx, next.glyphGapMinPx);
    if (layout.glyphGapMaxPx != null) next.glyphGapMaxPx = nonNegativeFiniteOr(layout.glyphGapMaxPx, next.glyphGapMaxPx);
    if (layout.cartoucheLeadGapScale != null) next.cartoucheLeadGapScale = nonNegativeFiniteOr(layout.cartoucheLeadGapScale, next.cartoucheLeadGapScale);
    if (layout.cartouchePadScale != null) next.cartouchePadScale = nonNegativeFiniteOr(layout.cartouchePadScale, next.cartouchePadScale);
    if (layout.cartouchePadMinPx != null) next.cartouchePadMinPx = nonNegativeFiniteOr(layout.cartouchePadMinPx, next.cartouchePadMinPx);
    if (layout.lineGapScale != null) next.lineGapScale = nonNegativeFiniteOr(layout.lineGapScale, next.lineGapScale);
    if (layout.lineGapMinPx != null) next.lineGapMinPx = nonNegativeFiniteOr(layout.lineGapMinPx, next.lineGapMinPx);
    if (layout.lineGapMaxPx != null) next.lineGapMaxPx = nonNegativeFiniteOr(layout.lineGapMaxPx, next.lineGapMaxPx);

    if (next.glyphGapMaxPx < next.glyphGapMinPx) next.glyphGapMaxPx = next.glyphGapMinPx;
    if (next.lineGapMaxPx < next.lineGapMinPx) next.lineGapMaxPx = next.lineGapMinPx;

    __renderSpacing = next;
  }

  function wordGapForPx(px) {
    const p = Math.max(8, Number(px ?? 56));
    return Math.max(
      __renderSpacing.glyphGapMinPx,
      Math.min(__renderSpacing.glyphGapMaxPx, Math.round(p * __renderSpacing.glyphGapScale))
    );
  }

  function cartoucheLeadGapForPx(fontPx) {
    const p = Math.max(8, Number(fontPx ?? 56));
    return Math.max(0, Math.round(p * __renderSpacing.cartoucheLeadGapScale));
  }

  function cartouchePadForPx(fontPx) {
    const p = Math.max(8, Number(fontPx ?? 56));
    return Math.max(
      __renderSpacing.cartouchePadMinPx ?? 4,
      Math.round(p * (__renderSpacing.cartouchePadScale ?? 0.11))
    );
  }

  function lineGapForPx(px) {
    const p = Math.max(8, Number(px ?? 56));
    return Math.max(
      __renderSpacing.lineGapMinPx,
      Math.min(__renderSpacing.lineGapMaxPx, Math.round(p * __renderSpacing.lineGapScale))
    );
  }

  function shouldUseExplicitLineGapPx(layout = {}) {
    const n = Number(layout?.lineGapPx);
    if (!Number.isFinite(n)) return false;

    // Backward compatibility: older callers may always pass lineGapPx computed
    // from the legacy/default formula. Keep that exact behavior for missing or
    // default spacingPreset, but do not let that legacy value mask the compact
    // or comfortable preset's own line spacing.
    const rawPreset = String(layout?.spacingPreset ?? "").trim();
    const preset = normalizeRenderSpacingPreset(rawPreset || "default");
    if (rawPreset && preset !== "default") {
      return layout?.forceLineGapPx === true || layout?.lineGapPxMode === "exact";
    }

    return true;
  }

  function resolveLineGapPxForLayout(layout = {}, fontPx) {
    if (shouldUseExplicitLineGapPx(layout)) {
      return Math.max(0, Number(layout.lineGapPx));
    }
    return lineGapForPx(fontPx);
  }

  function withScopedRenderConfig(config, work) {
    const run = async () => {
      const prev = captureRenderFontState();
      applyRenderConfig(config);
      try {
        return await work();
      } finally {
        restoreRenderFontState(prev);
      }
    };
    const chained = __renderConfigScopeQueue.then(run, run);
    __renderConfigScopeQueue = chained.then(() => undefined, () => undefined);
    return chained;
  }

  function setRadioValue(name, value) {
    const radios = Array.from(document.querySelectorAll(`input[name="${name}"]`));
    for (const r of radios) r.checked = (r.value === value);
  }

  function applyRenderConfig(config = {}) {
    const layout = config.layout || {};
    applyRenderSpacingConfig(layout);
    const paint = config.paint || {};
    const parser = config.parser || {};
    const fonts = config.fonts || {};
    const roles = fonts.roles || {};
    __renderAdapterId = normalizeRenderAdapterId(fonts.renderAdapterId);
    __renderAdapterSettings = cloneRenderAdapterSettings(fonts.renderAdapterSettings || fonts.settings?.renderAdapterSettings);

    if (layout.fontPx != null) {
      const el = document.getElementById('fontSizeSel');
      if (el) el.value = String(Math.round(Number(layout.fontPx) || 56));
    }
    if (layout.align) {
      const el = document.getElementById('alignSel');
      if (el) el.value = String(layout.align);
    }
    if (paint.fillStyle) {
      const el = document.getElementById('fgPick');
      if (el) el.value = String(paint.fillStyle);
    }
    const halo = paint.halo || {};
    const haloEnable = !!halo.enabled;
    const haloEl = document.getElementById('haloEnable');
    if (haloEl) haloEl.checked = haloEnable;
    const haloPick = document.getElementById('haloPick');
    if (haloPick && halo.color) haloPick.value = String(halo.color);
    const haloWidth = document.getElementById('haloWidthSel');
    if (haloWidth) haloWidth.value = String(Math.max(0, Math.round(Number(halo.widthPx ?? 0) || 0)));

    if (parser.numericMode === 'uniform') setRadioValue('nlMode', 'uniform');
    else setRadioValue('nlMode', 'traditional');

    if (parser.mixedStyle === 'short' || parser.mixedStyle === 'long') setMixedStyle(parser.mixedStyle);
    if (parser.abbreviateNumericCartouches != null) setAbbreviateNumericCartouches(!!parser.abbreviateNumericCartouches);
    else if (parser.numericCartoucheAbbreviation != null) setAbbreviateNumericCartouches(!!parser.numericCartoucheAbbreviation);
    else if (parser.abbreviatedNumericCartouches != null) setAbbreviateNumericCartouches(!!parser.abbreviatedNumericCartouches);

    if (parser.preserveNumericCartoucheBreaksInAbbreviation != null) {
      setPreserveNumericCartoucheBreaksInAbbreviation(parser.preserveNumericCartoucheBreaksInAbbreviation !== false);
    } else if (parser.abbreviatedNumericCartoucheBreakAsEn != null) {
      setPreserveNumericCartoucheBreaksInAbbreviation(parser.abbreviatedNumericCartoucheBreakAsEn !== false);
    }
    if (parser.showUnknownText != null) setShowUnknownText(!!parser.showUnknownText);
    if (parser.autoCartoucheStandaloneProperNames != null) setAutoCartoucheStandaloneProperNames(!!parser.autoCartoucheStandaloneProperNames);
    if (parser.relaxedNanpaLinjanParsing != null) setRelaxedNanpaLinjanParsing(!!parser.relaxedNanpaLinjanParsing);
    if (parser.relaxedNanpaLinjanRendering != null) setRelaxedNanpaLinjanRendering(!!parser.relaxedNanpaLinjanRendering);
    if (parser.nanpaColonParsing != null) setNanpaColonParsing(!!parser.nanpaColonParsing);
    if (parser.nanpaColonRendering != null) setNanpaColonRendering(!!parser.nanpaColonRendering);
    if (parser.enableHexParsing != null) setEnableHexParsing(!!parser.enableHexParsing);
    if (parser.enableBinaryParsing != null) setEnableBinaryParsing(!!parser.enableBinaryParsing);
    if (parser.enableBinaryRendering != null) setEnableBinaryRendering(!!parser.enableBinaryRendering);
    if (parser.nasinNanpaPona != null) setNasinNanpaPona(!!parser.nasinNanpaPona);
    if (parser.cartoucheCommaTallyMarks != null) setCartoucheCommaTallyMarks(!!parser.cartoucheCommaTallyMarks);
    else if (parser.commaTallyInCartouche != null) setCartoucheCommaTallyMarks(!!parser.commaTallyInCartouche);
    else if (parser.enableCartoucheCommaTally != null) setCartoucheCommaTallyMarks(!!parser.enableCartoucheCommaTally);

    if (parser.cartoucheTallyMode != null) setCartoucheTallyMode(parser.cartoucheTallyMode);
    else if (parser.cartoucheCommaTallyMode != null) setCartoucheTallyMode(parser.cartoucheCommaTallyMode);
    else if (parser.tallyMode != null) setCartoucheTallyMode(parser.tallyMode);

    const fontSettings = (fonts.settings && typeof fonts.settings === "object") ? fonts.settings : {};
    const configuredTallyLift = parser.manualTallySmallFontLiftPx ?? fonts.manualTallySmallFontLiftPx ?? fontSettings.manualTallySmallFontLiftPx;
    const configuredTallyMaxPx = parser.manualTallySmallFontMaxPx ?? fonts.manualTallySmallFontMaxPx ?? fontSettings.manualTallySmallFontMaxPx;
    if (configuredTallyLift != null) __manualTallySmallFontLiftPx = normalizeOptionalNonNegativeNumber(configuredTallyLift);
    if (configuredTallyMaxPx != null) __manualTallySmallFontMaxPx = normalizePositiveNumber(configuredTallyMaxPx, 12);

    const unknownTextPaint = paint.unknownText || {};
    setUnknownTextDisplay({
      style: unknownTextPaint.style,
      colorMode: unknownTextPaint.colorMode,
      color: unknownTextPaint.color,
      lineWidthPx: unknownTextPaint.lineWidthPx,
      paddingPx: unknownTextPaint.paddingPx,
      dash: unknownTextPaint.dash,
    });

    FONT_FAMILY_TEXT = roles.word || roles.text || FONT_FAMILY_TEXT;
    FONT_FAMILY_CARTOUCHE = roles.cartouche || FONT_FAMILY_CARTOUCHE;
    FONT_FAMILY_NUMBER = roles.number || roles.date || roles.time || roles.cartouche || FONT_FAMILY_NUMBER;
    FONT_FAMILY_LITERAL = roles.literal || FONT_FAMILY_LITERAL;
    FONT_FAMILY_LITERAL_CARTOUCHE = roles.literalCartouche || roles.literalCartoucheFamily || roles.text || roles.word || FONT_FAMILY_LITERAL_CARTOUCHE;
    FONT_FAMILY_UNKNOWN = roles.unknown || roles.literal || FONT_FAMILY_UNKNOWN;
  }

  async function astToLineElements(ast, config = {}) {
    const layout = config.layout || {};
    const parser = config.parser || {};
    const fontPx = Math.max(8, Number(layout.fontPx ?? (__bridgeGetFontPx ? __bridgeGetFontPx() : 56) ?? 56));
    const mixedStyle = (parser.mixedStyle === "long") ? "long" : "short";
    const lines = [];
    for (const line of ast.lines || []) {
      const elements = [];
      for (let si = 0; si < (line.children || []).length; si++) {
        const seg = line.children[si];
        const sourceKind = seg.kind;
        const sourceSegmentIndex = si;
        if (seg.kind === 'text') {
          if (parser.mode === 'sitelen-seli-kiwen') {
            parseSskTextSegmentToElements(seg.value, elements, { fontPx, parser, mixedStyle, sourceBaseStart: 0, sourceKind, sourceSegmentIndex });
          } else if (isSitelenPonaAsciiExtendedMode(parser)) {
            parseSitelenPonaAsciiExtendedTextSegmentToElements(seg.value, elements, { fontPx, parser, mixedStyle, sourceBaseStart: 0, sourceKind, sourceSegmentIndex });
          } else if (isStandardSitelenPonaAsciiCoreMode(parser)) {
            parseStandardSitelenPonaAsciiCoreTextSegmentToElements(seg.value, elements, { fontPx, parser, mixedStyle, sourceBaseStart: 0, sourceKind, sourceSegmentIndex });
          } else {
            __bridgeParseTextSegmentToElements(seg.value, elements, { fontPx, sourceBaseStart: 0, sourceKind, sourceSegmentIndex, mixedStyle });
          }
        }
        else if (seg.kind === 'bracket') {
          if (parser.mode === 'sitelen-seli-kiwen') {
            parseSskBracketSegmentToElements(seg.value, elements, { fontPx, parser, mixedStyle, sourceBaseStart: 0, sourceKind, sourceSegmentIndex });
          } else if (isSitelenPonaAsciiExtendedMode(parser)) {
            parseSitelenPonaAsciiExtendedBracketSegmentToElements(seg.value, elements, { fontPx, parser, mixedStyle, sourceBaseStart: 0, sourceKind, sourceSegmentIndex });
          } else if (isStandardSitelenPonaAsciiCoreMode(parser)) {
            parseStandardSitelenPonaAsciiCoreBracketSegmentToElements(seg.value, elements, { fontPx, parser, mixedStyle, sourceBaseStart: 0, sourceKind, sourceSegmentIndex });
          } else {
            __bridgeParseBracketSegmentToElements(seg.value, elements, { fontPx, sourceBaseStart: 0, sourceKind, sourceSegmentIndex, mixedStyle });
          }
        }
        else if (seg.kind === 'quote') {
          if (parser.interpretDoubleQuotesAsTeTo === true) {
            __bridgeParseInterpretedQuoteSegmentToElements(seg.value, elements, {
              fontPx,
              parser,
              mixedStyle,
              sourceBaseStart: 0,
              sourceKind: 'interpretedQuote',
              sourceSegmentIndex,
              openQuote: seg.openQuote,
              closeQuote: seg.closeQuote
            });
          } else {
            __bridgeParseQuoteSegmentToElements(seg.value, elements, {
              fontPx,
              sourceBaseStart: 0,
              sourceKind,
              sourceSegmentIndex,
              openQuote: seg.openQuote,
              closeQuote: seg.closeQuote
            });
          }
        }
        else if (seg.kind === 'image') {
          if (elements.length > 0) __bridgePushGapIfNeeded(elements, __bridgeWordGapForPx(fontPx));
          const imgEl = await loadImageElementCanvas(seg.value, fontPx);
          if (imgEl) elements.push({ ...imgEl, sourceKind, sourceSegmentIndex });
        }
        else if (seg.kind === 'rawUcsur') {
          if (!(typeof __bridgeEmitRawUcsurCodepointsWithOptionalManualTallies === "function" && __bridgeEmitRawUcsurCodepointsWithOptionalManualTallies(elements, seg.cps, {
            fontPx,
            fontFamily: seg.fontFamily || FONT_FAMILY_TEXT,
            sourceKind,
            sourceSegmentIndex
          }))) {
            __bridgeMakeRunElementFromCodepoints(elements, seg.cps, { fontPx, fontFamily: seg.fontFamily || FONT_FAMILY_TEXT, sourceKind, sourceSegmentIndex });
          }
        }
      }
      while (elements.length > 0 && elements[elements.length - 1].type === 'gap') elements.pop();
      nanpaDebugTable("ast-to-line-elements:line-elements", elements.map(nanpaDebugElementSummary));
      lines.push(elements);
    }
    nanpaDebugEmit("ast-to-line-elements:done", { lineCount: lines.length });
    return lines;
  }


  function sskWordToCp(word) {
    const key = __bridgeNormalizeTpGlyphKey ? __bridgeNormalizeTpGlyphKey(String(word ?? '')) : String(word ?? '').trim().toLowerCase();
    if (!key) return null;
    return (__bridgeWordToUcsurCp && __bridgeWordToUcsurCp[key] != null) ? __bridgeWordToUcsurCp[key] : null;
  }

  function sskWordsToCps(text) {
    const words = String(text ?? '').trim().split(/\s+/).filter(Boolean);
    if (!words.length) return null;
    const cps = [];
    for (const w of words) {
      const cp = sskWordToCp(w);
      if (cp == null) return null;
      cps.push(cp);
    }
    return cps;
  }

  function emitSskExtendedGlyph(matchText, leftText, headWord, rightText, elements, fontPx, sourceBaseStart = 0, sourceKind = 'text', sourceSegmentIndex = null) {
    const headCp = sskWordToCp(headWord);
    if (headCp == null) return false;

    const outCps = [];

    if (leftText != null && String(leftText).trim()) {
      const leftCps = sskWordsToCps(leftText);
      if (!leftCps || !leftCps.length) return false;
      outCps.push(0xF199A, ...leftCps, 0xF199B);
    }

    outCps.push(headCp);

    if (rightText != null && String(rightText).trim()) {
      const rightCps = sskWordsToCps(rightText);
      if (!rightCps || !rightCps.length) return false;
      outCps.push(0xF1997, ...rightCps, 0xF1998);
    }

    if (outCps.length <= 1) return false;
    if (elements.length > 0) __bridgePushGapIfNeeded(elements, __bridgeWordGapForPx(fontPx));
    __bridgeMakeRunElementFromCodepoints(elements, outCps, { fontPx, fontFamily: FONT_FAMILY_TEXT, sourceText: String(matchText ?? ''), sourceStart: sourceBaseStart, sourceEnd: sourceBaseStart + String(matchText ?? '').length, sourceKind, sourceSegmentIndex });
    return true;
  }

  function emitSskCompound(matchText, leftWord, operator, rightWord, elements, fontPx, sourceBaseStart = 0, sourceKind = 'text', sourceSegmentIndex = null) {
    const leftCp = sskWordToCp(leftWord);
    const rightCp = sskWordToCp(rightWord);
    if (leftCp == null || rightCp == null) return false;
    let joinCp = 0x200D; // generic compound
    if (operator === '-') joinCp = 0xF1995; // stacked
    else if (operator === '+') joinCp = 0xF1996; // scaled
    if (elements.length > 0) __bridgePushGapIfNeeded(elements, __bridgeWordGapForPx(fontPx));
    __bridgeMakeRunElementFromCodepoints(elements, [leftCp, joinCp, rightCp], { fontPx, fontFamily: FONT_FAMILY_TEXT, sourceText: String(matchText ?? ''), sourceStart: sourceBaseStart, sourceEnd: sourceBaseStart + String(matchText ?? '').length, sourceKind, sourceSegmentIndex });
    return true;
  }

  function parseSskTextSegmentToElements(segmentText, elements, { fontPx, parser = {}, mixedStyle = 'long', sourceBaseStart = 0, sourceKind = 'text', sourceSegmentIndex = null, allowRawCodepoints = true }) {
    const s = String(segmentText ?? '');
    if (!s.trim()) return;

    if (allowRawCodepoints) {
      const rawHits = findRawUnicodeCodepointSequences(s);
      if (rawHits.length) {
        let pos = 0;
        for (const hit of rawHits) {
          if (hit.index > pos) {
            parseSskTextSegmentToElements(s.slice(pos, hit.index), elements, {
              fontPx, parser, mixedStyle,
              sourceBaseStart: sourceBaseStart + pos,
              sourceKind, sourceSegmentIndex,
              allowRawCodepoints: false
            });
          }
          if (elements.length > 0) __bridgePushGapIfNeeded(elements, __bridgeWordGapForPx(fontPx));
          __bridgeMakeRunElementFromCodepoints(elements, hit.cps, {
            fontPx,
            fontFamily: FONT_FAMILY_TEXT,
            sourceText: s.slice(hit.index, hit.end),
            sourceStart: sourceBaseStart + hit.index,
            sourceEnd: sourceBaseStart + hit.end,
            sourceKind,
            sourceSegmentIndex,
            bypassRenderAdapter: true
          });
          pos = hit.end;
        }
        if (pos < s.length) {
          parseSskTextSegmentToElements(s.slice(pos), elements, {
            fontPx, parser, mixedStyle,
            sourceBaseStart: sourceBaseStart + pos,
            sourceKind, sourceSegmentIndex,
            allowRawCodepoints: false
          });
        }
        return;
      }
    }
    // Modern SP ASCII syntax is whitespace-sensitive here:
    //   head(inner words)  extended/long glyph
    //   left+right         nested compound
    //   left-right         stacked compound (ASCII U+002D only)
    //   left&right         generic/font-defined compound
    // Any whitespace before '(' or around a compound operator prevents the
    // construction from being recognized.
    const tokenRe = /(?:\{([^{}]+)\}\s*)?([A-Za-z][A-Za-z0-9_]*)\(([^()]+)\)|([A-Za-z][A-Za-z0-9_]*)([&+-])([A-Za-z][A-Za-z0-9_]*)|\{([^{}]+)\}\s*([A-Za-z][A-Za-z0-9_]*)/g;
    let pos = 0;
    let m;
    while ((m = tokenRe.exec(s)) !== null) {
      const start = m.index;
      const end = tokenRe.lastIndex;
      if (start > pos) __bridgeParseTextSegmentToElements(s.slice(pos, start), elements, { fontPx, sourceBaseStart: sourceBaseStart + pos, sourceKind, sourceSegmentIndex, mixedStyle });
      let ok = false;
      if (m[2] && (m[1] != null || m[3] != null)) {
        ok = emitSskExtendedGlyph(m[0], m[1], m[2], m[3], elements, fontPx, sourceBaseStart + start, sourceKind, sourceSegmentIndex);
      } else if (m[4] && m[5] && m[6]) {
        ok = emitSskCompound(m[0], m[4], m[5], m[6], elements, fontPx, sourceBaseStart + start, sourceKind, sourceSegmentIndex);
      } else if (m[7] && m[8]) {
        ok = emitSskExtendedGlyph(m[0], m[7], m[8], null, elements, fontPx, sourceBaseStart + start, sourceKind, sourceSegmentIndex);
      }
      if (!ok) __bridgeParseTextSegmentToElements(m[0], elements, { fontPx, sourceBaseStart: sourceBaseStart + start, sourceKind, sourceSegmentIndex, mixedStyle });
      pos = end;
    }
    if (pos < s.length) __bridgeParseTextSegmentToElements(s.slice(pos), elements, { fontPx, sourceBaseStart: sourceBaseStart + pos, sourceKind, sourceSegmentIndex, mixedStyle });
  }

 function parseSskBracketSegmentToElements(bracketContent, elements, { fontPx, parser = {}, mixedStyle = 'long', sourceBaseStart = 0, sourceKind = 'bracket', sourceSegmentIndex = null }) {
    const content = String(bracketContent ?? '').trim();
    if (!content) return;

    const startLen = elements.length;

    // First let the normal bracket parser try everything it already knows:
    // numeric TP phrases, decimals, date/time, identifiers, ordinary bracket cartouches.
    __bridgeParseBracketSegmentToElements(content, elements, {
      fontPx,
      sourceBaseStart,
      sourceKind,
      sourceSegmentIndex,
      mixedStyle
    });

    // If it produced anything, keep it.
    // This preserves the existing successful numeric bracket path.
    if (elements.length > startLen) {
      return;
    }

    // Otherwise fall back to original SSK generic bracket behavior.
    const wordsRaw = content.split(/\s+/).filter(Boolean);
    const cps = [];
    let ok = wordsRaw.length > 0;

    for (const w of wordsRaw) {
      const cp = sskWordToCp(w);
      if (cp == null) {
        ok = false;
        break;
      }
      cps.push(cp);
    }

    if (ok) {
      if (elements.length > 0) __bridgePushGapIfNeeded(elements, __bridgeWordGapForPx(fontPx));
      __bridgeMakeRunElementFromCodepoints(elements, [0xF1990, ...cps, 0xF1991], {
        fontPx,
        fontFamily: FONT_FAMILY_CARTOUCHE,
        fontRole: 'cartouche',
        elementKind: 'cartouche-run',
        sourceText: content,
        sourceStart: sourceBaseStart,
        sourceEnd: sourceBaseStart + content.length,
        sourceKind,
        sourceSegmentIndex
      });
      return;
    }

    // Final fallback
    __bridgeParseBracketSegmentToElements(content, elements, {
      fontPx,
      sourceBaseStart,
      sourceKind,
      sourceSegmentIndex,
      mixedStyle
    });
  }


  function emitSitelenPonaAsciiExtendedLegacyLongPi(matchText, innerWords, elements, fontPx, sourceBaseStart = 0, sourceKind = 'text', sourceSegmentIndex = null) {
    return emitSskExtendedGlyph(
      matchText,
      null,
      'pi',
      innerWords,
      elements,
      fontPx,
      sourceBaseStart,
      sourceKind,
      sourceSegmentIndex
    );
  }

  function getSitelenPonaAsciiExtendedLegacyLongPiInnerWords(aliasText) {
    const source = String(aliasText ?? '');
    const lower = source.toLowerCase();

    // linja sike uses a single pi+ marker followed by one to three words,
    // each introduced by a double underscore.
    if (lower.startsWith('pi+__')) {
      const words = source.slice(5).split('__');
      if (words.length < 1 || words.length > 3) return null;
      if (words.some(word => sskWordToCp(word) == null)) return null;
      return words.join(' ');
    }

    // linja pona uses the number of repeated + markers as the long-pi length.
    // The previously supported -- and --- aliases remain available unchanged.
    const markerMatch = /^pi(\+{1,3}|-{2,3})(.*)$/i.exec(source);
    if (!markerMatch) return null;

    const marker = markerMatch[1];
    const expectedWordCount = marker.length;
    const words = String(markerMatch[2] ?? '').trim().split(/[ \t]+/).filter(Boolean);
    if (words.length !== expectedWordCount) return null;
    if (words.some(word => sskWordToCp(word) == null)) return null;
    return words.join(' ');
  }

  function parseSitelenPonaAsciiExtendedTextSegmentToElements(segmentText, elements, {
    fontPx,
    parser = {},
    mixedStyle = 'long',
    sourceBaseStart = 0,
    sourceKind = 'text',
    sourceSegmentIndex = null
  } = {}) {
    const s = String(segmentText ?? '');
    if (!s.trim()) return;

    // Start with the complete existing sitelen-seli-kiwen parser vocabulary.
    // Only this extended branch recognizes the historical linja pona and
    // linja sike long-pi aliases below; every other parser branch is unchanged.
    //
    // linja pona:
    //   pi+telo                 -> pi(telo)
    //   pi++telo lete           -> pi(telo lete)
    //   pi+++telo lete pona     -> pi(telo lete pona)
    //
    // linja sike:
    //   pi+__telo               -> pi(telo)
    //   pi+__telo__lete         -> pi(telo lete)
    //   pi+__telo__lete__pona   -> pi(telo lete pona)
    //
    // The already-supported pi-- and pi--- aliases are retained.
    const glyphToken = String.raw`[A-Za-z][A-Za-z0-9_^<>]*`;
    const linjaSikeGlyphToken = String.raw`[A-Za-z][A-Za-z0-9^<>]*`;
    const legacyLongPiRe = new RegExp(
      String.raw`(^|[^A-Za-z0-9_^<>])(` +
        String.raw`pi\+__${linjaSikeGlyphToken}(?:__${linjaSikeGlyphToken}){0,2}` +
        String.raw`|pi(?:\+\+\+|---)(?![+-])[ \t]*${glyphToken}[ \t]+${glyphToken}[ \t]+${glyphToken}` +
        String.raw`|pi(?:\+\+|--)(?![+-])[ \t]*${glyphToken}[ \t]+${glyphToken}` +
        String.raw`|pi\+(?![+_-])${glyphToken}` +
      String.raw`)(?=$|[^A-Za-z0-9_^<>+&-])`,
      'gi'
    );

    let pos = 0;
    let m;
    while ((m = legacyLongPiRe.exec(s)) !== null) {
      const lead = String(m[1] ?? '');
      const aliasText = String(m[2] ?? '');
      const aliasStart = (m.index | 0) + lead.length;
      const aliasEnd = (m.index | 0) + String(m[0] ?? '').length;

      if (aliasStart > pos) {
        parseSskTextSegmentToElements(s.slice(pos, aliasStart), elements, {
          fontPx,
          parser,
          mixedStyle,
          sourceBaseStart: sourceBaseStart + pos,
          sourceKind,
          sourceSegmentIndex
        });
      }

      const innerWords = getSitelenPonaAsciiExtendedLegacyLongPiInnerWords(aliasText);
      const handled = innerWords != null && emitSitelenPonaAsciiExtendedLegacyLongPi(
        aliasText,
        innerWords,
        elements,
        fontPx,
        sourceBaseStart + aliasStart,
        sourceKind,
        sourceSegmentIndex
      );

      if (!handled) {
        parseSskTextSegmentToElements(aliasText, elements, {
          fontPx,
          parser,
          mixedStyle,
          sourceBaseStart: sourceBaseStart + aliasStart,
          sourceKind,
          sourceSegmentIndex
        });
      }

      pos = aliasEnd;
    }

    if (pos < s.length) {
      parseSskTextSegmentToElements(s.slice(pos), elements, {
        fontPx,
        parser,
        mixedStyle,
        sourceBaseStart: sourceBaseStart + pos,
        sourceKind,
        sourceSegmentIndex
      });
    }
  }

  function normalizeSitelenPonaAsciiExtendedLegacyCartoucheContent(bracketContent) {
    const s = String(bracketContent ?? '');
    let i = 0;
    const tokens = [];

    const skipHorizontalSpace = () => {
      while (i < s.length && /[ \t]/.test(s[i])) i += 1;
    };

    skipHorizontalSpace();
    if (s[i] !== '_') return null;

    while (i < s.length) {
      if (s[i] !== '_') return null;
      i += 1;
      skipHorizontalSpace();

      const start = i;
      while (i < s.length && s[i] !== '_' && !/[ \t]/.test(s[i])) i += 1;
      const rawToken = s.slice(start, i);
      if (!rawToken) return null;

      if (sskWordToCp(rawToken) == null) return null;
      tokens.push(rawToken);

      skipHorizontalSpace();
      if (i >= s.length) break;
      if (s[i] !== '_') return null;
    }

    return tokens.length ? tokens.join(' ') : null;
  }

  function parseSitelenPonaAsciiExtendedBracketSegmentToElements(bracketContent, elements, {
    fontPx,
    parser = {},
    mixedStyle = 'long',
    sourceBaseStart = 0,
    sourceKind = 'bracket',
    sourceSegmentIndex = null
  } = {}) {
    const source = String(bracketContent ?? '');
    const normalizedLegacyContent = normalizeSitelenPonaAsciiExtendedLegacyCartoucheContent(source);

    if (normalizedLegacyContent != null) {
      const startLen = elements.length;
      parseSskBracketSegmentToElements(normalizedLegacyContent, elements, {
        fontPx,
        parser,
        mixedStyle,
        sourceBaseStart,
        sourceKind,
        sourceSegmentIndex
      });

      if (elements.length > startLen) {
        for (let i = startLen; i < elements.length; i++) {
          const el = elements[i];
          if (!el || el.type === 'gap') continue;
          el.sourceText = source;
          el.sourceStart = sourceBaseStart;
          el.sourceEnd = sourceBaseStart + source.length;
          el.sourceKind = sourceKind;
          el.sourceSegmentIndex = sourceSegmentIndex;
        }
        return;
      }
    }

    parseSskBracketSegmentToElements(source, elements, {
      fontPx,
      parser,
      mixedStyle,
      sourceBaseStart,
      sourceKind,
      sourceSegmentIndex
    });
  }


  function emitStandardSitelenPonaAsciiCoreLongPi(matchText, innerText, elements, fontPx, sourceBaseStart = 0, sourceKind = 'text', sourceSegmentIndex = null) {
    const piCp = sskWordToCp('pi');
    const innerCps = sskWordsToCps(innerText);
    if (piCp == null || !innerCps || innerCps.length === 0) return false;

    if (elements.length > 0) __bridgePushGapIfNeeded(elements, __bridgeWordGapForPx(fontPx));
    __bridgeMakeRunElementFromCodepoints(elements, [piCp, 0xF1997, ...innerCps, 0xF1998], {
      fontPx,
      fontFamily: FONT_FAMILY_TEXT,
      sourceText: String(matchText ?? ''),
      sourceStart: sourceBaseStart,
      sourceEnd: sourceBaseStart + String(matchText ?? '').length,
      sourceKind,
      sourceSegmentIndex
    });
    return true;
  }

  function emitStandardSitelenPonaAsciiCoreCompound(matchText, elements, fontPx, sourceBaseStart = 0, sourceKind = 'text', sourceSegmentIndex = null) {
    const expression = String(matchText ?? '');
    const pieces = expression.split(/([&+-])/);
    if (pieces.length < 3 || (pieces.length % 2) === 0) return false;

    const cps = [];
    for (let i = 0; i < pieces.length; i++) {
      if ((i % 2) === 0) {
        const cp = sskWordToCp(pieces[i]);
        if (cp == null) return false;
        cps.push(cp);
        continue;
      }

      const operator = pieces[i];
      if (operator === '-') cps.push(0xF1995);
      else if (operator === '+') cps.push(0xF1996);
      else if (operator === '&') cps.push(0x200D);
      else return false;
    }

    if (elements.length > 0) __bridgePushGapIfNeeded(elements, __bridgeWordGapForPx(fontPx));
    __bridgeMakeRunElementFromCodepoints(elements, cps, {
      fontPx,
      fontFamily: FONT_FAMILY_TEXT,
      sourceText: expression,
      sourceStart: sourceBaseStart,
      sourceEnd: sourceBaseStart + expression.length,
      sourceKind,
      sourceSegmentIndex
    });
    return true;
  }

  function emitStandardSitelenPonaAsciiCoreFullWidthSpace(elements, fontPx, sourceBaseStart = 0, sourceKind = 'text', sourceSegmentIndex = null) {
    __bridgeMakeRunElementFromCodepoints(elements, [0x3000], {
      fontPx,
      fontFamily: FONT_FAMILY_LITERAL,
      sourceText: '|',
      sourceStart: sourceBaseStart,
      sourceEnd: sourceBaseStart + 1,
      sourceKind,
      sourceSegmentIndex
    });
  }

  function parseStandardSitelenPonaAsciiCoreUnsupportedLegacyLongPi(matchText, elements, {
    fontPx,
    mixedStyle = 'long',
    sourceBaseStart = 0,
    sourceKind = 'text',
    sourceSegmentIndex = null
  } = {}) {
    const source = String(matchText ?? '');
    const piMatch = /^pi\s+/i.exec(source);
    if (!piMatch) {
      __bridgeParseTextSegmentToElements(source, elements, { fontPx, sourceBaseStart, sourceKind, sourceSegmentIndex, mixedStyle });
      return;
    }

    // Parse the two portions separately so the legacy base-parser syntax
    // "pi { ... }" cannot activate deprecated long-pi code points in this mode.
    __bridgeParseTextSegmentToElements(source.slice(0, 2), elements, {
      fontPx,
      sourceBaseStart,
      sourceKind,
      sourceSegmentIndex,
      mixedStyle
    });
    __bridgeParseTextSegmentToElements(source.slice(2), elements, {
      fontPx,
      sourceBaseStart: sourceBaseStart + 2,
      sourceKind,
      sourceSegmentIndex,
      mixedStyle
    });
  }

  function parseStandardSitelenPonaAsciiCoreTextSegmentToElements(segmentText, elements, {
    fontPx,
    parser = {},
    mixedStyle = 'long',
    sourceBaseStart = 0,
    sourceKind = 'text',
    sourceSegmentIndex = null,
    allowRawCodepoints = true
  } = {}) {
    const s = String(segmentText ?? '');
    if (!s.trim()) return;

    // Raw U+ escapes are an intentional project extension retained by request.
    if (allowRawCodepoints) {
      const rawHits = findRawUnicodeCodepointSequences(s);
      if (rawHits.length) {
        let pos = 0;
        for (const hit of rawHits) {
          if (hit.index > pos) {
            parseStandardSitelenPonaAsciiCoreTextSegmentToElements(s.slice(pos, hit.index), elements, {
              fontPx,
              parser,
              mixedStyle,
              sourceBaseStart: sourceBaseStart + pos,
              sourceKind,
              sourceSegmentIndex,
              allowRawCodepoints: false
            });
          }
          if (elements.length > 0) __bridgePushGapIfNeeded(elements, __bridgeWordGapForPx(fontPx));
          __bridgeMakeRunElementFromCodepoints(elements, hit.cps, {
            fontPx,
            fontFamily: FONT_FAMILY_TEXT,
            sourceText: s.slice(hit.index, hit.end),
            sourceStart: sourceBaseStart + hit.index,
            sourceEnd: sourceBaseStart + hit.end,
            sourceKind,
            sourceSegmentIndex,
            bypassRenderAdapter: true
          });
          pos = hit.end;
        }
        if (pos < s.length) {
          parseStandardSitelenPonaAsciiCoreTextSegmentToElements(s.slice(pos), elements, {
            fontPx,
            parser,
            mixedStyle,
            sourceBaseStart: sourceBaseStart + pos,
            sourceKind,
            sourceSegmentIndex,
            allowRawCodepoints: false
          });
        }
        return;
      }
    }

    // Standard ASCII Input v1.0 core supported here:
    //   pi(words)           long pi
    //   word-word           stacking joiner
    //   word+word           scaling/nesting joiner
    //   word&word           generic ZWJ compound
    //   |                   ideographic/full-width space
    // Reverse long glyphs, generic head(words), and manual extension aliases are
    // deliberately excluded. Compound chains are accepted, as required by
    // standard examples such as luka&luka&luka&luka.
    const glyphToken = String.raw`[A-Za-z][A-Za-z0-9_^<>]*`;
    const tokenRe = new RegExp(
      String.raw`pi\(([^()]+)\)|(${glyphToken}(?:[&+-]${glyphToken})+)|(\|)|(pi\s+\{[^{}]*\})`,
      'gi'
    );

    let pos = 0;
    let m;
    while ((m = tokenRe.exec(s)) !== null) {
      const start = m.index;
      const end = tokenRe.lastIndex;
      if (start > pos) {
        __bridgeParseTextSegmentToElements(s.slice(pos, start), elements, {
          fontPx,
          sourceBaseStart: sourceBaseStart + pos,
          sourceKind,
          sourceSegmentIndex,
          mixedStyle
        });
      }

      let handled = false;
      if (m[1] != null) {
        handled = emitStandardSitelenPonaAsciiCoreLongPi(
          m[0], m[1], elements, fontPx,
          sourceBaseStart + start, sourceKind, sourceSegmentIndex
        );
      } else if (m[2] != null) {
        handled = emitStandardSitelenPonaAsciiCoreCompound(
          m[0], elements, fontPx,
          sourceBaseStart + start, sourceKind, sourceSegmentIndex
        );
      } else if (m[3] != null) {
        emitStandardSitelenPonaAsciiCoreFullWidthSpace(
          elements, fontPx,
          sourceBaseStart + start, sourceKind, sourceSegmentIndex
        );
        handled = true;
      } else if (m[4] != null) {
        parseStandardSitelenPonaAsciiCoreUnsupportedLegacyLongPi(m[0], elements, {
          fontPx,
          mixedStyle,
          sourceBaseStart: sourceBaseStart + start,
          sourceKind,
          sourceSegmentIndex
        });
        handled = true;
      }

      if (!handled) {
        __bridgeParseTextSegmentToElements(m[0], elements, {
          fontPx,
          sourceBaseStart: sourceBaseStart + start,
          sourceKind,
          sourceSegmentIndex,
          mixedStyle
        });
      }
      pos = end;
    }

    if (pos < s.length) {
      __bridgeParseTextSegmentToElements(s.slice(pos), elements, {
        fontPx,
        sourceBaseStart: sourceBaseStart + pos,
        sourceKind,
        sourceSegmentIndex,
        mixedStyle
      });
    }
  }

  function parseStandardSitelenPonaAsciiCoreBracketSegmentToElements(bracketContent, elements, {
    fontPx,
    parser = {},
    mixedStyle = 'long',
    sourceBaseStart = 0,
    sourceKind = 'bracket',
    sourceSegmentIndex = null
  } = {}) {
    // Standard [ ... ] cartouches use the established bracket renderer. This
    // also intentionally preserves nanpa-linja-n numeric cartouches, which are
    // a project feature orthogonal to the ordinary Sitelen Pona ASCII syntax.
    __bridgeParseBracketSegmentToElements(String(bracketContent ?? ''), elements, {
      fontPx,
      sourceBaseStart,
      sourceKind,
      sourceSegmentIndex,
      mixedStyle
    });
  }

  function alignFactorFromMode(mode) {
    const m = String(mode || '').toLowerCase();
    if (m === 'center') return 0.5;
    if (m === 'right') return 1;
    return 0;
  }

  function cloneManualTallyLayout(layout) {
    if (!layout || typeof layout !== 'object') return null;
    return {
      ...layout,
      halo: layout.halo && typeof layout.halo === 'object' ? { ...layout.halo } : null,
      groups: Array.isArray(layout.groups) ? layout.groups.map(group => ({
        ...group,
        bounds: group?.bounds && typeof group.bounds === 'object' ? { ...group.bounds } : null,
        strokes: Array.isArray(group?.strokes) ? group.strokes.map(stroke => ({ ...stroke })) : []
      })) : []
    };
  }

  function clonePlanElement(el) {
    if (!el || typeof el !== 'object') return el;
    const base = { ...el };
    if (el.type === 'cartouche' && el.canvas) {
      base.canvas = el.canvas;
    }
    if (Array.isArray(el.cps)) base.cps = el.cps.slice();
    if (Array.isArray(el.canonicalCps)) base.canonicalCps = el.canonicalCps.slice();
    if (Array.isArray(el.renderCps)) base.renderCps = el.renderCps.slice();
    if (Array.isArray(el.canonicalFullCps)) base.canonicalFullCps = el.canonicalFullCps.slice();
    if (Array.isArray(el.renderFullCps)) base.renderFullCps = el.renderFullCps.slice();
    if (Array.isArray(el.canonicalToRenderSpans)) base.canonicalToRenderSpans = el.canonicalToRenderSpans.map(item => ({ ...item }));
    if (Array.isArray(el.syntheticCornerBrackets)) base.syntheticCornerBrackets = el.syntheticCornerBrackets.map(item => ({ ...item }));
    if (Array.isArray(el.audioSourceCps)) base.audioSourceCps = el.audioSourceCps.slice();
    if (Array.isArray(el.audioSourceIndices)) base.audioSourceIndices = el.audioSourceIndices.slice();
    if (Array.isArray(el.audioGlyphLayout)) {
      base.audioGlyphLayout = el.audioGlyphLayout.map(item => ({ ...item }));
    }
    if (el.manualTallyLayout) base.manualTallyLayout = cloneManualTallyLayout(el.manualTallyLayout);
    return base;
  }

  function classifyRenderMode(el) {
    if (!el) return 'text';
    if (getSyntheticCornerBracketCodepoint(el) != null) return 'synthetic-corner-bracket';
    if (el.type === 'cartouche') return 'raster';
    if (el.type === 'text') return 'raster';
    return 'text';
  }

  function inferFontRole(el) {
    if (!el) return 'word';
    if (typeof el.fontRole === 'string' && el.fontRole) return el.fontRole;
    const fam = String(el.fontFamily || '');
    if (
      el.isUnrecognized &&
      (el.interpretedQuote || String(el.sourceKind || '').toLowerCase() === 'interpretedquote')
    ) return 'unknown';
    if (el.type === 'text') return 'literal';
    if (el.type === 'cartouche') {
      if (el.isLiteralCartouche) return 'literalCartouche';
      if (fam && fam === FONT_FAMILY_NUMBER) return 'number';
      return 'cartouche';
    }
    if (fam && fam === FONT_FAMILY_NUMBER) return 'number';
    return 'word';
  }

  function unquoteLiteralCartoucheSourceText(value) {
    const s = String(value ?? "").trim();

    if (s.length >= 2 && s.startsWith('"') && s.endsWith('"')) {
      return s.slice(1, -1);
    }

    return s;
  }

  function getRunLiteralCartoucheSourceText(run) {
    const direct =
      run?.sourceText ??
      run?._element?.sourceText ??
      "";

    const unquoted = unquoteLiteralCartoucheSourceText(direct);
    if (unquoted) return unquoted;

    const cps = Array.isArray(run?.cps)
      ? run.cps
      : Array.isArray(run?._element?.cps)
        ? run._element.cps
        : [];

    let out = "";
    for (const cp of cps) {
      const n = Number(cp);
      if (n >= 0x20 && n <= 0x7E) {
        out += String.fromCodePoint(n);
      }
    }

    return out;
  }

  function getConditionalLiteralCartoucheClipRules(config) {
    const direct = config?.fonts?.settings?.conditionalLiteralCartoucheClips;
    if (Array.isArray(direct)) return direct;

    // Optional fallback names, useful if older pages pass settings under a
    // different nested object later.
    const alt1 = config?.fonts?.fontPairSettings?.conditionalLiteralCartoucheClips;
    if (Array.isArray(alt1)) return alt1;

    const alt2 = config?.fontPairSettings?.conditionalLiteralCartoucheClips;
    if (Array.isArray(alt2)) return alt2;

    return [];
  }

  function runMatchesConditionalLiteralCartoucheClip(run, rule) {
    if (!run || !rule || rule.enabled === false) return false;

    const runFontRole = String(run.fontRole ?? run?._element?.fontRole ?? "");
    const runFontFamily = String(run.fontFamily ?? run?._element?.fontFamily ?? "");

    const isLiteralCartouche =
      runFontRole === "literalCartouche" ||
      run?._element?.isLiteralCartouche === true;

    if (!isLiteralCartouche) return false;

    if (rule.fontRole && runFontRole !== String(rule.fontRole)) return false;
    if (rule.fontFamily && runFontFamily !== String(rule.fontFamily)) return false;

    const literalText = getRunLiteralCartoucheSourceText(run);

    if (rule.sourceTextStartsWithRegex) {
      let re;
      try {
        re = new RegExp(String(rule.sourceTextStartsWithRegex));
      } catch {
        return false;
      }

      if (!re.test(literalText)) return false;
    }

    return true;
  }

  function applyConditionalLiteralCartoucheClipsToPlan(plan, config) {
    const rules = getConditionalLiteralCartoucheClipRules(config);
    if (!rules.length || !plan) return plan;

    for (const line of plan.lines || []) {
      for (const run of line.runs || []) {
        for (const rule of rules) {
          if (!runMatchesConditionalLiteralCartoucheClip(run, rule)) continue;

          const patch = rule.patch || {};
          Object.assign(run, patch);

          if (run._element && typeof run._element === "object") {
            Object.assign(run._element, patch);
          }

          break;
        }
      }
    }

    return plan;
  }

  function buildMeasuredRenderPlan(linesElements, config = {}) {
    const fontPx = Math.max(8, Number(config?.layout?.fontPx ?? (__bridgeGetFontPx ? __bridgeGetFontPx() : 56) ?? 56));
    const fontSettings = (config?.fonts?.settings && typeof config.fonts.settings === 'object')
      ? config.fonts.settings
      : {};
    const rawLongPiHeadWidthScale = config?.fonts?.longPiHeadWidthScale ?? fontSettings.longPiHeadWidthScale;
    const parsedLongPiHeadWidthScale = Number(rawLongPiHeadWidthScale);
    const configuredLongPiHeadWidthScale = Number.isFinite(parsedLongPiHeadWidthScale) && parsedLongPiHeadWidthScale > 0
      ? parsedLongPiHeadWidthScale
      : null;
    const pad = Number.isFinite(Number(config?.layout?.paddingPx)) ? Math.max(0, Number(config.layout.paddingPx)) : 18;
    const lineGap = resolveLineGapPxForLayout(config?.layout || {}, fontPx);
    const haloOn = !!config?.paint?.halo?.enabled;
    const haloWidthPx = Math.max(0, Math.round(Number(config?.paint?.halo?.widthPx ?? 0) || 0));
    const haloExtra = haloOn ? (haloWidthPx > 0 ? haloWidthPx : Math.max(1, Math.round(fontPx * 0.08))) : 0;
    const tmp = document.createElement('canvas');
    const ctx = tmp.getContext('2d');
    ctx.textBaseline = 'alphabetic';

    function measureTextLikeORIG(chars, px, fontFamily) {
      ctx.font = `${px}px "${fontFamily}"`;
      const m = ctx.measureText(chars);
      const ascent = m.actualBoundingBoxAscent ?? Math.ceil(px * 0.8);
      const descent = m.actualBoundingBoxDescent ?? Math.ceil(px * 0.2);
      const left = m.actualBoundingBoxLeft ?? 0;
      const right = m.actualBoundingBoxRight ?? Math.ceil(m.width);
      const tightW = Math.ceil(left + right);
      return { chars, ascent, descent, left, w: tightW, h: Math.ceil(ascent + descent), px, fontFamily };
    }

    function measureTextLike(chars, px, fontFamily, useAdvanceWidth = false) {
      ctx.font = `${px}px "${fontFamily}"`;
      const m = ctx.measureText(chars);

      const ascent = m.actualBoundingBoxAscent ?? Math.ceil(px * 0.8);
      const descent = m.actualBoundingBoxDescent ?? Math.ceil(px * 0.2);

      const s = String(chars ?? "");

      // Literal/unknown text is drawn by renderAllLinesToCanvas() using its
      // complete advance width and no bounding-box-left offset.  Use the same
      // geometry in the public render plan so later glyphs/cartouches and the
      // complete line width remain identical after a visible literal run.
      // U+3000 also has advance width but may have no ink bounds.
      const isIdeographicSpaceOnly = /^[\u3000]+$/u.test(s);

      if (useAdvanceWidth || isIdeographicSpaceOnly) {
        return {
          chars,
          ascent,
          descent,
          left: 0,
          w: Math.ceil(m.width),
          h: Math.ceil(ascent + descent),
          px,
          fontFamily
        };
      }

      // Preserve old sitelen pona glyph/run spacing behavior.
      const left = m.actualBoundingBoxLeft ?? 0;
      const right = m.actualBoundingBoxRight ?? Math.ceil(m.width);
      const tightW = Math.ceil(left + right);

      return {
        chars,
        ascent,
        descent,
        left,
        w: tightW,
        h: Math.ceil(ascent + descent),
        px,
        fontFamily
      };
    }

    function sameAudioGeometryCodepoints(a, b) {
      if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
      for (let index = 0; index < a.length; index++) {
        if (Number(a[index]) !== Number(b[index])) return false;
      }
      return true;
    }

    const AUDIO_GEOMETRY_VISUAL_CONTROL_CPS = new Set([
      0x200D,
      0xF1990,
      0xF1991,
      0xF1992,
      0xF1993,
      0xF1994,
      0xF1995,
      0xF1996,
      0xF1997,
      0xF1998,
      0xF199A,
      0xF199B
    ]);

    function audioGeometryVisibleComponentGroups(cps) {
      const source = Array.from(cps || [], cp => Number(cp));
      const visibleIndices = [];
      for (let index = 0; index < source.length; index++) {
        if (!AUDIO_GEOMETRY_VISUAL_CONTROL_CPS.has(source[index])) visibleIndices.push(index);
      }
      if (!visibleIndices.length) return [];

      const groups = [];
      let previousVisible = -1;
      for (const visibleIndex of visibleIndices) {
        const start = previousVisible + 1;
        groups.push(Array.from(
          { length: visibleIndex - start + 1 },
          (_unused, offset) => start + offset
        ));
        previousVisible = visibleIndex;
      }
      if (previousVisible < source.length - 1) {
        groups[groups.length - 1].push(...Array.from(
          { length: source.length - previousVisible - 1 },
          (_unused, offset) => previousVisible + 1 + offset
        ));
      }
      return groups;
    }

    function currentExtendedGlyphStructure(canonicalCps) {
      const cps = Array.from(canonicalCps || [], cp => Number(cp));
      const reverseStartIndex = cps.indexOf(0xF199A);
      const reverseEndIndex = reverseStartIndex >= 0
        ? cps.indexOf(0xF199B, reverseStartIndex + 1)
        : -1;
      const forwardStartIndex = cps.indexOf(0xF1997);
      const forwardEndIndex = forwardStartIndex >= 0
        ? cps.indexOf(0xF1998, forwardStartIndex + 1)
        : -1;

      const hasReverse = reverseStartIndex >= 0 && reverseEndIndex > reverseStartIndex;
      const hasForward = forwardStartIndex > 0 && forwardEndIndex > forwardStartIndex;
      if (!hasReverse && !hasForward) return null;

      const reverseHeadIndex = hasReverse ? reverseEndIndex + 1 : -1;
      const forwardHeadIndex = hasForward ? forwardStartIndex - 1 : -1;
      if (hasReverse && (reverseHeadIndex < 0 || reverseHeadIndex >= cps.length)) return null;
      if (hasForward && (forwardHeadIndex < 0 || forwardHeadIndex >= cps.length)) return null;
      if (hasReverse && hasForward && reverseHeadIndex !== forwardHeadIndex) return null;

      const headIndex = hasForward ? forwardHeadIndex : reverseHeadIndex;
      if (headIndex < 0 || headIndex >= cps.length) return null;
      if (AUDIO_GEOMETRY_VISUAL_CONTROL_CPS.has(cps[headIndex])) return null;

      return {
        reverseStartIndex,
        reverseEndIndex,
        forwardStartIndex,
        forwardEndIndex,
        hasReverse,
        hasForward,
        headIndex,
        headCp: cps[headIndex]
      };
    }

    function buildSemanticExtendedGlyphAudioGlyphLayout(el, canonicalCps, spans, boxWidth, boxHeight) {
      if (normalizeLongGlyphPresentation(el?.longGlyphPresentation) === 'decomposed') return null;

      const structure = currentExtendedGlyphStructure(canonicalCps);
      if (!structure) return null;

      const groups = audioGeometryVisibleComponentGroups(canonicalCps);
      if (groups.length < 2) return null;
      const headGroupIndex = groups.findIndex(group => group.includes(structure.headIndex));
      if (headGroupIndex < 0) return null;

      const px = Math.max(1, Number(el?.px ?? fontPx) || fontPx);
      const family = el?.fontFamily || FONT_FAMILY_TEXT;
      ctx.font = `${px}px "${family}"`;

      const adaptedCharsForCanonical = (subsetCps) => {
        const adapted = adaptCanonicalCodepointsForFont(subsetCps, {
          renderAdapterId: el?.renderAdapterId || DEFAULT_FONT_RENDER_ADAPTER_ID,
          fontRole: el?.fontRole || 'word',
          elementKind: el?.type || 'run',
          fontFamily: family,
          sourceText: el?.sourceText,
          sourceKind: el?.sourceKind,
          sourceSegmentIndex: el?.sourceSegmentIndex
        });
        return adapted.renderCps.map(cp => String.fromCodePoint(cp)).join('');
      };

      const measuredCanonicalWidth = (subsetCps) => {
        const chars = adaptedCharsForCanonical(subsetCps);
        if (!chars) return NaN;
        const measured = ctx.measureText(chars);
        const left = Number(measured.actualBoundingBoxLeft);
        const right = Number(measured.actualBoundingBoxRight);
        const tightWidth = Number.isFinite(left) && Number.isFinite(right)
          ? left + right
          : NaN;
        const advanceWidth = Number(measured.width);
        const width = Number.isFinite(tightWidth) && tightWidth > 0
          ? tightWidth
          : advanceWidth;
        return Number.isFinite(width) && width > 0 ? width : NaN;
      };

      const payloadForGroup = (group) => Array.from(group || [])
        .map(index => Number(canonicalCps[index]))
        .filter(cp => Number.isFinite(cp) && !AUDIO_GEOMETRY_VISUAL_CONTROL_CPS.has(cp));

      const groupPayloads = groups.map(payloadForGroup);
      const headPayload = groupPayloads[headGroupIndex];
      if (!headPayload.length) return null;

      const headStandaloneWidth = measuredCanonicalWidth(headPayload);
      const standaloneWeights = groupPayloads.map(payload => {
        const measured = measuredCanonicalWidth(payload);
        return Math.max(1, Number.isFinite(measured) ? measured : 1);
      });

      // Measure every contained glyph in a complete one-member long form. This
      // captures each font's long-glyph cell sizing without using truncated
      // prefixes, whose metrics can include the standalone head width or can
      // reshape unpredictably before the closing control is present.
      const semanticWeights = standaloneWeights.map((standaloneWeight, groupIndex) => {
        if (groupIndex === headGroupIndex) return standaloneWeight;
        const payload = groupPayloads[groupIndex];
        if (!payload.length || !Number.isFinite(headStandaloneWidth)) return standaloneWeight;

        let completeSingleMember = null;
        if (groupIndex < headGroupIndex && structure.hasReverse) {
          completeSingleMember = [0xF199A, ...payload, 0xF199B, ...headPayload];
        } else if (groupIndex > headGroupIndex && structure.hasForward) {
          completeSingleMember = [...headPayload, 0xF1997, ...payload, 0xF1998];
        }
        if (!completeSingleMember) return standaloneWeight;

        const completeWidth = measuredCanonicalWidth(completeSingleMember);
        const contribution = Number(completeWidth) - Number(headStandaloneWidth);
        const ratio = contribution / Math.max(1, standaloneWeight);

        // Unsupported fonts expose the long controls as ordinary tofu cells;
        // that makes the apparent contribution roughly three times the member
        // width. Reject such metrics and retain the actual member-glyph width.
        if (!Number.isFinite(contribution) || contribution <= 0) return standaloneWeight;
        if (!Number.isFinite(ratio) || ratio < 0.35 || ratio > 2.50) return standaloneWeight;
        return Math.max(1, contribution);
      });

      const widths = new Array(groups.length).fill(0);
      const piIsThinLongHead = Number(structure.headCp) === 0xF194D && structure.hasForward;

      if (piIsThinLongHead) {
        // In a shaped long pi, the initial pi is normally only a narrow
        // horizontal head. It is spoken with the complete construction anyway,
        // so reserve a small absolute head region and distribute the remaining
        // width among the contained glyphs. Do not normalize standalone pi to a
        // full ordinary-glyph share, which pushes every member too far right.
        const measuredHead = Number.isFinite(headStandaloneWidth) ? headStandaloneWidth : px * 0.10;
        const thinHeadWidth = resolveLongPiHeadWidthPx(
          px,
          boxWidth,
          measuredHead,
          groups.length,
          configuredLongPiHeadWidthScale
        );
        widths[headGroupIndex] = thinHeadWidth;

        const remainingWidth = Math.max(1, boxWidth - thinHeadWidth);
        const otherWeightTotal = semanticWeights.reduce(
          (sum, weight, index) => index === headGroupIndex ? sum : sum + Math.max(1, weight),
          0
        ) || Math.max(1, groups.length - 1);
        for (let groupIndex = 0; groupIndex < groups.length; groupIndex++) {
          if (groupIndex === headGroupIndex) continue;
          widths[groupIndex] = remainingWidth * Math.max(1, semanticWeights[groupIndex]) / otherWeightTotal;
        }
      } else {
        const totalWeight = semanticWeights.reduce((sum, weight) => sum + Math.max(1, weight), 0) || groups.length;
        for (let groupIndex = 0; groupIndex < groups.length; groupIndex++) {
          widths[groupIndex] = boxWidth * Math.max(1, semanticWeights[groupIndex]) / totalWeight;
        }
      }

      const boundaries = [0];
      let accumulated = 0;
      for (let groupIndex = 0; groupIndex < groups.length; groupIndex++) {
        accumulated += widths[groupIndex];
        boundaries.push(groupIndex === groups.length - 1 ? boxWidth : accumulated);
      }

      const layout = new Array(canonicalCps.length);
      for (let groupIndex = 0; groupIndex < groups.length; groupIndex++) {
        const left = Math.max(0, Math.min(boxWidth, Number(boundaries[groupIndex]) || 0));
        const right = Math.max(left + 1, Math.min(boxWidth, Number(boundaries[groupIndex + 1]) || boxWidth));
        for (const canonicalIndex of groups[groupIndex]) {
          const span = spans?.[canonicalIndex] || {};
          layout[canonicalIndex] = {
            componentIndex: canonicalIndex,
            cp: Number(canonicalCps[canonicalIndex]),
            x: left,
            y: 0,
            width: Math.max(1, right - left),
            height: boxHeight,
            renderStart: Number.isInteger(Number(span.renderStart)) ? Number(span.renderStart) : null,
            renderEnd: Number.isInteger(Number(span.renderEnd)) ? Number(span.renderEnd) : null,
            semanticGroupIndex: groupIndex,
            semanticRole: groupIndex < headGroupIndex
              ? 'reverse-member'
              : (groupIndex === headGroupIndex ? 'head' : 'forward-member')
          };
        }
      }
      return layout.every(Boolean) ? layout : null;
    }

    function buildAdaptedRunAudioGlyphLayout(el, measurement) {
      if (!el || (el.type !== 'glyph' && el.type !== 'run')) return null;

      const canonicalCps = getElementCanonicalCps(el);
      const renderCps = getElementRenderCps(el);
      const spans = Array.isArray(el.canonicalToRenderSpans)
        ? el.canonicalToRenderSpans
        : null;
      const px = Math.max(1, Number(el.px ?? fontPx) || fontPx);
      const boxWidth = Math.max(1, Number(measurement?.w) || 1);
      const boxHeight = Math.max(1, Number(measurement?.h) || px);

      if (!canonicalCps.length || !renderCps.length) return null;

      // Current forward and reverse long-glyph shaping is contextual. Give
      // every semantic member an explicit font-measured region; silent long
      // controls share the region of the member they visually construct.
      const semanticExtendedGlyphLayout = buildSemanticExtendedGlyphAudioGlyphLayout(
        el,
        canonicalCps,
        spans,
        boxWidth,
        boxHeight
      );
      if (semanticExtendedGlyphLayout) return semanticExtendedGlyphLayout;

      // Identity/direct-UCSUR non-long runs retain their established geometry.
      // The explicit layout below is needed only when a font adapter changed
      // the sequence that was actually measured and drawn.
      if (
        sameAudioGeometryCodepoints(canonicalCps, renderCps) ||
        !spans ||
        spans.length !== canonicalCps.length
      ) return null;

      const family = el.fontFamily || FONT_FAMILY_TEXT;
      const renderChars = renderCps.map(cp => String.fromCodePoint(cp));
      ctx.font = `${px}px "${family}"`;

      const prefixAdvances = [0];
      let prefix = '';
      for (const ch of renderChars) {
        prefix += ch;
        const width = Number(ctx.measureText(prefix)?.width);
        prefixAdvances.push(Number.isFinite(width)
          ? Math.max(0, width)
          : prefixAdvances[prefixAdvances.length - 1]);
      }

      const drawOriginX = Math.max(0, Number(measurement?.left) || 0);
      const minimumWidth = Math.max(2, Math.min(boxWidth, px * 0.10));

      return canonicalCps.map((cp, canonicalIndex) => {
        const span = spans[canonicalIndex] || { renderStart: 0, renderEnd: renderCps.length };
        const start = Math.max(0, Math.min(renderCps.length, Number(span.renderStart) || 0));
        const end = Math.max(start, Math.min(renderCps.length, Number(span.renderEnd) || start));
        let left = drawOriginX + (prefixAdvances[start] || 0);
        let right = drawOriginX + (prefixAdvances[end] || prefixAdvances[start] || 0);

        left = Math.max(0, Math.min(boxWidth, left));
        right = Math.max(left, Math.min(boxWidth, right));
        if (right - left < minimumWidth) {
          const center = Math.max(0, Math.min(boxWidth, (left + right) / 2));
          left = Math.max(0, center - minimumWidth / 2);
          right = Math.min(boxWidth, center + minimumWidth / 2);
          if (right - left < 1) {
            left = Math.max(0, Math.min(boxWidth - 1, left));
            right = Math.min(boxWidth, left + 1);
          }
        }

        return {
          componentIndex: canonicalIndex,
          cp: Number(cp),
          x: left,
          y: 0,
          width: Math.max(1, right - left),
          height: boxHeight,
          renderStart: start,
          renderEnd: end
        };
      });
    }

    const measuredLines = [];
    let maxLineW = 0;
    let totalH = 0;

    for (let li = 0; li < linesElements.length; li++) {
      const lineEls = linesElements[li] || [];
      let w = 0;
      let maxAscent = 0;
      let maxDescent = 0;
      const measuredEls = [];
      for (let ei = 0; ei < lineEls.length; ei++) {
        const el = lineEls[ei];
        if (el.type === 'gap') {
          const gapPx = Math.max(0, el.px | 0);
          measuredEls.push({ ...el, _index: ei, m: { w: gapPx, h: 0, ascent: 0, descent: 0, left: 0 } });
          w += gapPx;
          continue;
        }
        if (el.type === 'text') {
          const fam = el.fontFamily || FONT_FAMILY_LITERAL;
          const m = measureTextLike(el.text, el.px ?? fontPx, fam, true);
          measuredEls.push({ ...el, _index: ei, m });
          w += m.w;
          maxAscent = Math.max(maxAscent, m.ascent + haloExtra);
          maxDescent = Math.max(maxDescent, m.descent + haloExtra);
          continue;
        }
        if (el.type === 'glyph') {
          const fam = el.fontFamily || FONT_FAMILY_TEXT;
          const syntheticCp = getSyntheticCornerBracketCodepoint(el);
          const m = syntheticCp != null
            ? measureSyntheticCornerBracket(el.px ?? fontPx, syntheticCp)
            : measureTextLike(getElementRenderCps(el).map(cp => String.fromCodePoint(cp)).join(''), el.px ?? fontPx, fam);
          const audioGlyphLayout = buildAdaptedRunAudioGlyphLayout(el, m);
          measuredEls.push({
            ...el,
            ...(audioGlyphLayout ? { audioGlyphLayout } : {}),
            _index: ei,
            m
          });
          w += m.w;
          maxAscent = Math.max(maxAscent, m.ascent + haloExtra);
          maxDescent = Math.max(maxDescent, m.descent + haloExtra);
          continue;
        }
        if (el.type === 'run') {
          const fam = el.fontFamily || FONT_FAMILY_TEXT;
          const chars = getElementRenderCps(el).map(cp => String.fromCodePoint(cp)).join('');
          const syntheticCp = getSyntheticCornerBracketCodepoint(el);
          const m = syntheticCp != null
            ? measureSyntheticCornerBracket(el.px ?? fontPx, syntheticCp)
            : measureTextLike(chars, el.px ?? fontPx, fam);
          const audioGlyphLayout = buildAdaptedRunAudioGlyphLayout(el, m);
          measuredEls.push({
            ...el,
            ...(audioGlyphLayout ? { audioGlyphLayout } : {}),
            _index: ei,
            m
          });
          w += m.w;
          maxAscent = Math.max(maxAscent, m.ascent + haloExtra);
          maxDescent = Math.max(maxDescent, m.descent + haloExtra);
          continue;
        }
        if (el.type === 'cartouche') {
          measuredEls.push({ ...el, _index: ei, m: { w: el.w|0, h: el.h|0, ascent: el.ascent ?? Math.ceil((el.h|0)*0.7), descent: el.descent ?? Math.ceil((el.h|0)*0.3), left: 0 } });
          w += (el.w | 0);
          const a0 = el.ascent ?? Math.ceil((el.h | 0) * 0.7);
          const d0 = el.descent ?? Math.ceil((el.h | 0) * 0.3);
          const allowance = Math.max(2, Math.round(fontPx * 0.08));
          const capA = Math.ceil(fontPx * 0.80) + allowance;
          const hasManualTallies = Array.isArray(el.manualTallies) && el.manualTallies.some(n => Number(n) > 0);
          const capD = Math.ceil(fontPx * (hasManualTallies ? 0.20 : 0.20)) + allowance;
          maxAscent = Math.max(maxAscent, Math.min(a0, capA) + haloExtra);
          maxDescent = Math.max(maxDescent, Math.min(d0, capD) + haloExtra);
          continue;
        }
      }
      const lineBoxH = Math.max(maxAscent + maxDescent, fontPx);
      measuredLines.push({ lineIndex: li, measuredEls, w, lineBoxH, maxAscent, maxDescent });
      maxLineW = Math.max(maxLineW, w);
      totalH += lineBoxH;
    }
    totalH += Math.max(0, (measuredLines.length - 1) * lineGap);

    const plan = {
      widthPx: Math.max(1, Math.ceil(maxLineW + pad * 2)),
      heightPx: Math.max(1, Math.ceil(totalH + pad * 2)),
      contentWidthPx: Math.max(0, Math.ceil(maxLineW)),
      contentHeightPx: Math.max(0, Math.ceil(totalH)),
      paddingPx: pad,
      lineGapPx: lineGap,
      fontPx,
      align: config?.layout?.align || 'left',
      fillStyle: config?.paint?.fillStyle || null,
      halo: {
        enabled: haloOn,
        color: config?.paint?.halo?.color || null,
        widthPx: haloWidthPx,
        extraPx: haloExtra
      },
      lines: []
    };

    let y = pad;
    for (const L of measuredLines) {
      const f = alignFactorFromMode(config?.layout?.align || 'left');
      const lineOffset = Math.max(0, (maxLineW - L.w) * f);
      let x = pad + lineOffset;
      const baselineYPx = y + L.maxAscent;
      const outLine = {
        lineIndex: L.lineIndex,
        xPx: pad + lineOffset,
        yPx: y,
        widthPx: L.w,
        heightPx: L.lineBoxH,
        baselineYPx,
        ascentPx: L.maxAscent,
        descentPx: L.maxDescent,
        runs: []
      };
      for (const el of L.measuredEls) {
        if (el.type === 'gap') {
          x += Math.max(0, el.px | 0);
          continue;
        }
        const m = el.m || { w: 0, h: 0, ascent: 0, descent: 0, left: 0 };
        const drawX = x + (m.left ?? 0);
        const drawYPx = el.type === 'cartouche'
          ? (baselineYPx - ((el.baselineY != null) ? (el.baselineY | 0) : Math.floor((el.h | 0) * 0.75)))
          : (baselineYPx - (m.ascent ?? 0));
        const fontFamily = el.fontFamily || (el.type === 'text' ? FONT_FAMILY_LITERAL : (el.type === 'cartouche' ? FONT_FAMILY_CARTOUCHE : FONT_FAMILY_TEXT));
        const fontRole = inferFontRole(el);
        const encodedText = el.type === 'text'
          ? String(el.text || '')
          : el.type === 'glyph'
            ? getElementRenderCps(el).map(cp => String.fromCodePoint(cp)).join('')
            : el.type === 'run'
              ? getElementRenderCps(el).map(cp => String.fromCodePoint(cp)).join('')
              : null;
        outLine.runs.push({
          id: `L${L.lineIndex}R${el._index}`,
          lineIndex: L.lineIndex,
          runIndex: el._index,
          kind: el.type,
          renderMode: classifyRenderMode(el),
          fontRole,
          fontFamily,
          fontPx: el.px ?? fontPx,
          xPx: x,
          drawXPx: drawX,
          yPx: drawYPx,
          baselineYPx,
          widthPx: m.w ?? (el.w | 0) ?? 0,
          heightPx: el.type === 'cartouche' ? (el.h | 0) : (m.h ?? 0),
          ascentPx: m.ascent ?? 0,
          descentPx: m.descent ?? 0,
          sourceText: (typeof el.sourceText === 'string') ? el.sourceText : (el.type === 'text' ? String(el.text || '') : null),
          sourceStart: Number.isFinite(Number(el.sourceStart)) ? Number(el.sourceStart) : null,
          sourceEnd: Number.isFinite(Number(el.sourceEnd)) ? Number(el.sourceEnd) : null,
          sourceKind: (typeof el.sourceKind === 'string') ? el.sourceKind : null,
          sourceSegmentIndex: Number.isFinite(Number(el.sourceSegmentIndex)) ? Number(el.sourceSegmentIndex) : null,
          audioText: (typeof el.audioText === 'string') ? el.audioText : null,
          sourceTransform: (typeof el.sourceTransform === 'string') ? el.sourceTransform : null,
          encodedText,
          canonicalEncodedText: (el.type === 'glyph' || el.type === 'run')
            ? getElementCanonicalCps(el).map(cp => String.fromCodePoint(cp)).join('')
            : null,
          cps: (el.type === 'glyph' || el.type === 'run') ? getElementCanonicalCps(el).slice() : (Array.isArray(el.cps) ? el.cps.slice() : null),
          canonicalCps: (el.type === 'glyph' || el.type === 'run' || el.type === 'cartouche') ? getElementCanonicalCps(el).slice() : null,
          renderCps: (el.type === 'glyph' || el.type === 'run') ? getElementRenderCps(el).slice() : (Array.isArray(el.renderCps) ? el.renderCps.slice() : null),
          canonicalFullCps: Array.isArray(el.canonicalFullCps) ? el.canonicalFullCps.slice() : null,
          renderFullCps: Array.isArray(el.renderFullCps) ? el.renderFullCps.slice() : null,
          canonicalToRenderSpans: Array.isArray(el.canonicalToRenderSpans) ? el.canonicalToRenderSpans.map(item => ({ ...item })) : null,
          ...(getSyntheticCornerBracketCodepoint(el) != null ? {
            syntheticCornerBrackets: Array.isArray(el.syntheticCornerBrackets) ? el.syntheticCornerBrackets.map(item => ({ ...item })) : [],
            syntheticCornerBracket: true,
            syntheticCornerBracketCp: getSyntheticCornerBracketCodepoint(el)
          } : {}),
          renderAdapterId: el.renderAdapterId || DEFAULT_FONT_RENDER_ADAPTER_ID,
          requestedRenderAdapterId: el.requestedRenderAdapterId || el.renderAdapterId || DEFAULT_FONT_RENDER_ADAPTER_ID,
          longGlyphPresentation: normalizeLongGlyphPresentation(el.longGlyphPresentation),
          audioSourceCps: Array.isArray(el.audioSourceCps) ? el.audioSourceCps.slice() : null,
          audioSourceIndices: Array.isArray(el.audioSourceIndices) ? el.audioSourceIndices.slice() : null,
          audioGlyphLayout: Array.isArray(el.audioGlyphLayout) ? el.audioGlyphLayout.map(item => ({ ...item })) : null,
          manualTallies: Array.isArray(el.manualTallies) ? el.manualTallies.slice() : null,
          manualTallyLayout: cloneManualTallyLayout(el.manualTallyLayout),
          manualTallyLiftPx: Number.isFinite(Number(el.manualTallyLiftPx)) ? Number(el.manualTallyLiftPx) : 0,
          manualTallySmallFontMaxPx: Number.isFinite(Number(el.manualTallySmallFontMaxPx)) ? Number(el.manualTallySmallFontMaxPx) : 12,
          imageAlt: el.imageAlt || null,
          isQuoted: !!el.isQuoted,
          interpretedQuote: !!el.interpretedQuote,
          quoteOpenChar: (typeof el.quoteOpenChar === 'string') ? el.quoteOpenChar : null,
          quoteCloseChar: (typeof el.quoteCloseChar === 'string') ? el.quoteCloseChar : null,
          isUnrecognized: !!el.isUnrecognized,
          unknownDisplay: el.unknownDisplay ? { ...el.unknownDisplay } : null,
          fillStyle: config?.paint?.fillStyle || null,
          halo: { ...(config?.paint?.halo || {}) },
          _element: clonePlanElement(el)
        });
        x += (m.w ?? 0);
      }
      plan.lines.push(outLine);
      y += L.lineBoxH;
      if (L.lineIndex < measuredLines.length - 1) y += lineGap;
    }
    nanpaDebugEmit("render-plan:built", {
      widthPx: plan.widthPx,
      heightPx: plan.heightPx,
      lineCount: plan.lines.length,
      runs: (plan.lines || []).flatMap(line => (line.runs || []).map(run => ({
        id: run.id,
        lineIndex: run.lineIndex,
        kind: run.kind,
        fontRole: run.fontRole,
        fontFamily: run.fontFamily,
        sourceText: run.sourceText,
        sourceStart: run.sourceStart,
        sourceEnd: run.sourceEnd,
        encodedText: run.encodedText,
        cps: Array.isArray(run.cps) ? nanpaDebugCps(run.cps) : null,
        element: nanpaDebugElementSummary(run._element)
      })))
    });
    return plan;
  }

  function drawRenderRunToCanvas(run, { supersampleScale = 8, downsample = false } = {}) {
    if (!run || !run._element) throw new Error('renderRunToNewCanvas requires a run object returned by buildRenderPlan().');
    const scale = Math.max(1, Number(supersampleScale) || 1);
    const el = run._element;
    const syntheticCornerCp = getSyntheticCornerBracketCodepoint(el);
    const baseW = Math.max(1, Math.ceil(Number(run.widthPx || el.w || 1)));
    const baseH = Math.max(1, Math.ceil(
      syntheticCornerCp != null
        ? Math.max(Number(run.heightPx || 0), Number(run.ascentPx || 0) + Number(run.descentPx || 0), Number(run.fontPx || 1))
        : Number(run.heightPx || el.h || run.fontPx || 1)
    ));
    const drawW = Math.max(1, Math.ceil(baseW * scale));
    const drawH = Math.max(1, Math.ceil(baseH * scale));
    const c = document.createElement('canvas');
    c.width = drawW;
    c.height = drawH;
    const ctx = c.getContext('2d', { alpha: true });
    ctx.clearRect(0, 0, drawW, drawH);
    const fillCss = run.fillStyle || getFgHex?.() || '#000000';
    if (syntheticCornerCp != null) {
      const px = Math.max(1, Number(run.fontPx || el.px || 16) * scale);
      const baseline = Math.round(Number(run.ascentPx || Math.ceil((run.fontPx || 16) * 0.8)) * scale);
      drawSyntheticCornerBracket(ctx, syntheticCornerCp, 0, baseline, {
        fontPx: px,
        widthPx: Number(run.widthPx || baseW) * scale,
        heightPx: Number(run.heightPx || Math.max(1, (run.fontPx || 16) * 0.76)) * scale,
        fillCss,
        halo: run.halo ? {
          ...run.halo,
          widthPx: Math.max(0, Number(run.halo.widthPx || 0)) * scale
        } : null
      });
    } else if (el.type === 'cartouche' && el.canvas) {
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(el.canvas, 0, 0, drawW, drawH);
    } else if (el.type === 'text') {
      const fam = run.fontFamily || FONT_FAMILY_LITERAL;
      const px = Math.max(1, Math.round((run.fontPx || 16) * scale));
      const baseline = Math.round((run.ascentPx || Math.ceil((run.fontPx || 16) * 0.8)) * scale);
      if (run.isUnrecognized || el.isUnrecognized) {
        drawUnknownOutlineBox(ctx, 0, baseline, {
          ascent: baseline,
          descent: Math.max(0, drawH - baseline),
          w: drawW,
          h: drawH,
        }, (run.unknownDisplay || el.unknownDisplay || getUnknownTextDisplay()), fillCss);
      }
      if (typeof __bridgeDrawTextWithOptionalHalo === 'function') {
        __bridgeDrawTextWithOptionalHalo(ctx, String(el.text || ''), 0, baseline, { px, fontFamily: fam, fillCss });
      } else {
        ctx.font = `${px}px "${fam}"`;
        ctx.textBaseline = 'alphabetic';
        ctx.fillStyle = fillCss;
        ctx.fillText(String(el.text || ''), 0, baseline);
      }
    } else if (el.type === 'glyph' || el.type === 'run') {
      const fam = run.fontFamily || FONT_FAMILY_TEXT;
      const px = Math.max(1, Math.round((run.fontPx || 16) * scale));
      const baseline = Math.round((run.ascentPx || Math.ceil((run.fontPx || 16) * 0.8)) * scale);
      const chars = getElementRenderCps(el).map(cp => String.fromCodePoint(cp)).join('');
      if (typeof __bridgeDrawTextWithOptionalHalo === 'function') {
        __bridgeDrawTextWithOptionalHalo(ctx, chars, 0, baseline, { px, fontFamily: fam, fillCss });
      } else {
        ctx.font = `${px}px "${fam}"`;
        ctx.textBaseline = 'alphabetic';
        ctx.fillStyle = fillCss;
        ctx.fillText(chars, 0, baseline);
      }
    } else {
      throw new Error(`Unsupported run kind for rasterization: ${el.type}`);
    }
    if (!downsample || scale === 1) return c;
    const out = document.createElement('canvas');
    out.width = baseW;
    out.height = baseH;
    const outCtx = out.getContext('2d', { alpha: true });
    outCtx.imageSmoothingEnabled = true;
    outCtx.clearRect(0, 0, baseW, baseH);
    outCtx.drawImage(c, 0, 0, baseW, baseH);
    return out;
  }


  function ucsurAstFromLines(lines) {
    const normalized = Array.isArray(lines) ? lines : [];
    return {
      type: 'document',
      normalizedInput: '',
      lines: normalized.map((line, index) => {
        const children = [];
        if (typeof line === 'string') {
          children.push({ kind: 'rawUcsur', cps: Array.from(line).map(ch => ch.codePointAt(0)) });
        } else if (Array.isArray(line)) {
          if (line.every(v => typeof v === 'number')) children.push({ kind: 'rawUcsur', cps: line.slice() });
          else for (const item of line) {
            if (Array.isArray(item) && item.every(v => typeof v === 'number')) children.push({ kind: 'rawUcsur', cps: item.slice() });
            else if (item && item.kind === 'image') children.push(item);
            else if (item && item.kind === 'rawUcsur') children.push(item);
          }
        }
        return { type: 'line', index, children };
      })
    };
  }


  /* ============================================================
     Optional hexadecimal numeric syntax (isolated from decimal)
     ============================================================ */
  const HEX_NUMERIC_CP = Object.freeze({
    nasa: 0xF193E,
    noka: 0xF1943,
    colon: 0xF199D,
    nena: 0xF1940,
    e: 0xF1909,
    en: 0xF190A,
    esun: 0xF190B,
    kule: 0xF191E,
    ala: 0xF1902,
    ike: 0xF190D,
    uta: 0xF1970,
    ijo: 0xF190C,
    wan: 0xF1973,
    tu: 0xF196E,
    seli: 0xF1957,
    awen: 0xF1908,
    luka: 0xF192D,
    utala: 0xF1971,
    mun: 0xF193A,
    pipi: 0xF1951,
    jo: 0xF1913,
    jan: 0xF1911,
    lawa: 0xF1924,
    ma: 0xF1930,
    pakala: 0xF1948,
    sike: 0xF195C,
    tan: 0xF1967
  });

  const HEX_STRICT_DIGIT_SYLLABLE = Object.freeze({
    "0":"NI", "1":"WE", "2":"TE", "3":"SE", "4":"NA",
    "5":"LE", "6":"NU", "7":"ME", "8":"PE", "9":"JE",
    "A":"JA", "B":"LA", "C":"MA", "D":"PA", "E":"SI", "F":"TA"
  });
  const HEX_RELAXED_DIGIT_SYLLABLE = Object.freeze({
    ...HEX_STRICT_DIGIT_SYLLABLE,
    "1":"WA", "2":"TU", "5":"LU", "7":"MU", "8":"PI"
  });
  const HEX_SYLLABLE_TO_DIGIT_STRICT = Object.freeze(Object.fromEntries(
    Object.entries(HEX_STRICT_DIGIT_SYLLABLE).map(([digit, syllable]) => [syllable, digit])
  ));
  const HEX_SYLLABLE_TO_DIGIT_RELAXED = Object.freeze(Object.fromEntries(
    Object.entries(HEX_RELAXED_DIGIT_SYLLABLE).map(([digit, syllable]) => [syllable, digit])
  ));
  const HEX_ABBREVIATED_WORD_TO_DIGIT = Object.freeze({
    ijo:"0", wan:"1", tu:"2", seli:"3", awen:"4", luka:"5", utala:"6", mun:"7", pipi:"8", jo:"9",
    jan:"A", lawa:"B", ma:"C", pakala:"D", sike:"E", tan:"F"
  });

  function isAsciiHexDigit(ch) {
    return /^[0-9A-Fa-f]$/.test(String(ch ?? ""));
  }

  function isAsciiLetter(ch) {
    return /^[A-Za-z]$/.test(String(ch ?? ""));
  }

  function cloneHexSemantic(semantic) {
    if (!semantic || semantic.kind !== "hex") return null;
    return {
      kind: "hex",
      sourceType: semantic.sourceType || null,
      sourceText: typeof semantic.sourceText === "string" ? semantic.sourceText : null,
      parts: Array.from(semantic.parts || []).map(part => ({ ...part })),
      digits: String(semantic.digits || "").toUpperCase()
    };
  }

  function hexGroupingSizes(length) {
    const n = Math.max(0, Math.trunc(Number(length) || 0));
    if (n <= 0) return [];
    if (n <= 3) return [n];
    const out = [];
    let remaining = n;
    while (remaining > 3) {
      out.push(2);
      remaining -= 2;
    }
    out.push(remaining);
    return out;
  }

  function hexGroupDigitRun(digitRun) {
    const digits = String(digitRun ?? "").toUpperCase();
    if (!digits || !/^[0-9A-F]+$/.test(digits)) return null;
    const sizes = hexGroupingSizes(digits.length);
    const groups = [];
    let pos = 0;
    for (const size of sizes) {
      groups.push(digits.slice(pos, pos + size));
      pos += size;
    }
    return groups;
  }

  function makeHexSemantic(parts, sourceType = null, sourceText = null) {
    const normalized = [];
    let digits = "";
    for (const part of (parts || [])) {
      if (!part || typeof part !== "object") continue;
      if (part.kind === "digits") {
        const run = String(part.digits ?? "").toUpperCase();
        if (!run || !/^[0-9A-F]+$/.test(run)) return null;
        normalized.push({ kind: "digits", digits: run });
        digits += run;
      } else if (part.kind === "delimiter") {
        normalized.push({
          kind: "delimiter",
          char: typeof part.char === "string" && part.char.length ? part.char : null
        });
      } else {
        return null;
      }
    }
    if (!digits) return null;
    if (!normalized.length || normalized[0].kind !== "digits") return null;
    return { kind: "hex", sourceType, sourceText, parts: normalized, digits };
  }

  // Hash syntax: # begins the hexadecimal run. Hex digits are consumed;
  // whitespace/newline or an ASCII letter outside A-F terminates the run.
  // Every other non-hex character is preserved as one NENE no-value spacer.
  function parseHexHashAt(text, start = 0) {
    const s = String(text ?? "");
    const index = Math.max(0, Number(start) | 0);
    if (s[index] !== "#") return null;
    if (!isAsciiHexDigit(s[index + 1])) return null;

    const parts = [];
    let currentDigits = "";
    let digitCount = 0;
    let i = index + 1;

    const flushDigits = () => {
      if (!currentDigits) return;
      parts.push({ kind: "digits", digits: currentDigits.toUpperCase() });
      currentDigits = "";
    };

    while (i < s.length) {
      const ch = s[i];
      if (/\s/.test(ch)) break;
      if (isAsciiHexDigit(ch)) {
        currentDigits += ch;
        digitCount += 1;
        i += 1;
        continue;
      }
      if (isAsciiLetter(ch)) break;

      flushDigits();
      parts.push({ kind: "delimiter", char: ch });
      i += 1;
    }
    flushDigits();
    if (digitCount === 0) return null;

    const semantic = makeHexSemantic(parts, "hash", s.slice(index, i));
    if (!semantic) return null;
    return { kind: "hex", index, end: i, hexSemantic: semantic };
  }

  function findHexHashSequences(text) {
    const s = String(text ?? "");
    if (!s) return [];
    const out = [];
    for (let i = 0; i < s.length; i++) {
      if (s[i] !== "#") continue;
      const hit = parseHexHashAt(s, i);
      if (!hit) continue;
      out.push(hit);
      i = Math.max(i, hit.end - 1);
    }
    return out;
  }

  function validateHexStructuredTokenSequence(tokens, sourceType = null, sourceText = null) {
    const seq = Array.from(tokens || []);
    if (!seq.length || seq[0]?.kind !== "digit") return null;
    const parts = [];
    let run = [];

    function flushRun() {
      if (!run.length) return true;
      const groups = [];
      let group = [];
      for (const token of run) {
        if (token.kind === "digit") {
          group.push(String(token.digit || "").toUpperCase());
          continue;
        }
        if (token.kind !== "generated" || !group.length) return false;
        groups.push(group.join(""));
        group = [];
      }
      if (!group.length) return false;
      groups.push(group.join(""));
      const digits = groups.join("");
      const expected = hexGroupDigitRun(digits);
      if (!expected || expected.length !== groups.length) return false;
      for (let i = 0; i < groups.length; i++) {
        if (groups[i] !== expected[i]) return false;
      }
      parts.push({ kind: "digits", digits });
      run = [];
      return true;
    }

    for (const token of seq) {
      if (token.kind === "delimiter") {
        if (run.length && !flushRun()) return null;
        if (!parts.length) return null;
        parts.push({ kind: "delimiter", char: token.char || null });
        continue;
      }
      run.push(token);
    }
    if (run.length && !flushRun()) return null;
    return makeHexSemantic(parts, sourceType, sourceText);
  }

  function hexProperNameToSemantic(raw, { relaxedParsing = false } = {}) {
    const source = String(raw ?? "").trim();
    if (!source || !/^[A-Za-z]+(?:[ \t]+[A-Za-z]+)*$/.test(source)) return null;
    const compact = source.replace(/[ \t]+/g, "");
    if (!/^nasa/i.test(compact)) return null;
    let body = compact.slice(4);
    if (!body || !/[nN]$/.test(body)) return null;
    body = body.slice(0, -1).toUpperCase();
    if (!body) return null;

    const syllableMap = relaxedParsing
      ? { ...HEX_SYLLABLE_TO_DIGIT_STRICT, ...HEX_SYLLABLE_TO_DIGIT_RELAXED }
      : HEX_SYLLABLE_TO_DIGIT_STRICT;
    const tokens = [];
    let i = 0;
    while (i < body.length) {
      if (body.startsWith("NENE", i)) {
        tokens.push({ kind: "delimiter", char: null });
        i += 4;
        continue;
      }
      if (body.startsWith("NEKE", i)) {
        tokens.push({ kind: "generated" });
        i += 4;
        continue;
      }
      if (i + 2 > body.length) return null;
      const syllable = body.slice(i, i + 2);
      const digit = syllableMap[syllable];
      if (digit == null) return null;
      tokens.push({ kind: "digit", digit });
      i += 2;
    }
    return validateHexStructuredTokenSequence(tokens, "properName", source);
  }

  function findHexProperNameSequences(text, { relaxedParsing = false } = {}) {
    const s = String(text ?? "");
    if (!s) return [];
    const hits = [];
    const lineRe = /[^\r\n]+/g;
    let lineMatch;
    while ((lineMatch = lineRe.exec(s)) !== null) {
      const line = lineMatch[0];
      const lineStart = lineMatch.index | 0;
      const words = [];
      const wordRe = /[A-Za-z]+/g;
      let wm;
      while ((wm = wordRe.exec(line)) !== null) {
        words.push({ raw: wm[0], start: lineStart + wm.index, end: lineStart + wm.index + wm[0].length });
      }
      for (let i = 0; i < words.length; i++) {
        const first = words[i];
        if (!/^nasa/i.test(first.raw) || !/^[A-Z]/.test(first.raw)) continue;
        let best = null;
        let bestJ = -1;
        const maxJ = Math.min(words.length - 1, i + 30);
        for (let j = i; j <= maxJ; j++) {
          if (j > i && !/^[A-Z]/.test(words[j].raw)) break;
          const rawSpan = s.slice(first.start, words[j].end);
          if (!/^[A-Za-z]+(?:[ \t]+[A-Za-z]+)*$/.test(rawSpan)) continue;
          const semantic = hexProperNameToSemantic(rawSpan, { relaxedParsing });
          if (!semantic) continue;
          best = { kind: "hex", index: first.start, end: words[j].end, hexSemantic: semantic };
          bestJ = j;
        }
        if (best) {
          hits.push(best);
          i = bestJ;
        }
      }
    }
    return hits;
  }

  function tokenizeHexCartoucheSource(raw) {
    const s = String(raw ?? "").trim();
    if (!s) return null;
    const tokens = [];
    let i = 0;
    while (i < s.length) {
      if (/\s/.test(s[i])) { i += 1; continue; }
      if (s[i] === ":") { tokens.push(":"); i += 1; continue; }
      if (/[A-Za-z]/.test(s[i])) {
        const start = i;
        while (i < s.length && /[A-Za-z]/.test(s[i])) i += 1;
        tokens.push(s.slice(start, i).toLowerCase());
        continue;
      }
      return null;
    }
    return tokens;
  }

  function hexFullDigitPatterns({ relaxedParsing = false } = {}) {
    const joinWords = ["e", "en", "esun"];
    const nWords = ["nena", "nasa"];
    const out = [];
    const add = (digit, a, bs) => {
      for (const b of (Array.isArray(bs) ? bs : [bs])) out.push({ digit, words: [a, b] });
    };
    for (const n of nWords) add("0", n, "ijo");
    add("1", "wan", joinWords);
    add("2", "tu", joinWords);
    add("3", "seli", joinWords);
    for (const n of nWords) add("4", n, "awen");
    add("5", "luka", joinWords);
    for (const n of nWords) add("6", n, "utala");
    add("7", "mun", joinWords);
    add("8", "pipi", joinWords);
    add("9", "jo", joinWords);
    if (relaxedParsing) {
      add("1", "wan", "ala");
      add("2", "tu", "uta");
      add("5", "luka", "uta");
      add("7", "mun", "uta");
      add("8", "pipi", "ike");
    }
    add("A", "jan", "ala");
    add("B", "lawa", "ala");
    add("C", "ma", "ala");
    add("D", "pakala", "ala");
    add("E", "sike", "ike");
    add("F", "tan", "ala");
    return out;
  }

  function hexCartoucheTokensToSemantic(tokensInput, { relaxedParsing = false, sourceText = null, preferAbbreviated = false } = {}) {
    const tokens = Array.from(tokensInput || []).map(v => String(v).toLowerCase());
    if (tokens.length < 3 || tokens[0] !== "nasa" || tokens[tokens.length - 1] !== "nasa") return null;
    let start = 1;
    if (tokens[start] === ":") start += 1; // optional on input; canonical output always includes it
    const body = tokens.slice(start, -1);
    if (!body.length) return null;

    function tryAbbreviatedHexCartouche() {
      const structured = [];
      for (const word of body) {
        if (word === "kule") { structured.push({ kind: "generated" }); continue; }
        if (word === "e") { structured.push({ kind: "delimiter", char: null }); continue; }
        const digit = HEX_ABBREVIATED_WORD_TO_DIGIT[word];
        if (digit == null) return null;
        structured.push({ kind: "digit", digit });
      }
      return validateHexStructuredTokenSequence(structured, "cartouche", sourceText);
    }

    // Some strict full digits end in e (for example seli e), while an
    // abbreviated hex cartouche uses e as one NENE source delimiter. The
    // current cartouche display mode therefore supplies the only intentional
    // disambiguation: abbreviated mode tries the abbreviated grammar first.
    if (preferAbbreviated) {
      const abbreviatedSemantic = tryAbbreviatedHexCartouche();
      if (abbreviatedSemantic) return abbreviatedSemantic;
    }

    // Full form first when the display/parser mode is full.
    {
      const structured = [];
      const patterns = hexFullDigitPatterns({ relaxedParsing });
      const isNWord = w => w === "nena" || w === "nasa";
      const isJoinWord = w => w === "e" || w === "en" || w === "esun";
      let i = 0;
      let ok = true;
      while (i < body.length) {
        if (i + 3 < body.length && isNWord(body[i]) && isJoinWord(body[i + 1]) && body[i + 2] === "kule" && isJoinWord(body[i + 3])) {
          structured.push({ kind: "generated" });
          i += 4;
          continue;
        }
        if (i + 3 < body.length && isNWord(body[i]) && isJoinWord(body[i + 1]) && isNWord(body[i + 2]) && isJoinWord(body[i + 3])) {
          structured.push({ kind: "delimiter", char: null });
          i += 4;
          continue;
        }
        let match = null;
        for (const pattern of patterns) {
          if (i + pattern.words.length > body.length) continue;
          if (pattern.words.every((word, offset) => body[i + offset] === word)) {
            match = pattern;
            break;
          }
        }
        if (!match) { ok = false; break; }
        structured.push({ kind: "digit", digit: match.digit });
        i += match.words.length;
      }
      if (ok) {
        const semantic = validateHexStructuredTokenSequence(structured, "cartouche", sourceText);
        if (semantic) return semantic;
      }
    }

    // If abbreviated mode did not already claim an ambiguous form, retain the
    // permissive fallback so unambiguous abbreviated cartouches are accepted
    // while the renderer is configured for full output.
    if (!preferAbbreviated) {
      const abbreviatedSemantic = tryAbbreviatedHexCartouche();
      if (abbreviatedSemantic) return abbreviatedSemantic;
    }
    return null;
  }

  function hexCartoucheSourceToSemantic(raw, opts = {}) {
    const tokens = tokenizeHexCartoucheSource(raw);
    if (!tokens) return null;
    return hexCartoucheTokensToSemantic(tokens, { ...opts, sourceText: String(raw ?? "") });
  }

  function hexFullWordsForDigit(digit, { mode = "uniform", relaxedRendering = false } = {}) {
    const d = String(digit ?? "").toUpperCase();
    if (d === "A") return ["jan", "ala"];
    if (d === "B") return ["lawa", "ala"];
    if (d === "C") return ["ma", "ala"];
    if (d === "D") return ["pakala", "ala"];
    if (d === "E") return ["sike", "ike"];
    if (d === "F") return ["tan", "ala"];

    if (relaxedRendering) {
      if (d === "1") return ["wan", "ala"];
      if (d === "2") return ["tu", "uta"];
      if (d === "5") return ["luka", "uta"];
      if (d === "7") return ["mun", "uta"];
      if (d === "8") return ["pipi", "ike"];
    }

    const nWord = mode === "traditional" ? "nasa" : "nena";
    const eWord = mode === "traditional" ? "esun" : "e";
    if (d === "0") return [nWord, "ijo"];
    if (d === "1") return ["wan", eWord];
    if (d === "2") return ["tu", eWord];
    if (d === "3") return ["seli", eWord];
    if (d === "4") return [nWord, "awen"];
    if (d === "5") return ["luka", eWord];
    if (d === "6") return [nWord, "utala"];
    if (d === "7") return ["mun", eWord];
    if (d === "8") return ["pipi", eWord];
    if (d === "9") return ["jo", eWord];
    return null;
  }

  function hexAbbreviatedWordForDigit(digit) {
    const d = String(digit ?? "").toUpperCase();
    const map = {
      "0":"ijo", "1":"wan", "2":"tu", "3":"seli", "4":"awen", "5":"luka", "6":"utala", "7":"mun", "8":"pipi", "9":"jo",
      "A":"jan", "B":"lawa", "C":"ma", "D":"pakala", "E":"sike", "F":"tan"
    };
    return map[d] || null;
  }

  function hexSemanticToTpWords(semantic, { abbreviated = false, mode = "uniform", relaxedRendering = false } = {}) {
    const sem = cloneHexSemantic(semantic);
    if (!sem) return null;
    const words = ["nasa", ":"];
    for (const part of sem.parts) {
      if (part.kind === "delimiter") {
        if (abbreviated) words.push("e");
        else words.push("nena", "e", "nena", "e");
        continue;
      }
      const groups = hexGroupDigitRun(part.digits);
      if (!groups) return null;
      for (let gi = 0; gi < groups.length; gi++) {
        for (const digit of groups[gi]) {
          if (abbreviated) {
            const word = hexAbbreviatedWordForDigit(digit);
            if (!word) return null;
            words.push(word);
          } else {
            const digitWords = hexFullWordsForDigit(digit, { mode, relaxedRendering });
            if (!digitWords) return null;
            words.push(...digitWords);
          }
        }
        if (gi < groups.length - 1) {
          if (abbreviated) words.push("kule");
          else words.push("nena", "e", "kule", "e");
        }
      }
    }
    words.push("nasa");
    return words;
  }

  function hexTpWordsToCodepoints(words) {
    const out = [];
    for (const word of (words || [])) {
      if (word === ":") { out.push(HEX_NUMERIC_CP.colon); continue; }
      const cp = HEX_NUMERIC_CP[String(word).toLowerCase()];
      if (cp == null) return null;
      out.push(cp);
    }
    return out;
  }

  function hexSemanticToInnerCodepoints(semantic, opts = {}) {
    const words = hexSemanticToTpWords(semantic, opts);
    return words ? hexTpWordsToCodepoints(words) : null;
  }

  function hexSyllableForDigit(digit, relaxedRendering = false) {
    const d = String(digit ?? "").toUpperCase();
    return (relaxedRendering ? HEX_RELAXED_DIGIT_SYLLABLE : HEX_STRICT_DIGIT_SYLLABLE)[d] || null;
  }

  function hexSemanticToProperName(semantic, { relaxedRendering = false } = {}) {
    const sem = cloneHexSemantic(semantic);
    if (!sem) return null;
    const words = ["Nasa"];
    const attachNAndPush = suffix => {
      if (words.length <= 1) return false;
      words[words.length - 1] += "n";
      words.push(suffix);
      return true;
    };

    for (const part of sem.parts) {
      if (part.kind === "delimiter") {
        if (!attachNAndPush("Ene")) return null;
        continue;
      }
      const groups = hexGroupDigitRun(part.digits);
      if (!groups) return null;
      for (let gi = 0; gi < groups.length; gi++) {
        let groupWord = "";
        for (const digit of groups[gi]) {
          const syllable = hexSyllableForDigit(digit, relaxedRendering);
          if (!syllable) return null;
          groupWord += syllable.toLowerCase();
        }
        words.push(groupWord[0].toUpperCase() + groupWord.slice(1));
        if (gi < groups.length - 1) {
          if (!attachNAndPush("Eke")) return null;
        }
      }
    }
    if (words.length <= 1) return null;
    words[words.length - 1] += "n"; // final numeric terminator N
    return words.join(" ");
  }

  function hexSemanticToCanonicalHash(semantic) {
    const sem = cloneHexSemantic(semantic);
    if (!sem) return null;
    let out = "#";
    for (const part of sem.parts) {
      if (part.kind === "digits") out += part.digits;
      else out += (part.char != null ? part.char : ":");
    }
    return out;
  }

  function parseCompleteHexInput(input, { relaxedParsing = false, preferAbbreviated = false } = {}) {
    const s = String(input ?? "").trim();
    if (!s) return null;
    if (s.startsWith("#")) {
      const hit = parseHexHashAt(s, 0);
      return hit && hit.end === s.length ? hit.hexSemantic : null;
    }
    if (s.startsWith("[") && s.endsWith("]")) {
      return hexCartoucheSourceToSemantic(s.slice(1, -1), { relaxedParsing, preferAbbreviated });
    }
    return hexProperNameToSemantic(s, { relaxedParsing });
  }


  /* ============================================================
     Optional binary numeric syntax (parallel to hexadecimal)
     ============================================================ */
  function isAsciiBinaryDigit(ch) {
    return ch === "0" || ch === "1";
  }

  function cloneBinarySemantic(semantic) {
    if (!semantic || semantic.kind !== "binary") return null;
    return {
      kind: "binary",
      sourceType: semantic.sourceType || null,
      sourceText: typeof semantic.sourceText === "string" ? semantic.sourceText : null,
      parts: Array.from(semantic.parts || []).map(part => ({ ...part })),
      digits: String(semantic.digits || "")
    };
  }

  function makeBinarySemantic(parts, sourceType = null, sourceText = null) {
    const normalized = [];
    let digits = "";
    for (const part of (parts || [])) {
      if (!part || typeof part !== "object") continue;
      if (part.kind === "digits") {
        const run = String(part.digits ?? "");
        if (!run || !/^[01]+$/.test(run)) return null;
        normalized.push({ kind: "digits", digits: run });
        digits += run;
      } else if (part.kind === "delimiter") {
        normalized.push({ kind: "delimiter", char: typeof part.char === "string" && part.char.length ? part.char : null });
      } else {
        return null;
      }
    }
    if (!digits || !normalized.length || normalized[0].kind !== "digits") return null;
    return { kind: "binary", sourceType, sourceText, parts: normalized, digits };
  }

  // Binary prefix syntax deliberately mirrors parseHexHashAt(): lowercase 0b
  // identifies the run, whitespace/newline terminates it, an ASCII letter or
  // non-binary decimal digit terminates it, and other punctuation is retained
  // as one no-value delimiter. Uppercase 0B is intentionally not accepted.
  function parseBinaryPrefixAt(text, start = 0) {
    const s = String(text ?? "");
    const index = Math.max(0, Number(start) | 0);
    if (s.slice(index, index + 2) !== "0b") return null;
    if (!isAsciiBinaryDigit(s[index + 2])) return null;

    const parts = [];
    let currentDigits = "";
    let digitCount = 0;
    let i = index + 2;
    const flushDigits = () => {
      if (!currentDigits) return;
      parts.push({ kind: "digits", digits: currentDigits });
      currentDigits = "";
    };

    while (i < s.length) {
      const ch = s[i];
      if (/\s/.test(ch)) break;
      if (isAsciiBinaryDigit(ch)) { currentDigits += ch; digitCount += 1; i += 1; continue; }
      // Unlike hex, 2-9 are not valid payload digits and therefore terminate.
      if (/[2-9]/.test(ch) || isAsciiLetter(ch)) break;
      flushDigits();
      parts.push({ kind: "delimiter", char: ch });
      i += 1;
    }
    flushDigits();
    if (digitCount === 0) return null;
    const semantic = makeBinarySemantic(parts, "prefix", s.slice(index, i));
    if (!semantic) return null;
    return { kind: "binary", index, end: i, binarySemantic: semantic };
  }

  function findBinaryPrefixSequences(text) {
    const s = String(text ?? "");
    if (!s) return [];
    const out = [];
    for (let i = 0; i < s.length - 1; i++) {
      if (s[i] !== "0" || s[i + 1] !== "b") continue;
      const hit = parseBinaryPrefixAt(s, i);
      if (!hit) continue;
      out.push(hit);
      i = Math.max(i, hit.end - 1);
    }
    return out;
  }

  function validateBinaryStructuredTokenSequence(tokens, sourceType = null, sourceText = null) {
    const seq = Array.from(tokens || []);
    if (!seq.length || seq[0]?.kind !== "digit") return null;
    const parts = [];
    let digits = "";

    function flushDigits() {
      if (!digits) return true;
      parts.push({ kind: "digits", digits });
      digits = "";
      return true;
    }

    for (const token of seq) {
      if (token.kind === "delimiter") {
        if (!digits || !flushDigits()) return null;
        if (!parts.length) return null;
        parts.push({ kind: "delimiter", char: token.char || null });
        continue;
      }
      if (token.kind !== "digit" || (token.digit !== "0" && token.digit !== "1")) return null;
      digits += token.digit;
    }

    if (!digits || !flushDigits()) return null;
    return makeBinarySemantic(parts, sourceType, sourceText);
  }

  function binaryProperNameToSemantic(raw, { relaxedParsing = false } = {}) {
    const source = String(raw ?? "").trim();
    if (!source || !/^[A-Za-z]+(?:[ \t]+[A-Za-z]+)*$/.test(source)) return null;
    const compact = source.replace(/[ \t]+/g, "");
    if (!/^noka/i.test(compact)) return null;
    let body = compact.slice(4);
    if (!body || !/[nN]$/.test(body)) return null;
    body = body.slice(0, -1).toUpperCase();
    if (!body) return null;
    const syllableMap = relaxedParsing
      ? { NI: "0", WE: "1", WA: "1" }
      : { NI: "0", WE: "1" };
    const tokens = [];
    let i = 0;
    while (i < body.length) {
      if (body.startsWith("NENE", i)) { tokens.push({ kind: "delimiter", char: null }); i += 4; continue; }
      if (i + 2 > body.length) return null;
      const digit = syllableMap[body.slice(i, i + 2)];
      if (digit == null) return null;
      tokens.push({ kind: "digit", digit });
      i += 2;
    }
    return validateBinaryStructuredTokenSequence(tokens, "properName", source);
  }

  function findBinaryProperNameSequences(text, { relaxedParsing = false } = {}) {
    const s = String(text ?? "");
    if (!s) return [];
    const hits = [];
    const lineRe = /[^\r\n]+/g;
    let lineMatch;
    while ((lineMatch = lineRe.exec(s)) !== null) {
      const line = lineMatch[0];
      const lineStart = lineMatch.index | 0;
      const words = [];
      const wordRe = /[A-Za-z]+/g;
      let wm;
      while ((wm = wordRe.exec(line)) !== null) words.push({ raw: wm[0], start: lineStart + wm.index, end: lineStart + wm.index + wm[0].length });
      for (let i = 0; i < words.length; i++) {
        const first = words[i];
        if (!/^noka/i.test(first.raw) || !/^[A-Z]/.test(first.raw)) continue;
        let best = null, bestJ = -1;
        const maxJ = Math.min(words.length - 1, i + 30);
        for (let j = i; j <= maxJ; j++) {
          if (j > i && !/^[A-Z]/.test(words[j].raw)) break;
          const rawSpan = s.slice(first.start, words[j].end);
          if (!/^[A-Za-z]+(?:[ \t]+[A-Za-z]+)*$/.test(rawSpan)) continue;
          const semantic = binaryProperNameToSemantic(rawSpan, { relaxedParsing });
          if (!semantic) continue;
          best = { kind: "binary", index: first.start, end: words[j].end, binarySemantic: semantic };
          bestJ = j;
        }
        if (best) { hits.push(best); i = bestJ; }
      }
    }
    return hits;
  }

  function binaryCartoucheTokensToSemantic(tokensInput, { relaxedParsing = false, sourceText = null, preferAbbreviated = false } = {}) {
    const tokens = Array.from(tokensInput || []).map(v => String(v).toLowerCase());
    if (tokens.length < 3 || tokens[0] !== "noka" || tokens[tokens.length - 1] !== "noka") return null;
    let start = 1;
    if (tokens[start] === ":") start += 1; // optional on input, canonical output always includes it
    const body = tokens.slice(start, -1);
    if (!body.length) return null;

    function tryAbbreviated() {
      const structured = [];
      for (const word of body) {
        if (word === "e") { structured.push({ kind: "delimiter", char: null }); continue; }
        if (word === "ijo") structured.push({ kind: "digit", digit: "0" });
        else if (word === "wan") structured.push({ kind: "digit", digit: "1" });
        else return null;
      }
      return validateBinaryStructuredTokenSequence(structured, "cartouche", sourceText);
    }
    if (preferAbbreviated) {
      const sem = tryAbbreviated();
      if (sem) return sem;
    }

    {
      const structured = [];
      const patterns = hexFullDigitPatterns({ relaxedParsing }).filter(p => p.digit === "0" || p.digit === "1");
      const isNWord = w => w === "nena" || w === "nasa";
      const isJoinWord = w => w === "e" || w === "en" || w === "esun";
      let i = 0, ok = true;
      while (i < body.length) {
        if (i + 3 < body.length && isNWord(body[i]) && isJoinWord(body[i + 1]) && isNWord(body[i + 2]) && isJoinWord(body[i + 3])) { structured.push({ kind: "delimiter", char: null }); i += 4; continue; }
        let match = null;
        for (const pattern of patterns) {
          if (i + pattern.words.length <= body.length && pattern.words.every((word, offset) => body[i + offset] === word)) { match = pattern; break; }
        }
        if (!match) { ok = false; break; }
        structured.push({ kind: "digit", digit: match.digit });
        i += match.words.length;
      }
      if (ok) {
        const sem = validateBinaryStructuredTokenSequence(structured, "cartouche", sourceText);
        if (sem) return sem;
      }
    }
    if (!preferAbbreviated) return tryAbbreviated();
    return null;
  }

  function binaryCartoucheSourceToSemantic(raw, opts = {}) {
    const tokens = tokenizeHexCartoucheSource(raw);
    if (!tokens) return null;
    return binaryCartoucheTokensToSemantic(tokens, { ...opts, sourceText: String(raw ?? "") });
  }

  function binarySemanticToTpWords(semantic, { abbreviated = false, mode = "uniform", relaxedRendering = false } = {}) {
    const sem = cloneBinarySemantic(semantic);
    if (!sem) return null;
    const words = ["noka", ":"];
    for (const part of sem.parts) {
      if (part.kind === "delimiter") {
        if (abbreviated) words.push("e");
        else words.push("nena", "e", "nena", "e");
        continue;
      }
      const digits = String(part.digits || "");
      if (!digits || !/^[01]+$/.test(digits)) return null;
      for (const digit of digits) {
        if (abbreviated) words.push(digit === "0" ? "ijo" : "wan");
        else {
          const digitWords = hexFullWordsForDigit(digit, { mode, relaxedRendering });
          if (!digitWords) return null;
          words.push(...digitWords);
        }
      }
    }
    words.push("noka");
    return words;
  }

  function binaryTpWordsToCodepoints(words) {
    const out = [];
    for (const word of (words || [])) {
      if (word === ":") { out.push(HEX_NUMERIC_CP.colon); continue; }
      const cp = HEX_NUMERIC_CP[String(word).toLowerCase()];
      if (cp == null) return null;
      out.push(cp);
    }
    return out;
  }

  function binarySemanticToInnerCodepoints(semantic, opts = {}) {
    const words = binarySemanticToTpWords(semantic, opts);
    return words ? binaryTpWordsToCodepoints(words) : null;
  }

  function binarySemanticToProperName(semantic, { relaxedRendering = false } = {}) {
    const sem = cloneBinarySemantic(semantic);
    if (!sem) return null;
    const words = ["Noka"];
    const attachNAndPush = suffix => { if (words.length <= 1) return false; words[words.length - 1] += "n"; words.push(suffix); return true; };
    for (const part of sem.parts) {
      if (part.kind === "delimiter") { if (!attachNAndPush("Ene")) return null; continue; }
      const digits = String(part.digits || "");
      if (!digits || !/^[01]+$/.test(digits)) return null;
      let digitWord = "";
      for (const digit of digits) {
        const syllable = digit === "0" ? "NI" : (relaxedRendering ? "WA" : "WE");
        digitWord += syllable.toLowerCase();
      }
      words.push(digitWord[0].toUpperCase() + digitWord.slice(1));
    }
    if (words.length <= 1) return null;
    words[words.length - 1] += "n";
    return words.join(" ");
  }

  function binarySemanticToCanonicalPrefix(semantic) {
    const sem = cloneBinarySemantic(semantic);
    if (!sem) return null;
    let out = "0b";
    for (const part of sem.parts) {
      if (part.kind === "digits") out += part.digits;
      else out += (part.char != null ? part.char : ":");
    }
    return out;
  }

  function parseCompleteBinaryInput(input, { relaxedParsing = false, preferAbbreviated = false } = {}) {
    const s = String(input ?? "").trim();
    if (!s) return null;
    if (s.startsWith("0b")) {
      const hit = parseBinaryPrefixAt(s, 0);
      return hit && hit.end === s.length ? hit.binarySemantic : null;
    }
    if (s.startsWith("[") && s.endsWith("]")) return binaryCartoucheSourceToSemantic(s.slice(1, -1), { relaxedParsing, preferAbbreviated });
    return binaryProperNameToSemantic(s, { relaxedParsing });
  }

  async function renderAstToNewCanvas(ast, config = {}) {
    return await withScopedRenderConfig(config, async () => {
      if (typeof __bridgeFontsReadyForPx === 'function') await __bridgeFontsReadyForPx(config?.layout?.fontPx ?? (__bridgeGetFontPx ? __bridgeGetFontPx() : 56));
      if (typeof __bridgeWarmUpCanvasFontsOnce === 'function') __bridgeWarmUpCanvasFontsOnce();
      const linesElements = await astToLineElements(ast, config);
      nanpaDebugEmit("render-ast:lines-elements", {
        normalizedInput: ast?.normalizedInput || null,
        lines: linesElements.map(line => line.map(nanpaDebugElementSummary))
      });
      const canvas = document.createElement('canvas');
      const renderFontPx = Math.max(8, Number(config?.layout?.fontPx ?? (__bridgeGetFontPx ? __bridgeGetFontPx() : 56) ?? 56));
      __bridgeRenderAllLinesToCanvas(canvas, linesElements, {
        fontPx: renderFontPx,
        lineGapPx: resolveLineGapPxForLayout(config?.layout || {}, renderFontPx),
        paddingPx: config?.layout?.paddingPx
      });
      return { canvas, ast, linesElements };
    });
  }

  async function renderBlit(targetCanvas, x, y, rendered) {
    const ctx = targetCanvas.getContext('2d', { alpha: true });
    ctx.drawImage(rendered.canvas, Math.round(x || 0), Math.round(y || 0));
    return rendered;
  }

  async function ensureCore() {
    if (__coreReady) return __coreReady;
    __coreReady = (async () => {
      await ensureDomReady();
      buildHiddenScaffold();
      
    

    const elSrStatus = document.getElementById("srStatus");
    function announceStatus(msg) {
      if (!elSrStatus) return;
      elSrStatus.textContent = String(msg ?? "");
    }
    function showAlertAndAnnounce(msg) {
      const s = String(msg ?? "Unknown error");
      announceStatus(s);
      alert(s);
    }
    function nextFrame() {
      return new Promise(resolve => requestAnimationFrame(() => resolve()));
    }

    const FG_COLOR_STORAGE_KEY = "tpFgHex";
const FG_COLOR_QUERY_PARAM = "fg"; // optional: "#RRGGBB" (e.g. %23112233)

function clampByte(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return null;
  const i = Math.round(x);
  if (i < 0) return 0;
  if (i > 255) return 255;
  return i;
}

function byteToHex2(n) {
  const s = (n | 0).toString(16).toUpperCase();
  return (s.length === 1) ? ("0" + s) : s;
}

function rgbToHex(r, g, b) {
  return "#" + byteToHex2(r) + byteToHex2(g) + byteToHex2(b);
}

function parseRgbCsv(s) {
  const raw = String(s ?? "").trim();
  if (!raw) return null;
  const parts = raw.split(",").map(p => p.trim()).filter(Boolean);
  if (parts.length !== 3) return null;
  const r = clampByte(parts[0]);
  const g = clampByte(parts[1]);
  const b = clampByte(parts[2]);
  if (r == null || g == null || b == null) return null;
  return { r, g, b };
}

/**
 * Accepts:
 *  - "#RRGGBB" (any case)
 *  - "R,G,B"   (legacy, decimal 0..255)
 * Returns "#RRGGBB" uppercase, or null.
 */
function normalizeHexColor(s) {
  const raw = String(s ?? "").trim();
  if (!raw) return null;

  // Modern hex
  const m = /^#([0-9a-f]{6})$/i.exec(raw);
  if (m) return ("#" + m[1].toUpperCase());

  // Legacy CSV "R,G,B"
  const rgb = parseRgbCsv(raw);
  if (rgb) return rgbToHex(rgb.r, rgb.g, rgb.b);

  return null;
}


function readFgHexFromQuery() {
  try {
    const params = new URLSearchParams(window.location.search || "");
    return normalizeHexColor(params.get(FG_COLOR_QUERY_PARAM));
  } catch {
    return null;
  }
}

function loadFgHexFromStorage() {
  try {
    return normalizeHexColor(localStorage.getItem(FG_COLOR_STORAGE_KEY));
  } catch {
    return null;
  }
}

function saveFgHexToStorage(hex) {
  try { localStorage.setItem(FG_COLOR_STORAGE_KEY, hex); } catch {}
}

function getFgHex() {
  const pick = document.getElementById("fgPick");
  return normalizeHexColor(pick?.value) ?? "#000000";
}

function setFgHex(hex) {
  const pick = document.getElementById("fgPick");
  const h = normalizeHexColor(hex) ?? "#000000";
  if (pick) pick.value = h;
  saveFgHexToStorage(h);
  return h;
}

function initFgColorControls() {
  const q = readFgHexFromQuery();
  if (q) { setFgHex(q); return; }

  const s = loadFgHexFromStorage();
  if (s) { setFgHex(s); return; }

  setFgHex("#000000");
}

function wireFgColorControls() {
  const pick = document.getElementById("fgPick");
  if (!pick) return;

  // Use "input" for live updates while dragging; use "change" for updates on close.
  pick.addEventListener("input", async () => {
    try {
      const hex = getFgHex();
      saveFgHexToStorage(hex);
      await renderFromTextarea();
    } catch (e) {
      showAlertAndAnnounce(e?.message ?? String(e));
    }
  });
}


const HALO_ENABLED_STORAGE_KEY = "tpHaloEnabled";
const HALO_COLOR_STORAGE_KEY   = "tpHaloHex";

const HALO_WIDTH_STORAGE_KEY   = "tpHaloWidthPx"; // 0 => auto

// default values
const HALO_DEFAULT_WIDTH = 0;

// default values
const HALO_DEFAULT_ENABLED = false;
const HALO_DEFAULT_HEX = "#FFFFFF";

function loadHaloEnabledFromStorage() {
  try {
    const raw = localStorage.getItem(HALO_ENABLED_STORAGE_KEY);
    if (raw == null) return null;
    if (raw === "1" || raw === "true") return true;
    if (raw === "0" || raw === "false") return false;
    return null;
  } catch {
    return null;
  }
}

function saveHaloEnabledToStorage(v) {
  try { localStorage.setItem(HALO_ENABLED_STORAGE_KEY, v ? "1" : "0"); } catch {}
}

function getHaloEnabled() {
  const el = document.getElementById("haloEnable");
  return !!el?.checked;
}

function setHaloEnabled(v) {
  const el = document.getElementById("haloEnable");
  const b = !!v;
  if (el) el.checked = b;
  saveHaloEnabledToStorage(b);
  return b;
}

function loadHaloHexFromStorage() {
  try { return normalizeHexColor(localStorage.getItem(HALO_COLOR_STORAGE_KEY)); }
  catch { return null; }
}

function saveHaloHexToStorage(hex) {
  try { localStorage.setItem(HALO_COLOR_STORAGE_KEY, hex); } catch {}
}


function loadHaloWidthFromStorage(){
  try{
    const raw = localStorage.getItem(HALO_WIDTH_STORAGE_KEY);
    if (raw == null) return null;
    const n = Math.round(Number(raw));
    if (!Number.isFinite(n) || n < 0) return null;
    return n;
  } catch {
    return null;
  }
}

function saveHaloWidthToStorage(px){
  try { localStorage.setItem(HALO_WIDTH_STORAGE_KEY, String(Math.max(0, Math.round(Number(px) || 0)))); } catch {}
}

function getHaloWidthOverridePx(){
  const el = document.getElementById("haloWidthSel");
  const n = Math.round(Number(el?.value ?? 0));
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
}

function setHaloWidthOverridePx(px){
  const el = document.getElementById("haloWidthSel");
  const n = Math.max(0, Math.round(Number(px) || 0));
  if (el) el.value = String(n);
  saveHaloWidthToStorage(n);
  return n;
}


function updateHaloWidthControlEnabled(){
  const widthEl = document.getElementById("haloWidthSel");
  if (!widthEl) return;
  widthEl.disabled = !getHaloEnabled();
}

function getHaloHex() {
  const pick = document.getElementById("haloPick");
  return normalizeHexColor(pick?.value) ?? HALO_DEFAULT_HEX;
}

function setHaloHex(hex) {
  const pick = document.getElementById("haloPick");
  const h = normalizeHexColor(hex) ?? HALO_DEFAULT_HEX;
  if (pick) pick.value = h;
  saveHaloHexToStorage(h);
  return h;
}

function initHaloControls() {
  const en = loadHaloEnabledFromStorage();
  setHaloEnabled(en ?? HALO_DEFAULT_ENABLED);

  const hx = loadHaloHexFromStorage();
  setHaloHex(hx ?? HALO_DEFAULT_HEX);

  const hw = loadHaloWidthFromStorage();
  setHaloWidthOverridePx(hw ?? HALO_DEFAULT_WIDTH);
  updateHaloWidthControlEnabled();
}

function wireHaloControls() {
  const en = document.getElementById("haloEnable");
  const pick = document.getElementById("haloPick");
  const widthEl = document.getElementById("haloWidthSel");

  if (en) {
    en.addEventListener("change", async () => {
      try {
        setHaloEnabled(en.checked);
        updateHaloWidthControlEnabled();
        await renderFromTextarea();
      } catch (e) {
        showAlertAndAnnounce(e?.message ?? String(e));
      }
    });
  }

  if (pick) {
    pick.addEventListener("input", async () => {
      try {
        const hex = getHaloHex();
        saveHaloHexToStorage(hex);
        await renderFromTextarea();
      } catch (e) {
        showAlertAndAnnounce(e?.message ?? String(e));
      }
    });
  }

  if (widthEl) {
    widthEl.addEventListener("change", async () => {
      try {
        // clamp + save
        setHaloWidthOverridePx(widthEl.value);
        // Only affects rendering when halo is enabled, but rerender regardless.
        await renderFromTextarea();
      } catch (e) {
        showAlertAndAnnounce(e?.message ?? String(e));
      }
    });
  }
}




    /* ============================
       Font size selection (remember + query param)
       ============================ */
    const FONT_SIZE_STORAGE_KEY = "tpFontPx";
    const FONT_SIZE_QUERY_PARAM = "fontPx";
    const FONT_SIZE_QUERY_PARAM_ALIAS = "fontSize";
    const FONT_SIZE_ALLOWED = [8, 10, 12, 14, 16, 20, 24, 28, 32, 36, 40, 44, 48, 56, 64, 72, 80, 88, 96, 104, 120, 144];

    function clampAllowedFontPx(px) {
      const n = Number(px);
      if (!Number.isFinite(n)) return null;
      const i = Math.round(n);
      if (FONT_SIZE_ALLOWED.includes(i)) return i;
      if (i >= 8 && i <= 220) return i;
      return null;
    }

    function getFontPx() {
      const sel = document.getElementById("fontSizeSel");
      const v = sel ? sel.value : "";
      const px = clampAllowedFontPx(v);
      return px ?? 56;
    }

    function setFontPx(px) {
      const val = clampAllowedFontPx(px) ?? 56;
      const sel = document.getElementById("fontSizeSel");
      if (sel) {
        const exists = Array.from(sel.options).some(o => Number(o.value) === val);
        if (!exists) {
          const opt = document.createElement("option");
          opt.value = String(val);
          opt.textContent = `${val} px`;
          sel.appendChild(opt);
        }
        sel.value = String(val);
      }
      try { localStorage.setItem(FONT_SIZE_STORAGE_KEY, String(val)); } catch {}
      return val;
    }

    function readFontPxFromQuery() {
      try {
        const params = new URLSearchParams(window.location.search || "");
        const raw = params.get(FONT_SIZE_QUERY_PARAM) ?? params.get(FONT_SIZE_QUERY_PARAM_ALIAS) ?? "";
        const val = clampAllowedFontPx(raw);
        return val;
      } catch {
        return null;
      }
    }

    function loadFontPxFromStorage() {
      try {
        const raw = localStorage.getItem(FONT_SIZE_STORAGE_KEY);
        const val = clampAllowedFontPx(raw);
        return val;
      } catch {
        return null;
      }
    }

    function applyFontPxFromQueryOrStorage() {
      const q = readFontPxFromQuery();
      if (q != null) { setFontPx(q); return; }
      const s = loadFontPxFromStorage();
      if (s != null) setFontPx(s);
      else setFontPx(56);
    }

    function wireFontSizeSelect() {
      const sel = document.getElementById("fontSizeSel");
      if (!sel) return;
      sel.addEventListener("change", async () => {
        try {
          const px = setFontPx(sel.value);
          DID_WARMUP = false;
          await fontsReadyForPx(px);
          await renderFromTextarea();
        } catch (e) {
          showAlertAndAnnounce(e?.message ?? String(e));
        }
      });
    }

    const ALIGN_STORAGE_KEY = "tpAlignMode";

    function loadAlignFromStorage(){
      try{
        const v = String(localStorage.getItem(ALIGN_STORAGE_KEY) ?? "").toLowerCase();
        return (v === "left" || v === "center" || v === "right") ? v : null;
      } catch {
        return null;
      }
    }

    function saveAlignToStorage(v){
      try { localStorage.setItem(ALIGN_STORAGE_KEY, v); } catch {}
    }

    function setAlignMode(v){
      const mode = (v === "center" || v === "right") ? v : "left";
      const sel = document.getElementById("alignSel");
      if (sel) sel.value = mode;
      saveAlignToStorage(mode);
      return mode;
    }

    function applyAlignFromStorage(){
      const s = loadAlignFromStorage();
      if (s) setAlignMode(s);
      else setAlignMode("left");
    }



    function getAlignMode(){
      const sel = document.getElementById("alignSel");
      const v = String(sel?.value ?? "left");
      return (v === "center" || v === "right") ? v : "left";
    }

    function alignFactor(mode){
      if (mode === "center") return 0.5;
      if (mode === "right") return 1.0;
      return 0.0;
    }

    function wireAlignSelect(){
      const sel = document.getElementById("alignSel");
      if (!sel) return;
      sel.addEventListener("change", async () => {
        try {
          setAlignMode(sel.value);
          await renderFromTextarea();
        } catch (e) {
          showAlertAndAnnounce(e?.message ?? String(e));
        }
      });
    }

    const WORD_GAP_PX  = 12;
    const LINE_GAP_PX  = 18;

    // Keep the legacy constants above for compatibility, but compute live gaps
    // from the shared render-spacing state so API calls can opt into presets.

    const CARTOUCHE_START_CP = 0xF1990;
    const CARTOUCHE_END_CP   = 0xF1991;
    const CARTOUCHE_EXT_CP   = 0xF1992;

    // Right-side cartouche padding compensation.
    // The renderer keeps full left padding to avoid clipping the opening cartouche,
    // but reduces right padding because the cartouche font already leaves visible
    // trailing side-bearing after the closing cartouche.
    const RIGHT_CARTOUCHE_PAD_SCALE = 1.00;

    // Only for special quoted latin cartouches: ["..."]
    let QUOTED_CARTOUCHE_START_EXT_CP  = null; //CARTOUCHE_EXT_CP;
    let QUOTED_CARTOUCHE_MIDDLE_EXT_CP = CARTOUCHE_EXT_CP;
    let QUOTED_CARTOUCHE_END_EXT_CP    = CARTOUCHE_EXT_CP;

    // Long "pi { ... }" container glyphs
    const LONG_PI_START_CP = 0xF1993;  // 0xF1997;  // // START OF LONG PI
    const LONG_PI_EXT_CP   =  0xF1994; // 0xF1998;  //  // COMBINING LONG PI EXTENSION

    function tokenHasOpenCurly(tok) {
      return String(tok ?? "").includes("{");
    }

    function tokenHasCloseCurly(tok) {
      return String(tok ?? "").includes("}");
    }

    function extractCurlyContentFromTokens(tokens, startIdx) {
      let j = startIdx;
      while (j < tokens.length && !tokenHasCloseCurly(tokens[j])) j++;
      if (j >= tokens.length) return null; // no closing brace

      const joined = tokens.slice(startIdx, j + 1).join(" ");
      const open = joined.indexOf("{");
      const close = joined.lastIndexOf("}");
      if (open < 0 || close < 0 || close <= open) return null;

      const inner = joined.slice(open + 1, close).trim();
      return { inner, endIndex: j };
    }

    // Letters-only normalization (used by number-phrase parsing etc.)
    function normalizeTpWord(raw) { return String(raw ?? "").toLowerCase().replace(/[^a-z]/g, ""); }

    // Standard alias names for alternative sitelen pona glyphs. These aliases
    // intentionally contain digits, so they must be resolved before the normal
    // glyph-key cleanup removes digits and before numeric scanning can claim
    // the numeric suffix.
    const TP_GLYPH_KEY_ALIASES = Object.freeze({
      "ni01": "ni",
      "ni02": "ni>",
      "ni03": "ni^",
      "ni04": "ni<",
      "sewi01": "sewi",
      "sewi02": "sewi^"
    });

    const TP_GLYPH_ALIAS_SOURCE_KEYS = Object.freeze(
      Object.keys(TP_GLYPH_KEY_ALIASES).sort((a, b) => b.length - a.length)
    );

    function resolveTpGlyphAliasKey(raw) {
      const key = String(raw ?? "").trim().toLowerCase();
      return TP_GLYPH_KEY_ALIASES[key] ?? null;
    }

    function findTpGlyphAliasSpans(text) {
      const s = String(text ?? "");
      if (!s || TP_GLYPH_ALIAS_SOURCE_KEYS.length === 0) return [];

      const alternatives = TP_GLYPH_ALIAS_SOURCE_KEYS
        .map(key => key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
        .join("|");

      // Treat aliases as complete glyph-name tokens. The boundary class includes
      // the suffix characters used by alternative glyph keys so strings such as
      // "ni02^" are not silently accepted as the exact "ni02" alias.
      const re = new RegExp(
        `(^|[^A-Za-z0-9^<>])(${alternatives})(?=$|[^A-Za-z0-9^<>])`,
        "gi"
      );

      const spans = [];
      let m;
      while ((m = re.exec(s)) !== null) {
        const leadLength = String(m[1] ?? "").length;
        const aliasText = String(m[2] ?? "");
        const start = (m.index | 0) + leadLength;
        spans.push({
          start,
          end: start + aliasText.length,
          source: aliasText,
          glyphKey: resolveTpGlyphAliasKey(aliasText)
        });
      }
      return spans;
    }

    // Numeric recognizers intentionally accept ordinary spaces inside some
    // number formats. Therefore protected glyph-name text must never be masked
    // with spaces: doing so can make separate numbers on the same line merge
    // across an intervening Toki Pona word. U+FFFD is a one-code-unit hard scan
    // boundary, so source offsets remain unchanged while no numeric recognizer
    // can cross the protected span.
    const NUMERIC_SCAN_HARD_BOUNDARY_CHAR = "\uFFFD";

    function maskTpGlyphAliasesForNumericScanning(text) {
      const s = String(text ?? "");
      const spans = findTpGlyphAliasSpans(s);
      if (spans.length === 0) return { text: s, spans };

      const chars = s.split("");
      for (const span of spans) {
        for (let i = span.start; i < span.end; i++) {
          chars[i] = NUMERIC_SCAN_HARD_BOUNDARY_CHAR;
        }
      }
      return { text: chars.join(""), spans };
    }

    // A known glyph name followed immediately by digits is two source
    // sequences: the glyph name and that exact digit suffix. Build a dedicated
    // numeric hit for the suffix and replace the complete combined token with
    // hard scan boundaries in the general numeric-scan copy. This prevents the
    // permissive decimal scanner from merging the suffix with anything that
    // follows later on the line.
    //
    // Examples:
    //   ni2          -> glyph "ni" + number "2"
    //   ni020        -> glyph "ni" + number "020" (leading zero retained)
    //   ni02         -> exact alias "ni>" (masked before this helper runs)
    //   sewi020 34   -> glyph "sewi" + number "020" + number "34"
    function maskTpGlyphPrefixesBeforeNumericSuffixes(text, opts = {}) {
      const s = String(text ?? "");
      if (!s) return { text: s, spans: [], hits: [] };

      const chars = s.split("");
      const spans = [];
      const hits = [];
      const re = /(^|[^A-Za-z0-9^<>])([A-Za-z^<>]+)([0-9]+)(?=$|[^A-Za-z0-9^<>])/g;
      let m;

      while ((m = re.exec(s)) !== null) {
        const leadLength = String(m[1] ?? "").length;
        const glyphText = String(m[2] ?? "");
        const digits = String(m[3] ?? "");
        const glyphKey = glyphText.toLowerCase();

        if (!glyphText || !digits || WORD_TO_UCSUR_CP[glyphKey] == null) continue;

        const glyphStart = (m.index | 0) + leadLength;
        const glyphEnd = glyphStart + glyphText.length;
        const digitEnd = glyphEnd + digits.length;

        let caps = null;
        try {
          caps = decimalStringToCaps(digits, {
            thousandsChar: ",",
            groupFractionTriplets: true,
            fractionGroupSize: 3,
            ...opts
          });
        } catch {
          caps = null;
        }
        if (!caps) continue;

        // Hide the complete combined token from all general scanners. The
        // dedicated hit below owns only the digit suffix in source coordinates.
        for (let i = glyphStart; i < digitEnd; i++) {
          chars[i] = NUMERIC_SCAN_HARD_BOUNDARY_CHAR;
        }

        const span = {
          start: glyphStart,
          glyphEnd,
          end: digitEnd,
          source: s.slice(glyphStart, digitEnd),
          glyphText,
          glyphKey,
          digits
        };
        spans.push(span);
        hits.push({
          kind: "decimal",
          match: digits,
          index: glyphEnd,
          end: digitEnd,
          caps,
          sourceKind: "glyphNumericSuffix"
        });
      }

      return { text: chars.join(""), spans, hits };
    }

    // NEW: glyph-key normalization (used for WORD_TO_UCSUR_CP lookups)
    // Keeps: a-z plus ^ < > : , . and middle dot ·. The six standard
    // digit-bearing aliases above are canonicalized before digits are removed.
    function normalizeTpGlyphKey(raw) {
      const s = String(raw ?? "").toLowerCase().trim();
      const directAlias = resolveTpGlyphAliasKey(s);
      if (directAlias) return directAlias;

      const stripped = s.replace(/^[^a-z0-9^<>:,.·]+|[^a-z0-9^<>:,.·]+$/g, "");
      const strippedAlias = resolveTpGlyphAliasKey(stripped);
      if (strippedAlias) return strippedAlias;

      return stripped.replace(/[^a-z^<>:,.·]/g, "");
    }

    function parseKnownTpWords(innerText) {
      // UPDATED: accept known glyph-keys, not just letters-only words
      const raw = String(innerText ?? "");
      const parts = raw.split(/\s+/).map(normalizeTpGlyphKey).filter(Boolean);
      const known = parts.filter(w => WORD_TO_UCSUR_CP[w] != null);
      return known;
    }

    async function ensureFontLoaded(pxOverride) {
      if (!document.fonts || !document.fonts.load || !document.fonts.check) return;

      const px = Math.max(8, Number(pxOverride ?? getFontPx() ?? 56));

      const sampleTextChar = String.fromCodePoint(0xF196C); // toki
      const sampleCartChar = String.fromCodePoint(0xF1990); // cartouche start
      const sampleLiteral  = "Hello";                       // literal font sample
      const sampleLiteralCartouche = String.fromCodePoint(0xF1990) + "A" + String.fromCodePoint(0xF1991);

      try {
        const okText = document.fonts.check(`${px}px "${FONT_FAMILY_TEXT}"`, sampleTextChar);
        const okCart = document.fonts.check(`${px}px "${FONT_FAMILY_CARTOUCHE}"`, sampleCartChar);
        const okNum  = document.fonts.check(`${px}px "${FONT_FAMILY_NUMBER}"`, sampleCartChar);
        const okLit  = document.fonts.check(`${px}px "${FONT_FAMILY_LITERAL}"`, sampleLiteral);
        const okLitCart = document.fonts.check(`${px}px "${FONT_FAMILY_LITERAL_CARTOUCHE}"`, sampleLiteralCartouche);

        const loads = [];
        if (!okText) loads.push(document.fonts.load(`${px}px "${FONT_FAMILY_TEXT}"`, sampleTextChar));
        if (!okCart) loads.push(document.fonts.load(`${px}px "${FONT_FAMILY_CARTOUCHE}"`, sampleCartChar));
        if (!okNum)  loads.push(document.fonts.load(`${px}px "${FONT_FAMILY_NUMBER}"`, sampleCartChar));
        if (!okLit)  loads.push(document.fonts.load(`${px}px "${FONT_FAMILY_LITERAL}"`, sampleLiteral));
        if (!okLitCart) loads.push(document.fonts.load(`${px}px "${FONT_FAMILY_LITERAL_CARTOUCHE}"`, sampleLiteralCartouche));

        if (loads.length) await Promise.all(loads);

        await document.fonts.ready;

        const okText2 = document.fonts.check(`${px}px "${FONT_FAMILY_TEXT}"`, sampleTextChar);
        const okCart2 = document.fonts.check(`${px}px "${FONT_FAMILY_CARTOUCHE}"`, sampleCartChar);
        const okLit2  = document.fonts.check(`${px}px "${FONT_FAMILY_LITERAL}"`, sampleLiteral);
        const okLitCart2 = document.fonts.check(`${px}px "${FONT_FAMILY_LITERAL_CARTOUCHE}"`, sampleLiteralCartouche);

        if (!okText2 || !okCart2 || !okLit2 || !okLitCart2) {
          await Promise.all([
            document.fonts.load(`${px}px "${FONT_FAMILY_TEXT}"`, sampleTextChar),
            document.fonts.load(`${px}px "${FONT_FAMILY_CARTOUCHE}"`, sampleCartChar),
            document.fonts.load(`${px}px "${FONT_FAMILY_LITERAL}"`, sampleLiteral),
            document.fonts.load(`${px}px "${FONT_FAMILY_LITERAL_CARTOUCHE}"`, sampleLiteralCartouche),
          ]);
          await document.fonts.ready;
        }
      } catch (e) {
        console.warn("[font] load threw error:", e);
      }
    }

    function warmUpCanvasFonts() {
      const c = document.createElement("canvas");
      c.width = 2; c.height = 2;
      const ctx = c.getContext("2d");

      const px = getFontPx();

      ctx.textBaseline = "alphabetic";

      ctx.font = `${px}px "${FONT_FAMILY_TEXT}"`;
      ctx.fillText(String.fromCodePoint(0xF196C), 0, 1);

      ctx.font = `${px}px "${FONT_FAMILY_CARTOUCHE}"`;
      ctx.fillText(String.fromCodePoint(0xF1990), 0, 1);

      ctx.font = `${px}px "${FONT_FAMILY_LITERAL_CARTOUCHE}"`;
      ctx.fillText(String.fromCodePoint(0xF1990) + "A" + String.fromCodePoint(0xF1991), 0, 1);
    }

    let DID_WARMUP = false;

    function warmUpCanvasFontsOnce() {
      if (DID_WARMUP) return;
      DID_WARMUP = true;
      warmUpCanvasFonts();
    }

    let FONTS_READY_PROMISE = null;
    let FONTS_READY_PX = null;

    function fontsReadyForPx(px) {
      const p = Math.max(8, Number(px ?? getFontPx() ?? 56));
      if (!FONTS_READY_PROMISE || FONTS_READY_PX !== p) {
        FONTS_READY_PX = p;
        FONTS_READY_PROMISE = (async () => {
          await ensureFontLoaded(p);
          await nextFrame();
          await nextFrame();
        })();
      }
      return FONTS_READY_PROMISE;
    }

    /* ============================
       Remember Traditional/Uniform + query param
       ============================ */
    const NL_MODE_STORAGE_KEY = "nlMode";
    const NL_MODE_QUERY_PARAM = "nlMode";
    const NL_MODE_QUERY_PARAM_ALIAS = "cartoucheDisplay";

    function getNanpaLinjanMode() {
      //const el = document.querySelector('input[name="nlMode"]:checked');
      //return (el && (el.value === "uniform" || el.value === "traditional")) ? el.value : "traditional";
      return "uniform";
    }

    function setNanpaLinjanMode(mode) {
      const v = (mode === "uniform") ? "uniform" : "traditional";
      const target = document.querySelector(`input[name="nlMode"][value="${v}"]`);
      if (target) target.checked = true;
      try { localStorage.setItem(NL_MODE_STORAGE_KEY, v); } catch {}
    }

    function loadNanpaLinjanModeFromStorage() {
      try {
        const v = localStorage.getItem(NL_MODE_STORAGE_KEY);
        if (v === "uniform" || v === "traditional") setNanpaLinjanMode(v);
      } catch {}
    }

    function readNanpaLinjanModeFromQuery() {
      try {
        const params = new URLSearchParams(window.location.search || "");
        const raw =
          params.get(NL_MODE_QUERY_PARAM) ??
          params.get(NL_MODE_QUERY_PARAM_ALIAS) ??
          "";
        const v = String(raw).toLowerCase().trim();
        if (v === "uniform" || v === "traditional") return v;
      } catch {}
      return null;
    }

    function applyNanpaLinjanModeFromQueryOrStorage() {
      const q = readNanpaLinjanModeFromQuery();
      if (q) { setNanpaLinjanMode(q); return; }
      loadNanpaLinjanModeFromStorage();
    }

    function wireNanpaLinjanModeRadios() {
      const radios = document.querySelectorAll('input[name="nlMode"]');
      radios.forEach(r => {
        r.addEventListener("change", async () => {
          try {
            setNanpaLinjanMode(getNanpaLinjanMode());
            await renderFromTextarea();
          } catch (e) {
            showAlertAndAnnounce(e?.message ?? String(e));
          }
        });
      });
    }

    /* ============================
       Optional default input from query param (not remembered)
       ============================ */
    const INPUT_TEXT_QUERY_PARAM = "text";
    const INPUT_TEXT_QUERY_PARAM_ALIAS = "input";

    function readDefaultInputFromQuery() {
      try {
        const params = new URLSearchParams(window.location.search || "");
        const raw = params.get(INPUT_TEXT_QUERY_PARAM) ?? params.get(INPUT_TEXT_QUERY_PARAM_ALIAS);
        if (raw == null) return null;

        const s = String(raw);
        if (!s.trim()) return null;

        return s.replace(/\\n/g, "\n");
      } catch {
        return null;
      }
    }

    function applyDefaultInputFromQuery() {
      const s = readDefaultInputFromQuery();
      if (s == null) return;
      if (elTextIn) elTextIn.value = s;
    }

    /* ============================
       Word → UCSUR map
       ============================ */
    const WORD_TO_UCSUR_CP = {
      "a": 0xF1900, "akesi": 0xF1901, "ala": 0xF1902, "alasa": 0xF1903,
      "ale": 0xF1904, "ali": 0xF1904, "anpa": 0xF1905, "ante": 0xF1906, "anu": 0xF1907,
      "awen": 0xF1908, "e": 0xF1909, "en": 0xF190A, "esun": 0xF190B, "ijo": 0xF190C,
      "ike": 0xF190D, "ilo": 0xF190E, "insa": 0xF190F, "jaki": 0xF1910, "jan": 0xF1911,
      "jelo": 0xF1912, "jo": 0xF1913, "kala": 0xF1914, "kalama": 0xF1915, "kama": 0xF1916,
      "kasi": 0xF1917, "ken": 0xF1918, "kepeken": 0xF1919, "kili": 0xF191A, "kiwen": 0xF191B,
      "ko": 0xF191C, "kon": 0xF191D, "kule": 0xF191E, "kulupu": 0xF191F, "kute": 0xF1920,
      "la": 0xF1921, "lape": 0xF1922, "laso": 0xF1923, "lawa": 0xF1924, "len": 0xF1925,
      "lete": 0xF1926, "li": 0xF1927, "lili": 0xF1928, "linja": 0xF1929, "lipu": 0xF192A,
      "loje": 0xF192B, "lon": 0xF192C, "luka": 0xF192D, "lukin": 0xF192E, "lupa": 0xF192F,
      "ma": 0xF1930, "mama": 0xF1931, "mani": 0xF1932, "meli": 0xF1933, "mi": 0xF1934,
      "mije": 0xF1935, "moku": 0xF1936, "moli": 0xF1937, "monsi": 0xF1938, "mu": 0xF1939,
      "mun": 0xF193A, "musi": 0xF193B, "mute": 0xF193C, "nanpa": 0xF193D, "nasa": 0xF193E,
      "nasin": 0xF193F, "nena": 0xF1940,
      "ni": 0xF1941,
    
      "nimi": 0xF1942, "noka": 0xF1943,
      "o": 0xF1944, "olin": 0xF1945, "ona": 0xF1946, "open": 0xF1947, "pakala": 0xF1948,
      "pali": 0xF1949, "palisa": 0xF194A, "pan": 0xF194B, "pana": 0xF194C, "pi": 0xF194D,
      "pilin": 0xF194E, "pimeja": 0xF194F, "pini": 0xF1950, "pipi": 0xF1951, "poka": 0xF1952,
      "poki": 0xF1953, "pona": 0xF1954, "pu": 0xF1955, "sama": 0xF1956, "seli": 0xF1957,
      "selo": 0xF1958, "seme": 0xF1959,
      "sewi": 0xF195A,
     
      "sijelo":0xF195B, "sike": 0xF195C, "sin": 0xF195D,
      "sina": 0xF195E, "sinpin": 0xF195F, "sitelen": 0xF1960, "sona": 0xF1961, "soweli": 0xF1962,
      "su": 0xF19A6,
      "suli": 0xF1963, "suno": 0xF1964, "supa": 0xF1965, "suwi": 0xF1966, "tan": 0xF1967,
      "taso": 0xF1968, "tawa": 0xF1969, "telo": 0xF196A, "tenpo": 0xF196B, "toki": 0xF196C,
      "tomo": 0xF196D, "tu": 0xF196E, "unpa": 0xF196F, "uta": 0xF1970, "utala": 0xF1971,
      "walo": 0xF1972, "wan": 0xF1973, "waso": 0xF1974, "wawa": 0xF1975, "weka": 0xF1976,
      "wile": 0xF1977, "namako": 0xF1978, "kin": 0xF1979, "oko": 0xF197A, "kipisi": 0xF197B,
      "leko": 0xF197C, "monsuta": 0xF197D, "tonsi": 0xF197E, "jasima": 0xF197F,
      "kijetesantakalu": 0xF1980, "soko": 0xF1981, "meso": 0xF1982, "epiku": 0xF1983,
      "kokosila": 0xF1984, "lanpan": 0xF1985, "n": 0xF1986, "misikeke": 0xF1987, "ku": 0xF1988,
      "pake": 0xF19A0, "apeja": 0xF19A1, "majuna": 0xF19A2, "powe": 0xF19A3,
        "linluwi":0xF19A4,
      
         "sewi^": 0xF198C,
  "ni>": 0xF198B,
      "ni^": 0xF198A,
      "ni<": 0xF1989,
      
      // punctuation / helpers
      // NOTE: comma/KOMA map to U+F199E only when explicitly accepted by the
      // ordinary cartouche glyph tokenizer. Outside cartouches, comma is never
      // emitted as a tally mark.
      "·": 0xF199C, ":": 0xF199D, ",": 0xF199E,
      "ota": 0xF199C, "kolon": 0xF199D, "koma": 0xF199E,

      // Unicode literal helpers
      // te/to are literal corner brackets; zz is an ideographic space.
      "te": 0x300C,
      "to": 0x300D,
      "zz": 0x3000,

     

      // full stop in a cartouche is rendered with the middle-dot/ota glyph
      ".": 0xF199C
    };
    //


    function isKnownTpWord(w) { return WORD_TO_UCSUR_CP[w] != null; }

    /* ============================
       Glyph-token normalization
       ============================ */
    function normalizeTpGlyphToken(raw) {
      const s0 = String(raw ?? "").trim().toLowerCase();
      if (!s0) return "";

      // keep pure punctuation tokens. Comma is only a tally alias when the
      // cartouche comma-tally flag is enabled. Outside cartouches comma is
      // never translated to U+F199E.
      if (s0 === ":" || s0 === "·" || s0 === ".") return s0;
      if (s0 === ",") return getCartoucheCommaTallyMarks() ? s0 : "";

      // Resolve digit-bearing standard aliases before any cleanup can discard
      // their numeric suffix. This is required for ordinary [] cartouches as
      // well as unbracketed glyph tokens.
      const directAlias = resolveTpGlyphAliasKey(s0);
      if (directAlias) return directAlias;

      const stripped = s0.replace(/^[^a-z0-9^<>:,.·]+|[^a-z0-9^<>:,.·]+$/g, "");
      if (!stripped) return "";

      const strippedAlias = resolveTpGlyphAliasKey(stripped);
      if (strippedAlias) return strippedAlias;

      return normalizeTpGlyphKey(stripped);
    }

    function isKnownTpGlyphToken(t) { return WORD_TO_UCSUR_CP[t] != null; }

    function tokenizeCartoucheGlyphContent(raw) {
      const s = String(raw ?? "").trim();
      if (!s) return [];

      const tokens = [];
      let cur = "";

      function flushCur() {
        const t = normalizeTpGlyphToken(cur);
        if (t) tokens.push(t);
        cur = "";
      }

      for (const ch of Array.from(s)) {
        if (/\s/.test(ch)) {
          flushCur();
          continue;
        }

        // Inside a non-numeric cartouche, dot/middle-dot/colon are glyphs in
        // the cartouche stream, not separators requiring spaces.
        // Decimal/date/time cartouches are parsed before this helper runs.
        if (ch === "." || ch === "·" || ch === ":") {
          flushCur();
          tokens.push(ch === "." ? "." : ch);
          continue;
        }

        // Comma may optionally act as the U+F199E combining tally mark, but
        // only inside this ordinary cartouche glyph path. If disabled, it is
        // treated as a separator and emits no glyph.
        if (ch === ",") {
          flushCur();
          if (getCartoucheCommaTallyMarks()) tokens.push(",");
          continue;
        }

        cur += ch;
      }

      flushCur();
      return tokens;
    }


    function parseCartoucheGlyphContentForRendering(raw) {
      const s = String(raw ?? "").trim();
      if (!s) return null;

      const cps = [];
      const manualTallies = [];
      let cur = "";

      function pushCp(cp, tallyCount = 0) {
        if (cp == null) return false;
        cps.push(cp);
        manualTallies.push(Math.max(0, Math.min(8, Number(tallyCount) || 0)));
        return true;
      }

      function flushCur() {
        const t = normalizeTpGlyphToken(cur);
        cur = "";
        if (!t) return true;
        const cp = WORD_TO_UCSUR_CP[t];
        if (cp == null) return false;
        return pushCp(cp, 0);
      }

      for (const ch of Array.from(s)) {
        if (/\s/.test(ch)) {
          if (!flushCur()) return null;
          continue;
        }

        // Decimal/date/time cartouches are parsed before this ordinary glyph path.
        // Here these punctuation marks are glyphs that do not require surrounding spaces.
        if (ch === "." || ch === "·" || ch === ":") {
          if (!flushCur()) return null;
          const key = (ch === ".") ? "." : ch;
          const cp = WORD_TO_UCSUR_CP[key];
          if (cp == null) return null;
          pushCp(cp, 0);
          continue;
        }

        // Commas outside cartouches are never handled here. Inside this ordinary
        // cartouche path, comma behavior is controlled by two parser settings:
        // cartoucheCommaTallyMarks and cartoucheTallyMode.
        if (ch === ",") {
          if (!flushCur()) return null;
          if (!getCartoucheCommaTallyMarks()) continue;

          const mode = getCartoucheTallyMode();
          if (mode === "manual") {
            if (manualTallies.length > 0) {
              const i = manualTallies.length - 1;
              manualTallies[i] = Math.min(8, (manualTallies[i] || 0) + 1);
            }
          } else if (mode === "comma") {
            pushCp(0x002C, 0);
          } else {
            const cp = WORD_TO_UCSUR_CP[","];
            if (cp == null) return null;
            pushCp(cp, 0);
          }
          continue;
        }

        cur += ch;
      }

      if (!flushCur()) return null;
      if (!cps.length) return null;

      return {
        cps,
        manualTallies: manualTallies.some(n => n > 0) ? manualTallies : null
      };
    }


    /* ============================
       Nanpa-linja-n mappings
       ============================ */
    const NANPA_LINJA_N_WORD_TO_CP = {
      "ala":   0xF1902,
      "ike":   0xF190D,
      "uta":   0xF1970,

      "nanpa": 0xF193D,
      "nasa":  0xF193E,
      "nasin": 0xF193F,
      "nena":  0xF1940,
      "ni":    0xF1941,
      "nimi":  0xF1942,
      "noka":  0xF1943,

      "esun":  0xF190B,
      "en":    0xF190A,
      "e":     0xF1909,

      "o":     0xF1944,
      "ona":   0xF1946,
      "ota":   0xF199C,
      "open":  0xF1947,

      "kulupu":0xF191F,
      "kipisi": 0xF197B,
      "kasi": 0xF1917,
      "kala": 0xF1914,
      "kin": 0xF1979,

      "ijo":   0xF190C,
      "wan":   0xF1973,
      "tu":    0xF196E,
      "seli":  0xF1957,
      "awen":  0xF1908,
      "luka":  0xF192D,
      "utala": 0xF1971,
      "mun":   0xF193A,
      "pipi":  0xF1951,
      "jo":    0xF1913,

        // time delimiter support (cartouche path)
      "kolon": 0xF199D,
      ":":     0xF199D
    };

    const CP_NANPA = NANPA_LINJA_N_WORD_TO_CP["nanpa"];
    const CP_NENA  = NANPA_LINJA_N_WORD_TO_CP["nena"];
    const CP_NASIN = NANPA_LINJA_N_WORD_TO_CP["nasin"];
    const CP_EN    = NANPA_LINJA_N_WORD_TO_CP["en"];
    const CP_E     = NANPA_LINJA_N_WORD_TO_CP["e"];
    const CP_COLON = NANPA_LINJA_N_WORD_TO_CP[":"];
    const CP_OPEN  = NANPA_LINJA_N_WORD_TO_CP["open"];
    const CP_ALA   = NANPA_LINJA_N_WORD_TO_CP["ala"];
    const CP_IKE   = NANPA_LINJA_N_WORD_TO_CP["ike"];
    const CP_UTA   = NANPA_LINJA_N_WORD_TO_CP["uta"];

    const NUMERIC_CARTOUCHE_ABBREVIATION_DROP_AFTER_FIRST_NANPA = new Set([
      CP_NANPA,
      CP_EN,
      CP_E,
      CP_NENA,
      CP_OPEN,
      CP_ALA,
      CP_IKE,
      CP_UTA
    ]);

    function abbreviateNumericCartoucheInfo(cps) {
      const input = Array.from(cps ?? []).map(cp => Number(cp));
      if (!input.length) return { cps: input, sourceIndices: [] };

      const out = [];
      const sourceIndices = [];
      let keptFirstNanpa = false;
      const preserveBreaks = getPreserveNumericCartoucheBreaksInAbbreviation();
      const hasTraditionalFullPositiveOpening =
        input.length >= 4 &&
        input[0] === CP_NANPA &&
        input[1] === CP_E &&
        input[2] === CP_NENA &&
        input[3] === CP_EN;
      const hasColonFullPositiveOpening =
        input.length >= 4 &&
        input[0] === CP_NANPA &&
        input[1] === CP_COLON &&
        input[2] === CP_NENA &&
        input[3] === CP_EN;
      const hasFullPositiveOpening = hasTraditionalFullPositiveOpening || hasColonFullPositiveOpening;
      const hasFullScaffoldingAfterOpening = input.slice(2, -1).some(cp =>
        cp === CP_E || NUMERIC_CARTOUCHE_ABBREVIATION_DROP_AFTER_FIRST_NANPA.has(cp)
      );
      const hasAlreadyAbbreviatedPositiveOpening =
        !hasFullPositiveOpening &&
        !hasFullScaffoldingAfterOpening &&
        input.length >= 3 &&
        input[0] === CP_NANPA &&
        input[1] === CP_EN;
      const hasAlreadyAbbreviatedColonPositiveOpening =
        !hasFullPositiveOpening &&
        !hasFullScaffoldingAfterOpening &&
        input.length >= 4 &&
        input[0] === CP_NANPA &&
        input[1] === CP_COLON &&
        input[2] === CP_EN;

      for (let i = 0; i < input.length; i++) {
        const cp = input[i];
        const isFinalNanpa = (cp === CP_NANPA && i === input.length - 1);

        if (!keptFirstNanpa) {
          out.push(cp);
          sourceIndices.push(i);
          if (cp === CP_NANPA) keptFirstNanpa = true;
          continue;
        }

        if (isFinalNanpa) {
          out.push(cp);
          sourceIndices.push(i);
          continue;
        }

        // Explicit positive: full [nanpa e nena en ... nanpa] abbreviates to
        // [nanpa en ... nanpa]. An already-abbreviated positive cartouche keeps
        // that same leading en rather than dropping it as ordinary scaffolding.
        if (hasTraditionalFullPositiveOpening && i === 1) {
          out.push(CP_EN);
          sourceIndices.push(3);
          i = 3;
          continue;
        }
        if (hasColonFullPositiveOpening && i === 2) {
          out.push(CP_EN);
          sourceIndices.push(3);
          i = 3;
          continue;
        }
        if (hasAlreadyAbbreviatedPositiveOpening && i === 1) {
          out.push(CP_EN);
          sourceIndices.push(1);
          continue;
        }
        if (hasAlreadyAbbreviatedColonPositiveOpening && i === 2) {
          out.push(CP_EN);
          sourceIndices.push(2);
          continue;
        }

        // Preserve the exact visible abbreviation while recording which full
        // cartouche source glyph each displayed glyph represents. This is
        // audio/highlight metadata only and is not used by rendering. Canonical
        // numeric scaffolding now uses e; legacy en is accepted here as input.
        if (
          preserveBreaks &&
          cp === CP_NENA &&
          (input[i + 1] === CP_E || input[i + 1] === CP_EN) &&
          input[i + 2] === CP_NENA &&
          (input[i + 3] === CP_E || input[i + 3] === CP_EN)
        ) {
          out.push(CP_E);
          sourceIndices.push(i + 1);
          i += 3;
          continue;
        }

        if (NUMERIC_CARTOUCHE_ABBREVIATION_DROP_AFTER_FIRST_NANPA.has(cp)) continue;
        out.push(cp);
        sourceIndices.push(i);
      }

      return { cps: out, sourceIndices };
    }

    function abbreviateNumericCartoucheCps(cps) {
      return abbreviateNumericCartoucheInfo(cps).cps;
    }

    function numericCartoucheDisplayInfo(cps) {
      const input = Array.from(cps ?? []).map(cp => Number(cp));
      if (getAbbreviateNumericCartouches()) return abbreviateNumericCartoucheInfo(input);
      return { cps: input, sourceIndices: input.map((_cp, index) => index) };
    }

    function numericCartoucheDisplayCps(cps) {
      return numericCartoucheDisplayInfo(cps).cps;
    }

    function makeNumericCartoucheElementFromCodepoints(elements, cps, { fontPx, fgCss, sourceText = null, sourceStart = null, sourceEnd = null, sourceKind = null, sourceSegmentIndex = null } = {}) {
      const displayInfo = numericCartoucheDisplayInfo(cps);
      const displayCps = displayInfo.cps;
      if (!displayCps || displayCps.length === 0) return;
      nanpaDebugEmit("numeric-cartouche:emit", {
        sourceText,
        sourceStart,
        sourceEnd,
        sourceKind,
        sourceSegmentIndex,
        fontPx,
        abbreviateNumericCartouches: getAbbreviateNumericCartouches(),
        preserveNumericCartoucheBreaksInAbbreviation: getPreserveNumericCartoucheBreaksInAbbreviation(),
        inputCps: nanpaDebugCps(cps),
        displayCps: nanpaDebugCps(displayCps)
      });
      makeCartoucheElementFromCodepoints(elements, displayCps, {
        fontPx,
        // Numeric/date/time cartouches must use the numeric/cartouche companion
        // font role for the whole run: cartouche-start + inner cps + cartouche-end.
        // In host pages, roles.cartouche may intentionally be the ordinary
        // text/sitelen font for non-numeric cartouches; roles.number is the
        // companion cartouche font.
        fontFamily: FONT_FAMILY_NUMBER,
        fgCss,
        sourceText,
        sourceStart,
        sourceEnd,
        sourceKind,
        sourceSegmentIndex,
        audioSourceCps: Array.from(cps || []),
        audioSourceIndices: displayInfo.sourceIndices,
        fontRole: "number",
        isNumericCartouche: true
      });
    }


    function makeHexNumericCartoucheElementFromSemantic(elements, semantic, { fontPx, fgCss, sourceText = null, sourceStart = null, sourceEnd = null, sourceKind = null, sourceSegmentIndex = null } = {}) {
      const normalized = cloneHexSemantic(semantic);
      if (!normalized) return;
      const abbreviated = getAbbreviateNumericCartouches();
      const cps = hexSemanticToInnerCodepoints(normalized, {
        abbreviated,
        mode: getNanpaLinjanMode(),
        relaxedRendering: getRelaxedNanpaLinjanRendering()
      });
      if (!cps || !cps.length) return;
      const before = elements.length;
      makeCartoucheElementFromCodepoints(elements, cps, {
        fontPx,
        fontFamily: FONT_FAMILY_NUMBER,
        fgCss,
        sourceText,
        sourceStart,
        sourceEnd,
        sourceKind,
        sourceSegmentIndex,
        fontRole: "number",
        isNumericCartouche: true,
        audioSourceCps: cps.slice(),
        audioSourceIndices: cps.map((_cp, index) => index)
      });
      for (let i = before; i < elements.length; i++) {
        const el = elements[i];
        if (!el || el.type === "gap") continue;
        el.isHexCartouche = true;
        el.hexSemantic = cloneHexSemantic(normalized);
        el.numericBase = 16;
      }
    }

    function makeBinaryNumericCartoucheElementFromSemantic(elements, semantic, { fontPx, fgCss, sourceText = null, sourceStart = null, sourceEnd = null, sourceKind = null, sourceSegmentIndex = null } = {}) {
      const normalized = cloneBinarySemantic(semantic);
      if (!normalized) return;
      const abbreviated = getAbbreviateNumericCartouches();
      const cps = binarySemanticToInnerCodepoints(normalized, {
        abbreviated,
        mode: getNanpaLinjanMode(),
        relaxedRendering: getRelaxedNanpaLinjanRendering()
      });
      if (!cps || !cps.length) return;
      const before = elements.length;
      makeCartoucheElementFromCodepoints(elements, cps, {
        fontPx, fontFamily: FONT_FAMILY_NUMBER, fgCss, sourceText, sourceStart, sourceEnd, sourceKind, sourceSegmentIndex,
        fontRole: "number", isNumericCartouche: true, audioSourceCps: cps.slice(), audioSourceIndices: cps.map((_cp, index) => index)
      });
      for (let i = before; i < elements.length; i++) {
        const el = elements[i];
        if (!el || el.type === "gap") continue;
        el.isBinaryCartouche = true;
        el.binarySemantic = cloneBinarySemantic(normalized);
        el.numericBase = 2;
      }
    }

    const UNIFORM_TO_NENA = new Set([
      NANPA_LINJA_N_WORD_TO_CP["nasa"],
      NANPA_LINJA_N_WORD_TO_CP["nasin"],
      NANPA_LINJA_N_WORD_TO_CP["ni"],
      NANPA_LINJA_N_WORD_TO_CP["nimi"],
      NANPA_LINJA_N_WORD_TO_CP["noka"],
      NANPA_LINJA_N_WORD_TO_CP["nena"]
    ]);

    const UNIFORM_TO_EN = new Set([
      NANPA_LINJA_N_WORD_TO_CP["e"],
      NANPA_LINJA_N_WORD_TO_CP["en"],
      NANPA_LINJA_N_WORD_TO_CP["esun"]
    ]);

    function uniformizeNanpaLinjanCartoucheCps(cps) {
      const a = Array.from(cps ?? []);
      if (a.length === 0) return a;

      // Only the new explicit-positive full opening keeps en:
      // [nanpa e nena en ...]. Compute this from the original input before
      // converting legacy en scaffolding to canonical e, so legacy
      // [nanpa en nena en ...] remains an unsigned full cartouche.
      const hasExplicitPositiveOpening =
        a.length >= 4 &&
        a[0] === CP_NANPA &&
        ((a[1] === CP_E && a[2] === CP_NENA && a[3] === CP_EN) ||
         (a[1] === CP_COLON && a[2] === CP_NENA && a[3] === CP_EN));

      for (let i = 0; i < a.length; i++) {
        const cp = a[i];

        if (cp === CP_NANPA) {
          if (i !== 0 && i !== a.length - 1) a[i] = CP_NENA;
          continue;
        }
        if (UNIFORM_TO_NENA.has(cp)) { a[i] = CP_NENA; continue; }
        if (UNIFORM_TO_EN.has(cp)) {
          a[i] = (hasExplicitPositiveOpening && i === 3) ? CP_EN : CP_E;
          continue;
        }
      }
      return a;
    }

    const STRICT_DIGIT_TOKENS = new Set(["NI","WE","TE","SE","NA","LE","NU","ME","PE","JE"]);
    const RELAXED_DIGIT_TOKENS = new Set(["WA","TU","LU","MU","PI"]);
    const DIGIT_TOKENS = new Set([...STRICT_DIGIT_TOKENS, ...RELAXED_DIGIT_TOKENS]);
    // NS is an internal-only explicit-leading-plus token. It keeps leading
    // plus distinct from an initial NE+NE no-value spacer.
    const TOKEN_PREFIXES = ["KEKEKE","KEKE","KO","KE","NONONO","NONO","NOKO","OK","NE","NS","NO"];

    const RELAXED_TOKEN_TO_STRICT_TOKEN = Object.freeze({
      "WA": "WE",
      "TU": "TE",
      "LU": "LE",
      "MU": "ME",
      "PI": "PE"
    });

    // Scientific notation previously used the expanded marker
    // NEKO + (WE|WA)NI + NEKO. Accept both legacy forms, but normalize every
    // newly rendered/generated result to the shortened single NEKO marker.
    function canonicalizeScientificNanpaCaps(caps) {
      return String(caps ?? "")
        .trim()
        .toUpperCase()
        .replace(/NEKO(?:WE|WA)NINEKO/g, "NEKO");
    }

    const RELAXED_TOKEN_TO_RENDER_WORDS = Object.freeze({
      "WA": ["wan", "ala"],
      "TU": ["tu", "uta"],
      "LU": ["luka", "uta"],
      "MU": ["mun", "uta"],
      "PI": ["pipi", "ike"]
    });

    function nanpaDigitTokensAcceptedByParser() {
      return getRelaxedNanpaLinjanParsing() ? DIGIT_TOKENS : STRICT_DIGIT_TOKENS;
    }

    function nanpaCapsHasAtLeastOneDigitToken(tokens) {
      for (const t of (tokens ?? [])) {
        if (DIGIT_TOKENS.has(t)) return true;
      }
      return false;
    }

    function tokenizeNanpaCaps(caps) {
      if (caps == null) throw new Error("caps must be a string");
      const s = String(caps).trim().toUpperCase();
      if (!s) throw new Error("caps is empty");
      if (!s.endsWith("N")) throw new Error("nanpa-caps must end with final terminator 'N'");
      if (!s.startsWith("NE")) throw new Error("nanpa-caps must start with 'NE'");

      const tokens = [];
      let i = 0;
      const end = s.length;

      while (i < end - 1) {
        let matched = null;
        for (const pref of TOKEN_PREFIXES) {
          if (s.startsWith(pref, i)) { matched = pref; break; }
        }
        if (matched != null) { tokens.push(matched); i += matched.length; continue; }

        if (i + 2 <= end - 1) {
          const two = s.slice(i, i + 2);
          if (nanpaDigitTokensAcceptedByParser().has(two)) { tokens.push(two); i += 2; continue; }
        }

        throw new Error(`Invalid tokenization at position ${i} in caps string "${caps}"`);
      }

      tokens.push("N");
      return tokens;
    }

    function nanpaColonProperNameToCaps(raw) {
      if (!getNanpaColonParsing()) return null;
      const source = String(raw ?? "").trim();
      if (!source) return null;

      let remainder = "";
      const attached = /^Nanpa([a-z]+)((?:[ \t]+[A-Z][a-z]*)*)$/.exec(source);
      if (attached) {
        const laterWords = attached[2].trim().split(/[ \t]+/).filter(Boolean);
        remainder = attached[1] + laterWords.join("");
      } else if (/^Nanpa(?:[ \t]+[A-Z][a-z]*)+$/.test(source)) {
        remainder = source.split(/[ \t]+/).slice(1).join("");
      } else return null;

      if (!remainder || !/[nN]$/.test(remainder)) return null;
      let core = remainder.slice(0, -1);
      if (core.length < 2 || (core.length % 2) !== 0) return null;

      let hasPercent = false;
      if (/noke$/i.test(core)) {
        hasPercent = true;
        core = core.slice(0, -4);
        if (core.length < 2 || (core.length % 2) !== 0) return null;
      }

      let bodyCaps = core.toUpperCase();
      if (bodyCaps.startsWith("NE")) bodyCaps = "NS" + bodyCaps.slice(2);
      const caps = "NE" + bodyCaps + (hasPercent ? "OKN" : "N");
      try {
        const tokens = tokenizeNanpaCaps(caps);
        return nanpaCapsHasAtLeastOneDigitToken(tokens) ? caps : null;
      } catch { return null; }
    }

    function nanpaLinjanProperNameToCaps(raw) {
      const source = String(raw ?? "").trim();
      if (!source) return null;

      const nanpaColonCaps = nanpaColonProperNameToCaps(source);
      if (nanpaColonCaps) return nanpaColonCaps;

      if (!/^[A-Za-z]+(?:\s+[A-Za-z]+)*$/.test(source)) return null;

      const words = source.split(/\s+/).filter(Boolean);
      const compact = words.join("");
      if (!compact || !/[nN]$/.test(compact)) return null;

      let core = compact.slice(0, -1);
      if (core.length < 2 || (core.length % 2) !== 0) return null;

      let hasPercent = false;
      if (/noke$/i.test(core)) {
        hasPercent = true;
        core = core.slice(0, -4);
        if (core.length < 2 || (core.length % 2) !== 0) return null;
      }

      let coreCaps = core.toUpperCase();
      if (!coreCaps.startsWith("NE")) return null;

      // An initial contiguous "Nene" is the explicit leading plus, whether the
      // first digit syllable is attached (Nenewan...) or separated (Nene Wan...).
      // Keep "N Ene ..." available as the existing no-value spacer.
      if (/^nene/i.test(source) && coreCaps.startsWith("NENE")) {
        coreCaps = "NENS" + coreCaps.slice(4);
      }

      return hasPercent ? (coreCaps + "OKN") : (coreCaps + "N");
    }

    function isValidNanpaLinjanProperName(raw) {
      const caps = nanpaLinjanProperNameToCaps(raw);
      if (!caps) return false;
      try { tokenizeNanpaCaps(caps); return true; }
      catch { return false; }
    }

    const NUMBER_CODE_LETTER_TO_PAIR = {
      "I":"NI","W":"WE","T":"TE","S":"SE","A":"NA",
      "L":"LE","U":"NU","M":"ME","P":"PE","J":"JE"
    };

    function normalizeNumberCodeInput(raw) {
      return String(raw ?? "").trim().replace(/\s+/g, "");
    }

    function tryParseNanpaLinjanNumberCodeToCaps(raw) {
      const s0 = normalizeNumberCodeInput(raw);
      if (!s0) return null;
      if (!s0.toUpperCase().startsWith("#~")) return null;

      let rawBody = s0.slice(2);
      if (!rawBody) throw new Error("Number code '#~' must have content after it.");

      // Explicit positive input accepts either the legacy literal + or the
      // canonical single leading e. A single leading e is positive only when
      // immediately followed by a digit-code letter. An even leading e-run is
      // left untouched as one or more no-value spacers; odd leading runs greater
      // than one are invalid at the start (scientific EKO is only non-initial).
      let hasLeadingPlus = false;
      if (rawBody.startsWith("+")) {
        hasLeadingPlus = true;
        rawBody = rawBody.slice(1);
        if (!rawBody) throw new Error("Leading plus in number code must be followed immediately by a digit code.");
      }

      let body = rawBody.toUpperCase();
      if (!/^[A-Z]+$/.test(body)) throw new Error("Number code may contain only one optional leading '+' followed by letters A–Z.");

      const leadingECount = /^E+/.exec(body)?.[0]?.length || 0;
      if (hasLeadingPlus) {
        if (!NUMBER_CODE_LETTER_TO_PAIR[body[0]]) {
          throw new Error("Leading plus in number code must be followed immediately by a digit code.");
        }
      } else if (leadingECount === 1) {
        if (!NUMBER_CODE_LETTER_TO_PAIR[body[1]]) {
          throw new Error("A single leading 'e' positive marker must be followed immediately by a digit code.");
        }
        hasLeadingPlus = true;
        body = body.slice(1);
      } else if (leadingECount > 1 && (leadingECount % 2) === 1) {
        throw new Error("At the start of a number code, 'e' must be either one positive marker before a digit or an even no-value-spacer run.");
      }

      // NEW: treat trailing "OK" as percent marker token (not O-then-K operators)
      let hasPercent = false;
      if (body.endsWith("OK")) {
        hasPercent = true;
        body = body.slice(0, -2);
        if (!body) throw new Error("Number code '#~' cannot be only 'OK' (no numeric content).");
      }

      const tokens = ["NE"];
      if (hasLeadingPlus) tokens.push("NS");
      let i = 0;

      const legacyScientificMarkerIndex = body.indexOf("KOWIKO");
      const hasLegacyScientificNumberCodeMarker =
        legacyScientificMarkerIndex > 0 &&
        body[legacyScientificMarkerIndex - 1] !== "O" &&
        (legacyScientificMarkerIndex + "KOWIKO".length) < body.length;

      function ensureNEBeforeOperatorRun() {
        if (tokens[tokens.length - 1] !== "NE") tokens.push("NE");
      }

      while (i < body.length) {
        const ch = body[i];

        // OKO in the middle of a sequence = short mixed-number separator (NOKO)
        // Must be checked before the O handler so it's consumed as a unit.
        // Note: trailing OK (percent marker) is already stripped before this loop,
        // so OKO here is unambiguous.
        if (body.startsWith("OKO", i)) {
          tokens.push("NOKO");
          i += 3;
          continue;
        }

        // A consecutive E run is parsed from left to right in pairs. Each EE
        // is one exact NENE no-value spacer. If the run has one E left over,
        // that final E is valid only as the start of EKO, the scientific marker.
        // Examples: EE -> one spacer; EEEE -> two spacers; EEEKO -> spacer + EKO.
        if (ch === "E") {
          let j = i;
          while (j < body.length && body[j] === "E") j++;
          const count = j - i;
          const spacerCount = Math.floor(count / 2);

          for (let spacerIndex = 0; spacerIndex < spacerCount; spacerIndex++) {
            tokens.push("NE", "NE");
          }

          if ((count % 2) === 1) {
            const scientificMarkerIndex = j - 1;
            const hasFollowingKo = body.startsWith("KO", j);
            const hasContentBefore = scientificMarkerIndex > 0;
            const hasContentAfter = (j + 2) < body.length;

            if (!hasFollowingKo || !hasContentBefore || !hasContentAfter) {
              throw new Error("An odd run of 'E' in number code must end with a valid EKO scientific marker.");
            }

            // The unpaired E contributes its own NE, even when a preceding EE
            // spacer already left NE as the previous token.
            tokens.push("NE", "KO");
            i = j + 2;
          } else {
            i = j;
          }
          continue;
        }

        // Backward compatibility: the previous #~ signature KOWIKO remains valid.
        // A bare KO elsewhere keeps its older meaning as K + O. For example,
        // #~WIkooS must continue to decode as 10,000/3, not 10^3.
        // #~JokoWIkooS must also stay integer+fraction because KOWIKO is part of OKO.
        if (
          hasLegacyScientificNumberCodeMarker &&
          body.startsWith("KO", i) &&
          (i === legacyScientificMarkerIndex || i === legacyScientificMarkerIndex + 4)
        ) {
          ensureNEBeforeOperatorRun();
          tokens.push("KO");
          i += 2;
          continue;
        }

        if (ch === "O") {
          let j = i;
          while (j < body.length && body[j] === "O") j++;
          const count = j - i;
          if (count < 1 || count > 3) throw new Error("Invalid run of 'O' in number code (max 3).");

          if (count === 1) {
            if (i === 0 || tokens[tokens.length - 1] === "KO") tokens.push("NO");
            else tokens.push("NO","NE");
          } else {
            tokens.push("NO".repeat(count)); // NONO / NONONO
          }

          i = j;
          continue;
        }

        if (ch === "K") {
          let j = i;
          while (j < body.length && body[j] === "K") j++;
          const count = j - i;
          if (count < 1) throw new Error("Invalid empty run of 'K' in number code.");

          ensureNEBeforeOperatorRun();
          // K-runs encode repeated base-1000 boundaries. Keep the complete run;
          // tokenization and rendering support any number of consecutive KE pairs.
          tokens.push("KE".repeat(count));
          i = j;
          continue;
        }

        const pair = NUMBER_CODE_LETTER_TO_PAIR[ch];
        if (!pair) throw new Error(`Invalid letter '${ch}' in number code.`);
        tokens.push(pair);
        i += 1;
      }

      // NEW: insert OK *before* final N terminator
      if (hasPercent) tokens.push("OK");

      tokens.push("N");

      const caps = canonicalizeScientificNanpaCaps(tokens.join(""));
      tokenizeNanpaCaps(caps);
      return { caps };
    }

    const TOKEN_TO_DIGIT_CHAR = {
      "NI":"0","WE":"1","WA":"1","TE":"2","TU":"2","SE":"3","NA":"4",
      "LE":"5","LU":"5","NU":"6","ME":"7","MU":"7","PE":"8","PI":"8","JE":"9"
    };

    const TOKEN_TO_DIGIT_WORD = {
      "NI":"ijo","WE":"wan","WA":"wan","TE":"tu","TU":"tu","SE":"seli","NA":"awen",
      "LE":"luka","LU":"luka","NU":"utala","ME":"mun","MU":"mun","PE":"pipi","PI":"pipi","JE":"jo"
    };

    const WORD_FOR_NEGATIVE_SIGN = "ona";

    function nanpaCapsTokensToTpWords(tokens, { mode = "traditional" } = {}) {
      if (!tokens || tokens.length === 0) return [];

      const uniform = (mode === "uniform");
      const out = [];

      const E_WORD = uniform ? "e" : "esun";
      const E_WORD_FOR_NE_AFTER_START = "e";
      const N_WORD = uniform ? "nena" : "nasa";

      const N_WORD_DECIMAL_POINT = uniform ? "nena" : "ni";
      const N_WORD_FRACTION = "nena";
      const N_END_WORD = "nanpa";

      let afterStartingNe = false;
      let afterScientificMarker = false;

      for (let i = 0; i < tokens.length; i++) {
        const t = tokens[i];

        if (t === "NE") {
          const nxt = (i + 1 < tokens.length) ? tokens[i + 1] : null;
          if (nxt === "KO") {
            if (out.length === 0) {
              if (getNanpaColonRendering()) out.push("nanpa", ":", "kala", "open");
              else out.push("nanpa", E_WORD, "kala", "open");
            } else out.push(N_WORD, E_WORD_FOR_NE_AFTER_START, "kala", "open");
            afterStartingNe = false;
            afterScientificMarker = true;
            i += 1;
            continue;
          }

          afterScientificMarker = false;
          if (out.length === 0) {
            if (getNanpaColonRendering()) out.push("nanpa", ":");
            else out.push("nanpa", E_WORD);
            afterStartingNe = true;
          } else {
            out.push(N_WORD, E_WORD_FOR_NE_AFTER_START);
            afterStartingNe = false;
          }
          continue;
        }

        if (t === "NS") {
          // Dedicated explicit-leading-positive token. The canonical full
          // cartouche opening is: nanpa e nena en ...
          out.push("nena", "en");
          afterStartingNe = false;
          afterScientificMarker = false;
          continue;
        }

        if (DIGIT_TOKENS.has(t)) {
          afterStartingNe = false;
          afterScientificMarker = false;

          if (getRelaxedNanpaLinjanRendering() && RELAXED_TOKEN_TO_RENDER_WORDS[t]) {
            out.push(...RELAXED_TOKEN_TO_RENDER_WORDS[t]);
            continue;
          }

          const strictToken = RELAXED_TOKEN_TO_STRICT_TOKEN[t] || t;
          const digitWord = TOKEN_TO_DIGIT_WORD[strictToken];
          if (strictToken === "NI" || strictToken === "NA" || strictToken === "NU") out.push(N_WORD, digitWord);
          else out.push(digitWord, E_WORD);
          continue;
        }

        if (t === "NO") {
          if (afterStartingNe || afterScientificMarker) {
            out.push(N_WORD, WORD_FOR_NEGATIVE_SIGN);
            afterStartingNe = false;
            afterScientificMarker = false;
            continue;
          }

          const nxt = (i + 1 < tokens.length) ? tokens[i + 1] : null;
          if (nxt === "NE") {
            out.push(N_WORD_DECIMAL_POINT, "o", N_WORD, E_WORD_FOR_NE_AFTER_START);
            afterStartingNe = false;
            i += 1;
            continue;
          }

          out.push(N_WORD_DECIMAL_POINT, "o");
          afterStartingNe = false;
          continue;
        }

        if (t === "NONO") {
          out.push("nena","o","nena","o");
          afterStartingNe = false;
          continue;
        }

        if (t === "NOKO") {
          out.push("nena","open","kin","open");
          afterStartingNe = false;
          continue;
        }

        if (t === "NONONO") {
          out.push(N_WORD,"o",N_WORD,"o",N_WORD,"o");
          afterStartingNe = false;
          continue;
        }

        if (t === "KE") { out.push("kulupu", E_WORD_FOR_NE_AFTER_START); afterStartingNe=false; continue; }
        if (t === "KEKE") { out.push("kulupu",E_WORD_FOR_NE_AFTER_START,"kulupu",E_WORD_FOR_NE_AFTER_START); afterStartingNe=false; continue; }
        if (t === "KEKEKE") { out.push("kulupu",E_WORD_FOR_NE_AFTER_START,"kulupu",E_WORD_FOR_NE_AFTER_START,"kulupu",E_WORD_FOR_NE_AFTER_START); afterStartingNe=false; continue; }

        if (t === "N") { out.push(N_END_WORD); afterStartingNe=false; continue; }

        throw new Error(`Unknown token "${t}"`);
      }

      return out;
    }

    // Time cartouche: rewrite the NE+KE delimiter expansion so the glyph shows kolon (:) not kulupu.
    // This preserves the surrounding "NE scaffolding" (nena/en ... join) and only swaps the delimiter word.
    function replaceTimeSeparatorsTpWords(tpWords, mode) {
      const join = "e";
      const nWord = (mode === "uniform") ? "nena" : "nasa";
      const pattern = [nWord, join, "kulupu", join];

      const out = [];
      for (let i = 0; i < tpWords.length; ) {
        const isMatch =
          i + pattern.length <= tpWords.length &&
          pattern.every((w, k) => tpWords[i + k] === w);

        if (isMatch) {
          // IMPORTANT: output "nena en kolon en" (or "nasa e kolon e"), not just "kolon"
          // IMPORTANT: output "nena en kasi en" (or "nasa e kasi e"), not just "kasi"
          out.push(nWord, join, "kasi", join);
          i += pattern.length;
        } else {
          out.push(tpWords[i]);
          i += 1;
        }
      }
      return out;
    }

    function nanpaCapsToNanpaLinjanCodepoints(caps, { mode = "traditional", isTime = false } = {}) {
      let canonicalCaps = canonicalizeScientificNanpaCaps(caps);
      if (isTime && nanpaCapsIsValidTime(canonicalCaps)) {
        canonicalCaps = normalizeTimeNegativeZeroCaps(canonicalCaps);
      }
      const tokens = tokenizeNanpaCaps(canonicalCaps);
      if (!nanpaCapsHasAtLeastOneDigitToken(tokens)) return null;

      // Consume OK as a flag (your earlier change)
      let hasPercent = false;
      const tokensNoOk = [];
      for (const t of tokens) {
        if (t === "OK") { hasPercent = true; continue; }
        tokensNoOk.push(t);
      }

            
      const tpWords = nanpaCapsTokensToTpWords(tokensNoOk, { mode });
      const tpWordsFinal = isTime ? replaceTimeSeparatorsTpWords(tpWords, mode) : tpWords;


      const cps = [];
      for (const w of tpWordsFinal) {
        const cp = NANPA_LINJA_N_WORD_TO_CP[w];
        if (cp == null) return null;
        cps.push(cp);
      }

      // Keep existing uniformization behavior
      const out = (mode === "uniform") ? uniformizeNanpaLinjanCartoucheCps(cps) : cps;

      // NEW: mode-aware percent marker (insert before final "nanpa")
      if (hasPercent) {
        const suffixWords = (mode === "uniform")
          ? ["nena", "open", "kipisi", "e"]
          : ["noka", "open", "kipisi", "e"];   // FIX: noka (not nasa)

        const suffixCps = [];
        for (const w of suffixWords) {
          const cp = NANPA_LINJA_N_WORD_TO_CP[w];
          if (cp == null) return null;
          suffixCps.push(cp);
        }

        // Insert before the closing nanpa, if present
        const lastNanpaIdx = out.lastIndexOf(CP_NANPA);
        if (lastNanpaIdx >= 0) out.splice(lastNanpaIdx, 0, ...suffixCps);
        else out.push(...suffixCps);
      }


      return out;
    }



    function tryDecodeNanpaLinjanIdentifierToCodepoints(rawText, { mode = "traditional" } = {}) {
      const s = String(rawText ?? "").trim();
      if (!s) return null;

      try {
        const parsed = tryParseNanpaLinjanNumberCodeToCaps(s);
        if (parsed?.caps) {
          const isTime = nanpaCapsIsValidTimeOrDate(parsed.caps);
          return nanpaCapsToNanpaLinjanCodepoints(parsed.caps, { mode, isTime });
        }
      } catch {
        return null;
      }

      if (!isValidNanpaLinjanProperName(s)) return null;

      const caps = nanpaLinjanProperNameToCaps(s);
      if (!caps) return null;

      const isTime = nanpaCapsIsValidTimeOrDate(caps);
      return nanpaCapsToNanpaLinjanCodepoints(caps, { mode, isTime });

    }

    /* ============================================================
       Decimal recognizer + caps encoder
       ============================================================ */
    const VULGAR_FRACTIONS = new Map([
      ["¼", [1, 4]], ["½", [1, 2]], ["¾", [3, 4]],
      ["⅐", [1, 7]], ["⅑", [1, 9]], ["⅒", [1, 10]],
      ["⅓", [1, 3]], ["⅔", [2, 3]],
      ["⅕", [1, 5]], ["⅖", [2, 5]], ["⅗", [3, 5]], ["⅘", [4, 5]],
      ["⅙", [1, 6]], ["⅚", [5, 6]],
      ["⅛", [1, 8]], ["⅜", [3, 8]], ["⅝", [5, 8]], ["⅞", [7, 8]],
      ["↉", [0, 3]],
    ]);

    function normalizeVulgarFractionInput(raw) {
      if (raw == null) return "";
      let s = String(raw).trim();
      if (!s) return s;

      s = s.replace(/\u2044/g, "/");

      let found = null;
      for (const ch of s) {
        if (VULGAR_FRACTIONS.has(ch)) { found = ch; break; }
      }
      if (!found) return s;

      const lastChar = s.slice(-1);
      if (!VULGAR_FRACTIONS.has(lastChar)) {
        throw new Error("Vulgar fraction characters must appear at the end (e.g., 9¾ or ¾).");
      }

      if (s.slice(1).includes("-") || s.slice(1).includes("+")) {
        throw new Error("A sign is allowed only once, at the start.");
      }

      const [num, den] = VULGAR_FRACTIONS.get(lastChar);
      const prefixRaw = s.slice(0, -1).trim();

      if (!prefixRaw) return `${num}/${den}`;

      const sign = prefixRaw.startsWith("-") ? "-" : (prefixRaw.startsWith("+") ? "+" : "");
      const prefix = sign ? prefixRaw.slice(1).trim() : prefixRaw;

      if (!prefix) return `${sign}${num}/${den}`;

      return `${sign}${prefix}+${num}/${den}`;
    }

    function looksLikeNanpaCaps(s) {
      if (!s) return false;
      const t = String(s).trim();
      if (!t) return false;
      if (!/^[A-Za-z]+[Nn]$/.test(t)) return false;
      return t.slice(0, 2).toUpperCase() === "NE";
    }

    function groupFractionDigitsOnly(s, decimalChar=".", groupSize=3, sepChar="_") {
      const str = String(s);
      const idx = str.indexOf(decimalChar);
      if (idx < 0) return str;

      const left = str.slice(0, idx);
      const right = str.slice(idx + 1);

      let i = 0;
      while (i < right.length && /[0-9]/.test(right[i])) i++;
      const fracDigits = right.slice(0, i);
      const suffix = right.slice(i);

      if (fracDigits.length <= groupSize) return str;
      if (sepChar && fracDigits.includes(sepChar)) return str;

      const groups = [];
      for (let j = 0; j < fracDigits.length; j += groupSize) {
        groups.push(fracDigits.slice(j, j + groupSize));
      }
      return `${left}${decimalChar}${groups.join(sepChar)}${suffix}`;
    }

    function normalizeLooseSeparators(raw) {
      if (raw == null) return "";
      let s = String(raw);

      s = s.replace(/[−‒–—]/g, "-");

      const isNeg = s.startsWith("-");
      const head = isNeg ? "-" : "";
      const rest = isNeg ? s.slice(1) : s;

      let r = rest.replace(/\s+/g, " ");
      r = r.replace(/-+/g, "-");

      return (head + r).trim();
    }


    /* ============================================================
       Optional nasin nanpa pona conversion
       ============================================================ */
    function nasinNanpaPonaBase100GroupToWords(groupValue) {
      let n = Number(groupValue);
      if (!Number.isInteger(n) || n < 0 || n > 99) return null;

      const words = [];
      while (n >= 20) { words.push("mute"); n -= 20; }
      while (n >= 5)  { words.push("luka"); n -= 5; }
      while (n >= 2)  { words.push("tu"); n -= 2; }
      if (n === 1) words.push("wan");
      return words;
    }

    function nasinNanpaPonaGroupedDigitsToWords(digitGroups) {
      const groups = Array.from(digitGroups ?? []);
      const words = [];

      for (let i = 0; i < groups.length; i++) {
        const groupText = String(groups[i] ?? "");
        if (!/^\d{1,2}$/.test(groupText)) return null;
        const groupWords = nasinNanpaPonaBase100GroupToWords(Number(groupText));
        if (!groupWords) return null;
        words.push(...groupWords);
        if (i < groups.length - 1) words.push("ale");
      }

      return words;
    }

    function splitDigitsIntoBase100GroupsFromRight(digits) {
      const s = String(digits ?? "");
      if (!/^\d+$/.test(s)) return null;
      const groups = [];
      for (let end = s.length; end > 0; end -= 2) {
        groups.unshift(s.slice(Math.max(0, end - 2), end));
      }
      return groups;
    }

    function splitDigitsIntoBase100GroupsFromLeft(digits) {
      let s = String(digits ?? "");
      if (!/^\d+$/.test(s)) return null;
      if ((s.length % 2) !== 0) s += "0";
      const groups = [];
      for (let i = 0; i < s.length; i += 2) groups.push(s.slice(i, i + 2));
      return groups;
    }

    function nasinNanpaPonaHitHasStandaloneNumericContext(sourceText, hit) {
      const s = String(sourceText ?? "");
      const start = Number(hit?.index);
      const end = Number(hit?.end);
      if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end <= start || end > s.length) return false;

      const before = start > 0 ? s[start - 1] : "";
      const after = end < s.length ? s[end] : "";
      const numericJoiner = /[A-Za-z0-9+\-−‒–—\/%:^*_]/;

      if (before && (numericJoiner.test(before) || before === ".")) return false;
      if (after && numericJoiner.test(after)) return false;

      // A single trailing full stop may be ordinary sentence punctuation. A
      // following decimal-like continuation means the scanner found only a
      // fragment of a malformed larger expression, so decline conversion.
      if (after === ".") {
        const afterNext = (end + 1 < s.length) ? s[end + 1] : "";
        if (afterNext === "." || /[0-9]/.test(afterNext)) return false;
      }

      return true;
    }

    function tryConvertPlainDecimalToNasinNanpaPonaWords(rawValue) {
      let raw = String(rawValue ?? "").trim().replace(/[−‒–—]/g, "-");
      if (!raw) return null;

      // Accept one plain integer/decimal expression, optionally using correctly
      // placed comma thousands separators in the integer part. Structured formats
      // (dates, times, fractions, percentages, scientific notation, magnitude
      // suffixes, invalid comma grouping, and loose separators) decline this path
      // and retain their established parser behavior.
      const m = raw.match(/^(-)?(?:(0|[1-9]\d*|[1-9]\d{0,2}(?:,\d{3})+)(?:\.(\d+))?|\.(\d+))$/);
      if (!m) return null;

      const negative = !!m[1];
      const integerDigits = (m[2] != null) ? m[2].replace(/,/g, "") : "0";
      let fractionDigits = (m[3] != null) ? m[3] : ((m[4] != null) ? m[4] : "");

      // nasin nanpa pona is value-based here: written fractional precision is
      // not preserved, so 1.2, 1.20, and 1.2000 are equivalent.
      fractionDigits = fractionDigits.replace(/0+$/, "");

      const isZero = integerDigits === "0" && fractionDigits === "";
      if (isZero) return { words: ["ala"] };

      const integerGroups = splitDigitsIntoBase100GroupsFromRight(integerDigits);
      if (!integerGroups) return null;

      let integerWords;
      if (integerDigits === "0") integerWords = ["ala"];
      else integerWords = nasinNanpaPonaGroupedDigitsToWords(integerGroups);
      if (!integerWords) return null;

      const words = [];
      if (negative) words.push("weka");
      words.push(...integerWords);

      if (fractionDigits) {
        const fractionGroups = splitDigitsIntoBase100GroupsFromLeft(fractionDigits);
        const fractionWords = nasinNanpaPonaGroupedDigitsToWords(fractionGroups);
        if (!fractionWords) return null;
        words.push("ala", ...fractionWords);
      }

      return { words };
    }

    const STRICT_DEC_DIGIT_TO_TOKEN = {
      "0": "NI", "1": "WE", "2": "TE", "3": "SE", "4": "NA",
      "5": "LE", "6": "NU", "7": "ME", "8": "PE", "9": "JE",
    };

    const RELAXED_DEC_DIGIT_TO_TOKEN = {
      "0": "NI", "1": "WA", "2": "TU", "3": "SE", "4": "NA",
      "5": "LU", "6": "NU", "7": "MU", "8": "PI", "9": "JE",
    };

    function decimalDigitToNanpaToken(ch) {
      const map = getRelaxedNanpaLinjanParsing()
        ? RELAXED_DEC_DIGIT_TO_TOKEN
        : STRICT_DEC_DIGIT_TO_TOKEN;
      return map[String(ch)];
    }


    function normalizeDateTimeInput(raw) {
      let s = String(raw ?? "").trim();

      // dates/times: remove internal whitespace
      s = s.replace(/\s+/g, "");

      // Normalize common unicode variants (copy/paste-safe)
      // Hyphen/minus variants -> "-"
      s = s.replace(/[\u2010\u2011\u2012\u2013\u2014\u2212\uFE63\uFF0D]/g, "-");
      // Slash variants -> "/"
      s = s.replace(/[\u2044\u2215\uFF0F]/g, "/");
      // Fullwidth colon -> ":"
      s = s.replace(/[\uFF1A]/g, ":");

      return s;
    }

    /* ============================================================
      Time recognizer + caps encoder

      Accepted text forms:
      - H:MM / HH:MM
      - H:MM:SS[.f|.ff|.fff] / HH:MM:SS[.f|.ff|.fff]
      - D:HH:MM
      - D:HH:MM:SS[.f|.ff|.fff]

      D is any signed or unsigned integer. A leading minus applies to
      the complete duration and is retained for -0 days whenever a later
      component is non-zero. Complete negative zero is normalized to zero.
      ============================================================ */
    function tryParseTimeParts(raw) {
      const s = String(raw ?? "").trim();
      if (!s || /\s/.test(s)) return null;

      const fields = s.split(":");
      if (fields.length < 2 || fields.length > 4) return null;

      const firstMatch = fields[0].match(/^([+-]?)(\d+)$/);
      if (!firstMatch) return null;

      const sign = firstMatch[1];
      const firstDigits = firstMatch[2];

      function isClockPair(value) {
        return /^[0-5]\d$/.test(String(value ?? ""));
      }

      function parseSeconds(value) {
        const m = String(value ?? "").match(/^([0-5]\d)(?:\.(\d{1,3}))?$/);
        if (!m) return null;
        return { ssStr: m[1], fractionStr: m[2] ?? null };
      }

      function hasAnyNonZeroDigit(...values) {
        return /[1-9]/.test(values.filter(v => v != null).join(""));
      }

      // Existing time form: H:MM or HH:MM.
      if (fields.length === 2) {
        if (sign) return null;
        if (!/^\d{1,2}$/.test(firstDigits) || !isClockPair(fields[1])) return null;
        const hh = parseInt(firstDigits, 10);
        if (!Number.isFinite(hh) || hh < 0 || hh > 59) return null;
        return {
          hasDays: false,
          negative: false,
          dayStr: null,
          hhStr: firstDigits,
          mmStr: fields[1],
          ssStr: null,
          fractionStr: null,
        };
      }

      // A fractional final component in a three-field value is unambiguously
      // the existing H:MM:SS.f form. Signed values require an explicit day
      // field and therefore use four fields when fractional seconds are present.
      if (fields.length === 3) {
        const finalSeconds = parseSeconds(fields[2]);
        if (finalSeconds?.fractionStr != null) {
          if (sign) return null;
          if (!/^\d{1,2}$/.test(firstDigits) || !isClockPair(fields[1])) return null;
          const hh = parseInt(firstDigits, 10);
          if (!Number.isFinite(hh) || hh < 0 || hh > 59) return null;
          return {
            hasDays: false,
            negative: false,
            dayStr: null,
            hhStr: firstDigits,
            mmStr: fields[1],
            ssStr: finalSeconds.ssStr,
            fractionStr: finalSeconds.fractionStr,
          };
        }

        // Expanded form: D:HH:MM. For an unsigned one- or two-digit first
        // component this overlaps the legacy H:MM:SS spelling, but the encoded
        // and rendered colon-separated cartouche is identical.
        if (!isClockPair(fields[1]) || !isClockPair(fields[2])) return null;
        const negative = sign === "-" && hasAnyNonZeroDigit(firstDigits, fields[1], fields[2]);
        return {
          hasDays: true,
          negative,
          dayStr: firstDigits,
          hhStr: fields[1],
          mmStr: fields[2],
          ssStr: null,
          fractionStr: null,
        };
      }

      // Expanded form: D:HH:MM:SS[.f|.ff|.fff].
      if (!isClockPair(fields[1]) || !isClockPair(fields[2])) return null;
      const seconds = parseSeconds(fields[3]);
      if (!seconds) return null;

      const negative = sign === "-" && hasAnyNonZeroDigit(
        firstDigits,
        fields[1],
        fields[2],
        seconds.ssStr,
        seconds.fractionStr
      );

      return {
        hasDays: true,
        negative,
        dayStr: firstDigits,
        hhStr: fields[1],
        mmStr: fields[2],
        ssStr: seconds.ssStr,
        fractionStr: seconds.fractionStr,
      };
    }

    function encodeDigitsOnly(digits) {
      const s = String(digits ?? "");
      if (!/^\d+$/.test(s)) throw new Error(`Expected only digits, got "${digits}"`);
      let out = "";
      for (const ch of s) {
        const tok = decimalDigitToNanpaToken(ch);
        if (!tok) throw new Error(`Unsupported digit "${ch}"`);
        out += tok;
      }
      return out;
    }


    // ============================
    // Date support (YYYY{sep}MM{sep}DD)
    // ============================
    // Valid formats:
    // - YYYY-MM-DD, YYYY/MM/DD
    // Constraints:
    // - YYYY exactly 4 digits (0000-9999 allowed)
    // - MM 01-12
    // - DD 01-31
    function tryParseDateParts(raw) {
      const s = normalizeDateTimeInput(raw);
      const m = s.match(/^(\d{4})([\/-])(\d{2})\2(\d{2})$/);
      if (!m) return null;

      const yyyyStr = m[1];
      const mmStr = m[3];
      const ddStr = m[4];

      const mm = parseInt(mmStr, 10);
      const dd = parseInt(ddStr, 10);

      if (!(mm >= 1 && mm <= 12)) return null;
      if (!(dd >= 1 && dd <= 31)) return null;

      return { yyyyStr, mmStr, ddStr };
    }

    function dateStrToNanpaCaps(raw) {
      const parts = tryParseDateParts(raw);
      if (!parts) return null;

      let caps = "NE";
      caps += encodeDigitsOnly(parts.yyyyStr);
      caps += "NEKE";
      caps += encodeDigitsOnly(parts.mmStr);
      caps += "NEKE";
      caps += encodeDigitsOnly(parts.ddStr);
      caps += "N";

      tokenizeNanpaCaps(caps); // sanity-check
      return caps;
    }

    // Returns nanpa-caps for a valid time, else null. Component delimiters use
    // NEKE so the established proper-name, abbreviated-code, and renderer paths
    // continue to share one canonical representation. Fractional seconds use
    // the ordinary NO+NE decimal marker, which renders with the scaled o glyph.
    function timeStrToNanpaCaps(raw) {
      const parts = tryParseTimeParts(raw);
      if (!parts) return null;

      let caps = "NE";
      if (parts.negative) caps += "NO";

      if (parts.hasDays) {
        caps += encodeDigitsOnly(parts.dayStr);
        caps += "NEKE";
      }

      caps += encodeDigitsOnly(parts.hhStr);
      caps += "NEKE";
      caps += encodeDigitsOnly(parts.mmStr);

      if (parts.ssStr != null) {
        caps += "NEKE";
        caps += encodeDigitsOnly(parts.ssStr);
        if (parts.fractionStr != null) {
          caps += "NO";
          caps += "NE";
          caps += encodeDigitsOnly(parts.fractionStr);
        }
      }

      caps += "N";
      tokenizeNanpaCaps(caps); // sanity-check
      return caps;
    }

    function nanpaCapsLooksLikeTime(caps) {
      return nanpaCapsDecodeTimeStrict(caps) != null;
    }

    function nanpaCapsDecodeTimeStrict(caps) {
      let tokens;
      try { tokens = tokenizeNanpaCaps(String(caps).trim().toUpperCase()); }
      catch { return null; }

      if (!tokens || tokens.length < 2) return null;
      if (tokens[0] !== "NE") return null;
      if (tokens[tokens.length - 1] !== "N") return null;

      const finalIndex = tokens.length - 1;
      let i = 1;
      let negativeInput = false;

      if (tokens[i] === "NO") {
        negativeInput = true;
        i += 1;
      }

      const segments = [];
      while (i < finalIndex) {
        let integerStr = "";
        while (i < finalIndex && DIGIT_TOKENS.has(tokens[i])) {
          const ch = TOKEN_TO_DIGIT_CHAR[tokens[i]];
          if (ch == null) return null;
          integerStr += ch;
          i += 1;
        }
        if (!integerStr) return null;

        let fractionStr = null;
        if (tokens[i] === "NO" && tokens[i + 1] === "NE") {
          i += 2;
          fractionStr = "";
          while (i < finalIndex && DIGIT_TOKENS.has(tokens[i])) {
            const ch = TOKEN_TO_DIGIT_CHAR[tokens[i]];
            if (ch == null) return null;
            fractionStr += ch;
            i += 1;
          }
          if (fractionStr.length < 1 || fractionStr.length > 3) return null;
        }

        segments.push({ integerStr, fractionStr });

        if (i === finalIndex) break;
        if (tokens[i] !== "NE" || tokens[i + 1] !== "KE") return null;
        i += 2;
      }

      if (i !== finalIndex) return null;
      if (segments.length < 2 || segments.length > 4) return null;
      if (segments.slice(0, -1).some(seg => seg.fractionStr != null)) return null;

      function isPairInRange(seg) {
        return !!seg && seg.fractionStr == null && /^[0-5]\d$/.test(seg.integerStr);
      }

      function isSecondsInRange(seg) {
        return !!seg && /^[0-5]\d$/.test(seg.integerStr) &&
          (seg.fractionStr == null || /^\d{1,3}$/.test(seg.fractionStr));
      }

      function normalizedNegative(daySeg, otherSegs) {
        const allDigits = [daySeg.integerStr, ...otherSegs.map(seg => seg.integerStr),
          ...otherSegs.map(seg => seg.fractionStr || "")].join("");
        const isZero = !/[1-9]/.test(allDigits);
        return { negative: negativeInput && !isZero, isZero };
      }

      if (segments.length === 2) {
        if (negativeInput) return null;
        const [hourSeg, minuteSeg] = segments;
        if (hourSeg.fractionStr != null || !/^\d{1,2}$/.test(hourSeg.integerStr)) return null;
        const hh = parseInt(hourSeg.integerStr, 10);
        if (!(hh >= 0 && hh <= 59) || !isPairInRange(minuteSeg)) return null;
        return {
          hasDays: false,
          negativeInput: false,
          negative: false,
          isZero: hh === 0 && minuteSeg.integerStr === "00",
          dayStr: null,
          hhStr: hourSeg.integerStr,
          mmStr: minuteSeg.integerStr,
          ssStr: null,
          fractionStr: null,
        };
      }

      if (segments.length === 3 && segments[2].fractionStr != null) {
        if (negativeInput) return null;
        const [hourSeg, minuteSeg, secondSeg] = segments;
        if (hourSeg.fractionStr != null || !/^\d{1,2}$/.test(hourSeg.integerStr)) return null;
        const hh = parseInt(hourSeg.integerStr, 10);
        if (!(hh >= 0 && hh <= 59) || !isPairInRange(minuteSeg) || !isSecondsInRange(secondSeg)) return null;
        return {
          hasDays: false,
          negativeInput: false,
          negative: false,
          isZero: !/[1-9]/.test(hourSeg.integerStr + minuteSeg.integerStr + secondSeg.integerStr + secondSeg.fractionStr),
          dayStr: null,
          hhStr: hourSeg.integerStr,
          mmStr: minuteSeg.integerStr,
          ssStr: secondSeg.integerStr,
          fractionStr: secondSeg.fractionStr,
        };
      }

      if (segments.length === 3) {
        const [daySeg, hourSeg, minuteSeg] = segments;
        if (daySeg.fractionStr != null || !/^\d+$/.test(daySeg.integerStr)) return null;
        if (!isPairInRange(hourSeg) || !isPairInRange(minuteSeg)) return null;
        const signState = normalizedNegative(daySeg, [hourSeg, minuteSeg]);
        return {
          hasDays: true,
          negativeInput,
          negative: signState.negative,
          isZero: signState.isZero,
          dayStr: daySeg.integerStr,
          hhStr: hourSeg.integerStr,
          mmStr: minuteSeg.integerStr,
          ssStr: null,
          fractionStr: null,
        };
      }

      const [daySeg, hourSeg, minuteSeg, secondSeg] = segments;
      if (daySeg.fractionStr != null || !/^\d+$/.test(daySeg.integerStr)) return null;
      if (!isPairInRange(hourSeg) || !isPairInRange(minuteSeg) || !isSecondsInRange(secondSeg)) return null;
      const signState = normalizedNegative(daySeg, [hourSeg, minuteSeg, secondSeg]);
      return {
        hasDays: true,
        negativeInput,
        negative: signState.negative,
        isZero: signState.isZero,
        dayStr: daySeg.integerStr,
        hhStr: hourSeg.integerStr,
        mmStr: minuteSeg.integerStr,
        ssStr: secondSeg.integerStr,
        fractionStr: secondSeg.fractionStr,
      };
    }

    function normalizeTimeNegativeZeroCaps(caps) {
      const decoded = nanpaCapsDecodeTimeStrict(caps);
      if (!decoded || !decoded.negativeInput || !decoded.isZero) return caps;

      let tokens;
      try { tokens = tokenizeNanpaCaps(String(caps).trim().toUpperCase()); }
      catch { return caps; }
      if (tokens[0] === "NE" && tokens[1] === "NO") tokens.splice(1, 1);
      return tokens.join("");
    }

    function nanpaCapsIsValidTime(caps) {
      return nanpaCapsDecodeTimeStrict(caps) != null;
    }

    function nanpaCapsDecodeDateStrict(caps) {
      let tokens;
      try { tokens = tokenizeNanpaCaps(String(caps).trim().toUpperCase()); }
      catch { return null; }

      if (tokens[0] !== "NE") return null;
      if (tokens[tokens.length - 1] !== "N") return null;

      // Pattern:
      // NE (YYYY digits: 4) NE KE (MM digits: 2) NE KE (DD digits: 2) N
      let i = 1;

      function readDigit() {
        const t = tokens[i];
        const ch = TOKEN_TO_DIGIT_CHAR[t];
        if (ch == null) return null;
        i += 1;
        return ch;
      }

      // YYYY: exactly 4 digits
      const y1 = readDigit(); if (y1 == null) return null;
      const y2 = readDigit(); if (y2 == null) return null;
      const y3 = readDigit(); if (y3 == null) return null;
      const y4 = readDigit(); if (y4 == null) return null;

      // delimiter 1
      if (tokens[i] !== "NE") return null; i++;
      if (tokens[i] !== "KE") return null; i++;

      // MM: exactly 2 digits
      const m1 = readDigit(); if (m1 == null) return null;
      const m2 = readDigit(); if (m2 == null) return null;
      const mmStr = m1 + m2;

      // delimiter 2
      if (tokens[i] !== "NE") return null; i++;
      if (tokens[i] !== "KE") return null; i++;

      // DD: exactly 2 digits
      const d1 = readDigit(); if (d1 == null) return null;
      const d2 = readDigit(); if (d2 == null) return null;
      const ddStr = d1 + d2;

      // must end at final N
      if (i !== tokens.length - 1) return null;

      const mm = parseInt(mmStr, 10);
      const dd = parseInt(ddStr, 10);

      if (!(mm >= 1 && mm <= 12)) return null;
      if (!(dd >= 1 && dd <= 31)) return null;

      return { mm, dd };
    }

    function nanpaCapsIsValidDate(caps) {
      return nanpaCapsDecodeDateStrict(caps) != null;
    }

    function nanpaCapsIsValidTimeOrDate(caps) {
      // Date precedence is intentional: future time grammars may overlap valid
      // date shapes, so a valid date must be claimed before testing as a time.
      return nanpaCapsIsValidDate(caps) || nanpaCapsIsValidTime(caps);
    }

    function maskNumericScanRanges(text, hits) {
      const s = String(text ?? "");
      if (!s || !Array.isArray(hits) || hits.length === 0) return s;

      const chars = s.split("");
      for (const hit of hits) {
        const start = Math.max(0, hit?.index | 0);
        const end = Math.min(chars.length, Math.max(start, hit?.end | 0));
        for (let i = start; i < end; i++) chars[i] = NUMERIC_SCAN_HARD_BOUNDARY_CHAR;
      }
      return chars.join("");
    }

    function findTimeSequencesWithCaps(text) {
      const s = String(text ?? "");
      if (!s) return [];

      // No lookbehind: capture a non-digit boundary (or start-of-string) in group 1.
      // Candidate validation is delegated to timeStrToNanpaCaps so malformed
      // ranges and fractional-second precision are rejected as complete values.
      const re = /(^|[^0-9])([+-]?\d+(?::\d{2}){1,3}(?:\.\d{1,3})?)(?![0-9.:])/g;

      const out = [];
      let m;
      while ((m = re.exec(s)) !== null) {
        // With the boundary-capture regex, the time is in group 2.
        const lead = m[1] ?? "";
        const raw = m[2];
        if (!raw) continue;
        // Do not reinterpret the right-hand side of an arithmetic sign as a
        // standalone time when the sign was consumed as the boundary.
        if ((lead === "-" || lead === "+") && !/^[+-]/.test(raw)) continue;
        // Do not accept a valid-looking suffix cut from a malformed longer
        // colon/decimal sequence.
        if (lead === ":" || lead === ".") continue;

        // m.index points at the start of the whole match (including the lead char),
        // so we offset by the captured lead length.
        const start = (m.index | 0) + String(lead).length;
        const end = start + raw.length;

        const caps = timeStrToNanpaCaps(raw);
        if (caps != null) out.push({ kind: "time", match: raw, index: start, end, caps });
      }
      return out;
    }

    function findDateSequencesWithCaps(text) {
      const s = String(text ?? "");
      if (!s) return [];

      // No lookbehind: boundary in group 1, date in group 2.
      // Colon-separated values are reserved exclusively for time parsing.
      const re = /(^|[^0-9])(\d{4}[\/-]\d{2}[\/-]\d{2})(?!\d)/g;

      const out = [];
      let m;
      while ((m = re.exec(s)) !== null) {
        const lead = m[1] ?? "";
        const raw = m[2];
        if (!raw) continue;

        const start = (m.index | 0) + String(lead).length;
        const end = start + raw.length;

        const caps = dateStrToNanpaCaps(raw);
        if (caps != null) out.push({ kind: "date", match: raw, index: start, end, caps });
      }
      return out;
    }

    function numberStrToNanpaCaps(
      s,
      { thousandsChar = ",", groupFractionTriplets = true, fractionGroupSize = 3, mixedStyle = "short" } = {}
    ) {
      if (s == null) throw new Error("s must be a string");
      let raw = normalizeLooseSeparators(String(s));
      if (!raw) throw new Error("Empty value cannot be encoded");

      if (groupFractionTriplets) {
        raw = groupFractionDigitsOnly(raw, ".", fractionGroupSize, "_");
      }

      let hasLeadingPlus = false;
      if (raw.startsWith("+")) {
        hasLeadingPlus = true;
        raw = raw.slice(1).trim();
        if (!raw) throw new Error("Missing numeric part after leading '+' sign");
      }

      function stripFinalTerminator(segCaps) {
        if (!segCaps) return segCaps;
        if (!segCaps.endsWith("N")) throw new Error(`Segment caps did not end with 'N': ${segCaps}`);
        return segCaps.slice(0, -1);
      }

      function encodeSingleNumberSegment(segment, includeInitialNe, includeLeadingPlus = false) {
        let seg = String(segment).trim();
        if (seg === "") throw new Error(`Empty numeric segment in ${s}`);

        if (seg.slice(0, 1).toUpperCase() === "N") {
          seg = seg.slice(1).trim();
          if (seg === "") throw new Error(`Missing numeric part after leading 'N' prefix in ${s}`);
        }

        const out = [];
        if (includeInitialNe) out.push("NE");
        if (includeInitialNe && includeLeadingPlus) out.push("NS");

        function pushNene() {
          const L = out.length;
          if (L >= 2 && out[L-2] === "NE" && out[L-1] === "NE") return;
          out.push("NE", "NE");
        }

        if (seg.startsWith("-")) {
          if (seg.startsWith("-.")) seg = "-0." + seg.slice(2);
          out.push("NO");
          seg = seg.slice(1).trim();
        }

        let magnitudeSuffixKeCount = 0;
        if (seg.length > 0) {
          const last = seg.slice(-1).toUpperCase();
          if (last === "K" || last === "T" || last === "M" || last === "B") {
            magnitudeSuffixKeCount =
              (last === "K") ? 1 :
              (last === "M") ? 2 :
              (last === "B") ? 3 : 4; // T/t = trillion = four base-1000 boundaries
            seg = seg.slice(0, -1).trim();
            if (!seg) throw new Error(`Missing numeric part before magnitude suffix ${last} in ${s}`);
          }
        }

        if ((seg.match(/\./g) || []).length > 1) {
          throw new Error(`Invalid numeric segment with multiple decimals: ${segment}`);
        }

        let intPart = seg;
        let fracPart = "";
        let hasDecimal = false;
        if (seg.includes(".")) {
          [intPart, fracPart] = seg.split(".", 2);
          hasDecimal = true;
        }

        let ip = String(intPart ?? "").trim();
        if (ip === "") ip = "0";

        const intHasThousandsComma = (thousandsChar && ip.includes(thousandsChar));
        const hasLooseSep = /[ -]/.test(ip);

        if (hasLooseSep) {
          let ip2 = String(ip)
            .replace(/\s+/g, " ")
            .replace(/-+/g, "-")
            .trim();

          ip2 = ip2.replace(/^[ -]+/, "").replace(/[ -]+$/, "");
          if (ip2 === "") ip2 = "0";

          for (const ch of ip2) {
            if (/\d/.test(ch)) { out.push(decimalDigitToNanpaToken(ch)); continue; }
            if (ch === " " || ch === "-") { pushNene(); continue; }
            if (thousandsChar && ch === thousandsChar) { out.push("NE","KE"); continue; }
            throw new Error(`Unsupported character "${ch}" in integer part of "${s}"`);
          }
        } else {
          const groups = thousandsChar ? ip.split(thousandsChar) : [ip];
          for (const g of groups) {
            if (g === "" || !/^\d+$/.test(g)) throw new Error(`Invalid integer group "${g}" in "${s}"`);
          }

          let trailingZeroGroups = 0;
          for (let k = groups.length - 1; k >= 1; k--) {
            const g = groups[k];
            if (g.length === 3 && g === "000") trailingZeroGroups += 1;
            else break;
          }

          for (const d of groups[0]) out.push(decimalDigitToNanpaToken(d));

          const nGroups = groups.length;
          const lastNonTrailingIdx = nGroups - trailingZeroGroups;

          for (let idx = 1; idx < lastNonTrailingIdx; idx++) {
            out.push("NE","KE");
            for (const d of groups[idx]) out.push(decimalDigitToNanpaToken(d));
          }

          if (trailingZeroGroups > 0) {
            out.push("NE");
            // Preserve the complete base-1000 magnitude as one uninterrupted
            // KE run. The tokenizer and renderer consume arbitrarily long runs
            // as repeated KE-family tokens; no artificial NE boundary is needed.
            out.push("KE".repeat(trailingZeroGroups));
          }
        }

        if (hasDecimal) {
          out.push("NO","NE");

          if (!fracPart) throw new Error(`Missing fraction digits after '.' in "${s}"`);

          for (const ch of fracPart) {
            if (/\d/.test(ch)) { out.push(decimalDigitToNanpaToken(ch)); continue; }
            if (ch === "_") { pushNene(); continue; }
            if (ch === ",") { pushNene(); continue; }
            if (ch === " " || ch === "-") { pushNene(); continue; }
            throw new Error(`Unsupported character "${ch}" in fraction part of "${s}"`);
          }
        }

        if (magnitudeSuffixKeCount > 0) {
          out.push("NE");
          // Keep all KE pairs consecutive, including T/t (four KE) and
          // future magnitudes longer than the currently named suffixes.
          out.push("KE".repeat(magnitudeSuffixKeCount));
        }

        out.push("N");
        return out.join("");
      }

      if (raw.includes("+")) {
        const [left, right] = raw.split("+", 2);
        let leftCaps = encodeSingleNumberSegment(left, true, hasLeadingPlus);

        if (!right.includes("/")) throw new Error(`Mixed number must contain '/' after '+': ${s}`);
        const [num, den] = right.split("/", 2);

        let numCaps = encodeSingleNumberSegment(num, false);
        let denCaps = encodeSingleNumberSegment(den, false);

        leftCaps = stripFinalTerminator(leftCaps);
        numCaps = stripFinalTerminator(numCaps);

        const mixedSep = (mixedStyle === "short") ? "NOKO" : "NONONO";
        return leftCaps + mixedSep + numCaps + "NONO" + denCaps;
      }

      if (raw.includes("/")) {
        const [num, den] = raw.split("/", 2);
        let numCaps = encodeSingleNumberSegment(num, true, hasLeadingPlus);
        let denCaps = encodeSingleNumberSegment(den, false);
        numCaps = stripFinalTerminator(numCaps);
        return numCaps + "NONO" + denCaps;
      }

      return encodeSingleNumberSegment(raw, true, hasLeadingPlus);
    }

    function tryParseScientificDecimalToCaps(rawValue, opts = {}) {
      let raw = String(rawValue ?? "").trim();
      if (!raw) return null;
      raw = raw.replace(/[−‒–—]/g, "-");

      const mantissaPattern = String.raw`([+-]?(?:(?:\d[\d, _-]*)(?:\.\d[\d, _-]*)?|(?:\.\d[\d, _-]*)))`;
      const eRe = new RegExp(String.raw`^\s*${mantissaPattern}\s*[eE]\s*([+-]?\d+)\s*$`);
      const powWithCaretRe = new RegExp(String.raw`^\s*${mantissaPattern}\s*\*\s*10\s*\^\s*([+-]?\d+)\s*$`);
      const powSignedNoCaretRe = new RegExp(String.raw`^\s*${mantissaPattern}\s*\*\s*10\s*([+-]\d+)\s*$`);

      const m = raw.match(eRe) || raw.match(powWithCaretRe) || raw.match(powSignedNoCaretRe);
      if (!m) return null;

      let mantissa = String(m[1] ?? "").trim();
      let exponent = String(m[2] ?? "").trim();
      if (!mantissa || !exponent) return null;
      // A plus on the mantissa is the number's explicit leading sign and is
      // preserved. A plus on the exponent is intentionally ignored.
      if (exponent.startsWith("+")) exponent = exponent.slice(1).trim();
      if (!/^-?\d+$/.test(exponent)) return null;

      const mantissaCaps = numberStrToNanpaCaps(mantissa, opts);
      const exponentCaps = numberStrToNanpaCaps(exponent, { ...opts, groupFractionTriplets: false });
      if (!mantissaCaps.endsWith("N") || !exponentCaps.startsWith("NE") || !exponentCaps.endsWith("N")) return null;

      const mantissaCore = mantissaCaps.slice(0, -1);
      const exponentCore = exponentCaps.slice(2, -1);
      if (!mantissaCore || !exponentCore) return null;

      const caps = mantissaCore + "NEKO" + exponentCore + "N";
      tokenizeNanpaCaps(caps);
      return caps;
    }

    function decimalStringToCaps(rawDecimal, opts = {}) {
      // NEW: support trailing percent sign and inject OK into caps
      let raw = String(rawDecimal ?? "").trim();
      let percent = false;

      // Allow optional whitespace before %
      if (/%$/.test(raw)) {
        percent = true;
        raw = raw.replace(/\s*%\s*$/g, "").trim();
      }

      const normalized = normalizeVulgarFractionInput(raw);
      const scientificCaps = tryParseScientificDecimalToCaps(normalized, opts);

      const baseCaps = scientificCaps
        ? scientificCaps
        : looksLikeNanpaCaps(normalized)
          ? normalized.toUpperCase()
          : numberStrToNanpaCaps(normalized, opts);

      // Inject OK before final N (so tokenizer remains valid)
      const caps = percent
        ? (baseCaps.slice(0, -1) + "OKN")
        : baseCaps;

      tokenizeNanpaCaps(caps);
      return caps;
    }


    function findDecimalSequencesWithCaps(text, opts = {}) {
      const original = String(text ?? "");
      if (!original) return [];

      const s = original.replace(/[−‒–—]/g, "-");

      const scientificHits = [];
      // Scientific notation uses the same terminal-punctuation rule as ordinary
      // numeric input. A sentence full stop may immediately follow the exponent,
      // but a decimal continuation such as "1e8.5" must not be accepted as the
      // complete scientific value "1e8" plus punctuation. An optional percent
      // suffix belongs to the scientific expression and is kept in the numeric
      // cartouche before any following sentence punctuation.
      const scientificRe = /(^|[^A-Za-z0-9_.])([+-]?(?:(?:\d[\d, _-]*)(?:\.\d[\d, _-]*)?|(?:\.\d[\d, _-]*))(?:\s*[eE]\s*[+-]?\d+|\s*\*\s*10\s*\^\s*[+-]?\d+|\s*\*\s*10\s*[+-]\d+)(?:\s*%)?)(?=$|[^A-Za-z0-9_.]|\.(?!\d))/g;
      let sm;
      while ((sm = scientificRe.exec(s)) !== null) {
        const lead = sm[1] ?? "";
        const rawCandidate = String(sm[2] ?? "");
        const candidate = rawCandidate.trim();
        if (!candidate) continue;
        const candidateOffset = rawCandidate.indexOf(candidate);
        const start = (sm.index | 0) + String(lead).length + Math.max(0, candidateOffset);
        const end = start + candidate.length;
        try {
          const caps = decimalStringToCaps(candidate, {
            thousandsChar: ",",
            groupFractionTriplets: true,
            fractionGroupSize: 3,
            ...opts,
          });
          scientificHits.push({ kind: "decimal", match: candidate, index: start, end, caps });
        } catch {
          // ignore
        }
      }

      const vulgarChars = "¼½¾⅐⅑⅒⅓⅔⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞↉";
      const re = new RegExp(
        String.raw`(?<![A-Za-z])` +
        String.raw`(` +
          String.raw`(?:(?<![A-Za-z0-9])\+|-)?\s*\d*\s*[${vulgarChars}]` +
          "|" +
          String.raw`(?:(?<![A-Za-z0-9])\+|-)?\s*\d[\d, _-]*\s*\+\s*\d[\d, _-]*\s*\/\s*\d[\d, _-]*` +
          "|" +
          String.raw`(?:(?<![A-Za-z0-9])\+|-)?\s*\d[\d, _-]*\s*\/\s*\d[\d, _-]*` +
          "|" +
          String.raw`(?:(?<![A-Za-z0-9])\+|-)?\s*(?:\d[\d, _-]*|\.\d+)(?:\.\d[\d, _-]*)?(?:\s*[kKtTmMbB])?` +
        String.raw`)` +
        String.raw`(?:\s*%)?` +          // NEW
        String.raw`(?![A-Za-z])`,
        "g"
      );

      const results = [];
      let m;

      while ((m = re.exec(s)) !== null) {
        const rawMatch = m[0]; // includes optional trailing %
        if (!rawMatch) continue;

        let candidate = rawMatch.trim().replace(/[)\]}.,;:!?]+$/g, "").trim();
        if (!candidate) continue;
        if (candidate === "-" || candidate === "+") continue;

        const rel = rawMatch.indexOf(candidate);
        const start = (rel >= 0) ? (m.index + rel) : m.index;
        const end = start + candidate.length;

        try {
          const caps = decimalStringToCaps(candidate, {
            thousandsChar: ",",
            groupFractionTriplets: true,
            fractionGroupSize: 3,
            ...opts,
          });
          results.push({ kind: "decimal", match: candidate, index: start, end, caps });


        } catch {
          // ignore
        }
      }

      results.push(...scientificHits);
      results.sort((a, b) => a.index - b.index || b.end - a.end);
      const filtered = [];
      let lastEnd = -1;
      for (const r of results) {
        if (r.index < lastEnd) continue;
        filtered.push(r);
        lastEnd = r.end;
      }
      return filtered;
    }

    /* ============================================================
       #~ code and proper-name scanners
       ============================================================ */
    function findNumberCodeSequencesWithCaps(text) {
      const s = String(text ?? "");
      if (!s) return [];

      const re = /#~\+?[A-Za-z]+/g;
      const out = [];
      let m;

      while ((m = re.exec(s)) !== null) {
        const raw = m[0];
        if (!raw) continue;

        const start = m.index | 0;
        const end = start + raw.length;

        try {
          const parsed = tryParseNanpaLinjanNumberCodeToCaps(raw);
          if (parsed?.caps) out.push({ kind: "code", index: start, end, caps: parsed.caps });
        } catch {
          // ignore invalid codes
        }
      }

      return out;
    }

        function makeNanpaLinjanProperNameHitFromSpan(rawSpan, start) {
      const source = String(rawSpan ?? "");
      const compact = source.replace(/[ \t]+/g, "");
      if (compact.length < 5) return null;
      if (!isValidNanpaLinjanProperName(source)) return null;

      const caps = nanpaLinjanProperNameToCaps(source);
      if (!caps) return null;

      return {
        kind: "name",
        index: start,
        end: start + String(rawSpan).length,
        caps
      };
    }

    function findNanpaLinjanProperNameSequencesWithCaps(text) {
      const s = String(text ?? "");
      if (!s) return [];

      nanpaDebugEmit("proper-name-scanner:start", { text: s });
      const hits = [];

      // Scan physical lines independently. A nanpa-linja-n proper-name numeric
      // cartouche must never be matched across a newline.
      const lineRe = /[^\r\n]+/g;
      let lineMatch;

      while ((lineMatch = lineRe.exec(s)) !== null) {
        const line = lineMatch[0];
        const lineStart = lineMatch.index | 0;

        const words = [];
        const wordRe = /[A-Za-z]+/g;
        let wm;

        while ((wm = wordRe.exec(line)) !== null) {
          words.push({
            raw: wm[0],
            start: lineStart + wm.index,
            end: lineStart + wm.index + wm[0].length
          });
        }

        for (let i = 0; i < words.length; i++) {
          const first = words[i];

          // Legacy numeric proper names start with Ne.... The alternative head
          // is deliberately case-sensitive so lowercase nanpa remains the
          // ordinary Toki Pona glyph and can never start a numeric proper name.
          const startsLegacyNanpaName = /^ne/i.test(first.raw);
          const startsNanpaColonName = getNanpaColonParsing() &&
            (first.raw === "Nanpa" || /^Nanpa[a-z]+$/.test(first.raw));
          if (!startsLegacyNanpaName && !startsNanpaColonName) continue;

          let best = null;
          let bestJ = -1;
          const maxJ = Math.min(words.length - 1, i + 20);

          for (let j = i; j <= maxJ; j++) {
            // A spaced nanpa-linja-n proper-name continuation word must be capitalized.
            // This prevents ordinary lowercase toki pona words such as "en" from being
            // swallowed into the preceding numeric proper-name run:
            //
            //   Newen en  ->  [Newen] en
            //
            // while still allowing:
            //
            //   Nenin One Len -> [Nenin One Len]
            //
            if (j > i && !/^[A-Z]/.test(words[j].raw)) break;

            const spanStart = first.start;
            const spanEnd = words[j].end;
            const rawSpan = s.slice(spanStart, spanEnd);

            // Only horizontal whitespace is allowed inside a spaced proper name.
            // Punctuation and newlines terminate the candidate span.
            if (!/^[A-Za-z]+(?:[ \t]+[A-Za-z]+)*$/.test(rawSpan)) continue;

            const hit = makeNanpaLinjanProperNameHitFromSpan(rawSpan, spanStart);
            if (hit) {
              best = hit;
              bestJ = j;
            }
          }

          if (best) {
            nanpaDebugEmit("proper-name-scanner:selected", {
              sourceText: s.slice(best.index, best.end),
              index: best.index,
              end: best.end,
              caps: best.caps,
              startWord: first.raw,
              bestJ
            });
            hits.push(best);
            i = bestJ;
          }
        }
      }

      nanpaDebugTable("proper-name-scanner:final-hits", hits.map(h => ({
        kind: h.kind,
        sourceText: s.slice(h.index, h.end),
        index: h.index,
        end: h.end,
        caps: h.caps
      })));
      return hits;
    }

function findNanpaLinjanTpPhraseSequences(text) {
      const s = String(text ?? "");
      if (!s) return [];

      const tokens = [];
      const reTok = /\S+/g;
      let m;
      while ((m = reTok.exec(s)) !== null) {
        const raw = m[0];
        // Only a terminal punctuation suffix may be attached to a phrase word.
        // Keep that punctuation outside the numeric hit so it is rendered and
        // spoken through the normal punctuation path. Internal punctuation does
        // not silently normalize into a valid nanpa-linja-n phrase word.
        const wordMatch = /^([A-Za-z]+)([)\]},.;:!?]*)$/.exec(raw);
        const wordRaw = wordMatch ? wordMatch[1] : "";
        tokens.push({
          raw,
          norm: wordRaw.toLowerCase(),
          start: m.index,
          wordEnd: m.index + wordRaw.length,
          end: (m.index + raw.length),
          trailingPunctuation: wordMatch ? wordMatch[2] : ""
        });
      }
      if (tokens.length < 3) return [];

      const digitWords = nanpaLinjanDigitWordSet();

      const hits = [];
      for (let i = 0; i < tokens.length - 2; i++) {
        if (tokens[i].norm !== "nanpa") continue;
        const n1 = tokens[i + 1]?.norm;
        if (!(n1 === "esun" || n1 === "en" || n1 === "e")) continue;

        let bestJ = -1;
        let bestWords = null;

        for (let j = i + 2; j < tokens.length; j++) {
          if (tokens[j].norm !== "nanpa") continue;

          const words = [];

          for (let k = i; k <= j; k++) {
            const token = tokens[k];
            const w = token.norm;
            if (!w) break;
            // Attached punctuation terminates the phrase. It is allowed only on
            // the final closing "nanpa" token, where it remains outside the hit.
            if (k < j && token.trailingPunctuation) break;
            words.push(w);
          }

          if (words.length !== (j - i + 1)) continue;
          const parsed = tryParseNanpaLinjanTpPhraseWords(words);
          if (!parsed) continue;

          bestJ = j;
          bestWords = parsed.words;
        }

        if (bestJ >= 0 && bestWords) {
          hits.push({
            kind: "tpPhrase",
            index: tokens[i].start,
            end: tokens[bestJ].wordEnd,
            words: bestWords
          });
          i = bestJ;
        }
      }

      return hits;
    }

    function mergeAndGreedyFilterHits(allHits) {
      const hits = Array.from(allHits ?? []).filter(h =>
        h &&
        Number.isFinite(h.index) &&
        Number.isFinite(h.end) &&
        h.end > h.index &&
        (h.caps || h.hexSemantic || h.binarySemantic || (Array.isArray(h.words) && h.words.length > 0))
      );

      function priority(kind) {
        if (kind === "hex" || kind === "binary") return 6;
        if (kind === "date") return 5;
        if (kind === "decimal") return 4;
        if (kind === "time") return 4;
        if (kind === "tpPhrase") return 3;
        if (kind === "code") return 2;
        return 1;
      }

      hits.sort((a, b) => {
        if (a.index !== b.index) return a.index - b.index;
        const la = (a.end - a.index);
        const lb = (b.end - b.index);
        if (la !== lb) return lb - la;
        return priority(b.kind) - priority(a.kind);
      });

      const out = [];
      let lastEnd = -1;

      for (const h of hits) {
        if (h.index < lastEnd) continue;
        out.push(h);
        lastEnd = h.end;
      }

      nanpaDebugTable("hit-merge:selected", out.map(h => ({
        kind: h.kind,
        index: h.index,
        end: h.end,
        caps: h.caps || null,
        words: Array.isArray(h.words) ? h.words.join(" ") : null
      })));
      return out;
    }

    /* ============================
       TP phrase helpers
       ============================ */
    function nanpaLinjanDigitWordSet() {
      return new Set(
        Object.values(TOKEN_TO_DIGIT_WORD).filter(w => NANPA_LINJA_N_WORD_TO_CP[w] != null)
      );
    }

    const RELAXED_NANPA_PHRASE_FOLLOWERS = Object.freeze({
      wan: "ala",
      pipi: "ike",
      tu: "uta",
      luka: "uta",
      mun: "uta"
    });
    const RELAXED_ONLY_NANPA_PHRASE_WORDS = new Set(["ala", "ike", "uta"]);

    function isAllowedNanpaLinjanTpPhraseWord(words, index) {
      const w = words[index];
      if (w === "nasin") return false;
      if (NANPA_LINJA_N_WORD_TO_CP[w] == null) return false;
      if (!RELAXED_ONLY_NANPA_PHRASE_WORDS.has(w)) return true;
      if (!getRelaxedNanpaLinjanParsing()) return false;
      if (index <= 2 || index >= words.length - 1) return false;
      return RELAXED_NANPA_PHRASE_FOLLOWERS[words[index - 1]] === w;
    }

    function hasAdjacentNanpaLinjanDigitWords(words) {
      const digitWords = nanpaLinjanDigitWordSet();
      for (let i = 1; i < (words || []).length; i++) {
        if (digitWords.has(words[i - 1]) && digitWords.has(words[i])) return true;
      }
      return false;
    }

    function canonicalizeScientificTpPhraseWords(inputWords) {
      const words = Array.from(inputWords ?? []).map(normalizeTpWord).filter(Boolean);
      const legacyPatterns = [
        {
          old: ["nena", "e", "kala", "open", "wan", "e", "nena", "ijo", "nena", "e", "kala", "open"],
          replacement: ["nena", "e", "kala", "open"]
        },
        {
          old: ["nena", "e", "kala", "open", "wan", "ala", "nena", "ijo", "nena", "e", "kala", "open"],
          replacement: ["nena", "e", "kala", "open"]
        },
        {
          old: ["nena", "en", "kala", "open", "wan", "en", "nena", "ijo", "nena", "en", "kala", "open"],
          replacement: ["nena", "e", "kala", "open"]
        },
        {
          old: ["nena", "en", "kala", "open", "wan", "ala", "nena", "ijo", "nena", "en", "kala", "open"],
          replacement: ["nena", "e", "kala", "open"]
        },
        {
          old: ["nasa", "e", "kala", "open", "wan", "esun", "nasa", "ijo", "nasa", "e", "kala", "open"],
          replacement: ["nasa", "e", "kala", "open"]
        },
        {
          old: ["nasa", "e", "kala", "open", "wan", "ala", "nasa", "ijo", "nasa", "e", "kala", "open"],
          replacement: ["nasa", "e", "kala", "open"]
        }
      ];

      const out = [];
      for (let i = 0; i < words.length; ) {
        let matched = null;
        for (const pattern of legacyPatterns) {
          if (
            i + pattern.old.length <= words.length &&
            pattern.old.every((word, offset) => words[i + offset] === word)
          ) {
            matched = pattern;
            break;
          }
        }

        if (matched) {
          out.push(...matched.replacement);
          i += matched.old.length;
        } else {
          out.push(words[i]);
          i += 1;
        }
      }
      return out;
    }

    function tryParseNanpaLinjanTpPhraseWords(inputWords) {
      const words = Array.from(inputWords ?? []).map(normalizeTpWord).filter(Boolean);

      if (words.length < 3) return null;
      if (words[0] !== "nanpa") return null;
      if (!(words[1] === "esun" || words[1] === "en" || words[1] === "e")) return null;
      if (words[words.length - 1] !== "nanpa") return null;

      for (let i = 0; i < words.length; i++) {
        if (!isAllowedNanpaLinjanTpPhraseWord(words, i)) return null;
      }

      // Reject mixed/partially abbreviated forms such as
      // [nanpa en wan tu en nanpa]. Fully abbreviated input is handled by
      // tryParseFullyAbbreviatedNanpaLinjanCartoucheWords() and only inside [].
      if (hasAdjacentNanpaLinjanDigitWords(words)) return null;

      let canonicalWords = canonicalizeScientificTpPhraseWords(words);

      // Canonical rendering is based on numeric meaning, not legacy source
      // scaffolding. Before the explicit-positive Nene convention existed,
      // [nanpa en nena en ...] could be accepted as an unsigned full form.
      // Keep accepting that input, but render it as the equivalent modern
      // unsigned form [nanpa e ...], with the obsolete leading nena/en pair
      // removed. This must be distinguished from the new positive opening
      // [nanpa e nena en ...], where nena/en is semantically significant.
      const hasLegacyUnsignedLeadingSpacer =
        canonicalWords.length >= 6 &&
        canonicalWords[0] === "nanpa" &&
        canonicalWords[1] === "en" &&
        canonicalWords[2] === "nena" &&
        canonicalWords[3] === "en";

      if (hasLegacyUnsignedLeadingSpacer) {
        canonicalWords = ["nanpa", "e", ...canonicalWords.slice(4)];
      }

      // en remains accepted as legacy/full input wherever e is accepted, but
      // e is the canonical rendered scaffolding. The sole exception is the
      // semantically significant en in the new positive full opening.
      const hasExplicitPositiveOpening =
        canonicalWords.length >= 5 &&
        canonicalWords[0] === "nanpa" &&
        canonicalWords[1] === "e" &&
        canonicalWords[2] === "nena" &&
        canonicalWords[3] === "en";
      canonicalWords = canonicalWords.map((word, index) =>
        word === "en" && !(hasExplicitPositiveOpening && index === 3) ? "e" : word
      );

      const digitWords = nanpaLinjanDigitWordSet();

      const payload = canonicalWords.slice(2, -1);
      const hasDigit = payload.some(w => digitWords.has(w));
      if (!hasDigit) return null;

      // Backward compatibility: legacy full cartouches begin [nanpa en ...].
      // That same prefix is now also the explicit-positive abbreviated marker.
      // Give a legacy full form precedence only when its payload contains at
      // least one full-cartouche scaffolding glyph beyond the opening en.
      // Otherwise leave [nanpa en <abbreviated payload> nanpa] for the
      // abbreviated-positive parser below.
      if (words[1] === "en") {
        const hasLegacyFullScaffolding = words.slice(2, -1).some(w => {
          const cp = NANPA_LINJA_N_WORD_TO_CP[w];
          return cp === CP_E || NUMERIC_CARTOUCHE_ABBREVIATION_DROP_AFTER_FIRST_NANPA.has(cp);
        });
        if (!hasLegacyFullScaffolding) return null;
      }

      return { words: canonicalWords };
    }

    function nanpaLinjanWordsToCodepoints(words, { mode = "traditional" } = {}) {
      let sourceWords = Array.from(words ?? []);
      if (getNanpaColonRendering() && sourceWords.length >= 3 &&
          normalizeTpWord(sourceWords[0]) === "nanpa" &&
          (normalizeTpWord(sourceWords[1]) === "e" || normalizeTpWord(sourceWords[1]) === "en" || normalizeTpWord(sourceWords[1]) === "esun")) {
        sourceWords = [sourceWords[0], ":", ...sourceWords.slice(2)];
      }
      const cps = [];
      for (const w0 of sourceWords) {
        const rawWord = String(w0 ?? "").trim().toLowerCase();
        const w = rawWord === ":" ? ":" : normalizeTpWord(w0);
        const cp = NANPA_LINJA_N_WORD_TO_CP[w];
        if (cp == null) return null;
        cps.push(cp);
      }
      if (mode === "uniform") return uniformizeNanpaLinjanCartoucheCps(cps);
      return cps;
    }

    function tryParseFullyAbbreviatedNanpaLinjanCartoucheWords(inputWords) {
      const words = Array.from(inputWords ?? []).map(normalizeTpWord).filter(Boolean);
      if (words.length < 3) return null;
      if (words[0] !== "nanpa") return null;
      if (words[words.length - 1] !== "nanpa") return null;

      const isExplicitPositive = words.length >= 4 && words[1] === "en";
      const cps = [];
      let hasDigit = false;
      const digitWords = new Set(
        Object.values(TOKEN_TO_DIGIT_WORD).filter(w => NANPA_LINJA_N_WORD_TO_CP[w] != null)
      );

      for (let i = 0; i < words.length; i++) {
        const w = words[i];
        if (w === "nasin") return null;
        if (RELAXED_ONLY_NANPA_PHRASE_WORDS.has(w)) return null;
        const cp = NANPA_LINJA_N_WORD_TO_CP[w];
        if (cp == null) return null;

        const isFinalNanpa = (cp === CP_NANPA && i === words.length - 1);
        const isPositiveMarker = isExplicitPositive && i === 1 && cp === CP_EN;
        if (i > 0 && !isFinalNanpa && !isPositiveMarker && NUMERIC_CARTOUCHE_ABBREVIATION_DROP_AFTER_FIRST_NANPA.has(cp)) {
          // Apart from the one leading en positive marker, abbreviated numeric
          // cartouches cannot contain full-form scaffolding.
          return null;
        }

        if (digitWords.has(w)) hasDigit = true;
        cps.push(cp);
      }

      if (!hasDigit) return null;
      return { words, cps, isExplicitPositive };
    }

    function tpWordsToCodepoints(wordsOrTokens) {
      const cps = [];
      for (const w of (wordsOrTokens ?? [])) {
        const cp = WORD_TO_UCSUR_CP[w];
        if (cp != null) cps.push(cp);
      }
      return cps;
    }

    function setTextQuality(ctx) {
      try { ctx.textRendering = "optimizeLegibility"; } catch (_) {}
      try { ctx.fontKerning = "normal"; } catch (_) {}
    }



    function haloWidthForPx(px) {
      const p = Math.max(8, Number(px ?? 56));

      // User override: 0 => auto; otherwise exact px width.
      const override = getHaloWidthOverridePx();
      if (override > 0) return override;

      // Auto: ~10% of font size; clamp to sane minimum/maximum
      return Math.max(2, Math.min(24, Math.round(p * 0.10)));
    }


    function drawTextWithOptionalHalo(ctx, text, x, yBaseline, { px, fontFamily, fillCss }) {
      const haloEnabled = getHaloEnabled();
      const haloCss = getHaloHex();

      ctx.font = `${px}px "${fontFamily}"`;
      setTextQuality(ctx);

      if (haloEnabled) {
        ctx.save();
        ctx.strokeStyle = haloCss;
        ctx.lineWidth = haloWidthForPx(px);
        ctx.lineJoin = "round";
        ctx.miterLimit = 2;
        ctx.strokeText(text, x, yBaseline);
        ctx.restore();
      }

      ctx.fillStyle = fillCss;
      ctx.fillText(text, x, yBaseline);
    }

    function isReddishHex(hex) {
      const m = /^#([0-9a-f]{6})$/i.exec(String(hex || "").trim());
      if (!m) return false;
      const s = m[1];
      const r = parseInt(s.slice(0, 2), 16);
      const g = parseInt(s.slice(2, 4), 16);
      const b = parseInt(s.slice(4, 6), 16);
      return r >= 120 && r > g * 1.2 && r > b * 1.2;
    }

    function resolveUnknownStrokeColor(display, fgHex) {
      const mode = String(display?.colorMode || "auto").toLowerCase();
      if (mode === "custom" && display?.color) return String(display.color);
      if (mode === "yellow") return "#C9A500";
      if (mode === "red") return "#D00000";
      return isReddishHex(fgHex) ? "#C9A500" : "#D00000";
    }

    function drawUnknownOutlineBox(ctx, drawX, glyphBaseline, m, display, fgHex) {
      const pad = Math.max(1, Number(display?.paddingPx ?? 2));
      const lineWidth = Math.max(1, Number(display?.lineWidthPx ?? 1.5));
      const boxX = Math.floor(drawX - pad);
      const boxY = Math.floor(glyphBaseline - (m.ascent ?? 0) - pad);
      const boxW = Math.max(1, Math.ceil((m.w ?? 0) + pad * 2));
      const boxH = Math.max(1, Math.ceil((m.h ?? ((m.ascent ?? 0) + (m.descent ?? 0))) + pad * 2));

      ctx.save();
      ctx.strokeStyle = resolveUnknownStrokeColor(display, fgHex);
      ctx.lineWidth = lineWidth;
      if (display?.dash) ctx.setLineDash([4, 2]);
      ctx.strokeRect(boxX, boxY, boxW, boxH);
      ctx.restore();
    }

    /* ============================
       Random letters → glyphs
       ============================ */
    function buildLetterBuckets() {
      const buckets = new Map();
      for (const w of Object.keys(WORD_TO_UCSUR_CP)) {
        const k = String(w);
        if (!k) continue;
        const first = k[0].toLowerCase();
        if (!/^[a-z]$/.test(first)) continue;
        if (!buckets.has(first)) buckets.set(first, []);
        buckets.get(first).push(k);
      }
      return buckets;
    }
    const LETTER_BUCKETS = buildLetterBuckets();

    function randInt(n) {
      if (n <= 0) return 0;
      if (globalThis.crypto && typeof globalThis.crypto.getRandomValues === "function") {
        const buf = new Uint32Array(1);
        globalThis.crypto.getRandomValues(buf);
        return buf[0] % n;
      }
      return Math.floor(Math.random() * n);
    }

    function randomGlyphCpForLetter(letter) {
      const l = String(letter ?? "").toLowerCase();
      const arr = LETTER_BUCKETS.get(l);
      if (!arr || arr.length === 0) return null;

      // Exclude convenience punctuation-words from random output
      const banned = new Set(["ota", "kolon", "koma", "te", "to", "zz"]);
      const filtered = arr.filter(w => !banned.has(w));

      if (filtered.length === 0) return null;

      const word = filtered[randInt(filtered.length)];
      return WORD_TO_UCSUR_CP[word] ?? null;
    }

    function lettersToRandomGlyphCps(letters) {
      const cps = [];
      const s = String(letters ?? "").toLowerCase().replace(/[^a-z]/g, "");
      for (const ch of s) {
        const cp = randomGlyphCpForLetter(ch);
        if (cp != null) cps.push(cp);
      }
      return cps;
    }

    const TP_PROPER_NAME_LATIN_LETTERS_RE = /^[aeijklmnostpuw]+$/i;

    function isStandaloneCapitalizedProperNameCandidate(token) {
      return /^[A-Z]/.test(String(token ?? ""));
    }

    function lettersToStrictRandomProperNameGlyphCps(word) {
      const s = String(word ?? "");
      if (!/^[A-Za-z]+$/.test(s)) return null;
      if (!TP_PROPER_NAME_LATIN_LETTERS_RE.test(s)) return null;

      const cps = [];
      for (const ch of s.toLowerCase()) {
        const cp = randomGlyphCpForLetter(ch);
        if (cp == null) return null;
        cps.push(cp);
      }
      return cps;
    }

    function emitUnknownTextElement(elements, text, { fontPx, sourceStart = null, sourceEnd = null, sourceKind = null, sourceSegmentIndex = null } = {}) {
      if (!getShowUnknownText()) return;
      makeLiteralTextElement(elements, text, {
        fontPx,
        fontFamily: FONT_FAMILY_UNKNOWN || FONT_FAMILY_LITERAL,
        addLeadingGap: true,
        isUnrecognized: true,
        unknownDisplay: getUnknownTextDisplay(),
        sourceText: String(text ?? ""),
        sourceStart,
        sourceEnd,
        sourceKind,
        sourceSegmentIndex,
      });
    }

    function splitLineIntoSegments(line) {
      const s = String(line ?? "");
      const out = [];
      let i = 0;
      let start = 0;

      function pushText(a, b) {
        if (b > a) out.push({ kind: "text", value: s.slice(a, b) });
      }

      while (i < s.length) {
        const ch = s[i];

        // Bracket: [...]
        if (ch === "[") {
          const j = s.indexOf("]", i + 1);
          if (j < 0) break; // treat rest as text below
          pushText(start, i);
          out.push({ kind: "bracket", value: s.slice(i + 1, j) });
          i = j + 1;
          start = i;
          continue;
        }

        // Quote: "..." or “...”
        if (ch === '"' || ch === "“") {
          const openCh = ch;
          const closeCh = (openCh === "“") ? "”" : '"';

          let j = i + 1;
          let found = false;
          while (j < s.length) {
            const cj = s[j];
            const isClose =
              (cj === closeCh) ||
              (openCh === "“" && cj === '"') ||
              (openCh === '"' && cj === "”");

            if (isClose && s[j - 1] !== "\\") { found = true; break; }
            j++;
          }
          if (!found) break;

          pushText(start, i);
          out.push({
            kind: "quote",
            value: s.slice(i + 1, j),
            openQuote: openCh,
            closeQuote: s[j],
            sourceStart: i,
            sourceEnd: j + 1
          });
          i = j + 1;
          start = i;
          continue;
        }

        i++;
      }

      // trailing text
      pushText(start, s.length);
      return out;
    }

    function pushGapIfNeeded(elements, px) {
      if (elements.length === 0) return;
      const last = elements[elements.length - 1];
      if (last && last.type === "gap") return;
      elements.push({ type: "gap", px: px });
    }

    function fillRoundedRectPath(ctx, x, y, w, h, r) {
      const radius = Math.max(0, Math.min(Number(r) || 0, Math.max(0, w) / 2, Math.max(0, h) / 2));
      ctx.beginPath();
      ctx.moveTo(x + radius, y);
      ctx.lineTo(x + w - radius, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
      ctx.lineTo(x + w, y + h - radius);
      ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
      ctx.lineTo(x + radius, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
      ctx.lineTo(x, y + radius);
      ctx.quadraticCurveTo(x, y, x + radius, y);
      ctx.closePath();
    }


    function detectCartoucheBottomRuleY(ctx, {
      runX,
      runWidth,
      baselineY,
      fontPx,
      canvasW,
      canvasH,
      alphaThreshold = 8
    } = {}) {
      const w = Math.max(0, Math.floor(Number(canvasW || ctx?.canvas?.width || 0)));
      const h = Math.max(0, Math.floor(Number(canvasH || ctx?.canvas?.height || 0)));
      if (!ctx || w <= 0 || h <= 0) return null;

      const px = Math.max(8, Number(fontPx || 56));
      const x0 = Math.max(0, Math.floor(Number(runX || 0) - px * 0.04));
      const x1 = Math.min(w, Math.ceil(Number(runX || 0) + Math.max(1, Number(runWidth || 0)) + px * 0.04));
      const span = Math.max(1, x1 - x0);
      if (span <= 1) return null;

      let data;
      try {
        data = ctx.getImageData(0, 0, w, h).data;
      } catch {
        return null;
      }

      const rowCounts = new Int32Array(h);
      for (let y = 0; y < h; y++) {
        const row = y * w * 4;
        let count = 0;
        for (let x = x0; x < x1; x++) {
          if (data[row + x * 4 + 3] > alphaThreshold) count++;
        }
        rowCounts[y] = count;
      }

      function findLowestRowWithCoverage(frac, minAbs) {
        const threshold = Math.max(minAbs, Math.round(span * frac));
        // Start near the baseline rather than at the top so the upper cartouche
        // rule can never win. Search downward-to-upward so we get the bottom
        // edge of the actual lower rule, not its centre.
        const startY = Math.max(0, Math.min(h - 1, Math.floor(Number(baselineY || 0) - px * 0.22)));
        for (let y = h - 1; y >= startY; y--) {
          if (rowCounts[y] >= threshold) return y;
        }
        return null;
      }

      // Normal case: the lower cartouche rule is a long horizontal row.
      let y = findLowestRowWithCoverage(0.30, Math.max(4, Math.round(px * 0.90)));
      if (y != null) return y;

      // Narrow or sparse fonts: reduce coverage but still require a recognisable
      // horizontal rule, not just a few pixels from an inner glyph.
      y = findLowestRowWithCoverage(0.18, Math.max(3, Math.round(px * 0.55)));
      if (y != null) return y;

      // Last-resort detection: use the lowest ink row in the cartouche run. This
      // is still measured from the rendered pixels; it is not a baseline guess.
      const minInk = Math.max(2, Math.round(px * 0.10));
      const startY = Math.max(0, Math.min(h - 1, Math.floor(Number(baselineY || 0) - px * 0.10)));
      for (let yy = h - 1; yy >= startY; yy--) {
        if (rowCounts[yy] >= minInk) return yy;
      }

      return null;
    }


    function hexToRgbLocal(hex) {
      const m = /^#([0-9a-f]{6})$/i.exec(String(hex || "").trim());
      if (!m) return null;
      const s = m[1];
      return {
        r: parseInt(s.slice(0, 2), 16),
        g: parseInt(s.slice(2, 4), 16),
        b: parseInt(s.slice(4, 6), 16)
      };
    }

    function detectCartoucheBottomForegroundRuleY(ctx, {
      runX,
      runWidth,
      baselineY,
      fontPx,
      canvasW,
      canvasH,
      fgCss,
      alphaThreshold = 32,
      colorTolerance = 80
    } = {}) {
      const w = Math.max(0, Math.floor(Number(canvasW || ctx?.canvas?.width || 0)));
      const h = Math.max(0, Math.floor(Number(canvasH || ctx?.canvas?.height || 0)));
      if (!ctx || w <= 0 || h <= 0) return null;

      const fg = hexToRgbLocal(fgCss || "#111111");
      if (!fg) return null;

      const px = Math.max(8, Number(fontPx || 56));
      const x0 = Math.max(0, Math.floor(Number(runX || 0) - px * 0.04));
      const x1 = Math.min(w, Math.ceil(Number(runX || 0) + Math.max(1, Number(runWidth || 0)) + px * 0.04));
      const span = Math.max(1, x1 - x0);
      if (span <= 1) return null;

      let data;
      try {
        data = ctx.getImageData(0, 0, w, h).data;
      } catch {
        return null;
      }

      function isForegroundPixel(i) {
        const a = data[i + 3];
        if (a <= alphaThreshold) return false;

        const dr = Math.abs(data[i] - fg.r);
        const dg = Math.abs(data[i + 1] - fg.g);
        const db = Math.abs(data[i + 2] - fg.b);

        return (dr + dg + db) <= colorTolerance;
      }

      const rowCounts = new Int32Array(h);

      for (let y = 0; y < h; y++) {
        const row = y * w * 4;
        let count = 0;
        for (let x = x0; x < x1; x++) {
          if (isForegroundPixel(row + x * 4)) count++;
        }
        rowCounts[y] = count;
      }

      const startY = Math.max(0, Math.min(h - 1, Math.floor(Number(baselineY || 0) - px * 0.22)));
      const threshold = Math.max(4, Math.round(span * 0.18));

      for (let y = h - 1; y >= startY; y--) {
        if (rowCounts[y] >= threshold) return y;
      }

      return null;
    }



    function computeManualCartoucheTallyGroups(ctx, innerCps, manualTallies, { fontPx, runX, baselineY, cartoucheBottomY, glyphLayout = null, manualTallyLiftPx = 0 }) {
      const tallies = Array.from(manualTallies ?? []);
      const px = Math.max(8, Number(fontPx ?? 56));
      const layout = Array.isArray(glyphLayout) ? glyphLayout : [];
      const startChar = String.fromCodePoint(CARTOUCHE_START_CP);
      let penX = Number(runX || 0) + (ctx.measureText(startChar).width || 0);

      // Manual tally marks are external attachments below the cartouche bottom line.
      // Keep every measurement proportional to font size so PNG/PDF/canvas exports match.
      const strokeW = Math.max(1.5, fontPx * 0.045); // wider, closer to font stroke
      const gap = fontPx * 0.075;                    // a bit more spread
      const h = fontPx * 0.10;                       // about 50% shorter
      const belowGap = 0;                            // touch bottom rule

      const detectedBottomY = Number.isFinite(Number(cartoucheBottomY)) ? Number(cartoucheBottomY) : null;
      const fallbackBottomY = Number(baselineY || 0) + px * 0.20;
      const bottomRuleY = detectedBottomY != null ? detectedBottomY : fallbackBottomY;
      const liftPx = Math.max(0, Number(manualTallyLiftPx) || 0);
      // A small positive lift overlaps the first tally pixel with the bottom rule,
      // avoiding a one-pixel anti-aliasing gap in configured tiny font renders.
      const yTop = bottomRuleY - liftPx;
      const yBottom = yTop + h;

      const groups = [];
      for (let i = 0; i < innerCps.length; i++) {
        const count = Math.max(0, Math.min(8, Number(tallies[i] || 0) | 0));
        const ch = String.fromCodePoint(innerCps[i]);
        const advance = Math.max(1, ctx.measureText(ch).width || px * 0.7);

        if (count > 0) {
          const layoutItem = layout[i];
          const layoutX = Number(layoutItem?.x);
          const layoutWidth = Number(layoutItem?.width);
          const hasMeasuredLayout = Number.isFinite(layoutX) && Number.isFinite(layoutWidth) && layoutWidth > 0;
          const centerX = hasMeasuredLayout ? layoutX + layoutWidth / 2 : penX + advance / 2;
          const totalW = (count <= 1) ? strokeW : (count * strokeW + (count - 1) * gap);
          const firstX = centerX - totalW / 2 + strokeW / 2;
          const strokes = [];
          for (let k = 0; k < count; k++) {
            const x = firstX + k * (strokeW + gap);
            strokes.push({ x, yTop, yBottom, strokeW });
          }
          groups.push({
            ownerGlyphIndex: i,
            count,
            strokes,
            bounds: {
              left: firstX - strokeW / 2,
              right: firstX + (count - 1) * (strokeW + gap) + strokeW / 2,
              top: yTop,
              bottom: yBottom
            }
          });
        }

        penX += advance;
      }
      return { groups, strokeW, gap, height: h, belowGap, bottomY: yBottom };
    }

    function drawManualCartoucheTallies(ctx, innerCps, manualTallies, { fontPx, fontFamily, runX, baselineY, cartoucheW, cartoucheH, padPx, haloEnabled, haloCss, fgCss, cartoucheRunWidth = null, cartoucheBottomY = null, glyphLayout = null, manualTallyLiftPx = 0 }) {
      const tallies = Array.from(manualTallies ?? []);
      if (!tallies.some(n => Number(n) > 0)) return null;

      const px = Math.max(8, Number(fontPx ?? 56));
      const fam = fontFamily || FONT_FAMILY_TEXT;
      ctx.save();
      ctx.textBaseline = "alphabetic";
      ctx.font = `${px}px "${fam}"`;
      setTextQuality(ctx);

      let detectedBottomY = Number.isFinite(Number(cartoucheBottomY))
        ? Number(cartoucheBottomY)
        : null;

      // Fallback only. Normal manual-tally cartouches should pass cartoucheBottomY
      // from the clean foreground-only mask in renderFontCartoucheToCanvas().
      if (detectedBottomY == null) {
        detectedBottomY = detectCartoucheBottomRuleY(ctx, {
          runX,
          runWidth: cartoucheRunWidth,
          baselineY,
          fontPx: px,
          canvasW: cartoucheW,
          canvasH: cartoucheH
        });
      }

      const { groups, strokeW } = computeManualCartoucheTallyGroups(ctx, innerCps, tallies, {
        fontPx: px,
        runX,
        baselineY,
        cartoucheBottomY: detectedBottomY,
        glyphLayout,
        manualTallyLiftPx
      });
      if (!groups.length) { ctx.restore(); return null; }

      // Keep the halo backing attached to the cartouche bottom rule, but start the
      // visible tally strokes slightly below that rule so they do not eat into it.
      const tallyStrokeTopInset = 0;
      let haloLayout = {
        enabled: false,
        color: haloCss || "#FFFFFF",
        padX: 0,
        padBottom: 0,
        radius: 0
      };

      if (haloEnabled) {
        const haloW = Math.max(1, haloWidthForPx(px));
        const padX = haloW * 0.85;
        const padBottom = haloW * 0.85;

        const radius = Math.max(
          1.25,
          Math.min(haloW, px * 0.045)
        );

        haloLayout = {
          enabled: true,
          color: haloCss || "#FFFFFF",
          widthPx: haloW,
          padX,
          padBottom,
          radius
        };

        ctx.save();
        ctx.fillStyle = haloCss || "#FFFFFF";

        for (const group of groups) {
          const b = group.bounds;
          const topY = b.top + tallyStrokeTopInset;

          fillRoundedRectPath(
            ctx,
            b.left - padX,
            topY,
            (b.right - b.left) + padX * 2,
            Math.max(1, (b.bottom - topY) + padBottom),
            radius
          );

          ctx.fill();
        }

        ctx.restore();
      }

      ctx.save();
      ctx.strokeStyle = fgCss || "#111";
      ctx.lineWidth = strokeW;
      ctx.lineCap = "butt";

      for (const group of groups) {
        for (const s of group.strokes) {
          ctx.beginPath();
          ctx.moveTo(s.x, s.yTop + tallyStrokeTopInset);
          ctx.lineTo(s.x, s.yBottom);
          ctx.stroke();
        }
      }

      ctx.restore();
      ctx.restore();

      // Publish the exact canvas geometry. Vector export translates this layout
      // from the cartouche canvas text origin/baseline to the vector run origin/
      // baseline instead of independently estimating tally positions.
      return {
        version: 1,
        coordinateSpace: "cartouche-canvas",
        textOriginXPx: Number(runX || 0),
        baselineYPx: Number(baselineY || 0),
        strokeWidthPx: strokeW,
        lineCap: "butt",
        topInsetPx: tallyStrokeTopInset,
        halo: haloLayout,
        groups: groups.map(group => ({
          ownerGlyphIndex: group.ownerGlyphIndex,
          count: group.count,
          bounds: { ...group.bounds },
          strokes: group.strokes.map(stroke => ({ ...stroke }))
        }))
      };
    }

    function normalizeManualTallyInputForCartouche(innerCps, manualTallies) {
      const cpsIn = Array.from(innerCps || []).map(cp => Number(cp));
      const tallyCp = (WORD_TO_UCSUR_CP && WORD_TO_UCSUR_CP[","] != null) ? WORD_TO_UCSUR_CP[","] : 0xF199E;
      const modeIsManual = (typeof getCartoucheTallyMode === "function") && getCartoucheTallyMode() === "manual";
      const commaEnabled = (typeof getCartoucheCommaTallyMarks !== "function") || getCartoucheCommaTallyMarks();
      const inputTallies = Array.isArray(manualTallies) ? manualTallies.map(n => Math.max(0, Math.min(8, Number(n) || 0))) : [];

      if (!modeIsManual || !commaEnabled) {
        return {
          cps: cpsIn,
          manualTallies: Array.isArray(manualTallies) ? inputTallies : null,
          changed: false
        };
      }

      // Final hard stop for manual mode: the font run must never contain raw
      // U+F199E or comma codepoints inside a cartouche. They are renderer
      // instructions, attached to the immediately previous non-tally glyph.
      // This is deliberately done here, at the last boundary before fillText(),
      // so raw UCSUR previews and all parser paths behave the same way.
      const outCps = [];
      const outTallies = [];
      let changed = false;
      let sourceGlyphIndex = 0;

      for (const cp of cpsIn) {
        if (cp === tallyCp || cp === 0x002C) {
          if (outTallies.length > 0) {
            const i = outTallies.length - 1;
            outTallies[i] = Math.min(8, (outTallies[i] || 0) + 1);
          }
          changed = true;
          continue;
        }

        outCps.push(cp);
        const existing = sourceGlyphIndex < inputTallies.length ? inputTallies[sourceGlyphIndex] : 0;
        outTallies.push(Math.max(0, Math.min(8, Number(existing) || 0)));
        sourceGlyphIndex += 1;
      }

      const hasAnyManual = outTallies.some(n => Number(n) > 0);
      return {
        cps: changed ? outCps : cpsIn,
        manualTallies: hasAnyManual ? outTallies : null,
        changed
      };
    }

    function renderFontCartoucheToCanvas(canvas, innerCps, { fontPx, padPx, fontFamily, fgCss, haloEnabled, haloCss, manualTallies = null, renderFullCps = null, canonicalToRenderSpans = null, manualTallyLiftPx = 0 }) {
      if (!canvas) throw new Error("renderFontCartoucheToCanvas: canvas missing");
      if (!innerCps || innerCps.length === 0) return { w: 0, h: 0, baselineY: 0 };

      const normalizedTallyInput = normalizeManualTallyInputForCartouche(innerCps, manualTallies);
      const renderInnerCps = normalizedTallyInput.cps;
      const renderManualTallies = normalizedTallyInput.manualTallies;
      if (!renderInnerCps || renderInnerCps.length === 0) return { w: 0, h: 0, baselineY: 0 };

      const px = fontPx;
      const pad = padPx;

      // Keep the left padding unchanged, but reduce right padding.
      // This avoids visible trailing transparent canvas space after numeric cartouches
      // without moving the opening cartouche edge or risking left-edge clipping.
      const padLeft = pad;
      const padRight = Math.max(0, Math.round(pad * RIGHT_CARTOUCHE_PAD_SCALE));

      const fam = fontFamily || FONT_FAMILY_TEXT;
      const hasManualTallies = !!(renderManualTallies && Array.isArray(renderManualTallies) && renderManualTallies.some(n => Number(n) > 0));

      const canonicalFullCps = [CARTOUCHE_START_CP, ...renderInnerCps, CARTOUCHE_END_CP];
      const effectiveRenderFullCps = validateRenderCodepoints(renderFullCps) || canonicalFullCps;
      const effectiveSpans = normalizeCanonicalToRenderSpans(canonicalToRenderSpans, canonicalFullCps.length, effectiveRenderFullCps.length)
        || (effectiveRenderFullCps.length === canonicalFullCps.length ? identityCanonicalToRenderSpans(canonicalFullCps) : canonicalFullCps.map((_cp, index) => ({ canonicalIndex: index, renderStart: 0, renderEnd: effectiveRenderFullCps.length })));
      const run = effectiveRenderFullCps.map(cp => String.fromCodePoint(cp)).join("");

      const ctx = canvas.getContext("2d", {  alpha: true , willReadFrequently: true });
      ctx.textBaseline = "alphabetic";
      ctx.font = `${px}px "${fam}"`;
      setTextQuality(ctx);
      const m = ctx.measureText(run);

      const ascent  = (m.actualBoundingBoxAscent  != null) ? m.actualBoundingBoxAscent  : Math.ceil(px * 0.95);
      const descent = (m.actualBoundingBoxDescent != null) ? m.actualBoundingBoxDescent : Math.ceil(px * 0.35);

      const left  = (m.actualBoundingBoxLeft  != null) ? m.actualBoundingBoxLeft  : 0;
      const right = (m.actualBoundingBoxRight != null) ? m.actualBoundingBoxRight : Math.ceil(m.width);

      const haloW = haloEnabled ? haloWidthForPx(px) : 0;
      const tallySideExtra = 0;
      const tallyBottomExtra = hasManualTallies ? Math.ceil(px * 0.34 + (haloEnabled ? haloW * 0.90 : 0)) : 0;

      const w = Math.max(1, Math.ceil(left + right + padLeft + padRight + haloW * 2 + tallySideExtra * 2));
      const h = Math.max(1, Math.ceil(ascent + descent + pad * 2 + haloW * 2 + tallyBottomExtra));

      canvas.width = w;
      canvas.height = h;

      const ctx2 = canvas.getContext("2d", { alpha: true , willReadFrequently: true});
      ctx2.clearRect(0, 0, w, h);
      ctx2.textBaseline = "alphabetic";
      ctx2.font = `${px}px "${fam}"`;
      setTextQuality(ctx2);

      const x = padLeft + left + haloW + tallySideExtra;
      const baselineY = pad + ascent + haloW;

      // Detect the cartouche bottom rule on a clean foreground-only mask.
      // Do not detect it from the final halo/composited canvas, because halo pixels
      // and anti-aliasing shift the apparent bottom edge, especially at small sizes.
      let cleanCartoucheBottomY = null;

      if (hasManualTallies) {
        const mask = document.createElement("canvas");
        mask.width = w;
        mask.height = h;

        const mctx = mask.getContext("2d", { alpha: true, willReadFrequently: true });
        mctx.clearRect(0, 0, w, h);
        mctx.textBaseline = "alphabetic";
        mctx.font = `${px}px "${fam}"`;
        setTextQuality(mctx);

        mctx.fillStyle = "#000000";
        mctx.fillText(run, x, baselineY);

        const cleanBottomInkRow = detectCartoucheBottomRuleY(mctx, {
          runX: x,
          runWidth: Math.max(1, Number(m.width || 0)),
          baselineY,
          fontPx: px,
          canvasW: w,
          canvasH: h,
          alphaThreshold: 8
        });

        // detectCartoucheBottomRuleY returns the lowest ink row of the cartouche
        // bottom rule. The manual tally strokes should start at the lower edge of
        // that row, not inside the ink row itself.
        cleanCartoucheBottomY = Number.isFinite(Number(cleanBottomInkRow))
          ? Number(cleanBottomInkRow) + 1
          : null;
      }

      if (haloEnabled) {
        ctx2.save();
        ctx2.strokeStyle = haloCss || "#FFFFFF";
        ctx2.lineWidth = haloWidthForPx(px);
        ctx2.lineJoin = "round";
        ctx2.miterLimit = 2;
        ctx2.strokeText(run, x, baselineY);
        ctx2.restore();
      }

      ctx2.fillStyle = fgCss || "#111";
      ctx2.fillText(run, x, baselineY);

      // Audio-only geometry. Canonical inner glyphs retain their semantic
      // identity while the adapter map locates the corresponding rendered span.
      const audioGlyphLayout = [];
      {
        const renderChars = effectiveRenderFullCps.map(cp => String.fromCodePoint(cp));
        const prefixAdvances = [0];
        let prefix = "";
        for (const ch of renderChars) {
          prefix += ch;
          const measured = Number(ctx2.measureText(prefix).width);
          prefixAdvances.push(Number.isFinite(measured) ? measured : prefixAdvances[prefixAdvances.length - 1]);
        }

        const top = Math.max(0, baselineY - ascent - Math.max(1, haloW));
        const componentHeight = Math.max(1, Math.min(h - top, ascent + descent + haloW * 2));
        const minimumWidth = Math.max(2, Math.round(px * 0.08));
        for (let i = 0; i < renderInnerCps.length; i++) {
          const span = effectiveSpans[i + 1] || { renderStart: 0, renderEnd: effectiveRenderFullCps.length };
          const leftAdvance = prefixAdvances[Math.max(0, Math.min(prefixAdvances.length - 1, span.renderStart))] || 0;
          const rightAdvance = prefixAdvances[Math.max(0, Math.min(prefixAdvances.length - 1, span.renderEnd))] || leftAdvance;
          const left = Math.max(0, Math.min(w, x + leftAdvance));
          const right = Math.max(left, Math.min(w, x + rightAdvance));
          audioGlyphLayout.push({
            componentIndex: i,
            cp: renderInnerCps[i],
            x: left,
            y: top,
            width: Math.max(minimumWidth, right - left),
            height: componentHeight
          });
        }
      }

      let manualTallyLayout = null;
      if (hasManualTallies) {
        manualTallyLayout = drawManualCartoucheTallies(ctx2, renderInnerCps, renderManualTallies, {
          fontPx: px,
          fontFamily: fam,
          runX: x,
          baselineY,
          cartoucheW: w,
          cartoucheH: h,
          padPx: pad,
          haloEnabled,
          haloCss,
          fgCss,
          cartoucheRunWidth: Math.max(1, Number(m.width || 0)),
          cartoucheBottomY: cleanCartoucheBottomY,
          glyphLayout: audioGlyphLayout,
          manualTallyLiftPx
        });
      }

      return {
        w,
        h,
        baselineY,
        inkAscent: Math.ceil(ascent),
        inkDescent: Math.ceil(descent + tallyBottomExtra),
        haloW,
        pad,
        padLeft,
        padRight,
        rightCartouchePadScale: RIGHT_CARTOUCHE_PAD_SCALE,
        drawX: x,
        hasManualTallies,
        renderInnerCps: Array.from(renderInnerCps),
        renderFullCps: Array.from(effectiveRenderFullCps),
        canonicalToRenderSpans: effectiveSpans.map(item => ({ ...item })),
        renderManualTallies: Array.isArray(renderManualTallies) ? renderManualTallies.slice() : null,
        audioGlyphLayout,
        manualTallyLayout: cloneManualTallyLayout(manualTallyLayout)
      };
    }

    function findFirstStableOpaqueColumn(canvas, { alphaThreshold = 8, minOpaquePixels = 4, stableCols = 2 } = {}) {
      if (!canvas) return null;
      const w = canvas.width | 0;
      const h = canvas.height | 0;
      if (w <= 0 || h <= 0) return null;

      const ctx = canvas.getContext("2d", { alpha: true , willReadFrequently: true});
      const data = ctx.getImageData(0, 0, w, h).data;
      const counts = new Int32Array(w);

      for (let y = 0; y < h; y++) {
        const row = y * w * 4;
        for (let x = 0; x < w; x++) {
          if (data[row + x * 4 + 3] > alphaThreshold) counts[x]++;
        }
      }

      for (let x = 0; x < w; x++) {
        let ok = true;
        for (let k = 0; k < stableCols; k++) {
          const xi = x + k;
          if (xi >= w || counts[xi] < minOpaquePixels) {
            ok = false;
            break;
          }
        }
        if (ok) return x;
      }
      return null;
    }

    function cropTransparentColumns(canvas, { alphaThreshold = 1 } = {}) {
      if (!canvas) return { canvas, cropLeft: 0, cropRight: 0 };
      const w = canvas.width | 0;
      const h = canvas.height | 0;
      if (w <= 0 || h <= 0) return { canvas, cropLeft: 0, cropRight: 0 };

      const ctx = canvas.getContext("2d", { alpha: true , willReadFrequently: true});
      const data = ctx.getImageData(0, 0, w, h).data;

      function columnHasInk(x) {
        for (let y = 0; y < h; y++) {
          if (data[(y * w + x) * 4 + 3] > alphaThreshold) return true;
        }
        return false;
      }

      let left = 0;
      while (left < w && !columnHasInk(left)) left++;

      let right = w - 1;
      while (right >= left && !columnHasInk(right)) right--;

      if (left === 0 && right === w - 1) return { canvas, cropLeft: 0, cropRight: 0 };

      const newW = Math.max(1, right - left + 1);
      const out = document.createElement("canvas");
      out.width = newW;
      out.height = h;

      const outCtx = out.getContext("2d", { alpha: true , willReadFrequently: true});
      outCtx.clearRect(0, 0, newW, h);
      outCtx.drawImage(canvas, left, 0, newW, h, 0, 0, newW, h);

      return { canvas: out, cropLeft: left, cropRight: Math.max(0, w - 1 - right) };
    }

    function findInteriorGlyphStartColumn(canvas, {
      alphaThreshold = 8,
      minOpaquePixels = 3,
      stableCols = 2,
      clearCols = 2,
      bandTopFrac = 0.22,
      bandBottomFrac = 0.78
    } = {}) {
      if (!canvas) return null;
      const w = canvas.width | 0;
      const h = canvas.height | 0;
      if (w <= 0 || h <= 0) return null;

      const ctx = canvas.getContext("2d", { alpha: true, willReadFrequently: true });
      const data = ctx.getImageData(0, 0, w, h).data;

      const y0 = Math.max(0, Math.min(h - 1, Math.floor(h * bandTopFrac)));
      const y1 = Math.max(y0 + 1, Math.min(h, Math.ceil(h * bandBottomFrac)));

      const counts = new Int32Array(w);
      for (let y = y0; y < y1; y++) {
        const row = y * w * 4;
        for (let x = 0; x < w; x++) {
          if (data[row + x * 4 + 3] > alphaThreshold) counts[x]++;
        }
      }

      function hasStableInkAt(x) {
        for (let k = 0; k < stableCols; k++) {
          const xi = x + k;
          if (xi >= w || counts[xi] < minOpaquePixels) return false;
        }
        return true;
      }

      function hasStableGapAt(x) {
        for (let k = 0; k < clearCols; k++) {
          const xi = x + k;
          if (xi >= w) return true;
          if (counts[xi] >= minOpaquePixels) return false;
        }
        return true;
      }

      // Find left wall in the middle band.
      let wallStart = -1;
      for (let x = 0; x < w; x++) {
        if (hasStableInkAt(x)) {
          wallStart = x;
          break;
        }
      }
      if (wallStart < 0) return null;

      // Find where that wall ends and the interior gap begins.
      let gapStart = -1;
      for (let x = wallStart + 1; x < w; x++) {
        if (hasStableGapAt(x)) {
          gapStart = x;
          break;
        }
      }
      if (gapStart < 0) return null;

      // Find first interior glyph after the gap.
      for (let x = gapStart + clearCols; x < w; x++) {
        if (hasStableInkAt(x)) return x;
      }

      return null;
    }

function repairQuotedCartoucheLeftEdgeWithLipuDonor(canvas, cps, { fontPx, padPx, fontFamily, fgCss, haloEnabled, haloCss }) {
  if (!canvas) return null;

  const donorCp = WORD_TO_UCSUR_CP["lili"];
  if (donorCp == null) return null;

  const donor = document.createElement("canvas");
  renderFontCartoucheToCanvas(donor, [donorCp], { fontPx, padPx, fontFamily, fgCss, haloEnabled, haloCss });

  const w = canvas.width | 0;
  const h = canvas.height | 0;
  const donorW = donor.width | 0;
  const donorH = donor.height | 0;
  if (w <= 0 || h <= 0 || donorW <= 0 || donorH <= 0) return canvas;

  const alphaThreshold = haloEnabled ? 4 : 12;

  function alphaAt(data, width, x, y) {
    return data[(y * width + x) * 4 + 3];
  }

  function getPixel(data, width, x, y) {
    const i = (y * width + x) * 4;
    return [data[i], data[i + 1], data[i + 2], data[i + 3]];
  }

  function setPixel(data, width, x, y, rgba) {
    const i = (y * width + x) * 4;
    data[i] = rgba[0];
    data[i + 1] = rgba[1];
    data[i + 2] = rgba[2];
    data[i + 3] = rgba[3];
  }

  function findMidlineLeftmostOpaqueX(targetCanvas) {
    const tw = targetCanvas.width | 0;
    const th = targetCanvas.height | 0;
    if (tw <= 0 || th <= 0) return null;

    const ctx = targetCanvas.getContext("2d", { alpha: true, willReadFrequently: true });
    const img = ctx.getImageData(0, 0, tw, th);
    const data = img.data;

    const rows = [
      Math.max(0, Math.min(th - 1, Math.floor(th * 0.50))),
      Math.max(0, Math.min(th - 1, Math.floor(th * 0.50) - 1)),
      Math.max(0, Math.min(th - 1, Math.floor(th * 0.50) + 1)),
    ];

    const xs = [];
    for (const y of rows) {
      let xFound = -1;
      for (let x = 0; x < tw; x++) {
        if (alphaAt(data, tw, x, y) > alphaThreshold) {
          xFound = x;
          break;
        }
      }
      if (xFound >= 0) xs.push(xFound);
    }

    if (!xs.length) return null;
    xs.sort((a, b) => a - b);
    return xs[Math.floor(xs.length / 2)];
  }

  const realAnchor = findMidlineLeftmostOpaqueX(canvas);
  const donorAnchor = findMidlineLeftmostOpaqueX(donor);

  if (realAnchor == null || donorAnchor == null) {
    return cropTransparentColumns(canvas).canvas;
  }

  const donorInteriorX =
    findInteriorGlyphStartColumn(donor, {
      alphaThreshold: alphaThreshold,
      minOpaquePixels: Math.max(2, Math.round((donor.height || 1) * 0.08)),
      stableCols: 2,
      clearCols: 2,
      bandTopFrac: 0.22,
      bandBottomFrac: 0.78
    }) ??
    Math.min(donor.width | 0, donorAnchor + Math.max(8, Math.round((donor.width || 1) * 0.18)));

  const realInteriorX =
    findInteriorGlyphStartColumn(canvas, {
      alphaThreshold: alphaThreshold,
      minOpaquePixels: Math.max(2, Math.round((canvas.height || 1) * 0.08)),
      stableCols: 2,
      clearCols: 2,
      bandTopFrac: 0.22,
      bandBottomFrac: 0.78
    }) ??
    Math.min(canvas.width | 0, realAnchor + Math.max(8, Math.round((canvas.width || 1) * 0.18)));

  const transferInteriorX = Math.min(donorInteriorX, realInteriorX);

  const destX = Math.max(0, realAnchor - donorAnchor);

  const donorCopyW = Math.max(1, Math.min(transferInteriorX, donorW, w - destX));
  const pasteW = Math.max(1, Math.min(donorCopyW, w - destX));

  const donorCtx = donor.getContext("2d", { alpha: true, willReadFrequently: true });
  const donorImg = donorCtx.getImageData(0, 0, donorW, donorH);
  const donorData = donorImg.data;

  function findFirstTransparentInsideXForRow(dy, firstDonorX) {
    if (firstDonorX < 0) return null;

    let wallEndX = -1;
    for (let x = firstDonorX; x < pasteW && x < donorW; x++) {
      if (alphaAt(donorData, donorW, x, dy) > alphaThreshold) {
        wallEndX = x;
      } else {
        break;
      }
    }

    if (wallEndX < 0) return null;

    for (let x = wallEndX + 1; x < pasteW && x < donorW; x++) {
      if (alphaAt(donorData, donorW, x, dy) <= alphaThreshold) {
        return x;
      }
    }

    return null;
  }

  const midY0 = Math.max(0, Math.floor(h * 0.25));
  const midY1 = Math.min(h, Math.ceil(h * 0.75));

  const patch = document.createElement("canvas");
  patch.width = pasteW;
  patch.height = h;
  const patchCtx = patch.getContext("2d", { alpha: true, willReadFrequently: true });
  const patchImg = patchCtx.createImageData(pasteW, h);
  const patchData = patchImg.data;

  for (let y = 0; y < h; y++) {
    const dy = Math.max(0, Math.min(donorH - 1, y));

    let firstDonorX = -1;
    for (let x = 0; x < pasteW; x++) {
      if (x < donorW && alphaAt(donorData, donorW, x, dy) > alphaThreshold) {
        firstDonorX = x;
        break;
      }
    }

    if (firstDonorX < 0) continue;

    const firstPx = getPixel(donorData, donorW, firstDonorX, dy);

    let stopX = transferInteriorX;

    if (y >= midY0 && y < midY1) {
      const insideTransparentX = findFirstTransparentInsideXForRow(dy, firstDonorX);
      if (insideTransparentX != null) {
        stopX = Math.min(stopX, insideTransparentX);
      }
    }

    for (let x = 0; x < pasteW; x++) {
      if (x < firstDonorX) {
        setPixel(patchData, pasteW, x, y, firstPx);
      } else if (x < stopX && x < donorW) {
        setPixel(patchData, pasteW, x, y, getPixel(donorData, donorW, x, dy));
      }
    }
  }

  patchCtx.putImageData(patchImg, 0, 0);

  const repair = document.createElement("canvas");
  repair.width = w;
  repair.height = h;
  const rctx = repair.getContext("2d", { alpha: true, willReadFrequently: true });
  rctx.clearRect(0, 0, w, h);
  rctx.drawImage(canvas, 0, 0);
  rctx.drawImage(patch, destX, 0);

  const repImg = rctx.getImageData(0, 0, w, h);
  const repData = repImg.data;

  for (let y = 0; y < h; y++) {
    const dy = Math.max(0, Math.min(donorH - 1, y));

    let firstDonorX = -1;
    for (let x = 0; x < pasteW; x++) {
      if (x < donorW && alphaAt(donorData, donorW, x, dy) > alphaThreshold) {
        firstDonorX = x;
        break;
      }
    }

    if (firstDonorX < 0) continue;

    for (let x = 0; x < firstDonorX; x++) {
      const tx = destX + x;
      if (tx < 0 || tx >= w) continue;
      const i = (y * w + tx) * 4;
      repData[i + 3] = 0;
    }
  }

  rctx.putImageData(repImg, 0, 0);

  let repairedCanvas = repair;
  if (destX > 0) {
    const cropped = document.createElement("canvas");
    cropped.width = Math.max(1, w - destX);
    cropped.height = h;

    const cctx = cropped.getContext("2d", { alpha: true, willReadFrequently: true });
    cctx.clearRect(0, 0, cropped.width, h);
    cctx.drawImage(repair, destX, 0, cropped.width, h, 0, 0, cropped.width, h);

    repairedCanvas = cropTransparentColumns(cropped).canvas;
  } else {
    repairedCanvas = cropTransparentColumns(repair).canvas;
  }

  const haloW = haloEnabled ? haloWidthForPx(fontPx) : 0;
  const leftPad = Math.max(0, Math.round(Number(padPx) || 0)) + haloW;
  const rightPad = Math.max(0, Math.round(Number(padPx) || 0)) + haloW;

  const repairedW = repairedCanvas.width | 0;
  const repairedH = repairedCanvas.height | 0;

  const finalCanvas = document.createElement("canvas");
  finalCanvas.width = Math.max(1, repairedW + leftPad + rightPad);
  finalCanvas.height = Math.max(1, repairedH);

  const fctx = finalCanvas.getContext("2d", { alpha: true, willReadFrequently: true });
  fctx.clearRect(0, 0, finalCanvas.width, finalCanvas.height);
  fctx.drawImage(repairedCanvas, leftPad, 0);

  return finalCanvas;
}

    function makeCartoucheElementFromCodepoints(elements, cps, { fontPx, fontFamily, fontRole = null, fgCss, sourceText = null, sourceStart = null, sourceEnd = null, sourceKind = null, sourceSegmentIndex = null, repairQuotedLatinLeftEdge = false, manualTallies = null, isLiteralCartouche = false, isNumericCartouche = false, audioSourceCps = null, audioSourceIndices = null } = {}) {
      if (!cps || cps.length === 0) return;
      pushGapIfNeeded(elements, cartoucheLeadGapForPx(fontPx));

      const canonicalInnerCps = Array.from(cps, cp => Number(cp));
      const normalizedTallyInput = normalizeManualTallyInputForCartouche(canonicalInnerCps, manualTallies);
      const canonicalRenderInnerCps = normalizedTallyInput.cps;
      const normalizedManualTallies = normalizedTallyInput.manualTallies;
      const canonicalFullCps = [CARTOUCHE_START_CP, ...canonicalRenderInnerCps, CARTOUCHE_END_CP];
      const effectiveRole = fontRole || (isNumericCartouche ? "number" : "cartouche");
      const adapted = adaptCanonicalCodepointsForFont(canonicalFullCps, {
        fontRole: effectiveRole,
        elementKind: "cartouche",
        fontFamily: fontFamily || FONT_FAMILY_TEXT,
        sourceText,
        sourceKind,
        sourceSegmentIndex,
        isNumericCartouche: !!isNumericCartouche,
        isLiteralCartouche: !!isLiteralCartouche,
        bypassRenderAdapter: !!isLiteralCartouche
      });

      const cart = document.createElement("canvas");
      const padPx = cartouchePadForPx(fontPx);

      const haloEnabled = getHaloEnabled();
      const haloCss = getHaloHex();
      const manualTallyLiftPx = manualTallySmallFontLiftFor(fontFamily || FONT_FAMILY_TEXT, fontPx);

      const r = renderFontCartoucheToCanvas(cart, canonicalRenderInnerCps, {
        fontPx,
        padPx,
        fontFamily,
        fgCss,
        haloEnabled,
        haloCss,
        manualTallies: normalizedManualTallies,
        renderFullCps: adapted.renderCps,
        canonicalToRenderSpans: adapted.canonicalToRenderSpans,
        manualTallyLiftPx
      });
      if ((r.w | 0) <= 0 || (r.h | 0) <= 0) return;

      let finalCanvas = cart;
      if (repairQuotedLatinLeftEdge) {
        finalCanvas = repairQuotedCartoucheLeftEdgeWithLipuDonor(cart, canonicalRenderInnerCps, { fontPx, padPx, fontFamily, fgCss, haloEnabled, haloCss }) || cart;
      }

      const finalW = finalCanvas.width | 0;
      const finalH = finalCanvas.height | 0;
      if (finalW <= 0 || finalH <= 0) return;

      const baselineY = Math.min(finalH, r.baselineY | 0);
      const ascent = Math.min(finalH, r.inkAscent ?? baselineY);
      const descent = Math.max(0, Math.min(finalH - ascent, r.inkDescent ?? (finalH - baselineY)));

      const renderedAudioCps = Array.from(r.renderInnerCps || canonicalRenderInnerCps || []);
      const normalizedAudioSourceCps = Array.from(audioSourceCps || canonicalInnerCps || []);
      const normalizedAudioSourceIndices = Array.isArray(audioSourceIndices) && audioSourceIndices.length === renderedAudioCps.length
        ? audioSourceIndices.map((value, index) => Number.isFinite(Number(value)) ? Number(value) : index)
        : renderedAudioCps.map((_cp, index) => index);
      const normalizedAudioGlyphLayout = Array.isArray(r.audioGlyphLayout)
        ? r.audioGlyphLayout.map((item, index) => ({
            ...item,
            componentIndex: index,
            sourceIndex: normalizedAudioSourceIndices[index] ?? index
          }))
        : [];

      nanpaDebugEmit("cartouche-element:push", {
        sourceText,
        sourceStart,
        sourceEnd,
        sourceKind,
        sourceSegmentIndex,
        fontFamily: fontFamily || FONT_FAMILY_TEXT,
        fontRole: effectiveRole,
        fontPx,
        finalW,
        finalH,
        cps: nanpaDebugCps(canonicalInnerCps),
        renderFullCps: nanpaDebugCps(adapted.renderCps),
        renderAdapterId: adapted.renderAdapterId,
        manualTallies: Array.isArray(normalizedManualTallies) ? normalizedManualTallies.slice() : null,
        isLiteralCartouche: !!isLiteralCartouche,
        isNumericCartouche: !!isNumericCartouche
      });

      elements.push({
        type: "cartouche",
        cps: canonicalInnerCps.slice(),
        canonicalCps: canonicalInnerCps.slice(),
        canonicalFullCps: canonicalFullCps.slice(),
        renderCps: adapted.renderCps.slice(),
        renderFullCps: adapted.renderCps.slice(),
        canonicalToRenderSpans: adapted.canonicalToRenderSpans.map(item => ({ ...item })),
        ...(adapted.syntheticCornerBrackets.length ? {
          syntheticCornerBrackets: adapted.syntheticCornerBrackets.map(item => ({ ...item }))
        } : {}),
        renderAdapterId: adapted.renderAdapterId,
        requestedRenderAdapterId: adapted.requestedRenderAdapterId,
        longGlyphPresentation: adapted.longGlyphPresentation,
        canvas: finalCanvas,
        w: finalW,
        h: finalH,
        baselineY,
        ascent,
        descent,
        fontFamily: fontFamily || FONT_FAMILY_TEXT,
        fontRole: effectiveRole,
        repairQuotedLatinLeftEdge: !!repairQuotedLatinLeftEdge,
        isLiteralCartouche: !!isLiteralCartouche,
        isNumericCartouche: !!isNumericCartouche,
        manualTallies: Array.isArray(normalizedManualTallies) ? normalizedManualTallies.slice() : null,
        manualTallyLayout: cloneManualTallyLayout(r.manualTallyLayout),
        manualTallyLiftPx,
        manualTallySmallFontMaxPx: __manualTallySmallFontMaxPx,
        audioSourceCps: normalizedAudioSourceCps,
        audioSourceIndices: normalizedAudioSourceIndices,
        audioGlyphLayout: normalizedAudioGlyphLayout,
        sourceText: (typeof sourceText === 'string') ? sourceText : null,
        sourceStart: Number.isFinite(Number(sourceStart)) ? Number(sourceStart) : null,
        sourceEnd: Number.isFinite(Number(sourceEnd)) ? Number(sourceEnd) : null,
        sourceKind: (typeof sourceKind === 'string') ? sourceKind : null,
        sourceSegmentIndex: Number.isFinite(Number(sourceSegmentIndex)) ? Number(sourceSegmentIndex) : null
      });
    }

    function makeRunElementFromCodepoints(elements, cps, { fontPx, fontFamily, fontRole = "word", elementKind = "run", sourceText = null, sourceStart = null, sourceEnd = null, sourceKind = null, sourceSegmentIndex = null, bypassRenderAdapter = false } = {}) {
      if (!cps || cps.length === 0) return;
      pushGapIfNeeded(elements, wordGapForPx(fontPx));
      const canonicalCps = Array.from(cps, cp => Number(cp));
      const adapted = adaptCanonicalCodepointsForFont(canonicalCps, {
        fontRole,
        elementKind,
        fontFamily: fontFamily || FONT_FAMILY_TEXT,
        sourceText,
        sourceKind,
        sourceSegmentIndex,
        bypassRenderAdapter
      });

      elements.push({
        type: "run",
        cps: canonicalCps.slice(),
        canonicalCps: canonicalCps.slice(),
        renderCps: adapted.renderCps.slice(),
        canonicalToRenderSpans: adapted.canonicalToRenderSpans.map(item => ({ ...item })),
        ...(adapted.syntheticCornerBrackets.length ? {
          syntheticCornerBrackets: adapted.syntheticCornerBrackets.map(item => ({ ...item }))
        } : {}),
        renderAdapterId: adapted.renderAdapterId,
        requestedRenderAdapterId: adapted.requestedRenderAdapterId,
        longGlyphPresentation: adapted.longGlyphPresentation,
        px: fontPx,
        fontFamily: fontFamily || FONT_FAMILY_TEXT,
        fontRole,
        sourceText: (typeof sourceText === 'string') ? sourceText : null,
        sourceStart: Number.isFinite(Number(sourceStart)) ? Number(sourceStart) : null,
        sourceEnd: Number.isFinite(Number(sourceEnd)) ? Number(sourceEnd) : null,
        sourceKind: (typeof sourceKind === 'string') ? sourceKind : null,
        sourceSegmentIndex: Number.isFinite(Number(sourceSegmentIndex)) ? Number(sourceSegmentIndex) : null
      });
    }

    function makeGlyphElementFromCodepoint(elements, cp, { fontPx, fontFamily, fontRole = "word", sourceText = null, sourceStart = null, sourceEnd = null, sourceKind = null, sourceSegmentIndex = null } = {}) {
      const canonicalCp = Number(cp);
      if (!isUnicodeScalarValue(canonicalCp)) return;
      pushGapIfNeeded(elements, wordGapForPx(fontPx));
      const adapted = adaptCanonicalCodepointsForFont([canonicalCp], {
        fontRole,
        elementKind: "glyph",
        fontFamily: fontFamily || FONT_FAMILY_TEXT,
        sourceText,
        sourceKind,
        sourceSegmentIndex
      });
      const common = {
        canonicalCps: [canonicalCp],
        renderCps: adapted.renderCps.slice(),
        canonicalToRenderSpans: adapted.canonicalToRenderSpans.map(item => ({ ...item })),
        ...(adapted.syntheticCornerBrackets.length ? {
          syntheticCornerBrackets: adapted.syntheticCornerBrackets.map(item => ({ ...item }))
        } : {}),
        renderAdapterId: adapted.renderAdapterId,
        requestedRenderAdapterId: adapted.requestedRenderAdapterId,
        longGlyphPresentation: adapted.longGlyphPresentation,
        px: fontPx,
        fontFamily: fontFamily || FONT_FAMILY_TEXT,
        fontRole,
        sourceText: (typeof sourceText === 'string') ? sourceText : null,
        sourceStart: Number.isFinite(Number(sourceStart)) ? Number(sourceStart) : null,
        sourceEnd: Number.isFinite(Number(sourceEnd)) ? Number(sourceEnd) : null,
        sourceKind: (typeof sourceKind === 'string') ? sourceKind : null,
        sourceSegmentIndex: Number.isFinite(Number(sourceSegmentIndex)) ? Number(sourceSegmentIndex) : null
      };
      if (adapted.renderCps.length === 1) {
        elements.push({ ...common, type: "glyph", cp: canonicalCp, renderCp: adapted.renderCps[0] });
      } else {
        elements.push({ ...common, type: "run", cps: [canonicalCp] });
      }
    }


    function emitRawUcsurCodepointsWithOptionalManualTallies(elements, cps, { fontPx, fontFamily, sourceKind = 'rawUcsur', sourceSegmentIndex = null } = {}) {
      const input = Array.from(cps ?? []);
      if (!input.length) return false;
      if (getCartoucheTallyMode() !== "manual" || !getCartoucheCommaTallyMarks()) return false;

      let hasManualCandidate = false;
      let depth = 0;
      for (const cp of input) {
        if (cp === CARTOUCHE_START_CP) { depth++; continue; }
        if (cp === CARTOUCHE_END_CP) { depth = Math.max(0, depth - 1); continue; }
        if (depth > 0 && (cp === WORD_TO_UCSUR_CP[","] || cp === 0x002C)) {
          hasManualCandidate = true;
          break;
        }
      }
      if (!hasManualCandidate) return false;

      const flushRun = (run) => {
        if (run.length) makeRunElementFromCodepoints(elements, run, { fontPx, fontFamily: fontFamily || FONT_FAMILY_TEXT, sourceKind, sourceSegmentIndex });
      };

      let i = 0;
      let pendingRun = [];
      let changed = false;
      while (i < input.length) {
        const cp = input[i];
        if (cp !== CARTOUCHE_START_CP) {
          pendingRun.push(cp);
          i++;
          continue;
        }

        let j = i + 1;
        while (j < input.length && input[j] !== CARTOUCHE_END_CP) j++;
        if (j >= input.length) {
          pendingRun.push(cp);
          i++;
          continue;
        }

        const innerRaw = input.slice(i + 1, j);
        const innerCps = [];
        const manualTallies = [];
        let cartoucheChanged = false;

        for (const innerCp of innerRaw) {
          if (innerCp === WORD_TO_UCSUR_CP[","] || innerCp === 0x002C) {
            if (manualTallies.length > 0) {
              const k = manualTallies.length - 1;
              manualTallies[k] = Math.min(8, (manualTallies[k] || 0) + 1);
              cartoucheChanged = true;
            }
            continue;
          }
          innerCps.push(innerCp);
          manualTallies.push(0);
        }

        if (!cartoucheChanged || !innerCps.length) {
          pendingRun.push(...input.slice(i, j + 1));
          i = j + 1;
          continue;
        }

        flushRun(pendingRun);
        pendingRun = [];
        makeCartoucheElementFromCodepoints(elements, innerCps, {
          fontPx,
          fontFamily: fontFamily || FONT_FAMILY_TEXT,
          fgCss: getFgHex(),
          manualTallies,
          sourceKind,
          sourceSegmentIndex
        });
        changed = true;
        i = j + 1;
      }

      flushRun(pendingRun);
      return changed;
    }

    function renderTpWordsFromText(text, elements, { fontPx, mode, sourceBaseStart = 0, sourceKind = 'text', sourceSegmentIndex = null, mixedStyle = "short" }) {
      const s = String(text ?? "");
      nanpaDebugEmit("render-tp-words:start", { text: s, fontPx, mode, sourceBaseStart, sourceKind, sourceSegmentIndex, mixedStyle });
      const rawTokens = [];
      // Non-ASCII dash/minus lookalikes are ordinary word separators, never
      // compound operators. Numeric expressions are recognized before this
      // ordinary-word fallback, so their existing Unicode-minus handling is
      // unaffected. ASCII U+002D remains available to the SSK compound parser.
      const tokenRe = /[^\s\u2010\u2011\u2012\u2013\u2014\u2212\uFE63\uFF0D]+/g;
      let tm;
      while ((tm = tokenRe.exec(s)) !== null) {
        rawTokens.push({ text: tm[0], start: tm.index, end: tm.index + tm[0].length });
      }

      function emitPunctGlyph(ch, start, end) {
        // Outside cartouches, comma must never be translated to the sitelen
        // pona combining tally mark. Only these non-comma punctuation glyphs
        // are emitted through the sitelen font path.
        if (ch !== ":" && ch !== "·" && ch !== ".") return false;
        const cp = WORD_TO_UCSUR_CP[ch];
        if (cp == null) return false;
        makeGlyphElementFromCodepoint(elements, cp, { fontPx, fontFamily: FONT_FAMILY_TEXT, sourceText: String(ch), sourceStart: sourceBaseStart + start, sourceEnd: sourceBaseStart + end, sourceKind, sourceSegmentIndex });
        return true;
      }

      function splitTokenPunct(tok) {
        const sv = String(tok ?? "");
        if (!sv) return { lead: "", core: "", trail: "" };
        const numericLike = /[0-9]/.test(sv) || /^-?\.\d/.test(sv) || /^-?\d/.test(sv);
        const coreChar = numericLike ? /[#~A-Za-z0-9^<>.,_-]/ : /[#~A-Za-z0-9^<>]/;
        let a = 0;
        let b = sv.length;
        while (a < b && !coreChar.test(sv[a])) a++;
        while (b > a && !coreChar.test(sv[b - 1])) b--;
        while (b > a && /[)\]}.,;:!?]+$/.test(sv.slice(b - 1, b))) b--;
        return { lead: sv.slice(0, a), core: sv.slice(a, b), trail: sv.slice(b), leadLen: a, coreStart: a, coreEnd: b };
      }

      for (let i = 0; i < rawTokens.length; i++) {
        const tokMeta = rawTokens[i];
        const tok = tokMeta.text;
        const normTok = normalizeTpWord(tok);

        if (normTok === "pi") {
          const nextTok = rawTokens[i + 1]?.text;
          if (nextTok != null && tokenHasOpenCurly(nextTok)) {
            const extracted = extractCurlyContentFromTokens(rawTokens.map(t => t.text), i + 1);
            if (extracted && extracted.inner != null) {
              const innerWords = parseKnownTpWords(extracted.inner);
              if (innerWords.length >= 2) {
                const cps = [];
                cps.push(LONG_PI_START_CP);
                cps.push(WORD_TO_UCSUR_CP[innerWords[0]]);
                for (let k = 1; k < innerWords.length; k++) {
                  cps.push(LONG_PI_EXT_CP);
                  cps.push(WORD_TO_UCSUR_CP[innerWords[k]]);
                }
                const sourceStart = tokMeta.start;
                const sourceEnd = rawTokens[extracted.endIndex]?.end ?? tokMeta.end;
                makeRunElementFromCodepoints(elements, cps, { fontPx, fontFamily: FONT_FAMILY_TEXT, sourceText: s.slice(sourceStart, sourceEnd), sourceStart: sourceBaseStart + sourceStart, sourceEnd: sourceBaseStart + sourceEnd, sourceKind, sourceSegmentIndex });
                i = extracted.endIndex;
                continue;
              }
            }
          }
        }

        const { lead, core, trail, leadLen, coreStart, coreEnd } = splitTokenPunct(tok);
        for (let j = 0; j < lead.length; j++) emitPunctGlyph(lead[j], tokMeta.start + j, tokMeta.start + j + 1);

        const trimmed = core;
        const trimmedStart = tokMeta.start + coreStart;
        const trimmedEnd = tokMeta.start + coreEnd;

        if (trimmed) {
          // These exact standard alias names must win before both the numeric
          // identifier decoder and the generic "contains a digit" path.
          const aliasGlyphKey = resolveTpGlyphAliasKey(trimmed);
          const aliasGlyphCp = aliasGlyphKey ? WORD_TO_UCSUR_CP[aliasGlyphKey] : null;
          if (aliasGlyphCp != null) {
            makeGlyphElementFromCodepoint(elements, aliasGlyphCp, {
              fontPx,
              fontFamily: FONT_FAMILY_TEXT,
              sourceText: trimmed,
              sourceStart: sourceBaseStart + trimmedStart,
              sourceEnd: sourceBaseStart + trimmedEnd,
              sourceKind,
              sourceSegmentIndex
            });
            for (let j = 0; j < trail.length; j++) emitPunctGlyph(trail[j], tokMeta.end - trail.length + j, tokMeta.end - trail.length + j + 1);
            continue;
          }

          const idCps = tryDecodeNanpaLinjanIdentifierToCodepoints(trimmed, { mode }) ?? tryDecodeNanpaLinjanIdentifierToCodepoints(trimmed.replace(/\s+/g, ""), { mode });
          if (idCps && idCps.length) {
            nanpaDebugEmit("render-tp-words:token-decoded-as-numeric-identifier", {
              token: tok,
              trimmed,
              sourceStart: sourceBaseStart + trimmedStart,
              sourceEnd: sourceBaseStart + trimmedEnd,
              cps: nanpaDebugCps(idCps)
            });
            makeNumericCartoucheElementFromCodepoints(elements, idCps, { fontPx, fgCss: getFgHex(), sourceText: trimmed, sourceStart: sourceBaseStart + trimmedStart, sourceEnd: sourceBaseStart + trimmedEnd, sourceKind, sourceSegmentIndex });
            for (let j = 0; j < trail.length; j++) emitPunctGlyph(trail[j], tokMeta.end - trail.length + j, tokMeta.end - trail.length + j + 1);
            continue;
          }
        }

        if (trimmed && /[0-9]/.test(trimmed)) {
          const dateTimeCandidate = trimmed.replace(/"\s*:\s*"/g, ":").replace(/"\s*:\s*/g, ":").replace(/\s*:\s*"/g, ":");
          const dateCaps = (typeof dateStrToNanpaCaps === "function") ? dateStrToNanpaCaps(dateTimeCandidate) : null;
          if (dateCaps) {
            const cps = nanpaCapsToNanpaLinjanCodepoints(dateCaps, { mode, isTime: true });
            if (cps && cps.length) {
              makeNumericCartoucheElementFromCodepoints(elements, cps, { fontPx, fgCss: getFgHex(), sourceText: trimmed, sourceStart: sourceBaseStart + trimmedStart, sourceEnd: sourceBaseStart + trimmedEnd, sourceKind, sourceSegmentIndex });
              for (let j = 0; j < trail.length; j++) emitPunctGlyph(trail[j], tokMeta.end - trail.length + j, tokMeta.end - trail.length + j + 1);
              continue;
            }
          }
          const timeCaps = (typeof timeStrToNanpaCaps === "function") ? timeStrToNanpaCaps(dateTimeCandidate) : null;
          if (timeCaps) {
            const cps = nanpaCapsToNanpaLinjanCodepoints(timeCaps, { mode, isTime: true });
            if (cps && cps.length) {
              makeNumericCartoucheElementFromCodepoints(elements, cps, { fontPx, fgCss: getFgHex(), sourceText: trimmed, sourceStart: sourceBaseStart + trimmedStart, sourceEnd: sourceBaseStart + trimmedEnd, sourceKind, sourceSegmentIndex });
              for (let j = 0; j < trail.length; j++) emitPunctGlyph(trail[j], tokMeta.end - trail.length + j, tokMeta.end - trail.length + j + 1);
              continue;
            }
          }
          try {
            const caps = decimalStringToCaps(trimmed, { thousandsChar: ",", groupFractionTriplets: true, fractionGroupSize: 3, mixedStyle });
            const cps = nanpaCapsToNanpaLinjanCodepoints(caps, { mode });
            if (cps && cps.length) {
              makeNumericCartoucheElementFromCodepoints(elements, cps, { fontPx, fgCss: getFgHex(), sourceText: trimmed, sourceStart: sourceBaseStart + trimmedStart, sourceEnd: sourceBaseStart + trimmedEnd, sourceKind, sourceSegmentIndex });
              for (let j = 0; j < trail.length; j++) emitPunctGlyph(trail[j], tokMeta.end - trail.length + j, tokMeta.end - trail.length + j + 1);
              continue;
            }
          } catch {}
        }

        if (trimmed && getAutoCartoucheStandaloneProperNames() && isStandaloneCapitalizedProperNameCandidate(trimmed)) {
          const properNameCps = lettersToStrictRandomProperNameGlyphCps(trimmed);
          if (properNameCps && properNameCps.length) {
            makeCartoucheElementFromCodepoints(elements, properNameCps, {
              fontPx,
              fontFamily: FONT_FAMILY_TEXT,
              fgCss: getFgHex(),
              sourceText: trimmed,
              sourceStart: sourceBaseStart + trimmedStart,
              sourceEnd: sourceBaseStart + trimmedEnd,
              sourceKind,
              sourceSegmentIndex
            });
          } else {
            emitUnknownTextElement(elements, trimmed, {
              fontPx,
              sourceStart: sourceBaseStart + trimmedStart,
              sourceEnd: sourceBaseStart + trimmedEnd,
              sourceKind,
              sourceSegmentIndex
            });
          }

          for (let j = 0; j < trail.length; j++) emitPunctGlyph(trail[j], tokMeta.end - trail.length + j, tokMeta.end - trail.length + j + 1);
          continue;
        }

        const glyphKey = normalizeTpGlyphKey(trimmed);

        // Outside cartouches, zz is an ideographic space/indent cell.
        // Render it through the literal font path so its advance matches the
        // page's normal U+3000 behavior instead of the sitelen glyph font.
        if (glyphKey === "zz") {
          makeLiteralTextElement(elements, "\u3000", {
            fontPx,
            fontFamily: FONT_FAMILY_LITERAL,
            addLeadingGap: true,
            sourceText: trimmed,
            sourceStart: sourceBaseStart + trimmedStart,
            sourceEnd: sourceBaseStart + trimmedEnd,
            sourceKind,
            sourceSegmentIndex,
          });
        } else if (glyphKey && WORD_TO_UCSUR_CP[glyphKey] != null) {
          makeGlyphElementFromCodepoint(elements, WORD_TO_UCSUR_CP[glyphKey], { fontPx, fontFamily: FONT_FAMILY_TEXT, sourceText: trimmed, sourceStart: sourceBaseStart + trimmedStart, sourceEnd: sourceBaseStart + trimmedEnd, sourceKind, sourceSegmentIndex });
        } else if (trimmed) {
          emitUnknownTextElement(elements, trimmed, {
            fontPx,
            sourceStart: sourceBaseStart + trimmedStart,
            sourceEnd: sourceBaseStart + trimmedEnd,
            sourceKind,
            sourceSegmentIndex
          });
        }

        for (let j = 0; j < trail.length; j++) emitPunctGlyph(trail[j], tokMeta.end - trail.length + j, tokMeta.end - trail.length + j + 1);
      }
    }

    function renderGeneratedNasinNanpaPonaWordsAsOrdinaryText(words, elements, { fontPx, mode, sourceText, sourceStart, sourceEnd, sourceKind = 'text', sourceSegmentIndex = null, mixedStyle = "short" }) {
      const generatedText = Array.from(words ?? []).join(" ");
      if (!generatedText) return;

      const firstNewElement = elements.length;
      renderTpWordsFromText(generatedText, elements, {
        fontPx,
        mode,
        sourceBaseStart: 0,
        sourceKind,
        sourceSegmentIndex,
        mixedStyle
      });

      // Reuse the exact ordinary-word rendering path, then attach the original
      // numeric source span to every generated glyph. Preserve each generated
      // Toki Pona word separately as audioText so audio can speak the rendered
      // words without losing the original numeric source used by selection and
      // Unicode JSON reconstruction. Gaps remain ordinary gaps.
      let generatedWordIndex = 0;
      for (let i = firstNewElement; i < elements.length; i++) {
        const el = elements[i];
        if (!el || el.type === "gap") continue;
        el.sourceText = String(sourceText ?? "");
        el.sourceStart = Number.isFinite(Number(sourceStart)) ? Number(sourceStart) : null;
        el.sourceEnd = Number.isFinite(Number(sourceEnd)) ? Number(sourceEnd) : null;
        el.sourceKind = sourceKind;
        el.sourceSegmentIndex = sourceSegmentIndex;
        el.audioText = String(words[generatedWordIndex] ?? "");
        el.sourceTransform = "nasinNanpaPona";
        generatedWordIndex += 1;
      }
    }

    function parseTextSegmentToElements(segmentText, elements, { fontPx, sourceBaseStart = 0, sourceKind = 'text', sourceSegmentIndex = null, mixedStyle = "short", allowRawCodepoints = true }) {
      const mode = getNanpaLinjanMode();
      const s = String(segmentText ?? "");
      if (!s.trim()) return;

      // Explicit U+ escapes have highest precedence. Consecutive escapes form one
      // exact font run; horizontal whitespace between them is source formatting
      // and does not emit a space. Use U+00A0 when a visible non-breaking space
      // is required in the output sequence.
      if (allowRawCodepoints) {
        const rawHits = findRawUnicodeCodepointSequences(s);
        if (rawHits.length) {
          nanpaDebugEmit("parse-text:raw-codepoint-hits", {
            segmentText: s,
            hits: rawHits.map(h => ({
              sourceText: s.slice(h.index, h.end),
              index: h.index,
              end: h.end,
              cps: nanpaDebugCps(h.cps)
            }))
          });

          let pos = 0;
          for (const hit of rawHits) {
            if (hit.index > pos) {
              parseTextSegmentToElements(s.slice(pos, hit.index), elements, {
                fontPx,
                sourceBaseStart: sourceBaseStart + pos,
                sourceKind,
                sourceSegmentIndex,
                mixedStyle,
                allowRawCodepoints: false
              });
            }

            makeRunElementFromCodepoints(elements, hit.cps, {
              fontPx,
              fontFamily: FONT_FAMILY_TEXT,
              sourceText: s.slice(hit.index, hit.end),
              sourceStart: sourceBaseStart + hit.index,
              sourceEnd: sourceBaseStart + hit.end,
              sourceKind,
              sourceSegmentIndex,
              bypassRenderAdapter: true
            });
            pos = hit.end;
          }

          if (pos < s.length) {
            parseTextSegmentToElements(s.slice(pos), elements, {
              fontPx,
              sourceBaseStart: sourceBaseStart + pos,
              sourceKind,
              sourceSegmentIndex,
              mixedStyle,
              allowRawCodepoints: false
            });
          }
          return;
        }
      }

      nanpaDebugEmit("parse-text:start", { segmentText: s, fontPx, mode, sourceBaseStart, sourceKind, sourceSegmentIndex, mixedStyle });

      // Protect the six exact digit-bearing alternative-glyph aliases from
      // every numeric scanner. Then, for non-alias tokens such as ni2 or ni020,
      // create a dedicated hit for the complete numeric suffix, including any
      // leading zeros, and hide the whole combined token from general scanners.
      // This prevents that suffix from merging with any later text or number on
      // the same line. Both masks retain the original string length, so hit
      // offsets stay aligned to the source.
      const aliasScan = maskTpGlyphAliasesForNumericScanning(s);
      const glyphSuffixScan = maskTpGlyphPrefixesBeforeNumericSuffixes(aliasScan.text, { mixedStyle });
      const numericScanText = glyphSuffixScan.text;
      const glyphSuffixHits = glyphSuffixScan.hits;

      // Optional hexadecimal recognizers run in their own namespace. When the
      // flag is off they contribute no hits and the existing decimal pipeline
      // receives the source unchanged.
      const hexHits = getEnableHexParsing()
        ? [
            ...findHexHashSequences(s),
            ...findHexProperNameSequences(s, { relaxedParsing: getRelaxedNanpaLinjanParsing() })
          ]
        : [];
      const binaryHits = getEnableBinaryParsing()
        ? [
            ...findBinaryPrefixSequences(s),
            ...findBinaryProperNameSequences(s, { relaxedParsing: getRelaxedNanpaLinjanParsing() })
          ]
        : [];

      // Dates must be recognized first. Mask valid date spans before running
      // the time scanner so any present or future overlapping time grammar
      // cannot reinterpret a value that has already passed date validation.
      const dateHits = findDateSequencesWithCaps(numericScanText);
      const timeScanText = maskNumericScanRanges(numericScanText, dateHits);
      const timeHits = findTimeSequencesWithCaps(timeScanText);
      const decHits = findDecimalSequencesWithCaps(numericScanText, { thousandsChar: ",", groupFractionTriplets: true, fractionGroupSize: 3, mixedStyle });
      if (getNasinNanpaPona()) {
        for (const hit of decHits) {
          if (!nasinNanpaPonaHitHasStandaloneNumericContext(s, hit)) continue;
          const converted = tryConvertPlainDecimalToNasinNanpaPonaWords(hit.match);
          if (converted?.words?.length) {
            hit.nasinNanpaPonaWords = converted.words;
          }
        }
      }
      const codeHits = findNumberCodeSequencesWithCaps(numericScanText);
      const nameHits = findNanpaLinjanProperNameSequencesWithCaps(numericScanText);
      const phraseHits = findNanpaLinjanTpPhraseSequences(numericScanText);

      nanpaDebugEmit("parse-text:raw-hit-counts", {
        segmentText: s,
        protectedGlyphAliases: aliasScan.spans,
        splitGlyphNumericSuffixes: glyphSuffixScan.spans,
        glyphSuffixHits: glyphSuffixHits.length,
        timeHits: timeHits.length,
        dateHits: dateHits.length,
        decHits: decHits.length,
        codeHits: codeHits.length,
        nameHits: nameHits.length,
        phraseHits: phraseHits.length,
        hexHits: hexHits.length,
        binaryHits: binaryHits.length,
        rawHits: [...binaryHits, ...hexHits, ...glyphSuffixHits, ...dateHits, ...timeHits, ...decHits, ...phraseHits, ...codeHits, ...nameHits].map(h => ({
          kind: h.kind,
          sourceText: s.slice(h.index, h.end),
          index: h.index,
          end: h.end,
          caps: h.caps || null,
          words: Array.isArray(h.words) ? h.words.join(" ") : null,
          nasinNanpaPonaWords: Array.isArray(h.nasinNanpaPonaWords) ? h.nasinNanpaPonaWords.join(" ") : null,
          hexDigits: h.hexSemantic?.digits || null,
          binaryDigits: h.binarySemantic?.digits || null
        }))
      });

      const hits = mergeAndGreedyFilterHits([...binaryHits, ...hexHits, ...glyphSuffixHits, ...dateHits, ...timeHits, ...decHits, ...phraseHits, ...codeHits, ...nameHits]);

      nanpaDebugTable("parse-text:selected-hits", hits.map(h => ({
        kind: h.kind,
        sourceText: s.slice(h.index, h.end),
        index: h.index,
        end: h.end,
        caps: h.caps || null,
        words: Array.isArray(h.words) ? h.words.join(" ") : null,
        nasinNanpaPonaWords: Array.isArray(h.nasinNanpaPonaWords) ? h.nasinNanpaPonaWords.join(" ") : null
      })));

      if (!hits || hits.length === 0) {
        renderTpWordsFromText(s, elements, { fontPx, mode, sourceBaseStart, sourceKind, sourceSegmentIndex, mixedStyle });
        return;
      }

      let pos = 0;
      for (const h of hits) {
        const a = Math.max(0, h.index | 0);
        const b = Math.max(a, h.end | 0);
        if (a > pos) {
          renderTpWordsFromText(s.slice(pos, a), elements, { fontPx, mode, sourceBaseStart: sourceBaseStart + pos, sourceKind, sourceSegmentIndex, mixedStyle });
        }
        const fgCss = getFgHex();
        const matchText = s.slice(a, b);
        if (Array.isArray(h.nasinNanpaPonaWords) && h.nasinNanpaPonaWords.length > 0) {
          renderGeneratedNasinNanpaPonaWordsAsOrdinaryText(h.nasinNanpaPonaWords, elements, {
            fontPx,
            mode,
            sourceText: matchText,
            sourceStart: sourceBaseStart + a,
            sourceEnd: sourceBaseStart + b,
            sourceKind,
            sourceSegmentIndex,
            mixedStyle
          });
        } else if (h.kind === "binary" && h.binarySemantic) {
          makeBinaryNumericCartoucheElementFromSemantic(elements, h.binarySemantic, {
            fontPx,
            fgCss,
            sourceText: matchText,
            sourceStart: sourceBaseStart + a,
            sourceEnd: sourceBaseStart + b,
            sourceKind,
            sourceSegmentIndex
          });
        } else if (h.kind === "hex" && h.hexSemantic) {
          makeHexNumericCartoucheElementFromSemantic(elements, h.hexSemantic, {
            fontPx,
            fgCss,
            sourceText: matchText,
            sourceStart: sourceBaseStart + a,
            sourceEnd: sourceBaseStart + b,
            sourceKind,
            sourceSegmentIndex
          });
        } else if (h.kind === "tpPhrase") {
          const cps = nanpaLinjanWordsToCodepoints(h.words, { mode });
          if (cps && cps.length) {
            makeNumericCartoucheElementFromCodepoints(elements, cps, { fontPx, fgCss, sourceText: matchText, sourceStart: sourceBaseStart + a, sourceEnd: sourceBaseStart + b, sourceKind, sourceSegmentIndex });
          } else {
            renderTpWordsFromText(matchText, elements, { fontPx, mode, sourceBaseStart: sourceBaseStart + a, sourceKind, sourceSegmentIndex, mixedStyle });
          }
        } else {
          const isTimeLike = (h.kind === "time") || (h.kind === "date") || nanpaCapsIsValidTimeOrDate(h.caps);
          const cps = nanpaCapsToNanpaLinjanCodepoints(h.caps, { mode, isTime: isTimeLike });
          if (cps && cps.length) {
            makeNumericCartoucheElementFromCodepoints(elements, cps, { fontPx, fgCss, sourceText: matchText, sourceStart: sourceBaseStart + a, sourceEnd: sourceBaseStart + b, sourceKind, sourceSegmentIndex });
          } else {
            renderTpWordsFromText(matchText, elements, { fontPx, mode, sourceBaseStart: sourceBaseStart + a, sourceKind, sourceSegmentIndex, mixedStyle });
          }
        }
        pos = b;
      }
      if (pos < s.length) {
        renderTpWordsFromText(s.slice(pos), elements, { fontPx, mode, sourceBaseStart: sourceBaseStart + pos, sourceKind, sourceSegmentIndex, mixedStyle });
      }
    }

    function unescapeQuotedText(raw){
      const s = String(raw ?? "");
      let out = "";
      for (let i = 0; i < s.length; i++){
        const ch = s[i];
        if (ch !== "\\") { out += ch; continue; }
        if (i + 1 >= s.length) { out += "\\"; break; }

        const n = s[i + 1];
        if (n === '"') { out += '"'; i++; continue; }
        if (n === "\\") { out += "\\"; i++; continue; }
        if (n === "t") { out += "    "; i++; continue; }     // keep your current behavior
        if (n === "n") { out += "\n"; i++; continue; }       // optional
        // unknown escape: keep the char literally (don’t drop anything)
        out += n;
        i++;
      }
      return out;
    }

    function parseQuoteSegmentToElements(quoteContent, elements, { fontPx, sourceBaseStart = 0, sourceKind = 'quote', sourceSegmentIndex = null, openQuote = '"', closeQuote = '"' }) {
      const literal = unescapeQuotedText(quoteContent);

      if (literal.length === 0) return;

      const fgCss = getFgHex();
      const mode = getNanpaLinjanMode();
      const cartoucheInnerCps = tryExtractFullUcsurCartoucheCodepoints(literal);

      if (cartoucheInnerCps && isNumericNanpaLinjanCartoucheInnerCps(cartoucheInnerCps, { mode })) {
        makeNumericCartoucheElementFromCodepoints(elements, cartoucheInnerCps, {
          fontPx,
          fgCss,
          sourceText: String(quoteContent ?? ''),
          sourceStart: sourceBaseStart,
          sourceEnd: sourceBaseStart + String(quoteContent ?? '').length,
          sourceKind,
          sourceSegmentIndex,
        });
        const created = elements[elements.length - 1];
        if (created && created.type !== 'gap') {
          created.quoteOpenChar = String(openQuote || '"');
          created.quoteCloseChar = String(closeQuote || '"');
        }
        return;
      }

      if (elements.length > 0) {
        pushGapIfNeeded(elements, wordGapForPx(fontPx));
      }

      makeLiteralTextElement(elements, literal, {
        fontPx,
        fontFamily: FONT_FAMILY_LITERAL,
        addLeadingGap: false,
        isQuoted: true,
        sourceText: String(quoteContent ?? ''),
        sourceStart: sourceBaseStart,
        sourceEnd: sourceBaseStart + String(quoteContent ?? '').length,
        sourceKind,
        sourceSegmentIndex,
        quoteOpenChar: String(openQuote || '"'),
        quoteCloseChar: String(closeQuote || '"')
      });
    }

    function parseInterpretedQuoteSegmentToElements(quoteContent, elements, {
      fontPx,
      parser = {},
      mixedStyle = 'short',
      sourceBaseStart = 0,
      sourceKind = 'interpretedQuote',
      sourceSegmentIndex = null,
      openQuote = '"',
      closeQuote = '"'
    } = {}) {
      const content = unescapeQuotedText(quoteContent);
      const interpretedText = content.length ? `te ${content} to` : 'te to';
      const startIndex = elements.length;

      if (parser.mode === 'sitelen-seli-kiwen') {
        parseSskTextSegmentToElements(interpretedText, elements, {
          fontPx,
          parser,
          mixedStyle,
          sourceBaseStart,
          sourceKind,
          sourceSegmentIndex
        });
      } else if (isSitelenPonaAsciiExtendedMode(parser)) {
        parseSitelenPonaAsciiExtendedTextSegmentToElements(interpretedText, elements, {
          fontPx,
          parser,
          mixedStyle,
          sourceBaseStart,
          sourceKind,
          sourceSegmentIndex
        });
      } else if (isStandardSitelenPonaAsciiCoreMode(parser)) {
        parseStandardSitelenPonaAsciiCoreTextSegmentToElements(interpretedText, elements, {
          fontPx,
          parser,
          mixedStyle,
          sourceBaseStart,
          sourceKind,
          sourceSegmentIndex
        });
      } else {
        parseTextSegmentToElements(interpretedText, elements, {
          fontPx,
          sourceBaseStart,
          sourceKind,
          sourceSegmentIndex,
          mixedStyle
        });
      }

      for (let index = startIndex; index < elements.length; index++) {
        const element = elements[index];
        if (!element || element.type === 'gap') continue;
        element.interpretedQuote = true;
        element.quoteOpenChar = String(openQuote || '"');
        element.quoteCloseChar = String(closeQuote || '"');
      }
    }

    function tryExtractFullUcsurCartoucheCodepoints(text) {
      const s = String(text ?? "");
      if (!s) return null;

      const cps = Array.from(s, ch => ch.codePointAt(0));
      if (cps.length < 3) return null;

      const CARTOUCHE_START = 0xF1990; // 󱦐
      const CARTOUCHE_END   = 0xF1991; // 󱦑

      if (cps[0] !== CARTOUCHE_START) return null;
      if (cps[cps.length - 1] !== CARTOUCHE_END) return null;

      const inner = cps.slice(1, -1);
      if (inner.length === 0) return null;

      return inner;
    }

    function isNumericNanpaLinjanCartoucheInnerCps(innerCps, { mode = "uniform" } = {}) {
      const cps = Array.from(innerCps ?? []);
      if (!cps.length) return false;

      const allowed = new Set(Object.values(NANPA_LINJA_N_WORD_TO_CP));
      for (const cp of cps) {
        if (!allowed.has(cp)) return false;
      }

      // Canonical nanpa-linja-n cartouches produced by this file always start
      // and end with nanpa in traditional mode.
      if (mode !== "uniform") {
        if (cps[0] !== CP_NANPA) return false;
        if (cps[cps.length - 1] !== CP_NANPA) return false;
        return true;
      }

      // In uniform mode, accept either already-uniform canonical output
      // or traditional output that uniformizes exactly to the provided cps.
      const uniform = uniformizeNanpaLinjanCartoucheCps(cps);
      if (!uniform.length) return false;

      const uniformAllowed = new Set(Object.values(NANPA_LINJA_N_WORD_TO_CP));
      for (const cp of uniform) {
        if (!uniformAllowed.has(cp)) return false;
      }

      const first = uniform[0];
      const last = uniform[uniform.length - 1];
      if (first !== CP_NANPA && first !== CP_NENA) return false;
      if (last !== CP_NANPA && last !== CP_NENA) return false;

      return true;
    }

    function parseBracketSegmentToElements(bracketContent, elements, { fontPx, sourceBaseStart = 0, sourceKind = 'bracket', sourceSegmentIndex = null, mixedStyle = "short" }) {
      const content = String(bracketContent ?? "").trim();
      if (!content) return;
      //console.log("BRACKET PARSER HIT", bracketContent);


            // Exact latin-in-cartouche syntax: ["HELLO"]
      // IMPORTANT:
      // - must start with " and end with " inside the brackets
      // - no spaces allowed between [ and " or between " and ]
      // - since `content` is trimmed above, reject any case where trimming changed
      //   the raw bracket content, so [ "HELLO" ] does not match
      if (String(bracketContent ?? "") === content && content.length >= 2 && content.startsWith('"') && content.endsWith('"')) {
        const literal = unescapeQuotedText(content.slice(1, -1));
        if (literal.length > 0) {
          const literalCps = Array.from(literal, ch => ch.codePointAt(0));
          const cps = [];

          if (literalCps.length > 0) {
            if (QUOTED_CARTOUCHE_START_EXT_CP != null) cps.push(QUOTED_CARTOUCHE_START_EXT_CP);

            for (let i = 0; i < literalCps.length; i++) {
              cps.push(literalCps[i]);
              if (i < literalCps.length - 1 && QUOTED_CARTOUCHE_MIDDLE_EXT_CP != null) {
                cps.push(QUOTED_CARTOUCHE_MIDDLE_EXT_CP);
              }
            }

            if (QUOTED_CARTOUCHE_END_EXT_CP != null) cps.push(QUOTED_CARTOUCHE_END_EXT_CP);
          }

          makeCartoucheElementFromCodepoints(elements, cps, {
            fontPx,
            fontFamily: FONT_FAMILY_LITERAL_CARTOUCHE || FONT_FAMILY_TEXT,
            fgCss: getFgHex(),
            repairQuotedLatinLeftEdge: true,
            isLiteralCartouche: true,
            sourceText: content,
            sourceStart: sourceBaseStart,
            sourceEnd: sourceBaseStart + content.length,
            sourceKind,
            sourceSegmentIndex
          });
          return;
        }
      }

      const mode = getNanpaLinjanMode();
      const fgCss = getFgHex();

      if (getEnableBinaryParsing()) {
        const binarySemantic = binaryCartoucheSourceToSemantic(content, {
          relaxedParsing: getRelaxedNanpaLinjanParsing(),
          preferAbbreviated: getAbbreviateNumericCartouches()
        });
        if (binarySemantic) {
          makeBinaryNumericCartoucheElementFromSemantic(elements, binarySemantic, {
            fontPx, fgCss, sourceText: content, sourceStart: sourceBaseStart, sourceEnd: sourceBaseStart + content.length, sourceKind, sourceSegmentIndex
          });
          return;
        }
      }

      if (getEnableHexParsing()) {
        const hexSemantic = hexCartoucheSourceToSemantic(content, {
          relaxedParsing: getRelaxedNanpaLinjanParsing(),
          preferAbbreviated: getAbbreviateNumericCartouches()
        });
        if (hexSemantic) {
          makeHexNumericCartoucheElementFromSemantic(elements, hexSemantic, {
            fontPx,
            fgCss,
            sourceText: content,
            sourceStart: sourceBaseStart,
            sourceEnd: sourceBaseStart + content.length,
            sourceKind,
            sourceSegmentIndex
          });
          return;
        }
      }
     
      try {
        const dateCaps = dateStrToNanpaCaps(content);
        if (dateCaps != null) {
          const cpsDate = nanpaCapsToNanpaLinjanCodepoints(dateCaps, { mode, isTime: true });
          if (cpsDate && cpsDate.length) {
            makeNumericCartoucheElementFromCodepoints(elements, cpsDate, { fontPx, fgCss, sourceText: content, sourceStart: sourceBaseStart, sourceEnd: sourceBaseStart + content.length , sourceKind, sourceSegmentIndex });
            return;
          }
        }

        const timeCaps = timeStrToNanpaCaps(content);
        if (timeCaps != null) {
          const cpsTime = nanpaCapsToNanpaLinjanCodepoints(timeCaps, { mode, isTime: true });
          if (cpsTime && cpsTime.length) {
            makeNumericCartoucheElementFromCodepoints(elements, cpsTime, { fontPx, fgCss, sourceText: content, sourceStart: sourceBaseStart, sourceEnd: sourceBaseStart + content.length , sourceKind, sourceSegmentIndex });
            return;
          }
        }

        const caps = decimalStringToCaps(content, { thousandsChar: ",", groupFractionTriplets: true, fractionGroupSize: 3, mixedStyle });
        const cps = nanpaCapsToNanpaLinjanCodepoints(caps, { mode });
        if (cps && cps.length) {
          makeNumericCartoucheElementFromCodepoints(elements, cps, { fontPx, fgCss, sourceText: content, sourceStart: sourceBaseStart, sourceEnd: sourceBaseStart + content.length , sourceKind, sourceSegmentIndex });
          return;
        }
      } catch {}

      if (getNanpaColonParsing()) {
        const colonTokens = tokenizeHexCartoucheSource(content);
        if (colonTokens && colonTokens.length >= 4 && colonTokens[0] === "nanpa" &&
            colonTokens[1] === ":" && colonTokens[colonTokens.length - 1] === "nanpa") {
          const withoutColon = ["nanpa", ...colonTokens.slice(2)];
          const fullCandidate = ["nanpa", "e", ...colonTokens.slice(2)];
          const parsedColonFull = tryParseNanpaLinjanTpPhraseWords(fullCandidate);
          if (parsedColonFull) {
            const cps = nanpaLinjanWordsToCodepoints(parsedColonFull.words, { mode });
            if (cps) makeNumericCartoucheElementFromCodepoints(elements, cps, {
              fontPx, fgCss, sourceText: content, sourceStart: sourceBaseStart,
              sourceEnd: sourceBaseStart + content.length, sourceKind, sourceSegmentIndex
            });
            return;
          }
          if (getAbbreviateNumericCartouches()) {
            const parsedColonAbbreviated = tryParseFullyAbbreviatedNanpaLinjanCartoucheWords(withoutColon);
            if (parsedColonAbbreviated?.cps?.length) {
              let cps = parsedColonAbbreviated.cps;
              if (getNanpaColonRendering()) cps = [CP_NANPA, CP_COLON, ...cps.slice(1)];
              makeNumericCartoucheElementFromCodepoints(elements, cps, {
                fontPx, fgCss, sourceText: content, sourceStart: sourceBaseStart,
                sourceEnd: sourceBaseStart + content.length, sourceKind, sourceSegmentIndex
              });
              return;
            }
          }
        }
      }

      const wordsRaw = content.split(/\s+/).filter(Boolean);

      // Strict numeric TP-phrase rule for []:
      // every raw token must already be a clean TP word token.
      // If a token normalizes away, or changes, do not allow numeric-cartouche matching.
      const strictWords = [];
      let strictTpPhraseCandidate = true;

      for (const raw of wordsRaw) {
        const norm = normalizeTpWord(raw);
        if (!norm) {
          strictTpPhraseCandidate = false;
          break;
        }
        if (raw !== norm) {
          strictTpPhraseCandidate = false;
          break;
        }
        strictWords.push(norm);
      }

      const parsedNumber = strictTpPhraseCandidate
        ? tryParseNanpaLinjanTpPhraseWords(strictWords)
        : null;

      if (parsedNumber) {
        const cps = nanpaLinjanWordsToCodepoints(parsedNumber.words, { mode });
        if (cps) makeNumericCartoucheElementFromCodepoints(elements, cps, {
          fontPx,
          fgCss,
          sourceText: content,
          sourceStart: sourceBaseStart,
          sourceEnd: sourceBaseStart + content.length,
          sourceKind,
          sourceSegmentIndex
        });
        return;
      }

      if (getAbbreviateNumericCartouches() && strictTpPhraseCandidate) {
        const parsedAbbreviatedNumber = tryParseFullyAbbreviatedNanpaLinjanCartoucheWords(strictWords);
        if (parsedAbbreviatedNumber && parsedAbbreviatedNumber.cps && parsedAbbreviatedNumber.cps.length) {
          makeNumericCartoucheElementFromCodepoints(elements, parsedAbbreviatedNumber.cps, {
            fontPx,
            fgCss,
            sourceText: content,
            sourceStart: sourceBaseStart,
            sourceEnd: sourceBaseStart + content.length,
            sourceKind,
            sourceSegmentIndex
          });
          return;
        }
      }

      const idCps =
        tryDecodeNanpaLinjanIdentifierToCodepoints(content, { mode }) ??
        tryDecodeNanpaLinjanIdentifierToCodepoints(content.replace(/\s+/g, ""), { mode });

      if (idCps && idCps.length) {
        makeNumericCartoucheElementFromCodepoints(elements, idCps, { fontPx, fgCss, sourceText: content, sourceStart: sourceBaseStart, sourceEnd: sourceBaseStart + content.length , sourceKind, sourceSegmentIndex });
        return;
      }

      const parsedGlyphContent = parseCartoucheGlyphContentForRendering(content);
      if (parsedGlyphContent && parsedGlyphContent.cps && parsedGlyphContent.cps.length >= 1) {
        makeCartoucheElementFromCodepoints(elements, parsedGlyphContent.cps, {
          fontPx,
          fontFamily: FONT_FAMILY_TEXT,
          fgCss,
          manualTallies: parsedGlyphContent.manualTallies,
          sourceText: content,
          sourceStart: sourceBaseStart,
          sourceEnd: sourceBaseStart + content.length,
          sourceKind,
          sourceSegmentIndex
        });
        return;
      }

      makeCartoucheElementFromCodepoints(elements, lettersToRandomGlyphCps(content), { fontPx, fontFamily: FONT_FAMILY_TEXT, fgCss, sourceText: content, sourceStart: sourceBaseStart, sourceEnd: sourceBaseStart + content.length , sourceKind, sourceSegmentIndex });
    }

    function lineToElements(line, { fontPx, mixedStyle = "short", parser = {} } = {}) {
      let s = isStandardSitelenPonaAsciiCoreMode(parser)
        ? String(line ?? "")
        : preprocessTextAliases(line);

      const segs = splitLineIntoSegments(s);
      const elements = [];
      nanpaDebugEmit("line-to-elements:start", {
        line: String(line ?? ""),
        preprocessed: s,
        fontPx,
        mixedStyle,
        parserMode: parser?.mode || null,
        segments: segs.map(seg => ({ kind: seg.kind, value: seg.value }))
      });

      for (let si = 0; si < segs.length; si++) {
        const seg = segs[si];
        const sourceKind = seg.kind;
        const sourceSegmentIndex = si;

        if (seg.kind === "text") {
          if (parser.mode === "sitelen-seli-kiwen") {
            parseSskTextSegmentToElements(seg.value, elements, {
              fontPx,
              parser,
              mixedStyle,
              sourceBaseStart: 0,
              sourceKind,
              sourceSegmentIndex
            });
          } else if (isSitelenPonaAsciiExtendedMode(parser)) {
            parseSitelenPonaAsciiExtendedTextSegmentToElements(seg.value, elements, {
              fontPx,
              parser,
              mixedStyle,
              sourceBaseStart: 0,
              sourceKind,
              sourceSegmentIndex
            });
          } else if (isStandardSitelenPonaAsciiCoreMode(parser)) {
            parseStandardSitelenPonaAsciiCoreTextSegmentToElements(seg.value, elements, {
              fontPx,
              parser,
              mixedStyle,
              sourceBaseStart: 0,
              sourceKind,
              sourceSegmentIndex
            });
          } else {
            parseTextSegmentToElements(seg.value, elements, {
              fontPx,
              sourceBaseStart: 0,
              sourceKind,
              sourceSegmentIndex,
              mixedStyle
            });
          }
        } else if (seg.kind === "bracket") {
          if (parser.mode === "sitelen-seli-kiwen") {
            parseSskBracketSegmentToElements(seg.value, elements, {
              fontPx,
              parser,
              mixedStyle,
              sourceBaseStart: 0,
              sourceKind,
              sourceSegmentIndex
            });
          } else if (isSitelenPonaAsciiExtendedMode(parser)) {
            parseSitelenPonaAsciiExtendedBracketSegmentToElements(seg.value, elements, {
              fontPx,
              parser,
              mixedStyle,
              sourceBaseStart: 0,
              sourceKind,
              sourceSegmentIndex
            });
          } else if (isStandardSitelenPonaAsciiCoreMode(parser)) {
            parseStandardSitelenPonaAsciiCoreBracketSegmentToElements(seg.value, elements, {
              fontPx,
              parser,
              mixedStyle,
              sourceBaseStart: 0,
              sourceKind,
              sourceSegmentIndex
            });
          } else {
            parseBracketSegmentToElements(seg.value, elements, {
              fontPx,
              sourceBaseStart: 0,
              sourceKind,
              sourceSegmentIndex,
              mixedStyle
            });
          }
        } else if (seg.kind === "quote") {
          if (parser.interpretDoubleQuotesAsTeTo === true) {
            parseInterpretedQuoteSegmentToElements(seg.value, elements, {
              fontPx,
              parser,
              mixedStyle,
              sourceBaseStart: 0,
              sourceKind: 'interpretedQuote',
              sourceSegmentIndex,
              openQuote: seg.openQuote,
              closeQuote: seg.closeQuote
            });
          } else {
            parseQuoteSegmentToElements(seg.value, elements, {
              fontPx,
              sourceBaseStart: 0,
              sourceKind,
              sourceSegmentIndex,
              openQuote: seg.openQuote,
              closeQuote: seg.closeQuote
            });
          }
        }
      }

      while (elements.length > 0 && elements[elements.length - 1].type === "gap") elements.pop();
      nanpaDebugTable("line-to-elements:final-elements", elements.map(nanpaDebugElementSummary));
      return elements;
    }

    function measureTextRun(ctx, text, px, fontFamily) {
      const chars = String(text ?? "");
      ctx.font = `${px}px "${fontFamily}"`;
      setTextQuality(ctx);
      const m = ctx.measureText(chars);

      const ascent  = (m.actualBoundingBoxAscent ?? Math.ceil(px * 0.8));
      const descent = (m.actualBoundingBoxDescent ?? Math.ceil(px * 0.2));
      const w = Math.ceil(m.width);

      return {
        chars,
        ascent,
        descent,
        left: 0,
        w,
        h: Math.ceil(ascent + descent),
        px,
        fontFamily
      };
    }

    function makeLiteralTextElement(elements, text, { fontPx, fontFamily, addLeadingGap = true, isQuoted = false, isUnrecognized = false, unknownDisplay = null, sourceText = null, sourceStart = null, sourceEnd = null, sourceKind = null, sourceSegmentIndex = null, quoteOpenChar = null, quoteCloseChar = null } = {}) {
      const s = String(text ?? "");
      if (!s) return;

      if (addLeadingGap) {
        pushGapIfNeeded(elements, wordGapForPx(fontPx));
      }

      elements.push({
        type: "text",
        text: s,
        px: fontPx,
        fontFamily: fontFamily || FONT_FAMILY_LITERAL,
        isQuoted: !!isQuoted,
        isUnrecognized: !!isUnrecognized,
        unknownDisplay: unknownDisplay ? { ...unknownDisplay } : null,
        sourceText: (typeof sourceText === 'string') ? sourceText : null,
        sourceStart: Number.isFinite(Number(sourceStart)) ? Number(sourceStart) : null,
        sourceEnd: Number.isFinite(Number(sourceEnd)) ? Number(sourceEnd) : null,
        sourceKind: (typeof sourceKind === 'string') ? sourceKind : null,
        sourceSegmentIndex: Number.isFinite(Number(sourceSegmentIndex)) ? Number(sourceSegmentIndex) : null,
        quoteOpenChar: (typeof quoteOpenChar === 'string' && quoteOpenChar.length) ? quoteOpenChar : null,
        quoteCloseChar: (typeof quoteCloseChar === 'string' && quoteCloseChar.length) ? quoteCloseChar : null,
      });
    }

    function measureGlyph(ctx, cp, px, fontFamily) {
      const ch = String.fromCodePoint(cp);
      ctx.font = `${px}px "${fontFamily}"`;
      setTextQuality(ctx);
      const m = ctx.measureText(ch);

      const ascent  = m.actualBoundingBoxAscent ?? Math.ceil(px * 0.8);
      const descent = m.actualBoundingBoxDescent ?? Math.ceil(px * 0.2);

      const left = m.actualBoundingBoxLeft ?? 0;
      const right = m.actualBoundingBoxRight ?? Math.ceil(m.width);
      const tightW = Math.ceil(left + right);

      return { ch, ascent, descent, left, w: tightW, h: Math.ceil(ascent + descent), px, fontFamily };
    }

    function measureRun(ctx, cps, px, fontFamily) {
      const chars = (cps ?? []).map(cp => String.fromCodePoint(cp)).join("");
      ctx.font = `${px}px "${fontFamily}"`;
      setTextQuality(ctx);
      const m = ctx.measureText(chars);

      const ascent  = m.actualBoundingBoxAscent ?? Math.ceil(px * 0.8);
      const descent = m.actualBoundingBoxDescent ?? Math.ceil(px * 0.2);

      const left = m.actualBoundingBoxLeft ?? 0;
      const right = m.actualBoundingBoxRight ?? Math.ceil(m.width);
      const tightW = Math.ceil(left + right);

      return { chars, ascent, descent, left, w: tightW, h: Math.ceil(ascent + descent), px, fontFamily };
    }

    const PX_TO_PT = 72 / 96; // 0.75

    function measureChars(ctx, chars, px, fontFamily){
      ctx.font = `${px}px "${fontFamily}"`;
      setTextQuality(ctx);

      const m = ctx.measureText(chars);

      const ascent  = (m.actualBoundingBoxAscent ?? Math.ceil(px * 0.8));
      const descent = (m.actualBoundingBoxDescent ?? Math.ceil(px * 0.2));

      // PDF layout: use advance width only; bbox-left/right causes clipping bugs
      const w = Math.ceil(m.width);

      return { chars, ascent, descent, left: 0, w, h: Math.ceil(ascent + descent), px, fontFamily };
    }

    // Build the cartouche text run directly (so PDF can draw it as text)
    function cartoucheCpsToRunString(innerCps){
      return (
        String.fromCodePoint(CARTOUCHE_START_CP) +
        (innerCps ?? []).map(cp => String.fromCodePoint(cp)).join("") +
        String.fromCodePoint(CARTOUCHE_END_CP)
      );
    }




    function renderAllLinesToCanvas(outCanvas, linesElements, { fontPx, lineGapPx = null, paddingPx = 18 } = {}) {
      const pad = Number.isFinite(Number(paddingPx)) ? Math.max(0, Number(paddingPx)) : 18;
      const lineGap = Number.isFinite(Number(lineGapPx)) ? Math.max(0, Number(lineGapPx)) : lineGapForPx(fontPx);
      const tmp = document.createElement("canvas");
      const ctx = tmp.getContext("2d");
      ctx.textBaseline = "alphabetic";

      const haloOn = getHaloEnabled();
      const haloExtra = haloOn ? haloWidthForPx(fontPx) : 0;

      const measuredLines = [];
      let maxLineW = 0;
      let totalH = 0;

      for (const lineEls of linesElements) {
        let w = 0;
        let maxAscent = 0;
        let maxDescent = 0;

        const measuredEls = [];

        for (const el of lineEls) {
          if (el.type === "text") {
            const fam = el.fontFamily || FONT_FAMILY_LITERAL;
            const r = measureTextRun(ctx, el.text, el.px ?? fontPx, fam);
            measuredEls.push({ ...el, m: r });
            w += r.w;

            if (r.ascent + haloExtra > maxAscent) maxAscent = r.ascent + haloExtra;
            if (r.descent + haloExtra > maxDescent) maxDescent = r.descent + haloExtra;
            continue;
          }

          if (el.type === "gap") {
            measuredEls.push(el);
            w += Math.max(0, el.px | 0);
            continue;
          }

          if (el.type === "glyph") {
            const fam = el.fontFamily || FONT_FAMILY_TEXT;
            const renderCp = getElementRenderCps(el)[0] ?? el.cp;
            const syntheticCp = getSyntheticCornerBracketCodepoint(el);
            const g = syntheticCp != null
              ? measureSyntheticCornerBracket(el.px ?? fontPx, syntheticCp)
              : measureGlyph(ctx, renderCp, el.px ?? fontPx, fam);
            measuredEls.push({ ...el, m: g });
            w += g.w;

            if (g.ascent + haloExtra > maxAscent) maxAscent = g.ascent + haloExtra;
            if (g.descent + haloExtra > maxDescent) maxDescent = g.descent + haloExtra;
            continue;
          }

          if (el.type === "run") {
            const fam = el.fontFamily || FONT_FAMILY_TEXT;
            const syntheticCp = getSyntheticCornerBracketCodepoint(el);
            const r = syntheticCp != null
              ? measureSyntheticCornerBracket(el.px ?? fontPx, syntheticCp)
              : measureRun(ctx, getElementRenderCps(el), el.px ?? fontPx, fam);
            measuredEls.push({ ...el, m: r });
            w += r.w;

            if (r.ascent + haloExtra > maxAscent) maxAscent = r.ascent + haloExtra;
            if (r.descent + haloExtra > maxDescent) maxDescent = r.descent + haloExtra;
            continue;
          }

          if (el.type === "cartouche") {
            // IMPORTANT: include cartouche in measured elements and line width
            measuredEls.push(el);
            w += (el.w | 0);

            // Cap how much cartouche can inflate line height
            const a0 = el.ascent ?? Math.ceil((el.h | 0) * 0.7);
            const d0 = el.descent ?? Math.ceil((el.h | 0) * 0.3);

            const allowance = Math.max(2, Math.round(fontPx * 0.08)); // 8% extra
            const capA = Math.ceil(fontPx * 0.80) + allowance;
            const hasManualTallies = Array.isArray(el.manualTallies) && el.manualTallies.some(n => Number(n) > 0);
            const capD = Math.ceil(fontPx * (hasManualTallies ? 0.20 : 0.20)) + allowance;

            const aCapped = Math.min(a0, capA) + haloExtra;
            maxAscent = Math.max(maxAscent, aCapped);
            const dCapped = Math.min(d0, capD) + haloExtra;
            maxDescent = Math.max(maxDescent, dCapped);
            continue;
          }
        }

        const lineBoxH = Math.max(maxAscent + maxDescent, fontPx);
        measuredLines.push({ measuredEls, w, lineBoxH, maxAscent, maxDescent });

        if (w > maxLineW) maxLineW = w;
        totalH += lineBoxH;
      }

      totalH += Math.max(0, (measuredLines.length - 1) * lineGap);

      const outW = Math.max(1, Math.ceil(maxLineW + pad * 2));
      const outH = Math.max(1, Math.ceil(totalH + pad * 2));

      outCanvas.width = outW;
      outCanvas.height = outH;

      const outCtx = outCanvas.getContext("2d", { alpha: true, willReadFrequently: true });
      outCtx.clearRect(0, 0, outW, outH);
      outCtx.textBaseline = "alphabetic";
      outCtx.fillStyle = getFgHex();
      const fgCss = getFgHex();
      setTextQuality(outCtx);

      let y = pad;

      for (let li = 0; li < measuredLines.length; li++) {
        const L = measuredLines[li];

        const mode = getAlignMode();
        const f = alignFactor(mode);
        const lineOffset = Math.max(0, (maxLineW - L.w) * f);
        let x = pad + lineOffset;

        const glyphBaseline = y + L.maxAscent;

        for (const el of L.measuredEls) {
          if (el.type === "text") {
            const m = el.m;
            const fam = el.fontFamily || FONT_FAMILY_LITERAL;
            const drawX = x + (m.left ?? 0);
            if (el.isUnrecognized) {
              drawUnknownOutlineBox(outCtx, drawX, glyphBaseline, m, el.unknownDisplay || getUnknownTextDisplay(), fgCss);
            }
            drawTextWithOptionalHalo(outCtx, m.chars, drawX, glyphBaseline, {
              px: (el.px ?? fontPx),
              fontFamily: fam,
              fillCss: fgCss
            });
            x += m.w;
            continue;
          }

          if (el.type === "gap") { x += Math.max(0, el.px | 0); continue; }

          if (el.type === "glyph") {
            const m = el.m;
            const fam = el.fontFamily || FONT_FAMILY_TEXT;
            const syntheticCp = getSyntheticCornerBracketCodepoint(el);
            if (syntheticCp != null) {
              drawSyntheticCornerBracket(outCtx, syntheticCp, x, glyphBaseline, {
                fontPx: el.px ?? fontPx,
                widthPx: m.w,
                heightPx: m.h,
                fillCss: fgCss,
                halo: {
                  enabled: getHaloEnabled(),
                  color: getHaloHex(),
                  widthPx: getHaloEnabled() ? haloWidthForPx(el.px ?? fontPx) : 0
                }
              });
              x += m.w;
              continue;
            }
            //outCtx.font = `${(el.px ?? fontPx)}px "${fam}"`;
            //const drawX = x + (m.left ?? 0);
            //outCtx.fillText(m.ch, drawX, glyphBaseline);
            const drawX = x + (m.left ?? 0);
            drawTextWithOptionalHalo(outCtx, m.ch, drawX, glyphBaseline, {
              px: (el.px ?? fontPx),
              fontFamily: fam,
              fillCss: fgCss
            });
            x += m.w;
            continue;
          }

          if (el.type === "run") {
            const m = el.m;
            const fam = el.fontFamily || FONT_FAMILY_TEXT;
            const syntheticCp = getSyntheticCornerBracketCodepoint(el);
            if (syntheticCp != null) {
              drawSyntheticCornerBracket(outCtx, syntheticCp, x, glyphBaseline, {
                fontPx: el.px ?? fontPx,
                widthPx: m.w,
                heightPx: m.h,
                fillCss: fgCss,
                halo: {
                  enabled: getHaloEnabled(),
                  color: getHaloHex(),
                  widthPx: getHaloEnabled() ? haloWidthForPx(el.px ?? fontPx) : 0
                }
              });
              x += m.w;
              continue;
            }
            //outCtx.font = `${(el.px ?? fontPx)}px "${fam}"`;
            //const drawX = x + (m.left ?? 0);
            //outCtx.fillText(m.chars, drawX, glyphBaseline);
            const drawX = x + (m.left ?? 0);
            drawTextWithOptionalHalo(outCtx, m.chars, drawX, glyphBaseline, {
              px: (el.px ?? fontPx),
              fontFamily: fam,
              fillCss: fgCss
            });
            x += m.w;
            continue;
          }

          if (el.type === "cartouche") {
            const by = (el.baselineY != null) ? (el.baselineY | 0) : Math.floor((el.h | 0) * 0.75);
            const drawY = glyphBaseline - by;
            outCtx.drawImage(el.canvas, x, drawY);
            x += el.w;
            continue;
          }
        }

        y += L.lineBoxH;
        if (li < measuredLines.length - 1) y += lineGap;
      }
    }

    function safeFilenamePart(s) {
      const t = String(s ?? "").trim();
      if (!t) return "sitelen";
      return t.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 80) || "sitelen";
    }

    function downloadTextAsFile(text, { filename = "input.txt" } = {}) {
      const blob = new Blob([String(text ?? "")], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();

      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    async function readFileAsText(file) {
      // Modern browsers: file.text()
      if (file && typeof file.text === "function") return await file.text();

      // Fallback
      return await new Promise((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => resolve(String(fr.result ?? ""));
        fr.onerror = () => reject(fr.error || new Error("Failed to read file"));
        fr.readAsText(file);
      });
    }


    function downloadCanvasAsTransparentPng(canvas, { filenameBase = "sitelen", scale = 1 } = {}) {
      if (!canvas) throw new Error("Canvas not found.");

      const w = canvas.width | 0;
      const h = canvas.height | 0;
      if (w <= 0 || h <= 0) throw new Error("Canvas is empty (nothing to download yet).");

      const out = document.createElement("canvas");
      out.width = Math.max(1, Math.floor(w * scale));
      out.height = Math.max(1, Math.floor(h * scale));

      const ctx = out.getContext("2d", { alpha: true });
      ctx.clearRect(0, 0, out.width, out.height);
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(canvas, 0, 0, out.width, out.height);

      const filename = safeFilenamePart(filenameBase) + ".png";

      if (out.toBlob) {
        out.toBlob((blob) => {
          if (!blob) throw new Error("PNG export failed (no blob).");
          const url = URL.createObjectURL(blob);

          const a = document.createElement("a");
          a.href = url;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          a.remove();

          setTimeout(() => URL.revokeObjectURL(url), 1000);
        }, "image/png");
        return;
      }

      const dataUrl = out.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
    }


    async function canvasToPngBytes(canvas){
      return await new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (!blob) return reject(new Error("toBlob failed"));
          blob.arrayBuffer().then(resolve).catch(reject);
        }, "image/png");
      });
    }

    const PDF_CARTOUCHE_SCALE = 6;//3; // 2 or 3 is usually enough

    function pdfRasterScaleForFontPx(basePx) {
      const px = Math.max(8, Number(basePx || 56));

      if (px <= 12) return 16;
      if (px <= 16) return 14;
      if (px <= 20) return 12;
      if (px <= 24) return 10;
      if (px <= 32) return 8;
      return 6;
    }

    function buildCartoucheCanvasForPdf(cartEl, { fontPx }){
      const c = document.createElement("canvas");

      const basePx = Math.max(8, Number(fontPx ?? cartEl?.px ?? getFontPx() ?? 56));
      const scale = pdfRasterScaleForFontPx(basePx);
      const px = Math.round(basePx * scale);

      const basePadPx = Math.max(4, Math.round(basePx * 0.11));
      const padPx = Math.round(basePadPx * scale);

      const fam = cartEl?.fontFamily || FONT_FAMILY_CARTOUCHE;
      const fgCss = getFgHex();
      const baseManualTallyLiftPx = Number.isFinite(Number(cartEl?.manualTallyLiftPx))
        ? Math.max(0, Number(cartEl.manualTallyLiftPx))
        : manualTallySmallFontLiftFor(fam, basePx);

      const r = renderFontCartoucheToCanvas(
        c,
        Array.from(cartEl?.cps ?? []),
        {
          fontPx: px,
          padPx,
          fontFamily: fam,
          fgCss,
          haloEnabled: false,
          haloCss: "#FFFFFF",
          manualTallies: Array.isArray(cartEl?.manualTallies) ? cartEl.manualTallies : null,
          renderFullCps: Array.isArray(cartEl?.renderFullCps) ? cartEl.renderFullCps : null,
          canonicalToRenderSpans: Array.isArray(cartEl?.canonicalToRenderSpans) ? cartEl.canonicalToRenderSpans : null,
          manualTallyLiftPx: baseManualTallyLiftPx * scale,
        }
      );

      let pdfCanvas = c;
      if (cartEl?.repairQuotedLatinLeftEdge) {
        pdfCanvas = repairQuotedCartoucheLeftEdgeWithLipuDonor(c, Array.from(cartEl?.cps ?? []), {
          fontPx: px,
          padPx,
          fontFamily: fam,
          fgCss,
          haloEnabled: false,
          haloCss: "#FFFFFF",
        }) || c;
      }

      return {
        canvas: pdfCanvas,
        w: Math.round((pdfCanvas.width | 0) / scale),
        h: Math.round((pdfCanvas.height | 0) / scale),
        baselineY: Math.round((r.baselineY | 0) / scale),
        _scale: scale,
        _wPx: r.w | 0,
        _hPx: r.h | 0,
        _baselineYPx: r.baselineY | 0,
      };
    }

    const PDF_QUOTED_TEXT_SCALE = 6; // 4–6. 6 is crisp but bigger PDFs.

    function buildQuotedTextCanvasForPdf(txt, { px, fontFamily, fgCss }) {
      const basePx = Math.max(8, Number(px ?? 56));
      const scale = pdfRasterScaleForFontPx(basePx);
      const pxHi = Math.round(basePx * scale);
      
      // Tiny padding so strokes don't clip
      const basePad = Math.max(0, Math.round(basePx * 0.02));
      const padHi = Math.round(basePad * scale);

      const c = document.createElement("canvas");
      const ctx = c.getContext("2d");
      ctx.textBaseline = "alphabetic";
      ctx.font = `${pxHi}px "${fontFamily}"`;
      setTextQuality(ctx);

      const s = String(txt ?? "");
      const m = ctx.measureText(s);

      const ascentHi = (m.actualBoundingBoxAscent ?? Math.ceil(pxHi * 0.8));
      const descentHi = (m.actualBoundingBoxDescent ?? Math.ceil(pxHi * 0.2));
      const wHi = Math.max(1, Math.ceil(m.width) + padHi * 2);
      const hHi = Math.max(1, Math.ceil(ascentHi + descentHi) + padHi * 2);

      c.width = wHi;
      c.height = hHi;

      const ctx2 = c.getContext("2d", { alpha: true });
      ctx2.clearRect(0, 0, wHi, hHi);
      ctx2.textBaseline = "alphabetic";
      ctx2.font = `${pxHi}px "${fontFamily}"`;
      setTextQuality(ctx2);

      const xHi = padHi;                // left
      const baselineYHi = padHi + ascentHi;

      // IMPORTANT: no halo baked into PDF images (per your preference)
      ctx2.fillStyle = fgCss || "#000";
      ctx2.fillText(s, xHi, baselineYHi);

      // Return "logical" (unscaled) metrics for PDF layout:
      return {
        canvas: c,
        w: Math.round(wHi / scale),
        h: Math.round(hHi / scale),
        baselineY: Math.round(baselineYHi / scale),
      };
    }

    async function exportRenderedToPdf(){
      if (!window.PDFLib) throw new Error("pdf-lib not loaded.");
      const { PDFDocument, rgb } = window.PDFLib;

      const fontPx = getFontPx();
      await fontsReadyForPx(fontPx);
      warmUpCanvasFontsOnce();

      // Rebuild layout exactly like renderFromTextarea()
      const raw = String(elTextIn.value ?? "");
      const lines = raw.replace(/\r\n/g, "\n").split("\n");
      const linesElements = lines.map(line => lineToElements(line, { fontPx, mixedStyle: getMixedStyle() }));

      const anyContent = linesElements.some(els =>
        els.some(e => e.type === "glyph" || e.type === "cartouche" || e.type === "run" || e.type === "text")
      );
      if (!anyContent) throw new Error("Nothing to export (no recognized words).");

      // Measure everything using your existing canvas measurement approach
      const tmp = document.createElement("canvas");
      const ctx = tmp.getContext("2d");
      ctx.textBaseline = "alphabetic";

      const lineGapPx = lineGapForPx(fontPx);
      const padPx = 18;

      // Convert color "#RRGGBB" -> pdf-lib rgb
      const fgHex = getFgHex();
      const r = parseInt(fgHex.slice(1,3), 16) / 255;
      const g = parseInt(fgHex.slice(3,5), 16) / 255;
      const b = parseInt(fgHex.slice(5,7), 16) / 255;

            // Create PDF
      const pdfDoc = await PDFDocument.create();
      const fonts = await embedPdfFonts(pdfDoc);

      function pdfFontForFamily(fam){
        if (fam === FONT_FAMILY_LITERAL) return fonts.fontLit;
        if (fam === FONT_FAMILY_CARTOUCHE) return fonts.fontCart;
        return fonts.fontText;
      }

      function widthPtForText(fam, text, px){
        const sizePt = (px ?? fontPx) * PX_TO_PT;
        return pdfFontForFamily(fam).widthOfTextAtSize(String(text ?? ""), sizePt);
      }

      // Measure lines
      const measuredLines = [];
      let maxLineWpt = 0;
      let totalH = 0;

      for (const lineEls of linesElements) {
        let wPt = 0;
        let maxAscent = 0;
        let maxDescent = 0;

        const measuredEls = [];

        for (const el of lineEls) {
          // GAP (px -> pt)
          if (el.type === "gap") {
            const gapPx = Math.max(0, el.px | 0);
            measuredEls.push({ kind: "gap", px: gapPx });
            wPt += gapPx * PX_TO_PT;
            continue;
          }

          // TEXT (Patrick / literal)
          if (el.type === "text") {
            const fam = el.fontFamily || FONT_FAMILY_LITERAL;
            const px = (el.px ?? fontPx);
            const txt = String(el.text ?? "");

            // NEW: quoted literal text -> raster image in PDF
            if (fam === FONT_FAMILY_LITERAL && el.isQuoted) {
              const img = buildQuotedTextCanvasForPdf(txt, { px, fontFamily: fam, fgCss: getFgHex() });

              measuredEls.push({ kind: "quotedImg", img });
              wPt += (img.w | 0) * PX_TO_PT;

              const a = img.baselineY | 0;
              const d = (img.h | 0) - a;
              maxAscent = Math.max(maxAscent, a);
              maxDescent = Math.max(maxDescent, d);
              continue;
            }

            // Normal (non-quoted) text stays as PDF text
            const wThisPt = widthPtForText(fam, txt, px);

            const m = measureChars(ctx, txt, px, fam);
            maxAscent = Math.max(maxAscent, m.ascent);
            maxDescent = Math.max(maxDescent, m.descent);

            measuredEls.push({ kind: "text", fam, text: txt, px, wPt: wThisPt });
            wPt += wThisPt;
            continue;
          }

          // SINGLE GLYPH
          if (el.type === "glyph") {
            const fam = el.fontFamily || FONT_FAMILY_TEXT;
            const px = (el.px ?? fontPx);
            const ch = getElementRenderCps(el).map(cp => String.fromCodePoint(cp)).join("");

            const wThisPt = widthPtForText(fam, ch, px);

            const m = measureChars(ctx, ch, px, fam);
            maxAscent = Math.max(maxAscent, m.ascent);
            maxDescent = Math.max(maxDescent, m.descent);

            measuredEls.push({ kind: "glyph", fam, text: ch, px, wPt: wThisPt });
            wPt += wThisPt;
            continue;
          }

          // RUN (multiple cps)
          if (el.type === "run") {
            const fam = el.fontFamily || FONT_FAMILY_TEXT;
            const px = (el.px ?? fontPx);
            const chars = getElementRenderCps(el).map(cp => String.fromCodePoint(cp)).join("");

            const wThisPt = widthPtForText(fam, chars, px);

            const m = measureChars(ctx, chars, px, fam);
            maxAscent = Math.max(maxAscent, m.ascent);
            maxDescent = Math.max(maxDescent, m.descent);

            measuredEls.push({ kind: "run", fam, text: chars, px, wPt: wThisPt });
            wPt += wThisPt;
            continue;
          }

          // CARTOUCHE (image in PDF)
          if (el.type === "cartouche") {
            const pdfCart = buildCartoucheCanvasForPdf(el, { fontPx });

            measuredEls.push({ kind: "cartoucheImg", el, pdfCart });

            // horizontal advance must match the actual PDF cartouche image
            const wPx = (pdfCart.w | 0);
            wPt += wPx * PX_TO_PT;

            // vertical metrics must also come from the actual PDF cartouche image
            const a = (pdfCart.baselineY != null)
              ? (pdfCart.baselineY | 0)
              : Math.floor((pdfCart.h | 0) * 0.75);
            const d = Math.max(0, (pdfCart.h | 0) - a);

            maxAscent = Math.max(maxAscent, a);
            maxDescent = Math.max(maxDescent, d);
            continue;
          }

          // Unknown element types: ignore safely (or log)
          // console.warn("Unknown element type in PDF export:", el);
        }

        const lineBoxH = Math.max(maxAscent + maxDescent, fontPx);

        measuredLines.push({ measuredEls, wPt, lineBoxH, maxAscent, maxDescent });
        maxLineWpt = Math.max(maxLineWpt, wPt);

        totalH += lineBoxH;
      }

      totalH += Math.max(0, (measuredLines.length - 1) * lineGapPx);



      const pageWpt = maxLineWpt + (padPx * 2) * PX_TO_PT;
      const pageHpt = (totalH + padPx * 2) * PX_TO_PT;

      const page = pdfDoc.addPage([pageWpt, pageHpt]);

      // Draw
      let yPx = padPx;

      for (let li = 0; li < measuredLines.length; li++) {
        const L = measuredLines[li];

        // pen position in POINTS (not px)
        const mode = getAlignMode();
        const f = alignFactor(mode);
        const lineOffsetPt = Math.max(0, (maxLineWpt - L.wPt) * f);
        let xPt = (padPx * PX_TO_PT) + lineOffsetPt;

        // baseline in px (vertical layout still based on your existing ascent/descent)
        const baselinePx = yPx + L.maxAscent;

        for (const el of L.measuredEls) {
          // 1) GAP
          if (el.kind === "gap") {
            xPt += Math.max(0, el.px | 0) * PX_TO_PT;
            continue;
          }

          // 1.5) QUOTED TEXT AS IMAGE
          if (el.kind === "quotedImg") {
            const img = el.img;

            const pngBytes = await canvasToPngBytes(img.canvas);
            const png = await pdfDoc.embedPng(pngBytes);

            const by = (img.baselineY | 0);
            const topLeftPx = baselinePx - by;

            const drawXpt = xPt;
            const drawYpt =
              pageHpt - (topLeftPx * PX_TO_PT) - ((img.h | 0) * PX_TO_PT);

            page.drawImage(png, {
              x: drawXpt,
              y: drawYpt,
              width: (img.w | 0) * PX_TO_PT,
              height: (img.h | 0) * PX_TO_PT,
            });

            xPt += (img.w | 0) * PX_TO_PT;
            continue;
          }

          // 2) CARTOUCHE AS IMAGE
          if (el.kind === "cartoucheImg") {
            const pdfCart = el.pdfCart;

            const pngBytes = await canvasToPngBytes(pdfCart.canvas);
            const png = await pdfDoc.embedPng(pngBytes);

            const by = (pdfCart.baselineY != null)
              ? (pdfCart.baselineY | 0)
              : Math.floor((pdfCart.h | 0) * 0.75);

            const topLeftPx = baselinePx - by;

            // x is already in points
            const drawXpt = xPt;

            // convert top-left px to PDF y coordinate (points from bottom)
            const drawYpt =
              pageHpt - (topLeftPx * PX_TO_PT) - ((pdfCart.h | 0) * PX_TO_PT);

            page.drawImage(png, {
              x: drawXpt,
              y: drawYpt,
              width: (pdfCart.w | 0) * PX_TO_PT,
              height: (pdfCart.h | 0) * PX_TO_PT,
            });

            // advance pen by the cartouche width (points)
            xPt += (pdfCart.w | 0) * PX_TO_PT;
            continue;
          }

          // 3) NORMAL TEXT / RUN / GLYPH
          // IMPORTANT: el must contain { text, fam, px, wPt } from the PDF measurement pass.
          const txt = String(el.text ?? "");
          if (!txt) continue;

          const drawXpt = xPt;
          const drawYpt = pageHpt - (baselinePx * PX_TO_PT);

          let pdfFont = fonts.fontText;
          if (el.fam === FONT_FAMILY_CARTOUCHE) pdfFont = fonts.fontCart;
          if (el.fam === FONT_FAMILY_LITERAL) pdfFont = fonts.fontLit;

          const fontSizePt = (el.px ?? fontPx) * PX_TO_PT;

          page.drawText(txt, {
            x: drawXpt,
            y: drawYpt,
            size: fontSizePt,
            font: pdfFont,
            color: rgb(r, g, b),
          });

          // advance pen by the PDF font's own width measurement (points)
          xPt += Number(el.wPt ?? 0);
        }

        // advance to next line (vertical layout still in px)
        yPx += L.lineBoxH;
        if (li < measuredLines.length - 1) yPx += lineGapPx;
      }

      const bytes = await pdfDoc.save();
      const blob = new Blob([bytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = "sitelen.pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }


    async function fetchFontBytes(url){
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Failed to fetch font: ${url} (${res.status})`);
      return await res.arrayBuffer();
    }

    // Embed the exact fonts you already use in canvas
    async function embedPdfFonts(pdfDoc){
      if (!window.fontkit) throw new Error("fontkit is missing (needed to embed OTF/TTF).");
      if (!window.PDFLib) throw new Error("pdf-lib is missing.");

      pdfDoc.registerFontkit(window.fontkit);

      // IMPORTANT: these URLs must be same-origin in your static site
      const [textBytes, cartBytes, literalBytes] = await Promise.all([
        fetchFontBytes("./fonts/nasin-nanpa-5.0.0-beta.3-UCSUR-v5.otf"),              // TP-Nasin-Nanpa-Font
        //fetchFontBytes("./fonts/nasin-nanpa-5.0.0-beta.3-UCSUR-nanpa-linja-n-good-kasi.otf"),// TP-Cartouche-Font
        fetchFontBytes("./fonts/nasin-nanpa-5.0.0-beta.3-UCSUR-nanpa-linja-n-good-kasi.otf"),// TP-Cartouche-Font new
        //fetchFontBytes("./fonts/PatrickHand-Regular.ttf"),                             // Patrick-Head-Font
      ]);

      const fontText = await pdfDoc.embedFont(textBytes, { subset: false }); // IMPORTANT for UCSUR / >BMP glyphs
      const fontCart = await pdfDoc.embedFont(cartBytes, { subset: false }); // IMPORTANT for cartouche glyphs too
      //const fontLit  = await pdfDoc.embedFont(literalBytes, { subset: false }); // OK to subset normal latin font

      return { fontText, fontCart  };//, fontLit };
    }

    const elTextIn = document.getElementById("textIn");
    const outCanvas = document.getElementById("outCanvas");
    const btnRender = document.getElementById("btnRender");
    const btnDownload = document.getElementById("btnDownloadPng");

    async function renderFromTextarea() {
      const fontPx = getFontPx();

      await fontsReadyForPx(fontPx);
      warmUpCanvasFontsOnce();

      const raw = String(elTextIn.value ?? "");
      const lines = raw.replace(/\r\n/g, "\n").split("\n");
      const linesElements = lines.map(line => lineToElements(line, { fontPx, mixedStyle: getMixedStyle() }));

      const anyContent = linesElements.some(els =>
        els.some(e => e.type === "glyph" || e.type === "cartouche" || e.type === "run" || e.type === "text")
      );

      if (!anyContent) {
        outCanvas.width = 1;
        outCanvas.height = 1;
        const ctx = outCanvas.getContext("2d", { alpha: true , willReadFrequently: true });
        ctx.clearRect(0, 0, 1, 1);
        announceStatus("Nothing to render (no recognized words).");
        return;
      }

      renderAllLinesToCanvas(outCanvas, linesElements, { fontPx });
      const  hex  = getFgHex();
      const haloOn = getHaloEnabled();
      const haloHex = getHaloHex();
      announceStatus(`Rendered sitelen pona. Mode: ${getNanpaLinjanMode()}. Font: ${fontPx}px. Color: ${hex}. Halo: ${haloOn ? "on" : "off"}${haloOn ? " " + haloHex : ""}.`);
      //announceStatus(`Rendered sitelen pona. Mode: ${getNanpaLinjanMode()}. Font: ${fontPx}px. Color: ${hex}.`);
    }



    let _autoRenderTimer = null;
    function scheduleAutoRender() {
      if (_autoRenderTimer) clearTimeout(_autoRenderTimer);
      _autoRenderTimer = setTimeout(async () => {
        try { await renderFromTextarea(); }
        catch (e) { console.warn("[auto-render] failed:", e); }
      }, 90);
    }


    // ============================================================
    // IndexedDB: persist last text input for #textIn
    // - autosave (debounced)
    // - restore on page load
    // ============================================================

    const TEXT_DRAFT_DB = "text-to-sitelen";
    const TEXT_DRAFT_STORE = "kv";
    const TEXT_DRAFT_KEY = "draft:textIn:v1";

    function openTextDraftDb(){
      return new Promise((resolve, reject) => {
        const req = indexedDB.open(TEXT_DRAFT_DB, 1);

        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(TEXT_DRAFT_STORE)){
            db.createObjectStore(TEXT_DRAFT_STORE);
          }
        };

        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }

    async function idbGetTextDraft(){
      const db = await openTextDraftDb();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(TEXT_DRAFT_STORE, "readonly");
        const store = tx.objectStore(TEXT_DRAFT_STORE);
        const req = store.get(TEXT_DRAFT_KEY);

        req.onsuccess = () => resolve(req.result ?? null);
        req.onerror = () => reject(req.error);

        tx.oncomplete = () => db.close();
        tx.onerror = () => { try { db.close(); } catch {} };
      });
    }

    async function idbSetTextDraft(value){
      const db = await openTextDraftDb();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(TEXT_DRAFT_STORE, "readwrite");
        const store = tx.objectStore(TEXT_DRAFT_STORE);
        const req = store.put(String(value ?? ""), TEXT_DRAFT_KEY);

        req.onsuccess = () => resolve(true);
        req.onerror = () => reject(req.error);

        tx.oncomplete = () => db.close();
        tx.onerror = () => { try { db.close(); } catch {} };
      });
    }

    // Debounced autosave
    let _autoSaveTimer = null;
    function scheduleAutoSaveTextDraft(value){
      if (_autoSaveTimer) clearTimeout(_autoSaveTimer);
      _autoSaveTimer = setTimeout(() => {
        idbSetTextDraft(value).catch((e) => console.warn("[idb autosave] failed:", e));
      }, 250);
    }

    const FloatingTextInEditor = {
      root: null,
      header: null,
      title: null,
      ta: null,
      closeBtn: null,
      popBtn: null,

      isOpen: false,
      sourceTextarea: null,

      dragging: false,
      dragPointerId: null,
      startX: 0,
      startY: 0,
      startLeft: 0,
      startTop: 0,

      suppressSync: false,
    };

    function clampFloatingTextInEditorToViewport() {
      const S = FloatingTextInEditor;
      if (!S.root) return;

      const rect = S.root.getBoundingClientRect();
      const maxLeft = Math.max(0, window.innerWidth - rect.width);
      const maxTop  = Math.max(0, window.innerHeight - rect.height);

      const curLeft = parseFloat(S.root.style.left || "0");
      const curTop  = parseFloat(S.root.style.top || "0");

      S.root.style.left = `${Math.max(0, Math.min(curLeft, maxLeft))}px`;
      S.root.style.top  = `${Math.max(0, Math.min(curTop, maxTop))}px`;
    }

    function syncFloatingTextInEditorFromSource(value) {
      const S = FloatingTextInEditor;
      if (!S.isOpen || !S.ta) return;
      if (S.suppressSync) return;

      const v = String(value ?? "");
      if (S.ta.value === v) return;

      S.suppressSync = true;
      S.ta.value = v;
      S.suppressSync = false;
    }

    function closeFloatingTextInEditor() {
      const S = FloatingTextInEditor;
      if (!S.root) return;

      S.root.classList.remove("show");
      S.root.setAttribute("aria-hidden", "true");
      S.isOpen = false;
    }

    function openFloatingTextInEditor() {
      const S = FloatingTextInEditor;
      if (!S.root || !S.ta || !S.sourceTextarea) return;

      S.isOpen = true;
      if (S.title) S.title.textContent = "Input";
      S.ta.value = String(S.sourceTextarea.value || "");

      S.root.classList.add("show");
      S.root.setAttribute("aria-hidden", "false");
      clampFloatingTextInEditorToViewport();

      S.ta.focus();
    }

    function initFloatingTextInEditor() {
      const S = FloatingTextInEditor;

      S.root = document.getElementById("floatingTextInEditor");
      S.header = document.getElementById("floatingTextInEditorHeader");
      S.title = document.getElementById("floatingTextInEditorTitle");
      S.ta = document.getElementById("floatingTextInEditorTextarea");
      S.closeBtn = document.getElementById("btnCloseFloatingTextInEditor");
      S.popBtn = document.getElementById("btnPopoutTextIn");
      S.sourceTextarea = elTextIn;

      if (!S.root || !S.header || !S.ta || !S.sourceTextarea) return;

      if (S.popBtn) {
        S.popBtn.addEventListener("click", () => {
          if (S.isOpen) closeFloatingTextInEditor();
          else openFloatingTextInEditor();
        });
      }

      const bigToggleBtn = document.getElementById("btnTogglePopoutMain");
      if (bigToggleBtn) {
        bigToggleBtn.addEventListener("click", () => {
          if (S.isOpen) closeFloatingTextInEditor();
          else openFloatingTextInEditor();
        });
      }

      if (S.closeBtn) {
        S.closeBtn.addEventListener("click", () => closeFloatingTextInEditor());
          // Optional: stop the header drag handler from grabbing this pointerdown
        S.closeBtn.addEventListener("pointerdown", (e) => e.stopPropagation());
      }

      // Main -> popup sync
      S.sourceTextarea.addEventListener("input", () => {
        syncFloatingTextInEditorFromSource(S.sourceTextarea.value);

        // NEW: autosave draft to IndexedDB (debounced)
        scheduleAutoSaveTextDraft(S.sourceTextarea.value);

        // Auto feedback on typing
        scheduleAutoRender();
      });

      // Popup -> main sync
      S.ta.addEventListener("input", () => {
        if (!S.sourceTextarea) return;
        if (S.suppressSync) return;

        S.suppressSync = true;
        S.sourceTextarea.value = S.ta.value;
        S.suppressSync = false;

        // Trigger the main textarea listeners (autosave + autorender + popup sync)
        S.sourceTextarea.dispatchEvent(new Event("input", { bubbles: true }));
      });

      // Dragging (pointer-based)
      S.header.addEventListener("pointerdown", (e) => {
        // If the user clicked an interactive control in the header (Close button),
        // do NOT begin dragging and do NOT preventDefault (otherwise click is cancelled).
        if (e.target && e.target.closest && e.target.closest("button, a, input, select, textarea")) {
          return;
        }

        // Only left click / primary contact
        if (e.button != null && e.button !== 0) return;

        S.dragging = true;
        S.dragPointerId = e.pointerId;

        const rect = S.root.getBoundingClientRect();
        S.startLeft = rect.left;
        S.startTop = rect.top;
        S.startX = e.clientX;
        S.startY = e.clientY;

        S.header.setPointerCapture?.(e.pointerId);
        e.preventDefault();
      });

      S.header.addEventListener("pointermove", (e) => {
        if (!S.dragging) return;
        if (S.dragPointerId != null && e.pointerId !== S.dragPointerId) return;

        const dx = e.clientX - S.startX;
        const dy = e.clientY - S.startY;

        S.root.style.left = `${S.startLeft + dx}px`;
        S.root.style.top  = `${S.startTop + dy}px`;
        clampFloatingTextInEditorToViewport();
      });

      function stopDrag(e) {
        if (!S.dragging) return;
        if (e && S.dragPointerId != null && e.pointerId !== S.dragPointerId) return;

        S.dragging = false;
        if (S.dragPointerId != null) {
          S.header.releasePointerCapture?.(S.dragPointerId);
        }
        S.dragPointerId = null;
      }

      S.header.addEventListener("pointerup", stopDrag);
      S.header.addEventListener("pointercancel", stopDrag);

      window.addEventListener("resize", () => clampFloatingTextInEditorToViewport());
    }


    function applyNewInputTextWithPipeline(newText) {
      // Always write into the source textarea (#textIn), then trigger the existing pipeline:
      // - pop-out sync
      // - IndexedDB autosave (debounced)
      // - auto-render (debounced)
      elTextIn.value = String(newText ?? "");
      elTextIn.dispatchEvent(new Event("input", { bubbles: true }));
    }

    function getExportFilenameBase() {
      // You can make this smarter if you want (e.g. include date/time)
      return "sitelen-input";
    }

    function wireImportExportButtons() {
      const btnImportMain = document.getElementById("btnImportTextMain");
      const btnExportMain = document.getElementById("btnExportTextMain");
      const btnImportPop  = document.getElementById("btnImportTextPop");
      const btnExportPop  = document.getElementById("btnExportTextPop");

      const filePick = document.getElementById("filePickTextIn");
      if (!filePick) return;

      // Shared import routine (uses hidden <input type="file">)
      async function doImport() {
        // If there is already content, confirm overwrite
        const cur = String(elTextIn.value ?? "");
        if (cur.trim().length > 0) {
          const ok = confirm("Replace the current input text with the contents of a .txt file?");
          if (!ok) return;
        }

        // Reset so selecting the same file twice still triggers change
        filePick.value = "";
        filePick.click();
      }

      filePick.addEventListener("change", async () => {
        try {
          const f = filePick.files && filePick.files[0];
          if (!f) return;

          const txt = await readFileAsText(f);
          applyNewInputTextWithPipeline(txt);
          announceStatus("Imported text file.");
        } catch (e) {
          showAlertAndAnnounce(e?.message ?? String(e));
        } finally {
          filePick.value = "";
        }
      });

      // Export routine
      function doExport() {
        const txt = String(elTextIn.value ?? "");
        const filename = `${getExportFilenameBase()}.txt`;
        downloadTextAsFile(txt, { filename });
        announceStatus("Exported text file.");
      }

      btnImportMain?.addEventListener("click", doImport);
      btnImportPop?.addEventListener("click", doImport);

      btnExportMain?.addEventListener("click", doExport);
      btnExportPop?.addEventListener("click", doExport);
    }


    btnRender.addEventListener("click", async () => {
      try { await renderFromTextarea(); }
      catch (e) { showAlertAndAnnounce(e?.message ?? String(e)); }
    });

    btnDownload.addEventListener("click", () => {
      try {
        downloadCanvasAsTransparentPng(outCanvas, { filenameBase: "sitelen", scale: 1 });
        announceStatus("Downloaded PNG.");
      } catch (e) {
        showAlertAndAnnounce(e?.message ?? String(e));
      }
    });


    const btnDownloadPdf = document.getElementById("btnDownloadPdf");

    btnDownloadPdf?.addEventListener("click", async () => {
      try{
        await exportRenderedToPdf();
        announceStatus("Downloaded PDF.");
      } catch(e){
        showAlertAndAnnounce(e?.message ?? String(e));
      }
    });


    function setQueryParamOnLink(a, key, value) {
      if (!a) return;
      try {
        const u = new URL(a.getAttribute("href"), window.location.href);
        u.searchParams.set(key, value);
        a.setAttribute("href", u.pathname + "?" + u.searchParams.toString() + u.hash);
      } catch (e) {
        console.warn("[link] failed to set query param:", e);
      }
    }

    function updateExternalLinksWithCartoucheDisplay() {
      const mode = getNanpaLinjanMode();

      const calc = document.getElementById("calculatorLink");
      const rend = document.getElementById("rendererLink");

      setQueryParamOnLink(calc, "cartoucheDisplay", mode);
      setQueryParamOnLink(rend, "cartoucheDisplay", mode);
    }

    function wireCartoucheDisplayLinks() {
      updateExternalLinksWithCartoucheDisplay();

      const radios = document.querySelectorAll('input[name="nlMode"]');
      radios.forEach(r => {
        r.addEventListener("change", () => {
          updateExternalLinksWithCartoucheDisplay();
        });
      });

      const linkIds = ["calculatorLink", "rendererLink"];
      for (const id of linkIds) {
        const a = document.getElementById(id);
        if (!a) continue;
        a.addEventListener("click", () => {
          updateExternalLinksWithCartoucheDisplay();
        });
      }
    }

    const DEFAULT_TP_TEXT = `toki pona`;

    async function __sitelenInternalInit() {
      try {
        if (btnRender) btnRender.disabled = true;
        if (btnDownload) btnDownload.disabled = true;
        announceStatus("Loading fonts…");

        applyNanpaLinjanModeFromQueryOrStorage();
        applyFontPxFromQueryOrStorage();
        applyAlignFromStorage();
        applyDefaultInputFromQuery();

        // Restore last draft from IndexedDB unless a ?text= / ?input= query param is supplying input.
        try {
          const hasQueryText = (readDefaultInputFromQuery() != null);
          if (!hasQueryText) {
            const saved = await idbGetTextDraft();
            if (saved != null && String(saved).length > 0 && elTextIn) {
              // Only overwrite if it actually differs (avoids needless churn).
              if (String(elTextIn.value ?? "") !== String(saved)) {
                elTextIn.value = String(saved);
                // Keep pop-out (if open) in sync
                syncFloatingTextInEditorFromSource(elTextIn.value);
              }
            }else{
              // Nothing saved -> set default sample
              elTextIn.value = DEFAULT_TP_TEXT;
              elTextIn.dispatchEvent(new Event("input", { bubbles: true }));
            }
          }
        } catch (e) {
          console.warn("[idb restore] failed:", e);
        }

        initFgColorControls();
        wireFgColorControls();

        initHaloControls();
        wireHaloControls();

        wireNanpaLinjanModeRadios();
        wireFontSizeSelect();
      wireAlignSelect();
        wireCartoucheDisplayLinks();

        await fontsReadyForPx(getFontPx());
        warmUpCanvasFontsOnce();

        if (btnRender) btnRender.disabled = false;
        if (btnDownload) btnDownload.disabled = false;

        // Auto-render on load (after restore)
        scheduleAutoRender();

        announceStatus("Fonts loaded. Ready to render.");
      } catch (e) {
        console.warn(e);
        if (btnRender) btnRender.disabled = false;
        if (btnDownload) btnDownload.disabled = false;
        announceStatus("Font loading failed; rendering may use fallback fonts.");
      }
    }

    __bridgeGetFontPx = getFontPx;
    __bridgeWordGapForPx = wordGapForPx;
    __bridgePushGapIfNeeded = pushGapIfNeeded;
    __bridgeMakeRunElementFromCodepoints = makeRunElementFromCodepoints;
    __bridgeParseTextSegmentToElements = parseTextSegmentToElements;
    __bridgeParseQuoteSegmentToElements = parseQuoteSegmentToElements;
    __bridgeParseInterpretedQuoteSegmentToElements = parseInterpretedQuoteSegmentToElements;
    __bridgeParseBracketSegmentToElements = parseBracketSegmentToElements;
    __bridgeFontsReadyForPx = fontsReadyForPx;
    __bridgeWarmUpCanvasFontsOnce = warmUpCanvasFontsOnce;
    __bridgeRenderAllLinesToCanvas = renderAllLinesToCanvas;
    __bridgeDrawTextWithOptionalHalo = drawTextWithOptionalHalo;
    __bridgeNormalizeTpGlyphKey = normalizeTpGlyphKey;
    __bridgeWordToUcsurCp = WORD_TO_UCSUR_CP;
    __bridgeEmitRawUcsurCodepointsWithOptionalManualTallies = emitRawUcsurCodepointsWithOptionalManualTallies;

    // Initialize pop-out editor
    initFloatingTextInEditor();
    wireImportExportButtons();
  
      if (typeof __sitelenInternalInit === 'function') await __sitelenInternalInit();
      return true;
    })();
    return __coreReady;
  }


  function mergeRendererInstanceConfig(baseConfig = {}, opts = {}) {
    return {
      ...baseConfig,
      ...opts,
      layout: {
        ...(baseConfig.layout || {}),
        ...(opts.layout || {})
      },
      paint: {
        ...(baseConfig.paint || {}),
        ...(opts.paint || {})
      },
      parser: {
        ...(baseConfig.parser || {}),
        ...(opts.parser || {})
      },
      fonts: {
        ...(baseConfig.fonts || {}),
        ...(opts.fonts || {}),
        roles: {
          ...((baseConfig.fonts || {}).roles || {}),
          ...(((opts.fonts || {}).roles) || {})
        },
        settings: {
          ...((baseConfig.fonts || {}).settings || {}),
          ...(((opts.fonts || {}).settings) || {})
        }
      }
    };
  }

  class RendererInstance {
    constructor(config = {}) {
      this.config = config || {};
    }

    async parseInput({ input, parser = {} } = {}) {
      await ensureCore();
      const config = mergeRendererInstanceConfig(this.config, { parser });
      return { ast: astFromInput(input, config.parser), diagnostics: [] };
    }

    async buildRenderPlan({ input, ast, layout = {}, paint = {}, parser = {}, fonts = {} }) {
      await ensureCore();
      const config = mergeRendererInstanceConfig(this.config, {
        layout,
        paint,
        parser,
        fonts
      });
      const effectiveAst = ast || astFromInput(input || '', config.parser);
            
      return await withScopedRenderConfig(config, async () => {
        if (typeof __bridgeFontsReadyForPx === 'function') await __bridgeFontsReadyForPx(config?.layout?.fontPx ?? (__bridgeGetFontPx ? __bridgeGetFontPx() : 56));
        if (typeof __bridgeWarmUpCanvasFontsOnce === 'function') __bridgeWarmUpCanvasFontsOnce();
        const linesElements = await astToLineElements(effectiveAst, config);
        const plan = buildMeasuredRenderPlan(linesElements, config);
        for (let lineIndex = 0; lineIndex < (plan.lines || []).length; lineIndex++) {
          const astLine = effectiveAst?.lines?.[lineIndex] || null;
          const planLine = plan.lines[lineIndex];
          if (!planLine) continue;
          planLine.sourceLineIndex = Number.isFinite(Number(astLine?.sourceLineIndex))
            ? Number(astLine.sourceLineIndex)
            : lineIndex;
          planLine.sentenceIndexInSourceLine = Number.isFinite(Number(astLine?.sentenceIndexInSourceLine))
            ? Number(astLine.sentenceIndexInSourceLine)
            : 0;
        }
        applyConditionalLiteralCartoucheClipsToPlan(plan, config);
        plan.ast = effectiveAst;
        plan.linesElements = linesElements;
        plan.diagnostics = [];
        return plan;
      });
    }

    async renderRunToNewCanvas({ run, supersampleScale = 4, downsample = false } = {}) {
      await ensureCore();
      return drawRenderRunToCanvas(run, { supersampleScale, downsample });
    }

    async renderTextToNewCanvas(opts = {}) {
      await ensureCore();
      const config = mergeRendererInstanceConfig(this.config, opts);
      
      return await renderAstToNewCanvas(astFromInput(opts.input || '', config.parser), config);
    }

    async renderTextToCanvas(opts = {}) {
      const rendered = await this.renderTextToNewCanvas(opts);
      await renderBlit(opts.canvas, opts.x, opts.y, rendered);
      return rendered;
    }

    async renderUcsurToNewCanvas(opts = {}) {
      await ensureCore();
      const config = mergeRendererInstanceConfig(this.config, opts);
      
      return await renderAstToNewCanvas(ucsurAstFromLines(opts.lines || []), config);
    }

    async renderUcsurToCanvas(opts = {}) {
      const rendered = await this.renderUcsurToNewCanvas(opts);
      await renderBlit(opts.canvas, opts.x, opts.y, rendered);
      return rendered;
    }
  }

    // ============================================================
  // NanpaParser — pure numeric parsing/encoding public API
  // No DOM, no fonts, no canvas, no async required.
  // All functions below are self-contained or call existing
  // private functions already used by the rendering pipeline.
  // The rendering pipeline is NOT modified.
  // ============================================================

  // Reverse map: codepoint -> toki pona word (built from WORD_TO_UCSUR_CP once core is ready)
  // We build it lazily so it works whether or not ensureCore() has been called.
  let __NP_UCSUR_CP_TO_WORD = null;
  function _npUcsurCpToWord() {
    if (!__NP_UCSUR_CP_TO_WORD) {
      __NP_UCSUR_CP_TO_WORD = new Map(
        Object.entries(_NP_WORD_TO_UCSUR_CP).map(([w, cp]) => [cp, w])
      );
    }
    return __NP_UCSUR_CP_TO_WORD;
  }

  // Token -> digit character (for decode path)
  const _NP_TOKEN_TO_DIGIT_CHAR = {
    "NI": "0", "WE": "1", "WA": "1", "TE": "2", "TU": "2", "SE": "3", "NA": "4",
    "LE": "5", "LU": "5", "NU": "6", "ME": "7", "MU": "7", "PE": "8", "PI": "8", "JE": "9",
  };

  const _NP_TP_UCSUR_MIN = 0xF1900;
  const _NP_TP_UCSUR_MAX = 0xF19A3;
  const _NP_CARTOUCHE_START_CP = 0xF1990;
  const _NP_CARTOUCHE_END_CP   = 0xF1991;

  // Self-contained TP map for NanpaParser so it does not depend on ensureCore() scope.
  const _NP_WORD_TO_UCSUR_CP = {
    "a": 0xF1900, "akesi": 0xF1901, "ala": 0xF1902, "alasa": 0xF1903,
    "ale": 0xF1904, "ali": 0xF1904, "anpa": 0xF1905, "ante": 0xF1906, "anu": 0xF1907,
    "awen": 0xF1908, "e": 0xF1909, "en": 0xF190A, "esun": 0xF190B, "ijo": 0xF190C,
    "ike": 0xF190D, "ilo": 0xF190E, "insa": 0xF190F, "jaki": 0xF1910, "jan": 0xF1911,
    "jelo": 0xF1912, "jo": 0xF1913, "kala": 0xF1914, "kalama": 0xF1915, "kama": 0xF1916,
    "kasi": 0xF1917, "ken": 0xF1918, "kepeken": 0xF1919, "kili": 0xF191A, "kiwen": 0xF191B,
    "ko": 0xF191C, "kon": 0xF191D, "kule": 0xF191E, "kulupu": 0xF191F, "kute": 0xF1920,
    "la": 0xF1921, "lape": 0xF1922, "laso": 0xF1923, "lawa": 0xF1924, "len": 0xF1925,
    "lete": 0xF1926, "li": 0xF1927, "lili": 0xF1928, "linja": 0xF1929, "lipu": 0xF192A,
    "loje": 0xF192B, "lon": 0xF192C, "luka": 0xF192D, "lukin": 0xF192E, "lupa": 0xF192F,
    "ma": 0xF1930, "mama": 0xF1931, "mani": 0xF1932, "meli": 0xF1933, "mi": 0xF1934,
    "mije": 0xF1935, "moku": 0xF1936, "moli": 0xF1937, "monsi": 0xF1938, "mu": 0xF1939,
    "mun": 0xF193A, "musi": 0xF193B, "mute": 0xF193C, "nanpa": 0xF193D, "nasa": 0xF193E,
    "nasin": 0xF193F, "nena": 0xF1940, "ni": 0xF1941, "nimi": 0xF1942, "noka": 0xF1943,
    "o": 0xF1944, "olin": 0xF1945, "ona": 0xF1946, "open": 0xF1947, "pakala": 0xF1948,
    "pali": 0xF1949, "palisa": 0xF194A, "pan": 0xF194B, "pana": 0xF194C, "pi": 0xF194D,
    "pilin": 0xF194E, "pimeja": 0xF194F, "pini": 0xF1950, "pipi": 0xF1951, "poka": 0xF1952,
    "poki": 0xF1953, "pona": 0xF1954, "pu": 0xF1955, "sama": 0xF1956, "seli": 0xF1957,
    "selo": 0xF1958, "seme": 0xF1959, "sewi": 0xF195A, "sijelo": 0xF195B, "sike": 0xF195C,
    "sin": 0xF195D, "sina": 0xF195E, "sinpin": 0xF195F, "sitelen": 0xF1960, "sona": 0xF1961,
    "soweli": 0xF1962, "su": 0xF19A6, "suli": 0xF1963, "suno": 0xF1964, "supa": 0xF1965,
    "suwi": 0xF1966, "tan": 0xF1967, "taso": 0xF1968, "tawa": 0xF1969, "telo": 0xF196A,
    "tenpo": 0xF196B, "toki": 0xF196C, "tomo": 0xF196D, "tu": 0xF196E, "unpa": 0xF196F,
    "uta": 0xF1970, "utala": 0xF1971, "walo": 0xF1972, "wan": 0xF1973, "waso": 0xF1974,
    "wawa": 0xF1975, "weka": 0xF1976, "wile": 0xF1977, "namako": 0xF1978, "kin": 0xF1979,
    "oko": 0xF197A, "kipisi": 0xF197B, "leko": 0xF197C, "monsuta": 0xF197D, "tonsi": 0xF197E,
    "jasima": 0xF197F, "kijetesantakalu": 0xF1980, "soko": 0xF1981, "meso": 0xF1982,
    "epiku": 0xF1983, "kokosila": 0xF1984, "lanpan": 0xF1985, "n": 0xF1986,
    "misikeke": 0xF1987, "ku": 0xF1988, "pake": 0xF19A0, "apeja": 0xF19A1,
    "majuna": 0xF19A2, "powe": 0xF19A3, "linluwi": 0xF19A4,
    "sewi^": 0xF198C, "ni>": 0xF198B, "ni^": 0xF198A, "ni<": 0xF1989,
    "·": 0xF199C, ":": 0xF199D, ",": 0xF199E, "ota": 0xF199C, "kolon": 0xF199D,
    "koma": 0xF199E, ".": 0xF199C
  };

  // Exact, case-insensitive input aliases for standard alternative glyph names.
  // These are input-only aliases; reverse codepoint-to-word output remains canonical
  // (ni, ni>, ni^, ni<, sewi, sewi^).
  const _NP_TP_WORD_INPUT_ALIASES = Object.freeze({
    "ni01": "ni",
    "ni02": "ni>",
    "ni03": "ni^",
    "ni04": "ni<",
    "sewi01": "sewi",
    "sewi02": "sewi^"
  });

  function _npResolveTpWordInputKey(raw) {
    const key = String(raw ?? "").trim().toLowerCase();
    return _NP_TP_WORD_INPUT_ALIASES[key] ?? key;
  }

  const _NP_NANPA_LINJA_N_WORD_TO_CP = {
    "ala":   0xF1902,
    "ike":   0xF190D,
    "uta":   0xF1970,

    "nanpa": 0xF193D,
    "nasa":  0xF193E,
    "nasin": 0xF193F,
    "nena":  0xF1940,
    "ni":    0xF1941,
    "nimi":  0xF1942,
    "noka":  0xF1943,
    "esun":  0xF190B,
    "en":    0xF190A,
    "e":     0xF1909,
    "o":     0xF1944,
    "ona":   0xF1946,
    "ota":   0xF199C,
    "open":  0xF1947,
    "kulupu":0xF191F,
    "kipisi":0xF197B,
    "kasi":  0xF1917,
    "kala":  0xF1914,
    "kin":   0xF1979,
    "ijo":   0xF190C,
    "wan":   0xF1973,
    "tu":    0xF196E,
    "seli":  0xF1957,
    "awen":  0xF1908,
    "luka":  0xF192D,
    "utala": 0xF1971,
    "mun":   0xF193A,
    "pipi":  0xF1951,
    "jo":    0xF1913,
    "kolon": 0xF199D,
    ":":     0xF199D
  };

  const _NP_CP_NANPA = _NP_NANPA_LINJA_N_WORD_TO_CP["nanpa"];
  const _NP_CP_NENA  = _NP_NANPA_LINJA_N_WORD_TO_CP["nena"];
  const _NP_CP_NASIN = _NP_NANPA_LINJA_N_WORD_TO_CP["nasin"];
  const _NP_CP_EN    = _NP_NANPA_LINJA_N_WORD_TO_CP["en"];
  const _NP_CP_E     = _NP_NANPA_LINJA_N_WORD_TO_CP["e"];

  const _NP_UNIFORM_TO_NENA = new Set([
    _NP_NANPA_LINJA_N_WORD_TO_CP["nasa"],
    _NP_NANPA_LINJA_N_WORD_TO_CP["nasin"],
    _NP_NANPA_LINJA_N_WORD_TO_CP["ni"],
    _NP_NANPA_LINJA_N_WORD_TO_CP["nimi"],
    _NP_NANPA_LINJA_N_WORD_TO_CP["noka"],
    _NP_NANPA_LINJA_N_WORD_TO_CP["nena"]
  ]);

  const _NP_UNIFORM_TO_EN = new Set([
    _NP_NANPA_LINJA_N_WORD_TO_CP["e"],
    _NP_NANPA_LINJA_N_WORD_TO_CP["en"],
    _NP_NANPA_LINJA_N_WORD_TO_CP["esun"]
  ]);

  const _NP_STRICT_DIGIT_TOKENS = new Set(["NI","WE","TE","SE","NA","LE","NU","ME","PE","JE"]);
  const _NP_RELAXED_DIGIT_TOKENS = new Set(["WA","TU","LU","MU","PI"]);
  const _NP_DIGIT_TOKENS = new Set([..._NP_STRICT_DIGIT_TOKENS, ..._NP_RELAXED_DIGIT_TOKENS]);
  const _NP_TOKEN_PREFIXES = ["KEKEKE","KEKE","KO","KE","NONONO","NONO","NOKO","OK","NE","NS","NO"];

  const _NP_RELAXED_TOKEN_TO_STRICT_TOKEN = Object.freeze({
    "WA": "WE",
    "TU": "TE",
    "LU": "LE",
    "MU": "ME",
    "PI": "PE"
  });

  function _npCanonicalizeScientificCaps(caps) {
    return String(caps ?? "")
      .trim()
      .toUpperCase()
      .replace(/NEKO(?:WE|WA)NINEKO/g, "NEKO");
  }

  function _npCanonicalizeScientificTokens(inputTokens) {
    const tokens = Array.from(inputTokens ?? []);
    const out = [];

    for (let i = 0; i < tokens.length; ) {
      const isLegacyMarker =
        i + 5 < tokens.length &&
        tokens[i] === "NE" &&
        tokens[i + 1] === "KO" &&
        (tokens[i + 2] === "WE" || tokens[i + 2] === "WA") &&
        tokens[i + 3] === "NI" &&
        tokens[i + 4] === "NE" &&
        tokens[i + 5] === "KO";

      if (isLegacyMarker) {
        out.push("NE", "KO");
        i += 6;
        continue;
      }

      out.push(tokens[i]);
      i += 1;
    }

    return out;
  }

  function _npFindScientificMarker(tokens, startIndex = 1, endIndex = null) {
    const a = Array.from(tokens ?? []);
    const end = endIndex == null ? a.length : Math.min(a.length, Number(endIndex));
    for (let i = Math.max(0, Number(startIndex) || 0); i + 1 < end; i++) {
      if (a[i] === "NE" && a[i + 1] === "KO") return { index: i, length: 2 };
    }
    return null;
  }

  const _NP_RELAXED_TOKEN_TO_RENDER_WORDS = Object.freeze({
    "WA": ["wan", "ala"],
    "TU": ["tu", "uta"],
    "LU": ["luka", "uta"],
    "MU": ["mun", "uta"],
    "PI": ["pipi", "ike"]
  });

  const _NP_TOKEN_TO_NUMBER_CODE_LETTER = Object.freeze({
    "NI": "I",
    "WE": "W", "WA": "W",
    "TE": "T", "TU": "T",
    "SE": "S",
    "NA": "A",
    "LE": "L", "LU": "L",
    "NU": "U",
    "ME": "M", "MU": "M",
    "PE": "P", "PI": "P",
    "JE": "J"
  });

  function _npRelaxedParsingFromOpts(opts = {}) {
    return !!opts.relaxedNanpaLinjanParsing;
  }

  function _npRelaxedRenderingFromOpts(opts = {}) {
    return !!opts.relaxedNanpaLinjanRendering;
  }

  function _npNanpaColonRenderingFromOpts(opts = {}) {
    return opts.nanpaColonRendering === true;
  }

  function _npNanpaColonParsingFromOpts(opts = {}) {
    return opts.nanpaColonParsing === true || _npNanpaColonRenderingFromOpts(opts);
  }

  function _npDigitTokensAcceptedByParser(opts = {}) {
    return _npRelaxedParsingFromOpts(opts) ? _NP_DIGIT_TOKENS : _NP_STRICT_DIGIT_TOKENS;
  }

  const _NP_NUMBER_CODE_LETTER_TO_PAIR = {
    "I":"NI","W":"WE","T":"TE","S":"SE","A":"NA",
    "L":"LE","U":"NU","M":"ME","P":"PE","J":"JE"
  };

  const _NP_TOKEN_TO_DIGIT_WORD = {
    "NI":"ijo","WE":"wan","WA":"wan","TE":"tu","TU":"tu","SE":"seli","NA":"awen",
    "LE":"luka","LU":"luka","NU":"utala","ME":"mun","MU":"mun","PE":"pipi","PI":"pipi","JE":"jo"
  };

  const _NP_WORD_FOR_NEGATIVE_SIGN = "ona";

  const _NP_VULGAR_FRACTIONS = new Map([
    ["¼", [1, 4]], ["½", [1, 2]], ["¾", [3, 4]],
    ["⅐", [1, 7]], ["⅑", [1, 9]], ["⅒", [1, 10]],
    ["⅓", [1, 3]], ["⅔", [2, 3]],
    ["⅕", [1, 5]], ["⅖", [2, 5]], ["⅗", [3, 5]], ["⅘", [4, 5]],
    ["⅙", [1, 6]], ["⅚", [5, 6]],
    ["⅛", [1, 8]], ["⅜", [3, 8]], ["⅝", [5, 8]], ["⅞", [7, 8]],
    ["↉", [0, 3]],
  ]);

  const _NP_STRICT_DEC_DIGIT_TO_TOKEN = {
    "0": "NI", "1": "WE", "2": "TE", "3": "SE", "4": "NA",
    "5": "LE", "6": "NU", "7": "ME", "8": "PE", "9": "JE",
  };

  const _NP_RELAXED_DEC_DIGIT_TO_TOKEN = {
    "0": "NI", "1": "WA", "2": "TU", "3": "SE", "4": "NA",
    "5": "LU", "6": "NU", "7": "MU", "8": "PI", "9": "JE",
  };

  function _npDecimalDigitToNanpaToken(ch, opts = {}) {
    const map = _npRelaxedParsingFromOpts(opts)
      ? _NP_RELAXED_DEC_DIGIT_TO_TOKEN
      : _NP_STRICT_DEC_DIGIT_TO_TOKEN;
    return map[String(ch)];
  }

  function _npNormalizeTpWord(raw) {
    return String(raw ?? "").toLowerCase().replace(/[^a-z]/g, "");
  }

  function _npUniformizeNanpaLinjanCartoucheCps(cps) {
    const a = Array.from(cps ?? []);
    if (a.length === 0) return a;

    const hasExplicitPositiveOpening =
      a.length >= 4 &&
      a[0] === _NP_CP_NANPA &&
      a[1] === _NP_CP_E &&
      a[2] === _NP_CP_NENA &&
      a[3] === _NP_CP_EN;

    for (let i = 0; i < a.length; i++) {
      const cp = a[i];
      if (cp === _NP_CP_NANPA) {
        if (i !== 0 && i !== a.length - 1) a[i] = _NP_CP_NENA;
        continue;
      }
      if (_NP_UNIFORM_TO_NENA.has(cp)) { a[i] = _NP_CP_NENA; continue; }
      if (_NP_UNIFORM_TO_EN.has(cp)) {
        a[i] = (hasExplicitPositiveOpening && i === 3) ? _NP_CP_EN : _NP_CP_E;
        continue;
      }
    }
    return a;
  }

  function _npNanpaCapsHasAtLeastOneDigitToken(tokens) {
    for (const t of (tokens ?? [])) {
      if (_NP_DIGIT_TOKENS.has(t)) return true;
    }
    return false;
  }

  function _npTokenizeNanpaCaps(caps, opts = {}) {
    if (caps == null) throw new Error("caps must be a string");
    const s = String(caps).trim().toUpperCase();
    if (!s) throw new Error("caps is empty");
    if (!s.endsWith("N")) throw new Error("nanpa-caps must end with final terminator 'N'");
    if (!s.startsWith("NE")) throw new Error("nanpa-caps must start with 'NE'");

    const tokens = [];
    let i = 0;
    const end = s.length;

    while (i < end - 1) {
      let matched = null;
      for (const pref of _NP_TOKEN_PREFIXES) {
        if (s.startsWith(pref, i)) { matched = pref; break; }
      }
      if (matched != null) { tokens.push(matched); i += matched.length; continue; }

      if (i + 2 <= end - 1) {
        const two = s.slice(i, i + 2);
        if (_npDigitTokensAcceptedByParser(opts).has(two)) { tokens.push(two); i += 2; continue; }
      }

      throw new Error(`Invalid tokenization at position ${i} in caps string "${caps}"`);
    }

    tokens.push("N");
    return tokens;
  }

  function _npNanpaColonProperNameToCaps(raw, opts = {}) {
    if (!_npNanpaColonParsingFromOpts(opts)) return null;
    const source = String(raw ?? "").trim();
    if (!source) return null;

    let remainder = "";
    const attached = /^Nanpa([a-z]+)((?:[ \t]+[A-Z][a-z]*)*)$/.exec(source);
    if (attached) {
      const laterWords = attached[2].trim().split(/[ \t]+/).filter(Boolean);
      remainder = attached[1] + laterWords.join("");
    } else if (/^Nanpa(?:[ \t]+[A-Z][a-z]*)+$/.test(source)) {
      remainder = source.split(/[ \t]+/).slice(1).join("");
    } else return null;

    if (!remainder || !/[nN]$/.test(remainder)) return null;
    let core = remainder.slice(0, -1);
    if (core.length < 2 || (core.length % 2) !== 0) return null;

    let hasPercent = false;
    if (/noke$/i.test(core)) {
      hasPercent = true;
      core = core.slice(0, -4);
      if (core.length < 2 || (core.length % 2) !== 0) return null;
    }

    let bodyCaps = core.toUpperCase();
    if (bodyCaps.startsWith("NE")) bodyCaps = "NS" + bodyCaps.slice(2);
    const caps = "NE" + bodyCaps + (hasPercent ? "OKN" : "N");
    try {
      const tokens = _npTokenizeNanpaCaps(caps, opts);
      return _npNanpaCapsHasAtLeastOneDigitToken(tokens) ? caps : null;
    } catch { return null; }
  }

  function _npProperNameToCaps(raw, opts = {}) {
    const source = String(raw ?? "").trim();
    if (!source) return null;

    const nanpaColonCaps = _npNanpaColonProperNameToCaps(source, opts);
    if (nanpaColonCaps) return nanpaColonCaps;

    if (!/^[A-Za-z]+(?:\s+[A-Za-z]+)*$/.test(source)) return null;

    const words = source.split(/\s+/).filter(Boolean);
    const compact = words.join("");
    if (!compact || !/[nN]$/.test(compact)) return null;

    let core = compact.slice(0, -1);
    if (core.length < 2 || (core.length % 2) !== 0) return null;

    let hasPercent = false;
    if (/noke$/i.test(core)) {
      hasPercent = true;
      core = core.slice(0, -4);
      if (core.length < 2 || (core.length % 2) !== 0) return null;
    }

    let coreCaps = core.toUpperCase();
    if (!coreCaps.startsWith("NE")) return null;
    if (/^nene/i.test(source) && coreCaps.startsWith("NENE")) {
      coreCaps = "NENS" + coreCaps.slice(4);
    }

    const caps = hasPercent ? (coreCaps + "OKN") : (coreCaps + "N");
    try { _npTokenizeNanpaCaps(caps, opts); return caps; }
    catch { return null; }
  }

  function _npIsValidNanpaLinjanProperName(raw, opts = {}) {
    return _npProperNameToCaps(raw, opts) != null;
  }

  const _NP_STRICT_HUNDRED_ININ_SUFFIXES = Object.freeze([
    "weninin", "teninin", "seninin", "naninin", "leninin",
    "nuninin", "meninin", "peninin", "jeninin"
  ]);

  const _NP_RELAXED_HUNDRED_ININ_SUFFIXES = Object.freeze([
    "waninin", "tuninin", "luninin", "muninin", "pininin"
  ]);

  function _npMagnitudeKeProperNameFragment(rawCount) {
    const count = Math.max(0, Math.floor(Number(rawCount) || 0));
    if (count < 1) return "";

    // Preserve the established one-, two-, and three-boundary words. For any
    // longer run, use two-boundary words, except that an odd final remainder
    // is kept as one three-boundary word. Only the first word carries the
    // initial e; the final cartouche n is appended by the caller.
    if (count <= 3) return "e" + "ke".repeat(count);

    const groupSizes = [2];
    let remaining = count - 2;
    while (remaining > 3) {
      groupSizes.push(2);
      remaining -= 2;
    }
    groupSizes.push(remaining); // final group is always 2 or 3

    return groupSizes
      .map((size, index) => (index === 0 ? "e" : "") + "ke".repeat(size))
      .join(" ");
  }

  function _npSplitFinalHundredIninWords(rawName, opts = {}) {
    const words = String(rawName ?? "").trim().split(/\s+/).filter(Boolean);
    if (!words.length) return "";

    const suffixes = _npRelaxedParsingFromOpts(opts)
      ? _NP_STRICT_HUNDRED_ININ_SUFFIXES.concat(_NP_RELAXED_HUNDRED_ININ_SUFFIXES)
      : _NP_STRICT_HUNDRED_ININ_SUFFIXES;

    const out = [];
    for (const word of words) {
      const lower = word.toLowerCase();
      const shouldSplit = suffixes.some(suffix => lower.endsWith(suffix));

      if (shouldSplit && lower.endsWith("inin") && word.length > 4) {
        const head = word.slice(0, -4);
        const tail = word.slice(-4);
        if (head) {
          out.push(head, tail);
          continue;
        }
      }

      out.push(word);
    }

    return out.join(" ");
  }

  function _npNormalizeNumberCodeInput(raw) {
    return String(raw ?? "").trim().replace(/\s+/g, "");
  }

  function _npTryParseNanpaLinjanNumberCodeToCaps(raw) {
    const s0 = _npNormalizeNumberCodeInput(raw);
    if (!s0) return null;
    if (!s0.toUpperCase().startsWith("#~")) return null;

    let rawBody = s0.slice(2);
    if (!rawBody) throw new Error("Number code '#~' must have content after it.");

    let hasLeadingPlus = false;
    if (rawBody.startsWith("+")) {
      hasLeadingPlus = true;
      rawBody = rawBody.slice(1);
      if (!rawBody) throw new Error("Leading plus in number code must be followed immediately by a digit code.");
    }

    let body = rawBody.toUpperCase();
    if (!/^[A-Z]+$/.test(body)) throw new Error("Number code may contain only one optional leading '+' followed by letters A–Z.");

    const leadingECount = /^E+/.exec(body)?.[0]?.length || 0;
    if (hasLeadingPlus) {
      if (!_NP_NUMBER_CODE_LETTER_TO_PAIR[body[0]]) {
        throw new Error("Leading plus in number code must be followed immediately by a digit code.");
      }
    } else if (leadingECount === 1) {
      if (!_NP_NUMBER_CODE_LETTER_TO_PAIR[body[1]]) {
        throw new Error("A single leading 'e' positive marker must be followed immediately by a digit code.");
      }
      hasLeadingPlus = true;
      body = body.slice(1);
    } else if (leadingECount > 1 && (leadingECount % 2) === 1) {
      throw new Error("At the start of a number code, 'e' must be either one positive marker before a digit or an even no-value-spacer run.");
    }

    let hasPercent = false;
    if (body.endsWith("OK")) {
      hasPercent = true;
      body = body.slice(0, -2);
      if (!body) throw new Error("Number code '#~' cannot be only 'OK' (no numeric content).");
    }

    const tokens = ["NE"];
    if (hasLeadingPlus) tokens.push("NS");
    let i = 0;

    const legacyScientificMarkerIndex = body.indexOf("KOWIKO");
    const hasLegacyScientificNumberCodeMarker =
      legacyScientificMarkerIndex > 0 &&
      body[legacyScientificMarkerIndex - 1] !== "O" &&
      (legacyScientificMarkerIndex + "KOWIKO".length) < body.length;

    function ensureNEBeforeOperatorRun() {
      if (tokens[tokens.length - 1] !== "NE") tokens.push("NE");
    }

    while (i < body.length) {
      const ch = body[i];

      if (body.startsWith("OKO", i)) {
        tokens.push("NOKO");
        i += 3;
        continue;
      }

      // A consecutive E run is parsed from left to right in pairs. Each EE
      // is one exact NENE no-value spacer. If the run has one E left over,
      // that final E is valid only as the start of EKO, the scientific marker.
      // Examples: EE -> one spacer; EEEE -> two spacers; EEEKO -> spacer + EKO.
      if (ch === "E") {
        let j = i;
        while (j < body.length && body[j] === "E") j++;
        const count = j - i;
        const spacerCount = Math.floor(count / 2);

        for (let spacerIndex = 0; spacerIndex < spacerCount; spacerIndex++) {
          tokens.push("NE", "NE");
        }

        if ((count % 2) === 1) {
          const scientificMarkerIndex = j - 1;
          const hasFollowingKo = body.startsWith("KO", j);
          const hasContentBefore = scientificMarkerIndex > 0;
          const hasContentAfter = (j + 2) < body.length;

          if (!hasFollowingKo || !hasContentBefore || !hasContentAfter) {
            throw new Error("An odd run of 'E' in number code must end with a valid EKO scientific marker.");
          }

          // The unpaired E contributes its own NE, even when a preceding EE
          // spacer already left NE as the previous token.
          tokens.push("NE", "KO");
          i = j + 2;
        } else {
          i = j;
        }
        continue;
      }

      // Backward compatibility for the previous KOWIKO scientific signature.
      // A bare KO elsewhere keeps its older meaning as K + O. For example,
      // #~WIkooS must continue to decode as 10,000/3, not 10^3.
      // #~JokoWIkooS must also stay integer+fraction because KOWIKO is part of OKO.
      if (
        hasLegacyScientificNumberCodeMarker &&
        body.startsWith("KO", i) &&
        (i === legacyScientificMarkerIndex || i === legacyScientificMarkerIndex + 4)
      ) {
        ensureNEBeforeOperatorRun();
        tokens.push("KO");
        i += 2;
        continue;
      }

      if (ch === "O") {
        let j = i;
        while (j < body.length && body[j] === "O") j++;
        const count = j - i;
        if (count < 1 || count > 3) throw new Error("Invalid run of 'O' in number code (max 3).");

        if (count === 1) {
          if (i === 0 || tokens[tokens.length - 1] === "KO") tokens.push("NO");
          else tokens.push("NO","NE");
        } else {
          tokens.push("NO".repeat(count));
        }

        i = j;
        continue;
      }

      if (ch === "K") {
        let j = i;
        while (j < body.length && body[j] === "K") j++;
        const count = j - i;
        if (count < 1) throw new Error("Invalid empty run of 'K' in number code.");

        ensureNEBeforeOperatorRun();
        // K-runs encode repeated base-1000 boundaries. Keep the complete run;
        // tokenization and rendering support any number of consecutive KE pairs.
        tokens.push("KE".repeat(count));
        i = j;
        continue;
      }

      const pair = _NP_NUMBER_CODE_LETTER_TO_PAIR[ch];
      if (!pair) throw new Error(`Invalid letter '${ch}' in number code.`);
      tokens.push(pair);
      i += 1;
    }

    if (hasPercent) tokens.push("OK");
    tokens.push("N");

    const caps = _npCanonicalizeScientificCaps(tokens.join(""));
    _npTokenizeNanpaCaps(caps);
    return { caps };
  }

  function _npNanpaCapsTokensToTpWords(tokens, { mode = "traditional", relaxedRendering = false, nanpaColonRendering = false } = {}) {
    if (!tokens || tokens.length === 0) return [];

    const uniform = (mode === "uniform");
    const out = [];

    const E_WORD = uniform ? "e" : "esun";
    const E_WORD_FOR_NE_AFTER_START = "e";
    const N_WORD = uniform ? "nena" : "nasa";

    const N_WORD_DECIMAL_POINT = uniform ? "nena" : "ni";
    const N_END_WORD = "nanpa";

    let afterStartingNe = false;
    let afterScientificMarker = false;

    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i];

      if (t === "NE") {
        const nxt = (i + 1 < tokens.length) ? tokens[i + 1] : null;
        if (nxt === "KO") {
          if (out.length === 0) {
            if (nanpaColonRendering) out.push("nanpa", ":", "kala", "open");
            else out.push("nanpa", E_WORD, "kala", "open");
          } else out.push(N_WORD, E_WORD_FOR_NE_AFTER_START, "kala", "open");
          afterStartingNe = false;
          afterScientificMarker = true;
          i += 1;
          continue;
        }

        afterScientificMarker = false;
        if (out.length === 0) {
          if (nanpaColonRendering) out.push("nanpa", ":");
          else out.push("nanpa", E_WORD);
          afterStartingNe = true;
        } else {
          out.push(N_WORD, E_WORD_FOR_NE_AFTER_START);
          afterStartingNe = false;
        }
        continue;
      }

      if (t === "NS") {
        out.push("nena", "en");
        afterStartingNe = false;
        afterScientificMarker = false;
        continue;
      }

      if (_NP_DIGIT_TOKENS.has(t)) {
        afterStartingNe = false;
        afterScientificMarker = false;

        if (relaxedRendering && _NP_RELAXED_TOKEN_TO_RENDER_WORDS[t]) {
          out.push(..._NP_RELAXED_TOKEN_TO_RENDER_WORDS[t]);
          continue;
        }

        const strictToken = _NP_RELAXED_TOKEN_TO_STRICT_TOKEN[t] || t;
        const digitWord = _NP_TOKEN_TO_DIGIT_WORD[strictToken];
        if (strictToken === "NI" || strictToken === "NA" || strictToken === "NU") out.push(N_WORD, digitWord);
        else out.push(digitWord, E_WORD);
        continue;
      }

      if (t === "NO") {
        if (afterStartingNe || afterScientificMarker) {
          out.push(N_WORD, _NP_WORD_FOR_NEGATIVE_SIGN);
          afterStartingNe = false;
          afterScientificMarker = false;
          continue;
        }

        const nxt = (i + 1 < tokens.length) ? tokens[i + 1] : null;
        if (nxt === "NE") {
          out.push(N_WORD_DECIMAL_POINT, "o", N_WORD, E_WORD_FOR_NE_AFTER_START);
          afterStartingNe = false;
          i += 1;
          continue;
        }

        out.push(N_WORD_DECIMAL_POINT, "o");
        afterStartingNe = false;
        continue;
      }

      if (t === "NONO") {
        out.push("nena","o","nena","o");
        afterStartingNe = false;
        continue;
      }

      if (t === "NOKO") {
        out.push("nena","open","kin","open");
        afterStartingNe = false;
        continue;
      }

      if (t === "NONONO") {
        out.push(N_WORD,"o",N_WORD,"o",N_WORD,"o");
        afterStartingNe = false;
        continue;
      }

      if (t === "KE") { out.push("kulupu", E_WORD_FOR_NE_AFTER_START); afterStartingNe=false; continue; }
      if (t === "KEKE") { out.push("kulupu",E_WORD_FOR_NE_AFTER_START,"kulupu",E_WORD_FOR_NE_AFTER_START); afterStartingNe=false; continue; }
      if (t === "KEKEKE") { out.push("kulupu",E_WORD_FOR_NE_AFTER_START,"kulupu",E_WORD_FOR_NE_AFTER_START,"kulupu",E_WORD_FOR_NE_AFTER_START); afterStartingNe=false; continue; }

      if (t === "N") { out.push(N_END_WORD); afterStartingNe=false; continue; }

      throw new Error(`Unknown token "${t}"`);
    }

    return out;
  }

  function _npReplaceTimeSeparatorsTpWords(tpWords, mode) {
    const join = "e";
    const nWord = (mode === "uniform") ? "nena" : "nasa";
    const pattern = [nWord, join, "kulupu", join];

    const out = [];
    for (let i = 0; i < tpWords.length; ) {
      const isMatch =
        i + pattern.length <= tpWords.length &&
        pattern.every((w, k) => tpWords[i + k] === w);

      if (isMatch) {
        out.push(nWord, join, "kasi", join);
        i += pattern.length;
      } else {
        out.push(tpWords[i]);
        i += 1;
      }
    }
    return out;
  }

  function _npNanpaCapsToNanpaLinjanCodepoints(caps, { mode = "traditional", isTime = false, relaxedParsing = false, relaxedRendering = false, nanpaColonRendering = false } = {}) {
    let canonicalCaps = _npCanonicalizeScientificCaps(caps);
    if (isTime && _npNanpaCapsIsValidTime(canonicalCaps, { relaxedNanpaLinjanParsing: relaxedParsing })) {
      canonicalCaps = _npNormalizeTimeNegativeZeroCaps(canonicalCaps, { relaxedNanpaLinjanParsing: relaxedParsing });
    }
    const tokens = _npTokenizeNanpaCaps(canonicalCaps, { relaxedNanpaLinjanParsing: relaxedParsing });
    if (!_npNanpaCapsHasAtLeastOneDigitToken(tokens)) return null;

    let hasPercent = false;
    const tokensNoOk = [];
    for (const t of tokens) {
      if (t === "OK") { hasPercent = true; continue; }
      tokensNoOk.push(t);
    }

    const tpWords = _npNanpaCapsTokensToTpWords(tokensNoOk, { mode, relaxedRendering, nanpaColonRendering });
    const tpWordsFinal = isTime ? _npReplaceTimeSeparatorsTpWords(tpWords, mode) : tpWords;

    const cps = [];
    for (const w of tpWordsFinal) {
      const cp = _NP_NANPA_LINJA_N_WORD_TO_CP[w];
      if (cp == null) return null;
      cps.push(cp);
    }

    const out = (mode === "uniform") ? _npUniformizeNanpaLinjanCartoucheCps(cps) : cps;

    if (hasPercent) {
      const suffixWords = (mode === "uniform")
        ? ["nena", "open", "kipisi", "e"]
        : ["noka", "open", "kipisi", "e"];

      const suffixCps = [];
      for (const w of suffixWords) {
        const cp = _NP_NANPA_LINJA_N_WORD_TO_CP[w];
        if (cp == null) return null;
        suffixCps.push(cp);
      }

      const lastNanpaIdx = out.lastIndexOf(_NP_CP_NANPA);
      if (lastNanpaIdx >= 0) out.splice(lastNanpaIdx, 0, ...suffixCps);
      else out.push(...suffixCps);
    }

    return out;
  }

  function _npTryDecodeNanpaLinjanIdentifierToCodepoints(rawText, { mode = "traditional", relaxedParsing = false, relaxedRendering = false, nanpaColonParsing = false, nanpaColonRendering = false } = {}) {
    const s = String(rawText ?? "").trim();
    if (!s) return null;

    try {
      const parsed = _npTryParseNanpaLinjanNumberCodeToCaps(s);
      if (parsed?.caps) {
        const isTime = _npNanpaCapsIsValidTimeOrDate(parsed.caps);
        return _npNanpaCapsToNanpaLinjanCodepoints(parsed.caps, { mode, isTime, relaxedParsing, relaxedRendering, nanpaColonRendering });
      }
    } catch {
      return null;
    }

    const properOpts = { relaxedNanpaLinjanParsing: relaxedParsing, nanpaColonParsing, nanpaColonRendering };
    if (!_npIsValidNanpaLinjanProperName(s, properOpts)) return null;

    const caps = _npProperNameToCaps(s, properOpts);
    if (!caps) return null;

    const isTime = _npNanpaCapsIsValidTimeOrDate(caps, { relaxedNanpaLinjanParsing: relaxedParsing });
    return _npNanpaCapsToNanpaLinjanCodepoints(caps, { mode, isTime, relaxedParsing, relaxedRendering, nanpaColonRendering });
  }

  function _npNormalizeVulgarFractionInput(raw) {
    if (raw == null) return "";
    let s = String(raw).trim();
    if (!s) return s;

    s = s.replace(/\u2044/g, "/");

    let found = null;
    for (const ch of s) {
      if (_NP_VULGAR_FRACTIONS.has(ch)) { found = ch; break; }
    }
    if (!found) return s;

    const lastChar = s.slice(-1);
    if (!_NP_VULGAR_FRACTIONS.has(lastChar)) {
      throw new Error("Vulgar fraction characters must appear at the end (e.g., 9¾ or ¾).");
    }

    if (s.slice(1).includes("-") || s.slice(1).includes("+")) {
      throw new Error("A sign is allowed only once, at the start.");
    }

    const [num, den] = _NP_VULGAR_FRACTIONS.get(lastChar);
    const prefixRaw = s.slice(0, -1).trim();

    if (!prefixRaw) return `${num}/${den}`;

    const sign = prefixRaw.startsWith("-") ? "-" : (prefixRaw.startsWith("+") ? "+" : "");
    const prefix = sign ? prefixRaw.slice(1).trim() : prefixRaw;

    if (!prefix) return `${sign}${num}/${den}`;
    return `${sign}${prefix}+${num}/${den}`;
  }

  function _npLooksLikeNanpaCaps(s) {
    if (!s) return false;
    const t = String(s).trim();
    if (!t) return false;
    if (!/^[A-Za-z]+[Nn]$/.test(t)) return false;
    return t.slice(0, 2).toUpperCase() === "NE";
  }

  function _npGroupFractionDigitsOnly(s, decimalChar=".", groupSize=3, sepChar="_") {
    const str = String(s);
    const idx = str.indexOf(decimalChar);
    if (idx < 0) return str;

    const left = str.slice(0, idx);
    const right = str.slice(idx + 1);

    let i = 0;
    while (i < right.length && /[0-9]/.test(right[i])) i++;
    const fracDigits = right.slice(0, i);
    const suffix = right.slice(i);

    if (fracDigits.length <= groupSize) return str;
    if (sepChar && fracDigits.includes(sepChar)) return str;

    const groups = [];
    for (let j = 0; j < fracDigits.length; j += groupSize) {
      groups.push(fracDigits.slice(j, j + groupSize));
    }
    return `${left}${decimalChar}${groups.join(sepChar)}${suffix}`;
  }

  function _npNormalizeLooseSeparators(raw) {
    if (raw == null) return "";
    let s = String(raw);
    s = s.replace(/[−‒–—]/g, "-");

    const isNeg = s.startsWith("-");
    const head = isNeg ? "-" : "";
    const rest = isNeg ? s.slice(1) : s;

    let r = rest.replace(/\s+/g, " ");
    r = r.replace(/-+/g, "-");

    return (head + r).trim();
  }

  function _npNormalizeDateTimeInput(raw) {
    let s = String(raw ?? "").trim();
    s = s.replace(/\s+/g, "");
    s = s.replace(/[\u2010\u2011\u2012\u2013\u2014\u2212\uFE63\uFF0D]/g, "-");
    s = s.replace(/[\u2044\u2215\uFF0F]/g, "/");
    s = s.replace(/[\uFF1A]/g, ":");
    return s;
  }

  function _npTryParseTimeParts(raw) {
    const s = String(raw ?? "").trim();
    if (!s || /\s/.test(s)) return null;

    const fields = s.split(":");
    if (fields.length < 2 || fields.length > 4) return null;

    const firstMatch = fields[0].match(/^([+-]?)(\d+)$/);
    if (!firstMatch) return null;

    const sign = firstMatch[1];
    const firstDigits = firstMatch[2];

    function isClockPair(value) {
      return /^[0-5]\d$/.test(String(value ?? ""));
    }

    function parseSeconds(value) {
      const m = String(value ?? "").match(/^([0-5]\d)(?:\.(\d{1,3}))?$/);
      if (!m) return null;
      return { ssStr: m[1], fractionStr: m[2] ?? null };
    }

    function hasAnyNonZeroDigit(...values) {
      return /[1-9]/.test(values.filter(v => v != null).join(""));
    }

    if (fields.length === 2) {
      if (sign) return null;
      if (!/^\d{1,2}$/.test(firstDigits) || !isClockPair(fields[1])) return null;
      const hh = parseInt(firstDigits, 10);
      if (!Number.isFinite(hh) || hh < 0 || hh > 59) return null;
      return {
        hasDays: false,
        negative: false,
        dayStr: null,
        hhStr: firstDigits,
        mmStr: fields[1],
        ssStr: null,
        fractionStr: null,
      };
    }

    if (fields.length === 3) {
      const finalSeconds = parseSeconds(fields[2]);
      if (finalSeconds?.fractionStr != null) {
        if (sign) return null;
        if (!/^\d{1,2}$/.test(firstDigits) || !isClockPair(fields[1])) return null;
        const hh = parseInt(firstDigits, 10);
        if (!Number.isFinite(hh) || hh < 0 || hh > 59) return null;
        return {
          hasDays: false,
          negative: false,
          dayStr: null,
          hhStr: firstDigits,
          mmStr: fields[1],
          ssStr: finalSeconds.ssStr,
          fractionStr: finalSeconds.fractionStr,
        };
      }

      if (!isClockPair(fields[1]) || !isClockPair(fields[2])) return null;
      const negative = sign === "-" && hasAnyNonZeroDigit(firstDigits, fields[1], fields[2]);
      return {
        hasDays: true,
        negative,
        dayStr: firstDigits,
        hhStr: fields[1],
        mmStr: fields[2],
        ssStr: null,
        fractionStr: null,
      };
    }

    if (!isClockPair(fields[1]) || !isClockPair(fields[2])) return null;
    const seconds = parseSeconds(fields[3]);
    if (!seconds) return null;

    const negative = sign === "-" && hasAnyNonZeroDigit(
      firstDigits,
      fields[1],
      fields[2],
      seconds.ssStr,
      seconds.fractionStr
    );

    return {
      hasDays: true,
      negative,
      dayStr: firstDigits,
      hhStr: fields[1],
      mmStr: fields[2],
      ssStr: seconds.ssStr,
      fractionStr: seconds.fractionStr,
    };
  }

  function _npEncodeDigitsOnly(digits, opts = {}) {
    const s = String(digits ?? "");
    if (!/^\d+$/.test(s)) throw new Error(`Expected only digits, got "${digits}"`);
    let out = "";
    for (const ch of s) {
      const tok = _npDecimalDigitToNanpaToken(ch, opts);
      if (!tok) throw new Error(`Unsupported digit "${ch}"`);
      out += tok;
    }
    return out;
  }

  function _npTryParseDateParts(raw) {
    const s = _npNormalizeDateTimeInput(raw);
    const m = s.match(/^(\d{4})([\/-])(\d{2})\2(\d{2})$/);
    if (!m) return null;

    const yyyyStr = m[1];
    const mmStr = m[3];
    const ddStr = m[4];

    const mm = parseInt(mmStr, 10);
    const dd = parseInt(ddStr, 10);

    if (!(mm >= 1 && mm <= 12)) return null;
    if (!(dd >= 1 && dd <= 31)) return null;

    return { yyyyStr, mmStr, ddStr };
  }

  function _npDateStrToNanpaCaps(raw, opts = {}) {
    const parts = _npTryParseDateParts(raw);
    if (!parts) return null;

    let caps = "NE";
    caps += _npEncodeDigitsOnly(parts.yyyyStr, opts);
    caps += "NEKE";
    caps += _npEncodeDigitsOnly(parts.mmStr, opts);
    caps += "NEKE";
    caps += _npEncodeDigitsOnly(parts.ddStr, opts);
    caps += "N";

    _npTokenizeNanpaCaps(caps, opts);
    return caps;
  }

  function _npTimeStrToNanpaCaps(raw, opts = {}) {
    const parts = _npTryParseTimeParts(raw);
    if (!parts) return null;

    let caps = "NE";
    if (parts.negative) caps += "NO";

    if (parts.hasDays) {
      caps += _npEncodeDigitsOnly(parts.dayStr, opts);
      caps += "NEKE";
    }

    caps += _npEncodeDigitsOnly(parts.hhStr, opts);
    caps += "NEKE";
    caps += _npEncodeDigitsOnly(parts.mmStr, opts);

    if (parts.ssStr != null) {
      caps += "NEKE";
      caps += _npEncodeDigitsOnly(parts.ssStr, opts);
      if (parts.fractionStr != null) {
        caps += "NO";
        caps += "NE";
        caps += _npEncodeDigitsOnly(parts.fractionStr, opts);
      }
    }

    caps += "N";
    _npTokenizeNanpaCaps(caps, opts);
    return caps;
  }

  function _npNanpaCapsLooksLikeTime(caps, opts = {}) {
    return _npNanpaCapsDecodeTimeStrict(caps, opts) != null;
  }

  function _npNanpaCapsDecodeTimeStrict(caps, opts = {}) {
    let tokens;
    try { tokens = _npTokenizeNanpaCaps(String(caps).trim().toUpperCase(), opts); }
    catch { return null; }

    if (!tokens || tokens.length < 2) return null;
    if (tokens[0] !== "NE") return null;
    if (tokens[tokens.length - 1] !== "N") return null;

    const finalIndex = tokens.length - 1;
    let i = 1;
    let negativeInput = false;

    if (tokens[i] === "NO") {
      negativeInput = true;
      i += 1;
    }

    const segments = [];
    while (i < finalIndex) {
      let integerStr = "";
      while (i < finalIndex && _NP_DIGIT_TOKENS.has(tokens[i])) {
        const ch = _NP_TOKEN_TO_DIGIT_CHAR[tokens[i]];
        if (ch == null) return null;
        integerStr += ch;
        i += 1;
      }
      if (!integerStr) return null;

      let fractionStr = null;
      if (tokens[i] === "NO" && tokens[i + 1] === "NE") {
        i += 2;
        fractionStr = "";
        while (i < finalIndex && _NP_DIGIT_TOKENS.has(tokens[i])) {
          const ch = _NP_TOKEN_TO_DIGIT_CHAR[tokens[i]];
          if (ch == null) return null;
          fractionStr += ch;
          i += 1;
        }
        if (fractionStr.length < 1 || fractionStr.length > 3) return null;
      }

      segments.push({ integerStr, fractionStr });

      if (i === finalIndex) break;
      if (tokens[i] !== "NE" || tokens[i + 1] !== "KE") return null;
      i += 2;
    }

    if (i !== finalIndex) return null;
    if (segments.length < 2 || segments.length > 4) return null;
    if (segments.slice(0, -1).some(seg => seg.fractionStr != null)) return null;

    function isPairInRange(seg) {
      return !!seg && seg.fractionStr == null && /^[0-5]\d$/.test(seg.integerStr);
    }

    function isSecondsInRange(seg) {
      return !!seg && /^[0-5]\d$/.test(seg.integerStr) &&
        (seg.fractionStr == null || /^\d{1,3}$/.test(seg.fractionStr));
    }

    function normalizedNegative(daySeg, otherSegs) {
      const allDigits = [daySeg.integerStr, ...otherSegs.map(seg => seg.integerStr),
        ...otherSegs.map(seg => seg.fractionStr || "")].join("");
      const isZero = !/[1-9]/.test(allDigits);
      return { negative: negativeInput && !isZero, isZero };
    }

    if (segments.length === 2) {
      if (negativeInput) return null;
      const [hourSeg, minuteSeg] = segments;
      if (hourSeg.fractionStr != null || !/^\d{1,2}$/.test(hourSeg.integerStr)) return null;
      const hh = parseInt(hourSeg.integerStr, 10);
      if (!(hh >= 0 && hh <= 59) || !isPairInRange(minuteSeg)) return null;
      return {
        hasDays: false,
        negativeInput: false,
        negative: false,
        isZero: hh === 0 && minuteSeg.integerStr === "00",
        dayStr: null,
        hhStr: hourSeg.integerStr,
        mmStr: minuteSeg.integerStr,
        ssStr: null,
        fractionStr: null,
      };
    }

    if (segments.length === 3 && segments[2].fractionStr != null) {
      if (negativeInput) return null;
      const [hourSeg, minuteSeg, secondSeg] = segments;
      if (hourSeg.fractionStr != null || !/^\d{1,2}$/.test(hourSeg.integerStr)) return null;
      const hh = parseInt(hourSeg.integerStr, 10);
      if (!(hh >= 0 && hh <= 59) || !isPairInRange(minuteSeg) || !isSecondsInRange(secondSeg)) return null;
      return {
        hasDays: false,
        negativeInput: false,
        negative: false,
        isZero: !/[1-9]/.test(hourSeg.integerStr + minuteSeg.integerStr + secondSeg.integerStr + secondSeg.fractionStr),
        dayStr: null,
        hhStr: hourSeg.integerStr,
        mmStr: minuteSeg.integerStr,
        ssStr: secondSeg.integerStr,
        fractionStr: secondSeg.fractionStr,
      };
    }

    if (segments.length === 3) {
      const [daySeg, hourSeg, minuteSeg] = segments;
      if (daySeg.fractionStr != null || !/^\d+$/.test(daySeg.integerStr)) return null;
      if (!isPairInRange(hourSeg) || !isPairInRange(minuteSeg)) return null;
      const signState = normalizedNegative(daySeg, [hourSeg, minuteSeg]);
      return {
        hasDays: true,
        negativeInput,
        negative: signState.negative,
        isZero: signState.isZero,
        dayStr: daySeg.integerStr,
        hhStr: hourSeg.integerStr,
        mmStr: minuteSeg.integerStr,
        ssStr: null,
        fractionStr: null,
      };
    }

    const [daySeg, hourSeg, minuteSeg, secondSeg] = segments;
    if (daySeg.fractionStr != null || !/^\d+$/.test(daySeg.integerStr)) return null;
    if (!isPairInRange(hourSeg) || !isPairInRange(minuteSeg) || !isSecondsInRange(secondSeg)) return null;
    const signState = normalizedNegative(daySeg, [hourSeg, minuteSeg, secondSeg]);
    return {
      hasDays: true,
      negativeInput,
      negative: signState.negative,
      isZero: signState.isZero,
      dayStr: daySeg.integerStr,
      hhStr: hourSeg.integerStr,
      mmStr: minuteSeg.integerStr,
      ssStr: secondSeg.integerStr,
      fractionStr: secondSeg.fractionStr,
    };
  }

  function _npNormalizeTimeNegativeZeroCaps(caps, opts = {}) {
    const decoded = _npNanpaCapsDecodeTimeStrict(caps, opts);
    if (!decoded || !decoded.negativeInput || !decoded.isZero) return caps;

    let tokens;
    try { tokens = _npTokenizeNanpaCaps(String(caps).trim().toUpperCase(), opts); }
    catch { return caps; }
    if (tokens[0] === "NE" && tokens[1] === "NO") tokens.splice(1, 1);
    return tokens.join("");
  }

  function _npNanpaCapsIsValidTime(caps, opts = {}) {
    return _npNanpaCapsDecodeTimeStrict(caps, opts) != null;
  }

  function _npNanpaCapsDecodeDateStrict(caps, opts = {}) {
    let tokens;
    try { tokens = _npTokenizeNanpaCaps(String(caps).trim().toUpperCase(), opts); }
    catch { return null; }

    if (tokens[0] !== "NE") return null;
    if (tokens[tokens.length - 1] !== "N") return null;

    let i = 1;

    function readDigit() {
      const t = tokens[i];
      const ch = _NP_TOKEN_TO_DIGIT_CHAR[t];
      if (ch == null) return null;
      i += 1;
      return ch;
    }

    const y1 = readDigit(); if (y1 == null) return null;
    const y2 = readDigit(); if (y2 == null) return null;
    const y3 = readDigit(); if (y3 == null) return null;
    const y4 = readDigit(); if (y4 == null) return null;

    if (tokens[i] !== "NE") return null; i++;
    if (tokens[i] !== "KE") return null; i++;

    const m1 = readDigit(); if (m1 == null) return null;
    const m2 = readDigit(); if (m2 == null) return null;
    const mmStr = m1 + m2;

    if (tokens[i] !== "NE") return null; i++;
    if (tokens[i] !== "KE") return null; i++;

    const d1 = readDigit(); if (d1 == null) return null;
    const d2 = readDigit(); if (d2 == null) return null;
    const ddStr = d1 + d2;

    if (i !== tokens.length - 1) return null;

    const mm = parseInt(mmStr, 10);
    const dd = parseInt(ddStr, 10);

    if (!(mm >= 1 && mm <= 12)) return null;
    if (!(dd >= 1 && dd <= 31)) return null;

    return { mm, dd };
  }

  function _npNanpaCapsIsValidDate(caps, opts = {}) {
    return _npNanpaCapsDecodeDateStrict(caps, opts) != null;
  }

  function _npNanpaCapsIsValidTimeOrDate(caps, opts = {}) {
    // Keep the public parser's precedence identical to the renderer core.
    return _npNanpaCapsIsValidDate(caps, opts) || _npNanpaCapsIsValidTime(caps, opts);
  }

  function _npNumberStrToNanpaCaps(s, opts = {}) {
    const {
      thousandsChar = ",",
      groupFractionTriplets = true,
      fractionGroupSize = 3,
      mixedStyle = "short"
    } = opts || {};

    if (s == null) throw new Error("s must be a string");
    let raw = _npNormalizeLooseSeparators(String(s));
    if (!raw) throw new Error("Empty value cannot be encoded");

    if (groupFractionTriplets) {
      raw = _npGroupFractionDigitsOnly(raw, ".", fractionGroupSize, "_");
    }

    let hasLeadingPlus = false;
    if (raw.startsWith("+")) {
      hasLeadingPlus = true;
      raw = raw.slice(1).trim();
      if (!raw) throw new Error("Missing numeric part after leading '+' sign");
    }

    function stripFinalTerminator(segCaps) {
      if (!segCaps) return segCaps;
      if (!segCaps.endsWith("N")) throw new Error(`Segment caps did not end with 'N': ${segCaps}`);
      return segCaps.slice(0, -1);
    }

    function encodeSingleNumberSegment(segment, includeInitialNe, includeLeadingPlus = false) {
      let seg = String(segment).trim();
      if (seg === "") throw new Error(`Empty numeric segment in ${s}`);

      if (seg.slice(0, 1).toUpperCase() === "N") {
        seg = seg.slice(1).trim();
        if (seg === "") throw new Error(`Missing numeric part after leading 'N' prefix in ${s}`);
      }

      const out = [];
      if (includeInitialNe) out.push("NE");
      if (includeInitialNe && includeLeadingPlus) out.push("NS");

      function pushNene() {
        const L = out.length;
        if (L >= 2 && out[L-2] === "NE" && out[L-1] === "NE") return;
        out.push("NE", "NE");
      }

      if (seg.startsWith("-")) {
        if (seg.startsWith("-.")) seg = "-0." + seg.slice(2);
        out.push("NO");
        seg = seg.slice(1).trim();
      }

      let magnitudeSuffixKeCount = 0;
      if (seg.length > 0) {
        const last = seg.slice(-1).toUpperCase();
        if (last === "K" || last === "T" || last === "M" || last === "B") {
          magnitudeSuffixKeCount =
            (last === "K") ? 1 :
            (last === "M") ? 2 :
            (last === "B") ? 3 : 4; // T/t = trillion = four base-1000 boundaries
          seg = seg.slice(0, -1).trim();
          if (!seg) throw new Error(`Missing numeric part before magnitude suffix ${last} in ${s}`);
        }
      }

      if ((seg.match(/\./g) || []).length > 1) {
        throw new Error(`Invalid numeric segment with multiple decimals: ${segment}`);
      }

      let intPart = seg;
      let fracPart = "";
      let hasDecimal = false;
      if (seg.includes(".")) {
        [intPart, fracPart] = seg.split(".", 2);
        hasDecimal = true;
      }

      let ip = String(intPart ?? "").trim();
      if (ip === "") ip = "0";

      const hasLooseSep = /[ -]/.test(ip);

      if (hasLooseSep) {
        let ip2 = String(ip)
          .replace(/\s+/g, " ")
          .replace(/-+/g, "-")
          .trim();

        ip2 = ip2.replace(/^[ -]+/, "").replace(/[ -]+$/, "");
        if (ip2 === "") ip2 = "0";

        for (const ch of ip2) {
          if (/\d/.test(ch)) { out.push(_npDecimalDigitToNanpaToken(ch, opts)); continue; }
          if (ch === " " || ch === "-") { pushNene(); continue; }
          if (thousandsChar && ch === thousandsChar) { out.push("NE","KE"); continue; }
          throw new Error(`Unsupported character "${ch}" in integer part of "${s}"`);
        }
      } else {
        const groups = thousandsChar ? ip.split(thousandsChar) : [ip];
        for (const g of groups) {
          if (g === "" || !/^\d+$/.test(g)) throw new Error(`Invalid integer group "${g}" in "${s}"`);
        }

        let trailingZeroGroups = 0;
        for (let k = groups.length - 1; k >= 1; k--) {
          const g = groups[k];
          if (g.length === 3 && g === "000") trailingZeroGroups += 1;
          else break;
        }

        for (const d of groups[0]) out.push(_npDecimalDigitToNanpaToken(d, opts));

        const nGroups = groups.length;
        const lastNonTrailingIdx = nGroups - trailingZeroGroups;

        for (let idx = 1; idx < lastNonTrailingIdx; idx++) {
          out.push("NE","KE");
          for (const d of groups[idx]) out.push(_npDecimalDigitToNanpaToken(d, opts));
        }

        if (trailingZeroGroups > 0) {
          out.push("NE");
          // Preserve the complete base-1000 magnitude as one uninterrupted
          // KE run. The tokenizer and renderer consume arbitrarily long runs
          // as repeated KE-family tokens; no artificial NE boundary is needed.
          out.push("KE".repeat(trailingZeroGroups));
        }
      }

      if (hasDecimal) {
        out.push("NO","NE");

        if (!fracPart) throw new Error(`Missing fraction digits after '.' in "${s}"`);

        for (const ch of fracPart) {
          if (/\d/.test(ch)) { out.push(_npDecimalDigitToNanpaToken(ch, opts)); continue; }
          if (ch === "_") { pushNene(); continue; }
          if (ch === ",") { pushNene(); continue; }
          if (ch === " " || ch === "-") { pushNene(); continue; }
          throw new Error(`Unsupported character "${ch}" in fraction part of "${s}"`);
        }
      }

      if (magnitudeSuffixKeCount > 0) {
        out.push("NE");
        // Keep all KE pairs consecutive, including T/t (four KE) and
        // future magnitudes longer than the currently named suffixes.
        out.push("KE".repeat(magnitudeSuffixKeCount));
      }

      out.push("N");
      return out.join("");
    }

    if (raw.includes("+")) {
      const [left, right] = raw.split("+", 2);
      let leftCaps = encodeSingleNumberSegment(left, true, hasLeadingPlus);

      if (!right.includes("/")) throw new Error(`Mixed number must contain '/' after '+': ${s}`);
      const [num, den] = right.split("/", 2);

      let numCaps = encodeSingleNumberSegment(num, false);
      let denCaps = encodeSingleNumberSegment(den, false);

      leftCaps = stripFinalTerminator(leftCaps);
      numCaps = stripFinalTerminator(numCaps);

      const mixedSep = (mixedStyle === "short") ? "NOKO" : "NONONO";
      return leftCaps + mixedSep + numCaps + "NONO" + denCaps;
    }

    if (raw.includes("/")) {
      const [num, den] = raw.split("/", 2);
      let numCaps = encodeSingleNumberSegment(num, true, hasLeadingPlus);
      let denCaps = encodeSingleNumberSegment(den, false);
      numCaps = stripFinalTerminator(numCaps);
      return numCaps + "NONO" + denCaps;
    }

    return encodeSingleNumberSegment(raw, true, hasLeadingPlus);
  }

  function _npTryParseScientificDecimalToCaps(rawValue, opts = {}) {
    let raw = String(rawValue ?? "").trim();
    if (!raw) return null;
    raw = raw.replace(/[−‒–—]/g, "-");

    const mantissaPattern = String.raw`([+-]?(?:(?:\d[\d, _-]*)(?:\.\d[\d, _-]*)?|(?:\.\d[\d, _-]*)))`;
    const eRe = new RegExp(String.raw`^\s*${mantissaPattern}\s*[eE]\s*([+-]?\d+)\s*$`);
    const powWithCaretRe = new RegExp(String.raw`^\s*${mantissaPattern}\s*\*\s*10\s*\^\s*([+-]?\d+)\s*$`);
    const powSignedNoCaretRe = new RegExp(String.raw`^\s*${mantissaPattern}\s*\*\s*10\s*([+-]\d+)\s*$`);

    const m = raw.match(eRe) || raw.match(powWithCaretRe) || raw.match(powSignedNoCaretRe);
    if (!m) return null;

    let mantissa = String(m[1] ?? "").trim();
    let exponent = String(m[2] ?? "").trim();
    if (!mantissa || !exponent) return null;
    if (exponent.startsWith("+")) exponent = exponent.slice(1).trim();
    if (!/^-?\d+$/.test(exponent)) return null;

    const mantissaCaps = _npNumberStrToNanpaCaps(mantissa, opts);
    const exponentCaps = _npNumberStrToNanpaCaps(exponent, { ...opts, groupFractionTriplets: false });
    if (!mantissaCaps.endsWith("N") || !exponentCaps.startsWith("NE") || !exponentCaps.endsWith("N")) return null;

    const mantissaCore = mantissaCaps.slice(0, -1);
    const exponentCore = exponentCaps.slice(2, -1);
    if (!mantissaCore || !exponentCore) return null;

    const caps = mantissaCore + "NEKO" + exponentCore + "N";
    _npTokenizeNanpaCaps(caps, opts);
    return caps;
  }

  function _npDecimalStringToCaps(rawDecimal, opts = {}) {
    let raw = String(rawDecimal ?? "").trim();
    let percent = false;

    if (/%$/.test(raw)) {
      percent = true;
      raw = raw.replace(/\s*%\s*$/g, "").trim();
    }

    const normalized = _npNormalizeVulgarFractionInput(raw);
    const scientificCaps = _npTryParseScientificDecimalToCaps(normalized, opts);

    const baseCaps = scientificCaps
      ? scientificCaps
      : _npLooksLikeNanpaCaps(normalized)
        ? normalized.toUpperCase()
        : _npNumberStrToNanpaCaps(normalized, opts);

    const caps = percent
      ? (baseCaps.slice(0, -1) + "OKN")
      : baseCaps;

    _npTokenizeNanpaCaps(caps, opts);
    return caps;
  }

  function _npCodepointsToWords(codepoints) {
    const rev = _npUcsurCpToWord();
    return Array.from(codepoints ?? [])
      .map(cp => rev.get(cp))
      .filter(Boolean);
  }

  function _npWrapCartouche(codepoints) {
    const cps = Array.from(codepoints ?? []);
    return [_NP_CARTOUCHE_START_CP, ...cps, _NP_CARTOUCHE_END_CP];
  }

  function _npParseNumber(input, opts = {}) {
    const mode = (opts.numericMode === "traditional") ? "traditional" : "uniform";
    const s = String(input ?? "").trim();
    if (!s) return null;

    try {
      let caps = null;

      const parsedCode = _npTryParseNanpaLinjanNumberCodeToCaps(s);
      if (parsedCode?.caps) {
        caps = parsedCode.caps;
      } else if (_npIsValidNanpaLinjanProperName(s, opts)) {
        caps = _npProperNameToCaps(s, opts);
        if (!caps) return null;
      } else {
        const dateCaps = _npDateStrToNanpaCaps(s, opts);
        if (dateCaps) {
          caps = dateCaps;
        } else {
          const timeCaps = _npTimeStrToNanpaCaps(s, opts);
          if (timeCaps) caps = timeCaps;
          else caps = _npDecimalStringToCaps(s, {
            thousandsChar: ",",
            groupFractionTriplets: true,
            fractionGroupSize: 3,
            ...opts,
            mixedStyle: opts.mixedStyle === "long" ? "long" : "short"
          });
        }
      }

      if (!caps) return null;
      caps = _npCanonicalizeScientificCaps(caps);
      if (_npNanpaCapsIsValidTime(caps, opts)) caps = _npNormalizeTimeNegativeZeroCaps(caps, opts);

      const isTime = _npNanpaCapsIsValidTimeOrDate(caps);
      const innerCodepoints = _npNanpaCapsToNanpaLinjanCodepoints(caps, { mode, isTime, relaxedParsing: _npRelaxedParsingFromOpts(opts), relaxedRendering: _npRelaxedRenderingFromOpts(opts), nanpaColonRendering: _npNanpaColonRenderingFromOpts(opts) });
      if (!innerCodepoints || !innerCodepoints.length) return null;

      const codepoints = _npWrapCartouche(innerCodepoints);
      const words = _npCodepointsToWords(innerCodepoints);

      return {
        input: s,
        caps,
        codepoints,
        innerCodepoints,
        words,
        numericMode: mode,
        isTimeLike: !!isTime
      };
    } catch {
      return null;
    }
  }

  const _NP_ABBREVIATED_NANPA_WORD_TO_CODE = Object.freeze({
    ijo: "I", wan: "W", tu: "T", seli: "S", awen: "A",
    luka: "L", utala: "U", mun: "M", pipi: "P", jo: "J"
  });

  function _npTokenizeNanpaColonCartoucheSource(raw) {
    const source = String(raw ?? "").trim();
    if (!source.startsWith("[") || !source.endsWith("]")) return null;
    const inner = source.slice(1, -1);
    const tokens = [];
    let i = 0;
    while (i < inner.length) {
      if (/\s/.test(inner[i])) { i += 1; continue; }
      if (inner[i] === ":") { tokens.push(":"); i += 1; continue; }
      if (/[A-Za-z]/.test(inner[i])) {
        const start = i;
        while (i < inner.length && /[A-Za-z]/.test(inner[i])) i += 1;
        tokens.push(inner.slice(start, i).toLowerCase());
        continue;
      }
      return null;
    }
    return tokens;
  }

  function _npTryParseNanpaColonCartoucheToCaps(raw, opts = {}) {
    if (!_npNanpaColonParsingFromOpts(opts)) return null;
    const tokens = _npTokenizeNanpaColonCartoucheSource(raw);
    if (!tokens || tokens.length < 4 || tokens[0] !== "nanpa" || tokens[1] !== ":" ||
        tokens[tokens.length - 1] !== "nanpa") return null;
    const body = tokens.slice(2, -1);
    if (!body.length || body.includes("nanpa") || body.includes("nasin")) return null;

    const tryAbbreviated = () => {
      let index = 0;
      let positive = false;
      if (body[0] === "en") { positive = true; index = 1; }
      let code = "";
      let hasDigit = false;
      for (; index < body.length; index++) {
        const word = body[index];
        const digit = _NP_ABBREVIATED_NANPA_WORD_TO_CODE[word];
        if (digit) { code += digit; hasDigit = true; continue; }
        if (word === "o" || word === "ona") { code += "O"; continue; }
        if (word === "kulupu" || word === "kasi" || word === "kolon" || word === ":") { code += "K"; continue; }
        if (word === "kala") { code += "EKO"; continue; }
        if (word === "kin") { code += "OKO"; continue; }
        if (word === "kipisi" && index === body.length - 1) { code += "OK"; continue; }
        return null;
      }
      if (!hasDigit || !code) return null;
      try { return _npTryParseNanpaLinjanNumberCodeToCaps(`#~${positive ? "+" : ""}${code}`)?.caps || null; }
      catch { return null; }
    };

    const tryFull = () => {
      if (!body.every(word => Object.prototype.hasOwnProperty.call(_NP_NANPA_LINJA_N_WORD_TO_CP, word))) return null;
      const letters = body.map(word => word === ":" ? "K" : word[0]).join("").toUpperCase();
      let caps = "NE" + letters + "N";
      if (body[0] === "nena" && body[1] === "en" && caps.startsWith("NENE")) caps = "NENS" + caps.slice(4);
      if (caps.endsWith("NOKEN")) caps = caps.slice(0, -5) + "OKN";
      try {
        const parsedTokens = _npTokenizeNanpaCaps(caps, opts);
        return _npNanpaCapsHasAtLeastOneDigitToken(parsedTokens) ? caps : null;
      } catch { return null; }
    };

    const preferAbbreviated = opts.abbreviateNumericCartouches === true ||
      opts.numericCartoucheAbbreviation === true || opts.abbreviatedNumericCartouches === true;
    return preferAbbreviated ? (tryAbbreviated() || tryFull()) : (tryFull() || tryAbbreviated());
  }

  function _npNanpaColonProperNameFromLegacy(rawLegacyName) {
    let body = String(rawLegacyName ?? "").trim().toLowerCase();
    if (!body) return "";
    if (body.startsWith("ne")) body = body.slice(2).trimStart();
    else if (body.startsWith("n ene")) body = body.slice(2).trimStart();
    const words = body.split(/\s+/).filter(Boolean);
    if ((words[0] === "no" || words[0] === "ne") && words.length > 1) {
      words[0] += words[1];
      words.splice(1, 1);
    }
    const titled = words.map(word => word ? word[0].toUpperCase() + word.slice(1) : "").filter(Boolean);
    return titled.length ? `Nanpa ${titled.join(" ")}` : "";
  }

  const NanpaParser = Object.freeze({
  parseNumber(input, opts = {}) {
    const mode = ((opts.mode === "traditional") || (opts.numericMode === "traditional"))
      ? "traditional"
      : "uniform";
    const mixedStyle = (opts.mixedStyle === "long") ? "long" : "short";
    const relaxedParsing = _npRelaxedParsingFromOpts(opts);
    const relaxedRendering = _npRelaxedRenderingFromOpts(opts);

    if (input == null || String(input).trim() === "") return null;
    const s = String(input).trim();

    if (opts.enableBinaryParsing === true || opts.enableBinaryRendering === true) {
      const binarySemantic = parseCompleteBinaryInput(s, {
        relaxedParsing,
        preferAbbreviated: opts.abbreviateNumericCartouches === true ||
          opts.numericCartoucheAbbreviation === true ||
          opts.abbreviatedNumericCartouches === true
      });
      if (binarySemantic) {
        const tpWords = binarySemanticToTpWords(binarySemantic, { abbreviated: false, mode, relaxedRendering });
        const abbreviatedWords = binarySemanticToTpWords(binarySemantic, { abbreviated: true, mode, relaxedRendering });
        const ucsurCodepoints = tpWords ? binaryTpWordsToCodepoints(tpWords) : null;
        const abbreviatedUcsurCodepoints = abbreviatedWords ? binaryTpWordsToCodepoints(abbreviatedWords) : null;
        if (!ucsurCodepoints || !ucsurCodepoints.length) return null;
        const properName = binarySemanticToProperName(binarySemantic, { relaxedRendering });
        const prefix = binarySemanticToCanonicalPrefix(binarySemantic);
        const codepoints = [_NP_CARTOUCHE_START_CP, ...ucsurCodepoints, _NP_CARTOUCHE_END_CP];
        return {
          input: s, kind: "binary", numberBase: 2, isBinary: true, caps: null, properName, uniqueCode: prefix, displayValue: prefix,
          binaryDigits: binarySemantic.digits, binaryParts: binarySemantic.parts.map(part => ({ ...part })),
          ucsurCodepoints, abbreviatedUcsurCodepoints: abbreviatedUcsurCodepoints || [],
          hexCodepoints: ucsurCodepoints.map(cp => cp.toString(16).toUpperCase().padStart(4, "0")).join(" "),
          hexWithCartouche: codepoints.map(cp => cp.toString(16).toUpperCase().padStart(4, "0")).join(" "),
          tpWords, abbreviatedWords: abbreviatedWords || [], words: tpWords.slice(), isTime: false, isDate: false, isTimeLike: false,
          innerCodepoints: ucsurCodepoints.slice(), codepoints, numericMode: mode
        };
      }
    }

    if (opts.enableHexParsing === true) {
      const hexSemantic = parseCompleteHexInput(s, {
        relaxedParsing,
        preferAbbreviated: opts.abbreviateNumericCartouches === true ||
          opts.numericCartoucheAbbreviation === true ||
          opts.abbreviatedNumericCartouches === true
      });
      if (hexSemantic) {
        const tpWords = hexSemanticToTpWords(hexSemantic, {
          abbreviated: false,
          mode,
          relaxedRendering
        });
        const abbreviatedWords = hexSemanticToTpWords(hexSemantic, {
          abbreviated: true,
          mode,
          relaxedRendering
        });
        const ucsurCodepoints = tpWords ? hexTpWordsToCodepoints(tpWords) : null;
        const abbreviatedUcsurCodepoints = abbreviatedWords ? hexTpWordsToCodepoints(abbreviatedWords) : null;
        if (!ucsurCodepoints || !ucsurCodepoints.length) return null;
        const properName = hexSemanticToProperName(hexSemantic, { relaxedRendering });
        const hash = hexSemanticToCanonicalHash(hexSemantic);
        const codepoints = [_NP_CARTOUCHE_START_CP, ...ucsurCodepoints, _NP_CARTOUCHE_END_CP];
        return {
          input: s,
          kind: "hex",
          numberBase: 16,
          isHex: true,
          caps: null,
          properName,
          uniqueCode: hash,
          displayValue: hash,
          hexDigits: hexSemantic.digits,
          hexParts: hexSemantic.parts.map(part => ({ ...part })),
          ucsurCodepoints,
          abbreviatedUcsurCodepoints: abbreviatedUcsurCodepoints || [],
          hexCodepoints: ucsurCodepoints.map(cp => cp.toString(16).toUpperCase().padStart(4, "0")).join(" "),
          hexWithCartouche: codepoints.map(cp => cp.toString(16).toUpperCase().padStart(4, "0")).join(" "),
          tpWords,
          abbreviatedWords: abbreviatedWords || [],
          words: tpWords.slice(),
          isTime: false,
          isDate: false,
          isTimeLike: false,
          innerCodepoints: ucsurCodepoints.slice(),
          codepoints,
          numericMode: mode
        };
      }
    }

    function splitCapsLetters(caps) {
      if (caps == null) throw new Error("caps must be a string");
      const s0 = String(caps).trim().toUpperCase();
      if (!s0) return "";
      if (s0.length < 3 || !s0.startsWith("NE") || !s0.endsWith("N")) {
        throw new Error(`Not a valid nanpa-caps label: "${caps}"`);
      }

      const hasOkSuffix = s0.length >= 3 && s0.slice(-3, -1) === "OK";
      const mainS = hasOkSuffix ? (s0.slice(0, -3) + "N") : s0;

      let outStr = "";
      let i = 0;
      const end = mainS.length - 1;

      if (end % 2 !== 0) throw new Error(`Malformed caps (odd pair area) in "${caps}"`);

      while (i < end) {
        if (i + 2 > end) throw new Error(`Malformed caps at position ${i} in "${caps}"`);
        const pair = mainS.slice(i, i + 2);
        const nextPair = (i + 4 <= end) ? mainS.slice(i + 2, i + 4) : null;

        if (pair === "NE" && nextPair === "NO" && i === 0) { outStr += "neno "; i += 4; continue; }
        if (pair === "NE" && nextPair === "NS" && i === 0) { outStr += "nene "; i += 4; continue; }
        if (pair === "NE" && nextPair === "NE") { outStr += "n "; outStr += "ene "; i += 4; continue; }
        if (pair === "NO" && nextPair === "NE" && i > 0) { outStr += "n "; outStr += "one "; i += 4; continue; }

        if (pair === "NO" && nextPair === "KO" && i > 0) {
          outStr += "n ";
          outStr += "oko";
          if ((i + 4) < end) outStr += " ";
          i += 4; continue;
        }

        if (pair === "NE" && nextPair === "KO" && i > 0) {
          outStr += "n ";
          outStr += "eko";
          if ((i + 4) < end) outStr += " ";
          i += 4; continue;
        }

        if (pair === "NO" && nextPair === "NO" && i > 0) {
          outStr += "n ";
          outStr += "o";
          let countNo = 1; let j = i;
          while ((j + 6) <= end && mainS.slice(j + 4, j + 6) === "NO") { countNo++; j += 2; }
          outStr += "no".repeat(countNo);
          if ((i + 2 * countNo) < end) outStr += " ";
          i += 2 + 2 * countNo; continue;
        }

        if (pair === "NE" && nextPair === "KE") {
          outStr += "n ";
          let countKe = 1; let j = i;
          while ((j + 6) <= end && mainS.slice(j + 4, j + 6) === "KE") { countKe++; j += 2; }
          outStr += _npMagnitudeKeProperNameFragment(countKe);
          if ((i + 2 * countKe) < end) outStr += " ";
          i += 2 + 2 * countKe; continue;
        }

        if (pair === "OK") {
          if (i > 0 && !/\s$/.test(outStr)) outStr += " ";
          if (i > 0) outStr += "n ";
          outStr += "oke";
        } else {
          outStr += pair.toLowerCase();
        }
        i += 2;
      }

      outStr = outStr.replace(/\s+n(?=\s|$)/g, "n").trim();
      outStr += "n";

      if (hasOkSuffix) outStr += " oken";

      return outStr;
    }

    function titleCaseCapsLabel(str) {
      return String(str ?? "").trim().split(/\s+/).filter(Boolean)
        .map(w => w.length === 1 ? w.toUpperCase() : (w[0].toUpperCase() + w.slice(1)))
        .join(" ");
    }

    function latinNameToUniqueCode(latinName) {
      const s = String(latinName ?? "");
      const noSpaces = s.replace(/\s+/g, "");
      const withoutNE = noSpaces.replace(/[nNeE]/g, "");
      const up = withoutNE.toUpperCase();
      const styled = up.replace(/O/g, "o").replace(/K/g, "k");
      return "#~" + styled;
    }

    function capsToCanonicalUniqueCode(caps, opts = {}) {
      const canonicalCaps = _npCanonicalizeScientificCaps(caps);
      let tokens;
      try { tokens = _npTokenizeNanpaCaps(canonicalCaps, opts); }
      catch { return latinNameToUniqueCode(titleCaseCapsLabel(_npSplitFinalHundredIninWords(splitCapsLetters(canonicalCaps), opts))); }

      const parts = [];
      for (let i = 0; i < tokens.length; i++) {
        const t = tokens[i];
        if (t === "NE") {
          if (i === 0 && tokens[i + 1] === "NS") {
            parts.push("e");
            i += 1;
            continue;
          }
          let j = i;
          while (j < tokens.length && tokens[j] === "NE") j++;
          const count = j - i;
          const nextToken = tokens[j];

          // Pair every available NE as one no-value spacer. When an odd NE
          // remains immediately before KO, that final NE+KO is scientific EKO.
          const spacerCount = Math.floor(count / 2);
          if (spacerCount > 0) parts.push("ee".repeat(spacerCount));

          if ((count % 2) === 1 && nextToken === "KO") {
            parts.push("eko");
            i = j; // consume the KO as part of EKO
          } else {
            i = j - 1; // leave the following non-NE token for the main loop
          }
          continue;
        }
        if (t === "N") continue;
        if (_NP_TOKEN_TO_NUMBER_CODE_LETTER[t]) {
          parts.push(_NP_TOKEN_TO_NUMBER_CODE_LETTER[t]);
          continue;
        }
        if (t === "NO") { parts.push("o"); continue; }
        if (t === "NONO") { parts.push("oo"); continue; }
        if (t === "NONONO") { parts.push("ooo"); continue; }
        if (t === "NOKO") { parts.push("oko"); continue; }
        if (t === "KO") { parts.push("ko"); continue; }
        if (t === "KE") { parts.push("k"); continue; }
        if (t === "KEKE") { parts.push("kk"); continue; }
        if (t === "KEKEKE") { parts.push("kkk"); continue; }
        if (t === "OK") { parts.push("ok"); continue; }
      }
      return "#~" + parts.join("");
    }

    function codepointsToHexString(codepoints) {
      return Array.from(codepoints ?? [])
        .map(cp => cp.toString(16).toUpperCase().padStart(4, "0"))
        .join(" ");
    }

    function withCartoucheMarkers(codepoints) {
      return [_NP_CARTOUCHE_START_CP, ...Array.from(codepoints ?? []), _NP_CARTOUCHE_END_CP];
    }

    function decodeSegmentTokensToString(segmentTokens, decodeOpts = {}) {
      if (!segmentTokens) return null;
      const intEneSep    = decodeOpts.intEneSep    != null ? String(decodeOpts.intEneSep)    : ",";
      const intGroupSep  = decodeOpts.intGroupSep  != null ? String(decodeOpts.intGroupSep)  : ",";
      const fracEneSep   = decodeOpts.fracEneSep   != null ? String(decodeOpts.fracEneSep)   : "_";
      const fracGroupSep = decodeOpts.fracGroupSep != null ? String(decodeOpts.fracGroupSep) : "_";

      const tokens = Array.from(segmentTokens);
      let i = 0;
      const end = tokens.length;
      let positive = false;
      let neg = false;

      if (i < end && tokens[i] === "NS") {
        positive = true;
        i++;
      }
      if (i < end && tokens[i] === "NO" && !(i + 1 < end && tokens[i + 1] === "NE")) {
        neg = true;
        i++;
      }

      let kind = "int";
      let intStr = "";
      let fracStr = "";
      let suffixKeCount = 0;

      const appendInt = ch => { intStr += ch; };
      const appendFrac = ch => { fracStr += ch; };
      const ensureIntNonEmpty = () => { if (!intStr) intStr = "0"; };
      const keTokenCount = (t) => (t === "KE") ? 1 : (t === "KEKE") ? 2 : (t === "KEKEKE") ? 3 : 0;

      function appendSep(isEne) {
        const sep = kind === "int"
          ? (isEne ? intEneSep : intGroupSep)
          : (isEne ? fracEneSep : fracGroupSep);

        if (kind === "int") {
          if (!intStr) return;
          if (!intStr.endsWith(sep)) intStr += sep;
        } else {
          if (!fracStr) return;
          if (!fracStr.endsWith(sep)) fracStr += sep;
        }
      }

      while (i < end) {
        const t = tokens[i];

        if (_NP_TOKEN_TO_DIGIT_CHAR[t] != null) {
          if (kind === "int") appendInt(_NP_TOKEN_TO_DIGIT_CHAR[t]);
          else appendFrac(_NP_TOKEN_TO_DIGIT_CHAR[t]);
          i++;
          continue;
        }

        if (t === "NO" && i + 1 < end && tokens[i + 1] === "NE") {
          if (kind !== "int") return null;
          ensureIntNonEmpty();
          kind = "frac";
          i += 2;
          continue;
        }

        if (t === "NE" && i + 1 < end && tokens[i + 1] === "NE") {
          appendSep(true);
          i += 2;
          continue;
        }

        if (t === "NE" && i + 1 < end) {
          let j = i + 1;
          let count = 0;
          while (j < end) {
            const c = keTokenCount(tokens[j]);
            if (!c) break;
            count += c;
            j++;
          }
          if (count > 0) {
            if (j < end && _NP_TOKEN_TO_DIGIT_CHAR[tokens[j]] != null) {
              appendSep(false);
              i = j;
              continue;
            }
            suffixKeCount += count;
            i = j;
            continue;
          }
          return null;
        }

        if (keTokenCount(t) > 0) return null;
        return null;
      }

      ensureIntNonEmpty();
      const suffix =
        suffixKeCount === 1 ? "K" :
        suffixKeCount === 2 ? "M" :
        suffixKeCount === 3 ? "B" :
        suffixKeCount === 4 ? "T" :
        suffixKeCount > 4 ? `×1000^${suffixKeCount}` :
        "";

      const sign = neg ? "-" : (positive ? "+" : "");
      if (kind === "frac") return sign + intStr + "." + (fracStr || "0") + suffix;
      return sign + intStr + suffix;
    }

    function decodeCapsToDisplayValue(caps, decodeOpts = {}) {
      if (!caps) return null;
      let tokens = _npTokenizeNanpaCaps(String(caps).trim().toUpperCase(), opts);
      if (tokens.length < 2 || tokens[0] !== "NE" || tokens[tokens.length - 1] !== "N") return null;

      let hasPercent = false;
      const lastIdx = tokens.length - 1;
      if (lastIdx - 1 >= 0 && tokens[lastIdx - 1] === "OK") {
        hasPercent = true;
        tokens = tokens.slice(0, lastIdx - 1).concat(["N"]);
      }

      const finalNIdx = tokens.length - 1;

      const mixedIdx = (() => {
        const ni = tokens.indexOf("NONONO");
        const nk = tokens.indexOf("NOKO");
        if (ni < 0) return nk;
        if (nk < 0) return ni;
        return Math.min(ni, nk);
      })();

      if (mixedIdx >= 0) {
        const fracIdx = tokens.indexOf("NONO", mixedIdx + 1);
        if (fracIdx < 0) return null;
        const intStr = decodeSegmentTokensToString(tokens.slice(1, mixedIdx), decodeOpts);
        const numStr = decodeSegmentTokensToString(tokens.slice(mixedIdx + 1, fracIdx), decodeOpts);
        const denStr = decodeSegmentTokensToString(tokens.slice(fracIdx + 1, finalNIdx), decodeOpts);
        if (!intStr || !numStr || !denStr) return null;
        const base = `${intStr}+${numStr}/${denStr}`;
        return hasPercent ? (base + "%") : base;
      }

      const fracIdx = tokens.indexOf("NONO");
      if (fracIdx >= 0) {
        const numStr = decodeSegmentTokensToString(tokens.slice(1, fracIdx), decodeOpts);
        const denStr = decodeSegmentTokensToString(tokens.slice(fracIdx + 1, finalNIdx), decodeOpts);
        if (!numStr || !denStr) return null;
        const base = `${numStr}/${denStr}`;
        return hasPercent ? (base + "%") : base;
      }

      const scientificMarker = _npFindScientificMarker(tokens, 1, finalNIdx);

      if (scientificMarker && scientificMarker.index > 1) {
        const mantissaStr = decodeSegmentTokensToString(tokens.slice(1, scientificMarker.index), decodeOpts);
        const exponentStr = decodeSegmentTokensToString(tokens.slice(scientificMarker.index + scientificMarker.length, finalNIdx), decodeOpts);
        if (!mantissaStr || !exponentStr) return null;
        const base = `${mantissaStr}e${exponentStr}`;
        return hasPercent ? (base + "%") : base;
      }

      const base = decodeSegmentTokensToString(tokens.slice(1, finalNIdx), decodeOpts);
      if (!base) return null;
      return hasPercent ? (base + "%") : base;
    }

    let caps = null;
    let structuredKind = null;
    try {
      const colonCartoucheCaps = _npTryParseNanpaColonCartoucheToCaps(s, opts);
      const normalized = _npNormalizeVulgarFractionInput(s);
      if (colonCartoucheCaps) caps = colonCartoucheCaps;
      const dateCaps = _npDateStrToNanpaCaps(normalized, opts);
      const timeCaps = (dateCaps == null) ? _npTimeStrToNanpaCaps(normalized, opts) : null;

      // A mixed/title-case proper name beginning with contiguous Nene... is the
      // explicit leading-plus form. Prefer that interpretation over the raw
      // caps shorthand, because an attached form such as "Nenewan" otherwise
      // also happens to look like the caps string NENEWAN. Keep an all-uppercase
      // unspaced token available as explicit raw-caps input for compatibility.
      const preferLeadingPlusProperName =
        /^nene/i.test(s) &&
        !/^[A-Z]+$/.test(s) &&
        _npIsValidNanpaLinjanProperName(s, { ...opts, relaxedNanpaLinjanParsing: relaxedParsing });

      if (caps) {
        // already parsed from the opt-in [nanpa : ... nanpa] syntax
      } else if (preferLeadingPlusProperName) {
        caps = _npProperNameToCaps(s, { ...opts, relaxedNanpaLinjanParsing: relaxedParsing });
        if (!caps) return null;
      } else if (_npLooksLikeNanpaCaps(normalized)) {
        caps = normalized.toUpperCase();
      } else if (dateCaps != null) {
        caps = dateCaps;
        structuredKind = "date";
      } else if (timeCaps != null) {
        caps = timeCaps;
        structuredKind = "time";
      } else if (_npIsValidNanpaLinjanProperName(s, { ...opts, relaxedNanpaLinjanParsing: relaxedParsing })) {
        caps = _npProperNameToCaps(s, { ...opts, relaxedNanpaLinjanParsing: relaxedParsing });
        if (!caps) return null;
      } else {
        const parsed = _npTryParseNanpaLinjanNumberCodeToCaps(s);
        if (parsed?.caps) caps = parsed.caps;
        else caps = _npDecimalStringToCaps(normalized, {
          thousandsChar: ",",
          groupFractionTriplets: true,
          fractionGroupSize: 3,
          ...opts,
          mixedStyle
        });
      }
    } catch {
      return null;
    }

    if (!caps) return null;
    caps = _npCanonicalizeScientificCaps(caps);
    if (_npNanpaCapsIsValidTime(caps, opts)) caps = _npNormalizeTimeNegativeZeroCaps(caps, opts);

    try {
      const tokens = _npTokenizeNanpaCaps(caps, opts);
      const capsIsDate = _npNanpaCapsIsValidDate(caps, opts);
      const capsIsTime = _npNanpaCapsIsValidTime(caps, opts);
      const isDate = structuredKind === "date"
        ? true
        : structuredKind === "time"
          ? false
          : capsIsDate;
      const isTime = structuredKind === "time"
        ? true
        : structuredKind === "date"
          ? false
          : (!capsIsDate && capsIsTime);
      const isTimeLike = isDate || isTime;
      const hasOk = tokens.includes("OK");
      const tokensNoOk = tokens.filter(t => t !== "OK");

      let tpWords = _npNanpaCapsTokensToTpWords(tokensNoOk, { mode, relaxedRendering, nanpaColonRendering: _npNanpaColonRenderingFromOpts(opts) });
      if (isTimeLike) tpWords = _npReplaceTimeSeparatorsTpWords(tpWords, mode);

      if (hasOk) {
        const suffixWords = (mode === "uniform")
          ? ["nena", "open", "kipisi", "e"]
          : ["noka", "open", "kipisi", "e"];
        const out = tpWords.slice();
        const lastNanpaIdx = out.lastIndexOf("nanpa");
        if (lastNanpaIdx >= 0) out.splice(lastNanpaIdx, 0, ...suffixWords);
        else out.push(...suffixWords);
        tpWords = out;
      }

      const ucsurCodepoints = tpWords.map(w => {
        const cp = _NP_WORD_TO_UCSUR_CP[String(w).toLowerCase()];
        if (cp == null) throw new Error(`No UCSUR code point for word "${w}"`);
        return cp;
      });

      const legacyProperNameRaw = _npSplitFinalHundredIninWords(splitCapsLetters(caps), { relaxedNanpaLinjanParsing: relaxedParsing });
      const properName = _npNanpaColonRenderingFromOpts(opts)
        ? _npNanpaColonProperNameFromLegacy(legacyProperNameRaw)
        : titleCaseCapsLabel(legacyProperNameRaw);
      const uniqueCode = capsToCanonicalUniqueCode(caps, opts);
      const hexCodepoints = codepointsToHexString(ucsurCodepoints);
      const hexWithCartouche = codepointsToHexString(withCartoucheMarkers(ucsurCodepoints));
      const displayValue = decodeCapsToDisplayValue(caps, opts);

      return {
        input: s,
        caps,
        properName,
        uniqueCode,
        ucsurCodepoints,
        hexCodepoints,
        hexWithCartouche,
        tpWords,
        words: tpWords.slice(),
        displayValue,
        isTime,
        isDate,
        isTimeLike,
        innerCodepoints: ucsurCodepoints.slice(),
        codepoints: withCartoucheMarkers(ucsurCodepoints),
        numericMode: mode
      };
    } catch {
      return null;
    }
  },

  encodeDecimal(s, opts = {}) {
    return _npDecimalStringToCaps(String(s ?? ""), {
      thousandsChar: ",",
      groupFractionTriplets: true,
      fractionGroupSize: 3,
      ...opts
    });
  },

  decimalToUcsurCodepoints(s, opts = {}) {
    const parsed = this.parseNumber(String(s ?? ""), opts);
    return parsed ? Array.from(parsed.ucsurCodepoints ?? []) : [];
  },

  properNameToUcsurCodepoints(s, opts = {}) {
    const parsed = this.parseNumber(String(s ?? ""), opts);
    return parsed ? Array.from(parsed.ucsurCodepoints ?? []) : [];
  },

  splitCapsToProperName(caps, { titleCase = true, relaxedNanpaLinjanParsing = false, nanpaColonRendering = false } = {}) {
    caps = _npCanonicalizeScientificCaps(caps);
    function splitCapsLetters(sCaps) {
      if (sCaps == null) throw new Error("caps must be a string");
      const s0 = String(sCaps).trim().toUpperCase();
      if (!s0) return "";
      if (s0.length < 3 || !s0.startsWith("NE") || !s0.endsWith("N")) {
        throw new Error(`Not a valid nanpa-caps label: "${sCaps}"`);
      }

      const hasOkSuffix = s0.length >= 3 && s0.slice(-3, -1) === "OK";
      const mainS = hasOkSuffix ? (s0.slice(0, -3) + "N") : s0;

      let outStr = "";
      let i = 0;
      const end = mainS.length - 1;

      if (end % 2 !== 0) throw new Error(`Malformed caps (odd pair area) in "${sCaps}"`);

      while (i < end) {
        const pair = mainS.slice(i, i + 2);
        const nextPair = (i + 4 <= end) ? mainS.slice(i + 2, i + 4) : null;

        if (pair === "NE" && nextPair === "NO" && i === 0) { outStr += "neno "; i += 4; continue; }
        if (pair === "NE" && nextPair === "NS" && i === 0) { outStr += "nene "; i += 4; continue; }
        if (pair === "NE" && nextPair === "NE") { outStr += "n "; outStr += "ene "; i += 4; continue; }
        if (pair === "NO" && nextPair === "NE" && i > 0) { outStr += "n "; outStr += "one "; i += 4; continue; }
        if (pair === "NO" && nextPair === "KO" && i > 0) { outStr += "n "; outStr += "oko"; if ((i + 4) < end) outStr += " "; i += 4; continue; }
        if (pair === "NE" && nextPair === "KO" && i > 0) { outStr += "n "; outStr += "eko"; if ((i + 4) < end) outStr += " "; i += 4; continue; }
        if (pair === "NO" && nextPair === "NO" && i > 0) {
          outStr += "n ";
          outStr += "o";
          let countNo = 1; let j = i;
          while ((j + 6) <= end && mainS.slice(j + 4, j + 6) === "NO") { countNo++; j += 2; }
          outStr += "no".repeat(countNo);
          if ((i + 2 * countNo) < end) outStr += " ";
          i += 2 + 2 * countNo; continue;
        }
        if (pair === "NE" && nextPair === "KE") {
          outStr += "n ";
          let countKe = 1; let j = i;
          while ((j + 6) <= end && mainS.slice(j + 4, j + 6) === "KE") { countKe++; j += 2; }
          outStr += _npMagnitudeKeProperNameFragment(countKe);
          if ((i + 2 * countKe) < end) outStr += " ";
          i += 2 + 2 * countKe; continue;
        }

        if (pair === "OK") {
          if (i > 0 && !/\s$/.test(outStr)) outStr += " ";
          if (i > 0) outStr += "n ";
          outStr += "oke";
        } else {
          outStr += pair.toLowerCase();
        }
        i += 2;
      }

      outStr = outStr.replace(/\s+n(?=\s|$)/g, "n").trim();
      outStr += "n";
      if (hasOkSuffix) outStr += " oken";
      return outStr;
    }

    const raw = _npSplitFinalHundredIninWords(splitCapsLetters(caps), { relaxedNanpaLinjanParsing });
    if (nanpaColonRendering) {
      const alternative = _npNanpaColonProperNameFromLegacy(raw);
      return titleCase ? alternative : alternative.toLowerCase();
    }
    if (!titleCase) return raw;
    return String(raw).trim().split(/\s+/).filter(Boolean)
      .map(w => w.length === 1 ? w.toUpperCase() : (w[0].toUpperCase() + w.slice(1)))
      .join(" ");
  },

  capsToUniqueCode(caps, opts = {}) {
    caps = _npCanonicalizeScientificCaps(caps);
    let tokens;
    try {
      tokens = _npTokenizeNanpaCaps(caps, opts);
    } catch {
      const proper = this.splitCapsToProperName(caps, { titleCase: true });
      const noSpaces = String(proper ?? "").replace(/\s+/g, "");
      const withoutNE = noSpaces.replace(/[nNeE]/g, "");
      const up = withoutNE.toUpperCase();
      return "#~" + up.replace(/O/g, "o").replace(/K/g, "k");
    }

    const parts = [];
    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i];
      if (t === "NE") {
        if (i === 0 && tokens[i + 1] === "NS") {
          parts.push("e");
          i += 1;
          continue;
        }
        let j = i;
        while (j < tokens.length && tokens[j] === "NE") j++;
        const count = j - i;
        const nextToken = tokens[j];

        // Pair every available NE as one no-value spacer. When an odd NE
        // remains immediately before KO, that final NE+KO is scientific EKO.
        const spacerCount = Math.floor(count / 2);
        if (spacerCount > 0) parts.push("ee".repeat(spacerCount));

        if ((count % 2) === 1 && nextToken === "KO") {
          parts.push("eko");
          i = j; // consume the KO as part of EKO
        } else {
          i = j - 1; // leave the following non-NE token for the main loop
        }
        continue;
      }
      if (t === "N") continue;
      if (_NP_TOKEN_TO_NUMBER_CODE_LETTER[t]) { parts.push(_NP_TOKEN_TO_NUMBER_CODE_LETTER[t]); continue; }
      if (t === "NO") { parts.push("o"); continue; }
      if (t === "NONO") { parts.push("oo"); continue; }
      if (t === "NONONO") { parts.push("ooo"); continue; }
      if (t === "NOKO") { parts.push("oko"); continue; }
      if (t === "KO") { parts.push("ko"); continue; }
      if (t === "KE") { parts.push("k"); continue; }
      if (t === "KEKE") { parts.push("kk"); continue; }
      if (t === "KEKEKE") { parts.push("kkk"); continue; }
      if (t === "OK") { parts.push("ok"); continue; }
    }
    return "#~" + parts.join("");
  },

  decodeCaps(caps, opts = {}) {
    caps = _npCanonicalizeScientificCaps(caps);
    function keTokenCount(t) {
      if (t === "KE") return 1;
      if (t === "KEKE") return 2;
      if (t === "KEKEKE") return 3;
      return 0;
    }

    function decodeSegmentTokensToString(segmentTokens, decodeOpts = {}) {
      if (!segmentTokens) return null;
      const intEneSep    = decodeOpts.intEneSep    != null ? String(decodeOpts.intEneSep)    : ",";
      const intGroupSep  = decodeOpts.intGroupSep  != null ? String(decodeOpts.intGroupSep)  : ",";
      const fracEneSep   = decodeOpts.fracEneSep   != null ? String(decodeOpts.fracEneSep)   : "_";
      const fracGroupSep = decodeOpts.fracGroupSep != null ? String(decodeOpts.fracGroupSep) : "_";

      const tokens = Array.from(segmentTokens);
      let i = 0;
      const end = tokens.length;
      let positive = false;
      let neg = false;
      if (i < end && tokens[i] === "NS") {
        positive = true;
        i++;
      }
      if (i < end && tokens[i] === "NO" && !(i + 1 < end && tokens[i + 1] === "NE")) {
        neg = true;
        i++;
      }

      let kind = "int";
      let intStr = "";
      let fracStr = "";
      let suffixKeCount = 0;

      const appendInt = ch => { intStr += ch; };
      const appendFrac = ch => { fracStr += ch; };
      const ensureIntNonEmpty = () => { if (!intStr) intStr = "0"; };

      function appendSep(isEne) {
        const sep = kind === "int"
          ? (isEne ? intEneSep : intGroupSep)
          : (isEne ? fracEneSep : fracGroupSep);
        if (kind === "int") {
          if (!intStr) return;
          if (!intStr.endsWith(sep)) intStr += sep;
        } else {
          if (!fracStr) return;
          if (!fracStr.endsWith(sep)) fracStr += sep;
        }
      }

      while (i < end) {
        const t = tokens[i];
        if (_NP_TOKEN_TO_DIGIT_CHAR[t] != null) {
          if (kind === "int") appendInt(_NP_TOKEN_TO_DIGIT_CHAR[t]);
          else appendFrac(_NP_TOKEN_TO_DIGIT_CHAR[t]);
          i++;
          continue;
        }
        if (t === "NO" && i + 1 < end && tokens[i + 1] === "NE") {
          if (kind !== "int") return null;
          ensureIntNonEmpty();
          kind = "frac";
          i += 2;
          continue;
        }
        if (t === "NE" && i + 1 < end && tokens[i + 1] === "NE") {
          appendSep(true);
          i += 2;
          continue;
        }
        if (t === "NE" && i + 1 < end) {
          let j = i + 1;
          let count = 0;
          while (j < end) {
            const c = keTokenCount(tokens[j]);
            if (!c) break;
            count += c;
            j++;
          }
          if (count > 0) {
            if (j < end && _NP_TOKEN_TO_DIGIT_CHAR[tokens[j]] != null) {
              appendSep(false);
              i = j;
              continue;
            }
            suffixKeCount += count;
            i = j;
            continue;
          }
          return null;
        }
        if (keTokenCount(t) > 0) return null;
        return null;
      }

      ensureIntNonEmpty();
      const suffix =
        suffixKeCount === 1 ? "K" :
        suffixKeCount === 2 ? "M" :
        suffixKeCount === 3 ? "B" :
        suffixKeCount === 4 ? "T" :
        suffixKeCount > 4 ? `×1000^${suffixKeCount}` :
        "";

      const sign = neg ? "-" : (positive ? "+" : "");
      if (kind === "frac") return sign + intStr + "." + (fracStr || "0") + suffix;
      return sign + intStr + suffix;
    }

    if (!caps) return null;
    let tokens = _npTokenizeNanpaCaps(String(caps).trim().toUpperCase());
    if (tokens.length < 2 || tokens[0] !== "NE" || tokens[tokens.length - 1] !== "N") return null;

    let hasPercent = false;
    const lastIdx = tokens.length - 1;
    if (lastIdx - 1 >= 0 && tokens[lastIdx - 1] === "OK") {
      hasPercent = true;
      tokens = tokens.slice(0, lastIdx - 1).concat(["N"]);
    }

    const finalNIdx = tokens.length - 1;

    const mixedIdx = (() => {
      const ni = tokens.indexOf("NONONO");
      const nk = tokens.indexOf("NOKO");
      if (ni < 0) return nk;
      if (nk < 0) return ni;
      return Math.min(ni, nk);
    })();

    if (mixedIdx >= 0) {
      const fracIdx = tokens.indexOf("NONO", mixedIdx + 1);
      if (fracIdx < 0) return null;
      const intStr = decodeSegmentTokensToString(tokens.slice(1, mixedIdx), opts);
      const numStr = decodeSegmentTokensToString(tokens.slice(mixedIdx + 1, fracIdx), opts);
      const denStr = decodeSegmentTokensToString(tokens.slice(fracIdx + 1, finalNIdx), opts);
      if (!intStr || !numStr || !denStr) return null;
      const base = `${intStr}+${numStr}/${denStr}`;
      return hasPercent ? (base + "%") : base;
    }

    const fracIdx = tokens.indexOf("NONO");
    if (fracIdx >= 0) {
      const numStr = decodeSegmentTokensToString(tokens.slice(1, fracIdx), opts);
      const denStr = decodeSegmentTokensToString(tokens.slice(fracIdx + 1, finalNIdx), opts);
      if (!numStr || !denStr) return null;
      const base = `${numStr}/${denStr}`;
      return hasPercent ? (base + "%") : base;
    }

    const scientificMarker = _npFindScientificMarker(tokens, 1, finalNIdx);

    if (scientificMarker && scientificMarker.index > 1) {
      const mantissaStr = decodeSegmentTokensToString(tokens.slice(1, scientificMarker.index), opts);
      const exponentStr = decodeSegmentTokensToString(tokens.slice(scientificMarker.index + scientificMarker.length, finalNIdx), opts);
      if (!mantissaStr || !exponentStr) return null;
      const base = `${mantissaStr}e${exponentStr}`;
      return hasPercent ? (base + "%") : base;
    }

    const base = decodeSegmentTokensToString(tokens.slice(1, finalNIdx), opts);
    if (!base) return null;
    return hasPercent ? (base + "%") : base;
  },

  ucsurCodepointsToTpWords(cps) {
    return _npCodepointsToWords(cps);
  },

  tpWordsToText(words) {
    return Array.from(words ?? []).join(" ");
  },

  parseTpWordsToCodepoints(input) {
    const raw = String(input ?? "").trim();
    if (!raw) return [];
    const parts = raw.split(/(\s+|[·:])/).filter(s => s && !/^\s+$/.test(s));
    const cps = [];
    for (const p of parts) {
      const key = _npResolveTpWordInputKey(p);
      const cp = _NP_WORD_TO_UCSUR_CP[key];
      if (cp == null) throw new Error(`Invalid Toki Pona word "${p}". Only mapped words and exact alternative-glyph aliases are allowed.`);
      cps.push(cp);
    }
    for (const cp of cps) {
      if (!(Number.isInteger(cp) && ((cp >= _NP_TP_UCSUR_MIN && cp <= _NP_TP_UCSUR_MAX) || cp === _NP_CARTOUCHE_START_CP || cp === _NP_CARTOUCHE_END_CP))) {
        throw new Error(`Disallowed code point U+${cp.toString(16).toUpperCase()}`);
      }
    }
    if (cps.length >= 2 && cps[0] === _NP_CARTOUCHE_START_CP && cps[cps.length - 1] === _NP_CARTOUCHE_END_CP) {
      return cps.slice(1, -1);
    }
    return cps;
  },

  codepointsToHex(cps) {
    return Array.from(cps ?? [])
      .map(cp => cp.toString(16).toUpperCase().padStart(4, "0"))
      .join(" ");
  },

  codepointsToHexWithCartouche(cps) {
    const withMarkers = [_NP_CARTOUCHE_START_CP, ...Array.from(cps ?? []), _NP_CARTOUCHE_END_CP];
    return Array.from(withMarkers)
      .map(cp => cp.toString(16).toUpperCase().padStart(4, "0"))
      .join(" ");
  },

  parseHexCodepoints(input) {
    const cps = parseCompleteUnicodeCodepointInput(input);

    if (cps.length >= 2 && cps[0] === _NP_CARTOUCHE_START_CP && cps[cps.length - 1] === _NP_CARTOUCHE_END_CP) {
      return cps.slice(1, -1);
    }
    return cps;
  },

  withCartoucheMarkers(cps) {
    return [_NP_CARTOUCHE_START_CP, ...Array.from(cps ?? []), _NP_CARTOUCHE_END_CP];
  },

  stripCartoucheMarkers(cps) {
    const a = Array.from(cps ?? []);
    if (a.length >= 2 && a[0] === _NP_CARTOUCHE_START_CP && a[a.length - 1] === _NP_CARTOUCHE_END_CP) {
      return a.slice(1, -1);
    }
    return a;
  },

  isValidCaps(s) {
    return _npLooksLikeNanpaCaps(s);
  },

  isValidProperName(s) {
    return _npIsValidNanpaLinjanProperName(s, arguments[1] || {});
  },

  isValidTimeOrDate(caps) {
    return _npNanpaCapsIsValidTimeOrDate(caps, arguments[1] || {});
  },

  isValidTime(caps) {
    return _npNanpaCapsIsValidTime(caps, arguments[1] || {});
  },

  isValidDate(caps) {
    return _npNanpaCapsIsValidDate(caps, arguments[1] || {});
  },

  tokenizeCaps(caps) {
    return _npTokenizeNanpaCaps(caps, arguments[1] || {});
  },

  capsTokensToTpWords(tokens, opts = {}) {
    const mode = ((opts.mode === "traditional") || (opts.numericMode === "traditional"))
      ? "traditional"
      : "uniform";
    const canonicalTokens = _npCanonicalizeScientificTokens(tokens);
    return _npNanpaCapsTokensToTpWords(canonicalTokens, { mode, relaxedRendering: _npRelaxedRenderingFromOpts(opts), nanpaColonRendering: _npNanpaColonRenderingFromOpts(opts) });
  },

  tpWordsToUcsurCodepoints(words) {
    return Array.from(words ?? []).map(w => {
      const cp = _NP_WORD_TO_UCSUR_CP[String(w).toLowerCase()];
      if (cp == null) throw new Error(`No UCSUR code point for word "${w}"`);
      return cp;
    });
  },

  normalizeVulgarFraction(s) {
    return _npNormalizeVulgarFractionInput(s);
  },

  normalizeTpWord(s) {
    return _npNormalizeTpWord(s);
  },

  getSmallCodepointsSet() {
    return new Set([0xF193D, 0xF1940, 0xF1941, 0xF193E, 0xF1909, 0xF190B, 0xF190A]);
  },

  getQuarterCodepointsSet() {
    return new Set([0xF193D, 0xF1940, 0xF1941, 0xF193E, 0xF1909, 0xF190B, 0xF190A, 0xF1947]);
  },

  getOneThirdCodepointsSet() {
    return new Set([0xF1917]);
  },

  getTwoThirdsCodepointsSet() {
    return new Set([0xF1946, 0xF1944, 0xF191F, 0xF1979]);
  },

  getHalfCodepointsSet() {
    return new Set([0xF1914]);
  },

  isAllowedTpUcsurCodepoint(cp) {
    return Number.isInteger(cp) && (
      (cp >= _NP_TP_UCSUR_MIN && cp <= _NP_TP_UCSUR_MAX) ||
      cp === _NP_CARTOUCHE_START_CP ||
      cp === _NP_CARTOUCHE_END_CP
    );
  },

  parseIdentifier(input, opts = {}) {
    const mode = ((opts.mode === "traditional") || (opts.numericMode === "traditional"))
      ? "traditional"
      : "uniform";
    const cps = _npTryDecodeNanpaLinjanIdentifierToCodepoints(input, { mode, relaxedParsing: _npRelaxedParsingFromOpts(opts), relaxedRendering: _npRelaxedRenderingFromOpts(opts), nanpaColonParsing: _npNanpaColonParsingFromOpts(opts), nanpaColonRendering: _npNanpaColonRenderingFromOpts(opts) });
    if (!cps || !cps.length) return null;

    return {
      input: String(input ?? ""),
      innerCodepoints: Array.from(cps),
      codepoints: _npWrapCartouche(cps),
      words: _npCodepointsToWords(cps),
      numericMode: mode
    };
  },

  capsToWords(caps, opts = {}) {
    caps = _npCanonicalizeScientificCaps(caps);
    if (_npNanpaCapsIsValidTime(caps, opts)) caps = _npNormalizeTimeNegativeZeroCaps(caps, opts);
    const mode = ((opts.mode === "traditional") || (opts.numericMode === "traditional"))
      ? "traditional"
      : "uniform";
    const tokens = _npTokenizeNanpaCaps(caps, opts);
    const hasOk = tokens.includes("OK");
    const tokensNoOk = tokens.filter(t => t !== "OK");
    let words = _npNanpaCapsTokensToTpWords(tokensNoOk, { mode, relaxedRendering: _npRelaxedRenderingFromOpts(opts), nanpaColonRendering: _npNanpaColonRenderingFromOpts(opts) });

    if (_npNanpaCapsIsValidTimeOrDate(caps, opts)) {
      words = _npReplaceTimeSeparatorsTpWords(words, mode);
    }

    if (!hasOk) return words;

    const suffixWords = (mode === "uniform")
      ? ["nena", "open", "kipisi", "e"]
      : ["noka", "open", "kipisi", "e"];

    const out = words.slice();
    const lastNanpaIdx = out.lastIndexOf("nanpa");
    if (lastNanpaIdx >= 0) out.splice(lastNanpaIdx, 0, ...suffixWords);
    else out.push(...suffixWords);
    return out;
  },

  capsToCodepoints(caps, opts = {}) {
    const mode = ((opts.mode === "traditional") || (opts.numericMode === "traditional"))
      ? "traditional"
      : "uniform";
    const isTime = _npNanpaCapsIsValidTimeOrDate(caps, opts);
    const innerCodepoints = _npNanpaCapsToNanpaLinjanCodepoints(caps, { mode, isTime, relaxedParsing: _npRelaxedParsingFromOpts(opts), relaxedRendering: _npRelaxedRenderingFromOpts(opts), nanpaColonRendering: _npNanpaColonRenderingFromOpts(opts) });
    if (!innerCodepoints || !innerCodepoints.length) return null;

    return {
      innerCodepoints,
      codepoints: _npWrapCartouche(innerCodepoints),
      words: _npCodepointsToWords(innerCodepoints),
      numericMode: mode,
      isTimeLike: !!isTime
    };
  },

  codepointsToWords(codepoints) {
    return _npCodepointsToWords(codepoints);
  }
});

  return {
    async create(config = {}) {
      await ensureCore();
      return new RendererInstance(config);
    },
    registerRenderAdapter(id, adapter) {
      return registerFontRenderAdapter(id, adapter);
    },
    unregisterRenderAdapter(id) {
      return unregisterFontRenderAdapter(id);
    },
    hasRenderAdapter(id) {
      return hasFontRenderAdapter(id);
    },
    getDefaultRenderAdapterId() {
      return DEFAULT_FONT_RENDER_ADAPTER_ID;
    },
    NanpaParser,
  };
})();

if (typeof window !== 'undefined') {
  window.SitelenRenderer = SitelenRenderer;
  window.NanpaParser = SitelenRenderer.NanpaParser;
}
export { SitelenRenderer };
export const NanpaParser = SitelenRenderer.NanpaParser;
export default SitelenRenderer;
