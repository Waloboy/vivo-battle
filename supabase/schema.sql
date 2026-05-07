-- Supabase Schema for VIVO BATTLE

-- 1. Profiles
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Wallets (Credits)
CREATE TABLE public.wallets (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE NOT NULL,
  balance INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Transactions (Recharges via Pago Móvil)
CREATE TYPE transaction_status AS ENUM ('pending', 'approved', 'rejected');

CREATE TABLE public.transactions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  amount_credits INTEGER NOT NULL,
  amount_bs DECIMAL(10,2) NOT NULL,
  reference_number TEXT NOT NULL,
  bank_name TEXT NOT NULL,
  status transaction_status DEFAULT 'pending' NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  resolved_at TIMESTAMP WITH TIME ZONE
);

-- 4. Battles (1vs1 Matches)
CREATE TABLE public.battles (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  player_a_id UUID REFERENCES public.profiles(id) NOT NULL,
  player_b_id UUID REFERENCES public.profiles(id) NOT NULL,
  score_a INTEGER DEFAULT 0 NOT NULL,
  score_b INTEGER DEFAULT 0 NOT NULL,
  is_active BOOLEAN DEFAULT true NOT NULL,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  ended_at TIMESTAMP WITH TIME ZONE
);

-- Security Policies (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.battles ENABLE ROW LEVEL SECURITY;

-- Allow public read of profiles
CREATE POLICY "Public profiles are viewable by everyone."
  ON public.profiles FOR SELECT USING (true);

-- Allow users to update their own profile
CREATE POLICY "Users can insert their own profile."
  ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile."
  ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Wallets: only owner can read
CREATE POLICY "Users can view own wallet."
  ON public.wallets FOR SELECT USING (auth.uid() = user_id);

-- Transactions: owner can read their own, insert their own.
CREATE POLICY "Users can view own transactions."
  ON public.transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own transactions."
  ON public.transactions FOR INSERT WITH CHECK (auth.uid() = user_id);
