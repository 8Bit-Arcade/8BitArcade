import * as Phaser from 'phaser';
import { SeededRNG } from '../engine/SeededRNG';

const CONFIG = {
  GRID_SIZE: 30,
  GRID_WIDTH: 20,
  GRID_HEIGHT: 16,
  PLAYER_SPEED: 120,
  ENEMY_SPEED: 80,
  PUMP_TIME: 1500,
  PUMPS_TO_DEFEAT: 4,
  DIG_POINTS: 10,
  ENEMY_POINTS: 1000,
  LIVES: 3,
};

interface Enemy {
  graphics: Phaser.GameObjects.Graphics;
  gridX: number;
  gridY: number;
  targetX: number;
  targetY: number;
  pumped: number;
  defeated: boolean;
  type: 'pooka' | 'fygar';
}

export class TunnelTerrorScene extends Phaser.Scene {
  private onScoreUpdate: (score: number) => void;
  private onGameOver: (finalScore: number) => void;
  private getDirection: () => { up: boolean; down: boolean; left: boolean; right: boolean };
  private getAction: () => boolean;

  private rng: SeededRNG;
  private score: number = 0;
  private lives: number = CONFIG.LIVES;
  private level: number = 1;
  private gameOver: boolean = false;

  private grid: boolean[][] = []; // true = dug, false = soil
  private player!: Phaser.GameObjects.Graphics;
  private playerGridX: number = 1;
  private playerGridY: number = 1;
  private playerTargetX: number = 1;
  private playerTargetY: number = 1;

  private enemies: Enemy[] = [];
  private pump: { active: boolean; timer: number; targetEnemy: Enemy | null } = {
    active: false,
    timer: 0,
    targetEnemy: null,
  };

  private graphics!: Phaser.GameObjects.Graphics;
  private livesText!: Phaser.GameObjects.Text;
  private levelText!: Phaser.GameObjects.Text;
  private lastAction: boolean = false;

  constructor(
    onScoreUpdate: (score: number) => void,
    onGameOver: (finalScore: number) => void,
    getDirection: () => { up: boolean; down: boolean; left: boolean; right: boolean },
    getAction: () => boolean,
    seed: number
  ) {
    super({ key: 'TunnelTerrorScene' });
    this.onScoreUpdate = onScoreUpdate;
    this.onGameOver = onGameOver;
    this.getDirection = getDirection;
    this.getAction = getAction;
    this.rng = new SeededRNG(seed);
  }

  create(): void {
    // Initialize grid
    for (let y = 0; y < CONFIG.GRID_HEIGHT; y++) {
      this.grid[y] = [];
      for (let x = 0; x < CONFIG.GRID_WIDTH; x++) {
        this.grid[y][x] = y === 0 || y === 1; // Top rows start dug
      }
    }

    this.graphics = this.add.graphics();

    // Create player
    this.player = this.add.graphics();
    this.drawPlayer();

    // Spawn enemies
    this.spawnEnemies(4 + this.level);

    // UI
    this.livesText = this.add.text(16, this.scale.height - 30, `LIVES: ${this.lives}`, {
      fontFamily: '"Press Start 2P"',
      fontSize: '12px',
      color: '#00ff41',
    });

    this.levelText = this.add.text(this.scale.width - 16, this.scale.height - 30, `LEVEL ${this.level}`, {
      fontFamily: '"Press Start 2P"',
      fontSize: '12px',
      color: '#00f5ff',
    }).setOrigin(1, 0);
  }

  drawPlayer(): void {
    this.player.clear();
    this.player.fillStyle(0x00ff41);

    // Simple character
    this.player.fillCircle(0, -8, 8);
    this.player.fillRect(-6, -8, 12, 16);
    this.player.fillCircle(-6, 4, 4);
    this.player.fillCircle(6, 4, 4);

    this.player.setPosition(
      this.playerGridX * CONFIG.GRID_SIZE + CONFIG.GRID_SIZE / 2,
      this.playerGridY * CONFIG.GRID_SIZE + CONFIG.GRID_SIZE / 2
    );
  }

  drawEnemy(enemy: Enemy): void {
    enemy.graphics.clear();

    if (enemy.defeated) return;

    const color = enemy.type === 'pooka' ? 0xff0040 : 0xff6600;
    const size = Math.max(8, 12 - enemy.pumped * 2);

    enemy.graphics.fillStyle(color);
    enemy.graphics.fillCircle(0, 0, size);

    // Eyes
    enemy.graphics.fillStyle(0xffffff);
    enemy.graphics.fillCircle(-4, -2, 2);
    enemy.graphics.fillCircle(4, -2, 2);

    // Pumped indicator
    if (enemy.pumped > 0) {
      enemy.graphics.lineStyle(2, 0xffffff);
      enemy.graphics.strokeCircle(0, 0, 14);
    }

    enemy.graphics.setPosition(
      enemy.gridX * CONFIG.GRID_SIZE + CONFIG.GRID_SIZE / 2,
      enemy.gridY * CONFIG.GRID_SIZE + CONFIG.GRID_SIZE / 2
    );
  }

