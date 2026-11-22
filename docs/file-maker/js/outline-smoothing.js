/* MIT — Undoable, post-drawing smoothing for existing editable glyph artwork.
 * Work in the original 400×430 artboard coordinates (not browser zoom).
 * Grey imported reference outlines are never an input. Each raster or vector
 * result remains part of the normal glyph project and TTF export pipeline.
 */
const clamp=(v,lo,hi)=>Math.min(hi,Math.max(lo,v));
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const num=v=>Number(v.toFixed(3));

// Smooth raster alpha rather than RGB. A Gaussian low-pass removes short
// bumps from both edges; a symmetric coverage threshold keeps stroke width
// and hollow counters approximately unchanged and regenerates antialiasing.
export function smoothRasterInk(rgba,width,height,strength){
 const amount=clamp(Number(strength)||0,0,100),src=new Uint8ClampedArray(rgba);
 if(!amount||width<=0||height<=0)return src;
 const sigma=.35+amount*.043,radius=Math.ceil(sigma*2.7);
 const weights=[];let total=0;
 for(let d=-radius;d<=radius;d++){const w=Math.exp(-d*d/(2*sigma*sigma));weights.push(w);total+=w;}
 for(let i=0;i<weights.length;i++)weights[i]/=total;
 const horiz=new Float32Array(width*height),out=new Uint8ClampedArray(src.length);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  let a=0;
  for(let k=-radius;k<=radius;k++){
   const xx=x+k;if(xx>=0&&xx<width)a+=src[(y*width+xx)*4+3]*weights[k+radius];
  }
  horiz[y*width+x]=a;
 }
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  let a=0;
  for(let k=-radius;k<=radius;k++){
   const yy=y+k;if(yy>=0&&yy<height)a+=horiz[yy*width+x]*weights[k+radius];
  }
  const t=clamp((a/255-.40)/.20,0,1),coverage=t*t*(3-2*t);
  const idx=(y*width+x)*4;
  out[idx]=17;out[idx+1]=17;out[idx+2]=25;out[idx+3]=Math.round(coverage*255);
 }
 return out;
}

