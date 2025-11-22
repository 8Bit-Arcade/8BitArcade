'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import Button from '@/components/ui/Button';
import { GameCard } from '@/components/ui/Card';
import { formatNumber } from '@/lib/utils';

// Placeholder games data - will come from Firebase
const GAMES = [
  {
    id: 'space-rocks',
    name: 'Space Rocks',
    description: 'Destroy asteroids and UFOs in deep space',
    difficulty: 'medium' as const,
    thumbnail: null,
  },
  {
    id: 'alien-assault',
    name: 'Alien Assault',
    description: 'Defend Earth from alien invaders',
    difficulty: 'easy' as const,
    thumbnail: null,
  },
  {
    id: 'bug-blaster',
    name: 'Bug Blaster',
    description: 'Blast the centipede before it reaches you',
    difficulty: 'hard' as const,
    thumbnail: null,
  },
  {
    id: 'chomper',
    name: 'Chomper',
    description: 'Eat all the dots, avoid the ghosts',
    difficulty: 'medium' as const,
    thumbnail: null,
  },
  {
    id: 'tunnel-terror',
    name: 'Tunnel Terror',
    description: 'Dig tunnels and defeat underground enemies',
    difficulty: 'medium' as const,
    thumbnail: null,
  },
  {
    id: 'galaxy-fighter',
    name: 'Galaxy Fighter',
    description: 'Take on waves of alien fighters',
    difficulty: 'medium' as const,
    thumbnail: null,
  },
  {
    id: 'road-hopper',
    name: 'Road Hopper',
    description: 'Cross the road and river safely',
    difficulty: 'easy' as const,
    thumbnail: null,
  },
  {
    id: 'barrel-dodge',
    name: 'Barrel Dodge',
    description: 'Climb to the top while dodging barrels',
    difficulty: 'hard' as const,
    thumbnail: null,
  },
  {
    id: 'brick-breaker',
    name: 'Brick Breaker',
    description: 'Break all the bricks with your paddle',
    difficulty: 'easy' as const,
    thumbnail: null,
  },
  {
    id: 'pixel-snake',
    name: 'Pixel Snake',
    description: 'Eat food and grow without hitting yourself',
    difficulty: 'easy' as const,
    thumbnail: null,
  },
  {
    id: 'block-drop',
    name: 'Block Drop',
    description: 'Stack falling blocks to clear lines',
    difficulty: 'medium' as const,
    thumbnail: null,
  },
  {
    id: 'paddle-battle',
    name: 'Paddle Battle',
    description: 'Classic pong against the CPU',
    difficulty: 'easy' as const,
    thumbnail: null,
  },
];

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

export default function HomePage() {
  const { isConnected } = useAccount();
  const [selectedGame, setSelectedGame] = useState(0);

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative py-12 md:py-20 overflow-hidden">
        {/* Background Grid */}
        <div className="absolute inset-0 bg-grid-pattern bg-grid opacity-20" />

        <div className="relative max-w-7xl mx-auto px-4">
          <div className="text-center mb-12">
            <h1 className="font-pixel text-3xl md:text-5xl text-arcade-green glow-green mb-4">
              8-BIT ARCADE
            </h1>
            <p className="font-arcade text-xl md:text-2xl text-gray-300 mb-6">
              Play Classic Games. Compete Globally. Earn 8BIT Tokens.
            </p>

            {!isConnected && (
              <div className="flex justify-center">
                <ConnectButton />
              </div>
            )}
          </div>

          {/* Game Carousel */}
          <div className="relative mb-12">
            <h2 className="font-pixel text-arcade-cyan text-sm mb-4 text-center">
              SELECT YOUR GAME
            </h2>

            {/* Game Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {GAMES.map((game, index) => (
                <div
                  key={game.id}
                  onClick={() => setSelectedGame(index)}
                  className={`
                    cursor-pointer transition-all duration-300
                    ${selectedGame === index ? 'scale-105 z-10' : 'opacity-70 hover:opacity-100'}
                  `}
                >
                  <GameCard
                    title={game.name}
                    thumbnail={game.thumbnail || undefined}
                    difficulty={game.difficulty}
                  />
                </div>
              ))}
            </div>

            {/* Selected Game Actions */}
            <div className="mt-8 text-center">
              <h3 className="font-pixel text-arcade-green text-lg mb-2">
                {GAMES[selectedGame].name}
              </h3>
              <p className="font-arcade text-gray-400 mb-4">
                {GAMES[selectedGame].description}
              </p>
              <div className="flex justify-center gap-4 flex-wrap">
                <Link href={`/games/${GAMES[selectedGame].id}?mode=free`}>
                  <Button variant="secondary">Free Play</Button>
                </Link>
                {isConnected ? (
                  <Link href={`/games/${GAMES[selectedGame].id}?mode=ranked`}>
                    <Button variant="primary">Play Ranked</Button>
                  </Link>
                ) : (
                  <Button variant="primary" disabled>
                    Connect to Play Ranked
                  </Button>
                )}
              </div>
            </div>
          </div>
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
