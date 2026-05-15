import type { Metadata } from "next";
import { Inter, Orbitron } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/Navbar";
import { AuthProvider } from "@/components/AuthProvider";
import { ChallengeNotification } from "@/components/ChallengeNotification";
import { EmergencyReconnect } from "@/components/EmergencyReconnect";

const inter = Inter({ subsets: ["latin"] });
const orbitron = Orbitron({ 
  subsets: ["latin"], 
  variable: "--font-orbitron", 
  weight: ["400", "700", "900"] 
});

export const metadata: Metadata = {
  title: "ARENA 58",
  description: "La app de batallas 1vs1 de Venezuela",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="dark" suppressHydrationWarning>
      <head>
        <meta http-equiv="Content-Security-Policy" content="default-src * data: blob: 'unsafe-inline' 'unsafe-eval'; connect-src *;" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
// ── ARENA 58: MEMORIA CERO ──
// Auth now lives in sessionStorage only. localStorage is enemy territory.
// On every page load: nuke localStorage, kill SWs, purge caches.
(function() {
  if (typeof window === 'undefined') return;

  // 1. PURGE localStorage — auth is in sessionStorage now, localStorage is poison
  try {
    var keys = [];
    for (var i = 0; i < localStorage.length; i++) { keys.push(localStorage.key(i)); }
    keys.forEach(function(k) {
      if (k && k.indexOf('sb-') === 0) { localStorage.removeItem(k); }
      if (k && k.indexOf('vivo_') === 0) { localStorage.removeItem(k); }
    });
  } catch(e) {}

  // 2. KILL all Service Workers — they cache 404s
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(function(regs) {
      regs.forEach(function(r) { r.unregister(); });
    });
  }

  // 3. PURGE all caches left by old SWs
  if ('caches' in window) {
    caches.keys().then(function(names) {
      names.forEach(function(name) { caches.delete(name); });
    });
  }
})();
`,
          }}
        />
      </head>
      <body 
        suppressHydrationWarning 
        className={`${inter.className} ${orbitron.variable} bg-[#0a0a0a] text-white min-h-screen flex flex-col`}
      >
        <AuthProvider>
          <Navbar />
          <ChallengeNotification />
          <main className="flex-1 flex flex-col">
            {children}
          </main>
          <EmergencyReconnect />
        </AuthProvider>
      </body>
    </html>
  );
}