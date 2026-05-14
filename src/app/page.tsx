"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

const AuthClient = dynamic(() => import("./AuthClient"), {
  ssr: false,
  loading: () => (
    <div className="flex-1 w-full h-full min-h-screen flex items-center justify-center bg-black">
      <Loader2 className="w-8 h-8 animate-spin text-[#ff007a]" />
    </div>
  ),
});

export default function AuthPage() {
  return <AuthClient />;
}
