import { readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
async function walk(dir){const out=[];for(const e of await readdir(dir,{withFileTypes:true})){const p=join(dir,e.name);if(e.isDirectory())out.push(...await walk(p));else if(e.name!=='sw.js')out.push(p);}return out;}
const files=await walk('dist');
const hash=createHash('sha256');for(const file of files.sort())hash.update(file).update(await readFile(file));
const version=hash.digest('hex').slice(0,16),urls=files.map(p=>'/'+p.replaceAll('\\','/').replace(/^dist\//,''));
const script=`const CACHE='kotoba-${version}';
const ASSETS=${JSON.stringify(urls)};
self.addEventListener('install',event=>{event.waitUntil((async()=>{const cache=await caches.open(CACHE);try{await cache.addAll(ASSETS);}catch(e){await caches.delete(CACHE);throw e;}})());});
self.addEventListener('activate',event=>{event.waitUntil((async()=>{for(const key of await caches.keys()){if(key.startsWith('kotoba-')&&key!==CACHE)await caches.delete(key);}await self.clients.claim();})());});
self.addEventListener('fetch',event=>{const url=new URL(event.request.url);if(event.request.method!=='GET'||url.origin!==self.location.origin||url.pathname==='/install'||url.pathname.startsWith('/root-ca')||url.pathname==='/health')return;
 event.respondWith((async()=>{const cache=await caches.open(CACHE);if(event.request.mode==='navigate'){return await cache.match('/index.html')||fetch(event.request);}return await cache.match(event.request,{ignoreSearch:true})||fetch(event.request);})());
});
self.addEventListener('message',event=>{if(event.data?.type==='VERIFY_CACHE')event.waitUntil((async()=>{const cache=await caches.open(CACHE);const hits=await Promise.all(ASSETS.map(p=>cache.match(p)));event.ports[0]?.postMessage({ready:hits.every(Boolean),version:CACHE,count:hits.filter(Boolean).length});})());});
`;
await writeFile('dist/sw.js',script);console.log(`Offline cache ${version}: ${urls.length} files`);
