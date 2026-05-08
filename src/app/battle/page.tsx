"use client";

import { motion } from "framer-motion";
import { Swords } from "lucide-react";
import Link from "next/link";

export default function BattleIndexPage() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center text-center max-w-sm"
      >
        <div className="w-20 h-20 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-6">
          <Swords size={40} className="text-[#ff007a] opacity-50" />
        </div>
        <h1 className="text-2xl font-black text-white tracking-tight mb-2">No estás en ninguna batalla</h1>
        <p className="text-white/40 text-sm mb-8">
          Busca a un oponente en la sección de Explorar o acepta un reto para entrar a la arena.
        </p>
        <Link 
          href="/dashboard"
          className="px-6 py-3 bg-gradient-to-r from-[#ff007a] to-[#00d1ff] rounded-2xl font-black text-sm uppercase tracking-widest text-white hover:shadow-[0_0_20px_rgba(255,0,122,0.4)] transition-all"
        >
          IR AL DASHBOARD
        </Link>
      </motion.div>
    </div>
  );
}
