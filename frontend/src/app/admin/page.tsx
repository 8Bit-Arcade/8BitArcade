'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useWalletAuth } from '@/hooks/useWalletAuth';
import { callFunction } from '@/lib/firebase-functions';
import { BracketTournament, GAME_INFO, ALL_GAME_IDS, VALID_BRACKET_SIZES, BracketSize } from '@/types/pvp';

type AdminTab = 'overview' | 'brackets' | 'pvp' | 'users' | 'system';

const DEFAULT_PRIZE_STRUCTURE = { 1: 60, 2: 25, 3: 10, 4: 5 };

function toast(msg: string, type: 'ok' | 'err' = 'ok') {
  // Simple console fallback; replace with actual toast lib if needed
  console.log(`[${type.toUpperCase()}] ${msg}`);
}

export default function AdminPanel() {
  const { address } = useAuthStore();
  const { signInWithWallet, isAuthenticating, isFirebaseAuthenticated } = useWalletAuth();
  const [tab, setTab] = useState<AdminTab>('overview');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (address && !isFirebaseAuthenticated && !isAuthenticating) {
      signInWithWallet();
    }
  }, [address, isFirebaseAuthenticated, isAuthenticating, signInWithWallet]);

  const showMsg = (msg: string, isError = false) => {
    if (isError) { setError(msg); setMessage(''); }
    else { setMessage(msg); setError(''); }
    setTimeout(() => { setMessage(''); setError(''); }, 6000);
  };

  const tabs: { id: AdminTab; label: string }[] = [
    { id: 'overview', label: '📊 Overview' },
    { id: 'brackets', label: '🏆 Tournaments' },
    { id: 'pvp', label: '⚔️ PvP' },
    { id: 'users', label: '👤 Users' },
    { id: 'system', label: '⚙️ System' },
  ];

  return (
    <div className="min-h-screen bg-arcade-dark">
      {/* Admin header */}
      <div className="bg-black/50 border-b border-arcade-green/30 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="font-pixel text-arcade-green text-sm glow-green">🕹️ 8BIT ARCADE ADMIN</h1>
            <p className="font-pixel text-xs text-gray-600">
              🟢 TESTNET — Arbitrum Sepolia
            </p>
          </div>
          <div className="font-pixel text-xs text-gray-500">
            {address ? `${address.slice(0,6)}...${address.slice(-4)}` : 'Not connected'}
          </div>
        </div>
      </div>

      <div className="flex max-w-7xl mx-auto">
        {/* Sidebar nav */}
        <div className="w-44 shrink-0 border-r border-arcade-green/10 min-h-screen py-4 px-2 hidden md:block">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`w-full text-left font-pixel text-xs px-3 py-2.5 rounded mb-1 transition-colors
                ${tab === t.id
                  ? 'bg-arcade-green/20 text-arcade-green border border-arcade-green/30'
                  : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                }`}
            >{t.label}</button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 p-5 overflow-auto min-w-0">
          {message && (
            <div className="mb-4 px-3 py-2 bg-arcade-green/10 border border-arcade-green/40 rounded">
              <p className="font-pixel text-xs text-arcade-green">✓ {message}</p>
            </div>
          )}
          {error && (
            <div className="mb-4 px-3 py-2 bg-red-900/20 border border-red-500/40 rounded">
              <p className="font-pixel text-xs text-red-400">⚠ {error}</p>
            </div>
          )}

          {tab === 'overview' && <OverviewTab showMsg={showMsg} />}
          {tab === 'brackets' && <BracketsTab showMsg={showMsg} />}
          {tab === 'pvp' && <PvpTab showMsg={showMsg} />}
          {tab === 'users' && <UsersTab showMsg={showMsg} />}
          {tab === 'system' && <SystemTab showMsg={showMsg} />}
        </div>
      </div>
    </div>
  );
}

// ─── Overview Tab ─────────────────────────────────────────────────────────

