"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Swords, X, Wifi, WifiOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

interface IncomingChallenge {
  id: string;
  challenger_id: string;
  challenger_username: string;
}

export function ChallengeNotification() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [challenge, setChallenge] = useState<IncomingChallenge | null>(null);
  const [responding, setResponding] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [channelStatus, setChannelStatus] = useState<string>("connecting");
  const userIdRef = useRef<string | null>(null);
  const channelRef = useRef<any>(null);

  const [wakeCount, setWakeCount] = useState(0);

  useEffect(() => {
    let mounted = true;

    const setupRealtime = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !mounted) return;
      userIdRef.current = user.id;

      // Check for pending challenges on load
      const { data: pending } = await supabase
        .from("challenges")
        .select("id, challenger_id, profiles!challenges_challenger_id_fkey(username)")
        .eq("challenged_id", user.id)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(1);

      if (mounted && pending && pending.length > 0) {
        const c = pending[0];
        setChallenge({
          id: c.id,
          challenger_id: c.challenger_id,
          challenger_username: (c as any).profiles?.username || "???",
        });
        setHidden(false);
      }

      // Remove any existing channel before creating new one
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }

      const channel = supabase
        .channel("global-challenge-listener", {
          config: { broadcast: { self: false } },
        })
        .on(
          "broadcast",
          { event: "CHALLENGE_RECEIVED" },
          async (payload: any) => {
            if (!mounted || !userIdRef.current) return;
            const p = payload.payload;
            
            // Only show if the broadcast challenge is meant for us
            if (p.challenged_id === userIdRef.current) {
              // Fetch username for UI
              const { data: prof } = (await supabase
                .from("profiles")
                .select("username")
                .eq("id", p.challenger_id)
                .single()) as { data: { username: string } | null };

              setChallenge({
                id: p.id,
                challenger_id: p.challenger_id,
                challenger_username: prof?.username || "???",
              });
              setHidden(false);
            }
          }
        )
        // ⚡ BROADCAST HANDSHAKE: fastest path — both clients get this before DB
        .on(
          "broadcast",
          { event: "CHALLENGE_ACCEPTED" },
          (payload: any) => {
            if (!mounted || !userIdRef.current) return;
            const p = payload.payload;
            if (p.challenger_id === userIdRef.current || p.challenged_id === userIdRef.current) {
              console.log("[ChallengeNotification] ⚡ Broadcast ACCEPTED, redirecting...");
              setHidden(true);
              window.location.href = `/battle/${p.battle_id}`;
            }
          }
        )
        // Keep DB fallback just in case we miss the broadcast (e.g., page refresh)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "challenges",
            filter: `challenged_id=eq.${user.id}`,
          },
          async (payload: any) => {
            if (!mounted || !userIdRef.current) return;
            // Only handle if not already active to avoid duplicates
            if (payload.new.status === "pending") {
              // If we already have a challenge modal open, don't override it immediately
              setChallenge(prev => {
                if (prev && prev.id === payload.new.id) return prev; // Already showing
                
                // Fetch and set in background
                supabase.from("profiles").select("username").eq("id", payload.new.challenger_id).single()
                  .then(({ data: prof }: { data: { username: string } | null }) => {
                    if (mounted) {

                      setChallenge({
                        id: payload.new.id,
                        challenger_id: payload.new.challenger_id,
                        challenger_username: prof?.username || "???",
                      });
                      setHidden(false);
                    }
                  });
                return prev;
              });
            }
          }
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "challenges",
            filter: `challenger_id=eq.${user.id}`,
          },
          (payload: any) => {
            if (!mounted || !userIdRef.current) return;
            if (payload.new.status === "accepted" && payload.new.battle_id) {
              setHidden(true);
              // Hard navigate — bypasses React hydration delays
              window.location.assign(`/battle/${payload.new.battle_id}`);
            }
          }
        )
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "battles" },
          (payload: any) => {
            if (!mounted || !userIdRef.current) return;
            if (
              payload.new.player_a_id === userIdRef.current ||
              payload.new.player_b_id === userIdRef.current
            ) {
              setHidden(true);
              window.location.assign(`/battle/${payload.new.id}`);
            }
          }
        )
        .subscribe((status: string, err?: Error) => {
          if (!mounted) return;
          setChannelStatus(status === "SUBSCRIBED" ? "connected" : status);
          if (err) console.error("[ChallengeNotification] Channel error:", err);
        });

      channelRef.current = channel;
    };

    setupRealtime();

    // Resilience: ALWAYS re-subscribe on focus + force WS reconnect
    const handleVisibility = () => {
      if (document.hidden) return;
      // Force Supabase Realtime WS reconnect if it dropped
      try { (supabase as any).realtime?.connect(); } catch (_) {}

      if (channelRef.current) {
        const state = (channelRef.current as any).state;
        if (state !== "joined") {
          console.log(`[ChallengeNotification] Channel state='${state}', forcing re-subscribe...`);
          setWakeCount(c => c + 1);
        } else {
          channelRef.current.subscribe();
        }
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("focus", handleVisibility);

    // ── POLLING FALLBACK: if WS is dead, "look" manually every 3s ──
    const pollInterval = setInterval(async () => {
      if (!userIdRef.current) return;
      // Skip polling if channel is alive
      const chState = (channelRef.current as any)?.state;
      if (chState === "joined") return;

      console.log("[ChallengeNotification] WS down, polling fallback...");
      try {
        // Check for pending challenges
        const { data: pending } = await supabase
          .from("challenges")
          .select("id, challenger_id, status, battle_id, profiles!challenges_challenger_id_fkey(username)")
          .eq("challenged_id", userIdRef.current)
          .eq("status", "pending")
          .order("created_at", { ascending: false })
          .limit(1);

        if (pending && pending.length > 0 && mounted) {
          const c = pending[0];
          setChallenge(prev => {
            if (prev?.id === c.id) return prev;
            return {
              id: c.id,
              challenger_id: c.challenger_id,
              challenger_username: (c as any).profiles?.username || "???",
            };
          });
          setHidden(false);
        }

        // Check if any of MY challenges got accepted (challenger redirect)
        const { data: accepted } = await supabase
          .from("challenges")
          .select("id, battle_id")
          .eq("challenger_id", userIdRef.current)
          .eq("status", "accepted")
          .order("resolved_at", { ascending: false })
          .limit(1);

        if (accepted && accepted.length > 0 && accepted[0].battle_id && mounted) {
          window.location.href = `/battle/${accepted[0].battle_id}`;
        }
      } catch (_) {}
    }, 3000);

    return () => {
      mounted = false;
      clearInterval(pollInterval);
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("focus", handleVisibility);
    };
  }, [supabase, router, wakeCount]);

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
    supabase.channel("global-challenge-listener").send({
      type: "broadcast",
      event: "CHALLENGE_ACCEPTED",
      payload: { battle_id: battle.id, challenger_id: challenge.challenger_id, challenged_id: user.id },
    }).catch(() => {});

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
