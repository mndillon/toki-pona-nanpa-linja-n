const SCRAPBOOK_CARTOUCHE_DB_BOOTSTRAP_DEBUG = !!globalThis.SCRAPBOOK_CARTOUCHE_DB_DEBUG;
function scrapbookCartoucheBootstrapWarn(...args) {
  if (SCRAPBOOK_CARTOUCHE_DB_BOOTSTRAP_DEBUG) console.warn(...args);
}
function scrapbookCartoucheBootstrapError(...args) {
  if (SCRAPBOOK_CARTOUCHE_DB_BOOTSTRAP_DEBUG) console.error(...args);
}

import { createScrapbookCartoucheDbController } from './scrapbook-cartouche-db.js?v=78';

const DEFAULT_DB = {
  type: 'scrapbook-cartouche-db',
  version: 1,
  entries: [],
};

const FALLBACK_DB_NAME = 'scrapbook-cartouche-db-fallback';
const FALLBACK_DB_VERSION = 1;
const FALLBACK_STORE = 'documents';
const FALLBACK_KEY = 'default';

let boundDocument = null;
let boundCallbacks = {};
let controllerRef = null;
let fallbackDocument = {
  cartoucheDb: JSON.parse(JSON.stringify(DEFAULT_DB)),
};

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function ensureDocDb(doc) {
  if (!doc || typeof doc !== 'object') return null;
  if (!doc.cartoucheDb || typeof doc.cartoucheDb !== 'object') {
    doc.cartoucheDb = cloneJson(DEFAULT_DB);
  }
  if (doc.cartoucheDb.type !== DEFAULT_DB.type) doc.cartoucheDb.type = DEFAULT_DB.type;
  if (!Number.isFinite(doc.cartoucheDb.version)) doc.cartoucheDb.version = DEFAULT_DB.version;
  if (!Array.isArray(doc.cartoucheDb.entries)) doc.cartoucheDb.entries = [];
  return doc.cartoucheDb;
}

function openFallbackDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(FALLBACK_DB_NAME, FALLBACK_DB_VERSION);
    req.onupgradeneeded = event => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(FALLBACK_STORE)) db.createObjectStore(FALLBACK_STORE, { keyPath: 'key' });
    };
    req.onsuccess = event => resolve(event.target.result);
    req.onerror = event => reject(event.target.error || req.error);
  });
}

