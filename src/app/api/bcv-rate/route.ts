import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Supabase admin client (service role) – bypasses RLS
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/bcv-rate
 * Fetches the official USD/VES rate from ExchangeRate-API (free tier)
 * and persists it in the `app_config` table.
 *
 * Called by Vercel Cron 4× per day (see vercel.json).
 * Returns the current rate as JSON.
 */
export async function GET(request: Request) {
  // Protect cron calls in production
  const authHeader = request.headers.get("authorization");
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let rate: number | null = null;

  try {
    // ── Primary: ExchangeRate-API (free, no key needed for USD→VES) ──
    const res = await fetch(
      "https://open.er-api.com/v6/latest/USD",
      { next: { revalidate: 0 } }
    );
    if (res.ok) {
      const json = await res.json();
      rate = json?.rates?.VES ?? null;
    }
  } catch (_) {}

  // ── Fallback: pydolarve API (Venezuelan reference rates) ──
  if (!rate) {
    try {
      const res = await fetch("https://pydolarve.org/api/v1/dollar?page=bcv", {
        next: { revalidate: 0 },
      });
      if (res.ok) {
        const json = await res.json();
        rate = json?.price ?? null;
      }
    } catch (_) {}
  }

  if (!rate) {
    return NextResponse.json(
      { error: "Could not fetch BCV rate from any source." },
      { status: 502 }
    );
  }

  // Round to 2 decimal places
  rate = Math.round(rate * 100) / 100;

  // ── Persist in Supabase ──
  await supabase.from("app_config").upsert(
    { key: "bcv_rate", value: rate.toString(), updated_at: new Date().toISOString() },
    { onConflict: "key" }
  );

  return NextResponse.json({ rate, updated_at: new Date().toISOString() });
}
