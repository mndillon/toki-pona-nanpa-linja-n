import {fontToPixel} from './font-coordinates.js';
/* MIT — v0.1 import: browser FontFace rasterizes imported glyphs on demand.
 * This does NOT reconstruct source font's native quadratic outlines/GSUB. */
export function fontHasCodepoint(bytes,cp){
  try{
    const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),u16=o=>v.getUint16(o),u32=o=>v.getUint32(o);
    if(u32(0)===0x74746366) return false; // TTC deferred.
    const n=u16(4);let cmap=0;
    for(let i=0;i<n;i++){const o=12+i*16;if(o+16>v.byteLength)return false;if(u32(o)===0x636d6170){cmap=u32(o+8);break;}}
    if(!cmap)return false;const count=u16(cmap+2);const records=[];
    for(let i=0;i<count;i++){const p=cmap+4+i*8;const platform=u16(p),enc=u16(p+2),off=u32(p+4);const pos=cmap+off,fmt=u16(pos);records.push({platform,enc,pos,fmt});}
    for(const r of records.filter(r=>r.fmt===12).concat(records.filter(r=>r.fmt===4))){
      if(r.fmt===12){const total=u32(r.pos+12);for(let i=0;i<total;i++){const p=r.pos+16+i*12,start=u32(p),end=u32(p+4);if(cp>=start&&cp<=end)return true;if(start>cp)break;}}
      else if(cp<=65535){const segs=u16(r.pos+6)/2,ends=r.pos+14,starts=ends+segs*2+2,deltas=starts+segs*2,ros=deltas+segs*2;for(let i=0;i<segs;i++){const a=u16(starts+i*2),b=u16(ends+i*2);if(cp<a||cp>b)continue;const ro=u16(ros+i*2);if(!ro)return ((cp+v.getInt16(deltas+i*2))&65535)!==0;const index=ros+i*2+ro+2*(cp-a);if(index+2>v.byteLength)return false;return u16(index)!==0;}}
    }
  }catch(e){console.debug('cmap parse failed',e)}
  return false;
}
export async function registerFont(bytes,id){const family=`SPFM_IMPORTED_${id.replace(/[^a-zA-Z0-9]/g,'_')}`;let font=new FontFace(family,bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));await font.load();document.fonts.add(font);return family;}
export function rasterizeFontGlyph(family,cp,word){
  const source=document.createElement('canvas');source.width=512;source.height=512;const ctx=source.getContext('2d');
  ctx.clearRect(0,0,512,512);ctx.fillStyle='#0c0c13';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=`310px "${family}"`;
  ctx.fillText(cp?String.fromCodePoint(cp):word,256,264,400);
  const rgba=ctx.getImageData(0,0,512,512).data;let minX=512,minY=512,maxX=-1,maxY=-1;
  for(let y=0;y<512;y++)for(let x=0;x<512;x++){if(rgba[(y*512+x)*4+3]>10){minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}}
  const c=document.createElement('canvas');c.width=c.height=256;
  if(maxX<0)return c;
  const s=Math.min(204/(maxX-minX+1),204/(maxY-minY+1)),dw=(maxX-minX+1)*s,dh=(maxY-minY+1)*s;
  c.getContext('2d').drawImage(source,minX,minY,maxX-minX+1,maxY-minY+1,(256-dw)/2,(256-dh)/2,dw,dh);return c;
}

// Position an imported glyph by its TRUE font coordinates (2048 normalized
// units per em), NOT by cropping/resizing its ink bounding box. The same
// editorShift is applied by the Rust outline writer on export.
export function rasterizeFontGlyphAligned(family,cp,{width=400,height=430,shiftX=0,shiftY=0}={}){
  const c=document.createElement('canvas');c.width=width;c.height=height;
  const ctx=c.getContext('2d');ctx.font=`320px "${family}"`;ctx.textAlign='left';
  ctx.textBaseline='alphabetic';ctx.fillStyle='#111119';
  ctx.fontKerning='none';
  const pos=fontToPixel(0,0,{x:shiftX,y:shiftY});
  ctx.fillText(String.fromCodePoint(cp),pos.x,pos.y);
  return c;
}
