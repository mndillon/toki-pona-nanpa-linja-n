console.log("[sitelen-vector-js] CARTOUCHE-LINE-CLIP EXPORTER v136 clip-strategy loaded");
const DEFAULT_WASM_MODULE_URL = new URL("../wasm/sitelen_vector_wasm.js?v=143", import.meta.url).href;
const PX_TO_PT = 72 / 96;
const CARTOUCHE_START_CP = 0xF1990;
const CARTOUCHE_END_CP = 0xF1991;
const CARTOUCHE_TALLY_CP = 0xF199E;
const KOLON_CP = 0xF199D;
const KASI_CP = 0xF1917;
const LEFT_CORNER_BRACKET_CP = 0x300C;
const RIGHT_CORNER_BRACKET_CP = 0x300D;
const PATRICK_HAND_FONT_URL = "./fonts/PatrickHand-Regular.ttf";
const DEFAULT_LITERAL_CARTOUCHE_RULE_CLIP_SCALE = 0.42;
const LITERAL_CARTOUCHE_RULE_CLIP_SCALE_SETTING_KEYS = [
  "literalCartoucheRuleClipScale",
  "quotedLiteralCartoucheRuleClipScale",
  "literalCartoucheClipScale",
  "cartoucheRuleClipScale"
];
const DEFAULT_LITERAL_CARTOUCHE_RULE_CLIP_STRATEGY = "thinRule";
const LITERAL_CARTOUCHE_RULE_CLIP_STRATEGY_SETTING_KEYS = [
  "literalCartoucheRuleClipStrategy",
  "quotedLiteralCartoucheRuleClipStrategy",
  "literalCartoucheClipStrategy",
  "cartoucheRuleClipStrategy"
];
const DEFAULT_LITERAL_CARTOUCHE_LEFT_CAP_CLIP_RATIO = 0.90;
const LITERAL_CARTOUCHE_LEFT_CAP_CLIP_RATIO_SETTING_KEYS = [
  "literalCartoucheLeftCapClipRatio",
  "quotedLiteralCartoucheLeftCapClipRatio",
  "literalCartoucheCapClipRatio",
  "cartoucheLeftCapClipRatio"
];

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function nowIso() {
  try { return new Date().toISOString(); } catch { return ""; }
}

function safeConsole(method, ...args) {
  try {
    const fn = console?.[method] || console?.log;
    if (typeof fn === "function") fn.call(console, ...args);
  } catch {}
}

function normalizeHex(value, fallback = "#111111") {
  const s = String(value ?? "").trim();
  return /^#[0-9a-f]{6}$/i.test(s) ? s : fallback;
}

function escapeXml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function debugLog(enabled, ...args) {
  if (!enabled) return;
  try { console.log("[sitelen-vector-exporter]", ...args); } catch {}
}

function debugWarn(enabled, ...args) {
  if (!enabled) return;
  try { console.warn("[sitelen-vector-exporter]", ...args); } catch {}
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

async function blobToUint8Array(blobOrBytes) {
  if (!blobOrBytes) return null;
  if (blobOrBytes instanceof Uint8Array) return blobOrBytes;
  if (blobOrBytes instanceof ArrayBuffer) return new Uint8Array(blobOrBytes);
  if (ArrayBuffer.isView(blobOrBytes)) return new Uint8Array(blobOrBytes.buffer.slice(blobOrBytes.byteOffset, blobOrBytes.byteOffset + blobOrBytes.byteLength));
  if (blobOrBytes instanceof Blob) return new Uint8Array(await blobOrBytes.arrayBuffer());
  return null;
}

function runTextOrCps(run) {
  if (typeof run?.encodedText === "string" && run.encodedText.length) return { text: run.encodedText, cps: [] };
  if (Array.isArray(run?.cps) && run.cps.length) return { text: "", cps: run.cps.slice() };
  const el = run?._element || {};
  if (typeof el.text === "string" && el.text.length) return { text: el.text, cps: [] };
  if (el.type === "glyph" && Number.isFinite(el.cp)) return { text: "", cps: [el.cp] };
  if (Array.isArray(el.cps) && el.cps.length) return { text: "", cps: el.cps.slice() };
  return { text: "", cps: [] };
}

function isDrawableRun(run) {
  if (!run || run.kind === "gap") return false;
  if (run.kind === "image" || run.isImage) return false;
  const payload = runTextOrCps(run);
  return !!payload.text || payload.cps.length > 0;
}

function getRunBaseline(run) {
  if (Number.isFinite(Number(run?.baselineYPx))) return Number(run.baselineYPx);
  return Number(run?.yPx || 0) + Number(run?.ascentPx || run?.fontPx || 0);
}

function getRunX(run) {
  return Number(run?.drawXPx ?? run?.xPx ?? 0);
}

function getRunFontPx(run, fallback = 56) {
  const n = Number(run?.fontPx ?? run?._element?.px ?? fallback);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function getRunFill(run, fallback = "#111111") {
  return normalizeHex(run?.fillStyle || run?._element?.fillStyle || fallback, fallback);
}

function getRunHalo(run) {
  const h = run?.halo || run?._element?.halo || {};
  return {
    enabled: !!h.enabled,
    color: normalizeHex(h.color || "#FFFFFF", "#FFFFFF"),
    widthPx: Math.max(0, Number(h.widthPx || 0))
  };
}


function u16be(view, offset) {
  if (!view || offset < 0 || offset + 2 > view.byteLength) return null;
  return view.getUint16(offset, false);
}

function i16be(view, offset) {
  if (!view || offset < 0 || offset + 2 > view.byteLength) return null;
  return view.getInt16(offset, false);
}

function u32be(view, offset) {
  if (!view || offset < 0 || offset + 4 > view.byteLength) return null;
  return view.getUint32(offset, false);
}

function tagAt(view, offset) {
  if (!view || offset < 0 || offset + 4 > view.byteLength) return "";
  return String.fromCharCode(
    view.getUint8(offset),
    view.getUint8(offset + 1),
    view.getUint8(offset + 2),
    view.getUint8(offset + 3)
  );
}

function viewForFontBytes(fontBytes) {
  if (!fontBytes) return null;
  if (fontBytes instanceof Uint8Array) {
    return new DataView(fontBytes.buffer, fontBytes.byteOffset, fontBytes.byteLength);
  }
  if (fontBytes instanceof ArrayBuffer) return new DataView(fontBytes);
  if (ArrayBuffer.isView(fontBytes)) return new DataView(fontBytes.buffer, fontBytes.byteOffset, fontBytes.byteLength);
  return null;
}

function sfntOffsetForFont(view) {
  if (!view || view.byteLength < 12) return null;
  const tag = tagAt(view, 0);
  if (tag === "ttcf") {
    const count = u32be(view, 8) || 0;
    if (count < 1 || view.byteLength < 16) return null;
    const firstOffset = u32be(view, 12);
    return Number.isFinite(firstOffset) && firstOffset >= 0 && firstOffset + 12 <= view.byteLength ? firstOffset : null;
  }
  if (tag === "wOFF" || tag === "wOF2") return null;
  const scaler = u32be(view, 0);
  if (scaler === 0x00010000 || tag === "OTTO" || tag === "true" || tag === "typ1") return 0;
  return null;
}

function tableRangeFromSfnt(view, tableTag) {
  const base = sfntOffsetForFont(view);
  if (base == null || base + 12 > view.byteLength) return null;
  const numTables = u16be(view, base + 4) || 0;
  const dir = base + 12;
  for (let i = 0; i < numTables; i++) {
    const rec = dir + i * 16;
    if (rec + 16 > view.byteLength) break;
    if (tagAt(view, rec) !== tableTag) continue;
    const offset = u32be(view, rec + 8);
    const length = u32be(view, rec + 12);
    if (!Number.isFinite(offset) || !Number.isFinite(length)) return null;
    if (offset < 0 || length < 0 || offset + length > view.byteLength) return null;
    return { offset, length };
  }
  return null;
}

function glyphIdFromCmapFormat4(view, offset, length, codepoint) {
  if (codepoint < 0 || codepoint > 0xFFFF) return null;
  if (length < 16 || offset + length > view.byteLength) return null;
  const segCountX2 = u16be(view, offset + 6);
  if (!segCountX2 || segCountX2 % 2 !== 0) return null;
  const segCount = segCountX2 / 2;
  const endCodeOff = offset + 14;
  const startCodeOff = endCodeOff + segCount * 2 + 2;
  const idDeltaOff = startCodeOff + segCount * 2;
  const idRangeOffsetOff = idDeltaOff + segCount * 2;
  if (idRangeOffsetOff + segCount * 2 > offset + length) return null;

  for (let i = 0; i < segCount; i++) {
    const endCode = u16be(view, endCodeOff + i * 2);
    const startCode = u16be(view, startCodeOff + i * 2);
    if (endCode == null || startCode == null) return null;
    if (codepoint < startCode || codepoint > endCode) continue;

    const delta = i16be(view, idDeltaOff + i * 2);
    const rangeOffsetAddress = idRangeOffsetOff + i * 2;
    const rangeOffset = u16be(view, rangeOffsetAddress);
    if (delta == null || rangeOffset == null) return null;

    if (rangeOffset === 0) return (codepoint + delta) & 0xFFFF;

    const glyphIndexAddress = rangeOffsetAddress + rangeOffset + (codepoint - startCode) * 2;
    if (glyphIndexAddress < offset || glyphIndexAddress + 2 > offset + length) return 0;
    const glyphIndex = u16be(view, glyphIndexAddress) || 0;
    return glyphIndex === 0 ? 0 : ((glyphIndex + delta) & 0xFFFF);
  }
  return 0;
}

function glyphIdFromCmapFormat12Or13(view, offset, length, codepoint, format) {
  if (length < 16 || offset + length > view.byteLength) return null;
  const nGroups = u32be(view, offset + 12);
  if (nGroups == null) return null;
  const groupsOff = offset + 16;
  if (groupsOff + nGroups * 12 > offset + length) return null;
  let lo = 0;
  let hi = nGroups - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const g = groupsOff + mid * 12;
    const startChar = u32be(view, g);
    const endChar = u32be(view, g + 4);
    const startGlyph = u32be(view, g + 8);
    if (startChar == null || endChar == null || startGlyph == null) return null;
    if (codepoint < startChar) hi = mid - 1;
    else if (codepoint > endChar) lo = mid + 1;
    else return format === 13 ? startGlyph : (startGlyph + (codepoint - startChar));
  }
  return 0;
}

function glyphIdFromCmapFormat6(view, offset, length, codepoint) {
  if (length < 10 || offset + length > view.byteLength) return null;
  const firstCode = u16be(view, offset + 6);
  const entryCount = u16be(view, offset + 8);
  if (firstCode == null || entryCount == null) return null;
  if (codepoint < firstCode || codepoint >= firstCode + entryCount) return 0;
  const glyphOff = offset + 10 + (codepoint - firstCode) * 2;
  if (glyphOff + 2 > offset + length) return null;
  return u16be(view, glyphOff) || 0;
}

function glyphIdForCodepointFromFontBytes(fontBytes, codepoint) {
  const cp = Number(codepoint);
  if (!Number.isFinite(cp) || cp < 0 || cp > 0x10FFFF) return null;
  const view = viewForFontBytes(fontBytes);
  if (!view) return null;
  const cmap = tableRangeFromSfnt(view, "cmap");
  if (!cmap) return null;
  const cmapOffset = cmap.offset;
  if (cmapOffset + 4 > view.byteLength) return null;
  const numTables = u16be(view, cmapOffset + 2) || 0;
  const candidates = [];

  for (let i = 0; i < numTables; i++) {
    const rec = cmapOffset + 4 + i * 8;
    if (rec + 8 > cmapOffset + cmap.length) break;
    const platformId = u16be(view, rec);
    const encodingId = u16be(view, rec + 2);
    const subOffsetRel = u32be(view, rec + 4);
    if (platformId == null || encodingId == null || subOffsetRel == null) continue;
    const subOffset = cmapOffset + subOffsetRel;
    if (subOffset + 2 > cmapOffset + cmap.length) continue;
    const format = u16be(view, subOffset);
    let subLength = null;
    if (format === 12 || format === 13) subLength = u32be(view, subOffset + 4);
    else subLength = u16be(view, subOffset + 2);
    if (!subLength || subLength <= 0 || subOffset + subLength > view.byteLength) continue;

    let score = 0;
    if (format === 12) score += 800;
    else if (format === 13) score += 700;
    else if (format === 4) score += 600;
    else if (format === 6) score += 300;
    else if (format === 0) score += 100;
    else continue;

    if (platformId === 3 && encodingId === 10) score += 80;
    else if (platformId === 3 && (encodingId === 1 || encodingId === 0)) score += 70;
    else if (platformId === 0) score += 60;
    else if (platformId === 1) score += 10;

    candidates.push({ format, offset: subOffset, length: subLength, score, platformId, encodingId });
  }

  candidates.sort((a, b) => b.score - a.score);
  let sawSupported = false;
  for (const c of candidates) {
    let gid = null;
    if (c.format === 4) gid = glyphIdFromCmapFormat4(view, c.offset, c.length, cp);
    else if (c.format === 12 || c.format === 13) gid = glyphIdFromCmapFormat12Or13(view, c.offset, c.length, cp, c.format);
    else if (c.format === 6) gid = glyphIdFromCmapFormat6(view, c.offset, c.length, cp);
    else if (c.format === 0 && cp >= 0 && cp <= 255 && c.offset + 6 + cp < c.offset + c.length) gid = view.getUint8(c.offset + 6 + cp);
    if (gid == null) continue;
    sawSupported = true;
    if (gid > 0) return gid;
  }
  return sawSupported ? 0 : null;
}

function fontHasGlyphForCodepoint(fontBytes, codepoint) {
  const gid = glyphIdForCodepointFromFontBytes(fontBytes, codepoint);
  return Number.isFinite(gid) && gid > 0;
}

function fontRolePrefersCompanion(role) {
  const r = String(role || "").toLowerCase();
  return r === "number" || r === "date" || r === "time";
}

function fontRunPrefersCompanion(run, preset = null) {
  const role = String(run?.fontRole || "").toLowerCase();
  const family = String(run?.fontFamily || "").trim();
  if (fontRolePrefersCompanion(role)) return true;
  if (family && preset?.cartoucheFamily && family === String(preset.cartoucheFamily)) return true;
  if (/cartouche/i.test(family) && role !== "word") return true;
  return false;
}

function isCartoucheRun(run) {
  return String(run?.kind || "").toLowerCase() === "cartouche" ||
    String(run?._element?.type || "").toLowerCase() === "cartouche";
}

function runRole(run) {
  return String(run?.fontRole || run?.renderMode || "").trim().toLowerCase();
}

function runIsDateOrTime(run) {
  const role = runRole(run);
  const mode = String(run?.renderMode || "").trim().toLowerCase();
  const sourceKind = String(run?.sourceKind || "").trim().toLowerCase();
  return role === "date" || role === "time" || mode === "date" || mode === "time" || sourceKind === "date" || sourceKind === "time";
}

function replaceKolonWithKasiForDateTime(run, cps) {
  const arr = Array.from(cps || []);
  if (!runIsDateOrTime(run)) return arr;
  return arr.map(cp => Number(cp) === KOLON_CP ? KASI_CP : cp);
}

function getManualTalliesForRun(run) {
  const candidates = [
    run?.manualTallies,
    run?._element?.manualTallies,
    run?.element?.manualTallies
  ];
  for (const v of candidates) {
    if (Array.isArray(v) && v.some(n => Number(n) > 0)) {
      return v.map(n => Math.max(0, Math.min(8, Math.round(Number(n) || 0))));
    }
  }
  return null;
}


function getCartoucheTallyModeForRun(run, exporter = null) {
  const candidates = [
    run?.cartoucheTallyMode,
    run?._element?.cartoucheTallyMode,
    run?.element?.cartoucheTallyMode,
    exporter?.cartoucheTallyMode,
    exporter?.options?.cartoucheTallyMode
  ];

  const fc = exporter?.fontController;
  try {
    const preset = fc?.getActivePreset?.();
    candidates.push(
      preset?.cartoucheTallyMode,
      preset?.settings?.cartoucheTallyMode,
      preset?.__pairRecord?.cartoucheTallyMode,
      preset?.__pairRecord?.settings?.cartoucheTallyMode
    );
  } catch {}

  for (const name of ["getActivePresetRecord", "getActiveRecord", "getSelectedPairRecord", "getSelectedRecord", "getActivePairRecord", "getCurrentRecord", "getCurrentPreset"]) {
    try {
      const obj = (typeof fc?.[name] === "function") ? fc[name]() : null;
      candidates.push(
        obj?.cartoucheTallyMode,
        obj?.settings?.cartoucheTallyMode,
        obj?.pairRecord?.cartoucheTallyMode,
        obj?.pairRecord?.settings?.cartoucheTallyMode
      );
    } catch {}
  }

  for (const v of candidates) {
    const s = String(v || "").trim().toLowerCase();
    if (s === "manual" || s === "ucsur" || s === "comma") return s;
  }
  return "ucsur";
}

function isManualTallyModeForRun(run, exporter = null) {
  return getCartoucheTallyModeForRun(run, exporter) === "manual";
}

function normalizeLiteralCartoucheRuleClipScale(value, fallback = DEFAULT_LITERAL_CARTOUCHE_RULE_CLIP_SCALE) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  // Keep the setting useful but prevent accidental destructive clipping values.
  return Math.max(0.05, Math.min(2.0, n));
}

