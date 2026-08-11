"use strict";

export const CROSSWORD_BUILDER_VERSION = 1;
export const CROSSWORD_PUZZLE_FORMAT_VERSION = 1;
export const CROSSWORD_CLUE_BANK_VERSION = 1;

const SIZE = 15;
const VALID_ANSWER_RE = /^[AEIJKLMNOPSTUW]{3,15}$/;
const BASE_DIFFICULTY_WEIGHTS = [0.13, 0.22, 0.30, 0.22, 0.13];

function mulberry32(seed) {
  let a = seed >>> 0;
  return function rand() {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomSeed() {
  try {
    const a = new Uint32Array(1);
    crypto.getRandomValues(a);
    return a[0] >>> 0;
  } catch {
    return ((Date.now() ^ Math.floor(Math.random() * 0xFFFFFFFF)) >>> 0);
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function buildWordData(countries) {
  const words = [];
  for (const country of countries || []) {
    const answer = String(country?.answer || "").toUpperCase();
    if (!VALID_ANSWER_RE.test(answer)) continue;
    const positionsByLetter = Object.create(null);
    for (let i = 0; i < answer.length; i++) {
      const ch = answer[i];
      (positionsByLetter[ch] ||= []).push(i);
    }
    words.push({
      index: words.length,
      id: String(country.id || ""),
      iso3: String(country.iso3 || ""),
      english: String(country.english || ""),
      tpName: String(country.tpName || ""),
      answer,
      clues: Array.isArray(country.clues) ? country.clues : [],
      positionsByLetter
    });
  }
  return words;
}

function makeState() {
  return {
    chars: Array(SIZE * SIZE).fill(null),
    masks: new Uint8Array(SIZE * SIZE), // 1=A, 2=D, 3=intersection
    placements: [],
    used: new Set(),
    regionCounts: new Uint16Array(9),
    occupied: 0,
    intersections: 0
  };
}

function idx(r, c) { return r * SIZE + c; }
function inBounds(r, c) { return r >= 0 && r < SIZE && c >= 0 && c < SIZE; }
function regionIndex(r, c) { return Math.floor(r / 5) * 3 + Math.floor(c / 5); }

function canPlace(state, word, row, col, dir) {
  const dr = dir === "D" ? 1 : 0;
  const dc = dir === "A" ? 1 : 0;
  const endRow = row + dr * (word.answer.length - 1);
  const endCol = col + dc * (word.answer.length - 1);
  if (!inBounds(row, col) || !inBounds(endRow, endCol)) return null;

  const beforeRow = row - dr;
  const beforeCol = col - dc;
  const afterRow = endRow + dr;
  const afterCol = endCol + dc;
  if (inBounds(beforeRow, beforeCol) && state.chars[idx(beforeRow, beforeCol)] !== null) return null;
  if (inBounds(afterRow, afterCol) && state.chars[idx(afterRow, afterCol)] !== null) return null;

  const dirMask = dir === "A" ? 1 : 2;
  let crossings = 0;
  let newCells = 0;
  let sparseBonus = 0;
  let outwardBonus = 0;
  let symmetryBonus = 0;
  const newPositions = [];

  for (let i = 0; i < word.answer.length; i++) {
    const r = row + dr * i;
    const c = col + dc * i;
    const p = idx(r, c);
    const existing = state.chars[p];
    if (existing !== null) {
      if (existing !== word.answer[i]) return null;
      if (state.masks[p] & dirMask) return null;
      crossings++;
      continue;
    }

    if (dir === "A") {
      if (r > 0 && state.chars[idx(r - 1, c)] !== null) return null;
      if (r + 1 < SIZE && state.chars[idx(r + 1, c)] !== null) return null;
    } else {
      if (c > 0 && state.chars[idx(r, c - 1)] !== null) return null;
      if (c + 1 < SIZE && state.chars[idx(r, c + 1)] !== null) return null;
    }

    newCells++;
    newPositions.push(p);
    const ri = regionIndex(r, c);
    sparseBonus += Math.max(0, 14 - state.regionCounts[ri]);
    outwardBonus += Math.abs(r - 7) + Math.abs(c - 7);
    const mirror = idx(SIZE - 1 - r, SIZE - 1 - c);
    if (state.chars[mirror] !== null) symmetryBonus++;
  }

  if (state.placements.length > 0 && crossings === 0) return null;
  if (newCells === 0) return null;
  return { crossings, newCells, newPositions, sparseBonus, outwardBonus, symmetryBonus };
}

function placeWord(state, word, row, col, dir) {
  const dr = dir === "D" ? 1 : 0;
  const dc = dir === "A" ? 1 : 0;
  const dirMask = dir === "A" ? 1 : 2;
  let crossingsAdded = 0;
  for (let i = 0; i < word.answer.length; i++) {
    const r = row + dr * i;
    const c = col + dc * i;
    const p = idx(r, c);
    if (state.chars[p] === null) {
      state.chars[p] = word.answer[i];
      state.masks[p] = dirMask;
      state.occupied++;
      state.regionCounts[regionIndex(r, c)]++;
    } else {
      if (state.masks[p] !== 3) {
        state.masks[p] |= dirMask;
        if (state.masks[p] === 3) {
          state.intersections++;
          crossingsAdded++;
        }
      }
    }
  }
  state.used.add(word.index);
  state.placements.push({ wordIndex: word.index, row, col, dir });
  return crossingsAdded;
}

function largestEmptyRectangle(chars) {
  const heights = new Int16Array(SIZE);
  let best = 0;
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      heights[c] = chars[idx(r, c)] === null ? heights[c] + 1 : 0;
    }
    const stackStart = [];
    const stackHeight = [];
    for (let c = 0; c <= SIZE; c++) {
      const h = c < SIZE ? heights[c] : 0;
      let start = c;
      while (stackHeight.length && stackHeight[stackHeight.length - 1] > h) {
        const hh = stackHeight.pop();
        const ss = stackStart.pop();
        best = Math.max(best, hh * (c - ss));
        start = ss;
      }
      if (!stackHeight.length || stackHeight[stackHeight.length - 1] < h) {
        stackStart.push(start);
        stackHeight.push(h);
      }
    }
  }
  return best;
}

function evaluateState(state) {
  if (!state.placements.length) return null;
  let minRow = SIZE, minCol = SIZE, maxRow = -1, maxCol = -1;
  let symmetryMatches = 0;
  let acrossCount = 0, downCount = 0;
  let oneCrossingEntries = 0;

  for (const placement of state.placements) {
    if (placement.dir === "A") acrossCount++; else downCount++;
    const dr = placement.dir === "D" ? 1 : 0;
    const dc = placement.dir === "A" ? 1 : 0;
    let crosses = 0;
    // Count actual intersection cells belonging to this entry.
    // This penalizes thin, singly-attached branches without making them illegal.
    // word length is reconstructed from occupied sequence until the placement end later.
    const wordLen = placement._len || 0;
    if (wordLen) {
      for (let i = 0; i < wordLen; i++) {
        if (state.masks[idx(placement.row + dr * i, placement.col + dc * i)] === 3) crosses++;
      }
      if (crosses <= 1) oneCrossingEntries++;
    }
  }

  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const p = idx(r, c);
      if (state.chars[p] !== null) {
        minRow = Math.min(minRow, r);
        maxRow = Math.max(maxRow, r);
        minCol = Math.min(minCol, c);
        maxCol = Math.max(maxCol, c);
      }
      const mirrorOccupied = state.chars[idx(SIZE - 1 - r, SIZE - 1 - c)] !== null;
      if ((state.chars[p] !== null) === mirrorOccupied) symmetryMatches++;
    }
  }

  const spanRows = maxRow - minRow + 1;
  const spanCols = maxCol - minCol + 1;
  const regionCounts = Array.from(state.regionCounts);
  const minRegion = Math.min(...regionCounts);
  const maxRegion = Math.max(...regionCounts);
  const regionMean = regionCounts.reduce((a, b) => a + b, 0) / regionCounts.length;
  const regionVariance = regionCounts.reduce((s, x) => s + (x - regionMean) ** 2, 0) / regionCounts.length;
  const regionStdDev = Math.sqrt(regionVariance);
  const largestEmptyRect = largestEmptyRectangle(state.chars);
  const symmetry = symmetryMatches / (SIZE * SIZE);
  const balance = Math.abs(acrossCount - downCount);
  const entries = state.placements.length;
  const checkedRatio = state.occupied ? state.intersections / state.occupied : 0;

  const score =
    entries * 34 +
    state.intersections * 15 +
    state.occupied * 1.6 +
    (spanRows + spanCols) * 12 +
    minRegion * 13 -
    regionStdDev * 10 -
    largestEmptyRect * 7 +
    symmetry * 55 -
    balance * 6 -
    oneCrossingEntries * 4 +
    checkedRatio * 100;

  const acceptable =
    entries >= 20 &&
    state.intersections >= 24 &&
    state.occupied >= 98 &&
    spanRows >= 14 &&
    spanCols >= 14 &&
    minRegion >= 7 &&
    largestEmptyRect <= 18 &&
    acrossCount >= 8 &&
    downCount >= 8;

  return {
    score,
    acceptable,
    entries,
    intersections: state.intersections,
    occupiedCells: state.occupied,
    spanRows,
    spanCols,
    regionCounts,
    minRegion,
    maxRegion,
    regionStdDev,
    largestEmptyRect,
    symmetry,
    acrossCount,
    downCount,
    checkedRatio
  };
}

