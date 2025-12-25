/**
 * Anti-Cheat System Test
 *
 * Tests various cheating scenarios to verify the anti-cheat system:
 * 1. Legitimate score - should pass
 * 2. Impossible score - should be rejected
 * 3. Inhuman reaction times - should be flagged
 * 4. Score mismatch (replay validation) - should be rejected
 */

import * as admin from 'firebase-admin';
import { GameInput } from '../types';
import { analyzeGameplay, generateChecksum } from '../anticheat/statisticalAnalysis';
import { replayAlienAssault } from '../anticheat/replay/alienAssaultReplay';
import { replaySpaceRocks } from '../anticheat/replay/spaceRocksReplay';

// Initialize Firebase Admin (if not already initialized)
if (!admin.apps.length) {
  admin.initializeApp();
}

interface TestCase {
  name: string;
  gameId: string;
  score: number;
  inputs: GameInput[];
  seed: number;
  expectedResult: 'pass' | 'fail';
  expectedReason?: string;
}

/**
 * Generate legitimate inputs for Alien Assault
 */
function generateLegitimateInputs(): GameInput[] {
  const inputs: GameInput[] = [];
  let time = 0;

  // Simulate realistic gameplay - 30 seconds
  for (let i = 0; i < 50; i++) {
    time += 200 + Math.random() * 300; // 200-500ms between inputs

    // Alternate between movement and shooting
    if (i % 2 === 0) {
      inputs.push({
        t: time,
        type: 'direction',
        data: { left: Math.random() > 0.5, right: Math.random() > 0.5 },
      });
    } else {
      inputs.push({
        t: time,
        type: 'action',
        data: { action: true },
      });
    }
  }

  return inputs;
}

/**
 * Generate inputs with inhuman reaction times
 */
function generateInhumanInputs(): GameInput[] {
  const inputs: GameInput[] = [];
  let time = 0;

  // Super fast inputs - bot-like
  for (let i = 0; i < 100; i++) {
    time += 50; // 50ms between inputs - inhuman

    inputs.push({
      t: time,
      type: 'action',
      data: { action: true },
    });
  }

  return inputs;
}

/**
 * Generate fast but legitimate Space Rocks inputs (button mashing)
 * This tests the updated reaction time thresholds
 */
function generateFastSpaceRocksInputs(): GameInput[] {
  const inputs: GameInput[] = [];
  let time = 0;

  // Simulate 60 seconds of fast but legitimate gameplay
  // Mix of shooting and movement with realistic variance
  for (let i = 0; i < 300; i++) {
    // 80% shooting (rapid fire), 20% movement
    if (Math.random() < 0.8) {
      inputs.push({
        t: time,
        type: 'action',
        data: { action: true },
      });
    } else {
      inputs.push({
        t: time,
        type: 'direction',
        data: {
          up: Math.random() > 0.5,
          down: Math.random() > 0.5,
          left: Math.random() > 0.5,
          right: Math.random() > 0.5,
        },
      });
    }

    // Fast button mashing: 150-300ms with natural human variance
    // This is realistic for action games like Space Rocks
    time += 150 + Math.random() * 150;
  }

  return inputs;
}

/**
 * Generate bot-like Space Rocks inputs
 * Should be detected by anti-cheat
 */
function generateBotSpaceRocksInputs(): GameInput[] {
  const inputs: GameInput[] = [];
  let time = 0;

  // Bot with very consistent timing (no human variance)
  for (let i = 0; i < 500; i++) {
    inputs.push({
      t: time,
      type: 'action',
      data: { action: true },
    });

    // Too consistent and fast (50-60ms)
    time += 50 + Math.random() * 10;
  }

  return inputs;
}

/**
 * Test cases
 */
const testCases: TestCase[] = [
  {
    name: 'Legitimate Score',
    gameId: 'alien-assault',
    score: 450,
    inputs: generateLegitimateInputs(),
    seed: 12345,
    expectedResult: 'pass',
  },
  {
    name: 'Impossible Score (exceeds max theoretical)',
    gameId: 'alien-assault',
    score: 99999999, // Way over max theoretical (50000)
    inputs: generateLegitimateInputs(),
    seed: 12345,
    expectedResult: 'fail',
    expectedReason: 'impossible_score',
  },
  {
    name: 'Inhuman Reaction Times',
    gameId: 'alien-assault',
    score: 300,
    inputs: generateInhumanInputs(),
    seed: 12345,
    expectedResult: 'fail',
    expectedReason: 'impossible_reaction_time',
  },
  {
    name: 'Score Mismatch (claimed vs server-calculated)',
    gameId: 'alien-assault',
    score: 5000, // Claiming high score
    inputs: generateLegitimateInputs().slice(0, 10), // But only 10 inputs (won't achieve this score)
    seed: 12345,
    expectedResult: 'fail',
    expectedReason: 'score_mismatch',
  },
  {
    name: 'Space Rocks - Fast Legitimate Gameplay (Button Mashing)',
    gameId: 'space-rocks',
    score: 12000, // Realistic score for 60 seconds
    inputs: generateFastSpaceRocksInputs(),
    seed: 67890,
    expectedResult: 'pass', // Should NOT be flagged despite fast inputs
  },
  {
    name: 'Space Rocks - Bot Detection (Consistent Timing)',
    gameId: 'space-rocks',
    score: 20000, // High score
    inputs: generateBotSpaceRocksInputs(),
    seed: 67890,
    expectedResult: 'fail', // Should be flagged as bot
    expectedReason: 'inhuman_consistent_speed',
  },
];

