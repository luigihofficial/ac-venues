/* AC Venues · Service Worker
   Estrategia: network-first para el shell (siempre intenta traer lo más nuevo,
   y si no hay red usa la copia en caché). Nunca cachea Supabase, /api ni CDNs
   externos: esos siempre van a la red para no servir datos viejos. */
const VERSION = 'ac-venues-v1';
const SHELL = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/logo.png',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-maskable-192.png',
  '/icon-maskable-512.png',
  '/apple-touch-icon-180.png'
];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(VERSION).then((c) =>
      Promise.all(SHELL.map((u) => c.add(u).catch(() => null)))
    )
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function isBypass(url) {
  // No interceptar peticiones que no sean del mismo origen (Supabase, CDNs, etc.)
  if (url.origin !== self.location.origin) return true;
  // No cachear las funciones serverless
  if (url.pathname.startsWith('/api/')) return true;
  return false;
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (isBypass(url)) return; // deja que el navegador lo maneje normal (red)

  // Navegación (abrir la app): network-first, fallback al shell cacheado.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put('/index.html', copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(req).then((m) => m || caches.match('/index.html')))
    );
    return;
  }

  // Recursos del mismo origen: network-first, fallback a caché.
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.status === 200 && res.type === 'basic') {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(req))
  );
});

// Permite que la página fuerce la activación del SW nuevo.
self.addEventListener('message', (e) => {
  if (e.data === 'skipWaiting') self.skipWaiting();
});
