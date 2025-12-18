# Tournament Winners Display - Implementation Guide

## Issue
Tournament page shows "No tournaments available" with no explanation of when tournaments are created.

## Solution Summary

### 1. Why "No Tournaments Available"

**Root Cause:** No tournaments have been created yet because:
- ❌ Automated scheduler functions (`createWeeklyTournaments`, `createMonthlyTournaments`) haven't been deployed to Firebase
- ❌ No manual tournaments created

**When will tournaments appear:**
- Automatically every **Monday at 00:00 UTC** (weekly tournaments)
- Automatically on **1st of each month at 00:00 UTC** (monthly tournaments)

**Action needed:** Deploy Firebase Functions with `firebase deploy --only functions`

### 2. Update "No Tournaments" Message

Change from:
```typescript
<p className="font-arcade text-sm text-gray-500">
  Check back soon for upcoming tournaments!
</p>
```

To:
```typescript
<p className="font-arcade text-sm text-gray-500 mb-2">
  Tournaments are created automatically every Monday (weekly) and 1st of month (monthly)
</p>
<p className="font-arcade text-xs text-arcade-cyan">
  Check back soon for the next tournament!
</p>
```

### 3. Add Winner Display with Streak

**Add to Tournament interface:**
```typescript
interface Tournament {
  // ... existing fields
  winnerUsername?: string;
  winnerStreak?: number;  // Number of consecutive wins
}
```

**Add state for past winners:**
```typescript
const [pastWinners, setPastWinners] = useState<Tournament[]>([]);
```

**Separate tournaments into active and ended:**
```typescript
// In fetchTournaments useEffect, after formatting tournaments:
const active = formattedTournaments.filter(t => t.status !== 'ended');
const ended = formattedTournaments.filter(
  t => t.status === 'ended' &&
  t.winner &&
  t.winner !== '0x0000000000000000000000000000000000000000'
);

setTournaments(active);
setPastWinners(ended.slice(0, 10)); // Last 10 winners
```

**Add streak icon helper:**
```typescript
const getStreakIcon = (streak: number) => {
  if (streak >= 3) return '🔥🔥🔥';
  if (streak >= 2) return '🔥🔥';
  if (streak >= 1) return '🔥';
  return '';
};
```

### 4. Past Winners Section (Add after tournament list, before Info Cards)

```tsx
{/* Past Winners Section */}
{pastWinners.length > 0 && (
  <div className="mt-12">
    <h2 className="font-pixel text-xl text-arcade-yellow glow-yellow mb-6 text-center">
      RECENT WINNERS 🏆
    </h2>
    <div className="grid md:grid-cols-2 gap-4">
      {pastWinners.map((winner) => (
        <Card
          key={winner.id}
          className="bg-gradient-to-r from-arcade-yellow/5 to-arcade-pink/5 border-arcade-yellow/30"
        >
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">🏆</span>
                <div>
                  <p className="font-pixel text-sm text-arcade-yellow">
                    {winner.winnerUsername ||
                      `${winner.winner.slice(0, 6)}...${winner.winner.slice(-4)}`}
                    {winner.winnerStreak && winner.winnerStreak > 0 && (
                      <span className="ml-2">{getStreakIcon(winner.winnerStreak)}</span>
                    )}
                  </p>
                  <p className="font-arcade text-xs text-gray-400">
                    {winner.tier} {winner.period}
                  </p>
                </div>
              </div>
              {winner.winnerStreak && winner.winnerStreak > 0 && (
                <p className="font-arcade text-xs text-arcade-pink">
                  {winner.winnerStreak} win streak!
                </p>
              )}
            </div>
            <div className="text-right">
              <p className="font-arcade text-xs text-gray-500">Prize</p>
              <p className="font-pixel text-arcade-green">
                {formatNumber(Number(formatEther(winner.prizePool)))} 8BIT
              </p>
              <p className="font-arcade text-xs text-gray-400">
                ${(Number(formatEther(winner.prizePool)) * 0.0005).toFixed(2)}
              </p>
            </div>
          </div>
        </Card>
      ))}
    </div>
  </div>
)}
```

### 5. Backend Support for Streaks

When finalizing tournaments, the backend should:
1. Check if winner also won previous tournament of same type
2. Increment `winnerStreak` counter
3. Store in tournament document:
   ```typescript
   {
     winnerId: string;
     winnerUsername: string;
     winnerStreak: number;  // 1 for first win, 2+ for streak
   }
   ```

### 6. Testing

**To test before automated tournements:**
1. Manually create a test tournament via Firebase Functions
2. Add winner data to Firestore:
   ```javascript
   await db.collection('tournaments').doc(tournamentId).update({
     winnerId: '0xPlayerAddress',
     winnerUsername: 'PlayerName',
     winnerStreak: 2,
     status: 'ended'
   });
   ```
3. Reload tournament page - should show in "RECENT WINNERS"

### 7. Deployment Checklist

- [ ] Update `frontend/src/app/tournaments/page.tsx` with changes above
- [ ] Deploy Firebase Functions: `firebase deploy --only functions`
- [ ] Verify scheduled functions are configured:
  ```bash
  firebase functions:config:get
  ```
- [ ] Test tournament creation manually if needed
- [ ] Monitor Firebase logs for automated creation

---

## Summary

**Current State:** ❌ No tournaments (schedulers not deployed)
**Fix:** ✅ Deploy Firebase Functions + Update frontend to show winners with streaks
**When Tournaments Appear:** Every Monday (weekly) & 1st of month (monthly) at 00:00 UTC
**Winner Display:** Shows last 10 winners with username, prize, and fire icons for streaks
