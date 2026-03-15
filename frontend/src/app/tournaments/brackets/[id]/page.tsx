// Server component wrapper — required for generateStaticParams with output: 'export'
import BracketTournamentPageClient from './BracketTournamentPageClient';

export async function generateStaticParams() {
  return [] as { id: string }[];
}

export default function Page() {
  return <BracketTournamentPageClient />;
}
