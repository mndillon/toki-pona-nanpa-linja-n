/**
 * Local, dependency-free cubic Bézier intersection analysis.
 * Exact algebraic solution for the two parameters of a *single cubic's*
 * self-intersection; analytical cubic-line roots; bounded adaptive subdivision
 * + derivative-based refinement for cubic/cubic pairs. The latter is numerical,
 * NOT a symbolic, certified exact cubic/cubic solver.
 * No editing operations take place in this module.
 */
const EPS=1e-10;
const pt=(x,y)=>({x,y});
const delta=(a,b)=>pt(a.x-b.x,a.y-b.y);
const cross=(a,b)=>a.x*b.y-a.y*b.x;
const dot=(a,b)=>a.x*b.x+a.y*b.y;
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const lerp=(a,b,t)=>pt(a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t);
export function cubicFromAnchors(a,b){
  if(!a||!b||!Array.isArray(a.out)||!Array.isArray(b.in)||a.out.length!==2||b.in.length!==2)
    throw Error('Incomplete Bézier node');
  const points=[pt(a.x,a.y),pt(a.out[0],a.out[1]),pt(b.in[0],b.in[1]),pt(b.x,b.y)];
  if(points.some(p=>![p.x,p.y].every(Number.isFinite)))throw Error('Invalid Bézier coordinates');
  return points;
}
export function evalCubic(c,t){
  const u=1-t;return pt(u*u*u*c[0].x+3*u*u*t*c[1].x+3*u*t*t*c[2].x+t*t*t*c[3].x,
    u*u*u*c[0].y+3*u*u*t*c[1].y+3*u*t*t*c[2].y+t*t*t*c[3].y);
}
export function derivativeCubic(c,t){
  const u=1-t;return pt(3*(u*u*(c[1].x-c[0].x)+2*u*t*(c[2].x-c[1].x)+t*t*(c[3].x-c[2].x)),
    3*(u*u*(c[1].y-c[0].y)+2*u*t*(c[2].y-c[1].y)+t*t*(c[3].y-c[2].y)));
}
export function splitCubic(c,t){
  const a=lerp(c[0],c[1],t),b=lerp(c[1],c[2],t),d=lerp(c[2],c[3],t);
  const e=lerp(a,b,t),f=lerp(b,d,t),g=lerp(e,f,t);
  return [[c[0],a,e,g],[g,f,d,c[3]]];
}
export function cubicSubcurve(c,t0,t1){
  if(!(t0>=0&&t0<t1&&t1<=1))throw Error('Invalid Bézier subcurve');
  if(t1===1)return splitCubic(c,t0)[1];
  return splitCubic(splitCubic(c,t1)[0],t0/t1)[1];
}
/** A t/u pair solving C(t)=C(u), t !== u, via symmetric cubics.
 * Unlike flattening, this detects microscopic loops between anchor points. */
export function cubicSelfCrossing(c,{minimumSeparation=1e-5,pointTolerance=1e-5}={}){
  const [p0,p1,p2,p3]=c;
  const A=pt(-p0.x+3*p1.x-3*p2.x+p3.x,-p0.y+3*p1.y-3*p2.y+p3.y);
  const B=pt(3*p0.x-6*p1.x+3*p2.x,3*p0.y-6*p1.y+3*p2.y);
  const C=pt(-3*p0.x+3*p1.x,-3*p0.y+3*p1.y);
  const det=cross(A,B),scale=Math.max(1,Math.hypot(A.x,A.y)*Math.hypot(B.x,B.y));
  if(Math.abs(det)<EPS*scale)return null; // degenerate, cusp or retraced curve
  const x=cross(pt(-C.x,-C.y),B)/det;  // t²+tu+u²
  const s=cross(A,pt(-C.x,-C.y))/det;  // t+u
  const product=s*s-x,disc=s*s-4*product;
  if(!(disc>0))return null;
  const root=Math.sqrt(disc),t=(s-root)/2,u=(s+root)/2;
  if(!(t>1e-7&&u<1-1e-7&&u-t>minimumSeparation))return null;
  const start=evalCubic(c,t),end=evalCubic(c,u);
  if(dist(start,end)>pointTolerance)return null;
  return {t,u,position:lerp(start,end,.5),residual:dist(start,end)};
}
function box(c){const xs=c.map(p=>p.x),ys=c.map(p=>p.y);return {minX:Math.min(...xs),maxX:Math.max(...xs),minY:Math.min(...ys),maxY:Math.max(...ys)};}
function overlaps(a,b,e){return a.maxX+e>=b.minX&&b.maxX+e>=a.minX&&a.maxY+e>=b.minY&&b.maxY+e>=a.minY;}
function extent(b){return Math.max(b.maxX-b.minX,b.maxY-b.minY);}
function lineLike(c){
  const v=delta(c[3],c[0]),m=Math.hypot(v.x,v.y);
  if(m<1e-9)return false;
  const projections=c.slice(1,3).map(p=>dot(delta(p,c[0]),v)/(m*m));
  return c.slice(1,3).every(p=>Math.abs(cross(delta(p,c[0]),v))<=m*1e-7) &&
    projections[0]>=-1e-7&&projections[1]<=1+1e-7&&projections[1]>=projections[0]-1e-7;
}
function rootsQuadratic(a,b,c){
  if(Math.abs(a)<EPS)return Math.abs(b)<EPS?[]:[-c/b];
  const d=b*b-4*a*c;if(d<0)return [];
  const sqrt=Math.sqrt(d),q=-(b+Math.sign(b||1)*sqrt)/2;
  return Math.abs(q)<EPS?[-b/(2*a)]:[q/a,c/q];
}
/** Analytic cubic polynomial roots in [0,1]: derivative extrema isolate
 * intervals, bisection then Newton. Includes even-multiplicity tangencies. */