function OverviewTab({ showMsg }: { showMsg: (m: string, e?: boolean) => void }) {
  return (
    <div className="space-y-6">
      <h2 className="font-pixel text-arcade-green text-sm">SYSTEM OVERVIEW</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'NETWORK', value: 'Testnet', color: 'text-arcade-green' },
          { label: 'CHAIN', value: 'Arbitrum Sepolia', color: 'text-arcade-cyan' },
          { label: 'CHAIN ID', value: '421614', color: 'text-gray-400' },
          { label: 'STATUS', value: '✓ LIVE', color: 'text-arcade-green' },
        ].map(s => (
          <div key={s.label} className="bg-black/30 border border-arcade-green/20 rounded p-3 text-center">
            <div className="font-pixel text-xs text-gray-500">{s.label}</div>
            <div className={`font-pixel text-sm mt-1 ${s.color}`}>{s.value}</div>
          </div>
        ))}
      </div>
      <div className="bg-black/30 border border-arcade-green/20 rounded p-4">
        <div className="font-pixel text-xs text-gray-500 mb-3">QUICK ACTIONS</div>
        <div className="flex flex-wrap gap-2">
          <ActionButton label="🔄 Sync Tournaments" onClick={async () => {
            try {
              await callFunction('syncOnChainTournaments', {});
              showMsg('Tournaments synced');
            } catch (e: any) { showMsg(e.message, true); }
          }} />
          <ActionButton label="🩺 Diagnose System" onClick={async () => {
            try {
              await callFunction('diagnoseTournaments', {});
              showMsg('Diagnosis complete — check logs');
            } catch (e: any) { showMsg(e.message, true); }
          }} />
          <ActionButton label="⏱ Fix Statuses" onClick={async () => {
            try {
              await callFunction('updateTournamentStatusesManual', {});
              showMsg('Statuses updated');
            } catch (e: any) { showMsg(e.message, true); }
          }} />
        </div>
      </div>
    </div>
  );
}

// ─── Brackets Tab ─────────────────────────────────────────────────────────

function BracketsTab({ showMsg }: { showMsg: (m: string, e?: boolean) => void }) {
  const [tournaments, setTournaments] = useState<BracketTournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedTournament, setSelectedTournament] = useState<BracketTournament | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await callFunction<any, any>('getBracketTournaments', { limit: 50 });
      setTournaments(res.tournaments || []);
    } catch (e: any) { showMsg(e.message, true); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const bracketAction = async (tournamentId: string, action: string, updates?: any) => {
    try {
      await callFunction('adminBracketControl', { tournamentId, action, updates });
      showMsg(`${action} successful`);
      load();
    } catch (e: any) { showMsg(e.message, true); }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="font-pixel text-arcade-green text-sm">🏆 BRACKET TOURNAMENTS</h2>
        <button
          onClick={() => setShowCreate(true)}
          className="font-pixel text-xs px-4 py-2 bg-arcade-green/20 border border-arcade-green
                     text-arcade-green rounded hover:bg-arcade-green/30 glow-green"
        >+ CREATE TOURNAMENT</button>
      </div>

      {loading ? (
        <div className="font-pixel text-gray-500 text-xs animate-pulse">Loading...</div>
      ) : (
        <div className="space-y-2">
          {tournaments.length === 0 && (
            <div className="text-center py-8 font-pixel text-gray-600 text-xs">
              No bracket tournaments yet. Create one!
            </div>
          )}
          {tournaments.map(t => (
            <TournamentAdminRow
              key={t.id}
              tournament={t}
              onAction={(action, updates) => bracketAction(t.id, action, updates)}
              onSelect={() => setSelectedTournament(t)}
              isSelected={selectedTournament?.id === t.id}
            />
          ))}
        </div>
      )}

      {showCreate && (
        <CreateBracketModal
          onClose={() => setShowCreate(false)}
          onCreate={async (data) => {
            try {
              const res = await callFunction<any, any>('createBracketTournament', data);
              showMsg(`Tournament created: ${res.tournamentId}`);
              setShowCreate(false);
              load();
            } catch (e: any) { showMsg(e.message, true); }
          }}
        />
      )}

      {selectedTournament && (
        <TournamentDetailPanel
          tournament={selectedTournament}
          onAction={(action, updates) => bracketAction(selectedTournament.id, action, updates)}
          onClose={() => setSelectedTournament(null)}
          onRefresh={load}
        />
      )}
    </div>
  );
}

