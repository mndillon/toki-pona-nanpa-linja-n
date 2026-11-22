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


export const DEFAULT_STRUCTURE_CATALOG = [
  {
    structure_id: "cartouche_shell",
    structure_type: "cartouche",
    glyph_id: "[ ]",
    latin_output: "[ ]",
    render_text: "[wan]",
    context_type: "structure",
    semantic_token: "cartouche_shell",
    class_id: "structure_cartouche_shell",
    render_mode: "structure",
  },
  {
    structure_id: "cartouche_one",
    structure_type: "cartouche",
    glyph_id: "[x]",
    latin_output: "[x]",
    render_text: "[wan]",
    context_type: "structure",
    semantic_token: "cartouche_one",
    class_id: "structure_cartouche_one",
    render_mode: "structure",
  },
  {
    structure_id: "cartouche_two",
    structure_type: "cartouche",
    glyph_id: "[x x]",
    latin_output: "[x x]",
    render_text: "[wan tu]",
    context_type: "structure",
    semantic_token: "cartouche_two",
    class_id: "structure_cartouche_two",
    render_mode: "structure",
  },
  {
    structure_id: "cartouche_three",
    structure_type: "cartouche",
    glyph_id: "[x x x]",
    latin_output: "[x x x]",
    render_text: "[wan tu tu]",
    context_type: "structure",
    semantic_token: "cartouche_three",
    class_id: "structure_cartouche_three",
    render_mode: "structure",
  },
  {
    structure_id: "longpi_shell",
    structure_type: "longPi",
    glyph_id: "pi()",
    latin_output: "pi()",
    render_text: "pi(wan)",
    context_type: "structure",
    semantic_token: "longpi_shell",
    class_id: "structure_longpi_shell",
    render_mode: "structure",
  },
  {
    structure_id: "longpi_one",
    structure_type: "longPi",
    glyph_id: "pi(x)",
    latin_output: "pi(x)",
    render_text: "pi(wan)",
    context_type: "structure",
    semantic_token: "longpi_one",
    class_id: "structure_longpi_one",
    render_mode: "structure",
  },
  {
    structure_id: "longpi_two",
    structure_type: "longPi",
    glyph_id: "pi(x x)",
    latin_output: "pi(x x)",
    render_text: "pi(wan tu)",
    context_type: "structure",
    semantic_token: "longpi_two",
    class_id: "structure_longpi_two",
    render_mode: "structure",
  },
  {
    structure_id: "longpi_three",
    structure_type: "longPi",
    glyph_id: "pi(x x x)",
    latin_output: "pi(x x x)",
    render_text: "pi(wan tu tu)",
    context_type: "structure",
    semantic_token: "longpi_three",
    class_id: "structure_longpi_three",
    render_mode: "structure",
  },
];

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

  detectStructures: true,
  detectCartoucheStructures: true,
  detectLongPiStructures: true,
  structureBarMinWidthRatio: 0.45,
  structureBarMaxHeightRatio: 0.24,
  structureBarMinInkRatio: 0.28,
  structureSideInsetMaxRatio: 0.22,
  cartoucheInteriorInsetPx: 2,
  longPiInteriorInsetPx: 1,
  structurePrototypeMaxPenalty: 0.55,
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

  parseStructureCatalog(jsonText, fallback = DEFAULT_STRUCTURE_CATALOG) {
    const parsed = typeof jsonText === "string" ? safeJsonParse(jsonText, fallback) : (jsonText || fallback);
    if (!Array.isArray(parsed)) throw new Error("Structure catalog JSON must be an array.");
    return parsed.map((item, idx) => ({
      structure_id: String(item.structure_id || `structure_${idx + 1}`),
      structure_type: String(item.structure_type || "structure"),
      class_id: String(item.class_id || item.structure_id || `structure_class_${idx + 1}`),
      glyph_id: String(item.glyph_id || item.structure_id || `structure_glyph_${idx + 1}`),
      latin_output: String(item.latin_output || item.structure_id || ""),
      render_text: String(item.render_text || item.latin_output || item.glyph_id || ""),
      context_type: String(item.context_type || "structure"),
      semantic_token: String(item.semantic_token || item.structure_id || `structure_token_${idx + 1}`),
      render_mode: String(item.render_mode || "structure"),
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

      detectStructures: settings.detectStructures !== false,
      detectCartoucheStructures: settings.detectCartoucheStructures !== false,
      detectLongPiStructures: settings.detectLongPiStructures !== false,
      structureBarMinWidthRatio: Number(settings.structureBarMinWidthRatio ?? DEFAULT_SETTINGS.structureBarMinWidthRatio),
      structureBarMaxHeightRatio: Number(settings.structureBarMaxHeightRatio ?? DEFAULT_SETTINGS.structureBarMaxHeightRatio),
      structureBarMinInkRatio: Number(settings.structureBarMinInkRatio ?? DEFAULT_SETTINGS.structureBarMinInkRatio),
      structureSideInsetMaxRatio: Number(settings.structureSideInsetMaxRatio ?? DEFAULT_SETTINGS.structureSideInsetMaxRatio),
      cartoucheInteriorInsetPx: Math.max(0, Math.round(Number(settings.cartoucheInteriorInsetPx ?? DEFAULT_SETTINGS.cartoucheInteriorInsetPx))),
      longPiInteriorInsetPx: Math.max(0, Math.round(Number(settings.longPiInteriorInsetPx ?? DEFAULT_SETTINGS.longPiInteriorInsetPx))),
      structurePrototypeMaxPenalty: Number(settings.structurePrototypeMaxPenalty ?? DEFAULT_SETTINGS.structurePrototypeMaxPenalty),
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
      if (!best || total < best.total) best = { total, breakdown, observed: obsDesc };
    }
    return best;
  }

  async buildReferenceBank({ catalog, structureCatalog, settings: settingsInput = {}, scriptFamily, fontLabel = "ReferenceBank" }) {
    const settings = this.normalizeSettings(settingsInput);
    const parsedCatalog = this.parseCatalog(catalog, DEFAULT_CATALOG);
    const parsedStructureCatalog = this.parseStructureCatalog(structureCatalog, DEFAULT_STRUCTURE_CATALOG);
    const classes = [];
    const structureClasses = [];

    for (const item of parsedCatalog) {
      const exemplars = [];
      for (const size of settings.sourceSizes) {
        const glyphString = this.hooks.tokenToGlyphString
          ? await this.hooks.tokenToGlyphString(item.render_text)
          : item.render_text;

        const previewCanvas = this.hooks.renderGlyphStringToCanvas(glyphString, scriptFamily, size, 18);
        const desc = this.analyzeCanvas(previewCanvas, settings);
        desc.source_render_size = size;
        desc._previewCanvas = previewCanvas;
        exemplars.push(desc);
      }
      classes.push({ ...item, exemplars });
    }

    for (const item of parsedStructureCatalog) {
      const exemplars = [];
      for (const size of settings.sourceSizes) {
        const previewCanvas = await this.renderStructuredTextToCanvas(item.render_text, scriptFamily, size, 18);
        const desc = this.analyzeCanvas(previewCanvas, settings);
        desc.source_render_size = size;
        desc._previewCanvas = previewCanvas;
        exemplars.push(desc);
      }
      structureClasses.push({ ...item, exemplars });
    }

    const bank = {
      kind: "sitelen-ocr-reference-bank",
      font: { family_name: scriptFamily, font_label: fontLabel },
      normalization: { norm_size: settings.normSize, threshold_mode: settings.thresholdMode, fixed_threshold: settings.fixedThreshold, morphology: settings.morphology },
      classes,
      structureClasses,
      created_at: new Date().toISOString(),
      settings_snapshot: settings,
    };
    this.lastBank = bank;
    return bank;
  }

  rankSegmentAgainstBank(binary, width, height, bank, settings, scoreWeights = {}) {
    const obsVariants = this._relaxedVariants(binary, width, height, settings);
    const alts = [];
    for (const cls of bank.classes) {
      let bestForClass = null;
      for (const exemplar of cls.exemplars) {
        const scored = this.scoreObservedAgainstExemplar(obsVariants, exemplar, scoreWeights);
        if (!bestForClass || scored.total < bestForClass.total) bestForClass = { exemplar_size: exemplar.source_render_size, ...scored };
      }
      alts.push({
        class_id: cls.class_id,
        glyph_id: cls.glyph_id,
        latin_output: cls.latin_output,
        total: Number(bestForClass.total.toFixed(6)),
        best_source_render_size: bestForClass.exemplar_size,
        breakdown: bestForClass.breakdown,
        observed: bestForClass.observed,
      });
    }
    alts.sort((a, b) => a.total - b.total || a.latin_output.localeCompare(b.latin_output));
    return alts.slice(0, Math.max(settings.topGlyphAlts, 1));
  }

  rankStructureAgainstBank(binary, width, height, bank, settings, expectedStructureType = null, scoreWeights = {}) {
    const obsVariants = this._relaxedVariants(binary, width, height, settings);
    const alts = [];
    for (const cls of (bank.structureClasses || [])) {
      let bestForClass = null;
      for (const exemplar of cls.exemplars) {
        const scored = this.scoreObservedAgainstExemplar(obsVariants, exemplar, scoreWeights);
        if (!bestForClass || scored.total < bestForClass.total) bestForClass = { exemplar_size: exemplar.source_render_size, ...scored };
      }
      let total = bestForClass.total;
      if (expectedStructureType && cls.structure_type !== expectedStructureType) {
        total += Math.max(0, settings.structurePrototypeMaxPenalty);
      }
      alts.push({
        class_id: cls.class_id,
        structure_id: cls.structure_id,
        structure_type: cls.structure_type,
        glyph_id: cls.glyph_id,
        latin_output: cls.latin_output,
        total: Number(total.toFixed(6)),
        best_source_render_size: bestForClass.exemplar_size,
        breakdown: bestForClass.breakdown,
        observed: bestForClass.observed,
      });
    }
    alts.sort((a, b) => a.total - b.total || String(a.structure_id).localeCompare(String(b.structure_id)));
    return alts.slice(0, Math.max(settings.topGlyphAlts, 1));
  }

  _rowInk(binary, width, height) {
    const row = new Array(height).fill(0);
    for (let y = 0; y < height; y++) {
      let sum = 0;
      for (let x = 0; x < width; x++) sum += binary[y * width + x] ? 1 : 0;
      row[y] = sum;
    }
    return row;
  }

  _findHorizontalBars(binary, width, height, settings) {
    const rowInk = this._rowInk(binary, width, height);
    const minWidthPx = Math.max(3, Math.round(width * settings.structureBarMinWidthRatio));
    const maxHeightPx = Math.max(1, Math.round(height * settings.structureBarMaxHeightRatio));
    const bars = [];

    let y = 0;
    while (y < height) {
      if (rowInk[y] < minWidthPx) {
        y++;
        continue;
      }
      const y0 = y;
      while (y < height && rowInk[y] >= minWidthPx) y++;
      const y1 = y;
      const h = y1 - y0;
      if (h > maxHeightPx) continue;

      let minX = width;
      let maxX = -1;
      let ink = 0;
      for (let yy = y0; yy < y1; yy++) {
        for (let x = 0; x < width; x++) {
          if (!binary[yy * width + x]) continue;
          ink++;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
        }
      }
      if (maxX < minX) continue;

      const w = maxX - minX + 1;
      const fill = ink / Math.max(1, w * h);
      if (fill < settings.structureBarMinInkRatio) continue;

      bars.push({ x: minX, y: y0, w, h });
    }

    return bars;
  }

  detectLineStructures(lineBinary, lineW, lineH, sharedLine, settingsInput = {}) {
    const settings = this.normalizeSettings(settingsInput);
    if (!settings.detectStructures) return [];

    const trimmedX = Number(sharedLine?.source_bbox?.x || 0);
    const trimmedY = Number(sharedLine?.source_bbox?.y || 0);
    const trimmedW = Number(sharedLine?._trimmed_width || 0);
    const trimmedH = Number(sharedLine?._trimmed_height || 0);
    const trimmedBinary = sharedLine?._trimmed_binary;

    if (!trimmedBinary || !trimmedW || !trimmedH) return [];

    const structures = [];
    const sections = (sharedLine.source_sections || []).slice().sort((a, b) => a.x - b.x || a.y - b.y);

    if (settings.detectCartoucheStructures && sections.length >= 2) {
      for (let i = 0; i < sections.length - 1; i++) {
        const left = sections[i];
        const right = sections[i + 1];

        const leftTallNarrow = left.h >= trimmedH * 0.55 && left.w <= trimmedW * 0.22;
        const rightTallNarrow = right.h >= trimmedH * 0.55 && right.w <= trimmedW * 0.22;
        if (!leftTallNarrow || !rightTallNarrow) continue;

        const innerX0 = left.x + left.w + settings.cartoucheInteriorInsetPx;
        const innerX1 = right.x - settings.cartoucheInteriorInsetPx;
        if (innerX1 <= innerX0) continue;

        const innerY0 = Math.max(left.y, right.y);
        const innerY1 = Math.min(left.y + left.h, right.y + right.h);
        if (innerY1 - innerY0 < Math.max(2, Math.round(trimmedH * 0.30))) continue;

        const bboxX0 = Math.min(left.x, right.x);
        const bboxY0 = Math.min(left.y, right.y);
        const bboxX1 = Math.max(left.x + left.w, right.x + right.w);
        const bboxY1 = Math.max(left.y + left.h, right.y + right.h);

        structures.push({
          type: "cartouche",
          bbox: {
            x: trimmedX + bboxX0,
            y: trimmedY + bboxY0,
            w: bboxX1 - bboxX0,
            h: bboxY1 - bboxY0
          },
          interiorBox: {
            x: trimmedX + innerX0,
            y: trimmedY + innerY0,
            w: innerX1 - innerX0,
            h: innerY1 - innerY0
          },
          shellParts: [
            { kind: "leftBracket", x: trimmedX + left.x, y: trimmedY + left.y, w: left.w, h: left.h },
            { kind: "rightBracket", x: trimmedX + right.x, y: trimmedY + right.y, w: right.w, h: right.h }
          ]
        });
      }
    }

    if (settings.detectLongPiStructures) {
      const bars = this._findHorizontalBars(trimmedBinary, trimmedW, trimmedH, settings)
        .filter(bar => (bar.y + bar.h) >= trimmedH * 0.55);

      for (const bar of bars) {
        const aboveSections = sections.filter(sec => {
          const secBottom = sec.y + sec.h;
          return secBottom <= (bar.y + settings.longPiInteriorInsetPx);
        });
        if (!aboveSections.length) continue;

        const head = aboveSections[0];
        const headLooksLikeLongPiStarter =
          head.h >= trimmedH * 0.35 &&
          head.y <= trimmedH * 0.35 &&
          head.x <= bar.x + Math.max(3, Math.round(bar.w * 0.22));

        if (!headLooksLikeLongPiStarter) continue;

        const payloadX0 = Math.min(head.x, ...aboveSections.map(s => s.x));
        const payloadX1 = Math.max(head.x + head.w, ...aboveSections.map(s => s.x + s.w), bar.x + bar.w);
        const payloadY0 = Math.min(...aboveSections.map(s => s.y));
        const payloadY1 = Math.min(trimmedH, bar.y);

        if (payloadY1 <= payloadY0) continue;

        structures.push({
          type: "longPi",
          bbox: {
            x: trimmedX + Math.min(bar.x, payloadX0),
            y: trimmedY + payloadY0,
            w: Math.max(bar.x + bar.w, payloadX1) - Math.min(bar.x, payloadX0),
            h: (bar.y + bar.h) - payloadY0
          },
          interiorBox: {
            x: trimmedX + payloadX0,
            y: trimmedY + payloadY0,
            w: payloadX1 - payloadX0,
            h: payloadY1 - payloadY0
          },
          shellParts: [
            { kind: "bottomBar", x: trimmedX + bar.x, y: trimmedY + bar.y, w: bar.w, h: bar.h }
          ],
          headBox: {
            x: trimmedX + head.x,
            y: trimmedY + head.y,
            w: head.w,
            h: head.h
          },
          payloadBox: {
            x: trimmedX + payloadX0,
            y: trimmedY + payloadY0,
            w: payloadX1 - payloadX0,
            h: payloadY1 - payloadY0
          }
        });
      }
    }

    structures.sort((a, b) => (b.bbox.w * b.bbox.h) - (a.bbox.w * a.bbox.h));
    const accepted = [];
    for (const s of structures) {
      const overlaps = accepted.some(a => {
        const x0 = Math.max(a.bbox.x, s.bbox.x);
        const y0 = Math.max(a.bbox.y, s.bbox.y);
        const x1 = Math.min(a.bbox.x + a.bbox.w, s.bbox.x + s.bbox.w);
        const y1 = Math.min(a.bbox.y + a.bbox.h, s.bbox.y + s.bbox.h);
        const inter = Math.max(0, x1 - x0) * Math.max(0, y1 - y0);
        const sArea = s.bbox.w * s.bbox.h;
        return inter / Math.max(1, sArea) > 0.6;
      });
      if (!overlaps) accepted.push(s);
    }

    return accepted;
  }

  sectionBoxIntersects(boxA, boxB) {
    const x0 = Math.max(boxA.x, boxB.x);
    const y0 = Math.max(boxA.y, boxB.y);
    const x1 = Math.min(boxA.x + boxA.w, boxB.x + boxB.w);
    const y1 = Math.min(boxA.y + boxA.h, boxB.y + boxB.h);
    return x1 > x0 && y1 > y0;
  }

  assignSectionsToStructures(lineSections, structures, sharedLine) {
    const lineTrimX = Number(sharedLine?.source_bbox?.x || 0);
    const lineTrimY = Number(sharedLine?.source_bbox?.y || 0);

    return structures.map((st, structureIndex) => {
      const memberSectionIndexes = [];
      for (let i = 0; i < lineSections.length; i++) {
        const sec = lineSections[i];
        const absBox = {
          x: lineTrimX + sec.x,
          y: lineTrimY + sec.y,
          w: sec.w,
          h: sec.h
        };
        if (this.sectionBoxIntersects(absBox, st.interiorBox) || this.sectionBoxIntersects(absBox, st.bbox)) {
          memberSectionIndexes.push(i);
        }
      }
      return { ...st, structureIndex, memberSectionIndexes };
    });
  }

  async renderStructuredTextToCanvas(text, family, px, padding = 20) {
    const s = String(text ?? "").trim();

    if (/^\[.*\]$/.test(s)) {
      const inner = s.slice(1, -1).trim();
      const glyphString = this.hooks.renderLatinLineToGlyphString
        ? await this.hooks.renderLatinLineToGlyphString(inner)
        : inner;
      return this.hooks.renderGlyphStringToCanvas(
        `${String.fromCodePoint(0xF1990)}${glyphString}${String.fromCodePoint(0xF1991)}`,
        family,
        px,
        padding
      );
    }

    const longPiMatch = /^pi\((.*)\)$/.exec(s);
    if (longPiMatch) {
      const inner = longPiMatch[1].trim();
      const tokens = inner ? inner.split(/\s+/).filter(Boolean) : [];
      const cps = [];
      if (tokens.length) {
        const firstGlyph = this.hooks.tokenToGlyphString
          ? await this.hooks.tokenToGlyphString(tokens[0])
          : tokens[0];
        cps.push(String.fromCodePoint(0xF1993), firstGlyph);
        for (let i = 1; i < tokens.length; i++) {
          const glyph = this.hooks.tokenToGlyphString
            ? await this.hooks.tokenToGlyphString(tokens[i])
            : tokens[i];
          cps.push(String.fromCodePoint(0xF1994), glyph);
        }
      } else {
        cps.push(String.fromCodePoint(0xF1993));
      }
      return this.hooks.renderGlyphStringToCanvas(cps.join(""), family, px, padding);
    }

    return this.hooks.renderGlyphStringToCanvas(s || " ", family, px, padding);
  }

  async _renderLatinLineBinary(text, scriptFamily, fontPx, settings) {
    const canvas = await this.renderStructuredTextToCanvas(String(text ?? ""), scriptFamily, fontPx, 18);
    const desc = this.analyzeCanvas(canvas, settings);
    return { canvas, desc };
  }

  async scoreWholeLine(text, observedBinary, observedW, observedH, scriptFamily, fontPx, settings) {
    const rendered = await this._renderLatinLineBinary(text, scriptFamily, fontPx, settings);
    const obsTrim = this.trimBinary(observedBinary, observedW, observedH);
    const cmpW = settings.normSize, cmpH = settings.normSize;
    const obsNorm = this.resizeBinaryNearest(obsTrim.binary, obsTrim.w, obsTrim.h, cmpW, cmpH);
    const renNorm = this.resizeBinaryNearest(rendered.desc._trimmed_binary, rendered.desc._trimmed_width, rendered.desc._trimmed_height, cmpW, cmpH);
    const pixel = this.binaryDisagreement(obsNorm, renNorm);
    const row = this.projectionDistance(this.computeProjections(obsNorm, cmpW, cmpH).row, this.computeProjections(renNorm, cmpW, cmpH).row);
    const col = this.projectionDistance(this.computeProjections(obsNorm, cmpW, cmpH).col, this.computeProjections(renNorm, cmpW, cmpH).col);
    return { total: Number((pixel * 0.6 + row * 0.2 + col * 0.2).toFixed(6)), pixel, row, col };
  }

  async scoreWholeLineWithWiggle(text, observedBinary, observedW, observedH, scriptFamily, fontPx, settings) {
    const rendered = await this._renderLatinLineBinary(text, scriptFamily, fontPx, settings);
    const obsTrim = this.trimBinary(observedBinary, observedW, observedH);
    const cmpW = settings.normSize, cmpH = settings.normSize;
    const obsNorm = this.resizeBinaryNearest(obsTrim.binary, obsTrim.w, obsTrim.h, cmpW, cmpH);
    const renTrim = this.trimBinary(rendered.desc._trimmed_binary, rendered.desc._trimmed_width, rendered.desc._trimmed_height);
    let best = null;
    for (const dx of (settings.postRuleWiggleX || [0])) {
      for (const dy of (settings.postRuleWiggleY || [0])) {
        const shifted = this._shiftBinary(renTrim.binary, renTrim.w, renTrim.h, dx, dy);
        const renNorm = this.resizeBinaryNearest(shifted.binary, shifted.w, shifted.h, cmpW, cmpH);
        const pixel = this.binaryDisagreement(obsNorm, renNorm);
        const row = this.projectionDistance(this.computeProjections(obsNorm, cmpW, cmpH).row, this.computeProjections(renNorm, cmpW, cmpH).row);
        const col = this.projectionDistance(this.computeProjections(obsNorm, cmpW, cmpH).col, this.computeProjections(renNorm, cmpW, cmpH).col);
        const total = Number((pixel * 0.6 + row * 0.2 + col * 0.2).toFixed(6));
        if (!best || total < best.total) best = { total, pixel, row, col, dx, dy };
      }
    }
    return best;
  }

  _shiftBinary(binary, width, height, dx, dy) {
    const out = new Uint8Array(width * height);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const sx = x - dx, sy = y - dy;
      if (sx < 0 || sy < 0 || sx >= width || sy >= height) continue;
      out[y * width + x] = binary[sy * width + sx];
    }
    return { binary: out, w: width, h: height };
  }

  async scoreLocalSpan(text, line, spanBox, scriptFamily, fontPx, settings) {
    const crop = this.cropBinary(line.lineBinary, line.lineBinaryW, line.lineBinaryH, spanBox.x, spanBox.x + spanBox.w, spanBox.y, spanBox.y + spanBox.h);
    return this.scoreWholeLine(text, crop.binary, crop.w, crop.h, scriptFamily, fontPx, settings);
  }

  buildDecodeUnits(line, bank, settings) {
    const units = [];

    for (let i = 0; i < line.segments.length; i++) {
      const seg = line.segments[i];
      units.push({
        start: seg.segmentIndex,
        endExclusive: seg.segmentIndex + 1,
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

    for (const st of (line.structures || [])) {
      if (!st.memberSectionIndexes?.length) continue;
      const start = Math.min(...st.memberSectionIndexes);
      const endExclusive = Math.max(...st.memberSectionIndexes) + 1;

      units.push({
        start,
        endExclusive,
        textChoices: st.alternatives || [],
        kind: "structure",
        source: st
      });
    }

    units.sort((a, b) => a.start - b.start || (b.endExclusive - b.start) - (a.endExclusive - a.start));
    return units;
  }

  _pathCovered(path, idx) {
    return idx >= path.nextIndex;
  }

  async decodeLineWithBeam(line, bank, scriptFamily, settings) {
    const units = this.buildDecodeUnits(line, bank, settings);
    let beam = [{ nextIndex: 0, glyphs: [], text: "", localScore: 0, totalScore: 0 }];

    for (let step = 0; step < Math.max(1, units.length + 1); step++) {
      const nextBeam = [];
      let expandedAny = false;

      for (const path of beam) {
        const currentIndex = path.nextIndex;
        const candidates = units.filter(u => u.start === currentIndex);
        if (!candidates.length) {
          nextBeam.push(path);
          continue;
        }

        for (const unit of candidates) {
          for (const choice of unit.textChoices) {
            expandedAny = true;
            const nextText = path.text ? `${path.text} ${choice.latin_output}` : choice.latin_output;
            let localScore = path.localScore + Number(choice.total || 0);

            if (unit.kind === "merged") {
              const spanPenalty = Number(choice.total || 0) * Number(settings.localSpanScoreWeight ?? 1);
              localScore += spanPenalty;
            }

            const spanBox = unit.kind === "structure"
              ? {
                  x: unit.source.interiorBox?.x ?? unit.source.bbox.x,
                  y: unit.source.interiorBox?.y ?? unit.source.bbox.y,
                  w: unit.source.interiorBox?.w ?? unit.source.bbox.w,
                  h: unit.source.interiorBox?.h ?? unit.source.bbox.h
                }
              : (unit.source.rawBox || unit.source.bbox);

            const localSpan = await this.scoreLocalSpan(
              choice.latin_output,
              line,
              spanBox,
              scriptFamily,
              line.estimatedFontPx,
              settings
            );

            const totalScore = localScore + localSpan.total;

            nextBeam.push({
              nextIndex: unit.endExclusive,
              glyphs: path.glyphs.concat([{ segmentIndex: unit.start, choice, unitKind: unit.kind }]),
              text: nextText,
              localScore,
              totalScore
            });
          }
        }
      }

      if (!expandedAny) {
        beam = nextBeam;
        break;
      }

      beam = nextBeam.sort((a, b) => a.totalScore - b.totalScore).slice(0, Math.max(1, settings.beamWidth));
    }

    for (const path of beam) {
      const splitPenalty = this.computeSplitThinPunctPenalty(path, line, settings);
      if (splitPenalty) path.totalScore += splitPenalty;
      const whole = settings.postRuleWiggleEnabled
        ? await this.scoreWholeLineWithWiggle(path.text, line.lineBinary, line.lineBinaryW, line.lineBinaryH, scriptFamily, line.estimatedFontPx, settings)
        : await this.scoreWholeLine(path.text, line.lineBinary, line.lineBinaryW, line.lineBinaryH, scriptFamily, line.estimatedFontPx, settings);
      path.lineScore = whole.total;
      path.totalScore = Number((path.totalScore + whole.total).toFixed(6));
    }

    beam.sort((a, b) => a.totalScore - b.totalScore || a.text.localeCompare(b.text));
    const rescored = [];
    for (const path of beam.slice(0, Math.max(1, settings.topLineAlts))) {
      let bestPath = path;
      for (const rule of DEFAULT_POST_RULES) {
        if (!rule.enabled) continue;
        const toks = path.text.split(/\s+/).filter(Boolean);
        for (let i = 0; i <= toks.length - rule.whenTokens.length; i++) {
          const matches = rule.whenTokens.every((t, k) => toks[i + k] === t);
          if (!matches) continue;
          const candidateTokens = toks.slice(0, i).concat(rule.replacementTokens, toks.slice(i + rule.whenTokens.length));
          const candidateText = candidateTokens.join(" ");
          const whole = settings.postRuleWiggleEnabled
            ? await this.scoreWholeLineWithWiggle(candidateText, line.lineBinary, line.lineBinaryW, line.lineBinaryH, scriptFamily, line.estimatedFontPx, settings)
            : await this.scoreWholeLine(candidateText, line.lineBinary, line.lineBinaryW, line.lineBinaryH, scriptFamily, line.estimatedFontPx, settings);
          if (whole.total + (rule.applyBonus || 0) < bestPath.lineScore) {
            bestPath = {
              ...bestPath,
              text: candidateText,
              lineScore: whole.total,
              totalScore: Number((bestPath.localScore + whole.total - (rule.applyBonus || 0)).toFixed(6))
            };
          }
        }
      }
      rescored.push(bestPath);
    }

    rescored.sort((a, b) => a.totalScore - b.totalScore || a.text.localeCompare(b.text));
    return rescored.slice(0, Math.max(1, settings.topLineAlts));
  }

  async decodeStructureInterior(structure, line, bank, scriptFamily, settings, scoreWeights = {}) {
    const ib = structure.interiorBox;
    const crop = this.cropBinary(
      line.lineBinary,
      line.lineBinaryW,
      line.lineBinaryH,
      ib.x,
      ib.x + ib.w,
      ib.y,
      ib.y + ib.h
    );

    const shared = this.analyzeBinaryWithSharedSlices(crop.binary, crop.w, crop.h, settings, { minArea: 2, minClearRun: 1, maxInkPerColumn: 0 });
    const sections = shared.source_sections.map(sec => ({ ...sec }));
    const innerFontPx = median(sections.map(s => s.h).filter(v => Number.isFinite(v) && v > 0)) || line.estimatedFontPx || 56;

    const innerSegments = [];
    for (let si = 0; si < sections.length; si++) {
      const box = sections[si];
      const segCrop = this.cropBinary(crop.binary, crop.w, crop.h, box.x, box.x + box.w, box.y, box.y + box.h);
      const alternatives = this.rankSegmentAgainstBank(segCrop.binary, segCrop.w, segCrop.h, bank, settings, scoreWeights);
      const desc = alternatives[0]?.observed || this.analyzeBinaryWithSharedSlices(segCrop.binary, segCrop.w, segCrop.h, settings, { minArea: 2, minClearRun: 1, maxInkPerColumn: 0 });

      innerSegments.push({
        lineIndex: line.lineIndex,
        segmentIndex: si,
        bbox: { x: box.x, y: box.y, w: box.w, h: box.h },
        rawBox: { ...box },
        descriptor: desc,
        alternatives
      });
    }

    const innerLine = {
      lineIndex: line.lineIndex,
      y0: 0,
      y1: crop.h,
      estimatedFontPx: innerFontPx,
      observedDescriptor: this.analyzeBinaryWithSharedSlices(crop.binary, crop.w, crop.h, settings, { minArea: 2, minClearRun: 1, maxInkPerColumn: 0 }),
      segments: innerSegments,
      mergedCandidates: [],
      structures: [],
      lineBinary: crop.binary,
      lineBinaryW: crop.w,
      lineBinaryH: crop.h,
      lineShared: {
        source_bbox: shared.source_bbox,
        source_vertical_gaps: shared.source_vertical_gaps,
        source_sections: shared.source_sections,
        trimmed_width: shared._trimmed_width,
        trimmed_height: shared._trimmed_height,
        trimmed_binary: shared._trimmed_binary
      }
    };

    const prototypeAlts = this.rankStructureAgainstBank(crop.binary, crop.w, crop.h, bank, settings, structure.type, scoreWeights);
    const prototypePenalty = prototypeAlts[0]?.total ?? 0;

    const alts = await this.decodeLineWithBeam(innerLine, bank, scriptFamily, settings);
    const bestInnerText = alts[0]?.text || "";

    if (structure.type === "cartouche") {
      return [{
        latin_output: `[${bestInnerText}]`,
        glyph_id: "structure_cartouche",
        total: Number(((alts[0]?.totalScore || alts[0]?.localScore || 0) + prototypePenalty).toFixed(6)),
        breakdown: { structureType: "cartouche", prototypePenalty: Number(prototypePenalty.toFixed(6)) }
      }];
    }

    if (structure.type === "longPi") {
      return [{
        latin_output: `pi(${bestInnerText})`,
        glyph_id: "structure_longPi",
        total: Number(((alts[0]?.totalScore || alts[0]?.localScore || 0) + prototypePenalty).toFixed(6)),
        breakdown: { structureType: "longPi", prototypePenalty: Number(prototypePenalty.toFixed(6)) }
      }];
    }

    return [];
  }

  async analyzeImageCanvas(imageCanvas, bank, settingsInput = {}, scoreWeights = {}) {
    const settings = this.normalizeSettings(settingsInput);
    if (!bank) throw new Error("Reference bank not built.");
    const ctx = get2dContext(imageCanvas, { readback: true });
    const { width, height } = imageCanvas;
    const imageData = ctx.getImageData(0, 0, width, height);
    const { binary, threshold } = this.imageDataToGrayMask(imageData, width, height, settings);
    const bestAngle = this.estimateDeskew(binary, width, height, settings);
    const deskewed = this.rotateBinaryNearest(binary, width, height, bestAngle);
    const lineBands = this.findLineBands(deskewed, width, height);
    const scriptFamily = bank.font.family_name;

    const lines = [];
    for (let li = 0; li < lineBands.length; li++) {
      const lineBand = lineBands[li];
      const cropped = this.cropBinary(deskewed, width, height, 0, width, lineBand.y0, lineBand.y1);
      const sharedLine = this.analyzeBinaryWithSharedSlices(cropped.binary, cropped.w, cropped.h, settings, { minArea: 3, minClearRun: 1, maxInkPerColumn: 0 });
      const lineSections = sharedLine.source_sections.map(sec => ({ ...sec }));
      const estimatedFontPx = median(lineSections.map(s => s.h).filter(v => Number.isFinite(v) && v > 0)) || 56;

      let structures = this.detectLineStructures(cropped.binary, cropped.w, cropped.h, sharedLine, settings);
      structures = this.assignSectionsToStructures(lineSections, structures, sharedLine);

      const structureSectionIndexSet = new Set(
        structures.flatMap(st => st.memberSectionIndexes || [])
      );

      const observedDescriptor = this.analyzeBinaryWithSharedSlices(cropped.binary, cropped.w, cropped.h, settings, { minArea: 2, minClearRun: 1, maxInkPerColumn: 0 });
      const segments = [];
      for (let si = 0; si < lineSections.length; si++) {
        if (structureSectionIndexSet.has(si)) continue;
        const box = lineSections[si];
        const segCrop = this.cropBinary(cropped.binary, cropped.w, cropped.h, box.x, box.x + box.w, box.y, box.y + box.h);
        const alternatives = this.rankSegmentAgainstBank(segCrop.binary, segCrop.w, segCrop.h, bank, settings, scoreWeights);
        const descriptor = alternatives[0]?.observed || this.analyzeBinaryWithSharedSlices(segCrop.binary, segCrop.w, segCrop.h, settings, { minArea: 2, minClearRun: 1, maxInkPerColumn: 0 });
        segments.push({
          lineIndex: li,
          segmentIndex: si,
          bbox: { x: box.x, y: box.y, w: box.w, h: box.h },
          rawBox: { ...box },
          descriptor,
          alternatives,
        });
      }

      const mergedCandidates = [];

      for (let start = 0; start < lineSections.length; start++) {
        let run = [lineSections[start]];
        for (let end = start + 1; end < Math.min(lineSections.length, start + settings.mergeSpanMaxSections); end++) {
          const prev = lineSections[end - 1];
          const cur = lineSections[end];
          const gap = this.sectionGap(prev, cur);
          if (gap > settings.mergeSpanMaxGapPx) break;
          run.push(cur);

          const lineHeight = estimatedFontPx || lineBand.height || 1;
          const shouldMerge =
            this.isThinRunCandidate(run, lineHeight, settings) ||
            this.isAsymmetricThinRunCandidate(run, lineHeight, settings) ||
            this.isStackedRunCandidate(run, lineHeight, settings) ||
            (
              settings.mergeLaKonCheck &&
              run.length === 2 &&
              gap <= settings.laKonMaxGapPx &&
              run.every(sec => sec.w <= settings.laKonMaxSingleWidthPx)
            );

          if (!shouldMerge) continue;

          const mergedBox = this.buildMergedSectionBox(run);
          const mergedCrop = this.cropBinary(cropped.binary, cropped.w, cropped.h, mergedBox.x, mergedBox.x + mergedBox.w, mergedBox.y, mergedBox.y + mergedBox.h);
          const alternatives = this.rankSegmentAgainstBank(mergedCrop.binary, mergedCrop.w, mergedCrop.h, bank, settings, scoreWeights)
            .map(alt => ({ ...alt, total: Number((alt.total - settings.mergeSpanGain).toFixed(6)) }));

          mergedCandidates.push({
            start,
            endExclusive: end + 1,
            rawBox: mergedBox,
            sections: run.map(s => ({ ...s })),
            alternatives,
          });
        }
      }

      const line = {
        lineIndex: li,
        y0: lineBand.y0,
        y1: lineBand.y1,
        estimatedFontPx,
        observedDescriptor,
        segments,
        mergedCandidates,
        structures,
        lineBinary: cropped.binary,
        lineBinaryW: cropped.w,
        lineBinaryH: cropped.h,
        lineShared: {
          source_bbox: sharedLine.source_bbox,
          source_vertical_gaps: sharedLine.source_vertical_gaps,
          source_sections: sharedLine.source_sections,
          trimmed_width: sharedLine._trimmed_width,
          trimmed_height: sharedLine._trimmed_height,
          trimmed_binary: sharedLine._trimmed_binary
        }
      };

      for (const st of structures) {
        st.alternatives = await this.decodeStructureInterior(st, {
          lineIndex: li,
          estimatedFontPx,
          lineBinary: cropped.binary,
          lineBinaryW: cropped.w,
          lineBinaryH: cropped.h
        }, bank, scriptFamily, settings, scoreWeights);
      }

      const lineAlternatives = await this.decodeLineWithBeam(line, bank, scriptFamily, settings);
      line.bestText = lineAlternatives[0]?.text || "";
      line.alternatives = lineAlternatives.map(alt => ({
        text: alt.text,
        localScore: Number((alt.localScore || 0).toFixed(6)),
        lineScore: Number((alt.lineScore || 0).toFixed(6)),
        totalScore: Number((alt.totalScore || 0).toFixed(6)),
      }));

      lines.push(line);
    }

    const analysis = {
      kind: "sitelen-ocr-analysis",
      source: { width, height, threshold, deskewAngle: bestAngle },
      settings_snapshot: settings,
      lines,
      created_at: new Date().toISOString(),
    };
    this.lastAnalysis = analysis;
    return analysis;
  }

  buildOverlayModel(analysis, sourceWidth, sourceHeight) {
    const items = [];
    for (const line of (analysis?.lines || [])) {
      items.push({ type: "line", lineIndex: line.lineIndex, x: 0, y: line.y0, w: sourceWidth, h: line.y1 - line.y0 });
      for (const gap of (line.lineShared?.source_vertical_gaps || [])) {
        items.push({
          type: "lineGap",
          lineIndex: line.lineIndex,
          x0: gap.x0,
          x1: gap.x1,
          y0: line.y0 + (line.lineShared?.source_bbox?.y || 0),
          y1: line.y0 + (line.lineShared?.source_bbox?.y || 0) + (line.lineShared?.trimmed_height || 0),
        });
      }
      for (const sec of (line.lineShared?.source_sections || [])) {
        items.push({
          type: "lineSection",
          lineIndex: line.lineIndex,
          x: sec.x,
          y: line.y0 + sec.y,
          w: sec.w,
          h: sec.h
        });
      }
      for (const st of (line.structures || [])) {
        items.push({
          type: "structure",
          lineIndex: line.lineIndex,
          structureType: st.type,
          x: st.bbox.x,
          y: line.y0 + st.bbox.y,
          w: st.bbox.w,
          h: st.bbox.h
        });
        if (st.interiorBox) {
          items.push({
            type: "structureInterior",
            lineIndex: line.lineIndex,
            structureType: st.type,
            x: st.interiorBox.x,
            y: line.y0 + st.interiorBox.y,
            w: st.interiorBox.w,
            h: st.interiorBox.h
          });
        }
      }
    }
    return items;
  }

  exportBankJson(bank = this.lastBank) { return JSON.stringify(bank, null, 2); }
  exportAnalysisJson(analysis = this.lastAnalysis) { return JSON.stringify(analysis, null, 2); }
}