// Shared editor coordinate conversion. The 2048 UPM font geometry is never
// cropped/centred independently from editable ink. Saved per-glyph shifts are
// applied by the Rust TTF writer when translating SVG contour coordinates.
export const FONT_UNITS_PER_PIXEL=6.4;
export const X_ORIGIN=-32;
export const Y_BASELINE=288;
export function fontToPixel(x,y,shift={x:0,y:0}){
  return {x:X_ORIGIN+(x-shift.x)/FONT_UNITS_PER_PIXEL,
          y:Y_BASELINE+(shift.y-y)/FONT_UNITS_PER_PIXEL};
}
export function pixelToFont(x,y,shift={x:0,y:0}){
  return {x:(x-X_ORIGIN)*FONT_UNITS_PER_PIXEL+shift.x,
          y:(Y_BASELINE-y)*FONT_UNITS_PER_PIXEL+shift.y};
}
export function computeEditorShift(bounds,width=400,height=430,margin=20){
  if(!Array.isArray(bounds)||bounds.length!==4||bounds.some(v=>!Number.isFinite(v)))return {x:0,y:0};
  const [xmin,ymin,xmax,ymax]=bounds;
  let x=0,y=0;
  const left=fontToPixel(xmin,0).x,right=fontToPixel(xmax,0).x;
  if(left<margin)x=(left-margin)*FONT_UNITS_PER_PIXEL;
  else if(right>width-margin)x=(right-(width-margin))*FONT_UNITS_PER_PIXEL;
  const top=fontToPixel(0,ymax).y,bottom=fontToPixel(0,ymin).y;
  if(top<margin)y=(margin-top)*FONT_UNITS_PER_PIXEL;
  else if(bottom>height-margin)y=-(bottom-(height-margin))*FONT_UNITS_PER_PIXEL;
  return {x:Math.round(x),y:Math.round(y)};
}
