"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Swords, User, Wallet, LogOut, ShieldAlert, Compass, MessageCircle } from "lucide-react";
import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/utils/supabase/client";
import { useAuth } from "@/components/AuthProvider";

export function Navbar() {
  const { user, isAdmin, loading } = useAuth();
  const [unreadMessages, setUnreadMessages] = useState(false);
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!user) return;

    const checkUnread = async () => {
      const { count } = await supabase
        .from("messages")
        .select("*", { count: "exact", head: true })
        .eq("receiver_id", user.id)
        .eq("is_read", false);
      setUnreadMessages(!!count && count > 0);
    };
    checkUnread();

    const channel = supabase.channel("navbar-messages")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `receiver_id=eq.${user.id}` },
        () => setUnreadMessages(true)
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages", filter: `receiver_id=eq.${user.id}` },
        () => checkUnread()
      )
      .subscribe();

    return () => {
      channel.unsubscribe().then(() => supabase.removeChannel(channel));
    };
  }, [user, supabase]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  // Don't show navbar on the login page if not logged in
  if (!mounted) return null;
  if (pathname === "/" && !user) return null;

  return (
    <nav className="border-b border-white/10 bg-black/50 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link href={user ? "/dashboard" : "/"} className="flex items-center gap-2 group">
          <div className="p-2 rounded-lg bg-gradient-to-br from-[#ff007a] to-[#00d1ff] opacity-80 group-hover:opacity-100 transition-opacity">
            <img src="/assets/images/logo-192.png" alt="ARENA 58 Logo" className="w-8 h-8 object-contain" />
          </div>
          <span className="font-black text-xl tracking-tight text-gradient hidden sm:flex items-center gap-2">
            ARENA 58
            {loading && <div className="w-3 h-3 rounded-full border-2 border-[#00d1ff] border-t-transparent animate-spin ml-2" />}
          </span>
        </Link>
        
        {user && (
          <div className="flex items-center gap-4 md:gap-6 text-sm font-medium">
            <Link 
              href="/dashboard" 
              className={`flex items-center gap-2 transition-colors ${pathname === '/dashboard' ? 'text-[#ff007a]' : 'text-white/50 hover:text-[#ff007a]'}`}
            >
              <Compass size={18} />
              <span className="hidden sm:block">Explorar</span>
            </Link>
            <Link 
              href="/arena" 
              className={`flex items-center gap-2 transition-colors ${pathname === '/arena' || pathname.startsWith('/arena/') ? 'text-white' : 'text-white/50 hover:text-white'}`}
            >
              <Swords size={18} />
              <span className="hidden sm:block">Batallas</span>
            </Link>
            <Link 
              href="/wallet" 
              className={`flex items-center gap-2 transition-colors ${pathname === '/wallet' ? 'text-[#00d1ff]' : 'text-white/50 hover:text-[#00d1ff]'}`}
            >
              <Wallet size={18} />
              <span className="hidden sm:block">Billetera</span>
            </Link>
            <Link 
              href="/messages" 
              className={`relative flex items-center gap-2 transition-colors ${pathname === '/messages' ? 'text-[#00d1ff]' : 'text-white/50 hover:text-[#00d1ff]'}`}
            >
              <MessageCircle size={18} />
              {unreadMessages && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-[#ff007a] rounded-full border border-black shadow-[0_0_10px_rgba(255,0,122,0.8)]" />
              )}
              <span className="hidden sm:block">Mensajes</span>
            </Link>
            <Link 
              href="/mi-perfil" 
              className={`flex items-center gap-2 transition-colors ${pathname === '/mi-perfil' ? 'text-[#ff007a]' : 'text-white/50 hover:text-[#ff007a]'}`}
            >
              <User size={18} />
              <span className="hidden sm:block">Perfil</span>
            </Link>
            
            {isAdmin && (
              <Link 
                href="/admin" 
                className={`flex items-center gap-2 transition-colors ${pathname === '/admin' ? 'text-yellow-400' : 'text-white/50 hover:text-yellow-400'}`}
              >
                <ShieldAlert size={18} />
                <span className="hidden sm:block">Admin</span>
              </Link>
            )}
            
            <div className="w-px h-6 bg-white/10 mx-1 md:mx-2"></div>
            
            <button 
              onClick={handleLogout}
              className="flex items-center gap-2 text-red-500/80 hover:text-red-500 transition-colors"
            >
              <LogOut size={18} />
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}