  spawnEnemies(count: number): void {
    for (let i = 0; i < count; i++) {
      const enemy = this.add.graphics();
      const type = this.rng.next() > 0.5 ? 'pooka' : 'fygar';
      const gridX = Math.floor(this.rng.nextFloat(5, CONFIG.GRID_WIDTH - 2));
      const gridY = Math.floor(this.rng.nextFloat(5, CONFIG.GRID_HEIGHT - 2));

      this.enemies.push({
        graphics: enemy,
        gridX,
        gridY,
        targetX: gridX,
        targetY: gridY,
        pumped: 0,
        defeated: false,
        type,
      });

      this.drawEnemy(this.enemies[this.enemies.length - 1]);
    }
  }

  update(time: number, delta: number): void {
    if (this.gameOver) return;

    this.drawGrid();

    // Handle movement
    const dir = this.getDirection();
    if (this.playerGridX === this.playerTargetX && this.playerGridY === this.playerTargetY) {
      // Can move
      if (dir.up && this.playerGridY > 0) {
        this.playerTargetY--;
      } else if (dir.down && this.playerGridY < CONFIG.GRID_HEIGHT - 1) {
        this.playerTargetY++;
      } else if (dir.left && this.playerGridX > 0) {
        this.playerTargetX--;
      } else if (dir.right && this.playerGridX < CONFIG.GRID_WIDTH - 1) {
        this.playerTargetX++;
      }
    }

    // Move player toward target
    const dx = this.playerTargetX - this.playerGridX;
    const dy = this.playerTargetY - this.playerGridY;

    if (dx !== 0 || dy !== 0) {
      const speed = CONFIG.PLAYER_SPEED * (delta / 1000);
      const dist = Math.sqrt(dx * dx + dy * dy) * CONFIG.GRID_SIZE;

      if (dist < speed) {
        this.playerGridX = this.playerTargetX;
        this.playerGridY = this.playerTargetY;

        // Dig
        if (!this.grid[this.playerGridY][this.playerGridX]) {
          this.grid[this.playerGridY][this.playerGridX] = true;
          this.score += CONFIG.DIG_POINTS;
          this.onScoreUpdate(this.score);
        }
      } else {
        this.playerGridX += (dx / Math.abs(dx || 1)) * (speed / CONFIG.GRID_SIZE);
        this.playerGridY += (dy / Math.abs(dy || 1)) * (speed / CONFIG.GRID_SIZE);
      }
    }

    this.drawPlayer();

    // Handle pump action
    const action = this.getAction();
    if (action && !this.lastAction && !this.pump.active) {
      // Start pumping
      const target = this.findNearestEnemy();
      if (target && !target.defeated) {
        this.pump.active = true;
        this.pump.timer = CONFIG.PUMP_TIME;
        this.pump.targetEnemy = target;
      }
    }
    this.lastAction = action;

    if (this.pump.active) {
      this.pump.timer -= delta;

      if (this.pump.timer <= 0 && this.pump.targetEnemy) {
        this.pump.targetEnemy.pumped++;

        if (this.pump.targetEnemy.pumped >= CONFIG.PUMPS_TO_DEFEAT) {
          this.pump.targetEnemy.defeated = true;
          this.pump.targetEnemy.graphics.destroy();
          this.score += CONFIG.ENEMY_POINTS;
          this.onScoreUpdate(this.score);
        }

        this.pump.active = false;
        this.pump.targetEnemy = null;
      }
    }

    // Move enemies
    for (const enemy of this.enemies) {
      if (enemy.defeated) continue;

      // Simple AI - move randomly through dug tunnels
      if (enemy.gridX === enemy.targetX && enemy.gridY === enemy.targetY) {
        const dirs = [];
        if (enemy.gridY > 0 && this.grid[enemy.gridY - 1][enemy.gridX]) dirs.push({ x: 0, y: -1 });
        if (enemy.gridY < CONFIG.GRID_HEIGHT - 1 && this.grid[enemy.gridY + 1][enemy.gridX]) dirs.push({ x: 0, y: 1 });
        if (enemy.gridX > 0 && this.grid[enemy.gridY][enemy.gridX - 1]) dirs.push({ x: -1, y: 0 });
        if (enemy.gridX < CONFIG.GRID_WIDTH - 1 && this.grid[enemy.gridY][enemy.gridX + 1]) dirs.push({ x: 1, y: 0 });

        if (dirs.length > 0) {
          const dir = dirs[Math.floor(this.rng.next() * dirs.length)];
          enemy.targetX = enemy.gridX + dir.x;
          enemy.targetY = enemy.gridY + dir.y;
        }
      }

      // Move toward target
      const edx = enemy.targetX - enemy.gridX;
      const edy = enemy.targetY - enemy.gridY;

      if (edx !== 0 || edy !== 0) {
        const speed = CONFIG.ENEMY_SPEED * (delta / 1000);
        const dist = Math.sqrt(edx * edx + edy * edy) * CONFIG.GRID_SIZE;

        if (dist < speed) {
          enemy.gridX = enemy.targetX;
          enemy.gridY = enemy.targetY;
        } else {
          enemy.gridX += (edx / Math.abs(edx || 1)) * (speed / CONFIG.GRID_SIZE);
          enemy.gridY += (edy / Math.abs(edy || 1)) * (speed / CONFIG.GRID_SIZE);
        }
      }

      this.drawEnemy(enemy);

      // Check collision with player
      const distToPlayer = Math.sqrt(
        Math.pow(enemy.gridX - this.playerGridX, 2) +
        Math.pow(enemy.gridY - this.playerGridY, 2)
      );

      if (distToPlayer < 0.5) {
        this.loseLife();
        return;
      }
    }

    // Check level complete
    if (this.enemies.every(e => e.defeated)) {
      this.levelComplete();
    }
  }