function sampleContour(contour){
 const points=contour?.points||[];if(points.length<3)return [];
 const samples=[];
 for(let i=0;i<points.length;i++){
  const a=points[i],b=points[(i+1)%points.length];
  const p0={x:a.x,y:a.y},p1={x:a.out[0],y:a.out[1]},p2={x:b.in[0],y:b.in[1]},p3={x:b.x,y:b.y};
  const length=distance(p0,p1)+distance(p1,p2)+distance(p2,p3);
  const steps=clamp(Math.ceil(length/2),1,140);
  for(let j=0;j<steps;j++){
   const t=j/steps,u=1-t;
   samples.push({x:u*u*u*p0.x+3*u*u*t*p1.x+3*u*t*t*p2.x+t*t*t*p3.x,
                 y:u*u*u*p0.y+3*u*u*t*p1.y+3*u*t*t*p2.y+t*t*t*p3.y});
  }
 }
 // Avoid a pathological very large contour, but retain its shape.
 const step=Math.max(1,Math.ceil(samples.length/1400));
 return step===1?samples:samples.filter((_,i)=>i%step===0);
}
// Uniformly sample distance along the boundary before filtering. Filtering
// points by their *index* would over-smooth dense parts of a hand-drawn curve
// and under-smooth sparse parts, so points are first made equidistant.
function uniformRing(points,size){
 const n=points.length, lengths=points.map((p,i)=>distance(p,points[(i+1)%n]));
 const perimeter=lengths.reduce((a,b)=>a+b,0);
 if(perimeter<.01)return {points:points.slice(),perimeter};
 const result=[];let seg=0,at=0;
 for(let k=0;k<size;k++){
  const goal=k*perimeter/size;
  while(seg<n-1&&at+lengths[seg]<goal){at+=lengths[seg];seg++;}
  const a=points[seg],b=points[(seg+1)%n],t=lengths[seg]>1e-9?clamp((goal-at)/lengths[seg],0,1):0;
  result.push({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});
 }
 return {points:result,perimeter};
}
// Radix-2 FFT of the complex-valued closed curve z(s) = x(s) + i*y(s).
// Positive and negative harmonics receive the same real-valued attenuation.
function fft(re,im,inverse=false){
 const n=re.length;
 for(let i=1,j=0;i<n;i++){
  let bit=n>>1;while(j&bit){j^=bit;bit>>=1;}j^=bit;
  if(i<j){[re[i],re[j]]=[re[j],re[i]];[im[i],im[j]]=[im[j],im[i]];}
 }
 for(let len=2;len<=n;len*=2){
  const angle=(inverse?2:-2)*Math.PI/len,wr=Math.cos(angle),wi=Math.sin(angle),half=len>>1;
  for(let start=0;start<n;start+=len){
   let cr=1,ci=0;
   for(let j=0;j<half;j++){
    const a=start+j,b=a+half,tr=cr*re[b]-ci*im[b],ti=cr*im[b]+ci*re[b];
    re[b]=re[a]-tr;im[b]=im[a]-ti;re[a]+=tr;im[a]+=ti;
    const nr=cr*wr-ci*wi;ci=cr*wi+ci*wr;cr=nr;
   }
  }
 }
 if(inverse)for(let i=0;i<n;i++){re[i]/=n;im[i]/=n;}
}
function smoothedRing(original,amount,maxRadius=Infinity){
 if(original.length<5)return original;
 let length=0;for(let i=0;i<original.length;i++)length+=distance(original[i],original[(i+1)%original.length]);
 if(length<2)return original;
 // 256 or 512 equally spaced samples provide enough precision for the
 // 400x430 artboard without high-frequency aliasing in very dense contours.
 const count=length>260?512:256;
 const {points,perimeter}=uniformRing(original,count);
 const re=Float64Array.from(points,p=>p.x),im=Float64Array.from(points,p=>p.y);
 fft(re,im);
 // Gaussian attenuation in the frequency domain is a true spatial low-pass
 // filter. The slider controls its physical smoothing radius in font-editor
 // pixels; 60% intentionally removes multiple-pixel wiggles.
 const radius=Math.min(maxRadius,.5+amount*.15);
 for(let k=0;k<count;k++){
  const harmonic=Math.min(k,count-k);
  const freq=2*Math.PI*harmonic/perimeter;
  const gain=Math.exp(-.5*(freq*radius)**2);
  re[k]*=gain;im[k]*=gain;
 }
 fft(re,im,true);
 return Array.from({length:count},(_,i)=>({x:re[i],y:im[i]}));
}

