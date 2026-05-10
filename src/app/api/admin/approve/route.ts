import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const supabaseAuth = await createServerClient();
    const { data: { user } } = await supabaseAuth.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: profile } = await supabaseAuth.from("profiles").select("role").eq("id", user.id).single();
    if (profile?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await req.json();
    const { transaction_id, user_id, amount_credits, action } = body;

    if (!transaction_id || !user_id || typeof amount_credits !== "number" || !action) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("Missing Supabase configuration. URL present:", !!supabaseUrl, "Key present:", !!supabaseServiceKey);
      return NextResponse.json(
        { error: "Server configuration error: SUPABASE_SERVICE_ROLE_KEY is missing in environment variables." },
        { status: 500 }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    if (action === "approve") {
      // 1. Mark as approved
      const { error: txErr } = await supabaseAdmin.from("transactions").update({ 
        status: "approved", 
        resolved_at: new Date().toISOString() 
      }).eq("id", transaction_id);

      if (txErr) throw txErr;

      // 2. Fetch transaction type
      const { data: txn } = await supabaseAdmin.from("transactions").select("type").eq("id", transaction_id).single();

      // 3. If deposit, add to wallet_credits
      if (txn && (txn.type === "DEPOSIT" || txn.type === "deposit" || txn.type === "DEPOSIT_PENDING")) {
        const { data: prof, error: profErr } = await supabaseAdmin.from("profiles").select("wallet_credits").eq("id", user_id).single();
        if (profErr) throw profErr;

        const newBalance = (prof.wallet_credits || 0) + amount_credits;
        const { error: updateErr } = await supabaseAdmin.from("profiles").update({
          wallet_credits: newBalance
        }).eq("id", user_id);

        if (updateErr) throw updateErr;
      }

      return NextResponse.json({ success: true, message: "Transaction approved" });

    } else if (action === "reject") {
      const { error: txErr } = await supabaseAdmin.from("transactions").update({ 
        status: "rejected", 
        resolved_at: new Date().toISOString() 
      }).eq("id", transaction_id);
      
      if (txErr) throw txErr;

      const { data: txn } = await supabaseAdmin.from("transactions").select("type").eq("id", transaction_id).single();

      // If withdrawal rejected, refund BCR
      if (txn && (txn.type === "WITHDRAW" || txn.type === "withdrawal")) {
        const { data: prof } = await supabaseAdmin.from("profiles").select("battle_credits").eq("id", user_id).single();
        if (prof) {
          await supabaseAdmin.from("profiles").update({
            battle_credits: (prof.battle_credits || 0) + amount_credits
          }).eq("id", user_id);
        }
      }

      return NextResponse.json({ success: true, message: "Transaction rejected" });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });

  } catch (error: any) {
    console.error("Admin Approve API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
