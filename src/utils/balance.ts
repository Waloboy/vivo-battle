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

  const { data: txns, error } = await supabase
    .from("transactions")
    .select("type, amount_credits, status")
    .eq("user_id", userId)
    .eq("status", "approved");

  if (error || !txns) {
    console.error("Error calculating dual balance:", error);
    return { wallet_credits: 0, battle_credits: 0, total: 0 };
  }

  let wallet_credits = 0;
  let battle_credits = 0;

  for (const txn of txns) {
    const amount = txn.amount_credits || 0;
    switch (txn.type) {
      case "deposit":
      case "manual_adjustment":
        wallet_credits += amount;
        break;
      case "gift":
        // gift transactions have negative amount_credits for the sender
        wallet_credits += amount;
        break;
      case "withdrawal":
        // withdrawal amount is positive — subtract from battle_credits first
        battle_credits -= amount;
        break;
      case "battle_win":
      case "bonus":
        battle_credits += amount;
        break;
    }
  }

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
