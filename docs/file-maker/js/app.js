import {ARTBOARD_WIDTH,ARTBOARD_HEIGHT,fitScale,clampOffset,zoomAt,artboardPoint} from './canvas-view.js';
import {DEFAULT_GRID_SPACING,GRID_STORAGE_KEY,normalizeGridSpacing,snapGridPoint,shouldSnapDrawingTool,drawGridOverlay} from './editor-grid.js?v=0.3.51';
import {computeEditorShift,fontToPixel} from './font-coordinates.js';
import {referenceSilhouettePixels} from './reference-silhouette.js';
import {loadFairfaxReferenceFont,referenceGlyphBounds} from './reference-fonts.js?v=0.3.41.1';
import {validTokiPonaCustomName} from './toki-pona-name.js';
import {svgFromTrace} from './tracer.js';
import {makeBezierAnchor,moveBezierAnchor,dragBezierTangent,dragBezierClosingTangent,bezierPath,bezierDraftPath,combineGlyphPaths,inferRasterPath} from './bezier.js?v=0.3.42.2';
import {applyDraftPoint,saveDraft,readDraft} from './bezier-history.js';
import {automaticBezierRole} from './bezier-auto-hole.js?v=0.3.42.2';
import {bezierRadiusOnCanvas,closingBezierAnchor,hitBezierNode} from './bezier-hit.js?v=0.3.41.close1';
import {selectionRect as makeSelectionRect,nonemptySelection,chosenContourIndices,translateContour,classifyContour,translatedRect,contourBounds,polygonBounds,pointInPolygon,contourWithinPolygon,movePolygon} from './glyph-selection.js';
import {shapeBounds,shapeContours,curveContour,affineContour,affineRotate,affineScale,rectAfterTransform,smoothStroke,recogniseStroke} from './drawing-tools.js?v=0.3.52.0';
import {DEFAULT_DRAWING_PREFERENCES,normalizeDrawingPreferences,shapeFromCenter} from './drawing-preferences.js?v=0.3.53.0';
import {smoothRasterInk,smoothBezierOutline,rasterInkContours,selectionSmoothingWeights,blendSelectedRasterSmoothing,smoothSelectedBezierOutline} from './outline-smoothing.js?v=0.3.42.2';
import {drawBrushGeometry,drawSquareBrushGeometry,brushSvgPath,vectorBrushFootprint,rasterizeVectorsCrossedByEraser,rasterizeVectorsCrossedByMask} from './vector-eraser.js?v=0.3.53.0';
import {defaultCurveBend,curveBendFromPointer,curveControlPoint} from './curve-guides.js';
import {isStroke,newStroke,addSegment,strokeEndpoints,strokeNodeHit,smoothStrokeJunction,strokeBendHit,nearestStrokeBody,segmentBend,setSegmentBend,joinOpenStrokes,closeOpenStroke} from './connected-strokes.js?v=0.3.53.0';
import {historyGlyphIndex,historyWouldSwitchGlyph} from './history-navigation.js';
import {enclosedFillPixels,selectedFillPixels,fillWithAntialiasFringe,FILL_INK_ALPHA} from './fill-regions.js?v=0.3.41.aa1';
import {resizeSelectedInk,offsetSelectedContour} from './selection-width.js?v=0.3.42.2';
import {selectionHandlePoints,hitSelectionHandle,hitSelectionBody,resizeSelectionByHandle,transformSelectionPolygon,SELECTION_HANDLE_CURSORS} from './selection-handles.js?v=0.3.41.2';
import {importedGlyphContours} from './imported-outline.js?v=0.3.42.2';
import {initializeGeometry,traceGlyph,usingWasm,compileBoth,inspectImportedFont,inspectAttachmentGeometry} from './wasm-bridge.js?v=0.3.41.1';
import {listProjects,loadProject,saveWorkspace,loadProjectHistory,deleteProject} from './storage.js';
import {makeZip} from './zip.js';
import {useFontOnThisSite,getSiteFontForProject} from './site-font-publisher.js?v=0.3.41';
import {createPortableFontPairZip,readPortableFontPairZip} from './portable-font-pair.js?v=0.3.41';
import {readPortableFontProjectZip} from './portable-project-import.js?v=0.3.41';
import {verifyPortableFontPairFaces} from './portable-font-validity.js?v=0.3.41';
import {inspectProjectQuality} from './font-quality.js?v=0.3.50';
import {typographyOf,checkTypography,isProtectedSpacingSlot,setGlyphMetrics,setKerningPair,resolveKerningPairs} from './font-typography.js?v=0.3.50';
import {fontHasCodepoint,registerFont,rasterizeFontGlyph,rasterizeFontGlyphAligned} from './font-import.js';
import {compoundPreviewKind,compoundPreviewStatus} from './compound-preview.js';
import {normalizeImportedFont} from './otf-to-ttf.js';
import {mapImportedLigaturesToUcsur} from './ucsur-ligature-import.js';
import {IMPORT_ACK,defaultLicensing,fontNameMetadata,evaluateExport,licenceFiles,readLicenceDocument} from './licensing.js';
import {ensureGlyphLayers,activeLayer,layerCanEdit,selectLayer,addLayer,duplicateLayer,removeLayer,moveLayer,updateLayer,updateLayerPath,otherLayerPaths,compositeLayerPath,hasCompositingModes,rawExportLayerPaths,originalVisibleLayerPaths,LAYER_MODES} from './glyph-layers.js?v=0.3.48.0';
import {setupEditorPalettes} from './editor-palettes.js?v=0.3.43.0';
import {createLinkedComponentLayer,normalizeComponent,resolveLinkedGlyphPaths,linkedDependents,transformSvgPath,hasLinkedComponents} from './linked-components.js?v=0.3.48.0';
import {initializeEditorGeometry,analyzeContours,editorGeometryStatus,adjustBezierNode,validateGlyphContours,splitEditableBezier,addContourExtrema} from './editor-wasm.js?v=0.3.46.0';
import {booleanPaths,regularizeSelfIntersections} from './vector-boolean.js?v=0.3.45.0';
import {cleanContoursExact,findTinySpikes,removeTinySpikes,findTinyBezierLoops,removeTinyBezierLoop} from './contour-repair.js?v=0.3.46.0';
import {deleteBezierNode,splitStrokeAtNode,simplifyPolygonNodes,nearestContourSegment} from './vector-path-tools.js?v=0.3.44.0';
import {editableObjectBounds,hitEditableObject} from './object-selection.js?v=0.3.48.0';
import {resolveLayerEffects,previewLayerEffectChange,makeRectangleClip,makePolygonClip,EFFECT_OPERATIONS} from './layer-effects.js?v=0.3.48.0';

const $=id=>document.getElementById(id);
let storageAvailable=true;
let slots=[],projects=[],project=null,slotIndex=0,tool='pen',drawing=false,startPoint=null,activeTab='glyph',filtered='all';
let glyphCategory='all';
let history=[],redoStack=[],historyActionBusy=false,historyNavigationPending=false,saveTimer=0,traceTimer=0,canvasZoom=1,importedFamily=null,pendingSave=Promise.resolve();
let canvasFit=1,canvasScale=1,canvasOffset={x:0,y:0},fitMode=true,viewportReady=false,panDrag=null,spacePan=false;
let strokeBefore=null,strokeStartRaster=null,strokeBaseCanvas=null,strokePoints=[],strokeAnchor=null,strokeEnd=null,strokeConstrain=false,curvePending=null,compoundDragBefore=null;
let strokeFromCenter=false,displayedDrawingProject=null;
let strokeJoinStart=null,strokeInteraction=null,selectedStroke=-1,joinEndpoints=[];
let expandedEditor=false;
let editorPaletteManager=null;
let gridSpacing=DEFAULT_GRID_SPACING,snapToGrid=false;
let outlineValidationMarkers=[];
let bezierDraft=[],bezierInteraction=null,bezierHover=null,selectedBezierContour=-1,selectedBezierNode=-1,bezierPreview=false;
// The compiled preview fonts are memory-only; never store blobs in IndexedDB.
let compiledPreview=null,previewRevision=0,previewBuildSerial=0,previewBusy=false;
// Adjustment changes retain the previous visible font until replacement faces
// have loaded; a single build at a time always uses a project snapshot.
let keepPreviewOnGeometryChange=false;
let previewAdjusterTimer=0,previewAdjusterNeedsRebuild=false;
let previewAdjusterStart=null;
const previewFaces=[];
let fontActionBusy=false;
function setFontActionBusy(value){
  fontActionBusy=!!value;
  for(const id of ['btnBuildFonts','btnUseOnSite','btnImportFontZip']){const button=$(id);if(button)button.disabled=fontActionBusy||(id!=='btnBuildFonts'&&!storageAvailable);}
}

function invalidateCompiledPreview(){
  previewRevision++;
  if(compiledPreview && !keepPreviewOnGeometryChange){compiledPreview=null;showPreviewState();}
}
function clearCompiledPreview(){
  clearTimeout(previewAdjusterTimer);
  previewAdjusterStart=null;
  previewAdjusterNeedsRebuild=false;
  keepPreviewOnGeometryChange=false;
  previewBuildSerial++;
  compiledPreview=null;
  while(previewFaces.length){const face=previewFaces.pop();try{document.fonts.delete(face);}catch(_){}}
  showPreviewState();
}
let importedCmapCache=new Map();
let deletingProject=false;
let marquee=null,selection=null,selectionDrag=null,selectionClipboard=null,marqueePolygon=null,selectionPolygon=null;
// Optional object-level selection; null retains the original marquee semantics.
let selectedObjectIndices=null,isolatedLayerId=null;
let selectedWidthSession=null,selectedWidthStart=9;
const MAX_HISTORY_BYTES=16*1024*1024,MAX_HISTORY_ACTIONS=250;
let compoundKey=null,compoundSelection=0,compDragging=false,compLast=null;
const compoundReferencePreviews=new Map();
const canvas=$('glyphCanvas'),ctx=canvas.getContext('2d',{willReadFrequently:true});
const DEFAULT_BRUSH=9;
// One-time, user-initiated licence acknowledgement before each source-font file selection.
// This is a workflow confirmation, not a technical or legal licence verification.
const FONT_LICENCE_ACK_TEXT = IMPORT_ACK;
let fontImportAcknowledged = false;
let pendingImportLicences = [];
let importAcknowledgement = null;
function status(msg,isError=false){$('statusText').textContent=msg;$('statusText').style.color=isError?'#b23b30':'';}
function saveStatus(msg){$('saveLabel').textContent=msg;}
function uid(){return globalThis.crypto?.randomUUID?.()||`project-${Date.now()}-${Math.random().toString(36).slice(2)}`;}
function cloned(v){return v==null?null:structuredClone(v);}
function recordChange(target,key,before,after,details=null){
  if(['glyph','selectedWidth','selectionFill','selectionErase','selectionSmooth','selectionTransform'].includes(target)&&project?.glyphs?.[key]?.layerStack){
    updateLayerPath(project.glyphs[key],project);after=project.glyphs[key];
  }
  const a=cloned(before),b=cloned(after);
  if(JSON.stringify(a)===JSON.stringify(b))return;
  if(target!=='selectedWidth'){selectedWidthSession=null;selectedWidthStart=brushWidth();}
  const change={target,key,before:a,after:b,...(details||{})};
  const size=JSON.stringify(change).length*2;
  if(size>MAX_HISTORY_BYTES){history=[];redoStack=[];status('The operation exceeded the undo-memory budget; it was saved as a new checkpoint.');saveSoon();return;}
  history.push(change);redoStack=[];
  let bytes=history.reduce((n,c)=>n+JSON.stringify(c).length*2,0);
  while(history.length>MAX_HISTORY_ACTIONS||bytes>MAX_HISTORY_BYTES){const old=history.shift();bytes-=JSON.stringify(old).length*2;}
  if(project&&linkedDependents(project,key).length){
    try{resolveLinkedGlyphPaths(project,{commit:true});}
    catch(error){status('Linked component needs attention: '+String(error.message||error),true);}
  }
  invalidateCompiledPreview();saveSoon();
  return change;
}
async function applyChange(change,direction){
  const data=cloned(change[direction]);
  if(change.target==='glyphWithLicences'){
    if(data.glyph==null){if(linkedDependents(project,change.key).length)project.glyphs[change.key]={modified:false};else delete project.glyphs[change.key];}else project.glyphs[change.key]=data.glyph;
    project.licensing||=defaultLicensing();project.licensing.documents=data.documents||[];
    await selectGlyph(Number(change.key));
  }else if(change.target==='glyph'){
    if(data==null){if(linkedDependents(project,change.key).length)project.glyphs[change.key]={modified:false};else delete project.glyphs[change.key];}else project.glyphs[change.key]=data;
    if(project&&hasLinkedComponents(project))resolveLinkedGlyphPaths(project,{commit:true});
    await selectGlyph(Number(change.key));
  }else if(change.target==='selectedWidth'){
    if(data==null){if(linkedDependents(project,change.key).length)project.glyphs[change.key]={modified:false};else delete project.glyphs[change.key];}else project.glyphs[change.key]=data;
    selectedWidthSession=null;
    await selectGlyph(Number(change.key));
    selection=cloned(change.selection);selectionPolygon=cloned(change.selectionPolygon);
    $('brushSize').value=direction==='before'?change.initialWidth:change.finalWidth;
    $('brushSizeLabel').textContent=$('brushSize').value;
    selectedWidthStart=brushWidth();
    setTool(change.selectionTool||'select');
    renderSelectionOverlay();refreshSelectionToolbar();
  }else if(change.target==='selectionFill'||change.target==='selectionErase'||change.target==='selectionSmooth'){
    if(data==null){if(linkedDependents(project,change.key).length)project.glyphs[change.key]={modified:false};else delete project.glyphs[change.key];}else project.glyphs[change.key]=data;
    await selectGlyph(Number(change.key));
    selection=cloned(change.selection);selectionPolygon=cloned(change.selectionPolygon);
    selectedWidthStart=brushWidth();setTool(change.selectionTool||'select');
    renderSelectionOverlay();refreshSelectionToolbar();
  }else if(change.target==='selectionTransform'){
    if(data==null){if(linkedDependents(project,change.key).length)project.glyphs[change.key]={modified:false};else delete project.glyphs[change.key];}else project.glyphs[change.key]=data;
    await selectGlyph(Number(change.key));
    selection=cloned(direction==='before'?change.beforeSelection:change.afterSelection);
    selectionPolygon=cloned(direction==='before'?change.beforePolygon:change.afterPolygon);
    selectedWidthStart=brushWidth();
    setTool(change.selectionTool||'select');
    renderSelectionOverlay();refreshSelectionToolbar();
  }else if(change.target==='compound'){
    if(data==null)delete project.compounds[change.key];else project.compounds[change.key]=data;
    renderCompound();renderOverrideList();
  }else if(change.target==='previewAdjustments'){
    project.settings.previewAdjustments=data;
    refreshPreviewAdjusters();
    keepPreviewOnGeometryChange=true;
    scheduleGeometryRebuild();
  }else if(change.target==='hinting'){
    project.settings.hinting=data;refreshHintingUI();
  }else if(change.target==='identity'){
    project.settings.fontIdentity=data;refreshIdentity();
  }else if(change.target==='typography'){
    project.settings.typography=data;refreshTypographyUI();
  }else if(change.target==='glyphBatch'){
    for(const [key,value] of Object.entries(data)){
      if(value==null){if(linkedDependents(project,key).length)project.glyphs[key]={modified:false};else delete project.glyphs[key];}else project.glyphs[key]=value;
    }
    await selectGlyph(slotIndex);
  }else if(change.target==='geometry'){
    project.settings.attachmentGeometry=data;refreshAttachmentUI();drawMetricGuides();await renderOriginalGuide();
  }else if(change.target==='bezierPoint'){
    const [slot,n]=change.key.split(':');
    project.editorDrafts||={};
    applyDraftPoint(project.editorDrafts,slot,Number(n),data);
    await selectGlyph(Number(slot));
  }else if(change.target==='bezierDraft'){
    project.editorDrafts||={};saveDraft(project.editorDrafts,change.key,data);
    await selectGlyph(Number(change.key));
  }else if(change.target==='bezierFinish'){
    project.editorDrafts||={};
    if(data.glyph==null){if(linkedDependents(project,change.key).length)project.glyphs[change.key]={modified:false};else delete project.glyphs[change.key];}else project.glyphs[change.key]=data.glyph;
    saveDraft(project.editorDrafts,change.key,data.draft);
    await selectGlyph(Number(change.key));
  }
  saveSoon();renderCompiledPreview();
}

function escapeHtml(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function capCp(cp){return Number.isInteger(Number(cp))&&cp!=null?`U+${Number(cp).toString(16).toUpperCase()}`:'Unassigned';}
function glyphLibraryName(slot,index,entry=slot){
  if(index===120)return 'Cartouche left [';
  if(index===121)return 'Cartouche right ]';
  if(index===137)return 'Long-pi start pi(';
  return entry.word||slot.word||`custom-${index+1}`;
}
const BLANK_ATTACH={cartoucheTop:1740,cartoucheBottom:300,cartoucheStroke:28,longPiTop:328,longPiBottom:300,
  hasCartoucheMeasurement:false,hasLongPiMeasurement:false,glyphBounds:{},warnings:[]};
function attachmentGeometry(){return project?.settings?.attachmentGeometry||project?.sourceFont?.attachmentGeometry||BLANK_ATTACH;}
// Reference bounds are ephemeral editor data, never added to saved projects.
// The project key keeps fallback placement separate from imported source fonts.
const fairfaxReferenceBounds=new Map();
function editorShiftFor(i=slotIndex){
  const saved=project?.glyphs?.[i];if(saved?.editorShift)return saved.editorShift;
  // Existing edited projects used the historical coordinate origin: do not
  // silently shift their previously authored paths during migration.
  if(saved?.modified)return {x:0,y:0};
  const sourceBounds=project?.sourceFont?.attachmentGeometry?.glyphBounds?.[String(slots[i]?.codepoint)];
  const bounds=sourceBounds||fairfaxReferenceBounds.get(`${project?.id}:${i}`);
  if(!bounds)return {x:0,y:0};
  return computeEditorShift(bounds,ARTBOARD_WIDTH,ARTBOARD_HEIGHT);
}
function ensureEditorShift(entry,i=slotIndex){
  if(!entry.editorShift)entry.editorShift=editorShiftFor(i);
  return entry;
}
function fontYToCanvas(y){return fontToPixel(0,y,editorShiftFor()).y;}
function refreshAttachmentUI(){
  const panel=$('attachmentPanel');if(!panel||!project)return;
  const relevant=[120,121,124,137].includes(slotIndex);panel.hidden=!relevant;
  if(!relevant)return;const p=attachmentGeometry();
  for(const [id,key] of [['attachCartTop','cartoucheTop'],['attachCartBottom','cartoucheBottom'],['attachCartStroke','cartoucheStroke'],
    ['attachPiTop','longPiTop'],['attachPiBottom','longPiBottom']])$(id).value=Math.round(p[key]);
  $('attachmentNotice').textContent=project?.sourceFont?
    (!p.hasCartoucheMeasurement||!p.hasLongPiMeasurement
      ? 'The imported font does not define measurable UCSUR cartouche/long-pi extensions. These coordinates are reference guides only; the exported TTF generates its own cartouche and long-pi rails using the Rails & spacing controls.'
      : 'Source attachment measurements are shown as reference guides. Exported cartouches and long-pi use the Rails & spacing controls.'):
    'Reference attachment guides. Exported cartouches and long-pi use the Rails & spacing controls.';
}
function saveAttachmentGeometry(){
  const old=project.settings.attachmentGeometry||null;
  const source=attachmentGeometry();const p={...source};
  for(const [id,key] of [['attachCartTop','cartoucheTop'],['attachCartBottom','cartoucheBottom'],['attachCartStroke','cartoucheStroke'],
    ['attachPiTop','longPiTop'],['attachPiBottom','longPiBottom']]){
    p[key]=Number($(id).value);if(!Number.isFinite(p[key])||Math.abs(p[key])>12000){status('Attachment positions must be finite font units.',true);return;}
  }
  if(p.cartoucheTop<=p.cartoucheBottom+p.cartoucheStroke||p.cartoucheStroke<1||p.cartoucheStroke>512||p.longPiTop<=p.longPiBottom){
    status('Invalid attachment geometry: upper edges must exceed lower edges and stroke width must be 1–512 units.',true);return;
  }
  p.geometryConfirmed=true;project.settings.attachmentGeometry=p;
  recordChange('geometry','attachmentGeometry',old,p);drawMetricGuides();refreshAttachmentUI();saveSoon();
  status('Reference attachment positions saved. Exported cartouche/long-pi geometry is controlled by Rails & spacing.');
}
function defaultIdentity(name,id){return {family:name,style:'Regular',version:'1.0.0',postScriptName:(name.replace(/[^a-zA-Z0-9-]/g,'').slice(0,47)||'SitelenPona')+'-Regular',projectId:id};}
function newProject(name='Untitled font'){const id=uid();return {version:1,id,name,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),template:'sp-font-maker-v5',glyphs:{},compounds:{},editorDrafts:{},settings:{drawing:{...DEFAULT_DRAWING_PREFERENCES},fontIdentity:defaultIdentity(name,id),tallyPitch:10,tallyStroke:3,tallyPadding:8,fractionalScales:[1,.75,2/3,.5,1/3,.25],previewAdjustments:{fractionalVerticalAlignment:100,glyphPadding:0,cartoucheTop:1000,cartoucheBottom:-210,cartoucheStroke:80,cartoucheLeftStroke:80,cartoucheRightStroke:80,cartoucheEndHeight:100,cartoucheEndY:0,cartoucheLeftX:0,cartoucheRightX:0,cartoucheEdgePadding:0,cartoucheContentOffset:0,longPiStartHeight:100,longPiStartY:0,longPiStartX:0,ordinaryPiStroke:80,longPiStroke:80,longPiRounded:false,tallyLength:250,tallyY:0,tallySpacing:160,verticalPaddingTop:0,verticalPaddingBottom:0}},sourceFont:null,licensing:defaultLicensing()};}
function identity(){if(!project.settings)project.settings={};if(!project.settings.fontIdentity)project.settings.fontIdentity=defaultIdentity(project.name,project.id);return project.settings.fontIdentity;}
function refreshIdentity(){if(!project)return;const i=identity();for(const [key,id] of [['family','fontFamily'],['style','fontStyle'],['version','fontVersion'],['postScriptName','fontPostScript'],['projectId','fontProjectId']])$(id).value=i[key]||'';}
function saveIdentity(){if(!project)return false;
  const family=$('fontFamily').value.trim(),style=$('fontStyle').value.trim(),version=$('fontVersion').value.trim(),postScriptName=$('fontPostScript').value.trim(),projectId=$('fontProjectId').value.trim();
  if(!family||family.length>90||!style||!/^[a-zA-Z0-9.-]{1,32}$/.test(version)||!/^[a-zA-Z0-9_-]{1,55}$/.test(postScriptName)||!projectId||projectId.length>128){status('Font identity invalid: supply a family, style, version, PostScript name and project ID.',true);return false;}
  const before=cloned(project.settings.fontIdentity);project.settings.fontIdentity={family,style,version,postScriptName,projectId};recordChange('identity','fontIdentity',before,project.settings.fontIdentity);saveSoon();status('Font identity saved in project');return true;
}
// Typography editing lives in its own Metrics & kerning workspace.
// This changes only font table data, never the editable glyph geometry.
function typographyOptions(){return slots.map(s=>`<option value="${s.index}">${escapeHtml(glyphLibraryName(s,s.index,s))}</option>`).join('');}
function typographySlotName(i){return glyphLibraryName(slots[i],i,slots[i]);}
function refreshTypographyUI(){
 if(!project||!slots.length||!$('typoGlyph'))return;
 const ids=['typoGlyph','typoLeft','typoRight'];
 for(const id of ids){const el=$(id);if(el.options.length!==slots.length){const keep=el.value;el.innerHTML=typographyOptions();el.value=keep||String(slotIndex);}}
 const data=typographyOf(project),id=$('typoGlyph').value||String(slotIndex);
 const metric=data.glyphs[id]||{};
 $('typoAdvance').value=metric.advance??'';$('typoBearing').value=metric.leftBearing??'';
 const s=slots[Number(id)],protectedSlot=isProtectedSpacingSlot(s);
 $('typoAdvance').disabled=protectedSlot;$('typoBearing').disabled=protectedSlot;
 $('btnSaveGlyphMetrics').disabled=protectedSlot;$('btnResetGlyphMetrics').disabled=protectedSlot;
 $('typoGlyphStatus').textContent=protectedSlot?'Structural cartouche/spacing glyph — metrics are protected.':'Blank means keep native width or bearing. Set both independently.';
 const pair=data.pairs[`${$('typoLeft').value}:${$('typoRight').value}`];
 $('typoPairValue').value=pair??0;
 const classes=Object.keys(data.classes).sort();
 for(const id of ['typoClassLeft','typoClassRight']){
  const el=$(id),old=el.value;el.replaceChildren();
  for(const name of classes){const option=new Option(name,name);el.appendChild(option);}
  if(classes.includes(old))el.value=old;
 }
 renderTypographyProof();renderLiveTypographyDiagrams();
}
function renderTypographyProof(){
 if(!project||!$('typoProof'))return;
 const a=slots[Number($('typoLeft').value)],b=slots[Number($('typoRight').value)],proof=$('typoProof');
 proof.replaceChildren();
 if(!a||!b)return;
 const cps=[a.codepoint,b.codepoint];
 proof.textContent=cps.every(cp=>Number.isInteger(cp))?String.fromCodePoint(...cps):`${a.word} ${b.word}`;
 proof.style.fontSize='62px';
 proof.style.fontFamily=compiledPreview?.normal?`"${compiledPreview.normal}"`:'sans-serif';
 $('typoProofStatus').textContent=compiledPreview?.normal?'Showing last compiled Ligatures TTF; adjust values, then rebuild preview fonts to see the change.':'Build preview fonts to proof actual TTF kerning; this text is not a geometry simulation.';
}
// Immediate, non-destructive metric/kerning diagram. Source-font native metrics
// are not available to JS: unspecified values use a clearly labelled schematic
// reference, not an invented measurement of the exported font.
const TYPO_SVG_NS='http://www.w3.org/2000/svg';
function typographySvgNode(svg,tag,attrs={},label=''){
 const node=document.createElementNS(TYPO_SVG_NS,tag);
 for(const [name,value] of Object.entries(attrs))node.setAttribute(name,String(value));
 if(label)node.textContent=label;
 svg.appendChild(node);return node;
}
function typographyDiagram(svg){svg.replaceChildren();
 typographySvgNode(svg,'line',{x1:22,y1:120,x2:695,y2:120,stroke:'#9aa4b4','stroke-dasharray':'5 4'});
}
function typographyDraftInt(id,stored,fallback,min,max){
 const raw=$(id).value.trim();
 if(!raw)return {value:stored??fallback,approx:stored==null};
 const n=Number(raw);return Number.isInteger(n)&&n>=min&&n<=max?{value:n,approx:false}:{value:fallback,approx:true,invalid:true};
}
function typographySampleCharacter(i){
 const slot=slots[Number(i)];if(!slot)return '?';
 return Number.isInteger(slot.codepoint)?String.fromCodePoint(slot.codepoint):(slot.word||'?');
}
function renderLiveTypographyDiagrams(){
 if(!project||!slots.length)return;
 const t=typographyOf(project),metricSlot=$('typoGlyph').value||String(slotIndex);
 const native=t.glyphs[metricSlot]||{};
 const advance=typographyDraftInt('typoAdvance',native.advance,650,0,65535);
 const bearing=typographyDraftInt('typoBearing',native.leftBearing,60,-32768,32767);
 const m=$('typoMetricsDiagram');
 if(m){
  typographyDiagram(m);
  // Scale the diagram to the selected advance without pretending to measure ink width.
  const scale=Math.min(.56,560/Math.max(700,advance.value+Math.max(0,bearing.value)));
  const x=78,edge=x+advance.value*scale,inkStart=x+bearing.value*scale;
  const safeEnd=Math.max(inkStart+6,Math.min(inkStart+390*scale,685));
  typographySvgNode(m,'rect',{x:inkStart,y:52,width:Math.max(4,safeEnd-inkStart),height:67,rx:4,fill:'#b8a3d5',opacity:.58});
  for(const [at,color] of [[x,'#3579a4'],[edge,'#3579a4'],[inkStart,'#874ca5']])typographySvgNode(m,'line',{x1:at,y1:33,x2:at,y2:130,stroke:color,'stroke-width':2});
  typographySvgNode(m,'line',{x1:x,y1:24,x2:edge,y2:24,stroke:'#3579a4','stroke-width':2});
  typographySvgNode(m,'text',{x,y:16,'font-size':13,fill:'currentColor'},'Advance '+advance.value+(advance.approx?' (example)':''));
  typographySvgNode(m,'text',{x:inkStart,y:145,'font-size':13,fill:'currentColor'},'Left bearing '+bearing.value+(bearing.approx?' (example)':''));
  typographySvgNode(m,'text',{x:470,y:164,'font-size':12,fill:'currentColor'},'Illustrative ink box, not measured outline');
  $('typoMetricsLiveStatus').textContent=(advance.invalid||bearing.invalid?'Invalid draft value. ':'')+
   ((advance.approx||bearing.approx)?'Unspecified native metrics are represented by example values. ':'')+
   'Diagram updates as you type; Save spacing persists the override.';
 }
 const a=$('typoLeft').value,b=$('typoRight').value;
 const pairInput=typographyDraftInt('typoPairValue',t.pairs[`${a}:${b}`]??0,0,-32768,32767);
 const leftMetric=t.glyphs[a]||{},rightMetric=t.glyphs[b]||{};
 const leftWidth=leftMetric.advance??650,rightWidth=rightMetric.advance??650;
 const pair=$('typoPairDiagram');if(!pair)return;
 typographyDiagram(pair);
 const scale=Math.min(.35,500/Math.max(1300,leftWidth+rightWidth+Math.max(0,pairInput.value)));
 const x1=85,x2=x1+(leftWidth+pairInput.value)*scale;
 const width1=Math.max(4,Math.min(390,leftWidth*scale)),width2=Math.max(4,Math.min(390,rightWidth*scale));
 for(const [x,w,fill,char] of [[x1,width1,'#a8c8e2',typographySampleCharacter(a)],[x2,width2,'#d4b9e6',typographySampleCharacter(b)]]){
  typographySvgNode(pair,'rect',{x,y:42,width:w,height:85,fill,opacity:.43,stroke:'#718096'});
  typographySvgNode(pair,'text',{x:x+Math.max(3,w/2),y:107,'font-size':40,'text-anchor':'middle',fill:'#29252f','font-family':compiledPreview?.normal||'sans-serif'},char);
  typographySvgNode(pair,'line',{x1:x,y1:34,x2:x,y2:133,stroke:'#347aa6','stroke-width':2});
 }
 typographySvgNode(pair,'text',{x:85,y:20,'font-size':14,fill:'currentColor'},'Kerning adjustment: '+pairInput.value+' font units');
 typographySvgNode(pair,'text',{x:85,y:157,'font-size':12,fill:'currentColor'},'Separate glyph cells illustrate the spacing shift, not shaped TTF output');
 $('typoPairLiveStatus').textContent=(pairInput.invalid?'Invalid draft adjustment. ':'')+
  ((leftMetric.advance==null||rightMetric.advance==null)?'Missing native advances use 650-unit example widths. ':'')+
  'Pair diagram updates as you type; Save pair persists the override.';
}
function parseOptionalFontInteger(id,lo,hi){
 const raw=$(id).value.trim();if(!raw)return null;
 const value=Number(raw);
 if(!Number.isInteger(value)||value<lo||value>hi)throw Error(`${id} must be an integer from ${lo} to ${hi}`);
 return value;
}
function editTypography(fn,message){
 try{
  const before=cloned(typographyOf(project)),after=structuredClone(before);
  fn(after);checkTypography(after,slots);
  project.settings.typography=after;
  recordChange('typography','typography',before,after);
  refreshTypographyUI();status(message);
 }catch(error){status('Spacing/kerning unchanged: '+String(error?.message||error),true);refreshTypographyUI();}
}
function wireTypographyControls(){
 $('btnRefreshMetricsProof').onclick=()=>buildPreviewFonts();
 $('typoGlyph').onchange=refreshTypographyUI;
 $('btnOpenCurrentMetrics').onclick=()=>{$('typoGlyph').value=String(slotIndex);refreshTypographyUI();};
 for(const id of ['typoAdvance','typoBearing','typoPairValue'])$(id).addEventListener('input',renderLiveTypographyDiagrams);
 for(const id of ['typoLeft','typoRight'])$(id).onchange=refreshTypographyUI;
 $('btnSaveGlyphMetrics').onclick=()=>{
  const slot=Number($('typoGlyph').value);
  editTypography(t=>setGlyphMetrics(t,slot,parseOptionalFontInteger('typoAdvance',0,65535),parseOptionalFontInteger('typoBearing',-32768,32767)),`Spacing saved for ${typographySlotName(slot)}.`);
 };
 $('btnResetGlyphMetrics').onclick=()=>{const id=Number($('typoGlyph').value);editTypography(t=>setGlyphMetrics(t,id,null,null),'Original spacing restored.');};
 $('btnSavePairKern').onclick=()=>{
  const a=Number($('typoLeft').value),b=Number($('typoRight').value);
  editTypography(t=>setKerningPair(t,a,b,parseOptionalFontInteger('typoPairValue',-32768,32767)),'Pair kerning saved.');
 };
 $('btnRemovePairKern').onclick=()=>editTypography(t=>setKerningPair(t,$('typoLeft').value,$('typoRight').value,null),'Pair kerning removed.');
 $('btnSaveKernClass').onclick=()=>{
  const name=$('typoClassName').value.trim(),tokens=$('typoClassMembers').value.split(',').map(x=>x.trim()).filter(Boolean);
  editTypography(t=>{
   const members=tokens.map(token=>{if(/^[0-9]+$/.test(token))return Number(token);
     const matches=slots.filter(s=>s.word===token);if(matches.length!==1)throw Error(`Ambiguous/unknown glyph ${token}`);return matches[0].index;
   });
   t.classes[name]=members;
  },`Class ${name} saved.`);
 };
 $('btnRemoveKernClass').onclick=()=>{
  const name=$('typoClassName').value.trim();editTypography(t=>{
   delete t.classes[name];for(const key of Object.keys(t.classPairs))if(key.split(':').includes(name))delete t.classPairs[key];
  },`Class ${name} removed.`);
 };
 $('btnSaveClassPair').onclick=()=>{
  const a=$('typoClassLeft').value,b=$('typoClassRight').value;
  editTypography(t=>{if(!a||!b)throw Error('Create classes first');const v=parseOptionalFontInteger('typoClassValue',-32768,32767);if(!v)delete t.classPairs[`${a}:${b}`];else t.classPairs[`${a}:${b}`]=v;
   resolveKerningPairs(t,slots.length);
  },'Class pair kerning saved.');
 };
 $('btnRemoveClassPair').onclick=()=>editTypography(t=>{delete t.classPairs[`${$('typoClassLeft').value}:${$('typoClassRight').value}`];},'Class pair removed.');
}
function customManifest(p=project){const mappings={};for(const s of slots.filter(s=>s.customSlot)){const g=p.glyphs[s.index]||{};const name=(g.word||s.word).trim();if(!name.startsWith('custom-'))mappings[name]=`U+${s.codepoint.toString(16).toUpperCase()}`;}
 return {schema:'sp-font-maker-custom-names-v1',fontFamily:p.settings.fontIdentity.family,projectId:p.settings.fontIdentity.projectId,mappings};
}
function exportRegistry(){download(new Blob([JSON.stringify(customManifest(),null,2)],{type:'application/json'}),`${safename(identity().projectId)}-custom-unicode.json`);status('Custom-name manifest exported');}
function hintMode(){return project?.settings?.hinting?.rasterization||'neutral';}
function refreshHintingUI(){const select=$('hintRasterization');if(select)select.value=hintMode();}
function setHintMode(mode){
  if(!['neutral','grayscale','gridfit'].includes(mode))return;
  const before=cloned(project.settings.hinting||{rasterization:'neutral'});
  project.settings.hinting={rasterization:mode};
  recordChange('hinting','rasterization',before,project.settings.hinting);
  showPreviewState();
}
const DEFAULT_PREVIEW_ADJUSTMENTS=Object.freeze({fractionalVerticalAlignment:100,glyphPadding:0,cartoucheTop:1000,cartoucheBottom:-210,cartoucheStroke:80,cartoucheLeftStroke:80,cartoucheRightStroke:80,cartoucheEndHeight:100,cartoucheEndY:0,cartoucheLeftX:0,cartoucheRightX:0,cartoucheEdgePadding:0,cartoucheContentOffset:0,longPiStartHeight:100,longPiStartY:0,longPiStartX:0,ordinaryPiStroke:80,longPiStroke:80,longPiRounded:false,tallyLength:250,tallyY:0,tallySpacing:160,verticalPaddingTop:0,verticalPaddingBottom:0});
function previewAdjustments(){
  if(!project)return {...DEFAULT_PREVIEW_ADJUSTMENTS};
  project.settings||={};
  const value=project.settings.previewAdjustments||{};
  const alignment=Number(value.fractionalVerticalAlignment);
  const padding=Number(value.glyphPadding);
  const top=Number(value.cartoucheTop),bottom=Number(value.cartoucheBottom),stroke=Number(value.cartoucheStroke);
  const endHeight=Number(value.cartoucheEndHeight),endY=Number(value.cartoucheEndY),leftX=Number(value.cartoucheLeftX),rightX=Number(value.cartoucheRightX);
  const leftStroke=Number(value.cartoucheLeftStroke),rightStroke=Number(value.cartoucheRightStroke);
  const edgePadding=Number(value.cartoucheEdgePadding),contentOffset=Number(value.cartoucheContentOffset);
  const piHeight=Number(value.longPiStartHeight),piY=Number(value.longPiStartY),piX=Number(value.longPiStartX);
  const ordinaryPiStroke=Number(value.ordinaryPiStroke),longPiStroke=Number(value.longPiStroke);
  const tallyLength=Number(value.tallyLength),tallyY=Number(value.tallyY),tallySpacing=Number(value.tallySpacing);
  const padTop=Number(value.verticalPaddingTop),padBottom=Number(value.verticalPaddingBottom);
  return {
    fractionalVerticalAlignment:Number.isFinite(alignment)?Math.max(0,Math.min(100,alignment)):100,
    glyphPadding:Number.isFinite(padding)?Math.max(0,Math.min(200,padding)):0,
    cartoucheTop:Number.isFinite(top)?Math.max(500,Math.min(1800,top)):1000,
    cartoucheBottom:Number.isFinite(bottom)?Math.max(-900,Math.min(200,bottom)):-210,
    cartoucheStroke:Number.isFinite(stroke)?Math.max(15,Math.min(240,stroke)):80,
    cartoucheLeftStroke:Number.isFinite(leftStroke)?Math.max(20,Math.min(240,leftStroke)):80,
    cartoucheRightStroke:Number.isFinite(rightStroke)?Math.max(20,Math.min(240,rightStroke)):80,
    cartoucheEndHeight:Number.isFinite(endHeight)?Math.max(50,Math.min(190,endHeight)):100,
    cartoucheEndY:Number.isFinite(endY)?Math.max(-800,Math.min(800,endY)):0,
    cartoucheLeftX:Number.isFinite(leftX)?Math.max(-500,Math.min(500,leftX)):0,
    cartoucheRightX:Number.isFinite(rightX)?Math.max(-500,Math.min(500,rightX)):0,
    cartoucheEdgePadding:Number.isFinite(edgePadding)?Math.max(0,Math.min(300,edgePadding)):0,
    cartoucheContentOffset:Number.isFinite(contentOffset)?Math.max(-300,Math.min(300,contentOffset)):0,
    longPiStartHeight:Number.isFinite(piHeight)?Math.max(35,Math.min(220,piHeight)):100,
    longPiStartY:Number.isFinite(piY)?Math.max(-800,Math.min(800,piY)):0,
    longPiStartX:Number.isFinite(piX)?Math.max(-500,Math.min(500,piX)):0,
    ordinaryPiStroke:Number.isFinite(ordinaryPiStroke)?Math.max(20,Math.min(240,ordinaryPiStroke)):80,
    longPiStroke:Number.isFinite(longPiStroke)?Math.max(20,Math.min(240,longPiStroke)):80,
    longPiRounded:value.longPiRounded===true,
    tallyLength:Number.isFinite(tallyLength)?Math.max(40,Math.min(700,tallyLength)):250,
    tallyY:Number.isFinite(tallyY)?Math.max(-600,Math.min(600,tallyY)):0,
    tallySpacing:Number.isFinite(tallySpacing)?Math.max(35,Math.min(400,tallySpacing)):160,
    verticalPaddingTop:Number.isFinite(padTop)?Math.max(0,Math.min(800,padTop)):0,
    verticalPaddingBottom:Number.isFinite(padBottom)?Math.max(0,Math.min(800,padBottom)):0
  };
}
function refreshPreviewAdjusters(){
  const value=previewAdjustments();
  const vertical=$('fractionalVerticalAlignment'),horizontal=$('glyphHorizontalPadding');
  if(vertical)vertical.value=String(value.fractionalVerticalAlignment);
  if(horizontal)horizontal.value=String(value.glyphPadding);
  if($('fractionalVerticalAlignmentValue')) $('fractionalVerticalAlignmentValue').textContent=`${value.fractionalVerticalAlignment}%`;
  if($('glyphHorizontalPaddingValue')) $('glyphHorizontalPaddingValue').textContent=`${value.glyphPadding}`;
  for(const [id,key] of [['cartoucheTop','cartoucheTop'],['cartoucheBottom','cartoucheBottom'],['cartoucheStroke','cartoucheStroke'],['cartoucheLeftStroke','cartoucheLeftStroke'],['cartoucheRightStroke','cartoucheRightStroke'],['cartoucheEndHeight','cartoucheEndHeight'],['cartoucheEndY','cartoucheEndY'],['cartoucheLeftX','cartoucheLeftX'],['cartoucheRightX','cartoucheRightX'],['cartoucheEdgePadding','cartoucheEdgePadding'],['cartoucheContentOffset','cartoucheContentOffset'],['longPiStartHeight','longPiStartHeight'],['longPiStartY','longPiStartY'],['longPiStartX','longPiStartX'],['ordinaryPiStroke','ordinaryPiStroke'],['longPiStroke','longPiStroke'],['tallyLength','tallyLength'],['tallyY','tallyY'],['tallySpacing','tallySpacing'],['verticalPaddingTop','verticalPaddingTop'],['verticalPaddingBottom','verticalPaddingBottom']]){
    if($(id))$(id).value=String(value[key]);
    if($(id+'Value'))$(id+'Value').textContent=String(value[key])+(id==='cartoucheEndHeight'||id==='longPiStartHeight'?'%':'');
  }
  if($('longPiRounded'))$('longPiRounded').checked=value.longPiRounded;
  refreshVerticalPaddingGauge(value);
}
// Compact typographic-space indicator. Derived from the FIXED native end/pi
// references and the selected tally envelope, not from any hidden rail coupling.
// Font-wide native metrics may impose a larger minimum than requested.
function refreshVerticalPaddingGauge(p){
  const capCentre=(1080-290)/2;
  const capHalfHeight=(1080+290)/2*p.cartoucheEndHeight/100;
  const capHigh=capCentre+capHalfHeight+p.cartoucheEndY;
  const capLow=capCentre-capHalfHeight+p.cartoucheEndY;
  const piHigh=-210+1200*p.longPiStartHeight/100+p.longPiStartY;
  const piLow=-290+p.longPiStartY;
  const tallyHigh=-375+p.tallyY+p.tallyLength/2;
  const tallyLow=-375+p.tallyY-p.tallyLength/2;
  const inkHigh=Math.max(p.cartoucheTop+p.cartoucheStroke,capHigh,piHigh,tallyHigh);
  const inkLow=Math.min(p.cartoucheBottom-p.cartoucheStroke,capLow,piLow,tallyLow);
  const ascent=Math.max(900,Math.ceil(inkHigh+p.verticalPaddingTop));
  const descent=Math.min(-300,Math.floor(inkLow-p.verticalPaddingBottom));
  const actualTop=ascent-inkHigh,actualBottom=inkLow-descent;
  const total=ascent-descent;
  const gauge=$('verticalPaddingGauge');
  if(gauge)gauge.setAttribute('aria-label',`Vertical space: ${Math.round(actualTop)} units above, ${Math.round(actualBottom)} below the cartouche and tally/long-pi envelope`);
  const topRect=$('verticalPaddingGaugeTop'),inkRect=$('verticalPaddingGaugeInk'),bottomRect=$('verticalPaddingGaugeBottom');
  if(topRect&&inkRect&&bottomRect&&total>0){
    const y=3,h=46;
    const first=y+h*actualTop/total;
    const second=y+h*(actualTop+inkHigh-inkLow)/total;
    topRect.setAttribute('y',String(y));topRect.setAttribute('height',String(Math.max(0,first-y)));
    inkRect.setAttribute('y',String(first));inkRect.setAttribute('height',String(Math.max(0,second-first)));
    bottomRect.setAttribute('y',String(second));bottomRect.setAttribute('height',String(Math.max(0,y+h-second)));
  }
  if($('verticalPaddingClearanceTop'))$('verticalPaddingClearanceTop').textContent=`${Math.round(actualTop)} u`;
  if($('verticalPaddingClearanceBottom'))$('verticalPaddingClearanceBottom').textContent=`${Math.round(actualBottom)} u`;
}
function geometryBuildMessage(message){if($('previewAdjusterStatus'))$('previewAdjusterStatus').textContent=message;}
function scheduleGeometryRebuild(){
  clearTimeout(previewAdjusterTimer);
  previewAdjusterNeedsRebuild=true;
  geometryBuildMessage('Settings updated; rebuilding both TTFs 600 ms after the last change…');
  previewAdjusterTimer=setTimeout(async()=>{
    if(!project||!usingWasm()){
      geometryBuildMessage('Adjustments saved. Build WASM and load it to generate preview fonts.');
      return;
    }
    if(previewBusy){
      // The existing build cannot be cancelled. Discard its stale result
      // (revision check) and run ONE further build with the latest values.
      return;
    }
    previewAdjusterNeedsRebuild=false;
    geometryBuildMessage('Building Ligatures and Literal fonts with adjusted geometry…');
    await buildPreviewFonts();
  },600);
}
function applyPreviewAdjusterValue(key,value){
  if(!project)return;
  const old=previewAdjustments();
  const next={...old,[key]:value};
  if(old[key]===next[key])return;
  if(!previewAdjusterStart)previewAdjusterStart=old;
  project.settings.previewAdjustments=next;
  keepPreviewOnGeometryChange=true;
  saveSoon();
  refreshPreviewAdjusters();
  scheduleGeometryRebuild();
}
function finishPreviewAdjustment(){
  if(!project||!previewAdjusterStart)return;
  const before=previewAdjusterStart,after=previewAdjustments();
  previewAdjusterStart=null;
  keepPreviewOnGeometryChange=true;
  recordChange('previewAdjustments','previewAdjustments',before,after);
  scheduleGeometryRebuild();
}

