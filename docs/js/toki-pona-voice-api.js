import { NanpaParser } from './renderer-fontuploads-renderer-preview-bottom-detect-final-fixed.js';
import { REFERENCE_AUDIO_MANIFEST } from './audio-manifest.js';

export { NanpaParser, REFERENCE_AUDIO_MANIFEST };

export const DEFAULT_CARTOUCHE_DB = Object.freeze({
  'San_Pan': 'San Pan',
  'Ate_Nemen': 'Ate Nemen',
  'Amelika_Nemen': 'Amelika Nemen'
});

export const DEFAULT_VOICE_OPTIONS = Object.freeze({
  voice: 'neutral',
  speed: 1.0,
  pitch: 1.0,
  mode: 'debug',
  synthesis_mode: 'reference_audio',
  sample_rate: 48000,
  pauseScale: 1.0
});

const TP_CONS = new Set(['p','t','k','m','n','s','w','l','j']);
const TP_VOWS = new Set(['a','e','i','o','u']);

function normalizeUrlBase(base) {
  const s = String(base || '');
  return s.endsWith('/') ? s : s + '/';
}

function normalizeOptions(options = {}, sampleRate = 48000) {
  return {
    ...DEFAULT_VOICE_OPTIONS,
    ...options,
    sample_rate: Number(options.sample_rate || sampleRate || DEFAULT_VOICE_OPTIONS.sample_rate),
    speed: Number(options.speed ?? DEFAULT_VOICE_OPTIONS.speed),
    pitch: Number(options.pitch ?? DEFAULT_VOICE_OPTIONS.pitch),
    pauseScale: normalizePauseScale(options.pauseScale ?? DEFAULT_VOICE_OPTIONS.pauseScale)
  };
}


function normalizePauseScale(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return DEFAULT_VOICE_OPTIONS.pauseScale;
  return Math.min(6.0, Math.max(0.5, n));
}

function scaledPauseSeconds(seconds, opts = {}) {
  const speed = Math.max(0.3, Number(opts.speed || 1));
  const pauseScale = normalizePauseScale(opts.pauseScale ?? DEFAULT_VOICE_OPTIONS.pauseScale);
  return Math.max(0, Number(seconds || 0)) * pauseScale / speed;
}

