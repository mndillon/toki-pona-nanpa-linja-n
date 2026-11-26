import {registerNativePolygonBoolean,nativePolygonBooleanReady} from './vector-boolean.js?v=0.3.44.0';
import {validateOutline} from './outline-validation.js?v=0.3.46.0';
import {insertBezierNode,cubicExtrema,insertContourExtrema} from './vector-path-tools.js?v=0.3.44.0';
/** Independent WASM for vector diagnostics; never prevents the original
 * font compiler from loading or the existing tools from working. */
let editorCore=null,editorError='Geometry WASM not built';
export async function initializeEditorGeometry(){
  try{
    const info=await fetch('./file-maker/wasm/editor-pkg/build-info.json',{cache:'no-store'});
    if(!info.ok)throw Error('Drawing WASM not built');
    const {sha256}=await info.json();
    if(!/^[a-f0-9]{64}$/.test(sha256))throw Error('Invalid editor WASM build identity');
    const wasm=await import(`../wasm/editor-pkg/sp_editor_core.js?v=${sha256}`);
    await wasm.default(new URL(`../wasm/editor-pkg/sp_editor_core_bg.wasm?v=${sha256}`,import.meta.url));
    if(typeof wasm.analyze_contours!=='function')throw Error('Drawing WASM missing analyze_contours');
    // Stage the Rust arrangement kernel only when it passes independent JS
    // canaries. Native failures fall back without partially changing a glyph.
    if(typeof wasm.polygon_boolean_json==='function')registerNativePolygonBoolean((a,b,operation)=>
      JSON.parse(wasm.polygon_boolean_json(JSON.stringify(a),JSON.stringify(b),operation)));
    editorCore=wasm;editorError='';return true;
  }catch(e){editorError=String(e?.message||e);return false;}
}
export function editorGeometryStatus(){return {ready:!!editorCore,nativePolygonBoolean:nativePolygonBooleanReady(),error:editorError};}
/** Return shape diagnostics. Can be tested without WASM using the fallback. */
export function analyzeContours(contours){
  if(editorCore)return JSON.parse(editorCore.analyze_contours(JSON.stringify(contours||[])));
  const c=Array.isArray(contours)?contours:[];
  return {contourCount:c.length,pointCount:c.reduce((n,x)=>n+(x.points?.length||0),0),
    holes:c.filter(x=>x.role==='hole').length,
    warnings:c.flatMap((x,i)=>!Array.isArray(x.points)||x.points.length<(x.kind==='stroke'?2:3)?[`Contour ${i+1} has fewer than ${x.kind==='stroke'?'two':'three'} points`]:[]),
    engine:'javascript-fallback'};
}

/** Set a selected Bézier anchor to smooth or corner without changing its neighbours. */
export function adjustBezierNode(node,previous,next,mode){
  if(!['smooth','corner'].includes(mode))throw new Error('Unknown point mode');
  if(editorCore){return JSON.parse(editorCore.adjust_node(JSON.stringify(node),JSON.stringify(previous),JSON.stringify(next),mode));}
  if(mode==='corner')return {in:[node.x,node.y],out:[node.x,node.y]};
  const dx=next.x-previous.x,dy=next.y-previous.y,mag=Math.hypot(dx,dy);
  if(mag<1e-6)throw new Error('Cannot smooth a point with identical neighbours');
  const dIn=Math.hypot(node.x-node.in[0],node.y-node.in[1])||Math.hypot(node.x-previous.x,node.y-previous.y)/3;
  const dOut=Math.hypot(node.out[0]-node.x,node.out[1]-node.y)||Math.hypot(next.x-node.x,next.y-node.y)/3;
  return {in:[node.x-dx/mag*dIn,node.y-dy/mag*dIn],out:[node.x+dx/mag*dOut,node.y+dy/mag*dOut]};
}

/** Extended glyph validation; WASM diagnostics + sampled cubic geometry checks. */
export function validateGlyphContours(contours){
  const structural=analyzeContours(contours);
  const precise=validateOutline(contours);
  return {...structural,issues:precise.issues,valid:precise.valid,warnings:[...new Set([...structural.warnings,...precise.warnings])]};
}

/** Exact de Casteljau split. Uses the separate drawing WASM when available;
 * the equivalent offline JS implementation keeps the editor usable during
 * development before the independent Rust package has been rebuilt. */
export function splitEditableBezier(contour,index,t=.5){
  if(!editorCore?.split_cubic)return insertBezierNode(contour,index,t);
  const c=structuredClone(contour),n=c.points?.length||0,open=c.kind==='stroke'&&!c.closed;
  if(!Number.isInteger(index)||index<0||index>=n-(open?1:0))throw Error('Choose a segment with a following node');
  const a=c.points[index],b=c.points[(index+1)%n];
  const s=JSON.parse(editorCore.split_cubic(JSON.stringify(a),JSON.stringify(b),t));
  a.out=s.before_out;b.in=s.after_in;
  const newNode={x:s.middle.x,y:s.middle.y,in:s.middle.in,out:s.middle.out};
  c.points.splice(index+1,0,newNode);
  if(c.kind==='stroke'){
    const widths=c.widths||Array(n-(c.closed?0:1)).fill(c.width||9),w=widths[index]||c.width||9;
    widths.splice(index,1,w,w);c.widths=widths;
  }
  return {contour:c,index:index+1};
}

/** Precise extrema from the independent geometry WASM when available. */
export function findBezierExtrema(a,b){
  return editorCore?.cubic_extrema?JSON.parse(editorCore.cubic_extrema(JSON.stringify(a),JSON.stringify(b))):cubicExtrema(a,b);
}
/** One operation for all segments, suitable for one grouped Undo entry. */
export function addContourExtrema(contour){
  return insertContourExtrema(contour,splitEditableBezier,findBezierExtrema);
}
