"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Swords, Loader2 } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { useAuth } from "@/components/AuthProvider";

export function ChallengeNotification() {
  const supabase = useMemo(() => createClient(), []);
  const { user } = useAuth();
  const [challenge, setChallenge] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
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

  const handleAccept = async () => {
    if (loading) return;
    setLoading(true);
    setErrorMsg("");

    // 1. AbortController para cancelar peticiones viejas (Timeouts/Hung requests)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    try {
      // 2. Transacción Atómica (RPC)
      const { data: battleId, error } = await supabase
        .rpc("accept_challenge_v2", {
          p_challenge_id: challenge.id,
          p_user_id: user.id
        })
        .abortSignal(controller.signal);

      clearTimeout(timeoutId);

      if (error) {
        throw error;
      }

      if (battleId) {
        // 3. Enviar Broadcast (CHALLENGE_ACCEPTED) al retador para redirección inmediata
        const syncChannel = supabase.channel("global-sync");
        syncChannel.subscribe(async (status:any) => {
          if (status === 'SUBSCRIBED') {
            await syncChannel.send({
              type: "broadcast",
              event: "CHALLENGE_ACCEPTED",
              payload: {
                challenger_id: challenge.challenger_id,
                battle_id: battleId
              }
            });
            // Redirección Forzada Inmediata (bypass React Router)
            window.location.assign('/arena/' + battleId);
          }
        });

        // Timeout de seguridad en caso de que la suscripción tarde
        setTimeout(() => {
          window.location.assign('/arena/' + battleId);
        }, 1500);
      } else {
        throw new Error("Batalla no generada.");
      }
    } catch (err: any) {
      clearTimeout(timeoutId);
      setLoading(false);
      
      // 4. Modo Depuración - Mensajes claros
      if (err.name === 'AbortError') {
        setErrorMsg("Error: Tiempo de espera agotado.");
      } else {
        setErrorMsg("Error en transacción de saldo");
      }
      console.error("[Challenge] Error accepting:", err);

      // Auto-ocultar error
      setTimeout(() => setErrorMsg(""), 3000);
    }
  };

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
               {errorMsg && (
                 <p className="text-[#ff007a] text-[10px] font-bold mt-1 bg-[#ff007a]/10 py-0.5 px-2 rounded">{errorMsg}</p>
               )}
            </div>
         </div>
         <div className="flex gap-2 mt-4">
            <button 
              onClick={() => setChallenge(null)} 
              disabled={loading}
              className="flex-1 bg-gray-900 text-white py-2 rounded-xl text-[10px] font-bold disabled:opacity-50"
            >
              IGNORAR
            </button>
            <button 
               onClick={handleAccept}
               disabled={loading}
               className="flex-1 bg-[#ff007a] text-white py-2 rounded-xl text-[10px] font-black flex items-center justify-center transition-all disabled:opacity-70 disabled:scale-95"
            >
               {loading ? <Loader2 size={14} className="animate-spin" /> : "ACEPTAR"}
            </button>
         </div>
      </motion.div>
    </AnimatePresence>
  );
}
