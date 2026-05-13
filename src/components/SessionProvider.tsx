"use client";

import { useEffect } from "react";
import { createClient } from "@/utils/supabase/client";

const supabase = createClient();

export function SessionProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        // Force server validation and refresh
        await supabase.auth.getUser();
      }
    };
    checkSession();
    
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        checkSession();
      }
    };
    
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  return <>{children}</>;
}
