import { NextResponse } from "next/server";

// ── Prevent Next.js from statically pre-rendering this route at build time ──
export const dynamic = "force-dynamic";
export const runtime = "nodejs"; // ensure Node runtime (not Edge) for fetch + env vars

// ── Lazy Supabase client — only initialised at request time, never at build ──
function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Missing Supabase env vars: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  // Dynamic import to avoid any top-level side-effects during build
  const { createClient } = require("@supabase/supabase-js");
  return createClient(url, key);
}

/**
 * GET /api/bcv-rate
 *
 * Fetches the official USD/VES exchange rate and persists it
 * in the `app_config` Supabase table.
 *
 * Called by Vercel Cron 4× per day (vercel.json).
 * Also callable manually for testing.
 *
 * Auth: Requests from Vercel Cron will include the
 *       Authorization: Bearer <CRON_SECRET> header.
 */
export async function GET(request: Request): Promise<NextResponse> {
  // ── 1. Cron authentication (optional but recommended in production) ──
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  let rate: number | null = null;
  const errors: string[] = [];

  // ── 2a. Primary source: ExchangeRate-API (free, no key needed) ──
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD", {
      cache: "no-store",
      signal: AbortSignal.timeout(8000), // 8 s timeout
    });
    if (res.ok) {
      const json = await res.json();
      const ves = json?.rates?.VES;
      if (typeof ves === "number" && ves > 0) {
        rate = Math.round(ves * 100) / 100;
      } else {
        errors.push("ExchangeRate-API: VES rate missing in response");
      }
    } else {
      errors.push(`ExchangeRate-API: HTTP ${res.status}`);
    }
  } catch (err: any) {
    errors.push(`ExchangeRate-API: ${err?.message ?? String(err)}`);
  }

  // ── 2b. Fallback: pydolarve.org (Venezuelan reference rates) ──
  if (!rate) {
    try {
      const res = await fetch("https://pydolarve.org/api/v1/dollar?page=bcv", {
        cache: "no-store",
        signal: AbortSignal.timeout(8000),
      });
      if (res.ok) {
        const json = await res.json();
        const price = json?.price;
        if (typeof price === "number" && price > 0) {
          rate = Math.round(price * 100) / 100;
        } else {
          errors.push("pydolarve: price missing in response");
        }
      } else {
        errors.push(`pydolarve: HTTP ${res.status}`);
      }
    } catch (err: any) {
      errors.push(`pydolarve: ${err?.message ?? String(err)}`);
    }
  }

  // ── 2c. Second fallback: fixer.io-style endpoint ──
  if (!rate) {
    try {
      const res = await fetch(
        "https://api.frankfurter.app/latest?from=USD&to=VES",
        { cache: "no-store", signal: AbortSignal.timeout(8000) }
      );
      if (res.ok) {
        const json = await res.json();
        const ves = json?.rates?.VES;
        if (typeof ves === "number" && ves > 0) {
          rate = Math.round(ves * 100) / 100;
        } else {
          errors.push("Frankfurter: VES missing");
        }
      } else {
        errors.push(`Frankfurter: HTTP ${res.status}`);
      }
    } catch (err: any) {
      errors.push(`Frankfurter: ${err?.message ?? String(err)}`);
    }
  }

  // ── 3. All sources failed ──
  if (!rate) {
    console.error("[bcv-rate] All sources failed:", errors);
    return NextResponse.json(
      {
        error: "Could not fetch BCV rate from any source.",
        details: errors,
      },
      { status: 502 }
    );
  }

  // ── 4. Persist in Supabase ──
  try {
    const supabase = getSupabase();
    const { error: dbError } = await supabase.from("app_config").upsert(
      {
        key: "bcv_rate",
        value: rate.toString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" }
    );
    if (dbError) {
      console.error("[bcv-rate] Supabase upsert error:", dbError.message);
      // Still return the rate — don't fail the whole request because of a DB write
    }
  } catch (err: any) {
    console.error("[bcv-rate] Supabase init error:", err?.message ?? String(err));
  }

  console.log(`[bcv-rate] Updated: 1 USD = ${rate} VES`);

  return NextResponse.json({
    rate,
    updated_at: new Date().toISOString(),
    sources_tried: errors.length + 1,
  });
}