function normalizeLiteralCartoucheRuleClipStrategy(value, fallback = DEFAULT_LITERAL_CARTOUCHE_RULE_CLIP_STRATEGY) {
  const s = String(value ?? "").trim().toLowerCase();
  if (!s) return fallback;
  if (s === "none" || s === "off" || s === "false" || s === "disabled") return "none";
  if (s === "thin" || s === "thin-rule" || s === "thinrule" || s === "separate" || s === "separate-rules") return "thinRule";
  if (s === "compound" || s === "compound-rule" || s === "compoundrule" || s === "compound-top-bottom") return "compound";
  if (s === "all" || s === "all-crossing" || s === "allcrossing" || s === "crossing") return "allCrossing";
  if (s === "leftcap" || s === "left-cap" || s === "leftcaprule" || s === "left-cap-rule" || s === "cap" || s === "cap-rule") return "leftCap";
  if (s === "auto" || s === "detect" || s === "detected") return "auto";
  return fallback;
}

function firstStringSettingValueFromObject(obj, keys) {
  if (!obj || typeof obj !== "object") return null;
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const s = String(obj[key] ?? "").trim();
      if (s) return s;
    }
  }
  const settings = obj.settings;
  if (settings && typeof settings === "object") {
    for (const key of keys) {
      if (Object.prototype.hasOwnProperty.call(settings, key)) {
        const s = String(settings[key] ?? "").trim();
        if (s) return s;
      }
    }
  }
  return null;
}

function firstFiniteSettingValueFromObject(obj, keys = LITERAL_CARTOUCHE_RULE_CLIP_SCALE_SETTING_KEYS) {
  if (!obj || typeof obj !== "object") return null;
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const n = Number(obj[key]);
      if (Number.isFinite(n) && n > 0) return n;
    }
  }
  const settings = obj.settings;
  if (settings && typeof settings === "object") {
    for (const key of keys) {
      if (Object.prototype.hasOwnProperty.call(settings, key)) {
        const n = Number(settings[key]);
        if (Number.isFinite(n) && n > 0) return n;
      }
    }
  }
  return null;
}

function getLiteralCartoucheRuleClipScaleForRun(run, exporter = null) {
  const directCandidates = [
    run?.literalCartoucheRuleClipScale,
    run?._element?.literalCartoucheRuleClipScale,
    run?.element?.literalCartoucheRuleClipScale,
    exporter?.literalCartoucheRuleClipScale,
    exporter?.options?.literalCartoucheRuleClipScale,
    exporter?.options?.quotedLiteralCartoucheRuleClipScale,
    exporter?.options?.literalCartoucheClipScale,
    exporter?.options?.cartoucheRuleClipScale
  ];

  for (const value of directCandidates) {
    const n = Number(value);
    if (Number.isFinite(n) && n > 0) return normalizeLiteralCartoucheRuleClipScale(n);
  }

  const fc = exporter?.fontController;
  const objectCandidates = [];
  try {
    const preset = fc?.getActivePreset?.();
    if (preset) objectCandidates.push(preset, preset.settings, preset.__pairRecord, preset.__pairRecord?.settings);
  } catch {}

  for (const name of ["getActivePresetRecord", "getActiveRecord", "getSelectedPairRecord", "getSelectedRecord", "getActivePairRecord", "getCurrentRecord", "getCurrentPreset"]) {
    try {
      const obj = (typeof fc?.[name] === "function") ? fc[name]() : null;
      if (obj) objectCandidates.push(obj, obj.settings, obj.pairRecord, obj.pairRecord?.settings);
    } catch {}
  }

  for (const obj of objectCandidates) {
    const value = firstFiniteSettingValueFromObject(obj);
    if (value != null) return normalizeLiteralCartoucheRuleClipScale(value);
  }

  return DEFAULT_LITERAL_CARTOUCHE_RULE_CLIP_SCALE;
}

function getLiteralCartoucheRuleClipStrategyForRun(run, exporter = null) {
  const directCandidates = [
    run?.literalCartoucheRuleClipStrategy,
    run?._element?.literalCartoucheRuleClipStrategy,
    run?.element?.literalCartoucheRuleClipStrategy,
    exporter?.literalCartoucheRuleClipStrategy,
    exporter?.options?.literalCartoucheRuleClipStrategy,
    exporter?.options?.quotedLiteralCartoucheRuleClipStrategy,
    exporter?.options?.literalCartoucheClipStrategy,
    exporter?.options?.cartoucheRuleClipStrategy
  ];

  for (const value of directCandidates) {
    const s = String(value ?? "").trim();
    if (s) return normalizeLiteralCartoucheRuleClipStrategy(s);
  }

  const fc = exporter?.fontController;
  const objectCandidates = [];
  try {
    const preset = fc?.getActivePreset?.();
    if (preset) objectCandidates.push(preset, preset.settings, preset.__pairRecord, preset.__pairRecord?.settings);
  } catch {}

  for (const name of ["getActivePresetRecord", "getActiveRecord", "getSelectedPairRecord", "getSelectedRecord", "getActivePairRecord", "getCurrentRecord", "getCurrentPreset"]) {
    try {
      const obj = (typeof fc?.[name] === "function") ? fc[name]() : null;
      if (obj) objectCandidates.push(obj, obj.settings, obj.pairRecord, obj.pairRecord?.settings);
    } catch {}
  }

  for (const obj of objectCandidates) {
    const value = firstStringSettingValueFromObject(obj, LITERAL_CARTOUCHE_RULE_CLIP_STRATEGY_SETTING_KEYS);
    if (value != null) return normalizeLiteralCartoucheRuleClipStrategy(value);
  }

  return DEFAULT_LITERAL_CARTOUCHE_RULE_CLIP_STRATEGY;
}

function normalizeLiteralCartoucheLeftCapClipRatio(value, fallback = DEFAULT_LITERAL_CARTOUCHE_LEFT_CAP_CLIP_RATIO) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.max(0.50, Math.min(1.20, n));
}

function getLiteralCartoucheLeftCapClipRatioForRun(run, exporter = null) {
  const directCandidates = [
    run?.literalCartoucheLeftCapClipRatio,
    run?._element?.literalCartoucheLeftCapClipRatio,
    run?.element?.literalCartoucheLeftCapClipRatio,
    exporter?.literalCartoucheLeftCapClipRatio,
    exporter?.options?.literalCartoucheLeftCapClipRatio,
    exporter?.options?.quotedLiteralCartoucheLeftCapClipRatio,
    exporter?.options?.literalCartoucheCapClipRatio,
    exporter?.options?.cartoucheLeftCapClipRatio
  ];

  for (const value of directCandidates) {
    const n = Number(value);
    if (Number.isFinite(n) && n > 0) return normalizeLiteralCartoucheLeftCapClipRatio(n);
  }

  const fc = exporter?.fontController;
  const objectCandidates = [];
  try {
    const preset = fc?.getActivePreset?.();
    if (preset) objectCandidates.push(preset, preset.settings, preset.__pairRecord, preset.__pairRecord?.settings);
  } catch {}

  for (const name of ["getActivePresetRecord", "getActiveRecord", "getSelectedPairRecord", "getSelectedRecord", "getActivePairRecord", "getCurrentRecord", "getCurrentPreset"]) {
    try {
      const obj = (typeof fc?.[name] === "function") ? fc[name]() : null;
      if (obj) objectCandidates.push(obj, obj.settings, obj.pairRecord, obj.pairRecord?.settings);
    } catch {}
  }

  for (const obj of objectCandidates) {
    const value = firstFiniteSettingValueFromObject(obj, LITERAL_CARTOUCHE_LEFT_CAP_CLIP_RATIO_SETTING_KEYS);
    if (value != null) return normalizeLiteralCartoucheLeftCapClipRatio(value);
  }

  return DEFAULT_LITERAL_CARTOUCHE_LEFT_CAP_CLIP_RATIO;
}

function buildSvgRectPath(x, y, w, h, r = 0) {
  x = Number(x) || 0;
  y = Number(y) || 0;
  w = Math.max(0, Number(w) || 0);
  h = Math.max(0, Number(h) || 0);
  r = Math.max(0, Math.min(Number(r) || 0, w / 2, h / 2));
  if (w <= 0 || h <= 0) return "";
  if (r <= 0) return `M${num(x)} ${num(y)} L${num(x + w)} ${num(y)} L${num(x + w)} ${num(y + h)} L${num(x)} ${num(y + h)} Z`;
  return [
    `M${num(x + r)} ${num(y)}`,
    `L${num(x + w - r)} ${num(y)}`,
    `Q${num(x + w)} ${num(y)} ${num(x + w)} ${num(y + r)}`,
    `L${num(x + w)} ${num(y + h - r)}`,
    `Q${num(x + w)} ${num(y + h)} ${num(x + w - r)} ${num(y + h)}`,
    `L${num(x + r)} ${num(y + h)}`,
    `Q${num(x)} ${num(y + h)} ${num(x)} ${num(y + h - r)}`,
    `L${num(x)} ${num(y + r)}`,
    `Q${num(x)} ${num(y)} ${num(x + r)} ${num(y)}`,
    "Z"
  ].join(" ");
}

function makeSyntheticPathFromD(d, { fill = "#111111", halo = null, source = "synthetic" } = {}) {
  const s = String(d || "");
  const nums = Array.from(s.matchAll(/-?\d+(?:\.\d+)?/g)).map(m => Number(m[0])).filter(Number.isFinite);
  const xs = [];
  const ys = [];
  for (let i = 0; i + 1 < nums.length; i += 2) {
    xs.push(nums[i]);
    ys.push(nums[i + 1]);
  }
  const bounds = xs.length ? {
    minX: Math.min(...xs),
    minY: Math.min(...ys),
    maxX: Math.max(...xs),
    maxY: Math.max(...ys)
  } : null;
  return { d: s, commands: [], fill, halo, source, bounds };
}

function buildFilledRectPath(x, y, w, h) {
  return buildSvgRectPath(x, y, w, h, 0);
}

