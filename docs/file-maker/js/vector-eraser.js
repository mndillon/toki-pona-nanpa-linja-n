/* MIT — Erase editable vector ink with the same brush as raster ink.
 * Only contours crossed by an eraser stroke are rasterized; unrelated
 * contours remain native, editable Béziers. All conversion happens inside
 * a single reversible glyph edit, never in the imported reference layer.
 */
import {bezierPath} from './bezier.js';

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
export function rasterizeVectorsCrossedByEraser(contours, points, diameter, width, height, canvasFactory) {
  if (!Array.isArray(contours) || !contours.length || !points?.length) return {indices:[], layer:null};
  const make=() => canvasFactory(width,height);
  const mask=make(), brush=mask.getContext('2d',{willReadFrequently:true});
  brush.lineWidth=diameter;brush.lineCap='round';brush.lineJoin='round';
  brush.strokeStyle='#000';drawBrushGeometry(brush,points);brush.stroke();
  const eraser=brush.getImageData(0,0,width,height).data;

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
