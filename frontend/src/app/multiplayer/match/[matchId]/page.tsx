// Server component wrapper — required for generateStaticParams with output: 'export'
import MatchRoomPageClient from './MatchRoomPageClient';

export function generateStaticParams() {
  return [];
}

export default function Page() {
  return <MatchRoomPageClient />;
}
