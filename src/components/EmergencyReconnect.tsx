"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/components/AuthProvider";
import { RefreshCw } from "lucide-react";
import { usePathname } from "next/navigation";

export function EmergencyReconnect() {
  const { profile, loading, refreshAuth } = useAuth();
  const [show, setShow] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const pathname = usePathname();
  const retryCount = useRef(0);

  useEffect(() => {
    // Only show on protected pages (not landing)
    if (pathname === "/") return;

    let timer: NodeJS.Timeout;
    
    if (!profile && !loading) {
      // If no profile after 8 seconds, show emergency button
      timer = setTimeout(() => {
        setShow(true);
      }, 8000);
    } else {
      setShow(false);
      retryCount.current = 0;
    }

    return () => clearTimeout(timer);
  }, [profile, loading, pathname]);

  if (!show) return null;

  const handleReconnect = async () => {
    setRetrying(true);
    retryCount.current += 1;

    try {
      // First attempt: soft refresh via AuthProvider
      await refreshAuth();
      
      // If still no profile after soft refresh, hard reload
      setTimeout(() => {
        if (retryCount.current >= 2) {
          window.location.href = "/";
        }
        setRetrying(false);
      }, 2000);
    } catch {
      window.location.href = "/";
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-[9999]">
      <button
        onClick={handleReconnect}
        disabled={retrying}
        className="flex items-center gap-2 bg-red-600 hover:bg-red-500 disabled:bg-red-800 text-white font-bold py-3 px-5 rounded-full shadow-2xl animate-bounce border-2 border-red-400"
      >
        <RefreshCw size={20} className={retrying ? "animate-spin" : ""} />
        <span className="text-sm">
          {retrying ? "Reconectando..." : "¿No cargan tus datos? Reconectar"}
        </span>
      </button>
    </div>
  );
}