const pointSegDist=(p,a,b)=>{
 const dx=b.x-a.x,dy=b.y-a.y,len=dx*dx+dy*dy;
 const t=len?clamp(((p.x-a.x)*dx+(p.y-a.y)*dy)/len,0,1):0;
 return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);
};
function rdp(points,tol){
 const stack=[[0,points.length-1]],keep=new Set([0,points.length-1]);
 while(stack.length){const [a,b]=stack.pop();let far=0,idx=-1;
  for(let i=a+1;i<b;i++){const d=pointSegDist(points[i],points[a],points[b]);if(d>far){far=d;idx=i;}}
  if(idx>=0&&far>tol){keep.add(idx);stack.push([a,idx],[idx,b]);}
 }
 return [...keep].sort((a,b)=>a-b).map(i=>points[i]);
}
function simplifyRing(points,tolerance){
 if(points.length<6)return points;
 const mid=Math.floor(points.length/2),a=rdp(points.slice(0,mid+1),tolerance),b=rdp([...points.slice(mid),points[0]],tolerance);
 const result=[...a.slice(0,-1),...b.slice(0,-1)];
 // The cubic renderer requires at least three distinct anchors.
 return result.length>=3?result:points.filter((_,i)=>i%Math.max(1,Math.floor(points.length/6))===0).slice(0,8);
}
// Only exact, intentional primitives are exempt from smoothing. Ordinary
// user-drawn three/four-anchor Bézier contours must still respond to Smooth.
function exactPrimitive(points){
 if(points.length!==4)return false;
 const near=(a,b)=>Math.abs(a-b)<.06;
 const straight=points.every(p=>near(p.in[0],p.x)&&near(p.in[1],p.y)&&near(p.out[0],p.x)&&near(p.out[1],p.y));
 if(straight){
  const v=points.map((p,i)=>({x:points[(i+1)%4].x-p.x,y:points[(i+1)%4].y-p.y}));
  return v.every((d,i)=>{
   const e=v[(i+1)%4];
   const n=Math.hypot(d.x,d.y)*Math.hypot(e.x,e.y);
   return n>.01&&Math.abs((d.x*e.x+d.y*e.y)/n)<.01;
  });
 }
 // Native axis-aligned ellipseContour: 4 extrema with canonical 0.552285
 // cubic handles. Leave such circles perfect instead of slowly deforming them.
 const xs=points.map(p=>p.x),ys=points.map(p=>p.y);
 const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
 const cx=(minX+maxX)/2,cy=(minY+maxY)/2,rx=(maxX-minX)/2,ry=(maxY-minY)/2;
 if(rx<1||ry<1)return false;
 const k=.5522847498307936;
 return points.every(p=>{
  const dx=(p.x-cx)/rx,dy=(p.y-cy)/ry;
  if(Math.min(Math.abs(Math.abs(dx)-1)+Math.abs(dy),Math.abs(Math.abs(dy)-1)+Math.abs(dx))>.001)return false;
  const h0=Math.hypot((p.in[0]-p.x)/rx,(p.in[1]-p.y)/ry);
  const h1=Math.hypot((p.out[0]-p.x)/rx,(p.out[1]-p.y)/ry);
  return Math.abs(h0-k)<.01&&Math.abs(h1-k)<.01;
 });
}
// Preserves contour role (filled / transparent hole), and uses *fewer* cubic
// nodes rather than accumulating more points. The exported outline is smooth
// in SVG and TTF, not merely visually filtered in the preview canvas.
export function smoothBezierOutline(contour,strength){
 const amount=clamp(Number(strength)||0,0,100);
 if(!contour?.points?.length||!amount)return structuredClone(contour);
 // Four-point true cubic ellipses already have ideal curves. Same for native
 // rectangles: avoid damaging precise geometric primitives when smoothing.
 if(exactPrimitive(contour.points))return structuredClone(contour);
 const original=sampleContour(contour);
 if(original.length<6)return structuredClone(contour);
 const xs=original.map(p=>p.x),ys=original.map(p=>p.y);
 const minDim=Math.min(Math.max(...xs)-Math.min(...xs),Math.max(...ys)-Math.min(...ys));
 const filtered=smoothedRing(original,amount,Math.max(.8,minDim*.20));
 const reduced=simplifyRing(filtered,.45+amount*.034);
 if(reduced.length<3)return structuredClone(contour);
 const nodes=reduced.map((p,i)=>{
  const prev=reduced[(i-1+reduced.length)%reduced.length],next=reduced[(i+1)%reduced.length];
  const vx=next.x-prev.x,vy=next.y-prev.y,l=Math.hypot(vx,vy)||1;
  const tangent=[vx/l,vy/l],before=distance(prev,p),after=distance(next,p);
  const cross=(p.x-prev.x)*(next.y-p.y)-(p.y-prev.y)*(next.x-p.x);
  const dot=(p.x-prev.x)*(next.x-p.x)+(p.y-prev.y)*(next.y-p.y);
  // Keep genuine angular features; avoid adding loops at close-spaced nodes.
  const corner=Math.atan2(Math.abs(cross),dot)>2.30 && amount<30;
  const h=corner?0:Math.min(before,after)*.38;
  return{x:num(p.x),y:num(p.y),in:[num(p.x-tangent[0]*h),num(p.y-tangent[1]*h)],
         out:[num(p.x+tangent[0]*h),num(p.y+tangent[1]*h)]};
 });
 return {...contour,points:nodes};
}

