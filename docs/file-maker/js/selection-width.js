/* Selected-ink width adjustments for the existing Draw glyph brush slider.
 * Operates on a frozen selection snapshot, never on the previous slider result.
 * No external dependencies or changes to the font compiler or WASM interface.
 */
import {signedAnchorArea} from './bezier.js?v=0.3.42.2';

// Exact squared Euclidean distance transform, O(width * height).
function distanceRow(f, out, n) {
  const v=new Int32Array(n),z=new Float64Array(n+1);
  let k=0;v[0]=0;z[0]=-Infinity;z[1]=Infinity;
  for(let q=1;q<n;q++){
    let s;
    do{
      const p=v[k];
      s=((f[q]+q*q)-(f[p]+p*p))/(2*(q-p));
      if(s<=z[k]&&k>0)k--;else break;
    }while(true);
    if(s<=z[k]){v[0]=q;z[0]=-Infinity;z[1]=Infinity;k=0;}
    else{k++;v[k]=q;z[k]=s;z[k+1]=Infinity;}
  }
  k=0;
  for(let q=0;q<n;q++){
    while(z[k+1]<q)k++;
    const p=v[k];out[q]=(q-p)*(q-p)+f[p];
  }
}
function squaredDistances(seeds,w,h){
  const INF=1e8,intermediate=new Float64Array(w*h),result=new Float64Array(w*h);
  const line=new Float64Array(Math.max(w,h)),out=new Float64Array(line.length);
  for(let y=0;y<h;y++){
    for(let x=0;x<w;x++)line[x]=seeds[y*w+x]?0:INF;
    distanceRow(line,out,w);
    for(let x=0;x<w;x++)intermediate[y*w+x]=out[x];
  }
  for(let x=0;x<w;x++){
    for(let y=0;y<h;y++)line[y]=intermediate[y*w+x];
    distanceRow(line,out,h);
    for(let y=0;y<h;y++)result[y*w+x]=out[y];
  }
  return result;
}

// RGBA input/output are browser ImageData.data-compatible byte arrays.
// Growing and thinning keep the original selection bounds and clip outside
// artwork in the controller. RGB values of existing ink are preserved.
export function resizeSelectedInk(rgba,width,height,deltaWidth){
  const w=Math.trunc(width),h=Math.trunc(height);
  if(w<1||h<1||rgba.length!==w*h*4)throw new Error('Invalid selected ink');
  const output=new Uint8ClampedArray(rgba);
  const delta=Number(deltaWidth);
  if(!Number.isFinite(delta)||Math.abs(delta)<.001)return output;
  const growing=delta>0,radius=Math.abs(delta)/2;
  // Include a transparent outside border when thinning so strokes touching
  // the edge of the marquee can still have their thickness reduced.
  const pw=w+2,ph=h+2,seeds=new Uint8Array(pw*ph);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const alpha=rgba[(y*w+x)*4+3];
    const filled=alpha>=128;
    if(growing?filled:!filled)seeds[(y+1)*pw+x+1]=1;
  }
  if(!growing){
    for(let x=0;x<pw;x++)seeds[x]=seeds[(ph-1)*pw+x]=1;
    for(let y=0;y<ph;y++)seeds[y*pw]=seeds[y*pw+pw-1]=1;
  }
  const dist=squaredDistances(seeds,pw,ph);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const i=(y*w+x)*4,original=rgba[i+3];
    const distance=Math.sqrt(dist[(y+1)*pw+x+1]);
    if(growing){
      // The old antialiased edge lies *inside* the widened stroke. Keeping
      // its fractional alpha leaves a pale outline (a hollow/striped glyph).
      // Union the new coverage with the original ink at every pixel, not
      // only pixels that were completely transparent. This also preserves
      // the original silhouette when widening by a very small amount.
      const coverage=Math.max(0,Math.min(1,radius+.5-distance));
      const alpha=Math.max(original,Math.round(255*coverage));
      if(alpha<=original)continue;
      if(!original){output[i]=17;output[i+1]=17;output[i+2]=25;}
      output[i+3]=alpha;
    }else if(original>0){
      const coverage=Math.max(0,Math.min(1,distance-radius+.5));
      output[i+3]=Math.round(original*coverage);
    }
  }
  return output;
}

// Approximate a parallel offset of the contour, retaining editable cubic
// nodes and translating their handles together.  Filled outer contours grow;
// hole contours contract. Geometry is always based on the original nodes.
export function offsetSelectedContour(contour,deltaWidth){
  if(contour?.kind==='stroke')return {...structuredClone(contour),width:Math.max(1,(contour.width||9)+deltaWidth),widths:(contour.widths||Array(Math.max(1,contour.points.length-1)).fill(contour.width||9)).map(w=>Math.max(1,w+deltaWidth))};
  const points=contour?.points||[];
  if(points.length<3||!deltaWidth)return structuredClone(contour);
  const area=signedAnchorArea(points),sign=(area<0?-1:1)*(contour.role==='hole'?-1:1);
  const radius=Number(deltaWidth)/2;
  if(!Number.isFinite(radius))throw new Error('Invalid contour width');
  const round=x=>Number(x.toFixed(3));
  const unit=(dx,dy)=>{const length=Math.hypot(dx,dy);return length>.0001?[dx/length,dy/length]:null;};
  const moved=points.map((p,i)=>{
    const prev=points[(i+points.length-1)%points.length],next=points[(i+1)%points.length];
    let tangent=unit(p.out[0]-p.in[0],p.out[1]-p.in[1]);
    if(!tangent)tangent=unit(next.x-prev.x,next.y-prev.y);
    if(!tangent)tangent=[1,0];
    let normal=[tangent[1]*sign,-tangent[0]*sign];
    // Straight corners use a restrained miter, avoiding artificially rounded
    // joins when a rectangle is thickened or thinned.
    const incoming=unit(p.x-prev.x,p.y-prev.y),outgoing=unit(next.x-p.x,next.y-p.y);
    const handlesStraight=Math.hypot(p.in[0]-p.x,p.in[1]-p.y)<.01&&
      Math.hypot(p.out[0]-p.x,p.out[1]-p.y)<.01;
    if(handlesStraight&&incoming&&outgoing){
      const a=[incoming[1]*sign,-incoming[0]*sign],b=[outgoing[1]*sign,-outgoing[0]*sign];
      const sum=unit(a[0]+b[0],a[1]+b[1]);
      if(sum){const dot=sum[0]*a[0]+sum[1]*a[1];if(dot>.4)normal=[sum[0]/dot,sum[1]/dot];}
    }
    const dx=normal[0]*radius,dy=normal[1]*radius;
    return {...p,x:round(p.x+dx),y:round(p.y+dy),
      in:[round(p.in[0]+dx),round(p.in[1]+dy)],
      out:[round(p.out[0]+dx),round(p.out[1]+dy)]};
  });
  return {...contour,points:moved};
}
