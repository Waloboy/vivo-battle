-- =============================================
-- Migration 004: Challenges & Direct Messages
-- Run this in Supabase SQL Editor
-- =============================================

-- 1. Challenges Table
CREATE TABLE IF NOT EXISTS public.challenges (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  challenger_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  challenged_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  status TEXT DEFAULT 'pending' NOT NULL CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
  battle_id UUID REFERENCES public.battles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  resolved_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view challenges involving them."
  ON public.challenges FOR SELECT
  USING (auth.uid() = challenger_id OR auth.uid() = challenged_id);

CREATE POLICY "Users can create challenges."
  ON public.challenges FOR INSERT
  WITH CHECK (auth.uid() = challenger_id);

CREATE POLICY "Users can update challenges they received."
  ON public.challenges FOR UPDATE
  USING (auth.uid() = challenged_id OR auth.uid() = challenger_id);

CREATE INDEX idx_challenges_challenged ON public.challenges(challenged_id, status);
CREATE INDEX idx_challenges_challenger ON public.challenges(challenger_id, status);

-- 2. Direct Messages Table
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  sender_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  receiver_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own messages."
  ON public.messages FOR SELECT
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "Users can send messages."
  ON public.messages FOR INSERT
  WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Users can mark messages as read."
  ON public.messages FOR UPDATE
  USING (auth.uid() = receiver_id);

CREATE INDEX idx_messages_receiver ON public.messages(receiver_id, created_at);
CREATE INDEX idx_messages_sender ON public.messages(sender_id, created_at);
CREATE INDEX idx_messages_conversation ON public.messages(
  LEAST(sender_id, receiver_id),
  GREATEST(sender_id, receiver_id),
  created_at DESC
);

-- 3. Matchmaking Queue Table
CREATE TABLE IF NOT EXISTS public.matchmaking_queue (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE NOT NULL,
  status TEXT DEFAULT 'searching' NOT NULL CHECK (status IN ('searching', 'matched')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.matchmaking_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view queue."
  ON public.matchmaking_queue FOR SELECT USING (true);

CREATE POLICY "Users can join queue."
  ON public.matchmaking_queue FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can leave queue."
  ON public.matchmaking_queue FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own queue status."
  ON public.matchmaking_queue FOR UPDATE
  USING (auth.uid() = user_id);

-- 4. Enable Realtime for messages and challenges
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.challenges;

-- 5. Add battles to realtime publication (if not already)
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.battles;
