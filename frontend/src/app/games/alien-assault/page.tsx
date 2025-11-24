'use client';

import dynamic from 'next/dynamic';

// Dynamically import GameWrapper to avoid SSR issues with Phaser
const GameWrapper = dynamic(
  () => import('@/components/game/GameWrapper'),
  { ssr: false }
);

// Scene loader function - loads the scene class on demand
const loadAlienAssaultScene = async () => {
  const module = await import('@/games/alien-assault/AlienAssaultScene');
  return module.default;
};

export default function AlienAssaultPage() {
  return (
    <GameWrapper
      gameId="alien-assault"
      gameName="ALIEN ASSAULT"
      sceneLoader={loadAlienAssaultScene}
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
