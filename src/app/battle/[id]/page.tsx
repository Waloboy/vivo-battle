"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { setLogLevel } from "livekit-client";

setLogLevel("debug");
import { motion, AnimatePresence } from "framer-motion";
import { Send, Wallet, Gift, X, Heart, Mic, MicOff, RefreshCw, Trophy, Swords } from "lucide-react";
import confetti from "canvas-confetti";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { GIFT_CATALOG, type GiftKey } from "../gifts";
import { useAnimatedCount } from "../useAnimatedCount";
import { getUserBalance, getWalletCredits } from "@/utils/balance";
import { fmtWCR, fmtBCR } from "@/utils/format";

import { LiveKitRoom, VideoTrack, useTracks, useLocalParticipant, useParticipants } from '@livekit/components-react';
import { Track } from 'livekit-client';
import '@livekit/components-styles';

interface FloatTap { id: number; x: number; y: number }
const BATTLE_DURATION = 320; // 2:00 prep + 3:00 battle + 20s farewell
type BattlePhase = "PREPARING" | "BATTLE" | "ENDING" | "FINISHED";

interface Profile {
  id: string;
  username: string;
  avatar_url?: string;
  wallet_credits?: number;
  battle_credits?: number;
}

const fmtTime = (s: number) => {
  if (s < 0) return "0:00";
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
};

// --- LiveKit Video Component ---
import { useConnectionState, useRoomContext } from '@livekit/components-react';

function RoomWatcher({ playerA, playerB, onBothConnected }: { playerA?: string, playerB?: string, onBothConnected: (ready: boolean) => void }) {
  const participants = useParticipants();
  const connectionState = useConnectionState();

  useEffect(() => {
    if (connectionState !== "connected") {
      onBothConnected(false);
      return;
    }
    const a = participants.find(p => p.identity === playerA);
    const b = participants.find(p => p.identity === playerB);
    onBothConnected(!!a && !!b);
  }, [participants, connectionState, playerA, playerB, onBothConnected]);
  return null;
}

interface BattleVideoProps {
  expectedUsername: string;
  phase: BattlePhase;
  playerA: Profile | null;
  playerB: Profile | null;
  displayTime: number;
  isCountdown: boolean;
}

