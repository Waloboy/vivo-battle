"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, Star, Zap, Flame, Send } from "lucide-react";
import { createClient } from "@/utils/supabase/client";

export default function BattleView() {
  const supabase = createClient();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [scoreA, setScoreA] = useState(5000);
  const [scoreB, setScoreB] = useState(5000);
  const [particlesA, setParticlesA] = useState<{ id: number; x: number; y: number }[]>([]);
  const [particlesB, setParticlesB] = useState<{ id: number; x: number; y: number }[]>([]);
  
  const totalScore = scoreA + scoreB;
  const percentA = (scoreA / totalScore) * 100;

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUser(user);
        const { data: profile } = await supabase.from('profiles').select('username').eq('id', user.id).single();
        if (profile) setProfile(profile);
      }
    };
    fetchUser();

    const channel = supabase.channel('battle-room')
      .on('broadcast', { event: 'chat' }, payload => {
        setMessages(prev => [...prev, payload.payload]);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (text: string, isGift: boolean = false) => {
    if (!text.trim() || !profile) return;
    const msg = {
      id: Date.now(),
      username: profile.username,
      text,
      isGift
    };
    await supabase.channel('battle-room').send({
      type: 'broadcast',
      event: 'chat',
      payload: msg
    });
    setMessages(prev => [...prev, msg]);
    if (!isGift) setNewMessage("");
  };

  const handleGiftA = (amount: number, giftName: string) => {
    setScoreA(prev => prev + amount);
    const newParticle = { id: Date.now(), x: Math.random() * 100, y: Math.random() * 100 };
    setParticlesA(prev => [...prev, newParticle]);
    setTimeout(() => {
      setParticlesA(prev => prev.filter(p => p.id !== newParticle.id));
    }, 1000);
    sendMessage(`envió un ${giftName}! 🎁`, true);
  };

  const handleGiftB = (amount: number, giftName: string) => {
    setScoreB(prev => prev + amount);
    const newParticle = { id: Date.now(), x: Math.random() * 100, y: Math.random() * 100 };
    setParticlesB(prev => [...prev, newParticle]);
    setTimeout(() => {
      setParticlesB(prev => prev.filter(p => p.id !== newParticle.id));
    }, 1000);
    sendMessage(`envió un ${giftName}! 🎁`, true);
  };

  return (
    <div className="flex-1 flex flex-col p-4 max-w-7xl w-full mx-auto relative overflow-hidden">
      
      {/* Versus Bar */}
      <div className="w-full h-12 cyber-glass rounded-full overflow-hidden flex relative mb-8 mt-4 border-2 border-white/10">
        <div className="absolute inset-0 flex items-center justify-center z-10 font-black text-xl italic tracking-widest drop-shadow-lg">
          VS
        </div>
        <motion.div 
          className="h-full bg-gradient-to-r from-[#ff007a]/80 to-[#ff007a] relative"
          animate={{ width: `${percentA}%` }}
          transition={{ type: "spring", stiffness: 50, damping: 15 }}
        >
           <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-20 mix-blend-overlay"></div>
        </motion.div>
        <motion.div 
          className="h-full bg-gradient-to-l from-[#00d1ff]/80 to-[#00d1ff] relative"
          animate={{ width: `${100 - percentA}%` }}
          transition={{ type: "spring", stiffness: 50, damping: 15 }}
        >
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-20 mix-blend-overlay"></div>
        </motion.div>
      </div>

      <div className="flex-1 grid grid-cols-2 gap-4 md:gap-8 relative">
        
        {/* Player A */}
        <div className="relative rounded-3xl overflow-hidden cyber-glass border-[#ff007a]/30 border-2 glow-primary flex flex-col">
          <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent z-10" />
          
          {/* Video Placeholder */}
          <div className="absolute inset-0 bg-[#1a000c] flex items-center justify-center">
            <span className="text-[#ff007a]/20 font-black text-6xl rotate-[-15deg]">PLAYER A</span>
          </div>

          <div className="absolute top-4 left-4 z-20 cyber-glass px-4 py-2 rounded-full font-bold text-[#ff007a]">
            {scoreA.toLocaleString()}
          </div>

          <AnimatePresence>
            {particlesA.map(p => (
              <motion.div
                key={p.id}
                initial={{ opacity: 1, y: 0, scale: 0.5 }}
                animate={{ opacity: 0, y: -200, scale: 1.5 }}
                exit={{ opacity: 0 }}
                className="absolute z-20 text-[#ff007a]"
                style={{ left: `${p.x}%`, bottom: '20%' }}
              >
                <Heart fill="#ff007a" size={32} />
              </motion.div>
            ))}
          </AnimatePresence>

          <div className="mt-auto relative z-20 p-4 grid grid-cols-2 gap-2">
            <button onClick={() => handleGiftA(100, "Rosa")} className="bg-[#ff007a]/20 hover:bg-[#ff007a]/40 border border-[#ff007a]/50 rounded-xl p-3 flex flex-col items-center justify-center transition-colors backdrop-blur-md">
              <Heart size={24} className="text-[#ff007a] mb-1" />
              <span className="text-xs font-bold">Rosa (100)</span>
            </button>
            <button onClick={() => handleGiftA(1000, "Fuego")} className="bg-[#ff007a] hover:bg-[#ff007a]/80 text-white rounded-xl p-3 flex flex-col items-center justify-center transition-colors shadow-[0_0_15px_rgba(255,0,122,0.5)]">
              <Flame size={24} className="mb-1" />
              <span className="text-xs font-bold">Fuego (1k)</span>
            </button>
          </div>
        </div>

        {/* Player B */}
        <div className="relative rounded-3xl overflow-hidden cyber-glass border-[#00d1ff]/30 border-2 glow-secondary flex flex-col">
          <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent z-10" />
          
          {/* Video Placeholder */}
          <div className="absolute inset-0 bg-[#00141a] flex items-center justify-center">
             <span className="text-[#00d1ff]/20 font-black text-6xl rotate-[15deg]">PLAYER B</span>
          </div>

          <div className="absolute top-4 right-4 z-20 cyber-glass px-4 py-2 rounded-full font-bold text-[#00d1ff]">
            {scoreB.toLocaleString()}
          </div>

          <AnimatePresence>
            {particlesB.map(p => (
              <motion.div
                key={p.id}
                initial={{ opacity: 1, y: 0, scale: 0.5 }}
                animate={{ opacity: 0, y: -200, scale: 1.5 }}
                exit={{ opacity: 0 }}
                className="absolute z-20 text-[#00d1ff]"
                style={{ left: `${p.x}%`, bottom: '20%' }}
              >
                <Star fill="#00d1ff" size={32} />
              </motion.div>
            ))}
          </AnimatePresence>

          <div className="mt-auto relative z-20 p-4 grid grid-cols-2 gap-2">
            <button onClick={() => handleGiftB(100, "Estrella")} className="bg-[#00d1ff]/20 hover:bg-[#00d1ff]/40 border border-[#00d1ff]/50 rounded-xl p-3 flex flex-col items-center justify-center transition-colors backdrop-blur-md">
              <Star size={24} className="text-[#00d1ff] mb-1" />
              <span className="text-xs font-bold">Estrella (100)</span>
            </button>
            <button onClick={() => handleGiftB(1000, "Rayo")} className="bg-[#00d1ff] hover:bg-[#00d1ff]/80 text-black rounded-xl p-3 flex flex-col items-center justify-center transition-colors shadow-[0_0_15px_rgba(0,209,255,0.5)]">
              <Zap size={24} className="mb-1" />
              <span className="text-xs font-bold">Rayo (1k)</span>
            </button>
          </div>
        </div>

      </div>

      {/* Real-time Chat Section */}
      <div className="mt-6 h-64 cyber-glass rounded-3xl p-4 flex flex-col border-white/10 relative overflow-hidden flex-shrink-0">
        <div className="absolute top-0 right-0 w-32 h-32 bg-[#ff007a] rounded-full mix-blend-screen filter blur-[60px] opacity-10" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-[#00d1ff] rounded-full mix-blend-screen filter blur-[60px] opacity-10" />
        
        <div className="flex-1 overflow-y-auto space-y-3 mb-4 z-10 custom-scrollbar pr-2 flex flex-col">
          {messages.length === 0 && (
            <div className="text-white/30 text-sm text-center mt-auto mb-4">
              ¡Sé el primero en enviar un mensaje!
            </div>
          )}
          {messages.map(msg => (
            <div key={msg.id} className={`text-sm py-2 px-3 rounded-xl w-max max-w-[90%] ${msg.isGift ? 'bg-[#ff007a]/20 border border-[#ff007a]/30 shadow-[0_0_15px_rgba(255,0,122,0.2)]' : 'bg-black/40 border border-white/5'} cyber-glass flex gap-2 items-start`}>
              <span className={`font-bold whitespace-nowrap ${msg.isGift ? 'text-[#ff007a]' : 'text-[#00d1ff]'}`}>@{msg.username}</span>
              <span className={`break-words ${msg.isGift ? 'text-white font-medium italic' : 'text-white/90'}`}>{msg.text}</span>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
        
        <div className="flex gap-2 z-10">
          <input 
            type="text" 
            value={newMessage}
            onChange={e => setNewMessage(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendMessage(newMessage)}
            placeholder="Comenta o apoya a tu favorito..."
            className="flex-1 bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-white/30 focus:outline-none focus:border-[#00d1ff] transition-colors"
          />
          <button 
            onClick={() => sendMessage(newMessage)}
            disabled={!newMessage.trim()}
            className="bg-[#00d1ff] disabled:opacity-50 text-black px-5 py-2 rounded-xl font-bold hover:bg-[#00d1ff]/80 transition-colors flex items-center justify-center"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
