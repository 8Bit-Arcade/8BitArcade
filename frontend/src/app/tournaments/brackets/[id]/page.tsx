// Server component wrapper — required for generateStaticParams with output: 'export'
import BracketTournamentPageClient from './BracketTournamentPageClient';

export function generateStaticParams() {
  return [];
}

export default function Page() {
  return <BracketTournamentPageClient />;
}
