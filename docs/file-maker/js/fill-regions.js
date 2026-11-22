/* Editable-ink flood fill. The mask is a composite of the user's raster ink
 * and their Bézier contours, never the grey imported reference. Pixel indices
 * refer to the 400x430 editor raster and remain independent of viewport zoom.
 */
export const FILL_INK_ALPHA = 64;

function components(alpha,width,height,insideSelection=null,seed=-1){
  const area=width*height;
  if(alpha.length!==area)throw new RangeError('Invalid ink mask');
  const visited=new Uint8Array(area),queue=new Int32Array(area);
  const enclosed=[];
  const visit=(start)=>{
    if(visited[start]||alpha[start]>=FILL_INK_ALPHA)return;
    let head=0,tail=1,open=false,intersects=!insideSelection;
    queue[0]=start;visited[start]=1;
    while(head<tail){
      const at=queue[head++],x=at%width,y=(at-x)/width;
      if(x===0||x===width-1||y===0||y===height-1)open=true;
      if(insideSelection?.[at])intersects=true;
      const neighbors=[x>0?at-1:-1,x<width-1?at+1:-1,y>0?at-width:-1,y<height-1?at+width:-1];
      for(const n of neighbors){
        if(n>=0&&!visited[n]&&alpha[n]<FILL_INK_ALPHA){
          visited[n]=1;queue[tail++]=n;
        }
      }
    }
    if(!open&&intersects){
      for(let i=0;i<tail;i++)enclosed.push(queue[i]);
    }
  };
  if(seed>=0){visit(seed);return enclosed;}
  // Check only components that actually touch the selected region. Once a
  // component has been scanned it cannot be reprocessed by later pixels.
  for(let i=0;i<area;i++)if(insideSelection[i])visit(i);
  return enclosed;
}

/** Indices of the enclosed transparent area clicked with the bucket. */
export function enclosedFillPixels(alpha,width,height,x,y){
  if(!Number.isInteger(x)||!Number.isInteger(y)||x<0||y<0||x>=width||y>=height)return [];
  return components(alpha,width,height,null,y*width+x);
}

/** Fill enclosed gaps intersecting a selection. If there are no such gaps,
 * fill only transparent pixels within the rectangle/lasso itself. In both
 * cases keep existing opaque raster and vector geometry unchanged.
 */
export function selectedFillPixels(alpha,width,height,selectionMask){
  if(selectionMask.length!==width*height)throw new RangeError('Invalid selection mask');
  const closed=components(alpha,width,height,selectionMask);
  if(closed.length)return closed;
  const pixels=[];
  for(let i=0;i<alpha.length;i++)if(selectionMask[i]&&alpha[i]<FILL_INK_ALPHA)pixels.push(i);
  return pixels;
}

/**
 * Include the partially covered boundary pixels on the *inside* of a filled
 * region.  The enclosed-region search uses an opaque-ink barrier, but stopping
 * exactly at that barrier can leave the antialiased inner rim translucent,
 * exposing the pale reference underneath as a dotted halo.  Extend only one
 * pixel into semi-transparent coverage; never cross or overwrite opaque ink.
 *
 * An optional clip confines a simple selection fill to the selected area.
 * Enclosed fills are allowed to follow their full region, even beyond a small
 * seed selection.  This function never changes the source-alpha mask.
 */
export function fillWithAntialiasFringe(alpha,width,height,pixels,clip=null){
  if(alpha.length!==width*height)throw new RangeError('Invalid ink mask');
  if(clip&&clip.length!==alpha.length)throw new RangeError('Invalid selection clip');
  if(!pixels.length)return [];
  const seen=new Uint8Array(alpha.length),result=[];
  for(const i of pixels){
    if(i<0||i>=alpha.length||seen[i])continue;
    seen[i]=1;result.push(i);
  }
  // Use only ORIGINAL region pixels as seeds: never expand recursively through
  // multiple antialiased pixels, which might cross a thin/open stroke.
  for(const i of pixels){
    const x=i%width,y=(i-x)/width;
    for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
      if(dx===0&&dy===0)continue;
      const nx=x+dx,ny=y+dy;
      if(nx<0||nx>=width||ny<0||ny>=height)continue;
      const n=ny*width+nx;
      if(!seen[n]&&alpha[n]>=FILL_INK_ALPHA&&alpha[n]<255&&(!clip||clip[n])){
        seen[n]=1;result.push(n);
      }
    }
  }
  return result;
}
