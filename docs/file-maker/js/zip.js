/* MIT — small offline ZIP/STORE writer and strict bounded ZIP/STORE reader.
 * No CDN, compression dependency or remote I/O. Other ZIP compression methods
 * are deliberately rejected rather than silently processing untrusted input.
 */
const enc=new TextEncoder();
const dec=new TextDecoder('utf-8',{fatal:true});
const crcTable=Array.from({length:256},(_,n)=>{let c=n;for(let j=0;j<8;j++)c=(c&1)?(0xEDB88320^(c>>>1)):(c>>>1);return c>>>0;});
export function crc32(data){let c=0xffffffff;for(const b of data)c=crcTable[(c^b)&255]^(c>>>8);return (c^0xffffffff)>>>0;}
function make(n){return new DataView(new ArrayBuffer(n));}
function p16(d,o,n){d.setUint16(o,n,true)} function p32(d,o,n){d.setUint32(o,n>>>0,true)}
function bytes(view){return new Uint8Array(view.buffer)}
export function makeZip(files){const chunks=[],directory=[];let offset=0;
  const push=a=>{chunks.push(a);offset+=a.length;};
  for(const [name,raw] of files){const nameBytes=enc.encode(name),data=raw instanceof Uint8Array?raw:enc.encode(String(raw)),crc=crc32(data),entryOffset=offset;
    const local=make(30);p32(local,0,0x04034b50);p16(local,4,20);p16(local,6,0x0800);p16(local,8,0);p32(local,14,crc);p32(local,18,data.length);p32(local,22,data.length);p16(local,26,nameBytes.length);push(bytes(local));push(nameBytes);push(data);
    directory.push({nameBytes,size:data.length,crc,offset:entryOffset});
  }
  const centralOffset=offset;
  for(const f of directory){const c=make(46);p32(c,0,0x02014b50);p16(c,4,20);p16(c,6,20);p16(c,8,0x0800);p32(c,16,f.crc);p32(c,20,f.size);p32(c,24,f.size);p16(c,28,f.nameBytes.length);p32(c,42,f.offset);push(bytes(c));push(f.nameBytes);}
  const end=make(22);p32(end,0,0x06054b50);p16(end,8,directory.length);p16(end,10,directory.length);p32(end,12,offset-centralOffset);p32(end,16,centralOffset);push(bytes(end));return new Blob(chunks,{type:'application/zip'});
}

const DEFAULT_MAX_ZIP_BYTES = 96 * 1024 * 1024;
const DEFAULT_MAX_ENTRY_BYTES = 48 * 1024 * 1024;
const DEFAULT_MAX_ENTRIES = 128;
function zipError(message){return new Error(`Invalid font-pair ZIP: ${message}`);}
function safeEntryName(name) {
  return typeof name==='string' && name.length>0 && name.length<=240 &&
    !name.includes('\\') && !name.startsWith('/') && !name.includes('\0') &&
    !name.split('/').some(p=>p===''||p==='.'||p==='..') &&
    !/[\x00-\x1f\x7f]/.test(name) && !/^[A-Za-z]:/.test(name);
}

/**
 * Read only a bounded unencrypted ZIP with STORE (method 0) entries.
 * Check central/local agreement, CRC32, names, offsets and entry overlap.
 * Output entries are copies; no output is returned on a partial failure.
 */
