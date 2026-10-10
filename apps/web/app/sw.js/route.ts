const CORPO = `
// v2: descarta caches antigos que podiam guardar telas de login e redirecionamentos
const CACHE = 'agrotech-cache-v2';
const OFFLINE_URL = '/offline';

// Telas/rotas de sessão nunca entram no cache nem são servidas dele: uma tela de login
// guardada reapareceria para quem já está logado quando a rede falhasse ao reabrir a aba.
const SESSAO = ['/login', '/cadastro', '/sair', '/produtor/login', '/produtor/sair', '/academy/sair', '/connect/sair', '/sites', '/produtor/aceitar', '/equipe/aceitar', '/redefinir-senha', '/verificar-codigo'];
const ehSessao = (caminho) => SESSAO.some((p) => caminho === p || caminho.startsWith(p + '/'));

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
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // logout: apaga o que foi guardado, para o próximo usuário do aparelho não ver (nem abrir
  // offline) as telas do anterior
  if (req.method === 'POST' && ['/sair', '/produtor/sair', '/academy/sair', '/connect/sair'].includes(url.pathname)) {
    event.waitUntil(caches.delete(CACHE));
    return;
  }

  if (req.method !== 'GET' || ehSessao(url.pathname)) return;

  event.respondWith((async () => {
    try {
      const resposta = await fetch(req);
      // redirecionamento (ex.: /app -> /login quando deslogado) não é a página pedida: não guarda
      if (resposta.ok && !resposta.redirected && resposta.type === 'basic') {
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

// Avisos no celular (Web Push): o servidor manda { titulo, corpo, url, tag }; mostramos o aviso e, ao tocar, abrimos a tela certa.
self.addEventListener('push', (event) => {
  let dados = {};
  try { dados = event.data ? event.data.json() : {}; } catch (e) { dados = {}; }
  const titulo = typeof dados.titulo === 'string' && dados.titulo ? dados.titulo : 'AgroTech';
  const opcoes = {
    body: typeof dados.corpo === 'string' ? dados.corpo : '',
    icon: '/icones-pwa/192',
    badge: '/icones-pwa/192',
    tag: typeof dados.tag === 'string' ? dados.tag : undefined,
    data: { url: typeof dados.url === 'string' ? dados.url : '/' },
  };
  event.waitUntil(self.registration.showNotification(titulo, opcoes));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  // só abre endereço do próprio site (o servidor já manda caminho relativo; aqui confere de novo)
  let destino = new URL('/', self.location.origin);
  try {
    const pedido = new URL(event.notification.data && event.notification.data.url ? event.notification.data.url : '/', self.location.origin);
    if (pedido.origin === self.location.origin) destino = pedido;
  } catch (e) { /* fica na página inicial */ }
  event.waitUntil((async () => {
    const janelas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const j of janelas) {
      if (j.url === destino.href && 'focus' in j) return j.focus();
    }
    if (janelas[0] && 'navigate' in janelas[0]) {
      await janelas[0].focus();
      return janelas[0].navigate(destino.href);
    }
    return self.clients.openWindow(destino.href);
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
