'use client';

import { useState } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits } from 'viem';
import { callFunction } from '@/lib/firebase-functions';
import BetSelector from './BetSelector';
import { GAME_INFO, ALL_GAME_IDS } from '@/types/pvp';
import { CONTRACTS } from '@/config/contracts';

interface CreateChallengeModalProps {
  onClose: () => void;
  onCreated: (matchId: string) => void;
  userBalance: number;
}

const NUM_GAMES_OPTIONS = [1, 3, 5, 7, 10];

export default function CreateChallengeModal({ onClose, onCreated, userBalance }: CreateChallengeModalProps) {
  const { address } = useAccount();
  const [step, setStep] = useState<'config' | 'approving' | 'creating' | 'done'>('config');
  const [betAmount, setBetAmount] = useState(0);
  const [selectedGames, setSelectedGames] = useState<string[]>([]);
  const [numGames, setNumGames] = useState(1);
  const [customNumGames, setCustomNumGames] = useState('');
  const [randomGames, setRandomGames] = useState(false);
  const [error, setError] = useState('');

  const { writeContract, data: approveTxHash } = useWriteContract();
  const { isSuccess: approveConfirmed } = useWaitForTransactionReceipt({ hash: approveTxHash });

  const resolvedNumGames = customNumGames
    ? parseInt(customNumGames, 10) || numGames
    : numGames;

  const toggleGame = (gameId: string) => {
    setSelectedGames(prev =>
      prev.includes(gameId) ? prev.filter(g => g !== gameId) : [...prev, gameId]
    );
  };

  const selectAll = () => setSelectedGames([...ALL_GAME_IDS]);
  const selectNone = () => setSelectedGames([]);

  const canCreate = () => {
    const games = randomGames ? ALL_GAME_IDS : selectedGames;
    if (games.length === 0) return false;
    if (betAmount > 0 && userBalance < betAmount) return false;
    if (resolvedNumGames < 1) return false;
    return true;
  };

  const handleCreate = async () => {
    if (!address || !canCreate()) return;
    setError('');

    const games = randomGames ? ALL_GAME_IDS : selectedGames;

    try {
      setStep('creating');

      // For paid matches: need on-chain escrow approval + lock
      // For free matches: skip directly to Firestore
      let onChainMatchId: string | null = null;
      let txHashCreate: string | null = null;

      if (betAmount > 0) {
        setStep('approving');
        // Approve + createMatch handled by the match room after Firestore record created
        // We create Firestore record first to get the matchId, then use it for on-chain
      }

      const result = await callFunction<any, { matchId: string; displayNumber: number }>('createPvpMatch', {
        betAmount,
        gameIds: games,
        numGames: resolvedNumGames,
        onChainMatchId,
        txHashCreate,
      });

      setStep('done');
      onCreated(result.matchId);
    } catch (err: any) {
      setError(err.message || 'Failed to create challenge');
      setStep('config');
    }
  };

  if (step !== 'config') {
    return (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
        <div className="bg-arcade-dark border border-arcade-green/40 rounded-lg p-8 text-center max-w-sm w-full">
          <div className="text-4xl mb-4 animate-pulse">
            {step === 'approving' ? '🔓' : step === 'creating' ? '⚔️' : '✅'}
          </div>
          <div className="font-pixel text-arcade-green text-sm">
            {step === 'approving' && 'APPROVING TOKEN SPEND...'}
            {step === 'creating' && 'POSTING CHALLENGE...'}
            {step === 'done' && 'CHALLENGE POSTED!'}
          </div>
          {step === 'done' && (
            <p className="text-gray-400 text-xs mt-2 font-pixel">
              Waiting for an opponent to join...
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-arcade-dark border border-arcade-green/40 rounded-lg w-full max-w-xl
                      max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-arcade-green/20">
          <h2 className="font-pixel text-arcade-green text-sm">⚔️ CREATE CHALLENGE</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-red-400 font-pixel text-sm"
          >✕</button>
        </div>

        <div className="p-5 space-y-6">
          {/* Number of games */}
          <div>
            <div className="font-pixel text-xs text-gray-400 mb-2">HOW MANY GAMES?</div>
            <div className="flex flex-wrap gap-2">
              {NUM_GAMES_OPTIONS.map(n => (
                <button
                  key={n}
                  onClick={() => { setNumGames(n); setCustomNumGames(''); }}
                  className={`font-pixel text-xs px-3 py-1.5 rounded border transition-all
                    ${numGames === n && !customNumGames
                      ? 'border-arcade-green bg-arcade-green/20 text-arcade-green'
                      : 'border-gray-600 text-gray-400 hover:border-arcade-green/40'
                    }`}
                >{n}</button>
              ))}
              <input
                type="number"
                min={1}
                max={20}
                placeholder="Custom"
                value={customNumGames}
                onChange={e => setCustomNumGames(e.target.value)}
                className={`w-20 bg-black/40 border rounded px-2 py-1.5 font-pixel text-xs
                  text-gray-200 placeholder-gray-600 focus:outline-none
                  ${customNumGames ? 'border-arcade-green/70' : 'border-gray-600 focus:border-arcade-green/40'}`}
              />
            </div>
          </div>

          {/* Game selection */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="font-pixel text-xs text-gray-400">SELECT GAMES</div>
              <div className="flex gap-2">
                <button
                  onClick={() => { setRandomGames(r => !r); }}
                  className={`font-pixel text-xs px-2 py-1 rounded border transition-all
                    ${randomGames
                      ? 'border-arcade-cyan bg-arcade-cyan/20 text-arcade-cyan'
                      : 'border-gray-600 text-gray-500 hover:border-arcade-cyan/40'
                    }`}
                >🎲 RANDOM</button>
                <button onClick={selectAll} className="font-pixel text-xs text-gray-500 hover:text-arcade-green">All</button>
                <button onClick={selectNone} className="font-pixel text-xs text-gray-500 hover:text-red-400">None</button>
              </div>
            </div>

            {randomGames ? (
              <div className="bg-black/30 border border-arcade-cyan/30 rounded p-3 text-center">
                <p className="text-arcade-cyan font-pixel text-xs">
                  🎲 Games will be randomly selected each round
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-1.5">
                {ALL_GAME_IDS.map(gameId => {
                  const info = GAME_INFO[gameId];
                  const selected = selectedGames.includes(gameId);
                  return (
                    <button
                      key={gameId}
                      onClick={() => toggleGame(gameId)}
                      className={`flex items-center gap-1.5 p-2 rounded border text-left transition-all
                        ${selected
                          ? 'border-arcade-green/60 bg-arcade-green/10 text-gray-200'
                          : 'border-gray-700 bg-black/20 text-gray-500 hover:border-gray-500'
                        }`}
                    >
                      <span className="text-base">{info.emoji}</span>
                      <span className="font-pixel text-xs truncate">{info.name}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {!randomGames && selectedGames.length === 0 && (
              <p className="text-red-400 font-pixel text-xs mt-1">Select at least one game</p>
            )}
          </div>

          {/* Bet selector */}
          <BetSelector
            value={betAmount}
            onChange={setBetAmount}
            userBalance={userBalance}
          />

          {/* Winner rule */}
          <div className="bg-black/30 border border-arcade-green/20 rounded p-3">
            <p className="text-gray-400 font-pixel text-xs">
              🏆 <span className="text-arcade-green">Winner:</span> Highest <strong>TOTAL SCORE</strong> across all {resolvedNumGames} game{resolvedNumGames !== 1 ? 's' : ''}.
              {resolvedNumGames > selectedGames.length && !randomGames && selectedGames.length > 0 && (
                <span className="text-arcade-cyan"> Games cycle: {selectedGames.map(g => GAME_INFO[g]?.emoji).join('')}...</span>
              )}
            </p>
          </div>

          {error && (
            <p className="text-red-400 font-pixel text-xs bg-red-900/20 border border-red-500/30 rounded p-2">
              ⚠ {error}
            </p>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 font-pixel text-xs py-2 border border-gray-600 text-gray-400
                         rounded hover:border-gray-400 transition-colors"
            >CANCEL</button>
            <button
              onClick={handleCreate}
              disabled={!canCreate()}
              className="flex-1 font-pixel text-xs py-2 bg-arcade-green/20 border border-arcade-green
                         text-arcade-green rounded hover:bg-arcade-green/30 transition-all
                         disabled:opacity-40 disabled:cursor-not-allowed glow-green"
            >
              ⚔️ POST CHALLENGE
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