function BattleVideo({ expectedUsername, phase, playerA, playerB, displayTime, isCountdown }: BattleVideoProps) {
  const tracks = useTracks([{ source: Track.Source.Camera, withPlaceholder: false }]);
  const trackRef = tracks.find(t => t.participant.identity === expectedUsername);
  const isCameraEnabled = phase !== "PREPARING";

  // Debug LiveKit connection state
  const connectionState = useConnectionState();
  useEffect(() => {
    console.log(`LiveKit Connection State for ${expectedUsername || 'Unknown'}:`, connectionState);
  }, [connectionState, expectedUsername]);

  return (
    <div className="absolute inset-0 z-[0] overflow-hidden pointer-events-none">
      {trackRef && isCameraEnabled ? (
        <VideoTrack trackRef={trackRef as any} className="w-full h-full object-cover scale-[1.02]" />
      ) : (
        <div className="w-full h-full bg-[#0d0008] flex items-center justify-center">
          <span className="text-white/30 text-xs">Esperando cámara...</span>
        </div>
      )}
      
      {phase === "PREPARING" && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-[4px] flex flex-col items-center justify-center z-[10]">
          {/* Waiting for connection overlay inside PREPARING if not bothConnected */}
          {!playerA?.username || !playerB?.username ? (
            <div className="flex flex-col items-center gap-4">
              <div className="relative">
                <div className="w-16 h-16 border-4 border-white/10 border-t-[#00d1ff] rounded-full animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Swords className="text-white/40" size={24} />
                </div>
              </div>
              <span className="text-white/60 font-black tracking-[0.2em] text-[10px] uppercase animate-pulse">ESTABLECIENDO CONEXIÓN SEGURA...</span>
            </div>
          ) : (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center gap-6"
            >
              <div className="flex items-center gap-8 mb-4">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-20 h-20 rounded-full border-2 border-[#00d1ff] p-1">
                    <div className="w-full h-full rounded-full bg-white/5 flex items-center justify-center overflow-hidden">
                      {playerA?.avatar_url ? <img src={playerA.avatar_url} className="w-full h-full object-cover" /> : <div className="text-[#00d1ff] font-bold">A</div>}
                    </div>
                  </div>
                  <span className="text-white font-black text-sm tracking-widest uppercase">@{playerA?.username}</span>
                </div>
                <div className="text-white/20 text-3xl font-black italic">VS</div>
                <div className="flex flex-col items-center gap-3">
                  <div className="w-20 h-20 rounded-full border-2 border-[#ff007a] p-1">
                    <div className="w-full h-full rounded-full bg-white/5 flex items-center justify-center overflow-hidden">
                      {playerB?.avatar_url ? <img src={playerB.avatar_url} className="w-full h-full object-cover" /> : <div className="text-[#ff007a] font-bold">B</div>}
                    </div>
                  </div>
                  <span className="text-white font-black text-sm tracking-widest uppercase">@{playerB?.username}</span>
                </div>
              </div>
              
              <div className="text-center space-y-1">
                <span className="text-[#00d1ff] font-black tracking-[0.3em] text-xs uppercase animate-pulse">Esperando público...</span>
                <h2 className="text-4xl md:text-6xl font-black text-white italic tracking-tighter drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]">
                  PREPARANDO <span className="text-[#ff007a]">BATALLA</span>
                </h2>
              </div>

              <div className="mt-4 flex flex-col items-center gap-2">
                <div className="text-white/40 text-sm font-medium">Inicia en</div>
                <div className="text-5xl font-black text-white font-mono">{fmtTime(displayTime)}</div>
              </div>
            </motion.div>
          )}
        </div>
      )}

      {/* Giant Countdown (Last 10s of Prep) */}
      <AnimatePresence>
        {isCountdown && (
          <motion.div 
            key={displayTime}
            initial={{ scale: 2, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.5, opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center z-[50] pointer-events-none"
          >
            <span className="text-[15rem] md:text-[25rem] font-black text-white italic drop-shadow-[0_0_30px_rgba(255,0,122,0.8)]">
              {displayTime}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Battle Start Animation */}
      <AnimatePresence>
        {phase === "BATTLE" && displayTime >= 178 && (
          <motion.div 
            initial={{ scale: 0, rotate: -20, opacity: 0 }}
            animate={{ scale: [0, 1.5, 1], rotate: 0, opacity: 1 }}
            className="absolute inset-0 flex items-center justify-center z-[60] pointer-events-none"
          >
            <div className="bg-[#ff007a] px-12 py-4 skew-x-[-12deg] border-4 border-white shadow-[0_0_50px_#ff007a]">
              <span className="text-7xl md:text-9xl font-black text-white italic tracking-tighter">¡BATALLA!</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// --- LiveKit Local Controls (Mute & Flip Camera) ---
function LocalControls({ phase }: { phase: BattlePhase }) {
  const isWarmup = phase === "PREPARING";
  const { localParticipant } = useLocalParticipant();
  const [isMuted, setIsMuted] = useState(false);
  const [facingMode, setFacingMode] = useState<"user"|"environment">("user");

  useEffect(() => {
    if (localParticipant) {
      const shouldCamera = phase !== "PREPARING";
      localParticipant.setCameraEnabled(shouldCamera, { facingMode: "user" }).catch(e => console.error("Auto camera error:", e));
      localParticipant.setMicrophoneEnabled(true).catch(e => console.error("Auto mic error:", e));
    }
  }, [localParticipant, phase]);

  if (isWarmup || !localParticipant) return null;

  const toggleMute = async () => {
    if (isMuted) {
      await localParticipant.setMicrophoneEnabled(true);
      setIsMuted(false);
    } else {
      await localParticipant.setMicrophoneEnabled(false);
      setIsMuted(true);
    }
  };

  const flipCamera = async () => {
    const newMode = facingMode === "user" ? "environment" : "user";
    await localParticipant.setCameraEnabled(false);
    await localParticipant.setCameraEnabled(true, { facingMode: newMode });
    setFacingMode(newMode);
  };

  return (
    <div className="absolute bottom-4 right-4 z-50 flex flex-col gap-3">
      <button onClick={toggleMute} className="w-10 h-10 rounded-full bg-black/60 backdrop-blur border border-white/20 flex items-center justify-center text-white hover:bg-black/80 transition-colors">
        {isMuted ? <MicOff size={18} className="text-red-400" /> : <Mic size={18} />}
      </button>
      <button onClick={flipCamera} className="w-10 h-10 rounded-full bg-black/60 backdrop-blur border border-white/20 flex items-center justify-center text-white hover:bg-black/80 transition-colors">
        <RefreshCw size={18} />
      </button>
    </div>
  );
}


export default function BattleView({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params);
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [balance, setBalance] = useState(0);
  
  const [battleData, setBattleData] = useState<any>(null);
  const [playerA, setPlayerA] = useState<Profile | null>(null);
  const [playerB, setPlayerB] = useState<Profile | null>(null);
  const [mySide, setMySide] = useState<"A" | "B" | "Audience">("Audience");
  
  const [rematchA, setRematchA] = useState(false);
  const [rematchB, setRematchB] = useState(false);

  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [showGiftSheet, setShowGiftSheet] = useState(false);
  const [selectedGiftKey, setSelectedGiftKey] = useState<GiftKey | null>(null);
  const [shaking, setShaking] = useState(false);
  const [glowA, setGlowA] = useState(false);
  const [glowB, setGlowB] = useState(false);
  const [isFinishedLocally, setIsFinishedLocally] = useState(false);
  const messagesEnd = useRef<HTMLDivElement>(null);
  const [takeover, setTakeover] = useState<{ username: string; label: string; color: string } | null>(null);
  const [rawA, setRawA] = useState(0);
  const [rawB, setRawB] = useState(0);
  const displayA = useAnimatedCount(rawA);
  const displayB = useAnimatedCount(rawB);
  const total = (rawA + rawB) || 1;
  const [timeLeft, setTimeLeft] = useState(BATTLE_DURATION);
  const [tapsA, setTapsA] = useState<FloatTap[]>([]);
  const [tapsB, setTapsB] = useState<FloatTap[]>([]);

  const [livekitToken, setLivekitToken] = useState("");
  const [bothConnected, setBothConnected] = useState(false);
  const [hasBroadcastedStart, setHasBroadcastedStart] = useState(false);
  const [hasSettledPoints, setHasSettledPoints] = useState(false);

  // Batching logic for performance
  const pendingScoreA = useRef(0);
  const pendingScoreB = useRef(0);
  const lastTapSound = useRef(0);

  const phase: BattlePhase = !bothConnected || timeLeft > 200 ? "PREPARING" : 
                (timeLeft > 20 ? "BATTLE" : 
                 timeLeft > 0 ? "ENDING" : "FINISHED");

  const displayTime = phase === "PREPARING" ? Math.max(0, timeLeft - 200) : 
                      (phase === "BATTLE" ? timeLeft - 20 : 
                       phase === "ENDING" ? timeLeft : 0);

  const isUrgent = phase === "BATTLE" && displayTime <= 30;
  const isCountdown = phase === "PREPARING" && displayTime <= 10;

  const calculateTimeLeft = (startIso: string) => {
    const start = new Date(startIso).getTime();
    const elapsed = Math.floor((Date.now() - start) / 1000);
    return BATTLE_DURATION - elapsed;
  };

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUser(user);
      
      const { data: p } = await supabase.from("profiles").select("username").eq("id", user.id).single();
      if (p) setProfile(p);
      
      const b = await getUserBalance(user.id);
      setBalance(b);

      const { data: battle } = await supabase.from("battles").select("*").eq("id", id).single();
      if (battle) {
        setBattleData(battle);
        setRawA(battle.score_a || 0);
        setRawB(battle.score_b || 0);
        
        if (user.id === battle.player_a_id) setMySide("A");
        else if (user.id === battle.player_b_id) setMySide("B");
        else setMySide("Audience");

        const { data: profs } = await supabase.from("profiles").select("id, username, avatar_url").in("id", [battle.player_a_id, battle.player_b_id]);
        if (profs) {
          setPlayerA(profs.find((pr: any) => pr.id === battle.player_a_id));
          setPlayerB(profs.find((pr: any) => pr.id === battle.player_b_id));
        }

        setTimeLeft(calculateTimeLeft(battle.started_at));
      }
    })();

    const ch = supabase.channel(`battle-${id}`)
      .on("broadcast", { event: "chat" }, ({ payload }: { payload: any }) => setMessages(p => [...p, payload]))
      .on("broadcast", { event: "score" }, ({ payload }: { payload: any }) => {
        if (payload.side === "A") setRawA(p => p + payload.amount);
        else setRawB(p => p + payload.amount);
      })
      .on("broadcast", { event: "rematch_request" }, ({ payload }: { payload: any }) => {
         if (payload.side === "A") setRematchA(true);
         if (payload.side === "B") setRematchB(true);
      })
      .on("broadcast", { event: "rematch_accepted" }, ({ payload }: { payload: any }) => {
         setBattleData((prev: any) => ({ ...prev, started_at: payload.started_at }));
         setRawA(0);
         setRawB(0);
         setRematchA(false);
         setRematchB(false);
         setIsFinishedLocally(false);
         setHasSettledPoints(false);
         setTimeLeft(calculateTimeLeft(payload.started_at));
      })
      .on("broadcast", { event: "battle_start" }, ({ payload }: { payload: any }) => {
         setBattleData((prev: any) => ({ ...prev, started_at: payload.started_at }));
         setTimeLeft(calculateTimeLeft(payload.started_at));
      })
      // Synchronized exit: opponent left or rejected rematch
      .on("broadcast", { event: "battle_exit" }, () => {
         router.push("/dashboard");
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "battles", filter: `id=eq.${id}` }, (payload: any) => {
         if (payload.new.started_at) {
           setBattleData((prev: any) => ({ ...prev, started_at: payload.new.started_at }));
           setTimeLeft(calculateTimeLeft(payload.new.started_at));
         }
      })
      .subscribe();
      
    return () => { supabase.removeChannel(ch); };
  }, [id, supabase, router]);

  // Generate LiveKit Token
  useEffect(() => {
    if (!profile || !id || !battleData) return;
    (async () => {
      const role = mySide === "Audience" ? "Audience" : "Publisher";
      const res = await fetch(`/api/livekit/token?room=${id}&username=${profile.username}&role=${role}`);
      const data = await res.json();
      if (data.token) setLivekitToken(data.token);
    })();
  }, [profile, id, battleData, mySide]);

  // Batch interval for score syncing
  useEffect(() => {
    const syncInterval = setInterval(() => {
      if (pendingScoreA.current > 0) {
        supabase.channel(`battle-${id}`).send({ type: "broadcast", event: "score", payload: { side: "A", amount: pendingScoreA.current } });
        pendingScoreA.current = 0;
      }
      if (pendingScoreB.current > 0) {
        supabase.channel(`battle-${id}`).send({ type: "broadcast", event: "score", payload: { side: "B", amount: pendingScoreB.current } });
        pendingScoreB.current = 0;
      }
    }, 500);
    return () => clearInterval(syncInterval);
  }, [id, supabase]);

  // Master Timer
  useEffect(() => {
    if (!battleData?.started_at || !bothConnected) return;
    const t = setInterval(() => {
      setTimeLeft(calculateTimeLeft(battleData.started_at));
    }, 1000);
    return () => clearInterval(t);
  }, [battleData?.started_at, bothConnected]);

  // Sync True Start Time
  useEffect(() => {
    if (bothConnected && mySide === "A" && !hasBroadcastedStart) {
       setHasBroadcastedStart(true);
       const newStart = new Date().toISOString();
       supabase.from('battles').update({ started_at: newStart }).eq('id', id).then();
       supabase.channel(`battle-${id}`).send({ type: "broadcast", event: "battle_start", payload: { started_at: newStart } });
    }
  }, [bothConnected, mySide, hasBroadcastedStart, id]);

  // Finished Logic + Point Settlement
  useEffect(() => {
    // Battle ended -> Enter Ending & Settle points
    if (phase === "ENDING" && !isFinishedLocally) {
      setIsFinishedLocally(true);
      playSound("win");
      confetti({ 
        particleCount: 250, spread: 100, origin: { y: 0.6 },
        colors: ["#ff007a", "#00d1ff"], gravity: 0.8, scalar: 1.2
      });

      // Point Settlement: Player A is the authority that writes results
      if (mySide === "A" && !hasSettledPoints) {
        setHasSettledPoints(true);
        (async () => {
          try {
            const winnerId = rawA > rawB ? battleData?.player_a_id : rawB > rawA ? battleData?.player_b_id : null;
            const loserId = rawA > rawB ? battleData?.player_b_id : rawB > rawA ? battleData?.player_a_id : null;
            const totalPoints = rawA + rawB;

            // AGGRESSIVE AUTO-CLOSE: mark battle as finished IMMEDIATELY
            await supabase.from("battles").update({
              score_a: rawA, score_b: rawB,
              is_active: false,
            }).eq("id", id);

            if (winnerId) {
              const { data: winnerProfile } = await supabase.from("profiles").select("total_earned, wins, battle_credits").eq("id", winnerId).single();
              if (winnerProfile) {
                await supabase.from("profiles").update({
                  total_earned: (winnerProfile.total_earned || 0) + totalPoints,
                  wins: (winnerProfile.wins || 0) + 1,
                  battle_credits: (winnerProfile.battle_credits || 0) + totalPoints,
                }).eq("id", winnerId);
              }
              // Battle win → goes to battle_credits (BCR)
              const opponentId = winnerId === battleData?.player_a_id ? battleData?.player_b_id : battleData?.player_a_id;
              const { data: opponentProf } = await supabase.from("profiles").select("username").eq("id", opponentId).single();
              await supabase.from("transactions").insert({
                user_id: winnerId,
                type: "BATTLE_WIN",
                amount_credits: totalPoints,
                amount_bs: 0,
                status: "approved",
                reference_number: `BATALLA GANADA vs @${opponentProf?.username || 'rival'}`,
                opponent_id: opponentId,
                battle_id: id,
              });
            }
            if (loserId) {
              const { data: loserProfile } = await supabase.from("profiles").select("losses").eq("id", loserId).single();
              if (loserProfile) {
                await supabase.from("profiles").update({
                  losses: (loserProfile.losses || 0) + 1,
                }).eq("id", loserId);
              }
            }
            if (!winnerId && !loserId) {
              for (const pid of [battleData?.player_a_id, battleData?.player_b_id]) {
                if (!pid) continue;
                const { data: p } = await supabase.from("profiles").select("draws").eq("id", pid).single();
                if (p) await supabase.from("profiles").update({ draws: (p.draws || 0) + 1 }).eq("id", pid);
              }
            }
            console.log(`[Battle] ✅ Settled & closed: winner=${winnerId}, total=${totalPoints}`);
          } catch (err) {
            console.error("[Battle] Point settlement error:", err);
          }
        })();
      }
    }

    if (timeLeft <= 0) {
      if (mySide === "A") {
        supabase.from("battles").update({ is_active: false }).eq("id", id).then(() => {
           router.push("/dashboard");
        });
      } else {
        router.push("/dashboard");
      }
    }
  }, [phase, timeLeft, isFinishedLocally, hasSettledPoints, mySide, id, router, supabase, rawA, rawB, battleData]);

  // Rematch Acceptance Logic
  useEffect(() => {
    if (rematchA && rematchB && mySide === "A") {
      (async () => {
        const newStart = new Date().toISOString();
        await supabase.from("battles").update({ score_a: 0, score_b: 0, started_at: newStart }).eq("id", id);
        await supabase.channel(`battle-${id}`).send({ type: "broadcast", event: "rematch_accepted", payload: { started_at: newStart } });
      })();
    }
  }, [rematchA, rematchB, mySide, id, supabase]);

  useEffect(() => {
    const el = messagesEnd.current?.parentElement;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
    if (atBottom) messagesEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);


  const playSound = (type: "tap" | "gift" | "win") => {
    if (type === "tap") {
      const now = Date.now();
      if (now - lastTapSound.current < 80) return; // limit to roughly 12 taps per second
      lastTapSound.current = now;
    }
    const urls = {
      tap: "https://cdn.pixabay.com/audio/2022/03/15/audio_c8c8a73467.mp3",
      gift: "https://cdn.pixabay.com/audio/2021/08/04/audio_0625c13396.mp3",
      win: "https://cdn.pixabay.com/audio/2021/08/04/audio_12b7441589.mp3"
    };
    const audio = new Audio(urls[type]);
    audio.volume = type === "win" ? 0.6 : 0.4;
    audio.play().catch(() => {});
  };

  const handleTap = (side: "A" | "B", e: React.MouseEvent) => {
    if (phase !== "BATTLE") return; 
    playSound("tap");
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    const tap: FloatTap = { id: Date.now() + Math.random(), x, y };
    
    if (side === "A") { 
      setTapsA(p => [...p.slice(-7), tap]); 
      setRawA(p => p + 1);
      pendingScoreA.current += 1;
    } else { 
      setTapsB(p => [...p.slice(-7), tap]); 
      setRawB(p => p + 1);
      pendingScoreB.current += 1;
    }
  };

  const triggerShake = (intensity: number, dur: number) => { setShaking(true); setTimeout(() => setShaking(false), dur); };
  const flashGlow = (side: "A" | "B") => { if (side === "A") { setGlowA(true); setTimeout(() => setGlowA(false), 1200); } else { setGlowB(true); setTimeout(() => setGlowB(false), 1200); } };
  const fireSupremeConfetti = () => {
    const colors = ["#ff007a", "#00d1ff", "#ffd700"];
    for (let i = 0; i < 3; i++) setTimeout(() => confetti({ particleCount: 150, spread: 100 + i * 20, origin: { y: 0.45 - i * 0.1 }, colors, gravity: 0.8, scalar: 1.2 }), i * 250);
  };

  const sendGift = async (side: "A" | "B", giftKey: GiftKey) => {
    if (!profile || !user || isSending || phase !== "BATTLE") return;
    const gift = GIFT_CATALOG.find(g => g.key === giftKey)!;
    try {
      // Gifts deduct from wallet_credits (WCR) only
      const walletBal = await getWalletCredits(user.id);
      if (walletBal < gift.cost) { alert(`Saldo WCR insuficiente. Necesitas ${fmtWCR(gift.cost)} en tu billetera (depósitos).`); return; }
      setIsSending(true);
      playSound("gift");
      const { error: txError } = await supabase.from("transactions").insert({ user_id: user.id, type: "GIFT_SENT", amount_credits: -gift.cost, amount_bs: 0, reference_number: `Envío Regalo: ${gift.label} a ${side}`, status: "approved" });
      if (txError) throw txError;

      // Update source of truth: profiles.wallet_credits
      await supabase.from("profiles").update({
        wallet_credits: Math.max(0, (profile.wallet_credits || 0) - gift.cost)
      }).eq("id", user.id);
      const b = await getUserBalance(user.id);
      setBalance(b);
      if (gift.tier === 3) { fireSupremeConfetti(); triggerShake(8, 1000); flashGlow(side); setTakeover({ username: profile.username, label: gift.label, color: gift.color }); setTimeout(() => setTakeover(null), 3000); } 
      else flashGlow(side);
      
      if (side === "A") { setRawA(p => p + gift.cost); pendingScoreA.current += gift.cost; }
      else { setRawB(p => p + gift.cost); pendingScoreB.current += gift.cost; }
      
      const msg = { id: Date.now(), username: profile.username, text: `sent ${gift.label} (${fmtWCR(gift.cost)})`, isGift: true, color: gift.color, tier: gift.tier };
      await supabase.channel(`battle-${id}`).send({ type: "broadcast", event: "chat", payload: msg });
      setMessages(p => [...p, msg]);
      await new Promise(r => setTimeout(r, 600));
    } catch (error: any) { console.error("Gift error:", error); alert("Error: " + (error.message || "Unknown")); } finally { setIsSending(false); }
  };

  const sendMsg = async () => {
    if (!newMessage.trim() || !profile) return;
    const msg = { id: Date.now(), username: profile.username, text: newMessage, isGift: false };
    await supabase.channel(`battle-${id}`).send({ type: "broadcast", event: "chat", payload: msg });
    setMessages(p => [...p, msg]);
    setNewMessage("");
  };

  const handleRematch = async () => {
    if (mySide === "Audience") return;
    if (mySide === "A") setRematchA(true);
    if (mySide === "B") setRematchB(true);
    await supabase.channel(`battle-${id}`).send({ type: "broadcast", event: "rematch_request", payload: { side: mySide } });
  };

  const handleExitBattle = async () => {
    // Broadcast exit to the opponent so they don't get stuck
    await supabase.channel(`battle-${id}`).send({ type: "broadcast", event: "battle_exit", payload: { side: mySide } });
    // Both sides deactivate — whoever exits first kills the battle
    await supabase.from("battles").update({ is_active: false }).eq("id", id);
    router.push("/dashboard");
  };

  const getWinner = () => {
    if (rawA > rawB) return { side: "A", profile: playerA };
    if (rawB > rawA) return { side: "B", profile: playerB };
    return { side: "Empate", profile: null };
  };
  const winData = getWinner();

  return (
    <motion.div animate={shaking ? { x: [0, -8, 8, -6, 6, -3, 3, 0], y: [0, 4, -4, 3, -3, 1, -1, 0] } : {}} transition={{ duration: 1 }} className="flex-1 flex flex-col max-w-7xl w-full mx-auto relative overflow-hidden">
      <AnimatePresence>
        {takeover && (
          <motion.div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div className="relative z-10 text-center" initial={{ scale: 0.3, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.5, opacity: 0 }}>
              <motion.p className="text-5xl md:text-7xl font-black mb-4" style={{ color: takeover.color, textShadow: `0 0 40px ${takeover.color}` }} animate={{ scale: [1, 1.05, 1] }} transition={{ repeat: Infinity, duration: 0.8 }}>{takeover.label}</motion.p>
              <p className="text-xl md:text-3xl font-bold text-white/90"><span className="text-[#00d1ff]">@{takeover.username}</span> sent</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="flex items-center justify-end gap-2 px-2">
        <Wallet size={13} className="text-[#00d1ff]" />
        <span className="text-xs font-bold text-[#00d1ff]">{fmtWCR(balance)}</span>
      </div>
      {/* ── Progress Bar (Barra de Pelea) ── */}
      <div className="relative w-full h-3 overflow-hidden border-b border-white/10 z-20 bg-[#0d0008]">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-md" />
        <motion.div className="absolute inset-y-0 left-0 bg-[#ff007a]" animate={{ width: `${(rawA / total) * 100}%` }} />
        <motion.div className="absolute inset-y-0 right-0 bg-[#00d1ff]" animate={{ width: `${(rawB / total) * 100}%` }} />
      </div>

      {/* ── Info Bar: Scores, Usernames, Timer (Debajo de barra de pelea, compacto) ── */}
      <div className="w-full flex items-start justify-between px-6 pt-2 pb-1 bg-[#0d0008] relative z-20 shadow-[0_10px_20px_rgba(0,0,0,0.5)] border-b border-white/5">
        {/* Lado Izquierdo: Puntaje arriba, Usuario abajo */}
        <div className="flex flex-col items-start min-w-[80px]">
          <span className="font-black text-2xl text-[#ff007a] leading-none drop-shadow-[0_0_8px_rgba(255,0,122,0.6)]">{displayA.toLocaleString()}</span>
          <span className="text-white/80 text-[10px] font-bold tracking-wider mt-1">@{playerA?.username || 'Cargando...'}</span>
        </div>
        
        {/* Cronómetro Centrado */}
        <div className="flex items-center justify-center flex-1">
          <div className="bg-black/90 backdrop-blur-md border border-white/10 px-6 py-1.5 rounded-full shadow-[0_0_15px_rgba(0,0,0,0.8)]">
            <span className={`font-[family-name:var(--font-orbitron)] font-black text-lg tracking-widest ${isUrgent ? "text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.8)] animate-pulse" : "text-white"}`}>
              {phase === "PREPARING" ? (bothConnected ? `INICIA: ${fmtTime(displayTime)}` : "ESPERANDO...") : 
               phase === "ENDING" ? `FIN: ${fmtTime(displayTime)}` :
               fmtTime(displayTime)}
            </span>
          </div>
        </div>

        {/* Lado Derecho: Puntaje arriba, Usuario abajo */}
        <div className="flex flex-col items-end min-w-[80px]">
          <span className="font-black text-2xl text-[#00d1ff] leading-none drop-shadow-[0_0_8px_rgba(0,209,255,0.6)]">{displayB.toLocaleString()}</span>
          <span className="text-white/80 text-[10px] font-bold tracking-wider mt-1">@{playerB?.username || 'Cargando...'}</span>
        </div>
      </div>

      {/* ── LIVEKIT WRAPPER ── */}
      {typeof window !== "undefined" && (window.location.hostname === "localhost" || /^[0-9.]+$/.test(window.location.hostname)) && (
        <div className="text-center text-[10px] text-yellow-400 font-bold mb-2">
          Si no ves video, recuerda dar permisos de cámara en el navegador o usar un túnel HTTPS
        </div>
      )}
      <LiveKitRoom
        serverUrl={process.env.NEXT_PUBLIC_LIVEKIT_URL}
        token={livekitToken}
        connect={!!livekitToken}
        connectOptions={{ autoSubscribe: true }}
        video={true}
        audio={true}
        className="flex flex-col flex-[5] min-h-0"
      >
        <RoomWatcher playerA={playerA?.username} playerB={playerB?.username} onBothConnected={setBothConnected} />
        
        <div className="grid grid-cols-2 flex-1 relative min-h-0" style={{ gap: 0 }}>
          {mySide !== "Audience" && <LocalControls phase={phase} />}

          <AnimatePresence>
            {phase === "ENDING" && (
              <motion.div 
                initial={{ y: -100, opacity: 0 }}
                animate={{ y: 20, opacity: 1 }}
                className="absolute top-20 left-4 right-4 z-[50] flex justify-center pointer-events-none"
              >
                <div className="cyber-glass rounded-2xl px-6 py-4 border-2 border-[#ffd700] shadow-[0_0_30px_rgba(255,215,0,0.4)] flex items-center gap-4">
                  <Trophy className="text-[#ffd700]" size={32} />
                  <div>
                    <p className="text-white/60 text-[10px] uppercase font-black tracking-widest">GANADOR DE LA BATALLA</p>
                    <h3 className="text-xl font-black text-white">
                      {rawA > rawB ? playerA?.username : rawB > rawA ? playerB?.username : "¡EMPATE!"}
                    </h3>
                    {rawA !== rawB && (
                      <p className="text-[#ffd700] font-bold text-sm">+{fmtBCR(rawA + rawB)} BCR Ganados</p>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className={`relative overflow-hidden select-none w-full h-full ${phase === "BATTLE" ? "cursor-pointer" : "cursor-not-allowed opacity-80"}`} onClick={(e) => handleTap("A", e)}>
            <div className="absolute inset-0 bg-[#0d0008]" />
            <div className="w-full h-full [&>video]:object-cover [&>video]:w-full [&>video]:h-full absolute inset-0">
              <BattleVideo 
                expectedUsername={playerA?.username || ""} 
                phase={phase} 
                playerA={playerA}
                playerB={playerB}
                displayTime={displayTime}
                isCountdown={isCountdown}
              />
            </div>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-[1]">
              {(!playerA?.username || phase === "PREPARING") && (
                <>
                  {playerA && <img src={playerA.avatar_url || "https://i.pravatar.cc/150"} className="w-12 h-12 rounded-full mb-2 opacity-50" />}
                  <span className="text-[#ff007a]/8 font-black text-7xl">A</span>
                </>
              )}
            </div>
            <motion.div className="absolute inset-0 z-[1] pointer-events-none" animate={glowA ? { boxShadow: ["inset 0 0 40px #ff007a40", "inset 0 0 80px #ff007a60", "inset 0 0 40px #ff007a40"] } : {}} />
            <AnimatePresence>
              {tapsA.map(t => (
                <motion.div key={t.id} className="absolute z-20 pointer-events-none" style={{ left: `${t.x}%`, top: `${t.y}%` }} initial={{ opacity: 0.6, scale: 0.6 }} animate={{ opacity: 0, scale: 1.8, y: -150, x: (Math.random()-0.5)*50 }} transition={{ duration: 1.2, ease: "easeOut" }}><Heart size={24} color="#ff007a" fill="none" strokeWidth={1.5} style={{ filter: "drop-shadow(0 0 8px #ff007a)" }} /></motion.div>
              ))}
            </AnimatePresence>
          </div>

          <div className={`relative overflow-hidden select-none w-full h-full ${phase === "BATTLE" ? "cursor-pointer" : "cursor-not-allowed opacity-80"}`} onClick={(e) => handleTap("B", e)}>
            <div className="absolute inset-0 bg-[#000810]" />
            <div className="w-full h-full [&>video]:object-cover [&>video]:w-full [&>video]:h-full absolute inset-0">
              <BattleVideo 
                expectedUsername={playerB?.username || ""} 
                phase={phase} 
                playerA={playerA}
                playerB={playerB}
                displayTime={displayTime}
                isCountdown={isCountdown}
              />
            </div>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-[1]">
              {(!playerB?.username || phase === "PREPARING") && (
                <>
                  {playerB && <img src={playerB.avatar_url || "https://i.pravatar.cc/150"} className="w-12 h-12 rounded-full mb-2 opacity-50" />}
                  <span className="text-[#00d1ff]/8 font-black text-7xl">B</span>
                </>
              )}
            </div>
            <motion.div className="absolute inset-0 z-[1] pointer-events-none" animate={glowB ? { boxShadow: ["inset 0 0 40px #00d1ff40", "inset 0 0 80px #00d1ff60", "inset 0 0 40px #00d1ff40"] } : {}} />
            <AnimatePresence>
              {tapsB.map(t => (
                <motion.div key={t.id} className="absolute z-20 pointer-events-none" style={{ left: `${t.x}%`, top: `${t.y}%` }} initial={{ opacity: 0.6, scale: 0.6 }} animate={{ opacity: 0, scale: 1.8, y: -150, x: (Math.random()-0.5)*50 }} transition={{ duration: 1.2, ease: "easeOut" }}><Heart size={24} color="#00d1ff" fill="none" strokeWidth={1.5} style={{ filter: "drop-shadow(0 0 8px #00d1ff)" }} /></motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </LiveKitRoom>

      <div className="min-h-[80px] max-h-[140px] bg-black/40 backdrop-blur-xl p-2 flex flex-col border-t border-white/5 relative">
        <div className="flex-1 overflow-y-auto space-y-1.5 mb-2 pr-1 flex flex-col">
          {messages.map((msg: any) => {
            const isElite = msg.text?.includes("Dominion") || msg.text?.includes("Satellite") || msg.text?.includes("Hypernova") || msg.text?.includes("VIVO Supreme");
            return (
              <div key={msg.id} className={`text-[11px] py-1.5 px-3 rounded-xl w-max max-w-[92%] flex gap-2 items-start border ${isElite ? 'animate-pulse' : ''}`} 
                style={isElite ? { background: `${msg.color}40`, borderColor: msg.color, boxShadow: `0 0 10px ${msg.color}80, inset 0 0 5px ${msg.color}40` } : msg.isGift ? { background: `${msg.color}10`, borderColor: `${msg.color}20` } : { background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.03)" }}>
                <span className="font-black" style={{ color: isElite ? "#fff" : msg.isGift ? msg.color : "#00d1ff", textShadow: isElite ? `0 0 5px ${msg.color}` : "none" }}>@{msg.username}</span>
                <span className={isElite ? "text-white font-bold" : "text-white/70"}>{msg.text}</span>
              </div>
            );
          })}
          <div ref={messagesEnd} />
        </div>
        <div className="flex gap-2 items-center">
          <input id="battle-chat-msg" name="battle-chat-msg" type="text" value={newMessage} onChange={e => setNewMessage(e.target.value)} onKeyDown={e => e.key === "Enter" && sendMsg()} placeholder="Type a message..." className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-4 py-2 text-white text-xs placeholder-white/20 focus:outline-none focus:border-[#00d1ff]/40" autoComplete="off" />
          <button onClick={async () => { setShowGiftSheet(true); if(user) setBalance(await getUserBalance(user.id)); }} disabled={phase !== "BATTLE"} className="p-2 text-white/30 hover:text-[#ffd700] disabled:opacity-20 transition-colors"><Gift size={20} /></button>
          <button onClick={sendMsg} disabled={!newMessage.trim()} className="bg-[#00d1ff] disabled:opacity-30 text-black p-2 rounded-xl font-bold"><Send size={18} /></button>
        </div>
      </div>
      <AnimatePresence>
        {showGiftSheet && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowGiftSheet(false)} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[110]" />
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} className="fixed inset-x-0 bottom-0 bg-[#0d0d0d] border-t border-white/10 rounded-t-[40px] z-[120] pb-10 pt-8 px-6">
              <div className="w-12 h-1.5 bg-white/10 rounded-full mx-auto mb-8" />
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                  <button onClick={() => setShowGiftSheet(false)} className="text-white/40"><X size={24} /></button>
                  <h3 className="text-xl font-black text-white">Regalos</h3>
                </div>
                <div className="flex items-center gap-2 bg-white/5 px-4 py-2 rounded-full border border-white/10">
                  <Wallet size={14} className="text-[#ffd700]" />
                  <span className="text-sm font-black text-[#ffd700]">{fmtWCR(balance)}</span>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-4 mb-8">
                {GIFT_CATALOG.map((gift) => (
                  <button key={gift.key} onClick={() => setSelectedGiftKey(gift.key)} disabled={balance < gift.cost} className={`flex flex-col items-center gap-2 p-3 rounded-2xl transition-all ${selectedGiftKey === gift.key ? "bg-white/10 ring-2 ring-[#ff007a]" : "bg-white/[0.03]"} ${balance < gift.cost ? "opacity-20 grayscale" : ""}`}>
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-1" style={{ backgroundColor: `${gift.color}15` }}><gift.icon size={24} color={gift.color} /></div>
                    <span className="text-[10px] font-bold text-white/90 truncate w-full text-center">{gift.label}</span>
                    <span className="text-[10px] font-black" style={{ color: gift.color }}>{gift.cost.toLocaleString()}</span>
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <button disabled={!selectedGiftKey || isSending || phase !== "BATTLE"} onClick={() => { if(selectedGiftKey) { sendGift("A", selectedGiftKey); setShowGiftSheet(false); }}} className="py-4 bg-[#ff007a] disabled:opacity-20 text-white rounded-2xl font-black uppercase tracking-widest text-xs">Enviar a A</button>
                <button disabled={!selectedGiftKey || isSending || phase !== "BATTLE"} onClick={() => { if(selectedGiftKey) { sendGift("B", selectedGiftKey); setShowGiftSheet(false); }}} className="py-4 bg-[#00d1ff] disabled:opacity-20 text-white rounded-2xl font-black uppercase tracking-widest text-xs">Enviar a B</button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {phase === "FINISHED" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/90 backdrop-blur-xl" />
            <motion.div 
              initial={{ y: 50, opacity: 0, scale: 0.9 }} 
              animate={{ y: 0, opacity: 1, scale: 1 }} 
              transition={{ type: "spring", damping: 20, stiffness: 300 }}
              className="relative bg-black/60 backdrop-blur-3xl border-2 rounded-[40px] p-8 text-center shadow-[0_0_50px_rgba(0,0,0,0.8)] max-w-sm w-full flex flex-col" 
              style={{ 
                borderColor: winData.side === "A" ? "#ff007a" : winData.side === "B" ? "#00d1ff" : "rgba(255,255,255,0.2)",
                boxShadow: `0 0 30px ${winData.side === "A" ? "#ff007a40" : winData.side === "B" ? "#00d1ff40" : "rgba(255,255,255,0.1)"}`
              }}
            >
              <div className="mb-6">
                <p className="text-white/40 text-[10px] font-black uppercase tracking-[0.5em] mb-3">Batalla Finalizada</p>
                {winData.profile ? (
                  <div className="flex flex-col items-center justify-center gap-3">
                    <div className="w-20 h-20 rounded-full overflow-hidden border-2 shadow-[0_0_20px_rgba(255,255,255,0.2)]" style={{ borderColor: winData.side === "A" ? "#ff007a" : "#00d1ff" }}>
                      <img src={winData.profile.avatar_url || "https://i.pravatar.cc/150"} className="w-full h-full object-cover" />
                    </div>
                    <h1 className="text-3xl font-black italic tracking-tight uppercase text-white" style={{ textShadow: `0 0 15px ${winData.side === "A" ? "#ff007a" : "#00d1ff"}` }}>
                      ¡GANADOR @{winData.profile.username}!
                    </h1>
                    {mySide === winData.side && (
                      <p className="text-lg font-bold text-[#00ffcc] drop-shadow-[0_0_8px_rgba(0,255,204,0.5)]">
                        Ganaste: +{fmtBCR(rawA + rawB)}
                      </p>
                    )}
                    {mySide !== "Audience" && mySide !== winData.side && (
                      <p className="text-lg font-bold text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.5)]">
                        Perdiste: -{fmtWCR(mySide === "A" ? rawA : rawB)}
                      </p>
                    )}
                  </div>
                ) : (
                   <div className="flex flex-col items-center justify-center gap-3">
                     <h1 className="text-4xl font-black italic tracking-tight uppercase text-white drop-shadow-[0_0_15px_#fff]">EMPATE</h1>
                     {mySide !== "Audience" && (
                       <p className="text-lg font-bold text-yellow-500 drop-shadow-[0_0_8px_rgba(234,179,8,0.5)]">
                         {fmtWCR(0)}
                       </p>
                     )}
                   </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4 mb-8">
                <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-4 flex flex-col items-center justify-center">
                  <p className="text-[#ff007a] text-[10px] font-black uppercase tracking-widest mb-2">Lado A</p>
                  <p className="text-white text-xl font-black truncate w-full">{rawA.toLocaleString()}</p>
                </div>
                <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-4 flex flex-col items-center justify-center">
                  <p className="text-[#00d1ff] text-[10px] font-black uppercase tracking-widest mb-2">Lado B</p>
                  <p className="text-white text-xl font-black truncate w-full">{rawB.toLocaleString()}</p>
                </div>
              </div>

              {mySide !== "Audience" ? (
                <>
                  <motion.button 
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }} 
                    onClick={handleRematch} 
                    disabled={(mySide === "A" && rematchA) || (mySide === "B" && rematchB)}
                    className="w-full py-4 mb-2 bg-gradient-to-r from-[#ff007a] to-[#00d1ff] rounded-[20px] text-white font-black uppercase tracking-[0.2em] text-xs shadow-[0_10px_20px_rgba(0,0,0,0.3)] border border-white/10 disabled:opacity-50"
                  >
                    {((mySide === "A" && rematchA) || (mySide === "B" && rematchB)) ? "ESPERANDO AL RIVAL..." : "SOLICITAR REVANCHA"}
                  </motion.button>
                  <motion.button 
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }} 
                    onClick={handleExitBattle} 
                    className="w-full py-3 bg-transparent border border-white/20 rounded-[20px] text-white/60 font-bold uppercase tracking-widest text-[10px] hover:bg-white/5 transition-colors"
                  >
                    SALIR AL DASHBOARD
                  </motion.button>
                </>
              ) : (
                <div className="flex flex-col gap-2 mt-4">
                  <div className="text-white/50 text-xs font-bold uppercase tracking-widest text-center border border-white/10 p-3 rounded-xl bg-black/30">
                    Esperando a que los jugadores decidan...
                  </div>
                  <motion.button 
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }} 
                    onClick={() => router.push("/dashboard")} 
                    className="w-full py-3 bg-transparent border border-white/20 rounded-[15px] text-white/60 font-bold uppercase tracking-widest text-[10px] hover:bg-white/5 transition-colors mt-2"
                  >
                    SALIR AL DASHBOARD
                  </motion.button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
