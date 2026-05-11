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
import { getWalletCredits } from "@/utils/balance";
import { fmtWCR, fmtBCR } from "@/utils/format";

import { LiveKitRoom, VideoTrack, AudioTrack, useTracks, useLocalParticipant, useParticipants } from '@livekit/components-react';
import { Track } from 'livekit-client';
import '@livekit/components-styles';

interface FloatTap { id: number; x: number; y: number }
const BATTLE_DURATION = 315; // 2:00 prep + 3:00 battle + 15s farewell
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

function RoomWatcher({ playerA, playerB, onBothConnected, onOpponentGhost }: { 
  playerA?: string, 
  playerB?: string, 
  onBothConnected: (ready: boolean) => void,
  onOpponentGhost: (ghost: boolean) => void
}) {
  const participants = useParticipants();
  const connectionState = useConnectionState();

  useEffect(() => {
    if (connectionState !== "connected") {
      onBothConnected(false);
      return;
    }
    const a = participants.find(p => p.identity === playerA);
    const b = participants.find(p => p.identity === playerB);
    const both = !!a && !!b;
    onBothConnected(both);
    // If one was previously connected and now missing, it's a ghost
    if (a && !b) onOpponentGhost(true);
    else if (b && !a) onOpponentGhost(true);
    else onOpponentGhost(false);
  }, [participants, connectionState, playerA, playerB, onBothConnected, onOpponentGhost]);
  return null;
}

interface BattleVideoProps {
  expectedUsername: string;
  phase: BattlePhase;
  playerA: Profile | null;
  playerB: Profile | null;
  displayTime: number;
  isCountdown: boolean;
  hasStartedBattle: boolean;
  isOpponentGhost: boolean;
}

