'use client';

type Period = 'daily' | 'weekly' | 'allTime';

interface LeaderboardTabsProps {
  activePeriod: Period;
  onPeriodChange: (period: Period) => void;
}

export default function LeaderboardTabs({
  activePeriod,
  onPeriodChange,
}: LeaderboardTabsProps) {
  const tabs: { id: Period; label: string }[] = [
    { id: 'daily', label: 'TODAY' },
    { id: 'weekly', label: 'WEEK' },
    { id: 'allTime', label: 'ALL TIME' },
  ];

  return (
    <div className="flex gap-2 mb-4">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onPeriodChange(tab.id)}
          className={`
            px-4 py-2 font-pixel text-xs transition-all
            ${
              activePeriod === tab.id
                ? 'bg-arcade-green text-arcade-black'
                : 'bg-arcade-dark text-gray-400 hover:text-arcade-green hover:bg-arcade-dark/70'
            }
          `}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
