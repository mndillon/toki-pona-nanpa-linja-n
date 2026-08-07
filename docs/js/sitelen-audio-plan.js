/**
 * sitelen-audio-plan.js
 *
 * Builds a renderer-consistent audio plan for sitelen text without making the
 * voice API parse DB/cartouche/rendering syntax itself.
 *
 * Intended flow:
 *   raw text
 *     -> CartoucheApi.prepareAudioInput(rawText, pageMap)
 *     -> renderer.buildRenderPlan({ input: audioInput, ...rendererConfig })
 *     -> extract speakable speechLines from render-plan runs
 *     -> voice.render(lineText, { alreadyPreprocessed: true, ... })
 *
 * This module is deliberately dependency-injected. It does not import the
 * renderer, CartoucheApi, or voice API, and it does not mutate page state.
 */

const TP_CONS = new Set(['p', 't', 'k', 'm', 'n', 's', 'w', 'l', 'j']);
const TP_VOWS = new Set(['a', 'e', 'i', 'o', 'u']);

const KNOWN_TP_GLYPH_WORDS = new Set([
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
  'unpa','uta','utala',
  'walo','wan','waso','wawa','weka','wile',

  // Renderer punctuation/helper glyph aliases.
  'ota','kolon','koma','te','to','zz',
  '.',':',',','·',

  // Directional / extended glyph keys seen in renderer maps.
  'sewi^','ni>','ni^','ni<'
]);

const TOKEN_TO_DIGIT_WORD = Object.freeze({
  NI: 'ijo', WE: 'wan', WA: 'wan', TE: 'tu', TU: 'tu', SE: 'seli', NA: 'awen',
  LE: 'luka', LU: 'luka', NU: 'utala', ME: 'mun', MU: 'mun', PE: 'pipi', PI: 'pipi', JE: 'jo'
});

const AUDIO_NANPA_LINJA_N_WORDS = new Set([
  'ala','ike','uta',
  'nanpa','nasa','nasin','nena','ni','nimi','noka',
  'esun','en','e',
  'o','ona','ota','open',
  'kulupu','kipisi','kasi','kala','kin',
  'ijo','wan','tu','seli','awen','luka','utala','mun','pipi','jo',
  'kolon',':',
  ...Object.values(TOKEN_TO_DIGIT_WORD)
]);

