import {
  CartoucheApi,
  buildEntryDisplayInput,
  buildEntryRendererInput,
  buildEntryPreviewInput,
  buildRandomDescForLetters,
  segmentLetters,
  segmentWords,
  makeKey,
  parseAndValidateLine,
  entryUsesForceMergedWholeEntry,
} from '../../js/cartouche-api-v3-previewdesc.js?v=33';

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
const PREVIEW_RENDERER_URL = '../../js/renderer-fontuploads-renderer-preview-bottom-detect-final-fixed.js?v=180';

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

  // Always include the exact stored key.  Multi-word @db lookup uses
  // underscores in renderer text, but _stripAtDb() converts those back to
  // spaces before the map lookup.
  aliases.add(entry.key);

  // Match the global cartouche DB behaviour: add a merged single-word alias
  // only when the whole entry is one normal mergeable run.  Do not register a
  // leftover normal fragment from an entry that also contains a nanpa segment.
  if (entry.merge) {
    const segs = segmentWords(entry.words);
    if (segs.length === 1 && segs[0].type === 'normal') {
      const merged = segmentLetters(segs[0].words).letters.join('');
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

function entryHasCartoucheDescriptionForCurrentGrouping(entry) {
  const cm = entry && entry.cartoucheMap && typeof entry.cartoucheMap === 'object'
    ? entry.cartoucheMap
    : {};

  if (entryUsesForceMergedWholeEntry(entry)) {
    return !!String(cm['0'] || '').trim();
  }

  return entryHasAnyCartoucheDescription(entry);
}

function shouldGenerateCartoucheDescriptions(entry) {
  if (!entry) return false;
  if (entry.mode === 'random') return true;
  if (entry.mode === 'preferred' && !entryHasCartoucheDescriptionForCurrentGrouping(entry)) return true;
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

function countNonBlankCartoucheTokens(value) {
  return String(value || '')
    .trim()
    .split(/\s+/)
    .filter(token => token && token !== '""')
    .length;
}

function buildEffectiveEntryForRender(entry) {
  if (!shouldGenerateCartoucheDescriptions(entry)) return entry;

  const cm = {};

  if (entryUsesForceMergedWholeEntry(entry)) {
    const { letters } = segmentLetters(entry.words);
    const existingWhole = String((entry.cartoucheMap || {})['0'] || '').trim();
    const combinedExisting = Object.values(entry.cartoucheMap || {})
      .map(value => String(value || '').trim())
      .filter(Boolean)
      .join(' ')
      .trim();

    cm['0'] = existingWhole || (
      combinedExisting && countNonBlankCartoucheTokens(combinedExisting) >= letters.length
        ? combinedExisting
        : buildRandomDescForLetters(letters, { excludeNanpaAtEnds: true })
    );

    return { ...entry, cartoucheMap: cm };
  }

  const segs = segmentWords(entry.words);

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


function storedCartoucheContentTokens(value) {
  return String(value || '')
    .trim()
    .split(/\s+/)
    .filter(token => token && token !== '""');
}

function buildStoredCartoucheInput(value, { forceNormal = false } = {}) {
  const tokens = storedCartoucheContentTokens(value);
  if (!tokens.length) return '';
  const body = forceNormal ? `"" ${tokens.join(' ')}` : tokens.join(' ');
  return `[ ${body} ]`;
}

function buildPreferredSplitForceNormalPartialInput(entry) {
  if (!entry || entry.mode !== 'preferred' || entry.merge || !entry.forceNormal) return '';
  if (!Array.isArray(entry.words) || !entry.words.length) return '';

  const cm = entry.cartoucheMap && typeof entry.cartoucheMap === 'object'
    ? entry.cartoucheMap
    : {};

  const hasAnyStoredContent = Object.values(cm).some(value => storedCartoucheContentTokens(value).length > 0);
  if (!hasAnyStoredContent) return '';

  const parts = [];
  const segs = segmentWords(entry.words);

  segs.forEach((seg, si) => {
    if (!seg || !Array.isArray(seg.words) || !seg.words.length) return;

    if (seg.type === 'nanpa') {
      const forced = buildStoredCartoucheInput(cm[String(si)], { forceNormal: true });
      if (forced) parts.push(forced);
      return;
    }

    const wholeSegment = buildStoredCartoucheInput(cm[String(si)]);
    if (wholeSegment) {
      parts.push(wholeSegment);
      return;
    }

    if (seg.type === 'normal') {
      seg.words.forEach((w, wi) => {
        const wordPart = buildStoredCartoucheInput(cm[`${si}_${wi}`]);
        if (wordPart) parts.push(wordPart);
      });
    }
  });

  return parts.join(' ');
}

function buildLocalRendererInputForEntry(entry) {
  if (!entry) return '';
  if (entry.mode === 'literal') return buildLiteralCartoucheRendererInput(entry);

  const effectiveEntry = entryForLocalProperNameRender(entry);
  const partialPreferred = buildPreferredSplitForceNormalPartialInput(effectiveEntry);
  if (partialPreferred) return partialPreferred;

  return buildEntryRendererInput(buildEffectiveEntryForRender(effectiveEntry));
}

function buildEntryRenderedPreviewInput(entry) {
  if (!entry) return '';
  if (entry.mode === 'ignore') return buildEntryDisplayInput(entry);
  return buildLocalRendererInputForEntry(entry);
}

function buildLocalPageMapFromEntries(entries) {
  const map = new Map();
  for (const entry of Array.isArray(entries) ? entries : []) {
    if (!entry || !entry.key || !Array.isArray(entry.words) || !entry.words.length) continue;

    if (entry.mode === 'ignore') {
      for (const alias of getEntryLookupAliasesForLocalDb(entry)) map.set(alias, null);
      continue;
    }

    let rendererInput = buildLocalRendererInputForEntry(entry);

    let inputForceNormal = rendererInput;
    if (entry.forceNormal && entry.mode !== 'literal') {
      const entryNormal = { ...entry, forceNormal: false };
      inputForceNormal = rendererInput;
      rendererInput = buildLocalRendererInputForEntry(entryNormal);
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


const SPECIAL_DOUBLE_QUOTE_TOKEN = '""';
const SPECIAL_DOUBLE_QUOTE_GLYPH = '＿';
const TP_VARIANT_TOKENS = new Set(['ni<','ni^','ni>','sewi^']);
const TP_VARIANT_FIRST  = { 'ni<':'n','ni^':'n','ni>':'n','sewi^':'s' };

const TP_WORD_TO_CP = {
  'a':0xF1900,'akesi':0xF1901,'ala':0xF1902,'alasa':0xF1903,'ale':0xF1904,'ali':0xF1904,
  'anpa':0xF1905,'ante':0xF1906,'anu':0xF1907,'awen':0xF1908,
  'e':0xF1909,'en':0xF190A,'epiku':0xF1983,'esun':0xF190B,'ijo':0xF190C,'ike':0xF190D,'ilo':0xF190E,'insa':0xF190F,
  'jaki':0xF1910,'jan':0xF1911,'jelo':0xF1912,'jo':0xF1913,'jasima':0xF197F,
  'kala':0xF1914,'kalama':0xF1915,'kama':0xF1916,'kasi':0xF1917,'ken':0xF1918,'kijetesantakalu':0xF1980,
  'kepeken':0xF1919,'kili':0xF191A,'kiwen':0xF191B,'ko':0xF191C,'kon':0xF191D,
  'kule':0xF191E,'kulupu':0xF191F,'kute':0xF1920,'kipisi':0xF197B,'kin':0xF1979,'ku':0xF1988,'kokosila':0xF1984,
  'la':0xF1921,'lape':0xF1922,'laso':0xF1923,'lawa':0xF1924,'len':0xF1925,
  'lete':0xF1926,'li':0xF1927,'lili':0xF1928,'linja':0xF1929,'lipu':0xF192A,
  'loje':0xF192B,'lon':0xF192C,'luka':0xF192D,'lukin':0xF192E,'lupa':0xF192F,
  'leko':0xF197C,'lanpan':0xF1985,'linluwi':0xF19A4,
  'ma':0xF1930,'mama':0xF1931,'mani':0xF1932,'meli':0xF1933,'mi':0xF1934,
  'mije':0xF1935,'moku':0xF1936,'moli':0xF1937,'monsi':0xF1938,'mu':0xF1939,
  'mun':0xF193A,'musi':0xF193B,'mute':0xF193C,'monsuta':0xF197D,'meso':0xF1982,'misikeke':0xF1987,'majuna':0xF19A2,
  'n':0xF1986,'nanpa':0xF193D,'nasa':0xF193E,'nasin':0xF193F,'nena':0xF1940,
  'ni':0xF1941,'nimi':0xF1942,'noka':0xF1943,'namako':0xF1978,
  'ni<':0xF1989,'ni^':0xF198A,'ni>':0xF198B,
  'o':0xF1944,'olin':0xF1945,'ona':0xF1946,'open':0xF1947,'oko':0xF197A,
  'pakala':0xF1948,'pali':0xF1949,'palisa':0xF194A,'pan':0xF194B,'pana':0xF194C,
  'pi':0xF194D,'pilin':0xF194E,'pimeja':0xF194F,'pini':0xF1950,'pipi':0xF1951,
  'poka':0xF1952,'poki':0xF1953,'pona':0xF1954,'pu':0xF1955,'pake':0xF19A0,'powe':0xF19A3,
  'sama':0xF1956,'seli':0xF1957,'selo':0xF1958,'seme':0xF1959,'sewi':0xF195A,'sewi^':0xF198C,
  'sijelo':0xF195B,'sike':0xF195C,'sin':0xF195D,'sina':0xF195E,'sinpin':0xF195F,
  'sitelen':0xF1960,'sona':0xF1961,'soweli':0xF1962,'suli':0xF1963,'suno':0xF1964,
  'supa':0xF1965,'suwi':0xF1966,'su':0xF19A6,'soko':0xF1981,
  'tan':0xF1967,'taso':0xF1968,'tawa':0xF1969,'telo':0xF196A,'tenpo':0xF196B,
  'toki':0xF196C,'tomo':0xF196D,'tu':0xF196E,'tonsi':0xF197E,
  'unpa':0xF196F,'uta':0xF1970,'utala':0xF1971,
  'walo':0xF1972,'wan':0xF1973,'waso':0xF1974,'wawa':0xF1975,'weka':0xF1976,'wile':0xF1977,
};

function cleanLiteralText(value) {
  return String(value ?? '').replace(/"/g, '').trim();
}

function getLiteralText(entry) {
  return cleanLiteralText(entry?.literalText) || entry?.key || '';
}

function splitStoredTokensPreservingBlanks(value) {
  return String(value || '').trim().split(/\s+/).filter(Boolean);
}

function isNonBlankGlyphToken(token) {
  return !!token && token !== SPECIAL_DOUBLE_QUOTE_TOKEN;
}

function getEditableCartoucheGroups(entry) {
  const groups = [];
  if (!entry || !Array.isArray(entry.words) || !entry.words.length) return groups;

  if (entryUsesForceMergedWholeEntry(entry)) {
    const { letters, wordBoundaries } = segmentLetters(entry.words);
    groups.push({ key: '0', letters, wordBoundaries, excludeNanpaAtEnds: true });
    return groups;
  }

  const segs = segmentWords(entry.words);
  segs.forEach((seg, si) => {
    if (seg.type === 'nanpa') {
      if (!entry.forceNormal) return;
      groups.push({
        key: String(si),
        letters: seg.words.join('').toLowerCase().split(''),
        wordBoundaries: [],
        excludeNanpaAtEnds: true,
      });
      return;
    }

    if (entry.merge) {
      const { letters, wordBoundaries } = segmentLetters(seg.words);
      groups.push({ key: String(si), letters, wordBoundaries, excludeNanpaAtEnds: false });
      return;
    }

    seg.words.forEach((w, wi) => {
      groups.push({ key: `${si}_${wi}`, letters: String(w).toLowerCase().split(''), wordBoundaries: [], excludeNanpaAtEnds: false });
    });
  });

  return groups;
}

function fillMissingCartoucheMapForEntry(entry, cm) {
  let changed = false;
  for (const group of getEditableCartoucheGroups(entry)) {
    const existing = String(cm[group.key] || '').trim();
    if (existing) continue;
    cm[group.key] = buildRandomDescForLetters(group.letters, { excludeNanpaAtEnds: !!group.excludeNanpaAtEnds });
    changed = true;
  }
  return changed;
}

function migratePreferredCartoucheMapForGroupingChange(entry, nextEntry) {
  const currentEntry = { ...entry };
  const currentGroups = getEditableCartoucheGroups(currentEntry);
  const nextGroups = getEditableCartoucheGroups(nextEntry);
  const currentMap = entry.cartoucheMap || {};
  const nextMap = {};

  if (!nextGroups.length) return nextMap;

  if (entryUsesForceMergedWholeEntry(nextEntry)) {
    const combined = currentGroups.map(group => currentMap[group.key] || '').filter(Boolean).join(' ');
    const whole = nextGroups[0];
    const combinedTokenCount = splitStoredTokensPreservingBlanks(combined).filter(isNonBlankGlyphToken).length;
    nextMap[whole.key] = (combined && combinedTokenCount >= whole.letters.length)
      ? combined
      : buildRandomDescForLetters(whole.letters, { excludeNanpaAtEnds: !!whole.excludeNanpaAtEnds });
    return nextMap;
  }

  if (entryUsesForceMergedWholeEntry(currentEntry)) {
    const descTokens = splitStoredTokensPreservingBlanks(currentMap['0'] || '');
    let offset = 0;
    for (const group of nextGroups) {
      const wordTokens = [];
      let glyphCount = 0;
      while (offset < descTokens.length && glyphCount < group.letters.length) {
        const token = descTokens[offset++];
        wordTokens.push(token);
        if (isNonBlankGlyphToken(token)) glyphCount++;
      }
      nextMap[group.key] = glyphCount === group.letters.length
        ? wordTokens.join(' ')
        : buildRandomDescForLetters(group.letters, { excludeNanpaAtEnds: !!group.excludeNanpaAtEnds });
    }
    return nextMap;
  }

  for (const group of nextGroups) {
    const exact = String(currentMap[group.key] || '').trim();
    if (exact) {
      nextMap[group.key] = exact;
      continue;
    }

    if (!nextEntry.merge) {
      const segKey = String(group.key).split('_')[0];
      const mergedDesc = currentMap[segKey] || '';
      const descTokens = splitStoredTokensPreservingBlanks(mergedDesc);
      const siblingGroups = nextGroups.filter(g => String(g.key).split('_')[0] === segKey);
      let offset = 0;
      for (const sibling of siblingGroups) {
        const wordTokens = [];
        let glyphCount = 0;
        while (offset < descTokens.length && glyphCount < sibling.letters.length) {
          const token = descTokens[offset++];
          wordTokens.push(token);
          if (isNonBlankGlyphToken(token)) glyphCount++;
        }
        if (sibling.key === group.key) {
          nextMap[group.key] = glyphCount === sibling.letters.length
            ? wordTokens.join(' ')
            : buildRandomDescForLetters(group.letters, { excludeNanpaAtEnds: !!group.excludeNanpaAtEnds });
          break;
        }
      }
      if (nextMap[group.key]) continue;
    }

    const combined = currentGroups
      .filter(g => String(g.key).split('_')[0] === String(group.key))
      .map(g => currentMap[g.key] || '')
      .filter(Boolean)
      .join(' ');
    nextMap[group.key] = combined || buildRandomDescForLetters(group.letters, { excludeNanpaAtEnds: !!group.excludeNanpaAtEnds });
  }

  return nextMap;
}

function migratePreferredCartoucheMapForMergeChange(entry, newMerge) {
  return migratePreferredCartoucheMapForGroupingChange(entry, { ...entry, merge: newMerge });
}

function migratePreferredCartoucheMapForForceNormalChange(entry, newForceNormal) {
  return migratePreferredCartoucheMapForGroupingChange(entry, { ...entry, forceNormal: newForceNormal });
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
    forceNormal: !!raw.forceNormal,
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
      display: none;
      flex-direction: column;
      width: min(1180px, calc(100vw - 48px));
      height: min(820px, calc(100vh - 64px));
      left: 48px;
      top: 88px;
      min-width: 360px;
      min-height: 260px;
      resize: both;
      overflow: hidden;
      background: var(--bg, #F3DFC0);
      border: 1px solid rgba(17,17,17,0.20);
      border-radius: 12px;
      box-shadow: 0 18px 50px rgba(0,0,0,0.20);
      z-index: var(--sb-z-floating-editor-base, 11000);
    }
    #scrapbookCartoucheDbWindow.scrapbookCartoucheDbWindow.open { display: flex; }
    #scrapbookCartoucheDbWindow .floatingEditorHeader {
      cursor: grab;
      user-select: none;
      flex: 0 0 auto;
    }
    #scrapbookCartoucheDbWindow.scrapbookCartoucheDbDragging .floatingEditorHeader { cursor: grabbing; }
    #scrapbookCartoucheDbWindow .floatingEditorBody {
      display: flex;
      flex-direction: column;
      min-height: 0;
      overflow: hidden;
      padding: 10px;
      background: rgba(255,255,255,0.18);
    }
    #scrapbookCartoucheDbWindow .scrapbookDbCard {
      background: var(--bg, #F3DFC0);
      border: 1px solid #d0d7de;
      border-radius: 10px;
      padding: 16px;
      min-height: 0;
      display: flex;
      flex-direction: column;
      gap: 12px;
      overflow: hidden;
    }
    #scrapbookCartoucheDbWindow .scrapbookDbIntro {
      font-size: 12px;
      color: var(--muted, #3f4750);
      line-height: 1.35;
    }
    #scrapbookCartoucheDbWindow .scrapbookDbIntro a {
      color: var(--accent, #5a3e1b);
      text-decoration: none;
    }
    #scrapbookCartoucheDbWindow .scrapbookDbIntro a:hover { text-decoration: underline; }
    #scrapbookCartoucheDbWindow .row {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
      align-items: flex-end;
    }
    #scrapbookCartoucheDbWindow .col { flex: 1 1 220px; }
    #scrapbookCartoucheDbWindow label {
      display: block;
      font-size: 12px;
      color: var(--muted, #3f4750);
      margin-bottom: 6px;
    }
    #scrapbookCartoucheDbWindow input[type="text"],
    #scrapbookCartoucheDbWindow input[type="number"],
    #scrapbookCartoucheDbWindow textarea,
    #scrapbookCartoucheDbWindow select {
      width: 100%;
      box-sizing: border-box;
      border: 1px solid #d0d7de;
      border-radius: 8px;
      padding: 10px;
      background: var(--bg, #F3DFC0);
      font: inherit;
      color: var(--ink, #000111);
    }
    #scrapbookCartoucheDbWindow button {
      border: 1px solid #d0d7de;
      background: var(--bg, #F3DFC0);
      padding: 10px 12px;
      border-radius: 8px;
      cursor: pointer;
      font-weight: 600;
      color: var(--ink, #000111);
      font-family: inherit;
    }
    #scrapbookCartoucheDbWindow button:hover { background: rgba(0,0,0,0.06); }
    #scrapbookCartoucheDbWindow button:disabled { opacity: 0.55; cursor: not-allowed; }
    #scrapbookCartoucheDbWindow .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace; }
    #scrapbookCartoucheDbWindow .help {
      font-size: 12px;
      color: var(--muted, #3f4750);
      margin-top: 6px;
      line-height: 1.35;
    }
    #scrapbookCartoucheDbWindow .pill {
      display: inline-block;
      border: 1px solid #d0d7de;
      border-radius: 999px;
      padding: 2px 8px;
      font-size: 12px;
      color: var(--muted, #3f4750);
      margin-right: 4px;
      white-space: nowrap;
    }
    #scrapbookCartoucheDbWindow .pill.good { color: #1b5e20; border-color: #1b5e20; }
    #scrapbookCartoucheDbWindow .pill.warn { color: #b45309; border-color: #b45309; }
    #scrapbookCartoucheDbWindow .pill.bad  { color: #7f1d1d; border-color: #7f1d1d; }
    #scrapbookCartoucheDbWindow .hidden { display: none !important; }
    #scrapbookCartoucheDbWindow .addBar {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
      align-items: flex-end;
    }
    #scrapbookCartoucheDbWindow .addBar input[type="text"] { flex: 1 1 200px; }
    #scrapbookCartoucheDbWindow .tableWrap {
      overflow: auto;
      -webkit-overflow-scrolling: touch;
      min-height: 0;
      flex: 1 1 auto;
      border-radius: 8px;
    }
    #scrapbookCartoucheDbWindow table {
      table-layout: fixed;
      width: 100%;
      border-collapse: collapse;
    }
    @media (max-width: 760px) {
      #scrapbookCartoucheDbWindow table { table-layout: auto; width: max-content; min-width: 100%; }
    }
    #scrapbookCartoucheDbWindow th,
    #scrapbookCartoucheDbWindow td {
      border: 1px solid #d0d7de;
      padding: 8px 10px;
      vertical-align: middle;
      font-size: 13px;
    }
    #scrapbookCartoucheDbWindow th {
      text-align: left;
      font-size: 12px;
      color: var(--muted, #3f4750);
      font-weight: 700;
      position: sticky;
      top: 0;
      background: var(--bg, #F3DFC0);
      z-index: 1;
    }
    #scrapbookCartoucheDbWindow tbody tr:hover td { background: rgba(0,0,0,0.03); }
    #scrapbookCartoucheDbWindow .wordCell {
      font-weight: 600;
      min-width: 120px;
      white-space: nowrap;
    }
    #scrapbookCartoucheDbWindow .wordCell .nanpaFlag {
      font-size: 10px;
      color: #b45309;
      font-weight: 400;
      margin-left: 6px;
      border: 1px solid #b45309;
      border-radius: 4px;
      padding: 1px 4px;
    }
    #scrapbookCartoucheDbWindow .modeGroup {
      display: flex;
      gap: 3px;
      flex-wrap: wrap;
    }
    #scrapbookCartoucheDbWindow .modeGroup label {
      display: flex;
      align-items: center;
      gap: 3px;
      font-size: 11px;
      color: var(--muted, #3f4750);
      border: 1px solid #d0d7de;
      border-radius: 6px;
      padding: 3px 6px;
      cursor: pointer;
      white-space: nowrap;
      margin: 0;
    }
    #scrapbookCartoucheDbWindow .modeGroup input[type="radio"] { margin: 0; }
    #scrapbookCartoucheDbWindow .modeGroup label:has(input:checked) {
      border-color: var(--accent, #5a3e1b);
      color: var(--accent, #5a3e1b);
      background: rgba(90,62,27,0.08);
    }
    #scrapbookCartoucheDbWindow .cartoucheDesc {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
      font-size: 11px;
      color: var(--muted, #3f4750);
      word-break: break-word;
      overflow-wrap: anywhere;
    }
    #scrapbookCartoucheDbWindow .cartoucheDesc .randomNote {
      font-style: italic;
      font-size: 11px;
    }
    #scrapbookCartoucheDbWindow .previewRow { background: rgba(0,0,0,0.03); }
    #scrapbookCartoucheDbWindow .previewRow.hidden { display: none; }
    #scrapbookCartoucheDbWindow .previewCell {
      padding: 6px 14px 8px;
      border-top: 1px dashed #d0d7de;
    }
    #scrapbookCartoucheDbWindow .previewCell canvas,
    #scrapbookCartoucheDbWindow canvas.scrapbookPreviewCanvas {
      display: none !important;
      width: 1px !important;
      height: 1px !important;
    }
    #scrapbookCartoucheDbWindow .scrapbookVectorPreviewHost {
      max-width: 100%;
      max-height: 180px;
      overflow: auto;
      -webkit-overflow-scrolling: touch;
      background: transparent;
    }
    #scrapbookCartoucheDbWindow .scrapbookVectorPreviewHost svg {
      display: block;
      width: auto;
      height: auto;
      max-width: 100%;
      overflow: visible;
    }
    #scrapbookCartoucheDbWindow .scrapbookVectorPreviewHost.modalPreviewHost {
      flex: 1 1 auto;
      min-width: 0;
      max-height: 118px;
    }
    #scrapbookCartoucheDbWindow .previewCell .previewHeader {
      display: flex;
      justify-content: flex-end;
      margin-bottom: 4px;
    }
    #scrapbookCartoucheDbWindow .literalEditor {
      display: none;
      margin-top: 6px;
    }
    #scrapbookCartoucheDbWindow .literalEditor.open { display: block; }
    #scrapbookCartoucheDbWindow .literalEditor input[type="text"] {
      font-size: 12px;
      padding: 6px 8px;
      width: 100%;
    }
    #scrapbookCartoucheDbWindow .actCell {
      white-space: nowrap;
      vertical-align: middle;
    }
    #scrapbookCartoucheDbWindow .actCell button {
      font-size: 11px;
      padding: 4px 7px;
      margin-right: 3px;
      margin-bottom: 2px;
    }
    #scrapbookCartoucheDbWindow .emptyState {
      text-align: center;
      padding: 32px;
      color: var(--muted, #3f4750);
      font-size: 14px;
      border: 1px solid #d0d7de;
      border-radius: 8px;
    }
    #scrapbookCartoucheDbWindow .validationStrip {
      font-size: 12px;
      color: #7f1d1d;
      margin-top: 4px;
      min-height: 16px;
    }
    #scrapbookCartoucheDbWindow .nanpaWarn {
      font-size: 11px;
      color: #b45309;
      border: 1px solid #b45309;
      border-radius: 6px;
      padding: 4px 8px;
      margin-top: 4px;
      display: none;
    }
    #scrapbookCartoucheDbWindow .nanpaWarn.show { display: block; }
    #scrapbookCartoucheDbWindow .scrapbookDbOps {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      align-items: center;
    }
    #scrapbookCartoucheDbWindow .scrapbookDbStatus {
      min-height: 18px;
      font-size: 12px;
      color: var(--muted, #3f4750);
    }
    #scrapbookCartoucheDbWindow .scrapbookDbStatus.error { color: #7f1d1d; }

    #scrapbookCartoucheDbWindow .modalOverlay {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.25);
      display: none;
      z-index: 2147481200;
      pointer-events: none;
    }
    #scrapbookCartoucheDbWindow .modalOverlay.show { display: block; }
    #scrapbookCartoucheDbWindow .modal {
      pointer-events: all;
      position: fixed;
      top: 40px;
      left: 50%;
      transform: translateX(-50%);
      width: min(82vw, 1100px);
      min-width: 320px;
      max-width: 98vw;
      max-height: 90vh;
      min-height: 220px;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      resize: both;
      background: var(--bg, #F3DFC0);
      border: 1px solid #d0d7de;
      border-radius: 12px;
      padding: 14px;
      box-shadow: 0 18px 50px rgba(0,0,0,0.2);
      box-sizing: border-box;
    }
    #scrapbookCartoucheDbWindow .modal.is-dragging { user-select: none; cursor: grabbing; }
    #scrapbookCartoucheDbWindow .modalHeader {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      flex-shrink: 0;
      cursor: grab;
      position: relative;
    }
    #scrapbookCartoucheDbWindow .modalHeader h3 { margin: 0; font-size: 14px; }
    #scrapbookCartoucheDbWindow .modalHeader::after {
      content: '⠿ drag header to move';
      position: absolute;
      right: 80px;
      top: 50%;
      transform: translateY(-50%);
      font-size: 10px;
      color: var(--muted, #3f4750);
      opacity: 0.4;
      pointer-events: none;
      white-space: nowrap;
    }
    #scrapbookCartoucheDbWindow .modalBody {
      flex: 1 1 auto;
      overflow-y: auto;
      overflow-x: clip;
      -webkit-overflow-scrolling: touch;
      display: flex;
      flex-direction: column;
      padding: 10px;
      min-height: 0;
      margin-top: 10px;
      border: 1px solid #d0d7de;
      border-radius: 10px;
      background: rgba(255,255,255,0.35);
    }
    #scrapbookCartoucheDbWindow .cartoucheSlots {
      display: flex;
      flex-wrap: nowrap;
      align-items: flex-end;
      gap: 6px;
      padding-left: 6px;
      padding-bottom: 8px;
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
      scrollbar-width: thin;
      scrollbar-color: #d0d7de transparent;
    }
    #scrapbookCartoucheDbWindow .cartoucheSlot {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 3px;
    }
    #scrapbookCartoucheDbWindow .cartoucheSlot .slotLabel {
      font-size: 11px;
      font-weight: 700;
      color: var(--muted, #3f4750);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    #scrapbookCartoucheDbWindow .cartoucheSlot input {
      width: 80px;
      font-size: 12px;
      padding: 5px 5px;
      border-radius: 6px;
      border: 2px solid #d0d7de;
      background: var(--bg, #F3DFC0);
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      text-align: center;
      min-width: 0;
    }
    #scrapbookCartoucheDbWindow .cartoucheSlot input.slotOk { border-color: #1b5e20; }
    #scrapbookCartoucheDbWindow .cartoucheSlot input.slotErr { border-color: #7f1d1d; background: rgba(127,29,29,0.06); }
    #scrapbookCartoucheDbWindow .slotTally {
      display: flex;
      align-items: center;
      gap: 2px;
      background: rgba(0,0,0,0.04);
      border: 0.5px solid #d0d7de;
      border-radius: 4px;
      padding: 1px 3px;
      width: 80px;
      box-sizing: border-box;
      justify-content: space-between;
      height: 18px;
    }
    #scrapbookCartoucheDbWindow .tallyBtn {
      width: 14px;
      height: 14px;
      border: none;
      border-radius: 2px;
      background: transparent;
      color: var(--muted, #3f4750);
      font-size: 12px;
      line-height: 1;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0;
      flex-shrink: 0;
    }
    #scrapbookCartoucheDbWindow .tallyBtn:hover:not(:disabled) { background: rgba(0,0,0,0.08); }
    #scrapbookCartoucheDbWindow .tallyBtn:disabled { opacity: 0.3; cursor: default; }
    #scrapbookCartoucheDbWindow .tallyCount {
      font-size: 10px;
      color: var(--muted, #3f4750);
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
      text-align: center;
      flex: 1;
    }
    #scrapbookCartoucheDbWindow .tallyMax { opacity: 0.5; }
    #scrapbookCartoucheDbWindow .talliesEndLabel {
      font-size: 10px;
      color: var(--muted, #3f4750);
      opacity: 0.45;
      white-space: nowrap;
      font-style: italic;
      padding-left: 4px;
      padding-bottom: 3px;
      flex-shrink: 0;
      align-self: flex-end;
    }
    #scrapbookCartoucheDbWindow .slotPicker {
      display: none;
      flex-direction: column;
      gap: 6px;
      padding: 8px;
      background: rgba(255,255,255,0.45);
      border: 1px solid #d0d7de;
      border-radius: 8px;
      max-height: 140px;
      overflow-y: auto;
      -webkit-overflow-scrolling: touch;
      flex-shrink: 0;
    }
    #scrapbookCartoucheDbWindow .slotPicker.open { display: flex; }
    #scrapbookCartoucheDbWindow .slotPickerLabel {
      font-size: 10px;
      font-weight: 700;
      color: var(--muted, #3f4750);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      flex-shrink: 0;
    }
    #scrapbookCartoucheDbWindow .slotPickerWords {
      display: flex;
      flex-wrap: wrap;
      gap: 5px;
    }
    #scrapbookCartoucheDbWindow .slotWordBtn {
      appearance: none;
      border: 1px solid rgba(17,17,17,0.22);
      background: rgba(255,255,255,0.38);
      border-radius: 10px;
      padding: 4px 8px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      font-weight: 600;
      white-space: nowrap;
      min-height: 36px;
    }
    #scrapbookCartoucheDbWindow .slotWordBtn:hover,
    #scrapbookCartoucheDbWindow .slotWordBtn:active { background: rgba(255,255,255,0.75); }
    #scrapbookCartoucheDbWindow .slotWordBtn[aria-pressed="true"] {
      background: rgba(255,255,255,0.85);
      border-color: var(--accent, #5a3e1b);
      color: var(--accent, #5a3e1b);
    }
    #scrapbookCartoucheDbWindow .slotWordGlyph {
      font-family: "TP-Nasin-Nanpa-Font";
      font-size: 18px;
      line-height: 1;
    }
    #scrapbookCartoucheDbWindow .soundBadges {
      margin-top: 8px;
      min-height: 20px;
      display: flex;
      align-items: center;
      gap: 4px;
      flex-wrap: wrap;
    }
    #scrapbookCartoucheDbWindow .soundBadge {
      display: inline-block;
      border: 1px solid #d0d7de;
      border-radius: 999px;
      padding: 2px 8px;
      font-size: 11px;
      color: var(--muted, #3f4750);
      background: rgba(255,255,255,0.30);
    }
    #scrapbookCartoucheDbWindow .soundBadge.good { color: #1b5e20; border-color: #1b5e20; }
    #scrapbookCartoucheDbWindow .soundBadge.warn { color: #b45309; border-color: #b45309; }
    #scrapbookCartoucheDbWindow .soundBadge.bad { color: #7f1d1d; border-color: #7f1d1d; }
    @media (max-width: 700px) {
      #scrapbookCartoucheDbWindow.scrapbookCartoucheDbWindow {
        left: 8px;
        top: 72px;
        width: calc(100vw - 16px);
        height: min(780px, calc(100vh - 96px));
      }
      #scrapbookCartoucheDbWindow .modal {
        width: 96vw;
        left: 2vw;
        transform: none;
        top: 8px;
        resize: vertical;
      }
      #scrapbookCartoucheDbWindow .modalHeader::after { display: none; }
    }
  `;
  document.head.appendChild(style);
}

function makeButton(label, className = '') {
  const btn = document.createElement('button');
  btn.type = 'button';
  if (className) btn.className = className;
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
    tbody: null,
    emptyState: null,
    searchInput: null,
    addInput: null,
    addError: null,
    nanpaWarn: null,
    pillCount: null,
    pillScope: null,
    pillRenderer: null,
    fontSizeInput: null,
    fileImport: null,
    status: null,
    modal: null,
    modalTitle: null,
    modalCanvas: null,
    modalSlots: null,
    modalPicker: null,
    modalPickerWords: null,
    modalPickerLabel: null,
    modalError: null,
    modalPreview: null,
    modalSoundCheck: null,
    editingKey: null,
    slotData: null,
    activeSlotIndex: -1,
    previewDebounce: null,
    editFlushTimer: null,
    editFlushNeedsDirty: false,
    editFlushNeedsRebuild: false,
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

  const scopeName = String(options.scopeName || 'scrapbook');
  const scopeLabel = String(options.scopeLabel || scopeName);
  const titleText = String(options.title || 'Scrapbook Proper Names');
  const localEntryLabel = String(options.localEntryLabel || `${scopeName}-local`);
  const scopePillText = String(options.scopePillText || `scope: this ${scopeName} only`);
  const rendererReadyText = String(options.rendererReadyText || 'renderer: ready');
  const dbType = String(options.dbType || DEFAULT_DB.type);
  const exportFilenamePrefix = String(options.exportFilenamePrefix || `${scopeName}-cartouche-db`);
  const buttonIds = Array.isArray(options.buttonIds) && options.buttonIds.length
    ? options.buttonIds.map(id => String(id)).filter(Boolean)
    : ['btnScrapbookNames', 'compactBtnScrapbookNames'];
  const introHtml = typeof options.introHtml === 'string'
    ? options.introHtml
    : `These proper-name entries are saved inside this ${scopeLabel} only. They override matching
              <a href="./cartouche-db.html" target="_blank" rel="noopener noreferrer">global cartouche DB</a>
              entries while this ${scopeLabel} is rendered.`;
  const controllerDefaultDb = Object.freeze({
    type: dbType,
    version: DEFAULT_DB.version,
    entries: [],
  });

  function htmlEscapeText(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function q(selector) {
    return state.root ? state.root.querySelector(selector) : null;
  }

  function escapeCss(value) {
    if (globalThis.CSS && typeof CSS.escape === 'function') return CSS.escape(String(value));
    return String(value).replace(/[^a-zA-Z0-9_-]/g, ch => `\\${ch}`);
  }

  function ensureDocumentDb() {
    const doc = getDocument() || window.ScrapbookCartoucheDbBridge?.getDocument?.();
    if (!doc) return cloneJson(controllerDefaultDb);

    if (!doc.cartoucheDb || typeof doc.cartoucheDb !== 'object') doc.cartoucheDb = cloneJson(controllerDefaultDb);
    if (doc.cartoucheDb.type !== controllerDefaultDb.type) doc.cartoucheDb.type = controllerDefaultDb.type;
    if (!Number.isFinite(doc.cartoucheDb.version)) doc.cartoucheDb.version = controllerDefaultDb.version;
    doc.cartoucheDb.entries = normaliseEntries(doc.cartoucheDb.entries);
    return doc.cartoucheDb;
  }

  function getLocalEntries() {
    return ensureDocumentDb().entries;
  }

  function syncDocumentEntries(entries) {
    const normalised = normaliseEntries(entries);
    const doc = getDocument() || window.ScrapbookCartoucheDbBridge?.getDocument?.();
    if (doc && typeof doc === 'object') {
      if (!doc.cartoucheDb || typeof doc.cartoucheDb !== 'object') doc.cartoucheDb = cloneJson(controllerDefaultDb);
      doc.cartoucheDb.type = controllerDefaultDb.type;
      doc.cartoucheDb.version = controllerDefaultDb.version;
      doc.cartoucheDb.entries = normalised;
    }
    return normalised;
  }

  function flushPendingEntryEditSideEffects() {
    if (state.editFlushTimer) {
      clearTimeout(state.editFlushTimer);
      state.editFlushTimer = null;
    }
    const needsDirty = !!state.editFlushNeedsDirty;
    const needsRebuild = !!state.editFlushNeedsRebuild;
    state.editFlushNeedsDirty = false;
    state.editFlushNeedsRebuild = false;
    if (needsDirty) setDocumentDirty();
    if (needsRebuild) rebuildCombinedPageMap();
  }

  function scheduleEntryEditSideEffects({ dirty = true, rebuild = true, delayMs = 180 } = {}) {
    state.editFlushNeedsDirty = state.editFlushNeedsDirty || !!dirty;
    state.editFlushNeedsRebuild = state.editFlushNeedsRebuild || !!rebuild;
    if (state.editFlushTimer) clearTimeout(state.editFlushTimer);
    state.editFlushTimer = setTimeout(flushPendingEntryEditSideEffects, Math.max(0, Number(delayMs) || 0));
  }

  function setLocalEntries(entries, { dirty = true, rebuild = true, render = true } = {}) {
    ensureDocumentDb();
    const normalised = syncDocumentEntries(entries);
    if (dirty) setDocumentDirty();
    if (rebuild) rebuildCombinedPageMap();
    if (render) {
      renderTable(state.searchInput?.value || '');
      updatePill();
    }
    return normalised;
  }

  function putEntry(entry, { dirty = true, rebuild = true, render = false, debounce = false } = {}) {
    const normalised = normaliseEntry(entry);
    if (!normalised) return null;
    const entries = getLocalEntries().slice();
    const idx = entries.findIndex(e => e.key === normalised.key);
    if (idx >= 0) entries[idx] = normalised;
    else entries.unshift(normalised);
    syncDocumentEntries(entries);
    if (debounce) scheduleEntryEditSideEffects({ dirty, rebuild });
    else {
      if (dirty) setDocumentDirty();
      if (rebuild) rebuildCombinedPageMap();
    }
    if (render) {
      renderTable(state.searchInput?.value || '');
      updatePill();
    }
    return normalised;
  }

  function deleteEntry(key, { render = true } = {}) {
    const before = getLocalEntries();
    const next = before.filter(entry => entry.key !== key);
    setLocalEntries(next, { render });
    setStatus(`Removed "${key}" from this ${scopeLabel}.`);
  }

  function setStatus(message, isError = false) {
    if (!state.status) return;
    state.status.textContent = message || '';
    state.status.classList.toggle('error', !!isError);
  }

  function mergePageMaps(globalMap, localMap) {
    const combined = new Map();
    if (globalMap instanceof Map) for (const [key, value] of globalMap.entries()) combined.set(key, value);
    if (localMap instanceof Map) for (const [key, value] of localMap.entries()) combined.set(key, value);
    return combined;
  }

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

  function displayLookupKey(entry) {
    if (!entry || !Array.isArray(entry.words) || !entry.words.length) return entry?.key || '';
    return entry.words.join('_');
  }

  function updatePill() {
    if (state.pillCount) {
      const n = getLocalEntries().length;
      state.pillCount.textContent = `${n} entr${n === 1 ? 'y' : 'ies'}`;
    }
    if (state.pillScope) state.pillScope.textContent = scopePillText;
    if (state.pillRenderer) {
      state.pillRenderer.textContent = rendererReadyText;
      state.pillRenderer.className = 'pill good';
    }
  }

  function clearCanvas(canvas) {
    if (!canvas) return;
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, 1, 1);
    const host = getVectorPreviewHost(canvas, { create: false });
    if (host) host.innerHTML = '';
  }

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const CARTOUCHE_START_CP = 0xF1990;
  const CARTOUCHE_END_CP = 0xF1991;

  function svgNum(value, fallback = 0) {
    const n = Number(value);
    if (!Number.isFinite(n)) return String(fallback);
    return String(Math.round(n * 1000) / 1000);
  }

  function getVectorPreviewHost(anchorCanvas, { create = true, modal = false } = {}) {
    if (!anchorCanvas || !anchorCanvas.parentNode) return null;
    let host = anchorCanvas.__scrapbookVectorPreviewHost || null;
    if (host && host.isConnected) return host;
    host = anchorCanvas.nextElementSibling && anchorCanvas.nextElementSibling.classList?.contains('scrapbookVectorPreviewHost')
      ? anchorCanvas.nextElementSibling
      : null;
    if (!host && create) {
      host = document.createElement('div');
      host.className = 'scrapbookVectorPreviewHost' + (modal ? ' modalPreviewHost' : '');
      anchorCanvas.after(host);
    }
    if (host) {
      if (modal) host.classList.add('modalPreviewHost');
      anchorCanvas.__scrapbookVectorPreviewHost = host;
    }
    return host;
  }

  function runTextForVectorPreview(run) {
    if (!run) return '';
    if (run.encodedText != null) return String(run.encodedText);
    if (run.kind === 'cartouche') {
      const cps = Array.isArray(run.cps) ? run.cps : (Array.isArray(run._element?.cps) ? run._element.cps : []);
      return String.fromCodePoint(CARTOUCHE_START_CP) + cps.map(cp => String.fromCodePoint(cp)).join('') + String.fromCodePoint(CARTOUCHE_END_CP);
    }
    return '';
  }

  function renderPlanToVectorSvgElement(plan) {
    const width = Math.max(1, Math.ceil(Number(plan?.widthPx) || 1));
    const height = Math.max(1, Math.ceil(Number(plan?.heightPx) || 1));
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('xmlns', SVG_NS);
    svg.setAttribute('width', String(width));
    svg.setAttribute('height', String(height));
    svg.setAttribute('viewBox', `0 0 ${svgNum(width)} ${svgNum(height)}`);
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', 'Cartouche preview');

    for (const line of (plan?.lines || [])) {
      for (const run of (line?.runs || [])) {
        const text = runTextForVectorPreview(run);
        if (!text) continue;
        const el = document.createElementNS(SVG_NS, 'text');
        const x = run.kind === 'cartouche' ? run.xPx : (run.drawXPx ?? run.xPx);
        el.setAttribute('x', svgNum(x));
        el.setAttribute('y', svgNum(run.baselineYPx));
        el.setAttribute('font-family', String(run.fontFamily || PREVIEW_FONT_FAMILY_TEXT));
        el.setAttribute('font-size', svgNum(run.fontPx || 40));
        el.setAttribute('fill', '#111111');
        el.textContent = text;
        svg.appendChild(el);
      }
    }
    return svg;
  }

  function showVectorPreview(anchorCanvas, svg, { modal = false } = {}) {
    const host = getVectorPreviewHost(anchorCanvas, { create: true, modal });
    if (!host) return;
    host.innerHTML = '';
    if (svg) host.appendChild(svg);
    anchorCanvas.classList.add('scrapbookPreviewCanvas');
    anchorCanvas.width = 1;
    anchorCanvas.height = 1;
  }

  async function renderInputToCanvas(input, targetCanvas, { forceNormal = false } = {}) {
    if (!targetCanvas) return;
    const sizePx = Math.max(8, parseInt(state.fontSizeInput?.value, 10) || 40);
    await ensureNasinNanpaPreviewFonts(sizePx);
    const previewRenderer = await getNasinNanpaPreviewRenderer(sizePx);
    const roles = {
      word: PREVIEW_FONT_FAMILY_TEXT,
      text: PREVIEW_FONT_FAMILY_TEXT,
      cartouche: forceNormal ? PREVIEW_FONT_FAMILY_TEXT : PREVIEW_FONT_FAMILY_TEXT,
      number: forceNormal ? PREVIEW_FONT_FAMILY_TEXT : PREVIEW_FONT_FAMILY_CARTOUCHE,
      date: forceNormal ? PREVIEW_FONT_FAMILY_TEXT : PREVIEW_FONT_FAMILY_CARTOUCHE,
      time: forceNormal ? PREVIEW_FONT_FAMILY_TEXT : PREVIEW_FONT_FAMILY_CARTOUCHE,
      literal: PREVIEW_FONT_FAMILY_LITERAL,
      unknown: PREVIEW_FONT_FAMILY_LITERAL,
      literalCartouche: PREVIEW_FONT_FAMILY_LITERAL_CARTOUCHE,
      literalCartoucheFamily: PREVIEW_FONT_FAMILY_LITERAL_CARTOUCHE,
    };
    const plan = await previewRenderer.buildRenderPlan({
      input,
      layout: { fontPx: sizePx, paddingPx: 10, align: 'left' },
      paint: { fgColor: '#111111' },
      parser: { cartoucheCommaTallyMarks: true, cartoucheTallyMode: 'ucsur', mixedStyle: 'short', showUnknownText: false },
      fonts: { roles },
    });
    const svg = renderPlanToVectorSvgElement(plan);
    showVectorPreview(targetCanvas, svg, { modal: targetCanvas === state.modalCanvas });
  }

  async function renderEntry(entry, targetCanvas) {
    if (!entry || entry.mode === 'ignore') {
      clearCanvas(targetCanvas);
      return;
    }
    try {
      if (entry.mode !== 'literal') {
        const cm = entry.cartoucheMap || {};
        const changed = fillMissingCartoucheMapForEntry(entry, cm);
        if (changed) {
          entry.cartoucheMap = cm;
          putEntry(entry, { render: false });
          updateDescCell(entry);
        }
      }
      await renderInputToCanvas(buildEntryRenderedPreviewInput(entry), targetCanvas, { forceNormal: !!entry.forceNormal });
    } catch (err) {
      scrapbookCartoucheDebugWarn('[scrapbook-cartouche-db] render error', entry?.key, err);
      clearCanvas(targetCanvas);
    }
  }

  function visibleEntries(filter = '') {
    const rawFilter = String(filter || '').toLowerCase();
    const lookupFilter = rawFilter.replace(/@db$/, '');
    return getLocalEntries().filter(entry => {
      if (!rawFilter) return true;
      const storedKey = (entry.key || '').toLowerCase();
      const lookupKey = displayLookupKey(entry).toLowerCase();
      return storedKey.includes(rawFilter) || lookupKey.includes(rawFilter) || lookupKey.includes(lookupFilter);
    });
  }

  function renderTable(filter = '') {
    if (!state.tbody) return;
    const rawFilter = String(filter || '').toLowerCase();
    const visible = visibleEntries(rawFilter);
    state.tbody.innerHTML = '';
    if (state.emptyState) state.emptyState.classList.toggle('hidden', visible.length > 0 || !!rawFilter);

    if (visible.length === 0 && rawFilter) {
      const tr = state.tbody.insertRow();
      const td = tr.insertCell();
      td.colSpan = 6;
      td.style.cssText = 'text-align:center;color:var(--muted,#3f4750);padding:16px;';
      td.textContent = `No matches for "${rawFilter}"`;
      return;
    }

    const globalMap = getGlobalPageMap();

    for (const entry of visible) {
      const segs = segmentWords(entry.words);
      const hasEditableSegs = segs.some(s => s.type === 'normal');
      const isAllNanpa = segs.length > 0 && segs.every(s => s.type === 'nanpa');
      const hasAnyNanpa = segs.some(s => s.type === 'nanpa');
      const wordCount = Array.isArray(entry.words) ? entry.words.length : 0;
      const canEdit = hasEditableSegs || (isAllNanpa && !!entry.forceNormal);
      const canMerge = wordCount > 1 && (hasEditableSegs || (isAllNanpa && !!entry.forceNormal));
      const needsAtDb = entryRequiresAtDbForLocalTpWordCollision(entry) || !!entry.forceNormal;
      const overridesGlobal = globalMap instanceof Map && globalMap.has(entry.key);

      const tr = document.createElement('tr');
      tr.dataset.key = entry.key;

      const tdName = document.createElement('td');
      tdName.className = 'wordCell mono';
      const nameSpan = document.createElement('span');
      segs.forEach((seg, si) => {
        if (si > 0) nameSpan.appendChild(document.createTextNode('_'));
        seg.words.forEach((w, wi) => {
          if (wi > 0) nameSpan.appendChild(document.createTextNode('_'));
          const ws = document.createElement('span');
          ws.textContent = w;
          if (seg.type === 'nanpa') {
            ws.style.color = '#b45309';
            ws.title = 'nanpa: [' + seg.words.join(' ') + ']';
          }
          nameSpan.appendChild(ws);
        });
      });
      tdName.appendChild(nameSpan);
      if (hasAnyNanpa) {
        const flag = document.createElement('span');
        flag.className = 'nanpaFlag';
        flag.textContent = 'nanpa';
        tdName.appendChild(flag);
      }
      if (overridesGlobal) {
        const flag = document.createElement('span');
        flag.className = 'nanpaFlag';
        flag.textContent = 'local override';
        flag.style.color = '#5a3e1b';
        flag.style.borderColor = '#5a3e1b';
        tdName.appendChild(flag);
      }
      tr.appendChild(tdName);

      const tdForce = document.createElement('td');
      tdForce.style.textAlign = 'center';
      if (needsAtDb) {
        const forceChk = document.createElement('input');
        forceChk.type = 'checkbox';
        forceChk.checked = !!entry.forceNormal;
        forceChk.title = `Require @db suffix in input to use this ${localEntryLabel} override`;
        forceChk.addEventListener('change', async () => {
          const previewWasOpen = isPreviewOpenForEntry(entry);
          const nextForce = forceChk.checked;
          if (entry.mode === 'preferred') entry.cartoucheMap = migratePreferredCartoucheMapForForceNormalChange(entry, nextForce);
          entry.forceNormal = nextForce;
          await putEntry(entry, { render: false });
          renderTable(state.searchInput?.value || '');
          await reopenPreviewForEntry(entry, previewWasOpen);
        });
        tdForce.appendChild(forceChk);
        const lbl = document.createElement('label');
        lbl.style.cssText = 'font-size:10px;color:#b45309;display:block;';
        lbl.textContent = '@db';
        tdForce.appendChild(lbl);
      }
      tr.appendChild(tdForce);

      const tdMerge = document.createElement('td');
      tdMerge.style.textAlign = 'center';
      if (canMerge) {
        const chk = document.createElement('input');
        chk.type = 'checkbox';
        chk.checked = !!entry.merge;
        chk.title = 'Merge all words into one cartouche per run';
        chk.addEventListener('change', async () => {
          const previewWasOpen = isPreviewOpenForEntry(entry);
          const nextMerge = chk.checked;
          if (entry.mode === 'preferred') entry.cartoucheMap = migratePreferredCartoucheMapForMergeChange(entry, nextMerge);
          entry.merge = nextMerge;
          await putEntry(entry, { render: false });
          renderTable(state.searchInput?.value || '');
          await reopenPreviewForEntry(entry, previewWasOpen);
        });
        tdMerge.appendChild(chk);
        const lbl = document.createElement('label');
        lbl.style.cssText = 'font-size:11px;color:var(--muted,#3f4750);display:block;';
        lbl.textContent = 'merge';
        tdMerge.appendChild(lbl);
      } else {
        tdMerge.textContent = '—';
        tdMerge.style.color = 'var(--muted,#3f4750)';
      }
      tr.appendChild(tdMerge);

      const tdMode = document.createElement('td');
      const modeGroup = document.createElement('div');
      modeGroup.className = 'modeGroup';
      for (const [val, label] of [['random','🎲 random'], ['preferred','★ preferred'], ['literal','⌨ literal'], ['ignore','✕ ignore']]) {
        const lbl = document.createElement('label');
        const inp = document.createElement('input');
        inp.type = 'radio';
        inp.name = 'mode-' + entry.key;
        inp.value = val;
        inp.checked = entry.mode === val;
        inp.addEventListener('change', async () => {
          const previewWasOpen = isPreviewOpenForEntry(entry);
          entry.mode = val;
          if (val === 'preferred' && canEdit) {
            const cm = entry.cartoucheMap || {};
            if (fillMissingCartoucheMapForEntry(entry, cm)) entry.cartoucheMap = cm;
          }
          if (val === 'literal' && !cleanLiteralText(entry.literalText)) entry.literalText = entry.key;
          if (val === 'ignore') closePreviewForEntry(entry);
          const saved = await putEntry(entry, { render: false });
          renderTable(state.searchInput?.value || '');
          if (val === 'preferred' && canEdit && saved) openCartoucheModal(saved);
          else if (previewWasOpen && val !== 'ignore') await reopenPreviewForEntry(saved || entry, true);
        });
        lbl.appendChild(inp);
        lbl.appendChild(document.createTextNode(label));
        modeGroup.appendChild(lbl);
      }
      tdMode.appendChild(modeGroup);
      tr.appendChild(tdMode);

      const tdDesc = document.createElement('td');
      tdDesc.className = 'cartoucheDesc';
      tdDesc.dataset.descFor = entry.key;
      const descSpan = document.createElement('span');
      descSpan.className = 'randomNote';
      descSpan.textContent = buildEntryDisplayInput(entry);
      tdDesc.appendChild(descSpan);

      const literalEditor = document.createElement('div');
      literalEditor.className = 'literalEditor' + (entry.mode === 'literal' ? ' open' : '');
      const literalInput = document.createElement('input');
      literalInput.type = 'text';
      literalInput.spellcheck = false;
      literalInput.autocomplete = 'off';
      literalInput.placeholder = 'literal cartouche text';
      literalInput.value = getLiteralText(entry);
      literalInput.disabled = entry.mode !== 'literal';
      literalInput.addEventListener('input', () => {
        entry.literalText = cleanLiteralText(literalInput.value) || entry.key;
        literalInput.value = entry.literalText;
        putEntry(entry, { render: false, debounce: true });
        updateDescCell(entry);
        renderOpenPreviewForEntry(entry);
      });
      literalEditor.appendChild(literalInput);
      tdDesc.appendChild(literalEditor);
      tr.appendChild(tdDesc);

      const tdAct = document.createElement('td');
      tdAct.className = 'actCell';

      const btnRender = makeButton('▶ render');
      btnRender.disabled = entry.mode === 'ignore';
      btnRender.addEventListener('click', async () => {
        if (entry.mode === 'ignore') return;
        let previewTr = getPreviewRowForEntry(entry);
        if (!previewTr) previewTr = createPreviewRow(tr, entry.key);
        previewTr.classList.remove('hidden');
        await renderEntry(entry, previewTr.querySelector('canvas'));
      });
      tdAct.appendChild(btnRender);

      const btnEdit = makeButton('✏ edit');
      btnEdit.disabled = entry.mode === 'literal' || !canEdit;
      btnEdit.title = !canEdit ? 'Enable @db to edit nanpa segments' : 'Edit cartouche';
      btnEdit.addEventListener('click', async () => {
        const cm = entry.cartoucheMap || {};
        if (fillMissingCartoucheMapForEntry(entry, cm)) entry.cartoucheMap = cm;
        entry.mode = 'preferred';
        const saved = await putEntry(entry, { render: false });
        updateDescCell(saved || entry);
        renderTable(state.searchInput?.value || '');
        openCartoucheModal(saved || entry);
      });
      tdAct.appendChild(btnEdit);

      const btnDel = makeButton('🗑');
      btnDel.title = 'Remove';
      btnDel.addEventListener('click', () => {
        if (!confirm(`Remove "${entry.key}" from this ${scopeLabel}?`)) return;
        deleteEntry(entry.key);
        updatePill();
      });
      tdAct.appendChild(btnDel);
      tr.appendChild(tdAct);
      state.tbody.appendChild(tr);
    }
    updatePill();
  }

  function createPreviewRow(anchorTr, key) {
    const previewTr = document.createElement('tr');
    previewTr.dataset.previewFor = key;
    previewTr.className = 'previewRow hidden';
    const tdPrev = document.createElement('td');
    tdPrev.colSpan = 6;
    tdPrev.className = 'previewCell';
    const hdr = document.createElement('div');
    hdr.className = 'previewHeader';
    const btnClose = makeButton('✕ close');
    btnClose.style.cssText = 'font-size:11px;';
    btnClose.addEventListener('click', () => previewTr.classList.add('hidden'));
    hdr.appendChild(btnClose);
    const canvas = document.createElement('canvas');
    canvas.className = 'scrapbookPreviewCanvas';
    canvas.width = 1;
    canvas.height = 1;
    tdPrev.appendChild(hdr);
    tdPrev.appendChild(canvas);
    previewTr.appendChild(tdPrev);
    anchorTr.after(previewTr);
    return previewTr;
  }

  function updateDescCell(entry) {
    if (!state.tbody || !entry) return;
    const td = state.tbody.querySelector(`td[data-desc-for="${escapeCss(entry.key)}"]`);
    if (!td) return;
    const sp = td.querySelector('span');
    if (!sp) return;
    sp.textContent = buildEntryDisplayInput(entry);
  }

  function getPreviewRowForEntry(entry) {
    if (!entry || !state.tbody) return null;
    return state.tbody.querySelector(`tr[data-preview-for="${escapeCss(entry.key)}"]`);
  }

  function closePreviewForEntry(entry) {
    const previewTr = getPreviewRowForEntry(entry);
    if (previewTr) previewTr.classList.add('hidden');
  }

  function isPreviewOpenForEntry(entry) {
    const previewTr = getPreviewRowForEntry(entry);
    return !!(previewTr && !previewTr.classList.contains('hidden'));
  }

  async function renderOpenPreviewForEntry(entry) {
    const previewTr = getPreviewRowForEntry(entry);
    if (!previewTr || previewTr.classList.contains('hidden')) return;
    const canvas = previewTr.querySelector('canvas');
    if (canvas) await renderEntry(entry, canvas);
  }

  async function reopenPreviewForEntry(entry, shouldOpen) {
    if (!shouldOpen || !entry || !state.tbody) return;
    const tr = state.tbody.querySelector(`tr[data-key="${escapeCss(entry.key)}"]`);
    if (!tr) return;
    let previewTr = getPreviewRowForEntry(entry);
    if (!previewTr) previewTr = createPreviewRow(tr, entry.key);
    previewTr.classList.remove('hidden');
    const canvas = previewTr.querySelector('canvas');
    if (canvas) await renderEntry(entry, canvas);
  }

  function validateSlotWord(word, requiredLetter) {
    const raw = String(word || '').trim();
    if (raw === SPECIAL_DOUBLE_QUOTE_TOKEN) return { ok: true, word: raw, special: 'double-quote-pair' };
    const w = raw.toLowerCase();
    if (!w) return { ok: false, reason: 'empty' };
    if (TP_VARIANT_TOKENS.has(w)) {
      const vf = TP_VARIANT_FIRST[w];
      if (vf !== requiredLetter) return { ok: false, reason: `"${w}" is a variant for "${vf}", not "${requiredLetter}"` };
      return { ok: true, word: w };
    }
    if (!LOCAL_TP_KNOWN_WORDS.has(w)) return { ok: false, reason: `"${w}" is not a known toki pona word` };
    if (w[0] !== requiredLetter) return { ok: false, reason: `"${w}" must start with "${requiredLetter}"` };
    return { ok: true, word: w };
  }

  function parseBracketedCartouche(raw) {
    const trimmed = String(raw || '').trim();
    if (!trimmed.startsWith('[') || !trimmed.endsWith(']')) return { ok: false, reason: 'Not a bracketed cartouche.' };
    const body = trimmed.slice(1, -1).trim();
    if (!body) return { ok: false, reason: 'No glyphs found in brackets' };
    const tokens = body.split(/\s+/).filter(Boolean);
    const pairs = [];
    for (const token of tokens) {
      const m = token.match(/^([^,]+)(,*)$/);
      if (!m) return { ok: false, reason: `Invalid token "${token}"` };
      const word = m[1].toLowerCase();
      const tally = m[2].length;
      if (!LOCAL_TP_KNOWN_WORDS.has(word) && !TP_VARIANT_TOKENS.has(word)) return { ok: false, reason: `"${word}" is not a known toki pona word` };
      pairs.push({ word, tally });
    }
    if (!pairs.length) return { ok: false, reason: 'No glyphs found in brackets' };

    const contributions = [];
    let rawSound = '';
    for (const { word, tally } of pairs) {
      const srcWord = TP_VARIANT_TOKENS.has(word) ? TP_VARIANT_FIRST[word] : word;
      const n = tally === 0 ? 1 : tally;
      const contrib = srcWord.slice(0, n);
      contributions.push({ word, tally, contrib });
      rawSound += contrib;
    }

    let corrected = rawSound;
    let prev;
    do { prev = corrected; corrected = corrected.replace(/nn/g, 'n').replace(/nm/g, 'm'); } while (corrected !== prev);
    if (corrected.length !== rawSound.length) return { ok: false, reason: `Cross-glyph sequence creates nn or nm (sound would be "${corrected}") — reformulate to avoid this` };
    for (const fb of ['ti', 'ji', 'wu', 'wo']) {
      if (corrected.includes(fb)) return { ok: false, reason: `Forbidden combination "${fb}" in derived sound "${corrected}"` };
    }
    if (!/^[ptksnmljw]?[aeiou](n(?=[ptksnmljw]|$))?([ptksnmljw][aeiou](n(?=[ptksnmljw]|$))?)*$/.test(corrected)) {
      return { ok: false, reason: `"${corrected}" is not a valid toki pona syllable structure` };
    }

    const name = corrected.charAt(0).toUpperCase() + corrected.slice(1);
    const letters = corrected.split('');
    const glyphSlots = new Array(letters.length).fill(SPECIAL_DOUBLE_QUOTE_TOKEN);
    const tallySlots = new Array(letters.length).fill(0);
    let slotPos = 0;
    for (const { word, tally, contrib } of contributions) {
      if (slotPos >= letters.length) return { ok: false, reason: `More glyphs than letter slots in "${name}"` };
      const glyphLetter = TP_VARIANT_TOKENS.has(word) ? TP_VARIANT_FIRST[word] : word[0];
      if (glyphLetter !== letters[slotPos]) return { ok: false, reason: `Glyph "${word}" (letter "${glyphLetter}") doesn't match required letter "${letters[slotPos]}" at position ${slotPos + 1}` };
      glyphSlots[slotPos] = word;
      tallySlots[slotPos] = tally;
      slotPos += contrib.length;
    }
    if (slotPos !== letters.length) return { ok: false, reason: `Glyph coverage ends at position ${slotPos} but "${name}" has ${letters.length} letters` };

    const cartoucheMap = { '0': glyphSlots.join(' ') };
    const tallyMap = {};
    tallySlots.forEach((t, li) => { tallyMap[`0_${li}`] = t; });
    return { ok: true, name, words: [name], cartoucheMap, tallyMap, soundStr: corrected };
  }

  async function addEntry() {
    const raw = String(state.addInput?.value || '').trim();
    if (!raw) return;

    if (raw.startsWith('[') && raw.endsWith(']')) {
      const result = parseBracketedCartouche(raw);
      if (!result.ok) {
        if (state.addError) state.addError.textContent = result.reason;
        state.nanpaWarn?.classList.remove('show');
        return;
      }
      if (state.addError) state.addError.textContent = '';
      const key = result.name;
      if (getLocalEntries().some(e => e.key === key)) {
        if (state.addError) state.addError.textContent = `"${key}" is already in this ${scopeLabel}.`;
        return;
      }
      const entry = { key, words: result.words, merge: true, mode: 'preferred', cartoucheMap: result.cartoucheMap, tallyMap: result.tallyMap, forceNormal: false, literalText: key };
      putEntry(entry, { render: true });
      if (state.addInput) state.addInput.value = '';
      setStatus(`Added "${key}" to this ${scopeLabel}.`);
      return;
    }

    const result = parseAndValidateLocalProperNameLine(raw);
    if (!result.ok) {
      if (state.addError) state.addError.textContent = result.reason;
      return;
    }
    if (state.addError) state.addError.textContent = '';
    const key = makeKey(result.words);
    if (getLocalEntries().some(e => e.key === key)) {
      if (state.addError) state.addError.textContent = `"${key}" is already in this ${scopeLabel}.`;
      return;
    }

    const segs = segmentWords(result.words);
    const hasNanpa = segs.some(s => s.type === 'nanpa');
    if (hasNanpa && state.nanpaWarn) {
      state.nanpaWarn.textContent = `⚠ Contains nanpa-linja-n number(s): ${segs.filter(s => s.type === 'nanpa').map(s => s.words.join('')).join(', ')} → will render as fixed numeric cartouche(s) unless @db is enabled.`;
      state.nanpaWarn.classList.add('show');
    } else state.nanpaWarn?.classList.remove('show');

    const entry = { key, words: result.words, merge: true, mode: 'random', cartoucheMap: {}, tallyMap: {}, forceNormal: false, literalText: key };
    putEntry(entry, { render: true });
    if (state.addInput) state.addInput.value = '';
    setStatus(`Added "${key}" to this ${scopeLabel}.`);
  }

  function buildPickerForLetter(letter, inputs, onPick) {
    if (!state.modalPicker || !state.modalPickerWords || !state.modalPickerLabel) return;
    state.modalPickerWords.innerHTML = '';
    const standardWords = Object.keys(TP_WORD_TO_CP).filter(w => w[0] === letter && LOCAL_TP_KNOWN_WORDS.has(w)).sort();
    const variantWords = Object.keys(TP_VARIANT_FIRST).filter(v => TP_VARIANT_FIRST[v] === letter).sort();
    const allWords = [...standardWords, ...variantWords];
    if (!allWords.length) {
      state.modalPicker.classList.remove('open');
      return;
    }
    state.modalPickerLabel.innerHTML = `Words for "${letter}": <span style="font-weight:400; text-transform:none; letter-spacing:normal; color:var(--muted); opacity:0.85;">('${SPECIAL_DOUBLE_QUOTE_GLYPH}' button allows blank glyphs, useful for aliasing.)</span>`;
    const currentVal = inputs[state.activeSlotIndex] ? inputs[state.activeSlotIndex].value.trim() : '';

    const appendWordButton = (w, glyphText = null) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'slotWordBtn';
      btn.setAttribute('aria-pressed', currentVal === w ? 'true' : 'false');
      const glyph = document.createElement('span');
      glyph.className = 'slotWordGlyph';
      if (glyphText != null) glyph.textContent = glyphText;
      else if (TP_WORD_TO_CP[w] != null) glyph.textContent = String.fromCodePoint(TP_WORD_TO_CP[w]);
      const lbl = document.createElement('span');
      lbl.textContent = w;
      btn.appendChild(glyph);
      btn.appendChild(lbl);
      btn.addEventListener('mousedown', event => {
        event.preventDefault();
        const input = inputs[state.activeSlotIndex];
        if (!input) return;
        input.value = w;
        input.dispatchEvent(new Event('input'));
        onPick(w);
        state.modalPickerWords.querySelectorAll('.slotWordBtn').forEach(b => {
          b.setAttribute('aria-pressed', b.querySelector('span:last-child')?.textContent === w ? 'true' : 'false');
        });
        input.focus();
      });
      state.modalPickerWords.appendChild(btn);
    };

    allWords.forEach(w => appendWordButton(w));
    appendWordButton(SPECIAL_DOUBLE_QUOTE_TOKEN, SPECIAL_DOUBLE_QUOTE_GLYPH);
    state.modalPicker.classList.add('open');
    setTimeout(() => { if (inputs[state.activeSlotIndex]) inputs[state.activeSlotIndex].scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }, 50);
  }

  function buildCartoucheSlots(entry) {
    if (!state.modalSlots) return null;
    state.modalSlots.innerHTML = '';
    state.modalPicker?.classList.remove('open');
    if (state.modalPickerWords) state.modalPickerWords.innerHTML = '';
    state.activeSlotIndex = -1;

    const segs = segmentWords(entry.words);
    const cm = entry.cartoucheMap || {};
    const allInputs = [];
    const slotMeta = [];
    const allTallyData = [];
    let runSoundCheck = () => {};

    function currentPreviewMaps() {
      const previewMap = {};
      const grouped = {};
      allInputs.forEach((inp, i) => {
        const { subKey } = slotMeta[i];
        if (!grouped[subKey]) grouped[subKey] = [];
        grouped[subKey].push(inp.value.trim());
      });
      for (const [k, words] of Object.entries(grouped)) previewMap[k] = words.filter(Boolean).join(' ');
      const tallyPreviewMap = {};
      allTallyData.forEach(({ getTally, tallyKey }) => { if (tallyKey) tallyPreviewMap[tallyKey] = getTally(); });
      return { previewMap, tallyPreviewMap };
    }

    function updatePreview() {
      const { previewMap, tallyPreviewMap } = currentPreviewMaps();
      const previewStr = buildEntryPreviewInput(entry, previewMap, tallyPreviewMap);
      if (state.modalPreview) state.modalPreview.textContent = previewStr;
      clearTimeout(state.previewDebounce);
      state.previewDebounce = setTimeout(() => {
        if (!previewStr.includes('?')) renderInputToCanvas(previewStr, state.modalCanvas, { forceNormal: !!entry.forceNormal });
      }, 300);
    }

    function validateAll() {
      const errors = [];
      allInputs.forEach((inp, i) => {
        const { letter } = slotMeta[i];
        const raw = inp.value.trim();
        if (!raw) {
          inp.classList.remove('slotOk');
          inp.classList.add('slotErr');
          errors.push(`Please fill the "${letter}" slot.`);
          return;
        }
        const result = validateSlotWord(raw, letter);
        inp.classList.toggle('slotOk', result.ok);
        inp.classList.toggle('slotErr', !result.ok);
        if (!result.ok) errors.push(result.reason);
      });
      if (state.modalError) state.modalError.textContent = errors.length ? errors[0] : '';
      return errors.length === 0;
    }

    function checkIntendedSound() {
      if (!state.modalSoundCheck) return;
      state.modalSoundCheck.innerHTML = '';
      const badges = [];
      const letters = slotMeta.map(m => m.letter).join('');
      badges.push({ text: `target: ${letters || '—'}`, kind: 'good' });
      const invalid = allInputs.find((inp, i) => inp.value.trim() && !validateSlotWord(inp.value.trim(), slotMeta[i].letter).ok);
      if (invalid) badges.push({ text: 'slot validation needed', kind: 'bad' });
      const rawSound = allInputs.map((inp, i) => {
        const raw = inp.value.trim();
        if (!raw || raw === SPECIAL_DOUBLE_QUOTE_TOKEN) return slotMeta[i].letter;
        const w = raw.toLowerCase();
        const source = TP_VARIANT_TOKENS.has(w) ? TP_VARIANT_FIRST[w] : w;
        const tallyData = allTallyData[i];
        const tally = tallyData ? tallyData.getTally() : 0;
        const n = tally === 0 ? 1 : tally;
        return source.slice(0, n) || slotMeta[i].letter;
      }).join('');
      if (rawSound) badges.push({ text: `sound: ${rawSound}`, kind: /^[a-z]+$/.test(rawSound) ? 'good' : 'warn' });
      for (const { text, kind } of badges) {
        const span = document.createElement('span');
        span.className = `soundBadge ${kind}`;
        span.textContent = text;
        state.modalSoundCheck.appendChild(span);
      }
    }

    function addDivider(label) {
      const div = document.createElement('div');
      div.style.cssText = 'display:flex;align-items:center;color:var(--muted,#3f4750);font-size:13px;font-weight:700;padding:0 2px;align-self:flex-end;padding-bottom:6px;';
      div.textContent = label;
      state.modalSlots.appendChild(div);
    }

    function addSlot(letter, existingWord, inputListIndex, tallyVal, tallyKey) {
      const slot = document.createElement('div');
      slot.className = 'cartoucheSlot';
      const lbl = document.createElement('div');
      lbl.className = 'slotLabel';
      lbl.textContent = letter;
      const inp = document.createElement('input');
      inp.type = 'text';
      inp.spellcheck = false;
      inp.autocomplete = 'off';
      inp.placeholder = letter + '…';
      inp.value = existingWord || '';

      let tallyValue = 0;
      const tallyRow = document.createElement('div');
      tallyRow.className = 'slotTally';
      const btnMinus = document.createElement('button');
      btnMinus.type = 'button';
      btnMinus.className = 'tallyBtn';
      btnMinus.textContent = '−';
      const countSpan = document.createElement('span');
      countSpan.className = 'tallyCount';
      const btnPlus = document.createElement('button');
      btnPlus.type = 'button';
      btnPlus.className = 'tallyBtn';
      btnPlus.textContent = '+';
      tallyRow.appendChild(btnMinus);
      tallyRow.appendChild(countSpan);
      tallyRow.appendChild(btnPlus);

      function getWordMax() {
        const raw = inp.value.trim();
        return (!raw || raw === SPECIAL_DOUBLE_QUOTE_TOKEN) ? 0 : raw.length;
      }
      function refreshTally() {
        const max = getWordMax();
        tallyValue = Math.min(tallyValue, max);
        if (max === 0) {
          countSpan.innerHTML = '<span class="tallyMax">—</span>';
          btnMinus.disabled = true;
          btnPlus.disabled = true;
        } else {
          countSpan.innerHTML = `${tallyValue}<span class="tallyMax"> / ${max}</span>`;
          btnMinus.disabled = tallyValue <= 0;
          btnPlus.disabled = tallyValue >= max;
        }
      }
      tallyValue = (existingWord && existingWord !== SPECIAL_DOUBLE_QUOTE_TOKEN)
        ? Math.min(Math.max(0, Number(tallyVal) || 0), (existingWord || '').length)
        : 0;
      refreshTally();
      btnMinus.addEventListener('click', () => { tallyValue = Math.max(0, tallyValue - 1); refreshTally(); runSoundCheck(); updatePreview(); });
      btnPlus.addEventListener('click', () => { tallyValue = Math.min(getWordMax(), tallyValue + 1); refreshTally(); runSoundCheck(); updatePreview(); });
      allTallyData.push({ getTally: () => tallyValue, tallyKey: tallyKey || '' });

      slot.appendChild(lbl);
      slot.appendChild(inp);
      slot.appendChild(tallyRow);
      state.modalSlots.appendChild(slot);
      const myIndex = inputListIndex;
      inp.addEventListener('focus', () => {
        state.activeSlotIndex = myIndex;
        buildPickerForLetter(letter, allInputs, () => { validateAll(); checkIntendedSound(); updatePreview(); });
      });
      inp.addEventListener('input', () => {
        const raw = inp.value.trim();
        if (raw !== SPECIAL_DOUBLE_QUOTE_TOKEN) inp.value = inp.value.toLowerCase();
        refreshTally();
        runSoundCheck();
        validateAll();
        updatePreview();
        buildPickerForLetter(letter, allInputs, () => { validateAll(); checkIntendedSound(); updatePreview(); });
      });
      inp.addEventListener('keydown', event => {
        if (event.key === 'Enter') {
          if (myIndex < allInputs.length - 1) allInputs[myIndex + 1].focus();
          else applyCartouche();
        } else if (event.key === 'Escape') {
          state.modalPicker?.classList.remove('open');
        }
      });
      return inp;
    }

    function addNanpaBlock(seg) {
      const block = document.createElement('div');
      block.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:3px;';
      const lbl = document.createElement('div');
      lbl.style.cssText = 'font-size:10px;font-weight:700;color:#b45309;text-transform:uppercase;letter-spacing:0.05em;';
      lbl.textContent = 'nanpa';
      const val = document.createElement('div');
      val.style.cssText = 'font-family:monospace;font-size:11px;color:#b45309;border:1px solid #b45309;border-radius:6px;padding:4px 7px;background:rgba(180,83,9,0.07);white-space:nowrap;';
      val.textContent = '[' + seg.words.join(' ') + ']';
      block.appendChild(lbl);
      block.appendChild(val);
      state.modalSlots.appendChild(block);
    }

    if (entryUsesForceMergedWholeEntry(entry)) {
      const { letters, wordBoundaries } = segmentLetters(entry.words);
      const stored = String(cm['0'] || '').split(/\s+/).filter(Boolean);
      letters.forEach((letter, li) => {
        if (li > 0 && wordBoundaries.includes(li)) addDivider('|');
        const idx = allInputs.length;
        const tk = `0_${li}`;
        const inp = addSlot(letter, stored[li] || '', idx, (entry.tallyMap || {})[tk] || 0, tk);
        allInputs.push(inp);
        slotMeta.push({ letter, segIndex: 0, subKey: '0' });
      });
      const talliesLabel = document.createElement('div');
      talliesLabel.className = 'talliesEndLabel';
      talliesLabel.textContent = 'tallies';
      state.modalSlots.appendChild(talliesLabel);
      runSoundCheck = checkIntendedSound;
      validateAll();
      checkIntendedSound();
      updatePreview();
      return { allInputs, slotMeta, validateAll, allTallyData };
    }

    segs.forEach((seg, si) => {
      if (si > 0) addDivider('·');
      if (seg.type === 'nanpa' && !entry.forceNormal) {
        addNanpaBlock(seg);
        return;
      }
      if (seg.type === 'nanpa' && entry.forceNormal) {
        const letters = seg.words.join('').toLowerCase().split('');
        const stored = String(cm[String(si)] || '').split(/\s+/).filter(Boolean);
        letters.forEach((letter, li) => {
          const idx = allInputs.length;
          const tk = `${si}_${li}`;
          const inp = addSlot(letter, stored[li] || '', idx, (entry.tallyMap || {})[tk] || 0, tk);
          allInputs.push(inp);
          slotMeta.push({ letter, segIndex: si, subKey: String(si) });
        });
        return;
      }
      if (entry.merge) {
        const { letters, wordBoundaries } = segmentLetters(seg.words);
        const stored = String(cm[String(si)] || '').split(/\s+/).filter(Boolean);
        letters.forEach((letter, li) => {
          if (li > 0 && wordBoundaries.includes(li)) addDivider('|');
          const idx = allInputs.length;
          const tk = `${si}_${li}`;
          const inp = addSlot(letter, stored[li] || '', idx, (entry.tallyMap || {})[tk] || 0, tk);
          allInputs.push(inp);
          slotMeta.push({ letter, segIndex: si, subKey: String(si) });
        });
      } else {
        seg.words.forEach((word, wi) => {
          if (wi > 0) addDivider('|');
          const subKey = `${si}_${wi}`;
          const stored = String(cm[subKey] || '').split(/\s+/).filter(Boolean);
          String(word).toLowerCase().split('').forEach((letter, li) => {
            const idx = allInputs.length;
            const tk = `${subKey}_${li}`;
            const inp = addSlot(letter, stored[li] || '', idx, (entry.tallyMap || {})[tk] || 0, tk);
            allInputs.push(inp);
            slotMeta.push({ letter, segIndex: si, subKey });
          });
        });
      }
    });

    const talliesLabel = document.createElement('div');
    talliesLabel.className = 'talliesEndLabel';
    talliesLabel.textContent = 'tallies';
    state.modalSlots.appendChild(talliesLabel);
    runSoundCheck = checkIntendedSound;
    validateAll();
    checkIntendedSound();
    updatePreview();
    return { allInputs, slotMeta, validateAll, allTallyData };
  }

  let modalDragWired = false;
  function makeModalDraggable(modal, handle) {
    if (!modal || !handle || modalDragWired) return;
    modalDragWired = true;
    let startX = 0, startY = 0, startLeft = 0, startTop = 0;
    function begin(x, y) {
      const rect = modal.getBoundingClientRect();
      modal.style.left = `${rect.left}px`;
      modal.style.top = `${rect.top}px`;
      modal.style.transform = 'none';
      startX = x; startY = y; startLeft = rect.left; startTop = rect.top;
      modal.classList.add('is-dragging');
    }
    function move(x, y) {
      modal.style.left = `${Math.max(0, Math.min(window.innerWidth - 80, startLeft + x - startX))}px`;
      modal.style.top = `${Math.max(0, Math.min(window.innerHeight - 48, startTop + y - startY))}px`;
    }
    function end() {
      modal.classList.remove('is-dragging');
      document.removeEventListener('mousemove', onMove, true);
      document.removeEventListener('mouseup', onEnd, true);
      document.removeEventListener('touchmove', onTouchMove, true);
      document.removeEventListener('touchend', onEnd, true);
      document.removeEventListener('touchcancel', onEnd, true);
    }
    function ignore(target) { return !!target?.closest?.('button,input,select,textarea,a,label'); }
    function onMove(event) { event.preventDefault(); move(event.clientX, event.clientY); }
    function onEnd() { end(); }
    function onTouchMove(event) { const t = event.touches?.[0]; if (t) move(t.clientX, t.clientY); }
    handle.addEventListener('mousedown', event => {
      if (event.button !== 0 || ignore(event.target)) return;
      event.preventDefault(); begin(event.clientX, event.clientY);
      document.addEventListener('mousemove', onMove, true);
      document.addEventListener('mouseup', onEnd, true);
    });
    handle.addEventListener('touchstart', event => {
      if (ignore(event.target)) return;
      const t = event.touches?.[0];
      if (!t) return;
      begin(t.clientX, t.clientY);
      document.addEventListener('touchmove', onTouchMove, true);
      document.addEventListener('touchend', onEnd, true);
      document.addEventListener('touchcancel', onEnd, true);
    }, { passive: true });
  }

  function openCartoucheModal(entry) {
    createWindow();
    const fresh = getLocalEntries().find(e => e.key === entry.key) || entry;
    state.editingKey = fresh.key;
    if (state.modalTitle) {
      const displayName = Array.isArray(fresh.words) && fresh.words.length
        ? fresh.words.map(w => String(w)).join('_')
        : String(fresh.key || '').replace(/\s+/g, '_');

      state.modalTitle.textContent = `Edit cartouche: ${displayName}`;
    }
    state.slotData = buildCartoucheSlots(fresh);
    const modalBox = state.modal?.querySelector('.modal');
    if (modalBox) {
      modalBox.style.top = '40px';
      modalBox.style.left = '50%';
      modalBox.style.transform = 'translateX(-50%)';
      makeModalDraggable(modalBox, modalBox.querySelector('.modalHeader'));
    }
    state.modal?.classList.add('show');
    setTimeout(() => {
      if (state.slotData?.allInputs?.[0]) state.slotData.allInputs[0].focus();
      const input = buildEntryRenderedPreviewInput(fresh);
      if (input) renderInputToCanvas(input, state.modalCanvas, { forceNormal: !!fresh.forceNormal });
    }, 80);
  }

  function closeCartoucheModal() {
    state.modal?.classList.remove('show');
    const applyBtn = q('[data-role="apply-cartouche"]');
    if (applyBtn) applyBtn.disabled = false;
    if (state.modalSoundCheck) state.modalSoundCheck.innerHTML = '';
    state.editingKey = null;
    state.slotData = null;
  }

  async function applyCartouche() {
    if (!state.slotData) return;
    const entry = getLocalEntries().find(e => e.key === state.editingKey);
    if (!entry) { closeCartoucheModal(); return; }
    const { allInputs, slotMeta, validateAll, allTallyData } = state.slotData;
    if (!validateAll()) {
      if (state.modalError) state.modalError.textContent = state.modalError.textContent || 'Please fix errors before saving.';
      return;
    }
    const groups = {};
    allInputs.forEach((inp, i) => {
      const { subKey } = slotMeta[i];
      if (!groups[subKey]) groups[subKey] = [];
      const raw = inp.value.trim();
      groups[subKey].push(raw === SPECIAL_DOUBLE_QUOTE_TOKEN ? raw : raw.toLowerCase());
    });
    const cm = {};
    for (const [k, words] of Object.entries(groups)) {
      const cleaned = words.map(w => String(w).trim()).filter(Boolean);
      if (!cleaned.length) {
        if (state.modalError) state.modalError.textContent = 'All cartouche slots must be filled before saving.';
        return;
      }
      cm[k] = cleaned.join(' ');
    }
    const tm = {};
    (allTallyData || []).forEach(({ getTally, tallyKey }) => { if (tallyKey) tm[tallyKey] = getTally(); });
    entry.cartoucheMap = cm;
    entry.tallyMap = tm;
    entry.mode = 'preferred';
    const saved = putEntry(entry, { render: false });
    closeCartoucheModal();
    renderTable(state.searchInput?.value || '');
    const fresh = saved || entry;
    const tr = state.tbody?.querySelector(`tr[data-key="${escapeCss(fresh.key)}"]`);
    if (tr) {
      let previewTr = getPreviewRowForEntry(fresh);
      if (!previewTr) previewTr = createPreviewRow(tr, fresh.key);
      previewTr.classList.remove('hidden');
      await renderEntry(fresh, previewTr.querySelector('canvas'));
    }
  }

  function exportLocalJson() {
    const payload = {
      type: controllerDefaultDb.type,
      version: controllerDefaultDb.version,
      exportedAt: new Date().toISOString(),
      entries: cloneJson(getLocalEntries()),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${exportFilenamePrefix}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    setStatus(`Exported ${localEntryLabel} names JSON.`);
  }

  async function importLocalJsonFile(file, { confirmImport = true } = {}) {
    let parsed;
    try { parsed = JSON.parse(await file.text()); }
    catch { setStatus('Invalid JSON.', true); return; }
    if (!Array.isArray(parsed?.entries)) {
      setStatus('Missing entries array in imported file.', true);
      return;
    }
    const allowedTypes = new Set(['cartouche-db', 'scrapbook-cartouche-db', 'layout-cartouche-db']);
    if (parsed.type && !allowedTypes.has(String(parsed.type))) {
      setStatus(`Unsupported cartouche DB type: ${parsed.type}`, true);
      return;
    }
    if (confirmImport && !confirm(`Import ${parsed.entries.length} entr${parsed.entries.length === 1 ? 'y' : 'ies'} into this ${scopeLabel}? Existing matching local entries will be overwritten.`)) return;
    const current = getLocalEntries();
    const byKey = new Map(current.map(entry => [entry.key, entry]));
    let skipped = 0;
    let imported = 0;
    for (const raw of parsed.entries) {
      const entry = normaliseEntry(raw);
      if (!entry) { skipped++; continue; }
      byKey.set(entry.key, entry);
      imported++;
    }
    setLocalEntries(Array.from(byKey.values()), { render: true });
    setStatus(`Imported ${imported} entr${imported === 1 ? 'y' : 'ies'} into this ${scopeLabel}${skipped ? `; skipped ${skipped}.` : '.'}`);
  }

  function clearLocalDb() {
    if (!confirm(`Clear ALL ${localEntryLabel} proper names?`)) return;
    setLocalEntries([], { render: true });
    setStatus(`Cleared ${localEntryLabel} proper names.`);
  }

  async function renderAll() {
    if (!state.tbody) return;
    for (const tr of state.tbody.querySelectorAll('tr[data-key]')) {
      const entry = getLocalEntries().find(e => e.key === tr.dataset.key);
      if (!entry || entry.mode === 'ignore') continue;
      let previewTr = getPreviewRowForEntry(entry);
      if (!previewTr) previewTr = createPreviewRow(tr, entry.key);
      previewTr.classList.remove('hidden');
      await renderEntry(entry, previewTr.querySelector('canvas'));
    }
  }

  function createWindow() {
    if (state.root) return state.root;
    ensureStyle();

    const root = document.createElement('div');
    root.id = 'scrapbookCartoucheDbWindow';
    root.className = 'floatingEditor scrapbookCartoucheDbWindow';
    root.setAttribute('aria-hidden', 'true');

    const header = document.createElement('div');
    header.id = 'scrapbookCartoucheDbWindowHeader';
    header.className = 'floatingEditorHeader';
    const title = document.createElement('h3');
    title.textContent = titleText;
    const close = makeButton('Close');
    close.addEventListener('click', closeWindow);
    header.appendChild(title);
    header.appendChild(close);
    root.appendChild(header);

    const body = document.createElement('div');
    body.className = 'floatingEditorBody';
    body.innerHTML = `
      <div class="scrapbookDbCard">
        <div class="row" style="align-items:center;">
          <div class="col" style="flex:2 1 420px;">
            <div class="scrapbookDbIntro">
              ${introHtml}
            </div>
          </div>
          <div class="col" style="flex:0 1 360px;text-align:right;">
            <span id="scrapbookPillScope" class="pill warn">${htmlEscapeText(scopePillText)}</span>
            <span id="scrapbookPillRenderer" class="pill good">${htmlEscapeText(rendererReadyText)}</span>
            <span id="scrapbookPillCount" class="pill">0 entries</span>
          </div>
        </div>

        <div class="addBar">
          <div class="col">
            <label for="scrapbookSearchInput">Search</label>
            <input id="scrapbookSearchInput" type="text" spellcheck="false" placeholder="filter by name or @db lookup…" />
          </div>
          <div class="col">
            <label for="scrapbookAddInput">Add proper name or bracketed cartouche</label>
            <input id="scrapbookAddInput" type="text" spellcheck="false" placeholder="Sema Pan or [soweli,, pan]" />
            <div id="scrapbookAddError" class="validationStrip"></div>
            <div id="scrapbookNanpaWarn" class="nanpaWarn"></div>
          </div>
          <button id="scrapbookBtnAdd" type="button">Add</button>
        </div>

        <div class="row scrapbookDbOps">
          <button id="scrapbookBtnRenderAll" type="button">Render all</button>
          <button id="scrapbookBtnExport" type="button">Export local names JSON</button>
          <button id="scrapbookBtnImport" type="button">Import local names JSON</button>
          <button id="scrapbookBtnClearDb" type="button">Clear local names</button>
          <div style="width:120px;">
            <label for="scrapbookFontSizeInput">Preview font size</label>
            <input id="scrapbookFontSizeInput" type="number" min="12" max="160" value="40" />
          </div>
          <div id="scrapbookDbStatus" class="scrapbookDbStatus" style="flex:1 1 220px;"></div>
          <input id="scrapbookFileImport" type="file" accept="application/json,.json" style="display:none;" />
        </div>

        <div id="scrapbookEmptyState" class="emptyState hidden">No ${htmlEscapeText(localEntryLabel)} proper names yet.</div>

        <div class="tableWrap">
          <table>
            <thead>
              <tr>
                <th style="width:18%;">Name / lookup</th>
                <th style="width:7%;">@db</th>
                <th style="width:8%;">Merge</th>
                <th style="width:22%;">Mode</th>
                <th>Cartouche description</th>
                <th style="width:14%;">Actions</th>
              </tr>
            </thead>
            <tbody id="scrapbookCartoucheTbody"></tbody>
          </table>
        </div>
      </div>

      <div id="scrapbookCartoucheModal" class="modalOverlay" aria-hidden="true">
        <div class="modal">
          <div class="modalHeader">
            <h3 id="scrapbookCartoucheModalTitle">Edit cartouche</h3>
            <button id="scrapbookBtnCloseCartoucheModal" type="button">Close</button>
          </div>
          <div class="modalBody">
            <div class="help" style="margin-bottom:10px;">
              Each letter maps to a toki pona word starting with that letter. Word boundaries are shown with <strong>|</strong>.
              Nanpa-linja-n segments are locked unless @db is enabled.
            </div>
            <div style="margin-bottom:10px;min-height:36px;display:flex;align-items:center;gap:10px;">
              <span style="font-size:11px;color:var(--muted);white-space:nowrap;">Current render:</span>
              <canvas id="scrapbookCartoucheModalCanvas" class="scrapbookPreviewCanvas" width="1" height="1"></canvas>
            </div>
            <div id="scrapbookCartoucheSlots" class="cartoucheSlots"></div>
            <div id="scrapbookCartouchePicker" class="slotPicker">
              <div class="slotPickerLabel" id="scrapbookCartouchePickerLabel"></div>
              <div class="slotPickerWords" id="scrapbookCartouchePickerWords"></div>
            </div>
            <div class="validationStrip" id="scrapbookCartoucheError" style="margin-top:6px;min-height:18px;"></div>
            <div class="help" style="margin-top:6px;">
              Preview: <span id="scrapbookCartouchePreview" class="mono" style="color:var(--accent,#5a3e1b);"></span>
            </div>
            <div id="scrapbookCartoucheSoundCheck" class="soundBadges"></div>
            <div class="row" style="margin-top:8px;">
              <button data-role="apply-cartouche" id="scrapbookBtnApplyCartouche" type="button">Apply</button>
              <button id="scrapbookBtnCancelCartouche" type="button">Cancel</button>
            </div>
          </div>
        </div>
      </div>
    `;
    root.appendChild(body);
    (options.host || document.body).appendChild(root);

    state.root = root;
    state.tbody = q('#scrapbookCartoucheTbody');
    state.emptyState = q('#scrapbookEmptyState');
    state.searchInput = q('#scrapbookSearchInput');
    state.addInput = q('#scrapbookAddInput');
    state.addError = q('#scrapbookAddError');
    state.nanpaWarn = q('#scrapbookNanpaWarn');
    state.pillCount = q('#scrapbookPillCount');
    state.pillScope = q('#scrapbookPillScope');
    state.pillRenderer = q('#scrapbookPillRenderer');
    state.fontSizeInput = q('#scrapbookFontSizeInput');
    state.fileImport = q('#scrapbookFileImport');
    state.status = q('#scrapbookDbStatus');
    state.modal = q('#scrapbookCartoucheModal');
    state.modalTitle = q('#scrapbookCartoucheModalTitle');
    state.modalCanvas = q('#scrapbookCartoucheModalCanvas');
    state.modalSlots = q('#scrapbookCartoucheSlots');
    state.modalPicker = q('#scrapbookCartouchePicker');
    state.modalPickerWords = q('#scrapbookCartouchePickerWords');
    state.modalPickerLabel = q('#scrapbookCartouchePickerLabel');
    state.modalError = q('#scrapbookCartoucheError');
    state.modalPreview = q('#scrapbookCartouchePreview');
    state.modalSoundCheck = q('#scrapbookCartoucheSoundCheck');

    makeWindowDraggable(root, header);

    q('#scrapbookBtnAdd')?.addEventListener('click', addEntry);
    state.addInput?.addEventListener('keydown', event => { if (event.key === 'Enter') addEntry(); });
    state.searchInput?.addEventListener('input', () => renderTable(state.searchInput.value));
    q('#scrapbookBtnRenderAll')?.addEventListener('click', renderAll);
    q('#scrapbookBtnExport')?.addEventListener('click', exportLocalJson);
    q('#scrapbookBtnImport')?.addEventListener('click', () => state.fileImport?.click());
    q('#scrapbookBtnClearDb')?.addEventListener('click', clearLocalDb);
    state.fileImport?.addEventListener('change', async () => {
      const file = state.fileImport.files?.[0];
      state.fileImport.value = '';
      if (file) await importLocalJsonFile(file);
    });
    q('#scrapbookBtnApplyCartouche')?.addEventListener('click', applyCartouche);
    q('#scrapbookBtnCancelCartouche')?.addEventListener('click', closeCartoucheModal);
    q('#scrapbookBtnCloseCartoucheModal')?.addEventListener('click', closeCartoucheModal);
    state.fontSizeInput?.addEventListener('change', () => {
      renderAll().catch(err => scrapbookCartoucheDebugWarn('[scrapbook-cartouche-db] render all after font size failed', err));
    });

    return root;
  }

  function openWindow() {
    createWindow();
    ensureDocumentDb();
    renderTable(state.searchInput?.value || '');
    updatePill();
    state.root.classList.add('open');
    state.root.setAttribute('aria-hidden', 'false');
    setStatus(`${getLocalEntries().length} ${localEntryLabel} entr${getLocalEntries().length === 1 ? 'y' : 'ies'}.`);
  }

  async function closeWindow() {
    if (!state.root) return;
    flushPendingEntryEditSideEffects();
    closeCartoucheModal();
    state.root.classList.remove('open');
    state.root.setAttribute('aria-hidden', 'true');
    rebuildCombinedPageMap();
    setDocumentDirty();
    requestRenderAll();
  }

  function toggleWindow() {
    if (!state.root || !state.root.classList.contains('open')) openWindow();
    else closeWindow();
  }

  async function init() {
    ensureDocumentDb();
    await initGlobalMap();
    rebuildCombinedPageMap();
    createWindow();

    for (const buttonId of buttonIds) {
      const btn = document.getElementById(buttonId);
      if (btn && !btn.__scrapbookCartoucheDbWired) {
        btn.__scrapbookCartoucheDbWired = true;
        btn.addEventListener('click', openWindow);
      }
    }
    return api;
  }

  function prepareInput(rawText) {
    try { return CartoucheApi.prepareInput(rawText, state.combinedMap || new Map()); }
    catch (err) {
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
