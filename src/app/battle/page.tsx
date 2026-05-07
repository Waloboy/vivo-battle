"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, Star, Zap, Flame } from "lucide-react";

export default function BattleView() {
  const [scoreA, setScoreA] = useState(5000);
  const [scoreB, setScoreB] = useState(5000);
  const [particlesA, setParticlesA] = useState<{ id: number; x: number; y: number }[]>([]);
  const [particlesB, setParticlesB] = useState<{ id: number; x: number; y: number }[]>([]);
  
  const totalScore = scoreA + scoreB;
  const percentA = (scoreA / totalScore) * 100;
  
  const handleGiftA = (amount: number) => {
    setScoreA(prev => prev + amount);
    const newParticle = { id: Date.now(), x: Math.random() * 100, y: Math.random() * 100 };
    setParticlesA(prev => [...prev, newParticle]);
    setTimeout(() => {
      setParticlesA(prev => prev.filter(p => p.id !== newParticle.id));
    }, 1000);
  };

  const handleGiftB = (amount: number) => {
    setScoreB(prev => prev + amount);
    const newParticle = { id: Date.now(), x: Math.random() * 100, y: Math.random() * 100 };
    setParticlesB(prev => [...prev, newParticle]);
    setTimeout(() => {
      setParticlesB(prev => prev.filter(p => p.id !== newParticle.id));
    }, 1000);
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
            <button onClick={() => handleGiftA(100)} className="bg-[#ff007a]/20 hover:bg-[#ff007a]/40 border border-[#ff007a]/50 rounded-xl p-3 flex flex-col items-center justify-center transition-colors backdrop-blur-md">
              <Heart size={24} className="text-[#ff007a] mb-1" />
              <span className="text-xs font-bold">Rosa (100)</span>
            </button>
            <button onClick={() => handleGiftA(1000)} className="bg-[#ff007a] hover:bg-[#ff007a]/80 text-white rounded-xl p-3 flex flex-col items-center justify-center transition-colors shadow-[0_0_15px_rgba(255,0,122,0.5)]">
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
            <button onClick={() => handleGiftB(100)} className="bg-[#00d1ff]/20 hover:bg-[#00d1ff]/40 border border-[#00d1ff]/50 rounded-xl p-3 flex flex-col items-center justify-center transition-colors backdrop-blur-md">
              <Star size={24} className="text-[#00d1ff] mb-1" />
              <span className="text-xs font-bold">Estrella (100)</span>
            </button>
            <button onClick={() => handleGiftB(1000)} className="bg-[#00d1ff] hover:bg-[#00d1ff]/80 text-black rounded-xl p-3 flex flex-col items-center justify-center transition-colors shadow-[0_0_15px_rgba(0,209,255,0.5)]">
              <Zap size={24} className="mb-1" />
              <span className="text-xs font-bold">Rayo (1k)</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
