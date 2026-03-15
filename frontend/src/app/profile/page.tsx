'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAccount } from 'wagmi';
import Link from 'next/link';
import { callFunction } from '@/lib/firebase-functions';
import { UserProfile, GAME_INFO } from '@/types/pvp';

const FRAME_STYLES = [
  'border-arcade-green shadow-[0_0_8px_rgba(0,255,65,0.4)]',
  'border-arcade-cyan shadow-[0_0_8px_rgba(0,191,255,0.4)]',
  'border-yellow-400 shadow-[0_0_8px_rgba(255,200,0,0.4)]',
  'border-red-500 shadow-[0_0_8px_rgba(255,50,50,0.4)]',
  'border-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.4)]',
  'border-pink-500 shadow-[0_0_8px_rgba(236,72,153,0.4)]',
  'border-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.4)]',
  'border-white shadow-[0_0_8px_rgba(255,255,255,0.3)]',
];

export default function PlayerProfilePage() {
  const [profileAddress, setProfileAddress] = useState<string>('');
  useEffect(() => {
    setProfileAddress(new URLSearchParams(window.location.search).get('address') ?? '');
  }, []);
  const { address: myAddress } = useAccount();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'pvp' | 'tournaments' | 'history'>('pvp');

  const isOwn = myAddress?.toLowerCase() === profileAddress?.toLowerCase();

  useEffect(() => {
    const load = async () => {
      try {
        const result = await callFunction<any, UserProfile>('getUserProfile', {
          address: profileAddress,
        });
        setProfile(result);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [profileAddress]);

  if (loading) {
    return (
      <div className="min-h-screen bg-arcade-dark flex items-center justify-center">
        <div className="font-pixel text-arcade-green animate-pulse">LOADING PROFILE...</div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-arcade-dark flex items-center justify-center">
        <div className="font-pixel text-red-400">Player not found</div>
      </div>
    );
  }

  const frameClass = FRAME_STYLES[profile.avatarFrame || 0];
  const winRate = profile.pvpWins !== null && profile.pvpLosses !== null && (profile.pvpWins + profile.pvpLosses) > 0
    ? Math.round((profile.pvpWins / (profile.pvpWins + profile.pvpLosses)) * 100)
    : null;

  return (
    <div className="min-h-screen bg-arcade-dark px-4 py-8">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Back */}
        <Link href="/multiplayer" className="font-pixel text-xs text-gray-500 hover:text-arcade-green">
          ← BACK
        </Link>

        {/* Profile card */}
        <div className="bg-black/30 border border-arcade-green/30 rounded-xl p-6">
          <div className="flex items-start gap-5">
            {/* Avatar */}
            <div className={`w-20 h-20 rounded-lg border-2 overflow-hidden shrink-0 ${frameClass}`}>
              {profile.avatarUrl ? (
                <img src={profile.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-arcade-dark flex items-center justify-center font-pixel text-4xl">
                  👾
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="font-pixel text-arcade-green text-lg truncate">{profile.displayName}</h1>
                {profile.isBanned && (
                  <span className="font-pixel text-xs text-red-400 border border-red-500/50 px-1 rounded">BANNED</span>
                )}
              </div>
              <div className="font-pixel text-xs text-gray-500 font-mono">
                {profileAddress?.slice(0, 8)}...{profileAddress?.slice(-6)}
              </div>
              {profile.bio && (
                <p className="text-gray-400 text-sm mt-2 italic">"{profile.bio}"</p>
              )}
              <div className="flex gap-3 flex-wrap mt-2">
                {profile.socialTwitter && (
                  <a
                    href={`https://twitter.com/${profile.socialTwitter}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-pixel text-xs text-arcade-cyan hover:underline"
                  >𝕏 @{profile.socialTwitter}</a>
                )}
                {profile.socialDiscord && (
                  <span className="font-pixel text-xs text-indigo-400">
                    Discord: {profile.socialDiscord}
                  </span>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="shrink-0 flex flex-col gap-2">
              {isOwn && (
                <Link
                  href="/profile/edit"
                  className="font-pixel text-xs px-3 py-1.5 border border-arcade-green/50 text-arcade-green
                             rounded hover:bg-arcade-green/10 transition-colors text-center"
                >✏️ EDIT</Link>
              )}
              {!isOwn && (
                <Link
                  href={`/multiplayer?challenge=${profileAddress}`}
                  className="font-pixel text-xs px-3 py-1.5 border border-red-500/50 text-red-400
                             rounded hover:bg-red-900/10 transition-colors text-center"
                >⚔️ CHALLENGE</Link>
              )}
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard
            label="PvP WINS"
            value={profile.pvpWins ?? '—'}
            color="text-arcade-green"
          />
          <StatCard
            label="PvP LOSSES"
            value={profile.pvpLosses ?? '—'}
            color="text-red-400"
          />
          <StatCard
            label="WIN RATE"
            value={winRate !== null ? `${winRate}%` : '—'}
            color={winRate !== null && winRate >= 50 ? 'text-arcade-green' : 'text-red-400'}
          />
          <StatCard
            label="TOURNEY WINS"
            value={profile.tournamentWins}
            color="text-yellow-400"
          />
        </div>

        {/* Earnings */}
        {(profile.pvpEarnings !== null || profile.tournamentEarnings !== null) && (
          <div className="grid grid-cols-2 gap-3">
            {profile.pvpEarnings !== null && (
              <div className="bg-black/30 border border-arcade-green/20 rounded p-3 text-center">
                <div className="font-pixel text-xs text-gray-500">PvP EARNINGS</div>
                <div className="font-pixel text-lg text-arcade-green">
                  {profile.pvpEarnings.toLocaleString()} <span className="text-xs">8BIT</span>
                </div>
              </div>
            )}
            {profile.tournamentEarnings !== null && (
              <div className="bg-black/30 border border-yellow-500/20 rounded p-3 text-center">
                <div className="font-pixel text-xs text-gray-500">TOURNAMENT EARNINGS</div>
                <div className="font-pixel text-lg text-yellow-400">
                  {profile.tournamentEarnings.toLocaleString()} <span className="text-xs">8BIT</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 border-b border-arcade-green/10 pb-px">
          {([['pvp', '⚔️ PvP HISTORY'], ['tournaments', '🏆 TOURNAMENTS'], ['history', '📊 GAME STATS']] as const).map(([t, label]) => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className={`font-pixel text-xs px-4 py-2 border-b-2 transition-colors
                ${activeTab === t ? 'border-arcade-green text-arcade-green' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
            >{label}</button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === 'pvp' && (
          <div className="space-y-2">
            {profile.matchHistory?.length === 0 && (
              <div className="text-center py-8 font-pixel text-gray-600 text-xs">No PvP matches yet.</div>
            )}
            {profile.matchHistory?.map((match: any, i: number) => (
              <MatchHistoryRow key={i} match={match} />
            ))}
          </div>
        )}

        {activeTab === 'history' && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <StatCard label="GAMES PLAYED" value={profile.totalGamesPlayed.toLocaleString()} color="text-arcade-cyan" />
            <StatCard label="TOTAL SCORE" value={profile.totalScore.toLocaleString()} color="text-arcade-green" />
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: any; color: string }) {
  return (
    <div className="bg-black/30 border border-gray-800 rounded p-3 text-center">
      <div className="font-pixel text-xs text-gray-500">{label}</div>
      <div className={`font-pixel text-xl mt-1 ${color}`}>{value}</div>
    </div>
  );
}

function MatchHistoryRow({ match }: { match: any }) {
  const won = match.result === 'win';
  return (
    <Link href={`/multiplayer/results?id=${match.matchId}`}>
      <div className={`flex items-center gap-3 p-3 rounded border transition-all cursor-pointer
        ${won ? 'border-arcade-green/20 bg-arcade-green/5 hover:border-arcade-green/40' :
                'border-red-500/20 bg-red-900/5 hover:border-red-500/40'}`}
      >
        <span className={`font-pixel text-sm ${won ? 'text-arcade-green' : 'text-red-400'}`}>
          {won ? '🏆' : '💔'}
        </span>
        <div className="flex-1 min-w-0">
          <div className="font-pixel text-xs text-gray-400">
            #{match.displayNumber} vs {match.opponent.slice(0,6)}...{match.opponent.slice(-4)}
          </div>
          <div className="font-pixel text-xs text-gray-600">
            {match.gameIds.slice(0,3).map((g: string) => GAME_INFO[g]?.emoji).join('')}
            {match.numGames}G · {match.myScore.toLocaleString()} vs {match.oppScore.toLocaleString()}
          </div>
        </div>
        {match.betAmount > 0 && (
          <span className={`font-pixel text-xs ${won ? 'text-arcade-green' : 'text-red-400'}`}>
            {won ? '+' : '-'}{match.betAmount.toLocaleString()} 8BIT
          </span>
        )}
      </div>
    </Link>
  );
}