function buildSyntheticCornerBracketPathsForRun(run, { fill = "#111111", halo = null } = {}) {
  const payload = runTextOrCps(run);
  const cps = Array.isArray(payload.cps) && payload.cps.length
    ? payload.cps
    : Array.from(String(payload.text || "")).map(ch => ch.codePointAt(0)).filter(Number.isFinite);
  const cp = Number(cps[0]);
  if (cp !== LEFT_CORNER_BRACKET_CP && cp !== RIGHT_CORNER_BRACKET_CP) return [];

  const isRight = cp === RIGHT_CORNER_BRACKET_CP;
  const fontPx = getRunFontPx(run, 56);
  //const strokeW = Math.max(2.5, fontPx * 0.065);
  const isTinyFontPx = fontPx <= 12;
  const strokeW = isTinyFontPx
    ? Math.max(1.0, fontPx * 0.065)
    : Math.max(2.5, fontPx * 0.065);
    
  const runX = Number(run?.xPx ?? getRunX(run) ?? 0);
  const runW = Math.max(Number(run?.widthPx || 0), fontPx * 0.36);
  const baseline = getRunBaseline(run);
  const runH = Math.max(Number(run?.heightPx || 0), fontPx * 0.76);

  const pad = Math.max(0.5, strokeW * 0.5);
  const xLeft = runX + pad;
  const xRight = runX + runW - pad;
  let yTop = baseline - runH * 0.82;
  // v117: the top-left fallback bracket was sitting too low compared with the glyph row.
  // Lift only the U+300C top-left bracket; keep the U+300D bottom-right bracket anchored lower.
  if (!isRight) yTop -= Math.max(4, fontPx * 0.18);
  const yBottom = yTop + runH;
  const arm = Math.max(fontPx * 0.26, Math.min(runW * 0.82, fontPx * 0.48));
  const paths = [];

  if (isRight) {
    paths.push(makeSyntheticPathFromD(
      buildFilledRectPath(xRight - strokeW, yTop, strokeW, runH),
      { fill, halo, source: "synthetic-bottom-right-bracket-vertical" }
    ));
    paths.push(makeSyntheticPathFromD(
      buildFilledRectPath(xRight - arm, yBottom - strokeW, arm, strokeW),
      { fill, halo, source: "synthetic-bottom-right-bracket-arm" }
    ));
  } else {
    paths.push(makeSyntheticPathFromD(
      buildFilledRectPath(xLeft, yTop, strokeW, runH),
      { fill, halo, source: "synthetic-top-left-bracket-vertical" }
    ));
    paths.push(makeSyntheticPathFromD(
      buildFilledRectPath(xLeft, yTop, arm, strokeW),
      { fill, halo, source: "synthetic-top-left-bracket-arm" }
    ));
  }

  return paths;
}

function shouldReplaceLiteralCartoucheRulePaths(run) {
  return shouldRepairLiteralCartoucheVectorLeftEdge(run);
}

function rectPathFromBoundsLikeRule(x1, x2, y1, y2, fill) {
  const x = Math.min(x1, x2);
  const y = Math.min(y1, y2);
  const w = Math.max(1, Math.abs(x2 - x1));
  const h = Math.max(1, Math.abs(y2 - y1));
  return makeSyntheticPathFromD(buildFilledRectPath(x, y, w, h), {
    fill,
    source: "literal-cartouche-replacement-rule"
  });
}


function buildSyntheticLiteralFrameFromBounds(bounds, run, { fill = "#111111" } = {}) {
  return null;
}

function buildRoundedRectCenterlineForStroke(x, y, w, h, r) {
  x = Number(x) || 0;
  y = Number(y) || 0;
  w = Math.max(1, Number(w) || 1);
  h = Math.max(1, Number(h) || 1);
  r = Math.max(0, Math.min(Number(r) || 0, w / 2, h / 2));
  return [
    `M${num(x + r)} ${num(y)}`,
    `L${num(x + w - r)} ${num(y)}`,
    `Q${num(x + w)} ${num(y)} ${num(x + w)} ${num(y + r)}`,
    `L${num(x + w)} ${num(y + h - r)}`,
    `Q${num(x + w)} ${num(y + h)} ${num(x + w - r)} ${num(y + h)}`,
    `L${num(x + r)} ${num(y + h)}`,
    `Q${num(x)} ${num(y + h)} ${num(x)} ${num(y + h - r)}`,
    `L${num(x)} ${num(y + r)}`,
    `Q${num(x)} ${num(y)} ${num(x + r)} ${num(y)}`,
    "Z"
  ].join(" ");
}

function replaceLiteralCartoucheWholeFrameIfNeeded(run, paths, { fill = "#111111", debug = false, runIndex = null } = {}) {
  // v120: no whole-frame drawing. Only top/bottom line clipping is allowed.
  return Array.isArray(paths) ? paths : [];
}


function replaceLiteralCartoucheRulePaths(run, paths, { fill = "#111111", debug = false, runIndex = null } = {}) {
  // v120: no manual rule drawing. Only clipping selected existing top/bottom paths.
  return Array.isArray(paths) ? paths : [];
}




function hasUnescapedDoubleQuote(s) {
  const text = String(s ?? "");
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== '"') continue;
    let slashCount = 0;
    for (let j = i - 1; j >= 0 && text[j] === "\\"; j--) slashCount++;
    if ((slashCount % 2) === 0) return true;
  }
  return false;
}

function strictLiteralCartoucheSourceText(run) {
  const candidates = [
    run?.sourceText,
    run?._element?.sourceText,
    run?.rawSourceText,
    run?._element?.rawSourceText
  ];

  for (const v of candidates) {
    const s = String(v ?? "").trim();
    if (!s) continue;

    // Preferred full source form: ["ABC"]
    if (s.startsWith('["') && s.endsWith('"]')) {
      const inner = s.slice(2, -2);
      if (!hasUnescapedDoubleQuote(inner)) return s;
    }

    // Some renderer paths store only the bracket content, e.g. "ABC".
    // This is acceptable only when the renderer also set repairQuotedLatinLeftEdge.
    if (s.startsWith('"') && s.endsWith('"')) {
      const inner = s.slice(1, -1);
      if (!hasUnescapedDoubleQuote(inner)) return s;
    }
  }

  return null;
}

function shouldRepairLiteralCartoucheVectorLeftEdge(run) {
  if (!isCartoucheRun(run)) return false;

  const repairFlag =
    run?.repairQuotedLatinLeftEdge === true ||
    run?._element?.repairQuotedLatinLeftEdge === true;

  if (!repairFlag) return false;

  return strictLiteralCartoucheSourceText(run) != null;
}

function vectorPathBounds(path) {
  const b = path?.bounds || null;
  if (b &&
      Number.isFinite(Number(b.minX)) &&
      Number.isFinite(Number(b.minY)) &&
      Number.isFinite(Number(b.maxX)) &&
      Number.isFinite(Number(b.maxY))) {
    return {
      minX: Number(b.minX),
      minY: Number(b.minY),
      maxX: Number(b.maxX),
      maxY: Number(b.maxY)
    };
  }

  // Try d/pathData/svgPath first; fall back to commands if absent.
  // WASM sometimes populates only commands (not d) when halo is enabled.
  let d = String(path?.d || path?.pathData || path?.svgPath || "");
  if (!d) {
    const commands = asArray(path?.commands || path?.cmds || path?.pathCommands);
    if (commands.length) d = commandsToSvgD(commands);
  }
  const nums = Array.from(d.matchAll(/-?\d+(?:\.\d+)?/g)).map(m => Number(m[0])).filter(Number.isFinite);
  const xs = [];
  const ys = [];
  for (let i = 0; i + 1 < nums.length; i += 2) {
    xs.push(nums[i]);
    ys.push(nums[i + 1]);
  }

  return xs.length ? {
    minX: Math.min(...xs),
    minY: Math.min(...ys),
    maxX: Math.max(...xs),
    maxY: Math.max(...ys)
  } : null;
}

function looksLikeHorizontalCartoucheRulePath(path, run) {
  const b = vectorPathBounds(path);
  if (!b) return false;

  const fontPx = getRunFontPx(run, 56);
  const w = b.maxX - b.minX;
  const h = b.maxY - b.minY;

  // Top/bottom cartouche rules are long and thin.
  // Literal Latin glyphs are tall; rounded caps are not thin.
  return w >= Math.max(12, fontPx * 0.75) &&
         h <= Math.max(4, fontPx * 0.15);
}

function pathCenterY(path) {
  const b = vectorPathBounds(path);
  return b ? (b.minY + b.maxY) / 2 : NaN;
}

function pathCenterX(path) {
  const b = vectorPathBounds(path);
  return b ? (b.minX + b.maxX) / 2 : NaN;
}

function deriveLiteralCartoucheRuleClipX(run, paths, { clipScale = DEFAULT_LITERAL_CARTOUCHE_RULE_CLIP_SCALE } = {}) {
  // v115: do not derive the repair boundary from inner Latin glyphs.
  // The v114 heuristic often selected the left edge of A/B/C, giving clipX around runX + fontPx,
  // which is much too far right. The canvas-side repair is a left-edge donor repair, so the vector
  // repair should only remove the accidental protrusion near the left cap.
  const fontPx = getRunFontPx(run, 56);
  const runX = getRunX(run);

  // Start with a deterministic boundary just inside the left cartouche cap/transition.
  // At fontPx 144 this is runX + ~60px, close to the visual start of the proper straight rule
  // and far away from the inner Latin glyphs.
  const effectiveClipScale = normalizeLiteralCartoucheRuleClipScale(clipScale);
  const fixedClipX = runX + Math.max(8, fontPx * effectiveClipScale);

  // If the returned paths contain a plausible tall left cap, use its right edge only if it is close
  // to the fixed boundary. This prevents A/B/C glyphs from being mistaken for the cap.
  const candidates = [];
  for (const p of Array.isArray(paths) ? paths : []) {
    const b = vectorPathBounds(p);
    if (!b) continue;
    const w = b.maxX - b.minX;
    const h = b.maxY - b.minY;
    if (h < fontPx * 0.55) continue;
    if (w > fontPx * 0.80) continue;
    if (b.minX > runX + fontPx * 0.35) continue;
    if (b.maxX < runX + fontPx * 0.12) continue;
    if (b.maxX > runX + fontPx * 0.70) continue;
    candidates.push(b.maxX);
  }

  if (candidates.length) {
    candidates.sort((a, b) => a - b);
    const capClipX = candidates[Math.floor(candidates.length / 2)];
    if (Number.isFinite(capClipX) && Math.abs(capClipX - fixedClipX) <= fontPx * 0.30) {
      return capClipX;
    }
  }

  return fixedClipX;
}


function detectLiteralCartoucheLeftCapFromClassified(classified, run) {
  const fontPx = getRunFontPx(run, 56);
  const runX = getRunX(run);

  const candidates = asArray(classified).filter(x => {
    const b = x?.bounds;
    if (!b) return false;

    const w = Number(x.w || 0);
    const h = Number(x.h || 0);

    const nearLeft =
      b.minX <= runX + fontPx * 0.25 &&
      b.maxX <= runX + fontPx * 0.90;

    const tallEnough = h >= fontPx * 0.35;
    const notTooWide = w <= fontPx * 0.90;

    return nearLeft && tallEnough && notTooWide;
  });

  if (!candidates.length) return null;

  candidates.sort((a, b) => {
    if (b.h !== a.h) return b.h - a.h;
    return (a.bounds?.minX ?? 0) - (b.bounds?.minX ?? 0);
  });

  return candidates[0];
}

function isLiteralCartoucheThinHorizontalFragment(item, run) {
  const b = item?.bounds;
  if (!b) return false;

  const fontPx = getRunFontPx(run, 56);
  const w = Number(item.w || 0);
  const h = Number(item.h || 0);
  const horizontalScore = w / Math.max(1, h);

  return (
    // Literal cartouche rule overhangs can be returned as short, fairly thick
    // filled outline fragments rather than clean 1-2px hairlines. Keep this
    // fragment test permissive; the leftCap strategy later restricts actual
    // clipping to the top/bottom Y bands and the left-cap clip boundary.
    w >= Math.max(1.5, fontPx * 0.025) &&
    h <= Math.max(8, fontPx * 0.18) &&
    horizontalScore >= 1.35
  );
}

