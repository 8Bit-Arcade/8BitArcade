import * as Phaser from 'phaser';
import { SeededRNG } from '../engine/SeededRNG';

const CONFIG = {
  TILE_SIZE: 40,
  GRID_WIDTH: 20,
  GRID_HEIGHT: 13,
  PLAYER_MOVE_DELAY: 150, // ms between moves
  LIVES: 5,
  TIME_LIMIT: 60000, // 60 seconds
  POINTS_PER_GOAL: 200,
  POINTS_PER_FORWARD: 10,
  TIME_BONUS: 10, // Points per second remaining
};

// Lane configuration: row -> {type, speed, direction}
const LANES = [
  { row: 0, type: 'goal', speed: 0, direction: 0 },      // Goal zone
  { row: 1, type: 'river', speed: 60, direction: 1 },    // Logs right
  { row: 2, type: 'river', speed: 80, direction: -1 },   // Logs left
  { row: 3, type: 'river', speed: 50, direction: 1 },    // Turtles right
  { row: 4, type: 'river', speed: 70, direction: -1 },   // Logs left
  { row: 5, type: 'river', speed: 90, direction: 1 },    // Logs right
  { row: 6, type: 'safe', speed: 0, direction: 0 },      // Median
  { row: 7, type: 'road', speed: 100, direction: -1 },   // Cars left
  { row: 8, type: 'road', speed: 80, direction: 1 },     // Cars right
  { row: 9, type: 'road', speed: 120, direction: -1 },   // Fast cars left
  { row: 10, type: 'road', speed: 60, direction: 1 },    // Cars right
  { row: 11, type: 'road', speed: 140, direction: -1 },  // Very fast cars left
  { row: 12, type: 'safe', speed: 0, direction: 0 },     // Start zone
];

interface Vehicle {
  graphics: Phaser.GameObjects.Graphics;
  gridX: number;
  gridY: number;
  width: number; // In grid cells
  speed: number;
  direction: number;
  color: number;
}

interface Platform {
  graphics: Phaser.GameObjects.Graphics;
  gridX: number;
  gridY: number;
  width: number; // In grid cells
  speed: number;
  direction: number;
  type: 'log' | 'turtle';
}

interface Goal {
  gridX: number;
  filled: boolean;
  graphics: Phaser.GameObjects.Graphics;
}

export class RoadHopperScene extends Phaser.Scene {
  private onScoreUpdate: (score: number) => void;
  private onGameOver: (finalScore: number) => void;
  private getDirection: () => { up: boolean; down: boolean; left: boolean; right: boolean };
  private getAction: () => boolean;

  private rng: SeededRNG;
  private score: number = 0;
  private lives: number = CONFIG.LIVES;
  private gameOver: boolean = false;
  private timeRemaining: number = CONFIG.TIME_LIMIT;
  private highestRow: number = 12;

  private playerGridX: number = 10;
  private playerGridY: number = 12;
  private playerMoveTimer: number = 0;
  private playerDir: { x: number; y: number } = { x: 0, y: 0 };
  private player!: Phaser.GameObjects.Graphics;
  private onPlatform: Platform | null = null;

  private vehicles: Vehicle[] = [];
  private platforms: Platform[] = [];
  private goals: Goal[] = [];

  private livesText!: Phaser.GameObjects.Text;
  private timeText!: Phaser.GameObjects.Text;
  private backgroundGraphics!: Phaser.GameObjects.Graphics;

  constructor(
    onScoreUpdate: (score: number) => void,
    onGameOver: (finalScore: number) => void,
    getDirection: () => { up: boolean; down: boolean; left: boolean; right: boolean },
    getAction: () => boolean,
    seed: number
  ) {
    super({ key: 'RoadHopperScene' });
    this.onScoreUpdate = onScoreUpdate;
    this.onGameOver = onGameOver;
    this.getDirection = getDirection;
    this.getAction = getAction;
    this.rng = new SeededRNG(seed);
  }

  create(): void {
    // Draw background
    this.backgroundGraphics = this.add.graphics();
    this.drawBackground();

    // Create goals
    this.createGoals();

    // Create vehicles
    this.createVehicles();

    // Create platforms
    this.createPlatforms();

    // Create player
    this.player = this.add.graphics();
    this.drawPlayer();

    // UI
    this.livesText = this.add.text(8, this.scale.height - 24, `LIVES: ${this.lives}`, {
      fontFamily: '"Press Start 2P"',
      fontSize: '12px',
      color: '#00ff41',
    });

    this.timeText = this.add.text(this.scale.width - 8, this.scale.height - 24, `TIME: ${Math.ceil(this.timeRemaining / 1000)}`, {
      fontFamily: '"Press Start 2P"',
      fontSize: '12px',
      color: '#00ffff',
    }).setOrigin(1, 0);
  }

