/** Phase 5 — compact, project-local glyph metrics and kerning model.
 * All values are native TrueType font units (1200 UPM for Fairfax).
 * The empty object is the legacy/default no-change fast path.
 */
export const MAX_KERN_PAIRS=1024;
export const MAX_KERN_CLASSES=32;
export const STRUCTURAL_CODEPOINTS=new Set([32,0x3000]);
// Canonical 279-slot catalogue positions; these are protected even during
// preflight of a saved project, where the catalogue is not yet loaded.
const CANONICAL_STRUCTURAL_SLOTS=new Set([120,121,122,123,124,137,180]);
export function isProtectedSpacingSlot(slot){
  const cp=Number(slot?.codepoint);
  return STRUCTURAL_CODEPOINTS.has(cp)||(cp>=0xF1990&&cp<=0xF199E);
}
export function typographyOf(project){
  const t=project?.settings?.typography||{};
  return {glyphs:t.glyphs||{},pairs:t.pairs||{},classes:t.classes||{},classPairs:t.classPairs||{}};
}
const integer=(n,min,max,description)=>{
  if(!Number.isInteger(n)||n<min||n>max)throw Error(`${description} must be an integer between ${min} and ${max}`);
  return n;
};
function index(value,slotCount){
  const s=String(value);
  if(!/^(0|[1-9][0-9]*)$/.test(s))throw Error(`Invalid glyph slot ${s}`);
  return integer(Number(s),0,slotCount-1,'Glyph slot');
}
function pairKey(key,count){
  const pieces=String(key).split(':');
  if(pieces.length!==2)throw Error(`Invalid kerning pair ${key}`);
  return pieces.map(p=>index(p,count));
}
function validateClassName(name){
  if(!/^[A-Za-z][A-Za-z0-9_-]{0,31}$/.test(name))throw Error(`Invalid kerning class name ${name}`);
  return name;
}
export function checkTypography(input,slotsOrCount=279){
  const count=Array.isArray(slotsOrCount)?slotsOrCount.length:slotsOrCount;
  const slots=Array.isArray(slotsOrCount)?slotsOrCount:null;
  const t=input||{};
  if(typeof t!=='object'||Array.isArray(t))throw Error('Typography must be an object');
  const g=t.glyphs||{},pairs=t.pairs||{},classes=t.classes||{},classPairs=t.classPairs||{};
  for(const value of [g,pairs,classes,classPairs])if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Typography records must be objects');
  if(Object.keys(g).length>count||Object.keys(pairs).length>MAX_KERN_PAIRS||Object.keys(classes).length>MAX_KERN_CLASSES||Object.keys(classPairs).length>MAX_KERN_PAIRS)throw Error('Typography limits exceeded');
  for(const [id,metric] of Object.entries(g)){
    const i=index(id,count);
    if((slots&&isProtectedSpacingSlot(slots[i]))||(count===279&&CANONICAL_STRUCTURAL_SLOTS.has(i)))throw Error(`Structural glyph ${slots?.[i]?.word||id} cannot be respaced`);
    if(!metric||typeof metric!=='object'||Array.isArray(metric))throw Error('Malformed glyph metrics');
    if(metric.advance!=null)integer(metric.advance,0,65535,'Advance width');
    if(metric.leftBearing!=null)integer(metric.leftBearing,-32768,32767,'Left side bearing');
  }
  for(const [key,v] of Object.entries(pairs)){pairKey(key,count);integer(v,-32768,32767,'Kerning adjustment');}
  const ownership=new Map();
  for(const [name,members] of Object.entries(classes)){
    validateClassName(name);
    if(!Array.isArray(members)||!members.length||members.length>count)throw Error(`Class ${name} needs glyph members`);
    for(const member of members){const i=index(member,count);
      if(ownership.has(i))throw Error(`Glyph ${i} is already in kerning class ${ownership.get(i)}`);
      ownership.set(i,name);
    }
    if(new Set(members.map(String)).size!==members.length)throw Error(`Duplicate member in class ${name}`);
  }
  for(const [key,v] of Object.entries(classPairs)){
    const names=key.split(':');if(names.length!==2||names.some(name=>!Object.hasOwn(classes,name)))throw Error(`Invalid class pair ${key}`);
    integer(v,-32768,32767,'Class kerning adjustment');
  }
  // Cap the EXPANDED set too, not only the number of authored rules.
  return resolveKerningPairs(t,count);
}
export function resolveKerningPairs(typography,slotCount=279){
  const t=typography||{};
  const result=new Map();
  for(const [key,value] of Object.entries(t.classPairs||{})){
    const [left,right]=key.split(':');
    for(const a of t.classes?.[left]||[])for(const b of t.classes?.[right]||[]){
      result.set(`${a}:${b}`,value);
      if(result.size>MAX_KERN_PAIRS)throw Error('Expanded kerning exceeds 1024 pairs');
    }
  }
  // Explicit pair adjustment has precedence over its class default.
  for(const [key,value] of Object.entries(t.pairs||{}))result.set(key,value);
  if(result.size>MAX_KERN_PAIRS)throw Error('Expanded kerning exceeds 1024 pairs');
  return [...result].map(([key,value])=>{const [a,b]=pairKey(key,slotCount);return {left:a,right:b,adjust:value};})
    .sort((a,b)=>a.left-b.left||a.right-b.right);
}
export function withTypography(project,fn){
  const previous=structuredClone(typographyOf(project));
  const proposed=structuredClone(previous);
  fn(proposed);
  checkTypography(proposed,279);
  project.settings||={};project.settings.typography=proposed;
  return {before:previous,after:structuredClone(proposed)};
}
export function setGlyphMetrics(typography,slot,advance,leftBearing){
  const key=String(slot);
  if(advance==null&&leftBearing==null)delete typography.glyphs[key];
  else typography.glyphs[key]={...(advance==null?{}:{advance}),...(leftBearing==null?{}:{leftBearing})};
}
export function setKerningPair(typography,left,right,value){
  const key=`${left}:${right}`;
  if(value==null||value===0)delete typography.pairs[key];else typography.pairs[key]=value;
}
