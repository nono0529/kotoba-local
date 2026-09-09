let db;
export async function openDB(){
  db=await new Promise((resolve,reject)=>{const request=indexedDB.open('kotoba-local',1);request.onupgradeneeded=()=>request.result.createObjectStore('data');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
  db.onversionchange=()=>db.close();return db;
}
export async function readState(){return new Promise((resolve,reject)=>{const r=db.transaction('data').objectStore('data').get('state');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
export async function saveState(state){return new Promise((resolve,reject)=>{const tx=db.transaction('data','readwrite');tx.objectStore('data').put(structuredClone(state),'state');tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('保存被中断'));});}