// Selecting a control group is presentation-only: no project mutation, save,
// WASM compile or font re-render, and no slider values are recreated.
function wirePreviewAdjusterTabs(){
  const tabs=Array.from(document.querySelectorAll('#previewAdjusters [data-adjuster-tab]'));
  const panels=Array.from(document.querySelectorAll('#previewAdjusters [data-adjuster-group]'));
  if(tabs.length===0)return;
  const activate=tab=>{
    const selected=tab.dataset.adjusterTab;
    for(const item of tabs){
      const active=item===tab;
      item.classList.toggle('active',active);
      item.setAttribute('aria-selected',String(active));
      item.tabIndex=active?0:-1;
    }
    for(const panel of panels)panel.hidden=panel.dataset.adjusterGroup!==selected;
  };
  for(const [i,tab] of tabs.entries()){
    tab.addEventListener('click',()=>activate(tab));
    tab.addEventListener('keydown',event=>{
      let next;
      if(event.key==='ArrowRight')next=(i+1)%tabs.length;
      else if(event.key==='ArrowLeft')next=(i-1+tabs.length)%tabs.length;
      else if(event.key==='Home')next=0;
      else if(event.key==='End')next=tabs.length-1;
      else return;
      event.preventDefault();activate(tabs[next]);tabs[next].focus();
    });
  }
  activate(tabs.find(tab=>tab.getAttribute('aria-selected')==='true')||tabs[0]);
}
function wirePreviewAdjusters(){
  wirePreviewAdjusterTabs();
  const rounded=$('longPiRounded');
  if(rounded)rounded.addEventListener('change',()=>{
    applyPreviewAdjusterValue('longPiRounded',rounded.checked);
    finishPreviewAdjustment();
  });
  for(const [id,key] of [['fractionalVerticalAlignment','fractionalVerticalAlignment'],['glyphHorizontalPadding','glyphPadding'],['cartoucheTop','cartoucheTop'],['cartoucheBottom','cartoucheBottom'],['cartoucheStroke','cartoucheStroke'],['cartoucheLeftStroke','cartoucheLeftStroke'],['cartoucheRightStroke','cartoucheRightStroke'],['cartoucheEndHeight','cartoucheEndHeight'],['cartoucheEndY','cartoucheEndY'],['cartoucheLeftX','cartoucheLeftX'],['cartoucheRightX','cartoucheRightX'],['cartoucheEdgePadding','cartoucheEdgePadding'],['cartoucheContentOffset','cartoucheContentOffset'],['longPiStartHeight','longPiStartHeight'],['longPiStartY','longPiStartY'],['longPiStartX','longPiStartX'],['ordinaryPiStroke','ordinaryPiStroke'],['longPiStroke','longPiStroke'],['tallyLength','tallyLength'],['tallyY','tallyY'],['tallySpacing','tallySpacing'],['verticalPaddingTop','verticalPaddingTop'],['verticalPaddingBottom','verticalPaddingBottom']]){
    const element=$(id);
    element.addEventListener('input',()=>applyPreviewAdjusterValue(key,Number(element.value)));
    element.addEventListener('change',finishPreviewAdjustment);
  }
  $('btnFractionBaseline').onclick=()=>{applyPreviewAdjusterValue('fractionalVerticalAlignment',0);finishPreviewAdjustment();};
  $('btnFractionCentre').onclick=()=>{applyPreviewAdjusterValue('fractionalVerticalAlignment',100);finishPreviewAdjustment();};
  refreshPreviewAdjusters();
}
function showPreviewState(message){
  const el=$('previewBuildStatus');if(!el)return;
  el.textContent=message||(!usingWasm()?'Rust/WASM is missing. Run ./bin/build-wasm.sh and reload.':previewBusy?'Compiling fonts…':compiledPreview?.revision===previewRevision?'Preview fonts are built and current.':'Preview fonts are not built, or your project changed. Select Build preview fonts.');
  $('btnPreviewBuild').disabled=!usingWasm()||previewBusy;
  renderCompiledPreview();
}
async function buildPreviewFonts(){
  if(previewBusy)return;
  if(!usingWasm()){showPreviewState('Run ./bin/build-wasm.sh and reload this page first.');return;}
  // Manual Build supersedes a queued debounce; no duplicate compilation of
  // identical geometry when the user clicks Build during a slider pause.
  clearTimeout(previewAdjusterTimer);
  previewAdjusterNeedsRebuild=false;
  previewBusy=true;showPreviewState('Compiling both fonts locally with the same Rust/WASM export builder…');
  const serial=++previewBuildSerial,rev=previewRevision;
  try{
    // Snapshot protects against later edits and an in-flight project switch.
    const snapshot=structuredClone(project),snapshotId=project.id;
    const result=await compileBoth(snapshot,slots);
    if(serial!==previewBuildSerial||snapshotId!==project.id||rev!==previewRevision){showPreviewState('Project changed while compiling. Build preview fonts again.');return;}
    const faces=[];
    try{
      for(const [kind,bytes] of [['normal',result.normal],['literal',result.literal]]){
        const family=`SPFM_PREVIEW_${kind}_${serial}`;
        const copied=bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);
        const face=new FontFace(family,copied,{style:'normal',weight:'400'});
        await face.load();document.fonts.add(face);faces.push({face,family});
      }
    }catch(e){for(const item of faces)document.fonts.delete(item.face);throw e;}
    if(serial!==previewBuildSerial||snapshotId!==project.id||rev!==previewRevision){for(const item of faces)document.fonts.delete(item.face);showPreviewState('Project changed while loading fonts. Rebuild the preview.');return;}
    while(previewFaces.length)document.fonts.delete(previewFaces.pop());
    previewFaces.push(...faces.map(x=>x.face));
    compiledPreview={revision:rev,normal:faces[0].family,literal:faces[1].family,result};
    keepPreviewOnGeometryChange=false;
    // Re-render AFTER FontFace.load() and registration. Without this call the
    // sliders rebuilt the fonts but kept showing a stale Canvas until typing.
    renderCompiledPreview();
    geometryBuildMessage('Latest font settings applied to both TTFs.');
    showPreviewState('Both TTF fonts compiled and loaded. Preview is ready.');
    renderTypographyProof();renderLiveTypographyDiagrams();
  }catch(e){showPreviewState('Preview build failed: '+String(e?.message||e));status('Preview build failed: '+String(e?.message||e),true);}
  finally{
    previewBusy=false;
    showPreviewState();
    if(previewAdjusterNeedsRebuild){
      // One more (debounced) compile for changes made during the previous run.
      scheduleGeometryRebuild();
    }
  }
}
// Native OpenType preview of the actual TTFs compiled by Rust/WASM.
// Text, visibility and display size are UI-only changes, never a rebuild.
function renderCompiledPreview(){
  const out=$('compiledPreviewOutput');if(!out)return;
  out.replaceChildren();
  if(!compiledPreview){
    const message=document.createElement('p');
    message.className='small muted preview-empty-message';
    message.textContent='Build preview fonts to display your test text.';
    out.appendChild(message);
    return;
  }
  const mode=$('previewFontMode')?.value||'both';
  const configuredSize=Number($('previewFontSize')?.value);
  const fontSize=Number.isFinite(configuredSize)&&configuredSize>=8
    ? Math.max(8,Math.min(256,configuredSize)) : 72;
  const text=$('previewTestText')?.value??'';
  const samples=[{kind:'normal',label:'Ligatures'},{kind:'literal',label:'Literal'}];
  for(const {kind,label} of samples){
    if(mode!=='both'&&mode!==kind)continue;
    const wrapper=document.createElement('section');wrapper.className='compiled-font-row';
    const heading=document.createElement('strong');heading.textContent=label;wrapper.appendChild(heading);
    const display=document.createElement('div');display.className='compiled-font-text';
    display.style.fontFamily=`"${compiledPreview[kind]}"`;
    display.style.fontSize=`${fontSize}px`;
    display.style.fontVariantLigatures=kind==='normal'?'normal':'none';
    display.textContent=text;wrapper.appendChild(display);
    out.appendChild(wrapper);
  }
}
function wireCompiledPreviewControls(){
  $('previewFontMode').addEventListener('change',renderCompiledPreview);
  $('previewTestText').addEventListener('input',renderCompiledPreview);
  const size=$('previewFontSize');
  size.addEventListener('input',renderCompiledPreview);
  size.addEventListener('change',()=>{
    const number=Number(size.value);
    size.value=String(Number.isFinite(number)?Math.max(8,Math.min(256,Math.round(number))):72);
    renderCompiledPreview();
  });
}
/** On-demand, non-destructive project inspection; stays inside Build & export. */
function showQualityReport(result){
 const panel=$('fontQualityPanel'),summary=$('fontQualitySummary'),list=$('fontQualityFindings');
 if(!summary||!list)return;
 list.replaceChildren();
 if(!result){summary.textContent='Not checked yet.';return;}
 summary.textContent=`${result.inspectedGlyphs||0} edited glyphs inspected · ${result.errors} errors · ${result.warnings} warnings · ${result.notes} notes`;
 for(const issue of result.issues.slice(0,80)){
  const item=document.createElement('div');item.className='font-quality-finding';
  const label=document.createElement('span');label.textContent=`${issue.severity.toUpperCase()} — ${issue.message}`;
  if(issue.glyphId!=null){
   const button=document.createElement('button');button.type='button';button.className='mini';
   const slot=slots.find(x=>String(x.index)===String(issue.glyphId));
   button.textContent=slot?.word||`Glyph ${issue.glyphId}`;
   button.title='Open this glyph in the drawing editor';
   button.onclick=()=>{const i=slots.findIndex(x=>String(x.index)===String(issue.glyphId));if(i>=0){switchTab('glyph');void selectGlyph(i);}};
   item.appendChild(button);
  }
  item.appendChild(label);list.appendChild(item);
 }
 if(result.issues.length>80){const more=document.createElement('p');more.className='small muted';more.textContent=`Showing the first 80 of ${result.issues.length} findings.`;list.appendChild(more);}
 if(result.errors||result.warnings)panel.open=true;
}
function runProjectQualityCheck({show=true}={}){
 const result=inspectProjectQuality(project);
 if(show)showQualityReport(result);
 return result;
}
async function buildFonts(){
 if(fontActionBusy)return;
 if(!usingWasm()){status('Font export is unavailable. Please reload the page or contact the maintainer.',true);return;}
 if(!saveIdentity())return;
 // Imported font attachment metrics are editor references, not compiler prerequisites.
 setFontActionBusy(true);status('Preparing font export…');
 try{
  clearTimeout(saveTimer);await saveNow();
  const snapshot=structuredClone(project);
  const preflight=inspectProjectQuality(snapshot);
  showQualityReport(preflight);
  if(!preflight.valid)throw new Error(`Project quality check found ${preflight.errors} blocking error(s). Open Font quality checks for details.`);
  const result=await compileBoth(snapshot,slots);
  // Browser-side font loading tests a separate engine from the Rust compiler.
  await verifyPortableFontPairFaces(result.normal,result.literal);
  const review=evaluateExport(snapshot);
  const filename=safename(snapshot.settings.fontIdentity.postScriptName);
  const qualityEvidence={schema:'spfm-font-quality-v1',createdAt:new Date().toISOString(),
    project:{editedGlyphs:preflight.inspectedGlyphs,errors:preflight.errors,warnings:preflight.warnings,notes:preflight.notes,findings:preflight.issues},
    fontStructure:'passed: browser-side SFNT directory, checksums, glyph offsets, cmap table and metrics',
    browserFontFace:'passed: both fonts loaded by the browser',
    independentFontTools:'not run as part of browser export',
    harfBuzzAndLibreOffice:'not run as part of browser export'};
  const otherFiles=[['custom-names.json',JSON.stringify(customManifest(snapshot),null,2)],
    ['quality-report.json',JSON.stringify(qualityEvidence,null,2)],...licenceFiles(snapshot,review,{includeFairfax:true})];
  const portable=await createPortableFontPairZip({project:snapshot,normal:result.normal,literal:result.literal,filename,otherFiles});
  if(project?.id!==snapshot.id)throw new Error('Project changed during font export. Try again.');
  download(portable.blob,`${filename}-font-pair.zip`);status(`Portable font ZIP ready · compiled TTF checks passed · ${preflight.warnings} advisory project warnings. Quality report included.`);
 }catch(e){status('Font export failed: '+String(e?.message||e),true);}finally{setFontActionBusy(false);}
}
async function publishFontOnSite(){
 if(fontActionBusy)return;
 if(!usingWasm()){status('Build the Rust/WASM module before using fonts on this site.',true);return;}
 if(!saveIdentity())return;
 setFontActionBusy(true);status('Compiling fonts for this browser’s site font library…');
 try{
  clearTimeout(saveTimer);await saveNow();
  const snapshot=structuredClone(project),revision=previewRevision;
  const preflight=inspectProjectQuality(snapshot);
  if(!preflight.valid){showQualityReport(preflight);throw new Error(`Project quality check found ${preflight.errors} blocking error(s).`);}
  const result=await compileBoth(snapshot,slots);
  await verifyPortableFontPairFaces(result.normal,result.literal);
  if(project?.id!==snapshot.id || previewRevision!==revision){
    throw new Error('Project or glyph settings changed during compilation. Try again to publish the latest version.');
  }
  const saved=await useFontOnThisSite({project:snapshot,normal:result.normal,literal:result.literal});
  status(`${saved.updated?'Updated':'Added'} “${saved.label}” in this browser’s site font library. Open or reload another site page and select it from the font list.`);
 }catch(e){status('Use on this site failed: '+String(e?.message||e),true);}finally{setFontActionBusy(false);}
}
async function importSiteFontZip(file){
  if(!file||fontActionBusy)return;
  if(!storageAvailable){status('This browser cannot save site fonts. Please use HTTPS or localhost with IndexedDB enabled.',true);return;}
  setFontActionBusy(true);status('Verifying font ZIP and SHA-256 checksums…');
  try{
    // No writes happen until the complete archive and its two TTF files pass.
    const extracted=await readPortableFontPairZip(file);
    const existing=await getSiteFontForProject(extracted.project.id);
    if(existing&&existing.origin!=='sitelen-pona-font-maker')throw new Error('An unrelated font already uses this package’s project ID.');
    const name=extracted.project.settings.fontIdentity.family;
    const prompt=existing
      ? `This ZIP is valid. Replace existing site font “${existing.label}” with the imported “${name}” pair?`
      : `This ZIP is valid. Install “${name}” (Ligatures + Literal) in this browser’s site font library?`;
    if(!window.confirm(`${prompt}\n\nThe font licences in this ZIP remain your responsibility. Installation does not verify or grant permission to use third-party fonts.`)){status('Font ZIP verified; import cancelled. No site fonts were changed.');return;}
    const saved=await useFontOnThisSite({...extracted});
    status(`${saved.updated?'Updated':'Installed'} “${saved.label}” from verified ZIP. Reload another site page to select it from the font list.`);
  }catch(e){status('Font ZIP import failed: '+String(e?.message||e),true);}
  finally{setFontActionBusy(false);}
}
function requestSiteFontZipImport(){if(fontActionBusy)return;const input=$('fileImportFontZip');if(input){input.value='';input.click();}}

/** Build a new project from a verified compiled font pair without asking for
 * the same bundled licences again. Validation and confirmation finish before
 * the current project is changed or a new IndexedDB record is written.
 */
async function importEditableFontPairZip(file){
  if(!file||fontActionBusy)return;
  if(!storageAvailable){status('Project ZIP import requires IndexedDB in this browser.',true);return;}
  setFontActionBusy(true);
  status('Checking font ZIP, bundled licences and SHA-256 checksums…');
  try{
    const parsed=await readPortableFontProjectZip(file);
    if(parsed.normal.byteLength>40_000_000||parsed.literal.byteLength>40_000_000){
      throw Error('A compiled font exceeds the 40 MB source limit supported by the editor.');
    }
    // SHA-256 validates bytes; the native font loader validates that both
    // TrueType files are actually usable. This precedes project creation.
    await verifyPortableFontPairFaces(parsed.normal,parsed.literal);
    const family=parsed.project.settings.fontIdentity.family;
    const originalIdentity=parsed.project.settings.fontIdentity;
    if(family.length>90||!/^[a-zA-Z0-9_-]{1,55}$/.test(originalIdentity.postScriptName)||
      !originalIdentity.style||originalIdentity.style.length>35){
      throw Error('The ZIP font identity exceeds the editor limits.');
    }
    if(!confirm(`Create a new editable project from “${family}”?\n\nThe verified ZIP contains both fonts and the bundled licences; no further licence file is required. Your existing projects will not be changed.\n\nYou remain responsible for all font licensing and distribution requirements.`)){
      status('Verified ZIP import cancelled. Your projects are unchanged.');
      return;
    }
    const candidate=newProject(`${parsed.project.name} (ZIP import)`);
    // Keep a unique IndexedDB project ID; never reuse the exported ID. Font
    // identity is editable independently of the new project's storage key.
    candidate.settings.fontIdentity={
      ...candidate.settings.fontIdentity,
      ...parsed.project.settings.fontIdentity,
      projectId:candidate.id,
    };
    const ligatures=parsed.normal,literal=parsed.literal;
    // The exported Ligatures font is a TrueType source already. Do not
    // rasterize it or re-run CFF conversion. Its original Unicode glyphs
    // remain available as the light-grey source reference.
    let attachment;
    try{attachment=inspectAttachmentGeometry(ligatures);}catch(error){
      attachment={...BLANK_ATTACH,warnings:['The ZIP source has no measurable attachment guides: '+String(error?.message||error)]};
    }
    const when=new Date().toISOString();
    candidate.sourceFont={
      name:parsed.sourceFontFilename,
      data:toBase64(ligatures),
      pairedLiteralTtf:toBase64(literal),
      pairedLiteralName:parsed.literalFontFilename,
      normalizedFormat:'truetype',importFormat:'portable-font-pair',
      attachmentGeometry:attachment,metadata:fontNameMetadata(ligatures),
      origin:'portable-font-pair',
      originalSourceName:parsed.originalSourceName,
      outlinePreservation:'Verified compiled Ligatures/Literal TrueType vectors; independent Literal source preserved',
      portablePackage:{
        exportedProjectId:parsed.project.id,
        exportedAt:parsed.packageInfo.exportedAt,
        manifestVersion:parsed.packageInfo.manifestVersion,
        fairfaxOflIncluded:true,
      },
      licenceAcknowledgement:parsed.licenceMeta.importAcknowledgement||null,
    };
    candidate.licensing.documents=parsed.originalLicenceDocuments.map(doc=>({
      name:doc.name,originalName:doc.originalName,
      data:toBase64(doc.bytes),content:doc.content,byteLength:doc.byteLength,
    }));
    candidate.licensing.basis=['user-acknowledged','owned','ofl-1.1'].includes(parsed.licenceMeta.rightsBasis)
      ?parsed.licenceMeta.rightsBasis:'user-acknowledged';
    candidate.licensing.importAcknowledgement=parsed.licenceMeta.importAcknowledgement||{
      acknowledgedAt:when,
      statement:'Imported verified Font Maker font ZIP containing the source licence and Fairfax notices; no new licence file was requested.',
      packageSourceProjectId:parsed.project.id,
    };
    // Import custom slot names in addition to the actual glyph outlines so
    // subsequent exports keep any custom Toki Pona GSUB word ligatures.
    const customBytes=parsed.verifiedFiles.get('custom-names.json');
    if(customBytes){
      if(customBytes.length>256*1024)throw Error('The ZIP custom-names.json is too large.');
      let names;
      try{names=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(customBytes));}
      catch{throw Error('The ZIP custom-names.json is malformed.');}
      if(names?.schema==='sp-font-maker-custom-names-v1'&&names.mappings&&typeof names.mappings==='object'){
        const assigned=new Set();
        for(const [name,code] of Object.entries(names.mappings)){
          if(!validTokiPonaCustomName(name))throw Error(`Invalid custom glyph name in ZIP: ${name}`);
          const slot=slots.find(x=>x.customSlot&&`U+${Number(x.codepoint).toString(16).toUpperCase()}`===code);
          if(!slot||assigned.has(slot.index))throw Error(`Invalid or duplicate custom glyph codepoint in ZIP: ${code}`);
          assigned.add(slot.index);
          candidate.glyphs[slot.index]={word:name,modified:false};
        }
      }
    }
    // All conversion, licence and metadata validation completed. Only now
    // save the new record, then select it. The original project persists.
    clearTimeout(saveTimer);
    await pendingSave;
    await saveNow();
    await saveWorkspace(candidate,{id:candidate.id,undo:[],redo:[]});
    slotIndex=Math.max(0,slots.findIndex(x=>x.word==='jan'));
    await switchProject(candidate.id);
    const count=candidate.licensing.documents.length;
    status(`Created “${candidate.name}” from verified font ZIP. Both vector fonts and ${count} original licence document${count===1?'':'s'} are retained; Fairfax notices are included for re-export.`);
  }catch(error){status('Import ZIP failed: '+String(error?.message||error),true);}
  finally{setFontActionBusy(false);}
}
function requestEditableFontPairZipImport(){
  if(fontActionBusy)return;
  const input=$('fileImportProjectFontZip');
  if(input){input.value='';input.click();}
}

