"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, Plus, UserPlus, Check, Loader2, Flame, Zap, Search, Swords, Shuffle, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

// ── Types ──
interface BattleProfile {
  username: string;
  avatar_url: string | null;
}

interface Battle {
  id: string;
  player_a_id: string;
  player_b_id: string;
  score_a: number;
  score_b: number;
  is_active: boolean;
  started_at: string;
  ended_at: string | null;
  title?: string;
  thumbnail_url?: string;
  viewer_count?: number;
  creator_id?: string;
  // Joined profile data
  player_a?: BattleProfile;
  player_b?: BattleProfile;
}

type TabKey = "explore" | "following" | "foryou";

const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: "explore", label: "Explorar", icon: <Flame size={16} /> },
  { key: "following", label: "Siguiendo", icon: <UserPlus size={16} /> },
  { key: "foryou", label: "Para Ti", icon: <Zap size={16} /> },
];

const PAGE_SIZE = 10;

// ── Thumbnail Generator ──
// Generates a dynamic gradient thumbnail for battles without images
function generateBattleThumbnail(battleId: string, scoreA: number, scoreB: number): string {
  // Create a deterministic "random" from the battle ID
  const hash = battleId.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const hue1 = (hash * 37) % 360;
  const hue2 = (hue1 + 120 + (hash % 60)) % 360;
  const dominantColor = scoreA > scoreB ? "318, 100%" : "191, 100%";
  return `linear-gradient(135deg, 
    hsl(${hue1}, 70%, 15%) 0%, 
    hsl(${dominantColor}, 8%) 50%, 
    hsl(${hue2}, 70%, 12%) 100%)`;
}

// ── Viewer count simulation (realtime-based) ──
function simulateViewers(battleId: string, scoreA: number, scoreB: number): number {
  const hash = battleId.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const base = (hash % 800) + 50;
  const activity = Math.floor((scoreA + scoreB) / 5);
  return base + activity;
}

