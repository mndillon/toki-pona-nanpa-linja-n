/*
 * MIT — Publish a compiled Font Maker pair into the exact IndexedDB storage
 * schema used by sitelen-font-pair-controller on pages of the same site.
 * No server, network, font upload or additional package is involved.
 *
 * The Ligatures TTF supplies both the base (word) and companion (numeric)
 * role. The Literal TTF is the third, dedicated literal-cartouche role.
 */
export const SITE_FONT_DB = 'nanpaLinjaNFontPairs';
export const SITE_FONT_STORE = 'pairs';
export const SITE_FONT_CHANGED_EVENT = 'nanpa-fonts-changed';
export const SITE_FONT_KEY_PREFIX = 'site-font-maker:';
const FONT_LOAD_SAMPLE = String.fromCodePoint(0xF196C, 0xF1954, 0xF1990) + ' Hello';

function nonempty(value, fallback = '') {
  return String(value ?? '').trim() || fallback;
}
function validateTtf(bytes, description) {
  if (!(bytes instanceof Uint8Array) || bytes.byteLength < 300) {
    throw new Error(`${description} font is not a compiled TrueType byte array.`);
  }
  const magic = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(0);
  if (magic !== 0x00010000) throw new Error(`${description} font has an invalid TrueType header.`);
}
function projectKey(project) {
  const id = nonempty(project?.id);
  if (!id || id.length > 256) throw new Error('A saved project ID is required to use the font on this site.');
  return `${SITE_FONT_KEY_PREFIX}${id}`;
}
function familyId(project) {
  // The family names are stable across updates from the same project. They are
  // separate from the font's internal family so different projects cannot
  // collide even when the designer gives both fonts the same name.
  return [...nonempty(project.id)].map(char => /[A-Za-z0-9]/.test(char)
    ? char : `_${char.codePointAt(0).toString(16)}_`).join('').slice(0, 450);
}

export function buildSiteFontPairRecord({ project, normal, literal, previous = null, packageInfo = null, now = new Date().toISOString() }) {
  if (!project || typeof project !== 'object') throw new Error('A Font Maker project is required.');
  validateTtf(normal, 'Ligatures');
  validateTtf(literal, 'Literal');
  const fontKey = projectKey(project);
  const identifier = familyId(project);
  const fontIdentity = project?.settings?.fontIdentity || {};
  const label = nonempty(fontIdentity.family, nonempty(project.name, 'Font Maker font'));
  const style = nonempty(fontIdentity.style, 'Regular');
  const fontLabel = `${label}${style !== 'Regular' ? ` (${style})` : ''} (Font Maker)`;
  const ligaturesBlob = new Blob([normal], { type: 'font/ttf' });
  const literalBlob = new Blob([literal], { type: 'font/ttf' });
  const familyBase = `SPFM_${identifier}`;
  const ligaturesFilename = `${nonempty(fontIdentity.postScriptName, 'FontMaker')}-Ligatures.ttf`;
  const literalFilename = `${nonempty(fontIdentity.postScriptName, 'FontMaker')}-Literal.ttf`;
  return {
    fontKey,
    fontLabel,
    label: fontLabel,
    baseFamily: `${familyBase}_Ligatures`,
    companionFamily: `${familyBase}_Numbers`,
    literalCartoucheFamily: `${familyBase}_Literal`,
    baseFilename: ligaturesFilename,
    companionFilename: ligaturesFilename,
    literalCartoucheFilename: literalFilename,
    baseFormat: 'truetype',
    companionFormat: 'truetype',
    literalCartoucheFormat: 'truetype',
    baseBlob: ligaturesBlob,
    companionBlob: ligaturesBlob,
    literalCartoucheBlob: literalBlob,
    baseSample: FONT_LOAD_SAMPLE,
    companionSample: FONT_LOAD_SAMPLE,
    literalCartoucheSample: '["ABC"]',
    baseUrl: '',
    companionUrl: '',
    literalCartoucheUrl: '',
    // The site controller recognizes these exact option keys. Only these two
    // are offered by default so the paired Literal font is selected for text.
    literalOptions: [
      ['__active_cartouche_family__', 'literal font'],
      ['__active_text_family__', 'sitelen font'],
    ],
    parserMode: 'sitelen-pona-ascii-extended',
    renderAdapterId: 'identity',
    renderAdapterSettings: {},
    sourceType: 'indexeddb',
    editable: true,
    metadataSuffix: '-nanpa-linja-n',
    settings: {
      cartoucheCommaTallyMarks: true,
      cartoucheTallyMode: 'ucsur',
      cartoucheVulgarFractions: true,
      emulateLegacyCartoucheScaling: false,
      literalCartoucheEncoding: 'ascii-quoted',
    },
    support: {
      origin: 'sitelen-pona-font-maker',
      sourceProjectId: nonempty(project.id),
      sourceFontFamily: label,
      generatedFontPair: true,
      ...(packageInfo ? {verifiedPortablePackage:{
        manifestVersion:packageInfo.manifestVersion,
        exportedAt:String(packageInfo.exportedAt||''),
        licenceFiles:Array.isArray(packageInfo.licenceFiles)?packageInfo.licenceFiles.slice(0,64):[],
      }} : {}),
    },
    notes: 'Compiled in sitelen pona Font Maker; font rights and licence compliance remain the user’s responsibility.',
    createdAt: nonempty(previous?.createdAt, now),
    updatedAt: now,
  };
}

