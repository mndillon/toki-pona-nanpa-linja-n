/* Offline, dependency-free CFF 1 -> TrueType source normalizer.
 * Input source bytes are never modified. This module is invoked ONCE during
 * import; the resulting glyf/loca SFNT is stored with the original project.
 * CFF2/variable and unsupported Type 2 operators fail explicitly: never
 * silently turn a vector glyph into a blank glyph or raster-trace it.
 * Cubics are subdivided to quadratic curves within 0.5 source font units.
 */
const textDecoder=new TextDecoder('ascii');
const be16=(b,p)=>((b[p]<<8)|b[p+1])>>>0;
const signed16=(b,p)=>(be16(b,p)<<16)>>16;
const be32=(b,p)=>((b[p]*0x1000000)+(b[p+1]<<16)+(b[p+2]<<8)+b[p+3])>>>0;
const put16=(b,v)=>{b.push((v>>>8)&255,v&255);};
const put32=(b,v)=>{b.push((v>>>24)&255,(v>>>16)&255,(v>>>8)&255,v&255);};
const patch16=(b,p,v)=>{b[p]=(v>>>8)&255;b[p+1]=v&255;};
const patch32=(b,p,v)=>{b[p]=(v>>>24)&255;b[p+1]=(v>>>16)&255;b[p+2]=(v>>>8)&255;b[p+3]=v&255;};
function requireRange(b,p,n,why){if(!Number.isSafeInteger(p)||p<0||!Number.isSafeInteger(n)||n<0||p+n>b.length)throw Error(`Invalid ${why} offset or length`);}
function assert16(v,what){if(!Number.isFinite(v)||v<-32768||v>32767)throw Error(`${what} exceeds TrueType coordinate range`);return Math.round(v);}
function tableDirectory(bytes){
  const b=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes);
  requireRange(b,0,12,'SFNT header');
  const signature=be32(b,0);
  if(signature===0x74746366)throw Error('Font collections (TTC/OTC) are not supported. Export a single font face first.');
  if(![0x00010000,0x4F54544F,0x74727565].includes(signature))throw Error('Unsupported font: expected TTF or OpenType/CFF');
  const n=be16(b,4);if(n===0||n>200)throw Error('Invalid SFNT table count');
  requireRange(b,12,n*16,'SFNT directory');
  const tables=new Map();
  for(let i=0;i<n;i++){
    const at=12+16*i,tag=String.fromCharCode(...b.subarray(at,at+4));
    const offset=be32(b,at+8),length=be32(b,at+12);
    requireRange(b,offset,length,tag);
    if(tables.has(tag))throw Error(`Duplicate SFNT ${tag}`);
    tables.set(tag,b.slice(offset,offset+length));
  }
  return {b,signature,tables};
}
export function inspectOutlineFormat(bytes){
  const {tables}=tableDirectory(bytes);
  if(tables.has('fvar')||tables.has('gvar')||tables.has('CFF2')||tables.has('HVAR')||tables.has('MVAR'))throw Error('Variable/CFF2 font import is not supported; export a static font instance first.');
  if(tables.has('COLR')||tables.has('SVG '))throw Error('Colour/SVG outline fonts are not supported by the TrueType export compiler.');
  if(tables.has('glyf')&&tables.has('loca')&&!tables.has('CFF '))return 'truetype';
  if(tables.has('CFF ')&&!tables.has('glyf')&&!tables.has('loca'))return 'cff1';
  throw Error('Font has neither TrueType outlines nor supported CFF 1 outlines');
}
function cffIndex(b,at){
  requireRange(b,at,2,'CFF INDEX');const count=be16(b,at);at+=2;
  if(count===0)return {items:[],end:at};
  requireRange(b,at,1,'CFF INDEX offSize');const width=b[at++];
  if(width<1||width>4)throw Error('Invalid CFF INDEX offSize');
  const readOffset=p=>{let v=0;for(let k=0;k<width;k++)v=v*256+b[p+k];return v;};
  requireRange(b,at,(count+1)*width,'CFF INDEX offsets');
  const offsets=[];for(let i=0;i<=count;i++)offsets.push(readOffset(at+i*width));
  at+=(count+1)*width;
  if(offsets[0]!==1)throw Error('Invalid CFF INDEX initial offset');
  const end=at+offsets[count]-1;requireRange(b,at,offsets[count]-1,'CFF INDEX data');
  const items=[];
  for(let i=0;i<count;i++){
    if(offsets[i+1]<offsets[i])throw Error('CFF INDEX offsets out of order');
    items.push(b.subarray(at+offsets[i]-1,at+offsets[i+1]-1));
  }
  return {items,end};
}
function decodeNumber(b,at,allowReal=false){
  requireRange(b,at,1,'CFF number');const c=b[at++];
  if(c>=32&&c<=246)return {value:c-139,at};
  if(c>=247&&c<=250){requireRange(b,at,1,'CFF number');return {value:(c-247)*256+b[at++]+108,at};}
  if(c>=251&&c<=254){requireRange(b,at,1,'CFF number');return {value:-(c-251)*256-b[at++]-108,at};}
  if(c===28){requireRange(b,at,2,'CFF short integer');return {value:signed16(b,at),at:at+2};}
  if(c===29&&allowReal){requireRange(b,at,4,'CFF long integer');return {value:be32(b,at)|0,at:at+4};}
  if(c===255){requireRange(b,at,4,'CFF fixed number');return {value:(be32(b,at)|0)/65536,at:at+4};}
  if(c===30&&allowReal){
    let str='';let done=false;
    for(let i=0;i<25&&!done;i++){
      requireRange(b,at,1,'CFF real number');const byte=b[at++];
      for(const n of [byte>>4,byte&15]){
        if(n===15){done=true;break;}
        str+=({10:'.',11:'E',12:'E-',14:'-'})[n]??(n<=9?String(n):'');
      }
    }
    if(!done)throw Error('Unterminated CFF real number');
    return {value:Number(str),at};
  }
  throw Error(`Unsupported CFF number opcode ${c}`);
}
function cffDict(b){
  let at=0,stack=[];const dict=new Map();
  while(at<b.length){
    const c=b[at];
    if(c<=21&&c!==28&&c!==29&&c!==30){
      at++;let op=String(c);if(c===12){requireRange(b,at,1,'CFF DICT operator');op+=' '+b[at++];}
      dict.set(op,stack);stack=[];
    }else{const num=decodeNumber(b,at,true);stack.push(num.value);at=num.at;}
  }
  return dict;
}
function cffPrivate(b,dict){
  const spec=dict.get('18');if(!spec)return [];
  const [length,offset]=spec;
  requireRange(b,offset,length,'CFF private DICT');const priv=cffDict(b.subarray(offset,offset+length));
  const sub=priv.get('19');return sub?cffIndex(b,offset+sub[0]).items:[];
}
function cffFDSelect(b,offset,count){
  requireRange(b,offset,1,'CFF FDSelect');const format=b[offset++];const result=new Uint16Array(count);
  if(format===0){requireRange(b,offset,count,'CFF FDSelect format 0');for(let i=0;i<count;i++)result[i]=b[offset+i];return result;}
  if(format===3){
    requireRange(b,offset,2,'CFF FDSelect format 3');const n=be16(b,offset);offset+=2;
    if(n<1||n>count)throw Error('Invalid CFF FDSelect ranges');
    let previous=0;
    for(let k=0;k<n;k++){
      requireRange(b,offset,3,'CFF FDSelect range');const start=be16(b,offset),fd=b[offset+2];offset+=3;
      if(k===0&&start!==0||start<previous||start>=count)throw Error('Invalid CFF FDSelect range start');
      if(k>0)for(let j=previous;j<start;j++)result[j]=result[previous-1];
      result[start]=fd;previous=start+1;
      if(k===n-1){requireRange(b,offset,2,'CFF FDSelect sentinel');const end=be16(b,offset);if(end!==count)throw Error('CFF FDSelect sentinel mismatch');for(let j=previous;j<end;j++)result[j]=fd;}
    }
    return result;
  }
  throw Error(`Unsupported CFF FDSelect format ${format}`);
}
function readCFF(cff,nGlyphs){
  if(cff[0]!==1)throw Error('Only OpenType CFF version 1 is supported');
  let at=cff[2];requireRange(cff,0,at,'CFF header');
  at=cffIndex(cff,at).end;
  const topIndex=cffIndex(cff,at);at=topIndex.end;
  if(topIndex.items.length!==1)throw Error('CFF font must contain exactly one Top DICT');
  at=cffIndex(cff,at).end;
  const gsubrs=cffIndex(cff,at).items;
  const top=cffDict(topIndex.items[0]);
  const charOffset=top.get('17')?.[0];if(!Number.isInteger(charOffset))throw Error('Missing CFF CharStrings');
  const charStrings=cffIndex(cff,charOffset).items;
  if(charStrings.length!==nGlyphs)throw Error(`CFF CharStrings count ${charStrings.length} differs from maxp ${nGlyphs}`);
  let privates=[cffPrivate(cff,top)],fdIndex=null;
  if(top.has('12 36')||top.has('12 37')){
    const fdArray=top.get('12 36')?.[0],fdSelect=top.get('12 37')?.[0];
    if(!Number.isInteger(fdArray)||!Number.isInteger(fdSelect))throw Error('Incomplete CID-keyed CFF dictionaries');
    privates=cffIndex(cff,fdArray).items.map(fd=>cffPrivate(cff,cffDict(fd)));
    fdIndex=cffFDSelect(cff,fdSelect,nGlyphs);
  }
  return {charStrings,gsubrs,privates,fdIndex};
}
const bias=s=>s.length<1240?107:s.length<33900?1131:32768;
function charStringPath(code,subrs,gsubrs){
  const state={x:0,y:0,contours:[],current:null,stack:[],trans:new Array(32).fill(0),stems:0,seenWidth:false,seac:null};
  const s=state.stack;
  const close=()=>{if(state.current?.length>1)state.contours.push(state.current);state.current=null;};
  const move=(dx,dy)=>{close();state.x+=dx;state.y+=dy;state.current=[{x:state.x,y:state.y,on:true}];};
  const line=(dx,dy)=>{if(!state.current)throw Error('CFF line without moveto');state.x+=dx;state.y+=dy;state.current.push({x:state.x,y:state.y,on:true});};
  const curve=(dx1,dy1,dx2,dy2,dx3,dy3)=>{
    if(!state.current)throw Error('CFF curve without moveto');
    const p0={x:state.x,y:state.y};
    const p1={x:state.x+dx1,y:state.y+dy1};
    const p2={x:p1.x+dx2,y:p1.y+dy2};
    const p3={x:p2.x+dx3,y:p2.y+dy3};
    cubicToQuadratics(p0,p1,p2,p3,state.current);
    state.x=p3.x;state.y=p3.y;
  };
  const take=n=>{if(s.length<n)throw Error(`Malformed CFF charstring: expected ${n} operands`);return s.splice(0,n);};
  const stems=()=>{if(!state.seenWidth && s.length%2===1)s.shift();state.seenWidth=true;state.stems+=s.length/2;s.length=0;};
  const noWidth=(n)=>{if(!state.seenWidth && s.length>n)s.shift();state.seenWidth=true;};
  let ops=0;
  function parse(bytes,depth=0){
    if(depth>16)throw Error('CFF subroutine recursion limit exceeded');
    for(let p=0;p<bytes.length;){
      if(++ops>150000)throw Error('CFF charstring instruction limit exceeded');
      const op=bytes[p++];
      if(op>=32||op===28||op===255){const v=decodeNumber(bytes,p-1);s.push(v.value);p=v.at;if(s.length>100)throw Error('CFF operand stack overflow');continue;}
      if([1,3,18,23].includes(op)){stems();continue;}
      if(op===19||op===20){stems();p+=Math.ceil(state.stems/8);requireRange(bytes,p,0,'CFF hintmask');continue;}
      if(op===4||op===21||op===22){const n=op===21?2:1;noWidth(n);const a=take(n);move(op===4?0:a[0],op===4?a[0]:op===21?a[1]:0);s.length=0;continue;}
      if(op===5){while(s.length)line(...take(2));continue;}
      if(op===6||op===7){let x=op===6;while(s.length){const d=take(1)[0];line(x?d:0,x?0:d);x=!x;}continue;}
      if(op===8){while(s.length)curve(...take(6));continue;}
      if(op===10||op===29){const arr=op===10?subrs:gsubrs;const index=s.pop()+bias(arr);if(!Number.isInteger(index)||index<0||index>=arr.length)throw Error(`Invalid CFF subroutine index ${index}`);parse(arr[index],depth+1);continue;}
      if(op===11)return;
      if(op===14){
        if(s.length===5&&!state.seenWidth)s.shift();
        else if(s.length===1&&!state.seenWidth)s.shift();
        if(s.length===4)state.seac=s.slice();
        else if(s.length)throw Error('Unexpected CFF endchar operands');
        s.length=0;close();return;
      }
      if(op===24){while(s.length>2)curve(...take(6));line(...take(2));continue;}
      if(op===25){while(s.length>6)line(...take(2));curve(...take(6));continue;}
      if(op===26){let dx=s.length%4?s.shift():0;while(s.length){const [dy1,dx2,dy2,dy3]=take(4);curve(dx,dy1,dx2,dy2,0,dy3);dx=0;}continue;}
      if(op===27){let dy=s.length%4?s.shift():0;while(s.length){const [dx1,dx2,dy2,dx3]=take(4);curve(dx1,dy,dx2,dy2,dx3,0);dy=0;}continue;}
      if(op===30||op===31){let horizontal=op===31;while(s.length>=4){const [a,b,c,d]=take(4);if(horizontal){const ex=s.length===1?s.shift():0;curve(a,0,b,c,ex,d);}else{const ey=s.length===1?s.shift():0;curve(0,a,b,c,d,ey);}horizontal=!horizontal;}continue;}
      if(op===12){requireRange(bytes,p,1,'CFF escaped operator');const esc=bytes[p++];
        if(esc>=34&&esc<=37){
          const a=s.splice(0);let x0=state.x,y0=state.y;
          if(esc===34){if(a.length!==7)throw Error('Malformed CFF hflex');curve(a[0],0,a[1],a[2],a[3],0);curve(a[4],0,a[5],-a[2],a[6],0);}
          if(esc===35){if(a.length!==13)throw Error('Malformed CFF flex');curve(...a.slice(0,6));curve(...a.slice(6,12));}
          if(esc===36){if(a.length!==9)throw Error('Malformed CFF hflex1');curve(a[0],a[1],a[2],a[3],a[4],0);curve(a[5],0,a[6],a[7],a[8],-(state.y-y0));}
          if(esc===37){if(a.length!==11)throw Error('Malformed CFF flex1');curve(...a.slice(0,6));const d=a.slice(6);const sumX=a[0]+a[2]+a[4]+d[0]+d[2],sumY=a[1]+a[3]+a[5]+d[1]+d[3];curve(d[0],d[1],d[2],d[3],Math.abs(sumX)>Math.abs(sumY)?d[4]:-sumX,Math.abs(sumX)>Math.abs(sumY)?-sumY:d[4]);}
          continue;
        }
        const pop=()=>{if(!s.length)throw Error('CFF stack underflow');return s.pop();};
        if(esc===3||esc===4){const b=pop(),a=pop();s.push(esc===3?(a&&b?1:0):(a||b?1:0));continue;}
        if(esc===5){s.push(pop()?0:1);continue;}
        if(esc===9){s.push(Math.abs(pop()));continue;}
        if([10,11,12,15,24].includes(esc)){const b=pop(),a=pop();s.push(esc===10?a+b:esc===11?a-b:esc===12?a/b:esc===15?(a===b?1:0):a*b);continue;}
        if(esc===14){s.push(-pop());continue;}
        if(esc===18){pop();continue;}
        if(esc===20){const value=pop(),idx=pop();if(idx<0||idx>=32)throw Error('CFF transient index out of bounds');state.trans[idx]=value;continue;}
        if(esc===21){const idx=pop();s.push(state.trans[idx]??0);continue;}
        if(esc===22){const v2=pop(),v1=pop(),s2=pop(),s1=pop();s.push(v1<=v2?s1:s2);continue;}
        if(esc===23){s.push(0.5);continue;} // deterministic random for valid outlines
        if(esc===26){s.push(Math.sqrt(pop()));continue;}
        if(esc===27){const v=pop();s.push(v,v);continue;}
        if(esc===28){const v2=pop(),v1=pop();s.push(v2,v1);continue;}
        if(esc===29){const n=pop();s.push(s[Math.max(0,s.length-1-Math.min(n,s.length-1))]);continue;}
        if(esc===30){const j=pop(),n=pop();if(n<1||n>s.length)throw Error('Bad CFF roll');const shift=((j%n)+n)%n;const old=s.splice(-n);s.push(...old.slice(-shift),...old.slice(0,n-shift));continue;}
        throw Error(`Unsupported Type 2 escape operator ${esc}`);
      }
      throw Error(`Unsupported Type 2 charstring operator ${op}`);
    }
  }
  parse(code);close();
  if(state.seac)throw Error('CFF seac composite glyphs require a font with resolved components; this font cannot yet be normalized without changing its outlines');
  return state.contours;
}
function cubicToQuadratics(a,b,c,d,result,depth=0){
  const mid=(a,b)=>({x:(a.x+b.x)*0.5,y:(a.y+b.y)*0.5});
  const ab=mid(a,b),bc=mid(b,c),cd=mid(c,d),abc=mid(ab,bc),bcd=mid(bc,cd),m=mid(abc,bcd);
  const q={x:(8*m.x-a.x-d.x)/6,y:(8*m.y-a.y-d.y)/6};
  const cubic=(t,coord)=>{const u=1-t;return u*u*u*a[coord]+3*u*u*t*b[coord]+3*u*t*t*c[coord]+t*t*t*d[coord];};
  const quad=(t,coord)=>{const u=1-t;return u*u*a[coord]+2*u*t*q[coord]+t*t*d[coord];};
  const error=Math.max(...[0.25,0.75].flatMap(t=>['x','y'].map(v=>Math.abs(cubic(t,v)-quad(t,v)))));
  if(error>0.4&&depth<14){cubicToQuadratics(a,ab,abc,m,result,depth+1);cubicToQuadratics(m,bcd,cd,d,result,depth+1);}
  else if(error>0.4)throw Error('Cubic curve cannot be approximated accurately within TypeTrue bounds');
  else result.push({x:q.x,y:q.y,on:false},{x:d.x,y:d.y,on:true});
}
function glyfEncode(contours){
  const actual=contours.filter(c=>c.length>=2);if(actual.length===0)return {data:new Uint8Array(0),points:0,contours:0,bbox:null};
  if(actual.length>32767)throw Error('CFF glyph has too many contours');
  const points=actual.flat();if(points.length>32760)throw Error('CFF glyph has too many points');
  let xmin=32767,ymin=32767,xmax=-32768,ymax=-32768;
  for(const p of points){p.x=assert16(p.x,'CFF X coordinate');p.y=assert16(p.y,'CFF Y coordinate');xmin=Math.min(xmin,p.x);ymin=Math.min(ymin,p.y);xmax=Math.max(xmax,p.x);ymax=Math.max(ymax,p.y);}
  const data=[];put16(data,actual.length);
  for(const v of [xmin,ymin,xmax,ymax])put16(data,v);
  let end=-1;for(const c of actual){end+=c.length;put16(data,end);}
  put16(data,0); // no imported hint instructions (different outline/point count)
  for(const p of points)data.push(p.on?1:0);
  for(const coord of ['x','y']){
    let previous=0;
    for(const p of points){const delta=p[coord]-previous;assert16(delta,'CFF point delta');put16(data,delta);previous=p[coord];}
  }
  return {data:Uint8Array.from(data),points:points.length,contours:actual.length,bbox:[xmin,ymin,xmax,ymax]};
}
function checksum(bytes){let sum=0;for(let i=0;i<bytes.length;i+=4)sum=(sum+((bytes[i]??0)*0x1000000+((bytes[i+1]??0)<<16)+((bytes[i+2]??0)<<8)+(bytes[i+3]??0)))>>>0;return sum;}
function assemble(tables){
  const names=[...tables.keys()].sort();const n=names.length,search=Math.floor(Math.log2(n));
  const output=new Array(12+n*16).fill(0);patch32(output,0,0x00010000);patch16(output,4,n);
  patch16(output,6,2**search*16);patch16(output,8,search);patch16(output,10,n*16-2**search*16);
  for(let i=0;i<n;i++){
    const tag=names[i],buf=tables.get(tag),at=12+i*16,offset=output.length;
    for(let j=0;j<4;j++)output[at+j]=tag.charCodeAt(j);
    patch32(output,at+4,checksum(buf));patch32(output,at+8,offset);patch32(output,at+12,buf.length);
    for(const byte of buf)output.push(byte);while(output.length%4)output.push(0);
  }
  const head=names.indexOf('head');if(head<0)throw Error('No SFNT head');
  const headOffset=be32(output,12+head*16+8);patch32(output,headOffset+8,0);
  patch32(output,headOffset+8,(0xB1B0AFBA-checksum(output))>>>0);
  return Uint8Array.from(output);
}
/** Normalize one newly imported static font into a TrueType-outline source.
 * TTF source bytes are already normalized and are returned as-is.
 * Import still stores the ORIGINAL source independently, byte-for-byte.
 */
