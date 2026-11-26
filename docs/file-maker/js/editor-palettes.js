import {attachPaletteDragging} from './palette-drag.js';
/** Compact drawing palettes: UI-only, no glyph compiler or tab state changes.
 * Controls are MOVED, not duplicated; the existing application handlers keep
 * their identity, event listeners and tests. The palette floats over the artboard.
 */
const PALETTE_KEY='spfm-drawing-palette';
const helpTargets={brush:'brush',edit:'editing',path:'paths',layers:'layers',info:'inspect'};
const captions={brush:'Brush & smoothing',edit:'Selection & editing',path:'Bézier paths',layers:'Glyph layers',info:'Glyph inspector'};
export function setupEditorPalettes({renderLayers}){
  const byId=id=>document.getElementById(id);
  const root=byId('editorPaletteContent');
  const legacy=byId('legacyEditorControls');
  const quick=byId('editorQuickTools');
  const toolset=legacy.querySelector('.toolset');
  quick.appendChild(toolset);
  const glyphIcons={select:'▣',lasso:'◌',pen:'✎',eraser:'◫',line:'╱',ellipse:'◯',rect:'▢',curve:'⌒',fill:'▰',bezier:'⌁',pan:'✥'};
  for(const button of toolset.querySelectorAll('[data-tool]')){
    const label=button.textContent.trim();
    button.title=button.title||label;
    button.setAttribute('aria-label',label);
    button.textContent=glyphIcons[button.dataset.tool]||label;
  }
  const groups={};
  for(const [id,label] of Object.entries(captions)){
    const group=document.createElement('div');group.id='palette-'+id;group.className='palette-group';group.setAttribute('aria-label',label);group.hidden=true;root.appendChild(group);groups[id]=group;
  }
  const put=(id,parent='edit')=>{const el=byId(id);if(el)groups[parent].appendChild(el);};
  for(const id of ['brushSize','strokeSmoothing','lineCapStyle','tipShape']){
    const control=byId(id)?.closest('.drawing-control');if(control)groups.brush.appendChild(control);
  }
  for(const id of ['btnSmoothExisting','autoShape','filledShape','drawShapesFromCentre']){
    const el=byId(id);if(el)groups.brush.appendChild(el.closest('label')||el);
  }
  for(const id of ['btnCopyGlyph','btnPasteGlyph','btnReplaceGlyph','btnUndo','btnRedo','btnClearGlyph','selectionActions'])put(id,'edit');
  for(const id of ['btnCloseBezier','btnCloseBezierHole','btnCancelBezier','btnDeleteBezier','bezierPickerWrapper','bezierRoleWrapper','btnBezierPreview'])put(id,'path');
  // The grid is only a visual/interaction aid, not glyph geometry or font data.
  const gridDetails=document.createElement('details');gridDetails.id='paletteGridSettings';gridDetails.className='palette-grid-settings';
  const gridSummary=document.createElement('summary');gridSummary.textContent='Grid & snapping';gridDetails.appendChild(gridSummary);
  const gridBody=document.createElement('div');gridBody.className='grid-settings-body';
  const gridSpacingLabel=document.createElement('label');gridSpacingLabel.htmlFor='gridSpacing';gridSpacingLabel.textContent='Grid spacing (editor units)';
  const gridSpacing=document.createElement('input');gridSpacing.id='gridSpacing';gridSpacing.type='number';gridSpacing.min='5';gridSpacing.max='100';gridSpacing.step='5';gridSpacing.value='20';
  const snapLabel=document.createElement('label');snapLabel.className='check';snapLabel.htmlFor='snapToGrid';
  const snap=document.createElement('input');snap.id='snapToGrid';snap.type='checkbox';snapLabel.append(snap,document.createTextNode(' Snap to grid'));
  const note=document.createElement('small');note.className='grid-settings-note';note.textContent='The grid is an alignment guide, not part of the font. Snapping is independent of grid visibility and does not affect freehand drawing.';
  gridBody.append(gridSpacingLabel,gridSpacing,snapLabel,note);gridDetails.append(gridBody);groups.info.appendChild(gridDetails);
  const inspector=document.querySelector('#pane-glyph .inspector');if(inspector)groups.info.appendChild(inspector);
  const layerText=document.createElement('p');layerText.className='palette-status';layerText.textContent='Each glyph has independent layers. Eye = view, lock = protect, checkbox = include in export; + Add, − Cut, ∩ Keep or Guide control how it combines. Click a layer to edit; double-click its name to rename. The imported base is a protected guide.';
  groups.layers.append(layerText);
  const layerList=document.createElement('div');layerList.id='glyphLayerList';layerList.className='palette-layer-list';groups.layers.append(layerList);
  const add=document.createElement('button');add.className='btn compact';add.id='btnAddGlyphLayer';add.textContent='+ Layer';
  const duplicate=document.createElement('button');duplicate.className='btn compact';duplicate.id='btnDuplicateGlyphLayer';duplicate.textContent='Duplicate';
  const remove=document.createElement('button');remove.className='btn compact danger';remove.id='btnDeleteGlyphLayer';remove.textContent='Delete';
  const actions=document.createElement('div');actions.className='palette-layer-foot';actions.append(add,duplicate,remove);groups.layers.append(actions);
  legacy.hidden=true;
  const placement=attachPaletteDragging({
    palette:byId('editorPaletteWindow'),
    header:byId('editorPaletteDragHandle'),
    container:byId('pane-glyph')
  });
  let active=null;
  const show=id=>{
    active=id===active?null:id;
    for(const [name,g] of Object.entries(groups))g.hidden=name!==active;
    byId('editorPaletteWindow').hidden=!active;
    if(active) placement.reposition();
    byId('editorPaletteTitle').textContent=captions[active]||'Tools';
    const paletteHelp=byId('btnPaletteHelp');if(paletteHelp){paletteHelp.href='./file-maker/help/guide.html#'+(helpTargets[active]||'overview');paletteHelp.setAttribute('aria-label','Help: '+(captions[active]||'Font Maker'));}
    for(const b of document.querySelectorAll('[data-palette]'))b.setAttribute('aria-expanded',String(b.dataset.palette===active));
    try{localStorage.setItem(PALETTE_KEY,active||'closed');}catch(_){/* browser policy */}
    if(active==='layers')renderLayers();
  };
  for(const button of document.querySelectorAll('[data-palette]'))button.addEventListener('click',()=>show(button.dataset.palette));
  byId('btnHidePalette').onclick=()=>show(active);
  byId('btnCloseAllPalettes').onclick=()=>{if(active)show(active);};
  const defaultPalette=(()=>{try{return localStorage.getItem(PALETTE_KEY);}catch(_){return null;}})();
  if(defaultPalette&&groups[defaultPalette])show(defaultPalette);
  return {show,refresh:()=>{if(active==='layers')renderLayers();},current:()=>active};
}
