/** Drag support for the drawing palette, independent of glyphs or font state.
 * Coordinates are relative to the drawing pane, with separate saved positions
 * for normal and expanded editor layouts. No toolbar/canvas geometry is changed.
 */
export const PALETTE_POSITION_KEY = 'spfm-drawing-palette-position-v1';
const EDGE = 8;

const finitePosition = p => p && typeof p.left === 'number' &&
  typeof p.top === 'number' && Number.isFinite(p.left) && Number.isFinite(p.top)
  ? {left: p.left, top: p.top} : null;

export function clampPalettePosition(point, box, margin = EDGE) {
  const visibleLeft = box.scrollLeft || 0;
  const visibleTop = box.scrollTop || 0;
  const availableWidth = Math.max(0, box.width || 0);
  const availableHeight = Math.max(0, box.height || 0);
  const limitX = visibleLeft + Math.max(margin, availableWidth - (box.paletteWidth || 0) - margin);
  const limitY = visibleTop + Math.max(margin, availableHeight - (box.paletteHeight || 0) - margin);
  return {
    left: Math.round(Math.max(visibleLeft + margin, Math.min(limitX, Number(point.left) || 0))),
    top: Math.round(Math.max(visibleTop + margin, Math.min(limitY, Number(point.top) || 0)))
  };
}

/** Header dragging, keyboard nudging, bounds clamping and localStorage restore. */
export function attachPaletteDragging({palette, header, container}) {
  const saved = (() => {
    try {
      const data = JSON.parse(localStorage.getItem(PALETTE_POSITION_KEY) || '{}');
      return {normal: finitePosition(data?.normal), expanded: finitePosition(data?.expanded)};
    } catch (_) { return {normal: null, expanded: null}; }
  })();
  let shown = null, shownMode = null, gesture = null;
  const mode = () => document.body.classList.contains('editor-expanded') ? 'expanded' : 'normal';
  const persist = () => {
    try { localStorage.setItem(PALETTE_POSITION_KEY, JSON.stringify(saved)); }
    catch (_) { /* private browsing / restricted storage */ }
  };
  const box = () => ({
    width:container.clientWidth, height:container.clientHeight,
    scrollLeft:container.scrollLeft, scrollTop:container.scrollTop,
    paletteWidth:palette.offsetWidth, paletteHeight:palette.offsetHeight
  });
  const place = p => {
    const constrained = clampPalettePosition(p, box());
    palette.style.right = 'auto';
    palette.style.left = `${constrained.left}px`;
    palette.style.top = `${constrained.top}px`;
    shown = constrained;
    shownMode = mode();
    return constrained;
  };
  const prepareSize = () => {
    const viewportLimit = window.innerHeight * (mode() === 'expanded' ? .70 : .67);
    palette.style.maxHeight = `${Math.max(60, Math.floor(Math.min(530, viewportLimit, container.clientHeight - 2 * EDGE)))}px`;
  };
  const defaultPoint = () => ({
    left:container.scrollLeft + container.clientWidth - palette.offsetWidth - 20,
    top:container.scrollTop + (mode() === 'expanded' ? 110 : 119)
  });
  const reposition = () => {
    if (palette.hidden || gesture) return;
    prepareSize();
    const currentMode = mode();
    const point = shownMode === currentMode && shown
      ? shown : saved[currentMode] || defaultPoint();
    place(point);
  };
  const finish = (commit = true) => {
    if (!gesture) return;
    const last = gesture;
    gesture = null;
    header.classList.remove('dragging');
    if (!commit) place({left:last.left, top:last.top});
    else { saved[mode()] = {...shown}; persist(); }
    try { if (header.hasPointerCapture(last.id)) header.releasePointerCapture(last.id); }
    catch (_) { /* pointer capture may have been released by the browser */ }
  };
  header.addEventListener('pointerdown', e => {
    if (palette.hidden || gesture || e.isPrimary === false ||
        (e.pointerType === 'mouse' && e.button !== 0) ||
        e.target.closest('button, input, select, textarea, a')) return;
    reposition();
    gesture = {id:e.pointerId, x:e.clientX, y:e.clientY,
      left:shown.left, top:shown.top};
    header.classList.add('dragging');
    try { header.setPointerCapture(e.pointerId); } catch (_) { gesture=null; header.classList.remove('dragging'); return; }
    e.preventDefault();
  });
  header.addEventListener('pointermove', e => {
    if (!gesture || gesture.id !== e.pointerId) return;
    place({left:gesture.left + e.clientX - gesture.x,
      top:gesture.top + e.clientY - gesture.y});
    e.preventDefault();
  });
  header.addEventListener('pointerup', e => { if (gesture?.id === e.pointerId) finish(true); });
  header.addEventListener('pointercancel', e => { if (gesture?.id === e.pointerId) finish(false); });
  header.addEventListener('lostpointercapture', e => {
    if (gesture?.id === e.pointerId) finish(true);
  });
  header.addEventListener('keydown', e => {
    if (e.target !== header || !['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)) return;
    reposition();
    const step = e.shiftKey ? 30 : 10;
    const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
    const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
    saved[mode()] = place({left:shown.left+dx, top:shown.top+dy});
    persist();
    e.preventDefault();
    e.stopPropagation();
  });
  header.addEventListener('dblclick', e => {
    if (e.target.closest('button, input, select, textarea, a')) return;
    saved[mode()] = null;
    shown = null;
    persist();
    reposition();
  });
  window.addEventListener('resize', reposition);
  container.addEventListener('scroll', reposition, {passive:true});
  if (typeof ResizeObserver !== 'undefined') {
    const observer = new ResizeObserver(reposition);
    observer.observe(container);
    observer.observe(palette);
  }
  if (typeof MutationObserver !== 'undefined') {
    new MutationObserver(() => { if (gesture) finish(true); reposition(); })
      .observe(document.body, {attributes:true, attributeFilter:['class']});
  }
  return {reposition};
}
