import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabaseAuth = await createServerClient();
  const { data: { user } } = await supabaseAuth.auth.getUser();
  
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabaseAuth.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    // 1. Fetch pending
    const { data: pendingData, error: pendingError } = await supabaseAdmin
      .from("transactions")
      .select("*, profiles(username, bank_name, id_card, phone_number)")
      .in("type", ["DEPOSIT", "WITHDRAW"])
      .in("status", ["pending", "PENDING"])
      .order("created_at", { ascending: false });

    if (pendingError) throw pendingError;

    // 2. Fetch resolved (recent 100)
    const { data: resolvedData, error: resolvedError } = await supabaseAdmin
      .from("transactions")
      .select("*, profiles(username, bank_name, id_card, phone_number)")
      .in("type", ["DEPOSIT", "WITHDRAW"])
      .not("status", "in", '("pending", "PENDING")')
      .order("created_at", { ascending: false })
      .limit(100);

    if (resolvedError) throw resolvedError;

    const combined = [...(pendingData || []), ...(resolvedData || [])];
    combined.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return NextResponse.json({ data: combined });
  } catch (error: any) {
    console.error("Admin API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
