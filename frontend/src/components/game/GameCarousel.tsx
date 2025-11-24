'use client';

import { useRef, useState, useEffect, useCallback } from 'react';

// Define TopPlayer locally to avoid Firebase import chain
interface TopPlayer {
  rank: number;
  username: string;
  score: number;
}

interface Game {
  id: string;
  name: string;
  description: string;
  difficulty: 'easy' | 'medium' | 'hard';
  thumbnail: string | null;
  playable: boolean;
}

interface GameCarouselProps {
  games: Game[];
  selectedIndex: number;
  onSelectGame: (index: number) => void;
  leaderboards: { [gameId: string]: TopPlayer[] };
}

export default function GameCarousel({
  games,
  selectedIndex,
  onSelectGame,
  leaderboards,
}: GameCarouselProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isAnimating, setIsAnimating] = useState(false);

  const navigate = useCallback((direction: 'prev' | 'next') => {
    if (isAnimating) return;

    setIsAnimating(true);
    const newIndex = direction === 'next'
      ? (selectedIndex + 1) % games.length
      : (selectedIndex - 1 + games.length) % games.length;

    onSelectGame(newIndex);
    setTimeout(() => setIsAnimating(false), 400);
  }, [selectedIndex, games.length, onSelectGame, isAnimating]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') navigate('prev');
      if (e.key === 'ArrowRight') navigate('next');
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate]);

  // Touch/swipe handling
  const touchStartX = useRef(0);
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) {
      navigate(diff > 0 ? 'next' : 'prev');
    }
  };

  const getVisibleGames = () => {
    const prev = (selectedIndex - 1 + games.length) % games.length;
    const next = (selectedIndex + 1) % games.length;
    return [
      { game: games[prev], position: 'left', index: prev },
      { game: games[selectedIndex], position: 'center', index: selectedIndex },
      { game: games[next], position: 'right', index: next },
    ];
  };

  const difficultyColors = {
    easy: 'text-arcade-green',
    medium: 'text-arcade-yellow',
    hard: 'text-arcade-red',
  };

  const rankColors = ['text-yellow-400', 'text-gray-300', 'text-orange-400'];

  return (
    <div className="relative">
      {/* Navigation Arrows */}
      <button
        onClick={() => navigate('prev')}
        className="absolute left-0 md:left-4 top-1/2 -translate-y-1/2 z-30 w-10 h-10 md:w-12 md:h-12 flex items-center justify-center bg-arcade-dark/90 border border-arcade-green/50 rounded-full text-arcade-green hover:bg-arcade-green/20 hover:border-arcade-green transition-all duration-200"
        aria-label="Previous game"
      >
        <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      <button
        onClick={() => navigate('next')}
        className="absolute right-0 md:right-4 top-1/2 -translate-y-1/2 z-30 w-10 h-10 md:w-12 md:h-12 flex items-center justify-center bg-arcade-dark/90 border border-arcade-green/50 rounded-full text-arcade-green hover:bg-arcade-green/20 hover:border-arcade-green transition-all duration-200"
        aria-label="Next game"
      >
        <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>

      {/* Carousel Container */}
      <div
        ref={containerRef}
        className="relative flex items-center justify-center gap-4 md:gap-6 px-12 md:px-20 py-4 overflow-hidden"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {getVisibleGames().map(({ game, position, index }) => {
          const topPlayers = leaderboards[game.id] || [];
          const isCenter = position === 'center';

          return (
            <div
              key={`${game.id}-${position}`}
              onClick={() => !isCenter && onSelectGame(index)}
              className={`
                flex-shrink-0 cursor-pointer
                transition-all duration-400 ease-out
                ${isCenter
                  ? 'w-72 md:w-96 scale-100 opacity-100 z-20'
                  : 'w-32 md:w-48 scale-90 opacity-50 hover:opacity-70 z-10'
                }
              `}
              style={{
                transform: isCenter ? 'scale(1)' : 'scale(0.85)',
                transition: 'all 0.4s cubic-bezier(0.25, 0.1, 0.25, 1)',
              }}
            >
              <div
                className={`
                  bg-arcade-dark border-2 rounded-lg overflow-hidden
                  transition-all duration-400
                  ${isCenter
                    ? 'border-arcade-green shadow-xl shadow-arcade-green/30'
                    : 'border-arcade-green/20'
                  }
                `}
              >
                {/* Thumbnail */}
                <div className={`relative overflow-hidden ${isCenter ? 'aspect-video' : 'aspect-[4/3]'}`}>
                  {game.thumbnail ? (
                    <img
                      src={game.thumbnail}
                      alt={game.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-arcade-dark to-arcade-black">
                      <span className={`font-pixel text-arcade-green/20 ${isCenter ? 'text-6xl' : 'text-3xl'}`}>?</span>
                    </div>
                  )}

                  {/* Coming Soon Badge */}
                  {!game.playable && isCenter && (
                    <div className="absolute top-2 right-2 px-2 py-1 bg-arcade-yellow/90 rounded">
                      <span className="font-pixel text-xs text-black">SOON</span>
                    </div>
                  )}

                  {/* Difficulty Badge - only on center */}
                  {isCenter && (
                    <div className="absolute bottom-2 left-2 px-2 py-1 bg-arcade-dark/80 rounded">
                      <span className={`font-pixel text-xs uppercase ${difficultyColors[game.difficulty]}`}>
                        {game.difficulty}
                      </span>
                    </div>
                  )}

                  {/* Game name overlay for side cards */}
                  {!isCenter && (
                    <div className="absolute inset-0 bg-gradient-to-t from-arcade-black/90 via-transparent to-transparent flex items-end p-2">
                      <span className="font-pixel text-arcade-green text-xs truncate w-full text-center">
                        {game.name}
                      </span>
                    </div>
                  )}
                </div>

                {/* Game Info - Only for center card */}
                {isCenter && (
                  <div className="p-4">
                    <h3 className="font-pixel text-arcade-green text-sm md:text-base uppercase mb-3 glow-green text-center">
                      {game.name}
                    </h3>

                    {/* Top 3 Players */}
                    <div className="space-y-1.5">
                      {topPlayers.length > 0 ? (
                        topPlayers.map((player, playerIndex) => (
                          <div
                            key={playerIndex}
                            className="flex items-center justify-between text-xs md:text-sm"
                          >
                            <div className="flex items-center gap-2">
                              <span className={`font-pixel ${rankColors[playerIndex]}`}>
                                {playerIndex === 0 ? '1st' : playerIndex === 1 ? '2nd' : '3rd'}
                              </span>
                              <span className="font-arcade text-white truncate max-w-28">
                                {player.username}
                              </span>
                            </div>
                            <span className="font-arcade text-arcade-cyan">
                              {player.score.toLocaleString()}
                            </span>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-2">
                          <span className="font-arcade text-xs text-gray-500">
                            No scores yet - be first!
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Game Counter */}
      <div className="text-center mt-4">
        <span className="font-arcade text-sm text-gray-500">
          {selectedIndex + 1} / {games.length}
        </span>
      </div>
    </div>
  );
}
