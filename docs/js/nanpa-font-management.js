/* Browser-only font/source/companion management for nanpa-linja-n.
   No external dependencies.
   This first-pass implementation focuses on:
   - built-in/runtime/indexeddb font pair resolution
   - UCSUR compliance detection for the required target words
   - fallback companion creation by copying the original font and rewriting metadata
   - manual companion upload / overwrite
   - immediate runtime availability via FontFace blob URLs
   - dynamic preset generation compatible with sitelen-font-pair-controller.js

   Important limitation:
   Automatic binary cartouche rewriting is not implemented in this no-dependency build.
   Automatic companion creation therefore uses a copied-and-renamed fallback companion.
*/

export const REQUIRED_WORD_CODEPOINTS = Object.freeze({
  en: 0xF190A,
  kulupu: 0xF191F,
  nanpa: 0xF193D,
  nena: 0xF1940,
  o: 0xF1944,
  ona: 0xF1946,
  open: 0xF1947,
});

export const TWO_THIRDS_WORDS = Object.freeze(["ona", "kulupu", "o"]);
export const QUARTER_WORDS = Object.freeze(["nanpa", "en", "nena", "open"]);

export const DEFAULT_SETTINGS = Object.freeze({
  twoThirdsVerticalOffset: 0,
  quarterVerticalOffset: 0,
  twoThirdsWidthFactor: 1,
  quarterWidthFactor: 1,
  metadataSuffix: "-nanpa-linja-n",
});

const DEFAULT_DB_NAME = "nanpa-linja-n-font-db";
const DEFAULT_DB_VERSION = 1;
const STORE_FONTS = "fonts";
const STORE_PAIRS = "pairs";
const STORE_SETTINGS = "settings";

