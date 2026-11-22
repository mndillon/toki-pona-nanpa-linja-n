/* Minimal, reversible per-anchor draft changes; never clone the whole project. */
export function readDraft(drafts,key){return Array.isArray(drafts?.[String(key)])?drafts[String(key)]:[];}
export function saveDraft(drafts,key,points){
 const id=String(key);
 if(!Array.isArray(points)||!points.length){delete drafts[id];return [];}
 drafts[id]=structuredClone(points);return drafts[id];
}
export function applyDraftPoint(drafts,key,index,point){
 const id=String(key);
 if(!Number.isInteger(index)||index<0)throw new Error('Invalid draft anchor position');
 const points=readDraft(drafts,id);
 if(point==null){if(index>=points.length)throw new Error('Undo anchor not found');points.splice(index,1);}
 else {if(index>points.length)throw new Error('Redo anchor position invalid');points.splice(index,0,structuredClone(point));}
 if(points.length)drafts[id]=points;else delete drafts[id];
 return readDraft(drafts,id);
}
