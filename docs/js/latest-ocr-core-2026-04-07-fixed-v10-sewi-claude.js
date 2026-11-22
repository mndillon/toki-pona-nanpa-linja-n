export const DEFAULT_CATALOG = [
  "a","akesi","ala","alasa","ale","ali","anpa","ante","anu","awen",
  "e","en","epiku","esun",
  "ijo","ike","ilo","insa",
  "jaki","jan","jasima","jelo","jo",
  "kala","kalama","kama","kasi","ken","kepeken","kijetesantakalu","kili","kin","kipisi","kiwen","ko","kokosila","kon","ku","kule","kulupu","kute",
  "la","lanpan","lape","laso","lawa","leko","len","lete","li","lili","linja","linluwi","lipu","loje","lon","luka","lukin","lupa",
  "ma","majuna","mama","mani","meli","meso","mi","mije","misikeke","moku","moli","monsi","monsuta","mu","mun","musi","mute",
  "n","namako","nanpa","nasa","nasin","nena","ni","ni^","ni<","ni>","nimi","noka",
  "o","oko","olin","ona","open",
  "pakala","pake","pali","palisa","pan","pana","pi","pilin","pimeja","pini","pipi","poka","poki","pona","powe","pu",
  "sama","seli","selo","seme","sewi","sewi^","sijelo","sike","sin","sina","sinpin","sitelen","soko","sona","soweli","su","suli","suno","supa","suwi",
  "tan","taso","tawa","telo","tenpo","toki","tomo","tonsi","tu",
  "unpa","uta","utala",
  "walo","wan","waso","wawa","weka","wile",
  ".",",",":","·"
].map(token => ({
  glyph_id: token,
  latin_output: token,
  render_text: token,
  context_type: "normal",
  semantic_token: token === "·" ? "punct_middle_dot" : token,
  class_id: `normal_${token.replace(/[^a-z0-9]+/ig, "_")}`,
  render_mode: "text",
}));

export const DEFAULT_SETTINGS = {
  mergeLaKonCheck: true,
  laKonMaxGapPx: 8,
  laKonMaxSingleWidthPx: 14,
  laKonGain: 0.08,
  mergeSpanCheck: true,
  mergeSpanMaxGapPx: 12,
  mergeSpanMaxSections: 4,
  mergeSpanGain: 0.08,
  strongSpanPreference: true,
  strongSpanMargin: 0.12,
  normSize: 64,
  thresholdMode: "otsu",
  fixedThreshold: 180,
  morphology: "none",
  sourceSizes: [36, 48, 56, 64, 72, 84, 96],
  deskewRange: 4,
  deskewStep: 0.5,
  topGlyphAlts: 5,
  topLineAlts: 3,
  beamWidth: 10,
  postRuleWiggleEnabled: true,
  postRuleWiggleX: [-1, 0, 1],
  postRuleWiggleY: [-2, 0, 2],
  mergeThinRunEnabled: true,
  mergeThinRunMaxWidthRatio: 0.38,
  mergeThinRunMaxGapRatio: 0.18,
  mergeThinRunMinVOverlap: 0.65,
  mergeThinRunMinHeightRatio: 0.6,
  mergeThinRunBonus: 0.25,
  mergeAsymThinRunEnabled: true,
  asymThinConnectorMaxWidthRatio: 0.10,
  asymThinConnectorMinPx: 2.5,
  asymBodyMaxWidthRatio: 1.5,
  mergeAsymThinRunBonus: 0.25,
  mergeStackedRunEnabled: true,
  stackedRunMaxGapRatio: 0.25,
  stackedRunMinCombinedHeightRatio: 0.45,
  stackedRunMinWidthSim: 0.35,
  stackedRunMinXOverlap: 0.5,
  stackedRunMaxBaseRatio: 0.38,
  mergeStackedRunBonus: 0.25,
  splitThinPunctPenalty: 0.12,
  localSpanScoreWeight: 1,
  // ── Structure detection (cartouche / long-pi) ──────────────────────────────
  structureDetectionEnabled:       true,
  structureMinWidthRatio:          2.2,
  structureFrameEdgeRatio:         0.12,
  structureFrameDensityThreshold:  0.35,
  structureCartoucheGapBandTop:    0.20,
  structureCartoucheGapBandBottom: 0.80,
  structureLongPiGapBandTop:       0.00,
  structureLongPiGapBandBottom:    0.80,
};

export const DEFAULT_SCORE_WEIGHTS = {
  rowProjection: 0.9,
  colProjection: 0.9,
  fillRatio: 0.55,
  aspectRatio: 0.45,
  partCount: 0.10,
  sectionCount: 0.30,
  sectionWidths: 0.35,
  sectionCenters: 0.25,
  pixel: 0.55,
};

export const DEFAULT_POST_RULES = [
  // Safety net for the la-la/kon confusion.
  //
  // Root cause: two adjacent narrow vertical bars (kon glyph) are segmented into
  // two separate ink sections. Each section individually matches 'la' well. The
  // merged-span path that should produce 'kon' is penalised by localSpanScore ×
  // localSpanScoreWeight (currently applied only to merged units, not segment units),
  // which can push 'kon' out of the beam before the final whole-line rescore runs.
  //
  // This rule intercepts 'la la' in the output and re-scores 'kon' against the
  // actual observed line pixels using scoreWholeLineWithWiggle. The replacement
  // only sticks if the whole-line render of the candidate text (with 'kon' in
  // place of 'la la') scores better than the current text — so real 'la la'
  // sequences that genuinely look like two la glyphs are left alone.
  {
    id: "la_la_to_kon",
    enabled: true,
    whenTokens: ["la", "la"],
    replacementTokens: ["kon"],
    applyBonus: 0.00,
  },
  {
    id: "insa_dot_to_poka",
    enabled: true,
    whenTokens: ["insa", "."],
    replacementTokens: ["poka"],
    applyBonus: 0.08,
  },
  {
    id: "insa_comma_to_poka",
    enabled: true,
    whenTokens: ["insa", ","],
    replacementTokens: ["poka"],
    applyBonus: 0.08,
  },
  {
    id: "anu_comma_to_suli_comma",
    enabled: true,
    whenTokens: ["anu", ","],
    replacementTokens: ["suli", ","],
    applyBonus: 0.14,
  },
  {
    id: "anu_dot_to_suli_dot",
    enabled: true,
    whenTokens: ["anu", "."],
    replacementTokens: ["suli", "."],
    applyBonus: 0.08,
  },
  {
    id: "comma_pini_to_monsi",
    enabled: true,
    whenTokens: [",", "pini"],
    replacementTokens: ["monsi"],
    applyBonus: 0.08,
  },
  {
    id: "comma_comma_dot_to_sin",
    enabled: true,
    whenTokens: [",", ",", "."],
    replacementTokens: ["sin"],
    applyBonus: 0.12,
  },
  {
    id: "dot_comma_dot_to_sin",
    enabled: true,
    whenTokens: [".", ",", "."],
    replacementTokens: ["sin"],
    applyBonus: 0.18,
  },
  {
    id: "comma_dot_comma_to_meso",
    enabled: true,
    whenTokens: [",", ".", ","],
    replacementTokens: ["meso"],
    applyBonus: 0.12,
  },

  {
    id: "jelo_colon_jelo_to_sewi",
    enabled: true,
    whenTokens: ["jelo", ":", "jelo"],
    replacementTokens: ["sewi"],
    applyBonus: 0.18,
  },
  {
    id: "lanpan_comma_lanpan_to_majuna",
    enabled: true,
    whenTokens: ["lanpan", ",", "lanpan"],
    replacementTokens: ["majuna"],
    applyBonus: 0.18,
  },
  {
    id: "dot_lipu_to_monsi",
    enabled: true,
    whenTokens: [".", "lipu"],
    replacementTokens: ["monsi"],
    applyBonus: 0.18,
  },
  {
    id: "pimeja_comma_to_sewi",
    enabled: true,
    whenTokens: ["pimeja", ","],
    replacementTokens: ["sewi"],
    applyBonus: 0.18,
  },
  {
    id: "comma_comma_to_tu",
    enabled: true,
    whenTokens: [",", ","],
    replacementTokens: ["tu"],
    applyBonus: 0.18,
  },
  {
    id: "la_n_to_weka",
    enabled: true,
    whenTokens: ["la", "n"],
    replacementTokens: ["weka"],
    applyBonus: 0.20,
  },
  {
    id: "wan_dot_to_sinpin",
    enabled: true,
    whenTokens: ["wan", "."],
    replacementTokens: ["sinpin"],
    applyBonus: 0.18,
  },
];

function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
function median(values) {
  const arr = (values || []).filter(v => Number.isFinite(v)).slice().sort((a, b) => a - b);
  if (!arr.length) return NaN;
  const m = Math.floor(arr.length / 2);
  return arr.length % 2 ? arr[m] : (arr[m - 1] + arr[m]) / 2;
}
function get2dContext(canvas, { readback = false } = {}) {
  try { return readback ? canvas.getContext("2d", { willReadFrequently: true }) : canvas.getContext("2d"); }
  catch { return canvas.getContext("2d"); }
}
function safeJsonParse(text, fallback) { try { return JSON.parse(text); } catch { return fallback; } }
function normalizeGlyphKey(raw) { return String(raw ?? "").toLowerCase().trim().replace(/[^a-z^<>:,.·]/g, ""); }


// ═══════════════════════════════════════════════════════════════════════════════
// Structure detection helpers (cartouche / long-pi)
// Private to this module — not exported.
// ═══════════════════════════════════════════════════════════════════════════════

function _structRowDensities(binary, w, h) {
  const out = new Float32Array(h);
  for (let y = 0; y < h; y++) {
    let ink = 0;
    for (let x = 0; x < w; x++) ink += binary[y * w + x] ? 1 : 0;
    out[y] = ink / Math.max(1, w);
  }
  return out;
}

function _structColDensities(binary, w, h) {
  const out = new Float32Array(w);
  for (let x = 0; x < w; x++) {
    let ink = 0;
    for (let y = 0; y < h; y++) ink += binary[y * w + x] ? 1 : 0;
    out[x] = ink / Math.max(1, h);
  }
  return out;
}

function _structSliceMean(arr, i0, i1) {
  let s = 0;
  const n = Math.max(1, i1 - i0);
  for (let i = i0; i < i1; i++) s += arr[i] || 0;
  return s / n;
}

/**
 * Count ink per column but only within a horizontal row band [bandY0, bandY1).
 * Used so frame bars don't block every column during gap search.
 */
function _structColInkInBand(binary, w, h, bandY0, bandY1) {
  const y0 = Math.max(0, Math.round(bandY0));
  const y1 = Math.min(h, Math.round(bandY1));
  const out = new Int32Array(w);
  for (let y = y0; y < y1; y++)
    for (let x = 0; x < w; x++)
      out[x] += binary[y * w + x] ? 1 : 0;
  return out;
}

/**
 * Remove frame ink from a blob binary using connected-component analysis.
 *
 * Frame strokes (top/bottom bars, bracket caps, left vertical) are connected
 * components that touch the blob edges.  Interior glyph components do NOT
 * touch the edges (or touch only the bottom edge for long-pi, which we allow).
 *
 * For cartouche: remove any component touching top OR bottom OR left OR right edge.
 * For long-pi:   remove any component touching bottom OR left edge.
 *                (no top bar, right is open — components touching top or right
 *                 are kept as they belong to interior glyphs.)
 *
 * Returns a new binary with frame components zeroed out.
 */
function _removeFrameComponents(binary, w, h, kind) {
  // Label connected components (4-connected)
  const labels = new Int32Array(w * h);
  let nextLabel = 1;
  const componentEdge = new Map(); // label → {touchesTop,touchesBot,touchesLeft,touchesRight}

  const stack = [];
  for (let i = 0; i < binary.length; i++) {
    if (!binary[i] || labels[i]) continue;
    const label = nextLabel++;
    labels[i] = label;
    let tt = false, tb = false, tl = false, tr = false;
    stack.push(i);
    while (stack.length) {
      const cur = stack.pop();
      const cx = cur % w, cy = (cur / w) | 0;
      if (cy === 0)     tt = true;
      if (cy === h - 1) tb = true;
      if (cx === 0)     tl = true;
      if (cx === w - 1) tr = true;
      // 4-connected neighbours
      const ns = [cur - w, cur + w, cur - 1, cur + 1];
      for (const n of ns) {
        if (n < 0 || n >= binary.length) continue;
        const nx = n % w, ny = (n / w) | 0;
        if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
        if (!binary[n] || labels[n]) continue;
        labels[n] = label;
        stack.push(n);
      }
    }
    componentEdge.set(label, { tt, tb, tl, tr });
  }

  // Decide which components are frame ink
  const out = binary.slice();
  for (let i = 0; i < out.length; i++) {
    if (!out[i]) continue;
    const label = labels[i];
    const e = componentEdge.get(label);
    if (!e) continue;
    let isFrame;
    if (kind === 'cartouche') {
      // Frame touches any edge
      isFrame = e.tt || e.tb || e.tl || e.tr;
    } else {
      // Long-pi: frame touches bottom or left; top/right touching = interior glyph
      isFrame = e.tb || e.tl;
    }
    if (isFrame) out[i] = 0;
  }
  return out;
}

