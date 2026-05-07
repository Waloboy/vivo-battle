"use client";

import { useState, useEffect } from "react";
import { Wallet, Plus, ArrowUpRight, History, CreditCard, Landmark, Phone, Loader2, CheckCircle2, Sparkles } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { createClient } from "@/utils/supabase/client";

export default function Dashboard() {
  const [isReloadModalOpen, setIsReloadModalOpen] = useState(false);
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  const [balance, setBalance] = useState<number>(0);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);

  // Recharge State
  const [amountBs, setAmountBs] = useState("");
  const [refNumber, setRefNumber] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  // Withdraw State
  const [withdrawAmount, setWithdrawAmount] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUser(user);

    // Fetch profile for bank details
    const { data: profileData } = await supabase.from("profiles").select("*").eq("id", user.id).single();
    if (profileData) setProfile(profileData);

    // Fetch Wallet
    const { data: walletData } = await supabase.from("wallets").select("balance").eq("user_id", user.id).single();
    if (walletData) setBalance(walletData.balance);

    // Fetch Transactions
    const { data: txData } = await supabase
      .from("transactions")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10);
    if (txData) setTransactions(txData);

    setLoading(false);
  };

  const handleRechargeSubmit = async () => {
    if (!amountBs || !refNumber || refNumber.length !== 6) {
      alert("Por favor ingresa un monto válido y los últimos 6 dígitos de la referencia.");
      return;
    }

    // Siempre obtener el user.id fresco de la sesión activa
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (!currentUser) {
      alert("Sesión expirada. Por favor inicia sesión nuevamente.");
      setIsSubmitting(false);
      return;
    }

    setIsSubmitting(true);

    // Tasa: 100 BS = 1000 Créditos
    const amountCredits = Math.floor(parseFloat(amountBs) * 10);

    const { error } = await supabase.from("transactions").insert({
      user_id: currentUser.id,
      type: "deposit",
      amount_bs: parseFloat(amountBs),
      amount_credits: amountCredits,
      reference_number: refNumber,
      status: "pending"
    });

    setIsSubmitting(false);

    if (error) {
      alert("Error al reportar pago: " + error.message);
    } else {
      setSuccessMsg("Pago reportado. El admin verificará tus créditos pronto.");
      setAmountBs("");
      setRefNumber("");
      fetchData();
    }
  };

  const handleWithdrawSubmit = async () => {
    if (!withdrawAmount) return;
    const amountCredits = parseInt(withdrawAmount);

    if (amountCredits > balance) {
      alert("No tienes suficientes créditos.");
      return;
    }

    if (!profile?.phone_number) {
      alert("Por favor configura tus datos bancarios en el Perfil antes de retirar.");
      return;
    }

    // Siempre obtener el user.id fresco de la sesión activa
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (!currentUser) {
      alert("Sesión expirada. Por favor inicia sesión nuevamente.");
      return;
    }

    setIsSubmitting(true);
    const bsAmount = amountCredits / 10;

    const { error } = await supabase.from("transactions").insert({
      user_id: currentUser.id,
      type: "withdrawal",
      amount_credits: amountCredits,
      amount_bs: bsAmount,
      status: "pending"
    });

    setIsSubmitting(false);

    if (error) {
      alert("Error al solicitar retiro: " + error.message);
    } else {
      setSuccessMsg("¡Retiro solicitado! En breve el admin procesará tu pago.");
      setWithdrawAmount("");
      fetchData();
    }
  };

  if (loading) {
    return <div className="flex-1 flex items-center justify-center"><Loader2 className="animate-spin text-[#ff007a]" size={40} /></div>;
  }

  return (
    <div className="flex-1 max-w-4xl w-full mx-auto p-4 md:p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-black mb-2">Mi Billetera</h1>
        <p className="text-white/50">Gestiona tus créditos para apoyar en las batallas o retira tus ganancias.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 cyber-glass p-8 rounded-3xl relative overflow-hidden group border-white/10">
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
                <span className="text-6xl font-black">{balance.toLocaleString()}</span>
                <span className="text-xl text-white/50 font-medium">Créditos</span>
              </div>
              <p className="text-white/40 mt-2">≈ ${(balance / 100).toFixed(2)} USD</p>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <button 
            onClick={() => {
              setSuccessMsg("");
              setIsReloadModalOpen(true);
            }}
            className="flex-1 cyber-glass rounded-3xl p-6 flex flex-col items-center justify-center gap-4 group hover:bg-[#ff007a]/10 hover:border-[#ff007a]/50 transition-all duration-300 border-white/10"
          >
            <div className="h-16 w-16 rounded-full bg-[#ff007a]/20 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Plus className="text-[#ff007a]" size={32} />
            </div>
            <span className="font-bold text-[#ff007a] text-lg">Recargar</span>
          </button>
          
          <button 
            onClick={() => {
              setSuccessMsg("");
              setIsWithdrawModalOpen(true);
            }}
            className="flex-1 cyber-glass rounded-3xl p-6 flex flex-col items-center justify-center gap-4 group hover:bg-white/5 transition-all border-white/10"
          >
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
          <h2 className="text-xl font-bold">Últimas Transacciones</h2>
        </div>
        
        <div className="cyber-glass rounded-2xl overflow-hidden border-white/10">
          {transactions.length === 0 ? (
            <div className="p-8 text-center text-white/40">No hay movimientos aún.</div>
          ) : (
            transactions.map((txn, i) => (
              <div key={txn.id} className="flex items-center justify-between p-4 border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors">
                <div className="flex items-center gap-4">
                  <div className={`p-2 rounded-lg ${
                    txn.type === 'gift' ? 'bg-[#e056fd]/10 text-[#e056fd]' :
                    txn.type === 'withdrawal' ? 'bg-white/10 text-white' :
                    'bg-[#00d1ff]/10 text-[#00d1ff]'
                  }`}>
                    {txn.type === 'gift' ? <Sparkles size={20} /> : txn.type === 'withdrawal' ? <ArrowUpRight size={20} /> : <Plus size={20} />}
                  </div>
                  <div>
                    <p className="font-medium">
                      {txn.type === 'gift' ? (txn.reference_number || 'Gift') :
                       txn.type === 'withdrawal' ? 'Retiro de Ganancias' :
                       'Recarga vía Pago Móvil'}
                    </p>
                    <p className="text-xs text-white/40">
                      {new Date(txn.created_at).toLocaleDateString()} • {txn.status === 'pending' ? 'Pendiente' : txn.status === 'approved' ? 'Aprobado' : 'Rechazado'}
                    </p>
                  </div>
                </div>
                <div className={`font-bold ${
                  txn.type === 'gift' ? 'text-[#e056fd]' :
                  txn.type === 'withdrawal' ? 'text-white' :
                  'text-[#00d1ff]'
                }`}>
                  {txn.type === 'withdrawal' || txn.type === 'gift' ? '-' : '+'}{txn.amount_credits} <span className="text-xs font-normal opacity-50">CR</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* RECHARGE MODAL */}
      <Modal isOpen={isReloadModalOpen} onClose={() => setIsReloadModalOpen(false)} title="Recargar Créditos">
        {successMsg ? (
          <div className="text-center py-8 space-y-4">
            <CheckCircle2 className="mx-auto text-emerald-500" size={64} />
            <h3 className="text-xl font-bold text-white">{successMsg}</h3>
            <button onClick={() => setIsReloadModalOpen(false)} className="px-6 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors mt-4">
              Cerrar
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-[#00d1ff]/10 border border-[#00d1ff]/20 rounded-xl p-4 text-sm text-[#00d1ff]">
              Realiza un Pago Móvil a los siguientes datos y luego reporta tu pago para recibir los créditos.
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10 text-sm">
                <span className="text-white/70">Banco</span>
                <span className="font-medium">Banesco (0134)</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10 text-sm">
                <span className="text-white/70">Teléfono</span>
                <span className="font-medium">0414-1234567</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10 text-sm">
                <span className="text-white/70">Cédula</span>
                <span className="font-medium">V-12345678</span>
              </div>
            </div>

            <div className="space-y-4 mt-6">
              <div>
                <label className="block text-xs font-medium text-white/50 mb-1 uppercase tracking-wider">Monto Transferido (BS)</label>
                <input
                  type="number"
                  value={amountBs}
                  onChange={(e) => setAmountBs(e.target.value)}
                  placeholder="Ej. 150.50"
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-[#ff007a] transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-white/50 mb-1 uppercase tracking-wider">Número de Referencia (Últimos 6)</label>
                <input
                  type="text"
                  maxLength={6}
                  value={refNumber}
                  onChange={(e) => setRefNumber(e.target.value.replace(/\D/g, ''))}
                  placeholder="Ej. 123456"
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-[#ff007a] transition-colors"
                />
              </div>
            </div>

            <button 
              onClick={handleRechargeSubmit}
              disabled={isSubmitting || !user}
              className="w-full py-4 bg-[#ff007a] hover:bg-[#ff007a]/80 disabled:opacity-50 text-white rounded-xl font-bold transition-colors glow-primary mt-4 flex items-center justify-center gap-2"
            >
              {isSubmitting && <Loader2 className="animate-spin" size={18} />}
              Reportar Pago
            </button>
          </div>
        )}
      </Modal>

      {/* WITHDRAW MODAL */}
      <Modal isOpen={isWithdrawModalOpen} onClose={() => setIsWithdrawModalOpen(false)} title="Retirar Ganancias">
        {successMsg ? (
          <div className="text-center py-8 space-y-4">
            <CheckCircle2 className="mx-auto text-emerald-500" size={64} />
            <h3 className="text-xl font-bold text-white">{successMsg}</h3>
            <button onClick={() => setIsWithdrawModalOpen(false)} className="px-6 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors mt-4">
              Cerrar
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-sm text-white/70">
              Ingresa la cantidad de créditos que deseas retirar. Lo enviaremos a tus datos bancarios registrados en el perfil.
            </div>

            {!profile?.phone_number ? (
               <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl text-sm">
                 Debes configurar tus datos bancarios en la sección Perfil antes de poder retirar.
               </div>
            ) : (
              <div className="space-y-3">
                <div className="flex flex-col p-3 bg-black/30 rounded-lg border border-white/5 text-sm">
                  <span className="text-white/50 text-xs uppercase mb-1">Tus datos receptores</span>
                  <span className="font-medium">{profile.bank_name}</span>
                  <span className="font-medium">{profile.id_card} - {profile.phone_number}</span>
                  <span className="font-medium text-white/70">{profile.full_name}</span>
                </div>
              </div>
            )}

            <div className="mt-6">
              <label className="block text-xs font-medium text-white/50 mb-1 uppercase tracking-wider">Cantidad a Retirar (Créditos)</label>
              <input
                type="number"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                placeholder="Ej. 5000"
                className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-white/30 transition-colors"
              />
              <p className="text-xs text-white/40 mt-2">Saldo actual: {balance} CR</p>
            </div>

            <button 
              onClick={handleWithdrawSubmit}
              disabled={isSubmitting || !profile?.phone_number}
              className="w-full py-4 bg-white/10 hover:bg-white/20 disabled:opacity-50 text-white rounded-xl font-bold transition-colors mt-4 flex items-center justify-center gap-2"
            >
              {isSubmitting && <Loader2 className="animate-spin" size={18} />}
              Solicitar Retiro
            </button>
          </div>
        )}
      </Modal>

    </div>
  );
}
