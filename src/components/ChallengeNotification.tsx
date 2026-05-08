"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Swords, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

interface IncomingChallenge {
  id: string;
  challenger_id: string;
  challenger_username: string;
}

export function ChallengeNotification() {
  const router = useRouter();
  const [challenge, setChallenge] = useState<IncomingChallenge | null>(null);
  const [responding, setResponding] = useState(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    // ... existing logic ...
    let userId: string | null = null;

    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      userId = user.id;

      const { data: pending } = await supabase
        .from("challenges")
        .select("id, challenger_id, profiles!challenges_challenger_id_fkey(username)")
        .eq("challenged_id", user.id)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(1);

      if (pending && pending.length > 0) {
        const c = pending[0];
        setChallenge({
          id: c.id,
          challenger_id: c.challenger_id,
          challenger_username: (c as any).profiles?.username || "???",
        });
        setHidden(false);
      }
    })();

    const channel = supabase
      .channel("challenge-notifications")
      .on("system", { event: "reconnect" }, () => console.log("Reconnected to challenge notifications"))
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "challenges" },
        async (payload) => {
          if (!userId) return;
          if (payload.new.challenged_id === userId && payload.new.status === "pending") {
            const { data: prof } = await supabase
              .from("profiles")
              .select("username")
              .eq("id", payload.new.challenger_id)
              .single();

            setChallenge({
              id: payload.new.id,
              challenger_id: payload.new.challenger_id,
              challenger_username: prof?.username || "???",
            });
            setHidden(false);
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "challenges" },
        (payload) => {
          if (!userId) return;
          if (payload.new.challenger_id === userId && payload.new.status === "accepted" && payload.new.battle_id) {
            setHidden(true);
            router.push(`/battle/${payload.new.battle_id}`);
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "battles" },
        (payload) => {
          if (!userId) return;
          if (payload.new.player_a_id === userId || payload.new.player_b_id === userId) {
            setHidden(true);
            router.push(`/battle/${payload.new.id}`);
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [supabase]);

  const handleAccept = async () => {
    if (!challenge || responding) return;
    setResponding(true);
    setHidden(true); // Cierra la notificación inmediatamente en la UI local

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setHidden(false);
      return;
    }

    const { data: battle, error: battleError } = await supabase
      .from("battles")
      .insert({
        player_a_id: challenge.challenger_id,
        player_b_id: user.id,
        is_active: true,
      })
      .select("id")
      .single();

    if (battleError || !battle) {
      console.error("Error creating battle:", battleError);
      setResponding(false);
      setHidden(false);
      return;
    }

    const { error: updateError } = await supabase
      .from("challenges")
      .update({ 
        status: "accepted", 
        battle_id: battle.id, 
        resolved_at: new Date().toISOString(),
        challenger_id: challenge.challenger_id,
        challenged_id: user.id
      })
      .eq("id", challenge.id);
      
    if (updateError) {
      console.error("Error updating challenge:", updateError);
    }

    setChallenge(null);
    setResponding(false);

    router.push(`/battle/${battle.id}`);
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
      {challenge && !hidden && (
        <motion.div
          initial={{ opacity: 0, y: -100, scale: 0.8 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -100, scale: 0.8 }}
          transition={{ type: "spring", damping: 20, stiffness: 300 }}
          className="fixed top-20 left-1/2 -translate-x-1/2 z-[200] w-[90vw] max-w-sm"
        >
          <div className="relative overflow-hidden rounded-3xl border-2 border-[#ff007a]/50 bg-black/90 backdrop-blur-xl shadow-[0_0_60px_rgba(255,0,122,0.3)]">
            {/* Animated glow border */}
            <div className="absolute inset-0 rounded-3xl overflow-hidden pointer-events-none">
              <div className="absolute -inset-1 bg-gradient-to-r from-[#ff007a] via-[#00d1ff] to-[#ff007a] opacity-20 blur-sm animate-pulse" />
            </div>

            <div className="relative p-6 space-y-4">
              {/* Header */}
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
                <button
                  onClick={handleDecline}
                  className="p-1.5 rounded-full hover:bg-white/10 transition-colors text-white/30"
                >
                  <X size={16} />
                </button>
              </div>

              <p className="text-white/40 text-xs text-center">¿Aceptas el reto de batalla 1vs1?</p>

              {/* Actions */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={handleDecline}
                  disabled={responding}
                  className="py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 rounded-2xl font-bold text-sm uppercase tracking-wider transition-all disabled:opacity-30"
                >
                  NO
                </button>
                <button
                  onClick={handleAccept}
                  disabled={responding}
                  className="py-3 bg-gradient-to-r from-[#ff007a] to-[#00d1ff] text-white rounded-2xl font-black text-sm uppercase tracking-wider shadow-[0_0_20px_rgba(255,0,122,0.3)] hover:shadow-[0_0_30px_rgba(255,0,122,0.5)] transition-all disabled:opacity-30"
                >
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
