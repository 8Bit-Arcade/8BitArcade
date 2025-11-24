'use client';

interface Game {
  id: string;
  name: string;
}

const GAMES: Game[] = [
  { id: 'all', name: 'ALL GAMES' },
  { id: 'space-rocks', name: 'SPACE ROCKS' },
  { id: 'alien-assault', name: 'ALIEN ASSAULT' },
  { id: 'brick-breaker', name: 'BRICK BREAKER' },
  { id: 'pixel-snake', name: 'PIXEL SNAKE' },
];

interface GameSelectorProps {
  selectedGame: string;
  onGameChange: (gameId: string) => void;
}

export default function GameSelector({
  selectedGame,
  onGameChange,
}: GameSelectorProps) {
  return (
    <div className="mb-6">
      <label className="block font-pixel text-arcade-green text-xs mb-2">
        SELECT GAME
      </label>
      <select
        value={selectedGame}
        onChange={(e) => onGameChange(e.target.value)}
        className="w-full p-3 bg-arcade-dark border border-arcade-green/30 text-white font-arcade text-sm focus:border-arcade-green focus:outline-none"
      >
        {GAMES.map((game) => (
          <option key={game.id} value={game.id}>
            {game.name}
          </option>
        ))}
      </select>
    </div>
  );
}
