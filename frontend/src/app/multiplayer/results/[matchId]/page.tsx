// Server component wrapper — required for generateStaticParams with output: 'export'
import MatchResultsPageClient from './MatchResultsPageClient';

export function generateStaticParams() {
  return [];
}

export default function Page() {
  return <MatchResultsPageClient />;
}
