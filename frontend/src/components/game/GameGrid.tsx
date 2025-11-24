'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useAccount } from 'wagmi';
import Button from '@/components/ui/Button';

export type GameCategory = 'all' | 'shooter' | 'arcade' | 'puzzle' | 'action';

interface Game {
  id: string;
  name: string;
  description: string;
  difficulty: 'easy' | 'medium' | 'hard';
  thumbnail: string | null;
  playable: boolean;
  category: GameCategory;
}

interface GameGridProps {
  games: Game[];
  onSelectGame: (index: number) => void;
}

const CATEGORIES: { value: GameCategory; label: string }[] = [
  { value: 'all', label: 'All Games' },
  { value: 'shooter', label: 'Shooters' },
  { value: 'arcade', label: 'Arcade' },
  { value: 'puzzle', label: 'Puzzle' },
  { value: 'action', label: 'Action' },
];

export default function GameGrid({ games, onSelectGame }: GameGridProps) {
  const { isConnected } = useAccount();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<GameCategory>('all');
  const [hoveredGame, setHoveredGame] = useState<string | null>(null);

  const filteredGames = useMemo(() => {
    return games.filter((game) => {
      const matchesSearch = game.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        game.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === 'all' || game.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [games, searchQuery, selectedCategory]);

  const difficultyColors = {
    easy: 'bg-arcade-green/20 text-arcade-green border-arcade-green/30',
    medium: 'bg-arcade-yellow/20 text-arcade-yellow border-arcade-yellow/30',
    hard: 'bg-arcade-red/20 text-arcade-red border-arcade-red/30',
  };

  return (
    <div className="space-y-6">
      {/* Search and Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Search Input */}
        <div className="relative flex-1">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            placeholder="Search games..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-arcade-dark border border-arcade-green/30 rounded-lg font-arcade text-white placeholder-gray-500 focus:outline-none focus:border-arcade-green transition-colors"
          />
        </div>

        {/* Category Filter */}
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.value}
              onClick={() => setSelectedCategory(cat.value)}
              className={`
                px-4 py-2 font-pixel text-xs uppercase whitespace-nowrap rounded-lg border transition-all
                ${selectedCategory === cat.value
                  ? 'bg-arcade-green text-arcade-black border-arcade-green'
                  : 'bg-transparent text-arcade-green border-arcade-green/30 hover:border-arcade-green/60'
                }
              `}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Results Count */}
      <div className="flex items-center justify-between">
        <span className="font-arcade text-sm text-gray-400">
          {filteredGames.length} {filteredGames.length === 1 ? 'game' : 'games'} found
        </span>
      </div>

      {/* Games Grid */}
      {filteredGames.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {filteredGames.map((game) => {
            const originalIndex = games.findIndex((g) => g.id === game.id);
            const isHovered = hoveredGame === game.id;

            return (
              <div
                key={game.id}
                className="group relative"
                onMouseEnter={() => setHoveredGame(game.id)}
                onMouseLeave={() => setHoveredGame(null)}
              >
                <div
                  onClick={() => onSelectGame(originalIndex)}
                  className={`
                    bg-arcade-dark border border-arcade-green/30 rounded-lg overflow-hidden cursor-pointer
                    transition-all duration-300
                    ${isHovered ? 'border-arcade-green shadow-lg shadow-arcade-green/20 scale-105' : ''}
                  `}
                >
                  {/* Thumbnail */}
                  <div className="aspect-[4/3] relative overflow-hidden">
                    {game.thumbnail ? (
                      <img
                        src={game.thumbnail}
                        alt={game.name}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-arcade-dark to-arcade-black">
                        <span className="font-pixel text-3xl text-arcade-green/20">?</span>
                      </div>
                    )}

                    {/* Status Badges */}
                    <div className="absolute top-1.5 right-1.5 flex gap-1">
                      {!game.playable && (
                        <span className="px-1.5 py-0.5 bg-arcade-yellow/90 rounded font-pixel text-[10px] text-black">
                          SOON
                        </span>
                      )}
                    </div>

                    {/* Difficulty Badge */}
                    <div className="absolute bottom-1.5 left-1.5">
                      <span className={`px-1.5 py-0.5 rounded font-pixel text-[10px] uppercase border ${difficultyColors[game.difficulty]}`}>
                        {game.difficulty}
                      </span>
                    </div>
                  </div>

                  {/* Game Name */}
                  <div className="p-2">
                    <h4 className="font-pixel text-arcade-green text-[10px] uppercase truncate group-hover:glow-green">
                      {game.name}
                    </h4>
                  </div>
                </div>

                {/* Hover Popup */}
                {isHovered && (
                  <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-64 p-4 bg-arcade-dark border border-arcade-green rounded-lg shadow-xl z-50 hidden md:block">
                    <h4 className="font-pixel text-arcade-green text-sm mb-2">{game.name}</h4>
                    <p className="font-arcade text-gray-400 text-xs mb-3">{game.description}</p>
                    <div className="flex gap-2">
                      {game.playable ? (
                        <>
                          <Link href={`/games/${game.id}`} className="flex-1">
                            <Button variant="secondary" size="sm" className="w-full text-[10px]">
                              Free Play
                            </Button>
                          </Link>
                          {isConnected ? (
                            <Link href={`/games/${game.id}`} className="flex-1">
                              <Button variant="primary" size="sm" className="w-full text-[10px]">
                                Ranked
                              </Button>
                            </Link>
                          ) : (
                            <Button variant="primary" size="sm" className="flex-1 text-[10px]" disabled>
                              Connect
                            </Button>
                          )}
                        </>
                      ) : (
                        <Button variant="secondary" size="sm" className="w-full text-[10px]" disabled>
                          Coming Soon
                        </Button>
                      )}
                    </div>
                    {/* Arrow pointing down */}
                    <div className="absolute left-1/2 -translate-x-1/2 -bottom-2 w-4 h-4 bg-arcade-dark border-r border-b border-arcade-green rotate-45" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-12">
          <span className="font-pixel text-4xl text-arcade-green/20 block mb-4">:(</span>
          <p className="font-arcade text-gray-400">No games found matching your search.</p>
          <button
            onClick={() => {
              setSearchQuery('');
              setSelectedCategory('all');
            }}
            className="mt-4 font-arcade text-arcade-cyan hover:underline"
          >
            Clear filters
          </button>
        </div>
      )}
    </div>
  );
}
