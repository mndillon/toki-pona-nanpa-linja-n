/* Offline vector drawing primitives and corner-aware freehand smoothing.
 * Coordinates are in the existing 400 x 430 editor artboard. All tools
 * produce the same cubic bezierContours consumed by the current Rust TTF
 * compiler: no second font rendering pipeline and no network dependency.
 */
const round=v=>Number(v.toFixed(3));
const K=.5522847498307936;
export function anchor(x,y,inside=[x,y],outside=[x,y]){
  return {x:round(x),y:round(y),in:inside.map(round),out:outside.map(round)};
}
export function closedContour(points,role='fill'){
  return {role,points};
}
export function ellipseContour(cx,cy,rx,ry,role='fill'){
  rx=Math.max(0,rx);ry=Math.max(0,ry);
  if(rx<.5||ry<.5)return null;
  return closedContour([
    anchor(cx+rx,cy,[cx+rx,cy-K*ry],[cx+rx,cy+K*ry]),
    anchor(cx,cy+ry,[cx+K*rx,cy+ry],[cx-K*rx,cy+ry]),
    anchor(cx-rx,cy,[cx-rx,cy+K*ry],[cx-rx,cy-K*ry]),
    anchor(cx,cy-ry,[cx-K*rx,cy-ry],[cx+K*rx,cy-ry])
  ],role);
}
export function rectangleContour(x0,y0,x1,y1,radius=0,role='fill'){
  const x=Math.min(x0,x1),y=Math.min(y0,y1),w=Math.abs(x1-x0),h=Math.abs(y1-y0);
  if(w<.5||h<.5)return null;
  const r=Math.max(0,Math.min(radius,w/2,h/2));
  if(r<.01)return closedContour([
    anchor(x,y),anchor(x+w,y),anchor(x+w,y+h),anchor(x,y+h)
  ],role);
  return closedContour([
    anchor(x+r,y,[x+r-K*r,y],[x+r,y]),
    anchor(x+w-r,y,[x+w-r,y],[x+w-r+K*r,y]),
    anchor(x+w,y+r,[x+w,y+r-K*r],[x+w,y+r]),
    anchor(x+w,y+h-r,[x+w,y+h-r],[x+w,y+h-r+K*r]),
    anchor(x+w-r,y+h,[x+w-r+K*r,y+h],[x+w-r,y+h]),
    anchor(x+r,y+h,[x+r,y+h],[x+r-K*r,y+h]),
    anchor(x,y+h-r,[x,y+h-r+K*r],[x,y+h-r]),
    anchor(x,y+r,[x,y+r],[x,y+r-K*r])
  ],role);
}
export function lineContour(a,b,width){
  const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy),r=Math.max(.5,width/2);
  if(len<.01)return ellipseContour(a.x,a.y,r,r);
  const vx=dx/len,vy=dy/len,nx=-vy,ny=vx;
  const p=(o,along,perp)=>[o.x+vx*along+nx*perp,o.y+vy*along+ny*perp];
  const A=p(a,0,r),B=p(b,0,r),C=p(b,r,0),D=p(b,0,-r),E=p(a,0,-r),F=p(a,-r,0);
  const shift=(q,along,perp)=>[q[0]+vx*along+nx*perp,q[1]+vy*along+ny*perp];
  return closedContour([
    anchor(...A,shift(A,-K*r,0),A),
    anchor(...B,B,shift(B,K*r,0)),
    anchor(...C,shift(C,0,K*r),shift(C,0,-K*r)),
    anchor(...D,shift(D,K*r,0),D),
    anchor(...E,E,shift(E,-K*r,0)),
    anchor(...F,shift(F,0,-K*r),shift(F,0,K*r))
  ]);
}
export function shapeContours(kind,a,b,width,{filled=false,constrain=false}={}){
  if(!a||!b)return [];
  const w=Math.max(1,Number(width)||1);
  if(kind==='line')return [lineContour(a,b,w)];
  let x0=Math.min(a.x,b.x),x1=Math.max(a.x,b.x),y0=Math.min(a.y,b.y),y1=Math.max(a.y,b.y);
  if(constrain){
    const side=Math.max(Math.abs(b.x-a.x),Math.abs(b.y-a.y));
    x1=a.x+(b.x>=a.x?side:0);x0=a.x-(b.x<a.x?side:0);
    y1=a.y+(b.y>=a.y?side:0);y0=a.y-(b.y<a.y?side:0);
  }
  if(x1-x0<1||y1-y0<1)return [];
  if(kind==='ellipse'){
    const cx=(x0+x1)/2,cy=(y0+y1)/2,rx=(x1-x0)/2,ry=(y1-y0)/2;
    const outer=ellipseContour(cx,cy,rx,ry);
    const inner=filled?null:ellipseContour(cx,cy,rx-w,ry-w,'hole');
    return [outer,inner].filter(Boolean);
  }
  if(kind==='rect'){
    const outer=rectangleContour(x0,y0,x1,y1,0);
    const inner=filled||x1-x0<=2*w||y1-y0<=2*w?null:rectangleContour(x0+w,y0+w,x1-w,y1-w,0,'hole');
    return [outer,inner].filter(Boolean);
  }
  return [];
}

