"use client";

import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Trophy, Medal, Star, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

export default function RankingPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      // Fetch top 100 users ordered by wins
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, avatar_url, wins, total_earned")
        .order("wins", { ascending: false })
        .limit(100);

      if (!error && data) {
        setUsers(data);
      }
      setLoading(false);
    })();
  }, [supabase]);

  const getMedalColor = (index: number) => {
    if (index === 0) return "#ffd700"; // Oro
    if (index === 1) return "#c0c0c0"; // Plata
    if (index === 2) return "#cd7f32"; // Bronce
    return "transparent";
  };

  return (
    <div className="flex-1 flex flex-col p-4 max-w-3xl w-full mx-auto pb-24">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
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

      {loading ? (
        <div className="flex items-center justify-center flex-1">
          <div className="w-8 h-8 border-4 border-[#ff007a] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-3">
          {users.map((u, index) => {
            const isTop3 = index < 3;
            const medalColor = getMedalColor(index);

            return (
              <motion.div
                key={u.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className={`flex items-center gap-4 p-4 rounded-2xl border ${isTop3 ? "bg-black/40 backdrop-blur-md" : "bg-white/[0.02] border-white/5"} relative overflow-hidden`}
                style={{
                  borderColor: isTop3 ? `${medalColor}40` : undefined,
                  boxShadow: isTop3 ? `0 0 20px ${medalColor}10` : undefined,
                }}
              >
                {isTop3 && (
                  <div className="absolute inset-0 bg-gradient-to-r opacity-10" style={{ backgroundImage: `linear-gradient(to right, ${medalColor}, transparent)` }} />
                )}

                <div className="relative w-8 h-8 flex items-center justify-center flex-shrink-0">
                  {isTop3 ? (
                    <Medal size={28} color={medalColor} style={{ filter: `drop-shadow(0 0 5px ${medalColor})` }} />
                  ) : (
                    <span className="font-black text-white/30 text-lg">#{index + 1}</span>
                  )}
                </div>

                <div className="w-12 h-12 rounded-full overflow-hidden border-2 flex-shrink-0 bg-[#0a0a0a]" style={{ borderColor: isTop3 ? medalColor : "rgba(255,255,255,0.1)" }}>
                  {u.avatar_url ? (
                    <img src={u.avatar_url} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white/50 font-black">{u.username.charAt(0).toUpperCase()}</div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <h3 className="font-black text-white text-lg truncate flex items-center gap-2">
                    @{u.username}
                    {isTop3 && <Star size={12} color={medalColor} fill={medalColor} />}
                  </h3>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-[10px] font-bold text-[#00d1ff] uppercase tracking-wider">
                      {u.wins} Victorias
                    </span>
                  </div>
                </div>

                <div className="text-right flex-shrink-0 flex flex-col items-end justify-center">
                  <span className="text-[10px] text-white/40 font-bold uppercase tracking-widest mb-1">Ganancias</span>
                  <span className="font-black text-[#ffd700]">{u.total_earned.toLocaleString()} CR</span>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
