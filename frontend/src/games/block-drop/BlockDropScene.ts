import * as Phaser from 'phaser';
import { SeededRNG } from '../engine/SeededRNG';

const CONFIG = {
  TILE_SIZE: 40,
  GRID_WIDTH: 16,
  GRID_HEIGHT: 14,
  PLAYER_MOVE_DELAY: 150,
  BARREL_MOVE_DELAY: 200,
  BARREL_SPAWN_DELAY: 1500,
  LIVES: 3,
  POINTS_PER_BARREL: 50,
  POINTS_PER_LEVEL: 500,
  BARRELS_TO_DODGE_PER_LEVEL: 30,
};

interface Barrel {
  gridX: number;
  gridY: number;
  direction: 'down' | 'right' | 'left';
  graphics: Phaser.GameObjects.Graphics;
}

interface LanePattern {
  column?: number; // For vertical lanes (down)
  row?: number;    // For horizontal lanes (right/left)
  direction: 'down' | 'right' | 'left';
  spawnDelay: number;
}

// 5 distinct levels with different barrel patterns
const LEVELS = [
  // Level 1: Simple vertical lanes
  {
    name: 'FACTORY FLOOR',
    patterns: [
      { column: 3, direction: 'down' as const, spawnDelay: 2000 },
      { column: 7, direction: 'down' as const, spawnDelay: 2200 },
      { column: 11, direction: 'down' as const, spawnDelay: 2400 },
    ],
    backgroundColor: 0x1a1a2e,
    floorColor: 0x3d3d5c,
  },

  // Level 2: Alternating vertical lanes
  {
    name: 'WAREHOUSE',
    patterns: [
      { column: 2, direction: 'down' as const, spawnDelay: 1800 },
      { column: 5, direction: 'down' as const, spawnDelay: 2000 },
      { column: 8, direction: 'down' as const, spawnDelay: 1700 },
      { column: 11, direction: 'down' as const, spawnDelay: 1900 },
      { column: 14, direction: 'down' as const, spawnDelay: 2100 },
    ],
    backgroundColor: 0x2d2d44,
    floorColor: 0x4a4a6a,
  },

  // Level 3: Horizontal barrels from both sides
  {
    name: 'CONVEYOR BELTS',
    patterns: [
      { row: 3, direction: 'right' as const, spawnDelay: 2000 },
      { row: 6, direction: 'left' as const, spawnDelay: 2200 },
      { row: 9, direction: 'right' as const, spawnDelay: 1800 },
      { row: 12, direction: 'left' as const, spawnDelay: 2400 },
    ],
    backgroundColor: 0x1e1e3f,
    floorColor: 0x3b3b6b,
  },

  // Level 4: Mixed vertical and horizontal
  {
    name: 'CHAOS ZONE',
    patterns: [
      { column: 4, direction: 'down' as const, spawnDelay: 1600 },
      { column: 12, direction: 'down' as const, spawnDelay: 1700 },
      { row: 4, direction: 'right' as const, spawnDelay: 1900 },
      { row: 8, direction: 'left' as const, spawnDelay: 1800 },
      { row: 11, direction: 'right' as const, spawnDelay: 2000 },
    ],
    backgroundColor: 0x2a1a3f,
    floorColor: 0x4f3a6a,
  },

  // Level 5: Dense pattern - all directions
  {
    name: 'BARREL STORM',
    patterns: [
      { column: 2, direction: 'down' as const, spawnDelay: 1400 },
      { column: 6, direction: 'down' as const, spawnDelay: 1500 },
      { column: 10, direction: 'down' as const, spawnDelay: 1600 },
      { column: 14, direction: 'down' as const, spawnDelay: 1450 },
      { row: 3, direction: 'right' as const, spawnDelay: 1700 },
      { row: 6, direction: 'left' as const, spawnDelay: 1650 },
      { row: 9, direction: 'right' as const, spawnDelay: 1550 },
      { row: 11, direction: 'left' as const, spawnDelay: 1600 },
    ],
    backgroundColor: 0x1f0a2e,
    floorColor: 0x3f2a5c,
  },
];

export class BlockDropScene extends Phaser.Scene {
  private onScoreUpdate: (score: number) => void;
  private onGameOver: (finalScore: number) => void;
  private getDirection: () => { up: boolean; down: boolean; left: boolean; right: boolean };
  private getAction: () => boolean;

  private rng: SeededRNG;
  private score: number = 0;
  private lives: number = CONFIG.LIVES;
  private level: number = 1;
  private gameOver: boolean = false;
  private barrelsDodged: number = 0;

  private playerGridX: number = 8;
  private playerGridY: number = 12;
  private playerMoveTimer: number = 0;
  private player!: Phaser.GameObjects.Graphics;

