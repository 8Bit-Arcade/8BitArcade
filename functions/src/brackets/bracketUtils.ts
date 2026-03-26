import { BracketMatch, BracketRound, BracketSize, PrizeStructure } from '../pvp/pvpTypes';
import * as admin from 'firebase-admin';

/**
 * Returns the smallest valid bracket size >= playerCount.
 * Valid sizes: 4, 8, 16, 32, 64, 128
 */
export function nextBracketSize(playerCount: number): BracketSize {
  const SIZES: BracketSize[] = [4, 8, 16, 32, 64, 128];
  return SIZES.find(s => s >= playerCount) ?? 128;
}

/**
 * Round names based on total remaining players.
 */
export function getRoundName(playersInRound: number): string {
  const names: Record<number, string> = {
    128: 'Round of 128',
    64:  'Round of 64',
    32:  'Round of 32',
    16:  'Round of 16',
    8:   'Quarterfinals',
    4:   'Semifinals',
    2:   'Final',
  };
  return names[playersInRound] ?? `Round of ${playersInRound}`;
}

/**
 * Generate the initial single-elimination bracket from a seeded list of addresses.
 * Players beyond the filled seats become BYEs.
 * Seeds should already be randomized or ranked.
 */
export function generateSingleEliminationBracket(
  participants: string[],
  bracketSize: BracketSize,
  prizePool: number,
  prizeStructure: PrizeStructure
): BracketRound[] {
  const now = admin.firestore.Timestamp.now();
  const rounds: BracketRound[] = [];

  // Pad participants with BYEs to fill bracket
  const seeded: (string | 'BYE')[] = [...participants];
  while (seeded.length < bracketSize) seeded.push('BYE');

  // Seed positions for even bracket distribution (1 vs last, 2 vs second-to-last, etc.)
  const positioned = seededPositions(seeded, bracketSize);

  let numRounds = Math.log2(bracketSize);

  // Round 1 matches
  const r1Matches: BracketMatch[] = [];
  for (let i = 0; i < bracketSize / 2; i++) {
    const p1 = positioned[i * 2];
    const p2 = positioned[i * 2 + 1];
    const isBye = p1 === 'BYE' || p2 === 'BYE';
    const winner = p1 === 'BYE' ? (p2 === 'BYE' ? null : p2 as string) :
                   p2 === 'BYE' ? p1 as string : null;

    r1Matches.push({
      matchIndex: i,
      player1: p1 === 'BYE' ? 'BYE' : p1 as string,
      player2: p2 === 'BYE' ? 'BYE' : p2 as string,
      player1Score: null,
      player2Score: null,
      player1Finished: false,
      player2Finished: false,
      winner: isBye ? winner : null,
      loser: null,
      status: isBye ? 'bye' : 'pending',
      startedAt: isBye ? now : null,
      completedAt: isBye ? now : null,
      winnerPrize: 0,
      loserPrize: 0,
      isBye,
    });
  }

  rounds.push({
    roundIndex: 0,
    name: getRoundName(bracketSize),
    matches: r1Matches,
    status: 'pending',
    bracket: 'winners',
  });

  // Subsequent rounds (empty, to be filled as matches complete)
  let matchesInRound = bracketSize / 4;
  for (let r = 1; r < numRounds; r++) {
    const isLast = r === numRounds - 1;
    const playersInRound = matchesInRound * 2;
    const matches: BracketMatch[] = Array.from({ length: matchesInRound }, (_, i) => ({
      matchIndex: i,
      player1: null,
      player2: null,
      player1Score: null,
      player2Score: null,
      player1Finished: false,
      player2Finished: false,
      winner: null,
      loser: null,
      status: 'pending',
      startedAt: null,
      completedAt: null,
      winnerPrize: isLast ? computePrize(1, prizePool, prizeStructure) : 0,
      loserPrize: isLast ? computePrize(2, prizePool, prizeStructure) : 0,
      isBye: false,
    }));

    rounds.push({
      roundIndex: r,
      name: getRoundName(playersInRound),
      matches,
      status: 'pending',
      bracket: 'winners',
    });

    matchesInRound = Math.max(1, matchesInRound / 2);
  }

  return rounds;
}

/**
 * Returns prize amount in 8BIT for a given place.
 */
export function computePrize(place: number, prizePool: number, structure: PrizeStructure): number {
  const pct = structure[place] || 0;
  return Math.floor((prizePool * pct) / 100);
}

/**
 * Standard tournament seeding positions: top seed vs bottom seed.
 * [1, 2, 3, 4] → [1, 4, 2, 3] for proper bracket distribution.
 */
function seededPositions<T>(seeds: T[], size: number): T[] {
  if (size <= 2) return seeds;
  const half = size / 2;
  const top = seededPositions(seeds.slice(0, half), half);
  const bottom = seededPositions(seeds.slice(half), half).reverse();
  const result: T[] = new Array(size);
  for (let i = 0; i < half; i++) {
    result[i * 2]     = top[i];
    result[i * 2 + 1] = bottom[i];
  }
  return result;
}

/**
 * After a match completes, propagate the winner to the next round's slot.
 */
export function propagateWinner(
  rounds: BracketRound[],
  completedRoundIndex: number,
  completedMatchIndex: number,
  winner: string
): BracketRound[] {
  const updated = rounds.map(r => ({ ...r, matches: r.matches.map(m => ({ ...m })) }));
  const nextRoundIndex = completedRoundIndex + 1;

  if (nextRoundIndex >= updated.length) return updated; // Final round, no propagation needed

  const nextMatchIndex = Math.floor(completedMatchIndex / 2);
  const slot = completedMatchIndex % 2 === 0 ? 'player1' : 'player2';

  updated[nextRoundIndex].matches[nextMatchIndex][slot] = winner;

  // If both slots are now filled (and neither is BYE), mark as ready
  const nm = updated[nextRoundIndex].matches[nextMatchIndex];
  if (nm.player1 && nm.player2 && nm.player1 !== 'BYE' && nm.player2 !== 'BYE') {
    updated[nextRoundIndex].matches[nextMatchIndex].status = 'pending';
  } else if (nm.player1 === 'BYE' || nm.player2 === 'BYE') {
    // Auto-advance if the opponent is a BYE
    const autoWinner = nm.player1 === 'BYE' ? nm.player2 : nm.player1;
    if (autoWinner) {
      updated[nextRoundIndex].matches[nextMatchIndex].winner = autoWinner as string;
      updated[nextRoundIndex].matches[nextMatchIndex].status = 'bye';
      updated[nextRoundIndex].matches[nextMatchIndex].completedAt = admin.firestore.Timestamp.now();
      return propagateWinner(updated, nextRoundIndex, nextMatchIndex, autoWinner as string);
    }
  }

  return updated;
}

/**
 * Default prize structures.
 */
export const PRIZE_STRUCTURES = {
  standard: { 1: 60, 2: 25, 3: 10, 4: 5 } as PrizeStructure,
  top_heavy: { 1: 80, 2: 15, 3: 5 } as PrizeStructure,
  flat:      { 1: 40, 2: 30, 3: 20, 4: 10 } as PrizeStructure,
  winner_take_all: { 1: 100 } as PrizeStructure,
};
