import {refitPolygonContour,refittedContoursToPath} from './vector-curve-refit.js?v=0.3.44.0';
/**
 * Offline vector silhouette operations for monochrome font glyphs.
 * The input is the same SVG M/L/H/V/C/Q/Z path used by the current compiler.
 * Cubic edges are adaptively flattened to a caller-controlled error tolerance;
 * output is editable closed polygonal vector contours (never bitmap pixels).
 * No FontForge source or external service is used.
 *
 * This is the first-pass polygon arrangement engine, not an exact cubic-cubic
 * boolean kernel. Keep the source paths in the project's Undo history.
 */
const EPS=1e-8;
const point=(x,y)=>({x,y});
const xy=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const lerp=(a,b,t)=>point(a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t);
const cross=(a,b)=>a.x*b.y-a.y*b.x;
const sub=(a,b)=>point(a.x-b.x,a.y-b.y);
const round=n=>Number(n.toFixed(5));
const key=p=>`${round(p.x)},${round(p.y)}`;
const canonical=p=>point(round(p.x),round(p.y));
const TOKEN= /[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?/g;
const types=new Set('MmLlHhVvCcQqZz');
function cubicFlat(a,b,c,d,tolerance,output,depth=0){
  const direction=sub(d,a),len=Math.hypot(direction.x,direction.y);
  const deviation=p=>len>EPS?Math.abs(cross(sub(p,a),direction))/len:xy(p,a);
  if(depth>=12||Math.max(deviation(b),deviation(c))<=tolerance){output.push(d);return;}
  const ab=lerp(a,b,.5),bc=lerp(b,c,.5),cd=lerp(c,d,.5),abc=lerp(ab,bc,.5),bcd=lerp(bc,cd,.5),mid=lerp(abc,bcd,.5);
  cubicFlat(a,ab,abc,mid,tolerance,output,depth+1);cubicFlat(mid,bcd,cd,d,tolerance,output,depth+1);
}
/** Return arrays of polygon vertices. An unsupported SVG command fails loudly. */
export function flattenSvgContours(d,tolerance=.35){
  const src=String(d||'').trim();if(!src)return [];
  const tokens=src.match(TOKEN)||[];
  if(tokens.join('').toLowerCase()!==src.replace(/[\s,]/g,'').toLowerCase())throw Error('Malformed SVG outline syntax');
  const loops=[];let at=point(0,0),start=null,poly=[],command=null,i=0;
  const validNum=()=>i<tokens.length&&!/^[a-z]$/i.test(tokens[i]);
  const num=()=>{if(!validNum())throw Error('Incomplete SVG path command');const v=Number(tokens[i++]);if(!Number.isFinite(v))throw Error('Non-finite SVG coordinate');return v;};
  const nextPoint=relative=>{const x=num(),y=num();return relative?point(at.x+x,at.y+y):point(x,y);};
  const finish=()=>{if(poly.length>=3){if(xy(poly[0],poly.at(-1))<EPS)poly.pop();if(poly.length>=3)loops.push(poly.map(canonical));}poly=[];start=null;};
  let guard=0;
  while(i<tokens.length){if(++guard>1000000)throw Error('Excessive SVG path data');
    if(/^[a-z]$/i.test(tokens[i])){command=tokens[i++];if(!types.has(command))throw Error('Unsupported SVG path command: '+command);}
    else if(!command)throw Error('SVG outline must start with a command');
    const relative=command===command.toLowerCase(),op=command.toUpperCase();
    if(op==='Z'){if(start)at=start;finish();command=null;continue;}
    if(op==='M'){if(poly.length)finish();at=nextPoint(relative);start=at;poly=[at];command=relative?'l':'L';continue;}
    if(!start)throw Error('SVG path segment without initial Move');
    if(op==='L'){at=nextPoint(relative);poly.push(at);continue;}
    if(op==='H'){at=point(relative?at.x+num():num(),at.y);poly.push(at);continue;}
    if(op==='V'){at=point(at.x,relative?at.y+num():num());poly.push(at);continue;}
    if(op==='C'){const c1=nextPoint(relative),c2=nextPoint(relative),end=nextPoint(relative);cubicFlat(at,c1,c2,end,Math.max(.03,Number(tolerance)||.35),poly);at=end;continue;}
    if(op==='Q'){const q=nextPoint(relative),end=nextPoint(relative);const c1=lerp(at,q,2/3),c2=lerp(end,q,2/3);cubicFlat(at,c1,c2,end,Math.max(.03,Number(tolerance)||.35),poly);at=end;continue;}
  }
  // SVG can implicitly close paths for filling; do the same here.
  finish();return loops;
}
export function signedArea(poly){let sum=0;for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length];sum+=a.x*b.y-a.y*b.x;}return sum/2;}
export function pointInNonZero(polygons,p){
  let winding=0;
  for(const polygon of polygons)for(let j=0;j<polygon.length;j++){
    const a=polygon[j],b=polygon[(j+1)%polygon.length];
    if(a.y<=p.y&&b.y>p.y&&cross(sub(b,a),sub(p,a))>EPS)winding++;
    else if(b.y<=p.y&&a.y>p.y&&cross(sub(b,a),sub(p,a))< -EPS)winding--;
  }
  return winding!==0;
}
function segmentList(polys,owner){const list=[];for(const poly of polys){for(let i=0;i<poly.length;i++){
  const a=poly[i],b=poly[(i+1)%poly.length];if(xy(a,b)>1e-5)list.push({a,b,owner,ts:[0,1]});
}}return list;}
function addSplit(s,t){if(t>=-EPS&&t<=1+EPS)s.ts.push(Math.max(0,Math.min(1,t)));}
function intersectSplit(s,t){
  const r=sub(s.b,s.a),q=sub(t.b,t.a),p=sub(t.a,s.a),den=cross(r,q);
  if(Math.abs(den)>1e-9){const a=cross(p,q)/den,b=cross(p,r)/den;if(a>=-EPS&&a<=1+EPS&&b>=-EPS&&b<=1+EPS){addSplit(s,a);addSplit(t,b);}return;}
  if(Math.abs(cross(p,r))>1e-7)return; // parallel non-collinear
  const lenR=r.x*r.x+r.y*r.y,lenQ=q.x*q.x+q.y*q.y;
  if(lenR<EPS||lenQ<EPS)return;
  for(const end of [t.a,t.b])addSplit(s,((end.x-s.a.x)*r.x+(end.y-s.a.y)*r.y)/lenR);
  for(const end of [s.a,s.b])addSplit(t,((end.x-t.a.x)*q.x+(end.y-t.a.y)*q.y)/lenQ);
}
function apply(op,a,b){if(op==='union')return a||b;if(op==='subtract')return a&&!b;if(op==='intersect')return a&&b;if(op==='exclude')return a!==b;throw Error('Unknown vector operation: '+op);}
function simplifyCollinear(poly){
  let out=poly;
  for(let pass=0;pass<2;pass++){
    const next=[];
    for(let i=0;i<out.length;i++){
      const a=out[(i+out.length-1)%out.length],b=out[i],c=out[(i+1)%out.length];
      if(xy(a,b)<1e-4||xy(b,c)<1e-4)continue;
      const ab=sub(b,a),bc=sub(c,b);
      if(Math.abs(cross(ab,bc))<1e-4*Math.max(1,xy(a,c))&&ab.x*bc.x+ab.y*bc.y>0)continue;
      next.push(b);
    }
    if(next.length>=3)out=next;else break;
  }
  return out;
}
function buildLoops(edges){
  const outgoing=new Map();for(let i=0;i<edges.length;i++){const k=key(edges[i].a);if(!outgoing.has(k))outgoing.set(k,[]);outgoing.get(k).push(i);}
  const used=new Set(),loops=[];
  for(let first=0;first<edges.length;first++){
    if(used.has(first))continue;
    let index=first,steps=0;const points=[],start=key(edges[index].a);
    while(index!=null&&!used.has(index)&&steps++<=edges.length){
      used.add(index);const edge=edges[index];points.push(edge.a);
      const nextKey=key(edge.b);if(nextKey===start)break;
      const options=(outgoing.get(nextKey)||[]).filter(x=>!used.has(x));
      if(!options.length){index=null;break;}
      if(options.length===1){index=options[0];continue;}
      const u=sub(edge.b,edge.a),angle=Math.atan2(u.y,u.x);
      // At a touching vertex, prefer the next most clockwise exit which keeps
      // the filled region on the same side of the oriented boundary.
      const turning=c=>{const dir=sub(edges[c].b,edges[c].a);let a=Math.atan2(dir.y,dir.x)-angle;while(a<=-Math.PI)a+=2*Math.PI;while(a>Math.PI)a-=2*Math.PI;return a;};
      options.sort((a,b)=>turning(a)-turning(b));index=options[0];
    }
    if(index!==null&&points.length>=3){const simple=simplifyCollinear(points);if(simple.length>=3&&Math.abs(signedArea(simple))>=1e-5)loops.push(simple);}
  }
  return loops;
}
export function polygonBooleanFallback(aPolys,bPolys,operation,forceArrangement=false){
  if(!['union','subtract','intersect','exclude'].includes(operation))throw Error('Unknown vector operation');
  if(!aPolys.length)return ['union','exclude'].includes(operation)?bPolys:[];
  if(!bPolys.length&&!forceArrangement)return ['union','subtract','exclude'].includes(operation)?aPolys:[];
  const aSeg=segmentList(aPolys,0),bSeg=segmentList(bPolys,1);
  if(aSeg.length+bSeg.length>24000)throw Error('Too many vector edges. Simplify the contours before combining.');
  // For explicit topology repair, intersect edges belonging to the same
  // operand too. The regular boolean fast path remains untouched.
  if(forceArrangement){for(let i=0;i<aSeg.length;i++)for(let j=i+1;j<aSeg.length;j++){
    const s=aSeg[i],t=aSeg[j];
    if(Math.max(s.a.x,s.b.x)+EPS<Math.min(t.a.x,t.b.x)||Math.max(t.a.x,t.b.x)+EPS<Math.min(s.a.x,s.b.x)||Math.max(s.a.y,s.b.y)+EPS<Math.min(t.a.y,t.b.y)||Math.max(t.a.y,t.b.y)+EPS<Math.min(s.a.y,s.b.y))continue;
    intersectSplit(s,t);
  }}
  for(const s of aSeg)for(const t of bSeg){
    if(Math.max(s.a.x,s.b.x)+EPS<Math.min(t.a.x,t.b.x)||Math.max(t.a.x,t.b.x)+EPS<Math.min(s.a.x,s.b.x)||Math.max(s.a.y,s.b.y)+EPS<Math.min(t.a.y,t.b.y)||Math.max(t.a.y,t.b.y)+EPS<Math.min(s.a.y,s.b.y))continue;
    intersectSplit(s,t);
  }
  const boundaries=new Map();
  for(const s of [...aSeg,...bSeg]){
    const ts=s.ts.sort((x,y)=>x-y).filter((t,i,arr)=>i===0||t-arr[i-1]>1e-7);
    for(let j=1;j<ts.length;j++){
      const a=canonical(lerp(s.a,s.b,ts[j-1])),b=canonical(lerp(s.a,s.b,ts[j]));
      const len=xy(a,b);if(len<1e-5)continue;
      const m=lerp(a,b,.5),normal=point(-(b.y-a.y)/len,(b.x-a.x)/len);
      const delta=Math.min(.008,len*.12),left=point(m.x+normal.x*delta,m.y+normal.y*delta),right=point(m.x-normal.x*delta,m.y-normal.y*delta);
      const l=apply(operation,pointInNonZero(aPolys,left),pointInNonZero(bPolys,left));
      const r=apply(operation,pointInNonZero(aPolys,right),pointInNonZero(bPolys,right));
      if(l===r)continue;
      const from=l?a:b,to=l?b:a,k=`${key(from)}>${key(to)}`,reverse=`${key(to)}>${key(from)}`;
      if(boundaries.has(reverse))boundaries.delete(reverse);
      else if(!boundaries.has(k))boundaries.set(k,{a:from,b:to});
    }
  }
  return buildLoops([...boundaries.values()]);
}
// Native geometry is opt-in and independently checked before becoming active.
// If a WASM build is stale or its output is malformed, the JS implementation
// remains authoritative. This is entirely in-memory; no new UI control.
let nativePolygonBoolean=null;
let nativeParityChecksRemaining=48;
const testRect=(x,y,w,h)=>[
  {x,y},{x:x+w,y},{x:x+w,y:y+h},{x,y:y+h}
];
function comparableNativeResult(reference,native,inputs=[]){
  if(!Array.isArray(native)||native.length>10000||native.some(poly=>
    !Array.isArray(poly)||poly.length<3||poly.length>24000||poly.some(p=>
      !p||!Number.isFinite(p.x)||!Number.isFinite(p.y)||Math.abs(p.x)>1e6||Math.abs(p.y)>1e6)))return false;
  const area=polys=>polys.reduce((s,p)=>s+signedArea(p),0);
  const aa=area(reference),bb=area(native);
  if(Math.abs(aa-bb)>Math.max(.0005,Math.abs(aa)*.00001))return false;
  const vertices=inputs.flat(2).concat(reference.flat(),native.flat());
  if(!vertices.length)return true;
  const bounds={minX:Math.min(...vertices.map(p=>p.x)),maxX:Math.max(...vertices.map(p=>p.x)),
    minY:Math.min(...vertices.map(p=>p.y)),maxY:Math.max(...vertices.map(p=>p.y))};
  for(let y=0;y<12;y++)for(let x=0;x<12;x++){
    const p={x:bounds.minX+(bounds.maxX-bounds.minX)*(x+.427)/12,
      y:bounds.minY+(bounds.maxY-bounds.minY)*(y+.619)/12};
    if(pointInNonZero(reference,p)!==pointInNonZero(native,p))return false;
  }
  return true;
}
/** Install WASM only after deterministic topology, area and fill-rule canaries.
 * A failing or incompatible native build silently uses the JS fallback. */
