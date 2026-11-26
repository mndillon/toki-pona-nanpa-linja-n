/** Live, non-destructive glyph components. Offline and independent of the TTF compiler.
 * Coordinates are the existing 400 x 430 editor coordinate system. All SVG
 * transforms are baked into path geometry (OpenType requires real outlines).
 * Invalid SVG data, cycles, and missing sources fail *before* mutating outputs.
 */
import {bezierPath} from './bezier.js?v=0.3.42.2';
import {booleanPaths} from './vector-boolean.js?v=0.3.44.0';
import {resolveLayerEffects} from './layer-effects.js?v=0.3.48.0';
const COMMANDS=new Set('MmLlHhVvCcQqZz');
const TOKENS=/[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?/g;
const fmt=n=>{if(!Number.isFinite(n)||Math.abs(n)>1e8)throw Error('Invalid linked-component coordinate');return String(Number(n.toFixed(5)));};
export function normalizeComponent(component){
 if(!component||typeof component!=='object')throw Error('Missing linked component');
 const id=String(component.sourceGlyphId??'');
 if(!/^(0|[1-9]\d*)$/.test(id)||Number(id)>100000)throw Error('Invalid linked-component source glyph');
 const dx=Number(component.dx??0),dy=Number(component.dy??0),scale=Number(component.scale??1),rotation=Number(component.rotation??0);
 if(![dx,dy,scale,rotation].every(Number.isFinite)||Math.abs(dx)>4000||Math.abs(dy)>4000||scale<0.05||scale>8||Math.abs(rotation)>3600)throw Error('Invalid component transform');
 return {sourceGlyphId:id,dx,dy,scale,rotation};
}
/** Transform M/L/H/V/Q/C/Z path data, relative or absolute, without flattening curves. */
export function transformSvgPath(source,component){
 const d=String(source??'').trim();if(!d)return '';
 const spec=normalizeComponent(component);
 const input=d.match(TOKENS)||[];
 if(input.join('').toLowerCase()!==d.replace(/[\s,]/g,'').toLowerCase())throw Error('Invalid SVG component outline syntax');
 const angle=spec.rotation*Math.PI/180,co=Math.cos(angle)*spec.scale,si=Math.sin(angle)*spec.scale;
 const map=(x,y)=>[fmt(200+spec.dx+co*(x-200)-si*(y-215)),fmt(215+spec.dy+si*(x-200)+co*(y-215))];
 let i=0,cmd=null,x=0,y=0,sx=0,sy=0,opened=false,guard=0;const out=[];
 const isNum=()=>i<input.length&&!/^[a-z]$/i.test(input[i]);
 const num=()=>{if(!isNum())throw Error('Incomplete linked-component SVG path');const v=Number(input[i++]);if(!Number.isFinite(v))throw Error('Non-finite path coordinate');return v;};
 const next=rel=>{const a=num(),b=num();return [rel?x+a:a,rel?y+b:b];};
 const emit=(symbol,points)=>out.push(symbol,...points.flatMap(p=>map(...p)));
 while(i<input.length){
  if(++guard>200000)throw Error('Linked component path too large');
  if(/^[a-z]$/i.test(input[i])){cmd=input[i++];if(!COMMANDS.has(cmd))throw Error('Unsupported SVG path command: '+cmd);}
  else if(!cmd)throw Error('SVG path must start with Move');
  const rel=cmd===cmd.toLowerCase(),op=cmd.toUpperCase();
  if(op==='Z'){if(!opened)throw Error('Unexpected close path');out.push('Z');x=sx;y=sy;opened=false;cmd=null;continue;}
  if(op==='M'){[x,y]=next(rel);[sx,sy]=[x,y];opened=true;emit('M',[[x,y]]);cmd=rel?'l':'L';continue;}
  if(!opened)throw Error('SVG subpath missing Move');
  if(op==='L'){[x,y]=next(rel);emit('L',[[x,y]]);continue;}
  if(op==='H'){const v=num();x=rel?x+v:v;emit('L',[[x,y]]);continue;}
  if(op==='V'){const v=num();y=rel?y+v:v;emit('L',[[x,y]]);continue;}
  if(op==='Q'||op==='C'){
   const points=[];for(let j=0;j<(op==='Q'?2:3);j++){const [a,b]=next(rel);points.push([a,b]);}
   [x,y]=points.at(-1);emit(op,points);continue;
  }
 }
 return out.join(' ');
}
/** Compute every glyph from original, intact layer data. No stale serialized path
 * is trusted for glyphs with layers; links are followed recursively. */
export function resolveLinkedGlyphPaths(project,{commit=false}={}){
 const glyphs=project?.glyphs||{},cache=new Map(),visiting=new Set();
 const resolve=id=>{
  id=String(id);if(cache.has(id))return cache.get(id);
  if(visiting.has(id))throw Error('Linked-component dependency cycle: '+[...visiting,id].join(' → '));
  if(visiting.size>50)throw Error('Linked-component nesting exceeds safe depth');
  const g=glyphs[id];if(!g)throw Error('Linked component source glyph missing: '+id);
  visiting.add(id);
  try{
   let path='';
   if(!g.layerStack||!Array.isArray(g.layerStack.layers)){path=String(g.path||'');}
   else {
    const stack=g.layerStack;
    const paths=resolveLayerEffects(g,{componentPath:component=>{
      const spec=normalizeComponent(component);
      const source=resolve(spec.sourceGlyphId);
      return source?transformSvgPath(source,spec):'';
    }});
    for(const layer of stack.layers.slice().reverse()){
     if(!layer.enabled||layer.mode==='guide')continue;
     const p=paths[layer.id]||'';
     if(!p){if(layer.mode==='intersect')path='';continue;}
     if(layer.mode==='add'||!layer.mode){path=[path,p].filter(Boolean).join(' ');continue;}
     if(!path)continue;
     if(layer.mode==='subtract'||layer.mode==='intersect')path=booleanPaths(path,p,layer.mode,{tolerance:.3}).path;
     else throw Error('Unknown layer composition mode');
    }
   }
   if(path.length>2_000_000)throw Error('Linked-component geometry exceeds 2 MB for glyph '+id);
   cache.set(id,path);return path;
  }finally{visiting.delete(id);}
 };
 // Optional geometry hooks are injected below. They remain the exact existing
 // bezierPath and booleanPaths implementations; the link graph does not fork them.
 for(const id of Object.keys(glyphs))resolve(id);
 if(commit)for(const [id,path] of cache){if(glyphs[id]?.layerStack)glyphs[id].path=path;}
 return Object.fromEntries(cache);
}
/** Reject cycles and missing references by validating a draft project *before*
 * the layer is added. Original drawing remains untouched on failure. */
export function createLinkedComponentLayer(project,targetId,sourceId,transform={}){
 targetId=String(targetId);sourceId=String(sourceId);
 const target=project?.glyphs?.[targetId],source=project?.glyphs?.[sourceId];
 if(!target||!source)throw Error('Both linked glyphs must exist');
 const component=normalizeComponent({sourceGlyphId:sourceId,...transform});
 if(sourceId===targetId)throw Error('A glyph cannot link to itself');
 const old=target.layerStack;
 if(!old||!Array.isArray(old.layers))throw Error('Initialize target glyph layers before linking');
 const id='link-'+(globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random().toString(36).slice(2)}`);
 const layer={id,name:'Linked glyph '+sourceId,visible:true,locked:true,enabled:true,mode:'add',art:{raster:'',rasterPath:'',bezierContours:[],contours:[],rasterCopyForEditing:false},component};
 // Source dependency graph preflight. This occurs before any target mutation.
 const draft={glyphs:{...project.glyphs,[targetId]:{...target,layerStack:{...old,layers:[layer,...old.layers]}}}};
 resolveLinkedGlyphPaths(draft);
 old.layers.unshift(layer);
 return layer;
}
/** All references are expressed as slot IDs, never arbitrary external strings. */
export function hasLinkedComponents(project){
 return Object.values(project?.glyphs||{}).some(g=>g?.layerStack?.layers?.some(l=>!!l.component));
}
export function linkedDependents(project,sourceId){
 const result=new Set(),source=String(sourceId);let changed=true;
 while(changed){changed=false;for(const [id,g] of Object.entries(project?.glyphs||{})){
  if(id===source||result.has(id))continue;
  if(g?.layerStack?.layers?.some(l=>l.component&&(String(l.component.sourceGlyphId)===source||result.has(String(l.component.sourceGlyphId))))){result.add(id);changed=true;}
 }}return [...result];
}
