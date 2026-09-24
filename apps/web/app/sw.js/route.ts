const CORPO = `
const CACHE = 'agrotech-cache-v1';
const OFFLINE_URL = '/offline';

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then((cache) => cache.add(OFFLINE_URL)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const nomes = await caches.keys();
    await Promise.all(nomes.filter((n) => n !== CACHE).map((n) => caches.delete(n)));
    await self.clients.claim();
  })());
});

// Rede primeiro, com fallback pro cache — nunca serve JS/CSS velho por cima de
// build novo enquanto houver sinal. Offline só enxerga o que já foi visitado.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith((async () => {
    try {
      const resposta = await fetch(req);
      if (resposta.ok) {
        const cache = await caches.open(CACHE);
        cache.put(req, resposta.clone());
      }
      return resposta;
    } catch {
      const cache = await caches.open(CACHE);
      const emCache = await cache.match(req);
      if (emCache) return emCache;
      if (req.mode === 'navigate') {
        const offline = await cache.match(OFFLINE_URL);
        if (offline) return offline;
      }
      throw new Error('offline e sem cache pra ' + req.url);
    }
  })());
});
`;

/** Service worker servido como route handler — sem precisar de pasta public/. */
export function GET() {
  return new Response(CORPO, {
    headers: {
      'content-type': 'application/javascript; charset=utf-8',
      'service-worker-allowed': '/',
      'cache-control': 'no-cache',
    },
  });
}