  private barrels: Barrel[] = [];
  private barrelMoveTimer: number = 0;
  private spawnTimers: Map<number, number> = new Map();

  private background!: Phaser.GameObjects.Graphics;
  private livesText!: Phaser.GameObjects.Text;
  private dodgedText!: Phaser.GameObjects.Text;
  private levelText!: Phaser.GameObjects.Text;

  constructor(
    onScoreUpdate: (score: number) => void,
    onGameOver: (finalScore: number) => void,
    getDirection: () => { up: boolean; down: boolean; left: boolean; right: boolean },
    getAction: () => boolean,
    seed: number
  ) {
    super({ key: 'BlockDropScene' });
    this.onScoreUpdate = onScoreUpdate;
    this.onGameOver = onGameOver;
    this.getDirection = getDirection;
    this.getAction = getAction;
    this.rng = new SeededRNG(seed);
  }

  create(): void {
    this.loadLevel(this.level);
  }

  loadLevel(level: number): void {
    const levelIndex = (level - 1) % LEVELS.length;
    const levelData = LEVELS[levelIndex];

    // Clear previous level
    this.barrels.forEach(b => b.graphics.destroy());
    this.barrels = [];
    this.spawnTimers.clear();
    this.barrelsDodged = 0;

    // Initialize spawn timers for each pattern
    levelData.patterns.forEach((_, index) => {
      this.spawnTimers.set(index, 0);
    });

    // Draw background
    if (!this.background) {
      this.background = this.add.graphics();
    }
    this.drawBackground(levelData.backgroundColor, levelData.floorColor);

    // Create player
    if (!this.player) {
      this.player = this.add.graphics();
    }
    this.playerGridX = 8;
    this.playerGridY = 12;
    this.drawPlayer();

    // UI
    if (!this.livesText) {
      this.livesText = this.add.text(8, 8, `LIVES: ${this.lives}`, {
        fontFamily: '"Press Start 2P"',
        fontSize: '14px',
        color: '#ff0000',
      });
    } else {
      this.livesText.setText(`LIVES: ${this.lives}`);
    }

    if (!this.dodgedText) {
      this.dodgedText = this.add.text(this.scale.width / 2, 8, `DODGED: 0/${CONFIG.BARRELS_TO_DODGE_PER_LEVEL}`, {
        fontFamily: '"Press Start 2P"',
        fontSize: '14px',
        color: '#00ff00',
      }).setOrigin(0.5, 0);
    } else {
      this.dodgedText.setText(`DODGED: 0/${CONFIG.BARRELS_TO_DODGE_PER_LEVEL}`);
    }

    if (!this.levelText) {
      this.levelText = this.add.text(this.scale.width - 8, 8, `LVL: ${level}`, {
        fontFamily: '"Press Start 2P"',
        fontSize: '14px',
        color: '#00ffff',
      }).setOrigin(1, 0);
    } else {
      this.levelText.setText(`LVL: ${level}`);
    }

    // Level name
    const levelNameText = this.add.text(
      this.scale.width / 2,
      this.scale.height / 2,
      levelData.name,
      {
        fontFamily: '"Press Start 2P"',
        fontSize: '20px',
        color: '#ffff00',
      }
    ).setOrigin(0.5);

    this.time.delayedCall(2000, () => {
      levelNameText.destroy();
    });
  }

  drawBackground(bgColor: number, floorColor: number): void {
    this.background.clear();

    // Background gradient
    this.background.fillStyle(bgColor);
    this.background.fillRect(0, 40, this.scale.width, this.scale.height - 40);

    // Grid pattern
    this.background.lineStyle(1, 0xffffff, 0.1);
    for (let x = 0; x < CONFIG.GRID_WIDTH; x++) {
      const screenX = x * CONFIG.TILE_SIZE;
      this.background.lineBetween(screenX, 40, screenX, this.scale.height);
    }
    for (let y = 0; y < CONFIG.GRID_HEIGHT; y++) {
      const screenY = 40 + y * CONFIG.TILE_SIZE;
      this.background.lineBetween(0, screenY, this.scale.width, screenY);
    }

    // Floor tiles pattern
    this.background.fillStyle(floorColor);
    for (let x = 0; x < CONFIG.GRID_WIDTH; x++) {
      for (let y = 0; y < CONFIG.GRID_HEIGHT; y++) {
        if ((x + y) % 2 === 0) {
          this.background.fillRect(
            x * CONFIG.TILE_SIZE + 1,
            40 + y * CONFIG.TILE_SIZE + 1,
            CONFIG.TILE_SIZE - 2,
            CONFIG.TILE_SIZE - 2
          );
        }
      }
    }
  }