function cloneCandidate(state, metrics, words) {
  return {
    chars: state.chars.slice(),
    masks: Array.from(state.masks),
    placements: state.placements.map(p => ({ ...p, _len: words[p.wordIndex].answer.length })),
    metrics: { ...metrics }
  };
}

function candidatePlacementScore(state, placementInfo, word, rand) {
  const { crossings, newCells, sparseBonus, outwardBonus, symmetryBonus } = placementInfo;
  // Crossing is the strongest local signal. Sparse-region and outward bonuses
  // make the layout spread over the 15x15 board instead of growing a central knot.
  return crossings * 46 +
    newCells * 2.2 +
    sparseBonus * 1.35 +
    outwardBonus * 0.42 +
    symmetryBonus * 1.8 +
    Math.min(11, word.answer.length) * 0.8 +
    rand() * 10;
}

function enumeratePlacements(state, words, wordsByLetter, rand) {
  const seen = new Set();
  const candidates = [];
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const p = idx(r, c);
      const ch = state.chars[p];
      const mask = state.masks[p];
      if (!ch || mask === 3 || mask === 0) continue;
      const newDir = mask === 1 ? "D" : "A";
      const matchingWords = wordsByLetter[ch] || [];
      for (const wordIndex of matchingWords) {
        if (state.used.has(wordIndex)) continue;
        const word = words[wordIndex];
        const positions = word.positionsByLetter[ch] || [];
        for (const letterIndex of positions) {
          const row = r - (newDir === "D" ? letterIndex : 0);
          const col = c - (newDir === "A" ? letterIndex : 0);
          const unique = `${wordIndex}:${row}:${col}:${newDir}`;
          if (seen.has(unique)) continue;
          seen.add(unique);
          const info = canPlace(state, word, row, col, newDir);
          if (!info) continue;
          candidates.push({
            score: candidatePlacementScore(state, info, word, rand),
            wordIndex, row, col, dir: newDir,
            crossings: info.crossings
          });
        }
      }
    }
  }
  candidates.sort((a, b) => b.score - a.score);
  return candidates;
}

