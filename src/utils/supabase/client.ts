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
          // Keep native WebSocket transport to prevent REST fallback
          transport: typeof window !== 'undefined' ? WebSocket : undefined,
        },
      }
    );
  }
  return client;
}
