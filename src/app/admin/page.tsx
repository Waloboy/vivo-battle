"use client";

import { useState, useEffect } from "react";
import {
  CheckCircle2, XCircle, Clock, Loader2, RefreshCw,
  ShieldAlert, Sparkles, Scissors, Copy, CheckCheck, ChevronDown, ChevronUp
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { fmtCR, fmtBs, fmtUSD, crToUsd, crToBs } from "@/utils/format";

type Tab = "transactions" | "settlement";

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
  expanded: boolean;
}

// ── Small reusable badge ──
function StatusBadge({ status }: { status: string }) {
  if (status === "pending")
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 text-[10px] font-semibold"><Clock size={10}/> Pendiente</span>;
  if (status === "approved")
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-semibold"><CheckCircle2 size={10}/> Aprobado</span>;
  return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20 text-[10px] font-semibold"><XCircle size={10}/> Rechazado</span>;
}

export default function AdminDashboard() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("transactions");
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  // Settlement
  const [settlement, setSettlement] = useState<SettlementRow[]>([]);
  const [exchangeRate, setExchangeRate] = useState(80);
  const [settLoading, setSettLoading] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [bcvRate, setBcvRate] = useState<number | null>(null);

  useEffect(() => { checkAdminAndFetch(); }, []);

  const checkAdminAndFetch = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setIsAdmin(false); setLoading(false); return; }
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    if (profile?.role !== "admin") { setIsAdmin(false); setLoading(false); return; }
    setIsAdmin(true);
    // Load BCV rate
    const { data: rateRow } = await supabase.from("app_config").select("value").eq("key", "bcv_rate").single();
    if (rateRow?.value) { const r = parseFloat(rateRow.value); setBcvRate(r); setExchangeRate(Math.round(r / 100 * 100) / 100); }
    await fetchTransactions();
    setLoading(false);
  };

  const fetchTransactions = async () => {
    const { data } = await supabase
      .from("transactions")
      .select("*, profiles(username, bank_name, id_card, phone_number)")
      .order("created_at", { ascending: false })
      .limit(60);
    if (data) setTransactions(data);
  };

  const fetchSettlement = async () => {
    setSettLoading(true);
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: gifts } = await supabase
      .from("transactions")
      .select("user_id, amount_credits, profiles(username, bank_name, id_card, phone_number)")
      .eq("type", "gift").eq("status", "approved").gte("created_at", weekAgo);

    if (!gifts) { setSettLoading(false); return; }

    const map = new Map<string, SettlementRow>();
    for (const g of gifts) {
      const p = g.profiles as any;
      if (!map.has(g.user_id)) {
        map.set(g.user_id, {
          user_id: g.user_id, username: p?.username || "—",
          bank_name: p?.bank_name || null, id_card: p?.id_card || null, phone_number: p?.phone_number || null,
          total_cr: 0, user_share_cr: 0, app_share_cr: 0, user_payout_bs: 0,
          paid: false, expanded: false,
        });
      }
      map.get(g.user_id)!.total_cr += g.amount_credits;
    }
    for (const row of map.values()) {
      row.user_share_cr = Math.floor(row.total_cr * 0.6);
      row.app_share_cr = row.total_cr - row.user_share_cr;
      // exchangeRate = Bs per 100 CR
      row.user_payout_bs = (row.user_share_cr / 100) * exchangeRate;
    }
    setSettlement(Array.from(map.values()).sort((a, b) => b.total_cr - a.total_cr));
    setSettLoading(false);
  };

  useEffect(() => { if (tab === "settlement") fetchSettlement(); }, [tab, exchangeRate]);

  const toggleExpanded = (userId: string) =>
    setSettlement(prev => prev.map(r => r.user_id === userId ? { ...r, expanded: !r.expanded } : r));

  const togglePaid = (userId: string) =>
    setSettlement(prev => prev.map(r => r.user_id === userId ? { ...r, paid: !r.paid } : r));

  const copyToClipboard = (text: string, fieldId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldId);
    setTimeout(() => setCopiedField(null), 1500);
  };

  const handleApprove = async (txn: any) => {
    setProcessingId(txn.id);
    const { error } = await supabase.from("transactions").update({ status: "approved", resolved_at: new Date().toISOString() }).eq("id", txn.id);
    if (!error && txn.type === "deposit") {
      const { data: wallet } = await supabase.from("wallets").select("balance").eq("user_id", txn.user_id).single();
      if (wallet) await supabase.from("wallets").update({ balance: wallet.balance + txn.amount_credits, updated_at: new Date().toISOString() }).eq("user_id", txn.user_id);
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
  if (loading) return <div className="flex-1 flex items-center justify-center"><Loader2 className="animate-spin text-[#ff007a]" size={40}/></div>;
  if (isAdmin === false) return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center p-8">
      <ShieldAlert className="text-red-500" size={56}/>
      <h1 className="text-2xl font-black">Acceso Denegado</h1>
      <p className="text-white/40 max-w-sm text-sm">No tienes permisos para acceder al Panel de Administración.</p>
    </div>
  );

  const pending = transactions.filter(t => t.status === "pending");
  const totalGiftsCr = transactions.filter(t => t.type === "gift").reduce((s, t) => s + (t.amount_credits || 0), 0);

  return (
    <div className="flex-1 p-4 md:p-6 max-w-7xl w-full mx-auto space-y-5">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black">Panel Admin</h1>
          <p className="text-white/30 text-xs mt-0.5">Gestión de transacciones y liquidaciones.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="cyber-glass px-3 py-2 rounded-xl border-white/5 text-center min-w-[70px]">
            <span className="block text-white/30 text-[10px] uppercase">Pendientes</span>
            <span className="text-base font-bold text-yellow-400">{pending.length}</span>
          </div>
          <div className="cyber-glass px-3 py-2 rounded-xl border-white/5 text-center min-w-[70px]">
            <span className="block text-white/30 text-[10px] uppercase">Gifts (CR)</span>
            <span className="text-base font-bold text-[#e056fd]">{totalGiftsCr.toLocaleString("es-VE")}</span>
          </div>
          {bcvRate && (
            <div className="cyber-glass px-3 py-2 rounded-xl border-white/5 text-center min-w-[90px]">
              <span className="block text-white/30 text-[10px] uppercase">BCV</span>
              <span className="text-base font-bold text-[#ffd700]">{fmtBs(bcvRate)}</span>
            </div>
          )}
          <button onClick={() => { fetchTransactions(); if (tab === "settlement") fetchSettlement(); }}
            className="p-2.5 cyber-glass rounded-xl border-white/5 hover:bg-white/10 transition-colors" title="Actualizar">
            <RefreshCw size={15}/>
          </button>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-1 bg-black/30 rounded-xl p-1 w-max border border-white/5">
        <button onClick={() => setTab("transactions")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === "transactions" ? "bg-white/10 text-white" : "text-white/35 hover:text-white/60"}`}>
          Transacciones
        </button>
        <button onClick={() => setTab("settlement")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${tab === "settlement" ? "bg-[#ffd700]/10 text-[#ffd700] border border-[#ffd700]/20" : "text-white/35 hover:text-white/60"}`}>
          <Scissors size={13}/> Corte Semanal
        </button>
      </div>

      {/* ══════════════════════════════════════
          TAB: TRANSACTIONS
          Mobile → cards | Desktop → table
      ══════════════════════════════════════ */}
      {tab === "transactions" && (
        <>
          {/* Mobile Cards */}
          <div className="flex flex-col gap-3 md:hidden">
            {transactions.length === 0 && <p className="text-center text-white/30 text-sm py-6">No hay transacciones.</p>}
            {transactions.map(txn => {
              const isProc = processingId === txn.id;
              const prof = txn.profiles;
              return (
                <div key={txn.id} className="cyber-glass rounded-2xl p-4 border border-white/5 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className={`text-[10px] font-bold uppercase tracking-widest ${txn.type === "deposit" ? "text-[#00d1ff]" : txn.type === "gift" ? "text-[#e056fd]" : "text-white/50"}`}>
                        {txn.type === "deposit" ? "Recarga" : txn.type === "gift" ? "Gift" : "Retiro"}
                      </span>
                      <p className="font-semibold text-sm mt-0.5">@{prof?.username || "—"}</p>
                    </div>
                    <StatusBadge status={txn.status}/>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <p className="text-white/30 font-light">Créditos</p>
                      <p className="font-bold text-[#ff007a]">{fmtCR(txn.amount_credits ?? 0)}</p>
                    </div>
                    <div>
                      <p className="text-white/30 font-light">Monto BS</p>
                      <p className="font-bold">{fmtBs(parseFloat(txn.amount_bs || 0))}</p>
                    </div>
                    <div>
                      <p className="text-white/30 font-light">Banco</p>
                      <p className="font-medium">{prof?.bank_name || "—"}</p>
                    </div>
                    <div>
                      <p className="text-white/30 font-light">Referencia</p>
                      <p className="font-mono">{txn.reference_number || "—"}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] text-white/25">{new Date(txn.created_at).toLocaleDateString("es-VE", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
                    {txn.type === "gift" ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-[#e056fd]/10 text-[#e056fd] border border-[#e056fd]/20 text-[10px] font-bold"><Sparkles size={9}/> Auto</span>
                    ) : txn.status === "pending" ? (
                      <div className="flex gap-2">
                        {isProc ? <Loader2 className="animate-spin" size={18}/> : (<>
                          <button onClick={() => handleApprove(txn)} className="p-1.5 bg-emerald-500/10 text-emerald-400 rounded-lg border border-emerald-500/20"><CheckCircle2 size={16}/></button>
                          <button onClick={() => handleReject(txn)} className="p-1.5 bg-red-500/10 text-red-400 rounded-lg border border-red-500/20"><XCircle size={16}/></button>
                        </>)}
                      </div>
                    ) : <span className="text-white/20 text-xs">—</span>}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop Table */}
          <div className="hidden md:block cyber-glass rounded-2xl overflow-hidden border border-white/5">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-white/10 bg-white/5">
                    {["Tipo","Usuario","Datos Bancarios","Referencia","BS","CR","Estado","Fecha","Acciones"].map(h => (
                      <th key={h} className="px-4 py-3 font-medium text-white/35 text-xs uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {transactions.length === 0 ? (
                    <tr><td colSpan={9} className="p-8 text-center text-white/30">No hay transacciones.</td></tr>
                  ) : transactions.map(txn => {
                    const isProc = processingId === txn.id;
                    const prof = txn.profiles;
                    return (
                      <tr key={txn.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                        <td className="px-4 py-3">
                          <span className={`text-[10px] font-bold uppercase tracking-widest ${txn.type === "deposit" ? "text-[#00d1ff]" : txn.type === "gift" ? "text-[#e056fd]" : "text-white/50"}`}>
                            {txn.type === "deposit" ? "Recarga" : txn.type === "gift" ? "Gift" : "Retiro"}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-medium text-[#00d1ff]">@{prof?.username || "—"}</td>
                        <td className="px-4 py-3 text-xs text-white/50 space-y-0.5">
                          <p className="font-medium text-white/70">{prof?.bank_name || "—"}</p>
                          <p>{prof?.id_card}</p><p>{prof?.phone_number}</p>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs">{txn.reference_number || "—"}</td>
                        <td className="px-4 py-3 font-semibold">{fmtBs(parseFloat(txn.amount_bs || 0))}</td>
                        <td className="px-4 py-3 font-bold text-[#ff007a]">{fmtCR(txn.amount_credits ?? 0)}</td>
                        <td className="px-4 py-3"><StatusBadge status={txn.status}/></td>
                        <td className="px-4 py-3 text-xs text-white/30">{new Date(txn.created_at).toLocaleDateString("es-VE", { day:"2-digit", month:"short", hour:"2-digit", minute:"2-digit" })}</td>
                        <td className="px-4 py-3 text-right">
                          {txn.type === "gift" ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-[#e056fd]/10 text-[#e056fd] border border-[#e056fd]/20 text-[10px] font-bold"><Sparkles size={9}/> Auto</span>
                          ) : txn.status === "pending" ? (
                            <div className="flex items-center justify-end gap-1.5">
                              {isProc ? <Loader2 className="animate-spin" size={18}/> : (<>
                                <button onClick={() => handleApprove(txn)} className="p-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-lg border border-emerald-500/20"><CheckCircle2 size={15}/></button>
                                <button onClick={() => handleReject(txn)} className="p-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg border border-red-500/20"><XCircle size={15}/></button>
                              </>)}
                            </div>
                          ) : <span className="text-white/20">—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ══════════════════════════════════════
          TAB: CORTE SEMANAL
          Collapsible rows per user
      ══════════════════════════════════════ */}
      {tab === "settlement" && (
        <div className="space-y-4">
          {/* Exchange rate control */}
          <div className="cyber-glass rounded-2xl p-4 border border-[#ffd700]/10 flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex-1">
              <h3 className="font-bold text-[#ffd700] text-sm">Tasa de Cambio</h3>
              <p className="text-white/30 text-xs mt-0.5">100 CR = X Bs a pagar al usuario (60% del gift)</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-white/40 text-sm">100 CR =</span>
              <input type="number" value={exchangeRate}
                onChange={e => setExchangeRate(Number(e.target.value))}
                className="w-24 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white font-bold text-center focus:outline-none focus:border-[#ffd700]/50"/>
              <span className="text-white/40 text-sm">Bs</span>
            </div>
          </div>

          {/* Summary — triple currency */}
          {(() => {
            const totalCr    = settlement.reduce((s, r) => s + r.total_cr,       0);
            const payoutCr   = settlement.reduce((s, r) => s + r.user_share_cr,  0);
            const payoutBs   = settlement.reduce((s, r) => s + r.user_payout_bs, 0);
            const appCr      = settlement.reduce((s, r) => s + r.app_share_cr,   0);
            const cards = [
              {
                label: "Total Gifts (7d)",
                main: fmtCR(totalCr),
                sub1: fmtUSD(crToUsd(totalCr)),
                sub2: bcvRate ? fmtBs(crToBs(totalCr, bcvRate)) : null,
                color: "text-[#e056fd]",
              },
              {
                label: "Payout Usuarios 60%",
                main: fmtBs(payoutBs),
                sub1: fmtCR(payoutCr),
                sub2: fmtUSD(crToUsd(payoutCr)),
                color: "text-emerald-400",
              },
              {
                label: "Ganancia App 40%",
                main: fmtCR(appCr),
                sub1: fmtUSD(crToUsd(appCr)),
                sub2: bcvRate ? fmtBs(crToBs(appCr, bcvRate)) : null,
                color: "text-[#ffd700]",
              },
            ];
            return (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {cards.map(c => (
                  <div key={c.label} className="cyber-glass rounded-xl p-4 border-white/5">
                    <p className="text-[10px] text-white/30 uppercase tracking-wider mb-2">{c.label}</p>
                    <p className={`text-lg font-black ${c.color}`}>{c.main}</p>
                    <div className="mt-1.5 space-y-0.5">
                      <p className="text-[11px] text-white/35 font-medium">{c.sub1}</p>
                      {c.sub2 && <p className="text-[11px] text-white/35 font-medium">{c.sub2}</p>}
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}

          {/* Collapsible user list */}
          {settLoading ? (
            <div className="py-10 text-center"><Loader2 className="animate-spin text-[#ffd700] mx-auto" size={28}/></div>
          ) : settlement.length === 0 ? (
            <div className="py-10 text-center text-white/30 text-sm">No hay gifts en los últimos 7 días.</div>
          ) : (
            <div className="space-y-3">
              {settlement.map(row => (
                <div key={row.user_id} className={`cyber-glass rounded-2xl border overflow-hidden transition-all ${row.paid ? "border-emerald-500/20 opacity-60" : "border-white/5"}`}>
                  {/* ── Collapsed Header ── */}
                  <button
                    onClick={() => toggleExpanded(row.user_id)}
                    className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-white/[0.02] transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="text-left">
                        <p className="font-semibold text-[#00d1ff] text-sm">@{row.username}</p>
                        <p className="text-[10px] text-white/30 mt-0.5">{fmtCR(row.total_cr)} total · 60% → {fmtCR(row.user_share_cr)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-base font-black text-[#ffd700]">{fmtBs(row.user_payout_bs)}</p>
                        <p className="text-[10px] text-white/30">{fmtUSD(crToUsd(row.user_share_cr))}</p>
                      </div>
                      {row.paid
                        ? <span className="text-[10px] text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full">✓ Pagado</span>
                        : row.expanded ? <ChevronUp size={16} className="text-white/40"/> : <ChevronDown size={16} className="text-white/40"/>
                      }
                    </div>
                  </button>

                  {/* ── Expanded Details ── */}
                  {row.expanded && !row.paid && (
                    <div className="border-t border-white/5 px-4 py-4 space-y-4">
                      {/* Banking info with copy buttons */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {[
                          { label: "Banco", value: row.bank_name, id: `bank-${row.user_id}` },
                          { label: "Cédula", value: row.id_card, id: `id-${row.user_id}` },
                          { label: "Teléfono", value: row.phone_number, id: `phone-${row.user_id}` },
                        ].map(field => (
                          <div key={field.label} className="bg-black/30 rounded-xl p-3 border border-white/5">
                            <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1">{field.label}</p>
                            {field.value ? (
                              <button
                                onClick={() => copyToClipboard(field.value!, field.id)}
                                className="flex items-center gap-1.5 text-sm text-white/80 hover:text-white transition-colors group font-mono"
                              >
                                {field.value}
                                {copiedField === field.id
                                  ? <CheckCheck size={12} className="text-emerald-400"/>
                                  : <Copy size={12} className="opacity-0 group-hover:opacity-40 transition-opacity"/>
                                }
                              </button>
                            ) : <span className="text-white/20 text-sm">—</span>}
                          </div>
                        ))}
                      </div>

                      {/* Split breakdown */}
                      <div className="flex flex-wrap gap-2 text-xs">
                        <div className="bg-[#e056fd]/5 border border-[#e056fd]/15 rounded-lg px-3 py-2">
                          <p className="text-white/30 text-[10px] mb-0.5">Total gifts</p>
                          <p className="font-bold text-[#e056fd]">{fmtCR(row.total_cr)}</p>
                          <p className="text-[10px] text-white/30 mt-0.5">{fmtUSD(crToUsd(row.total_cr))}{bcvRate ? ` · ${fmtBs(crToBs(row.total_cr, bcvRate))}` : ""}</p>
                        </div>
                        <div className="bg-emerald-500/5 border border-emerald-500/15 rounded-lg px-3 py-2">
                          <p className="text-white/30 text-[10px] mb-0.5">60% usuario</p>
                          <p className="font-bold text-emerald-400">{fmtCR(row.user_share_cr)}</p>
                          <p className="text-[10px] text-white/30 mt-0.5">{fmtBs(row.user_payout_bs)} · {fmtUSD(crToUsd(row.user_share_cr))}</p>
                        </div>
                        <div className="bg-[#ffd700]/5 border border-[#ffd700]/15 rounded-lg px-3 py-2">
                          <p className="text-white/30 text-[10px] mb-0.5">40% app</p>
                          <p className="font-bold text-[#ffd700]">{fmtCR(row.app_share_cr)}</p>
                          <p className="text-[10px] text-white/30 mt-0.5">{fmtUSD(crToUsd(row.app_share_cr))}{bcvRate ? ` · ${fmtBs(crToBs(row.app_share_cr, bcvRate))}` : ""}</p>
                        </div>
                      </div>

                      <button
                        onClick={() => togglePaid(row.user_id)}
                        className="w-full py-2.5 rounded-xl font-bold text-sm bg-[#ffd700]/10 text-[#ffd700] border border-[#ffd700]/20 hover:bg-[#ffd700]/20 transition-all"
                      >
                        Marcar como Pagado ✓
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
