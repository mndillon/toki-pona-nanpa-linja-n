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

function byIdOrElement(value) {
  if (!value) return null;
  if (typeof value === 'string') return document.getElementById(value);
  return value;
}

function uniq(items) {
  return Array.from(new Set((items || []).filter(Boolean)));
}

function normalizeFormat(format) {
  const raw = String(format || '').trim();
  if (!raw) return 'truetype';
  return raw;
}

function quotedFontFamily(family) {
  const s = String(family || '').trim();
  return s.includes('"') ? s : `"${s}"`;
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
} = {}) {
  if (!registry || typeof registry !== 'object') {
    throw new Error('createSitelenFontPairController requires a registry object.');
  }

  const registryMap = new Map(Object.entries(registry));
  if (!registryMap.size) throw new Error('Font registry is empty.');

  const scriptEl = byIdOrElement(scriptSelect);
  const textEl = byIdOrElement(textFontSelect);
  const scriptStorageKey = `${storageKeyPrefix}ScriptPreset`;
  const textStorageKey = `${storageKeyPrefix}LiteralTextFont`;

  let activePresetKey = normalizeScriptPresetKey(defaultPresetKey);
  let fontsReadyPromise = null;
  let fontsReadyPx = null;
  let didWarmUp = false;

  const registeredFaces = new Set();
  const loadPromisesByFaceKey = new Map();

  function invalidate() {
    fontsReadyPromise = null;
    fontsReadyPx = null;
    didWarmUp = false;
    if (typeof onInvalidate === 'function') onInvalidate();
  }

  function presetEntries() {
    return Array.from(registryMap.entries());
  }

  function normalizeScriptPresetKey(key) {
    const raw = String(key || '').trim();
    return registryMap.has(raw) ? raw : (registryMap.has(defaultPresetKey) ? defaultPresetKey : presetEntries()[0][0]);
  }

  function getActivePreset() {
    return registryMap.get(activePresetKey) || registryMap.get(normalizeScriptPresetKey(defaultPresetKey)) || presetEntries()[0][1];
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
    return options.some(([value]) => value === raw) ? raw : defaultTextFontOption;
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

  function findFaceByFamily(family) {
    const fam = String(family || '').trim();
    if (!fam) return null;
    for (const [, preset] of presetEntries()) {
      for (const face of (preset?.faces || [])) {
        if (String(face?.family || '').trim() === fam) return face;
      }
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

  const api = {
    normalizeScriptPresetKey,
    normalizeTextFontOptionKey,
    getActivePreset,
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
  };

  populateScriptSelectOptions();
  populateTextSelectOptions();

  return api;
}