export const DEFAULT_CATALOG = [
  "a","akesi","ala","alasa","ale","ali","anpa","ante","anu","awen",
  "e","en","epiku","esun",
  "ijo","ike","ilo","insa",
  "jaki","jan","jasima","jelo","jo",
  "kala","kalama","kama","kasi","ken","kepeken","kijetesantakalu","kili","kin","kipisi","kiwen","ko","kokosila","kon","ku","kule","kulupu","kute",
  "la","lanpan","lape","laso","lawa","leko","len","lete","li","lili","linja","linluwi","lipu","loje","lon","luka","lukin","lupa",
  "ma","majuna","mama","mani","meli","meso","mi","mije","misikeke","moku","moli","monsi","monsuta","mu","mun","musi","mute",
  "n","namako","nanpa","nasa","nasin","nena","ni","ni^","ni<","ni>","nimi","noka",
  "o","oko","olin","ona","open",
  "pakala","pake","pali","palisa","pan","pana","pi","pilin","pimeja","pini","pipi","poka","poki","pona","powe","pu",
  "sama","seli","selo","seme","sewi","sewi^","sijelo","sike","sin","sina","sinpin","sitelen","soko","sona","soweli","su","suli","suno","supa","suwi",
  "tan","taso","tawa","telo","tenpo","toki","tomo","tonsi","tu",
  "unpa","uta","utala",
  "walo","wan","waso","wawa","weka","wile",
  ".",",",":","·"
].map(token => ({
  glyph_id: token,
  latin_output: token,
  render_text: token,
  context_type: "normal",
  semantic_token: token === "·" ? "punct_middle_dot" : token,
  class_id: `normal_${token.replace(/[^a-z0-9]+/ig, "_")}`,
  render_mode: "text",
}));

export const DEFAULT_SETTINGS = {
  normSize: 64,
  thresholdMode: "otsu",
  fixedThreshold: 180,
  morphology: "none",
  sourceSizes: [36, 48, 56, 64, 72, 84, 96],
  deskewRange: 4,
  deskewStep: 0.5,
  topGlyphAlts: 3,
  topLineAlts: 3,
  beamWidth: 10,
};

export const DEFAULT_SCORE_WEIGHTS = {
  rowProjection: 0.9,
  colProjection: 0.9,
  fillRatio: 0.55,
  aspectRatio: 0.45,
  partCount: 0.10,
  sectionCount: 0.30,
  sectionWidths: 0.35,
  sectionCenters: 0.25,
  pixel: 0.55,
};

function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
function median(values) {
  const arr = (values || []).filter(v => Number.isFinite(v)).slice().sort((a, b) => a - b);
  if (!arr.length) return NaN;
  const m = Math.floor(arr.length / 2);
  return arr.length % 2 ? arr[m] : (arr[m - 1] + arr[m]) / 2;
}
function get2dContext(canvas, { readback = false } = {}) {
  try { return readback ? canvas.getContext("2d", { willReadFrequently: true }) : canvas.getContext("2d"); }
  catch { return canvas.getContext("2d"); }
}
function safeJsonParse(text, fallback) { try { return JSON.parse(text); } catch { return fallback; } }
function normalizeGlyphKey(raw) { return String(raw ?? "").toLowerCase().trim().replace(/[^a-z^<>:,.·]/g, ""); }

export class SitelenOcrCore {
  constructor(hooks = {}) {
    if (typeof hooks.renderGlyphStringToCanvas !== "function") {
      throw new Error("SitelenOcrCore requires renderGlyphStringToCanvas hook.");
    }
    this.hooks = hooks;
    this.lastBank = null;
    this.lastAnalysis = null;
  }

  parseCatalog(jsonText, fallback = DEFAULT_CATALOG) {
    const parsed = typeof jsonText === "string" ? safeJsonParse(jsonText, fallback) : (jsonText || fallback);
    if (!Array.isArray(parsed)) throw new Error("Glyph catalog JSON must be an array.");
    return parsed.map((item, idx) => ({
      class_id: String(item.class_id || `class_${idx + 1}`),
      glyph_id: String(item.glyph_id || item.latin_output || item.render_text || `glyph_${idx + 1}`),
      context_type: String(item.context_type || "normal"),
      semantic_token: String(item.semantic_token || item.glyph_id || item.class_id || `token_${idx + 1}`),
      latin_output: String(item.latin_output || item.glyph_id || item.render_text || ""),
      render_text: String(item.render_text || item.latin_output || item.glyph_id || ""),
      render_mode: String(item.render_mode || "text"),
    }));
  }

