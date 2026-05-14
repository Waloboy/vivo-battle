"use client";

import { useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import { Swords, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function AuthClient() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const supabase = createClient();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        router.push("/dashboard");
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              username,
            },
          },
        });
        if (error) throw error;
        // Supabase might require email confirmation, but assuming auto-login for now
        router.push("/dashboard");
      }
    } catch (err: any) {
      setError(err.message || "Ocurrió un error.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background glow effects */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#ff007a] rounded-full mix-blend-screen filter blur-[128px] opacity-20 animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#00d1ff] rounded-full mix-blend-screen filter blur-[128px] opacity-20 animate-pulse delay-1000" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md z-10"
      >
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center p-4 rounded-2xl bg-gradient-to-br from-[#ff007a] to-[#00d1ff] mb-4 opacity-90">
            <img src="/assets/images/logo-192.png" alt="ARENA 58 Logo" className="w-12 h-12 object-contain" />
          </div>
          <h1 className="text-4xl font-black tracking-tighter text-gradient">ARENA 58</h1>
          <p className="text-white/60 mt-2">La app de batallas 1vs1</p>
        </div>

        <div className="cyber-glass p-8 rounded-3xl border-white/10 shadow-2xl relative overflow-hidden">
          <div className={`absolute top-0 left-0 w-full h-1 ${isLogin ? 'bg-[#00d1ff]' : 'bg-[#ff007a]'}`} />
          
          <h2 className="text-2xl font-bold mb-6 text-center">
            {isLogin ? "Iniciar Sesión" : "Crear Cuenta"}
          </h2>

          <AnimatePresence mode="wait">
            {error && (
               <motion.div 
                 initial={{ opacity: 0, height: 0 }}
                 animate={{ opacity: 1, height: "auto" }}
                 exit={{ opacity: 0, height: 0 }}
                 className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg text-sm mb-6 text-center"
               >
                 {error}
               </motion.div>
             )}
          </AnimatePresence>

          <form onSubmit={handleAuth} className="space-y-4">
            {!isLogin && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
              >
                <label className="block text-sm font-medium text-white/70 mb-1">Usuario Único</label>
                <input
                  id="auth-username"
                  name="username"
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-[#ff007a] transition-colors"
                  placeholder="@tu_usuario"
                  autoComplete="username"
                />
              </motion.div>
            )}
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1">Correo Electrónico</label>
              <input
                id="auth-email"
                name="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-[#00d1ff] transition-colors"
                placeholder="correo@ejemplo.com"
                autoComplete="email"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1">Contraseña</label>
              <input
                id="auth-password"
                name="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-[#00d1ff] transition-colors"
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 mt-6 transition-all ${
                isLogin 
                  ? 'bg-[#00d1ff] hover:bg-[#00d1ff]/80 text-black glow-secondary' 
                  : 'bg-[#ff007a] hover:bg-[#ff007a]/80 text-white glow-primary'
              }`}
            >
              {loading && <Loader2 className="animate-spin" size={20} />}
              {isLogin ? "Entrar a la Batalla" : "Registrarse Ahora"}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-white/50">
            {isLogin ? "¿No tienes cuenta?" : "¿Ya eres batallador?"}{" "}
            <button
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              className="text-white hover:text-[#00d1ff] font-bold transition-colors"
            >
              {isLogin ? "Regístrate aquí" : "Inicia sesión"}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
