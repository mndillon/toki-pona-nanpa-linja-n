// Artboard viewport geometry only. This does not alter glyphs, their raster
// coordinates, any Bézier paths, or exported TrueType font data.
export const ARTBOARD_WIDTH=400;
export const ARTBOARD_HEIGHT=430; // True-font-coordinate drawing plane, including below-baseline glyphs
export const VIEW_MARGIN=14;

export function fitScale(width,height,margin=VIEW_MARGIN){
  if(!(Number.isFinite(width)&&Number.isFinite(height)&&width>0&&height>0))return 1;
  return Math.max(0.01,Math.min((width-2*margin)/ARTBOARD_WIDTH,(height-2*margin)/ARTBOARD_HEIGHT));
}

export function clampOffset(offset,scale,width,height,margin=VIEW_MARGIN){
  const fit=(position,art,extent)=>{
    const actual=art*scale;
    if(actual<=extent-2*margin)return (extent-actual)/2;
    return Math.min(margin,Math.max(extent-margin-actual,position));
  };
  return {x:fit(offset.x,ARTBOARD_WIDTH,width),y:fit(offset.y,ARTBOARD_HEIGHT,height)};
}

// Keep precisely the same artwork coordinate beneath a zoom anchor.
export function zoomAt(offset,oldScale,newScale,anchor){
  return {x:anchor.x-(anchor.x-offset.x)*newScale/oldScale,
          y:anchor.y-(anchor.y-offset.y)*newScale/oldScale};
}

export function artboardPoint(offset,scale,anchor){
  return {x:(anchor.x-offset.x)/scale,y:(anchor.y-offset.y)/scale};
}
