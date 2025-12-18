import * as Phaser from 'phaser';
import { SeededRNG } from '../engine/SeededRNG';
import { RetroSounds } from '../engine/RetroSounds';

const CONFIG = {
  PLAYER_SPEED: 300,
  BULLET_SPEED: 500,
  FIRE_RATE: 300,
  ALIEN_ROWS: 5,
  ALIEN_COLS: 11,
  ALIEN_WIDTH: 40,
  ALIEN_HEIGHT: 30,
  ALIEN_SPACING: 50,
  ALIEN_SPEED_START: 30,
  ALIEN_SPEED_INCREASE: 5,
  ALIEN_SPEED_PER_WAVE: 15, // Speed increase per wave
  ALIEN_DROP: 20,
  ALIEN_FIRE_RATE: 2000,
  ALIEN_FIRE_RATE_PER_WAVE: 150, // Fire rate increases per wave
  ALIEN_FIRE_RATE_MIN: 600, // Minimum fire rate (fastest)
  ALIEN_BULLET_SPEED: 200,
  ALIEN_BULLET_SPEED_PER_WAVE: 20, // Bullet speed increase per wave
  ALIEN_POINTS: [30, 20, 20, 10, 10],
  LIVES: 3,
};

interface Alien {
  graphics: Phaser.GameObjects.Graphics;
  row: number;
  active: boolean;
}

export class AlienAssaultScene extends Phaser.Scene {
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
  private bullets!: Phaser.GameObjects.Group;
  private alienBullets!: Phaser.GameObjects.Group;
  private aliens: Alien[] = [];

  private alienDirection: number = 1;
  private alienSpeed: number = CONFIG.ALIEN_SPEED_START;
  private alienFireRate: number = CONFIG.ALIEN_FIRE_RATE;
  private alienBulletSpeed: number = CONFIG.ALIEN_BULLET_SPEED;
  private lastFired: number = 0;
  private lastAlienFired: number = 0;

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
    super({ key: 'AlienAssaultScene' });
    this.onScoreUpdate = onScoreUpdate;
    this.onGameOver = onGameOver;
    this.getDirection = getDirection;
    this.getAction = getAction;
    this.rng = new SeededRNG(seed);
    this.soundEnabled = soundEnabled;

