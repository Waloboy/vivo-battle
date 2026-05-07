"use client";

import { useState, useEffect } from "react";
import { User, MapPin, Building2, Loader2, Save, CheckCircle2, Phone, FileText } from "lucide-react";
import { createClient } from "@/utils/supabase/client";

export default function ProfilePage() {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  
  const [originalUsername, setOriginalUsername] = useState("");
  const [usernameStatus, setUsernameStatus] = useState<"idle" | "checking" | "available" | "taken">("idle");
  const [daysUntilChange, setDaysUntilChange] = useState<number | null>(null);

  const supabase = createClient();

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      if (data) {
        setProfile(data);
        setOriginalUsername(data.username);
        if (data.last_username_change) {
          const lastChange = new Date(data.last_username_change);
          const diffTime = Math.abs(new Date().getTime() - lastChange.getTime());
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          if (diffDays < 15) {
            setDaysUntilChange(15 - diffDays);
          }
        }
      }
    }
    setLoading(false);
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
      const updates: any = {
        full_name: profile.full_name,
        city: profile.city,
        bank_name: profile.bank_name,
        id_card: profile.id_card,
        phone_number: profile.phone_number
      };

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
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-white/50 mb-1 uppercase tracking-wider">Username</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 font-bold">@</span>
                <input
                  type="text"
                  value={profile?.username || ""}
                  onChange={(e) => setProfile({...profile, username: e.target.value.replace(/\s/g, '').toLowerCase()})}
                  disabled={daysUntilChange !== null}
                  placeholder="tu_usuario"
                  className="w-full bg-black/50 border border-white/10 rounded-xl pl-9 pr-12 py-3 text-white placeholder-white/30 focus:outline-none focus:border-[#ff007a] transition-colors disabled:opacity-50"
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2">
                  {usernameStatus === "checking" && <Loader2 className="animate-spin text-white/50" size={16} />}
                  {usernameStatus === "available" && <CheckCircle2 className="text-emerald-500" size={16} />}
                  {usernameStatus === "taken" && <span className="text-red-500 text-xs font-bold">En uso</span>}
                </div>
              </div>
              {daysUntilChange !== null && (
                <p className="text-xs text-red-400 mt-1">Podrás cambiar tu nombre de usuario nuevamente en {daysUntilChange} días.</p>
              )}
            </div>
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
                <label className="block text-xs font-medium text-white/50 mb-1 uppercase tracking-wider">Cédula de Identidad</label>
                <div className="relative">
                  <FileText className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" size={18} />
                  <input
                    type="text"
                    value={profile?.id_card || ""}
                    onChange={(e) => setProfile({...profile, id_card: e.target.value})}
                    placeholder="V-12345678"
                    className="w-full bg-black/50 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-[#00d1ff] transition-colors"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-xs font-medium text-white/50 mb-1 uppercase tracking-wider">Número de Teléfono (Pago Móvil)</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" size={18} />
                  <input
                    type="text"
                    value={profile?.phone_number || ""}
                    onChange={(e) => setProfile({...profile, phone_number: e.target.value})}
                    placeholder="0414-1234567"
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
