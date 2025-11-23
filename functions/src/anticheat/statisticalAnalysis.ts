import { GameInput, ValidationResult } from '../types';
import { GAME_CONFIGS } from '../config/games';

/**
 * Performs statistical analysis on gameplay to detect cheating
 */
export function analyzeGameplay(
  gameId: string,
  inputs: GameInput[],
  score: number,
  duration: number
): ValidationResult {
  const flags: string[] = [];
  const config = GAME_CONFIGS[gameId];

  if (!config) {
    return { valid: false, calculatedScore: 0, flags: ['unknown_game'], confidence: 1 };
  }

  // Check 1: Impossible score
  if (score > config.maxTheoreticalScore) {
    flags.push('impossible_score');
  }

  // Check 2: Game too short
  if (duration < config.minGameDuration) {
    flags.push('game_too_short');
  }

  // Check 3: Score velocity (points per second)
  const scoreVelocity = score / (duration / 1000);
  if (scoreVelocity > config.pointsPerSecondLimit) {
    flags.push('abnormal_score_velocity');
  }

  // Check 4: Input frequency analysis
  if (inputs.length > 0) {
    const inputFrequency = (inputs.length / duration) * 1000; // inputs per second
    if (inputFrequency > config.maxInputsPerSecond) {
      flags.push('bot_like_input_frequency');
    }
  }

  // Check 5: Inhuman reaction times
  const reactionTimes = calculateReactionTimes(inputs);
  if (reactionTimes.length > 10) {
    const avgReaction = average(reactionTimes);
    const minReaction = Math.min(...reactionTimes);

    // Average reaction time less than 50ms is suspicious
    if (avgReaction < 50) {
      flags.push('inhuman_avg_reaction');
    }
    // Any reaction under 20ms is physically impossible
    if (minReaction < 20) {
      flags.push('impossible_reaction_time');
    }
  }

  // Check 6: Perfect play detection (no mistakes for high scores)
  // This is game-specific and would need more detailed analysis

  // Check 7: Input pattern analysis (detecting autoclickers/bots)
  const patternScore = detectRepeatingPatterns(inputs);
  if (patternScore > 0.8) {
    flags.push('repetitive_input_pattern');
  }

  // Calculate confidence (0-1, higher = more suspicious)
  const confidence = Math.min(flags.length / 5, 1);

  return {
    valid: flags.length === 0,
    calculatedScore: score, // Would be replaced by replay result
    flags,
    confidence,
  };
}

/**
 * Calculate time between consecutive inputs
 */
function calculateReactionTimes(inputs: GameInput[]): number[] {
  const times: number[] = [];
  for (let i = 1; i < inputs.length; i++) {
    const delta = inputs[i].t - inputs[i - 1].t;
    if (delta > 0 && delta < 1000) {
      // Only consider deltas under 1 second
      times.push(delta);
    }
  }
  return times;
}

/**
 * Calculate average of numbers
 */
function average(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

/**
 * Detect repeating patterns in inputs (bot detection)
 */
function detectRepeatingPatterns(inputs: GameInput[]): number {
  if (inputs.length < 20) return 0;

  // Look for repeating sequences of 5-10 inputs
  const sequences: string[] = [];

  for (let i = 0; i < inputs.length - 5; i++) {
    const seq = inputs
      .slice(i, i + 5)
      .map((inp) => `${inp.type}-${JSON.stringify(inp.data)}`)
      .join('|');
    sequences.push(seq);
  }

  // Count duplicates
  const counts: Record<string, number> = {};
  for (const seq of sequences) {
    counts[seq] = (counts[seq] || 0) + 1;
  }

  // Calculate repetition score
  const maxRepeats = Math.max(...Object.values(counts));
  const repetitionScore = maxRepeats / sequences.length;

  return repetitionScore;
}

/**
 * Generate a checksum for input data
 */
export function generateChecksum(inputs: GameInput[], seed: number): string {
  const crypto = require('crypto');
  const data = JSON.stringify({ inputs, seed });
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Verify checksum matches
 */
export function verifyChecksum(
  inputs: GameInput[],
  seed: number,
  providedChecksum: string
): boolean {
  const calculated = generateChecksum(inputs, seed);
  return calculated === providedChecksum;
}
