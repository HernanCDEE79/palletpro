// ═══════════════════════════════════════════════════════════════
//  PalletPRO — Service Worker
//  Estrategia: Network-first con fallback a caché.
//  Cada vez que el usuario abre la app, busca la versión más nueva
//  en el servidor. Si hay una versión nueva, la activa en el
//  próximo ciclo de apertura (o de forma inmediata si se fuerza).
// ═══════════════════════════════════════════════════════════════

// ── VERSIÓN DEL CACHÉ ──────────────────────────────────────────
// Cambiá este número cada vez que subas una actualización.
// El service worker detecta el cambio y notifica a los usuarios.
const CACHE_VERSION = 'palletpro-v22-1';

// Archivos que se cachean para funcionar offline
const ASSETS = [
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// ── INSTALL ────────────────────────────────────────────────────
// Se ejecuta cuando el service worker se instala por primera vez
// o cuando detecta que hay una versión nueva del sw.js
self.addEventListener('install', event => {
  console.log('[SW] Instalando versión:', CACHE_VERSION);
  event.waitUntil(
    caches.open(CACHE_VERSION).then(cache => {
      // Cachear solo los archivos locales; los CDN externos se ignoran
      return cache.addAll(ASSETS).catch(err => {
        console.warn('[SW] No se pudieron cachear algunos assets:', err);
      });
    }).then(() => {
      // Activar inmediatamente sin esperar a que se cierre la pestaña vieja
      return self.skipWaiting();
    })
  );
});

// ── ACTIVATE ───────────────────────────────────────────────────
// Limpia cachés viejos y toma control de todas las pestañas
self.addEventListener('activate', event => {
  console.log('[SW] Activando versión:', CACHE_VERSION);
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys
          .filter(key => key !== CACHE_VERSION)
          .map(key => {
            console.log('[SW] Eliminando caché viejo:', key);
            return caches.delete(key);
          })
      );
    }).then(() => {
      // Tomar control de todas las pestañas abiertas sin recargar
      return self.clients.claim();
    }).then(() => {
      // Notificar a todas las pestañas que hay una versión nueva activa
      return self.clients.matchAll({ type: 'window' }).then(clients => {
        clients.forEach(client => {
          client.postMessage({ type: 'SW_UPDATED', version: CACHE_VERSION });
        });
      });
    })
  );
});

// ── FETCH ──────────────────────────────────────────────────────
// Estrategia: Network-first para index.html (siempre busca la versión más nueva)
//             Cache-first para el resto (iconos, etc.)
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Solo manejar peticiones al mismo origen (no CDNs externos)
  if (url.origin !== location.origin) return;

  // Para index.html: siempre intentar red primero
  if (url.pathname.endsWith('index.html') || url.pathname === '/' || url.pathname.endsWith('/')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Si la red responde, actualizar el caché con la versión nueva
          const clone = response.clone();
          caches.open(CACHE_VERSION).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() => {
          // Sin red: servir desde caché
          return caches.match('./index.html');
        })
    );
    return;
  }

  // Para el resto: caché primero, red como fallback
  event.respondWith(
    caches.match(event.request).then(cached => {
      return cached || fetch(event.request).then(response => {
        const clone = response.clone();
        caches.open(CACHE_VERSION).then(cache => cache.put(event.request, clone));
        return response;
      });
    })
  );
});

// ── MENSAJES DESDE LA APP ──────────────────────────────────────
// Cuando el usuario toca "ACTUALIZAR AHORA", la app le manda
// SKIP_WAITING al SW en espera para que tome control de inmediato
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
