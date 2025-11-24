'use client';

import dynamic from 'next/dynamic';

// Dynamically import GameWrapper to avoid SSR issues with Phaser
const GameWrapper = dynamic(
  () => import('@/components/game/GameWrapper'),
  { ssr: false }
);

// Scene loader function - loads the scene class on demand
const loadBrickBreakerScene = async () => {
  const module = await import('@/games/brick-breaker/BrickBreakerScene');
  return module.default;
};

export default function BrickBreakerPage() {
  return (
    <GameWrapper
      gameId="brick-breaker"
      gameName="BRICK BREAKER"
      sceneLoader={loadBrickBreakerScene}
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