async function loadFallbackDocument() {
  try {
    const db = await openFallbackDb();
    const saved = await new Promise(resolve => {
      const tx = db.transaction(FALLBACK_STORE, 'readonly');
      const req = tx.objectStore(FALLBACK_STORE).get(FALLBACK_KEY);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
    db.close();
    if (saved && saved.document && typeof saved.document === 'object') {
      fallbackDocument = saved.document;
      ensureDocDb(fallbackDocument);
    }
  } catch (err) {
    scrapbookCartoucheBootstrapWarn('[scrapbook-cartouche-db-bootstrap] fallback DB load failed', err);
  }
  window.__scrapbookCartoucheDbFallbackDocument = fallbackDocument;
  return fallbackDocument;
}

async function saveFallbackDocument() {
  try {
    ensureDocDb(fallbackDocument);
    const db = await openFallbackDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(FALLBACK_STORE, 'readwrite');
      tx.objectStore(FALLBACK_STORE).put({
        key: FALLBACK_KEY,
        document: fallbackDocument,
        updatedAt: new Date().toISOString(),
      });
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch (err) {
    scrapbookCartoucheBootstrapWarn('[scrapbook-cartouche-db-bootstrap] fallback DB save failed', err);
  }
}

function getBestKnownDocument() {
  try {
    const fromGetter = (typeof window.getCurrentScrapbookDocument === 'function')
      ? window.getCurrentScrapbookDocument()
      : null;
    if (fromGetter && typeof fromGetter === 'object') {
      boundDocument = fromGetter;
      ensureDocDb(boundDocument);
      return boundDocument;
    }
  } catch {}

  if (boundDocument && typeof boundDocument === 'object') {
    ensureDocDb(boundDocument);
    return boundDocument;
  }

  if (window.currentScrapbookDocument && typeof window.currentScrapbookDocument === 'object') {
    boundDocument = window.currentScrapbookDocument;
    ensureDocDb(boundDocument);
    return boundDocument;
  }

  ensureDocDb(fallbackDocument);
  return fallbackDocument;
}

function getGlobalPageMap() {
  try {
    if (typeof boundCallbacks.getGlobalPageMap === 'function') {
      const m = boundCallbacks.getGlobalPageMap();
      if (m instanceof Map) return m;
    }
  } catch (err) {
    scrapbookCartoucheBootstrapWarn('[scrapbook-cartouche-db-bootstrap] getGlobalPageMap callback failed', err);
  }
  if (window.globalCartouchePageMap instanceof Map) return window.globalCartouchePageMap;
  if (window.cartouchePageMap instanceof Map) return window.cartouchePageMap;
  return new Map();
}

function markDirty() {
  try {
    if (typeof boundCallbacks.setDocumentDirty === 'function') {
      boundCallbacks.setDocumentDirty();
      return;
    }
  } catch (err) {
    scrapbookCartoucheBootstrapWarn('[scrapbook-cartouche-db-bootstrap] setDocumentDirty callback failed', err);
  }
  void saveFallbackDocument();
}

function requestRenderAll() {
  try {
    if (typeof boundCallbacks.requestRenderAll === 'function') {
      boundCallbacks.requestRenderAll();
      return;
    }
  } catch (err) {
    scrapbookCartoucheBootstrapWarn('[scrapbook-cartouche-db-bootstrap] requestRenderAll callback failed', err);
  }
  window.dispatchEvent(new CustomEvent('scrapbook-cartouche-db:request-render'));
}

function installRendererInputBridge(controller) {
  // Debug/manual helper only. app-vector.js uses the combined page map directly.
  window.prepareScrapbookCartoucheInput = rawInput => controller.prepareInput(rawInput);
}

window.registerScrapbookCartoucheDbDocument = function registerScrapbookCartoucheDbDocument(realDocument, callbacks = {}) {
  if (realDocument && typeof realDocument === 'object') {
    boundDocument = realDocument;
    ensureDocDb(boundDocument);
    window.currentScrapbookDocument = boundDocument;
  }
  boundCallbacks = callbacks && typeof callbacks === 'object' ? callbacks : {};

  if (controllerRef) {
    try { controllerRef.ensureDocumentDb(); } catch (err) { scrapbookCartoucheBootstrapWarn('[scrapbook-cartouche-db-bootstrap] ensureDocumentDb failed', err); }
    try { controllerRef.rebuildCombinedPageMap(); } catch (err) { scrapbookCartoucheBootstrapWarn('[scrapbook-cartouche-db-bootstrap] rebuildCombinedPageMap failed', err); }
  }
  return controllerRef;
};

async function initScrapbookCartoucheDb() {
  if (window.scrapbookCartoucheDb && window.scrapbookCartoucheDb.__bootstrapReady) return window.scrapbookCartoucheDb;

  await loadFallbackDocument();

  const controller = createScrapbookCartoucheDbController({
    getDocument: getBestKnownDocument,
    setDocumentDirty: markDirty,
    requestRenderAll,
    getGlobalPageMap,
    onCombinedPageMapChanged: (combinedMap, detail) => {
      window.scrapbookCartouchePageMap = combinedMap;
      window.scrapbookLocalCartouchePageMap = detail?.localMap || new Map();
      window.dispatchEvent(new CustomEvent('scrapbook-cartouche-db:changed', {
        detail: {
          combinedMap,
          localMap: detail?.localMap || new Map(),
          globalMap: detail?.globalMap || new Map(),
        },
      }));
    },
    nanpaParser: window.NanpaParser || null,
  });

  controllerRef = controller;
  await controller.init();
  controller.__bootstrapReady = true;
  window.scrapbookCartoucheDb = controller;
  installRendererInputBridge(controller);

  // If app-vector.js has already exposed a document, bind it immediately.
  const doc = getBestKnownDocument();
  if (doc && doc !== fallbackDocument) {
    window.registerScrapbookCartoucheDbDocument(doc, boundCallbacks);
  }

  window.dispatchEvent(new CustomEvent('scrapbook-cartouche-db:ready', { detail: { controller } }));
  return controller;
}

initScrapbookCartoucheDb().catch(err => {
  scrapbookCartoucheBootstrapError('[scrapbook-cartouche-db-bootstrap] init failed', err);
});