// A smooth centreline may be bent with a single control point. Its ink is
// expanded to a closed, editable contour rather than rasterized.
export function curveContour(start,end,through,width){
  const center={x:2*through.x-(start.x+end.x)/2,y:2*through.y-(start.y+end.y)/2};
  const n=Math.max(20,Math.min(64,Math.ceil(Math.hypot(end.x-start.x,end.y-start.y)/4)));
  const radius=Math.max(.5,width/2),left=[],right=[];
  for(let i=0;i<=n;i++){
    const t=i/n,u=1-t,x=u*u*start.x+2*u*t*center.x+t*t*end.x,y=u*u*start.y+2*u*t*center.y+t*t*end.y;
    let dx=2*u*(center.x-start.x)+2*t*(end.x-center.x),dy=2*u*(center.y-start.y)+2*t*(end.y-center.y);
    const mag=Math.hypot(dx,dy)||1;dx/=mag;dy/=mag;
    left.push({x:x-dy*radius,y:y+dx*radius});right.push({x:x+dy*radius,y:y-dx*radius});
  }
  // Round both end caps. The tangent at the endpoints determines their
  // semicircle; no need to introduce an unclosed contour at export.
  const roundCap=(base,normal,forward)=>{
    const points=[];
    for(let i=1;i<12;i++){
      const theta=Math.PI*i/12;
      points.push({x:base.x+normal.x*radius*Math.cos(theta)+forward.x*radius*Math.sin(theta),
                   y:base.y+normal.y*radius*Math.cos(theta)+forward.y*radius*Math.sin(theta)});
    }
    return points;
  };
  const lastLeft=left.at(-1),lastRight=right.at(-1),firstLeft=left[0],firstRight=right[0];
  const slopeEnd={x:end.x-(left.at(-2).x+right.at(-2).x)/2,y:end.y-(left.at(-2).y+right.at(-2).y)/2};
  const el=Math.hypot(slopeEnd.x,slopeEnd.y)||1,forwardEnd={x:slopeEnd.x/el,y:slopeEnd.y/el};
  const normEnd={x:(lastLeft.x-end.x)/radius,y:(lastLeft.y-end.y)/radius};
  const slopeStart={x:(left[1].x+right[1].x)/2-start.x,y:(left[1].y+right[1].y)/2-start.y};
  const sl=Math.hypot(slopeStart.x,slopeStart.y)||1,forwardStart={x:-slopeStart.x/sl,y:-slopeStart.y/sl};
  const normStart={x:(firstRight.x-start.x)/radius,y:(firstRight.y-start.y)/radius};
  const outline=[...left,...roundCap(end,normEnd,forwardEnd),...right.reverse(),...roundCap(start,normStart,forwardStart)];
  return closedContour(outline.map(p=>anchor(p.x,p.y)));
}

