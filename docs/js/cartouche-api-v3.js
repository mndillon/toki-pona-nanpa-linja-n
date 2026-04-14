/**
 * cartouche-api.js
 * Shared site-wide cartouche database API.
 *
 * Usage:
 *   import { CartoucheApi } from './cartouche-api-v3.js';
 *
 *   // DB page (read/write, no lookup):
 *   const api = await CartoucheApi.open({ lookup: false });
 *
 *   // Renderer pages (read-only cache, greedy scan):
 *   const api = await CartoucheApi.open({ lookup: true });
 *   const pageMap = await api.resolvePageMap();   // call once at page init
 *   // then use CartoucheApi.greedyScan(words, pageMap) before each render
 */

// ── Constants ──────────────────────────────────────────────────────────────
const DB_NAME    = 'cartouche-db-site';
const DB_VERSION = 3;
const STORE      = 'entries';

const VOWELS     = new Set(['a','e','i','o','u']);
const CONSONANTS = new Set(['p','t','k','m','n','s','w','l','j']);
const FORBIDDEN  = new Set(['ji','ti','wu','wo']);

// ── TP word list for random cartouche generation ───────────────────────────
const TP_WORDS_BY_LETTER = (() => {
  const all = [
    'a','akesi','ala','alasa','ale','anpa','ante','anu','awen',
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
    'unpa','uta','utala',
    'walo','wan','waso','wawa','weka','wile',
  ];
  const map = {};
  for (const w of all) {
    const c = w[0];
    if (!map[c]) map[c] = [];
    map[c].push(w);
  }
  return map;
})();

function randFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}



const TP_KNOWN_WORDS = new Set(
  Object.values(TP_WORDS_BY_LETTER).flat()
);

function mergedLettersToWord(words) {
  return segmentLetters(words).letters.join('');
}

function entryRequiresAtDbForTpWordCollision(entry) {
  if (!entry || !Array.isArray(entry.words) || !entry.words.length) return false;

  const segs = segmentWords(entry.words);

  for (const seg of segs) {
    if (seg.type !== 'normal') continue;

    // If merge is on, this segment becomes one cartouche word after merge.
    if (entry.merge) {
      const merged = mergedLettersToWord(seg.words);
      if (TP_KNOWN_WORDS.has(merged)) return true;
    } else {
      // If merge is off, each separate word becomes its own cartouche.
      for (const w of seg.words) {
        if (TP_KNOWN_WORDS.has(w.toLowerCase())) return true;
      }
    }
  }

  return false;
}


function getEntryLookupAliases(entry) {
  const aliases = new Set();

  if (!entry || !Array.isArray(entry.words) || !entry.words.length) return aliases;

  // Always include the exact DB key.
  aliases.add(entry.key);

  // Only include merged single-word alias when this record is merge=true.
  if (entry.merge) {
    const segs = segmentWords(entry.words);
    for (const seg of segs) {
      if (seg.type !== 'normal') continue;
      const merged = segmentLetters(seg.words).letters.join('');
      if (merged) {
        aliases.add(merged.charAt(0).toUpperCase() + merged.slice(1));
      }
    }
  }

  return aliases;
}

// ── CV(N) validation ───────────────────────────────────────────────────────
export function validateTpWord(w) {
  // TODO: digit support coming later
  if (!/^[A-Za-z]+$/.test(w))
    return { ok: false, reason: `"${w}" must contain toki pona letters only (a e i j k l m n o p s t u w) — no digits, spaces, or special characters` };

  const lower = w.toLowerCase();
  let i = 0;

  while (i < lower.length) {
    let cons = '';
    if (CONSONANTS.has(lower[i])) { cons = lower[i]; i++; }

    if (i >= lower.length || !VOWELS.has(lower[i])) {
      const pos = i + 1;
      const ch = lower[i] ?? '(end of word)';
      return {
        ok: false,
        reason: `"${w}" has an invalid syllable at letter ${pos} ("${ch}") — toki pona words follow the pattern consonant+vowel(+n), e.g. "ma", "jan", "toki"`
      };
    }

    const vow = lower[i];
    i++;

    if (FORBIDDEN.has(cons + vow))
      return { ok: false, reason: `"${w}" contains the forbidden syllable "${cons + vow}" — toki pona does not use ji, ti, wu, or wo` };

    if (i < lower.length && lower[i] === 'n') {
      const nxt = lower[i + 1];

      // In-word nn and nm are not allowed.
      if (nxt === 'n' || nxt === 'm') {
        return {
          ok: false,
          reason: `"${w}" contains the disallowed sequence "${lower[i]}${nxt}" — inside one word, syllables must follow (C)V(N), so "nn" and "nm" are not allowed`
        };
      }

      // Accept syllable-final n whenever the following character is absent
      // or is not a vowel. This keeps normal CVN parsing behaviour.
      if (!nxt || !VOWELS.has(nxt)) i++;
    }
  }

  return { ok: true, normalised: w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() };
}

