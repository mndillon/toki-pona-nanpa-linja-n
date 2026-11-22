// Render adapter for the sitelen pona parser/renderer: translates the
// renderer's canonical UCSUR code points into the sequences the Font Maker
// Ligatures TTF implements. Pure function, no DOM: unit-tested in
// tests/renderer-adapter.mjs.
export const RENDER_ADAPTER_ID = 'spfm-ligatures-v1';

const PI = 0xF194D;
const OLD_LONG_PI_START = 0xF1993;   // what the Ligatures font draws as the long-pi L
const OLD_LONG_PI_EXT = 0xF1994;
const LONG_START = 0xF1997, LONG_END = 0xF1998;
const REVERSE_LONG_START = 0xF199A, REVERSE_LONG_END = 0xF199B;
const OLD_LONG_EXT = 0xF1999;
const CLOSE_PAREN = 0x29;            // `)` ends a long pi in the Ligatures font

/**
 * Render adapter: canonical UCSUR code points -> what the Font Maker
 * Ligatures font implements.
 *
 *  pi U+F1997 a b c U+F1998  ->  U+F1993 a b c )    (one continuous long pi)
 *  U+F1993 a U+F1994 b ...   ->  U+F1993 a b ... )   (deprecated encoding)
 *  any other long-glyph head, reverse long glyphs, U+F1999
 *                            ->  the glyphs without the control characters
 *
 * Returns { renderCps, canonicalToRenderSpans } as the renderer requires.
 * The renderer does not call adapters for literal text or literal
 * cartouches; those (and U+F1992) are handled by the fonts themselves.
 */
export function spfmLigaturesAdapter({ canonicalCps }) {
  const cps = Array.from(canonicalCps || [], Number);
  const out = [];
  const spans = cps.map((_cp, canonicalIndex) => ({ canonicalIndex, renderStart: null, renderEnd: null }));
  const emit = (cp, ...indices) => {
    const at = out.length;
    if (cp != null) out.push(cp);
    for (const i of indices) {
      const s = spans[i];
      s.renderStart = s.renderStart == null ? at : Math.min(s.renderStart, at);
      s.renderEnd = s.renderEnd == null ? out.length : Math.max(s.renderEnd, out.length);
    }
  };
  let openOldLongPi = false;
  for (let i = 0; i < cps.length; i++) {
    const cp = cps[i];
    if (cp === PI && cps[i + 1] === LONG_START) {           // pi( ... )
      emit(OLD_LONG_PI_START, i, i + 1); i++; continue;
    }
    if (cp === LONG_END) {
      // Closes a pi(...) we converted; any other head simply loses its control.
      const headIsPi = cps.lastIndexOf(LONG_START, i) > 0 && cps[cps.lastIndexOf(LONG_START, i) - 1] === PI;
      emit(headIsPi ? CLOSE_PAREN : null, i); continue;
    }
    if (cp === OLD_LONG_PI_START) { openOldLongPi = true; emit(cp, i); continue; }
    if (cp === OLD_LONG_PI_EXT || cp === OLD_LONG_EXT || cp === LONG_START ||
        cp === REVERSE_LONG_START || cp === REVERSE_LONG_END) { emit(null, i); continue; }
    emit(cp, i);
  }
  if (openOldLongPi) out.push(CLOSE_PAREN);
  let cursor = 0;
  for (const s of spans) {
    if (s.renderStart == null) { s.renderStart = cursor; s.renderEnd = cursor; }
    else cursor = s.renderEnd;
  }
  return { renderCps: out, canonicalToRenderSpans: spans };
}

