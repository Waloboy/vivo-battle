"use client";

import {
  createContext, useContext, useEffect,
  useState, useMemo, useCallback, useRef
} from "react";
import { createClient } from "@/utils/supabase/client";

// ─── Types ──────────────────────────────────────────────────────────────────
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

// ─── Component ──────────────────────────────────────────────────────────────
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const supabase = useMemo(() => createClient(), []);

  // ── HYDRATION-SAFE: Always start with null/true ──
  // NEVER read from localStorage in useState initializer — that causes #418
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);

  const didInit = useRef(false);
  const isRefreshing = useRef(false);

  // ── Persist auth state to storage ──
  const persistAuth = useCallback((newUser: any, newProfile: any, newIsAdmin: boolean) => {
    if (typeof window === "undefined") return;

    if (newUser && newProfile) {
      const userData = JSON.stringify(newUser);
      const profileData = JSON.stringify(newProfile);
      const adminStr = String(newIsAdmin);

      localStorage.setItem("vivo_user_data", userData);
      localStorage.setItem("vivo_user_profile", profileData);
      localStorage.setItem("vivo_is_admin", adminStr);
      sessionStorage.setItem("vivo_user_data", userData);
      sessionStorage.setItem("vivo_user_profile", profileData);
      sessionStorage.setItem("vivo_is_admin", adminStr);
    } else {
      localStorage.removeItem("vivo_user_data");
      localStorage.removeItem("vivo_user_profile");
      localStorage.removeItem("vivo_is_admin");
      sessionStorage.removeItem("vivo_user_data");
      sessionStorage.removeItem("vivo_user_profile");
      sessionStorage.removeItem("vivo_is_admin");

      // Force delete supabase token
      if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
        const host = process.env.NEXT_PUBLIC_SUPABASE_URL.split("//")[1]?.split(".")[0];
        if (host) {
          localStorage.removeItem(`sb-${host}-auth-token`);
        }
      }
    }
  }, []);

  // Wrapper for state updates + persist
  const safeUpdateAuth = useCallback((newUser: any, newProfile: any, newIsAdmin: boolean) => {
    setUser(newUser);
    setProfile(newProfile);
    setIsAdmin(newIsAdmin);
    persistAuth(newUser, newProfile, newIsAdmin);
  }, [persistAuth]);

  // ── fetchProfile: strict — only real DB data ────────────────────────────
  const fetchProfile = useCallback(async (userId: string, currentUser: any): Promise<boolean> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => { controller.abort(); setLoading(false); }, 2500);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .abortSignal(controller.signal)
        .single();
      clearTimeout(timeoutId);

      if (error || !data) {
        console.warn("[Auth] No profile row for:", userId);
        return false;
      }

      safeUpdateAuth(currentUser, data, data.role === "admin");
      return true;
    } catch (e) {
      clearTimeout(timeoutId);
      console.warn("[Auth] fetchProfile error:", e);
      return false;
    }
  }, [supabase, safeUpdateAuth]);

  // ── refreshAuth: validate session with Supabase ─────────────────────────
  const refreshAuth = useCallback(async () => {
    if (isRefreshing.current) return;
    isRefreshing.current = true;

    try {
      if (!supabase || !supabase.auth) return;
      const { data: { session } } = await supabase.auth.getSession();

      if (session?.user) {
        await fetchProfile(session.user.id, session.user);
      } else {
        // Only wipe state if we're sure there's no session (not a network error)
        safeUpdateAuth(null, null, false);
      }
    } catch (e) {
      // Network error — DON'T wipe state, keep cached data visible
      console.warn("[Auth] refreshAuth network error (keeping cached state):", e);
    } finally {
      isRefreshing.current = false;
      setLoading(false);
    }
  }, [supabase, fetchProfile, safeUpdateAuth]);

  // ── Init + listeners ────────────────────────────────────────────────────
  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;

    // Step 1: INSTANT hydration from storage (prevents loading flash)
    // This runs in useEffect (after mount) so it's hydration-safe — no #418
    if (typeof window !== "undefined") {
      try {
        const storedUser = sessionStorage.getItem("vivo_user_data")
          || localStorage.getItem("vivo_user_data");
        const storedProfile = sessionStorage.getItem("vivo_user_profile")
          || localStorage.getItem("vivo_user_profile");
        const storedAdmin = sessionStorage.getItem("vivo_is_admin")
          || localStorage.getItem("vivo_is_admin");

        if (storedUser && storedProfile) {
          setUser(JSON.parse(storedUser));
          setProfile(JSON.parse(storedProfile));
          setIsAdmin(storedAdmin === "true");
          setLoading(false); // We have cached data — show it immediately
        }
      } catch { /* corrupt storage, fall through to refreshAuth */ }
    }

    // Step 2: Validate session with Supabase (background, won't wipe on error)
    refreshAuth();

    // Step 3: Auth state change listener
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (_event: any, session: any) => {
        if (session?.user) {
          await fetchProfile(session.user.id, session.user);
        } else {
          safeUpdateAuth(null, null, false);
        }
        setLoading(false);
      }
    );

    // Step 4: CENTRALIZED Visibility Change Handler
    // Silently re-fetch auth data + reconnect Supabase realtime when tab returns.
    // NO router.refresh(), NO window.location.reload() — those cause 404 / infinite loops.
    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;

      console.log("[Auth] Tab visible — re-fetching auth + reconnecting realtime");

      // Re-validate session silently (won't wipe state on network error)
      refreshAuth();

      // Reconnect Supabase WebSocket if it died while tab was hidden
      if (supabase.realtime) {
        try {
          const state = supabase.realtime.connectionState();
          if (state !== "open" && state !== "connecting") {
            console.log("[Auth] WebSocket was", state, "— reconnecting...");
            supabase.realtime.connect();
          }
        } catch (e) {
          console.warn("[Auth] realtime reconnect failed:", e);
        }
      }

      // Notify child components to re-fetch their data
      window.dispatchEvent(new Event("vivo_wakeup"));
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      authListener.subscription.unsubscribe();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [refreshAuth, fetchProfile, supabase, safeUpdateAuth]);

  return (
    <AuthContext.Provider value={{ user, profile, isAdmin, loading, refreshAuth }}>
      {children}
    </AuthContext.Provider>
  );
}
