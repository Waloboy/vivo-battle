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
        <script dangerouslySetInnerHTML={{ __html: `
          window.__ERRORS__ = [];
          window.onerror = function(message, source, lineno, colno, error) {
            const errData = { type: 'GLOBAL_ERROR', message, source, lineno, colno, stack: error?.stack, time: new Date().toLocaleTimeString() };
            window.__ERRORS__.push(errData);
            console.log("🚨 [CAPTURADO EN HEAD]:", errData);
            try { localStorage.setItem('last_crash_errors', JSON.stringify(window.__ERRORS__)); } catch(e){}
          };
          window.onunhandledrejection = function(event) {
            const errData = { type: 'PROMISE_REJECTION', reason: event.reason?.message || event.reason, stack: event.reason?.stack, time: new Date().toLocaleTimeString() };
            window.__ERRORS__.push(errData);
            console.log("🚨 [PROMESA ROTA IN HEAD]:", errData);
            try { localStorage.setItem('last_crash_errors', JSON.stringify(window.__ERRORS__)); } catch(e){}
          };
        `}} />
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