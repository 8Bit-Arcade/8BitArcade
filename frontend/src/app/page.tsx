'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import Button from '@/components/ui/Button';
import GameCarousel from '@/components/game/GameCarousel';
import GameGrid, { GameCategory } from '@/components/game/GameGrid';
import { formatNumber } from '@/lib/utils';

// Games data - playable marks which games are implemented
// Thumbnails go in: /public/games/{game-id}.png
const GAMES = [
  {
    id: 'space-rocks',
    name: 'Space Rocks',
    description: 'Destroy asteroids and UFOs in deep space',
    difficulty: 'medium' as const,
    thumbnail: '/games/space-rocks.png',
    playable: true,
    category: 'shooter' as GameCategory,
  },
  {
    id: 'alien-assault',
    name: 'Alien Assault',
    description: 'Defend Earth from alien invaders',
    difficulty: 'easy' as const,
    thumbnail: '/games/alien-assault.png',
    playable: true,
    category: 'shooter' as GameCategory,
  },
  {
    id: 'brick-breaker',
    name: 'Brick Breaker',
    description: 'Break all the bricks with your paddle',
    difficulty: 'easy' as const,
    thumbnail: '/games/brick-breaker.png',
    playable: true,
    category: 'arcade' as GameCategory,
  },
  {
    id: 'pixel-snake',
    name: 'Pixel Snake',
    description: 'Eat food and grow without hitting yourself',
    difficulty: 'easy' as const,
    thumbnail: '/games/pixel-snake.png',
    playable: true,
    category: 'arcade' as GameCategory,
  },
  {
    id: 'bug-blaster',
    name: 'Bug Blaster',
    description: 'Blast the centipede before it reaches you',
    difficulty: 'hard' as const,
    thumbnail: '/games/bug-blaster.png',
    playable: false,
    category: 'shooter' as GameCategory,
  },
  {
    id: 'chomper',
    name: 'Chomper',
    description: 'Eat all the dots, avoid the ghosts',
    difficulty: 'medium' as const,
    thumbnail: '/games/chomper.png',
    playable: false,
    category: 'arcade' as GameCategory,
  },
  {
    id: 'tunnel-terror',
    name: 'Tunnel Terror',
    description: 'Dig tunnels and defeat underground enemies',
    difficulty: 'medium' as const,
    thumbnail: '/games/tunnel-terror.png',
    playable: false,
    category: 'action' as GameCategory,
  },
  {
    id: 'galaxy-fighter',
    name: 'Galaxy Fighter',
    description: 'Take on waves of alien fighters',
    difficulty: 'medium' as const,
    thumbnail: '/games/galaxy-fighter.png',
    playable: false,
    category: 'shooter' as GameCategory,
  },
  {
    id: 'road-hopper',
    name: 'Road Hopper',
    description: 'Cross the road and river safely',
    difficulty: 'easy' as const,
    thumbnail: '/games/road-hopper.png',
    playable: false,
    category: 'action' as GameCategory,
  },
  {
    id: 'barrel-dodge',
    name: 'Barrel Dodge',
    description: 'Climb to the top while dodging barrels',
    difficulty: 'hard' as const,
    thumbnail: '/games/barrel-dodge.png',
    playable: false,
    category: 'action' as GameCategory,
  },
  {
    id: 'block-drop',
    name: 'Block Drop',
    description: 'Stack falling blocks to clear lines',
    difficulty: 'medium' as const,
    thumbnail: '/games/block-drop.png',
    playable: false,
    category: 'puzzle' as GameCategory,
  },
  {
    id: 'paddle-battle',
    name: 'Paddle Battle',
    description: 'Classic pong against the CPU',
    difficulty: 'easy' as const,
    thumbnail: '/games/paddle-battle.png',
    playable: false,
    category: 'arcade' as GameCategory,
  },
];

// Featured games for the carousel (playable games first)
const FEATURED_GAMES = GAMES.filter((g) => g.playable).concat(
  GAMES.filter((g) => !g.playable).slice(0, 2)
);

// Placeholder leaderboard data
const TOP_PLAYERS = [
  { rank: 1, username: 'CryptoKing', score: 1250000 },
  { rank: 2, username: 'ArcadePro', score: 1180000 },
  { rank: 3, username: 'RetroMaster', score: 1095000 },
  { rank: 4, username: 'PixelHunter', score: 980000 },
  { rank: 5, username: 'GameWizard', score: 875000 },
];

// Placeholder tournament data
const ACTIVE_TOURNAMENT = {
  name: 'Weekly Championship',
  prizePool: 50000,
  endsIn: '2d 14h',
  participants: 128,
};

