/** Precise, local-first outline diagnostics. No glyph is changed automatically. */
import {bezierPath,signedAnchorArea} from './bezier.js?v=0.3.42.2';
import {flattenSvgContours,signedArea,pointInNonZero} from './vector-boolean.js?v=0.3.45.0';
import {findTinySpikes,findTinyBezierLoops} from './contour-repair.js?v=0.3.46.0';
import {cubicFromAnchors,cubicSelfCrossing,cubicIntersections} from './bezier-intersections.js?v=0.3.46.0';
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const cross=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
const inside=(a,b,c)=>c>=Math.min(a,b)-1e-8&&c<=Math.max(a,b)+1e-8;
function intersection(a,b,c,d){
  const ab1=cross(a,b,c),ab2=cross(a,b,d),cd1=cross(c,d,a),cd2=cross(c,d,b);
  if(ab1*ab2>=-1e-8||cd1*cd2>=-1e-8)return null;
  const denom=(b.x-a.x)*(d.y-c.y)-(b.y-a.y)*(d.x-c.x);
  if(Math.abs(denom)<1e-8)return null;
  const t=((c.x-a.x)*(d.y-c.y)-(c.y-a.y)*(d.x-c.x))/denom;
  if(t<=1e-5||t>=1-1e-5)return null;
  const p={x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t};
  return inside(a.x,b.x,p.x)&&inside(a.y,b.y,p.y)&&inside(c.x,d.x,p.x)&&inside(c.y,d.y,p.y)?p:null;
}
/** Compare full Bézier geometry independent of the starting node and contour
 * direction. A reversed path must also exchange in/out tangents. No tolerance
 * is applied: visually similar but intentionally different glyphs do not flag. */
export function canonicalContourGeometryKey(points){
  if(!Array.isArray(points)||!points.length||points.length>512)return null;
  if(points.some(p=>!p||!Array.isArray(p.in)||p.in.length!==2||!Array.isArray(p.out)||p.out.length!==2||
    ![p.x,p.y,...p.in,...p.out].every(Number.isFinite)))return null;
  const q=v=>String(v);
  const pack=p=>[p.x,p.y,...p.in,...p.out].map(q).join(',');
  const forward=points.map(pack);
  const backward=[...points].reverse().map(p=>pack({...p,in:p.out,out:p.in}));
  // O(n²) canonicalisation is limited to 512 nodes; only used on inspection.
  const canonical=a=>{let best=null;for(let i=0;i<a.length;i++){
    const candidate=[...a.slice(i),...a.slice(0,i)].join('|');
    if(best===null||candidate<best)best=candidate;
  }return best;};
  const a=canonical(forward),b=canonical(backward);
  return a<b?a:b;
}
function intersectionsOnContour(points,{limit=4}={}){
  const result=[],n=points.length;
  if(n>160)return result; // avoid lag on exceptionally dense imported glyphs
  const segments=[];
  try{for(let i=0;i<n;i++)segments.push(cubicFromAnchors(points[i],points[(i+1)%n]));}
  catch(_){return result;}
  for(let i=0;i<n;i++){
    const same=cubicSelfCrossing(segments[i]);
    if(same){result.push({type:'self',position:same.position,segment:i});if(result.length>=limit)return result;}
    for(let j=i+1;j<n;j++){
      // Shared junction endpoints are expected and are NOT self-crossings.
      if(j===i+1||(i===0&&j===n-1))continue;
      let hits=[];try{hits=cubicIntersections(segments[i],segments[j],{tolerance:.018,maxVisits:3500});}catch(_){}
      if(hits.inconclusive)result.push({type:'uncertain',position:points[i],segment:i,other:j});
      for(const h of hits){
        if(h.t<=.0005||h.t>=.9995||h.u<=.0005||h.u>=.9995)continue;
        result.push({type:h.kind,position:h.position,segment:i,other:j,residual:h.residual});
        if(result.length>=limit)return result;
      }
    }
  }
  return result;
}
/** Positive-length collinear shared edge, not a merely touching vertex.
 * This is an advisory warning: touching/overlapping filled shapes are allowed. */