const slotMeta=i=>project?.glyphs?.[i]||slots[i]||{};
const glyphKey=i=>String(i);
const currentEntry=()=>project.glyphs[glyphKey(slotIndex)]||{};
function commitGlyph(){
  if(!project)return;
  outlineValidationMarkers=[];
  const k=glyphKey(slotIndex),g=ensureEditorShift({...(project.glyphs[k]||{})});
  g.raster=canvas.toDataURL('image/png');
  const t=traceGlyph(canvas,Number($('traceThreshold').value),Number($('traceSimplify').value));
  g.rasterPath=t.path;g.path=combineGlyphPaths(g.rasterPath,g.bezierContours||[]);
  g.contours=t.contours;g.modified=true;project.glyphs[k]=g;updateLayerPath(g,project);
  saveSoon();updateProgress();updateTrace();
}
function scheduleTrace(){clearTimeout(traceTimer);traceTimer=setTimeout(()=>{traceTimer=0;commitGlyph();},140);}
function saveSoon(){if(!project||deletingProject)return;invalidateCompiledPreview();saveStatus('Unsaved changes…');clearTimeout(saveTimer);saveTimer=setTimeout(saveNow,420);}
async function saveNow(){if(!project||deletingProject)return;
  if(hasLinkedComponents(project))resolveLinkedGlyphPaths(project,{commit:true});
  else for(const g of Object.values(project.glyphs||{}))if(g?.layerStack)updateLayerPath(g);const snapshot=structuredClone(project);snapshot.updatedAt=new Date().toISOString();project.updatedAt=snapshot.updatedAt;
  const undo=structuredClone(history),redo=structuredClone(redoStack);
  pendingSave=pendingSave.then(()=>saveWorkspace(snapshot,{undo,redo}));try{await pendingSave;saveStatus(`Autosaved ${new Date(snapshot.updatedAt).toLocaleTimeString()}`);}catch(e){saveStatus('Autosave failed');status('IndexedDB save failed: '+e.message,true);}
}
function clearCanvas(){ctx.clearRect(0,0,ARTBOARD_WIDTH,ARTBOARD_HEIGHT);}
let rasterImageSequence=0;
function drawImageUrl(url){const serial=++rasterImageSequence;return new Promise(resolve=>{if(!url){clearCanvas();resolve();return;}const img=new Image();img.onload=()=>{if(serial===rasterImageSequence){clearCanvas();ctx.drawImage(img,0,0);}resolve();};img.onerror=()=>{if(serial===rasterImageSequence)clearCanvas();resolve();};img.src=url;});}

