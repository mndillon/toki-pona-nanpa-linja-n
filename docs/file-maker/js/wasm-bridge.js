import {fontGlyphsForCompilation} from './glyph-layers.js?v=0.3.43.0';
import {inspectCompiledPair} from './font-quality.js?v=0.3.49';
/* Browser-only wasm-pack bridge. The font compiler has NO JavaScript fallback.
 * A local preview/tracing fallback remains so art can be edited before WASM
 * is built; the app never labels an SVG ZIP as a TTF. */
import {traceCanvas} from './tracer.js';
let core=null;let wasmError='Rust/WASM not built';
export async function initializeGeometry(){
  try{
    // Fetch an uncached build identity on EVERY page load. The version is
    // stamped by build-wasm.sh *after* successful wasm-pack compilation.
    // Version BOTH the JS glue and the .wasm binary: query-versioning the
    // module alone is insufficient because wasm-bindgen builds its own URL.
    const manifestResponse=await fetch('./file-maker/wasm/pkg/build-info.json',{cache:'no-store'});
    if(!manifestResponse.ok)throw Error('WASM build manifest missing; rerun ./bin/build-wasm.sh');
    const manifest=await manifestResponse.json();
    if(!/^[a-f0-9]{64}$/.test(manifest?.sha256||''))throw Error('Invalid WASM build identity');
    const version=manifest.sha256;
    const wasm=await import(`../wasm/pkg/sp_font_core.js?v=${version}`);
    await wasm.default(new URL(`../wasm/pkg/sp_font_core_bg.wasm?v=${version}`,import.meta.url));
    if(typeof wasm.compile_project!=='function')throw Error('WASM module has no compile_project()');
    core=wasm;wasmError='';return true;
  }catch(error){wasmError=String(error?.message||error);console.warn('Rust/WASM not loaded:',error);return false;}
}
export function wasmStatus(){return {available:!!core,error:wasmError};}
export function usingWasm(){return !!core;}
export function traceGlyph(canvas,threshold,tolerance){
  if(!core)return traceCanvas(canvas,threshold,tolerance);
  const rgba=canvas.getContext('2d',{willReadFrequently:true}).getImageData(0,0,canvas.width,canvas.height).data;
  const alpha=new Uint8Array(canvas.width*canvas.height);for(let i=0;i<alpha.length;i++)alpha[i]=rgba[i*4+3];
  const path=core.trace_alpha(alpha,canvas.width,canvas.height,threshold);
  return {path,viewBox:`0 0 ${canvas.width} ${canvas.height}`,contours:0,points:0};
}
export function cellWidth(width,count,pitch,stroke,padding){return core?core.cell_width(width,count,pitch,stroke,padding):Math.max(width,count?((count-1)*pitch+stroke+2*padding):0);}
export function spacerWidth(base,num,den){return core?core.spacer_width(base,num,den):base*num/den;}
function fromBase64(s){const binary=atob(s),out=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)out[i]=binary.charCodeAt(i);return out;}
export async function compileBoth(project,catalogue){
  if(!core)throw Error('Rust/WASM font compiler unavailable. Run ./bin/build-wasm.sh and reload the page.');
  const sf=project.sourceFont;
  // The original imported font is never reinterpreted during preview/export.
  // CFF was normalized once at import and stored as a TrueType source.
  if(sf?.data && !sf.normalizedTtf && new DataView(fromBase64(sf.data).buffer).getUint32(0)===0x4f54544f)
    throw Error('This older OTF project has no normalized TTF. Create a new project and reimport the font.');
  const source=sf?.normalizedTtf?fromBase64(sf.normalizedTtf):sf?.data?fromBase64(sf.data):new Uint8Array(0);
  // Rust's Project request has no sourceFont or licensing fields. Large binary
  // base64 records (especially a preserved Literal partner) are supplied as
  // native byte arguments instead of being copied twice through JSON/WASM.
  const request=JSON.stringify({project:{...project,sourceFont:undefined,licensing:undefined,glyphs:fontGlyphsForCompilation(project.glyphs||{})},catalogue});
  const normal=core.compile_project(request,source,'normal');
  // A verified exported pair can be reimported as a new editing source.
  // Retain its separate Literal font instead of silently rebuilding Literal
  // artwork from the Ligatures TTF alone. Ordinary imports are unchanged.
  const literalSource=sf?.pairedLiteralTtf?fromBase64(sf.pairedLiteralTtf):source;
  const literal=core.compile_project(request,literalSource,'literal');
  if(normal.length<300||literal.length<300)throw Error('Unexpectedly small font output');
  for(const [name,bytes] of [['normal',normal],['literal',literal]]) {
    const dv=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
    if(dv.getUint32(0)!==0x00010000)throw Error(`Compiler produced invalid ${name} SFNT magic`);
    // Browser OpenType Sanitizer rejects a zero-byte fpgm table even though
    // common SFNT parsers may accept it. Detect this before FontFace.load().
    const tableCount=dv.getUint16(4);
    if(bytes.byteLength<12+tableCount*16)throw Error(`Compiler produced truncated ${name} table directory`);
    for(let i=0;i<tableCount;i++){
      const at=12+i*16;
      if(dv.getUint32(at)===0x6670676d && dv.getUint32(at+12)===0)
        throw Error(`Compiler produced invalid ${name} TTF: empty fpgm hinting table`);
    }
  }
  const quality=inspectCompiledPair(normal,literal);
  if(!quality.valid)throw Error('Compiled TTF failed structural validation: '+quality.issues.filter(i=>i.severity==='error').slice(0,4).map(i=>`${i.font}: ${i.message}`).join('; '));
  return {normal,literal};
}
export function inspectImportedFont(bytes){if(!core)return 'Font imported for editing, but WASM has not been built.';return core.inspect_font(bytes);}

export function inspectAttachmentGeometry(bytes){
  if(!core||typeof core.inspect_attachment_geometry!=='function')
    throw Error('A rebuilt Rust/WASM package is required to measure imported font attachments');
  return JSON.parse(core.inspect_attachment_geometry(bytes));
}
