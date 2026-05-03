# Scrapbook Layout Editor — Refactoring Guide

## What This Refactor Does (Phase 1)

| Change | Benefit |
|---|---|
| CSS extracted to `css/styles.css` | 24 KB cacheable resource; parsed in parallel with JS |
| JS extracted to `js/app.js` | Separate cacheable module; separates concerns from HTML |
| `body { opacity:0 }` removed | Body renders immediately; veil overlay handles visual masking |
| `startScrapbookShell` UI reveal moved earlier | Shell visible before thumbnail canvas renders (~300–600 ms faster perceived load) |
| Thumbnail generation made background async | Sidebar appears with placeholders; thumbs fill in after paint |

---

## Module Boundaries in `js/app.js`

The file is structured as a single ES-module IIFE but with clear logical sections.
Search for these comment headers to navigate:

| Section | Approx. Lines | Next extraction target |
|---|---|---|
| Lang / i18n | ~1–900 | `js/modules/i18n.js` |
| Toolbar (compact + lang) | ~900–1400 | `js/modules/toolbar.js` |
| Constants / Config | ~1400–1800 | `js/modules/config.js` |
| Sitelen word table | ~1800–2300 | `js/modules/sitelen-words.js` |
| Font utilities | ~2300–2900 | `js/modules/fonts.js` |
| Scene model + element factories | ~2900–3500 | `js/modules/elements.js` |
| Utilities (uid, base64, hash…) | ~3500–3700 | `js/modules/utils.js` |
| IndexedDB | ~3700–3800 | `js/modules/db.js` |
| Canvas / rendering | ~3800–5200 | `js/modules/canvas.js` |
| Sitelen / glyph NLP engine | ~5200–9600 | `js/modules/sitelen-engine.js` ⚠️ largest chunk |
| Selection & hit testing | ~9600–10900 | `js/modules/selection.js` |
| Pointer events / tools | ~10900–12500 | `js/modules/interaction.js` |
| Properties panel | ~12500–15300 | `js/modules/props.js` |
| Z-order, clipboard, keyboard | ~15300–16200 | `js/modules/commands.js` |
| Offscreen draw + PNG export | ~16200–17500 | `js/modules/export-core.js` |
| PDF / HTML / ZIP export | ~17500–17900 | `js/modules/export-heavy.js` ← lazy-load |
| Presentation mode | ~17900–18050 | `js/modules/presentation.js` ← lazy-load |
| Scrapbook document model | ~13900–16500 | `js/modules/scrapbook-doc.js` |
| Scrapbook sidebar | ~16500–16700 | `js/modules/scrapbook-sidebar.js` |
| Search window | ~16700–17000 | `js/modules/search.js` ← lazy-load |
| Shell init | ~17000–17161 | `js/modules/shell.js` |

---

## Phase 2 — True ES Module Split

### Recommended Pattern: Dependency Injection

Because all functions share a single IIFE closure, the cleanest path to true
modules is **dependency injection** via a shared context object:

```js
// js/app.js — after all state is declared:
const appCtx = {
  // Live getters so modules always see current values
  get Scene()          { return Scene; },
  get Assets()         { return Assets; },
  get ScrapbookState() { return ScrapbookState; },
  get selectedIds()    { return selectedIds; },
  // Stable function refs
  $, tr, setStatus, render, downloadBlob,
  drawElementToOffscreen, renderCurrentPageDataUrl,
  getCurrentPage, getPagePayload,
  // … add more as needed
};

// Lazy-load heavy features only when first used:
let _exportMod = null;
async function requireExportModule() {
  if (!_exportMod) {
    const { createExportModule } = await import('./modules/export-heavy.js');
    _exportMod = createExportModule(appCtx);
  }
  return _exportMod;
}

// Replace direct calls in button handlers:
$('sbBtnExportPdf').onclick = async () => {
  const exp = await requireExportModule();
  await exp.exportDocumentPdf();
};
```

```js
// js/modules/export-heavy.js
export function createExportModule({ Scene, Assets, tr, render, ... }) {

  async function exportDocumentPdf() {
    // Uses Scene, Assets from closure — no global access needed
  }

  return { exportDocumentPdf, exportAllPagesPngZip, exportPrintHtmlScrapbook };
}
```

### Priority Order for Extraction

1. **`i18n.js`** — no side effects, pure data + functions, easy first cut
2. **`config.js`** — constants only, no state
3. **`utils.js`** — pure functions, no DOM
4. **`db.js`** — only depends on config constants
5. **`export-heavy.js`** — lazy-loaded, large savings on first parse
6. **`presentation.js`** — lazy-loaded, isolated feature
7. **`search.js`** — lazy-loaded, isolated feature

### Why the Sitelen Engine is Last

`sitelen-engine.js` is the largest chunk (~4 000 lines) and references `WORD_TO_UCSUR_CP`,
`pageMap`, `Scene`, and font utilities heavily. Extract it only after the other
modules have established a stable `appCtx` contract.

---

## Phase 3 — Build Pipeline

Once modules are split, add a build step with **esbuild** or **Rollup**:

```bash
# esbuild — sub-second bundling
npx esbuild js/app.js \
  --bundle \
  --splitting \
  --format=esm \
  --chunk-names=chunks/[name]-[hash] \
  --outdir=dist \
  --minify

# Results in:
#   dist/app.js          ~120 KB (critical path)
#   dist/chunks/export-heavy-[hash].js   ~200 KB (lazy)
#   dist/chunks/sitelen-engine-[hash].js ~180 KB (lazy)
```

This gives you:
- **Code splitting** — heavy features only download when needed
- **Minification** — removes comments/whitespace (~40% size reduction)
- **Tree shaking** — unused exports eliminated
- **Content-hash filenames** — perfect long-term caching

