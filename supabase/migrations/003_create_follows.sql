-- Migration: Create follows table for the follow system
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.follows (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  follower_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  followed_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(follower_id, followed_id)
);

-- Enable RLS
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;

-- Users can view all follows (needed for follower counts)
CREATE POLICY "Anyone can view follows."
  ON public.follows FOR SELECT USING (true);

-- Users can insert their own follows
CREATE POLICY "Users can follow others."
  ON public.follows FOR INSERT WITH CHECK (auth.uid() = follower_id);

-- Users can unfollow (delete their own follows)
CREATE POLICY "Users can unfollow."
  ON public.follows FOR DELETE USING (auth.uid() = follower_id);

-- Index for fast lookups
CREATE INDEX idx_follows_follower ON public.follows(follower_id);
CREATE INDEX idx_follows_followed ON public.follows(followed_id);
