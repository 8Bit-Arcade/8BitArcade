import * as Phaser from 'phaser';
import { SeededRNG } from '../engine/SeededRNG';
import { RetroSounds } from '../engine/RetroSounds';

const CONFIG = {
  GRID_SIZE: 20,
  INITIAL_SPEED: 150,
  SPEED_INCREASE: 5,
  MIN_SPEED: 50,
  INITIAL_LENGTH: 3,
  FOOD_POINTS: 10,
  BONUS_FOOD_POINTS: 50,
  BONUS_FOOD_CHANCE: 0.1,
  BONUS_FOOD_DURATION: 5000,
};

type Direction = 'up' | 'down' | 'left' | 'right';

interface SnakeSegment {
  x: number;
  y: number;
}

export class PixelSnakeScene extends Phaser.Scene {
  private onScoreUpdate: (score: number) => void;
  private onGameOver: (finalScore: number) => void;
  private getDirection: () => { up: boolean; down: boolean; left: boolean; right: boolean };
  private getAction: () => boolean;

  private rng: SeededRNG;
  private score: number = 0;
  private gameOver: boolean = false;

  private snake: SnakeSegment[] = [];
  private direction: Direction = 'right';
  private nextDirection: Direction = 'right';
  private food: { x: number; y: number; isBonus: boolean } | null = null;

  private gridWidth: number = 0;
  private gridHeight: number = 0;
  private moveTimer: number = 0;
  private moveDelay: number = CONFIG.INITIAL_SPEED;

  private graphics!: Phaser.GameObjects.Graphics;

  private sounds: RetroSounds | null = null;
  private soundEnabled: boolean = true;

  constructor(
    onScoreUpdate: (score: number) => void,
    onGameOver: (finalScore: number) => void,
    getDirection: () => { up: boolean; down: boolean; left: boolean; right: boolean },
    getAction: () => boolean,
    seed: number,
    soundEnabled: boolean = true,
    soundVolume: number = 0.7
  ) {
    super({ key: 'PixelSnakeScene' });
    this.onScoreUpdate = onScoreUpdate;
    this.onGameOver = onGameOver;
    this.getDirection = getDirection;
    this.getAction = getAction;
    this.rng = new SeededRNG(seed);
    this.soundEnabled = soundEnabled;

    // Initialize sound system
    if (this.soundEnabled) {
      try {
        this.sounds = new RetroSounds(soundVolume);
        // Register sounds
        this.sounds.registerSound('eatFood', this.sounds.generateCoin());
        this.sounds.registerSound('eatBonus', this.sounds.generatePowerUp());
        this.sounds.registerSound('gameOver', this.sounds.generateHit());
      } catch (e) {
        console.warn('Failed to initialize audio:', e);
        this.sounds = null;
      }
    }
  }

  create(): void {
    const { width, height } = this.scale;
    this.gridWidth = Math.floor(width / CONFIG.GRID_SIZE);
    this.gridHeight = Math.floor(height / CONFIG.GRID_SIZE);

    // Setup cleanup handler
    this.events.on('shutdown', this.onShutdown, this);

    this.graphics = this.add.graphics();

    // Initialize snake in center
    const startX = Math.floor(this.gridWidth / 2);
    const startY = Math.floor(this.gridHeight / 2);

    for (let i = 0; i < CONFIG.INITIAL_LENGTH; i++) {
      this.snake.push({ x: startX - i, y: startY });
    }

    // Spawn first food
    this.spawnFood();

    // Draw initial state
    this.draw();
  }

  spawnFood(): void {
    let x: number, y: number;
    let attempts = 0;

    // Find empty spot
    do {
      x = this.rng.nextInt(1, this.gridWidth - 2);
      y = this.rng.nextInt(1, this.gridHeight - 2);
      attempts++;
    } while (this.isSnakeAt(x, y) && attempts < 100);

    const isBonus = this.rng.nextBool(CONFIG.BONUS_FOOD_CHANCE);
    this.food = { x, y, isBonus };

    // Bonus food disappears after duration
    if (isBonus) {
      this.time.delayedCall(CONFIG.BONUS_FOOD_DURATION, () => {
        if (this.food?.isBonus) {
          this.spawnFood();
        }
      });
    }
  }

  isSnakeAt(x: number, y: number): boolean {
    return this.snake.some((seg) => seg.x === x && seg.y === y);
  }

  move(): void {
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
    if (newX < 0 || newX >= this.gridWidth || newY < 0 || newY >= this.gridHeight) {
      this.endGame();
      return;
    }

    // Check self collision
    if (this.isSnakeAt(newX, newY)) {
      this.endGame();
      return;
    }

    // Move snake
    this.snake.unshift({ x: newX, y: newY });

    // Check food collision
    if (this.food && newX === this.food.x && newY === this.food.y) {
      const points = this.food.isBonus ? CONFIG.BONUS_FOOD_POINTS : CONFIG.FOOD_POINTS;
      this.score += points;
      this.onScoreUpdate(this.score);

      // Play eat sound
      if (this.sounds && this.soundEnabled) {
        this.sounds.play(this.food.isBonus ? 'eatBonus' : 'eatFood');
      }

      // Speed up
      this.moveDelay = Math.max(CONFIG.MIN_SPEED, this.moveDelay - CONFIG.SPEED_INCREASE);

      // Spawn new food
      this.spawnFood();
    } else {
      // Remove tail if no food eaten
      this.snake.pop();
    }

    this.draw();
  }

