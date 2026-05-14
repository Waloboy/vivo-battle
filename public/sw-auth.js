// ARENA 58 — Service Worker with cache-busting and auth keepalive
// Version tag: changed on each deploy to force SW update
const SW_VERSION = 'arena58-v2';
const REFRESH_INTERVAL = 4 * 60 * 1000; // 4 minutes

self.addEventListener('install', (event) => {
  console.log(`[SW] Installing ${SW_VERSION}`);
  // Force immediate activation — don't wait for old tabs to close
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log(`[SW] Activating ${SW_VERSION}`);
  event.waitUntil(
    // Purge ALL old caches from previous versions
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== SW_VERSION) {
            console.log(`[SW] Deleting stale cache: ${cacheName}`);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      // Take control of all open clients immediately
      return self.clients.claim();
    })
  );
});

// Listen for messages from the main thread
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SUPABASE_CONFIG') {
    const { supabaseUrl, supabaseKey } = event.data;
    startTokenRefresh(supabaseUrl, supabaseKey);
  }

  // Force update check from main thread
  if (event.data && event.data.type === 'CHECK_UPDATE') {
    self.registration.update();
  }

  // Hard cache purge command
  if (event.data && event.data.type === 'PURGE_CACHE') {
    caches.keys().then((names) => {
      names.forEach((name) => caches.delete(name));
    });
  }
});

let refreshTimer = null;

function startTokenRefresh(supabaseUrl, supabaseKey) {
  if (refreshTimer) clearInterval(refreshTimer);

  refreshTimer = setInterval(async () => {
    try {
      const clients = await self.clients.matchAll({ type: 'window' });
      for (const client of clients) {
        client.postMessage({ type: 'SESSION_KEEPALIVE' });
      }
    } catch (e) {
      // Silently fail — keepalive only
    }
  }, REFRESH_INTERVAL);
}

// Intercept fetch for navigation requests only —
// serve from network-first, never cache API or realtime traffic
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Never intercept: WebSocket upgrades, Supabase API, LiveKit, or Next.js internals
  if (
    event.request.mode === 'websocket' ||
    url.pathname.startsWith('/_next/') ||
    url.pathname.startsWith('/api/') ||
    url.hostname.includes('supabase') ||
    url.hostname.includes('livekit')
  ) {
    return; // Let the browser handle these normally
  }
});
