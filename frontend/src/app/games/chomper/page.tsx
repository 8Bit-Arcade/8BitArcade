'use client';

import dynamic from 'next/dynamic';

const GameWrapper = dynamic(
  () => import('@/components/game/GameWrapper'),
  { ssr: false }
);

const loadChomperScene = async () => {
  const module = await import('@/games/chomper/ChomperScene');
  return module.ChomperScene;
};

export default function ChomperPage() {
  return (
    <GameWrapper
      gameId="chomper"
      gameName="CHOMPER"
      sceneLoader={loadChomperScene}
      config={{
        width: 672,
        height: 720,
        backgroundColor: '#000000',
      }}
      showDPad={true}
      showAction={false}
    />
  );
}