  drawBackground(): void {
    this.backgroundGraphics.clear();

    for (let row = 0; row < CONFIG.GRID_HEIGHT; row++) {
      const lane = LANES[row];
      const y = row * CONFIG.TILE_SIZE;

      if (lane.type === 'goal') {
        // Purple goal zone with grass
        this.backgroundGraphics.fillStyle(0x6b4c9a);
        this.backgroundGraphics.fillRect(0, y, this.scale.width, CONFIG.TILE_SIZE);
        // Add some texture
        for (let i = 0; i < 20; i++) {
          this.backgroundGraphics.fillStyle(0x8b6cb0, 0.3);
          this.backgroundGraphics.fillCircle(
            this.rng.next() * this.scale.width,
            y + this.rng.next() * CONFIG.TILE_SIZE,
            2
          );
        }
      } else if (lane.type === 'river') {
        // Blue water
        this.backgroundGraphics.fillStyle(0x0066cc);
        this.backgroundGraphics.fillRect(0, y, this.scale.width, CONFIG.TILE_SIZE);
        // Water texture
        for (let i = 0; i < 15; i++) {
          this.backgroundGraphics.fillStyle(0x3388dd, 0.4);
          this.backgroundGraphics.fillCircle(
            this.rng.next() * this.scale.width,
            y + this.rng.next() * CONFIG.TILE_SIZE,
            3
          );
        }
      } else if (lane.type === 'road') {
        // Dark gray road
        this.backgroundGraphics.fillStyle(0x333333);
        this.backgroundGraphics.fillRect(0, y, this.scale.width, CONFIG.TILE_SIZE);
        // Road lines
        this.backgroundGraphics.fillStyle(0xffff00);
        for (let x = 0; x < this.scale.width; x += 60) {
          this.backgroundGraphics.fillRect(x, y + CONFIG.TILE_SIZE / 2 - 1, 30, 2);
        }
      } else if (lane.type === 'safe') {
        // Green grass
        this.backgroundGraphics.fillStyle(row === 12 ? 0x228b22 : 0x32cd32);
        this.backgroundGraphics.fillRect(0, y, this.scale.width, CONFIG.TILE_SIZE);
        // Grass texture
        for (let i = 0; i < 25; i++) {
          this.backgroundGraphics.fillStyle(0x1a6611, 0.3);
          this.backgroundGraphics.fillCircle(
            this.rng.next() * this.scale.width,
            y + this.rng.next() * CONFIG.TILE_SIZE,
            2
          );
        }
      }
    }
  }

  createGoals(): void {
    // 6 goal spots across the top
    const goalPositions = [2, 5, 8, 11, 14, 17];
    for (const x of goalPositions) {
      const graphics = this.add.graphics();
      this.goals.push({
        gridX: x,
        filled: false,
        graphics,
      });
      this.drawGoal(this.goals[this.goals.length - 1]);
    }
  }

  drawGoal(goal: Goal): void {
    goal.graphics.clear();
    const x = goal.gridX * CONFIG.TILE_SIZE;
    const y = 0;

    if (goal.filled) {
      // Filled with frog
      goal.graphics.fillStyle(0x00ff00);
      goal.graphics.fillCircle(x + CONFIG.TILE_SIZE / 2, y + CONFIG.TILE_SIZE / 2, CONFIG.TILE_SIZE / 3);
      goal.graphics.fillStyle(0x00cc00);
      goal.graphics.fillCircle(x + CONFIG.TILE_SIZE / 2 - 5, y + CONFIG.TILE_SIZE / 2 - 5, 3);
      goal.graphics.fillCircle(x + CONFIG.TILE_SIZE / 2 + 5, y + CONFIG.TILE_SIZE / 2 - 5, 3);
    } else {
      // Empty goal pad
      goal.graphics.fillStyle(0xff1493, 0.5);
      goal.graphics.fillRoundedRect(
        x + 4,
        y + 4,
        CONFIG.TILE_SIZE - 8,
        CONFIG.TILE_SIZE - 8,
        4
      );
    }
  }

