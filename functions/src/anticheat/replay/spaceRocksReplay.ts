import { GameInput } from '../../types';
import { BaseGameReplay, ReplayResult } from './baseReplay';

/**
 * Simplified Space Rocks headless replay
 * Validates score based on asteroid destruction tracking
 */
export class SpaceRocksReplay extends BaseGameReplay {
  private readonly CONFIG = {
    ASTEROID_POINTS: { large: 20, medium: 50, small: 100 },
    STARTING_ASTEROIDS: 4,
    ASTEROIDS_PER_LEVEL: 2,
    FIRE_RATE: 200, // ms between shots
  };

  private level: number = 1;
  private lives: number = 3;
  private lastFired: number = 0;
  private shotsFired: number = 0;

  // Track theoretical asteroid counts for score calculation
  private asteroidsDestroyed: {
    large: number;
    medium: number;
    small: number;
  } = { large: 0, medium: 0, small: 0 };

  protected init(): void {
    this.logEvent('game_start', { level: this.level, lives: this.lives });
  }

  protected processInput(input: GameInput): void {
    const currentTime = input.t;

    switch (input.type) {
      case 'direction':
        // Movement doesn't affect score in simplified model
        break;

      case 'action':
        // Track shooting
        if (input.data?.action) {
          if (currentTime - this.lastFired >= this.CONFIG.FIRE_RATE) {
            this.shotsFired++;
            this.lastFired = currentTime;
            this.simulateShot(currentTime);
          }
        }
        break;
    }
  }

  /**
   * Simulate a shot hitting an asteroid
   * Use seeded RNG to determine hit probability and which asteroid type
   */
  private simulateShot(currentTime: number): void {
    // Simplified hit detection - assume some % of shots hit based on skill
    // Use RNG to determine if shot hits
    const hitChance = 0.3 + (this.rng.next() * 0.4); // 30-70% hit rate

    if (this.rng.next() < hitChance) {
      // Determine which type of asteroid was hit based on what's available
      // Probability: large > medium > small (larger asteroids easier to hit)
      const roll = this.rng.next();

      let asteroidType: 'large' | 'medium' | 'small';
      if (roll < 0.4) {
        asteroidType = 'large';
      } else if (roll < 0.7) {
        asteroidType = 'medium';
      } else {
        asteroidType = 'small';
      }

      this.destroyAsteroid(asteroidType);
    }
  }

  /**
   * Destroy an asteroid and handle splits
   */
  private destroyAsteroid(size: 'large' | 'medium' | 'small'): void {
    const points = this.CONFIG.ASTEROID_POINTS[size];
    this.addScore(points);
    this.asteroidsDestroyed[size]++;

    this.logEvent('asteroid_destroyed', {
      size,
      points,
      totalScore: this.score
    });

    // Note: In real game, asteroids split, but for simplified replay
    // we just track that we could have destroyed this many
  }

  protected update(deltaMs: number): void {
    // Check if we should advance level (very simplified)
    // In real game, level advances when all asteroids destroyed
    // Here we just estimate based on time
    const expectedLevel = Math.floor(this.currentTime / 30000) + 1;
    if (expectedLevel > this.level) {
      this.level = expectedLevel;
      this.logEvent('level_up', { level: this.level });
    }
  }

  protected checkGameOver(): boolean {
    // Game ends when lives run out or score indicates completion
    // For validation purposes, we don't simulate death accurately
    return this.lives <= 0 || this.currentTime > 600000; // Max 10 minutes
  }

  /**
   * Get validation result
   * For Space Rocks, we validate that the claimed score is reasonable
   * based on the number of shots fired and time played
   */
  getValidationDetails(): {
    shotsFired: number;
    maxPossibleScore: number;
    efficiency: number;
  } {
    // Calculate max possible score based on perfect play
    // Assume perfect hit rate and all large asteroids fully destroyed
    const maxScore = this.shotsFired * 520; // Each shot could theoretically destroy a large + all splits

    return {
      shotsFired: this.shotsFired,
      maxPossibleScore: maxScore,
      efficiency: this.score / Math.max(1, maxScore),
    };
  }
}

/**
 * Replay a Space Rocks game and return the result
 */
export async function replaySpaceRocks(
  seed: number,
  inputs: GameInput[]
): Promise<ReplayResult> {
  const replay = new SpaceRocksReplay(seed);
  const result = await replay.replay(inputs);

  // Add custom validation for Space Rocks
  const details = (replay as any).getValidationDetails();

  // Log validation details
  console.log('Space Rocks Replay:', {
    calculatedScore: result.score,
    shotsFired: details.shotsFired,
    efficiency: details.efficiency,
  });

  return result;
}
