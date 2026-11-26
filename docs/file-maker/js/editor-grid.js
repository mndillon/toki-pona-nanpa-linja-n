/** Font Maker artboard grid: UI-only, never part of saved glyph pixels or TTF output. */
export const DEFAULT_GRID_SPACING=20;
export const GRID_MIN_SPACING=5;
export const GRID_MAX_SPACING=100;
export const GRID_STORAGE_KEY='spfm-artboard-grid-v1';
const SVG_NS='http://www.w3.org/2000/svg';
export function normalizeGridSpacing(value){
  const n=Number(value);
  if(!Number.isFinite(n))return DEFAULT_GRID_SPACING;
  return Math.max(GRID_MIN_SPACING,Math.min(GRID_MAX_SPACING,Math.round(n/5)*5));
}
export function snapGridPoint(point,spacing=DEFAULT_GRID_SPACING,width=400,height=430){
  const s=normalizeGridSpacing(spacing);
  return {x:Math.max(0,Math.min(width-1,Math.round(point.x/s)*s)),
          y:Math.max(0,Math.min(height-1,Math.round(point.y/s)*s))};
}
export function shouldSnapDrawingTool(tool){
  return ['line','curve','rect','ellipse','bezier'].includes(String(tool));
}
export function gridPaths(spacing=DEFAULT_GRID_SPACING,width=400,height=430){
  const s=normalizeGridSpacing(spacing),minor=[],major=[];
  for(let x=s;x<width;x+=s){const arr=(x/s)%5===0?major:minor;arr.push(`M${x} 0V${height}`);}
  for(let y=s;y<height;y+=s){const arr=(y/s)%5===0?major:minor;arr.push(`M0 ${y}H${width}`);}
  return {minor:minor.join(' '),major:major.join(' '),spacing:s};
}
export function drawGridOverlay(svg,{visible=true,spacing=DEFAULT_GRID_SPACING,width=400,height=430}={}){
  if(!svg)return;
  svg.replaceChildren();svg.hidden=!visible;
  svg.setAttribute('viewBox',`0 0 ${width} ${height}`);
  if(!visible)return;
  const lines=gridPaths(spacing,width,height);
  for(const [kind,path] of [['minor',lines.minor],['major',lines.major]]){
    if(!path)continue;
    const line=svg.ownerDocument.createElementNS(SVG_NS,'path');
    line.setAttribute('d',path);line.setAttribute('fill','none');
    line.setAttribute('stroke',kind==='major'?'#848ba7':'#9da4b2');
    line.setAttribute('stroke-opacity',kind==='major'?'0.34':'0.20');
    line.setAttribute('stroke-width',kind==='major'?'1':'0.8');
    svg.appendChild(line);
  }
}
