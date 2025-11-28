import * as Phaser from 'phaser';
import { SeededRNG } from '../engine/SeededRNG';

const CONFIG = {
  PLAYER_SPEED: 120,
  JUMP_VELOCITY: -350,
  GRAVITY: 800,
  PLATFORM_HEIGHT: 60,
  BARREL_SPEED: 150,
  BARREL_SPAWN_RATE: 2000,
  HAMMER_DURATION: 8000,
  CLIMB_SPEED: 100,
  LIVES: 3,
  LEVEL_COMPLETE_POINTS: 1000,
  BARREL_DODGE_POINTS: 100,
};

interface Platform {
  x: number;
  y: number;
  width: number;
  hasLadder?: boolean;
}

interface Barrel {
  graphics: Phaser.GameObjects.Graphics;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rolling: boolean;
}

export class BarrelDodgeScene extends Phaser.Scene {
  private onScoreUpdate: (score: number) => void;
  private onGameOver: (finalScore: number) => void;
  private getDirection: () => { up: boolean; down: boolean; left: boolean; right: boolean };
  private getAction: () => boolean;

  private rng: SeededRNG;
  private score: number = 0;
  private lives: number = CONFIG.LIVES;
  private level: number = 1;
  private gameOver: boolean = false;

  private player!: Phaser.GameObjects.Graphics;
  private playerX: number = 50;
  private playerY: number = 500;
  private playerVX: number = 0;
  private playerVY: number = 0;
  private onGround: boolean = false;
  private onLadder: boolean = false;

  private platforms: Platform[] = [];
  private barrels: Barrel[] = [];
  private hammer: { active: boolean; timer: number } = { active: false, timer: 0 };

  private spawnTimer: number = 0;
  private graphics!: Phaser.GameObjects.Graphics;
  private livesText!: Phaser.GameObjects.Text;
  private levelText!: Phaser.GameObjects.Text;

  constructor(
    onScoreUpdate: (score: number) => void,
    onGameOver: (finalScore: number) => void,
    getDirection: () => { up: boolean; down: boolean; left: boolean; right: boolean },
    getAction: () => boolean,
    seed: number
  ) {
    super({ key: 'BarrelDodgeScene' });
    this.onScoreUpdate = onScoreUpdate;
    this.onGameOver = onGameOver;
    this.getDirection = getDirection;
    this.getAction = getAction;
    this.rng = new SeededRNG(seed);
  }

  create(): void {
    const { width, height } = this.scale;

    // Create platforms
    this.createPlatforms();

    this.graphics = this.add.graphics();

    // Create player
    this.player = this.add.graphics();
    this.drawPlayer();

    // UI
    this.livesText = this.add.text(16, 16, `LIVES: ${this.lives}`, {
      fontFamily: '"Press Start 2P"',
      fontSize: '12px',
      color: '#00ff41',
    });

    this.levelText = this.add.text(width - 16, 16, `LEVEL ${this.level}`, {
      fontFamily: '"Press Start 2P"',
      fontSize: '12px',
      color: '#00f5ff',
    }).setOrigin(1, 0);

    // Goal at top
    this.add.text(width / 2, 30, 'GOAL!', {
      fontFamily: '"Press Start 2P"',
      fontSize: '16px',
      color: '#ffff00',
    }).setOrigin(0.5);
  }

  createPlatforms(): void {
    const { width } = this.scale;

    // Create slanted platforms
    this.platforms = [
      { x: 0, y: 540, width: width, hasLadder: true },
      { x: width * 0.1, y: 470, width: width * 0.8, hasLadder: true },
      { x: 0, y: 400, width: width * 0.9, hasLadder: true },
      { x: width * 0.15, y: 330, width: width * 0.75, hasLadder: true },
      { x: 0, y: 260, width: width * 0.85, hasLadder: true },
      { x: width * 0.2, y: 190, width: width * 0.7, hasLadder: true },
      { x: 0, y: 120, width: width, hasLadder: false },
      { x: width * 0.4, y: 50, width: width * 0.3, hasLadder: false }, // Top platform with goal
    ];
  }

