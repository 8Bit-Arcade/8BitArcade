'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useWalletAuth } from '@/hooks/useWalletAuth';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '@/lib/firebase';

// Admin wallet addresses that can access this page
const ADMIN_WALLETS = [
  '0x96e0b627454ce3b8c55c6d36b5fcbb13849dc297', // Add your admin wallet(s) here
];

interface UserAllocation {
  wallet: string;
  gamesPlayed: number;
  totalPoints: number;
  tier: string;
  tokenAmount: number;
  tournamentEntries: number;
  discordMessages: number;
  zealyXP: number;
  isEarlyAdopter: boolean;
  createdAt?: string;
}

export default function AdminAirdropPage() {
  const { address } = useAuthStore();
  const { signInWithWallet, isAuthenticating, isFirebaseAuthenticated } = useWalletAuth();
  const [users, setUsers] = useState<UserAllocation[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [sortBy, setSortBy] = useState<'points' | 'games' | 'tokens'>('points');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [searchWallet, setSearchWallet] = useState('');

  const functions = getFunctions(app);

  // Check if current user is admin
  const isAdmin = address && ADMIN_WALLETS.includes(address.toLowerCase());

  // Automatically sign in when wallet is connected
  useEffect(() => {
    if (address && !isFirebaseAuthenticated && !isAuthenticating) {
      signInWithWallet();
    }
  }, [address, isFirebaseAuthenticated, isAuthenticating, signInWithWallet]);

  // Load all user allocations
  const loadAllocations = async () => {
    setLoading(true);
    setError('');
    try {
      const getAllocations = httpsCallable(functions, 'getAdminAirdropAllocations');
      const result = await getAllocations({});
      const data = result.data as { users: UserAllocation[], total: number };
      setUsers(data.users || []);
    } catch (err: any) {
      console.error('Error loading allocations:', err);
      setError(err.message || 'Failed to load allocations');
    } finally {
      setLoading(false);
    }
  };

  // Sync Zealy data
  const syncZealy = async () => {
    setSyncing(true);
    setSyncResult(null);
    setError('');
    try {
      const syncZealyUsers = httpsCallable(functions, 'syncZealyUsers');
      const result = await syncZealyUsers({});
      const data = result.data as { totalUsers: number; usersWithWallet: number; message: string };
      setSyncResult(`✓ ${data.message}`);
      // Reload allocations to show updated Zealy data
      await loadAllocations();
    } catch (err: any) {
      console.error('Error syncing Zealy:', err);
      setError(err.message || 'Failed to sync Zealy data');
    } finally {
      setSyncing(false);
    }
  };

  // Load on mount if authenticated
  useEffect(() => {
    if (isFirebaseAuthenticated && isAdmin) {
      loadAllocations();
    }
  }, [isFirebaseAuthenticated, isAdmin]);

  // Sort users
  const sortedUsers = [...users].sort((a, b) => {
    let aVal, bVal;
    switch (sortBy) {
      case 'games':
        aVal = a.gamesPlayed;
        bVal = b.gamesPlayed;
        break;
      case 'tokens':
        aVal = a.tokenAmount;
        bVal = b.tokenAmount;
        break;
      default:
        aVal = a.totalPoints;
        bVal = b.totalPoints;
    }
    return sortOrder === 'desc' ? bVal - aVal : aVal - bVal;
  });

  // Filter by search
  const filteredUsers = searchWallet
    ? sortedUsers.filter(u => u.wallet.toLowerCase().includes(searchWallet.toLowerCase()))
    : sortedUsers;

  // Calculate totals
  const totalTokens = users.reduce((sum, u) => sum + u.tokenAmount, 0);
  const totalGames = users.reduce((sum, u) => sum + u.gamesPlayed, 0);
  const tierCounts = {
    legendary: users.filter(u => u.tier === 'legendary').length,
    epic: users.filter(u => u.tier === 'epic').length,
    rare: users.filter(u => u.tier === 'rare').length,
    common: users.filter(u => u.tier === 'common').length,
  };

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
          <p className="text-gray-400 font-pixel text-sm">Your wallet is not authorized to access this page.</p>
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
            <button
              onClick={signInWithWallet}
              className="bg-arcade-green text-arcade-black px-6 py-3 font-pixel text-sm hover:bg-arcade-green/80"
            >
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
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-pixel text-arcade-green">AIRDROP ADMIN</h1>
          <div className="flex gap-2">
            <button
              onClick={syncZealy}
              disabled={syncing || loading}
              className="bg-purple-600 text-white px-4 py-2 font-pixel text-sm hover:bg-purple-500 disabled:opacity-50"
            >
              {syncing ? 'SYNCING...' : 'SYNC ZEALY'}
            </button>
            <button
              onClick={loadAllocations}
              disabled={loading}
              className="bg-arcade-green text-arcade-black px-4 py-2 font-pixel text-sm hover:bg-arcade-green/80 disabled:opacity-50"
            >
              {loading ? 'LOADING...' : 'REFRESH'}
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-500/20 border border-red-500 text-red-400 p-4 mb-6 font-pixel text-sm">
            {error}
          </div>
        )}

        {syncResult && (
          <div className="bg-green-500/20 border border-green-500 text-green-400 p-4 mb-6 font-pixel text-sm">
            {syncResult}
          </div>
        )}

        {/* Stats Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
          <div className="bg-arcade-dark p-4 text-center">
            <div className="text-2xl font-pixel text-arcade-cyan">{users.length}</div>
            <div className="text-xs text-gray-400">Total Users</div>
          </div>
          <div className="bg-arcade-dark p-4 text-center">
            <div className="text-2xl font-pixel text-arcade-green">{totalGames.toLocaleString()}</div>
            <div className="text-xs text-gray-400">Total Games</div>
          </div>
          <div className="bg-arcade-dark p-4 text-center">
            <div className="text-2xl font-pixel text-arcade-pink">{totalTokens.toLocaleString()}</div>
            <div className="text-xs text-gray-400">Tokens Allocated</div>
          </div>
          <div className="bg-arcade-dark p-4 text-center">
            <div className="text-2xl font-pixel text-yellow-400">{tierCounts.legendary}</div>
            <div className="text-xs text-gray-400">Legendary</div>
          </div>
          <div className="bg-arcade-dark p-4 text-center">
            <div className="text-2xl font-pixel text-purple-400">{tierCounts.epic}</div>
            <div className="text-xs text-gray-400">Epic</div>
          </div>
          <div className="bg-arcade-dark p-4 text-center">
            <div className="text-2xl font-pixel text-blue-400">{tierCounts.rare}</div>
            <div className="text-xs text-gray-400">Rare</div>
          </div>
        </div>

        {/* Controls */}
        <div className="bg-arcade-dark p-4 mb-6 flex flex-wrap gap-4 items-center">
          <input
            type="text"
            placeholder="Search wallet..."
            value={searchWallet}
            onChange={(e) => setSearchWallet(e.target.value)}
            className="bg-arcade-black text-arcade-green px-4 py-2 font-mono text-sm border border-arcade-green/30 focus:border-arcade-green focus:outline-none flex-1 min-w-[200px]"
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
            className="bg-arcade-black text-arcade-green px-4 py-2 font-pixel text-sm border border-arcade-green/30 hover:bg-arcade-green/10"
          >
            {sortOrder === 'desc' ? '↓ DESC' : '↑ ASC'}
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
                <th className="p-3 text-right">TOURNAMENTS</th>
                <th className="p-3 text-right">DISCORD</th>
                <th className="p-3 text-right">ZEALY</th>
                <th className="p-3 text-center">EARLY</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user, index) => (
                <tr key={user.wallet} className="border-t border-arcade-black/50 hover:bg-arcade-black/30">
                  <td className="p-3 text-gray-500">{index + 1}</td>
                  <td className="p-3 font-mono text-arcade-cyan">
                    {user.wallet.slice(0, 6)}...{user.wallet.slice(-4)}
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
                  <td className="p-3 text-right text-arcade-pink font-bold">
                    {user.tokenAmount.toLocaleString()}
                  </td>
                  <td className="p-3 text-right text-gray-300">{user.tournamentEntries}</td>
                  <td className="p-3 text-right text-gray-300">{user.discordMessages}</td>
                  <td className="p-3 text-right text-gray-300">{user.zealyXP}</td>
                  <td className="p-3 text-center">
                    {user.isEarlyAdopter && <span className="text-yellow-400">★</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredUsers.length === 0 && !loading && (
            <div className="p-8 text-center text-gray-500 font-pixel">
              No users found
            </div>
          )}
          {loading && (
            <div className="p-8 text-center text-arcade-green font-pixel">
              Loading allocations...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