export function affineContour(contour,{a=1,b=0,c=0,d=1,e=0,f=0}={}){
  const at=p=>[round(a*p[0]+c*p[1]+e),round(b*p[0]+d*p[1]+f)];
  return {...contour,points:contour.points.map(p=>{
    const [x,y]=at([p.x,p.y]);return {...p,x,y,in:at(p.in),out:at(p.out)};
  })};
}
export function affineRotate(degrees,cx,cy){
  const rad=degrees*Math.PI/180,a=Math.cos(rad),b=Math.sin(rad),c=-b,d=a;
  return {a,b,c,d,e:cx-a*cx-c*cy,f:cy-b*cx-d*cy};
}
export function affineScale(sx,sy,cx,cy){return {a:sx,b:0,c:0,d:sy,e:cx*(1-sx),f:cy*(1-sy)};}
export function applyAffine(p,m){return {x:m.a*p.x+m.c*p.y+m.e,y:m.b*p.x+m.d*p.y+m.f};}
export function rectAfterTransform(r,m){
  const pts=[{x:r.x,y:r.y},{x:r.x+r.width,y:r.y},{x:r.x,y:r.y+r.height},{x:r.x+r.width,y:r.y+r.height}].map(p=>applyAffine(p,m));
  const xs=pts.map(p=>p.x),ys=pts.map(p=>p.y);
  const left=Math.floor(Math.min(...xs)),top=Math.floor(Math.min(...ys));
  return {x:left,y:top,width:Math.ceil(Math.max(...xs))-left,height:Math.ceil(Math.max(...ys))-top};
}
export function smoothStroke(points,strength){
  if(!points?.length)return [];
  const amount=Math.max(0,Math.min(100,Number(strength)||0));
  let p=points.map(pt=>({x:pt.x,y:pt.y}));if(p.length<3||amount<=0)return p;
  const original=p.map(x=>({...x}));
  const passes=Math.ceil(amount/22),weight=amount/100*.5;
  const sharp=i=>{
    const a=original[i-1],b=original[i],c=original[i+1];
    if(!a||!c)return true;
    const v=[b.x-a.x,b.y-a.y],u=[c.x-b.x,c.y-b.y];
    const p=Math.hypot(...v),q=Math.hypot(...u);
    if(Math.min(p,q)<Math.max(5,amount/12))return false;
    const l=p*q;if(l<4)return false;
    return (v[0]*u[0]+v[1]*u[1])/l<.57; // preserve intentional ~55°+ corners
  };
  for(let k=0;k<passes;k++){
    const next=p.map((pt,i)=>i===0||i===p.length-1||sharp(i)?pt:{
      x:pt.x+(p[i-1].x+p[i+1].x-2*pt.x)*weight/2,
      y:pt.y+(p[i-1].y+p[i+1].y-2*pt.y)*weight/2
    });p=next;
  }
  // Omit densely repeated points but keep both endpoints and corners.
  const result=[p[0]];
  for(let i=1;i<p.length-1;i++){
    if(sharp(i)||Math.hypot(p[i].x-result.at(-1).x,p[i].y-result.at(-1).y)>=Math.max(1,amount/40))result.push(p[i]);
  }
  result.push(p.at(-1));return result;
}
export function recogniseStroke(points,tolerance=0){
  if(!Array.isArray(points)||points.length<5||tolerance<=0)return null;
  const first=points[0],last=points.at(-1),span=Math.hypot(last.x-first.x,last.y-first.y);
  const x=points.map(p=>p.x),y=points.map(p=>p.y);
  const bounds={x0:Math.min(...x),x1:Math.max(...x),y0:Math.min(...y),y1:Math.max(...y)};
  const diag=Math.hypot(bounds.x1-bounds.x0,bounds.y1-bounds.y0);
  if(span>=20){
    const deviation=points.reduce((max,p)=>Math.max(max,Math.abs((last.x-first.x)*(first.y-p.y)-(first.x-p.x)*(last.y-first.y))/span),0);
    if(deviation<Math.max(2.5,span*.07)*tolerance)return {kind:'line',a:first,b:last};
  }
  if(diag>=28&&span<diag*.23*tolerance){
    const cx=(bounds.x0+bounds.x1)/2,cy=(bounds.y0+bounds.y1)/2;
    const rx=(bounds.x1-bounds.x0)/2,ry=(bounds.y1-bounds.y0)/2;
    if(rx>10&&ry>10){
      const errors=points.map(p=>Math.abs(Math.hypot((p.x-cx)/rx,(p.y-cy)/ry)-1));
      const average=errors.reduce((s,v)=>s+v,0)/errors.length;
      if(average<.11*tolerance)return {kind:'ellipse',a:{x:bounds.x0,y:bounds.y0},b:{x:bounds.x1,y:bounds.y1}};
    }
  }
  return null;
}