// Imported references use the stored normalized TrueType, whose UCSUR cmap
// includes aliases resolved from the source font's own word ligatures.
// The original sourceFont.data remains untouched for source/licensing records.
let cachedSourceFont=null,cachedSourceReferenceBytes=null;
function sourceReferenceBytes(){
  const source=project?.sourceFont;
  if(!source)return new Uint8Array(0);
  // The library can ask about hundreds of slots during one render. Decode
  // multi-megabyte IndexedDB font data once, not once per thumbnail.
  if(source!==cachedSourceFont){
    cachedSourceReferenceBytes=fromBase64(source.normalizedTtf||source.data);
    cachedSourceFont=source;
  }
  return cachedSourceReferenceBytes;
}
// The original glyph is a pale filled silhouette with real transparent holes.
// Imported glyphs have priority; a new project or missing imported mapping
// uses the appropriate bundled Fairfax outline instead. Neither guide is
// editable or included in the exported TrueType glyphs.
let originalGuideRequest=0;
async function renderOriginalGuide(){
  const request=++originalGuideRequest;
  const layer=$('originalGuideCanvas');if(!layer)return;
  const guide=layer.getContext('2d');guide.clearRect(0,0,ARTBOARD_WIDTH,ARTBOARD_HEIGHT);
  if(!$('toggleOriginal').checked||(tool==='bezier'&&bezierPreview))return;
  const selectedProject=project,selectedIndex=slotIndex;
  const slot=slots[selectedIndex];if(!slot?.codepoint)return;
  try{
    let family=null,fallbackBounds=null;
    if(selectedProject?.sourceFont){
      const bytes=sourceReferenceBytes();
      if(fontHasCodepoint(bytes,Number(slot.codepoint))){
        if(!importedFamily)importedFamily=await registerFont(bytes,selectedProject.id);
        family=importedFamily;
      }
    }
    if(!family){
      const fallback=await loadFairfaxReferenceFont(slot);
      family=fallback?.family||null;
      if(fallback)fallbackBounds=referenceGlyphBounds(fallback.bytes,Number(slot.codepoint));
    }
    if(!family||request!==originalGuideRequest||selectedProject!==project||selectedIndex!==slotIndex)return;
    if(fallbackBounds)fairfaxReferenceBounds.set(`${selectedProject.id}:${selectedIndex}`,fallbackBounds);
    // Blank glyphs share the reference's fitted coordinate origin with future
    // edits. Existing edited glyphs retain their saved coordinates: only the
    // non-editable guide is fitted when their historical origin would clip it.
    let shift=editorShiftFor();
    if(fallbackBounds){
      const [left,bottom,right,top]=fallbackBounds;
      if(fontToPixel(left,0,shift).x<20||fontToPixel(right,0,shift).x>ARTBOARD_WIDTH-20||
         fontToPixel(0,top,shift).y<20||fontToPixel(0,bottom,shift).y>ARTBOARD_HEIGHT-20){
        shift=computeEditorShift(fallbackBounds,ARTBOARD_WIDTH,ARTBOARD_HEIGHT);
      }
    }
    const original=rasterizeFontGlyphAligned(family,Number(slot.codepoint),
      {width:ARTBOARD_WIDTH,height:ARTBOARD_HEIGHT,shiftX:shift.x,shiftY:shift.y});
    const sourcePixels=original.getContext('2d',{willReadFrequently:true})
      .getImageData(0,0,ARTBOARD_WIDTH,ARTBOARD_HEIGHT);
    const silhouette=guide.createImageData(ARTBOARD_WIDTH,ARTBOARD_HEIGHT);
    silhouette.data.set(referenceSilhouettePixels(sourcePixels,Number($('originalOpacity').value)/100));
    // Source ink is translucent grey, while unfilled areas and counters
    // remain transparent. The overlay never enters the editable drawing.
    guide.putImageData(silhouette,0,0);
  }catch(e){
    if(request===originalGuideRequest)status('Original glyph reference could not be loaded: '+e.message,true);
  }
}
function drawMetricGuides(){
  const layer=$('metricGuideCanvas');if(!layer)return;
  const g=layer.getContext('2d');g.clearRect(0,0,ARTBOARD_WIDTH,ARTBOARD_HEIGHT);
  if(!$('toggleMetrics').checked||(tool==='bezier'&&bezierPreview))return;
  const p=attachmentGeometry();
  const baseline=fontYToCanvas(0);
  g.font='11px sans-serif';
  const line=(y,text,color,width=1)=>{
    if(y<0||y>ARTBOARD_HEIGHT)return;g.strokeStyle=color;g.lineWidth=width;g.setLineDash([4,6]);
    g.beginPath();g.moveTo(0,y);g.lineTo(ARTBOARD_WIDTH,y);g.stroke();g.setLineDash([]);
    g.fillStyle=color;g.fillText(text,5,Math.max(11,y-4));
  };
  const band=(lower,upper,text,color)=>{
    const y0=fontYToCanvas(upper),y1=fontYToCanvas(lower);
    g.fillStyle=color==='cart'?'#9b9f9d22':'#ad83bf22';g.fillRect(0,y0,ARTBOARD_WIDTH,y1-y0);
    const c=color==='cart'?'#737d83':'#8c639e';
    line(y0,text+' · upper edge',c);line(y1,text+' · lower edge',c);
  };
  // Only show attachment guides for the glyphs that actually join them.
  if(slotIndex===120||slotIndex===121){
    band(p.cartoucheTop-p.cartoucheStroke,p.cartoucheTop,'Cartouche upper rule','cart');
    band(p.cartoucheBottom,p.cartoucheBottom+p.cartoucheStroke,'Cartouche lower rule','cart');
  }else if(slotIndex===137){
    band(p.longPiBottom,p.longPiTop,'Long-pi / lower rule','pi');
  }else if(slotIndex===124){
    line(fontYToCanvas(p.cartoucheBottom),'Tally touches underside of lower rule','#8c639e',1.3);
  }
  line(baseline,'Font baseline','#5680a5',1.4);
}
function isInk(){const a=ctx.getImageData(0,0,ARTBOARD_WIDTH,ARTBOARD_HEIGHT).data;for(let i=3;i<a.length;i+=4)if(a[i]>80)return true;return false;}
function sourceGlyphExists(slot){
  if(!project?.sourceFont || !slot?.codepoint)return false;
  const cp=Number(slot.codepoint);
  if(!importedCmapCache.has(cp)){
    try{importedCmapCache.set(cp,fontHasCodepoint(sourceReferenceBytes(),cp));}
    catch(_){importedCmapCache.set(cp,false);}
  }
  return importedCmapCache.get(cp);
}
function hasGlyphPreview(i){return !!project?.glyphs?.[i]?.modified || sourceGlyphExists(slots[i]);}
function countDrawn(){return slots.filter((_,i)=>!!project?.glyphs?.[i]?.modified).length;}
function updateProgress(){$('glyphStats').textContent=`${countDrawn()} edited / ${slots.length}`;renderGlyphList();}
function appendThumb(button,i){
  const slot=slots[i],g=project?.glyphs?.[i],thumb=document.createElement('span');thumb.className='glyph-thumb';
  if(g?.modified&&g.path){
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox',`0 0 ${ARTBOARD_WIDTH} ${ARTBOARD_HEIGHT}`);
    const path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d',g.path);
    path.setAttribute('fill','#22192e');path.setAttribute('fill-rule','nonzero');svg.appendChild(path);thumb.appendChild(svg);
  }else if(importedFamily&&(sourceGlyphExists(slot)||slot.standardAlternative)){
    const span=document.createElement('span');span.className='imported-glyph';
    span.textContent=sourceGlyphExists(slot)?String.fromCodePoint(Number(slot.codepoint)):(slot.word||'');
    span.style.fontFamily=`"${importedFamily}",sans-serif`;
    thumb.appendChild(span);
  }else{const fallback=document.createElement('span');fallback.className='muted';fallback.textContent='—';thumb.appendChild(fallback);}
  button.appendChild(thumb);
}
function renderGlyphList(){
 const q=$('glyphSearch').value.trim().toLowerCase(),dest=$('glyphList');dest.textContent='';const frag=document.createDocumentFragment();
 slots.forEach((slot,i)=>{
  const data=slotMeta(i),name=data.kind==='ascii'?`ASCII ${JSON.stringify(data.display)} · U+${data.codepoint.toString(16).toUpperCase().padStart(4,'0')}`:glyphLibraryName(slot,i,data);
  const aliases=Array.isArray(data.aliases)?data.aliases:[],modified=!!project?.glyphs?.[i]?.modified,available=hasGlyphPreview(i);
  if(glyphCategory==='ascii'&&slot.kind!=='ascii'||glyphCategory==='custom'&&!slot.customSlot||glyphCategory==='special'&&![120,121,122,123,124,135,136,137].includes(i)||glyphCategory==='sitelen'&&(slot.kind==='ascii'||slot.customSlot))return;
  if(q&&!(name+' '+aliases.join(' ')+' '+(data.name||'')+' '+capCp(data.codepoint)).toLowerCase().includes(q))return;
  if(filtered==='drawn'&&!available||filtered==='missing'&&available)return;
  const b=document.createElement('button');b.className=`glyph-card ${modified?'drawn':''} ${i===slotIndex?'active':''}`;
  b.title=`${name}${aliases.length?' (aliases: '+aliases.join(', ')+')':''} · ${capCp(data.codepoint)}${available?' · available':''}`;
  appendThumb(b,i);
  const title=document.createElement('span');title.className='glyph-name';title.textContent=name;
  if(aliases.length){const small=document.createElement('small');small.textContent=aliases.join(' · ');title.appendChild(small);}
  b.appendChild(title);b.addEventListener('click',()=>selectGlyph(i));frag.appendChild(b);
 });dest.appendChild(frag);
}
async function selectGlyph(i){if(!project||!slots[i])return;restoreProjectDrawingPreferences();outlineValidationMarkers=[];selectedWidthSession=null;marquee=null;selection=null;marqueePolygon=null;selectionPolygon=null;selectionDrag=null;selectedObjectIndices=null;isolatedLayerId=null;renderSelectionOverlay();const changedGlyph=slotIndex!==i;bezierInteraction=null;bezierHover=null;selectedBezierContour=-1;selectedBezierNode=-1;selectedStroke=-1;joinEndpoints=[];strokeJoinStart=null;clearTimeout(traceTimer);if(drawing){restoreStrokeBase();clearDrawingGesture();}if(curvePending)cancelCurve();slotIndex=i;project.editorDrafts||={};bezierDraft=readDraft(project.editorDrafts,glyphKey(i));
  const meta=slotMeta(i),base=slots[i];$('glyphTitle').textContent=base.kind==='ascii'?`ASCII ${JSON.stringify(base.display)}`:glyphLibraryName(base,i,meta);
  $('glyphDescription').textContent=`Entry ${i+1}/${slots.length} · ${meta.kind||base.kind||'glyph'} · ${base.rotate?'directional variant source':''}`;
  $('glyphCp').textContent=capCp(base.codepoint);$('glyphWord').value=meta.word||base.word;
  $('glyphWord').readOnly=base.kind==='ascii'||!base.customSlot;
  $('glyphWord').title=base.customSlot?'Custom name: 2–32 lowercase Toki Pona letters forming (C)V(N) syllables':'Standard assignments are fixed in this catalogue';
  $('glyphCodepoint').value=meta.codepoint==null?'':Number(meta.codepoint).toString(16).toUpperCase();$('glyphAliases').value=(meta.aliases||[]).join('\n');
  const current=project.glyphs[glyphKey(i)]||{};ensureGlyphLayers(current);project.glyphs[glyphKey(i)]=current;updateLayerPath(current,project);
 const displayed=project.glyphs[i];await drawImageUrl((displayed?.modified||displayed?.rasterCopyForEditing)?(displayed?.raster||''):'');await renderOriginalGuide();drawMetricGuides();refreshAttachmentUI();renderBezierOverlay();refreshGlyphLayerPalette();updateTrace();updateProgress();
  if(changedGlyph||!viewportReady)fitCanvas();
  $('importState').textContent=project.sourceFont?`${project.sourceFont.name}. Select “Restore selected glyph from font” to rasterize it into an editable drawing.`:'No imported source font; blank projects need glyph drawings or a separately imported Latin font for full ASCII coverage.';
}
function gridPrefs(){return {spacing:gridSpacing,snap:snapToGrid,visible:$('toggleGrid').checked};}
function persistGridPrefs(){try{localStorage.setItem(GRID_STORAGE_KEY,JSON.stringify(gridPrefs()));}catch(_){} }
function showArtboardGrid(){drawGridOverlay($('editorGridOverlay'),{visible:$('toggleGrid').checked,spacing:gridSpacing,width:ARTBOARD_WIDTH,height:ARTBOARD_HEIGHT});}
function initializeGridSettings(){
  try{const value=JSON.parse(localStorage.getItem(GRID_STORAGE_KEY)||'null');
    if(value&&typeof value==='object'){
      gridSpacing=normalizeGridSpacing(value.spacing);snapToGrid=value.snap===true;
      if(typeof value.visible==='boolean')$('toggleGrid').checked=value.visible;
    }
  }catch(_){}
  $('gridSpacing').value=String(gridSpacing);$('snapToGrid').checked=snapToGrid;
  $('gridSpacing').addEventListener('change',()=>{
    gridSpacing=normalizeGridSpacing($('gridSpacing').value);$('gridSpacing').value=String(gridSpacing);
    showArtboardGrid();persistGridPrefs();
  });
  $('snapToGrid').addEventListener('change',()=>{snapToGrid=$('snapToGrid').checked;persistGridPrefs();});
  showArtboardGrid();
}
function snapCanvasPoint(p){return snapToGrid&&shouldSnapDrawingTool(tool)?snapGridPoint(p,gridSpacing,ARTBOARD_WIDTH,ARTBOARD_HEIGHT):p;}
function drawingPos(ev){return snapCanvasPoint(canvasPos(ev));}
function canvasPos(ev){const r=canvas.getBoundingClientRect();return{x:Math.max(0,Math.min(ARTBOARD_WIDTH-1,(ev.clientX-r.left)/r.width*ARTBOARD_WIDTH)),y:Math.max(0,Math.min(ARTBOARD_HEIGHT-1,(ev.clientY-r.top)/r.height*ARTBOARD_HEIGHT))};}
function restoreProjectDrawingPreferences(){
 if(!project||displayedDrawingProject===project)return;
 displayedDrawingProject=project;
 const prefs=normalizeDrawingPreferences(project.settings?.drawing);
 $('brushSize').value=String(prefs.width);$('brushSizeLabel').textContent=String(prefs.width);
 $('strokeSmoothing').value=String(prefs.smoothing);$('strokeSmoothingLabel').textContent=prefs.smoothing+'%';
 $('autoShape').checked=prefs.autoShape;$('filledShape').checked=prefs.filledShape;
 $('drawShapesFromCentre').checked=prefs.fromCenter;
 $('lineCapStyle').value=prefs.lineCap;$('tipShape').value=prefs.tipShape;
}
function persistProjectDrawingPreferences(){
 if(!project)return;
 project.settings||={};
 project.settings.drawing=normalizeDrawingPreferences({
  width:$('brushSize').value,smoothing:$('strokeSmoothing').value,
  autoShape:$('autoShape').checked,filledShape:$('filledShape').checked,
  fromCenter:$('drawShapesFromCentre').checked,
  lineCap:$('lineCapStyle').value,tipShape:$('tipShape').value
 });
 // A brush preference is not font ink. Save it without invalidating an already
 // compiled preview or creating a glyph Undo step.
 saveStatus('Unsaved drawing preferences…');clearTimeout(saveTimer);
 saveTimer=setTimeout(saveNow,420);
}
function brushWidth(){return Math.max(1,Number($('brushSize').value)||9);}
function lineCapStyle(){return $('lineCapStyle').value;}
function brushTipShape(){return $('tipShape').value;}
function setBrush(){ctx.lineCap='round';ctx.lineJoin='round';ctx.lineWidth=brushWidth();ctx.strokeStyle='#111119';ctx.fillStyle='#111119';ctx.globalCompositeOperation=tool==='eraser'?'destination-out':'source-over';}
function restoreStrokeBase(){clearCanvas();if(strokeBaseCanvas)ctx.drawImage(strokeBaseCanvas,0,0);}
function strokePath(points){
 if(!points.length)return;setBrush();
 if(brushTipShape()==='square')drawSquareBrushGeometry(ctx,points,brushWidth());
 else{drawBrushGeometry(ctx,points);ctx.stroke();}
 ctx.globalCompositeOperation='source-over';
}
function drawShapeConstructionGuide(start,end){
 const bounds=shapeBounds(start,end,{constrain:strokeConstrain,fromCenter:strokeFromCenter});
 if(!bounds||bounds.x1-bounds.x0<1||bounds.y1-bounds.y0<1)return;
 ctx.save();ctx.globalCompositeOperation='source-over';
 ctx.strokeStyle='#7953a9';ctx.lineWidth=1;ctx.setLineDash([4,5]);
 ctx.strokeRect(bounds.x0,bounds.y0,bounds.x1-bounds.x0,bounds.y1-bounds.y0);
 ctx.setLineDash([]);
 if(strokeFromCenter){
  ctx.strokeStyle='#7953a9';ctx.lineWidth=1.2;
  ctx.beginPath();ctx.moveTo(start.x-6,start.y);ctx.lineTo(start.x+6,start.y);
  ctx.moveTo(start.x,start.y-6);ctx.lineTo(start.x,start.y+6);ctx.stroke();
 }
 ctx.restore();
}
function showStrokePreview(p){
 restoreStrokeBase();
 if(tool==='pen'||tool==='eraser'){
  const points=smoothStroke(strokePoints,Number($('strokeSmoothing').value));strokePath(points);
  if(tool==='eraser')renderBezierOverlay(); // live eraser preview masks the vector overlay too
 }else if(tool==='curve'){
  ctx.lineWidth=brushWidth();ctx.strokeStyle='#111119';ctx.lineCap=lineCapStyle()==='flat'?'butt':lineCapStyle();ctx.beginPath();ctx.moveTo(strokeAnchor.x,strokeAnchor.y);
  if(curvePending){
   // An endpoint drag immediately previews a real curve, not a straight line.
   // The purple bend marker can be clicked or dragged in the second gesture.
   const through=drawing?curveBendFromPointer(curvePending,p):p||curvePending.bend;
   const bend=through||curvePending.bend,control=curveControlPoint(curvePending.start,curvePending.end,bend);
   ctx.quadraticCurveTo(control.x,control.y,curvePending.end.x,curvePending.end.y);
   ctx.stroke();
   ctx.save();ctx.lineWidth=1.5;ctx.strokeStyle='#7751ae';ctx.setLineDash([4,4]);
   const midpoint={x:(curvePending.start.x+curvePending.end.x)/2,y:(curvePending.start.y+curvePending.end.y)/2};
   ctx.beginPath();ctx.moveTo(midpoint.x,midpoint.y);ctx.lineTo(bend.x,bend.y);ctx.stroke();
   ctx.setLineDash([]);ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(bend.x,bend.y,5,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.restore();
  }else{ctx.lineTo(p.x,p.y);ctx.stroke();}
 }else if(tool==='line'){
  ctx.save();ctx.globalCompositeOperation='source-over';ctx.strokeStyle='#111119';ctx.lineWidth=brushWidth();
  ctx.lineCap=lineCapStyle()==='flat'?'butt':lineCapStyle();ctx.lineJoin='round';
  ctx.beginPath();ctx.moveTo(strokeAnchor.x,strokeAnchor.y);ctx.lineTo(p.x,p.y);ctx.stroke();ctx.restore();
 }else if(tool==='ellipse'||tool==='rect'){
  const paths=shapeContours(tool,strokeAnchor,p,brushWidth(),{filled:$('filledShape').checked,constrain:strokeConstrain,fromCenter:strokeFromCenter});
  const path=bezierPath(paths);if(path){const drawing=new Path2D(path);ctx.fillStyle='#111119';ctx.fill(drawing,'nonzero');}
  drawShapeConstructionGuide(strokeAnchor,p);
 }
}
function finishVectorShape(contours,before){
 restoreStrokeBase();
 if(!contours.length){status('Drag to define a shape before releasing.');return;}
 const key=glyphKey(slotIndex),g=bezierEntry();g.bezierContours.push(...contours);
 commitBezier(before);status('Editable vector shape added. Select it to move, rotate, copy or resize.');
}
function placeConnectedStroke(start,end,kind,bend,before,connection=null){
 const key=glyphKey(slotIndex),g=bezierEntry(),contours=g.bezierContours;
 const endTarget=strokeEndpoints(contours,end,bezierPointerRadius(14),connection);
 const to=endTarget?{x:endTarget.point.x,y:endTarget.point.y}:end;
 let active=-1;
 if(connection && endTarget && connection.ci===endTarget.ci){
  // Connecting the opposite ends of one path closes it, without duplicating
  // an endpoint (duplicated nodes create degenerate curves and bad TTF ink).
  const stroke=contours[connection.ci];
  if(connection.ni===endTarget.ni || stroke.points.length<3){status('Close needs two distinct endpoints and at least three nodes.',true);return;}
  if(kind==='curve')setSegmentBend(stroke,stroke.points.length-1,bend);
  else{const first=stroke.points[0],last=stroke.points.at(-1);first.in=[first.x,first.y];last.out=[last.x,last.y];}
  stroke.closed=true;stroke.widths=[...(stroke.widths||Array(stroke.points.length-1).fill(stroke.width)),brushWidth()];active=connection.ci;
 }else if(connection && isStroke(contours[connection.ci]) && !contours[connection.ci].closed){
  active=connection.ci;
  const stroke=contours[active];
  // Starting at the first endpoint extends the same path backwards.
  addSegment(stroke,to,kind,bend,connection.ni===0,brushWidth());
 }else if(endTarget && isStroke(contours[endTarget.ci])){
  // Drawn towards an existing endpoint: prepend/append the new segment.
  active=endTarget.ci;
  addSegment(contours[active],start,kind,bend,endTarget.ni===0,brushWidth());
 }else{
  active=contours.push(newStroke(start,to,brushWidth(),kind,bend,lineCapStyle()))-1;
 }
 // If the new segment connects two different strokes, merge them without
 // rasterizing or discarding their original Bézier handles.
 if(connection && endTarget && connection.ci!==endTarget.ci){
  const target=contours[connection.ci];
  const freeEnd=connection.ni===0?0:target.points.length-1;
  const merged=joinOpenStrokes(target,freeEnd,contours[endTarget.ci],endTarget.ni);
  const keep=connection.ci,drop=endTarget.ci;
  contours[keep]=merged;contours.splice(drop,1);active=drop<keep?keep-1:keep;
 }
 selectedStroke=active;selectedBezierContour=active;
 // Retain the joined anchor as the active point. It is now an interior node,
 // but it must still be selectable and editable like the two outer endpoints.
 selectedBezierNode=connection&&endTarget&&connection.ci!==endTarget.ci
  ?(strokeNodeHit([contours[active]],to,bezierPointerRadius(20))?.ni??-1)
  :-1;
 joinEndpoints=[];
 commitBezier(before);
 status('Editable connected path updated. Click a purple interior junction to move or smooth it; endpoints remain available for extension.');
}
function selectStrokeBody(p){
 const contours=project?.glyphs?.[slotIndex]?.bezierContours||[];
 const hit=nearestStrokeBody(contours,p,bezierPointerRadius(11));
 selectedStroke=hit?.ci??-1;selectedBezierContour=selectedStroke;selectedBezierNode=-1;
 renderBezierOverlay();
 if(hit)status('Path selected. Drag the purple bend handle to reshape a curve, or use Edit path to move its endpoints.');
 return !!hit;
}
function editStrokeBendDown(p,ev){
 if(tool!=='curve')return false;
 const contours=project?.glyphs?.[slotIndex]?.bezierContours||[];
 const hit=strokeBendHit(contours,p,bezierPointerRadius(12));
 if(!hit||selectedStroke!==hit.ci)return false;
 strokeInteraction={kind:'bend',ci:hit.ci,i:hit.i,before:cloned(project.glyphs[glyphKey(slotIndex)])};
 canvas.setPointerCapture(ev.pointerId);return true;
}
function clearDrawingGesture(){drawing=false;strokeJoinStart=null;strokeInteraction=null;strokeBefore=null;strokeStartRaster=null;strokeBaseCanvas=null;strokePoints=[];strokeAnchor=null;strokeEnd=null;strokeFromCenter=false;strokeConstrain=false;}
function cancelCurve(){if(curvePending){restoreStrokeBase();curvePending=null;strokeJoinStart=null;strokeBaseCanvas=null;strokeBefore=null;status('Curve cancelled.');renderBezierOverlay();}}
function selectedStrokeTangentHit(contours,p,radius){
 const stroke=contours[selectedStroke],node=stroke?.points?.[selectedBezierNode];
 if(!isStroke(stroke)||!node)return null;
 let result=null,nearest=radius;
 for(const which of ['in','out']){
  const h=node[which];if(!Array.isArray(h)||Math.hypot(h[0]-node.x,h[1]-node.y)<.5)continue;
  const d=Math.hypot(h[0]-p.x,h[1]-p.y);
  if(d<=nearest){nearest=d;result={ci:selectedStroke,ni:selectedBezierNode,which};}
 }
 return result;
}
function pointerDown(ev){
 if(!project)return;if(wantsPan(ev)){startPan(ev);return;}if(ev.button!==0)return;
 if(!['select','lasso'].includes(tool)&&!editableLayerOrWarn())return;
 if(tool==='select'||tool==='lasso'){selectionPointerDown(ev);return;}if(tool==='bezier'){bezierPointerDown(ev);return;}
 if(tool==='fill'){ev.preventDefault();fillRasterRegion(canvasPos(ev));return;}
 const p=canvasPos(ev);
 if(['line','curve'].includes(tool) && !curvePending){
  const contours=project?.glyphs?.[slotIndex]?.bezierContours||[];
  // A joined interior anchor must remain editable with Line and Curve. First
  // test visible tangent handles, then interior anchors, then bend handles.
  const tangent=selectedStrokeTangentHit(contours,p,bezierPointerRadius(ev.pointerType==='touch'?17:10));
  if(tangent){
   ev.preventDefault();canvas.setPointerCapture(ev.pointerId);
   strokeInteraction={kind:'tangent',...tangent,before:cloned(project.glyphs[glyphKey(slotIndex)])};
   return;
  }
  const nodeHit=strokeNodeHit(contours,p,bezierPointerRadius(ev.pointerType==='touch'?21:13));
  if(nodeHit&&!nodeHit.endpoint){
   ev.preventDefault();canvas.setPointerCapture(ev.pointerId);
   selectedStroke=nodeHit.ci;selectedBezierContour=nodeHit.ci;selectedBezierNode=nodeHit.ni;joinEndpoints=[];
   strokeInteraction={kind:'junction',ci:nodeHit.ci,ni:nodeHit.ni,before:cloned(project.glyphs[glyphKey(slotIndex)])};
   renderBezierOverlay();return;
  }
  if(editStrokeBendDown(p,ev)){ev.preventDefault();return;}
  strokeJoinStart=strokeEndpoints(contours,p,bezierPointerRadius(ev.pointerType==='touch'?21:13));
  if(ev.altKey&&strokeJoinStart){
   ev.preventDefault();canvas.setPointerCapture(ev.pointerId);
   strokeInteraction={kind:'endpoint',ci:strokeJoinStart.ci,ni:strokeJoinStart.ni,before:cloned(project.glyphs[glyphKey(slotIndex)])};
   selectedStroke=strokeJoinStart.ci;selectedBezierContour=strokeJoinStart.ci;selectedBezierNode=strokeJoinStart.ni;strokeJoinStart=null;renderBezierOverlay();return;
  }
  if(!strokeJoinStart){
   const body=nearestStrokeBody(contours,p,bezierPointerRadius(8));
   if(body){ev.preventDefault();canvas.setPointerCapture(ev.pointerId);strokeInteraction={kind:'select',point:p,ci:body.ci};return;}
  }
 }
 ev.preventDefault();canvas.setPointerCapture(ev.pointerId);
 if(tool==='curve'&&curvePending){
  // The first drag establishes the endpoints; the second edits the visible bend.
  strokeAnchor={...curvePending.start};strokeEnd={...curvePending.end};
 }else{
  strokeBefore=cloned(project.glyphs[glyphKey(slotIndex)]);
  strokeBaseCanvas=newRasterCanvas(ARTBOARD_WIDTH,ARTBOARD_HEIGHT);
  strokeBaseCanvas.getContext('2d').drawImage(canvas,0,0);
  strokeAnchor=strokeJoinStart?{x:strokeJoinStart.point.x,y:strokeJoinStart.point.y}:snapCanvasPoint(p);strokeEnd=snapCanvasPoint(p);
 }
 drawing=true;strokePoints=[snapCanvasPoint(p)];strokeConstrain=ev.shiftKey;
 strokeFromCenter=['rect','ellipse'].includes(tool)&&shapeFromCenter($('drawShapesFromCentre').checked,ev.altKey);
 showStrokePreview(snapCanvasPoint(p));
}
function pointerMove(ev){
 if(panDrag)return;if(tool==='select'||tool==='lasso'){selectionPointerMove(ev);return;}if(tool==='bezier'){bezierPointerMove(ev);return;}
 if(strokeInteraction){
  ev.preventDefault();
  if(strokeInteraction.kind==='bend'){
   const g=project.glyphs[glyphKey(slotIndex)],stroke=g?.bezierContours?.[strokeInteraction.ci];
   if(stroke){setSegmentBend(stroke,strokeInteraction.i,canvasPos(ev));selectedStroke=strokeInteraction.ci;renderBezierOverlay();}
  }else if(strokeInteraction.kind==='endpoint'||strokeInteraction.kind==='junction'){
   const stroke=project.glyphs[glyphKey(slotIndex)]?.bezierContours?.[strokeInteraction.ci];
   const node=stroke?.points?.[strokeInteraction.ni];
   if(node){const p=canvasPos(ev);moveBezierAnchor(node,snapCanvasPoint(p).x,snapCanvasPoint(p).y);renderBezierOverlay();}
  }else if(strokeInteraction.kind==='tangent'){
   const node=project.glyphs[glyphKey(slotIndex)]?.bezierContours?.[strokeInteraction.ci]?.points?.[strokeInteraction.ni];
   if(node){const p=canvasPos(ev);dragBezierTangent(node,p.x,p.y,strokeInteraction.which,false);renderBezierOverlay();}
  }
  return;
 }
 if(!drawing){
  if(tool==='curve'&&curvePending){ev.preventDefault();showStrokePreview(curveBendFromPointer(curvePending,canvasPos(ev)));}
  return;
 }ev.preventDefault();const p=drawingPos(ev);
 strokeConstrain=ev.shiftKey;
 if(tool==='rect'||tool==='ellipse')strokeFromCenter=shapeFromCenter($('drawShapesFromCentre').checked,ev.altKey);
 if(tool==='pen'||tool==='eraser'){
  if(Math.hypot(p.x-strokePoints.at(-1).x,p.y-strokePoints.at(-1).y)>=.3)strokePoints.push(p);
 }else strokeEnd=p;
 showStrokePreview(p);
}
function pointerUp(ev){
 if(panDrag)return;if(tool==='select'||tool==='lasso'){selectionPointerUp(ev);return;}if(tool==='bezier'){bezierPointerUp(ev);return;}
 if(strokeInteraction){
  const interaction=strokeInteraction;strokeInteraction=null;
  if(interaction.kind==='bend'){
   const g=project.glyphs[glyphKey(slotIndex)],stroke=g?.bezierContours?.[interaction.ci];
   if(stroke){setSegmentBend(stroke,interaction.i,canvasPos(ev));commitBezier(interaction.before);status('Curve bend changed. Undo restores the previous shape.');}
  }else if(['endpoint','junction','tangent'].includes(interaction.kind)){
   const g=project.glyphs[glyphKey(slotIndex)],node=g?.bezierContours?.[interaction.ci]?.points?.[interaction.ni];
   if(node){
    const p=canvasPos(ev);
    if(interaction.kind==='tangent')dragBezierTangent(node,p.x,p.y,interaction.which,false);
    else moveBezierAnchor(node,snapCanvasPoint(p).x,snapCanvasPoint(p).y);
    if(JSON.stringify(g)!==JSON.stringify(interaction.before)){
     commitBezier(interaction.before);
     status(interaction.kind==='tangent'?'Junction tangent adjusted.':interaction.kind==='junction'?'Junction moved.':'Endpoint moved.');
    }else renderBezierOverlay();
   }
  }else selectStrokeBody(interaction.point);
  if(canvas.hasPointerCapture(ev.pointerId))canvas.releasePointerCapture(ev.pointerId);
  return;
 }
 if(!drawing)return;
 const p=drawingPos(ev),before=strokeBefore,key=glyphKey(slotIndex);
 if(tool==='rect'||tool==='ellipse'){strokeConstrain=ev.shiftKey;strokeFromCenter=shapeFromCenter($('drawShapesFromCentre').checked,ev.altKey);}
 drawing=false;clearTimeout(traceTimer);
 if(tool==='curve'){
  if(!curvePending){
   if(Math.hypot(p.x-strokeAnchor.x,p.y-strokeAnchor.y)<2){restoreStrokeBase();clearDrawingGesture();status('Drag to choose the curve endpoints.');}
   else{curvePending={start:{...strokeAnchor},end:{...p},bend:defaultCurveBend(strokeAnchor,p),connection:strokeJoinStart,before};showStrokePreview(null);status('Curved segment preview ready. Drag the purple bend point, then release to keep the curve.');}
  }else{
   const through=curveBendFromPointer(curvePending,p);
   const pending=curvePending;restoreStrokeBase();placeConnectedStroke(pending.start,pending.end,'curve',through,pending.before,pending.connection);curvePending=null;clearDrawingGesture();
  }
 }else if(tool==='pen'||tool==='eraser'){
  strokePoints.push(p);const points=smoothStroke(strokePoints,Number($('strokeSmoothing').value));
  const shape=$('autoShape').checked&&tool==='pen'?recogniseStroke(points,1):null;
  if(shape){
   const contours=shapeContours(shape.kind,shape.a,shape.b,brushWidth(),{filled:false});
   finishVectorShape(contours,before);status(`Recognised a ${shape.kind} as editable vector art.`);
  }else{
   // The SVG Bézier overlay is separate from the raster drawing. Raster-only
   // destination-out leaves vectors untouched, so transfer just the crossed
   // contours to the editable bitmap before subtracting the brush footprint.
   const oldContours=tool==='eraser'?(project.glyphs[key]?.bezierContours||[]):[];
   const converted=tool==='eraser'?rasterizeVectorsCrossedByEraser(
    oldContours,points,brushWidth(),ARTBOARD_WIDTH,ARTBOARD_HEIGHT,newRasterCanvas,brushTipShape()):{indices:[],layer:null};
   restoreStrokeBase();
   if(converted.indices.length){
    const g=bezierEntry(),removed=new Set(converted.indices);
    const source=bezierPath(converted.indices.map(i=>g.bezierContours[i]));
    try{
     const footprint=vectorBrushFootprint(points,brushWidth(),brushTipShape());
     const result=booleanPaths(source,footprint,'subtract',{tolerance:.3});
     const first=converted.indices[0];
     g.bezierContours=g.bezierContours.filter((_,i)=>!removed.has(i));
     g.bezierContours.splice(first,0,...result.contours);
     selectedBezierContour=-1;selectedBezierNode=-1;
    }catch(error){
     // Never silently rasterise a failed geometry operation: preserve
     // editable curves, abort this stroke and let the user simplify it.
     restoreStrokeBase();clearDrawingGesture();renderBezierOverlay();
     status('Vector erasing failed; artwork preserved: '+String(error.message||error),true);return;
    }
   }
   strokePath(points);
   let rasterChanged=true;
   if(tool==='eraser'&&!converted.indices.length){
    // A grey reference is not editable ink. Avoid creating misleading empty
    // Undo entries when the user erases only the imported/reference guide.
    const previous=strokeBaseCanvas.getContext('2d',{willReadFrequently:true}).getImageData(0,0,ARTBOARD_WIDTH,ARTBOARD_HEIGHT).data;
    const current=ctx.getImageData(0,0,ARTBOARD_WIDTH,ARTBOARD_HEIGHT).data;
    rasterChanged=false;
    for(let i=3;i<current.length;i+=4)if(previous[i]!==current[i]){rasterChanged=true;break;}
   }
   if(rasterChanged||converted.indices.length){
    commitGlyph();recordChange('glyph',key,before,project.glyphs[key]);
    if(converted.indices.length)status(`Erased editable vector ink; ${converted.indices.length} touched outline${converted.indices.length===1?'':'s'} remains editable as vector geometry. Undo restores original control points.`);
   }else if(tool==='eraser'){
    status('No editable ink under the eraser. The grey source font is only a reference guide; switch off Original to hide it.');
   }
  }
  clearDrawingGesture();renderBezierOverlay();
 }else if(tool==='line'){
  restoreStrokeBase();if(bezierDist(strokeAnchor,p)>2)placeConnectedStroke(strokeAnchor,p,'line',null,before,strokeJoinStart);
  else status('Drag to draw a line from a point or an existing path endpoint.');
  clearDrawingGesture();
 }else{
  const contours=shapeContours(tool,strokeAnchor,p,brushWidth(),{filled:$('filledShape').checked,constrain:strokeConstrain,fromCenter:strokeFromCenter});
  finishVectorShape(contours,before);clearDrawingGesture();
 }
 if(canvas.hasPointerCapture(ev.pointerId))canvas.releasePointerCapture(ev.pointerId);
}
// Treat the editable raster AND its Bézier contours as fill boundaries.
// Never use the faint imported-font reference as ink or flatten vector paths.
function editableInkAlpha(){
 const w=ARTBOARD_WIDTH,h=ARTBOARD_HEIGHT;
 const mask=newRasterCanvas(w,h),c=mask.getContext('2d',{willReadFrequently:true});
 c.drawImage(canvas,0,0);
 const paths=bezierPath(project?.glyphs?.[slotIndex]?.bezierContours||[]);
 if(paths){c.fillStyle='#111119';c.fill(new Path2D(paths),'nonzero');}
 const rgba=c.getImageData(0,0,w,h).data,alpha=new Uint8Array(w*h);
 for(let i=0;i<alpha.length;i++)alpha[i]=rgba[i*4+3];
 return alpha;
}
// A fill inside a native vector hole should change its winding to a filled
// contour, rather than put raster pixels behind an unchanged SVG/TrueType hole.
// That also repairs earlier raster fills whose antialiased hole rim is visible.
function vectorHolesAtFill(pixels,point=null){
 const contours=project?.glyphs?.[slotIndex]?.bezierContours||[];
 if(!contours.some(c=>c.role==='hole'))return [];
 const whole=bezierPath(contours);
 if(!whole)return [];
 const combined=new Path2D(whole),w=ARTBOARD_WIDTH;
 const candidates=point?[{x:point.x,y:point.y}]:null;
 const result=[];
 for(let i=0;i<contours.length;i++){
  const contour=contours[i];if(contour.role!=='hole')continue;
  const hole=new Path2D(bezierPath([contour])),bounds=contourBounds(contour);
  // Only alter an actually visible hole, not a negative-winding contour
  // already covered by another positive-winding contour.
  const eligible=p=>(!bounds||p.x>=bounds.minX&&p.x<=bounds.maxX&&
                    p.y>=bounds.minY&&p.y<=bounds.maxY)&&
                    ctx.isPointInPath(hole,p.x,p.y,'nonzero')&&
                    !ctx.isPointInPath(combined,p.x,p.y,'nonzero');
  if(candidates?candidates.some(eligible):pixels.some(at=>eligible({x:at%w+.5,y:Math.floor(at/w)+.5})))result.push(i);
 }
 return result;
}
function applyFilledPixels(pixels,description,fromSelection=false,vectorHoles=[],inkAlpha=null,clip=null){
 if(!pixels.length&&!vectorHoles.length){status('Nothing unfilled was found in this area.',true);return false;}
 const w=ARTBOARD_WIDTH,h=ARTBOARD_HEIGHT,key=glyphKey(slotIndex);
 const before=cloned(project.glyphs[key]);
 const fillPixels=inkAlpha?fillWithAntialiasFringe(inkAlpha,w,h,pixels,clip):pixels;
 if(fillPixels.length){
  const image=ctx.getImageData(0,0,w,h),data=image.data;
  for(const at of fillPixels){const n=at*4;data[n]=17;data[n+1]=17;data[n+2]=25;data[n+3]=255;}
  ctx.putImageData(image,0,0);
 }
 if(vectorHoles.length){
  const g=project.glyphs[key],holes=new Set(vectorHoles);
  g.bezierContours=g.bezierContours.map((c,i)=>holes.has(i)?{...c,role:'fill'}:c);
 }
 commitGlyph();
 if(fromSelection)recordChange('selectionFill',key,before,project.glyphs[key],{
   selection:cloned(selection),selectionPolygon:cloned(selectionPolygon),selectionTool:tool
 });
 else recordChange('glyph',key,before,project.glyphs[key]);
 renderBezierOverlay();renderSelectionOverlay();refreshSelectionToolbar();status(`${description} Undo reverses it.`);
 return true;
}
function fillRasterRegion(p){
 const x=Math.floor(p.x),y=Math.floor(p.y),w=ARTBOARD_WIDTH,h=ARTBOARD_HEIGHT;
 if(x<0||x>=w||y<0||y>=h)return false;
 // Check vector holes before checking alpha: the centre may already contain
 // raster ink from a previous fill, but the vector hole still needs closing.
 const holes=vectorHolesAtFill([],{x:p.x,y:p.y});
 const alpha=editableInkAlpha(),at=y*w+x;
 if(alpha[at]>=FILL_INK_ALPHA&&!holes.length){status('Click an unfilled area inside an editable outline.',true);return false;}
 const pixels=alpha[at]<FILL_INK_ALPHA?enclosedFillPixels(alpha,w,h,x,y):[];
 if(!pixels.length&&!holes.length){status('This area is open. Close the pencil or vector outline first, or use Select → Fill to paint a selected area.',true);return false;}
 return applyFilledPixels(pixels,'Enclosed region filled.',false,holes,alpha);
}
// Press Fill while a selection is active: enclose whole holes rather than
// leaving a one-pixel antialias seam at their existing vector boundaries.
function fillSelectedRegion(){
 if(typeof editableLayerOrWarn==='function'&&!editableLayerOrWarn())return;
 if(!nonemptySelection(selection))return false;
 const w=ARTBOARD_WIDTH,h=ARTBOARD_HEIGHT;
 const clip=newRasterCanvas(w,h),g=clip.getContext('2d',{willReadFrequently:true});
 g.fillStyle='#000';g.beginPath();
 if(selectionPolygon?.length>=3){selectionPolygon.forEach((p,i)=>i?g.lineTo(p.x,p.y):g.moveTo(p.x,p.y));g.closePath();}
 else g.rect(selection.x,selection.y,selection.width,selection.height);
 g.fill();
 const rgba=g.getImageData(0,0,w,h).data,inside=new Uint8Array(w*h);
 for(let i=0;i<inside.length;i++)inside[i]=rgba[i*4+3]>=64?1:0;
 const alpha=editableInkAlpha(),pixels=selectedFillPixels(alpha,w,h,inside);
 // Don't spill outside a bare rectangle/lasso. If the selected pixel(s)
 // belong to a larger enclosed component, fill its entire hole instead.
 const clipFringe=pixels.some(i=>!inside[i])?null:inside;
 const holes=vectorHolesAtFill(pixels.length?pixels:Array.from(inside.keys()).filter(i=>inside[i]));
 return applyFilledPixels(pixels,'Selected area filled.',true,holes,alpha,clipFringe);
}
// Delete the selected ink on the active editable layer. A vector contour that
// crosses the selection is transferred to this layer's raster ink before the
// mask is subtracted. Other vector contours stay editable, and the original
// imported-font reference is not part of this operation.
function eraseSelectedRegion(){
 if(!nonemptySelection(selection)||!['select','lasso'].includes(tool))return false;
 if(typeof selectedObjectIndices!=='undefined'&&selectedObjectIndices!==null){deleteSelectedArtwork();return true;}
 if(!editableLayerOrWarn())return false;
 if(drawing||selectionDrag||bezierInteraction||curvePending||bezierDraft.length){
  status('Finish the current drawing gesture before erasing the selection.',true);return false;
 }
 const w=ARTBOARD_WIDTH,h=ARTBOARD_HEIGHT,key=glyphKey(slotIndex);
 const mask=newRasterCanvas(w,h),mc=mask.getContext('2d');
 mc.fillStyle='#000';
 if(selectionPolygon?.length>=3){
  mc.beginPath();selectionPolygon.forEach((p,i)=>i?mc.lineTo(p.x,p.y):mc.moveTo(p.x,p.y));mc.closePath();mc.fill();
 }else mc.fillRect(selection.x,selection.y,selection.width,selection.height);
 const rgba=mc.getImageData(0,0,w,h).data;
 const raster=ctx.getImageData(0,0,w,h).data;
 let rasterChanged=false;
 for(let i=3;i<rgba.length;i+=4){if(rgba[i]&&raster[i]){rasterChanged=true;break;}}
 const contours=project.glyphs[key]?.bezierContours||[];
 const converted=rasterizeVectorsCrossedByMask(contours,mask,w,h,newRasterCanvas);
 if(!rasterChanged&&!converted.indices.length){status('No editable ink inside the selection. Other layers and the imported reference were not changed.');return false;}
 const before=cloned(project.glyphs[key]);
 if(converted.indices.length){
  const removed=new Set(converted.indices),g=bezierEntry();
  const selectedContours=converted.indices.map(i=>g.bezierContours[i]);
  const vertices=selectionPolygon?.length>=3?selectionPolygon:[
   {x:selection.x,y:selection.y},{x:selection.x+selection.width,y:selection.y},
   {x:selection.x+selection.width,y:selection.y+selection.height},{x:selection.x,y:selection.y+selection.height}
  ];
  const selectionPath=`M ${vertices.map(p=>`${p.x} ${p.y}`).join(' L ')} Z`;
  try{
   const result=booleanPaths(bezierPath(selectedContours),selectionPath,'subtract',{tolerance:.3});
   const first=converted.indices[0];
   g.bezierContours=g.bezierContours.filter((_,i)=>!removed.has(i));
   g.bezierContours.splice(first,0,...result.contours);
   selectedBezierContour=-1;selectedBezierNode=-1;selectedStroke=-1;joinEndpoints=[];
  }catch(error){status('Selection eraser preserved the artwork because vector geometry failed: '+String(error.message||error),true);return false;}
 }
 // destination-out uses the mask's antialiased edges, keeping the selection
 // boundary and ALL pixels outside it untouched.
 ctx.save();ctx.globalCompositeOperation='destination-out';ctx.drawImage(mask,0,0);ctx.restore();
 commitGlyph();
 recordChange('selectionErase',key,before,project.glyphs[key],{
  selection:cloned(selection),selectionPolygon:cloned(selectionPolygon),selectionTool:tool
 });
 renderBezierOverlay();renderSelectionOverlay();refreshSelectionToolbar();
 status(`Erased selected editable ink. Undo restores it.${converted.indices.length?' Remaining vector contours stay editable.':''}`);
 return true;
}
// With an active selection, Fill and Eraser are actions rather than mode
// changes; the same selection, handles and canvas camera remain visible.
function chooseTool(next){
 if(next==='fill'&&nonemptySelection(selection)&&['select','lasso'].includes(tool)){
  if(typeof selectedObjectIndices!=='undefined'&&selectedObjectIndices!==null){status('This selects a vector object, not a fill area. Drag a Select rectangle or Lasso to fill a region.');return;}
  fillSelectedRegion();return;}
 if(next==='eraser'&&nonemptySelection(selection)&&['select','lasso'].includes(tool)){eraseSelectedRegion();return;}
 setTool(next);
}
// Paint-style marquee selection for previously drawn raster and editable
// Bézier paths.  Deliberately excludes the read-only grey imported reference.
function renderSelectionOverlay(){
 const root=$('selectionOverlay');if(!root)return;
 root.replaceChildren();const r=marquee||selection;
 if(!nonemptySelection(r)||!['select','lasso'].includes(tool))return;
 const poly=marqueePolygon||selectionPolygon;
 const attrs={fill:'#8a63c9','fill-opacity':.075,stroke:'#6745a7','stroke-width':1.3,
   'stroke-dasharray':'5 4',class:'selection-marquee'};
 if(poly?.length>=3)addSvgEl('polygon',{points:poly.map(p=>`${p.x},${p.y}`).join(' '),...attrs},root);
 else addSvgEl('rect',{x:r.x,y:r.y,width:r.width,height:r.height,rx:0,...attrs},root);
 if(!marquee&&nonemptySelection(selection)){
  for(const h of selectionHandlePoints(selection)){
   addSvgEl('rect',{x:h.x-5,y:h.y-5,width:10,height:10,rx:1.5,
    'data-selection-handle':h.id,class:'selection-resize-handle'},root);
  }
 }
}
function refreshSelectionToolbar(){
 const active=tool==='select'||tool==='lasso',selected=active&&nonemptySelection(selection);
 const bar=$('selectionActions');if(bar)bar.hidden=!active;
 for(const id of ['btnSelectionCut','btnSelectionCopy','btnSelectionDuplicate','btnSelectionCrop','btnSelectionDelete','btnSelectionRotateLeft','btnSelectionRotateRight','btnSelectionFlipH','btnSelectionFlipV','btnSelectionRotate','btnSelectionScale']){
  if($(id))$(id).disabled=!selected;
 }
 if($('btnSelectionPaste'))$('btnSelectionPaste').disabled=!selectionClipboard;
 if($('btnPasteGlyph'))$('btnPasteGlyph').disabled=!selectionClipboard;
 if($('btnReplaceGlyph'))$('btnReplaceGlyph').disabled=!selectionClipboard;
 const fillButton=document.querySelector('[data-tool="fill"]');
 if(fillButton){const canFillSelection=active&&nonemptySelection(selection);fillButton.title=canFillSelection?'Fill the selected area without deselecting; enclosed gaps inside the selection are filled first':'Click inside a closed pencil or vector outline to fill it';fillButton.setAttribute('aria-label',canFillSelection?'Fill selected area':'Fill enclosed region');}
 const eraseButton=document.querySelector('[data-tool="eraser"]');
 if(eraseButton){const canEraseSelection=selected;eraseButton.title=canEraseSelection?'Erase editable ink within the selected area; keep the selection and allow Undo':'Drag over editable ink to erase it';eraseButton.setAttribute('aria-label',canEraseSelection?'Erase selected area':'Freehand eraser');}
}
function newRasterCanvas(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;return c;}
function selectedArtwork(){
 if(!nonemptySelection(selection))return null;
 const r=selection,bitmap=newRasterCanvas(r.width,r.height);
 if(typeof selectedObjectIndices==='undefined'||selectedObjectIndices===null)bitmap.getContext('2d').drawImage(canvas,r.x,r.y,r.width,r.height,0,0,r.width,r.height);
 const contours=project?.glyphs?.[slotIndex]?.bezierContours||[];
 const chosen=(typeof selectedObjectIndices!=='undefined'&&selectedObjectIndices!==null)?selectedObjectIndices.filter(i=>i>=0&&i<contours.length):selectionPolygon?contours.map((c,i)=>contourWithinPolygon(c,selectionPolygon)?i:-1).filter(i=>i>=0):chosenContourIndices(contours,r);
 if(selectionPolygon){
  const bc=bitmap.getContext('2d');bc.save();bc.globalCompositeOperation='destination-in';
  bc.beginPath();selectionPolygon.forEach((p,i)=>i?bc.lineTo(p.x-r.x,p.y-r.y):bc.moveTo(p.x-r.x,p.y-r.y));
  bc.closePath();bc.fill();bc.restore();
 }
 const rgba=bitmap.getContext('2d',{willReadFrequently:true}).getImageData(0,0,r.width,r.height).data;
 let hasPixels=false;for(let i=3;i<rgba.length;i+=4)if(rgba[i]){hasPixels=true;break;}
 return {rect:{...r},bitmap,indices:chosen,contours:chosen.map(i=>structuredClone(contours[i])),hasPixels};
}
// Smooth *existing* editable artwork; the percentage slider also controls
// subsequent freehand Pencil/Eraser strokes. A completed smoothing action is
// one Undo step and uses the normal glyph / WASM export representation.
function smoothExistingOutline(){
 if(typeof editableLayerOrWarn==='function'&&!editableLayerOrWarn())return;
 if(!project||drawing||bezierInteraction||bezierDraft.length||curvePending){
  status('Finish the active stroke or Bézier outline before smoothing.',true);return;
 }
 const amount=Number($('strokeSmoothing').value);
 if(!amount){status('Set Smooth above 0%, then press Smooth outline.');return;}
 const key=glyphKey(slotIndex),before=cloned(project.glyphs[key]);
 const g=bezierEntry(),contours=g.bezierContours||[];
 const region=nonemptySelection(selection)?selection:null;
 const selectMode=!!region&&['select','lasso'].includes(tool);
 const weights=selectMode?selectionSmoothingWeights(ARTBOARD_WIDTH,ARTBOARD_HEIGHT,region,selectionPolygon):null;
 const picked=(tool==='bezier'&&selectedBezierContour>=0)?[selectedBezierContour]:
     selectMode&&selectedObjectIndices!==null?selectedObjectIndices.slice():
     contours.map((_,i)=>i);
 let vectors=0;
 for(const idx of picked){
  const old=contours[idx];if(!old)continue;
  // A partially selected vector is no longer an error: only its safely
  // enclosed Bézier segments move. Segments crossing the selection's
  // protected edge band keep their exact original control points.
  const next=selectMode?smoothSelectedBezierOutline(old,amount,weights,ARTBOARD_WIDTH,ARTBOARD_HEIGHT):
   smoothBezierOutline(old,amount);
  if(JSON.stringify(old)!==JSON.stringify(next)){contours[idx]=next;vectors++;}
 }
 let pixels=false;
 const original=ctx.getImageData(0,0,ARTBOARD_WIDTH,ARTBOARD_HEIGHT);
 const hasRaster=original.data.some((v,i)=>i%4===3&&v>0);
 if(hasRaster){
  // Smooth the actual pencil-ink contours, not just its antialiased pixels.
  // The high-resolution redraw makes continuous cubic boundaries, including
  // preserved counters/holes, and commits through the normal raster/TTF path.
  const boundaries=rasterInkContours(original.data,ARTBOARD_WIDTH,ARTBOARD_HEIGHT,amount);
  const smoothLayer=newRasterCanvas(ARTBOARD_WIDTH*2,ARTBOARD_HEIGHT*2);
  const smCtx=smoothLayer.getContext('2d');
  smCtx.scale(2,2);smCtx.fillStyle='#111119';
  if(boundaries.length)smCtx.fill(new Path2D(bezierPath(boundaries)),'nonzero');
  const reducedLayer=newRasterCanvas(ARTBOARD_WIDTH,ARTBOARD_HEIGHT);
  const reducedCtx=reducedLayer.getContext('2d',{willReadFrequently:true});
  reducedCtx.imageSmoothingEnabled=true;
  reducedCtx.imageSmoothingQuality='high';
  reducedCtx.drawImage(smoothLayer,0,0,ARTBOARD_WIDTH,ARTBOARD_HEIGHT);
  const result=boundaries.length?reducedCtx.getImageData(0,0,ARTBOARD_WIDTH,ARTBOARD_HEIGHT).data:
   smoothRasterInk(original.data,ARTBOARD_WIDTH,ARTBOARD_HEIGHT,amount);
  if(selectMode){
   const blended=blendSelectedRasterSmoothing(original.data,result,weights);
   pixels=blended.changed;
   if(pixels){const out=ctx.createImageData(ARTBOARD_WIDTH,ARTBOARD_HEIGHT);out.data.set(blended.data);ctx.putImageData(out,0,0);}
  }else{
   const out=ctx.createImageData(ARTBOARD_WIDTH,ARTBOARD_HEIGHT);
   out.data.set(original.data);
   for(let i=0;i<ARTBOARD_WIDTH*ARTBOARD_HEIGHT;i++){
    const offset=i*4,alpha=result[offset+3];
    if(original.data[offset+3]!==alpha){pixels=true;out.data[offset]=17;out.data[offset+1]=17;out.data[offset+2]=25;out.data[offset+3]=alpha;}
   }
   if(pixels)ctx.putImageData(out,0,0);
  }
 }
 if(!vectors&&!pixels){status(selectMode?'No changes inside the selection. Widen it to leave room for the protected border, or raise Smooth.':'No editable outline needs smoothing here. Draw an outline first.');return;}
 commitGlyph();recordChange(selectMode?'selectionSmooth':'glyph',key,before,project.glyphs[key],selectMode?{selection:cloned(selection),selectionPolygon:cloned(selectionPolygon),selectionTool:tool}:null);
 renderBezierOverlay();renderSelectionOverlay();
 status(`Curves smoothed at ${amount}%${vectors?` · ${vectors} vector contour${vectors===1?'':'s'}`:''}${pixels?' · painted outline redrawn':''}${selectMode?' · selected-area boundary protected':''}. Undo restores the original.`);
}
// The Width slider edits existing selected ink and complete selected contours.
// Each selection uses one frozen baseline and one coalesced history entry,
// including separate pointer drags on the slider until selection changes.
function resizeActiveSelectionWidth(){
 if(typeof editableLayerOrWarn==='function'&&!editableLayerOrWarn())return;
 if(!project||!nonemptySelection(selection)||!['select','lasso'].includes(tool))return;
 const key=glyphKey(slotIndex);
 if(!selectedWidthSession&&partialVectorInSelection()){
  status('Select the entire Bézier contour to change its width; partial vector outlines remain editable with Edit path.',true);return;
 }
 if(selectedWidthSession&&(selectedWidthSession.key!==key||
     selectedWidthSession.entry&&history.at(-1)!==selectedWidthSession.entry))selectedWidthSession=null;
 if(!selectedWidthSession){
  const art=selectedArtwork();
  if(!art||!art.hasPixels&&!art.contours.length)return;
  const base=newRasterCanvas(ARTBOARD_WIDTH,ARTBOARD_HEIGHT);
  base.getContext('2d').drawImage(canvas,0,0);
  selectedWidthSession={key,art,base,before:cloned(project.glyphs[key]),
   selection:cloned(selection),polygon:cloned(selectionPolygon),selectionTool:tool,
   initialWidth:brushWidth(),entry:null};
  // The input event has already changed the slider. Capture the starting
  // brush setting at selection creation, not the first updated value.
  selectedWidthSession.initialWidth=selectedWidthStart??DEFAULT_BRUSH;
 }
 const session=selectedWidthSession,finalWidth=brushWidth(),delta=finalWidth-session.initialWidth;
 clearCanvas();ctx.drawImage(session.base,0,0);
 if(Math.abs(delta)>.001){
  const r=session.art.rect;
  eraseSelectedRaster(r,session.polygon);
  if(session.art.hasPixels){
   const source=session.art.bitmap.getContext('2d',{willReadFrequently:true}).getImageData(0,0,r.width,r.height);
   const result=resizeSelectedInk(source.data,r.width,r.height,delta);
   source.data.set(result);
   const expanded=newRasterCanvas(r.width,r.height);
   expanded.getContext('2d').putImageData(source,0,0);
   ctx.save();
   if(session.polygon?.length){
    ctx.beginPath();session.polygon.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));
    ctx.closePath();ctx.clip();
   }
   ctx.drawImage(expanded,r.x,r.y);ctx.restore();
  }
 }
 const g=cloned(session.before)||{};
 if(g.bezierContours?.length&&Math.abs(delta)>.001){
  session.art.indices.forEach((idx,j)=>{g.bezierContours[idx]=offsetSelectedContour(session.art.contours[j],delta);});
 }
 project.glyphs[key]=g;
 commitGlyph();renderBezierOverlay();renderSelectionOverlay();
 if(Math.abs(delta)<.001&&session.entry){
  // Preserve undo/redo of the whole gesture, even when the slider returns
  // to its original position. No extra history entries are introduced.
  session.entry.after=cloned(project.glyphs[key]);session.entry.finalWidth=finalWidth;
 }else if(!session.entry&&Math.abs(delta)>.001){
  session.entry=recordChange('selectedWidth',key,session.before,project.glyphs[key],{
   selection:session.selection,selectionPolygon:session.polygon,
   selectionTool:session.selectionTool,initialWidth:session.initialWidth,finalWidth
  });
 }else if(session.entry){
  session.entry.after=cloned(project.glyphs[key]);session.entry.finalWidth=finalWidth;
  invalidateCompiledPreview();saveSoon();
 }
 status('Changed selected ink width. One Undo restores the selection starting width.');
}
function copySelection(){
 if(partialVectorInSelection()){status('Selection intersects an incomplete vector contour. Enclose the whole contour before copying.',true);return false;}
 const art=selectedArtwork();if(!art){status('Draw a selection rectangle first.',true);return false;}
 if(!art.hasPixels&&!art.contours.length){status('Nothing editable in the selection. Use Copy glyph to copy the grey imported vector reference.',true);return false;}
 selectionClipboard={rect:art.rect,bitmap:art.bitmap,contours:art.contours,polygon:cloned(selectionPolygon),pastes:0,source:clipboardSource()};
 refreshSelectionToolbar();status(`Copied selected artwork (${art.contours.length} Bézier contours).`);return true;
}
function selectedGestureStart(ev,handle=null){
 if(typeof editableLayerOrWarn==='function'&&!editableLayerOrWarn())return false;
 const art=selectedArtwork();
 // A pasted raster/complete contour may overlap another vector contour that
 // crosses the selection boundary. Move only the artwork fully selected by
 // selectedArtwork(); never block the valid paste because of unrelated paths.
 // Partially selected Bézier contours themselves remain untouched.
 if(!art||(!art.hasPixels&&!art.contours.length)){
  status(partialVectorInSelection()
   ? 'A Bézier contour crosses this selection. Enclose the entire contour before moving it, or edit its anchors with Edit path.'
   : 'The selection has no editable black artwork. Original reference artwork is read-only.',true);
  return false;
 }
 const base=newRasterCanvas(ARTBOARD_WIDTH,ARTBOARD_HEIGHT);
 base.getContext('2d').drawImage(canvas,0,0);
 selectionDrag={pointerId:ev?.pointerId??null,start:ev?canvasPos(ev):{x:0,y:0},
  original:art,originalPolygon:cloned(selectionPolygon),base,before:cloned(project.glyphs[glyphKey(slotIndex)]),dx:0,dy:0,
  mode:handle?'resize':'move',handle,targetRect:cloned(art.rect),changed:false,selectionTool:tool};
 return true;
}
function redrawSelectionDrag(dx,dy){
 if(!selectionDrag)return;const d=selectionDrag,r=d.original.rect;
 const cx=Math.max(-r.x,Math.min(ARTBOARD_WIDTH-r.x-r.width,Math.round(dx)));
 const cy=Math.max(-r.y,Math.min(ARTBOARD_HEIGHT-r.y-r.height,Math.round(dy)));
 d.dx=cx;d.dy=cy;
 clearCanvas();ctx.drawImage(d.base,0,0);
 // Cut only selected pixels; do not alter any artwork outside the marquee.
 eraseSelectedRaster(r,d.originalPolygon);
 ctx.drawImage(d.original.bitmap,r.x+cx,r.y+cy);
 const before=d.before||{},g=structuredClone(before);
 if(Array.isArray(g.bezierContours)){
  for(const idx of d.original.indices)g.bezierContours[idx]=translateContour(before.bezierContours[idx],cx,cy);
  g.path=combineGlyphPaths(g.rasterPath,g.bezierContours);
 }
 project.glyphs[glyphKey(slotIndex)]=g;
 selection=translatedRect(r,cx,cy);selectedWidthStart=brushWidth();selectionPolygon=movePolygon(d.originalPolygon,cx,cy);
 renderBezierOverlay();renderSelectionOverlay();
}
// On-canvas resize handles work on frozen original pixels and original Bézier
// control points. Never resample intermediate drag frames or modify the guide.
function redrawSelectionResize(pointer,freeAspect=false){
 const d=selectionDrag;if(!d||d.mode!=='resize')return;
 const result=resizeSelectionByHandle(d.original.rect,d.handle,pointer,{
  boardWidth:ARTBOARD_WIDTH,boardHeight:ARTBOARD_HEIGHT,freeAspect
 });
 if(!result)return;
 const {rect,matrix}=result,r=d.original.rect;
 d.targetRect=rect;
 d.changed=rect.x!==r.x||rect.y!==r.y||rect.width!==r.width||rect.height!==r.height;
 clearCanvas();ctx.drawImage(d.base,0,0);
 eraseSelectedRaster(r,d.originalPolygon);
 if(d.original.hasPixels){
  ctx.save();ctx.globalCompositeOperation='source-over';
  ctx.drawImage(d.original.bitmap,rect.x,rect.y,rect.width,rect.height);
  ctx.restore();
 }
 const before=d.before||{},g=structuredClone(before);
 if(Array.isArray(g.bezierContours)){
  for(const idx of d.original.indices)g.bezierContours[idx]=affineContour(before.bezierContours[idx],matrix);
 }
 project.glyphs[glyphKey(slotIndex)]=g;
 selection=rect;selectionPolygon=transformSelectionPolygon(d.originalPolygon,matrix);
 renderBezierOverlay();renderSelectionOverlay();
}
function finishSelectionDrag(){
 if(!selectionDrag)return;
 const d=selectionDrag;selectionDrag=null;
 const changed=d.mode==='resize'?d.changed:!!(d.dx||d.dy);
 if(!changed){
  project.glyphs[glyphKey(slotIndex)]=d.before||{};
  clearCanvas();ctx.drawImage(d.base,0,0);
  selection=cloned(d.original.rect);selectionPolygon=cloned(d.originalPolygon);
  renderBezierOverlay();renderSelectionOverlay();return;
 }
 selectedWidthSession=null;clearTimeout(traceTimer);
 commitGlyph();recordChange('selectionTransform',glyphKey(slotIndex),d.before,project.glyphs[glyphKey(slotIndex)],{
  beforeSelection:cloned(d.original.rect),afterSelection:cloned(selection),
  beforePolygon:cloned(d.originalPolygon),afterPolygon:cloned(selectionPolygon),
  selectionTool:d.selectionTool
 });
 renderBezierOverlay();renderSelectionOverlay();refreshSelectionToolbar();
 if(d.mode==='resize')status('Resized selected artwork. One Undo restores the original size.');
 else status(`Moved selected artwork ${d.dx} horizontally and ${d.dy} vertically. Undo reverses the move.`);
}
function selectionPointerDown(ev){
 ev.preventDefault();
 const p=canvasPos(ev),rect=selection;
 // Handle hit-testing uses artboard units; tolerances are specified in
 // screen pixels so selection remains easy to grab at any canvas zoom.
 const screenScale=ARTBOARD_WIDTH/Math.max(1,canvas.getBoundingClientRect().width);
 const tolerance=Math.max(9,11*screenScale);
 const handle=nonemptySelection(rect)?hitSelectionHandle(p,rect,tolerance):null;
 const inside=nonemptySelection(rect)&&hitSelectionBody(p,rect,4*screenScale);
 if(handle||inside){
  // A pasted selection must not disappear when the gesture is rejected (for
  // example by a partially intersecting vector contour). In that case keep
  // the selection/handles and the specific diagnostic from selectedGestureStart.
  if(selectedGestureStart(ev,handle)){
   canvas.setPointerCapture(ev.pointerId);
   canvas.style.cursor=handle?SELECTION_HANDLE_CURSORS[handle]:'move';
  }
  return;
 }
 // Only a deliberate click/drag away from the current selection starts a new
 // marquee; never clear selection merely because a move failed to start.
 canvas.setPointerCapture(ev.pointerId);
 selectedWidthSession=null;selection=null;selectionPolygon=null;selectedObjectIndices=null;marquee=makeSelectionRect(p,p,ARTBOARD_WIDTH,ARTBOARD_HEIGHT);
 marqueePolygon=tool==='lasso'?[p]:null;
 selectionDrag={pointerId:ev.pointerId,start:p,mode:tool==='lasso'?'lasso':'marquee',clickPoint:p};
 renderSelectionOverlay();refreshSelectionToolbar();
}
function selectionPointerMove(ev){
 const d=selectionDrag;
 if(!d){
  const p=canvasPos(ev);
  const tolerance=Math.max(9,11*ARTBOARD_WIDTH/Math.max(1,canvas.getBoundingClientRect().width));
  const handle=nonemptySelection(selection)?hitSelectionHandle(p,selection,tolerance):null;
  const inside=nonemptySelection(selection)&&hitSelectionBody(p,selection,
   4*ARTBOARD_WIDTH/Math.max(1,canvas.getBoundingClientRect().width));
  canvas.style.cursor=handle?SELECTION_HANDLE_CURSORS[handle]:(inside?'move':'crosshair');
  return;
 }
 if(d.pointerId!==ev.pointerId)return;
 ev.preventDefault();const p=canvasPos(ev);
 if(d.mode==='marquee'){
  marquee=makeSelectionRect(d.start,p,ARTBOARD_WIDTH,ARTBOARD_HEIGHT);renderSelectionOverlay();
 }else if(d.mode==='lasso'){
  if(Math.hypot(p.x-marqueePolygon.at(-1).x,p.y-marqueePolygon.at(-1).y)>=2)marqueePolygon.push(p);
  marquee=polygonBounds(marqueePolygon,ARTBOARD_WIDTH,ARTBOARD_HEIGHT);renderSelectionOverlay();
 }else if(d.mode==='resize')redrawSelectionResize(p,ev.shiftKey);
 else redrawSelectionDrag(p.x-d.start.x,p.y-d.start.y);
}
function selectionPointerUp(ev){
 if(!selectionDrag||selectionDrag.pointerId!==ev.pointerId)return;
 if(ev.type==='pointercancel'&&(selectionDrag.mode==='move'||selectionDrag.mode==='resize')){
  const d=selectionDrag;
  project.glyphs[glyphKey(slotIndex)]=d.before||{};
  clearCanvas();ctx.drawImage(d.base,0,0);
  selection=cloned(d.original.rect);selectionPolygon=cloned(d.originalPolygon);
  selectionDrag=null;renderBezierOverlay();renderSelectionOverlay();
 }else if(selectionDrag.mode==='marquee'||selectionDrag.mode==='lasso'){
  const isLasso=selectionDrag.mode==='lasso';
  selection=nonemptySelection(marquee)&&(!isLasso||marqueePolygon?.length>=3)?marquee:null;
  selectionPolygon=selection&&isLasso?marqueePolygon:null;
  // A click selects the topmost editable object; a drag still draws the
  // original marquee. This makes ordinary Select behaviour discoverable.
  if(!selection&&!isLasso&&tool==='select'){
   const g=project?.glyphs?.[glyphKey(slotIndex)],hit=hitEditableObject(g?.bezierContours||[],selectionDrag.clickPoint,{
    edgeTolerance:Math.max(4,7*ARTBOARD_WIDTH/Math.max(1,canvas.getBoundingClientRect().width))
   });
   if(hit){const bounds=editableObjectBounds(g.bezierContours[hit.index]);
    if(bounds){selection=bounds;selectedObjectIndices=[hit.index];status('Object selected. Drag to move, resize with handles, or press Delete.');}
   }
  }
  if(selection)selectedWidthStart=brushWidth();
  marquee=null;marqueePolygon=null;selectionDrag=null;
  renderSelectionOverlay();refreshSelectionToolbar();
  if(selection&&selectedObjectIndices===null)status('Selected. Press Fill to paint this area, drag inside to move, or drag a handle to resize.');
 }else finishSelectionDrag();
 if(canvas.hasPointerCapture(ev.pointerId))canvas.releasePointerCapture(ev.pointerId);
}
function cancelSelection(){selectedWidthSession=null;marquee=null;selection=null;marqueePolygon=null;selectionPolygon=null;selectionDrag=null;selectedObjectIndices=null;canvas.style.cursor='';renderSelectionOverlay();refreshSelectionToolbar();}
function selectAllArtwork(){
 if(!project)return;selectedWidthSession=null;selectedObjectIndices=null;selection=editableInkBounds();marquee=null;selectionPolygon=null;marqueePolygon=null;
 if(!selection){status('There is no editable artwork to select. Use Copy glyph to copy the original imported vector.',true);return;}
 selectedWidthStart=brushWidth();setTool('select');renderSelectionOverlay();refreshSelectionToolbar();
 status('Whole glyph drawing selected (original grey guide excluded).');
}
function deleteSelectedArtwork(){
 if(typeof editableLayerOrWarn==='function'&&!editableLayerOrWarn())return;
 if(partialVectorInSelection()){status('A Bézier contour crosses the selection boundary. Select the complete contour before deleting; partial erasing is supported on pencil ink.',true);return;}
 const art=selectedArtwork();if(!art)return;
 if(!art.hasPixels&&!art.contours.length){status('Selection contains no editable artwork.',true);return;}
 const key=glyphKey(slotIndex),before=cloned(project.glyphs[key]);
 if(typeof selectedObjectIndices==='undefined'||selectedObjectIndices===null)eraseSelectedRaster(art.rect,selectionPolygon);
 const g=project.glyphs[key];if(g?.bezierContours?.length){
  const chosen=new Set(art.indices);g.bezierContours=g.bezierContours.filter((_,i)=>!chosen.has(i));
 }
 commitGlyph();recordChange('glyph',key,before,project.glyphs[key]);
 if(typeof selectedObjectIndices!=='undefined'&&selectedObjectIndices!==null)selectedObjectIndices=[];
 renderBezierOverlay();renderSelectionOverlay();status('Deleted selected drawing. Undo restores it.');
}
function cutSelection(){if(!copySelection())return;deleteSelectedArtwork();status('Cut selection to the editor clipboard.');}
function cropSelection(){
 if(typeof editableLayerOrWarn==='function'&&!editableLayerOrWarn())return;
 const art=selectedArtwork();if(!art)return;
 if(selectionPolygon){status('Crop is rectangular only. Switch to Select and draw a rectangle.',true);return;}
 const g=project.glyphs[glyphKey(slotIndex)],contours=g?.bezierContours||[];
 if(contours.some(c=>classifyContour(c,art.rect)==='partial')){
  status('Crop stopped: a Bézier contour crosses the rectangle. Adjust the selection to include the whole contour; the editor will not silently flatten it.',true);return;
 }
 const before=cloned(g),r=art.rect;
 ctx.clearRect(0,0,ARTBOARD_WIDTH,r.y);
 ctx.clearRect(0,r.y+r.height,ARTBOARD_WIDTH,ARTBOARD_HEIGHT-r.y-r.height);
 ctx.clearRect(0,r.y,r.x,r.height);
 ctx.clearRect(r.x+r.width,r.y,ARTBOARD_WIDTH-r.x-r.width,r.height);
 if(g?.bezierContours)g.bezierContours=g.bezierContours.filter(c=>classifyContour(c,r)==='inside');
 commitGlyph();recordChange('glyph',glyphKey(slotIndex),before,project.glyphs[glyphKey(slotIndex)]);
 renderBezierOverlay();renderSelectionOverlay();status('Cropped editable artwork to selection. Font metrics and original reference remain unchanged.');
}
function partialVectorInSelection(){
 if(typeof selectedObjectIndices!=='undefined'&&selectedObjectIndices!==null)return false;
 return !!(selection&&(project?.glyphs?.[slotIndex]?.bezierContours||[]).some(c=>{
  const t=classifyContour(c,selection);return t!=='outside'&& (t==='partial'||selectionPolygon&&!contourWithinPolygon(c,selectionPolygon));
 }));
}
function eraseSelectedRaster(rect,polygon){
 if(typeof selectedObjectIndices!=='undefined'&&selectedObjectIndices!==null)return; // Object mode edits only its own vector contour.
 if(!polygon?.length){ctx.clearRect(rect.x,rect.y,rect.width,rect.height);return;}
 ctx.save();ctx.globalCompositeOperation='destination-out';ctx.beginPath();
 polygon.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.fill();ctx.restore();
}
function editableInkBounds(){
 let x0=ARTBOARD_WIDTH,y0=ARTBOARD_HEIGHT,x1=-1,y1=-1;
 const data=ctx.getImageData(0,0,ARTBOARD_WIDTH,ARTBOARD_HEIGHT).data;
 for(let y=0;y<ARTBOARD_HEIGHT;y++)for(let x=0;x<ARTBOARD_WIDTH;x++){
  if(data[(y*ARTBOARD_WIDTH+x)*4+3]<=30)continue;
  x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x+1);y1=Math.max(y1,y+1);
 }
 for(const c of project?.glyphs?.[slotIndex]?.bezierContours||[]){
  const b=contourBounds(c);if(!b)continue;x0=Math.min(x0,b.minX);x1=Math.max(x1,b.maxX);y0=Math.min(y0,b.minY);y1=Math.max(y1,b.maxY);
 }
 if(x1<=x0||y1<=y0)return null;
 return {x:Math.max(0,Math.floor(x0-2)),y:Math.max(0,Math.floor(y0-2)),
  width:Math.min(ARTBOARD_WIDTH,Math.ceil(x1+2))-Math.max(0,Math.floor(x0-2)),
  height:Math.min(ARTBOARD_HEIGHT,Math.ceil(y1+2))-Math.max(0,Math.floor(y0-2))};
}
function clipboardSource(){return {
 projectId:project.id,projectName:project.name,sourceName:project.sourceFont?.name||null,
 documents:structuredClone(project.licensing?.documents||[])
};}
function clipFromOriginalSource(){
 if(!project?.sourceFont||!sourceGlyphExists(slots[slotIndex]))return false;
 try{
  const data=importedGlyphContours(sourceReferenceBytes(),Number(slots[slotIndex].codepoint),editorShiftFor());
  const xs=[],ys=[];for(const c of data)for(const a of c.points){xs.push(a.x,a.in[0],a.out[0]);ys.push(a.y,a.in[1],a.out[1]);}
  const x=Math.floor(Math.max(0,Math.min(...xs))),y=Math.floor(Math.max(0,Math.min(...ys)));
  const rect={x,y,width:Math.ceil(Math.min(ARTBOARD_WIDTH,Math.max(...xs)))-x,
    height:Math.ceil(Math.min(ARTBOARD_HEIGHT,Math.max(...ys)))-y};
  if(!nonemptySelection(rect))throw Error('Imported outline does not fit the visible glyph artboard');
  selectionClipboard={rect,bitmap:newRasterCanvas(1,1),contours:data,pastes:0,source:clipboardSource()};
  refreshSelectionToolbar();status(`Copied original vector outlines for ${slots[slotIndex].word}. Switch projects and paste to edit them.`);
  return true;
 }catch(e){status('Could not copy imported vector geometry: '+e.message,true);return false;}
}
function copyWholeGlyph(){
 if(!project)return false;
 // An unmodified imported trace is only an editor guide, not original font
 // geometry. Prefer its normalized TTF contours even if the image copy was
 // previously restored as a raster reference; user edits take precedence.
 if(!project.glyphs?.[slotIndex]?.modified && project.sourceFont && sourceGlyphExists(slots[slotIndex])){
  return clipFromOriginalSource();
 }
 const r=editableInkBounds();
 if(r){const oldSelection=selection;selection=r;const copied=copySelection();selection=oldSelection;renderSelectionOverlay();return copied;}
 if(clipFromOriginalSource())return true;
 status('This glyph has no editable artwork or imported vector reference to copy.',true);return false;
}
function mergeClipboardLicences(source){
 const oldDocs=cloned(project.licensing?.documents||[]);
 if(!source||source.projectId===project.id)return oldDocs;
 project.licensing||=defaultLicensing();project.licensing.documents||=[];
 const used=new Set(project.licensing.documents.map(doc=>doc.name.toLowerCase()));
 for(const doc of source.documents||[]){
  if(project.licensing.documents.some(d=>(d.data||d.content)===(doc.data||doc.content)))continue;
  const copy=structuredClone(doc);let name=copy.name||'LICENSE.txt';
  if(used.has(name.toLowerCase()))name=`${source.projectId.slice(0,10)}-${name}`;
  copy.name=name;used.add(name.toLowerCase());project.licensing.documents.push(copy);
 }
 return oldDocs;
}
function pasteSelection({replace=false,offset=true}={}){
 if(typeof editableLayerOrWarn==='function'&&!editableLayerOrWarn())return;
 if(!project)return;
 if(!selectionClipboard){status('Copy a glyph or selected artwork before pasting.',true);return;}
 const clip=selectionClipboard,key=glyphKey(slotIndex),old=cloned(project.glyphs[key]);
 if(replace&&old?.modified&&!confirm(`Replace editable artwork for “${slots[slotIndex].word}”? This can be undone.`))return;
 const dx=offset?(clip.pastes++*12+12):0,dy=dx;
 if(replace){clearCanvas();const g=project.glyphs[key]||{};g.bezierContours=[];project.glyphs[key]=g;}
 if(clip.bitmap?.width>1||clip.bitmap?.height>1)ctx.drawImage(clip.bitmap,clip.rect.x+dx,clip.rect.y+dy);
 const g=project.glyphs[key]||{};g.bezierContours||=[];
 for(const contour of clip.contours)g.bezierContours.push(translateContour(contour,dx,dy));
 if(clip.source&&clip.source.projectId!==project.id){
  g.copiedFrom??=[];g.copiedFrom.push({projectId:clip.source.projectId,projectName:clip.source.projectName,sourceFont:clip.source.sourceName});
 }
 project.glyphs[key]=g;
 const oldDocuments=mergeClipboardLicences(clip.source);
 commitGlyph();
 if(JSON.stringify(oldDocuments)!==JSON.stringify(project.licensing.documents)){
  recordChange('glyphWithLicences',key,{glyph:old,documents:oldDocuments},{glyph:project.glyphs[key],documents:project.licensing.documents});
 }else recordChange('glyph',key,old,project.glyphs[key]);
 setTool('select');
 selectedObjectIndices=null;selection=translatedRect(clip.rect,dx,dy);selectedWidthStart=brushWidth();selectionPolygon=movePolygon(clip.polygon,dx,dy);renderBezierOverlay();renderSelectionOverlay();refreshSelectionToolbar();
 status(`${replace?'Replaced':'Pasted'} glyph vector/paint artwork. Undo restores the previous design.`);
}
function duplicateSelection(){if(copySelection())pasteSelection();}
function nudgeSelection(dx,dy){
 if(!nonemptySelection(selection)||!selectedGestureStart(null))return;
 redrawSelectionDrag(dx,dy);finishSelectionDrag();refreshSelectionToolbar();
}
function transformSelection(m){
 if(typeof editableLayerOrWarn==='function'&&!editableLayerOrWarn())return;
 selectedWidthSession=null;selectedWidthStart=brushWidth();
 if(!nonemptySelection(selection)){status('Select artwork before transforming.',true);return;}
 if(partialVectorInSelection()){status('The selection crosses a vector contour. Enclose the entire contour to rotate, flip or scale it.',true);return;}
 const art=selectedArtwork();if(!art||!art.hasPixels&&!art.contours.length){status('No editable artwork selected.',true);return;}
 const target=rectAfterTransform(art.rect,m);
 if(target.x<0||target.y<0||target.x+target.width>ARTBOARD_WIDTH||target.y+target.height>ARTBOARD_HEIGHT){
  status('Transform would put artwork outside the drawing area. Move or scale it before rotating.',true);return;
 }
 const key=glyphKey(slotIndex),before=cloned(project.glyphs[key]);
 eraseSelectedRaster(art.rect,selectionPolygon);
 if(art.hasPixels){ctx.save();ctx.setTransform(m.a,m.b,m.c,m.d,m.e,m.f);ctx.drawImage(art.bitmap,art.rect.x,art.rect.y);ctx.restore();}
 const g=project.glyphs[key]||{};
 if(g.bezierContours?.length){for(const i of art.indices)g.bezierContours[i]=affineContour(before.bezierContours[i],m);}
 project.glyphs[key]=g;commitGlyph();recordChange('glyph',key,before,project.glyphs[key]);
 selection=target;selectedWidthStart=brushWidth();selectionPolygon=selectionPolygon?.map(p=>({x:m.a*p.x+m.c*p.y+m.e,y:m.b*p.x+m.d*p.y+m.f}));renderSelectionOverlay();renderBezierOverlay();refreshSelectionToolbar();
 status('Transformed selected artwork. Undo reverses this operation.');
}
function rotateSelected(degrees){
 if(!nonemptySelection(selection))return;
 const r=selection;transformSelection(affineRotate(degrees,r.x+r.width/2,r.y+r.height/2));
}
function scaleSelected(sx,sy=sx){
 if(!nonemptySelection(selection))return;
 const r=selection;transformSelection(affineScale(sx,sy,r.x+r.width/2,r.y+r.height/2));
}
// Independent cubic-contour editing. Closed vector paths are stored without
// rasterisation, and every finished contour or handle drag is one undo step.
const bezierDist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function bezierPointerRadius(screenPixels){return bezierRadiusOnCanvas(canvas.getBoundingClientRect(),ARTBOARD_WIDTH,ARTBOARD_HEIGHT,screenPixels);}
function bezierEntry(){const k=glyphKey(slotIndex),old=project.glyphs[k]||{};
 if(Array.isArray(old.bezierContours))return old;
 const g=ensureEditorShift({...old,bezierContours:[],rasterPath:inferRasterPath(old)});
 if(!old.modified&&project.sourceFont){g.raster='';g.rasterPath='';g.path='';}
 project.glyphs[k]=g;return g;
}
function commitBezier(before){
 outlineValidationMarkers=[];
 const key=glyphKey(slotIndex),g=bezierEntry();
 g.path=combineGlyphPaths(g.rasterPath,g.bezierContours);g.modified=true;
 project.glyphs[key]=g;updateLayerPath(g,project);recordChange('glyph',key,before,g);
 updateTrace();updateProgress();renderBezierOverlay();
}
function addSvgEl(type,attrs,parent){const el=document.createElementNS('http://www.w3.org/2000/svg',type);for(const [k,v]of Object.entries(attrs))el.setAttribute(k,String(v));parent.appendChild(el);return el;}
// One persistent UI preference covers all editor tools. Hiding guidance in
// Select/Lasso or Bézier also keeps it hidden when switching tools or reloading.
// No project data or undo history is affected.
const EDITOR_HELP_HIDDEN_KEY='spfm-editor-help-hidden';
let editorHelpHidden=false;
try { editorHelpHidden=localStorage.getItem(EDITOR_HELP_HIDDEN_KEY)==='1'; }
catch (_) { /* Browser storage may be disabled. The control still works. */ }
function editorHelpMode(){return tool==='bezier'?'bezier':((tool==='select'||tool==='lasso')?'selection':null);}
function renderEditorHelp(){
 const mode=editorHelpMode();
 $('selectionHelp').hidden=mode!=='selection'||editorHelpHidden;
 $('bezierHelp').hidden=mode!=='bezier'||editorHelpHidden;
 const show=$('btnShowEditorHelp');
 show.hidden=!mode||!editorHelpHidden;
 show.setAttribute('aria-controls',mode==='bezier'?'bezierHelp':'selectionHelp');
 show.setAttribute('aria-expanded',String(!!mode&&!editorHelpHidden));
 show.title=mode==='bezier'?'Show Bézier drawing instructions':'Show Select and Lasso instructions';
}
function setEditorHelpHidden(hidden){
 editorHelpHidden=!!hidden;
 try{localStorage.setItem(EDITOR_HELP_HIDDEN_KEY,editorHelpHidden?'1':'0');}
 catch(_){/* Browser storage may be disabled. */}
 renderEditorHelp();
}
function renderBezierHelp(){
 const guide=$('bezierHelp');if(!guide)return;
 renderEditorHelp();
 const count=bezierDraft.length;
 let message='Click anywhere inside the white glyph area to place the first anchor.';
 if(count===1)message='1 point placed. Click for a sharp corner, or click and drag for a smooth curve.';
 else if(count===2)message='2 points placed. Add at least one more point to create a closed outline.';
 else if(count>=3)message=`${count} points placed. Click the first or last point to close, or click and drag it to curve the final segment before closing. Shift+drag forces a hole. Press Enter to close without dragging. Enclosed inner outlines become transparent holes automatically. Undo reopens the outline.`;
 else if(selectedBezierContour>=0)message='Selected outline: press “Make hole” to cut out its centre, or use the Filled/Hole selector. You can choose any outline from the Outline menu without clicking a tiny point.';
 if(bezierPreview)message='Filled glyph preview: black areas will print; transparent areas will not. Select “Show edit handles” to continue drawing.';
 $('bezierState').textContent=message;
 $('bezierCount').textContent=count?`${count} point${count===1?'':'s'} in current outline`:'Ready to draw a new outline';
 const selectedContour=project?.glyphs?.[slotIndex]?.bezierContours?.[selectedBezierContour];
 if(isStroke(selectedContour)&&!bezierDraft.length){$('btnCloseBezier').textContent='Close selected path';$('btnCloseBezierHole').disabled=true;}
 $('btnCloseBezier').textContent=count?'Close outline (automatic)':'Make selected outline filled';
 $('btnCloseBezierHole').textContent=count?'Close hole (Shift+Enter)':'Make selected outline a hole';
 if(isStroke(selectedContour)&&!count)$('btnCloseBezier').textContent='Close selected path';
 $('btnCloseBezier').disabled=bezierPreview||(count<3 && (!selectedContour||(isStroke(selectedContour)?(selectedContour.closed||selectedContour.points.length<3):selectedContour.role!=='hole')));
 $('btnCloseBezierHole').disabled=bezierPreview||(count<3 && (!selectedContour||isStroke(selectedContour)||selectedContour.role==='hole'));
 $('btnCancelBezier').disabled=!count||bezierPreview;
 $('btnDeleteBezier').disabled=count>0||selectedBezierContour<0||bezierPreview;
 const contours=project?.glyphs?.[slotIndex]?.bezierContours||[];
 const picker=$('bezierContourPicker');
 const descriptions=contours.map((c,i)=>isStroke(c)?`Path ${i+1} (${c.closed?'Closed':'Open'})`:`Outline ${i+1} (${c.role==='hole'?'Hole':'Filled'})`);
 if(picker.options.length!==descriptions.length+1 || descriptions.some((name,i)=>picker.options[i+1]?.textContent!==name)){
   picker.replaceChildren(new Option('Choose outline…',''),...descriptions.map((name,i)=>new Option(name,String(i))));
 }
 picker.value=selectedBezierContour>=0&&selectedBezierContour<contours.length?String(selectedBezierContour):'';
 picker.disabled=count>0||!contours.length||bezierPreview;
 const current=contours[selectedBezierContour];
 $('bezierContourRole').disabled=count>0||!current||bezierPreview;
 $('bezierContourRole').value=current?.role==='hole'?'hole':'fill';
 $('btnBezierPreview').textContent=bezierPreview?'Show edit handles':'Preview filled glyph';
 $('btnBezierPreview').setAttribute('aria-pressed',String(bezierPreview));
}
function renderOtherGlyphLayers(){
 const under=$('inactiveLayerUnder'),over=$('inactiveLayerOver');
 if(!under||!over)return;
 under.replaceChildren();over.replaceChildren();
 const g=project?.glyphs?.[slotIndex];if(!g?.layerStack)return;
 if(typeof isolatedLayerId!=='undefined'&&isolatedLayerId&&isolatedLayerId===activeLayer(g)?.id){
  const layer=activeLayer(g);if(layer?.component){
   const p=resolveLinkedGlyphPaths(project)[String(layer.component.sourceGlyphId)]||'';
   if(p)addSvgEl('path',{d:transformSvgPath(p,layer.component),fill:'#191921','fill-rule':'nonzero'},over);
  }
  return;
 }
 if(hasCompositingModes(g)){
  // Show the actual composited glyph (without modifying any editable layer).
  // White knockout regions hide only ink cut away by subtract/intersect layers.
  try{
   const whole=originalVisibleLayerPaths(g,project),final=compositeLayerPath(g,{visibleOnly:true,project});
   const cut=whole?booleanPaths(whole,final,'subtract').path:'';
   if(cut)addSvgEl('path',{d:cut,fill:'#fffdf7','fill-rule':'nonzero',class:'layer-knockout'},over);
   if(final)addSvgEl('path',{d:final,fill:'#191921','fill-rule':'nonzero',class:'layer-composite'},over);
  }catch(error){status('Cannot preview layer geometry: '+String(error.message||error),true);}
  return;
 }
 const others=otherLayerPaths(g,project);
 const linkedActive=activeLayer(g);
 if(linkedActive?.component&&linkedActive.visible){
  const p=resolveLinkedGlyphPaths(project)[String(linkedActive.component.sourceGlyphId)]||'';
  if(p)addSvgEl('path',{d:transformSvgPath(p,linkedActive.component),fill:linkedActive.mode==='guide'||!linkedActive.enabled?'#805ca8':'#191921',opacity:linkedActive.mode==='guide'||!linkedActive.enabled?0.3:1,'fill-rule':'nonzero','data-layer-id':linkedActive.id},over);
 }
 for(const [root,paths] of [[under,others.below],[over,others.above]]){
  for(const item of paths){
   const path=addSvgEl('path',{d:item.path,'fill-rule':'nonzero','data-layer-id':item.id},root);
   path.setAttribute('fill',item.mode==='guide'?'#805ca8':'#191921');
   if(item.mode==='guide')path.setAttribute('opacity','0.3');
  }
 }
}
function refreshGlyphLayerPalette(){if(editorPaletteManager)editorPaletteManager.refresh();}
function editableLayerOrWarn(){
 if(!project)return false;
 const g=project.glyphs[glyphKey(slotIndex)]||{};
 if(!layerCanEdit(g)){
  status('This layer is locked, hidden or a live linked component. Select an editable layer to draw; edit the source glyph to change the linked outline.',true);
  return false;
 }
 return true;
}
function mutateGlyphLayers(action,label){
 if(!project)return;
 if(drawing||bezierInteraction){status('Finish the current pointer gesture before changing layers.',true);return;}
 if(bezierDraft.length){status('Finish or cancel the open Bézier outline before changing layer settings.',true);return;}
 if(traceTimer){clearTimeout(traceTimer);traceTimer=0;commitGlyph();}
 const key=glyphKey(slotIndex),g=project.glyphs[key]||{};
 ensureGlyphLayers(g);project.glyphs[key]=g;
 const before=cloned(g),previousId=g.layerStack.activeId;
 try{action(g);updateLayerPath(g,project);}catch(e){
  project.glyphs[key]=before;
  try{if(hasLinkedComponents(project))resolveLinkedGlyphPaths(project,{commit:true});}catch(_){/* preserve the original error */}
  refreshGlyphLayerPalette();
  status('Layer operation not applied: '+String(e.message||e),true);return;
 }
 if(g.layerStack.activeId!==previousId){
  cancelSelection();isolatedLayerId=null;selectedBezierContour=-1;selectedBezierNode=-1;selectedStroke=-1;joinEndpoints=[];
  selectedWidthSession=null;
 }
 recordChange('glyph',key,before,g);
 // Raster and contours belong to the active layer only; changing layers
 // swaps the backing art, not the canvas coordinates or project identity.
 drawImageUrl((g.modified||g.rasterCopyForEditing)?(g.raster||''):'').then(()=>{
   renderBezierOverlay();updateTrace();refreshGlyphLayerPalette();updateProgress();
 });
 status(label);
}
function renderGlyphLayerPalette(){
 const root=$('glyphLayerList');if(!root||!project)return;
 root.replaceChildren();
 const g=project.glyphs[glyphKey(slotIndex)]||{};
 const stack=ensureGlyphLayers(g);
 const button=(label,title,handler,disabled=false)=>{
  const el=document.createElement('button');el.type='button';el.className='mini';el.textContent=label;el.title=title;el.setAttribute('aria-label',title);el.disabled=disabled;el.onclick=handler;return el;
 };
 for(const layer of stack.layers){
  const row=document.createElement('div');row.className='palette-layer-row'+(stack.activeId===layer.id?' active':'');
  const toggle=(key,txt,title)=>button(txt,title,()=>mutateGlyphLayers(glyph=>{
   if(key==='visible'&&!layer[key]&&glyph.layerStack.activeId===layer.id)return;
   if(key==='visible'&&layer[key]&&glyph.layerStack.activeId===layer.id)throw Error('Select a different layer before hiding the active layer.');
   updateLayer(glyph,layer.id,{[key]:!layer[key]});
  },`Layer ${title.toLowerCase()}.`));
  row.append(toggle('visible',layer.visible?'◉':'○',layer.visible?'Hide layer':'Show layer'));
  if(layer.component){const lock=document.createElement('span');lock.textContent='🔗';lock.title='Live linked glyph: edit the source glyph or select a different layer to draw';row.append(lock);}
  else row.append(toggle('locked',layer.locked?'🔒':'♧',layer.locked?'Unlock layer':'Lock layer'));
  const name=button(layer.name,'Select layer '+layer.name,()=>{
   if(layer.id===stack.activeId)return;
   mutateGlyphLayers(glyph=>selectLayer(glyph,layer.id),'Selected layer '+layer.name+'.');
  });name.className='palette-layer-name';name.title='Click to select · double-click to rename';
  name.ondblclick=()=>{
   const candidate=window.prompt('Rename layer',layer.name);
   if(candidate!=null)mutateGlyphLayers(glyph=>updateLayer(glyph,layer.id,{name:candidate}),'Layer renamed.');
  };row.append(name);
  const modeSelect=document.createElement('select');modeSelect.className='layer-mode';
  modeSelect.title='How this layer combines with the layers below: Add ink, Cut out ink, Keep shared ink, or Guide (not exported)';
  modeSelect.setAttribute('aria-label','Layer mode for '+layer.name);
  for(const [mode,label] of [['add','+ Add'],['subtract','− Cut'],['intersect','∩ Keep'],['guide','✎ Guide']]){
   const option=document.createElement('option');option.value=mode;option.textContent=label;modeSelect.append(option);
  }
  modeSelect.value=layer.mode||'add';
  modeSelect.onchange=()=>mutateGlyphLayers(glyph=>updateLayer(glyph,layer.id,{mode:modeSelect.value}),'Layer mode: '+modeSelect.options[modeSelect.selectedIndex].textContent+'.');
  row.append(modeSelect);
  const included=document.createElement('input');included.type='checkbox';included.className='layer-export';included.checked=layer.enabled;
  included.title='Use this layer in exported font';included.setAttribute('aria-label','Export layer '+layer.name);
  included.onchange=()=>mutateGlyphLayers(glyph=>updateLayer(glyph,layer.id,{enabled:included.checked}),'Updated layer export inclusion.');row.append(included);
  const idx=stack.layers.indexOf(layer);
  row.append(button('↑','Move layer up',()=>mutateGlyphLayers(glyph=>moveLayer(glyph,layer.id,-1),'Layer moved up.'),idx===0));
  row.append(button('↓','Move layer down',()=>mutateGlyphLayers(glyph=>moveLayer(glyph,layer.id,1),'Layer moved down.'),idx===stack.layers.length-1));
  root.append(row);
 }
 const base=document.createElement('div');base.className='palette-layer-row';
 const visible=$('toggleOriginal')?.checked;
 base.append(button(visible?'◉':'○','Show or hide source font reference',()=>{$('toggleOriginal').checked=!$('toggleOriginal').checked;renderOriginalGuide();refreshGlyphLayerPalette();}));
 const lock=document.createElement('span');lock.textContent='🔒';lock.title='Protected original font';base.append(lock);
 const title=document.createElement('span');title.className='palette-layer-name';title.textContent=project.sourceFont?'Imported font (base reference)':'Fairfax template (base reference)';base.append(title);
 const guide=document.createElement('small');guide.textContent='Guide only';guide.title='Original source remains available to the compiler for unmodified glyphs. Copy it to an editable layer to change it.';base.append(guide);root.append(base);
 $('btnDeleteGlyphLayer').disabled=stack.activeId==='artwork';
 const source=$('linkComponentSource'),edit=$('linkedComponentTransform'),current=activeLayer(g);
 if(source){
  const previous=source.value;source.replaceChildren();
  let choices=0;
  for(const slot of slots){const id=String(slot.index),candidate=project.glyphs[id];
   if(id===glyphKey(slotIndex)||!candidate?.path?.trim())continue;
   const option=new Option(slotMeta(slot.index).word||slot.word||id,id);source.append(option);choices++;
  }
  if([...source.options].some(o=>o.value===previous))source.value=previous;
  if($('btnAddLinkedGlyph'))$('btnAddLinkedGlyph').disabled=!choices;
 }
 if(edit){edit.hidden=!current?.component;
  if(current?.component){for(const key of ['dx','dy','scale','rotation']){const field=$('linked-'+key);if(field)field.value=String(current.component[key]??(key==='scale'?1:0));}}
 }
 refreshLayerAdvancedControls(g);
}
// Advanced controls stay in a folded Layers subsection; ordinary drawing
// needs no additional toolbar buttons, popups or canvas-space allocation.
function refreshLayerAdvancedControls(g){
 const root=$('layerModifierList'),selector=$('layerModifierSource');
 if(!root||!selector)return;
 const layer=activeLayer(g);root.replaceChildren();selector.replaceChildren();
 if(!layer)return;
 for(const other of g.layerStack.layers){
  if(other.id===layer.id)continue;
  const o=document.createElement('option');o.value=other.id;o.textContent=other.name;selector.append(o);
 }
 $('btnLayerModifierAdd').disabled=selector.options.length===0;
 for(let i=0;i<(layer.modifiers||[]).length;i++){
  const mod=layer.modifiers[i],entry=document.createElement('div');entry.className='layer-modifier-entry';
  const source=g.layerStack.layers.find(x=>x.id===mod.sourceLayerId);
  const title=document.createElement('span');title.textContent=`${mod.enabled===false?'Paused: ':''}${mod.operation} · ${source?.name||'missing source'}`;
  entry.append(title);
  const toggle=document.createElement('button');toggle.type='button';toggle.className='mini';toggle.textContent=mod.enabled===false?'Enable':'Pause';toggle.title='Toggle modifier without deleting its source';
  toggle.onclick=()=>mutateGlyphLayers(glyph=>{
   const selected=activeLayer(glyph),next=structuredClone(selected.modifiers||[]);
   next[i].enabled=next[i].enabled===false;
   updateLayer(glyph,selected.id,{modifiers:next});
  },'Modifier toggled. Original source remains editable.');entry.append(toggle);
  const remove=document.createElement('button');remove.type='button';remove.className='mini';remove.textContent='×';remove.title='Remove this modifier (Undo restores it)';
  remove.onclick=()=>mutateGlyphLayers(glyph=>{
   const selected=activeLayer(glyph),next=structuredClone(selected.modifiers||[]);next.splice(i,1);
   updateLayer(glyph,selected.id,{modifiers:next});
  },'Modifier removed. Source artwork unchanged.');entry.append(remove);root.append(entry);
 }
 const clip=layer.clip;const clipLabel=$('layerClipStatus');
 if(clipLabel)clipLabel.textContent=clip?.path?(clip.enabled===false?'Clipping paused':'Clipping enabled · editable source retained'):'No clipping boundary';
 const clear=$('btnLayerClearClip');if(clear)clear.disabled=!clip;
 const isolate=$('btnLayerIsolate');if(isolate){const active=isolatedLayerId===layer.id;isolate.textContent=active?'Show all layers':'Isolate this layer';isolate.setAttribute('aria-pressed',String(active));}
}
function setupAdvancedLayerControls(panel){
 const details=document.createElement('details');details.className='linked-components-details';details.id='layerEffectsDetails';
 const summary=document.createElement('summary');summary.textContent='Clipping & shape modifiers (advanced)';details.append(summary);
 const info=document.createElement('p');info.className='small muted';info.textContent='Optional and reversible. Edit the source layers normally; clips and boolean modifiers affect the preview/export without replacing source outlines. No change to the everyday Pencil, Select or Eraser tools.';details.append(info);
 const row=document.createElement('div');row.className='linked-component-row';
 const sourceLabel=document.createElement('label');sourceLabel.textContent='Combine with';sourceLabel.htmlFor='layerModifierSource';
 const source=document.createElement('select');source.id='layerModifierSource';sourceLabel.append(source);row.append(sourceLabel);
 const modeLabel=document.createElement('label');modeLabel.textContent='Operation';modeLabel.htmlFor='layerModifierOperation';
 const mode=document.createElement('select');mode.id='layerModifierOperation';
 for(const [operation,label] of [['union','Add'],['subtract','Cut'],['intersect','Keep'],['exclude','Exclude']]){const option=document.createElement('option');option.value=operation;option.textContent=label;mode.append(option);}
 modeLabel.append(mode);row.append(modeLabel);
 const add=document.createElement('button');add.id='btnLayerModifierAdd';add.type='button';add.className='btn compact';add.textContent='+ Modifier';row.append(add);details.append(row);
 const list=document.createElement('div');list.id='layerModifierList';list.className='layer-modifier-list';details.append(list);
 const clipActions=document.createElement('div');clipActions.className='palette-layer-foot';
 const clip=document.createElement('button');clip.type='button';clip.id='btnLayerClipSelection';clip.className='btn compact';clip.textContent='Clip to selection';
 clip.title='Use an existing rectangle or lasso as a live layer clipping boundary; original editable geometry stays intact';
 const clear=document.createElement('button');clear.type='button';clear.id='btnLayerClearClip';clear.className='btn compact';clear.textContent='Clear clip';
 const isolate=document.createElement('button');isolate.type='button';isolate.id='btnLayerIsolate';isolate.className='btn compact';isolate.textContent='Isolate this layer';
 isolate.title='Temporarily show only the selected layer in the editor; does not change export or saved project';
 clipActions.append(clip,clear,isolate);details.append(clipActions);
 const clipStatus=document.createElement('p');clipStatus.id='layerClipStatus';clipStatus.className='small muted';details.append(clipStatus);
 panel.append(details);
 add.onclick=()=>mutateGlyphLayers(g=>{
  const layer=activeLayer(g),mods=structuredClone(layer.modifiers||[]);
  mods.push({operation:mode.value,sourceLayerId:source.value,enabled:true});
  const preview=previewLayerEffectChange(g,layer.id,l=>{l.modifiers=mods;});
  g.layerStack=preview;
 },'Live modifier added. Undo restores the original composition.');
 clip.onclick=()=>{
  if(!nonemptySelection(selection)){status('First draw a rectangle with Select or a lasso, then choose Clip to selection.',true);return;}
  const shape=selectionPolygon?.length>=3?makePolygonClip(selectionPolygon):makeRectangleClip(selection);
  mutateGlyphLayers(g=>updateLayer(g,activeLayer(g).id,{clip:shape}),
   'Live clip added. You can continue editing ink beyond the visible clip; Undo restores it.');
 };
 clear.onclick=()=>mutateGlyphLayers(g=>updateLayer(g,activeLayer(g).id,{clip:null}),
  'Clipping boundary removed. All original ink is preserved.');
 isolate.onclick=()=>{
  const g=project?.glyphs?.[glyphKey(slotIndex)];if(!g)return;
  const id=activeLayer(g)?.id;isolatedLayerId=isolatedLayerId===id?null:id;
  renderOtherGlyphLayers();refreshLayerAdvancedControls(g);
  status(isolatedLayerId?'Only this layer is shown for editing; export and other layer data remain unchanged.':'All layers shown.');
 };
}
function joinSelectedStrokeEndpoints(action){
 if(!editableLayerOrWarn()||bezierDraft.length||drawing||curvePending)return;
 const key=glyphKey(slotIndex),g=bezierEntry(),contours=g.bezierContours;
 const selected=joinEndpoints;
 if(action==='close'){
  const ci=selected[0]?.ci??selectedStroke,stroke=contours[ci];
  if(!isStroke(stroke)||stroke.closed){status('Select an open line/curve path first.',true);return;}
  if(stroke.points.length<3){status('To close this path, add at least one more segment first.',true);return;}
  const before=cloned(g);contours[ci]=closeOpenStroke(stroke);selectedStroke=ci;joinEndpoints=[];
  commitBezier(before);status('Path closed. Undo reopens it.');return;
 }
 if(selected.length!==2){status('Choose the first endpoint with Edit path, then Shift-click a second endpoint. Press Join endpoints or Join smoothly.',true);return;}
 const [a,b]=selected,first=contours[a.ci],second=contours[b.ci];
 if(!isStroke(first)||!isStroke(second)){status('Join requires two editable open line/curve strokes.',true);return;}
 const before=cloned(g);
 try{
  if(a.ci===b.ci){
   if(first.points.length<3||a.ni===b.ni)throw Error('Choose opposite endpoints of a path with at least three nodes.');
   contours[a.ci]=closeOpenStroke(first,{smooth:action==='smooth'});selectedStroke=a.ci;
  }else{
   const merged=joinOpenStrokes(first,a.ni,second,b.ni,{smooth:action==='smooth'});
   contours[a.ci]=merged;contours.splice(b.ci,1);selectedStroke=b.ci<a.ci?a.ci-1:a.ci;
  }
 }catch(error){status(error.message,true);return;}
 selectedBezierContour=selectedStroke;
 const junctionPoint={x:first.points[a.ni].x,y:first.points[a.ni].y};
 selectedBezierNode=strokeNodeHit([contours[selectedStroke]],junctionPoint,bezierPointerRadius(25))?.ni??-1;
 joinEndpoints=[];
 commitBezier(before);status(action==='smooth'?'Paths joined smoothly. The purple junction remains editable.':'Paths joined. Select the purple junction and choose Smooth junction to remove any kink.');
}
function wireGlyphLayerActions(){
 const layersPanel=document.getElementById('palette-layers');
 const details=document.createElement('details');details.className='linked-components-details';
 const summary=document.createElement('summary');summary.textContent='Linked components (advanced)';details.append(summary);
 const help=document.createElement('p');help.className='small muted';help.textContent='Reuse an existing drawn glyph as a live, read-only layer. Edit its source glyph to update all links. Add another drawing layer for local modifications. Links are included in exported TTFs.';details.append(help);
 const sourceRow=document.createElement('div');sourceRow.className='linked-component-row';
 const label=document.createElement('label');label.textContent='Source glyph';label.htmlFor='linkComponentSource';
 const source=document.createElement('select');source.id='linkComponentSource';label.append(source);sourceRow.append(label);
 const add=document.createElement('button');add.id='btnAddLinkedGlyph';add.className='btn compact';add.type='button';add.textContent='+ Link glyph';sourceRow.append(add);details.append(sourceRow);
 const edit=document.createElement('div');edit.id='linkedComponentTransform';edit.className='linked-component-transform';edit.hidden=true;
 const heading=document.createElement('p');heading.textContent='Selected linked layer — transform';heading.className='small muted';edit.append(heading);
 for(const [key,text,min,max,step] of [['dx','X','-4000','4000','1'],['dy','Y','-4000','4000','1'],['scale','Scale','0.05','8','0.05'],['rotation','Rotate °','-360','360','5']]){
  const wrapper=document.createElement('label');wrapper.textContent=text;wrapper.htmlFor='linked-'+key;
  const input=document.createElement('input');input.type='number';input.id='linked-'+key;input.min=min;input.max=max;input.step=step;input.value=key==='scale'?'1':'0';
  wrapper.append(input);edit.append(wrapper);
  input.addEventListener('change',()=>{
   const active=activeLayer(project.glyphs[glyphKey(slotIndex)]||{});if(!active?.component)return;
   mutateGlyphLayers(g=>{
    const layer=activeLayer(g),next=normalizeComponent({...layer.component,[key]:Number(input.value)});
    layer.component=next;
    resolveLinkedGlyphPaths(project);
   },'Linked glyph transform updated. Undo restores the previous position.');
  });
 }
 details.append(edit);layersPanel.append(details);
 setupAdvancedLayerControls(layersPanel);
 add.onclick=()=>{const sourceId=source.value;if(!sourceId)return;
  mutateGlyphLayers(g=>{
   const targetId=glyphKey(slotIndex);const linked=createLinkedComponentLayer(project,targetId,sourceId);
   selectLayer(g,linked.id);g.modified=true;
  },'Linked glyph layer created. Source edits update this glyph automatically.');
 };
 $('btnAddGlyphLayer').onclick=()=>mutateGlyphLayers(g=>addLayer(g),'Created editable layer.');
 $('btnDuplicateGlyphLayer').onclick=()=>mutateGlyphLayers(g=>duplicateLayer(g,activeLayer(g).id),'Duplicated active layer.');
 $('btnDeleteGlyphLayer').onclick=()=>{
  const g=project.glyphs[glyphKey(slotIndex)],layer=activeLayer(g);
  if(layer?.id==='artwork')return;
  if(!window.confirm(`Delete layer “${layer.name}” from this glyph? You can Undo this.`))return;
  mutateGlyphLayers(glyph=>removeLayer(glyph,layer.id),'Deleted layer. Undo can restore it.');
 };
 const pathPalette=document.getElementById('palette-path');
 for(const [label,mode] of [['Smooth selected node','smooth'],['Corner selected node','corner']]){
  const button=document.createElement('button');button.type='button';button.className='btn compact';button.textContent=label;
  button.title='Select a Bézier node with Edit path, then change its tangent handles. Undo restores it.';
  pathPalette.append(button);
  button.onclick=()=>{
   if(!editableLayerOrWarn())return;
   const k=glyphKey(slotIndex),g=project.glyphs[k],contour=g?.bezierContours?.[selectedBezierContour];
   if(!contour||selectedBezierNode<0){status('Select an outline and click one of its purple anchor points first.',true);return;}
   const i=selectedBezierNode,n=contour.points.length;
   if(n<3){status('A smooth junction needs at least three nodes.',true);return;}
   if(isStroke(contour)&&!contour.closed&&(i===0||i===n-1)){
    status('Smooth point applies to a junction inside the open path. To adjust an endpoint, drag it or its tangent handle.',true);return;
   }
   const before=cloned(g),node=contour.points[i];
   try{Object.assign(node,adjustBezierNode(node,contour.points[(i+n-1)%n],contour.points[(i+1)%n],mode));}
   catch(error){status('Cannot adjust selected node: '+error.message,true);return;}
   commitBezier(before);status(`Selected Bézier point is now ${mode}. Undo restores its handles.`);
  };
 }
 const joinToolbar=document.createElement('div');joinToolbar.className='palette-join-actions';
 for(const [label,action] of [['Join endpoints','join'],['Join smoothly','smooth'],['Close path','close']]){
  const button=document.createElement('button');button.className='btn compact';button.type='button';button.textContent=label;
  button.title='Choose open path endpoints using Edit path. Shift-click a second endpoint, then use Join. Each operation is one Undo step.';
  button.addEventListener('click',()=>joinSelectedStrokeEndpoints(action));joinToolbar.append(button);
 }
 const smoothJunction=document.createElement('button');smoothJunction.className='btn compact';smoothJunction.type='button';smoothJunction.textContent='Smooth junction';
 smoothJunction.title='Select a purple interior junction with Line, Curve, or Edit path, then align the two tangent handles without moving its anchor.';
 smoothJunction.addEventListener('click',()=>{
  if(!editableLayerOrWarn())return;
  const g=project?.glyphs?.[glyphKey(slotIndex)],stroke=g?.bezierContours?.[selectedStroke];
  if(!isStroke(stroke)||selectedBezierContour!==selectedStroke||selectedBezierNode<0){status('Click a purple interior junction point first, then press Smooth junction.',true);return;}
  const before=cloned(g);
  if(smoothStrokeJunction(stroke,selectedBezierNode)){commitBezier(before);status('Junction tangents aligned. Undo restores the original curve.');}
  else {renderBezierOverlay();status('Junction is already smooth or is not an interior point.');}
 });
 joinToolbar.append(smoothJunction);
 const guide=document.createElement('small');guide.className='palette-status';guide.textContent='Click a purple interior junction to drag or select it; drag its smaller tangent controls for precise correction. Smooth junction removes kinks. Square endpoints still extend paths; Alt-drag moves them.';
 pathPalette.append(joinToolbar,guide);
 // Advanced operations are folded away by default to preserve canvas room.
 const detail=(title)=>{const box=document.createElement('details');box.className='palette-subpanel';const head=document.createElement('summary');head.textContent=title;box.append(head);pathPalette.append(box);return box;};
 const nodePanel=detail('Edit nodes');
 const nodeButton=(label,action,title)=>{const b=document.createElement('button');b.type='button';b.className='btn compact';b.textContent=label;b.title=title;b.onclick=action;nodePanel.append(b);};
 const mutateSelectedNode=(action,message)=>{
  if(!editableLayerOrWarn())return;
  const key=glyphKey(slotIndex),g=project.glyphs[key],c=g?.bezierContours?.[selectedBezierContour];
  if(!c||selectedBezierNode<0){status('Select a node using Edit path or Curve first.',true);return;}
  const before=cloned(g);
  try{action(g,c,selectedBezierNode);}catch(error){status(String(error.message||error),true);return;}
  commitBezier(before);status(message);
 };
 nodeButton('Insert midpoint',()=>mutateSelectedNode((g,c,i)=>{
  const result=splitEditableBezier(c,i,.5);g.bezierContours[selectedBezierContour]=result.contour;selectedBezierNode=result.index;
 },'Inserted a point without changing the curve.'),'Insert an exact Bézier midpoint after the selected node');
 nodeButton('Add curve extrema',()=>{
  if(!editableLayerOrWarn())return;
  const k=glyphKey(slotIndex),g=project.glyphs[k],ci=selectedBezierContour,c=g?.bezierContours?.[ci];
  if(!c){status('Select an editable curve or filled outline first.',true);return;}
  let result;
  try{result=addContourExtrema(c);}catch(error){status('Could not add extrema: '+String(error.message||error),true);return;}
  if(!result.inserted){status('This outline already has all necessary extrema.');return;}
  const before=cloned(g);g.bezierContours[ci]=result.contour;selectedBezierNode=-1;
  commitBezier(before);status(`Inserted ${result.inserted} exact extrema point(s); the curve is unchanged. Undo restores the original nodes.`);
 },'Insert precise horizontal and vertical extrema into the selected curve without changing its shape');
 nodeButton('Delete point',()=>mutateSelectedNode((g,c,i)=>{
  g.bezierContours[selectedBezierContour]=deleteBezierNode(c,i);selectedBezierNode=Math.min(i,g.bezierContours[selectedBezierContour].points.length-1);
 },'Removed one point. Undo restores the old curve.'),'Delete the chosen anchor, keeping remaining nodes editable');
 nodeButton('Split at point',()=>mutateSelectedNode((g,c,i)=>{
  const parts=splitStrokeAtNode(c,i);g.bezierContours.splice(selectedBezierContour,1,...parts);selectedBezierNode=parts[0].points.length-1;
 },'Separated this centreline into two editable paths.'),'Split an open connected Line/Curve path at its selected interior node');
 nodeButton('Simplify polygon',()=>{
  if(!editableLayerOrWarn())return;
  const k=glyphKey(slotIndex),g=project.glyphs[k],ci=selectedBezierContour,c=g?.bezierContours?.[ci];
  if(!c||c.kind==='stroke'){status('Choose a filled outline in Edit path first.',true);return;}
  const before=cloned(g),next=simplifyPolygonNodes(c,.6);
  if(next.points.length===c.points.length){status('This outline has no redundant straight-edge points at the current tolerance.');return;}
  g.bezierContours[ci]=next;commitBezier(before);status('Redundant polygon points removed. Original available through Undo.');
 },'Remove low-deviation straight-edge nodes without affecting other contours');
 const booleanPanel=detail('Combine shapes');
 const shapeHelp=document.createElement('small');shapeHelp.className='palette-status';shapeHelp.textContent='Choose two CLOSED outlines on this layer. The result stays editable; the originals can be restored with Undo.';
 booleanPanel.append(shapeHelp);
 const shapeRow=document.createElement('div');shapeRow.className='palette-boolean-row';
 const selectA=document.createElement('select'),selectB=document.createElement('select'),operation=document.createElement('select');
 selectA.setAttribute('aria-label','First outline');selectB.setAttribute('aria-label','Second outline');
 for(const [id,label] of [['union','Union'],['subtract','Subtract B from A'],['intersect','Intersect'],['exclude','Exclude overlap']]){
  const opt=document.createElement('option');opt.value=id;opt.textContent=label;operation.append(opt);
 }
 const populate=()=>{
  const contours=project?.glyphs?.[glyphKey(slotIndex)]?.bezierContours||[];
  const choices=contours.map((c,i)=>({i,c})).filter(({c})=>c.kind!=='stroke'&&c.points?.length>=3);
  const preferred=selectedBezierContour;
  const redraw=select=>{const v=select.value;select.replaceChildren();for(const {i} of choices)select.add(new Option('Outline '+(i+1),String(i)));select.value=[...select.options].some(o=>o.value===v)?v:(select.options[0]?.value||'');};
  redraw(selectA);redraw(selectB);
  if(choices.some(c=>c.i===preferred))selectA.value=String(preferred);
  if(selectB.value===selectA.value)selectB.value=choices.find(c=>String(c.i)!==selectA.value)?.i??'';
 };
 booleanPanel.addEventListener('toggle',()=>{if(booleanPanel.open)populate();});
 for(const select of [selectA,selectB])select.addEventListener('focus',populate);
 for(const input of [selectA,selectB,operation])shapeRow.append(input);
 booleanPanel.append(shapeRow);
 const execute=document.createElement('button');execute.type='button';execute.className='btn compact';execute.textContent='Apply to selected outlines';
 booleanPanel.append(execute);
 execute.onclick=()=>{
  if(!editableLayerOrWarn())return;
  const key=glyphKey(slotIndex),g=project.glyphs[key],a=Number(selectA.value),b=Number(selectB.value);
  if(!Number.isInteger(a)||!Number.isInteger(b)||a===b||!g?.bezierContours?.[a]||!g.bezierContours[b]){status('Choose two different closed outlines.',true);return;}
  const first=g.bezierContours[a],second=g.bezierContours[b];
  if(first.kind==='stroke'||second.kind==='stroke'){status('Convert centrelines to closed outlines before combining.',true);return;}
  let combined;
  try{combined=booleanPaths(bezierPath([first]),bezierPath([second]),operation.value,{tolerance:.28});}
  catch(error){status('Vector operation failed: '+String(error.message||error),true);return;}
  const before=cloned(g),at=Math.min(a,b);
  g.bezierContours=g.bezierContours.filter((_,i)=>i!==a&&i!==b);
  g.bezierContours.splice(at,0,...combined.contours);
  selectedBezierContour=combined.contours.length?at:-1;selectedBezierNode=-1;selectedStroke=-1;
  commitBezier(before);populate();status(operation.options[operation.selectedIndex].textContent+' complete: '+combined.contours.length+' vector outline(s). Undo restores the original shapes.');
 };
 // Repair operations stay behind a closed disclosure, not in the primary
 // tool row or on the canvas. Ordinary drawing requires no extra decisions.
 const repairPanel=detail('Inspect & repair outlines');
 const repairHelp=document.createElement('small');repairHelp.className='palette-status';
 repairHelp.textContent='Ordinary drawing stays unchanged. Check marks possible defects without altering your work. Tiny-loop/spike trimming and topology repairs are separate, explicit Undo-able actions on the active editable layer.';
 repairPanel.append(repairHelp);
 const repairActions=document.createElement('div');repairActions.className='palette-repair-actions';repairPanel.append(repairActions);
 const repairReport=document.createElement('div');repairReport.className='palette-repair-report';repairReport.setAttribute('aria-live','polite');repairPanel.append(repairReport);
 const repairButton=(label,id,handler,tooltip)=>{
  const b=document.createElement('button');b.type='button';b.className='btn compact';b.textContent=label;b.id=id;b.title=tooltip;b.onclick=handler;repairActions.append(b);return b;
 };
 function refreshOutlineRepairReport(){
  const g=project?.glyphs?.[glyphKey(slotIndex)]||{},result=validateGlyphContours(g.bezierContours||[]);
  outlineValidationMarkers=result.issues||[];renderBezierOverlay();repairReport.replaceChildren();
  const summary=document.createElement('small');summary.className='palette-status';
  summary.textContent=`${result.contourCount} contour(s), ${result.pointCount} points · ${result.issues.length} finding(s)`;
  repairReport.append(summary);
  if(!result.issues.length){
   const clear=document.createElement('p');clear.className='palette-status';clear.textContent='No problems detected by these checks. This is not a full font-validation certificate.';repairReport.append(clear);
  }else{
   // Each finding is clickable: its location is highlighted and the affected
   // contour is selected for regular Edit path interaction.
   const issues=document.createElement('div');issues.className='palette-repair-issues';
   for(const issue of result.issues.slice(0,18)){
    const b=document.createElement('button');b.type='button';b.className='mini';
    b.textContent=`Outline ${issue.contourIndex+1}: ${issue.message}`;
    b.title='Highlight this finding and select its editable outline';
    b.onclick=()=>{
     if(bezierDraft.length){status('Finish or cancel your current Bézier draft before inspecting another contour.',true);return;}
     selectedBezierContour=issue.contourIndex;selectedBezierNode=issue.nodeIndex>=0?issue.nodeIndex:-1;
     selectedStroke=isStroke(g.bezierContours?.[issue.contourIndex])?issue.contourIndex:-1;
     setTool('bezier');renderBezierOverlay();status(issue.message,true);
    };
    issues.append(b);
   }
   repairReport.append(issues);
   if(result.issues.length>18){const more=document.createElement('small');more.textContent=`${result.issues.length-18} more finding(s); inspect the highlighted positions.`;repairReport.append(more);}
  }
  return result;
 }
 repairButton('Check outline','btnValidateGlyphOutline',()=>{
  const result=refreshOutlineRepairReport();
  status(result.issues.length?`Found ${result.issues.length} issue(s); click a finding below to inspect its contour.`:'No outline issues detected by these checks.',!!result.issues.length);
 },'Diagnose and highlight self-crossings, duplicates, short spikes, orphan holes and malformed outlines');
 repairButton('Safe cleanup','btnRepairOutlineSafe',()=>{
  if(!editableLayerOrWarn())return;
  const g=project?.glyphs?.[glyphKey(slotIndex)];
  if(!g?.bezierContours?.length){status('There are no editable contours on this layer.');return;}
  const result=cleanContoursExact(g.bezierContours);
  if(!result.changed){status(result.skipped?'No safe changes found; malformed contours must be repaired manually.':'No exact zero-length edges or winding corrections to make.');return;}
  const before=cloned(g);g.bezierContours=result.contours;selectedBezierContour=-1;selectedBezierNode=-1;selectedStroke=-1;
  commitBezier(before);refreshOutlineRepairReport();
  status(`Safe cleanup: removed ${result.removed} zero-length segment(s), normalised ${result.oriented} winding(s). Undo restores the exact originals.`);
 },'Only remove provably zero-length cubic segments and match the font serializer’s existing winding; never flatten curves');
 repairButton('Trim tiny spike','btnTrimTinySpikes',()=>{
  if(!editableLayerOrWarn())return;
  const g=project?.glyphs?.[glyphKey(slotIndex)],ci=selectedBezierContour,c=g?.bezierContours?.[ci];
  if(!c){status('First click a highlighted tiny-spike finding, or select its outline using Edit path.',true);return;}
  const matches=findTinySpikes(c);
  if(!matches.length){status('No short straight backtracking spike detected in the selected outline.');return;}
  const result=removeTinySpikes(c);
  if(!result.removed){status('This contour cannot be trimmed safely; inspect its anchor handles.');return;}
  const before=cloned(g);g.bezierContours[ci]=result.contour;selectedBezierNode=-1;
  commitBezier(before);refreshOutlineRepairReport();
  status(`Trimmed ${result.removed} small backtracking spike(s) from the selected outline. Undo restores the original.`);
 },'Remove only short, nearly retracing straight hairpins in the selected contour; intentional sharp corners are untouched');
 repairButton('Trim tiny Bézier loop…','btnTrimTinyBezierLoop',()=>{
  if(!editableLayerOrWarn())return;
  const g=project?.glyphs?.[glyphKey(slotIndex)],ci=selectedBezierContour,c=g?.bezierContours?.[ci];
  if(!c||c.kind==='stroke'){
   status('Select a closed outline with a tiny-loop finding in Check outline first.',true);return;
  }
  let loops;
  try{loops=findTinyBezierLoops(c);}catch(error){status('Cannot inspect this outline: '+String(error.message||error),true);return;}
  if(!loops.length){status('No tiny single-segment Bézier loop found in the selected outline. Other curves remain untouched.');return;}
  const hit=loops[0];
  if(!window.confirm(`Remove the tiny loop (about ${hit.diameter.toFixed(1)} units across, ${hit.area.toFixed(2)} square units) from the selected outline? This removes only the looping portion, keeps the surrounding cubic segments editable, and can be undone.`))return;
  let change;
  try{change=removeTinyBezierLoop(c);if(change.removed!==1)throw Error('The loop changed during inspection');}
  catch(error){status('Loop trim refused: '+String(error.message||error),true);return;}
  const before=cloned(g);g.bezierContours[ci]=change.contour;selectedBezierNode=-1;
  commitBezier(before);refreshOutlineRepairReport();
  status('Trimmed one tiny Bézier loop. The remaining curve is editable; Undo restores the original.');
 },'Inspect and explicitly remove a microscopic self-loop within one cubic. Does not alter intentional corners, large loops or other layers.');
 repairButton('Remove overlaps…','btnRepairOutlineOverlaps',()=>{
  if(!editableLayerOrWarn())return;
  const g=project?.glyphs?.[glyphKey(slotIndex)],all=g?.bezierContours||[];
  const editable=all.filter(c=>c.kind!=='stroke'&&c.points?.length>=3);
  if(editable.length<2){status('At least two closed outlines are needed to remove overlaps.');return;}
  let result;
  try{
   result=regularizeSelfIntersections(bezierPath(editable));
   if(!result.contours.length||result.contours.reduce((n,c)=>n+c.points.length,0)>6000)throw Error('Repair produced unusable outlines');
   if(validateGlyphContours(result.contours).issues.some(i=>i.type==='intersection'))throw Error('Self-intersections would remain');
  }catch(error){status('Overlap repair refused: '+String(error.message||error),true);return;}
  if(!window.confirm(`Regularise ${editable.length} closed outlines into ${result.contours.length} nonoverlapping editable outlines? The visible nonzero-fill silhouette is checked, but control points may change. Open Line/Curve strokes are preserved. Undo restores every original.`))return;
  const before=cloned(g);
  // Preserve every editable open centreline and its widths. Closed outlines
  // are rebuilt as non-overlapping filled boundaries on this layer only.
  g.bezierContours=[...result.contours,...all.filter(c=>c.kind==='stroke')];
  selectedBezierContour=-1;selectedBezierNode=-1;selectedStroke=-1;
  commitBezier(before);refreshOutlineRepairReport();
  status(`Removed overlapping boundaries: ${editable.length} old closed outlines → ${result.contours.length} editable outlines. Undo restores the original shapes.`);
 },'Explicitly remove overlaps among all closed outlines on the active layer while preserving the nonzero-fill silhouette and open strokes');
 repairButton('Resolve crossing…','btnResolveOutlineCrossings',()=>{
  if(!editableLayerOrWarn())return;
  const g=project?.glyphs?.[glyphKey(slotIndex)],ci=selectedBezierContour,c=g?.bezierContours?.[ci];
  if(!c||c.kind==='stroke'){status('Choose a closed filled or hole outline using Edit path or a highlighted finding.',true);return;}
  if(!validateGlyphContours([c]).issues.some(i=>i.type==='intersection')){
   status('Selected outline has no detected self-intersection; no repair needed.');return;
  }
  let result;
  try{
   result=regularizeSelfIntersections(bezierPath([c]));
   if(!result.contours.length||result.contours.some(r=>r.points.length<3)||result.contours.reduce((n,r)=>n+r.points.length,0)>6000)throw Error('Repair produced unusable contours');
   if(validateGlyphContours(result.contours).issues.some(i=>i.type==='intersection'))throw Error('Some self-intersections would remain');
  }catch(error){status('Crossing repair refused: '+String(error.message||error),true);return;}
  if(!window.confirm(`Replace the selected crossing outline with ${result.contours.length} closed editable outline(s)? This uses sampled boundary geometry and can change Bézier control points. Undo restores the original.`))return;
  const before=cloned(g);g.bezierContours.splice(ci,1,...result.contours);
  selectedBezierContour=ci;selectedBezierNode=-1;selectedStroke=-1;
  commitBezier(before);refreshOutlineRepairReport();
  status(`Resolved the crossing into ${result.contours.length} closed editable outline(s). Undo restores the original Bézier geometry.`);
 },'Explicit, reversible nonzero-fill topology repair for the selected self-crossing outline; uses sampled edges');
}
function renderBezierOverlay(){
 const showingGuide=!!project?.glyphs?.[slotIndex]?.layerStack&&activeLayer(project.glyphs[slotIndex])?.mode==='guide';
 if(canvas)canvas.style.opacity=showingGuide?'0.35':'1';
 renderOtherGlyphLayers();
 const root=$('bezierOverlay');if(!root)return;root.replaceChildren();
 const contours=project?.glyphs?.[slotIndex]?.bezierContours||[];
 let maskId=null;
 if(tool==='eraser'&&drawing&&strokePoints.length&&contours.length){
  // Preview the erased portion of SVG artwork while dragging. The final
  // bitmap/vector model update happens once, on pointerup, for Undo safety.
  maskId='spfm-eraser-preview';
  const defs=addSvgEl('defs',{},root),mask=addSvgEl('mask',{id:maskId,maskUnits:'userSpaceOnUse',x:0,y:0,width:ARTBOARD_WIDTH,height:ARTBOARD_HEIGHT},defs);
  addSvgEl('rect',{x:0,y:0,width:ARTBOARD_WIDTH,height:ARTBOARD_HEIGHT,fill:'white'},mask);
  const points=smoothStroke(strokePoints,Number($('strokeSmoothing').value));
  if(brushTipShape()==='square')addSvgEl('path',{d:vectorBrushFootprint(points,brushWidth(),'square'),fill:'black'},mask);
  else addSvgEl('path',{d:brushSvgPath(points),fill:'none',stroke:'black','stroke-width':brushWidth(),'stroke-linecap':'round','stroke-linejoin':'round'},mask);
 }
 if(contours.length)addSvgEl('path',{d:bezierPath(contours),class:'vector-fill'+(showingGuide?' vector-guide':''),'fill-rule':'nonzero',...(maskId?{mask:`url(#${maskId})`}:{})},root);
 for(const issue of outlineValidationMarkers){if(issue.position){const {x,y}=issue.position;addSvgEl('circle',{cx:x,cy:y,r:7,class:'outline-warning-marker'},root);}}
 renderBezierHelp();
 if(['line','curve','bezier'].includes(tool)&&!bezierPreview){
  const highlighted=new Set([selectedStroke,...joinEndpoints.map(e=>e.ci)]);
  for(const ci of highlighted){
   const chosen=contours[ci];if(!isStroke(chosen))continue;
   const coords=chosen.points;
   addSvgEl('path',{d:coords.map((p,i)=>i?`C ${coords[i-1].out.join(' ')} ${p.in.join(' ')} ${p.x} ${p.y}`:`M ${p.x} ${p.y}`).join(' ')+(chosen.closed?` C ${coords.at(-1).out.join(' ')} ${coords[0].in.join(' ')} ${coords[0].x} ${coords[0].y} Z`:''),class:'vector-draft'},root);
   if(ci===selectedStroke&&tool!=='line')for(let i=0;i<coords.length-(chosen.closed?0:1);i++){
    const bend=segmentBend(coords[i],coords[(i+1)%coords.length]);
    addSvgEl('circle',{cx:bend.x,cy:bend.y,r:6,class:'stroke-bend-handle'},root);
   }
   for(let ni=0;ni<coords.length;ni++){
    const n=coords[ni],endpoint=!chosen.closed&&(ni===0||ni===coords.length-1);
    const selected=joinEndpoints.some(e=>e.ci===ci&&e.ni===ni)||(ci===selectedStroke&&selectedBezierNode===ni);
    if(endpoint){
     addSvgEl('rect',{x:n.x-5.5,y:n.y-5.5,width:11,height:11,rx:1.5,class:'stroke-endpoint'+(selected?' selected':'')},root);
    }else{
     addSvgEl('circle',{cx:n.x,cy:n.y,r:selected?6.5:5.5,class:'stroke-junction'+(selected?' selected':'')},root);
    }
    if(selected&&ci===selectedStroke){
     for(const which of ['in','out']){
      const h=n[which];if(!h||Math.hypot(h[0]-n.x,h[1]-n.y)<.5)continue;
      addSvgEl('line',{x1:n.x,y1:n.y,x2:h[0],y2:h[1],class:'vector-handle'},root);
      addSvgEl('circle',{cx:h[0],cy:h[1],r:4.2,class:'vector-control'},root);
     }
    }
   }
  }
 }
 if(tool!=='bezier'||bezierPreview)return;
 // The Outline menu shows which contour is selected without demanding
 // pixel-perfect anchor selection. This highlight is editor-only.
 if(!bezierDraft.length && contours[selectedBezierContour])addSvgEl('path',{d:bezierPath([contours[selectedBezierContour]]),class:'vector-selected-outline'},root);
 // Holes are still editable contours: tint their edges so the user can tell
 // that they subtract ink, while the black fill itself uses nonzero winding.
 contours.forEach(contour=>{if(contour.role==='hole')addSvgEl('path',{d:bezierPath([contour]),class:'vector-hole-outline'},root);});
 if(bezierDraft.length){
   addSvgEl('path',{d:bezierDraftPath(bezierInteraction?.kind==='close'?[...bezierDraft,bezierDraft[0]]:bezierDraft),class:'vector-draft'},root);
   if(bezierHover&&!bezierInteraction){
     const last=bezierDraft[bezierDraft.length-1];
     addSvgEl('path',{d:`M ${last.x} ${last.y} L ${bezierHover.x} ${bezierHover.y}`,class:'vector-next'},root);
   }
 }
 const active=bezierDraft.length? [{points:bezierDraft}]:contours;
 for(let ci=0;ci<active.length;ci++)for(let ni=0;ni<active[ci].points.length;ni++){
   const node=active[ci].points[ni],sel=bezierDraft.length||ci===selectedBezierContour&&ni===selectedBezierNode;
   if(sel){
     for(const which of ['in','out']){
       const handle=node[which];
       if(Math.hypot(handle[0]-node.x,handle[1]-node.y)<.2)continue;
       addSvgEl('line',{x1:node.x,y1:node.y,x2:handle[0],y2:handle[1],class:'vector-handle'},root);
       addSvgEl('circle',{cx:handle[0],cy:handle[1],r:3,class:'vector-control'},root);
     }
   }
   if(bezierDraft.length&&(ni===0||bezierDraft.length>=3&&ni===bezierDraft.length-1)){
     const closing=bezierDraft.length>=3&&bezierHover&&closingBezierAnchor(bezierDraft,bezierHover,bezierPointerRadius(18))===ni;
     addSvgEl('circle',{cx:node.x,cy:node.y,r:closing?12:9,class:'vector-start-ring'},root);
     if(ni===0||closing)addSvgEl('text',{x:node.x+13,y:node.y-12,class:'vector-start-label'},root).textContent=closing?'CLOSE':'START';
   }
   addSvgEl('circle',{cx:node.x,cy:node.y,r:bezierDraft.length?4.6:4.2,class:'vector-anchor'+(sel?' selected':'')},root);
   if(bezierDraft.length)addSvgEl('text',{x:node.x+5,y:node.y+11,class:'vector-point-number'},root).textContent=String(ni+1);
 }
}
function bezierHit(p,pointerType='mouse'){
 const contours=project?.glyphs?.[slotIndex]?.bezierContours||[];
 return hitBezierNode(contours,p,
   bezierPointerRadius(pointerType==='touch'?24:17),
   bezierPointerRadius(pointerType==='touch'?17:12));
}
function bezierPointerDown(ev){
 if(ev.button!==0||bezierPreview||!editableLayerOrWarn())return;
 ev.preventDefault();const p=canvasPos(ev);
 bezierHover=null;
 if(!bezierDraft.length&&selectedStroke>=0){
  const bends=strokeBendHit(project?.glyphs?.[slotIndex]?.bezierContours||[],p,bezierPointerRadius(12));
  const exactNode=bezierHit(p,ev.pointerType);
  const hitTarget=exactNode&&project.glyphs[glyphKey(slotIndex)].bezierContours[exactNode.ci]?.points?.[exactNode.ni];
  const nodeDistance=hitTarget?Math.hypot(hitTarget.x-p.x,hitTarget.y-p.y):Infinity;
  const bendDistance=bends?Math.hypot(bends.bend.x-p.x,bends.bend.y-p.y):Infinity;
  if(bends&&bends.ci===selectedStroke&&(!exactNode||(bendDistance<bezierPointerRadius(7)&&nodeDistance>bezierPointerRadius(7)))){
   canvas.setPointerCapture(ev.pointerId);
   bezierInteraction={kind:'stroke-bend',ci:bends.ci,i:bends.i,before:cloned(project.glyphs[glyphKey(slotIndex)])};
   renderBezierOverlay();return;
  }
 }
 if(bezierDraft.length){
   // Both the first and the third/last point can finish a three-point hole.
   // Use a zoom-independent screen-pixel target, not the tiny visible dot.
   const radius=bezierPointerRadius(ev.pointerType==='touch'?27:19);
   const closingIndex=!ev.altKey?closingBezierAnchor(bezierDraft,p,radius):-1;
   if(closingIndex>=0){
     // Closing is a full pointer gesture, not a click-down action: dragging
     // shapes the previously inaccessible last-to-first Bézier segment.
     // Wait for pointerup before committing so the user sees a live preview.
     canvas.setPointerCapture(ev.pointerId);
     bezierInteraction={kind:'close',closingIndex,start:p,role:ev.shiftKey?'hole':'auto',
       beforeDraft:cloned(bezierDraft),dragged:false};
     renderBezierOverlay();return;
   }
   canvas.setPointerCapture(ev.pointerId);
   if(bezierDraft.length>=1024){status('A single Bézier contour is limited to 1024 anchors. Close it or start another.',true);return;}
   const target=snapCanvasPoint(p);const node=makeBezierAnchor(target.x,target.y);bezierDraft.push(node);
   bezierInteraction={kind:'new',node,start:p,index:bezierDraft.length-1,key:glyphKey(slotIndex)};
   renderBezierOverlay();return;
 }
 // A click on an existing editable outline selects it, instead of
 // accidentally beginning a new contour on top of that outline. Double-click
 // the curve to insert a node at the actual pointer location.
 if(!bezierDraft.length){
  const candidate=nearestContourSegment(project.glyphs[glyphKey(slotIndex)]?.bezierContours||[],p,
    bezierPointerRadius(ev.pointerType==='touch'?18:9));
  if(candidate&&candidate.t>1e-4&&candidate.t<1-1e-4&&!bezierHit(p,ev.pointerType)){
   selectedBezierContour=candidate.ci;selectedBezierNode=-1;
   selectedStroke=isStroke(project.glyphs[glyphKey(slotIndex)].bezierContours[candidate.ci])?candidate.ci:-1;
   renderBezierOverlay();return;
  }
 }
 canvas.setPointerCapture(ev.pointerId);
 const hit=bezierHit(p,ev.pointerType);
 if(hit){
   const before=cloned(project.glyphs[glyphKey(slotIndex)]);
   selectedBezierContour=hit.ci;selectedBezierNode=hit.ni;
   if(isStroke(project.glyphs[glyphKey(slotIndex)].bezierContours[hit.ci])){
    selectedStroke=hit.ci;
    const sc=project.glyphs[glyphKey(slotIndex)].bezierContours[hit.ci];
    if(hit.part==='anchor'&&!sc.closed&&(hit.ni===0||hit.ni===sc.points.length-1)){
     const chosen={ci:hit.ci,ni:hit.ni};
     if(ev.shiftKey&&joinEndpoints.length){
      if(!joinEndpoints.some(e=>e.ci===chosen.ci&&e.ni===chosen.ni))joinEndpoints=[joinEndpoints[0],chosen];
     }else joinEndpoints=[chosen];
    }
   }else{selectedStroke=-1;joinEndpoints=[];}
   bezierInteraction={kind:'edit',hit,before,start:p,mirror:!ev.altKey};
 }else{
   selectedBezierContour=-1;selectedBezierNode=-1;selectedStroke=-1;joinEndpoints=[];
   const target=snapCanvasPoint(p);const node=makeBezierAnchor(target.x,target.y);bezierDraft=[node];
   project.editorDrafts||={};project.editorDrafts[glyphKey(slotIndex)]=bezierDraft;
   bezierInteraction={kind:'new',node,start:p,index:0,key:glyphKey(slotIndex)};
 }
 renderBezierOverlay();
}
function insertBezierAtDoubleClick(ev){
 if(tool!=='bezier'||ev.button!==0||bezierDraft.length||drawing||bezierInteraction||!editableLayerOrWarn())return;
 const p=canvasPos(ev),g=project.glyphs[glyphKey(slotIndex)],hit=nearestContourSegment(g?.bezierContours||[],p,bezierPointerRadius(11));
 if(!hit||hit.t<=.0001||hit.t>=.9999)return;
 if(bezierHit(p,ev.pointerType))return; // Do not duplicate an existing anchor.
 const before=cloned(g);
 try{
  const result=splitEditableBezier(g.bezierContours[hit.ci],hit.segment,hit.t);
  g.bezierContours[hit.ci]=result.contour;
  selectedBezierContour=hit.ci;selectedBezierNode=result.index;
  selectedStroke=isStroke(result.contour)?hit.ci:-1;
  joinEndpoints=[];
  ev.preventDefault();commitBezier(before);
  status('Inserted a precise editable point on the curve. Undo restores the original shape.');
 }catch(error){status('Could not insert point: '+String(error.message||error),true);}
}
function bezierPointerMove(ev){
 if(!bezierInteraction){
   if(bezierDraft.length){bezierHover=canvasPos(ev);renderBezierOverlay();}
   return;
 }
 ev.preventDefault();const p=canvasPos(ev),act=bezierInteraction;
 if(act.kind==='new'){
   if(bezierDist(p,act.start)>1)dragBezierTangent(act.node,p.x,p.y,'out',true);
 }else if(act.kind==='stroke-bend'){
   const contour=project.glyphs[glyphKey(slotIndex)]?.bezierContours?.[act.ci];
   if(contour)setSegmentBend(contour,act.i,p);
 }else if(act.kind==='close'){
   const delta={x:p.x-act.start.x,y:p.y-act.start.y};
   if(act.dragged||bezierDist(p,act.start)>=bezierPointerRadius(4)){
     act.dragged=true;
     dragBezierClosingTangent(bezierDraft,act.closingIndex,delta.x,delta.y);
   }
 }else{
   const node=project.glyphs[glyphKey(slotIndex)].bezierContours[act.hit.ci].points[act.hit.ni];
   if(act.hit.part==='anchor'){const target=snapCanvasPoint(p);moveBezierAnchor(node,target.x,target.y);}
   else dragBezierTangent(node,p.x,p.y,act.hit.part,act.mirror);
   const g=project.glyphs[glyphKey(slotIndex)];g.path=combineGlyphPaths(g.rasterPath,g.bezierContours);
   updateTrace();
 }
 renderBezierOverlay();
}
function bezierPointerUp(ev){
 if(!bezierInteraction)return;
 const act=bezierInteraction;
 if(act.kind==='close'){
   // Consume the final pointer position even when no pointermove was delivered.
   // Tiny click/release jitter keeps the existing handle unchanged.
   const p=canvasPos(ev),dx=p.x-act.start.x,dy=p.y-act.start.y;
   if(act.dragged||Math.hypot(dx,dy)>=bezierPointerRadius(4))
     dragBezierClosingTangent(bezierDraft,act.closingIndex,dx,dy);
   bezierInteraction=null;
   closeBezier(act.role,act.beforeDraft);
   return;
 }
 bezierInteraction=null;
 if(act.kind==='stroke-bend'){
  const g=project.glyphs[glyphKey(slotIndex)],contour=g?.bezierContours?.[act.ci];
  if(contour){setSegmentBend(contour,act.i,canvasPos(ev));commitBezier(act.before);status('Curve bend adjusted. Undo restores the previous shape.');}
 }else if(act.kind==='edit'){
  const current=project?.glyphs?.[glyphKey(slotIndex)];
  if(JSON.stringify(current)!==JSON.stringify(act.before))commitBezier(act.before);
  else renderBezierOverlay(); // Selecting endpoints must not consume Undo.
 }else{
   // Each completed pointer gesture adds ONE independent, reversible anchor.
   // Capture its final handles after dragging; older anchors are not duplicated.
   recordChange('bezierPoint',`${act.key}:${act.index}`,null,cloned(act.node));
   status(`${bezierDraft.length} Bézier anchor${bezierDraft.length===1?'':'s'} placed. Undo removes one point.`);
 }
 renderBezierOverlay();
}
function closeBezier(role='auto',undoDraft=null){
 if(typeof editableLayerOrWarn==='function'&&!editableLayerOrWarn())return;
 if(bezierPreview)return;
 if(!bezierDraft.length&&selectedBezierContour>=0){
   if(isStroke(project?.glyphs?.[glyphKey(slotIndex)]?.bezierContours?.[selectedBezierContour])){joinSelectedStrokeEndpoints('close');return;}
   if(role!=='auto')setSelectedContourRole(role);
   return;
 }
 if(bezierDraft.length<3){status('Add at least three Bézier points before closing the outline.',true);return;}
 const key=glyphKey(slotIndex),beforeGlyph=cloned(project.glyphs[key]),beforeDraft=cloned(undoDraft??bezierDraft),g=bezierEntry();
 const finalRole=role==='auto'?automaticBezierRole(bezierDraft,g.bezierContours):role;
 g.bezierContours.push({role:finalRole==='hole'?'hole':'fill',points:structuredClone(bezierDraft)});
 selectedBezierContour=g.bezierContours.length-1;selectedBezierNode=0;
 g.path=combineGlyphPaths(g.rasterPath,g.bezierContours);g.modified=true;project.glyphs[key]=g;
 saveDraft(project.editorDrafts,key,null);bezierDraft=[];bezierInteraction=null;bezierHover=null;
 recordChange('bezierFinish',key,{glyph:beforeGlyph,draft:beforeDraft},{glyph:cloned(g),draft:null});
 updateTrace();updateProgress();renderBezierOverlay();status(finalRole==='hole'?'Transparent hole created. Undo reopens the outline.':'Filled contour created. Select it and press Make selected outline a hole to cut out its centre.');
}
function cancelBezier(){
 if(!bezierDraft.length)return;
 const key=glyphKey(slotIndex),before=cloned(bezierDraft);
 saveDraft(project.editorDrafts,key,null);bezierDraft=[];bezierInteraction=null;bezierHover=null;
 recordChange('bezierDraft',key,before,null);renderBezierOverlay();status('Unfinished Bézier outline cancelled (Undo restores it).');
}
function setSelectedContourRole(role){
 if(typeof editableLayerOrWarn==='function'&&!editableLayerOrWarn())return;
 if(bezierDraft.length||bezierPreview||selectedBezierContour<0||!['fill','hole'].includes(role))return;
 const key=glyphKey(slotIndex),before=cloned(project.glyphs[key]),g=bezierEntry();
 const contour=g.bezierContours[selectedBezierContour];if(!contour)return;
 contour.role=role;
 commitBezier(before);
 status(role==='hole'?'The selected inner contour cuts transparent space out of enclosing black contours.':'The selected contour now adds black ink.');
}
async function toggleBezierFillPreview(){
 bezierPreview=!bezierPreview;
 await renderOriginalGuide();drawMetricGuides();renderBezierOverlay();
}
function deleteSelectedBezier(){
 if(typeof editableLayerOrWarn==='function'&&!editableLayerOrWarn())return;
 if(bezierDraft.length){status('Close or cancel the current outline before deleting a finished contour.',true);return;}
 if(selectedBezierContour<0)return;
 const key=glyphKey(slotIndex),before=cloned(project.glyphs[key]),g=bezierEntry();
 if(!g.bezierContours[selectedBezierContour])return;
 g.bezierContours.splice(selectedBezierContour,1);
 selectedBezierContour=-1;selectedBezierNode=-1;commitBezier(before);
}
// History stays chronological across the project. Crossing to another glyph
// requires the user's explicit choice; Stay does not consume the history item.
async function applyHistory(direction,approvedChange=null){
 if(!project||bezierInteraction||historyActionBusy)return;
 const source=direction==='undo'?history:redoStack,change=source.at(-1);
 if(!change||(!approvedChange&&historyNavigationPending))return;
 if(approvedChange&&approvedChange!==change)return; // History/project changed while dialog was open.
 if(!approvedChange&&historyWouldSwitchGlyph(change,slotIndex)){
  if(!$('modal').hidden)return; // Never replace another open dialog.
  const destination=historyGlyphIndex(change);
  const name=slots[destination]?.word||`entry ${destination+1}`;
  const verb=direction==='undo'?'Undo':'Redo';
  historyNavigationPending=true;
  dialog(`${verb} on another glyph`,
    `<p>The next <strong>${verb}</strong> belongs to glyph <strong>${escapeHtml(name)}</strong> (entry ${destination+1}/${slots.length}), not your current glyph.</p>`+
    `<p><strong>Go back</strong> switches to that glyph and applies ${verb.toLowerCase()}. <strong>Stay</strong> leaves your current glyph and history unchanged.</p>`+
    `<div class="modal-actions"><button class="btn" type="button" id="historyStay">Stay</button><button class="btn primary" type="button" id="historyGoBack">Go back</button></div>`);
  $('historyStay').onclick=closeModal;
  $('historyGoBack').onclick=()=>{closeModal();void applyHistory(direction,change);};
  $('historyStay').focus();
  return;
 }
 historyActionBusy=true;
 try{
  // Confirm the entry is still the same before consuming it.
  if(source.at(-1)!==change)return;
  source.pop();(direction==='undo'?redoStack:history).push(change);
  try{await applyChange(change,direction==='undo'?'before':'after');}
  catch(e){(direction==='undo'?redoStack:history).pop();source.push(change);throw e;}
 }catch(e){status(`${direction==='undo'?'Undo':'Redo'} failed: ${e.message}`,true);}
 finally{historyActionBusy=false;}
}
async function undo(){return applyHistory('undo');}
async function redo(){return applyHistory('redo');}
function updateTrace(){const g=project?.glyphs?.[slotIndex],out=$('tracePreview');out.textContent='';if(!g?.path){const e=document.createElement('span');e.className='empty';e.textContent='Draw a glyph to preview its vector outline';out.appendChild(e);return;}
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox',`0 0 ${ARTBOARD_WIDTH} ${ARTBOARD_HEIGHT}`);svg.setAttribute('width','108');svg.setAttribute('height','108');const path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d',g.path);path.setAttribute('fill','#191929');path.setAttribute('fill-rule','nonzero');svg.appendChild(path);out.appendChild(svg);
}
function download(blob,filename){const a=document.createElement('a'),url=URL.createObjectURL(blob);a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}
const safename=n=>String(n||'font').replace(/[^\w.-]+/g,'-').slice(0,90);
async function exportGlyph(){const g=project?.glyphs?.[slotIndex];if(!g?.path){status('Draw the glyph before exporting SVG.',true);return;}
 download(new Blob([svgFromTrace({path:g.path},{width:ARTBOARD_WIDTH,height:ARTBOARD_HEIGHT})],{type:'image/svg+xml'}),`${safename(slotMeta(slotIndex).word)}.svg`);status('SVG exported');}