function repairLiteralCartoucheRulePathLeftEdges(run, paths, { debug = false, runIndex = null, clipScale = DEFAULT_LITERAL_CARTOUCHE_RULE_CLIP_SCALE, clipStrategy = DEFAULT_LITERAL_CARTOUCHE_RULE_CLIP_STRATEGY, leftCapClipRatio = DEFAULT_LITERAL_CARTOUCHE_LEFT_CAP_CLIP_RATIO, detectionPaths = null } = {}) {
  const input = Array.isArray(paths) ? paths : [];
  if (!input.length) return input;

  // Use clean (no-halo) paths for detection if provided and length matches.
  // This ensures clip detection works regardless of halo width in the render config.
  const forDetection = (Array.isArray(detectionPaths) && detectionPaths.length === input.length)
    ? detectionPaths
    : input;

  const repairFlag =
    run?.repairQuotedLatinLeftEdge === true ||
    run?._element?.repairQuotedLatinLeftEdge === true;
  const strictSource = strictLiteralCartoucheSourceText(run);
  const shouldRepair = shouldRepairLiteralCartoucheVectorLeftEdge(run);

  if (!shouldRepair) return input;

  const strategy = normalizeLiteralCartoucheRuleClipStrategy(clipStrategy);
  if (strategy === "none") {
    logCartoucheLineClip("detection", {
      runIndex,
      repairFlag,
      strictSource,
      shouldRepair,
      clipStrategyRaw: clipStrategy,
      strategy,
      pathCount: input.length,
      skipped: "literalCartoucheRuleClipStrategy is none"
    });
    return input;
  }

  const fontPx = getRunFontPx(run, 56);
  const runX = getRunX(run);

  // Derive runW from the actual ink span of the detection paths rather than
  // run.widthPx. The renderer inflates run.widthPx when it receives a non-zero
  // halo width, which raises the thinSingleRule threshold (runW * 0.35) above
  // the actual rule path width, causing detection to fail. Using the path span
  // instead makes clip detection purely geometry-driven and halo-independent.
  let detMinX = Infinity;
  let detMaxX = -Infinity;
  for (const dp of forDetection) {
    const db = vectorPathBounds(dp);
    if (db) { detMinX = Math.min(detMinX, db.minX); detMaxX = Math.max(detMaxX, db.maxX); }
  }
  const runW = Number.isFinite(detMinX) && Number.isFinite(detMaxX) && detMaxX > detMinX
    ? Math.max(1, detMaxX - detMinX)
    : Math.max(1, Number(run?.widthPx || 0));

  const effectiveClipScale = normalizeLiteralCartoucheRuleClipScale(clipScale);
  const fallbackClipX = runX + Math.max(8, fontPx * effectiveClipScale);
  let clipX = deriveLiteralCartoucheRuleClipX(run, forDetection, { clipScale: effectiveClipScale });

  const classified = forDetection.map((p, index) => {
    const b = vectorPathBounds(p);
    const w = b ? b.maxX - b.minX : 0;
    const h = b ? b.maxY - b.minY : 0;
    const centerX = b ? (b.minX + b.maxX) / 2 : NaN;
    const centerY = b ? (b.minY + b.maxY) / 2 : NaN;
    const horizontalScore = b ? (w / Math.max(1, h)) : 0;
    const d = String(p?.d || p?.pathData || p?.svgPath || "");

    const leftOverlap =
      b &&
      b.minX < clipX &&
      b.maxX > clipX + Math.max(4, fontPx * 0.04);

    const thinSingleRule =
      b &&
      w >= Math.max(fontPx * 0.70, runW * 0.35) &&
      h <= Math.max(fontPx * 1.10, 180) &&
      b.maxX > clipX + fontPx * 0.25;

    const compoundTopBottomRule =
      b &&
      w >= Math.max(fontPx * 0.55, runW * 0.20) &&
      h >= fontPx * 0.55 &&
      h <= Math.max(fontPx * 1.25, 190) &&
      /Z\s*M/i.test(d);

    const notInnerLatinGlyph =
      b &&
      !(h > fontPx * 0.45 && b.minX > runX + fontPx * 0.55);

    const leftCapCandidate =
      b &&
      b.minX <= runX + fontPx * 0.25 &&
      b.maxX <= runX + fontPx * 0.90 &&
      h >= fontPx * 0.35 &&
      w <= fontPx * 0.90;

    const thinHorizontalFragment = isLiteralCartoucheThinHorizontalFragment({ bounds: b, w, h }, run);

    let candidate = false;
    if (b && leftOverlap) {
      if (strategy === "thinRule") candidate = thinSingleRule;
      else if (strategy === "compound") candidate = compoundTopBottomRule;
      else if (strategy === "allCrossing") candidate = notInnerLatinGlyph;
      else if (strategy === "auto") candidate = thinSingleRule || compoundTopBottomRule;
    }

    return {
      index,
      path: p,
      bounds: b,
      w,
      h,
      centerX,
      centerY,
      horizontalScore,
      leftOverlap: !!leftOverlap,
      thinSingleRule: !!thinSingleRule,
      compoundTopBottomRule: !!compoundTopBottomRule,
      notInnerLatinGlyph: !!notInnerLatinGlyph,
      leftCapCandidate: !!leftCapCandidate,
      thinHorizontalFragment: !!thinHorizontalFragment,
      candidate: !!candidate
    };
  });

  const diagnosticRows = classified.map(x => {
    const rejectReasons = [];
    if (!x.bounds) {
      rejectReasons.push("no bounds");
    } else {
      if (strategy !== "leftCap" && !x.leftOverlap) rejectReasons.push("does not cross clipX / no left overlap");
      if (strategy === "leftCap" && !x.thinHorizontalFragment) rejectReasons.push("strategy leftCap: not accepted as thin horizontal fragment");
      if (strategy === "thinRule" && !x.thinSingleRule) rejectReasons.push("strategy thinRule: not accepted as thinSingleRule");
      if (strategy === "compound" && !x.compoundTopBottomRule) rejectReasons.push("strategy compound: not accepted as compoundTopBottomRule");
      if (strategy === "allCrossing" && !x.notInnerLatinGlyph) rejectReasons.push("strategy allCrossing: rejected as likely inner Latin glyph");
      if (strategy === "auto" && !(x.thinSingleRule || x.compoundTopBottomRule)) rejectReasons.push("strategy auto: neither thinSingleRule nor compoundTopBottomRule");
      if (x.leftOverlap) {
        if (!x.thinSingleRule) rejectReasons.push("thinSingleRule=false");
        if (!x.compoundTopBottomRule) rejectReasons.push("compoundTopBottomRule=false");
        if (!x.notInnerLatinGlyph) rejectReasons.push("notInnerLatinGlyph=false");
      }
    }
    return {
      runIndex,
      strictSource,
      strategy,
      pathIndex: x.index,
      minX: x.bounds?.minX,
      maxX: x.bounds?.maxX,
      minY: x.bounds?.minY,
      maxY: x.bounds?.maxY,
      w: x.w,
      h: x.h,
      centerX: x.centerX,
      centerY: x.centerY,
      runX,
      runW,
      fontPx,
      clipX,
      fallbackClipX,
      leftOverlap: x.leftOverlap,
      thinSingleRule: x.thinSingleRule,
      compoundTopBottomRule: x.compoundTopBottomRule,
      notInnerLatinGlyph: x.notInnerLatinGlyph,
      leftCapCandidate: x.leftCapCandidate,
      thinHorizontalFragment: x.thinHorizontalFragment,
      acceptedCandidate: x.candidate,
      rejectReasons: x.candidate ? "ACCEPTED" : rejectReasons.join("; "),
      dPrefix: String(x.path?.d || x.path?.pathData || x.path?.svgPath || "").slice(0, 160)
    };
  });

  if (debug) {
    try {
      console.groupCollapsed("[sitelen-vector-cartouche-line-clip] candidate-scan", {
        runIndex,
        strictSource,
        strategy,
        clipStrategyRaw: clipStrategy,
        clipScaleRaw: clipScale,
        effectiveClipScale,
        runX,
        runW,
        fontPx,
        fallbackClipX,
        clipX,
        pathCount: input.length
      });
      console.table(diagnosticRows);
      console.groupEnd();
    } catch (e) {
      logCartoucheLineClip("candidate-scan-log-error", { runIndex, strictSource, message: e?.message || String(e) });
    }
  }

  let candidates = classified.filter(x => x.candidate);
  let selected = [];
  const effectiveLeftCapClipRatio = normalizeLiteralCartoucheLeftCapClipRatio(leftCapClipRatio);
  let leftCap = null;
  let leftCapClipX = null;
  let appliedClipX = clipX;

  if (strategy === "leftCap") {
    leftCap = detectLiteralCartoucheLeftCapFromClassified(classified, run);

    if (leftCap?.bounds) {
      const capW = leftCap.bounds.maxX - leftCap.bounds.minX;
      if (Number.isFinite(capW) && capW > 0) {
        leftCapClipX = leftCap.bounds.minX + capW * effectiveLeftCapClipRatio;
        clipX = leftCapClipX;
      }

      const haloInfo = getRunHalo(run);
      const haloAllowance = haloInfo.enabled ? Math.max(0.5, Number(haloInfo.widthPx || 0) * 0.35) : 0;
      appliedClipX = clipX - haloAllowance;

      const xTol = Math.max(1, fontPx * 0.02);
      const leftCapMinX = leftCap.bounds.minX;

      // For literal cartouches this repair function receives only the paths for
      // the current cartouche run. The leftCap strategy therefore clips every
      // non-left-cap path that enters the left-cap clip area. This avoids
      // assuming that the top/bottom overhangs are thin standalone fragments.
      candidates = classified.filter(x => {
        const b = x.bounds;
        if (!b) return false;
        if (x.index === leftCap.index) return false;
        return (
          b.minX < clipX + xTol &&
          b.maxX > leftCapMinX - xTol
        );
      });

      selected = candidates;
    } else {
      candidates = [];
      selected = [];
    }
  } else if (strategy === "thinRule") {
    if (candidates.length >= 2) {
      const top = candidates.slice().sort((a, b) => a.centerY - b.centerY)[0];
      const bottom = candidates.slice().sort((a, b) => b.centerY - a.centerY)[0];
      selected = [top, bottom].filter(Boolean);
      if (top?.index === bottom?.index) selected = [top];
    } else {
      selected = candidates;
    }
  } else {
    selected = candidates;
  }

  logCartoucheLineClip("detection", {
    runIndex,
    repairFlag,
    strictSource,
    shouldRepair,
    runX,
    runW,
    fontPx,
    clipScaleRaw: clipScale,
    effectiveClipScale,
    fallbackClipX,
    clipStrategyRaw: clipStrategy,
    strategy,
    clipX,
    appliedClipX,
    leftCapClipRatio: effectiveLeftCapClipRatio,
    leftCapClipX,
    leftCapBounds: leftCap?.bounds || null,
    leftCapIndex: Number.isFinite(Number(leftCap?.index)) ? leftCap.index : null,
    leftCapWidth: leftCap?.bounds ? (leftCap.bounds.maxX - leftCap.bounds.minX) : null,
    leftCapRightX: leftCap?.bounds ? leftCap.bounds.maxX : null,
    capDerivedClipX: leftCapClipX,
    leftCap: leftCap ? { index: leftCap.index, bounds: leftCap.bounds, w: leftCap.w, h: leftCap.h, centerY: leftCap.centerY } : null,
    pathCount: input.length,
    candidates: candidates.map(x => ({
      index: x.index,
      bounds: x.bounds,
      w: x.w,
      h: x.h,
      centerY: x.centerY,
      horizontalScore: x.horizontalScore,
      leftOverlap: x.leftOverlap,
      thinSingleRule: x.thinSingleRule,
      compoundTopBottomRule: x.compoundTopBottomRule,
      notInnerLatinGlyph: x.notInnerLatinGlyph,
      leftCapCandidate: x.leftCapCandidate,
      thinHorizontalFragment: x.thinHorizontalFragment,
      dPrefix: String(x.path?.d || x.path?.pathData || x.path?.svgPath || "").slice(0, 120)
    })),
    selected: selected.map(x => ({
      index: x.index,
      bounds: x.bounds,
      w: x.w,
      h: x.h,
      centerY: x.centerY
    })),
    allPaths: classified.map(x => ({
      index: x.index,
      bounds: x.bounds,
      w: x.w,
      h: x.h,
      centerY: x.centerY,
      horizontalScore: x.horizontalScore,
      leftOverlap: x.leftOverlap,
      thinSingleRule: x.thinSingleRule,
      compoundTopBottomRule: x.compoundTopBottomRule,
      notInnerLatinGlyph: x.notInnerLatinGlyph,
      leftCapCandidate: x.leftCapCandidate,
      thinHorizontalFragment: x.thinHorizontalFragment,
      candidate: x.candidate
    }))
  });

  if (!selected.length) {
    logCartoucheLineClip("no-selected-paths", {
      runIndex,
      repairFlag,
      strictSource,
      shouldRepair,
      runX,
      runW,
      fontPx,
      clipScaleRaw: clipScale,
      effectiveClipScale,
      fallbackClipX,
      clipStrategyRaw: clipStrategy,
      strategy,
      clipX,
      leftCapClipRatio: effectiveLeftCapClipRatio,
      leftCapClipX,
      leftCap: leftCap ? { index: leftCap.index, bounds: leftCap.bounds, w: leftCap.w, h: leftCap.h, centerY: leftCap.centerY } : null,
      pathCount: input.length,
      message: "Repair was requested, but no path satisfied the clipping predicate.",
      diagnosticRows
    });
    return input;
  }

  const selectedIndexes = new Set(selected.map(x => x.index));
  return input.map((p, index) => {
    if (!selectedIndexes.has(index)) return p;
    const item = classified[index];
    const b = item.bounds;
    if (!b) return p;

    const clipRect = {
      x: appliedClipX,
      y: b.minY - Math.max(2, fontPx * 0.08),
      w: Math.max(1, b.maxX - appliedClipX + Math.max(2, fontPx * 0.08)),
      h: Math.max(1, (b.maxY - b.minY) + Math.max(4, fontPx * 0.16))
    };

    logCartoucheLineClip("clip-values", {
runIndex,
  pathIndex: index,
  originalBounds: b,
  originalMinX: b.minX,
  originalMaxX: b.maxX,
  clipX,
  appliedClipX,
  leftCapClipRatio: effectiveLeftCapClipRatio,
  leftCapBounds: leftCap?.bounds || null,
  leftCapRightX: leftCap?.bounds ? leftCap.bounds.maxX : null,
  capDerivedClipX: leftCapClipX,
  clipRect,
  strategy,
  reason: "repairQuotedLatinLeftEdge top/bottom line overdraw"
    });

    return {
      ...p,
      clipRect,
      clipReason: `repairQuotedLatinLeftEdge-line-overdraw-${strategy}`,
      debugRunIndex: runIndex,
      debugOriginalBounds: b
    };
  });
}

function pathBoundsCenterX(path) {
  const b = path?.bounds || null;
  if (b && Number.isFinite(Number(b.minX)) && Number.isFinite(Number(b.maxX))) {
    return (Number(b.minX) + Number(b.maxX)) / 2;
  }

  const d = String(path?.d || path?.pathData || path?.svgPath || "");
  const nums = Array.from(d.matchAll(/-?\d+(?:\.\d+)?/g)).map(m => Number(m[0])).filter(Number.isFinite);
  const xs = [];
  for (let i = 0; i + 1 < nums.length; i += 2) xs.push(nums[i]);
  return xs.length ? (Math.min(...xs) + Math.max(...xs)) / 2 : NaN;
}

function pathBoundsWidth(path) {
  const b = path?.bounds || null;
  if (b && Number.isFinite(Number(b.minX)) && Number.isFinite(Number(b.maxX))) {
    return Math.max(0, Number(b.maxX) - Number(b.minX));
  }

  const d = String(path?.d || path?.pathData || path?.svgPath || "");
  const nums = Array.from(d.matchAll(/-?\d+(?:\.\d+)?/g)).map(m => Number(m[0])).filter(Number.isFinite);
  const xs = [];
  for (let i = 0; i + 1 < nums.length; i += 2) xs.push(nums[i]);
  return xs.length ? Math.max(0, Math.max(...xs) - Math.min(...xs)) : 0;
}

function isCartoucheControlLikeCp(cp) {
  const n = Number(cp);
  return n === CARTOUCHE_START_CP ||
    n === CARTOUCHE_END_CP ||
    n === CARTOUCHE_TALLY_CP ||
    n === 0x002C ||
    n === 0x200D ||
    n === 0xF1992 ||
    n === 0xF1995 ||
    n === 0xF1996;
}

