/* MIT — deterministic, font-artboard selection geometry.
 * Operates only on editable contours; imported source reference layers are
 * deliberately excluded.  The browser controller owns raster operations.
 */
export function clampPoint(p,width,height){
  return {x:Math.max(0,Math.min(width,Number(p.x)||0)),y:Math.max(0,Math.min(height,Number(p.y)||0))};
}
export function selectionRect(a,b,width=400,height=430){
  const p=clampPoint(a,width,height),q=clampPoint(b,width,height);
  return {x:Math.floor(Math.min(p.x,q.x)),y:Math.floor(Math.min(p.y,q.y)),
    width:Math.ceil(Math.max(p.x,q.x))-Math.floor(Math.min(p.x,q.x)),
    height:Math.ceil(Math.max(p.y,q.y))-Math.floor(Math.min(p.y,q.y))};
}
export function nonemptySelection(r){return !!r&&r.width>=2&&r.height>=2;}
export function contourBounds(contour){
  const xs=[],ys=[];
  for(const node of contour?.points||[]){
    xs.push(node.x,node.in[0],node.out[0]);ys.push(node.y,node.in[1],node.out[1]);
  }
  return xs.length?{minX:Math.min(...xs),maxX:Math.max(...xs),minY:Math.min(...ys),maxY:Math.max(...ys)}:null;
}
export function classifyContour(contour,r){
  const b=contourBounds(contour);
  if(!b||!r)return 'outside';
  if(b.maxX<=r.x||b.minX>=r.x+r.width||b.maxY<=r.y||b.minY>=r.y+r.height)return 'outside';
  if(b.minX>=r.x&&b.maxX<=r.x+r.width&&b.minY>=r.y&&b.maxY<=r.y+r.height)return 'inside';
  return 'partial';
}
export function chosenContourIndices(contours,r){
  const result=[];(contours||[]).forEach((c,i)=>{if(classifyContour(c,r)==='inside')result.push(i);});return result;
}
export function translateContour(contour,dx,dy){
  const rounded=v=>Number(v.toFixed(3));
  return {...contour,points:contour.points.map(n=>({...n,
    x:rounded(n.x+dx),y:rounded(n.y+dy),
    in:[rounded(n.in[0]+dx),rounded(n.in[1]+dy)],
    out:[rounded(n.out[0]+dx),rounded(n.out[1]+dy)]
  }))};
}
export function translatedRect(r,dx,dy){return {...r,x:r.x+dx,y:r.y+dy};}
// Freehand lasso uses the same editable selection state, but retains a polygon
// mask for painted pixels instead of deleting everything in its bounding box.
export function polygonBounds(points,width=400,height=430){
 if(!Array.isArray(points)||!points.length)return null;
 const xs=points.map(p=>p.x),ys=points.map(p=>p.y);
 return selectionRect({x:Math.min(...xs),y:Math.min(...ys)},
                      {x:Math.max(...xs),y:Math.max(...ys)},width,height);
}
export function pointInPolygon(p,polygon){
 if(!Array.isArray(polygon)||polygon.length<3)return false;
 let inside=false;
 for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
  const a=polygon[i],b=polygon[j];
  if((a.y>p.y)!==(b.y>p.y) && p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)inside=!inside;
 }
 return inside;
}
export function contourWithinPolygon(contour,polygon){
 return !!contour?.points?.length&&contour.points.every(n=>
  [n,{x:n.in[0],y:n.in[1]},{x:n.out[0],y:n.out[1]}].every(p=>pointInPolygon(p,polygon)));
}
export function movePolygon(polygon,dx,dy){return polygon?.map(p=>({x:p.x+dx,y:p.y+dy}))||null;}
