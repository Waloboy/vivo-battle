import { createClient } from "./supabase/client";

/**
 * Calcula el balance consolidado del usuario basándose estrictamente
 * en el historial de transacciones aprobadas.
 * 
 * Lógica: SUM(Ingresos) - SUM(Egresos)
 * Ingresos: deposit, gift, bonus, manual_adjustment
 * Egresos: withdrawal
 */
export async function getUserBalance(userId: string): Promise<number> {
  const supabase = createClient();
  
  const { data: txns, error } = await supabase
    .from("transactions")
    .select("type, amount_credits, status")
    .eq("user_id", userId)
    .eq("status", "approved");

  if (error || !txns) {
    console.error("Error calculating balance:", error);
    return 0;
  }

  const incomeTypes = ["deposit", "gift", "bonus", "manual_adjustment"];
  const expenseTypes = ["withdrawal"];

  const balance = txns.reduce((acc, txn) => {
    const amount = txn.amount_credits || 0;
    if (incomeTypes.includes(txn.type)) {
      return acc + amount;
    }
    if (expenseTypes.includes(txn.type)) {
      return acc - amount;
    }
    return acc;
  }, 0);

  return balance;
}