function estimateInnerGlyphCenters(run, innerCps, manualTallies, vectorResult = null) {
  const tallies = Array.isArray(manualTallies) ? manualTallies : [];
  const tallySlotCount = tallies.length || 0;

  // manualTallies already comes from the renderer's normalized cartouche data,
  // so its indexes are the authoritative "glyph this tally belongs to" indexes.
  const logicalInner = Array.from(innerCps || []).filter(cp => !isCartoucheControlLikeCp(cp));
  const count = Math.max(1, tallySlotCount || logicalInner.length);

  const runX = getRunX(run);
  const baseline = getRunBaseline(run);
  const fontPx = getRunFontPx(run, 56);
  const runWidth = Math.max(Number(run?.widthPx || 0), fontPx * (count + 2));

  // Preferred path: use visible outline path centers. This is more reliable than
  // advance data for cartouches because GSUB/extension glyphs can distort advances.
  const resultPaths = Array.isArray(vectorResult?.paths) ? vectorResult.paths : [];
  const visibleCenters = [];
  const minVisibleW = Math.max(1, fontPx * 0.08);

  for (const p of resultPaths) {
    const w = pathBoundsWidth(p);
    const cx = pathBoundsCenterX(p);
    if (!Number.isFinite(cx) || w < minVisibleW) continue;
    visibleCenters.push(cx);
  }

  let centersFromPaths = [];
  if (visibleCenters.length >= count + 2) {
    const sorted = visibleCenters.slice().sort((a, b) => a - b);
    const inner = sorted.slice(1, -1);
    if (inner.length >= count) {
      if (inner.length === count) {
        centersFromPaths = inner;
      } else {
        for (let i = 0; i < count; i++) {
          const idx = Math.round(i * (inner.length - 1) / Math.max(1, count - 1));
          centersFromPaths.push(inner[Math.max(0, Math.min(inner.length - 1, idx))]);
        }
      }
    }
  }

  if (centersFromPaths.length === count && centersFromPaths.every(Number.isFinite)) {
    return { centers: centersFromPaths, baseline, fontPx, runWidth, source: "outline-bounds" };
  }

  // Secondary path: use shaped glyph positions if present.
  const glyphs = Array.isArray(vectorResult?.glyphs) ? vectorResult.glyphs : [];
  const shapedCenters = [];
  if (glyphs.length >= count + 2) {
    for (let i = 0; i < count; i++) {
      const g = glyphs[i + 1];
      const gx = Number(g?.xPx ?? g?.x ?? g?.xMin ?? NaN);
      const adv = Number(g?.advancePx ?? g?.advance ?? g?.widthPx ?? g?.w ?? NaN);
      if (Number.isFinite(gx)) shapedCenters.push(gx + (Number.isFinite(adv) && adv > 0 ? adv / 2 : fontPx * 0.5));
    }
  }
  if (shapedCenters.length === count && shapedCenters.every(Number.isFinite)) {
    return { centers: shapedCenters, baseline, fontPx, runWidth, source: "wasm-glyphs" };
  }

  // Fallback: count is based on manualTallies length, not raw inner cps length,
  // so extension/control codepoints do not push tally slots too far right.
  const sidePad = Math.max(fontPx * 0.72, runWidth * 0.105);
  const left = runX + sidePad;
  const right = runX + runWidth - sidePad;
  const step = count <= 1 ? 0 : Math.max(1, (right - left) / (count - 1));
  const centers = [];
  for (let i = 0; i < count; i++) centers.push(left + step * i);
  return { centers, baseline, fontPx, runWidth, source: "manual-slot-width" };
}

function buildManualTallyVectorPathsForRun(run, rawInnerCps, manualTallies, { fill = "#111111", halo = null, vectorResult = null } = {}) {
  const tallies = Array.isArray(manualTallies)
    ? manualTallies.map(n => Math.max(0, Math.min(8, Math.round(Number(n) || 0))))
    : [];
  if (!tallies.some(n => n > 0)) return [];

  const placement = estimateInnerGlyphCenters(run, rawInnerCps, tallies, vectorResult);
  const { centers, baseline, fontPx } = placement;

  // Keep a stronger stroke, but make the marks a little shorter than v108.
  const strokeW = Math.max(1.4, fontPx * 0.052);
  const markGap = Math.max(1.8, fontPx * 0.055);
  //const tallyH = Math.max(4, fontPx * 0.18);

  // Vertical position from v108 was close; keep the lowered start.
  //const topY = baseline + Math.max(3, fontPx * 0.12);

  const isTinyFontPx = fontPx <= 12;
  const tallyHMinPx = isTinyFontPx ? Math.max(2, fontPx * 0.20) : 4;
  const tallyTopMinPx = isTinyFontPx ? Math.max(1, fontPx * 0.08) : 3;

  const tallyH = Math.max(tallyHMinPx, fontPx * 0.18);
  const topY = baseline + Math.max(tallyTopMinPx, fontPx * 0.12);

  const radius = Math.max(0.75, Math.min(20.0, fontPx * 0.014));
  const out = [];

  for (let i = 0; i < centers.length; i++) {
    const n = tallies[i] || 0;
    if (n <= 0) continue;

    const totalW = n * strokeW + Math.max(0, n - 1) * markGap;
    const startX = centers[i] - totalW / 2;

    if (halo?.enabled && Number(halo.widthPx) > 0) {
      const padX = Math.max(1, Number(halo.widthPx) * 0.50);
      const padY = Math.max(1, Number(halo.widthPx) * 0.45);
      out.push(makeSyntheticPathFromD(
        buildSvgRectPath(startX - padX, topY - padY, totalW + padX * 2, tallyH + padY * 2, radius),
        { fill: normalizeHex(halo.color, "#FFFFFF"), halo: null, source: "manual-tally-halo-bg" }
      ));
    }

    for (let k = 0; k < n; k++) {
      const x = startX + k * (strokeW + markGap);
      out.push(makeSyntheticPathFromD(
        buildSvgRectPath(x, topY, strokeW, tallyH, Math.min(radius, strokeW / 2)),
        { fill, halo: null, source: "manual-tally" }
      ));
    }
  }

  return out;
}


function prepareCartouchePayloadForVector(run, payload, exporter = null) {
  if (!isCartoucheRun(run)) return payload;

  let inner = Array.isArray(payload?.cps) && payload.cps.length
    ? payload.cps.slice()
    : Array.from(String(payload?.text || "")).map(ch => ch.codePointAt(0)).filter(Number.isFinite);

  if (!inner.length) return payload;
  if (inner[0] === CARTOUCHE_START_CP && inner[inner.length - 1] === CARTOUCHE_END_CP) inner = inner.slice(1, -1);

  inner = replaceKolonWithKasiForDateTime(run, inner);

  if (!isManualTallyModeForRun(run, exporter)) {
    inner = mergeManualTalliesIntoCartoucheCps(inner, getManualTalliesForRun(run));
  }

  return { text: "", cps: [CARTOUCHE_START_CP, ...inner, CARTOUCHE_END_CP], rawInnerCpsForManualTallies: inner };
}

function svgDToPdfCommands(d) {
  const s = String(d || "").trim();
  if (!s) return [];
  const tokens = Array.from(s.matchAll(/[MLQCZ]|-?\d+(?:\.\d+)?/g)).map(m => m[0]);
  const out = [];
  let i = 0, cmd = null;
  function take() {
    const n = Number(tokens[i++]);
    return Number.isFinite(n) ? n : null;
  }
  while (i < tokens.length) {
    if (/^[MLQCZ]$/.test(tokens[i])) cmd = tokens[i++];
    if (!cmd) break;
    if (cmd === "M") {
      const x = take(), y = take(); if (x == null || y == null) break;
      out.push({ cmd: "M", x, y }); cmd = "L";
    } else if (cmd === "L") {
      const x = take(), y = take(); if (x == null || y == null) break;
      out.push({ cmd: "L", x, y });
    } else if (cmd === "Q") {
      const x1 = take(), y1 = take(), x = take(), y = take(); if ([x1, y1, x, y].some(v => v == null)) break;
      out.push({ cmd: "Q", x1, y1, x, y });
    } else if (cmd === "C") {
      const x1 = take(), y1 = take(), x2 = take(), y2 = take(), x = take(), y = take(); if ([x1, y1, x2, y2, x, y].some(v => v == null)) break;
      out.push({ cmd: "C", x1, y1, x2, y2, x, y });
    } else if (cmd === "Z") {
      out.push({ cmd: "Z" }); cmd = null;
    } else break;
  }
  return out;
}

function mergeManualTalliesIntoCartoucheCps(innerCps, manualTallies) {
  const cps = Array.from(innerCps || []);
  const tallies = Array.isArray(manualTallies) ? manualTallies : null;
  if (!tallies || !tallies.some(n => Number(n) > 0)) return cps;

  const out = [];
  let glyphIndex = 0;
  for (const cp of cps) {
    out.push(cp);
    if (Number(cp) === CARTOUCHE_TALLY_CP || Number(cp) === 0x002C) {
      continue;
    }
    const n = Math.max(0, Math.min(8, Math.round(Number(tallies[glyphIndex] || 0))));
    for (let i = 0; i < n; i++) out.push(CARTOUCHE_TALLY_CP);
    glyphIndex += 1;
  }
  return out;
}

function wrapCartouchePayloadIfNeeded(run, payload) {
  if (!isCartoucheRun(run)) return payload;
  let inner = Array.isArray(payload?.cps) && payload.cps.length
    ? payload.cps.slice()
    : Array.from(String(payload?.text || "")).map(ch => ch.codePointAt(0)).filter(Number.isFinite);
  if (!inner.length) return payload;

  if (inner[0] === CARTOUCHE_START_CP && inner[inner.length - 1] === CARTOUCHE_END_CP) {
    inner = inner.slice(1, -1);
  }

  inner = replaceKolonWithKasiForDateTime(run, inner);
  inner = mergeManualTalliesIntoCartoucheCps(inner, getManualTalliesForRun(run));

  return { text: "", cps: [CARTOUCHE_START_CP, ...inner, CARTOUCHE_END_CP] };
}


function isCornerBracketExportRun(run) {
  const payload = runTextOrCps(run);
  const cps = Array.isArray(payload.cps) && payload.cps.length
    ? payload.cps
    : Array.from(String(payload.text || "")).map(ch => ch.codePointAt(0)).filter(Number.isFinite);
  return cps.length === 1 &&
    (Number(cps[0]) === LEFT_CORNER_BRACKET_CP || Number(cps[0]) === RIGHT_CORNER_BRACKET_CP);
}

function cornerBracketPayload(run) {
  const payload = runTextOrCps(run);
  const cps = Array.isArray(payload.cps) && payload.cps.length
    ? payload.cps
    : Array.from(String(payload.text || "")).map(ch => ch.codePointAt(0)).filter(Number.isFinite);
  return { text: "", cps: cps.length ? [Number(cps[0])] : [] };
}


function cornerBracketCodepoint(run) {
  const payload = cornerBracketPayload(run);
  const cp = Number(payload?.cps?.[0]);
  return Number.isFinite(cp) ? cp : null;
}

function describeRunForDebug(run) {
  const raw = runTextOrCps(run);
  return {
    id: run?.id,
    kind: run?.kind,
    renderMode: run?.renderMode,
    sourceKind: run?.sourceKind,
    fontRole: run?.fontRole,
    fontFamily: run?.fontFamily,
    encodedText: run?.encodedText,
    sourceText: run?.sourceText,
    elementType: run?._element?.type,
    elementSourceText: run?._element?.sourceText,
    elementRepairQuotedLatinLeftEdge: run?._element?.repairQuotedLatinLeftEdge,
    repairQuotedLatinLeftEdge: run?.repairQuotedLatinLeftEdge,
    cps: Array.isArray(raw.cps) ? raw.cps.map(cp => `U+${Number(cp).toString(16).toUpperCase().padStart(4, "0")}`) : [],
    textCodepoints: raw.text ? Array.from(raw.text).map(ch => `U+${ch.codePointAt(0).toString(16).toUpperCase().padStart(4, "0")}`) : [],
    xPx: run?.xPx,
    drawXPx: run?.drawXPx,
    baselineYPx: run?.baselineYPx,
    widthPx: run?.widthPx,
    heightPx: run?.heightPx,
    fontPx: run?.fontPx
  };
}

function debugPathSummary(paths, limit = 12) {
  return asArray(paths).slice(0, limit).map((p, index) => {
    const b = vectorPathBounds(p) || p?.bounds || null;
    return {
      index,
      keys: Object.keys(p || {}),
      hasD: !!String(p?.d || p?.pathData || p?.svgPath || "").trim(),
      commandCount: asArray(p?.commands || p?.cmds || p?.pathCommands).length,
      bounds: b,
      dPrefix: String(p?.d || p?.pathData || p?.svgPath || "").slice(0, 120)
    };
  });
}

function debugBracketExportStage(enabled, stage, data) {
  return;
}

function debugLiteralRepairStage(enabled, stage, data) {
  return;
}

function logCartoucheLineClip(stage, data) {
  try {
    console.log(`[sitelen-vector-cartouche-line-clip] ${stage}`, data);
  } catch {}
}




function transformCommand2d(c, sx, sy, dx, dy) {
  if (!c || !c.cmd) return c;
  const tx = x => x * sx + dx;
  const ty = y => y * sy + dy;
  if (c.cmd === "M") return { ...c, x: tx(c.x), y: ty(c.y) };
  if (c.cmd === "L") return { ...c, x: tx(c.x), y: ty(c.y) };
  if (c.cmd === "Q") return { ...c, x1: tx(c.x1), y1: ty(c.y1), x: tx(c.x), y: ty(c.y) };
  if (c.cmd === "C") return { ...c, x1: tx(c.x1), y1: ty(c.y1), x2: tx(c.x2), y2: ty(c.y2), x: tx(c.x), y: ty(c.y) };
  return { ...c };
}

function transformPathObject2d(path, sx, sy, dx, dy) {
  const commands = asArray(path?.commands || path?.cmds || path?.pathCommands);
  if (!commands.length) return path;

  const nextCommands = commands.map(c => transformCommand2d(c, sx, sy, dx, dy));
  const d = commandsToSvgD(nextCommands);
  const b = vectorPathBounds({ commands: nextCommands, d });
  return {
    ...path,
    commands: nextCommands,
    d,
    bounds: b || path.bounds || null,
    transformReason: "literal-corner-bracket-fit"
  };
}

