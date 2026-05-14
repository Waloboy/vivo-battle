"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Swords, X } from "lucide-react";
import { createClient } from "@/utils/supabase/client";

export function ChallengeNotification() {
  const supabase = createClient();
  const [challenge, setChallenge] = useState<any>(null);
  const channelRef = useRef<any>(null);

  useEffect(() => {
    let active = true;

    const subscribe = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !active) return;

      // 1. Matamos cualquier conexión previa para evitar el "Loading" infinito
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }

      // 2. Usamos el canal "realtime" por defecto (igual que el chat)
      channelRef.current = supabase
        .channel('realtime:public:challenges')
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "challenges", filter: `challenged_id=eq.${user.id}` },
          (payload: any) => {
            if (active) setChallenge(payload.new);
          }
        )
        .subscribe();
    };

    // 3. RECONEXIÓN AUTOMÁTICA: Si el usuario vuelve de otra app, reconectamos
    const handleFocus = () => {
      if (document.visibilityState === 'visible') {
        subscribe();
      }
    };

    subscribe();
    document.addEventListener("visibilitychange", handleFocus);

    return () => {
      active = false;
      document.removeEventListener("visibilitychange", handleFocus);
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, []);

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
               <p className="text-xs text-gray-400">Alguien quiere batallar contigo.</p>
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
