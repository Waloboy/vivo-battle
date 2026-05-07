"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Zap, Shield, Flame } from "lucide-react";

export default function Home() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background glow effects */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#ff007a] rounded-full mix-blend-screen filter blur-[128px] opacity-20 animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#00d1ff] rounded-full mix-blend-screen filter blur-[128px] opacity-20 animate-pulse delay-1000" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="z-10 text-center space-y-8 max-w-3xl"
      >
        <div className="space-y-4">
          <motion.div
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 10 }}
          >
            <h1 className="text-7xl md:text-9xl font-black tracking-tighter text-gradient pb-2">
              VIVO BATTLE
            </h1>
          </motion.div>
          <p className="text-xl md:text-2xl text-white/60 font-light tracking-wide">
            La plataforma definitiva de batallas 1vs1.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-8">
          <Link href="/battle" className="group relative w-full sm:w-auto">
            <div className="absolute -inset-1 bg-gradient-to-r from-[#ff007a] to-[#00d1ff] rounded-xl blur opacity-25 group-hover:opacity-75 transition duration-500"></div>
            <button className="relative w-full px-8 py-4 bg-black rounded-xl cyber-glass flex items-center justify-center gap-3 text-lg font-bold cyber-glass-hover">
              <Flame className="text-[#ff007a]" />
              <span>Ver Batallas en Vivo</span>
            </button>
          </Link>
          
          <Link href="/dashboard" className="w-full sm:w-auto">
            <button className="w-full px-8 py-4 rounded-xl cyber-glass flex items-center justify-center gap-3 text-lg font-bold text-white/80 cyber-glass-hover hover:text-white">
              <Zap className="text-[#00d1ff]" />
              <span>Mi Billetera</span>
            </button>
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-20 text-left">
          <div className="cyber-glass p-6 rounded-2xl">
            <div className="h-12 w-12 rounded-full bg-[#ff007a]/10 flex items-center justify-center mb-4">
              <Flame className="text-[#ff007a]" size={24} />
            </div>
            <h3 className="text-xl font-bold mb-2">Batallas Épicas</h3>
            <p className="text-white/50 text-sm">Apoya a tus creadores favoritos en tiempo real y decide quién gana.</p>
          </div>
          <div className="cyber-glass p-6 rounded-2xl">
            <div className="h-12 w-12 rounded-full bg-[#00d1ff]/10 flex items-center justify-center mb-4">
              <Shield className="text-[#00d1ff]" size={24} />
            </div>
            <h3 className="text-xl font-bold mb-2">100% Seguro</h3>
            <p className="text-white/50 text-sm">Transacciones protegidas y verificadas al instante vía Pago Móvil.</p>
          </div>
          <div className="cyber-glass p-6 rounded-2xl">
            <div className="h-12 w-12 rounded-full bg-white/5 flex items-center justify-center mb-4">
              <Zap className="text-white" size={24} />
            </div>
            <h3 className="text-xl font-bold mb-2">Premios Instantáneos</h3>
            <p className="text-white/50 text-sm">Los creadores reciben sus ganancias directamente en sus cuentas.</p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
