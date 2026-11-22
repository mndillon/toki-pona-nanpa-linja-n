/* MIT — pure selection-box geometry for the glyph drawing editor.
 * The editable artwork is transformed by the controller; the original grey
 * source reference is deliberately not part of these calculations.
 */
const HANDLES = ['nw','n','ne','e','se','s','sw','w'];
export const SELECTION_HANDLE_CURSORS = Object.freeze({
 nw:'nwse-resize',se:'nwse-resize',ne:'nesw-resize',sw:'nesw-resize',
 n:'ns-resize',s:'ns-resize',e:'ew-resize',w:'ew-resize'
});
export function selectionHandlePoints(rect){
 if(!rect||rect.width<=0||rect.height<=0)return [];
 const x=rect.x,y=rect.y,mx=x+rect.width/2,my=y+rect.height/2;
 const right=x+rect.width,bottom=y+rect.height;
 const points={nw:[x,y],n:[mx,y],ne:[right,y],e:[right,my],
   se:[right,bottom],s:[mx,bottom],sw:[x,bottom],w:[x,my]};
 return HANDLES.map(id=>({id,x:points[id][0],y:points[id][1]}));
}
// The visible selection box is also the drag target. A small screen-pixel
// allowance lets a user grab ink sitting on its edge after Copy/Paste,
// without treating a distant click as a selection move.
export function hitSelectionBody(point,rect,padding=0){
 if(!point||!rect||!Number.isFinite(point.x)||!Number.isFinite(point.y)||
    !Number.isFinite(rect.x)||!Number.isFinite(rect.y)||
    !Number.isFinite(rect.width)||!Number.isFinite(rect.height)||
    rect.width<=0||rect.height<=0)return false;
 const gap=Math.max(0,Number(padding)||0);
 return point.x>=rect.x-gap&&point.x<=rect.x+rect.width+gap&&
   point.y>=rect.y-gap&&point.y<=rect.y+rect.height+gap;
}
export function hitSelectionHandle(point,rect,tolerance=10){
 const radius=Math.max(1,Number(tolerance)||10);
 let best=null,bestDist=radius*radius;
 for(const handle of selectionHandlePoints(rect)){
  const d=(point.x-handle.x)**2+(point.y-handle.y)**2;
  if(d<=bestDist){best=handle.id;bestDist=d;}
 }
 return best;
}
const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
/** Resize an axis-aligned selection from its opposite fixed edge/corner.
 * Corner handles preserve aspect ratio unless freeAspect is requested.
 * No reflection, negative scale, or movement beyond the artboard is allowed.
 */
export function resizeSelectionByHandle(source,handle,pointer,{boardWidth=400,boardHeight=430,
 minSize=2,freeAspect=false}={}){
 if(!source||!HANDLES.includes(handle)||source.width<=0||source.height<=0)return null;
 const west=handle.includes('w'),east=handle.includes('e');
 const north=handle.includes('n'),south=handle.includes('s');
 const horizontal=west||east,vertical=north||south;
 const anchorX=west?source.x+source.width:source.x;
 const anchorY=north?source.y+source.height:source.y;
 const dirX=west?-1:1,dirY=north?-1:1;
 const maxW=horizontal?(west?anchorX:boardWidth-anchorX):source.width;
 const maxH=vertical?(north?anchorY:boardHeight-anchorY):source.height;
 if(maxW<minSize||maxH<minSize)return null;
 let width=horizontal?clamp(dirX*(pointer.x-anchorX),minSize,maxW):source.width;
 let height=vertical?clamp(dirY*(pointer.y-anchorY),minSize,maxH):source.height;
 if(horizontal&&vertical&&!freeAspect){
  const sx=width/source.width,sy=height/source.height;
  const preferred=Math.abs(sx-1)>=Math.abs(sy-1)?sx:sy;
  const minimum=Math.max(minSize/source.width,minSize/source.height);
  const maximum=Math.min(maxW/source.width,maxH/source.height);
  const scale=clamp(preferred,minimum,maximum);
  width=source.width*scale;height=source.height*scale;
 }
 width=Math.round(width);height=Math.round(height);
 width=clamp(width,minSize,maxW);height=clamp(height,minSize,maxH);
 const rect={x:horizontal&&west?anchorX-width:source.x,
   y:vertical&&north?anchorY-height:source.y,width,height};
 // Use the immutable original rectangle to derive every frame's matrix.
 const sx=rect.width/source.width,sy=rect.height/source.height;
 const matrix={a:sx,b:0,c:0,d:sy,e:rect.x-source.x*sx,f:rect.y-source.y*sy};
 return {rect,matrix};
}
export function transformSelectionPolygon(polygon,matrix){
 return polygon?.map(p=>({x:matrix.a*p.x+matrix.c*p.y+matrix.e,
   y:matrix.b*p.x+matrix.d*p.y+matrix.f}))||null;
}
