/* MIT — Erase editable vector ink with the same brush as raster ink.
 * Only contours crossed by an eraser stroke are rasterized; unrelated
 * contours remain native, editable Béziers. All conversion happens inside
 * a single reversible glyph edit, never in the imported reference layer.
 */
import {bezierPath} from './bezier.js?v=0.3.42.2';

export function drawBrushGeometry(context, points) {
  if (!Array.isArray(points) || !points.length) return;
  context.beginPath();
  context.moveTo(points[0].x, points[0].y);
  if (points.length === 1) context.lineTo(points[0].x + .01, points[0].y + .01);
  else if (points.length === 2) context.lineTo(points[1].x, points[1].y);
  else {
    for (let i = 1; i < points.length - 1; i++) {
      context.quadraticCurveTo(points[i].x, points[i].y,
        (points[i].x + points[i + 1].x) / 2, (points[i].y + points[i + 1].y) / 2);
    }
    context.lineTo(points.at(-1).x, points.at(-1).y);
  }
}

// SVG counterpart of drawBrushGeometry, used to make the live overlay
// disappear under the same smooth stroke as the final erased raster pixels.
export function brushSvgPath(points) {
  if (!points?.length) return '';
  let d=`M ${points[0].x} ${points[0].y}`;
  if(points.length===1)return d+` L ${points[0].x+.01} ${points[0].y+.01}`;
  if(points.length===2)return d+` L ${points[1].x} ${points[1].y}`;
  for(let i=1;i<points.length-1;i++) {
    const midX=(points[i].x+points[i+1].x)/2;
    const midY=(points[i].y+points[i+1].y)/2;
    d+=` Q ${points[i].x} ${points[i].y} ${midX} ${midY}`;
  }
  return d+` L ${points.at(-1).x} ${points.at(-1).y}`;
}


/** Sample the same smoothed centreline used by drawBrushGeometry. A square
 * Pencil/Eraser is the swept union of axis-aligned square stamps, NOT merely
 * a regular round brush with flat end caps. Both live raster and vector-mask
 * operations use this one shared sampling function.
 */
export function squareBrushSamples(points,diameter){
 if(!Array.isArray(points)||!points.length)return [];
 const step=Math.max(.5,Math.min(2,diameter/4));
 const samples=[{...points[0]}];
 const line=(a,b)=>{const n=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/step));
  for(let k=1;k<=n;k++){const t=k/n;samples.push({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});}
 };
 if(points.length===1)return samples;
 if(points.length===2){line(points[0],points[1]);return samples;}
 let from=points[0];
 for(let i=1;i<points.length-1;i++){
  const control=points[i],end={x:(points[i].x+points[i+1].x)/2,y:(points[i].y+points[i+1].y)/2};
  const estimate=Math.hypot(control.x-from.x,control.y-from.y)+Math.hypot(end.x-control.x,end.y-control.y);
  const n=Math.max(2,Math.ceil(estimate/step));
  for(let k=1;k<=n;k++){const a=k/n,b=1-a;samples.push({x:b*b*from.x+2*b*a*control.x+a*a*end.x,y:b*b*from.y+2*b*a*control.y+a*a*end.y});}
  from=end;
 }
 line(from,points.at(-1));return samples;
}
export function drawSquareBrushGeometry(context,points,diameter){
 const r=diameter/2;
 for(const {x,y} of squareBrushSamples(points,diameter))context.fillRect(x-r,y-r,diameter,diameter);
}
export function squareBrushSvgFootprint(points,diameter){
 const r=diameter/2;
 return squareBrushSamples(points,diameter).map(({x,y})=>`M ${x-r} ${y-r} L ${x+r} ${y-r} L ${x+r} ${y+r} L ${x-r} ${y+r} Z`).join(' ');
}

function intersects(first, second) {
  for (let i = 3; i < first.length; i += 4) {
    if (first[i] && second[i]) return true;
  }
  return false;
}

/**
 * Return the contours to turn into ordinary editable ink, along with an
 * antialiased bitmap of exactly those contours. The bitmap is composited
 * before erasing; the same indices are then removed from bezierContours.
 * A cut crossing a native hole includes its filled parent and enclosed holes
 * so its transparency is not accidentally painted over.
 *
 * @param {Array} contours Existing vector contours
 * @param {Array} points Smoothed eraser brush stroke points
 * @param {number} diameter Brush width, in artboard units
 * @param {number} width Artboard width
 * @param {number} height Artboard height
 * @param {Function} canvasFactory (width,height) => HTMLCanvasElement
 */
export function rasterizeVectorsCrossedByEraser(contours, points, diameter, width, height, canvasFactory, tipShape='round') {
  if (!Array.isArray(contours) || !contours.length || !points?.length) return {indices:[],layer:null};
  const mask=canvasFactory(width,height),brush=mask.getContext('2d',{willReadFrequently:true});
  brush.lineWidth=diameter;brush.lineCap='round';brush.lineJoin='round';
  brush.strokeStyle='#000';brush.fillStyle='#000';
  if(tipShape==='square')drawSquareBrushGeometry(brush,points,diameter);
  else{drawBrushGeometry(brush,points);brush.stroke();}
  return rasterizeVectorsCrossedByMask(contours,mask,width,height,canvasFactory);
}