  drawPlayer(): void {
    this.player.clear();

    const size = CONFIG.TILE_SIZE * 0.7;
    const centerX = 0;
    const centerY = 0;

    // Worker character - simple arcade style

    // Body (blue overalls)
    this.player.fillStyle(0x0066ff);
    this.player.fillRect(centerX - size / 3, centerY - size / 4, size * 0.66, size * 0.5);

    // Head (skin tone)
    this.player.fillStyle(0xffcc99);
    this.player.fillCircle(centerX, centerY - size / 2, size / 3);

    // Hard hat (yellow)
    this.player.fillStyle(0xffff00);
    this.player.fillEllipse(centerX, centerY - size / 1.7, size / 2.5, size / 6);
    this.player.fillRect(centerX - size / 4, centerY - size / 1.5, size / 2, 4);

    // Eyes
    this.player.fillStyle(0x000000);
    this.player.fillCircle(centerX - 4, centerY - size / 2, 2);
    this.player.fillCircle(centerX + 4, centerY - size / 2, 2);

    // Arms
    this.player.fillStyle(0xffcc99);
    this.player.fillRect(centerX - size / 2.2, centerY - size / 6, 4, size / 3);
    this.player.fillRect(centerX + size / 2.2 - 4, centerY - size / 6, 4, size / 3);

    // Legs
    this.player.fillStyle(0x0044cc);
    this.player.fillRect(centerX - size / 4, centerY + size / 6, 6, size / 3);
    this.player.fillRect(centerX + size / 4 - 6, centerY + size / 6, 6, size / 3);

    // Boots (brown)
    this.player.fillStyle(0x654321);
    this.player.fillRect(centerX - size / 4, centerY + size / 2.5, 7, 4);
    this.player.fillRect(centerX + size / 4 - 7, centerY + size / 2.5, 7, 4);

    const screenX = this.playerGridX * CONFIG.TILE_SIZE + CONFIG.TILE_SIZE / 2;
    const screenY = 40 + this.playerGridY * CONFIG.TILE_SIZE + CONFIG.TILE_SIZE / 2;
    this.player.setPosition(screenX, screenY);
  }

  drawBarrel(barrel: Barrel): void {
    barrel.graphics.clear();

    const size = CONFIG.TILE_SIZE * 0.6;

    // Brown barrel body
    barrel.graphics.fillStyle(0x8b4513);
    barrel.graphics.fillEllipse(0, 0, size, size * 0.9);

    // Darker barrel top
    barrel.graphics.fillStyle(0x654321);
    barrel.graphics.fillEllipse(0, -size / 3, size * 0.8, size * 0.3);

    // Wood grain texture (horizontal bands)
    barrel.graphics.lineStyle(2, 0x654321);
    barrel.graphics.strokeEllipse(0, 0, size, size * 0.9);
    barrel.graphics.strokeEllipse(0, -size / 4, size * 0.85, size * 0.7);
    barrel.graphics.strokeEllipse(0, size / 4, size * 0.85, size * 0.7);

    // Metal bands
    barrel.graphics.lineStyle(3, 0x888888);
    barrel.graphics.strokeEllipse(0, -size / 3, size * 0.9, size * 0.4);
    barrel.graphics.strokeEllipse(0, size / 3, size * 0.9, size * 0.4);

    // Highlight
    barrel.graphics.fillStyle(0xaa7744);
    barrel.graphics.fillCircle(-size / 4, -size / 5, size / 8);

    const screenX = barrel.gridX * CONFIG.TILE_SIZE + CONFIG.TILE_SIZE / 2;
    const screenY = 40 + barrel.gridY * CONFIG.TILE_SIZE + CONFIG.TILE_SIZE / 2;
    barrel.graphics.setPosition(screenX, screenY);
  }

