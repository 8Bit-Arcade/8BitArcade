import * as Phaser from 'phaser';
import { SeededRNG } from '../engine/SeededRNG';

const CONFIG = {
  PLAYER_SPEED: 100,
  JUMP_VELOCITY: -320,
  GRAVITY: 750,
  CLIMB_SPEED: 90,
  BARREL_SPEED: 120,
  BARREL_SPAWN_RATE: 2500,
  FIREBALL_SPEED: 80,
  FIREBALL_SPAWN_RATE: 4000,
  HAMMER_DURATION: 10000,
  ELEVATOR_SPEED: 60,
  CONVEYOR_SPEED: 40,
  SPRING_BOUNCE_VELOCITY: -280,
  LIVES: 3,
  LEVEL_COMPLETE_POINTS: 1000,
  BARREL_DODGE_POINTS: 100,
  HAMMER_SMASH_POINTS: 100,
  RIVET_POINTS: 100,
};

interface Platform {
  x: number;
  y: number;
  width: number;
  color: number;
  hasLadder?: boolean;
  ladderX?: number;
  ladderHeight?: number;
  isConveyor?: boolean;
  conveyorDirection?: number;
}

interface Ladder {
  x: number;
  y: number;
  height: number;
}

interface Barrel {
  graphics: Phaser.GameObjects.Graphics;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rolling: boolean;
}