/**
 * Run a single test case
 */
async function runTest(testCase: TestCase): Promise<void> {
  console.log(`\n[TEST] ${testCase.name}`);
  console.log(`  Game: ${testCase.gameId}`);
  console.log(`  Claimed Score: ${testCase.score}`);
  console.log(`  Inputs: ${testCase.inputs.length}`);

  try {
    // Step 1: Verify checksum
    const checksum = generateChecksum(testCase.inputs, testCase.seed);
    console.log(`  Checksum: ${checksum.substring(0, 16)}...`);

    // Step 2: Statistical Analysis
    const duration = testCase.inputs.length > 0 ? testCase.inputs[testCase.inputs.length - 1].t : 0;
    const analysis = analyzeGameplay(
      testCase.gameId,
      testCase.inputs,
      testCase.score,
      duration
    );

    console.log(`  Statistical Analysis:`);
    console.log(`    Flags: ${analysis.flags.length > 0 ? analysis.flags.join(', ') : 'none'}`);
    console.log(`    Confidence: ${(analysis.confidence * 100).toFixed(1)}%`);
    console.log(`    Valid: ${analysis.valid}`);

    // Step 3: Server-Side Replay (for games with replay support)
    if (testCase.gameId === 'alien-assault' || testCase.gameId === 'space-rocks') {
      const replayResult = testCase.gameId === 'alien-assault'
        ? await replayAlienAssault(testCase.seed, testCase.inputs)
        : await replaySpaceRocks(testCase.seed, testCase.inputs);

      const ratio = testCase.score / Math.max(1, replayResult.score);
      const scoreTooHigh = ratio > 20.0;

      console.log(`  Server Replay:`);
      console.log(`    Server Score: ${replayResult.score}`);
      console.log(`    Claimed Score: ${testCase.score}`);
      console.log(`    Ratio: ${ratio.toFixed(2)}x`);
      console.log(`    Max Allowed Ratio: 20.0x (soft validation)`);
      console.log(`    Within Bounds: ${!scoreTooHigh ? 'YES' : 'NO'}`);

      // Determine if test should pass or fail
      const highSeverityFlags = analysis.flags.filter(
        f => f === 'impossible_score' || f === 'impossible_reaction_time' ||
            f === 'inhuman_consistent_speed' || f === 'inhuman_median_reaction'
      );

      const wouldReject =
        (highSeverityFlags.length > 0 || analysis.confidence > 0.7) ||
        scoreTooHigh;

      const actualResult = wouldReject ? 'fail' : 'pass';
      const testPassed = actualResult === testCase.expectedResult;

      console.log(`\n  Expected: ${testCase.expectedResult.toUpperCase()}`);
      console.log(`  Actual: ${actualResult.toUpperCase()}`);
      console.log(`  Test Result: ${testPassed ? '✅ PASS' : '❌ FAIL'}`);

      if (!testPassed) {
        console.error(`  ERROR: Expected ${testCase.expectedResult} but got ${actualResult}`);
      }

      if (wouldReject && testCase.expectedReason) {
        const hasExpectedFlag = analysis.flags.includes(testCase.expectedReason as any) ||
                                (testCase.expectedReason === 'score_mismatch' && scoreTooHigh);

        if (!hasExpectedFlag) {
          console.warn(`  WARNING: Expected reason '${testCase.expectedReason}' not found`);
        }
      }

    } else {
      // For non-replay games, just check statistical analysis
      const highSeverityFlags = analysis.flags.filter(
        f => f === 'impossible_score' || f === 'impossible_reaction_time'
      );

      const wouldReject = highSeverityFlags.length > 0 || analysis.confidence > 0.7;
      const actualResult = wouldReject ? 'fail' : 'pass';
      const testPassed = actualResult === testCase.expectedResult;

      console.log(`\n  Expected: ${testCase.expectedResult.toUpperCase()}`);
      console.log(`  Actual: ${actualResult.toUpperCase()}`);
      console.log(`  Test Result: ${testPassed ? '✅ PASS' : '❌ FAIL'}`);
    }

  } catch (error) {
    console.error(`  ❌ ERROR:`, error);
  }
}

/**
 * Run all tests
 */
async function runAllTests(): Promise<void> {
  console.log('='.repeat(60));
  console.log('ANTI-CHEAT SYSTEM TEST SUITE');
  console.log('='.repeat(60));

  for (const testCase of testCases) {
    await runTest(testCase);
  }

  console.log('\n' + '='.repeat(60));
  console.log('TEST SUITE COMPLETE');
  console.log('='.repeat(60));
}

// Run tests if called directly
if (require.main === module) {
  runAllTests()
    .then(() => {
      console.log('\nAll tests completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Test suite failed:', error);
      process.exit(1);
    });
}

export { runAllTests, runTest };
