'use client';

import dynamic from 'next/dynamic';

const GameWrapper = dynamic(
  () => import('@/components/game/GameWrapper'),
  { ssr: false }
);

const BrickBreakerScene = dynamic(
  () => import('@/games/brick-breaker/BrickBreakerScene').then((mod) => mod.default),
  { ssr: false }
);

export default function BrickBreakerPage() {
  return (
    <GameWrapper
      gameId="brick-breaker"
      gameName="BRICK BREAKER"
      GameScene={BrickBreakerScene as any}
      config={{
        width: 800,
        height: 600,
        backgroundColor: '#0a0a0a',
      }}
      showDPad={true}
      showAction={true}
      actionLabel="LAUNCH"
    />
  );
}
