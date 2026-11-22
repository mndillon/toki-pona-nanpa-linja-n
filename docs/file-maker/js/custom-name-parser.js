import { validTokiPonaCustomName } from './toki-pona-name.js';
/* MIT — registry-driven source-text rewrite for a selected font's custom names.
 * Input source text is never mutated; use only to prepare a separate render run.
 * Quoted literal text is excluded from substitutions. */
export function makeCustomNameRegistry(manifest){
  const raw=manifest?.mappings||{};
  if(typeof raw!=='object'||Array.isArray(raw))throw Error('Invalid custom glyph registry');
  const out=new Map();
  for(const [name,hex] of Object.entries(raw)){
    if(!validTokiPonaCustomName(name))throw Error(`Invalid custom glyph name: ${name}`);
    const cp=Number.parseInt(String(hex).replace(/^U\+/i,''),16);
    if(!Number.isInteger(cp)||cp<0xF19E7||cp>0xF19FF)throw Error(`Invalid custom glyph Unicode: ${name}`);
    out.set(name,String.fromCodePoint(cp));
  }
  return out;
}
export function rewriteCustomNames(input,registry,{literal=false}={}){
  const src=String(input??'');if(literal||!registry?.size)return src;
  let result='',quoted=false,token='';
  const flush=()=>{if(token){result+=quoted?token:(registry.get(token)||token);token='';}};
  for(const c of src){
    if(c==='"'){flush();quoted=!quoted;result+=c;continue;}
    if(/[a-z0-9]/.test(c)){
      if(token||/[a-z]/.test(c)){token+=c;continue;}
    }
    flush();result+=c;
  }
  flush();return result;
}
