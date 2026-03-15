'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { callFunction } from '@/lib/firebase-functions';
import { BracketTournament, GAME_INFO } from '@/types/pvp';

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  registration: { label: 'REGISTRATION OPEN', color: 'text-arcade-cyan' },
  active:       { label: 'IN PROGRESS',        color: 'text-arcade-green animate-pulse' },
  paused:       { label: 'PAUSED',              color: 'text-yellow-400' },
  completed:    { label: 'COMPLETED',            color: 'text-gray-400' },
  cancelled:    { label: 'CANCELLED',            color: 'text-red-400' },
};

function formatDate(ts: any): string {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts.seconds * 1000);
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function BracketTournamentsListPage() {
  const [tournaments, setTournaments] = useState<BracketTournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'registration' | 'active' | 'completed'>('all');

  useEffect(() => {
    const load = async () => {
      try {
        const res = await callFunction<any, any>('getBracketTournaments', { limit: 50 });
        setTournaments(res.tournaments || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filtered = tournaments.filter(t =>
    filter === 'all' || t.status === filter
  );

  return (
    <div className="min-h-screen bg-arcade-dark px-4 py-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-pixel text-arcade-green text-xl glow-green">🏆 BRACKET TOURNAMENTS</h1>
            <p className="font-pixel text-xs text-gray-500 mt-1">
              Single & double elimination — Testnet Arbitrum Sepolia
            </p>
          </div>
          <Link
            href="/multiplayer"
            className="font-pixel text-xs px-3 py-1.5 border border-arcade-cyan/50 text-arcade-cyan
                       rounded hover:bg-arcade-cyan/10 transition-colors"
          >⚔️ PvP LOBBY</Link>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 flex-wrap">
          {(['all', 'registration', 'active', 'completed'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`font-pixel text-xs px-3 py-1.5 rounded border transition-colors
                ${filter === f
                  ? 'border-arcade-green bg-arcade-green/20 text-arcade-green'
                  : 'border-gray-700 text-gray-500 hover:border-gray-500'
                }`}
            >
              {f.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Tournament list */}
        {loading ? (
          <div className="text-center py-12 font-pixel text-arcade-green animate-pulse">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 space-y-3">
            <div className="text-4xl">🏆</div>
            <p className="font-pixel text-gray-500 text-xs">No bracket tournaments yet.</p>
            <p className="font-pixel text-gray-600 text-xs">Admin creates them — check back soon!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(t => (
              <TournamentCard key={t.id} tournament={t} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TournamentCard({ tournament: t }: { tournament: BracketTournament }) {
  const statusInfo = STATUS_LABELS[t.status] || { label: t.status, color: 'text-gray-400' };
  const gameEmojis = t.gameIds.slice(0, 5).map(g => GAME_INFO[g]?.emoji || '🎮').join('');
  const moreGames = t.gameIds.length > 5 ? `+${t.gameIds.length - 5}` : '';
  const fillPct = Math.round((t.participants.length / t.maxParticipants) * 100);

  return (
    <Link href={`/tournaments/brackets/view?id=${t.id}`}>
      <div className={`border rounded-lg p-4 transition-all hover:border-arcade-green/50 cursor-pointer
        ${t.status === 'active' ? 'border-arcade-green/40 bg-arcade-green/5' :
          t.status === 'registration' ? 'border-arcade-cyan/30 bg-arcade-cyan/5 hover:border-arcade-cyan/60' :
          t.status === 'completed' ? 'border-gray-700 bg-gray-900/20 hover:border-gray-600' :
          'border-gray-800 bg-gray-900/10'
        }`}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-pixel text-gray-500 text-xs">#{t.displayNumber}</span>
              <span className="font-pixel text-gray-200 text-sm truncate">{t.name}</span>
              <span className={`font-pixel text-xs ${statusInfo.color}`}>{statusInfo.label}</span>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <span className="font-pixel text-xs text-gray-500">
                {t.format === 'single' ? '🔱 Single Elim' : '⚔️ Double Elim'}
              </span>
              <span className="font-pixel text-xs text-gray-500">
                {gameEmojis}{moreGames}
                {t.gameScope === 'all' ? ' All Games' : t.gameScope === 'single' ? ' Single Game' : ` ${t.gameIds.length} Games`}
              </span>
              {t.entryFee > 0 ? (
                <span className="font-pixel text-xs text-yellow-400">💎 {t.entryFee.toLocaleString()} entry</span>
              ) : (
                <span className="font-pixel text-xs text-gray-600">FREE entry</span>
              )}
              {t.prizePool > 0 && (
                <span className="font-pixel text-xs text-arcade-green">
                  🏆 {t.prizePool.toLocaleString()} 8BIT pool
                </span>
              )}
            </div>

            {/* Player fill bar */}
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-gray-800 rounded-full h-1">
                <div
                  className={`h-1 rounded-full transition-all
                    ${t.status === 'active' ? 'bg-arcade-green' : 'bg-arcade-cyan/60'}`}
                  style={{ width: `${fillPct}%` }}
                />
              </div>
              <span className="font-pixel text-xs text-gray-500 shrink-0">
                {t.participants.length}/{t.maxParticipants}
              </span>
            </div>
          </div>

          <div className="text-right shrink-0 space-y-1">
            {t.registrationEnd && t.status === 'registration' && (
              <div className="font-pixel text-xs text-gray-600">
                Closes: {formatDate(t.registrationEnd)}
              </div>
            )}
            {t.startTime && (
              <div className="font-pixel text-xs text-gray-600">
                {t.status === 'active' ? 'Started:' : 'Starts:'} {formatDate(t.startTime)}
              </div>
            )}
            {t.endTime && (
              <div className="font-pixel text-xs text-gray-600">
                Ends: {formatDate(t.endTime)}
              </div>
            )}
            <div className={`font-pixel text-xs px-2 py-0.5 rounded border text-center
              ${t.status === 'registration' ? 'border-arcade-cyan/50 text-arcade-cyan' :
                t.status === 'active' ? 'border-arcade-green/50 text-arcade-green' :
                'border-gray-700 text-gray-500'
              }`}
            >
              VIEW BRACKET →
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
