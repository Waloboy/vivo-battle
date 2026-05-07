"use client";

import { useState, useEffect } from "react";
import { CheckCircle2, XCircle, Clock, Loader2, RefreshCw, ShieldAlert, Sparkles, Scissors, Copy, CheckCheck } from "lucide-react";
import { createClient } from "@/utils/supabase/client";

type Tab = "transactions" | "settlement";

// ── Settlement row type ──
interface SettlementRow {
  user_id: string;
  username: string;
  bank_name: string | null;
  id_card: string | null;
  phone_number: string | null;
  total_cr: number;
  user_share_cr: number;
  app_share_cr: number;
  user_payout_bs: number;
  paid: boolean;
}

export default function AdminDashboard() {
  const supabase = createClient();
  const [tab, setTab] = useState<Tab>("transactions");
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  // Settlement state
  const [settlement, setSettlement] = useState<SettlementRow[]>([]);
  const [exchangeRate, setExchangeRate] = useState(80); // 1 CR = X Bs — editable
  const [settLoading, setSettLoading] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  useEffect(() => { checkAdminAndFetch(); }, []);

  const checkAdminAndFetch = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setIsAdmin(false); setLoading(false); return; }
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    if (profile?.role !== "admin") { setIsAdmin(false); setLoading(false); return; }
    setIsAdmin(true);
    await fetchTransactions();
    setLoading(false);
  };

  const fetchTransactions = async () => {
    const { data } = await supabase
      .from("transactions")
      .select("*, profiles(username, bank_name, id_card, phone_number)")
      .order("created_at", { ascending: false })
      .limit(50);
    if (data) setTransactions(data);
  };

  // ── Corte Semanal: aggregate gifts per user ──
  const fetchSettlement = async () => {
    setSettLoading(true);
    // Get all gift transactions from the last 7 days
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: gifts } = await supabase
      .from("transactions")
      .select("user_id, amount_credits, profiles(username, bank_name, id_card, phone_number)")
      .eq("type", "gift")
      .eq("status", "approved")
      .gte("created_at", weekAgo);

    if (!gifts) { setSettLoading(false); return; }

    // Aggregate by user
    const map = new Map<string, SettlementRow>();
    for (const g of gifts) {
      const p = g.profiles as any;
      if (!map.has(g.user_id)) {
        map.set(g.user_id, {
          user_id: g.user_id,
          username: p?.username || "—",
          bank_name: p?.bank_name || null,
          id_card: p?.id_card || null,
          phone_number: p?.phone_number || null,
          total_cr: 0, user_share_cr: 0, app_share_cr: 0, user_payout_bs: 0,
          paid: false,
        });
      }
      const row = map.get(g.user_id)!;
      row.total_cr += g.amount_credits;
    }

    // Calculate splits
    for (const row of map.values()) {
      row.user_share_cr = Math.floor(row.total_cr * 0.6);
      row.app_share_cr = row.total_cr - row.user_share_cr;
      row.user_payout_bs = row.user_share_cr * (exchangeRate / 100); // CR to BS
    }

    setSettlement(Array.from(map.values()).sort((a, b) => b.total_cr - a.total_cr));
    setSettLoading(false);
  };

  useEffect(() => { if (tab === "settlement") fetchSettlement(); }, [tab, exchangeRate]);

  const togglePaid = (userId: string) => {
    setSettlement(prev => prev.map(r => r.user_id === userId ? { ...r, paid: !r.paid } : r));
  };

  const copyToClipboard = (text: string, fieldId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldId);
    setTimeout(() => setCopiedField(null), 1500);
  };

  const handleApprove = async (txn: any) => {
    setProcessingId(txn.id);
    const { error: txError } = await supabase
      .from("transactions")
      .update({ status: "approved", resolved_at: new Date().toISOString() })
      .eq("id", txn.id);
    if (txError) { alert("Error: " + txError.message); setProcessingId(null); return; }
    if (txn.type === "deposit") {
      const { data: wallet } = await supabase.from("wallets").select("balance").eq("user_id", txn.user_id).single();
      if (wallet) {
        await supabase.from("wallets").update({ balance: wallet.balance + txn.amount_credits, updated_at: new Date().toISOString() }).eq("user_id", txn.user_id);
      }
    }
    setProcessingId(null);
    await fetchTransactions();
  };

  const handleReject = async (txn: any) => {
    setProcessingId(txn.id);
    await supabase.from("transactions").update({ status: "rejected", resolved_at: new Date().toISOString() }).eq("id", txn.id);
    setProcessingId(null);
    await fetchTransactions();
  };

  // ── Guards ──
  if (loading) return <div className="flex-1 flex items-center justify-center"><Loader2 className="animate-spin text-[#ff007a]" size={40} /></div>;
  if (isAdmin === false) return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center p-8">
      <ShieldAlert className="text-red-500" size={56} />
      <h1 className="text-2xl font-black">Acceso Denegado</h1>
      <p className="text-white/50 max-w-sm">No tienes permisos para acceder al Panel de Administración.</p>
    </div>
  );

  const pending = transactions.filter(t => t.status === "pending");
  const totalGiftsCr = transactions.filter(t => t.type === "gift").reduce((s, t) => s + (t.amount_credits || 0), 0);

  return (
    <div className="flex-1 p-4 md:p-8 max-w-7xl w-full mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black mb-1">Panel de Administración</h1>
          <p className="text-white/40 text-sm">Gestión de transacciones y liquidaciones.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="cyber-glass px-3 py-1.5 rounded-xl text-center border-white/10">
            <span className="block text-white/40 text-[10px] uppercase tracking-wider">Pendientes</span>
            <span className="text-lg font-bold text-yellow-400">{pending.length}</span>
          </div>
          <div className="cyber-glass px-3 py-1.5 rounded-xl text-center border-white/10">
            <span className="block text-white/40 text-[10px] uppercase tracking-wider">Gifts (CR)</span>
            <span className="text-lg font-bold text-[#e056fd]">{totalGiftsCr.toLocaleString()}</span>
          </div>
          <button onClick={() => { fetchTransactions(); if (tab === "settlement") fetchSettlement(); }} className="p-2.5 cyber-glass rounded-xl border-white/10 hover:bg-white/10 transition-colors" title="Refresh">
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-black/30 rounded-xl p-1 w-max border border-white/5">
        <button onClick={() => setTab("transactions")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === "transactions" ? "bg-white/10 text-white" : "text-white/40 hover:text-white/60"}`}>
          Transacciones
        </button>
        <button onClick={() => setTab("settlement")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${tab === "settlement" ? "bg-[#ffd700]/10 text-[#ffd700] border border-[#ffd700]/20" : "text-white/40 hover:text-white/60"}`}>
          <Scissors size={14} /> Corte Semanal
        </button>
      </div>

      {/* ══ TAB: Transactions ══ */}
      {tab === "transactions" && (
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
                  <tr><td colSpan={9} className="p-8 text-center text-white/40">No hay transacciones.</td></tr>
                ) : transactions.map(txn => {
                  const isProc = processingId === txn.id;
                  const prof = txn.profiles;
                  return (
                    <tr key={txn.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                      <td className="p-4">
                        <span className={`text-xs font-bold uppercase tracking-wider ${txn.type === "deposit" ? "text-[#00d1ff]" : txn.type === "gift" ? "text-[#e056fd]" : "text-white/60"}`}>
                          {txn.type === "deposit" ? "Recarga" : txn.type === "gift" ? "Gift" : "Retiro"}
                        </span>
                      </td>
                      <td className="p-4 font-medium text-[#00d1ff]">@{prof?.username || "—"}</td>
                      <td className="p-4 text-xs text-white/60 space-y-0.5">
                        <p className="font-medium text-white/80">{prof?.bank_name || "—"}</p>
                        <p>{prof?.id_card || ""}</p>
                        <p>{prof?.phone_number || ""}</p>
                      </td>
                      <td className="p-4 font-mono text-sm">{txn.reference_number || "—"}</td>
                      <td className="p-4 font-bold text-white">{parseFloat(txn.amount_bs).toFixed(2)} Bs</td>
                      <td className="p-4 font-bold text-[#ff007a]">{txn.amount_credits.toLocaleString()} CR</td>
                      <td className="p-4">
                        {txn.status === "pending" && <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 text-xs font-medium"><Clock size={12}/> Pendiente</span>}
                        {txn.status === "approved" && <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-medium"><CheckCircle2 size={12}/> Aprobado</span>}
                        {txn.status === "rejected" && <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/10 text-red-400 border border-red-500/20 text-xs font-medium"><XCircle size={12}/> Rechazado</span>}
                      </td>
                      <td className="p-4 text-sm text-white/40">{new Date(txn.created_at).toLocaleDateString("es-VE", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</td>
                      <td className="p-4 text-right">
                        {txn.type === "gift" ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-[#e056fd]/10 text-[#e056fd] border border-[#e056fd]/20 text-[10px] font-bold"><Sparkles size={10}/> Auto</span>
                        ) : txn.status === "pending" ? (
                          <div className="flex items-center justify-end gap-2">
                            {isProc ? <Loader2 className="animate-spin text-white/50" size={20}/> : (<>
                              <button onClick={() => handleApprove(txn)} className="p-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-lg transition-colors border border-emerald-500/20"><CheckCircle2 size={18}/></button>
                              <button onClick={() => handleReject(txn)} className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors border border-red-500/20"><XCircle size={18}/></button>
                            </>)}
                          </div>
                        ) : <span className="text-white/20 text-xs">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ══ TAB: Corte Semanal ══ */}
      {tab === "settlement" && (
        <div className="space-y-4">
          {/* Exchange rate config */}
          <div className="cyber-glass rounded-2xl p-4 border border-[#ffd700]/10 flex flex-col md:flex-row md:items-center gap-4">
            <div className="flex-1">
              <h3 className="font-bold text-[#ffd700] mb-1">Tasa de Cambio</h3>
              <p className="text-white/40 text-xs">100 CR = cuántos Bs se pagan al usuario (60% de los gifts)</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-white/50 text-sm">100 CR =</span>
              <input type="number" value={exchangeRate} onChange={e => setExchangeRate(Number(e.target.value))}
                className="w-24 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white font-bold text-center focus:outline-none focus:border-[#ffd700]/50" />
              <span className="text-white/50 text-sm">Bs</span>
            </div>
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-3">
            <div className="cyber-glass rounded-xl p-4 border-white/5 text-center">
              <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Total Gifts (7d)</p>
              <p className="text-xl font-bold text-[#e056fd]">{settlement.reduce((s, r) => s + r.total_cr, 0).toLocaleString()} CR</p>
            </div>
            <div className="cyber-glass rounded-xl p-4 border-white/5 text-center">
              <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Payout Usuarios (60%)</p>
              <p className="text-xl font-bold text-emerald-400">{settlement.reduce((s, r) => s + r.user_payout_bs, 0).toFixed(2)} Bs</p>
            </div>
            <div className="cyber-glass rounded-xl p-4 border-white/5 text-center">
              <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Ganancia App (40%)</p>
              <p className="text-xl font-bold text-[#ffd700]">{settlement.reduce((s, r) => s + r.app_share_cr, 0).toLocaleString()} CR</p>
            </div>
          </div>

          {/* Settlement table */}
          <div className="cyber-glass rounded-2xl overflow-hidden border border-white/5">
            {settLoading ? (
              <div className="p-8 text-center"><Loader2 className="animate-spin text-[#ffd700] mx-auto" size={30}/></div>
            ) : settlement.length === 0 ? (
              <div className="p-8 text-center text-white/40">No hay gifts en los últimos 7 días.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-white/10 bg-white/5">
                      <th className="p-4 text-sm font-semibold text-white/50">Usuario</th>
                      <th className="p-4 text-sm font-semibold text-white/50">Total CR</th>
                      <th className="p-4 text-sm font-semibold text-white/50">60% Usuario</th>
                      <th className="p-4 text-sm font-semibold text-white/50">Pagar (Bs)</th>
                      <th className="p-4 text-sm font-semibold text-white/50">Banco</th>
                      <th className="p-4 text-sm font-semibold text-white/50">Cédula</th>
                      <th className="p-4 text-sm font-semibold text-white/50">Teléfono</th>
                      <th className="p-4 text-sm font-semibold text-white/50 text-right">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {settlement.map(row => (
                      <tr key={row.user_id} className={`border-b border-white/5 transition-colors ${row.paid ? "opacity-40" : "hover:bg-white/[0.02]"}`}>
                        <td className="p-4 font-medium text-[#00d1ff]">@{row.username}</td>
                        <td className="p-4 font-bold text-[#e056fd]">{row.total_cr.toLocaleString()}</td>
                        <td className="p-4 font-bold text-emerald-400">{row.user_share_cr.toLocaleString()}</td>
                        <td className="p-4">
                          <span className="text-lg font-black text-[#ffd700]">{row.user_payout_bs.toFixed(2)}</span>
                          <span className="text-white/40 text-xs ml-1">Bs</span>
                        </td>
                        {/* Copyable bank details */}
                        <td className="p-4">
                          {row.bank_name ? (
                            <button onClick={() => copyToClipboard(row.bank_name!, `bank-${row.user_id}`)} className="flex items-center gap-1 text-sm text-white/70 hover:text-white transition-colors group">
                              {row.bank_name}
                              {copiedField === `bank-${row.user_id}` ? <CheckCheck size={12} className="text-emerald-400"/> : <Copy size={12} className="opacity-0 group-hover:opacity-50"/>}
                            </button>
                          ) : <span className="text-white/20">—</span>}
                        </td>
                        <td className="p-4">
                          {row.id_card ? (
                            <button onClick={() => copyToClipboard(row.id_card!, `id-${row.user_id}`)} className="flex items-center gap-1 text-sm text-white/70 hover:text-white transition-colors group font-mono">
                              {row.id_card}
                              {copiedField === `id-${row.user_id}` ? <CheckCheck size={12} className="text-emerald-400"/> : <Copy size={12} className="opacity-0 group-hover:opacity-50"/>}
                            </button>
                          ) : <span className="text-white/20">—</span>}
                        </td>
                        <td className="p-4">
                          {row.phone_number ? (
                            <button onClick={() => copyToClipboard(row.phone_number!, `phone-${row.user_id}`)} className="flex items-center gap-1 text-sm text-white/70 hover:text-white transition-colors group font-mono">
                              {row.phone_number}
                              {copiedField === `phone-${row.user_id}` ? <CheckCheck size={12} className="text-emerald-400"/> : <Copy size={12} className="opacity-0 group-hover:opacity-50"/>}
                            </button>
                          ) : <span className="text-white/20">—</span>}
                        </td>
                        <td className="p-4 text-right">
                          <button onClick={() => togglePaid(row.user_id)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${row.paid
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                              : "bg-[#ffd700]/10 text-[#ffd700] border border-[#ffd700]/20 hover:bg-[#ffd700]/20"}`}>
                            {row.paid ? "✓ Pagado" : "Marcar Pagado"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