interface Fireball {
  graphics: Phaser.GameObjects.Graphics;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

interface Rivet {
  x: number;
  y: number;
  removed: boolean;
  graphics: Phaser.GameObjects.Graphics;
}

interface Elevator {
  graphics: Phaser.GameObjects.Graphics;
  x: number;
  y: number;
  minY: number;
  maxY: number;
  speed: number;
  width: number;
  height: number;
}

interface Spring {
  graphics: Phaser.GameObjects.Graphics;
  x: number;
  y: number;
  vx: number;
  vy: number;
  bouncing: boolean;
}

// 4 authentic arcade levels
const LEVELS = [
  // Level 1: 25m - BARRELS (Classic slanted girders)
  {
    name: '25m',
    type: 'barrels' as const,
    platforms: [
      { x: 0, y: 540, width: 640, color: 0xff1493 },
      { x: 60, y: 480, width: 540, color: 0xff1493 },
      { x: 0, y: 420, width: 580, color: 0xff1493 },
      { x: 80, y: 360, width: 520, color: 0xff1493 },
      { x: 0, y: 300, width: 560, color: 0xff1493 },
      { x: 100, y: 240, width: 460, color: 0xff1493 },
      { x: 0, y: 120, width: 640, color: 0xff1493 },
    ],
    ladders: [
      { x: 580, y: 480, height: 60 },
      { x: 70, y: 420, height: 60 },
      { x: 560, y: 360, height: 60 },
      { x: 90, y: 300, height: 60 },
      { x: 540, y: 240, height: 60 },
      { x: 120, y: 120, height: 120 },
    ],
    dkPosition: { x: 80, y: 100 },
    paulinePosition: { x: 320, y: 90 },
    barrelSpawnX: 90,
    barrelSpawnY: 100,
    goalY: 120,
    backgroundColor: 0x000000,
  },

  // Level 2: 50m - CEMENT FACTORY (Conveyor belts)
  {
    name: '50m',
    type: 'factory' as const,
    platforms: [
      { x: 0, y: 540, width: 640, color: 0x4169e1, isConveyor: true, conveyorDirection: 1 },
      { x: 0, y: 460, width: 640, color: 0x4169e1, isConveyor: true, conveyorDirection: -1 },
      { x: 0, y: 380, width: 640, color: 0x4169e1, isConveyor: true, conveyorDirection: 1 },
      { x: 0, y: 300, width: 640, color: 0x4169e1, isConveyor: true, conveyorDirection: -1 },
      { x: 0, y: 220, width: 640, color: 0x4169e1, isConveyor: true, conveyorDirection: 1 },
      { x: 200, y: 140, width: 240, color: 0xff1493 },
    ],
    ladders: [
      { x: 100, y: 460, height: 80 },
      { x: 540, y: 380, height: 80 },
      { x: 100, y: 300, height: 80 },
      { x: 540, y: 220, height: 80 },
      { x: 320, y: 140, height: 80 },
    ],
    dkPosition: { x: 320, y: 120 },
    paulinePosition: { x: 320, y: 110 },
    barrelSpawnX: 330,
    barrelSpawnY: 120,
    goalY: 140,
    backgroundColor: 0x000033,
  },

  // Level 3: 75m - ELEVATORS
  {
    name: '75m',
    type: 'elevators' as const,
    platforms: [
      { x: 0, y: 540, width: 200, color: 0xff1493 },
      { x: 440, y: 540, width: 200, color: 0xff1493 },
      { x: 0, y: 360, width: 200, color: 0xff1493 },
      { x: 440, y: 360, width: 200, color: 0xff1493 },
      { x: 0, y: 180, width: 200, color: 0xff1493 },
      { x: 440, y: 180, width: 200, color: 0xff1493 },
      { x: 200, y: 100, width: 240, color: 0xff1493 },
    ],
    ladders: [
      { x: 180, y: 360, height: 180 },
      { x: 460, y: 360, height: 180 },
      { x: 180, y: 180, height: 180 },
      { x: 460, y: 180, height: 180 },
    ],
    elevators: [
      { x: 220, minY: 360, maxY: 520, speed: CONFIG.ELEVATOR_SPEED, width: 100, height: 12 },
      { x: 320, minY: 360, maxY: 520, speed: -CONFIG.ELEVATOR_SPEED, width: 100, height: 12 },
      { x: 220, minY: 180, maxY: 340, speed: -CONFIG.ELEVATOR_SPEED, width: 100, height: 12 },
      { x: 320, minY: 180, maxY: 340, speed: CONFIG.ELEVATOR_SPEED, width: 100, height: 12 },
    ],
    dkPosition: { x: 320, y: 80 },
    paulinePosition: { x: 320, y: 70 },
    barrelSpawnX: 0,
    barrelSpawnY: 0,
    goalY: 100,
    backgroundColor: 0x1a001a,
  },

  // Level 4: 100m - RIVETS
  {
    name: '100m',
    type: 'rivets' as const,
    platforms: [
      { x: 0, y: 540, width: 640, color: 0xff1493 },
      { x: 0, y: 400, width: 180, color: 0xff1493 },
      { x: 460, y: 400, width: 180, color: 0xff1493 },
      { x: 0, y: 260, width: 180, color: 0xff1493 },
      { x: 460, y: 260, width: 180, color: 0xff1493 },
      { x: 200, y: 180, width: 240, color: 0xff1493 },
    ],
    ladders: [
      { x: 160, y: 400, height: 140 },
      { x: 480, y: 400, height: 140 },
      { x: 160, y: 260, height: 140 },
      { x: 480, y: 260, height: 140 },
      { x: 320, y: 180, height: 80 },
    ],
    rivets: [
      { x: 100, y: 540 },
      { x: 220, y: 540 },
      { x: 340, y: 540 },
      { x: 460, y: 540 },
      { x: 100, y: 180 },
      { x: 220, y: 180 },
      { x: 420, y: 180 },
      { x: 540, y: 180 },
    ],
    dkPosition: { x: 320, y: 160 },
    paulinePosition: { x: 320, y: 150 },
    barrelSpawnX: 0,
    barrelSpawnY: 0,
    goalY: 180,
    backgroundColor: 0x000033,
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
  private levelType: 'barrels' | 'factory' | 'elevators' | 'rivets' = 'barrels';

  private player!: Phaser.GameObjects.Graphics;
  private playerX: number = 50;
  private playerY: number = 500;
  private playerVX: number = 0;
  private playerVY: number = 0;
  private onGround: boolean = false;
  private onLadder: boolean = false;
  private onElevator: Elevator | null = null;

  private platforms: Platform[] = [];
  private ladders: Ladder[] = [];
  private barrels: Barrel[] = [];
  private fireballs: Fireball[] = [];
  private rivets: Rivet[] = [];
  private elevators: Elevator[] = [];
  private springs: Spring[] = [];
  private hammer: { active: boolean; timer: number } = { active: false, timer: 0 };

  private spawnTimer: number = 0;
  private fireballSpawnTimer: number = 0;
  private graphics!: Phaser.GameObjects.Graphics;
  private donkeyKong!: Phaser.GameObjects.Graphics;
  private pauline!: Phaser.GameObjects.Graphics;
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
    this.levelType = levelData.type;

    // Clear previous level
    if (this.graphics) this.graphics.clear();
    this.barrels.forEach(b => b.graphics.destroy());
    this.fireballs.forEach(f => f.graphics.destroy());
    this.rivets.forEach(r => r.graphics.destroy());
    this.elevators.forEach(e => e.graphics.destroy());
    this.springs.forEach(s => s.graphics.destroy());
    this.barrels = [];
    this.fireballs = [];
    this.rivets = [];
    this.elevators = [];
    this.springs = [];
    this.hammer.active = false;

    // Setup level
    this.platforms = levelData.platforms;
    this.ladders = levelData.ladders;

    // Create graphics
    if (!this.graphics) {
      this.graphics = this.add.graphics();
    }

    // Set background
    this.cameras.main.setBackgroundColor(levelData.backgroundColor);

    // Create elevators if elevator level
    if (levelData.type === 'elevators' && levelData.elevators) {
      levelData.elevators.forEach(elevData => {
        const graphics = this.add.graphics();
        this.elevators.push({
          graphics,
          x: elevData.x,
          y: elevData.minY,
          minY: elevData.minY,
          maxY: elevData.maxY,
          speed: elevData.speed,
          width: elevData.width,
          height: elevData.height,
        });
      });
    }

    // Create rivets if rivet level
    if (levelData.type === 'rivets' && levelData.rivets) {
      levelData.rivets.forEach(riv => {
        const graphics = this.add.graphics();
        this.rivets.push({
          x: riv.x,
          y: riv.y,
          removed: false,
          graphics,
        });
      });
    }

    // Create player
    if (!this.player) {
      this.player = this.add.graphics();
    }
    this.playerX = 50;
    this.playerY = 520;
    this.playerVX = 0;
    this.playerVY = 0;
    this.drawPlayer();

    // Create Donkey Kong
    if (!this.donkeyKong) {
      this.donkeyKong = this.add.graphics();
    }
    this.drawDonkeyKong(levelData.dkPosition.x, levelData.dkPosition.y);

    // Create Pauline
    if (!this.pauline) {
      this.pauline = this.add.graphics();
    }
    this.drawPauline(levelData.paulinePosition.x, levelData.paulinePosition.y);

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
      this.levelText = this.add.text(this.scale.width - 16, 16, levelData.name, {
        fontFamily: '"Press Start 2P"',
        fontSize: '12px',
        color: '#ffff00',
      }).setOrigin(1, 0);
    } else {
      this.levelText.setText(levelData.name);
    }

    // Level name announcement
    const levelNameText = this.add.text(
      this.scale.width / 2,
      this.scale.height / 2,
      levelData.name,
      {
        fontFamily: '"Press Start 2P"',
        fontSize: '24px',
        color: '#ffff00',
      }
    ).setOrigin(0.5);

    this.time.delayedCall(1500, () => {
      levelNameText.destroy();
    });
  }

