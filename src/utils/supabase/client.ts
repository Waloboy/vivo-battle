import { createBrowserClient } from '@supabase/ssr'

// Singleton — all components share ONE client & ONE realtime connection
let client: ReturnType<typeof createBrowserClient> | null = null;

export function createClient() {
  // If we are on the server (e.g. Next.js SSR), do NOT use the singleton to avoid session bleed
  if (typeof window === 'undefined') {
    return createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }

  // Singleton for client-side
  if (!client) {
    client = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
        realtime: {
          params: {
            eventsPerSecond: 10,
          },
          heartbeatIntervalMs: 3000, // Pulso cada 3 segundos para mantener vivo el WebSocket
        },
        global: {
          headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' }
        }
      }
    );

    // ── Realtime Auto-Reconnect Timer (Marcapasos) ──
    // If the WebSocket dies (mobile network switch, sleep, etc.),
    // attempt to reconnect every 3 seconds instead of staying dead.
    setInterval(() => {
      if (!client?.realtime) return;
      try {
        const state = client.realtime.connectionState();
        if (state !== 'open' && state !== 'connecting') {
          console.log('[Supabase] WebSocket dead (' + state + ') — auto-reconnecting...');
          client.realtime.connect();
        }
      } catch (e) {
        // connectionState() may throw if realtime isn't initialized yet — safe to ignore
      }
    }, 3000);

    // ── Visibility Change: Immediate Reconnect ──
    // When the user returns to the tab, force reconnect NOW instead of waiting for the interval
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && client?.realtime) {
        try {
          const state = client.realtime.connectionState();
          if (state !== 'open' && state !== 'connecting') {
            console.log('[Supabase] Tab visible — forcing immediate reconnect...');
            client.realtime.connect();
          }
        } catch (e) { /* safe to ignore */ }
      }
    });
  }
  return client;
}