/**
 * Classify a wide blob as cartouche, longpi, or neither.
 *
 * Measures edge ink densities on all four sides of the blob and compares
 * them against calibrated reference values measured from actual [ nanpa ]
 * and pi( nanpa ) renders at bank-build time.
 *
 * If calibration is available: compare blob densities to reference with
 * 30% relative tolerance.  Cartouche = top+bot both meet reference.
 * Long-pi = bot+left meet reference, top does NOT meet cartouche reference.
 *
 * If no calibration: fall back to fixed threshold (original behaviour).
 */
function _classifyStructure(binary, w, h, calib, fallbackThreshold) {
  const rows = _structRowDensities(binary, w, h);
  const cols = _structColDensities(binary, w, h);

  // Edge band size: scale calibrated band from reference dimensions to blob dimensions
  const edgeFracH = (calib?.edgeRows && calib?.calibH) ? calib.edgeRows / calib.calibH : 0.12;
  const edgeFracW = (calib?.edgeCols && calib?.calibW) ? calib.edgeCols / calib.calibW : 0.12;
  const edgeRows = Math.max(1, Math.round(h * edgeFracH));
  const edgeCols = Math.max(1, Math.round(w * edgeFracW));

  const topD   = _structSliceMean(rows, 0, edgeRows);
  const botD   = _structSliceMean(rows, Math.max(0, h - edgeRows), h);
  const leftD  = _structSliceMean(cols, 0, edgeCols);
  const rightD = _structSliceMean(cols, Math.max(0, w - edgeCols), w);

  const T = fallbackThreshold ?? 0.35;

  if (calib?.cartoucheTopD != null) {
    // Calibrated path — compare against measured reference densities
    // with 30% relative tolerance to allow for size and style variation.
    const tol = 0.30;
    const cartTopOk  = topD  >= calib.cartoucheTopD  * (1 - tol);
    const cartBotOk  = botD  >= calib.cartoucheBotD  * (1 - tol);
    // Cartouche: top AND bottom bars both present (rounded styles have low left/right)
    if (cartTopOk && cartBotOk) {
      return { kind: 'cartouche', confidence: (topD + botD) / 2, topD, botD, leftD, rightD };
    }
    // Long-pi: bottom + left present, top NOT meeting cartouche top reference
    if (!cartTopOk && calib.longpiBotD != null) {
      const lpBotOk  = botD  >= calib.longpiBotD  * (1 - tol);
      const lpLeftOk = leftD >= calib.longpiLeftD * (1 - tol);
      if (lpBotOk && lpLeftOk) {
        return { kind: 'longpi', confidence: (botD + leftD) / 2, topD, botD, leftD, rightD };
      }
      // Soft long-pi
      if (botD >= calib.longpiBotD * 0.65 && leftD >= calib.longpiLeftD * 0.65) {
        return { kind: 'longpi', confidence: (botD + leftD) / 2 * 0.75, topD, botD, leftD, rightD };
      }
    }
  } else {
    // No calibration — fixed threshold fallback
    const hasTop = topD >= T, hasBot = botD >= T, hasLeft = leftD >= T;
    if (hasTop && hasBot) {
      return { kind: 'cartouche', confidence: (topD + botD) / 2, topD, botD, leftD, rightD };
    }
    if (!hasTop && hasBot && hasLeft) {
      return { kind: 'longpi', confidence: (botD + leftD) / 2, topD, botD, leftD, rightD };
    }
    if (!hasTop && botD >= T * 0.75 && leftD >= T * 0.75) {
      return { kind: 'longpi', confidence: (botD + leftD) / 2 * 0.8, topD, botD, leftD, rightD };
    }
  }

  return { kind: null, confidence: 0, topD, botD, leftD, rightD };
}

/**
 * Find clear vertical gaps within a 2-D band [bandY0,bandY1) x [bandX0,bandX1).
 * Returns array of { x0, x1 } gap objects in blob-local coordinates.
 */
function _findGapsInBand(binary, w, h, bandY0, bandY1, bandX0, bandX1) {
  const colInk = _structColInkInBand(binary, w, h, bandY0, bandY1);
  const gaps = [];
  let start = -1;
  const xFrom = Math.max(0, Math.round(bandX0));
  const xTo   = Math.min(w, Math.round(bandX1));
  for (let x = xFrom; x < xTo; x++) {
    if (colInk[x] === 0 && start < 0) start = x;
    if (colInk[x] > 0 && start >= 0) { gaps.push({ x0: start, x1: x }); start = -1; }
  }
  if (start >= 0) gaps.push({ x0: start, x1: xTo });
  return gaps;
}

/**
 * Convert gaps into full-blob-height sections.
 * xFrom/xTo define the interior region we searched; sections are clipped to it.
 */
function _gapsToFullHeightSections(gaps, w, h, xFrom, xTo) {
  const sections = [];
  let x = xFrom;
  for (const g of gaps) {
    if (g.x0 > x) sections.push({ x, y: 0, w: g.x0 - x, h });
    x = g.x1;
  }
  if (x < xTo) sections.push({ x, y: 0, w: xTo - x, h });
  return sections;
}

/**
 * Measure the left and right frame margins of a rendered framed binary
 * (cartouche or long-pi) by finding where interior glyph ink begins/ends
 * within the safe row band.  Returns { leftMarginPx, rightMarginPx }.
 *
 * Works entirely from the framed render — no comparison with plain glyph
 * needed, so the smaller interior font size doesn't matter.
 */
function _measureFrameMargins(binary, w, h, bandTopFrac, bandBotFrac) {
  const bandY0 = h * bandTopFrac;
  const bandY1 = h * bandBotFrac;
  const colInk = _structColInkInBand(binary, w, h, bandY0, bandY1);

  // Find first and last column with ink in the band
  let first = -1, last = -1;
  for (let x = 0; x < w; x++) {
    if (colInk[x] > 0) { if (first < 0) first = x; last = x; }
  }
  if (first < 0) return { leftMarginPx: 0, rightMarginPx: 0 }; // no ink found

  // Scan inward from left to find where ink density drops to near-zero
  // (the gap between the bracket curve and the first interior glyph)
  let leftMarginPx = first;
  for (let x = first; x < w; x++) {
    if (colInk[x] === 0) { leftMarginPx = x; break; }
  }

  let rightMarginPx = w - 1 - last;
  for (let x = last; x >= 0; x--) {
    if (colInk[x] === 0) { rightMarginPx = w - 1 - x; break; }
  }

  return { leftMarginPx, rightMarginPx };
}

export class SitelenOcrCore {
  constructor(hooks = {}) {
    if (typeof hooks.renderGlyphStringToCanvas !== "function") {
      throw new Error("SitelenOcrCore requires renderGlyphStringToCanvas hook.");
    }
    this.hooks = hooks;
    this.lastBank = null;
    this.lastAnalysis = null;
  }

  parseCatalog(jsonText, fallback = DEFAULT_CATALOG) {
    const parsed = typeof jsonText === "string" ? safeJsonParse(jsonText, fallback) : (jsonText || fallback);
    if (!Array.isArray(parsed)) throw new Error("Glyph catalog JSON must be an array.");
    return parsed.map((item, idx) => ({
      class_id: String(item.class_id || `class_${idx + 1}`),
      glyph_id: String(item.glyph_id || item.latin_output || item.render_text || `glyph_${idx + 1}`),
      context_type: String(item.context_type || "normal"),
      semantic_token: String(item.semantic_token || item.glyph_id || item.class_id || `token_${idx + 1}`),
      latin_output: String(item.latin_output || item.glyph_id || item.render_text || ""),
      render_text: String(item.render_text || item.latin_output || item.glyph_id || ""),
      render_mode: String(item.render_mode || "text"),
    }));
  }

  normalizeSettings(settings = {}) {
    return {
      ...DEFAULT_SETTINGS,
      ...settings,
      normSize: Math.max(16, Number(settings.normSize ?? DEFAULT_SETTINGS.normSize)),
      fixedThreshold: clamp(Number(settings.fixedThreshold ?? DEFAULT_SETTINGS.fixedThreshold), 0, 255),
      sourceSizes: Array.isArray(settings.sourceSizes)
        ? settings.sourceSizes.map(v => Number(v)).filter(v => Number.isFinite(v) && v > 0)
        : DEFAULT_SETTINGS.sourceSizes.slice(),
      deskewRange: Math.max(0, Number(settings.deskewRange ?? DEFAULT_SETTINGS.deskewRange)),
      deskewStep: Math.max(0.1, Number(settings.deskewStep ?? DEFAULT_SETTINGS.deskewStep)),
      beamWidth: Math.max(1, Math.round(Number(settings.beamWidth ?? DEFAULT_SETTINGS.beamWidth))),
      topGlyphAlts: Math.max(1, Math.round(Number(settings.topGlyphAlts ?? DEFAULT_SETTINGS.topGlyphAlts))),
      topLineAlts: Math.max(1, Math.round(Number(settings.topLineAlts ?? DEFAULT_SETTINGS.topLineAlts))),
      mergeLaKonCheck: settings.mergeLaKonCheck !== false,
      laKonMaxGapPx: Math.max(0, Number(settings.laKonMaxGapPx ?? DEFAULT_SETTINGS.laKonMaxGapPx)),
      laKonMaxSingleWidthPx: Math.max(1, Number(settings.laKonMaxSingleWidthPx ?? DEFAULT_SETTINGS.laKonMaxSingleWidthPx)),
      laKonGain: Number(settings.laKonGain ?? DEFAULT_SETTINGS.laKonGain),
      mergeSpanCheck: settings.mergeSpanCheck !== false,
      mergeSpanMaxGapPx: Math.max(0, Number(settings.mergeSpanMaxGapPx ?? DEFAULT_SETTINGS.mergeSpanMaxGapPx)),
      mergeSpanMaxSections: Math.max(2, Math.round(Number(settings.mergeSpanMaxSections ?? DEFAULT_SETTINGS.mergeSpanMaxSections))),
      mergeSpanGain: Number(settings.mergeSpanGain ?? DEFAULT_SETTINGS.mergeSpanGain),
      strongSpanPreference: settings.strongSpanPreference !== false,
      strongSpanMargin: Number(settings.strongSpanMargin ?? DEFAULT_SETTINGS.strongSpanMargin),
      postRuleWiggleEnabled: settings.postRuleWiggleEnabled !== false,
      postRuleWiggleX: Array.isArray(settings.postRuleWiggleX)
        ? settings.postRuleWiggleX.map(v => Math.round(Number(v))).filter(v => Number.isFinite(v))
        : DEFAULT_SETTINGS.postRuleWiggleX.slice(),
      postRuleWiggleY: Array.isArray(settings.postRuleWiggleY)
        ? settings.postRuleWiggleY.map(v => Math.round(Number(v))).filter(v => Number.isFinite(v))
        : DEFAULT_SETTINGS.postRuleWiggleY.slice(),
      mergeThinRunEnabled: settings.mergeThinRunEnabled !== false,
      mergeThinRunMaxWidthRatio: Number(settings.mergeThinRunMaxWidthRatio ?? DEFAULT_SETTINGS.mergeThinRunMaxWidthRatio),
      mergeThinRunMaxGapRatio: Number(settings.mergeThinRunMaxGapRatio ?? DEFAULT_SETTINGS.mergeThinRunMaxGapRatio),
      mergeThinRunMinVOverlap: Number(settings.mergeThinRunMinVOverlap ?? DEFAULT_SETTINGS.mergeThinRunMinVOverlap),
      mergeThinRunMinHeightRatio: Number(settings.mergeThinRunMinHeightRatio ?? DEFAULT_SETTINGS.mergeThinRunMinHeightRatio),
      mergeThinRunBonus: Number(settings.mergeThinRunBonus ?? DEFAULT_SETTINGS.mergeThinRunBonus),
      mergeAsymThinRunEnabled: settings.mergeAsymThinRunEnabled !== false,
      asymThinConnectorMaxWidthRatio: Number(settings.asymThinConnectorMaxWidthRatio ?? DEFAULT_SETTINGS.asymThinConnectorMaxWidthRatio),
      asymThinConnectorMinPx: Number(settings.asymThinConnectorMinPx ?? DEFAULT_SETTINGS.asymThinConnectorMinPx),
      asymBodyMaxWidthRatio: Number(settings.asymBodyMaxWidthRatio ?? DEFAULT_SETTINGS.asymBodyMaxWidthRatio),
      mergeAsymThinRunBonus: Number(settings.mergeAsymThinRunBonus ?? DEFAULT_SETTINGS.mergeAsymThinRunBonus),
      mergeStackedRunEnabled: settings.mergeStackedRunEnabled !== false,
      stackedRunMaxGapRatio: Number(settings.stackedRunMaxGapRatio ?? DEFAULT_SETTINGS.stackedRunMaxGapRatio),
      stackedRunMinCombinedHeightRatio: Number(settings.stackedRunMinCombinedHeightRatio ?? DEFAULT_SETTINGS.stackedRunMinCombinedHeightRatio),
      stackedRunMinWidthSim: Number(settings.stackedRunMinWidthSim ?? DEFAULT_SETTINGS.stackedRunMinWidthSim),
      stackedRunMinXOverlap: Number(settings.stackedRunMinXOverlap ?? DEFAULT_SETTINGS.stackedRunMinXOverlap),
      stackedRunMaxBaseRatio: Number(settings.stackedRunMaxBaseRatio ?? DEFAULT_SETTINGS.stackedRunMaxBaseRatio),
      mergeStackedRunBonus: Number(settings.mergeStackedRunBonus ?? DEFAULT_SETTINGS.mergeStackedRunBonus),
      splitThinPunctPenalty: Number(settings.splitThinPunctPenalty ?? DEFAULT_SETTINGS.splitThinPunctPenalty),
      localSpanScoreWeight: Number(settings.localSpanScoreWeight ?? DEFAULT_SETTINGS.localSpanScoreWeight),
      structureDetectionEnabled:       settings.structureDetectionEnabled !== false,
      structureMinWidthRatio:          Number(settings.structureMinWidthRatio          ?? DEFAULT_SETTINGS.structureMinWidthRatio),
      structureFrameEdgeRatio:         Number(settings.structureFrameEdgeRatio         ?? DEFAULT_SETTINGS.structureFrameEdgeRatio),
      structureFrameDensityThreshold:  Number(settings.structureFrameDensityThreshold  ?? DEFAULT_SETTINGS.structureFrameDensityThreshold),
      structureCartoucheGapBandTop:    Number(settings.structureCartoucheGapBandTop    ?? DEFAULT_SETTINGS.structureCartoucheGapBandTop),
      structureCartoucheGapBandBottom: Number(settings.structureCartoucheGapBandBottom ?? DEFAULT_SETTINGS.structureCartoucheGapBandBottom),
      structureLongPiGapBandTop:       Number(settings.structureLongPiGapBandTop       ?? DEFAULT_SETTINGS.structureLongPiGapBandTop),
      structureLongPiGapBandBottom:    Number(settings.structureLongPiGapBandBottom    ?? DEFAULT_SETTINGS.structureLongPiGapBandBottom),
    };
  }

