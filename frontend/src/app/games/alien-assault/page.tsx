'use client';

import dynamic from 'next/dynamic';

const GameWrapper = dynamic(
  () => import('@/components/game/GameWrapper'),
  { ssr: false }
);

const AlienAssaultScene = dynamic(
  () => import('@/games/alien-assault/AlienAssaultScene').then((mod) => mod.default),
  { ssr: false }
);

export default function AlienAssaultPage() {
  return (
    <GameWrapper
      gameId="alien-assault"
      gameName="ALIEN ASSAULT"
      GameScene={AlienAssaultScene as any}
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
