// Service Worker: keeps Supabase auth token alive in background
// Periodically pings the session endpoint so the OS doesn't kill it

const REFRESH_INTERVAL = 4 * 60 * 1000; // Every 4 minutes

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Listen for messages from the main thread
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SUPABASE_CONFIG") {
    const { supabaseUrl, supabaseKey } = event.data;
    startTokenRefresh(supabaseUrl, supabaseKey);
  }
});

let refreshTimer = null;

function startTokenRefresh(supabaseUrl, supabaseKey) {
  if (refreshTimer) clearInterval(refreshTimer);

  refreshTimer = setInterval(async () => {
    try {
      // Read the stored session from the main thread via a client message
      const clients = await self.clients.matchAll({ type: "window" });
      for (const client of clients) {
        client.postMessage({ type: "SESSION_KEEPALIVE" });
      }
    } catch (e) {
      // Silently fail — we're just a keepalive mechanism
    }
  }, REFRESH_INTERVAL);
}
