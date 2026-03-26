'use client';

import { useState } from 'react';
import { BracketTournament, BracketMatchData, BracketRoundData, BracketParticipant, GAME_INFO } from '@/types/pvp';

interface BracketViewerProps {
  tournament: BracketTournament;
  participants: BracketParticipant[];
  currentAddress?: string;
}

const STATUS_COLORS = {
  pending: 'border-gray-700 bg-gray-900/40',
  active:  'border-arcade-cyan/60 bg-arcade-cyan/10 shadow-[0_0_8px_rgba(0,191,255,0.2)]',
  complete:'border-arcade-green/50 bg-arcade-green/10',
  bye:     'border-gray-800 bg-gray-900/20 opacity-60',
};

interface MatchModalData {
  match: BracketMatchData;
  roundName: string;
  roundIndex: number;
  matchIndex: number;
  p1Name: string;
  p2Name: string;
}

export default function BracketViewer({ tournament, participants, currentAddress }: BracketViewerProps) {
  const [selectedMatch, setSelectedMatch] = useState<MatchModalData | null>(null);
  const [view, setView] = useState<'bracket' | 'standings'>('bracket');

  const participantMap = Object.fromEntries(
    participants.map(p => [p.address, p])
  );

  const getName = (addr: string | null): string => {
    if (!addr || addr === 'BYE') return addr || 'TBD';
    const p = participantMap[addr];
    if (p?.displayName) return p.displayName;
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const getEarnings = (addr: string | null): number => {
    if (!addr) return 0;
    return participantMap[addr]?.totalEarnings || 0;
  };

  if (tournament.rounds.length === 0) {
    return (
      <div className="text-center py-12 space-y-3">
        <div className="text-5xl">🏆</div>
        <div className="font-pixel text-arcade-green text-sm">TOURNAMENT BRACKET</div>
        <div className="font-pixel text-xs text-gray-500">
          Bracket will be generated when the tournament starts.
        </div>
        <div className="font-pixel text-xs text-gray-600">
          {tournament.participants.length}/{tournament.maxParticipants} players registered
        </div>
        <div className="w-full bg-gray-800 rounded-full h-1.5 max-w-xs mx-auto">
          <div
            className="bg-arcade-green h-1.5 rounded-full transition-all"
            style={{ width: `${(tournament.participants.length / tournament.maxParticipants) * 100}%` }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* View toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => setView('bracket')}
          className={`font-pixel text-xs px-4 py-1.5 rounded border transition-colors
            ${view === 'bracket' ? 'border-arcade-green bg-arcade-green/20 text-arcade-green' : 'border-gray-600 text-gray-400 hover:border-gray-400'}`}
        >📊 BRACKET</button>
        <button
          onClick={() => setView('standings')}
          className={`font-pixel text-xs px-4 py-1.5 rounded border transition-colors
            ${view === 'standings' ? 'border-arcade-green bg-arcade-green/20 text-arcade-green' : 'border-gray-600 text-gray-400 hover:border-gray-400'}`}
        >🏅 STANDINGS</button>
      </div>

      {view === 'bracket' ? (
        <BracketTree
          rounds={tournament.rounds}
          getName={getName}
          getEarnings={getEarnings}
          currentAddress={currentAddress}
          prizePool={tournament.prizePool}
          prizeStructure={tournament.prizeStructure}
          onMatchClick={(match, round, ri, mi) =>
            setSelectedMatch({
              match, roundName: round.name, roundIndex: ri, matchIndex: mi,
              p1Name: getName(match.player1), p2Name: getName(match.player2),
            })
          }
        />
      ) : (
        <StandingsView
          participants={participants}
          rounds={tournament.rounds}
          getName={getName}
          tournament={tournament}
        />
      )}

      {/* Match detail modal */}
      {selectedMatch && (
        <MatchDetailModal
          data={selectedMatch}
          tournament={tournament}
          onClose={() => setSelectedMatch(null)}
        />
      )}
    </div>
  );
}

// ── Bracket Tree ────────────────────────────────────────────────────────────

function BracketTree({
  rounds, getName, getEarnings, currentAddress, prizePool, prizeStructure, onMatchClick,
}: {
  rounds: BracketRoundData[];
  getName: (addr: string | null) => string;
  getEarnings: (addr: string | null) => number;
  currentAddress?: string;
  prizePool: number;
  prizeStructure: { [place: number]: number };
  onMatchClick: (match: BracketMatchData, round: BracketRoundData, ri: number, mi: number) => void;
}) {
  const totalRounds = rounds.length;

  return (
    <div className="overflow-x-auto pb-4">
      <div
        className="flex gap-0 min-w-max"
        style={{ minWidth: `${totalRounds * 200}px` }}
      >
        {rounds.map((round, ri) => {
          const matchCount = round.matches.length;
          // Calculate vertical spacing to center-align matches
          const totalSlots = Math.pow(2, totalRounds - 1);
          const slotsPerMatch = totalSlots / matchCount;

          return (
            <div key={ri} className="flex flex-col" style={{ width: 192, marginRight: 16 }}>
              {/* Round header */}
              <div className="mb-3 text-center">
                <div className={`font-pixel text-xs px-2 py-1 rounded border inline-block
                  ${round.status === 'complete' ? 'border-arcade-green/50 text-arcade-green' :
                    round.status === 'active' ? 'border-arcade-cyan/50 text-arcade-cyan animate-pulse' :
                    'border-gray-600 text-gray-500'
                  }`}
                >
                  {round.name}
                </div>
              </div>

              {/* Matches column */}
              <div className="flex flex-col" style={{ gap: `${slotsPerMatch * 48}px` }}>
                {round.matches.map((match, mi) => (
                  <div key={mi} className="relative">
                    <BracketMatchCard
                      match={match}
                      getName={getName}
                      getEarnings={getEarnings}
                      currentAddress={currentAddress}
                      isLastRound={ri === totalRounds - 1}
                      prizePool={prizePool}
                      prizeStructure={prizeStructure}
                      onClick={() => onMatchClick(match, round, ri, mi)}
                    />
                    {/* Connector line to right (except last column) */}
                    {ri < totalRounds - 1 && (
                      <div className="absolute right-0 top-1/2 translate-x-full -translate-y-1/2
                                      w-4 h-px bg-arcade-green/20" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Match Card in Bracket ───────────────────────────────────────────────────

function BracketMatchCard({
  match, getName, getEarnings, currentAddress, isLastRound, prizePool, prizeStructure, onClick,
}: {
  match: BracketMatchData;
  getName: (addr: string | null) => string;
  getEarnings: (addr: string | null) => number;
  currentAddress?: string;
  isLastRound: boolean;
  prizePool: number;
  prizeStructure: { [place: number]: number };
  onClick: () => void;
}) {
  const isMyMatch = match.player1 === currentAddress || match.player2 === currentAddress;
  const p1 = match.player1;
  const p2 = match.player2;
  const p1Won = match.winner === p1;
  const p2Won = match.winner === p2;

  const statusClass = match.isBye
    ? STATUS_COLORS.bye
    : STATUS_COLORS[match.status] || STATUS_COLORS.pending;

  const borderClass = isMyMatch
    ? '!border-yellow-400/60 shadow-[0_0_12px_rgba(255,200,0,0.2)]'
    : '';

  return (
    <button
      onClick={onClick}
      className={`w-full text-left border rounded transition-all hover:opacity-90
                  ${statusClass} ${borderClass}`}
    >
      {/* Player 1 row */}
      <PlayerRow
        address={p1}
        name={getName(p1)}
        score={match.player1Score}
        isWinner={p1Won}
        isLoser={match.status === 'complete' && !p1Won && p1 !== 'BYE' && p1 !== null}
        isBye={p1 === 'BYE'}
        earnings={isLastRound && p1Won ? getEarnings(p1) : 0}
        finished={match.player1Finished}
        currentAddress={currentAddress}
      />

      {/* Divider */}
      <div className="border-t border-current opacity-10 mx-1" />

      {/* Player 2 row */}
      <PlayerRow
        address={p2}
        name={getName(p2)}
        score={match.player2Score}
        isWinner={p2Won}
        isLoser={match.status === 'complete' && !p2Won && p2 !== 'BYE' && p2 !== null}
        isBye={p2 === 'BYE'}
        earnings={isLastRound && p2Won ? getEarnings(p2) : 0}
        finished={match.player2Finished}
        currentAddress={currentAddress}
      />

      {/* Match status badge */}
      {match.status === 'active' && (
        <div className="px-2 pb-1">
          <span className="font-pixel text-xs text-arcade-cyan animate-pulse">▶ IN PROGRESS</span>
        </div>
      )}
      {match.isBye && (
        <div className="px-2 pb-1">
          <span className="font-pixel text-xs text-gray-600">BYE</span>
        </div>
      )}
    </button>
  );
}

function PlayerRow({
  address, name, score, isWinner, isLoser, isBye, earnings, finished, currentAddress,
}: {
  address: string | null;
  name: string;
  score: number | null;
  isWinner: boolean;
  isLoser: boolean;
  isBye: boolean;
  earnings: number;
  finished: boolean;
  currentAddress?: string;
}) {
  const isMe = address === currentAddress;
  const isEmpty = !address && !isBye;

  return (
    <div className={`flex items-center justify-between px-2 py-1.5 gap-1
      ${isWinner ? 'bg-arcade-green/10' : isLoser ? 'opacity-40' : ''}`}
    >
      <div className="flex items-center gap-1 min-w-0 flex-1">
        {isWinner && <span className="text-yellow-400 text-xs shrink-0">🏆</span>}
        {isMe && !isWinner && <span className="text-yellow-400 text-xs shrink-0">★</span>}
        <span className={`font-pixel text-xs truncate
          ${isWinner ? 'text-arcade-green' :
            isEmpty || isBye ? 'text-gray-700' :
            isMe ? 'text-yellow-300' :
            'text-gray-300'
          }`}
        >
          {isBye ? 'BYE' : isEmpty ? 'TBD' : name}
        </span>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        {score !== null && !isEmpty && !isBye && (
          <span className={`font-pixel text-xs
            ${isWinner ? 'text-arcade-green' : 'text-gray-500'}`}
          >
            {score.toLocaleString()}
          </span>
        )}
        {finished && !isEmpty && !isBye && score === null && (
          <span className="text-xs text-arcade-green/50">✓</span>
        )}
        {earnings > 0 && (
          <span className="font-pixel text-xs text-yellow-400">
            +{earnings >= 1000 ? `${(earnings/1000).toFixed(1)}K` : earnings}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Standings View ──────────────────────────────────────────────────────────

function StandingsView({
  participants, rounds, getName, tournament,
}: {
  participants: BracketParticipant[];
  rounds: BracketRoundData[];
  getName: (addr: string | null) => string;
  tournament: BracketTournament;
}) {
  const totalRounds = rounds.length;

  const sorted = [...participants].sort((a, b) => {
    if (a.isEliminated !== b.isEliminated) return a.isEliminated ? 1 : -1;
    if (a.eliminatedRound !== b.eliminatedRound) {
      return (b.eliminatedRound ?? totalRounds) - (a.eliminatedRound ?? totalRounds);
    }
    return b.totalEarnings - a.totalEarnings;
  });

  return (
    <div className="space-y-1">
      <div className="grid grid-cols-12 gap-2 px-3 py-1.5 text-xs font-pixel text-gray-600 border-b border-gray-800">
        <span className="col-span-1">#</span>
        <span className="col-span-4">PLAYER</span>
        <span className="col-span-3">STATUS</span>
        <span className="col-span-2">ROUNDS</span>
        <span className="col-span-2 text-right">EARNINGS</span>
      </div>

      {sorted.map((p, i) => {
        const place = i + 1;
        const placeEmoji = place === 1 ? '🥇' : place === 2 ? '🥈' : place === 3 ? '🥉' : `${place}.`;

        return (
          <div
            key={p.address}
            className={`grid grid-cols-12 gap-2 px-3 py-2 rounded transition-colors
              ${!p.isEliminated ? 'bg-arcade-green/5 border border-arcade-green/20' :
                'border border-transparent hover:border-gray-700'
              }`}
          >
            <span className="col-span-1 font-pixel text-xs text-gray-400">{placeEmoji}</span>
            <span className="col-span-4 font-pixel text-xs text-gray-300 truncate">
              {getName(p.address)}
            </span>
            <span className={`col-span-3 font-pixel text-xs
              ${!p.isEliminated ? 'text-arcade-green' : 'text-gray-600'}`}
            >
              {!p.isEliminated ? '✓ Active' :
                p.eliminatedRound != null
                  ? `Rd ${p.eliminatedRound + 1} out`
                  : 'Eliminated'
              }
            </span>
            <span className="col-span-2 font-pixel text-xs text-gray-500">
              {p.matchHistory?.length || 0} W
            </span>
            <span className={`col-span-2 font-pixel text-xs text-right
              ${p.totalEarnings > 0 ? 'text-arcade-green' : 'text-gray-700'}`}
            >
              {p.totalEarnings > 0 ? `+${p.totalEarnings.toLocaleString()}` : '-'}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Match Detail Modal ──────────────────────────────────────────────────────

function MatchDetailModal({
  data, tournament, onClose,
}: {
  data: MatchModalData;
  tournament: BracketTournament;
  onClose: () => void;
}) {
  const { match, roundName, p1Name, p2Name } = data;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-arcade-dark border border-arcade-green/40 rounded-lg w-full max-w-md">
        <div className="flex items-center justify-between px-4 py-3 border-b border-arcade-green/20">
          <h3 className="font-pixel text-arcade-green text-xs">{roundName} — Match Detail</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-red-400 font-pixel text-sm">✕</button>
        </div>

        <div className="p-4 space-y-4">
          {/* Players */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { name: p1Name, score: match.player1Score, isWinner: match.winner === match.player1, addr: match.player1 },
              { name: p2Name, score: match.player2Score, isWinner: match.winner === match.player2, addr: match.player2 },
            ].map((p, i) => (
              <div key={i} className={`rounded p-3 border text-center
                ${p.isWinner ? 'border-arcade-green/50 bg-arcade-green/10' :
                  match.status === 'complete' ? 'border-gray-700 opacity-60' :
                  'border-gray-700'
                }`}
              >
                {p.isWinner && <div className="font-pixel text-xs text-yellow-400 mb-1">🏆 WINNER</div>}
                <div className="font-pixel text-xs text-gray-300 truncate">{p.name}</div>
                {p.score !== null && (
                  <div className={`font-pixel text-lg mt-1 ${p.isWinner ? 'text-arcade-green' : 'text-gray-500'}`}>
                    {p.score.toLocaleString()}
                  </div>
                )}
                {match.status === 'active' && (
                  <div className="font-pixel text-xs text-arcade-cyan animate-pulse mt-1">
                    {i === 0 ? (match.player1Finished ? '✓ Done' : 'Playing...') :
                               (match.player2Finished ? '✓ Done' : 'Playing...')}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Games played */}
          <div>
            <div className="font-pixel text-xs text-gray-600 mb-2">GAMES IN THIS MATCH:</div>
            <div className="flex flex-wrap gap-2">
              {tournament.gameIds.map(gid => {
                const info = GAME_INFO[gid];
                return (
                  <span key={gid} className="font-pixel text-xs px-2 py-1 bg-black/40 border border-gray-700 rounded">
                    {info?.emoji} {info?.name}
                  </span>
                );
              })}
            </div>
          </div>

          {/* Status */}
          <div className="text-center font-pixel text-xs text-gray-500">
            {match.status === 'pending' && 'Waiting to start...'}
            {match.status === 'active' && '▶ Match in progress'}
            {match.status === 'complete' && '✅ Complete'}
            {match.status === 'bye' && 'Bye — auto advance'}
          </div>

          {/* Winnings */}
          {match.winnerPrize > 0 && match.status === 'complete' && (
            <div className="bg-black/30 border border-yellow-500/30 rounded p-2 text-center">
              <span className="font-pixel text-xs text-yellow-400">
                Prize: {match.winnerPrize.toLocaleString()} 8BIT
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
