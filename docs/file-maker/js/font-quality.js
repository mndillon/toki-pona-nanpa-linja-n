import {checkTypography} from './font-typography.js';
/** Phase 4: non-mutating font preflight and SFNT inspection.
 * Both functions are offline and safe to call without Rust/WASM. The TTF
 * checks never claim that a browser/HarfBuzz has successfully shaped a font.
 */
import {validateOutline} from './outline-validation.js';
import {fontGlyphsForCompilation} from './glyph-layers.js';
import {resolveLinkedGlyphPaths} from './linked-components.js';
import {flattenSvgContours} from './vector-boolean.js';

const ISSUE_LIMIT=240;
function report(issues,kind,severity,message,glyphId=null){
 if(issues.length<ISSUE_LIMIT)issues.push({kind,severity,message,glyphId});
}
const finish=issues=>({issues,errors:issues.filter(x=>x.severity==='error').length,
 warnings:issues.filter(x=>x.severity==='warning').length,
 notes:issues.filter(x=>x.severity==='info').length,
 valid:!issues.some(x=>x.severity==='error')});
/** Check saved project + resolved compiler snapshot, without changing either. */
export function inspectProjectQuality(project,{artboardWidth=400,artboardHeight=430}={}){
 const issues=[];
 if(!project||typeof project!=='object'||!project.glyphs||typeof project.glyphs!=='object'){
  report(issues,'project','error','Missing or invalid project glyph collection');return finish(issues);
 }
 try{checkTypography(project.settings?.typography||{},279);}catch(e){report(issues,'typography','error','Invalid spacing/kerning: '+String(e.message||e));}
 const glyphs=project.glyphs;
 // Dependency validation must precede any compiler snapshot. Missing sources,
 // invalid transforms and cycles are treated as export blockers, not warnings.
 try{resolveLinkedGlyphPaths(project);}catch(e){report(issues,'dependencies','error',String(e.message||e));}
 let compiled=null;
 try{compiled=fontGlyphsForCompilation(glyphs);}catch(e){report(issues,'compiler-snapshot','error','Cannot prepare compiler glyphs: '+String(e.message||e));}
 for(const [id,g] of Object.entries(glyphs)){
  if(!g||typeof g!=='object'){report(issues,'glyph','error','Malformed glyph entry',id);continue;}
  if(!g.modified)continue;
  const contours=Array.isArray(g.bezierContours)?g.bezierContours:[];
  if(g.bezierContours!=null&&!Array.isArray(g.bezierContours)){
   report(issues,'contours','error','Editable contours must be an array',id);continue;
  }
  if(contours.length>600){report(issues,'complexity','warning','Very large number of editable contours; inspect performance',id);}
  try{
   const check=validateOutline(contours,{artboardWidth,artboardHeight});
   for(const finding of check.issues){
    if(issues.length>=ISSUE_LIMIT)break;
    report(issues,finding.type,finding.type==='invalid'?'error':(finding.severity==='info'?'info':'warning'),finding.message,id);
   }
  }catch(e){report(issues,'contour-check','error','Cannot inspect glyph contours: '+String(e.message||e),id);}
  // Validate actual resolved outline where possible: malformed paths can arrive
  // from old projects or external JSON, not just current editing controls.
  const path=String(compiled?.[id]?.path||'');
  if(path.length>2_000_000){report(issues,'path-size','error','Export outline exceeds 2 MB',id);continue;}
  if(path){
   try{const polygons=flattenSvgContours(path,.6);
    if(!polygons.length)report(issues,'empty-path','warning','Export path has no filled outlines',id);
   }catch(e){report(issues,'path-syntax','error','Invalid export outline: '+String(e.message||e),id);}
  }
 }
 return {...finish(issues),inspectedGlyphs:Object.values(glyphs).filter(g=>g?.modified).length};
}

function bytesFor(font){
 if(font instanceof Uint8Array)return font;
 if(font instanceof ArrayBuffer)return new Uint8Array(font);
 if(ArrayBuffer.isView(font))return new Uint8Array(font.buffer,font.byteOffset,font.byteLength);
 throw new TypeError('Expected TrueType font bytes');
}
function checksum(bytes,start,length,blankHead=false){
 let sum=0;
 for(let p=0;p<length;p+=4){
  let word=0;
  for(let j=0;j<4;j++){
   const offset=p+j;
   const b=offset<length&&!(blankHead&&offset>=8&&offset<12)?bytes[start+offset]:0;
   word=(word<<8)|b;
  }
  sum=(sum+(word>>>0))>>>0;
 }
 return sum>>>0;
}
/** Standalone SFNT directory, checksum, loca and horizontal-metrics checks.
 * Does not mutate the font or register it in the browser. */
