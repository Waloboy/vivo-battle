"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Swords, User, Wallet, LogOut, ShieldAlert, Compass, MessageCircle } from "lucide-react";
import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/utils/supabase/client";

export function Navbar() {
  const [user, setUser] = useState<any>(null);
  const [role, setRole] = useState<string>("user");
  const [unreadMessages, setUnreadMessages] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    const checkUnread = async (userId: string) => {
      const { count } = await supabase
        .from("messages")
        .select("*", { count: "exact", head: true })
        .eq("receiver_id", userId)
        .eq("is_read", false);
      setUnreadMessages(!!count && count > 0);
    };

    const checkUser = async () => {
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        setUser(data.user);
        checkUnread(data.user.id);
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", data.user.id)
          .single();
        if (profile) setRole(profile.role);
      } else {
        setUser(null);
      }
    };
    checkUser();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          setUser(session.user);
          checkUnread(session.user.id);
          const { data: profile } = await supabase
            .from("profiles")
            .select("role")
            .eq("id", session.user.id)
            .single();
          if (profile) setRole(profile.role);
        } else {
          setUser(null);
          setRole("user");
          setUnreadMessages(false);
        }
      }
    );

    // Listen for new unread messages globally
    let channel: any = null;
    const setupRealtime = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      channel = supabase.channel("navbar-messages")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "messages" },
          (payload) => {
            if (payload.new.receiver_id === user.id && !payload.new.is_read) {
              setUnreadMessages(true);
            }
          }
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "messages" },
          (payload) => {
            if (payload.new.receiver_id === user.id && payload.new.is_read) {
              checkUnread(user.id);
            }
          }
        )
        .subscribe();
    };
    setupRealtime();

    return () => {
      authListener.subscription.unsubscribe();
      if (channel) supabase.removeChannel(channel);
    };
  }, [supabase]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  // Don't show navbar on the login page if not logged in
  if (pathname === "/" && !user) return null;

  return (
    <nav className="border-b border-white/10 bg-black/50 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link href={user ? "/dashboard" : "/"} className="flex items-center gap-2 group">
          <div className="p-2 rounded-lg bg-gradient-to-br from-[#ff007a] to-[#00d1ff] opacity-80 group-hover:opacity-100 transition-opacity">
            <Swords size={20} className="text-white" />
          </div>
          <span className="font-black text-xl tracking-tight text-gradient hidden sm:block">
            VIVO BATTLE
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
              href="/battle" 
              className={`flex items-center gap-2 transition-colors ${pathname === '/battle' || pathname.startsWith('/battle/') ? 'text-white' : 'text-white/50 hover:text-white'}`}
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
              href="/profile" 
              className={`flex items-center gap-2 transition-colors ${pathname === '/profile' ? 'text-[#ff007a]' : 'text-white/50 hover:text-[#ff007a]'}`}
            >
              <User size={18} />
              <span className="hidden sm:block">Perfil</span>
            </Link>
            
            {role === "admin" && (
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
