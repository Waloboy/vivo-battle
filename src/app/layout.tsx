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
        <link rel="manifest" href="/manifest.json" crossOrigin="use-credentials" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
// ── ARENA 58: Service Worker Registration & Cache Busting ──
(function() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
  
  var SW_PATH = '/sw-auth.js?v=${Date.now()}';
  
  navigator.serviceWorker.register(SW_PATH, { scope: '/' })
    .then(function(reg) {
      // Force update check on every page load
      reg.update();
      
      // Detect when a new SW is waiting and activate it
      reg.addEventListener('updatefound', function() {
        var newWorker = reg.installing;
        if (!newWorker) return;
        newWorker.addEventListener('statechange', function() {
          if (newWorker.state === 'activated') {
            // New version active — purge old caches
            if (navigator.serviceWorker.controller) {
              navigator.serviceWorker.controller.postMessage({ type: 'PURGE_CACHE' });
            }
          }
        });
      });
    })
    .catch(function(err) {
      console.warn('[SW] Registration failed:', err);
    });

  // Listen for keepalive pings from the SW
  navigator.serviceWorker.addEventListener('message', function(event) {
    if (event.data && event.data.type === 'SESSION_KEEPALIVE') {
      // Trigger a lightweight auth check to keep the token alive
      window.dispatchEvent(new Event('vivo_wakeup'));
    }
  });
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