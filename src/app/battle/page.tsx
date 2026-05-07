"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Wallet, Heart, Zap, ChevronDown, ChevronUp } from "lucide-react";
import confetti from "canvas-confetti";
import { createClient } from "@/utils/supabase/client";
import { GIFT_CATALOG, formatCR, type GiftKey } from "./gifts";
import { useAnimatedCount } from "./useAnimatedCount";

// ─── Types ───
interface FloatTap { id: number; x: number; y: number; emoji: string; color: string }
interface Particle { id: number; x: number; y: number; color: string; size: number }

// ─── Constants ───
const BATTLE_DURATION = 180; // 3 minutes
const TAP_EMOJIS = ["💖","⚡","🔥","✨","💎"];
const TAP_COLORS = ["#ff007a","#00d1ff","#e056fd","#ffd700","#a0f0a0"];

export default function BattleView() {
  const supabase = createClient();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [balance, setBalance] = useState(0);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [giftsOpen, setGiftsOpen] = useState(false);
  const [shaking, setShaking] = useState(false);
  const messagesEnd = useRef<HTMLDivElement>(null);

  // Scores
  const [rawA, setRawA] = useState(0);
  const [rawB, setRawB] = useState(0);
  const displayA = useAnimatedCount(rawA);
  const displayB = useAnimatedCount(rawB);
  const total = (rawA + rawB) || 1;

  // Timer
  const [timeLeft, setTimeLeft] = useState(BATTLE_DURATION);
  const isUrgent = timeLeft <= 30;
  const isCritical = timeLeft <= 10;

  // Particles
  const [tapsA, setTapsA] = useState<FloatTap[]>([]);
  const [tapsB, setTapsB] = useState<FloatTap[]>([]);
  const [particles, setParticles] = useState<Particle[]>([]);

  // ─── Init ───
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUser(user);
      const { data: p } = await supabase.from("profiles").select("username").eq("id", user.id).single();
      if (p) setProfile(p);
      const { data: w } = await supabase.from("wallets").select("balance").eq("user_id", user.id).single();
      if (w) setBalance(w.balance);
    })();

    const ch = supabase.channel("battle-room")
      .on("broadcast", { event: "chat" }, ({ payload }) => setMessages(p => [...p, payload]))
      .on("broadcast", { event: "score" }, ({ payload }) => {
        if (payload.side === "A") setRawA(p => p + payload.amount);
        else setRawB(p => p + payload.amount);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [supabase]);

  // Timer countdown
  useEffect(() => {
    if (timeLeft <= 0) return;
    const t = setInterval(() => setTimeLeft(p => Math.max(0, p - 1)), 1000);
    return () => clearInterval(t);
  }, [timeLeft]);

  // Auto-scroll chat
  useEffect(() => { messagesEnd.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  // ─── Format time ───
  const fmtTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  // ─── Tap handler (free interaction) ───
  const handleTap = (side: "A" | "B", e: React.MouseEvent | React.TouchEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    const x = ((clientX - rect.left) / rect.width) * 100;
    const y = ((clientY - rect.top) / rect.height) * 100;
    const i = Math.floor(Math.random() * TAP_EMOJIS.length);
    const tap: FloatTap = { id: Date.now() + Math.random(), x, y, emoji: TAP_EMOJIS[i], color: TAP_COLORS[i] };

    if (side === "A") {
      setTapsA(p => [...p.slice(-15), tap]);
      setRawA(p => p + 1);
    } else {
      setTapsB(p => [...p.slice(-15), tap]);
      setRawB(p => p + 1);
    }
    // Broadcast
    supabase.channel("battle-room").send({ type: "broadcast", event: "score", payload: { side, amount: 1 } });
  };

  // ─── Screen shake ───
  const triggerShake = () => { setShaking(true); setTimeout(() => setShaking(false), 500); };

  // ─── Premium confetti ───
  const firePremiumConfetti = (color: string) => {
    const colors = [color, "#ffd700", "#00d1ff", "#ffffff"];
    confetti({ particleCount: 120, spread: 90, origin: { y: 0.5 }, colors, gravity: 0.8, scalar: 1.2 });
    setTimeout(() => confetti({ particleCount: 80, spread: 120, origin: { y: 0.4 }, colors, gravity: 0.6 }), 200);
    triggerShake();
  };

  // ─── Burst particles for small gifts ───
  const burstParticles = (color: string, count: number) => {
    const ps: Particle[] = Array.from({ length: count }, (_, i) => ({
      id: Date.now() + i, x: 30 + Math.random() * 40, y: 20 + Math.random() * 60,
      color, size: 4 + Math.random() * 8,
    }));
    setParticles(p => [...p, ...ps]);
    setTimeout(() => setParticles(p => p.filter(x => !ps.find(n => n.id === x.id))), 1400);
  };

  // ─── Deduct + record ───
  const deductCredits = useCallback(async (cost: number) => {
    if (balance < cost) { alert(`Need ${cost.toLocaleString()} CR`); return false; }
    const nb = balance - cost;
    setBalance(nb);
    const { error } = await supabase.from("wallets").update({ balance: nb, updated_at: new Date().toISOString() }).eq("user_id", user.id);
    if (error) { setBalance(balance); alert("Error: " + error.message); return false; }
    return true;
  }, [balance, user, supabase]);

  const recordGift = useCallback(async (label: string, cost: number) => {
    if (!user) return;
    await supabase.from("transactions").insert({
      user_id: user.id, type: "gift", amount_credits: cost, amount_bs: 0,
      reference_number: `Gift: ${label}`, status: "approved",
    });
  }, [user, supabase]);

  // ─── Send gift ───
  const sendGift = async (side: "A" | "B", giftKey: GiftKey) => {
    if (!profile || !user || isSending) return;
    const gift = GIFT_CATALOG.find(g => g.key === giftKey)!;
    setIsSending(true);

    if (!(await deductCredits(gift.cost))) { setIsSending(false); return; }
    await recordGift(gift.label, gift.cost);

    // Animations by tier
    if (gift.tier === 3) firePremiumConfetti(gift.color);
    else burstParticles(gift.color, gift.tier === 2 ? 12 : 6);

    // Score
    if (side === "A") setRawA(p => p + gift.cost);
    else setRawB(p => p + gift.cost);

    await supabase.channel("battle-room").send({ type: "broadcast", event: "score", payload: { side, amount: gift.cost } });

    const msg = { id: Date.now(), username: profile.username, text: `sent ${gift.label} (${formatCR(gift.cost)} CR)`, isGift: true, color: gift.color, tier: gift.tier };
    await supabase.channel("battle-room").send({ type: "broadcast", event: "chat", payload: msg });
    setMessages(p => [...p, msg]);
    setIsSending(false);
  };

  // ─── Chat ───
  const sendMsg = async () => {
    if (!newMessage.trim() || !profile) return;
    const msg = { id: Date.now(), username: profile.username, text: newMessage, isGift: false };
    await supabase.channel("battle-room").send({ type: "broadcast", event: "chat", payload: msg });
    setMessages(p => [...p, msg]);
    setNewMessage("");
  };

  const visibleGifts = giftsOpen ? GIFT_CATALOG : GIFT_CATALOG.slice(0, 5);

  return (
    <motion.div
      animate={shaking ? { x: [0, -6, 6, -4, 4, 0], y: [0, 3, -3, 2, -2, 0] } : {}}
      transition={{ duration: 0.5 }}
      className="flex-1 flex flex-col p-3 max-w-7xl w-full mx-auto relative overflow-hidden"
    >
      {/* ══ Floating burst particles ══ */}
      <AnimatePresence>
        {particles.map(p => (
          <motion.div key={p.id} className="fixed pointer-events-none z-50 rounded-full"
            initial={{ opacity: 1, scale: 0.5 }} animate={{ opacity: 0, scale: 2, y: -100 }}
            exit={{ opacity: 0 }} transition={{ duration: 1.2 }}
            style={{ left: `${p.x}%`, top: `${p.y}%`, width: p.size, height: p.size, background: p.color, boxShadow: `0 0 12px ${p.color}` }}
          />
        ))}
      </AnimatePresence>

      {/* ══ Balance ══ */}
      <div className="flex items-center justify-end gap-2 mb-1">
        <Wallet size={13} className="text-[#00d1ff]" />
        <span className="text-xs font-bold text-[#00d1ff]">{balance.toLocaleString()} CR</span>
      </div>

      {/* ══ Energy Bar + Timer ══ */}
      <div className="relative w-full h-10 rounded-full overflow-hidden mb-3 border border-white/10">
        {/* BG */}
        <div className="absolute inset-0 bg-black/60 backdrop-blur-md" />

        {/* Progress A */}
        <motion.div className="absolute inset-y-0 left-0 bg-gradient-to-r from-[#ff007a] to-[#ff007a]/60"
          animate={{ width: `${(rawA / total) * 100}%` }} transition={{ type: "spring", stiffness: 50, damping: 18 }}
        />
        {/* Progress B */}
        <motion.div className="absolute inset-y-0 right-0 bg-gradient-to-l from-[#00d1ff] to-[#00d1ff]/60"
          animate={{ width: `${(rawB / total) * 100}%` }} transition={{ type: "spring", stiffness: 50, damping: 18 }}
        />

        {/* Light sweep */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute inset-y-0 w-20 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-[sweep_3s_linear_infinite]" />
        </div>

        {/* Timer */}
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <motion.span
            animate={isCritical ? { scale: [1, 1.15, 1], opacity: [1, 0.6, 1] } : isUrgent ? { color: "#ff4444" } : {}}
            transition={isCritical ? { repeat: Infinity, duration: 1 } : {}}
            className={`font-[family-name:var(--font-orbitron)] font-black text-lg tracking-[0.15em] drop-shadow-lg ${isUrgent ? "text-red-400" : "text-white"}`}
          >
            {fmtTime(timeLeft)}
          </motion.span>
        </div>

        {/* Critical pulse overlay */}
        {isCritical && (
          <motion.div className="absolute inset-0 border-2 border-red-500 rounded-full"
            animate={{ opacity: [0, 0.6, 0] }} transition={{ repeat: Infinity, duration: 1 }}
          />
        )}
      </div>

      {/* ══ Arena ══ */}
      <div className="grid grid-cols-2 gap-2 flex-1 min-h-[240px] md:min-h-[340px]">

        {/* Player A */}
        <div className="relative rounded-2xl overflow-hidden border border-[#ff007a]/15 cursor-pointer select-none"
          onClick={(e) => handleTap("A", e)} onTouchStart={(e) => handleTap("A", e as any)}
        >
          <div className="absolute inset-0 bg-[#0d0008]" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent z-[2]" />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-[#ff007a]/8 font-black text-7xl select-none">A</span>
          </div>

          {/* Pulsing glow */}
          <motion.div className="absolute inset-0 z-[1]"
            animate={{ boxShadow: ["inset 0 0 30px #ff007a15", "inset 0 0 60px #ff007a25", "inset 0 0 30px #ff007a15"] }}
            transition={{ repeat: Infinity, duration: 2 }}
          />

          {/* Score */}
          <div className="absolute top-3 left-3 z-10 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full border border-[#ff007a]/20">
            <span className="font-[family-name:var(--font-orbitron)] font-bold text-sm text-[#ff007a]">{displayA.toLocaleString()}</span>
          </div>

          {/* Floating taps */}
          <AnimatePresence>
            {tapsA.slice(-10).map(t => (
              <motion.div key={t.id} className="absolute z-20 text-2xl pointer-events-none"
                style={{ left: `${t.x}%`, top: `${t.y}%` }}
                initial={{ opacity: 1, scale: 0.3, y: 0 }} animate={{ opacity: 0, scale: 1.5, y: -120, x: (Math.random() - 0.5) * 60 }}
                exit={{ opacity: 0 }} transition={{ duration: 1, ease: "easeOut" }}
              >{t.emoji}</motion.div>
            ))}
          </AnimatePresence>

          <div className="absolute bottom-3 inset-x-3 z-10 text-center">
            <span className="text-[10px] text-white/30 uppercase tracking-widest">Tap to support</span>
          </div>
        </div>

        {/* Player B */}
        <div className="relative rounded-2xl overflow-hidden border border-[#00d1ff]/15 cursor-pointer select-none"
          onClick={(e) => handleTap("B", e)} onTouchStart={(e) => handleTap("B", e as any)}
        >
          <div className="absolute inset-0 bg-[#000810]" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent z-[2]" />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-[#00d1ff]/8 font-black text-7xl select-none">B</span>
          </div>

          <motion.div className="absolute inset-0 z-[1]"
            animate={{ boxShadow: ["inset 0 0 30px #00d1ff15", "inset 0 0 60px #00d1ff25", "inset 0 0 30px #00d1ff15"] }}
            transition={{ repeat: Infinity, duration: 2 }}
          />

          <div className="absolute top-3 right-3 z-10 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full border border-[#00d1ff]/20">
            <span className="font-[family-name:var(--font-orbitron)] font-bold text-sm text-[#00d1ff]">{displayB.toLocaleString()}</span>
          </div>

          <AnimatePresence>
            {tapsB.slice(-10).map(t => (
              <motion.div key={t.id} className="absolute z-20 text-2xl pointer-events-none"
                style={{ left: `${t.x}%`, top: `${t.y}%` }}
                initial={{ opacity: 1, scale: 0.3, y: 0 }} animate={{ opacity: 0, scale: 1.5, y: -120, x: (Math.random() - 0.5) * 60 }}
                exit={{ opacity: 0 }} transition={{ duration: 1, ease: "easeOut" }}
              >{t.emoji}</motion.div>
            ))}
          </AnimatePresence>

          <div className="absolute bottom-3 inset-x-3 z-10 text-center">
            <span className="text-[10px] text-white/30 uppercase tracking-widest">Tap to support</span>
          </div>
        </div>
      </div>

      {/* ══ Gift Tray ══ */}
      <div className="mt-3 bg-black/40 backdrop-blur-md rounded-2xl p-2.5 border border-white/5">
        <div className="flex items-center justify-between px-1 mb-2">
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/30">Gifts</span>
          <button onClick={() => setGiftsOpen(!giftsOpen)} className="text-white/30 hover:text-white/60 text-[10px] flex items-center gap-0.5">
            {giftsOpen ? "Less" : "All 10"} {giftsOpen ? <ChevronUp size={12}/> : <ChevronDown size={12}/>}
          </button>
        </div>
        <div className="grid grid-cols-5 gap-1">
          <AnimatePresence mode="popLayout">
            {visibleGifts.map(gift => {
              const Icon = gift.icon;
              const ok = balance >= gift.cost;
              return (
                <motion.div key={gift.key} layout initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ type: "spring", stiffness: 300, damping: 25 }} className="flex flex-col items-center"
                >
                  <div className="flex gap-px w-full">
                    {(["A","B"] as const).map(side => (
                      <motion.button key={side} onClick={() => sendGift(side, gift.key)} disabled={isSending || !ok}
                        whileHover={ok ? { scale: 1.1 } : {}} whileTap={ok ? { scale: 0.85 } : {}}
                        className={`flex-1 flex flex-col items-center py-1.5 ${side === "A" ? "rounded-l-lg" : "rounded-r-lg"} border border-white/5 disabled:opacity-25 transition-all`}
                        style={{ background: ok ? `linear-gradient(135deg,${gift.color}08,${gift.color}18)` : "transparent" }}
                      >
                        <Icon size={15} style={{ color: ok ? gift.color : "rgba(255,255,255,0.15)" }} />
                        <span className={`text-[7px] font-bold mt-0.5 ${side === "A" ? "text-[#ff007a]/50" : "text-[#00d1ff]/50"}`}>{side}</span>
                      </motion.button>
                    ))}
                  </div>
                  <span className="text-[8px] font-medium mt-0.5 text-white/40 truncate w-full text-center">{gift.label}</span>
                  <span className="text-[8px] font-bold" style={{ color: ok ? gift.color : "rgba(255,255,255,0.15)" }}>{formatCR(gift.cost)}</span>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>

      {/* ══ Chat ══ */}
      <div className="mt-2 h-36 bg-black/30 backdrop-blur-md rounded-2xl p-2.5 flex flex-col border border-white/5 relative overflow-hidden flex-shrink-0">
        <div className="flex-1 overflow-y-auto space-y-1 mb-2 pr-1 flex flex-col">
          {messages.length === 0 && <div className="text-white/20 text-[10px] text-center mt-auto mb-2">Send a gift or tap to get started</div>}
          {messages.map(msg => (
            <div key={msg.id} className="text-[11px] py-1 px-2 rounded-lg w-max max-w-[92%] flex gap-1.5 items-start border border-white/[0.04]"
              style={msg.isGift ? { background: `linear-gradient(135deg,${msg.color||"#ff007a"}10,transparent)`, boxShadow: msg.tier >= 3 ? `0 0 10px ${msg.color}20` : "none" } : { background: "rgba(0,0,0,0.3)" }}
            >
              <span className="font-bold whitespace-nowrap" style={{ color: msg.isGift ? msg.color : "#00d1ff" }}>@{msg.username}</span>
              <span className={msg.isGift ? "text-white/80 italic" : "text-white/60"}>{msg.text}</span>
            </div>
          ))}
          <div ref={messagesEnd} />
        </div>
        <div className="flex gap-1.5">
          <input type="text" value={newMessage} onChange={e => setNewMessage(e.target.value)} onKeyDown={e => e.key === "Enter" && sendMsg()}
            placeholder="Type a message..." className="flex-1 bg-black/40 border border-white/5 rounded-xl px-3 py-1.5 text-white text-xs placeholder-white/20 focus:outline-none focus:border-[#00d1ff]/30 transition-colors"
          />
          <button onClick={sendMsg} disabled={!newMessage.trim()} className="bg-[#00d1ff] disabled:opacity-30 text-black px-3 py-1.5 rounded-xl font-bold hover:bg-[#00d1ff]/80 transition-colors">
            <Send size={13} />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