export function readZipStore(raw,{maxZipBytes=DEFAULT_MAX_ZIP_BYTES,maxEntryBytes=DEFAULT_MAX_ENTRY_BYTES,maxEntries=DEFAULT_MAX_ENTRIES}={}){
  const data=raw instanceof Uint8Array?raw:new Uint8Array(raw);
  if(data.length<22||data.length>maxZipBytes)throw zipError('archive is empty or exceeds the allowed size.');
  const d=new DataView(data.buffer,data.byteOffset,data.byteLength);
  const u16=o=>d.getUint16(o,true),u32=o=>d.getUint32(o,true);
  const check=(start,len,stop=data.length)=>Number.isSafeInteger(start)&&Number.isSafeInteger(len)&&start>=0&&len>=0&&start+len<=stop;
  let eocd=-1;
  for(let p=data.length-22;p>=Math.max(0,data.length-22-65535);p--){
    if(u32(p)===0x06054b50 && check(p,22) && p+22+u16(p+20)===data.length){eocd=p;break;}
  }
  if(eocd<0)throw zipError('end-of-directory record is missing.');
  if(u16(eocd+4)!==0||u16(eocd+6)!==0)throw zipError('multi-disk archives are not supported.');
  const count=u16(eocd+10),dirLen=u32(eocd+12),dirStart=u32(eocd+16);
  if(u16(eocd+8)!==count||count>maxEntries||count===0)throw zipError('entry count is invalid.');
  if(dirLen===0xffffffff||dirStart===0xffffffff||!check(dirStart,dirLen,eocd)||dirStart+dirLen!==eocd)throw zipError('central directory is invalid or uses ZIP64.');
  const found=new Map(),sections=[];
  let pos=dirStart;
  for(let i=0;i<count;i++){
    if(!check(pos,46,dirStart+dirLen)||u32(pos)!==0x02014b50)throw zipError('central directory entry is invalid.');
    const flags=u16(pos+8),method=u16(pos+10),crc=u32(pos+16),compressed=u32(pos+20),expanded=u32(pos+24),n=u16(pos+28),extra=u16(pos+30),comment=u16(pos+32),offset=u32(pos+42);
    if((flags&0x0001)!==0)throw zipError('encrypted entries are not supported.');
    if((flags&0x0008)!==0)throw zipError('data-descriptor entries are not supported.');
    if((flags&~0x0800)!==0)throw zipError('unsupported ZIP entry flags.');
    if(method!==0)throw zipError('compressed entries are unsupported; import the unmodified ZIP exported by Font Maker.');
    if(compressed!==expanded||expanded>maxEntryBytes||expanded===0xffffffff||offset===0xffffffff)throw zipError('entry has an invalid or excessive size.');
    if(!check(pos+46,n+extra+comment,dirStart+dirLen))throw zipError('entry metadata runs outside the directory.');
    let name;
    try{name=dec.decode(data.subarray(pos+46,pos+46+n));}catch{throw zipError('file name is not valid UTF-8.');}
    if(!safeEntryName(name)||found.has(name))throw zipError('unsafe or duplicate file name.');
    if(!check(offset,30,dirStart)||u32(offset)!==0x04034b50)throw zipError('local file header is invalid.');
    const localFlags=u16(offset+6),localMethod=u16(offset+8),localNameLen=u16(offset+26),localExtraLen=u16(offset+28);
    if(localFlags!==flags||localMethod!==method||localNameLen!==n||u32(offset+14)!==crc||u32(offset+18)!==compressed||u32(offset+22)!==expanded)throw zipError('local header disagrees with directory.');
    if(!check(offset+30,localNameLen+localExtraLen+compressed,dirStart))throw zipError('file data is truncated.');
    if(dec.decode(data.subarray(offset+30,offset+30+n))!==name)throw zipError('local file name differs from directory.');
    const begin=offset+30+localNameLen+localExtraLen,end=begin+compressed;
    const contents=data.slice(begin,end);
    if(crc32(contents)!==crc)throw zipError(`CRC mismatch for ${name}.`);
    sections.push([offset,end]);
    found.set(name,contents);
    pos+=46+n+extra+comment;
  }
  if(pos!==dirStart+dirLen)throw zipError('central directory has unexpected data.');
  sections.sort((a,b)=>a[0]-b[0]);
  if(sections[0][0]!==0)throw zipError('unexpected data before the first file.');
  for(let i=1;i<sections.length;i++)if(sections[i][0]!==sections[i-1][1])throw zipError('overlapping or unexpected ZIP data.');
  if(sections[sections.length-1][1]!==dirStart)throw zipError('unexpected data before the directory.');
  return found;
}
