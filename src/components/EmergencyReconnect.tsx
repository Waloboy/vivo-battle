"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/components/AuthProvider";
import { RefreshCw } from "lucide-react";
import { usePathname } from "next/navigation";

export function EmergencyReconnect() {
  const { profile } = useAuth();
  const [show, setShow] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    // Only show if we're not on the landing page
    if (pathname === "/") return;

    let timer: NodeJS.Timeout;
    
    if (!profile) {
      // If no profile after 5 seconds, show emergency button
      timer = setTimeout(() => {
        setShow(true);
      }, 5000);
    } else {
      setShow(false);
    }

    return () => clearTimeout(timer);
  }, [profile, pathname]);

  if (!show) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[9999]">
      <button
        onClick={() => window.location.href = "/"}
        className="flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white font-bold py-3 px-5 rounded-full shadow-2xl animate-bounce border-2 border-red-400"
      >
        <RefreshCw size={20} className="animate-spin-slow" />
        <span className="text-sm">¿No cargan tus datos? Reconectar</span>
      </button>
    </div>
  );
}
