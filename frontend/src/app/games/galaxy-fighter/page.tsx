'use client';

import dynamic from 'next/dynamic';

const GameWrapper = dynamic(
  () => import('@/components/game/GameWrapper'),
  { ssr: false }
);

const loadGalaxyFighterScene = async () => {
  const module = await import('@/games/galaxy-fighter/GalaxyFighterScene');
  return module.GalaxyFighterScene;
};

export default function GalaxyFighterPage() {
  return (
    <GameWrapper
      gameId="galaxy-fighter"
      gameName="GALAXY FIGHTER"
      sceneLoader={loadGalaxyFighterScene}
      config={{
        width: 800,
        height: 600,
        backgroundColor: '#000000',
      }}
      showDPad={true}
      showAction={true}
      actionLabel="FIRE"
    />
  );
}