export function normalizeImportedFont(bytes){
  const {b,tables}=tableDirectory(bytes),format=inspectOutlineFormat(bytes);
  if(format==='truetype'){
    if(be32(b,0)===0x00010000)return {format,bytes:b};
    // Some legacy TrueType faces use the Apple 'true' signature. Their
    // contours are already quadratic; only normalize the SFNT signature.
    const out=new Map(tables);const head=Array.from(out.get('head'));
    if(head.length<54)throw Error('Invalid TrueType head table');
    patch32(head,8,0);out.set('head',Uint8Array.from(head));
    return {format,bytes:assemble(out)};
  }
  for(const name of ['head','hhea','hmtx','maxp','cmap','CFF '])if(!tables.has(name))throw Error(`CFF font is missing ${name}`);
  const maxp=tables.get('maxp'),head=tables.get('head');
  if(maxp.length<6||head.length<54)throw Error('Invalid CFF font metrics');
  const count=be16(maxp,4);if(count===0||count>65530)throw Error('Invalid CFF glyph inventory');
  const cff=readCFF(tables.get('CFF '),count);
  const glyf=[],loca=[],bbox=[32767,32767,-32768,-32768],glyphBoxes=[];
  let maxPoints=0,maxContours=0;
  for(let gid=0;gid<count;gid++){
    const fd=cff.fdIndex?cff.fdIndex[gid]:0;
    const local=cff.privates[fd];if(!local)throw Error(`Missing CFF FD index ${fd} for glyph ${gid}`);
    let encoded;
    try{encoded=glyfEncode(charStringPath(cff.charStrings[gid],local,cff.gsubrs));}
    catch(e){throw Error(`Unable to convert CFF glyph ${gid}: ${e.message}`);}
    loca.push(glyf.length);
    for(const v of encoded.data)glyf.push(v);
    while(glyf.length%4)glyf.push(0);
    glyphBoxes.push(encoded.bbox);
    maxPoints=Math.max(maxPoints,encoded.points);maxContours=Math.max(maxContours,encoded.contours);
    if(encoded.bbox){bbox[0]=Math.min(bbox[0],encoded.bbox[0]);bbox[1]=Math.min(bbox[1],encoded.bbox[1]);bbox[2]=Math.max(bbox[2],encoded.bbox[2]);bbox[3]=Math.max(bbox[3],encoded.bbox[3]);}
  }
  loca.push(glyf.length);
  const out=new Map(tables);
  for(const tag of ['CFF ','CFF2','VORG','DSIG','fvar','gvar','HVAR','MVAR','cvar','cvt ','fpgm','prep','LTSH','hdmx','VDMX'])out.delete(tag);
  const loc=[];for(const offset of loca)put32(loc,offset);
  out.set('glyf',Uint8Array.from(glyf));out.set('loca',Uint8Array.from(loc));
  // A TrueType hmtx left side bearing must agree with the newly quantized
  // glyph's xMin. Advances and original glyph IDs are preserved unchanged.
  const hhea=out.get('hhea'),hmtx=Array.from(out.get('hmtx'));
  if(hhea.length<36)throw Error('Invalid CFF hhea metrics');
  const metricCount=be16(hhea,34);
  if(metricCount<1||metricCount>count||hmtx.length<4*metricCount+2*(count-metricCount))throw Error('Invalid CFF hmtx metrics');
  for(let gid=0;gid<count;gid++){
    const at=gid<metricCount?4*gid+2:4*metricCount+2*(gid-metricCount);
    if(glyphBoxes[gid])patch16(hmtx,at,glyphBoxes[gid][0]);
  }
  out.set('hmtx',Uint8Array.from(hmtx));
  const newHead=Array.from(head);patch32(newHead,8,0);patch16(newHead,50,1);
  if(bbox[0]!==32767)for(let j=0;j<4;j++)patch16(newHead,36+j*2,bbox[j]);
  out.set('head',Uint8Array.from(newHead));
  const newMax=new Array(32).fill(0);patch32(newMax,0,0x00010000);patch16(newMax,4,count);patch16(newMax,6,maxPoints);patch16(newMax,8,maxContours);patch16(newMax,14,2);patch16(newMax,24,64);patch16(newMax,26,0);out.set('maxp',Uint8Array.from(newMax));
  if(out.has('post')){const post=Array.from(out.get('post'));if(post.length>=32){post.length=32;patch32(post,0,0x00030000);out.set('post',Uint8Array.from(post));}}
  return {format,bytes:assemble(out),glyphCount:count};
}
