/**
 * Versioned, per-glyph editable artwork layers.
 * The active layer lives in the legacy glyph fields so the existing drawing
 * tools and Undo snapshots remain canonical. Inactive layers own independent
 * raster and Bezier data. Never store the read-only imported source in layers.
 */
import {bezierPath,combineGlyphPaths,inferRasterPath} from './bezier.js?v=0.3.42.2';
import {booleanPaths} from './vector-boolean.js?v=0.3.44.0';
import {resolveLinkedGlyphPaths,transformSvgPath,normalizeComponent,hasLinkedComponents} from './linked-components.js?v=0.3.47.0';
import {resolveLayerEffects,normalizeLayerClip,normalizeLayerEffect} from './layer-effects.js?v=0.3.48.0';

const MAIN='artwork';
export const LAYER_MODES=Object.freeze(['add','subtract','intersect','guide']);
const ART_FIELDS=['raster','rasterPath','bezierContours','contours','rasterCopyForEditing'];
const clone=value=>value==null?value:structuredClone(value);
const blank=()=>({raster:'',rasterPath:'',bezierContours:[],contours:[],rasterCopyForEditing:false});
const activeArt=g=>({raster:g.raster||'',rasterPath:g.rasterPath||inferRasterPath(g)||'',bezierContours:clone(g.bezierContours||[]),contours:clone(g.contours||[]),rasterCopyForEditing:!!g.rasterCopyForEditing});
function putArt(g,art){for(const field of ART_FIELDS)g[field]=clone(art?.[field]??blank()[field]);}
function artFor(g,layer){return layer.id===g.layerStack.activeId?activeArt(g):layer.art||blank();}
export function ensureGlyphLayers(g){
  if(!g.layerStack || !Array.isArray(g.layerStack.layers)){
    // No data is lost: the original editable drawing remains the first layer.
    g.layerStack={version:2,activeId:MAIN,layers:[{id:MAIN,name:'Original drawing',visible:true,locked:false,enabled:true,mode:'add',art:null}]};
  }
  if(![1,2].includes(g.layerStack.version))throw Error('Unknown layer format; refuse to overwrite project artwork');
  g.layerStack.version=2;
  for(const layer of g.layerStack.layers){if(!LAYER_MODES.includes(layer.mode))layer.mode='add';}
  if(!g.layerStack.layers.some(l=>l.id===g.layerStack.activeId))g.layerStack.activeId=g.layerStack.layers[0].id;
  return g.layerStack;
}
export function layerFor(g,id){return ensureGlyphLayers(g).layers.find(l=>l.id===id);}
export function activeLayer(g){return layerFor(g,ensureGlyphLayers(g).activeId);}
export function layerCanEdit(g){const layer=activeLayer(g);return !!layer&&!layer.locked&&layer.visible&&!layer.component;}
export function layerArtwork(g,layer){return artFor(g,layer);}
function evaluatedPaths(g,project=null){
 const componentPath=component=>{
  if(!project)return '';
  const spec=normalizeComponent(component);
  const source=resolveLinkedGlyphPaths(project)[spec.sourceGlyphId];
  return source?transformSvgPath(source,spec):'';
 };
 return resolveLayerEffects(g,{componentPath});
}
export function layerPath(g,layer,project=null){
 return evaluatedPaths(g,project)[layer.id]||'';
}
/** Compose monochrome drawing layers from bottom to top for *actual* TTF export.
 * Visibility and locks do not alter the exported font. 'guide' never exports.
 * Subtract/intersect use vector path booleans; source editable objects survive.
 */
export function compositeLayerPath(g,{visibleOnly=false,project=null}={}){
  const stack=ensureGlyphLayers(g);
  let result='';
  const paths=evaluatedPaths(g,project);
  for(const layer of stack.layers.slice().reverse()){
    if(!layer.enabled||layer.mode==='guide'||(visibleOnly&&!layer.visible))continue;
    const path=paths[layer.id]||'';
    if(!path){if(layer.mode==='intersect')result='';continue;}
    if(layer.mode==='add'){result=[result,path].filter(Boolean).join(' ');continue;}
    if(!result)continue;
    result=booleanPaths(result,path,layer.mode,{tolerance:.3}).path;
  }
  return result;
}
export function hasCompositingModes(g){return ensureGlyphLayers(g).layers.some(l=>l.enabled&&(
 l.mode==='subtract'||l.mode==='intersect'||l.clip?.enabled!==false&&!!l.clip?.path||
 (l.modifiers||[]).some(m=>m.enabled!==false)
));}
/** All original editable ink before modifiers; used only for preview knockouts.
 * Exported geometry still uses compositeLayerPath and retains real holes. */
export function originalVisibleLayerPaths(g,project=null){
 const stack=ensureGlyphLayers(g);
 const parts=[];
 for(const layer of stack.layers){
  if(!layer.visible||layer.mode==='guide')continue;
  const a=artFor(g,layer);
  let p=combineGlyphPaths(a.rasterPath||inferRasterPath(a)||'',a.bezierContours||[]);
  if(layer.component&&project){const spec=normalizeComponent(layer.component);
   const source=resolveLinkedGlyphPaths(project)[spec.sourceGlyphId]||'';
   if(source)p=[p,transformSvgPath(source,spec)].filter(Boolean).join(' ');
  }
  if(p)parts.push(p);
 }
 return parts.join(' ');
}

