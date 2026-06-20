import SitelenRenderer from "./renderer-fontuploads-renderer-preview-bottom-detect-final-fixed.js?v=63";

(() => {
  "use strict";

  const GRID_SIZE = 4;
  const WIN_VALUE = 2048;
  const LS_BEST_SCORE = "nanpa2048_bestScore";

  const FONT_FAMILY_TEXT = "TP-Nasin-Nanpa-Font";
  const FONT_FAMILY_CARTOUCHE = "TP-Cartouche-Font";
  const FONT_FAMILY_NUMBER = "TP-Numeric-Cartouche-Font";
  const FONT_FAMILY_LITERAL = "PatrickHand";

  const TILE_COLORS = {
    2:    "#EEE4DA",
    4:    "#EDE0C8",
    8:    "#F2B179",
    16:   "#F59563",
    32:   "#F67C5F",
    64:   "#F65E3B",
    128:  "#EDCF72",
    256:  "#EDCC61",
    512:  "#EDC850",
    1024: "#EDC53F",
    2048: "#E85A2A"
  };

  const dom = {
    board: document.getElementById("board"),
    status: document.getElementById("status"),
    hint: document.getElementById("hint"),
    btnNew: document.getElementById("btnNew"),
    btnQuit: document.getElementById("btnQuit"),
    btnCancelQuit: document.getElementById("btnCancelQuit"),
    btnConfirmQuit: document.getElementById("btnConfirmQuit"),
    quitOverlay: document.getElementById("quitOverlay"),
    finishOverlay: document.getElementById("finishOverlay"),
    finishMessage: document.getElementById("finishMessage"),
    finishModal: document.getElementById("finishModal"),
    finishValueCanvas: document.getElementById("finishValueCanvas"),
    finishDecimalValue: document.getElementById("finishDecimalValue"),
    scoreCanvas: document.getElementById("scoreCanvas"),
    bestCanvas: document.getElementById("bestCanvas"),
    timeCanvas: document.getElementById("timeCanvas"),
    bestBox: document.getElementById("bestBox"),
  };

  const GameState = {
    idle: "idle",
    running: "running",
    pausedForQuit: "pausedForQuit",
    won: "won",
    lost: "lost",
  };

  let state = GameState.idle;
  let board = makeEmptyBoard();
  let score = 0;
  let bestScore = loadBestScore();
  let seconds = 0;
  let timerHandle = null;
  let renderer = null;
  let renderSeq = 0;
  let statSeq = 0;
  const cartoucheCache = new Map();
  const tileFitCache = new Map();
  const statCache = new Map();
  let lastSpawned = null;
  let lastMerged = new Set();

  function makeEmptyBoard() {
    return Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(0));
  }

  function setStatus(text) {
    dom.status.textContent = String(text || "");
  }

  function loadBestScore() {
    try {
      const n = Number(localStorage.getItem(LS_BEST_SCORE));
      return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
    } catch {
      return 0;
    }
  }

  function saveBestScore(value) {
    bestScore = Math.max(0, Math.floor(Number(value) || 0));
    try {
      if (bestScore > 0) localStorage.setItem(LS_BEST_SCORE, String(bestScore));
      else localStorage.removeItem(LS_BEST_SCORE);
    } catch {}
  }

  function updateControls() {
    const playing = state === GameState.running || state === GameState.pausedForQuit;
    dom.btnNew.disabled = playing;
    dom.btnQuit.disabled = state !== GameState.running;
    dom.bestBox.classList.toggle("disabledClick", playing);
    dom.bestBox.classList.toggle("clickable", !playing);
  }

  function rendererConfig(fontPx, paddingPx) {
    return {
      layout: {
        fontPx,
        align: "center",
        spacingPreset: "compact",
        paddingPx,
      },
      paint: {
        fillStyle: "#111111",
        halo: { enabled: false, color: "#FFFFFF", widthPx: 0 }
      },
      parser: {
        mode: "sitelen-seli-kiwen",
        literalStyle: "double-quote",
        extensionStyle: "ssk",
        cartoucheStyle: "ssk",
        numericMode: "uniform",
        mixedStyle: "short",
        showUnknownText: false,
        abbreviateNumericCartouches: true,
        cartoucheCommaTallyMarks: false,
        cartoucheTallyMode: "ucsur"
      },
      fonts: {
        roles: {
          word: FONT_FAMILY_TEXT,
          text: FONT_FAMILY_TEXT,
          cartouche: FONT_FAMILY_CARTOUCHE,
          number: FONT_FAMILY_NUMBER,
          date: FONT_FAMILY_NUMBER,
          time: FONT_FAMILY_NUMBER,
          literal: FONT_FAMILY_LITERAL,
          unknown: FONT_FAMILY_LITERAL,
          literalCartouche: FONT_FAMILY_TEXT,
        }
      }
    };
  }

  async function ensureFontsLoaded() {
    if (!document.fonts || !document.fonts.load || !document.fonts.ready) return;
    const samples = [
      [`24px "PatrickHand"`, "score"],
      [`24px "Patrick-Head-Font"`, "score"],
      [`24px "TP-Nasin-Nanpa-Font"`, "󱤬"],
      [`24px "TP-Cartouche-Font"`, "󱦐"],
      [`24px "TP-Numeric-Cartouche-Font"`, "󱦐"],
    ];
    await Promise.all(samples.map(([font, sample]) => document.fonts.load(font, sample).catch(() => null)));
    await document.fonts.ready.catch(() => null);
  }

  async function ensureRenderer() {
    if (renderer) return renderer;
    await ensureFontsLoaded();
    renderer = await SitelenRenderer.create(rendererConfig(72, 8));
    return renderer;
  }

  function cropCanvasToInk(sourceCanvas, paddingPx = 2) {
    const w = sourceCanvas?.width | 0;
    const h = sourceCanvas?.height | 0;
    if (!w || !h) return sourceCanvas;

    const ctx = sourceCanvas.getContext("2d", { alpha: true, willReadFrequently: true });
    if (!ctx) return sourceCanvas;

    let data;
    try { data = ctx.getImageData(0, 0, w, h).data; }
    catch { return sourceCanvas; }

    let minX = w, minY = h, maxX = -1, maxY = -1;
    for (let y = 0; y < h; y++) {
      const row = y * w * 4;
      for (let x = 0; x < w; x++) {
        if (data[row + x * 4 + 3] > 0) {
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
        }
      }
    }

    if (maxX < minX || maxY < minY) return sourceCanvas;
    const pad = Math.max(0, Math.round(Number(paddingPx) || 0));
    minX = Math.max(0, minX - pad);
    minY = Math.max(0, minY - pad);
    maxX = Math.min(w - 1, maxX + pad);
    maxY = Math.min(h - 1, maxY + pad);

    const out = document.createElement("canvas");
    out.width = Math.max(1, maxX - minX + 1);
    out.height = Math.max(1, maxY - minY + 1);
    out.getContext("2d", { alpha: true }).drawImage(sourceCanvas, minX, minY, out.width, out.height, 0, 0, out.width, out.height);
    return out;
  }

  async function renderNumericCartouche(value, { fontPx = 72, paddingPx = 8, cache = cartoucheCache } = {}) {
    const key = `${value}|${fontPx}|${paddingPx}`;
    if (cache.has(key)) return cache.get(key);

    const r = await ensureRenderer();
    const rendered = await r.renderTextToNewCanvas({
      input: `[${value}]`,
      ...rendererConfig(fontPx, paddingPx),
    });
    const src = rendered?.canvas;
    if (!src) throw new Error(`Could not render cartouche for ${value}`);
    const cropped = cropCanvasToInk(src, Math.max(3, Math.round(fontPx * 0.05)));
    cache.set(key, cropped);
    return cropped;
  }

  function fitCanvasInto(targetCanvas, sourceCanvas, maxCssW, maxCssH) {
    const dpr = window.devicePixelRatio || 1;
    const cssW = Math.max(1, Math.floor(maxCssW));
    const cssH = Math.max(1, Math.floor(maxCssH));
    targetCanvas.style.width = `${cssW}px`;
    targetCanvas.style.height = `${cssH}px`;
    targetCanvas.width = Math.ceil(cssW * dpr);
    targetCanvas.height = Math.ceil(cssH * dpr);

    const ctx = targetCanvas.getContext("2d", { alpha: true });
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);

    if (!sourceCanvas || !sourceCanvas.width || !sourceCanvas.height) return;
    const scale = Math.min(cssW / sourceCanvas.width, cssH / sourceCanvas.height, 1.0);
    const drawW = Math.max(1, Math.floor(sourceCanvas.width * scale));
    const drawH = Math.max(1, Math.floor(sourceCanvas.height * scale));
    const x = Math.floor((cssW - drawW) / 2);
    const y = Math.floor((cssH - drawH) / 2);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(sourceCanvas, x, y, drawW, drawH);
  }

  function formatScore(value) {
    const n = Math.max(0, Math.floor(Number(value) || 0));
    return n.toLocaleString("en-US");
  }

  function formatTime(totalSeconds) {
    const total = Math.max(0, Math.floor(Number(totalSeconds) || 0));
    const mm = Math.floor(total / 60);
    const ss = total % 60;
    return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
  }

  async function renderStats() {
    const seq = ++statSeq;
    const items = [
      { canvas: dom.scoreCanvas, value: formatScore(score), fontPx: 42 },
      { canvas: dom.bestCanvas, value: formatScore(bestScore), fontPx: 42 },
      { canvas: dom.timeCanvas, value: formatTime(seconds), fontPx: 42 },
    ];

    for (const item of items) {
      const box = item.canvas.closest(".statBox");
      const rect = box.getBoundingClientRect();
      const labelH = box.querySelector(".statLabel")?.getBoundingClientRect().height || 16;
      const maxW = Math.max(10, rect.width - 12);
      const maxH = Math.max(10, rect.height - labelH - 10);
      const src = await renderNumericCartouche(item.value, { fontPx: item.fontPx, paddingPx: 5, cache: statCache });
      if (seq !== statSeq) return;
      fitCanvasInto(item.canvas, src, maxW, maxH);
    }
  }

  function tileColor(value) {
    if (TILE_COLORS[value]) return TILE_COLORS[value];
    return "#D94A24";
  }

  function tileBorderColor(value) {
    if (value >= WIN_VALUE) return "rgba(17,17,17,0.44)";
    if (value >= 128) return "rgba(17,17,17,0.36)";
    return "rgba(17,17,17,0.28)";
  }

  function buildBoardSkeleton() {
    dom.board.innerHTML = "";
    for (let i = 0; i < GRID_SIZE * GRID_SIZE; i++) {
      const cell = document.createElement("div");
      cell.className = "cell";
      cell.dataset.index = String(i);
      dom.board.appendChild(cell);
    }
  }

  function forEachCell(fn) {
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) fn(r, c, board[r][c]);
    }
  }

  function getTileCartoucheBox() {
    // Use the fixed board-cell size, not the tile element size.
    // Tile animations use CSS transforms, and getBoundingClientRect() includes
    // those transforms; measuring the animated tile itself made identical values
    // render at slightly different scales while a new/merged tile was popping.
    const firstCell = dom.board.children[0];
    const rect = firstCell ? firstCell.getBoundingClientRect() : dom.board.getBoundingClientRect();
    const cssW = Math.max(1, Math.floor((rect.width || 1) - 14));
    const cssH = Math.max(1, Math.floor((rect.height || 1) - 14));
    const dpr = window.devicePixelRatio || 1;
    return { cssW, cssH, dpr, key: `${cssW}x${cssH}@${Math.round(dpr * 1000)}` };
  }

  async function getFittedTileCartouche(value) {
    const box = getTileCartoucheBox();
    const key = `${value}|${box.key}`;
    if (tileFitCache.has(key)) return tileFitCache.get(key);

    const src = await renderNumericCartouche(value, { fontPx: 84, paddingPx: 8 });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(box.cssW * box.dpr);
    canvas.height = Math.ceil(box.cssH * box.dpr);

    const ctx = canvas.getContext("2d", { alpha: true });
    ctx.setTransform(box.dpr, 0, 0, box.dpr, 0, 0);
    ctx.clearRect(0, 0, box.cssW, box.cssH);

    if (src && src.width && src.height) {
      const scale = Math.min(box.cssW / src.width, box.cssH / src.height, 1.0);
      const drawW = Math.max(1, Math.floor(src.width * scale));
      const drawH = Math.max(1, Math.floor(src.height * scale));
      const x = Math.floor((box.cssW - drawW) / 2);
      const y = Math.floor((box.cssH - drawH) / 2);
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(src, x, y, drawW, drawH);
    }

    const fitted = { canvas, cssW: box.cssW, cssH: box.cssH };
    tileFitCache.set(key, fitted);
    return fitted;
  }

  async function drawTileCanvas(canvas, value) {
    const fitted = await getFittedTileCartouche(value);

    canvas.style.width = `${fitted.cssW}px`;
    canvas.style.height = `${fitted.cssH}px`;
    canvas.width = fitted.canvas.width;
    canvas.height = fitted.canvas.height;

    const ctx = canvas.getContext("2d", { alpha: true });
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(fitted.canvas, 0, 0);
  }

  async function renderBoard() {
    const seq = ++renderSeq;
    const cells = Array.from(dom.board.children);
    for (const cell of cells) cell.innerHTML = "";

    const canvasesToRender = [];
    forEachCell((r, c, value) => {
      if (!value) return;
      const index = r * GRID_SIZE + c;
      const cell = cells[index];
      const tile = document.createElement("div");
      tile.className = "tile";
      tile.style.background = tileColor(value);
      tile.style.borderColor = tileBorderColor(value);
      tile.dataset.value = String(value);
      if (lastSpawned && lastSpawned.r === r && lastSpawned.c === c) tile.classList.add("newTile");
      if (lastMerged.has(`${r},${c}`)) tile.classList.add("mergedTile");

      const canvas = document.createElement("canvas");
      canvas.setAttribute("aria-label", String(value));
      tile.appendChild(canvas);
      cell.appendChild(tile);
      canvasesToRender.push({ canvas, value });
    });

    for (const item of canvasesToRender) {
      await drawTileCanvas(item.canvas, item.value);
      if (seq !== renderSeq) return;
    }
  }

  function emptyCells() {
    const out = [];
    forEachCell((r, c, value) => { if (value === 0) out.push({ r, c }); });
    return out;
  }

  function addRandomTile() {
    const empties = emptyCells();
    if (!empties.length) return null;
    const pick = empties[Math.floor(Math.random() * empties.length)];
    board[pick.r][pick.c] = Math.random() < 0.90 ? 2 : 4;
    lastSpawned = pick;
    return pick;
  }

  function cloneBoard(b) {
    return b.map(row => row.slice());
  }

  function boardsEqual(a, b) {
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        if (a[r][c] !== b[r][c]) return false;
      }
    }
    return true;
  }

  function compressAndMerge(line, linePositions) {
    const values = [];
    const positions = [];
    for (let i = 0; i < line.length; i++) {
      if (line[i] !== 0) {
        values.push(line[i]);
        positions.push(linePositions[i]);
      }
    }

    const out = [];
    const mergePositions = [];
    let gained = 0;
    for (let i = 0; i < values.length; i++) {
      if (i + 1 < values.length && values[i] === values[i + 1]) {
        const merged = values[i] * 2;
        out.push(merged);
        mergePositions.push(out.length - 1);
        gained += merged;
        i++;
      } else {
        out.push(values[i]);
      }
    }
    while (out.length < GRID_SIZE) out.push(0);
    return { out, mergePositions, gained };
  }

  function applyMove(direction) {
    const before = cloneBoard(board);
    let gained = 0;
    lastMerged = new Set();
    lastSpawned = null;

    function setLineToBoard(line, positions, mergePositions) {
      for (let i = 0; i < GRID_SIZE; i++) {
        const p = positions[i];
        board[p.r][p.c] = line[i];
      }
      for (const mi of mergePositions) {
        const p = positions[mi];
        lastMerged.add(`${p.r},${p.c}`);
      }
    }

    for (let i = 0; i < GRID_SIZE; i++) {
      let positions;
      if (direction === "left") positions = Array.from({ length: GRID_SIZE }, (_, c) => ({ r: i, c }));
      else if (direction === "right") positions = Array.from({ length: GRID_SIZE }, (_, k) => ({ r: i, c: GRID_SIZE - 1 - k }));
      else if (direction === "up") positions = Array.from({ length: GRID_SIZE }, (_, r) => ({ r, c: i }));
      else positions = Array.from({ length: GRID_SIZE }, (_, k) => ({ r: GRID_SIZE - 1 - k, c: i }));

      const line = positions.map(p => before[p.r][p.c]);
      const { out, mergePositions, gained: lineGain } = compressAndMerge(line, positions);
      gained += lineGain;
      setLineToBoard(out, positions, mergePositions);
    }

    if (boardsEqual(before, board)) return false;
    score += gained;
    if (score > bestScore) saveBestScore(score);
    addRandomTile();
    return true;
  }

  function largestTileValue() {
    let max = 0;
    for (const row of board) {
      for (const value of row) {
        if (value > max) max = value;
      }
    }
    return max;
  }

  function hasWon() {
    return largestTileValue() >= WIN_VALUE;
  }

  async function renderFinishValue(value) {
    const v = Math.max(0, Math.floor(Number(value) || 0));
    if (dom.finishDecimalValue) dom.finishDecimalValue.textContent = String(v);
    if (!dom.finishValueCanvas) return;

    const modalRect = dom.finishModal?.getBoundingClientRect?.() || { width: 520 };
    const maxW = Math.max(80, Math.min(340, (modalRect.width || 520) * 0.58));
    const maxH = window.matchMedia && window.matchMedia("(max-width: 680px), (pointer: coarse)").matches ? 68 : 86;
    const src = await renderNumericCartouche(v, { fontPx: 88, paddingPx: 8, cache: statCache });
    fitCanvasInto(dom.finishValueCanvas, src, maxW, maxH);
  }

  function dismissFinishOverlay() {
    if (state !== GameState.won && state !== GameState.lost) return;
    dom.finishOverlay.classList.remove("show");
  }

  function hasMoves() {
    if (emptyCells().length) return true;
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        const v = board[r][c];
        if (r + 1 < GRID_SIZE && board[r + 1][c] === v) return true;
        if (c + 1 < GRID_SIZE && board[r][c + 1] === v) return true;
      }
    }
    return false;
  }

  async function afterMove() {
    await renderBoard();
    await renderStats();

    if (hasWon()) {
      await finishWin();
      return;
    }
    if (!hasMoves()) {
      await finishLoss();
    }
  }

  async function tryMove(direction) {
    if (state !== GameState.running) return;
    const moved = applyMove(direction);
    if (!moved) return;
    await afterMove();
  }

  function startTimer() {
    stopTimer();
    timerHandle = setInterval(() => {
      if (state !== GameState.running) return;
      seconds++;
      renderStats();
    }, 1000);
  }

  function stopTimer() {
    if (timerHandle) clearInterval(timerHandle);
    timerHandle = null;
  }

  async function startNewGame() {
    if (state === GameState.running || state === GameState.pausedForQuit) return;
    dom.finishOverlay.classList.remove("show");
    dom.quitOverlay.classList.remove("show");

    board = makeEmptyBoard();
    score = 0;
    seconds = 0;
    lastMerged = new Set();
    lastSpawned = null;
    addRandomTile();
    addRandomTile();

    state = GameState.running;
    updateControls();
    setStatus("Merge equal cartouches to reach 2048.");
    await renderBoard();
    await renderStats();
    startTimer();
  }

  function showQuit() {
    if (state !== GameState.running) return;
    state = GameState.pausedForQuit;
    stopTimer();
    updateControls();
    dom.quitOverlay.classList.add("show");
  }

  function cancelQuit() {
    if (state !== GameState.pausedForQuit) return;
    dom.quitOverlay.classList.remove("show");
    state = GameState.running;
    updateControls();
    startTimer();
  }

  async function confirmQuit() {
    dom.quitOverlay.classList.remove("show");
    stopTimer();
    state = GameState.idle;
    board = makeEmptyBoard();
    score = 0;
    seconds = 0;
    lastMerged = new Set();
    lastSpawned = null;
    updateControls();
    setStatus("Game quit. Start a new game when ready.");
    await renderBoard();
    await renderStats();
  }

  async function finishWin() {
    stopTimer();
    state = GameState.won;
    updateControls();
    setStatus("2048 reached. Game complete.");
    dom.finishMessage.textContent = "The largest tile value achieved was:";
    dom.finishOverlay.classList.add("show");
    await renderFinishValue(largestTileValue());
  }

  async function finishLoss() {
    stopTimer();
    state = GameState.lost;
    updateControls();
    setStatus("No moves left. Start a new game when ready.");
    dom.finishMessage.textContent = "The largest tile value achieved was:";
    dom.finishOverlay.classList.add("show");
    await renderFinishValue(largestTileValue());
  }

  async function clearBestScoreIfAllowed() {
    if (state === GameState.running || state === GameState.pausedForQuit) return;
    if (bestScore <= 0) return;
    if (!confirm("Clear best score?")) return;
    saveBestScore(0);
    await renderStats();
  }

  function keyToDirection(key) {
    if (key === "ArrowLeft") return "left";
    if (key === "ArrowRight") return "right";
    if (key === "ArrowUp") return "up";
    if (key === "ArrowDown") return "down";
    return null;
  }

  function isTypingContext(el) {
    if (!el) return false;
    const tag = String(el.tagName || "").toLowerCase();
    return tag === "input" || tag === "textarea" || tag === "select" || el.isContentEditable;
  }

  function wireInput() {
    dom.btnNew.addEventListener("click", () => startNewGame());
    dom.btnQuit.addEventListener("click", () => showQuit());
    dom.btnCancelQuit.addEventListener("click", () => cancelQuit());
    dom.btnConfirmQuit.addEventListener("click", () => confirmQuit());
    dom.bestBox.addEventListener("click", () => clearBestScoreIfAllowed());
    dom.finishOverlay.addEventListener("click", () => dismissFinishOverlay());
    dom.finishModal.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        dismissFinishOverlay();
      }
    });

    window.addEventListener("keydown", (e) => {
      if (isTypingContext(document.activeElement)) return;
      const dir = keyToDirection(e.key);
      if (!dir) return;
      e.preventDefault();
      tryMove(dir);
    }, { passive: false });

    const touch = { active: false, x: 0, y: 0, pointerId: null };
    dom.board.addEventListener("pointerdown", (e) => {
      if (state !== GameState.running) return;
      touch.active = true;
      touch.x = e.clientX;
      touch.y = e.clientY;
      touch.pointerId = e.pointerId;
      dom.board.setPointerCapture?.(e.pointerId);
      e.preventDefault();
    }, { passive: false });

    dom.board.addEventListener("pointerup", (e) => {
      if (!touch.active || e.pointerId !== touch.pointerId) return;
      const dx = e.clientX - touch.x;
      const dy = e.clientY - touch.y;
      touch.active = false;
      touch.pointerId = null;
      const absX = Math.abs(dx);
      const absY = Math.abs(dy);
      const threshold = 22;
      if (Math.max(absX, absY) < threshold) return;
      if (absX > absY) tryMove(dx < 0 ? "left" : "right");
      else tryMove(dy < 0 ? "up" : "down");
    }, { passive: true });

    dom.board.addEventListener("pointercancel", () => {
      touch.active = false;
      touch.pointerId = null;
    }, { passive: true });

    window.addEventListener("resize", () => {
      renderBoard();
      renderStats();
      if (dom.finishOverlay.classList.contains("show")) renderFinishValue(largestTileValue());
    });
  }

  async function init() {
    buildBoardSkeleton();
    wireInput();
    updateControls();
    setStatus("Loading fonts…");
    try {
      await ensureRenderer();
      await renderStats();
      await renderBoard();
      setStatus("Start a new game. Use arrow keys or swipe.");
    } catch (err) {
      console.error(err);
      setStatus(`Renderer/font load error: ${err?.message || err}`);
    }
  }

  window.addEventListener("load", init, { once: true });
})();