function chooseFromTop(candidates, rand) {
  if (!candidates.length) return null;
  const topCount = Math.min(28, candidates.length);
  // Bias toward the best few while keeping enough randomness for independent restarts.
  const rank = Math.min(topCount - 1, Math.floor((rand() ** 2.25) * topCount));
  return candidates[rank];
}

function seedState(state, words, rand) {
  const seedPool = words.filter(w => w.answer.length >= 6 && w.answer.length <= 11);
  const word = seedPool[Math.floor(rand() * seedPool.length)] || words[Math.floor(rand() * words.length)];
  const dir = rand() < 0.5 ? "A" : "D";
  const jitter = () => Math.floor(rand() * 3) - 1;
  let row, col;
  if (dir === "A") {
    row = Math.max(0, Math.min(SIZE - 1, 7 + jitter()));
    col = Math.max(0, Math.min(SIZE - word.answer.length, Math.floor((SIZE - word.answer.length) / 2) + jitter()));
  } else {
    col = Math.max(0, Math.min(SIZE - 1, 7 + jitter()));
    row = Math.max(0, Math.min(SIZE - word.answer.length, Math.floor((SIZE - word.answer.length) / 2) + jitter()));
  }
  placeWord(state, word, row, col, dir);
  state.placements[state.placements.length - 1]._len = word.answer.length;
}

