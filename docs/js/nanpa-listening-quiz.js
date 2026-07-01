// nanpa-linja-n listening quiz for index.html
// Fast startup: this module builds only the lightweight quiz shell at page load.
// Heavy code paths (NanpaParser, audio manifest, voice API, and canvas cartouches)
// are lazy-loaded only after audio/check/reveal interaction.

const QUIZ_ROOT_ID = 'nanpaListeningQuiz';
const FONT_FAMILY = 'TP-Cartouche-Font';
const LARGE_TINY_FONT_SIZE = 22;
const SMALL_TINY_FONT_SIZE = 8;
const CARTOUCHE_RENDER_OPTS = { padding: 8, border: 1, cornerRadius: 10, letterGap: 2 };
const AUDIO_PAUSE_SCALE_STORAGE_KEY = 'nanpaListeningQuizAudioPauseScale';
const AUDIO_PAUSE_SCALE_DEFAULT = 2.25;//slow
const AVERAGE_TRIMMED_OUTER_SILENCE_SECONDS = 0.467;
const AUDIO_PAUSE_SCALE_OPTIONS = [
  // Normal adds a small gap between assembled syllable units.
  { value: 1.00, label: 'Normal', syllableGapSeconds: 0.200 },
  // Slow is double the previous 0.350 s gap.
  { value: 2.25, label: 'Slow', syllableGapSeconds: 0.700 },
  // Very slow is double the previous 0.701 s gap.
  { value: 4.00, label: 'Very slow', syllableGapSeconds: 1.402 }
];

const PROPER_NAME_MODE_STORAGE_KEY = 'nanpaListeningQuizProperNameMode';
const PROPER_NAME_MODE_DEFAULT = 'relaxed';
const PROPER_NAME_MODE_OPTIONS = [
  { value: 'strict', label: 'strict' },
  { value: 'relaxed', label: 'relaxed' }
];

const ABBREV_CP_NANPA = 0xF193D;
const ABBREV_CP_NENA  = 0xF1940;
const ABBREV_CP_EN    = 0xF190A;
const ABBREV_CP_OPEN  = 0xF1947;
const ABBREV_CP_ALA   = 0xF1902;
const ABBREV_CP_IKE   = 0xF190D;
const ABBREV_CP_UTA   = 0xF1970;
const ABBREV_DROP_AFTER_FIRST_NANPA = new Set([
  ABBREV_CP_NANPA,
  ABBREV_CP_NENA,
  ABBREV_CP_EN,
  ABBREV_CP_OPEN,
  ABBREV_CP_ALA,
  ABBREV_CP_IKE,
  ABBREV_CP_UTA
]);

let nanpaModulePromise = null;
let voicePromise = null;
let quizItems = [];

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function choice(items) {
  return items[randInt(0, items.length - 1)];
}

