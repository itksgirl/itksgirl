self.addEventListener('install', (e) => {
  console.log('App pronto!');
});

self.addEventListener('fetch', (e) => {
  e.respondWith(fetch(e.request));
});