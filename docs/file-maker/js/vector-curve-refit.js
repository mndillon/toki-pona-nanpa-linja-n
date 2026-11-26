/**
 * Bounded-error editable cubic reconstruction for the polygon boolean kernel.
 *
 * This does NOT claim to solve cubic/cubic intersections analytically. The
 * existing arrangement works on adaptively flattened edges. This module fits
 * low-node-count cubic segments back to *those resulting boundary samples*,
 * retaining hard corners, validating every fitted sample, and falling back to
 * straight edges whenever the fit exceeds the caller's tolerance. Both the
 * SVG and the editable Bézier nodes come from the same reconstructed contour.
 * No remote dependencies or non-deterministic solvers.
 */
const v=(x,y)=>({x,y});
const delta=(a,b)=>v(b.x-a.x,b.y-a.y);
const norm=a=>Math.hypot(a.x,a.y);
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const dot=(a,b)=>a.x*b.x+a.y*b.y;
const cross=(a,b)=>a.x*b.y-a.y*b.x;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const rd=x=>Number(x.toFixed(5));
const node=p=>({x:rd(p.x),y:rd(p.y),in:[rd(p.x),rd(p.y)],out:[rd(p.x),rd(p.y)]});
export function cubicPoint(p0,p1,p2,p3,t){
  const q=1-t,a=q*q*q,b=3*q*q*t,c=3*q*t*t,d=t*t*t;
  return v(a*p0.x+b*p1.x+c*p2.x+d*p3.x,a*p0.y+b*p1.y+c*p2.y+d*p3.y);
}
function nearLine(points){
  const start=points[0],end=points.at(-1),axis=delta(start,end),len=norm(axis);
  if(len<1e-8)return false;
  return points.every(p=>Math.abs(cross(axis,delta(start,p)))/len<=.007);
}
function fitCubic(points){
  const first=points[0],last=points.at(-1),count=points.length;
  const startVector=delta(first,points[1]),endVector=delta(points.at(-2),last);
  const sn=norm(startVector),en=norm(endVector),chord=dist(first,last);
  if(sn<1e-8||en<1e-8||chord<1e-8)return null;
  const start=v(startVector.x/sn,startVector.y/sn),end=v(endVector.x/en,endVector.y/en);
  const u=[0];let total=0;
  for(let i=1;i<count;i++){total+=dist(points[i-1],points[i]);u.push(total);}
  if(total<1e-8)return null;
  const A={aa:0,ab:0,bb:0,ax:0,bx:0};
  for(let i=1;i<count-1;i++){
    const t=u[i]/total,q=1-t,b1=3*q*q*t,b2=3*q*t*t;
    const a=v(start.x*b1,start.y*b1),b=v(-end.x*b2,-end.y*b2);
    const linear=v((q*q*q+3*q*q*t)*first.x+(3*q*t*t+t*t*t)*last.x,
                   (q*q*q+3*q*q*t)*first.y+(3*q*t*t+t*t*t)*last.y);
    const target=delta(linear,points[i]);
    A.aa+=dot(a,a);A.ab+=dot(a,b);A.bb+=dot(b,b);A.ax+=dot(a,target);A.bx+=dot(b,target);
  }
  const determinant=A.aa*A.bb-A.ab*A.ab;
  let alpha=chord/3,beta=chord/3;
  if(Math.abs(determinant)>1e-13){
    alpha=(A.ax*A.bb-A.bx*A.ab)/determinant;
    beta=(A.aa*A.bx-A.ab*A.ax)/determinant;
  }
  // A wrong-facing or oversized least-squares handle may produce a spike.
  // A chord-third seed is a safe alternate candidate for short smooth arcs.
  if(!Number.isFinite(alpha)||!Number.isFinite(beta)||alpha<0||beta<0||alpha>chord*3||beta>chord*3){
    alpha=chord/3;beta=chord/3;
  }
  const p1=v(first.x+start.x*alpha,first.y+start.y*alpha);
  const p2=v(last.x-end.x*beta,last.y-end.y*beta);
  let maximum=0,worst=1;
  for(let i=1;i<count-1;i++){
    const e=dist(cubicPoint(first,p1,p2,last,u[i]/total),points[i]);
    if(e>maximum){maximum=e;worst=i;}
  }
  return {p1,p2,maxError:maximum,worst};
}
function fitSection(points,tolerance,depth=0){
  const start=points[0],end=points.at(-1);
  if(nearLine(points)){
    // Only collapse points when they really lie on the same straight edge.
    return [{start,end,kind:'line'}];
  }
  if(points.length<4){
    // Never discard a bend merely because there are too few samples to fit
    // a well-constrained cubic. In particular, preserve crossing vertices.
    return points.slice(1).map((p,i)=>({start:points[i],end:p,kind:'line'}));
  }
  const fit=fitCubic(points);
  if(fit&&fit.maxError<=tolerance){
    return [{start,end,kind:'curve',p1:fit.p1,p2:fit.p2}];
  }
  if(depth>=10||points.length<=4){
    // Never accept a poor cubic fit. Preserve each original polygon edge.
    return points.slice(1).map((p,i)=>({start:points[i],end:p,kind:'line'}));
  }
  const split=clamp(fit?.worst??Math.floor(points.length/2),2,points.length-3);
  return [...fitSection(points.slice(0,split+1),tolerance,depth+1),
          ...fitSection(points.slice(split),tolerance,depth+1)];
}
function getCorners(poly){
  const corners=[];
  for(let i=0;i<poly.length;i++){
    const a=poly[(i+poly.length-1)%poly.length],b=poly[i],c=poly[(i+1)%poly.length];
    const u=delta(a,b),w=delta(b,c),len=norm(u)*norm(w);
    if(len<1e-10||Math.atan2(Math.abs(cross(u,w)),dot(u,w))>.68)corners.push(i);
  }
  if(corners.length>=2)return corners;
  // Fully smooth rings (such as circles) have no hard corners. Split at
  // approximately quarter-perimeter positions rather than fitting one loop
  // with coincident start/end anchors.
  const count=Math.min(4,Math.floor(poly.length/4));
  if(count<2)return [0];
  return Array.from({length:count},(_,i)=>Math.floor(i*poly.length/count));
}
/** Return a closed contour with true editable cubic handles. */
export function refitPolygonContour(poly,{tolerance=.17}={}){
  if(!Array.isArray(poly)||poly.length<3)return null;
  if(!Number.isFinite(tolerance)||tolerance<.005||tolerance>5)throw Error('Invalid cubic refit tolerance');
  const corners=getCorners(poly),pieces=[];
  for(let j=0;j<corners.length;j++){
    const begin=corners[j],end=corners[(j+1)%corners.length];
    const section=[poly[begin]];
    for(let i=(begin+1)%poly.length;i!==end;i=(i+1)%poly.length){
      section.push(poly[i]);
      if(section.length>poly.length+1)throw Error('Invalid refit contour');
    }
    section.push(poly[end]);
    pieces.push(...fitSection(section,tolerance));
  }
  const points=[];
  for(const piece of pieces){
    if(!points.length)points.push(node(piece.start));
    const prev=points.at(-1);
    if(dist(prev,piece.start)>1e-3)throw Error('Noncontinuous cubic reconstruction');
    if(piece.kind==='curve')prev.out=[rd(piece.p1.x),rd(piece.p1.y)];
    const closing=dist(piece.end,points[0])<1e-4;
    const next=closing?points[0]:node(piece.end);
    if(piece.kind==='curve')next.in=[rd(piece.p2.x),rd(piece.p2.y)];
    if(!closing)points.push(next);
  }
  if(points.length<3)return null;
  let signed=0;for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length];signed+=a.x*b.y-b.x*a.y;}
  return {role:signed<0?'hole':'fill',points};
}
/** A single authoritative path for display, save and the exported font. */
export function refittedContoursToPath(contours){
  return contours.map(c=>{
    const p=c.points;if(p.length<3)return '';
    const out=[`M ${rd(p[0].x)} ${rd(p[0].y)}`];
    for(let i=0;i<p.length;i++){
      const a=p[i],b=p[(i+1)%p.length];
      const straight=Math.hypot(a.out[0]-a.x,a.out[1]-a.y,b.in[0]-b.x,b.in[1]-b.y)<.00001;
      out.push(straight?`L ${rd(b.x)} ${rd(b.y)}`:`C ${rd(a.out[0])} ${rd(a.out[1])} ${rd(b.in[0])} ${rd(b.in[1])} ${rd(b.x)} ${rd(b.y)}`);
    }
    out.push('Z');return out.join(' ');
  }).filter(Boolean).join(' ');
}