function parseCartoucheDbValue(value) {
  if (value == null) return {};
  if (typeof value === 'string') {
    const raw = value.trim();
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('cartoucheDb must be a JSON object');
    return parsed;
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('cartoucheDb must be an object');
  return value;
}

function isWordChar(ch) { return /[A-Za-z']/u.test(ch); }
function isCapitalized(w) { return /^[A-Z]/.test(String(w || '')); }
function normalizedTpWord(w) { return String(w || '').replace(/'/g, '').toLowerCase(); }
function isTpLetter(ch) { return TP_CONS.has(ch) || TP_VOWS.has(ch); }

export function syllabifyTpWord(word) {
  const w = normalizedTpWord(word);
  if (w === 'n') return ['n'];
  const out = [];
  let i = 0;
  while (i < w.length) {
    let onset = '';
    if (TP_CONS.has(w[i])) {
      if (i + 1 < w.length && TP_VOWS.has(w[i + 1])) {
        onset = w[i];
        i += 1;
      } else {
        return [];
      }
    }
    if (i >= w.length || !TP_VOWS.has(w[i])) return [];
    const vowel = w[i];
    i += 1;
    let coda = '';
    if (i < w.length && w[i] === 'n') {
      const next = i + 1 < w.length ? w[i + 1] : '';
      if (!next || TP_CONS.has(next)) {
        coda = 'n';
        i += 1;
      }
    }
    out.push(onset + vowel + coda);
  }
  return out;
}

export function isValidTpWordShape(word) {
  const w = normalizedTpWord(word);
  if (w === 'n') return true;
  if (!w || [...w].some(c => !isTpLetter(c))) return false;
  return syllabifyTpWord(w).length > 0;
}

export function lexSpeechText(s) {
  const out = [];
  const text = String(s || '');
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch === '\n') { out.push({ kind: 'line_break', text: ch }); i += 1; continue; }
    if (/\s/.test(ch)) { i += 1; continue; }
    if (isWordChar(ch)) {
      let j = i + 1;
      while (j < text.length && isWordChar(text[j])) j += 1;
      out.push({ kind: 'word', text: text.slice(i, j) });
      i = j;
      continue;
    }
    if (/[.,!?;:]/.test(ch)) out.push({ kind: 'punctuation', text: ch });
    i += 1;
  }
  return out;
}

function punctuationPauseSeconds(p) {
  if (p === '?') return 0.30;
  if (p === '.' || p === '!') return 0.32;
  if (p === ',' || p === ';' || p === ':') return 0.18;
  return 0.12;
}

const NANPA_PROPER_NAME_BOUNDARY_WORDS = new Set([
  'one', 'ono', 'oko', 'eke', 'eko', 'ene', 'oken'
]);

function properNameWordPauseSeconds(currentWord, nextWord) {
  const current = normalizedTpWord(currentWord);
  const next = normalizedTpWord(nextWord);

  // Make the quiz speed control audible by giving numeric punctuation
  // boundaries a real pause. The recorded units are still played at
  // normal speed; only silence between units changes.
  if (NANPA_PROPER_NAME_BOUNDARY_WORDS.has(current) || NANPA_PROPER_NAME_BOUNDARY_WORDS.has(next)) {
    return 0.14;
  }

  return 0.075;
}

function gapSamples(seconds, sampleRate) {
  return new Float32Array(Math.max(0, Math.round(seconds * sampleRate)));
}

function monoFromAudioBuffer(buffer) {
  if (buffer.numberOfChannels === 1) return new Float32Array(buffer.getChannelData(0));
  const n = buffer.length;
  const out = new Float32Array(n);
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < n; i++) out[i] += data[i] / buffer.numberOfChannels;
  }
  return out;
}

function crossfadeAppend(out, next, fadeSamples = 256) {
  if (!next || !next.length) return out;
  if (!out.length || fadeSamples <= 0) {
    const merged = new Float32Array(out.length + next.length);
    merged.set(out, 0);
    merged.set(next, out.length);
    return merged;
  }
  const n = Math.min(fadeSamples, out.length, next.length);
  const merged = new Float32Array(out.length + next.length - n);
  merged.set(out.slice(0, out.length - n), 0);
  const start = out.length - n;
  for (let i = 0; i < n; i++) {
    const a = i / Math.max(1, n - 1);
    merged[start + i] = out[out.length - n + i] * (1 - a) + next[i] * a;
  }
  merged.set(next.slice(n), out.length);
  return merged;
}

function normalizePeak(samples, peak = 0.95) {
  let max = 0;
  for (const s of samples) max = Math.max(max, Math.abs(s));
  if (max > 0.0001) {
    const g = peak / max;
    for (let i = 0; i < samples.length; i++) samples[i] = Math.max(-1, Math.min(1, samples[i] * g));
  }
}

function concatChunks(chunks, sampleRate) {
  let out = new Float32Array(0);
  const fade = Math.round(sampleRate * 0.006);
  for (const c of chunks) {
    if (!c || !c.length) continue;
    out = crossfadeAppend(out, c, fade);
  }
  normalizePeak(out, 0.95);
  return out;
}

function tryNanpaNumberToProperName(fragment) {
  const s = String(fragment || '').trim();
  if (!s) return null;
  const parsed = NanpaParser.parseNumber(s, { mode: 'uniform', mixedStyle: 'short' });
  if (!parsed || !parsed.properName) return null;
  return {
    source: s,
    properName: parsed.properName,
    displayValue: parsed.displayValue || null,
    caps: parsed.caps || null,
    uniqueCode: parsed.uniqueCode || null,
  };
}

function resolveDbToken(raw, db, warnings) {
  const token = String(raw || '');
  const key = token.replace(/@db$/i, '');
  const candidates = [key, key.replace(/_/g, ' '), key.replace(/\s+/g, '_')];
  for (const c of candidates) {
    if (Object.prototype.hasOwnProperty.call(db, c)) return String(db[c]);
  }
  warnings.push({ kind: 'cartouche_db', source: token, message: 'Unresolved cartouche DB reference' });
  return '';
}

function preprocessCartoucheDb(input, db) {
  const warnings = [];
  let text = String(input || '');
  text = text.replace(/\b[A-Za-z][A-Za-z_]*(?:\s+[A-Za-z][A-Za-z_]*)?@db\b/g, (m) => resolveDbToken(m, db, warnings));
  text = text.replace(/\[([^\]\n]+)\]/g, (_, inner) => {
    const s = String(inner || '').trim();
    const parsed = tryNanpaNumberToProperName(s);
    return parsed ? parsed.properName : s;
  });
  return { text, warnings };
}

