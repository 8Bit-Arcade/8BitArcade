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
  ladderX?: number;
}

interface Barrel {
  graphics: Phaser.GameObjects.Graphics;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rolling: boolean;
}

// 5 distinct level layouts
const LEVELS = [
  // Level 1: Classic slanted platforms (like original Donkey Kong)
  {
    name: 'CLASSIC CLIMB',
    platforms: [
      { x: 0, y: 540, width: 640, hasLadder: true, ladderX: 580 },
      { x: 60, y: 470, width: 520, hasLadder: true, ladderX: 100 },
      { x: 0, y: 400, width: 580, hasLadder: true, ladderX: 540 },
      { x: 80, y: 330, width: 480, hasLadder: true, ladderX: 120 },
      { x: 0, y: 260, width: 540, hasLadder: true, ladderX: 500 },
      { x: 120, y: 190, width: 440, hasLadder: true, ladderX: 160 },
      { x: 0, y: 120, width: 640, hasLadder: false },
    ],
    goalPlatform: { x: 240, y: 50, width: 160, hasLadder: false },
    dkPosition: { x: 80, y: 100 },
    princessPosition: { x: 320, y: 30 },
    barrelSpawnX: 90,
    barrelSpawnY: 100,
    backgroundColor: 0x000033,
  },

  // Level 2: Elevator style with vertical gaps
  {
    name: 'ELEVATOR MADNESS',
    platforms: [
      { x: 0, y: 540, width: 200, hasLadder: true, ladderX: 180 },
      { x: 440, y: 540, width: 200, hasLadder: true, ladderX: 460 },
      { x: 220, y: 450, width: 200, hasLadder: true, ladderX: 240 },
      { x: 0, y: 360, width: 200, hasLadder: true, ladderX: 180 },
      { x: 440, y: 360, width: 200, hasLadder: true, ladderX: 460 },
      { x: 220, y: 270, width: 200, hasLadder: true, ladderX: 240 },
      { x: 0, y: 180, width: 200, hasLadder: true, ladderX: 180 },
      { x: 440, y: 180, width: 200, hasLadder: true, ladderX: 460 },
      { x: 160, y: 90, width: 320, hasLadder: false },
    ],
    goalPlatform: { x: 240, y: 30, width: 160, hasLadder: false },
    dkPosition: { x: 320, y: 70 },
    princessPosition: { x: 320, y: 10 },
    barrelSpawnX: 330,
    barrelSpawnY: 70,
    backgroundColor: 0x1a0033,
  },

  // Level 3: Zigzag platforms
  {
    name: 'ZIGZAG ZONE',
    platforms: [
      { x: 0, y: 540, width: 640, hasLadder: true, ladderX: 320 },
      { x: 0, y: 450, width: 300, hasLadder: true, ladderX: 280 },
      { x: 340, y: 380, width: 300, hasLadder: true, ladderX: 360 },
      { x: 0, y: 310, width: 300, hasLadder: true, ladderX: 280 },
      { x: 340, y: 240, width: 300, hasLadder: true, ladderX: 360 },
      { x: 0, y: 170, width: 300, hasLadder: true, ladderX: 280 },
      { x: 200, y: 100, width: 240, hasLadder: false },
    ],
    goalPlatform: { x: 240, y: 40, width: 160, hasLadder: false },
    dkPosition: { x: 320, y: 80 },
    princessPosition: { x: 320, y: 20 },
    barrelSpawnX: 330,
    barrelSpawnY: 80,
    backgroundColor: 0x002233,
  },

  // Level 4: Scattered platforms (challenging jumps)
  {
    name: 'PLATFORM CHAOS',
    platforms: [
      { x: 0, y: 540, width: 180, hasLadder: true, ladderX: 160 },
      { x: 220, y: 540, width: 180, hasLadder: true, ladderX: 240 },
      { x: 460, y: 540, width: 180, hasLadder: true, ladderX: 480 },
      { x: 100, y: 440, width: 160, hasLadder: true, ladderX: 120 },
      { x: 380, y: 440, width: 160, hasLadder: true, ladderX: 400 },
      { x: 0, y: 340, width: 160, hasLadder: true, ladderX: 140 },
      { x: 240, y: 340, width: 160, hasLadder: true, ladderX: 260 },
      { x: 480, y: 340, width: 160, hasLadder: true, ladderX: 500 },
      { x: 120, y: 240, width: 160, hasLadder: true, ladderX: 140 },
      { x: 360, y: 240, width: 160, hasLadder: true, ladderX: 380 },
      { x: 200, y: 140, width: 240, hasLadder: false },
    ],
    goalPlatform: { x: 240, y: 80, width: 160, hasLadder: false },
    dkPosition: { x: 320, y: 120 },
    princessPosition: { x: 320, y: 60 },
    barrelSpawnX: 330,
    barrelSpawnY: 120,
    backgroundColor: 0x330033,
  },

  // Level 5: Ultimate challenge - narrow platforms
  {
    name: 'FINAL SHOWDOWN',
    platforms: [
      { x: 0, y: 540, width: 640, hasLadder: true, ladderX: 600 },
      { x: 40, y: 480, width: 140, hasLadder: true, ladderX: 60 },
      { x: 220, y: 480, width: 140, hasLadder: true, ladderX: 240 },
      { x: 460, y: 480, width: 140, hasLadder: true, ladderX: 480 },
      { x: 0, y: 400, width: 140, hasLadder: true, ladderX: 120 },
      { x: 180, y: 400, width: 140, hasLadder: true, ladderX: 200 },
      { x: 360, y: 400, width: 140, hasLadder: true, ladderX: 380 },
      { x: 500, y: 400, width: 140, hasLadder: true, ladderX: 520 },
      { x: 80, y: 320, width: 140, hasLadder: true, ladderX: 100 },
      { x: 260, y: 320, width: 140, hasLadder: true, ladderX: 280 },
      { x: 420, y: 320, width: 140, hasLadder: true, ladderX: 440 },
      { x: 40, y: 240, width: 140, hasLadder: true, ladderX: 60 },
      { x: 220, y: 240, width: 140, hasLadder: true, ladderX: 240 },
      { x: 460, y: 240, width: 140, hasLadder: true, ladderX: 480 },
      { x: 160, y: 160, width: 320, hasLadder: false },
    ],
    goalPlatform: { x: 240, y: 100, width: 160, hasLadder: false },
    dkPosition: { x: 320, y: 140 },
    princessPosition: { x: 320, y: 80 },
    barrelSpawnX: 330,
    barrelSpawnY: 140,
    backgroundColor: 0x330000,
  },
];

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
  private donkeyKong!: Phaser.GameObjects.Graphics;
  private princess!: Phaser.GameObjects.Graphics;
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
    this.loadLevel(this.level);
  }

  loadLevel(level: number): void {
    const levelIndex = (level - 1) % LEVELS.length;
    const levelData = LEVELS[levelIndex];

    // Clear previous level
    if (this.graphics) this.graphics.clear();
    this.barrels.forEach(b => b.graphics.destroy());
    this.barrels = [];
    this.hammer.active = false;

    // Setup level
    this.platforms = levelData.platforms.concat([levelData.goalPlatform]);

    // Create graphics
    if (!this.graphics) {
      this.graphics = this.add.graphics();
    }

    // Draw background
    this.drawBackground(levelData.backgroundColor);

    // Create player
    if (!this.player) {
      this.player = this.add.graphics();
    }
    this.playerX = 50;
    this.playerY = 500;
    this.playerVX = 0;
    this.playerVY = 0;
    this.drawPlayer();

    // Create Donkey Kong
    if (!this.donkeyKong) {
      this.donkeyKong = this.add.graphics();
    }
    this.drawDonkeyKong(levelData.dkPosition.x, levelData.dkPosition.y);

    // Create Princess
    if (!this.princess) {
      this.princess = this.add.graphics();
    }
    this.drawPrincess(levelData.princessPosition.x, levelData.princessPosition.y);

    // UI
    if (!this.livesText) {
      this.livesText = this.add.text(16, 16, `LIVES: ${this.lives}`, {
        fontFamily: '"Press Start 2P"',
        fontSize: '12px',
        color: '#ff0000',
      });
    } else {
      this.livesText.setText(`LIVES: ${this.lives}`);
    }

    if (!this.levelText) {
      this.levelText = this.add.text(this.scale.width - 16, 16, `LEVEL ${level}`, {
        fontFamily: '"Press Start 2P"',
        fontSize: '12px',
        color: '#00ffff',
      }).setOrigin(1, 0);
    } else {
      this.levelText.setText(`LEVEL ${level}`);
    }

    // Level name announcement
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

  drawBackground(color: number): void {
    this.cameras.main.setBackgroundColor(color);
  }

  drawPlayer(): void {
    this.player.clear();

    const size = 24;

    // Mario character
    // Body (blue overalls)
    this.player.fillStyle(this.hammer.active ? 0xffff00 : 0x0000ff);
    this.player.fillRect(-size / 3, -size / 4, size * 0.66, size * 0.5);

    // Head (skin tone)
    this.player.fillStyle(0xffcc99);
    this.player.fillCircle(0, -size / 2, size / 3);

    // Red cap
    this.player.fillStyle(0xff0000);
    this.player.fillEllipse(0, -size / 1.7, size / 2.5, size / 6);
    this.player.fillRect(-size / 4, -size / 1.5, size / 2, 4);

    // Mustache
    this.player.fillStyle(0x000000);
    this.player.fillRect(-size / 4, -size / 4, size / 2, 3);

    // Eyes
    this.player.fillStyle(0x000000);
    this.player.fillCircle(-4, -size / 2, 2);
    this.player.fillCircle(4, -size / 2, 2);

    // Arms
    this.player.fillStyle(0xffcc99);
    this.player.fillRect(-size / 2, -size / 8, 4, size / 3);
    this.player.fillRect(size / 2 - 4, -size / 8, 4, size / 3);

    // Legs
    this.player.fillStyle(0x0000ff);
    this.player.fillRect(-size / 4, size / 4, 5, size / 3);
    this.player.fillRect(size / 4 - 5, size / 4, 5, size / 3);

    // Hammer (if active)
    if (this.hammer.active) {
      this.player.fillStyle(0x8b4513);
      this.player.fillRect(size / 2, -size / 2, 4, 16);
      this.player.fillStyle(0x696969);
      this.player.fillRect(size / 2 - 2, -size / 2 - 4, 12, 8);
    }

    this.player.setPosition(this.playerX, this.playerY);
  }

  drawDonkeyKong(x: number, y: number): void {
    this.donkeyKong.clear();

    const size = 40;

    // Brown gorilla body
    this.donkeyKong.fillStyle(0x8b4513);
    this.donkeyKong.fillEllipse(0, 0, size, size * 1.2);

    // Chest (tan)
    this.donkeyKong.fillStyle(0xd2691e);
    this.donkeyKong.fillEllipse(0, size / 4, size / 2, size / 2);

    // Head
    this.donkeyKong.fillStyle(0x8b4513);
    this.donkeyKong.fillCircle(0, -size / 2, size / 2);

    // Face (tan)
    this.donkeyKong.fillStyle(0xd2691e);
    this.donkeyKong.fillEllipse(0, -size / 2.5, size / 3, size / 3);

    // Eyes (angry)
    this.donkeyKong.fillStyle(0xffffff);
    this.donkeyKong.fillCircle(-8, -size / 2.5, 6);
    this.donkeyKong.fillCircle(8, -size / 2.5, 6);
    this.donkeyKong.fillStyle(0x000000);
    this.donkeyKong.fillCircle(-8, -size / 2.5, 3);
    this.donkeyKong.fillCircle(8, -size / 2.5, 3);

    // Angry brows
    this.donkeyKong.lineStyle(2, 0x000000);
    this.donkeyKong.lineBetween(-14, -size / 2 - 5, -4, -size / 2);
    this.donkeyKong.lineBetween(14, -size / 2 - 5, 4, -size / 2);

    // Red tie
    this.donkeyKong.fillStyle(0xff0000);
    this.donkeyKong.fillRect(-6, 0, 12, size / 3);
    this.donkeyKong.fillStyle(0xffff00);
    this.donkeyKong.fillRect(-4, size / 6, 8, 3);

    this.donkeyKong.setPosition(x, y);
  }

  drawPrincess(x: number, y: number): void {
    this.princess.clear();

    const size = 24;

    // Pink dress
    this.princess.fillStyle(0xffb6c1);
    this.princess.fillEllipse(0, size / 4, size / 2, size / 1.5);

    // Head (skin)
    this.princess.fillStyle(0xffcc99);
    this.princess.fillCircle(0, -size / 3, size / 3);

    // Crown
    this.princess.fillStyle(0xffd700);
    this.princess.fillRect(-size / 4, -size / 1.8, size / 2, 4);
    this.princess.fillRect(-size / 4, -size / 1.5, 3, 6);
    this.princess.fillRect(0, -size / 1.5, 3, 8);
    this.princess.fillRect(size / 4 - 3, -size / 1.5, 3, 6);

    // Hair (blonde)
    this.princess.fillStyle(0xffd700);
    this.princess.fillEllipse(-size / 4, -size / 4, size / 5, size / 3);
    this.princess.fillEllipse(size / 4, -size / 4, size / 5, size / 3);

    // Eyes
    this.princess.fillStyle(0x000000);
    this.princess.fillCircle(-4, -size / 3, 2);
    this.princess.fillCircle(4, -size / 3, 2);

    // Arms up (help!)
    this.princess.fillStyle(0xffcc99);
    this.princess.fillRect(-size / 3, -size / 6, 3, size / 4);
    this.princess.fillRect(size / 3 - 3, -size / 6, 3, size / 4);

    this.princess.setPosition(x, y);
  }

  drawBarrel(barrel: Barrel): void {
    barrel.graphics.clear();

    const size = 20;

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
    barrel.graphics.lineStyle(2, 0x888888);
    barrel.graphics.strokeEllipse(0, -size / 3, size * 0.9, size * 0.4);
    barrel.graphics.strokeEllipse(0, size / 3, size * 0.9, size * 0.4);

    barrel.graphics.setPosition(barrel.x, barrel.y);
  }

  update(time: number, delta: number): void {
    if (this.gameOver) return;

    const dt = delta / 1000;
    const { width, height } = this.scale;
    const levelIndex = (this.level - 1) % LEVELS.length;
    const levelData = LEVELS[levelIndex];

    // Draw platforms and ladders
    this.graphics.clear();
    for (const platform of this.platforms) {
      // Orange girders with rivets
      this.graphics.fillStyle(0xff6600);
      this.graphics.fillRect(platform.x, platform.y, platform.width, 8);

      // Rivets
      this.graphics.fillStyle(0xffaa00);
      for (let x = platform.x; x < platform.x + platform.width; x += 20) {
        this.graphics.fillCircle(x + 10, platform.y + 4, 3);
      }

      // Shadow
      this.graphics.fillStyle(0xcc5500);
      this.graphics.fillRect(platform.x, platform.y + 4, platform.width, 4);

      // Ladder
      if (platform.hasLadder && platform.ladderX) {
        const ladderX = platform.ladderX;
        this.graphics.fillStyle(0xffff00);

        // Vertical rails
        this.graphics.fillRect(ladderX - 8, platform.y - CONFIG.PLATFORM_HEIGHT, 4, CONFIG.PLATFORM_HEIGHT);
        this.graphics.fillRect(ladderX + 4, platform.y - CONFIG.PLATFORM_HEIGHT, 4, CONFIG.PLATFORM_HEIGHT);

        // Rungs
        for (let y = platform.y - CONFIG.PLATFORM_HEIGHT; y < platform.y; y += 12) {
          this.graphics.fillRect(ladderX - 10, y, 20, 3);
        }
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

      // Horizontal movement on ladder
      if (dir.left) {
        this.playerX -= CONFIG.PLAYER_SPEED * dt * 0.5;
      } else if (dir.right) {
        this.playerX += CONFIG.PLAYER_SPEED * dt * 0.5;
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

    // Hammer pickup (action button near goal)
    const goalPlatform = levelData.goalPlatform;
    const distToGoal = Math.abs(this.playerX - (goalPlatform.x + goalPlatform.width / 2));
    if (this.getAction() && !this.hammer.active && distToGoal < 80 && this.playerY < goalPlatform.y + 20) {
      this.hammer.active = true;
      this.hammer.timer = CONFIG.HAMMER_DURATION;
      this.drawPlayer();
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
      this.spawnBarrel(levelData.barrelSpawnX, levelData.barrelSpawnY);
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

      if (dist < 18) {
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

    // Check win condition (reached princess)
    const distToPrincess = Math.sqrt(
      Math.pow(this.playerX - levelData.princessPosition.x, 2) +
      Math.pow(this.playerY - levelData.princessPosition.y, 2)
    );
    if (distToPrincess < 30) {
      this.levelComplete();
    }
  }

  checkLadder(): void {
    for (const platform of this.platforms) {
      if (!platform.hasLadder || !platform.ladderX) continue;

      const ladderX = platform.ladderX;
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

  spawnBarrel(spawnX: number, spawnY: number): void {
    const barrel = this.add.graphics();

    this.barrels.push({
      graphics: barrel,
      x: spawnX,
      y: spawnY,
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
    this.score += CONFIG.LEVEL_COMPLETE_POINTS;
    this.onScoreUpdate(this.score);

    this.barrels.forEach(b => b.graphics.destroy());
    this.barrels = [];

    const completeText = this.add.text(
      this.scale.width / 2,
      this.scale.height / 2,
      'LEVEL COMPLETE!',
      {
        fontFamily: '"Press Start 2P"',
        fontSize: '24px',
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
      fontSize: '32px',
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
