'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAccount } from 'wagmi';
import Link from 'next/link';
import { callFunction } from '@/lib/firebase-functions';
import { PvpMatch, GAME_INFO } from '@/types/pvp';

export default function MatchResultsPage() {
  const [matchId, setMatchId] = useState<string>('');
  useEffect(() => {
    setMatchId(new URLSearchParams(window.location.search).get('id') ?? '');
  }, []);
  const router = useRouter();
  const { address } = useAccount();
  const [match, setMatch] = useState<PvpMatch | null>(null);
  const [loading, setLoading] = useState(true);

  const me = address?.toLowerCase();

  useEffect(() => {
    const load = async () => {
      try {
        const result = await callFunction<any, any>('getPvpMatch', { matchId });
        setMatch(result as PvpMatch);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [matchId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-arcade-dark flex items-center justify-center">
        <div className="font-pixel text-arcade-green animate-pulse">LOADING RESULTS...</div>
      </div>
    );
  }

  if (!match) {
    return (
      <div className="min-h-screen bg-arcade-dark flex items-center justify-center">
        <div className="font-pixel text-red-400">Results not found</div>
      </div>
    );
  }

  const iWon = match.winner === me;
  const iLost = (match.creator === me || match.challenger === me) && match.winner !== me;
  const isParticipant = match.creator === me || match.challenger === me;

  const myTotal = match.creator === me ? match.creatorTotalScore : match.challengerTotalScore;
  const oppTotal = match.creator === me ? match.challengerTotalScore : match.creatorTotalScore;
  const opponent = match.creator === me ? match.challenger : match.creator;
  const prize = match.betAmount > 0 ? Math.floor(match.betAmount * 2 * 0.95) : 0;

  return (
    <div className="min-h-screen bg-arcade-dark flex flex-col items-center justify-start py-10 px-4">
      <div className="w-full max-w-2xl space-y-6">
        {/* Result banner */}
        <div className={`text-center py-8 rounded-xl border-2
          ${iWon ? 'border-arcade-green bg-arcade-green/10' :
            iLost ? 'border-red-500/50 bg-red-900/10' :
            'border-gray-600 bg-gray-900/20'
          }`}
        >
          <div className="text-6xl mb-3">
            {iWon ? '🏆' : iLost ? '💔' : '🎮'}
          </div>
          <div className={`font-pixel text-2xl
            ${iWon ? 'text-arcade-green glow-green' :
              iLost ? 'text-red-400' : 'text-gray-300'
            }`}
          >
            {iWon ? 'VICTORY!' : iLost ? 'DEFEATED' : 'MATCH OVER'}
          </div>
          <div className="font-pixel text-xs text-gray-500 mt-1">
            MATCH #{match.displayNumber}
          </div>
          {isParticipant && iWon && prize > 0 && (
            <div className="mt-3 font-pixel text-sm text-arcade-green animate-pulse">
              +{prize.toLocaleString()} 8BIT EARNED
            </div>
          )}
        </div>

        {/* Score summary */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-black/40 border border-arcade-green/30 rounded p-4 text-center">
            <div className="font-pixel text-xs text-arcade-green mb-1">
              {match.creator === me ? 'YOU (Creator)' : `${match.creator?.slice(0,6)}...`}
            </div>
            <div className="font-pixel text-3xl text-arcade-green">
              {match.creatorTotalScore.toLocaleString()}
            </div>
            {match.winner === match.creator && (
              <div className="font-pixel text-xs text-yellow-400 mt-1">🏆 WINNER</div>
            )}
          </div>
          <div className="bg-black/40 border border-arcade-cyan/30 rounded p-4 text-center">
            <div className="font-pixel text-xs text-arcade-cyan mb-1">
              {match.challenger === me ? 'YOU (Challenger)' : `${match.challenger?.slice(0,6)}...`}
            </div>
            <div className="font-pixel text-3xl text-arcade-cyan">
              {match.challengerTotalScore.toLocaleString()}
            </div>
            {match.winner === match.challenger && (
              <div className="font-pixel text-xs text-yellow-400 mt-1">🏆 WINNER</div>
            )}
          </div>
        </div>

        {/* Round-by-round breakdown */}
        <div className="bg-black/30 border border-arcade-green/20 rounded p-4">
          <div className="font-pixel text-xs text-gray-400 mb-3">ROUND BREAKDOWN</div>
          <div className="space-y-2">
            {match.rounds.map((round, i) => {
              const info = GAME_INFO[round.gameId];
              const creatorWon = round.winner === match.creator;
              const challengerWon = round.winner === match.challenger;
              return (
                <div key={i} className="flex items-center gap-3 py-1 border-b border-gray-800 last:border-0">
                  <span className="text-xl w-6">{info?.emoji || '🎮'}</span>
                  <span className="font-pixel text-xs text-gray-400 flex-1">{info?.name}</span>
                  <span className={`font-pixel text-xs w-20 text-right
                    ${creatorWon ? 'text-arcade-green' : 'text-gray-500'}`}>
                    {round.creatorScore?.toLocaleString() ?? '-'}
                    {creatorWon && ' 🏆'}
                  </span>
                  <span className="font-pixel text-xs text-gray-600">vs</span>
                  <span className={`font-pixel text-xs w-20
                    ${challengerWon ? 'text-arcade-cyan' : 'text-gray-500'}`}>
                    {challengerWon && '🏆 '}
                    {round.challengerScore?.toLocaleString() ?? '-'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Bet info */}
        {match.betAmount > 0 && (
          <div className="bg-black/30 border border-yellow-500/30 rounded p-3 font-pixel text-xs">
            <div className="flex justify-between text-gray-400">
              <span>Entry (each)</span><span>{match.betAmount.toLocaleString()} 8BIT</span>
            </div>
            <div className="flex justify-between text-gray-400 mt-1">
              <span>Total pot</span><span>{(match.betAmount * 2).toLocaleString()} 8BIT</span>
            </div>
            <div className="flex justify-between text-red-400 mt-1">
              <span>Burned (2.5%)</span><span>-{Math.floor(match.betAmount * 2 * 0.025).toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-arcade-green font-bold mt-1 border-t border-yellow-500/20 pt-1">
              <span>Winner received</span><span>+{prize.toLocaleString()} 8BIT</span>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <Link
            href="/multiplayer"
            className="flex-1 text-center font-pixel text-xs py-2 border border-gray-600 text-gray-400
                       rounded hover:border-arcade-green hover:text-arcade-green transition-colors"
          >← LOBBY</Link>
          {opponent && (
            <Link
              href={`/profile?address=${opponent}`}
              className="flex-1 text-center font-pixel text-xs py-2 border border-arcade-cyan/50
                         text-arcade-cyan rounded hover:bg-arcade-cyan/10 transition-colors"
            >👤 VIEW OPPONENT</Link>
          )}
          <Link
            href="/multiplayer"
            onClick={() => {}}
            className="flex-1 text-center font-pixel text-xs py-2 bg-arcade-green/20 border border-arcade-green
                       text-arcade-green rounded hover:bg-arcade-green/30 transition-all"
          >⚔️ PLAY AGAIN</Link>
        </div>
      </div>
    </div>
  );
}