  normalizeSettings(settings = {}) {
    return {
      ...DEFAULT_SETTINGS,
      ...settings,
      normSize: Math.max(16, Number(settings.normSize ?? DEFAULT_SETTINGS.normSize)),
      fixedThreshold: clamp(Number(settings.fixedThreshold ?? DEFAULT_SETTINGS.fixedThreshold), 0, 255),
      sourceSizes: Array.isArray(settings.sourceSizes)
        ? settings.sourceSizes.map(v => Number(v)).filter(v => Number.isFinite(v) && v > 0)
        : DEFAULT_SETTINGS.sourceSizes.slice(),
      deskewRange: Math.max(0, Number(settings.deskewRange ?? DEFAULT_SETTINGS.deskewRange)),
      deskewStep: Math.max(0.1, Number(settings.deskewStep ?? DEFAULT_SETTINGS.deskewStep)),
      beamWidth: Math.max(1, Math.round(Number(settings.beamWidth ?? DEFAULT_SETTINGS.beamWidth))),
      topGlyphAlts: Math.max(1, Math.round(Number(settings.topGlyphAlts ?? DEFAULT_SETTINGS.topGlyphAlts))),
      topLineAlts: Math.max(1, Math.round(Number(settings.topLineAlts ?? DEFAULT_SETTINGS.topLineAlts))),
    };
  }

  normalizeWeights(weights = {}) { return { ...DEFAULT_SCORE_WEIGHTS, ...weights }; }

  imageDataToGrayMask(imageData, width, height, settings) {
    const gray = new Uint8ClampedArray(width * height);
    const src = imageData.data;
    for (let i = 0, j = 0; i < src.length; i += 4, j++) {
      const r = src[i], g = src[i + 1], b = src[i + 2], a = src[i + 3];
      gray[j] = a === 0 ? 255 : Math.round(0.299 * r + 0.587 * g + 0.114 * b);
    }
    const threshold = settings.thresholdMode === "fixed" ? settings.fixedThreshold : this.otsuThreshold(gray);
    const binary = new Uint8Array(width * height);
    for (let i = 0; i < gray.length; i++) binary[i] = gray[i] < threshold ? 1 : 0;
    return { gray, binary: this.applyMorphology(binary, width, height, settings.morphology), threshold };
  }

  otsuThreshold(gray) {
    const hist = new Uint32Array(256);
    for (const v of gray) hist[v]++;
    const total = gray.length;
    let sum = 0;
    for (let i = 0; i < 256; i++) sum += i * hist[i];
    let sumB = 0, wB = 0, maxVar = -1, threshold = 127;
    for (let t = 0; t < 256; t++) {
      wB += hist[t];
      if (!wB) continue;
      const wF = total - wB;
      if (!wF) break;
      sumB += t * hist[t];
      const mB = sumB / wB;
      const mF = (sum - sumB) / wF;
      const between = wB * wF * (mB - mF) * (mB - mF);
      if (between > maxVar) { maxVar = between; threshold = t; }
    }
    return threshold;
  }