function fitCornerBracketPathsToReservedRunBox(run, resultPaths, { debug = false, runIndex = null } = {}) {
  const paths = asArray(resultPaths);
  if (!isCornerBracketExportRun(run)) return paths;
  debugBracketExportStage(debug, "fit input", {
    runIndex,
    run: describeRunForDebug(run),
    inputPathCount: paths.length,
    inputPaths: debugPathSummary(paths)
  });
  if (!paths.length) {
    debugBracketExportStage(debug, "fit skipped: no paths returned from WASM", { runIndex, run: describeRunForDebug(run) });
    return paths;
  }

  const fontPx = getRunFontPx(run, 56);
  const runX = Number(run?.xPx ?? run?.drawXPx ?? getRunX(run) ?? 0);
  const runW = Math.max(1, Number(run?.widthPx || fontPx * 0.45));
  const baseline = getRunBaseline(run);
  const targetPadX = Math.max(0.5, fontPx * 0.015);
  const targetLeft = runX + targetPadX;
  const targetRight = runX + runW - targetPadX;
  const targetW = Math.max(1, targetRight - targetLeft);

  const all = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  for (const p of paths) includeBounds(all, vectorPathBounds(p) || p.bounds);
  if (!finiteBounds(all)) return paths;

  const actualW = Math.max(1, all.maxX - all.minX);
  // Only shrink horizontally. Do not expand, because expansion can cause overlap.
  const sx = Math.min(1, targetW / actualW);
  const desiredLeft = targetLeft + Math.max(0, (targetW - actualW * sx) / 2);
  const dx = desiredLeft - all.minX * sx;

  // Keep vertical font placement; only scale X and translate X.
  const sy = 1;
  const dy = 0;

  const fitted = paths.map(p => transformPathObject2d(p, sx, sy, dx, dy));

  if (debug) {
    safeConsole("log", "[sitelen-vector-exporter] literal-font corner bracket fit", {
      runIndex,
      runX,
      runW,
      fontPx,
      actualW,
      targetW,
      sx,
      dx,
      baseline,
      payload: cornerBracketPayload(run)
    });
  }

  debugBracketExportStage(debug, "fit output", {
    runIndex,
    outputPathCount: fitted.length,
    outputPaths: debugPathSummary(fitted),
    allBoundsBefore: all
  });

  return fitted;
}


function findFaceInPreset(preset, family) {
  const fam = String(family || "").trim();
  if (!fam) return null;
  for (const face of asArray(preset?.faces)) {
    if (String(face?.family || "").trim() === fam) return face;
  }
  return null;
}

async function fetchFaceBytes(face) {
  if (!face?.url) return null;
  const res = await fetch(face.url, { cache: "force-cache" });
  if (!res.ok) throw new Error(`Failed to fetch font ${face.url}: ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}

function flattenRuns(plan) {
  const out = [];
  for (const line of asArray(plan?.lines)) {
    for (const run of asArray(line?.runs)) {
      if (isDrawableRun(run)) out.push(run);
    }
  }
  return out;
}

function includeBounds(target, bounds) {
  if (!bounds) return;
  if (!Number.isFinite(bounds.minX) || !Number.isFinite(bounds.minY) || !Number.isFinite(bounds.maxX) || !Number.isFinite(bounds.maxY)) return;
  target.minX = Math.min(target.minX, bounds.minX);
  target.minY = Math.min(target.minY, bounds.minY);
  target.maxX = Math.max(target.maxX, bounds.maxX);
  target.maxY = Math.max(target.maxY, bounds.maxY);
}

function finiteBounds(bounds) {
  return Number.isFinite(bounds.minX) && Number.isFinite(bounds.minY) && Number.isFinite(bounds.maxX) && Number.isFinite(bounds.maxY);
}

function getPathD(path) {
  if (!path) return "";

  // Rust currently returns both `d` and `commands`, but be defensive because
  // serde/wasm interop mistakes can leave `d` empty while commands are present.
  const direct = String(path.d || path.pathData || path.svgPath || "").trim();
  if (direct) return direct;

  const commands = asArray(path.commands || path.cmds || path.pathCommands);
  if (commands.length) return commandsToSvgD(commands).trim();

  return "";
}

function svgFromVectorDocument(doc) {
  // v120: suppress noisy SVG serializer logs.
  const pad = Math.max(0, Number(doc.paddingPx ?? 0));
  const width = Math.max(1, Math.ceil(doc.widthPx || 1));
  const height = Math.max(1, Math.ceil(doc.heightPx || 1));
  const viewBoxX = Number.isFinite(Number(doc.viewBoxX)) ? Number(doc.viewBoxX) : 0;
  const viewBoxY = Number.isFinite(Number(doc.viewBoxY)) ? Number(doc.viewBoxY) : 0;
  const haloBody = [];
  const fillBody = [];
  const strokeBody = [];
  const defs = [];
  const inputPaths = asArray(doc.paths || doc.vectorPaths || doc.glyphPaths);
  let skippedNoD = 0;
  let clipCounter = 0;

  function clipAttrFor(path) {
    const r = path?.clipRect || null;
    if (!r) return "";
    const id = `clip_${++clipCounter}`;
    const x = Number(r.x) || 0;
    const y = Number(r.y) || 0;
    const w = Math.max(0, Number(r.w) || 0);
    const h = Math.max(0, Number(r.h) || 0);
    if (w <= 0 || h <= 0) return "";
    defs.push(`<clipPath id="${id}"><rect x="${num(x)}" y="${num(y)}" width="${num(w)}" height="${num(h)}"/></clipPath>`);
    return ` clip-path="url(#${id})"`;
  }

  function debugAttrsFor(path) {
    return "";
  }

  for (const path of inputPaths) {
    const d = getPathD(path);
    if (!d) {
      skippedNoD += 1;
      continue;
    }
    const fill = path.fill === "none" ? "none" : normalizeHex(path.fill || doc.fill || "#111111");
    const halo = path.halo || null;
    const clipAttr = clipAttrFor(path);
    const debugAttrs = debugAttrsFor(path);
    if (path.stroke) {
      strokeBody.push(`<path d="${escapeXml(d)}"${clipAttr}${debugAttrs} fill="${escapeXml(fill)}" stroke="${escapeXml(normalizeHex(path.stroke, "#111111"))}" stroke-width="${Number(path.strokeWidth || 1)}" stroke-linejoin="${escapeXml(path.linejoin || "round")}" stroke-linecap="${escapeXml(path.linecap || "round")}"/>`);
      continue;
    }
    if (halo?.enabled && Number(halo.widthPx) > 0) {
      haloBody.push(`<path d="${escapeXml(d)}"${clipAttr}${debugAttrs} fill="none" stroke="${escapeXml(normalizeHex(halo.color, "#FFFFFF"))}" stroke-width="${Number(halo.widthPx)}" stroke-linejoin="round" stroke-linecap="round"/>`);
    }
    fillBody.push(`<path d="${escapeXml(d)}"${clipAttr}${debugAttrs} fill="${escapeXml(fill)}"/>`);
  }

  const body = haloBody.concat(fillBody, strokeBody);

  if (inputPaths.length > 0 && body.length === 0) {
    console.error("[sitelen-vector-exporter] SVG serialization wrote zero <path> elements", {
      inputPathCount: inputPaths.length,
      skippedNoD,
      firstPath: inputPaths[0],
      firstPathKeys: Object.keys(inputPaths[0] || {})
    });
    throw new Error(`SVG serialization failed: ${inputPaths.length} vector paths were produced but none had usable path data.`);
  }

  // v120: suppress noisy SVG serialization logs.

  return `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${num(viewBoxX)} ${num(viewBoxY)} ${width} ${height}" data-padding-px="${pad}">\n` +
    (defs.length ? `  <defs>\n${defs.map(s => `    ${s}`).join("\n")}\n  </defs>\n` : "") +
    body.map(s => `  ${s}`).join("\n") +
    `\n</svg>\n`;
}

function pdfEscape(text) {
  return String(text).replace(/[\\()]/g, "\\$&");
}

function num(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "0";
  const r = Math.round(x * 1000) / 1000;
  return String(r).replace(/\.0+$/g, "").replace(/(\.\d*?)0+$/g, "$1").replace(/\.$/, "");
}

function pdfPathCommands(commands, pageHeightPx, viewBoxX = 0, viewBoxY = 0) {
  const parts = [];
  let cur = null;
  let contourStart = null;
  const px = (x) => (x - viewBoxX) * PX_TO_PT;
  const py = (y) => (pageHeightPx - (y - viewBoxY)) * PX_TO_PT;

  function normalizeCommand(c) {
    if (!c || typeof c !== "object") return null;

    let cmd = c.cmd ?? c.command ?? c.type;
    let src = c;

    // Be defensive about serde/wasm enum shapes. Some builds can expose
    // commands as { M: { x, y } } instead of { cmd: "M", x, y }.
    if (!cmd) {
      for (const k of ["M", "L", "Q", "C", "Z", "m", "l", "q", "c", "z"]) {
        if (c[k] && typeof c[k] === "object") {
          cmd = k;
          src = c[k];
          break;
        }
        if (c[k] === null || c[k] === true) {
          cmd = k;
          break;
        }
      }
    }

    cmd = String(cmd || "").toUpperCase();
    if (!["M", "L", "Q", "C", "Z"].includes(cmd)) return null;
    return { ...src, cmd };
  }

  for (const raw of asArray(commands)) {
    const c = normalizeCommand(raw);
    if (!c) continue;
    if (c.cmd === "M") {
      parts.push(`${num(px(c.x))} ${num(py(c.y))} m`);
      cur = { x: c.x, y: c.y };
      contourStart = { ...cur };
    }
    else if (c.cmd === "L") {
      parts.push(`${num(px(c.x))} ${num(py(c.y))} l`);
      cur = { x: c.x, y: c.y };
    }
    else if (c.cmd === "Q") {
      // PDF has cubic Beziers, not quadratic Beziers.
      // Convert Q(cur, q1, end) to cubic controls.
      if (!cur) {
        parts.push(`${num(px(c.x))} ${num(py(c.y))} l`);
      } else {
        const c1x = cur.x + (2 / 3) * (c.x1 - cur.x);
        const c1y = cur.y + (2 / 3) * (c.y1 - cur.y);
        const c2x = c.x + (2 / 3) * (c.x1 - c.x);
        const c2y = c.y + (2 / 3) * (c.y1 - c.y);
        parts.push(`${num(px(c1x))} ${num(py(c1y))} ${num(px(c2x))} ${num(py(c2y))} ${num(px(c.x))} ${num(py(c.y))} c`);
      }
      cur = { x: c.x, y: c.y };
    }
    else if (c.cmd === "C") {
      parts.push(`${num(px(c.x1))} ${num(py(c.y1))} ${num(px(c.x2))} ${num(py(c.y2))} ${num(px(c.x))} ${num(py(c.y))} c`);
      cur = { x: c.x, y: c.y };
    }
    else if (c.cmd === "Z") {
      parts.push("h");
      if (contourStart) cur = { ...contourStart };
    }
  }
  return parts.join("\n");
}

function pdfClipRectCommands(rect, pageHeightPx, viewBoxX = 0, viewBoxY = 0) {
  if (!rect) return "";
  const x = Number(rect.x);
  const y = Number(rect.y);
  const w = Number(rect.w);
  const h = Number(rect.h);
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return "";

  const pdfX = (x - viewBoxX) * PX_TO_PT;
  const pdfY = (pageHeightPx - ((y - viewBoxY) + h)) * PX_TO_PT;
  const pdfW = w * PX_TO_PT;
  const pdfH = h * PX_TO_PT;
  return `${num(pdfX)} ${num(pdfY)} ${num(pdfW)} ${num(pdfH)} re
W
n`;
}

function pdfFromVectorDocument(doc) {
  const viewBoxX = Number.isFinite(Number(doc.viewBoxX)) ? Number(doc.viewBoxX) : 0;
  const viewBoxY = Number.isFinite(Number(doc.viewBoxY)) ? Number(doc.viewBoxY) : 0;
  const widthPt = Math.max(1, (doc.widthPx || 1) * PX_TO_PT);
  const heightPt = Math.max(1, (doc.heightPx || 1) * PX_TO_PT);
  const streamParts = [];

  for (const path of asArray(doc.paths || doc.vectorPaths || doc.glyphPaths)) {
    // Manual tally halo backgrounds are only needed for halo preview/SVG layering.
    // Keep PDF exports ink-only by omitting these synthetic halo-fill rectangles.
    if (path?.source === "manual-tally-halo-bg") continue;

    const pathCommands = asArray(path?.commands || path?.cmds || path?.pathCommands);
    const dCommands = svgDToPdfCommands(path?.d || path?.pathData || path?.svgPath || "");
    const pdfCommands = pathCommands.length ? pathCommands : dCommands;
    if (!pdfCommands.length) continue;
    const pdfPath = pdfPathCommands(pdfCommands, doc.heightPx, viewBoxX, viewBoxY) ||
      (dCommands.length ? pdfPathCommands(dCommands, doc.heightPx, viewBoxX, viewBoxY) : "");
    if (!pdfPath) continue;
    const pdfClip = pdfClipRectCommands(path.clipRect, doc.heightPx, viewBoxX, viewBoxY);
    if (path.stroke) {
      const col = hexToPdfRgb(normalizeHex(path.stroke, "#111111"));
      streamParts.push("q");
      if (pdfClip) streamParts.push(pdfClip);
      streamParts.push(`${col} RG`);
      streamParts.push(`${num(Number(path.strokeWidth || 1) * PX_TO_PT)} w`);
      streamParts.push("1 j 1 J");
      streamParts.push(pdfPath);
      streamParts.push("S");
      streamParts.push("Q");
      continue;
    }

    // PDF output is intentionally ink-only: do not emit halo strokes, even when
    // the exported vector document was built with halo enabled.
    const fill = hexToPdfRgb(normalizeHex(path.fill || doc.fill || "#111111"));
    streamParts.push("q");
    if (pdfClip) streamParts.push(pdfClip);
    streamParts.push(`${fill} rg`);
    streamParts.push(pdfPath);
    streamParts.push("f");
    streamParts.push("Q");
  }

  const stream = streamParts.join("\n") + "\n";
  const objects = [];
  objects.push(`1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`);
  objects.push(`2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n`);
  objects.push(`3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${num(widthPt)} ${num(heightPt)}] /Contents 4 0 R >>\nendobj\n`);
  objects.push(`4 0 obj\n<< /Length ${new TextEncoder().encode(stream).length} >>\nstream\n${stream}endstream\nendobj\n`);

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (const obj of objects) {
    offsets.push(new TextEncoder().encode(pdf).length);
    pdf += obj;
  }
  const xrefOffset = new TextEncoder().encode(pdf).length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let i = 1; i <= objects.length; i++) pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return new Blob([pdf], { type: "application/pdf" });
}

function hexToPdfRgb(hex) {
  const s = normalizeHex(hex).slice(1);
  const r = parseInt(s.slice(0, 2), 16) / 255;
  const g = parseInt(s.slice(2, 4), 16) / 255;
  const b = parseInt(s.slice(4, 6), 16) / 255;
  return `${num(r)} ${num(g)} ${num(b)}`;
}

export class SitelenVectorExporter {
  static async create(options = {}) {
    const ex = new SitelenVectorExporter(options);
    await ex.ready;
    return ex;
  }

