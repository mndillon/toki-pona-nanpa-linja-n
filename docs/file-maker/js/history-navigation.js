/* Read-only classification of project history entries by affected glyph.
 * Legacy saved history has no explicit glyph id; derive it from target/key. */
const GLYPH_TARGETS=new Set(['glyph','glyphWithLicences','selectedWidth','selectionFill','selectionTransform','bezierDraft','bezierFinish','bezierPoint']);
export function historyGlyphIndex(change){
 if(!change||!GLYPH_TARGETS.has(change.target))return null;
 const raw=change.target==='bezierPoint'?String(change.key).split(':')[0]:String(change.key);
 if(!/^(0|[1-9]\d*)$/.test(raw))return null;
 const i=Number(raw);return Number.isSafeInteger(i)?i:null;
}
export function historyWouldSwitchGlyph(change,currentGlyphIndex){
 const destination=historyGlyphIndex(change);
 return destination!==null&&destination!==currentGlyphIndex;
}
