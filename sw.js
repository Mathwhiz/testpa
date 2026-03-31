const CACHE = 'ziv-v1';

// Archivos estáticos que se pre-cachean al instalar
const SHELL = [
  '/',
  '/firebase.js',
  '/ui-utils.js',
  '/favicon.svg',
  '/admin.js',
  '/territorios/index.html',
  '/territorios/app.js',
  '/territorios/mapa.html',
  '/asignaciones/index.html',
  '/asignaciones/app.js',
  '/vida-ministerio/index.html',
  '/vida-ministerio/app.js',
  '/vida-ministerio/programa.html',
  '/vida-ministerio/programa.js',
];

// Instalar: pre-cachear la app shell
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)));
  self.skipWaiting();
});

// Activar: limpiar caches viejos
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: network-first para mismo origen (garantiza archivos frescos)
// Firebase, CDN (Leaflet, Firebase SDK, PostHog) son cross-origin → pasan directo a red
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;

  // Network first: intenta red, actualiza cache, cae en cache si está offline
  e.respondWith(
    fetch(e.request)
      .then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(e.request))
  );
});
