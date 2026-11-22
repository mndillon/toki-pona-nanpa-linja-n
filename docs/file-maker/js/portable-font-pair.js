/* MIT — portable, verifiable compiled font-pair ZIP format (v1).
 * All files are SHA-256 checked before either font is installed on the site.
 * Digests detect alteration/corruption; they are NOT a publisher signature.
 * Import is strictly local and never imports an editable Font Maker project.
 */
import {makeZip,readZipStore} from './zip.js';

export const FONT_PAIR_PACKAGE_TYPE='sitelen-pona-font-maker-font-pair';
export const FONT_PAIR_PACKAGE_VERSION=1;
const textEncoder=new TextEncoder();
const textDecoder=new TextDecoder('utf-8',{fatal:true});
const MAX_FONT_BYTES=48*1024*1024;
const MAX_MANIFEST_BYTES=256*1024;
const MAX_PACKAGE_FILES=128;

function requireText(v,what,max=256){
  if(typeof v!=='string'||!v.trim()||v.length>max||/[\x00-\x1f\x7f]/.test(v))throw new Error(`Invalid font package: ${what} is missing or invalid.`);
  return v.trim();
}
function safePath(path){
  return typeof path==='string'&&path.length>0&&path.length<=240&&
    !path.includes('\\')&&!path.startsWith('/')&&!/^[A-Za-z]:/.test(path)&&
    !path.split('/').some(part=>!part||part==='.'||part==='..')&&
    !/[\x00-\x1f\x7f]/.test(path);
}
function toBytes(data){return data instanceof Uint8Array?data:textEncoder.encode(String(data));}
function ttf(bytes,what){
  if(!(bytes instanceof Uint8Array)||bytes.byteLength<300||bytes.byteLength>MAX_FONT_BYTES||new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength).getUint32(0)!==0x00010000){
    throw new Error(`Invalid font package: ${what} is not a valid-sized TrueType font file.`);
  }
}
async function digestHex(bytes){
  if(!globalThis.crypto?.subtle?.digest)throw new Error('SHA-256 verification requires a secure browser context (HTTPS or localhost).');
  const hash=await globalThis.crypto.subtle.digest('SHA-256',bytes);
  return Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('');
}
function fileEntry(path,data){
  if(!safePath(path)||path==='manifest.json')throw new Error(`Invalid font package file name: ${path}.`);
  const bytes=toBytes(data);
  if(bytes.length>MAX_FONT_BYTES)throw new Error(`Font package file too large: ${path}.`);
  return {path,bytes};
}

/** Add the manifest to all files already included by ordinary font export. */
export async function createPortableFontPairZip({project,normal,literal,filename,otherFiles=[]}){
  if(!project||typeof project!=='object')throw new Error('A saved project is required for portable font export.');
  const id=requireText(project.id,'source project ID');
  const name=requireText(project.name||'Font Maker font','source project name');
  const identity=project.settings?.fontIdentity||{};
  const family=requireText(identity.family||name,'font family');
  const postScriptName=requireText(filename||identity.postScriptName||'FontMaker','font name',200);
  ttf(normal,'Ligatures');ttf(literal,'Literal');
  const ligaturesPath=`${postScriptName}-Ligatures.ttf`,literalPath=`${postScriptName}-Literal.ttf`;
  const entries=[fileEntry(ligaturesPath,normal),fileEntry(literalPath,literal),...otherFiles.map(([path,data])=>fileEntry(path,data))];
  if(entries.length>MAX_PACKAGE_FILES)throw new Error('Too many font package files.');
  const seen=new Set();
  for(const entry of entries){if(seen.has(entry.path))throw new Error(`Duplicate font package file: ${entry.path}.`);seen.add(entry.path);}
  const files=[];
  for(const entry of entries)files.push({path:entry.path,size:entry.bytes.length,sha256:await digestHex(entry.bytes)});
  const manifest={
    packageType:FONT_PAIR_PACKAGE_TYPE,
    schemaVersion:FONT_PAIR_PACKAGE_VERSION,
    createdAt:new Date().toISOString(),
    project:{id,name,family,style:String(identity.style||'Regular').slice(0,100),postScriptName},
    fonts:{ligatures:ligaturesPath,literal:literalPath},
    // The exported package already carries the original imported licence
    // documents (if any), Fairfax's OFL/notice, and its licence manifest.
    // Paths are cross-checked against the SHA-256-verified file inventory on
    // import; no separate licence picker is necessary for a verified ZIP.
    licensing:{
      schema:'spfm-portable-licensing-v1',
      bundled:true,
      manifestPath:'licence-manifest.json',
      originalLicenceFiles:entries.filter(e=>e.path.startsWith('LICENSES/Original-')).map(e=>e.path),
      fairfaxLicenceFiles:entries.filter(e=>e.path==='LICENSES/Fairfax-SIL-OFL-1.1.txt'||e.path==='LICENSES/Fairfax-Copyright-Notice.txt').map(e=>e.path),
      noticeFiles:entries.filter(e=>e.path==='FONT-INFORMATION.txt').map(e=>e.path),
      originalSourceName:project.sourceFont?.name||null,
    },
    renderer:{parserMode:'sitelen-pona-ascii-extended',renderAdapterId:'identity',
      cartoucheTallyMode:'ucsur',cartoucheVulgarFractions:true,literalCartoucheEncoding:'ascii-quoted'},
    files,
  };
  return {manifest,blob:makeZip([...entries.map(({path,bytes})=>[path,bytes]),['manifest.json',JSON.stringify(manifest,null,2)+'\n']])};
}

