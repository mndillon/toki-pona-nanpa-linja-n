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

function audioGlyphTokensFromCartoucheSource(text) {
  return stripOuterBracketSyntaxForAudio(text)
    .split(/\s+/)
    .map(normalizeTpGlyphToken)
    .filter(Boolean);
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
  const caps = audioInitialTextFromGlyphTokens(words).toUpperCase();
  if (!caps || !caps.startsWith('NE') || !caps.endsWith('N')) return '';
  return caps;
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

export function tryCartoucheSourceToSpokenSyllableText(text) {
  const words = audioGlyphTokensFromCartoucheSource(text);
  if (!words.length) return '';
  if (!words.every(isKnownTpGlyphToken)) return '';

  // Ordinary cartouche reading: glyph initials spell the name.
  // Example: [mun uta] -> Mu.
  const spelled = audioInitialTextFromGlyphTokens(words).toLowerCase();
  if (spelled && isAudioTpPhonotacticWord(spelled)) {
    return titleCaseAudioProperNameText(spelled);
  }
  return '';
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

export function speechTextForRenderRun(run, skipped = [], options = {}) {
  if (!run) return '';

  const rawProperNameQueue = Array.isArray(options)
    ? options
    : (options.rawProperNameQueue || []);

  const kind = String(run.kind ?? '').toLowerCase();
  const sourceKind = String(run.sourceKind ?? '').toLowerCase();
  const sourceText = String(run.sourceText ?? run.encodedText ?? '').trim();
  if (!sourceText) return '';

  if (sourceKind === 'image' || kind === 'image') {
    skipped.push({ kind: 'image', text: sourceText });
    return '';
  }

  if (run.isUnrecognized) {
    skipped.push({ kind: 'unknown', text: sourceText });
    return '';
  }

  if (run.isQuoted || sourceKind === 'quote') {
    skipped.push({ kind: 'quoted', text: sourceText });
    return '';
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
    const rawProperNameQueue = rawProperNameQueues[lineIndex] || [];
    for (const run of (line?.runs || [])) {
      const speech = speechTextForRenderRun(run, skipped, {
        ...options,
        rawProperNameQueue,
        lineIndex
      });
      if (speech) parts.push(speech);
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
    relaxedNanpaLinjanRendering
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
  'one', 'ono', 'oko', 'eko', 'oken', 'ene', 'inin'
]);

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

function buildCartoucheSpeechUnits(run, speech, fallbackRunIndex, lineIndex) {
  const words = spokenWordTokens(speech);
  if (!words.length) return [];

  const displayedCps = runCodepointsForAudio(run);
  const componentCount = Math.max(1, displayedCps.length);
  const sourceCps = runAudioSourceCodepoints(run);
  const sourceCount = Math.max(1, sourceCps.length);
  const sourceIndices = runAudioSourceIndices(run, componentCount);
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
      const componentIndices = nearestDisplayedComponentsForSourceRange(
        sourceIndices,
        rangeStart,
        rangeEnd,
        wordSourceRange
      );

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
        visualTargets: [
          visualTargetForComponentIndices(run, componentIndices, fallbackRunIndex, lineIndex)
        ]
      });
      unitIndex += 1;
    }
  }

  return wordRecords;
}