export function registerNativePolygonBoolean(backend){
  nativePolygonBoolean=null;nativeParityChecksRemaining=48;
  if(typeof backend!=='function')return false;
  const A=[testRect(0,0,20,20)],B=[testRect(10,10,20,20)],C=[testRect(5,5,10,10)],
    D=[testRect(20,0,10,20)],E=[testRect(40,40,5,5)];
  try{
    for(const [a,b] of [[A,B],[A,C],[A,D],[A,E],[[],A]])for(const op of ['union','subtract','intersect','exclude']){
      const reference=polygonBooleanFallback(a,b,op),candidate=backend(a,b,op);
      if(!comparableNativeResult(reference,candidate,[a,b]))return false;
    }
    nativePolygonBoolean=backend;return true;
  }catch(_){return false;}
}
export function nativePolygonBooleanReady(){return !!nativePolygonBoolean;}
export function polygonBoolean(aPolys,bPolys,operation){
  if(nativePolygonBoolean){
    try{
      const candidate=nativePolygonBoolean(aPolys,bPolys,operation);
      if(nativeParityChecksRemaining>0){
        const reference=polygonBooleanFallback(aPolys,bPolys,operation);
        if(!comparableNativeResult(reference,candidate,[aPolys,bPolys])){
          nativePolygonBoolean=null;return reference;
        }
        nativeParityChecksRemaining--;
      }else if(!comparableNativeResult(candidate,candidate,[aPolys,bPolys])){
        nativePolygonBoolean=null;return polygonBooleanFallback(aPolys,bPolys,operation);
      }
      return candidate;
    }catch(_){
      nativePolygonBoolean=null; // A failed native call must never change ink.
    }
  }
  return polygonBooleanFallback(aPolys,bPolys,operation);
}
export function polygonsToPath(polys){return polys.map(poly=>poly.length<3?'':`M ${poly.map(p=>`${round(p.x)} ${round(p.y)}`).join(' L ')} Z`).filter(Boolean).join(' ');}
export function polygonsToContours(polys){return polys.filter(poly=>poly.length>=3).map(poly=>({role:signedArea(poly)<0?'hole':'fill',points:poly.map(p=>({x:round(p.x),y:round(p.y),in:[round(p.x),round(p.y)],out:[round(p.x),round(p.y)]}))}));}
function safelyRefitBoundary(poly,tolerance){
  const fitted=refitPolygonContour(poly,{tolerance});
  if(!fitted)return polygonsToContours([poly])[0]||null;
  const path=refittedContoursToPath([fitted]);
  // The output may be an approximation, but the resulting font silhouette
  // must not drift substantially or grow loops around pathological corners.
  let sampled;
  try{sampled=flattenSvgContours(path,Math.min(.035,tolerance*.6));}
  catch(_){return polygonsToContours([poly])[0]||null;}
  if(sampled.length!==1)return polygonsToContours([poly])[0]||null;
  const oldArea=signedArea(poly),newArea=signedArea(sampled[0]);
  if(!Number.isFinite(newArea)||oldArea*newArea<0||
    Math.abs(oldArea-newArea)>Math.max(.35,Math.abs(oldArea)*.002))
    return polygonsToContours([poly])[0]||null;
  const bounds={minX:Math.min(...poly.map(p=>p.x)),maxX:Math.max(...poly.map(p=>p.x)),
    minY:Math.min(...poly.map(p=>p.y)),maxY:Math.max(...poly.map(p=>p.y))};
  let mismatches=0;
  for(let row=0;row<11;row++)for(let col=0;col<11;col++){
    const p={x:bounds.minX+(col+.43)*(bounds.maxX-bounds.minX)/11,
      y:bounds.minY+(row+.57)*(bounds.maxY-bounds.minY)/11};
    if(pointInNonZero([poly],p)!==pointInNonZero(sampled,p)){
      if(++mismatches>=3)return polygonsToContours([poly])[0]||null;
    }
  }
  return fitted;
}
export function booleanPaths(a,b,operation,{tolerance=.35,refit=true,refitTolerance=null}={}){
  // Curve-bearing operands use a finer boundary sample before refitting.
  // This avoids long straight chords at joins and protects small counters.
  // Straight-only polygons keep the exact historical arrangement unchanged.
  const curves=refit!==false&&/[CQcq]/.test(String(a||'')+' '+String(b||''));
  const samplingTolerance=curves?Math.min(tolerance,.10):tolerance;
  const polys=polygonBoolean(flattenSvgContours(a,samplingTolerance),flattenSvgContours(b,samplingTolerance),operation);
  const effectiveTolerance=refitTolerance==null?Math.max(.025,Math.min(.25,samplingTolerance*.55)):refitTolerance;
  if(curves){
    const contours=polys.map(poly=>safelyRefitBoundary(poly,effectiveTolerance)).filter(Boolean);
    return {path:refittedContoursToPath(contours),contours,polygonCount:polys.length,curveRefit:true,
      // Strict accuracy bound applies to the sampled boundary points, not to
      // analytic intersections between original cubic curves.
      refitSampleTolerance:effectiveTolerance};
  }
  return {path:polygonsToPath(polys),contours:polygonsToContours(polys),polygonCount:polys.length,curveRefit:false};
}

