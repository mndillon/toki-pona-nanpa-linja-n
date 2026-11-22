// Compound display distinguishes project artwork from the original font.
// Source-font previews must never be treated as editable or exportable paths.
export function compoundPreviewKind(glyph){
  if(typeof glyph?.path==='string'&&glyph.path.trim())return 'edited';
  return glyph?.modified?'empty':'reference';
}
export function compoundPreviewStatus(hasOverride,referenceWords=[]){
  const base=hasOverride?'Custom override saved':'Preview of automatic arrangement (not an override)';
  const names=[...new Set(referenceWords)];
  if(!names.length)return base;
  if(hasOverride)return `${base} · ${names.join(', ')} shown from the original font for reference only. Copy or draw these glyphs before building this custom override.`;
  return `${base} · original font glyphs displayed where no editable outline exists`;
}