  createVehicles(): void {
    const carColors = [0xff0000, 0x00ff00, 0x0000ff, 0xffff00, 0xff00ff, 0x00ffff, 0xff8800];

    for (let row = 0; row < CONFIG.GRID_HEIGHT; row++) {
      const lane = LANES[row];
      if (lane.type !== 'road') continue;

      // Create 2-3 vehicles per lane
      const numVehicles = 2 + Math.floor(this.rng.next() * 2);
      const spacing = CONFIG.GRID_WIDTH / numVehicles;

      for (let i = 0; i < numVehicles; i++) {
        const graphics = this.add.graphics();
        const width = 1 + Math.floor(this.rng.next() * 2); // 1-2 cells wide
        const color = carColors[Math.floor(this.rng.next() * carColors.length)];

        this.vehicles.push({
          graphics,
          gridX: i * spacing + this.rng.next() * spacing,
          gridY: row,
          width,
          speed: lane.speed,
          direction: lane.direction,
          color,
        });
      }
    }

    this.vehicles.forEach(v => this.drawVehicle(v));
  }

  drawVehicle(vehicle: Vehicle): void {
    vehicle.graphics.clear();

    const x = vehicle.gridX * CONFIG.TILE_SIZE;
    const y = vehicle.gridY * CONFIG.TILE_SIZE;
    const width = vehicle.width * CONFIG.TILE_SIZE;
    const height = CONFIG.TILE_SIZE * 0.6;
    const yOffset = (CONFIG.TILE_SIZE - height) / 2;

    // Car body
    vehicle.graphics.fillStyle(vehicle.color);
    vehicle.graphics.fillRoundedRect(0, yOffset, width - 4, height, 4);

    // Windows
    vehicle.graphics.fillStyle(0x87ceeb);
    if (vehicle.direction > 0) {
      // Right-facing
      vehicle.graphics.fillRect(width - 14, yOffset + 6, 8, height - 12);
    } else {
      // Left-facing
      vehicle.graphics.fillRect(6, yOffset + 6, 8, height - 12);
    }

    // Headlights/taillights
    vehicle.graphics.fillStyle(vehicle.direction > 0 ? 0xffff00 : 0xff0000);
    if (vehicle.direction > 0) {
      vehicle.graphics.fillCircle(width - 4, yOffset + 6, 3);
      vehicle.graphics.fillCircle(width - 4, yOffset + height - 6, 3);
    } else {
      vehicle.graphics.fillCircle(4, yOffset + 6, 3);
      vehicle.graphics.fillCircle(4, yOffset + height - 6, 3);
    }

    vehicle.graphics.setPosition(x, y);
  }

  createPlatforms(): void {
    for (let row = 0; row < CONFIG.GRID_HEIGHT; row++) {
      const lane = LANES[row];
      if (lane.type !== 'river') continue;

      // Alternate between logs and turtles
      const type: 'log' | 'turtle' = row % 2 === 1 ? 'log' : 'turtle';

      // Create 2-4 platforms per lane
      const numPlatforms = 2 + Math.floor(this.rng.next() * 3);
      const spacing = CONFIG.GRID_WIDTH / numPlatforms;

      for (let i = 0; i < numPlatforms; i++) {
        const graphics = this.add.graphics();
        const width = 2 + Math.floor(this.rng.next() * 2); // 2-3 cells wide

        this.platforms.push({
          graphics,
          gridX: i * spacing + this.rng.next() * spacing,
          gridY: row,
          width,
          speed: lane.speed,
          direction: lane.direction,
          type,
        });
      }
    }

    this.platforms.forEach(p => this.drawPlatform(p));
  }

