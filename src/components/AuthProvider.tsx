"use client";

import { createContext, useContext, useEffect, useState, useMemo, useCallback, useRef } from "react";
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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(() => {
    if (typeof window !== "undefined") {
      const cached = localStorage.getItem("vivo_user_profile");
      if (cached) {
        try { return JSON.parse(cached); } catch (e) {}
      }
    }
    return null;
  });
  const [isAdmin, setIsAdmin] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("vivo_is_admin") === "true";
    }
    return false;
  });
  const [loading, setLoading] = useState(true);
  const didInit = useRef(false);

  // ── Track when we went to background ──
  const hiddenAtRef = useRef<number | null>(null);

  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const { data } = await supabase
        .from("profiles")
        .select("username, role, avatar_url, full_name")
        .eq("id", userId)
        .single();
      if (data) {
        setProfile(data);
        const adminFlag = data.role === "admin";
        setIsAdmin(adminFlag);
        if (typeof window !== "undefined") {
          localStorage.setItem("vivo_is_admin", String(adminFlag));
          localStorage.setItem("vivo_user_profile", JSON.stringify(data));
        }
      }
    } catch (e) {
      console.warn("fetchProfile failed:", e);
    }
  }, [supabase]);

  const refreshAuth = useCallback(async () => {
    try {
      // 1. Try getSession first (instant from cookies/localStorage — no network)
      const { data: { session } } = await supabase.auth.getSession();

      if (session?.user) {
        setUser(session.user);
        await fetchProfile(session.user.id);
        setLoading(false);

        // 2. Then validate server-side in background (won't block UI)
        supabase.auth.getUser().then((res: UserResponse) => {
          if (res.data?.user) {
            setUser(res.data.user);
          } else if (res.error) {
            // Token was invalid — clear state
            setUser(null);
            setProfile(null);
            setIsAdmin(false);
          }
        }).catch((e: any) => {
          console.warn("Background auth validation failed:", e);
          // Network error — keep local session, don't block
        });
      } else {
        // No local session — try server validation once
        try {
          const { data, error } = await supabase.auth.getUser();
          if (error) throw error;
          if (data?.user) {
            setUser(data.user);
            await fetchProfile(data.user.id).catch(e => console.warn("Failed to fetch profile", e));
          } else {
            setUser(null);
            setProfile(null);
            setIsAdmin(false);
          }
        } catch (e) {
          console.warn("Failed to get user:", e);
          setUser(null);
          setProfile(null);
          setIsAdmin(false);
        }
      }
    } catch (e) {
      console.warn("refreshAuth top-level error:", e);
      setUser(null);
      setProfile(null);
      setIsAdmin(false);
    } finally {
      // ALWAYS clear loading — this is the nuclear guarantee
      setLoading(false);
    }
  }, [supabase, fetchProfile]);

  // ── Hard Reset: force full data reload after 30s in background ──
  const hardReset = useCallback(async () => {
    console.log("[AuthProvider] Hard reset triggered — app was in background >30s");
    setLoading(true);

    try {
      // Force a fresh session check from the server
      const { data: { session }, error } = await supabase.auth.getSession();

      if (error || !session?.user) {
        // Session invalid — try getUser as last resort
        const { data, error: userError } = await supabase.auth.getUser();
        if (userError || !data?.user) {
          setUser(null);
          setProfile(null);
          setIsAdmin(false);
          return;
        }
        setUser(data.user);
        await fetchProfile(data.user.id);
      } else {
        setUser(session.user);
        await fetchProfile(session.user.id);
      }

      // Dispatch custom event so pages can reload their data
      window.dispatchEvent(new CustomEvent("vivo_wakeup"));

      // Force router refresh to ensure server components re-render
      router.refresh();
    } catch (e) {
      console.warn("Hard reset failed:", e);
    } finally {
      setLoading(false);
    }
  }, [supabase, fetchProfile, router]);

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
          if (typeof window !== "undefined") {
            localStorage.removeItem("vivo_is_admin");
            localStorage.removeItem("vivo_user_profile");
          }
        }
        setLoading(false);
      }
    );

    // Timeout safety: if loading doesn't resolve in 3 seconds, force it.
    const fallbackTimeout = setTimeout(() => {
      setLoading(false);
    }, 3000);

    return () => {
      authListener.subscription.unsubscribe();
      clearTimeout(fallbackTimeout);
    };
  }, [supabase, refreshAuth, fetchProfile, hardReset]);

  return (
    <AuthContext.Provider value={{ user, profile, isAdmin, loading, refreshAuth }}>
      {children}
    </AuthContext.Provider>
  );
}
