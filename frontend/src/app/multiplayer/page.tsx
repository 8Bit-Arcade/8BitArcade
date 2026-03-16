'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAccount, useReadContract } from 'wagmi';
import Link from 'next/link';
import { callFunction } from '@/lib/firebase-functions';
import { getFirestoreInstance } from '@/lib/firebase-client';
import CreateChallengeModal from '@/components/multiplayer/CreateChallengeModal';
import ChatSidebar from '@/components/chat/ChatSidebar';
import { PvpMatch, GAME_INFO } from '@/types/pvp';
import { CONTRACTS } from '@/config/contracts';
import { useDisplayName } from '@/stores/authStore';

type LobbyTab = 'open' | 'active' | 'recent';

function truncateAddress(addr: string) {
  if (!addr) return '';
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

// Firestore Timestamps are serialized by the Admin SDK as {_seconds, _nanoseconds}
function parseTs(ts: any): Date {
  if (!ts) return new Date(0);
  if (typeof ts.toDate === 'function') return ts.toDate();
  const secs = ts._seconds ?? ts.seconds;
  if (secs !== undefined) return new Date(secs * 1000);
  return new Date(Number(ts) * 1000);
}

function timeAgo(ts: any): string {
  if (!ts) return '';
  const diff = Date.now() - parseTs(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
}

function timeLeft(ts: any): string {
  if (!ts) return '';
  const remaining = parseTs(ts).getTime() - Date.now();
  if (remaining <= 0) return 'Expired';
  const mins = Math.floor(remaining / 60000);
  if (mins < 60) return `${mins}m left`;
  return `${Math.floor(mins / 60)}h left`;
}

export default function MultiplayerLobbyPage() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const displayName = useDisplayName(address);

  const [tab, setTab] = useState<LobbyTab>('open');
  const tabRef = useRef<LobbyTab>('open');
  useEffect(() => { tabRef.current = tab; }, [tab]);
  const [openMatches, setOpenMatches] = useState<PvpMatch[]>([]);
  const [activeMatches, setActiveMatches] = useState<PvpMatch[]>([]);
  const [recentMatches, setRecentMatches] = useState<PvpMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [joiningMatchId, setJoiningMatchId] = useState<string | null>(null);
  const [error, setError] = useState('');

  // 8BIT balance
  const { data: balanceData } = useReadContract({
    address: CONTRACTS.EIGHT_BIT_TOKEN as `0x${string}`,
    abi: [{ name: 'balanceOf', type: 'function', stateMutability: 'view',
            inputs: [{ name: 'account', type: 'address' }],
            outputs: [{ name: '', type: 'uint256' }] }],
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const userBalance = balanceData
    ? Math.floor(Number(balanceData) / 1e18)
    : 0;

  // On initial load fetch all three tabs at once.
  // On interval, only refresh the currently visible tab to avoid triple reads every cycle.
  const fetchMatches = useCallback(async (initialLoad = false) => {
    try {
      if (initialLoad) {
        const [openRes, activeRes, recentRes] = await Promise.all([
          callFunction<any, any>('getPvpMatches', { status: 'open', limit: 30 }),
          callFunction<any, any>('getPvpMatches', { status: 'active', limit: 20 }),
          callFunction<any, any>('getPvpMatches', { status: 'completed', limit: 20 }),
        ]);
        setOpenMatches(openRes.matches || []);
        setActiveMatches(activeRes.matches || []);
        setRecentMatches(recentRes.matches || []);
      } else {
        const currentTab = tabRef.current;
        const status = currentTab === 'open' ? 'open' : currentTab === 'active' ? 'active' : 'completed';
        const res = await callFunction<any, any>('getPvpMatches', { status, limit: 30 });
        if (currentTab === 'open') setOpenMatches(res.matches || []);
        else if (currentTab === 'active') setActiveMatches(res.matches || []);
        else setRecentMatches(res.matches || []);
      }
    } catch (err) {
      console.error('Failed to fetch matches:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMatches(true);
    // Poll every 60s (was 15s × 3 tabs = 12 Cloud Function calls/min; now 1/min)
    const interval = setInterval(() => fetchMatches(false), 60000);
    return () => clearInterval(interval);
  }, [fetchMatches]);

  const handleJoin = async (match: PvpMatch) => {
    if (!isConnected || !address) return;
    if (match.betAmount > 0 && userBalance < match.betAmount) {
      setError(`Insufficient balance. Need ${match.betAmount.toLocaleString()} 8BIT.`);
      return;
    }

    setJoiningMatchId(match.id);
    setError('');

    try {
      await callFunction('joinPvpMatch', { matchId: match.id });
      router.push(`/multiplayer/match?id=${match.id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to join match');
    } finally {
      setJoiningMatchId(null);
    }
  };

  const handleJoinRandom = async () => {
    const affordable = openMatches.filter(m =>
      m.creator !== address?.toLowerCase() &&
      (m.betAmount === 0 || userBalance >= m.betAmount)
    );
    if (affordable.length === 0) {
      setError('No suitable open matches. Create one!');
      return;
    }
    const random = affordable[Math.floor(Math.random() * affordable.length)];
    await handleJoin(random);
  };

  const currentMatches = tab === 'open' ? openMatches : tab === 'active' ? activeMatches : recentMatches;

  return (
    <div className="min-h-screen bg-arcade-dark flex flex-col">
      {/* Page header */}
      <div className="border-b border-arcade-green/20 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="font-pixel text-arcade-green text-lg glow-green">⚔️ MULTIPLAYER ARENA</h1>
            <p className="text-gray-500 font-pixel text-xs mt-0.5">Head-to-head PvP — Testnet Arbitrum Sepolia</p>
          </div>
          <div className="flex items-center gap-3">
            {isConnected && (
              <div className="text-right">
                <div className="font-pixel text-xs text-gray-400">{displayName || truncateAddress(address!)}</div>
                <div className="font-pixel text-xs text-arcade-green">{userBalance.toLocaleString()} 8BIT</div>
              </div>
            )}
            <Link
              href="/profile/edit"
              className="font-pixel text-xs px-3 py-1.5 border border-gray-600 text-gray-400
                         rounded hover:border-arcade-green/50 hover:text-arcade-green transition-colors"
            >👤 PROFILE</Link>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-1 max-w-7xl mx-auto w-full">
        {/* Left: Lobby */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Action bar */}
          <div className="px-4 py-3 border-b border-arcade-green/10 flex flex-wrap gap-2">
            <button
              onClick={() => setShowCreateModal(true)}
              disabled={!isConnected}
              className="font-pixel text-xs px-4 py-2 bg-arcade-green/20 border border-arcade-green
                         text-arcade-green rounded hover:bg-arcade-green/30 transition-all
                         disabled:opacity-40 disabled:cursor-not-allowed glow-green"
            >
              ⚔️ CREATE CHALLENGE
            </button>
            <button
              onClick={handleJoinRandom}
              disabled={!isConnected || openMatches.length === 0}
              className="font-pixel text-xs px-4 py-2 bg-arcade-cyan/10 border border-arcade-cyan/50
                         text-arcade-cyan rounded hover:bg-arcade-cyan/20 transition-all
                         disabled:opacity-40 disabled:cursor-not-allowed"
            >
              🎲 JOIN RANDOM
            </button>
            <Link
              href="/tournaments/brackets"
              className="font-pixel text-xs px-4 py-2 border border-yellow-500/50 text-yellow-400
                         rounded hover:bg-yellow-500/10 transition-all"
            >
              🏆 TOURNAMENTS
            </Link>

            <div className="ml-auto flex items-center gap-1 text-gray-500 font-pixel text-xs">
              <span className="w-2 h-2 bg-arcade-green rounded-full animate-pulse inline-block"></span>
              {openMatches.length} open · {activeMatches.length} active
            </div>
          </div>

          {error && (
            <div className="mx-4 mt-3 px-3 py-2 bg-red-900/20 border border-red-500/40 rounded">
              <p className="text-red-400 font-pixel text-xs">⚠ {error}</p>
            </div>
          )}

          {/* Tabs */}
          <div className="flex border-b border-arcade-green/10 px-4">
            {([
              ['open', `⚔️ OPEN (${openMatches.length})`],
              ['active', `▶️ ACTIVE (${activeMatches.length})`],
              ['recent', '🏆 RECENT'],
            ] as [LobbyTab, string][]).map(([t, label]) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`font-pixel text-xs px-4 py-2.5 border-b-2 transition-colors
                  ${tab === t
                    ? 'border-arcade-green text-arcade-green'
                    : 'border-transparent text-gray-500 hover:text-gray-300'
                  }`}
              >{label}</button>
            ))}
          </div>

          {/* Match list */}
          <div className="flex-1 overflow-y-auto p-4">
            {loading ? (
              <div className="text-center py-12">
                <div className="font-pixel text-arcade-green text-sm animate-pulse">LOADING...</div>
              </div>
            ) : currentMatches.length === 0 ? (
              <div className="text-center py-12 space-y-2">
                <div className="text-4xl">
                  {tab === 'open' ? '⚔️' : tab === 'active' ? '🎮' : '🏆'}
                </div>
                <p className="font-pixel text-gray-500 text-xs">
                  {tab === 'open' ? 'No open challenges. Create one!' :
                   tab === 'active' ? 'No active matches right now.' :
                   'No completed matches yet.'}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {currentMatches.map(match => (
                  <MatchCard
                    key={match.id}
                    match={match}
                    currentAddress={address?.toLowerCase()}
                    userBalance={userBalance}
                    isJoining={joiningMatchId === match.id}
                    onJoin={() => handleJoin(match)}
                    onView={() => router.push(`/multiplayer/match?id=${match.id}`)}
                    onResults={() => router.push(`/multiplayer/results?id=${match.id}`)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Chat sidebar */}
        <ChatSidebar
          chatType="arena"
          className="w-72 shrink-0 hidden lg:flex"
        />
      </div>

      {showCreateModal && (
        <CreateChallengeModal
          onClose={() => setShowCreateModal(false)}
          onCreated={(matchId) => {
            setShowCreateModal(false);
            router.push(`/multiplayer/match?id=${matchId}`);
          }}
          userBalance={userBalance}
        />
      )}
    </div>
  );
}

// ── Match Card ────────────────────────────────────────────────────────────────

interface MatchCardProps {
  match: PvpMatch;
  currentAddress?: string;
  userBalance: number;
  isJoining: boolean;
  onJoin: () => void;
  onView: () => void;
  onResults: () => void;
}

function MatchCard({ match, currentAddress, userBalance, isJoining, onJoin, onView, onResults }: MatchCardProps) {
  const isCreator = match.creator === currentAddress;
  const isChallenger = match.challenger === currentAddress;
  const isParticipant = isCreator || isChallenger;
  const canAfford = match.betAmount === 0 || userBalance >= match.betAmount;
  const canJoin = match.status === 'open' && !isCreator && !isChallenger && canAfford;

  const gameLabels = match.gameIds.slice(0, 3).map(g => GAME_INFO[g]?.emoji || '🎮').join('');
  const moreGames = match.gameIds.length > 3 ? `+${match.gameIds.length - 3}` : '';

  return (
    <div className={`border rounded p-3 transition-all
      ${match.status === 'open' ? 'border-arcade-green/30 bg-arcade-green/5 hover:border-arcade-green/60' :
        match.status === 'active' ? 'border-arcade-cyan/30 bg-arcade-cyan/5' :
        match.status === 'completed' ? 'border-gray-700 bg-gray-900/30' :
        'border-gray-800 bg-gray-900/20 opacity-60'
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        {/* Left: match info */}
        <div className="flex items-center gap-3 min-w-0">
          {/* Status dot */}
          <div className={`w-2 h-2 rounded-full shrink-0
            ${match.status === 'open' ? 'bg-arcade-green animate-pulse' :
              match.status === 'active' ? 'bg-arcade-cyan animate-pulse' :
              match.status === 'completed' ? 'bg-yellow-400' : 'bg-gray-600'
            }`} />

          {/* Match number */}
          <span className="font-pixel text-xs text-gray-500 shrink-0">#{match.displayNumber}</span>

          {/* Creator name */}
          <span className="font-pixel text-xs text-gray-300 truncate max-w-[80px]">
            {match.creator.slice(0, 6)}...{match.creator.slice(-4)}
          </span>

          {/* Games */}
          <span className="font-pixel text-xs text-gray-400 shrink-0">
            {gameLabels}{moreGames} · {match.numGames}G
          </span>

          {/* Bet */}
          <span className={`font-pixel text-xs shrink-0
            ${match.betAmount > 0 ? 'text-yellow-400' : 'text-gray-600'}`}>
            {match.betAmount > 0 ? `💎 ${match.betAmount.toLocaleString()}` : 'FREE'}
          </span>

          {/* Timer */}
          {match.status === 'open' && match.expiresAt && (
            <span className="font-pixel text-xs text-gray-600 shrink-0">
              ⏱ {timeLeft(match.expiresAt)}
            </span>
          )}
        </div>

        {/* Right: action button */}
        <div className="shrink-0">
          {match.status === 'open' && canJoin && (
            <button
              onClick={onJoin}
              disabled={isJoining}
              className="font-pixel text-xs px-3 py-1.5 bg-arcade-green/20 border border-arcade-green
                         text-arcade-green rounded hover:bg-arcade-green/30 transition-all
                         disabled:opacity-40"
            >{isJoining ? '...' : '⚔️ JOIN'}</button>
          )}
          {match.status === 'open' && !canJoin && !isCreator && (
            <span className="font-pixel text-xs text-gray-600">🔒 Need {match.betAmount.toLocaleString()}</span>
          )}
          {match.status === 'open' && isCreator && (
            <button
              onClick={onView}
              className="font-pixel text-xs px-3 py-1.5 border border-gray-600 text-gray-400
                         rounded hover:border-gray-400 transition-colors"
            >WAITING...</button>
          )}
          {match.status === 'active' && isParticipant && (
            <button
              onClick={onView}
              className="font-pixel text-xs px-3 py-1.5 bg-arcade-cyan/20 border border-arcade-cyan
                         text-arcade-cyan rounded hover:bg-arcade-cyan/30 transition-all animate-pulse"
            >▶️ PLAY</button>
          )}
          {match.status === 'active' && !isParticipant && (
            <button
              onClick={onView}
              className="font-pixel text-xs px-3 py-1.5 border border-gray-600 text-gray-400
                         rounded hover:border-gray-400 transition-colors"
            >👁 WATCH</button>
          )}
          {match.status === 'completed' && (
            <button
              onClick={onResults}
              className="font-pixel text-xs px-3 py-1.5 border border-yellow-500/50 text-yellow-400
                         rounded hover:bg-yellow-500/10 transition-colors"
            >🏆 RESULTS</button>
          )}
        </div>
      </div>

      {/* Completed match winner line */}
      {match.status === 'completed' && match.winner && (
        <div className="mt-2 pt-2 border-t border-gray-700 font-pixel text-xs text-gray-500">
          Winner: <span className="text-yellow-400">
            {match.winner.slice(0, 6)}...{match.winner.slice(-4)}
          </span>
          <span className="mx-2">·</span>
          <span className="text-gray-500">
            {match.creatorTotalScore.toLocaleString()} vs {match.challengerTotalScore.toLocaleString()}
          </span>
          {match.betAmount > 0 && (
            <span className="ml-2 text-arcade-green">
              +{Math.floor(match.betAmount * 2 * 0.95).toLocaleString()} 8BIT
            </span>
          )}
        </div>
      )}
    </div>
  );
}
