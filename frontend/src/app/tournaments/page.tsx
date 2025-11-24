'use client';

import { useState } from 'react';
import { useAccount } from 'wagmi';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { formatNumber, formatTimeRemaining } from '@/lib/utils';

type TournamentStatus = 'upcoming' | 'active' | 'ended';

// Placeholder tournament data
const TOURNAMENTS = [
  {
    id: '1',
    name: 'Weekly Championship',
    description: 'Compete in all games for the weekly prize pool',
    games: ['All Games'],
    entryFee: 100,
    prizePool: 50000,
    startTime: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    endTime: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
    status: 'active' as TournamentStatus,
    participants: 128,
    maxParticipants: 256,
  },
  {
    id: '2',
    name: 'Space Rocks Masters',
    description: 'Single game tournament - Space Rocks only',
    games: ['Space Rocks'],
    entryFee: 50,
    prizePool: 15000,
    startTime: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
    endTime: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000),
    status: 'upcoming' as TournamentStatus,
    participants: 45,
    maxParticipants: 100,
  },
  {
    id: '3',
    name: 'Retro Rumble',
    description: 'Classic games showdown',
    games: ['Chomper', 'Pixel Snake', 'Brick Breaker'],
    entryFee: 75,
    prizePool: 25000,
    startTime: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    endTime: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    status: 'ended' as TournamentStatus,
    participants: 200,
    maxParticipants: 200,
  },
];

export default function TournamentsPage() {
  const { isConnected } = useAccount();
  const [filter, setFilter] = useState<TournamentStatus | 'all'>('all');

  const filteredTournaments =
    filter === 'all'
      ? TOURNAMENTS
      : TOURNAMENTS.filter((t) => t.status === filter);

  const getStatusColor = (status: TournamentStatus) => {
    switch (status) {
      case 'active':
        return 'text-arcade-green';
      case 'upcoming':
        return 'text-arcade-cyan';
      case 'ended':
        return 'text-gray-500';
    }
  };

  const getStatusBadge = (status: TournamentStatus) => {
    switch (status) {
      case 'active':
        return (
          <span className="px-2 py-1 bg-arcade-green/20 text-arcade-green font-pixel text-xs rounded">
            LIVE
          </span>
        );
      case 'upcoming':
        return (
          <span className="px-2 py-1 bg-arcade-cyan/20 text-arcade-cyan font-pixel text-xs rounded">
            SOON
          </span>
        );
      case 'ended':
        return (
          <span className="px-2 py-1 bg-gray-500/20 text-gray-500 font-pixel text-xs rounded">
            ENDED
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="font-pixel text-2xl md:text-3xl text-arcade-pink glow-pink mb-2">
            TOURNAMENTS
          </h1>
          <p className="font-arcade text-gray-400">
            Compete for 8BIT token prizes
          </p>
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-6 justify-center">
          {(['all', 'active', 'upcoming', 'ended'] as const).map((status) => (
            <Button
              key={status}
              variant={filter === status ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => setFilter(status)}
            >
              {status === 'all' ? 'All' : status}
            </Button>
          ))}
        </div>

        {/* Tournament List */}
        <div className="space-y-4">
          {filteredTournaments.map((tournament) => (
            <Card key={tournament.id} className="hover:border-arcade-pink/60">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                {/* Tournament Info */}
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-pixel text-white text-sm">
                      {tournament.name}
                    </h3>
                    {getStatusBadge(tournament.status)}
                  </div>
                  <p className="font-arcade text-gray-400 text-sm mb-2">
                    {tournament.description}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {tournament.games.map((game) => (
                      <span
                        key={game}
                        className="px-2 py-1 bg-arcade-dark border border-arcade-green/30 text-arcade-green font-arcade text-xs rounded"
                      >
                        {game}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Prize & Stats */}
                <div className="flex flex-col items-end gap-2">
                  <div className="text-right">
                    <p className="font-arcade text-xs text-gray-500">
                      Prize Pool
                    </p>
                    <p className="font-pixel text-arcade-yellow">
                      {formatNumber(tournament.prizePool)} 8BIT
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-arcade text-xs text-gray-500">
                      Entry Fee
                    </p>
                    <p className="font-arcade text-arcade-cyan">
                      {tournament.entryFee} 8BIT
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-arcade text-xs text-gray-500">Players</p>
                    <p className="font-arcade text-white">
                      {tournament.participants}
                      {tournament.maxParticipants && (
                        <span className="text-gray-500">
                          /{tournament.maxParticipants}
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                {/* Action */}
                <div className="flex flex-col items-center gap-2 md:ml-4">
                  {tournament.status === 'active' && (
                    <>
                      <p className="font-arcade text-xs text-gray-500">
                        Ends in
                      </p>
                      <p className={`font-pixel text-sm ${getStatusColor(tournament.status)}`}>
                        {formatTimeRemaining(tournament.endTime)}
                      </p>
                      {isConnected ? (
                        <Button variant="primary" size="sm">
                          Enter
                        </Button>
                      ) : (
                        <Button variant="secondary" size="sm" disabled>
                          Connect Wallet
                        </Button>
                      )}
                    </>
                  )}
                  {tournament.status === 'upcoming' && (
                    <>
                      <p className="font-arcade text-xs text-gray-500">
                        Starts in
                      </p>
                      <p className={`font-pixel text-sm ${getStatusColor(tournament.status)}`}>
                        {formatTimeRemaining(tournament.startTime)}
                      </p>
                      <Button variant="secondary" size="sm">
                        Notify Me
                      </Button>
                    </>
                  )}
                  {tournament.status === 'ended' && (
                    <Button variant="ghost" size="sm">
                      View Results
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Prize Distribution Info */}
        <div className="mt-12">
          <h2 className="font-pixel text-arcade-green text-sm text-center mb-6">
            PRIZE DISTRIBUTION
          </h2>
          <div className="grid grid-cols-3 md:grid-cols-5 gap-4 text-center">
            {[
              { place: '1st', percent: '50%', color: 'text-arcade-yellow' },
              { place: '2nd', percent: '25%', color: 'text-gray-300' },
              { place: '3rd', percent: '15%', color: 'text-arcade-orange' },
              { place: 'Platform', percent: '5%', color: 'text-gray-500' },
              { place: 'Burned', percent: '5%', color: 'text-arcade-red' },
            ].map((item) => (
              <div key={item.place} className="card-arcade py-4">
                <p className={`font-pixel text-sm ${item.color}`}>
                  {item.place}
                </p>
                <p className="font-arcade text-white mt-1">{item.percent}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
