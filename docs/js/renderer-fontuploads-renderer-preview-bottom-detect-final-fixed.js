
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
  let __bridgeParseBracketSegmentToElements = null;
  let __bridgeFontsReadyForPx = null;
  let __bridgeWarmUpCanvasFontsOnce = null;
  let __bridgeRenderAllLinesToCanvas = null;
  let __bridgeDrawTextWithOptionalHalo = null;
  let __bridgeNormalizeTpGlyphKey = null;
  let __bridgeWordToUcsurCp = null;
  let __bridgeEmitRawUcsurCodepointsWithOptionalManualTallies = null;



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
        out.push({ kind: 'quote', value: s.slice(i + 1, j) });
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

  function normalizeAstInput(input) {
    return preprocessTextAliases(input).replace(/\r\n/g, '\n');
  }

  function astFromInput(input) {
    const normalized = normalizeAstInput(input);
    const lines = normalized.split('\n').map((line, index) => ({ type: 'line', index, children: splitLineIntoAstSegments(line) }));
    return { type: 'document', normalizedInput: normalized, lines };
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
  let FONT_FAMILY_UNKNOWN = "Patrick-Head-Font";

  function captureRenderFontState() {
    return {
      text: FONT_FAMILY_TEXT,
      cartouche: FONT_FAMILY_CARTOUCHE,
      number: FONT_FAMILY_NUMBER,
      literal: FONT_FAMILY_LITERAL,
      unknown: FONT_FAMILY_UNKNOWN,
      mixedStyle: __mixedStyle,
      showUnknownText: __showUnknownText,
      cartoucheCommaTallyMarks: __cartoucheCommaTallyMarks,
      cartoucheTallyMode: __cartoucheTallyMode,
      unknownTextDisplay: { ...__unknownTextDisplay },
      renderSpacing: { ...__renderSpacing },
    };
  }

  function restoreRenderFontState(state) {
    if (!state) return;
    FONT_FAMILY_TEXT = state.text || FONT_FAMILY_TEXT;
    FONT_FAMILY_CARTOUCHE = state.cartouche || FONT_FAMILY_CARTOUCHE;
    FONT_FAMILY_NUMBER = state.number || FONT_FAMILY_NUMBER;
    FONT_FAMILY_LITERAL = state.literal || FONT_FAMILY_LITERAL;
    FONT_FAMILY_UNKNOWN = state.unknown || FONT_FAMILY_UNKNOWN;
    if (state.mixedStyle === "short" || state.mixedStyle === "long") __mixedStyle = state.mixedStyle;
    __showUnknownText = !!state.showUnknownText;
    if (state.cartoucheCommaTallyMarks != null) __cartoucheCommaTallyMarks = !!state.cartoucheCommaTallyMarks;
    if (state.cartoucheTallyMode != null) __cartoucheTallyMode = normalizeCartoucheTallyMode(state.cartoucheTallyMode);
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
  }

  let __renderConfigScopeQueue = Promise.resolve();

  // mixedStyle lives in outer scope so applyRenderConfig can set it
  // and astToLineElements / lineToElements can read it via getMixedStyle()
  let __mixedStyle = "short";
  let __showUnknownText = false;

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
    if (parser.showUnknownText != null) setShowUnknownText(!!parser.showUnknownText);
    if (parser.cartoucheCommaTallyMarks != null) setCartoucheCommaTallyMarks(!!parser.cartoucheCommaTallyMarks);
    else if (parser.commaTallyInCartouche != null) setCartoucheCommaTallyMarks(!!parser.commaTallyInCartouche);
    else if (parser.enableCartoucheCommaTally != null) setCartoucheCommaTallyMarks(!!parser.enableCartoucheCommaTally);

    if (parser.cartoucheTallyMode != null) setCartoucheTallyMode(parser.cartoucheTallyMode);
    else if (parser.cartoucheCommaTallyMode != null) setCartoucheTallyMode(parser.cartoucheCommaTallyMode);
    else if (parser.tallyMode != null) setCartoucheTallyMode(parser.tallyMode);

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
          if (parser.mode === 'sitelen-seli-kiwen') parseSskTextSegmentToElements(seg.value, elements, { fontPx, parser, mixedStyle, sourceBaseStart: 0, sourceKind, sourceSegmentIndex });
          else __bridgeParseTextSegmentToElements(seg.value, elements, { fontPx, sourceBaseStart: 0, sourceKind, sourceSegmentIndex, mixedStyle });
        }
        else if (seg.kind === 'bracket') {
          if (parser.mode === 'sitelen-seli-kiwen') parseSskBracketSegmentToElements(seg.value, elements, { fontPx, parser, mixedStyle, sourceBaseStart: 0, sourceKind, sourceSegmentIndex });
          else __bridgeParseBracketSegmentToElements(seg.value, elements, { fontPx, sourceBaseStart: 0, sourceKind, sourceSegmentIndex, mixedStyle });
        }
        else if (seg.kind === 'quote') __bridgeParseQuoteSegmentToElements(seg.value, elements, { fontPx, sourceBaseStart: 0, sourceKind, sourceSegmentIndex });
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
      lines.push(elements);
    }
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

  function parseSskTextSegmentToElements(segmentText, elements, { fontPx, parser = {}, mixedStyle = 'long', sourceBaseStart = 0, sourceKind = 'text', sourceSegmentIndex = null }) {
    const s = String(segmentText ?? '');
    if (!s.trim()) return;
    const tokenRe = /(?:\{([^{}]+)\}\s*)?([A-Za-z][A-Za-z0-9_]*)(?:\s*\(([^()]+)\))|([A-Za-z][A-Za-z0-9_]*)\s*([&+-])\s*([A-Za-z][A-Za-z0-9_]*)|\{([^{}]+)\}\s*([A-Za-z][A-Za-z0-9_]*)/g;
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

  function alignFactorFromMode(mode) {
    const m = String(mode || '').toLowerCase();
    if (m === 'center') return 0.5;
    if (m === 'right') return 1;
    return 0;
  }

  function clonePlanElement(el) {
    if (!el || typeof el !== 'object') return el;
    const base = { ...el };
    if (el.type === 'cartouche' && el.canvas) {
      base.canvas = el.canvas;
    }
    if (Array.isArray(el.cps)) base.cps = el.cps.slice();
    return base;
  }

  function classifyRenderMode(el) {
    if (!el) return 'text';
    if (el.type === 'cartouche') return 'raster';
    if (el.type === 'text') return 'raster';
    return 'text';
  }

  function inferFontRole(el) {
    if (!el) return 'word';
    const fam = String(el.fontFamily || '');
    if (el.type === 'text') return 'literal';
    if (el.type === 'cartouche') {
      if (fam && fam === FONT_FAMILY_NUMBER) return 'number';
      return 'cartouche';
    }
    if (fam && fam === FONT_FAMILY_NUMBER) return 'number';
    return 'word';
  }

  function buildMeasuredRenderPlan(linesElements, config = {}) {
    const fontPx = Math.max(8, Number(config?.layout?.fontPx ?? (__bridgeGetFontPx ? __bridgeGetFontPx() : 56) ?? 56));
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

    function measureTextLike(chars, px, fontFamily) {
      ctx.font = `${px}px "${fontFamily}"`;
      const m = ctx.measureText(chars);

      const ascent = m.actualBoundingBoxAscent ?? Math.ceil(px * 0.8);
      const descent = m.actualBoundingBoxDescent ?? Math.ceil(px * 0.2);

      const s = String(chars ?? "");

      // Only fix intentional ideographic-space runs.
      // U+3000 has advance width but may have no ink bounds.
      const isIdeographicSpaceOnly = /^[\u3000]+$/u.test(s);

      if (isIdeographicSpaceOnly) {
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
          const m = measureTextLike(el.text, el.px ?? fontPx, fam);
          measuredEls.push({ ...el, _index: ei, m });
          w += m.w;
          maxAscent = Math.max(maxAscent, m.ascent + haloExtra);
          maxDescent = Math.max(maxDescent, m.descent + haloExtra);
          continue;
        }
        if (el.type === 'glyph') {
          const fam = el.fontFamily || FONT_FAMILY_TEXT;
          const m = measureTextLike(String.fromCodePoint(el.cp), el.px ?? fontPx, fam);
          measuredEls.push({ ...el, _index: ei, m });
          w += m.w;
          maxAscent = Math.max(maxAscent, m.ascent + haloExtra);
          maxDescent = Math.max(maxDescent, m.descent + haloExtra);
          continue;
        }
        if (el.type === 'run') {
          const fam = el.fontFamily || FONT_FAMILY_TEXT;
          const chars = (el.cps || []).map(cp => String.fromCodePoint(cp)).join('');
          const m = measureTextLike(chars, el.px ?? fontPx, fam);
          measuredEls.push({ ...el, _index: ei, m });
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
          const capD = Math.ceil(fontPx * (hasManualTallies ? 0.58 : 0.20)) + allowance;
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
            ? String.fromCodePoint(el.cp)
            : el.type === 'run'
              ? (el.cps || []).map(cp => String.fromCodePoint(cp)).join('')
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
          encodedText,
          cps: Array.isArray(el.cps) ? el.cps.slice() : (el.type === 'glyph' ? [el.cp] : null),
          imageAlt: el.imageAlt || null,
          isQuoted: !!el.isQuoted,
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
    return plan;
  }

  function drawRenderRunToCanvas(run, { supersampleScale = 4, downsample = false } = {}) {
    if (!run || !run._element) throw new Error('renderRunToNewCanvas requires a run object returned by buildRenderPlan().');
    const scale = Math.max(1, Number(supersampleScale) || 1);
    const el = run._element;
    const baseW = Math.max(1, Math.ceil(Number(run.widthPx || el.w || 1)));
    const baseH = Math.max(1, Math.ceil(Number(run.heightPx || el.h || run.fontPx || 1)));
    const drawW = Math.max(1, Math.ceil(baseW * scale));
    const drawH = Math.max(1, Math.ceil(baseH * scale));
    const c = document.createElement('canvas');
    c.width = drawW;
    c.height = drawH;
    const ctx = c.getContext('2d', { alpha: true });
    ctx.clearRect(0, 0, drawW, drawH);
    const fillCss = run.fillStyle || getFgHex?.() || '#000000';
    if (el.type === 'cartouche' && el.canvas) {
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
      const chars = el.type === 'glyph' ? String.fromCodePoint(el.cp) : (el.cps || []).map(cp => String.fromCodePoint(cp)).join('');
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

  async function renderAstToNewCanvas(ast, config = {}) {
    return await withScopedRenderConfig(config, async () => {
      if (typeof __bridgeFontsReadyForPx === 'function') await __bridgeFontsReadyForPx(config?.layout?.fontPx ?? (__bridgeGetFontPx ? __bridgeGetFontPx() : 56));
      if (typeof __bridgeWarmUpCanvasFontsOnce === 'function') __bridgeWarmUpCanvasFontsOnce();
      const linesElements = await astToLineElements(ast, config);
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

    // NEW: glyph-key normalization (used for WORD_TO_UCSUR_CP lookups)
    // Keeps: a-z plus ^ < > : , . and middle dot ·
    function normalizeTpGlyphKey(raw) {
      return String(raw ?? "")
        .toLowerCase()
        .trim()
        .replace(/[^a-z^<>:,.·]/g, "");
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

      try {
        const okText = document.fonts.check(`${px}px "${FONT_FAMILY_TEXT}"`, sampleTextChar);
        const okCart = document.fonts.check(`${px}px "${FONT_FAMILY_CARTOUCHE}"`, sampleCartChar);
        const okNum  = document.fonts.check(`${px}px "${FONT_FAMILY_NUMBER}"`, sampleCartChar);
        const okLit  = document.fonts.check(`${px}px "${FONT_FAMILY_LITERAL}"`, sampleLiteral);

        const loads = [];
        if (!okText) loads.push(document.fonts.load(`${px}px "${FONT_FAMILY_TEXT}"`, sampleTextChar));
        if (!okCart) loads.push(document.fonts.load(`${px}px "${FONT_FAMILY_CARTOUCHE}"`, sampleCartChar));
        if (!okNum)  loads.push(document.fonts.load(`${px}px "${FONT_FAMILY_NUMBER}"`, sampleCartChar));
        if (!okLit)  loads.push(document.fonts.load(`${px}px "${FONT_FAMILY_LITERAL}"`, sampleLiteral));

        if (loads.length) await Promise.all(loads);

        await document.fonts.ready;

        const okText2 = document.fonts.check(`${px}px "${FONT_FAMILY_TEXT}"`, sampleTextChar);
        const okCart2 = document.fonts.check(`${px}px "${FONT_FAMILY_CARTOUCHE}"`, sampleCartChar);
        const okLit2  = document.fonts.check(`${px}px "${FONT_FAMILY_LITERAL}"`, sampleLiteral);

        if (!okText2 || !okCart2 || !okLit2) {
          await Promise.all([
            document.fonts.load(`${px}px "${FONT_FAMILY_TEXT}"`, sampleTextChar),
            document.fonts.load(`${px}px "${FONT_FAMILY_CARTOUCHE}"`, sampleCartChar),
            document.fonts.load(`${px}px "${FONT_FAMILY_LITERAL}"`, sampleLiteral),
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

      const stripped = s0.replace(/^[^a-z^<>:,.·]+|[^a-z^<>:,.·]+$/g, "");
      if (!stripped) return "";

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
    const CP_EN    = NANPA_LINJA_N_WORD_TO_CP["en"];

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

      for (let i = 0; i < a.length; i++) {
        const cp = a[i];

        if (cp === CP_NANPA) {
          if (i !== 0 && i !== a.length - 1) a[i] = CP_NENA;
          continue;
        }
        if (UNIFORM_TO_NENA.has(cp)) { a[i] = CP_NENA; continue; }
        if (UNIFORM_TO_EN.has(cp))   { a[i] = CP_EN; continue; }
      }
      return a;
    }

    const DIGIT_TOKENS = new Set(["NI","WE","TE","SE","NA","LE","NU","ME","PE","JE"]);
    const TOKEN_PREFIXES = ["KEKEKE","KEKE","KE","NONONO","NONO","NOKO","OK","NE","NO"];

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
          if (DIGIT_TOKENS.has(two)) { tokens.push(two); i += 2; continue; }
        }

        throw new Error(`Invalid tokenization at position ${i} in caps string "${caps}"`);
      }

      tokens.push("N");
      return tokens;
    }

    function isValidNanpaLinjanProperName(raw) {
      const s = String(raw ?? "").replace(/\s+/g, "");
      if (!s) return false;
      if (!/^[a-zA-Z]+$/.test(s)) return false;
      if (!/[nN]$/.test(s)) return false;

      const core = s.slice(0, -1);
      if (core.length < 2 || (core.length % 2) !== 0) return false;

      const caps = core.toUpperCase() + "N";
      if (!caps.startsWith("NE")) return false;

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

      // CHANGED: body must be let, not const
      let body = s0.slice(2).toUpperCase();
      if (!body) throw new Error("Number code '#~' must have letters after it.");
      if (!/^[A-Z]+$/.test(body)) throw new Error("Number code may only contain letters A–Z after '#~'.");

      // NEW: treat trailing "OK" as percent marker token (not O-then-K operators)
      let hasPercent = false;
      if (body.endsWith("OK")) {
        hasPercent = true;
        body = body.slice(0, -2);
        if (!body) throw new Error("Number code '#~' cannot be only 'OK' (no numeric content).");
      }

      const tokens = ["NE"];
      let i = 0;

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

        if (ch === "O") {
          let j = i;
          while (j < body.length && body[j] === "O") j++;
          const count = j - i;
          if (count < 1 || count > 3) throw new Error("Invalid run of 'O' in number code (max 3).");

          if (count === 1) {
            if (i === 0) tokens.push("NO");
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
          if (count < 1 || count > 3) throw new Error("Invalid run of 'K' in number code (max 3).");

          ensureNEBeforeOperatorRun();
          tokens.push("KE".repeat(count)); // KE / KEKE / KEKEKE
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

      const caps = tokens.join("");
      tokenizeNanpaCaps(caps);
      return { caps };
    }

    const TOKEN_TO_DIGIT_CHAR = {
      "NI":"0","WE":"1","TE":"2","SE":"3","NA":"4",
      "LE":"5","NU":"6","ME":"7","PE":"8","JE":"9"
    };

    const TOKEN_TO_DIGIT_WORD = {
      "NI":"ijo","WE":"wan","TE":"tu","SE":"seli","NA":"awen",
      "LE":"luka","NU":"utala","ME":"mun","PE":"pipi","JE":"jo"
    };

    const WORD_FOR_NEGATIVE_SIGN = "ona";

    function nanpaCapsTokensToTpWords(tokens, { mode = "traditional" } = {}) {
      if (!tokens || tokens.length === 0) return [];

      const uniform = (mode === "uniform");
      const out = [];

      const E_WORD = uniform ? "en" : "esun";
      const E_WORD_FOR_NE_AFTER_START = uniform ? "en" : "e";
      const N_WORD = uniform ? "nena" : "nasa";

      const N_WORD_DECIMAL_POINT = uniform ? "nena" : "ni";
      const N_WORD_FRACTION = "nena";
      const N_END_WORD = "nanpa";

      let afterStartingNe = false;

      for (let i = 0; i < tokens.length; i++) {
        const t = tokens[i];

        if (t === "NE") {
          if (out.length === 0) {
            out.push("nanpa", E_WORD);
            afterStartingNe = true;
          } else {
            out.push(N_WORD, E_WORD_FOR_NE_AFTER_START);
            afterStartingNe = false;
          }
          continue;
        }

        if (DIGIT_TOKENS.has(t)) {
          afterStartingNe = false;
          const digitWord = TOKEN_TO_DIGIT_WORD[t];
          if (t === "NI" || t === "NA" || t === "NU") out.push(N_WORD, digitWord);
          else out.push(digitWord, E_WORD);
          continue;
        }

        if (t === "NO") {
          if (afterStartingNe) {
            out.push(N_WORD, WORD_FOR_NEGATIVE_SIGN);
            afterStartingNe = false;
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
          out.push("nena","open","kala","open");
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
      const join = (mode === "uniform") ? "en" : "e";
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
      const tokens = tokenizeNanpaCaps(caps);
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
          ? ["nena", "open", "kipisi", "en"]
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

      const compact = s.replace(/\s+/g, "");
      const core = compact.slice(0, -1);

      const coreUpper = core.toUpperCase();
      let caps;

      // NEW: trailing NOKE => OKN
      if (coreUpper.endsWith("NOKE")) {
        const base = coreUpper.slice(0, -4);
        if (!base) return null;
        caps = base + "OKN";
      } else {
        caps = coreUpper + "N";
      }

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

      if (s.slice(1).includes("-")) {
        throw new Error("Only one negative sign is allowed, and it must be at the start.");
      }

      const [num, den] = VULGAR_FRACTIONS.get(lastChar);
      const prefixRaw = s.slice(0, -1).trim();

      if (!prefixRaw) return `${num}/${den}`;

      const isNeg = prefixRaw.startsWith("-");
      const prefix = isNeg ? prefixRaw.slice(1).trim() : prefixRaw;

      if (!prefix) return `-${num}/${den}`;

      return isNeg ? `-${prefix}+${num}/${den}` : `${prefix}+${num}/${den}`;
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

    const DEC_DIGIT_TO_TOKEN = {
      "0": "NI", "1": "WE", "2": "TE", "3": "SE", "4": "NA",
      "5": "LE", "6": "NU", "7": "ME", "8": "PE", "9": "JE",
    };


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
      Time recognizer (HH:MM[:SS]) + caps encoder
      ============================================================ */
    function tryParseTimeParts(raw) {
      const s = String(raw ?? "").trim();
      const m = s.match(/^(\d{1,2}):([0-5]\d)(?::([0-5]\d))?$/);
      if (!m) return null;

      const hhStr = m[1];
      const mmStr = m[2];
      const ssStr = (m[3] != null) ? m[3] : null;

      const hh = parseInt(hhStr, 10);
      if (!Number.isFinite(hh) || hh < 0 || hh > 59) return null;

      return { hhStr, mmStr, ssStr };
    }

    function encodeDigitsOnly(digits) {
      const s = String(digits ?? "");
      if (!/^\d+$/.test(s)) throw new Error(`Expected only digits, got "${digits}"`);
      let out = "";
      for (const ch of s) {
        const tok = DEC_DIGIT_TO_TOKEN[ch];
        if (!tok) throw new Error(`Unsupported digit "${ch}"`);
        out += tok;
      }
      return out;
    }


    // ============================
    // Date support (YYYY{sep}MM{sep}DD)
    // ============================
    // Valid formats:
    // - YYYY-MM-DD, YYYY/MM/DD, YYYY:MM:DD
    // Constraints:
    // - YYYY exactly 4 digits (0000-9999 allowed)
    // - MM 01-12
    // - DD 01-31
    function tryParseDateParts(raw) {
      const s = normalizeDateTimeInput(raw);
      const m = s.match(/^(\d{4})([:\/-])(\d{2})\2(\d{2})$/);
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

    // Returns nanpa-caps for a valid time, else null.
    // We encode delimiters as NEKE so that:
    //  - Proper-name / caps pipeline stays consistent ("...Eke...")
    //  - We can later rewrite KE -> kolon when rendering time cartouches
    function timeStrToNanpaCaps(raw) {
      const parts = tryParseTimeParts(raw);
      if (!parts) return null;

      let caps = "NE";
      caps += encodeDigitsOnly(parts.hhStr);
      caps += "NEKE";
      caps += encodeDigitsOnly(parts.mmStr);

      if (parts.ssStr != null) {
        caps += "NEKE";
        caps += encodeDigitsOnly(parts.ssStr);
      }

      caps += "N";
      tokenizeNanpaCaps(caps); // sanity-check
      return caps;
    }

    function nanpaCapsLooksLikeTime(caps){
      let tokens;
      try { tokens = tokenizeNanpaCaps(caps); } catch { return false; }
      if (!tokens || tokens.length < 1) return false;

      // Must start NE ... end N
      if (tokens[0] !== "NE") return false;
      if (tokens[tokens.length - 1] !== "N") return false;

      // Disallow operators that cannot appear in time encoding
      for (const t of tokens){
        if (t === "NO" || t === "NONO" || t === "NONONO" || t === "NOKO" || t === "OK") return false;
        if (t === "KEKE" || t === "KEKEKE") return false;
      }

      // Parse pattern:
      // NE  (H digits: 1–2 digit tokens)
      // NE KE (delimiter)
      // (MM digits: exactly 2 digit tokens)
      // [ NE KE (delimiter) (SS digits: exactly 2 digit tokens) ]
      // N
      let i = 1;

      // hours digits: 1 or 2 digit tokens
      let hCount = 0;
      while (i < tokens.length && DIGIT_TOKENS.has(tokens[i]) && hCount < 2){
        hCount++; i++;
      }
      if (hCount < 1) return false;

      // delimiter 1
      if (tokens[i] !== "NE") return false; i++;
      if (tokens[i] !== "KE") return false; i++;

      // minutes: exactly 2 digit tokens
      if (!DIGIT_TOKENS.has(tokens[i])) return false; i++;
      if (!DIGIT_TOKENS.has(tokens[i])) return false; i++;

      // optional seconds
      if (tokens[i] === "NE"){
        i++;
        if (tokens[i] !== "KE") return false; i++;
        if (!DIGIT_TOKENS.has(tokens[i])) return false; i++;
        if (!DIGIT_TOKENS.has(tokens[i])) return false; i++;
      }

      // must now be at final N
      return i === tokens.length - 1;
    }

    function nanpaCapsDecodeTimeStrict(caps) {
      let tokens;
      try { tokens = tokenizeNanpaCaps(String(caps).trim().toUpperCase()); }
      catch { return null; }

      if (tokens[0] !== "NE") return null;
      if (tokens[tokens.length - 1] !== "N") return null;

      let i = 1;

      function readDigitChar() {
        const t = tokens[i];
        const w = TOKEN_TO_DIGIT_WORD[t];
        if (!w) return null;

        // Reverse map: token -> digit char
        // NI 0, WE 1, TE 2, SE 3, NA 4, LE 5, NU 6, ME 7, PE 8, JE 9
        const map = { NI:"0", WE:"1", TE:"2", SE:"3", NA:"4", LE:"5", NU:"6", ME:"7", PE:"8", JE:"9" };
        const ch = map[t];
        if (!ch) return null;

        i += 1;
        return ch;
      }

      // HH: 1–2 digits
      const h1 = readDigitChar(); if (h1 == null) return null;
      let h2 = null;
      if (i < tokens.length && DIGIT_TOKENS.has(tokens[i])) h2 = readDigitChar();
      const hhStr = (h2 == null) ? h1 : (h1 + h2);

      // delimiter 1
      if (tokens[i] !== "NE") return null; i++;
      if (tokens[i] !== "KE") return null; i++;

      // MM: exactly 2 digits
      const m1 = readDigitChar(); if (m1 == null) return null;
      const m2 = readDigitChar(); if (m2 == null) return null;
      const mmStr = m1 + m2;

      // optional seconds
      let ssStr = null;
      if (tokens[i] === "NE") {
        i++;
        if (tokens[i] !== "KE") return null; i++;
        const s1 = readDigitChar(); if (s1 == null) return null;
        const s2 = readDigitChar(); if (s2 == null) return null;
        ssStr = s1 + s2;
      }

      // must end at final N
      if (i !== tokens.length - 1) return null;

      // Range check
      const hh = parseInt(hhStr, 10);
      const mm = parseInt(mmStr, 10);
      const ss = (ssStr == null) ? null : parseInt(ssStr, 10);

      if (!(hh >= 0 && hh <= 59)) return null;
      if (!(mm >= 0 && mm <= 59)) return null;
      if (ss != null && !(ss >= 0 && ss <= 59)) return null;

      return { hh, mm, ss };
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
      return nanpaCapsIsValidTime(caps) || nanpaCapsIsValidDate(caps);
    }

    function findTimeSequencesWithCaps(text) {
      const s = String(text ?? "");
      if (!s) return [];

      // No lookbehind: capture a non-digit boundary (or start-of-string) in group 1,
      // and the time itself in group 2.
      const re = /(^|[^0-9])(\d{1,2}:[0-5]\d(?::[0-5]\d)?)(?!\d)/g;

      const out = [];
      let m;
      while ((m = re.exec(s)) !== null) {
        // With the boundary-capture regex, the time is in group 2.
        const lead = m[1] ?? "";
        const raw = m[2];
        if (!raw) continue;

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
      // Accept "-", "/", ":" (and unicode variants after normalization occurs inside dateStrToNanpaCaps).
      const re = /(^|[^0-9])(\d{4}[:\/-]\d{2}[:\/-]\d{2})(?!\d)/g;

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

      function stripFinalTerminator(segCaps) {
        if (!segCaps) return segCaps;
        if (!segCaps.endsWith("N")) throw new Error(`Segment caps did not end with 'N': ${segCaps}`);
        return segCaps.slice(0, -1);
      }

      function encodeSingleNumberSegment(segment, includeInitialNe) {
        let seg = String(segment).trim();
        if (seg === "") throw new Error(`Empty numeric segment in ${s}`);

        if (seg.slice(0, 1).toUpperCase() === "N") {
          seg = seg.slice(1).trim();
          if (seg === "") throw new Error(`Missing numeric part after leading 'N' prefix in ${s}`);
        }

        const out = [];
        if (includeInitialNe) out.push("NE");

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
              (last === "K" || last === "T") ? 1 :
              (last === "M") ? 2 : 3;
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
            if (/\d/.test(ch)) { out.push(DEC_DIGIT_TO_TOKEN[ch]); continue; }
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

          for (const d of groups[0]) out.push(DEC_DIGIT_TO_TOKEN[d]);

          const nGroups = groups.length;
          const lastNonTrailingIdx = nGroups - trailingZeroGroups;

          for (let idx = 1; idx < lastNonTrailingIdx; idx++) {
            out.push("NE","KE");
            for (const d of groups[idx]) out.push(DEC_DIGIT_TO_TOKEN[d]);
          }

          if (trailingZeroGroups > 0) {
            out.push("NE");
            let remaining = trailingZeroGroups;
            while (remaining > 0) {
              const chunk = Math.min(3, remaining);
              if (out[out.length - 1] !== "NE") out.push("NE");
              out.push("KE".repeat(chunk));
              remaining -= chunk;
              if (remaining > 0) out.push("NE");
            }
          }
        }

        if (hasDecimal) {
          out.push("NO","NE");

          if (!fracPart) throw new Error(`Missing fraction digits after '.' in "${s}"`);

          for (const ch of fracPart) {
            if (/\d/.test(ch)) { out.push(DEC_DIGIT_TO_TOKEN[ch]); continue; }
            if (ch === "_") { pushNene(); continue; }
            if (ch === ",") { pushNene(); continue; }
            if (ch === " " || ch === "-") { pushNene(); continue; }
            throw new Error(`Unsupported character "${ch}" in fraction part of "${s}"`);
          }
        }

        if (magnitudeSuffixKeCount > 0) {
          out.push("NE");
          let remaining = magnitudeSuffixKeCount;
          while (remaining > 0) {
            const chunk = Math.min(3, remaining);
            if (out[out.length - 1] !== "NE") out.push("NE");
            out.push("KE".repeat(chunk));
            remaining -= chunk;
            if (remaining > 0) out.push("NE");
          }
        }

        out.push("N");
        return out.join("");
      }

      if (raw.includes("+")) {
        const [left, right] = raw.split("+", 2);
        let leftCaps = encodeSingleNumberSegment(left, true);

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
        let numCaps = encodeSingleNumberSegment(num, true);
        let denCaps = encodeSingleNumberSegment(den, false);
        numCaps = stripFinalTerminator(numCaps);
        return numCaps + "NONO" + denCaps;
      }

      return encodeSingleNumberSegment(raw, true);
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

      const baseCaps = looksLikeNanpaCaps(normalized)
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

      const vulgarChars = "¼½¾⅐⅑⅒⅓⅔⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞↉";
      const re = new RegExp(
        String.raw`(?<![A-Za-z])` +
        String.raw`(` +
          String.raw`-?\s*\d*\s*[${vulgarChars}]` +
          "|" +
          String.raw`-?\s*\d[\d, _-]*\s*\+\s*\d[\d, _-]*\s*\/\s*\d[\d, _-]*` +
          "|" +
          String.raw`-?\s*\d[\d, _-]*\s*\/\s*\d[\d, _-]*` +
          "|" +
          String.raw`-?\s*(?:\d[\d, _-]*|\.\d+)(?:\.\d[\d, _-]*)?(?:\s*[kKtTmMbB])?` +
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

      const re = /#~[A-Za-z]+/g;
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

    function findNanpaLinjanProperNameSequencesWithCaps(text) {
      const s = String(text ?? "");
      if (!s) return [];

      const re = /(^|[^A-Za-z])((?:ne)[A-Za-z]*(?:\s+[A-Za-z]{2,}){0,20}[A-Za-z]*[nN])(?![A-Za-z])/gi;

      const hits = [];
      let m;

      while ((m = re.exec(s)) !== null) {
        const lead = m[1] ?? "";
        const rawMatch = m[2] ?? "";
        if (!rawMatch) continue;

        const start = (m.index | 0) + lead.length;
        const end = start + rawMatch.length;

        const compact = rawMatch.replace(/\s+/g, "");
        if (compact.length < 5) continue;

        if (!isValidNanpaLinjanProperName(compact)) {
          // The greedy {0,20} repetition swallowed multiple identifiers (or TP
          // words between them) into one invalid span — this happens when several
          // proper names appear on the same line separated by plain TP words.
          // Recovery: walk the space boundaries of rawMatch from shortest to
          // longest prefix, emit the first valid sub-name found, then back the
          // regex up to start+1 so the remaining names in the region are picked
          // up on the next iterations.
          const wsPositions = [];
          for (let wi = 0; wi < rawMatch.length; wi++) {
            if (rawMatch[wi] === ' ' || rawMatch[wi] === '\t') wsPositions.push(wi);
          }
          for (const wsIdx of wsPositions) {
            const prefix = rawMatch.slice(0, wsIdx);
            const prefixCompact = prefix.replace(/\s+/g, '');
            if (prefixCompact.length < 5) continue;
            if (!isValidNanpaLinjanProperName(prefixCompact)) continue;
            // Valid sub-name found — emit it using the same logic as the main path.
            let subCore = prefixCompact.slice(0, -1);
            let subHasPercent = false;
            if (/noke$/i.test(subCore)) {
              subHasPercent = true;
              subCore = subCore.slice(0, -4);
              if (subCore.length < 2) break;
            }
            const subCoreCaps = subCore.toUpperCase();
            const subCaps = subHasPercent ? (subCoreCaps + 'OKN') : (subCoreCaps + 'N');
            hits.push({ kind: 'name', index: start, end: start + prefix.length, caps: subCaps });
            break;
          }
          // Back up so subsequent proper names in this region are not skipped.
          re.lastIndex = start + 1;
          continue;
        }

       // compact ends with 'n' by regex + validation
        let core = compact.slice(0, -1);

        // NEW: if the identifier ends with "...noken" (i.e. core ends with "noke"),
        // treat that as the percent marker and inject OK into caps.
        // We also remove the trailing "noke" from the core so it doesn't get treated
        // as part of the numeric name-encoding.
        let hasPercent = false;
        if (/noke$/i.test(core)) {
          hasPercent = true;
          core = core.slice(0, -4); // drop the trailing "noke"
          if (core.length < 2) continue; // avoid degenerate cases
        }

        // Build caps. If percent, inject OK before final N.
        const coreCaps = core.toUpperCase();
        const caps = hasPercent ? (coreCaps + "OKN") : (coreCaps + "N");

        hits.push({ kind: "name", index: start, end, caps });

      }

      return hits;
    }

    /* ============================================================
       Nanpa-linja-n TP number-phrase scanner in plain text
       ============================================================ */
    function findNanpaLinjanTpPhraseSequences(text) {
      const s = String(text ?? "");
      if (!s) return [];

      const tokens = [];
      const reTok = /\S+/g;
      let m;
      while ((m = reTok.exec(s)) !== null) {
        const raw = m[0];
        tokens.push({
          raw,
          norm: normalizeTpWord(raw),
          start: m.index,
          end: (m.index + raw.length)
        });
      }
      if (tokens.length < 3) return [];

      const digitWords = new Set(
        Object.values(TOKEN_TO_DIGIT_WORD).filter(w => NANPA_LINJA_N_WORD_TO_CP[w] != null)
      );

      const hits = [];
      for (let i = 0; i < tokens.length - 2; i++) {
        if (tokens[i].norm !== "nanpa") continue;
        const n1 = tokens[i + 1]?.norm;
        if (!(n1 === "esun" || n1 === "en")) continue;

        let bestJ = -1;
        let bestWords = null;

        for (let j = i + 2; j < tokens.length; j++) {
          if (tokens[j].norm !== "nanpa") continue;

          const words = [];
          let allOk = true;
          let hasDigit = false;

          for (let k = i; k <= j; k++) {
            const w = tokens[k].norm;
            if (!w) { allOk = false; break; }
            if (NANPA_LINJA_N_WORD_TO_CP[w] == null) { allOk = false; break; }
            if (k >= i + 2 && k <= j - 1 && digitWords.has(w)) hasDigit = true;
            words.push(w);
          }

          if (!allOk || !hasDigit) continue;

          bestJ = j;
          bestWords = words;
        }

        if (bestJ >= 0 && bestWords) {
          hits.push({
            kind: "tpPhrase",
            index: tokens[i].start,
            end: tokens[bestJ].end,
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
        (h.caps || (Array.isArray(h.words) && h.words.length > 0))
      );

      function priority(kind) {
        if (kind === "decimal") return 4;
        if (kind === "time") return 4;
        if (kind === "date") return 4;
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

      return out;
    }

    /* ============================
       TP phrase helpers
       ============================ */
    function tryParseNanpaLinjanTpPhraseWords(inputWords) {
      const words = Array.from(inputWords ?? []).map(normalizeTpWord).filter(Boolean);

      if (words.length < 3) return null;
      if (words[0] !== "nanpa") return null;
      if (!(words[1] === "esun" || words[1] === "en")) return null;
      if (words[words.length - 1] !== "nanpa") return null;

      for (const w of words) {
        if (NANPA_LINJA_N_WORD_TO_CP[w] == null) return null;
      }

      const digitWords = new Set(
        Object.values(TOKEN_TO_DIGIT_WORD).filter(w => NANPA_LINJA_N_WORD_TO_CP[w] != null)
      );

      const payload = words.slice(2, -1);
      const hasDigit = payload.some(w => digitWords.has(w));
      if (!hasDigit) return null;

      return { words };
    }

    function nanpaLinjanWordsToCodepoints(words, { mode = "traditional" } = {}) {
      const cps = [];
      for (const w0 of (words ?? [])) {
        const w = normalizeTpWord(w0);
        const cp = NANPA_LINJA_N_WORD_TO_CP[w];
        if (cp == null) return null;
        cps.push(cp);
      }
      if (mode === "uniform") return uniformizeNanpaLinjanCartoucheCps(cps);
      return cps;
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
          out.push({ kind: "quote", value: s.slice(i + 1, j) });
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



    function computeManualCartoucheTallyGroups(ctx, innerCps, manualTallies, { fontPx, runX, baselineY, cartoucheBottomY }) {
      const tallies = Array.from(manualTallies ?? []);
      const px = Math.max(8, Number(fontPx ?? 56));
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
      const yTop = bottomRuleY;
      const yBottom = yTop + h;

      const groups = [];
      for (let i = 0; i < innerCps.length; i++) {
        const count = Math.max(0, Math.min(8, Number(tallies[i] || 0) | 0));
        const ch = String.fromCodePoint(innerCps[i]);
        const advance = Math.max(1, ctx.measureText(ch).width || px * 0.7);

        if (count > 0) {
          const centerX = penX + advance / 2;
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

    function drawManualCartoucheTallies(ctx, innerCps, manualTallies, { fontPx, fontFamily, runX, baselineY, cartoucheW, cartoucheH, padPx, haloEnabled, haloCss, fgCss, cartoucheRunWidth = null , cartoucheBottomY = null}) {
      const tallies = Array.from(manualTallies ?? []);
      if (!tallies.some(n => Number(n) > 0)) return;

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
        cartoucheBottomY: detectedBottomY
      });
      if (!groups.length) { ctx.restore(); return; }

      // Keep the halo backing attached to the cartouche bottom rule, but start the
      // visible tally strokes slightly below that rule so they do not eat into it.
      const tallyStrokeTopInset = 0;

      if (haloEnabled) {
        const haloW = Math.max(1, haloWidthForPx(px));
        const padX = haloW * 0.85;
        const padBottom = haloW * 0.85;

        const radius = Math.max(
          1.25,
          Math.min(haloW, px * 0.045)
        );

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
      //ctx.lineCap = "round";
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

    function renderFontCartoucheToCanvas(canvas, innerCps, { fontPx, padPx, fontFamily, fgCss, haloEnabled, haloCss, manualTallies = null }) {
      if (!canvas) throw new Error("renderFontCartoucheToCanvas: canvas missing");
      if (!innerCps || innerCps.length === 0) return { w: 0, h: 0, baselineY: 0 };

      const normalizedTallyInput = normalizeManualTallyInputForCartouche(innerCps, manualTallies);
      const renderInnerCps = normalizedTallyInput.cps;
      const renderManualTallies = normalizedTallyInput.manualTallies;
      if (!renderInnerCps || renderInnerCps.length === 0) return { w: 0, h: 0, baselineY: 0 };

      const px = fontPx;
      const pad = padPx;
      const fam = fontFamily || FONT_FAMILY_TEXT;
      const hasManualTallies = !!(renderManualTallies && Array.isArray(renderManualTallies) && renderManualTallies.some(n => Number(n) > 0));

      const run =
        String.fromCodePoint(CARTOUCHE_START_CP) +
        renderInnerCps.map(cp => String.fromCodePoint(cp)).join("") +
        String.fromCodePoint(CARTOUCHE_END_CP);

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

      const w = Math.max(1, Math.ceil(left + right + pad * 2 + haloW * 2 + tallySideExtra * 2));
      const h = Math.max(1, Math.ceil(ascent + descent + pad * 2 + haloW * 2 + tallyBottomExtra));

      canvas.width = w;
      canvas.height = h;

      const ctx2 = canvas.getContext("2d", { alpha: true , willReadFrequently: true});
      ctx2.clearRect(0, 0, w, h);
      ctx2.textBaseline = "alphabetic";
      ctx2.font = `${px}px "${fam}"`;
      setTextQuality(ctx2);

      const x = pad + left + haloW + tallySideExtra;
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

      if (hasManualTallies) {
        drawManualCartoucheTallies(ctx2, renderInnerCps, renderManualTallies, {
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
          cartoucheBottomY: cleanCartoucheBottomY
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
        drawX: x,
        hasManualTallies,
        renderInnerCps: Array.from(renderInnerCps),
        renderManualTallies: Array.isArray(renderManualTallies) ? renderManualTallies.slice() : null
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

    function makeCartoucheElementFromCodepoints(elements, cps, { fontPx, fontFamily, fgCss, sourceText = null, sourceStart = null, sourceEnd = null, sourceKind = null, sourceSegmentIndex = null, repairQuotedLatinLeftEdge = false, manualTallies = null } = {}) {
      if (!cps || cps.length === 0) return;
      pushGapIfNeeded(elements, cartoucheLeadGapForPx(fontPx));

      const cart = document.createElement("canvas");
      const padPx = cartouchePadForPx(fontPx);

      const haloEnabled = getHaloEnabled();
      const haloCss = getHaloHex();

      const r = renderFontCartoucheToCanvas(cart, cps, { fontPx, padPx, fontFamily, fgCss, haloEnabled, haloCss, manualTallies });
      if ((r.w | 0) <= 0 || (r.h | 0) <= 0) return;

      let finalCanvas = cart;
      if (repairQuotedLatinLeftEdge) {
        finalCanvas = repairQuotedCartoucheLeftEdgeWithLipuDonor(cart, cps, { fontPx, padPx, fontFamily, fgCss, haloEnabled, haloCss }) || cart;
      }

      const finalW = finalCanvas.width | 0;
      const finalH = finalCanvas.height | 0;
      if (finalW <= 0 || finalH <= 0) return;

      const baselineY = Math.min(finalH, r.baselineY | 0);
      const ascent = Math.min(finalH, r.inkAscent ?? baselineY);
      const descent = Math.max(0, Math.min(finalH - ascent, r.inkDescent ?? (finalH - baselineY)));

      elements.push({
        type: "cartouche",
        cps: Array.from(cps),
        canvas: finalCanvas,
        w: finalW,
        h: finalH,
        baselineY,
        ascent,
        descent,
        fontFamily: fontFamily || FONT_FAMILY_TEXT,
        repairQuotedLatinLeftEdge: !!repairQuotedLatinLeftEdge,
        manualTallies: Array.isArray(manualTallies) ? manualTallies.slice() : null,
        sourceText: (typeof sourceText === 'string') ? sourceText : null,
        sourceStart: Number.isFinite(Number(sourceStart)) ? Number(sourceStart) : null,
        sourceEnd: Number.isFinite(Number(sourceEnd)) ? Number(sourceEnd) : null,
        sourceKind: (typeof sourceKind === 'string') ? sourceKind : null,
        sourceSegmentIndex: Number.isFinite(Number(sourceSegmentIndex)) ? Number(sourceSegmentIndex) : null
      });
    }

    function makeRunElementFromCodepoints(elements, cps, { fontPx, fontFamily, sourceText = null, sourceStart = null, sourceEnd = null, sourceKind = null, sourceSegmentIndex = null } = {}) {
      if (!cps || cps.length === 0) return;
      pushGapIfNeeded(elements, wordGapForPx(fontPx));

      elements.push({
        type: "run",
        cps: Array.from(cps),
        px: fontPx,
        fontFamily: fontFamily || FONT_FAMILY_TEXT,
        sourceText: (typeof sourceText === 'string') ? sourceText : null,
        sourceStart: Number.isFinite(Number(sourceStart)) ? Number(sourceStart) : null,
        sourceEnd: Number.isFinite(Number(sourceEnd)) ? Number(sourceEnd) : null,
        sourceKind: (typeof sourceKind === 'string') ? sourceKind : null,
        sourceSegmentIndex: Number.isFinite(Number(sourceSegmentIndex)) ? Number(sourceSegmentIndex) : null
      });
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
      const rawTokens = [];
      const tokenRe = /\S+/g;
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
        pushGapIfNeeded(elements, wordGapForPx(fontPx));
        elements.push({ type: "glyph", cp, px: fontPx, fontFamily: FONT_FAMILY_TEXT, sourceText: String(ch), sourceStart: sourceBaseStart + start, sourceEnd: sourceBaseStart + end, sourceKind, sourceSegmentIndex });
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
          const idCps = tryDecodeNanpaLinjanIdentifierToCodepoints(trimmed, { mode }) ?? tryDecodeNanpaLinjanIdentifierToCodepoints(trimmed.replace(/\s+/g, ""), { mode });
          if (idCps && idCps.length) {
            makeCartoucheElementFromCodepoints(elements, idCps, { fontPx, fontFamily: FONT_FAMILY_CARTOUCHE, sourceText: trimmed, sourceStart: sourceBaseStart + trimmedStart, sourceEnd: sourceBaseStart + trimmedEnd, sourceKind, sourceSegmentIndex });
            for (let j = 0; j < trail.length; j++) emitPunctGlyph(trail[j], tokMeta.end - trail.length + j, tokMeta.end - trail.length + j + 1);
            continue;
          }
        }

        if (trimmed && /[0-9]/.test(trimmed)) {
          const timeCandidate = trimmed.replace(/"\s*:\s*"/g, ":").replace(/"\s*:\s*/g, ":").replace(/\s*:\s*"/g, ":");
          const timeCaps = (typeof timeStrToNanpaCaps === "function") ? timeStrToNanpaCaps(timeCandidate) : null;
          if (timeCaps) {
            const cps = nanpaCapsToNanpaLinjanCodepoints(timeCaps, { mode, isTime: true });
            if (cps && cps.length) {
              makeCartoucheElementFromCodepoints(elements, cps, { fontPx, fontFamily: FONT_FAMILY_CARTOUCHE, sourceText: trimmed, sourceStart: sourceBaseStart + trimmedStart, sourceEnd: sourceBaseStart + trimmedEnd, sourceKind, sourceSegmentIndex });
              for (let j = 0; j < trail.length; j++) emitPunctGlyph(trail[j], tokMeta.end - trail.length + j, tokMeta.end - trail.length + j + 1);
              continue;
            }
          }
          try {
            const caps = decimalStringToCaps(trimmed, { thousandsChar: ",", groupFractionTriplets: true, fractionGroupSize: 3, mixedStyle });
            const cps = nanpaCapsToNanpaLinjanCodepoints(caps, { mode });
            if (cps && cps.length) {
              makeCartoucheElementFromCodepoints(elements, cps, { fontPx, fontFamily: FONT_FAMILY_CARTOUCHE, sourceText: trimmed, sourceStart: sourceBaseStart + trimmedStart, sourceEnd: sourceBaseStart + trimmedEnd, sourceKind, sourceSegmentIndex });
              for (let j = 0; j < trail.length; j++) emitPunctGlyph(trail[j], tokMeta.end - trail.length + j, tokMeta.end - trail.length + j + 1);
              continue;
            }
          } catch {}
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
          pushGapIfNeeded(elements, wordGapForPx(fontPx));
          elements.push({ type: "glyph", cp: WORD_TO_UCSUR_CP[glyphKey], px: fontPx, fontFamily: FONT_FAMILY_TEXT, sourceText: trimmed, sourceStart: sourceBaseStart + trimmedStart, sourceEnd: sourceBaseStart + trimmedEnd, sourceKind, sourceSegmentIndex });
        } else if (trimmed && getShowUnknownText()) {
          makeLiteralTextElement(elements, trimmed, {
            fontPx,
            fontFamily: FONT_FAMILY_UNKNOWN || FONT_FAMILY_LITERAL,
            addLeadingGap: true,
            isUnrecognized: true,
            unknownDisplay: getUnknownTextDisplay(),
            sourceText: trimmed,
            sourceStart: sourceBaseStart + trimmedStart,
            sourceEnd: sourceBaseStart + trimmedEnd,
            sourceKind,
            sourceSegmentIndex,
          });
        }

        for (let j = 0; j < trail.length; j++) emitPunctGlyph(trail[j], tokMeta.end - trail.length + j, tokMeta.end - trail.length + j + 1);
      }
    }

    function parseTextSegmentToElements(segmentText, elements, { fontPx, sourceBaseStart = 0, sourceKind = 'text', sourceSegmentIndex = null, mixedStyle = "short" }) {
      const mode = getNanpaLinjanMode();
      const s = String(segmentText ?? "");
      if (!s.trim()) return;

      const timeHits = findTimeSequencesWithCaps(s);
      const dateHits = findDateSequencesWithCaps(s);
      const decHits = findDecimalSequencesWithCaps(s, { thousandsChar: ",", groupFractionTriplets: true, fractionGroupSize: 3, mixedStyle });
      const codeHits = findNumberCodeSequencesWithCaps(s);
      const nameHits = findNanpaLinjanProperNameSequencesWithCaps(s);
      const phraseHits = findNanpaLinjanTpPhraseSequences(s);

      const hits = mergeAndGreedyFilterHits([...timeHits, ...dateHits, ...decHits, ...phraseHits, ...codeHits, ...nameHits]);

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
        if (h.kind === "tpPhrase") {
          const cps = nanpaLinjanWordsToCodepoints(h.words, { mode });
          if (cps && cps.length) {
            makeCartoucheElementFromCodepoints(elements, cps, { fontPx, fontFamily: FONT_FAMILY_NUMBER, fgCss, sourceText: matchText, sourceStart: sourceBaseStart + a, sourceEnd: sourceBaseStart + b, sourceKind, sourceSegmentIndex });
          } else {
            renderTpWordsFromText(matchText, elements, { fontPx, mode, sourceBaseStart: sourceBaseStart + a, sourceKind, sourceSegmentIndex, mixedStyle });
          }
        } else {
          const isTimeLike = (h.kind === "time") || (h.kind === "date") || nanpaCapsIsValidTimeOrDate(h.caps);
          const cps = nanpaCapsToNanpaLinjanCodepoints(h.caps, { mode, isTime: isTimeLike });
          if (cps && cps.length) {
            makeCartoucheElementFromCodepoints(elements, cps, { fontPx, fontFamily: FONT_FAMILY_NUMBER, fgCss, sourceText: matchText, sourceStart: sourceBaseStart + a, sourceEnd: sourceBaseStart + b, sourceKind, sourceSegmentIndex });
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

    function parseQuoteSegmentToElements(quoteContent, elements, { fontPx, sourceBaseStart = 0, sourceKind = 'quote', sourceSegmentIndex = null }) {
      const literal = unescapeQuotedText(quoteContent);

      if (literal.length === 0) return;

      const fgCss = getFgHex();
      const mode = getNanpaLinjanMode();
      const cartoucheInnerCps = tryExtractFullUcsurCartoucheCodepoints(literal);

      if (cartoucheInnerCps && isNumericNanpaLinjanCartoucheInnerCps(cartoucheInnerCps, { mode })) {
        makeCartoucheElementFromCodepoints(elements, cartoucheInnerCps, {
          fontPx,
          fontFamily: FONT_FAMILY_NUMBER,
          fgCss,
          sourceText: String(quoteContent ?? ''),
          sourceStart: sourceBaseStart,
          sourceEnd: sourceBaseStart + String(quoteContent ?? '').length,
          sourceKind,
          sourceSegmentIndex,
        });
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
      });
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
            fontFamily: FONT_FAMILY_TEXT,
            fgCss: getFgHex(),
            repairQuotedLatinLeftEdge: true,
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
     
      try {
        const dateCaps = dateStrToNanpaCaps(content);
        if (dateCaps != null) {
          const cpsDate = nanpaCapsToNanpaLinjanCodepoints(dateCaps, { mode, isTime: true });
          if (cpsDate && cpsDate.length) {
            makeCartoucheElementFromCodepoints(elements, cpsDate, { fontPx, fontFamily: FONT_FAMILY_NUMBER, fgCss, sourceText: content, sourceStart: sourceBaseStart, sourceEnd: sourceBaseStart + content.length , sourceKind, sourceSegmentIndex });
            return;
          }
        }

        const timeCaps = timeStrToNanpaCaps(content);
        if (timeCaps != null) {
          const cpsTime = nanpaCapsToNanpaLinjanCodepoints(timeCaps, { mode, isTime: true });
          if (cpsTime && cpsTime.length) {
            makeCartoucheElementFromCodepoints(elements, cpsTime, { fontPx, fontFamily: FONT_FAMILY_NUMBER, fgCss, sourceText: content, sourceStart: sourceBaseStart, sourceEnd: sourceBaseStart + content.length , sourceKind, sourceSegmentIndex });
            return;
          }
        }

        const caps = decimalStringToCaps(content, { thousandsChar: ",", groupFractionTriplets: true, fractionGroupSize: 3, mixedStyle });
        const cps = nanpaCapsToNanpaLinjanCodepoints(caps, { mode });
        if (cps && cps.length) {
          makeCartoucheElementFromCodepoints(elements, cps, { fontPx, fontFamily: FONT_FAMILY_NUMBER, fgCss, sourceText: content, sourceStart: sourceBaseStart, sourceEnd: sourceBaseStart + content.length , sourceKind, sourceSegmentIndex });
          return;
        }
      } catch {}

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
        if (cps) makeCartoucheElementFromCodepoints(elements, cps, {
          fontPx,
          fontFamily: FONT_FAMILY_NUMBER,
          fgCss,
          sourceText: content,
          sourceStart: sourceBaseStart,
          sourceEnd: sourceBaseStart + content.length,
          sourceKind,
          sourceSegmentIndex
        });
        return;
      }

      const idCps =
        tryDecodeNanpaLinjanIdentifierToCodepoints(content, { mode }) ??
        tryDecodeNanpaLinjanIdentifierToCodepoints(content.replace(/\s+/g, ""), { mode });

      if (idCps && idCps.length) {
        makeCartoucheElementFromCodepoints(elements, idCps, { fontPx, fontFamily: FONT_FAMILY_NUMBER, fgCss, sourceText: content, sourceStart: sourceBaseStart, sourceEnd: sourceBaseStart + content.length , sourceKind, sourceSegmentIndex });
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
      let s = preprocessTextAliases(line);

      const segs = splitLineIntoSegments(s);
      const elements = [];

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
          parseQuoteSegmentToElements(seg.value, elements, {
            fontPx,
            sourceBaseStart: 0,
            sourceKind,
            sourceSegmentIndex
          });
        }
      }

      while (elements.length > 0 && elements[elements.length - 1].type === "gap") elements.pop();
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

    function makeLiteralTextElement(elements, text, { fontPx, fontFamily, addLeadingGap = true, isQuoted = false, isUnrecognized = false, unknownDisplay = null, sourceText = null, sourceStart = null, sourceEnd = null, sourceKind = null, sourceSegmentIndex = null } = {}) {
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
            const g = measureGlyph(ctx, el.cp, el.px ?? fontPx, fam);
            measuredEls.push({ ...el, m: g });
            w += g.w;

            if (g.ascent + haloExtra > maxAscent) maxAscent = g.ascent + haloExtra;
            if (g.descent + haloExtra > maxDescent) maxDescent = g.descent + haloExtra;
            continue;
          }

          if (el.type === "run") {
            const fam = el.fontFamily || FONT_FAMILY_TEXT;
            const r = measureRun(ctx, el.cps, el.px ?? fontPx, fam);
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
            const capD = Math.ceil(fontPx * (hasManualTallies ? 0.58 : 0.20)) + allowance;

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
            const ch = String.fromCodePoint(el.cp);

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
            const chars = (el.cps ?? []).map(cp => String.fromCodePoint(cp)).join("");

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

  class RendererInstance {
    constructor(config = {}) {
      this.config = config || {};
    }

    async parseInput({ input }) {
      await ensureCore();
      return { ast: astFromInput(input), diagnostics: [] };
    }

    async buildRenderPlan({ input, ast, layout = {}, paint = {}, parser = {}, fonts = {} }) {
      await ensureCore();
      const effectiveAst = ast || astFromInput(input || '');
      const config = { ...this.config, layout: { ...(this.config.layout || {}), ...layout }, paint: { ...(this.config.paint || {}), ...paint }, parser: { ...(this.config.parser || {}), ...parser }, fonts: { ...(this.config.fonts || {}), ...fonts, roles: { ...((this.config.fonts || {}).roles || {}), ...((fonts || {}).roles || {}) } } };
      return await withScopedRenderConfig(config, async () => {
        if (typeof __bridgeFontsReadyForPx === 'function') await __bridgeFontsReadyForPx(config?.layout?.fontPx ?? (__bridgeGetFontPx ? __bridgeGetFontPx() : 56));
        if (typeof __bridgeWarmUpCanvasFontsOnce === 'function') __bridgeWarmUpCanvasFontsOnce();
        const linesElements = await astToLineElements(effectiveAst, config);
        const plan = buildMeasuredRenderPlan(linesElements, config);
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
      const config = { ...this.config, ...opts, layout: { ...(this.config.layout || {}), ...(opts.layout || {}) }, paint: { ...(this.config.paint || {}), ...(opts.paint || {}) }, parser: { ...(this.config.parser || {}), ...(opts.parser || {}) }, fonts: { ...(this.config.fonts || {}), ...(opts.fonts || {}), roles: { ...((this.config.fonts || {}).roles || {}), ...(((opts.fonts || {}).roles) || {}) } } };
      return await renderAstToNewCanvas(astFromInput(opts.input || ''), config);
    }

    async renderTextToCanvas(opts = {}) {
      const rendered = await this.renderTextToNewCanvas(opts);
      await renderBlit(opts.canvas, opts.x, opts.y, rendered);
      return rendered;
    }

    async renderUcsurToNewCanvas(opts = {}) {
      await ensureCore();
      const config = { ...this.config, ...opts, layout: { ...(this.config.layout || {}), ...(opts.layout || {}) }, paint: { ...(this.config.paint || {}), ...(opts.paint || {}) }, parser: { ...(this.config.parser || {}), ...(opts.parser || {}) }, fonts: { ...(this.config.fonts || {}), ...(opts.fonts || {}), roles: { ...((this.config.fonts || {}).roles || {}), ...(((opts.fonts || {}).roles) || {}) } } };
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
    "NI": "0", "WE": "1", "TE": "2", "SE": "3", "NA": "4",
    "LE": "5", "NU": "6", "ME": "7", "PE": "8", "JE": "9",
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

  const _NP_NANPA_LINJA_N_WORD_TO_CP = {
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
  const _NP_CP_EN    = _NP_NANPA_LINJA_N_WORD_TO_CP["en"];

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

  const _NP_DIGIT_TOKENS = new Set(["NI","WE","TE","SE","NA","LE","NU","ME","PE","JE"]);
  const _NP_TOKEN_PREFIXES = ["KEKEKE","KEKE","KE","NONONO","NONO","NOKO","OK","NE","NO"];

  const _NP_NUMBER_CODE_LETTER_TO_PAIR = {
    "I":"NI","W":"WE","T":"TE","S":"SE","A":"NA",
    "L":"LE","U":"NU","M":"ME","P":"PE","J":"JE"
  };

  const _NP_TOKEN_TO_DIGIT_WORD = {
    "NI":"ijo","WE":"wan","TE":"tu","SE":"seli","NA":"awen",
    "LE":"luka","NU":"utala","ME":"mun","PE":"pipi","JE":"jo"
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

  const _NP_DEC_DIGIT_TO_TOKEN = {
    "0": "NI", "1": "WE", "2": "TE", "3": "SE", "4": "NA",
    "5": "LE", "6": "NU", "7": "ME", "8": "PE", "9": "JE",
  };

  function _npNormalizeTpWord(raw) {
    return String(raw ?? "").toLowerCase().replace(/[^a-z]/g, "");
  }

  function _npUniformizeNanpaLinjanCartoucheCps(cps) {
    const a = Array.from(cps ?? []);
    if (a.length === 0) return a;

    for (let i = 0; i < a.length; i++) {
      const cp = a[i];
      if (cp === _NP_CP_NANPA) {
        if (i !== 0 && i !== a.length - 1) a[i] = _NP_CP_NENA;
        continue;
      }
      if (_NP_UNIFORM_TO_NENA.has(cp)) { a[i] = _NP_CP_NENA; continue; }
      if (_NP_UNIFORM_TO_EN.has(cp))   { a[i] = _NP_CP_EN; continue; }
    }
    return a;
  }

  function _npNanpaCapsHasAtLeastOneDigitToken(tokens) {
    for (const t of (tokens ?? [])) {
      if (_NP_DIGIT_TOKENS.has(t)) return true;
    }
    return false;
  }

  function _npTokenizeNanpaCaps(caps) {
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
        if (_NP_DIGIT_TOKENS.has(two)) { tokens.push(two); i += 2; continue; }
      }

      throw new Error(`Invalid tokenization at position ${i} in caps string "${caps}"`);
    }

    tokens.push("N");
    return tokens;
  }

  function _npIsValidNanpaLinjanProperName(raw) {
    const s = String(raw ?? "").replace(/\s+/g, "");
    if (!s) return false;
    if (!/^[a-zA-Z]+$/.test(s)) return false;
    if (!/[nN]$/.test(s)) return false;

    const core = s.slice(0, -1);
    if (core.length < 2 || (core.length % 2) !== 0) return false;

    const caps = core.toUpperCase() + "N";
    if (!caps.startsWith("NE")) return false;

    try { _npTokenizeNanpaCaps(caps); return true; }
    catch { return false; }
  }

  function _npNormalizeNumberCodeInput(raw) {
    return String(raw ?? "").trim().replace(/\s+/g, "");
  }

  function _npTryParseNanpaLinjanNumberCodeToCaps(raw) {
    const s0 = _npNormalizeNumberCodeInput(raw);
    if (!s0) return null;
    if (!s0.toUpperCase().startsWith("#~")) return null;

    let body = s0.slice(2).toUpperCase();
    if (!body) throw new Error("Number code '#~' must have letters after it.");
    if (!/^[A-Z]+$/.test(body)) throw new Error("Number code may only contain letters A–Z after '#~'.");

    let hasPercent = false;
    if (body.endsWith("OK")) {
      hasPercent = true;
      body = body.slice(0, -2);
      if (!body) throw new Error("Number code '#~' cannot be only 'OK' (no numeric content).");
    }

    const tokens = ["NE"];
    let i = 0;

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

      if (ch === "O") {
        let j = i;
        while (j < body.length && body[j] === "O") j++;
        const count = j - i;
        if (count < 1 || count > 3) throw new Error("Invalid run of 'O' in number code (max 3).");

        if (count === 1) {
          if (i === 0) tokens.push("NO");
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
        if (count < 1 || count > 3) throw new Error("Invalid run of 'K' in number code (max 3).");

        ensureNEBeforeOperatorRun();
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

    const caps = tokens.join("");
    _npTokenizeNanpaCaps(caps);
    return { caps };
  }

  function _npNanpaCapsTokensToTpWords(tokens, { mode = "traditional" } = {}) {
    if (!tokens || tokens.length === 0) return [];

    const uniform = (mode === "uniform");
    const out = [];

    const E_WORD = uniform ? "en" : "esun";
    const E_WORD_FOR_NE_AFTER_START = uniform ? "en" : "e";
    const N_WORD = uniform ? "nena" : "nasa";

    const N_WORD_DECIMAL_POINT = uniform ? "nena" : "ni";
    const N_END_WORD = "nanpa";

    let afterStartingNe = false;

    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i];

      if (t === "NE") {
        if (out.length === 0) {
          out.push("nanpa", E_WORD);
          afterStartingNe = true;
        } else {
          out.push(N_WORD, E_WORD_FOR_NE_AFTER_START);
          afterStartingNe = false;
        }
        continue;
      }

      if (_NP_DIGIT_TOKENS.has(t)) {
        afterStartingNe = false;
        const digitWord = _NP_TOKEN_TO_DIGIT_WORD[t];
        if (t === "NI" || t === "NA" || t === "NU") out.push(N_WORD, digitWord);
        else out.push(digitWord, E_WORD);
        continue;
      }

      if (t === "NO") {
        if (afterStartingNe) {
          out.push(N_WORD, _NP_WORD_FOR_NEGATIVE_SIGN);
          afterStartingNe = false;
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
        out.push("nena","open","kala","open");
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
    const join = (mode === "uniform") ? "en" : "e";
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

  function _npNanpaCapsToNanpaLinjanCodepoints(caps, { mode = "traditional", isTime = false } = {}) {
    const tokens = _npTokenizeNanpaCaps(caps);
    if (!_npNanpaCapsHasAtLeastOneDigitToken(tokens)) return null;

    let hasPercent = false;
    const tokensNoOk = [];
    for (const t of tokens) {
      if (t === "OK") { hasPercent = true; continue; }
      tokensNoOk.push(t);
    }

    const tpWords = _npNanpaCapsTokensToTpWords(tokensNoOk, { mode });
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
        ? ["nena", "open", "kipisi", "en"]
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

  function _npTryDecodeNanpaLinjanIdentifierToCodepoints(rawText, { mode = "traditional" } = {}) {
    const s = String(rawText ?? "").trim();
    if (!s) return null;

    try {
      const parsed = _npTryParseNanpaLinjanNumberCodeToCaps(s);
      if (parsed?.caps) {
        const isTime = _npNanpaCapsIsValidTimeOrDate(parsed.caps);
        return _npNanpaCapsToNanpaLinjanCodepoints(parsed.caps, { mode, isTime });
      }
    } catch {
      return null;
    }

    if (!_npIsValidNanpaLinjanProperName(s)) return null;

    const compact = s.replace(/\s+/g, "");
    const core = compact.slice(0, -1);

    const coreUpper = core.toUpperCase();
    let caps;

    if (coreUpper.endsWith("NOKE")) {
      const base = coreUpper.slice(0, -4);
      if (!base) return null;
      caps = base + "OKN";
    } else {
      caps = coreUpper + "N";
    }

    const isTime = _npNanpaCapsIsValidTimeOrDate(caps);
    return _npNanpaCapsToNanpaLinjanCodepoints(caps, { mode, isTime });
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

    if (s.slice(1).includes("-")) {
      throw new Error("Only one negative sign is allowed, and it must be at the start.");
    }

    const [num, den] = _NP_VULGAR_FRACTIONS.get(lastChar);
    const prefixRaw = s.slice(0, -1).trim();

    if (!prefixRaw) return `${num}/${den}`;

    const isNeg = prefixRaw.startsWith("-");
    const prefix = isNeg ? prefixRaw.slice(1).trim() : prefixRaw;

    if (!prefix) return `-${num}/${den}`;
    return isNeg ? `-${prefix}+${num}/${den}` : `${prefix}+${num}/${den}`;
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
    const m = s.match(/^(\d{1,2}):([0-5]\d)(?::([0-5]\d))?$/);
    if (!m) return null;

    const hhStr = m[1];
    const mmStr = m[2];
    const ssStr = (m[3] != null) ? m[3] : null;

    const hh = parseInt(hhStr, 10);
    if (!Number.isFinite(hh) || hh < 0 || hh > 59) return null;

    return { hhStr, mmStr, ssStr };
  }

  function _npEncodeDigitsOnly(digits) {
    const s = String(digits ?? "");
    if (!/^\d+$/.test(s)) throw new Error(`Expected only digits, got "${digits}"`);
    let out = "";
    for (const ch of s) {
      const tok = _NP_DEC_DIGIT_TO_TOKEN[ch];
      if (!tok) throw new Error(`Unsupported digit "${ch}"`);
      out += tok;
    }
    return out;
  }

  function _npTryParseDateParts(raw) {
    const s = _npNormalizeDateTimeInput(raw);
    const m = s.match(/^(\d{4})([:\/-])(\d{2})\2(\d{2})$/);
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

  function _npDateStrToNanpaCaps(raw) {
    const parts = _npTryParseDateParts(raw);
    if (!parts) return null;

    let caps = "NE";
    caps += _npEncodeDigitsOnly(parts.yyyyStr);
    caps += "NEKE";
    caps += _npEncodeDigitsOnly(parts.mmStr);
    caps += "NEKE";
    caps += _npEncodeDigitsOnly(parts.ddStr);
    caps += "N";

    _npTokenizeNanpaCaps(caps);
    return caps;
  }

  function _npTimeStrToNanpaCaps(raw) {
    const parts = _npTryParseTimeParts(raw);
    if (!parts) return null;

    let caps = "NE";
    caps += _npEncodeDigitsOnly(parts.hhStr);
    caps += "NEKE";
    caps += _npEncodeDigitsOnly(parts.mmStr);

    if (parts.ssStr != null) {
      caps += "NEKE";
      caps += _npEncodeDigitsOnly(parts.ssStr);
    }

    caps += "N";
    _npTokenizeNanpaCaps(caps);
    return caps;
  }

  function _npNanpaCapsLooksLikeTime(caps){
    let tokens;
    try { tokens = _npTokenizeNanpaCaps(caps); } catch { return false; }
    if (!tokens || tokens.length < 1) return false;
    if (tokens[0] !== "NE") return false;
    if (tokens[tokens.length - 1] !== "N") return false;

    for (const t of tokens){
      if (t === "NO" || t === "NONO" || t === "NONONO" || t === "NOKO" || t === "OK") return false;
      if (t === "KEKE" || t === "KEKEKE") return false;
    }

    let i = 1;
    let hCount = 0;
    while (i < tokens.length && _NP_DIGIT_TOKENS.has(tokens[i]) && hCount < 2){
      hCount++; i++;
    }
    if (hCount < 1) return false;

    if (tokens[i] !== "NE") return false; i++;
    if (tokens[i] !== "KE") return false; i++;

    if (!_NP_DIGIT_TOKENS.has(tokens[i])) return false; i++;
    if (!_NP_DIGIT_TOKENS.has(tokens[i])) return false; i++;

    if (tokens[i] === "NE"){
      i++;
      if (tokens[i] !== "KE") return false; i++;
      if (!_NP_DIGIT_TOKENS.has(tokens[i])) return false; i++;
      if (!_NP_DIGIT_TOKENS.has(tokens[i])) return false; i++;
    }

    return i === tokens.length - 1;
  }

  function _npNanpaCapsDecodeTimeStrict(caps) {
    let tokens;
    try { tokens = _npTokenizeNanpaCaps(String(caps).trim().toUpperCase()); }
    catch { return null; }

    if (tokens[0] !== "NE") return null;
    if (tokens[tokens.length - 1] !== "N") return null;

    let i = 1;

    function readDigitChar() {
      const t = tokens[i];
      const w = _NP_TOKEN_TO_DIGIT_WORD[t];
      if (!w) return null;
      const ch = _NP_TOKEN_TO_DIGIT_CHAR[t];
      if (!ch) return null;
      i += 1;
      return ch;
    }

    const h1 = readDigitChar(); if (h1 == null) return null;
    let h2 = null;
    if (i < tokens.length && _NP_DIGIT_TOKENS.has(tokens[i])) h2 = readDigitChar();
    const hhStr = (h2 == null) ? h1 : (h1 + h2);

    if (tokens[i] !== "NE") return null; i++;
    if (tokens[i] !== "KE") return null; i++;

    const m1 = readDigitChar(); if (m1 == null) return null;
    const m2 = readDigitChar(); if (m2 == null) return null;
    const mmStr = m1 + m2;

    let ssStr = null;
    if (tokens[i] === "NE") {
      i++;
      if (tokens[i] !== "KE") return null; i++;
      const s1 = readDigitChar(); if (s1 == null) return null;
      const s2 = readDigitChar(); if (s2 == null) return null;
      ssStr = s1 + s2;
    }

    if (i !== tokens.length - 1) return null;

    const hh = parseInt(hhStr, 10);
    const mm = parseInt(mmStr, 10);
    const ss = (ssStr == null) ? null : parseInt(ssStr, 10);

    if (!(hh >= 0 && hh <= 59)) return null;
    if (!(mm >= 0 && mm <= 59)) return null;
    if (ss != null && !(ss >= 0 && ss <= 59)) return null;

    return { hh, mm, ss };
  }

  function _npNanpaCapsIsValidTime(caps) {
    return _npNanpaCapsDecodeTimeStrict(caps) != null;
  }

  function _npNanpaCapsDecodeDateStrict(caps) {
    let tokens;
    try { tokens = _npTokenizeNanpaCaps(String(caps).trim().toUpperCase()); }
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

  function _npNanpaCapsIsValidDate(caps) {
    return _npNanpaCapsDecodeDateStrict(caps) != null;
  }

  function _npNanpaCapsIsValidTimeOrDate(caps) {
    return _npNanpaCapsIsValidTime(caps) || _npNanpaCapsIsValidDate(caps);
  }

  function _npNumberStrToNanpaCaps(
    s,
    { thousandsChar = ",", groupFractionTriplets = true, fractionGroupSize = 3, mixedStyle = "short" } = {}
  ) {
    if (s == null) throw new Error("s must be a string");
    let raw = _npNormalizeLooseSeparators(String(s));
    if (!raw) throw new Error("Empty value cannot be encoded");

    if (groupFractionTriplets) {
      raw = _npGroupFractionDigitsOnly(raw, ".", fractionGroupSize, "_");
    }

    function stripFinalTerminator(segCaps) {
      if (!segCaps) return segCaps;
      if (!segCaps.endsWith("N")) throw new Error(`Segment caps did not end with 'N': ${segCaps}`);
      return segCaps.slice(0, -1);
    }

    function encodeSingleNumberSegment(segment, includeInitialNe) {
      let seg = String(segment).trim();
      if (seg === "") throw new Error(`Empty numeric segment in ${s}`);

      if (seg.slice(0, 1).toUpperCase() === "N") {
        seg = seg.slice(1).trim();
        if (seg === "") throw new Error(`Missing numeric part after leading 'N' prefix in ${s}`);
      }

      const out = [];
      if (includeInitialNe) out.push("NE");

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
            (last === "K" || last === "T") ? 1 :
            (last === "M") ? 2 : 3;
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
          if (/\d/.test(ch)) { out.push(_NP_DEC_DIGIT_TO_TOKEN[ch]); continue; }
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

        for (const d of groups[0]) out.push(_NP_DEC_DIGIT_TO_TOKEN[d]);

        const nGroups = groups.length;
        const lastNonTrailingIdx = nGroups - trailingZeroGroups;

        for (let idx = 1; idx < lastNonTrailingIdx; idx++) {
          out.push("NE","KE");
          for (const d of groups[idx]) out.push(_NP_DEC_DIGIT_TO_TOKEN[d]);
        }

        if (trailingZeroGroups > 0) {
          out.push("NE");
          let remaining = trailingZeroGroups;
          while (remaining > 0) {
            const chunk = Math.min(3, remaining);
            if (out[out.length - 1] !== "NE") out.push("NE");
            out.push("KE".repeat(chunk));
            remaining -= chunk;
            if (remaining > 0) out.push("NE");
          }
        }
      }

      if (hasDecimal) {
        out.push("NO","NE");

        if (!fracPart) throw new Error(`Missing fraction digits after '.' in "${s}"`);

        for (const ch of fracPart) {
          if (/\d/.test(ch)) { out.push(_NP_DEC_DIGIT_TO_TOKEN[ch]); continue; }
          if (ch === "_") { pushNene(); continue; }
          if (ch === ",") { pushNene(); continue; }
          if (ch === " " || ch === "-") { pushNene(); continue; }
          throw new Error(`Unsupported character "${ch}" in fraction part of "${s}"`);
        }
      }

      if (magnitudeSuffixKeCount > 0) {
        out.push("NE");
        let remaining = magnitudeSuffixKeCount;
        while (remaining > 0) {
          const chunk = Math.min(3, remaining);
          if (out[out.length - 1] !== "NE") out.push("NE");
          out.push("KE".repeat(chunk));
          remaining -= chunk;
          if (remaining > 0) out.push("NE");
        }
      }

      out.push("N");
      return out.join("");
    }

    if (raw.includes("+")) {
      const [left, right] = raw.split("+", 2);
      let leftCaps = encodeSingleNumberSegment(left, true);

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
      let numCaps = encodeSingleNumberSegment(num, true);
      let denCaps = encodeSingleNumberSegment(den, false);
      numCaps = stripFinalTerminator(numCaps);
      return numCaps + "NONO" + denCaps;
    }

    return encodeSingleNumberSegment(raw, true);
  }

  function _npDecimalStringToCaps(rawDecimal, opts = {}) {
    let raw = String(rawDecimal ?? "").trim();
    let percent = false;

    if (/%$/.test(raw)) {
      percent = true;
      raw = raw.replace(/\s*%\s*$/g, "").trim();
    }

    const normalized = _npNormalizeVulgarFractionInput(raw);

    const baseCaps = _npLooksLikeNanpaCaps(normalized)
      ? normalized.toUpperCase()
      : _npNumberStrToNanpaCaps(normalized, opts);

    const caps = percent
      ? (baseCaps.slice(0, -1) + "OKN")
      : baseCaps;

    _npTokenizeNanpaCaps(caps);
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
      } else if (_npIsValidNanpaLinjanProperName(s)) {
        const compact = s.replace(/\s+/g, "");
        const core = compact.slice(0, -1);
        const coreUpper = core.toUpperCase();
        if (coreUpper.endsWith("NOKE")) {
          const base = coreUpper.slice(0, -4);
          if (!base) return null;
          caps = base + "OKN";
        } else {
          caps = coreUpper + "N";
        }
      } else {
        const dateCaps = _npDateStrToNanpaCaps(s);
        if (dateCaps) {
          caps = dateCaps;
        } else {
          const timeCaps = _npTimeStrToNanpaCaps(s);
          if (timeCaps) caps = timeCaps;
          else caps = _npDecimalStringToCaps(s, {
            thousandsChar: ",",
            groupFractionTriplets: true,
            fractionGroupSize: 3,
            mixedStyle: opts.mixedStyle === "long" ? "long" : "short"
          });
        }
      }

      if (!caps) return null;

      const isTime = _npNanpaCapsIsValidTimeOrDate(caps);
      const innerCodepoints = _npNanpaCapsToNanpaLinjanCodepoints(caps, { mode, isTime });
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

  const NanpaParser = Object.freeze({
  parseNumber(input, opts = {}) {
    const mode = ((opts.mode === "traditional") || (opts.numericMode === "traditional"))
      ? "traditional"
      : "uniform";
    const mixedStyle = (opts.mixedStyle === "long") ? "long" : "short";

    if (input == null || String(input).trim() === "") return null;
    const s = String(input).trim();

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
        if (pair === "NE" && nextPair === "NE") { outStr += "n "; outStr += "ene "; i += 4; continue; }
        if (pair === "NO" && nextPair === "NE" && i > 0) { outStr += "n "; outStr += "one "; i += 4; continue; }

        if (pair === "NO" && nextPair === "KO" && i > 0) {
          outStr += "n ";
          outStr += "oko";
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
          outStr += "e";
          let countKe = 1; let j = i;
          while ((j + 6) <= end && mainS.slice(j + 4, j + 6) === "KE") { countKe++; j += 2; }
          outStr += "ke".repeat(countKe);
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
      let neg = false;

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
        suffixKeCount > 3 ? `×1000^${suffixKeCount}` :
        "";

      const sign = neg ? "-" : "";
      if (kind === "frac") return sign + intStr + "." + (fracStr || "0") + suffix;
      return sign + intStr + suffix;
    }

    function decodeCapsToDisplayValue(caps, decodeOpts = {}) {
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

      const base = decodeSegmentTokensToString(tokens.slice(1, finalNIdx), decodeOpts);
      if (!base) return null;
      return hasPercent ? (base + "%") : base;
    }

    let caps = null;
    try {
      const normalized = _npNormalizeVulgarFractionInput(s);
      const timeCaps = _npTimeStrToNanpaCaps(normalized);
      const dateCaps = _npDateStrToNanpaCaps(normalized);

      if (_npLooksLikeNanpaCaps(normalized)) {
        caps = normalized.toUpperCase();
      } else if (timeCaps != null) {
        caps = timeCaps;
      } else if (dateCaps != null) {
        caps = dateCaps;
      } else if (_npIsValidNanpaLinjanProperName(s)) {
        const core = s.replace(/\s+/g, "").slice(0, -1).toUpperCase();
        caps = (core.endsWith("NOKE") ? (core.slice(0, -4) + "OKN") : (core + "N"));
      } else {
        const parsed = _npTryParseNanpaLinjanNumberCodeToCaps(s);
        if (parsed?.caps) caps = parsed.caps;
        else caps = _npNumberStrToNanpaCaps(normalized, {
          thousandsChar: ",",
          groupFractionTriplets: true,
          fractionGroupSize: 3,
          mixedStyle
        });
      }
    } catch {
      return null;
    }

    if (!caps) return null;

    try {
      const tokens = _npTokenizeNanpaCaps(caps);
      const isTimeLike = _npNanpaCapsIsValidTimeOrDate(caps);
      const hasOk = tokens.includes("OK");
      const tokensNoOk = tokens.filter(t => t !== "OK");

      let tpWords = _npNanpaCapsTokensToTpWords(tokensNoOk, { mode });
      if (isTimeLike) tpWords = _npReplaceTimeSeparatorsTpWords(tpWords, mode);

      if (hasOk) {
        const suffixWords = (mode === "uniform")
          ? ["nena", "open", "kipisi", "en"]
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

      const properName = titleCaseCapsLabel(splitCapsLetters(caps));
      const uniqueCode = latinNameToUniqueCode(properName);
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
        isTime: _npNanpaCapsIsValidTime(caps),
        isDate: _npNanpaCapsIsValidDate(caps),
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

  splitCapsToProperName(caps, { titleCase = true } = {}) {
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
        if (pair === "NE" && nextPair === "NE") { outStr += "n "; outStr += "ene "; i += 4; continue; }
        if (pair === "NO" && nextPair === "NE" && i > 0) { outStr += "n "; outStr += "one "; i += 4; continue; }
        if (pair === "NO" && nextPair === "KO" && i > 0) { outStr += "n "; outStr += "oko"; if ((i + 4) < end) outStr += " "; i += 4; continue; }
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
          outStr += "e";
          let countKe = 1; let j = i;
          while ((j + 6) <= end && mainS.slice(j + 4, j + 6) === "KE") { countKe++; j += 2; }
          outStr += "ke".repeat(countKe);
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

    const raw = splitCapsLetters(caps);
    if (!titleCase) return raw;
    return String(raw).trim().split(/\s+/).filter(Boolean)
      .map(w => w.length === 1 ? w.toUpperCase() : (w[0].toUpperCase() + w.slice(1)))
      .join(" ");
  },

  capsToUniqueCode(caps) {
    const proper = this.splitCapsToProperName(caps, { titleCase: true });
    const noSpaces = String(proper ?? "").replace(/\s+/g, "");
    const withoutNE = noSpaces.replace(/[nNeE]/g, "");
    const up = withoutNE.toUpperCase();
    const styled = up.replace(/O/g, "o").replace(/K/g, "k");
    return "#~" + styled;
  },

  decodeCaps(caps, opts = {}) {
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
      let neg = false;
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
        suffixKeCount > 3 ? `×1000^${suffixKeCount}` :
        "";

      const sign = neg ? "-" : "";
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
      const cp = _NP_WORD_TO_UCSUR_CP[p] ?? _NP_WORD_TO_UCSUR_CP[String(p).toLowerCase()];
      if (cp == null) throw new Error(`Invalid Toki Pona word "${p}". Only mapped words are allowed.`);
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
    const raw = String(input ?? "").trim();
    if (!raw) return [];
    const parts = raw.split(/\s+/).map(s => s.replace(/^U\+/i, ""));
    const cps = parts.map(p => {
      const cp = parseInt(p, 16);
      if (!Number.isFinite(cp)) throw new Error(`Invalid hex code point: "${p}"`);
      return cp;
    });

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
    return _npIsValidNanpaLinjanProperName(s);
  },

  isValidTimeOrDate(caps) {
    return _npNanpaCapsIsValidTimeOrDate(caps);
  },

  isValidTime(caps) {
    return _npNanpaCapsIsValidTime(caps);
  },

  isValidDate(caps) {
    return _npNanpaCapsIsValidDate(caps);
  },

  tokenizeCaps(caps) {
    return _npTokenizeNanpaCaps(caps);
  },

  capsTokensToTpWords(tokens, opts = {}) {
    const mode = ((opts.mode === "traditional") || (opts.numericMode === "traditional"))
      ? "traditional"
      : "uniform";
    return _npNanpaCapsTokensToTpWords(tokens, { mode });
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
    return new Set([0xF1946, 0xF1944, 0xF191F]);
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
    const cps = _npTryDecodeNanpaLinjanIdentifierToCodepoints(input, { mode });
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
    const mode = ((opts.mode === "traditional") || (opts.numericMode === "traditional"))
      ? "traditional"
      : "uniform";
    const tokens = _npTokenizeNanpaCaps(caps);
    const hasOk = tokens.includes("OK");
    const tokensNoOk = tokens.filter(t => t !== "OK");
    let words = _npNanpaCapsTokensToTpWords(tokensNoOk, { mode });

    if (_npNanpaCapsIsValidTimeOrDate(caps)) {
      words = _npReplaceTimeSeparatorsTpWords(words, mode);
    }

    if (!hasOk) return words;

    const suffixWords = (mode === "uniform")
      ? ["nena", "open", "kipisi", "en"]
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
    const isTime = _npNanpaCapsIsValidTimeOrDate(caps);
    const innerCodepoints = _npNanpaCapsToNanpaLinjanCodepoints(caps, { mode, isTime });
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