function shuffle(items) {
  const out = Array.from(items);
  for (let i = out.length - 1; i > 0; i--) {
    const j = randInt(0, i);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

function normalizePauseScale(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return AUDIO_PAUSE_SCALE_DEFAULT;
  return Math.min(6.0, Math.max(0.5, n));
}

function isSupportedAudioPauseScale(value) {
  const n = normalizePauseScale(value);
  return AUDIO_PAUSE_SCALE_OPTIONS.some(opt => Math.abs(opt.value - n) < 0.001);
}

function storedAudioPauseScale() {
  try {
    const raw = localStorage.getItem(AUDIO_PAUSE_SCALE_STORAGE_KEY);
    if (raw == null) return AUDIO_PAUSE_SCALE_DEFAULT;

    // Treat unsupported stored values from older versions as Normal so the control starts cleanly.
    if (!isSupportedAudioPauseScale(raw)) return AUDIO_PAUSE_SCALE_DEFAULT;

    return normalizePauseScale(raw);
  } catch {
    return AUDIO_PAUSE_SCALE_DEFAULT;
  }
}

function saveAudioPauseScale(value) {
  const v = normalizePauseScale(value);
  try { localStorage.setItem(AUDIO_PAUSE_SCALE_STORAGE_KEY, String(v)); } catch {}
  return v;
}

function getCurrentAudioPauseScale() {
  const el = document.querySelector('[data-quiz-audio-pause-scale]');
  return normalizePauseScale(el?.value ?? storedAudioPauseScale());
}

function getCurrentAudioSyllableGapSeconds() {
  const scale = getCurrentAudioPauseScale();
  const option = AUDIO_PAUSE_SCALE_OPTIONS.find(opt => Math.abs(opt.value - scale) < 0.001);
  return Number(option?.syllableGapSeconds ?? 0);
}

function audioPauseScaleOptionsHtml(selectedValue) {
  const selected = normalizePauseScale(selectedValue);
  return AUDIO_PAUSE_SCALE_OPTIONS
    .map(opt => {
      const value = String(opt.value.toFixed(2));
      const isSelected = Math.abs(opt.value - selected) < 0.001 ? ' selected' : '';
      return `<option value="${value}"${isSelected}>${opt.label}</option>`;
    })
    .join('');
}

function normalizeProperNameMode(value) {
  const s = String(value ?? '').trim().toLowerCase();
  if (s === 'relaxed' || s === 'relaxed-alternative' || s === 'relaxed-mixed') return 'relaxed';
  if (s === 'strict') return 'strict';
  return PROPER_NAME_MODE_DEFAULT;
}

function storedProperNameMode() {
  try {
    const raw = localStorage.getItem(PROPER_NAME_MODE_STORAGE_KEY);
    return raw == null ? PROPER_NAME_MODE_DEFAULT : normalizeProperNameMode(raw);
  } catch {
    return PROPER_NAME_MODE_DEFAULT;
  }
}

function saveProperNameMode(value) {
  const v = normalizeProperNameMode(value);
  try { localStorage.setItem(PROPER_NAME_MODE_STORAGE_KEY, v); } catch {}
  return v;
}

function getCurrentProperNameMode() {
  const el = document.querySelector('[data-quiz-proper-name-mode]');
  return normalizeProperNameMode(el?.value ?? storedProperNameMode());
}

function properNameModeOptionsHtml(selectedValue) {
  const selected = normalizeProperNameMode(selectedValue);
  return PROPER_NAME_MODE_OPTIONS
    .map(opt => {
      const isSelected = opt.value === selected ? ' selected' : '';
      return `<option value="${opt.value}"${isSelected}>${opt.label}</option>`;
    })
    .join('');
}

function isRelaxedProperNameMode(mode) {
  return normalizeProperNameMode(mode) !== 'strict';
}


const STRICT_TO_RELAXED_DIGIT_TOKEN = Object.freeze({
  WE: 'WA',
  TE: 'TU',
  LE: 'LU',
  ME: 'MU',
  PE: 'PI'
});

const QUIZ_NANPA_STRICT_DIGIT_TOKENS = new Set(['NI','WE','TE','SE','NA','LE','NU','ME','PE','JE']);
const QUIZ_NANPA_RELAXED_DIGIT_TOKENS = new Set(['WA','TU','LU','MU','PI']);
const QUIZ_NANPA_DIGIT_TOKENS = new Set([...QUIZ_NANPA_STRICT_DIGIT_TOKENS, ...QUIZ_NANPA_RELAXED_DIGIT_TOKENS]);
const QUIZ_NANPA_TOKEN_PREFIXES = ['KEKEKE','KEKE','KO','KE','NONONO','NONO','NOKO','OK','NE','NO'];

function tokenizeNanpaCapsForQuiz(caps) {
  const s = String(caps ?? '').trim().toUpperCase();
  if (!s || !s.startsWith('NE') || !s.endsWith('N')) throw new Error(`Invalid nanpa caps: ${caps}`);

  const tokens = [];
  let i = 0;
  const end = s.length;

  while (i < end - 1) {
    let matched = null;
    for (const pref of QUIZ_NANPA_TOKEN_PREFIXES) {
      if (s.startsWith(pref, i)) { matched = pref; break; }
    }
    if (matched != null) {
      tokens.push(matched);
      i += matched.length;
      continue;
    }

    if (i + 2 <= end - 1) {
      const two = s.slice(i, i + 2);
      if (QUIZ_NANPA_DIGIT_TOKENS.has(two)) {
        tokens.push(two);
        i += 2;
        continue;
      }
    }

    throw new Error(`Invalid nanpa caps token at position ${i}: ${caps}`);
  }

  tokens.push('N');
  return tokens;
}

function capsForProperNameMode(caps, mode) {
  const normalizedMode = normalizeProperNameMode(mode);
  if (normalizedMode === 'strict') return String(caps ?? '').trim().toUpperCase();

  const tokens = tokenizeNanpaCapsForQuiz(caps);
  const out = tokens.map(t => STRICT_TO_RELAXED_DIGIT_TOKEN[t] || t);
  return out.join('');
}

function formatCommas(n) {
  return Number(n).toLocaleString('en-US');
}

function normalizeMinus(s) {
  return String(s ?? '').replace(/[\u2010\u2011\u2012\u2013\u2014\u2212\uFE63\uFF0D]/g, '-');
}

function normalizeOuter(s) {
  return normalizeMinus(s).trim();
}

function normalizeCommasOptional(s) {
  return normalizeOuter(s).replace(/,/g, '');
}

function normalizeScientific(s) {
  return normalizeOuter(s).replace(/\s+/g, '').replace(/E/g, 'e');
}

function normalizeProperNameAnswer(s) {
  return normalizeOuter(s)
    .replace(/\s+/g, '')
    .toLowerCase();
}

function properNameMatches(rawAnswer, properName) {
  const actual = normalizeProperNameAnswer(rawAnswer);
  const expected = normalizeProperNameAnswer(properName);
  return !!actual && actual === expected;
}


function titleCaseNanpaProperNameForDisplay(nameStr) {
  const s = String(nameStr ?? '').trim();
  if (!s) return s;
  return s
    .split(/\s+/)
    .filter(Boolean)
    .map(word => {
      const lower = word.toLowerCase();
      return lower.length <= 1 ? lower.toUpperCase() : lower[0].toUpperCase() + lower.slice(1);
    })
    .join(' ');
}

function fixOkenSuffixSpacing(s) {
  const x = String(s ?? '');
  if (/\sOken$/.test(x) || /\soken$/.test(x)) return x;
  return x.replace(/Oken$/, ' Oken').replace(/oken$/, ' Oken');
}

function formatProperNameForDisplay(properName) {
  // Match the renderer page display convention: use the parser's spaced
  // proper-name form, title-case each word, and preserve numeric punctuation
  // boundaries such as One / Ono / Oko / Eke / Eko / Ene as separate words.
  return fixOkenSuffixSpacing(titleCaseNanpaProperNameForDisplay(properName));
}

function dayCountForMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

function makeQuizItems(properNameMode = getCurrentProperNameMode()) {
  const fractionChoices = [
    ['1/2', 1, 2], ['1/3', 1, 3], ['2/3', 2, 3],
    ['1/4', 1, 4], ['3/4', 3, 4], ['1/5', 1, 5],
    ['2/5', 2, 5], ['3/5', 3, 5], ['4/5', 4, 5],
    ['1/8', 1, 8], ['3/8', 3, 8], ['5/8', 5, 8], ['7/8', 7, 8]
  ];

  const singleDigit = String(randInt(0, 9));

  const decimalWhole = randInt(0, 99);
  const decimalFrac = String(randInt(1, 99)).padStart(2, '0');
  const decimal = `${decimalWhole}.${decimalFrac}`;

  const negative = `-${randInt(1, 999)}`;

  const thousands = formatCommas(randInt(1000, 999999));
  const millions = formatCommas(randInt(1000000, 99999999));

  const percent = Math.random() < 0.5
    ? `${randInt(1, 99)}%`
    : `${randInt(1, 99)}.${randInt(1, 9)}%`;

  const fraction = choice(fractionChoices)[0];
  const mixedFraction = `${randInt(1, 12)}+${choice(fractionChoices)[0]}`;

  const mantissa = `${randInt(1, 9)}.${randInt(1, 9)}`;
  let exponent = randInt(-6, 6);
  if (exponent === 0) exponent = 3;
  const scientific = `${mantissa}e${exponent}`;

  const time = `${pad2(randInt(0, 23))}:${pad2(randInt(0, 59))}`;

  const year = randInt(2024, 2031);
  const month = randInt(1, 12);
  const day = randInt(1, dayCountForMonth(year, month));
  const isoDate = `${year}-${pad2(month)}-${pad2(day)}`;

  return shuffle([
    item('single-digit-integer', singleDigit, singleDigit, 'exact', properNameMode),
    item('decimal', decimal, decimal, 'exact', properNameMode),
    item('negative', negative, negative, 'exact', properNameMode),
    item('thousands', thousands, thousands, 'commasOptional', properNameMode),
    item('millions', millions, millions, 'commasOptional', properNameMode),
    item('percent', percent, percent, 'exact', properNameMode),
    item('fraction', fraction, fraction, 'exact', properNameMode),
    item('integer-and-fraction', mixedFraction, mixedFraction, 'exact', properNameMode),
    item('scientific-notation', scientific, scientific, 'scientific', properNameMode),
    item('hh-mm-time', time, time, 'exact', properNameMode),
    item('iso-date', isoDate, isoDate, 'exact', properNameMode)
  ]);
}

function item(kind, parserInput, displayValue, answerMode, properNameMode = getCurrentProperNameMode()) {
  return {
    id: `${kind}-${Math.random().toString(36).slice(2)}`,
    kind,
    parserInput,
    displayValue,
    answer: displayValue,
    answerMode,
    properNameMode: normalizeProperNameMode(properNameMode),
    checkedOnce: false,
    parsedPromise: null
  };
}

async function getNanpaParser() {
  if (!nanpaModulePromise) {
    nanpaModulePromise = import('./renderer-fontuploads-renderer-preview-bottom-detect-final-fixed.js?v=175');
  }
  const mod = await nanpaModulePromise;
  return mod.NanpaParser;
}

async function getVoice() {
  if (!voicePromise) {
    voicePromise = import('./toki-pona-voice-api.js?v=25').then(m => m.createTokiPonaVoice());
  }
  return voicePromise;
}

async function ensureParsed(item) {
  if (!item.parsedPromise) {
    item.parsedPromise = (async () => {
      const NanpaParser = await getNanpaParser();
      const properNameMode = normalizeProperNameMode(item.properNameMode ?? getCurrentProperNameMode());
      const strictParsed = NanpaParser.parseNumber(item.parserInput, {
        mode: 'uniform',
        mixedStyle: 'short'
      });
      if (!strictParsed || !strictParsed.properName || !strictParsed.caps) {
        throw new Error(`Could not encode quiz value: ${item.parserInput}`);
      }

      let quizCaps = strictParsed.caps;
      let quizProperName = strictParsed.properName;
      let quizParsed = strictParsed;

      if (isRelaxedProperNameMode(properNameMode)) {
        quizCaps = capsForProperNameMode(strictParsed.caps, properNameMode);
        quizProperName = NanpaParser.splitCapsToProperName(quizCaps, {
          titleCase: true,
          relaxedNanpaLinjanParsing: true
        });
        // Build the cartouche directly from the stored quiz caps. Do not
        // re-parse the spaced proper-name string here: separators such as Ono
        // for fractions, Eke for time/date, and Eko for scientific notation are
        // valid inside nanpa-linja-n caps but are not all accepted by the simple
        // parseNumber(properName) path.
        const parsedRelaxedCaps = NanpaParser.capsToCodepoints(quizCaps, {
          mode: 'uniform',
          mixedStyle: 'short',
          relaxedNanpaLinjanParsing: true,
          relaxedNanpaLinjanRendering: true
        });

        if (!parsedRelaxedCaps || !(parsedRelaxedCaps.innerCodepoints?.length || parsedRelaxedCaps.codepoints?.length)) {
          throw new Error(`Could not encode relaxed quiz value: ${item.parserInput}`);
        }

        quizParsed = {
          ...parsedRelaxedCaps,
          caps: quizCaps,
          properName: quizProperName,
          uniqueCode: strictParsed.uniqueCode,
          ucsurCodepoints: Array.from(parsedRelaxedCaps.innerCodepoints ?? []),
          tpWords: Array.from(parsedRelaxedCaps.words ?? []),
          words: Array.from(parsedRelaxedCaps.words ?? [])
        };
      }

      return {
        ...strictParsed,
        strictParsed,
        quizParsed,
        properName: strictParsed.properName,
        quizProperName,
        quizCaps,
        properNameMode
      };
    })();
  }
  return item.parsedPromise;
}

function valueAnswerMatches(item, rawAnswer) {
  const actual = rawAnswer ?? '';
  const expected = item.answer;

  if (item.answerMode === 'commasOptional') {
    return normalizeCommasOptional(actual) === normalizeCommasOptional(expected);
  }

  if (item.answerMode === 'scientific') {
    return normalizeScientific(actual) === normalizeScientific(expected);
  }

  return normalizeOuter(actual) === normalizeOuter(expected);
}

async function answerMatches(item, rawAnswer) {
  if (valueAnswerMatches(item, rawAnswer)) return true;

  const parsed = await ensureParsed(item);
  if (properNameMatches(rawAnswer, parsed.strictParsed?.properName ?? parsed.properName)) return true;
  if (isRelaxedProperNameMode(parsed.properNameMode)) {
    return properNameMatches(rawAnswer, parsed.quizProperName);
  }
  return false;
}

function allItemsChecked() {
  return quizItems.length > 0 && quizItems.every(x => x.checkedOnce);
}

function updateTryMoreVisibility(root) {
  const tryMore = root.querySelector('[data-quiz-try-more]');
  if (!tryMore) return;
  tryMore.hidden = !allItemsChecked();
}

async function ensureCartoucheFontLoaded() {
  if (!document.fonts || !document.fonts.load) return;
  const sample = String.fromCodePoint(0xF193D);
  await document.fonts.load(`24px "${FONT_FAMILY}"`, sample);
  await document.fonts.ready;
}

function getQuarterCodepointsSet() {
  return new Set([
    0xF193D, // nanpa
    0xF1940, // nena
    0xF1941, // ni
    0xF193E, // nasa
    0xF1909, // e
    0xF190B, // esun
    0xF190A, // en
    0xF1947, // open
    0xF1902, // ala (relaxed small glyph)
    0xF190D, // ike (relaxed small glyph)
    0xF1970  // uta (relaxed small glyph)
  ]);
}

function getOneThirdsCodepointsSet() {
  return new Set([0xF1917]); // kasi
}

function getHalfCodepointsSet() {
  return new Set([0xF1914]); // kala
}

function getTwoThirdsCodepointsSet() {
  return new Set([
    0xF1946, // ona
    0xF1944, // o
    0xF191F  // kulupu
  ]);
}

function getVerticalOffsetForCartoucheCodepoint(cp, px) {
  if (cp === 0xF1917) return -Math.round(px * 0.22); // kasi
  return 0;
}

function drawRoundedRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function abbreviateNumericCartoucheCps(cps) {
  const input = Array.from(cps ?? []).map(cp => Number(cp));
  if (!input.length) return input;

  const out = [];
  let keptFirstNanpa = false;

  for (let i = 0; i < input.length; i++) {
    const cp = input[i];
    const isFinalNanpa = (cp === ABBREV_CP_NANPA && i === input.length - 1);

    if (!keptFirstNanpa) {
      out.push(cp);
      if (cp === ABBREV_CP_NANPA) keptFirstNanpa = true;
      continue;
    }

    if (isFinalNanpa) {
      out.push(cp);
      continue;
    }

    if (ABBREV_DROP_AFTER_FIRST_NANPA.has(cp)) continue;
    out.push(cp);
  }

  return out;
}

function renderCartoucheToCanvas(canvas, codepoints, largePx = LARGE_TINY_FONT_SIZE, smallPx = SMALL_TINY_FONT_SIZE, options = CARTOUCHE_RENDER_OPTS) {
  const pad = options.padding ?? 8;
  const border = options.border ?? 1;
  const corner = options.cornerRadius ?? 10;
  const letterGap = options.letterGap ?? 2;

  const oneThirdSet = getOneThirdsCodepointsSet();
  const quarterSet = getQuarterCodepointsSet();
  const halfSet = getHalfCodepointsSet();
  const twoThirdsSet = getTwoThirdsCodepointsSet();

  const ctx = canvas.getContext('2d');
  ctx.textBaseline = 'alphabetic';

  const glyphRuns = [];
  let totalWidth = 0;
  let maxAscent = 0;
  let maxDescent = 0;

  for (const cp of Array.from(codepoints ?? [])) {
    const ch = String.fromCodePoint(cp);
    const px =
      oneThirdSet.has(cp) ? Math.max(1, Math.round(largePx / 3)) :
      quarterSet.has(cp) ? smallPx :
      halfSet.has(cp) ? Math.max(1, Math.round(largePx * 0.5)) :
      twoThirdsSet.has(cp) ? Math.max(1, Math.round(largePx * (2 / 3))) :
      largePx;

    ctx.font = `${px}px "${FONT_FAMILY}"`;
    const m = ctx.measureText(ch);
    const ascent = m.actualBoundingBoxAscent ?? Math.ceil(px * 0.8);
    const descent = m.actualBoundingBoxDescent ?? Math.ceil(px * 0.2);
    const left = m.actualBoundingBoxLeft ?? 0;
    const right = m.actualBoundingBoxRight ?? Math.ceil(m.width);
    const tightW = Math.ceil(left + right);
    const yOffset = getVerticalOffsetForCartoucheCodepoint(cp, largePx);

    glyphRuns.push({ ch, px, tightW, left, ascent, descent, yOffset });
    totalWidth += tightW + letterGap;

    maxAscent = Math.max(maxAscent, ascent + Math.max(0, -yOffset));
    maxDescent = Math.max(maxDescent, descent + Math.max(0, yOffset));
  }

  if (glyphRuns.length > 0) totalWidth -= letterGap;

  const textHeight = Math.ceil(maxAscent + maxDescent);
  const cartW = Math.ceil(totalWidth + pad * 2);
  const cartH = Math.ceil(textHeight + pad * 2);

  canvas.width = cartW + border * 2;
  canvas.height = cartH + border * 2;

  const ctx2 = canvas.getContext('2d');
  ctx2.textBaseline = 'alphabetic';
  ctx2.clearRect(0, 0, canvas.width, canvas.height);

  drawRoundedRect(ctx2, border, border, cartW, cartH, corner);
  ctx2.lineWidth = border;
  ctx2.strokeStyle = '#111';
  ctx2.stroke();

  const baselineY = border + pad + maxAscent;
  let x = border + pad;

  ctx2.fillStyle = '#111';
  for (const g of glyphRuns) {
    ctx2.font = `${g.px}px "${FONT_FAMILY}"`;
    ctx2.fillText(g.ch, x + (g.left ?? 0), baselineY + (g.yOffset ?? 0));
    x += g.tightW + letterGap;
  }
}

function rowForItem(item) {
  const row = document.createElement('div');
  row.className = 'nanpaListenQuizItem';
  row.dataset.quizItemId = item.id;

  row.innerHTML = `
    <div class="nanpaListenQuizControls">
      <button class="audio-button nanpaListenQuizAudio" type="button" title="Play audio" aria-label="Play audio">🤖🔊</button>
      <input class="mono nanpaListenQuizGuess" type="text" inputmode="text" autocomplete="off" spellcheck="false" aria-label="Your decimal value or nanpa-linja-n proper-name guess" placeholder="enter the decimal value" />
      <button class="nanpaListenQuizCheck" type="button">Check</button>
      <button class="nanpaListenQuizRevealButton" type="button" hidden>Reveal</button>
    </div>
    <div class="nanpaListenQuizFeedback" role="status" aria-live="polite"></div>
    <div class="nanpaListenQuizReveal" hidden>
      <div class="nanpaListenQuizLine"><strong>Value:</strong> <span class="mono" data-quiz-value></span></div>
      <div class="nanpaListenQuizLine"><strong>nanpa-linja-n proper name:</strong> <span class="mono" data-quiz-proper-name></span></div>
      <div class="nanpaListenQuizLine" data-quiz-relaxed-proper-name-line hidden><strong>relaxed nanpa-linja-n proper name:</strong> <span class="mono" data-quiz-relaxed-proper-name></span></div>
      <div class="nanpaListenQuizLine"><strong>nanpa-linja-n cartouche:</strong><canvas data-quiz-cartouche-normal aria-hidden="true"></canvas></div>
      <div class="nanpaListenQuizLine"><strong>nanpa-linja-n abbreviated cartouche:</strong><canvas data-quiz-cartouche-abbrev aria-hidden="true"></canvas></div>
      <div class="nanpaListenQuizLine"><strong>#~ abbreviation:</strong> <span class="mono" data-quiz-code></span></div>
    </div>
  `;

  row.querySelector('.nanpaListenQuizAudio')?.addEventListener('click', () => playItemAudio(item, row));
  row.querySelector('.nanpaListenQuizCheck')?.addEventListener('click', () => checkItem(item, row));
  row.querySelector('.nanpaListenQuizRevealButton')?.addEventListener('click', () => revealItem(item, row));
  row.querySelector('.nanpaListenQuizGuess')?.addEventListener('keydown', async event => {
    if (event.key === 'Enter' && !event.altKey && !event.ctrlKey && !event.metaKey) {
      event.preventDefault();

      const input = event.currentTarget;
      const isBlank = !String(input?.value ?? '').trim();

      if (isBlank) {
        await playItemAudio(item, row);
        return;
      }

      await checkItem(item, row);
    }
  });

  return row;
}

async function playItemAudio(item, row) {
  const button = row.querySelector('.nanpaListenQuizAudio');
  try {
    if (button) button.disabled = true;
    const parsed = await ensureParsed(item);
    const voice = await getVoice();
    await voice.play(parsed.quizProperName || parsed.properName, {
      synthesis_mode: 'reference_audio',
      pauseScale: getCurrentAudioPauseScale(),
      syllableGapSeconds: getCurrentAudioSyllableGapSeconds()
    });
  } catch (err) {
    setFeedback(row, `Audio error: ${err?.message ?? String(err)}`, 'bad');
  } finally {
    if (button) button.disabled = false;
  }
}

function setFeedback(row, text, kind = '') {
  const el = row.querySelector('.nanpaListenQuizFeedback');
  if (!el) return;
  el.className = `nanpaListenQuizFeedback ${kind ? `nanpaListenQuizFeedback--${kind}` : ''}`.trim();
  el.textContent = text;
}

async function checkItem(item, row) {
  const input = row.querySelector('.nanpaListenQuizGuess');
  const revealButton = row.querySelector('.nanpaListenQuizRevealButton');
  const ok = await answerMatches(item, input?.value ?? '');
  item.checkedOnce = true;

  if (ok) {
    setFeedback(row, '✓ Correct', 'good');
    if (input) input.disabled = true;
    const checkButton = row.querySelector('.nanpaListenQuizCheck');
    if (checkButton) checkButton.disabled = true;
    if (revealButton) revealButton.hidden = true;
    await revealItem(item, row);
  } else {
    setFeedback(row, 'Not quite. Try again, or reveal the answer.', 'bad');
    if (revealButton) revealButton.hidden = false;
  }

  const root = document.getElementById(QUIZ_ROOT_ID);
  if (root) updateTryMoreVisibility(root);
}

async function revealItem(item, row) {
  try {
    const parsed = await ensureParsed(item);
    const reveal = row.querySelector('.nanpaListenQuizReveal');
    const valueEl = row.querySelector('[data-quiz-value]');
    const properNameEl = row.querySelector('[data-quiz-proper-name]');
    const relaxedProperNameLine = row.querySelector('[data-quiz-relaxed-proper-name-line]');
    const relaxedProperNameEl = row.querySelector('[data-quiz-relaxed-proper-name]');
    const codeEl = row.querySelector('[data-quiz-code]');
    const normalCanvas = row.querySelector('[data-quiz-cartouche-normal]');
    const abbrevCanvas = row.querySelector('[data-quiz-cartouche-abbrev]');
    const strictParsed = parsed.strictParsed ?? parsed;
    const quizParsed = parsed.quizParsed ?? parsed;

    if (valueEl) valueEl.textContent = item.displayValue;
    if (properNameEl) properNameEl.textContent = formatProperNameForDisplay(strictParsed.properName);
    if (relaxedProperNameLine) relaxedProperNameLine.hidden = !isRelaxedProperNameMode(parsed.properNameMode);
    if (relaxedProperNameEl) relaxedProperNameEl.textContent = formatProperNameForDisplay(parsed.quizProperName);
    if (codeEl) codeEl.textContent = String(strictParsed.uniqueCode ?? parsed.uniqueCode ?? '');

    await ensureCartoucheFontLoaded();
    if (normalCanvas) renderCartoucheToCanvas(normalCanvas, quizParsed.ucsurCodepoints);
    if (abbrevCanvas) renderCartoucheToCanvas(abbrevCanvas, abbreviateNumericCartoucheCps(quizParsed.ucsurCodepoints));

    if (reveal) reveal.hidden = false;
  } catch (err) {
    setFeedback(row, `Reveal error: ${err?.message ?? String(err)}`, 'bad');
  }
}

function renderQuiz(root) {
  const properNameMode = storedProperNameMode();
  quizItems = makeQuizItems(properNameMode);

  const rows = document.createElement('div');
  rows.className = 'nanpaListenQuizRows';
  for (const item of quizItems) rows.appendChild(rowForItem(item));

  const audioPauseScale = storedAudioPauseScale();
  root.innerHTML = `
    <hr class="miniDivider"/>
    <h1 style="margin:0 0 6px;font-size:18px;">
      Listen and guess the decimal number
      <span class="tpLine">o kute, o alasa sona e nanpa</span>
    </h1>
    <div class="help">
      Press an audio button as many times as you like, enter the decimal value or nanpa-linja-n proper name you hear, then check your answer.
      <span class="tpLine">o kute mute la sina ken. o pana e nanpa anu nimi pi nanpa-linja-n la o lukin e pona.</span>
    </div>
    <div class="nanpaListenQuizAudioSettings" role="group" aria-label="Nanpa-linja-n mode and audio settings">
      <label for="nanpaListenQuizProperNameMode">nanpa-linja-n mode</label>
      <select id="nanpaListenQuizProperNameMode" data-quiz-proper-name-mode>
        ${properNameModeOptionsHtml(properNameMode)}
      </select>
      <label for="nanpaListenQuizAudioPauseScale">Audio speed</label>
      <select id="nanpaListenQuizAudioPauseScale" data-quiz-audio-pause-scale>
        ${audioPauseScaleOptionsHtml(audioPauseScale)}
      </select>
      <span class="help">Normal adds a small 0.2 s gap between assembled syllable units. Slow and Very slow add longer calculated silence; they do not stretch or slur the audio.</span>
    </div>
  `;

  root.querySelector('[data-quiz-proper-name-mode]')?.addEventListener('change', event => {
    saveProperNameMode(event.currentTarget.value);
    renderQuiz(root);
  });

  root.querySelector('[data-quiz-audio-pause-scale]')?.addEventListener('change', event => {
    saveAudioPauseScale(event.currentTarget.value);
  });

  root.appendChild(rows);

  const tryMoreWrap = document.createElement('div');
  tryMoreWrap.className = 'nanpaListenQuizTryMoreWrap';
  tryMoreWrap.innerHTML = `
    <button data-quiz-try-more type="button" hidden>
      Try more
      <span class="tpLine">o alasa sin</span>
    </button>
  `;
  tryMoreWrap.querySelector('[data-quiz-try-more]')?.addEventListener('click', () => renderQuiz(root));
  root.appendChild(tryMoreWrap);
}

function initQuiz() {
  const root = document.getElementById(QUIZ_ROOT_ID);
  if (!root) return;
  renderQuiz(root);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initQuiz, { once: true });
} else {
  initQuiz();
}