function generateAttempt(words, wordsByLetter, rand, maxEntries = 31) {
  const state = makeState();
  seedState(state, words, rand);
  let bestAcceptable = null;

  for (let step = 0; step < maxEntries - 1; step++) {
    const candidates = enumeratePlacements(state, words, wordsByLetter, rand);
    if (!candidates.length) break;
    const chosen = chooseFromTop(candidates, rand);
    const word = words[chosen.wordIndex];
    placeWord(state, word, chosen.row, chosen.col, chosen.dir);
    state.placements[state.placements.length - 1]._len = word.answer.length;

    if (state.placements.length >= 18) {
      const metrics = evaluateState(state);
      if (metrics?.acceptable && (!bestAcceptable || metrics.score > bestAcceptable.metrics.score)) {
        bestAcceptable = cloneCandidate(state, metrics, words);
      }
    }
  }

  const finalMetrics = evaluateState(state);
  const finalCandidate = finalMetrics ? cloneCandidate(state, finalMetrics, words) : null;
  if (finalMetrics?.acceptable && (!bestAcceptable || finalMetrics.score > bestAcceptable.metrics.score)) {
    bestAcceptable = finalCandidate;
  }
  return { bestAcceptable, finalCandidate };
}

function scanEntriesFromCandidate(candidate, words) {
  const chars = candidate.chars;
  const placementByStart = new Map();
  for (const p of candidate.placements) {
    placementByStart.set(`${p.row},${p.col},${p.dir}`, p);
  }

  const numbers = [];
  const across = [];
  const down = [];
  let nextNumber = 1;
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const p = idx(r, c);
      if (chars[p] === null) continue;
      const startsA = (c === 0 || chars[idx(r, c - 1)] === null) && c + 1 < SIZE && chars[idx(r, c + 1)] !== null;
      const startsD = (r === 0 || chars[idx(r - 1, c)] === null) && r + 1 < SIZE && chars[idx(r + 1, c)] !== null;
      if (!startsA && !startsD) continue;
      const n = nextNumber++;
      numbers.push({ r, c, n });
      if (startsA) {
        const placement = placementByStart.get(`${r},${c},A`);
        if (!placement) throw new Error(`Generated Across run at ${r},${c} has no country placement.`);
        across.push({ n, dir: "A", placement });
      }
      if (startsD) {
        const placement = placementByStart.get(`${r},${c},D`);
        if (!placement) throw new Error(`Generated Down run at ${r},${c} has no country placement.`);
        down.push({ n, dir: "D", placement });
      }
    }
  }
  if (across.length + down.length !== candidate.placements.length) {
    throw new Error(`Generated entry count mismatch: scanned ${across.length + down.length}, placed ${candidate.placements.length}.`);
  }
  return { numbers, across, down };
}

function makeDifficultyLevels(count, rand) {
  if (count <= 0) return [];
  const weights = BASE_DIFFICULTY_WEIGHTS.map(w => w * (0.72 + rand() * 0.56));
  const sum = weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < weights.length; i++) weights[i] /= sum;

  const levels = [];
  if (count >= 5) levels.push(1, 2, 3, 4, 5);
  while (levels.length < count) {
    const x = rand();
    let acc = 0;
    let chosen = 3;
    for (let i = 0; i < weights.length; i++) {
      acc += weights[i];
      if (x <= acc) { chosen = i + 1; break; }
    }
    const level1Count = levels.filter(v => v === 1).length;
    const level5Count = levels.filter(v => v === 5).length;
    const chosenCount = levels.filter(v => v === chosen).length;
    const maxExtreme = Math.max(2, Math.ceil(count * 0.22));
    const maxAnyLevel = Math.max(3, Math.ceil(count * 0.35));
    if ((chosen === 1 && level1Count >= maxExtreme) || (chosen === 5 && level5Count >= maxExtreme)) continue;
    if (chosenCount >= maxAnyLevel) continue;
    levels.push(chosen);
  }
  for (let i = levels.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [levels[i], levels[j]] = [levels[j], levels[i]];
  }
  return levels;
}

