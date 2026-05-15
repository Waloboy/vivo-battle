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
        <script
          dangerouslySetInnerHTML={{
            __html: `
// ── ARENA 58: FORCE UNREGISTER ALL SERVICE WORKERS ──
// SW was causing 404 on RSC routes and killing Supabase WebSockets.
// This script purges any lingering SW from user devices.
(function() {
  if (typeof window === 'undefined') return;
  if(!localStorage.getItem('purged')){ 
    localStorage.clear(); 
    sessionStorage.clear(); 
    localStorage.setItem('purged', 'true'); 
    window.location.reload(); 
  }
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.getRegistrations().then(function(regs) {
    regs.forEach(function(r) {
      r.unregister().then(function() {
        console.log('[SW] Unregistered:', r.scope);
      });
    });
  });
  // Purge all caches left behind by the old SW
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