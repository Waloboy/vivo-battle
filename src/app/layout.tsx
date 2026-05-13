import type { Metadata } from "next";
import { Inter, Orbitron } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/Navbar";
import { AuthProvider } from "@/components/AuthProvider";
import { ChallengeNotification } from "@/components/ChallengeNotification";
import { EmergencyReconnect } from "@/components/EmergencyReconnect";

const inter = Inter({ subsets: ["latin"] });
const orbitron = Orbitron({ subsets: ["latin"], variable: "--font-orbitron", weight: ["400", "700", "900"] });

export const metadata: Metadata = {
  title: "VIVO BATTLE",
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
        <meta httpEquiv="Content-Security-Policy" content="default-src * 'unsafe-inline' 'unsafe-eval' data: blob:; script-src * 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' https://vivo-battle-wy48g9g4.livekit.cloud https://zyrmgjkvojqfmhqammkl.supabase.co; connect-src * wss: ws: https: http: wss://vivo-battle-wy48g9g4.livekit.cloud wss://zyrmgjkvojqfmhqammkl.supabase.co; img-src * data: blob:; media-src * data: blob: mediastream:; worker-src * blob:; frame-src *; style-src * 'unsafe-inline';" />
      </head>
      <body suppressHydrationWarning className={`${inter.className} ${orbitron.variable} bg-[#0a0a0a] text-white min-h-screen flex flex-col`}>
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
