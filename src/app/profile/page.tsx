"use client";

import { useState, useEffect, useRef } from "react";
import { User, MapPin, Building2, Loader2, Save, CheckCircle2, Phone, FileText, Edit2, ArrowLeft, CreditCard, History, Sparkles, TrendingUp, Users, UserCheck, UserPlus, Camera, Trophy, X, Swords } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/utils/supabase/client";
import { fmtWCR, fmtBCR, fmtUSD, fmtBs } from "@/utils/format";
import { getUserBalance, getDualBalance, type DualBalance } from "../../utils/balance";
import Link from "next/link";

export default function ProfilePage() {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [view, setView] = useState<"office" | "edit">("office");
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [originalUsername, setOriginalUsername] = useState("");
  const [usernameStatus, setUsernameStatus] = useState<"idle" | "checking" | "available" | "taken">("idle");
  const [daysUntilChange, setDaysUntilChange] = useState<number | null>(null);
  const [bcvRate, setBcvRate] = useState<number>(0);
  const [balance, setBalance] = useState<number>(0);
  const [dualBal, setDualBal] = useState<DualBalance>({ wallet_credits: 0, battle_credits: 0, total: 0 });
  const [battleHistory, setBattleHistory] = useState<any[]>([]);
  const [rankPosition, setRankPosition] = useState<number | string>("—");

  // Social counters
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [battlesCount, setBattlesCount] = useState(0);

  // Modal state
  const [earningsModal, setEarningsModal] = useState(false);
  const [txModal, setTxModal] = useState(false);
  const [earningsData, setEarningsData] = useState<any[]>(() => {
    if (typeof window !== "undefined") {
      const cached = localStorage.getItem("vivo_earnings_data");
      if (cached) { try { return JSON.parse(cached); } catch(e) {} }
    }
    return [];
  });
  const [txData, setTxData] = useState<any[]>(() => {
    if (typeof window !== "undefined") {
      const cached = localStorage.getItem("vivo_tx_data");
      if (cached) { try { return JSON.parse(cached); } catch(e) {} }
    }
    return [];
  });
  const [modalLoading, setModalLoading] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      // Fetch profile
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      if (data) {
        setProfile(data);
        setOriginalUsername(data.username);
        
        // Calculate rank based on accumulated points
        const { count } = await supabase.from('profiles').select('id', { count: 'exact', head: true }).gt('total_earned', data.total_earned || 0);
        setRankPosition((count || 0) + 1);

        if (data.last_username_change) {
          const lastChange = new Date(data.last_username_change);
          const diffTime = Math.abs(new Date().getTime() - lastChange.getTime());
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          if (diffDays < 15) {
            setDaysUntilChange(15 - diffDays);
          }
        }
      }

      // Fetch BCV rate
      const { data: config } = await supabase.from("app_config").select("value").eq("key", "bcv_rate").single();
      if (config) setBcvRate(parseFloat(config.value));

      // Fetch dynamic balance using unified helper
      const dual = await getDualBalance(user.id);
      setDualBal(dual);
      setBalance(dual.total);

      // Fetch battle history (last 20 battles)
      const { data: battles } = await supabase
        .from("transactions")
        .select("amount_credits, created_at, reference_number, opponent_id")
        .eq("user_id", user.id)
        .in("type", ["BATTLE_WIN", "battle_win", "bonus", "BONUS"])
        .eq("status", "approved")
        .order("created_at", { ascending: false })
        .limit(20);
      if (battles) setBattleHistory(battles);

      // Fetch social counts
      const [followersRes, followingRes, battlesRes] = await Promise.all([
        supabase.from("follow").select("id", { count: "exact", head: true }).eq("following_id", user.id),
        supabase.from("follow").select("id", { count: "exact", head: true }).eq("follow_id", user.id),
        supabase.from("battles").select("id", { count: "exact", head: true }).or(`player_a_id.eq.${user.id},player_b_id.eq.${user.id}`),
      ]);

      setFollowersCount(followersRes.count || 0);
      setFollowingCount(followingRes.count || 0);
      setBattlesCount(battlesRes.count || 0);
    }
    setLoading(false);
  };

  // ── Open Earnings Modal ──
  const openEarningsModal = async () => {
    setEarningsModal(true);
    setModalLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setModalLoading(false); return; }
    const { data } = await supabase
      .from("transactions")
      .select("id, amount_credits, amount_bs, created_at, type, status, admin_reference")
      .eq("user_id", user.id)
      .in("type", ["GIFT", "BATTLE_REWARD", "BATTLE_WIN"])
      .eq("status", "approved")
      .order("created_at", { ascending: false })
      .limit(50);
    const finalData = data || [];
    setEarningsData(finalData);
    if (typeof window !== "undefined") {
      localStorage.setItem("vivo_earnings_data", JSON.stringify(finalData));
    }
    setModalLoading(false);
  };

  // ── Open Transactions Modal ──
  const openTxModal = async () => {
    setTxModal(true);
    setModalLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setModalLoading(false); return; }
    const { data } = await supabase
      .from("transactions")
      .select("id, amount_credits, amount_bs, created_at, type, status, reference_number, admin_reference")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);
    const finalData = data || [];
    setTxData(finalData);
    if (typeof window !== "undefined") {
      localStorage.setItem("vivo_tx_data", JSON.stringify(finalData));
    }
    setModalLoading(false);
  };

  useEffect(() => {
    if (!profile || profile.username === originalUsername) {
      setUsernameStatus("idle");
      return;
    }

    const checkUsername = async () => {
      setUsernameStatus("checking");
      const { data } = await supabase.from("profiles").select("id").eq("username", profile.username).single();
      if (data) {
        setUsernameStatus("taken");
      } else {
        setUsernameStatus("available");
      }
    };

    const debounce = setTimeout(checkUsername, 500);
    return () => clearTimeout(debounce);
  }, [profile?.username, originalUsername, supabase]);

  const handleSave = async () => {
    if (daysUntilChange !== null && profile.username !== originalUsername) {
      setSaveMessage("No puedes cambiar tu username aún.");
      return;
    }
    if (usernameStatus === "taken") {
      setSaveMessage("El username ya está en uso.");
      return;
    }

    setIsSaving(true);
    setSaveMessage("");
    const { data: { user } } = await supabase.auth.getUser();
    if (user && profile) {
      const updates: any = {};
      if (profile.full_name?.trim()) updates.full_name = profile.full_name.trim();
      if (profile.city?.trim()) updates.city = profile.city.trim();
      if (profile.bank_name?.trim()) updates.bank_name = profile.bank_name.trim();
      if (profile.id_card?.trim()) updates.id_card = profile.id_card.trim();
      if (profile.phone_number?.trim()) updates.phone_number = profile.phone_number.trim();
      if (profile.whatsapp_number?.trim()) updates.whatsapp_number = profile.whatsapp_number.trim();
      if (profile.email?.trim()) updates.email = profile.email.trim();

      if (profile.username !== originalUsername) {
        updates.username = profile.username;
        updates.last_username_change = new Date().toISOString();
      }

      const { error } = await supabase.from("profiles").update(updates).eq("id", user.id);

      if (error) {
        setSaveMessage("Error al guardar: " + error.message);
      } else {
        setSaveMessage("¡Perfil guardado con éxito!");
        if (profile.username !== originalUsername) {
          setOriginalUsername(profile.username);
          setDaysUntilChange(15);
          setUsernameStatus("idle");
        }
        setTimeout(() => setSaveMessage(""), 3000);
      }
    }
    setIsSaving(false);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    
    setIsUploadingAvatar(true);
    const fileExt = file.name.split('.').pop();
    const filePath = `${user.id}-${Math.random()}.${fileExt}`;
    
    const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, file);
    if (!uploadError) {
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(filePath);
      await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', user.id);
      setProfile((prev: any) => ({...prev, avatar_url: publicUrl}));
    } else {
      alert("Error subiendo foto: " + uploadError.message);
    }
    setIsUploadingAvatar(false);
  };

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (loading) {
      timer = setTimeout(() => setLoading(false), 3000);
    }
    return () => clearTimeout(timer);
  }, [loading]);

  if (loading) {
    return <div className="flex-1 flex items-center justify-center"><Loader2 className="animate-spin text-[#ff007a]" size={40} /></div>;
  }

  const balanceUsd = balance / 100;
  const balanceBs = bcvRate ? (balance / 100) * bcvRate : null;

  return (
    <>
    <div className="flex-1 max-w-2xl w-full mx-auto p-4 md:p-8 pb-24">
      <input 
        id="profile-avatar-upload"
        name="avatar"
        type="file" 
        accept="image/*" 
        className="hidden" 
        ref={fileInputRef} 
        onChange={handleAvatarUpload} 
      />

      {view === "office" ? (
        /* ══════════════════════════════════════
            VIEW: USER OFFICE
           ══════════════════════════════════════ */
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Hero Section */}
          <div className="relative overflow-hidden cyber-glass rounded-[2.5rem] p-8 border-white/10 text-center">
            {/* Background effect */}
            <div className="absolute -top-24 -right-24 w-64 h-64 bg-[#ff007a]/10 rounded-full blur-[80px]" />
            <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-[#00d1ff]/10 rounded-full blur-[80px]" />

            <div className="relative space-y-4">
              <div className="inline-block relative">
                <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-[#ff007a] to-[#00d1ff] p-1 shadow-[0_0_30px_rgba(255,0,122,0.3)]">
                  <div className="w-full h-full rounded-full bg-black flex items-center justify-center overflow-hidden relative">
                    {profile?.avatar_url ? (
                      <img src={profile.avatar_url} className={`w-full h-full object-cover ${isUploadingAvatar ? 'opacity-50' : ''}`} />
                    ) : (
                      <User size={48} className="text-white/20" />
                    )}
                    {isUploadingAvatar && <Loader2 className="absolute inset-0 m-auto animate-spin text-white" size={24} />}
                  </div>
                </div>
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute bottom-0 right-0 p-2 bg-white text-black rounded-full shadow-lg hover:scale-110 transition-transform"
                >
                  <Camera size={14} />
                </button>
              </div>

              <div>
                <h1 className="text-2xl font-black text-white">@{profile?.username || "usuario"}</h1>
                <p className="text-white/40 text-sm font-medium">{profile?.full_name || "VIVO User"}</p>
              </div>

              {/* ── Social Stats ── */}
              <div className="flex items-center justify-center gap-6 pt-3">
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="text-center"
                >
                  <p className="text-xl font-black text-white">{followersCount}</p>
                  <p className="text-[10px] text-white/30 uppercase tracking-widest font-medium">Seguidores</p>
                </motion.div>
                <div className="w-px h-10 bg-white/10" />
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="text-center"
                >
                  <p className="text-xl font-black text-white">{followingCount}</p>
                  <p className="text-[10px] text-white/30 uppercase tracking-widest font-medium">Siguiendo</p>
                </motion.div>
                <div className="w-px h-10 bg-white/10" />
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="text-center"
                >
                  <p className="text-xl font-black text-white">{battlesCount}</p>
                  <p className="text-[10px] text-white/30 uppercase tracking-widest font-medium">Batallas</p>
                </motion.div>
              </div>
            </div>
          </div>

          {/* ── Estadísticas Elite ── */}
          <div className="grid grid-cols-2 gap-4">
            <Link href="/ranking" className="cyber-glass rounded-[2rem] p-5 flex flex-col items-center justify-center border-white/5 relative overflow-hidden group hover:border-[#ffd700]/30 transition-colors">
              <div className="absolute inset-0 bg-gradient-to-tr from-[#ffd700]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <Trophy size={28} className="text-[#ffd700] mb-2" />
              <p className="text-[10px] text-white/40 uppercase tracking-widest mb-1">Ranking Mundial</p>
              <p className="text-2xl font-black text-white">#{rankPosition}</p>
            </Link>
            
            <div className="cyber-glass rounded-[2rem] p-5 flex flex-col items-center justify-center border-white/5 relative">
              <Sparkles size={28} className="text-[#00d1ff] mb-2" />
              <p className="text-[10px] text-white/40 uppercase tracking-widest mb-1">G / P / E</p>
              <div className="flex gap-2 text-lg font-black">
                <span className="text-[#00d1ff]">{profile?.wins || 0}</span>
                <span className="text-white/30">/</span>
                <span className="text-[#ff007a]">{profile?.losses || 0}</span>
                <span className="text-white/30">/</span>
                <span className="text-white/60">{profile?.draws || 0}</span>
              </div>
            </div>

            <div className="col-span-2 cyber-glass rounded-[2rem] p-5 flex items-center justify-between border-white/5">
              <div>
                <p className="text-[10px] text-white/40 uppercase tracking-widest mb-1">Total Ganado Histórico</p>
                <p className="text-2xl font-black text-[#ffd700]">{fmtBCR(profile?.total_earned || 0)}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-[#ffd700]/10 flex items-center justify-center border border-[#ffd700]/20">
                <Trophy size={20} className="text-[#ffd700]" />
              </div>
            </div>
          </div>

          {/* Quick Balance Card — Dual */}
          <div className="cyber-glass rounded-3xl p-6 border-white/5 space-y-4 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <CreditCard size={80} />
            </div>
            
            <div>
              <p className="text-xs font-bold text-white/40 uppercase tracking-widest mb-3">Balance Total</p>
              <div className="flex items-baseline gap-2 mb-4">
                <span className="text-3xl font-black text-white">{fmtWCR(balance)}</span>
              </div>
              {/* WCR / BCR split */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[#ff007a]/5 rounded-xl p-3 border border-[#ff007a]/10">
                  <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1">WCR (Billetera)</p>
                  <p className="text-lg font-black text-[#ff007a]">{fmtWCR(dualBal.wallet_credits)}</p>
                  <p className="text-[10px] text-white/25 mt-0.5">Depósitos · Gifts</p>
                </div>
                <div className="bg-[#00d1ff]/5 rounded-xl p-3 border border-[#00d1ff]/10">
                  <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1">BCR (Batallas)</p>
                  <p className="text-lg font-black text-[#00d1ff]">{fmtBCR(dualBal.battle_credits)}</p>
                  <p className="text-[10px] text-white/25 mt-0.5">Ganancias · Retirable</p>
                </div>
              </div>
            </div>

            <div className="flex gap-4 pt-2">
              <div className="flex items-center gap-1.5 bg-white/5 rounded-xl px-3 py-1.5 border border-white/5">
                <TrendingUp size={12} className="text-emerald-400" />
                <span className="text-sm font-bold text-emerald-400">{fmtUSD(balanceUsd)}</span>
              </div>
              {balanceBs !== null && (
                <div className="flex items-center gap-1.5 bg-white/5 rounded-xl px-3 py-1.5 border border-white/5">
                  <span className="text-sm font-bold text-[#ffd700]">{fmtBs(balanceBs)}</span>
                </div>
              )}
            </div>
          </div>

          {/* ── Historial de Batallas ── */}
          {battleHistory.length > 0 && (
            <div className="cyber-glass rounded-3xl p-5 border-white/5 space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <Swords size={16} className="text-[#ff007a]" />
                <p className="text-xs font-bold text-white/50 uppercase tracking-widest">Historial de Batallas</p>
              </div>
              <div className="space-y-2 max-h-[240px] overflow-y-auto pr-1">
                {battleHistory.map((b, i) => (
                  <div key={i} className="flex items-center justify-between bg-black/20 rounded-xl px-3 py-2.5 border border-white/5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                        <Trophy size={12} className="text-emerald-400" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-white/80">{b.reference_number || 'Victoria'}</p>
                        <p className="text-[10px] text-white/25">
                          {new Date(b.created_at).toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: '2-digit' })}{' '}
                          {new Date(b.created_at).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                    <span className="text-sm font-black text-emerald-400">+{fmtWCR(b.amount_credits)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Main Actions */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button 
              onClick={openEarningsModal}
              className="flex items-center justify-between p-5 cyber-glass rounded-2xl border-white/5 hover:bg-white/5 transition-all group w-full text-left"
            >
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-[#ff007a]/10 text-[#ff007a]">
                  <Sparkles size={20} />
                </div>
                <div>
                  <p className="font-bold text-white text-sm">Mis Ganancias</p>
                  <p className="text-[10px] text-white/30 uppercase tracking-tighter">Historial de Gifts</p>
                </div>
              </div>
              <div className="opacity-0 group-hover:opacity-100 transition-opacity translate-x-2 group-hover:translate-x-0">
                <ArrowLeft size={16} className="rotate-180" />
              </div>
            </button>

            <button 
              onClick={openTxModal}
              className="flex items-center justify-between p-5 cyber-glass rounded-2xl border-white/5 hover:bg-white/5 transition-all group w-full text-left"
            >
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-[#00d1ff]/10 text-[#00d1ff]">
                  <History size={20} />
                </div>
                <div>
                  <p className="font-bold text-white text-sm">Transacciones</p>
                  <p className="text-[10px] text-white/30 uppercase tracking-tighter">Recargas y Retiros</p>
                </div>
              </div>
              <div className="opacity-0 group-hover:opacity-100 transition-opacity translate-x-2 group-hover:translate-x-0">
                <ArrowLeft size={16} className="rotate-180" />
              </div>
            </button>
          </div>

          <button 
            onClick={() => setView("edit")}
            className="w-full py-4 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white rounded-2xl text-sm font-bold border border-white/5 transition-all flex items-center justify-center gap-2"
          >
            <Edit2 size={16} /> Configuración de Perfil
          </button>
        </div>
      ) : (
        /* ══════════════════════════════════════
            VIEW: EDIT PROFILE
           ══════════════════════════════════════ */
        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
          <button 
            onClick={() => setView("office")}
            className="flex items-center gap-2 text-white/40 hover:text-white transition-colors text-sm font-bold uppercase tracking-widest mb-4"
          >
            <ArrowLeft size={16} /> Volver a Mi Oficina
          </button>

          {/* ══════════════════════════════════════
              BLOQUE 1: DATOS PERSONALES
          ══════════════════════════════════════ */}
          <div className="cyber-glass rounded-3xl p-6 border-white/5">
            <div className="flex items-center gap-2 mb-5">
              <div className="p-2 rounded-xl bg-[#00d1ff]/10"><User size={18} className="text-[#00d1ff]" /></div>
              <div>
                <h2 className="text-lg font-black text-white">Datos Personales</h2>
                <p className="text-[10px] text-white/30 uppercase tracking-wider">Información de contacto y perfil público</p>
              </div>
            </div>
            
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Username</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <span className="text-white/40 font-bold">@</span>
                  </div>
                  <input
                    id="profile-username"
                    name="username"
                    type="text"
                    value={profile?.username || ""}
                    onChange={(e) => setProfile({ ...profile, username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "") })}
                    className="w-full bg-black/40 border border-white/10 rounded-xl py-3 pl-8 pr-12 text-white placeholder-white/20 focus:outline-none focus:border-[#00d1ff] transition-colors"
                    autoComplete="username"
                  />
                  <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                    {usernameStatus === "checking" && <Loader2 size={16} className="animate-spin text-white/40" />}
                    {usernameStatus === "available" && <CheckCircle2 size={16} className="text-emerald-400" />}
                    {usernameStatus === "taken" && <X size={16} className="text-red-400" />}
                  </div>
                </div>
                {daysUntilChange !== null && profile?.username !== originalUsername && (
                  <p className="text-[10px] text-red-400 font-bold mt-1">
                    Debes esperar {daysUntilChange} días para cambiar tu username.
                  </p>
                )}
                {usernameStatus === "taken" && (
                  <p className="text-[10px] text-red-400 font-bold mt-1">
                    Este username no está disponible.
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Nombre Completo</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <User size={16} className="text-white/40" />
                  </div>
                  <input
                    id="profile-fullname"
                    name="full_name"
                    type="text"
                    value={profile?.full_name || ""}
                    onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                    className="w-full bg-black/40 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white placeholder-white/20 focus:outline-none focus:border-[#00d1ff] transition-colors"
                    placeholder="Tu nombre real"
                    autoComplete="name"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Ciudad</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <MapPin size={16} className="text-white/40" />
                  </div>
                  <input
                    id="profile-city"
                    name="city"
                    type="text"
                    value={profile?.city || ""}
                    onChange={(e) => setProfile({ ...profile, city: e.target.value })}
                    className="w-full bg-black/40 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white placeholder-white/20 focus:outline-none focus:border-[#00d1ff] transition-colors"
                    placeholder="Caracas, Valencia, etc."
                  />
                </div>
              </div>
            </div>
          </div>

          {/* ══════════════════════════════════════
              BLOQUE 1.5: DATOS DE CONTACTO
          ══════════════════════════════════════ */}
          <div className="cyber-glass rounded-3xl p-6 border-white/5 mt-6">
            <div className="flex items-center gap-2 mb-5">
              <div className="p-2 rounded-xl bg-[#25D366]/10"><Phone size={18} className="text-[#25D366]" /></div>
              <div>
                <h2 className="text-lg font-black text-white">Datos de Contacto</h2>
                <p className="text-[10px] text-white/30 uppercase tracking-wider">Para confirmaciones de pagos</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest">WhatsApp</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Phone size={16} className="text-[#25D366]" />
                  </div>
                  <input
                    id="profile-whatsapp"
                    name="whatsapp_number"
                    type="text"
                    value={profile?.whatsapp_number || ""}
                    onChange={(e) => setProfile({ ...profile, whatsapp_number: e.target.value })}
                    className="w-full bg-black/40 border border-[#25D366]/20 rounded-xl py-3 pl-12 pr-4 text-white placeholder-white/20 focus:outline-none focus:border-[#25D366] transition-colors"
                    placeholder="0414-1234567"
                    autoComplete="tel"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Correo Electrónico</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <FileText size={16} className="text-white/40" />
                  </div>
                  <input
                    id="profile-email"
                    name="email"
                    type="email"
                    value={profile?.email || ""}
                    onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                    className="w-full bg-black/40 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white placeholder-white/20 focus:outline-none focus:border-[#00d1ff] transition-colors"
                    placeholder="tucorreo@ejemplo.com"
                    autoComplete="email"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* ══════════════════════════════════════
              BLOQUE 2: DATOS BANCARIOS / PAGO MÓVIL
          ══════════════════════════════════════ */}
          <div className="cyber-glass rounded-3xl p-6 border border-[#ffd700]/10">
            <div className="flex items-center gap-2 mb-5">
              <div className="p-2 rounded-xl bg-[#ffd700]/10"><Building2 size={18} className="text-[#ffd700]" /></div>
              <div>
                <h2 className="text-lg font-black text-white">Datos Bancarios / Pago Móvil</h2>
                <p className="text-[10px] text-white/30 uppercase tracking-wider">Para recibir pagos y retiros</p>
              </div>
            </div>
            
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-[#ffd700]/60 uppercase tracking-widest">Banco Destino</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Building2 size={16} className="text-[#ffd700]/40" />
                  </div>
                  <input
                    id="profile-bank"
                    name="bank_name"
                    type="text"
                    value={profile?.bank_name || ""}
                    onChange={(e) => setProfile({ ...profile, bank_name: e.target.value })}
                    className="w-full bg-black/40 border border-[#ffd700]/15 rounded-xl py-3 pl-12 pr-4 text-white placeholder-white/20 focus:outline-none focus:border-[#ffd700]/50 transition-colors"
                    placeholder="Banesco, Mercantil, etc."
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-[#ffd700]/60 uppercase tracking-widest">Cédula</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <FileText size={16} className="text-[#ffd700]/40" />
                  </div>
                  <input
                    id="profile-id-card"
                    name="id_card"
                    type="text"
                    value={profile?.id_card || ""}
                    onChange={(e) => setProfile({ ...profile, id_card: e.target.value })}
                    className="w-full bg-black/40 border border-[#ffd700]/15 rounded-xl py-3 pl-12 pr-4 text-white placeholder-white/20 focus:outline-none focus:border-[#ffd700]/50 transition-colors"
                    placeholder="V-12345678"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-[#ffd700]/60 uppercase tracking-widest">Teléfono Pago Móvil</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Phone size={16} className="text-[#ffd700]/40" />
                  </div>
                  <input
                    id="profile-phone"
                    name="phone_number"
                    type="text"
                    value={profile?.phone_number || ""}
                    onChange={(e) => setProfile({ ...profile, phone_number: e.target.value })}
                    className="w-full bg-black/40 border border-[#ffd700]/15 rounded-xl py-3 pl-12 pr-4 text-white placeholder-white/20 focus:outline-none focus:border-[#ffd700]/50 transition-colors"
                    placeholder="0414-1234567"
                    autoComplete="tel"
                  />
                </div>
              </div>

              <div className="bg-[#ffd700]/5 border border-[#ffd700]/10 rounded-xl p-3 text-[11px] text-[#ffd700]/60 leading-relaxed">
                💡 Estos datos serán usados por el Admin para procesar tus retiros y enviar comprobantes de pago.
              </div>
            </div>
          </div>

          {/* ── Save Button + Message ── */}
          {saveMessage && (
            <p className={`text-xs font-bold text-center ${saveMessage.includes("Error") || saveMessage.includes("uso") ? "text-red-400" : "text-emerald-400"}`}>
              {saveMessage}
            </p>
          )}

          <button
            onClick={handleSave}
            disabled={isSaving || usernameStatus === "taken" || usernameStatus === "checking"}
            className="w-full py-4 bg-gradient-to-r from-[#00d1ff] to-[#ff007a] text-white rounded-xl font-black uppercase tracking-[0.2em] shadow-[0_0_20px_rgba(0,209,255,0.3)] hover:shadow-[0_0_30px_rgba(255,0,122,0.5)] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="animate-spin" size={20} /> : <><Save size={20} /> Guardar Cambios</>}
          </button>
        </div>
      )}
    </div>

      {/* ═══════════════════════════════════════
          MODAL: MIS GANANCIAS
         ═══════════════════════════════════════ */}
      <AnimatePresence>
        {earningsModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={() => setEarningsModal(false)}
          >
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="w-full max-w-lg max-h-[80vh] bg-[#0d0d0d] border border-white/10 rounded-3xl overflow-hidden shadow-[0_0_60px_rgba(255,0,122,0.15)]"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-[#ff007a]/10"><Sparkles size={18} className="text-[#ff007a]" /></div>
                  <div>
                    <h2 className="text-base font-black text-white">Mis Ganancias</h2>
                    <p className="text-[10px] text-white/30 uppercase tracking-wider">BCR: {fmtBCR(dualBal.battle_credits)}</p>
                  </div>
                </div>
                <button onClick={() => setEarningsModal(false)} className="p-2 rounded-xl hover:bg-white/5 transition-colors"><X size={18} className="text-white/40" /></button>
              </div>

              {/* Content */}
              <div className="overflow-y-auto max-h-[65vh] p-4 space-y-2">
                {modalLoading ? (
                  <div className="flex items-center justify-center py-12"><Loader2 className="animate-spin text-[#ff007a]" size={28} /></div>
                ) : earningsData.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Trophy size={32} className="text-white/10 mb-3" />
                    <p className="text-white/25 text-sm">Aún no tienes ganancias registradas.</p>
                  </div>
                ) : earningsData.map((txn: any) => (
                  <div key={txn.id} className="flex items-center justify-between bg-black/30 rounded-xl px-4 py-3 border border-white/5">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center border ${
                        txn.type.includes("BATTLE") || txn.type.includes("battle") ? "bg-[#ffd700]/10 border-[#ffd700]/20" : "bg-[#e056fd]/10 border-[#e056fd]/20"
                      }`}>
                        {txn.type.includes("BATTLE") || txn.type.includes("battle") ? <Trophy size={14} className="text-[#ffd700]" /> : <Sparkles size={14} className="text-[#e056fd]" />}
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-white/80">
                          {txn.type.includes("BATTLE") || txn.type.includes("battle") ? "Victoria" : "Gift recibido"}
                        </p>
                        <p className="text-[10px] text-white/25">
                          {new Date(txn.created_at).toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: '2-digit' })}
                          {' '}
                          {new Date(txn.created_at).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`text-sm font-black ${txn.type.includes("BATTLE") || txn.type.includes("battle") ? "text-[#ffd700]" : "text-[#e056fd]"}`}>
                        +{fmtWCR(txn.amount_credits || 0)}
                      </span>
                      {txn.amount_bs && parseFloat(txn.amount_bs) > 0 && (
                        <p className="text-[10px] text-white/25">{fmtBs(parseFloat(txn.amount_bs))}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══════════════════════════════════════
          MODAL: TRANSACCIONES
         ═══════════════════════════════════════ */}
      <AnimatePresence>
        {txModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={() => setTxModal(false)}
          >
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="w-full max-w-lg max-h-[80vh] bg-[#0d0d0d] border border-white/10 rounded-3xl overflow-hidden shadow-[0_0_60px_rgba(0,209,255,0.15)]"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-[#00d1ff]/10"><History size={18} className="text-[#00d1ff]" /></div>
                  <div>
                    <h2 className="text-base font-black text-white">Transacciones</h2>
                    <p className="text-[10px] text-white/30 uppercase tracking-wider">Recargas, Retiros y Movimientos</p>
                  </div>
                </div>
                <button onClick={() => setTxModal(false)} className="p-2 rounded-xl hover:bg-white/5 transition-colors"><X size={18} className="text-white/40" /></button>
              </div>

              {/* Content */}
              <div className="overflow-y-auto max-h-[65vh] p-4 space-y-2">
                {modalLoading ? (
                  <div className="flex items-center justify-center py-12"><Loader2 className="animate-spin text-[#00d1ff]" size={28} /></div>
                ) : txData.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <History size={32} className="text-white/10 mb-3" />
                    <p className="text-white/25 text-sm">Sin transacciones aún.</p>
                  </div>
                ) : txData.map((txn: any) => {
                  const isDeposit = txn.type === "DEPOSIT" || txn.type === "deposit" || txn.type === "DEPOSIT_PENDING";
                  const isWithdraw = txn.type === "WITHDRAW" || txn.type === "withdrawal" || txn.type === "WITHDRAW_BCR";
                  const isGift = txn.type === "gift" || txn.type === "GIFT_SENT" || txn.type === "GIFT";
                  const isBattle = txn.type === "BATTLE_WIN" || txn.type === "battle_win";
                  const color = isDeposit ? "text-[#00d1ff]" : isWithdraw ? "text-white/60" : isGift ? "text-[#e056fd]" : isBattle ? "text-[#ffd700]" : "text-white/50";
                  const label = isDeposit ? "Recarga" : isWithdraw ? (txn.type === "WITHDRAW_BCR" ? "Cobro BCR" : "Retiro WCR") : isGift ? "Gift" : isBattle ? "Victoria" : txn.type;
                  const sign = isWithdraw || txn.type === "GIFT_SENT" ? "-" : "+";

                  return (
                    <div key={txn.id} className="flex items-center justify-between bg-black/30 rounded-xl px-4 py-3 border border-white/5">
                      <div>
                        <p className={`text-xs font-bold uppercase tracking-wider ${color}`}>{label}</p>
                        <p className="text-[10px] text-white/25 mt-0.5">
                          {new Date(txn.created_at).toLocaleDateString('es-VE', { day: '2-digit', month: 'short' })}
                          {' '}
                          {new Date(txn.created_at).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })}
                          {txn.status === "pending" && <span className="ml-1.5 text-yellow-400">(Pendiente)</span>}
                          {txn.status === "rejected" && <span className="ml-1.5 text-red-400">(Rechazado)</span>}
                        </p>
                        {txn.admin_reference && txn.status === "approved" && (
                          <p className="text-[10px] text-emerald-400/70 mt-0.5">Ref Admin: {txn.admin_reference}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <span className={`text-sm font-black ${color}`}>
                          {sign}{fmtWCR(txn.amount_credits || 0)}
                        </span>
                        {txn.amount_bs && parseFloat(txn.amount_bs) > 0 && (
                          <p className="text-[10px] text-white/25">{fmtBs(parseFloat(txn.amount_bs))}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