async function exportJson(){if(!project)return;download(new Blob([JSON.stringify(project,null,2)],{type:'application/json'}),`${safename(project.name)}-project.json`);status('Complete project file exported');}
async function vectorZip(){if(!project)return;const review=evaluateExport(project);const files=[];for(const [key,g] of Object.entries(project.glyphs))if(g.path){const name=slotMeta(Number(key)).word||`slot-${key}`;files.push([`glyphs/${String(key).padStart(3,'0')}-${safename(name)}.svg`,svgFromTrace({path:g.path},{width:ARTBOARD_WIDTH,height:ARTBOARD_HEIGHT})]);}
  files.push(['manifest.json',JSON.stringify({project:project.name,version:1,glyphCount:files.length,compounds:project.compounds,settings:project.settings,notes:'These are vector assets, NOT a working OpenType/TTF font.'},null,2)]);
  files.push(...licenceFiles(project,review));
  if(files.length===1){status('Draw at least one glyph to export vector assets.',true);return;}
  download(makeZip(files),`${safename(project.name)}-vector-assets.zip`);status(`Exported ${files.length-1} glyph SVG outlines`);
}
// Licence responsibility is acknowledged before import, not gated at export.
// Documents are selected first, kept in memory until a font is successfully
// imported, and then stored with the original font in the IndexedDB project.
function dialog(title,html){$('modalTitle').textContent=title;$('modalBody').innerHTML=html;$('modal').hidden=false;}
function closeModal(){$('modal').hidden=true;$('modalBody').textContent='';historyNavigationPending=false;}
function requestFontImport(){
  fontImportAcknowledged=false;
  pendingImportLicences=[];
  importAcknowledgement=null;
  dialog('Font licence acknowledgement',`
    <p>Import the font's original licence file and acknowledge your responsibility for permission to import, modify and export the resulting font. Licence compatibility is not checked and will not prevent export.</p>
    <label for="fontLicenceDocuments">Original font licence file (required; TXT, MD, OFL, LICENSE, HTML or PDF)</label>
    <input id="fontLicenceDocuments" type="file" multiple>
    <p class="small muted" id="fontLicenceDocumentsStatus" role="status">Choose the licence file that accompanies your font. Additional notice files may also be selected.</p>
    <div class="check-list"><label class="licence-ack-label" for="fontLicenceAck"><input type="checkbox" id="fontLicenceAck"> <span>${escapeHtml(FONT_LICENCE_ACK_TEXT)}</span></label></div>
    <div class="modal-actions"><button class="btn" type="button" id="cancelFontImport">Cancel</button><button class="btn primary" type="button" id="confirmFontImport" disabled>Continue to select font…</button></div>`);
  let reading=false;
  const checkbox=$('fontLicenceAck'),confirm=$('confirmFontImport'),message=$('fontLicenceDocumentsStatus');
  const refresh=()=>{confirm.disabled=reading||!checkbox.checked||pendingImportLicences.length===0;};
  checkbox.onchange=refresh;
  $('fontLicenceDocuments').onchange=async()=>{
    const files=[...$('fontLicenceDocuments').files];
    pendingImportLicences=[];reading=true;refresh();
    try{
      const chosen=[];
      for(const file of files)chosen.push(await readLicenceDocument(file,chosen));
      pendingImportLicences=chosen;
      message.textContent=chosen.length?`Licence/notice files ready: ${chosen.map(d=>d.originalName).join(', ')}`:'Choose at least one original licence file.';
      message.style.color='';
    }catch(e){pendingImportLicences=[];message.textContent='Licence file rejected: '+e.message;message.style.color='#b23b30';}
    finally{reading=false;refresh();}
  };
  $('cancelFontImport').onclick=()=>{pendingImportLicences=[];importAcknowledgement=null;closeModal();};
  confirm.onclick=()=>{
    if(confirm.disabled)return;
    importAcknowledgement={acknowledgedAt:new Date().toISOString(),statement:FONT_LICENCE_ACK_TEXT};
    closeModal();fontImportAcknowledged=true;
    // File picker starts directly in a user click, without losing activation.
    $('fileImportFont').click();
  };
}
async function startNew(){clearCompiledPreview();cancelSelection();dialog('Create font project',`<label for="newProjectName">Font family name</label><input id="newProjectName" value="My Sitelen Pona Font" maxlength="100"><p>The new project uses the 180-slot SP Font Maker template. Existing projects are preserved.</p><div class="modal-actions"><button class="btn" id="cancelCreate">Cancel</button><button class="btn primary" id="confirmCreate">Create project</button></div>`);
  $('cancelCreate').onclick=closeModal;$('confirmCreate').onclick=async()=>{const name=$('newProjectName').value.trim()||'Untitled font';clearTimeout(saveTimer);await saveNow();project=newProject(name);importedFamily=null;importedCmapCache=new Map();history=[];redoStack=[];await saveNow();closeModal();refreshIdentity();await refreshProjectPicker();await selectGlyph(slots.findIndex(s=>s.word==='jan'));switchTab('glyph');status('New blank project created');};}
