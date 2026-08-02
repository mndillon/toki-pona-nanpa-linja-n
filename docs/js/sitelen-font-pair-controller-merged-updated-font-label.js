const DEFAULT_FONT_LOAD_SAMPLE = String.fromCodePoint(0xF196C, 0xF1954, 0xF1990) + ' Hello';

export const TEXT_FONT_OPTION_SITELEN = '__active_text_family__';
export const TEXT_FONT_OPTION_NANPA_LINJA_N = '__active_cartouche_family__';

export const DEFAULT_TEXT_FONT_OPTIONS = [
  [TEXT_FONT_OPTION_SITELEN, 'sitelen font'],
  [TEXT_FONT_OPTION_NANPA_LINJA_N, 'nanpa-linja-n'],
  ['Patrick-Head-Font', 'Patrick Hand'],
  ['Arial', 'Arial'],
  ['Times New Roman', 'Times New Roman'],
  ['Courier New', 'Courier New'],
  ['system-ui', 'system-ui'],
];

const DEFAULT_DB_NAME = 'nanpaLinjaNFontPairs';
const DEFAULT_DB_VERSION = 1;
const DEFAULT_STORE = 'pairs';
const DEFAULT_CHANGED_EVENT = 'nanpa-fonts-changed';
const DEFAULT_CARTOUCHE_COMMA_TALLY_MARKS = true;
const DEFAULT_CARTOUCHE_TALLY_MODE = 'ucsur';
const DEFAULT_RENDER_ADAPTER_ID = 'identity';
const DEFAULT_PARSER_MODE = 'sitelen-pona-ascii-extended';
const PRELOADED_MANIFEST_METADATA_DB_SUFFIX = '-preloaded-manifest-metadata';
const PRELOADED_MANIFEST_METADATA_STORE = 'schemas';
const VALID_CARTOUCHE_TALLY_MODES = new Set(['ucsur', 'comma', 'manual']);

function byIdOrElement(value) {
  if (!value) return null;
  if (typeof value === 'string') return document.getElementById(value);
  return value;
}

function uniq(items) {
  return Array.from(new Set((items || []).filter(Boolean)));
}

function normalizeFormat(format) {
  const raw = String(format || '').trim().toLowerCase();
  if (!raw) return 'truetype';
  if (raw === 'ttf') return 'truetype';
  if (raw === 'otf') return 'opentype';
  if (raw === 'woff') return 'woff';
  if (raw === 'woff2') return 'woff2';
  return raw;
}

function quotedFontFamily(family) {
  const s = String(family || '').trim();
  return s.includes('"') ? s : `"${s}"`;
}

function cleanString(value, fallback = '') {
  const s = String(value ?? '').trim();
  return s || fallback;
}

function normalizeCartoucheTallyMode(value) {
  const s = String(value ?? '').trim().toLowerCase();
  return VALID_CARTOUCHE_TALLY_MODES.has(s) ? s : DEFAULT_CARTOUCHE_TALLY_MODE;
}

function normalizeStoredSettings(settings = null) {
  const src = (settings && typeof settings === 'object') ? settings : {};
  return {
    ...src,
    cartoucheCommaTallyMarks: src.cartoucheCommaTallyMarks !== false,
    cartoucheTallyMode: normalizeCartoucheTallyMode(src.cartoucheTallyMode),
  };
}

function normalizeManifestSchema(value) {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 ? n : 1;
}

function normalizeManifestFontKeyList(value) {
  if (!Array.isArray(value)) return [];
  return uniq(value.map(item => cleanString(item)).filter(Boolean));
}

function preloadedManifestMetadataDbName(dbName) {
  return `${cleanString(dbName, DEFAULT_DB_NAME)}${PRELOADED_MANIFEST_METADATA_DB_SUFFIX}`;
}

function preloadedManifestSchemaRecordId(storeName) {
  return cleanString(storeName, DEFAULT_STORE);
}

function openPreloadedManifestMetadataDb(dbName) {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(preloadedManifestMetadataDbName(dbName), 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(PRELOADED_MANIFEST_METADATA_STORE)) {
        db.createObjectStore(PRELOADED_MANIFEST_METADATA_STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Failed to open preloaded-manifest metadata database.'));
  });
}

async function readAppliedPreloadedManifestSchema(dbName, storeName) {
  let db = null;
  try {
    db = await openPreloadedManifestMetadataDb(dbName);
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(PRELOADED_MANIFEST_METADATA_STORE, 'readonly');
      const req = tx.objectStore(PRELOADED_MANIFEST_METADATA_STORE).get(preloadedManifestSchemaRecordId(storeName));
      req.onsuccess = () => {
        const n = Number(req.result?.schema);
        resolve(Number.isInteger(n) && n >= 1 ? n : 0);
      };
      req.onerror = () => reject(req.error || new Error('Failed to read the applied manifest schema.'));
    });
  } catch {
    return 0;
  } finally {
    try { db?.close(); } catch {}
  }
}

