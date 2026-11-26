/* MIT — editable connected line/curve centrelines.
 * A stroke is stored as cubic anchors, not a flattened raster. Only its
 * derived, closed black outline is passed to the unchanged TTF compiler.
 */
import {makeBezierAnchor} from './bezier.js?v=0.3.42.2';
const round=n=>Number(n.toFixed(3));
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const pt=(x,y)=>({x:round(x),y:round(y)});
export const isStroke=c=>c?.kind==='stroke'&&Array.isArray(c.points)&&c.points.length>=2;
export function newStroke(a,b,width=9,type='line',bend=null,cap='round'){
 const result={kind:'stroke',role:'fill',cap:['round','flat','square'].includes(cap)?cap:'round',width:Math.max(1,Number(width)||9),widths:[Math.max(1,Number(width)||9)],closed:false,points:[makeBezierAnchor(a.x,a.y),makeBezierAnchor(b.x,b.y)]};
 if(type==='curve')setSegmentBend(result,0,bend||midpoint(a,b));
 return result;
}
export function midpoint(a,b){return pt((a.x+b.x)/2,(a.y+b.y)/2);}
export function segmentPoint(a,b,t){
 const u=1-t;
 return pt(u*u*u*a.x+3*u*u*t*a.out[0]+3*u*t*t*b.in[0]+t*t*t*b.x,
           u*u*u*a.y+3*u*u*t*a.out[1]+3*u*t*t*b.in[1]+t*t*t*b.y);
}
export function segmentBend(a,b){return segmentPoint(a,b,.5);}
export function setSegmentBend(stroke,i,bend){
 const a=stroke.points[i],b=stroke.points[(i+1)%stroke.points.length];if(!a||!b)return false;
 // The two cubic controls are placed symmetrically around the chosen midpoint.
 // The interpolation makes the middle bend handle land exactly at the pointer.
 const mx=(a.x+b.x)/2,my=(a.y+b.y)/2;
 const dx=(bend.x-mx)*4/3,dy=(bend.y-my)*4/3;
 a.out=[round(a.x+(b.x-a.x)/3+dx),round(a.y+(b.y-a.y)/3+dy)];
 b.in=[round(a.x+2*(b.x-a.x)/3+dx),round(a.y+2*(b.y-a.y)/3+dy)];
 return true;
}
export function addSegment(stroke,end,type='line',bend=null,atStart=false,width=null){
 if(!isStroke(stroke)||stroke.closed)return false;
 const node=makeBezierAnchor(end.x,end.y);
 stroke.widths=Array.isArray(stroke.widths)?stroke.widths:[...Array(stroke.points.length-1)].map(()=>stroke.width);
 const addedWidth=Math.max(1,Number(width)||stroke.width);
 if(atStart)stroke.widths.unshift(addedWidth);else stroke.widths.push(addedWidth);
 if(atStart){stroke.points.unshift(node);if(type==='curve')setSegmentBend(stroke,0,bend||midpoint(node,stroke.points[1]));}
 else{stroke.points.push(node);if(type==='curve')setSegmentBend(stroke,stroke.points.length-2,bend||midpoint(stroke.points.at(-2),node));}
 return true;
}
export function reverseStroke(s){
 return {...s,widths:(s.widths||[]).slice().reverse(),points:s.points.slice().reverse().map(n=>({...n,in:[...n.out],out:[...n.in]}))};
}
// Every anchor in a connected centreline remains addressable after joining.
// Endpoint snapping for drawing is deliberately kept separate from node editing.
export function strokeNodeHit(contours,p,radius){
 let best=null,d=radius;
 (contours||[]).forEach((c,ci)=>{
  if(!isStroke(c))return;
  c.points.forEach((node,ni)=>{
   const delta=dist(node,p);
   if(delta<=d){d=delta;best={ci,ni,point:node,endpoint:!c.closed&&(ni===0||ni===c.points.length-1)};}
  });
 });
 return best;
}
// Keep an open stroke's join tangent continuous without changing the positions
// of any anchors, or the endpoints of the neighbouring segments.
export function smoothStrokeJunction(stroke,index){
 if(!isStroke(stroke))return false;
 const n=stroke.points.length;
 if(!Number.isInteger(index)||index<0||index>=n||(!stroke.closed&&(index===0||index===n-1)))return false;
 const node=stroke.points[index],prev=stroke.points[(index-1+n)%n],next=stroke.points[(index+1)%n];
 const pi=dist(node,{x:node.in[0],y:node.in[1]});
 const po=dist(node,{x:node.out[0],y:node.out[1]});
 const previousDirection=pi>.01?pt(node.x-node.in[0],node.y-node.in[1]):pt(node.x-prev.x,node.y-prev.y);
 const nextDirection=po>.01?pt(node.out[0]-node.x,node.out[1]-node.y):pt(next.x-node.x,next.y-node.y);
 const normalize=v=>{const l=Math.hypot(v.x,v.y);return l>.0001?{x:v.x/l,y:v.y/l}:null;};
 const a=normalize(previousDirection),b=normalize(nextDirection);
 if(!a&&!b)return false;
 let direction=a&&b?normalize({x:a.x+b.x,y:a.y+b.y}):(a||b);
 // At a sharp U-turn the average is zero. Use the wider two-node chord.
 if(!direction)direction=normalize({x:next.x-prev.x,y:next.y-prev.y})||a||b;
 const inLength=pi>.01?pi:dist(prev,node)/3;
 const outLength=po>.01?po:dist(node,next)/3;
 const nextIn=[round(node.x-direction.x*inLength),round(node.y-direction.y*inLength)];
 const nextOut=[round(node.x+direction.x*outLength),round(node.y+direction.y*outLength)];
 const changed=dist({x:node.in[0],y:node.in[1]},{x:nextIn[0],y:nextIn[1]})>.005||
  dist({x:node.out[0],y:node.out[1]},{x:nextOut[0],y:nextOut[1]})>.005;
 node.in=nextIn;node.out=nextOut;
 return changed;
}
export function strokeEndpoints(contours,p,radius,excluded=null){
 let best=null,d=radius;
 (contours||[]).forEach((c,ci)=>{
  if(!isStroke(c)||c.closed)return;
  for(const ni of [0,c.points.length-1]){
   if(excluded?.ci===ci&&excluded?.ni===ni)continue;
   const delta=dist(c.points[ni],p);
   if(delta<=d){d=delta;best={ci,ni,point:c.points[ni]};}
  }
 });return best;
}
export function strokeBendHit(contours,p,radius){
 let best=null,d=radius;
 (contours||[]).forEach((c,ci)=>{
  if(!isStroke(c))return;
  for(let i=0;i<c.points.length-(c.closed?0:1);i++){
   const bend=segmentBend(c.points[i],c.points[(i+1)%c.points.length]);
   const delta=dist(bend,p);
   if(delta<=d){d=delta;best={ci,i,bend};}
  }
 });return best;
}
export function nearestStrokeBody(contours,p,radius){
 let hit=null,d=radius;
 (contours||[]).forEach((c,ci)=>{
  if(!isStroke(c))return;
  for(let i=0;i<c.points.length-(c.closed?0:1);i++){
   const a=c.points[i],b=c.points[(i+1)%c.points.length];
   for(let j=0;j<=32;j++){
    const q=segmentPoint(a,b,j/32),delta=dist(p,q);
    if(delta<=d){d=delta;hit={ci,i};}
   }
  }
 });return hit;
}
export function joinOpenStrokes(a,aEnd,b,bEnd,{smooth=false,bridge='line'}={}){
 if(!isStroke(a)||!isStroke(b)||a.closed||b.closed)throw Error('Choose two open line/curve strokes.');
 let left=aEnd===0?reverseStroke(a):structuredClone(a);
 let right=bEnd===b.points.length-1?reverseStroke(b):structuredClone(b);
 const widthsOf=s=>Array.isArray(s.widths)&&s.widths.length===s.points.length-1?s.widths.slice():Array(s.points.length-1).fill(s.width);
 const lw=widthsOf(left),rw=widthsOf(right);
 const tail=left.points.at(-1),head=right.points[0];
 // Joining two separate strokes retains both original shapes. Where their
 // endpoints differ, add the explicit connecting segment between them.
 const gap=dist(tail,head);
 // Gaps within the same pointer-snap tolerance represent one junction,
 // not an extra miniature connector (which can create a visible spike).
 if(gap<=14){
  const meeting=pt((tail.x+head.x)/2,(tail.y+head.y)/2);
  // Moving only the anchor produces a short kink: tangent handles must
  // follow the snapped endpoint by exactly the same delta.
  for(const node of [tail,head]){
   const dx=meeting.x-node.x,dy=meeting.y-node.y;
   node.x=meeting.x;node.y=meeting.y;
   node.in=[round(node.in[0]+dx),round(node.in[1]+dy)];
   node.out=[round(node.out[0]+dx),round(node.out[1]+dy)];
  }
  if(smooth){
   const before=left.points.at(-2),after=right.points[1];
   const dx=after.x-before.x,dy=after.y-before.y,len=Math.hypot(dx,dy)||1;
   const prior=Math.hypot(tail.x-tail.in[0],tail.y-tail.in[1])||dist(before,tail)/3;
   const next=Math.hypot(head.out[0]-head.x,head.out[1]-head.y)||dist(head,after)/3;
   tail.in=[round(tail.x-dx/len*prior),round(tail.y-dy/len*prior)];
   head.out=[round(head.x+dx/len*next),round(head.y+dy/len*next)];
  }
  left.widths=[...lw,...rw];
  left.points.push(...right.points.slice(1));
  left.points[left.points.length-right.points.length].out=[...head.out];
 }else{
  if(smooth){
   // An explicit cubic connector with matching endpoint tangents.
   const prev=left.points.at(-2),next=right.points[1],d=gap/3;
   const l=Math.hypot(tail.x-prev.x,tail.y-prev.y)||1;
   const r=Math.hypot(next.x-head.x,next.y-head.y)||1;
   tail.out=[round(tail.x+(tail.x-prev.x)/l*d),round(tail.y+(tail.y-prev.y)/l*d)];
   head.in=[round(head.x-(next.x-head.x)/r*d),round(head.y-(next.y-head.y)/r*d)];
  }else if(bridge==='line'){tail.out=[tail.x,tail.y];head.in=[head.x,head.y];}
  left.widths=[...lw,(lw.at(-1)+rw[0])/2,...rw];
  left.points.push(...right.points);
 }
 return left;
}
export function closeOpenStroke(stroke,{smooth=false}={}){
 if(!isStroke(stroke)||stroke.closed||stroke.points.length<3)throw Error('At least three points are needed to close a stroke.');
 const s=structuredClone(stroke);s.closed=true;s.widths=[...(s.widths||Array(s.points.length-1).fill(s.width)),(s.widths?.at(-1)||s.width)];
 if(!smooth){const a=s.points.at(-1),b=s.points[0];a.out=[a.x,a.y];b.in=[b.x,b.y];}
 return s;
}
export function strokeOutlinePath(stroke){
 if(!isStroke(stroke))return '';
 const pts=stroke.points,center=[];
 const edges=pts.length-(stroke.closed?0:1);
 const widths=Array.isArray(stroke.widths)&&stroke.widths.length===edges?stroke.widths:Array(edges).fill(stroke.width);
 const radiusAtNode=i=>{const a=widths[(i+edges-1)%edges],b=widths[Math.min(i,edges-1)];return Math.max(.5,(stroke.closed||i>0&&i<edges)?(a+b)/4:(i===0?b:a)/2);};
 center.push({...pt(pts[0].x,pts[0].y),radius:radiusAtNode(0)});
 for(let i=0;i<edges;i++){
  const a=pts[i],b=pts[(i+1)%pts.length];
  const estimate=dist(a,b)+dist({x:a.out[0],y:a.out[1]},a)+dist({x:b.in[0],y:b.in[1]},b);
  const count=Math.max(5,Math.min(80,Math.ceil(estimate/4)));
  const startRadius=radiusAtNode(i),endRadius=radiusAtNode((i+1)%pts.length);
  for(let j=1;j<=count;j++){const t=j/count;center.push({...segmentPoint(a,b,t),radius:startRadius+(endRadius-startRadius)*t});}
 }
 if(stroke.closed)center.pop();
 const left=[],right=[];
 for(let i=0;i<center.length;i++){
  const prev=center[(i-1+center.length)%center.length],next=center[(i+1)%center.length];
  const a=stroke.closed?prev:(center[i-1]||center[0]),b=stroke.closed?next:(center[i+1]||center.at(-1));
  const dx=b.x-a.x,dy=b.y-a.y,mag=Math.hypot(dx,dy)||1;
  const radius=center[i].radius;
  left.push(pt(center[i].x-dy/mag*radius,center[i].y+dx/mag*radius));
  right.push(pt(center[i].x+dy/mag*radius,center[i].y-dx/mag*radius));
 }
 if(stroke.closed){
  const o=arr=>`M ${arr[0].x} ${arr[0].y} `+arr.slice(1).map(p=>`L ${p.x} ${p.y}`).join(' ')+ ' Z';
  // Both contours must have opposite winding so the inner area is a hole.
  return `${o(left)} ${o(right.reverse())}`;
 }
 // Store cap geometry in the stroke itself. Switching the current Brush
 // preference must never change a previously drawn or exported outline.
 const cap=['round','flat','square'].includes(stroke.cap)?stroke.cap:'round';
 if(cap!=='round'){
  if(cap==='square'){
   const first=center[0],second=center[1],last=center.at(-1),prior=center.at(-2);
   const tangent=(a,b)=>{const dx=b.x-a.x,dy=b.y-a.y,l=Math.hypot(dx,dy)||1;return {x:dx/l,y:dy/l};};
   const atStart=tangent(first,second),atEnd=tangent(prior,last);
   const move=(p,t,scale)=>pt(p.x+t.x*scale,p.y+t.y*scale);
   left[0]=move(left[0],atStart,-first.radius);
   right[0]=move(right[0],atStart,-first.radius);
   left[left.length-1]=move(left.at(-1),atEnd,last.radius);
   right[right.length-1]=move(right.at(-1),atEnd,last.radius);
  }
  const around=[...left,...right.reverse()];
  return `M ${around[0].x} ${around[0].y} `+around.slice(1).map(p=>`L ${p.x} ${p.y}`).join(' ')+' Z';
 }
 // Join offset edges with semicircular round caps.
 const p1=center.at(-1),p0=center[0];
 const roundCap=(base,from)=>{
  const angle=Math.atan2(from.y-base.y,from.x-base.x);
  return Array.from({length:12},(_,i)=>pt(base.x+base.radius*Math.cos(angle-Math.PI*(i+1)/12),base.y+base.radius*Math.sin(angle-Math.PI*(i+1)/12)));
 };
 const capEnd=roundCap(p1,left.at(-1));
 const capStart=roundCap(p0,right[0]);
 const around=[...left,...capEnd,...right.reverse(),...capStart];
 return `M ${around[0].x} ${around[0].y} `+around.slice(1).map(p=>`L ${p.x} ${p.y}`).join(' ')+' Z';
}
