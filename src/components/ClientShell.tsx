"use client";

import { useAuth } from "@/components/AuthProvider";
import { SplashScreen } from "@/components/SplashScreen";

export function ClientShell({ children }: { children: React.ReactNode }) {
  const { loading } = useAuth();

  if (loading) return <SplashScreen />;

  return <>{children}</>;
}
