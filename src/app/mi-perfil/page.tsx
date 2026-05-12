"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";

export default function MiPerfil() {
  const [perfil, setPerfil] = useState<any>(null);
  const [cargando, setCargando] = useState(true);
  const [errorLocal, setErrorLocal] = useState<string | null>(null);

  useEffect(() => {
    const obtenerPerfil = async () => {
      try {
        const clienteSupabase = createClient();
        const { data: usuarioData, error: errorUsuario } = await clienteSupabase.auth.getUser();

        if (errorUsuario) {
          throw new Error(errorUsuario.message);
        }

        if (usuarioData && usuarioData.user) {
          const { data: datosPerfil, error: errorPerfil } = await clienteSupabase
            .from("profiles")
            .select("*")
            .eq("id", usuarioData.user.id)
            .single();

          if (errorPerfil) {
            throw new Error(errorPerfil.message);
          }

          setPerfil(datosPerfil);
        }
      } catch (errorCapturado: any) {
        setErrorLocal(errorCapturado.message || "Error al cargar perfil");
      } finally {
        setCargando(false);
      }
    };

    obtenerPerfil();
  }, []);

  if (cargando) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center pb-24 text-white">
        <h2>Cargando perfil...</h2>
      </div>
    );
  }

  if (errorLocal) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center pb-24 text-white">
        <h2>Error: {errorLocal}</h2>
      </div>
    );
  }

  if (!perfil) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center pb-24 text-white">
        <h2>No hay perfil activo.</h2>
      </div>
    );
  }

  return (
    <div className="flex-1 max-w-2xl w-full mx-auto p-4 md:p-8 pb-24 text-white">
      <div className="cyber-glass rounded-3xl p-6 border-white/5 space-y-4">
        <h1 className="text-2xl font-black text-white">Perfil de Usuario</h1>
        <div className="bg-black/40 p-4 rounded-xl">
          <p><strong>Username:</strong> @{perfil.username}</p>
          <p><strong>Nombre Completo:</strong> {perfil.full_name || "N/A"}</p>
          <p><strong>Ciudad:</strong> {perfil.city || "N/A"}</p>
          <p><strong>WhatsApp:</strong> {perfil.whatsapp_number || "N/A"}</p>
          <p><strong>Total Ganado:</strong> {perfil.total_earned || 0} BCR</p>
        </div>
        <p className="text-sm text-white/40 mt-4">Página simplificada temporalmente por mantenimiento de emergencia.</p>
      </div>
    </div>
  );
}
