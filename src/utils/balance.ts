import { createClient } from "./supabase/client";

/**
 * Dual Credit System for VIVO Battle
 *
 * WCR (Wallet Credits) — from deposits. Used to buy gifts.
 *   Income:  deposit, manual_adjustment
 *   Expense: gift (negative amount_credits), withdrawal
 *
 * BCR (Battle Credits) — from battle wins. Withdrawable earnings.
 *   Income:  battle_win, bonus
 */

export interface DualBalance {
  wallet_credits: number;   // WCR
  battle_credits: number;   // BCR
  total: number;
}

export async function getDualBalance(userId: string): Promise<DualBalance> {
  const supabase = createClient();

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("wallet_credits, battle_credits")
    .eq("id", userId)
    .single();

  if (error || !profile) {
    console.error("Error fetching dual balance from profile:", error);
    return { wallet_credits: 0, battle_credits: 0, total: 0 };
  }

  const wallet_credits = profile.wallet_credits || 0;
  const battle_credits = profile.battle_credits || 0;

  return {
    wallet_credits: Math.max(0, wallet_credits),
    battle_credits: Math.max(0, battle_credits),
    total: Math.max(0, wallet_credits) + Math.max(0, battle_credits),
  };
}

/** Backward-compat: returns total balance (WCR + BCR) */
export async function getUserBalance(userId: string): Promise<number> {
  const dual = await getDualBalance(userId);
  return dual.total;
}

/** Returns only wallet credits (for gift purchases) */
export async function getWalletCredits(userId: string): Promise<number> {
  const dual = await getDualBalance(userId);
  return dual.wallet_credits;
}

/** Returns only battle credits (for withdrawals) */
export async function getBattleCredits(userId: string): Promise<number> {
  const dual = await getDualBalance(userId);
  return dual.battle_credits;
}