// ── Nanpa detection ────────────────────────────────────────────────────────
// NanpaParser is injected via CartoucheApi.open({ nanpaParser }) or setNanpaParser()
let _nanpaParser = null;

export function setNanpaParser(parser) { _nanpaParser = parser; }

function isNanpaCaps(s) {
  try { return !!(_nanpaParser && _nanpaParser.isValidCaps(s)); }
  catch { return false; }
}

// ── Greedy nanpa-linja-n run detection ─────────────────────────────────────
// Returns array of segments: { type:'nanpa'|'normal', words:[] }
export function segmentWords(words) {
  if (!Array.isArray(words) || !words.length) return [];
  const segments = [];
  let i = 0;
  while (i < words.length) {
    let nanpaLen = 0;
    for (let len = words.length - i; len >= 1; len--) {
      const run = words.slice(i, i + len).map(w => w.toUpperCase()).join('');
      if (isNanpaCaps(run)) { nanpaLen = len; break; }
    }
    if (nanpaLen > 0) {
      segments.push({ type: 'nanpa', words: words.slice(i, i + nanpaLen) });
      i += nanpaLen;
    } else {
      if (segments.length && segments[segments.length - 1].type === 'normal') {
        segments[segments.length - 1].words.push(words[i]);
      } else {
        segments.push({ type: 'normal', words: [words[i]] });
      }
      i++;
    }
  }
  return segments;
}

// ── Boundary validation ────────────────────────────────────────────────────
// Word boundaries are allowed. Merge-time letter building handles the only
// special case now: if merging creates nn or nm across a word boundary,
// the first n is dropped.
export function validateBoundaries(words) {
  return { ok: true };
}

// ── Parse and validate a full input line ───────────────────────────────────
export function parseAndValidateLine(raw) {
  const tokens = raw.trim().split(/\s+/).filter(Boolean);
  if (!tokens.length) return { ok: false, reason: 'No words entered', words: [] };
  const normalised = [];
  for (const t of tokens) {
    const v = validateTpWord(t);
    if (!v.ok) return { ok: false, reason: v.reason, words: [] };
    normalised.push(v.normalised);
  }
  const b = validateBoundaries(normalised);
  if (!b.ok) return { ok: false, reason: b.reason, words: [] };
  return { ok: true, words: normalised };
}

export function makeKey(words) { return words.join(' '); }

// ── Final-n dropping for merged cartouche letter sequences ─────────────────
// Only drop final n when merging words would create nn or nm.
// All other n+consonant cross-word sequences are allowed and kept.
export function segmentLetters(words) {
  const result = [];
  const wordBoundaries = [];
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const isLast = i === words.length - 1;
    const nextFirst = isLast ? null : words[i + 1][0].toLowerCase();

    const dropN =
      !isLast &&
      w.toLowerCase().endsWith('n') &&
      (nextFirst === 'n' || nextFirst === 'm');

    wordBoundaries.push(result.length);
    const letters = w.toLowerCase().split('');
    if (dropN) letters.pop();
    letters.forEach(l => result.push(l));
  }
  return { letters: result, wordBoundaries };
}

