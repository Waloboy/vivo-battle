"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, Star, Zap, Flame, Send, Wallet, Loader2 } from "lucide-react";
import { createClient } from "@/utils/supabase/client";

const GIFTS = {
  rosa:   { label: "Rosa",    cost: 100,  emoji: "🌹", icon: Heart,  color: "#ff007a" },
  fuego:  { label: "Fuego",   cost: 1000, emoji: "🔥", icon: Flame,  color: "#ff007a" },
  estrella:{ label: "Estrella",cost: 100, emoji: "⭐", icon: Star,   color: "#00d1ff" },
  rayo:   { label: "Rayo",    cost: 1000, emoji: "⚡", icon: Zap,    color: "#00d1ff" },
};

export default function BattleView() {
  const supabase = createClient();
  const [user, setUser]       = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [balance, setBalance] = useState<number>(0);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [scoreA, setScoreA] = useState(0);
  const [scoreB, setScoreB] = useState(0);
  const [particlesA, setParticlesA] = useState<{ id: number; x: number; y: number; emoji: string }[]>([]);
  const [particlesB, setParticlesB] = useState<{ id: number; x: number; y: number; emoji: string }[]>([]);

  const totalScore = (scoreA + scoreB) || 1;
  const percentA   = (scoreA / totalScore) * 100;

  // ── Init: load user, wallet, subscribe to realtime ──
  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUser(user);

      const { data: profile } = await supabase
        .from("profiles").select("username").eq("id", user.id).single();
      if (profile) setProfile(profile);

      const { data: wallet } = await supabase
        .from("wallets").select("balance").eq("user_id", user.id).single();
      if (wallet) setBalance(wallet.balance);
    };
    init();

    const channel = supabase.channel("battle-room")
      .on("broadcast", { event: "chat" }, ({ payload }) => {
        setMessages(prev => [...prev, payload]);
      })
      .on("broadcast", { event: "score" }, ({ payload }) => {
        if (payload.side === "A") setScoreA((p) => p + payload.amount);
        else                      setScoreB((p) => p + payload.amount);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [supabase]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Deduct credits from wallet ──
  const deductCredits = async (cost: number): Promise<boolean> => {
    if (balance < cost) {
      alert(`No tienes suficientes créditos. Necesitas ${cost} CR.`);
      return false;
    }
    const newBalance = balance - cost;
    const { error } = await supabase
      .from("wallets")
      .update({ balance: newBalance, updated_at: new Date().toISOString() })
      .eq("user_id", user.id);
    if (error) { alert("Error al descontar créditos: " + error.message); return false; }
    setBalance(newBalance);
    return true;
  };

  // ── Send gift ──
  const sendGift = async (side: "A" | "B", giftKey: keyof typeof GIFTS) => {
    if (!profile || !user || isSending) return;
    const gift = GIFTS[giftKey];
    setIsSending(true);

    const ok = await deductCredits(gift.cost);
    if (!ok) { setIsSending(false); return; }

    // Broadcast score update to all viewers
    await supabase.channel("battle-room").send({
      type: "broadcast", event: "score",
      payload: { side, amount: gift.cost },
    });

    // Broadcast chat message
    const msg = {
      id: Date.now(),
      username: profile.username,
      text: `envió ${gift.emoji} ${gift.label} (${gift.cost} CR)`,
      isGift: true,
      color: gift.color,
    };
    await supabase.channel("battle-room").send({
      type: "broadcast", event: "chat", payload: msg,
    });
    setMessages(prev => [...prev, msg]);

    // Local particle burst
    const particle = { id: Date.now(), x: Math.random() * 80 + 10, y: Math.random() * 60, emoji: gift.emoji };
    if (side === "A") {
      setParticlesA(p => [...p, particle]);
      setTimeout(() => setParticlesA(p => p.filter(x => x.id !== particle.id)), 1200);
    } else {
      setParticlesB(p => [...p, particle]);
      setTimeout(() => setParticlesB(p => p.filter(x => x.id !== particle.id)), 1200);
    }

    setIsSending(false);
  };

  // ── Send chat ──
  const sendMessage = async (text: string) => {
    if (!text.trim() || !profile) return;
    const msg = { id: Date.now(), username: profile.username, text, isGift: false };
    await supabase.channel("battle-room").send({
      type: "broadcast", event: "chat", payload: msg,
    });
    setMessages(prev => [...prev, msg]);
    setNewMessage("");
  };

  return (
    <div className="flex-1 flex flex-col p-4 max-w-7xl w-full mx-auto relative overflow-hidden">

      {/* Balance indicator */}
      <div className="flex items-center justify-end gap-2 mb-2">
        <Wallet size={14} className="text-[#00d1ff]" />
        <span className="text-sm font-bold text-[#00d1ff]">{balance.toLocaleString()} CR</span>
      </div>

      {/* Versus Bar */}
      <div className="w-full h-12 cyber-glass rounded-full overflow-hidden flex relative mb-8 border-2 border-white/10">
        <div className="absolute inset-0 flex items-center justify-center z-10 font-black text-xl italic tracking-widest drop-shadow-lg">
          VS
        </div>
        <motion.div
          className="h-full bg-gradient-to-r from-[#ff007a]/80 to-[#ff007a]"
          animate={{ width: `${percentA}%` }}
          transition={{ type: "spring", stiffness: 50, damping: 15 }}
        />
        <motion.div
          className="h-full bg-gradient-to-l from-[#00d1ff]/80 to-[#00d1ff]"
          animate={{ width: `${100 - percentA}%` }}
          transition={{ type: "spring", stiffness: 50, damping: 15 }}
        />
      </div>

      <div className="flex-1 grid grid-cols-2 gap-4 md:gap-8 min-h-0">

        {/* ── Player A ── */}
        <div className="relative rounded-3xl overflow-hidden cyber-glass border-[#ff007a]/30 border-2 glow-primary flex flex-col min-h-[320px]">
          <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent z-10" />
          <div className="absolute inset-0 bg-[#1a000c] flex items-center justify-center">
            <span className="text-[#ff007a]/20 font-black text-6xl rotate-[-15deg]">PLAYER A</span>
          </div>

          <div className="absolute top-4 left-4 z-20 cyber-glass px-4 py-2 rounded-full font-bold text-[#ff007a]">
            {scoreA.toLocaleString()} CR
          </div>

          <AnimatePresence>
            {particlesA.map(p => (
              <motion.div
                key={p.id}
                initial={{ opacity: 1, y: 0, scale: 0.5 }}
                animate={{ opacity: 0, y: -200, scale: 2 }}
                exit={{ opacity: 0 }}
                className="absolute z-20 text-3xl pointer-events-none"
                style={{ left: `${p.x}%`, bottom: "20%" }}
              >
                {p.emoji}
              </motion.div>
            ))}
          </AnimatePresence>

          <div className="mt-auto relative z-20 p-3 grid grid-cols-2 gap-2">
            <button
              onClick={() => sendGift("A", "rosa")}
              disabled={isSending || balance < GIFTS.rosa.cost}
              className="bg-[#ff007a]/20 hover:bg-[#ff007a]/40 disabled:opacity-40 border border-[#ff007a]/50 rounded-xl p-3 flex flex-col items-center justify-center transition-colors backdrop-blur-md"
            >
              <Heart size={22} className="text-[#ff007a] mb-1" />
              <span className="text-xs font-bold">Rosa</span>
              <span className="text-[10px] text-white/50">100 CR</span>
            </button>
            <button
              onClick={() => sendGift("A", "fuego")}
              disabled={isSending || balance < GIFTS.fuego.cost}
              className="bg-[#ff007a] hover:bg-[#ff007a]/80 disabled:opacity-40 text-white rounded-xl p-3 flex flex-col items-center justify-center transition-colors shadow-[0_0_15px_rgba(255,0,122,0.5)]"
            >
              {isSending ? <Loader2 size={22} className="animate-spin mb-1" /> : <Flame size={22} className="mb-1" />}
              <span className="text-xs font-bold">Fuego</span>
              <span className="text-[10px] text-white/70">1,000 CR</span>
            </button>
          </div>
        </div>

        {/* ── Player B ── */}
        <div className="relative rounded-3xl overflow-hidden cyber-glass border-[#00d1ff]/30 border-2 glow-secondary flex flex-col min-h-[320px]">
          <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent z-10" />
          <div className="absolute inset-0 bg-[#00141a] flex items-center justify-center">
            <span className="text-[#00d1ff]/20 font-black text-6xl rotate-[15deg]">PLAYER B</span>
          </div>

          <div className="absolute top-4 right-4 z-20 cyber-glass px-4 py-2 rounded-full font-bold text-[#00d1ff]">
            {scoreB.toLocaleString()} CR
          </div>

          <AnimatePresence>
            {particlesB.map(p => (
              <motion.div
                key={p.id}
                initial={{ opacity: 1, y: 0, scale: 0.5 }}
                animate={{ opacity: 0, y: -200, scale: 2 }}
                exit={{ opacity: 0 }}
                className="absolute z-20 text-3xl pointer-events-none"
                style={{ left: `${p.x}%`, bottom: "20%" }}
              >
                {p.emoji}
              </motion.div>
            ))}
          </AnimatePresence>

          <div className="mt-auto relative z-20 p-3 grid grid-cols-2 gap-2">
            <button
              onClick={() => sendGift("B", "estrella")}
              disabled={isSending || balance < GIFTS.estrella.cost}
              className="bg-[#00d1ff]/20 hover:bg-[#00d1ff]/40 disabled:opacity-40 border border-[#00d1ff]/50 rounded-xl p-3 flex flex-col items-center justify-center transition-colors backdrop-blur-md"
            >
              <Star size={22} className="text-[#00d1ff] mb-1" />
              <span className="text-xs font-bold">Estrella</span>
              <span className="text-[10px] text-white/50">100 CR</span>
            </button>
            <button
              onClick={() => sendGift("B", "rayo")}
              disabled={isSending || balance < GIFTS.rayo.cost}
              className="bg-[#00d1ff] hover:bg-[#00d1ff]/80 disabled:opacity-40 text-black rounded-xl p-3 flex flex-col items-center justify-center transition-colors shadow-[0_0_15px_rgba(0,209,255,0.5)]"
            >
              {isSending ? <Loader2 size={22} className="animate-spin mb-1" /> : <Zap size={22} className="mb-1" />}
              <span className="text-xs font-bold">Rayo</span>
              <span className="text-[10px] text-black/60">1,000 CR</span>
            </button>
          </div>
        </div>

      </div>

      {/* Real-time Chat */}
      <div className="mt-6 h-56 cyber-glass rounded-3xl p-4 flex flex-col border-white/10 relative overflow-hidden flex-shrink-0">
        <div className="absolute top-0 right-0 w-32 h-32 bg-[#ff007a] rounded-full mix-blend-screen filter blur-[60px] opacity-10" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-[#00d1ff] rounded-full mix-blend-screen filter blur-[60px] opacity-10" />

        <div className="flex-1 overflow-y-auto space-y-2 mb-3 z-10 pr-1 flex flex-col">
          {messages.length === 0 && (
            <div className="text-white/30 text-sm text-center mt-auto mb-4">
              ¡Sé el primero en comentar o enviar un regalo!
            </div>
          )}
          {messages.map(msg => (
            <div
              key={msg.id}
              className={`text-sm py-1.5 px-3 rounded-xl w-max max-w-[90%] flex gap-2 items-start ${
                msg.isGift
                  ? "bg-white/5 border border-white/10 shadow-[0_0_12px_rgba(255,0,122,0.15)]"
                  : "bg-black/40 border border-white/5"
              } cyber-glass`}
            >
              <span
                className="font-bold whitespace-nowrap"
                style={{ color: msg.isGift ? (msg.color || "#ff007a") : "#00d1ff" }}
              >
                @{msg.username}
              </span>
              <span className={`break-words ${msg.isGift ? "text-white font-medium italic" : "text-white/90"}`}>
                {msg.text}
              </span>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        <div className="flex gap-2 z-10">
          <input
            type="text"
            value={newMessage}
            onChange={e => setNewMessage(e.target.value)}
            onKeyDown={e => e.key === "Enter" && sendMessage(newMessage)}
            placeholder="Comenta o apoya a tu favorito..."
            className="flex-1 bg-black/50 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm placeholder-white/30 focus:outline-none focus:border-[#00d1ff] transition-colors"
          />
          <button
            onClick={() => sendMessage(newMessage)}
            disabled={!newMessage.trim()}
            className="bg-[#00d1ff] disabled:opacity-50 text-black px-4 py-2 rounded-xl font-bold hover:bg-[#00d1ff]/80 transition-colors flex items-center justify-center"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
