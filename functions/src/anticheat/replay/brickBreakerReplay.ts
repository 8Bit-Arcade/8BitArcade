import { GameInput } from '../../types';
import { BaseGameReplay, ReplayResult } from './baseReplay';

/**
 * Simplified Brick Breaker headless replay
 * Validates score based on brick destruction tracking
 */
export class BrickBreakerReplay extends BaseGameReplay {
  private readonly CONFIG = {
    BRICK_ROWS: 6,
    BRICK_COLS: 10,
    BRICK_POINTS: [100, 80, 60, 50, 40, 30], // Points per row (top to bottom)
    BALL_SPEED: 400,
    BALL_SPEED_INCREASE: 20,
  };

  private level: number = 1;
  private lives: number = 3;
  private bricksDestroyed: number = 0;
  private bricksByRow: number[] = [0, 0, 0, 0, 0, 0]; // Track bricks destroyed per row
  private ballLaunched: boolean = false;
  private ballActive: boolean = false;

  protected init(): void {
    this.logEvent('game_start', { level: this.level, lives: this.lives });
  }

  protected processInput(input: GameInput): void {
    switch (input.type) {
      case 'direction':
        // Paddle movement doesn't directly affect score
        break;

      case 'action':
        // Launch ball
        if (input.data?.action && !this.ballLaunched) {
          this.ballLaunched = true;
          this.ballActive = true;
          this.logEvent('ball_launched', { time: input.t });
        }
        break;
    }
  }

  protected update(deltaMs: number): void {
    if (!this.ballActive) return;

    // Simulate brick collisions using seeded RNG
    // In a real game, ball physics would determine hits
    // For replay validation, we estimate based on time and randomness

    // Roughly every 500ms, there's a chance to hit a brick
    if (this.rng.next() < 0.15) {
      // 15% chance per update to hit a brick
      this.hitBrick();
    }

    // Check if level should be complete
    const bricksPerLevel = this.CONFIG.BRICK_ROWS * this.CONFIG.BRICK_COLS;
    const bricksForCurrentLevel = (this.level - 1) * bricksPerLevel;

    if (this.bricksDestroyed >= bricksForCurrentLevel + bricksPerLevel) {
      this.nextLevel();
    }

    // Simulate ball loss (miss paddle)
    if (this.rng.next() < 0.01) {
      // 1% chance to lose ball per update
      this.ballActive = false;
      this.ballLaunched = false;
      this.lives--;

      if (this.lives <= 0) {
        this.gameOver = true;
        this.logEvent('game_over', { finalScore: this.score });
      }
    }
  }

  /**
   * Simulate hitting a brick
   */
  private hitBrick(): void {
    // Determine which row based on probability
    // Top rows are harder to reach (require more bounces)
    const roll = this.rng.next();
    let row: number;

    if (roll < 0.05) {
      row = 0; // Top row (100 pts) - hardest to reach
    } else if (roll < 0.15) {
      row = 1; // 80 pts
    } else if (roll < 0.30) {
      row = 2; // 60 pts
    } else if (roll < 0.50) {
      row = 3; // 50 pts
    } else if (roll < 0.75) {
      row = 4; // 40 pts
    } else {
      row = 5; // Bottom row (30 pts) - easiest to reach
    }

    const points = this.CONFIG.BRICK_POINTS[row];
    this.addScore(points);
    this.bricksDestroyed++;
    this.bricksByRow[row]++;

    this.logEvent('brick_destroyed', {
      row,
      points,
      totalDestroyed: this.bricksDestroyed,
      totalScore: this.score,
    });
  }

  private nextLevel(): void {
    this.level++;
    this.ballActive = false;
    this.ballLaunched = false;
    this.logEvent('level_complete', { level: this.level });
  }

  protected checkGameOver(): boolean {
    return this.gameOver || this.lives <= 0 || this.currentTime > 600000; // Max 10 minutes
  }

  /**
   * Get validation details
   */
  getValidationDetails(): {
    level: number;
    bricksDestroyed: number;
    maxPossibleScore: number;
    bricksByRow: number[];
  } {
    // Calculate max possible score for bricks destroyed
    // Each level has 60 bricks worth 3600 points total
    const maxScore = this.level * (this.CONFIG.BRICK_ROWS * this.CONFIG.BRICK_COLS * 60);

    return {
      level: this.level,
      bricksDestroyed: this.bricksDestroyed,
      maxPossibleScore: maxScore,
      bricksByRow: this.bricksByRow,
    };
  }
}

/**
 * Replay a Brick Breaker game and return the result
 */
export async function replayBrickBreaker(
  seed: number,
  inputs: GameInput[]
): Promise<ReplayResult> {
  const replay = new BrickBreakerReplay(seed);
  const result = await replay.replay(inputs);

  // Add custom validation
  const details = (replay as any).getValidationDetails();

  console.log('Brick Breaker Replay:', {
    calculatedScore: result.score,
    level: details.level,
    bricksDestroyed: details.bricksDestroyed,
  });

  return result;
}
