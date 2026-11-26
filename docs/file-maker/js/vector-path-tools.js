/** Non-destructive point and path surgery for editable cubic Bézier objects. */
const round=v=>Number(v.toFixed(5));
const mix=(a,b,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
const clone=x=>structuredClone(x);
const anchor=(p,inn=p,out=p)=>({x:round(p[0]),y:round(p[1]),in:inn.map(round),out:out.map(round)});
/** Exact de Casteljau split: the resulting two cubics have the same geometry. */
export function insertBezierNode(contour,segment,t=.5){
  if(!contour?.points||!Number.isInteger(segment)||segment<0)throw Error('Choose a segment');
  const out=clone(contour),n=out.points.length,open=out.kind==='stroke'&&!out.closed;
  if(n<2||segment>=n-(open?1:0))throw Error('No following segment');
  if(!Number.isFinite(t)||t<=0||t>=1)throw Error('Split position must be inside the segment');
  const a=out.points[segment],b=out.points[(segment+1)%n],p=[a.x,a.y],q=[b.x,b.y];
  const p01=mix(p,a.out,t),p12=mix(a.out,b.in,t),p23=mix(b.in,q,t),p012=mix(p01,p12,t),p123=mix(p12,p23,t),middle=mix(p012,p123,t);
  a.out=p01.map(round);b.in=p23.map(round);
  const newNode=anchor(middle,p012,p123),index=segment+1;
  out.points.splice(index,0,newNode);
  if(out.kind==='stroke'){
    const widths=out.widths||Array(n-(out.closed?0:1)).fill(out.width||9);
    const width=widths[segment]||out.width||9;widths.splice(segment,1,width,width);out.widths=widths;
  }
  return {contour:out,index};
}
/** Remove a redundant point, while retaining an editable vector path. */
export function deleteBezierNode(contour,index){
  const out=clone(contour),n=out.points.length,open=out.kind==='stroke'&&!out.closed;
  if(!Number.isInteger(index)||index<0||index>=n)throw Error('Select a node');
  if(n<=(out.kind==='stroke'?2:3))throw Error('Cannot remove the last required node');
  if(out.kind==='stroke'){
    const widths=out.widths||Array(n-(out.closed?0:1)).fill(out.width||9);
    if(open&&index===0)widths.shift();
    else if(open&&index===n-1)widths.pop();
    else widths.splice(Math.max(0,index-1),1);
    out.widths=widths;
  }
  out.points.splice(index,1);
  // The removed point can change the curve; avoid inventing new long tangent
  // handles that would overshoot the existing glyph.
  return out;
}
/** Cut an open line/curve path at a selected *interior* anchor. */
export function splitStrokeAtNode(contour,index){
  const n=contour?.points?.length||0;
  if(contour?.kind!=='stroke'||contour.closed||!Number.isInteger(index)||index<=0||index>=n-1)throw Error('Choose an interior point of an open Line/Curve path');
  const widths=contour.widths||Array(n-1).fill(contour.width||9);
  return [
    {...clone(contour),points:clone(contour.points.slice(0,index+1)),widths:widths.slice(0,index)},
    {...clone(contour),points:clone(contour.points.slice(index)),widths:widths.slice(index)}
  ];
}
/** Simplify straight-edge contours by a bounded perpendicular deviation. */
export function simplifyPolygonNodes(contour,tolerance=.6){
  if(!contour?.points?.length)return clone(contour);
  const out=clone(contour),points=out.points;
  if(points.length<=3||points.some(p=>Math.hypot(p.in[0]-p.x,p.in[1]-p.y,p.out[0]-p.x,p.out[1]-p.y)>1e-5))return out;
  const threshold=Math.max(0,Number(tolerance)||0);
  for(let pass=0;pass<points.length;pass++){
    let changed=false;
    for(let i=0;i<out.points.length&&out.points.length>3;i++){
      const n=out.points.length,a=out.points[(i+n-1)%n],b=out.points[i],c=out.points[(i+1)%n];
      const dx=c.x-a.x,dy=c.y-a.y,len=Math.hypot(dx,dy);
      if(len<1e-8)continue;
      const t=((b.x-a.x)*dx+(b.y-a.y)*dy)/(len*len);
      const dist=Math.abs((b.x-a.x)*dy-(b.y-a.y)*dx)/len;
      if(t>0&&t<1&&dist<=threshold){out.points.splice(i,1);changed=true;break;}
    }
    if(!changed)break;
  }
  return out;
}

/** Exact locations where a cubic has a horizontal or vertical tangent.
 * Results are parametric t-values, not approximated click coordinates. */
export function cubicExtrema(start,end){
  if(!start||!end||!Array.isArray(start.out)||!Array.isArray(end.in)||start.out.length!==2||end.in.length!==2)
    throw Error('Invalid cubic handles');
  const values=[start.x,start.y,...start.out,...end.in,end.x,end.y];
  if(values.some(n=>!Number.isFinite(n)))throw Error('Non-finite cubic coordinates');
  const roots=[];
  for(let axis=0;axis<2;axis++){
    const p0=axis===0?start.x:start.y,p1=start.out[axis],p2=end.in[axis],p3=axis===0?end.x:end.y;
    const A=-p0+3*p1-3*p2+p3,B=2*(p0-2*p1+p2),C=p1-p0;
    if(Math.abs(A)<1e-12){if(Math.abs(B)>1e-12)roots.push(-C/B);continue;}
    const discriminant=B*B-4*A*C;
    if(discriminant<0)continue;
    const sqrt=Math.sqrt(discriminant);
    // Numerically stable quadratic formula limits loss of precision on
    // near-linear segments with one distant invalid root.
    const q=-(B+Math.sign(B||1)*sqrt)/2;
    if(Math.abs(q)>1e-12)roots.push(q/A,C/q);
    else roots.push(-B/(2*A));
  }
  return roots.filter(t=>Number.isFinite(t)&&t>1e-6&&t<1-1e-6)
    .sort((a,b)=>a-b).filter((t,i,array)=>i===0||Math.abs(t-array[i-1])>1e-7);
}
/** Insert all geometric extrema in a closed or open editable cubic contour.
 * Splits run from the end to the start so pre-existing node indices remain
 * stable; each segment is subdivided in descending t with de Casteljau.
 * The caller can inject the WASM implementation for the actual splits. */
export function insertContourExtrema(contour,split=insertBezierNode,extrema=cubicExtrema){
  if(!Array.isArray(contour?.points)||contour.points.length<2)throw Error('Choose an editable path');
  let current=structuredClone(contour),inserted=0;
  const originalCount=current.points.length,open=current.kind==='stroke'&&!current.closed;
  for(let i=originalCount-(open?2:1);i>=0;i--){
    const a=current.points[i],b=current.points[(i+1)%current.points.length];
    const ts=extrema(a,b);
    let upper=1;
    for(let j=ts.length-1;j>=0;j--){
      const local=ts[j]/upper;
      // Do not turn nearly coincident extrema into tiny spikes.
      if(local<=1e-6||local>=1-1e-6)continue;
      const result=split(current,i,local);current=result.contour;inserted++;
      upper=ts[j];
    }
  }
  return {contour:current,inserted};
}

/** Nearest parameter on a cubic segment for hit testing and accurate insertion.
 * The minimization uses coarse bracketing followed by deterministic golden
 * section refinement (rather than assuming the closest node is at t=.5).
 */
export function nearestCubicPoint(a,b,position,{samples=48}={}){
  if(!a||!b||!position||![a.x,a.y,b.x,b.y,position.x,position.y,...(a.out||[]),...(b.in||[])].every(Number.isFinite))
    throw Error('Invalid cubic coordinates');
  const count=Math.min(512,Math.max(16,Math.trunc(samples)));
  const at=t=>{
    const u=1-t,u2=u*u,t2=t*t;
    return {x:u2*u*a.x+3*u2*t*a.out[0]+3*u*t2*b.in[0]+t2*t*b.x,
            y:u2*u*a.y+3*u2*t*a.out[1]+3*u*t2*b.in[1]+t2*t*b.y};
  };
  const square=t=>{const p=at(t);return (p.x-position.x)**2+(p.y-position.y)**2;};
  let best=0,distance=square(0);
  for(let i=1;i<=count;i++){
    const d=square(i/count);if(d<distance){best=i;distance=d;}
  }
  let lo=Math.max(0,(best-1)/count),hi=Math.min(1,(best+1)/count);
  const ratio=(Math.sqrt(5)-1)/2;
  let c=hi-ratio*(hi-lo),d=lo+ratio*(hi-lo),fc=square(c),fd=square(d);
  for(let i=0;i<30;i++){
    if(fc<fd){hi=d;d=c;fd=fc;c=hi-ratio*(hi-lo);fc=square(c);}
    else{lo=c;c=d;fc=fd;d=lo+ratio*(hi-lo);fd=square(d);}
  }
  const t=(lo+hi)/2,p=at(t);
  return {t,x:p.x,y:p.y,distance:Math.hypot(p.x-position.x,p.y-position.y)};
}
export function nearestContourSegment(contours,position,maxDistance=8){
  if(!Number.isFinite(maxDistance)||maxDistance<0)throw Error('Invalid point selection radius');
  let closest=null;
  for(let ci=0;ci<(contours||[]).length;ci++){
    const c=contours[ci];if(!Array.isArray(c?.points))continue;
    const n=c.points.length,open=c.kind==='stroke'&&!c.closed;
    for(let i=0;i<n-(open?1:0);i++){
      const a=c.points[i],b=c.points[(i+1)%n];
      let hit;
      try{hit=nearestCubicPoint(a,b,position);}catch(_){continue;}
      if(hit.distance<=maxDistance&&(!closest||hit.distance<closest.distance))closest={ci,segment:i,...hit};
    }
  }
  return closest;
}
