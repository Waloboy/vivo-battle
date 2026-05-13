"use client";

import { Loader2 } from "lucide-react";
import { SafeHydrate } from "@/components/SafeHydrate";
import dynamic from "next/dynamic";

const DashboardClient = dynamic(() => import("./DashboardClient"), {
  ssr: false,
  loading: () => (
    <div className="flex-1 w-full h-full min-h-screen flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-[#ff007a]" />
    </div>
  ),
});

const Fallback = () => (
  <div className="flex-1 w-full h-full min-h-screen flex items-center justify-center">
    <Loader2 className="w-8 h-8 animate-spin text-[#ff007a]" />
  </div>
);

export default function DashboardPage() {
  return (
    <SafeHydrate fallback={<Fallback />}>
      <DashboardClient />
    </SafeHydrate>
  );
}