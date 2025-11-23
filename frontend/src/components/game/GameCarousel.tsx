'use client';

import { useRef, useState, useEffect } from 'react';
import { TopPlayer } from '@/hooks/useGameLeaderboards';

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
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const updateScrollButtons = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
    }
  };

  useEffect(() => {
    updateScrollButtons();
    const container = scrollRef.current;
    if (container) {
      container.addEventListener('scroll', updateScrollButtons);
      return () => container.removeEventListener('scroll', updateScrollButtons);
    }
  }, []);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const cardWidth = 320; // Card width + gap
      const scrollAmount = direction === 'left' ? -cardWidth : cardWidth;
      scrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  const scrollToSelected = (index: number) => {
    if (scrollRef.current) {
      const cardWidth = 320;
      const containerWidth = scrollRef.current.clientWidth;
      const targetScroll = index * cardWidth - (containerWidth - cardWidth) / 2;
      scrollRef.current.scrollTo({ left: targetScroll, behavior: 'smooth' });
    }
  };

  const handleSelectGame = (index: number) => {
    onSelectGame(index);
    scrollToSelected(index);
  };

  const difficultyColors = {
    easy: 'text-arcade-green',
    medium: 'text-arcade-yellow',
    hard: 'text-arcade-red',
  };

  const rankIcons = ['trophy-gold', 'trophy-silver', 'trophy-bronze'];
  const rankColors = ['text-yellow-400', 'text-gray-300', 'text-orange-400'];

  return (
    <div className="relative">
      {/* Left Arrow */}
      <button
        onClick={() => scroll('left')}
        className={`
          absolute left-0 top-1/2 -translate-y-1/2 z-20
          w-12 h-12 flex items-center justify-center
          bg-arcade-dark/90 border border-arcade-green/50 rounded-full
          text-arcade-green hover:bg-arcade-green/20 hover:border-arcade-green
          transition-all duration-200
          ${canScrollLeft ? 'opacity-100' : 'opacity-30 cursor-not-allowed'}
        `}
        disabled={!canScrollLeft}
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      {/* Right Arrow */}
      <button
        onClick={() => scroll('right')}
        className={`
          absolute right-0 top-1/2 -translate-y-1/2 z-20
          w-12 h-12 flex items-center justify-center
          bg-arcade-dark/90 border border-arcade-green/50 rounded-full
          text-arcade-green hover:bg-arcade-green/20 hover:border-arcade-green
          transition-all duration-200
          ${canScrollRight ? 'opacity-100' : 'opacity-30 cursor-not-allowed'}
        `}
        disabled={!canScrollRight}
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>

      {/* Scrollable Container */}
      <div
        ref={scrollRef}
        className="flex gap-6 overflow-x-auto scrollbar-hide px-14 py-4 snap-x snap-mandatory"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {games.map((game, index) => {
          const topPlayers = leaderboards[game.id] || [];
          const isSelected = selectedIndex === index;

          return (
            <div
              key={game.id}
              onClick={() => handleSelectGame(index)}
              className={`
                flex-shrink-0 w-72 cursor-pointer snap-center
                transition-all duration-300 ease-out
                ${isSelected ? 'scale-105' : 'scale-95 opacity-70 hover:opacity-90 hover:scale-100'}
              `}
            >
              <div
                className={`
                  bg-arcade-dark border-2 rounded-lg overflow-hidden
                  transition-all duration-300
                  ${isSelected ? 'border-arcade-green shadow-lg shadow-arcade-green/30' : 'border-arcade-green/30 hover:border-arcade-green/60'}
                `}
              >
                {/* Thumbnail */}
                <div className="aspect-video bg-arcade-black relative overflow-hidden">
                  {game.thumbnail ? (
                    <img
                      src={game.thumbnail}
                      alt={game.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-arcade-dark to-arcade-black">
                      <span className="font-pixel text-6xl text-arcade-green/20">?</span>
                    </div>
                  )}

                  {/* Coming Soon Badge */}
                  {!game.playable && (
                    <div className="absolute top-2 right-2 px-2 py-1 bg-arcade-yellow/90 rounded">
                      <span className="font-pixel text-xs text-black">SOON</span>
                    </div>
                  )}

                  {/* Difficulty Badge */}
                  <div className="absolute bottom-2 left-2 px-2 py-1 bg-arcade-dark/80 rounded">
                    <span className={`font-pixel text-xs uppercase ${difficultyColors[game.difficulty]}`}>
                      {game.difficulty}
                    </span>
                  </div>
                </div>

                {/* Game Info */}
                <div className="p-4">
                  <h3 className="font-pixel text-arcade-green text-sm uppercase mb-3 glow-green">
                    {game.name}
                  </h3>

                  {/* Top 3 Players */}
                  <div className="space-y-1.5">
                    {topPlayers.length > 0 ? (
                      topPlayers.map((player, playerIndex) => (
                        <div
                          key={playerIndex}
                          className="flex items-center justify-between text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <span className={`font-pixel ${rankColors[playerIndex]}`}>
                              {playerIndex === 0 ? '1st' : playerIndex === 1 ? '2nd' : '3rd'}
                            </span>
                            <span className="font-arcade text-white truncate max-w-24">
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
              </div>
            </div>
          );
        })}
      </div>

      {/* Scroll Indicator Dots */}
      <div className="flex justify-center gap-2 mt-4">
        {games.map((_, index) => (
          <button
            key={index}
            onClick={() => handleSelectGame(index)}
            className={`
              w-2 h-2 rounded-full transition-all duration-200
              ${selectedIndex === index
                ? 'bg-arcade-green w-6'
                : 'bg-arcade-green/30 hover:bg-arcade-green/60'
              }
            `}
          />
        ))}
      </div>
    </div>
  );
}
