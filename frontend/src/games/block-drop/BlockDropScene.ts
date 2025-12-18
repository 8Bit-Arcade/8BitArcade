import * as Phaser from 'phaser';
import { SeededRNG } from '../engine/SeededRNG';
import { RetroSounds } from '../engine/RetroSounds';

const CONFIG = {
  GRID_WIDTH: 10,
  GRID_HEIGHT: 20,
  CELL_SIZE: 26,  // Reduced from 30 to fit in viewport
  INITIAL_FALL_SPEED: 1000, // ms
  FAST_FALL_SPEED: 50,
  MIN_FALL_SPEED: 100,
  SPEED_DECREASE: 50, // Speed up every level
  LINES_PER_LEVEL: 10,
  POINTS_PER_LINE: [0, 100, 300, 500, 800], // 0, 1, 2, 3, 4 lines
};

const TETROMINOES = {
  I: [[1, 1, 1, 1]],
  O: [[1, 1], [1, 1]],
  T: [[0, 1, 0], [1, 1, 1]],
  S: [[0, 1, 1], [1, 1, 0]],
  Z: [[1, 1, 0], [0, 1, 1]],
  J: [[1, 0, 0], [1, 1, 1]],
  L: [[0, 0, 1], [1, 1, 1]],
};

const COLORS = {
  I: 0x00f5ff,
  O: 0xffff00,
  T: 0xff00ff,
  S: 0x00ff41,
  Z: 0xff0040,
  J: 0x0066ff,
  L: 0xff6600,
};

type TetrominoType = keyof typeof TETROMINOES;

export class BlockDropScene extends Phaser.Scene {
  private onScoreUpdate: (score: number) => void;
  private onGameOver: (finalScore: number) => void;
  private getDirection: () => { up: boolean; down: boolean; left: boolean; right: boolean };
  private getAction: () => boolean;

  private rng: SeededRNG;
  private score: number = 0;
  private lines: number = 0;
  private level: number = 1;
  private gameOver: boolean = false;

  private grid: (number | null)[][] = [];
  private currentPiece: { type: TetrominoType; shape: number[][]; x: number; y: number } | null = null;
  private nextPiece: TetrominoType | null = null;

  private fallTimer: number = 0;
  private fallSpeed: number = CONFIG.INITIAL_FALL_SPEED;
  private fastFalling: boolean = false;
  private canMove: boolean = true;
  private lastRotate: boolean = false;

