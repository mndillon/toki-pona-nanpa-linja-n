/* Read actual vector geometry from the normalized TrueType source. This is
 * used ONLY when the user explicitly copies an imported grey reference into
 * editable glyph art. It never changes the reference or the source font.
 * Handles quadratic off-curve points, nested component transforms and holes.
 */
import {fontToPixel} from './font-coordinates.js';
import {anchor,closedContour} from './drawing-tools.js';
const U16=(v,o)=>v.getUint16(o),S16=(v,o)=>v.getInt16(o),U32=(v,o)=>v.getUint32(o);
const between=(len,off,size)=>Number.isSafeInteger(off)&&off>=0&&size>=0&&off+size<=len;
const check=(len,off,size)=>{if(!between(len,off,size))throw Error('Invalid imported TrueType glyph geometry');};
function directory(v){
 const n=U16(v,4),tables=new Map();check(v.byteLength,12,n*16);
 for(let i=0;i<n;i++){const o=12+i*16,tag=String.fromCharCode(...new Uint8Array(v.buffer,v.byteOffset+o,4));const start=U32(v,o+8),length=U32(v,o+12);check(v.byteLength,start,length);tables.set(tag,{start,length});}
 for(const tag of ['cmap','head','maxp','loca','glyf'])if(!tables.has(tag))throw Error(`Imported source has no ${tag} table`);
 return tables;
}
function glyphId(v,t,cp){
 const base=t.get('cmap').start,n=U16(v,base+2),options=[];check(v.byteLength,base+4,n*8);
 for(let i=0;i<n;i++){
  const p=base+4+i*8,platform=U16(v,p),encoding=U16(v,p+2),off=base+U32(v,p+4);check(v.byteLength,off,2);
  const fmt=U16(v,off);if(fmt===12||fmt===4)options.push({off,fmt,rank:(platform===3&&encoding===10)?0:(platform===0&&fmt===12)?1:(platform===3&&encoding===1)?2:3});
 }
 options.sort((a,b)=>a.rank-b.rank);
 for(const {off,fmt} of options){
  if(fmt===12){const count=U32(v,off+12);check(v.byteLength,off+16,count*12);let lo=0,hi=count-1;
   while(lo<=hi){const mid=(lo+hi)>>>1,p=off+16+mid*12,a=U32(v,p),b=U32(v,p+4);if(cp<a)hi=mid-1;else if(cp>b)lo=mid+1;else return U32(v,p+8)+cp-a;}
  }else if(cp<=65535){const count=U16(v,off+6)/2,e=off+14,s=e+count*2+2,d=s+count*2,r=d+count*2;check(v.byteLength,r,count*2);
   for(let i=0;i<count;i++){if(cp>U16(v,e+2*i)||cp<U16(v,s+2*i))continue;const delta=S16(v,d+2*i),range=U16(v,r+2*i);
    if(!range)return (cp+delta)&65535;
    const at=r+2*i+range+2*(cp-U16(v,s+2*i));check(v.byteLength,at,2);const value=U16(v,at);return value?(value+delta)&65535:0;
   }
  }
 }
 return 0;
}
function compose(p,q){return {a:p.a*q.a+p.c*q.b,b:p.b*q.a+p.d*q.b,c:p.a*q.c+p.c*q.d,d:p.b*q.c+p.d*q.d,
 x:p.a*q.x+p.c*q.y+p.x,y:p.b*q.x+p.d*q.y+p.y};}