  drawPlayer(): void {
    this.player.clear();
    this.player.fillStyle(this.hammer.active ? 0xffff00 : 0xff0040);

    // Simple character
    this.player.fillCircle(0, -12, 8);
    this.player.fillRect(-6, -12, 12, 16);
    this.player.fillRect(-8, 0, 4, 8);
    this.player.fillRect(4, 0, 4, 8);

    if (this.hammer.active) {
      this.player.fillStyle(0x8B4513);
      this.player.fillRect(8, -12, 4, 12);
      this.player.fillRect(8, -14, 10, 4);
    }

    this.player.setPosition(this.playerX, this.playerY);
  }

  drawBarrel(barrel: Barrel): void {
    barrel.graphics.clear();
    barrel.graphics.fillStyle(0x8B4513);
    barrel.graphics.fillCircle(0, 0, 10);
    barrel.graphics.fillStyle(0xA0522D);
    barrel.graphics.fillRect(-10, -3, 20, 6);

    barrel.graphics.setPosition(barrel.x, barrel.y);
  }

  update(time: number, delta: number): void {
    if (this.gameOver) return;

    const dt = delta / 1000;
    const { width, height } = this.scale;

    // Draw platforms
    this.graphics.clear();
    for (const platform of this.platforms) {
      this.graphics.fillStyle(0xff6600);
      this.graphics.fillRect(platform.x, platform.y, platform.width, 8);

      if (platform.hasLadder) {
        const ladderX = platform.x + platform.width / 2;
        this.graphics.fillStyle(0xffff00);
        this.graphics.fillRect(ladderX - 3, platform.y - CONFIG.PLATFORM_HEIGHT, 6, CONFIG.PLATFORM_HEIGHT);
        this.graphics.fillRect(ladderX - 8, platform.y - CONFIG.PLATFORM_HEIGHT + 10, 16, 3);
        this.graphics.fillRect(ladderX - 8, platform.y - CONFIG.PLATFORM_HEIGHT + 25, 16, 3);
        this.graphics.fillRect(ladderX - 8, platform.y - CONFIG.PLATFORM_HEIGHT + 40, 16, 3);
      }
    }

    // Handle input
    const dir = this.getDirection();

    // Check if on ladder
    this.checkLadder();

    if (this.onLadder) {
      this.playerVY = 0;
      this.playerVX = 0;

      if (dir.up) {
        this.playerY -= CONFIG.CLIMB_SPEED * dt;
      } else if (dir.down) {
        this.playerY += CONFIG.CLIMB_SPEED * dt;
      }
    } else {
      // Normal movement
      this.playerVX = 0;

      if (dir.left) {
        this.playerVX = -CONFIG.PLAYER_SPEED;
      } else if (dir.right) {
        this.playerVX = CONFIG.PLAYER_SPEED;
      }

      // Jump
      if (dir.up && this.onGround) {
        this.playerVY = CONFIG.JUMP_VELOCITY;
        this.onGround = false;
      }

      // Apply gravity
      this.playerVY += CONFIG.GRAVITY * dt;

      // Move
      this.playerX += this.playerVX * dt;
      this.playerY += this.playerVY * dt;

      // Screen bounds
      this.playerX = Math.max(10, Math.min(width - 10, this.playerX));
    }

    // Platform collision
    this.onGround = false;
    for (const platform of this.platforms) {
      if (
        this.playerX > platform.x &&
        this.playerX < platform.x + platform.width &&
        this.playerY >= platform.y - 5 &&
        this.playerY <= platform.y + 10 &&
        this.playerVY >= 0
      ) {
        this.playerY = platform.y;
        this.playerVY = 0;
        this.onGround = true;
        break;
      }
    }

    this.drawPlayer();

    // Hammer pickup (action button near top platform)
    if (this.getAction() && !this.hammer.active && this.playerY < 150) {
      this.hammer.active = true;
      this.hammer.timer = CONFIG.HAMMER_DURATION;
    }

    // Hammer timer
    if (this.hammer.active) {
      this.hammer.timer -= delta;
      if (this.hammer.timer <= 0) {
        this.hammer.active = false;
        this.drawPlayer();
      }
    }

    // Spawn barrels
    this.spawnTimer += delta;
    if (this.spawnTimer > CONFIG.BARREL_SPAWN_RATE) {
      this.spawnTimer = 0;
      this.spawnBarrel();
    }

    // Update barrels
    for (let i = this.barrels.length - 1; i >= 0; i--) {
      const barrel = this.barrels[i];

      barrel.x += barrel.vx * dt;
      barrel.y += barrel.vy * dt;

      // Barrel gravity
      barrel.vy += CONFIG.GRAVITY * 0.5 * dt;

      // Platform collision
      for (const platform of this.platforms) {
        if (
          barrel.x > platform.x &&
          barrel.x < platform.x + platform.width &&
          barrel.y >= platform.y - 12 &&
          barrel.y <= platform.y + 5 &&
          barrel.vy > 0
        ) {
          barrel.y = platform.y - 10;
          barrel.vy = 0;
          barrel.rolling = true;

          // Roll direction
          if (barrel.vx === 0) {
            barrel.vx = this.rng.next() > 0.5 ? CONFIG.BARREL_SPEED : -CONFIG.BARREL_SPEED;
          }
        }
      }

      // Fall off platform
      if (barrel.rolling) {
        let onPlatform = false;
        for (const platform of this.platforms) {
          if (
            barrel.x > platform.x &&
            barrel.x < platform.x + platform.width &&
            Math.abs(barrel.y - platform.y + 10) < 5
          ) {
            onPlatform = true;
            break;
          }
        }

        if (!onPlatform && this.rng.next() < 0.02) {
          barrel.rolling = false;
          barrel.vy = 50;
        }
      }

      this.drawBarrel(barrel);

      // Remove off-screen
      if (barrel.y > height || barrel.x < -20 || barrel.x > width + 20) {
        barrel.graphics.destroy();
        this.barrels.splice(i, 1);
        continue;
      }

      // Check collision with player
      const dist = Math.sqrt(
        Math.pow(barrel.x - this.playerX, 2) + Math.pow(barrel.y - this.playerY, 2)
      );

      if (dist < 15) {
        if (this.hammer.active) {
          // Destroy barrel
          barrel.graphics.destroy();
          this.barrels.splice(i, 1);
          this.score += CONFIG.BARREL_DODGE_POINTS;
          this.onScoreUpdate(this.score);
        } else {
          this.loseLife();
          return;
        }
      }
    }

    // Check win condition (reached top)
    if (this.playerY < 60) {
      this.levelComplete();
    }
  }

