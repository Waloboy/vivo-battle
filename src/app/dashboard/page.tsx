"use client";

import { useState } from "react";
import { Wallet, Plus, ArrowUpRight, History, CreditCard, Landmark, Phone } from "lucide-react";
import { Modal } from "@/components/ui/Modal";

export default function Dashboard() {
  const [isReloadModalOpen, setIsReloadModalOpen] = useState(false);

  return (
    <div className="flex-1 max-w-4xl w-full mx-auto p-4 md:p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-black mb-2">Mi Billetera</h1>
        <p className="text-white/50">Gestiona tus créditos para apoyar en las batallas.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 cyber-glass p-8 rounded-3xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-64 h-64 bg-[#00d1ff] rounded-full mix-blend-screen filter blur-[80px] opacity-10 group-hover:opacity-20 transition-opacity" />
          
          <div className="relative z-10 flex flex-col h-full justify-between">
            <div className="flex items-center gap-3 mb-8">
              <div className="p-3 bg-[#00d1ff]/10 rounded-xl">
                <Wallet className="text-[#00d1ff]" size={28} />
              </div>
              <span className="text-[#00d1ff] font-medium tracking-wider uppercase text-sm">Saldo Disponible</span>
            </div>
            
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-6xl font-black">2,450</span>
                <span className="text-xl text-white/50 font-medium">Créditos</span>
              </div>
              <p className="text-white/40 mt-2">≈ $24.50 USD</p>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <button 
            onClick={() => setIsReloadModalOpen(true)}
            className="flex-1 cyber-glass rounded-3xl p-6 flex flex-col items-center justify-center gap-4 group hover:bg-[#ff007a]/10 hover:border-[#ff007a]/50 transition-all duration-300"
          >
            <div className="h-16 w-16 rounded-full bg-[#ff007a]/20 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Plus className="text-[#ff007a]" size={32} />
            </div>
            <span className="font-bold text-[#ff007a] text-lg">Recargar Saldo</span>
          </button>
          
          <button className="flex-1 cyber-glass rounded-3xl p-6 flex flex-col items-center justify-center gap-4 group hover:bg-white/5 transition-all">
            <div className="h-16 w-16 rounded-full bg-white/5 flex items-center justify-center group-hover:scale-110 transition-transform">
              <ArrowUpRight className="text-white" size={32} />
            </div>
            <span className="font-bold text-white/70">Retirar</span>
          </button>
        </div>
      </div>

      <div className="mt-12">
        <div className="flex items-center gap-3 mb-6">
          <History className="text-white/50" />
          <h2 className="text-xl font-bold">Últimos Movimientos</h2>
        </div>
        
        <div className="cyber-glass rounded-2xl overflow-hidden">
          {[1, 2, 3].map((_, i) => (
            <div key={i} className="flex items-center justify-between p-4 border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors">
              <div className="flex items-center gap-4">
                <div className={`p-2 rounded-lg ${i === 0 ? 'bg-[#ff007a]/10 text-[#ff007a]' : 'bg-[#00d1ff]/10 text-[#00d1ff]'}`}>
                  {i === 0 ? <ArrowUpRight size={20} /> : <Plus size={20} />}
                </div>
                <div>
                  <p className="font-medium">{i === 0 ? 'Regalo a @creador' : 'Recarga vía Pago Móvil'}</p>
                  <p className="text-xs text-white/40">Hoy, 14:30</p>
                </div>
              </div>
              <div className={`font-bold ${i === 0 ? 'text-white' : 'text-[#00d1ff]'}`}>
                {i === 0 ? '-500' : '+1000'} <span className="text-xs font-normal opacity-50">CR</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <Modal isOpen={isReloadModalOpen} onClose={() => setIsReloadModalOpen(false)} title="Recargar Créditos">
        <div className="space-y-6">
          <div className="bg-[#00d1ff]/10 border border-[#00d1ff]/20 rounded-xl p-4 text-sm text-[#00d1ff]">
            Realiza un Pago Móvil a los siguientes datos y luego reporta tu pago para recibir los créditos al instante.
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10">
              <div className="flex items-center gap-3">
                <Landmark className="text-white/50" size={18} />
                <span className="text-white/70">Banco</span>
              </div>
              <span className="font-medium">Banesco (0134)</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10">
              <div className="flex items-center gap-3">
                <Phone className="text-white/50" size={18} />
                <span className="text-white/70">Teléfono</span>
              </div>
              <span className="font-medium">0414-1234567</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10">
              <div className="flex items-center gap-3">
                <CreditCard className="text-white/50" size={18} />
                <span className="text-white/70">Cédula</span>
              </div>
              <span className="font-medium">V-12345678</span>
            </div>
          </div>

          <button className="w-full py-4 bg-[#ff007a] hover:bg-[#ff007a]/80 text-white rounded-xl font-bold transition-colors glow-primary mt-4">
            Reportar Pago
          </button>
        </div>
      </Modal>
    </div>
  );
}
