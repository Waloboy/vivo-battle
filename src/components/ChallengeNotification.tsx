"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Swords, X, Wifi, WifiOff } from "lucide-react";
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

      const channel = supabase
        .channel("global-sync", {
          config: { broadcast: { self: false } },
        })
        .on(
          "broadcast",
          { event: "challenge" },
          (payload: any) => {
            if (!isSubscribed || !userIdRef.current) return;
            const p = payload.payload;
            
            if (p.challenged_id === userIdRef.current) {
              setChallenge({
                id: p.id,
                challenger_id: p.challenger_id,
                challenger_username: p.challenger_username || "Jugador",
              });
              setHidden(false);
            }
          }
        )
        .on(
          "broadcast",
          { event: "CHALLENGE_ACCEPTED" },
          (payload: any) => {
            if (!isSubscribed || !userIdRef.current) return;
            const p = payload.payload;
            if (p.challenger_id === userIdRef.current || p.challenged_id === userIdRef.current) {
              setHidden(true);
              window.location.href = `/battle/${p.battle_id}`;
            }
          }
        )
        .subscribe();

      return () => {
        channel.unsubscribe().then(() => supabase.removeChannel(channel));
      };
    };

    const cleanup = setupRealtime();

    return () => {
      isSubscribed = false;
      cleanup.then(cleanupFn => {
        if (cleanupFn) cleanupFn();
      });
    };
  }, [mounted, supabase]);

  const handleAccept = async () => {
    if (!challenge || responding) return;
    setResponding(true);
    setHidden(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setHidden(false); setResponding(false); return; }

    const { data: battle, error: battleError } = await supabase
      .from("battles")
      .insert({ player_a_id: challenge.challenger_id, player_b_id: user.id, is_active: true })
      .select("id")
      .single();

    if (battleError || !battle) {
      console.error("Error creating battle:", battleError);
      setResponding(false);
      setHidden(false);
      return;
    }

    // ⚡ Broadcast acceptance FIRST — fastest path for challenger
    let channel = supabase.getChannels().find((c: any) => c.topic === "realtime:global-sync");
    let needsUnsubscribe = false;
    if (!channel) {
      channel = supabase.channel("global-sync");
      channel.subscribe();
      needsUnsubscribe = true;
    }
    channel.send({
      type: "broadcast",
      event: "CHALLENGE_ACCEPTED",
      payload: { battle_id: battle.id, challenger_id: challenge.challenger_id, challenged_id: user.id },
    }).catch(() => {});
    
    if (needsUnsubscribe) {
      channel.unsubscribe().then(() => supabase.removeChannel(channel!));
    }

    // Hard navigate — bypasses React hydration delays
    setChallenge(null);
    setResponding(false);
    window.location.href = `/battle/${battle.id}`;

    // Fire-and-forget: update challenge status in DB
    supabase
      .from("challenges")
      .update({
        status: "accepted",
        battle_id: battle.id,
        resolved_at: new Date().toISOString(),
        challenger_id: challenge.challenger_id,
        challenged_id: user.id,
      })
      .eq("id", challenge.id)
      .then(() => {});
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
                <button onClick={handleDecline} className="p-1.5 rounded-full hover:bg-white/10 transition-colors text-white/30">
                  <X size={16} />
                </button>
              </div>

              <p className="text-white/40 text-xs text-center">¿Aceptas el reto de batalla 1vs1?</p>

              {/* Actions */}
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
