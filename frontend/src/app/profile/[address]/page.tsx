// Server component wrapper — required for generateStaticParams with output: 'export'
import PlayerProfilePageClient from './PlayerProfilePageClient';

export async function generateStaticParams() {
  return [] as { address: string }[];
}

export default function Page() {
  return <PlayerProfilePageClient />;
}