  drawPlayer(): void {
    this.player.clear();

    const size = 20;

    // Mario - red cap, blue overalls, brown shoes
    // Legs
    this.player.fillStyle(0x0000ff);
    this.player.fillRect(-4, size * 0.2, 3, size * 0.4);
    this.player.fillRect(1, size * 0.2, 3, size * 0.4);

    // Brown shoes
    this.player.fillStyle(0x8b4513);
    this.player.fillRect(-5, size * 0.6, 4, 3);
    this.player.fillRect(1, size * 0.6, 4, 3);

    // Body (blue overalls)
    this.player.fillStyle(this.hammer.active ? 0xffff00 : 0x0000ff);
    this.player.fillRect(-5, -size * 0.1, 10, size * 0.3);

    // Arms
    this.player.fillStyle(0xffcc99);
    this.player.fillRect(-8, -size * 0.05, 3, size * 0.25);
    this.player.fillRect(5, -size * 0.05, 3, size * 0.25);

    // Head (skin tone)
    this.player.fillStyle(0xffcc99);
    this.player.fillCircle(0, -size * 0.35, size * 0.25);

    // Red cap
    this.player.fillStyle(0xff0000);
    this.player.fillRect(-size * 0.3, -size * 0.5, size * 0.6, 5);

    // Eyes
    this.player.fillStyle(0x000000);
    this.player.fillRect(-3, -size * 0.35, 2, 2);
    this.player.fillRect(1, -size * 0.35, 2, 2);

    // Mustache
    this.player.fillStyle(0x000000);
    this.player.fillRect(-4, -size * 0.25, 8, 2);

    // Hammer (if active)
    if (this.hammer.active) {
      this.player.fillStyle(0x8b4513);
      this.player.fillRect(8, -size * 0.4, 3, 12);
      this.player.fillStyle(0x696969);
      this.player.fillRect(8, -size * 0.5, 10, 6);
    }

    this.player.setPosition(this.playerX, this.playerY);
  }

