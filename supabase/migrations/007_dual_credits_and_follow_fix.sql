-- =============================================
-- Migration 007: Dual Credits System + Follow Table Fix
-- Run this in Supabase SQL Editor
-- =============================================

-- ═══════════════════════════════════════════════
-- 1. CREATE the correct `follow` table
--    Code uses: follow_id (who follows) / following_id (who is followed)
-- ═══════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.follow (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  follow_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  following_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(follow_id, following_id)
);

ALTER TABLE public.follow ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Anyone can view follow." ON public.follow;
CREATE POLICY "Anyone can view follow."
  ON public.follow FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can follow others." ON public.follow;
CREATE POLICY "Users can follow others."
  ON public.follow FOR INSERT WITH CHECK (auth.uid() = follow_id);

DROP POLICY IF EXISTS "Users can unfollow." ON public.follow;
CREATE POLICY "Users can unfollow."
  ON public.follow FOR DELETE USING (auth.uid() = follow_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_follow_follow_id ON public.follow(follow_id);
CREATE INDEX IF NOT EXISTS idx_follow_following_id ON public.follow(following_id);

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.follow;


-- ═══════════════════════════════════════════════
-- 2. ADD battle tracking columns to transactions
--    For detailed battle history (opponent, battle reference)
-- ═══════════════════════════════════════════════

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS opponent_id UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS battle_id UUID REFERENCES public.battles(id);

-- Index for fast battle history lookups
CREATE INDEX IF NOT EXISTS idx_transactions_battle ON public.transactions(battle_id);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON public.transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_user_type ON public.transactions(user_id, type);


-- ═══════════════════════════════════════════════
-- 3. (OPTIONAL) Migrate data from old `follows` table
--    Run only if you previously ran migration 003
-- ═══════════════════════════════════════════════

-- INSERT INTO public.follow (follow_id, following_id, created_at)
-- SELECT follower_id, followed_id, created_at FROM public.follows
-- ON CONFLICT (follow_id, following_id) DO NOTHING;