  drawPlatform(platform: Platform): void {
    platform.graphics.clear();

    const x = platform.gridX * CONFIG.TILE_SIZE;
    const y = platform.gridY * CONFIG.TILE_SIZE;
    const width = platform.width * CONFIG.TILE_SIZE;

    if (platform.type === 'log') {
      // Brown log
      platform.graphics.fillStyle(0x8b4513);
      platform.graphics.fillRoundedRect(0, 12, width - 4, 16, 8);

      // Wood texture
      platform.graphics.lineStyle(1, 0x654321);
      for (let i = 0; i < 3; i++) {
        platform.graphics.lineBetween(
          i * width / 3,
          14,
          i * width / 3,
          26
        );
      }

      // Rings
      platform.graphics.strokeCircle(width / 4, 20, 4);
      platform.graphics.strokeCircle(3 * width / 4, 20, 6);
    } else {
      // Green turtles
      const numTurtles = Math.floor(platform.width);
      for (let i = 0; i < numTurtles; i++) {
        const tx = i * CONFIG.TILE_SIZE + CONFIG.TILE_SIZE / 2;

        // Turtle shell
        platform.graphics.fillStyle(0x228b22);
        platform.graphics.fillEllipse(tx, 20, 16, 14);

        // Shell pattern
        platform.graphics.fillStyle(0x1a6611);
        platform.graphics.fillEllipse(tx, 20, 10, 8);

        // Head
        platform.graphics.fillStyle(0x32cd32);
        platform.graphics.fillCircle(tx - 10, 18, 4);

        // Eye
        platform.graphics.fillStyle(0x000000);
        platform.graphics.fillCircle(tx - 11, 17, 1);
      }
    }

    platform.graphics.setPosition(x, y);
  }

  drawPlayer(): void {
    this.player.clear();

    const size = CONFIG.TILE_SIZE * 0.7;
    const offset = (CONFIG.TILE_SIZE - size) / 2;

    // Frog body - bright green
    this.player.fillStyle(0x00ff00);
    this.player.fillEllipse(0, 0, size * 0.8, size * 0.6);

    // Head (eyes)
    this.player.fillStyle(0x00ff00);
    this.player.fillCircle(-8, -8, 6);
    this.player.fillCircle(8, -8, 6);

    // Eye whites
    this.player.fillStyle(0xffffff);
    this.player.fillCircle(-8, -8, 4);
    this.player.fillCircle(8, -8, 4);

    // Pupils
    this.player.fillStyle(0x000000);
    this.player.fillCircle(-8, -8, 2);
    this.player.fillCircle(8, -8, 2);

    // Legs
    this.player.fillStyle(0x00cc00);
    // Back legs
    this.player.fillEllipse(-10, 5, 8, 12);
    this.player.fillEllipse(10, 5, 8, 12);
    // Front legs
    this.player.fillEllipse(-8, -5, 6, 10);
    this.player.fillEllipse(8, -5, 6, 10);

    // Mouth
    this.player.lineStyle(1, 0x008800);
    this.player.lineBetween(-4, 0, 4, 0);

    const x = this.playerGridX * CONFIG.TILE_SIZE + CONFIG.TILE_SIZE / 2;
    const y = this.playerGridY * CONFIG.TILE_SIZE + CONFIG.TILE_SIZE / 2;
    this.player.setPosition(x, y);
  }

  update(time: number, delta: number): void {
    if (this.gameOver) return;

    const dt = delta / 1000;

    // Update timer
    this.timeRemaining -= delta;
    if (this.timeRemaining <= 0) {
      this.loseLife();
      return;
    }
    this.timeText.setText(`TIME: ${Math.ceil(this.timeRemaining / 1000)}`);

    // Handle input
    this.playerMoveTimer += delta;
    if (this.playerMoveTimer >= CONFIG.PLAYER_MOVE_DELAY) {
      const dir = this.getDirection();
      if (dir.up) this.movePlayer(0, -1);
      else if (dir.down) this.movePlayer(0, 1);
      else if (dir.left) this.movePlayer(-1, 0);
      else if (dir.right) this.movePlayer(1, 0);
    }

    // Move vehicles
    this.vehicles.forEach(v => {
      v.gridX += v.direction * v.speed * dt / CONFIG.TILE_SIZE;

      // Wrap around
      if (v.direction > 0 && v.gridX > CONFIG.GRID_WIDTH + 2) {
        v.gridX = -v.width - 2;
      } else if (v.direction < 0 && v.gridX < -v.width - 2) {
        v.gridX = CONFIG.GRID_WIDTH + 2;
      }

      this.drawVehicle(v);
    });

    // Move platforms
    this.platforms.forEach(p => {
      p.gridX += p.direction * p.speed * dt / CONFIG.TILE_SIZE;

      // Wrap around
      if (p.direction > 0 && p.gridX > CONFIG.GRID_WIDTH + 2) {
        p.gridX = -p.width - 2;
      } else if (p.direction < 0 && p.gridX < -p.width - 2) {
        p.gridX = CONFIG.GRID_WIDTH + 2;
      }

      this.drawPlatform(p);
    });

    // Handle player on platform
    if (this.onPlatform) {
      this.playerGridX += this.onPlatform.direction * this.onPlatform.speed * dt / CONFIG.TILE_SIZE;
      this.drawPlayer();

      // Fall off sides
      if (this.playerGridX < -0.5 || this.playerGridX > CONFIG.GRID_WIDTH - 0.5) {
        this.loseLife();
      }
    }

    // Check collisions
    this.checkCollisions();
  }

