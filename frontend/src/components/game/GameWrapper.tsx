'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAccount } from 'wagmi';
import * as Phaser from 'phaser';
import Button from '@/components/ui/Button';
import TouchControls from './TouchControls';
import { useGameStore } from '@/stores/gameStore';
import { useAudioStore } from '@/stores/audioStore';
import { useScoreSubmission } from '@/hooks/useScoreSubmission';
import { useWalletAuth } from '@/hooks/useWalletAuth';
import { formatNumber, isTouchDevice } from '@/lib/utils';
import type { GameMode } from '@/types';

type SceneConstructor = new (
  onScoreUpdate: (score: number) => void,
  onGameOver: (finalScore: number) => void,
  getDirection: () => { up: boolean; down: boolean; left: boolean; right: boolean },
  getAction: () => boolean,
  seed: number
) => Phaser.Scene;

interface GameWrapperProps {
  gameId: string;
  gameName: string;
  sceneLoader: () => Promise<SceneConstructor>;
  config?: Partial<Phaser.Types.Core.GameConfig>;
  showDPad?: boolean;
  showAction?: boolean;
  actionLabel?: string;
}

export default function GameWrapper({
  gameId,
  gameName,
  sceneLoader,
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
    reset: resetGameState,
  } = useGameStore();

  const { soundEnabled } = useAudioStore();
  const { createSession, submitScore: submitScoreToBackend } = useScoreSubmission();
  const { signInWithWallet, isFirebaseAuthenticated, isAuthenticating } = useWalletAuth();

  const [showModeSelect, setShowModeSelect] = useState(true);
  const [selectedMode, setSelectedMode] = useState<GameMode | null>(null);
  const [highScore, setHighScore] = useState(0);

  // Input state refs (for real-time access in game loop)
  const directionRef = useRef({ up: false, down: false, left: false, right: false });
  const actionRef = useRef(false);

  // Score submission state
  const sessionIdRef = useRef<string | null>(null);
  const gameStartTimeRef = useRef<number>(0);
  const inputsRef = useRef<Array<{ t: number; type: 'direction' | 'action'; data?: any }>>([]);

  // Reset game state when component mounts or gameId changes
  useEffect(() => {
    resetGameState();
    setShowModeSelect(true);
    setSelectedMode(null);
  }, [gameId, resetGameState]);

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
    async (finalScore: number) => {
      setScore(finalScore);
      endGame();

      console.log('Game over! Score:', finalScore, 'Mode:', gameMode, 'Session:', sessionIdRef.current, 'Seed:', seed);

      // Submit score for ranked/tournament modes
      if (gameMode !== 'free' && sessionIdRef.current && seed) {
        const duration = Date.now() - gameStartTimeRef.current;
        console.log('Submitting score... Inputs recorded:', inputsRef.current.length, 'Duration:', duration);

        try {
          const result = await submitScoreToBackend(
            sessionIdRef.current,
            gameId,
            seed,
            inputsRef.current,
            finalScore,
            duration
          );

          console.log('Score submission result:', result);

          if (result?.verified) {
            console.log('✅ Score verified and submitted!', result);
          } else if (result) {
            console.warn('⚠️ Score submitted but not verified:', result.flags);
          } else {
            console.error('❌ Score submission failed - no result returned');
          }
        } catch (err) {
          console.error('❌ Failed to submit score:', err);
        }
      } else {
        console.log('Skipping score submission:', {
          isFreeMode: gameMode === 'free',
          hasSession: !!sessionIdRef.current,
          hasSeed: !!seed
        });
      }
    },
    [setScore, endGame, gameMode, seed, gameId, submitScoreToBackend]
  );

  // Get current direction (called by game)
  const getDirection = useCallback(() => directionRef.current, []);

  // Get current action state (called by game)
  const getAction = useCallback(() => actionRef.current, []);

  // Handle mode selection - just set state, useEffect will init the game
  const handleStartGame = useCallback(
    async (mode: GameMode) => {
      if (mode !== 'free' && !isConnected) {
        alert('Please connect your wallet to play ranked or tournament mode');
        return;
      }

      // For ranked/tournament modes, ensure Firebase authentication
      if (mode !== 'free' && !isFirebaseAuthenticated) {
        console.log('Not authenticated with Firebase, requesting signature...');
        const success = await signInWithWallet();
        if (!success) {
          alert('You must sign the message to play ranked games');
          return;
        }
      }

      console.log('Mode selected:', mode);
      setSelectedMode(mode);
      setShowModeSelect(false);

      // Create session for ranked/tournament modes
      if (mode !== 'free') {
        try {
          console.log('Creating session for game:', gameId, 'mode:', mode);
          const session = await createSession(gameId, mode as 'ranked' | 'tournament');
          console.log('Session created:', session);
          if (session) {
            sessionIdRef.current = session.sessionId;
            startGame(gameId, mode, session.sessionId, session.seed);
            gameStartTimeRef.current = Date.now();
            inputsRef.current = [];
            console.log('Session ID stored:', sessionIdRef.current, 'Seed:', session.seed);
          } else {
            console.error('Failed to create session - session is null');
            startGame(gameId, mode);
          }
        } catch (err) {
          console.error('Error creating session:', err);
          startGame(gameId, mode);
        }
      } else {
        startGame(gameId, mode);
      }
    },
    [gameId, isConnected, isFirebaseAuthenticated, signInWithWallet, startGame, createSession]
  );

  // Scroll game into view when it becomes visible (mobile centering)
  useEffect(() => {
    if (!showModeSelect && containerRef.current) {
      setTimeout(() => {
        containerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    }
  }, [showModeSelect]);

  // Initialize Phaser AFTER container is rendered
  useEffect(() => {
    // Only init if mode selected, container exists, and game not created yet
    if (!selectedMode || !containerRef.current || gameRef.current) {
      console.log('Init check failed:', {
        selectedMode,
        containerExists: !!containerRef.current,
        gameExists: !!gameRef.current,
      });
      return;
    }

    console.log('Initializing Phaser game...');

    const initGame = async () => {
      try {
        // Load the scene class dynamically
        console.log('Loading scene...');
        const GameScene = await sceneLoader();
        console.log('Scene loaded:', GameScene);

        // Create scene instance with callbacks
        const sceneInstance = new GameScene(
          handleScoreUpdate,
          handleGameOver,
          getDirection,
          getAction,
          seed || Math.floor(Math.random() * 2147483647)
        );
        console.log('Scene instance created:', sceneInstance);

        const gameConfig: Phaser.Types.Core.GameConfig = {
          type: Phaser.AUTO,
          parent: containerRef.current!,
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
            width: '100%',
            height: '100%',
          },
          audio: {
            disableWebAudio: !soundEnabled,
          },
          scene: sceneInstance,
        };

        console.log('Creating Phaser game with config:', gameConfig);
        gameRef.current = new Phaser.Game(gameConfig);
        console.log('Phaser game created successfully!');
      } catch (error) {
        console.error('Failed to initialize game:', error);
      }
    };

    initGame();
  }, [
    selectedMode,
    seed,
    config,
    soundEnabled,
    sceneLoader,
    handleScoreUpdate,
    handleGameOver,
    getDirection,
    getAction,
  ]);

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
    const activeScene = gameRef.current?.scene.scenes[0];
    if (!activeScene) return;

    if (isPaused) {
      resumeGame();
      activeScene.scene.resume();
    } else {
      pauseGame();
      activeScene.scene.pause();
    }
  }, [isPaused, pauseGame, resumeGame]);

  // Handle direction change from touch controls
  const handleDirectionChange = useCallback(
    (direction: { up: boolean; down: boolean; left: boolean; right: boolean }) => {
      directionRef.current = direction;

      // Record input for ranked/tournament modes
      if (gameMode !== 'free' && sessionIdRef.current) {
        inputsRef.current.push({
          t: Date.now() - gameStartTimeRef.current,
          type: 'direction',
          data: direction,
        });
      }
    },
    [gameMode]
  );

  // Handle action button
  const handleAction = useCallback(() => {
    actionRef.current = true;

    // Record input for ranked/tournament modes
    if (gameMode !== 'free' && sessionIdRef.current) {
      inputsRef.current.push({
        t: Date.now() - gameStartTimeRef.current,
        type: 'action',
        data: { action: true },
      });
    }
  }, [gameMode]);

  const handleActionRelease = useCallback(() => {
    actionRef.current = false;

    // Record input for ranked/tournament modes
    if (gameMode !== 'free' && sessionIdRef.current) {
      inputsRef.current.push({
        t: Date.now() - gameStartTimeRef.current,
        type: 'action',
        data: { action: false },
      });
    }
  }, [gameMode]);

  // Keyboard controls
  useEffect(() => {
    if (!isPlaying || isPaused) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent default for game keys to stop page scrolling
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyZ'].includes(e.code)) {
        e.preventDefault();
      }

      let recordInput = false;

      switch (e.code) {
        case 'ArrowUp':
        case 'KeyW':
          directionRef.current.up = true;
          recordInput = true;
          break;
        case 'ArrowDown':
        case 'KeyS':
          directionRef.current.down = true;
          recordInput = true;
          break;
        case 'ArrowLeft':
        case 'KeyA':
          directionRef.current.left = true;
          recordInput = true;
          break;
        case 'ArrowRight':
        case 'KeyD':
          directionRef.current.right = true;
          recordInput = true;
          break;
        case 'Space':
        case 'KeyZ':
          actionRef.current = true;
          recordInput = true;
          break;
        case 'Escape':
        case 'KeyP':
          togglePause();
          break;
      }

      // Record input for ranked/tournament modes
      if (recordInput && gameMode !== 'free' && sessionIdRef.current) {
        inputsRef.current.push({
          t: Date.now() - gameStartTimeRef.current,
          type: e.code === 'Space' || e.code === 'KeyZ' ? 'action' : 'direction',
          data: e.code === 'Space' || e.code === 'KeyZ'
            ? { action: true }
            : { ...directionRef.current },
        });
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      let recordInput = false;

      switch (e.code) {
        case 'ArrowUp':
        case 'KeyW':
          directionRef.current.up = false;
          recordInput = true;
          break;
        case 'ArrowDown':
        case 'KeyS':
          directionRef.current.down = false;
          recordInput = true;
          break;
        case 'ArrowLeft':
        case 'KeyA':
          directionRef.current.left = false;
          recordInput = true;
          break;
        case 'ArrowRight':
        case 'KeyD':
          directionRef.current.right = false;
          recordInput = true;
          break;
        case 'Space':
        case 'KeyZ':
          actionRef.current = false;
          recordInput = true;
          break;
      }

      // Record input for ranked/tournament modes
      if (recordInput && gameMode !== 'free' && sessionIdRef.current) {
        inputsRef.current.push({
          t: Date.now() - gameStartTimeRef.current,
          type: e.code === 'Space' || e.code === 'KeyZ' ? 'action' : 'direction',
          data: e.code === 'Space' || e.code === 'KeyZ'
            ? { action: false }
            : { ...directionRef.current },
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isPlaying, isPaused, togglePause, gameMode]);

  // Play again
  const handlePlayAgain = useCallback(() => {
    if (gameRef.current) {
      gameRef.current.destroy(true);
      gameRef.current = null;
    }
    setSelectedMode(null);
    setShowModeSelect(true);
  }, []);

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
      <div className="flex items-center justify-between px-2 py-1 md:p-4 border-b border-arcade-green/30">
        <button
          onClick={handleBackToGames}
          className="font-pixel text-arcade-green text-xs hover:text-arcade-cyan"
        >
          ← BACK
        </button>
        <h1 className="font-pixel text-arcade-green text-xs md:text-sm">{gameName}</h1>
        <div className="font-pixel text-arcade-cyan text-xs">
          HI: {formatNumber(highScore)}
        </div>
      </div>

      {/* Score Display */}
      {isPlaying && (
        <div className="flex items-center justify-between px-2 py-0.5 md:py-2 bg-arcade-dark/50">
          <span className="font-pixel text-arcade-yellow text-xs md:text-sm">
            SCORE: {formatNumber(score)}
          </span>
          <span className="font-arcade text-gray-400 text-xs uppercase hidden sm:block">
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
      <div className="flex-1 flex items-center justify-center p-1 md:p-4">
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
            className="game-container bg-arcade-black rounded-lg overflow-hidden border-2 border-arcade-green/30 w-full max-w-4xl mx-auto"
            style={{
              // 72vh to prevent overflow and auto-center on mobile
              height: '72vh',
              maxHeight: '800px',
            }}
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
