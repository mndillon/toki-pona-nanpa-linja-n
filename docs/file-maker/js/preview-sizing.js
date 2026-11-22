// Preview-only sizing. CSS text metrics use font bounding boxes, which can
// overstate the *drawn ink* for ligatures and transformed compound glyphs.
// Measure rasterized pixels from the exact loaded font instead. Never alter TTFs.
export function maxInkHeight(measureText,source){
  let maxHeight=0;
  for(const line of String(source).split(/\r\n|\r|\n/u)){
    if(!line.trim())continue;
    const metrics=measureText(line);
    const asc=Number(metrics?.actualBoundingBoxAscent);
    const desc=Number(metrics?.actualBoundingBoxDescent);
    if(Number.isFinite(asc)&&Number.isFinite(desc))maxHeight=Math.max(maxHeight,Math.max(0,asc)+Math.max(0,desc));
  }
  return maxHeight;
}
export function emForInkHeight(targetPx,referenceInkHeight,referenceEm=100){
  const target=Number(targetPx);
  if(!Number.isFinite(target)||target<=0)return 32;
  if(!Number.isFinite(referenceInkHeight)||referenceInkHeight<=0)return target;
  return Math.max(1,Math.min(1500,(target*referenceEm)/referenceInkHeight));
}

// Read actual antialiased ink pixels (alpha > threshold) for a shaped line.
// Counting pixel rows rather than relying on TextMetrics avoids accidentally
// measuring unused contour/bounding-box extents of composite glyphs.
export function rasterInkHeight(ctx,source,family,emSize,alphaThreshold=24){
  if(!ctx || !Number.isFinite(emSize) || emSize<=0)return 0;
  let largest=0;
  const pad=Math.max(24,Math.ceil(emSize*.4));
  for(const line of String(source).split(/\r\n|\r|\n/u)){
    if(!line.trim())continue;
    ctx.font=`400 ${emSize}px "${family}"`;
    const m=ctx.measureText(line);
    const asc=Math.max(0,Number(m.actualBoundingBoxAscent)||0);
    const desc=Math.max(0,Number(m.actualBoundingBoxDescent)||0);
    const left=Math.max(0,Number(m.actualBoundingBoxLeft)||0);
    const right=Math.max(0,Number(m.actualBoundingBoxRight)||0);
    const advance=Math.max(0,Number(m.width)||0);
    const x=pad+Math.ceil(left);
    // Keep a generous canvas for negative-overhang joining rules.
    const width=Math.ceil(Math.max(x+right+pad,x+advance+pad,2*pad+1));
    const height=Math.ceil(asc+desc+2*pad);
    // Prevent excessive canvas allocations for arbitrary pasted preview text.
    if(width>12000||height>2400||width*height>12000000)continue;
    ctx.canvas.width=width;ctx.canvas.height=height;
    // Resizing the canvas resets its state.
    ctx.font=`400 ${emSize}px "${family}"`;
    ctx.textBaseline='alphabetic';ctx.textAlign='left';ctx.fillStyle='#000';
    ctx.clearRect(0,0,width,height);
    ctx.fillText(line,x,Math.ceil(asc+pad));
    const pixels=ctx.getImageData(0,0,width,height).data;
    let first=height,last=-1;
    for(let y=0;y<height;y++){
      const row=(y*width*4)+3;
      for(let x=0;x<width;x++){
        if(pixels[row+x*4]>alphaThreshold){first=Math.min(first,y);last=Math.max(last,y);break;}
      }
    }
    if(last>=first)largest=Math.max(largest,last-first+1);
  }
  return largest;
}

// Hinting can make the ink height change by a pixel at small sizes, so measure
// the proposed size as well and refine it rather than trusting linear scaling.
export function emForRasterHeight(targetPx,measureInk){
  const target=Math.max(6,Math.min(144,Number(targetPx)||32));
  const reference=measureInk(100);
  if(!reference)return {em:target,ink:0};
  let em=emForInkHeight(target,reference,100);
  let ink=measureInk(em);
  for(let i=0;i<3&&ink>0&&Math.abs(target-ink)>1;i++){
    const next=Math.max(1,Math.min(1500,em*target/ink));
    if(Math.abs(next-em)<.1)break;
    em=next;ink=measureInk(em);
  }
  return {em,ink};
}
