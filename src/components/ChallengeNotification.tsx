"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Swords, X } from "lucide-react";
import { createClient } from "@/utils/supabase/client";

export function ChallengeNotification() {
  const supabase = createClient();
  const [challenge, setChallenge] = useState<any>(null);
  const [mounted, setMounted] = useState(false);
  const channelRef = useRef<any>(null);

  useEffect(() => {
    setMounted(true);
    let user_id: string;

    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      user_id = user.id;

      // 🔥 LIMPIEZA PREVIA: Si ya hay un canal, lo matamos antes de empezar
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }

      // 🛡️ CANAL AISLADO: Usamos un nombre único con el ID del usuario
      channelRef.current = supabase
        .channel(`user-challenges-${user_id}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "challenges", filter: `challenged_id=eq.${user_id}` },
          (payload:any) => {
            console.log("RETO RECIBIDO:", payload.new);
            setChallenge(payload.new);
          }
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "challenges", filter: `status=eq.accepted` },
          (payload:any) => {
            if (payload.new.challenger_id === user_id && payload.new.battle_id) {
              window.location.href = `/battle/${payload.new.battle_id}`;
            }
          }
        )
        .subscribe((status:any) => {
          console.log("ESTADO CONEXIÓN RETOS:", status);
        });
    };

    init();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, []);

  if (!mounted || !challenge) return null;

  return (
    <AnimatePresence>
      <motion.div className="fixed top-20 left-1/2 -translate-x-1/2 z-[999] w-[90vw] max-w-sm bg-black border-2 border-[#ff007a] rounded-3xl p-6 shadow-2xl">
         <div className="flex items-center gap-4">
            <Swords className="text-[#ff007a]" />
            <div>
               <p className="text-white font-bold">¡NUEVO RETO!</p>
               <p className="text-sm text-gray-400">Te han desafiado a una batalla.</p>
            </div>
         </div>
         <div className="flex gap-2 mt-4">
            <button onClick={() => setChallenge(null)} className="flex-1 bg-gray-800 py-2 rounded-xl text-xs">IGNORAR</button>
            <button 
               onClick={() => window.location.href = `/dashboard`} // Forzamos recarga al dashboard para aceptar
               className="flex-1 bg-[#ff007a] py-2 rounded-xl text-xs font-bold"
            >
               VER RETO
            </button>
         </div>
      </motion.div>
    </AnimatePresence>
  );
}