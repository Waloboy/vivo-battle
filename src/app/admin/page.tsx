"use client";

import { useState, useEffect } from "react";
import { CheckCircle2, XCircle, Clock, Loader2, RefreshCw, ShieldAlert, Wallet } from "lucide-react";
import { createClient } from "@/utils/supabase/client";

export default function AdminDashboard() {
  const supabase = createClient();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    checkAdminAndFetch();
  }, []);

  const checkAdminAndFetch = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setIsAdmin(false); setLoading(false); return; }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "admin") { setIsAdmin(false); setLoading(false); return; }

    setIsAdmin(true);
    await fetchTransactions();
    setLoading(false);
  };

  const fetchTransactions = async () => {
    // Join transactions with profiles to get the username
    const { data } = await supabase
      .from("transactions")
      .select("*, profiles(username, bank_name, id_card, phone_number)")
      .order("created_at", { ascending: false })
      .limit(50);

    if (data) setTransactions(data);
  };

  const handleApprove = async (txn: any) => {
    setProcessingId(txn.id);

    // 1. Mark transaction as approved
    const { error: txError } = await supabase
      .from("transactions")
      .update({ status: "approved", resolved_at: new Date().toISOString() })
      .eq("id", txn.id);

    if (txError) {
      alert("Error al aprobar: " + txError.message);
      setProcessingId(null);
      return;
    }

    // 2. If it's a deposit, credit the user's wallet
    if (txn.type === "deposit") {
      const { data: wallet } = await supabase
        .from("wallets")
        .select("balance")
        .eq("user_id", txn.user_id)
        .single();

      const newBalance = (wallet?.balance || 0) + txn.amount_credits;

      const { error: walletError } = await supabase
        .from("wallets")
        .update({ balance: newBalance, updated_at: new Date().toISOString() })
        .eq("user_id", txn.user_id);

      if (walletError) {
        alert("Transacción aprobada, pero error al actualizar wallet: " + walletError.message);
      }
    }

    setProcessingId(null);
    await fetchTransactions();
  };

  const handleReject = async (txn: any) => {
    setProcessingId(txn.id);

    const { error } = await supabase
      .from("transactions")
      .update({ status: "rejected", resolved_at: new Date().toISOString() })
      .eq("id", txn.id);

    if (error) alert("Error al rechazar: " + error.message);

    setProcessingId(null);
    await fetchTransactions();
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="animate-spin text-[#ff007a]" size={40} />
      </div>
    );
  }

  if (isAdmin === false) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center p-8">
        <ShieldAlert className="text-red-500" size={56} />
        <h1 className="text-2xl font-black">Acceso Denegado</h1>
        <p className="text-white/50 max-w-sm">
          No tienes permisos para acceder al Panel de Administración.
        </p>
      </div>
    );
  }

  const pending = transactions.filter((t) => t.status === "pending");
  const totalApprovedBs = transactions
    .filter((t) => t.status === "approved" && t.type === "deposit")
    .reduce((sum, t) => sum + parseFloat(t.amount_bs || 0), 0);

  return (
    <div className="flex-1 p-4 md:p-8 max-w-7xl w-full mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black mb-2">Panel de Administración</h1>
          <p className="text-white/50">Aprobación manual de recargas y retiros por Pago Móvil.</p>
        </div>

        <div className="flex items-center gap-4">
          <div className="cyber-glass px-4 py-2 rounded-xl text-center border-white/10">
            <span className="block text-white/50 text-xs uppercase tracking-wider">Pendientes</span>
            <span className="text-xl font-bold text-yellow-400">{pending.length}</span>
          </div>
          <div className="cyber-glass px-4 py-2 rounded-xl text-center border-white/10">
            <span className="block text-white/50 text-xs uppercase tracking-wider">Total Hoy (BS)</span>
            <span className="text-xl font-bold text-[#ff007a]">{totalApprovedBs.toFixed(2)}</span>
          </div>
          <button
            onClick={fetchTransactions}
            className="p-3 cyber-glass rounded-xl border-white/10 hover:bg-white/10 transition-colors"
            title="Actualizar"
          >
            <RefreshCw size={18} />
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="cyber-glass rounded-2xl overflow-hidden border border-white/5">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/10 bg-white/5">
                <th className="p-4 font-semibold text-white/50 text-sm">Tipo</th>
                <th className="p-4 font-semibold text-white/50 text-sm">Usuario</th>
                <th className="p-4 font-semibold text-white/50 text-sm">Datos Pago Móvil</th>
                <th className="p-4 font-semibold text-white/50 text-sm">Referencia</th>
                <th className="p-4 font-semibold text-white/50 text-sm">Monto BS</th>
                <th className="p-4 font-semibold text-white/50 text-sm">Créditos</th>
                <th className="p-4 font-semibold text-white/50 text-sm">Estado</th>
                <th className="p-4 font-semibold text-white/50 text-sm">Fecha</th>
                <th className="p-4 font-semibold text-white/50 text-sm text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-white/40">
                    No hay transacciones aún.
                  </td>
                </tr>
              ) : (
                transactions.map((txn) => {
                  const isProcessing = processingId === txn.id;
                  const profile = txn.profiles;
                  return (
                    <tr
                      key={txn.id}
                      className="border-b border-white/5 hover:bg-white/[0.02] transition-colors"
                    >
                      {/* Tipo */}
                      <td className="p-4">
                        <span
                          className={`text-xs font-bold uppercase tracking-wider ${
                            txn.type === "deposit" ? "text-[#00d1ff]" : "text-white/60"
                          }`}
                        >
                          {txn.type === "deposit" ? "Recarga" : "Retiro"}
                        </span>
                      </td>

                      {/* Usuario */}
                      <td className="p-4 font-medium text-[#00d1ff]">
                        @{profile?.username || "—"}
                      </td>

                      {/* Datos bancarios del perfil */}
                      <td className="p-4 text-xs text-white/60 space-y-0.5">
                        <p className="font-medium text-white/80">{profile?.bank_name || "—"}</p>
                        <p>{profile?.id_card || ""}</p>
                        <p>{profile?.phone_number || ""}</p>
                      </td>

                      {/* Referencia */}
                      <td className="p-4 font-mono text-sm">
                        {txn.reference_number || "—"}
                      </td>

                      {/* Monto BS */}
                      <td className="p-4 font-bold text-white">
                        {parseFloat(txn.amount_bs).toFixed(2)} Bs
                      </td>

                      {/* Créditos */}
                      <td className="p-4 font-bold text-[#ff007a]">
                        {txn.amount_credits.toLocaleString()} CR
                      </td>

                      {/* Estado */}
                      <td className="p-4">
                        {txn.status === "pending" && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 text-xs font-medium">
                            <Clock size={12} /> Pendiente
                          </span>
                        )}
                        {txn.status === "approved" && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-medium">
                            <CheckCircle2 size={12} /> Aprobado
                          </span>
                        )}
                        {txn.status === "rejected" && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/10 text-red-400 border border-red-500/20 text-xs font-medium">
                            <XCircle size={12} /> Rechazado
                          </span>
                        )}
                      </td>

                      {/* Fecha */}
                      <td className="p-4 text-sm text-white/40">
                        {new Date(txn.created_at).toLocaleDateString("es-VE", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>

                      {/* Acciones */}
                      <td className="p-4 text-right">
                        {txn.status === "pending" ? (
                          <div className="flex items-center justify-end gap-2">
                            {isProcessing ? (
                              <Loader2 className="animate-spin text-white/50" size={20} />
                            ) : (
                              <>
                                <button
                                  onClick={() => handleApprove(txn)}
                                  className="p-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-lg transition-colors border border-emerald-500/20"
                                  title="Aprobar"
                                >
                                  <CheckCircle2 size={18} />
                                </button>
                                <button
                                  onClick={() => handleReject(txn)}
                                  className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors border border-red-500/20"
                                  title="Rechazar"
                                >
                                  <XCircle size={18} />
                                </button>
                              </>
                            )}
                          </div>
                        ) : (
                          <span className="text-white/20 text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
