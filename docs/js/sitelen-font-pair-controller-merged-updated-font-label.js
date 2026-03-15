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
    baseFilename: cleanString(record.baseFilename || record.baseFileName || 'uploaded-font.ttf'),
    companionFilename: cleanString(record.companionFilename || record.companionFileName || 'uploaded-font-nanpa-linja-n.ttf'),
    baseFormat: normalizeFormat(record.baseFormat || record.textFormat || inferFormatFromFilename(record.baseFilename || '')),
    companionFormat: normalizeFormat(record.companionFormat || record.cartoucheFormat || inferFormatFromFilename(record.companionFilename || '')),
    baseBlob: record.baseBlob || null,
    companionBlob: record.companionBlob || null,
    literalOptions: Array.isArray(record.literalOptions) && record.literalOptions.length ? record.literalOptions : fallbackLiteralOptions,
    parserMode: cleanString(record.parserMode || 'sitelen-seli-kiwen'),
    sourceType: cleanString(record.sourceType || 'indexeddb'),
    editable: record.editable !== false,
    createdAt: cleanString(record.createdAt || nowIso()),
    updatedAt: cleanString(record.updatedAt || nowIso()),
    support: record.support || null,
    settings: record.settings || null,
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

  function buildFontRoles({ textFontOptionKey = getSelectedTextFontOptionKey(), preset = getActivePreset() } = {}) {
    return {
      word: preset.textFamily,
      text: preset.textFamily,
      cartouche: preset.textFamily,
      number: preset.cartoucheFamily,
      date: preset.cartoucheFamily,
      time: preset.cartoucheFamily,
      literal: resolveLiteralFontFamily(textFontOptionKey, preset),
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
    const neededFaces = uniq(families.map(findFaceByFamily).filter(Boolean));
    await Promise.all(neededFaces.map(ensureFaceLoaded));
    await document.fonts.ready;
    await Promise.all(families.map(family => document.fonts.load(`${px}px ${quotedFontFamily(family)}`, fontLoadSample)));
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
    const baseUrl = makeBlobUrl(rec.baseBlob, baseExt);
    const companionUrl = makeBlobUrl(rec.companionBlob, companionExt);
    rememberObjectUrl(presetKey, baseUrl);
    rememberObjectUrl(presetKey, companionUrl);

    const faces = [
      {
        family: rec.baseFamily,
        url: baseUrl,
        format: rec.baseFormat,
        sample: fontLoadSample,
      },
      {
        family: rec.companionFamily,
        url: companionUrl,
        format: rec.companionFormat,
        sample: fontLoadSample,
      },
    ];

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
      parserMode: rec.parserMode,
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
    baseFilename = 'uploaded-font.ttf',
    companionFilename = 'uploaded-font-nanpa-linja-n.ttf',
    literalOptions = DEFAULT_TEXT_FONT_OPTIONS,
    parserMode = 'sitelen-seli-kiwen',
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
      baseFilename,
      companionFilename,
      baseFormat: inferFormatFromBlob(baseBlob, baseFilename),
      companionFormat: inferFormatFromBlob(companionBlob, companionFilename),
      baseBlob,
      companionBlob,
      literalOptions,
      parserMode,
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
      parserMode,
      sourceType,
      editable,
      support,
      settings,
      metadataSuffix,
      literalOptions,
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
    buildFontRoles,
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
