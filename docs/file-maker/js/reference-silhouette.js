/**
 * Produce the non-exporting, filled guide for an original imported glyph.
 * The imported font is rendered into a transparent RGBA buffer by FontFace.
 * We keep its alpha coverage (including antialiased edges and transparent
 * counter-shapes/holes) and tint ALL filled pixels light grey. The output is
 * deliberately not an outline detector; solid portions must remain visible.
 * No original source pixel is modified, and none of this data is font ink.
 */
export function referenceSilhouettePixels(source, opacity = 0.35) {
  const input = source.data;
  if (!input || input.length !== source.width * source.height * 4) {
    throw new Error('Original glyph RGBA image dimensions are invalid');
  }
  const strength = Math.max(0, Math.min(1, Number.isFinite(opacity) ? opacity : 0.35));
  const output = new Uint8ClampedArray(input.length);
  for (let k = 0; k < input.length; k += 4) {
    // Grey source ink, not a grey rectangle. Transparent holes stay empty.
    output[k] = 112;
    output[k + 1] = 119;
    output[k + 2] = 130;
    output[k + 3] = Math.round(input[k + 3] * strength);
  }
  return output;
}
