/** Non-destructive per-layer shape modifiers and SVG clipping. v0.3.48.
 * Layer source artwork, layer references and editable Bézier handles remain
 * untouched. A render-time topology result is returned for the TTF compiler.
 * Pure module: no DOM, no storage, no application-state mutation.
 */
import {bezierPath, combineGlyphPaths, inferRasterPath} from './bezier.js?v=0.3.42.2';
import {booleanPaths} from './vector-boolean.js?v=0.3.44.0';

export const EFFECT_OPERATIONS=Object.freeze(['union','subtract','intersect','exclude']);
const validId=id=>typeof id==='string'&&id.length>0&&id.length<150;
const MAX_EFFECTS=24;
const MAX_CLIP_LENGTH=100000;
const MAX_RESULT_LENGTH=2000000;

export function normalizeLayerEffect(effect){
 if(!effect||typeof effect!=='object')throw Error('Missing layer modifier');
 const operation=String(effect.operation||'');
 if(!EFFECT_OPERATIONS.includes(operation))throw Error('Unsupported layer modifier: '+operation);
 const sourceLayerId=String(effect.sourceLayerId??'');
 if(!validId(sourceLayerId))throw Error('Invalid source layer ID');
 return {operation,sourceLayerId,enabled:effect.enabled!==false};
}
export function normalizeLayerClip(clip){
 if(clip==null)return null;
 if(typeof clip!=='object'||typeof clip.path!=='string')throw Error('Invalid clipping shape');
 const path=clip.path.trim();
 if(!path||path.length>MAX_CLIP_LENGTH||!/^[Mm]/.test(path)||!/[Zz]\s*$/.test(path))throw Error('Clipping outline must be a closed SVG shape');
 // Reject script, URL or malformed glyph data before handing it to the parser.
 if(!/^[MmLlHhVvCcQqZz0-9eE+.,\s-]+$/.test(path))throw Error('Unsupported clipping outline');
 return {path,enabled:clip.enabled!==false};
}
/** Evaluate modifiers as an acyclic graph. Source layers are never flattened.
 * Composition visibility is handled by callers, not by the dependency graph:
 * an invisible/disabled source is still a valid non-destructive operand.
 */
export function resolveLayerEffects(g,{componentPath=()=>''}={}){
 const stack=g?.layerStack;
 if(!stack?.layers)return {};
 const byId=new Map(stack.layers.map(layer=>[layer.id,layer]));
 if(byId.size!==stack.layers.length)throw Error('Duplicate layer IDs');
 const cache=new Map(),visiting=new Set();
 const resolve=id=>{
  if(cache.has(id))return cache.get(id);
  if(visiting.has(id))throw Error('Layer modifier dependency cycle: '+[...visiting,id].join(' → '));
  const layer=byId.get(id);
  if(!layer)throw Error('Layer modifier source missing: '+id);
  if(visiting.size>48)throw Error('Too many nested layer modifiers');
  visiting.add(id);
  try{
   const art=id===stack.activeId?g:layer.art||{};
   let path=combineGlyphPaths(art.rasterPath||inferRasterPath(art)||'',art.bezierContours||[]);
   if(layer.component){
    const source=componentPath(layer.component);
    if(source)path=[path,source].filter(Boolean).join(' ');
   }
   const effects=layer.modifiers||[];
   if(!Array.isArray(effects)||effects.length>MAX_EFFECTS)throw Error('Too many layer modifiers');
   for(const raw of effects){
    const effect=normalizeLayerEffect(raw);
    if(!effect.enabled)continue;
    if(effect.sourceLayerId===id)throw Error('A layer cannot modify itself');
    const operand=resolve(effect.sourceLayerId);
    if(effect.operation==='union'){path=[path,operand].filter(Boolean).join(' ');}
    else if(!path){/* no ink to subtract/keep/exclude */if(effect.operation==='exclude')path=operand;}
    else if(operand)path=booleanPaths(path,operand,effect.operation,{tolerance:.3}).path;
    else if(effect.operation==='intersect')path='';
   }
   const clip=normalizeLayerClip(layer.clip);
   if(clip?.enabled&&path)path=booleanPaths(path,clip.path,'intersect',{tolerance:.3}).path;
   if(path.length>MAX_RESULT_LENGTH)throw Error('Layer result exceeds the geometry safety limit');
   cache.set(id,path);
   return path;
  }finally{visiting.delete(id);}
 };
 for(const layer of stack.layers)resolve(layer.id);
 return Object.fromEntries(cache);
}
/** Preflight a proposed change without touching the project, then return a
 * new deep-cloned layer stack suitable for an atomic undoable transaction. */
export function previewLayerEffectChange(g,layerId,change){
 if(!g?.layerStack)throw Error('Glyph layers are unavailable');
 const copy=structuredClone(g);
 const layer=copy.layerStack.layers.find(l=>l.id===layerId);
 if(!layer)throw Error('Layer not found');
 change(layer);
 resolveLayerEffects(copy); // Invalid graph/clip fails before any commit.
 return copy.layerStack;
}
export function makeRectangleClip(r){
 const x=Number(r?.x),y=Number(r?.y),w=Number(r?.width),h=Number(r?.height);
 if(![x,y,w,h].every(Number.isFinite)||w<1||h<1||Math.abs(x)+Math.abs(y)+Math.abs(w)+Math.abs(h)>30000)throw Error('Choose a valid selection before clipping');
 const f=v=>Number(v.toFixed(3));
 return {path:`M ${f(x)} ${f(y)} L ${f(x+w)} ${f(y)} L ${f(x+w)} ${f(y+h)} L ${f(x)} ${f(y+h)} Z`,enabled:true};
}
export function makePolygonClip(points){
 if(!Array.isArray(points)||points.length<3||points.length>1500||points.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)))throw Error('Invalid lasso for clipping');
 const f=v=>Number(v.toFixed(3));
 return normalizeLayerClip({path:`M ${f(points[0].x)} ${f(points[0].y)} `+points.slice(1).map(p=>`L ${f(p.x)} ${f(p.y)}`).join(' ')+' Z'});
}