async function writeAppliedPreloadedManifestSchema(dbName, storeName, schema) {
  let db = null;
  try {
    db = await openPreloadedManifestMetadataDb(dbName);
    await new Promise((resolve, reject) => {
      const tx = db.transaction(PRELOADED_MANIFEST_METADATA_STORE, 'readwrite');
      tx.objectStore(PRELOADED_MANIFEST_METADATA_STORE).put({
        id: preloadedManifestSchemaRecordId(storeName),
        schema: normalizeManifestSchema(schema),
        updatedAt: nowIso()
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('Failed to save the applied manifest schema.'));
      tx.onabort = () => reject(tx.error || new Error('Saving the applied manifest schema was aborted.'));
    });
    return true;
  } catch {
    return false;
  } finally {
    try { db?.close(); } catch {}
  }
}


function nowIso() {
  return new Date().toISOString();
}

function fileExtFromName(name = '') {
  const lower = String(name || '').toLowerCase();
  if (lower.endsWith('.woff2')) return 'woff2';
  if (lower.endsWith('.woff')) return 'woff';
  if (lower.endsWith('.otf')) return 'otf';
  if (lower.endsWith('.ttf')) return 'ttf';
  return '';
}

function inferFormatFromFilename(name = '') {
  const ext = fileExtFromName(name);
  if (ext === 'woff2') return 'woff2';
  if (ext === 'woff') return 'woff';
  if (ext === 'otf') return 'opentype';
  return 'truetype';
}

function inferFormatFromBlob(blob, filename = '') {
  const type = String(blob?.type || '').toLowerCase();
  if (type.includes('woff2')) return 'woff2';
  if (type.includes('woff')) return 'woff';
  if (type.includes('otf') || type.includes('opentype')) return 'opentype';
  if (type.includes('ttf') || type.includes('truetype')) return 'truetype';
  return inferFormatFromFilename(filename);
}

function sanitizeFontKeyPart(value, fallback = 'font') {
  const s = cleanString(value, fallback)
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return s || fallback;
}

function generateFontKey(label = 'font') {
  return `user-${sanitizeFontKeyPart(label)}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function clonePreset(preset) {
  if (!preset || typeof preset !== 'object') return preset;
  return {
    ...preset,
    faces: Array.isArray(preset.faces) ? preset.faces.map(face => ({ ...face })) : [],
    literalOptions: Array.isArray(preset.literalOptions)
      ? preset.literalOptions.map(item => Array.isArray(item) ? [...item] : item)
      : undefined,
    literalCartoucheFamily: cleanString(preset.literalCartoucheFamily || preset.textFamily || preset.baseFamily || ''),
    settings: (preset.settings && typeof preset.settings === 'object' && !Array.isArray(preset.settings)) ? { ...preset.settings } : preset.settings,
    renderAdapterSettings: (preset.renderAdapterSettings && typeof preset.renderAdapterSettings === 'object' && !Array.isArray(preset.renderAdapterSettings)) ? { ...preset.renderAdapterSettings } : {},
  };
}

function recordToStoredShape(record, fallbackLiteralOptions = DEFAULT_TEXT_FONT_OPTIONS) {
  if (!record || typeof record !== 'object') return null;
  const baseFamily = cleanString(record.baseFamily || record.textFamily || record.familyName || record.label, 'UploadedFont');
  const normalizedLabel = cleanString(record.fontLabel || record.label || record.displayName || baseFamily || record.fontKey, baseFamily || 'UploadedFont');
  return {
    fontKey: cleanString(record.fontKey),
    fontLabel: normalizedLabel,
    label: normalizedLabel,
    baseFamily,
    companionFamily: cleanString(record.companionFamily || record.cartoucheFamily || `${baseFamily}-nanpa-linja-n`),
    literalCartoucheFamily: cleanString(
      record.literalCartoucheFamily || record.literalCartoucheFontFamily || record.textFamily || record.baseFamily || baseFamily,
      baseFamily
    ),
    literalCartoucheFilename: cleanString(record.literalCartoucheFilename || record.literalCartoucheFileName || ''),
    literalCartoucheUrl: cleanString(record.literalCartoucheUrl || record.literalCartoucheFontUrl || ''),
    literalCartoucheFormat: normalizeFormat(record.literalCartoucheFormat || inferFormatFromFilename(record.literalCartoucheFilename || record.literalCartoucheFileName || record.literalCartoucheUrl || record.literalCartoucheFontUrl || '')),
    literalCartoucheBlob: record.literalCartoucheBlob || record.literalCartoucheFontBlob || null,
    baseFilename: cleanString(record.baseFilename || record.baseFileName || 'uploaded-font.ttf'),
    companionFilename: cleanString(record.companionFilename || record.companionFileName || 'uploaded-font-nanpa-linja-n.ttf'),
    baseSample: cleanString(record.baseSample || record.textSample || DEFAULT_FONT_LOAD_SAMPLE, DEFAULT_FONT_LOAD_SAMPLE),
    companionSample: cleanString(record.companionSample || record.cartoucheSample || DEFAULT_FONT_LOAD_SAMPLE, DEFAULT_FONT_LOAD_SAMPLE),
    literalCartoucheSample: cleanString(record.literalCartoucheSample || DEFAULT_FONT_LOAD_SAMPLE, DEFAULT_FONT_LOAD_SAMPLE),
    baseFormat: normalizeFormat(record.baseFormat || record.textFormat || inferFormatFromFilename(record.baseFilename || '')),
    companionFormat: normalizeFormat(record.companionFormat || record.cartoucheFormat || inferFormatFromFilename(record.companionFilename || '')),
    baseBlob: record.baseBlob || null,
    companionBlob: record.companionBlob || null,
    literalOptions: Array.isArray(record.literalOptions) && record.literalOptions.length ? record.literalOptions : fallbackLiteralOptions,
    parserMode: cleanString(record.parserMode || DEFAULT_PARSER_MODE, DEFAULT_PARSER_MODE),
    renderAdapterId: cleanString(record.renderAdapterId || DEFAULT_RENDER_ADAPTER_ID, DEFAULT_RENDER_ADAPTER_ID),
    renderAdapterSettings: (record.renderAdapterSettings && typeof record.renderAdapterSettings === 'object' && !Array.isArray(record.renderAdapterSettings)) ? { ...record.renderAdapterSettings } : {},
    sourceType: cleanString(record.sourceType || 'indexeddb'),
    editable: record.editable !== false,
    createdAt: cleanString(record.createdAt || nowIso()),
    updatedAt: cleanString(record.updatedAt || nowIso()),
    support: record.support || null,
    settings: normalizeStoredSettings(record.settings || null),
    notes: record.notes || null,
    metadataSuffix: cleanString(record.metadataSuffix || '-nanpa-linja-n'),
  };
}

function openIndexedDb({ dbName = DEFAULT_DB_NAME, dbVersion = DEFAULT_DB_VERSION, storeName = DEFAULT_STORE } = {}) {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(dbName, dbVersion);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(storeName)) {
        const store = db.createObjectStore(storeName, { keyPath: 'fontKey' });
        store.createIndex('label', 'label', { unique: false });
        store.createIndex('updatedAt', 'updatedAt', { unique: false });
        store.createIndex('sourceType', 'sourceType', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Failed to open IndexedDB.'));
  });
}

function withStore(db, storeName, mode, fn) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    let done = false;
    tx.oncomplete = () => { if (!done) resolve(undefined); };
    tx.onerror = () => reject(tx.error || new Error('IndexedDB transaction failed.'));
    tx.onabort = () => reject(tx.error || new Error('IndexedDB transaction aborted.'));
    Promise.resolve(fn(store, tx)).then((value) => {
      done = true;
      resolve(value);
    }).catch(reject);
  });
}

function requestToPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('IndexedDB request failed.'));
  });
}

function dispatchFontsChanged(detail = {}) {
  try {
    window.dispatchEvent(new CustomEvent(DEFAULT_CHANGED_EVENT, { detail }));
  } catch {}
}

export function createSitelenFontPairController({
  registry,
  scriptSelect,
  textFontSelect,
  storageKeyPrefix = 'tp',
  defaultPresetKey = 'nasinNanpa',
  defaultTextFontOption = 'Patrick-Head-Font',
  fontLoadSample = DEFAULT_FONT_LOAD_SAMPLE,
  onInvalidate = null,
  indexedDbName = DEFAULT_DB_NAME,
  indexedDbVersion = DEFAULT_DB_VERSION,
  indexedDbStoreName = DEFAULT_STORE,
  changeEventName = DEFAULT_CHANGED_EVENT,
  dynamicLiteralOptions = null,
  getDynamicLiteralOptions = null,
  defaultDynamicLiteralOptions = null,
  dynamicTextFontOption = undefined,
  getDefaultDynamicTextFontOption = null,
  dynamicLiteralFace = null,
  getDynamicLiteralFace = null,
  mapDynamicPreset = null,
} = {}) {
  if (!registry || typeof registry !== 'object') {
    throw new Error('createSitelenFontPairController requires a registry object.');
  }

  const builtInRegistryMap = new Map(Object.entries(registry).map(([key, preset]) => [String(key), clonePreset(preset)]));
  if (!builtInRegistryMap.size) throw new Error('Font registry is empty.');

  const dynamicRegistryMap = new Map();
  const runtimePairMap = new Map();
  const objectUrlByKey = new Map();
  const controllerChangeEventName = changeEventName || DEFAULT_CHANGED_EVENT;

  const scriptEl = byIdOrElement(scriptSelect);
  const textEl = byIdOrElement(textFontSelect);
  const scriptStorageKey = `${storageKeyPrefix}ScriptPreset`;
  const textStorageKey = `${storageKeyPrefix}LiteralTextFont`;

  let activePresetKey = normalizeScriptPresetKey(defaultPresetKey);
  let fontsReadyPromise = null;
  let fontsReadyPx = null;
  let didWarmUp = false;
  let dbPromise = null;
  let lastHydratedAt = 0;

  const registeredFaces = new Set();
  const loadPromisesByFaceKey = new Map();

  function normalizeLiteralOptionsList(options) {
    if (!Array.isArray(options) || !options.length) return null;
    const out = [];
    for (const item of options) {
      if (Array.isArray(item)) {
        const value = String(item[0] ?? '').trim();
        if (!value) continue;
        out.push([value, String(item[1] ?? item[0] ?? '')]);
        continue;
      }
      if (item && typeof item === 'object') {
        const value = String(item.value ?? '').trim();
        if (!value) continue;
        out.push([value, String(item.label ?? item.value ?? '')]);
        continue;
      }
      const value = String(item ?? '').trim();
      if (!value) continue;
      out.push([value, value]);
    }
    return out.length ? out : null;
  }

  function resolveDynamicLiteralOptions(record = null, preset = null) {
    const fromHook = typeof getDynamicLiteralOptions === 'function'
      ? getDynamicLiteralOptions({ record, preset, controller: api })
      : null;
    const normalizedHook = normalizeLiteralOptionsList(fromHook);
    if (normalizedHook) return normalizedHook;
    const normalizedDirect = normalizeLiteralOptionsList(dynamicLiteralOptions);
    if (normalizedDirect) return normalizedDirect;
    const normalizedDefault = normalizeLiteralOptionsList(defaultDynamicLiteralOptions);
    if (normalizedDefault) return normalizedDefault;
    const normalizedRecord = normalizeLiteralOptionsList(record?.literalOptions);
    if (normalizedRecord) return normalizedRecord;
    return DEFAULT_TEXT_FONT_OPTIONS;
  }

  function resolveDefaultDynamicTextFontOption(record = null, preset = null, options = null) {
    const candidate = typeof getDefaultDynamicTextFontOption === 'function'
      ? getDefaultDynamicTextFontOption({ record, preset, options, controller: api })
      : (dynamicTextFontOption ?? undefined);
    const normalizedOptions = normalizeLiteralOptionsList(options) || [];
    const allowed = new Set(normalizedOptions.map(([value]) => value));
    const raw = String(candidate ?? '').trim();
    if (raw && allowed.has(raw)) return raw;
    const fallback = String(defaultTextFontOption ?? '').trim();
    if (fallback && allowed.has(fallback)) return fallback;
    return normalizedOptions.length ? normalizedOptions[0][0] : fallback;
  }

  function resolveDynamicLiteralFace(record = null, preset = null) {
    const fromHook = typeof getDynamicLiteralFace === 'function'
      ? getDynamicLiteralFace({ record, preset, controller: api })
      : null;
    const chosen = (fromHook && typeof fromHook === 'object') ? fromHook : dynamicLiteralFace;
    if (!chosen || typeof chosen !== 'object') return null;
    const family = cleanString(chosen.family);
    const url = cleanString(chosen.url);
    if (!family || !url) return null;
    return {
      family,
      url,
      format: normalizeFormat(chosen.format || inferFormatFromFilename(url) || 'truetype'),
      sample: cleanString(chosen.sample || 'Hello', 'Hello'),
      descriptors: chosen.descriptors || {},
    };
  }

  function applyDynamicPresetDecorators(preset, record = null) {
    const literalOptions = resolveDynamicLiteralOptions(record, preset);
    const basePreset = clonePreset({ ...preset, literalOptions });
    const decorated = typeof mapDynamicPreset === 'function'
      ? (mapDynamicPreset({ record, preset: clonePreset(basePreset), controller: api }) || basePreset)
      : basePreset;
    const normalizedDecorated = clonePreset(decorated);
    normalizedDecorated.literalOptions = resolveDynamicLiteralOptions(record, normalizedDecorated);
    normalizedDecorated.defaultTextFontOption = resolveDefaultDynamicTextFontOption(record, normalizedDecorated, normalizedDecorated.literalOptions);
    return normalizedDecorated;
  }

  function invalidate() {
    fontsReadyPromise = null;
    fontsReadyPx = null;
    didWarmUp = false;
    if (typeof onInvalidate === 'function') onInvalidate();
  }

  function registryMap() {
    const merged = new Map(builtInRegistryMap);
    for (const [key, preset] of dynamicRegistryMap.entries()) merged.set(key, preset);
    return merged;
  }

  function presetEntries() {
    return Array.from(registryMap().entries());
  }

  function hasPresetKey(key) {
    return registryMap().has(String(key || '').trim());
  }

  function normalizeScriptPresetKey(key) {
    const raw = String(key || '').trim();
    const merged = registryMap();
    return merged.has(raw) ? raw : (merged.has(defaultPresetKey) ? defaultPresetKey : presetEntries()[0][0]);
  }

  function getPresetByKey(key) {
    return registryMap().get(normalizeScriptPresetKey(key));
  }

  function getActivePreset() {
    return getPresetByKey(activePresetKey) || presetEntries()[0][1];
  }

  function getTextFontOptionsForPreset(preset = getActivePreset()) {
    const opts = Array.isArray(preset?.literalOptions) && preset.literalOptions.length
      ? preset.literalOptions
      : DEFAULT_TEXT_FONT_OPTIONS;
    return opts.map(item => Array.isArray(item) ? item : [item?.value, item?.label]);
  }

  function normalizeTextFontOptionKey(key, preset = getActivePreset()) {
    const raw = String(key ?? '').trim();
    const options = getTextFontOptionsForPreset(preset);
    if (options.some(([value]) => value === raw)) return raw;
    const presetDefault = String(preset?.defaultTextFontOption ?? '').trim();
    if (presetDefault && options.some(([value]) => value === presetDefault)) return presetDefault;
    return options.some(([value]) => value === defaultTextFontOption)
      ? defaultTextFontOption
      : (options[0]?.[0] ?? defaultTextFontOption);
  }

  function saveScriptPresetToStorage(key) {
    try { localStorage.setItem(scriptStorageKey, normalizeScriptPresetKey(key)); } catch {}
  }

  function loadScriptPresetFromStorage() {
    try { return normalizeScriptPresetKey(localStorage.getItem(scriptStorageKey) || defaultPresetKey); }
    catch { return normalizeScriptPresetKey(defaultPresetKey); }
  }

  function saveTextFontOptionToStorage(key) {
    try { localStorage.setItem(textStorageKey, normalizeTextFontOptionKey(key)); } catch {}
  }

  function loadTextFontOptionFromStorage(preset = getActivePreset()) {
    try { return normalizeTextFontOptionKey(localStorage.getItem(textStorageKey) || defaultTextFontOption, preset); }
    catch { return normalizeTextFontOptionKey(defaultTextFontOption, preset); }
  }

  function populateScriptSelectOptions() {
    if (!scriptEl) return;
    const current = normalizeScriptPresetKey(scriptEl.value || activePresetKey);
    scriptEl.innerHTML = '';
    for (const [key, preset] of presetEntries()) {
      const opt = document.createElement('option');
      opt.value = key;
      opt.textContent = String(preset?.label || key);
      scriptEl.appendChild(opt);
    }
    scriptEl.value = current;
  }

  function populateTextSelectOptions() {
    if (!textEl) return;
    const preset = getActivePreset();
    const current = normalizeTextFontOptionKey(textEl.value || loadTextFontOptionFromStorage(preset), preset);
    textEl.innerHTML = '';
    for (const [value, label] of getTextFontOptionsForPreset(preset)) {
      const opt = document.createElement('option');
      opt.value = value;
      opt.textContent = String(label || value);
      textEl.appendChild(opt);
    }
    textEl.value = current;
  }

  function getSelectedTextFontOptionKey() {
    return normalizeTextFontOptionKey(textEl?.value || loadTextFontOptionFromStorage(), getActivePreset());
  }

  function resolveLiteralFontFamily(optionKey = getSelectedTextFontOptionKey(), preset = getActivePreset()) {
    const normalized = normalizeTextFontOptionKey(optionKey, preset);
    if (normalized === TEXT_FONT_OPTION_SITELEN) return String(preset?.textFamily || '');
    if (normalized === TEXT_FONT_OPTION_NANPA_LINJA_N) return String(preset?.cartoucheFamily || '');
    return normalized;
  }

  function resolveLiteralCartoucheFontFamily(preset = getActivePreset()) {
    return cleanString(preset?.literalCartoucheFamily || preset?.textFamily || preset?.baseFamily || '');
  }

  function buildFontRoles({ textFontOptionKey = getSelectedTextFontOptionKey(), preset = getActivePreset() } = {}) {
    return {
      word: preset.textFamily,
      text: preset.textFamily,
      cartouche: preset.textFamily,
      number: preset.cartoucheFamily,
      date: preset.cartoucheFamily,
      time: preset.cartoucheFamily,
      literal: resolveLiteralFontFamily(textFontOptionKey, preset),
      literalCartouche: resolveLiteralCartoucheFontFamily(preset),
    };
  }

  function getPresetTallySettings(preset = getActivePreset()) {
    return normalizeStoredSettings(preset?.settings || preset?.__pairRecord?.settings || null);
  }

  function buildRendererParserConfig({ preset = getActivePreset(), baseParser = {} } = {}) {
    const tally = getPresetTallySettings(preset);
    return {
      ...(baseParser || {}),
      cartoucheCommaTallyMarks: tally.cartoucheCommaTallyMarks !== false,
      cartoucheTallyMode: normalizeCartoucheTallyMode(tally.cartoucheTallyMode),
    };
  }

  function buildRendererConfig({ textFontOptionKey = getSelectedTextFontOptionKey(), preset = getActivePreset(), baseConfig = {} } = {}) {
    const baseFonts = (baseConfig || {}).fonts || {};
    const presetRenderAdapterId = cleanString(
      preset?.renderAdapterId || preset?.__pairRecord?.renderAdapterId || DEFAULT_RENDER_ADAPTER_ID,
      DEFAULT_RENDER_ADAPTER_ID
    );
    const presetRenderAdapterSettings = {
      ...((preset?.__pairRecord?.renderAdapterSettings && typeof preset.__pairRecord.renderAdapterSettings === 'object') ? preset.__pairRecord.renderAdapterSettings : {}),
      ...((preset?.renderAdapterSettings && typeof preset.renderAdapterSettings === 'object') ? preset.renderAdapterSettings : {})
    };
    return {
      ...(baseConfig || {}),
      fonts: {
        ...baseFonts,
        renderAdapterId: cleanString(baseFonts.renderAdapterId || presetRenderAdapterId, DEFAULT_RENDER_ADAPTER_ID),
        renderAdapterSettings: {
          ...presetRenderAdapterSettings,
          ...((baseFonts.renderAdapterSettings && typeof baseFonts.renderAdapterSettings === 'object') ? baseFonts.renderAdapterSettings : {})
        },
        roles: {
          ...buildFontRoles({ textFontOptionKey, preset }),
          ...(baseFonts.roles || {}),
        },
      },
      parser: buildRendererParserConfig({ preset, baseParser: (baseConfig || {}).parser || {} }),
    };
  }

  function uniqueConfiguredFontFamilies(args = {}) {
    return uniq(Object.values(buildFontRoles(args)));
  }

  function getAllFaceRecords() {
    const out = [];
    for (const [, preset] of presetEntries()) {
      for (const face of (preset?.faces || [])) out.push(face);
    }
    return out;
  }

  function findFaceByFamily(family) {
    const fam = String(family || '').trim();
    if (!fam) return null;
    for (const face of getAllFaceRecords()) {
      if (String(face?.family || '').trim() === fam) return face;
    }
    return null;
  }

  async function ensureFaceLoaded(face) {
    if (!face?.family || !face?.url || !document.fonts) return;
    const family = String(face.family).trim();
    const url = String(face.url).trim();
    const faceKey = `${family}::${url}`;
    if (registeredFaces.has(faceKey)) return;
    if (loadPromisesByFaceKey.has(faceKey)) {
      await loadPromisesByFaceKey.get(faceKey);
      return;
    }

    const loader = (async () => {
      const source = `url("${url.replace(/"/g, '\\"')}") format("${normalizeFormat(face.format)}")`;
      const fontFace = new FontFace(family, source, face.descriptors || {});
      await fontFace.load();
      document.fonts.add(fontFace);
      registeredFaces.add(faceKey);
    })();

    loadPromisesByFaceKey.set(faceKey, loader);
    try {
      await loader;
    } finally {
      loadPromisesByFaceKey.delete(faceKey);
    }
  }

  async function ensureFamiliesLoaded(fontPx = 56, families = uniqueConfiguredFontFamilies()) {
    if (!document.fonts || typeof document.fonts.load !== 'function') return;

    const px = Math.max(8, Number(fontPx || 56));
    const uniqueFamilies = uniq(families);
    const faces = uniqueFamilies.map(family => ({
      family,
      face: findFaceByFamily(family)
    }));

    const missingFaceFamilies = faces
      .filter(item => !item.face)
      .map(item => item.family)
      .filter(family => {
        // Browser/system fonts are expected to have no project FontFace record.
        const s = String(family || '').toLowerCase();
        return !["arial", "times new roman", "courier new", "system-ui"].includes(s);
      });

    if (missingFaceFamilies.length) {
      console.warn("[fonts] No face record found for configured font families:", missingFaceFamilies);
    }

    const neededFaces = uniq(faces.map(item => item.face).filter(Boolean));
    await Promise.all(neededFaces.map(ensureFaceLoaded));
    await document.fonts.ready;

    await Promise.all(uniqueFamilies.map(family =>
      document.fonts.load(`${px}px ${quotedFontFamily(family)}`, fontLoadSample)
    ));

    await document.fonts.ready;
  }

  function warmUpCanvasFonts(fontPx = 56, families = uniqueConfiguredFontFamilies()) {
    const px = Math.max(8, Number(fontPx || 56));
    const c = document.createElement('canvas');
    c.width = 4;
    c.height = 4;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.textBaseline = 'alphabetic';
    for (const family of families) {
      const face = findFaceByFamily(family);
      const sample = String(face?.sample || fontLoadSample || 'A');
      ctx.font = `${px}px ${quotedFontFamily(family)}`;
      ctx.fillText(sample, 0, 3);
    }
  }

  async function fontsReadyForPx(fontPx = 56) {
    const px = Math.max(8, Number(fontPx || 56));
    if (!fontsReadyPromise || fontsReadyPx !== px) {
      fontsReadyPx = px;
      fontsReadyPromise = (async () => {
        await ensureFamiliesLoaded(px);
        await new Promise(resolve => requestAnimationFrame(resolve));
        await new Promise(resolve => requestAnimationFrame(resolve));
      })();
    }
    return fontsReadyPromise;
  }

  async function waitForConfiguredFonts(fontPx = 56) {
    await fontsReadyForPx(fontPx);
  }

  function warmUpCanvasFontsOnce(fontPx = 56) {
    if (didWarmUp) return;
    didWarmUp = true;
    warmUpCanvasFonts(fontPx);
  }

  function setActivePreset(key, { persist = true } = {}) {
    activePresetKey = normalizeScriptPresetKey(key);
    if (scriptEl) scriptEl.value = activePresetKey;
    populateTextSelectOptions();
    if (persist) saveScriptPresetToStorage(activePresetKey);
    invalidate();
    return activePresetKey;
  }

  function setSelectedTextFontOption(key, { persist = true } = {}) {
    const normalized = normalizeTextFontOptionKey(key, getActivePreset());
    if (textEl) textEl.value = normalized;
    if (persist) saveTextFontOptionToStorage(normalized);
    invalidate();
    return normalized;
  }

  function applyStoredSelections() {
    populateScriptSelectOptions();
    setActivePreset(loadScriptPresetFromStorage(), { persist: false });
    populateTextSelectOptions();
    setSelectedTextFontOption(loadTextFontOptionFromStorage(), { persist: false });
  }

  function wireControls({ onChange } = {}) {
    if (scriptEl) {
      scriptEl.addEventListener('change', async () => {
        setActivePreset(scriptEl.value);
        if (typeof onChange === 'function') await onChange({ type: 'scriptPreset', controller: api });
      });
    }
    if (textEl) {
      textEl.addEventListener('change', async () => {
        setSelectedTextFontOption(textEl.value);
        if (typeof onChange === 'function') await onChange({ type: 'textFont', controller: api });
      });
    }
  }

  function resetFontLoadState() {
    invalidate();
  }

  function makeBlobUrl(blob, ext = '') {
    const type = ext === 'woff2' ? 'font/woff2'
      : ext === 'woff' ? 'font/woff'
      : ext === 'otf' ? 'font/otf'
      : 'font/ttf';
    const sourceBlob = blob instanceof Blob ? blob : new Blob([blob], { type });
    return URL.createObjectURL(sourceBlob);
  }

  function rememberObjectUrl(key, url) {
    if (!objectUrlByKey.has(key)) objectUrlByKey.set(key, new Set());
    objectUrlByKey.get(key).add(url);
  }

  function revokeObjectUrlsForKey(key) {
    const urls = objectUrlByKey.get(key);
    if (!urls) return;
    for (const url of urls) {
      try { URL.revokeObjectURL(url); } catch {}
    }
    objectUrlByKey.delete(key);
  }

  function buildDynamicPresetFromStoredRecord(record, { sourceType = record?.sourceType || 'indexeddb' } = {}) {
    const rec = recordToStoredShape(record, resolveDynamicLiteralOptions(record, null));
    if (!rec?.fontKey || !rec?.baseBlob || !rec?.companionBlob) {
      throw new Error('Stored font pair record is missing required blobs.');
    }
    const presetKey = rec.fontKey;
    revokeObjectUrlsForKey(presetKey);
    const baseExt = fileExtFromName(rec.baseFilename) || (rec.baseFormat === 'opentype' ? 'otf' : 'ttf');
    const companionExt = fileExtFromName(rec.companionFilename) || (rec.companionFormat === 'opentype' ? 'otf' : 'ttf');
    const literalCartoucheExt = fileExtFromName(rec.literalCartoucheFilename) || (rec.literalCartoucheFormat === 'opentype' ? 'otf' : 'ttf');
    const baseUrl = makeBlobUrl(rec.baseBlob, baseExt);
    const companionUrl = makeBlobUrl(rec.companionBlob, companionExt);
    const literalCartoucheObjectUrl = rec.literalCartoucheBlob
      ? makeBlobUrl(rec.literalCartoucheBlob, literalCartoucheExt)
      : '';
    rememberObjectUrl(presetKey, baseUrl);
    rememberObjectUrl(presetKey, companionUrl);
    if (literalCartoucheObjectUrl) rememberObjectUrl(presetKey, literalCartoucheObjectUrl);

    const faces = [
      {
        family: rec.baseFamily,
        url: baseUrl,
        format: rec.baseFormat,
        sample: rec.baseSample || fontLoadSample,
      },
      {
        family: rec.companionFamily,
        url: companionUrl,
        format: rec.companionFormat,
        sample: rec.companionSample || fontLoadSample,
      },
    ];

    if (literalCartoucheObjectUrl && rec.literalCartoucheFamily) {
      faces.push({
        family: rec.literalCartoucheFamily,
        url: literalCartoucheObjectUrl,
        format: rec.literalCartoucheFormat,
        sample: rec.literalCartoucheSample || fontLoadSample,
      });
    }

    const literalFace = resolveDynamicLiteralFace(rec, null);
    if (literalFace?.family && literalFace?.url) {
      faces.push(literalFace);
    }

    const preset = applyDynamicPresetDecorators({
      key: presetKey,
      fontLabel: rec.label,
      label: rec.label,
      source: sourceType,
      sourceType,
      editable: rec.editable !== false,
      dynamic: true,
      fontKey: rec.fontKey,
      textFamily: rec.baseFamily,
      cartoucheFamily: rec.companionFamily,
      literalCartoucheFamily: rec.literalCartoucheFamily || rec.baseFamily,
      parserMode: rec.parserMode,
      renderAdapterId: rec.renderAdapterId || DEFAULT_RENDER_ADAPTER_ID,
      renderAdapterSettings: { ...(rec.renderAdapterSettings || {}) },
      metadataSuffix: rec.metadataSuffix,
      literalOptions: rec.literalOptions,
      support: rec.support || null,
      settings: rec.settings || null,
      faces,
      __pairRecord: rec,
    }, rec);
    runtimePairMap.set(presetKey, rec);
    return preset;
  }

  function registerDynamicPreset(key, preset, { silent = false } = {}) {
    const normalizedKey = String(key || '').trim();
    if (!normalizedKey) throw new Error('Dynamic preset key is required.');
    const pairRecord = preset?.__pairRecord || runtimePairMap.get(normalizedKey) || null;
    dynamicRegistryMap.set(normalizedKey, applyDynamicPresetDecorators({ ...preset, key: normalizedKey }, pairRecord));
    invalidate();
    populateScriptSelectOptions();
    populateTextSelectOptions();
    if (!silent) dispatchFontsChanged({ key: normalizedKey, controller: 'sitelen-font-pair-controller', type: 'register', eventName: controllerChangeEventName });
    if (controllerChangeEventName && controllerChangeEventName !== DEFAULT_CHANGED_EVENT) {
      try { window.dispatchEvent(new CustomEvent(controllerChangeEventName, { detail: { key: normalizedKey, controller: 'sitelen-font-pair-controller', type: 'register' } })); } catch {}
    }
    return normalizedKey;
  }

  async function getDb() {
    if (typeof indexedDB === 'undefined' || !indexedDB) {
      throw new Error('IndexedDB is not available in this environment.');
    }
    if (!dbPromise) {
      dbPromise = openIndexedDb({ dbName: indexedDbName, dbVersion: indexedDbVersion, storeName: indexedDbStoreName });
    }
    return dbPromise;
  }

  async function listStoredFontPairs() {
    try {
      const db = await getDb();
      return withStore(db, indexedDbStoreName, 'readonly', async (store) => {
        const records = await requestToPromise(store.getAll());
        return Array.isArray(records)
          ? records.map(recordToStoredShape).filter(Boolean).sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')))
          : [];
      });
    } catch {
      return [];
    }
  }

  async function getStoredFontPair(fontKey) {
    const key = cleanString(fontKey);
    if (!key) return null;
    try {
      const db = await getDb();
      return withStore(db, indexedDbStoreName, 'readonly', async (store) => {
        const rec = await requestToPromise(store.get(key));
        return rec ? recordToStoredShape(rec) : null;
      });
    } catch {
      return null;
    }
  }

  async function saveFontPairToIndexedDb(record) {
    const stored = recordToStoredShape(record);
    stored.fontLabel = stored.label;
    if (!stored?.fontKey) throw new Error('saveFontPairToIndexedDb requires fontKey.');
    if (!stored.baseBlob || !stored.companionBlob) throw new Error('Both baseBlob and companionBlob are required.');
    stored.updatedAt = nowIso();
    if (!stored.createdAt) stored.createdAt = stored.updatedAt;
    const db = await getDb();
    await withStore(db, indexedDbStoreName, 'readwrite', async (store) => {
      await requestToPromise(store.put(stored));
    });
    const preset = buildDynamicPresetFromStoredRecord(stored, { sourceType: 'indexeddb' });
    registerDynamicPreset(stored.fontKey, preset, { silent: true });
    dispatchFontsChanged({ key: stored.fontKey, controller: 'sitelen-font-pair-controller', type: 'save', eventName: controllerChangeEventName });
    if (controllerChangeEventName && controllerChangeEventName !== DEFAULT_CHANGED_EVENT) {
      try { window.dispatchEvent(new CustomEvent(controllerChangeEventName, { detail: { key: stored.fontKey, controller: 'sitelen-font-pair-controller', type: 'save' } })); } catch {}
    }
    return { fontKey: stored.fontKey, preset, record: stored };
  }

  async function syncPreloadedFontPairsFromManifest({
    manifestUrl = "./fonts/preloaded-font-pairs.manifest.json",
    dbName = DEFAULT_DB_NAME,
    dbVersion = DEFAULT_DB_VERSION,
    storeName = DEFAULT_STORE,
    force = false,
    onlyIfExisting = true
  } = {}) {
    if (typeof indexedDB === "undefined" || !indexedDB) {
      return { updated: 0, skipped: 0, reason: "indexeddb-unavailable" };
    }

    let manifest;
    try {
      const res = await fetch(manifestUrl, { cache: "no-store" });
      if (!res.ok) {
        console.warn("[preloaded-fonts] manifest not found:", manifestUrl, res.status);
        return { updated: 0, skipped: 0, reason: "manifest-not-found" };
      }
      manifest = await res.json();
    } catch (err) {
      console.warn("[preloaded-fonts] manifest load failed:", err);
      return { updated: 0, skipped: 0, reason: "manifest-load-failed" };
    }

    const pairs = Array.isArray(manifest?.pairs) ? manifest.pairs : [];
    if (!pairs.length) return { updated: 0, skipped: 0, reason: "empty-manifest" };

    const manifestSchema = normalizeManifestSchema(manifest?.schema);
    const migrationConfig = (manifest?.migration && typeof manifest.migration === "object")
      ? manifest.migration
      : {};
    const preserveFontKeys = new Set(normalizeManifestFontKeyList(migrationConfig.preserveFontKeys));
    const preloadFontKeys = normalizeManifestFontKeyList(migrationConfig.preloadFontKeys);
    const appliedManifestSchema = await readAppliedPreloadedManifestSchema(dbName, storeName);
    const shouldRunDestructiveMigration =
      migrationConfig.clearIndexedDbPairsOnUpgrade === true &&
      manifestSchema > appliedManifestSchema;

    const db = await openIndexedDb({
      dbName,
      dbVersion,
      storeName
    });

    let updated = 0;
    let skipped = 0;
    let migration = {
      applied: false,
      manifestSchema,
      previousAppliedSchema: appliedManifestSchema,
      deleted: 0,
      preserved: 0,
      installed: 0,
      parserModesUpdated: 0
    };
    const migrationHandledKeys = new Set();

    async function getRawStoredRecords() {
      return await withStore(db, storeName, "readonly", async (store) => {
        const records = await requestToPromise(store.getAll());
        return Array.isArray(records) ? records : [];
      });
    }

    async function replaceRecordsAtomically(existingRecords, recordsToInstall, preservedParserModes) {
      return await new Promise((resolve, reject) => {
        let settled = false;
        const tx = db.transaction(storeName, "readwrite");
        const store = tx.objectStore(storeName);

        tx.oncomplete = () => {
          if (settled) return;
          settled = true;
          resolve();
        };
        tx.onerror = () => {
          if (settled) return;
          settled = true;
          reject(tx.error || new Error("Manifest schema migration transaction failed."));
        };
        tx.onabort = () => {
          if (settled) return;
          settled = true;
          reject(tx.error || new Error("Manifest schema migration transaction was aborted."));
        };

        try {
          for (const record of existingRecords) {
            const key = cleanString(record?.fontKey);
            if (!key) continue;
            if (!preserveFontKeys.has(key)) {
              store.delete(key);
              continue;
            }

            // The protected predefined records keep every stored field and Blob
            // exactly as-is, except parserMode, which follows the current
            // manifest because parser capabilities can change independently of
            // the font binaries and their revision fields.
            const manifestParserMode = cleanString(preservedParserModes?.get(key));
            if (manifestParserMode && cleanString(record?.parserMode) !== manifestParserMode) {
              store.put({ ...record, parserMode: manifestParserMode });
            }
          }
          for (const record of recordsToInstall) store.put(record);
        } catch (err) {
          try { tx.abort(); } catch {}
          if (!settled) {
            settled = true;
            reject(err);
          }
        }
      });
    }

    const fetchedBuffersByUrl = new Map();
    async function fetchFontBuffer(url, description) {
      const normalizedUrl = cleanString(url);
      if (!normalizedUrl) throw new Error(`Missing URL for ${description}.`);
      if (!fetchedBuffersByUrl.has(normalizedUrl)) {
        fetchedBuffersByUrl.set(normalizedUrl, (async () => {
          const response = await fetch(normalizedUrl, { cache: "no-store" });
          if (!response.ok) throw new Error(`Failed to fetch ${description} ${normalizedUrl}: ${response.status}`);
          return await response.arrayBuffer();
        })());
      }
      return await fetchedBuffersByUrl.get(normalizedUrl);
    }

    async function buildFreshManifestRecord(pair) {
      const fontKey = cleanString(pair?.fontKey);
      const rev = cleanString(pair?.rev);
      const baseUrl = cleanString(pair?.baseUrl);
      const companionUrl = cleanString(pair?.companionUrl);
      const literalCartoucheUrl = cleanString(pair?.literalCartoucheUrl || pair?.literalCartoucheFontUrl);
      if (!fontKey || !rev || !baseUrl || !companionUrl) {
        throw new Error(`Manifest migration pair is incomplete: ${fontKey || "<missing fontKey>"}`);
      }

      const baseFilename = cleanString(pair.baseFilename || baseUrl.split("/").pop() || "preloaded-base.ttf");
      const companionFilename = cleanString(pair.companionFilename || companionUrl.split("/").pop() || "preloaded-companion.ttf");
      const literalCartoucheFilename = cleanString(
        pair.literalCartoucheFilename ||
        pair.literalCartoucheFileName ||
        (literalCartoucheUrl ? literalCartoucheUrl.split("/").pop() : "") ||
        ""
      );

      const [baseBuffer, companionBuffer, literalCartoucheBuffer] = await Promise.all([
        fetchFontBuffer(baseUrl, `${fontKey} base font`),
        fetchFontBuffer(companionUrl, `${fontKey} companion font`),
        literalCartoucheUrl
          ? fetchFontBuffer(literalCartoucheUrl, `${fontKey} literal-cartouche font`)
          : Promise.resolve(null)
      ]);

      const baseFormat = normalizeFormat(pair.baseFormat || inferFormatFromFilename(baseFilename));
      const companionFormat = normalizeFormat(pair.companionFormat || inferFormatFromFilename(companionFilename));
      const literalCartoucheFormat = normalizeFormat(pair.literalCartoucheFormat || inferFormatFromFilename(literalCartoucheFilename || literalCartoucheUrl));
      const timestamp = nowIso();
      const settingsRev = cleanString(pair.settingsRev || rev);
      const fontRev = cleanString(pair.fontRev || rev);
      const stored = recordToStoredShape({
        fontKey,
        fontLabel: cleanString(pair.label || fontKey, fontKey),
        label: cleanString(pair.label || fontKey, fontKey),
        baseFamily: cleanString(pair.baseFamily || pair.textFamily || fontKey, fontKey),
        companionFamily: cleanString(pair.companionFamily || pair.cartoucheFamily || `${fontKey}-nanpa-linja-n`, `${fontKey}-nanpa-linja-n`),
        literalCartoucheFamily: cleanString(
          pair.literalCartoucheFamily || pair.literalCartoucheFontFamily || pair.baseFamily || pair.textFamily || fontKey,
          cleanString(pair.baseFamily || pair.textFamily || fontKey, fontKey)
        ),
        baseFilename,
        companionFilename,
        literalCartoucheFilename,
        literalCartoucheUrl,
        baseSample: cleanString(pair.baseSample || DEFAULT_FONT_LOAD_SAMPLE, DEFAULT_FONT_LOAD_SAMPLE),
        companionSample: cleanString(pair.companionSample || DEFAULT_FONT_LOAD_SAMPLE, DEFAULT_FONT_LOAD_SAMPLE),
        literalCartoucheSample: cleanString(pair.literalCartoucheSample || DEFAULT_FONT_LOAD_SAMPLE, DEFAULT_FONT_LOAD_SAMPLE),
        baseFormat,
        companionFormat,
        literalCartoucheFormat,
        baseBlob: new Blob([baseBuffer], { type: baseFormat === "opentype" ? "font/otf" : "font/ttf" }),
        companionBlob: new Blob([companionBuffer], { type: companionFormat === "opentype" ? "font/otf" : "font/ttf" }),
        literalCartoucheBlob: literalCartoucheBuffer
          ? new Blob([literalCartoucheBuffer], { type: literalCartoucheFormat === "opentype" ? "font/otf" : "font/ttf" })
          : null,
        parserMode: cleanString(pair.parserMode || DEFAULT_PARSER_MODE, DEFAULT_PARSER_MODE),
        renderAdapterId: cleanString(pair.renderAdapterId || DEFAULT_RENDER_ADAPTER_ID, DEFAULT_RENDER_ADAPTER_ID),
        renderAdapterSettings: (pair.renderAdapterSettings && typeof pair.renderAdapterSettings === "object" && !Array.isArray(pair.renderAdapterSettings))
          ? { ...pair.renderAdapterSettings }
          : {},
        sourceType: "indexeddb",
        editable: true,
        settings: pair.settings || null,
        support: pair.support || null,
        metadataSuffix: cleanString(pair.metadataSuffix || "-nanpa-linja-n"),
        manifestRev: rev,
        preloadedRev: rev,
        fontRev,
        preloadedFontRev: fontRev,
        settingsRev,
        preloadedSettingsRev: settingsRev,
        preloadedManifestUrl: manifestUrl,
        updatedAt: timestamp,
        createdAt: timestamp
      });

      stored.manifestRev = rev;
      stored.preloadedRev = rev;
      stored.fontRev = fontRev;
      stored.preloadedFontRev = fontRev;
      stored.settingsRev = settingsRev;
      stored.preloadedSettingsRev = settingsRev;
      stored.preloadedManifestUrl = manifestUrl;
      stored.preloadedManifestSchema = manifestSchema;
      return stored;
    }

    try {
      if (shouldRunDestructiveMigration) {
        if (!preserveFontKeys.size || !preloadFontKeys.length) {
          throw new Error("Manifest schema migration requires preserveFontKeys and preloadFontKeys.");
        }
        const overlappingKeys = preloadFontKeys.filter(fontKey => preserveFontKeys.has(fontKey));
        if (overlappingKeys.length) {
          throw new Error(`Manifest schema migration keys cannot be both preserved and preloaded: ${overlappingKeys.join(", ")}`);
        }

        const pairsByKey = new Map(pairs.map(pair => [cleanString(pair?.fontKey), pair]));
        const migrationPairs = preloadFontKeys.map(fontKey => {
          const pair = pairsByKey.get(fontKey);
          if (!pair) throw new Error(`Manifest schema migration preload key is missing from pairs: ${fontKey}`);
          return pair;
        });
        const preservedParserModes = new Map(Array.from(preserveFontKeys, fontKey => {
          const pair = pairsByKey.get(fontKey);
          if (!pair) throw new Error(`Manifest schema migration preserved key is missing from pairs: ${fontKey}`);
          return [fontKey, cleanString(pair.parserMode || DEFAULT_PARSER_MODE, DEFAULT_PARSER_MODE)];
        }));

        // Fetch and validate every required asset before deleting anything.
        const recordsToInstall = await Promise.all(migrationPairs.map(buildFreshManifestRecord));
        const existingRecords = await getRawStoredRecords();
        const preservedExistingKeys = new Set(
          existingRecords
            .map(record => cleanString(record?.fontKey))
            .filter(fontKey => fontKey && preserveFontKeys.has(fontKey))
        );
        const parserModesUpdated = existingRecords.filter(record => {
          const fontKey = cleanString(record?.fontKey);
          const manifestParserMode = cleanString(preservedParserModes.get(fontKey));
          return fontKey && preserveFontKeys.has(fontKey) && manifestParserMode && cleanString(record?.parserMode) !== manifestParserMode;
        }).length;
        const deletedKeys = existingRecords
          .map(record => cleanString(record?.fontKey))
          .filter(fontKey => fontKey && !preserveFontKeys.has(fontKey));

        await replaceRecordsAtomically(existingRecords, recordsToInstall, preservedParserModes);

        if (!(await writeAppliedPreloadedManifestSchema(dbName, storeName, manifestSchema))) {
          throw new Error("Manifest schema migration completed, but the applied schema marker could not be saved.");
        }

        for (const key of deletedKeys) {
          runtimePairMap.delete(key);
          dynamicRegistryMap.delete(key);
          revokeObjectUrlsForKey(key);
        }
        for (const key of preservedExistingKeys) migrationHandledKeys.add(key);
        for (const key of preloadFontKeys) migrationHandledKeys.add(key);

        updated += recordsToInstall.length + parserModesUpdated;
        migration = {
          applied: true,
          manifestSchema,
          previousAppliedSchema: appliedManifestSchema,
          deleted: deletedKeys.length,
          preserved: preservedExistingKeys.size,
          installed: recordsToInstall.length,
          parserModesUpdated
        };
        invalidate();
        populateScriptSelectOptions();
        populateTextSelectOptions();
      }

      for (const pair of pairs) {
        const fontKey = cleanString(pair.fontKey);
        const rev = cleanString(pair.rev);
        const baseUrl = cleanString(pair.baseUrl);
        const companionUrl = cleanString(pair.companionUrl);
        const literalCartoucheUrl = cleanString(pair.literalCartoucheUrl || pair.literalCartoucheFontUrl);

        if (!fontKey || !rev || !baseUrl || !companionUrl) {
          skipped++;
          continue;
        }

        // The destructive migration has already handled these exact records.
        // In particular, preserved records are not rewritten during migration.
        if (migrationHandledKeys.has(fontKey)) {
          skipped++;
          continue;
        }

        const existing = await withStore(db, storeName, "readonly", async (store) => {
          return await requestToPromise(store.get(fontKey));
        });

        // This avoids installing every built-in into IndexedDB automatically.
        // It only updates records that are already present.
        if (onlyIfExisting && !existing) {
          skipped++;
          continue;
        }

        const settingsRev = cleanString(pair.settingsRev || rev);
        const fontRev = cleanString(pair.fontRev || rev);

        const existingManifestRev = String(existing?.manifestRev || existing?.preloadedRev || "");
        const existingFontRev = String(existing?.fontRev || existing?.preloadedFontRev || existingManifestRev);
        const existingSettingsRev = String(existing?.settingsRev || existing?.preloadedSettingsRev || existingManifestRev);

        const needsLiteralCartoucheFontUpdate = !!literalCartoucheUrl && (
          !existing?.literalCartoucheBlob ||
          String(existing?.literalCartoucheUrl || existing?.literalCartoucheFontUrl || '') !== literalCartoucheUrl
        );
        const needsFontUpdate = !existing || existingFontRev !== fontRev || !existing?.baseBlob || !existing?.companionBlob || needsLiteralCartoucheFontUpdate;
        const manifestParserMode = cleanString(pair.parserMode || existing?.parserMode || DEFAULT_PARSER_MODE, DEFAULT_PARSER_MODE);
        const manifestRenderAdapterId = cleanString(pair.renderAdapterId || existing?.renderAdapterId || DEFAULT_RENDER_ADAPTER_ID, DEFAULT_RENDER_ADAPTER_ID);
        const manifestRenderAdapterSettings = (pair.renderAdapterSettings && typeof pair.renderAdapterSettings === 'object' && !Array.isArray(pair.renderAdapterSettings))
          ? pair.renderAdapterSettings
          : ((existing?.renderAdapterSettings && typeof existing.renderAdapterSettings === 'object') ? existing.renderAdapterSettings : {});
        const existingRenderAdapterSettings = (existing?.renderAdapterSettings && typeof existing.renderAdapterSettings === 'object') ? existing.renderAdapterSettings : {};
        const adapterSettingsChanged = JSON.stringify(existingRenderAdapterSettings) !== JSON.stringify(manifestRenderAdapterSettings);
        const needsSettingsUpdate = !existing || existingSettingsRev !== settingsRev ||
          cleanString(existing?.parserMode || DEFAULT_PARSER_MODE, DEFAULT_PARSER_MODE) !== manifestParserMode ||
          cleanString(existing?.renderAdapterId || DEFAULT_RENDER_ADAPTER_ID, DEFAULT_RENDER_ADAPTER_ID) !== manifestRenderAdapterId ||
          adapterSettingsChanged;

        if (!force && existing && !needsFontUpdate && !needsSettingsUpdate) {
          skipped++;
          continue;
        }

        const baseFilename = cleanString(pair.baseFilename || baseUrl.split("/").pop() || "preloaded-base.ttf");
        const companionFilename = cleanString(pair.companionFilename || companionUrl.split("/").pop() || "preloaded-companion.ttf");
        const literalCartoucheFilename = cleanString(
          pair.literalCartoucheFilename ||
          pair.literalCartoucheFileName ||
          (literalCartoucheUrl ? literalCartoucheUrl.split("/").pop() : '') ||
          existing?.literalCartoucheFilename ||
          existing?.literalCartoucheFileName ||
          ''
        );

        let baseBlob = existing?.baseBlob || null;
        let companionBlob = existing?.companionBlob || null;
        let literalCartoucheBlob = literalCartoucheUrl ? (existing?.literalCartoucheBlob || existing?.literalCartoucheFontBlob || null) : null;

        if (force || needsFontUpdate) {
          let baseBuffer;
          let companionBuffer;
          let literalCartoucheBuffer = null;

          try {
            const fetches = [
              fetch(baseUrl, { cache: "no-store" }),
              fetch(companionUrl, { cache: "no-store" })
            ];
            if (literalCartoucheUrl) fetches.push(fetch(literalCartoucheUrl, { cache: "no-store" }));

            const responses = await Promise.all(fetches);
            const [baseRes, companionRes, literalCartoucheRes] = responses;

            if (!baseRes.ok) throw new Error(`Failed to fetch base font ${baseUrl}: ${baseRes.status}`);
            if (!companionRes.ok) throw new Error(`Failed to fetch companion font ${companionUrl}: ${companionRes.status}`);
            if (literalCartoucheUrl && !literalCartoucheRes?.ok) {
              throw new Error(`Failed to fetch literal cartouche font ${literalCartoucheUrl}: ${literalCartoucheRes?.status}`);
            }

            [baseBuffer, companionBuffer] = await Promise.all([
              baseRes.arrayBuffer(),
              companionRes.arrayBuffer()
            ]);
            if (literalCartoucheUrl && literalCartoucheRes) {
              literalCartoucheBuffer = await literalCartoucheRes.arrayBuffer();
            }
          } catch (err) {
            console.warn("[preloaded-fonts] font fetch failed:", fontKey, err);
            skipped++;
            continue;
          }

          baseBlob = new Blob([baseBuffer], {
            type: normalizeFormat(pair.baseFormat || inferFormatFromFilename(baseFilename)) === "opentype"
              ? "font/otf"
              : "font/ttf"
          });

          companionBlob = new Blob([companionBuffer], {
            type: normalizeFormat(pair.companionFormat || inferFormatFromFilename(companionFilename)) === "opentype"
              ? "font/otf"
              : "font/ttf"
          });

          literalCartoucheBlob = literalCartoucheBuffer
            ? new Blob([literalCartoucheBuffer], {
                type: normalizeFormat(pair.literalCartoucheFormat || inferFormatFromFilename(literalCartoucheFilename)) === "opentype"
                  ? "font/otf"
                  : "font/ttf"
              })
            : null;
        }

        const stored = recordToStoredShape({
          ...(existing || {}),
          fontKey,
          fontLabel: cleanString(pair.label || existing?.fontLabel || existing?.label || fontKey, fontKey),
          label: cleanString(pair.label || existing?.label || existing?.fontLabel || fontKey, fontKey),

          baseFamily: cleanString(pair.baseFamily || existing?.baseFamily || pair.textFamily || fontKey, fontKey),
          companionFamily: cleanString(
            pair.companionFamily || existing?.companionFamily || pair.cartoucheFamily || `${fontKey}-nanpa-linja-n`,
            `${fontKey}-nanpa-linja-n`
          ),
          literalCartoucheFamily: cleanString(
            pair.literalCartoucheFamily || pair.literalCartoucheFontFamily || existing?.literalCartoucheFamily || existing?.literalCartoucheFontFamily || pair.baseFamily || existing?.baseFamily || pair.textFamily || fontKey,
            cleanString(pair.baseFamily || existing?.baseFamily || pair.textFamily || fontKey, fontKey)
          ),

          baseFilename,
          companionFilename,
          literalCartoucheFilename,
          literalCartoucheUrl,
          baseSample: cleanString(pair.baseSample || existing?.baseSample || DEFAULT_FONT_LOAD_SAMPLE, DEFAULT_FONT_LOAD_SAMPLE),
          companionSample: cleanString(pair.companionSample || existing?.companionSample || DEFAULT_FONT_LOAD_SAMPLE, DEFAULT_FONT_LOAD_SAMPLE),
          literalCartoucheSample: cleanString(pair.literalCartoucheSample || existing?.literalCartoucheSample || DEFAULT_FONT_LOAD_SAMPLE, DEFAULT_FONT_LOAD_SAMPLE),
          baseFormat: normalizeFormat(pair.baseFormat || existing?.baseFormat || inferFormatFromFilename(baseFilename)),
          companionFormat: normalizeFormat(pair.companionFormat || existing?.companionFormat || inferFormatFromFilename(companionFilename)),
          literalCartoucheFormat: normalizeFormat(pair.literalCartoucheFormat || existing?.literalCartoucheFormat || inferFormatFromFilename(literalCartoucheFilename || literalCartoucheUrl)),

          baseBlob,
          companionBlob,
          literalCartoucheBlob,

          parserMode: manifestParserMode,
          renderAdapterId: manifestRenderAdapterId,
          renderAdapterSettings: { ...manifestRenderAdapterSettings },
          sourceType: cleanString(existing?.sourceType || "indexeddb"),
          editable: existing?.editable !== false,

          // Manifest-managed/preloaded font pairs should use manifest settings.
          // This prevents stale IndexedDB cartouche/tally settings surviving after a bundled update.
          settings: pair.settings || existing?.settings || null,
          support: pair.support || existing?.support || null,

          metadataSuffix: cleanString(pair.metadataSuffix || existing?.metadataSuffix || "-nanpa-linja-n"),
          notes: existing?.notes || null,

          manifestRev: rev,
          preloadedRev: rev,
          fontRev,
          preloadedFontRev: fontRev,
          settingsRev,
          preloadedSettingsRev: settingsRev,
          preloadedManifestUrl: manifestUrl,
          updatedAt: nowIso(),
          createdAt: cleanString(existing?.createdAt || nowIso())
        });

        // Preserve manifest metadata even though recordToStoredShape only normalizes
        // the known fields.
        stored.manifestRev = rev;
        stored.preloadedRev = rev;
        stored.fontRev = fontRev;
        stored.preloadedFontRev = fontRev;
        stored.settingsRev = settingsRev;
        stored.preloadedSettingsRev = settingsRev;
        stored.preloadedManifestUrl = manifestUrl;
        stored.preloadedManifestSchema = manifestSchema;

        await withStore(db, storeName, "readwrite", async (store) => {
          await requestToPromise(store.put(stored));
        });

        updated++;
      }
    } finally {
      try { db.close(); } catch {}
    }

    if (updated > 0 || migration.applied) {
      dispatchFontsChanged({
        controller: "sitelen-font-pair-controller",
        type: migration.applied ? "preloaded-manifest-schema-migration" : "preloaded-manifest-sync",
        manifestUrl,
        manifestSchema,
        updated,
        migration
      });
    }

    return { updated, skipped, manifestSchema, migration };
  }

  async function removeStoredPair(fontKey) {
    const key = cleanString(fontKey);
    if (!key) return false;
    const db = await getDb();
    await withStore(db, indexedDbStoreName, 'readwrite', async (store) => {
      await requestToPromise(store.delete(key));
    });
    runtimePairMap.delete(key);
    dynamicRegistryMap.delete(key);
    revokeObjectUrlsForKey(key);
    if (activePresetKey === key) activePresetKey = normalizeScriptPresetKey(defaultPresetKey);
    invalidate();
    populateScriptSelectOptions();
    populateTextSelectOptions();
    dispatchFontsChanged({ key, controller: 'sitelen-font-pair-controller', type: 'delete', eventName: controllerChangeEventName });
    if (controllerChangeEventName && controllerChangeEventName !== DEFAULT_CHANGED_EVENT) {
      try { window.dispatchEvent(new CustomEvent(controllerChangeEventName, { detail: { key, controller: 'sitelen-font-pair-controller', type: 'delete' } })); } catch {}
    }
    return true;
  }

  async function hydrateDynamicPresetsFromDb({ force = false } = {}) {
    const now = Date.now();
    if (!force && lastHydratedAt && now - lastHydratedAt < 250) return listDynamicPresets();
    const records = await listStoredFontPairs();
    const seen = new Set();
    for (const rec of records) {
      seen.add(rec.fontKey);
      try {
        const preset = buildDynamicPresetFromStoredRecord(rec, { sourceType: 'indexeddb' });
        registerDynamicPreset(rec.fontKey, preset, { silent: true });
      } catch (err) {
        console.warn('Could not hydrate stored font pair', rec?.fontKey, err);
      }
    }
    for (const key of Array.from(dynamicRegistryMap.keys())) {
      const preset = dynamicRegistryMap.get(key);
      if (preset?.sourceType === 'indexeddb' && !seen.has(key)) {
        dynamicRegistryMap.delete(key);
        runtimePairMap.delete(key);
        revokeObjectUrlsForKey(key);
      }
    }
    lastHydratedAt = now;
    invalidate();
    populateScriptSelectOptions();
    populateTextSelectOptions();
    return listDynamicPresets();
  }

  function listDynamicPresets() {
    return Array.from(dynamicRegistryMap.entries()).map(([key, preset]) => ({
      key,
      preset,
      sourceType: preset?.sourceType || 'runtime',
      editable: preset?.editable !== false,
      fontKey: preset?.fontKey || key,
      pairRecord: runtimePairMap.get(key) || preset?.__pairRecord || null,
    }));
  }

  function listBuiltInPresets() {
    return Array.from(builtInRegistryMap.entries()).map(([key, preset]) => ({
      key,
      preset,
      sourceType: 'built-in',
      editable: false,
      fontKey: null,
      pairRecord: null,
    }));
  }

  async function listKnownPairs() {
    await hydrateDynamicPresetsFromDb();
    const builtIns = listBuiltInPresets().map(item => ({
      ...item,
      displayName: item.preset?.label || item.key,
    }));
    const dynamic = listDynamicPresets().map(item => ({
      ...item,
      displayName: item.pairRecord?.label || item.preset?.label || item.key,
    }));
    return [...builtIns, ...dynamic];
  }

  async function resolvePresetRecord(key) {
    const normalizedKey = normalizeScriptPresetKey(key);
    const preset = getPresetByKey(normalizedKey);
    if (!preset) return null;
    const builtIn = builtInRegistryMap.has(normalizedKey);
    const pairRecord = runtimePairMap.get(normalizedKey) || preset.__pairRecord || null;
    return {
      key: normalizedKey,
      fontKey: pairRecord?.fontKey || preset.fontKey || normalizedKey,
      preset,
      presetKey: normalizedKey,
      sourceType: builtIn ? 'built-in' : (preset.sourceType || 'indexeddb'),
      editable: builtIn ? false : preset.editable !== false,
      pairRecord,
      displayName: pairRecord?.label || preset.label || normalizedKey,
      support: pairRecord?.support || preset.support || null,
    };
  }

  async function registerRuntimePair({
    fontKey,
    label,
    baseFamily,
    companionFamily,
    baseBlob,
    companionBlob,
    literalCartoucheFamily = '',
    literalCartoucheBlob = null,
    literalCartoucheFilename = '',
    literalCartoucheFormat = '',
    literalCartoucheUrl = '',
    baseFilename = 'uploaded-font.ttf',
    companionFilename = 'uploaded-font-nanpa-linja-n.ttf',
    baseSample = DEFAULT_FONT_LOAD_SAMPLE,
    companionSample = DEFAULT_FONT_LOAD_SAMPLE,
    literalCartoucheSample = DEFAULT_FONT_LOAD_SAMPLE,
    literalOptions = DEFAULT_TEXT_FONT_OPTIONS,
    parserMode = DEFAULT_PARSER_MODE,
    renderAdapterId = DEFAULT_RENDER_ADAPTER_ID,
    renderAdapterSettings = {},
    sourceType = 'runtime',
    editable = true,
    support = null,
    settings = null,
    metadataSuffix = '-nanpa-linja-n',
    persist = false,
  } = {}) {
    const key = cleanString(fontKey || generateFontKey(label || baseFamily || 'font'));
    const record = recordToStoredShape({
      fontKey: key,
      fontLabel: cleanString(label || baseFamily || key, key),
      label: cleanString(label || baseFamily || key, key),
      baseFamily: cleanString(baseFamily || label || key, key),
      companionFamily: cleanString(companionFamily || `${baseFamily || label || key}${metadataSuffix}`),
      literalCartoucheFamily: cleanString(literalCartoucheFamily || baseFamily || label || key, key),
      literalCartoucheBlob,
      literalCartoucheFilename,
      literalCartoucheFormat: normalizeFormat(literalCartoucheFormat || inferFormatFromBlob(literalCartoucheBlob, literalCartoucheFilename || literalCartoucheUrl)),
      literalCartoucheUrl,
      baseFilename,
      companionFilename,
      baseSample: cleanString(baseSample || DEFAULT_FONT_LOAD_SAMPLE, DEFAULT_FONT_LOAD_SAMPLE),
      companionSample: cleanString(companionSample || DEFAULT_FONT_LOAD_SAMPLE, DEFAULT_FONT_LOAD_SAMPLE),
      literalCartoucheSample: cleanString(literalCartoucheSample || DEFAULT_FONT_LOAD_SAMPLE, DEFAULT_FONT_LOAD_SAMPLE),
      baseFormat: inferFormatFromBlob(baseBlob, baseFilename),
      companionFormat: inferFormatFromBlob(companionBlob, companionFilename),
      baseBlob,
      companionBlob,
      literalOptions,
      parserMode: cleanString(parserMode || DEFAULT_PARSER_MODE, DEFAULT_PARSER_MODE),
      renderAdapterId: cleanString(renderAdapterId || DEFAULT_RENDER_ADAPTER_ID, DEFAULT_RENDER_ADAPTER_ID),
      renderAdapterSettings: (renderAdapterSettings && typeof renderAdapterSettings === 'object' && !Array.isArray(renderAdapterSettings)) ? { ...renderAdapterSettings } : {},
      sourceType,
      editable,
      support,
      settings,
      metadataSuffix,
    }, resolveDynamicLiteralOptions({
      fontKey: key,
      label,
      baseFamily,
      companionFamily,
      baseFilename,
      companionFilename,
      baseSample: cleanString(baseSample || DEFAULT_FONT_LOAD_SAMPLE, DEFAULT_FONT_LOAD_SAMPLE),
      companionSample: cleanString(companionSample || DEFAULT_FONT_LOAD_SAMPLE, DEFAULT_FONT_LOAD_SAMPLE),
      literalCartoucheSample: cleanString(literalCartoucheSample || DEFAULT_FONT_LOAD_SAMPLE, DEFAULT_FONT_LOAD_SAMPLE),
      parserMode: cleanString(parserMode || DEFAULT_PARSER_MODE, DEFAULT_PARSER_MODE),
      renderAdapterId: cleanString(renderAdapterId || DEFAULT_RENDER_ADAPTER_ID, DEFAULT_RENDER_ADAPTER_ID),
      renderAdapterSettings: (renderAdapterSettings && typeof renderAdapterSettings === 'object' && !Array.isArray(renderAdapterSettings)) ? { ...renderAdapterSettings } : {},
      sourceType,
      editable,
      support,
      settings,
      metadataSuffix,
      literalOptions,
      literalCartoucheFamily,
      literalCartoucheBlob,
      literalCartoucheFilename,
      literalCartoucheFormat,
      literalCartoucheUrl,
    }, null));
    const preset = buildDynamicPresetFromStoredRecord(record, { sourceType });
    registerDynamicPreset(key, preset, { silent: true });
    dispatchFontsChanged({ key, controller: 'sitelen-font-pair-controller', type: 'runtime-register', eventName: controllerChangeEventName });
    if (controllerChangeEventName && controllerChangeEventName !== DEFAULT_CHANGED_EVENT) {
      try { window.dispatchEvent(new CustomEvent(controllerChangeEventName, { detail: { key, controller: 'sitelen-font-pair-controller', type: 'runtime-register' } })); } catch {}
    }
    if (persist) {
      await saveFontPairToIndexedDb({ ...record, sourceType: 'indexeddb' });
    }
    return { key, preset, record };
  }

  async function saveRuntimePairToDb(fontKey) {
    const rec = runtimePairMap.get(cleanString(fontKey));
    if (!rec) throw new Error('Runtime pair not found.');
    return saveFontPairToIndexedDb({ ...rec, sourceType: 'indexeddb' });
  }

  function getDynamicRegistrySnapshot() {
    const out = {};
    for (const [key, preset] of dynamicRegistryMap.entries()) out[key] = clonePreset(preset);
    return out;
  }

  function getCombinedRegistrySnapshot() {
    const out = {};
    for (const [key, preset] of presetEntries()) out[key] = clonePreset(preset);
    return out;
  }

  function registerPresetObject(key, preset, { persist = false } = {}) {
    const normalizedKey = cleanString(key || preset?.key);
    if (!normalizedKey) throw new Error('Preset key is required.');
    registerDynamicPreset(normalizedKey, preset, { silent: true });
    if (persist) {
      const pairRecord = preset?.__pairRecord || runtimePairMap.get(normalizedKey);
      if (!pairRecord?.baseBlob || !pairRecord?.companionBlob) {
        throw new Error('Persistent registration requires baseBlob and companionBlob in the preset pair record.');
      }
      return saveFontPairToIndexedDb(pairRecord);
    }
    dispatchFontsChanged({ key: normalizedKey, controller: 'sitelen-font-pair-controller', type: 'preset-object-register', eventName: controllerChangeEventName });
    if (controllerChangeEventName && controllerChangeEventName !== DEFAULT_CHANGED_EVENT) {
      try { window.dispatchEvent(new CustomEvent(controllerChangeEventName, { detail: { key: normalizedKey, controller: 'sitelen-font-pair-controller', type: 'preset-object-register' } })); } catch {}
    }
    return { key: normalizedKey, preset: getPresetByKey(normalizedKey) };
  }

  function destroy() {
    for (const key of Array.from(objectUrlByKey.keys())) revokeObjectUrlsForKey(key);
    objectUrlByKey.clear();
    dynamicRegistryMap.clear();
    runtimePairMap.clear();
    invalidate();
  }

  const api = {
    normalizeScriptPresetKey,
    normalizeTextFontOptionKey,
    getActivePreset,
    getPresetByKey,
    getSelectedTextFontOptionKey,
    getTextFontOptionsForPreset,
    resolveLiteralFontFamily,
    resolveLiteralCartoucheFontFamily,
    buildFontRoles,
    getPresetTallySettings,
    buildRendererParserConfig,
    buildRendererConfig,
    uniqueConfiguredFontFamilies,
    ensureFamiliesLoaded,
    waitForConfiguredFonts,
    fontsReadyForPx,
    warmUpCanvasFonts,
    warmUpCanvasFontsOnce,
    resetFontLoadState,
    populateScriptSelectOptions,
    populateTextSelectOptions,
    saveScriptPresetToStorage,
    loadScriptPresetFromStorage,
    saveTextFontOptionToStorage,
    loadTextFontOptionFromStorage,
    setActivePreset,
    setSelectedTextFontOption,
    applyStoredSelections,
    wireControls,

    // additive dynamic/runtime/indexeddb helpers
    getDb,
    listStoredFontPairs,
    getStoredFontPair,
    saveFontPairToIndexedDb,
    syncPreloadedFontPairsFromManifest,
    removeStoredPair,
    hydrateDynamicPresetsFromDb,
    listDynamicPresets,
    listBuiltInPresets,
    listKnownPairs,
    resolvePresetRecord,
    registerRuntimePair,
    saveRuntimePairToDb,
    registerPresetObject,
    getDynamicRegistrySnapshot,
    getCombinedRegistrySnapshot,
    hasPresetKey,
    destroy,
  };

  api.ready = (async () => {
    populateScriptSelectOptions();
    populateTextSelectOptions();
    try {
      await hydrateDynamicPresetsFromDb({ force: true });
    } catch (err) {
      console.warn('Could not hydrate dynamic font presets during controller startup.', err);
    }
    applyStoredSelections();
    return api;
  })();

  window.addEventListener(controllerChangeEventName, async () => {
    await hydrateDynamicPresetsFromDb({ force: true });
  });

  return api;
}