  insertAlternativeSorted(alts, candidate, maxCount) {
    const next = (alts || []).slice();
    next.push(candidate);
    next.sort((a, b) => a.total - b.total || String(a.latin_output).localeCompare(String(b.latin_output)));
    return next.slice(0, Math.max(1, maxCount || next.length));
  }

  normalizeWeights(weights = {}) { return { ...DEFAULT_SCORE_WEIGHTS, ...weights }; }

  imageDataToGrayMask(imageData, width, height, settings) {
    const gray = new Uint8ClampedArray(width * height);
    const src = imageData.data;
    for (let i = 0, j = 0; i < src.length; i += 4, j++) {
      const r = src[i], g = src[i + 1], b = src[i + 2], a = src[i + 3];
      gray[j] = a === 0 ? 255 : Math.round(0.299 * r + 0.587 * g + 0.114 * b);
    }
    const threshold = settings.thresholdMode === "fixed" ? settings.fixedThreshold : this.otsuThreshold(gray);
    const binary = new Uint8Array(width * height);
    for (let i = 0; i < gray.length; i++) binary[i] = gray[i] < threshold ? 1 : 0;
    return { gray, binary: this.applyMorphology(binary, width, height, settings.morphology), threshold };
  }

  otsuThreshold(gray) {
    const hist = new Uint32Array(256);
    for (const v of gray) hist[v]++;
    const total = gray.length;
    let sum = 0;
    for (let i = 0; i < 256; i++) sum += i * hist[i];
    let sumB = 0, wB = 0, maxVar = -1, threshold = 127;
    for (let t = 0; t < 256; t++) {
      wB += hist[t];
      if (!wB) continue;
      const wF = total - wB;
      if (!wF) break;
      sumB += t * hist[t];
      const mB = sumB / wB;
      const mF = (sum - sumB) / wF;
      const between = wB * wF * (mB - mF) * (mB - mF);
      if (between > maxVar) { maxVar = between; threshold = t; }
    }
    return threshold;
  }

