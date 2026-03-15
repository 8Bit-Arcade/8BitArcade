// Server component wrapper — required for generateStaticParams with output: 'export'
import MatchResultsPageClient from './MatchResultsPageClient';

export async function generateStaticParams() {
  return [] as { matchId: string }[];
}

export default function Page() {
  return <MatchResultsPageClient />;
}
