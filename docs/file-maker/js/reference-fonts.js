import {fontHasCodepoint, registerFont} from './font-import.js';

// The reference guide is an editor-only layer: these faces are never copied
// into project.sourceFont, the editable canvas, or the exported glyph outlines.
// Their files are the same Fairfax templates embedded in the Rust exporter.
export const FAIRFAX_REFERENCE_FILES = Object.freeze({
  sitelen: 'FairfaxPonaHD.ttf',
  literal: 'TP-Literal-Quoted-Escaped.ttf'
});

const referenceCache = new Map();

export function referenceFontKindForSlot(slot) {
  const cp = slot?.codepoint;
  if (!Number.isInteger(cp) || cp <= 0 || cp > 0x10FFFF || (cp >= 0xD800 && cp <= 0xDFFF)) return null;
  // The UCSUR Sitelen Pona block gets the Pona guide. Every other Unicode
  // character, including ordinary text, punctuation and non-Sitelen-Pona
  // private-use characters, gets the Fairfax-derived Literal guide.
  return cp >= 0xF1900 && cp <= 0xF19FF ? 'sitelen' : 'literal';
}


// Return this glyph's TrueType bounds in the editor's 2048-unit coordinates.
// Read the cmap and glyf header only; no outline data is changed or persisted.
// A composite glyph's glyf header already carries its complete ink bounds.
export function referenceGlyphBounds(bytes, codepoint) {
  try {
    const cp=Number(codepoint);
    if(!Number.isInteger(cp)||cp<0||cp>0x10FFFF)return null;
    const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
    const ok=(at,n)=>Number.isSafeInteger(at)&&at>=0&&n>=0&&at+n<=v.byteLength;
    const u16=at=>v.getUint16(at),u32=at=>v.getUint32(at);
    if(!ok(0,12))return null;
    const tables=new Map(),count=u16(4);
    if(!ok(12,count*16))return null;
    for(let i=0;i<count;i++){
      const at=12+i*16,tag=String.fromCharCode(...new Uint8Array(v.buffer,v.byteOffset+at,4));
      const offset=u32(at+8),length=u32(at+12);
      if(!ok(offset,length))return null;
      tables.set(tag,{offset,length});
    }
    for(const tag of ['cmap','head','maxp','loca','glyf'])if(!tables.has(tag))return null;
    const cmap=tables.get('cmap').offset;
    if(!ok(cmap,4))return null;
    const subtables=[];
    const records=u16(cmap+2);
    if(!ok(cmap+4,records*8))return null;
    for(let i=0;i<records;i++){
      const at=cmap+4+i*8,platform=u16(at),encoding=u16(at+2),pos=cmap+u32(at+4);
      if(!ok(pos,2))continue;
      const format=u16(pos);
      if(format!==4&&format!==12)continue;
      subtables.push({pos,format,rank:platform===3&&encoding===10?0:platform===0&&format===12?1:platform===3&&encoding===1?2:3});
    }
    subtables.sort((a,b)=>a.rank-b.rank);
    let gid=0;
    for(const {pos,format} of subtables){
      if(format===12){
        if(!ok(pos,16))continue;
        const groups=u32(pos+12);
        if(!ok(pos+16,groups*12))continue;
        let lo=0,hi=groups-1;
        while(lo<=hi){const mid=(lo+hi)>>>1,at=pos+16+mid*12,start=u32(at),end=u32(at+4);
          if(cp<start)hi=mid-1;else if(cp>end)lo=mid+1;else{gid=u32(at+8)+cp-start;break;}}
      }else if(cp<=0xFFFF&&ok(pos,16)){
        const n=u16(pos+6)/2,ends=pos+14,starts=ends+n*2+2,deltas=starts+n*2,ranges=deltas+n*2;
        if(!ok(ranges,n*2))continue;
        for(let i=0;i<n;i++){
          const start=u16(starts+2*i),end=u16(ends+2*i);
          if(cp<start||cp>end)continue;
          const delta=v.getInt16(deltas+2*i),range=u16(ranges+2*i);
          if(!range)gid=(cp+delta)&0xFFFF;
          else{const at=ranges+2*i+range+2*(cp-start);
            if(ok(at,2)){const raw=u16(at);gid=raw?(raw+delta)&0xFFFF:0;}}
          break;
        }
      }
      if(gid)break;
    }
    if(!gid||gid>=u16(tables.get('maxp').offset+4))return null;
    const head=tables.get('head').offset,units=u16(head+18);
    if(units<16||units>16384)return null;
    const short=v.getInt16(head+50)===0;
    const loca=tables.get('loca').offset,entrySize=short?2:4;
    if(!ok(loca+gid*entrySize,2*entrySize))return null;
    const first=short?u16(loca+gid*2)*2:u32(loca+gid*4);
    const last=short?u16(loca+(gid+1)*2)*2:u32(loca+(gid+1)*4);
    const glyf=tables.get('glyf').offset;
    if(last<=first||!ok(glyf+first,10))return null;
    const at=glyf+first,scale=2048/units;
    const bounds=[v.getInt16(at+2),v.getInt16(at+4),v.getInt16(at+6),v.getInt16(at+8)].map(n=>n*scale);
    return bounds[0]<=bounds[2]&&bounds[1]<=bounds[3]?bounds:null;
  }catch(_){return null;}
}

export async function loadFairfaxReferenceFont(slot) {
  const kind = referenceFontKindForSlot(slot);
  if (!kind) return null;
  if (!referenceCache.has(kind)) {
    const request = (async () => {
      const url = new URL(`../assets/fairfax-templates/${FAIRFAX_REFERENCE_FILES[kind]}`, import.meta.url);
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Cannot load Fairfax reference ${url.pathname} (HTTP ${response.status})`);
      const bytes = new Uint8Array(await response.arrayBuffer());
      const family = await registerFont(bytes, `fairfax_reference_${kind}`);
      return {bytes, family};
    })().catch(error => { referenceCache.delete(kind); throw error; });
    referenceCache.set(kind, request);
  }
  const reference = await referenceCache.get(kind);
  return fontHasCodepoint(reference.bytes, slot.codepoint) ? reference : null;
}