// Project deletion is deliberately not undoable. Wait for any in-flight
// autosave BEFORE deleting the project/history in one IndexedDB transaction;
// otherwise an older pending write could recreate the deleted record.
function requestDeleteProject(){
  if(!storageAvailable||!project){status('No saved project is available to delete.',true);return;}
  const id=project.id,name=project.name;
  dialog('Delete project',`<p id="deleteProjectWarning"></p><p>This permanently deletes the project, its imported font, saved licence documents, glyph edits and undo history from this browser. It cannot be undone. Other projects will not be affected.</p><div class="modal-actions"><button type="button" class="btn" id="cancelDeleteProject">Cancel</button><button type="button" class="btn danger" id="confirmDeleteProject">Delete project</button></div>`);
  // A project name is user-controlled; never interpolate it into innerHTML.
  $('deleteProjectWarning').textContent=`Delete “${name}”?`;
  $('cancelDeleteProject').onclick=closeModal;
  $('confirmDeleteProject').onclick=async()=>{
    if(deletingProject||project?.id!==id)return;
    const confirm=$('confirmDeleteProject');confirm.disabled=true;
    deletingProject=true;
    clearTimeout(saveTimer);clearTimeout(traceTimer);
    try{
      await pendingSave;
      await deleteProject(id); // removes both the project and its stored history
      closeModal();
      clearCompiledPreview();cancelSelection();
      project=null;importedFamily=null;importedCmapCache=new Map();
      cachedSourceFont=null;cachedSourceReferenceBytes=null;
      history=[];redoStack=[];
      deletingProject=false;
      await refreshProjectPicker();
      if(projects.length){
        await switchProject(projects[0].id);
      }else{
        // The editor needs an active workspace. A new blank project is
        // created only after the last saved project has been deleted.
        project=newProject('My Sitelen Pona Font');
        await saveNow();
        await switchProject(project.id);
      }
      try{localStorage.setItem('spfm-active-project',project.id);}catch(_){/* storage may be unavailable */}
      status(`Deleted “${name}”.`);
    }catch(error){
      deletingProject=false;
      confirm.disabled=false;
      status('Project deletion failed: '+String(error.message||error),true);
    }
  };
}
async function refreshProjectPicker(){projects=await listProjects();projects.sort((a,b)=>String(b.updatedAt||'').localeCompare(String(a.updatedAt||'')));const sel=$('projectSelect');sel.textContent='';for(const p of projects){const o=document.createElement('option');o.value=p.id;o.textContent=p.name;sel.appendChild(o);}if(project)sel.value=project.id;}
async function switchProject(id){const preservedGlyph=slotIndex;clearCompiledPreview();cancelSelection();clearTimeout(traceTimer);clearTimeout(saveTimer);if(project)await saveNow();project=await loadProject(id);if(!project)return;project.glyphs||={};project.compounds||={};project.editorDrafts||={};project.settings||={};refreshPreviewAdjusters();const storedHistory=await loadProjectHistory(id);importedCmapCache=new Map();history=Array.isArray(storedHistory.undo)?storedHistory.undo:[];redoStack=Array.isArray(storedHistory.redo)?storedHistory.redo:[];importedFamily=null;
  if(project.sourceFont){try{if(!project.sourceFont.attachmentGeometry)project.sourceFont.attachmentGeometry=inspectAttachmentGeometry(fromBase64(project.sourceFont.normalizedTtf||project.sourceFont.data));importedFamily=await registerFont(sourceReferenceBytes(),project.id)}catch(e){status('Could not load saved source font: '+e.message,true)}}
  compoundReferencePreviews.clear();
  await selectGlyph(slots[preservedGlyph]?preservedGlyph:slots.findIndex(x=>x.word==='jan'));refreshIdentity();refreshCompoundChoices();renderOverrideList();await refreshProjectPicker();status(`Opened ${project.name} · ${slots[slotIndex].word}`);}
