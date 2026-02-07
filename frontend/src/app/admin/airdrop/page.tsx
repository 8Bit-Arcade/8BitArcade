'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useWalletAuth } from '@/hooks/useWalletAuth';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '@/lib/firebase';

// Admin wallet addresses that can access this page
const ADMIN_WALLETS = [
  '0x96e0b627454ce3b8c55c6d36b5fcbb13849dc297',
];

interface UserAllocation {
  wallet: string;
  gamesPlayed: number;
  totalPoints: number;
  tier: string;
  tokenAmount: number;
  tournamentEntries: number;
  discordMessages: number;
  telegramMessages: number;
  stakedAmount: number;
  zealyXP: number;
  isEarlyAdopter: boolean;
  createdAt?: string;
}

interface AirdropConfig {
  status: 'inactive' | 'scheduled' | 'active' | 'paused' | 'completed';
  isPaused: boolean;
  scheduledStart?: string;
  scheduledEnd?: string;
  actualStart?: string;
  testMode: boolean;
  totalTokenPool: number;
}

interface DashboardStats {
  totalUsers: number;
  eligibleUsers: number;
  totalGamesPlayed: number;
  discordLinksCount: number;
  totalDiscordMessages: number;
  telegramLinksCount: number;
  zealyUsersCount: number;
  overridesCount: number;
  claimedCount: number;
  totalAllocated: number;
}

type Tab = 'dashboard' | 'users' | 'controls' | 'overrides' | 'wallet-changes';

