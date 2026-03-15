// Server component wrapper — required for generateStaticParams with output: 'export'
import MatchRoomPageClient from './MatchRoomPageClient';

export async function generateStaticParams() {
  return [] as { matchId: string }[];
}

export default function Page() {
  return <MatchRoomPageClient />;
}
