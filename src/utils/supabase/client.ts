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
          // Force WebSocket transport — KILL REST/longpoll fallback
          transport: (globalThis as any).WebSocket,
        },
      }
    );

    // Force immediate WebSocket connection on creation (browser only)
    if (typeof window !== 'undefined') {
      client.realtime.connect();
    }
  }
  return client;
}