// ── Random cartouche generation ────────────────────────────────────────────
export function buildRandomDescForLetters(letters, { excludeNanpaAtEnds = false } = {}) {
  return letters.map((ch, idx) => {
    let pool = TP_WORDS_BY_LETTER[ch];
    if (!pool) return ch;
    // For forceNormal entries, avoid 'nanpa' at first or last position
    // to prevent the renderer treating [nanpa ... nanpa] as a numeric cartouche
    if (excludeNanpaAtEnds && (idx === 0 || idx === letters.length - 1)) {
      pool = pool.filter(w => w !== 'nanpa');
    }
    return randFrom(pool) || ch;
  }).join(' ');
}

function cleanLiteralText(value) {
  return String(value ?? '').replace(/"/g, '').trim();
}

function getEntryLiteralText(entry) {
  return cleanLiteralText(entry?.literalText) || entry?.key || '';
}

// Build the renderer input string for one segment
export function buildSegmentRendererInput(seg, entry, segIndex) {
  const collapseBlankRuns = (s) =>
    String(s || '').replace(/(^| )""(?: +"")+/g, '$1""').trim();

  if (entry.mode === 'literal') {
    return `["${getEntryLiteralText(entry)}"]`;
  }

  // Nanpa segments: normally pass original words — renderer handles natively.
  // But if forceNormal is set, treat as a normal segment using cartoucheMap.
  if (seg.type === 'nanpa') {
    if (!entry.forceNormal) return `[ ${seg.words.join(' ')} ]`;
    // forceNormal — use stored cartouche from map like a normal segment
    const cm = entry.cartoucheMap || {};
    const stored = cm[segIndex];
    if (entry.mode === 'preferred' && stored) return `["" ${collapseBlankRuns(stored)} ]`;
    // Random — generate from the words' letters.
    // "" prefix forces renderer to treat as glyph cartouche, not numeric.
    const letters = seg.words.join('').toLowerCase().split('');
    return `["" ${collapseBlankRuns(buildRandomDescForLetters(letters, { excludeNanpaAtEnds: true }))} ]`;
  }

  // Normal segment
  const cm = entry.cartoucheMap || {};
  if (entry.merge) {
    const stored = cm[segIndex];
    if (entry.mode === 'preferred' && stored) return `[ ${collapseBlankRuns(stored)} ]`;
    const { letters } = segmentLetters(seg.words);
    return `[ ${collapseBlankRuns(buildRandomDescForLetters(letters))} ]`;
  } else {
    return seg.words.map((w, wi) => {
      const stored = cm[`${segIndex}_${wi}`];
      if (entry.mode === 'preferred' && stored) return `[ ${collapseBlankRuns(stored)} ]`;
      return `[ ${collapseBlankRuns(buildRandomDescForLetters(w.toLowerCase().split('')))} ]`;
    }).join(' ');
  }
}

// Build full renderer input string for an entry (all segments)
export function buildEntryRendererInput(entry) {
  const segs = segmentWords(entry.words);
  return segs.map((seg, si) => buildSegmentRendererInput(seg, entry, si)).join(' ');
}

// ── IndexedDB access ───────────────────────────────────────────────────────
function readOldDb() {
  return new Promise(res => {
    const probe = indexedDB.open(DB_NAME);
    probe.onsuccess = () => {
      const db = probe.result;
      const ver = db.version;
      const storeNames = Array.from(db.objectStoreNames);
      if (!storeNames.includes(STORE) || ver >= DB_VERSION) { db.close(); res([]); return; }
      try {
        const tx  = db.transaction(STORE, 'readonly');
        const req = tx.objectStore(STORE).getAll();
        req.onsuccess = () => { db.close(); res(req.result || []); };
        req.onerror   = () => { db.close(); res([]); };
      } catch { db.close(); res([]); }
    };
    probe.onerror = () => res([]);
    probe.onupgradeneeded = e => { e.target.transaction.abort(); res([]); };
  });
}

function openDb() {
  return new Promise((res, rej) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (db.objectStoreNames.contains(STORE)) db.deleteObjectStore(STORE);
      db.createObjectStore(STORE, { keyPath: 'key' });
    };
    req.onsuccess = e => res(e.target.result);
    req.onerror   = e => rej(e.target.error);
  });
}

