const SCRAPBOOK_CARTOUCHE_DB_BRIDGE_DEBUG = !!globalThis.SCRAPBOOK_CARTOUCHE_DB_DEBUG;
function scrapbookCartoucheBridgeWarn(...args) {
  if (SCRAPBOOK_CARTOUCHE_DB_BRIDGE_DEBUG) scrapbookCartoucheBridgeWarn(...args);
}

/* scrapbook-cartouche-db-integration-bridge v12
   Early bridge for scrapbook-local proper-name DB persistence and render refresh.
   Loads before app-vector.js so IndexedDB writes can be augmented with document.cartoucheDb. */

const DEFAULT_DB = Object.freeze({
  type: 'scrapbook-cartouche-db',
  version: 1,
  entries: [],
});

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function ensureDbObject(value) {
  const db = value && typeof value === 'object' ? value : {};
  if (db.type !== DEFAULT_DB.type) db.type = DEFAULT_DB.type;
  if (!Number.isFinite(db.version)) db.version = DEFAULT_DB.version;
  if (!Array.isArray(db.entries)) db.entries = [];
  return db;
}

function ensureDocumentDb(doc) {
  if (!doc || typeof doc !== 'object') return cloneJson(DEFAULT_DB);
  doc.cartoucheDb = ensureDbObject(doc.cartoucheDb);
  return doc.cartoucheDb;
}

function getObjectKeyFromKeyPath(value, keyPath) {
  if (!value || typeof value !== 'object' || !keyPath) return undefined;
  if (Array.isArray(keyPath)) return keyPath.map(k => value?.[k]).join('|');
  return String(keyPath).split('.').reduce((acc, part) => acc && acc[part], value);
}

function looksLikeElement(value) {
  if (!value || typeof value !== 'object') return false;
  const t = String(value.type || value.kind || '').toLowerCase();
  return ['text','sitelen','glyph','image','audio','video','url','rect','rectangle','group'].includes(t)
    || typeof value.text === 'string'
    || typeof value.rawText === 'string'
    || typeof value.input === 'string';
}

function containsElementList(value, depth = 0) {
  if (!value || typeof value !== 'object' || depth > 4) return false;
  if (Array.isArray(value)) {
    if (value.some(looksLikeElement)) return true;
    return value.some(v => containsElementList(v, depth + 1));
  }
  for (const [k, v] of Object.entries(value)) {
    const lk = k.toLowerCase();
    if ((lk === 'elements' || lk === 'items' || lk === 'objects') && Array.isArray(v) && v.some(looksLikeElement)) return true;
    if ((lk === 'pages' || lk === 'scenes' || lk === 'documents') && containsElementList(v, depth + 1)) return true;
  }
  return false;
}

function looksLikeScrapbookDocument(value) {
  if (!value || typeof value !== 'object') return false;
  if (value.cartoucheDb && value.cartoucheDb.type === DEFAULT_DB.type) return true;
  if (containsElementList(value)) return true;
  const keys = Object.keys(value).map(k => k.toLowerCase());
  const hasStage = keys.some(k => ['stagew','stageh','stagewidth','stageheight','stage','grid','pages','scenes','elements'].includes(k));
  const hasDocWords = keys.some(k => ['scrapbook','document','currentpageid','activepageid','background','backgroundimage'].includes(k));
  return hasStage && hasDocWords;
}

function findDocumentTargets(record, depth = 0, out = []) {
  if (!record || typeof record !== 'object' || depth > 4) return out;
  if (looksLikeScrapbookDocument(record)) out.push(record);
  for (const key of ['document','doc','data','payload','value','scrapbook','scene']) {
    const child = record[key];
    if (child && typeof child === 'object') findDocumentTargets(child, depth + 1, out);
  }
  return [...new Set(out)];
}