export function rawExportLayerPaths(g,{visibleOnly=false,project=null}={}){const paths=evaluatedPaths(g,project);return ensureGlyphLayers(g).layers.slice().reverse().filter(l=>l.enabled&&l.mode!=='guide'&&(!visibleOnly||l.visible)).map(l=>paths[l.id]).filter(Boolean).join(' ');}

export function updateLayerPath(g,project=null){
  if(project&&hasLinkedComponents(project)){resolveLinkedGlyphPaths(project,{commit:true});return g;}
  if(g.layerStack)g.path=compositeLayerPath(g);
  return g;
}
export function selectLayer(g,id){
  const stack=ensureGlyphLayers(g),old=activeLayer(g),next=layerFor(g,id);
  if(!next)throw new Error('Layer not found');
  if(next.id===old.id)return g;
  old.art=activeArt(g);
  putArt(g,next.art||blank());next.art=null;
  stack.activeId=id;
  return updateLayerPath(g);
}
export function addLayer(g,name='New layer'){
  const stack=ensureGlyphLayers(g),id='layer-'+(globalThis.crypto?.randomUUID?.()||Date.now().toString(36)+Math.random().toString(36).slice(2));
  const layer={id,name,visible:true,locked:false,enabled:true,mode:'add',art:blank()};
  stack.layers.unshift(layer);selectLayer(g,id);return layer;
}
export function duplicateLayer(g,id){
  const stack=ensureGlyphLayers(g),original=layerFor(g,id);
  if(!original)throw new Error('Layer not found');
  const idx=stack.layers.indexOf(original),idNew='layer-'+(globalThis.crypto?.randomUUID?.()||Math.random().toString(36).slice(2));
  const copy={...clone(original),id:idNew,name:original.name+' copy',art:clone(artFor(g,original))};
  stack.layers.splice(idx,0,copy);selectLayer(g,idNew);return copy;
}
export function removeLayer(g,id){
  const stack=ensureGlyphLayers(g),layer=layerFor(g,id);
  if(!layer||layer.id===MAIN)throw new Error('Original drawing cannot be removed');
  if(stack.activeId===id)selectLayer(g,MAIN);
  stack.layers=stack.layers.filter(l=>l.id!==id);
  return updateLayerPath(g);
}
export function moveLayer(g,id,delta){
  const stack=ensureGlyphLayers(g),i=stack.layers.findIndex(l=>l.id===id),next=i+delta;
  if(i<0||next<0||next>=stack.layers.length)return false;
  [stack.layers[i],stack.layers[next]]=[stack.layers[next],stack.layers[i]];
  updateLayerPath(g);return true;
}
export function updateLayer(g,id,patch){
  const layer=layerFor(g,id);if(!layer)throw new Error('Layer not found');
  const safe={...patch};delete safe.id;delete safe.art;
  if(safe.mode!=null&&!LAYER_MODES.includes(safe.mode))throw Error('Unknown layer mode: '+safe.mode);
  if(safe.clip!==undefined)safe.clip=normalizeLayerClip(safe.clip);
  if(safe.modifiers!==undefined){if(!Array.isArray(safe.modifiers)||safe.modifiers.length>24)throw Error('Invalid layer modifiers');safe.modifiers=safe.modifiers.map(normalizeLayerEffect);}
  if(safe.name!=null)safe.name=String(safe.name).trim().slice(0,70)||layer.name;
  if(safe.visible===false&&activeLayer(g)?.id===id)throw new Error('Select another layer before hiding the active layer');
  Object.assign(layer,safe);
  return updateLayerPath(g);
}
export function otherLayerPaths(g,project=null){
  const stack=ensureGlyphLayers(g),i=stack.layers.findIndex(l=>l.id===stack.activeId);
  const paths=evaluatedPaths(g,project);
  const toPaths=arr=>arr.slice().reverse().filter(l=>l.visible).map(l=>({id:l.id,mode:l.mode,path:paths[l.id]||''})).filter(x=>x.path);
  return {below:toPaths(stack.layers.slice(i+1)),above:toPaths(stack.layers.slice(0,i))};
}
export const IMPORTED_LAYER_ID='imported-reference';

/** Preserve an imported source glyph when the user drew only reference/disabled
 * layers. Empty intentional edits (Clear glyph) remain valid overrides.
 * This modifies only the compilation snapshot, never the saved project. */
export function fontGlyphsForCompilation(glyphs){
 const output=hasLinkedComponents({glyphs})?structuredClone(glyphs):{...glyphs};
 if(hasLinkedComponents({glyphs:output}))resolveLinkedGlyphPaths({glyphs:output},{commit:true});
 for(const [key,g] of Object.entries(output)){
  if(!g?.modified||!g?.layerStack||String(g.path||'').trim())continue;
  const snapshot=structuredClone(g),stack=ensureGlyphLayers(snapshot);
  const nonExportInk=stack.layers.some(layer=>(!layer.enabled||layer.mode==='guide')&&(!!layer.component||!!layerPath(snapshot,layer)));
  if(nonExportInk)output[key]={...g,modified:false};
 }
 return output;
}
