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
  'kulupu','kipisi','kasi','kala',
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

export function trySourceTextToNanpaProperName(text, options = {}) {
  const source = String(text ?? '').trim();
  if (!source) return '';

  const NanpaParser = getNanpaParserFromOptions(options);
  if (!NanpaParser) return '';

  try {
    const caps = tryNanpaLinjanTpPhraseSourceToCaps(source);
    if (caps && typeof NanpaParser.splitCapsToProperName === 'function') {
      return NanpaParser.splitCapsToProperName(caps, { titleCase: true }) || '';
    }
  } catch {}

  try {
    if (typeof NanpaParser.parseNumber !== 'function') return '';
    const parsed = NanpaParser.parseNumber(source, {
      mode: options.nanpaLinjanMode || options.mode || 'uniform',
      mixedStyle: options.mixedStyle || 'short',
      relaxedNanpaLinjanParsing: !!options.relaxedNanpaLinjanParsing,
      relaxedNanpaLinjanRendering: !!options.relaxedNanpaLinjanRendering
    });
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
    if (isReadableAudioTokiPonaText(sourceText)) return compactSpeechWhitespace(sourceText);
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

  // Numeric and ordinary cartouche source strings may contain decimal points
  // or visual control syntax that must never be interpreted as prose endings.
  if (kind === 'cartouche' || sourceKind === 'bracket') return 0;

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
    let visualRunRefs = [];

    const flush = (boundaryAfter) => {
      const text = compactSpeechWhitespace(parts.join(' '));
      if (text && containsSpokenWord(text)) {
        segments.push({
          text,
          speechText: text,
          lineIndex,
          sentenceIndexInLine,
          boundaryAfter,
          visualRunRefs: visualRunRefs.slice()
        });
      }
      parts = [];
      visualRunRefs = [];
    };

    const runs = Array.isArray(line?.runs) ? line.runs : [];
    for (let fallbackRunIndex = 0; fallbackRunIndex < runs.length; fallbackRunIndex++) {
      const run = runs[fallbackRunIndex];
      const speech = speechTextForRenderRun(run, skipped, {
        ...options,
        rawProperNameQueue,
        lineIndex
      });

      const fragments = splitSpeechTextIntoSentenceFragments(speech);
      let speechBoundaryCount = 0;

      for (const fragment of fragments) {
        if (fragment.text) {
          parts.push(fragment.text);
          appendUniqueRunRef(visualRunRefs, run, fallbackRunIndex, lineIndex);
        }
        if (fragment.endsSentence) {
          speechBoundaryCount += 1;
          flush('punctuation');
          sentenceIndexInLine += 1;
        }
      }

      // If a skipped/non-speakable visual run contains a sentence terminator,
      // keep the ordinal aligned with the visible render plan. This is useful
      // when an unknown sentence is skipped between two readable sentences.
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

    // A terminal punctuation mark directly before a newline must use only the
    // line boundary spacing. Reclassify the final spoken segment on the line.
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

  for (let index = 0; index < inputSegments.length; index++) {
    if (isSitelenAudioCancelled(shouldCancel)) {
      return { cancelled: true, entries, sampleRate, spokenSentenceCount: entries.length };
    }

    const segment = inputSegments[index] || {};
    const next = inputSegments[index + 1] || null;
    const crossesLine = !!next && Number(next.lineIndex) > Number(segment.lineIndex);
    const lineDistance = crossesLine
      ? Math.max(1, Number(next.lineIndex) - Number(segment.lineIndex))
      : 0;

    // For a newline boundary, remove terminal punctuation from the audio input
    // so the line pause replaces (rather than stacks on top of) its pause.
    const renderText = crossesLine
      ? stripTerminalSentencePunctuation(segment.text)
      : compactSpeechWhitespace(segment.text);

    if (!renderText || !containsSpokenWord(renderText)) continue;

    const rendered = await voice.render(renderText, {
      ...(renderOptions || {}),
      alreadyPreprocessed: true
    });

    if (isSitelenAudioCancelled(shouldCancel)) {
      return { cancelled: true, entries, sampleRate, spokenSentenceCount: entries.length };
    }

    if (rendered?.sampleRate != null) {
      if (sampleRate != null && rendered.sampleRate !== sampleRate) {
        throw new Error('Audio sample-rate changed between rendered sentence buffers.');
      }
      sampleRate = rendered.sampleRate;
    }

    if (!rendered?.samples?.length) continue;

    entries.push({
      ...segment,
      index: entries.length,
      sourceSegmentIndex: index,
      renderText,
      samples: rendered.samples,
      sampleRate: rendered.sampleRate,
      durationSeconds: rendered.samples.length / rendered.sampleRate,
      pauseAfterSeconds: crossesLine
        ? Number(linePauseSeconds || 0) * Math.min(2, lineDistance)
        : 0
    });
  }

  return {
    cancelled: false,
    entries,
    buffers: entries,
    sampleRate,
    spokenSentenceCount: entries.length
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
  trySourceTextToNanpaProperName
};
