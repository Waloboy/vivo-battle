import type { Metadata } from "next";
import { Inter, Orbitron } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/Navbar";
import { AuthProvider } from "@/components/AuthProvider";
import { ClientShell } from "@/components/ClientShell";
import { ChallengeNotification } from "@/components/ChallengeNotification";
import { ConnectionManager } from "@/components/ConnectionManager";

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
    <html lang="es" className="dark">
      <head>
        <meta httpEquiv="Content-Security-Policy" content="default-src * 'unsafe-inline' 'unsafe-eval' data: blob:; script-src * 'unsafe-inline' 'unsafe-eval'; connect-src * 'unsafe-inline' wss: ws:; img-src * data: blob:; frame-src *; style-src * 'unsafe-inline';" />
      </head>
      <body className={`${inter.className} ${orbitron.variable} bg-[#0a0a0a] text-white min-h-screen flex flex-col`}>
        <AuthProvider>
          <ClientShell>
            <ConnectionManager />
            <Navbar />
            <ChallengeNotification />
            <main className="flex-1 flex flex-col">
              {children}
            </main>
          </ClientShell>
        </AuthProvider>
      </body>
    </html>
  );
}