  applyMorphology(binary, width, height, mode) {
    if (!mode || mode === "none") return binary;
    const dilateOnce = (src) => {
      const out = new Uint8Array(src.length);
      for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        let on = 0;
        for (let dy = -1; dy <= 1 && !on; dy++) for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          if (src[ny * width + nx]) { on = 1; break; }
        }
        out[y * width + x] = on;
      }
      return out;
    };
    const erodeOnce = (src) => {
      const out = new Uint8Array(src.length);
      for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        let on = 1;
        for (let dy = -1; dy <= 1 && on; dy++) for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height || !src[ny * width + nx]) { on = 0; break; }
        }
        out[y * width + x] = on;
      }
      return out;
    };
    if (mode === "open") return dilateOnce(erodeOnce(binary));
    if (mode === "close") return erodeOnce(dilateOnce(binary));
    return binary;
  }

  trimBinary(binary, width, height) {
    let minX = width, minY = height, maxX = -1, maxY = -1;
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      if (!binary[y * width + x]) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
    if (maxX < minX || maxY < minY) return { x: 0, y: 0, w: 1, h: 1, binary: new Uint8Array([0]) };
    const w = maxX - minX + 1;
    const h = maxY - minY + 1;
    const cropped = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) cropped[y * w + x] = binary[(minY + y) * width + (minX + x)];
    return { x: minX, y: minY, w, h, binary: cropped };
  }

  cropBinary(binary, width, height, x0, x1, y0, y1) {
    const w = Math.max(1, x1 - x0), h = Math.max(1, y1 - y0);
    const out = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) out[y * w + x] = binary[(y0 + y) * width + (x0 + x)];
    return { binary: out, w, h };
  }

  resizeBinaryNearest(binary, width, height, targetW, targetH = targetW) {
    const out = new Uint8Array(targetW * targetH);
    for (let y = 0; y < targetH; y++) {
      const sy = Math.min(height - 1, Math.floor((y / targetH) * height));
      for (let x = 0; x < targetW; x++) {
        const sx = Math.min(width - 1, Math.floor((x / targetW) * width));
        out[y * targetW + x] = binary[sy * width + sx];
      }
    }
    return out;
  }

  computeProjections(binary, width, height) {
    const row = new Array(height).fill(0);
    const col = new Array(width).fill(0);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const v = binary[y * width + x] ? 1 : 0;
      row[y] += v; col[x] += v;
    }
    return {
      row: row.map(v => Number((v / Math.max(1, width)).toFixed(4))),
      col: col.map(v => Number((v / Math.max(1, height)).toFixed(4))),
    };
  }

  analyzeConnectedParts(binary, width, height, minArea = 1) {
    const visited = new Uint8Array(binary.length);
    const parts = [];
    const neighbors = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,-1],[1,-1],[-1,1]];
    let total = 0;
    for (let i = 0; i < binary.length; i++) total += binary[i] ? 1 : 0;
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (!binary[idx] || visited[idx]) continue;
      const queue = [idx]; visited[idx] = 1;
      let minX = x, minY = y, maxX = x, maxY = y, area = 0;
      while (queue.length) {
        const cur = queue.pop();
        const cx = cur % width, cy = Math.floor(cur / width);
        area++;
        if (cx < minX) minX = cx; if (cy < minY) minY = cy; if (cx > maxX) maxX = cx; if (cy > maxY) maxY = cy;
        for (const [dx, dy] of neighbors) {
          const nx = cx + dx, ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const ni = ny * width + nx;
          if (!binary[ni] || visited[ni]) continue;
          visited[ni] = 1; queue.push(ni);
        }
      }
      if (area >= minArea) parts.push({ x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1, area, area_frac: Number((area / Math.max(1, total)).toFixed(4)) });
    }
    parts.sort((a, b) => a.x - b.x || a.y - b.y);
    return parts;
  }

  computeMoments(binary, width, height) {
    let m00 = 0, m10 = 0, m01 = 0;
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const v = binary[y * width + x] ? 1 : 0;
      if (!v) continue;
      m00 += v; m10 += x * v; m01 += y * v;
    }
    return { m00, cx: Number((m10 / Math.max(1, m00)).toFixed(4)), cy: Number((m01 / Math.max(1, m00)).toFixed(4)) };
  }

  binaryDisagreement(a, b) {
    const n = Math.min(a.length, b.length);
    if (!n) return 1;
    let diff = 0;
    for (let i = 0; i < n; i++) if ((a[i] ? 1 : 0) !== (b[i] ? 1 : 0)) diff++;
    return diff / n;
  }

  projectionDistance(a, b) {
    const n = Math.max(a.length, b.length);
    if (!n) return 0;
    let total = 0;
    for (let i = 0; i < n; i++) total += Math.abs((a[i] || 0) - (b[i] || 0));
    return total / n;
  }

  computeColumnInk(binary, width, height) {
    const col = new Array(width).fill(0);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) col[x] += binary[y * width + x] ? 1 : 0;
    return col;
  }

  findClearVerticalGaps(binary, width, height, { minClearRun = 1, maxInkPerColumn = 0 } = {}) {
    const colInk = this.computeColumnInk(binary, width, height);
    const gaps = [];
    let start = -1;
    for (let x = 0; x < width; x++) {
      const clear = colInk[x] <= maxInkPerColumn;
      if (clear && start < 0) start = x;
      if (!clear && start >= 0) {
        if (x - start >= minClearRun) gaps.push({ x0: start, x1: x });
        start = -1;
      }
    }
    if (start >= 0 && width - start >= minClearRun) gaps.push({ x0: start, x1: width });
    return { colInk, gaps };
  }

  computeSectionBoxesFromVerticalSlices(binary, width, height, opts = {}) {
    const { minArea = 3, minClearRun = 1, maxInkPerColumn = 0 } = opts;
    const { gaps } = this.findClearVerticalGaps(binary, width, height, { minClearRun, maxInkPerColumn });
    const sections = [];
    let x = 0;
    for (const gap of gaps) {
      if (gap.x0 > x) {
        const crop = this.cropBinary(binary, width, height, x, gap.x0, 0, height);
        const trimmed = this.trimBinary(crop.binary, crop.w, crop.h);
        const area = trimmed.binary.reduce((a, b) => a + (b ? 1 : 0), 0);
        if (area >= minArea && trimmed.w > 0 && trimmed.h > 0) sections.push({ x: x + trimmed.x, y: trimmed.y, w: trimmed.w, h: trimmed.h, area });
      }
      x = gap.x1;
    }
    if (x < width) {
      const crop = this.cropBinary(binary, width, height, x, width, 0, height);
      const trimmed = this.trimBinary(crop.binary, crop.w, crop.h);
      const area = trimmed.binary.reduce((a, b) => a + (b ? 1 : 0), 0);
      if (area >= minArea && trimmed.w > 0 && trimmed.h > 0) sections.push({ x: x + trimmed.x, y: trimmed.y, w: trimmed.w, h: trimmed.h, area });
    }
    return { gaps, sections };
  }

  verticalOverlapRatio(a, b) {
    const top = Math.max(a.y, b.y);
    const bottom = Math.min(a.y + a.h, b.y + b.h);
    const overlap = Math.max(0, bottom - top);
    return overlap / Math.max(1, Math.min(a.h, b.h));
  }

  heightSimilarityRatio(a, b) {
    return Math.min(a.h, b.h) / Math.max(1, Math.max(a.h, b.h));
  }

  sectionGap(a, b) {
    return Math.max(0, b.x - (a.x + a.w));
  }

  isThinRunCandidate(runSections, lineHeight, settings) {
    if (!settings.mergeThinRunEnabled) return false;
    if (!Array.isArray(runSections) || runSections.length < 2 || runSections.length > settings.mergeSpanMaxSections) return false;

    const maxWidthPx = lineHeight * settings.mergeThinRunMaxWidthRatio;
    const maxGapPx = Math.min(settings.mergeSpanMaxGapPx, lineHeight * settings.mergeThinRunMaxGapRatio);

    for (const sec of runSections) {
      if (sec.w > maxWidthPx) return false;
    }

    for (let i = 0; i < runSections.length - 1; i++) {
      const a = runSections[i];
      const b = runSections[i + 1];
      if (this.sectionGap(a, b) > maxGapPx) return false;
      if (this.verticalOverlapRatio(a, b) < settings.mergeThinRunMinVOverlap) return false;
      if (this.heightSimilarityRatio(a, b) < settings.mergeThinRunMinHeightRatio) return false;
    }

    return true;
  }

  // Detects vertically-stacked two-part glyphs (e.g. sewi, lon, telo) where
  // a taller body section sits above a shorter base/accent section.
  // This is geometrically opposite to isThinRunCandidate (which detects
  // side-by-side narrow columns). The checks ensure:
  //   - exactly 2 sections (top body + bottom base)
  //   - small vertical gap between them
  //   - combined height covers a meaningful fraction of the line
  //   - sections are horizontally aligned (x overlap)
  //   - sections have similar widths (both part of the same glyph)
  //   - the bottom (shorter) section is genuinely thin — not another full glyph
  isStackedRunCandidate(runSections, lineHeight, settings) {
    if (!settings.mergeStackedRunEnabled) return false;
    if (!Array.isArray(runSections) || runSections.length !== 2) return false;

    const [a, b] = [...runSections].sort((x, y) => x.y - y.y);
    const gap = Math.max(0, b.y - (a.y + a.h));
    const combinedH = (b.y + b.h) - a.y;

    // Vertical gap must be small relative to combined height and absolute cap
    if (gap > combinedH * settings.stackedRunMaxGapRatio) return false;
    if (gap > settings.mergeSpanMaxGapPx) return false;

    // Combined height must represent a real glyph (not two noise specks)
    if (combinedH < lineHeight * settings.stackedRunMinCombinedHeightRatio) return false;

    // Sections must be similar width (both parts of same glyph, not adjacent glyphs)
    const wSim = Math.min(a.w, b.w) / Math.max(1, Math.max(a.w, b.w));
    if (wSim < settings.stackedRunMinWidthSim) return false;

    // Sections must be horizontally aligned (stacked above/below, not side by side)
    const xOverlap = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
    if (xOverlap / Math.max(1, Math.min(a.w, b.w)) < settings.stackedRunMinXOverlap) return false;

    // The shorter section must be a genuine base/accent, not a second full glyph.
    // If both sections are the same height, they are two separate stacked glyphs.
    const minH = Math.min(a.h, b.h);
    if (minH / Math.max(1, combinedH) > settings.stackedRunMaxBaseRatio) return false;

    return true;
  }

  // Detects glyphs that render as one wide body section + one or more thin
  // connector/accent strokes side-by-side (e.g. sewi = wide arc + thin vertical bar).
  // This is distinct from isThinRunCandidate (which requires ALL sections to be narrow)
  // and isStackedRunCandidate (which requires sections to be vertically stacked).
  // The pattern here is horizontal adjacency where exactly ONE section is the main
  // glyph body and the remaining sections are thin connecting strokes.
  isAsymmetricThinRunCandidate(runSections, lineHeight, settings) {
    if (!settings.mergeAsymThinRunEnabled) return false;
    if (!Array.isArray(runSections) || runSections.length < 2 || runSections.length > settings.mergeSpanMaxSections) return false;

    // Connector max width: use the larger of a ratio-based threshold and a
    // flat minimum pixel floor. The floor ensures detection still works at
    // small font sizes where ratio*lineHeight would be less than 1 pixel.
    const connectorMaxPx = Math.max(
      settings.asymThinConnectorMinPx,
      lineHeight * settings.asymThinConnectorMaxWidthRatio
    );
    const bodyMaxPx = lineHeight * settings.asymBodyMaxWidthRatio;
    const maxGapPx = Math.min(settings.mergeSpanMaxGapPx, lineHeight * settings.mergeThinRunMaxGapRatio);
    const minVOverlap = settings.mergeThinRunMinVOverlap;

    // Classify each section as body or connector
    const connectors = runSections.filter(s => s.w <= connectorMaxPx);
    const bodies = runSections.filter(s => s.w > connectorMaxPx);

    // Must have exactly 1 body + at least 1 connector
    if (bodies.length !== 1) return false;
    if (connectors.length < 1) return false;
    if (bodies[0].w > bodyMaxPx) return false;

    // Check all connectors are genuinely thin
    for (const c of connectors) {
      if (c.w > connectorMaxPx) return false;
    }

    // Check gaps and vertical overlap between all adjacent section pairs
    const sorted = runSections.slice().sort((a, b) => a.x - b.x);
    for (let i = 0; i < sorted.length - 1; i++) {
      const a = sorted[i], b = sorted[i + 1];
      if (this.sectionGap(a, b) > maxGapPx) return false;
      if (this.verticalOverlapRatio(a, b) < minVOverlap) return false;
    }

    return true;
  }

  buildMergedSectionBox(runSections) {
    const x0 = Math.min(...runSections.map(s => s.x));
    const y0 = Math.min(...runSections.map(s => s.y));
    const x1 = Math.max(...runSections.map(s => s.x + s.w));
    const y1 = Math.max(...runSections.map(s => s.y + s.h));
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }

  isThinPunctuationLikeToken(token) {
    return token === "." || token === "," || token === ":" || token === "·";
  }

  computeSplitThinPunctPenalty(path, line, settings) {
    if (!Array.isArray(path?.glyphs) || path.glyphs.length < 2) return 0;
    let penalty = 0;
    for (let i = 0; i < path.glyphs.length - 1; i++) {
      const g1 = path.glyphs[i];
      const g2 = path.glyphs[i + 1];
      const c1 = g1?.choice;
      const c2 = g2?.choice;
      if (!c1 || !c2) continue;
      const s1 = line.segments?.[g1.segmentIndex];
      const s2 = line.segments?.[g2.segmentIndex];
      if (!s1 || !s2) continue;
      const b1 = s1.rawBox || s1.bbox;
      const b2 = s2.rawBox || s2.bbox;
      if (!b1 || !b2) continue;
      const lineHeight = Math.max(1, line.estimatedFontPx || line.lineShared?.source_bbox?.h || 1);
      const narrow1 = b1.w <= lineHeight * settings.mergeThinRunMaxWidthRatio;
      const narrow2 = b2.w <= lineHeight * settings.mergeThinRunMaxWidthRatio;
      const close = this.sectionGap(b1, b2) <= Math.min(settings.mergeSpanMaxGapPx, lineHeight * settings.mergeThinRunMaxGapRatio);
      if (narrow1 && narrow2 && close && this.isThinPunctuationLikeToken(c1.latin_output) && this.isThinPunctuationLikeToken(c2.latin_output)) {
        penalty += settings.splitThinPunctPenalty;
      }
    }
    return penalty;
  }

  analyzeBinaryWithSharedSlices(binary, width, height, settings, sectionOpts = {}) {
    const trimmed = this.trimBinary(binary, width, height);
    const norm = this.resizeBinaryNearest(trimmed.binary, trimmed.w, trimmed.h, settings.normSize, settings.normSize);
    const projections = this.computeProjections(norm, settings.normSize, settings.normSize);
    const parts = this.analyzeConnectedParts(norm, settings.normSize, settings.normSize, 1);
    const slices = this.computeSectionBoxesFromVerticalSlices(trimmed.binary, trimmed.w, trimmed.h, sectionOpts);
    const normSlices = this.computeSectionBoxesFromVerticalSlices(norm, settings.normSize, settings.normSize, { minArea: 1, minClearRun: 1, maxInkPerColumn: 0 });
    return {
      source_bbox: { x: trimmed.x, y: trimmed.y, w: trimmed.w, h: trimmed.h },
      norm_width: settings.normSize,
      norm_height: settings.normSize,
      aspect_ratio: Number((trimmed.w / Math.max(1, trimmed.h)).toFixed(4)),
      fill_ratio: Number((norm.reduce((a, b) => a + (b ? 1 : 0), 0) / Math.max(1, settings.normSize * settings.normSize)).toFixed(4)),
      part_count: parts.length,
      part_layout: parts,
      row_projection: projections.row,
      col_projection: projections.col,
      moments: this.computeMoments(norm, settings.normSize, settings.normSize),
      source_vertical_gaps: slices.gaps,
      source_sections: slices.sections,
      norm_vertical_gaps: normSlices.gaps,
      norm_sections: normSlices.sections,
      _trimmed_binary: trimmed.binary,
      _trimmed_width: trimmed.w,
      _trimmed_height: trimmed.h,
      _norm_binary: norm,
      norm_binary: norm,
    };
  }

  analyzeCanvas(canvas, settings) {
    const ctx = get2dContext(canvas, { readback: true });
    const { width, height } = canvas;
    const imageData = ctx.getImageData(0, 0, width, height);
    const { binary, threshold } = this.imageDataToGrayMask(imageData, width, height, settings);
    const analyzed = this.analyzeBinaryWithSharedSlices(binary, width, height, settings, { minArea: 2, minClearRun: 1, maxInkPerColumn: 0 });
    analyzed.threshold = threshold;
    return analyzed;
  }

  findLineBands(binary, width, height) {
    const row = new Array(height).fill(0);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) row[y] += binary[y * width + x] ? 1 : 0;
    const denseThreshold = Math.max(1, Math.floor(width * 0.006));
    const sparseThreshold = 1;
    const rawBands = [];
    let start = -1;
    let mode = "dense";
    for (let y = 0; y < height; y++) {
      const dense = row[y] >= denseThreshold;
      const sparse = row[y] >= sparseThreshold;
      if (start < 0) {
        if (dense || sparse) { start = y; mode = dense ? "dense" : "sparse"; }
        continue;
      }
      if (!sparse) {
        const bandH = y - start;
        const minBand = mode === "dense" ? 3 : 1;
        if (bandH >= minBand) rawBands.push({ y0: start, y1: y, height: bandH, mode });
        start = -1; mode = "dense";
      } else if (dense) {
        mode = "dense";
      }
    }
    if (start >= 0) {
      const bandH = height - start;
      const minBand = mode === "dense" ? 3 : 1;
      if (bandH >= minBand) rawBands.push({ y0: start, y1: height, height: bandH, mode });
    }
    const merged = [];
    const mergeGapPx = 8;
    const mergeHeightPx = 12;

    for (const band of rawBands) {
      const prev = merged.length ? merged[merged.length - 1] : null;
      const gap = prev ? (band.y0 - prev.y1) : Infinity;

      // Merge nearby sparse punctuation bands back into the previous line.
      // This fixes cases like final ".,:" where a low comma becomes its own line.
      const shouldMerge =
        prev &&
        (
          gap <= 3 ||
          (
            gap <= mergeGapPx &&
            (band.height <= mergeHeightPx || prev.height <= mergeHeightPx)
          )
        );

      if (shouldMerge) {
        prev.y1 = band.y1;
        prev.height = prev.y1 - prev.y0;
        prev.mode = (prev.mode === "dense" || band.mode === "dense") ? "dense" : "sparse";
      } else {
        merged.push({ ...band });
      }
    }
    return merged.filter(band => {
      let ink = 0; for (let y = band.y0; y < band.y1; y++) ink += row[y];
      return ink >= 2;
    });
  }

  rotateBinaryNearest(binary, width, height, angleDeg) {
    const angle = angleDeg * Math.PI / 180;
    const cx = (width - 1) / 2, cy = (height - 1) / 2;
    const out = new Uint8Array(binary.length);
    const cos = Math.cos(-angle), sin = Math.sin(-angle);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const dx = x - cx, dy = y - cy;
      const sx = Math.round(dx * cos - dy * sin + cx);
      const sy = Math.round(dx * sin + dy * cos + cy);
      if (sx >= 0 && sy >= 0 && sx < width && sy < height) out[y * width + x] = binary[sy * width + sx];
    }
    return out;
  }

  scoreDeskew(binary, width, height) {
    const rowSums = new Float64Array(height);
    for (let y = 0; y < height; y++) {
      let sum = 0;
      for (let x = 0; x < width; x++) sum += binary[y * width + x] ? 1 : 0;
      rowSums[y] = sum;
    }
    let mean = 0; for (const v of rowSums) mean += v; mean /= Math.max(1, rowSums.length);
    let variance = 0; for (const v of rowSums) variance += (v - mean) * (v - mean);
    return variance / Math.max(1, rowSums.length);
  }

  estimateDeskew(binary, width, height, settings) {
    let bestAngle = 0, bestScore = this.scoreDeskew(binary, width, height);
    for (let angle = -settings.deskewRange; angle <= settings.deskewRange + 1e-9; angle += settings.deskewStep) {
      const rotated = this.rotateBinaryNearest(binary, width, height, angle);
      const score = this.scoreDeskew(rotated, width, height);
      if (score > bestScore) { bestScore = score; bestAngle = Number(angle.toFixed(3)); }
    }
    return bestAngle;
  }

  async estimateFontSizeFromImageCanvas(imageCanvas, settingsInput = {}) {
    const settings = this.normalizeSettings(settingsInput);
    const ctx = get2dContext(imageCanvas, { readback: true });
    const imageData = ctx.getImageData(0, 0, imageCanvas.width, imageCanvas.height);
    const { binary } = this.imageDataToGrayMask(imageData, imageCanvas.width, imageCanvas.height, settings);
    const bestAngle = this.estimateDeskew(binary, imageCanvas.width, imageCanvas.height, settings);
    const rotated = this.rotateBinaryNearest(binary, imageCanvas.width, imageCanvas.height, bestAngle);
    const lineBands = this.findLineBands(rotated, imageCanvas.width, imageCanvas.height);
    const heights = [];
    for (const lineBand of lineBands) {
      const cropped = this.cropBinary(rotated, imageCanvas.width, imageCanvas.height, 0, imageCanvas.width, lineBand.y0, lineBand.y1);
      const shared = this.analyzeBinaryWithSharedSlices(cropped.binary, cropped.w, cropped.h, settings, { minArea: 3, minClearRun: 1, maxInkPerColumn: 0 });
      for (const sec of (shared.source_sections || [])) if (sec.h > 0) heights.push(sec.h);
    }
    let estimate = median(heights);
    if (!Number.isFinite(estimate)) estimate = median(lineBands.map(lb => Number(lb.height) || 0));
    if (!Number.isFinite(estimate)) estimate = 56;
    return { fontPx: clamp(Math.round(estimate), 8, 220), deskewAngle: bestAngle, lineCount: lineBands.length, rawSectionHeights: heights.slice() };
  }

  _normalizedSectionSignature(sections, width, height) {
    return (sections || []).map(sec => ({
      w: Number((sec.w / Math.max(1, width)).toFixed(4)),
      h: Number((sec.h / Math.max(1, height)).toFixed(4)),
      cx: Number(((sec.x + sec.w / 2) / Math.max(1, width)).toFixed(4)),
    }));
  }

  _sectionDistance(obsDesc, exDesc) {
    const a = this._normalizedSectionSignature(obsDesc.source_sections || [], obsDesc.source_bbox?.w || obsDesc._trimmed_width || 1, obsDesc.source_bbox?.h || obsDesc._trimmed_height || 1);
    const b = this._normalizedSectionSignature(exDesc.source_sections || [], exDesc.source_bbox?.w || exDesc._trimmed_width || 1, exDesc.source_bbox?.h || exDesc._trimmed_height || 1);
    const countPenalty = Math.abs(a.length - b.length);
    const n = Math.min(a.length, b.length);
    let widthDist = 0, centerDist = 0;
    for (let i = 0; i < n; i++) {
      widthDist += Math.abs(a[i].w - b[i].w);
      centerDist += Math.abs(a[i].cx - b[i].cx);
    }
    return { countPenalty, widthDist: n ? widthDist / n : (a.length || b.length ? 1 : 0), centerDist: n ? centerDist / n : (a.length || b.length ? 1 : 0) };
  }

  _relaxedVariants(binary, width, height, settings) {
    const variants = [{ dx0: 0, dx1: 0, dy0: 0, dy1: 0 }];
    if (width > 2) { variants.push({ dx0: -1, dx1: 0, dy0: 0, dy1: 0 }); variants.push({ dx0: 0, dx1: 1, dy0: 0, dy1: 0 }); }
    if (height > 2) { variants.push({ dx0: 0, dx1: 0, dy0: -1, dy1: 0 }); variants.push({ dx0: 0, dx1: 0, dy0: 0, dy1: 1 }); }
    const out = [];
    for (const v of variants) {
      const x0 = Math.max(0, 0 + Math.min(0, v.dx0));
      const y0 = Math.max(0, 0 + Math.min(0, v.dy0));
      const x1 = Math.min(width, width + Math.max(0, v.dx1));
      const y1 = Math.min(height, height + Math.max(0, v.dy1));
      const crop = this.cropBinary(binary, width, height, x0, x1, y0, y1);
      out.push(this.analyzeBinaryWithSharedSlices(crop.binary, crop.w, crop.h, settings, { minArea: 2, minClearRun: 1, maxInkPerColumn: 0 }));
    }
    return out;
  }

  scoreObservedAgainstExemplar(obsVariants, exemplarDesc, weightsInput = {}) {
    const weights = this.normalizeWeights(weightsInput);
    let best = null;
    for (const obsDesc of obsVariants) {
      const row = this.projectionDistance(obsDesc.row_projection, exemplarDesc.row_projection);
      const col = this.projectionDistance(obsDesc.col_projection, exemplarDesc.col_projection);
      const fill = Math.abs(obsDesc.fill_ratio - exemplarDesc.fill_ratio);
      const aspect = Math.abs(obsDesc.aspect_ratio - exemplarDesc.aspect_ratio);
      const partCount = Math.abs(obsDesc.part_count - exemplarDesc.part_count);
      const pixel = exemplarDesc._norm_binary?.length ? this.binaryDisagreement(obsDesc._norm_binary, exemplarDesc._norm_binary) : 1;
      const section = this._sectionDistance(obsDesc, exemplarDesc);
      const total = row * weights.rowProjection + col * weights.colProjection + fill * weights.fillRatio + aspect * weights.aspectRatio + partCount * weights.partCount + section.countPenalty * weights.sectionCount + section.widthDist * weights.sectionWidths + section.centerDist * weights.sectionCenters + pixel * weights.pixel;
      const breakdown = {
        rowProjection: Number(row.toFixed(6)), colProjection: Number(col.toFixed(6)), fillRatio: Number(fill.toFixed(6)),
        aspectRatio: Number(aspect.toFixed(6)), partCount: Number(partCount.toFixed(6)), sectionCount: Number(section.countPenalty.toFixed(6)),
        sectionWidths: Number(section.widthDist.toFixed(6)), sectionCenters: Number(section.centerDist.toFixed(6)), pixel: Number(pixel.toFixed(6)),
      };
      if (!best || total < best.total) best = { total: Number(total.toFixed(6)), breakdown, observed: obsDesc };
    }
    return best || { total: Number.POSITIVE_INFINITY, breakdown: {}, observed: obsVariants[0] || null };
  }

  rankSegmentAgainstBank(segmentBinary, width, height, bank, settingsInput = {}, weightsInput = {}) {
    const settings = this.normalizeSettings(settingsInput);
    const obsVariants = this._relaxedVariants(segmentBinary, width, height, settings);
    const scored = [];
    for (const cls of (bank?.classes || [])) {
      let bestForClass = null;
      for (const ex of (cls.exemplars || [])) {
        const scoredEx = this.scoreObservedAgainstExemplar(obsVariants, ex, weightsInput);
        if (!bestForClass || scoredEx.total < bestForClass.total) {
          bestForClass = { class_id: cls.class_id, latin_output: cls.latin_output, glyph_id: cls.glyph_id, total: scoredEx.total, breakdown: scoredEx.breakdown, exemplar: ex, observed: scoredEx.observed };
        }
      }
      if (bestForClass) scored.push(bestForClass);
    }
    scored.sort((a, b) => a.total - b.total || a.latin_output.localeCompare(b.latin_output));
    return scored.slice(0, settings.topGlyphAlts);
  }

  rankMergedRunAgainstBank(lineBinary, lineW, lineH, mergedBox, bank, settingsInput = {}, scoreWeights = {}, mergeKind = "thin") {
    const settings = this.normalizeSettings(settingsInput);
    const crop = this.cropBinary(
      lineBinary,
      lineW,
      lineH,
      mergedBox.x,
      mergedBox.x + mergedBox.w,
      mergedBox.y,
      mergedBox.y + mergedBox.h
    );
    const ranked = this.rankSegmentAgainstBank(crop.binary, crop.w, crop.h, bank, settings, scoreWeights);
    const bonus = mergeKind === "stacked" ? settings.mergeStackedRunBonus
                : mergeKind === "asymThin" ? settings.mergeAsymThinRunBonus
                : settings.mergeThinRunBonus;
    return ranked.map(item => ({
      ...item,
      total: Number((item.total - bonus).toFixed(6)),
      mergedSpan: true,
      mergeKind,
      mergedBox: { ...mergedBox }
    }));
  }

  async buildReferenceBank({ catalog = DEFAULT_CATALOG, settings: settingsInput = {}, scriptFamily, fontLabel = "ReferenceBank" }) {
    const settings = this.normalizeSettings(settingsInput);
    if (!scriptFamily) throw new Error("scriptFamily is required to build reference bank.");
    const parsedCatalog = this.parseCatalog(catalog, DEFAULT_CATALOG);

    // ── UCSUR codepoints for structure frames ────────────────────────────────
    // These are rendered directly using renderGlyphStringToCanvas (same fast
    // path as normal glyphs) with FONT_FAMILY_TEXT — no heavy renderer needed.
    const CP_CART_START = 0xF1990;  // cartouche start bracket
    const CP_CART_END   = 0xF1991;  // cartouche end bracket
    const CP_LONGPI     = 0xF1993;  // long-pi start (combines with glyph cp)

    // nanpa codepoint for calibration — nanpa is wide and centrally placed
    const CP_NANPA = 0xF193D;

    // ── Calibrate frame geometry once per source size using nanpa ─────────────
    // Render [ nanpa ] and pi( nanpa ) as raw codepoint strings.
    // From each render measure:
    //   - Actual edge ink densities (top/bot/left/right) → used for classification
    //   - Frame margin pixels (where interior ink starts/ends) → used for gap search
    // This means classification thresholds are derived from the actual font
    // geometry, not hardcoded guesses that break for rounded cartouche styles.
    const structureCalibration = {};
    {
      const cartBandTop = settings.structureCartoucheGapBandTop;
      const cartBandBot = settings.structureCartoucheGapBandBottom;
      const lpBandTop   = settings.structureLongPiGapBandTop;
      const lpBandBot   = settings.structureLongPiGapBandBottom;
      const edgeFrac    = settings.structureFrameEdgeRatio ?? 0.12;

      for (const size of settings.sourceSizes) {
        let cartoucheLeftPx = 0, cartoucheRightPx = 0, longpiLeftPx = 0;
        let cartoucheTopD = null, cartoucheBotD = null, cartoucheLeftD = null, cartoucheRightD = null;
        let longpiBotD = null, longpiLeftD = null;
        let calibW = 0, calibH = 0, edgeRows = 0, edgeCols = 0;

        try {
          const cartStr    = String.fromCodePoint(CP_CART_START, CP_NANPA, CP_CART_END);
          const cartCanvas = this.hooks.renderGlyphStringToCanvas(cartStr, scriptFamily, size, 20);
          const cartDesc   = this.analyzeCanvas(cartCanvas, settings);
          const cw = cartDesc._trimmed_width  || cartCanvas.width;
          const ch = cartDesc._trimmed_height || cartCanvas.height;
          const cb = cartDesc._trimmed_binary;

          // Measure actual edge densities from the calibration render
          const cartRows = _structRowDensities(cb, cw, ch);
          const cartCols = _structColDensities(cb, cw, ch);
          edgeRows = Math.max(1, Math.round(ch * edgeFrac));
          edgeCols = Math.max(1, Math.round(cw * edgeFrac));
          cartoucheTopD   = _structSliceMean(cartRows, 0, edgeRows);
          cartoucheBotD   = _structSliceMean(cartRows, Math.max(0, ch - edgeRows), ch);
          cartoucheLeftD  = _structSliceMean(cartCols, 0, edgeCols);
          cartoucheRightD = _structSliceMean(cartCols, Math.max(0, cw - edgeCols), cw);
          calibW = cw;
          calibH = ch;

          // Measure frame margins (where interior glyph ink starts/ends)
          const m = _measureFrameMargins(cb, cw, ch, cartBandTop, cartBandBot);
          cartoucheLeftPx  = m.leftMarginPx;
          cartoucheRightPx = m.rightMarginPx;
        } catch (_) {}

        try {
          const lpStr    = String.fromCodePoint(CP_LONGPI, CP_NANPA);
          const lpCanvas = this.hooks.renderGlyphStringToCanvas(lpStr, scriptFamily, size, 20);
          const lpDesc   = this.analyzeCanvas(lpCanvas, settings);
          const lw = lpDesc._trimmed_width  || lpCanvas.width;
          const lh = lpDesc._trimmed_height || lpCanvas.height;
          const lb = lpDesc._trimmed_binary;

          // Measure actual edge densities
          const lpRows = _structRowDensities(lb, lw, lh);
          const lpCols = _structColDensities(lb, lw, lh);
          const lpEdgeRows = Math.max(1, Math.round(lh * edgeFrac));
          const lpEdgeCols = Math.max(1, Math.round(lw * edgeFrac));
          longpiBotD  = _structSliceMean(lpRows, Math.max(0, lh - lpEdgeRows), lh);
          longpiLeftD = _structSliceMean(lpCols, 0, lpEdgeCols);

          // Measure left margin
          const m = _measureFrameMargins(lb, lw, lh, lpBandTop, lpBandBot);
          longpiLeftPx = m.leftMarginPx;
        } catch (_) {}

        structureCalibration[size] = {
          // Frame margin pixels for gap-search horizontal banding
          cartoucheLeftPx, cartoucheRightPx, longpiLeftPx,
          // Actual measured edge densities for classification
          cartoucheTopD, cartoucheBotD, cartoucheLeftD, cartoucheRightD,
          longpiBotD, longpiLeftD,
          // Reference dimensions so we can scale edge band sizes to blob size
          calibW, calibH, edgeRows, edgeCols,
        };
      }
    }

    // ── Build normal exemplars for each catalog item ─────────────────────────
    // Structure exemplars (cartouche/longpi) are NOT stored per-glyph.
    // Interior glyphs are scored against normal exemplars after frame removal.
    const classes = [];
    for (const item of parsedCatalog) {
      const token        = normalizeGlyphKey(item.glyph_id || item.render_text || item.latin_output);
      const renderString = this.hooks.tokenToGlyphString
        ? await this.hooks.tokenToGlyphString(token)
        : token;
      const exemplars = [];
      for (const size of settings.sourceSizes) {
        const rendered = this.hooks.renderGlyphStringToCanvas(String(renderString || ' '), scriptFamily, size, 20);
        const desc = this.analyzeCanvas(rendered, settings);
        exemplars.push({
          source_render_size: size,
          norm_width: desc.norm_width, norm_height: desc.norm_height,
          aspect_ratio: desc.aspect_ratio, fill_ratio: desc.fill_ratio,
          part_count: desc.part_count, part_layout: desc.part_layout,
          row_projection: desc.row_projection, col_projection: desc.col_projection,
          bbox: desc.source_bbox, source_bbox: desc.source_bbox, moments: desc.moments,
          source_vertical_gaps: desc.source_vertical_gaps, source_sections: desc.source_sections,
          norm_vertical_gaps: desc.norm_vertical_gaps, norm_sections: desc.norm_sections,
          _norm_binary: desc._norm_binary, _trimmed_binary: desc._trimmed_binary,
          _trimmed_width: desc._trimmed_width, _trimmed_height: desc._trimmed_height,
          _previewCanvas: rendered,
        });
      }
      classes.push({ class_id: item.class_id, glyph_id: item.glyph_id, context_type: item.context_type, semantic_token: item.semantic_token, latin_output: item.latin_output, render_text: item.render_text, render_mode: item.render_mode, exemplars });
    }

    const bank = {
      font: { font_label: fontLabel, family_name: scriptFamily, uploaded_filename: "" },
      normalization: { norm_size: settings.normSize, source_sizes: settings.sourceSizes.slice() },
      classes,
      settings,
      structureCalibration, // per-size frame margin measurements
    };
    this.lastBank = bank;
    return bank;
  }

  async _renderLatinLineBinary(text, scriptFamily, fontPx, settings) {
    const glyphString = this.hooks.renderLatinLineToGlyphString ? await this.hooks.renderLatinLineToGlyphString(text || " ") : String(text || " ");
    const canvas = this.hooks.renderGlyphStringToCanvas(String(glyphString || " "), scriptFamily, Math.max(8, Math.round(fontPx)), 20);
    const desc = this.analyzeCanvas(canvas, settings);
    return { canvas, binary: desc._norm_binary, row_projection: desc.row_projection, col_projection: desc.col_projection, descriptor: desc };
  }

  shiftBinary(binary, width, height, dx, dy) {
    const out = new Uint8Array(binary.length);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const sx = x - dx;
        const sy = y - dy;
        if (sx >= 0 && sy >= 0 && sx < width && sy < height) {
          out[y * width + x] = binary[sy * width + sx];
        }
      }
    }
    return out;
  }

  async scoreWholeLineWithWiggle(candidateText, observedLine, scriptFamily, fontPx, settingsInput = {}) {
    const settings = this.normalizeSettings(settingsInput);
    const rendered = await this._renderLatinLineBinary(candidateText, scriptFamily, fontPx, settings);

    const wiggleX = settings.postRuleWiggleEnabled ? (settings.postRuleWiggleX || [0]) : [0];
    const wiggleY = settings.postRuleWiggleEnabled ? (settings.postRuleWiggleY || [0]) : [0];

    let best = null;

    for (const dx of wiggleX) {
      for (const dy of wiggleY) {
        const shifted = this.shiftBinary(rendered.binary, settings.normSize, settings.normSize, dx, dy);
        const pix = this.binaryDisagreement(observedLine.norm_binary, shifted);
        const row = this.projectionDistance(observedLine.row_projection, rendered.row_projection);
        const col = this.projectionDistance(observedLine.col_projection, rendered.col_projection);
        const total = Number((pix * 0.45 + row * 0.2 + col * 0.2).toFixed(6));

        if (!best || total < best.total) {
          best = { total, dx, dy };
        }
      }
    }

    return best || { total: Number.POSITIVE_INFINITY, dx: 0, dy: 0 };
  }

  async scoreWholeLine(candidateText, observedLine, scriptFamily, fontPx, settingsInput = {}) {
    const settings = this.normalizeSettings(settingsInput);
    const rendered = await this._renderLatinLineBinary(candidateText, scriptFamily, fontPx, settings);
    const pix = this.binaryDisagreement(observedLine.norm_binary, rendered.binary);
    const row = this.projectionDistance(observedLine.row_projection, rendered.row_projection);
    const col = this.projectionDistance(observedLine.col_projection, rendered.col_projection);
    return Number((pix * 0.45 + row * 0.2 + col * 0.2).toFixed(6));
  }

  async scoreLocalSpan(spanText, observedCropBinary, observedCropW, observedCropH, scriptFamily, fontPx, settingsInput = {}) {
    const settings = this.normalizeSettings(settingsInput);
    const rendered = await this._renderLatinLineBinary(spanText, scriptFamily, fontPx, settings);
    const cropDesc = this.analyzeBinaryWithSharedSlices(observedCropBinary, observedCropW, observedCropH, settings, { minArea: 2, minClearRun: 1, maxInkPerColumn: 0 });
    const pix = this.binaryDisagreement(cropDesc.norm_binary, rendered.binary);
    const row = this.projectionDistance(cropDesc.row_projection, rendered.row_projection);
    const col = this.projectionDistance(cropDesc.col_projection, rendered.col_projection);
    return Number((pix * 0.55 + row * 0.2 + col * 0.2).toFixed(6));
  }

  buildDecodeUnits(line, bank, settings) {
    const units = [];
    for (let i = 0; i < line.segments.length; i++) {
      const seg = line.segments[i];
      units.push({
        start: i,
        endExclusive: i + 1,
        textChoices: seg.alternatives || [],
        kind: "segment",
        source: seg
      });
    }
    for (const merged of (line.mergedCandidates || [])) {
      units.push({
        start: merged.start,
        endExclusive: merged.endExclusive,
        textChoices: merged.alternatives || [],
        kind: "merged",
        source: merged
      });
    }
    units.sort((a, b) => a.start - b.start || (b.endExclusive - b.start) - (a.endExclusive - a.start));
    return units;
  }

  async decodeLineWithBeam(line, bank, scriptFamily, settingsInput = {}) {
    const settings = this.normalizeSettings(settingsInput);
    const units = this.buildDecodeUnits(line, bank, settings);
    let beam = [{ pos: 0, text: "", glyphs: [], localScore: 0 }];

    while (beam.length) {
      const allComplete = beam.every(path => path.pos >= line.segments.length);
      if (allComplete) break;

      const next = [];
      for (const path of beam) {
        if (path.pos >= line.segments.length) {
          next.push(path);
          continue;
        }
        const availableUnits = units.filter(u => u.start === path.pos);
        for (const unit of availableUnits) {
          for (const alt of unit.textChoices) {
            const tokenText = alt.latin_output;
            const nextText = path.text ? `${path.text} ${tokenText}` : tokenText;
            let localScore = path.localScore + Number(alt.total || 0);

            if (unit.kind === "merged") {
              const mb = unit.source.mergedBox;
              const localCrop = this.cropBinary(
                line.lineBinary,
                line.lineBinaryW,
                line.lineBinaryH,
                mb.x,
                mb.x + mb.w,
                mb.y,
                mb.y + mb.h
              );
              const localSpanScore = await this.scoreLocalSpan(
                tokenText,
                localCrop.binary,
                localCrop.w,
                localCrop.h,
                scriptFamily,
                line.estimatedFontPx,
                settings
              );
              localScore += localSpanScore * settings.localSpanScoreWeight;
            }

            const nextGlyphs = path.glyphs.concat([{
              segmentIndex: unit.start,
              segmentEndExclusive: unit.endExclusive,
              choice: alt,
              unitKind: unit.kind,
              mergedSpan: unit.kind === "merged"
            }]);

            const punctPenalty = this.computeSplitThinPunctPenalty({ glyphs: nextGlyphs }, line, settings);
            localScore += punctPenalty;

            next.push({
              pos: unit.endExclusive,
              text: nextText,
              glyphs: nextGlyphs,
              localScore
            });
          }
        }
      }
      next.sort((a, b) => a.localScore - b.localScore || a.text.localeCompare(b.text));
      beam = next.slice(0, settings.beamWidth);
    }

    const rescored = [];
    for (const path of beam) {
      const lineScore = await this.scoreWholeLine(path.text, line.observedDescriptor, scriptFamily, line.estimatedFontPx, settings);
      rescored.push({ ...path, lineScore, totalScore: Number((path.localScore + lineScore * 4).toFixed(6)) });
    }
    rescored.sort((a, b) => a.totalScore - b.totalScore || a.text.localeCompare(b.text));
    return rescored.slice(0, settings.topLineAlts);
  }

  normalizePostRules(rules) {
    const source = Array.isArray(rules) ? rules : DEFAULT_POST_RULES;
    return source
      .filter(rule => rule && rule.enabled !== false)
      .map(rule => ({
        id: String(rule.id || ""),
        enabled: rule.enabled !== false,
        whenTokens: Array.isArray(rule.whenTokens) ? rule.whenTokens.map(String) : [],
        replacementTokens: Array.isArray(rule.replacementTokens)
          ? rule.replacementTokens.map(String)
          : [],
        compareCandidateToken: rule.compareCandidateToken
          ? String(rule.compareCandidateToken).trim()
          : "",
        applyBonus: Number(rule.applyBonus || 0),
      }))
      .filter(rule =>
        rule.whenTokens.length > 0 &&
        (rule.replacementTokens.length > 0 || !!rule.compareCandidateToken)
      );
  }

  tokensMatchAt(tokens, startIndex, pattern) {
    if (startIndex < 0 || startIndex + pattern.length > tokens.length) return false;
    for (let i = 0; i < pattern.length; i++) {
      if (tokens[startIndex + i] !== pattern[i]) return false;
    }
    return true;
  }

  async  applyPostDecodeRules(line, bank, settingsInput = {}, postRulesInput = null) {
    const settings = this.normalizeSettings(settingsInput);
    const rules = this.normalizePostRules(postRulesInput);
    if (!line || !Array.isArray(line.alternatives) || !line.alternatives.length) return line?.alternatives || [];
    if (!rules.length) return line.alternatives;

    const patched = [];

    for (const altLine of line.alternatives) {
      let glyphs = Array.isArray(altLine.glyphs) ? altLine.glyphs.slice() : [];
      let tokens = String(altLine.text || "").trim().split(/\s+/).filter(Boolean);
      let changed = false;
      const diagnostics = [];

      for (const rule of rules) {
        let i = 0;
        while (i <= tokens.length - rule.whenTokens.length) {
          if (!this.tokensMatchAt(tokens, i, rule.whenTokens)) {
            i++;
            continue;
          }

        if (rule.replacementTokens.length > 0) {
            const originalTokens = tokens.slice(i, i + rule.whenTokens.length);
            const replacementTokens = rule.replacementTokens.slice();
            const candidateTokens = tokens.slice();
            candidateTokens.splice(i, rule.whenTokens.length, ...replacementTokens);
            const candidateText = candidateTokens.join(" ");

            const matchedGlyphs = glyphs.slice(i, i + rule.whenTokens.length).filter(Boolean);
            if (!matchedGlyphs.length) {
              i++;
              continue;
            }

            const coveredSegStarts = matchedGlyphs.map(g => Number(g.segmentIndex)).filter(Number.isFinite);
            const coveredSegEnds = matchedGlyphs.map(g => Number(g.segmentEndExclusive ?? (g.segmentIndex + 1))).filter(Number.isFinite);

            if (!coveredSegStarts.length || !coveredSegEnds.length) {
              i++;
              continue;
            }

            const segStart = Math.min(...coveredSegStarts);
            const segEndExclusive = Math.max(...coveredSegEnds);

            const coveredSegs = line.segments.slice(segStart, segEndExclusive).filter(Boolean);
            if (!coveredSegs.length) {
              i++;
              continue;
            }

            const spanX0 = Math.min(...coveredSegs.map(seg => seg.bbox.x));
            const spanX1 = Math.max(...coveredSegs.map(seg => seg.bbox.x + seg.bbox.w));

            const spanY0Abs = Math.min(...coveredSegs.map(seg => seg.bbox.y));
            const spanY1Abs = Math.max(...coveredSegs.map(seg => seg.bbox.y + seg.bbox.h));

            const spanY0 = Math.max(0, spanY0Abs - line.y0);
            const spanY1 = Math.min(line.lineBinaryH, spanY1Abs - line.y0);

            const localCrop = this.cropBinary(
              line.lineBinary,
              line.lineBinaryW,
              line.lineBinaryH,
              spanX0,
              spanX1,
              spanY0,
              spanY1
            );

            const replacementSpanText = replacementTokens.join(" ");
            const currentSpanText = originalTokens.join(" ");

            const replacementLocalScore = await this.scoreLocalSpan(
              replacementSpanText,
              localCrop.binary,
              localCrop.w,
              localCrop.h,
              bank?.font?.family_name || "",
              line.estimatedFontPx,
              settings
            );

            const currentLocalScore = await this.scoreLocalSpan(
              currentSpanText,
              localCrop.binary,
              localCrop.w,
              localCrop.h,
              bank?.font?.family_name || "",
              line.estimatedFontPx,
              settings
            );

            const adjustedReplacementScore = replacementLocalScore - Number(rule.applyBonus || 0);
            const applied = adjustedReplacementScore < currentLocalScore;

            diagnostics.push({
              ruleId: rule.id,
              matchedAt: i,
              originalTokens: originalTokens.slice(),
              replacementTokens: replacementTokens.slice(),
              mode: "direct_replace_local_span",
              replacementScore: replacementLocalScore,
              adjustedReplacementScore,
              currentScore: currentLocalScore,
              applied,
              spanBox: {
                x: spanX0,
                y: spanY0,
                w: spanX1 - spanX0,
                h: spanY1 - spanY0,
                yAbsolute: spanY0Abs
              }
            });

            // Only apply if the replacement renders better against the actual pixels
            if (applied) {
              tokens.splice(i, rule.whenTokens.length, ...replacementTokens);

              const replacementGlyphs = replacementTokens.map((tok, idx) => {
                const sourceGlyph = glyphs[Math.min(i + idx, glyphs.length - 1)] || {};
                const sourceChoice = sourceGlyph.choice || {};
                return {
                  ...sourceGlyph,
                  choice: {
                    ...sourceChoice,
                    latin_output: tok,
                    glyph_id: tok,
                    total: Number(sourceChoice.total || 0),
                    breakdown: {
                      ...(sourceChoice.breakdown || {}),
                      postRuleDirectReplace: true,
                      postRuleLocalSpanScore: replacementLocalScore,
                      postRuleAdjustedScore: adjustedReplacementScore,
                      postRuleApplyBonus: Number(rule.applyBonus || 0)
                    }
                  }
                };
              });

              glyphs.splice(i, rule.whenTokens.length, ...replacementGlyphs);

              changed = true;
              i += replacementTokens.length;
              continue;
            } else {
              // Replacement didn't score better — skip past this match
              i += rule.whenTokens.length;
              continue;
            }
          }

          if (rule.compareCandidateToken) {
            const targetTokenIndex = i;
            if (targetTokenIndex >= glyphs.length) {
              i++;
              continue;
            }

            const segInfo = glyphs[targetTokenIndex];
            const seg = line.segments?.[targetTokenIndex];
            const currentChoice = segInfo?.choice;

            if (!seg || !Array.isArray(seg.alternatives) || !currentChoice) {
              i++;
              continue;
            }

            const replacementAlt = seg.alternatives.find(a => a.latin_output === rule.compareCandidateToken);

            diagnostics.push({
              ruleId: rule.id,
              matchedAt: i,
              originalTokens: [tokens[targetTokenIndex]],
              replacementTokens: replacementAlt ? [rule.compareCandidateToken] : [],
              mode: "compare_candidate",
              currentScore: Number(currentChoice.total || 0),
              replacementScore: Number(replacementAlt?.total ?? NaN)
            });

            if (replacementAlt) {
              const currentScore = Number(currentChoice.total);
              const replacementScore = Number(replacementAlt.total);

              if (Number.isFinite(currentScore) && Number.isFinite(replacementScore) && replacementScore < currentScore) {
                tokens[targetTokenIndex] = rule.compareCandidateToken;
                glyphs[targetTokenIndex] = {
                  ...segInfo,
                  choice: replacementAlt
                };
                changed = true;
              }
            }

            i++;
            continue;
          }

          i++;
        }
      }

      let localScore = Number(altLine.localScore || 0);
      if (changed) {
        localScore = glyphs.reduce((sum, g) => sum + Number(g?.choice?.total || 0), 0);
      }

      patched.push({
        ...altLine,
        text: tokens.join(" "),
        glyphs,
        localScore: Number(localScore.toFixed(6)),
        totalScore: Number((localScore + Number(altLine.lineScore || 0) * 4).toFixed(6)),
        _postPatched: changed,
        _postRuleDiagnostics: diagnostics
      });
    }

    patched.sort((a, b) => a.totalScore - b.totalScore || a.text.localeCompare(b.text));
    const sliced = patched.slice(0, settings.topLineAlts);
    line.postRuleDiagnostics = sliced[0]?._postRuleDiagnostics ? sliced[0]._postRuleDiagnostics.slice() : [];
    line.postRuleApplied = !!line.postRuleDiagnostics.length;
    return sliced;
  }

  rankSegmentAgainstBankPixelXor(segmentBinary, width, height, bank, settingsInput = {}, topN = 3) {
    const settings = this.normalizeSettings(settingsInput);
    const obsVariants = this._relaxedVariants(segmentBinary, width, height, settings);
    const scored = [];

    for (const cls of (bank?.classes || [])) {
      let bestForClass = null;

      for (const ex of (cls.exemplars || [])) {
        for (const obsDesc of obsVariants) {
          const pixel = ex._norm_binary?.length
            ? this.binaryDisagreement(obsDesc._norm_binary, ex._norm_binary)
            : 1;

          const candidate = {
            class_id: cls.class_id,
            latin_output: cls.latin_output,
            glyph_id: cls.glyph_id,
            total: Number(pixel.toFixed(6)),
            breakdown: {
              pixelXor: Number(pixel.toFixed(6))
            },
            exemplar: ex,
            observed: obsDesc
          };

          if (!bestForClass || candidate.total < bestForClass.total) {
            bestForClass = candidate;
          }
        }
      }

      if (bestForClass) scored.push(bestForClass);
    }

    scored.sort((a, b) => a.total - b.total || a.latin_output.localeCompare(b.latin_output));
    return scored.slice(0, Math.max(1, topN));
  }

  bruteForcePostRuleTarget(line, targetTokenIndex, bank, settingsInput = {}, topN = 3) {
    const settings = this.normalizeSettings(settingsInput);
    const seg = line?.segments?.[targetTokenIndex];
    if (!seg?.descriptor?._trimmed_binary || !seg?.descriptor?._trimmed_width || !seg?.descriptor?._trimmed_height) {
      return [];
    }

    return this.rankSegmentAgainstBankPixelXor(
      seg.descriptor._trimmed_binary,
      seg.descriptor._trimmed_width,
      seg.descriptor._trimmed_height,
      bank,
      settings,
      topN
    );
  }

  async analyzeImageCanvas({ imageCanvas, bank, scriptFamily, settings: settingsInput = {}, scoreWeights = {} }) {
    if (!imageCanvas) throw new Error("imageCanvas is required.");
    if (!bank) throw new Error("reference bank is required.");
    if (!scriptFamily) throw new Error("scriptFamily is required.");
    const settings = this.normalizeSettings(settingsInput);
    const ctx = get2dContext(imageCanvas, { readback: true });
    const imageData = ctx.getImageData(0, 0, imageCanvas.width, imageCanvas.height);
    const { binary, threshold } = this.imageDataToGrayMask(imageData, imageCanvas.width, imageCanvas.height, settings);
    const bestAngle = this.estimateDeskew(binary, imageCanvas.width, imageCanvas.height, settings);
    const rotated = this.rotateBinaryNearest(binary, imageCanvas.width, imageCanvas.height, bestAngle);
    const lineBands = this.findLineBands(rotated, imageCanvas.width, imageCanvas.height);
    const lines = [];
    for (let li = 0; li < lineBands.length; li++) {
      const lineBand = lineBands[li];
      const cropped = this.cropBinary(rotated, imageCanvas.width, imageCanvas.height, 0, imageCanvas.width, lineBand.y0, lineBand.y1);
      const sharedLine = this.analyzeBinaryWithSharedSlices(cropped.binary, cropped.w, cropped.h, settings, { minArea: 3, minClearRun: 1, maxInkPerColumn: 0 });
      const lineSections = sharedLine.source_sections.map(sec => ({ ...sec }));
      const estimatedFontPx = median(lineSections.map(s => s.h).filter(v => Number.isFinite(v) && v > 0)) || 56;
      const mergedRuns = [];
      for (let start = 0; start < lineSections.length; start++) {
        for (let len = 2; len <= settings.mergeSpanMaxSections; len++) {
          const end = start + len;
          if (end > lineSections.length) break;
          const run = lineSections.slice(start, end);
          const isThinRun = this.isThinRunCandidate(run, estimatedFontPx || sharedLine.source_bbox?.h || 1, settings);
          const isStackedRun = !isThinRun && this.isStackedRunCandidate(run, estimatedFontPx || sharedLine.source_bbox?.h || 1, settings);
          const isAsymRun = !isThinRun && !isStackedRun && this.isAsymmetricThinRunCandidate(run, estimatedFontPx || sharedLine.source_bbox?.h || 1, settings);
          if (!isThinRun && !isStackedRun && !isAsymRun) continue;
          const mergedBoxTrimmed = this.buildMergedSectionBox(run);
          mergedRuns.push({
            start,
            endExclusive: end,
            sections: run,
            mergeKind: isThinRun ? "thin" : isStackedRun ? "stacked" : "asymThin",
            mergedBoxTrimmed,
            mergedBoxLine: {
              x: (sharedLine.source_bbox?.x || 0) + mergedBoxTrimmed.x,
              y: (sharedLine.source_bbox?.y || 0) + mergedBoxTrimmed.y,
              w: mergedBoxTrimmed.w,
              h: mergedBoxTrimmed.h,
            }
          });
        }
      }
      const observedDescriptor = this.analyzeBinaryWithSharedSlices(cropped.binary, cropped.w, cropped.h, settings, { minArea: 3, minClearRun: 1, maxInkPerColumn: 0 });
      const lineTrimX = Number(sharedLine.source_bbox?.x || 0);
      const lineTrimY = Number(sharedLine.source_bbox?.y || 0);

      // ── Structure detection (cartouche / long-pi) ──────────────────────────
      // Run first so wide blobs can be claimed before normal segmentation.
      let detectedStructures = [];
      const claimedSectionIndices = new Set();
      if (settings.structureDetectionEnabled) {
        detectedStructures = await this._detectAndDecodeStructures({
          lineBinary: cropped.binary,
          lineBinaryW: cropped.w,
          lineBinaryH: cropped.h,
          lineTrimX,
          lineTrimY,
          lineBandY0: lineBand.y0,
          lineSections,
          estimatedFontPx,
          bank,
          scriptFamily,
          settings,
          scoreWeights,
          lineIndex: li,
        });
        for (const struct of detectedStructures) claimedSectionIndices.add(struct.sectionIndex);
      }

      // ── Normal segment pass (skip sections claimed by a structure) ──────────
      const segments = [];
      for (let si = 0; si < lineSections.length; si++) {
        if (claimedSectionIndices.has(si)) continue;
        const box = lineSections[si];
        const segX0 = lineTrimX + box.x;
        const segY0 = lineTrimY + box.y;
        const segCrop = this.cropBinary(cropped.binary, cropped.w, cropped.h, segX0, segX0 + box.w, segY0, segY0 + box.h);
        const alternatives = this.rankSegmentAgainstBank(segCrop.binary, segCrop.w, segCrop.h, bank, settings, scoreWeights);
        const desc = alternatives[0]?.observed || this.analyzeBinaryWithSharedSlices(segCrop.binary, segCrop.w, segCrop.h, settings, { minArea: 2, minClearRun: 1, maxInkPerColumn: 0 });
        segments.push({
          lineIndex: li,
          segmentIndex: segments.length,
          bbox: { x: segX0, y: lineBand.y0 + segY0, w: box.w, h: box.h },
          rawBox: { ...box },
          descriptor: desc,
          alternatives,
          _originalSectionIndex: si,
        });
      }

      // Filter merged candidates — exclude any run that overlaps a claimed section
      const mergedCandidates = mergedRuns
        .filter(run => {
          for (let i = run.start; i < run.endExclusive; i++) {
            if (claimedSectionIndices.has(i)) return false;
          }
          return true;
        })
        .map(run => ({
          start: run.start,
          endExclusive: run.endExclusive,
          mergedBox: run.mergedBoxLine,
          mergeKind: run.mergeKind,
          alternatives: this.rankMergedRunAgainstBank(
            cropped.binary, cropped.w, cropped.h,
            run.mergedBoxLine, bank, settings, scoreWeights, run.mergeKind
          ).slice(0, settings.topGlyphAlts)
        }));

      const line = {
        lineIndex: li,
        y0: lineBand.y0,
        y1: lineBand.y1,
        estimatedFontPx,
        observedDescriptor,
        segments,
        mergedCandidates,
        lineBinary: cropped.binary,
        lineBinaryW: cropped.w,
        lineBinaryH: cropped.h,
        detectedStructures,
        lineShared: {
          source_bbox: sharedLine.source_bbox,
          source_vertical_gaps: sharedLine.source_vertical_gaps,
          source_sections: sharedLine.source_sections,
          trimmed_width: sharedLine._trimmed_width,
          trimmed_height: sharedLine._trimmed_height,
          trimmed_binary: sharedLine._trimmed_binary
        },
      };
      line.alternatives = await this.decodeLineWithBeam(line, bank, scriptFamily, settings);
      line.alternatives = await this.applyPostDecodeRules(line, bank, settings);
      line.bestText = this._interleaveStructuresIntoBestText(line);
      line.postRuleApplied = !!(line.postRuleDiagnostics && line.postRuleDiagnostics.length);
      lines.push(line);
    }
    const result = {
      threshold,
      deskewAngle: bestAngle,
      lines,
      rotatedBinary: rotated,
      postRuleChecksApplied: lines.some(line => !!line.postRuleApplied),
      postRuleDiagnostics: lines.flatMap(line => (line.postRuleDiagnostics || []).map(diag => ({
        lineIndex: line.lineIndex,
        ...diag
      })))
    };
    this.lastAnalysis = result;
    return result;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Structure detection methods (cartouche / long-pi)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Look up the calibrated frame margins for a given blob pixel height.
   * Finds the closest source size in structureCalibration and returns its
   * margins, scaled proportionally to the actual blob height.
   */
  _getStructureCalibration(bank, blobH, kind) {
    const cal = bank?.structureCalibration;
    if (!cal) return { leftPx: 0, rightPx: 0, calib: null };
    const sizes = Object.keys(cal).map(Number).sort((a, b) => a - b);
    if (!sizes.length) return { leftPx: 0, rightPx: 0, calib: null };
    // Find closest calibrated size to actual blob height
    let best = sizes[0];
    for (const s of sizes) { if (Math.abs(s - blobH) < Math.abs(best - blobH)) best = s; }
    const entry = cal[best];
    // Scale pixel margins from calibration size to actual blob height
    const scale = blobH / Math.max(1, best);
    const leftPx  = kind === 'cartouche'
      ? Math.round((entry.cartoucheLeftPx  || 0) * scale)
      : Math.round((entry.longpiLeftPx     || 0) * scale);
    const rightPx = kind === 'cartouche'
      ? Math.round((entry.cartoucheRightPx || 0) * scale)
      : 0;
    return { leftPx, rightPx, calib: entry };
  }

  /**
   * Detect cartouche and long-pi structures in a single line binary.
   * Called from analyzeImageCanvas before the normal segment loop.
   *
   * For each wide blob in lineSections:
   *   1. Classify via edge ink density (unchanged)
   *   2. Remove frame ink using connected-component analysis — components
   *      touching the blob edges are frame strokes; interior components are not
   *   3. Find vertical gaps in the frame-removed binary within the safe band
   *      (using calibrated horizontal margins to avoid bracket curve columns)
   *   4. For each interior section, crop from the frame-removed binary and
   *      score against NORMAL exemplars — same as regular glyph segments
   *   5. Re-estimate interior font size from the stripped binary
   */
  async _detectAndDecodeStructures({
    lineBinary, lineBinaryW, lineBinaryH,
    lineTrimX, lineTrimY, lineBandY0,
    lineSections, estimatedFontPx,
    bank, scriptFamily, settings, scoreWeights, lineIndex,
  }) {
    const results = [];
    const minBlobWidth = estimatedFontPx * (settings.structureMinWidthRatio ?? 2.2);
    const densityThres = settings.structureFrameDensityThreshold ?? 0.35;
    const cartBandTop  = settings.structureCartoucheGapBandTop    ?? 0.20;
    const cartBandBot  = settings.structureCartoucheGapBandBottom ?? 0.80;
    const lpBandTop    = settings.structureLongPiGapBandTop       ?? 0.00;
    const lpBandBot    = settings.structureLongPiGapBandBottom    ?? 0.80;

    for (let si = 0; si < lineSections.length; si++) {
      const sec = lineSections[si];
      if (sec.w < minBlobWidth) continue;

      const blobX = lineTrimX + sec.x;
      const blobY = lineTrimY + sec.y;
      const blob  = this.cropBinary(lineBinary, lineBinaryW, lineBinaryH,
        blobX, blobX + sec.w, blobY, blobY + sec.h);
      if (blob.w < 6 || blob.h < 6) continue;

      // 1. Classify using calibrated reference densities from bank
      //    The calibration entry contains BOTH cartouche and longpi reference
      //    densities measured from actual renders at bank-build time.
      const { calib: structCalib } = this._getStructureCalibration(bank, blob.h, 'cartouche');
      const cls = _classifyStructure(blob.binary, blob.w, blob.h, structCalib, densityThres);
      if (!cls.kind) continue;
      const { kind } = cls;

      // 2. Remove frame ink via connected components
      //    Components touching blob edges = frame strokes → zeroed out
      //    What remains = pure interior glyph ink, even if it touched the frame
      const stripped = _removeFrameComponents(blob.binary, blob.w, blob.h, kind);

      // 3. Find vertical gaps in stripped binary using safe 2-D band
      const { leftPx, rightPx } = this._getStructureCalibration(bank, blob.h, kind);
      const bandY0  = blob.h * (kind === 'cartouche' ? cartBandTop : lpBandTop);
      const bandY1  = blob.h * (kind === 'cartouche' ? cartBandBot : lpBandBot);
      const bandX0  = leftPx;
      const bandX1  = blob.w - rightPx;

      const gaps     = _findGapsInBand(stripped, blob.w, blob.h, bandY0, bandY1, bandX0, bandX1);
      const sections = _gapsToFullHeightSections(gaps, blob.w, blob.h, bandX0, bandX1);
      if (!sections.length) continue;

      // 4. Re-estimate interior font size from stripped binary sections
      const strippedShared = this.analyzeBinaryWithSharedSlices(
        stripped, blob.w, blob.h, settings, { minArea: 2, minClearRun: 1, maxInkPerColumn: 0 }
      );
      const interiorHeights = (strippedShared.source_sections || [])
        .map(s => s.h).filter(v => v > 0);
      const interiorFontPx = interiorHeights.length
        ? median(interiorHeights)
        : estimatedFontPx * 0.75;

      // 5. Score each interior section against NORMAL exemplars
      //    Crop from the stripped binary so frame ink is gone
      const internalSegments = [];
      for (let isi = 0; isi < sections.length; isi++) {
        const isec = sections[isi];
        // Trim vertically within the section to get a tight glyph crop
        const segCrop = this.cropBinary(stripped, blob.w, blob.h,
          isec.x, isec.x + isec.w, 0, blob.h);
        const trimmed = this.trimBinary(segCrop.binary, segCrop.w, segCrop.h);
        if (trimmed.w < 2 || trimmed.h < 2) continue;

        // Score against normal exemplars — same path as regular glyph segments
        const alternatives = this.rankSegmentAgainstBank(
          trimmed.binary, trimmed.w, trimmed.h,
          bank, settings, scoreWeights
        );
        internalSegments.push({
          lineIndex,
          segmentIndex: isi,
          bbox: { x: blobX + isec.x, y: lineBandY0 + blobY, w: isec.w, h: blob.h },
          alternatives,
          structureKind: kind,
          interiorFontPx,
        });
      }

      if (!internalSegments.length) continue;

      const interiorText = internalSegments
        .map(s => s.alternatives[0]?.latin_output || '').filter(Boolean).join(' ');
      const formattedText = kind === 'cartouche'
        ? `[ ${interiorText} ]`
        : `pi( ${interiorText} )`;

      results.push({
        kind,
        sectionIndex:     si,
        blobBox:          { x: blobX, y: blobY,              w: sec.w, h: sec.h },
        absoluteBox:      { x: blobX, y: lineBandY0 + blobY, w: sec.w, h: sec.h },
        internalSegments,
        interiorText,
        formattedText,
        confidence:       cls.confidence,
        classification:   cls,
        gaps,
        bandY0, bandY1, bandX0, bandX1,
        margins: { leftPx, rightPx },
      });
    }

    results.sort((a, b) => a.blobBox.x - b.blobBox.x);
    return results;
  }

  /**
   * Merge detected structure tokens into bestText, sorted left-to-right by x.
   * Normal glyph tokens use their segment bbox.x as position anchor.
   * Structure tokens use their blobBox.x.
   */
  _interleaveStructuresIntoBestText(line) {
    const structures = line.detectedStructures || [];
    if (!structures.length) return line.alternatives?.[0]?.text || '';

    const normalTokens = [];
    const bestAlt = line.alternatives?.[0];
    if (bestAlt && Array.isArray(bestAlt.glyphs)) {
      for (const g of bestAlt.glyphs) {
        const seg   = line.segments?.[g.segmentIndex];
        const x     = seg?.bbox?.x ?? 0;
        const token = g.choice?.latin_output ?? '';
        if (token) normalTokens.push({ x, token });
      }
    } else if (bestAlt?.text) {
      normalTokens.push({ x: -1, token: bestAlt.text });
    }

    const structureTokens = structures.map(s => ({ x: s.blobBox.x, token: s.formattedText }));
    const all = [...normalTokens, ...structureTokens].sort((a, b) => a.x - b.x);
    return all.map(t => t.token).filter(Boolean).join(' ');
  }

  buildOverlayModel(analysis, imageWidth, imageHeight) {
    const items = [];
    for (const line of (analysis?.lines || [])) {
      const lineBox = line.lineShared?.source_bbox || { x: 0, y: 0, w: 0, h: 0 };
      const lineOffsetX = Number(lineBox.x || 0);
      const lineOffsetY = Number(lineBox.y || 0);
      items.push({
        type: "line",
        lineIndex: line.lineIndex,
        x: 0,
        y: line.y0,
        w: imageWidth,
        h: line.y1 - line.y0
      });
      for (const gap of (line.lineShared?.source_vertical_gaps || [])) {
        items.push({
          type: "lineGap",
          lineIndex: line.lineIndex,
          x0: lineOffsetX + gap.x0,
          x1: lineOffsetX + gap.x1,
          y0: line.y0 + lineOffsetY,
          y1: line.y0 + lineOffsetY + (lineBox.h || 0)
        });
      }
      for (const sec of (line.lineShared?.source_sections || [])) {
        items.push({
          type: "lineSection",
          lineIndex: line.lineIndex,
          x: lineOffsetX + sec.x,
          y: line.y0 + lineOffsetY + sec.y,
          w: sec.w,
          h: sec.h
        });
      }
    }
    return items;
  }

  getSegmentDebug(analysis, lineIndex = 0, segmentIndex = 0, topN = 3) {
    const line = analysis?.lines?.[lineIndex];
    if (!line) return null;
    const seg = line.segments?.[segmentIndex];
    if (!seg) return null;
    return {
      lineIndex,
      segmentIndex,
      bbox: seg.bbox,
      descriptor: seg.descriptor,
      topCandidates: (seg.alternatives || []).slice(0, topN).map(alt => ({
        latin_output: alt.latin_output,
        glyph_id: alt.glyph_id,
        total: alt.total,
        breakdown: alt.breakdown
      }))
    };
  }

  evaluateAgainstExpected(analysis, expectedText = "") {
    const expectedLines = String(expectedText || "").replace(/\r/g, "").trim().split("\n").filter(Boolean);
    const actualLines = (analysis?.lines || []).map(line => String(line.bestText || "").trim());
    const norm = (t) => t === "ali" ? "ale" : t;
    const exp = expectedLines.join(" ").split(/\s+/).filter(Boolean).map(norm);
    const act = actualLines.join(" ").split(/\s+/).filter(Boolean).map(norm);

    let positional = 0;
    for (let i = 0; i < Math.min(exp.length, act.length); i++) {
      if (exp[i] === act[i]) positional++;
    }

    const aligned = (() => {
      const a = exp;
      const b = act;
      const dp = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
      for (let i = a.length - 1; i >= 0; i--) {
        for (let j = b.length - 1; j >= 0; j--) {
          dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
        }
      }
      return dp[0][0];
    })();

    let exactLines = 0;
    for (let i = 0; i < Math.min(expectedLines.length, actualLines.length); i++) {
      const e = expectedLines[i].split(/\s+/).filter(Boolean).map(norm);
      const a = actualLines[i].split(/\s+/).filter(Boolean).map(norm);
      if (e.length === a.length && e.every((tok, idx) => tok === a[idx])) exactLines++;
    }

    return {
      expectedTokens: exp.length,
      actualTokens: act.length,
      positionalMatches: positional,
      alignedMatches: aligned,
      exactLineMatches: exactLines,
      expectedLines,
      actualLines
    };
  }
}