function BattleVideo({ expectedUsername, phase, playerA, playerB, displayTime, isCountdown, hasStartedBattle, isOpponentGhost }: BattleVideoProps) {
  const tracks = useTracks([{ source: Track.Source.Camera, withPlaceholder: false }]);
  const trackRef = tracks.find(t => t.participant.identity === expectedUsername);
  const audioTracks = useTracks([{ source: Track.Source.Microphone, withPlaceholder: false }]);
  const audioTrackRef = audioTracks.find(t => t.participant.identity === expectedUsername);
  
  const participants = useParticipants();
  const participant = participants.find(p => p.identity === expectedUsername);
  const isMicOn = participant?.isMicrophoneEnabled;

  const isCameraEnabled = hasStartedBattle || phase !== "PREPARING";
  // Ghost: this video slot's player is missing while battle is live
  const isGhost = hasStartedBattle && isOpponentGhost && !participant;

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
      
      {audioTrackRef && isCameraEnabled && (
        <AudioTrack trackRef={audioTrackRef as any} />
      )}

      {/* Mic Status Indicator */}
      {isCameraEnabled && (
        <div className="absolute top-4 right-4 z-[20] p-1.5 rounded-full bg-black/40 backdrop-blur border border-white/10">
          {isMicOn ? <Mic size={14} className="text-[#00d1ff]" /> : <MicOff size={14} className="text-red-500" />}
        </div>
      )}

      {/* Ghosting overlay — opponent temporarily disconnected */}
      {isGhost && (
        <div className="absolute inset-0 z-[25] flex items-end justify-center pb-4 pointer-events-none">
          <div className="flex items-center gap-1.5 bg-black/70 backdrop-blur-sm border border-yellow-500/40 rounded-full px-3 py-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
            <span className="text-yellow-300 text-[10px] font-bold tracking-wider uppercase">Oponente reconectando...</span>
          </div>
        </div>
      )}
      
      {/* VS Overlay — shown only during warmup, never again after battle starts */}
      {!hasStartedBattle && phase === "PREPARING" && (
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
              <div className="flex items-center gap-4 sm:gap-8 mb-2">
                <div className="flex flex-col items-center gap-1.5">
                  <div className="rounded-full border-2 border-[#00d1ff] p-0.5" style={{ width: 'clamp(48px, 14vw, 80px)', height: 'clamp(48px, 14vw, 80px)' }}>
                    <div className="w-full h-full rounded-full bg-white/5 flex items-center justify-center overflow-hidden">
                      {playerA?.avatar_url ? <img src={playerA.avatar_url} className="w-full h-full object-cover" /> : <div className="text-[#00d1ff] font-bold text-xs">A</div>}
                    </div>
                  </div>
                  <span className="text-white font-black tracking-wider uppercase truncate max-w-[25vw]" style={{ fontSize: 'clamp(9px, 2.5vw, 13px)' }}>@{playerA?.username}</span>
                </div>
                <div className="text-white/20 font-black italic" style={{ fontSize: 'clamp(1rem, 4vw, 1.8rem)' }}>VS</div>
                <div className="flex flex-col items-center gap-1.5">
                  <div className="rounded-full border-2 border-[#ff007a] p-0.5" style={{ width: 'clamp(48px, 14vw, 80px)', height: 'clamp(48px, 14vw, 80px)' }}>
                    <div className="w-full h-full rounded-full bg-white/5 flex items-center justify-center overflow-hidden">
                      {playerB?.avatar_url ? <img src={playerB.avatar_url} className="w-full h-full object-cover" /> : <div className="text-[#ff007a] font-bold text-xs">B</div>}
                    </div>
                  </div>
                  <span className="text-white font-black tracking-wider uppercase truncate max-w-[25vw]" style={{ fontSize: 'clamp(9px, 2.5vw, 13px)' }}>@{playerB?.username}</span>
                </div>
              </div>
              
              <div className="text-center space-y-0.5 px-4">
                <span className="text-[#00d1ff] font-black tracking-[0.2em] uppercase animate-pulse" style={{ fontSize: 'clamp(8px, 2.2vw, 12px)' }}>Esperando público...</span>
                <h2 className="font-black text-white italic tracking-tighter" style={{ fontSize: 'clamp(1.2rem, 5vw, 2.5rem)', textShadow: '0 0 10px rgba(255,255,255,0.2)' }}>
                  PREPARANDO <span className="text-[#ff007a]">BATALLA</span>
                </h2>
              </div>

              <div className="mt-2 flex flex-col items-center gap-1">
                <div className="text-white/40 font-medium" style={{ fontSize: 'clamp(10px, 2.5vw, 14px)' }}>Inicia en</div>
                <div className="font-black text-white font-mono" style={{ fontSize: 'clamp(1.8rem, 8vw, 3.5rem)' }}>{fmtTime(displayTime)}</div>
              </div>
            </motion.div>
          )}
        </div>
      )}

      {/* Giant Countdown (Last 10s of Prep) — only while not yet started */}
      <AnimatePresence>
        {!hasStartedBattle && isCountdown && (
          <motion.div 
            key={displayTime}
            initial={{ scale: 2, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.5, opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center z-[50] pointer-events-none"
          >
            <span className="font-black text-white italic" style={{ fontSize: 'clamp(3rem, 15vw, 7rem)', textShadow: '0 0 15px rgba(255,0,122,0.8)' }}>
              {displayTime}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Battle Start Animation */}
      <AnimatePresence>
        {phase === "BATTLE" && displayTime >= 178 && (
          <motion.div 
            initial={{ scale: 0, rotate: -10, opacity: 0 }}
            animate={{ scale: [0, 1.3, 1], rotate: 0, opacity: [0, 1, 1, 0] }}
            transition={{ duration: 2 }}
            className="absolute inset-0 flex items-center justify-center z-[60] pointer-events-none"
          >
            <div className="bg-[#ff007a] px-6 py-2 skew-x-[-12deg] border-2 border-white shadow-[0_0_20px_#ff007a]">
              <span className="font-black text-white italic tracking-tighter" style={{ fontSize: 'clamp(1.5rem, 7vw, 3.5rem)' }}>¡BATALLA!</span>
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
  const [isOpponentGhost, setIsOpponentGhost] = useState(false); // opponent temporarily disconnected
  const [hasBroadcastedStart, setHasBroadcastedStart] = useState(false);
  const [hasSettledPoints, setHasSettledPoints] = useState(false);
  // One-way latch: once battle leaves PREPARING, VS screen never comes back
  const [hasStartedBattle, setHasStartedBattle] = useState(false);

  // Batching logic for performance
  const pendingScoreA = useRef(0);
  const pendingScoreB = useRef(0);
  const lastTapSound = useRef(0);

  const phase: BattlePhase = !bothConnected || timeLeft > 195 ? "PREPARING" : 
                (timeLeft > 15 ? "BATTLE" : 
                 timeLeft > 0 ? "ENDING" : "FINISHED");

  const displayTime = phase === "PREPARING" ? Math.max(0, timeLeft - 195) : 
                      (phase === "BATTLE" ? timeLeft - 15 : 
                       phase === "ENDING" ? timeLeft : 0);

  const isUrgent = phase === "BATTLE" && displayTime <= 30;
  const isCountdown = phase === "PREPARING" && displayTime <= 10;

  // Latch: once battle starts, VS overlay is permanently dismissed
  useEffect(() => {
    if (phase !== "PREPARING" && !hasStartedBattle) {
      setHasStartedBattle(true);
    }
  }, [phase, hasStartedBattle]);

  const calculateTimeLeft = (startIso: string) => {
    const start = new Date(startIso).getTime();
    const elapsed = Math.floor((Date.now() - start) / 1000);
    return BATTLE_DURATION - elapsed;
  };

  // Derived: is the battle past the warmup window (>195s elapsed)?
  const isPastWarmup = (startIso: string) => calculateTimeLeft(startIso) <= 195;

  const [wakeCount, setWakeCount] = useState(0);

  useEffect(() => {
    const onWake = () => setWakeCount(c => c + 1);
    window.addEventListener("vivo_wakeup", onWake);
    return () => window.removeEventListener("vivo_wakeup", onWake);
  }, []);

  useEffect(() => {
    let isMounted = true;
    let currentController: AbortController | null = null;

    const initBattleData = async () => {
      if (currentController) currentController.abort(); // Cancel any pending fetch
      currentController = new AbortController();
      const signal = currentController.signal;
      const timeoutId = setTimeout(() => currentController?.abort(), 10000);

      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        if (isMounted) setUser(user);
        
        const { data: p } = await supabase.from("profiles").select("username, bank_name").eq("id", user.id).abortSignal(signal).single();
        if (p && isMounted) setProfile(p);
        
        const b = await getWalletCredits(user.id);
        if (isMounted) setBalance(b);

        const { data: battle } = await supabase.from("battles").select("*").eq("id", id).abortSignal(signal).single();
        if (battle && isMounted) {
          setBattleData(battle);

          // ⭐ POINTS RECOVERY: always load latest scores from DB
          setRawA(battle.score_a || 0);
          setRawB(battle.score_b || 0);
          
          if (user.id === battle.player_a_id) setMySide("A");
          else if (user.id === battle.player_b_id) setMySide("B");
          else setMySide("Audience");

          const { data: profs } = await supabase.from("profiles").select("id, username, avatar_url, bank_name").in("id", [battle.player_a_id, battle.player_b_id]).abortSignal(signal);
          if (profs && isMounted) {
            setPlayerA(profs.find((pr: any) => pr.id === battle.player_a_id));
            setPlayerB(profs.find((pr: any) => pr.id === battle.player_b_id));
          }

          const tLeft = calculateTimeLeft(battle.started_at);
          setTimeLeft(tLeft);

          // ⭐ SKIP WARMUP if already past it
          if (tLeft <= 195) {
            setBothConnected(true); // Force past the PREPARING gate
            setHasStartedBattle(true); // Never show VS screen again
          }

          // ⭐ RESULTS PROTECTION: if battle ended, jump straight to results
          if (!battle.is_active && tLeft <= 0) {
            setIsFinishedLocally(true);
          }
        }
      } catch (err: any) {
        if (err.name === 'AbortError') {
          console.warn("Battle load timeout aborted.");
        }
      } finally {
        clearTimeout(timeoutId);
      }
    };
    initBattleData();

    const handleVisibilityChange = () => {
      if (document.hidden) {
        supabase.removeAllChannels();
        setLivekitToken("");
      } else {
        window.location.reload();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

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
         setHasStartedBattle(false); // Allow VS screen for rematch
         setHasBroadcastedStart(false);
         setBothConnected(false);
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
         // ⭐ POINTS RECOVERY via DB: sync scores when DB is updated
         if (typeof payload.new.score_a === 'number') setRawA(payload.new.score_a);
         if (typeof payload.new.score_b === 'number') setRawB(payload.new.score_b);
         // ⭐ If marked inactive by server, mark as finished
         if (payload.new.is_active === false) setIsFinishedLocally(true);
      })
      .subscribe();
      
    return () => { 
      isMounted = false;
      if (currentController) currentController.abort();
      supabase.removeChannel(ch); 
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [id, supabase, router, wakeCount]);

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

  // Master Timer — anchored to server started_at, always ticks (no bothConnected gate)
  useEffect(() => {
    if (!battleData?.started_at) return;
    // Immediate sync on mount/reconnect
    setTimeLeft(calculateTimeLeft(battleData.started_at));

    const t = setInterval(() => {
      setTimeLeft(calculateTimeLeft(battleData.started_at));
    }, 1000);

    // Re-sync immediately when user returns to tab (background throttle fix)
    const onFocus = () => setTimeLeft(calculateTimeLeft(battleData.started_at));
    document.addEventListener("visibilitychange", onFocus);
    window.addEventListener("focus", onFocus);

    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onFocus);
      window.removeEventListener("focus", onFocus);
    };
  }, [battleData?.started_at]);

  // Sync True Start Time — only once per session, player A writes it
  useEffect(() => {
    if (bothConnected && mySide === "A" && !hasBroadcastedStart) {
       // Only set started_at if it's still in warmup (don't overwrite on reconnect)
       if (battleData?.started_at && isPastWarmup(battleData.started_at)) return;
       setHasBroadcastedStart(true);
       const newStart = new Date().toISOString();
       supabase.from('battles').update({ started_at: newStart }).eq('id', id).then();
       supabase.channel(`battle-${id}`).send({ type: "broadcast", event: "battle_start", payload: { started_at: newStart } });
    }
  }, [bothConnected, mySide, hasBroadcastedStart, id, battleData]);

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

            // AGGRESSIVE AUTO-CLOSE: mark battle as finished IMMEDIATELY
            await supabase.from("battles").update({
              score_a: rawA, score_b: rawB,
              is_active: false,
            }).eq("id", id);

            // Settle Player A
            if (battleData?.player_a_id && rawA > 0) {
              const pAId = battleData.player_a_id;
              const { data: profA } = await supabase.from("profiles").select("total_earned, battle_credits").eq("id", pAId).single();
              if (profA) {
                await supabase.from("profiles").update({
                  total_earned: (profA.total_earned || 0) + rawA,
                  battle_credits: (profA.battle_credits || 0) + rawA,
                }).eq("id", pAId);
              }
              await supabase.from("transactions").insert({
                user_id: pAId,
                type: "BATTLE_WIN",
                amount_credits: rawA,
                amount_bs: 0,
                status: "approved",
                reference_number: `BATALLA vs @${playerB?.username || 'rival'}`,
                opponent_id: battleData?.player_b_id,
                battle_id: id,
              });
            }

            // Settle Player B
            if (battleData?.player_b_id && rawB > 0) {
              const pBId = battleData.player_b_id;
              const { data: profB } = await supabase.from("profiles").select("total_earned, battle_credits").eq("id", pBId).single();
              if (profB) {
                await supabase.from("profiles").update({
                  total_earned: (profB.total_earned || 0) + rawB,
                  battle_credits: (profB.battle_credits || 0) + rawB,
                }).eq("id", pBId);
              }
              await supabase.from("transactions").insert({
                user_id: pBId,
                type: "BATTLE_WIN",
                amount_credits: rawB,
                amount_bs: 0,
                status: "approved",
                reference_number: `BATALLA vs @${playerA?.username || 'rival'}`,
                opponent_id: battleData?.player_a_id,
                battle_id: id,
              });
            }

            if (winnerId) {
              const { data: winnerProfile } = await supabase.from("profiles").select("wins").eq("id", winnerId).single();
              if (winnerProfile) await supabase.from("profiles").update({ wins: (winnerProfile.wins || 0) + 1 }).eq("id", winnerId);
            }
            if (loserId) {
              const { data: loserProfile } = await supabase.from("profiles").select("losses").eq("id", loserId).single();
              if (loserProfile) await supabase.from("profiles").update({ losses: (loserProfile.losses || 0) + 1 }).eq("id", loserId);
            }
            if (!winnerId && !loserId) {
              for (const pid of [battleData?.player_a_id, battleData?.player_b_id]) {
                if (!pid) continue;
                const { data: p } = await supabase.from("profiles").select("draws").eq("id", pid).single();
                if (p) await supabase.from("profiles").update({ draws: (p.draws || 0) + 1 }).eq("id", pid);
              }
            }
            console.log(`[Battle] ✅ Settled & closed: Player A got ${rawA}, Player B got ${rawB}`);
          } catch (err) {
            console.error("[Battle] Point settlement error:", err);
          }
        })();
      }
    }

    // FINISHED phase: no auto-redirect, static modal handles navigation
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
    const colors = ["#ff007a", "#00d1ff", "#ffd700", "#ffffff"];
    // High-end tech style: small particles, high speed, subtle trail
    for (let i = 0; i < 4; i++) {
      setTimeout(() => confetti({ 
        particleCount: 80, 
        spread: 70 + i * 20, 
        origin: { y: 0.5 }, 
        colors, 
        gravity: 0.6, 
        scalar: 0.7, 
        ticks: 200,
        shapes: ['square'],
        drift: 0,
      }), i * 150);
    }
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
      // 1. Fetch BCV Rate
      const { data: bcvData } = await supabase.from("app_config").select("value").eq("key", "bcv_rate").single();
      const currentBcvRate = bcvData && bcvData.value ? parseFloat(bcvData.value) : 50; // Fallback 50
      const giftBsValue = gift.cost * currentBcvRate;

      // 2. Insert transaction
      const { error: txError } = await supabase.from("transactions").insert({ 
        user_id: user.id, 
        type: "GIFT_SENT", 
        amount_credits: -gift.cost, 
        amount_bs: -giftBsValue, 
        reference_number: `Envío Regalo: ${gift.label} a ${side}`, 
        status: "approved" 
      });
      if (txError) throw txError;

      // 3. Update source of truth: profiles.wallet_credits (use freshly fetched walletBal)
      await supabase.from("profiles").update({
        wallet_credits: Math.max(0, walletBal - gift.cost)
      }).eq("id", user.id);
      const b = await getWalletCredits(user.id);
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
          <motion.div className="absolute top-[30%] inset-x-0 z-[60] flex items-center justify-center pointer-events-none" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
            <motion.div className="relative z-10 text-center bg-black/40 px-6 py-3 rounded-2xl backdrop-blur-md border border-white/10" initial={{ scale: 0.5 }} animate={{ scale: 1 }} exit={{ scale: 0.8 }}>
              <motion.p className="text-xl md:text-2xl font-black mb-1" style={{ color: takeover.color, textShadow: `0 0 15px ${takeover.color}` }} animate={{ scale: [1, 1.1, 1] }} transition={{ repeat: Infinity, duration: 0.8 }}>{takeover.label}</motion.p>
              <p className="text-xs md:text-sm font-bold text-white/90"><span className="text-[#00d1ff]">@{takeover.username}</span></p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="flex items-center justify-end gap-2 px-2">
        <Wallet size={13} className="text-[#00d1ff]" />
        <span className="text-xs font-bold text-[#00d1ff]">{fmtWCR(balance)}</span>
      </div>
      {/* ── Progress Bar (Barra de Pelea) ── */}
      <div className="relative w-full h-2.5 overflow-hidden border-b border-white/10 z-20 bg-[#0d0008]">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-md" />
        <motion.div className="absolute inset-y-0 left-0 bg-[#ff007a]" animate={{ width: `${(rawA / total) * 100}%` }} transition={{ type: "spring", stiffness: 120, damping: 20 }} />
        <motion.div className="absolute inset-y-0 right-0 bg-[#00d1ff]" animate={{ width: `${(rawB / total) * 100}%` }} transition={{ type: "spring", stiffness: 120, damping: 20 }} />
      </div>

      {/* ── Info Bar: Scores, Usernames, Timer (compact, below progress bar) ── */}
      <div className="w-full flex items-center justify-between px-3 py-1 bg-[#0d0008]/95 relative z-20 border-b border-white/5">
        {/* Left: Score + Username */}
        <div className="flex flex-col items-start min-w-[60px]">
          <span className="font-black text-base text-[#ff007a] leading-none">{displayA.toLocaleString()}</span>
          <span className="text-white/60 text-[9px] font-semibold tracking-wide mt-0.5 truncate max-w-[70px]">@{playerA?.username || '...'}</span>
        </div>
        
        {/* Timer Centered */}
        <div className="flex items-center justify-center">
          <div className="bg-black/80 border border-white/10 px-3 py-1 rounded-full">
            <span className={`font-mono font-black text-xs tracking-widest ${isUrgent ? "text-red-500 animate-pulse" : "text-white/90"}`}>
              {phase === "PREPARING" ? (bothConnected ? `INICIA ${fmtTime(displayTime)}` : "ESPERANDO...") : 
               phase === "ENDING" ? `FIN ${fmtTime(displayTime)}` :
               fmtTime(displayTime)}
            </span>
          </div>
        </div>

        {/* Right: Score + Username */}
        <div className="flex flex-col items-end min-w-[60px]">
          <span className="font-black text-base text-[#00d1ff] leading-none">{displayB.toLocaleString()}</span>
          <span className="text-white/60 text-[9px] font-semibold tracking-wide mt-0.5 truncate max-w-[70px]">@{playerB?.username || '...'}</span>
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
        className="flex flex-col flex-[4] min-h-0 relative"
      >
        <RoomWatcher playerA={playerA?.username} playerB={playerB?.username} onBothConnected={setBothConnected} onOpponentGhost={setIsOpponentGhost} />
        
        {/* GLOBAL PANORAMIC OVERLAY FOR PREPARING — latched, never re-shows */}
        <AnimatePresence>
          {!hasStartedBattle && phase === "PREPARING" && (
            <motion.div 
              className="absolute inset-0 z-[60] flex flex-col items-center justify-center pointer-events-none bg-black/80 backdrop-blur-sm"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            >
              <h2 className="text-2xl md:text-5xl font-black text-white tracking-widest mb-6 md:mb-8 animate-pulse text-center w-full" style={{ textShadow: "0 0 20px rgba(255,255,255,0.5)" }}>
                PREPARANDO BATALLA
              </h2>
              <div className="flex items-center justify-center gap-6 md:gap-12 w-full px-4">
                <div className="flex flex-col items-center">
                  <img src={playerA?.avatar_url || "https://i.pravatar.cc/150"} className="w-16 h-16 md:w-32 md:h-32 rounded-full border-2 md:border-4 border-[#ff007a] shadow-[0_0_30px_#ff007a80]" />
                  <span className="mt-2 font-black text-[#ff007a] text-sm md:text-lg">@{playerA?.username || "A"}</span>
                </div>
                <div className="text-3xl md:text-6xl font-black text-white italic opacity-80">VS</div>
                <div className="flex flex-col items-center">
                  <img src={playerB?.avatar_url || "https://i.pravatar.cc/150"} className="w-16 h-16 md:w-32 md:h-32 rounded-full border-2 md:border-4 border-[#00d1ff] shadow-[0_0_30px_#00d1ff80]" />
                  <span className="mt-2 font-black text-[#00d1ff] text-sm md:text-lg">@{playerB?.username || "B"}</span>
                </div>
              </div>
              {isCountdown && (
                <div className="mt-6 md:mt-8 text-5xl md:text-8xl font-black text-white animate-ping" style={{ textShadow: "0 0 30px #fff" }}>
                  {displayTime}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid grid-cols-2 flex-1 relative min-h-0" style={{ gap: 0 }}>
          {mySide !== "Audience" && <LocalControls phase={phase} />}

          <AnimatePresence>
            {phase === "ENDING" && displayTime >= 10 && (
              <motion.div 
                initial={{ y: -60, opacity: 0 }}
                animate={{ y: 10, opacity: 1 }}
                exit={{ y: -60, opacity: 0 }}
                transition={{ duration: 0.5 }}
                className="absolute top-4 left-3 right-3 z-[50] flex justify-center pointer-events-none"
              >
                <div className="cyber-glass rounded-xl px-4 py-2.5 border border-[#ffd700]/60 shadow-[0_0_15px_rgba(255,215,0,0.3)] flex items-center gap-3">
                  <Trophy className="text-[#ffd700]" size={20} />
                  <div>
                    <p className="text-white/50 text-[8px] uppercase font-black tracking-widest">GANADOR</p>
                    <h3 className="text-sm font-black text-white">
                      {rawA > rawB ? `@${playerA?.username}` : rawB > rawA ? `@${playerB?.username}` : "¡EMPATE!"}
                    </h3>
                    {rawA !== rawB && (
                      <p className="text-[#ffd700] font-bold text-[10px]">+{fmtBCR(rawA > rawB ? rawA : rawB)}</p>
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
                hasStartedBattle={hasStartedBattle}
                isOpponentGhost={isOpponentGhost}
              />
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
                hasStartedBattle={hasStartedBattle}
                isOpponentGhost={isOpponentGhost}
              />
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

      <div className="min-h-[120px] max-h-[200px] bg-black/40 backdrop-blur-xl p-2 flex flex-col border-t border-white/5 relative z-40">
        <div className="flex-1 overflow-y-auto space-y-1.5 mb-2 pr-1 flex flex-col">
          {messages.map((msg: any) => {
            const isElite = msg.tier === 3;
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
          <button onClick={async () => { setShowGiftSheet(true); if(user) setBalance(await getWalletCredits(user.id)); }} disabled={phase !== "BATTLE"} className="p-2 text-white/30 hover:text-[#ffd700] disabled:opacity-20 transition-colors"><Gift size={20} /></button>
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
              className="relative bg-black/60 backdrop-blur-3xl border-2 rounded-[32px] p-6 text-center shadow-[0_0_50px_rgba(0,0,0,0.8)] max-w-xs w-full flex flex-col" 
              style={{ 
                borderColor: winData.side === "A" ? "#ff007a" : winData.side === "B" ? "#00d1ff" : "rgba(255,255,255,0.2)",
                boxShadow: `0 0 30px ${winData.side === "A" ? "#ff007a40" : winData.side === "B" ? "#00d1ff40" : "rgba(255,255,255,0.1)"}`
              }}
            >
              <div className="mb-5">
                <p className="text-white/40 text-[9px] font-black uppercase tracking-[0.4em] mb-3">Fin de Batalla</p>
                {winData.profile ? (
                  <div className="flex flex-col items-center justify-center gap-2">
                    <div className="w-16 h-16 rounded-full overflow-hidden border-2 shadow-[0_0_15px_rgba(255,255,255,0.2)]" style={{ borderColor: winData.side === "A" ? "#ff007a" : "#00d1ff" }}>
                      <img src={winData.profile.avatar_url || "https://i.pravatar.cc/150"} className="w-full h-full object-cover" />
                    </div>
                    <h1 className="text-xl font-black italic tracking-tight uppercase text-white" style={{ textShadow: `0 0 10px ${winData.side === "A" ? "#ff007a" : "#00d1ff"}` }}>
                      ¡GANADOR @{winData.profile.username}!
                    </h1>
                    {mySide === winData.side && (
                      <p className="text-sm font-bold text-[#00ffcc]">
                        +{fmtBCR(rawA + rawB)} ganados
                      </p>
                    )}
                    {mySide !== "Audience" && mySide !== winData.side && (
                      <p className="text-sm font-bold text-red-500">
                        Perdiste
                      </p>
                    )}
                  </div>
                ) : (
                   <div className="flex flex-col items-center justify-center gap-2">
                     <h1 className="text-3xl font-black italic uppercase text-white">EMPATE</h1>
                   </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 mb-6">
                <div className="bg-white/[0.03] border border-white/10 rounded-xl p-3 flex flex-col items-center">
                  <p className="text-[#ff007a] text-[9px] font-black uppercase tracking-widest mb-1">@{playerA?.username || 'A'}</p>
                  <p className="text-white text-lg font-black">{rawA.toLocaleString()}</p>
                </div>
                <div className="bg-white/[0.03] border border-white/10 rounded-xl p-3 flex flex-col items-center">
                  <p className="text-[#00d1ff] text-[9px] font-black uppercase tracking-widest mb-1">@{playerB?.username || 'B'}</p>
                  <p className="text-white text-lg font-black">{rawB.toLocaleString()}</p>
                </div>
              </div>

              {mySide !== "Audience" ? (
                <>
                  <motion.button 
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }} 
                    onClick={handleRematch} 
                    disabled={(mySide === "A" && rematchA) || (mySide === "B" && rematchB)}
                    className="w-full py-3.5 mb-2 bg-gradient-to-r from-[#ff007a] to-[#00d1ff] rounded-2xl text-white font-black uppercase tracking-[0.15em] text-[11px] shadow-[0_8px_16px_rgba(0,0,0,0.3)] border border-white/10 disabled:opacity-50"
                  >
                    {((mySide === "A" && rematchA) || (mySide === "B" && rematchB)) ? "ESPERANDO AL RIVAL..." : "QUIERO REVANCHA"}
                  </motion.button>
                  <motion.button 
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }} 
                    onClick={handleExitBattle} 
                    className="w-full py-3 bg-transparent border border-white/20 rounded-2xl text-white/60 font-bold uppercase tracking-widest text-[10px] hover:bg-white/5 transition-colors"
                  >
                    IR AL DASHBOARD
                  </motion.button>
                </>
              ) : (
                <motion.button 
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }} 
                  onClick={handleExitBattle} 
                  className="w-full py-3 bg-transparent border border-white/20 rounded-2xl text-white/60 font-bold uppercase tracking-widest text-[10px] hover:bg-white/5 transition-colors"
                >
                  IR AL DASHBOARD
                </motion.button>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
