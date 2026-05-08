import { createBrowserClient } from '@supabase/ssr';

// Singleton instance to prevent multiple connections
let supabaseInstance: ReturnType<typeof createBrowserClient> | null = null;

export const getSupabaseClient = () => {
  if (!supabaseInstance) {
    supabaseInstance = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          storageKey: 'vivo_battle_auth_token',
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: true,
        },
        cookieOptions: {
          name: 'vivo-battle-auth-cookie',
        }
      }
    );
  }
  return supabaseInstance;
};

// Export a default singleton for direct use in client components
export const supabase = getSupabaseClient();