// A selection is a protected editing window, not a cropping boundary.
// Pixels near its border are unchanged, followed by a smooth transition
// into the low-pass-filtered interior.  This eliminates seams when part
// of a continuous pencil stroke crosses the selected area.
export function selectionSmoothingWeights(width,height,rect,polygon=null){
 const w=Math.floor(width),h=Math.floor(height),inside=new Uint8Array(w*h);
 if(!rect||w<1||h<1)return new Float32Array(w*h);
 const x0=Math.max(0,Math.floor(rect.x)),x1=Math.min(w,Math.ceil(rect.x+rect.width));
 const y0=Math.max(0,Math.floor(rect.y)),y1=Math.min(h,Math.ceil(rect.y+rect.height));
 if(polygon?.length>=3){
  // Even-odd scanline rasterization: efficient even for detailed freehand lassos.
  for(let y=y0;y<y1;y++){
   const sy=y+.5,crossings=[];
   for(let j=0;j<polygon.length;j++){
    const a=polygon[j],b=polygon[(j+1)%polygon.length];
    if((a.y>sy)!==(b.y>sy))crossings.push(a.x+(sy-a.y)*(b.x-a.x)/(b.y-a.y));
   }
   crossings.sort((a,b)=>a-b);
   for(let j=0;j+1<crossings.length;j+=2){
    const start=Math.max(x0,Math.ceil(crossings[j]-.5));
    const end=Math.min(x1,Math.ceil(crossings[j+1]-.5));
    for(let x=start;x<end;x++)inside[y*w+x]=1;
   }
  }
 }else{
  for(let y=y0;y<y1;y++)inside.fill(1,y*w+x0,y*w+x1);
 }
 // Approximate distance to the *outside* of the selected area. An 8-neighbour
 // chamfer transform is independent of canvas zoom and needs only O(w*h).
 const dist=new Float32Array(w*h),diag=Math.SQRT2;
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const i=y*w+x;
  dist[i]=inside[i]?1e6:0;
 }
 // Treat the artboard edge as an outside boundary as well.
 for(let x=0;x<w;x++){
  if(inside[x])dist[x]=1;
  if(inside[(h-1)*w+x])dist[(h-1)*w+x]=1;
 }
 for(let y=0;y<h;y++){
  if(inside[y*w])dist[y*w]=1;
  if(inside[y*w+w-1])dist[y*w+w-1]=1;
 }
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const i=y*w+x;if(!inside[i])continue;
  if(x)dist[i]=Math.min(dist[i],dist[i-1]+1);
  if(y){dist[i]=Math.min(dist[i],dist[i-w]+1);
   if(x)dist[i]=Math.min(dist[i],dist[i-w-1]+diag);
   if(x+1<w)dist[i]=Math.min(dist[i],dist[i-w+1]+diag);
  }
 }
 for(let y=h-1;y>=0;y--)for(let x=w-1;x>=0;x--){
  const i=y*w+x;if(!inside[i])continue;
  if(x+1<w)dist[i]=Math.min(dist[i],dist[i+1]+1);
  if(y+1<h){dist[i]=Math.min(dist[i],dist[i+w]+1);
   if(x)dist[i]=Math.min(dist[i],dist[i+w-1]+diag);
   if(x+1<w)dist[i]=Math.min(dist[i],dist[i+w+1]+diag);
  }
 }
 const size=Math.min(rect.width,rect.height);
 const guard=clamp(size*.10,2,9),transition=clamp(size*.12,2,11);
 const weights=new Float32Array(w*h);
 for(let i=0;i<weights.length;i++)if(inside[i]){
  const v=clamp((dist[i]-guard)/transition,0,1);
  weights[i]=v*v*(3-2*v);
 }
 return weights;
}
export function blendSelectedRasterSmoothing(original,smoothed,weights){
 if(original.length!==smoothed.length||original.length!==weights.length*4)throw Error('Invalid selected smoothing buffer sizes');
 const result=new Uint8ClampedArray(original);let changed=false;
 for(let i=0;i<weights.length;i++){
  const weight=weights[i];if(weight<=0)continue;
  const offset=i*4,oldAlpha=original[offset+3],newAlpha=smoothed[offset+3];
  const alpha=Math.round(oldAlpha+(newAlpha-oldAlpha)*weight);
  if(alpha===oldAlpha)continue;
  changed=true;
  result[offset]=17;result[offset+1]=17;result[offset+2]=25;result[offset+3]=alpha;
 }
 return {data:result,changed};
}
// Bilinear mask interpolation means moving a vector point near a selection
// border is smoothly suppressed, rather than snapping at a single pixel.
function maskWeight(weights,w,h,p){
 const x=p.x-.5,y=p.y-.5;
 if(x<0||y<0||x>=w-1||y>=h-1)return 0;
 const ix=Math.floor(x),iy=Math.floor(y),a=x-ix,b=y-iy,i=iy*w+ix;
 return (1-a)*(1-b)*weights[i]+a*(1-b)*weights[i+1]+(1-a)*b*weights[i+w]+a*b*weights[i+w+1];
}
function cubicAt(a,b,t){
 const u=1-t;
 return {x:u*u*u*a.x+3*u*u*t*a.out[0]+3*u*t*t*b.in[0]+t*t*t*b.x,
         y:u*u*u*a.y+3*u*u*t*a.out[1]+3*u*t*t*b.in[1]+t*t*t*b.y};
}
function lerpPoint(a,b,t){return {x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t};}
function splitCubic(p,t){
 const a=lerpPoint(p[0],p[1],t),b=lerpPoint(p[1],p[2],t),c=lerpPoint(p[2],p[3],t);
 const d=lerpPoint(a,b,t),e=lerpPoint(b,c,t),f=lerpPoint(d,e,t);
 return [[p[0],a,d,f],[f,e,c,p[3]]];
}
function sliceCubic(p,t0,t1){
 if(t0<=0&&t1>=1)return p;
 const first=t1<1?splitCubic(p,t1)[0]:p;
 return t0>0?splitCubic(first,t0/t1)[1]:first;
}
// For a Bézier contour that crosses the selection, preserve its untouched
// sections as *exact* cubic subsegments. Only safe interior sections are
// reconstructed from Fourier-smoothed samples. Both joins use a smooth
// falloff, so the outside geometry and selection-border tangent stay fixed.
export function smoothSelectedBezierOutline(contour,strength,weights,width,height){
 const amount=clamp(Number(strength)||0,0,100),nodes=contour?.points||[];
 if(!amount||nodes.length<3||!weights?.length||exactPrimitive(nodes))return structuredClone(contour);
 const n=nodes.length,steps=[],source=[],spans=[],cum=[0];
 for(let i=0;i<n;i++){
  const a=nodes[i],b=nodes[(i+1)%n];
  const length=distance(a,{x:a.out[0],y:a.out[1]})+
   distance({x:a.out[0],y:a.out[1]},{x:b.in[0],y:b.in[1]})+
   distance({x:b.in[0],y:b.in[1]},b);
  const count=clamp(Math.ceil(length/3),12,120),lengths=[0];
  let previous=cubicAt(a,b,0);
  for(let k=0;k<count;k++){
   const p=cubicAt(a,b,k/count);
   source.push(p);
   if(k){lengths.push(lengths.at(-1)+distance(previous,p));previous=p;}
  }
  const endpoint=cubicAt(a,b,1);
  lengths.push(lengths.at(-1)+distance(previous,endpoint));
  spans.push({count,lengths,arc:cum.at(-1)});
  cum.push(cum.at(-1)+lengths.at(-1));
 }
 if(source.length<6||cum.at(-1)<2)return structuredClone(contour);
 // Entire contours with plenty of clearance can use the normal simplifying
 // Fourier fitter (fewer nodes). Selective subdivision is only needed when
 // the contour intersects the protected band or extends outside the selection.
 if(source.every(p=>maskWeight(weights,width,height,p)>.999)){
  const simplified=smoothBezierOutline(contour,amount);
  if(sampleContour(simplified).every(p=>maskWeight(weights,width,height,p)>.999))return simplified;
 }
 const count=cum.at(-1)>260?512:256;
 const ring=uniformRing(source,count);
 const re=Float64Array.from(ring.points,p=>p.x),im=Float64Array.from(ring.points,p=>p.y);
 fft(re,im);
 const xs=source.map(p=>p.x),ys=source.map(p=>p.y);
 const minDim=Math.min(Math.max(...xs)-Math.min(...xs),Math.max(...ys)-Math.min(...ys));
 const radius=Math.min(Math.max(.8,minDim*.2),.5+amount*.15);
 for(let k=0;k<count;k++){
  const freq=2*Math.PI*Math.min(k,count-k)/ring.perimeter,gain=Math.exp(-.5*(freq*radius)**2);
  re[k]*=gain;im[k]*=gain;
 }
 fft(re,im,true);
 function transformed(i,t){
  const a=nodes[i],b=nodes[(i+1)%n],p=cubicAt(a,b,t);
  const weight=maskWeight(weights,width,height,p);
  if(weight<=0)return p;
  const span=spans[i],at=Math.min(span.count-1,Math.floor(t*span.count));
  const frac=clamp(t*span.count-at,0,1);
  const arc=span.arc+span.lengths[at]+(span.lengths[at+1]-span.lengths[at])*frac;
  const position=arc/ring.perimeter*count,whole=Math.floor(position),f=position-whole;
  const k=((whole%count)+count)%count,k1=(k+1)%count;
  return{x:p.x+((re[k]*(1-f)+re[k1]*f)-p.x)*weight,
         y:p.y+((im[k]*(1-f)+im[k1]*f)-p.y)*weight};
 }
 const segments=[];let changed=false;
 for(let i=0;i<n;i++){
  const a=nodes[i],b=nodes[(i+1)%n],p=[{x:a.x,y:a.y},{x:a.out[0],y:a.out[1]},
    {x:b.in[0],y:b.in[1]},{x:b.x,y:b.y}];
  const intervals=clamp(Math.ceil(spans[i].lengths.at(-1)/7),8,70);
  // Combine unchanged intervals into one exact original cubic where possible.
  let start=0,unchanged=false;
  function addPiece(t0,t1,affected){
   if(!affected){segments.push(sliceCubic(p,t0,t1));return;}
   changed=true;
   const q0=transformed(i,t0),q3=transformed(i,t1),dt=t1-t0;
   // Differentiating the blended curve gives C1 continuity near the mask edge.
   const eps=.004;
   const derivative=t=>{
    const lo=clamp(t-eps,0,1),hi=clamp(t+eps,0,1),v=transformed(i,lo),u=transformed(i,hi);
    return{x:(u.x-v.x)/(hi-lo),y:(u.y-v.y)/(hi-lo)};
   };
   const d0=derivative(t0),d1=derivative(t1);
   segments.push([q0,{x:q0.x+d0.x*dt/3,y:q0.y+d0.y*dt/3},
     {x:q3.x-d1.x*dt/3,y:q3.y-d1.y*dt/3},q3]);
  }
  for(let j=0;j<intervals;j++){
   const t0=j/intervals,t1=(j+1)/intervals;
   const affected=[t0,(t0+t1)/2,t1].some(t=>maskWeight(weights,width,height,cubicAt(a,b,t))>1e-5);
   if(affected){
    if(unchanged){addPiece(start,t0,false);unchanged=false;}
    addPiece(t0,t1,true);
   }else if(!unchanged){unchanged=true;start=t0;}
  }
  if(unchanged)addPiece(start,1,false);
 }
 if(!changed)return structuredClone(contour);
 const points=segments.map((p,i)=>({x:num(p[0].x),y:num(p[0].y),
  in:[0,0],out:[num(p[1].x),num(p[1].y)]}));
 for(let i=0;i<segments.length;i++){
  const next=(i+1)%segments.length,p=segments[i][2];
  points[next].in=[num(p.x),num(p.y)];
 }
 return {...contour,points};
}