    if (this.soundEnabled) {
      try {
        this.sounds = new RetroSounds(soundVolume);
        this.sounds.registerSound('shoot', this.sounds.generateLaser());
        this.sounds.registerSound('alienKill', this.sounds.generateExplosion(0.2));
        this.sounds.registerSound('playerHit', this.sounds.generateExplosion(0.5));
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
    this.player.setPosition(width / 2, height - 50);
    this.player.setDepth(1); // Player renders above aliens

    // Groups
    this.bullets = this.add.group();
    this.alienBullets = this.add.group();

    // Create aliens
    this.createAliens();

    // UI
    this.livesText = this.add.text(16, 16, `LIVES: ${this.lives}`, {
      fontFamily: '"Press Start 2P"',
      fontSize: '12px',
      color: '#00ff41',
    });
    this.livesText.setDepth(2); // UI renders on top

    this.levelText = this.add.text(width - 16, 16, `WAVE ${this.level}`, {
      fontFamily: '"Press Start 2P"',
      fontSize: '12px',
      color: '#00f5ff',
    }).setOrigin(1, 0);
    this.levelText.setDepth(2); // UI renders on top
  }

  drawPlayer(): void {
    this.player.clear();
    this.player.fillStyle(0x00ff41);

    // Ship body
    this.player.fillRect(-20, 0, 40, 15);
    this.player.fillRect(-10, -10, 20, 10);
    this.player.fillRect(-3, -18, 6, 8);
  }

  createAliens(): void {
    const { width } = this.scale;
    const startX = (width - CONFIG.ALIEN_COLS * CONFIG.ALIEN_SPACING) / 2 + CONFIG.ALIEN_SPACING / 2;
    const startY = 80;

    this.aliens = [];

    for (let row = 0; row < CONFIG.ALIEN_ROWS; row++) {
      for (let col = 0; col < CONFIG.ALIEN_COLS; col++) {
        const alien = this.add.graphics();
        this.drawAlien(alien, row);

        const x = startX + col * CONFIG.ALIEN_SPACING;
        const y = startY + row * (CONFIG.ALIEN_HEIGHT + 15);
        alien.setPosition(x, y);
        alien.setDepth(0); // Aliens render below player and bullets

        this.aliens.push({
          graphics: alien,
          row,
          active: true,
        });
      }
    }
  }

  drawAlien(graphics: Phaser.GameObjects.Graphics, row: number): void {
    const colors = [0xff0040, 0xff6600, 0xffff00, 0x00ff41, 0x00f5ff];
    graphics.fillStyle(colors[row]);

    // Different alien shapes per row
    if (row === 0) {
      // Top row - small invader
      graphics.fillRect(-8, -6, 16, 12);
      graphics.fillRect(-12, -2, 4, 4);
      graphics.fillRect(8, -2, 4, 4);
      graphics.fillRect(-6, 6, 4, 4);
      graphics.fillRect(2, 6, 4, 4);
    } else if (row < 3) {
      // Middle rows - medium invader
      graphics.fillRect(-10, -8, 20, 16);
      graphics.fillRect(-14, -4, 4, 8);
      graphics.fillRect(10, -4, 4, 8);
      graphics.fillRect(-10, 8, 6, 4);
      graphics.fillRect(4, 8, 6, 4);
    } else {
      // Bottom rows - large invader
      graphics.fillRect(-12, -8, 24, 16);
      graphics.fillRect(-16, 0, 4, 8);
      graphics.fillRect(12, 0, 4, 8);
      graphics.fillRect(-8, 8, 4, 4);
      graphics.fillRect(4, 8, 4, 4);
    }

    // Eyes
    graphics.fillStyle(0x000000);
    graphics.fillRect(-6, -4, 4, 4);
    graphics.fillRect(2, -4, 4, 4);
  }

  fireBullet(): void {
    const now = this.time.now;
    if (now - this.lastFired < CONFIG.FIRE_RATE) return;
    this.lastFired = now;

    if (this.sounds && this.soundEnabled) {
      this.sounds.play('shoot');
    }

    const bullet = this.add.graphics();
    bullet.fillStyle(0x00ff41);
    bullet.fillRect(-2, -8, 4, 16);
    bullet.setPosition(this.player.x, this.player.y - 25);
    bullet.setDepth(1); // Bullets render above aliens

    this.bullets.add(bullet);
  }

  alienFire(): void {
    const now = this.time.now;
    if (now - this.lastAlienFired < this.alienFireRate) return;

    // Get bottom-most active aliens in each column
    const bottomAliens: Alien[] = [];
    for (let col = 0; col < CONFIG.ALIEN_COLS; col++) {
      for (let row = CONFIG.ALIEN_ROWS - 1; row >= 0; row--) {
        const alien = this.aliens[row * CONFIG.ALIEN_COLS + col];
        if (alien && alien.active) {
          bottomAliens.push(alien);
          break;
        }
      }
    }

    if (bottomAliens.length === 0) return;

    // Random alien fires
    const shooter = this.rng.pick(bottomAliens);
    this.lastAlienFired = now;

    const bullet = this.add.graphics();
    bullet.fillStyle(0xff0040);
    bullet.fillRect(-2, 0, 4, 12);
    bullet.setPosition(shooter.graphics.x, shooter.graphics.y + 15);
    bullet.setDepth(1); // Bullets render above aliens

    this.alienBullets.add(bullet);
  }

  moveAliens(delta: number): void {
    const { width, height } = this.scale;
    let shouldDrop = false;
    let shouldReverse = false;

    // Check bounds
    for (const alien of this.aliens) {
      if (!alien.active) continue;

      const futureX = alien.graphics.x + this.alienDirection * this.alienSpeed * (delta / 1000);
      if (futureX < 30 || futureX > width - 30) {
        shouldReverse = true;
        shouldDrop = true;
        break;
      }
    }

    // Move aliens
    for (const alien of this.aliens) {
      if (!alien.active) continue;

      if (shouldDrop) {
        alien.graphics.y += CONFIG.ALIEN_DROP;

        // Check if reached bottom
        if (alien.graphics.y > height - 100) {
          this.endGame();
          return;
        }
      }

      alien.graphics.x += (shouldReverse ? -this.alienDirection : this.alienDirection) *
                          this.alienSpeed * (delta / 1000);
    }

    if (shouldReverse) {
      this.alienDirection *= -1;
    }
  }

  checkCollisions(): void {
    const { height } = this.scale;

    // Player bullets vs aliens
    this.bullets.getChildren().forEach((bulletObj) => {
      const bullet = bulletObj as Phaser.GameObjects.Graphics;

      // Out of bounds
      if (bullet.y < 0) {
        bullet.destroy();
        return;
      }

      // Check alien hits
      for (const alien of this.aliens) {
        if (!alien.active) continue;

        if (
          Math.abs(bullet.x - alien.graphics.x) < CONFIG.ALIEN_WIDTH / 2 &&
          Math.abs(bullet.y - alien.graphics.y) < CONFIG.ALIEN_HEIGHT / 2
        ) {
          // Hit!
          bullet.destroy();
          alien.active = false;
          alien.graphics.setVisible(false);

          if (this.sounds && this.soundEnabled) {
            this.sounds.play('alienKill');
          }

          this.score += CONFIG.ALIEN_POINTS[alien.row];
          this.onScoreUpdate(this.score);

          // Speed up remaining aliens (maintain wave difficulty + per-alien increase)
          const remaining = this.aliens.filter((a) => a.active).length;
          if (remaining > 0) {
            const waveBaseSpeed = CONFIG.ALIEN_SPEED_START + (this.level - 1) * CONFIG.ALIEN_SPEED_PER_WAVE;
            this.alienSpeed = waveBaseSpeed +
              (CONFIG.ALIEN_ROWS * CONFIG.ALIEN_COLS - remaining) * CONFIG.ALIEN_SPEED_INCREASE;
          }

          // Check wave complete
          if (remaining === 0) {
            this.nextWave();
          }
          return;
        }
      }
    });

    // Alien bullets vs player
    this.alienBullets.getChildren().forEach((bulletObj) => {
      const bullet = bulletObj as Phaser.GameObjects.Graphics;

      // Out of bounds
      if (bullet.y > height) {
        bullet.destroy();
        return;
      }

      // Hit player
      if (
        Math.abs(bullet.x - this.player.x) < 20 &&
        Math.abs(bullet.y - this.player.y) < 15
      ) {
        bullet.destroy();
        this.playerHit();
      }
    });
  }

  playerHit(): void {
    this.lives--;
    this.livesText.setText(`LIVES: ${this.lives}`);

    if (this.sounds && this.soundEnabled) {
      this.sounds.play('playerHit');
    }

    if (this.lives <= 0) {
      this.endGame();
    } else {
      // Flash player
      this.player.setVisible(false);
      this.time.delayedCall(200, () => this.player.setVisible(true));
      this.time.delayedCall(400, () => this.player.setVisible(false));
      this.time.delayedCall(600, () => this.player.setVisible(true));
    }
  }

  nextWave(): void {
    this.level++;
    this.levelText.setText(`WAVE ${this.level}`);

    if (this.sounds && this.soundEnabled) {
      this.sounds.play('nextLevel');
    }

    // Clear bullets
    this.bullets.clear(true, true);
    this.alienBullets.clear(true, true);

    // Create new aliens
    this.aliens.forEach((a) => a.graphics.destroy());
    this.createAliens();

    // Increase difficulty with each wave
    this.alienSpeed = CONFIG.ALIEN_SPEED_START + (this.level - 1) * CONFIG.ALIEN_SPEED_PER_WAVE;
    this.alienFireRate = Math.max(
      CONFIG.ALIEN_FIRE_RATE_MIN,
      CONFIG.ALIEN_FIRE_RATE - (this.level - 1) * CONFIG.ALIEN_FIRE_RATE_PER_WAVE
    );
    this.alienBulletSpeed = CONFIG.ALIEN_BULLET_SPEED + (this.level - 1) * CONFIG.ALIEN_BULLET_SPEED_PER_WAVE;
  }

  endGame(): void {
    this.gameOver = true;

    if (this.sounds && this.soundEnabled) {
      this.sounds.play('gameOver');
    }

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

  update(time: number, delta: number): void {
    if (this.gameOver) return;

    const { width } = this.scale;
    const direction = this.getDirection();
    const action = this.getAction();

    // Move player
    if (direction.left) {
      this.player.x -= CONFIG.PLAYER_SPEED * (delta / 1000);
    }
    if (direction.right) {
      this.player.x += CONFIG.PLAYER_SPEED * (delta / 1000);
    }
    this.player.x = Phaser.Math.Clamp(this.player.x, 30, width - 30);

    // Fire
    if (action) {
      this.fireBullet();
    }

    // Move bullets
    this.bullets.getChildren().forEach((bullet) => {
      (bullet as Phaser.GameObjects.Graphics).y -= CONFIG.BULLET_SPEED * (delta / 1000);
    });

    this.alienBullets.getChildren().forEach((bullet) => {
      (bullet as Phaser.GameObjects.Graphics).y += this.alienBulletSpeed * (delta / 1000);
    });

    // Move aliens
    this.moveAliens(delta);

    // Alien fire
    this.alienFire();

    // Check collisions
    this.checkCollisions();
  }

  onShutdown(): void {
    if (this.sounds) {
      this.sounds.destroy();
      this.sounds = null;
    }
  }
}

export default AlienAssaultScene;
