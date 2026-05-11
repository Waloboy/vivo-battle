"use client";

import React, { useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Trophy, Medal, Star, ArrowLeft, Crown, Flame } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";

export default function RankingPage() {
  const supabase = useMemo(() => createClient(), []);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [myRank, setMyRank] = useState<number | null>(null);
  const [myProfile, setMyProfile] = useState<any>(null);
  const [wakeCount, setWakeCount] = useState(0);

  useEffect(() => {
    const onWake = () => setWakeCount(c => c + 1);
    window.addEventListener("vivo_wakeup", onWake);
    return () => window.removeEventListener("vivo_wakeup", onWake);
  }, []);

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const fetchRanking = async () => {
      try {
        // Get current user
        const { data: { user } } = await supabase.auth.getUser();
        if (user && isMounted) setCurrentUserId(user.id);

        // Fetch top 100 users ordered by total_earned (historical accumulated score)
        let { data, error } = await supabase
          .from("profiles")
          .select("id, username, avatar_url, total_earned, wins, losses, draws")
          .order("total_earned", { ascending: false, nullsFirst: false })
          .limit(100)
          .abortSignal(controller.signal);

        // Fallback: if no one has total_earned, show users by creation date
        if (!error && (!data || data.length === 0 || data.every((u: any) => !u.total_earned || u.total_earned === 0))) {
          const fallback = await supabase
            .from("profiles")
            .select("id, username, avatar_url, total_earned, wins, losses, draws")
            .order("created_at", { ascending: false })
            .limit(100)
            .abortSignal(controller.signal);
            
          if (!fallback.error && fallback.data) {
            data = fallback.data;
            error = fallback.error;
          }
        }

        if (!error && data && isMounted) {
          setUsers(data);
          
          // Find the current user's rank
          if (user) {
            const userIndex = data.findIndex((u: any) => u.id === user.id);
            if (userIndex >= 0) {
              setMyRank(userIndex + 1);
              setMyProfile(data[userIndex]);
            } else {
              // User not in top 100 — calculate their actual rank
              const { data: myData } = await supabase
                .from("profiles")
                .select("id, username, avatar_url, total_earned, wins, losses, draws")
                .eq("id", user.id)
                .abortSignal(controller.signal)
                .single();
              
              if (myData && isMounted) {
                setMyProfile(myData);
                const { count } = await supabase
                  .from("profiles")
                  .select("id", { count: "exact", head: true })
                  .gt("total_earned", myData.total_earned || 0)
                  .abortSignal(controller.signal);
                if (isMounted) setMyRank((count || 0) + 1);
              }
            }
          }
        }
      } catch (err: any) {
        if (err.name === 'AbortError') {
          console.warn("Ranking timeout, retrying...");
          if (isMounted) setTimeout(fetchRanking, 1000);
        }
      } finally {
        clearTimeout(timeoutId);
        if (isMounted) setLoading(false);
      }
    };
    
    fetchRanking();

    return () => { 
      isMounted = false;
      controller.abort(); 
    };
  }, [supabase, wakeCount]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (loading) {
      timer = setTimeout(() => setLoading(false), 3000);
    }
    return () => clearTimeout(timer);
  }, [loading]);

  const getMedalColor = (index: number) => {
    if (index === 0) return "#ffd700"; // Oro
    if (index === 1) return "#c0c0c0"; // Plata
    if (index === 2) return "#cd7f32"; // Bronce
    return "transparent";
  };

  const getMedalEmoji = (index: number) => {
    if (index === 0) return "🥇";
    if (index === 1) return "🥈";
    if (index === 2) return "🥉";
    return null;
  };

  return (
    <div className="flex-1 flex flex-col p-4 max-w-3xl w-full mx-auto pb-24">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link href="/dashboard" className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl md:text-3xl font-black italic tracking-tight uppercase text-transparent bg-clip-text bg-gradient-to-r from-[#ffd700] via-[#ffaa00] to-[#ff5500]">
            Ranking Mundial
          </h1>
          <p className="text-white/40 text-[10px] font-bold uppercase tracking-[0.2em]">Top 100 Leyendas de VIVO</p>
        </div>
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#ffd700]/20 to-transparent flex items-center justify-center border border-[#ffd700]/30 shadow-[0_0_20px_rgba(255,215,0,0.2)]">
          <Trophy size={24} color="#ffd700" />
        </div>
      </div>

      {/* My Rank Card (sticky) */}
      {myRank && myProfile && (
        <div className="mb-4 p-4 rounded-2xl bg-gradient-to-r from-[#ff007a]/10 to-[#00d1ff]/10 border border-[#ff007a]/20 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#ff007a]/20 flex items-center justify-center border border-[#ff007a]/30">
              <Crown size={20} className="text-[#ff007a]" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-white/40">Tu posición global</p>
              <p className="font-black text-xl text-white">#{myRank}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-white/40">Créditos Históricos</p>
              <p className="font-black text-[#ffd700]">{(myProfile.total_earned || 0).toLocaleString("es-VE")}</p>
            </div>
            <div className="text-right ml-3">
              <p className="text-xs text-white/40">W/L/D</p>
              <p className="text-sm font-bold text-white/70">
                <span className="text-emerald-400">{myProfile.wins || 0}</span>
                <span className="text-white/20"> / </span>
                <span className="text-red-400">{myProfile.losses || 0}</span>
                <span className="text-white/20"> / </span>
                <span className="text-yellow-400">{myProfile.draws || 0}</span>
              </p>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center flex-1">
          <div className="w-8 h-8 border-4 border-[#ff007a] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : users.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Flame size={40} className="text-white/10 mb-4" />
          <p className="text-white/30 text-sm">Nadie ha ganado créditos aún. ¡Sé el primero!</p>
        </div>
      ) : (
        <div className="space-y-2">
          {users.map((u, index) => {
            const isTop3 = index < 3;
            const medalColor = getMedalColor(index);
            const isMe = u.id === currentUserId;
            const totalEarned = u.total_earned || 0;

            return (
              <motion.div
                key={u.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(index * 0.03, 1.5) }}
                className={`flex items-center gap-3 p-3.5 rounded-2xl border relative overflow-hidden transition-all ${
                  isMe
                    ? "bg-[#ff007a]/5 border-[#ff007a]/30 ring-1 ring-[#ff007a]/20"
                    : isTop3
                    ? "bg-black/40 backdrop-blur-md"
                    : "bg-white/[0.02] border-white/5"
                }`}
                style={{
                  borderColor: isMe ? undefined : isTop3 ? `${medalColor}40` : undefined,
                  boxShadow: isTop3 ? `0 0 20px ${medalColor}10` : undefined,
                }}
              >
                {isTop3 && (
                  <div className="absolute inset-0 bg-gradient-to-r opacity-10" style={{ backgroundImage: `linear-gradient(to right, ${medalColor}, transparent)` }} />
                )}

                {/* Position */}
                <div className="relative w-8 h-8 flex items-center justify-center flex-shrink-0">
                  {isTop3 ? (
                    <Medal size={28} color={medalColor} style={{ filter: `drop-shadow(0 0 5px ${medalColor})` }} />
                  ) : (
                    <span className="font-black text-white/30 text-lg">#{index + 1}</span>
                  )}
                </div>

                {/* Avatar */}
                <div className="w-11 h-11 rounded-full overflow-hidden border-2 flex-shrink-0 bg-[#0a0a0a]" style={{ borderColor: isTop3 ? medalColor : isMe ? "#ff007a" : "rgba(255,255,255,0.1)" }}>
                  {u.avatar_url ? (
                    <img src={u.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white/50 font-black">{(u.username || "?").charAt(0).toUpperCase()}</div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <h3 className="font-black text-white text-sm truncate flex items-center gap-1.5">
                    @{u.username}
                    {isTop3 && <Star size={11} color={medalColor} fill={medalColor} />}
                    {isMe && <span className="text-[9px] text-[#ff007a] font-bold bg-[#ff007a]/10 px-1.5 py-0.5 rounded-full border border-[#ff007a]/20">TÚ</span>}
                  </h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] font-bold text-emerald-400">
                      {u.wins || 0}W
                    </span>
                    <span className="text-[10px] text-red-400">
                      {u.losses || 0}L
                    </span>
                    <span className="text-[10px] text-yellow-400">
                      {u.draws || 0}D
                    </span>
                  </div>
                </div>

                {/* Points */}
                <div className="text-right flex-shrink-0 flex flex-col items-end justify-center">
                  <span className="text-[9px] text-white/30 font-bold uppercase tracking-wider">Histórico</span>
                  <span className="font-black text-[#ffd700] text-sm">{totalEarned.toLocaleString("es-VE")}</span>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
