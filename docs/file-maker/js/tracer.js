/* MIT — self-contained, dependency-free first-draft raster edge tracer.
 * Traces a thresholded alpha mask into closed polygon outlines (oppositely oriented edges for outer boundaries and holes).
 * Rust/WASM upgrade is in rust/font-core/src/lib.rs; do not confuse this with
 * sophisticated curve fitting or final TrueType outline conversion. */
export function traceCanvas(canvas, threshold=96, tolerance=1){
  const w=canvas.width,h=canvas.height,ctx=canvas.getContext('2d',{willReadFrequently:true});
  const rgba=ctx.getImageData(0,0,w,h).data;
  const bits=new Uint8Array(w*h);let count=0;
  for(let i=0;i<w*h;i++){if(rgba[i*4+3]>=threshold){bits[i]=1;count++;}}
  if(!count)return {path:'',contours:0,points:0,viewBox:`0 0 ${w} ${h}`};
  const edges=new Map();
  const key=(x,y)=>y*(w+1)+x;
  const put=(x1,y1,x2,y2)=>{const k=key(x1,y1);const e=[x2,y2];if(!edges.has(k))edges.set(k,[e]);else edges.get(k).push(e)};
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    if(!bits[y*w+x])continue;
    if(y===0||!bits[(y-1)*w+x])put(x,y,x+1,y);
    if(x===w-1||!bits[y*w+x+1])put(x+1,y,x+1,y+1);
    if(y===h-1||!bits[(y+1)*w+x])put(x+1,y+1,x,y+1);
    if(x===0||!bits[y*w+x-1])put(x,y+1,x,y);
  }
  const loops=[];const maxSteps=edges.size*2+4;
  while(edges.size){const start=edges.keys().next().value;let current=start;const contour=[];let steps=0;
    while(steps++<maxSteps){
      const y=Math.floor(current/(w+1)), x=current-y*(w+1);
      contour.push([x,y]);const targets=edges.get(current);if(!targets?.length)break;
      const target=targets.pop();if(!targets.length)edges.delete(current);
      current=key(target[0],target[1]);if(current===start)break;
    }
    if(contour.length>=3)loops.push(simplifyClosed(contour,Math.max(0,Number(tolerance)||0)));
  }
  const path=loops.map(points=>'M'+points.map(p=>`${p[0]} ${p[1]}`).join(' L')+' Z').join(' ');
  return {path,contours:loops.length,points:loops.reduce((s,x)=>s+x.length,0),viewBox:`0 0 ${w} ${h}`};
}
function simplifyClosed(points,tol){
  if(tol===0||points.length<8)return removeCollinear(points);
  const clean=removeCollinear(points);if(clean.length<5)return clean;
  // Iterative local removal avoids complicated open/closed loop endpoint assumptions.
  let out=clean;const threshold=tol*tol;
  for(let pass=0;pass<2;pass++){
    const next=[];
    for(let i=0;i<out.length;i++){
      const a=out[(i-1+out.length)%out.length], b=out[i], c=out[(i+1)%out.length];
      const dx=c[0]-a[0],dy=c[1]-a[1], d2=dx*dx+dy*dy;
      const distance=d2 ? Math.pow((b[0]-a[0])*dy-(b[1]-a[1])*dx,2)/d2 : Infinity;
      if(distance>threshold||out.length-next.length<=4)next.push(b);
    }
    if(next.length>=3)out=next;
  }
  return out;
}
function removeCollinear(points){return points.filter((b,i)=>{const a=points[(i-1+points.length)%points.length],c=points[(i+1)%points.length];return (b[0]-a[0])*(c[1]-b[1])!==(b[1]-a[1])*(c[0]-b[0]);});}
export function svgFromTrace(trace,{size=256,width=size,height=size,fill='#171721'}={}){
  const safePath=String(trace.path||'').replace(/[^MLCZmlcz0-9+\-.,\s]/g,'');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}"><path d="${safePath}" fill="${fill}" fill-rule="nonzero"/></svg>`;
}
export function imageDataToCanvas(imageData){const c=document.createElement('canvas');c.width=imageData.width;c.height=imageData.height;c.getContext('2d').putImageData(imageData,0,0);return c;}
