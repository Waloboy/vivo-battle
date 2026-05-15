export const dynamic = 'force-dynamic';
export const revalidate = 0;

import BattleClient from "./BattleClient";

export default function ArenaPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <BattleClient params={params} />
  );
}
