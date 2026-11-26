/** Opt-in, editable contour repairs. No bitmap conversion, remote service or
 * new project schema. Safe cleanup only performs exact zero-length edits and
 * orientation normalisation already applied by the font path serializer.
 * The small-spike operation is explicitly separate because it removes ink. */
import {orientedContourPoints} from './bezier.js?v=0.3.42.2';

const clone=value=>structuredClone(value);
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const handleDistance=(h,p)=>Math.hypot(h[0]-p.x,h[1]-p.y);
const finite=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&
  Array.isArray(p.in)&&Array.isArray(p.out)&&p.in.length===2&&p.out.length===2&&
  [...p.in,...p.out].every(Number.isFinite);
function valid(contour){
  return Array.isArray(contour?.points)&&contour.points.every(finite)&&
    contour.points.length>=(contour.kind==='stroke'?2:3);
}
function zeroSegment(a,b,epsilon){
  return distance(a,b)<=epsilon&&handleDistance(a.out,a)<=epsilon&&handleDistance(b.in,b)<=epsilon;
}
function polygonDirectionChanged(a,b){
  return a.length===b.length&&a.some((node,i)=>node.x!==b[i].x||node.y!==b[i].y||
    node.in[0]!==b[i].in[0]||node.in[1]!==b[i].in[1]||
    node.out[0]!==b[i].out[0]||node.out[1]!==b[i].out[1]);
}
/** Safe, shape-preserving cleanup. Exact zero edges can be removed while
 * transferring the next node's OUT tangent to the survivor, keeping every
 * neighbouring cubic unchanged. Open stroke widths stay aligned to segments.
 * Returned coordinates never mutate the source. */
export function cleanContourExact(contour,{epsilon=1e-6}={}){
  if(!valid(contour))return {contour:clone(contour),removed:0,oriented:false,skipped:true};
  if(!Number.isFinite(epsilon)||epsilon<0||epsilon>0.00001)throw Error('Exact cleanup tolerance is out of range');
  const c=clone(contour),isStroke=c.kind==='stroke',open=isStroke&&!c.closed;
  let removed=0;
  for(let iteration=0;iteration<2048;iteration++){
    const n=c.points.length,min=isStroke?2:3;
    if(n<=min)break;
    let changed=false;
    const edgeCount=n-(open?1:0);
    for(let i=0;i<edgeCount;i++){
      const next=(i+1)%n,a=c.points[i],b=c.points[next];
      if(!zeroSegment(a,b,epsilon))continue;
      // An almost-zero anchor displacement may slightly change a curve; safe
      // cleanup accepts only EXACT coincident anchors (or machine precision).
      if(distance(a,b)>1e-9)continue;
      if(next===0){
        a.out=[...b.out];c.points.shift();
        if(isStroke&&Array.isArray(c.widths))c.widths.splice(i,1);
      }else{
        // The incoming edge of A and the outgoing edge of B are preserved;
        // only the strictly zero A -> B cubic disappears.
        a.out=[...b.out];c.points.splice(next,1);
        if(isStroke&&Array.isArray(c.widths))c.widths.splice(i,1);
      }
      removed++;changed=true;break;
    }
    if(!changed)break;
  }
  // The current SVG serializer already canonicalises these windings for
  // nonzero fill. Make the project data match its existing output exactly.
  let oriented=false;
  if(!isStroke){
    const aligned=orientedContourPoints(c);
    if(polygonDirectionChanged(c.points,aligned)){
      c.points=aligned.map(p=>clone(p));oriented=true;
    }
  }
  return {contour:c,removed,oriented,skipped:false};
}

/** Conservative detection of a short backtracking straight-line hairpin.
 * A tiny loop or deliberately sharp corner is NOT automatically a spike.
 * The third anchor must return to the first anchor's exact neighbourhood. */
