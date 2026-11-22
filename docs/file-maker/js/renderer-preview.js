// Parser/renderer preview for the Preview tab.
//
// Renders text with the sitelen pona parser/renderer module, using the two
// fonts this page has just compiled with Rust/WASM:
//   Ligatures TTF -> word, cartouche and number (nanpa linja n) roles
//   Literal TTF   -> literal (quoted Latin), literal-cartouche and unknown roles
// The renderer module is included unchanged. Everything specific to these
// fonts lives here, in one render adapter.
import SitelenRenderer from './renderer-fontuploads-renderer-preview-bottom-detect-final-fixed-yearless-datetime.js?v=0.3.34';

import {RENDER_ADAPTER_ID,spfmLigaturesAdapter} from './spfm-render-adapter.js?v=0.3.34';
export {RENDER_ADAPTER_ID,spfmLigaturesAdapter};

// Parser options taken from the reference page (text-to-sitelen page,
// buildBaseRendererConfig). Without `mode: "sitelen-seli-kiwen"` the
// renderer does not parse pi(...), compounds or fractions.
export const PARSER_CONFIG = Object.freeze({
  mode: 'sitelen-pona-ascii-extended',
  literalStyle: 'double-quote',
  numericMode: 'compat',
  mixedStyle: 'short',
  showUnknownText: true,
  cartoucheCommaTallyMarks: true,
  cartoucheTallyMode: 'ucsur',
  literalCartoucheEncoding: 'ascii-quoted'
});

// Fairfax's native required GSUB substitutions support canonical pi + long-pi
// control code points directly. Do not enable the older adapter that converts
// them to the obsolete U+F1993-only path; it bypasses the real ASCII pi(...) start.

export function rendererConfig({ ligatures, literal, fontPx = 48, color = '#111111' }) {
  return {
    layout: { fontPx, align: 'left', paddingPx: 18 },
    paint: { fillStyle: color, halo: { enabled: false, widthPx: 0 },
             unknownText: { style: 'outline-box', colorMode: 'auto', color: null, lineWidthPx: 1.5, paddingPx: 2, dash: false } },
    parser: { ...PARSER_CONFIG },
    fonts: {
      renderAdapterId: 'identity',
      cartoucheVulgarFractions: true,
      roles: { word: ligatures, text: ligatures, cartouche: ligatures, number: ligatures,
               literal, literalCartouche: literal, unknown: literal }
    }
  };
}

let instance = null, instanceKey = '';
export async function renderWithCompiledFonts({ input, ligatures, literal, fontPx, color }) {
  // Native Fairfax GSUB handles cartouches and long-pi: legacy adapter must NOT rewrite its input.
  const config = rendererConfig({ ligatures, literal, fontPx, color });
  const key = JSON.stringify(config);
  if (!instance || key !== instanceKey) { instance = await SitelenRenderer.create(config); instanceKey = key; }
  await Promise.all([document.fonts.load(`${fontPx}px "${ligatures}"`), document.fonts.load(`${fontPx}px "${literal}"`)]);
  return instance.renderTextToNewCanvas({ input, layout: { fontPx } });
}

/* ---------------------------- Preview tab UI ---------------------------- */
let fonts = null, sizePx = 48, serial = 0;
const $ = id => document.getElementById(id);

/** Called by the Preview tab whenever the compiled fonts or the size change. */
export function setParserPreviewFonts(compiled, fontPx) {
  fonts = compiled ? { ligatures: compiled.normal, literal: compiled.literal } : null;
  if (Number.isFinite(fontPx)) sizePx = Math.max(8, Math.min(256, Math.round(fontPx)));
  renderParserPreview();
}

// This live comparison is intentionally direct OpenType text shaping, rather
// than a second parser fallback or hand-drawn Canvas. It uses the identical
// Ligatures FontFace selected by the shared SitelenRenderer above, but forces
// the literal native "pi(...) pi telo" input and therefore exercises the
// HarfBuzz-selected GID 23839 along with ordinary pi GID 19385.
function renderNativePiComparison() {
  const output = $('rendererPiComparisonOutput');
  if (!output) return;
  const show = $('showPiComparison')?.checked !== false;
  output.hidden = !show;
  output.replaceChildren();
  if (!show || !fonts) return;
  const sample = document.createElement('div');
  sample.className = 'native-pi-comparison-text';
  sample.textContent = 'pi(jan pona sina) pi telo';
  sample.style.fontFamily = `"${fonts.ligatures}"`;
  sample.style.fontSize = `${sizePx}px`;
  sample.style.fontVariantLigatures = 'normal';
  sample.setAttribute('aria-label', 'Long-pi jan pona sina followed by ordinary pi telo');
  output.appendChild(sample);
}

export async function renderParserPreview() {
  const out = $('rendererPreviewOutput'), status = $('rendererPreviewStatus'), panel = $('rendererPreviewPanel');
  if (!out || !panel) return;
  // Invalidate an older asynchronous Canvas render even when fonts are cleared.
  const mine = ++serial;
  if (!fonts) { panel.hidden = true; out.textContent = ''; renderNativePiComparison(); return; }
  panel.hidden = false;
  renderNativePiComparison();
  const input = $('rendererInput').value;
  status.textContent = 'Rendering…';
  try {
    // The renderer is not DPR-aware: it draws in raw canvas pixels. Render
    // at size x devicePixelRatio and show the canvas at 1/DPR, so each
    // canvas pixel is exactly one screen pixel (no browser resampling, which
    // could otherwise move a horizontal rule by a pixel part-way along).
    const dpr = window.devicePixelRatio || 1;
    const rendered = await renderWithCompiledFonts({ input, ...fonts, fontPx: Math.max(8, Math.round(sizePx * dpr)) });
    if (mine !== serial) return;
    out.textContent = '';
    const canvas = rendered.canvas;
    canvas.className = 'renderer-preview-canvas';
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', 'Parser/renderer output: ' + input);
    canvas.style.width = `${canvas.width / dpr}px`;
    canvas.style.height = `${canvas.height / dpr}px`;
    out.appendChild(canvas);
    status.textContent = `Rendered at ${sizePx} px with the compiled Ligatures font (words, cartouches, numbers) and Literal font (quoted text).`;
  } catch (e) {
    if (mine !== serial) return;
    out.textContent = '';
    status.textContent = 'Renderer error: ' + String(e?.message || e);
  }
}

export function wireParserPreview() {
  const input = $('rendererInput');
  if (!input || input.dataset.wired) return;
  input.dataset.wired = '1';
  const comparison = $('showPiComparison');
  if (comparison) {
    try { const saved = localStorage.getItem('spfm-show-pi-comparison');
      if (saved !== null) comparison.checked = saved === 'true';
    } catch (_) { /* private browsing/storage restrictions */ }
    comparison.addEventListener('change', () => {
      try { localStorage.setItem('spfm-show-pi-comparison', String(comparison.checked)); }
      catch (_) { /* storage restrictions */ }
      renderNativePiComparison(); // display only: never trigger Rust/WASM
    });
    renderNativePiComparison();
  }
  let t = 0;
  input.addEventListener('input', () => { clearTimeout(t); t = setTimeout(renderParserPreview, 200); });
  for (const b of document.querySelectorAll('#rendererPreviewPanel .renderer-sample')) {
    b.addEventListener('click', () => { input.value = b.dataset.sample; renderParserPreview(); });
  }
  // Browser zoom and moving the window between screens change the DPR.
  const watchDpr = () => {
    const mq = matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
    mq.addEventListener('change', () => { watchDpr(); renderParserPreview(); }, { once: true });
  };
  watchDpr();
}
