'use client';

import dynamic from 'next/dynamic';

// Dynamically import GameWrapper to avoid SSR issues with Phaser
const GameWrapper = dynamic(
  () => import('@/components/game/GameWrapper'),
  { ssr: false }
);

// Scene loader function - loads the scene class on demand
const loadPixelSnakeScene = async () => {
  const module = await import('@/games/pixel-snake/PixelSnakeScene');
  return module.default;
};

export default function PixelSnakePage() {
  return (
    <GameWrapper
      gameId="pixel-snake"
      gameName="PIXEL SNAKE"
      sceneLoader={loadPixelSnakeScene}
      config={{
        width: 600,
        height: 600,
        backgroundColor: '#0a0a0a',
      }}
      showDPad={true}
      showAction={false}
      actionLabel=""
    />
  );
}