  constructor({ renderer, fontController, wasmModuleUrl = DEFAULT_WASM_MODULE_URL, onStatus = null, debug = false, debugWasm = false, ...options } = {}) {
    if (!renderer) throw new Error("SitelenVectorExporter requires renderer.");
    this.renderer = renderer;
    this.fontController = fontController || null;
    this.wasmModuleUrl = wasmModuleUrl;
    this.onStatus = onStatus;
    this.options = { ...options };
    const explicitLiteralCartoucheRuleClipScale =
      options.literalCartoucheRuleClipScale ??
      options.quotedLiteralCartoucheRuleClipScale ??
      options.literalCartoucheClipScale ??
      options.cartoucheRuleClipScale;
    this.literalCartoucheRuleClipScale =
      Number.isFinite(Number(explicitLiteralCartoucheRuleClipScale)) && Number(explicitLiteralCartoucheRuleClipScale) > 0
        ? normalizeLiteralCartoucheRuleClipScale(explicitLiteralCartoucheRuleClipScale)
        : null;

    const explicitLiteralCartoucheRuleClipStrategy =
      options.literalCartoucheRuleClipStrategy ??
      options.quotedLiteralCartoucheRuleClipStrategy ??
      options.literalCartoucheClipStrategy ??
      options.cartoucheRuleClipStrategy;
    this.literalCartoucheRuleClipStrategy =
      String(explicitLiteralCartoucheRuleClipStrategy ?? "").trim()
        ? normalizeLiteralCartoucheRuleClipStrategy(explicitLiteralCartoucheRuleClipStrategy)
        : null;

    const explicitLiteralCartoucheLeftCapClipRatio =
      options.literalCartoucheLeftCapClipRatio ??
      options.quotedLiteralCartoucheLeftCapClipRatio ??
      options.literalCartoucheCapClipRatio ??
      options.cartoucheLeftCapClipRatio;
    this.literalCartoucheLeftCapClipRatio =
      Number.isFinite(Number(explicitLiteralCartoucheLeftCapClipRatio)) && Number(explicitLiteralCartoucheLeftCapClipRatio) > 0
        ? normalizeLiteralCartoucheLeftCapClipRatio(explicitLiteralCartoucheLeftCapClipRatio)
        : null;
    this.fontByteCache = new Map();
    this.debug = !!(debug || debugWasm);
    this.debugWasm = this.debug;
    this.ready = this.#loadWasm();
  }

  status(message) {
    if (typeof this.onStatus === "function") this.onStatus(String(message || ""));
  }

  setDebug(enabled) {
    this.debug = !!enabled;
    this.debugWasm = this.debug;
    this.log("debug flag changed", { enabled: this.debug });
    return this.debug;
  }

  setDebugWasm(enabled) {
    return this.setDebug(enabled);
  }

  getActiveLiteralCartoucheRuleClipScale() {
    return getLiteralCartoucheRuleClipScaleForRun(null, this);
  }

  async setActiveLiteralCartoucheRuleClipScale(value, { persist = true } = {}) {
    const scale = normalizeLiteralCartoucheRuleClipScale(value);
    this.literalCartoucheRuleClipScale = scale;
    this.options.literalCartoucheRuleClipScale = scale;
    if (persist) await this.#persistActiveFontVectorSetting("literalCartoucheRuleClipScale", scale);
    return scale;
  }

  getActiveLiteralCartoucheRuleClipStrategy() {
    return getLiteralCartoucheRuleClipStrategyForRun(null, this);
  }

  async setActiveLiteralCartoucheRuleClipStrategy(value, { persist = true } = {}) {
    const strategy = normalizeLiteralCartoucheRuleClipStrategy(value);
    this.literalCartoucheRuleClipStrategy = strategy;
    this.options.literalCartoucheRuleClipStrategy = strategy;
    if (persist) await this.#persistActiveFontVectorSetting("literalCartoucheRuleClipStrategy", strategy);
    return strategy;
  }

  getActiveLiteralCartoucheLeftCapClipRatio() {
    return getLiteralCartoucheLeftCapClipRatioForRun(null, this);
  }

  async setActiveLiteralCartoucheLeftCapClipRatio(value, { persist = true } = {}) {
    const ratio = normalizeLiteralCartoucheLeftCapClipRatio(value);
    this.literalCartoucheLeftCapClipRatio = ratio;
    this.options.literalCartoucheLeftCapClipRatio = ratio;
    if (persist) await this.#persistActiveFontVectorSetting("literalCartoucheLeftCapClipRatio", ratio);
    return ratio;
  }

  async #persistActiveFontVectorSetting(key, value) {
    const fc = this.fontController;
    if (!fc) return false;

    for (const name of [
      "setActiveFontPairSetting",
      "setActivePairSetting",
      "updateActiveFontPairSetting",
      "updateActivePairSetting",
      "saveActiveFontPairSetting",
      "saveActivePairSetting"
    ]) {
      try {
        if (typeof fc[name] === "function") {
          await fc[name](key, value);
          return true;
        }
      } catch {}
    }

    for (const name of [
      "updateActiveFontPairSettings",
      "updateActivePairSettings",
      "saveActiveFontPairSettings",
      "saveActivePairSettings",
      "setActiveFontPairSettings",
      "setActivePairSettings"
    ]) {
      try {
        if (typeof fc[name] === "function") {
          await fc[name]({ [key]: value });
          return true;
        }
      } catch {}
    }