export function findTinySpikes(contour,{maxLength=9,returnTolerance=.18}={}){
  const p=contour?.points;
  if(!valid(contour)||p.length<5)return [];
  const open=contour.kind==='stroke'&&!contour.closed;
  const results=[];
  for(let i=0;i<p.length-(open?2:0);i++){
    const a=p[i],b=p[(i+1)%p.length],c=p[(i+2)%p.length];
    const ab=distance(a,b),bc=distance(b,c),ac=distance(a,c);
    if(ab<.65||ab>maxLength||bc<.65||bc>maxLength||ac>returnTolerance)continue;
    if(handleDistance(a.out,a)>.05||handleDistance(b.in,b)>.05||
       handleDistance(b.out,b)>.05||handleDistance(c.in,c)>.05)continue;
    const cos=((b.x-a.x)*(c.x-b.x)+(b.y-a.y)*(c.y-b.y))/(ab*bc);
    if(cos>-.975)continue;
    results.push({nodeIndex:(i+1)%p.length,startIndex:i,length:Math.max(ab,bc),position:{x:b.x,y:b.y}});
  }
  return results;
}
/** User-approved removal of short backtracks, leaving neighbouring cubic
 * handles attached to the same anchors. Only the selected contour changes. */
export function removeTinySpikes(contour,options={}){
  if(!valid(contour))return {contour:clone(contour),removed:0};
  let out=clone(contour),removed=0;
  for(let iteration=0;iteration<100;iteration++){
    const spike=findTinySpikes(out,options)[0];
    if(!spike)break;
    const n=out.points.length,min=out.kind==='stroke'?2:3;
    if(n-2<min)break;
    const i=spike.startIndex,open=out.kind==='stroke'&&!out.closed;
    if(open){
      const a=out.points[i],c=out.points[i+2];
      a.out=[c.out[0]+a.x-c.x,c.out[1]+a.y-c.y];
      out.points.splice(i+1,2);
      if(Array.isArray(out.widths))out.widths.splice(i,2);
    }else{
      // Rotate the cyclic node list so the three spike nodes start at zero.
      out.points=[...out.points.slice(i),...out.points.slice(0,i)];
      if(out.kind==='stroke'&&Array.isArray(out.widths))out.widths=[...out.widths.slice(i),...out.widths.slice(0,i)];
      const [a,,c]=out.points;
      a.out=[c.out[0]+a.x-c.x,c.out[1]+a.y-c.y];
      out.points.splice(1,2);
      if(out.kind==='stroke'&&Array.isArray(out.widths))out.widths.splice(0,2);
    }
    removed++;
  }
  return {contour:out,removed};
}

/** Clean all active-layer contours in one reversible edit. Refuses to rewrite
 * malformed contours; those require inspecting their highlighted warnings. */
export function cleanContoursExact(contours){
  if(!Array.isArray(contours))throw Error('No editable outlines');
  let removed=0,oriented=0,skipped=0;
  const result=contours.map(c=>{
    const fix=cleanContourExact(c);
    removed+=fix.removed;oriented+=Number(fix.oriented);skipped+=Number(fix.skipped);
    return fix.contour;
  });
  return {contours:result,removed,oriented,skipped,changed:removed+oriented>0};
}

import {cubicFromAnchors,cubicSelfCrossing,cubicSubcurve,evalCubic,cubicIntersections} from './bezier-intersections.js?v=0.3.46.0';
/** Measure a candidate loop from one or two trimmed cubic portions. */
function loopMetrics(parts){
  const samples=[];
  for(let k=0;k<parts.length;k++)for(let j=0;j<=48;j++){
    if(k>0&&j===0)continue;
    samples.push(evalCubic(parts[k],j/48));
  }
  const xs=samples.map(p=>p.x),ys=samples.map(p=>p.y);
  const diameter=Math.hypot(Math.max(...xs)-Math.min(...xs),Math.max(...ys)-Math.min(...ys));
  let signedArea=0,length=0;
  for(let k=0;k<samples.length-1;k++){
    const p=samples[k],q=samples[k+1];signedArea+=p.x*q.y-q.x*p.y;length+=distance(p,q);
  }
  return {diameter,area:Math.abs(signedArea/2),length};
}
/** Detect microscopic closed loops between anchors and at adjacent junctions.
 * Same-cubic loops use an algebraic self-intersection solver. Adjacent-cubic
 * loops use bounded subdivision + checked Newton intersections. These findings
 * are advisory; normal painting never removes them automatically. */
