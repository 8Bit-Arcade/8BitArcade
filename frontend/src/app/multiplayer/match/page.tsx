'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAccount } from 'wagmi';
import Link from 'next/link';
import { callFunction } from '@/lib/firebase-functions';
import { getFirestoreInstance } from '@/lib/firebase-client';
import ChatSidebar from '@/components/chat/ChatSidebar';
import { PvpMatch, PvpRound, GAME_INFO } from '@/types/pvp';
import { useDisplayName } from '@/stores/authStore';

export default function MatchRoomPage() {
  const [matchId, setMatchId] = useState<string>('');
  useEffect(() => {
    setMatchId(new URLSearchParams(window.location.search).get('id') ?? '');
  }, []);
  const router = useRouter();
  const { address } = useAccount();

  const [match, setMatch] = useState<PvpMatch | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentRound, setCurrentRound] = useState(0);
  const [gameActive, setGameActive] = useState(false);
  const [myScore, setMyScore] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const me = address?.toLowerCase();
  const isCreator = match?.creator === me;
  const isChallenger = match?.challenger === me;
  const isParticipant = isCreator || isChallenger;

  // Real-time match listener
  useEffect(() => {
    if (!matchId) return;
    let unsubscribe: (() => void) | null = null;

    const setup = async () => {
      try {
        const db = await getFirestoreInstance();
        const { doc, onSnapshot } = await import('firebase/firestore');
        unsubscribe = onSnapshot(doc(db, 'pvpMatches', matchId), (snap) => {
          if (snap.exists()) {
            const data = snap.data() as PvpMatch;
            setMatch(data);

            // Find current active round
            const activeRound = data.rounds.findIndex(r =>
              !(r.creatorFinished && r.challengerFinished)
            );
            if (activeRound >= 0) setCurrentRound(activeRound);
            else setCurrentRound(data.rounds.length - 1);
          }
          setLoading(false);
        });
      } catch (err) {
        setError('Failed to load match');
        setLoading(false);
      }
    };

    setup();
    return () => unsubscribe?.();
  }, [matchId]);

  // Redirect to results when match completes
  useEffect(() => {
    if (match?.status === 'completed') {
      setTimeout(() => router.push(`/multiplayer/results?id=${matchId}`), 3000);
    }
    if (match?.status === 'cancelled') {
      setTimeout(() => router.push('/multiplayer'), 2000);
    }
  }, [match?.status, matchId, router]);

  const round = match?.rounds[currentRound];
  const roundGameInfo = round ? GAME_INFO[round.gameId] : null;

  const myRoundFinished = round
    ? (isCreator ? round.creatorFinished : round.challengerFinished)
    : false;
  const oppRoundFinished = round
    ? (isCreator ? round.challengerFinished : round.creatorFinished)
    : false;
  const bothFinished = myRoundFinished && oppRoundFinished;

  // Reveal scores only when both players finish the round
  const myRoundScore: number | null = bothFinished
    ? (isCreator ? round?.creatorScore ?? null : round?.challengerScore ?? null)
    : (myRoundFinished ? myScore : null);
  const oppRoundScore: number | null = bothFinished
    ? (isCreator ? round?.challengerScore ?? null : round?.creatorScore ?? null)
    : null; // always hidden until both done

  const submitScore = async (score: number) => {
    if (!matchId || !isParticipant || submitting) return;
    setSubmitting(true);
    setMyScore(score);

    try {
      await callFunction('submitPvpScore', {
        matchId,
        roundIndex: currentRound,
        score,
      });
    } catch (err: any) {
      setError(err.message || 'Failed to submit score');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-arcade-dark flex items-center justify-center">
        <div className="font-pixel text-arcade-green animate-pulse">LOADING MATCH...</div>
      </div>
    );
  }

  if (!match) {
    return (
      <div className="min-h-screen bg-arcade-dark flex items-center justify-center">
        <div className="text-center space-y-2">
          <div className="font-pixel text-red-400">MATCH NOT FOUND</div>
          <Link href="/multiplayer" className="font-pixel text-xs text-arcade-green hover:underline">
            ← Back to Lobby
          </Link>
        </div>
      </div>
    );
  }

  if (match.status === 'cancelled') {
    return (
      <div className="min-h-screen bg-arcade-dark flex items-center justify-center">
        <div className="text-center space-y-2">
          <div className="text-4xl">💀</div>
          <div className="font-pixel text-gray-400">MATCH CANCELLED</div>
          <div className="font-pixel text-xs text-gray-600">Redirecting to lobby...</div>
        </div>
      </div>
    );
  }

  if (match.status === 'completed') {
    return (
      <div className="min-h-screen bg-arcade-dark flex items-center justify-center">
        <div className="text-center space-y-2">
          <div className="text-4xl animate-bounce">🏆</div>
          <div className="font-pixel text-arcade-green">MATCH COMPLETE!</div>
          <div className="font-pixel text-xs text-gray-400">Loading results...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-arcade-dark flex flex-col">
      {/* Match header */}
      <div className="border-b border-arcade-green/20 px-4 py-2">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/multiplayer" className="text-gray-500 hover:text-arcade-green font-pixel text-xs">← LOBBY</Link>
            <span className="font-pixel text-xs text-gray-600">|</span>
            <span className="font-pixel text-sm text-arcade-green">⚔️ MATCH #{match.displayNumber}</span>
            <span className="font-pixel text-xs text-gray-500">
              {match.betAmount > 0
                ? `💎 ${match.betAmount.toLocaleString()} 8BIT at stake`
                : 'FREE MATCH'}
            </span>
          </div>
          <div className="font-pixel text-xs text-gray-500">
            GAME {currentRound + 1} of {match.numGames} · {roundGameInfo?.emoji} {roundGameInfo?.name}
          </div>
        </div>
      </div>

      <div className="flex flex-1 max-w-6xl mx-auto w-full">
        {/* Game area */}
        <div className="flex-1 flex flex-col p-4 space-y-4 min-w-0">
          {/* VS header */}
          <div className="flex items-center justify-between bg-black/40 border border-arcade-green/20 rounded p-3">
            <div className="text-center flex-1">
              <div className="font-pixel text-xs text-arcade-green">YOU</div>
              <div className="font-pixel text-sm text-gray-300 truncate">
                {me ? `${me.slice(0, 6)}...${me.slice(-4)}` : '???'}
              </div>
            </div>
            <div className="font-pixel text-xl text-arcade-green px-4">VS</div>
            <div className="text-center flex-1">
              <div className="font-pixel text-xs text-arcade-cyan">OPPONENT</div>
              <div className="font-pixel text-sm text-gray-300 truncate">
                {match.challenger
                  ? `${match.challenger.slice(0, 6)}...${match.challenger.slice(-4)}`
                  : 'Waiting...'}
              </div>
            </div>
          </div>

          {/* Waiting for challenger */}
          {match.status === 'open' && (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center space-y-3">
                <div className="text-5xl animate-pulse">⏳</div>
                <div className="font-pixel text-arcade-green text-sm">WAITING FOR CHALLENGER</div>
                <div className="font-pixel text-xs text-gray-500">Share this match ID: #{match.displayNumber}</div>
                <div className="font-pixel text-xs text-gray-600 bg-black/40 px-4 py-2 rounded border border-arcade-green/20">
                  {matchId}
                </div>
                <div className="flex gap-2 justify-center">
                  {match.gameIds.map(gid => (
                    <span key={gid} className="text-2xl" title={GAME_INFO[gid]?.name}>
                      {GAME_INFO[gid]?.emoji}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Active match */}
          {match.status === 'active' && (
            <>
              {/* Round progress */}
              <div className="flex gap-1">
                {match.rounds.map((r, i) => {
                  const done = r.creatorFinished && r.challengerFinished;
                  const current = i === currentRound;
                  return (
                    <div
                      key={i}
                      className={`flex-1 h-1.5 rounded-full transition-all
                        ${done ? 'bg-arcade-green' :
                          current ? 'bg-arcade-cyan animate-pulse' :
                          'bg-gray-700'
                        }`}
                    />
                  );
                })}
              </div>

              {/* Score display */}
              <div className="grid grid-cols-2 gap-3">
                <ScorePanel
                  label="YOUR SCORE"
                  score={myRoundScore}
                  total={isCreator ? match.creatorTotalScore : match.challengerTotalScore}
                  finished={myRoundFinished}
                  isMe={true}
                />
                <ScorePanel
                  label="OPPONENT"
                  score={oppRoundScore}
                  total={isCreator ? match.challengerTotalScore : match.creatorTotalScore}
                  finished={oppRoundFinished}
                  isMe={false}
                  hidden={!bothFinished}
                />
              </div>

              {/* Game frame */}
              <div className="flex-1 bg-black rounded border border-arcade-green/30 min-h-[400px] relative overflow-hidden">
                {!myRoundFinished && isParticipant ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                    <div className="text-5xl">{roundGameInfo?.emoji}</div>
                    <div className="font-pixel text-arcade-green text-sm">
                      {roundGameInfo?.name?.toUpperCase()}
                    </div>
                    <p className="text-gray-500 font-pixel text-xs text-center px-4">
                      Game launches in the main game window. Return here to submit your score.
                    </p>
                    <Link
                      href={`/games/${round?.gameId}?pvp=1&matchId=${matchId}&round=${currentRound}`}
                      className="font-pixel text-xs px-6 py-3 bg-arcade-green/20 border border-arcade-green
                                 text-arcade-green rounded hover:bg-arcade-green/30 transition-all glow-green"
                    >
                      🎮 PLAY {roundGameInfo?.name?.toUpperCase()}
                    </Link>
                    {/* Dev/demo: manual score submit */}
                    <div className="mt-4 flex gap-2">
                      <span className="text-gray-600 font-pixel text-xs">Demo submit:</span>
                      {[1000, 5000, 10000, 25000].map(s => (
                        <button
                          key={s}
                          onClick={() => submitScore(s)}
                          disabled={submitting}
                          className="font-pixel text-xs px-2 py-1 border border-gray-600 text-gray-400 rounded hover:border-arcade-green hover:text-arcade-green transition-colors"
                        >{s.toLocaleString()}</button>
                      ))}
                    </div>
                  </div>
                ) : myRoundFinished && !bothFinished ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                    <div className="text-4xl animate-pulse">⏳</div>
                    <div className="font-pixel text-arcade-green text-sm">SCORE SUBMITTED!</div>
                    <div className="font-pixel text-xs text-gray-500">Waiting for opponent...</div>
                    <div className="font-pixel text-xs text-arcade-green">
                      Your score: {myScore?.toLocaleString()}
                    </div>
                  </div>
                ) : bothFinished ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                    <div className="text-4xl">🎯</div>
                    <div className="font-pixel text-sm text-arcade-green">ROUND {currentRound + 1} COMPLETE!</div>
                    <div className="font-pixel text-xs text-gray-400">
                      {round?.winner === me ? '🏆 YOU WIN THIS ROUND!' : '💔 OPPONENT WINS THIS ROUND'}
                    </div>
                    {currentRound < match.numGames - 1 && (
                      <button
                        onClick={() => setCurrentRound(r => r + 1)}
                        className="font-pixel text-xs px-4 py-2 bg-arcade-green/20 border border-arcade-green
                                   text-arcade-green rounded hover:bg-arcade-green/30 mt-2"
                      >▶ NEXT ROUND</button>
                    )}
                  </div>
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="font-pixel text-gray-600 text-xs">Spectating...</div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Match chat */}
        <ChatSidebar
          chatType="match"
          matchId={matchId}
          className="w-64 shrink-0 hidden lg:flex"
        />
      </div>
    </div>
  );
}

function ScorePanel({
  label, score, total, finished, isMe, hidden,
}: {
  label: string; score: number | null; total: number;
  finished: boolean; isMe: boolean; hidden?: boolean;
}) {
  return (
    <div className={`bg-black/40 border rounded p-3 text-center
      ${isMe ? 'border-arcade-green/40' : 'border-arcade-cyan/30'}`}>
      <div className={`font-pixel text-xs mb-1 ${isMe ? 'text-arcade-green' : 'text-arcade-cyan'}`}>
        {label}
      </div>
      {hidden ? (
        <div className="font-pixel text-2xl text-gray-700">🔒</div>
      ) : score !== null ? (
        <div className={`font-pixel text-2xl ${isMe ? 'text-arcade-green' : 'text-arcade-cyan'}`}>
          {score.toLocaleString()}
        </div>
      ) : (
        <div className="font-pixel text-2xl text-gray-600 animate-pulse">---</div>
      )}
      <div className="font-pixel text-xs text-gray-600 mt-1">
        TOTAL: {total.toLocaleString()}
      </div>
      {finished && !hidden && (
        <div className="font-pixel text-xs text-arcade-green mt-0.5">✓ DONE</div>
      )}
    </div>
  );
}