  update(time: number, delta: number): void {
    if (this.gameOver) return;

    const levelIndex = (this.level - 1) % LEVELS.length;
    const levelData = LEVELS[levelIndex];

    // Handle player movement
    const dir = this.getDirection();
    this.playerMoveTimer += delta;

    if (this.playerMoveTimer >= CONFIG.PLAYER_MOVE_DELAY) {
      this.playerMoveTimer = 0;

      let moved = false;
      if (dir.left && this.playerGridX > 0) {
        this.playerGridX--;
        moved = true;
      } else if (dir.right && this.playerGridX < CONFIG.GRID_WIDTH - 1) {
        this.playerGridX++;
        moved = true;
      } else if (dir.up && this.playerGridY > 0) {
        this.playerGridY--;
        moved = true;
      } else if (dir.down && this.playerGridY < CONFIG.GRID_HEIGHT - 1) {
        this.playerGridY++;
        moved = true;
      }

      if (moved) {
        this.drawPlayer();
      }
    }

    // Spawn barrels based on level patterns
    levelData.patterns.forEach((pattern, index) => {
      const currentTimer = this.spawnTimers.get(index) || 0;
      const newTimer = currentTimer + delta;

      if (newTimer >= pattern.spawnDelay) {
        this.spawnBarrel(pattern);
        this.spawnTimers.set(index, 0);
      } else {
        this.spawnTimers.set(index, newTimer);
      }
    });

    // Move barrels
    this.barrelMoveTimer += delta;
    if (this.barrelMoveTimer >= CONFIG.BARREL_MOVE_DELAY) {
      this.barrelMoveTimer = 0;

      this.barrels.forEach(barrel => {
        switch (barrel.direction) {
          case 'down':
            barrel.gridY++;
            break;
          case 'right':
            barrel.gridX++;
            break;
          case 'left':
            barrel.gridX--;
            break;
        }

        this.drawBarrel(barrel);
      });

      // Remove off-screen barrels and count dodges
      this.barrels = this.barrels.filter(barrel => {
        const offScreen =
          barrel.gridY >= CONFIG.GRID_HEIGHT ||
          barrel.gridX >= CONFIG.GRID_WIDTH ||
          barrel.gridX < 0;

        if (offScreen) {
          // Successfully dodged
          this.barrelsDodged++;
          this.score += CONFIG.POINTS_PER_BARREL;
          this.onScoreUpdate(this.score);
          this.dodgedText.setText(`DODGED: ${this.barrelsDodged}/${CONFIG.BARRELS_TO_DODGE_PER_LEVEL}`);

          barrel.graphics.destroy();
          return false;
        }
        return true;
      });
    }

    // Check collisions
    for (const barrel of this.barrels) {
      if (barrel.gridX === this.playerGridX && barrel.gridY === this.playerGridY) {
        this.loseLife();
        return;
      }
    }

    // Check level complete
    if (this.barrelsDodged >= CONFIG.BARRELS_TO_DODGE_PER_LEVEL) {
      this.levelComplete();
    }
  }

  spawnBarrel(pattern: LanePattern): void {
    const graphics = this.add.graphics();

    let gridX: number;
    let gridY: number;

    if (pattern.direction === 'down') {
      gridX = pattern.column!;
      gridY = -1;
    } else if (pattern.direction === 'right') {
      gridX = -1;
      gridY = pattern.row!;
    } else {
      gridX = CONFIG.GRID_WIDTH;
      gridY = pattern.row!;
    }

    const barrel: Barrel = {
      gridX,
      gridY,
      direction: pattern.direction,
      graphics,
    };

    this.barrels.push(barrel);
    this.drawBarrel(barrel);
  }

  loseLife(): void {
    this.lives--;
    this.livesText.setText(`LIVES: ${this.lives}`);

    if (this.lives <= 0) {
      this.endGame();
    } else {
      // Reset player position
      this.playerGridX = 8;
      this.playerGridY = 12;
      this.drawPlayer();

      // Clear all barrels
      this.barrels.forEach(b => b.graphics.destroy());
      this.barrels = [];

      // Brief invincibility flash
      let flashCount = 0;
      const flashInterval = this.time.addEvent({
        delay: 100,
        callback: () => {
          this.player.setAlpha(this.player.alpha === 1 ? 0.3 : 1);
          flashCount++;
          if (flashCount >= 6) {
            flashInterval.remove();
            this.player.setAlpha(1);
          }
        },
        loop: true,
      });
    }
  }

  levelComplete(): void {
    this.score += CONFIG.POINTS_PER_LEVEL;
    this.onScoreUpdate(this.score);

    // Clear barrels
    this.barrels.forEach(b => b.graphics.destroy());
    this.barrels = [];

    // Show level complete message
    const completeText = this.add.text(
      this.scale.width / 2,
      this.scale.height / 2,
      'LEVEL COMPLETE!',
      {
        fontFamily: '"Press Start 2P"',
        fontSize: '20px',
        color: '#00ff00',
      }
    ).setOrigin(0.5);

    this.time.delayedCall(2000, () => {
      completeText.destroy();
      this.level++;
      this.loadLevel(this.level);
    });
  }

  endGame(): void {
    this.gameOver = true;

    this.add.text(this.scale.width / 2, this.scale.height / 2 - 40, 'GAME OVER', {
      fontFamily: '"Press Start 2P"',
      fontSize: '24px',
      color: '#ff0000',
    }).setOrigin(0.5);

    this.add.text(
      this.scale.width / 2,
      this.scale.height / 2 + 20,
      `FINAL SCORE: ${this.score}`,
      {
        fontFamily: '"Press Start 2P"',
        fontSize: '16px',
        color: '#ffffff',
      }
    ).setOrigin(0.5);

    this.time.delayedCall(3000, () => {
      this.onGameOver(this.score);
    });
  }
}
