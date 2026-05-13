"use client";

import { useState, useEffect, type ReactNode } from "react";

/**
 * SafeHydrate — returns null on the server, renders children only after mount.
 * Wrap any component that touches browser APIs (Supabase, LiveKit, window, etc.)
 * to permanently kill React Error #418.
 */
export function SafeHydrate({ children, fallback }: { children: ReactNode; fallback?: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return fallback ?? null;
  return <>{children}</>;
}
