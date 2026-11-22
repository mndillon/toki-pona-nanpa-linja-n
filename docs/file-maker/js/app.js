import {ARTBOARD_WIDTH,ARTBOARD_HEIGHT,fitScale,clampOffset,zoomAt,artboardPoint} from './canvas-view.js';
import {computeEditorShift,fontToPixel} from './font-coordinates.js';
import {referenceSilhouettePixels} from './reference-silhouette.js';
import {loadFairfaxReferenceFont,referenceGlyphBounds} from './reference-fonts.js?v=0.3.41.1';
import {validTokiPonaCustomName} from './toki-pona-name.js';
import {svgFromTrace} from './tracer.js';
import {makeBezierAnchor,moveBezierAnchor,dragBezierTangent,dragBezierClosingTangent,bezierPath,bezierDraftPath,combineGlyphPaths,inferRasterPath} from './bezier.js';
import {applyDraftPoint,saveDraft,readDraft} from './bezier-history.js';
import {automaticBezierRole} from './bezier-auto-hole.js';
import {bezierRadiusOnCanvas,closingBezierAnchor,hitBezierNode} from './bezier-hit.js?v=0.3.41.close1';
import {selectionRect as makeSelectionRect,nonemptySelection,chosenContourIndices,translateContour,classifyContour,translatedRect,contourBounds,polygonBounds,pointInPolygon,contourWithinPolygon,movePolygon} from './glyph-selection.js';
import {shapeContours,curveContour,affineContour,affineRotate,affineScale,rectAfterTransform,smoothStroke,recogniseStroke} from './drawing-tools.js';
import {smoothRasterInk,smoothBezierOutline,rasterInkContours,selectionSmoothingWeights,blendSelectedRasterSmoothing,smoothSelectedBezierOutline} from './outline-smoothing.js';
import {drawBrushGeometry,brushSvgPath,rasterizeVectorsCrossedByEraser} from './vector-eraser.js';
import {defaultCurveBend,curveBendFromPointer,curveControlPoint} from './curve-guides.js';
import {historyGlyphIndex,historyWouldSwitchGlyph} from './history-navigation.js';
import {enclosedFillPixels,selectedFillPixels,fillWithAntialiasFringe,FILL_INK_ALPHA} from './fill-regions.js?v=0.3.41.aa1';
import {resizeSelectedInk,offsetSelectedContour} from './selection-width.js?v=0.3.41.3';
import {selectionHandlePoints,hitSelectionHandle,hitSelectionBody,resizeSelectionByHandle,transformSelectionPolygon,SELECTION_HANDLE_CURSORS} from './selection-handles.js?v=0.3.41.2';
import {importedGlyphContours} from './imported-outline.js';
import {initializeGeometry,traceGlyph,usingWasm,compileBoth,inspectImportedFont,inspectAttachmentGeometry} from './wasm-bridge.js?v=0.3.41.1';
import {listProjects,loadProject,saveWorkspace,loadProjectHistory,deleteProject} from './storage.js';
import {makeZip} from './zip.js';
import {useFontOnThisSite,getSiteFontForProject} from './site-font-publisher.js?v=0.3.41';
import {createPortableFontPairZip,readPortableFontPairZip} from './portable-font-pair.js?v=0.3.41';
import {readPortableFontProjectZip} from './portable-project-import.js?v=0.3.41';
import {verifyPortableFontPairFaces} from './portable-font-validity.js?v=0.3.41';
import {fontHasCodepoint,registerFont,rasterizeFontGlyph,rasterizeFontGlyphAligned} from './font-import.js';
import {compoundPreviewKind,compoundPreviewStatus} from './compound-preview.js';
import {normalizeImportedFont} from './otf-to-ttf.js';
import {mapImportedLigaturesToUcsur} from './ucsur-ligature-import.js';
import {IMPORT_ACK,defaultLicensing,fontNameMetadata,evaluateExport,licenceFiles,readLicenceDocument} from './licensing.js';

