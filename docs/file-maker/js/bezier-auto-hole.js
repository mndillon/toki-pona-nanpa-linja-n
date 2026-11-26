/* MIT — infer whether a newly closed editable Bézier outline should subtract
 * ink. This uses only existing editable vector contours, never the grey source
 * reference. Sampling the cubic segments (not just their anchor points) avoids
 * mistaking a curve that bulges outside its parent for a contained hole.
 */
function flattenedPoints(points, steps=16) {
  if (!Array.isArray(points) || points.length < 3) return [];
  const out=[];
  for(let i=0;i<points.length;i++){
    const a=points[i], b=points[(i+1)%points.length];
    const p0={x:a.x,y:a.y},p1={x:a.out[0],y:a.out[1]},
      p2={x:b.in[0],y:b.in[1]},p3={x:b.x,y:b.y};
    out.push(p0);
    for(let j=1;j<steps;j++){
      const t=j/steps,u=1-t;
      out.push({
        x:u*u*u*p0.x+3*u*u*t*p1.x+3*u*t*t*p2.x+t*t*t*p3.x,
        y:u*u*u*p0.y+3*u*u*t*p1.y+3*u*t*t*p2.y+t*t*t*p3.y
      });
    }
  }
  return out;
}
function insidePolygon(p, polygon) {
  let inside=false;
  for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
    const a=polygon[i],b=polygon[j];
    if((a.y>p.y)!==(b.y>p.y) && p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)inside=!inside;
  }
  return inside;
}
// Unlike an SVG's isolated negative contour, a negative TrueType contour is
// only a visible hole when it lies inside a positive filled outline.
export function automaticBezierRole(points,existingContours) {
  if(!Array.isArray(existingContours)||!existingContours.some(c=>c.role!=='hole'&&c.kind!=='stroke'))return 'fill';
  const candidate=flattenedPoints(points);
  if(candidate.length<3)return 'fill';
  const contours=existingContours.filter(c=>c.kind!=='stroke').map(c=>({...c,flat:flattenedPoints(c.points)})).filter(c=>c.flat.length>=3);
  // Bound the work for unusually complex outlines; in normal glyphs every
  // subdivided cubic sample is checked. Skip irrelevant bounding boxes first.
  for(const c of contours){
    c.bounds={left:Math.min(...c.flat.map(p=>p.x)),right:Math.max(...c.flat.map(p=>p.x)),
      top:Math.min(...c.flat.map(p=>p.y)),bottom:Math.max(...c.flat.map(p=>p.y))};
  }
  const stride=Math.max(1,Math.ceil(candidate.length/512));
  // Checking the entire new boundary matters: a contour whose three anchors
  // fit inside the glyph can still bend outside of it via its Bézier handles.
  let contained=true;
  for(let i=0;i<candidate.length;i+=stride){
    const p=candidate[i];let layers=0;
    for(const contour of contours){
      const b=contour.bounds;
      if(p.x>b.left&&p.x<b.right&&p.y>b.top&&p.y<b.bottom&&insidePolygon(p,contour.flat))
        layers+=contour.role==='hole'?-1:1;
    }
    if(layers<=0){contained=false;break;}
  }
  return contained?'hole':'fill';
}
