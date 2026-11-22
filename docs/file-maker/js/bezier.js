/* MIT — Native, editable cubic Bézier contours for glyphs.
 * Stored as anchors with absolute in/out control points.  No raster tracing
 * is involved; the resulting M/L/C/Z SVG path is retained in the project.
 */
const number=v=>Number.isFinite(v)?Number(v.toFixed(3)):0;
export function makeBezierAnchor(x,y){x=number(x);y=number(y);return {x,y,in:[x,y],out:[x,y]};}
export function moveBezierAnchor(node,x,y){const dx=x-node.x,dy=y-node.y;node.x=number(x);node.y=number(y);node.in=[number(node.in[0]+dx),number(node.in[1]+dy)];node.out=[number(node.out[0]+dx),number(node.out[1]+dy)];}
export function dragBezierTangent(node,x,y,which='out',mirror=true){
  const handle=[number(x),number(y)];node[which]=handle;
  if(mirror)node[which==='out'?'in':'out']=[number(node.x*2-x),number(node.y*2-y)];
}
// A closing gesture changes only the tangent of the final segment. At the
// first anchor we drag its IN handle opposite the mouse motion (standard Pen
// tool convention). At the last anchor we drag its OUT handle with the motion.
// Neither gesture alters the already-drawn adjacent segment's tangent.
export function dragBezierClosingTangent(points,closingIndex,dx,dy){
  if(!Array.isArray(points)||points.length<3)return false;
  if(!Number.isFinite(dx)||!Number.isFinite(dy))return false;
  if(closingIndex===0){
    const node=points[0];
    dragBezierTangent(node,node.x-dx,node.y-dy,'in',false);
  }else if(closingIndex===points.length-1){
    const node=points[closingIndex];
    dragBezierTangent(node,node.x+dx,node.y+dy,'out',false);
  }else return false;
  return true;
}
function joinSegment(a,b){
  const straight=Math.hypot(a.out[0]-a.x,a.out[1]-a.y)<.05&&Math.hypot(b.in[0]-b.x,b.in[1]-b.y)<.05;
  return straight?`L ${number(b.x)} ${number(b.y)}`:`C ${number(a.out[0])} ${number(a.out[1])} ${number(b.in[0])} ${number(b.in[1])} ${number(b.x)} ${number(b.y)}`;
}
// TrueType uses the nonzero winding fill rule.  We therefore make each
// completed Bézier contour's winding explicit instead of relying on SVG's
// evenodd rendering (which could produce a different glyph after export).
// In editor coordinates, positive signed area is clockwise; filled contours
// are normalised clockwise, and hole contours counterclockwise.  The Rust
// TTF writer flips the Y axis, preserving their opposite relative winding.
export function signedAnchorArea(points){
  if(!Array.isArray(points)||points.length<3)return 0;
  let twice=0;
  for(let i=0;i<points.length;i++){
    const a=points[i],b=points[(i+1)%points.length];
    twice+=a.x*b.y-b.x*a.y;
  }
  return twice/2;
}
export function orientedContourPoints(contour){
  const points=contour.points||[];
  const sign=contour.role==='hole'?-1:1;
  if(signedAnchorArea(points)*sign>=0)return points;
  // Reverse curve traversal AND exchange incoming/outgoing handles so the
  // visible Bézier geometry is unchanged by changing its fill role.
  return [...points].reverse().map(node=>({...node,in:[...node.out],out:[...node.in]}));
}
export function bezierPath(contours){
  if(!Array.isArray(contours))return '';
  const paths=[];
  for(const item of contours){const pts=orientedContourPoints(item);if(pts.length<3)continue;
    const commands=[`M ${number(pts[0].x)} ${number(pts[0].y)}`];
    for(let i=0;i<pts.length;i++)commands.push(joinSegment(pts[i],pts[(i+1)%pts.length]));
    commands.push('Z');paths.push(commands.join(' '));
  }
  return paths.join(' ');
}
export function bezierDraftPath(points){
  if(!points?.length)return '';
  const commands=[`M ${number(points[0].x)} ${number(points[0].y)}`];
  for(let i=1;i<points.length;i++)commands.push(joinSegment(points[i-1],points[i]));
  return commands.join(' ');
}
export function combineGlyphPaths(rasterPath,contours){return [rasterPath||'',bezierPath(contours)].filter(Boolean).join(' ');}
export function inferRasterPath(g){
  if(typeof g?.rasterPath==='string')return g.rasterPath;
  return Array.isArray(g?.bezierContours)&&g.bezierContours.length?'' :(g?.modified?g?.path||'':'');
}
