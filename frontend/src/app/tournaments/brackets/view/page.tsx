'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAccount } from 'wagmi';
import Link from 'next/link';
import { callFunction } from '@/lib/firebase-functions';
import BracketViewer from '@/components/bracket/BracketViewer';
import { BracketTournament, BracketParticipant, GAME_INFO } from '@/types/pvp';
import { getFirestoreInstance } from '@/lib/firebase-client';

function formatDate(ts: any): string {
  if (!ts) return '—';
  let d: Date;
  if (typeof ts.toDate === 'function') d = ts.toDate();
  else { const s = ts._seconds ?? ts.seconds; d = new Date(s * 1000); }
  return d.toLocaleString([], { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function BracketTournamentPage() {
  const [id, setId] = useState<string>('');
  useEffect(() => {
    setId(new URLSearchParams(window.location.search).get('id') ?? '');
  }, []);
  const { address } = useAccount();
  const [tournament, setTournament] = useState<BracketTournament | null>(null);
  const [participants, setParticipants] = useState<BracketParticipant[]>([]);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [joined, setJoined] = useState(false);
  const [error, setError] = useState('');

  const me = address?.toLowerCase();
  const isRegistered = me && tournament?.participants.includes(me);

  // Real-time listener
  useEffect(() => {
    if (!id) return;
    let unsubscribe: (() => void) | null = null;

    const setup = async () => {
      try {
        const db = await getFirestoreInstance();
        const { doc, onSnapshot, collection, query, orderBy } = await import('firebase/firestore');

        unsubscribe = onSnapshot(doc(db, 'bracketTournaments', id), async (snap) => {
          if (snap.exists()) {
            setTournament(snap.data() as BracketTournament);
          }
          setLoading(false);
        });

        // Load participants
        const pSnap = await (await import('firebase/firestore')).getDocs(
          query(collection(db, `bracketTournaments/${id}/participants`), orderBy('seed'))
        );
        setParticipants(pSnap.docs.map(d => d.data() as BracketParticipant));
      } catch (err) {
        setLoading(false);
      }
    };

    setup();
    return () => unsubscribe?.();
  }, [id]);

  const handleJoin = async () => {
    if (!me || joining) return;
    setJoining(true);
    setError('');
    try {
      await callFunction('joinBracketTournament', { tournamentId: id });
      setJoined(true);
    } catch (err: any) {
      setError(err.message || 'Failed to join');
    } finally {
      setJoining(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-arcade-dark flex items-center justify-center">
        <div className="font-pixel text-arcade-green animate-pulse">LOADING TOURNAMENT...</div>
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="min-h-screen bg-arcade-dark flex items-center justify-center">
        <div className="text-center space-y-2">
          <div className="font-pixel text-red-400">TOURNAMENT NOT FOUND</div>
          <Link href="/tournaments/brackets" className="font-pixel text-xs text-arcade-green hover:underline">
            ← Back to Tournaments
          </Link>
        </div>
      </div>
    );
  }

  const fillPct = Math.round((tournament.participants.length / tournament.maxParticipants) * 100);

  return (
    <div className="min-h-screen bg-arcade-dark px-4 py-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 font-pixel text-xs text-gray-600">
          <Link href="/tournaments/brackets" className="hover:text-arcade-green transition-colors">Tournaments</Link>
          <span>›</span>
          <span className="text-gray-400">{tournament.name}</span>
        </div>

        {/* Tournament header */}
        <div className="bg-black/30 border border-arcade-green/30 rounded-xl p-5">
          <div className="flex flex-wrap gap-4 justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="font-pixel text-gray-500 text-sm">#{tournament.displayNumber}</span>
                <h1 className="font-pixel text-arcade-green text-xl">{tournament.name}</h1>
                <TournamentStatusBadge status={tournament.status} />
              </div>
              {tournament.description && (
                <p className="text-gray-400 text-sm max-w-xl">{tournament.description}</p>
              )}
              <div className="flex flex-wrap gap-3 text-xs font-pixel">
                <span className="text-gray-500">
                  {tournament.format === 'single' ? '🔱 Single Elimination' : '⚔️ Double Elimination'}
                </span>
                <span className="text-gray-500">
                  {tournament.gameScope === 'all' ? '🎮 All 12 Games' :
                   tournament.gameScope === 'single' ? `${GAME_INFO[tournament.gameIds[0]]?.emoji} ${GAME_INFO[tournament.gameIds[0]]?.name}` :
                   `🎮 ${tournament.gameIds.length} Games`}
                </span>
                <span className="text-gray-500">⏱ {tournament.roundDurationMinutes}min/round</span>
              </div>
            </div>

            <div className="space-y-2 text-right">
              {tournament.prizePool > 0 && (
                <div>
                  <div className="font-pixel text-xs text-gray-500">PRIZE POOL</div>
                  <div className="font-pixel text-2xl text-arcade-green glow-green">
                    {tournament.prizePool.toLocaleString()} 8BIT
                  </div>
                  <PrizeBreakdown structure={tournament.prizeStructure} pool={tournament.prizePool} />
                </div>
              )}
              {tournament.entryFee > 0 ? (
                <div className="font-pixel text-xs text-yellow-400">
                  💎 {tournament.entryFee.toLocaleString()} 8BIT entry
                </div>
              ) : (
                <div className="font-pixel text-xs text-gray-600">FREE TO ENTER</div>
              )}
            </div>
          </div>

          {/* Timeline */}
          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3 pt-4 border-t border-arcade-green/10">
            <TimelineItem label="REGISTRATION OPENS" value={formatDate(tournament.registrationStart)} />
            <TimelineItem label="REGISTRATION CLOSES" value={formatDate(tournament.registrationEnd)} />
            <TimelineItem label="TOURNAMENT STARTS" value={tournament.startTime ? formatDate(tournament.startTime) : 'TBD'} />
            <TimelineItem label="TOURNAMENT ENDS" value={tournament.endTime ? formatDate(tournament.endTime) : 'TBD'} />
          </div>

          {/* Player fill */}
          <div className="mt-4 flex items-center gap-3">
            <div className="flex-1 bg-gray-800 rounded-full h-2">
              <div
                className="h-2 rounded-full bg-arcade-green transition-all"
                style={{ width: `${fillPct}%` }}
              />
            </div>
            <span className="font-pixel text-xs text-gray-400 shrink-0">
              {tournament.participants.length} / {tournament.maxParticipants} players
            </span>
          </div>

          {/* Join button */}
          {tournament.status === 'registration' && me && !isRegistered && !joined && (
            <div className="mt-4 flex items-center gap-3">
              <button
                onClick={handleJoin}
                disabled={joining || tournament.participants.length >= tournament.maxParticipants}
                className="font-pixel text-sm px-6 py-2.5 bg-arcade-green/20 border border-arcade-green
                           text-arcade-green rounded hover:bg-arcade-green/30 transition-all
                           disabled:opacity-40 disabled:cursor-not-allowed glow-green"
              >
                {joining ? 'REGISTERING...' : `⚔️ REGISTER — ${tournament.entryFee > 0 ? `${tournament.entryFee.toLocaleString()} 8BIT` : 'FREE'}`}
              </button>
              {error && <span className="font-pixel text-xs text-red-400">{error}</span>}
            </div>
          )}
          {(isRegistered || joined) && tournament.status === 'registration' && (
            <div className="mt-4 font-pixel text-xs text-arcade-green">
              ✓ You are registered! Tournament starts {tournament.startTime ? formatDate(tournament.startTime) : 'soon'}.
            </div>
          )}
        </div>

        {/* Games used */}
        {tournament.gameIds.length > 1 && (
          <div>
            <div className="font-pixel text-xs text-gray-500 mb-2">GAMES IN THIS TOURNAMENT:</div>
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
        )}

        {/* Bracket Viewer */}
        <div className="bg-black/20 border border-arcade-green/20 rounded-xl p-4">
          <BracketViewer
            tournament={tournament}
            participants={participants}
            currentAddress={me}
          />
        </div>
      </div>
    </div>
  );
}

function TournamentStatusBadge({ status }: { status: string }) {
  const classes: Record<string, string> = {
    registration: 'border-arcade-cyan/60 text-arcade-cyan bg-arcade-cyan/10',
    active:       'border-arcade-green/60 text-arcade-green bg-arcade-green/10 animate-pulse',
    paused:       'border-yellow-400/60 text-yellow-400 bg-yellow-400/10',
    completed:    'border-gray-500 text-gray-400 bg-gray-800/40',
    cancelled:    'border-red-500/60 text-red-400 bg-red-900/10',
  };
  const labels: Record<string, string> = {
    registration: 'REGISTRATION OPEN',
    active:       'IN PROGRESS',
    paused:       'PAUSED',
    completed:    'COMPLETED',
    cancelled:    'CANCELLED',
  };
  return (
    <span className={`font-pixel text-xs px-2 py-0.5 border rounded ${classes[status] || 'border-gray-600 text-gray-400'}`}>
      {labels[status] || status.toUpperCase()}
    </span>
  );
}

function PrizeBreakdown({ structure, pool }: { structure: { [k: number]: number }; pool: number }) {
  const places = Object.entries(structure)
    .map(([p, pct]) => ({ place: parseInt(p), pct: pct as number, amount: Math.floor(pool * (pct as number) / 100) }))
    .sort((a, b) => a.place - b.place)
    .slice(0, 4);

  const placeEmojis = ['🥇', '🥈', '🥉', '4️⃣'];

  return (
    <div className="flex gap-2 mt-1">
      {places.map(({ place, amount }) => (
        <div key={place} className="text-center">
          <div className="text-xs">{placeEmojis[place - 1]}</div>
          <div className="font-pixel text-xs text-gray-400">
            {amount >= 1000 ? `${(amount / 1000).toFixed(0)}K` : amount}
          </div>
        </div>
      ))}
    </div>
  );
}

function TimelineItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-pixel text-xs text-gray-600">{label}</div>
      <div className="font-pixel text-xs text-gray-300 mt-0.5">{value}</div>
    </div>
  );
}
