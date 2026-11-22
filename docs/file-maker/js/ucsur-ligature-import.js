/* Imported fonts may encode sitelen pona as ASCII ligatures with their own
 * Private Use Area glyph IDs (e.g. Linja Sike), without standard UCSUR cmap
 * entries. At import, resolve direct OpenType ligatures to glyph IDs and add
 * missing UCSUR aliases to a NEW normalized TTF cmap. Never alter the source
 * font, glyph order, outlines, GSUB, advances, or existing Unicode mappings.
 * Offline only: does not require fontTools, HarfBuzz, servers or raster traces.
 */
const u16=(b,p)=>((b[p]<<8)|b[p+1])>>>0;
const u32=(b,p)=>((b[p]*0x1000000)+(b[p+1]<<16)+(b[p+2]<<8)+b[p+3])>>>0;
const push16=(a,v)=>a.push((v>>>8)&255,v&255);
const push32=(a,v)=>a.push((v>>>24)&255,(v>>>16)&255,(v>>>8)&255,v&255);
const set16=(a,p,v)=>{a[p]=(v>>>8)&255;a[p+1]=v&255;};
const set32=(a,p,v)=>{a[p]=(v>>>24)&255;a[p+1]=(v>>>16)&255;a[p+2]=(v>>>8)&255;a[p+3]=v&255;};
const valid=(b,p,n)=>Number.isSafeInteger(p)&&Number.isSafeInteger(n)&&p>=0&&n>=0&&p+n<=b.length;
function read16(b,p){if(!valid(b,p,2))throw Error('Truncated OpenType table');return u16(b,p);}
function read32(b,p){if(!valid(b,p,4))throw Error('Truncated OpenType table');return u32(b,p);}
function directory(font){
  if(read32(font,0)!==0x00010000)throw Error('Expected normalized TrueType source');
  const n=read16(font,4);if(!valid(font,12,n*16))throw Error('Invalid table directory');
  const out=new Map();for(let i=0;i<n;i++){
    const p=12+16*i,tag=String.fromCharCode(...font.subarray(p,p+4)),at=read32(font,p+8),size=read32(font,p+12);
    if(!valid(font,at,size))throw Error(`Invalid ${tag} bounds`);
    out.set(tag,font.subarray(at,at+size));
  }
  return out;
}
function cmapRecords(cmap){
  const n=read16(cmap,2);if(!valid(cmap,4,n*8))throw Error('Invalid cmap directory');
  return Array.from({length:n},(_,i)=>{
    const p=4+i*8,offset=read32(cmap,p+4);
    return {platform:read16(cmap,p),encoding:read16(cmap,p+2),offset,format:read16(cmap,offset)};
  });
}
function readCmap(cmap){
  const tables=cmapRecords(cmap);
  // Prefer Windows UCS-4, then Unicode UCS-4, then Windows BMP.
  const preference=r=>r.platform===3&&r.encoding===10?0:r.platform===0&&r.format===12?1:r.platform===3&&r.encoding===1?2:3;
  const glyphMap=new Map();
  for(const r of [...tables].sort((a,b)=>preference(a)-preference(b))){
    if(r.format===12){
      const length=read32(cmap,r.offset+4),groups=read32(cmap,r.offset+12);
      if(!valid(cmap,r.offset,length)||!valid(cmap,r.offset+16,groups*12))throw Error('Invalid cmap format 12');
      // Higher priority records win even if a lower priority record overlaps.
      for(let i=0;i<groups;i++){
        const p=r.offset+16+i*12,from=read32(cmap,p),to=read32(cmap,p+4),gid=read32(cmap,p+8);
        if(to<from||to>0x10ffff||to-from>200000)throw Error('Invalid UCS-4 cmap range');
        for(let cp=from;cp<=to;cp++)if(!glyphMap.has(cp)&&gid+cp-from>0)glyphMap.set(cp,gid+cp-from);
      }
    }else if(r.format===4){
      const len=read16(cmap,r.offset+2),segs=read16(cmap,r.offset+6)/2;
      if(!valid(cmap,r.offset,len)||!valid(cmap,r.offset+14,segs*8+2))throw Error('Invalid cmap format 4');
      const ends=r.offset+14,starts=ends+segs*2+2,deltas=starts+segs*2,ids=deltas+segs*2;
      for(let i=0;i<segs;i++){
        const from=read16(cmap,starts+2*i),to=read16(cmap,ends+2*i),delta=read16(cmap,deltas+2*i),ro=read16(cmap,ids+2*i);
        if(to<from)throw Error('Invalid format 4 range');
        for(let cp=from;cp<=to;cp++){
          if(cp===0xffff||glyphMap.has(cp))continue;
          let gid=0;
          if(ro===0)gid=(cp+delta)&0xffff;
          else{
            const at=ids+2*i+ro+(cp-from)*2;
            if(at+2>r.offset+len)throw Error('Invalid format 4 glyph offset');
            const word=read16(cmap,at);
            if(word)gid=(word+delta)&0xffff;
          }
          if(gid)glyphMap.set(cp,gid);
        }
      }
    }else if(r.format===0){
      if(!valid(cmap,r.offset,262))throw Error('Invalid cmap format 0');
      for(let cp=0;cp<256;cp++)if(!glyphMap.has(cp)&&cmap[r.offset+6+cp])glyphMap.set(cp,cmap[r.offset+6+cp]);
    }else if(r.format===6){
      const first=read16(cmap,r.offset+6),n=read16(cmap,r.offset+8);
      if(!valid(cmap,r.offset+10,n*2))throw Error('Invalid cmap format 6');
      for(let i=0;i<n;i++)if(!glyphMap.has(first+i)&&read16(cmap,r.offset+10+i*2))glyphMap.set(first+i,read16(cmap,r.offset+10+i*2));
    }
  }
  return {glyphMap,tables};
}
function coverage(gsub,at){
  const fmt=read16(gsub,at),n=read16(gsub,at+2),ids=[];
  if(fmt===1){if(!valid(gsub,at+4,n*2))throw Error('Invalid GSUB coverage');for(let i=0;i<n;i++)ids.push(read16(gsub,at+4+i*2));}
  else if(fmt===2){
    if(!valid(gsub,at+4,n*6))throw Error('Invalid GSUB coverage ranges');
    for(let i=0;i<n;i++){
      const p=at+4+i*6,first=read16(gsub,p),last=read16(gsub,p+2),start=read16(gsub,p+4);
      if(last<first||last-first>65535)throw Error('Invalid GSUB coverage range');
      for(let gid=first;gid<=last;gid++)ids[start+gid-first]=gid;
    }
  }else throw Error('Unsupported GSUB coverage format');
  return ids;
}
function ligatureRules(gsub,subtable,rules){
  if(read16(gsub,subtable)!==1)return;
  const cov=coverage(gsub,subtable+read16(gsub,subtable+2));
  const n=read16(gsub,subtable+4);
  if(n!==cov.length||!valid(gsub,subtable+6,n*2))throw Error('Invalid ligature coverage');
  for(let i=0;i<n;i++){
    const set=subtable+read16(gsub,subtable+6+i*2),count=read16(gsub,set);
    if(!valid(gsub,set+2,count*2))throw Error('Invalid ligature set');
    for(let j=0;j<count;j++){
      const lig=set+read16(gsub,set+2+j*2),result=read16(gsub,lig),parts=read16(gsub,lig+2);
      if(parts<2||parts>100||!valid(gsub,lig+4,(parts-1)*2))throw Error('Invalid ligature components');
      const sequence=[cov[i]];for(let k=0;k<parts-1;k++)sequence.push(read16(gsub,lig+4+2*k));
      rules.set(sequence.join(','),result);
    }
  }
}
function singleRules(gsub,sub,rules){
  const format=read16(gsub,sub),covered=coverage(gsub,sub+read16(gsub,sub+2));
  if(format===1){
    const delta=(read16(gsub,sub+4)<<16)>>16;
    for(const gid of covered)rules.set(String(gid),(gid+delta)&0xffff);
  }else if(format===2){
    const n=read16(gsub,sub+4);
    if(n!==covered.length||!valid(gsub,sub+6,n*2))throw Error('Invalid GSUB single-substitution inventory');
    for(let i=0;i<n;i++)rules.set(String(covered[i]),read16(gsub,sub+6+i*2));
  }
}
function readLigatures(gsub){
  const lookupList=read16(gsub,8),base=lookupList,count=read16(gsub,base),rules=new Map();
  if(!valid(gsub,base+2,count*2))throw Error('Invalid GSUB lookup list');
  for(let i=0;i<count;i++){
    const at=base+read16(gsub,base+2+2*i),kind=read16(gsub,at),n=read16(gsub,at+4);
    if(!valid(gsub,at+6,n*2))throw Error('Invalid GSUB lookup');
    if(![1,4,7].includes(kind))continue;
    for(let j=0;j<n;j++){
      const sub=at+read16(gsub,at+6+2*j);
      if(kind===4)ligatureRules(gsub,sub,rules);
      else if(kind===1)singleRules(gsub,sub,rules);
      else if(read16(gsub,sub)===1){
        const subType=read16(gsub,sub+2),target=sub+read32(gsub,sub+4);
        if(subType===4)ligatureRules(gsub,target,rules);
        else if(subType===1)singleRules(gsub,target,rules);
      }
    }
  }
  return rules;
}
function newCmap(old,orig,entries){
  // Retain ALL original cmap records and subtables byte-for-byte; only
  // redirect Windows UCS-4 and Unicode UCS-4 records to an appended merged
  // format-12 subtable. BMP Unicode records remain untouched.
  const {tables}=orig;
  const list=tables.map(r=>({...r}));
  if(!list.some(r=>r.platform===3&&r.encoding===10))list.push({platform:3,encoding:10,offset:-1});
  if(!list.some(r=>r.platform===0&&r.encoding===4))list.push({platform:0,encoding:4,offset:-1});
  const delta=(list.length-tables.length)*8;
  const result=[0,0];push16(result,list.length);
  const originalSubtables=old.subarray(4+tables.length*8);
  const merged=[...entries.entries()].sort((a,b)=>a[0]-b[0]);
  if(merged.length>100000)throw Error('Imported cmap too large to remap safely');
  const groups=[];
  for(const [cp,gid] of merged){
    if(cp>0x10ffff||gid<1||gid>65535)continue;
    const prev=groups[groups.length-1];
    if(prev&&cp===prev.end+1&&gid===prev.id+cp-prev.start)prev.end=cp;
    else groups.push({start:cp,end:cp,id:gid});
  }
  const newOffset=4+list.length*8+originalSubtables.length;
  for(const r of list){
    push16(result,r.platform);push16(result,r.encoding);
    const update=(r.platform===3&&r.encoding===10)||(r.platform===0&&r.encoding===4);
    push32(result,update?newOffset:r.offset+delta);
  }
  result.push(...originalSubtables);
  push16(result,12);push16(result,0);push32(result,16+groups.length*12);push32(result,0);push32(result,groups.length);
  for(const g of groups){push32(result,g.start);push32(result,g.end);push32(result,g.id);}
  return Uint8Array.from(result);
}
function checksum(b){let sum=0;for(let i=0;i<b.length;i+=4)sum=(sum+(((b[i]??0)*0x1000000)+((b[i+1]??0)<<16)+((b[i+2]??0)<<8)+(b[i+3]??0)))>>>0;return sum;}
function assemble(tables){
  const tags=[...tables.keys()].sort(),n=tags.length,search=Math.floor(Math.log2(n)),a=new Array(12+n*16).fill(0);
  set32(a,0,0x10000);set16(a,4,n);set16(a,6,(1<<search)*16);set16(a,8,search);set16(a,10,n*16-(1<<search)*16);
  for(let i=0;i<n;i++){
    const tag=tags[i],buf=tables.get(tag),p=12+i*16,offset=a.length;
    for(let j=0;j<4;j++)a[p+j]=tag.charCodeAt(j);
    set32(a,p+4,checksum(buf));set32(a,p+8,offset);set32(a,p+12,buf.length);
    for(const byte of buf)a.push(byte);
    while(a.length%4)a.push(0);
  }
  const head=tags.indexOf('head');if(head<0)throw Error('Missing TrueType head');
  const pos=u32(a,12+head*16+8);set32(a,pos+8,0);set32(a,pos+8,(0xb1b0afba-checksum(a))>>>0);
  return Uint8Array.from(a);
}
/** Apply missing UCSUR aliases for directly ligated Toki Pona words.
 * Explicit Unicode mappings in the imported font always win. The result is
 * a NEW TrueType source; the caller retains the original independently.
 * Returns the unchanged bytes if no aliases are required.
 */