function chooseClueForLevel(word, level, rand, recentTypes) {
  let options = word.clues.filter(c => Number(c.difficultyLevel) === level);
  if (!options.length) options = word.clues.slice();
  if (!options.length) {
    throw new Error(`No clues available for ${word.english || word.answer}.`);
  }
  const fresh = options.filter(c => !recentTypes.includes(String(c.type || "")));
  if (fresh.length) options = fresh;
  const chosen = options[Math.floor(rand() * options.length)];
  recentTypes.push(String(chosen.type || ""));
  while (recentTypes.length > 3) recentTypes.shift();
  return chosen;
}

function finalizePuzzle(candidate, words, seed, rand, elapsedMs, attempts, fallbackAfterBudget) {
  const rows = [];
  for (let r = 0; r < SIZE; r++) {
    let row = "";
    for (let c = 0; c < SIZE; c++) row += candidate.chars[idx(r, c)] || "#";
    rows.push(row);
  }

  const scanned = scanEntriesFromCandidate(candidate, words);
  const allScanned = [...scanned.across, ...scanned.down];
  const levels = makeDifficultyLevels(allScanned.length, rand);
  const levelByPlacementKey = new Map();
  allScanned.forEach((entry, i) => levelByPlacementKey.set(`${entry.placement.wordIndex}:${entry.dir}`, levels[i]));
  const recentTypes = [];

  function makeEntry(scannedEntry) {
    const p = scannedEntry.placement;
    const word = words[p.wordIndex];
    const level = levelByPlacementKey.get(`${p.wordIndex}:${scannedEntry.dir}`) || 3;
    const clue = chooseClueForLevel(word, level, rand, recentTypes);
    return {
      n: scannedEntry.n,
      answer: word.answer,
      clue: String(clue.tp || ""),
      clueId: String(clue.id || ""),
      difficulty: String(clue.difficulty || ""),
      difficultyLevel: Number(clue.difficultyLevel) || level,
      clueType: String(clue.type || ""),
      countryId: word.id,
      iso3: word.iso3,
      english: word.english,
      tpName: word.tpName,
      row: p.row,
      col: p.col,
      dir: scannedEntry.dir
    };
  }

  const across = scanned.across.map(makeEntry);
  const down = scanned.down.map(makeEntry);
  const difficultyCounts = [1, 2, 3, 4, 5].map(level => ({
    level,
    count: [...across, ...down].filter(e => e.difficultyLevel === level).length
  }));

  return {
    schemaVersion: 1,
    puzzleFormatVersion: CROSSWORD_PUZZLE_FORMAT_VERSION,
    puzzleType: "generated",
    puzzleId: `generated-${seed.toString(16).padStart(8, "0")}-${Date.now().toString(36)}`,
    createdAt: new Date().toISOString(),
    generator: {
      version: CROSSWORD_BUILDER_VERSION,
      seed,
      size: SIZE,
      timeBudgetMs: 5000,
      elapsedMs: Math.round(elapsedMs),
      attempts,
      fallbackAfterBudget: !!fallbackAfterBudget
    },
    clueBankVersion: CROSSWORD_CLUE_BANK_VERSION,
    rows,
    numbers: scanned.numbers,
    across,
    down,
    quality: candidate.metrics,
    difficultyCounts
  };
}

export function validateGeneratedPuzzle(puzzle) {
  if (!puzzle || puzzle.puzzleType !== "generated") throw new Error("Not a generated crossword puzzle.");
  if (!Array.isArray(puzzle.rows) || puzzle.rows.length !== SIZE || puzzle.rows.some(r => typeof r !== "string" || r.length !== SIZE)) {
    throw new Error("Generated grid must be exactly 15x15.");
  }
  const entries = [...(puzzle.across || []), ...(puzzle.down || [])];
  if (entries.length < 20) throw new Error("Generated crossword has too few entries.");
  const answers = new Set();
  for (const entry of entries) {
    if (!VALID_ANSWER_RE.test(String(entry.answer || ""))) throw new Error(`Invalid generated answer ${entry.answer}.`);
    if (answers.has(entry.answer)) throw new Error(`Duplicate generated answer ${entry.answer}.`);
    answers.add(entry.answer);
    if (!entry.clue || !entry.clueId) throw new Error(`Missing clue for ${entry.answer}.`);
    if (!(Number(entry.difficultyLevel) >= 1 && Number(entry.difficultyLevel) <= 5)) throw new Error(`Invalid clue difficulty for ${entry.answer}.`);
  }
  const q = puzzle.quality || {};
  if (!q.acceptable) throw new Error("Generated crossword does not meet the minimum quality threshold.");
  return true;
}

