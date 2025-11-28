'use client';

import dynamic from 'next/dynamic';

const GameWrapper = dynamic(
  () => import('@/components/game/GameWrapper'),
  { ssr: false }
);

const loadTunnelTerrorScene = async () => {
  const module = await import('@/games/tunnel-terror/TunnelTerrorScene');
  return module.TunnelTerrorScene;
};

export default function TunnelTerrorPage() {
  return (
    <GameWrapper
      gameId="tunnel-terror"
      gameName="TUNNEL TERROR"
      sceneLoader={loadTunnelTerrorScene}
      config={{
        width: 600,
        height: 480,
        backgroundColor: '#0a0a0a',
      }}
      showDPad={true}
      showAction={true}
      actionLabel="PUMP"
    />
  );
}
