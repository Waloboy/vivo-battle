"use client";

export function SplashScreen() {
  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#0a0a0a]">
      {/* Logo glow */}
      <div className="relative flex items-center justify-center mb-8">
        <div className="absolute w-32 h-32 rounded-full bg-gradient-to-br from-[#ff007a] to-[#00d1ff] opacity-20 blur-3xl animate-pulse" />
        <div className="relative p-5 rounded-2xl bg-gradient-to-br from-[#ff007a] to-[#00d1ff] shadow-[0_0_60px_rgba(255,0,122,0.5)]">
          <svg width="52" height="52" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M14.5 17.5L3 6L6 3L17.5 14.5L14.5 17.5Z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M13 19L19 13" stroke="white" strokeWidth="2" strokeLinecap="round"/>
            <path d="M5 11L11 5" stroke="white" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </div>
      </div>

      <h1
        className="text-3xl font-black tracking-tight mb-1"
        style={{ fontFamily: "var(--font-orbitron, sans-serif)" }}
      >
        <span className="text-white">VIVO</span>
        <span className="bg-gradient-to-r from-[#ff007a] to-[#00d1ff] bg-clip-text text-transparent"> BATTLE</span>
      </h1>
      <p className="text-white/30 text-xs tracking-widest uppercase mb-10">
        Cargando tu sesión…
      </p>

      {/* Spinner */}
      <div className="relative w-10 h-10">
        <div className="absolute inset-0 rounded-full border-2 border-white/5" />
        <div className="absolute inset-0 rounded-full border-2 border-t-[#ff007a] border-r-[#00d1ff] border-b-transparent border-l-transparent animate-spin" />
      </div>
    </div>
  );
}