export async function buildCrosswordFromClueBank(clueBank, options = {}) {
  const countries = Array.isArray(clueBank?.countries) ? clueBank.countries : [];
  const words = buildWordData(countries);
  if (words.length < 50) throw new Error(`Clue bank provided only ${words.length} usable country answers.`);

  const wordsByLetter = Object.create(null);
  for (const word of words) {
    for (const letter of Object.keys(word.positionsByLetter)) (wordsByLetter[letter] ||= []).push(word.index);
  }

  const seed = Number.isInteger(options.seed) ? options.seed >>> 0 : randomSeed();
  const rand = mulberry32(seed);
  const requestedBudget = Number(options.timeBudgetMs);
  const timeBudgetMs = Number.isFinite(requestedBudget) && requestedBudget > 0 ? requestedBudget : 5000;
  const start = performance.now();
  const deadline = start + timeBudgetMs;
  let best = null;
  let attempts = 0;
  let fallbackAfterBudget = false;

  const concurrency = Number(globalThis?.navigator?.hardwareConcurrency) || 4;
  const yieldMs = concurrency <= 2 ? 24 : concurrency <= 4 ? 12 : 4;
  let lastYield = performance.now();

  while (true) {
    attempts++;
    const hadBestBeforeAttempt=!!best;
    const { bestAcceptable } = generateAttempt(words, wordsByLetter, rand);
    const now = performance.now();
    if (bestAcceptable) {
      // If the five-second window elapsed before any acceptable crossword was
      // retained, this attempt is the requested first-solution fallback.
      if (!hadBestBeforeAttempt && now >= deadline) {
        const puzzle = finalizePuzzle(bestAcceptable, words, seed, rand, now - start, attempts, true);
        validateGeneratedPuzzle(puzzle);
        return puzzle;
      }
      if (!best || bestAcceptable.metrics.score > best.metrics.score) best = bestAcceptable;
      if (fallbackAfterBudget) {
        const puzzle = finalizePuzzle(bestAcceptable, words, seed, rand, now - start, attempts, true);
        validateGeneratedPuzzle(puzzle);
        return puzzle;
      }
    }

    if (now >= deadline) {
      if (best) {
        const puzzle = finalizePuzzle(best, words, seed, rand, now - start, attempts, false);
        validateGeneratedPuzzle(puzzle);
        return puzzle;
      }
      // User-defined fallback rule: after the five-second quality window,
      // stop optimizing and return the first acceptable crossword discovered.
      fallbackAfterBudget = true;
    }

    if (now - lastYield >= 80) {
      await sleep(yieldMs);
      lastYield = performance.now();
    }
  }
}

async function loadDefaultClueBank() {
  const url = new URL("../crossword_clues/toki-pona-country-clue-bank-v1.json?v=3", import.meta.url);
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`Could not load crossword clue bank (${response.status}).`);
  return await response.json();
}

if (typeof self !== "undefined" && typeof self.addEventListener === "function" && typeof document === "undefined") {
  self.addEventListener("message", async event => {
    const message = event.data || {};
    if (message.type !== "build") return;
    try {
      const clueBank = message.clueBank || await loadDefaultClueBank();
      const puzzle = await buildCrosswordFromClueBank(clueBank, {
        timeBudgetMs: Number(message.timeBudgetMs) || 5000,
        seed: Number.isInteger(message.seed) ? message.seed : undefined
      });
      self.postMessage({ type: "built", requestId: message.requestId || null, puzzle });
    } catch (error) {
      self.postMessage({
        type: "error",
        requestId: message.requestId || null,
        message: String(error?.message || error),
        stack: String(error?.stack || "")
      });
    }
  });
}