function buildLongPiSpeechUnits(run, speech, fallbackRunIndex, lineIndex) {
  const words = spokenWordTokens(speech);
  if (!words.length) return [];

  const cps = runCodepointsForAudio(run);
  const out = [];

  for (let wordIndex = 0; wordIndex < words.length; wordIndex++) {
    let componentIndices = [];

    if (wordIndex === 0) {
      componentIndices = cps.length ? [0] : [];
    } else {
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
      kind: wordIndex === 0 ? 'long-pi-head' : 'long-pi-member',
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

  return words.map((word, wordIndex) => {
    let componentIndices = [];
    if (groups.length) {
      const start = Math.floor(groups.length * wordIndex / words.length);
      const end = Math.max(start + 1, Math.ceil(groups.length * (wordIndex + 1) / words.length));
      componentIndices = groups.slice(start, end).flat();
    }

    return {
      text: word,
      timingText: word,
      timingSyllables: splitAudioTpWordIntoSyllables(word),
      kind: 'word',
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
  lineIndex = 0
} = {}) {
  const text = compactSpeechWhitespace(speech);
  if (!text) return [];

  const kind = String(run?.kind ?? '').toLowerCase();
  const sourceKind = String(run?.sourceKind ?? '').toLowerCase();
  if (run?.isQuoted || sourceKind === 'quote' || run?.isUnrecognized) return [];

  if (kind === 'cartouche') {
    return buildCartoucheSpeechUnits(run, text, fallbackRunIndex, lineIndex);
  }

  const cps = runCodepointsForAudio(run);
  if (cps.includes(0xF1993)) {
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
    const rawProperNameQueue = rawProperNameQueues[lineIndex] || [];
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
    for (let fallbackRunIndex = 0; fallbackRunIndex < runs.length; fallbackRunIndex++) {
      const run = runs[fallbackRunIndex];
      const speech = speechTextForRenderRun(run, skipped, {
        ...options,
        rawProperNameQueue,
        lineIndex
      });

      const runUnits = speechUnitsForRenderRun(run, speech, {
        fallbackRunIndex,
        lineIndex
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
    relaxedNanpaLinjanRendering: !!options.relaxedNanpaLinjanRendering
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
function caseInsensitiveAudioValue(object, names) {
  if (!object || typeof object !== 'object') return null;
  const wanted = new Set(names.map(name => String(name).toLowerCase()));
  for (const [key, value] of Object.entries(object)) {
    if (wanted.has(String(key).toLowerCase())) return value;
  }
  return null;
}

function audioDurationMilliseconds(entry) {
  if (entry == null) return null;
  if (typeof entry === 'number' && Number.isFinite(entry)) return entry;
  if (typeof entry !== 'object') return null;
  for (const key of ['duration_ms', 'durationMs', 'milliseconds', 'ms']) {
    const value = Number(entry[key]);
    if (Number.isFinite(value) && value > 0) return value;
  }
  for (const key of ['duration_seconds', 'durationSeconds', 'seconds']) {
    const value = Number(entry[key]);
    if (Number.isFinite(value) && value > 0) return value * 1000;
  }
  return null;
}

function manifestDurationForAudioUnit(voice, unitText) {
  const text = String(unitText ?? '').trim();
  if (!text) return null;
  const names = [
    text, text.toLowerCase(), text.toUpperCase(),
    `${text}.wav`, `${text.toLowerCase()}.wav`, `${text.toUpperCase()}.wav`
  ];
  const roots = [
    voice?.manifest, voice?.audioManifest, voice?.referenceAudioManifest,
    voice?.config?.manifest, voice?.config?.audioManifest
  ].filter(Boolean);

  for (const root of roots) {
    const directDuration = audioDurationMilliseconds(caseInsensitiveAudioValue(root, names));
    if (directDuration) return directDuration;
    for (const nestedName of ['nanpa_v2', 'nanpaV2', 'files', 'assets', 'entries', 'syllables']) {
      const nestedDuration = audioDurationMilliseconds(caseInsensitiveAudioValue(root?.[nestedName], names));
      if (nestedDuration) return nestedDuration;
    }
  }
  return null;
}

function estimatedAudioPieceWeight(voice, text, { wholeNumericPunctuationWord = false } = {}) {
  const manifestDuration = manifestDurationForAudioUnit(voice, text);
  if (manifestDuration) return manifestDuration;
  const length = Math.max(1, normalizedSpeechLetters(text).length);
  if (wholeNumericPunctuationWord) return 260 + Math.max(0, length - 2) * 75;
  return 230 + Math.max(0, length - 2) * 55;
}

function timingWeightForSpeechUnit(voice, unit, syllableGapMs) {
  const wholeNumeric = !!unit?.wholeNumericPunctuationWord;
  const timingText = String(unit?.timingText ?? unit?.text ?? '').trim();
  if (wholeNumeric) {
    return estimatedAudioPieceWeight(voice, timingText, { wholeNumericPunctuationWord: true });
  }

  const directDuration = manifestDurationForAudioUnit(voice, timingText);
  if (directDuration) return directDuration;

  const syllables = Array.isArray(unit?.timingSyllables) && unit.timingSyllables.length
    ? unit.timingSyllables
    : splitAudioTpWordIntoSyllables(timingText);
  if (!syllables.length) return estimatedAudioPieceWeight(voice, timingText);

  return syllables.reduce(
    (sum, syllable) => sum + estimatedAudioPieceWeight(voice, syllable),
    Math.max(0, syllables.length - 1) * syllableGapMs
  );
}

function partitionRenderedSegmentSamples({
  samples,
  sampleRate,
  segment,
  units,
  voice,
  renderOptions,
  sourceSegmentIndex,
  crossesLine,
  lineDistance,
  linePauseSeconds,
  renderText
}) {
  const sourceSamples = samples instanceof Float32Array ? samples : Float32Array.from(samples || []);
  if (!sourceSamples.length) return [];

  const syllableGapMs = Math.max(0, Number(renderOptions?.syllableGapSeconds) || 0) * 1000;
  const pauseScale = Math.max(0.1, Number(renderOptions?.pauseScale) || 1);
  const pieces = [];

  for (let unitIndex = 0; unitIndex < units.length; unitIndex++) {
    const unit = units[unitIndex] || {};
    pieces.push({
      kind: 'unit',
      unit,
      unitIndex,
      weight: Math.max(1, timingWeightForSpeechUnit(voice, unit, syllableGapMs))
    });
    if (unitIndex < units.length - 1 && syllableGapMs > 0) {
      pieces.push({ kind: 'gap', weight: syllableGapMs });
    }
  }

  if (segment?.boundaryAfter === 'punctuation' && !crossesLine) {
    pieces.push({ kind: 'gap', terminal: true, weight: Math.max(80, 240 * pauseScale) });
  }

  if (!pieces.length) {
    pieces.push({
      kind: 'unit',
      unit: {
        text: segment?.text || renderText,
        kind: 'segment',
        visualTargets: (segment?.visualRunRefs || []).map(ref => ({
          runId: ref.id,
          lineIndex: ref.lineIndex,
          runIndex: ref.runIndex,
          componentIndices: []
        }))
      },
      unitIndex: 0,
      weight: 1
    });
  }

  const totalWeight = Math.max(1, pieces.reduce((sum, piece) => sum + Math.max(0, Number(piece.weight) || 0), 0));
  const entries = [];
  let cursor = 0;
  let accumulatedWeight = 0;

  for (let pieceIndex = 0; pieceIndex < pieces.length; pieceIndex++) {
    const piece = pieces[pieceIndex];
    accumulatedWeight += Math.max(0, Number(piece.weight) || 0);
    let end = pieceIndex === pieces.length - 1
      ? sourceSamples.length
      : Math.round(sourceSamples.length * accumulatedWeight / totalWeight);
    end = Math.max(cursor, Math.min(sourceSamples.length, end));
    const pieceSamples = sourceSamples.slice(cursor, end);
    cursor = end;
    if (!pieceSamples.length) continue;

    const isLastPiece = pieceIndex === pieces.length - 1;
    if (piece.kind === 'unit') {
      const unit = piece.unit || {};
      entries.push({
        ...segment,
        text: unit.text,
        speechUnitText: unit.text,
        speechUnitKind: unit.kind || 'word',
        speechUnitIndex: piece.unitIndex,
        speechUnitCount: units.length,
        wholeNumericPunctuationWord: !!unit.wholeNumericPunctuationWord,
        visualTargets: Array.isArray(unit.visualTargets)
          ? unit.visualTargets.map(target => ({
              ...target,
              componentIndices: Array.isArray(target.componentIndices)
                ? target.componentIndices.slice()
                : []
            }))
          : [],
        sourceSegmentIndex,
        renderText,
        renderedAsWholeSegment: true,
        samples: pieceSamples,
        sampleRate,
        durationSeconds: pieceSamples.length / sampleRate,
        pauseAfterSeconds: isLastPiece && crossesLine
          ? Number(linePauseSeconds || 0) * Math.min(2, lineDistance)
          : 0
      });
    } else {
      entries.push({
        ...segment,
        text: '',
        speechUnitText: '',
        speechUnitKind: piece.terminal ? 'terminal-pause' : 'audio-gap',
        speechUnitIndex: null,
        speechUnitCount: units.length,
        wholeNumericPunctuationWord: false,
        visualTargets: [],
        sourceSegmentIndex,
        renderText,
        renderedAsWholeSegment: true,
        samples: pieceSamples,
        sampleRate,
        durationSeconds: pieceSamples.length / sampleRate,
        pauseAfterSeconds: isLastPiece && crossesLine
          ? Number(linePauseSeconds || 0) * Math.min(2, lineDistance)
          : 0
      });
    }
  }

  if (cursor < sourceSamples.length && entries.length) {
    const last = entries[entries.length - 1];
    const merged = new Float32Array(last.samples.length + sourceSamples.length - cursor);
    merged.set(last.samples, 0);
    merged.set(sourceSamples.slice(cursor), last.samples.length);
    last.samples = merged;
    last.durationSeconds = merged.length / sampleRate;
  }

  return entries;
}

/**
 * Synthesize each complete sentence segment once, then partition that single
 * waveform for highlight timing. This preserves fluid pronunciation—including
 * whole numeric punctuation words such as Eke—while still exposing per-unit
 * playback entries to the page overlay.
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
          visualTargets: (segment.visualRunRefs || []).map(ref => ({
            runId: ref.id,
            lineIndex: ref.lineIndex,
            runIndex: ref.runIndex,
            componentIndices: []
          }))
        }];

    let renderText = compactSpeechWhitespace(segment.text);
    if (!renderText || !containsSpokenWord(renderText)) continue;

    if (segment.boundaryAfter === 'punctuation') {
      const terminal = String(segment.terminalPunctuation || '').trim();
      if (terminal) renderText += terminal;
    }
    if (crossesLine) renderText = stripTerminalSentencePunctuation(renderText);

    const rendered = await voice.render(renderText, {
      ...(renderOptions || {}),
      alreadyPreprocessed: true
    });

    if (isSitelenAudioCancelled(shouldCancel)) {
      return { cancelled: true, entries, sampleRate, spokenSentenceCount: spokenSegmentCount };
    }

    if (rendered?.sampleRate != null) {
      if (sampleRate != null && rendered.sampleRate !== sampleRate) {
        throw new Error('Audio sample-rate changed between rendered sentence buffers.');
      }
      sampleRate = rendered.sampleRate;
    }

    if (!rendered?.samples?.length || !rendered?.sampleRate) continue;

    const segmentEntries = partitionRenderedSegmentSamples({
      samples: rendered.samples,
      sampleRate: rendered.sampleRate,
      segment,
      units,
      voice,
      renderOptions,
      sourceSegmentIndex: segmentIndex,
      crossesLine,
      lineDistance,
      linePauseSeconds,
      renderText
    });
    entries.push(...segmentEntries);
    if (segmentEntries.length) spokenSegmentCount += 1;
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
      alreadyPreprocessed: true
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
  nanpaCapsForAudioMode,
  trySourceTextToNanpaProperName
};