function toBase64(data){let s='';for(let i=0;i<data.length;i+=8192)s+=String.fromCharCode(...data.subarray(i,i+8192));return btoa(s);}
function fromBase64(s){const binary=atob(s),out=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)out[i]=binary.charCodeAt(i);return out;}
async function importProjectFile(file){clearCompiledPreview();try{const d=JSON.parse(await file.text());if(d.version!==1||!d.glyphs||!d.compounds||typeof d.name!=='string')throw new Error('Unsupported project file format');
  resolveLinkedGlyphPaths(d);d.editorDrafts||={};d.id=uid();d.name=`${d.name} (imported)`;d.createdAt=new Date().toISOString();clearTimeout(saveTimer);await saveNow();project=d;history=[];redoStack=[];await saveNow();await switchProject(d.id);status('Editable project imported successfully');}catch(e){status('Project import failed: '+e.message,true)}}
async function importFontFile(file,licenceDocuments,acknowledgement){if(!file)return;try{
  if(!acknowledgement||!Array.isArray(licenceDocuments)||licenceDocuments.length===0)throw Error('A licence file and acknowledgement are required before importing a font.');const data=new Uint8Array(await file.arrayBuffer());if(data.length<100||data.length>20_000_000)throw new Error('Font must be between 100 B and 20 MB');
  const magic=new DataView(data.buffer).getUint32(0);if(![0x00010000,0x4f54544f,0x74727565].includes(magic))throw new Error('Unsupported SFNT header (TTF/OTF only; collections not supported).');
  // CFF outlines are converted once at import. Do not change the current
  // project, save any records or open a new font family if this step fails.
  const normalized=normalizeImportedFont(data);
  const mapped=mapImportedLigaturesToUcsur(normalized.bytes,slots);
  if(mapped.bytes.length>40_000_000)throw Error('Normalized TrueType font exceeds the 40 MB limit.');
  const name=file.name.replace(/\.(ttf|otf)$/i,'').replace(/[-_]/g,' ');
  const candidate=newProject(name);
  let geometry;
  try{geometry=inspectAttachmentGeometry(mapped.bytes);}catch(e){
    geometry={...BLANK_ATTACH,warnings:['The imported font’s attachment geometry could not be read: '+String(e.message||e)+'. Confirm positions manually before export.']};
  }
  const family=await registerFont(mapped.bytes,candidate.id);clearTimeout(saveTimer);await saveNow();candidate.sourceFont={name:file.name,data:toBase64(data),
    // Static OTF/CFF imports keep the original untouched for references and
    // licensing, and store their normalized TTF for all later compilations.
    // TTF sources are already normalized: do not duplicate their large bytes.
    ...(mapped.bytes===data?{}:{normalizedTtf:toBase64(mapped.bytes)}),
    importedLigatureAliases:mapped.added,
    normalizedFormat:'truetype',importFormat:normalized.format,
    attachmentGeometry:geometry,metadata:fontNameMetadata(data),origin:'imported',
    outlinePreservation:normalized.format==='cff1'
      ?'Original CFF preserved; cubic vectors normalized to quadratic TrueType outlines once at import'
      :'Original TrueType glyf outlines retained by compiler; raster previews only',
    licenceAcknowledgement:acknowledgement};
  candidate.licensing.documents=structuredClone(licenceDocuments);
  candidate.licensing.basis='user-acknowledged';
  candidate.licensing.importAcknowledgement=structuredClone(acknowledgement);
  project=candidate;history=[];redoStack=[];importedFamily=family;importedCmapCache=new Map();await saveNow();refreshIdentity();await refreshProjectPicker();await selectGlyph(slots.findIndex(x=>x.word==='jan'));
  dialog('Font imported',`<p><strong>${escapeHtml(file.name)}</strong> is now the source of a new project. The original font and licence are retained unchanged in IndexedDB.</p><p>${normalized.format==='cff1'?'The original cubic outlines were converted once into a stored TrueType source.':'The original TrueType outlines are used directly.'} ${mapped.added?`${mapped.added} sitelen pona glyphs were matched from the imported font’s own word ligatures.`:''} Unmodified source outlines remain vector artwork in both exported TTF fonts; user-edited contours override them.</p><div class="check-list"><label><input type="checkbox" id="importAll" checked> Populate all template slots with supported UCSUR glyphs</label></div><div class="modal-actions"><button class="btn" id="importSkip">Do later</button><button class="btn primary" id="importProceed">Populate drawings</button></div>`);
  $('importSkip').onclick=()=>{closeModal();status('Font source retained; individual glyphs can be restored on demand');};
  $('importProceed').onclick=async()=>{const all=$('importAll').checked;closeModal();if(all)await populateSourceFont(mapped.bytes,family);else await restoreSelectedFontGlyph();};
}catch(e){status('Font import failed: '+e.message,true);}}
async function restoreSelectedFontGlyph(){if(!project?.sourceFont)return;try{const bytes=sourceReferenceBytes();if(!importedFamily)importedFamily=await registerFont(bytes,project.id);const s=slotMeta(slotIndex);if(!s.codepoint||!fontHasCodepoint(bytes,Number(s.codepoint))){status('Selected UCSUR glyph not found in imported font; choose another slot.',true);return;}
 const k=glyphKey(slotIndex),before=cloned(project.glyphs[k]);const shift=editorShiftFor();const c=rasterizeFontGlyphAligned(importedFamily,Number(s.codepoint),
  {width:ARTBOARD_WIDTH,height:ARTBOARD_HEIGHT,shiftX:shift.x,shiftY:shift.y});clearCanvas();ctx.drawImage(c,0,0);commitGlyph();project.glyphs[slotIndex].editorShift=shift;project.glyphs[slotIndex].modified=false;project.glyphs[slotIndex].rasterCopyForEditing=true;recordChange('glyph',k,before,project.glyphs[k]);saveSoon();status(`Imported ${s.word} preview; the stored TrueType source stays unchanged until you draw`);
}catch(e){status('Cannot extract source glyph: '+e.message,true);}}
async function populateSourceFont(bytes,family){status('Importing supported UCSUR glyphs…');let added=0;const original=slotIndex;
 for(let i=0;i<slots.length;i++){const slot=slots[i];if(!slot.codepoint||!fontHasCodepoint(bytes,Number(slot.codepoint)))continue;
  const shift=editorShiftFor(i);const c=rasterizeFontGlyphAligned(family,Number(slot.codepoint),
    {width:ARTBOARD_WIDTH,height:ARTBOARD_HEIGHT,shiftX:shift.x,shiftY:shift.y}),t=traceGlyph(c,96,1);if(!t.path)continue;
  project.glyphs[i]={...(project.glyphs[i]||{}),raster:c.toDataURL('image/png'),path:t.path,contours:t.contours,editorShift:shift,modified:false,rasterCopyForEditing:false,source:'font-rasterized'};added++;
  if(i%16===0){status(`Importing glyphs: ${i+1}/${slots.length}`);await new Promise(r=>setTimeout(r,0));}
 }
 await saveNow();await selectGlyph(original);status(`Imported ${added} existing glyphs. Source font bytes also retained.`);
}
function applyMetadata(){
 const base=slots[slotIndex];const word=$('glyphWord').value.trim().toLowerCase();
 if(base.customSlot){
  if(!validTokiPonaCustomName(word)){status('Custom names must be 2–32 lowercase Toki Pona letters forming (C)V(N) syllables (no digits, ji, ti, wo, wu, nm or nn).',true);return;}
  if(['ni01','ni02','ni03','ni04','sewi01','sewi02','te','to','zz'].includes(word)){status('Reserved name/alias: '+word,true);return;}
  if(slots.some((s,i)=>i!==slotIndex&&(slotMeta(i).word||s.word)===word)){status('Custom glyph name already in use.',true);return;}
 }else if(word!==base.word){status('Standard and ASCII assignments cannot be renamed.',true);return;}
 const aliases=$('glyphAliases').value.split('\n').map(x=>x.trim()).filter(Boolean);
 if(aliases.some(a=>base.customSlot ? !validTokiPonaCustomName(a) : !/^[a-z][a-z0-9]{1,31}$/.test(a))){status(base.customSlot?'Custom-slot aliases must follow (C)V(N) Toki Pona phonotactics.':'Standard glyph aliases must use 2–32 lowercase letters/digits.',true);return;}
 const g={...(project.glyphs[slotIndex]||{})};g.word=word;g.codepoint=base.codepoint;g.aliases=aliases;
 const before=cloned(project.glyphs[slotIndex]);project.glyphs[slotIndex]=g;recordChange('glyph',glyphKey(slotIndex),before,g);saveSoon();selectGlyph(slotIndex);refreshCompoundChoices();status('Glyph metadata updated');}