  drawDonkeyKong(x: number, y: number): void {
    this.donkeyKong.clear();

    const size = 36;

    // Brown body
    this.donkeyKong.fillStyle(0x8b4513);
    this.donkeyKong.fillRect(-size / 2, -size / 3, size, size * 0.7);

    // Chest (tan)
    this.donkeyKong.fillStyle(0xd2691e);
    this.donkeyKong.fillRect(-size / 4, 0, size / 2, size / 3);

    // Head
    this.donkeyKong.fillStyle(0x8b4513);
    this.donkeyKong.fillCircle(0, -size / 2, size / 3);

    // Face
    this.donkeyKong.fillStyle(0xd2691e);
    this.donkeyKong.fillRect(-size / 5, -size / 2, size * 0.4, size / 3);

    // Eyes (white)
    this.donkeyKong.fillStyle(0xffffff);
    this.donkeyKong.fillCircle(-6, -size / 2, 4);
    this.donkeyKong.fillCircle(6, -size / 2, 4);

    // Pupils (black)
    this.donkeyKong.fillStyle(0x000000);
    this.donkeyKong.fillCircle(-6, -size / 2, 2);
    this.donkeyKong.fillCircle(6, -size / 2, 2);

    // Red tie
    this.donkeyKong.fillStyle(0xff0000);
    this.donkeyKong.fillRect(-4, size / 6, 8, size / 4);

    this.donkeyKong.setPosition(x, y);
  }

  drawPauline(x: number, y: number): void {
    this.pauline.clear();

    const size = 20;

    // Pink dress
    this.pauline.fillStyle(0xffb6c1);
    this.pauline.fillRect(-6, size * 0.1, 12, size * 0.5);

    // Head (skin)
    this.pauline.fillStyle(0xffcc99);
    this.pauline.fillCircle(0, -size * 0.2, size * 0.25);

    // Brown hair
    this.pauline.fillStyle(0x8b4513);
    this.pauline.fillRect(-size * 0.3, -size * 0.35, size * 0.6, size * 0.2);

    // Eyes
    this.pauline.fillStyle(0x000000);
    this.pauline.fillRect(-3, -size * 0.2, 2, 2);
    this.pauline.fillRect(1, -size * 0.2, 2, 2);

    // Arms up (HELP!)
    this.pauline.fillStyle(0xffcc99);
    this.pauline.fillRect(-8, -size * 0.1, 3, size * 0.2);
    this.pauline.fillRect(5, -size * 0.1, 3, size * 0.2);

    this.pauline.setPosition(x, y);
  }

  drawBarrel(barrel: Barrel): void {
    barrel.graphics.clear();

    const size = 16;

    // Brown barrel
    barrel.graphics.fillStyle(0x8b4513);
    barrel.graphics.fillRect(-size / 2, -size / 2, size, size);

    // Darker bands
    barrel.graphics.fillStyle(0x654321);
    barrel.graphics.fillRect(-size / 2, -size / 3, size, 2);
    barrel.graphics.fillRect(-size / 2, size / 3, size, 2);

    // Highlight
    barrel.graphics.fillStyle(0xaa7744);
    barrel.graphics.fillRect(-size / 3, -size / 3, size / 4, size / 4);

    barrel.graphics.setPosition(barrel.x, barrel.y);
  }

  drawFireball(fireball: Fireball): void {
    fireball.graphics.clear();

    const size = 12;

    // Orange/yellow fireball
    fireball.graphics.fillStyle(0xff6600);
    fireball.graphics.fillCircle(0, 0, size / 2);

    // Yellow center
    fireball.graphics.fillStyle(0xffff00);
    fireball.graphics.fillCircle(0, 0, size / 4);

    fireball.graphics.setPosition(fireball.x, fireball.y);
  }

