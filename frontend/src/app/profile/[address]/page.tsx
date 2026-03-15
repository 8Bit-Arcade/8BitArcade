// Server component wrapper — required for generateStaticParams with output: 'export'
import PlayerProfilePageClient from './PlayerProfilePageClient';

export function generateStaticParams() {
  return [];
}

export default function Page() {
  return <PlayerProfilePageClient />;
}
