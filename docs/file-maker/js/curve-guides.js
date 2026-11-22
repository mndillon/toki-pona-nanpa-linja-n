/* Curved-line editor's two-step visible bend guide. */
export function defaultCurveBend(start,end){
 const dx=end.x-start.x,dy=end.y-start.y,length=Math.hypot(dx,dy)||1;
 let nx=-dy/length,ny=dx/length;
 // Consistent topward arc for horizontal strokes, rightward for vertical ones.
 if(Math.abs(dx)>=Math.abs(dy)?ny>0:nx<0){nx=-nx;ny=-ny;}
 const bulge=Math.max(12,Math.min(56,length*.23));
 return {x:(start.x+end.x)/2+nx*bulge,y:(start.y+end.y)/2+ny*bulge};
}
export function curveControlPoint(start,end,bend){
 return {x:2*bend.x-(start.x+end.x)/2,y:2*bend.y-(start.y+end.y)/2};
}
export function curveBendFromPointer(pending,point,handleRadius=14){
 if(!point)return pending.bend;
 return Math.hypot(point.x-pending.bend.x,point.y-pending.bend.y)<=handleRadius?pending.bend:point;
}