function assert(condition, message) {
  if (!condition) throw new Error(message || "Assertion failed");
}
function nowTs() { return Date.now(); }
function toArrayBuffer(value) {
  if (value instanceof ArrayBuffer) return value;
  if (value?.buffer instanceof ArrayBuffer) {
    const u8 = value instanceof Uint8Array
      ? value
      : new Uint8Array(value.buffer, value.byteOffset || 0, value.byteLength || value.length || 0);
    return u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength);
  }
  throw new Error("Unsupported binary value");
}
function u8slice(buffer, offset, length) {
  return new Uint8Array(toArrayBuffer(buffer), offset, length).slice();
}
function decodeUtf16BE(bytes) {
  const out = [];
  for (let i = 0; i + 1 < bytes.length; i += 2) out.push((bytes[i] << 8) | bytes[i + 1]);
  return String.fromCharCode(...out);
}
function decodeMacRoman(bytes) {
  return Array.from(bytes, b => String.fromCharCode(b)).join("");
}
function encodeUtf16BE(str) {
  const out = new Uint8Array(str.length * 2);
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    out[i * 2] = (code >> 8) & 0xff;
    out[i * 2 + 1] = code & 0xff;
  }
  return out;
}
function encodeMacRomanLike(str, lengthHint) {
  const out = new Uint8Array(lengthHint ?? str.length);
  for (let i = 0; i < out.length; i++) out[i] = i < str.length ? Math.min(255, str.charCodeAt(i)) : 0x20;
  return out;
}
function readTag(dv, offset) {
  return String.fromCharCode(
    dv.getUint8(offset),
    dv.getUint8(offset + 1),
    dv.getUint8(offset + 2),
    dv.getUint8(offset + 3),
  );
}
function sfntDirectory(buffer) {
  const dv = new DataView(toArrayBuffer(buffer));
  const numTables = dv.getUint16(4, false);
  const tables = new Map();
  for (let i = 0; i < numTables; i++) {
    const off = 12 + i * 16;
    tables.set(readTag(dv, off), {
      entryOffset: off,
      checksum: dv.getUint32(off + 4, false),
      offset: dv.getUint32(off + 8, false),
      length: dv.getUint32(off + 12, false),
    });
  }
  return { dv, tables };
}
function parseNameTable(buffer) {
  const { dv, tables } = sfntDirectory(buffer);
  const table = tables.get("name");
  if (!table) return { records: [], tableOffset: 0, storageOffset: 0 };
  const base = table.offset;
  const count = dv.getUint16(base + 2, false);
  const storageOffset = dv.getUint16(base + 4, false);
  const records = [];
  for (let i = 0; i < count; i++) {
    const off = base + 6 + i * 12;
    const platformID = dv.getUint16(off, false);
    const encodingID = dv.getUint16(off + 2, false);
    const languageID = dv.getUint16(off + 4, false);
    const nameID = dv.getUint16(off + 6, false);
    const length = dv.getUint16(off + 8, false);
    const stringOffset = dv.getUint16(off + 10, false);
    const bytes = u8slice(buffer, base + storageOffset + stringOffset, length);
    const value = (platformID === 3 || platformID === 0) ? decodeUtf16BE(bytes) : decodeMacRoman(bytes);
    records.push({ platformID, encodingID, languageID, nameID, length, stringOffset, value });
  }
  return { records, tableOffset: base, storageOffset };
}
function namePriority(rec) {
  if (rec.platformID === 3 && (rec.languageID === 0x0409 || rec.languageID === 0)) return 100;
  if (rec.platformID === 0) return 80;
  if (rec.platformID === 1) return 50;
  return 10;
}
function getBestName(records, nameID) {
  const found = records.filter(r => r.nameID === nameID && r.value);
  found.sort((a, b) => namePriority(b) - namePriority(a));
  return found[0]?.value || "";
}
function pathStem(filename) {
  const s = String(filename || "");
  const leaf = s.split(/[\\/]/).pop() || s;
  return leaf.replace(/\.[^.]+$/, "");
}
function sanitizePostScriptName(value) {
  return String(value || "").replace(/\s+/g, "").replace(/[^A-Za-z0-9._-]/g, "-");
}
export function normalizeKey(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
async function sha256Hex(buffer) {
  const hash = await crypto.subtle.digest("SHA-256", toArrayBuffer(buffer));
  return Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, "0")).join("");
}
export function extractFontMetadata(buffer, fallbackFilename = "") {
  const { records } = parseNameTable(buffer);
  const family = getBestName(records, 1) || pathStem(fallbackFilename) || "UploadedFont";
  const fullName = getBestName(records, 4) || family;
  const postscriptName = sanitizePostScriptName(getBestName(records, 6) || fullName);
  const typographicFamily = getBestName(records, 16) || family;
  const uniqueID = getBestName(records, 3) || fullName;
  return { family, fullName, postscriptName, typographicFamily, uniqueID };
}
export function rewriteNameTableSuffix(buffer, suffix = "-nanpa-linja-n") {
  const out = toArrayBuffer(buffer).slice(0);
  const { dv, tables } = sfntDirectory(out);
  const nameRec = tables.get("name");
  if (!nameRec) return out;
  const parsed = parseNameTable(out);
  const storageBase = parsed.tableOffset + parsed.storageOffset;
  for (const rec of parsed.records) {
    const oldValue = rec.value || "";
    if (!oldValue || oldValue.includes(suffix)) continue;
    let newValue = oldValue + suffix;
    if (rec.nameID === 6) newValue = sanitizePostScriptName(oldValue + suffix);
    const oldLen = rec.length;
    let encoded = (rec.platformID === 3 || rec.platformID === 0)
      ? encodeUtf16BE(newValue)
      : encodeMacRomanLike(newValue, oldLen);
    if (encoded.length > oldLen) encoded = encoded.slice(0, oldLen);
    for (let i = 0; i < oldLen; i++) {
      dv.setUint8(storageBase + rec.stringOffset + i, encoded[i] ?? 0);
    }
  }
  return out;
}
function parseCmapFormat12(dv, offset) {
  const map = new Map();
  const nGroups = dv.getUint32(offset + 12, false);
  let p = offset + 16;
  for (let i = 0; i < nGroups; i++, p += 12) {
    const startChar = dv.getUint32(p, false);
    const endChar = dv.getUint32(p + 4, false);
    const startGlyph = dv.getUint32(p + 8, false);
    for (let cp = startChar; cp <= endChar; cp++) map.set(cp, startGlyph + (cp - startChar));
  }
  return map;
}
function parseCmapFormat4(dv, offset) {
  const map = new Map();
  const segCount = dv.getUint16(offset + 6, false) / 2;
  const endCodeOffset = offset + 14;
  const startCodeOffset = endCodeOffset + segCount * 2 + 2;
  const idDeltaOffset = startCodeOffset + segCount * 2;
  const idRangeOffsetOffset = idDeltaOffset + segCount * 2;
  for (let i = 0; i < segCount; i++) {
    const endCode = dv.getUint16(endCodeOffset + i * 2, false);
    const startCode = dv.getUint16(startCodeOffset + i * 2, false);
    const idDelta = dv.getInt16(idDeltaOffset + i * 2, false);
    const idRangeOffset = dv.getUint16(idRangeOffsetOffset + i * 2, false);
    for (let cp = startCode; cp <= endCode; cp++) {
      if (cp === 0xFFFF) continue;
      let glyphIndex = 0;
      if (idRangeOffset === 0) {
        glyphIndex = (cp + idDelta) & 0xFFFF;
      } else {
        const glyphOffset = idRangeOffsetOffset + i * 2 + idRangeOffset + (cp - startCode) * 2;
        if (glyphOffset < dv.byteLength) {
          glyphIndex = dv.getUint16(glyphOffset, false);
          if (glyphIndex !== 0) glyphIndex = (glyphIndex + idDelta) & 0xFFFF;
        }
      }
      if (glyphIndex) map.set(cp, glyphIndex);
    }
  }
  return map;
}
function parseCmapMap(buffer) {
  const { dv, tables } = sfntDirectory(buffer);
  const cmapTable = tables.get("cmap");
  if (!cmapTable) return new Map();
  const base = cmapTable.offset;
  const numTables = dv.getUint16(base + 2, false);
  const subtables = [];
  for (let i = 0; i < numTables; i++) {
    const off = base + 4 + i * 8;
    subtables.push({
      subtableOffset: base + dv.getUint32(off + 4, false),
      format: dv.getUint16(base + dv.getUint32(off + 4, false), false),
    });
  }
  const f12 = subtables.find(s => s.format === 12);
  if (f12) return parseCmapFormat12(dv, f12.subtableOffset);
  const f4 = subtables.find(s => s.format === 4);
  if (f4) return parseCmapFormat4(dv, f4.subtableOffset);
  return new Map();
}
export function detectUcsurCompliance(buffer) {
  const cmap = parseCmapMap(buffer);
  const missing = [];
  const present = {};
  for (const [word, cp] of Object.entries(REQUIRED_WORD_CODEPOINTS)) {
    const glyphIndex = cmap.get(cp) || 0;
    if (!glyphIndex) missing.push(word);
    else present[word] = glyphIndex;
  }
  return { ok: missing.length === 0, missing, present, cmapSize: cmap.size };
}
export function detectTransformSupport(buffer, filename = "") {
  const metadata = extractFontMetadata(buffer, filename);
  const compliance = detectUcsurCompliance(buffer);
  const familyKey = normalizeKey(metadata.family || pathStem(filename));
  if (!compliance.ok) {
    return {
      ucsurOk: false,
      transformSupported: false,
      familyKey,
      strategy: "unsupported",
      reason: `Missing UCSUR words: ${compliance.missing.join(", ")}`,
    };
  }
  return {
    ucsurOk: true,
    transformSupported: false,
    familyKey,
    strategy: "fallback-copy",
    reason: "Automatic binary cartouche rewriting is not implemented in this browser-only dependency-free build; fallback companion copy will be used.",
  };
}
function guessFontFormatFromFilename(name) {
  const s = String(name || "").toLowerCase();
  if (s.endsWith(".otf")) return "opentype";
  if (s.endsWith(".woff2")) return "woff2";
  if (s.endsWith(".woff")) return "woff";
  return "truetype";
}
function guessBlobFormat(blob, fallbackName = "") {
  return guessFontFormatFromFilename(blob?.name || fallbackName || "");
}
async function registerFontFace({ family, blob, format, descriptors = {}, sample = "" }) {
  assert(typeof FontFace !== "undefined", "FontFace API unavailable");
  const url = URL.createObjectURL(blob);
  const face = new FontFace(String(family), `url("${url}") format("${format || "truetype"}")`, descriptors || {});
  await face.load();
  document.fonts.add(face);
  return { family: String(family), url, format: format || "truetype", descriptors: descriptors || {}, sample: sample || "" };
}
function defaultLiteralOptions(literalFamily = "Patrick-Head-Font") {
  return [
    ["__active_text_family__", "sitelen font"],
    ["__active_cartouche_family__", "nanpa-linja-n"],
    [literalFamily, literalFamily],
    ["Arial", "Arial"],
    ["Times New Roman", "Times New Roman"],
    ["Courier New", "Courier New"],
    ["system-ui", "system-ui"],
  ];
}
export function buildDynamicPreset({
  key,
  label,
  parserMode = "sitelen-seli-kiwen",
  textFamily,
  cartoucheFamily,
  literalFamily = "Patrick-Head-Font",
  literalOptions = null,
  faces = [],
  pdfTextFontUrl = "",
  pdfCartoucheFontUrl = "",
  source = "runtime",
  editable = true,
  fontKey = "",
}) {
  return {
    key,
    label,
    parserMode,
    textFamily,
    cartoucheFamily,
    literalFamily,
    literalOptions: literalOptions || defaultLiteralOptions(literalFamily),
    pdfTextFontUrl,
    pdfCartoucheFontUrl,
    faces,
    source,
    editable,
    fontKey,
  };
}
function openIndexedDb(dbName = DEFAULT_DB_NAME) {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(dbName, DEFAULT_DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_FONTS)) db.createObjectStore(STORE_FONTS, { keyPath: "fontKey" });
      if (!db.objectStoreNames.contains(STORE_PAIRS)) db.createObjectStore(STORE_PAIRS, { keyPath: "fontKey" });
      if (!db.objectStoreNames.contains(STORE_SETTINGS)) db.createObjectStore(STORE_SETTINGS, { keyPath: "fontKey" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error("Failed to open IndexedDB"));
  });
}
function idbPut(db, storeName, value) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    tx.objectStore(storeName).put(value);
    tx.oncomplete = () => resolve(value);
    tx.onerror = () => reject(tx.error || new Error(`Failed to put ${storeName}`));
  });
}
function idbGet(db, storeName, key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const req = tx.objectStore(storeName).get(key);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error || new Error(`Failed to get ${storeName}`));
  });
}
function idbGetAll(db, storeName) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const req = tx.objectStore(storeName).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error || new Error(`Failed to getAll ${storeName}`));
  });
}
function idbDelete(db, storeName, key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    tx.objectStore(storeName).delete(key);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error || new Error(`Failed to delete ${storeName}`));
  });
}
async function buildFontRecordFromBlob(blob, { sourceType = "uploaded", filename = "", suppliedLabel = "" } = {}) {
  const buffer = await blob.arrayBuffer();
  const hash = await sha256Hex(buffer);
  const metadata = extractFontMetadata(buffer, filename || blob.name || "");
  const support = detectTransformSupport(buffer, filename || blob.name || "");
  const fontKey = `${normalizeKey(metadata.family || pathStem(filename || blob.name || ""))}--${hash.slice(0, 16)}`;
  return {
    fontKey,
    sourceType,
    filename: filename || blob.name || "",
    displayName: suppliedLabel || metadata.family || pathStem(filename || blob.name || "") || "Uploaded Font",
    metadata,
    support,
    hash,
    blob,
  };
}
export function buildFallbackCompanionBlob(originalBuffer, { suffix = DEFAULT_SETTINGS.metadataSuffix } = {}) {
  return new Blob([rewriteNameTableSuffix(originalBuffer, suffix)], { type: "font/otf" });
}
export function buildCompanionPresetKey(metadata, suffix = "-nanpa-linja-n") {
  return normalizeKey((metadata.family || metadata.fullName || metadata.postscriptName || "uploaded-font") + suffix);
}
export function createNanpaFontManager({
  builtInRegistry = {},
  dbName = DEFAULT_DB_NAME,
  defaultLiteralFamily = "Patrick-Head-Font",
  defaultParserMode = "sitelen-seli-kiwen",
  defaultMetadataSuffix = DEFAULT_SETTINGS.metadataSuffix,
} = {}) {
  const builtInPairs = new Map();
  const runtimePairs = new Map();
  const controllerBindings = new Set();
  let dbPromise = null;

  for (const [key, preset] of Object.entries(builtInRegistry || {})) {
    builtInPairs.set(String(key), {
      key: String(key),
      fontKey: String(key),
      sourceType: "builtin",
      editable: false,
      displayName: String(preset?.label || key),
      preset,
    });
  }

  function db() {
    if (!dbPromise) dbPromise = openIndexedDb(dbName);
    return dbPromise;
  }

  function emitChange(detail = {}) {
    window.dispatchEvent(new CustomEvent("nanpa-fonts-changed", { detail }));
    for (const refresh of controllerBindings) {
      try { refresh(detail); } catch {}
    }
  }

  async function saveBaseFontRecord(fontRecord) {
    const dbi = await db();
    const payload = { ...fontRecord, createdAt: fontRecord.createdAt || nowTs(), updatedAt: nowTs() };
    await idbPut(dbi, STORE_FONTS, payload);
    return payload;
  }

  async function saveCompanionPairRecord(record) {
    const dbi = await db();
    const payload = { ...record, createdAt: record.createdAt || nowTs(), updatedAt: nowTs() };
    await idbPut(dbi, STORE_PAIRS, payload);
    emitChange({ type: "pairSaved", fontKey: payload.fontKey });
    return payload;
  }

  async function saveSettings(fontKey, settings) {
    await idbPut(await db(), STORE_SETTINGS, { fontKey, settings, updatedAt: nowTs() });
  }

  async function loadSettings(fontKey) {
    const rec = await idbGet(await db(), STORE_SETTINGS, fontKey);
    return rec?.settings || null;
  }

  async function listStoredFonts() {
    return await idbGetAll(await db(), STORE_FONTS);
  }

  async function listStoredPairs() {
    return await idbGetAll(await db(), STORE_PAIRS);
  }

  async function removeStoredPair(fontKey) {
    await idbDelete(await db(), STORE_PAIRS, fontKey);
    for (const [key, rec] of Array.from(runtimePairs.entries())) {
      if ((rec.pairRecord?.fontKey || rec.fontKey) === fontKey) runtimePairs.delete(key);
    }
    emitChange({ type: "pairRemoved", fontKey });
  }

  async function buildRuntimePresetFromPairRecord(pairRecord) {
    const originalMeta = pairRecord.originalMetadata || extractFontMetadata(await pairRecord.originalBlob.arrayBuffer(), pairRecord.originalFilename || pairRecord.displayName || "");
    const companionMeta = pairRecord.companionMetadata || extractFontMetadata(await pairRecord.companionBlob.arrayBuffer(), pairRecord.companionFilename || pairRecord.displayName || "");
    const textFamily = originalMeta.family || pairRecord.displayName || "UploadedFont";
    const cartoucheFamily = companionMeta.family || `${textFamily}${pairRecord.metadataSuffix || defaultMetadataSuffix}`;
    const faces = [
      { family: textFamily, blob: pairRecord.originalBlob, format: guessBlobFormat(pairRecord.originalBlob, pairRecord.originalFilename || `${textFamily}.ttf`), sample: String.fromCodePoint(0xF196C) },
      { family: cartoucheFamily, blob: pairRecord.companionBlob, format: guessBlobFormat(pairRecord.companionBlob, pairRecord.companionFilename || `${cartoucheFamily}.ttf`), sample: String.fromCodePoint(0xF1990) },
    ];
    return buildDynamicPreset({
      key: pairRecord.presetKey || buildCompanionPresetKey(originalMeta, pairRecord.metadataSuffix || defaultMetadataSuffix),
      label: pairRecord.displayName || originalMeta.family || "Uploaded Font",
      parserMode: pairRecord.parserMode || defaultParserMode,
      textFamily,
      cartoucheFamily,
      literalFamily: pairRecord.literalFamily || defaultLiteralFamily,
      faces,
      source: pairRecord.sourceType || "runtime",
      editable: pairRecord.editable !== false,
      fontKey: pairRecord.fontKey,
    });
  }

  async function ensureRuntimeFaceUrls(preset) {
    const newFaces = [];
    for (const face of preset.faces || []) {
      if (face.url) newFaces.push(face);
      else if (face.blob) newFaces.push(await registerFontFace(face));
    }
    return { ...preset, faces: newFaces };
  }

  async function registerRuntimePair(pairRecord) {
    const preset = await buildRuntimePresetFromPairRecord(pairRecord);
    const hydratedPreset = await ensureRuntimeFaceUrls(preset);
    const key = hydratedPreset.key;
    const runtimeRec = {
      key,
      fontKey: pairRecord.fontKey,
      displayName: pairRecord.displayName,
      sourceType: pairRecord.sourceType || "runtime",
      editable: pairRecord.editable !== false,
      preset: hydratedPreset,
      pairRecord,
    };
    runtimePairs.set(key, runtimeRec);
    emitChange({ type: "runtimeRegistered", fontKey: pairRecord.fontKey, presetKey: key });
    return runtimeRec;
  }

  async function hydrateDynamicPresetsFromDb() {
    const storedPairs = await listStoredPairs();
    for (const pair of storedPairs) {
      try { await registerRuntimePair(pair); } catch (err) { console.warn("Failed to register stored pair", pair, err); }
    }
  }

  async function createInitialCompanionForFontBlob(fileOrBlob, options = {}) {
    const blob = fileOrBlob instanceof Blob ? fileOrBlob : new Blob([fileOrBlob]);
    const filename = options.filename || fileOrBlob?.name || "uploaded-font.ttf";
    const fontRecord = await buildFontRecordFromBlob(blob, { sourceType: "uploaded", filename, suppliedLabel: options.displayName || "" });
    await saveBaseFontRecord(fontRecord);

    const originalBuffer = await blob.arrayBuffer();
    const support = fontRecord.support;
    const metadataSuffix = options.metadataSuffix || defaultMetadataSuffix;
    const companionBlob = buildFallbackCompanionBlob(originalBuffer, { suffix: metadataSuffix });
    const companionMeta = extractFontMetadata(await companionBlob.arrayBuffer(), filename);

    const pairRecord = await saveCompanionPairRecord({
      fontKey: fontRecord.fontKey,
      baseFontKey: fontRecord.fontKey,
      displayName: fontRecord.displayName,
      presetKey: buildCompanionPresetKey(fontRecord.metadata, metadataSuffix),
      sourceType: support.transformSupported ? "generated" : "fallback-copy",
      editable: true,
      originalBlob: blob,
      companionBlob,
      metadataSuffix,
      settings: options.settings || { ...DEFAULT_SETTINGS, metadataSuffix },
      support,
      parserMode: options.parserMode || defaultParserMode,
      literalFamily: options.literalFamily || defaultLiteralFamily,
      originalMetadata: fontRecord.metadata,
      companionMetadata: companionMeta,
      originalFilename: filename,
      companionFilename: `${pathStem(filename)}${metadataSuffix}${filename.toLowerCase().endsWith(".otf") ? ".otf" : ".ttf"}`,
    });

    const runtimeRec = await registerRuntimePair(pairRecord);
    return { fontRecord, pairRecord, runtimeRec };
  }

  async function uploadManualCompanion(fontKey, companionFile) {
    const dbi = await db();
    const basePair = await idbGet(dbi, STORE_PAIRS, fontKey);
    if (!basePair) throw new Error("Base font pair not found for this companion upload.");
    const companionBlob = companionFile instanceof Blob ? companionFile : new Blob([companionFile]);
    const updated = {
      ...basePair,
      sourceType: "uploaded-companion",
      editable: true,
      companionBlob,
      companionFilename: companionFile?.name || basePair.companionFilename || "manual-companion.ttf",
      updatedAt: nowTs(),
    };
    await idbPut(dbi, STORE_PAIRS, updated);
    const runtimeRec = await registerRuntimePair(updated);
    return { pairRecord: updated, runtimeRec };
  }

  async function overwriteCompanionWithCurrentSettings(fontKey, settings = null) {
    const dbi = await db();
    const basePair = await idbGet(dbi, STORE_PAIRS, fontKey);
    if (!basePair) throw new Error("No stored pair found.");
    const mergedSettings = { ...(basePair.settings || DEFAULT_SETTINGS), ...(settings || {}) };
    const metadataSuffix = mergedSettings.metadataSuffix || basePair.metadataSuffix || defaultMetadataSuffix;
    const companionBlob = buildFallbackCompanionBlob(await basePair.originalBlob.arrayBuffer(), { suffix: metadataSuffix });
    const updated = {
      ...basePair,
      metadataSuffix,
      companionBlob,
      companionMetadata: extractFontMetadata(await companionBlob.arrayBuffer(), basePair.originalFilename || basePair.displayName || ""),
      sourceType: "fallback-copy",
      settings: mergedSettings,
      updatedAt: nowTs(),
    };
    await idbPut(dbi, STORE_PAIRS, updated);
    await saveSettings(fontKey, mergedSettings);
    const runtimeRec = await registerRuntimePair(updated);
    return { pairRecord: updated, runtimeRec };
  }

  async function resolvePresetRecord(presetKey) {
    if (runtimePairs.has(presetKey)) return runtimePairs.get(presetKey);
    if (builtInPairs.has(presetKey)) return builtInPairs.get(presetKey);
    const storedPairs = await listStoredPairs();
    const stored = storedPairs.find(x => String(x.presetKey) === String(presetKey) || String(x.fontKey) === String(presetKey));
    if (stored) return await registerRuntimePair(stored);
    return null;
  }

  function mergeRegistryWithDynamicPresets(registry) {
    const merged = { ...(registry || {}) };
    for (const [key, rec] of runtimePairs.entries()) merged[key] = rec.preset;
    return merged;
  }

  function bindController(controller, { onRefresh = null } = {}) {
    const refresh = async () => {
      if (typeof controller?.registerDynamicPreset === "function") {
        for (const [key, rec] of runtimePairs.entries()) controller.registerDynamicPreset(key, rec.preset);
      }
      if (typeof controller?.refreshAvailablePresets === "function") controller.refreshAvailablePresets();
      if (typeof controller?.populateScriptSelectOptions === "function") controller.populateScriptSelectOptions();
      if (typeof controller?.populateTextSelectOptions === "function") controller.populateTextSelectOptions();
      if (typeof onRefresh === "function") onRefresh();
    };
    controllerBindings.add(refresh);
    return {
      refresh,
      unbind() { controllerBindings.delete(refresh); },
    };
  }

  async function listKnownPairs() {
    const storedPairs = await listStoredPairs();
    const combined = [...builtInPairs.values()];
    for (const rec of storedPairs) combined.push({ ...rec, sourceType: rec.sourceType || "indexeddb" });
    for (const rec of runtimePairs.values()) combined.push(rec);
    const byKey = new Map();
    for (const item of combined) {
      const key = String(item.preset?.key || item.presetKey || item.key || item.fontKey);
      byKey.set(key, item);
    }
    return Array.from(byKey.values()).sort((a, b) => String(a.displayName || a.key || "").localeCompare(String(b.displayName || b.key || "")));
  }

  function listKnownPairsSync() {
    const out = [];
    for (const item of builtInPairs.values()) out.push(item);
    for (const item of runtimePairs.values()) out.push(item);
    return out;
  }

  return {
    REQUIRED_WORD_CODEPOINTS,
    TWO_THIRDS_WORDS,
    QUARTER_WORDS,
    DEFAULT_SETTINGS,
    normalizeKey,
    escapeHtml,
    extractFontMetadata,
    detectUcsurCompliance,
    detectTransformSupport,
    rewriteNameTableSuffix,
    buildFallbackCompanionBlob,
    buildCompanionPresetKey,
    buildDynamicPreset,
    db,
    listStoredFonts,
    listStoredPairs,
    listKnownPairs,
    listKnownPairsSync,
    loadSettings,
    saveSettings,
    removeStoredPair,
    hydrateDynamicPresetsFromDb,
    mergeRegistryWithDynamicPresets,
    createInitialCompanionForFontBlob,
    uploadManualCompanion,
    overwriteCompanionWithCurrentSettings,
    resolvePresetRecord,
    registerRuntimePair,
    bindController,
  };
}