function normalizeAudioWord(raw) {
  return String(raw ?? '').replace(/'/g, '').toLowerCase();
}

export function isAudioTpPhonotacticWord(raw) {
  const w = normalizeAudioWord(raw);
  if (w === 'n') return true;
  if (!w || !/^[aeiouptkmnswlj]+$/.test(w)) return false;

  let i = 0;
  while (i < w.length) {
    if (TP_CONS.has(w[i])) {
      if (i + 1 < w.length && TP_VOWS.has(w[i + 1])) i += 1;
      else return false;
    }
    if (i >= w.length || !TP_VOWS.has(w[i])) return false;
    i += 1;
    if (i < w.length && w[i] === 'n') {
      const next = i + 1 < w.length ? w[i + 1] : '';
      if (!next || TP_CONS.has(next)) i += 1;
    }
  }
  return true;
}

export function isReadableAudioTokiPonaText(text) {
  const tokens = String(text ?? '').match(/[A-Za-z']+|[.,!?;:]/g) || [];
  if (!tokens.length) return false;
  return tokens.every(token => /^[.,!?;:]$/.test(token) || isAudioTpPhonotacticWord(token));
}

export function compactSpeechWhitespace(text) {
  return String(text ?? '').replace(/\s+/g, ' ').trim();
}

export function normalizeNonDrawableSourceTokensForAudioInput(rawText) {
  const raw = String(rawText ?? '');

  // Preserve line structure, but convert standalone source-control token "zz"
  // into a quoted U+3000 ideographic space before the renderer sees it.
  // This keeps audio-plan rendering consistent with text-to-sitelen visual
  // preparation without requiring every caller to remember this page-specific
  // control-token rule.
  return raw
    .split(/\n/)
    .map(line => String(line ?? '').replace(
      /(^|[\t ])zz(?=$|[\t ])/gi,
      (_match, lead) => `${lead}"\u3000"`
    ))
    .join('\n');
}

export function sanitizeTextToSitelenAudioText(text) {
  // Remove visual-only text-to-sitelen control syntax before speech. Numeric
  // cartouche runs are converted before this fallback is used.
  return compactSpeechWhitespace(
    String(text ?? '')
      .replace(/[&+\-{}()\[\]\^<>|]/g, ' ')
      .replace(/[“”"]/g, ' ')
  );
}

function stripOuterBracketSyntaxForAudio(text) {
  let s = String(text ?? '').trim();
  if (s.startsWith('[') && s.endsWith(']')) s = s.slice(1, -1).trim();
  return s;
}

export function normalizeTpGlyphToken(raw) {
  const s0 = String(raw ?? '').trim().toLowerCase();
  if (!s0) return '';

  if (s0 === ':' || s0 === '·' || s0 === '.' || s0 === ',') return s0;

  const stripped = s0.replace(/^[^a-z^<>:,.·]+|[^a-z^<>:,.·]+$/g, '');
  if (!stripped) return '';
  return stripped.replace(/[^a-z^<>:,.·]/g, '');
}

export function isKnownTpGlyphToken(token) {
  return KNOWN_TP_GLYPH_WORDS.has(normalizeTpGlyphToken(token));
}

function audioGlyphGroupsFromCartoucheSource(text) {
  const source = stripOuterBracketSyntaxForAudio(text);
  const groups = [];
  let current = '';

  const flushCurrent = () => {
    const token = normalizeTpGlyphToken(current);
    current = '';
    if (!token) return;
    groups.push({ token, tallyCount: 0 });
  };

  for (const ch of Array.from(source)) {
    if (/\s/.test(ch)) {
      flushCurrent();
      continue;
    }

    // These punctuation characters are standalone cartouche glyphs even when
    // the source does not put spaces around them. This mirrors the renderer's
    // ordinary-cartouche tokenizer.
    if (ch === '.' || ch === '·' || ch === ':') {
      flushCurrent();
      groups.push({ token: ch, tallyCount: 0 });
      continue;
    }

    // A comma is not part of the preceding word token. It is one combining
    // tally mark attached to the most recent cartouche glyph. For example,
    // [mani,,] means the first two sounds/letters of mani: "ma".
    if (ch === ',') {
      flushCurrent();
      if (groups.length) {
        const last = groups[groups.length - 1];
        last.tallyCount = Math.min(32, Number(last.tallyCount || 0) + 1);
      }
      continue;
    }

    current += ch;
  }

  flushCurrent();
  return groups;
}


function ordinaryAudioGlyphGroupsFromCartoucheSource(text) {
  const source = stripOuterBracketSyntaxForAudio(text);
  const groups = [];
  let current = '';
  let invalid = false;

  const flushCurrent = () => {
    const token = normalizeTpGlyphToken(current);
    current = '';
    if (!token) return;
    groups.push({
      token,
      tallyCount: 0,
      moraCount: 0,
      wholeWord: false,
      invalid: false
    });
  };

  const currentGroup = () => {
    flushCurrent();
    const group = groups[groups.length - 1] || null;
    if (!group) invalid = true;
    return group;
  };

  for (const ch of Array.from(source)) {
    if (/\s/.test(ch)) {
      flushCurrent();
      continue;
    }

    if (ch === '.' || ch === '·') {
      const group = currentGroup();
      if (!group) continue;
      if (group.wholeWord || group.tallyCount > 0) group.invalid = true;
      group.moraCount = Math.min(32, Number(group.moraCount || 0) + 1);
      continue;
    }

    if (ch === ':') {
      const group = currentGroup();
      if (!group) continue;
      if (group.wholeWord || group.moraCount > 0 || group.tallyCount > 0) group.invalid = true;
      group.wholeWord = true;
      continue;
    }

    // Preserve the existing tally convention independently of mora/whole-word
    // punctuation. A glyph cannot combine both conventions in one audio group.
    if (ch === ',') {
      const group = currentGroup();
      if (!group) continue;
      if (group.wholeWord || group.moraCount > 0) group.invalid = true;
      group.tallyCount = Math.min(32, Number(group.tallyCount || 0) + 1);
      continue;
    }

    current += ch;
  }

  flushCurrent();
  if (invalid || groups.some(group => group.invalid)) return [];
  return groups;
}

export function splitAudioTpWordIntoMorae(rawWord) {
  const word = audioWordTextForTallyGlyphToken(rawWord).replace(/'/g, '').toLowerCase();
  if (!word) return [];
  if (word === 'n') return ['n'];
  if (!/^[aeiouptkmnswlj]+$/.test(word)) return [];

  const morae = [];
  let index = 0;
  while (index < word.length) {
    const start = index;
    if (TP_CONS.has(word[index])) {
      if (index + 1 >= word.length || !TP_VOWS.has(word[index + 1])) return [];
      index += 1;
    }
    if (index >= word.length || !TP_VOWS.has(word[index])) return [];
    index += 1;
    morae.push(word.slice(start, index));

    if (index < word.length && word[index] === 'n') {
      const next = index + 1 < word.length ? word[index + 1] : '';
      if (!next || TP_CONS.has(next)) {
        morae.push('n');
        index += 1;
      }
    }
  }
  return morae;
}

function ordinaryCartoucheTextForGlyphGroup(group) {
  const token = normalizeTpGlyphToken(group?.token);
  if (!token || !isKnownTpGlyphToken(token)) return '';
  if (token === ':' || token === '.' || token === '·' || token === ',') return '';

  const wordText = audioWordTextForTallyGlyphToken(token).replace(/'/g, '').toLowerCase();
  if (!wordText) return '';

  const tallyCount = Math.max(0, Math.trunc(Number(group?.tallyCount) || 0));
  const moraCount = Math.max(0, Math.trunc(Number(group?.moraCount) || 0));
  const wholeWord = group?.wholeWord === true;

  if (Number(wholeWord) + Number(tallyCount > 0) + Number(moraCount > 0) > 1) return '';
  if (wholeWord) return wordText;
  if (tallyCount > 0) return tallyCount <= wordText.length ? wordText.slice(0, tallyCount) : '';
  if (moraCount > 0) {
    const morae = splitAudioTpWordIntoMorae(wordText);
    return morae.length >= moraCount ? morae.slice(0, moraCount).join('') : '';
  }
  return audioInitialForGlyphToken(token);
}

function analyzeOrdinaryPhoneticCartoucheSource(text) {
  const groups = ordinaryAudioGlyphGroupsFromCartoucheSource(text);
  if (!groups.length) return null;

  const letters = [];
  const pieces = [];
  for (let groupIndex = 0; groupIndex < groups.length; groupIndex++) {
    const piece = ordinaryCartoucheTextForGlyphGroup(groups[groupIndex]);
    if (!piece || !/^[aeiouptkmnswlj]+$/.test(piece)) return null;
    pieces.push(piece);
    for (const char of Array.from(piece)) letters.push({ char, groupIndex });
  }

  const spelled = pieces.join('').toLowerCase();
  if (!spelled) return null;
  return {
    groups,
    pieces,
    letters,
    spelled,
    displayText: titleCaseAudioProperNameText(spelled)
  };
}

function audioGlyphTokensFromCartoucheSource(text) {
  return audioGlyphGroupsFromCartoucheSource(text).map(group => group.token);
}

function audioInitialForGlyphToken(token) {
  const t = normalizeTpGlyphToken(token);
  if (!t) return '';
  if (t === ':') return 'k';       // kolon
  if (t === '·' || t === '.') return 'o'; // ota
  if (t === ',') return 'k';       // koma, if used literally
  const m = /^[a-z]/.exec(t);
  return m ? m[0] : '';
}

function audioInitialTextFromGlyphTokens(tokens) {
  const letters = [];
  for (const token of (tokens ?? [])) {
    const initial = audioInitialForGlyphToken(token);
    if (!initial) return '';
    letters.push(initial);
  }
  return letters.join('');
}

function isAudioNanpaLinjanTpPhraseTokens(tokens) {
  const words = Array.from(tokens ?? []).map(normalizeTpGlyphToken).filter(Boolean);
  if (words.length < 3) return false;
  if (words[0] !== 'nanpa') return false;
  if (!(words[1] === 'e' || words[1] === 'en' || words[1] === 'esun')) return false;
  if (words[words.length - 1] !== 'nanpa') return false;

  const digitGlyphWords = new Set(Object.values(TOKEN_TO_DIGIT_WORD).map(normalizeTpGlyphToken));
  const payload = words.slice(2, -1);
  if (!payload.some(w => digitGlyphWords.has(w))) return false;

  return words.every(w => AUDIO_NANPA_LINJA_N_WORDS.has(w) || isKnownTpGlyphToken(w));
}

function tryNanpaLinjanTpPhraseSourceToCaps(text) {
  const words = audioGlyphTokensFromCartoucheSource(text);
  if (!isAudioNanpaLinjanTpPhraseTokens(words)) return '';

  // Match the renderer's visual cartouche interpretation: the spoken
  // nanpa-linja-n label is the cartouche spelling, i.e. the initial sound of
  // each glyph token.
  let caps = audioInitialTextFromGlyphTokens(words).toUpperCase();
  if (!caps || !caps.startsWith('NE') || !caps.endsWith('N')) return '';

  // Expanded percent phrases end with the visible suffix words
  // nena/noka + open + kipisi + en/e + nanpa, whose initials are NOKEN.
  // Canonical nanpa-caps represents that suffix as OK immediately before the
  // final N. Normalize it here so expanded phrases, raw UCSUR streams, decimal
  // input, #~ input, and proper-name input all produce the same audio label.
  if (caps.endsWith('NOKEN')) caps = caps.slice(0, -5) + 'OKN';

  return caps;
}

const ABBREVIATED_NANPA_DIGIT_WORD_TO_CODE = Object.freeze({
  ijo: 'I',
  wan: 'W',
  tu: 'T',
  seli: 'S',
  awen: 'A',
  luka: 'L',
  utala: 'U',
  mun: 'M',
  pipi: 'P',
  jo: 'J'
});

/**
 * Decode a fully abbreviated numeric cartouche written directly as bracketed
 * glyph words. The renderer accepts this compact form only when numeric
 * cartouche abbreviation is enabled, for example:
 *
 *   [nanpa wan o seli kala ona pipi nanpa]
 *
 * The visible glyphs are a lossless shorthand for the #~ code. Reconstruct
 * that code here so audio uses the same nanpa-linja-n proper name as the
 * equivalent decimal, #~ code, or expanded numeric cartouche.
 */
function parseAbbreviatedNanpaLinjanCartoucheSource(text, options = {}) {
  const words = audioGlyphTokensFromCartoucheSource(text);
  if (words.length < 3 || words[0] !== 'nanpa' || words[words.length - 1] !== 'nanpa') return null;

  const NanpaParser = getNanpaParserFromOptions(options);
  if (!NanpaParser || typeof NanpaParser.parseNumber !== 'function') return null;

  const payload = words.slice(1, -1);
  let codeBody = '';
  let hasDigit = false;

  for (let index = 0; index < payload.length; index++) {
    const word = payload[index];
    const digitCode = ABBREVIATED_NANPA_DIGIT_WORD_TO_CODE[word];
    if (digitCode) {
      codeBody += digitCode;
      hasDigit = true;
      continue;
    }

    // Visible punctuation/operator glyphs retained by the renderer's
    // abbreviation pass. Structural nena/en/open glyphs are omitted.
    if (word === 'o' || word === 'ona') {
      codeBody += 'O';
      continue;
    }
    if (word === 'kulupu' || word === 'kasi' || word === 'kolon' || word === ':') {
      codeBody += 'K';
      continue;
    }
    if (word === 'kala') {
      codeBody += 'EKO';
      continue;
    }
    if (word === 'kin') {
      codeBody += 'OKO';
      continue;
    }
    if (word === 'kipisi') {
      // Percent is a suffix in #~ notation and therefore must be the final
      // visible payload glyph before the closing nanpa.
      if (index !== payload.length - 1) return null;
      codeBody += 'OK';
      continue;
    }

    return null;
  }

  if (!hasDigit || !codeBody) return null;

  try {
    const parsed = NanpaParser.parseNumber(`#~${codeBody}`, {
      mode: options.nanpaLinjanMode || options.mode || 'uniform',
      mixedStyle: options.mixedStyle || 'short',
      relaxedNanpaLinjanParsing: !!options.relaxedNanpaLinjanParsing,
      relaxedNanpaLinjanRendering: !!options.relaxedNanpaLinjanRendering
    });
    if (!parsed) return null;
    return { words, codeBody, parsed };
  } catch {}

  return null;
}

export function tryAbbreviatedNanpaLinjanCartoucheSourceToProperName(text, options = {}) {
  const decoded = parseAbbreviatedNanpaLinjanCartoucheSource(text, options);
  if (!decoded) return '';

  const NanpaParser = getNanpaParserFromOptions(options);
  if (decoded.parsed?.caps) {
    const properName = splitNanpaCapsToAudioProperName(decoded.parsed.caps, NanpaParser, options);
    if (properName) return compactSpeechWhitespace(properName);
  }
  if (decoded.parsed?.properName) return compactSpeechWhitespace(decoded.parsed.properName);
  return '';
}

function titleCaseAudioProperNameText(text) {
  const s = String(text ?? '').trim().toLowerCase();
  if (!s) return '';
  return s[0].toUpperCase() + s.slice(1);
}

export function isCapitalizedAudioProperNameText(text) {
  const s = String(text ?? '').trim();
  if (!/^[A-Z][A-Za-z']*$/.test(s)) return false;
  return isAudioTpPhonotacticWord(s);
}

export function isCapitalizedAudioProperNamePhraseText(text) {
  const words = String(text ?? '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return false;
  return words.every(isCapitalizedAudioProperNameText);
}

function normalizeAudioProperNameCompareText(text) {
  return String(text ?? '').replace(/@db\b/gi, '').replace(/_/g, '').replace(/[^A-Za-z']/g, '').toLowerCase();
}

function audioCartoucheSourceJoinedLetters(text) {
  const words = audioGlyphTokensFromCartoucheSource(text);
  if (!words.length) return '';
  if (!words.every(token => isKnownTpGlyphToken(token) || isAudioTpPhonotacticWord(token))) return '';
  return words.join('').replace(/[^a-z']/gi, '').toLowerCase();
}

export function extractRawCapitalizedProperNameQueuesByLine(rawText) {
  return String(rawText ?? '')
    .split(/\n/)
    .map(line => {
      const out = [];
      let inQuote = false;
      let bracketDepth = 0;
      const text = String(line ?? '');

      for (let i = 0; i < text.length;) {
        const ch = text[i];
        if (ch === '"') { inQuote = !inQuote; i += 1; continue; }
        if (!inQuote && ch === '[') { bracketDepth += 1; i += 1; continue; }
        if (!inQuote && ch === ']') { bracketDepth = Math.max(0, bracketDepth - 1); i += 1; continue; }

        if (!inQuote && bracketDepth === 0 && /[A-Z]/.test(ch)) {
          const m = /^[A-Z][A-Za-z']*(?:@db\b)?/.exec(text.slice(i));
          if (m) {
            const token = m[0];
            const clean = token.replace(/@db\b/i, '');
            if (isCapitalizedAudioProperNameText(clean)) out.push({ raw: clean, used: false });
            i += token.length;
            continue;
          }
        }
        i += 1;
      }
      return out;
    });
}

function takeMatchingRawProperNameForCartoucheSource(sourceText, rawProperNameQueue) {
  const joined = audioCartoucheSourceJoinedLetters(sourceText);
  if (!joined || !Array.isArray(rawProperNameQueue)) return '';

  for (const item of rawProperNameQueue) {
    if (!item || item.used) continue;
    const raw = String(item.raw ?? '').trim();
    if (!raw || !isCapitalizedAudioProperNameText(raw)) continue;
    if (normalizeAudioProperNameCompareText(raw) !== joined) continue;
    item.used = true;
    return raw;
  }
  return '';
}

function audioWordTextForTallyGlyphToken(token) {
  const normalized = normalizeTpGlyphToken(token);
  if (!normalized) return '';
  if (normalized === ':') return 'kolon';
  if (normalized === '·' || normalized === '.') return 'ota';
  if (normalized === ',') return 'koma';
  if (normalized === 'ni>' || normalized === 'ni^' || normalized === 'ni<') return 'ni';
  if (normalized === 'sewi^') return 'sewi';
  return normalized.replace(/[^a-z']/g, '');
}

function audioLettersForCartoucheGlyphGroup(group) {
  const token = normalizeTpGlyphToken(group?.token);
  if (!token || !isKnownTpGlyphToken(token)) return '';

  const tallyCount = Math.max(0, Math.trunc(Number(group?.tallyCount) || 0));
  if (tallyCount <= 0) return audioInitialForGlyphToken(token);

  const wordText = audioWordTextForTallyGlyphToken(token).replace(/'/g, '').toLowerCase();
  if (!wordText || tallyCount > wordText.length) return '';
  return wordText.slice(0, tallyCount);
}

export function tryCartoucheSourceToSpokenSyllableText(text) {
  const analyzed = analyzeOrdinaryPhoneticCartoucheSource(text);
  return analyzed?.displayText || '';
}

function getNanpaParserFromOptions(options = {}) {
  return options.NanpaParser || options.nanpaParser || options.parser?.NanpaParser || null;
}

const STRICT_TO_RELAXED_NANPA_CAPS_PAIR = Object.freeze({
  WE: 'WA',
  TE: 'TU',
  LE: 'LU',
  ME: 'MU',
  PE: 'PI'
});

/**
 * Convert only strict digit pairs in a valid nanpa-caps label to their relaxed
 * equivalents. Numeric punctuation pairs and the final cartouche n are left
 * unchanged. This is an audio-label conversion only; it does not alter the
 * renderer plan, parser output, or displayed cartouche.
 */
export function nanpaCapsForAudioMode(caps, options = {}) {
  const source = String(caps ?? '').trim().toUpperCase();
  if (!options.relaxedNanpaLinjanRendering) return source;
  if (!source.startsWith('NE') || !source.endsWith('N')) return source;

  const pairArea = source.slice(0, -1);
  if (pairArea.length % 2 !== 0) return source;

  let converted = '';
  for (let index = 0; index < pairArea.length; index += 2) {
    const pair = pairArea.slice(index, index + 2);
    converted += STRICT_TO_RELAXED_NANPA_CAPS_PAIR[pair] || pair;
  }
  return converted + 'N';
}

function splitNanpaCapsToAudioProperName(caps, NanpaParser, options = {}) {
  if (!caps || typeof NanpaParser?.splitCapsToProperName !== 'function') return '';
  const audioCaps = nanpaCapsForAudioMode(caps, options);
  return NanpaParser.splitCapsToProperName(audioCaps, {
    titleCase: true,
    relaxedNanpaLinjanParsing: !!options.relaxedNanpaLinjanRendering
  }) || '';
}

export function trySourceTextToNanpaProperName(text, options = {}) {
  const source = String(text ?? '').trim();
  if (!source) return '';

  const NanpaParser = getNanpaParserFromOptions(options);
  if (!NanpaParser) return '';

  try {
    const caps = tryNanpaLinjanTpPhraseSourceToCaps(source);
    const properName = splitNanpaCapsToAudioProperName(caps, NanpaParser, options);
    if (properName) return properName;
  } catch {}

  try {
    const abbreviatedProperName = tryAbbreviatedNanpaLinjanCartoucheSourceToProperName(source, options);
    if (abbreviatedProperName) return abbreviatedProperName;
  } catch {}

  try {
    if (typeof NanpaParser.parseNumber !== 'function') return '';
    const parsed = NanpaParser.parseNumber(source, {
      mode: options.nanpaLinjanMode || options.mode || 'uniform',
      mixedStyle: options.mixedStyle || 'short',
      relaxedNanpaLinjanParsing: !!options.relaxedNanpaLinjanParsing,
      relaxedNanpaLinjanRendering: !!options.relaxedNanpaLinjanRendering
    });
    if (parsed?.caps) {
      const properName = splitNanpaCapsToAudioProperName(parsed.caps, NanpaParser, options);
      if (properName) return properName;
    }
    if (parsed?.properName) return parsed.properName;
  } catch {}

  return '';
}


const RAW_AUDIO_CARTOUCHE_START_CP = 0xF1990;
const RAW_AUDIO_CARTOUCHE_END_CP = 0xF1991;
const RAW_AUDIO_SILENT_CONTROL_CPS = new Set([
  0x200D, // zero-width joiner
  0x3000, // ideographic spacing cell
  0xF1992, // cartouche extension
  0xF1994, // long-pi extension
  0xF1995, // stacking joiner
  0xF1996, // scaling/nesting joiner
  0xF1997,
  0xF1998,
  0xF199A,
  0xF199B
]);

function isExplicitRawCodepointAudioRun(run) {
  const source = String(run?.sourceText ?? run?._element?.sourceText ?? '');
  const cps = runCodepointsForAudio(run);
  return cps.length > 0 && /U\+[0-9A-F]{1,6}/i.test(source);
}

function normalizeRawCodepointAudioWord(word) {
  const w = String(word ?? '').trim().toLowerCase();
  if (!w) return '';

  // Alternative glyphs are visual forms of the same spoken Toki Pona word.
  if (w === 'ni>' || w === 'ni^' || w === 'ni<') return 'ni';
  if (w === 'sewi^') return 'sewi';

  // Renderer convenience punctuation names must behave like their punctuation
  // source paths, not like newly invented pronounceable words.
  if (w === 'ota' || w === '.' || w === '·') return '.';
  if (w === 'kolon' || w === ':') return ':';
  if (w === 'koma' || w === ',') return ',';

  return w;
}

function rawCodepointAudioWordForCp(cp, options = {}) {
  const n = Number(cp);
  if (!Number.isFinite(n)) return '';

  if (n === 0x002E || n === 0x00B7 || n === 0xF199C) return '.';
  if (n === 0x003A || n === 0xF199D) return ':';
  if (n === 0x002C || n === 0xF199E) return ',';
  if (n === 0x300C) return options.silenceTeToAudio === true ? '' : 'te';
  if (n === 0x300D) return options.silenceTeToAudio === true ? '' : 'to';
  if (n === 0xF1993) return 'pi'; // long-pi opening glyph
  if (RAW_AUDIO_SILENT_CONTROL_CPS.has(n)) return '';

  const NanpaParser = getNanpaParserFromOptions(options);
  if (typeof NanpaParser?.codepointsToWords !== 'function') return '';
  try {
    const words = NanpaParser.codepointsToWords([n]);
    return normalizeRawCodepointAudioWord(words?.[0] || '');
  } catch {
    return '';
  }
}

function rawCartoucheSemanticEntries(innerCps, options = {}) {
  const entries = [];
  for (let index = 0; index < innerCps.length; index++) {
    const cp = Number(innerCps[index]);
    if (RAW_AUDIO_SILENT_CONTROL_CPS.has(cp)) continue;
    const word = rawCodepointAudioWordForCp(cp, options);
    if (!word) return [];
    entries.push({ cp, index, word });
  }
  return entries;
}

function rawCodepointCartoucheSource(innerCps, options = {}) {
  const entries = rawCartoucheSemanticEntries(innerCps, options);
  if (!entries.length) return '';
  return `[${entries.map(entry => entry.word).join(' ')}]`;
}

function fillNearestMappedSourceIndices(displayedLength, mappedPairs) {
  const out = new Array(displayedLength).fill(null);
  for (const pair of mappedPairs || []) {
    if (pair && Number.isFinite(pair.displayedIndex) && Number.isFinite(pair.sourceIndex)) {
      out[pair.displayedIndex] = pair.sourceIndex;
    }
  }
  for (let i = 0; i < out.length; i++) {
    if (out[i] != null) continue;
    let left = i - 1;
    let right = i + 1;
    while (left >= 0 && out[left] == null) left -= 1;
    while (right < out.length && out[right] == null) right += 1;
    out[i] = left >= 0 ? out[left] : (right < out.length ? out[right] : 0);
  }
  return out.map(value => Number(value) || 0);
}

function expandedNumericSourceForRawCartouche(sourceText, displayedInnerCps, options = {}) {
  const NanpaParser = getNanpaParserFromOptions(options);
  if (!NanpaParser) return null;

  const properName = trySourceTextToNanpaProperName(sourceText, options);
  if (!properName || typeof NanpaParser.parseNumber !== 'function') return null;

  try {
    const parsed = NanpaParser.parseNumber(properName, {
      mode: options.nanpaLinjanMode || options.mode || 'uniform',
      mixedStyle: options.mixedStyle || 'short',
      relaxedNanpaLinjanParsing: !!options.relaxedNanpaLinjanParsing,
      relaxedNanpaLinjanRendering: !!options.relaxedNanpaLinjanRendering
    });
    const expanded = parsed?.innerCodepoints || parsed?.ucsurCodepoints;
    if (!Array.isArray(expanded) || !expanded.length) return null;
    const semanticEntries = rawCartoucheSemanticEntries(displayedInnerCps, options);
    if (!semanticEntries.length) return null;
    const aligned = alignDisplayedCodepointsToExpandedSource(
      semanticEntries.map(entry => entry.cp),
      expanded
    );
    if (!aligned || aligned.length !== semanticEntries.length) return null;
    const mappedPairs = semanticEntries.map((entry, index) => ({
      displayedIndex: entry.index,
      sourceIndex: aligned[index]
    }));
    return {
      sourceCps: Array.from(expanded).map(Number).filter(Number.isFinite),
      innerSourceIndices: fillNearestMappedSourceIndices(displayedInnerCps.length, mappedPairs)
    };
  } catch {
    return null;
  }
}

function analyzeExplicitRawCodepointRun(run, options = {}) {
  if (!isExplicitRawCodepointAudioRun(run)) return null;

  const cps = runCodepointsForAudio(run);
  const segments = [];
  const speechParts = [];
  let index = 0;

  while (index < cps.length) {
    const cp = Number(cps[index]);

    if (cp === RAW_AUDIO_CARTOUCHE_START_CP) {
      const endIndex = cps.indexOf(RAW_AUDIO_CARTOUCHE_END_CP, index + 1);
      if (endIndex >= 0) {
        const innerCps = cps.slice(index + 1, endIndex);
        const semanticEntries = rawCartoucheSemanticEntries(innerCps, options);
        const sourceText = semanticEntries.length
          ? `[${semanticEntries.map(entry => entry.word).join(' ')}]`
          : '';
        if (sourceText) {
          const numericProperName = trySourceTextToNanpaProperName(sourceText, options);
          const ordinaryProperName = numericProperName
            ? ''
            : tryCartoucheSourceToSpokenSyllableText(sourceText);
          const speech = compactSpeechWhitespace(numericProperName || ordinaryProperName);
          if (speech) {
            const numericSource = numericProperName
              ? expandedNumericSourceForRawCartouche(sourceText, innerCps, options)
              : null;
            segments.push({
              kind: 'cartouche',
              startIndex: index,
              endIndex,
              sourceText,
              speech,
              numeric: !!numericProperName,
              numericSource,
              semanticInnerCps: semanticEntries.map(entry => entry.cp),
              ordinaryInnerSourceIndices: fillNearestMappedSourceIndices(
                innerCps.length,
                semanticEntries.map((entry, sourceIndex) => ({
                  displayedIndex: entry.index,
                  sourceIndex
                }))
              )
            });
            speechParts.push(speech);
          }
        }
        index = endIndex + 1;
        continue;
      }
    }

    if (cp === RAW_AUDIO_CARTOUCHE_END_CP) {
      index += 1;
      continue;
    }

    const semantic = rawCodepointAudioWordForCp(cp, options);
    if (semantic) {
      const kind = /^[.,:;!?]$/.test(semantic) ? 'punctuation' : 'word';
      segments.push({ kind, startIndex: index, endIndex: index, speech: semantic });
      speechParts.push(semantic);
    }
    index += 1;
  }

  return {
    speech: compactSpeechWhitespace(speechParts.join(' ')),
    segments
  };
}

function punctuationAliasSpeechText(run, sourceText) {
  const kind = String(run?.kind ?? '').toLowerCase();
  if (kind === 'cartouche') return '';
  const source = compactSpeechWhitespace(sourceText).toLowerCase();
  if (source === 'ota' || source === '·') return '.';
  if (source === 'kolon') return ':';
  if (source === 'koma') return ',';
  return '';
}

function isSilentTeToAudioRun(run, sourceText, audioText, options = {}) {
  if (options.silenceTeToAudio !== true) return false;
  const kind = String(run?.kind ?? '').toLowerCase();
  if (kind === 'cartouche') return false;
  const candidate = compactSpeechWhitespace(audioText || sourceText).toLowerCase();
  return candidate === 'te' || candidate === 'to';
}

function phonotacticUnknownSpeechText(sourceText) {
  const candidate = sanitizeTextToSitelenAudioText(sourceText);
  if (!candidate) return '';
  const tokens = candidate.match(/[A-Za-z']+|[.,!?;:]/g) || [];
  if (!tokens.some(token => /[A-Za-z]/.test(token))) return '';
  if (!tokens.every(token => /^[.,!?;:]$/.test(token) || isAudioTpPhonotacticWord(token))) return '';
  return compactSpeechWhitespace(candidate);
}

export function speechTextForRenderRun(run, skipped = [], options = {}) {
  if (!run) return '';

  const rawProperNameQueue = Array.isArray(options)
    ? options
    : (options.rawProperNameQueue || []);

  const kind = String(run.kind ?? '').toLowerCase();
  const sourceKind = String(run.sourceKind ?? '').toLowerCase();
  const sourceText = String(run.sourceText ?? run.encodedText ?? '').trim();
  const audioText = String(run.audioText ?? run._element?.audioText ?? '').trim();
  if (!sourceText && !audioText) return '';

  if (sourceKind === 'image' || kind === 'image') {
    skipped.push({ kind: 'image', text: sourceText });
    return '';
  }

  if (run.isQuoted || sourceKind === 'quote') {
    skipped.push({ kind: 'quoted', text: sourceText });
    return '';
  }

  if (isSilentTeToAudioRun(run, sourceText, audioText, options)) {
    skipped.push({ kind: 'silent-te-to', text: sourceText || audioText });
    return '';
  }

  const rawCodepointAudio = analyzeExplicitRawCodepointRun(run, options);
  if (rawCodepointAudio) {
    if (rawCodepointAudio.speech) return rawCodepointAudio.speech;
    skipped.push({ kind: 'raw-codepoints-silent', text: sourceText });
    return '';
  }

  const punctuationAlias = punctuationAliasSpeechText(run, sourceText);
  if (punctuationAlias) return punctuationAlias;

  if (run.isUnrecognized) {
    const phonotacticSpeech = phonotacticUnknownSpeechText(sourceText);
    if (phonotacticSpeech && options.soundOutPhonotacticUnknownWords === true) {
      return phonotacticSpeech;
    }
    skipped.push({
      kind: phonotacticSpeech ? 'phonotactic-unknown-muted' : 'invalid-phonotactic-unknown',
      text: sourceText
    });
    return '';
  }

  // Renderer-generated nasin nanpa pona glyphs deliberately retain their
  // original Arabic sourceText for selection and export reconstruction. When
  // the renderer also supplies audioText, speak that generated ordinary Toki
  // Pona word instead of attempting to pronounce the original number syntax.
  // Restrict this override to non-cartouche runs so established numeric and
  // proper-name cartouche audio behavior remains unchanged.
  if (kind !== 'cartouche' && audioText) {
    const readableAudioText = sanitizeTextToSitelenAudioText(audioText);
    if (isReadableAudioTokiPonaText(readableAudioText)) return readableAudioText;
  }

  if (kind === 'cartouche') {
    // A plain capitalized proper name such as Manlun may render visually as a
    // cartouche, but its audio source must remain the original proper-name word.
    if (sourceKind !== 'bracket' && isCapitalizedAudioProperNamePhraseText(sourceText)) {
      return compactSpeechWhitespace(sourceText);
    }

    const properName = trySourceTextToNanpaProperName(sourceText, options);
    if (properName) return compactSpeechWhitespace(properName);

    const cartoucheSyllables = tryCartoucheSourceToSpokenSyllableText(sourceText);
    if (cartoucheSyllables) return cartoucheSyllables;

    if (sourceKind !== 'bracket') {
      const originalProperName = takeMatchingRawProperNameForCartoucheSource(sourceText, rawProperNameQueue);
      if (originalProperName) return compactSpeechWhitespace(originalProperName);
    }

    // For non-bracket cartouches, allow already-capitalized DB/proper-name
    // source text through if readable. Do not allow lowercase glyph words such
    // as ma n lu n to fall through as ordinary speech.
    const readableCartoucheText = sanitizeTextToSitelenAudioText(sourceText);
    if (sourceKind !== 'bracket' && /[A-Z]/.test(sourceText) && isReadableAudioTokiPonaText(readableCartoucheText)) {
      return readableCartoucheText;
    }

    skipped.push({ kind: sourceKind === 'bracket' ? 'cartouche' : 'numeric-cartouche', text: sourceText });
    return '';
  }

  if (/^[.,!?;:]$/.test(sourceText)) return sourceText;

  const readableText = sanitizeTextToSitelenAudioText(sourceText);
  if (isReadableAudioTokiPonaText(readableText)) return readableText;

  skipped.push({ kind: 'unknown', text: sourceText });
  return '';
}

export function extractSpeechLinesFromRenderPlan(plan, options = {}) {
  const skipped = [];
  const lines = [];
  const rawInput = options.rawInput ?? options.sourceInput ?? '';
  const rawProperNameQueues = extractRawCapitalizedProperNameQueuesByLine(rawInput);
  const renderLines = Array.isArray(plan?.lines) ? plan.lines : [];

  for (let lineIndex = 0; lineIndex < renderLines.length; lineIndex++) {
    const line = renderLines[lineIndex];
    const parts = [];
    const sourceLineIndex = Number.isFinite(Number(line?.sourceLineIndex))
      ? Number(line.sourceLineIndex)
      : lineIndex;
    const rawProperNameQueue = rawProperNameQueues[sourceLineIndex] || [];
    for (const run of (line?.runs || [])) {
      const speech = speechTextForRenderRun(run, skipped, {
        ...options,
        rawProperNameQueue,
        lineIndex
      });
      if (speech) {
        const sourceText = String(run?.sourceText ?? run?.encodedText ?? '').trim();
        const ordinaryCartouche = String(run?.kind ?? '').toLowerCase() === 'cartouche' &&
          !isConfirmedNumericCartoucheRun(run, options) &&
          !!analyzeOrdinaryPhoneticCartoucheSource(sourceText);
        parts.push(ordinaryCartouche ? speech.toLowerCase() : speech);
      }
    }
    lines.push(compactSpeechWhitespace(parts.join(' ')));
  }

  return {
    lines,
    skipped,
    warnings: []
  };
}

// Backward-friendly alias for the name used in text-to-sitelen.html today.
export function buildTextAudioLinesFromRenderPlan(plan, rawInput = '', options = {}) {
  return extractSpeechLinesFromRenderPlan(plan, {
    ...options,
    rawInput
  });
}

function normalizePreparedAudioInput(value, rawText) {
  if (value == null) return String(rawText ?? '');
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    if (typeof value.audioInput === 'string') return value.audioInput;
    if (typeof value.input === 'string') return value.input;
    if (typeof value.text === 'string') return value.text;
  }
  return String(value ?? '');
}

export function prepareAudioInputForPlan(rawText, pageMap, CartoucheApi) {
  if (!CartoucheApi) return String(rawText ?? '');

  if (typeof CartoucheApi.prepareRenderAndAudioInput === 'function') {
    const prepared = CartoucheApi.prepareRenderAndAudioInput(rawText, pageMap);
    return normalizePreparedAudioInput(prepared, rawText);
  }

  if (typeof CartoucheApi.prepareAudioInput === 'function') {
    const prepared = CartoucheApi.prepareAudioInput(rawText, pageMap);
    return normalizePreparedAudioInput(prepared, rawText);
  }

  if (typeof CartoucheApi.prepareInput === 'function') {
    const prepared = CartoucheApi.prepareInput(rawText, pageMap);
    return normalizePreparedAudioInput(prepared, rawText);
  }

  return String(rawText ?? '');
}

async function buildRendererPlanForAudioInput(renderer, audioInput, rendererConfig = {}) {
  if (!renderer || typeof renderer.buildRenderPlan !== 'function') {
    throw new Error('buildSitelenAudioPlan requires a renderer with buildRenderPlan().');
  }

  let ast = rendererConfig?.ast;
  if (!ast && typeof renderer.parseInput === 'function') {
    const parsed = await renderer.parseInput({
      input: audioInput,
      parser: rendererConfig?.parser || {}
    });
    ast = parsed?.ast || null;
  }

  return await renderer.buildRenderPlan({
    ...(rendererConfig || {}),
    input: audioInput,
    ast
  });
}

export async function buildSitelenAudioPlan({
  rawText,
  pageMap,
  renderer,
  rendererConfig = {},
  CartoucheApi,
  NanpaParser = null,
  nanpaParser = null,
  nanpaLinjanMode = 'uniform',
  mixedStyle = 'short',
  relaxedNanpaLinjanParsing = false,
  relaxedNanpaLinjanRendering = false,
  silenceTeToAudio = false,
  soundOutPhonotacticUnknownWords = false,
  interpretDoubleQuotesAsTeTo = false,
  normalizeNonDrawableSourceTokens = true
} = {}) {
  const originalRaw = String(rawText ?? '');
  const raw = normalizeNonDrawableSourceTokens
    ? normalizeNonDrawableSourceTokensForAudioInput(originalRaw)
    : originalRaw;
  const audioInput = prepareAudioInputForPlan(raw, pageMap, CartoucheApi);

  if (!audioInput.trim()) {
    return {
      rawText: raw,
      originalRawText: originalRaw,
      audioInput,
      audioPlan: null,
      speechLines: [],
      lines: [],
      skipped: [],
      warnings: []
    };
  }

  const audioPlan = await buildRendererPlanForAudioInput(renderer, audioInput, rendererConfig);
  const extracted = extractSpeechLinesFromRenderPlan(audioPlan, {
    sourceInput: audioInput,
    rawInput: raw,
    NanpaParser: NanpaParser || nanpaParser,
    nanpaParser: nanpaParser || NanpaParser,
    nanpaLinjanMode,
    mixedStyle,
    relaxedNanpaLinjanParsing,
    relaxedNanpaLinjanRendering,
    silenceTeToAudio,
    soundOutPhonotacticUnknownWords,
    interpretDoubleQuotesAsTeTo
  });

  return {
    rawText: raw,
    originalRawText: originalRaw,
    audioInput,
    audioPlan,
    speechLines: extracted.lines,
    lines: extracted.lines,
    skipped: extracted.skipped,
    warnings: extracted.warnings || []
  };
}

function isSitelenAudioCancelled(shouldCancel) {
  if (typeof shouldCancel !== 'function') return false;
  try { return !!shouldCancel(); }
  catch { return false; }
}

export function makeSilenceSamples(seconds, sampleRate = 48000) {
  const n = Math.max(0, Math.round(Number(seconds || 0) * Number(sampleRate || 48000)));
  return new Float32Array(n);
}

export function concatAudioSampleChunks(chunks) {
  const total = Array.from(chunks || []).reduce((sum, chunk) => sum + (chunk?.length || 0), 0);
  const out = new Float32Array(total);
  let offset = 0;
  for (const chunk of chunks || []) {
    if (!chunk?.length) continue;
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}


function isTerminalSentencePunctuationAt(text, index) {
  const s = String(text ?? '');
  const ch = s[index];
  if (ch === '!' || ch === '?') return true;
  if (ch !== '.') return false;

  // A decimal point inside a number is not a sentence boundary.
  const prev = index > 0 ? s[index - 1] : '';
  const next = index + 1 < s.length ? s[index + 1] : '';
  if (/\d/.test(prev) && /\d/.test(next)) return false;
  return true;
}

export function splitSpeechTextIntoSentenceFragments(text) {
  const s = compactSpeechWhitespace(text);
  if (!s) return [];

  const out = [];
  let start = 0;
  for (let i = 0; i < s.length; i++) {
    if (!isTerminalSentencePunctuationAt(s, i)) continue;

    // Keep a run of adjacent sentence punctuation together, e.g. "?!".
    let end = i + 1;
    while (end < s.length && (s[end] === '!' || s[end] === '?' || s[end] === '.')) {
      if (s[end] === '.' && !isTerminalSentencePunctuationAt(s, end)) break;
      end += 1;
    }

    const fragment = compactSpeechWhitespace(s.slice(start, end));
    if (fragment) out.push({ text: fragment, endsSentence: true });
    start = end;
    i = end - 1;
  }

  const tail = compactSpeechWhitespace(s.slice(start));
  if (tail) out.push({ text: tail, endsSentence: false });
  return out;
}

function countSentenceBoundariesInSourceText(text, run = null) {
  const kind = String(run?.kind ?? '').toLowerCase();
  const sourceKind = String(run?.sourceKind ?? '').toLowerCase();

  // Numeric/ordinary cartouches, quoted text, and unknown text are not prose
  // sentence boundaries for audio/highlight alignment.
  if (
    kind === 'cartouche' ||
    sourceKind === 'bracket' ||
    sourceKind === 'quote' ||
    run?.isQuoted ||
    run?.isUnrecognized
  ) return 0;

  return splitSpeechTextIntoSentenceFragments(text)
    .reduce((count, fragment) => count + (fragment.endsSentence ? 1 : 0), 0);
}

function containsSpokenWord(text) {
  return /[A-Za-z]/.test(String(text ?? ''));
}

function appendUniqueRunRef(targets, run, fallbackRunIndex, lineIndex) {
  if (!Array.isArray(targets) || !run) return;
  const runIndex = Number.isFinite(Number(run.runIndex)) ? Number(run.runIndex) : fallbackRunIndex;
  const id = run.id != null ? String(run.id) : `L${lineIndex}R${runIndex}`;
  if (targets.some(item => item.id === id)) return;
  targets.push({ id, lineIndex, runIndex });
}


const AUDIO_VISUAL_CONTROL_CPS = new Set([
  0x200D,
  0xF1990,
  0xF1991,
  0xF1992,
  0xF1993,
  0xF1994,
  0xF1995,
  0xF1996,
  0xF1997,
  0xF1998,
  0xF199A,
  0xF199B
]);

// These nanpa-linja-n punctuation words are reference-audio assets in their
// own right. They must remain one audio/highlight unit: Eke must never be
// resynthesised as separate "E" and "ke" pieces.
const WHOLE_NUMERIC_AUDIO_WORDS = new Set([
  'eke', 'eken', 'ekeke', 'ekeken', 'ekekeke', 'ekekeken',
  'keke', 'keken', 'kekeke', 'kekeken',
  'one', 'ono', 'oko', 'eko', 'oken', 'ene', 'inin'
]);

// A compound is one indivisible rendered visual even though its source words
// are spoken separately. Every spoken member therefore targets the complete
// run, including the joiner and both/all component glyphs.
const AUDIO_COMPOUND_JOINER_CPS = new Set([
  0x200D, // generic compound joiner (&)
  0xF1995, // stacked compound joiner (-)
  0xF1996  // scaled compound joiner (+)
]);

// The optional visible spacer in an abbreviated numeric cartouche represents
// the full nena en nena en source sequence, pronounced as the single reference
// audio unit "Ene".
const AUDIO_CP_EN = 0xF190A;
const AUDIO_CP_NENA = 0xF1940;

function spokenWordTokens(text) {
  return String(text ?? '').match(/[A-Za-z']+/g) || [];
}

export function splitAudioTpWordIntoSyllables(rawWord) {
  const source = String(rawWord ?? '').replace(/[^A-Za-z']/g, '');
  const lower = source.replace(/'/g, '').toLowerCase();
  if (!lower) return [];

  const out = [];
  let i = 0;
  while (i < lower.length) {
    const start = i;
    if (TP_CONS.has(lower[i])) i += 1;
    if (i >= lower.length || !TP_VOWS.has(lower[i])) return [source];
    i += 1;
    if (i < lower.length && lower[i] === 'n') {
      const next = i + 1 < lower.length ? lower[i + 1] : '';
      if (!next || TP_CONS.has(next)) i += 1;
    }
    out.push(source.slice(start, i));
  }
  return out.filter(Boolean);
}

function runIdForAudio(run, fallbackRunIndex, lineIndex) {
  const runIndex = Number.isFinite(Number(run?.runIndex)) ? Number(run.runIndex) : fallbackRunIndex;
  return run?.id != null ? String(run.id) : `L${lineIndex}R${runIndex}`;
}

function runCodepointsForAudio(run) {
  const direct = Array.isArray(run?.cps) ? run.cps : run?._element?.cps;
  if (Array.isArray(direct) && direct.length) return direct.map(Number).filter(Number.isFinite);
  if (Number.isFinite(Number(run?._element?.cp))) return [Number(run._element.cp)];
  return [];
}


function splitAudioTpTextIntoSyllableSpans(rawText) {
  const source = String(rawText ?? '').replace(/[^A-Za-z']/g, '');
  const lower = source.replace(/'/g, '').toLowerCase();
  if (!lower) return [];

  const spans = [];
  let index = 0;
  while (index < lower.length) {
    const start = index;
    if (TP_CONS.has(lower[index])) index += 1;
    if (index >= lower.length || !TP_VOWS.has(lower[index])) return [];
    index += 1;
    if (index < lower.length && lower[index] === 'n') {
      const next = index + 1 < lower.length ? lower[index + 1] : '';
      if (!next || TP_CONS.has(next)) index += 1;
    }
    spans.push({ text: lower.slice(start, index), start, end: index, bank: 'syllables' });
  }
  return spans;
}

function splitOrdinaryCartoucheSoundIntoAudioSpans(spelled) {
  const source = String(spelled ?? '').toLowerCase();
  if (!source) return [];

  // Ordinary cartouches are always sounded from the general syllable bank.
  // A single vowel is therefore a valid one-letter syllable; only isolated
  // consonants and other unsyllabifiable residual sounds use letter_sounds.
  const completeSyllables = splitAudioTpTextIntoSyllableSpans(source);
  if (completeSyllables.length) return completeSyllables;

  // For an otherwise unsyllabifiable name, keep finding complete TP syllables
  // wherever possible and use isolated letter sounds only for the residual
  // sounds. A syllable may span multiple source glyphs.
  const spans = [];
  let index = 0;
  while (index < source.length) {
    const start = index;
    let end = index;

    if (TP_VOWS.has(source[index])) {
      end = index + 1;
      if (end < source.length && source[end] === 'n') {
        const next = end + 1 < source.length ? source[end + 1] : '';
        if (!next || TP_CONS.has(next)) end += 1;
      }
    } else if (
      TP_CONS.has(source[index]) &&
      index + 1 < source.length &&
      TP_VOWS.has(source[index + 1])
    ) {
      end = index + 2;
      if (end < source.length && source[end] === 'n') {
        const next = end + 1 < source.length ? source[end + 1] : '';
        if (!next || TP_CONS.has(next)) end += 1;
      }
    }

    if (end > start) {
      spans.push({ text: source.slice(start, end), start, end, bank: 'syllables' });
      index = end;
      continue;
    }

    spans.push({ text: source[index], start: index, end: index + 1, bank: 'letter_sounds' });
    index += 1;
  }
  return spans;
}

function ordinaryCartoucheGroupComponentIndices(run, groups) {
  const cps = runCodepointsForAudio(run);
  const semanticIndices = [];
  for (let index = 0; index < cps.length; index++) {
    if (!AUDIO_VISUAL_CONTROL_CPS.has(Number(cps[index]))) semanticIndices.push(index);
  }

  const expectedCount = Array.from(groups || []).reduce((sum, group) => (
    sum + 1 +
    Math.max(0, Math.trunc(Number(group?.tallyCount) || 0)) +
    Math.max(0, Math.trunc(Number(group?.moraCount) || 0)) +
    (group?.wholeWord === true ? 1 : 0)
  ), 0);

  const mapped = [];
  if (semanticIndices.length === expectedCount) {
    let cursor = 0;
    for (const group of groups || []) {
      const count = 1 +
        Math.max(0, Math.trunc(Number(group?.tallyCount) || 0)) +
        Math.max(0, Math.trunc(Number(group?.moraCount) || 0)) +
        (group?.wholeWord === true ? 1 : 0);
      mapped.push(semanticIndices.slice(cursor, cursor + count));
      cursor += count;
    }
    return mapped;
  }

  // Conservative fallback for adapter-specific codepoint layouts: one visible
  // component group per source glyph. Attached punctuation may be omitted from
  // the highlight rather than assigning it to an unrelated glyph.
  const visibleGroups = visibleComponentGroups(cps);
  for (let index = 0; index < (groups || []).length; index++) {
    mapped.push(Array.from(visibleGroups[index] || []));
  }
  return mapped;
}

function buildOrdinaryPhoneticCartoucheSpeechUnits(
  run,
  analyzed,
  fallbackRunIndex,
  lineIndex,
  options = {}
) {
  const spans = splitOrdinaryCartoucheSoundIntoAudioSpans(analyzed?.spelled);
  if (!spans.length) return [];

  const groupComponents = ordinaryCartoucheGroupComponentIndices(run, analyzed.groups);
  const word = analyzed.displayText;

  return spans.map((span, unitIndex) => {
    const groupIndices = [...new Set(
      analyzed.letters
        .slice(span.start, span.end)
        .map(letter => Number(letter.groupIndex))
        .filter(Number.isFinite)
    )];
    const componentIndices = [...new Set(
      groupIndices.flatMap(groupIndex => groupComponents[groupIndex] || [])
    )];
    const text = unitIndex === 0
      ? titleCaseAudioProperNameText(span.text)
      : span.text;
    const letterSound = span.bank === 'letter_sounds';

    return {
      text,
      timingText: span.text,
      timingSyllables: [span.text],
      kind: letterSound ? 'cartouche-letter-sound' : 'cartouche-syllable',
      word,
      wordIndex: 0,
      unitIndex,
      unitIndexInWord: unitIndex,
      wholeNumericPunctuationWord: false,
      suppressActiveHighlight: false,
      numericCartouche: false,
      recognizedNumericCartouche: false,
      cartoucheAudioGroupId: options?.cartoucheAudioGroupId || null,
      cartoucheAudioMode: 'ordinary',
      forceOrdinarySyllableAudio: !letterSound,
      audioBank: letterSound ? 'letter_sounds' : null,
      audioUnitKey: letterSound ? span.text : '',
      numericCartoucheRunId: null,
      numericCartouchePhrase: '',
      numericAudioUnitKey: '',
      visualTargets: [
        visualTargetForComponentIndices(run, componentIndices, fallbackRunIndex, lineIndex)
      ]
    };
  });
}

function runAudioSourceCodepoints(run) {
  const direct = Array.isArray(run?.audioSourceCps)
    ? run.audioSourceCps
    : run?._element?.audioSourceCps;
  if (Array.isArray(direct) && direct.length) return direct.map(Number).filter(Number.isFinite);
  return runCodepointsForAudio(run);
}

function runAudioSourceIndices(run, componentCount) {
  const direct = Array.isArray(run?.audioSourceIndices)
    ? run.audioSourceIndices
    : run?._element?.audioSourceIndices;
  if (Array.isArray(direct) && direct.length === componentCount) {
    return direct.map((value, index) => Number.isFinite(Number(value)) ? Number(value) : index);
  }
  return Array.from({ length: componentCount }, (_unused, index) => index);
}

function alignDisplayedCodepointsToExpandedSource(displayedCps, expandedSourceCps) {
  const displayed = Array.from(displayedCps || []).map(Number).filter(Number.isFinite);
  const source = Array.from(expandedSourceCps || []).map(Number).filter(Number.isFinite);
  if (!displayed.length || source.length < displayed.length) return null;

  const memo = new Map();
  const solve = (displayIndex, sourceStart) => {
    if (displayIndex >= displayed.length) return [];
    const key = `${displayIndex}:${sourceStart}`;
    if (memo.has(key)) return memo.get(key);

    const remainingDisplayed = displayed.length - displayIndex;
    const lastPossibleSourceIndex = source.length - remainingDisplayed;
    for (let sourceIndex = sourceStart; sourceIndex <= lastPossibleSourceIndex; sourceIndex++) {
      if (source[sourceIndex] !== displayed[displayIndex]) continue;
      const tail = solve(displayIndex + 1, sourceIndex + 1);
      if (tail) {
        const result = [sourceIndex, ...tail];
        memo.set(key, result);
        return result;
      }
    }

    memo.set(key, null);
    return null;
  };

  return solve(0, 0);
}

function expandedAudioSourceForAbbreviatedNumericCartouche(run, options, displayedCps) {
  const sourceText = String(run?.sourceText ?? run?.encodedText ?? '').trim();
  const decoded = parseAbbreviatedNanpaLinjanCartoucheSource(sourceText, options);
  const expandedSourceCps = decoded?.parsed?.innerCodepoints || decoded?.parsed?.ucsurCodepoints;
  if (!Array.isArray(expandedSourceCps) || !expandedSourceCps.length) return null;

  const sourceIndices = alignDisplayedCodepointsToExpandedSource(displayedCps, expandedSourceCps);
  if (!sourceIndices || sourceIndices.length !== displayedCps.length) return null;

  return {
    sourceCps: Array.from(expandedSourceCps).map(Number).filter(Number.isFinite),
    sourceIndices
  };
}

function visualTargetForComponentIndices(run, componentIndices, fallbackRunIndex, lineIndex) {
  const unique = [...new Set(Array.from(componentIndices || []).map(Number).filter(Number.isFinite))];
  return {
    runId: runIdForAudio(run, fallbackRunIndex, lineIndex),
    lineIndex,
    runIndex: Number.isFinite(Number(run?.runIndex)) ? Number(run.runIndex) : fallbackRunIndex,
    componentIndices: unique
  };
}

function normalizedSpeechLetters(text) {
  return String(text ?? '').replace(/[^A-Za-z]/g, '').toLowerCase();
}

function nearestDisplayedComponentsForSourceRange(sourceIndices, rangeStart, rangeEnd, fallbackRange = null) {
  const direct = [];
  for (let index = 0; index < sourceIndices.length; index++) {
    const sourceIndex = Number(sourceIndices[index]);
    if (Number.isFinite(sourceIndex) && sourceIndex >= rangeStart && sourceIndex < rangeEnd) direct.push(index);
  }
  if (direct.length) return direct;

  const candidates = [];
  for (let index = 0; index < sourceIndices.length; index++) {
    const sourceIndex = Number(sourceIndices[index]);
    if (!Number.isFinite(sourceIndex)) continue;
    if (
      fallbackRange &&
      (sourceIndex < fallbackRange.start || sourceIndex >= fallbackRange.end)
    ) continue;
    candidates.push({ index, sourceIndex });
  }
  const usable = candidates.length
    ? candidates
    : sourceIndices.map((sourceIndex, index) => ({ index, sourceIndex: Number(sourceIndex) }))
        .filter(item => Number.isFinite(item.sourceIndex));
  if (!usable.length) return [];

  const midpoint = (rangeStart + rangeEnd - 1) / 2;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const item of usable) bestDistance = Math.min(bestDistance, Math.abs(item.sourceIndex - midpoint));
  return usable
    .filter(item => Math.abs(item.sourceIndex - midpoint) === bestDistance)
    .map(item => item.index);
}

function abbreviatedNumericSpacerComponentIndices(run) {
  const displayedCps = runCodepointsForAudio(run);
  const sourceCps = runAudioSourceCodepoints(run);
  const sourceIndices = runAudioSourceIndices(run, displayedCps.length);
  const out = [];

  for (let componentIndex = 0; componentIndex < displayedCps.length; componentIndex++) {
    if (Number(displayedCps[componentIndex]) !== AUDIO_CP_EN) continue;

    const mappedSourceIndex = Number(sourceIndices[componentIndex]);
    if (!Number.isFinite(mappedSourceIndex)) continue;

    // Accept the mapped source index anywhere inside the four-glyph break.
    // The current renderer maps it to the first en, but this keeps the audio
    // code robust if that internal mapping is adjusted later.
    let representsBreak = false;
    for (let start = Math.max(0, mappedSourceIndex - 3); start <= mappedSourceIndex; start++) {
      if (
        sourceCps[start] === AUDIO_CP_NENA &&
        sourceCps[start + 1] === AUDIO_CP_EN &&
        sourceCps[start + 2] === AUDIO_CP_NENA &&
        sourceCps[start + 3] === AUDIO_CP_EN &&
        mappedSourceIndex >= start &&
        mappedSourceIndex < start + 4
      ) {
        representsBreak = true;
        break;
      }
    }

    if (representsBreak) out.push(componentIndex);
  }

  return out;
}

function isCartoucheRenderRunForAudio(run) {
  const kind = String(run?.kind ?? run?.type ?? run?._element?.type ?? '').toLowerCase();
  return kind === 'cartouche' || kind === 'cartoucheimg';
}

function isCartoucheAdjacencyGapRun(run) {
  const kind = String(run?.kind ?? run?.type ?? run?._element?.type ?? '').toLowerCase();
  return kind === 'gap';
}

function isConfirmedNumericCartoucheRun(run, options = {}) {
  if (
    run?.isNumericCartouche === true ||
    run?._element?.isNumericCartouche === true ||
    run?.element?.isNumericCartouche === true
  ) return true;

  const sourceText = String(run?.sourceText ?? run?.encodedText ?? run?._element?.sourceText ?? '').trim();
  if (!sourceText) return false;
  return !!trySourceTextToNanpaProperName(sourceText, options);
}

/**
 * Classify uninterrupted cartouche sequences on one rendered line.
 * Renderer gap runs are layout only and do not break adjacency. Any other run
 * ends the sequence. Numeric reference audio is permitted only when every
 * cartouche in the sequence is numeric; one ordinary cartouche forces the
 * complete adjacent sequence to the ordinary syllable voice.
 */
function classifyAdjacentCartoucheAudioGroups(runs, options = {}) {
  const classifications = new Map();
  const input = Array.isArray(runs) ? runs : [];
  let cursor = 0;
  let groupOrdinal = 0;

  while (cursor < input.length) {
    if (!isCartoucheRenderRunForAudio(input[cursor])) {
      cursor += 1;
      continue;
    }

    const cartoucheRunIndices = [];
    let scan = cursor;
    while (scan < input.length) {
      const candidate = input[scan];
      if (isCartoucheRenderRunForAudio(candidate)) {
        cartoucheRunIndices.push(scan);
        scan += 1;
        continue;
      }
      if (isCartoucheAdjacencyGapRun(candidate)) {
        scan += 1;
        continue;
      }
      break;
    }

    const allNumeric = cartoucheRunIndices.length > 0 && cartoucheRunIndices.every(index =>
      isConfirmedNumericCartoucheRun(input[index], options)
    );
    const groupId = `L${Number(options?.lineIndex) || 0}C${groupOrdinal}`;

    for (const runIndex of cartoucheRunIndices) {
      classifications.set(runIndex, {
        groupId,
        allNumeric,
        audioMode: allNumeric ? 'numeric' : 'ordinary',
        cartoucheRunIndices: cartoucheRunIndices.slice()
      });
    }

    groupOrdinal += 1;
    cursor = Math.max(scan, cursor + 1);
  }

  return classifications;
}

function buildCartoucheSpeechUnits(run, speech, fallbackRunIndex, lineIndex, options = {}) {
  const words = spokenWordTokens(speech);
  if (!words.length) return [];

  const sourceText = String(run?.sourceText ?? run?.encodedText ?? '').trim();
  const numericProperName = trySourceTextToNanpaProperName(sourceText, options);
  const recognizedNumericCartouche = !!numericProperName || isConfirmedNumericCartoucheRun(run, options);
  const forceOrdinaryCartoucheAudio = options?.cartoucheAudioMode === 'ordinary';
  const numericCartouche = recognizedNumericCartouche && !forceOrdinaryCartoucheAudio;
  const forceOrdinarySyllableAudio = !numericCartouche;
  const numericCartoucheRunId = numericCartouche
    ? runIdForAudio(run, fallbackRunIndex, lineIndex)
    : null;
  const numericCartouchePhrase = numericCartouche
    ? compactSpeechWhitespace(numericProperName || speech)
    : '';

  if (!recognizedNumericCartouche) {
    const ordinaryPhonetic = analyzeOrdinaryPhoneticCartoucheSource(sourceText);
    if (ordinaryPhonetic) {
      return buildOrdinaryPhoneticCartoucheSpeechUnits(
        run,
        ordinaryPhonetic,
        fallbackRunIndex,
        lineIndex,
        options
      );
    }
  }

  const displayedCps = runCodepointsForAudio(run);
  const componentCount = Math.max(1, displayedCps.length);
  let sourceCps = runAudioSourceCodepoints(run);
  let sourceIndices = runAudioSourceIndices(run, componentCount);

  // A direct bracketed abbreviated cartouche is rendered from only its visible
  // glyphs, so its renderer metadata has an identity source map. Reconstruct
  // the same expanded numeric source used by an equivalent decimal/#~ input;
  // this makes syllable-to-glyph highlighting identical for both spellings.
  const expandedAbbreviatedSource = expandedAudioSourceForAbbreviatedNumericCartouche(
    run,
    options,
    displayedCps
  );
  if (expandedAbbreviatedSource) {
    sourceCps = expandedAbbreviatedSource.sourceCps;
    sourceIndices = expandedAbbreviatedSource.sourceIndices;
  }

  const sourceCount = Math.max(1, sourceCps.length);
  const totalSpeechLetters = Math.max(1, normalizedSpeechLetters(speech).length);
  const sourceScale = sourceCount / totalSpeechLetters;

  const wordRecords = [];
  let speechLetterCursor = 0;
  let unitIndex = 0;

  for (let wordIndex = 0; wordIndex < words.length; wordIndex++) {
    const word = words[wordIndex];
    const wordLetters = Math.max(1, normalizedSpeechLetters(word).length);
    const wordSpeechStart = speechLetterCursor;
    const wordSpeechEnd = speechLetterCursor + wordLetters;
    const wordSourceRange = {
      start: Math.max(0, Math.floor(wordSpeechStart * sourceScale)),
      end: Math.min(sourceCount, Math.max(1, Math.ceil(wordSpeechEnd * sourceScale)))
    };
    speechLetterCursor = wordSpeechEnd;

    const wholeNumeric = WHOLE_NUMERIC_AUDIO_WORDS.has(word.toLowerCase());
    const pieces = wholeNumeric ? [word] : (splitAudioTpWordIntoSyllables(word).length ? splitAudioTpWordIntoSyllables(word) : [word]);
    let pieceLetterCursor = wordSpeechStart;

    for (let unitIndexInWord = 0; unitIndexInWord < pieces.length; unitIndexInWord++) {
      const piece = pieces[unitIndexInWord];
      const pieceLetters = Math.max(1, normalizedSpeechLetters(piece).length);
      const pieceSpeechStart = pieceLetterCursor;
      const pieceSpeechEnd = Math.min(wordSpeechEnd, pieceLetterCursor + pieceLetters);
      pieceLetterCursor += pieceLetters;

      const rangeStart = Math.max(0, Math.floor(pieceSpeechStart * sourceScale));
      const rangeEnd = Math.min(sourceCount, Math.max(rangeStart + 1, Math.ceil(pieceSpeechEnd * sourceScale)));
      let componentIndices = nearestDisplayedComponentsForSourceRange(
        sourceIndices,
        rangeStart,
        rangeEnd,
        wordSourceRange
      );

      // Do not rely on proportional source-range matching for an abbreviated
      // break. The nth spoken Ene unit targets the nth visible en spacer that
      // explicitly represents nena en nena en in renderer metadata.
      let suppressActiveHighlight = false;
      if (numericCartouche && wholeNumeric && normalizeAudioWord(word) === 'ene') {
        const spacerComponents = abbreviatedNumericSpacerComponentIndices(run);
        const eneOrdinal = words
          .slice(0, wordIndex + 1)
          .filter(candidate => normalizeAudioWord(candidate) === 'ene')
          .length - 1;

        // Ene represents the optional abbreviated-cartouche spacer. If the
        // spacer is hidden, there is no honest visual target: do not fall back
        // to the nearest visible glyph.
        componentIndices = [];
        suppressActiveHighlight = true;
        if (eneOrdinal >= 0 && eneOrdinal < spacerComponents.length) {
          componentIndices = [spacerComponents[eneOrdinal]];
          suppressActiveHighlight = false;
        }
      }

      wordRecords.push({
        text: piece,
        timingText: piece,
        timingSyllables: wholeNumeric ? [word] : [piece],
        kind: wholeNumeric ? 'numeric-punctuation-word' : 'cartouche-syllable',
        word,
        wordIndex,
        unitIndex,
        unitIndexInWord,
        wholeNumericPunctuationWord: wholeNumeric,
        suppressActiveHighlight,
        numericCartouche,
        recognizedNumericCartouche,
        cartoucheAudioGroupId: options?.cartoucheAudioGroupId || null,
        cartoucheAudioMode: numericCartouche ? 'numeric' : 'ordinary',
        forceOrdinarySyllableAudio,
        numericCartoucheRunId,
        numericCartouchePhrase,
        numericAudioUnitKey: numericCartouche ? normalizeAudioWord(piece) : '',
        visualTargets: [
          visualTargetForComponentIndices(run, componentIndices, fallbackRunIndex, lineIndex)
        ]
      });
      unitIndex += 1;
    }
  }

  return wordRecords;
}


function offsetRawVisualTargets(units, offset) {
  return Array.from(units || []).map(unit => ({
    ...unit,
    visualTargets: Array.from(unit?.visualTargets || []).map(target => ({
      ...target,
      componentIndices: Array.from(target?.componentIndices || []).map(index => Number(index) + offset)
    }))
  }));
}

function rawCompoundComponentIndices(cps, componentIndex) {
  const input = Array.from(cps || []).map(Number);
  let start = componentIndex;
  let end = componentIndex;

  while (start >= 2 && AUDIO_COMPOUND_JOINER_CPS.has(input[start - 1])) start -= 2;
  while (end + 2 < input.length && AUDIO_COMPOUND_JOINER_CPS.has(input[end + 1])) end += 2;

  if (start === end) return [componentIndex];
  return Array.from({ length: end - start + 1 }, (_unused, offset) => start + offset);
}

function buildRawCodepointSpeechUnits(run, fallbackRunIndex, lineIndex, options = {}) {
  const analyzed = analyzeExplicitRawCodepointRun(run, options);
  if (!analyzed?.speech) return [];

  const out = [];
  for (const segment of analyzed.segments) {
    if (segment.kind === 'punctuation') continue;

    if (segment.kind === 'word') {
      const word = String(segment.speech || '');
      if (!word) continue;
      out.push({
        text: word,
        timingText: word,
        timingSyllables: splitAudioTpWordIntoSyllables(word),
        kind: 'raw-codepoint-word',
        word,
        wordIndex: out.length,
        wholeNumericPunctuationWord: false,
        visualTargets: [
          visualTargetForComponentIndices(
            run,
            rawCompoundComponentIndices(runCodepointsForAudio(run), segment.startIndex),
            fallbackRunIndex,
            lineIndex
          )
        ]
      });
      continue;
    }

    if (segment.kind === 'cartouche') {
      const spanCps = runCodepointsForAudio(run).slice(segment.startIndex, segment.endIndex + 1);
      const innerCps = spanCps.slice(1, -1);
      let audioSourceCps = Array.isArray(segment.semanticInnerCps)
        ? segment.semanticInnerCps
        : innerCps;
      let innerSourceIndices = Array.isArray(segment.ordinaryInnerSourceIndices)
        ? segment.ordinaryInnerSourceIndices
        : Array.from({ length: innerCps.length }, (_unused, index) => index);

      if (segment.numericSource) {
        audioSourceCps = segment.numericSource.sourceCps;
        innerSourceIndices = segment.numericSource.innerSourceIndices;
      }

      const lastSourceIndex = Math.max(0, audioSourceCps.length - 1);
      const audioSourceIndices = [
        innerSourceIndices[0] ?? 0,
        ...innerSourceIndices,
        innerSourceIndices[innerSourceIndices.length - 1] ?? lastSourceIndex
      ];

      const proxyRun = {
        ...run,
        cps: spanCps,
        sourceText: segment.sourceText,
        audioSourceCps,
        audioSourceIndices,
        _element: {
          ...(run?._element || {}),
          cps: spanCps,
          sourceText: segment.sourceText,
          audioSourceCps,
          audioSourceIndices
        }
      };

      const units = buildCartoucheSpeechUnits(
        proxyRun,
        segment.speech,
        fallbackRunIndex,
        lineIndex,
        options
      );
      out.push(...offsetRawVisualTargets(units, segment.startIndex));
    }
  }

  return out;
}

function currentExtendedGlyphAudioStructure(cps) {
  const source = Array.from(cps || []).map(Number);
  const reverseStartIndex = source.indexOf(0xF199A);
  const reverseEndIndex = reverseStartIndex >= 0
    ? source.indexOf(0xF199B, reverseStartIndex + 1)
    : -1;
  const forwardStartIndex = source.indexOf(0xF1997);
  const forwardEndIndex = forwardStartIndex >= 0
    ? source.indexOf(0xF1998, forwardStartIndex + 1)
    : -1;

  const hasReverse = reverseStartIndex >= 0 && reverseEndIndex > reverseStartIndex;
  const hasForward = forwardStartIndex > 0 && forwardEndIndex > forwardStartIndex;
  if (!hasReverse && !hasForward) return null;

  const reverseHeadIndex = hasReverse ? reverseEndIndex + 1 : -1;
  const forwardHeadIndex = hasForward ? forwardStartIndex - 1 : -1;
  if (hasReverse && (reverseHeadIndex < 0 || reverseHeadIndex >= source.length)) return null;
  if (hasForward && (forwardHeadIndex < 0 || forwardHeadIndex >= source.length)) return null;
  if (hasReverse && hasForward && reverseHeadIndex !== forwardHeadIndex) return null;

  const headIndex = hasForward ? forwardHeadIndex : reverseHeadIndex;
  return {
    hasReverse,
    hasForward,
    headIndex,
    headCp: source[headIndex]
  };
}

function longGlyphPresentationForAudioRun(run) {
  const value = String(
    run?.longGlyphPresentation ??
    run?._element?.longGlyphPresentation ??
    ''
  ).trim().toLowerCase();
  return value === 'decomposed' ? 'decomposed' : 'connected';
}

function buildLongPiSpeechUnits(run, speech, fallbackRunIndex, lineIndex) {
  const words = spokenWordTokens(speech);
  if (!words.length) return [];

  const cps = runCodepointsForAudio(run);
  const out = [];
  const currentStructure = currentExtendedGlyphAudioStructure(cps);
  const currentGroups = currentStructure ? visibleComponentGroups(cps) : null;
  const headGroupIndex = currentGroups?.findIndex(group => group.includes(currentStructure.headIndex)) ?? -1;
  const currentPiHead = headGroupIndex >= 0 && Number(currentStructure?.headCp) === 0xF194D;
  const longGlyphPresentation = longGlyphPresentationForAudioRun(run);

  for (let wordIndex = 0; wordIndex < words.length; wordIndex++) {
    let componentIndices = [];
    let semanticRole = 'long-pi-member';

    if (currentGroups?.length) {
      // Source speech follows the visual order: reverse members, long head,
      // then forward members. Map each word to that semantic group rather than
      // assuming the first word is always pi. This restores the reverse side of
      // forms such as {pona}ala(pona).
      const groupIndex = words.length === currentGroups.length
        ? wordIndex
        : Math.min(
            currentGroups.length - 1,
            Math.floor(currentGroups.length * wordIndex / Math.max(1, words.length))
          );

      if (currentPiHead && groupIndex === headGroupIndex) {
        // A connected long pi has a thin shaped head, so speaking pi identifies
        // the complete construction. A decomposed font fallback renders pi as
        // an ordinary full-width glyph and must highlight only that head cell.
        componentIndices = longGlyphPresentation === 'decomposed'
          ? Array.from(currentGroups[headGroupIndex] || [])
          : Array.from({ length: cps.length }, (_unused, index) => index);
        semanticRole = 'long-pi-head';
      } else {
        componentIndices = Array.from(currentGroups[groupIndex] || []);
        if (groupIndex < headGroupIndex) semanticRole = 'reverse-long-member';
        else if (groupIndex === headGroupIndex) semanticRole = 'long-glyph-head';
        else semanticRole = 'forward-long-member';
      }
    } else if (wordIndex === 0) {
      // Deprecated START OF LONG PI encoding renders the opening control as pi.
      // Preserve the established behavior: pi identifies the complete legacy
      // long-pi construction.
      componentIndices = Array.from({ length: cps.length }, (_unused, index) => index);
      semanticRole = 'long-pi-head';
    } else {
      // Deprecated START OF LONG PI encoding: member glyphs follow the opening
      // control with an extension control between later members.
      const memberIndex = wordIndex - 1;
      const glyphCpIndex = 1 + memberIndex * 2;
      componentIndices = memberIndex === 0
        ? [glyphCpIndex]
        : [glyphCpIndex - 1, glyphCpIndex];
      componentIndices = componentIndices.filter(index => index >= 0 && index < cps.length);
    }

    const word = words[wordIndex];
    out.push({
      text: word,
      timingText: word,
      timingSyllables: splitAudioTpWordIntoSyllables(word),
      kind: semanticRole,
      word,
      wordIndex,
      wholeNumericPunctuationWord: false,
      visualTargets: [
        visualTargetForComponentIndices(run, componentIndices, fallbackRunIndex, lineIndex)
      ]
    });
  }

  return out;
}

function visibleComponentGroups(cps) {
  if (!cps.length) return [];
  const visibleIndices = [];
  for (let i = 0; i < cps.length; i++) {
    if (!AUDIO_VISUAL_CONTROL_CPS.has(Number(cps[i]))) visibleIndices.push(i);
  }
  if (!visibleIndices.length) return [];

  const groups = [];
  let previousVisible = -1;
  for (const visibleIndex of visibleIndices) {
    const start = previousVisible + 1;
    groups.push(Array.from({ length: visibleIndex - start + 1 }, (_unused, offset) => start + offset));
    previousVisible = visibleIndex;
  }
  if (previousVisible < cps.length - 1) {
    groups[groups.length - 1].push(...Array.from(
      { length: cps.length - previousVisible - 1 },
      (_unused, offset) => previousVisible + 1 + offset
    ));
  }
  return groups;
}

function buildGenericRunSpeechUnits(run, speech, fallbackRunIndex, lineIndex) {
  const words = spokenWordTokens(speech);
  if (!words.length) return [];

  const cps = runCodepointsForAudio(run);
  const groups = visibleComponentGroups(cps);
  const isCompoundRun = cps.some(cp => AUDIO_COMPOUND_JOINER_CPS.has(Number(cp)));
  const isPhonotacticUnknownRun = run?.isUnrecognized === true;
  const completeRunComponentIndices = (isCompoundRun || isPhonotacticUnknownRun)
    ? Array.from({ length: cps.length }, (_unused, index) => index)
    : [];

  return words.map((word, wordIndex) => {
    let componentIndices = completeRunComponentIndices.slice();
    if (!isCompoundRun && !isPhonotacticUnknownRun && groups.length) {
      const start = Math.floor(groups.length * wordIndex / words.length);
      const end = Math.max(start + 1, Math.ceil(groups.length * (wordIndex + 1) / words.length));
      componentIndices = groups.slice(start, end).flat();
    }

    return {
      text: word,
      timingText: word,
      timingSyllables: splitAudioTpWordIntoSyllables(word),
      kind: isPhonotacticUnknownRun ? 'phonotactic-unknown-word' : 'word',
      word,
      wordIndex,
      wholeNumericPunctuationWord: false,
      visualTargets: [
        visualTargetForComponentIndices(run, componentIndices, fallbackRunIndex, lineIndex)
      ]
    };
  });
}

export function speechUnitsForRenderRun(run, speech, {
  fallbackRunIndex = 0,
  lineIndex = 0,
  ...audioOptions
} = {}) {
  const text = compactSpeechWhitespace(speech);
  if (!text) return [];

  const kind = String(run?.kind ?? '').toLowerCase();
  const sourceKind = String(run?.sourceKind ?? '').toLowerCase();
  if (run?.isQuoted || sourceKind === 'quote') return [];

  if (isExplicitRawCodepointAudioRun(run)) {
    return buildRawCodepointSpeechUnits(run, fallbackRunIndex, lineIndex, audioOptions);
  }

  if (kind === 'cartouche') {
    return buildCartoucheSpeechUnits(run, text, fallbackRunIndex, lineIndex, audioOptions);
  }

  const cps = runCodepointsForAudio(run);
  if (cps.includes(0xF1993) || cps.includes(0xF1997) || cps.includes(0xF199A)) {
    return buildLongPiSpeechUnits(run, text, fallbackRunIndex, lineIndex);
  }

  return buildGenericRunSpeechUnits(run, text, fallbackRunIndex, lineIndex);
}

/**
 * Extract sentence-sized speech segments while preserving the physical render
 * line and sentence ordinal needed by an opt-in visual playback UI.
 *
 * Newlines are hard boundaries. Within one line, '.', '!' and '?' terminate a
 * sentence. The final spoken segment on every physical line is marked as a
 * line boundary so callers can use line spacing instead of adding both a
 * punctuation pause and a line pause.
 */
export function extractSpeechSegmentsFromRenderPlan(plan, options = {}) {
  const skipped = [];
  const segments = [];
  const rawInput = options.rawInput ?? options.sourceInput ?? '';
  const rawProperNameQueues = extractRawCapitalizedProperNameQueuesByLine(rawInput);
  const renderLines = Array.isArray(plan?.lines) ? plan.lines : [];

  for (let lineIndex = 0; lineIndex < renderLines.length; lineIndex++) {
    const line = renderLines[lineIndex];
    const sourceLineIndex = Number.isFinite(Number(line?.sourceLineIndex))
      ? Number(line.sourceLineIndex)
      : lineIndex;
    const rawProperNameQueue = rawProperNameQueues[sourceLineIndex] || [];
    const firstSegmentIndexForLine = segments.length;
    let sentenceIndexInLine = 0;
    let parts = [];
    let speechUnits = [];
    let visualRunRefs = [];
    let terminalPunctuation = '';

    const flush = (boundaryAfter) => {
      const text = compactSpeechWhitespace(parts.join(' '));
      if (text && containsSpokenWord(text)) {
        segments.push({
          text,
          speechText: text,
          lineIndex,
          sentenceIndexInLine,
          boundaryAfter,
          terminalPunctuation,
          visualRunRefs: visualRunRefs.slice(),
          speechUnits: speechUnits.map(unit => ({
            ...unit,
            timingSyllables: Array.isArray(unit.timingSyllables) ? unit.timingSyllables.slice() : [],
            visualTargets: Array.isArray(unit.visualTargets)
              ? unit.visualTargets.map(target => ({
                  ...target,
                  componentIndices: Array.isArray(target.componentIndices)
                    ? target.componentIndices.slice()
                    : []
                }))
              : []
          }))
        });
      }
      parts = [];
      speechUnits = [];
      visualRunRefs = [];
      terminalPunctuation = '';
    };

    const runs = Array.isArray(line?.runs) ? line.runs : [];
    const cartoucheAudioGroups = classifyAdjacentCartoucheAudioGroups(runs, {
      ...options,
      lineIndex
    });
    for (let fallbackRunIndex = 0; fallbackRunIndex < runs.length; fallbackRunIndex++) {
      const run = runs[fallbackRunIndex];
      const speech = speechTextForRenderRun(run, skipped, {
        ...options,
        rawProperNameQueue,
        lineIndex
      });

      const cartoucheAudioGroup = cartoucheAudioGroups.get(fallbackRunIndex) || null;
      const runUnits = speechUnitsForRenderRun(run, speech, {
        ...options,
        fallbackRunIndex,
        lineIndex,
        cartoucheAudioGroupId: cartoucheAudioGroup?.groupId || null,
        cartoucheAudioMode: cartoucheAudioGroup?.audioMode || null
      });
      const groupsByWord = [];
      for (const unit of runUnits) {
        const wordIndex = Number.isFinite(Number(unit?.wordIndex)) ? Number(unit.wordIndex) : groupsByWord.length;
        let group = groupsByWord.find(item => item.wordIndex === wordIndex);
        if (!group) {
          group = { wordIndex, units: [] };
          groupsByWord.push(group);
        }
        group.units.push(unit);
      }
      groupsByWord.sort((a, b) => a.wordIndex - b.wordIndex);
      let groupCursor = 0;

      const fragments = splitSpeechTextIntoSentenceFragments(speech);
      if (!fragments.length && containsSpokenWord(speech)) {
        const core = compactSpeechWhitespace(speech);
        if (core) parts.push(core);
        speechUnits.push(...runUnits);
        appendUniqueRunRef(visualRunRefs, run, fallbackRunIndex, lineIndex);
      }

      let speechBoundaryCount = 0;
      for (const fragment of fragments) {
        const core = stripTerminalSentencePunctuation(fragment.text);
        const fragmentWordCount = spokenWordTokens(core).length;
        if (core && fragmentWordCount > 0) {
          parts.push(core);
          const selectedGroups = groupsByWord.slice(groupCursor, groupCursor + fragmentWordCount);
          groupCursor += selectedGroups.length;
          speechUnits.push(...selectedGroups.flatMap(group => group.units));
          appendUniqueRunRef(visualRunRefs, run, fallbackRunIndex, lineIndex);
        }

        if (fragment.endsSentence) {
          speechBoundaryCount += 1;
          terminalPunctuation = String(fragment.text || '').match(/[.!?]+\s*$/u)?.[0]?.trim() || '.';
          flush('punctuation');
          sentenceIndexInLine += 1;
        }
      }

      if (speechBoundaryCount === 0) {
        const sourceText = String(run?.sourceText ?? run?.encodedText ?? '');
        const sourceBoundaryCount = countSentenceBoundariesInSourceText(sourceText, run);
        for (let i = 0; i < sourceBoundaryCount; i++) {
          flush('punctuation');
          sentenceIndexInLine += 1;
        }
      }
    }

    if (parts.length) flush('line');

    // The explicit line pause replaces terminal punctuation immediately before
    // a newline, matching the pre-existing playback behaviour.
    if (segments.length > firstSegmentIndexForLine) {
      segments[segments.length - 1].boundaryAfter = 'line';
    }
  }

  return { segments, skipped, warnings: [] };
}

export async function buildSitelenSentenceAudioPlan(options = {}) {
  const base = await buildSitelenAudioPlan(options);
  const extracted = extractSpeechSegmentsFromRenderPlan(base.audioPlan, {
    sourceInput: base.audioInput,
    rawInput: base.rawText,
    NanpaParser: options.NanpaParser || options.nanpaParser,
    nanpaParser: options.nanpaParser || options.NanpaParser,
    nanpaLinjanMode: options.nanpaLinjanMode,
    mixedStyle: options.mixedStyle,
    relaxedNanpaLinjanParsing: !!options.relaxedNanpaLinjanParsing,
    relaxedNanpaLinjanRendering: !!options.relaxedNanpaLinjanRendering,
    silenceTeToAudio: options.silenceTeToAudio === true,
    soundOutPhonotacticUnknownWords: options.soundOutPhonotacticUnknownWords === true,
    interpretDoubleQuotesAsTeTo: !!options.interpretDoubleQuotesAsTeTo
  });

  return {
    ...base,
    speechSegments: extracted.segments,
    sentenceSegments: extracted.segments,
    sentenceSkipped: extracted.skipped,
    skipped: extracted.skipped,
    warnings: [...(base.warnings || []), ...(extracted.warnings || [])]
  };
}

function stripTerminalSentencePunctuation(text) {
  return compactSpeechWhitespace(String(text ?? '').replace(/[.!?]+\s*$/u, ''));
}

/**
 * Render pre-extracted sentence segments as separate sample buffers.
 * This is additive and does not change the existing line-concatenation API.
 */
function cloneAudioVisualTargets(targets) {
  return Array.isArray(targets)
    ? targets.map(target => ({
        ...target,
        componentIndices: Array.isArray(target?.componentIndices)
          ? target.componentIndices.slice()
          : []
      }))
    : [];
}

const VOICE_FINAL_WORD_PAUSE_SECONDS = 0.055;
const VOICE_CROSSFADE_SECONDS = 0.006;
const VOICE_NANPA_BOUNDARY_WORDS = new Set([
  'one', 'ono', 'oko', 'eke', 'eko', 'ene', 'oken'
]);

function normalizedVoiceSpeed(renderOptions = {}) {
  return Math.max(0.3, Number(renderOptions?.speed) || 1);
}

function normalizedVoicePauseScale(renderOptions = {}) {
  const n = Number(renderOptions?.pauseScale);
  if (!Number.isFinite(n)) return 1;
  return Math.min(6, Math.max(0.5, n));
}

function voiceScaledPauseSeconds(seconds, renderOptions = {}) {
  return Math.max(0, Number(seconds) || 0) *
    normalizedVoicePauseScale(renderOptions) /
    normalizedVoiceSpeed(renderOptions);
}

function voiceSpeedScaledSeconds(seconds, renderOptions = {}) {
  return Math.max(0, Number(seconds) || 0) / normalizedVoiceSpeed(renderOptions);
}

function voicePunctuationPauseSeconds(punctuation) {
  const p = String(punctuation || '').trim()[0] || '';
  if (p === '?') return 0.30;
  if (p === '.' || p === '!') return 0.32;
  if (p === ',' || p === ';' || p === ':') return 0.18;
  return 0.12;
}

function isCartoucheAudioUnit(unit) {
  const kind = String(unit?.kind || '').toLowerCase();
  return kind === 'cartouche-syllable' ||
    kind === 'cartouche-word' ||
    kind === 'cartouche-letter-sound' ||
    kind === 'numeric-punctuation-word';
}

function sameCartoucheWord(currentUnit, nextUnit) {
  if (!isCartoucheAudioUnit(currentUnit) || !isCartoucheAudioUnit(nextUnit)) return false;
  return Number.isFinite(Number(currentUnit?.wordIndex)) &&
    Number(currentUnit.wordIndex) === Number(nextUnit?.wordIndex);
}

function cartoucheWordBoundaryPauseSeconds(currentUnit, nextUnit) {
  const currentWord = normalizeAudioWord(currentUnit?.word || currentUnit?.text);
  const nextWord = normalizeAudioWord(nextUnit?.word || nextUnit?.text);
  return VOICE_NANPA_BOUNDARY_WORDS.has(currentWord) || VOICE_NANPA_BOUNDARY_WORDS.has(nextWord)
    ? 0.14
    : 0.075;
}

function exactUnitPauseAfterSeconds({
  unit,
  nextUnit,
  segment,
  crossesLine,
  lineDistance,
  linePauseSeconds,
  renderOptions,
  hasFollowingSegment
}) {
  if (nextUnit) {
    if (sameCartoucheWord(unit, nextUnit)) {
      return voiceSpeedScaledSeconds(renderOptions?.syllableGapSeconds, renderOptions);
    }
    if (isCartoucheAudioUnit(unit) && isCartoucheAudioUnit(nextUnit)) {
      return voiceScaledPauseSeconds(
        cartoucheWordBoundaryPauseSeconds(unit, nextUnit),
        renderOptions
      );
    }
    return voiceScaledPauseSeconds(VOICE_FINAL_WORD_PAUSE_SECONDS, renderOptions);
  }

  if (crossesLine) {
    return voiceScaledPauseSeconds(VOICE_FINAL_WORD_PAUSE_SECONDS, renderOptions) +
      Math.max(0, Number(linePauseSeconds) || 0) * Math.min(2, Math.max(1, lineDistance));
  }

  if (segment?.boundaryAfter === 'punctuation' && hasFollowingSegment) {
    return voiceScaledPauseSeconds(VOICE_FINAL_WORD_PAUSE_SECONDS, renderOptions) +
      voiceScaledPauseSeconds(
        voicePunctuationPauseSeconds(segment?.terminalPunctuation),
        renderOptions
      );
  }

  return 0;
}

function trimVoiceGeneratedFinalWordPause(samples, sampleRate, renderOptions = {}) {
  const source = samples instanceof Float32Array ? samples : Float32Array.from(samples || []);
  if (!source.length || !sampleRate) return source;

  const generatedGapSamples = Math.max(0, Math.round(
    voiceScaledPauseSeconds(VOICE_FINAL_WORD_PAUSE_SECONDS, renderOptions) * sampleRate
  ));
  const crossfadeSamples = Math.max(0, Math.round(VOICE_CROSSFADE_SECONDS * sampleRate));
  const removableSamples = Math.max(0, generatedGapSamples - crossfadeSamples);
  if (!removableSamples || source.length <= removableSamples) return source;

  let trailingNearZero = 0;
  for (let index = source.length - 1; index >= 0 && trailingNearZero < removableSamples; index--) {
    if (Math.abs(Number(source[index]) || 0) > 1e-7) break;
    trailingNearZero += 1;
  }
  if (trailingNearZero < removableSamples) return source;
  return source.slice(0, source.length - removableSamples);
}

async function renderExactSpeechUnitEntry({
  unit,
  unitIndex,
  unitCount,
  nextUnit,
  segment,
  segmentIndex,
  voice,
  renderOptions,
  crossesLine,
  lineDistance,
  linePauseSeconds,
  expectedSampleRate,
  hasFollowingSegment
}) {
  const renderText = compactSpeechWhitespace(unit?.timingText ?? unit?.text ?? '');
  if (!renderText || !containsSpokenWord(renderText)) return null;

  const forceOrdinarySyllables = unit?.forceOrdinarySyllableAudio === true;
  const audioBank = String(unit?.audioBank || '').trim();
  const audioUnitKey = String(unit?.audioUnitKey || '').trim();
  const rendered = await voice.render(renderText, {
    ...(renderOptions || {}),
    alreadyPreprocessed: true,
    ...(forceOrdinarySyllables ? { forceOrdinarySyllables: true } : {}),
    ...(audioBank ? { audioBank, audioUnitKey } : {})
  });

  if (!rendered?.samples?.length || !rendered?.sampleRate) {
    throw new Error(`No audio samples were produced for speech unit \"${renderText}\".`);
  }
  if (expectedSampleRate != null && rendered.sampleRate !== expectedSampleRate) {
    throw new Error('Audio sample-rate changed between rendered speech units.');
  }

  const renderedSamples = rendered.samples instanceof Float32Array
    ? rendered.samples
    : Float32Array.from(rendered.samples || []);
  const samples = trimVoiceGeneratedFinalWordPause(
    renderedSamples,
    rendered.sampleRate,
    renderOptions
  );

  return {
    ...segment,
    text: unit?.text ?? renderText,
    speechUnitText: unit?.text ?? renderText,
    speechUnitKind: unit?.kind || 'word',
    speechUnitIndex: unitIndex,
    speechUnitCount: unitCount,
    wholeNumericPunctuationWord: !!unit?.wholeNumericPunctuationWord,
    suppressActiveHighlight: !!unit?.suppressActiveHighlight,
    cartoucheAudioMode: unit?.cartoucheAudioMode || null,
    forceOrdinarySyllableAudio: forceOrdinarySyllables,
    audioBank: audioBank || null,
    audioUnitKey: audioUnitKey || null,
    visualTargets: cloneAudioVisualTargets(unit?.visualTargets),
    sourceSegmentIndex: segmentIndex,
    renderText,
    renderedAsWholeSegment: false,
    renderedAsExactUnit: true,
    samples,
    sampleRate: rendered.sampleRate,
    durationSeconds: samples.length / rendered.sampleRate,
    pauseAfterSeconds: exactUnitPauseAfterSeconds({
      unit,
      nextUnit,
      segment,
      crossesLine,
      lineDistance,
      linePauseSeconds,
      renderOptions,
      hasFollowingSegment
    })
  };
}


function isNumericCartoucheAudioUnit(unit) {
  return !!unit?.numericCartouche && !!unit?.numericCartoucheRunId;
}

function sameNumericCartoucheAudioGroup(left, right) {
  return isNumericCartoucheAudioUnit(left) &&
    isNumericCartoucheAudioUnit(right) &&
    String(left.numericCartoucheRunId) === String(right.numericCartoucheRunId) &&
    String(left.numericCartouchePhrase || '') === String(right.numericCartouchePhrase || '');
}

function numericCartoucheBoundaryPauseSeconds({
  segment,
  crossesLine,
  lineDistance,
  linePauseSeconds,
  renderOptions,
  hasFollowingSegment,
  isLastUnitInSegment
}) {
  if (!isLastUnitInSegment) return 0;

  // The voice-rendered nanpa phrase already contains the same final 0.055 s
  // word gap used by Review and History. Only add the boundary beyond it.
  if (crossesLine) {
    return Math.max(0, Number(linePauseSeconds) || 0) *
      Math.min(2, Math.max(1, lineDistance));
  }

  if (segment?.boundaryAfter === 'punctuation' && hasFollowingSegment) {
    return voiceScaledPauseSeconds(
      voicePunctuationPauseSeconds(segment?.terminalPunctuation),
      renderOptions
    );
  }

  return 0;
}

function validateContiguousVoiceTimeline(timeline, sampleLength) {
  const records = Array.from(timeline || [])
    .map(record => ({
      ...record,
      startSample: Math.max(0, Math.round(Number(record?.startSample) || 0)),
      endSample: Math.max(0, Math.round(Number(record?.endSample) || 0))
    }))
    .filter(record => record.endSample > record.startSample);

  if (!records.length) throw new Error('The voice API did not return a usable nanpa-unit timeline.');
  if (records[0].startSample !== 0 || records[records.length - 1].endSample !== sampleLength) {
    throw new Error('The voice API nanpa-unit timeline does not cover the complete rendered waveform.');
  }
  for (let index = 1; index < records.length; index++) {
    if (records[index - 1].endSample !== records[index].startSample) {
      throw new Error('The voice API nanpa-unit timeline is not contiguous.');
    }
  }
  return records;
}

async function renderExactNumericCartoucheEntries({
  units,
  segment,
  segmentIndex,
  voice,
  renderOptions,
  crossesLine,
  lineDistance,
  linePauseSeconds,
  expectedSampleRate,
  hasFollowingSegment,
  isLastUnitInSegment
}) {
  const groupUnits = Array.from(units || []);
  if (!groupUnits.length) return [];

  const phrase = compactSpeechWhitespace(groupUnits[0]?.numericCartouchePhrase || '');
  if (!phrase) throw new Error('Numeric cartouche audio is missing its nanpa-linja-n proper-name phrase.');

  const rendered = await voice.render(phrase, {
    ...(renderOptions || {}),
    synthesis_mode: 'reference_audio',
    alreadyPreprocessed: true
  });

  if (!rendered?.samples?.length || !rendered?.sampleRate) {
    throw new Error(`No nanpa reference-audio samples were produced for numeric cartouche "${phrase}".`);
  }
  if (expectedSampleRate != null && rendered.sampleRate !== expectedSampleRate) {
    throw new Error('Audio sample-rate changed while rendering a numeric cartouche.');
  }

  const renderedSamples = rendered.samples instanceof Float32Array
    ? rendered.samples
    : Float32Array.from(rendered.samples || []);
  const timeline = validateContiguousVoiceTimeline(rendered.timeline, renderedSamples.length);
  const speechRecords = timeline.filter(record => record.kind === 'speech' && record.nanpaUnit);

  if (speechRecords.length !== groupUnits.length) {
    throw new Error(
      `Nanpa reference-audio timeline mismatch for "${phrase}": ` +
      `${speechRecords.length} nanpa units for ${groupUnits.length} highlight units.`
    );
  }

  for (let index = 0; index < groupUnits.length; index++) {
    const expected = normalizeAudioWord(groupUnits[index]?.numericAudioUnitKey || groupUnits[index]?.text);
    const actual = normalizeAudioWord(speechRecords[index]?.audioUnitKey);
    if (!expected || expected !== actual) {
      throw new Error(
        `Nanpa reference-audio unit mismatch for "${phrase}" at unit ${index + 1}: ` +
        `expected "${expected}", received "${actual || 'none'}".`
      );
    }
  }

  const entries = [];
  let speechCursor = 0;
  for (const record of timeline) {
    const samples = renderedSamples.slice(record.startSample, record.endSample);
    if (!samples.length) continue;

    if (record.kind === 'speech' && record.nanpaUnit) {
      const unit = groupUnits[speechCursor];
      entries.push({
        ...segment,
        text: unit?.text || record.audioUnitKey || '',
        speechUnitText: unit?.text || record.audioUnitKey || '',
        speechUnitKind: unit?.kind || 'cartouche-syllable',
        speechUnitIndex: speechCursor,
        speechUnitCount: groupUnits.length,
        wholeNumericPunctuationWord: !!unit?.wholeNumericPunctuationWord,
        suppressActiveHighlight: !!unit?.suppressActiveHighlight,
        numericCartouche: true,
        numericCartoucheRunId: unit?.numericCartoucheRunId || null,
        numericCartouchePhrase: phrase,
        nanpaAudioUnitKey: record.audioUnitKey || '',
        visualTargets: cloneAudioVisualTargets(unit?.visualTargets),
        sourceSegmentIndex: segmentIndex,
        renderText: phrase,
        renderedAsWholeSegment: false,
        renderedAsExactUnit: true,
        renderedAsNanpaReferencePhrase: true,
        samples,
        sampleRate: rendered.sampleRate,
        durationSeconds: samples.length / rendered.sampleRate,
        pauseAfterSeconds: 0
      });
      speechCursor += 1;
      continue;
    }

    entries.push({
      ...segment,
      text: '',
      speechUnitText: '',
      speechUnitKind: 'audio-gap',
      speechUnitIndex: null,
      speechUnitCount: groupUnits.length,
      wholeNumericPunctuationWord: false,
      numericCartouche: true,
      numericCartoucheRunId: groupUnits[0]?.numericCartoucheRunId || null,
      numericCartouchePhrase: phrase,
      nanpaAudioGapKind: record.gapKind || 'gap',
      visualTargets: [],
      sourceSegmentIndex: segmentIndex,
      renderText: phrase,
      renderedAsWholeSegment: false,
      renderedAsExactUnit: true,
      renderedAsNanpaReferencePhrase: true,
      samples,
      sampleRate: rendered.sampleRate,
      durationSeconds: samples.length / rendered.sampleRate,
      pauseAfterSeconds: 0
    });
  }

  if (speechCursor !== groupUnits.length) {
    throw new Error(`Not all numeric-cartouche highlight units were assigned for "${phrase}".`);
  }

  if (entries.length) {
    entries[entries.length - 1].pauseAfterSeconds = numericCartoucheBoundaryPauseSeconds({
      segment,
      crossesLine,
      lineDistance,
      linePauseSeconds,
      renderOptions,
      hasFollowingSegment,
      isLastUnitInSegment
    });
  }
  return entries;
}

/**
 * Render ordinary highlight units as exact individual waveforms. Numeric
 * cartouches are rendered once as the complete nanpa-linja-n proper-name phrase,
 * through the same reference-audio path used by Review and History, and are then
 * divided only at exact sample boundaries supplied by the voice API timeline.
 *
 * No character-count or proportional waveform timing is used. The renderer plan
 * and all visual-target mappings remain unchanged.
 */
export async function renderSpeechSegmentsToAudioBuffers({
  segments,
  voice,
  renderOptions = {},
  linePauseSeconds = 0.35,
  shouldCancel = null
} = {}) {
  if (!voice || typeof voice.render !== 'function') {
    throw new Error('renderSpeechSegmentsToAudioBuffers requires a voice with render().');
  }

  const inputSegments = Array.from(segments || []);
  const entries = [];
  let sampleRate = null;
  let spokenSegmentCount = 0;

  for (let segmentIndex = 0; segmentIndex < inputSegments.length; segmentIndex++) {
    if (isSitelenAudioCancelled(shouldCancel)) {
      return { cancelled: true, entries, sampleRate, spokenSentenceCount: spokenSegmentCount };
    }

    const segment = inputSegments[segmentIndex] || {};
    const nextSegment = inputSegments[segmentIndex + 1] || null;
    const crossesLine = !!nextSegment && Number(nextSegment.lineIndex) > Number(segment.lineIndex);
    const lineDistance = crossesLine
      ? Math.max(1, Number(nextSegment.lineIndex) - Number(segment.lineIndex))
      : 0;

    const units = Array.isArray(segment.speechUnits) && segment.speechUnits.length
      ? segment.speechUnits
      : [{
          text: segment.text,
          timingText: segment.text,
          timingSyllables: splitAudioTpWordIntoSyllables(segment.text),
          kind: 'segment',
          wholeNumericPunctuationWord: false,
          visualTargets: (segment.visualRunRefs || []).map(ref => ({
            runId: ref.id,
            lineIndex: ref.lineIndex,
            runIndex: ref.runIndex,
            componentIndices: []
          }))
        }];

    let entriesBeforeSegment = entries.length;
    for (let unitIndex = 0; unitIndex < units.length;) {
      if (isSitelenAudioCancelled(shouldCancel)) {
        return { cancelled: true, entries, sampleRate, spokenSentenceCount: spokenSegmentCount };
      }

      const unit = units[unitIndex];
      if (isNumericCartoucheAudioUnit(unit)) {
        let groupEnd = unitIndex + 1;
        while (groupEnd < units.length && sameNumericCartoucheAudioGroup(unit, units[groupEnd])) {
          groupEnd += 1;
        }

        const groupEntries = await renderExactNumericCartoucheEntries({
          units: units.slice(unitIndex, groupEnd),
          segment,
          segmentIndex,
          voice,
          renderOptions,
          crossesLine,
          lineDistance,
          linePauseSeconds,
          expectedSampleRate: sampleRate,
          hasFollowingSegment: !!nextSegment,
          isLastUnitInSegment: groupEnd >= units.length
        });

        if (isSitelenAudioCancelled(shouldCancel)) {
          return { cancelled: true, entries, sampleRate, spokenSentenceCount: spokenSegmentCount };
        }
        if (groupEntries.length) {
          if (sampleRate == null) sampleRate = groupEntries[0].sampleRate;
          entries.push(...groupEntries);
        }
        unitIndex = groupEnd;
        continue;
      }

      const entry = await renderExactSpeechUnitEntry({
        unit,
        unitIndex,
        unitCount: units.length,
        nextUnit: units[unitIndex + 1] || null,
        segment,
        segmentIndex,
        voice,
        renderOptions,
        crossesLine,
        lineDistance,
        linePauseSeconds,
        expectedSampleRate: sampleRate,
        hasFollowingSegment: !!nextSegment
      });

      if (isSitelenAudioCancelled(shouldCancel)) {
        return { cancelled: true, entries, sampleRate, spokenSentenceCount: spokenSegmentCount };
      }
      if (entry) {
        if (sampleRate == null) sampleRate = entry.sampleRate;
        entries.push(entry);
      }
      unitIndex += 1;
    }

    if (entries.length > entriesBeforeSegment) spokenSegmentCount += 1;
  }

  for (let index = 0; index < entries.length; index++) entries[index].index = index;

  return {
    cancelled: false,
    entries,
    buffers: entries,
    sampleRate,
    spokenSentenceCount: spokenSegmentCount
  };
}

export async function buildSitelenSentenceAudioBuffersFromRawText({
  rawText,
  pageMap,
  renderer,
  rendererConfig = {},
  CartoucheApi,
  NanpaParser = null,
  nanpaParser = null,
  nanpaLinjanMode = 'uniform',
  mixedStyle = 'short',
  relaxedNanpaLinjanParsing = false,
  relaxedNanpaLinjanRendering = false,
  silenceTeToAudio = false,
  soundOutPhonotacticUnknownWords = false,
  interpretDoubleQuotesAsTeTo = false,
  normalizeNonDrawableSourceTokens = true,
  voice = null,
  getVoice = null,
  renderOptions = {},
  linePauseSeconds = 0.35,
  shouldCancel = null
} = {}) {
  const audioPlan = await buildSitelenSentenceAudioPlan({
    rawText,
    pageMap,
    renderer,
    rendererConfig,
    CartoucheApi,
    NanpaParser,
    nanpaParser,
    nanpaLinjanMode,
    mixedStyle,
    relaxedNanpaLinjanParsing,
    relaxedNanpaLinjanRendering,
    silenceTeToAudio,
    soundOutPhonotacticUnknownWords,
    interpretDoubleQuotesAsTeTo,
    normalizeNonDrawableSourceTokens
  });

  const segments = Array.isArray(audioPlan?.speechSegments) ? audioPlan.speechSegments : [];
  const hasSpeech = segments.some(segment => containsSpokenWord(segment?.text));
  if (!hasSpeech) {
    return {
      status: 'no-speech',
      played: false,
      hasSpeech: false,
      audioPlan,
      segments,
      entries: [],
      buffers: [],
      skipped: audioPlan?.skipped || [],
      sampleRate: null,
      spokenSentenceCount: 0,
      cancelled: false
    };
  }

  if (isSitelenAudioCancelled(shouldCancel)) {
    return {
      status: 'cancelled',
      played: false,
      hasSpeech,
      audioPlan,
      segments,
      entries: [],
      buffers: [],
      skipped: audioPlan?.skipped || [],
      cancelled: true
    };
  }

  const resolvedVoice = voice || (typeof getVoice === 'function' ? await getVoice() : null);
  if (!resolvedVoice) throw new Error('buildSitelenSentenceAudioBuffersFromRawText requires voice or getVoice().');

  const rendered = await renderSpeechSegmentsToAudioBuffers({
    segments,
    voice: resolvedVoice,
    renderOptions,
    linePauseSeconds,
    shouldCancel
  });

  if (rendered.cancelled) {
    return {
      status: 'cancelled',
      played: false,
      hasSpeech,
      audioPlan,
      segments,
      skipped: audioPlan?.skipped || [],
      ...rendered
    };
  }

  return {
    status: rendered.entries.length ? 'rendered' : 'no-samples',
    played: false,
    hasSpeech,
    audioPlan,
    segments,
    skipped: audioPlan?.skipped || [],
    ...rendered
  };
}

export async function renderSpeechLinesToAudioSamples({
  lines,
  voice,
  renderOptions = {},
  linePauseSeconds = 0.35,
  shouldCancel = null
} = {}) {
  if (!voice || typeof voice.render !== 'function') {
    throw new Error('renderSpeechLinesToAudioSamples requires a voice with render().');
  }

  const chunks = [];
  let sampleRate = null;
  let sawSpeech = false;
  let pendingLinePauses = 0;
  let spokenLineCount = 0;

  for (const rawLine of (lines || [])) {
    if (isSitelenAudioCancelled(shouldCancel)) {
      return { cancelled: true, samples: null, chunks, sampleRate, spokenLineCount };
    }

    const lineText = String(rawLine ?? '').trim();
    if (!lineText) {
      if (sawSpeech) pendingLinePauses = Math.min(2, pendingLinePauses + 1);
      continue;
    }

    if (sawSpeech && sampleRate) {
      const pauses = Math.max(1, Math.min(2, pendingLinePauses || 1));
      chunks.push(makeSilenceSamples(Number(linePauseSeconds || 0) * pauses, sampleRate));
    }

    const rendered = await voice.render(lineText, {
      ...(renderOptions || {}),
      alreadyPreprocessed: true,
      allowLetterSoundFallback: true
    });

    if (isSitelenAudioCancelled(shouldCancel)) {
      return { cancelled: true, samples: null, chunks, sampleRate, spokenLineCount };
    }

    if (rendered?.sampleRate != null) {
      if (sampleRate != null && rendered.sampleRate !== sampleRate) {
        throw new Error('Audio sample-rate changed between rendered lines.');
      }
      sampleRate = rendered.sampleRate;
    }

    if (rendered?.samples?.length) chunks.push(rendered.samples);
    sawSpeech = true;
    pendingLinePauses = 1;
    spokenLineCount += 1;
  }

  const samples = sampleRate && chunks.length ? concatAudioSampleChunks(chunks) : null;
  return {
    cancelled: false,
    samples,
    chunks,
    sampleRate,
    spokenLineCount
  };
}

export async function playSitelenAudioPlan({
  audioPlan,
  voice,
  getVoice = null,
  renderOptions = {},
  linePauseSeconds = 0.35,
  shouldCancel = null,
  playSamples = true
} = {}) {
  const lines = Array.isArray(audioPlan?.speechLines)
    ? audioPlan.speechLines
    : (Array.isArray(audioPlan?.lines) ? audioPlan.lines : []);
  const skipped = Array.isArray(audioPlan?.skipped) ? audioPlan.skipped : [];
  const hasSpeech = lines.some(line => String(line || '').trim().length > 0);

  if (!hasSpeech) {
    return {
      status: 'no-speech',
      played: false,
      hasSpeech: false,
      audioPlan,
      lines,
      skipped,
      samples: null,
      sampleRate: null,
      spokenLineCount: 0,
      cancelled: false
    };
  }

  if (isSitelenAudioCancelled(shouldCancel)) {
    return { status: 'cancelled', played: false, hasSpeech, audioPlan, lines, skipped, cancelled: true };
  }

  const resolvedVoice = voice || (typeof getVoice === 'function' ? await getVoice() : null);
  if (!resolvedVoice) throw new Error('playSitelenAudioPlan requires voice or getVoice().');

  if (isSitelenAudioCancelled(shouldCancel)) {
    return { status: 'cancelled', played: false, hasSpeech, audioPlan, lines, skipped, cancelled: true };
  }

  const rendered = await renderSpeechLinesToAudioSamples({
    lines,
    voice: resolvedVoice,
    renderOptions,
    linePauseSeconds,
    shouldCancel
  });

  if (rendered.cancelled) {
    return { status: 'cancelled', played: false, hasSpeech, audioPlan, lines, skipped, ...rendered };
  }

  if (!rendered.sampleRate || !rendered.samples?.length) {
    return { status: 'no-samples', played: false, hasSpeech, audioPlan, lines, skipped, ...rendered };
  }

  if (playSamples) {
    if (typeof resolvedVoice.playSamples !== 'function') {
      throw new Error('playSitelenAudioPlan requires voice.playSamples() when playSamples is true.');
    }
    resolvedVoice.playSamples(rendered.samples, rendered.sampleRate);
  }

  return {
    status: playSamples ? 'playing' : 'rendered',
    played: !!playSamples,
    hasSpeech,
    audioPlan,
    lines,
    skipped,
    ...rendered
  };
}

export async function buildAndPlaySitelenAudioFromRawText({
  rawText,
  pageMap,
  renderer,
  rendererConfig = {},
  CartoucheApi,
  NanpaParser = null,
  nanpaParser = null,
  nanpaLinjanMode = 'uniform',
  mixedStyle = 'short',
  relaxedNanpaLinjanParsing = false,
  relaxedNanpaLinjanRendering = false,
  silenceTeToAudio = false,
  soundOutPhonotacticUnknownWords = false,
  interpretDoubleQuotesAsTeTo = false,
  normalizeNonDrawableSourceTokens = true,
  voice = null,
  getVoice = null,
  renderOptions = {},
  linePauseSeconds = 0.35,
  shouldCancel = null,
  playSamples = true
} = {}) {
  const audioPlan = await buildSitelenAudioPlan({
    rawText,
    pageMap,
    renderer,
    rendererConfig,
    CartoucheApi,
    NanpaParser,
    nanpaParser,
    nanpaLinjanMode,
    mixedStyle,
    relaxedNanpaLinjanParsing,
    relaxedNanpaLinjanRendering,
    silenceTeToAudio,
    soundOutPhonotacticUnknownWords,
    interpretDoubleQuotesAsTeTo,
    normalizeNonDrawableSourceTokens
  });

  if (isSitelenAudioCancelled(shouldCancel)) {
    return {
      status: 'cancelled',
      played: false,
      hasSpeech: false,
      audioPlan,
      lines: audioPlan?.speechLines || [],
      skipped: audioPlan?.skipped || [],
      cancelled: true
    };
  }

  return await playSitelenAudioPlan({
    audioPlan,
    voice,
    getVoice,
    renderOptions,
    linePauseSeconds,
    shouldCancel,
    playSamples
  });
}

export async function stopSitelenAudioPlayback({ voice = null, getVoice = null } = {}) {
  const resolvedVoice = voice || (typeof getVoice === 'function' ? await getVoice() : null);
  try { resolvedVoice?.stop?.(); } catch {}
}

export function summarizeSkippedAudio(skipped, { limit = 4, textLimit = 40 } = {}) {
  const seen = new Set();
  const sample = [];
  for (const item of skipped || []) {
    const label = `${item.kind}: ${String(item.text || '').slice(0, textLimit)}`;
    if (seen.has(label)) continue;
    seen.add(label);
    sample.push(label);
    if (sample.length >= limit) break;
  }
  return sample.join('; ');
}

export default {
  buildSitelenAudioPlan,
  buildAndPlaySitelenAudioFromRawText,
  playSitelenAudioPlan,
  renderSpeechLinesToAudioSamples,
  buildSitelenSentenceAudioPlan,
  buildSitelenSentenceAudioBuffersFromRawText,
  renderSpeechSegmentsToAudioBuffers,
  extractSpeechSegmentsFromRenderPlan,
  speechUnitsForRenderRun,
  splitAudioTpWordIntoSyllables,
  splitAudioTpWordIntoMorae,
  splitSpeechTextIntoSentenceFragments,
  makeSilenceSamples,
  concatAudioSampleChunks,
  stopSitelenAudioPlayback,
  prepareAudioInputForPlan,
  extractSpeechLinesFromRenderPlan,
  buildTextAudioLinesFromRenderPlan,
  speechTextForRenderRun,
  summarizeSkippedAudio,
  compactSpeechWhitespace,
  normalizeNonDrawableSourceTokensForAudioInput,
  sanitizeTextToSitelenAudioText,
  isReadableAudioTokiPonaText,
  isAudioTpPhonotacticWord,
  isCapitalizedAudioProperNameText,
  isCapitalizedAudioProperNamePhraseText,
  tryCartoucheSourceToSpokenSyllableText,
  tryAbbreviatedNanpaLinjanCartoucheSourceToProperName,
  nanpaCapsForAudioMode,
  trySourceTextToNanpaProperName
};
