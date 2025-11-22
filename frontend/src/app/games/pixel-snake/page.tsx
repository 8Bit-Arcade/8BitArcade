'use client';

import dynamic from 'next/dynamic';

const GameWrapper = dynamic(
  () => import('@/components/game/GameWrapper'),
  { ssr: false }
);

const PixelSnakeScene = dynamic(
  () => import('@/games/pixel-snake/PixelSnakeScene').then((mod) => mod.default),
  { ssr: false }
);

export default function PixelSnakePage() {
  return (
    <GameWrapper
      gameId="pixel-snake"
      gameName="PIXEL SNAKE"
      GameScene={PixelSnakeScene as any}
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