function TournamentAdminRow({
  tournament: t, onAction, onSelect, isSelected,
}: {
  tournament: BracketTournament;
  onAction: (action: string, updates?: any) => void;
  onSelect: () => void;
  isSelected: boolean;
}) {
  const STATUS_COLOR: Record<string, string> = {
    registration: 'text-arcade-cyan', active: 'text-arcade-green',
    paused: 'text-yellow-400', completed: 'text-gray-400', cancelled: 'text-red-400',
  };

  return (
    <div className={`border rounded p-3 transition-all cursor-pointer
      ${isSelected ? 'border-arcade-green bg-arcade-green/5' : 'border-gray-700 hover:border-gray-500'}`}
      onClick={onSelect}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <span className="font-pixel text-xs text-gray-500 shrink-0">#{t.displayNumber}</span>
          <span className="font-pixel text-xs text-gray-200 truncate">{t.name}</span>
          <span className={`font-pixel text-xs shrink-0 ${STATUS_COLOR[t.status] || 'text-gray-500'}`}>
            {t.status.toUpperCase()}
          </span>
          <span className="font-pixel text-xs text-gray-600 shrink-0">
            {t.participants.length}/{t.maxParticipants}
          </span>
        </div>
        <div className="flex gap-1 shrink-0" onClick={e => e.stopPropagation()}>
          {t.status === 'registration' && (
            <ActionButton small label="▶ Start" onClick={() => onAction('start')} />
          )}
          {t.status === 'active' && (
            <ActionButton small label="⏸ Pause" onClick={() => onAction('pause')} />
          )}
          {t.status === 'paused' && (
            <ActionButton small label="▶ Resume" onClick={() => onAction('resume')} />
          )}
          {(t.status === 'active' || t.status === 'paused' || t.status === 'registration') && (
            <ActionButton small danger label="⏹ Cancel" onClick={() => onAction('cancel')} />
          )}
          {t.status === 'completed' && (
            <ActionButton small label="🏆 Finalize" onClick={() => onAction('finalize')} />
          )}
        </div>
      </div>
    </div>
  );
}

