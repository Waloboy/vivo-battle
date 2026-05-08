"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Wallet, Gift, X, Heart, Mic, MicOff, RefreshCw } from "lucide-react";
import confetti from "canvas-confetti";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { GIFT_CATALOG, type GiftKey } from "../gifts";
import { useAnimatedCount } from "../useAnimatedCount";
import { getUserBalance } from "@/utils/balance";
import { fmtCR } from "@/utils/format";

import { LiveKitRoom, VideoTrack, useTracks, useLocalParticipant, useParticipants } from '@livekit/components-react';
import { Track } from 'livekit-client';
import '@livekit/components-styles';

interface FloatTap { id: number; x: number; y: number }
const BATTLE_DURATION = 210; // 3:30 total (15s warmup + 180s battle + 15s end)

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

function BattleVideo({ expectedUsername, phase }: { expectedUsername?: string, phase: string }) {
  const tracks = useTracks([{ source: Track.Source.Camera, withPlaceholder: false }]);
  const trackRef = tracks.find(t => t.participant.identity === expectedUsername);

  // Debug LiveKit connection state
  const connectionState = useConnectionState();
  useEffect(() => {
    console.log(`LiveKit Connection State for ${expectedUsername || 'Unknown'}:`, connectionState);
  }, [connectionState, expectedUsername]);

  return (
    <div className="absolute inset-0 z-[0] overflow-hidden pointer-events-none">
      {trackRef ? (
        <VideoTrack trackRef={trackRef as any} className="w-full h-full object-cover scale-[1.02]" />
      ) : (
        <div className="w-full h-full bg-[#0d0008] flex items-center justify-center">
          <span className="text-white/30 text-xs">Esperando cámara...</span>
        </div>
      )}
      
      {phase === "waiting" && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] flex flex-col items-center justify-center z-[2]">
          <span className="text-yellow-400 font-black tracking-widest text-[10px] mb-2 animate-pulse shadow-black drop-shadow-md text-center px-4">ESPERANDO CONEXIÓN...</span>
        </div>
      )}
      
      {phase === "warmup" && (
        <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex flex-col items-center justify-center z-[2]">
          <span className="text-white/90 font-black tracking-widest text-[10px] mb-2 animate-pulse shadow-black drop-shadow-md">PREPARANDO...</span>
          <div className="w-8 h-8 border-2 border-white/40 border-t-white rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}

// --- LiveKit Local Controls (Mute & Flip Camera) ---
function LocalControls({ isWarmup }: { isWarmup: boolean }) {
  const { localParticipant } = useLocalParticipant();
  const [isMuted, setIsMuted] = useState(false);
  const [facingMode, setFacingMode] = useState<"user"|"environment">("user");

  useEffect(() => {
    if (localParticipant) {
      localParticipant.setCameraEnabled(true, { facingMode: "user" }).catch(e => console.error("Auto camera error:", e));
      localParticipant.setMicrophoneEnabled(true).catch(e => console.error("Auto mic error:", e));
    }
  }, [localParticipant]);

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
  const [playerA, setPlayerA] = useState<any>(null);
  const [playerB, setPlayerB] = useState<any>(null);
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

  // Batching logic for performance
  const pendingScoreA = useRef(0);
  const pendingScoreB = useRef(0);
  const lastTapSound = useRef(0);

  const phase = !bothConnected ? "waiting" : (timeLeft > 195 ? "warmup" : timeLeft > 15 ? "battle" : "finished");
  const displayTime = phase === "waiting" ? 0 : (phase === "warmup" ? timeLeft - 195 : phase === "battle" ? timeLeft - 15 : 0);
  const isUrgent = phase === "battle" && displayTime <= 30;

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
      .on("broadcast", { event: "chat" }, ({ payload }) => setMessages(p => [...p, payload]))
      .on("broadcast", { event: "score" }, ({ payload }) => {
        if (payload.side === "A") setRawA(p => p + payload.amount);
        else setRawB(p => p + payload.amount);
      })
      .on("broadcast", { event: "rematch_request" }, ({ payload }) => {
         if (payload.side === "A") setRematchA(true);
         if (payload.side === "B") setRematchB(true);
      })
      .on("broadcast", { event: "rematch_accepted" }, ({ payload }) => {
         setBattleData((prev: any) => ({ ...prev, started_at: payload.started_at }));
         setRawA(0);
         setRawB(0);
         setRematchA(false);
         setRematchB(false);
         setIsFinishedLocally(false);
         setTimeLeft(calculateTimeLeft(payload.started_at));
      })
      .on("broadcast", { event: "battle_start" }, ({ payload }) => {
         setBattleData((prev: any) => ({ ...prev, started_at: payload.started_at }));
         setTimeLeft(calculateTimeLeft(payload.started_at));
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "battles", filter: `id=eq.${id}` }, (payload) => {
         if (payload.new.started_at) {
           setBattleData((prev: any) => ({ ...prev, started_at: payload.new.started_at }));
           setTimeLeft(calculateTimeLeft(payload.new.started_at));
         }
      })
      .subscribe();
      
    return () => { supabase.removeChannel(ch); };
  }, [id, supabase]);

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

  // Finished Logic
  useEffect(() => {
    if (phase === "finished" && !isFinishedLocally) {
      setIsFinishedLocally(true);
      playSound("win");
      confetti({ 
        particleCount: 250, spread: 100, origin: { y: 0.6 },
        colors: ["#ff007a", "#00d1ff"], gravity: 0.8, scalar: 1.2
      });
    }

    if (timeLeft <= -15) { // 30s after the battle ends (15s modal + 15s wait)
      if (mySide === "A") {
        supabase.from("battles").update({ is_active: false }).eq("id", id).then(() => {
           router.push("/dashboard");
        });
      } else {
        router.push("/dashboard");
      }
    }
  }, [phase, timeLeft, isFinishedLocally, mySide, id, router, supabase]);

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

  const fmtTime = (s: number) => {
    if (s < 0) return "0:00";
    return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
  };

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
    if (phase !== "battle") return; 
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
    if (!profile || !user || isSending || phase !== "battle") return;
    const gift = GIFT_CATALOG.find(g => g.key === giftKey)!;
    try {
      const currentBal = await getUserBalance(user.id);
      if (currentBal < gift.cost) { alert(`Saldo insuficiente. Necesitas ${fmtCR(gift.cost)}`); return; }
      setIsSending(true);
      playSound("gift");
      const { error: txError } = await supabase.from("transactions").insert({ user_id: user.id, type: "gift", amount_credits: -gift.cost, amount_bs: 0, reference_number: `Envío Regalo: ${gift.label} a ${side}`, status: "approved" });
      if (txError) throw txError;
      const b = await getUserBalance(user.id);
      setBalance(b);
      if (gift.tier === 3) { fireSupremeConfetti(); triggerShake(8, 1000); flashGlow(side); setTakeover({ username: profile.username, label: gift.label, color: gift.color }); setTimeout(() => setTakeover(null), 3000); } 
      else flashGlow(side);
      
      if (side === "A") { setRawA(p => p + gift.cost); pendingScoreA.current += gift.cost; }
      else { setRawB(p => p + gift.cost); pendingScoreB.current += gift.cost; }
      
      const msg = { id: Date.now(), username: profile.username, text: `sent ${gift.label} (${fmtCR(gift.cost)})`, isGift: true, color: gift.color, tier: gift.tier };
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
    if (mySide === "A") {
       await supabase.from("battles").update({ is_active: false }).eq("id", id);
    }
    router.push("/dashboard");
  };

  const getWinner = () => {
    if (rawA > rawB) return { side: "A", profile: playerA };
    if (rawB > rawA) return { side: "B", profile: playerB };
    return { side: "Empate", profile: null };
  };
  const winData = getWinner();

  return (
    <motion.div animate={shaking ? { x: [0, -8, 8, -6, 6, -3, 3, 0], y: [0, 4, -4, 3, -3, 1, -1, 0] } : {}} transition={{ duration: 1 }} className="flex-1 flex flex-col p-3 max-w-7xl w-full mx-auto relative overflow-hidden">
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
      <div className="flex items-center justify-end gap-2 mb-1">
        <Wallet size={13} className="text-[#00d1ff]" />
        <span className="text-xs font-bold text-[#00d1ff]">{fmtCR(balance)}</span>
      </div>
      <div className="relative w-full h-10 rounded-full overflow-hidden mb-3 border border-white/10">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-md" />
        <motion.div className="absolute inset-y-0 left-0 bg-[#ff007a]" animate={{ width: `${(rawA / total) * 100}%` }} />
        <motion.div className="absolute inset-y-0 right-0 bg-[#00d1ff]" animate={{ width: `${(rawB / total) * 100}%` }} />
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <div className="bg-black/60 backdrop-blur-md border border-white/10 px-4 py-1 rounded-full shadow-[0_4px_10px_rgba(0,0,0,0.5)]">
            <span className={`font-[family-name:var(--font-orbitron)] font-black text-lg tracking-[0.15em] ${isUrgent ? "text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]" : "text-white"}`}>
              {phase === "waiting" ? "ESPERANDO..." : phase === "warmup" ? `PREPARANDO... ${fmtTime(displayTime)}` : fmtTime(displayTime)}
            </span>
          </div>
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
        video={mySide !== "Audience"}
        audio={mySide !== "Audience"}
        className="flex-1 flex flex-col min-h-[220px]"
      >
        <RoomWatcher playerA={playerA?.username} playerB={playerB?.username} onBothConnected={setBothConnected} />
        
        <div className="grid grid-cols-2 gap-2 flex-1 relative">
          {mySide !== "Audience" && <LocalControls isWarmup={phase === "warmup" || phase === "waiting"} />}

          <div className={`relative rounded-3xl overflow-hidden border border-[#ff007a]/15 select-none ${phase === "battle" ? "cursor-pointer" : "cursor-not-allowed opacity-80"}`} onClick={(e) => handleTap("A", e)}>
            <div className="absolute inset-0 bg-[#0d0008]" />
            <BattleVideo expectedUsername={playerA?.username} phase={phase} />
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-[1]">
              {(!playerA?.username || phase === "warmup" || phase === "waiting") && (
                <>
                  {playerA && <img src={playerA.avatar_url || "https://i.pravatar.cc/150"} className="w-12 h-12 rounded-full mb-2 opacity-50" />}
                  <span className="text-[#ff007a]/8 font-black text-7xl">A</span>
                </>
              )}
            </div>
            <motion.div className="absolute inset-0 z-[1] rounded-3xl pointer-events-none" animate={glowA ? { boxShadow: ["inset 0 0 40px #ff007a40", "inset 0 0 80px #ff007a60", "inset 0 0 40px #ff007a40"] } : {}} />
            <div className="absolute top-3 left-3 z-10 bg-black/40 backdrop-blur-md px-3 py-1 rounded-full border border-white/10 pointer-events-none"><span className="font-black text-sm text-[#ff007a]">{displayA.toLocaleString()}</span></div>
            <AnimatePresence>
              {tapsA.map(t => (
                <motion.div key={t.id} className="absolute z-20 pointer-events-none" style={{ left: `${t.x}%`, top: `${t.y}%` }} initial={{ opacity: 0.6, scale: 0.6 }} animate={{ opacity: 0, scale: 1.8, y: -150, x: (Math.random()-0.5)*50 }} transition={{ duration: 1.2, ease: "easeOut" }}><Heart size={24} color="#ff007a" fill="none" strokeWidth={1.5} style={{ filter: "drop-shadow(0 0 8px #ff007a)" }} /></motion.div>
              ))}
            </AnimatePresence>
          </div>

          <div className={`relative rounded-3xl overflow-hidden border border-[#00d1ff]/15 select-none ${phase === "battle" ? "cursor-pointer" : "cursor-not-allowed opacity-80"}`} onClick={(e) => handleTap("B", e)}>
            <div className="absolute inset-0 bg-[#000810]" />
            <BattleVideo expectedUsername={playerB?.username} phase={phase} />
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-[1]">
              {(!playerB?.username || phase === "warmup" || phase === "waiting") && (
                <>
                  {playerB && <img src={playerB.avatar_url || "https://i.pravatar.cc/150"} className="w-12 h-12 rounded-full mb-2 opacity-50" />}
                  <span className="text-[#00d1ff]/8 font-black text-7xl">B</span>
                </>
              )}
            </div>
            <motion.div className="absolute inset-0 z-[1] rounded-3xl pointer-events-none" animate={glowB ? { boxShadow: ["inset 0 0 40px #00d1ff40", "inset 0 0 80px #00d1ff60", "inset 0 0 40px #00d1ff40"] } : {}} />
            <div className="absolute top-3 right-3 z-10 bg-black/40 backdrop-blur-md px-3 py-1 rounded-full border border-white/10 pointer-events-none"><span className="font-black text-sm text-[#00d1ff]">{displayB.toLocaleString()}</span></div>
            <AnimatePresence>
              {tapsB.map(t => (
                <motion.div key={t.id} className="absolute z-20 pointer-events-none" style={{ left: `${t.x}%`, top: `${t.y}%` }} initial={{ opacity: 0.6, scale: 0.6 }} animate={{ opacity: 0, scale: 1.8, y: -150, x: (Math.random()-0.5)*50 }} transition={{ duration: 1.2, ease: "easeOut" }}><Heart size={24} color="#00d1ff" fill="none" strokeWidth={1.5} style={{ filter: "drop-shadow(0 0 8px #00d1ff)" }} /></motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </LiveKitRoom>

      <div className="mt-3 h-32 bg-black/40 backdrop-blur-xl rounded-[28px] p-3 flex flex-col border border-white/5 relative flex-shrink-0">
        <div className="flex-1 overflow-y-auto space-y-1.5 mb-2 pr-1 flex flex-col">
          {messages.map(msg => {
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
          <input type="text" value={newMessage} onChange={e => setNewMessage(e.target.value)} onKeyDown={e => e.key === "Enter" && sendMsg()} placeholder="Type a message..." className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-4 py-2 text-white text-xs placeholder-white/20 focus:outline-none focus:border-[#00d1ff]/40" />
          <button onClick={async () => { setShowGiftSheet(true); if(user) setBalance(await getUserBalance(user.id)); }} disabled={phase !== "battle"} className="p-2 text-white/30 hover:text-[#ffd700] disabled:opacity-20 transition-colors"><Gift size={20} /></button>
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
                  <span className="text-sm font-black text-[#ffd700]">{fmtCR(balance)}</span>
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
                <button disabled={!selectedGiftKey || isSending || phase !== "battle"} onClick={() => { if(selectedGiftKey) { sendGift("A", selectedGiftKey); setShowGiftSheet(false); }}} className="py-4 bg-[#ff007a] disabled:opacity-20 text-white rounded-2xl font-black uppercase tracking-widest text-xs">Enviar a A</button>
                <button disabled={!selectedGiftKey || isSending || phase !== "battle"} onClick={() => { if(selectedGiftKey) { sendGift("B", selectedGiftKey); setShowGiftSheet(false); }}} className="py-4 bg-[#00d1ff] disabled:opacity-20 text-white rounded-2xl font-black uppercase tracking-widest text-xs">Enviar a B</button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {phase === "finished" && (
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
                  </div>
                ) : (
                   <h1 className="text-4xl font-black italic tracking-tight uppercase text-white drop-shadow-[0_0_15px_#fff]">EMPATE</h1>
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
