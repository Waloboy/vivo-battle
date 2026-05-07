"use client";

import { useState, useEffect } from "react";
import { Wallet, Plus, ArrowUpRight, History, Loader2, CheckCircle2, Sparkles, TrendingUp } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { createClient } from "@/utils/supabase/client";

// ── Utility: dynamic font size for large numbers ──
function balanceFontSize(n: number): string {
  const s = n.toLocaleString();
  if (s.length <= 6) return "text-5xl md:text-6xl";
  if (s.length <= 9) return "text-4xl md:text-5xl";
  return "text-3xl md:text-4xl";
}

export default function Dashboard() {
  const [isReloadModalOpen, setIsReloadModalOpen] = useState(false);
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  const [balance, setBalance] = useState<number>(0);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [bcvRate, setBcvRate] = useState<number | null>(null);

  // Recharge State
  const [amountBs, setAmountBs] = useState("");
  const [refNumber, setRefNumber] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  // Withdraw State
  const [withdrawAmount, setWithdrawAmount] = useState("");

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUser(user);

    const [profileRes, walletRes, txRes, rateRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).single(),
      supabase.from("wallets").select("balance").eq("user_id", user.id).single(),
      supabase.from("transactions").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(10),
      supabase.from("app_config").select("value").eq("key", "bcv_rate").single(),
    ]);

    if (profileRes.data) setProfile(profileRes.data);
    if (walletRes.data) setBalance(walletRes.data.balance);
    if (txRes.data) setTransactions(txRes.data);
    if (rateRes.data?.value) setBcvRate(parseFloat(rateRes.data.value));

    setLoading(false);
  };

  // Conversions: 100 CR = 1 USD (based on deposit rate: 100 BS = 1000 CR → 1 USD ≈ bcvRate BS)
  const balanceUsd = balance / 100;
  const balanceBs = bcvRate ? (balanceUsd * bcvRate) : null;

  const handleRechargeSubmit = async () => {
    if (!amountBs || !refNumber || refNumber.length !== 6) {
      alert("Por favor ingresa un monto válido y los últimos 6 dígitos de la referencia.");
      return;
    }
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (!currentUser) { alert("Sesión expirada."); return; }
    setIsSubmitting(true);
    const amountCredits = Math.floor(parseFloat(amountBs) * 10);
    const { error } = await supabase.from("transactions").insert({
      user_id: currentUser.id, type: "deposit",
      amount_bs: parseFloat(amountBs), amount_credits: amountCredits,
      reference_number: refNumber, status: "pending"
    });
    setIsSubmitting(false);
    if (error) { alert("Error: " + error.message); }
    else { setSuccessMsg("Pago reportado. El admin verificará tus créditos pronto."); setAmountBs(""); setRefNumber(""); fetchData(); }
  };

  const handleWithdrawSubmit = async () => {
    if (!withdrawAmount) return;
    const amountCredits = parseInt(withdrawAmount);
    if (amountCredits > balance) { alert("No tienes suficientes créditos."); return; }
    if (!profile?.phone_number) { alert("Configura tus datos bancarios en el Perfil."); return; }
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (!currentUser) { alert("Sesión expirada."); return; }
    setIsSubmitting(true);
    const bsAmount = amountCredits / 10;
    const { error } = await supabase.from("transactions").insert({
      user_id: currentUser.id, type: "withdrawal",
      amount_credits: amountCredits, amount_bs: bsAmount, status: "pending"
    });
    setIsSubmitting(false);
    if (error) { alert("Error: " + error.message); }
    else { setSuccessMsg("¡Retiro solicitado! En breve el admin procesará tu pago."); setWithdrawAmount(""); fetchData(); }
  };

  if (loading) return <div className="flex-1 flex items-center justify-center"><Loader2 className="animate-spin text-[#ff007a]" size={40} /></div>;

  return (
    <div className="flex-1 max-w-4xl w-full mx-auto p-4 md:p-8 space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-black mb-1">Mi Billetera</h1>
        <p className="text-white/40 text-sm">Gestiona tus créditos, recargas y retiros.</p>
      </div>

      {/* ── Balance Card ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2 cyber-glass p-6 md:p-8 rounded-3xl relative overflow-hidden group border-white/10">
          <div className="absolute top-0 right-0 w-64 h-64 bg-[#00d1ff] rounded-full mix-blend-screen filter blur-[80px] opacity-10 group-hover:opacity-20 transition-opacity" />
          <div className="relative z-10 flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-[#00d1ff]/10 rounded-xl">
                <Wallet className="text-[#00d1ff]" size={22} />
              </div>
              <span className="text-[#00d1ff] font-medium tracking-wider uppercase text-xs">Saldo Disponible</span>
            </div>

            {/* ── Credits (primary) ── */}
            <div className="flex items-baseline gap-2 flex-wrap min-w-0">
              <span className={`font-black leading-none truncate ${balanceFontSize(balance)}`}>
                {balance.toLocaleString()}
              </span>
              <span className="text-base text-white/40 font-medium flex-shrink-0">CR</span>
            </div>

            {/* ── USD + BS conversions ── */}
            <div className="flex flex-wrap gap-3 mt-1">
              <div className="flex items-center gap-1.5 bg-white/5 rounded-xl px-3 py-1.5 border border-white/5">
                <TrendingUp size={12} className="text-emerald-400" />
                <span className="text-sm font-bold text-emerald-400">${balanceUsd.toFixed(2)}</span>
                <span className="text-[10px] text-white/30">USD</span>
              </div>
              {balanceBs !== null && (
                <div className="flex items-center gap-1.5 bg-white/5 rounded-xl px-3 py-1.5 border border-white/5">
                  <span className="text-sm font-bold text-[#ffd700]">{balanceBs.toLocaleString("es-VE", { maximumFractionDigits: 2 })}</span>
                  <span className="text-[10px] text-white/30">BS</span>
                </div>
              )}
            </div>

            {/* ── BCV rate note ── */}
            {bcvRate ? (
              <p className="text-[10px] text-white/25 mt-1">Tasa BCV: 1 USD = {bcvRate.toFixed(2)} BS</p>
            ) : (
              <p className="text-[10px] text-white/20 mt-1">Tasa BCV no disponible aún</p>
            )}
          </div>
        </div>

        {/* ── Action buttons ── */}
        <div className="flex flex-row md:flex-col gap-3">
          <button
            onClick={() => { setSuccessMsg(""); setIsReloadModalOpen(true); }}
            className="flex-1 cyber-glass rounded-2xl p-4 flex flex-col items-center justify-center gap-2 group hover:bg-[#ff007a]/10 hover:border-[#ff007a]/50 transition-all duration-300 border-white/10"
          >
            <div className="h-12 w-12 rounded-full bg-[#ff007a]/20 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Plus className="text-[#ff007a]" size={24} />
            </div>
            <span className="font-bold text-[#ff007a] text-sm">Recargar</span>
          </button>
          <button
            onClick={() => { setSuccessMsg(""); setIsWithdrawModalOpen(true); }}
            className="flex-1 cyber-glass rounded-2xl p-4 flex flex-col items-center justify-center gap-2 group hover:bg-white/5 transition-all border-white/10"
          >
            <div className="h-12 w-12 rounded-full bg-white/5 flex items-center justify-center group-hover:scale-110 transition-transform">
              <ArrowUpRight className="text-white" size={24} />
            </div>
            <span className="font-bold text-white/60 text-sm">Retirar</span>
          </button>
        </div>
      </div>

      {/* ── Transaction history ── */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <History className="text-white/40" size={16} />
          <h2 className="text-lg font-bold">Últimas Transacciones</h2>
        </div>
        <div className="cyber-glass rounded-2xl overflow-hidden border-white/10">
          {transactions.length === 0 ? (
            <div className="p-8 text-center text-white/30 text-sm">No hay movimientos aún.</div>
          ) : transactions.map((txn) => (
            <div key={txn.id} className="flex items-center justify-between px-4 py-3 border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`p-2 rounded-lg flex-shrink-0 ${
                  txn.type === "gift" ? "bg-[#e056fd]/10 text-[#e056fd]" :
                  txn.type === "withdrawal" ? "bg-white/10 text-white" :
                  "bg-[#00d1ff]/10 text-[#00d1ff]"
                }`}>
                  {txn.type === "gift" ? <Sparkles size={16}/> : txn.type === "withdrawal" ? <ArrowUpRight size={16}/> : <Plus size={16}/>}
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">
                    {txn.type === "gift" ? (txn.reference_number || "Gift") :
                     txn.type === "withdrawal" ? "Retiro" : "Recarga Pago Móvil"}
                  </p>
                  <p className="text-[11px] text-white/30">
                    {new Date(txn.created_at).toLocaleDateString("es-VE")} ·{" "}
                    <span className={txn.status === "pending" ? "text-yellow-400/70" : txn.status === "approved" ? "text-emerald-400/70" : "text-red-400/70"}>
                      {txn.status === "pending" ? "Pendiente" : txn.status === "approved" ? "Aprobado" : "Rechazado"}
                    </span>
                  </p>
                </div>
              </div>
              <div className={`font-bold text-sm flex-shrink-0 ${
                txn.type === "gift" ? "text-[#e056fd]" :
                txn.type === "withdrawal" ? "text-white/70" : "text-[#00d1ff]"
              }`}>
                {txn.type === "withdrawal" || txn.type === "gift" ? "-" : "+"}{txn.amount_credits.toLocaleString()}
                <span className="text-[10px] font-normal opacity-40 ml-0.5">CR</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Recharge Modal ── */}
      <Modal isOpen={isReloadModalOpen} onClose={() => setIsReloadModalOpen(false)} title="Recargar Créditos">
        {successMsg ? (
          <div className="text-center py-8 space-y-4">
            <CheckCircle2 className="mx-auto text-emerald-500" size={56} />
            <h3 className="text-lg font-bold text-white">{successMsg}</h3>
            <button onClick={() => setIsReloadModalOpen(false)} className="px-6 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors">Cerrar</button>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="bg-[#00d1ff]/10 border border-[#00d1ff]/20 rounded-xl p-4 text-sm text-[#00d1ff]">
              Realiza un Pago Móvil y reporta tu pago para recibir los créditos.
            </div>
            <div className="space-y-2">
              {[["Banco","Banesco (0134)"],["Teléfono","0414-1234567"],["Cédula","V-12345678"]].map(([k,v]) => (
                <div key={k} className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/5 text-sm">
                  <span className="text-white/50 font-light">{k}</span>
                  <span className="font-semibold">{v}</span>
                </div>
              ))}
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-medium text-white/40 mb-1 uppercase tracking-wider">Monto (BS)</label>
                <input type="number" value={amountBs} onChange={e => setAmountBs(e.target.value)} placeholder="Ej. 150.50"
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-[#ff007a] transition-colors" />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-white/40 mb-1 uppercase tracking-wider">Referencia (Últimos 6 dígitos)</label>
                <input type="text" maxLength={6} value={refNumber} onChange={e => setRefNumber(e.target.value.replace(/\D/g, ""))} placeholder="123456"
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-[#ff007a] transition-colors" />
              </div>
            </div>
            <button onClick={handleRechargeSubmit} disabled={isSubmitting || !user}
              className="w-full py-3.5 bg-[#ff007a] hover:bg-[#ff007a]/80 disabled:opacity-50 text-white rounded-xl font-bold transition-colors flex items-center justify-center gap-2">
              {isSubmitting && <Loader2 className="animate-spin" size={16}/>} Reportar Pago
            </button>
          </div>
        )}
      </Modal>

      {/* ── Withdraw Modal ── */}
      <Modal isOpen={isWithdrawModalOpen} onClose={() => setIsWithdrawModalOpen(false)} title="Retirar Ganancias">
        {successMsg ? (
          <div className="text-center py-8 space-y-4">
            <CheckCircle2 className="mx-auto text-emerald-500" size={56} />
            <h3 className="text-lg font-bold text-white">{successMsg}</h3>
            <button onClick={() => setIsWithdrawModalOpen(false)} className="px-6 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors">Cerrar</button>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-sm text-white/60">
              Los créditos se convertirán a BS según la tasa BCV y se enviarán a tus datos bancarios.
            </div>
            {!profile?.phone_number ? (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl text-sm">
                Configura tus datos bancarios en Perfil antes de retirar.
              </div>
            ) : (
              <div className="p-3 bg-black/30 rounded-xl border border-white/5 text-sm space-y-1">
                <span className="text-white/30 text-[10px] uppercase tracking-wider block mb-1">Destino</span>
                <p className="font-semibold">{profile.bank_name}</p>
                <p className="text-white/60">{profile.id_card} · {profile.phone_number}</p>
              </div>
            )}
            <div>
              <label className="block text-[11px] font-medium text-white/40 mb-1 uppercase tracking-wider">Créditos a Retirar</label>
              <input type="number" value={withdrawAmount} onChange={e => setWithdrawAmount(e.target.value)} placeholder="Ej. 5000"
                className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-white/30 transition-colors" />
              <p className="text-[11px] text-white/30 mt-1">Saldo: {balance.toLocaleString()} CR</p>
            </div>
            <button onClick={handleWithdrawSubmit} disabled={isSubmitting || !profile?.phone_number}
              className="w-full py-3.5 bg-white/10 hover:bg-white/20 disabled:opacity-50 text-white rounded-xl font-bold transition-colors flex items-center justify-center gap-2">
              {isSubmitting && <Loader2 className="animate-spin" size={16}/>} Solicitar Retiro
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}
