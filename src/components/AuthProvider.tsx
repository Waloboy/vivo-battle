"use client";

import { createContext, useContext, useEffect, useState, useMemo, useCallback, useRef } from "react";
import type { UserResponse } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/client";

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
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const didInit = useRef(false);

  const fetchProfile = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("username, role, avatar_url, full_name")
      .eq("id", userId)
      .single();
    if (data) {
      setProfile(data);
      setIsAdmin(data.role === "admin");
    }
  }, [supabase]);

  const refreshAuth = useCallback(async () => {
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
      } finally {
        setLoading(false);
      }
    }
  }, [supabase, fetchProfile]);

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
        }
        setLoading(false);
      }
    );

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refreshAuth().catch(e => console.warn("Visibility refresh failed:", e));
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Timeout safety: if loading doesn't resolve in 5 seconds, force it.
    const fallbackTimeout = setTimeout(() => {
      setLoading(false);
    }, 5000);

    return () => {
      authListener.subscription.unsubscribe();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      clearTimeout(fallbackTimeout);
    };
  }, [supabase, refreshAuth, fetchProfile]);

  return (
    <AuthContext.Provider value={{ user, profile, isAdmin, loading, refreshAuth }}>
      {children}
    </AuthContext.Provider>
  );
}