function preprocessNanpaNumbers(input) {
  const warnings = [];
  const conversions = [];
  const text = String(input || '');
  const patterns = [
    /#~[A-Za-z]+/g,
    /(?:^|(?<![A-Za-z0-9_.]))[+-]?(?:(?:\d[\d, _-]*)(?:\.\d[\d, _-]*)?|(?:\.\d[\d, _-]*))(?:\s*[eE]\s*[+-]?\d+|\s*\*\s*10\s*\^\s*[+-]?\d+|\s*\*\s*10\s*[+-]\d+)(?![A-Za-z0-9_.])/g,
    /\b\d{4}[-/:]\d{2}[-/:]\d{2}\b/g,
    /\b\d{1,2}:[0-5]\d(?::[0-5]\d)?\b/g,
    /(?<![A-Za-z])(?:-?\s*\d+\s*\+\s*\d+\s*\/\s*\d+|-?\s*\d+\s*\/\s*\d+|-?\s*(?:\d[\d, _-]*|\.\d+)(?:\.\d[\d, _-]*)?(?:\s*[kKtTmMbB])?\s*%?)(?![A-Za-z])/g
  ];
  const spans = [];
  for (const re of patterns) {
    for (const match of text.matchAll(re)) {
      const raw0 = match[0];
      if (!raw0 || !raw0.trim()) continue;
      let raw = raw0.trim();
      let offset = raw0.indexOf(raw);
      if (offset < 0) offset = 0;
      const index = match.index + offset;
      raw = raw.replace(/^[^#\d.+\-¼½¾⅐⅑⅒⅓⅔⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞↉]+/, '');
      if (!raw || raw === '-' || raw === '+') continue;
      const parsed = tryNanpaNumberToProperName(raw);
      if (!parsed) continue;
      spans.push({ index, end: index + raw.length, raw, parsed });
    }
  }
  spans.sort((a, b) => a.index - b.index || (b.end - b.index) - (a.end - a.index));
  const chosen = [];
  let lastEnd = -1;
  for (const s of spans) {
    if (s.index < lastEnd) continue;
    chosen.push(s);
    lastEnd = s.end;
  }
  let out = '';
  let pos = 0;
  for (const s of chosen) {
    out += text.slice(pos, s.index);
    out += s.parsed.properName;
    conversions.push({ source: s.raw, properName: s.parsed.properName, displayValue: s.parsed.displayValue, caps: s.parsed.caps, uniqueCode: s.parsed.uniqueCode });
    pos = s.end;
  }
  out += text.slice(pos);
  return { text: out, warnings, conversions };
}

function nanpaUnitKey(s) {
  return String(s || '').replace(/'/g, '').toLowerCase();
}

function nanpaUnitsForWord(word, manifest = REFERENCE_AUDIO_MANIFEST) {
  const bank = manifest.nanpa_units || {};
  const key = nanpaUnitKey(word);
  if (bank[key]) return [key];
  const syls = syllabifyTpWord(key);
  if (!syls.length) return null;
  if (syls.every(sy => bank[sy])) return syls;
  return null;
}

export function analyzeReferenceText(text, options = {}, manifest = REFERENCE_AUDIO_MANIFEST, preprocessWarnings = []) {
  const opts = normalizeOptions(options);
  const lex = lexSpeechText(text);
  const items = [];
  const warnings = [...preprocessWarnings];
  let i = 0;
  while (i < lex.length) {
    const item = lex[i];
    if (item.kind === 'word') {
      if (isCapitalized(item.text) && isValidTpWordShape(item.text)) {
        const words = [];
        const source = [];
        while (i < lex.length && lex[i].kind === 'word' && isCapitalized(lex[i].text) && isValidTpWordShape(lex[i].text)) {
          const w = lex[i].text;
          source.push(w);
          words.push({ text: w, normalized: normalizedTpWord(w), syllables: syllabifyTpWord(w), nanpa_units: nanpaUnitsForWord(w, manifest) });
          i += 1;
        }
        items.push({ kind: 'proper_name_phrase', text: source.join(' '), words });
        continue;
      }
      if (isValidTpWordShape(item.text)) {
        items.push({ kind: 'word', text: item.text, normalized: normalizedTpWord(item.text), syllables: syllabifyTpWord(item.text), nanpa_units: nanpaUnitsForWord(item.text, manifest) });
      } else {
        warnings.push({ kind: 'analysis', source: item.text, message: 'not valid Toki Pona phonotactics' });
      }
    } else if (item.kind === 'punctuation') {
      items.push({ kind: 'punctuation', text: item.text, pause_ms: scaledPauseSeconds(punctuationPauseSeconds(item.text), opts) * 1000 });
    } else if (item.kind === 'line_break') {
      items.push({ kind: 'line_break', pause_ms: scaledPauseSeconds(0.22, opts) * 1000 });
    }
    i += 1;
  }
  return {
    engine_version: 'js-reference-audio-v0.6',
    normalized: text,
    synthesis_mode: opts.synthesis_mode,
    reference_audio: {
      words_available: Object.keys(manifest.words || {}).length,
      syllables_available: Object.keys(manifest.syllables || {}).length,
      nanpa_units_available: Object.keys(manifest.nanpa_units || {}).length,
      sample_rate: manifest.sample_rate || null
    },
    items,
    warnings
  };
}

export function wavBytesFromSamples(samples, sampleRate = 48000) {
  const dataLen = samples.length * 2;
  const bytes = new ArrayBuffer(44 + dataLen);
  const v = new DataView(bytes);
  const writeString = (off, s) => { for (let i = 0; i < s.length; i++) v.setUint8(off + i, s.charCodeAt(i)); };
  writeString(0, 'RIFF');
  v.setUint32(4, 36 + dataLen, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  writeString(36, 'data');
  v.setUint32(40, dataLen, true);
  let off = 44;
  for (let i = 0; i < samples.length; i++, off += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    v.setInt16(off, s < 0 ? s * 32768 : s * 32767, true);
  }
  return new Uint8Array(bytes);
}

function isReferenceMode(mode) {
  return mode === 'reference_audio' || mode === 'reference_words_only' || mode === 'reference_syllables_only';
}

function defaultAudioContextFactory() {
  const Ctor = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!Ctor) throw new Error('AudioContext is not available in this environment');
  return new Ctor();
}

export class TokiPonaVoice {
  constructor(options = {}) {
    this.manifest = options.manifest || REFERENCE_AUDIO_MANIFEST;
    this.audioBaseUrl = normalizeUrlBase(options.audioBaseUrl || new URL('../audio/', import.meta.url).href);
    this.wasmBaseUrl = normalizeUrlBase(options.wasmBaseUrl || new URL('./pkg/', import.meta.url).href);
    this.audioContextFactory = options.audioContextFactory || defaultAudioContextFactory;
    this.audioContext = options.audioContext || null;
    this.audioCache = new Map();
    this.currentSource = null;
    this.wasm = null;
    this.wasmReady = false;
    this.lastResult = null;
    this.defaultCartoucheDb = options.defaultCartoucheDb || DEFAULT_CARTOUCHE_DB;
  }

  getAudioContext() {
    if (!this.audioContext) this.audioContext = this.audioContextFactory();
    return this.audioContext;
  }

  async loadWasmOptional() {
    try {
      const wasmModuleUrl = new URL('toki_pona_voice.js', this.wasmBaseUrl).href;
      const wasm = await import(wasmModuleUrl);
      await wasm.default();
      this.wasm = wasm;
      this.wasmReady = true;
      return { loaded: true, wasm };
    } catch (err) {
      this.wasm = null;
      this.wasmReady = false;
      return { loaded: false, error: err };
    }
  }

  preprocess(input, options = {}) {
    const warnings = [];
    let db;
    try {
      db = parseCartoucheDbValue(options.cartoucheDb ?? this.defaultCartoucheDb);
    } catch (err) {
      db = {};
      warnings.push({ kind: 'cartouche_db_json', source: 'cartoucheDb', message: String(err?.message || err) });
    }
    const dbPass = preprocessCartoucheDb(input, db);
    const nanpaPass = preprocessNanpaNumbers(dbPass.text);
    return {
      speechText: nanpaPass.text,
      warnings: [...warnings, ...dbPass.warnings, ...nanpaPass.warnings],
      conversions: nanpaPass.conversions
    };
  }

  analyze(input, options = {}) {
    const built = options.alreadyPreprocessed
      ? { speechText: String(input || ''), warnings: [], conversions: [] }
      : this.preprocess(input, options);
    const opts = normalizeOptions(options, this.audioContext?.sampleRate || DEFAULT_VOICE_OPTIONS.sample_rate);
    const reference = analyzeReferenceText(built.speechText, opts, this.manifest, built.warnings);
    return { ...built, options: opts, analysis: reference };
  }

  async loadAudioSamples(relPath) {
    const ctx = this.getAudioContext();
    const path = String(relPath || '').replace(/^\.?\/?audio\//, '');
    const url = new URL(path, this.audioBaseUrl).href;
    const key = `${ctx.sampleRate}:${url}`;
    if (this.audioCache.has(key)) return this.audioCache.get(key);
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`Could not load audio asset ${url}: HTTP ${resp.status}`);
    const arr = await resp.arrayBuffer();
    const buffer = await ctx.decodeAudioData(arr.slice(0));
    const samples = monoFromAudioBuffer(buffer);
    this.audioCache.set(key, samples);
    return samples;
  }

  async chunksForNanpaWord(word, warnings) {
    const bank = this.manifest.nanpa_units || {};
    const units = nanpaUnitsForWord(word, this.manifest);
    if (!units) return null;
    const chunks = [];
    for (const u of units) {
      if (!bank[u]) {
        warnings.push({ kind: 'nanpa_audio', source: word, message: `missing nanpa unit ${u}` });
        return null;
      }
      chunks.push(await this.loadAudioSamples(bank[u].file));
    }
    return chunks;
  }

  async unitSamplesForSyllable(sy, warnings) {
    const syllables = this.manifest.syllables || {};
    if (syllables[sy]) return [await this.loadAudioSamples(syllables[sy].file)];
    if (/^[ptkmnswlj]?[aeiou]n$/.test(sy)) {
      const cv = sy.slice(0, -1);
      if (syllables[cv] && syllables.n) {
        warnings.push({ kind: 'reference_audio', source: sy, message: `missing syllable unit; using ${cv}+n composite` });
        return [await this.loadAudioSamples(syllables[cv].file), await this.loadAudioSamples(syllables.n.file)];
      }
    }
    warnings.push({ kind: 'reference_audio', source: sy, message: 'missing syllable unit; Rust fallback may be used' });
    return null;
  }

  async chunksForWord(word, opts, warnings, context = {}) {
    const lower = normalizedTpWord(word);
    const words = this.manifest.words || {};
    const syllables = this.manifest.syllables || {};

    if (context.preferNanpaUnits && opts.synthesis_mode !== 'reference_words_only') {
      const nanpaChunks = await this.chunksForNanpaWord(word, warnings);
      if (nanpaChunks) return nanpaChunks;
    }

    if (opts.synthesis_mode !== 'reference_syllables_only' && words[lower]) {
      return [await this.loadAudioSamples(words[lower].file)];
    }

    const syls = syllabifyTpWord(lower);
    if (!syls.length) {
      warnings.push({ kind: 'reference_audio', source: word, message: 'not valid Toki Pona phonotactics; skipped by reference audio engine' });
      return [];
    }

    const chunks = [];
    for (const sy of syls) {
      if (syllables[sy]) {
        chunks.push(await this.loadAudioSamples(syllables[sy].file));
        continue;
      }
      const composite = await this.unitSamplesForSyllable(sy, warnings);
      if (composite) {
        for (const c of composite) chunks.push(c);
        continue;
      }
      if (this.wasmReady && this.wasm?.synthesize_toki_pona_samples) {
        const rustOpts = { ...opts, sample_rate: this.getAudioContext().sampleRate, synthesis_mode: 'hybrid' };
        const arr = this.wasm.synthesize_toki_pona_samples(word, JSON.stringify(rustOpts));
        chunks.push(new Float32Array(arr));
      }
    }
    return chunks;
  }

  async renderReferenceAudio(speechText, opts, preprocessWarnings = []) {
    const ctx = this.getAudioContext();
    const sampleRate = ctx.sampleRate;
    const warnings = [...preprocessWarnings];
    const chunks = [];
    const lex = lexSpeechText(speechText);
    let i = 0;

    while (i < lex.length) {
      const item = lex[i];
      if (item.kind === 'word') {
        const isProperStart = isCapitalized(item.text) && isValidTpWordShape(item.text);
        const words = [];
        if (isProperStart) {
          while (i < lex.length && lex[i].kind === 'word' && isCapitalized(lex[i].text) && isValidTpWordShape(lex[i].text)) {
            words.push(lex[i].text);
            i += 1;
          }
        } else {
          words.push(item.text);
          i += 1;
        }
        for (let wi = 0; wi < words.length; wi++) {
          const wchunks = await this.chunksForWord(words[wi], opts, warnings, { preferNanpaUnits: isProperStart });
          for (const c of wchunks) chunks.push(c);
          const gap = isProperStart && wi + 1 < words.length
            ? properNameWordPauseSeconds(words[wi], words[wi + 1])
            : 0.055;
          chunks.push(gapSamples(scaledPauseSeconds(gap, opts), sampleRate));
        }
        continue;
      }
      if (item.kind === 'punctuation') chunks.push(gapSamples(scaledPauseSeconds(punctuationPauseSeconds(item.text), opts), sampleRate));
      if (item.kind === 'line_break') chunks.push(gapSamples(scaledPauseSeconds(0.22, opts), sampleRate));
      i += 1;
    }

    const samples = concatChunks(chunks, sampleRate);
    return { samples, sampleRate, warnings };
  }

  async render(input, options = {}) {
    const built = options.alreadyPreprocessed
      ? { speechText: String(input || ''), warnings: [], conversions: [] }
      : this.preprocess(input, options);
    const opts = normalizeOptions(options, this.audioContext?.sampleRate || DEFAULT_VOICE_OPTIONS.sample_rate);

    let samples;
    let sampleRate;
    let renderWarnings = [];

    if (isReferenceMode(opts.synthesis_mode)) {
      const rendered = await this.renderReferenceAudio(built.speechText, opts, built.warnings);
      samples = rendered.samples;
      sampleRate = rendered.sampleRate;
      renderWarnings = rendered.warnings;
    } else {
      if (!this.wasmReady || !this.wasm) {
        throw new Error('WASM is not loaded. Use reference audio mode, or call loadWasmOptional() after building with wasm-pack.');
      }
      const rustOpts = JSON.stringify(opts);
      samples = new Float32Array(this.wasm.synthesize_toki_pona_samples(built.speechText, rustOpts));
      sampleRate = this.wasm.sample_rate_for_options(rustOpts);
    }

    const wavBytes = wavBytesFromSamples(samples, sampleRate);
    const analysis = analyzeReferenceText(built.speechText, opts, this.manifest, renderWarnings);
    const result = {
      input: String(input || ''),
      speechText: built.speechText,
      options: opts,
      conversions: built.conversions,
      warnings: renderWarnings,
      analysis,
      samples,
      sampleRate,
      wavBytes
    };
    this.lastResult = result;
    return result;
  }

  async renderWavBytes(input, options = {}) {
    const result = await this.render(input, options);
    return result.wavBytes;
  }

  async renderWavBlob(input, options = {}) {
    const bytes = await this.renderWavBytes(input, options);
    return new Blob([bytes], { type: 'audio/wav' });
  }

  async play(input, options = {}) {
    const result = await this.render(input, options);
    this.playSamples(result.samples, result.sampleRate);
    return result;
  }

  playSamples(samples, sampleRate) {
    this.stop();
    const ctx = this.getAudioContext();
    const buffer = ctx.createBuffer(1, samples.length, sampleRate);
    buffer.copyToChannel(samples, 0);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start();
    this.currentSource = source;
    return source;
  }

  stop() {
    if (this.currentSource) {
      try { this.currentSource.stop(); } catch (_) {}
      this.currentSource = null;
    }
  }

  clearCache() {
    this.audioCache.clear();
  }
}

export async function createTokiPonaVoice(options = {}) {
  const voice = new TokiPonaVoice(options);
  if (options.loadWasm) await voice.loadWasmOptional();
  return voice;
}