function sharedStraightBoundary(a,b){
  for(let i=0;i<a.length;i++){
    const start=a[i],end=a[(i+1)%a.length],first=cubicFromAnchors(start,end);
    const d=distance(start,end);if(d<.01)continue;
    if(Math.abs(cross(start,end,{x:first[1].x,y:first[1].y}))>d*.001||
       Math.abs(cross(start,end,{x:first[2].x,y:first[2].y}))>d*.001)continue;
    const vx=end.x-start.x,vy=end.y-start.y;
    for(let j=0;j<b.length;j++){
      const s=b[j],e=b[(j+1)%b.length],second=cubicFromAnchors(s,e);
      if(Math.abs(cross(start,end,s))>d*.001||Math.abs(cross(start,end,e))>d*.001)continue;
      if(Math.abs(cross(s,e,second[1]))>Math.max(.01,distance(s,e)*.001)||
         Math.abs(cross(s,e,second[2]))>Math.max(.01,distance(s,e)*.001))continue;
      const t0=((s.x-start.x)*vx+(s.y-start.y)*vy)/(d*d);
      const t1=((e.x-start.x)*vx+(e.y-start.y)*vy)/(d*d);
      const lo=Math.max(0,Math.min(t0,t1)),hi=Math.min(1,Math.max(t0,t1));
      if(hi-lo>.01/d)return {x:start.x+vx*(lo+hi)/2,y:start.y+vy*(lo+hi)/2};
    }
  }
  return null;
}
export function validateOutline(contours,{artboardWidth=400,artboardHeight=430,flatness=.4}={}){
  const issues=[];const warn=(type,ci,ni,message,p=null,severity='warning')=>{
    if(issues.length>=80)return;
    issues.push({type,contourIndex:ci,nodeIndex:ni,message,position:p?{x:p.x,y:p.y}:null,severity});
  };
  const filled=[];
  const duplicateKeys=new Map();
  (contours||[]).forEach((c,ci)=>{
    const pts=c?.points||[],isStroke=c.kind==='stroke',closed=!isStroke||c.closed;
    if(pts.length<(isStroke?2:3)){warn('short',ci,-1,'Too few points for this outline');return;}
    for(let ni=0;ni<pts.length;ni++){
      const p=pts[ni];if(!Number.isFinite(p.x)||!Number.isFinite(p.y)||!Array.isArray(p.in)||!Array.isArray(p.out)||p.in.length!==2||p.out.length!==2||[...p.in,...p.out].some(n=>!Number.isFinite(n))){warn('invalid',ci,ni,'Invalid or non-finite Bézier control point',p,'error');continue;}
      if(p.x<0||p.y<0||p.x>artboardWidth||p.y>artboardHeight)warn('bounds',ci,ni,'Anchor extends beyond the drawing artboard',p,'info');
      const next=pts[(ni+1)%pts.length];if((closed||ni<pts.length-1)&&distance(p,next)<.04)warn('duplicate',ci,ni,'Duplicate or nearly identical adjacent anchors',p);
      const tin=distance(p,{x:p.in[0],y:p.in[1]}),tout=distance(p,{x:p.out[0],y:p.out[1]});
      if(tin>artboardWidth*2||tout>artboardWidth*2)warn('handle',ci,ni,'Unusually long control handle',p);
    }
    for(const spike of findTinySpikes(c))warn('tiny-spike',ci,spike.nodeIndex,'Short backtracking spike; review before trimming',spike.position);
    if(closed){for(const loop of findTinyBezierLoops(c))warn('tiny-loop',ci,loop.segmentIndex,
      `Tiny Bézier loop within one segment (${loop.diameter.toFixed(1)} units); select and trim only if unintended`,loop.position);}
    if(!closed)return;
    try{
      // Sample the *actual cubic* curve, not just the anchor polygon, so tight
      // loops and spikes between anchors are detected too.
      const polys=flattenSvgContours(bezierPath([c]),flatness);
      filled.push({ci,role:c.role||'fill',polys,points:pts});
      // The TTF serializer already normalises fill/hole direction. Report a
      // mismatch without changing drawn geometry (Safe cleanup can align it).
      const area=signedAnchorArea(pts);
      if(Math.abs(area)>.1&&Math.sign(area)!==(c.role==='hole'?-1:1))
        warn('winding',ci,-1,'Contour direction differs from its fill/hole role; export normalises winding',pts[0],'info');
      const exactKey=canonicalContourGeometryKey(pts);
      if(exactKey){
        if(duplicateKeys.has(exactKey)){
          const first=duplicateKeys.get(exactKey);
          const sameRole=first.role===(c.role||'fill');
          warn(sameRole?'duplicate-contour':'coincident-boundaries',ci,-1,
            `${sameRole?'Duplicate':'Oppositely typed coincident'} outline; same boundary as outline ${first.ci+1} (independent of start point or direction)`,pts[0]);
        }else duplicateKeys.set(exactKey,{ci,role:c.role||'fill'});
      }
      const analytic=intersectionsOnContour(pts,{limit:4});
      for(const hit of analytic){
        if(hit.type==='self'&&findTinyBezierLoops(c).some(loop=>loop.segmentIndex===hit.segment))continue;
        const isInfo=hit.type==='touch'||hit.type==='uncertain';
        warn(hit.type==='touch'?'tangent-touch':hit.type==='uncertain'?'uncertain-intersection':'intersection',ci,-1,
          hit.type==='touch'?'Bézier segments touch tangentially; inspect if intentional':
          hit.type==='uncertain'?'Overlapping Bézier bounds are too complex for a reliable intersection result; inspect manually':
          'Bézier segments cross (measured on the original control curves)',hit.position,isInfo?'info':'error');
      }
      for(const poly of polys){
        if(Math.abs(signedArea(poly))<.25)warn('empty',ci,-1,'Degenerate or nearly zero-area contour',pts[0]);
        if(poly.length>1500){warn('complex',ci,-1,'Very complex outline; consider Simplify',pts[0],'info');continue;}
        const maxPairs=160000;let checks=0,found=analytic.length;
        for(let i=0;i<poly.length;i++)for(let j=i+2;j<poly.length;j++){
          if(i===0&&j===poly.length-1)continue;
          if(++checks>maxPairs)break;
          const hit=intersection(poly[i],poly[(i+1)%poly.length],poly[j],poly[(j+1)%poly.length]);
          if(hit&&analytic.length===0){warn('intersection',ci,-1,'Sampled outline indicates a possible intersection; inspect Bézier curves',hit,'error');if(++found>=4)break;}
        }
      }
    }catch(error){warn('invalid',ci,-1,'Cannot inspect outline: '+String(error.message||error),pts[0],'error');}
  });
  // Detect orphan holes, but avoid sampling a concave polygon at its centroid:
  // test its actual nodes against all filled outlines. A merely touching hole
  // stays advisory rather than being automatically deleted.
  const solidPolys=filled.filter(f=>f.role!=='hole').flatMap(f=>f.polys);
  for(const entry of filled.filter(f=>f.role==='hole')){
    const vertices=entry.polys.flat();
    if(!vertices.length)continue;
    if(!solidPolys.length){warn('orphan-hole',entry.ci,-1,'Hole has no filled parent outline',vertices[0]);continue;}
    // Per-solid containment avoids one clockwise solid cancelling another.
    // Every hole boundary vertex should lie inside its parent (modulo a
    // crossing/touching boundary; those remain advisory).
    const parent=filled.filter(f=>f.role!=='hole').find(f=>
      vertices.every(p=>pointInNonZero(f.polys,p)));
    if(!parent){
      const overlaps=vertices.some(p=>solidPolys.some(poly=>pointInNonZero([poly],p)));
      warn(overlaps?'protruding-hole':'orphan-hole',entry.ci,-1,
        overlaps?'Hole boundary extends outside its filled parent; inspect crossings':'Hole is outside all filled parent contours',vertices[0]);
    }
    for(const other of filled.filter(f=>f.role==='hole'&&f.ci!==entry.ci)){
      if(entry.ci>other.ci)continue;
      const otherVertices=other.polys.flat();
      if(otherVertices.length&&otherVertices.every(p=>pointInNonZero(entry.polys,p))){
        warn('nested-hole',other.ci,-1,'Hole nested inside another hole; check intended winding and fill',otherVertices[0],'info');
      }else if(vertices.every(p=>pointInNonZero(other.polys,p))){
        warn('nested-hole',entry.ci,-1,'Hole nested inside another hole; check intended winding and fill',vertices[0],'info');
      }
    }
  }
  // Partial shared edges can create duplicate outline segments after a union.
  // This is informational: glyph designers deliberately use touching shapes.
  for(let i=0;i<filled.length;i++)for(let j=i+1;j<filled.length;j++){
    const A=filled[i],B=filled[j];
    if(A.points.length>180||B.points.length>180)continue;
    try{
      const shared=sharedStraightBoundary(A.points,B.points);
      if(shared)warn('shared-edge',B.ci,-1,
        `Outline ${A.ci+1} shares a straight boundary with outline ${B.ci+1}; inspect before removing overlaps`,shared,'info');
    }catch(_){} // malformed input was already reported above
  }
  // Cross-contour crossings are not necessarily wrong: overlapping ink can be
  // intentional. Report them only as warnings, never silently rewrite them.
  for(let i=0;i<filled.length;i++)for(let j=i+1;j<filled.length;j++){
    const A=filled[i],B=filled[j];
    const a=A.polys.flat(),b=B.polys.flat();
    if(a.length<3||b.length<3||a.length*b.length>70000)continue;
    let hit=null;
    for(let k=0;k<a.length&&!hit;k++)for(let l=0;l<b.length;l++){
      hit=intersection(a[k],a[(k+1)%a.length],b[l],b[(l+1)%b.length]);
      if(hit)break;
    }
    if(hit)warn('contour-crossing',B.ci,-1,`Outline ${A.ci+1} crosses outline ${B.ci+1}; inspect overlap or hole boundaries`,hit);
  }
  return {issues,warnings:issues.map(x=>x.message),valid:!issues.some(x=>x.severity==='error'),count:issues.length};
}