function openSiteFontDb() {
  if (typeof indexedDB === 'undefined') throw new Error('IndexedDB is unavailable. Use a normal HTTPS or localhost site page.');
  return new Promise((resolve, reject) => {
    // No explicit version: compatible with the site's current or future DB
    // version, without downgrading or starting an unnecessary schema migration.
    const request = indexedDB.open(SITE_FONT_DB);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(SITE_FONT_STORE)) {
        const store = db.createObjectStore(SITE_FONT_STORE, { keyPath: 'fontKey' });
        store.createIndex('label', 'label', { unique: false });
        store.createIndex('updatedAt', 'updatedAt', { unique: false });
        store.createIndex('sourceType', 'sourceType', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Could not open the site font library.'));
    request.onblocked = () => reject(new Error('The site font database is blocked by another tab. Close other tabs and try again.'));
  });
}
function readExisting(db, key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SITE_FONT_STORE, 'readonly');
    const request = tx.objectStore(SITE_FONT_STORE).get(key);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error || new Error('Could not read the existing site font.'));
    tx.onabort = () => reject(tx.error || new Error('Site font read was interrupted.'));
  });
}
function commitRecord(db, record) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SITE_FONT_STORE, 'readwrite');
    tx.oncomplete = () => resolve(); // do not claim success on request.onsuccess
    tx.onerror = () => reject(tx.error || new Error('Could not save to the site font library.'));
    tx.onabort = () => reject(tx.error || new Error('Site font save was interrupted.'));
    tx.objectStore(SITE_FONT_STORE).put(record);
  });
}

export async function useFontOnThisSite({ project, normal, literal, packageInfo = null }) {
  // Validate all the input before making any persistent changes.
  const candidate = buildSiteFontPairRecord({ project, normal, literal });
  const db = await openSiteFontDb();
  try {
    if (!db.objectStoreNames.contains(SITE_FONT_STORE)) {
      throw new Error('The site font library has no pairs store. Its schema must be initialized by the site controller.');
    }
    const previous = await readExisting(db, candidate.fontKey);
    // Do not overwrite another record if a user-imported JSON project reuses
    // an ID already used by an unrelated site-font entry.
    if (previous && previous?.support?.origin !== 'sitelen-pona-font-maker') {
      throw new Error('This project ID conflicts with another entry in the site font library.');
    }
    const record = buildSiteFontPairRecord({ project, normal, literal, previous, packageInfo });
    await commitRecord(db, record);
    try {
      window.dispatchEvent(new CustomEvent(SITE_FONT_CHANGED_EVENT, {
        detail: { key: record.fontKey, fontKey: record.fontKey, type: previous ? 'update' : 'save', controller: 'sitelen-pona-font-maker' },
      }));
    } catch (_) { /* notification is best-effort; committed storage is authoritative */ }
    return { fontKey: record.fontKey, label: record.label, updated: !!previous };
  } finally {
    db.close();
  }
}

/** Look up an existing site font without modifying anything (for overwrite confirmation). */
export async function getSiteFontForProject(projectId){
  const fontKey = projectKey({id:projectId});
  const db = await openSiteFontDb();
  try{
    if(!db.objectStoreNames.contains(SITE_FONT_STORE))return null;
    const record=await readExisting(db,fontKey);
    if(!record)return null;
    return {fontKey,label:record.label,origin:record?.support?.origin||''};
  }finally{db.close();}
}
