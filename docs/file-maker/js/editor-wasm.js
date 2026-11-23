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
    editorCore=wasm;editorError='';return true;
  }catch(e){editorError=String(e?.message||e);return false;}
}
export function editorGeometryStatus(){return {ready:!!editorCore,error:editorError};}
/** Return shape diagnostics. Can be tested without WASM using the fallback. */
export function analyzeContours(contours){
  if(editorCore)return JSON.parse(editorCore.analyze_contours(JSON.stringify(contours||[])));
  const c=Array.isArray(contours)?contours:[];
  return {contourCount:c.length,pointCount:c.reduce((n,x)=>n+(x.points?.length||0),0),
    holes:c.filter(x=>x.role==='hole').length,
    warnings:c.flatMap((x,i)=>!Array.isArray(x.points)||x.points.length<3?[`Contour ${i+1} has fewer than three points`]:[]),
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
