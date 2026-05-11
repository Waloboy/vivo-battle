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
          // Use cookies as the session storage so mobile browsers can't freeze the session
          storage: undefined, // let @supabase/ssr manage cookies automatically
          flowType: 'pkce',
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: true,
        },
        cookieOptions: {
          name: 'sb-vivo-auth',
          maxAge: 60 * 60 * 24 * 7, // 7 days
          sameSite: 'lax' as const,
          secure: process.env.NODE_ENV === 'production',
        },
      }
    );
  }
  return supabaseInstance;
};

// Export a default singleton for direct use in client components
export const supabase = getSupabaseClient();
