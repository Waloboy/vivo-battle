"use client";

import { useAuth } from "@/components/AuthProvider";
import { SplashScreen } from "@/components/SplashScreen";
import { usePathname } from "next/navigation";

export function ClientShell({ children }: { children: React.ReactNode }) {
  const { loading, user, profile } = useAuth();
  const pathname = usePathname();

  // The landing/login page (/) should never be blocked
  const isPublicPage = pathname === "/";

  // Show splash if auth is still loading — UNLESS we're on the public page
  if (loading && !isPublicPage) return <SplashScreen />;

  // If auth resolved but we have a user without a profile yet,
  // keep showing splash so we never render zeros / fake usernames
  if (!loading && user && !profile && !isPublicPage) return <SplashScreen />;

  return <>{children}</>;
}
