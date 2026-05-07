-- Run this in the Supabase SQL Editor
-- Creates the app_config table used to store BCV rate and other settings

CREATE TABLE IF NOT EXISTS public.app_config (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed initial BCV rate (will be overwritten by cron)
INSERT INTO public.app_config (key, value)
VALUES ('bcv_rate', '0')
ON CONFLICT (key) DO NOTHING;

-- RLS: public read, only service role can write
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "app_config: anyone can read"
  ON public.app_config FOR SELECT
  USING (true);

-- Only service role (backend) can upsert — no user-facing write policy needed