// Static placeholder leaderboard data for games (no Firebase dependency)
const GAME_LEADERBOARDS: { [gameId: string]: { rank: number; username: string; score: number }[] } = {
  'space-rocks': [
    { rank: 1, username: 'AstroAce', score: 125000 },
    { rank: 2, username: 'StarBlaster', score: 118500 },
    { rank: 3, username: 'NebulaNinja', score: 112000 },
  ],
  'alien-assault': [
    { rank: 1, username: 'DefenderX', score: 95000 },
    { rank: 2, username: 'GalacticHero', score: 88000 },
    { rank: 3, username: 'InvaderSlayer', score: 82500 },
  ],
  'brick-breaker': [
    { rank: 1, username: 'BrickMaster', score: 78000 },
    { rank: 2, username: 'PaddlePro', score: 71000 },
    { rank: 3, username: 'BreakKing', score: 65000 },
  ],
  'pixel-snake': [
    { rank: 1, username: 'SnakeLord', score: 45000 },
    { rank: 2, username: 'SlitherKing', score: 42000 },
    { rank: 3, username: 'CoilMaster', score: 38500 },
  ],
};

export default function HomePage() {
  const { isConnected } = useAccount();
  const [selectedGame, setSelectedGame] = useState(0);

  // Handle game selection from grid (maps to full GAMES array index)
  const handleGridSelect = (index: number) => {
    // Find the game in FEATURED_GAMES or scroll to it
    const game = GAMES[index];
    const featuredIndex = FEATURED_GAMES.findIndex((g) => g.id === game.id);
    if (featuredIndex >= 0) {
      setSelectedGame(featuredIndex);
      // Scroll to carousel
      document.getElementById('featured-carousel')?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative py-8 md:py-12 overflow-hidden">
        {/* Background Grid */}
        <div className="absolute inset-0 bg-grid-pattern bg-grid opacity-20" />

        <div className="relative max-w-7xl mx-auto px-4">
          <div className="text-center mb-8">
       //     <h1 className="font-pixel text-3xl md:text-5xl text-arcade-green glow-green mb-4">
       //       8-BIT ARCADE
       //     </h1>
            <p className="font-arcade text-xl md:text-2xl text-gray-300 mb-6">
              Play the Classic 8-Bit Video Games You know and Love and Make Real Money! Compete Globally. Earn 8BIT Tokens.
            </p>
            {!isConnected && (
              <div className="flex justify-center">
                <ConnectButton />
              </div>
            )}
          </div>

          {/* Featured Game Carousel */}
          <div id="featured-carousel" className="relative mb-8">
     //       <h2 className="font-pixel text-arcade-cyan text-sm mb-6 text-center">
     //         FEATURED GAMES
     //       </h2>

            <GameCarousel
              games={FEATURED_GAMES}
              selectedIndex={selectedGame}
              onSelectGame={setSelectedGame}
              leaderboards={GAME_LEADERBOARDS}
            />

            {/* Selected Game Actions */}
            <div className="mt-8 text-center">
              <h3 className="font-pixel text-arcade-green text-xl mb-2 glow-green">
                {FEATURED_GAMES[selectedGame].name}
              </h3>
              <p className="font-arcade text-gray-400 mb-4 max-w-md mx-auto">
                {FEATURED_GAMES[selectedGame].description}
              </p>
              {!FEATURED_GAMES[selectedGame].playable && (
                <p className="font-pixel text-arcade-yellow text-xs mb-4 animate-pulse">
                  COMING SOON
                </p>
              )}
              <div className="flex justify-center gap-4 flex-wrap">
                {FEATURED_GAMES[selectedGame].playable ? (
                  <>
                    <Link href={`/games/${FEATURED_GAMES[selectedGame].id}`}>
                      <Button variant="secondary" size="lg">Free Play</Button>
                    </Link>
                    {isConnected ? (
                      <Link href={`/games/${FEATURED_GAMES[selectedGame].id}`}>
                        <Button variant="primary" size="lg">Play Ranked</Button>
                      </Link>
                    ) : (
                      <Button variant="primary" size="lg" disabled>
                        Connect to Play Ranked
                      </Button>
                    )}
                  </>
                ) : (
                  <Button variant="secondary" size="lg" disabled>
                    Coming Soon
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* All Games Section */}
      <section className="py-12 bg-arcade-dark/30">
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="font-pixel text-arcade-green text-sm mb-6 text-center">
            ALL GAMES
          </h2>
          <GameGrid games={GAMES} onSelectGame={handleGridSelect} />
        </div>
      </section>

      {/* Stats & Info Section */}
      <section className="py-12 bg-arcade-dark/50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid md:grid-cols-3 gap-6">
            {/* Leaderboard Preview */}
            <div className="card-arcade">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-pixel text-arcade-green text-xs uppercase">
                  Top Players
                </h3>
                <Link
                  href="/leaderboard"
                  className="font-arcade text-xs text-arcade-cyan hover:underline"
                >
                  View All
                </Link>
              </div>
              <div className="space-y-2">
                {TOP_PLAYERS.map((player) => (
                  <div
                    key={player.rank}
                    className="flex items-center justify-between py-2 border-b border-arcade-green/10 last:border-0"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`
                          font-pixel text-xs w-6
                          ${player.rank === 1 ? 'text-arcade-yellow' : ''}
                          ${player.rank === 2 ? 'text-gray-300' : ''}
                          ${player.rank === 3 ? 'text-arcade-orange' : ''}
                          ${player.rank > 3 ? 'text-gray-500' : ''}
                        `}
                      >
                        {player.rank}
                      </span>
                      <span className="font-arcade text-white">
                        {player.username}
                      </span>
                    </div>
                    <span className="font-arcade text-arcade-green">
                      {formatNumber(player.score)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Active Tournament */}
            <div className="card-arcade">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-pixel text-arcade-pink text-xs uppercase">
                  Active Tournament
                </h3>
                <span className="font-arcade text-xs text-arcade-yellow animate-pulse">
                  LIVE
                </span>
              </div>
              <div className="text-center py-4">
                <h4 className="font-pixel text-white text-sm mb-2">
                  {ACTIVE_TOURNAMENT.name}
                </h4>
                <div className="font-arcade text-arcade-cyan text-2xl mb-2">
                  {formatNumber(ACTIVE_TOURNAMENT.prizePool)} 8BIT
                </div>
                <p className="font-arcade text-gray-400 text-sm mb-4">
                  {ACTIVE_TOURNAMENT.participants} players competing
                </p>
                <div className="flex items-center justify-center gap-2 mb-4">
                  <span className="font-arcade text-gray-500">Ends in:</span>
                  <span className="font-pixel text-arcade-red">
                    {ACTIVE_TOURNAMENT.endsIn}
                  </span>
                </div>
                <Link href="/tournaments">
                  <Button variant="secondary" size="sm">
                    View Tournament
                  </Button>
                </Link>
              </div>
            </div>

            {/* Token Info */}
            <div className="card-arcade">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-pixel text-arcade-yellow text-xs uppercase">
                  8BIT Token
                </h3>
                <span className="font-arcade text-xs text-gray-500">
                  Arbitrum
                </span>
              </div>
              <div className="space-y-4">
                <div className="flex justify-between">
                  <span className="font-arcade text-gray-400">Play to Earn</span>
                  <span className="font-arcade text-arcade-green">
                    Daily Rewards
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="font-arcade text-gray-400">Tournaments</span>
                  <span className="font-arcade text-arcade-green">
                    Win Prizes
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="font-arcade text-gray-400">Top 100</span>
                  <span className="font-arcade text-arcade-green">
                    Share Rewards Pool
                  </span>
                </div>
                <hr className="border-arcade-green/20" />
                <div className="text-center">
                  <p className="font-arcade text-xs text-gray-500 mb-2">
                    Connect wallet to view balance
                  </p>
                  {!isConnected && (
                    <ConnectButton.Custom>
                      {({ openConnectModal }) => (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={openConnectModal}
                        >
                          Connect Wallet
                        </Button>
                      )}
                    </ConnectButton.Custom>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-12">
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="font-pixel text-arcade-green text-sm text-center mb-8">
            HOW IT WORKS
          </h2>
          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-6">
            {[
              {
                step: '01',
                title: 'Connect',
                desc: 'Link your wallet to start',
              },
              {
                step: '02',
                title: 'Play',
                desc: 'Choose a game and compete',
              },
              {
                step: '03',
                title: 'Rank',
                desc: 'Climb the leaderboards',
              },
              {
                step: '04',
                title: 'Earn',
                desc: 'Claim your 8BIT rewards',
              },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="font-pixel text-3xl text-arcade-cyan mb-2">
                  {item.step}
                </div>
                <h3 className="font-pixel text-arcade-green text-xs uppercase mb-2">
                  {item.title}
                </h3>
                <p className="font-arcade text-gray-400">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
