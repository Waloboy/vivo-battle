"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Swords } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { useAuth } from "@/components/AuthProvider";

export function ChallengeNotification() {
  const supabase = useMemo(() => createClient(), []);
  const { user } = useAuth();
  const [challenge, setChallenge] = useState<any>(null);
  const channelRef = useRef<any>(null);

  useEffect(() => {
    if (!user?.id) return;

    // Clean up previous channel if any
    if (channelRef.current) {
      channelRef.current.unsubscribe().then(() => {
        try { supabase.removeChannel(channelRef.current); } catch {}
      });
      channelRef.current = null;
    }

    // Subscribe to global-sync for BROADCAST challenge events (instant)
    // DashboardClient sends challenges via broadcast on this same channel
    channelRef.current = supabase
      .channel("challenge-notif")
      .on(
        "broadcast",
        { event: "challenge" },
        (msg: any) => {
          const payload = msg.payload;
          if (payload?.challenged_id === user.id) {
            setChallenge(payload);
          }
        }
      )
      .subscribe();

    return () => {
      if (channelRef.current) {
        channelRef.current.unsubscribe().then(() => {
          try { supabase.removeChannel(channelRef.current); } catch {}
        });
        channelRef.current = null;
      }
    };
  }, [user?.id, supabase]);

  if (!challenge) return null;

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -50, opacity: 0 }}
        className="fixed top-5 left-1/2 -translate-x-1/2 z-[1000] w-[350px] bg-black border-2 border-[#ff007a] rounded-2xl p-5 shadow-[0_0_30px_rgba(255,0,122,0.4)]"
      >
         <div className="flex items-center gap-4">
            <div className="bg-[#ff007a] p-2 rounded-full">
              <Swords className="text-white" size={20} />
            </div>
            <div>
               <p className="text-white font-black text-sm">¡NUEVO RETO!</p>
               <p className="text-xs text-gray-400">
                 {challenge.challenger_username
                   ? `@${challenge.challenger_username} quiere batallar`
                   : "Alguien quiere batallar contigo."}
               </p>
            </div>
         </div>
         <div className="flex gap-2 mt-4">
            <button onClick={() => setChallenge(null)} className="flex-1 bg-gray-900 text-white py-2 rounded-xl text-[10px] font-bold">IGNORAR</button>
            <button 
               onClick={() => {
                 setChallenge(null);
                 window.location.href = '/dashboard';
               }}
               className="flex-1 bg-[#ff007a] text-white py-2 rounded-xl text-[10px] font-black"
            >
               IR ACEPTAR
            </button>
         </div>
      </motion.div>
    </AnimatePresence>
  );
}
