"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

export function ConnectionManager() {
  const supabase = createClient();
  const pathname = usePathname();

  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === "visible") {
        console.log("[ConnectionManager] App in foreground. Forcing connection wakeup...");
        
        // 1. Force validate session
        await supabase.auth.getSession();

        // 2. Kill all hung Realtime channels
        await supabase.removeAllChannels();

        // 3. Dispatch a global event so components know to re-fetch and re-subscribe
        window.dispatchEvent(new Event("vivo_wakeup"));
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Also handle online/offline network events
    const handleOnline = async () => {
      console.log("[ConnectionManager] Network Online. Waking up...");
      await supabase.auth.getSession();
      await supabase.removeAllChannels();
      window.dispatchEvent(new Event("vivo_wakeup"));
    };

    window.addEventListener("online", handleOnline);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("online", handleOnline);
    };
  }, [supabase]);

  // Handle Route Changes
  useEffect(() => {
    const handleRouteChange = async () => {
      console.log("[ConnectionManager] Route changed to:", pathname, "Clearing zombie channels...");
      await supabase.removeAllChannels();
      window.dispatchEvent(new Event("vivo_wakeup"));
    };
    handleRouteChange();
  }, [pathname, supabase]);

  return null;
}
