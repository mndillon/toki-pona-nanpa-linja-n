/* MIT. Independent per-font projects and bounded project-wide history.
 * The original source-font bytes remain inside the project record in IndexedDB.
 * Undo histories are kept in a separate store so project exports start clean. */
const DB='sp-font-maker-studio-v1';
const STORE='projects';
const HISTORY='projectHistory';
let opened=null;
export function openDB(){
  if(opened)return opened;
  opened=new Promise((resolve,reject)=>{
    if(!globalThis.indexedDB){reject(new Error('IndexedDB unavailable'));return;}
    const req=indexedDB.open(DB,2);
    req.onupgradeneeded=()=>{
      const db=req.result;
      if(!db.objectStoreNames.contains(STORE))db.createObjectStore(STORE,{keyPath:'id'});
      if(!db.objectStoreNames.contains(HISTORY))db.createObjectStore(HISTORY,{keyPath:'id'});
    };
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error);
  });
  return opened;
}
async function call(storeName,mode,action){
  const db=await openDB();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(storeName,mode),store=tx.objectStore(storeName);let result;
    try{result=action(store);}catch(e){reject(e);return;}
    tx.oncomplete=()=>resolve(result?.result);
    tx.onerror=()=>reject(tx.error);
    tx.onabort=()=>reject(tx.error||new Error('Transaction aborted'));
  });
}
export const saveProject=p=>call(STORE,'readwrite',s=>s.put(p));
export const loadProject=id=>call(STORE,'readonly',s=>s.get(id));
export const deleteProject=async id=>{
  const db=await openDB();return new Promise((resolve,reject)=>{
    const tx=db.transaction([STORE,HISTORY],'readwrite');
    tx.objectStore(STORE).delete(id);tx.objectStore(HISTORY).delete(id);
    tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
  });
};
export const listProjects=()=>call(STORE,'readonly',s=>s.getAll());
export const loadProjectHistory=async id=>await call(HISTORY,'readonly',s=>s.get(id))||{id,undo:[],redo:[]};
export async function saveWorkspace(project,history){
  const db=await openDB();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction([STORE,HISTORY],'readwrite');
    tx.objectStore(STORE).put(project);
    tx.objectStore(HISTORY).put({...history,id:project.id});
    tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
  });
}
