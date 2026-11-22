/* MIT — Pointer hit-testing for editable contours.
 * Distances are specified in screen CSS pixels so zooming does not turn
 * Bézier anchors into tiny, almost impossible targets.
 */
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
export function bezierRadiusOnCanvas(rect,width,height,screenPixels){
  const sx=Math.abs(Number(rect?.width)||0)/width;
  const sy=Math.abs(Number(rect?.height)||0)/height;
  const scale=Math.min(sx||Infinity,sy||Infinity);
  return screenPixels/(Number.isFinite(scale)&&scale>0?scale:1);
}
export function closingBezierAnchor(points,p,radius){
  if(!Array.isArray(points)||points.length<3)return -1;
  const first=dist(points[0],p),last=dist(points[points.length-1],p);
  const firstOk=first<=radius,lastOk=last<=radius;
  if(!firstOk&&!lastOk)return -1;
  return firstOk&&(!lastOk||first<=last)?0:points.length-1;
}
export function hitBezierNode(contours,p,anchorRadius,handleRadius){
  if(!Array.isArray(contours))return null;
  // Anchors take precedence over control handles, even when a handle from an
  // adjacent point is marginally closer. This is especially important for
  // small outlines and their third/closing point.
  let anchor=null,min=anchorRadius;
  for(let ci=0;ci<contours.length;ci++)for(let ni=0;ni<(contours[ci]?.points||[]).length;ni++){
    const node=contours[ci].points[ni];
    const d=dist(node,p);
    if(d<=min){min=d;anchor={ci,ni,part:'anchor'};}
  }
  if(anchor)return anchor;
  let handle=null;min=handleRadius;
  for(let ci=0;ci<contours.length;ci++)for(let ni=0;ni<(contours[ci]?.points||[]).length;ni++){
    const node=contours[ci].points[ni];
    for(const which of ['in','out']){
      if(!Array.isArray(node[which]))continue;
      const point={x:node[which][0],y:node[which][1]};
      if(dist(node,point)<2)continue;
      const d=dist(point,p);
      if(d<=min){min=d;handle={ci,ni,part:which};}
    }
  }
  return handle;
}
