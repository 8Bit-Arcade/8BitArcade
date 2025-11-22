'use client';

import dynamic from 'next/dynamic';

// Dynamically import to avoid SSR issues with Phaser
const GameWrapper = dynamic(
  () => import('@/components/game/GameWrapper'),
  { ssr: false }
);

const SpaceRocksScene = dynamic(
  () => import('@/games/space-rocks/SpaceRocksScene').then((mod) => mod.default),
  { ssr: false }
);

export default function SpaceRocksPage() {
  return (
    <GameWrapper
      gameId="space-rocks"
      gameName="SPACE ROCKS"
      GameScene={SpaceRocksScene as any}
      config={{
        width: 800,
        height: 600,
        backgroundColor: '#0a0a0a',
      }}
      showDPad={true}
      showAction={true}
      actionLabel="FIRE"
    />
  );
}
