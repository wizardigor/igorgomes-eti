const CACHE='igor-whiteboard-editor-v4';
const shell=['./','./app.js','./engine.js','./editor-options.js','./hand-sprites.js','./hands/masculina.webp','./hands/feminina.webp','./hands/masculina-ferramentas.webp','./hands/feminina-ferramentas.webp','./hands/nanquim.webp','./editor.css','./trace-worker.js','./voice-worker.js','./vendor/site.css','./icon-192.png','./icon-512.png','./manifest.webmanifest'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(shell))));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('igor-whiteboard-')&&k!==CACHE).map(k=>caches.delete(k))))));
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==self.location.origin||!u.pathname.startsWith(new URL('./',self.location).pathname))return;
 e.respondWith(fetch(e.request).then(r=>{if(r.ok){const clone=r.clone();e.waitUntil(caches.open(CACHE).then(c=>c.put(e.request,clone)).catch(()=>{}));}return r;}).catch(async()=>await caches.match(e.request)||Response.error()));
});
