export const dynamic = 'force-dynamic';
export const revalidate = 0;

import dynamicClient from "next/dynamic";
import { Loader2 } from "lucide-react";

const BattleClient = dynamicClient(() => import("./BattleClient"), { 
  ssr: false,
  loading: () => (
    <div className="flex-1 w-full h-full min-h-screen flex items-center justify-center bg-black">
      <Loader2 className="w-8 h-8 animate-spin text-[#ff007a]" />
    </div>
  ),
});

export default function ArenaPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <BattleClient params={params} />
  );
}
