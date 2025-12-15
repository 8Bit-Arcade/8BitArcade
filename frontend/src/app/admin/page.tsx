'use client';

import { useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { callFunction } from '@/lib/firebase-functions';

export default function AdminPanel() {
  const { address } = useAuthStore();
  const [playerId, setPlayerId] = useState('');
  const [userInfo, setUserInfo] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const showMessage = (msg: string, isError = false) => {
    if (isError) {
      setError(msg);
      setMessage('');
    } else {
      setMessage(msg);
      setError('');
    }
    setTimeout(() => {
      setMessage('');
      setError('');
    }, 5000);
  };

  const getUserInfo = async () => {
    if (!playerId.trim()) {
      showMessage('Please enter a player ID', true);
      return;
    }

    setLoading(true);
    try {
      const result = await callFunction<any, any>('getUserBanInfo', {
        playerId: playerId.trim().toLowerCase()
      });
      setUserInfo(result);
      showMessage('User info loaded successfully');
    } catch (err: any) {
      showMessage(err.message || 'Failed to load user info', true);
      setUserInfo(null);
    } finally {
      setLoading(false);
    }
  };

  const unbanUser = async () => {
    if (!playerId.trim()) {
      showMessage('Please enter a player ID', true);
      return;
    }

    setLoading(true);
    try {
      await callFunction<any, any>('unbanAccount', {
        playerId: playerId.trim().toLowerCase()
      });
      showMessage('User unbanned successfully');
      await getUserInfo(); // Refresh user info
    } catch (err: any) {
      showMessage(err.message || 'Failed to unban user', true);
    } finally {
      setLoading(false);
    }
  };

  const clearFlags = async () => {
    if (!playerId.trim()) {
      showMessage('Please enter a player ID', true);
      return;
    }

    setLoading(true);
    try {
      await callFunction<any, any>('clearUserFlags', {
        playerId: playerId.trim().toLowerCase()
      });
      showMessage('Flags cleared successfully');
      await getUserInfo(); // Refresh user info
    } catch (err: any) {
      showMessage(err.message || 'Failed to clear flags', true);
    } finally {
      setLoading(false);
    }
  };

  if (!address) {
    return (
      <div className="min-h-screen bg-arcade-black flex items-center justify-center p-4">
        <div className="bg-arcade-dark p-8 max-w-md w-full">
          <h1 className="text-2xl font-pixel text-arcade-green mb-4">ADMIN PANEL</h1>
          <p className="text-gray-400 font-pixel text-sm">Please connect your wallet to access the admin panel.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-arcade-black p-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-pixel text-arcade-green mb-8">ADMIN PANEL</h1>

        {/* Messages */}
        {message && (
          <div className="bg-arcade-green text-arcade-black p-4 mb-4 font-pixel text-sm">
            {message}
          </div>
        )}
        {error && (
          <div className="bg-red-500 text-white p-4 mb-4 font-pixel text-sm">
            {error}
          </div>
        )}

        {/* User Lookup */}
        <div className="bg-arcade-dark p-6 mb-6">
          <h2 className="text-xl font-pixel text-arcade-green mb-4">USER LOOKUP</h2>
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={playerId}
              onChange={(e) => setPlayerId(e.target.value)}
              placeholder="Enter player ID (wallet address)"
              className="flex-1 bg-arcade-black text-arcade-green p-3 font-mono text-sm border border-arcade-green/30 focus:border-arcade-green focus:outline-none"
            />
            <button
              onClick={getUserInfo}
              disabled={loading}
              className="bg-arcade-green text-arcade-black px-6 py-3 font-pixel text-sm hover:bg-arcade-green/80 disabled:opacity-50"
            >
              {loading ? 'LOADING...' : 'LOOKUP'}
            </button>
          </div>

          {userInfo && (
            <div className="bg-arcade-black p-4 border border-arcade-green/30">
              <div className="space-y-2 font-mono text-sm">
                <div>
                  <span className="text-gray-400">Player ID:</span>{' '}
                  <span className="text-arcade-green">{userInfo.playerId}</span>
                </div>
                <div>
                  <span className="text-gray-400">Banned:</span>{' '}
                  <span className={userInfo.isBanned ? 'text-red-500' : 'text-arcade-green'}>
                    {userInfo.isBanned ? 'YES' : 'NO'}
                  </span>
                </div>
                {userInfo.isBanned && (
                  <>
                    <div>
                      <span className="text-gray-400">Ban Reason:</span>{' '}
                      <span className="text-red-400">{userInfo.banReason}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">Banned At:</span>{' '}
                      <span className="text-gray-300">
                        {userInfo.bannedAt ? new Date(userInfo.bannedAt.seconds * 1000).toLocaleString() : 'N/A'}
                      </span>
                    </div>
                  </>
                )}
                <div>
                  <span className="text-gray-400">Total Flags:</span>{' '}
                  <span className="text-yellow-400">{userInfo.flags?.count || 0}</span>
                </div>
                {userInfo.flags?.reasons && userInfo.flags.reasons.length > 0 && (
                  <div className="mt-4">
                    <div className="text-gray-400 mb-2">Flag History:</div>
                    <div className="max-h-60 overflow-y-auto space-y-2">
                      {userInfo.flags.reasons.map((flag: any, index: number) => (
                        <div key={index} className="bg-arcade-dark p-2 border border-yellow-500/30">
                          <div className="text-yellow-400 text-xs">
                            {flag.type} ({flag.severity})
                          </div>
                          <div className="text-gray-400 text-xs">
                            Game: {flag.gameId} | Score: {flag.claimedScore}
                          </div>
                          <div className="text-gray-500 text-xs">
                            {flag.timestamp ? new Date(flag.timestamp.seconds * 1000).toLocaleString() : 'N/A'}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 mt-4">
                {userInfo.isBanned && (
                  <button
                    onClick={unbanUser}
                    disabled={loading}
                    className="bg-arcade-green text-arcade-black px-6 py-2 font-pixel text-sm hover:bg-arcade-green/80 disabled:opacity-50"
                  >
                    UNBAN USER
                  </button>
                )}
                {userInfo.flags?.count > 0 && (
                  <button
                    onClick={clearFlags}
                    disabled={loading}
                    className="bg-yellow-500 text-arcade-black px-6 py-2 font-pixel text-sm hover:bg-yellow-500/80 disabled:opacity-50"
                  >
                    CLEAR FLAGS
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Info Section */}
        <div className="bg-arcade-dark p-6 border-l-4 border-arcade-green">
          <h3 className="text-lg font-pixel text-arcade-green mb-2">ADMIN ACTIONS</h3>
          <ul className="space-y-2 font-pixel text-xs text-gray-400">
            <li>• LOOKUP: View user ban status and flag history</li>
            <li>• UNBAN: Remove ban from user account</li>
            <li>• CLEAR FLAGS: Reset all anti-cheat flags for user</li>
          </ul>
          <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/30">
            <p className="font-pixel text-xs text-yellow-400">
              NOTE: Updated ban thresholds - 5 high severity, 10 medium severity, or 20 total flags trigger auto-ban
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
