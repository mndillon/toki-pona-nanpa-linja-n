/* MIT — offline licensing records. Import requires a supplied licence file and
 * acknowledgement; export is never blocked for perceived licence compatibility. */
import {FAIRFAX_OFL_TEXT,FAIRFAX_NOTICE} from './fairfax-licence.js';
export const IMPORT_ACK = 'I confirm that I am responsible for ensuring I have permission to import, modify and export this font, and for complying with any applicable font licence terms.';
export const MAX_DOC_BYTES = 5 * 1024 * 1024;
const encoder = new TextEncoder();
export function defaultLicensing() { return {basis:'unresolved',documents:[],sourceOflConfirmed:false}; }
export function ensureLicensing(project) {
  if (!project.licensing || typeof project.licensing !== 'object') project.licensing=defaultLicensing();
  if (!Array.isArray(project.licensing.documents)) project.licensing.documents=[];
  if (!['unresolved','user-acknowledged','owned','ofl-1.1'].includes(project.licensing.basis)) project.licensing.basis='unresolved';
  return project.licensing;
}
// Read only the SFNT name table. This does not verify copyright or licence authenticity.
export function fontNameMetadata(bytes) {
  const result={family:'',fullName:'',postScript:'',copyright:'',designer:'',licence:'',licenceURL:'',reservedNameNotes:''};
  try {
    const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
    const u16=o=>v.getUint16(o,false),u32=o=>v.getUint32(o,false);
    if (bytes.length<12 || ![0x00010000,0x4f54544f,0x74727565].includes(u32(0))) return result;
    let off=-1,len=0;
    for(let i=0;i<u16(4);i++){const p=12+i*16;if(p+16>bytes.length)break;
      if(u32(p)===0x6e616d65){off=u32(p+8);len=u32(p+12);break;}}
    if(off<0 || off+6>bytes.length || off+len>bytes.length) return result;
    const count=u16(off+2),strings=off+u16(off+4);
    const mapping={0:'copyright',1:'family',4:'fullName',6:'postScript',8:'designer',13:'licence',14:'licenceURL',16:'family'};
    const records=[];
    for(let i=0;i<Math.min(count,4096);i++){
      const p=off+6+i*12;if(p+12>bytes.length)break;
      const platform=u16(p),language=u16(p+4),id=u16(p+6),n=u16(p+8),start=strings+u16(p+10);
      if(!mapping[id] || start+n>off+len || start+n>bytes.length || n>12000)continue;
      let value='';
      if(platform===0||platform===3){if(n%2)continue;for(let k=0;k<n;k+=2)value+=String.fromCharCode(u16(start+k));}
      else if(platform===1){value=Array.from(bytes.subarray(start,start+n),b=>String.fromCharCode(b)).join('');}
      else continue;
      value=value.replace(/\0/g,'').trim();if(value)records.push({key:mapping[id],id,platform,language,value});
    }
    records.sort((a,b)=>(b.platform===3)-(a.platform===3)||(b.language===1033)-(a.language===1033)||(b.id===16)-(a.id===16));
    for(const r of records)if(!result[r.key])result[r.key]=r.value;
    result.reservedNameNotes=records.filter(x=>/reserved font names?/i.test(x.value)).map(x=>x.value).join('\n').slice(0,6000);
  }catch(_){/* malformed metadata is never treated as evidence of permission */}
  return result;
}
function normalizeName(s){return String(s||'').toLowerCase().normalize('NFKC').replace(/[^a-z0-9]/g,'');}
function fullOfl(doc){
  const s=String(doc?.content||'');
  return /SIL\s+OPEN\s+FONT\s+LICENSE/i.test(s) && /version\s+1\.1/i.test(s)
   && /PERMISSION\s*&\s*CONDITIONS/i.test(s) && /Reserved Font Name/i.test(s)
   && /Original or Modified Versions/i.test(s) && /Font Software/i.test(s)
   && /TERMINATION/i.test(s) && /DISCLAIMER/i.test(s);
}
export function parseOfl(documents){
  const d=documents.find(fullOfl);
  if(!d)return {ok:false,error:'Attach the complete original SIL Open Font License 1.1 text (usually OFL.txt); a URL or short statement is insufficient.'};
  const text=d.content;
  const header=text.split(/\bSIL\s+OPEN\s+FONT\s+LICENSE\b/i)[0].trim();
  const copyrights=header.split(/\r?\n/).map(x=>x.trim()).filter(x=>/^copyright\b/i.test(x));
  if(!copyrights.length)return {ok:false,error:'The supplied OFL text must include the original font copyright statement(s) before the licence heading.'};
  // OFL reserved names are normally declared after copyright statements.
  const candidates=header.split(/\r?\n/).filter(x=>/reserved\s+font\s+name/i.test(x));
  let rfns=[];
  for(const line of candidates){
    const m=line.match(/\bReserved\s+Font\s+Names?\b\s*(?::|are|is)?\s*(.*)$/i);
    if(!m||!m[1]?.trim())return {ok:false,error:'A Reserved Font Name declaration could not be parsed.'};
    let rest=m[1].replace(/[.;]+\s*$/,'').trim();
    if(/^(?:none|no\s+reserved\s+names?)$/i.test(rest))continue;
    const names=rest.split(/\s*(?:,|;|\band\b)\s*/i).map(s=>s.replace(/^[\s"'“”‘’]+|[\s"'“”‘’]+$/g,'').trim()).filter(Boolean);
    if(!names.length || names.some(n=>n.length>100||!/^[\p{L}\p{N} ._-]+$/u.test(n)))return {ok:false,error:'Reserved Font Names cannot be parsed reliably.'};
    rfns.push(...names);
  }
  return {ok:true,header,copyrights,reservedNames:[...new Set(rfns)],licenceText:text,licenceFile:d.name};
}
// This is informational only. The import-time acknowledgement assigns
// responsibility to the user; even contradictory or unknown licences must
// never block generated font export.
export function evaluateExport(project){
  const l=ensureLicensing(project);
  const original=project.sourceFont||null;
  const warnings=[];
  if(original && !l.documents.length && !original.portablePackage?.fairfaxOflIncluded)warnings.push('The imported source has no stored licence document (legacy project). Export is permitted; supply and retain the correct licence when importing fonts.');
  if(l.basis==='unresolved' && original)warnings.push('Licence compatibility has not been verified; the user remains responsible for all applicable conditions.');
  let ofl=null;
  if(l.basis==='ofl-1.1'){
    const parsed=parseOfl(l.documents);
    if(parsed.ok)ofl=parsed;
    else warnings.push('Could not confirm an OFL declaration from the attached documents. This is a nonblocking warning.');
  }
  return {ok:true,basis:l.basis,sourceCopyright:ofl?.header||'',
    copyrightNotice:[...(ofl?.copyrights||[]),original?.metadata?.copyright||''].filter(Boolean).join('\n'),
    licenceName:ofl?'SIL Open Font License, Version 1.1':'',
    licenceURL:ofl?'https://openfontlicense.org/ofl-1.1/':'',
    reservedNames:ofl?.reservedNames||[],warnings};
}
export function safeDocName(name){return String(name||'NOTICE.txt').split(/[\\/]/).pop().replace(/[^a-zA-Z0-9_.-]/g,'_').slice(0,90)||'NOTICE.txt';}
// Preserve licence documents byte-for-byte in IndexedDB and in export ZIPs.
// Older project records containing text-only {name,content} remain readable.
export function licenceFiles(project,review=evaluateExport(project),{includeFairfax=false}={}){
  const l=ensureLicensing(project),files=[],used=new Set();
  for(const doc of l.documents){
    let name=safeDocName(doc.name),n=2;
    while(used.has(name.toLowerCase()))name=`${n++}-${safeDocName(doc.name)}`;
    used.add(name.toLowerCase());
    files.push([`LICENSES/Original-${name}`,doc.data?base64ToBytes(doc.data):String(doc.content||'')]);
  }
  if(includeFairfax){
    files.push(['LICENSES/Fairfax-SIL-OFL-1.1.txt',FAIRFAX_OFL_TEXT]);
    files.push(['LICENSES/Fairfax-Copyright-Notice.txt',FAIRFAX_NOTICE]);
  }
  const information=[
    'GENERATED FONT INFORMATION',
    `Generated family: ${project.settings?.fontIdentity?.family||project.name||''}`,
    `Original source file: ${project.sourceFont?.name||'(new original project)'}`,
    `Original source family: ${project.sourceFont?.metadata?.family||'(none)'}`,
    `Declared rights basis: ${review.basis}`,
    `Applicable generated-font source licence: ${review.licenceName||'Refer to included source licences and notices'}`,
    '',
    `Original source copyright: ${project.sourceFont?.metadata?.copyright||'(not supplied)'}`,
    `Original source licence metadata: ${project.sourceFont?.metadata?.licence||'(not supplied)'}`,
    `Original source licence URL: ${project.sourceFont?.metadata?.licenceURL||'(not supplied)'}`,
    includeFairfax?'Fairfax-derived components: present; see LICENSES/Fairfax-SIL-OFL-1.1.txt and LICENSES/Fairfax-Copyright-Notice.txt.':'Fairfax-derived components: not asserted for this export.',
    'The user acknowledged responsibility for permission and compliance at source font import.',
    'The editor does not verify licence compatibility or certify redistribution rights.',
    ...(review.warnings?.length?['','Nonblocking licence notices:',...review.warnings]:[]),
  ].join('\n');
  files.push(['FONT-INFORMATION.txt',information+'\n']);
  files.push(['licence-manifest.json',JSON.stringify({schema:'spfm-licence-manifest-v2',rightsBasis:review.basis,
    sourceFile:project.sourceFont?.name||null,sourceFamily:project.sourceFont?.metadata?.family||null,
    exportFamily:project.settings?.fontIdentity?.family||project.name,
    importedLicenceFiles:l.documents.map(d=>({originalName:d.originalName||d.name,byteLength:d.data?base64ToBytes(d.data).length:encoder.encode(d.content||'').length})),
    fairfaxOflIncluded:includeFairfax,
    importAcknowledgement:project.sourceFont?.licenceAcknowledgement||l.importAcknowledgement||null,
    warnings:review.warnings||[]},null,2)]);
  return files;
}
function bytesToBase64(data){
  let s='';for(let i=0;i<data.length;i+=8192)s+=String.fromCharCode(...data.subarray(i,i+8192));
  return btoa(s);
}
export function base64ToBytes(s){
  const binary=atob(s),out=new Uint8Array(binary.length);
  for(let i=0;i<binary.length;i++)out[i]=binary.charCodeAt(i);
  return out;
}
export function validateLicenceDocument(name,contents,existing=[]){
  const clean=safeDocName(name),size=encoder.encode(contents).length;
  if(!/\.(?:txt|md|license|ofl|html|htm)$/i.test(clean)&&!/^(?:LICENSE|COPYING|OFL|NOTICE|COPYRIGHT)(?:[-._].*)?$/i.test(clean))throw Error('Licence documents must be TXT, MD, LICENSE, OFL, HTML, PDF or standard licence/notice filenames.');
  if(size<1||size>MAX_DOC_BYTES)throw Error(`Licence document size must be 1–${MAX_DOC_BYTES} bytes.`);
  if(existing.length>=12)throw Error('At most 12 original licence/notice documents may be attached.');
  if(existing.some(d=>d.name.toLowerCase()===clean.toLowerCase()))throw Error('A licence document with that name is already attached.');
  return {name:clean,content:contents,data:bytesToBase64(encoder.encode(contents)),byteLength:size};
}
export async function readLicenceDocument(file,existing=[]){
  if(!file?.name || typeof file.arrayBuffer!=='function')throw Error('Choose a licence file.');
  const name=safeDocName(file.name);
  if(!/\.(?:txt|md|license|ofl|html|htm|pdf)$/i.test(name)&&!/^(?:LICENSE|COPYING|OFL|NOTICE|COPYRIGHT)(?:[-._].*)?$/i.test(name))
    throw Error('Supported licence files: TXT, MD, LICENSE, OFL, HTML and PDF.');
  if(existing.length>=12)throw Error('At most 12 licence/notice files may be imported.');
  if(existing.some(d=>d.name.toLowerCase()===name.toLowerCase()))throw Error('Duplicate licence filename.');
  if(file.size!=null && (file.size<1||file.size>MAX_DOC_BYTES))throw Error('Licence file is empty or exceeds 5 MiB.');
  const bytes=new Uint8Array(await file.arrayBuffer());
  if(bytes.length<1||bytes.length>MAX_DOC_BYTES)throw Error('Licence file is empty or exceeds 5 MiB.');
  const text=!/\.pdf$/i.test(name)?new TextDecoder().decode(bytes):'';
  return {name,originalName:file.name,data:bytesToBase64(bytes),byteLength:bytes.length,content:text};
}