// The same vector-to-raster bridge serves a selected rectangle/lasso. The
// caller supplies a pixel-aligned mask so only selected editable ink is cut.
// Contours outside the mask remain vector objects; the imported font is never
// included. Hole + parent dependency is preserved just like brush erasing.
export function rasterizeVectorsCrossedByMask(contours, mask, width, height, canvasFactory) {
  if (!Array.isArray(contours) || !contours.length || !mask) return {indices:[],layer:null};
  const make=() => canvasFactory(width,height);
  const eraser=mask.getContext('2d',{willReadFrequently:true}).getImageData(0,0,width,height).data;

  // Only rasterize actual vector ink, not a touch wholly within a counter.
  const visible=make(),vc=visible.getContext('2d',{willReadFrequently:true});
  vc.fillStyle='#111119';vc.fill(new Path2D(bezierPath(contours)),'nonzero');
  if (!intersects(eraser,vc.getImageData(0,0,width,height).data)) return {indices:[],layer:null};

  const picked=new Set(),probe=make(),pc=probe.getContext('2d',{willReadFrequently:true});
  pc.fillStyle='#111119';
  for (let i=0;i<contours.length;i++) {
    if (!contours[i]?.points?.length) continue;
    pc.clearRect(0,0,width,height);
    pc.fill(new Path2D(bezierPath([contours[i]])),'nonzero');
    if(intersects(eraser,pc.getImageData(0,0,width,height).data)) picked.add(i);
  }
  // A negative-winding hole cannot be rasterized independently of the fill
  // that gives it meaning; likewise a flattened parent must take its holes.
  // Use the vector geometry itself for the containment test.
  let changed=true;
  while(changed) {
    changed=false;
    for (let hole=0;hole<contours.length;hole++) {
      const h=contours[hole];
      if(h.role!=='hole'||!h.points?.length)continue;
      const start=h.points[0];
      for (let fill=0;fill<contours.length;fill++) {
        const parent=contours[fill];
        if(parent.role==='hole'||!parent.points?.length)continue;
        if(!pc.isPointInPath(new Path2D(bezierPath([parent])),start.x,start.y,'nonzero')) continue;
        if(picked.has(fill)!==picked.has(hole)) {
          picked.add(fill);picked.add(hole);changed=true;
        }
      }
    }
  }
  if(!picked.size) return {indices:[],layer:null};
  const indices=[...picked].sort((a,b)=>a-b);
  const layer=make(),lc=layer.getContext('2d');
  lc.fillStyle='#111119';
  lc.fill(new Path2D(bezierPath(indices.map(i=>contours[i]))),'nonzero');
  return {indices,layer};
}

/** Closed vector footprint of a freehand eraser, with round caps. The original
 * centreline remains untouched; the footprint is only the subtraction operand.
 * Geometry is returned as SVG and never committed as raster ink. */
export function vectorBrushFootprint(points,diameter,tipShape='round'){
 if(!points?.length||!Number.isFinite(diameter)||diameter<=0)return '';
 if(tipShape==='square')return squareBrushSvgFootprint(points,diameter);
 const radius=diameter/2,seq=[];
 const push=(x,y)=>{if(!seq.length||Math.hypot(x-seq.at(-1).x,y-seq.at(-1).y)>.04)seq.push({x,y});};
 push(points[0].x,points[0].y);
 if(points.length===1){for(let i=0;i<32;i++){const a=i*2*Math.PI/32;push(points[0].x+radius*Math.cos(a),points[0].y+radius*Math.sin(a));}}
 else if(points.length===2){push(points[1].x,points[1].y);}
 else {
  for(let i=1;i<points.length-1;i++){
   const a=i===1?points[0]:{x:(points[i-1].x+points[i].x)/2,y:(points[i-1].y+points[i].y)/2};
   const b=points[i],c={x:(points[i].x+points[i+1].x)/2,y:(points[i].y+points[i+1].y)/2};
   for(let j=1;j<=8;j++){const t=j/8,u=1-t;push(u*u*a.x+2*u*t*b.x+t*t*c.x,u*u*a.y+2*u*t*b.y+t*t*c.y);}
  }
  push(points.at(-1).x,points.at(-1).y);
 }
 if(points.length===1)return `M ${seq.map(p=>`${p.x.toFixed(4)} ${p.y.toFixed(4)}`).join(' L ')} Z`;
 const tangents=seq.map((p,i)=>{const prev=seq[Math.max(0,i-1)],next=seq[Math.min(seq.length-1,i+1)];const dx=next.x-prev.x,dy=next.y-prev.y,len=Math.hypot(dx,dy)||1;return {dx:dx/len,dy:dy/len};});
 const side=(p,t,s)=>({x:p.x-s*t.dy*radius,y:p.y+s*t.dx*radius});
 const left=seq.map((p,i)=>side(p,tangents[i],1));
 const right=seq.map((p,i)=>side(p,tangents[i],-1));
 const arc=(p,t,startAngle)=>Array.from({length:16},(_,i)=>{
   const a=startAngle-(i+1)*Math.PI/16;return {x:p.x+radius*Math.cos(a),y:p.y+radius*Math.sin(a)};
 });
 const end=seq.at(-1),start=seq[0],lastAngle=Math.atan2(tangents.at(-1).dx,-tangents.at(-1).dy),firstAngle=Math.atan2(-tangents[0].dx,tangents[0].dy);
 const polygon=[...left,...arc(end,tangents.at(-1),lastAngle),...right.reverse(),...arc(start,tangents[0],firstAngle)];
 return `M ${polygon.map(p=>`${p.x.toFixed(4)} ${p.y.toFixed(4)}`).join(' L ')} Z`;
}
