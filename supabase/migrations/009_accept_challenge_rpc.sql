-- =============================================
-- Migration 009: accept_challenge_v2 RPC
-- Run this in Supabase SQL Editor
-- =============================================

CREATE OR REPLACE FUNCTION public.accept_challenge_v2(p_challenge_id UUID, p_user_id UUID)
RETURNS UUID AS $$
DECLARE
  v_challenger_id UUID;
  v_battle_id UUID;
  v_status TEXT;
  v_wallet_credits NUMERIC;
  v_battle_credits NUMERIC;
BEGIN
  -- 1. Check if challenge exists and is pending
  SELECT challenger_id, status INTO v_challenger_id, v_status
  FROM public.challenges
  WHERE id = p_challenge_id AND challenged_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reto no encontrado o no autorizado.';
  END IF;

  IF v_status != 'pending' THEN
    RAISE EXCEPTION 'El reto ya fue procesado: %', v_status;
  END IF;

  -- 2. Verify balances (Ensuring profile exists and locking row if necessary)
  SELECT wallet_credits, battle_credits INTO v_wallet_credits, v_battle_credits
  FROM public.profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Perfil de usuario no encontrado.';
  END IF;

  -- 3. Create the battle
  INSERT INTO public.battles (player_a_id, player_b_id, is_active)
  VALUES (v_challenger_id, p_user_id, true)
  RETURNING id INTO v_battle_id;

  -- 4. Mark challenge as accepted
  UPDATE public.challenges
  SET status = 'accepted', battle_id = v_battle_id, resolved_at = now()
  WHERE id = p_challenge_id;

  -- Return the new battle_id
  RETURN v_battle_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