export function rootsCubic01(c0,c1,c2,c3){
  const f=t=>((c3*t+c2)*t+c1)*t+c0;
  const boundaries=[0,...rootsQuadratic(3*c3,2*c2,c1).filter(t=>t>0&&t<1),1].sort((a,b)=>a-b);
  const roots=[];
  for(const x of boundaries)if(Math.abs(f(x))<=1e-9)roots.push(x);
  for(let i=0;i<boundaries.length-1;i++){
    let lo=boundaries[i],hi=boundaries[i+1],flo=f(lo),fhi=f(hi);
    if(flo*fhi>=0)continue;
    for(let j=0;j<65;j++){
      const mid=(lo+hi)/2,fm=f(mid);
      if(flo*fm<=0){hi=mid;fhi=fm;}else{lo=mid;flo=fm;}
    }
    roots.push((lo+hi)/2);
  }
  return roots.filter(t=>Number.isFinite(t)&&t>=0&&t<=1).sort((a,b)=>a-b)
    .filter((t,i,r)=>i===0||Math.abs(t-r[i-1])>1e-6);
}
/** Invert the monotonic parametric map of a geometrically straight cubic.
 * Important: a Bézier with endpoint-pinned handles is NOT linearly parameterised. */
function straightCubicParameter(curve,position){
  const v=delta(curve[3],curve[0]);
  const axis=Math.abs(v.x)>Math.abs(v.y)?'x':'y';
  const initial=curve[0][axis],final=curve[3][axis],target=position[axis];
  if(Math.abs(target-initial)<1e-9)return 0;
  if(Math.abs(target-final)<1e-9)return 1;
  let lo=0,hi=1;
  for(let k=0;k<56;k++){
    const mid=(lo+hi)/2,f=evalCubic(curve,mid)[axis];
    if((f<target)===(final>initial))lo=mid;else hi=mid;
  }
  return (lo+hi)/2;
}
function lineCubicHits(line,curve,tolerance){
  const v=delta(line[3],line[0]),len2=dot(v,v);
  if(len2<EPS)return [];
  const f=curve.map(p=>cross(delta(p,line[0]),v));
  // Bernstein to power coefficients.
  const a=f[0],b=3*(f[1]-f[0]),c=3*(f[0]-2*f[1]+f[2]),d=-f[0]+3*f[1]-3*f[2]+f[3];
  // A wholly collinear Bézier is an overlapping-edges problem, not an isolated intersection.
  if(Math.max(...f.map(Math.abs))<1e-8)return [];
  const hits=[];
  for(const u of rootsCubic01(a,b,c,d)){
    const p=evalCubic(curve,u),s=dot(delta(p,line[0]),v)/len2;
    if(s< -1e-7||s>1+1e-7)continue;
    const t=straightCubicParameter(line,p),q=evalCubic(line,t),residual=dist(p,q);
    if(residual<=tolerance)hits.push({t,u,position:lerp(p,q,.5),residual,kind:Math.abs(cross(derivativeCubic(line,t),derivativeCubic(curve,u)))<1e-7?'touch':'cross'});
  }
  return hits;
}
function refine(a,b,t,u,tol){
  let best={t,u,residual:Infinity};
  for(let k=0;k<18;k++){
    const p=evalCubic(a,t),q=evalCubic(b,u),r=delta(p,q),err=Math.hypot(r.x,r.y);
    if(err<best.residual)best={t,u,residual:err};
    if(err<=tol*.025)break;
    const da=derivativeCubic(a,t),db=derivativeCubic(b,u),det=cross(da,db);
    if(Math.abs(det)<1e-12)break;
    // Newton system: da*dt - db*du = q-p
    const dt=-cross(r,db)/det,du=-cross(r,da)/det;
    if(!Number.isFinite(dt)||!Number.isFinite(du))break;
    t=Math.max(0,Math.min(1,t+dt));u=Math.max(0,Math.min(1,u+du));
  }
  if(best.residual>tol||best.t<-1e-6||best.t>1+1e-6||best.u<-1e-6||best.u>1+1e-6)return null;
  const p=evalCubic(a,best.t),q=evalCubic(b,best.u),da=derivativeCubic(a,best.t),db=derivativeCubic(b,best.u);
  const tangentCross=Math.abs(cross(da,db)),speed=Math.max(1,Math.hypot(da.x,da.y)*Math.hypot(db.x,db.y));
  return {...best,position:lerp(p,q,.5),kind:tangentCross/speed<.001?'touch':'cross'};
}
/** Cubic/cubic intersections, with hull-based adaptive isolation and Newton
 * refinement. Result residual is validated against the ORIGINAL curves.
 * Near-coincident curves/tangencies may return an inconclusive/empty set. */