  private graphics!: Phaser.GameObjects.Graphics;
  private scoreText!: Phaser.GameObjects.Text;
  private levelText!: Phaser.GameObjects.Text;
  private linesText!: Phaser.GameObjects.Text;

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
    super({ key: 'BlockDropScene' });
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
        this.sounds.registerSound('rotate', this.sounds.generateBeep(440, 0.05));
        this.sounds.registerSound('move', this.sounds.generateBeep(330, 0.04));
        this.sounds.registerSound('drop', this.sounds.generateHit());
        this.sounds.registerSound('lineClear', this.sounds.generateCoin());
        this.sounds.registerSound('tetris', this.sounds.generatePowerUp()); // 4 lines
        this.sounds.registerSound('levelUp', this.sounds.generatePowerUp());
        this.sounds.registerSound('gameOver', this.sounds.generateGameOver());
      } catch (e) {
        console.warn('Failed to initialize audio:', e);
        this.sounds = null;
      }
    }
  }

  create(): void {
    const { width, height } = this.scale;

    // Setup cleanup handler
    this.events.on('shutdown', this.onShutdown, this);

    // Initialize grid
    for (let y = 0; y < CONFIG.GRID_HEIGHT; y++) {
      this.grid[y] = [];
      for (let x = 0; x < CONFIG.GRID_WIDTH; x++) {
        this.grid[y][x] = null;
      }
    }

    // Graphics
    this.graphics = this.add.graphics();

    // UI
    const gridWidth = CONFIG.GRID_WIDTH * CONFIG.CELL_SIZE;
    const offsetX = (width - gridWidth) / 2;

    this.scoreText = this.add.text(offsetX, 20, `SCORE: ${this.score}`, {
      fontFamily: '"Press Start 2P"',
      fontSize: '14px',
      color: '#ffffff',
    });

    this.levelText = this.add.text(offsetX, 50, `LEVEL: ${this.level}`, {
      fontFamily: '"Press Start 2P"',
      fontSize: '14px',
      color: '#00f5ff',
    });

    this.linesText = this.add.text(offsetX, 80, `LINES: ${this.lines}`, {
      fontFamily: '"Press Start 2P"',
      fontSize: '14px',
      color: '#00ff41',
    });

    // Spawn first piece
    this.spawnPiece();
  }

  spawnPiece(): void {
    const types: TetrominoType[] = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];
    const type = this.nextPiece || types[Math.floor(this.rng.next() * types.length)];
    this.nextPiece = types[Math.floor(this.rng.next() * types.length)];

    const shape = JSON.parse(JSON.stringify(TETROMINOES[type]));

    this.currentPiece = {
      type,
      shape,
      x: Math.floor(CONFIG.GRID_WIDTH / 2) - Math.floor(shape[0].length / 2),
      y: 0,
    };

    // Check if game over (piece can't spawn)
    if (this.checkCollision(this.currentPiece.x, this.currentPiece.y, this.currentPiece.shape)) {
      this.endGame();
    }
  }

  update(time: number, delta: number): void {
    if (this.gameOver || !this.currentPiece) return;

    // Handle rotation
    const dir = this.getDirection();
    const action = this.getAction();

    if (action && !this.lastRotate) {
      this.rotatePiece();
      this.lastRotate = true;
    } else if (!action) {
      this.lastRotate = false;
    }

    // Handle movement
    if (this.canMove) {
      if (dir.left) {
        this.movePiece(-1, 0);
        this.canMove = false;
        this.time.delayedCall(100, () => { this.canMove = true; });
      } else if (dir.right) {
        this.movePiece(1, 0);
        this.canMove = false;
        this.time.delayedCall(100, () => { this.canMove = true; });
      }
    }

    // Fast fall
    this.fastFalling = dir.down;

    // Gravity
    const speed = this.fastFalling ? CONFIG.FAST_FALL_SPEED : this.fallSpeed;
    this.fallTimer += delta;

    if (this.fallTimer >= speed) {
      this.fallTimer = 0;

      if (!this.movePiece(0, 1)) {
        // Piece locked
        this.lockPiece();
        this.clearLines();
        this.spawnPiece();
      }
    }

    this.draw();
  }

  movePiece(dx: number, dy: number): boolean {
    if (!this.currentPiece) return false;

    const newX = this.currentPiece.x + dx;
    const newY = this.currentPiece.y + dy;

    if (this.checkCollision(newX, newY, this.currentPiece.shape)) {
      return false;
    }

    this.currentPiece.x = newX;
    this.currentPiece.y = newY;

    // Play move sound only for horizontal movement (dx)
    if (dx !== 0 && this.sounds && this.soundEnabled) {
      this.sounds.play('move');
    }

    return true;
  }

  rotatePiece(): void {
    if (!this.currentPiece || this.currentPiece.type === 'O') return;

    const rotated = this.rotate(this.currentPiece.shape);

    if (!this.checkCollision(this.currentPiece.x, this.currentPiece.y, rotated)) {
      this.currentPiece.shape = rotated;

      // Play rotate sound
      if (this.sounds && this.soundEnabled) {
        this.sounds.play('rotate');
      }
    }
  }

  rotate(shape: number[][]): number[][] {
    const rows = shape.length;
    const cols = shape[0].length;
    const rotated: number[][] = [];

    for (let x = 0; x < cols; x++) {
      rotated[x] = [];
      for (let y = rows - 1; y >= 0; y--) {
        rotated[x][rows - 1 - y] = shape[y][x];
      }
    }

    return rotated;
  }

  checkCollision(x: number, y: number, shape: number[][]): boolean {
    for (let row = 0; row < shape.length; row++) {
      for (let col = 0; col < shape[row].length; col++) {
        if (shape[row][col]) {
          const gridX = x + col;
          const gridY = y + row;

          if (
            gridX < 0 ||
            gridX >= CONFIG.GRID_WIDTH ||
            gridY >= CONFIG.GRID_HEIGHT ||
            (gridY >= 0 && this.grid[gridY][gridX] !== null)
          ) {
            return true;
          }
        }
      }
    }
    return false;
  }

  lockPiece(): void {
    if (!this.currentPiece) return;

    for (let row = 0; row < this.currentPiece.shape.length; row++) {
      for (let col = 0; col < this.currentPiece.shape[row].length; col++) {
        if (this.currentPiece.shape[row][col]) {
          const gridY = this.currentPiece.y + row;
          const gridX = this.currentPiece.x + col;

          if (gridY >= 0) {
            this.grid[gridY][gridX] = COLORS[this.currentPiece.type];
          }
        }
      }
    }

    // Play drop sound
    if (this.sounds && this.soundEnabled) {
      this.sounds.play('drop');
    }
  }

  clearLines(): void {
    let linesCleared = 0;

    for (let y = CONFIG.GRID_HEIGHT - 1; y >= 0; y--) {
      if (this.grid[y].every(cell => cell !== null)) {
        // Clear line
        this.grid.splice(y, 1);
        this.grid.unshift(Array(CONFIG.GRID_WIDTH).fill(null));
        linesCleared++;
        y++; // Check same row again
      }
    }

    if (linesCleared > 0) {
      this.lines += linesCleared;
      this.score += CONFIG.POINTS_PER_LINE[linesCleared] * this.level;
      this.onScoreUpdate(this.score);

      this.linesText.setText(`LINES: ${this.lines}`);
      this.scoreText.setText(`SCORE: ${this.score}`);

      // Play line clear sound (special tetris sound for 4 lines)
      if (this.sounds && this.soundEnabled) {
        if (linesCleared === 4) {
          this.sounds.play('tetris');
        } else {
          this.sounds.play('lineClear');
        }
      }

      // Level up
      const previousLevel = this.level;
      if (this.lines >= this.level * CONFIG.LINES_PER_LEVEL) {
        this.level++;
        this.levelText.setText(`LEVEL: ${this.level}`);
        this.fallSpeed = Math.max(
          CONFIG.MIN_FALL_SPEED,
          CONFIG.INITIAL_FALL_SPEED - (this.level - 1) * CONFIG.SPEED_DECREASE
        );

        // Play level up sound
        if (this.sounds && this.soundEnabled) {
          setTimeout(() => {
            if (this.sounds && this.soundEnabled) {
              this.sounds.play('levelUp');
            }
          }, 300);
        }
      }
    }
  }

  draw(): void {
    this.graphics.clear();

    const gridWidth = CONFIG.GRID_WIDTH * CONFIG.CELL_SIZE;
    const offsetX = (this.scale.width - gridWidth) / 2;
    const offsetY = 120;

    // Draw grid background
    this.graphics.fillStyle(0x0a0a0a);
    this.graphics.fillRect(
      offsetX,
      offsetY,
      CONFIG.GRID_WIDTH * CONFIG.CELL_SIZE,
      CONFIG.GRID_HEIGHT * CONFIG.CELL_SIZE
    );

    // Draw grid lines
    this.graphics.lineStyle(1, 0x333333);
    for (let x = 0; x <= CONFIG.GRID_WIDTH; x++) {
      this.graphics.strokeLineShape(
        new Phaser.Geom.Line(
          offsetX + x * CONFIG.CELL_SIZE,
          offsetY,
          offsetX + x * CONFIG.CELL_SIZE,
          offsetY + CONFIG.GRID_HEIGHT * CONFIG.CELL_SIZE
        )
      );
    }
    for (let y = 0; y <= CONFIG.GRID_HEIGHT; y++) {
      this.graphics.strokeLineShape(
        new Phaser.Geom.Line(
          offsetX,
          offsetY + y * CONFIG.CELL_SIZE,
          offsetX + CONFIG.GRID_WIDTH * CONFIG.CELL_SIZE,
          offsetY + y * CONFIG.CELL_SIZE
        )
      );
    }

    // Draw locked blocks
    for (let y = 0; y < CONFIG.GRID_HEIGHT; y++) {
      for (let x = 0; x < CONFIG.GRID_WIDTH; x++) {
        if (this.grid[y][x] !== null) {
          this.graphics.fillStyle(this.grid[y][x]!);
          this.graphics.fillRect(
            offsetX + x * CONFIG.CELL_SIZE + 2,
            offsetY + y * CONFIG.CELL_SIZE + 2,
            CONFIG.CELL_SIZE - 4,
            CONFIG.CELL_SIZE - 4
          );
        }
      }
    }

    // Draw current piece
    if (this.currentPiece) {
      this.graphics.fillStyle(COLORS[this.currentPiece.type]);
      for (let row = 0; row < this.currentPiece.shape.length; row++) {
        for (let col = 0; col < this.currentPiece.shape[row].length; col++) {
          if (this.currentPiece.shape[row][col]) {
            const x = this.currentPiece.x + col;
            const y = this.currentPiece.y + row;

            if (y >= 0) {
              this.graphics.fillRect(
                offsetX + x * CONFIG.CELL_SIZE + 2,
                offsetY + y * CONFIG.CELL_SIZE + 2,
                CONFIG.CELL_SIZE - 4,
                CONFIG.CELL_SIZE - 4
              );
            }
          }
        }
      }
    }

    // Draw border
    this.graphics.lineStyle(4, 0x00ff41);
    this.graphics.strokeRect(
      offsetX - 2,
      offsetY - 2,
      CONFIG.GRID_WIDTH * CONFIG.CELL_SIZE + 4,
      CONFIG.GRID_HEIGHT * CONFIG.CELL_SIZE + 4
    );
  }

  endGame(): void {
    this.gameOver = true;

    // Play game over sound
    if (this.sounds && this.soundEnabled) {
      this.sounds.play('gameOver');
    }

    this.add.text(this.scale.width / 2, this.scale.height / 2, 'GAME OVER', {
      fontFamily: '"Press Start 2P"',
      fontSize: '32px',
      color: '#ff0040',
    }).setOrigin(0.5);

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
}