function parseGlyph(v,t,gid,transform,depth,contours,seen){
 if(depth>18||seen.has(gid))throw Error('Recursive imported TrueType composite');
 const count=U16(v,t.get('maxp').start+4);if(gid>=count)throw Error('Imported glyph ID outside maxp');
 const loc=t.get('loca'),gly=t.get('glyf'),short=S16(v,t.get('head').start+50)===0;
 const offset=i=>{const p=loc.start+i*(short?2:4);check(v.byteLength,p,short?2:4);return short?U16(v,p)*2:U32(v,p);};
 const from=offset(gid),to=offset(gid+1);if(to===from)return;
 check(v.byteLength,gly.start+from,to-from);let at=gly.start+from;
 const end=gly.start+to,num=S16(v,at);at+=10;
 if(num>=0){
  check(end,at,num*2+2);const ends=[];for(let i=0;i<num;i++){ends.push(U16(v,at));at+=2;}
  const points=ends.at(-1)+1||0,ins=U16(v,at);at+=2+ins;check(end,at,points);
  const flags=[];
  while(flags.length<points){check(end,at,1);const f=v.getUint8(at++);let repeats=1;if(f&8){check(end,at,1);repeats+=v.getUint8(at++);}if(flags.length+repeats>points)throw Error('Invalid repeated TrueType flags');for(let k=0;k<repeats;k++)flags.push(f);}
  const xs=[],ys=[];let x=0,y=0;
  for(const f of flags){if(f&2){check(end,at,1);x+=(f&16?1:-1)*v.getUint8(at++);}else if(!(f&16)){check(end,at,2);x+=S16(v,at);at+=2;}xs.push(x);}
  for(const f of flags){if(f&4){check(end,at,1);y+=(f&32?1:-1)*v.getUint8(at++);}else if(!(f&32)){check(end,at,2);y+=S16(v,at);at+=2;}ys.push(y);}
  let previous=0;
  for(const last of ends){const pts=[];
   for(let i=previous;i<=last;i++){const px=transform.a*xs[i]+transform.c*ys[i]+transform.x,py=transform.b*xs[i]+transform.d*ys[i]+transform.y;pts.push({x:px,y:py,on:!!(flags[i]&1)});}
   previous=last+1;if(pts.length>=2)contours.push(pts);
  }
 }else{
  seen.add(gid);let more=true;
  while(more){check(end,at,4);const flags=U16(v,at),child=U16(v,at+2);at+=4;
   if(!(flags&2))throw Error('Point-matched TrueType composites are not editable in this version');
   let x,y;
   if(flags&1){check(end,at,4);x=S16(v,at);y=S16(v,at+2);at+=4;}
   else{check(end,at,2);x=v.getInt8(at);y=v.getInt8(at+1);at+=2;}
   let a=1,b=0,c=0,d=1;
   const f2=o=>S16(v,o)/16384;
   if(flags&8){check(end,at,2);a=d=f2(at);at+=2;}
   if(flags&64){check(end,at,4);a=f2(at);d=f2(at+2);at+=4;}
   if(flags&128){check(end,at,8);a=f2(at);b=f2(at+2);c=f2(at+4);d=f2(at+6);at+=8;}
   parseGlyph(v,t,child,compose(transform,{a,b,c,d,x,y}),depth+1,contours,seen);
   more=!!(flags&32);
  }
  seen.delete(gid);
 }
}
function quadraticAsCubic(pts,position){
 const all=[];
 for(let i=0;i<pts.length;i++){
  const p=pts[i],q=pts[(i+1)%pts.length];all.push(p);
  if(!p.on&&!q.on)all.push({x:(p.x+q.x)/2,y:(p.y+q.y)/2,on:true});
 }
 const first=all.findIndex(p=>p.on);if(first<0)return null;
 const rotated=[...all.slice(first),...all.slice(0,first)];
 const pt=p=>position(p.x,p.y);
 const a0=pt(rotated[0]),anchors=[anchor(a0.x,a0.y)];
 for(let i=0;i<rotated.length;){
  const next=rotated[(i+1)%rotated.length];if(next.on){
   if((i+1)%rotated.length!==0){const p=pt(next);anchors.push(anchor(p.x,p.y));}
   i++;continue;
  }
  const target=rotated[(i+2)%rotated.length];if(!target.on)throw Error('Unresolved quadratic implied midpoint');
  const a=anchors.at(-1),p0={x:a.x,y:a.y},q=pt(next),r=pt(target);
  const out=[p0.x+(q.x-p0.x)*2/3,p0.y+(q.y-p0.y)*2/3];
  const inside=[r.x+(q.x-r.x)*2/3,r.y+(q.y-r.y)*2/3];
  a.out=out.map(n=>Number(n.toFixed(3)));
  if((i+2)%rotated.length===0)anchors[0].in=inside.map(n=>Number(n.toFixed(3)));
  else anchors.push(anchor(r.x,r.y,inside));
  i+=2;
 }
 if(anchors.length<3)return null;
 const area=anchors.reduce((sum,p,i)=>{const q=anchors[(i+1)%anchors.length];return sum+p.x*q.y-q.x*p.y;},0);
 return closedContour(anchors,area<0?'hole':'fill');
}
export function importedGlyphContours(bytes,codepoint,shift={x:0,y:0}){
 const b=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes);
 const v=new DataView(b.buffer,b.byteOffset,b.byteLength),tables=directory(v),gid=glyphId(v,tables,codepoint);
 if(!gid)throw Error('The imported font has no mapped glyph at this Unicode position');
 const upm=U16(v,tables.get('head').start+18);if(upm<16||upm>16384)throw Error('Invalid imported units-per-em');
 const raw=[];parseGlyph(v,tables,gid,{a:1,b:0,c:0,d:1,x:0,y:0},0,raw,new Set());
 const position=(x,y)=>fontToPixel(x*2048/upm,y*2048/upm,shift);
 const contours=raw.map(points=>quadraticAsCubic(points,position)).filter(Boolean);
 if(!contours.length)throw Error('This imported glyph contains no editable vector contours');
 return contours;
}
