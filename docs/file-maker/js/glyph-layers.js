/**
 * Versioned, per-glyph editable artwork layers.
 * The active layer lives in the legacy glyph fields so the existing drawing
 * tools and Undo snapshots remain canonical. Inactive layers own independent
 * raster and Bezier data. Never store the read-only imported source in layers.
 */
import {bezierPath,combineGlyphPaths,inferRasterPath} from './bezier.js';

const MAIN='artwork';
const ART_FIELDS=['raster','rasterPath','bezierContours','contours','rasterCopyForEditing'];
const clone=value=>value==null?value:structuredClone(value);
const blank=()=>({raster:'',rasterPath:'',bezierContours:[],contours:[],rasterCopyForEditing:false});
const activeArt=g=>({raster:g.raster||'',rasterPath:g.rasterPath||inferRasterPath(g)||'',bezierContours:clone(g.bezierContours||[]),contours:clone(g.contours||[]),rasterCopyForEditing:!!g.rasterCopyForEditing});
function putArt(g,art){for(const field of ART_FIELDS)g[field]=clone(art?.[field]??blank()[field]);}
function artFor(g,layer){return layer.id===g.layerStack.activeId?activeArt(g):layer.art||blank();}
export function ensureGlyphLayers(g){
  if(!g.layerStack || g.layerStack.version!==1 || !Array.isArray(g.layerStack.layers)){
    // No data is lost: the original editable drawing remains the first layer.
    g.layerStack={version:1,activeId:MAIN,layers:[{id:MAIN,name:'Original drawing',visible:true,locked:false,enabled:true,art:null}]};
  }
  if(!g.layerStack.layers.some(l=>l.id===g.layerStack.activeId))g.layerStack.activeId=g.layerStack.layers[0].id;
  return g.layerStack;
}
export function layerFor(g,id){return ensureGlyphLayers(g).layers.find(l=>l.id===id);}
export function activeLayer(g){return layerFor(g,ensureGlyphLayers(g).activeId);}
export function layerCanEdit(g){const layer=activeLayer(g);return !!layer&&!layer.locked&&layer.visible;}
export function layerArtwork(g,layer){return artFor(g,layer);}
export function layerPath(g,layer){const art=artFor(g,layer);return combineGlyphPaths(art.rasterPath,art.bezierContours||[]);}
export function compositeLayerPath(g){
  const stack=ensureGlyphLayers(g);
  // Bottom-to-top. Layer ordering is independent from the imported reference.
  return stack.layers.slice().reverse().filter(l=>l.enabled).map(l=>layerPath(g,l)).filter(Boolean).join(' ');
}
export function updateLayerPath(g){
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
  const layer={id,name,visible:true,locked:false,enabled:true,art:blank()};
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
  if(safe.name!=null)safe.name=String(safe.name).trim().slice(0,70)||layer.name;
  if(safe.visible===false&&activeLayer(g)?.id===id)throw new Error('Select another layer before hiding the active layer');
  Object.assign(layer,safe);
  return updateLayerPath(g);
}
export function otherLayerPaths(g){
  const stack=ensureGlyphLayers(g),i=stack.layers.findIndex(l=>l.id===stack.activeId);
  const toPaths=arr=>arr.slice().reverse().filter(l=>l.visible).map(l=>({id:l.id,path:layerPath(g,l)})).filter(x=>x.path);
  return {below:toPaths(stack.layers.slice(i+1)),above:toPaths(stack.layers.slice(0,i))};
}
export const IMPORTED_LAYER_ID='imported-reference';
