'use client';

import dynamic from 'next/dynamic';

// Dynamically import GameWrapper to avoid SSR issues with Phaser
const GameWrapper = dynamic(
  () => import('@/components/game/GameWrapper'),
  { ssr: false }
);

// Scene loader function - loads the scene class on demand
const loadSpaceRocksScene = async () => {
  const module = await import('@/games/space-rocks/SpaceRocksScene');
  return module.default;
};

export default function SpaceRocksPage() {
  return (
    <GameWrapper
      gameId="space-rocks"
      gameName="SPACE ROCKS"
      sceneLoader={loadSpaceRocksScene}
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
