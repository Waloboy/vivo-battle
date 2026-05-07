"use client";

import { CheckCircle2, XCircle, Clock } from "lucide-react";

const TRANSACTIONS = [
  { id: "TXN-001", user: "@carlos_ven", amount: 5000, ref: "123456", status: "pending", time: "Hace 5 min" },
  { id: "TXN-002", user: "@maria_b", amount: 1000, ref: "654321", status: "approved", time: "Hace 15 min" },
  { id: "TXN-003", user: "@pedro_123", amount: 10000, ref: "987654", status: "pending", time: "Hace 1 hora" },
  { id: "TXN-004", user: "@juan_perez", amount: 2000, ref: "456789", status: "rejected", time: "Hace 2 horas" },
];

export default function AdminDashboard() {
  return (
    <div className="flex-1 p-4 md:p-8 max-w-7xl w-full mx-auto space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black mb-2">Panel de Administración</h1>
          <p className="text-white/50">Aprobación manual de recargas por Pago Móvil.</p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="cyber-glass px-4 py-2 rounded-xl text-center">
            <span className="block text-white/50 text-xs uppercase tracking-wider">Pendientes</span>
            <span className="text-xl font-bold text-[#00d1ff]">12</span>
          </div>
          <div className="cyber-glass px-4 py-2 rounded-xl text-center">
            <span className="block text-white/50 text-xs uppercase tracking-wider">Hoy</span>
            <span className="text-xl font-bold text-[#ff007a]">$450.00</span>
          </div>
        </div>
      </div>

      <div className="cyber-glass rounded-2xl overflow-hidden border border-white/5">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/10 bg-white/5">
                <th className="p-4 font-semibold text-white/50 text-sm">ID Transacción</th>
                <th className="p-4 font-semibold text-white/50 text-sm">Usuario</th>
                <th className="p-4 font-semibold text-white/50 text-sm">Referencia</th>
                <th className="p-4 font-semibold text-white/50 text-sm">Monto (CR)</th>
                <th className="p-4 font-semibold text-white/50 text-sm">Estado</th>
                <th className="p-4 font-semibold text-white/50 text-sm">Tiempo</th>
                <th className="p-4 font-semibold text-white/50 text-sm text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {TRANSACTIONS.map((txn, i) => (
                <tr key={i} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                  <td className="p-4 font-mono text-xs text-white/70">{txn.id}</td>
                  <td className="p-4 font-medium text-[#00d1ff]">{txn.user}</td>
                  <td className="p-4 font-mono text-sm">{txn.ref}</td>
                  <td className="p-4 font-bold">{txn.amount.toLocaleString()}</td>
                  <td className="p-4">
                    {txn.status === "pending" && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 text-xs font-medium">
                        <Clock size={12} /> Pendiente
                      </span>
                    )}
                    {txn.status === "approved" && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-xs font-medium">
                        <CheckCircle2 size={12} /> Aprobado
                      </span>
                    )}
                    {txn.status === "rejected" && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/10 text-red-500 border border-red-500/20 text-xs font-medium">
                        <XCircle size={12} /> Rechazado
                      </span>
                    )}
                  </td>
                  <td className="p-4 text-sm text-white/50">{txn.time}</td>
                  <td className="p-4 text-right">
                    {txn.status === "pending" ? (
                      <div className="flex items-center justify-end gap-2">
                        <button className="p-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 rounded-lg transition-colors border border-emerald-500/20">
                          <CheckCircle2 size={18} />
                        </button>
                        <button className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-lg transition-colors border border-red-500/20">
                          <XCircle size={18} />
                        </button>
                      </div>
                    ) : (
                      <span className="text-white/30 text-xs">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