// Trace the *editable raster ink* (never the grey source guide) into its
// actual outer and inner boundaries. The same curve fitter above simplifies
// those boundaries into broad, smooth cubic outlines. Gaussian alpha blur
// alone could not remove the 5–15 px kinks in completed pencil drawings.
// Directed pixel edges preserve nonzero winding (holes have negative area).
export function rasterInkContours(rgba,width,height,strength){
 const w=Math.floor(width),h=Math.floor(height),threshold=112;
 if(w<=0||h<=0||!rgba?.length||Number(strength)<=0)return [];
 const bits=new Uint8Array(w*h);let solid=0;
 for(let i=0;i<bits.length;i++)if(rgba[i*4+3]>=threshold){bits[i]=1;solid++;}
 if(!solid)return [];
 const edges=new Map(),stride=w+1;
 const edge=(a,b)=>{let exits=edges.get(a);if(!exits)edges.set(a,exits=[]);exits.push(b);};
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  if(!bits[y*w+x])continue;
  const a=y*stride+x;
  if(y===0||!bits[(y-1)*w+x])edge(a,a+1);
  if(x===w-1||!bits[y*w+x+1])edge(a+1,a+stride+1);
  if(y===h-1||!bits[(y+1)*w+x])edge(a+stride+1,a+stride);
  if(x===0||!bits[y*w+x-1])edge(a+stride,a);
 }
 const results=[],edgeBudget=[...edges.values()].reduce((n,x)=>n+x.length,0);
 let walked=0;
 while(edges.size&&walked<edgeBudget){
  const start=edges.keys().next().value,points=[];let pos=start,closed=false;
  for(let steps=0;steps<=edgeBudget&&walked<edgeBudget;steps++){
   points.push({x:pos%stride,y:Math.floor(pos/stride)});
   const exits=edges.get(pos);if(!exits?.length)break;
   const next=exits.pop();if(!exits.length)edges.delete(pos);
   walked++;pos=next;
   if(pos===start){closed=true;break;}
  }
  if(!closed||points.length<3)continue;
  const signedArea=points.reduce((acc,p,i)=>{
   const q=points[(i+1)%points.length];return acc+p.x*q.y-q.x*p.y;
  },0)/2;
  if(Math.abs(signedArea)<.5)continue;
  const primitive={role:signedArea<0?'hole':'fill',points:points.map(p=>({x:p.x,y:p.y,in:[p.x,p.y],out:[p.x,p.y]}))};
  const xs=points.map(p=>p.x),ys=points.map(p=>p.y);
  const shortSide=Math.min(Math.max(...xs)-Math.min(...xs),Math.max(...ys)-Math.min(...ys));
  // Preserve tiny holes, diacritic dots, and hairline strokes rather than
  // erasing them with a large-scale simplification.
  const result=shortSide<8||points.length<13?primitive:smoothBezierOutline(primitive,strength);
  results.push(result);
 }
 return results;
}
