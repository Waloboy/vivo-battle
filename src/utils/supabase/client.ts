import { createBrowserClient } from '@supabase/ssr'

// Singleton — all components share ONE client & ONE connection
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
          storage: sessionStorage,
          flowType: 'pkce',
        },
        global: {
          headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' }
        }
      }
    );
  }
  return client;
}