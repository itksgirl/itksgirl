const CACHE='itks-ai-offline-v1';
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.add('/IA/offline.html')));
});
self.addEventListener('activate',event=>{
  event.waitUntil(Promise.all([self.clients.claim(),caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('itks-ai-offline-')&&k!==CACHE).map(k=>caches.delete(k))))]));
});
// Never cache API responses, credentials, conversations or uploaded files.
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET'||event.request.mode!=='navigate')return;
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin||!url.pathname.startsWith('/IA/'))return;
  event.respondWith(fetch(event.request).catch(async()=>
    (await caches.match('/IA/offline.html'))||new Response('Sem conexão. Reconecte-se para usar a ITKs AI.',{headers:{'Content-Type':'text/plain;charset=utf-8'}})
  ));
});