function migrateRecord(e) {
  const rawWord = (typeof e.key === 'string' && e.key) ? e.key
                : (typeof e.word === 'string' && e.word) ? e.word : '';
  if (!rawWord) return null;
  const wordList = rawWord.trim().split(/\s+/).filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
  if (!wordList.length) return null;
  const key  = wordList.join(' ');
  const mode = ['random','preferred','literal','ignore'].includes(e.mode) ? e.mode : 'random';
  const cartoucheMap = (typeof e.cartoucheMap === 'object' && e.cartoucheMap) ? e.cartoucheMap : {};
  if (e.cartouche && typeof e.cartouche === 'string' && !Object.keys(cartoucheMap).length)
    cartoucheMap['0'] = e.cartouche;
  return { key, words: wordList, merge: e.merge !== false, mode, cartoucheMap, forceNormal: !!e.forceNormal, literalText: cleanLiteralText(e.literalText) || key };
}

// ── CartoucheApi class ─────────────────────────────────────────────────────
// Uses a plain object for state instead of private fields for broad compatibility
export class CartoucheApi {
  constructor({ lookup = true } = {}) {
    this._db       = null;
    this._lookup   = lookup;
    this._initDone = false;
  }

  static async open({ lookup = true, nanpaParser = null } = {}) {
    if (nanpaParser) setNanpaParser(nanpaParser);
    const api = new CartoucheApi({ lookup });
    await api._init();
    return api;
  }

  async _init() {
    if (this._initDone) return;
    this._initDone = true;
    const oldRecords = await readOldDb();
    this._db = await openDb();
    if (oldRecords.length) {
      const existing = await this._getAll();
      if (!existing.length) {
        for (const old of oldRecords) {
          const m = migrateRecord(old);
          if (m) await this._put(m);
        }
      }
    }
  }