/** Parse and fully validate a Font Maker package before returning its fonts. */
export async function readPortableFontPairZip(file){
  if(!file||typeof file.arrayBuffer!=='function')throw new Error('Choose a Font Maker font-pair ZIP file.');
  if(file.size>96*1024*1024)throw new Error('The font-pair ZIP is larger than 96 MiB.');
  const entries=readZipStore(new Uint8Array(await file.arrayBuffer()));
  const manifestBytes=entries.get('manifest.json');
  if(!manifestBytes||manifestBytes.length>MAX_MANIFEST_BYTES)throw new Error('Invalid font package: manifest.json is missing or too large.');
  let manifest;
  try{manifest=JSON.parse(textDecoder.decode(manifestBytes));}catch{throw new Error('Invalid font package: manifest.json is not valid UTF-8 JSON.');}
  if(manifest?.packageType!==FONT_PAIR_PACKAGE_TYPE||manifest?.schemaVersion!==FONT_PAIR_PACKAGE_VERSION){
    throw new Error('Unsupported font-pair manifest type or version.');
  }
  if(!manifest.project||typeof manifest.project!=='object'||!manifest.fonts||typeof manifest.fonts!=='object'||!Array.isArray(manifest.files)){
    throw new Error('Invalid font package: required metadata is missing.');
  }
  const project={
    id:requireText(manifest.project.id,'project ID'),
    name:requireText(manifest.project.name,'project name'),
    settings:{fontIdentity:{
      family:requireText(manifest.project.family,'font family'),
      style:requireText(manifest.project.style,'font style',100),
      postScriptName:requireText(manifest.project.postScriptName,'PostScript name',200),
    }},
  };
  const ligaturesPath=requireText(manifest.fonts.ligatures,'Ligatures filename',240);
  const literalPath=requireText(manifest.fonts.literal,'Literal filename',240);
  if(!ligaturesPath.endsWith('-Ligatures.ttf')||!literalPath.endsWith('-Literal.ttf')||ligaturesPath===literalPath){
    throw new Error('Invalid font package: the Ligatures and Literal filenames are inconsistent.');
  }
  if(manifest.files.length===0||manifest.files.length>MAX_PACKAGE_FILES||entries.size!==manifest.files.length+1){
    throw new Error('Invalid font package: the manifest does not describe every file in the ZIP.');
  }
  const filesByPath=new Map();
  for(const item of manifest.files){
    if(!item||!safePath(item.path)||item.path==='manifest.json'||filesByPath.has(item.path)){
      throw new Error('Invalid font package: duplicate or unsafe manifest file path.');
    }
    if(!Number.isSafeInteger(item.size)||item.size<0||item.size>MAX_FONT_BYTES||!/^[a-f0-9]{64}$/.test(item.sha256)){
      throw new Error(`Invalid font package: bad digest or size for ${item.path}.`);
    }
    const payload=entries.get(item.path);
    if(!payload||payload.length!==item.size)throw new Error(`Invalid font package: missing or incorrectly sized ${item.path}.`);
    if(await digestHex(payload)!==item.sha256)throw new Error(`Font package integrity check failed (SHA-256): ${item.path}.`);
    filesByPath.set(item.path,payload);
  }
  const normal=filesByPath.get(ligaturesPath),literal=filesByPath.get(literalPath);
  if(!normal||!literal)throw new Error('Invalid font package: both compiled fonts must be included.');
  ttf(normal,'Ligatures');ttf(literal,'Literal');
  const parser=manifest.renderer;
  if(!parser||parser.parserMode!=='sitelen-pona-ascii-extended'||parser.renderAdapterId!=='identity'||
    parser.cartoucheTallyMode!=='ucsur'||parser.cartoucheVulgarFractions!==true||parser.literalCartoucheEncoding!=='ascii-quoted'){
    throw new Error('Unsupported font package: renderer settings do not match the Font Maker font-pair format.');
  }
  const packageInfo={
    manifestVersion:FONT_PAIR_PACKAGE_VERSION,
    licenceFiles:[...filesByPath.keys()].filter(p=>p.startsWith('LICENSES/')||p==='licence-manifest.json'||p==='FONT-INFORMATION.txt'),
    exportedAt:typeof manifest.createdAt==='string'?manifest.createdAt.slice(0,40):'',
  };
  // The map is already CRC32- and SHA-256-verified. Keep it available for
  // trusted local project import, without rereading and rehashing a large ZIP.
  return {project,normal,literal,manifest,packageInfo,verifiedFiles:filesByPath};
}
