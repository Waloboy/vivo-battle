"use client";

import { useState, useEffect } from "react";
import { User, MapPin, Building2, CreditCard, Hash, Loader2, Save, CheckCircle2 } from "lucide-react";
import { createClient } from "@/utils/supabase/client";

export default function ProfilePage() {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const supabase = createClient();

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      if (data) setProfile(data);
    }
    setLoading(false);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveMessage("");
    const { data: { user } } = await supabase.auth.getUser();
    if (user && profile) {
      const { error } = await supabase.from("profiles").update({
        full_name: profile.full_name,
        city: profile.city,
        bank_name: profile.bank_name,
        bank_account_type: profile.bank_account_type,
        bank_account_number: profile.bank_account_number
      }).eq("id", user.id);

      if (error) {
        setSaveMessage("Error al guardar: " + error.message);
      } else {
        setSaveMessage("¡Perfil guardado con éxito!");
        setTimeout(() => setSaveMessage(""), 3000);
      }
    }
    setIsSaving(false);
  };

  if (loading) {
    return <div className="flex-1 flex items-center justify-center"><Loader2 className="animate-spin text-[#ff007a]" size={40} /></div>;
  }

  return (
    <div className="flex-1 max-w-3xl w-full mx-auto p-4 md:p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-black mb-2 text-[#ff007a]">Tu Perfil</h1>
        <p className="text-white/50">Configura tus datos personales y cuenta bancaria para recibir retiros.</p>
      </div>

      <div className="space-y-6">
        {/* Información Personal */}
        <div className="cyber-glass p-6 rounded-3xl border-white/10 space-y-4">
          <h2 className="text-xl font-bold flex items-center gap-2 mb-4">
            <User className="text-[#ff007a]" />
            Información Personal
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-white/50 mb-1 uppercase tracking-wider">Nombre Completo</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" size={18} />
                <input
                  type="text"
                  value={profile?.full_name || ""}
                  onChange={(e) => setProfile({...profile, full_name: e.target.value})}
                  placeholder="Ej. Juan Pérez"
                  className="w-full bg-black/50 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-[#ff007a] transition-colors"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-xs font-medium text-white/50 mb-1 uppercase tracking-wider">Ciudad</label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" size={18} />
                <input
                  type="text"
                  value={profile?.city || ""}
                  onChange={(e) => setProfile({...profile, city: e.target.value})}
                  placeholder="Ej. Caracas"
                  className="w-full bg-black/50 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-[#ff007a] transition-colors"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Datos Bancarios */}
        <div className="cyber-glass p-6 rounded-3xl border-white/10 space-y-4">
          <h2 className="text-xl font-bold flex items-center gap-2 mb-4">
            <Building2 className="text-[#00d1ff]" />
            Datos Bancarios
          </h2>
          <p className="text-sm text-white/50 mb-4">Aquí es donde enviaremos el dinero de tus retiros.</p>
          
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-white/50 mb-1 uppercase tracking-wider">Banco</label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" size={18} />
                <input
                  type="text"
                  value={profile?.bank_name || ""}
                  onChange={(e) => setProfile({...profile, bank_name: e.target.value})}
                  placeholder="Ej. Mercantil"
                  className="w-full bg-black/50 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-[#00d1ff] transition-colors"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-white/50 mb-1 uppercase tracking-wider">Tipo de Cuenta</label>
                <div className="relative">
                  <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" size={18} />
                  <select
                    value={profile?.bank_account_type || ""}
                    onChange={(e) => setProfile({...profile, bank_account_type: e.target.value})}
                    className="w-full bg-black/50 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white focus:outline-none focus:border-[#00d1ff] transition-colors appearance-none"
                  >
                    <option value="" disabled>Selecciona tipo</option>
                    <option value="Corriente">Corriente</option>
                    <option value="Ahorro">Ahorro</option>
                  </select>
                </div>
              </div>
              
              <div>
                <label className="block text-xs font-medium text-white/50 mb-1 uppercase tracking-wider">Número de Cuenta</label>
                <div className="relative">
                  <Hash className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" size={18} />
                  <input
                    type="text"
                    value={profile?.bank_account_number || ""}
                    onChange={(e) => setProfile({...profile, bank_account_number: e.target.value.replace(/\D/g, '')})}
                    placeholder="0105xxxxxxxxxxxxxxx"
                    maxLength={20}
                    className="w-full bg-black/50 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-[#00d1ff] transition-colors"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Guardar */}
        <div className="flex items-center justify-between pt-4">
          <div className="text-emerald-400 text-sm font-medium flex items-center gap-2 h-6">
            {saveMessage && (
              <>
                {saveMessage.includes("éxito") ? <CheckCircle2 size={16} /> : null}
                {saveMessage}
              </>
            )}
          </div>
          <button 
            onClick={handleSave}
            disabled={isSaving}
            className="px-8 py-3 bg-white text-black hover:bg-white/80 disabled:opacity-50 rounded-xl font-bold transition-colors flex items-center gap-2"
          >
            {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
            Guardar Cambios
          </button>
        </div>
      </div>
    </div>
  );
}