function setTool(next){
 if(next!==tool){selectedWidthSession=null;selectedWidthStart=brushWidth();}
 if(curvePending && next!=='curve')cancelCurve();
 if(drawing){restoreStrokeBase();clearDrawingGesture();}
 // Never implicitly close or discard an unfinished contour when panning or switching tools.
 // Drafts remain in project.editorDrafts and can be resumed in Bézier mode.
 tool=next;canvas.style.cursor='';$('canvasViewport').classList.toggle('pan-tool',next==='pan');
 renderSelectionOverlay();refreshSelectionToolbar();
 for(const id of ['btnCloseBezier','btnCloseBezierHole','btnCancelBezier','btnDeleteBezier','btnBezierPreview','bezierRoleWrapper','bezierPickerWrapper'])$(id).hidden=next!=='bezier';
 renderOriginalGuide();drawMetricGuides();
 document.querySelectorAll('[data-tool]').forEach(b=>{const active=b.dataset.tool===next;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});
 renderBezierOverlay();
}
function toggleExpandedEditor(next=!expandedEditor){
 expandedEditor=!!next;document.body.classList.toggle('editor-expanded',expandedEditor);
 const b=$('btnExpandEditor');b.textContent=expandedEditor?'⤢ Exit expanded editor':'⛶ Expand editor';
 b.setAttribute('aria-pressed',String(expandedEditor));
 // Resize only the viewport camera; preserve the canvas and complete undo
 // history, rather than creating a second editor or copying artwork.
 requestAnimationFrame(()=>{trackCanvasSize();if(!viewportReady)fitCanvas();});
}
function setFilter(next){filtered=next;for(const f of ['all','drawn','missing'])$('filter'+f[0].toUpperCase()+f.slice(1)).setAttribute('aria-pressed',String(next===f));renderGlyphList();}
// Camera-only zoom/pan. The editable canvas now includes true font extents,
// including the negative descender space used by cartouche/long-pi glyphs.
function drawCanvasCamera(){
  const view=$('canvasViewport');if(!view.clientWidth||!view.clientHeight)return;
  canvasOffset=clampOffset(canvasOffset,canvasScale,view.clientWidth,view.clientHeight);
  $('canvasPlane').style.transform=`translate3d(${canvasOffset.x}px,${canvasOffset.y}px,0) scale(${canvasScale})`;
  $('zoomLabel').textContent=Math.round(canvasZoom*100)+'%';
  $('btnFitCanvas').setAttribute('aria-pressed',String(fitMode));
}
function fitCanvas(){
  const view=$('canvasViewport');if(!view.clientWidth||!view.clientHeight)return;
  canvasFit=fitScale(view.clientWidth,view.clientHeight);canvasZoom=1;canvasScale=canvasFit;
  canvasOffset=clampOffset({x:0,y:0},canvasScale,view.clientWidth,view.clientHeight);
  viewportReady=true;fitMode=true;drawCanvasCamera();
}
function setZoom(n,clientX,clientY){
  const view=$('canvasViewport');if(!view.clientWidth||!view.clientHeight)return;
  if(!viewportReady)fitCanvas();
  const rect=view.getBoundingClientRect();
  const anchor={x:clientX==null?rect.width/2:clientX-rect.left,
                y:clientY==null?rect.height/2:clientY-rect.top};
  const oldScale=canvasScale;
  canvasZoom=Math.max(.3,Math.min(8,n));canvasScale=canvasFit*canvasZoom;
  canvasOffset=zoomAt(canvasOffset,oldScale,canvasScale,anchor);
  fitMode=false;drawCanvasCamera();
}
function resizeCanvas(){
  const view=$('canvasViewport');if(!view.clientWidth||!view.clientHeight)return;
  if(!viewportReady||fitMode){fitCanvas();return;}
  const oldCenter=artboardPoint(canvasOffset,canvasScale,{x:canvasLastWidth/2,y:canvasLastHeight/2});
  canvasFit=fitScale(view.clientWidth,view.clientHeight);
  canvasScale=canvasFit*canvasZoom;
  canvasOffset={x:view.clientWidth/2-oldCenter.x*canvasScale,
                y:view.clientHeight/2-oldCenter.y*canvasScale};
  drawCanvasCamera();
}
let canvasLastWidth=0,canvasLastHeight=0;
function trackCanvasSize(){
  const view=$('canvasViewport');
  if(view.clientWidth===canvasLastWidth&&view.clientHeight===canvasLastHeight)return;
  resizeCanvas();canvasLastWidth=view.clientWidth;canvasLastHeight=view.clientHeight;
}
function startPan(ev){
  const view=$('canvasViewport');ev.preventDefault();
  if(panDrag)return;
  panDrag={pointerId:ev.pointerId,x:ev.clientX,y:ev.clientY,origin:{...canvasOffset}};
  view.setPointerCapture(ev.pointerId);view.classList.add('is-panning');
}
function movePan(ev){
  if(!panDrag||panDrag.pointerId!==ev.pointerId)return;
  ev.preventDefault();
  canvasOffset={x:panDrag.origin.x+ev.clientX-panDrag.x,y:panDrag.origin.y+ev.clientY-panDrag.y};
  fitMode=false;drawCanvasCamera();
}
function stopPan(ev){
  if(!panDrag||panDrag.pointerId!==ev.pointerId)return;
  const view=$('canvasViewport');
  if(view.hasPointerCapture(ev.pointerId))view.releasePointerCapture(ev.pointerId);
  panDrag=null;view.classList.remove('is-panning');
}
function wantsPan(ev){return tool==='pan'||spacePan||ev.button===1;}
function switchTab(id){activeTab=id;document.querySelectorAll('.tab').forEach(b=>{const active=b.dataset.tab===id;b.classList.toggle('active',active);b.setAttribute('aria-selected',String(active));});document.querySelectorAll('.pane').forEach(e=>{const on=e.id===`pane-${id}`;e.classList.toggle('active',on);e.hidden=!on;});if(id==='glyph')requestAnimationFrame(trackCanvasSize);if(id==='compound'){refreshCompoundChoices();renderCompound();}if(id==='preview'){renderCompiledPreview();showPreviewState();}if(id==='typography'){if($('typoGlyph'))$('typoGlyph').value=String(slotIndex);refreshTypographyUI();}if(id==='build'){refreshIdentity();refreshHintingUI();refreshPreviewAdjusters();}}
// Compound editor: symbolic composition with user-owned override geometry.
function compoundValue(){return `${$('compoundLeft').value}${$('compoundOperator').value}${$('compoundRight').value}`;}
function refreshCompoundChoices(){for(const id of ['compoundLeft','compoundRight']){const select=$(id),last=select.value;select.textContent='';slots.filter(s=>s.kind!=='ascii'&&(slotMeta(s.index).word||s.word)&&!(slotMeta(s.index).word||s.word).startsWith('custom-')).forEach(s=>{const o=document.createElement('option');o.value=slotMeta(s.index).word||s.word;o.textContent=slotMeta(s.index).word||s.word;select.appendChild(o);});select.value=last|| (id==='compoundLeft'?'toki':'pona');if(!select.value)select.selectedIndex=0;}}
function defaultCompound(left,op,right){const a={word:left,x:op==='-'?170:105,y:op==='-'?220:95,scale:op==='-'?.6:.78,rotation:0};const b={word:right,x:op==='-'?170:op==='+'?205:280,y:op==='-'?35:op==='+'?180:95,scale:op==='-'?.6:op==='+'?.38:.78,rotation:0};return {name:`${left}${op}${right}`,left,operator:op,right,parts:[a,b],type:'custom-override'};}
function getCompound(){if(!project)return null;const left=$('compoundLeft').value,right=$('compoundRight').value,op=$('compoundOperator').value;compoundKey=`${left}${op}${right}`;return project.compounds[compoundKey]||defaultCompound(left,op,right);}
function setOverride(){const c=getCompound(),before=cloned(project.compounds[compoundKey]);project.compounds[compoundKey]=structuredClone(c);recordChange('compound',compoundKey,before,project.compounds[compoundKey]);saveSoon();renderCompound();renderOverrideList();status(`Override saved: ${compoundKey}`);}
function resetOverride(){const key=compoundValue(),before=cloned(project.compounds[key]);delete project.compounds[key];recordChange('compound',key,before,null);saveSoon();renderCompound();renderOverrideList();status(`Override removed: ${key}`);}
function findGlyphIndex(word){return slots.findIndex(s=>(slotMeta(s.index).word||s.word)===word);}
function addSvg(tag,attrs={},parent=$('compoundSvg')){const el=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [k,v] of Object.entries(attrs))el.setAttribute(k,String(v));parent.appendChild(el);return el;}
// Compound parts without user-created outlines are still real glyphs. Display
// the imported font when its cmap contains the slot; otherwise display the
// bundled Fairfax glyph, using the same fallback as the drawing guide.
// This raster image is preview-only: no raster or outline enters project.glyphs.
function compoundReferencePreview(word){
 const idx=findGlyphIndex(word),slot=idx>=0?slots[idx]:null,cp=Number(slot?.codepoint);
 if(!Number.isInteger(cp)||cp<=0||cp>0x10FFFF)return Promise.resolve(null);
 const selectedProject=project;
 const key=`${selectedProject.id}:${cp}`;
 if(compoundReferencePreviews.has(key))return compoundReferencePreviews.get(key);
 const pending=(async()=>{
   let family=null;
   if(selectedProject.sourceFont){
     const bytes=sourceReferenceBytes();
     if(fontHasCodepoint(bytes,cp)){
       // switchProject normally registers this face; recover gracefully if it
       // was not available when the project was opened.
       if(!importedFamily)importedFamily=await registerFont(bytes,selectedProject.id);
       family=importedFamily;
     }
   }
   if(!family){const reference=await loadFairfaxReferenceFont(slot);family=reference?.family||null;}
   if(!family)return null;
   return rasterizeFontGlyph(family,cp).toDataURL('image/png');
 })().catch(error=>{
   compoundReferencePreviews.delete(key);
   console.warn('Could not render compound source glyph:',word,error);
   return null;
 });
 compoundReferencePreviews.set(key,pending);
 return pending;
}
function renderCompound(){if(!project)return;const c=getCompound(),svg=$('compoundSvg');$('compoundName').textContent=compoundKey;
 svg.replaceChildren();addSvg('rect',{width:600,height:460,fill:'#fffdf7'});for(let x=0;x<600;x+=40)addSvg('line',{x1:x,y1:0,x2:x,y2:460,stroke:'#e9e1d5','stroke-width':.7});for(let y=0;y<460;y+=40)addSvg('line',{x1:0,y1:y,x2:600,y2:y,stroke:'#e9e1d5','stroke-width':.7});
 const referenceWords=[];
 c.parts.forEach((p,i)=>{const g=addSvg('g',{'data-part':i,transform:`translate(${p.x} ${p.y}) rotate(${p.rotation||0} 128 128) scale(${p.scale})`,class:`compound-piece ${i===compoundSelection?'selected':''}`});
   const idx=findGlyphIndex(p.word),glyph=idx>=0?project.glyphs[idx]:null,kind=compoundPreviewKind(glyph);
   // Transparent hit region preserves drag/select across the entire component
   // box even when the reference glyph has large empty areas.
   addSvg('rect',{x:0,y:0,width:256,height:256,fill:'transparent','pointer-events':'all'},g);
   const artwork=addSvg('g',{'class':'compound-part-artwork'},g);
   if(kind==='edited')addSvg('path',{d:glyph.path,fill:'#211d28','fill-rule':'nonzero'},artwork);
   else if(kind==='reference'){
     referenceWords.push(p.word);
     const label=addSvg('text',{x:128,y:135,'text-anchor':'middle',fill:'#806c5d','font-size':20},artwork);label.textContent='Loading '+p.word+'…';
     const renderingProject=project;
     compoundReferencePreview(p.word).then(url=>{
       // A pointer drag re-creates the whole SVG. Never update detached parts
       // or an image belonging to a project that is no longer selected.
       if(!artwork.isConnected||project!==renderingProject)return;
       artwork.replaceChildren();
       if(url)addSvg('image',{x:0,y:0,width:256,height:256,href:url,'aria-label':p.word},artwork);
       else{const fallback=addSvg('text',{x:128,y:135,'text-anchor':'middle',fill:'#806c5d','font-size':20},artwork);fallback.textContent=`${p.word} (unavailable)`;}
     });
   }else{
     const label=addSvg('text',{x:128,y:135,'text-anchor':'middle',fill:'#806c5d','font-size':20},artwork);label.textContent=`${p.word} (empty)`;
   }
   // Keep the selection indication above the asynchronously loaded image.
   if(i===compoundSelection)addSvg('rect',{x:0,y:0,width:256,height:256,fill:'none',stroke:'#8462b9','stroke-width':2,'stroke-dasharray':'8 5'},g);
 });
 $('compoundStatus').textContent=compoundPreviewStatus(!!project.compounds[compoundKey],referenceWords);
 updateComponentControls(c);
}
function updateComponentControls(c){const p=c.parts[compoundSelection];if(!p)return;$('compX').value=p.x;$('compY').value=p.y;$('compScale').value=p.scale;$('compScaleLabel').textContent=Number(p.scale).toFixed(2);$('compRotation').value=p.rotation||0;}
function updateComponent(key,value){const c=getCompound(),before=cloned(project.compounds[compoundKey]);c.parts[compoundSelection][key]=value;project.compounds[compoundKey]=c;recordChange('compound',compoundKey,before,c);renderCompound();renderOverrideList();saveSoon();}
function svgPoint(evt){const pt=$('compoundSvg').createSVGPoint();pt.x=evt.clientX;pt.y=evt.clientY;return pt.matrixTransform($('compoundSvg').getScreenCTM().inverse());}
function compDown(e){let p=e.target;while(p&&p!==$('compoundSvg')&&!p.hasAttribute('data-part'))p=p.parentNode;if(!p||p===$('compoundSvg'))return;
  compoundSelection=Number(p.getAttribute('data-part'));compDragging=true;compoundDragBefore=cloned(project.compounds[getCompound().name]);compLast=svgPoint(e);$('compoundSvg').setPointerCapture(e.pointerId);renderCompound();}
function compMove(e){if(!compDragging)return;const pt=svgPoint(e),dx=pt.x-compLast.x,dy=pt.y-compLast.y;compLast=pt;
 const c=getCompound();c.parts[compoundSelection].x=Math.round((c.parts[compoundSelection].x+dx)*10)/10;c.parts[compoundSelection].y=Math.round((c.parts[compoundSelection].y+dy)*10)/10;
 project.compounds[compoundKey]=c;renderCompound();saveSoon();}
function compUp(){if(compDragging){compDragging=false;recordChange('compound',compoundKey,compoundDragBefore,project.compounds[compoundKey]);compoundDragBefore=null;}}
function renderOverrideList(){const dest=$('overrideList');dest.textContent='';const entries=Object.values(project?.compounds||{});if(!entries.length){dest.textContent='No overrides yet.';return;}
 for(const c of entries){const b=document.createElement('button');b.className='override-item';b.textContent=c.name;b.onclick=()=>{$('compoundLeft').value=c.left;$('compoundRight').value=c.right;$('compoundOperator').value=c.operator;compoundSelection=0;renderCompound();};dest.appendChild(b);}}
async function init(){await initializeGeometry();const resp=await fetch('./file-maker/assets/glyph-catalogue.json');if(!resp.ok)throw Error('Missing expanded glyph catalogue');const data=await resp.json();slots=data.slots;
 ctx.lineCap='round';ctx.lineJoin='round';let last=null;try{last=localStorage.getItem('spfm-active-project');}catch(_){/* storage unavailable in opaque origins */}
 try{projects=await listProjects();if(last&&!projects.some(x=>x.id===last))last=null;if(!last&&projects.length)last=projects[0].id;if(last)await switchProject(last);else{project=newProject('My Sitelen Pona Font');await saveNow();await switchProject(project.id);}}
 catch(e){storageAvailable=false;status('Project storage unavailable: '+e.message,true);project=newProject('Unsaved font');await selectGlyph(slots.findIndex(s=>s.word==='jan'));}
 initEvents();editorPaletteManager=setupEditorPalettes({renderLayers:renderGlyphLayerPalette});initializeGridSettings();wireGlyphLayerActions();void initializeEditorGeometry();$('btnDeleteProject').disabled=!storageAvailable;$('btnUseOnSite').disabled=!storageAvailable;refreshHintingUI();refreshIdentity();refreshCompoundChoices();renderOverrideList();showPreviewState();status(storageAvailable?'Font Maker ready · autosaving to IndexedDB':'Font Maker ready · IndexedDB unavailable; export a project file to preserve changes');}
function initEvents(){
 document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>switchTab(b.dataset.tab));document.querySelectorAll('[data-tool]').forEach(b=>b.onclick=()=>chooseTool(b.dataset.tool));
 canvas.addEventListener('dblclick',insertBezierAtDoubleClick);
 canvas.addEventListener('pointerdown',pointerDown);canvas.addEventListener('pointermove',pointerMove);canvas.addEventListener('pointerup',pointerUp);canvas.addEventListener('pointercancel',pointerUp);canvas.addEventListener('pointerleave',()=>{if(!bezierInteraction){bezierHover=null;renderBezierOverlay();}});
 $('brushSize').oninput=()=>{$('brushSizeLabel').textContent=$('brushSize').value;resizeActiveSelectionWidth();persistProjectDrawingPreferences();};
 $('strokeSmoothing').oninput=()=>{$('strokeSmoothingLabel').textContent=$('strokeSmoothing').value+'%';persistProjectDrawingPreferences();};
 for(const id of ['autoShape','filledShape','drawShapesFromCentre','lineCapStyle','tipShape'])$(id).onchange=persistProjectDrawingPreferences;
 $('btnSmoothExisting').onclick=smoothExistingOutline;
 $('btnExpandEditor').onclick=()=>toggleExpandedEditor();
 $('btnCopyGlyph').onclick=copyWholeGlyph;
 $('btnPasteGlyph').onclick=()=>pasteSelection({offset:false});
 $('btnReplaceGlyph').onclick=()=>pasteSelection({replace:true,offset:false});
 $('btnUndo').onclick=undo;$('btnRedo').onclick=redo;
 $('btnSelectionAll').onclick=selectAllArtwork;$('btnSelectionCopy').onclick=copySelection;
 $('btnSelectionCut').onclick=cutSelection;$('btnSelectionPaste').onclick=pasteSelection;
 $('btnSelectionDuplicate').onclick=duplicateSelection;$('btnSelectionDelete').onclick=deleteSelectedArtwork;
 $('btnSelectionCrop').onclick=cropSelection;$('btnSelectionClear').onclick=cancelSelection;
 $('btnSelectionRotateLeft').onclick=()=>rotateSelected(-90);
 $('btnSelectionRotateRight').onclick=()=>rotateSelected(90);
 $('btnSelectionFlipH').onclick=()=>scaleSelected(-1,1);
 $('btnSelectionFlipV').onclick=()=>scaleSelected(1,-1);
 $('btnSelectionRotate').onclick=()=>rotateSelected(Math.max(-360,Math.min(360,Number($('selectionAngle').value)||0)));
 $('btnSelectionScale').onclick=()=>scaleSelected(Math.max(.1,Math.min(3,Number($('selectionScale').value)/100||1)));
 $('btnSaveAttachments').onclick=saveAttachmentGeometry;
 $('btnHideBezierHelp').onclick=()=>setEditorHelpHidden(true);
 $('btnHideSelectionHelp').onclick=()=>setEditorHelpHidden(true);
 $('btnShowEditorHelp').onclick=()=>{if(editorHelpMode())setEditorHelpHidden(false);};
 $('btnCloseBezier').onclick=()=>closeBezier(bezierDraft.length?'auto':'fill');$('btnCloseBezierHole').onclick=()=>closeBezier('hole');$('btnCancelBezier').onclick=cancelBezier;$('btnDeleteBezier').onclick=deleteSelectedBezier;$('bezierContourRole').onchange=ev=>setSelectedContourRole(ev.target.value);$('bezierContourPicker').onchange=ev=>{selectedBezierContour=ev.target.value===''?-1:Number(ev.target.value);selectedStroke=isStroke(project?.glyphs?.[glyphKey(slotIndex)]?.bezierContours?.[selectedBezierContour])?selectedBezierContour:-1;selectedBezierNode=-1;joinEndpoints=[];renderBezierOverlay();};$('btnBezierPreview').onclick=toggleBezierFillPreview;$('btnClearGlyph').onclick=()=>{if(!editableLayerOrWarn()||!confirm('Clear this glyph drawing?'))return;const k=glyphKey(slotIndex),before=cloned(project.glyphs[k]);clearCanvas();project.glyphs[k]={...(project.glyphs[k]||{}),bezierContours:[],rasterPath:''};saveDraft(project.editorDrafts,k,null);bezierDraft=[];commitGlyph();recordChange('glyph',k,before,project.glyphs[k]);renderBezierOverlay();};
 $('toggleGrid').onchange=()=>{showArtboardGrid();persistGridPrefs();};
 $('toggleOriginal').onchange=()=>renderOriginalGuide();$('originalOpacity').oninput=()=>{$('originalOpacityLabel').textContent=$('originalOpacity').value+'%';renderOriginalGuide();};$('toggleMetrics').onchange=drawMetricGuides;
 $('btnZoomIn').onclick=()=>setZoom(canvasZoom*1.2);$('btnZoomOut').onclick=()=>setZoom(canvasZoom/1.2);
 $('btnFitCanvas').onclick=fitCanvas;
 const view=$('canvasViewport');
 view.addEventListener('wheel',ev=>{ev.preventDefault();const step=Math.max(-120,Math.min(120,ev.deltaY));setZoom(canvasZoom*Math.exp(-step*.002),ev.clientX,ev.clientY);},{passive:false});
 view.addEventListener('pointerdown',ev=>{if(ev.target!==canvas&&wantsPan(ev))startPan(ev);});
 view.addEventListener('pointermove',movePan);
 view.addEventListener('pointerup',stopPan);
 view.addEventListener('pointercancel',stopPan);
 view.addEventListener('lostpointercapture',ev=>{if(panDrag?.pointerId===ev.pointerId){panDrag=null;view.classList.remove('is-panning');}});
 new ResizeObserver(trackCanvasSize).observe(view);
 requestAnimationFrame(trackCanvasSize);
 $('traceThreshold').oninput=()=>{$('thresholdLabel').textContent=$('traceThreshold').value;commitGlyph();};$('traceSimplify').oninput=()=>{$('simplifyLabel').textContent=$('traceSimplify').value;commitGlyph();};
 $('btnExportSvg').onclick=exportGlyph;$('glyphSearch').oninput=renderGlyphList;$('btnApplyMetadata').onclick=applyMetadata;
 for(const f of ['all','drawn','missing'])$('filter'+f[0].toUpperCase()+f.slice(1)).onclick=()=>setFilter(f);
 $('btnNewProject').onclick=startNew;$('btnDeleteProject').onclick=requestDeleteProject;$('projectSelect').onchange=async e=>{await switchProject(e.target.value);try{localStorage.setItem('spfm-active-project',project.id);}catch(_){/* browser storage policy */}};
 $('glyphCategory').onchange=e=>{glyphCategory=e.target.value;renderGlyphList();};
 $('btnExportProject').onclick=exportJson;$('btnExportProject2').onclick=exportJson;$('btnExportAssets').onclick=vectorZip;
 $('btnPreviewBuild').onclick=buildPreviewFonts;
 wireCompiledPreviewControls();
 wirePreviewAdjusters();
 $('hintRasterization').onchange=e=>setHintMode(e.target.value);
 $('btnRunFontQuality').onclick=()=>runProjectQualityCheck();
 wireTypographyControls();
 $('btnSaveIdentity').onclick=saveIdentity;$('btnExportRegistry').onclick=exportRegistry;$('btnBuildFonts').onclick=buildFonts;$('btnUseOnSite').onclick=publishFontOnSite;
 $('btnImportFontZip').onclick=requestSiteFontZipImport;
 $('btnImportProjectFontZip').onclick=requestEditableFontPairZipImport;
 $('fileImportProjectFontZip').onchange=event=>{const file=event.target.files?.[0];event.target.value='';if(file)void importEditableFontPairZip(file);};
 $('fileImportFontZip').onchange=event=>{const file=event.target.files?.[0];if(file)void importSiteFontZip(file);};
 $('btnImportProject').onclick=()=>$('fileImportProject').click();$('fileImportProject').onchange=async e=>{if(e.target.files[0])await importProjectFile(e.target.files[0]);e.target.value='';};
 $('btnStartFromFont').onclick=requestFontImport;$('fileImportFont').onchange=async e=>{const file=e.target.files?.[0];
    const acknowledged=fontImportAcknowledged,docs=pendingImportLicences,ack=importAcknowledgement;
    fontImportAcknowledged=false;pendingImportLicences=[];importAcknowledgement=null;e.target.value='';
    if(!file)return;
    if(!acknowledged||!ack||!docs.length){status('Select the original font licence file and acknowledge responsibility before importing.',true);return;}
    await importFontFile(file,docs,ack);};
 $('btnRestoreImported').onclick=()=>{if(editableLayerOrWarn())restoreSelectedFontGlyph();};
 $('btnShowTemplate').onclick=()=>{dialog('SP Font Maker original template',`<p>Reference template included under its original MIT licence.</p><img src="./file-maker/assets/sp-font-maker-template.png" alt="SP Font Maker 180-slot drawing sheet"><div class="modal-actions"><button class="btn" id="closeTemplate">Close</button></div>`);$('closeTemplate').onclick=closeModal;};
 $('modalClose').onclick=closeModal;$('modal').onclick=e=>{if(e.target===$('modal'))closeModal();};
 for(const id of ['compoundLeft','compoundRight','compoundOperator'])$(id).onchange=()=>{compoundSelection=0;renderCompound();};
 $('btnCreateCompound').onclick=setOverride;$('btnResetCompound').onclick=resetOverride;
 for(const [id,key] of [['compX','x'],['compY','y'],['compRotation','rotation']])$(id).onchange=()=>updateComponent(key,Number($(id).value)||0);
 $('compScale').oninput=()=>updateComponent('scale',Number($('compScale').value));
 $('btnResetComponent').onclick=()=>{const c=getCompound(),before=cloned(project.compounds[compoundKey]);const def=defaultCompound(c.left,c.operator,c.right);c.parts[compoundSelection]=def.parts[compoundSelection];project.compounds[compoundKey]=c;recordChange('compound',compoundKey,before,c);saveSoon();renderCompound();};
 $('compoundSvg').onpointerdown=compDown;$('compoundSvg').onpointermove=compMove;$('compoundSvg').onpointerup=compUp;$('compoundSvg').onpointercancel=compUp;
 document.addEventListener('keydown',e=>{
  if(!$('modal').hidden){if(e.key==='Escape'){e.preventDefault();closeModal();}return;}
  if(e.target.closest('input,textarea,select'))return;
  if(activeTab==='glyph'&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&e.key==='Escape'&&curvePending){e.preventDefault();cancelCurve();return;}
  if(activeTab==='glyph'&&e.key==='Escape'&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&expandedEditor&&tool!=='select'&&tool!=='bezier'){e.preventDefault();toggleExpandedEditor(false);return;}
  if(activeTab==='glyph'&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&!e.shiftKey){
   const tools={p:'pen',e:'eraser',l:'line',c:'ellipse',r:'rect',v:'select',h:'pan',b:'bezier'};
   if(tools[e.key.toLowerCase()]){e.preventDefault();chooseTool(tools[e.key.toLowerCase()]);return;}
  }
  if(activeTab==='glyph'&&(tool==='select'||tool==='lasso')){const key=e.key.toLowerCase();
   if((e.ctrlKey||e.metaKey)&&!e.altKey){
    if(key==='a'){e.preventDefault();selectAllArtwork();return;}
    if(key==='c'){e.preventDefault();copySelection();return;}
    if(key==='x'){e.preventDefault();cutSelection();return;}
    if(key==='v'){e.preventDefault();pasteSelection();return;}
    if(key==='d'){e.preventDefault();duplicateSelection();return;}
   }
   if(!e.ctrlKey&&!e.metaKey&&!e.altKey){
    if(e.key==='Escape'){e.preventDefault();if(nonemptySelection(selection))cancelSelection();else if(expandedEditor)toggleExpandedEditor(false);return;}
    if(['Delete','Backspace'].includes(e.key)){e.preventDefault();deleteSelectedArtwork();return;}
    const moves={ArrowUp:[0,-1],ArrowDown:[0,1],ArrowLeft:[-1,0],ArrowRight:[1,0]};
    if(moves[e.key]){e.preventDefault();nudgeSelection(moves[e.key][0]*(e.shiftKey?10:1),moves[e.key][1]*(e.shiftKey?10:1));return;}
   }
  }if(e.code==='Space'&&!e.ctrlKey&&!e.altKey&&!e.metaKey){e.preventDefault();spacePan=true;$('canvasViewport').classList.add('space-pan');return;}if(e.key.toLowerCase()==='f'&&!e.ctrlKey&&!e.metaKey&&!e.altKey){fitCanvas();return;}if(tool==='bezier'&&!e.ctrlKey&&!e.metaKey){if(e.key==='Enter'){e.preventDefault();closeBezier(e.shiftKey?'hole':'auto');}else if(e.key==='Escape'){e.preventDefault();if(bezierDraft.length)cancelBezier();else if(expandedEditor)toggleExpandedEditor(false);}else if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();deleteSelectedBezier();}}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();if(e.shiftKey)redo();else undo();}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='y'){e.preventDefault();redo();}});
 document.addEventListener('keyup',e=>{if(e.code==='Space'){spacePan=false;$('canvasViewport').classList.remove('space-pan');}});
 window.addEventListener('blur',()=>{spacePan=false;$('canvasViewport').classList.remove('space-pan');});
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'){clearTimeout(saveTimer);saveNow();}});
 window.addEventListener('pagehide',()=>{clearTimeout(saveTimer);saveNow();});
 // Persist active ID whenever switching via buttons and import flows.
 new MutationObserver(()=>{if(project)try{localStorage.setItem('spfm-active-project',project.id);}catch(_){/* browser storage policy */}}).observe($('projectSelect'),{attributes:true,attributeFilter:['value'],childList:true});
}
init().catch(e=>{status('Startup error: '+e.message,true);console.error(e)});
