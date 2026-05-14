"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Swords, X } from "lucide-react";
import { createClient } from "@/utils/supabase/client";

interface IncomingChallenge {
  id: string;
  challenger_id: string;
  challenger_username: string;
}

export function ChallengeNotification() {
  const supabase = useMemo(() => createClient(), []);
  const [mounted, setMounted] = useState(false);
  const [challenge, setChallenge] = useState<IncomingChallenge | null>(null);
  const [responding, setResponding] = useState(false);
  const [hidden, setHidden] = useState(false);
  const userIdRef = useRef<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    let isSubscribed = true;

    const setupRealtime = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !isSubscribed) return;
      userIdRef.current = user.id;

      // ⚡️ SUSCRIPCIÓN MAESTRA: Escucha la tabla de la base de datos directamente
      const channel = supabase
        .channel("global-sync")
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "challenges",
            filter: `challenged_id=eq.${user.id}`, // Solo escucha retos para MÍ
          },
          (payload:any) => {
            if (!isSubscribed) return;
            const newChallenge = payload.new;
            
            setChallenge({
              id: newChallenge.id,
              challenger_id: newChallenge.challenger_id,
              challenger_username: newChallenge.challenger_username || "Jugador",
            });
            setHidden(false);
          }
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "challenges",
            filter: `status=eq.accepted`,
          },
          (payload:any) => {
            const updated = payload.new;
            // Si yo soy el retador y aceptaron mi reto, me voy a la batalla
            if (updated.challenger_id === userIdRef.current && updated.battle_id) {
              setHidden(true);
              window.location.href = `/battle/${updated.battle_id}`;
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    };

    setupRealtime();

    return () => {
      isSubscribed = false;
    };
  }, [mounted, supabase]);

  const handleAccept = async () => {
    if (!challenge || responding) return;
    setResponding(true);
    setHidden(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user found");

      // 1. Crear la batalla
      const { data: battle, error: battleError } = await supabase
        .from("battles")
        .insert({ 
          player_a_id: challenge.challenger_id, 
          player_b_id: user.id, 
          is_active: true 
        })
        .select("id")
        .single();

      if (battleError || !battle) throw battleError;

      // 2. Actualizar el reto (Esto disparará el Realtime para el oponente)
      await supabase
        .from("challenges")
        .update({
          status: "accepted",
          battle_id: battle.id,
          resolved_at: new Date().toISOString(),
        })
        .eq("id", challenge.id);

      // 3. Ir a la batalla
      setChallenge(null);
      setResponding(false);
      window.location.href = `/battle/${battle.id}`;

    } catch (error) {
      console.error("Error al aceptar:", error);
      setResponding(false);
      setHidden(false);
    }
  };

  const handleDecline = async () => {
    if (!challenge || responding) return;
    setResponding(true);
    setHidden(true);

    await supabase
      .from("challenges")
      .update({ status: "declined", resolved_at: new Date().toISOString() })
      .eq("id", challenge.id);

    setChallenge(null);
    setResponding(false);
  };

  return (
    <AnimatePresence>
      {mounted && challenge && !hidden && (
        <motion.div
          initial={{ opacity: 0, y: -100, scale: 0.8 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -100, scale: 0.8 }}
          transition={{ type: "spring", damping: 20, stiffness: 300 }}
          className="fixed top-20 left-1/2 -translate-x-1/2 z-[200] w-[90vw] max-w-sm"
        >
          <div className="relative overflow-hidden rounded-3xl border-2 border-[#ff007a]/50 bg-black/90 backdrop-blur-xl shadow-[0_0_60px_rgba(255,0,122,0.3)]">
            <div className="absolute inset-0 rounded-3xl overflow-hidden pointer-events-none">
              <div className="absolute -inset-1 bg-gradient-to-r from-[#ff007a] via-[#00d1ff] to-[#ff007a] opacity-20 blur-sm animate-pulse" />
            </div>

            <div className="relative p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#ff007a] to-[#00d1ff] flex items-center justify-center">
                    <Swords size={20} className="text-white" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#ff007a]">¡RETO!</p>
                    <p className="text-sm font-bold text-white">
                      <span className="text-[#00d1ff]">@{challenge.challenger_username}</span> te ha retado
                    </p>
                  </div>
                </div>
                <button onClick={handleDecline} className="p-1.5 rounded-full hover:bg-white/10 transition-colors text-white/30">
                  <X size={16} />
                </button>
              </div>

              <p className="text-white/40 text-xs text-center">¿Aceptas el reto de batalla 1vs1?</p>

              <div className="grid grid-cols-2 gap-3">
                <button onClick={handleDecline} disabled={responding}
                  className="py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 rounded-2xl font-bold text-sm uppercase tracking-wider transition-all disabled:opacity-30">
                  NO
                </button>
                <button onClick={handleAccept} disabled={responding}
                  className="py-3 bg-gradient-to-r from-[#ff007a] to-[#00d1ff] text-white rounded-2xl font-black text-sm uppercase tracking-wider shadow-[0_0_20px_rgba(255,0,122,0.3)] hover:shadow-[0_0_30px_rgba(255,0,122,0.5)] transition-all disabled:opacity-30">
                  {responding ? "..." : "SÍ, ACEPTO"}
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