  drawGrid(): void {
    this.graphics.clear();

    for (let y = 0; y < CONFIG.GRID_HEIGHT; y++) {
      for (let x = 0; x < CONFIG.GRID_WIDTH; x++) {
        const px = x * CONFIG.GRID_SIZE;
        const py = y * CONFIG.GRID_SIZE;

        if (this.grid[y][x]) {
          // Dug tunnel
          this.graphics.fillStyle(0x000000);
          this.graphics.fillRect(px, py, CONFIG.GRID_SIZE, CONFIG.GRID_SIZE);
        } else {
          // Soil
          this.graphics.fillStyle(0x8B4513);
          this.graphics.fillRect(px, py, CONFIG.GRID_SIZE, CONFIG.GRID_SIZE);
          this.graphics.fillStyle(0x654321);
          this.graphics.fillRect(px + 2, py + 2, CONFIG.GRID_SIZE - 4, CONFIG.GRID_SIZE - 4);
        }
      }
    }

    // Grid lines
    this.graphics.lineStyle(1, 0x555555, 0.3);
    for (let x = 0; x <= CONFIG.GRID_WIDTH; x++) {
      this.graphics.strokeLineShape(
        new Phaser.Geom.Line(x * CONFIG.GRID_SIZE, 0, x * CONFIG.GRID_SIZE, CONFIG.GRID_HEIGHT * CONFIG.GRID_SIZE)
      );
    }
    for (let y = 0; y <= CONFIG.GRID_HEIGHT; y++) {
      this.graphics.strokeLineShape(
        new Phaser.Geom.Line(0, y * CONFIG.GRID_SIZE, CONFIG.GRID_WIDTH * CONFIG.GRID_SIZE, y * CONFIG.GRID_SIZE)
      );
    }
  }

  findNearestEnemy(): Enemy | null {
    let nearest: Enemy | null = null;
    let minDist = Infinity;

    for (const enemy of this.enemies) {
      if (enemy.defeated) continue;

      const dist = Math.sqrt(
        Math.pow(enemy.gridX - this.playerGridX, 2) +
        Math.pow(enemy.gridY - this.playerGridY, 2)
      );

      if (dist < minDist && dist < 3) {
        minDist = dist;
        nearest = enemy;
      }
    }

    return nearest;
  }

  loseLife(): void {
    this.lives--;
    this.livesText.setText(`LIVES: ${this.lives}`);

    if (this.lives <= 0) {
      this.endGame();
    } else {
      this.playerGridX = 1;
      this.playerGridY = 1;
      this.playerTargetX = 1;
      this.playerTargetY = 1;
      this.drawPlayer();
    }
  }

  levelComplete(): void {
    this.level++;
    this.levelText.setText(`LEVEL ${this.level}`);
    this.score += 1000;
    this.onScoreUpdate(this.score);

    // Reset grid
    for (let y = 0; y < CONFIG.GRID_HEIGHT; y++) {
      for (let x = 0; x < CONFIG.GRID_WIDTH; x++) {
        this.grid[y][x] = y === 0 || y === 1;
      }
    }

    // Reset player
    this.playerGridX = 1;
    this.playerGridY = 1;
    this.playerTargetX = 1;
    this.playerTargetY = 1;

    // Spawn more enemies
    this.enemies = [];
    this.spawnEnemies(4 + this.level);
  }

  endGame(): void {
    this.gameOver = true;
    this.add.text(this.scale.width / 2, this.scale.height / 2, 'GAME OVER', {
      fontFamily: '"Press Start 2P"',
      fontSize: '24px',
      color: '#ff0040',
    }).setOrigin(0.5);

    this.time.delayedCall(2000, () => {
      this.onGameOver(this.score);
    });
  }
}
