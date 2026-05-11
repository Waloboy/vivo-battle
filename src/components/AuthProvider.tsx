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

// ─── localStorage keys ─────────────────────────────────────────────────────
const LS_PROFILE = "vivo_user_profile";
const LS_ADMIN   = "vivo_is_admin";
const LS_TOKEN   = "vivo_session_backup"; // backup of the full session for recovery

// ─── Helpers ────────────────────────────────────────────────────────────────
function readCached<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}

function persist(key: string, value: any) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

function clearAll() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(LS_PROFILE);
  localStorage.removeItem(LS_ADMIN);
  localStorage.removeItem(LS_TOKEN);
}

// ─── Component ──────────────────────────────────────────────────────────────
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const supabase = useMemo(() => createClient(), []);

  const [user, setUser]       = useState<any>(null);
  const [profile, setProfile] = useState<any>(() => readCached(LS_PROFILE, null));
  const [isAdmin, setIsAdmin] = useState<boolean>(() => readCached(LS_ADMIN, false));
  const [loading, setLoading] = useState(true);

  const didInit = useRef(false);
  const isRecovering = useRef(false);

  // ── fetchProfile: strict — only real DB data ────────────────────────────
  const fetchProfile = useCallback(async (userId: string): Promise<boolean> => {
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

      setProfile(data);
      setIsAdmin(data.role === "admin");
      persist(LS_PROFILE, data);
      persist(LS_ADMIN, data.role === "admin");
      return true;
    } catch (e) {
      console.warn("[Auth] fetchProfile error:", e);
      return false;
    }
  }, [supabase]);

  // ── Backup the full session so we can recover it ────────────────────────
  const backupSession = useCallback(async () => {
    try {
      const { data } = await supabase.auth.getSession();
      if (data?.session) {
        persist(LS_TOKEN, {
          access_token:  data.session.access_token,
          refresh_token: data.session.refresh_token,
        });
      }
    } catch {}
  }, [supabase]);

  // ── AGGRESSIVE recovery: try getSession → getUser → setSession from backup
  const recoverSession = useCallback(async (): Promise<boolean> => {
    if (isRecovering.current) return false;
    isRecovering.current = true;

    try {
      // Attempt 1: getSession (instant, from cookies/localStorage)
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData?.session?.user) {
        setUser(sessionData.session.user);
        await fetchProfile(sessionData.session.user.id);
        await backupSession();
        return true;
      }

      // Attempt 2: getUser (network call, validates token server-side)
      const { data: userData } = await supabase.auth.getUser();
      if (userData?.user) {
        setUser(userData.user);
        await fetchProfile(userData.user.id);
        await backupSession();
        return true;
      }

      // Attempt 3: recover from our localStorage backup
      const backup = readCached<any>(LS_TOKEN, null);
      if (backup?.access_token && backup?.refresh_token) {
        console.log("[Auth] Attempting session recovery from backup token...");
        const { data: restored, error } = await supabase.auth.setSession({
          access_token: backup.access_token,
          refresh_token: backup.refresh_token,
        });
        if (!error && restored?.session?.user) {
          setUser(restored.session.user);
          await fetchProfile(restored.session.user.id);
          await backupSession(); // refresh the backup
          return true;
        }
      }

      // All attempts failed — truly no session
      return false;
    } catch (e) {
      console.warn("[Auth] recoverSession error:", e);
      return false;
    } finally {
      isRecovering.current = false;
    }
  }, [supabase, fetchProfile, backupSession]);

  // ── refreshAuth: main entry point ───────────────────────────────────────
  const refreshAuth = useCallback(async () => {
    const recovered = await recoverSession();
    if (!recovered) {
      // No session found at all — clear cached state
      setUser(null);
      setProfile(null);
      setIsAdmin(false);
      clearAll();
    }
    setLoading(false);
  }, [recoverSession]);

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
          setUser(session.user);
          await fetchProfile(session.user.id);
          await backupSession();
        } else {
          setUser(null);
          setProfile(null);
          setIsAdmin(false);
          clearAll();
        }
        setLoading(false);
      }
    );

    // 3. AGGRESSIVE on-focus recovery (fires BEFORE visibilitychange)
    const handleFocus = () => {
      void (async () => {
        try {
          const recovered = await recoverSession();
          if (recovered) {
            console.log("[Auth] Session recovered on focus");
          }
        } catch {}
      })();
    };
    window.addEventListener("focus", handleFocus);

    // 4. Service Worker keepalive listener
    const handleSWMessage = (event: MessageEvent) => {
      if (event.data?.type === "SESSION_KEEPALIVE") {
        // SW asked us to keep the session alive — just touch it
        supabase.auth.getSession().catch(() => {});
      }
    };
    if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener("message", handleSWMessage);
    }

    // 5. Register Service Worker
    if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw-auth.js").then((reg) => {
        if (reg.active) {
          reg.active.postMessage({
            type: "SUPABASE_CONFIG",
            supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
            supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
          });
        }
      }).catch(() => {});
    }

    // 6. Safety fallback: if loading hasn't resolved in 5s, show the app
    const fallback = setTimeout(() => setLoading(false), 5000);

    return () => {
      authListener.subscription.unsubscribe();
      window.removeEventListener("focus", handleFocus);
      if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
        navigator.serviceWorker.removeEventListener("message", handleSWMessage);
      }
      clearTimeout(fallback);
    };
  }, [supabase, refreshAuth, fetchProfile, backupSession, recoverSession]);

  return (
    <AuthContext.Provider value={{ user, profile, isAdmin, loading, refreshAuth }}>
      {children}
    </AuthContext.Provider>
  );
}
