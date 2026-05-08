-- =============================================
-- Migration 005: Fix Battles RLS & Challenges
-- Run this in Supabase SQL Editor
-- =============================================

-- 1. Ensure battle_id exists in challenges table
ALTER TABLE public.challenges 
ADD COLUMN IF NOT EXISTS battle_id UUID REFERENCES public.battles(id);

-- 2. Add RLS Policies for Battles (so users can create and view them)
-- Drop existing policies if they exist to avoid errors
DROP POLICY IF EXISTS "Public battles are viewable by everyone." ON public.battles;
DROP POLICY IF EXISTS "Users can insert battles." ON public.battles;
DROP POLICY IF EXISTS "Users can update own battles." ON public.battles;

-- Allow anyone to view battles
CREATE POLICY "Public battles are viewable by everyone."
  ON public.battles FOR SELECT USING (true);

-- Allow users to create battles if they are one of the players
CREATE POLICY "Users can insert battles."
  ON public.battles FOR INSERT 
  WITH CHECK (auth.uid() = player_a_id OR auth.uid() = player_b_id);

-- Allow users to update their own battles
CREATE POLICY "Users can update own battles."
  ON public.battles FOR UPDATE 
  USING (auth.uid() = player_a_id OR auth.uid() = player_b_id);

-- Make sure RLS is enabled
ALTER TABLE public.battles ENABLE ROW LEVEL SECURITY;

-- 3. Ensure Realtime is enabled for battles
ALTER PUBLICATION supabase_realtime ADD TABLE public.battles;
