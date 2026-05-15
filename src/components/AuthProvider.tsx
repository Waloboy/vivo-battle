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

  // ── Persist auth state to sessionStorage ONLY (Memoria Cero) ──
  const persistAuth = useCallback((newUser: any, newProfile: any, newIsAdmin: boolean) => {
    if (typeof window === "undefined") return;

    if (newUser && newProfile) {
      sessionStorage.setItem("vivo_user_data", JSON.stringify(newUser));
      sessionStorage.setItem("vivo_user_profile", JSON.stringify(newProfile));
      sessionStorage.setItem("vivo_is_admin", String(newIsAdmin));
    } else {
      sessionStorage.removeItem("vivo_user_data");
      sessionStorage.removeItem("vivo_user_profile");
      sessionStorage.removeItem("vivo_is_admin");
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
    const timeoutId = setTimeout(() => { controller.abort(); setLoading(false); }, 5000);
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

    // Step 1: INSTANT hydration from sessionStorage ONLY (Memoria Cero)
    // No localStorage reads — it's poisoned territory
    if (typeof window !== "undefined") {
      try {
        const storedUser = sessionStorage.getItem("vivo_user_data");
        const storedProfile = sessionStorage.getItem("vivo_user_profile");
        const storedAdmin = sessionStorage.getItem("vivo_is_admin");

        if (storedUser && storedProfile) {
          setUser(JSON.parse(storedUser));
          setProfile(JSON.parse(storedProfile));
          setIsAdmin(storedAdmin === "true");
          setLoading(false);
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

    // Step 4: Visibility Change — just re-fetch auth, no realtime reconnection needed
    // Longpolling handles its own transport. We only refresh the session.
    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;
      refreshAuth();
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
