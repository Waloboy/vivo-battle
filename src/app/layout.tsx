import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Link from "next/link";
import { Swords } from "lucide-react";

const inter = Inter({ subsets: ["latin"] });

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
      <body className={`${inter.className} bg-[#0a0a0a] text-white min-h-screen flex flex-col`}>
        <nav className="border-b border-white/10 bg-black/50 backdrop-blur-md sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2 group">
              <div className="p-2 rounded-lg bg-gradient-to-br from-[#ff007a] to-[#00d1ff] opacity-80 group-hover:opacity-100 transition-opacity">
                <Swords size={20} className="text-white" />
              </div>
              <span className="font-black text-xl tracking-tight text-gradient">VIVO BATTLE</span>
            </Link>
            <div className="flex items-center gap-6 text-sm font-medium">
              <Link href="/battle" className="text-white/70 hover:text-white transition-colors">Batallas</Link>
              <Link href="/dashboard" className="text-white/70 hover:text-white transition-colors">Billetera</Link>
              <Link href="/admin" className="text-white/70 hover:text-white transition-colors">Admin</Link>
            </div>
          </div>
        </nav>
        <main className="flex-1 flex flex-col">
          {children}
        </main>
      </body>
    </html>
  );
}