  movePlayer(dx: number, dy: number): void {
    const newX = this.playerGridX + dx;
    const newY = this.playerGridY + dy;

    // Bounds check
    if (newX < 0 || newX >= CONFIG.GRID_WIDTH || newY < 0 || newY >= CONFIG.GRID_HEIGHT) {
      return;
    }

    this.playerGridX = newX;
    this.playerGridY = newY;
    this.playerMoveTimer = 0;
    this.onPlatform = null;

    // Award points for moving forward
    if (dy < 0 && newY < this.highestRow) {
      this.highestRow = newY;
      this.score += CONFIG.POINTS_PER_FORWARD;
      this.onScoreUpdate(this.score);
    }

    this.drawPlayer();

    // Check if in goal
    if (newY === 0) {
      this.checkGoal();
    }
  }

  checkCollisions(): void {
    const lane = LANES[this.playerGridY];

    if (lane.type === 'road') {
      // Check vehicle collision
      for (const vehicle of this.vehicles) {
        if (vehicle.gridY !== this.playerGridY) continue;

        const overlap = this.checkOverlap(
          this.playerGridX,
          vehicle.gridX,
          vehicle.width
        );

        if (overlap) {
          this.loseLife();
          return;
        }
      }
    } else if (lane.type === 'river') {
      // Must be on a platform
      let onPlatform = false;

      for (const platform of this.platforms) {
        if (platform.gridY !== this.playerGridY) continue;

        const overlap = this.checkOverlap(
          this.playerGridX,
          platform.gridX,
          platform.width
        );

        if (overlap) {
          onPlatform = true;
          this.onPlatform = platform;
          break;
        }
      }

      if (!onPlatform) {
        this.loseLife();
      }
    }
  }

  checkOverlap(playerX: number, objX: number, objWidth: number): boolean {
    const playerLeft = playerX - 0.3;
    const playerRight = playerX + 0.3;
    const objLeft = objX;
    const objRight = objX + objWidth;

    return playerRight > objLeft && playerLeft < objRight;
  }

  checkGoal(): void {
    for (const goal of this.goals) {
      if (goal.filled) continue;

      const dist = Math.abs(this.playerGridX - goal.gridX);
      if (dist < 0.5) {
        // Fill this goal
        goal.filled = true;
        this.drawGoal(goal);

        this.score += CONFIG.POINTS_PER_GOAL;
        this.score += Math.floor(this.timeRemaining / 1000) * CONFIG.TIME_BONUS;
        this.onScoreUpdate(this.score);

        // Check if all goals filled
        if (this.goals.every(g => g.filled)) {
          this.levelComplete();
        } else {
          this.resetPlayer();
        }
        return;
      }
    }

    // Didn't land on a goal
    this.loseLife();
  }

  resetPlayer(): void {
    this.playerGridX = 10;
    this.playerGridY = 12;
    this.highestRow = 12;
    this.onPlatform = null;
    this.drawPlayer();
  }

  loseLife(): void {
    this.lives--;
    this.livesText.setText(`LIVES: ${this.lives}`);

    if (this.lives <= 0) {
      this.endGame();
    } else {
      this.resetPlayer();
      this.timeRemaining = CONFIG.TIME_LIMIT;
    }
  }

  levelComplete(): void {
    this.score += 1000;
    this.onScoreUpdate(this.score);

    // Reset for next level
    this.goals.forEach(g => {
      g.filled = false;
      this.drawGoal(g);
    });

    // Speed up vehicles and platforms
    this.vehicles.forEach(v => v.speed *= 1.1);
    this.platforms.forEach(p => p.speed *= 1.1);

    this.resetPlayer();
    this.timeRemaining = CONFIG.TIME_LIMIT;
  }

  endGame(): void {
    this.gameOver = true;
    this.add.text(this.scale.width / 2, this.scale.height / 2, 'GAME OVER', {
      fontFamily: '"Press Start 2P"',
      fontSize: '24px',
      color: '#ff0000',
    }).setOrigin(0.5);

    this.time.delayedCall(2000, () => {
      this.onGameOver(this.score);
    });
  }
}
