"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Wallet, ChevronDown, ChevronUp } from "lucide-react";
import confetti from "canvas-confetti";
import { createClient } from "@/utils/supabase/client";
import { GIFT_CATALOG, formatCR, type GiftKey } from "./gifts";
import { useAnimatedCount } from "./useAnimatedCount";

interface FloatTap { id: number; x: number; y: number; emoji: string }
const TAP_POOL = ["💖","⚡","🔥","✨","💎"];
const BATTLE_DURATION = 180;

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
  const [glowA, setGlowA] = useState(false);
  const [glowB, setGlowB] = useState(false);
  const messagesEnd = useRef<HTMLDivElement>(null);

  // Takeover overlay
  const [takeover, setTakeover] = useState<{ username: string; label: string; color: string } | null>(null);

  const [rawA, setRawA] = useState(0);
  const [rawB, setRawB] = useState(0);
  const displayA = useAnimatedCount(rawA);
  const displayB = useAnimatedCount(rawB);
  const total = (rawA + rawB) || 1;

  const [timeLeft, setTimeLeft] = useState(BATTLE_DURATION);
  const isUrgent = timeLeft <= 30;
  const isCritical = timeLeft <= 10;

  const [tapsA, setTapsA] = useState<FloatTap[]>([]);
  const [tapsB, setTapsB] = useState<FloatTap[]>([]);

  // ── Init ──
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

  useEffect(() => {
    if (timeLeft <= 0) return;
    const t = setInterval(() => setTimeLeft(p => Math.max(0, p - 1)), 1000);
    return () => clearInterval(t);
  }, [timeLeft]);

  // Auto-scroll chat only when user is already at bottom
  useEffect(() => {
    const el = messagesEnd.current?.parentElement;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
    if (atBottom) messagesEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const fmtTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  // ── Tap (free) ──
  const handleTap = (side: "A" | "B", e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    const tap: FloatTap = { id: Date.now() + Math.random(), x, y, emoji: TAP_POOL[Math.floor(Math.random() * TAP_POOL.length)] };
    if (side === "A") { setTapsA(p => [...p.slice(-12), tap]); setRawA(p => p + 1); }
    else { setTapsB(p => [...p.slice(-12), tap]); setRawB(p => p + 1); }
    supabase.channel("battle-room").send({ type: "broadcast", event: "score", payload: { side, amount: 1 } });
  };

  // ── Animations ──
  const triggerShake = (intensity: number, dur: number) => {
    setShaking(true);
    setTimeout(() => setShaking(false), dur);
  };

  const flashGlow = (side: "A" | "B") => {
    if (side === "A") { setGlowA(true); setTimeout(() => setGlowA(false), 1200); }
    else { setGlowB(true); setTimeout(() => setGlowB(false), 1200); }
  };

  const fireSupremeConfetti = () => {
    const colors = ["#ffd700", "#c0c0c0", "#ff007a", "#ffffff"];
    for (let i = 0; i < 3; i++) {
      setTimeout(() => {
        confetti({ particleCount: 170, spread: 100 + i * 20, origin: { y: 0.45 - i * 0.1 }, colors, gravity: 0.7, scalar: 1.3, ticks: 120 });
      }, i * 250);
    }
  };

  const fireMidVortex = (color: string) => {
    confetti({ particleCount: 60, spread: 360, origin: { x: 0.5, y: 0.5 }, colors: [color, "#fff", "#00d1ff"], startVelocity: 20, gravity: 0.3, scalar: 0.8, drift: 2, ticks: 80 });
  };

  const fireBaseParticles = (color: string) => {
    confetti({ particleCount: 25, spread: 50, origin: { y: 0.6 }, colors: [color, "#ffffff"], startVelocity: 15, gravity: 1, scalar: 0.7, ticks: 50 });
  };

  // ── Wallet ──
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
    await supabase.from("transactions").insert({ user_id: user.id, type: "gift", amount_credits: cost, amount_bs: 0, reference_number: `Gift: ${label}`, status: "approved" });
  }, [user, supabase]);

  // ── Send Gift (NO scroll jump) ──
  const sendGift = async (side: "A" | "B", giftKey: GiftKey) => {
    if (!profile || !user || isSending) return;
    const gift = GIFT_CATALOG.find(g => g.key === giftKey)!;
    setIsSending(true);

    if (!(await deductCredits(gift.cost))) { setIsSending(false); return; }
    await recordGift(gift.label, gift.cost);

    // Tier-based animations
    if (gift.tier === 3) {
      fireSupremeConfetti();
      triggerShake(8, 1000);
      flashGlow(side);
      setTakeover({ username: profile.username, label: gift.label, color: gift.color });
      setTimeout(() => setTakeover(null), 3000);
    } else if (gift.tier === 2) {
      fireMidVortex(gift.color);
      triggerShake(3, 400);
      flashGlow(side);
    } else {
      fireBaseParticles(gift.color);
    }

    if (side === "A") setRawA(p => p + gift.cost);
    else setRawB(p => p + gift.cost);

    await supabase.channel("battle-room").send({ type: "broadcast", event: "score", payload: { side, amount: gift.cost } });

    const msg = { id: Date.now(), username: profile.username, text: `sent ${gift.label} (${formatCR(gift.cost)} CR)`, isGift: true, color: gift.color, tier: gift.tier };
    await supabase.channel("battle-room").send({ type: "broadcast", event: "chat", payload: msg });
    setMessages(p => [...p, msg]);
    setIsSending(false);
  };

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
      animate={shaking ? { x: [0, -8, 8, -6, 6, -3, 3, 0], y: [0, 4, -4, 3, -3, 1, -1, 0] } : {}}
      transition={{ duration: 1 }}
      className="flex-1 flex flex-col p-3 max-w-7xl w-full mx-auto relative overflow-hidden"
    >
      {/* ══ FULL SCREEN TAKEOVER ══ */}
      <AnimatePresence>
        {takeover && (
          <motion.div
            className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div
              className="relative z-10 text-center"
              initial={{ scale: 0.3, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.5, opacity: 0 }}
              transition={{ type: "spring", stiffness: 200, damping: 15 }}
            >
              <motion.p
                className="text-5xl md:text-7xl font-black mb-4"
                style={{ color: takeover.color, textShadow: `0 0 40px ${takeover.color}, 0 0 80px ${takeover.color}50` }}
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ repeat: Infinity, duration: 0.8 }}
              >
                {takeover.label}
              </motion.p>
              <p className="text-xl md:text-3xl font-bold text-white/90">
                <span className="text-[#00d1ff]">@{takeover.username}</span> sent
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══ Balance ══ */}
      <div className="flex items-center justify-end gap-2 mb-1">
        <Wallet size={13} className="text-[#00d1ff]" />
        <span className="text-xs font-bold text-[#00d1ff]">{balance.toLocaleString()} CR</span>
      </div>

      {/* ══ Energy Bar + Timer ══ */}
      <div className="relative w-full h-10 rounded-full overflow-hidden mb-3 border border-white/10">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-md" />
        <motion.div className="absolute inset-y-0 left-0 bg-gradient-to-r from-[#ff007a] to-[#ff007a]/60"
          animate={{ width: `${(rawA / total) * 100}%` }} transition={{ type: "spring", stiffness: 50, damping: 18 }} />
        <motion.div className="absolute inset-y-0 right-0 bg-gradient-to-l from-[#00d1ff] to-[#00d1ff]/60"
          animate={{ width: `${(rawB / total) * 100}%` }} transition={{ type: "spring", stiffness: 50, damping: 18 }} />
        <div className="absolute inset-0 overflow-hidden"><div className="absolute inset-y-0 w-20 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-[sweep_3s_linear_infinite]" /></div>
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <motion.span
            animate={isCritical ? { scale: [1, 1.15, 1], opacity: [1, 0.6, 1] } : {}}
            transition={isCritical ? { repeat: Infinity, duration: 1 } : {}}
            className={`font-[family-name:var(--font-orbitron)] font-black text-lg tracking-[0.15em] drop-shadow-lg ${isUrgent ? "text-red-400" : "text-white"}`}
          >{fmtTime(timeLeft)}</motion.span>
        </div>
        {isCritical && <motion.div className="absolute inset-0 border-2 border-red-500 rounded-full" animate={{ opacity: [0, 0.6, 0] }} transition={{ repeat: Infinity, duration: 1 }} />}
      </div>

      {/* ══ Arena ══ */}
      <div className="grid grid-cols-2 gap-2 flex-1 min-h-[220px] md:min-h-[320px]">
        {/* Player A */}
        <div className="relative rounded-2xl overflow-hidden border border-[#ff007a]/15 cursor-pointer select-none" onClick={(e) => handleTap("A", e)}>
          <div className="absolute inset-0 bg-[#0d0008]" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent z-[2]" />
          <div className="absolute inset-0 flex items-center justify-center"><span className="text-[#ff007a]/8 font-black text-7xl select-none">A</span></div>
          <motion.div className="absolute inset-0 z-[1] rounded-2xl"
            animate={glowA
              ? { boxShadow: ["inset 0 0 40px #ff007a50, 0 0 60px #ff007a30", "inset 0 0 80px #ff007a70, 0 0 100px #ff007a50", "inset 0 0 40px #ff007a50, 0 0 60px #ff007a30"] }
              : { boxShadow: ["inset 0 0 20px #ff007a10", "inset 0 0 40px #ff007a18", "inset 0 0 20px #ff007a10"] }}
            transition={{ repeat: Infinity, duration: glowA ? 0.4 : 2 }} />
          <div className="absolute top-3 left-3 z-10 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full border border-[#ff007a]/20">
            <span className="font-[family-name:var(--font-orbitron)] font-bold text-sm text-[#ff007a]">{displayA.toLocaleString()}</span>
          </div>
          <AnimatePresence>
            {tapsA.slice(-8).map(t => (
              <motion.div key={t.id} className="absolute z-20 text-2xl pointer-events-none" style={{ left: `${t.x}%`, top: `${t.y}%` }}
                initial={{ opacity: 1, scale: 0.3, y: 0 }} animate={{ opacity: 0, scale: 1.5, y: -100, x: (Math.random() - 0.5) * 50 }}
                exit={{ opacity: 0 }} transition={{ duration: 0.9, ease: "easeOut" }}>{t.emoji}</motion.div>
            ))}
          </AnimatePresence>
          <div className="absolute bottom-3 inset-x-3 z-10 text-center"><span className="text-[9px] text-white/25 uppercase tracking-widest">Tap to support</span></div>
        </div>

        {/* Player B */}
        <div className="relative rounded-2xl overflow-hidden border border-[#00d1ff]/15 cursor-pointer select-none" onClick={(e) => handleTap("B", e)}>
          <div className="absolute inset-0 bg-[#000810]" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent z-[2]" />
          <div className="absolute inset-0 flex items-center justify-center"><span className="text-[#00d1ff]/8 font-black text-7xl select-none">B</span></div>
          <motion.div className="absolute inset-0 z-[1] rounded-2xl"
            animate={glowB
              ? { boxShadow: ["inset 0 0 40px #00d1ff50, 0 0 60px #00d1ff30", "inset 0 0 80px #00d1ff70, 0 0 100px #00d1ff50", "inset 0 0 40px #00d1ff50, 0 0 60px #00d1ff30"] }
              : { boxShadow: ["inset 0 0 20px #00d1ff10", "inset 0 0 40px #00d1ff18", "inset 0 0 20px #00d1ff10"] }}
            transition={{ repeat: Infinity, duration: glowB ? 0.4 : 2 }} />
          <div className="absolute top-3 right-3 z-10 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full border border-[#00d1ff]/20">
            <span className="font-[family-name:var(--font-orbitron)] font-bold text-sm text-[#00d1ff]">{displayB.toLocaleString()}</span>
          </div>
          <AnimatePresence>
            {tapsB.slice(-8).map(t => (
              <motion.div key={t.id} className="absolute z-20 text-2xl pointer-events-none" style={{ left: `${t.x}%`, top: `${t.y}%` }}
                initial={{ opacity: 1, scale: 0.3, y: 0 }} animate={{ opacity: 0, scale: 1.5, y: -100, x: (Math.random() - 0.5) * 50 }}
                exit={{ opacity: 0 }} transition={{ duration: 0.9, ease: "easeOut" }}>{t.emoji}</motion.div>
            ))}
          </AnimatePresence>
          <div className="absolute bottom-3 inset-x-3 z-10 text-center"><span className="text-[9px] text-white/25 uppercase tracking-widest">Tap to support</span></div>
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
                  transition={{ type: "spring", stiffness: 300, damping: 25 }} className="flex flex-col items-center">
                  <div className="flex gap-px w-full">
                    {(["A","B"] as const).map(side => (
                      <motion.button key={side} onClick={(e) => { e.stopPropagation(); sendGift(side, gift.key); }}
                        disabled={isSending || !ok} whileHover={ok ? { scale: 1.1 } : {}} whileTap={ok ? { scale: 0.85 } : {}}
                        className={`flex-1 flex flex-col items-center py-1.5 ${side === "A" ? "rounded-l-lg" : "rounded-r-lg"} border border-white/5 disabled:opacity-25 transition-all`}
                        style={{ background: ok ? `linear-gradient(135deg,${gift.color}08,${gift.color}18)` : "transparent" }}>
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
      <div className="mt-2 h-32 bg-black/30 backdrop-blur-md rounded-2xl p-2.5 flex flex-col border border-white/5 relative overflow-hidden flex-shrink-0">
        <div className="flex-1 overflow-y-auto space-y-1 mb-2 pr-1 flex flex-col">
          {messages.length === 0 && <div className="text-white/20 text-[10px] text-center mt-auto mb-2">Send a gift or tap to get started</div>}
          {messages.map(msg => (
            <div key={msg.id} className="text-[11px] py-1 px-2 rounded-lg w-max max-w-[92%] flex gap-1.5 items-start border border-white/[0.04]"
              style={msg.isGift ? { background: `linear-gradient(135deg,${msg.color||"#ff007a"}10,transparent)`, boxShadow: msg.tier>=3 ? `0 0 10px ${msg.color}20` : "none" } : { background: "rgba(0,0,0,0.3)" }}>
              <span className="font-bold whitespace-nowrap" style={{ color: msg.isGift ? msg.color : "#00d1ff" }}>@{msg.username}</span>
              <span className={msg.isGift ? "text-white/80 italic" : "text-white/60"}>{msg.text}</span>
            </div>
          ))}
          <div ref={messagesEnd} />
        </div>
        <div className="flex gap-1.5">
          <input type="text" value={newMessage} onChange={e => setNewMessage(e.target.value)} onKeyDown={e => e.key === "Enter" && sendMsg()}
            placeholder="Type a message..." className="flex-1 bg-black/40 border border-white/5 rounded-xl px-3 py-1.5 text-white text-xs placeholder-white/20 focus:outline-none focus:border-[#00d1ff]/30" />
          <button onClick={sendMsg} disabled={!newMessage.trim()} className="bg-[#00d1ff] disabled:opacity-30 text-black px-3 py-1.5 rounded-xl font-bold hover:bg-[#00d1ff]/80">
            <Send size={13} />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
