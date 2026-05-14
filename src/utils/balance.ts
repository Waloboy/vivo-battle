import { createClient } from "./supabase/client";

/**
 * Dual Credit System for ARENA 58
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
  const cacheKey = `vivo_balance_${userId}`;
  let cached: DualBalance | null = null;
  
  if (typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem(cacheKey);
      if (stored) cached = JSON.parse(stored);
    } catch (e) {
      console.warn("Failed to parse cached balance", e);
    }
  }

  const supabase = createClient();
  let retries = 3;
  let profile = null;
  let error = null;

  while (retries > 0) {
    const fetchPromise = supabase
      .from("profiles")
      .select("wallet_credits, battle_credits")
      .eq("id", userId)
      .single();

    const timeoutPromise = new Promise<{ data: any, error: any }>((resolve) => 
      setTimeout(() => resolve({ data: null, error: new Error("Supabase timeout") }), 15000)
    );

    const result = await Promise.race([fetchPromise, timeoutPromise]);
    profile = result.data;
    error = result.error;

    if (!error && profile) break;
    
    console.warn(`[Balance Fetch] Attempt failed. Retries left: ${retries - 1}`, error);
    retries--;
    if (retries > 0) await new Promise(r => setTimeout(r, 1000)); // wait 1s before retry
  }

  try {
    if (error || !profile) {
      console.error("Error fetching dual balance from profile after retries:", error);
      if (cached) return cached;
      return { wallet_credits: 0, battle_credits: 0, total: 0 };
    }

    const wallet_credits = profile.wallet_credits || 0;
    const battle_credits = profile.battle_credits || 0;

    const result = {
      wallet_credits: Math.max(0, wallet_credits),
      battle_credits: Math.max(0, battle_credits),
      total: Math.max(0, wallet_credits) + Math.max(0, battle_credits),
    };

    if (typeof window !== "undefined") {
      localStorage.setItem(cacheKey, JSON.stringify(result));
    }

    return result;
  } catch (err) {
    console.error("Exception fetching dual balance:", err);
    if (cached) return cached;
    return { wallet_credits: 0, battle_credits: 0, total: 0 };
  }
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
