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

    // Step 3: Server-Side Replay (for alien-assault)
    if (testCase.gameId === 'alien-assault') {
      const replayResult = await replayAlienAssault(testCase.seed, testCase.inputs);
      const tolerance = Math.max(1, testCase.score * 0.01);
      const scoreDiff = Math.abs(replayResult.score - testCase.score);

      console.log(`  Server Replay:`);
      console.log(`    Server Score: ${replayResult.score}`);
      console.log(`    Claimed Score: ${testCase.score}`);
      console.log(`    Difference: ${scoreDiff} (tolerance: ${tolerance.toFixed(1)})`);
      console.log(`    Match: ${scoreDiff <= tolerance ? 'YES' : 'NO'}`);

      // Determine if test should pass or fail
      const highSeverityFlags = analysis.flags.filter(
        f => f === 'impossible_score' || f === 'impossible_reaction_time'
      );

      const wouldReject =
        (highSeverityFlags.length > 0 || analysis.confidence > 0.7) ||
        scoreDiff > tolerance;

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
                                (testCase.expectedReason === 'score_mismatch' && scoreDiff > tolerance);

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