  async _getAll() {
    return new Promise((res, rej) => {
      const tx  = this._db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).getAll();
      req.onsuccess = () => res(req.result || []);
      req.onerror   = () => rej(req.error);
    });
  }

  async _put(entry) {
    return new Promise((res, rej) => {
      const tx = this._db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(entry);
      tx.oncomplete = res;
      tx.onerror    = () => rej(tx.error);
    });
  }

  async _delete(key) {
    return new Promise((res, rej) => {
      const tx = this._db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(key);
      tx.oncomplete = res;
      tx.onerror    = () => rej(tx.error);
    });
  }

  async _clear() {
    return new Promise((res, rej) => {
      const tx = this._db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).clear();
      tx.oncomplete = res;
      tx.onerror    = () => rej(tx.error);
    });
  }

  // ── Public DB operations (used by cartouche-db page) ────────────────────
  async getAllEntries() {
    const raw = await this._getAll();
    return raw.filter(e => e && typeof e.key === 'string' && Array.isArray(e.words) && e.words.length);
  }

  async putEntry(entry) {
    return this._put(entry);
  }

  async deleteEntry(key) {
    return this._delete(key);
  }

  async clearAll() {
    return this._clear();
  }

  get lookupEnabled() { return this._lookup; }

  // ── resolvePageMap ────────────────────────────────────────────────────────
  // Loads all entries and pre-computes a flat map of key → renderer input string.
  // random entries get a random cartouche generated once per page load.
  // ignore entries map to null.
  // Not found → key absent from map.
  // Call once at page init; cache the result for the session.
  async resolvePageMap() {
    const entries = await this.getAllEntries();
    const map = new Map();
    for (const entry of entries) {
      if (entry.mode === 'ignore') {
        map.set(entry.key, null); // null = ignore
        continue;
      }
      // Pre-compute random cartouches now (once per session)
      let rendererInput;
      if (entry.mode === 'random') {
        const segs = segmentWords(entry.words);
        const cm   = {};
        segs.forEach((seg, si) => {
          // Skip nanpa segments UNLESS forceNormal — then generate random glyph cartouche
          if (seg.type === 'nanpa' && !entry.forceNormal) return;
          if (seg.type === 'nanpa' && entry.forceNormal) {
            // Use stored preferred value if set and valid (not just the raw word).
            // Otherwise generate random glyph words.
            const stored = (entry.cartoucheMap || {})[si];
            const rawWord = seg.words.join('').toLowerCase();
            const storedIsRaw = !stored || stored === rawWord || stored === seg.words.join(' ');
            if (entry.mode === 'preferred' && stored && !storedIsRaw) {
              cm[si] = stored; // use preferred
            } else {
              const letters = seg.words.join('').toLowerCase().split('');
              cm[si] = buildRandomDescForLetters(letters, { excludeNanpaAtEnds: true });
            }
            return;
          }
          if (entry.merge) {
            const { letters } = segmentLetters(seg.words);
            cm[si] = buildRandomDescForLetters(letters);
          } else {
            seg.words.forEach((w, wi) => {
              cm[`${si}_${wi}`] = buildRandomDescForLetters(w.toLowerCase().split(''));
            });
          }
        });
        rendererInput = buildEntryRendererInput({ ...entry, cartoucheMap: cm });
      } else {
        rendererInput = buildEntryRendererInput(entry);
      }
      // Store as object so greedyScan can read forceNormal flag.
      // forceNormal entries carry two inputs:
      //   input — nanpa segments rendered natively (always used)
      //   inputForceNormal — nanpa segments overridden with glyph cartouche (only with @db)
      let inputForceNormal = rendererInput;
      if (entry.forceNormal) {
        // Build a version with nanpa segments rendered natively (no forceNormal)
        const entryNormal = { ...entry, forceNormal: false };
        inputForceNormal = rendererInput; // @db version already computed above
        rendererInput = buildEntryRendererInput(entryNormal);
      }
      const mapValue = {
        input:            rendererInput,
        inputForceNormal: inputForceNormal,
        forceNormal:      !!entry.forceNormal,
        requiresAtDb:     entryRequiresAtDbForTpWordCollision(entry),
      };

      for (const alias of getEntryLookupAliases(entry)) {
        map.set(alias, mapValue);
      }
    }
    return map;
  }

  // ── greedyScan (static — no DB needed, pure computation) ─────────────────
  // Takes a word array and a resolved pageMap.
  // Returns an array of tokens: each is either
  //   { type: 'text', words: [...] }          — pass through to renderer as-is
  //   { type: 'cartouche', input: '[...]' }   — substitute this into renderer input
  //   { type: 'ignore', words: [...] }        — omit entirely
  //
  // Rules:
  // - Only starts a lookup from a capitalised word
  // - Identifies nanpa segments within capitalised runs as atomic units
  // - Greedy: tries longest sequence of units first, walks back unit by unit
  // - A standalone nanpa unit is NEVER looked up — passed through natively
  // - Lowercase words are passed through as-is
  // ── stripAtDb ─────────────────────────────────────────────────────────────
  // Strips @db suffix from a word if present. Returns { word, hasAtDb }.
  static _stripAtDb(word) {
    if (word.endsWith('@db')) {
      return { word: word.slice(0, -3), hasAtDb: true };
    }
    return { word, hasAtDb: false };
  }

  static greedyScan(words, pageMap) {
    // Note: even with empty map we must process words to strip @db suffixes
    const hasEntries = pageMap && pageMap.size > 0;

    const result = [];
    let i = 0;

    while (i < words.length) {
      const word = words[i];

      // Not capitalised (after stripping @db) — pass through
      // @db on a lowercase word is meaningless, strip and pass through
      const { word: cleanWord, hasAtDb } = CartoucheApi._stripAtDb(word);
      if (!/^[A-Z]/.test(cleanWord)) {
        result.push({ type: 'text', words: [cleanWord] });
        i++;
        continue;
      }

      // Collect consecutive capitalised words as candidate run.
      // @db is only meaningful on the LAST word of the run.
      // Strip @db from last word to get clean run words.
      let j = i;
      while (j < words.length) {
        const { word: w } = CartoucheApi._stripAtDb(words[j]);
        if (!/^[A-Z]/.test(w)) break;
        j++;
      }
      const rawRunWords = words.slice(i, j);
      // Strip @db from last word, record if it was present
      const lastStripped = CartoucheApi._stripAtDb(rawRunWords[rawRunWords.length - 1]);
      const atDbRequested = lastStripped.hasAtDb;
      const runWords = [
        ...rawRunWords.slice(0, -1),
        lastStripped.word,
      ];

      // Try greedy lookup against pageMap keys, longest prefix first.
      // A purely nanpa candidate is never looked up standalone.
      let matched = false;
      if (!hasEntries) {
        // No DB entries — pass cleaned words through (strips @db)
        result.push({ type: 'text', words: runWords });
        i += runWords.length;
        continue;
      }
      for (let wlen = runWords.length; wlen >= 1; wlen--) {
        const candidateWords = runWords.slice(0, wlen);
        const key = candidateWords.join(' ');

        // Skip purely nanpa candidates UNLESS @db was requested
        // (forceNormal entries need @db to activate even though they look like nanpa)
        const candidateSegs = segmentWords(candidateWords);
        if (candidateSegs.length === 1 && candidateSegs[0].type === 'nanpa' && !atDbRequested) continue;

        if (pageMap.has(key)) {
          const mapVal = pageMap.get(key);

          if (mapVal === null) {
            // ignore entry
            result.push({ type: 'ignore', words: candidateWords });
          } else {
            // mapVal is { input, inputForceNormal, forceNormal, requiresAtDb }
            const { input, inputForceNormal, forceNormal, requiresAtDb } = mapVal;

            // Some entries collide with ordinary toki pona words.
            // Those must only activate when @db is explicitly requested.
            if (requiresAtDb && !atDbRequested) {
              continue;
            }

            // Use forceNormal input only when @db was explicitly requested.
            // Otherwise always use normal input (nanpa renders natively).
            const chosenInput = (forceNormal && atDbRequested) ? inputForceNormal : input;
            result.push({ type: 'cartouche', input: chosenInput });
          }
          i += wlen;
          matched = true;
          break;
        }
      }

      if (!matched) {
        // No match — pass first word through (cleaned), retry from next
        result.push({ type: 'text', words: [runWords[0]] });
        i += 1;
      }
    }

    return result;
  }

  // ── buildRendererInput ────────────────────────────────────────────────────
  // Takes a greedyScan result and builds the final input string for the renderer.
  // type:'text'      → words joined with spaces (renderer handles natively)
  // type:'cartouche' → the pre-computed cartouche input string
  // type:'ignore'    → omitted entirely
  static buildRendererInput(scanResult) {
    return scanResult
      .filter(t => t.type !== 'ignore')
      .map(t => t.type === 'cartouche' ? t.input : t.words.join(' '))
      .join(' ')
      .trim();
  }

  // ── prepareInput ──────────────────────────────────────────────────────────
  // Convenience method: takes raw multi-line text and a resolved pageMap,
  // processes each line independently (preserving newlines for the renderer),
  // and returns the final input string ready to pass to renderTextToNewCanvas.
  //
  // Usage:
  //   const processedInput = CartoucheApi.prepareInput(rawText, pageMap);
  //   await renderer.renderTextToNewCanvas({ input: processedInput, ... });
  static prepareInput(rawText, pageMap) {
    return String(rawText ?? '').split('\n').map(line => {
      if (!line.trim()) return '';
      // Split on double-quoted sections — even indices are unquoted, odd are quoted.
      // Quoted sections pass through untouched; only unquoted sections are scanned.
      // We re-join with a space separator to preserve word boundaries around quotes.
      const parts = line.split('"');
      const processed = parts.map((part, idx) => {
        if (idx % 2 === 1) {
          // Inside quotes — pass through exactly as written
          return '"' + part + '"';
        }
        // Outside quotes — run greedy DB scan, preserving surrounding whitespace
        const leading  = part.match(/^\s*/)[0];
        const trailing = part.match(/\s*$/)[0];
        const words = part.trim().split(/\s+/).filter(Boolean);
        if (!words.length) return leading + trailing;
        const tokens = CartoucheApi.greedyScan(words, pageMap);
        return leading + CartoucheApi.buildRendererInput(tokens) + trailing;
      });
      return processed.join('');
    }).join('\n');
  }
}

export default CartoucheApi;