export function findTinyBezierLoops(contour,{maxDiameter=12,maxArea=35,maxLength=45}={}){
  if(!valid(contour)||contour.kind==='stroke')return [];
  const found=[],n=contour.points.length;
  for(let i=0;i<n;i++){
    const a=contour.points[i],b=contour.points[(i+1)%n];
    const cubic=cubicFromAnchors(a,b),hit=cubicSelfCrossing(cubic);
    if(hit){
      const size=loopMetrics([cubicSubcurve(cubic,hit.t,hit.u)]);
      if(size.diameter<=maxDiameter&&size.area<=maxArea&&size.length<=maxLength&&size.length>1e-4){
        found.push({type:'single',segmentIndex:i,tStart:hit.t,tEnd:hit.u,position:hit.position,...size});
      }
    }
    // A particularly common join defect: two neighbouring cubics cross
    // again near their common junction, enclosing a microscopic hook/loop.
    const nextIndex=(i+1)%n,ending=(i+2)%n;
    const next=cubicFromAnchors(contour.points[nextIndex],contour.points[ending]);
    if(found.some(item=>item.type==='single'&&[i,nextIndex].includes(item.segmentIndex)))continue;
    let hits=[];
    try{hits=cubicIntersections(cubic,next,{tolerance:.008,maxVisits:3000});}catch(_){}
    for(const contact of hits){
      if(contact.kind!=='cross'||contact.t<.005||contact.t>.995||contact.u<.005||contact.u>.995)continue;
      const size=loopMetrics([cubicSubcurve(cubic,contact.t,1),cubicSubcurve(next,0,contact.u)]);
      if(size.diameter<=maxDiameter&&size.area<=maxArea&&size.length<=maxLength&&size.length>1e-4){
        found.push({type:'adjacent',segmentIndex:i,nextSegmentIndex:nextIndex,tStart:contact.t,tEnd:contact.u,position:contact.position,...size});
        break;
      }
    }
  }
  return found;
}
/** Explicit, minimally invasive removal: discard only the self-looping span,
 * preserve exact de Casteljau outer cubic segments and all other curves.
 * The replacement remains editable and carries no raster approximation. */
export function removeTinyBezierLoop(contour,options={}){
  if(!valid(contour)||contour.kind==='stroke')return {contour:clone(contour),removed:0};
  const candidate=findTinyBezierLoops(contour,options)[0];
  if(!candidate)return {contour:clone(contour),removed:0};
  const out=clone(contour),i=candidate.segmentIndex,n=out.points.length;
  const a=out.points[i],b=out.points[(i+1)%n];
  const first=cubicFromAnchors(a,b);
  const left=cubicSubcurve(first,0,candidate.tStart);
  let right,joint=candidate.position;
  if(candidate.type==='adjacent'){
    const after=out.points[(i+2)%n];
    const second=cubicFromAnchors(b,after);
    right=cubicSubcurve(second,candidate.tEnd,1);
    // Reuse B as the joined anchor; this keeps cyclic indexing and the other
    // nodes stable even when the faulty junction was the first node.
    b.x=joint.x;b.y=joint.y;
    b.in=[left[2].x,left[2].y];b.out=[right[1].x,right[1].y];
    after.in=[right[2].x,right[2].y];
  }else{
    right=cubicSubcurve(first,candidate.tEnd,1);
    b.in=[right[2].x,right[2].y];
    out.points.splice(i+1,0,{x:joint.x,y:joint.y,in:[left[2].x,left[2].y],out:[right[1].x,right[1].y]});
  }
  a.out=[left[1].x,left[1].y];
  return {contour:out,removed:1,type:candidate.type,area:candidate.area,diameter:candidate.diameter,segmentIndex:i};
}
