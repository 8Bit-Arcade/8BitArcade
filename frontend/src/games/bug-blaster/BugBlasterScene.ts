import * as Phaser from 'phaser';
import { SeededRNG } from '../engine/SeededRNG';
import { RetroSounds } from '../engine/RetroSounds';

const CONFIG = {
  GRID_SIZE: 20,
  PLAYER_SPEED: 200,
  BULLET_SPEED: 400,
  FIRE_RATE: 100,
  CENTIPEDE_SPEED: 60,
  SPIDER_SPEED: 100,
  MUSHROOM_HP: 4,
  SEGMENT_POINTS: 100,
  MUSHROOM_POINTS: 1,
  SPIDER_POINTS: 600,
  LIVES: 3,
};

interface Segment {
  graphics: Phaser.GameObjects.Graphics;
  x: number;
  y: number;
  dir: number; // -1 left, 1 right
}

interface Mushroom {
  graphics: Phaser.GameObjects.Graphics;
  x: number;
  y: number;
  hp: number;
}

export class BugBlasterScene extends Phaser.Scene {
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
  private playerX: number = 400;
  private playerY: number = 560;
  private lastFired: number = 0;

  private centipedeSegments: Segment[] = [];
  private bullets: Array<{ graphics: Phaser.GameObjects.Graphics; x: number; y: number }> = [];
  private mushrooms: Mushroom[] = [];
  private spider: { graphics: Phaser.GameObjects.Graphics; x: number; y: number; vx: number; vy: number } | null = null;

  private moveTimer: number = 0;
  private spiderTimer: number = 0;

  private livesText!: Phaser.GameObjects.Text;
  private levelText!: Phaser.GameObjects.Text;

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
    super({ key: 'BugBlasterScene' });
    this.onScoreUpdate = onScoreUpdate;
    this.onGameOver = onGameOver;
    this.getDirection = getDirection;
    this.getAction = getAction;
    this.rng = new SeededRNG(seed);
    this.soundEnabled = soundEnabled;