export default function ExploreDashboard() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("explore");
  const [battles, setBattles] = useState<Battle[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [followedUsers, setFollowedUsers] = useState<Set<string>>(new Set());
  const [followingInProgress, setFollowingInProgress] = useState<Set<string>>(new Set());
  const observerRef = useRef<IntersectionObserver | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const pageRef = useRef(0);

  // Search & Challenge state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [challengeSending, setChallengeSending] = useState<string | null>(null);
  const [challengeSent, setChallengeSent] = useState<Set<string>>(new Set());
  const [matchmaking, setMatchmaking] = useState(false);

  // ── Realtime subscription for live updates (PRIORITY) ──
  useEffect(() => {
    const channel = supabase
      .channel("dashboard-realtime")
      // Listen for score updates and status changes
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "battles" },
        (payload: any) => {
          setBattles(prev =>
            prev.map((b: any) =>
              b.id === payload.new.id
                ? { ...b, score_a: payload.new.score_a, score_b: payload.new.score_b, is_active: payload.new.is_active }
                : b
            ).filter((b: any) => b.is_active)
          );
        }
      )
      // Listen for new battles being created
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "battles" },
        async (payload: any) => {
          // Fetch full data for the new battle including profiles
          const { data: newBattle } = await supabase
            .from("battles")
            .select(`
              *,
              player_a:profiles!battles_player_a_id_fkey(username, avatar_url),
              player_b:profiles!battles_player_b_id_fkey(username, avatar_url)
            `)
            .eq("id", payload.new.id)
            .single();
          
          if (newBattle && newBattle.is_active) {
            setBattles(prev => [newBattle as Battle, ...prev].slice(0, 50));
          }
        }
      )
      // Listen for challenges targeting the current user
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "challenges" },
        (payload: any) => {
          // We handle notification or redirection here if it's for us
          // Note: Full challenge logic might be in a separate layout component, 
          // but we ensure it's captured here for the dashboard.
          console.log("New challenge detected:", payload.new);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [supabase]);

  // ── Initialize user & follows ──
  useEffect(() => {
    (async () => {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user || !user.id) {
        console.warn("[Dashboard] No authenticated user or auth error:", authError?.message);
        return;
      }

      // Validate UUID format before querying
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(user.id)) {
        console.error("[Dashboard] Invalid user UUID format:", user.id);
        return;
      }

      setUser(user);

      // Load follows — only if we have a valid user ID
      const { data: follows, error: followsError } = await supabase
        .from("follows")
        .select("followed_id")
        .eq("follower_id", user.id);

      if (followsError) {
        console.error("[Dashboard] Follows query error:", followsError.message);
      } else if (follows) {
        // Filter out any malformed followed_ids
        const validFollows = follows
          .map((f: any) => f.followed_id)
          .filter((id: string) => id && uuidRegex.test(id));
        setFollowedUsers(new Set(validFollows));
      }
    })();
  }, [supabase]);

  // ── Fetch battles ──
  const fetchBattles = useCallback(async (page: number, tab: TabKey, append = false) => {
    if (!append) setLoading(true);
    else setLoadingMore(true);

    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    // Strict: only battles from the last 10 minutes (stale battles auto-disappear)
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();

    let query = supabase
      .from("battles")
      .select(`
        *,
        player_a:profiles!battles_player_a_id_fkey(username, avatar_url),
        player_b:profiles!battles_player_b_id_fkey(username, avatar_url)
      `)
      .eq("is_active", true)
      .gte("started_at", tenMinAgo)
      .order("score_a", { ascending: false })
      .range(from, to);

    // For "following" tab, filter by followed users
    if (tab === "following" && followedUsers.size > 0) {
      const followedArray = Array.from(followedUsers);
      // Build proper Supabase filter — wrap each UUID in quotes for .in()
      const quotedIds = followedArray.map(id => `"${id}"`).join(",");
      query = supabase
        .from("battles")
        .select(`
          *,
          player_a:profiles!battles_player_a_id_fkey(username, avatar_url),
          player_b:profiles!battles_player_b_id_fkey(username, avatar_url)
        `)
        .eq("is_active", true)
        .gte("started_at", tenMinAgo)
        .or(`player_a_id.in.(${quotedIds}),player_b_id.in.(${quotedIds})`)
        .order("score_a", { ascending: false })
        .range(from, to);
    }

    // For "para ti" tab — sort by combined activity (score_a + score_b)
    if (tab === "foryou") {
      query = supabase
        .from("battles")
        .select(`
          *,
          player_a:profiles!battles_player_a_id_fkey(username, avatar_url),
          player_b:profiles!battles_player_b_id_fkey(username, avatar_url)
        `)
        .eq("is_active", true)
        .gte("started_at", tenMinAgo)
        .order("started_at", { ascending: false })
        .range(from, to);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching battles:", error);
      setLoading(false);
      setLoadingMore(false);
      return;
    }

    const sortedData = (data || []).sort((a: Battle, b: Battle) => {
      const totalA = (a.score_a || 0) + (a.score_b || 0);
      const totalB = (b.score_a || 0) + (b.score_b || 0);
      return totalB - totalA;
    });

    if (append) {
      setBattles(prev => [...prev, ...sortedData]);
    } else {
      setBattles(sortedData);
    }

    setHasMore((data || []).length === PAGE_SIZE);
    setLoading(false);
    setLoadingMore(false);
  }, [supabase, followedUsers]);

  // ── Load on tab change ──
  useEffect(() => {
    pageRef.current = 0;
    fetchBattles(0, activeTab);
  }, [activeTab, fetchBattles]);

  // ── Infinite Scroll Observer ──
  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect();

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore && !loading) {
          pageRef.current += 1;
          fetchBattles(pageRef.current, activeTab, true);
        }
      },
      { threshold: 0.1 }
    );

    if (sentinelRef.current) {
      observerRef.current.observe(sentinelRef.current);
    }

    return () => observerRef.current?.disconnect();
  }, [hasMore, loadingMore, loading, activeTab, fetchBattles]);


  // ── Follow / Unfollow ──
  const toggleFollow = async (targetUserId: string) => {
    if (!user || followingInProgress.has(targetUserId)) return;

    setFollowingInProgress(prev => new Set(prev).add(targetUserId));

    const isFollowing = followedUsers.has(targetUserId);

    if (isFollowing) {
      // Unfollow
      await supabase
        .from("follows")
        .delete()
        .eq("follower_id", user.id)
        .eq("followed_id", targetUserId);

      setFollowedUsers(prev => {
        const next = new Set(prev);
        next.delete(targetUserId);
        return next;
      });
    } else {
      // Follow
      await supabase
        .from("follows")
        .insert({ follower_id: user.id, followed_id: targetUserId });

      setFollowedUsers(prev => new Set(prev).add(targetUserId));
    }

    setFollowingInProgress(prev => {
      const next = new Set(prev);
      next.delete(targetUserId);
      return next;
    });
  };

  // ── Search users ──
  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults([]); return; }
    const t = setTimeout(async () => {
      const { data } = await supabase.from("profiles").select("id, username, avatar_url").ilike("username", `%${searchQuery}%`).neq("id", user?.id || "").limit(6);
      setSearchResults(data || []);
    }, 300);
    return () => clearTimeout(t);
  }, [searchQuery, user, supabase]);

  // ── Send challenge ──
  const sendChallenge = async (targetId: string) => {
    if (!user || challengeSending) return;
    setChallengeSending(targetId);
    await supabase.from("challenges").insert({ challenger_id: user.id, challenged_id: targetId });
    setChallengeSent(prev => new Set(prev).add(targetId));
    setChallengeSending(null);
  };

  // ── Random matchmaking ──
  const startMatchmaking = async () => {
    if (!user || matchmaking) return;
    setMatchmaking(true);
    // Remove old entry if exists, then join queue
    await supabase.from("matchmaking_queue").delete().eq("user_id", user.id);
    await supabase.from("matchmaking_queue").insert({ user_id: user.id, status: "searching" });

    // Check if there's another user searching
    const { data: others } = await supabase.from("matchmaking_queue").select("*").eq("status", "searching").neq("user_id", user.id).order("created_at", { ascending: true }).limit(1);

    if (others && others.length > 0) {
      const opponent = others[0];
      // Create battle
      const { data: battle } = await supabase.from("battles").insert({ player_a_id: user.id, player_b_id: opponent.user_id, is_active: true }).select("id").single();
      // Clean up queue
      await supabase.from("matchmaking_queue").delete().eq("user_id", user.id);
      await supabase.from("matchmaking_queue").delete().eq("user_id", opponent.user_id);
      setMatchmaking(false);
      if (battle) router.push(`/battle/${battle.id}`);
    } else {
      // Wait for match via polling (simple approach)
      const interval = setInterval(async () => {
        const { data: myEntry } = await supabase.from("matchmaking_queue").select("*").eq("user_id", user.id).single();
        if (!myEntry) { clearInterval(interval); setMatchmaking(false); return; }
        // Check if someone created a battle with us
        const { data: newBattle } = await supabase.from("battles").select("id").or(`player_a_id.eq.${user.id},player_b_id.eq.${user.id}`).eq("is_active", true).order("started_at", { ascending: false }).limit(1).single();
        if (newBattle) { clearInterval(interval); await supabase.from("matchmaking_queue").delete().eq("user_id", user.id); setMatchmaking(false); router.push(`/battle/${newBattle.id}`); }
      }, 3000);
      // Auto-cancel after 30s
      setTimeout(async () => { clearInterval(interval); await supabase.from("matchmaking_queue").delete().eq("user_id", user.id); setMatchmaking(false); }, 30000);
    }
  };

  // ── Card animation variants ──
  const cardVariants = {
    hidden: { opacity: 0, y: 30, scale: 0.95 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        delay: i * 0.06,
        duration: 0.5,
        ease: [0.25, 0.46, 0.45, 0.94] as const,
      },
    }),
  };

  return (
    <div className="flex-1 w-full max-w-3xl mx-auto px-3 md:px-6 pb-8">
      {/* ── Header ── */}
      <div className="pt-4 pb-3 md:pt-6 md:pb-4">
        <h1 className="text-2xl md:text-3xl font-black tracking-tight">
          <span className="text-gradient">Explorar</span> Batallas
        </h1>
        <p className="text-white/30 text-xs mt-1">Encuentra las batallas más calientes en vivo</p>
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-1 mb-4 bg-white/[0.03] p-1 rounded-2xl border border-white/5">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-300 ${
              activeTab === tab.key
                ? "bg-gradient-to-r from-[#ff007a]/20 to-[#00d1ff]/20 text-white border border-white/10 shadow-[0_0_20px_rgba(255,0,122,0.1)]"
                : "text-white/30 hover:text-white/60 hover:bg-white/[0.03]"
            }`}
          >
            {tab.icon}
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* ── Search + Matchmaking ── */}
      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/20" />
          <input id="dashboard-search" name="dashboard-search" type="text" value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); setSearchOpen(true); }} onFocus={() => setSearchOpen(true)} placeholder="Buscar usuario para retar..." className="w-full bg-white/[0.03] border border-white/5 rounded-2xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-[#ff007a]/30 transition-colors" />
          <AnimatePresence>
            {searchOpen && searchResults.length > 0 && (
              <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} className="absolute top-full left-0 right-0 mt-1.5 bg-[#0d0d0d] border border-white/10 rounded-2xl overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.8)] z-30">
                {searchResults.map((r) => (
                  <div key={r.id} className="flex items-center justify-between px-4 py-3 border-b border-white/5 last:border-0 hover:bg-white/[0.03] transition-colors">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#ff007a] to-[#00d1ff] p-[1px]"><div className="w-full h-full rounded-full bg-[#0a0a0a] flex items-center justify-center"><span className="text-[10px] font-black text-white/50">{r.username[0].toUpperCase()}</span></div></div>
                      <span className="text-sm font-semibold text-white">@{r.username}</span>
                    </div>
                    <button onClick={() => sendChallenge(r.id)} disabled={challengeSending === r.id || challengeSent.has(r.id)} className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all ${challengeSent.has(r.id) ? "bg-white/5 text-white/30" : "bg-[#ff007a]/15 text-[#ff007a] border border-[#ff007a]/20 hover:bg-[#ff007a]/25"}`}>
                      {challengeSending === r.id ? <Loader2 size={12} className="animate-spin" /> : challengeSent.has(r.id) ? <><Check size={12} /> Enviado</> : <><Swords size={12} /> Retar</>}
                    </button>
                  </div>
                ))}
                <button onClick={() => { setSearchOpen(false); setSearchQuery(""); }} className="w-full py-2 text-white/20 text-[10px] hover:bg-white/[0.02] transition-colors">Cerrar</button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <button onClick={startMatchmaking} disabled={matchmaking} className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold border transition-all whitespace-nowrap ${matchmaking ? "bg-[#00d1ff]/10 border-[#00d1ff]/20 text-[#00d1ff]" : "bg-white/[0.03] border-white/5 text-white/50 hover:text-white hover:border-white/15"}`}>
          {matchmaking ? <><Loader2 size={14} className="animate-spin" /> Buscando...</> : <><Shuffle size={14} /> Aleatorio</>}
        </button>
      </div>

      {/* ── Loading State ── */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="animate-spin text-[#ff007a]" size={36} />
            <span className="text-white/30 text-xs font-medium">Cargando batallas...</span>
          </div>
        </div>
      )}

      {/* ── Empty State ── */}
      {!loading && battles.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center py-20 text-center"
        >
          <div className="w-20 h-20 rounded-full bg-white/[0.03] border border-white/10 flex items-center justify-center mb-4">
            <Flame size={32} className="text-white/20" />
          </div>
          <h3 className="text-lg font-bold text-white/50 mb-1">
            {activeTab === "following" ? "Sin batallas de seguidos" : "No hay batallas activas"}
          </h3>
          <p className="text-white/25 text-sm max-w-xs">
            {activeTab === "following"
              ? "Sigue a otros usuarios para ver sus batallas aquí"
              : "Las batallas aparecerán aquí cuando estén en vivo"}
          </p>
        </motion.div>
      )}

      {/* ── Battle Grid ── */}
      {!loading && battles.length > 0 && (
        <div className="grid grid-cols-2 gap-2.5 md:gap-3">
          <AnimatePresence mode="popLayout">
            {battles.map((battle, index) => {
              const totalScore = (battle.score_a || 0) + (battle.score_b || 0) || 1;
              const progressA = ((battle.score_a || 0) / totalScore) * 100;
              const viewers = simulateViewers(battle.id, battle.score_a, battle.score_b);
              const creatorProfile = battle.player_a;
              const creatorId = battle.player_a_id;
              const isFollowed = followedUsers.has(creatorId);
              const isFollowLoading = followingInProgress.has(creatorId);
              const battleTitle = battle.title || `${creatorProfile?.username || "Player A"} vs ${battle.player_b?.username || "Player B"}`;
              const thumbnailBg = battle.thumbnail_url
                ? undefined
                : generateBattleThumbnail(battle.id, battle.score_a, battle.score_b);

              return (
                <motion.div
                  key={battle.id}
                  custom={index}
                  variants={cardVariants}
                  initial="hidden"
                  animate="visible"
                  exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.3 } }}
                  layout
                  className="group"
                >
                  <div className="rounded-2xl overflow-hidden border border-white/[0.06] bg-white/[0.02] hover:border-white/15 transition-all duration-300 hover:shadow-[0_0_30px_rgba(255,0,122,0.08)]">
                    {/* ── Thumbnail Area ── */}
                    <Link href={`/battle/${battle.id}`} className="block">
                      <div
                        className="relative aspect-[4/5] overflow-hidden cursor-pointer"
                        style={
                          battle.thumbnail_url
                            ? { backgroundImage: `url(${battle.thumbnail_url})`, backgroundSize: "cover", backgroundPosition: "center" }
                            : { background: thumbnailBg }
                        }
                      >
                        {/* Ambient glow overlay */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />
                        <div className="absolute inset-0 bg-gradient-to-br from-[#ff007a]/5 to-[#00d1ff]/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                        {/* VS Indicator */}
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <div className="relative">
                            <span className="text-white/[0.04] font-[family-name:var(--font-orbitron)] font-black text-5xl md:text-6xl tracking-tighter select-none">VS</span>
                          </div>
                        </div>

                        {/* ── LIVE Badge + Viewers ── */}
                        <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 z-10">
                          <div className="flex items-center gap-1 bg-red-500/90 backdrop-blur-sm px-2 py-0.5 rounded-md">
                            <div className="w-1.5 h-1.5 rounded-full bg-white live-pulse" />
                            <span className="text-[9px] font-black text-white uppercase tracking-wider">LIVE</span>
                          </div>
                          <div className="flex items-center gap-1 bg-black/50 backdrop-blur-sm px-2 py-0.5 rounded-md border border-white/10">
                            <Eye size={10} className="text-white/70" />
                            <span className="text-[9px] font-bold text-white/80">{viewers.toLocaleString()}</span>
                          </div>
                        </div>

                        {/* ── Score Progress Bar & Usernames ── */}
                        <div className="absolute bottom-0 left-0 right-0 z-10 px-2.5 pb-2.5">
                          {/* Usernames */}
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="text-[10px] font-bold text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] truncate max-w-[45%]" style={{ textShadow: "0 0 5px #ff007a, 0 2px 4px #000" }}>@{creatorProfile?.username || "Player A"}</span>
                            <span className="text-[10px] font-bold text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] truncate max-w-[45%] text-right" style={{ textShadow: "0 0 5px #00d1ff, 0 2px 4px #000" }}>@{battle.player_b?.username || "Player B"}</span>
                          </div>
                          {/* Score labels */}
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[9px] font-black text-[#ff007a] drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">{(battle.score_a || 0).toLocaleString()}</span>
                            <span className="text-[9px] font-black text-[#00d1ff] drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">{(battle.score_b || 0).toLocaleString()}</span>
                          </div>
                          {/* Progress bar */}
                          <div className="h-1.5 rounded-full overflow-hidden bg-black/40 backdrop-blur-sm flex">
                            <motion.div
                              className="h-full rounded-l-full"
                              style={{
                                background: "linear-gradient(90deg, #ff007a, #ff007a)",
                                boxShadow: "0 0 8px #ff007a80",
                              }}
                              initial={{ width: "50%" }}
                              animate={{ width: `${progressA}%` }}
                              transition={{ duration: 0.8, ease: "easeInOut" }}
                            />
                            <motion.div
                              className="h-full rounded-r-full"
                              style={{
                                background: "linear-gradient(90deg, #00d1ff, #00d1ff)",
                                boxShadow: "0 0 8px #00d1ff80",
                              }}
                              initial={{ width: "50%" }}
                              animate={{ width: `${100 - progressA}%` }}
                              transition={{ duration: 0.8, ease: "easeInOut" }}
                            />
                          </div>
                        </div>
                      </div>
                    </Link>

                    {/* ── Card Footer ── */}
                    <div className="p-2.5 flex items-center gap-2">
                      {/* Creator avatar */}
                      <div className="relative flex-shrink-0">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#ff007a] to-[#00d1ff] p-[1.5px]">
                          <div className="w-full h-full rounded-full bg-[#0a0a0a] flex items-center justify-center overflow-hidden">
                            {creatorProfile?.avatar_url ? (
                              <img
                                src={creatorProfile.avatar_url}
                                alt={creatorProfile.username}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <span className="text-[10px] font-black text-white/60">
                                {(creatorProfile?.username || "?")[0].toUpperCase()}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Title + Creator name */}
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-bold text-white/90 truncate leading-tight">
                          {battleTitle}
                        </p>
                        <p className="text-[9px] text-white/30 truncate">
                          @{creatorProfile?.username || "anon"}
                        </p>
                      </div>

                      {/* Follow button */}
                      {user && creatorId !== user.id && (
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            toggleFollow(creatorId);
                          }}
                          disabled={isFollowLoading}
                          className={`flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-300 ${
                            isFollowed
                              ? "bg-[#00d1ff]/15 text-[#00d1ff] border border-[#00d1ff]/20"
                              : "bg-[#ff007a]/15 text-[#ff007a] border border-[#ff007a]/20 hover:bg-[#ff007a]/25 hover:scale-110"
                          }`}
                        >
                          {isFollowLoading ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : isFollowed ? (
                            <Check size={12} />
                          ) : (
                            <Plus size={12} strokeWidth={3} />
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* ── Infinite scroll sentinel ── */}
      <div ref={sentinelRef} className="h-10" />

      {/* ── Loading more indicator ── */}
      {loadingMore && (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="animate-spin text-[#00d1ff]" size={24} />
        </div>
      )}

      {/* ── End of list ── */}
      {!hasMore && battles.length > 0 && (
        <div className="text-center py-6">
          <p className="text-white/15 text-[10px] font-bold uppercase tracking-widest">No hay más batallas</p>
        </div>
      )}
    </div>
  );
}