function mergeDbIntoRecord(record, dbSource) {
  if (!record || typeof record !== 'object') return record;
  const db = cloneJson(ensureDbObject(dbSource));
  const targets = findDocumentTargets(record);
  if (!targets.length) return record;
  for (const target of targets) target.cartoucheDb = cloneJson(db);
  return record;
}

const state = {
  db: cloneJson(DEFAULT_DB),
  boundDocument: null,
  candidates: new Map(),
  dirty: false,
  patchedIndexedDb: false,
};


const LOCAL_NAMES_DB_NAME = 'scrapbook-cartouche-db-local-names';
const LOCAL_NAMES_DB_VERSION = 1;
const LOCAL_NAMES_STORE = 'state';
const LOCAL_NAMES_KEY = 'default';

function openLocalNamesDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(LOCAL_NAMES_DB_NAME, LOCAL_NAMES_DB_VERSION);
    req.onupgradeneeded = event => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(LOCAL_NAMES_STORE)) {
        db.createObjectStore(LOCAL_NAMES_STORE, { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || req.result);
  });
}

async function saveLocalNamesSnapshot() {
  try {
    const db = await openLocalNamesDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(LOCAL_NAMES_STORE, 'readwrite');
      tx.objectStore(LOCAL_NAMES_STORE).put({
        key: LOCAL_NAMES_KEY,
        cartoucheDb: cloneJson(getCurrentDb()),
        updatedAt: new Date().toISOString(),
      });
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch (err) {
    scrapbookCartoucheBridgeWarn('[scrapbook-cartouche-db-bridge] local names snapshot save failed', err);
  }
}

async function loadLocalNamesSnapshot() {
  try {
    const db = await openLocalNamesDb();
    const saved = await new Promise(resolve => {
      const tx = db.transaction(LOCAL_NAMES_STORE, 'readonly');
      const req = tx.objectStore(LOCAL_NAMES_STORE).get(LOCAL_NAMES_KEY);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
    db.close();
    if (saved && saved.cartoucheDb && Array.isArray(saved.cartoucheDb.entries)) {
      const loaded = ensureDbObject(cloneJson(saved.cartoucheDb));
      if (loaded.entries.length && !state.db.entries.length) state.db = loaded;
      window.__scrapbookCartoucheDbEntries = state.db.entries;
    }
  } catch (err) {
    scrapbookCartoucheBridgeWarn('[scrapbook-cartouche-db-bridge] local names snapshot load failed', err);
  }
}

function candidateKey(dbName, storeName, key) {
  return `${dbName || '?'}::${storeName || '?'}::${String(key ?? '?')}`;
}

function getCurrentDb() {
  if (state.boundDocument && typeof state.boundDocument === 'object') {
    return ensureDocumentDb(state.boundDocument);
  }
  return ensureDbObject(state.db);
}

function setCurrentEntries(entries) {
  const targetDb = getCurrentDb();
  targetDb.entries = Array.isArray(entries) ? cloneJson(entries) : [];
  state.db = cloneJson(targetDb);
  if (state.boundDocument) state.boundDocument.cartoucheDb = targetDb;
  state.dirty = true;
  window.__scrapbookCartoucheDbEntries = targetDb.entries;
  void saveLocalNamesSnapshot();
}

function bindDocument(doc) {
  if (!doc || typeof doc !== 'object') return null;
  state.boundDocument = doc;
  const db = ensureDocumentDb(doc);
  if (state.db?.entries?.length && !db.entries.length) db.entries = cloneJson(state.db.entries);
  state.db = cloneJson(db);
  window.__scrapbookCartoucheDbDocument = doc;
  window.__scrapbookCartoucheDbDocumentBound = true;
  window.__scrapbookCartoucheDbFallbackActive = false;
  return doc;
}

function registerRecord(value, meta = {}) {
  if (!value || typeof value !== 'object') return;
  const targets = findDocumentTargets(value);
  if (!targets.length) return;
  const targetWithDb = targets.find(t => t.cartoucheDb && Array.isArray(t.cartoucheDb.entries));
  if (!state.boundDocument && targetWithDb) bindDocument(targetWithDb);
  else if (!state.boundDocument && targets[0]) bindDocument(targets[0]);

  let key = meta.key;
  if (key == null && meta.keyPath) key = getObjectKeyFromKeyPath(value, meta.keyPath);
  if (meta.dbName && meta.storeName && key != null) {
    state.candidates.set(candidateKey(meta.dbName, meta.storeName, key), { ...meta, key });
  }
}

function injectIntoValue(value, meta = {}) {
  if (!value || typeof value !== 'object') return value;
  const targets = findDocumentTargets(value);
  if (!targets.length) return value;
  mergeDbIntoRecord(value, getCurrentDb());
  registerRecord(value, meta);
  return value;
}

async function openDb(dbName) {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(dbName);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function flushCandidatesToIndexedDb() {
  const dbObj = getCurrentDb();
  const candidates = Array.from(state.candidates.values());
  for (const c of candidates) {
    try {
      const db = await openDb(c.dbName);
      if (!db.objectStoreNames.contains(c.storeName)) { db.close(); continue; }
      await new Promise(resolve => {
        const tx = db.transaction(c.storeName, 'readwrite');
        const store = tx.objectStore(c.storeName);
        const getReq = store.get(c.key);
        getReq.onsuccess = () => {
          const value = getReq.result;
          if (value && typeof value === 'object') {
            injectIntoValue(value, c);
            mergeDbIntoRecord(value, dbObj);
            
            // Respect the object store's key mode. Inline-key stores must not
            // receive a key argument; out-of-line stores need the explicit key.
            if (store.keyPath != null) {
              store.put(value);
            } else if (c.key != null) {
              store.put(value, c.key);
            } else {
              store.put(value);
            }
          }
        };
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => { scrapbookCartoucheBridgeWarn('[scrapbook-cartouche-db-bridge] candidate flush failed', c, tx.error); try { db.close(); } catch {} resolve(); };
      });
    } catch (err) {
      scrapbookCartoucheBridgeWarn('[scrapbook-cartouche-db-bridge] candidate DB open failed', c, err);
    }
  }
  state.dirty = false;
}

function patchIndexedDb() {
  if (state.patchedIndexedDb || !window.IDBObjectStore) return;
  state.patchedIndexedDb = true;

  const proto = window.IDBObjectStore.prototype;
  const originalPut = proto.put;
  const originalAdd = proto.add;
  const originalGet = proto.get;
  const originalGetAll = proto.getAll;

  function metaForStore(store, key) {
    let dbName = '';
    try { dbName = store.transaction?.db?.name || ''; } catch {}
    return { dbName, storeName: store.name, keyPath: store.keyPath, key };
  }

  if (typeof originalPut === 'function') {
    proto.put = function scrapbookCartouchePatchedPut(value, key, ...rest) {
      const hasExplicitKey = arguments.length >= 2;
      const effectiveKey = hasExplicitKey ? key : getObjectKeyFromKeyPath(value, this.keyPath);
      const meta = metaForStore(this, effectiveKey);
      injectIntoValue(value, meta);
      // Important: do not pass an undefined key argument. For out-of-line-key
      // object stores with no key generator, IDB treats an explicit undefined
      // key parameter as invalid and throws DataError.
      // Inline-key stores throw if a separate key argument is supplied.
      // If the wrapped application accidentally supplies one, preserve the
      // record and call native put(value) so the object's own keyPath is used.
      const isInlineKeyStore = this.keyPath != null;
      if (isInlineKeyStore) return originalPut.call(this, value);
      return hasExplicitKey
        ? originalPut.call(this, value, key, ...rest)
        : originalPut.call(this, value);
    };
  }

  if (typeof originalAdd === 'function') {
    proto.add = function scrapbookCartouchePatchedAdd(value, key, ...rest) {
      const hasExplicitKey = arguments.length >= 2;
      const effectiveKey = hasExplicitKey ? key : getObjectKeyFromKeyPath(value, this.keyPath);
      const meta = metaForStore(this, effectiveKey);
      injectIntoValue(value, meta);
      const isInlineKeyStore = this.keyPath != null;
      if (isInlineKeyStore) return originalAdd.call(this, value);
      return hasExplicitKey
        ? originalAdd.call(this, value, key, ...rest)
        : originalAdd.call(this, value);
    };
  }

  if (typeof originalGet === 'function') {
    proto.get = function scrapbookCartouchePatchedGet(key, ...rest) {
      const req = originalGet.call(this, key, ...rest);
      const meta = metaForStore(this, key);
      req.addEventListener('success', () => registerRecord(req.result, meta));
      return req;
    };
  }

  if (typeof originalGetAll === 'function') {
    proto.getAll = function scrapbookCartouchePatchedGetAll(...args) {
      const req = originalGetAll.apply(this, args);
      const meta = metaForStore(this, undefined);
      req.addEventListener('success', () => {
        const rows = Array.isArray(req.result) ? req.result : [];
        for (const row of rows) {
          const key = getObjectKeyFromKeyPath(row, meta.keyPath);
          registerRecord(row, { ...meta, key });
        }
      });
      return req;
    };
  }
}

function requestRefresh() {
  const detail = { cartoucheDb: getCurrentDb(), entries: cloneJson(getCurrentDb().entries) };
  window.dispatchEvent(new CustomEvent('scrapbook-cartouche-db:document-updated', { detail }));
  window.dispatchEvent(new CustomEvent('scrapbook-cartouche-db:render-refresh-requested', { detail }));
  window.dispatchEvent(new Event('resize'));

  try { window.scrapbookCartoucheDb?.applyPreparedInputsToDocument?.(); } catch (err) { scrapbookCartoucheBridgeWarn('[scrapbook-cartouche-db-bridge] apply prepared inputs failed', err); }

  for (const fnName of [
    'invalidateSitelenElementCaches','invalidateAllSitelenCaches','clearElementVectorCache','clearVectorCaches',
    'scheduleRenderAll','requestRenderAll','renderAll','renderScene','drawScene','renderCurrentPage','rebuildSvgStage','renderStage'
  ]) {
    const fn = window[fnName];
    if (typeof fn === 'function') {
      try { fn.call(window); } catch (err) { scrapbookCartoucheBridgeWarn(`[scrapbook-cartouche-db-bridge] ${fnName} failed`, err); }
    }
  }

  // Nudge common editor inputs so module-scoped app code that listens to DOM changes can refresh the selected element.
  for (const id of ['floatingTextEditorTextarea']) {
    const el = document.getElementById(id);
    if (el) {
      try { el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); } catch {}
    }
  }
}

async function markDirtyAndFlush() {
  state.dirty = true;
  if (state.boundDocument) ensureDocumentDb(state.boundDocument).entries = cloneJson(getCurrentDb().entries);
  await saveLocalNamesSnapshot();
  await flushCandidatesToIndexedDb();
  requestRefresh();
}

void loadLocalNamesSnapshot();
patchIndexedDb();

window.ScrapbookCartoucheDbBridge = {
  version: 12,
  ensureDocumentDb,
  bindDocument,
  getDocument: () => state.boundDocument || window.__scrapbookCartoucheDbDocument || null,
  getDb: getCurrentDb,
  setEntries: setCurrentEntries,
  saveLocalNamesSnapshot,
  loadLocalNamesSnapshot,
  registerRecord,
  injectIntoValue,
  flushCandidatesToIndexedDb,
  markDirtyAndFlush,
  requestRefresh,
};

window.addEventListener('beforeunload', () => {
  try { flushCandidatesToIndexedDb(); } catch {}
});