export function mapImportedLigaturesToUcsur(normalizedBytes,slots){
  const bytes=normalizedBytes instanceof Uint8Array?normalizedBytes:new Uint8Array(normalizedBytes);
  const tables=directory(bytes),cmap=tables.get('cmap'),gsub=tables.get('GSUB');
  if(!cmap||!gsub)return {bytes,added:0,examples:[],unmapped:[]};
  const cmapParsed=readCmap(cmap),unicode=cmapParsed.glyphMap,rules=readLigatures(gsub);
  const maxGlyph=read16(tables.get('maxp'),4),newMappings=new Map(),examples=[],unmapped=[];
  for(const slot of slots){
    const cp=Number(slot.codepoint),word=String(slot.word??'');
    if(!Number.isInteger(cp)||cp<128||cp>0x10ffff||unicode.has(cp))continue;
    if(!/^[a-z]{1,32}$/.test(word))continue;
    const sequence=Array.from(word,ch=>unicode.get(ch.charCodeAt(0)));
    if(sequence.some(x=>!Number.isInteger(x)))continue;
    const gid=rules.get(sequence.join(','));
    if(!gid||gid>=maxGlyph){unmapped.push(word);continue;}
    newMappings.set(cp,gid);
    if(examples.length<20)examples.push({word,codepoint:cp,gid});
  }
  if(!newMappings.size)return {bytes,added:0,examples,unmapped};
  const merged=new Map(unicode);for(const [cp,gid] of newMappings)merged.set(cp,gid);
  tables.set('cmap',newCmap(cmap,cmapParsed,merged));
  return {bytes:assemble(tables),added:newMappings.size,examples,unmapped};
}
