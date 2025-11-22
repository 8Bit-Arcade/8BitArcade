'use client';

import { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  onClick?: () => void;
}

export default function Card({
  children,
  className = '',
  hover = true,
  onClick,
}: CardProps) {
  return (
    <div
      className={`
        bg-arcade-dark border border-arcade-green/30 rounded-lg p-4
        ${hover ? 'hover:border-arcade-green/60 transition-all duration-300' : ''}
        ${onClick ? 'cursor-pointer' : ''}
        ${className}
      `}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

// Card variants
export function GameCard({
  title,
  thumbnail,
  highScore,
  difficulty,
  onClick,
}: {
  title: string;
  thumbnail?: string;
  highScore?: number;
  difficulty?: 'easy' | 'medium' | 'hard';
  onClick?: () => void;
}) {
  const difficultyColors = {
    easy: 'text-arcade-green',
    medium: 'text-arcade-yellow',
    hard: 'text-arcade-red',
  };

  return (
    <Card onClick={onClick} className="group">
      {/* Thumbnail */}
      <div className="aspect-video bg-arcade-black rounded mb-3 overflow-hidden flex items-center justify-center">
        {thumbnail ? (
          <img
            src={thumbnail}
            alt={title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
          />
        ) : (
          <span className="font-pixel text-4xl text-arcade-green/30">?</span>
        )}
      </div>

      {/* Title */}
      <h3 className="font-pixel text-arcade-green text-xs uppercase mb-2 group-hover:glow-green">
        {title}
      </h3>

      {/* Stats */}
      <div className="flex justify-between items-center text-xs">
        {highScore !== undefined && (
          <span className="font-arcade text-gray-400">
            HI: {highScore.toLocaleString()}
          </span>
        )}
        {difficulty && (
          <span className={`font-pixel uppercase ${difficultyColors[difficulty]}`}>
            {difficulty}
          </span>
        )}
      </div>
    </Card>
  );
}
