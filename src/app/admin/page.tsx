"use client";

import { useState, useEffect } from "react";
import {
  CheckCircle2, XCircle, Clock, Loader2, RefreshCw,
  ShieldAlert, Sparkles, Scissors, Copy, CheckCheck, ChevronDown, ChevronUp, Swords, Trophy, Banknote, MessageCircle, Mail, Phone, Building2, FileText
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { fmtWCR, fmtBCR, fmtBs, fmtUSD, crToUsd, crToBs } from "@/utils/format";
import { useAuth } from "@/components/AuthProvider";
import { useSearchParams, useRouter } from "next/navigation";

type Tab = "transactions" | "settlement" | "battle_settlement";
type TxSubTab = "all" | "recargas" | "retiros_wcr" | "cobros_bcr";

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
  app_share_bs: number;
  total_bs: number;
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
  const [hasMounted, setHasMounted] = useState(false);
  const supabase = createClient();
  const { user: authUser, profile, isAdmin, loading: authLoading } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();

  // Emergency URL param: if ?role=admin, treat as a hint to verify
  const urlRoleHint = searchParams.get("role") === "admin";

  // Server-verified admin flag (stronger than client-side isAdmin)
  const [verifiedAdmin, setVerifiedAdmin] = useState(isAdmin || urlRoleHint);

  const [tab, setTab] = useState<Tab>("transactions");
  const [txSubTab, setTxSubTab] = useState<TxSubTab>("all");
  const [transactions, setTransactions] = useState<any[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [adminRefs, setAdminRefs] = useState<Record<string, string>>({});

  // Settlement
  const [settlement, setSettlement] = useState<SettlementRow[]>([]);
  const [exchangeRate, setExchangeRate] = useState(80);
  const [settLoading, setSettLoading] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // BCR Settlement
  const [bcrSettlement, setBcrSettlement] = useState<SettlementRow[]>([]);
  const [bcrLoading, setBcrLoading] = useState(false);
  const [bcrBattles, setBcrBattles] = useState<any[]>([]);
  const [bcvRate, setBcvRate] = useState<number | null>(null);

  const [wakeCount, setWakeCount] = useState(0);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  // Server-side role verification: confirms admin via DB, not just client state
  useEffect(() => {
    if (!authUser) return;
    void (async () => {
      try {
        const { data } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", authUser.id)
          .single();
        const confirmed = data?.role === "admin";
        setVerifiedAdmin(confirmed);
        // If confirmed, persist the URL hint so it survives refreshes
        if (confirmed && !searchParams.has("role")) {
          const url = new URL(window.location.href);
          url.searchParams.set("role", "admin");
          window.history.replaceState({}, "", url.toString());
        }
      } catch {
        // Network error — trust cached state
      }
    })();
  }, [authUser, supabase, searchParams]);

  useEffect(() => {
    if (!authUser || !verifiedAdmin) return;
    let isMounted = true;
    initAdmin(isMounted);
    return () => { isMounted = false; };
  }, [authUser, verifiedAdmin, wakeCount]);

  const initAdmin = async (isMounted: boolean) => {
    setDataLoading(true);
    try {
      const { data: rateRow } = await supabase.from("app_config").select("value").eq("key", "bcv_rate").single();
      if (rateRow?.value && isMounted) { const r = parseFloat(rateRow.value); setBcvRate(r); setExchangeRate(r); }
      await fetchTransactions(isMounted);
    } catch (err) {
      console.error(err);
    } finally {
      if (isMounted) setDataLoading(false);
    }
  };

  const fetchTransactions = async (isMounted: boolean = true) => {
    if (isMounted) setTransactions([]);
    try {
      const { data: roleData } = await supabase.from("profiles").select("role").eq("id", authUser?.id).single();
      console.log("User Role:", roleData?.role);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000); // 3s Timeout
      
      let { data, error } = await supabase
        .from('transactions')
        .select('*, profiles!fk_user(username, bank_name, id_card, phone_number, whatsapp_number, email)')
        .order('created_at', { ascending: false })
        .limit(200)
        .abortSignal(controller.signal);

      if (error && error.code === 'PGRST201') {
        console.warn("PGRST201: Intentando con transactions_user_id_fkey...");
        const res2 = await supabase
          .from('transactions')
          .select('*, profiles!transactions_user_id_fkey(username, bank_name, id_card, phone_number, whatsapp_number, email)')
          .order('created_at', { ascending: false })
          .limit(200)
          .abortSignal(controller.signal);
        data = res2.data;
        error = res2.error;
      }

      if (error && error.code === 'PGRST201') {
        console.warn("PGRST201: Fallback de seguridad a select('*') sin profiles...");
        const res3 = await supabase
          .from('transactions')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(200)
          .abortSignal(controller.signal);
        data = res3.data;
        error = res3.error;
      }

      clearTimeout(timeoutId);

      if (error) {
        throw error;
      }
      
      if (isMounted) setTransactions(data || []);
    } catch (err: any) {
      console.error("fetchTransactions crash:", err);
      if (err.name === 'AbortError') {
        console.warn("Retrying fetch due to timeout...");
        if (isMounted) {
          // Reintentar una vez si hay timeout
          setTimeout(() => fetchTransactions(isMounted), 1000);
        }
      } else {
        if (isMounted) setTransactions([]);
      }
    }
  };

  const forceRefresh = async () => {
    setTransactions([]);
    setDataLoading(true);
    await fetchTransactions(true);
    setDataLoading(false);
  };

  const fetchSettlement = async (isMounted: boolean = true) => {
    setSettLoading(true);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      
      const { data: gifts, error } = await supabase
        .from("admin_dashboard_stats")
        .select("user_id, amount_credits, amount_bs, username, bank_name, id_card, phone_number, whatsapp_number, email")
        .in("type", ["gift", "GIFT_SENT", "GIFT"])
        .eq("status", "approved")
        .abortSignal(controller.signal);
      
      clearTimeout(timeoutId);

      if (error) throw error;
      if (!gifts) { if (isMounted) setSettLoading(false); return; }

      const map = new Map<string, SettlementRow>();
      for (const g of gifts) {
        if (!map.has(g.user_id)) {
          map.set(g.user_id, {
            user_id: g.user_id, username: g.username || "—",
            bank_name: g.bank_name || null, id_card: g.id_card || null, phone_number: g.phone_number || null,
            total_cr: 0, user_share_cr: 0, app_share_cr: 0, user_payout_bs: 0,
            total_bs: 0, app_share_bs: 0,
            paid: false, expanded: false,
          });
        }
        const row = map.get(g.user_id)!;
        row.total_cr += (g.amount_credits || 0);
        row.total_bs += parseFloat(g.amount_bs || "0");
      }
      for (const row of map.values()) {
        row.user_share_cr = Math.floor(row.total_cr * 0.6);
        row.app_share_cr = row.total_cr - row.user_share_cr;
        row.user_payout_bs = row.total_bs * 0.6;
        row.app_share_bs = row.total_bs * 0.4;
      }
      if (isMounted) setSettlement(Array.from(map.values()).sort((a, b) => b.total_cr - a.total_cr));
    } catch (err: any) {
      if (err.name === 'AbortError') {
         if (isMounted) setTimeout(() => fetchSettlement(isMounted), 1000);
      }
    } finally {
      if (isMounted) setSettLoading(false);
    }
  };

  useEffect(() => { 
    let isMounted = true;
    if (tab === "settlement") fetchSettlement(isMounted); 
    return () => { isMounted = false; };
  }, [tab, exchangeRate, wakeCount]);
  
  useEffect(() => { 
    let isMounted = true;
    if (tab === "battle_settlement") fetchBcrSettlement(isMounted); 
    return () => { isMounted = false; };
  }, [tab, exchangeRate, wakeCount]);

  const fetchBcrSettlement = async (isMounted: boolean = true) => {
    setBcrLoading(true);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const { data: wins, error } = await supabase
        .from("admin_dashboard_stats")
        .select("user_id, amount_credits, opponent_id, battle_id, created_at, reference_number, username, bank_name, id_card, phone_number, whatsapp_number, email")
        .in("type", ["battle_win", "BATTLE_WIN"])
        .eq("status", "approved")
        .abortSignal(controller.signal);

      clearTimeout(timeoutId);

      if (error) throw error;
      if (!wins) { if (isMounted) setBcrLoading(false); return; }
      if (isMounted) setBcrBattles(wins);

      const map = new Map<string, SettlementRow>();
      for (const w of wins) {
        if (!map.has(w.user_id)) {
          map.set(w.user_id, {
            user_id: w.user_id, username: w.username || "—",
            bank_name: w.bank_name || null, id_card: w.id_card || null, phone_number: w.phone_number || null,
            total_cr: 0, user_share_cr: 0, app_share_cr: 0, user_payout_bs: 0,
            total_bs: 0, app_share_bs: 0,
            paid: false, expanded: false,
          });
        }
        map.get(w.user_id)!.total_cr += w.amount_credits;
      }
      for (const row of map.values()) {
        row.user_share_cr = Math.floor(row.total_cr * 0.6);
        row.app_share_cr = row.total_cr - row.user_share_cr;
        row.user_payout_bs = crToBs(row.user_share_cr, bcvRate || exchangeRate);
      }
      if (isMounted) setBcrSettlement(Array.from(map.values()).sort((a, b) => b.total_cr - a.total_cr));
    } catch (err: any) {
       if (err.name === 'AbortError') {
          if (isMounted) setTimeout(() => fetchBcrSettlement(isMounted), 1000);
       }
    } finally {
      if (isMounted) setBcrLoading(false);
    }
  };

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
    const adminRef = adminRefs[txn.id] || "";
    if ((txn.type === "WITHDRAW" || txn.type === "withdrawal" || txn.type === "WITHDRAW_BCR") && !adminRef.trim()) {
      alert("Por favor, ingresa los 6 dígitos de la referencia de pago.");
      return;
    }

    setProcessingId(txn.id);
    
    try {
      const res = await fetch("/api/admin/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transaction_id: txn.id,
          user_id: txn.user_id,
          amount_credits: txn.amount_credits,
          action: "approve",
          admin_reference: adminRef
        })
      });

      if (!res.ok) {
        const { error } = await res.json();
        console.error("Approve failed:", error);
        alert("Error al aprobar: " + error);
        setProcessingId(null);
        return;
      }
      
      // Update UI first before leaving context
      await fetchTransactions();
      setProcessingId(null);

      // ── Auto-open WhatsApp with payment confirmation ──
      const prof = txn.profiles;
      const waNumber = prof?.whatsapp_number?.replace(/\D/g, '') || '';
      const amountBs = txn.amount_bs || '0';
      
      if (waNumber) {
        const msg = encodeURIComponent(
          `Hola, tu pago de ${amountBs} Bs ha sido enviado. Ref: ${adminRef}.`
        );
        setTimeout(() => {
          window.open(`https://wa.me/${waNumber}?text=${msg}`, '_blank');
        }, 1000);
      }
      
    } catch (e) {
      console.error("Approve exception:", e);
      alert("Error de conexión al aprobar. Verifica tu internet.");
      setProcessingId(null);
    }
  };

  const handleReject = async (txn: any) => {
    setProcessingId(txn.id);
    
    try {
      const res = await fetch("/api/admin/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transaction_id: txn.id,
          user_id: txn.user_id,
          amount_credits: txn.amount_credits,
          action: "reject"
        })
      });

      if (!res.ok) {
        const { error } = await res.json();
        console.error("Reject failed:", error);
        alert("Error al rechazar: " + error);
      }
    } catch (e) {
      console.error("Reject exception:", e);
    }

    setProcessingId(null);
    await fetchTransactions();
  };

  const handleUpdateBcv = async () => {
    if (bcvRate === null) return;
    setProcessingId("bcv_rate");
    const { error } = await supabase
      .from("app_config")
      .update({ value: bcvRate.toString() })
      .eq("key", "bcv_rate");
    
    setProcessingId(null);
    if (error) alert("Error actualizando tasa: " + error.message);
    else alert("Tasa BCV actualizada correctamente.");
  };



  // ── Guards ──
  if (!hasMounted) return null;

  if (!authLoading && !verifiedAdmin) return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center p-8">
      <ShieldAlert className="text-red-500" size={56}/>
      <h1 className="text-2xl font-black">Acceso Denegado</h1>
      <p className="text-white/40 max-w-sm text-sm">No tienes permisos para acceder al Panel de Administración.</p>
    </div>
  );

  if (verifiedAdmin && !profile) return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center p-8">
      <Loader2 className="animate-spin text-yellow-400" size={56}/>
      <h1 className="text-2xl font-black">Sincronizando seguridad...</h1>
      <p className="text-white/40 max-w-sm text-sm">Validando tu identidad para evitar el modo invitado.</p>
    </div>
  );

  const pending = transactions.filter((t: any) => t.status === "pending");
  const totalGiftsCr = transactions.filter((t: any) => t.type === "gift" || t.type === "GIFT_SENT" || t.type === "GIFT").reduce((s: any, t: any) => s + (t.amount_credits || 0), 0);
  const totalGiftsBs = transactions.filter((t: any) => t.type === "gift" || t.type === "GIFT_SENT" || t.type === "GIFT").reduce((s: any, t: any) => s + parseFloat(t.amount_bs || 0), 0);
  const totalBattleCr = transactions.filter((t: any) => t.type === "battle_win" || t.type === "BATTLE_WIN").reduce((s: any, t: any) => s + (t.amount_credits || 0), 0);
  const totalBattleBs = transactions.filter((t: any) => t.type === "battle_win" || t.type === "BATTLE_WIN").reduce((s: any, t: any) => s + parseFloat(t.amount_bs || 0), 0);
  const totalDepositsCr = transactions.filter((t: any) => t.type === "DEPOSIT" || t.type === "deposit" || t.type === "DEPOSIT_PENDING").reduce((s: any, t: any) => s + (t.amount_credits || 0), 0);
  const totalDepositsBs = transactions.filter((t: any) => t.type === "DEPOSIT" || t.type === "deposit" || t.type === "DEPOSIT_PENDING").reduce((s: any, t: any) => s + parseFloat(t.amount_bs || 0), 0);

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
            <span className="block text-[9px] text-white/20">{fmtBs(totalGiftsBs)}</span>
          </div>
          <div className="cyber-glass px-3 py-2 rounded-xl border-white/5 text-center min-w-[70px]">
            <span className="block text-white/30 text-[10px] uppercase">BCR</span>
            <span className="text-base font-bold text-[#00d1ff]">{totalBattleCr.toLocaleString("es-VE")}</span>
            <span className="block text-[9px] text-white/20">{fmtBs(totalBattleBs)}</span>
          </div>
          <div className="cyber-glass px-3 py-2 rounded-xl border-white/5 text-center min-w-[70px]">
            <span className="block text-white/30 text-[10px] uppercase">Depósitos</span>
            <span className="text-base font-bold text-emerald-400">{totalDepositsCr.toLocaleString("es-VE")}</span>
            <span className="block text-[9px] text-white/20">{fmtBs(totalDepositsBs)}</span>
          </div>
          {bcvRate !== null && (
            <div className="cyber-glass px-3 py-2 rounded-xl border border-[#ffd700]/30 flex items-center gap-3">
              <div className="text-center min-w-[70px]">
                <span className="block text-white/30 text-[10px] uppercase">Tasa BCV</span>
                <input 
                  id="admin-bcv-rate"
                  name="admin_bcv_rate"
                  type="number" 
                  value={bcvRate} 
                  onChange={(e) => setBcvRate(parseFloat(e.target.value))}
                  className="bg-transparent text-base font-bold text-[#ffd700] w-16 text-center focus:outline-none"
                />
              </div>
              <button 
                onClick={handleUpdateBcv}
                disabled={processingId === "bcv_rate"}
                className="p-1.5 bg-[#ffd700]/10 text-[#ffd700] rounded-lg hover:bg-[#ffd700]/20 transition-all border border-[#ffd700]/20 disabled:opacity-50"
              >
                {processingId === "bcv_rate" ? <Loader2 size={14} className="animate-spin"/> : <CheckCircle2 size={14}/>}
              </button>
            </div>
          )}
          <button onClick={() => { forceRefresh(); if (tab === "settlement") fetchSettlement(); if (tab === "battle_settlement") fetchBcrSettlement(); }}
            className="p-2.5 cyber-glass rounded-xl border-white/5 hover:bg-white/10 transition-colors" title="Forzar Actualización">
            <RefreshCw size={15}/>
          </button>
        </div>
      </div>

      {/* ── Main Tabs ── */}
      <div className="flex gap-1 bg-black/30 rounded-xl p-1 w-max border border-white/5 flex-wrap">
        <button onClick={() => setTab("transactions")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === "transactions" ? "bg-white/10 text-white" : "text-white/35 hover:text-white/60"}`}>
          Transacciones
        </button>
        <button onClick={() => setTab("settlement")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${tab === "settlement" ? "bg-[#ffd700]/10 text-[#ffd700] border border-[#ffd700]/20" : "text-white/35 hover:text-white/60"}`}>
          <Scissors size={13}/> Corte Gifts
        </button>
        <button onClick={() => setTab("battle_settlement")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${tab === "battle_settlement" ? "bg-[#00d1ff]/10 text-[#00d1ff] border border-[#00d1ff]/20" : "text-white/35 hover:text-white/60"}`}>
          <Trophy size={13}/> Liquidación BCR
        </button>
      </div>

      {/* ── Sub-tabs for Transactions ── */}
      {tab === "transactions" && (
        <div className="flex gap-1 bg-black/20 rounded-lg p-0.5 w-max border border-white/5">
          {(["all", "recargas", "retiros_wcr", "cobros_bcr"] as TxSubTab[]).map(st => {
            const labels: Record<TxSubTab, string> = { all: "Todas", recargas: "Recargas", retiros_wcr: "Retiros WCR", cobros_bcr: "Cobros BCR" };
            const colors: Record<TxSubTab, string> = { all: "text-white", recargas: "text-[#00d1ff]", retiros_wcr: "text-white/70", cobros_bcr: "text-orange-400" };
            return (
              <button key={st} onClick={() => setTxSubTab(st)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${txSubTab === st ? `bg-white/10 ${colors[st]}` : "text-white/30 hover:text-white/50"}`}>
                {labels[st]}
              </button>
            );
          })}
        </div>
      )}

      {/* ══════════════════════════════════════
          TAB: TRANSACTIONS
          Mobile → cards | Desktop → table
      ══════════════════════════════════════ */}
      {tab === "transactions" && (() => {
        const filteredTxns = txSubTab === "all" ? transactions
          : txSubTab === "recargas" ? transactions.filter((t: any) => t.type === "DEPOSIT" || t.type === "deposit" || t.type === "DEPOSIT_PENDING")
          : txSubTab === "retiros_wcr" ? transactions.filter((t: any) => t.type === "WITHDRAW" || t.type === "withdrawal")
          : transactions.filter((t: any) => t.type === "WITHDRAW_BCR");
        return (
        <>
          {/* Mobile Cards */}
          <div className="flex flex-col gap-3 md:hidden">
            {filteredTxns.length === 0 && <p className="text-center text-white/30 text-sm py-6">No hay transacciones.</p>}
            {filteredTxns.map((txn: any) => {
              const isProc = processingId === txn.id;
              const prof = txn.profiles || txn;
              return (
                <div key={txn.id} className="cyber-glass rounded-2xl p-4 border border-white/5 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className={`text-[10px] font-bold uppercase tracking-widest ${txn.type === "DEPOSIT" || txn.type === "deposit" || txn.type === "DEPOSIT_PENDING" ? "text-[#00d1ff]" : txn.type === "gift" || txn.type === "GIFT_SENT" ? "text-[#e056fd]" : txn.type === "BATTLE_WIN" || txn.type === "battle_win" ? "text-[#ffd700]" : txn.type === "WITHDRAW_BCR" ? "text-orange-400" : "text-white/50"}`}>
                        {txn.type === "DEPOSIT" || txn.type === "deposit" || txn.type === "DEPOSIT_PENDING" ? "Recarga" : txn.type === "gift" || txn.type === "GIFT_SENT" ? "Gift" : txn.type === "BATTLE_WIN" || txn.type === "battle_win" ? "Batalla" : txn.type === "WITHDRAW_BCR" ? "Cobro BCR" : "Retiro WCR"}
                      </span>
                      <p className="font-semibold text-sm mt-0.5">@{prof?.username || "—"}</p>
                    </div>
                    <StatusBadge status={txn.status}/>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <p className="text-white/30 font-light">Créditos</p>
                      <p className="font-bold text-[#ff007a]">
                        {txn.type.includes("BATTLE") ? fmtBCR(txn.amount_credits ?? 0) : fmtWCR(txn.amount_credits ?? 0)}
                      </p>
                    </div>
                    <div>
                      <p className="text-white/30 font-light">Monto BS</p>
                      <p className="font-bold">{fmtBs(parseFloat(txn.amount_bs || 0))}</p>
                    </div>
                    {/* ── ENVIAR COMPROBANTE A ── */}
                    <div className="col-span-2 mt-1 border-t border-white/5 pt-2 space-y-1.5">
                      <p className="text-[#25D366] font-bold text-[10px] uppercase tracking-wider flex items-center gap-1"><MessageCircle size={10}/> Enviar Comprobante A:</p>
                      <div className="flex flex-col gap-1 text-[11px]">
                        {prof?.whatsapp_number ? (
                          <a href={`https://wa.me/${prof.whatsapp_number.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-[#25D366] hover:underline">
                            <Phone size={10}/> {prof.whatsapp_number}
                          </a>
                        ) : <span className="text-white/20">WA: —</span>}
                        <p className="flex items-center gap-1.5 text-white/60"><Mail size={10}/> {prof?.email || "—"}</p>
                      </div>
                    </div>
                    {/* ── DATOS BANCARIOS (PAGO MÓVIL) ── */}
                    <div className="col-span-2 border-t border-white/5 pt-2 space-y-1.5">
                      <p className="text-[#ffd700] font-bold text-[10px] uppercase tracking-wider flex items-center gap-1"><Building2 size={10}/> Datos Bancarios (Pago Móvil):</p>
                      <div className="grid grid-cols-2 gap-1 text-[11px]">
                        <p><span className="text-white/40">Banco:</span> {txn.bank_name || prof?.bank_name || "—"}</p>
                        <p><span className="text-white/40">Cédula:</span> {prof?.id_card || "—"}</p>
                        <p className="col-span-2"><span className="text-white/40">Tel Pago Móvil:</span> {prof?.phone_number || "—"}</p>
                      </div>
                    </div>
                    {/* ── REFERENCIA USUARIO (Para recargas) ── */}
                    {txn.reference_number && (
                      <div className="col-span-2 border-t border-white/5 pt-2 space-y-1.5">
                        <p className="text-[#00d1ff] font-bold text-[10px] uppercase tracking-wider">Referencia Usuario:</p>
                        <p className="font-mono text-xs font-black bg-white/5 py-1 px-2 rounded">{txn.reference_number}</p>
                      </div>
                    )}

                    {/* ── REFERENCIA ADMIN (Solo retiros/cobros) ── */}
                    {(txn.type === "WITHDRAW" || txn.type === "WITHDRAW_BCR" || txn.type === "withdrawal") && txn.status === "pending" && (
                      <div className="col-span-2 mt-2">
                        <input
                          id={`admin-ref-${txn.id}`}
                          name={`admin_ref_${txn.id}`}
                          type="text"
                          placeholder="Escribe ref. de pago (6 dígitos)"
                          maxLength={6}
                          value={adminRefs[txn.id] || ""}
                          onChange={(e) => setAdminRefs({ ...adminRefs, [txn.id]: e.target.value.replace(/\D/g, '') })}
                          className="w-full bg-black/40 border border-white/20 rounded-lg py-1.5 px-3 text-xs text-white placeholder-white/40 focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                    )}
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <p className="text-[10px] text-white/25">{new Date(txn.created_at).toLocaleDateString("es-VE", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
                    {txn.type === "gift" || txn.type === "GIFT_SENT" || txn.type === "BATTLE_WIN" || txn.type === "battle_win" ? (
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full border text-[10px] font-bold ${txn.type.includes("BATTLE") ? "bg-[#ffd700]/10 text-[#ffd700] border-[#ffd700]/20" : "bg-[#e056fd]/10 text-[#e056fd] border-[#e056fd]/20"}`}><Sparkles size={9}/> Auto</span>
                    ) : txn.status === "pending" ? (
                      <div className="flex gap-2">
                        {isProc ? <Loader2 className="animate-spin" size={18}/> : (<>
                          <button onClick={() => handleApprove(txn)} className="p-1.5 bg-emerald-500/10 text-emerald-400 rounded-lg border border-emerald-500/20" title="Aprobar Pago"><CheckCircle2 size={16}/></button>
                          <button onClick={() => handleReject(txn)} className="p-1.5 bg-red-500/10 text-red-400 rounded-lg border border-red-500/20" title="Rechazar"><XCircle size={16}/></button>
                          {(txn.type === "WITHDRAW" || txn.type === "WITHDRAW_BCR" || txn.type === "withdrawal") && prof?.whatsapp_number && (
                            <a href={`https://wa.me/${prof.whatsapp_number.replace(/\D/g, '')}?text=Hola%20${prof.username},%20tu%20solicitud%20de%20retiro%20por%20${fmtBs(parseFloat(txn.amount_bs || 0))}%20ha%20sido%20aprobada%20y%20procesada.`} target="_blank" rel="noreferrer" className="p-1.5 bg-[#25D366]/10 text-[#25D366] rounded-lg border border-[#25D366]/20" title="Notificar Vía WhatsApp">
                              <CheckCheck size={16}/>
                            </a>
                          )}
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
                    {["Tipo","Usuario","Banco","Referencia","BS","CR","Estado","Fecha","Acciones"].map(h => (
                      <th key={h} className="px-4 py-3 font-medium text-white/35 text-xs uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredTxns.length === 0 ? (
                    <tr><td colSpan={9} className="p-8 text-center text-white/30">No hay transacciones.</td></tr>
                  ) : filteredTxns.map((txn: any) => {
                    const isProc = processingId === txn.id;
                    const prof = txn.profiles || txn;
                    return (
                      <tr key={txn.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                        <td className="px-4 py-3">
                          <span className={`text-[10px] font-bold uppercase tracking-widest ${txn.type === "DEPOSIT" || txn.type === "deposit" || txn.type === "DEPOSIT_PENDING" ? "text-[#00d1ff]" : (txn.type === "gift" || txn.type === "GIFT_SENT" ? "text-[#e056fd]" : (txn.type === "BATTLE_WIN" || txn.type === "battle_win" ? "text-[#ffd700]" : txn.type === "WITHDRAW_BCR" ? "text-orange-400" : "text-white/50"))}`}>
                            {txn.type === "DEPOSIT" || txn.type === "deposit" || txn.type === "DEPOSIT_PENDING" ? "Depósito" : (txn.type === "gift" || txn.type === "GIFT_SENT" ? "Gift" : (txn.type === "BATTLE_WIN" || txn.type === "battle_win" ? "Batalla" : txn.type === "WITHDRAW_BCR" ? "Cobro BCR" : "Retiro WCR"))}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-medium text-[#00d1ff]">@{prof?.username || "—"}</td>
                        <td className="px-4 py-3 text-xs space-y-2">
                          <div className="space-y-0.5">
                            <p className="text-[9px] text-[#25D366] font-bold uppercase tracking-wider flex items-center gap-1"><MessageCircle size={9}/> Comprobante A:</p>
                            {prof?.whatsapp_number ? (
                              <a href={`https://wa.me/${prof.whatsapp_number.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="text-[#25D366] hover:underline flex items-center gap-1"><Phone size={9}/> {prof.whatsapp_number}</a>
                            ) : <span className="text-white/20">WA: —</span>}
                            <p className="text-white/50 flex items-center gap-1"><Mail size={9}/> {prof?.email || "—"}</p>
                          </div>
                          <div className="border-t border-white/5 pt-1.5 space-y-0.5">
                            <p className="text-[9px] text-[#ffd700] font-bold uppercase tracking-wider flex items-center gap-1"><Building2 size={9}/> Pago Móvil:</p>
                            <p className="font-medium text-white/70">{txn.bank_name || prof?.bank_name || "—"}</p>
                            <p className="text-white/50">CI: {prof?.id_card || "—"}</p>
                            <p className="text-white/50">Tel: {prof?.phone_number || "—"}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs">{txn.reference_number || "—"}</td>
                        <td className="px-4 py-3 font-semibold">{fmtBs(parseFloat(txn.amount_bs || 0))}</td>
                        <td className="px-4 py-3 font-bold text-[#ff007a]">
                          {txn.type.includes("BATTLE") ? fmtBCR(txn.amount_credits ?? 0) : fmtWCR(txn.amount_credits ?? 0)}
                        </td>
                        <td className="px-4 py-3"><StatusBadge status={txn.status}/></td>
                        <td className="px-4 py-3 text-xs text-white/30">{new Date(txn.created_at).toLocaleDateString("es-VE", { day:"2-digit", month:"short", hour:"2-digit", minute:"2-digit" })}</td>
                        <td className="px-4 py-3 text-right">
                          {txn.type === "gift" || txn.type === "GIFT_SENT" || txn.type === "BATTLE_WIN" || txn.type === "battle_win" ? (
                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full border text-[10px] font-bold ${txn.type.includes("BATTLE") ? "bg-[#ffd700]/10 text-[#ffd700] border-[#ffd700]/20" : "bg-[#e056fd]/10 text-[#e056fd] border-[#e056fd]/20"}`}><Sparkles size={9}/> Auto</span>
                          ) : txn.status === "pending" ? (
                            <div className="flex flex-col items-end gap-2">
                              {(txn.type === "WITHDRAW" || txn.type === "WITHDRAW_BCR" || txn.type === "withdrawal") && (
                                <input
                                  id={`admin-ref-history-${txn.id}`}
                                  name={`admin_ref_history_${txn.id}`}
                                  type="text"
                                  placeholder="Ref. pago (6 dígitos)"
                                  maxLength={6}
                                  value={adminRefs[txn.id] || ""}
                                  onChange={(e) => setAdminRefs({ ...adminRefs, [txn.id]: e.target.value.replace(/\D/g, '') })}
                                  className="w-[120px] bg-black/40 border border-white/20 rounded-md py-1 px-2 text-xs text-white placeholder-white/40 focus:outline-none focus:border-emerald-500"
                                />
                              )}
                              <div className="flex items-center gap-1.5">
                                {isProc ? <Loader2 className="animate-spin" size={18}/> : (<>
                                  <button onClick={() => handleApprove(txn)} className="px-2 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-md border border-emerald-500/20 flex items-center gap-1"><CheckCircle2 size={13}/> Aprobar</button>
                                  <button onClick={() => handleReject(txn)} className="p-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-md border border-red-500/20" title="Rechazar"><XCircle size={15}/></button>
                                  {(txn.type === "WITHDRAW" || txn.type === "WITHDRAW_BCR" || txn.type === "withdrawal") && prof?.whatsapp_number && (
                                    <a href={`https://wa.me/${prof.whatsapp_number.replace(/\D/g, '')}?text=Hola%20${prof.username},%20tu%20solicitud%20de%20retiro%20por%20${fmtBs(parseFloat(txn.amount_bs || 0))}%20ha%20sido%20aprobada%20y%20procesada.`} target="_blank" rel="noreferrer" className="p-1 bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#25D366] rounded-md border border-[#25D366]/20 flex items-center gap-1" title="Notificar Vía WhatsApp">
                                      <CheckCheck size={13}/> WA
                                    </a>
                                  )}
                                </>)}
                              </div>
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
        );
      })()}

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
              <span className="text-white/40 text-sm">1 USD =</span>
              <input id="admin-exchange-rate" name="admin-exchange-rate" type="number" value={exchangeRate}
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
                main: fmtWCR(totalCr),
                sub1: fmtUSD(crToUsd(totalCr)),
                sub2: bcvRate ? fmtBs(crToBs(totalCr, bcvRate)) : null,
                color: "text-[#e056fd]",
              },
              {
                label: "Payout Usuarios 60%",
                main: fmtBs(payoutBs),
                sub1: fmtWCR(payoutCr),
                sub2: fmtUSD(crToUsd(payoutCr)),
                color: "text-emerald-400",
              },
              {
                label: "Ganancia App 40%",
                main: fmtWCR(appCr),
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
                        <p className="text-[10px] text-white/30 mt-0.5">{fmtWCR(row.total_cr)} total · 60% → {fmtWCR(row.user_share_cr)}</p>
                        <p className="text-[10px] text-[#ff007a] mt-0.5">App (40%): {fmtWCR(row.app_share_cr)} | {fmtBs(row.app_share_bs)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-base font-black text-[#ffd700]">{fmtBs(row.user_payout_bs)}</p>
                        <p className="text-[10px] text-white/30">Usuario (60%)</p>
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
                          <p className="font-bold text-[#e056fd]">{fmtWCR(row.total_cr)}</p>
                          <p className="text-[10px] text-white/30 mt-0.5">{fmtBs(row.total_bs)}</p>
                        </div>
                        <div className="bg-emerald-500/5 border border-emerald-500/15 rounded-lg px-3 py-2">
                          <p className="text-white/30 text-[10px] mb-0.5">60% usuario</p>
                          <p className="font-bold text-emerald-400">{fmtWCR(row.user_share_cr)}</p>
                          <p className="text-[10px] text-white/30 mt-0.5">{fmtBs(row.user_payout_bs)}</p>
                        </div>
                        <div className="bg-[#ffd700]/5 border border-[#ffd700]/15 rounded-lg px-3 py-2">
                          <p className="text-white/30 text-[10px] mb-0.5">40% app</p>
                          <p className="font-bold text-[#ffd700]">{fmtWCR(row.app_share_cr)}</p>
                          <p className="text-[10px] text-white/30 mt-0.5">{fmtBs(row.app_share_bs)}</p>
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

      {/* ══════════════════════════════════════
          TAB: BCR SETTLEMENT (Battle Credits)
      ══════════════════════════════════════ */}
      {tab === "battle_settlement" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-white/40 text-xs flex items-center gap-1.5"><Swords size={12}/> Ganancias de batallas — últimos 7 días</p>
          </div>

          {bcrLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="animate-spin text-[#00d1ff]" size={30}/></div>
          ) : bcrSettlement.length === 0 ? (
            <div className="py-10 text-center text-white/30 text-sm">No hay ganancias de batalla en los últimos 7 días.</div>
          ) : (
            <div className="space-y-3">
              {bcrSettlement.map(row => {
                const userBattles = bcrBattles.filter(b => b.user_id === row.user_id);
                return (
                <div key={row.user_id} className={`cyber-glass rounded-2xl border overflow-hidden transition-all ${row.paid ? "border-emerald-500/20 opacity-60" : "border-white/5"}`}>
                  <button onClick={() => setBcrSettlement(prev => prev.map(r => r.user_id === row.user_id ? { ...r, expanded: !r.expanded } : r))}
                    className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-white/[0.02] transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#00d1ff] to-[#ff007a] flex items-center justify-center"><Trophy size={14} className="text-white"/></div>
                      <div className="text-left">
                        <p className="font-semibold text-[#00d1ff] text-sm">@{row.username}</p>
                        <p className="text-[10px] text-white/30 mt-0.5">{userBattles.length} victoria{userBattles.length !== 1 ? 's' : ''} · {fmtBCR(row.total_cr)} total · 60% → {fmtBCR(row.user_share_cr)}</p>
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

                  {row.expanded && !row.paid && (
                    <div className="border-t border-white/5 px-4 py-4 space-y-4">
                      {/* Battle history list */}
                      <div>
                        <p className="text-[10px] text-white/30 uppercase tracking-wider mb-2">Historial de Batallas</p>
                        <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
                          {userBattles.map((b: any, i: number) => (
                            <div key={i} className="flex items-center justify-between bg-black/30 rounded-xl px-3 py-2 border border-white/5">
                              <div className="flex items-center gap-2">
                                <Swords size={12} className="text-[#ff007a]"/>
                                <span className="text-xs text-white/70">{b.reference_number || '—'}</span>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="text-xs font-bold text-emerald-400">+{fmtBCR(b.amount_credits)}</span>
                                <span className="text-[10px] text-white/25">{new Date(b.created_at).toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit' })} {new Date(b.created_at).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Banking info */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {[
                          { label: "Banco", value: row.bank_name, id: `bcr-bank-${row.user_id}` },
                          { label: "Cédula", value: row.id_card, id: `bcr-id-${row.user_id}` },
                          { label: "Teléfono", value: row.phone_number, id: `bcr-phone-${row.user_id}` },
                        ].map(field => (
                          <div key={field.label} className="bg-black/30 rounded-xl p-3 border border-white/5">
                            <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1">{field.label}</p>
                            {field.value ? (
                              <button onClick={() => copyToClipboard(field.value!, field.id)}
                                className="flex items-center gap-1.5 text-sm text-white/80 hover:text-white transition-colors group font-mono">
                                {field.value}
                                {copiedField === field.id ? <CheckCheck size={12} className="text-emerald-400"/> : <Copy size={12} className="opacity-0 group-hover:opacity-40 transition-opacity"/>}
                              </button>
                            ) : <span className="text-white/20 text-sm">—</span>}
                          </div>
                        ))}
                      </div>

                      {/* Payout summary */}
                      <div className="flex flex-wrap gap-2 text-xs">
                        <div className="bg-[#00d1ff]/5 border border-[#00d1ff]/15 rounded-lg px-3 py-2">
                          <p className="text-white/30 text-[10px] mb-0.5">Total BCR</p>
                          <p className="font-bold text-[#00d1ff]">{fmtBCR(row.total_cr)}</p>
                          <p className="text-[10px] text-white/30 mt-0.5">{fmtUSD(crToUsd(row.total_cr))}{bcvRate ? ` · ${fmtBs(crToBs(row.total_cr, bcvRate))}` : ""}</p>
                        </div>
                        <div className="bg-emerald-500/5 border border-emerald-500/15 rounded-lg px-3 py-2">
                          <p className="text-white/30 text-[10px] mb-0.5">60% usuario</p>
                          <p className="font-bold text-emerald-400">{fmtBCR(row.user_share_cr)}</p>
                          <p className="text-[10px] text-white/30 mt-0.5">{fmtBs(row.user_payout_bs)} · {fmtUSD(crToUsd(row.user_share_cr))}</p>
                        </div>
                        <div className="bg-[#ffd700]/5 border border-[#ffd700]/15 rounded-lg px-3 py-2">
                          <p className="text-white/30 text-[10px] mb-0.5">40% app</p>
                          <p className="font-bold text-[#ffd700]">{fmtBCR(row.app_share_cr)}</p>
                          <p className="text-[10px] text-white/30 mt-0.5">{fmtUSD(crToUsd(row.app_share_cr))}{bcvRate ? ` · ${fmtBs(crToBs(row.app_share_cr, bcvRate))}` : ""}</p>
                        </div>
                      </div>

                      <button onClick={() => setBcrSettlement(prev => prev.map(r => r.user_id === row.user_id ? { ...r, paid: !r.paid } : r))}
                        className="w-full py-2.5 rounded-xl font-bold text-sm bg-[#00d1ff]/10 text-[#00d1ff] border border-[#00d1ff]/20 hover:bg-[#00d1ff]/20 transition-all">
                        Marcar como Pagado ✓
                      </button>
                    </div>
                  )}
                </div>
              )})}
            </div>
          )}
        </div>
      )}


    </div>
  );
}