  applyMorphology(binary, width, height, mode) {
    if (!mode || mode === "none") return binary;
    const dilateOnce = (src) => {
      const out = new Uint8Array(src.length);
      for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        let on = 0;
        for (let dy = -1; dy <= 1 && !on; dy++) for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          if (src[ny * width + nx]) { on = 1; break; }
        }
        out[y * width + x] = on;
      }
      return out;
    };
    const erodeOnce = (src) => {
      const out = new Uint8Array(src.length);
      for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        let on = 1;
        for (let dy = -1; dy <= 1 && on; dy++) for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height || !src[ny * width + nx]) { on = 0; break; }
        }
        out[y * width + x] = on;
      }
      return out;
    };
    if (mode === "open") return dilateOnce(erodeOnce(binary));
    if (mode === "close") return erodeOnce(dilateOnce(binary));
    return binary;
  }

  trimBinary(binary, width, height) {
    let minX = width, minY = height, maxX = -1, maxY = -1;
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      if (!binary[y * width + x]) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
    if (maxX < minX || maxY < minY) return { x: 0, y: 0, w: 1, h: 1, binary: new Uint8Array([0]) };
    const w = maxX - minX + 1;
    const h = maxY - minY + 1;
    const cropped = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) cropped[y * w + x] = binary[(minY + y) * width + (minX + x)];
    return { x: minX, y: minY, w, h, binary: cropped };
  }

  cropBinary(binary, width, height, x0, x1, y0, y1) {
    const w = Math.max(1, x1 - x0), h = Math.max(1, y1 - y0);
    const out = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) out[y * w + x] = binary[(y0 + y) * width + (x0 + x)];
    return { binary: out, w, h };
  }

  resizeBinaryNearest(binary, width, height, targetW, targetH = targetW) {
    const out = new Uint8Array(targetW * targetH);
    for (let y = 0; y < targetH; y++) {
      const sy = Math.min(height - 1, Math.floor((y / targetH) * height));
      for (let x = 0; x < targetW; x++) {
        const sx = Math.min(width - 1, Math.floor((x / targetW) * width));
        out[y * targetW + x] = binary[sy * width + sx];
      }
    }
    return out;
  }

  computeProjections(binary, width, height) {
    const row = new Array(height).fill(0);
    const col = new Array(width).fill(0);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const v = binary[y * width + x] ? 1 : 0;
      row[y] += v; col[x] += v;
    }
    return {
      row: row.map(v => Number((v / Math.max(1, width)).toFixed(4))),
      col: col.map(v => Number((v / Math.max(1, height)).toFixed(4))),
    };
  }

  analyzeConnectedParts(binary, width, height, minArea = 1) {
    const visited = new Uint8Array(binary.length);
    const parts = [];
    const neighbors = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,-1],[1,-1],[-1,1]];
    let total = 0;
    for (let i = 0; i < binary.length; i++) total += binary[i] ? 1 : 0;
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (!binary[idx] || visited[idx]) continue;
      const queue = [idx]; visited[idx] = 1;
      let minX = x, minY = y, maxX = x, maxY = y, area = 0;
      while (queue.length) {
        const cur = queue.pop();
        const cx = cur % width, cy = Math.floor(cur / width);
        area++;
        if (cx < minX) minX = cx; if (cy < minY) minY = cy; if (cx > maxX) maxX = cx; if (cy > maxY) maxY = cy;
        for (const [dx, dy] of neighbors) {
          const nx = cx + dx, ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const ni = ny * width + nx;
          if (!binary[ni] || visited[ni]) continue;
          visited[ni] = 1; queue.push(ni);
        }
      }
      if (area >= minArea) parts.push({ x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1, area, area_frac: Number((area / Math.max(1, total)).toFixed(4)) });
    }
    parts.sort((a, b) => a.x - b.x || a.y - b.y);
    return parts;
  }

  computeMoments(binary, width, height) {
    let m00 = 0, m10 = 0, m01 = 0;
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const v = binary[y * width + x] ? 1 : 0;
      if (!v) continue;
      m00 += v; m10 += x * v; m01 += y * v;
    }
    return { m00, cx: Number((m10 / Math.max(1, m00)).toFixed(4)), cy: Number((m01 / Math.max(1, m00)).toFixed(4)) };
  }

  binaryDisagreement(a, b) {
    const n = Math.min(a.length, b.length);
    if (!n) return 1;
    let diff = 0;
    for (let i = 0; i < n; i++) if ((a[i] ? 1 : 0) !== (b[i] ? 1 : 0)) diff++;
    return diff / n;
  }

  projectionDistance(a, b) {
    const n = Math.max(a.length, b.length);
    if (!n) return 0;
    let total = 0;
    for (let i = 0; i < n; i++) total += Math.abs((a[i] || 0) - (b[i] || 0));
    return total / n;
  }

  computeColumnInk(binary, width, height) {
    const col = new Array(width).fill(0);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) col[x] += binary[y * width + x] ? 1 : 0;
    return col;
  }

  findClearVerticalGaps(binary, width, height, { minClearRun = 1, maxInkPerColumn = 0 } = {}) {
    const colInk = this.computeColumnInk(binary, width, height);
    const gaps = [];
    let start = -1;
    for (let x = 0; x < width; x++) {
      const clear = colInk[x] <= maxInkPerColumn;
      if (clear && start < 0) start = x;
      if (!clear && start >= 0) {
        if (x - start >= minClearRun) gaps.push({ x0: start, x1: x });
        start = -1;
      }
    }
    if (start >= 0 && width - start >= minClearRun) gaps.push({ x0: start, x1: width });
    return { colInk, gaps };
  }

  computeSectionBoxesFromVerticalSlices(binary, width, height, opts = {}) {
    const { minArea = 3, minClearRun = 1, maxInkPerColumn = 0 } = opts;
    const { gaps } = this.findClearVerticalGaps(binary, width, height, { minClearRun, maxInkPerColumn });
    const sections = [];
    let x = 0;
    for (const gap of gaps) {
      if (gap.x0 > x) {
        const crop = this.cropBinary(binary, width, height, x, gap.x0, 0, height);
        const trimmed = this.trimBinary(crop.binary, crop.w, crop.h);
        const area = trimmed.binary.reduce((a, b) => a + (b ? 1 : 0), 0);
        if (area >= minArea && trimmed.w > 0 && trimmed.h > 0) sections.push({ x: x + trimmed.x, y: trimmed.y, w: trimmed.w, h: trimmed.h, area });
      }
      x = gap.x1;
    }
    if (x < width) {
      const crop = this.cropBinary(binary, width, height, x, width, 0, height);
      const trimmed = this.trimBinary(crop.binary, crop.w, crop.h);
      const area = trimmed.binary.reduce((a, b) => a + (b ? 1 : 0), 0);
      if (area >= minArea && trimmed.w > 0 && trimmed.h > 0) sections.push({ x: x + trimmed.x, y: trimmed.y, w: trimmed.w, h: trimmed.h, area });
    }
    return { gaps, sections };
  }

  analyzeBinaryWithSharedSlices(binary, width, height, settings, sectionOpts = {}) {
    const trimmed = this.trimBinary(binary, width, height);
    const norm = this.resizeBinaryNearest(trimmed.binary, trimmed.w, trimmed.h, settings.normSize, settings.normSize);
    const projections = this.computeProjections(norm, settings.normSize, settings.normSize);
    const parts = this.analyzeConnectedParts(norm, settings.normSize, settings.normSize, 1);
    const slices = this.computeSectionBoxesFromVerticalSlices(trimmed.binary, trimmed.w, trimmed.h, sectionOpts);
    const normSlices = this.computeSectionBoxesFromVerticalSlices(norm, settings.normSize, settings.normSize, { minArea: 1, minClearRun: 1, maxInkPerColumn: 0 });
    return {
      source_bbox: { x: trimmed.x, y: trimmed.y, w: trimmed.w, h: trimmed.h },
      norm_width: settings.normSize,
      norm_height: settings.normSize,
      aspect_ratio: Number((trimmed.w / Math.max(1, trimmed.h)).toFixed(4)),
      fill_ratio: Number((norm.reduce((a, b) => a + (b ? 1 : 0), 0) / Math.max(1, settings.normSize * settings.normSize)).toFixed(4)),
      part_count: parts.length,
      part_layout: parts,
      row_projection: projections.row,
      col_projection: projections.col,
      moments: this.computeMoments(norm, settings.normSize, settings.normSize),
      source_vertical_gaps: slices.gaps,
      source_sections: slices.sections,
      norm_vertical_gaps: normSlices.gaps,
      norm_sections: normSlices.sections,
      _trimmed_binary: trimmed.binary,
      _trimmed_width: trimmed.w,
      _trimmed_height: trimmed.h,
      _norm_binary: norm,
      norm_binary: norm,
    };
  }

  analyzeCanvas(canvas, settings) {
    const ctx = get2dContext(canvas, { readback: true });
    const { width, height } = canvas;
    const imageData = ctx.getImageData(0, 0, width, height);
    const { binary, threshold } = this.imageDataToGrayMask(imageData, width, height, settings);
    const analyzed = this.analyzeBinaryWithSharedSlices(binary, width, height, settings, { minArea: 2, minClearRun: 1, maxInkPerColumn: 0 });
    analyzed.threshold = threshold;
    return analyzed;
  }

  findLineBands(binary, width, height) {
    const row = new Array(height).fill(0);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) row[y] += binary[y * width + x] ? 1 : 0;
    const denseThreshold = Math.max(1, Math.floor(width * 0.006));
    const sparseThreshold = 1;
    const rawBands = [];
    let start = -1;
    let mode = "dense";
    for (let y = 0; y < height; y++) {
      const dense = row[y] >= denseThreshold;
      const sparse = row[y] >= sparseThreshold;
      if (start < 0) {
        if (dense || sparse) { start = y; mode = dense ? "dense" : "sparse"; }
        continue;
      }
      if (!sparse) {
        const bandH = y - start;
        const minBand = mode === "dense" ? 3 : 1;
        if (bandH >= minBand) rawBands.push({ y0: start, y1: y, height: bandH, mode });
        start = -1; mode = "dense";
      } else if (dense) {
        mode = "dense";
      }
    }
    if (start >= 0) {
      const bandH = height - start;
      const minBand = mode === "dense" ? 3 : 1;
      if (bandH >= minBand) rawBands.push({ y0: start, y1: height, height: bandH, mode });
    }
    const merged = [];
    for (const band of rawBands) {
      const prev = merged.length ? merged[merged.length - 1] : null;
      if (prev && band.y0 - prev.y1 <= 3) {
        prev.y1 = band.y1; prev.height = prev.y1 - prev.y0; prev.mode = (prev.mode === "dense" || band.mode === "dense") ? "dense" : "sparse";
      } else merged.push({ ...band });
    }
    return merged.filter(band => {
      let ink = 0; for (let y = band.y0; y < band.y1; y++) ink += row[y];
      return ink >= 2;
    });
  }

  rotateBinaryNearest(binary, width, height, angleDeg) {
    const angle = angleDeg * Math.PI / 180;
    const cx = (width - 1) / 2, cy = (height - 1) / 2;
    const out = new Uint8Array(binary.length);
    const cos = Math.cos(-angle), sin = Math.sin(-angle);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const dx = x - cx, dy = y - cy;
      const sx = Math.round(dx * cos - dy * sin + cx);
      const sy = Math.round(dx * sin + dy * cos + cy);
      if (sx >= 0 && sy >= 0 && sx < width && sy < height) out[y * width + x] = binary[sy * width + sx];
    }
    return out;
  }

  scoreDeskew(binary, width, height) {
    const rowSums = new Float64Array(height);
    for (let y = 0; y < height; y++) {
      let sum = 0;
      for (let x = 0; x < width; x++) sum += binary[y * width + x] ? 1 : 0;
      rowSums[y] = sum;
    }
    let mean = 0; for (const v of rowSums) mean += v; mean /= Math.max(1, rowSums.length);
    let variance = 0; for (const v of rowSums) variance += (v - mean) * (v - mean);
    return variance / Math.max(1, rowSums.length);
  }

  estimateDeskew(binary, width, height, settings) {
    let bestAngle = 0, bestScore = this.scoreDeskew(binary, width, height);
    for (let angle = -settings.deskewRange; angle <= settings.deskewRange + 1e-9; angle += settings.deskewStep) {
      const rotated = this.rotateBinaryNearest(binary, width, height, angle);
      const score = this.scoreDeskew(rotated, width, height);
      if (score > bestScore) { bestScore = score; bestAngle = Number(angle.toFixed(3)); }
    }
    return bestAngle;
  }

  async estimateFontSizeFromImageCanvas(imageCanvas, settingsInput = {}) {
    const settings = this.normalizeSettings(settingsInput);
    const ctx = get2dContext(imageCanvas, { readback: true });
    const imageData = ctx.getImageData(0, 0, imageCanvas.width, imageCanvas.height);
    const { binary } = this.imageDataToGrayMask(imageData, imageCanvas.width, imageCanvas.height, settings);
    const bestAngle = this.estimateDeskew(binary, imageCanvas.width, imageCanvas.height, settings);
    const rotated = this.rotateBinaryNearest(binary, imageCanvas.width, imageCanvas.height, bestAngle);
    const lineBands = this.findLineBands(rotated, imageCanvas.width, imageCanvas.height);
    const heights = [];
    for (const lineBand of lineBands) {
      const cropped = this.cropBinary(rotated, imageCanvas.width, imageCanvas.height, 0, imageCanvas.width, lineBand.y0, lineBand.y1);
      const shared = this.analyzeBinaryWithSharedSlices(cropped.binary, cropped.w, cropped.h, settings, { minArea: 3, minClearRun: 1, maxInkPerColumn: 0 });
      for (const sec of (shared.source_sections || [])) if (sec.h > 0) heights.push(sec.h);
    }
    let estimate = median(heights);
    if (!Number.isFinite(estimate)) estimate = median(lineBands.map(lb => Number(lb.height) || 0));
    if (!Number.isFinite(estimate)) estimate = 56;
    return { fontPx: clamp(Math.round(estimate), 8, 220), deskewAngle: bestAngle, lineCount: lineBands.length, rawSectionHeights: heights.slice() };
  }

  _normalizedSectionSignature(sections, width, height) {
    return (sections || []).map(sec => ({
      w: Number((sec.w / Math.max(1, width)).toFixed(4)),
      h: Number((sec.h / Math.max(1, height)).toFixed(4)),
      cx: Number(((sec.x + sec.w / 2) / Math.max(1, width)).toFixed(4)),
    }));
  }

  _sectionDistance(obsDesc, exDesc) {
    const a = this._normalizedSectionSignature(obsDesc.source_sections || [], obsDesc.source_bbox?.w || obsDesc._trimmed_width || 1, obsDesc.source_bbox?.h || obsDesc._trimmed_height || 1);
    const b = this._normalizedSectionSignature(exDesc.source_sections || [], exDesc.source_bbox?.w || exDesc._trimmed_width || 1, exDesc.source_bbox?.h || exDesc._trimmed_height || 1);
    const countPenalty = Math.abs(a.length - b.length);
    const n = Math.min(a.length, b.length);
    let widthDist = 0, centerDist = 0;
    for (let i = 0; i < n; i++) {
      widthDist += Math.abs(a[i].w - b[i].w);
      centerDist += Math.abs(a[i].cx - b[i].cx);
    }
    return { countPenalty, widthDist: n ? widthDist / n : (a.length || b.length ? 1 : 0), centerDist: n ? centerDist / n : (a.length || b.length ? 1 : 0) };
  }

  _relaxedVariants(binary, width, height, settings) {
    const variants = [{ dx0: 0, dx1: 0, dy0: 0, dy1: 0 }];
    if (width > 2) { variants.push({ dx0: -1, dx1: 0, dy0: 0, dy1: 0 }); variants.push({ dx0: 0, dx1: 1, dy0: 0, dy1: 0 }); }
    if (height > 2) { variants.push({ dx0: 0, dx1: 0, dy0: -1, dy1: 0 }); variants.push({ dx0: 0, dx1: 0, dy0: 0, dy1: 1 }); }
    const out = [];
    for (const v of variants) {
      const x0 = Math.max(0, 0 + Math.min(0, v.dx0));
      const y0 = Math.max(0, 0 + Math.min(0, v.dy0));
      const x1 = Math.min(width, width + Math.max(0, v.dx1));
      const y1 = Math.min(height, height + Math.max(0, v.dy1));
      const crop = this.cropBinary(binary, width, height, x0, x1, y0, y1);
      out.push(this.analyzeBinaryWithSharedSlices(crop.binary, crop.w, crop.h, settings, { minArea: 2, minClearRun: 1, maxInkPerColumn: 0 }));
    }
    return out;
  }

  scoreObservedAgainstExemplar(obsVariants, exemplarDesc, weightsInput = {}) {
    const weights = this.normalizeWeights(weightsInput);
    let best = null;
    for (const obsDesc of obsVariants) {
      const row = this.projectionDistance(obsDesc.row_projection, exemplarDesc.row_projection);
      const col = this.projectionDistance(obsDesc.col_projection, exemplarDesc.col_projection);
      const fill = Math.abs(obsDesc.fill_ratio - exemplarDesc.fill_ratio);
      const aspect = Math.abs(obsDesc.aspect_ratio - exemplarDesc.aspect_ratio);
      const partCount = Math.abs(obsDesc.part_count - exemplarDesc.part_count);
      const pixel = exemplarDesc._norm_binary?.length ? this.binaryDisagreement(obsDesc._norm_binary, exemplarDesc._norm_binary) : 1;
      const section = this._sectionDistance(obsDesc, exemplarDesc);
      const total = row * weights.rowProjection + col * weights.colProjection + fill * weights.fillRatio + aspect * weights.aspectRatio + partCount * weights.partCount + section.countPenalty * weights.sectionCount + section.widthDist * weights.sectionWidths + section.centerDist * weights.sectionCenters + pixel * weights.pixel;
      const breakdown = {
        rowProjection: Number(row.toFixed(6)), colProjection: Number(col.toFixed(6)), fillRatio: Number(fill.toFixed(6)),
        aspectRatio: Number(aspect.toFixed(6)), partCount: Number(partCount.toFixed(6)), sectionCount: Number(section.countPenalty.toFixed(6)),
        sectionWidths: Number(section.widthDist.toFixed(6)), sectionCenters: Number(section.centerDist.toFixed(6)), pixel: Number(pixel.toFixed(6)),
      };
      if (!best || total < best.total) best = { total: Number(total.toFixed(6)), breakdown, observed: obsDesc };
    }
    return best || { total: Number.POSITIVE_INFINITY, breakdown: {}, observed: obsVariants[0] || null };
  }

  rankSegmentAgainstBank(segmentBinary, width, height, bank, settingsInput = {}, weightsInput = {}) {
    const settings = this.normalizeSettings(settingsInput);
    const obsVariants = this._relaxedVariants(segmentBinary, width, height, settings);
    const scored = [];
    for (const cls of (bank?.classes || [])) {
      let bestForClass = null;
      for (const ex of (cls.exemplars || [])) {
        const scoredEx = this.scoreObservedAgainstExemplar(obsVariants, ex, weightsInput);
        if (!bestForClass || scoredEx.total < bestForClass.total) {
          bestForClass = { class_id: cls.class_id, latin_output: cls.latin_output, glyph_id: cls.glyph_id, total: scoredEx.total, breakdown: scoredEx.breakdown, exemplar: ex, observed: scoredEx.observed };
        }
      }
      if (bestForClass) scored.push(bestForClass);
    }
    scored.sort((a, b) => a.total - b.total || a.latin_output.localeCompare(b.latin_output));
    return scored.slice(0, settings.topGlyphAlts);
  }

  async buildReferenceBank({ catalog = DEFAULT_CATALOG, settings: settingsInput = {}, scriptFamily, fontLabel = "ReferenceBank" }) {
    const settings = this.normalizeSettings(settingsInput);
    if (!scriptFamily) throw new Error("scriptFamily is required to build reference bank.");
    const parsedCatalog = this.parseCatalog(catalog, DEFAULT_CATALOG);
    const classes = [];
    for (const item of parsedCatalog) {
      const exemplars = [];
      const token = normalizeGlyphKey(item.glyph_id || item.render_text || item.latin_output);
      const renderString = this.hooks.tokenToGlyphString ? await this.hooks.tokenToGlyphString(token) : token;
      for (const size of settings.sourceSizes) {
        const rendered = this.hooks.renderGlyphStringToCanvas(String(renderString || " "), scriptFamily, size, 20);
        const desc = this.analyzeCanvas(rendered, settings);
        exemplars.push({
          source_render_size: size,
          norm_width: desc.norm_width, norm_height: desc.norm_height, aspect_ratio: desc.aspect_ratio, fill_ratio: desc.fill_ratio,
          part_count: desc.part_count, part_layout: desc.part_layout, row_projection: desc.row_projection, col_projection: desc.col_projection,
          bbox: desc.source_bbox, source_bbox: desc.source_bbox, moments: desc.moments,
          source_vertical_gaps: desc.source_vertical_gaps, source_sections: desc.source_sections,
          norm_vertical_gaps: desc.norm_vertical_gaps, norm_sections: desc.norm_sections,
          _norm_binary: desc._norm_binary, _trimmed_binary: desc._trimmed_binary, _trimmed_width: desc._trimmed_width, _trimmed_height: desc._trimmed_height,
          _previewCanvas: rendered,
        });
      }
      classes.push({ class_id: item.class_id, glyph_id: item.glyph_id, context_type: item.context_type, semantic_token: item.semantic_token, latin_output: item.latin_output, render_text: item.render_text, render_mode: item.render_mode, exemplars });
    }
    const bank = { font: { font_label: fontLabel, family_name: scriptFamily, uploaded_filename: "" }, normalization: { norm_size: settings.normSize, source_sizes: settings.sourceSizes.slice() }, classes, settings };
    this.lastBank = bank;
    return bank;
  }

  async _renderLatinLineBinary(text, scriptFamily, fontPx, settings) {
    const glyphString = this.hooks.renderLatinLineToGlyphString ? await this.hooks.renderLatinLineToGlyphString(text || " ") : String(text || " ");
    const canvas = this.hooks.renderGlyphStringToCanvas(String(glyphString || " "), scriptFamily, Math.max(8, Math.round(fontPx)), 20);
    const desc = this.analyzeCanvas(canvas, settings);
    return { canvas, binary: desc._norm_binary, row_projection: desc.row_projection, col_projection: desc.col_projection };
  }

  async scoreWholeLine(candidateText, observedLine, scriptFamily, fontPx, settingsInput = {}) {
    const settings = this.normalizeSettings(settingsInput);
    const rendered = await this._renderLatinLineBinary(candidateText, scriptFamily, fontPx, settings);
    const pix = this.binaryDisagreement(observedLine.norm_binary, rendered.binary);
    const row = this.projectionDistance(observedLine.row_projection, rendered.row_projection);
    const col = this.projectionDistance(observedLine.col_projection, rendered.col_projection);
    return Number((pix * 0.45 + row * 0.2 + col * 0.2).toFixed(6));
  }

  async decodeLineWithBeam(line, bank, scriptFamily, settingsInput = {}) {
    const settings = this.normalizeSettings(settingsInput);
    let beam = [{ text: "", glyphs: [], localScore: 0 }];
    for (let i = 0; i < line.segments.length; i++) {
      const seg = line.segments[i];
      const next = [];
      for (const path of beam) for (const alt of seg.alternatives) {
        const nextText = path.text ? `${path.text} ${alt.latin_output}` : alt.latin_output;
        next.push({ text: nextText, glyphs: path.glyphs.concat([{ segmentIndex: i, choice: alt }]), localScore: path.localScore + alt.total });
      }
      next.sort((a, b) => a.localScore - b.localScore);
      beam = next.slice(0, settings.beamWidth);
    }
    const rescored = [];
    for (const path of beam) {
      const lineScore = await this.scoreWholeLine(path.text, line.observedDescriptor, scriptFamily, line.estimatedFontPx, settings);
      rescored.push({ ...path, lineScore, totalScore: Number((path.localScore + lineScore * 4).toFixed(6)) });
    }
    rescored.sort((a, b) => a.totalScore - b.totalScore || a.text.localeCompare(b.text));
    return rescored.slice(0, settings.topLineAlts);
  }

  async analyzeImageCanvas({ imageCanvas, bank, scriptFamily, settings: settingsInput = {}, scoreWeights = {} }) {
    if (!imageCanvas) throw new Error("imageCanvas is required.");
    if (!bank) throw new Error("reference bank is required.");
    if (!scriptFamily) throw new Error("scriptFamily is required.");
    const settings = this.normalizeSettings(settingsInput);
    const ctx = get2dContext(imageCanvas, { readback: true });
    const imageData = ctx.getImageData(0, 0, imageCanvas.width, imageCanvas.height);
    const { binary, threshold } = this.imageDataToGrayMask(imageData, imageCanvas.width, imageCanvas.height, settings);
    const bestAngle = this.estimateDeskew(binary, imageCanvas.width, imageCanvas.height, settings);
    const rotated = this.rotateBinaryNearest(binary, imageCanvas.width, imageCanvas.height, bestAngle);
    const lineBands = this.findLineBands(rotated, imageCanvas.width, imageCanvas.height);
    const lines = [];
    for (let li = 0; li < lineBands.length; li++) {
      const lineBand = lineBands[li];
      const cropped = this.cropBinary(rotated, imageCanvas.width, imageCanvas.height, 0, imageCanvas.width, lineBand.y0, lineBand.y1);
      const sharedLine = this.analyzeBinaryWithSharedSlices(cropped.binary, cropped.w, cropped.h, settings, { minArea: 3, minClearRun: 1, maxInkPerColumn: 0 });
      const lineSections = sharedLine.source_sections.map(sec => ({ ...sec }));
      const estimatedFontPx = median(lineSections.map(s => s.h).filter(v => Number.isFinite(v) && v > 0)) || 56;
      const observedDescriptor = this.analyzeBinaryWithSharedSlices(cropped.binary, cropped.w, cropped.h, settings, { minArea: 3, minClearRun: 1, maxInkPerColumn: 0 });
      const segments = [];
      for (let si = 0; si < lineSections.length; si++) {
        const box = lineSections[si];
        const segCrop = this.cropBinary(cropped.binary, cropped.w, cropped.h, box.x, box.x + box.w, box.y, box.y + box.h);
        const alternatives = this.rankSegmentAgainstBank(segCrop.binary, segCrop.w, segCrop.h, bank, settings, scoreWeights);
        const desc = alternatives[0]?.observed || this.analyzeBinaryWithSharedSlices(segCrop.binary, segCrop.w, segCrop.h, settings, { minArea: 2, minClearRun: 1, maxInkPerColumn: 0 });
        segments.push({ lineIndex: li, segmentIndex: si, bbox: { x: box.x, y: lineBand.y0 + box.y, w: box.w, h: box.h }, rawBox: { ...box }, descriptor: desc, alternatives });
      }
      const line = {
        lineIndex: li, y0: lineBand.y0, y1: lineBand.y1, estimatedFontPx, observedDescriptor, segments,
        lineShared: { source_bbox: sharedLine.source_bbox, source_vertical_gaps: sharedLine.source_vertical_gaps, source_sections: sharedLine.source_sections, trimmed_width: sharedLine._trimmed_width, trimmed_height: sharedLine._trimmed_height, trimmed_binary: sharedLine._trimmed_binary },
      };
      line.alternatives = await this.decodeLineWithBeam(line, bank, scriptFamily, settings);
      line.bestText = line.alternatives[0]?.text || "";
      lines.push(line);
    }
    const result = { threshold, deskewAngle: bestAngle, lines, rotatedBinary: rotated };
    this.lastAnalysis = result;
    return result;
  }

  buildOverlayModel(analysis, imageWidth, imageHeight) {
    const items = [];
    for (const line of (analysis?.lines || [])) {
      const lineBox = line.lineShared?.source_bbox || { x: 0, y: 0, w: 0, h: 0 };
      const lineOffsetX = Number(lineBox.x || 0), lineOffsetY = Number(lineBox.y || 0);
      items.push({ type: "line", lineIndex: line.lineIndex, x: 0, y: line.y0, w: imageWidth, h: line.y1 - line.y0 });
      for (const gap of (line.lineShared?.source_vertical_gaps || [])) items.push({ type: "lineGap", lineIndex: line.lineIndex, x0: lineOffsetX + gap.x0, x1: lineOffsetX + gap.x1, y0: line.y0 + lineOffsetY, y1: line.y0 + lineOffsetY + (lineBox.h || 0) });
      for (const sec of (line.lineShared?.source_sections || [])) items.push({ type: "lineSection", lineIndex: line.lineIndex, x: lineOffsetX + sec.x, y: line.y0 + lineOffsetY + sec.y, w: sec.w, h: sec.h });
    }
    return items;
  }

  getSegmentDebug(analysis, lineIndex = 0, segmentIndex = 0, topN = 3) {
    const line = analysis?.lines?.[lineIndex];
    if (!line) return null;
    const seg = line.segments?.[segmentIndex];
    if (!seg) return null;
    return { lineIndex, segmentIndex, bbox: seg.bbox, descriptor: seg.descriptor, topCandidates: (seg.alternatives || []).slice(0, topN).map(alt => ({ latin_output: alt.latin_output, glyph_id: alt.glyph_id, total: alt.total, breakdown: alt.breakdown })) };
  }
}
