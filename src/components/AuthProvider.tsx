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

  // Use sessionStorage and localStorage as absolute truth initially
  const [user, setUser] = useState<any>(() => {
    if (typeof window !== "undefined") {
      try {
        const sessionStored = sessionStorage.getItem("vivo_user_data");
        if (sessionStored) return JSON.parse(sessionStored);
        const stored = localStorage.getItem("vivo_user_data");
        return stored ? JSON.parse(stored) : null;
      } catch {}
    }
    return null;
  });

  const [profile, setProfile] = useState<any>(() => {
    if (typeof window !== "undefined") {
      try {
        const sessionStored = sessionStorage.getItem("vivo_user_profile");
        if (sessionStored) return JSON.parse(sessionStored);
        const stored = localStorage.getItem("vivo_user_profile");
        return stored ? JSON.parse(stored) : null;
      } catch {}
    }
    return null;
  });

  const [isAdmin, setIsAdmin] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      const sessionStored = sessionStorage.getItem("vivo_is_admin");
      if (sessionStored !== null) return sessionStored === "true";
      return localStorage.getItem("vivo_is_admin") === "true";
    }
    return false;
  });

  const [loading, setLoading] = useState(false);

  const didInit = useRef(false);
  const lockUntil = useRef(Date.now() + 10000); // 10 second lock for nullification

  // Wrapper for state updates to enforce the 10-second rule and sessionStorage
  const safeUpdateAuth = useCallback((newUser: any, newProfile: any, newIsAdmin: boolean) => {
    const isLocked = Date.now() < lockUntil.current;
    
    // If locked, we reject setting to null. Only real data can overwrite.
    if (isLocked && !newProfile) {
      console.log("[Auth] Ignoring nullification request due to 10s security lock.");
      return;
    }

    setUser(newUser);
    setProfile(newProfile);
    setIsAdmin(newIsAdmin);

    if (typeof window !== "undefined") {
      if (newUser && newProfile) {
        // Save to localStorage
        localStorage.setItem("vivo_user_data", JSON.stringify(newUser));
        localStorage.setItem("vivo_user_profile", JSON.stringify(newProfile));
        localStorage.setItem("vivo_is_admin", String(newIsAdmin));
        // Save to sessionStorage (Emergency Reserve)
        sessionStorage.setItem("vivo_user_data", JSON.stringify(newUser));
        sessionStorage.setItem("vivo_user_profile", JSON.stringify(newProfile));
        sessionStorage.setItem("vivo_is_admin", String(newIsAdmin));
      } else if (!isLocked) {
        localStorage.removeItem("vivo_user_data");
        localStorage.removeItem("vivo_user_profile");
        localStorage.removeItem("vivo_is_admin");
        sessionStorage.removeItem("vivo_user_data");
        sessionStorage.removeItem("vivo_user_profile");
        sessionStorage.removeItem("vivo_is_admin");
      }
    }
  }, []);

  // ── fetchProfile: strict — only real DB data ────────────────────────────
  const fetchProfile = useCallback(async (userId: string, currentUser: any): Promise<boolean> => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      if (error || !data) {
        console.warn("[Auth] No profile row for:", userId);
        return false;
      }

      safeUpdateAuth(currentUser, data, data.role === "admin");
      return true;
    } catch (e) {
      console.warn("[Auth] fetchProfile error:", e);
      return false;
    }
  }, [supabase, safeUpdateAuth]);

  // Save tokens manually
  const storeTokens = useCallback(async () => {
    try {
      const { data } = await supabase.auth.getSession();
      if (data?.session && typeof window !== "undefined") {
        localStorage.setItem("vivo_access_token", data.session.access_token);
        localStorage.setItem("vivo_refresh_token", data.session.refresh_token);
      }
    } catch {}
  }, [supabase]);

  // ── refreshAuth: main entry point ───────────────────────────────────────
  const refreshAuth = useCallback(async () => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (session?.user) {
        await fetchProfile(session.user.id, session.user);
        storeTokens();
      } else {
        safeUpdateAuth(null, null, false);
      }
    } catch (e) {
      console.warn("[Auth] error refreshing session:", e);
    } finally {
      setLoading(false);
    }
  }, [supabase, fetchProfile, safeUpdateAuth, storeTokens]);

  // ── Init + listeners ────────────────────────────────────────────────────
  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;

    // 1. Initial auth
    refreshAuth();

    // 2. Auth state change listener
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (_event: any, session: any) => {
        if (session?.user) {
          await fetchProfile(session.user.id, session.user);
          storeTokens();
        } else {
          safeUpdateAuth(null, null, false);
        }
        setLoading(false);
      }
    );

    // 3. Intelligent Reload on Focus
    const handleFocus = () => {
      // Check if we were supposed to be logged in (e.g. we have session data)
      const hadSession = sessionStorage.getItem("vivo_user_profile") || localStorage.getItem("vivo_user_profile");
      
      if (hadSession) {
        setTimeout(async () => {
          const { data } = await supabase.auth.getSession();
          // If after 1 second of waking up, Supabase says we have no session but we used to, FORCE RELOAD
          if (!data?.session) {
            console.warn("[Auth] Detected zombie state after focus. Forcing hard reload to fix blank screen.");
            if (window.location.pathname.includes("/admin")) {
              window.location.replace("/admin");
            } else {
              window.location.replace(window.location.pathname);
            }
          }
        }, 1000);
      }
    };
    window.addEventListener("focus", handleFocus);

    return () => {
      authListener.subscription.unsubscribe();
      window.removeEventListener("focus", handleFocus);
    };
  }, [refreshAuth, fetchProfile, supabase.auth, safeUpdateAuth, storeTokens]);

  return (
    <AuthContext.Provider value={{ user, profile, isAdmin, loading, refreshAuth }}>
      {children}
    </AuthContext.Provider>
  );
}
