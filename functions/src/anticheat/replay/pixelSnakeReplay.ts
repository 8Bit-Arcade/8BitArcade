import { GameInput } from '../../types';
import { BaseGameReplay, ReplayResult } from './baseReplay';

type Direction = 'up' | 'down' | 'left' | 'right';

interface SnakeSegment {
  x: number;
  y: number;
}

/**
 * Simplified Pixel Snake headless replay
 * Validates score based on food collection
 */
export class PixelSnakeReplay extends BaseGameReplay {
  private readonly CONFIG = {
    GRID_SIZE: 20,
    INITIAL_SPEED: 150,
    SPEED_INCREASE: 5,
    MIN_SPEED: 50,
    FOOD_POINTS: 10,
    BONUS_FOOD_POINTS: 50,
    BONUS_FOOD_CHANCE: 0.1,
    GRID_WIDTH: 30, // Estimated from 800px / 20 = 40, but conservative
    GRID_HEIGHT: 25, // Estimated from 600px / 20 = 30
  };

  private snake: SnakeSegment[] = [];
  private direction: Direction = 'right';
  private nextDirection: Direction = 'right';
  private food: { x: number; y: number; isBonus: boolean } | null = null;
  private moveDelay: number = this.CONFIG.INITIAL_SPEED;
  private moveTimer: number = 0;
  private foodEaten: number = 0;
  private bonusFoodEaten: number = 0;

  protected init(): void {
    // Initialize snake at center
    const startX = Math.floor(this.CONFIG.GRID_WIDTH / 2);
    const startY = Math.floor(this.CONFIG.GRID_HEIGHT / 2);

    this.snake = [
      { x: startX, y: startY },
      { x: startX - 1, y: startY },
      { x: startX - 2, y: startY },
    ];

    this.spawnFood();
    this.logEvent('game_start', { snakeLength: this.snake.length });
  }

  private spawnFood(): void {
    // Use RNG to place food randomly
    let x: number, y: number;
    let attempts = 0;

    do {
      x = Math.floor(this.rng.next() * this.CONFIG.GRID_WIDTH);
      y = Math.floor(this.rng.next() * this.CONFIG.GRID_HEIGHT);
      attempts++;
    } while (this.isSnakeAt(x, y) && attempts < 100);

    const isBonus = this.rng.next() < this.CONFIG.BONUS_FOOD_CHANCE;

    this.food = { x, y, isBonus };
    this.logEvent('food_spawned', { x, y, isBonus });
  }

  private isSnakeAt(x: number, y: number): boolean {
    return this.snake.some((seg) => seg.x === x && seg.y === y);
  }

  protected processInput(input: GameInput): void {
    if (input.type !== 'direction' || !input.data) return;

    // Determine direction from input
    const { up, down, left, right } = input.data;

    if (up && this.direction !== 'down') {
      this.nextDirection = 'up';
    } else if (down && this.direction !== 'up') {
      this.nextDirection = 'down';
    } else if (left && this.direction !== 'right') {
      this.nextDirection = 'left';
    } else if (right && this.direction !== 'left') {
      this.nextDirection = 'right';
    }
  }

  protected update(deltaMs: number): void {
    this.moveTimer += deltaMs;

    // Move snake at intervals
    if (this.moveTimer >= this.moveDelay) {
      this.moveTimer -= this.moveDelay;
      this.moveSnake();
    }
  }

  private moveSnake(): void {
    if (this.gameOver) return;

    // Apply next direction
    this.direction = this.nextDirection;

    // Calculate new head position
    const head = this.snake[0];
    let newX = head.x;
    let newY = head.y;

    switch (this.direction) {
      case 'up':
        newY--;
        break;
      case 'down':
        newY++;
        break;
      case 'left':
        newX--;
        break;
      case 'right':
        newX++;
        break;
    }

    // Check wall collision
    if (
      newX < 0 ||
      newX >= this.CONFIG.GRID_WIDTH ||
      newY < 0 ||
      newY >= this.CONFIG.GRID_HEIGHT
    ) {
      this.gameOver = true;
      this.logEvent('wall_collision', { x: newX, y: newY });
      return;
    }

    // Check self collision
    if (this.isSnakeAt(newX, newY)) {
      this.gameOver = true;
      this.logEvent('self_collision', { x: newX, y: newY });
      return;
    }

    // Move snake
    this.snake.unshift({ x: newX, y: newY });

    // Check food collision
    if (this.food && newX === this.food.x && newY === this.food.y) {
      const points = this.food.isBonus
        ? this.CONFIG.BONUS_FOOD_POINTS
        : this.CONFIG.FOOD_POINTS;

      this.addScore(points);

      if (this.food.isBonus) {
        this.bonusFoodEaten++;
      } else {
        this.foodEaten++;
      }

      // Speed up
      this.moveDelay = Math.max(
        this.CONFIG.MIN_SPEED,
        this.moveDelay - this.CONFIG.SPEED_INCREASE
      );

      this.logEvent('food_eaten', {
        isBonus: this.food.isBonus,
        points,
        snakeLength: this.snake.length,
        totalScore: this.score,
      });

      // Spawn new food
      this.spawnFood();
    } else {
      // Remove tail if no food eaten
      this.snake.pop();
    }
  }

  protected checkGameOver(): boolean {
    // Game ends on collision or timeout
    return this.gameOver || this.currentTime > 600000; // Max 10 minutes
  }

  /**
   * Get validation details
   */
  getValidationDetails(): {
    foodEaten: number;
    bonusFoodEaten: number;
    snakeLength: number;
    maxPossibleScore: number;
  } {
    // Calculate max score based on food eaten
    const maxScore =
      this.foodEaten * this.CONFIG.FOOD_POINTS +
      this.bonusFoodEaten * this.CONFIG.BONUS_FOOD_POINTS;

    return {
      foodEaten: this.foodEaten,
      bonusFoodEaten: this.bonusFoodEaten,
      snakeLength: this.snake.length,
      maxPossibleScore: maxScore,
    };
  }
}

/**
 * Replay a Pixel Snake game and return the result
 */
export async function replayPixelSnake(
  seed: number,
  inputs: GameInput[]
): Promise<ReplayResult> {
  const replay = new PixelSnakeReplay(seed);
  const result = await replay.replay(inputs);

  // Add custom validation
  const details = (replay as any).getValidationDetails();

  console.log('Pixel Snake Replay:', {
    calculatedScore: result.score,
    foodEaten: details.foodEaten,
    bonusFoodEaten: details.bonusFoodEaten,
    snakeLength: details.snakeLength,
  });

  return result;
}
