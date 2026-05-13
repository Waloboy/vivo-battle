import { createBrowserClient } from '@supabase/ssr'

// Singleton — all components share ONE client & ONE realtime connection
let client: ReturnType<typeof createBrowserClient> | null = null;

export function createClient() {
  if (!client) {
    client = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          storage: typeof window !== 'undefined' ? window.localStorage : undefined
        },
        realtime: {
          params: {
            eventsPerSecond: 10,
          },
          // Force native WebSocket transport — KILL REST/longpoll fallback
          transport: typeof window !== 'undefined' ? WebSocket : undefined,
        },
      }
    );

    // ── Aggressive connection: force connect + visibilitychange listener ──
    if (typeof window !== 'undefined') {
      client.realtime.connect();

      // Auto-reconnect when user returns to tab
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && client) {
          const state = client.realtime.connectionState();
          if (state !== 'open' && state !== 'connecting') {
            console.warn('[VIVO Realtime] Socket closed — forcing reconnect...');
            client.realtime.connect();
          }
        }
      });

      // Monitor connection state changes
      client.realtime.onOpen(() => {
        console.log('[VIVO Realtime] ✅ WebSocket OPEN');
      });
      client.realtime.onClose(() => {
        console.warn('[VIVO Realtime] ⚠️ WebSocket CLOSED — will reconnect on visibility');
      });
      client.realtime.onError((err: any) => {
        console.error('[VIVO Realtime] ❌ WebSocket ERROR:', err);
      });
    }
  }
  return client;
}