/** Explicitly regularise a self-intersecting filled path into nonoverlapping
 * closed contours using the same nonzero-winding fill as the font compiler.
 * This is an opt-in, sampled-edge topology repair, NOT an analytic cubic
 * intersection solver. Other glyph contours must be kept by the caller. */
export function regularizeSelfIntersections(d,{tolerance=.10,refitTolerance=.06}={}){
  if(typeof d!=='string'||!d.trim())throw Error('Choose a filled outline');
  if(!Number.isFinite(tolerance)||tolerance<=0||tolerance>1)throw Error('Invalid topology repair tolerance');
  const input=flattenSvgContours(d,tolerance);
  if(input.reduce((n,p)=>n+p.length,0)>1000)throw Error('Outline is too complex for automatic crossing repair; simplify it first');
  const arranged=polygonBooleanFallback(input,[],'union',true);
  const contains=(polys,p)=>pointInNonZero(polys,p);
  const vertices=input.flat();
  if(!vertices.length)throw Error('No nonempty filled outline');
  const xs=vertices.map(p=>p.x),ys=vertices.map(p=>p.y);
  const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
  // A repair may change the *representation*, but must not change its nonzero
  // filled region. Deterministic interior probes reject untrustworthy results.
  let mismatches=0;
  for(let y=0;y<49;y++)for(let x=0;x<49;x++){
    const p={x:minX+(x+.374)*Math.max(1e-6,maxX-minX)/49,
             y:minY+(y+.637)*Math.max(1e-6,maxY-minY)/49};
    if(contains(input,p)!==contains(arranged,p))mismatches++;
  }
  if(mismatches)throw Error('Crossing repair would change the filled shape; no changes were made');
  const curves=/[CQcq]/.test(d);
  const contours=arranged.map(poly=>curves?safelyRefitBoundary(poly,refitTolerance):polygonsToContours([poly])[0]).filter(Boolean);
  const path=curves?refittedContoursToPath(contours):polygonsToPath(arranged);
  const sampled=flattenSvgContours(path,Math.min(.04,tolerance));
  let shapeMismatches=0;
  for(let y=0;y<49;y++)for(let x=0;x<49;x++){
    const p={x:minX+(x+.374)*Math.max(1e-6,maxX-minX)/49,
             y:minY+(y+.637)*Math.max(1e-6,maxY-minY)/49};
    if(contains(input,p)!==contains(sampled,p))shapeMismatches++;
  }
  if(shapeMismatches)throw Error('Reconstructed curves would change the filled shape; no changes were made');
  return {contours,path,polygonCount:arranged.length,approximate:curves};
}
