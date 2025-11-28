'use client';

import dynamic from 'next/dynamic';

const GameWrapper = dynamic(
  () => import('@/components/game/GameWrapper'),
  { ssr: false }
);

const loadBugBlasterScene = async () => {
  const module = await import('@/games/bug-blaster/BugBlasterScene');
  return module.BugBlasterScene;
};

export default function BugBlasterPage() {
  return (
    <GameWrapper
      gameId="bug-blaster"
      gameName="BUG BLASTER"
      sceneLoader={loadBugBlasterScene}
      config={{
        width: 600,
        height: 600,
        backgroundColor: '#000000',
      }}
      showDPad={true}
      showAction={true}
      actionLabel="FIRE"
    />
  );
}