export function inspectTrueType(font,{label='font'}={}){
 const issues=[];let bytes;
 try{bytes=bytesFor(font);}catch(e){report(issues,'font','error',String(e.message));return {...finish(issues),label};}
 const fail=(type,message)=>report(issues,type,'error',message);
 const warn=(type,message)=>report(issues,type,'warning',message);
 const u16=off=>new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength).getUint16(off);
 const i16=off=>new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength).getInt16(off);
 const u32=off=>new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength).getUint32(off);
 if(bytes.length<12){fail('sfnt','Truncated SFNT header');return {...finish(issues),label};}
 if(u32(0)!==0x00010000){fail('sfnt','Not a TrueType-flavoured SFNT (00010000 expected)');return {...finish(issues),label};}
 const count=u16(4);if(count<5||count>128||12+count*16>bytes.length){fail('directory','Invalid or truncated table directory');return {...finish(issues),label};}
 const tables=new Map(),intervals=[];
 for(let index=0;index<count;index++){
  const p=12+index*16,tag=String.fromCharCode(...bytes.subarray(p,p+4));
  const expected=u32(p+4),start=u32(p+8),size=u32(p+12);
  if(tables.has(tag))fail('directory',`Duplicate table ${tag}`);
  if(start<12+count*16||start>bytes.length||size>bytes.length-start){fail('directory',`Table ${tag} extends outside font`);continue;}
  if(start%4!==0)warn('alignment',`Table ${tag} is not four-byte aligned`);
  if(size>0)intervals.push({tag,start,end:start+size});
  tables.set(tag,{start,size,expected});
  if(checksum(bytes,start,size,tag==='head')!==expected)fail('checksum',`Table ${tag} checksum mismatch`);
 }
 intervals.sort((a,b)=>a.start-b.start);
 for(let i=1;i<intervals.length;i++)if(intervals[i].start<intervals[i-1].end)
  fail('directory',`Overlapping tables ${intervals[i-1].tag} and ${intervals[i].tag}`);
 for(const tag of ['head','hhea','maxp','hmtx','cmap','loca','glyf','name','post','GSUB'])
  if(!tables.has(tag))fail('required-table',`Missing required TrueType table ${tag}`);
 const table=(tag,minimum=0)=>{const t=tables.get(tag);if(!t||t.size<minimum)return null;return t;};
 const cmap=table('cmap',4),gsub=table('GSUB',10),nameTable=table('name',6);
 if(!cmap)fail('cmap','Missing or truncated cmap table');
 else{
  if(u16(cmap.start)!==0)fail('cmap','Invalid cmap table version');
  const subtableCount=u16(cmap.start+2);
  if(cmap.size<4+8*subtableCount||subtableCount===0)fail('cmap','Malformed cmap encoding records');
 }
 if(!gsub)fail('GSUB','Missing or truncated GSUB table');
 else{
  const version=u32(gsub.start);
  if(version!==0x00010000&&version!==0x00010001)fail('GSUB','Unsupported GSUB version');
  for(const [offset,label] of [[4,'script'],[6,'feature'],[8,'lookup']]){
   const value=u16(gsub.start+offset);
   if(value<10||value>=gsub.size)fail('GSUB',`Invalid GSUB ${label} list offset`);
  }
 }
 if(!nameTable)fail('name','Missing or truncated name table');
 else if(nameTable.size<6+u16(nameTable.start+2)*12)fail('name','Name records exceed table bounds');
 const head=table('head',54),maxp=table('maxp',6),hhea=table('hhea',36);
 if(!head)fail('head','Missing or truncated head table');
 if(!maxp)fail('maxp','Missing or truncated maxp table');
 if(!hhea)fail('hhea','Missing or truncated hhea table');
 let numGlyphs=null,unitsPerEm=null;
 if(head){
  unitsPerEm=u16(head.start+18);
  if(u32(head.start+12)!==0x5F0F3CF5)fail('head','Invalid head magic number');
  if(unitsPerEm<16||unitsPerEm>16384)fail('head',`Invalid unitsPerEm ${unitsPerEm}`);
  const format=i16(head.start+50);
  if(format!==0&&format!==1)fail('loca','Unsupported indexToLocFormat');
  else if(maxp){
   numGlyphs=u16(maxp.start+4);const loca=table('loca'),glyf=table('glyf');
   const size=format===0?2:4;
   if(!loca||loca.size<(numGlyphs+1)*size)fail('loca','loca is too short for maxp.numGlyphs');
   else if(glyf){
    let prev=0;
    for(let i=0;i<=numGlyphs;i++){
     const off=format===0?u16(loca.start+i*2)*2:u32(loca.start+i*4);
     if(off<prev||off>glyf.size){fail('loca',`Glyph offset ${i} is not monotonic or exceeds glyf`);break;}
     prev=off;
    }
   }
  }
 }
 if(maxp&&!numGlyphs)numGlyphs=u16(maxp.start+4);
 if(maxp&&numGlyphs===0)fail('maxp','Font declares zero glyphs');
 if(hhea&&maxp){
  const n=u16(hhea.start+34),m=table('hmtx');
  if(n<1||n>numGlyphs)fail('hhea','Invalid numberOfHMetrics');
  else if(!m||m.size<4*n+2*(numGlyphs-n))fail('hmtx','Horizontal metrics table is too short');
 }
 // A full SFNT checksum is defined with head.checkSumAdjustment as written.
 // Table checksums exclude this field; the entire font must total B1B0AFBA.
 if(head&&checksum(bytes,0,bytes.length)!==0xB1B0AFBA)
  fail('font-checksum','Whole-font checksum adjustment is incorrect');
 return {...finish(issues),label,numGlyphs,unitsPerEm,tableCount:count,tableTags:[...tables.keys()].sort()};
}
export function inspectCompiledPair(normal,literal){
 const first=inspectTrueType(normal,{label:'Ligatures'}),second=inspectTrueType(literal,{label:'Literal'});
 return {valid:first.valid&&second.valid,errors:first.errors+second.errors,warnings:first.warnings+second.warnings,
  issues:[...first.issues.map(x=>({...x,font:'Ligatures'})),...second.issues.map(x=>({...x,font:'Literal'}))],fonts:[first,second]};
}