  drawRivet(rivet: Rivet): void {
    if (rivet.removed) return;

    rivet.graphics.clear();

    // Yellow rivet
    rivet.graphics.fillStyle(0xffff00);
    rivet.graphics.fillCircle(0, 0, 6);

    // Dark center
    rivet.graphics.fillStyle(0x000000);
    rivet.graphics.fillCircle(0, 0, 2);

    rivet.graphics.setPosition(rivet.x, rivet.y);
  }

  drawElevator(elevator: Elevator): void {
    elevator.graphics.clear();

    // Blue platform
    elevator.graphics.fillStyle(0x4169e1);
    elevator.graphics.fillRect(0, 0, elevator.width, elevator.height);

    // Border
    elevator.graphics.lineStyle(2, 0xffffff);
    elevator.graphics.strokeRect(0, 0, elevator.width, elevator.height);

    elevator.graphics.setPosition(elevator.x, elevator.y);
  }

  update(time: number, delta: number): void {
    if (this.gameOver) return;

    const dt = delta / 1000;
    const { width, height } = this.scale;
    const levelIndex = (this.level - 1) % LEVELS.length;
    const levelData = LEVELS[levelIndex];

    // Draw static elements
    this.drawScene();

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

      // Conveyor belt effect
      if (this.onGround) {
        for (const platform of this.platforms) {
          if (
            platform.isConveyor &&
            this.playerX > platform.x &&
            this.playerX < platform.x + platform.width &&
            Math.abs(this.playerY - platform.y) < 5
          ) {
            this.playerVX += platform.conveyorDirection! * CONFIG.CONVEYOR_SPEED;
          }
        }
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
    this.onElevator = null;

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

    // Elevator collision
    for (const elevator of this.elevators) {
      if (
        this.playerX > elevator.x &&
        this.playerX < elevator.x + elevator.width &&
        this.playerY >= elevator.y - 5 &&
        this.playerY <= elevator.y + elevator.height + 5 &&
        this.playerVY >= 0
      ) {
        this.playerY = elevator.y;
        this.playerVY = 0;
        this.onGround = true;
        this.onElevator = elevator;
        break;
      }
    }

    // Move with elevator
    if (this.onElevator) {
      this.playerY += this.onElevator.speed * dt;
    }

    this.drawPlayer();

    // Hammer pickup (action button)
    if (this.getAction() && !this.hammer.active && this.playerY < 200) {
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

    // Level-specific updates
    if (levelData.type === 'barrels' || levelData.type === 'factory') {
      this.updateBarrelLevel(delta, dt, levelData);
    } else if (levelData.type === 'elevators') {
      this.updateElevatorLevel(delta, dt, levelData);
    } else if (levelData.type === 'rivets') {
      this.updateRivetLevel(delta, dt, levelData);
    }

    // Update fireballs (all levels)
    this.updateFireballs(dt);

    // Update elevators
    for (const elevator of this.elevators) {
      elevator.y += elevator.speed * dt;
      if (elevator.y <= elevator.minY || elevator.y >= elevator.maxY) {
        elevator.speed = -elevator.speed;
      }
      this.drawElevator(elevator);
    }

    // Check win condition
    if (this.playerY <= levelData.goalY + 10 && Math.abs(this.playerX - levelData.paulinePosition.x) < 60) {
      this.levelComplete();
    }
  }

  updateBarrelLevel(delta: number, dt: number, levelData: any): void {
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
          barrel.y = platform.y - 8;
          barrel.vy = 0;
          barrel.rolling = true;

          // Roll direction based on platform slope
          if (barrel.vx === 0) {
            barrel.vx = CONFIG.BARREL_SPEED;
          }
        }
      }

      // Fall off platform edges
      if (barrel.rolling) {
        let onPlatform = false;
        for (const platform of this.platforms) {
          if (
            barrel.x > platform.x &&
            barrel.x < platform.x + platform.width &&
            Math.abs(barrel.y - platform.y + 8) < 5
          ) {
            onPlatform = true;
            break;
          }
        }

        if (!onPlatform && this.rng.next() < 0.03) {
          barrel.rolling = false;
          barrel.vy = 50;
        }
      }

      this.drawBarrel(barrel);

      // Remove off-screen
      if (barrel.y > this.scale.height || barrel.x < -20 || barrel.x > this.scale.width + 20) {
        barrel.graphics.destroy();
        this.barrels.splice(i, 1);
        continue;
      }

      // Check collision with player
      const dist = Math.sqrt(
        Math.pow(barrel.x - this.playerX, 2) + Math.pow(barrel.y - this.playerY, 2)
      );

      if (dist < 16) {
        if (this.hammer.active) {
          barrel.graphics.destroy();
          this.barrels.splice(i, 1);
          this.score += CONFIG.HAMMER_SMASH_POINTS;
          this.onScoreUpdate(this.score);
        } else {
          this.loseLife();
          return;
        }
      }
    }
  }

  updateElevatorLevel(delta: number, dt: number, levelData: any): void {
    // Spawn springs
    if (this.springs.length < 3 && this.rng.next() < 0.002) {
      this.spawnSpring();
    }

    // Update springs
    for (let i = this.springs.length - 1; i >= 0; i--) {
      const spring = this.springs[i];

      spring.x += spring.vx * dt;
      spring.y += spring.vy * dt;

      spring.vy += CONFIG.GRAVITY * dt;

      // Platform collision
      for (const platform of this.platforms) {
        if (
          spring.x > platform.x &&
          spring.x < platform.x + platform.width &&
          spring.y >= platform.y - 12 &&
          spring.y <= platform.y + 5 &&
          spring.vy > 0
        ) {
          spring.y = platform.y - 10;
          spring.vy = CONFIG.SPRING_BOUNCE_VELOCITY;
        }
      }

      this.drawSpring(spring);

      // Remove off-screen
      if (spring.y > this.scale.height) {
        spring.graphics.destroy();
        this.springs.splice(i, 1);
        continue;
      }

      // Check collision with player
      const dist = Math.sqrt(
        Math.pow(spring.x - this.playerX, 2) + Math.pow(spring.y - this.playerY, 2)
      );

      if (dist < 16) {
        this.loseLife();
        return;
      }
    }
  }

  updateRivetLevel(delta: number, dt: number, levelData: any): void {
    // Check rivet collection
    for (const rivet of this.rivets) {
      if (!rivet.removed) {
        const dist = Math.sqrt(
          Math.pow(rivet.x - this.playerX, 2) + Math.pow(rivet.y - this.playerY, 2)
        );

        if (dist < 20) {
          rivet.removed = true;
          rivet.graphics.destroy();
          this.score += CONFIG.RIVET_POINTS;
          this.onScoreUpdate(this.score);
        }
      }
    }

    // Check if all rivets removed
    if (this.rivets.every(r => r.removed)) {
      this.levelComplete();
    }
  }

  updateFireballs(dt: number): void {
    this.fireballSpawnTimer += dt * 1000;
    if (this.fireballSpawnTimer > CONFIG.FIREBALL_SPAWN_RATE && this.fireballs.length < 4) {
      this.fireballSpawnTimer = 0;
      this.spawnFireball();
    }

    for (let i = this.fireballs.length - 1; i >= 0; i--) {
      const fireball = this.fireballs[i];

      fireball.x += fireball.vx * dt;
      fireball.y += fireball.vy * dt;

      fireball.vy += CONFIG.GRAVITY * 0.3 * dt;

      // Platform collision
      for (const platform of this.platforms) {
        if (
          fireball.x > platform.x &&
          fireball.x < platform.x + platform.width &&
          fireball.y >= platform.y - 10 &&
          fireball.y <= platform.y + 5 &&
          fireball.vy > 0
        ) {
          fireball.y = platform.y - 6;
          fireball.vy = -100;

          // Change direction randomly
          if (this.rng.next() > 0.5) {
            fireball.vx = -fireball.vx;
          }
        }
      }

      this.drawFireball(fireball);

      // Remove off-screen
      if (fireball.y > this.scale.height || fireball.x < -20 || fireball.x > this.scale.width + 20) {
        fireball.graphics.destroy();
        this.fireballs.splice(i, 1);
        continue;
      }

      // Check collision with player
      const dist = Math.sqrt(
        Math.pow(fireball.x - this.playerX, 2) + Math.pow(fireball.y - this.playerY, 2)
      );

      if (dist < 14) {
        if (this.hammer.active) {
          fireball.graphics.destroy();
          this.fireballs.splice(i, 1);
          this.score += CONFIG.HAMMER_SMASH_POINTS;
          this.onScoreUpdate(this.score);
        } else {
          this.loseLife();
          return;
        }
      }
    }
  }

  drawScene(): void {
    this.graphics.clear();

    // Draw platforms
    for (const platform of this.platforms) {
      // Girder with rivets
      this.graphics.fillStyle(platform.color);
      this.graphics.fillRect(platform.x, platform.y, platform.width, 8);

      // Rivets on girders
      this.graphics.fillStyle(0xffff00);
      for (let x = platform.x + 15; x < platform.x + platform.width; x += 20) {
        this.graphics.fillCircle(x, platform.y + 4, 2);
      }

      // Conveyor belt lines
      if (platform.isConveyor) {
        this.graphics.lineStyle(1, 0xffffff);
        for (let x = platform.x; x < platform.x + platform.width; x += 12) {
          this.graphics.lineBetween(x, platform.y + 2, x + 8, platform.y + 2);
        }
      }
    }

    // Draw ladders
    for (const ladder of this.ladders) {
      this.graphics.fillStyle(0xffff00);

      // Rails
      this.graphics.fillRect(ladder.x - 6, ladder.y, 3, ladder.height);
      this.graphics.fillRect(ladder.x + 3, ladder.y, 3, ladder.height);

      // Rungs
      for (let y = ladder.y; y < ladder.y + ladder.height; y += 10) {
        this.graphics.fillRect(ladder.x - 8, y, 16, 2);
      }
    }

    // Draw rivets
    for (const rivet of this.rivets) {
      this.drawRivet(rivet);
    }
  }

  checkLadder(): void {
    for (const ladder of this.ladders) {
      if (
        Math.abs(this.playerX - ladder.x) < 12 &&
        this.playerY > ladder.y - 10 &&
        this.playerY < ladder.y + ladder.height + 10
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

  spawnFireball(): void {
    const fireball = this.add.graphics();

    this.fireballs.push({
      graphics: fireball,
      x: 50 + this.rng.next() * 540,
      y: 100,
      vx: (this.rng.next() - 0.5) * CONFIG.FIREBALL_SPEED * 2,
      vy: 0,
    });

    this.drawFireball(this.fireballs[this.fireballs.length - 1]);
  }

  spawnSpring(): void {
    const spring = this.add.graphics();

    this.springs.push({
      graphics: spring,
      x: 100 + this.rng.next() * 440,
      y: 100,
      vx: (this.rng.next() - 0.5) * 80,
      vy: 0,
      bouncing: true,
    });
  }

  drawSpring(spring: Spring): void {
    spring.graphics.clear();

    // Spring coil
    spring.graphics.lineStyle(3, 0xffffff);
    for (let i = 0; i < 5; i++) {
      spring.graphics.arc(0, i * 3, 4, 0, Math.PI, i % 2 === 0);
    }

    spring.graphics.setPosition(spring.x, spring.y);
  }

  loseLife(): void {
    this.lives--;
    this.livesText.setText(`LIVES: ${this.lives}`);

    if (this.lives <= 0) {
      this.endGame();
    } else {
      this.playerX = 50;
      this.playerY = 520;
      this.playerVX = 0;
      this.playerVY = 0;
      this.hammer.active = false;
      this.barrels.forEach(b => b.graphics.destroy());
      this.fireballs.forEach(f => f.graphics.destroy());
      this.springs.forEach(s => s.graphics.destroy());
      this.barrels = [];
      this.fireballs = [];
      this.springs = [];
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
    this.fireballs.forEach(f => f.graphics.destroy());
    this.springs.forEach(s => s.graphics.destroy());
    this.barrels = [];
    this.fireballs = [];
    this.springs = [];

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
      fontSize: '28px',
      color: '#ff0000',
    }).setOrigin(0.5);

    this.add.text(
      this.scale.width / 2,
      this.scale.height / 2 + 20,
      `FINAL SCORE: ${this.score}`,
      {
        fontFamily: '"Press Start 2P"',
        fontSize: '14px',
        color: '#ffffff',
      }
    ).setOrigin(0.5);

    this.time.delayedCall(3000, () => {
      this.onGameOver(this.score);
    });
  }
}