  draw(): void {
    this.graphics.clear();

    // Draw border
    this.graphics.lineStyle(2, 0x00ff41, 0.5);
    this.graphics.strokeRect(
      0,
      0,
      this.gridWidth * CONFIG.GRID_SIZE,
      this.gridHeight * CONFIG.GRID_SIZE
    );

    // Draw grid (subtle)
    this.graphics.lineStyle(1, 0x00ff41, 0.1);
    for (let x = 0; x <= this.gridWidth; x++) {
      this.graphics.lineBetween(
        x * CONFIG.GRID_SIZE,
        0,
        x * CONFIG.GRID_SIZE,
        this.gridHeight * CONFIG.GRID_SIZE
      );
    }
    for (let y = 0; y <= this.gridHeight; y++) {
      this.graphics.lineBetween(
        0,
        y * CONFIG.GRID_SIZE,
        this.gridWidth * CONFIG.GRID_SIZE,
        y * CONFIG.GRID_SIZE
      );
    }

    // Draw snake
    this.snake.forEach((seg, i) => {
      const isHead = i === 0;
      const color = isHead ? 0x00ff41 : 0x00cc33;

      this.graphics.fillStyle(color);
      this.graphics.fillRect(
        seg.x * CONFIG.GRID_SIZE + 1,
        seg.y * CONFIG.GRID_SIZE + 1,
        CONFIG.GRID_SIZE - 2,
        CONFIG.GRID_SIZE - 2
      );

      // Head eyes
      if (isHead) {
        this.graphics.fillStyle(0x000000);
        let eyeX1 = 0, eyeY1 = 0, eyeX2 = 0, eyeY2 = 0;

        switch (this.direction) {
          case 'right':
            eyeX1 = 12; eyeY1 = 5; eyeX2 = 12; eyeY2 = 12;
            break;
          case 'left':
            eyeX1 = 5; eyeY1 = 5; eyeX2 = 5; eyeY2 = 12;
            break;
          case 'up':
            eyeX1 = 5; eyeY1 = 5; eyeX2 = 12; eyeY2 = 5;
            break;
          case 'down':
            eyeX1 = 5; eyeY1 = 12; eyeX2 = 12; eyeY2 = 12;
            break;
        }

        this.graphics.fillCircle(
          seg.x * CONFIG.GRID_SIZE + eyeX1,
          seg.y * CONFIG.GRID_SIZE + eyeY1,
          2
        );
        this.graphics.fillCircle(
          seg.x * CONFIG.GRID_SIZE + eyeX2,
          seg.y * CONFIG.GRID_SIZE + eyeY2,
          2
        );
      }
    });

    // Draw food
    if (this.food) {
      const color = this.food.isBonus ? 0xffff00 : 0xff0040;
      this.graphics.fillStyle(color);
      this.graphics.fillCircle(
        this.food.x * CONFIG.GRID_SIZE + CONFIG.GRID_SIZE / 2,
        this.food.y * CONFIG.GRID_SIZE + CONFIG.GRID_SIZE / 2,
        CONFIG.GRID_SIZE / 2 - 2
      );

      // Bonus food glow
      if (this.food.isBonus) {
        this.graphics.lineStyle(2, 0xffff00, 0.5);
        this.graphics.strokeCircle(
          this.food.x * CONFIG.GRID_SIZE + CONFIG.GRID_SIZE / 2,
          this.food.y * CONFIG.GRID_SIZE + CONFIG.GRID_SIZE / 2,
          CONFIG.GRID_SIZE / 2 + 2
        );
      }
    }
  }

  endGame(): void {
    this.gameOver = true;

    // Play game over sound
    if (this.sounds && this.soundEnabled) {
      this.sounds.play('gameOver');
    }

    // Flash snake red
    this.graphics.clear();
    this.snake.forEach((seg) => {
      this.graphics.fillStyle(0xff0040);
      this.graphics.fillRect(
        seg.x * CONFIG.GRID_SIZE + 1,
        seg.y * CONFIG.GRID_SIZE + 1,
        CONFIG.GRID_SIZE - 2,
        CONFIG.GRID_SIZE - 2
      );
    });

    // Show game over text
    const { width, height } = this.scale;
    this.add
      .text(width / 2, height / 2, 'GAME OVER', {
        fontFamily: '"Press Start 2P"',
        fontSize: '32px',
        color: '#ff0040',
      })
      .setOrigin(0.5);

    this.time.delayedCall(2000, () => {
      this.onGameOver(this.score);
    });
  }

  onShutdown(): void {
    if (this.sounds) {
      this.sounds.destroy();
      this.sounds = null;
    }
  }

  update(time: number, delta: number): void {
    if (this.gameOver) return;

    const direction = this.getDirection();

    // Update direction (prevent 180 degree turns)
    if (direction.up && this.direction !== 'down') {
      this.nextDirection = 'up';
    } else if (direction.down && this.direction !== 'up') {
      this.nextDirection = 'down';
    } else if (direction.left && this.direction !== 'right') {
      this.nextDirection = 'left';
    } else if (direction.right && this.direction !== 'left') {
      this.nextDirection = 'right';
    }

    // Move on timer
    this.moveTimer += delta;
    if (this.moveTimer >= this.moveDelay) {
      this.moveTimer = 0;
      this.move();
    }
  }
}

export default PixelSnakeScene;
