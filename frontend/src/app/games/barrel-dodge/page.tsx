'use client';

import dynamic from 'next/dynamic';

const GameWrapper = dynamic(
  () => import('@/components/game/GameWrapper'),
  { ssr: false }
);

const loadBarrelDodgeScene = async () => {
  const module = await import('@/games/barrel-dodge/BarrelDodgeScene');
  return module.BarrelDodgeScene;
};

export default function BarrelDodgePage() {
  return (
    <GameWrapper
      gameId="barrel-dodge"
      gameName="BARREL DODGE"
      sceneLoader={loadBarrelDodgeScene}
      config={{
        width: 600,
        height: 600,
        backgroundColor: '#000000',
      }}
      showDPad={true}
      showAction={true}
      actionLabel="HAMMER"
    />
  );
}
