"use client";

import {
  createContext, useContext, useEffect,
  useState, useMemo, useCallback, useRef
} from "react";
import type { UserResponse } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";

interface AuthState {
  user: any;
  profile: any;
  isAdmin: boolean;
  loading: boolean;
  refreshAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  user: null,
  profile: null,
  isAdmin: false,
  loading: true,
  refreshAuth: async () => {},
});

export const useAuth = () => useContext(AuthContext);

// ─── Helpers: persist admin flag to localStorage ───────────────────────────
const LS_ADMIN = "vivo_is_admin";
const LS_PROFILE = "vivo_user_profile";

const readCachedProfile = (): any | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(LS_PROFILE);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
};

const persistProfile = (data: any) => {
  if (typeof window === "undefined") return;
  localStorage.setItem(LS_PROFILE, JSON.stringify(data));
  localStorage.setItem(LS_ADMIN, String(data.role === "admin"));
};

const clearCache = () => {
  if (typeof window === "undefined") return;
  localStorage.removeItem(LS_PROFILE);
  localStorage.removeItem(LS_ADMIN);
};

// ─── Component ──────────────────────────────────────────────────────────────
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  const [user, setUser] = useState<any>(null);

  // Seed from cache so returning users see real data instantly
  const [profile, setProfile] = useState<any>(readCachedProfile);
  const [isAdmin, setIsAdmin] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(LS_ADMIN) === "true";
  });

  // loading = true while we haven't confirmed/denied a live session
  const [loading, setLoading] = useState(true);
  const didInit = useRef(false);

  // ── fetchProfile: strict — only set state if DB row exists ──────────────
  const fetchProfile = useCallback(async (userId: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      if (error || !data) {
        // No DB row — don't invent a fake profile, just clear
        console.warn("[AuthProvider] No profile row for user:", userId);
        return false;
      }

      setProfile(data);
      setIsAdmin(data.role === "admin");
      persistProfile(data);
      return true;
    } catch (e) {
      console.warn("[AuthProvider] fetchProfile error:", e);
      return false;
    }
  }, [supabase]);

  // ── refreshAuth: called on mount & visibilitychange ─────────────────────
  const refreshAuth = useCallback(async () => {
    try {
      // Step 1: fast local session check
      const { data: { session } } = await supabase.auth.getSession();

      if (session?.user) {
        setUser(session.user);
        await fetchProfile(session.user.id);
        setLoading(false);

        // Step 2: validate with server in background (doesn't block UI)
        supabase.auth.getUser().then((res: UserResponse) => {
          if (!res.data?.user) {
            // Server says session is dead — clear everything
            setUser(null);
            setProfile(null);
            setIsAdmin(false);
            clearCache();
          }
        }).catch(() => {
          // Network error — keep local state, don't disrupt
        });
      } else {
        // No local session — one server check
        const { data, error } = await supabase.auth.getUser();
        if (!error && data?.user) {
          setUser(data.user);
          await fetchProfile(data.user.id);
        } else {
          setUser(null);
          setProfile(null);
          setIsAdmin(false);
          clearCache();
        }
      }
    } catch (e) {
      console.warn("[AuthProvider] refreshAuth error:", e);
      // On error: keep cached profile visible, clear loading
    } finally {
      setLoading(false);
    }
  }, [supabase, fetchProfile]);

  // ── onAuthStateChange + visibility re-hydration ─────────────────────────
  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;

    refreshAuth();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (_event: any, session: any) => {
        if (session?.user) {
          setUser(session.user);
          await fetchProfile(session.user.id);
        } else {
          setUser(null);
          setProfile(null);
          setIsAdmin(false);
          clearCache();
        }
        setLoading(false);
      }
    );

    // ── Re-hydrate on visibility: wake the cookie session ──────────────
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        // Silently re-run getSession to refresh cookie token
        void (async () => {
          try {
            const res = await supabase.auth.getSession();
            const session = res.data?.session;
            if (session?.user) {
              setUser(session.user);
              fetchProfile(session.user.id);
            }
          } catch { /* network error — ignore */ }
        })();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    // ── Fallback: if loading is still true after 4s, release it ────────
    const fallback = setTimeout(() => setLoading(false), 4000);

    return () => {
      authListener.subscription.unsubscribe();
      document.removeEventListener("visibilitychange", handleVisibility);
      clearTimeout(fallback);
    };
  }, [supabase, refreshAuth, fetchProfile]);

  return (
    <AuthContext.Provider value={{ user, profile, isAdmin, loading, refreshAuth }}>
      {children}
    </AuthContext.Provider>
  );
}