    if (this.soundEnabled) {
      try {
        this.sounds = new RetroSounds(soundVolume);
        this.sounds.registerSound('shoot', this.sounds.generateLaser(800, 200, 0.08));
        this.sounds.registerSound('killSegment', this.sounds.generateExplosion(0.15));
        this.sounds.registerSound('killSpider', this.sounds.generateExplosion(0.25));
        this.sounds.registerSound('hit', this.sounds.generateHit());
        this.sounds.registerSound('nextLevel', this.sounds.generatePowerUp());
        this.sounds.registerSound('gameOver', this.sounds.generateGameOver());
      } catch (e) {
        console.warn('Failed to initialize audio:', e);
        this.sounds = null;
      }
    }
  }

  create(): void {
    const { width, height } = this.scale;

    this.events.on('shutdown', this.onShutdown, this);

    // Create player
    this.player = this.add.graphics();
    this.drawPlayer();

    // Create mushrooms
    this.spawnMushrooms(30);

    // Create centipede
    this.spawnCentipede(12 + this.level * 2);

    // UI
    this.livesText = this.add.text(16, height - 30, `LIVES: ${this.lives}`, {
      fontFamily: '"Press Start 2P"',
      fontSize: '12px',
      color: '#00ff41',
    });

    this.levelText = this.add.text(width - 16, height - 30, `LEVEL ${this.level}`, {
      fontFamily: '"Press Start 2P"',
      fontSize: '12px',
      color: '#00f5ff',
    }).setOrigin(1, 0);
  }

  drawPlayer(): void {
    this.player.clear();

    // Base - wider, more substantial
    this.player.fillStyle(0x00d5ff);
    this.player.fillRect(-10, -4, 20, 8);

    // Base shadow/depth
    this.player.fillStyle(0x0080a0);
    this.player.fillRect(-10, 2, 20, 2);

    // Cannon barrel
    this.player.fillStyle(0x00ff41);
    this.player.fillRect(-4, -12, 8, 12);

    // Barrel highlight
    this.player.fillStyle(0x80ff90);
    this.player.fillRect(-3, -12, 2, 10);

    // Cannon tip
    this.player.fillStyle(0xffff00);
    this.player.fillRect(-3, -13, 6, 2);

    this.player.setPosition(this.playerX, this.playerY);
  }

  spawnMushrooms(count: number): void {
    const { width } = this.scale;
    const gridWidth = Math.floor(width / CONFIG.GRID_SIZE);

    for (let i = 0; i < count; i++) {
      const gridX = Math.floor(this.rng.nextFloat(0, gridWidth));
      const gridY = Math.floor(this.rng.nextFloat(2, 25));

      // Check if space is free
      const exists = this.mushrooms.some(
        m => Math.abs(m.x - gridX * CONFIG.GRID_SIZE) < CONFIG.GRID_SIZE &&
             Math.abs(m.y - gridY * CONFIG.GRID_SIZE) < CONFIG.GRID_SIZE
      );

      if (!exists) {
        const mushroom = this.add.graphics();
        this.mushrooms.push({
          graphics: mushroom,
          x: gridX * CONFIG.GRID_SIZE + CONFIG.GRID_SIZE / 2,
          y: gridY * CONFIG.GRID_SIZE + CONFIG.GRID_SIZE / 2,
          hp: CONFIG.MUSHROOM_HP,
        });
        this.drawMushroom(this.mushrooms[this.mushrooms.length - 1]);
      }
    }
  }

  drawMushroom(mushroom: Mushroom): void {
    mushroom.graphics.clear();
    const alpha = mushroom.hp / CONFIG.MUSHROOM_HP;

    // Stem
    mushroom.graphics.fillStyle(0xffeecc, alpha);
    mushroom.graphics.fillRect(-3, -2, 6, 8);

    // Stem shadow
    mushroom.graphics.fillStyle(0xccaa88, alpha * 0.8);
    mushroom.graphics.fillRect(1, -2, 2, 8);

    // Mushroom cap - larger and rounder
    mushroom.graphics.fillStyle(0xff4444, alpha);
    mushroom.graphics.fillCircle(0, -4, 9);

    // Cap spots based on HP
    if (mushroom.hp >= 3) {
      mushroom.graphics.fillStyle(0xffaaaa, alpha);
      mushroom.graphics.fillCircle(-4, -5, 2);
      mushroom.graphics.fillCircle(4, -4, 2);
    }
    if (mushroom.hp >= 2) {
      mushroom.graphics.fillCircle(0, -7, 2);
    }
    if (mushroom.hp >= 4) {
      mushroom.graphics.fillCircle(-2, -3, 2);
      mushroom.graphics.fillCircle(3, -6, 1.5);
    }

    // Cap highlight
    mushroom.graphics.fillStyle(0xff8888, alpha);
    mushroom.graphics.fillCircle(-2, -8, 3);

    mushroom.graphics.setPosition(mushroom.x, mushroom.y);
  }

  spawnCentipede(length: number): void {
    const { width } = this.scale;

    for (let i = 0; i < length; i++) {
      const segment = this.add.graphics();
      this.centipedeSegments.push({
        graphics: segment,
        x: width / 2 + i * CONFIG.GRID_SIZE + CONFIG.GRID_SIZE / 2,
        y: CONFIG.GRID_SIZE + CONFIG.GRID_SIZE / 2,
        dir: 1,
      });
      this.drawSegment(this.centipedeSegments[i]);
    }
  }

  drawSegment(segment: Segment): void {
    segment.graphics.clear();

    // Main body - gradient effect with multiple circles
    segment.graphics.fillStyle(0x00ffaa);
    segment.graphics.fillCircle(0, 0, 9);

    // Body shading segments
    segment.graphics.fillStyle(0x00cc88);
    segment.graphics.fillCircle(-2, 1, 8);
    segment.graphics.fillCircle(2, 1, 8);

    // Bright highlights
    segment.graphics.fillStyle(0x66ffcc);
    segment.graphics.fillCircle(-3, -2, 4);
    segment.graphics.fillCircle(3, -2, 4);

    // Center segment line
    segment.graphics.fillStyle(0x008866);
    segment.graphics.fillRect(-8, 0, 16, 2);

    // Eyes/antennae
    segment.graphics.fillStyle(0xffff00);
    segment.graphics.fillCircle(-4, -3, 2);
    segment.graphics.fillCircle(4, -3, 2);

    // Eye pupils
    segment.graphics.fillStyle(0xff0000);
    segment.graphics.fillCircle(-4, -3, 1);
    segment.graphics.fillCircle(4, -3, 1);

    segment.graphics.setPosition(segment.x, segment.y);
  }

  update(time: number, delta: number): void {
    if (this.gameOver) return;

    const dt = delta / 1000;
    const { width, height } = this.scale;

    // Player movement
    const dir = this.getDirection();
    if (dir.left) {
      this.playerX = Math.max(10, this.playerX - CONFIG.PLAYER_SPEED * dt);
    }
    if (dir.right) {
      this.playerX = Math.min(width - 10, this.playerX + CONFIG.PLAYER_SPEED * dt);
    }
    if (dir.up) {
      this.playerY = Math.max(height - 120, this.playerY - CONFIG.PLAYER_SPEED * dt);
    }
    if (dir.down) {
      this.playerY = Math.min(height - 20, this.playerY + CONFIG.PLAYER_SPEED * dt);
    }
    this.drawPlayer();

    // Fire bullets
    if (this.getAction() && time - this.lastFired > CONFIG.FIRE_RATE) {
      this.fireBullet();
      this.lastFired = time;
    }

    // Update bullets
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const bullet = this.bullets[i];
      bullet.y -= CONFIG.BULLET_SPEED * dt;
      bullet.graphics.setPosition(bullet.x, bullet.y);

      if (bullet.y < 0) {
        bullet.graphics.destroy();
        this.bullets.splice(i, 1);
      }
    }

    // Move centipede
    this.moveTimer += delta;
    if (this.moveTimer > 100) {
      this.moveTimer = 0;
      this.moveCentipede();
    }

    // Spawn/update spider
    this.spiderTimer += delta;
    if (!this.spider && this.spiderTimer > 5000) {
      this.spiderTimer = 0;
      this.spawnSpider();
    }

    if (this.spider) {
      this.spider.x += this.spider.vx * dt;
      this.spider.y += this.spider.vy * dt;

      // Bounce at edges (exclude spawn zones to prevent immediate bounce)
      if (this.spider.x < 30) {
        this.spider.x = 30;
        this.spider.vx = Math.abs(this.spider.vx); // Force moving right
      } else if (this.spider.x > width - 30) {
        this.spider.x = width - 30;
        this.spider.vx = -Math.abs(this.spider.vx); // Force moving left
      }

      if (this.spider.y < height - 150 || this.spider.y > height - 50) {
        this.spider.vy *= -1;
      }

      this.spider.graphics.setPosition(this.spider.x, this.spider.y);

      // Remove if off screen
      if (this.spider.x < -20 || this.spider.x > width + 20) {
        this.spider.graphics.destroy();
        this.spider = null;
      }

      // Check player collision
      if (this.spider) {
        const dist = Math.sqrt(
          Math.pow(this.spider.x - this.playerX, 2) +
          Math.pow(this.spider.y - this.playerY, 2)
        );
        if (dist < 20) { // Increased to match spider size with legs
          this.loseLife();
          return;
        }
      }
    }

    // Check collisions
    this.checkCollisions();

    // Check win
    if (this.centipedeSegments.length === 0) {
      this.levelComplete();
    }
  }

  fireBullet(): void {
    if (this.sounds && this.soundEnabled) {
      this.sounds.play('shoot');
    }

    const bullet = this.add.graphics();

    // Outer glow
    bullet.fillStyle(0x00ff41, 0.3);
    bullet.fillRect(-3, -8, 6, 8);

    // Main bullet body
    bullet.fillStyle(0x00ff41);
    bullet.fillRect(-2, -7, 4, 7);

    // Bright core
    bullet.fillStyle(0xffffff);
    bullet.fillRect(-1, -6, 2, 5);

    // Tip
    bullet.fillStyle(0xffff00);
    bullet.fillRect(-1.5, -8, 3, 2);

    this.bullets.push({
      graphics: bullet,
      x: this.playerX,
      y: this.playerY - 10,
    });
  }

  moveCentipede(): void {
    for (let i = 0; i < this.centipedeSegments.length; i++) {
      const segment = this.centipedeSegments[i];

      // Move in current direction
      segment.x += segment.dir * CONFIG.GRID_SIZE;

      // Check for mushrooms or edge
      const hitMushroom = this.mushrooms.some(
        m => Math.abs(m.x - segment.x) < CONFIG.GRID_SIZE / 2 &&
             Math.abs(m.y - segment.y) < CONFIG.GRID_SIZE / 2
      );

      if (segment.x < CONFIG.GRID_SIZE || segment.x > this.scale.width - CONFIG.GRID_SIZE || hitMushroom) {
        segment.dir *= -1;
        segment.y += CONFIG.GRID_SIZE;

        // Game over if reaches bottom
        if (segment.y > this.scale.height - 140) {
          this.loseLife();
          return;
        }
      }

      this.drawSegment(segment);
    }
  }

  spawnSpider(): void {
    const spider = this.add.graphics();

    // Draw 8 legs with joints
    spider.fillStyle(0xcc0030);
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const legX = Math.cos(angle) * 12;
      const legY = Math.sin(angle) * 12;

      // Leg segments
      spider.fillRect(legX * 0.3, legY * 0.3, 2, 8);
      spider.fillCircle(legX, legY, 2);

      // Inner leg joint
      spider.fillCircle(legX * 0.6, legY * 0.6, 2.5);
    }

    // Main body - large
    spider.fillStyle(0xff0040);
    spider.fillCircle(0, 0, 8);

    // Body segments/texture
    spider.fillStyle(0xff4466);
    spider.fillCircle(0, -2, 6);
    spider.fillCircle(0, 2, 5);

    // Head
    spider.fillStyle(0xcc0030);
    spider.fillCircle(0, -6, 4);

    // Eyes
    spider.fillStyle(0xffff00);
    spider.fillCircle(-2, -6, 1.5);
    spider.fillCircle(2, -6, 1.5);

    const spawnLeft = this.rng.next() > 0.5;
    this.spider = {
      graphics: spider,
      x: spawnLeft ? 20 : this.scale.width - 20, // Spawn slightly inside to avoid immediate bounce
      y: this.scale.height - 100,
      vx: spawnLeft ? CONFIG.SPIDER_SPEED : -CONFIG.SPIDER_SPEED, // Always move toward center
      vy: this.rng.nextFloat(-50, 50),
    };
  }

  checkCollisions(): void {
    // Bullet-segment collisions
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const bullet = this.bullets[i];
      let bulletDestroyed = false;

      // Check segments
      for (let j = this.centipedeSegments.length - 1; j >= 0; j--) {
        const segment = this.centipedeSegments[j];
        const dist = Math.sqrt(
          Math.pow(bullet.x - segment.x, 2) + Math.pow(bullet.y - segment.y, 2)
        );

        if (dist < 10) {
          // Hit!
          bullet.graphics.destroy();
          this.bullets.splice(i, 1);
          bulletDestroyed = true;

          segment.graphics.destroy();
          this.centipedeSegments.splice(j, 1);

          if (this.sounds && this.soundEnabled) {
            this.sounds.play('killSegment');
          }

          this.score += CONFIG.SEGMENT_POINTS;
          this.onScoreUpdate(this.score);

          // Create mushroom where segment was - snap to grid center
          const mushroom = this.add.graphics();
          const gridX = Math.round(segment.x / CONFIG.GRID_SIZE);
          const gridY = Math.round(segment.y / CONFIG.GRID_SIZE);
          this.mushrooms.push({
            graphics: mushroom,
            x: gridX * CONFIG.GRID_SIZE + CONFIG.GRID_SIZE / 2,
            y: gridY * CONFIG.GRID_SIZE + CONFIG.GRID_SIZE / 2,
            hp: CONFIG.MUSHROOM_HP,
          });
          this.drawMushroom(this.mushrooms[this.mushrooms.length - 1]);

          break;
        }
      }

      // Skip further checks if bullet was already destroyed
      if (bulletDestroyed) continue;

      // Check mushrooms
      for (const mushroom of this.mushrooms) {
        const dist = Math.sqrt(
          Math.pow(bullet.x - mushroom.x, 2) + Math.pow(bullet.y - mushroom.y, 2)
        );

        if (dist < 10) {
          bullet.graphics.destroy();
          this.bullets.splice(i, 1);
          bulletDestroyed = true;

          mushroom.hp--;
          if (mushroom.hp <= 0) {
            mushroom.graphics.destroy();
            const idx = this.mushrooms.indexOf(mushroom);
            this.mushrooms.splice(idx, 1);
            this.score += CONFIG.MUSHROOM_POINTS;
            this.onScoreUpdate(this.score);
          } else {
            this.drawMushroom(mushroom);
          }
          break;
        }
      }

      // Skip further checks if bullet was already destroyed
      if (bulletDestroyed) continue;

      // Check spider
      if (this.spider) {
        const dist = Math.sqrt(
          Math.pow(bullet.x - this.spider.x, 2) + Math.pow(bullet.y - this.spider.y, 2)
        );

        if (dist < 20) { // Increased from 15 to match larger spider graphics with legs
          bullet.graphics.destroy();
          this.bullets.splice(i, 1);
          this.spider.graphics.destroy();
          this.spider = null;
          this.spiderTimer = 0; // Reset timer to prevent instant respawn

          if (this.sounds && this.soundEnabled) {
            this.sounds.play('killSpider');
          }

          this.score += CONFIG.SPIDER_POINTS;
          this.onScoreUpdate(this.score);
        }
      }
    }

    // Player-segment collision
    for (const segment of this.centipedeSegments) {
      const dist = Math.sqrt(
        Math.pow(segment.x - this.playerX, 2) + Math.pow(segment.y - this.playerY, 2)
      );

      if (dist < 15) {
        this.loseLife();
        return;
      }
    }
  }

  loseLife(): void {
    this.lives--;
    if (this.sounds && this.soundEnabled) {
      this.sounds.play('hit');
    }
    this.livesText.setText(`LIVES: ${this.lives}`);

    if (this.lives <= 0) {
      this.endGame();
    } else {
      this.playerX = this.scale.width / 2;
      this.playerY = this.scale.height - 50;
      this.centipedeSegments.forEach(s => {
        s.x = this.scale.width / 2 + CONFIG.GRID_SIZE / 2;
        s.y = CONFIG.GRID_SIZE + CONFIG.GRID_SIZE / 2;
      });
    }
  }

  levelComplete(): void {
    this.level++;
    this.levelText.setText(`LEVEL ${this.level}`);

    if (this.sounds && this.soundEnabled) {
      this.sounds.play('nextLevel');
    }

    this.score += 1000;
    this.onScoreUpdate(this.score);

    this.mushrooms = this.mushrooms.filter(m => {
      if (m.hp < CONFIG.MUSHROOM_HP) {
        m.hp = CONFIG.MUSHROOM_HP;
        this.drawMushroom(m);
        return true;
      }
      return true;
    });

    this.spawnCentipede(12 + this.level * 2);
  }

  endGame(): void {
    this.gameOver = true;
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
