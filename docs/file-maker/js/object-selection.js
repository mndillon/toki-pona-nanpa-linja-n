/** Click-to-select a single editable contour without changing drag-marquee.
 * The imported original and other layers are deliberately not hit-tested.
 */
import {bezierPath} from './bezier.js?v=0.3.42.2';
import {flattenSvgContours,pointInNonZero} from './vector-boolean.js?v=0.3.44.0';
import {nearestContourSegment} from './vector-path-tools.js?v=0.3.44.0';
export function editableObjectBounds(contour){
 if(!contour)return null;
 const polys=flattenSvgContours(bezierPath([contour]),.24);
 const points=polys.flat();
 if(!points.length)return null;
 const x=Math.min(...points.map(p=>p.x)),y=Math.min(...points.map(p=>p.y));
 const maxX=Math.max(...points.map(p=>p.x)),maxY=Math.max(...points.map(p=>p.y));
 const px=Math.max(0,Math.floor(x)-3),py=Math.max(0,Math.floor(y)-3);
 return {x:px,y:py,width:Math.max(2,Math.min(400,Math.ceil(maxX)+3)-px),height:Math.max(2,Math.min(430,Math.ceil(maxY)+3)-py)};
}
export function hitEditableObject(contours,p,{edgeTolerance=8}={}){
 if(!Array.isArray(contours)||!p||![p.x,p.y].every(Number.isFinite))return null;
 // Topmost editable contour wins. Always prefer an actual boundary hit to
 // prevent an enclosing silhouette from swallowing tiny details inside it.
 const near=nearestContourSegment(contours,p,edgeTolerance);
 if(near&&near.ci>=0)return {index:near.ci,kind:'edge'};
 for(let i=contours.length-1;i>=0;i--){
  const c=contours[i];if(!c||c.role==='hole')continue;
  const polys=flattenSvgContours(bezierPath([c]),.3);
  if(polys.length&&pointInNonZero(polys,p))return {index:i,kind:'fill'};
 }
 return null;
}
