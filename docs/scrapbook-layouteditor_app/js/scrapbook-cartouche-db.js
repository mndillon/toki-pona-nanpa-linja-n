import {
  CartoucheApi,
  buildEntryDisplayInput,
  buildEntryRendererInput,
  buildRandomDescForLetters,
  segmentLetters,
  segmentWords,
  makeKey,
  parseAndValidateLine,
} from '../../js/cartouche-api-v3-previewdesc.js?v=30';

const SCRAPBOOK_CARTOUCHE_DB_DEBUG = !!globalThis.SCRAPBOOK_CARTOUCHE_DB_DEBUG;
function scrapbookCartoucheDebugWarn(...args) {
  if (SCRAPBOOK_CARTOUCHE_DB_DEBUG) console.warn(...args);
}



const PREVIEW_FONT_FAMILY_TEXT = 'TP-Nasin-Nanpa-Font';
const PREVIEW_FONT_FAMILY_CARTOUCHE = 'TP-Cartouche-Font';
const PREVIEW_FONT_FAMILY_LITERAL = 'Patrick-Head-Font';
const PREVIEW_FONT_FAMILY_LITERAL_CARTOUCHE = 'TP-Nasin-Nanpa-Literal-Cartouche-Font';

const PREVIEW_FONT_URL_TEXT = '../../fonts/nasin-nanpa-5.0.0-beta.3-UCSUR-v5.otf';
const PREVIEW_FONT_URL_CARTOUCHE = '../../fonts/nasin-nanpa-5.0.0-beta.3-UCSUR-nanpa-linja-n-good-kasi.otf';
const PREVIEW_FONT_URL_LITERAL = '../../fonts/PatrickHand-Regular.ttf';
const PREVIEW_FONT_URL_LITERAL_CARTOUCHE = '../../fonts/nasin-nanpa-4.0.2-Helvetica.otf';
const PREVIEW_RENDERER_URL = '../../js/renderer-fontuploads-renderer-preview-bottom-detect-final-fixed.js?v=168';

function mergedLettersToWordForLocalDb(words) {
  return segmentLetters(words).letters.join('');
}

const LOCAL_TP_KNOWN_WORDS = new Set([
  'a','akesi','ala','alasa','ale','ali','anpa','ante','anu','awen',
  'e','en','epiku','esun','ijo','ike','ilo','insa',
  'jaki','jan','jasima','jelo','jo',
  'kala','kalama','kama','kasi','ken','kepeken','kijetesantakalu','kili','kin','kipisi',
  'kiwen','ko','kokosila','kon','ku','kule','kulupu','kute',
  'la','lanpan','lape','laso','lawa','leko','len','lete','li','lili',
  'linja','linluwi','lipu','loje','lon','luka','lukin','lupa',
  'ma','majuna','mama','mani','meli','meso','mi','mije','misikeke',
  'moku','moli','monsi','monsuta','mu','mun','musi','mute',
  'n','namako','nanpa','nasa','nasin','nena','ni','nimi','noka',
  'o','oko','olin','ona','open',
  'pakala','pake','pali','palisa','pan','pana','pi','pilin','pimeja',
  'pini','pipi','poka','poki','pona','powe','pu',
  'sama','seli','selo','seme','sewi','sijelo','sike','sin','sina',
  'sinpin','sitelen','soko','sona','soweli','su','suli','suno','supa','suwi',
  'tan','taso','tawa','telo','tenpo','toki','tomo','tonsi','tu',
  'unpa','uta','utala','walo','wan','waso','wawa','weka','wile',
]);

function localWordsLookLikeNanpaRun(words) {
  if (!Array.isArray(words) || !words.length) return false;
  try {
    const parser = globalThis.NanpaParser || null;
    return !!(parser && typeof parser.isValidCaps === 'function' && parser.isValidCaps(words.map(w => String(w).toUpperCase()).join('')));
  } catch {
    return false;
  }
}

function entryRequiresAtDbForLocalTpWordCollision(entry) {
  if (!entry || !Array.isArray(entry.words) || !entry.words.length) return false;
  const segs = segmentWords(entry.words);

  // Match standalone cartouche-db.html: any nanpa-linja-n segment requires
  // explicit @db to use the saved proper-name override.  The extra direct
  // parser check covers startup order where the local controller was created
  // before CartoucheApi was given NanpaParser.
  if (segs.some(seg => seg && seg.type === 'nanpa') || localWordsLookLikeNanpaRun(entry.words)) return true;

  for (const seg of segs) {
    if (seg.type !== 'normal') continue;
    if (entry.merge) {
      const merged = mergedLettersToWordForLocalDb(seg.words);
      if (LOCAL_TP_KNOWN_WORDS.has(merged)) return true;
    } else {
      for (const w of seg.words) {
        if (LOCAL_TP_KNOWN_WORDS.has(String(w).toLowerCase())) return true;
      }
    }
  }
  return false;
}

function getEntryLookupAliasesForLocalDb(entry) {
  const aliases = new Set();
  if (!entry || !Array.isArray(entry.words) || !entry.words.length) return aliases;
  aliases.add(entry.key);
  if (entry.merge) {
    const segs = segmentWords(entry.words);
    for (const seg of segs) {
      if (seg.type !== 'normal') continue;
      const merged = segmentLetters(seg.words).letters.join('');
      if (merged) aliases.add(merged.charAt(0).toUpperCase() + merged.slice(1));
    }
  }
  return aliases;
}


function entryHasAnyCartoucheDescription(entry) {
  const cm = entry && entry.cartoucheMap && typeof entry.cartoucheMap === 'object'
    ? entry.cartoucheMap
    : {};
  return Object.values(cm).some(value => String(value || '').trim());
}

function shouldGenerateCartoucheDescriptions(entry) {
  if (!entry) return false;
  if (entry.mode === 'random') return true;
  if (entry.mode === 'preferred' && !entryHasAnyCartoucheDescription(entry)) return true;
  return false;
}

function entryHasNanpaSegmentForLocalProperName(entry) {
  if (!entry || !Array.isArray(entry.words) || !entry.words.length) return false;
  try {
    return segmentWords(entry.words).some(seg => seg && seg.type === 'nanpa');
  } catch {
    return false;
  }
}

function shouldForceNormalForLocalProperNameRender(entry) {
  if (!entry || entry.mode === 'literal' || entry.mode === 'ignore') return false;
  // Match the standalone cartouche DB page: nanpa-linja-n proper names render
  // as numeric cartouches by default.  Only an explicit @db/forceNormal override
  // should make a numeric-looking proper name use the saved glyph description.
  return !!entry.forceNormal;
}