export function cubicIntersections(a,b,{tolerance=.025,maxVisits=24000}={}){
  if(![...a,...b].every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)))throw Error('Non-finite cubic input');
  if(!Number.isFinite(tolerance)||tolerance<=0||tolerance>.5)throw Error('Invalid intersection tolerance');
  const ba=box(a),bb=box(b);
  if(!overlaps(ba,bb,tolerance))return [];
  const aLine=lineLike(a),bLine=lineLike(b);
  if(aLine!==bLine){
    const raw=aLine?lineCubicHits(a,b,tolerance):lineCubicHits(b,a,tolerance);
    return aLine?raw:raw.map(({t,u,...rest})=>({...rest,t:u,u:t}));
  }
  if(aLine&&bLine){
    const v=delta(a[3],a[0]),w=delta(b[3],b[0]),den=cross(v,w);
    if(Math.abs(den)<1e-9)return [];
    const d=delta(b[0],a[0]),x=cross(d,w)/den,y=cross(d,v)/den;
    if(x<-1e-8||x>1+1e-8||y<-1e-8||y>1+1e-8)return [];
    const p=lerp(a[0],a[3],x),u=lerp(b[0],b[3],y);
    // Linear interpolation is geometrically correct; t/u may differ for cubic lines.
    return [{t:straightCubicParameter(a,p),u:straightCubicParameter(b,u),position:lerp(p,u,.5),residual:dist(p,u),kind:'cross'}];
  }
  let visits=0,inconclusive=false;const stack=[{a,b,ta:0,tb:0,ua:1,ub:1,depth:0}],hits=[];
  while(stack.length){
    const s=stack.pop();if(++visits>maxVisits){inconclusive=true;break;}
    const x=box(s.a),y=box(s.b);
    if(!overlaps(x,y,tolerance*.1))continue;
    if(s.depth>=34||(extent(x)<=tolerance*.4&&extent(y)<=tolerance*.4)){
      const hit=refine(a,b,(s.ta+s.ua)/2,(s.tb+s.ub)/2,tolerance);
      if(hit&&!hits.some(h=>Math.hypot(h.t-hit.t,h.u-hit.u)<.005&&dist(h.position,hit.position)<tolerance*2))hits.push(hit);
      continue;
    }
    if(extent(x)*(s.ua-s.ta)>=extent(y)*(s.ub-s.tb)){
      const [l,r]=splitCubic(s.a,.5),m=(s.ta+s.ua)/2;
      stack.push({...s,a:l,ua:m,depth:s.depth+1},{...s,a:r,ta:m,depth:s.depth+1});
    }else{
      const [l,r]=splitCubic(s.b,.5),m=(s.tb+s.ub)/2;
      stack.push({...s,b:l,ub:m,depth:s.depth+1},{...s,b:r,tb:m,depth:s.depth+1});
    }
  }
  hits.sort((p,q)=>p.t-q.t);
  if(inconclusive)hits.inconclusive=true;
  return hits;
}