  checkLadder(): void {
    for (const platform of this.platforms) {
      if (!platform.hasLadder) continue;

      const ladderX = platform.x + platform.width / 2;
      if (
        Math.abs(this.playerX - ladderX) < 15 &&
        this.playerY > platform.y - CONFIG.PLATFORM_HEIGHT &&
        this.playerY < platform.y + 10
      ) {
        this.onLadder = true;
        return;
      }
    }

    this.onLadder = false;
  }

  spawnBarrel(): void {
    const barrel = this.add.graphics();

    this.barrels.push({
      graphics: barrel,
      x: this.scale.width * 0.9,
      y: 100,
      vx: 0,
      vy: 50,
      rolling: false,
    });

    this.drawBarrel(this.barrels[this.barrels.length - 1]);
  }

  loseLife(): void {
    this.lives--;
    this.livesText.setText(`LIVES: ${this.lives}`);

    if (this.lives <= 0) {
      this.endGame();
    } else {
      this.playerX = 50;
      this.playerY = 500;
      this.playerVX = 0;
      this.playerVY = 0;
      this.hammer.active = false;
      this.barrels.forEach(b => b.graphics.destroy());
      this.barrels = [];
      this.drawPlayer();
    }
  }

  levelComplete(): void {
    this.level++;
    this.levelText.setText(`LEVEL ${this.level}`);
    this.score += CONFIG.LEVEL_COMPLETE_POINTS;
    this.onScoreUpdate(this.score);

    this.playerX = 50;
    this.playerY = 500;
    this.playerVX = 0;
    this.playerVY = 0;
    this.barrels.forEach(b => b.graphics.destroy());
    this.barrels = [];
    this.hammer.active = false;
  }

  endGame(): void {
    this.gameOver = true;
    this.add.text(this.scale.width / 2, this.scale.height / 2, 'GAME OVER', {
      fontFamily: '"Press Start 2P"',
      fontSize: '32px',
      color: '#ff0040',
    }).setOrigin(0.5);

    this.time.delayedCall(2000, () => {
      this.onGameOver(this.score);
    });
  }
}
