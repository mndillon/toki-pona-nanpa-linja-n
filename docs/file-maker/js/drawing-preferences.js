/** Project-level drawing defaults. These change only newly drawn artwork,
 * never existing outlines or font metrics. Old projects use the original UI
 * defaults until the user chooses different settings.
 */
export const DEFAULT_DRAWING_PREFERENCES=Object.freeze({
  width:9,smoothing:55,autoShape:false,filledShape:false,fromCenter:false,lineCap:'round',tipShape:'round'
});
export function normalizeDrawingPreferences(value={}){
  const src=value&&typeof value==='object'&&!Array.isArray(value)?value:{};
  const width=Number(src.width),smoothing=Number(src.smoothing);
  return {
    width:Number.isFinite(width)?Math.max(1,Math.min(100,Math.round(width))):DEFAULT_DRAWING_PREFERENCES.width,
    smoothing:Number.isFinite(smoothing)?Math.max(0,Math.min(100,Math.round(smoothing/5)*5)):DEFAULT_DRAWING_PREFERENCES.smoothing,
    autoShape:src.autoShape===true,
    filledShape:src.filledShape===true,
    fromCenter:src.fromCenter===true,
    lineCap:['round','flat','square'].includes(src.lineCap)?src.lineCap:'round',
    tipShape:src.tipShape==='square'?'square':'round'
  };
}
/** Holding Alt/Option temporarily reverses the saved origin preference.
 * A checkbox alternative is needed on Linux where Alt+drag can move windows.
 */
export function shapeFromCenter(preference,altKey=false){return Boolean(preference)!==Boolean(altKey);}