    const targets = [];
    try {
      const preset = fc.getActivePreset?.();
      if (preset) targets.push(preset, preset.__pairRecord);
    } catch {}
    for (const name of ["getActivePresetRecord", "getActiveRecord", "getSelectedPairRecord", "getSelectedRecord", "getActivePairRecord", "getCurrentRecord", "getCurrentPreset"]) {
      try {
        const obj = typeof fc[name] === "function" ? fc[name]() : null;
        if (obj) targets.push(obj, obj.pairRecord);
      } catch {}
    }
    let changed = false;
    for (const obj of targets) {
      if (!obj || typeof obj !== "object") continue;
      if (!obj.settings || typeof obj.settings !== "object") obj.settings = {};
      obj.settings[key] = value;
      changed = true;
    }
    return changed;
  }

  log(message, data = undefined) {
    // v120: suppress noisy exporter debug logs. Use targeted cartouche-line logs only.
    return;
  }

  warn(message, data = undefined) {
    // v120: suppress noisy exporter warnings in the console; warnings are still collected.
    return;
  }

  async #loadWasm() {
    this.status("Loading vector WASM…");
    const modUrl = this.wasmModuleUrl instanceof URL ? this.wasmModuleUrl.href : String(this.wasmModuleUrl);
    this.log("loading WASM module", { modUrl });
    const mod = await import(modUrl);
    if (typeof mod.default === "function") await mod.default();
    const vectorizeRun = mod.vectorize_run || mod.vectorizeRun;
    if (typeof vectorizeRun !== "function") throw new Error("Vector WASM does not expose vectorize_run().");
    this.wasm = { ...mod, vectorizeRun };
    this.log("WASM module loaded", { exports: Object.keys(mod || {}) });
    this.status("Vector WASM loaded.");
    return this;
  }

  async buildPlan({ input, config = {} }) {
    return await this.renderer.buildRenderPlan({ input, ...config });
  }

  async exportTextToVectorDocument({ input, config = {}, paddingPx = 18, fallbackWidthPx = null, fallbackHeightPx = null } = {}) {
    await this.ready;
    const plan = await this.buildPlan({ input, config });
    return await this.exportPlanToVectorDocument({ plan, paddingPx, fallbackWidthPx, fallbackHeightPx });
  }

  async exportPlanToVectorDocument({ plan, paddingPx = 18, fallbackWidthPx = null, fallbackHeightPx = null, debugWasm = this.debugWasm, debug = undefined } = {}) {
    await this.ready;
    const effectiveDebug = (debug !== undefined) ? !!debug : !!debugWasm;
    if (effectiveDebug) {
      safeConsole("log", `[sitelen-vector-js ${nowIso()}] exportPlanToVectorDocument START`);
      safeConsole("log", `[sitelen-vector-js ${nowIso()}] export args`, { paddingPx, fallbackWidthPx, fallbackHeightPx, debugWasm, debug });
    }
    const previousDebug = this.debug;
    this.debug = effectiveDebug;
    this.debugWasm = effectiveDebug;
    const allRawRuns = asArray(plan?.lines).flatMap(line => asArray(line?.runs));
    const runs = flattenRuns(plan);
    this.log("exportPlanToVectorDocument: plan summary", {
      lineCount: asArray(plan?.lines).length,
      rawRunCount: allRawRuns.length,
      drawableRunCount: runs.length,
      planWidthPx: plan?.widthPx,
      planHeightPx: plan?.heightPx,
      sampleRuns: allRawRuns.slice(0, 20).map((run, index) => ({
        index,
        kind: run?.kind,
        renderMode: run?.renderMode,
        sourceKind: run?.sourceKind,
        fontRole: run?.fontRole,
        fontFamily: run?.fontFamily,
        encodedText: run?.encodedText,
        cpsLen: Array.isArray(run?.cps) ? run.cps.length : null,
        xPx: run?.xPx,
        drawXPx: run?.drawXPx,
        baselineYPx: run?.baselineYPx,
        widthPx: run?.widthPx,
        heightPx: run?.heightPx
      }))
    });
    if (!runs.length) throw new Error("No drawable runs in render plan.");

    const allBounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
    const paths = [];
    const warnings = [];

    for (let runIndex = 0; runIndex < runs.length; runIndex++) {
      const run = runs[runIndex];
      const rawPayload = runTextOrCps(run);
      const payload = prepareCartouchePayloadForVector(run, rawPayload, this);
      this.log("run candidate", {
        runIndex,
        kind: run?.kind,
        renderMode: run?.renderMode,
        sourceKind: run?.sourceKind,
        fontRole: run?.fontRole,
        fontFamily: run?.fontFamily,
        text: payload.text,
        cps: payload.cps,
        rawText: rawPayload.text,
        rawCps: rawPayload.cps,
        syntheticCornerBracket: isCornerBracketExportRun(run),
        syntheticCornerBracket: isCornerBracketExportRun(run),
        cartoucheWrapped: isCartoucheRun(run),
        dateOrTimeKasiRewrite: isCartoucheRun(run) && runIsDateOrTime(run),
        manualTallies: getManualTalliesForRun(run),
        cartoucheTallyMode: getCartoucheTallyModeForRun(run, this),
        manualTallyVector: isCartoucheRun(run) && isManualTallyModeForRun(run, this),
        xPx: getRunX(run),
        baselineYPx: getRunBaseline(run),
        fontPx: getRunFontPx(run, plan?.fontPx || 56),
        widthPx: run?.widthPx,
        heightPx: run?.heightPx
      });

      if (isCartoucheRun(run)) {
        debugLiteralRepairStage(effectiveDebug, "cartouche run before font resolve", {
          runIndex,
          shouldRepair: shouldRepairLiteralCartoucheVectorLeftEdge(run),
          repairFlag: run?.repairQuotedLatinLeftEdge === true || run?._element?.repairQuotedLatinLeftEdge === true,
          strictSource: strictLiteralCartoucheSourceText(run),
          rawPayload,
          payload,
          run: describeRunForDebug(run)
        });
      }

      const fontBytes = await this.resolveFontBytesForRun(run, { debugWasm: effectiveDebug, runIndex });
      if (!fontBytes) {
        const msg = `No font bytes for ${run.fontFamily || run.fontRole || run.kind}; skipped run.`;
        warnings.push(msg);
        this.warn(msg, { runIndex, run });
        continue;
      }

      const cornerBracketRun = isCornerBracketExportRun(run);
      let cornerBracketGid = null;
      let useFontCornerBracketGlyph = false;
      if (cornerBracketRun) {
        const cp = cornerBracketCodepoint(run);
        cornerBracketGid = glyphIdForCodepointFromFontBytes(fontBytes, cp);
        useFontCornerBracketGlyph = Number.isFinite(cornerBracketGid) && cornerBracketGid > 0;
        debugBracketExportStage(effectiveDebug, "corner bracket glyph-id check", {
          runIndex,
          codepoint: cp == null ? null : `U+${cp.toString(16).toUpperCase().padStart(4, "0")}`,
          glyphId: cornerBracketGid,
          useFontCornerBracketGlyph,
          run: describeRunForDebug(run)
        });
        this.log("corner bracket glyph-id check", {
          runIndex,
          codepoint: cp,
          glyphId: cornerBracketGid,
          useFontCornerBracketGlyph,
          fontFamily: run?.fontFamily,
          fontRole: run?.fontRole
        });

        if (!useFontCornerBracketGlyph) {
          const syntheticBracketPaths = buildSyntheticCornerBracketPathsForRun(run, {
            fill: getRunFill(run, plan?.fillStyle || "#111111"),
            halo: getRunHalo(run)
          });
          debugBracketExportStage(effectiveDebug, "synthetic bracket fallback paths", {
            runIndex,
            glyphId: cornerBracketGid,
            pathCount: syntheticBracketPaths.length,
            paths: debugPathSummary(syntheticBracketPaths)
          });
          for (const p of syntheticBracketPaths) {
            paths.push(p);
            includeBounds(allBounds, p.bounds || vectorPathBounds(p));
          }
          continue;
        }
      }

      const request = {
        text: payload.text,
        cps: payload.cps,
        rawText: rawPayload.text,
        rawCps: rawPayload.cps,
        cartoucheWrapped: isCartoucheRun(run),
        dateOrTimeKasiRewrite: isCartoucheRun(run) && runIsDateOrTime(run),
        manualTallies: getManualTalliesForRun(run),
        cartoucheTallyMode: getCartoucheTallyModeForRun(run, this),
        manualTallyVector: isCartoucheRun(run) && isManualTallyModeForRun(run, this),
        xPx: getRunX(run),
        baselineYPx: getRunBaseline(run),
        fontPx: getRunFontPx(run, plan?.fontPx || 56),
        fill: getRunFill(run, plan?.fillStyle || "#111111"),
        halo: getRunHalo(run),
        debugLogs: false
      };

      let result;
      try {
        this.log("calling WASM vectorizeRun", {
          runIndex,
          fontBytesLength: fontBytes?.byteLength ?? fontBytes?.length ?? null,
          request
        });
        result = this.wasm.vectorizeRun(fontBytes, request);
      } catch (err) {
        const msg = `WASM vectorizeRun failed for run ${runIndex}: ${err?.message || String(err)}`;
        warnings.push(msg);
        this.warn(msg, { runIndex, err, run, request });
        continue;
      }

      this.log("WASM vectorizeRun result", {
        runIndex,
        ok: result?.ok,
        glyphCount: result?.glyphCount,
        pathCount: asArray(result?.paths).length,
        advancePx: result?.advancePx,
        bounds: result?.bounds,
        warnings: result?.warnings
      });

      if (isCornerBracketExportRun(run)) {
        debugBracketExportStage(effectiveDebug, "WASM result", {
          runIndex,
          ok: result?.ok,
          glyphCount: result?.glyphCount,
          pathCount: asArray(result?.paths).length,
          advancePx: result?.advancePx,
          bounds: result?.bounds,
          warnings: result?.warnings,
          paths: debugPathSummary(result?.paths)
        });
      }

      if (cornerBracketRun && useFontCornerBracketGlyph && !asArray(result?.paths).length) {
        const syntheticBracketPaths = buildSyntheticCornerBracketPathsForRun(run, {
          fill: getRunFill(run, plan?.fillStyle || "#111111"),
          halo: getRunHalo(run)
        });
        warnings.push(`run ${runIndex}: font bracket glyph id ${cornerBracketGid} produced no vector paths; used synthetic fallback.`);
        debugBracketExportStage(effectiveDebug, "font bracket produced no paths; synthetic fallback", {
          runIndex,
          glyphId: cornerBracketGid,
          pathCount: syntheticBracketPaths.length,
          paths: debugPathSummary(syntheticBracketPaths)
        });
        for (const p of syntheticBracketPaths) {
          paths.push(p);
          includeBounds(allBounds, p.bounds || vectorPathBounds(p));
        }
        continue;
      }

      if (isCartoucheRun(run) && (run?.repairQuotedLatinLeftEdge === true || run?._element?.repairQuotedLatinLeftEdge === true || strictLiteralCartoucheSourceText(run))) {
        debugLiteralRepairStage(effectiveDebug, "WASM cartouche result", {
          runIndex,
          ok: result?.ok,
          pathCount: asArray(result?.paths).length,
          bounds: result?.bounds,
          warnings: result?.warnings,
          shouldRepair: shouldRepairLiteralCartoucheVectorLeftEdge(run),
          paths: debugPathSummary(result?.paths)
        });
      }

      for (const w of asArray(result?.warnings)) warnings.push(`run ${runIndex}: ${w}`);

      // If this literal cartouche needs repair AND halo is active, call WASM a second time
      // with halo disabled to obtain clean path bounds for detection. This decouples the
      // clip detection from halo width — the clip is computed on clean geometry and then
      // applied to the real (halo-enabled) paths for rendering.
      let detectionPathsForRepair = null;
      if (shouldRepairLiteralCartoucheVectorLeftEdge(run)) {
        const haloInfo = getRunHalo(run);
        if (haloInfo.enabled && haloInfo.widthPx > 0) {
          try {
            const cleanResult = this.wasm.vectorizeRun(fontBytes, {
              ...request,
              halo: { enabled: false, color: "#FFFFFF", widthPx: 0 }
            });
            const cleanPaths = asArray(cleanResult?.paths);
            if (cleanPaths.length === asArray(result?.paths).length) {
              detectionPathsForRepair = cleanPaths;
            }
          } catch {}
        }
      }

      let resultPathsForExport = repairLiteralCartoucheRulePathLeftEdges(
        run,
        asArray(result?.paths),
        { debug: effectiveDebug, runIndex, clipScale: getLiteralCartoucheRuleClipScaleForRun(run, this), clipStrategy: getLiteralCartoucheRuleClipStrategyForRun(run, this), leftCapClipRatio: getLiteralCartoucheLeftCapClipRatioForRun(run, this), detectionPaths: detectionPathsForRepair }
      );

      // Draw manual tally geometry before the font/cartouche paths. This keeps the
      // cartouche outline continuous when halo is enabled, because the cartouche
      // stroke/fill is serialized above the synthetic tally marks/backgrounds.
      if (isCartoucheRun(run) && isManualTallyModeForRun(run, this)) {
        const manualTallies = getManualTalliesForRun(run);
        const syntheticTallyPaths = buildManualTallyVectorPathsForRun(
          run,
          payload.rawInnerCpsForManualTallies || rawPayload.cps || [],
          manualTallies,
          { fill: request.fill, halo: request.halo, vectorResult: result }
        );

        if (syntheticTallyPaths.length) {
          this.log("manual tally synthetic paths", {
            runIndex,
            cartoucheTallyMode: getCartoucheTallyModeForRun(run, this),
            manualTallies,
            pathCount: syntheticTallyPaths.length,
            glyphCount: Array.isArray(result?.glyphs) ? result.glyphs.length : null
          });
        }

        for (const p of syntheticTallyPaths) {
          paths.push(p);
          includeBounds(allBounds, p.bounds);
        }
      }

      // v120: no synthetic frame/rule drawing. Only clip selected existing top/bottom overdraw paths.
      for (const p of resultPathsForExport) {
        paths.push(p);
        includeBounds(allBounds, p.bounds || vectorPathBounds(p));
      }
    }

    this.log("vector document accumulated paths", {
      pathCount: paths.length,
      warningCount: warnings.length,
      warnings: warnings.slice(0, 100),
      allBounds
    });

    debugLog(effectiveDebug, "final path count", paths.length, "warnings", warnings);
    if (!paths.length) {
      safeConsole("error", `[sitelen-vector-js ${nowIso()}] exportPlanToVectorDocument FAILED: no vector paths`, { warnings, pathsLength: paths.length });
      throw new Error(warnings.join("\n") || "No vector paths were produced.");
    }

    const hasBounds = finiteBounds(allBounds);
    const left = hasBounds ? Math.floor(allBounds.minX - paddingPx) : 0;
    const top = hasBounds ? Math.floor(allBounds.minY - paddingPx) : 0;
    const right = hasBounds ? Math.ceil(allBounds.maxX + paddingPx) : Math.ceil(fallbackWidthPx || plan?.widthPx || 1);
    const bottom = hasBounds ? Math.ceil(allBounds.maxY + paddingPx) : Math.ceil(fallbackHeightPx || plan?.heightPx || 1);

    // v103: do not mutate/translate path objects here.
    // Some wasm-bindgen/serde shapes arrive with valid `d` but commands in a non-plain-array shape;
    // the old translation step converted those to empty commands and erased every `d`, producing a blank SVG.
    // SVG can keep absolute coordinates by using a non-zero viewBox origin. PDF export can still convert
    // commands separately when command arrays are available.

    this.log("exportPlanToVectorDocument COMPLETE", { pathCount: paths.length, widthPx: Math.max(1, right - left), heightPx: Math.max(1, bottom - top), viewBoxX: left, viewBoxY: top, firstPathKeys: Object.keys(paths[0] || {}), firstPath: paths[0] });

    return {
      plan,
      paths,
      warnings,
      viewBoxX: left,
      viewBoxY: top,
      paddingPx,
      literalCartoucheRuleClipScale: getLiteralCartoucheRuleClipScaleForRun(null, this),
      literalCartoucheRuleClipStrategy: getLiteralCartoucheRuleClipStrategyForRun(null, this),
      literalCartoucheLeftCapClipRatio: getLiteralCartoucheLeftCapClipRatioForRun(null, this),
      widthPx: Math.max(1, right - left),
      heightPx: Math.max(1, bottom - top),
      bounds: hasBounds ? { minX: allBounds.minX - left, minY: allBounds.minY - top, maxX: allBounds.maxX - left, maxY: allBounds.maxY - top } : null
    };
  }

  async resolveFontBytesForRun(run, { debugWasm = this.debugWasm, runIndex = null } = {}) {
    const forceLiteralCornerBracket = false;
    const family = String(run?.fontFamily || "").trim();
    const role = String(run?.fontRole || "").trim();
    const cacheKey = `${family}::${role}`;
    if (this.fontByteCache.has(cacheKey)) {
      const cached = this.fontByteCache.get(cacheKey);
      this.log("font byte cache hit", { cacheKey, byteLength: cached?.byteLength ?? cached?.length ?? null });
      return cached;
    }

    let bytes = null;
    const preset = this.fontController?.getActivePreset?.() || null;
    const presetKey = preset?.key;
    let resolved = null;
    if (this.fontController?.resolvePresetRecord && presetKey) {
      try { resolved = await this.fontController.resolvePresetRecord(presetKey); } catch {}
    }
    const pair = resolved?.pairRecord || preset?.__pairRecord || null;

    const preferCompanion = fontRunPrefersCompanion(run, preset);

    if (pair?.baseBlob || pair?.companionBlob || pair?.literalCartoucheBlob) {
      if (family && family === String(pair.literalCartoucheFamily || pair.literalCartoucheFontFamily || "") && pair.literalCartoucheBlob) {
        bytes = await blobToUint8Array(pair.literalCartoucheBlob);
      }
      else if (preferCompanion && pair.companionBlob) bytes = await blobToUint8Array(pair.companionBlob);
      else if (!preferCompanion && (role === "literal" || role === "unknown") && family === "Patrick-Head-Font") bytes = null; // fetch Patrick Hand below; do not use sitelen base as literal fallback
      else if (family && family === String(pair.companionFamily || "") && pair.companionBlob) bytes = await blobToUint8Array(pair.companionBlob);
      else if (family && family === String(pair.baseFamily || "") && pair.baseBlob) bytes = await blobToUint8Array(pair.baseBlob);
      else bytes = await blobToUint8Array(preferCompanion ? pair.companionBlob : pair.baseBlob);
    }

    if (!bytes && (role === "literal" || role === "unknown") && family === "Patrick-Head-Font") {
      bytes = await fetchFaceBytes({ family: "Patrick-Head-Font", url: PATRICK_HAND_FONT_URL, format: "truetype" });
    }

    if (!bytes && preset) {
      const face = findFaceInPreset(preset, family)
        || (preferCompanion ? findFaceInPreset(preset, preset.cartoucheFamily) : findFaceInPreset(preset, preset.textFamily));
      if (face) bytes = await fetchFaceBytes(face);
    }

    this.log("font bytes resolved", { cacheKey, family, role, preferCompanion, forceLiteralCornerBracket, byteLength: bytes?.byteLength ?? bytes?.length ?? null, presetKey, hasPair: !!pair });
    if (forceLiteralCornerBracket) {
      debugBracketExportStage(debugWasm, "font bytes resolved for bracket", {
        runIndex,
        cacheKey,
        family,
        role,
        preferCompanion,
        forceLiteralCornerBracket,
        byteLength: bytes?.byteLength ?? bytes?.length ?? null,
        presetKey,
        hasPair: !!pair,
        originalRun: describeRunForDebug(run)
      });
    }
    debugLog(debugWasm, "font bytes resolved", {
      runIndex,
      cacheKey,
      family,
      role,
      preferCompanion,
      forceLiteralCornerBracket,
      activePresetKey: preset?.key || null,
      hasPair: !!pair,
      byteLength: bytes?.byteLength || bytes?.length || 0
    });
    this.fontByteCache.set(cacheKey, bytes);
    return bytes;
  }

  async exportTextToSvgBlob(args = {}) {
    const doc = args?.plan
      ? await this.exportPlanToVectorDocument(args)
      : await this.exportTextToVectorDocument(args);
    this.log("creating SVG blob", { pathCount: doc.paths?.length, widthPx: doc.widthPx, heightPx: doc.heightPx, warnings: doc.warnings });
    const svgText = svgFromVectorDocument(doc);
    this.log("SVG string generated", {
      containsPath: svgText.includes("<path"),
      pathElementCount: (svgText.match(/<path\b/g) || []).length,
      length: svgText.length,
      prefix: svgText.slice(0, 500)
    });
    if (!svgText.includes("<path")) {
      console.error("[sitelen-vector-exporter] v102 generated SVG has no <path>; doc sample", {docPathsLen: doc.paths?.length, firstPath: doc.paths?.[0], svgPrefix: svgText.slice(0,1000)});
      throw new Error("SVG writer produced no <path> elements even though vector paths were produced. Check console for v102 doc sample.");
    }
    return new Blob([svgText], { type: "image/svg+xml;charset=utf-8" });
  }

  async exportTextToPdfBlob(args = {}) {
    const doc = args?.plan
      ? await this.exportPlanToVectorDocument(args)
      : await this.exportTextToVectorDocument(args);
    this.log("creating PDF blob", { pathCount: doc.paths?.length, widthPx: doc.widthPx, heightPx: doc.heightPx, warnings: doc.warnings });
    return pdfFromVectorDocument(doc);
  }

  async downloadSvg(args = {}) {
    const blob = await this.exportTextToSvgBlob(args);
    downloadBlob(blob, args.filename || "sitelen-vector.svg");
  }

  async downloadPdf(args = {}) {
    const blob = await this.exportTextToPdfBlob(args);
    downloadBlob(blob, args.filename || "sitelen-vector.pdf");
  }
}

function translateCommand(c, dx, dy) {
  if (!c || !c.cmd) return c;
  if (c.cmd === "M") return { ...c, x: c.x + dx, y: c.y + dy };
  if (c.cmd === "L") return { ...c, x: c.x + dx, y: c.y + dy };
  if (c.cmd === "Q") return { ...c, x1: c.x1 + dx, y1: c.y1 + dy, x: c.x + dx, y: c.y + dy };
  if (c.cmd === "C") return { ...c, x1: c.x1 + dx, y1: c.y1 + dy, x2: c.x2 + dx, y2: c.y2 + dy, x: c.x + dx, y: c.y + dy };
  return { ...c };
}

function commandsToSvgD(commands) {
  const out = [];
  for (const c of asArray(commands)) {
    if (c.cmd === "M") out.push(`M${num(c.x)} ${num(c.y)}`);
    else if (c.cmd === "L") out.push(`L${num(c.x)} ${num(c.y)}`);
    else if (c.cmd === "Q") out.push(`Q${num(c.x1)} ${num(c.y1)} ${num(c.x)} ${num(c.y)}`);
    else if (c.cmd === "C") out.push(`C${num(c.x1)} ${num(c.y1)} ${num(c.x2)} ${num(c.y2)} ${num(c.x)} ${num(c.y)}`);
    else if (c.cmd === "Z") out.push("Z");
  }
  return out.join(" ");
}

export default SitelenVectorExporter;
