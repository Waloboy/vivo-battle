"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Send, ArrowLeft, Loader2, MessageCircle, Circle } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface Conversation {
  user_id: string;
  username: string;
  avatar_url: string | null;
  last_message: string;
  last_time: string;
  unread: number;
}

interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  is_read: boolean;
  created_at: string;
}

export default function MessagesPage() {
  const [user, setUser] = useState<any>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeChat, setActiveChat] = useState<string | null>(null);
  const [activeChatUser, setActiveChatUser] = useState<{ username: string; avatar_url: string | null } | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMsg, setNewMsg] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ── Init ──
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUser(user);
      await loadConversations(user.id);
      setLoading(false);
    })();
  }, []);

  // ── Load conversations ──
  const loadConversations = async (userId: string) => {
    // Get all messages involving the user
    const { data: msgs } = await supabase
      .from("messages")
      .select("*")
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
      .order("created_at", { ascending: false });

    if (!msgs) return;

    // Group by conversation partner
    const convMap = new Map<string, { last_message: string; last_time: string; unread: number }>();
    for (const msg of msgs) {
      const partnerId = msg.sender_id === userId ? msg.receiver_id : msg.sender_id;
      if (!convMap.has(partnerId)) {
        convMap.set(partnerId, {
          last_message: msg.content,
          last_time: msg.created_at,
          unread: (!msg.is_read && msg.receiver_id === userId) ? 1 : 0,
        });
      } else {
        const existing = convMap.get(partnerId)!;
        if (!msg.is_read && msg.receiver_id === userId) {
          existing.unread += 1;
        }
      }
    }

    // Fetch profiles for all partners
    const partnerIds = Array.from(convMap.keys());
    if (partnerIds.length === 0) {
      setConversations([]);
      return;
    }

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, username, avatar_url")
      .in("id", partnerIds);

    const convs: Conversation[] = partnerIds.map((pid) => {
      const profile = profiles?.find((p: any) => p.id === pid);
      const data = convMap.get(pid)!;
      return {
        user_id: pid,
        username: profile?.username || "???",
        avatar_url: profile?.avatar_url || null,
        ...data,
      };
    });

    // Sort by last message time
    convs.sort((a, b) => new Date(b.last_time).getTime() - new Date(a.last_time).getTime());
    setConversations(convs);
  };

  // ── Open chat ──
  const openChat = async (partnerId: string, partnerUsername: string, partnerAvatar: string | null) => {
    setActiveChat(partnerId);
    setActiveChatUser({ username: partnerUsername, avatar_url: partnerAvatar });

    // Load messages for this conversation
    const { data: msgs } = await supabase
      .from("messages")
      .select("*")
      .or(`and(sender_id.eq.${user.id},receiver_id.eq.${partnerId}),and(sender_id.eq.${partnerId},receiver_id.eq.${user.id})`)
      .order("created_at", { ascending: true });

    setMessages(msgs || []);

    // Mark unread messages as read
    await supabase
      .from("messages")
      .update({ is_read: true })
      .eq("sender_id", partnerId)
      .eq("receiver_id", user.id)
      .eq("is_read", false);

    // Update conversation unread count locally
    setConversations(prev => prev.map(c =>
      c.user_id === partnerId ? { ...c, unread: 0 } : c
    ));

    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  };

  // ── Realtime messages ──
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`messages-realtime-listener`)
      .on("system", { event: "reconnect" }, () => console.log("Reconnected to messages"))
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const msg = payload.new as Message;
          const isMine = msg.sender_id === user.id;
          const isForMe = msg.receiver_id === user.id;

          if (!isMine && !isForMe) return;

          const isRelevantChat = activeChat && ((isMine && msg.receiver_id === activeChat) || (isForMe && msg.sender_id === activeChat));

          if (isRelevantChat) {
            setMessages(prev => {
              if (prev.some(m => m.id === msg.id)) return prev;
              return [...prev, msg];
            });

            if (isForMe) {
              supabase.from("messages").update({ is_read: true }).eq("id", msg.id);
            }

            setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
          } else {
            // Reload conversations if we received a message but aren't in that chat
            loadConversations(user.id);
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, activeChat, supabase]);

  // ── Send message ──
  const sendMessage = async () => {
    if (!newMsg.trim() || !activeChat || !user || sending) return;
    setSending(true);

    const msgContent = newMsg.trim();
    setNewMsg("");

    // Optimistic add
    const tempMsg: Message = {
      id: `temp-${Date.now()}`,
      sender_id: user.id,
      receiver_id: activeChat,
      content: msgContent,
      is_read: false,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, tempMsg]);
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);

    const { data, error } = await supabase
      .from("messages")
      .insert({
        sender_id: user.id,
        receiver_id: activeChat,
        content: msgContent,
      })
      .select()
      .single();

    if (data) {
      // Replace temp message with real one
      setMessages(prev => prev.map(m => m.id === tempMsg.id ? data : m));
    }

    // Refresh conversations list
    await loadConversations(user.id);
    setSending(false);
  };

  // ── Search users ──
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const timeout = setTimeout(async () => {
      setSearching(true);
      const { data } = await supabase
        .from("profiles")
        .select("id, username, avatar_url")
        .ilike("username", `%${searchQuery}%`)
        .neq("id", user?.id || "")
        .limit(5);

      setSearchResults(data || []);
      setSearching(false);
    }, 300);

    return () => clearTimeout(timeout);
  }, [searchQuery, user, supabase]);

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "ahora";
    if (diffMin < 60) return `${diffMin}m`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `${diffH}h`;
    return d.toLocaleDateString("es-VE", { day: "numeric", month: "short" });
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="animate-spin text-[#ff007a]" size={36} />
      </div>
    );
  }

  // ── Active Chat View ──
  if (activeChat && activeChatUser) {
    return (
      <div className="flex-1 flex flex-col max-w-2xl w-full mx-auto">
        {/* Chat Header */}
        <div className="px-4 py-3 border-b border-white/5 flex items-center gap-3 bg-black/30 backdrop-blur-md sticky top-16 z-10">
          <button
            onClick={() => { setActiveChat(null); setActiveChatUser(null); setMessages([]); }}
            className="p-2 rounded-xl hover:bg-white/5 transition-colors"
          >
            <ArrowLeft size={20} className="text-white/60" />
          </button>
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#ff007a] to-[#00d1ff] p-[1.5px]">
            <div className="w-full h-full rounded-full bg-[#0a0a0a] flex items-center justify-center overflow-hidden">
              {activeChatUser.avatar_url ? (
                <img src={activeChatUser.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-xs font-black text-white/50">{activeChatUser.username[0].toUpperCase()}</span>
              )}
            </div>
          </div>
          <div>
            <p className="text-sm font-bold text-white">@{activeChatUser.username}</p>
            <p className="text-[10px] text-white/30">Mensaje directo</p>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <MessageCircle size={40} className="text-white/10 mb-3" />
              <p className="text-white/25 text-sm">Envía el primer mensaje</p>
            </div>
          )}
          {messages.map((msg) => {
            const isMine = msg.sender_id === user.id;
            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex ${isMine ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm ${
                    isMine
                      ? "bg-gradient-to-r from-[#ff007a]/20 to-[#ff007a]/10 border border-[#ff007a]/15 text-white rounded-br-md"
                      : "bg-white/[0.04] border border-white/5 text-white/80 rounded-bl-md"
                  }`}
                >
                  <p className="break-words">{msg.content}</p>
                  <p className={`text-[9px] mt-1 ${isMine ? "text-[#ff007a]/40 text-right" : "text-white/20"}`}>
                    {formatTime(msg.created_at)}
                  </p>
                </div>
              </motion.div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="px-4 py-3 border-t border-white/5 bg-black/30 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newMsg}
              onChange={(e) => setNewMsg(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              placeholder="Escribe un mensaje..."
              className="flex-1 bg-white/[0.04] border border-white/10 rounded-2xl px-4 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-[#ff007a]/30 transition-colors"
            />
            <button
              onClick={sendMessage}
              disabled={!newMsg.trim() || sending}
              className="p-2.5 bg-[#ff007a] disabled:opacity-20 rounded-xl text-white transition-all hover:shadow-[0_0_15px_rgba(255,0,122,0.3)]"
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Conversations List View ──
  return (
    <div className="flex-1 max-w-2xl w-full mx-auto px-4 py-4 md:py-6">
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-2xl font-black tracking-tight">
          <span className="text-gradient">Mensajes</span>
        </h1>
        <p className="text-white/30 text-xs mt-1">Coordina batallas con otros usuarios</p>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Buscar usuario..."
          className="w-full bg-white/[0.03] border border-white/5 rounded-2xl pl-11 pr-4 py-3 text-sm text-white placeholder-white/20 focus:outline-none focus:border-[#00d1ff]/30 transition-colors"
        />

        {/* Search Results */}
        <AnimatePresence>
          {searchResults.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="absolute top-full left-0 right-0 mt-2 bg-[#0d0d0d] border border-white/10 rounded-2xl overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.8)] z-20"
            >
              {searchResults.map((r) => (
                <button
                  key={r.id}
                  onClick={() => {
                    openChat(r.id, r.username, r.avatar_url);
                    setSearchQuery("");
                    setSearchResults([]);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/[0.04] transition-colors border-b border-white/5 last:border-0"
                >
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#ff007a] to-[#00d1ff] p-[1px]">
                    <div className="w-full h-full rounded-full bg-[#0a0a0a] flex items-center justify-center overflow-hidden">
                      {r.avatar_url ? (
                        <img src={r.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-[10px] font-black text-white/50">{r.username[0].toUpperCase()}</span>
                      )}
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-white">@{r.username}</span>
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Conversations */}
      {conversations.length === 0 && !searchQuery ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-full bg-white/[0.03] border border-white/10 flex items-center justify-center mb-4">
            <MessageCircle size={28} className="text-white/15" />
          </div>
          <h3 className="text-base font-bold text-white/40 mb-1">Sin mensajes</h3>
          <p className="text-white/20 text-xs max-w-xs">Busca un usuario arriba para iniciar una conversación</p>
        </div>
      ) : (
        <div className="space-y-1">
          {conversations.map((conv) => (
            <motion.button
              key={conv.user_id}
              whileTap={{ scale: 0.98 }}
              onClick={() => openChat(conv.user_id, conv.username, conv.avatar_url)}
              className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-white/[0.03] transition-all border border-transparent hover:border-white/5"
            >
              {/* Avatar */}
              <div className="relative flex-shrink-0">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#ff007a] to-[#00d1ff] p-[1.5px]">
                  <div className="w-full h-full rounded-full bg-[#0a0a0a] flex items-center justify-center overflow-hidden">
                    {conv.avatar_url ? (
                      <img src={conv.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-sm font-black text-white/50">{conv.username[0].toUpperCase()}</span>
                    )}
                  </div>
                </div>
                {conv.unread > 0 && (
                  <div className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-[#ff007a] rounded-full flex items-center justify-center">
                    <span className="text-[8px] font-black text-white">{conv.unread > 9 ? "9+" : conv.unread}</span>
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 text-left">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold text-white truncate">@{conv.username}</p>
                  <span className="text-[10px] text-white/20 flex-shrink-0 ml-2">{formatTime(conv.last_time)}</span>
                </div>
                <p className={`text-xs truncate mt-0.5 ${conv.unread > 0 ? "text-white/60 font-medium" : "text-white/25"}`}>
                  {conv.last_message}
                </p>
              </div>
            </motion.button>
          ))}
        </div>
      )}
    </div>
  );
}
