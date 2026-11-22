/* MIT — native browser font validation for verified portable ZIP imports.
 * A correct SHA-256 proves archive integrity but not that font data can be
 * rendered. Do not persist a new editable project until BOTH sources load.
 */
export async function verifyPortableFontPairFaces(normal,literal,FontFaceCtor=globalThis.FontFace){
  if(typeof FontFaceCtor!=='function')throw Error('Font loading is unavailable in this browser.');
  for(const [role,bytes] of [['Ligatures',normal],['Literal',literal]]){
    if(!(bytes instanceof Uint8Array)||bytes.length<300)throw Error(`The ${role} font source is empty or invalid.`);
    // This FontFace is not registered in document.fonts: it is a temporary
    // validation object and does not affect any existing site font families.
    try{
      const source=bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);
      const face=new FontFaceCtor(`SPFM_Portable_Validate_${role}`,source);
      const loaded=await face.load();
      if(!loaded||loaded.status!=='loaded')throw Error('FontFace.load did not complete.');
    }catch(error){throw Error(`The ${role} font was rejected by the browser: ${String(error?.message||error)}`);}
  }
  return true;
}