export default function AdminAirdropPage() {
  const { address } = useAuthStore();
  const { signInWithWallet, isAuthenticating, isFirebaseAuthenticated } = useWalletAuth();
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [users, setUsers] = useState<UserAllocation[]>([]);
  const [config, setConfig] = useState<AirdropConfig | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [overrides, setOverrides] = useState<any[]>([]);
  const [walletChanges, setWalletChanges] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [sortBy, setSortBy] = useState<'points' | 'games' | 'tokens'>('points');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [searchWallet, setSearchWallet] = useState('');

  // Modal states
  const [showEditWallet, setShowEditWallet] = useState(false);
  const [showOverrideAllocation, setShowOverrideAllocation] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserAllocation | null>(null);

  // Form states
  const [newWallet, setNewWallet] = useState('');
  const [overrideTokens, setOverrideTokens] = useState('');
  const [overrideTier, setOverrideTier] = useState('');
  const [overridePoints, setOverridePoints] = useState('');
  const [overrideReason, setOverrideReason] = useState('');
  const [scheduleStart, setScheduleStart] = useState('');
  const [scheduleEnd, setScheduleEnd] = useState('');

  const functions = getFunctions(app);
  const isAdmin = address && ADMIN_WALLETS.includes(address.toLowerCase());

  // Auto sign in
  useEffect(() => {
    if (address && !isFirebaseAuthenticated && !isAuthenticating) {
      signInWithWallet();
    }
  }, [address, isFirebaseAuthenticated, isAuthenticating, signInWithWallet]);

  // Load dashboard stats
  const loadDashboard = async () => {
    setLoading(true);
    try {
      const getDashboard = httpsCallable(functions, 'getAirdropDashboardStats');
      const result = await getDashboard({});
      const data = result.data as { config: AirdropConfig; stats: DashboardStats };
      setConfig(data.config);
      setStats(data.stats);
    } catch (err: any) {
      console.error('Error loading dashboard:', err);
      setMessage({ type: 'error', text: err.message || 'Failed to load dashboard' });
    } finally {
      setLoading(false);
    }
  };

  // Load all user allocations
  const loadAllocations = async () => {
    setLoading(true);
    try {
      const getAllocations = httpsCallable(functions, 'getAdminAirdropAllocations');
      const result = await getAllocations({});
      const data = result.data as { users: UserAllocation[] };
      setUsers(data.users || []);
    } catch (err: any) {
      console.error('Error loading allocations:', err);
      setMessage({ type: 'error', text: err.message || 'Failed to load allocations' });
    } finally {
      setLoading(false);
    }
  };

  // Load overrides
  const loadOverrides = async () => {
    setLoading(true);
    try {
      const getOverrides = httpsCallable(functions, 'getAllocationOverrides');
      const result = await getOverrides({});
      const data = result.data as { overrides: any[] };
      setOverrides(data.overrides || []);
    } catch (err: any) {
      console.error('Error loading overrides:', err);
    } finally {
      setLoading(false);
    }
  };

  // Load wallet changes
  const loadWalletChanges = async () => {
    setLoading(true);
    try {
      const getChanges = httpsCallable(functions, 'getWalletChangeHistory');
      const result = await getChanges({});
      const data = result.data as { changes: any[] };
      setWalletChanges(data.changes || []);
    } catch (err: any) {
      console.error('Error loading wallet changes:', err);
    } finally {
      setLoading(false);
    }
  };

  // Sync Zealy data
  const syncZealy = async () => {
    setSyncing(true);
    try {
      const syncZealyUsers = httpsCallable(functions, 'syncZealyUsers');
      const result = await syncZealyUsers({});
      const data = result.data as { message: string };
      setMessage({ type: 'success', text: data.message });
      await loadDashboard();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to sync Zealy' });
    } finally {
      setSyncing(false);
    }
  };

  // Airdrop control actions
  const startAirdrop = async (immediate: boolean) => {
    setActionLoading(true);
    try {
      const start = httpsCallable(functions, 'startAirdrop');
      await start({ immediate, scheduledStart: !immediate ? scheduleStart : undefined });
      setMessage({ type: 'success', text: immediate ? 'Airdrop started!' : 'Airdrop scheduled!' });
      setShowSchedule(false);
      await loadDashboard();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setActionLoading(false);
    }
  };

  const pauseAirdrop = async () => {
    setActionLoading(true);
    try {
      const pause = httpsCallable(functions, 'pauseAirdrop');
      await pause({});
      setMessage({ type: 'success', text: 'Airdrop paused' });
      await loadDashboard();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setActionLoading(false);
    }
  };

  const resumeAirdrop = async () => {
    setActionLoading(true);
    try {
      const resume = httpsCallable(functions, 'resumeAirdrop');
      await resume({});
      setMessage({ type: 'success', text: 'Airdrop resumed' });
      await loadDashboard();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setActionLoading(false);
    }
  };

  const stopAirdrop = async () => {
    if (!confirm('Are you sure you want to stop the airdrop? This cannot be undone.')) return;
    setActionLoading(true);
    try {
      const stop = httpsCallable(functions, 'stopAirdrop');
      await stop({ reason: 'Manual stop from admin dashboard' });
      setMessage({ type: 'success', text: 'Airdrop stopped' });
      await loadDashboard();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setActionLoading(false);
    }
  };

  const extendAirdrop = async () => {
    if (!scheduleEnd) return;
    setActionLoading(true);
    try {
      const extend = httpsCallable(functions, 'extendAirdrop');
      await extend({ newEndDate: scheduleEnd });
      setMessage({ type: 'success', text: 'Airdrop extended' });
      setShowSchedule(false);
      await loadDashboard();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setActionLoading(false);
    }
  };

  // Edit user wallet
  const handleEditWallet = async () => {
    if (!selectedUser || !newWallet) return;
    setActionLoading(true);
    try {
      const edit = httpsCallable(functions, 'editUserWallet');
      await edit({ oldWallet: selectedUser.wallet, newWallet, reason: 'Admin wallet change' });
      setMessage({ type: 'success', text: 'Wallet updated successfully' });
      setShowEditWallet(false);
      setNewWallet('');
      await loadAllocations();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setActionLoading(false);
    }
  };

  // Override allocation
  const handleOverrideAllocation = async () => {
    if (!selectedUser) return;
    setActionLoading(true);
    try {
      const override = httpsCallable(functions, 'overrideUserAllocation');
      await override({
        wallet: selectedUser.wallet,
        tokenAmount: overrideTokens ? parseInt(overrideTokens) : undefined,
        tier: overrideTier || undefined,
        points: overridePoints ? parseInt(overridePoints) : undefined,
        reason: overrideReason || 'Admin override',
      });
      setMessage({ type: 'success', text: 'Allocation overridden' });
      setShowOverrideAllocation(false);
      resetOverrideForm();
      await loadAllocations();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setActionLoading(false);
    }
  };

  // Remove override
  const handleRemoveOverride = async (wallet: string) => {
    if (!confirm('Remove this override?')) return;
    setActionLoading(true);
    try {
      const remove = httpsCallable(functions, 'removeAllocationOverride');
      await remove({ wallet });
      setMessage({ type: 'success', text: 'Override removed' });
      await loadOverrides();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setActionLoading(false);
    }
  };

  // Test distribution
  const handleTestDistribution = async () => {
    if (!confirm('Run test airdrop distribution?')) return;
    setActionLoading(true);
    try {
      const test = httpsCallable(functions, 'testAirdropDistribution');
      const result = await test({ tokenAmount: 1000 });
      const data = result.data as { distributionId: string; walletCount: number };
      setMessage({ type: 'success', text: `Test distribution created: ${data.walletCount} wallets` });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setActionLoading(false);
    }
  };

  const resetOverrideForm = () => {
    setOverrideTokens('');
    setOverrideTier('');
    setOverridePoints('');
    setOverrideReason('');
    setSelectedUser(null);
  };

  // Load data based on active tab
  useEffect(() => {
    if (!isFirebaseAuthenticated || !isAdmin) return;

    switch (activeTab) {
      case 'dashboard':
        loadDashboard();
        break;
      case 'users':
        loadAllocations();
        break;
      case 'overrides':
        loadOverrides();
        break;
      case 'wallet-changes':
        loadWalletChanges();
        break;
    }
  }, [activeTab, isFirebaseAuthenticated, isAdmin]);

  // Sort users
  const sortedUsers = [...users].sort((a, b) => {
    let aVal, bVal;
    switch (sortBy) {
      case 'games': aVal = a.gamesPlayed; bVal = b.gamesPlayed; break;
      case 'tokens': aVal = a.tokenAmount; bVal = b.tokenAmount; break;
      default: aVal = a.totalPoints; bVal = b.totalPoints;
    }
    return sortOrder === 'desc' ? bVal - aVal : aVal - bVal;
  });

  const filteredUsers = searchWallet
    ? sortedUsers.filter(u => u.wallet.toLowerCase().includes(searchWallet.toLowerCase()))
    : sortedUsers;

  // Access control UI
  if (!address) {
    return (
      <div className="min-h-screen bg-arcade-black flex items-center justify-center p-4">
        <div className="bg-arcade-dark p-8 max-w-md w-full text-center">
          <h1 className="text-2xl font-pixel text-arcade-green mb-4">AIRDROP ADMIN</h1>
          <p className="text-gray-400 font-pixel text-sm">Connect your wallet to access admin panel.</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-arcade-black flex items-center justify-center p-4">
        <div className="bg-arcade-dark p-8 max-w-md w-full text-center">
          <h1 className="text-2xl font-pixel text-red-500 mb-4">ACCESS DENIED</h1>
          <p className="text-gray-400 font-pixel text-sm">Your wallet is not authorized.</p>
          <p className="text-gray-500 font-mono text-xs mt-4">{address}</p>
        </div>
      </div>
    );
  }

  if (!isFirebaseAuthenticated) {
    return (
      <div className="min-h-screen bg-arcade-black flex items-center justify-center p-4">
        <div className="bg-arcade-dark p-8 max-w-md w-full text-center">
          <h1 className="text-2xl font-pixel text-arcade-green mb-4">AIRDROP ADMIN</h1>
          {isAuthenticating ? (
            <p className="text-gray-400 font-pixel text-sm">Authenticating...</p>
          ) : (
            <button onClick={signInWithWallet} className="bg-arcade-green text-arcade-black px-6 py-3 font-pixel text-sm hover:bg-arcade-green/80">
              SIGN IN WITH WALLET
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-arcade-black p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-pixel text-arcade-green">AIRDROP ADMIN DASHBOARD</h1>
          <div className="flex gap-2">
            <button
              onClick={syncZealy}
              disabled={syncing}
              className="bg-purple-600 text-white px-4 py-2 font-pixel text-sm hover:bg-purple-500 disabled:opacity-50"
            >
              {syncing ? 'SYNCING...' : 'SYNC ZEALY'}
            </button>
          </div>
        </div>

        {/* Messages */}
        {message && (
          <div className={`p-4 mb-6 font-pixel text-sm ${
            message.type === 'success' ? 'bg-green-500/20 border border-green-500 text-green-400' : 'bg-red-500/20 border border-red-500 text-red-400'
          }`}>
            {message.text}
            <button onClick={() => setMessage(null)} className="float-right">x</button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-arcade-green/30">
          {(['dashboard', 'users', 'controls', 'overrides', 'wallet-changes'] as Tab[]).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 font-pixel text-sm uppercase ${
                activeTab === tab ? 'text-arcade-green border-b-2 border-arcade-green' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {tab.replace('-', ' ')}
            </button>
          ))}
        </div>

        {/* Dashboard Tab */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {/* Status Card */}
            <div className="bg-arcade-dark p-6">
              <h2 className="text-xl font-pixel text-arcade-cyan mb-4">AIRDROP STATUS</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <div className="text-gray-400 text-xs mb-1">Status</div>
                  <div className={`text-lg font-pixel ${
                    config?.status === 'active' ? 'text-green-400' :
                    config?.status === 'paused' ? 'text-yellow-400' :
                    config?.status === 'scheduled' ? 'text-blue-400' :
                    config?.status === 'completed' ? 'text-purple-400' :
                    'text-gray-400'
                  }`}>
                    {config?.isPaused ? 'PAUSED' : config?.status?.toUpperCase() || 'LOADING...'}
                  </div>
                </div>
                <div>
                  <div className="text-gray-400 text-xs mb-1">Test Mode</div>
                  <div className={`text-lg font-pixel ${config?.testMode ? 'text-yellow-400' : 'text-green-400'}`}>
                    {config?.testMode ? 'ON' : 'OFF'}
                  </div>
                </div>
                <div>
                  <div className="text-gray-400 text-xs mb-1">Token Pool</div>
                  <div className="text-lg font-pixel text-arcade-pink">
                    {config?.totalTokenPool?.toLocaleString() || '0'}
                  </div>
                </div>
                <div>
                  <div className="text-gray-400 text-xs mb-1">Scheduled Start</div>
                  <div className="text-lg font-pixel text-arcade-cyan">
                    {config?.scheduledStart ? new Date(config.scheduledStart).toLocaleDateString() : 'Not Set'}
                  </div>
                </div>
              </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
              <div className="bg-arcade-dark p-4 text-center">
                <div className="text-2xl font-pixel text-arcade-cyan">{stats?.totalUsers || 0}</div>
                <div className="text-xs text-gray-400">Total Users</div>
              </div>
              <div className="bg-arcade-dark p-4 text-center">
                <div className="text-2xl font-pixel text-arcade-green">{stats?.eligibleUsers || 0}</div>
                <div className="text-xs text-gray-400">Eligible</div>
              </div>
              <div className="bg-arcade-dark p-4 text-center">
                <div className="text-2xl font-pixel text-arcade-pink">{stats?.totalGamesPlayed?.toLocaleString() || 0}</div>
                <div className="text-xs text-gray-400">Games Played</div>
              </div>
              <div className="bg-arcade-dark p-4 text-center">
                <div className="text-2xl font-pixel text-blue-400">{stats?.discordLinksCount || 0}</div>
                <div className="text-xs text-gray-400">Discord Links</div>
              </div>
              <div className="bg-arcade-dark p-4 text-center">
                <div className="text-2xl font-pixel text-purple-400">{stats?.zealyUsersCount || 0}</div>
                <div className="text-xs text-gray-400">Zealy Users</div>
              </div>
              <div className="bg-arcade-dark p-4 text-center">
                <div className="text-2xl font-pixel text-cyan-400">{stats?.telegramLinksCount || 0}</div>
                <div className="text-xs text-gray-400">Telegram Links</div>
              </div>
              <div className="bg-arcade-dark p-4 text-center">
                <div className="text-2xl font-pixel text-yellow-400">{stats?.overridesCount || 0}</div>
                <div className="text-xs text-gray-400">Overrides</div>
              </div>
              <div className="bg-arcade-dark p-4 text-center">
                <div className="text-2xl font-pixel text-green-400">{stats?.claimedCount || 0}</div>
                <div className="text-xs text-gray-400">Claimed</div>
              </div>
              <div className="bg-arcade-dark p-4 text-center">
                <div className="text-2xl font-pixel text-arcade-pink">{stats?.totalAllocated?.toLocaleString() || 0}</div>
                <div className="text-xs text-gray-400">Allocated</div>
              </div>
              <div className="bg-arcade-dark p-4 text-center">
                <div className="text-2xl font-pixel text-white">{stats?.totalDiscordMessages?.toLocaleString() || 0}</div>
                <div className="text-xs text-gray-400">Discord Msgs</div>
              </div>
            </div>
          </div>
        )}

        {/* Controls Tab */}
        {activeTab === 'controls' && (
          <div className="space-y-6">
            {/* Airdrop Controls */}
            <div className="bg-arcade-dark p-6">
              <h2 className="text-xl font-pixel text-arcade-cyan mb-4">AIRDROP CONTROLS</h2>
              <div className="flex flex-wrap gap-4">
                {config?.status === 'inactive' && (
                  <>
                    <button
                      onClick={() => startAirdrop(true)}
                      disabled={actionLoading}
                      className="bg-green-600 text-white px-6 py-3 font-pixel text-sm hover:bg-green-500 disabled:opacity-50"
                    >
                      START NOW
                    </button>
                    <button
                      onClick={() => setShowSchedule(true)}
                      disabled={actionLoading}
                      className="bg-blue-600 text-white px-6 py-3 font-pixel text-sm hover:bg-blue-500 disabled:opacity-50"
                    >
                      SCHEDULE
                    </button>
                  </>
                )}
                {config?.status === 'active' && !config?.isPaused && (
                  <button
                    onClick={pauseAirdrop}
                    disabled={actionLoading}
                    className="bg-yellow-600 text-white px-6 py-3 font-pixel text-sm hover:bg-yellow-500 disabled:opacity-50"
                  >
                    PAUSE
                  </button>
                )}
                {config?.isPaused && (
                  <button
                    onClick={resumeAirdrop}
                    disabled={actionLoading}
                    className="bg-green-600 text-white px-6 py-3 font-pixel text-sm hover:bg-green-500 disabled:opacity-50"
                  >
                    RESUME
                  </button>
                )}
                {(config?.status === 'active' || config?.status === 'scheduled') && (
                  <>
                    <button
                      onClick={() => setShowSchedule(true)}
                      disabled={actionLoading}
                      className="bg-blue-600 text-white px-6 py-3 font-pixel text-sm hover:bg-blue-500 disabled:opacity-50"
                    >
                      EXTEND
                    </button>
                    <button
                      onClick={stopAirdrop}
                      disabled={actionLoading}
                      className="bg-red-600 text-white px-6 py-3 font-pixel text-sm hover:bg-red-500 disabled:opacity-50"
                    >
                      STOP
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Test Distribution */}
            <div className="bg-arcade-dark p-6">
              <h2 className="text-xl font-pixel text-arcade-cyan mb-4">TEST DISTRIBUTION</h2>
              <p className="text-gray-400 text-sm mb-4">Run a test airdrop distribution on testnet to verify everything works.</p>
              <button
                onClick={handleTestDistribution}
                disabled={actionLoading || !config?.testMode}
                className="bg-purple-600 text-white px-6 py-3 font-pixel text-sm hover:bg-purple-500 disabled:opacity-50"
              >
                RUN TEST DISTRIBUTION
              </button>
              {!config?.testMode && (
                <p className="text-yellow-400 text-xs mt-2">Enable test mode first</p>
              )}
            </div>

            {/* Trigger Snapshot */}
            <div className="bg-arcade-dark p-6">
              <h2 className="text-xl font-pixel text-arcade-cyan mb-4">TRIGGER SNAPSHOT</h2>
              <p className="text-gray-400 text-sm mb-4">Create a new airdrop snapshot with current user data.</p>
              <button
                onClick={async () => {
                  if (!confirm('Create a new airdrop snapshot?')) return;
                  setActionLoading(true);
                  try {
                    const trigger = httpsCallable(functions, 'triggerAirdropSnapshot');
                    const result = await trigger({});
                    const data = result.data as { snapshotId: string; totalRecipients: number };
                    setMessage({ type: 'success', text: `Snapshot created: ${data.snapshotId} (${data.totalRecipients} recipients)` });
                  } catch (err: any) {
                    setMessage({ type: 'error', text: err.message });
                  } finally {
                    setActionLoading(false);
                  }
                }}
                disabled={actionLoading}
                className="bg-arcade-green text-arcade-black px-6 py-3 font-pixel text-sm hover:bg-arcade-green/80 disabled:opacity-50"
              >
                CREATE SNAPSHOT
              </button>
            </div>
          </div>
        )}

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div className="space-y-6">
            {/* Controls */}
            <div className="bg-arcade-dark p-4 flex flex-wrap gap-4 items-center">
              <input
                type="text"
                placeholder="Search wallet..."
                value={searchWallet}
                onChange={(e) => setSearchWallet(e.target.value)}
                className="bg-arcade-black text-arcade-green px-4 py-2 font-mono text-sm border border-arcade-green/30 flex-1 min-w-[200px]"
              />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-arcade-black text-arcade-green px-4 py-2 font-pixel text-sm border border-arcade-green/30"
              >
                <option value="points">Sort by Points</option>
                <option value="games">Sort by Games</option>
                <option value="tokens">Sort by Tokens</option>
              </select>
              <button
                onClick={() => setSortOrder(o => o === 'desc' ? 'asc' : 'desc')}
                className="bg-arcade-black text-arcade-green px-4 py-2 font-pixel text-sm border border-arcade-green/30"
              >
                {sortOrder === 'desc' ? '↓' : '↑'}
              </button>
              <button
                onClick={loadAllocations}
                disabled={loading}
                className="bg-arcade-green text-arcade-black px-4 py-2 font-pixel text-sm disabled:opacity-50"
              >
                REFRESH
              </button>
            </div>

            {/* User Table */}
            <div className="bg-arcade-dark overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-arcade-black">
                  <tr className="text-gray-400 font-pixel text-xs">
                    <th className="p-3 text-left">#</th>
                    <th className="p-3 text-left">WALLET</th>
                    <th className="p-3 text-right">GAMES</th>
                    <th className="p-3 text-right">POINTS</th>
                    <th className="p-3 text-center">TIER</th>
                    <th className="p-3 text-right">TOKENS</th>
                    <th className="p-3 text-right">DISCORD</th>
                    <th className="p-3 text-right">TELEGRAM</th>
                    <th className="p-3 text-right">STAKING</th>
                    <th className="p-3 text-right">ZEALY</th>
                    <th className="p-3 text-center">ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user, index) => (
                    <tr key={user.wallet} className="border-t border-arcade-black/50 hover:bg-arcade-black/30">
                      <td className="p-3 text-gray-500">{index + 1}</td>
                      <td className="p-3 font-mono text-arcade-cyan">
                        {user.wallet.slice(0, 6)}...{user.wallet.slice(-4)}
                        {user.isEarlyAdopter && <span className="ml-2 text-yellow-400">*</span>}
                      </td>
                      <td className="p-3 text-right text-white">{user.gamesPlayed}</td>
                      <td className="p-3 text-right text-arcade-green font-bold">{user.totalPoints}</td>
                      <td className="p-3 text-center">
                        <span className={`px-2 py-1 rounded text-xs font-pixel ${
                          user.tier === 'legendary' ? 'bg-yellow-500/20 text-yellow-400' :
                          user.tier === 'epic' ? 'bg-purple-500/20 text-purple-400' :
                          user.tier === 'rare' ? 'bg-blue-500/20 text-blue-400' :
                          'bg-gray-500/20 text-gray-400'
                        }`}>
                          {user.tier.toUpperCase()}
                        </span>
                      </td>
                      <td className="p-3 text-right text-arcade-pink font-bold">{user.tokenAmount.toLocaleString()}</td>
                      <td className="p-3 text-right text-gray-300">{user.discordMessages}</td>
                      <td className="p-3 text-right text-gray-300">{user.telegramMessages || 0}</td>
                      <td className="p-3 text-right text-gray-300">{user.stakedAmount ? user.stakedAmount.toLocaleString() : '0'}</td>
                      <td className="p-3 text-right text-gray-300">{user.zealyXP}</td>
                      <td className="p-3 text-center">
                        <button
                          onClick={() => { setSelectedUser(user); setShowEditWallet(true); }}
                          className="text-blue-400 hover:text-blue-300 mr-2 text-xs"
                        >
                          WALLET
                        </button>
                        <button
                          onClick={() => { setSelectedUser(user); setShowOverrideAllocation(true); }}
                          className="text-yellow-400 hover:text-yellow-300 text-xs"
                        >
                          OVERRIDE
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {loading && <div className="p-8 text-center text-arcade-green font-pixel">Loading...</div>}
              {!loading && filteredUsers.length === 0 && <div className="p-8 text-center text-gray-500 font-pixel">No users found</div>}
            </div>
          </div>
        )}

        {/* Overrides Tab */}
        {activeTab === 'overrides' && (
          <div className="bg-arcade-dark overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-arcade-black">
                <tr className="text-gray-400 font-pixel text-xs">
                  <th className="p-3 text-left">WALLET</th>
                  <th className="p-3 text-right">TOKENS</th>
                  <th className="p-3 text-center">TIER</th>
                  <th className="p-3 text-right">POINTS</th>
                  <th className="p-3 text-left">REASON</th>
                  <th className="p-3 text-left">DATE</th>
                  <th className="p-3 text-center">ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {overrides.map((o) => (
                  <tr key={o.id} className="border-t border-arcade-black/50">
                    <td className="p-3 font-mono text-arcade-cyan">{o.wallet?.slice(0, 10)}...</td>
                    <td className="p-3 text-right text-arcade-pink">{o.tokenAmountFormatted?.toLocaleString() || '-'}</td>
                    <td className="p-3 text-center text-yellow-400">{o.tier || '-'}</td>
                    <td className="p-3 text-right text-arcade-green">{o.points || '-'}</td>
                    <td className="p-3 text-gray-400">{o.overrideReason}</td>
                    <td className="p-3 text-gray-500 text-xs">{o.overrideAt ? new Date(o.overrideAt).toLocaleString() : '-'}</td>
                    <td className="p-3 text-center">
                      <button
                        onClick={() => handleRemoveOverride(o.wallet)}
                        className="text-red-400 hover:text-red-300 text-xs"
                      >
                        REMOVE
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {overrides.length === 0 && <div className="p-8 text-center text-gray-500 font-pixel">No overrides</div>}
          </div>
        )}

        {/* Wallet Changes Tab */}
        {activeTab === 'wallet-changes' && (
          <div className="bg-arcade-dark overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-arcade-black">
                <tr className="text-gray-400 font-pixel text-xs">
                  <th className="p-3 text-left">OLD WALLET</th>
                  <th className="p-3 text-left">NEW WALLET</th>
                  <th className="p-3 text-left">REASON</th>
                  <th className="p-3 text-left">CHANGED BY</th>
                  <th className="p-3 text-left">DATE</th>
                </tr>
              </thead>
              <tbody>
                {walletChanges.map((c) => (
                  <tr key={c.id} className="border-t border-arcade-black/50">
                    <td className="p-3 font-mono text-red-400">{c.oldWallet?.slice(0, 10)}...</td>
                    <td className="p-3 font-mono text-green-400">{c.newWallet?.slice(0, 10)}...</td>
                    <td className="p-3 text-gray-400">{c.reason}</td>
                    <td className="p-3 font-mono text-gray-500 text-xs">{c.changedBy?.slice(0, 10)}...</td>
                    <td className="p-3 text-gray-500 text-xs">{c.changedAt ? new Date(c.changedAt).toLocaleString() : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {walletChanges.length === 0 && <div className="p-8 text-center text-gray-500 font-pixel">No wallet changes</div>}
          </div>
        )}

        {/* Edit Wallet Modal */}
        {showEditWallet && selectedUser && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
            <div className="bg-arcade-dark p-6 max-w-md w-full">
              <h2 className="text-xl font-pixel text-arcade-cyan mb-4">EDIT USER WALLET</h2>
              <p className="text-gray-400 text-sm mb-4">
                Current: <span className="font-mono text-arcade-cyan">{selectedUser.wallet}</span>
              </p>
              <input
                type="text"
                placeholder="New wallet address (0x...)"
                value={newWallet}
                onChange={(e) => setNewWallet(e.target.value)}
                className="w-full bg-arcade-black text-arcade-green px-4 py-2 font-mono text-sm border border-arcade-green/30 mb-4"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleEditWallet}
                  disabled={actionLoading || !newWallet}
                  className="flex-1 bg-arcade-green text-arcade-black px-4 py-2 font-pixel text-sm disabled:opacity-50"
                >
                  SAVE
                </button>
                <button
                  onClick={() => { setShowEditWallet(false); setNewWallet(''); }}
                  className="flex-1 bg-gray-600 text-white px-4 py-2 font-pixel text-sm"
                >
                  CANCEL
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Override Allocation Modal */}
        {showOverrideAllocation && selectedUser && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
            <div className="bg-arcade-dark p-6 max-w-md w-full">
              <h2 className="text-xl font-pixel text-arcade-cyan mb-4">OVERRIDE ALLOCATION</h2>
              <p className="text-gray-400 text-sm mb-4">
                User: <span className="font-mono text-arcade-cyan">{selectedUser.wallet.slice(0, 10)}...</span>
              </p>
              <div className="space-y-4">
                <input
                  type="number"
                  placeholder="Token amount (leave empty to keep current)"
                  value={overrideTokens}
                  onChange={(e) => setOverrideTokens(e.target.value)}
                  className="w-full bg-arcade-black text-arcade-green px-4 py-2 font-mono text-sm border border-arcade-green/30"
                />
                <select
                  value={overrideTier}
                  onChange={(e) => setOverrideTier(e.target.value)}
                  className="w-full bg-arcade-black text-arcade-green px-4 py-2 font-pixel text-sm border border-arcade-green/30"
                >
                  <option value="">Keep current tier</option>
                  <option value="legendary">Legendary</option>
                  <option value="epic">Epic</option>
                  <option value="rare">Rare</option>
                  <option value="common">Common</option>
                </select>
                <input
                  type="number"
                  placeholder="Points (leave empty to keep current)"
                  value={overridePoints}
                  onChange={(e) => setOverridePoints(e.target.value)}
                  className="w-full bg-arcade-black text-arcade-green px-4 py-2 font-mono text-sm border border-arcade-green/30"
                />
                <input
                  type="text"
                  placeholder="Reason for override"
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  className="w-full bg-arcade-black text-arcade-green px-4 py-2 font-mono text-sm border border-arcade-green/30"
                />
              </div>
              <div className="flex gap-2 mt-4">
                <button
                  onClick={handleOverrideAllocation}
                  disabled={actionLoading}
                  className="flex-1 bg-yellow-600 text-white px-4 py-2 font-pixel text-sm disabled:opacity-50"
                >
                  OVERRIDE
                </button>
                <button
                  onClick={() => { setShowOverrideAllocation(false); resetOverrideForm(); }}
                  className="flex-1 bg-gray-600 text-white px-4 py-2 font-pixel text-sm"
                >
                  CANCEL
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Schedule Modal */}
        {showSchedule && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
            <div className="bg-arcade-dark p-6 max-w-md w-full">
              <h2 className="text-xl font-pixel text-arcade-cyan mb-4">SCHEDULE AIRDROP</h2>
              <div className="space-y-4">
                <div>
                  <label className="text-gray-400 text-sm block mb-1">Start Date/Time</label>
                  <input
                    type="datetime-local"
                    value={scheduleStart}
                    onChange={(e) => setScheduleStart(e.target.value)}
                    className="w-full bg-arcade-black text-arcade-green px-4 py-2 font-mono text-sm border border-arcade-green/30"
                  />
                </div>
                <div>
                  <label className="text-gray-400 text-sm block mb-1">End Date/Time</label>
                  <input
                    type="datetime-local"
                    value={scheduleEnd}
                    onChange={(e) => setScheduleEnd(e.target.value)}
                    className="w-full bg-arcade-black text-arcade-green px-4 py-2 font-mono text-sm border border-arcade-green/30"
                  />
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                {config?.status === 'inactive' && (
                  <button
                    onClick={() => startAirdrop(false)}
                    disabled={actionLoading || !scheduleStart}
                    className="flex-1 bg-blue-600 text-white px-4 py-2 font-pixel text-sm disabled:opacity-50"
                  >
                    SCHEDULE START
                  </button>
                )}
                {(config?.status === 'active' || config?.status === 'scheduled') && (
                  <button
                    onClick={extendAirdrop}
                    disabled={actionLoading || !scheduleEnd}
                    className="flex-1 bg-green-600 text-white px-4 py-2 font-pixel text-sm disabled:opacity-50"
                  >
                    EXTEND
                  </button>
                )}
                <button
                  onClick={() => { setShowSchedule(false); setScheduleStart(''); setScheduleEnd(''); }}
                  className="flex-1 bg-gray-600 text-white px-4 py-2 font-pixel text-sm"
                >
                  CANCEL
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