const $=id=>document.getElementById(id);
let storageAvailable=true;
let slots=[],projects=[],project=null,slotIndex=0,tool='pen',drawing=false,startPoint=null,activeTab='glyph',filtered='all';
let glyphCategory='all';
let history=[],redoStack=[],historyActionBusy=false,historyNavigationPending=false,saveTimer=0,traceTimer=0,canvasZoom=1,importedFamily=null,pendingSave=Promise.resolve();
let canvasFit=1,canvasScale=1,canvasOffset={x:0,y:0},fitMode=true,viewportReady=false,panDrag=null,spacePan=false;
let strokeBefore=null,strokeStartRaster=null,strokeBaseCanvas=null,strokePoints=[],strokeAnchor=null,strokeEnd=null,strokeConstrain=false,curvePending=null,compoundDragBefore=null;
let expandedEditor=false;
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
  const a=cloned(before),b=cloned(after);
  if(JSON.stringify(a)===JSON.stringify(b))return;
  if(target!=='selectedWidth'){selectedWidthSession=null;selectedWidthStart=brushWidth();}
  const change={target,key,before:a,after:b,...(details||{})};
  const size=JSON.stringify(change).length*2;
  if(size>MAX_HISTORY_BYTES){history=[];redoStack=[];status('The operation exceeded the undo-memory budget; it was saved as a new checkpoint.');saveSoon();return;}
  history.push(change);redoStack=[];
  let bytes=history.reduce((n,c)=>n+JSON.stringify(c).length*2,0);
  while(history.length>MAX_HISTORY_ACTIONS||bytes>MAX_HISTORY_BYTES){const old=history.shift();bytes-=JSON.stringify(old).length*2;}
  invalidateCompiledPreview();saveSoon();
  return change;
}
async function applyChange(change,direction){
  const data=cloned(change[direction]);
  if(change.target==='glyphWithLicences'){
    if(data.glyph==null)delete project.glyphs[change.key];else project.glyphs[change.key]=data.glyph;
    project.licensing||=defaultLicensing();project.licensing.documents=data.documents||[];
    await selectGlyph(Number(change.key));
  }else if(change.target==='glyph'){
    if(data==null)delete project.glyphs[change.key];else project.glyphs[change.key]=data;
    await selectGlyph(Number(change.key));
  }else if(change.target==='selectedWidth'){
    if(data==null)delete project.glyphs[change.key];else project.glyphs[change.key]=data;
    selectedWidthSession=null;
    await selectGlyph(Number(change.key));
    selection=cloned(change.selection);selectionPolygon=cloned(change.selectionPolygon);
    $('brushSize').value=direction==='before'?change.initialWidth:change.finalWidth;
    $('brushSizeLabel').textContent=$('brushSize').value;
    selectedWidthStart=brushWidth();
    setTool(change.selectionTool||'select');
    renderSelectionOverlay();refreshSelectionToolbar();
  }else if(change.target==='selectionFill'||change.target==='selectionSmooth'){
    if(data==null)delete project.glyphs[change.key];else project.glyphs[change.key]=data;
    await selectGlyph(Number(change.key));
    selection=cloned(change.selection);selectionPolygon=cloned(change.selectionPolygon);
    selectedWidthStart=brushWidth();setTool(change.selectionTool||'select');
    renderSelectionOverlay();refreshSelectionToolbar();
  }else if(change.target==='selectionTransform'){
    if(data==null)delete project.glyphs[change.key];else project.glyphs[change.key]=data;
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
  }else if(change.target==='glyphBatch'){
    for(const [key,value] of Object.entries(data)){
      if(value==null)delete project.glyphs[key];else project.glyphs[key]=value;
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
    if(data.glyph==null)delete project.glyphs[change.key];else project.glyphs[change.key]=data.glyph;
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
function newProject(name='Untitled font'){const id=uid();return {version:1,id,name,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),template:'sp-font-maker-v5',glyphs:{},compounds:{},editorDrafts:{},settings:{fontIdentity:defaultIdentity(name,id),tallyPitch:10,tallyStroke:3,tallyPadding:8,fractionalScales:[1,.75,2/3,.5,1/3,.25],previewAdjustments:{fractionalVerticalAlignment:100,glyphPadding:0,cartoucheTop:1000,cartoucheBottom:-210,cartoucheStroke:80,cartoucheLeftStroke:80,cartoucheRightStroke:80,cartoucheEndHeight:100,cartoucheEndY:0,cartoucheLeftX:0,cartoucheRightX:0,cartoucheEdgePadding:0,cartoucheContentOffset:0,longPiStartHeight:100,longPiStartY:0,longPiStartX:0,ordinaryPiStroke:80,longPiStroke:80,longPiRounded:false,tallyLength:250,tallyY:0,tallySpacing:160,verticalPaddingTop:0,verticalPaddingBottom:0}},sourceFont:null,licensing:defaultLicensing()};}
function identity(){if(!project.settings)project.settings={};if(!project.settings.fontIdentity)project.settings.fontIdentity=defaultIdentity(project.name,project.id);return project.settings.fontIdentity;}
function refreshIdentity(){if(!project)return;const i=identity();for(const [key,id] of [['family','fontFamily'],['style','fontStyle'],['version','fontVersion'],['postScriptName','fontPostScript'],['projectId','fontProjectId']])$(id).value=i[key]||'';}
function saveIdentity(){if(!project)return false;
  const family=$('fontFamily').value.trim(),style=$('fontStyle').value.trim(),version=$('fontVersion').value.trim(),postScriptName=$('fontPostScript').value.trim(),projectId=$('fontProjectId').value.trim();
  if(!family||family.length>90||!style||!/^[a-zA-Z0-9.-]{1,32}$/.test(version)||!/^[a-zA-Z0-9_-]{1,55}$/.test(postScriptName)||!projectId||projectId.length>128){status('Font identity invalid: supply a family, style, version, PostScript name and project ID.',true);return false;}
  const before=cloned(project.settings.fontIdentity);project.settings.fontIdentity={family,style,version,postScriptName,projectId};recordChange('identity','fontIdentity',before,project.settings.fontIdentity);saveSoon();status('Font identity saved in project');return true;
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
async function buildFonts(){
 if(fontActionBusy)return;
 if(!usingWasm()){status('Font export is unavailable. Please reload the page or contact the maintainer.',true);return;}
 if(!saveIdentity())return;
 // Imported font attachment metrics are editor references, not compiler prerequisites.
 setFontActionBusy(true);status('Preparing font export…');
 try{
  clearTimeout(saveTimer);await saveNow();
  const snapshot=structuredClone(project);
  const result=await compileBoth(snapshot,slots);
  const review=evaluateExport(snapshot);
  const filename=safename(snapshot.settings.fontIdentity.postScriptName);
  const otherFiles=[['custom-names.json',JSON.stringify(customManifest(snapshot),null,2)],...licenceFiles(snapshot,review,{includeFairfax:true})];
  const portable=await createPortableFontPairZip({project:snapshot,normal:result.normal,literal:result.literal,filename,otherFiles});
  if(project?.id!==snapshot.id)throw new Error('Project changed during font export. Try again.');
  download(portable.blob,`${filename}-font-pair.zip`);status('Portable font ZIP ready, including manifest.json and SHA-256 checksums.');
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
  const result=await compileBoth(snapshot,slots);
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
  const k=glyphKey(slotIndex),g=ensureEditorShift({...(project.glyphs[k]||{})});
  g.raster=canvas.toDataURL('image/png');
  const t=traceGlyph(canvas,Number($('traceThreshold').value),Number($('traceSimplify').value));
  g.rasterPath=t.path;g.path=combineGlyphPaths(g.rasterPath,g.bezierContours||[]);
  g.contours=t.contours;g.modified=true;project.glyphs[k]=g;
  saveSoon();updateProgress();updateTrace();
}
function scheduleTrace(){clearTimeout(traceTimer);traceTimer=setTimeout(commitGlyph,140);}
function saveSoon(){if(!project||deletingProject)return;invalidateCompiledPreview();saveStatus('Unsaved changes…');clearTimeout(saveTimer);saveTimer=setTimeout(saveNow,420);}
async function saveNow(){if(!project||deletingProject)return;const snapshot=structuredClone(project);snapshot.updatedAt=new Date().toISOString();project.updatedAt=snapshot.updatedAt;
  const undo=structuredClone(history),redo=structuredClone(redoStack);
  pendingSave=pendingSave.then(()=>saveWorkspace(snapshot,{undo,redo}));try{await pendingSave;saveStatus(`Autosaved ${new Date(snapshot.updatedAt).toLocaleTimeString()}`);}catch(e){saveStatus('Autosave failed');status('IndexedDB save failed: '+e.message,true);}
}
function clearCanvas(){ctx.clearRect(0,0,ARTBOARD_WIDTH,ARTBOARD_HEIGHT);}
function drawImageUrl(url){return new Promise(resolve=>{if(!url){clearCanvas();resolve();return;}const img=new Image();img.onload=()=>{clearCanvas();ctx.drawImage(img,0,0);resolve();};img.onerror=()=>{clearCanvas();resolve();};img.src=url;});}

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
async function selectGlyph(i){if(!project||!slots[i])return;selectedWidthSession=null;marquee=null;selection=null;marqueePolygon=null;selectionPolygon=null;selectionDrag=null;renderSelectionOverlay();const changedGlyph=slotIndex!==i;bezierInteraction=null;bezierHover=null;selectedBezierContour=-1;selectedBezierNode=-1;clearTimeout(traceTimer);if(drawing){restoreStrokeBase();clearDrawingGesture();}if(curvePending)cancelCurve();slotIndex=i;project.editorDrafts||={};bezierDraft=readDraft(project.editorDrafts,glyphKey(i));
  const meta=slotMeta(i),base=slots[i];$('glyphTitle').textContent=base.kind==='ascii'?`ASCII ${JSON.stringify(base.display)}`:glyphLibraryName(base,i,meta);
  $('glyphDescription').textContent=`Entry ${i+1}/${slots.length} · ${meta.kind||base.kind||'glyph'} · ${base.rotate?'directional variant source':''}`;
  $('glyphCp').textContent=capCp(base.codepoint);$('glyphWord').value=meta.word||base.word;
  $('glyphWord').readOnly=base.kind==='ascii'||!base.customSlot;
  $('glyphWord').title=base.customSlot?'Custom name: 2–32 lowercase Toki Pona letters forming (C)V(N) syllables':'Standard assignments are fixed in this catalogue';
  $('glyphCodepoint').value=meta.codepoint==null?'':Number(meta.codepoint).toString(16).toUpperCase();$('glyphAliases').value=(meta.aliases||[]).join('\n');
  const displayed=project.glyphs[i];await drawImageUrl((displayed?.modified||displayed?.rasterCopyForEditing)?(displayed?.raster||''):'');await renderOriginalGuide();drawMetricGuides();refreshAttachmentUI();renderBezierOverlay();updateTrace();updateProgress();
  if(changedGlyph||!viewportReady)fitCanvas();
  $('importState').textContent=project.sourceFont?`${project.sourceFont.name}. Select “Restore selected glyph from font” to rasterize it into an editable drawing.`:'No imported source font; blank projects need glyph drawings or a separately imported Latin font for full ASCII coverage.';
}
function canvasPos(ev){const r=canvas.getBoundingClientRect();return{x:Math.max(0,Math.min(ARTBOARD_WIDTH-1,(ev.clientX-r.left)/r.width*ARTBOARD_WIDTH)),y:Math.max(0,Math.min(ARTBOARD_HEIGHT-1,(ev.clientY-r.top)/r.height*ARTBOARD_HEIGHT))};}
function brushWidth(){return Math.max(1,Number($('brushSize').value)||9);}
function setBrush(){ctx.lineCap='round';ctx.lineJoin='round';ctx.lineWidth=brushWidth();ctx.strokeStyle='#111119';ctx.fillStyle='#111119';ctx.globalCompositeOperation=tool==='eraser'?'destination-out':'source-over';}
function restoreStrokeBase(){clearCanvas();if(strokeBaseCanvas)ctx.drawImage(strokeBaseCanvas,0,0);}
function strokePath(points){
 if(!points.length)return;setBrush();drawBrushGeometry(ctx,points);
 ctx.stroke();ctx.globalCompositeOperation='source-over';
}
function showStrokePreview(p){
 restoreStrokeBase();
 if(tool==='pen'||tool==='eraser'){
  const points=smoothStroke(strokePoints,Number($('strokeSmoothing').value));strokePath(points);
  if(tool==='eraser')renderBezierOverlay(); // live eraser preview masks the vector overlay too
 }else if(tool==='curve'){
  ctx.lineWidth=brushWidth();ctx.strokeStyle='#111119';ctx.lineCap='round';ctx.beginPath();ctx.moveTo(strokeAnchor.x,strokeAnchor.y);
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
  strokePath([strokeAnchor,p]);
 }else if(tool==='ellipse'||tool==='rect'){
  const paths=shapeContours(tool,strokeAnchor,p,brushWidth(),{filled:$('filledShape').checked,constrain:strokeConstrain});
  const path=bezierPath(paths);if(path){const drawing=new Path2D(path);ctx.fillStyle='#111119';ctx.fill(drawing,'nonzero');}
 }
}
function finishVectorShape(contours,before){
 restoreStrokeBase();
 if(!contours.length){status('Drag to define a shape before releasing.');return;}
 const key=glyphKey(slotIndex),g=bezierEntry();g.bezierContours.push(...contours);
 commitBezier(before);status('Editable vector shape added. Select it to move, rotate, copy or resize.');
}
function clearDrawingGesture(){drawing=false;strokeBefore=null;strokeStartRaster=null;strokeBaseCanvas=null;strokePoints=[];strokeAnchor=null;strokeEnd=null;}
function cancelCurve(){if(curvePending){restoreStrokeBase();curvePending=null;strokeBaseCanvas=null;strokeBefore=null;status('Curve cancelled.');}}
function pointerDown(ev){
 if(!project)return;if(wantsPan(ev)){startPan(ev);return;}if(ev.button!==0)return;
 if(tool==='select'||tool==='lasso'){selectionPointerDown(ev);return;}if(tool==='bezier'){bezierPointerDown(ev);return;}
 if(tool==='fill'){ev.preventDefault();fillRasterRegion(canvasPos(ev));return;}
 ev.preventDefault();canvas.setPointerCapture(ev.pointerId);
 const p=canvasPos(ev);
 if(tool==='curve'&&curvePending){
  // The first drag establishes the endpoints; the second edits the visible bend.
  strokeAnchor={...curvePending.start};strokeEnd={...curvePending.end};
 }else{
  strokeBefore=cloned(project.glyphs[glyphKey(slotIndex)]);
  strokeBaseCanvas=newRasterCanvas(ARTBOARD_WIDTH,ARTBOARD_HEIGHT);
  strokeBaseCanvas.getContext('2d').drawImage(canvas,0,0);
  strokeAnchor=p;strokeEnd=p;
 }
 drawing=true;strokePoints=[p];strokeConstrain=ev.shiftKey;
 showStrokePreview(p);
}
function pointerMove(ev){
 if(panDrag)return;if(tool==='select'||tool==='lasso'){selectionPointerMove(ev);return;}if(tool==='bezier'){bezierPointerMove(ev);return;}
 if(!drawing){
  if(tool==='curve'&&curvePending){ev.preventDefault();showStrokePreview(curveBendFromPointer(curvePending,canvasPos(ev)));}
  return;
 }ev.preventDefault();const p=canvasPos(ev);
 strokeConstrain=ev.shiftKey;
 if(tool==='pen'||tool==='eraser'){
  if(Math.hypot(p.x-strokePoints.at(-1).x,p.y-strokePoints.at(-1).y)>=.3)strokePoints.push(p);
 }else strokeEnd=p;
 showStrokePreview(p);
}
function pointerUp(ev){
 if(panDrag)return;if(tool==='select'||tool==='lasso'){selectionPointerUp(ev);return;}if(tool==='bezier'){bezierPointerUp(ev);return;}
 if(!drawing)return;
 const p=canvasPos(ev),before=strokeBefore,key=glyphKey(slotIndex);
 drawing=false;clearTimeout(traceTimer);
 if(tool==='curve'){
  if(!curvePending){
   if(Math.hypot(p.x-strokeAnchor.x,p.y-strokeAnchor.y)<2){restoreStrokeBase();clearDrawingGesture();status('Drag to choose the curve endpoints.');}
   else{curvePending={start:{...strokeAnchor},end:{...p},bend:defaultCurveBend(strokeAnchor,p)};showStrokePreview(null);status('A curved preview is ready. Click the purple bend point to accept it, or drag/click elsewhere to reshape it. Escape cancels.');}
  }else{
   const through=curveBendFromPointer(curvePending,p);
   const g=curveContour(curvePending.start,curvePending.end,through,brushWidth());
   finishVectorShape([g],before);curvePending=null;clearDrawingGesture();
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
    oldContours,points,brushWidth(),ARTBOARD_WIDTH,ARTBOARD_HEIGHT,newRasterCanvas):{indices:[],layer:null};
   restoreStrokeBase();
   if(converted.layer){
    ctx.drawImage(converted.layer,0,0);
    const removed=new Set(converted.indices),g=bezierEntry();
    g.bezierContours=g.bezierContours.filter((_,i)=>!removed.has(i));
    selectedBezierContour=-1;selectedBezierNode=-1;
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
    if(converted.indices.length)status(`Erased editable vector ink; ${converted.indices.length} touched outline${converted.indices.length===1?'':'s'} converted to pixels. Undo restores the original curves. Grey reference guides remain unchanged.`);
   }else if(tool==='eraser'){
    status('No editable ink under the eraser. The grey source font is only a reference guide; switch off Original to hide it.');
   }
  }
  clearDrawingGesture();renderBezierOverlay();
 }else{
  const contours=shapeContours(tool,strokeAnchor,p,brushWidth(),{filled:$('filledShape').checked,constrain:strokeConstrain});
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
// Fill is an action for an active Select/Lasso selection; the tool and zoom stay unchanged.
function chooseTool(next){
 if(next==='fill'&&nonemptySelection(selection)&&['select','lasso'].includes(tool)){fillSelectedRegion();return;}
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
}
function newRasterCanvas(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;return c;}
function selectedArtwork(){
 if(!nonemptySelection(selection))return null;
 const r=selection,bitmap=newRasterCanvas(r.width,r.height);
 bitmap.getContext('2d').drawImage(canvas,r.x,r.y,r.width,r.height,0,0,r.width,r.height);
 const contours=project?.glyphs?.[slotIndex]?.bezierContours||[];
 const chosen=selectionPolygon?contours.map((c,i)=>contourWithinPolygon(c,selectionPolygon)?i:-1).filter(i=>i>=0):chosenContourIndices(contours,r);
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
     selectMode?contours.map((_,i)=>i):contours.map((_,i)=>i);
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
 selectedWidthSession=null;selection=null;selectionPolygon=null;marquee=makeSelectionRect(p,p,ARTBOARD_WIDTH,ARTBOARD_HEIGHT);
 marqueePolygon=tool==='lasso'?[p]:null;
 selectionDrag={pointerId:ev.pointerId,start:p,mode:tool==='lasso'?'lasso':'marquee'};
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
  if(selection)selectedWidthStart=brushWidth();
  marquee=null;marqueePolygon=null;selectionDrag=null;
  renderSelectionOverlay();refreshSelectionToolbar();
  if(selection)status('Selected. Press Fill to paint this area, drag inside to move, or drag a handle to resize.');
 }else finishSelectionDrag();
 if(canvas.hasPointerCapture(ev.pointerId))canvas.releasePointerCapture(ev.pointerId);
}
function cancelSelection(){selectedWidthSession=null;marquee=null;selection=null;marqueePolygon=null;selectionPolygon=null;selectionDrag=null;canvas.style.cursor='';renderSelectionOverlay();refreshSelectionToolbar();}
function selectAllArtwork(){
 if(!project)return;selectedWidthSession=null;selection=editableInkBounds();marquee=null;selectionPolygon=null;marqueePolygon=null;
 if(!selection){status('There is no editable artwork to select. Use Copy glyph to copy the original imported vector.',true);return;}
 selectedWidthStart=brushWidth();setTool('select');renderSelectionOverlay();refreshSelectionToolbar();
 status('Whole glyph drawing selected (original grey guide excluded).');
}
function deleteSelectedArtwork(){
 if(partialVectorInSelection()){status('A Bézier contour crosses the selection boundary. Select the complete contour before deleting; partial erasing is supported on pencil ink.',true);return;}
 const art=selectedArtwork();if(!art)return;
 if(!art.hasPixels&&!art.contours.length){status('Selection contains no editable artwork.',true);return;}
 const key=glyphKey(slotIndex),before=cloned(project.glyphs[key]);
 eraseSelectedRaster(art.rect,selectionPolygon);
 const g=project.glyphs[key];if(g?.bezierContours?.length){
  const chosen=new Set(art.indices);g.bezierContours=g.bezierContours.filter((_,i)=>!chosen.has(i));
 }
 commitGlyph();recordChange('glyph',key,before,project.glyphs[key]);
 renderBezierOverlay();renderSelectionOverlay();status('Deleted selected drawing. Undo restores it.');
}
function cutSelection(){if(!copySelection())return;deleteSelectedArtwork();status('Cut selection to the editor clipboard.');}
function cropSelection(){
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
 return !!(selection&&(project?.glyphs?.[slotIndex]?.bezierContours||[]).some(c=>{
  const t=classifyContour(c,selection);return t!=='outside'&& (t==='partial'||selectionPolygon&&!contourWithinPolygon(c,selectionPolygon));
 }));
}
function eraseSelectedRaster(rect,polygon){
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
 selection=translatedRect(clip.rect,dx,dy);selectedWidthStart=brushWidth();selectionPolygon=movePolygon(clip.polygon,dx,dy);renderBezierOverlay();renderSelectionOverlay();refreshSelectionToolbar();
 status(`${replace?'Replaced':'Pasted'} glyph vector/paint artwork. Undo restores the previous design.`);
}
function duplicateSelection(){if(copySelection())pasteSelection();}
function nudgeSelection(dx,dy){
 if(!nonemptySelection(selection)||!selectedGestureStart(null))return;
 redrawSelectionDrag(dx,dy);finishSelectionDrag();refreshSelectionToolbar();
}
function transformSelection(m){
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
 const key=glyphKey(slotIndex),g=bezierEntry();
 g.path=combineGlyphPaths(g.rasterPath,g.bezierContours);g.modified=true;
 project.glyphs[key]=g;recordChange('glyph',key,before,g);
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
 $('btnCloseBezier').textContent=count?'Close outline (automatic)':'Make selected outline filled';
 $('btnCloseBezierHole').textContent=count?'Close hole (Shift+Enter)':'Make selected outline a hole';
 $('btnCloseBezier').disabled=bezierPreview||(count<3 && (!selectedContour||selectedContour.role!=='hole'));
 $('btnCloseBezierHole').disabled=bezierPreview||(count<3 && (!selectedContour||selectedContour.role==='hole'));
 $('btnCancelBezier').disabled=!count||bezierPreview;
 $('btnDeleteBezier').disabled=count>0||selectedBezierContour<0||bezierPreview;
 const contours=project?.glyphs?.[slotIndex]?.bezierContours||[];
 const picker=$('bezierContourPicker');
 const descriptions=contours.map((c,i)=>`Outline ${i+1} (${c.role==='hole'?'Hole':'Filled'})`);
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
function renderBezierOverlay(){
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
  const d=brushSvgPath(points);
  addSvgEl('path',{d,fill:'none',stroke:'black','stroke-width':brushWidth(),'stroke-linecap':'round','stroke-linejoin':'round'},mask);
 }
 if(contours.length)addSvgEl('path',{d:bezierPath(contours),class:'vector-fill','fill-rule':'nonzero',...(maskId?{mask:`url(#${maskId})`}:{})},root);
 renderBezierHelp();
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
 if(ev.button!==0||bezierPreview)return;
 ev.preventDefault();const p=canvasPos(ev);
 bezierHover=null;
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
   const node=makeBezierAnchor(p.x,p.y);bezierDraft.push(node);
   bezierInteraction={kind:'new',node,start:p,index:bezierDraft.length-1,key:glyphKey(slotIndex)};
   renderBezierOverlay();return;
 }
 canvas.setPointerCapture(ev.pointerId);
 const hit=bezierHit(p,ev.pointerType);
 if(hit){
   const before=cloned(project.glyphs[glyphKey(slotIndex)]);
   selectedBezierContour=hit.ci;selectedBezierNode=hit.ni;
   bezierInteraction={kind:'edit',hit,before,start:p,mirror:!ev.altKey};
 }else{
   selectedBezierContour=-1;selectedBezierNode=-1;
   const node=makeBezierAnchor(p.x,p.y);bezierDraft=[node];
   project.editorDrafts||={};project.editorDrafts[glyphKey(slotIndex)]=bezierDraft;
   bezierInteraction={kind:'new',node,start:p,index:0,key:glyphKey(slotIndex)};
 }
 renderBezierOverlay();
}
function bezierPointerMove(ev){
 if(!bezierInteraction){
   if(bezierDraft.length){bezierHover=canvasPos(ev);renderBezierOverlay();}
   return;
 }
 ev.preventDefault();const p=canvasPos(ev),act=bezierInteraction;
 if(act.kind==='new'){
   if(bezierDist(p,act.start)>1)dragBezierTangent(act.node,p.x,p.y,'out',true);
 }else if(act.kind==='close'){
   const delta={x:p.x-act.start.x,y:p.y-act.start.y};
   if(act.dragged||bezierDist(p,act.start)>=bezierPointerRadius(4)){
     act.dragged=true;
     dragBezierClosingTangent(bezierDraft,act.closingIndex,delta.x,delta.y);
   }
 }else{
   const node=project.glyphs[glyphKey(slotIndex)].bezierContours[act.hit.ci].points[act.hit.ni];
   if(act.hit.part==='anchor')moveBezierAnchor(node,p.x,p.y);
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
 if(act.kind==='edit')commitBezier(act.before);
 else{
   // Each completed pointer gesture adds ONE independent, reversible anchor.
   // Capture its final handles after dragging; older anchors are not duplicated.
   recordChange('bezierPoint',`${act.key}:${act.index}`,null,cloned(act.node));
   status(`${bezierDraft.length} Bézier anchor${bezierDraft.length===1?'':'s'} placed. Undo removes one point.`);
 }
 renderBezierOverlay();
}
function closeBezier(role='auto',undoDraft=null){
 if(bezierPreview)return;
 if(!bezierDraft.length&&selectedBezierContour>=0){
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
  d.editorDrafts||={};d.id=uid();d.name=`${d.name} (imported)`;d.createdAt=new Date().toISOString();clearTimeout(saveTimer);await saveNow();project=d;history=[];redoStack=[];await saveNow();await switchProject(d.id);status('Editable project imported successfully');}catch(e){status('Project import failed: '+e.message,true)}}
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
function switchTab(id){activeTab=id;document.querySelectorAll('.tab').forEach(b=>{const active=b.dataset.tab===id;b.classList.toggle('active',active);b.setAttribute('aria-selected',String(active));});document.querySelectorAll('.pane').forEach(e=>{const on=e.id===`pane-${id}`;e.classList.toggle('active',on);e.hidden=!on;});if(id==='glyph')requestAnimationFrame(trackCanvasSize);if(id==='compound'){refreshCompoundChoices();renderCompound();}if(id==='preview'){renderCompiledPreview();showPreviewState();}if(id==='build'){refreshIdentity();refreshHintingUI();refreshPreviewAdjusters();}}
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
 initEvents();$('btnDeleteProject').disabled=!storageAvailable;$('btnUseOnSite').disabled=!storageAvailable;refreshHintingUI();refreshIdentity();refreshCompoundChoices();renderOverrideList();showPreviewState();status(storageAvailable?'Font Maker ready · autosaving to IndexedDB':'Font Maker ready · IndexedDB unavailable; export a project file to preserve changes');}
function initEvents(){
 document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>switchTab(b.dataset.tab));document.querySelectorAll('[data-tool]').forEach(b=>b.onclick=()=>chooseTool(b.dataset.tool));
 canvas.addEventListener('pointerdown',pointerDown);canvas.addEventListener('pointermove',pointerMove);canvas.addEventListener('pointerup',pointerUp);canvas.addEventListener('pointercancel',pointerUp);canvas.addEventListener('pointerleave',()=>{if(!bezierInteraction){bezierHover=null;renderBezierOverlay();}});
 $('brushSize').oninput=()=>{$('brushSizeLabel').textContent=$('brushSize').value;resizeActiveSelectionWidth();};
 $('strokeSmoothing').oninput=()=>{$('strokeSmoothingLabel').textContent=$('strokeSmoothing').value+'%';};
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
 $('btnCloseBezier').onclick=()=>closeBezier(bezierDraft.length?'auto':'fill');$('btnCloseBezierHole').onclick=()=>closeBezier('hole');$('btnCancelBezier').onclick=cancelBezier;$('btnDeleteBezier').onclick=deleteSelectedBezier;$('bezierContourRole').onchange=ev=>setSelectedContourRole(ev.target.value);$('bezierContourPicker').onchange=ev=>{selectedBezierContour=ev.target.value===''?-1:Number(ev.target.value);selectedBezierNode=-1;renderBezierOverlay();};$('btnBezierPreview').onclick=toggleBezierFillPreview;$('btnClearGlyph').onclick=()=>{if(!confirm('Clear this glyph drawing?'))return;const k=glyphKey(slotIndex),before=cloned(project.glyphs[k]);clearCanvas();project.glyphs[k]={...(project.glyphs[k]||{}),bezierContours:[],rasterPath:''};saveDraft(project.editorDrafts,k,null);bezierDraft=[];commitGlyph();recordChange('glyph',k,before,project.glyphs[k]);renderBezierOverlay();};
 $('toggleGrid').onchange=()=>{$('canvasViewport').style.background=$('toggleGrid').checked?'repeating-linear-gradient(135deg,#f4eee4,#f4eee4 14px,#f7f3e9 14px,#f7f3e9 28px)':'#f7f3e9';};
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
 $('btnRestoreImported').onclick=restoreSelectedFontGlyph;
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
   if(tools[e.key.toLowerCase()]){e.preventDefault();setTool(tools[e.key.toLowerCase()]);return;}
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