function entryForLocalProperNameRender(entry) {
  return shouldForceNormalForLocalProperNameRender(entry)
    ? { ...entry, forceNormal: true }
    : entry;
}

function buildEffectiveEntryForRender(entry) {
  if (!shouldGenerateCartoucheDescriptions(entry)) return entry;

  const segs = segmentWords(entry.words);
  const cm = {};

  segs.forEach((seg, si) => {
    if (seg.type === 'nanpa' && !entry.forceNormal) return;

    if (seg.type === 'nanpa' && entry.forceNormal) {
      const letters = seg.words.join('').toLowerCase().split('');
      cm[si] = buildRandomDescForLetters(letters, { excludeNanpaAtEnds: true });
      return;
    }

    if (entry.merge) {
      const { letters } = segmentLetters(seg.words);
      cm[si] = buildRandomDescForLetters(letters);
    } else {
      seg.words.forEach((w, wi) => {
        cm[`${si}_${wi}`] = buildRandomDescForLetters(String(w).toLowerCase().split(''));
      });
    }
  });

  return { ...entry, cartoucheMap: cm };
}

function escapeLiteralCartoucheText(text) {
  return String(text ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .trim();
}
function buildLiteralCartoucheRendererInput(entry) {
  const literal = escapeLiteralCartoucheText(entry?.literalText || entry?.key || '');
  return `["${literal}"]`;
}

function buildEntryRenderedPreviewInput(entry) {
  if (!entry) return '';
  if (entry.mode === 'ignore') return buildEntryDisplayInput(entry);
  if (entry.mode === 'literal') return buildLiteralCartoucheRendererInput(entry);
  return buildEntryRendererInput(buildEffectiveEntryForRender(entryForLocalProperNameRender(entry)));
}

function buildLocalPageMapFromEntries(entries) {
  const map = new Map();
  for (const entry of Array.isArray(entries) ? entries : []) {
    if (!entry || !entry.key || !Array.isArray(entry.words) || !entry.words.length) continue;

    if (entry.mode === 'ignore') {
      for (const alias of getEntryLookupAliasesForLocalDb(entry)) map.set(alias, null);
      continue;
    }

    let rendererInput;
    if (entry.mode === 'literal') {
      rendererInput = buildLiteralCartoucheRendererInput(entry);
    } else {
      rendererInput = buildEntryRendererInput(buildEffectiveEntryForRender(entryForLocalProperNameRender(entry)));
    }

    let inputForceNormal = rendererInput;
    if (entry.forceNormal && entry.mode !== 'literal') {
      const entryNormal = { ...entry, forceNormal: false };
      inputForceNormal = rendererInput;
      rendererInput = buildEntryRendererInput(buildEffectiveEntryForRender(entryNormal));
    }

    const mapValue = {
      input: rendererInput,
      inputForceNormal,
      forceNormal: !!entry.forceNormal,
      requiresAtDb: entryRequiresAtDbForLocalTpWordCollision(entry),
    };

    for (const alias of getEntryLookupAliasesForLocalDb(entry)) map.set(alias, mapValue);
  }
  return map;
}


function fallbackParseLocalProperNameLine(raw) {
  const text = String(raw || '').trim();
  if (!text) return { ok: false, reason: 'Enter a proper name.' };
  const words = text.split(/\s+/).filter(Boolean);
  if (!words.length) return { ok: false, reason: 'Enter a proper name.' };

  // Scrapbook-local entries are proper names.  The shared cartouche DB
  // validator can reject names that look like nanpa-linja-n numeric input
  // (for example "N").  Keep the fallback deliberately narrow: plain Latin
  // proper-name tokens only, with at least one uppercase letter somewhere in
  // the entered name.
  const hasUpper = /[A-Z]/.test(text);
  if (!hasUpper) return { ok: false, reason: 'Proper names must include an uppercase letter.' };
  const bad = words.find(w => !/^[A-Za-z][A-Za-z'’.-]*$/.test(w));
  if (bad) return { ok: false, reason: `Invalid proper-name token: ${bad}` };
  return { ok: true, words };
}

function parseAndValidateLocalProperNameLine(raw) {
  const parsed = parseAndValidateLine(raw);
  if (parsed && parsed.ok) return parsed;
  const fallback = fallbackParseLocalProperNameLine(raw);
  if (fallback.ok) return fallback;
  return parsed || fallback;
}


const DEFAULT_DB = Object.freeze({
  type: 'scrapbook-cartouche-db',
  version: 1,
  entries: [],
});

const VALID_MODES = new Set(['random', 'preferred', 'literal', 'ignore']);

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function normaliseEntry(raw) {
  if (!raw || !Array.isArray(raw.words) || !raw.words.length) return null;
  const parsed = parseAndValidateLocalProperNameLine(raw.words.join(' '));
  if (!parsed.ok) return null;
  const key = makeKey(parsed.words);
  const mode = VALID_MODES.has(raw.mode) ? raw.mode : 'random';
  return {
    key,
    words: parsed.words,
    merge: raw.merge !== false,
    mode,
    cartoucheMap: raw.cartoucheMap && typeof raw.cartoucheMap === 'object' ? { ...raw.cartoucheMap } : {},
    tallyMap: raw.tallyMap && typeof raw.tallyMap === 'object' ? { ...raw.tallyMap } : {},
    forceNormal: true,
    literalText: String(raw.literalText || key).replace(/"/g, '').trim() || key,
  };
}

function normaliseEntries(entries) {
  const out = [];
  const seen = new Set();
  for (const raw of Array.isArray(entries) ? entries : []) {
    const entry = normaliseEntry(raw);
    if (!entry || seen.has(entry.key)) continue;
    seen.add(entry.key);
    out.push(entry);
  }
  return out;
}

function ensureStyle() {
  if (document.getElementById('scrapbookCartoucheDbStyle')) return;
  const style = document.createElement('style');
  style.id = 'scrapbookCartoucheDbStyle';
  style.textContent = `
    #scrapbookCartoucheDbWindow.scrapbookCartoucheDbWindow {
      width: min(880px, calc(100vw - 48px));
      height: min(720px, calc(100vh - 64px));
      left: 48px;
      top: 88px;
      resize: both;
      overflow: hidden;
    }
    #scrapbookCartoucheDbWindow .floatingEditorHeader {
      cursor: grab;
      user-select: none;
    }
    #scrapbookCartoucheDbWindow.scrapbookCartoucheDbDragging .floatingEditorHeader {
      cursor: grabbing;
    }
    .scrapbookCartoucheDbBody {
      display: flex;
      flex-direction: column;
      gap: 10px;
      min-height: 0;
    }
    .scrapbookCartoucheDbHint {
      font: 12px/1.4 system-ui, sans-serif;
      color: var(--muted, #3f4750);
    }
    .scrapbookCartoucheDbToolbar {
      display: grid;
      grid-template-columns: minmax(150px, 1fr) minmax(220px, 1.4fr) auto;
      gap: 8px;
      align-items: end;
    }
    .scrapbookCartoucheDbToolbar label,
    .scrapbookCartoucheDbEntry label {
      display: block;
      font-size: 11px;
      color: var(--muted, #3f4750);
      margin-bottom: 4px;
    }
    .scrapbookCartoucheDbToolbar input,
    .scrapbookCartoucheDbEntry input,
    .scrapbookCartoucheDbEntry select,
    .scrapbookCartoucheDbEntry textarea {
      width: 100%;
      box-sizing: border-box;
      border: 1px solid rgba(17,17,17,.22);
      border-radius: 8px;
      padding: 7px 8px;
      background: var(--bg, #F3DFC0);
      color: var(--ink, #000111);
      font: 13px/1.25 system-ui, sans-serif;
    }
    .scrapbookCartoucheDbList {
      display: flex;
      flex-direction: column;
      gap: 8px;
      overflow: auto;
      min-height: 0;
      padding-right: 3px;
    }
    .scrapbookCartoucheDbEntry {
      border: 1px solid rgba(17,17,17,.18);
      border-radius: 12px;
      padding: 10px;
      background: rgba(255,255,255,.24);
      display: grid;
      gap: 8px;
    }
    .scrapbookCartoucheDbEntry.selected {
      border-color: rgba(90,62,27,.58);
      box-shadow: 0 0 0 2px rgba(90,62,27,.10) inset;
      background: rgba(255,255,255,.34);
    }
    .scrapbookCartoucheDbPreview {
      border: 1px solid rgba(17,17,17,.18);
      border-radius: 12px;
      padding: 8px;
      background: rgba(255,255,255,.26);
      display: grid;
      gap: 4px;
      min-height: 0;
    }
    .scrapbookCartoucheDbPreviewHeader {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 10px;
      font: 12px/1.35 system-ui, sans-serif;
      color: var(--muted, #3f4750);
    }
    .scrapbookCartoucheDbPreviewTitle {
      font-weight: 700;
      color: var(--ink, #000111);
    }
    .scrapbookCartoucheDbPreviewDesc {
      font: 11px/1.25 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      color: var(--muted, #3f4750);
      overflow-wrap: anywhere;
      max-height: 28px;
      overflow: hidden;
    }
    .scrapbookCartoucheDbPreviewCanvasWrap {
      overflow-x: auto;
      overflow-y: visible;
      min-height: 168px;
      max-height: none;
      background: rgba(255,255,255,.18);
      border-radius: 8px;
      padding: 10px 6px 10px 18px;
      white-space: nowrap;
      box-sizing: border-box;
    }
    .scrapbookCartoucheDbPreviewCanvasWrap canvas {
      display: block;
      width: auto !important;
      max-width: none !important;
      height: auto !important;
      max-height: none !important;
    }
    .scrapbookCartoucheDbPreviewSvgHost {
      display: block;
      width: max-content;
      min-width: 1px;
      min-height: 132px;
      height: auto;
      overflow: visible;
    }
    .scrapbookCartoucheDbPreviewSvgHost svg {
      display: block;
      width: auto;
      height: auto;
      max-height: none !important;
      overflow: visible;
    }
    .scrapbookCartoucheDbPreviewSvgHost.hidden,
    .scrapbookCartoucheDbPreviewCanvasWrap canvas.hidden {
      display: none !important;
    }
    .scrapbookCartoucheDbEntryHeader {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 10px;
    }
    .scrapbookCartoucheDbName {
      font: 700 14px/1.2 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      color: var(--ink, #000111);
    }
    .scrapbookCartoucheDbBadges {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      margin-top: 4px;
    }
    .scrapbookCartoucheDbBadge {
      border: 1px solid rgba(17,17,17,.20);
      border-radius: 999px;
      padding: 2px 7px;
      font: 11px/1.2 system-ui, sans-serif;
      color: var(--muted, #3f4750);
      background: rgba(255,255,255,.22);
    }
    .scrapbookCartoucheDbBadge.override {
      border-color: rgba(180,83,9,.55);
      color: #8a4a04;
    }
    .scrapbookCartoucheDbDesc {
      font: 12px/1.35 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      color: var(--muted, #3f4750);
      overflow-wrap: anywhere;
      background: rgba(255,255,255,.18);
      border-radius: 8px;
      padding: 7px 8px;
    }
    .scrapbookCartoucheDbGrid {
      display: grid;
      grid-template-columns: minmax(120px, .8fr) minmax(90px, .5fr) minmax(90px, .5fr) minmax(220px, 1.4fr);
      gap: 8px;
      align-items: end;
    }
    .scrapbookCartoucheDbActions {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
      justify-content: flex-end;
    }
    .scrapbookCartoucheDbStatus {
      min-height: 18px;
      font: 12px/1.35 system-ui, sans-serif;
      color: var(--muted, #3f4750);
    }
    .scrapbookCartoucheDbStatus.error { color: #7f1d1d; }
    .scrapbookCartoucheDbOps {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      align-items: center;
      border-top: 1px solid rgba(17,17,17,.14);
      padding-top: 8px;
    }
    @media (max-width: 760px) {
      .scrapbookCartoucheDbToolbar,
      .scrapbookCartoucheDbGrid { grid-template-columns: 1fr; }
      #scrapbookCartoucheDbWindow.scrapbookCartoucheDbWindow { left: 8px; top: 72px; width: calc(100vw - 16px); }
    }
  `;
  document.head.appendChild(style);
}

function makeButton(label, className = 'btn') {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = className;
  btn.textContent = label;
  return btn;
}

function mergePageMaps(globalMap, localMap) {
  const combined = new Map();
  if (globalMap instanceof Map) {
    for (const [key, value] of globalMap.entries()) combined.set(key, value);
  }
  if (localMap instanceof Map) {
    for (const [key, value] of localMap.entries()) combined.set(key, value);
  }
  return combined;
}


let previewFontPromise = null;
let previewRendererPromise = null;

async function ensureNasinNanpaPreviewFonts(fontPx = 40) {
  if (!previewFontPromise) {
    previewFontPromise = (async () => {
      if (!document.fonts || typeof FontFace !== 'function') return;
      const faces = [
        { family: PREVIEW_FONT_FAMILY_TEXT, url: PREVIEW_FONT_URL_TEXT, format: 'opentype', sample: String.fromCodePoint(0xF196C) },
        { family: PREVIEW_FONT_FAMILY_CARTOUCHE, url: PREVIEW_FONT_URL_CARTOUCHE, format: 'opentype', sample: String.fromCodePoint(0xF1990) },
        { family: PREVIEW_FONT_FAMILY_LITERAL, url: PREVIEW_FONT_URL_LITERAL, format: 'truetype', sample: 'Hello' },
        { family: PREVIEW_FONT_FAMILY_LITERAL_CARTOUCHE, url: PREVIEW_FONT_URL_LITERAL_CARTOUCHE, format: 'opentype', sample: 'Hello' },
      ];
      for (const face of faces) {
        try {
          const source = `url("${face.url}") format("${face.format}")`;
          const ff = new FontFace(face.family, source, { style: 'normal', weight: 'normal' });
          const loaded = await ff.load();
          document.fonts.add(loaded);
        } catch (err) {
          scrapbookCartoucheDebugWarn('[scrapbook-cartouche-db] preview font load failed', face.family, err);
        }
      }
      await document.fonts.ready;
    })();
  }
  await previewFontPromise;
  if (document.fonts && typeof document.fonts.load === 'function') {
    const px = Math.max(12, Number(fontPx) || 40);
    await Promise.all([
      document.fonts.load(`${px}px "${PREVIEW_FONT_FAMILY_TEXT}"`, String.fromCodePoint(0xF196C)),
      document.fonts.load(`${px}px "${PREVIEW_FONT_FAMILY_CARTOUCHE}"`, String.fromCodePoint(0xF1990)),
      document.fonts.load(`${px}px "${PREVIEW_FONT_FAMILY_LITERAL}"`, 'Hello'),
      document.fonts.load(`${px}px "${PREVIEW_FONT_FAMILY_LITERAL_CARTOUCHE}"`, 'Hello'),
    ]);
    await document.fonts.ready;
  }
}

async function getNasinNanpaPreviewRenderer(fontPx = 40) {
  if (!previewRendererPromise) {
    previewRendererPromise = (async () => {
      await ensureNasinNanpaPreviewFonts(fontPx);
      const mod = await import(PREVIEW_RENDERER_URL);
      const SitelenRenderer = mod?.default || mod?.SitelenRenderer || mod;
      return SitelenRenderer.create({
        parser: {
          mode: 'sitelen-seli-kiwen',
          literalStyle: 'double-quote',
          extensionStyle: 'ssk',
          cartoucheStyle: 'ssk',
          numericMode: 'compat',
          mixedStyle: 'short',
          cartoucheCommaTallyMarks: true,
          cartoucheTallyMode: 'manual',
        },
        fonts: {
          roles: {
            word: PREVIEW_FONT_FAMILY_TEXT,
            text: PREVIEW_FONT_FAMILY_TEXT,
            cartouche: PREVIEW_FONT_FAMILY_TEXT,
            number: PREVIEW_FONT_FAMILY_CARTOUCHE,
            date: PREVIEW_FONT_FAMILY_CARTOUCHE,
            time: PREVIEW_FONT_FAMILY_CARTOUCHE,
            literal: PREVIEW_FONT_FAMILY_LITERAL,
            unknown: PREVIEW_FONT_FAMILY_LITERAL,
            literalCartouche: PREVIEW_FONT_FAMILY_LITERAL_CARTOUCHE,
            literalCartoucheFamily: PREVIEW_FONT_FAMILY_LITERAL_CARTOUCHE,
          },
        },
      });
    })();
  }
  return previewRendererPromise;
}

function makeWindowDraggable(root, handle) {
  if (!root || !handle || handle.__scrapbookCartoucheDbDragWired) return;
  handle.__scrapbookCartoucheDbDragWired = true;

  let startX = 0, startY = 0, startLeft = 0, startTop = 0;

  function begin(clientX, clientY) {
    const rect = root.getBoundingClientRect();
    root.style.left = `${rect.left}px`;
    root.style.top = `${rect.top}px`;
    root.style.right = 'auto';
    root.style.bottom = 'auto';
    root.style.transform = 'none';
    startX = clientX;
    startY = clientY;
    startLeft = rect.left;
    startTop = rect.top;
    root.classList.add('scrapbookCartoucheDbDragging');
  }

  function move(clientX, clientY) {
    const nextLeft = Math.max(0, Math.min(window.innerWidth - 80, startLeft + clientX - startX));
    const nextTop = Math.max(0, Math.min(window.innerHeight - 48, startTop + clientY - startY));
    root.style.left = `${nextLeft}px`;
    root.style.top = `${nextTop}px`;
  }

  function end() {
    root.classList.remove('scrapbookCartoucheDbDragging');
    document.removeEventListener('mousemove', onMouseMove, true);
    document.removeEventListener('mouseup', onMouseUp, true);
    document.removeEventListener('touchmove', onTouchMove, true);
    document.removeEventListener('touchend', onTouchEnd, true);
    document.removeEventListener('touchcancel', onTouchEnd, true);
  }

  function shouldIgnoreTarget(target) {
    return !!target?.closest?.('button,input,select,textarea,a,label');
  }

  function onMouseMove(event) {
    event.preventDefault();
    move(event.clientX, event.clientY);
  }
  function onMouseUp() { end(); }
  function onTouchMove(event) {
    const t = event.touches && event.touches[0];
    if (!t) return;
    move(t.clientX, t.clientY);
  }
  function onTouchEnd() { end(); }

  handle.addEventListener('mousedown', event => {
    if (event.button !== 0 || shouldIgnoreTarget(event.target)) return;
    event.preventDefault();
    begin(event.clientX, event.clientY);
    document.addEventListener('mousemove', onMouseMove, true);
    document.addEventListener('mouseup', onMouseUp, true);
  });

  handle.addEventListener('touchstart', event => {
    if (shouldIgnoreTarget(event.target)) return;
    const t = event.touches && event.touches[0];
    if (!t) return;
    begin(t.clientX, t.clientY);
    document.addEventListener('touchmove', onTouchMove, true);
    document.addEventListener('touchend', onTouchEnd, true);
    document.addEventListener('touchcancel', onTouchEnd, true);
  }, { passive: true });
}

export function createScrapbookCartoucheDbController(options = {}) {
  const state = {
    root: null,
    list: null,
    search: null,
    addInput: null,
    status: null,
    importInput: null,
    previewRoot: null,
    previewTitle: null,
    previewDesc: null,
    previewCanvas: null,
    previewSvgHost: null,
    previewStatus: null,
    selectedKey: '',
    previewTimer: null,
    previewSeq: 0,
    globalApi: null,
    globalMap: new Map(),
    localMap: new Map(),
    combinedMap: new Map(),
  };

  const getDocument = typeof options.getDocument === 'function' ? options.getDocument : () => options.document || null;
  const setDocumentDirty = typeof options.setDocumentDirty === 'function' ? options.setDocumentDirty : () => {};
  const requestRenderAll = typeof options.requestRenderAll === 'function' ? options.requestRenderAll : () => {};
  const onCombinedPageMapChanged = typeof options.onCombinedPageMapChanged === 'function' ? options.onCombinedPageMapChanged : () => {};
  const getGlobalPageMap = typeof options.getGlobalPageMap === 'function' ? options.getGlobalPageMap : () => state.globalMap;
  const nanpaParser = options.nanpaParser || null;

  function ensureDocumentDb() {
    const doc = getDocument() || window.ScrapbookCartoucheDbBridge?.getDocument?.();
    if (!doc) return cloneJson(DEFAULT_DB);
    window.ScrapbookCartoucheDbBridge?.bindDocument?.(doc);
    if (!doc.cartoucheDb || typeof doc.cartoucheDb !== 'object') {
      doc.cartoucheDb = cloneJson(DEFAULT_DB);
    }
    if (doc.cartoucheDb.type !== DEFAULT_DB.type) doc.cartoucheDb.type = DEFAULT_DB.type;
    if (!Number.isFinite(doc.cartoucheDb.version)) doc.cartoucheDb.version = DEFAULT_DB.version;
    doc.cartoucheDb.entries = normaliseEntries(doc.cartoucheDb.entries);
    return doc.cartoucheDb;
  }

  function getLocalEntries() {
    return ensureDocumentDb().entries;
  }

  function setLocalEntries(entries, { dirty = true, rebuild = true } = {}) {
    const db = ensureDocumentDb();
    db.entries = normaliseEntries(entries);
    window.ScrapbookCartoucheDbBridge?.setEntries?.(db.entries);
    if (dirty) setDocumentDirty();
    if (rebuild) rebuildCombinedPageMap();
    renderList();
    const selected = getSelectedEntry();
    if (selected) selectEntry(selected.key, { render: true });
    else updateSelectedPreviewMetadata(null);
    return db.entries;
  }

  function setStatus(message, isError = false) {
    if (!state.status) return;
    state.status.textContent = message || '';
    state.status.classList.toggle('error', !!isError);
  }

  function getSelectedEntry() {
    const entries = getLocalEntries();
    return entries.find(entry => entry.key === state.selectedKey) || entries[0] || null;
  }

  function selectEntry(key, { render = true } = {}) {
    state.selectedKey = String(key || '');
    if (state.list) {
      state.list.querySelectorAll('.scrapbookCartoucheDbEntry').forEach(card => {
        card.classList.toggle('selected', card.dataset.key === state.selectedKey);
      });
    }
    if (render) scheduleSelectedPreviewRender();
  }

  function updateSelectedPreviewMetadata(entry, previewInput = null) {
    if (!state.previewRoot) return;
    if (!entry) {
      if (state.previewTitle) state.previewTitle.textContent = 'No selected entry';
      if (state.previewDesc) state.previewDesc.textContent = 'Select a local name entry to preview its cartouche rendering.';
      if (state.previewStatus) state.previewStatus.textContent = '';
      clearSelectedPreviewGraphic();
      return;
    }
    const input = previewInput == null
      ? buildEntryRenderedPreviewInput(entry)
      : String(previewInput);
    if (state.previewTitle) state.previewTitle.textContent = `Preview: ${entry.key}`;
    if (state.previewDesc) state.previewDesc.textContent = input;
  }

  function clearSelectedPreviewGraphic() {
    if (state.previewCanvas) {
      const ctx = state.previewCanvas.getContext('2d');
      state.previewCanvas.width = 1;
      state.previewCanvas.height = 1;
      ctx.clearRect(0, 0, 1, 1);
    }
    if (state.previewSvgHost) state.previewSvgHost.innerHTML = '';
  }

  function showPreviewCanvas() {
    state.previewCanvas?.classList?.remove('hidden');
    state.previewSvgHost?.classList?.add('hidden');
  }

  function showPreviewSvg() {
    state.previewCanvas?.classList?.add('hidden');
    state.previewSvgHost?.classList?.remove('hidden');
  }

  async function waitForScrapbookCartouchePreviewBridge(timeoutMs = 3000) {
    const started = Date.now();
    while ((Date.now() - started) < timeoutMs) {
      if (typeof window.renderScrapbookCartouchePreviewSvg === 'function') {
        return window.renderScrapbookCartouchePreviewSvg;
      }
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    return null;
  }

  function scheduleSelectedPreviewRender() {
    clearTimeout(state.previewTimer);
    state.previewTimer = setTimeout(() => {
      renderSelectedPreview().catch(err => {
        scrapbookCartoucheDebugWarn('[scrapbook-cartouche-db] preview render failed', err);
        if (state.previewStatus) state.previewStatus.textContent = 'Preview render failed.';
      });
    }, 120);
  }

  async function renderSelectedPreview() {
    const entry = getSelectedEntry();
    const previewInput = entry ? buildEntryRenderedPreviewInput(entry) : '';
    updateSelectedPreviewMetadata(entry, previewInput);
    if (!entry || (!state.previewCanvas && !state.previewSvgHost)) return;
    if (entry.mode === 'ignore') {
      if (state.previewStatus) state.previewStatus.textContent = 'Ignored entries do not render a cartouche.';
      clearSelectedPreviewGraphic();
      showPreviewCanvas();
      return;
    }

    const seq = ++state.previewSeq;
    if (state.previewStatus) state.previewStatus.textContent = 'Rendering preview…';
    const fontPx = 44;

    let vectorPreview = window.renderScrapbookCartouchePreviewSvg;
    if (typeof vectorPreview !== 'function') {
      vectorPreview = await waitForScrapbookCartouchePreviewBridge();
    }

    if (typeof vectorPreview !== 'function') {
      clearSelectedPreviewGraphic();
      showPreviewSvg();
      if (state.previewStatus) state.previewStatus.textContent = 'Preview renderer is not ready.';
      if (state.previewSvgHost) {
        state.previewSvgHost.textContent = 'Preview renderer is not ready. Close and reopen this popup after the page finishes loading.';
      }
      return;
    }

    try {
      const svgText = await vectorPreview({
        input: previewInput,
        fontPx,
        renderFontPreset: 'nasinNanpa',
        color: '#111111',
        spacingPreset: 'default',
        ignoreUnknownText: true,
        abbreviateNumericCartouches: false,
        paddingPx: 0,
      });
      if (seq !== state.previewSeq) return;
      clearSelectedPreviewGraphic();
      if (state.previewSvgHost) state.previewSvgHost.innerHTML = svgText;
      showPreviewSvg();
      if (state.previewStatus) state.previewStatus.textContent = 'Preview uses scrapbook page vector renderer.';
      return;
    } catch (err) {
      scrapbookCartoucheDebugWarn('[scrapbook-cartouche-db] app-vector preview failed', err);
      clearSelectedPreviewGraphic();
      showPreviewSvg();
      if (state.previewStatus) state.previewStatus.textContent = 'Preview render failed.';
      if (state.previewSvgHost) state.previewSvgHost.textContent = err?.message || String(err || 'Preview render failed.');
      return;
    }

  }

  function mutateEntryForLiveEdit(key, mutator) {
    const entries = getLocalEntries();
    const entry = entries.find(e => e.key === key);
    if (!entry) return null;
    mutator(entry);
    const normalised = normaliseEntry(entry);
    if (!normalised) return null;
    Object.assign(entry, normalised);
    window.ScrapbookCartoucheDbBridge?.setEntries?.(entries);
    setDocumentDirty();
    rebuildCombinedPageMap();
    updateSelectedPreviewMetadata(entry);
    scheduleSelectedPreviewRender();
    return entry;
  }


  // Element text is never rewritten by this module. app-vector.js prepares
  // sitelen source text at render time using the combined page map.

  function rebuildCombinedPageMap() {
    state.localMap = buildLocalPageMapFromEntries(getLocalEntries());
    const globalMap = getGlobalPageMap();
    state.combinedMap = mergePageMaps(globalMap, state.localMap);
    onCombinedPageMapChanged(state.combinedMap, { localMap: state.localMap, globalMap });
    requestRenderAll();
    return state.combinedMap;
  }

  async function initGlobalMap() {
    if (state.globalApi) return state.globalMap;
    try {
      state.globalApi = await CartoucheApi.open({ lookup: true, nanpaParser });
      state.globalMap = await state.globalApi.resolvePageMap();
    } catch (err) {
      scrapbookCartoucheDebugWarn('[scrapbook-cartouche-db] Global cartouche DB unavailable', err);
      state.globalMap = new Map();
    }
    return state.globalMap;
  }

  function addEntryFromInput() {
    const raw = (state.addInput?.value || '').trim();
    if (!raw) return;
    const parsed = parseAndValidateLocalProperNameLine(raw);
    if (!parsed.ok) {
      setStatus(parsed.reason, true);
      return;
    }
    const key = makeKey(parsed.words);
    const entries = getLocalEntries();
    if (entries.some(e => e.key === key)) {
      setStatus(`"${key}" is already in this scrapbook.`, true);
      return;
    }
    entries.unshift({
      key,
      words: parsed.words,
      merge: true,
      mode: 'random',
      cartoucheMap: {},
      tallyMap: {},
      forceNormal: true,
      literalText: key,
    });
    if (state.addInput) state.addInput.value = '';
    setStatus(`Added "${key}" to this scrapbook.`);
    setLocalEntries(entries);
  }

  function updateEntry(key, patch) {
    const entries = getLocalEntries().map(entry => {
      if (entry.key !== key) return entry;
      return normaliseEntry({ ...entry, ...patch }) || entry;
    });
    setLocalEntries(entries);
  }

  function deleteEntry(key) {
    setLocalEntries(getLocalEntries().filter(entry => entry.key !== key));
    setStatus(`Removed "${key}".`);
  }

  function renderList() {
    if (!state.list) return;
    const filter = (state.search?.value || '').trim().toLowerCase();
    const entries = getLocalEntries().filter(entry => !filter || entry.key.toLowerCase().includes(filter));
    const globalMap = getGlobalPageMap();

    state.list.innerHTML = '';
    if (!entries.length) {
      const empty = document.createElement('div');
      empty.className = 'scrapbookCartoucheDbHint';
      empty.textContent = filter ? 'No local names match this search.' : 'No scrapbook-local proper names yet.';
      state.list.appendChild(empty);
      updateSelectedPreviewMetadata(null);
      return;
    }

    if (!entries.some(entry => entry.key === state.selectedKey)) state.selectedKey = entries[0].key;

    for (const entry of entries) {
      const card = document.createElement('div');
      card.className = 'scrapbookCartoucheDbEntry';
      card.dataset.key = entry.key;
      card.classList.toggle('selected', entry.key === state.selectedKey);
      card.addEventListener('click', event => {
        if (!event.target.closest('input,select,textarea,button,a,label')) selectEntry(entry.key);
      });

      const header = document.createElement('div');
      header.className = 'scrapbookCartoucheDbEntryHeader';
      const titleWrap = document.createElement('div');
      const name = document.createElement('div');
      name.className = 'scrapbookCartoucheDbName';
      name.textContent = entry.key;
      titleWrap.appendChild(name);

      const badges = document.createElement('div');
      badges.className = 'scrapbookCartoucheDbBadges';
      for (const txt of [entry.mode, entry.merge ? 'merge' : 'split', entry.forceNormal ? '@db' : 'normal']) {
        const badge = document.createElement('span');
        badge.className = 'scrapbookCartoucheDbBadge';
        badge.textContent = txt;
        badges.appendChild(badge);
      }
      if (globalMap instanceof Map && globalMap.has(entry.key)) {
        const badge = document.createElement('span');
        badge.className = 'scrapbookCartoucheDbBadge override';
        badge.textContent = 'overrides global';
        badges.appendChild(badge);
      }
      titleWrap.appendChild(badges);
      header.appendChild(titleWrap);

      const actions = document.createElement('div');
      actions.className = 'scrapbookCartoucheDbActions';
      const deleteBtn = makeButton('Delete');
      deleteBtn.addEventListener('click', () => {
        if (confirm(`Remove "${entry.key}" from this scrapbook?`)) deleteEntry(entry.key);
      });
      actions.appendChild(deleteBtn);
      header.appendChild(actions);
      card.appendChild(header);

      const desc = document.createElement('div');
      desc.className = 'scrapbookCartoucheDbDesc';
      desc.textContent = buildEntryDisplayInput(entry);
      card.appendChild(desc);

      const grid = document.createElement('div');
      grid.className = 'scrapbookCartoucheDbGrid';

      const modeWrap = document.createElement('div');
      const modeLabel = document.createElement('label');
      modeLabel.textContent = 'Mode';
      const modeSelect = document.createElement('select');
      for (const mode of ['random', 'preferred', 'literal', 'ignore']) {
        const opt = document.createElement('option');
        opt.value = mode;
        opt.textContent = mode;
        opt.selected = entry.mode === mode;
        modeSelect.appendChild(opt);
      }
      modeSelect.addEventListener('change', () => { selectEntry(entry.key, { render: false }); updateEntry(entry.key, { mode: modeSelect.value }); });
      modeWrap.appendChild(modeLabel);
      modeWrap.appendChild(modeSelect);
      grid.appendChild(modeWrap);

      const mergeWrap = document.createElement('div');
      const mergeLabel = document.createElement('label');
      mergeLabel.textContent = 'Merge';
      const mergeInput = document.createElement('input');
      mergeInput.type = 'checkbox';
      mergeInput.checked = !!entry.merge;
      mergeInput.addEventListener('change', () => { selectEntry(entry.key, { render: false }); updateEntry(entry.key, { merge: mergeInput.checked }); });
      mergeWrap.appendChild(mergeLabel);
      mergeWrap.appendChild(mergeInput);
      grid.appendChild(mergeWrap);

      const forceWrap = document.createElement('div');
      const forceLabel = document.createElement('label');
      forceLabel.textContent = '@db';
      const forceInput = document.createElement('input');
      forceInput.type = 'checkbox';
      forceInput.checked = !!entry.forceNormal;
      forceInput.addEventListener('change', () => { selectEntry(entry.key, { render: false }); updateEntry(entry.key, { forceNormal: forceInput.checked }); });
      forceWrap.appendChild(forceLabel);
      forceWrap.appendChild(forceInput);
      grid.appendChild(forceWrap);

      const valueWrap = document.createElement('div');
      const valueLabel = document.createElement('label');
      valueLabel.textContent = entry.mode === 'literal' ? 'Literal text' : 'Preferred cartouche description, segment 0';
      const valueInput = document.createElement('input');
      valueInput.type = 'text';
      valueInput.spellcheck = false;
      valueInput.value = entry.mode === 'literal'
        ? (entry.literalText || entry.key)
        : ((entry.cartoucheMap || {})['0'] || '');
      valueInput.placeholder = entry.mode === 'literal' ? entry.key : 'e.g. soweli esun meli alasa';
      valueInput.addEventListener('focus', () => selectEntry(entry.key));
      valueInput.addEventListener('input', () => {
        selectEntry(entry.key, { render: false });
        mutateEntryForLiveEdit(entry.key, target => {
          if (target.mode === 'literal') {
            target.literalText = valueInput.value.replace(/"/g, '').trim() || target.key;
          } else {
            target.mode = 'preferred';
            target.cartoucheMap = { ...(target.cartoucheMap || {}), '0': valueInput.value.trim() };
          }
        });
        const currentDesc = card.querySelector('.scrapbookCartoucheDbDesc');
        const latest = getLocalEntries().find(e => e.key === entry.key);
        if (currentDesc && latest) currentDesc.textContent = buildEntryDisplayInput(latest);
      });
      valueWrap.appendChild(valueLabel);
      valueWrap.appendChild(valueInput);
      grid.appendChild(valueWrap);

      card.appendChild(grid);
      state.list.appendChild(card);
    }

    const selected = getSelectedEntry();
    if (selected) selectEntry(selected.key, { render: true });
  }

  function createWindow() {
    if (state.root) return state.root;
    ensureStyle();

    const root = document.createElement('div');
    root.id = 'scrapbookCartoucheDbWindow';
    root.className = 'floatingEditor scrapbookCartoucheDbWindow hidden';
    root.setAttribute('aria-hidden', 'true');

    const header = document.createElement('div');
    header.id = 'scrapbookCartoucheDbWindowHeader';
    header.className = 'floatingEditorHeader';
    const title = document.createElement('h3');
    title.textContent = 'Scrapbook Proper Names';
    const close = makeButton('Close');
    close.addEventListener('click', closeWindow);
    header.appendChild(title);
    header.appendChild(close);
    root.appendChild(header);

    const body = document.createElement('div');
    body.className = 'floatingEditorBody scrapbookCartoucheDbBody';

    const hint = document.createElement('div');
    hint.className = 'scrapbookCartoucheDbHint';

    hint.append(
      document.createTextNode('These proper-name entries are saved inside this scrapbook only. Local entries override matching ')
    );

    const globalDbLink = document.createElement('a');
    globalDbLink.href = './cartouche-db.html';
    globalDbLink.textContent = 'global cartouche DB';
    globalDbLink.target = '_blank';
    globalDbLink.rel = 'noopener noreferrer';

    hint.append(
      globalDbLink,
      document.createTextNode(' entries while this scrapbook is rendered.')
    );

    body.appendChild(hint);

    const toolbar = document.createElement('div');
    toolbar.className = 'scrapbookCartoucheDbToolbar';

    const searchWrap = document.createElement('div');
    const searchLabel = document.createElement('label');
    searchLabel.textContent = 'Search local names';
    const search = document.createElement('input');
    search.type = 'text';
    search.spellcheck = false;
    search.placeholder = 'filter…';
    search.addEventListener('input', renderList);
    searchWrap.appendChild(searchLabel);
    searchWrap.appendChild(search);
    toolbar.appendChild(searchWrap);

    const addWrap = document.createElement('div');
    const addLabel = document.createElement('label');
    addLabel.textContent = 'Add name';
    const addInput = document.createElement('input');
    addInput.type = 'text';
    addInput.spellcheck = false;
    addInput.placeholder = 'e.g. Sema Pan';
    addInput.addEventListener('keydown', event => {
      if (event.key === 'Enter') addEntryFromInput();
    });
    addWrap.appendChild(addLabel);
    addWrap.appendChild(addInput);
    toolbar.appendChild(addWrap);

    const addBtn = makeButton('Add');
    addBtn.addEventListener('click', addEntryFromInput);
    toolbar.appendChild(addBtn);

    body.appendChild(toolbar);

    const status = document.createElement('div');
    status.className = 'scrapbookCartoucheDbStatus';
    body.appendChild(status);

    const preview = document.createElement('div');
    preview.className = 'scrapbookCartoucheDbPreview';
    const previewHeader = document.createElement('div');
    previewHeader.className = 'scrapbookCartoucheDbPreviewHeader';
    const previewTitle = document.createElement('span');
    previewTitle.className = 'scrapbookCartoucheDbPreviewTitle';
    previewTitle.textContent = 'No selected entry';
    const previewStatus = document.createElement('span');
    previewStatus.textContent = '';
    previewHeader.appendChild(previewTitle);
    previewHeader.appendChild(previewStatus);
    const previewDesc = document.createElement('div');
    previewDesc.className = 'scrapbookCartoucheDbPreviewDesc';
    previewDesc.textContent = 'Select a local name entry to preview its cartouche rendering.';
    const previewCanvasWrap = document.createElement('div');
    previewCanvasWrap.className = 'scrapbookCartoucheDbPreviewCanvasWrap';
    const previewCanvas = document.createElement('canvas');
    previewCanvas.width = 1;
    previewCanvas.height = 1;
    const previewSvgHost = document.createElement('div');
    previewSvgHost.className = 'scrapbookCartoucheDbPreviewSvgHost hidden';
    previewCanvasWrap.appendChild(previewCanvas);
    previewCanvasWrap.appendChild(previewSvgHost);
    preview.appendChild(previewHeader);
    preview.appendChild(previewDesc);
    preview.appendChild(previewCanvasWrap);
    body.appendChild(preview);

    const list = document.createElement('div');
    list.className = 'scrapbookCartoucheDbList';
    body.appendChild(list);

    const ops = document.createElement('div');
    ops.className = 'scrapbookCartoucheDbOps';
    const exportBtn = makeButton('Export local names JSON');
    exportBtn.addEventListener('click', exportLocalJson);
    const importBtn = makeButton('Import local names JSON');
    importBtn.addEventListener('click', () => state.importInput?.click());
    const rebuildBtn = makeButton('Rebuild lookup map');
    rebuildBtn.addEventListener('click', () => {
      rebuildCombinedPageMap();
      setStatus('Rebuilt scrapbook cartouche lookup map.');
    });
    const clearBtn = makeButton('Clear local names');
    clearBtn.addEventListener('click', () => {
      if (!confirm('Clear all scrapbook-local proper names?')) return;
      setLocalEntries([]);
      setStatus('Cleared scrapbook-local proper names.');
    });
    const importInput = document.createElement('input');
    importInput.type = 'file';
    importInput.accept = 'application/json,.json';
    importInput.style.display = 'none';
    importInput.addEventListener('change', async () => {
      const file = importInput.files?.[0];
      importInput.value = '';
      if (file) await importLocalJsonFile(file);
    });
    ops.appendChild(exportBtn);
    ops.appendChild(importBtn);
    ops.appendChild(rebuildBtn);
    ops.appendChild(clearBtn);
    ops.appendChild(importInput);
    body.appendChild(ops);

    root.appendChild(body);
    (options.host || document.body).appendChild(root);

    state.root = root;
    state.list = list;
    state.search = search;
    state.addInput = addInput;
    state.status = status;
    state.previewRoot = preview;
    state.previewTitle = previewTitle;
    state.previewDesc = previewDesc;
    state.previewCanvas = previewCanvas;
    state.previewSvgHost = previewSvgHost;
    state.previewStatus = previewStatus;
    state.importInput = importInput;

    makeWindowDraggable(root, header);

    return root;
  }

  function openWindow() {
    createWindow();
    ensureDocumentDb();
    renderList();
    state.root.classList.remove('hidden');
    state.root.setAttribute('aria-hidden', 'false');
    setStatus(`${getLocalEntries().length} scrapbook-local entr${getLocalEntries().length === 1 ? 'y' : 'ies'}.`);
  }

  async function closeWindow() {
    if (!state.root) return;
    state.root.classList.add('hidden');
    state.root.setAttribute('aria-hidden', 'true');
    // Closing the names popout only updates the document-local cartouche DB and asks
    // app-vector.js to invalidate/re-render. It must not rewrite element text.
    rebuildCombinedPageMap();
    setDocumentDirty();
    requestRenderAll();
  }

  function toggleWindow() {
    if (!state.root || state.root.classList.contains('hidden')) openWindow();
    else closeWindow();
  }

  function exportLocalJson() {
    const payload = {
      type: DEFAULT_DB.type,
      version: DEFAULT_DB.version,
      exportedAt: new Date().toISOString(),
      entries: cloneJson(getLocalEntries()),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `scrapbook-cartouche-db-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  async function importLocalJsonFile(file) {
    let parsed;
    try {
      parsed = JSON.parse(await file.text());
    } catch {
      setStatus('Invalid JSON.', true);
      return;
    }
    const entries = Array.isArray(parsed?.entries) ? parsed.entries : [];
    if (!entries.length) {
      setStatus('No entries array found in imported file.', true);
      return;
    }
    const current = getLocalEntries();
    const byKey = new Map(current.map(entry => [entry.key, entry]));
    for (const entry of normaliseEntries(entries)) byKey.set(entry.key, entry);
    setLocalEntries(Array.from(byKey.values()));
    setStatus(`Imported ${entries.length} entr${entries.length === 1 ? 'y' : 'ies'} into this scrapbook.`);
  }

  async function init() {
    ensureDocumentDb();
    await initGlobalMap();
    rebuildCombinedPageMap();
    createWindow();

    const btn = document.getElementById('btnScrapbookNames');
    if (btn) btn.addEventListener('click', openWindow);
    const compactBtn = document.getElementById('compactBtnScrapbookNames');
    if (compactBtn) compactBtn.addEventListener('click', openWindow);

    return api;
  }

  function prepareInput(rawText) {
    try {
      return CartoucheApi.prepareInput(rawText, state.combinedMap || new Map());
    } catch (err) {
      scrapbookCartoucheDebugWarn('[scrapbook-cartouche-db] prepareInput failed', err);
      return String(rawText ?? '');
    }
  }

  const api = {
    init,
    open: openWindow,
    close: closeWindow,
    toggle: toggleWindow,
    ensureDocumentDb,
    getLocalEntries,
    setLocalEntries,
    rebuildCombinedPageMap,
    getLocalPageMap: () => state.localMap,
    getCombinedPageMap: () => state.combinedMap,
    prepareInput,
    exportLocalJson,
    importLocalJsonFile,
  };

  return api;
}

export default createScrapbookCartoucheDbController;