function TournamentDetailPanel({
  tournament: t, onAction, onClose, onRefresh,
}: {
  tournament: BracketTournament;
  onAction: (action: string, updates?: any) => void;
  onClose: () => void;
  onRefresh: () => void;
}) {
  const [editEntryFee, setEditEntryFee] = useState(String(t.entryFee));
  const [editPrizePool, setEditPrizePool] = useState(String(t.prizePool));
  const [editName, setEditName] = useState(t.name);
  const [editDesc, setEditDesc] = useState(t.description);
  const [editEndTime, setEditEndTime] = useState('');

  const save = async () => {
    await onAction('update', {
      name: editName,
      description: editDesc,
      entryFee: parseInt(editEntryFee) || 0,
      prizePool: parseInt(editPrizePool) || 0,
      ...(editEndTime ? { endTime: new Date(editEndTime).getTime() } : {}),
    });
    onRefresh();
  };

  return (
    <div className="bg-black/40 border border-arcade-green/30 rounded-xl p-5 space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-pixel text-arcade-green text-xs">TOURNAMENT #{t.displayNumber} — CONTROLS</h3>
        <button onClick={onClose} className="text-gray-500 hover:text-red-400 font-pixel text-xs">✕</button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <AdminField label="NAME">
          <input value={editName} onChange={e => setEditName(e.target.value)}
            className="admin-input" />
        </AdminField>
        <AdminField label="DESCRIPTION">
          <input value={editDesc} onChange={e => setEditDesc(e.target.value)}
            className="admin-input" />
        </AdminField>
        <AdminField label="ENTRY FEE (8BIT)">
          <input type="number" value={editEntryFee} onChange={e => setEditEntryFee(e.target.value)}
            className="admin-input" />
        </AdminField>
        <AdminField label="PRIZE POOL (8BIT)">
          <input type="number" value={editPrizePool} onChange={e => setEditPrizePool(e.target.value)}
            className="admin-input" />
        </AdminField>
        <AdminField label="EXTEND END TIME">
          <input type="datetime-local" value={editEndTime} onChange={e => setEditEndTime(e.target.value)}
            className="admin-input" />
        </AdminField>
      </div>

      <div className="flex flex-wrap gap-2">
        <ActionButton label="💾 Save Changes" onClick={save} />
        {t.status === 'registration' && (
          <ActionButton label="▶ START NOW" onClick={() => onAction('start')} />
        )}
        {t.status === 'active' && (
          <ActionButton label="⏸ PAUSE" onClick={() => onAction('pause')} />
        )}
        {t.status === 'paused' && (
          <ActionButton label="▶ RESUME" onClick={() => onAction('resume')} />
        )}
        <ActionButton label="🔄 RESET" onClick={() => onAction('reset')} />
        <ActionButton danger label="⏹ CANCEL" onClick={() => onAction('cancel')} />
        <ActionButton label="🏆 FINALIZE" onClick={() => onAction('finalize')} />
      </div>

      <div className="pt-2 border-t border-arcade-green/10">
        <div className="font-pixel text-xs text-gray-500 mb-2">
          PARTICIPANTS ({t.participants.length}/{t.maxParticipants})
        </div>
        <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto">
          {t.participants.map(addr => (
            <div key={addr} className="flex items-center gap-1 bg-black/40 border border-gray-700 rounded px-2 py-0.5">
              <span className="font-pixel text-xs text-gray-400">
                {addr.slice(0,6)}...{addr.slice(-4)}
              </span>
              <button
                onClick={() => onAction('remove_participant', { address: addr })}
                className="text-red-500 hover:text-red-300 text-xs font-pixel ml-1"
              >✕</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CreateBracketModal({
  onClose, onCreate,
}: {
  onClose: () => void;
  onCreate: (data: any) => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [format, setFormat] = useState<'single' | 'double'>('single');
  const [gameScope, setGameScope] = useState<'single' | 'multi' | 'all'>('single');
  const [selectedGames, setSelectedGames] = useState<string[]>([]);
  const [maxParticipants, setMaxParticipants] = useState<BracketSize>(8);
  const [entryFee, setEntryFee] = useState('0');
  const [prizePool, setPrizePool] = useState('0');
  const [prizeStructure, setPrizeStructure] = useState({ ...DEFAULT_PRIZE_STRUCTURE });
  const [burnPercentage, setBurnPercentage] = useState('50');
  const [registrationEnd, setRegistrationEnd] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [roundDuration, setRoundDuration] = useState('60');
  const [seeding, setSeeding] = useState('random');
  const [visibility, setVisibility] = useState('public');

  const pctSum = Object.values(prizeStructure).reduce((a, b) => a + b, 0);

  const handleSubmit = () => {
    const games = gameScope === 'all' ? ALL_GAME_IDS : selectedGames;
    if (!name.trim()) return;
    if (games.length === 0) return;
    if (Math.abs(pctSum - 100) > 0.01) return;

    onCreate({
      name: name.trim(),
      description: description.trim(),
      format,
      gameIds: games,
      gameScope,
      maxParticipants,
      entryFee: parseInt(entryFee) || 0,
      prizePool: parseInt(prizePool) || 0,
      prizeStructure,
      burnPercentage: parseInt(burnPercentage) || 50,
      registrationEnd: registrationEnd ? new Date(registrationEnd).getTime() : Date.now() + 48 * 3600000,
      startTime: startTime ? new Date(startTime).getTime() : null,
      endTime: endTime ? new Date(endTime).getTime() : null,
      roundDurationMinutes: parseInt(roundDuration) || 60,
      seeding,
      visibility,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-50 overflow-y-auto flex items-start justify-center p-4">
      <div className="bg-arcade-dark border border-arcade-green/40 rounded-xl w-full max-w-2xl my-4">
        <div className="flex items-center justify-between px-5 py-4 border-b border-arcade-green/20">
          <h2 className="font-pixel text-arcade-green text-sm">+ CREATE BRACKET TOURNAMENT</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-red-400 font-pixel">✕</button>
        </div>

        <div className="p-5 space-y-5">
          {/* Basic info */}
          <div className="grid grid-cols-2 gap-3">
            <AdminField label="TOURNAMENT NAME *">
              <input value={name} onChange={e => setName(e.target.value)} className="admin-input" placeholder="e.g. Spring Cup #1" />
            </AdminField>
            <AdminField label="DESCRIPTION">
              <input value={description} onChange={e => setDescription(e.target.value)} className="admin-input" placeholder="Optional description" />
            </AdminField>
          </div>

          {/* Format */}
          <AdminField label="FORMAT">
            <div className="flex gap-2">
              {(['single', 'double'] as const).map(f => (
                <button key={f} onClick={() => setFormat(f)}
                  className={`font-pixel text-xs px-3 py-1.5 rounded border ${format === f ? 'border-arcade-green bg-arcade-green/20 text-arcade-green' : 'border-gray-600 text-gray-400'}`}>
                  {f === 'single' ? '🔱 Single Elimination' : '⚔️ Double Elimination'}
                </button>
              ))}
            </div>
          </AdminField>

          {/* Game scope */}
          <AdminField label="GAME SCOPE">
            <div className="flex gap-2 flex-wrap">
              {(['single', 'multi', 'all'] as const).map(gs => (
                <button key={gs} onClick={() => setGameScope(gs)}
                  className={`font-pixel text-xs px-3 py-1.5 rounded border ${gameScope === gs ? 'border-arcade-green bg-arcade-green/20 text-arcade-green' : 'border-gray-600 text-gray-400'}`}>
                  {gs === 'single' ? '1 Game' : gs === 'multi' ? 'Multiple' : '🎮 All 12'}
                </button>
              ))}
            </div>
            {gameScope !== 'all' && (
              <div className="grid grid-cols-4 gap-1 mt-2">
                {ALL_GAME_IDS.map(gid => {
                  const info = GAME_INFO[gid];
                  const sel = selectedGames.includes(gid);
                  return (
                    <button key={gid} onClick={() => setSelectedGames(prev => sel ? prev.filter(g=>g!==gid) : [...prev, gid])}
                      className={`flex items-center gap-1 p-1.5 rounded border text-left text-xs font-pixel
                        ${sel ? 'border-arcade-green/60 bg-arcade-green/10 text-gray-200' : 'border-gray-700 text-gray-600 hover:border-gray-500'}`}>
                      <span>{info?.emoji}</span><span className="truncate">{info?.name}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </AdminField>

          {/* Bracket size */}
          <AdminField label="MAX PARTICIPANTS">
            <div className="flex gap-2 flex-wrap">
              {VALID_BRACKET_SIZES.map(size => (
                <button key={size} onClick={() => setMaxParticipants(size)}
                  className={`font-pixel text-xs px-3 py-1.5 rounded border ${maxParticipants === size ? 'border-arcade-green bg-arcade-green/20 text-arcade-green' : 'border-gray-600 text-gray-400'}`}>
                  {size}
                </button>
              ))}
            </div>
          </AdminField>

          {/* Economics */}
          <div className="grid grid-cols-3 gap-3">
            <AdminField label="ENTRY FEE (8BIT)">
              <input type="number" value={entryFee} onChange={e => setEntryFee(e.target.value)} className="admin-input" min={0} />
            </AdminField>
            <AdminField label="PRIZE POOL (8BIT)">
              <input type="number" value={prizePool} onChange={e => setPrizePool(e.target.value)} className="admin-input" min={0} />
            </AdminField>
            <AdminField label="BURN % OF FEES">
              <input type="number" value={burnPercentage} onChange={e => setBurnPercentage(e.target.value)} className="admin-input" min={0} max={100} />
            </AdminField>
          </div>

          {/* Prize structure */}
          <AdminField label={`PRIZE SPLIT (must total 100%, currently ${pctSum}%)`}>
            <div className="grid grid-cols-4 gap-2">
              {[1,2,3,4].map(place => (
                <div key={place}>
                  <div className="font-pixel text-xs text-gray-600 mb-0.5">
                    {['🥇','🥈','🥉','4️⃣'][place-1]} Place
                  </div>
                  <input
                    type="number" min={0} max={100}
                    value={prizeStructure[place] ?? 0}
                    onChange={e => setPrizeStructure(prev => ({ ...prev, [place]: parseInt(e.target.value)||0 }))}
                    className="admin-input w-full"
                  />
                </div>
              ))}
            </div>
            {Math.abs(pctSum - 100) > 0.01 && (
              <p className="font-pixel text-xs text-red-400 mt-1">⚠ Must sum to 100%</p>
            )}
          </AdminField>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <AdminField label="REGISTRATION CLOSES">
              <input type="datetime-local" value={registrationEnd} onChange={e => setRegistrationEnd(e.target.value)} className="admin-input" />
            </AdminField>
            <AdminField label="TOURNAMENT STARTS">
              <input type="datetime-local" value={startTime} onChange={e => setStartTime(e.target.value)} className="admin-input" />
            </AdminField>
            <AdminField label="TOURNAMENT ENDS (optional)">
              <input type="datetime-local" value={endTime} onChange={e => setEndTime(e.target.value)} className="admin-input" />
            </AdminField>
            <AdminField label="ROUND DURATION (minutes)">
              <input type="number" value={roundDuration} onChange={e => setRoundDuration(e.target.value)} className="admin-input" min={5} />
            </AdminField>
          </div>

          {/* Settings */}
          <div className="grid grid-cols-2 gap-3">
            <AdminField label="SEEDING">
              <select value={seeding} onChange={e => setSeeding(e.target.value)} className="admin-input">
                <option value="random">🎲 Random</option>
                <option value="rank">📊 By Rank</option>
              </select>
            </AdminField>
            <AdminField label="VISIBILITY">
              <select value={visibility} onChange={e => setVisibility(e.target.value)} className="admin-input">
                <option value="public">🌍 Public</option>
                <option value="invite">🔒 Invite Only</option>
                <option value="hidden">👻 Hidden</option>
              </select>
            </AdminField>
          </div>

          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="flex-1 font-pixel text-xs py-2.5 border border-gray-600 text-gray-400 rounded hover:border-gray-400">
              CANCEL
            </button>
            <button
              onClick={handleSubmit}
              disabled={!name.trim() || Math.abs(pctSum - 100) > 0.01}
              className="flex-1 font-pixel text-xs py-2.5 bg-arcade-green/20 border border-arcade-green text-arcade-green rounded hover:bg-arcade-green/30 glow-green disabled:opacity-40"
            >
              ✓ CREATE TOURNAMENT
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── PvP Tab ───────────────────────────────────────────────────────────────

function PvpTab({ showMsg }: { showMsg: (m: string, e?: boolean) => void }) {
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('open');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await callFunction<any, any>('getPvpMatches', { status: statusFilter, limit: 50 });
      setMatches(res.matches || []);
    } catch (e: any) { showMsg(e.message, true); }
    finally { setLoading(false); }
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-4">
      <h2 className="font-pixel text-arcade-green text-sm">⚔️ PvP MATCH MANAGEMENT</h2>
      <div className="flex gap-2">
        {['open', 'active', 'completed', 'cancelled'].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`font-pixel text-xs px-3 py-1.5 rounded border transition-colors
              ${statusFilter === s ? 'border-arcade-green bg-arcade-green/20 text-arcade-green' : 'border-gray-700 text-gray-500 hover:border-gray-500'}`}>
            {s.toUpperCase()}
          </button>
        ))}
      </div>
      {loading ? (
        <div className="font-pixel text-gray-500 text-xs animate-pulse">Loading...</div>
      ) : matches.length === 0 ? (
        <div className="text-center py-8 font-pixel text-gray-600 text-xs">No {statusFilter} matches</div>
      ) : (
        <div className="space-y-1">
          {matches.map((m: any) => (
            <div key={m.id} className="border border-gray-700 rounded p-2.5 flex items-center gap-3">
              <span className="font-pixel text-xs text-gray-500">#{m.displayNumber}</span>
              <span className="font-pixel text-xs text-gray-400 flex-1">
                {m.creator?.slice(0,8)}... vs {m.challenger ? m.challenger.slice(0,8) + '...' : 'Open'}
              </span>
              <span className="font-pixel text-xs text-gray-600">
                {m.numGames}G · {m.betAmount > 0 ? `${m.betAmount.toLocaleString()} 8BIT` : 'FREE'}
              </span>
              {m.status === 'open' && (
                <ActionButton small danger label="Force Cancel" onClick={async () => {
                  try {
                    await callFunction('cancelPvpMatch', { matchId: m.id });
                    showMsg(`Match ${m.id} cancelled`);
                    load();
                  } catch (e: any) { showMsg(e.message, true); }
                }} />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Users Tab ─────────────────────────────────────────────────────────────

function UsersTab({ showMsg }: { showMsg: (m: string, e?: boolean) => void }) {
  const [playerId, setPlayerId] = useState('');
  const [userInfo, setUserInfo] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const lookup = async () => {
    if (!playerId.trim()) return;
    setLoading(true);
    try {
      const result = await callFunction<any, any>('getUserBanInfo', { playerId: playerId.trim().toLowerCase() });
      setUserInfo(result);
    } catch (e: any) { showMsg(e.message, true); }
    finally { setLoading(false); }
  };

  const action = async (fn: string, extra?: any) => {
    try {
      await callFunction<any, any>(fn, { playerId: playerId.trim().toLowerCase(), ...extra });
      showMsg(`${fn} successful`);
      lookup();
    } catch (e: any) { showMsg(e.message, true); }
  };

  return (
    <div className="space-y-5">
      <h2 className="font-pixel text-arcade-green text-sm">👤 USER MANAGEMENT</h2>
      <div className="flex gap-2">
        <input
          value={playerId} onChange={e => setPlayerId(e.target.value)}
          placeholder="Wallet address or username..."
          className="flex-1 admin-input"
          onKeyDown={e => e.key === 'Enter' && lookup()}
        />
        <ActionButton label={loading ? 'Looking up...' : '🔍 Lookup'} onClick={lookup} />
      </div>

      {userInfo && (
        <div className="bg-black/30 border border-arcade-green/20 rounded p-4 space-y-3">
          <div className="font-pixel text-xs text-gray-400 space-y-1">
            <div>Address: <span className="text-gray-200">{userInfo.address}</span></div>
            <div>Username: <span className="text-gray-200">{userInfo.username || '—'}</span></div>
            <div>Banned: <span className={userInfo.isBanned ? 'text-red-400' : 'text-arcade-green'}>{userInfo.isBanned ? 'YES' : 'NO'}</span></div>
            <div>Flags: <span className="text-gray-200">{userInfo.flags?.count || 0}</span></div>
            {userInfo.banReason && <div>Ban reason: <span className="text-red-300">{userInfo.banReason}</span></div>}
          </div>
          <div className="flex flex-wrap gap-2">
            {userInfo.isBanned ? (
              <ActionButton label="🔓 UNBAN" onClick={() => action('unbanAccount')} />
            ) : (
              <ActionButton danger label="🚫 BAN" onClick={() => {
                const reason = prompt('Ban reason:');
                if (reason) action('banAccount', { reason });
              }} />
            )}
            <ActionButton label="🧹 Clear Flags" onClick={() => action('clearUserFlags')} />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── System Tab ────────────────────────────────────────────────────────────

function SystemTab({ showMsg }: { showMsg: (m: string, e?: boolean) => void }) {
  const CONTRACTS_INFO = [
    { label: '8BIT Token', addr: '0xC1C665D66A9F8433cBBD4e70a543eDc19C56707d' },
    { label: 'Tournament Manager', addr: '0xe06C92f15F426b0f6Fccb66302790E533C5Dfbb7' },
    { label: 'Game Rewards', addr: '0x528c9130A05bEf9a9632FbB3D8735287A2e44a4E' },
    { label: 'PvP Escrow', addr: 'Deploy required' },
  ];

  return (
    <div className="space-y-5">
      <h2 className="font-pixel text-arcade-green text-sm">⚙️ SYSTEM CONFIG</h2>

      <div>
        <div className="font-pixel text-xs text-gray-500 mb-2">CONTRACT ADDRESSES (Arbitrum Sepolia)</div>
        <div className="space-y-1">
          {CONTRACTS_INFO.map(c => (
            <div key={c.label} className="flex items-center justify-between p-2 bg-black/30 border border-gray-800 rounded">
              <span className="font-pixel text-xs text-gray-400">{c.label}</span>
              <span className="font-mono text-xs text-gray-600">{c.addr}</span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="font-pixel text-xs text-gray-500 mb-2">SCHEDULED FUNCTIONS</div>
        <div className="space-y-1">
          {[
            'cancelExpiredPvpMatches — every 15 minutes',
            'updateTournamentStatuses — every hour',
            'ensureActiveTournaments — every hour',
            'distributeDailyRewards — daily at midnight UTC',
            'resetDailyLeaderboards — daily at midnight UTC',
          ].map(fn => (
            <div key={fn} className="flex items-center gap-2 p-2 bg-black/30 border border-gray-800 rounded">
              <span className="w-2 h-2 bg-arcade-green rounded-full inline-block"></span>
              <span className="font-pixel text-xs text-gray-500">{fn}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <ActionButton label="📦 Distribute Rewards" onClick={async () => {
          try {
            await callFunction('manualDistributeRewards', {});
            showMsg('Rewards distributed');
          } catch (e: any) { showMsg(e.message, true); }
        }} />
        <ActionButton label="🔄 Reset Daily LBs" onClick={async () => {
          try {
            await callFunction('resetDailyLeaderboards', {});
            showMsg('Daily leaderboards reset');
          } catch (e: any) { showMsg(e.message, true); }
        }} />
      </div>
    </div>
  );
}

// ─── Shared helpers ────────────────────────────────────────────────────────

function AdminField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block font-pixel text-xs text-gray-500 mb-1">{label}</label>
      {children}
    </div>
  );
}

function ActionButton({
  label, onClick, small, danger,
}: {
  label: string; onClick: () => void; small?: boolean; danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`font-pixel transition-colors rounded border
        ${small ? 'text-xs px-2 py-1' : 'text-xs px-3 py-1.5'}
        ${danger
          ? 'border-red-500/50 text-red-400 hover:bg-red-900/20'
          : 'border-arcade-green/40 text-arcade-green hover:bg-arcade-green/10'
        }`}
    >{label}</button>
  );
}
