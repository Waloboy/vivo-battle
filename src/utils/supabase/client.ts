import { createBrowserClient } from '@supabase/ssr'

// Singleton — all components share ONE client & ONE connection
// NOTE: @supabase/ssr has its own internal singleton (cachedBrowserClient).
// We keep ours as a safety net but the SSR lib will return the same instance.
let client: ReturnType<typeof createBrowserClient> | null = null;

export function createClient() {
  if (typeof window === 'undefined') {
    return createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }

  if (!client) {
    client = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            'X-Client-Info': 'arena-58-client'
          }
        },
        auth: {
          storage: typeof window !== 'undefined' ? window.sessionStorage : undefined,
          flowType: 'pkce',
          persistSession: true
        }
      }
    );
  }
  return client;
}