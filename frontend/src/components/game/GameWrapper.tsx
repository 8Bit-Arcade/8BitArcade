'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAccount } from 'wagmi';
import Phaser from 'phaser';
import Button from '@/components/ui/Button';
import TouchControls from './TouchControls';
import { useGameStore } from '@/stores/gameStore';
import { useAudioStore } from '@/stores/audioStore';
import { formatNumber, isTouchDevice } from '@/lib/utils';
import type { GameMode } from '@/types';

interface GameWrapperProps {
  gameId: string;
  gameName: string;
  GameScene: new (
    onScoreUpdate: (score: number) => void,
    onGameOver: (finalScore: number) => void,
    getDirection: () => { up: boolean; down: boolean; left: boolean; right: boolean },
    getAction: () => boolean,
    seed: number
  ) => Phaser.Scene;
  config?: Partial<Phaser.Types.Core.GameConfig>;
  showDPad?: boolean;
  showAction?: boolean;
  actionLabel?: string;
}

export default function GameWrapper({
  gameId,
  gameName,
  GameScene,
  config = {},
  showDPad = true,
  showAction = true,
  actionLabel = 'FIRE',
}: GameWrapperProps) {
  const router = useRouter();
  const { isConnected } = useAccount();
  const gameRef = useRef<Phaser.Game | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const {
    gameMode,
    score,
    isPlaying,
    isPaused,
    isGameOver,
    seed,
    startGame,
    endGame,
    setScore,
    pauseGame,
    resumeGame,
  } = useGameStore();

  const { soundEnabled } = useAudioStore();

  const [showModeSelect, setShowModeSelect] = useState(true);
  const [highScore, setHighScore] = useState(0);

  // Input state refs (for real-time access in game loop)
  const directionRef = useRef({ up: false, down: false, left: false, right: false });
  const actionRef = useRef(false);

  // Load high score from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(`highscore-${gameId}`);
    if (saved) setHighScore(parseInt(saved, 10));
  }, [gameId]);

  // Save high score
  useEffect(() => {
    if (isGameOver && score > highScore) {
      setHighScore(score);
      localStorage.setItem(`highscore-${gameId}`, score.toString());
    }
  }, [isGameOver, score, highScore, gameId]);

  // Handle score updates from game
  const handleScoreUpdate = useCallback(
    (newScore: number) => {
      setScore(newScore);
    },
    [setScore]
  );

  // Handle game over
  const handleGameOver = useCallback(
    (finalScore: number) => {
      setScore(finalScore);
      endGame();
    },
    [setScore, endGame]
  );

  // Get current direction (called by game)
  const getDirection = useCallback(() => directionRef.current, []);

  // Get current action state (called by game)
  const getAction = useCallback(() => actionRef.current, []);

  // Start game with selected mode
  const handleStartGame = useCallback(
    (mode: GameMode) => {
      if (mode !== 'free' && !isConnected) {
        alert('Please connect your wallet to play ranked or tournament mode');
        return;
      }

      setShowModeSelect(false);
      startGame(gameId, mode);

      // Initialize Phaser game
      if (containerRef.current && !gameRef.current) {
        const gameConfig: Phaser.Types.Core.GameConfig = {
          type: Phaser.AUTO,
          parent: containerRef.current,
          width: config.width || 800,
          height: config.height || 600,
          backgroundColor: config.backgroundColor || '#0a0a0a',
          physics: {
            default: 'arcade',
            arcade: {
              gravity: { x: 0, y: 0 },
              debug: false,
            },
          },
          scale: {
            mode: Phaser.Scale.FIT,
            autoCenter: Phaser.Scale.CENTER_BOTH,
          },
          audio: {
            disableWebAudio: !soundEnabled,
          },
          scene: new GameScene(
            handleScoreUpdate,
            handleGameOver,
            getDirection,
            getAction,
            seed || Math.floor(Math.random() * 2147483647)
          ),
          ...config,
        };

        gameRef.current = new Phaser.Game(gameConfig);
      }
    },
    [
      gameId,
      isConnected,
      startGame,
      seed,
      config,
      soundEnabled,
      GameScene,
      handleScoreUpdate,
      handleGameOver,
      getDirection,
      getAction,
    ]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (gameRef.current) {
        gameRef.current.destroy(true);
        gameRef.current = null;
      }
    };
  }, []);

  // Handle pause/resume
  const togglePause = useCallback(() => {
    if (isPaused) {
      resumeGame();
      gameRef.current?.scene.scenes[0]?.scene.resume();
    } else {
      pauseGame();
      gameRef.current?.scene.scenes[0]?.scene.pause();
    }
  }, [isPaused, pauseGame, resumeGame]);

  // Handle direction change from touch controls
  const handleDirectionChange = useCallback(
    (direction: { up: boolean; down: boolean; left: boolean; right: boolean }) => {
      directionRef.current = direction;
    },
    []
  );

  // Handle action button
  const handleAction = useCallback(() => {
    actionRef.current = true;
  }, []);

  const handleActionRelease = useCallback(() => {
    actionRef.current = false;
  }, []);

  // Keyboard controls
  useEffect(() => {
    if (!isPlaying || isPaused) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.code) {
        case 'ArrowUp':
        case 'KeyW':
          directionRef.current.up = true;
          break;
        case 'ArrowDown':
        case 'KeyS':
          directionRef.current.down = true;
          break;
        case 'ArrowLeft':
        case 'KeyA':
          directionRef.current.left = true;
          break;
        case 'ArrowRight':
        case 'KeyD':
          directionRef.current.right = true;
          break;
        case 'Space':
        case 'KeyZ':
          actionRef.current = true;
          break;
        case 'Escape':
        case 'KeyP':
          togglePause();
          break;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      switch (e.code) {
        case 'ArrowUp':
        case 'KeyW':
          directionRef.current.up = false;
          break;
        case 'ArrowDown':
        case 'KeyS':
          directionRef.current.down = false;
          break;
        case 'ArrowLeft':
        case 'KeyA':
          directionRef.current.left = false;
          break;
        case 'ArrowRight':
        case 'KeyD':
          directionRef.current.right = false;
          break;
        case 'Space':
        case 'KeyZ':
          actionRef.current = false;
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isPlaying, isPaused, togglePause]);

  // Play again
  const handlePlayAgain = useCallback(() => {
    if (gameRef.current) {
      gameRef.current.destroy(true);
      gameRef.current = null;
    }
    handleStartGame(gameMode);
  }, [gameMode, handleStartGame]);

  // Back to games
  const handleBackToGames = useCallback(() => {
    if (gameRef.current) {
      gameRef.current.destroy(true);
      gameRef.current = null;
    }
    router.push('/');
  }, [router]);

  return (
    <div className="min-h-screen bg-arcade-black flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-arcade-green/30">
        <button
          onClick={handleBackToGames}
          className="font-pixel text-arcade-green text-xs hover:text-arcade-cyan"
        >
          ← BACK
        </button>
        <h1 className="font-pixel text-arcade-green text-sm">{gameName}</h1>
        <div className="font-pixel text-arcade-cyan text-xs">
          HI: {formatNumber(highScore)}
        </div>
      </div>

      {/* Score Display */}
      {isPlaying && (
        <div className="flex items-center justify-between px-4 py-2 bg-arcade-dark/50">
          <span className="font-pixel text-arcade-yellow text-sm">
            SCORE: {formatNumber(score)}
          </span>
          <span className="font-arcade text-gray-400 text-xs uppercase">
            {gameMode} Mode
          </span>
          <button
            onClick={togglePause}
            className="font-pixel text-arcade-green text-xs hover:text-arcade-cyan"
          >
            {isPaused ? 'RESUME' : 'PAUSE'}
          </button>
        </div>
      )}

      {/* Game Container */}
      <div className="flex-1 flex items-center justify-center p-4">
        {/* Mode Selection */}
        {showModeSelect && (
          <div className="card-arcade text-center max-w-sm">
            <h2 className="font-pixel text-arcade-green text-lg mb-6">{gameName}</h2>
            <div className="space-y-3">
              <Button
                variant="secondary"
                className="w-full"
                onClick={() => handleStartGame('free')}
              >
                Free Play
              </Button>
              <Button
                variant="primary"
                className="w-full"
                onClick={() => handleStartGame('ranked')}
                disabled={!isConnected}
              >
                {isConnected ? 'Ranked Play' : 'Connect Wallet'}
              </Button>
            </div>
            <p className="font-arcade text-gray-500 text-xs mt-4">
              Ranked mode: Earn 8BIT tokens
            </p>
          </div>
        )}

        {/* Game Canvas */}
        {!showModeSelect && !isGameOver && (
          <div
            ref={containerRef}
            className="game-container bg-arcade-black rounded-lg overflow-hidden border-2 border-arcade-green/30"
          />
        )}

        {/* Paused Overlay */}
        {isPaused && (
          <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-20">
            <div className="card-arcade text-center">
              <h2 className="font-pixel text-arcade-yellow text-xl mb-4">PAUSED</h2>
              <Button onClick={togglePause}>Resume</Button>
            </div>
          </div>
        )}

        {/* Game Over */}
        {isGameOver && (
          <div className="card-arcade text-center max-w-sm">
            <h2 className="font-pixel text-arcade-red text-xl mb-2">GAME OVER</h2>
            <p className="font-pixel text-arcade-yellow text-2xl mb-2">
              {formatNumber(score)}
            </p>
            {score > highScore && (
              <p className="font-pixel text-arcade-green text-xs mb-4 animate-pulse">
                NEW HIGH SCORE!
              </p>
            )}
            <div className="space-y-3">
              <Button variant="primary" className="w-full" onClick={handlePlayAgain}>
                Play Again
              </Button>
              <Button variant="secondary" className="w-full" onClick={handleBackToGames}>
                Back to Games
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Touch Controls (mobile only) */}
      {isPlaying && !isPaused && !isGameOver && isTouchDevice() && (
        <TouchControls
          onDirectionChange={handleDirectionChange}
          onAction={handleAction}
          onActionRelease={handleActionRelease}
          actionLabel={actionLabel}
          showDPad={showDPad}
          showAction={showAction}
        />
      )}

      {/* Controls Help (desktop) */}
      {isPlaying && !isTouchDevice() && (
        <div className="p-4 border-t border-arcade-green/30 text-center">
          <p className="font-arcade text-gray-500 text-xs">
            Arrow Keys / WASD: Move | Space: {actionLabel} | P / Esc: Pause
          </p>
        </div>
      )}
    </div>
  );
}
