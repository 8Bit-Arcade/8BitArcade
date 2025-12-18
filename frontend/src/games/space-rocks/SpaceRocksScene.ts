import * as Phaser from 'phaser';
import { SeededRNG } from '../engine/SeededRNG';
import { RetroSounds } from '../engine/RetroSounds';

// Game configuration
const CONFIG = {
  PLAYER_ROTATION_SPEED: 200,
  PLAYER_THRUST: 300,
  PLAYER_MAX_SPEED: 400,
  PLAYER_DRAG: 0.99,
  BULLET_SPEED: 500,
  BULLET_LIFETIME: 1000,
  FIRE_RATE: 200,
  ASTEROID_SPEEDS: { large: 80, medium: 120, small: 160 },
  ASTEROID_POINTS: { large: 20, medium: 50, small: 100 },
  STARTING_ASTEROIDS: 4,
  ASTEROIDS_PER_LEVEL: 2,
  INVINCIBLE_TIME: 2000,
  RESPAWN_TIME: 1500,
};

type AsteroidSize = 'large' | 'medium' | 'small';

export class SpaceRocksScene extends Phaser.Scene {
  // Callbacks
  private onScoreUpdate: (score: number) => void;
  private onGameOver: (finalScore: number) => void;
  private getDirection: () => { up: boolean; down: boolean; left: boolean; right: boolean };
  private getAction: () => boolean;

  // Game state
  private rng: SeededRNG;
  private score: number = 0;
  private lives: number = 3;
  private level: number = 1;
  private isInvincible: boolean = false;
  private lastFired: number = 0;
  private gameOver: boolean = false;

  // Game objects
  private player!: Phaser.GameObjects.Graphics;
  private playerBody!: Phaser.Physics.Arcade.Body;
  private bullets!: Phaser.GameObjects.Group;
  private asteroids!: Phaser.GameObjects.Group;

  // Graphics
  private livesText!: Phaser.GameObjects.Text;
  private levelText!: Phaser.GameObjects.Text;

  // Audio
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
    super({ key: 'SpaceRocksScene' });
    this.onScoreUpdate = onScoreUpdate;
    this.onGameOver = onGameOver;
    this.getDirection = getDirection;
    this.getAction = getAction;
    this.rng = new SeededRNG(seed);
    this.soundEnabled = soundEnabled;

    // Initialize sounds
    if (this.soundEnabled) {
      try {
        this.sounds = new RetroSounds(soundVolume);
        this.sounds.registerSound('shoot', this.sounds.generateLaser(800, 200, 0.1));
        this.sounds.registerSound('explode', this.sounds.generateExplosion(0.3));
        this.sounds.registerSound('death', this.sounds.generateExplosion(0.8));
        this.sounds.registerSound('levelUp', this.sounds.generatePowerUp());
      } catch (e) {
        console.warn('Failed to initialize audio:', e);
        this.sounds = null;
      }
    }
  }

  create(): void {
    const { width, height } = this.scale;

    // Create player ship
    this.createPlayer(width / 2, height / 2);

    // Create groups
    this.bullets = this.add.group();
    this.asteroids = this.add.group();

    // Create UI
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

    // Spawn initial asteroids
    this.spawnAsteroids(CONFIG.STARTING_ASTEROIDS);

    // Set up collisions
    this.physics.add.overlap(
      this.bullets,
      this.asteroids,
      this.bulletHitAsteroid as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
      undefined,
      this
    );

    // Start invincible
    this.setInvincible();

    // Register shutdown handler
    this.events.on('shutdown', this.onShutdown, this);
  }

  onShutdown(): void {
    if (this.sounds) {
      this.sounds.destroy();
      this.sounds = null;
    }
  }

  createPlayer(x: number, y: number): void {
    // Create graphics for ship
    this.player = this.add.graphics();
    this.drawShip();
    this.player.setPosition(x, y);

    // Add physics
    this.physics.world.enable(this.player);
    this.playerBody = this.player.body as Phaser.Physics.Arcade.Body;
    this.playerBody.setCircle(15, -15, -15);
    this.playerBody.setMaxSpeed(CONFIG.PLAYER_MAX_SPEED);
    this.playerBody.setDrag(CONFIG.PLAYER_DRAG);
  }

  drawShip(flicker = false): void {
    this.player.clear();

    const alpha = flicker && this.isInvincible ? 0.3 : 1;
    this.player.lineStyle(2, 0x00ff41, alpha);

    // Ship triangle
    this.player.beginPath();
    this.player.moveTo(20, 0);
    this.player.lineTo(-15, -12);
    this.player.lineTo(-10, 0);
    this.player.lineTo(-15, 12);
    this.player.closePath();
    this.player.strokePath();
  }

  spawnAsteroids(count: number): void {
    const { width, height } = this.scale;

    for (let i = 0; i < count; i++) {
      // Spawn away from player
      let x: number, y: number;
      do {
        x = this.rng.nextFloat(50, width - 50);
        y = this.rng.nextFloat(50, height - 50);
      } while (
        Phaser.Math.Distance.Between(x, y, this.player.x, this.player.y) < 150
      );

      this.createAsteroid(x, y, 'large');
    }
  }

  createAsteroid(x: number, y: number, size: AsteroidSize): void {
    const asteroid = this.add.graphics();
    this.drawAsteroid(asteroid, size);
    asteroid.setPosition(x, y);
    asteroid.setData('size', size);

    // Add physics
    this.physics.world.enable(asteroid);
    const body = asteroid.body as Phaser.Physics.Arcade.Body;

    const radius = size === 'large' ? 40 : size === 'medium' ? 25 : 15;
    body.setCircle(radius, -radius, -radius);

    // Random velocity
    const speed = CONFIG.ASTEROID_SPEEDS[size];
    const angle = this.rng.nextAngle();
    body.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);

    // Rotation
    asteroid.setData('rotationSpeed', this.rng.nextFloat(-2, 2));

    this.asteroids.add(asteroid);
  }

  drawAsteroid(graphics: Phaser.GameObjects.Graphics, size: AsteroidSize): void {
    const radius = size === 'large' ? 40 : size === 'medium' ? 25 : 15;
    const points = size === 'large' ? 12 : size === 'medium' ? 10 : 8;

    graphics.lineStyle(2, 0xffffff);
    graphics.beginPath();

    for (let i = 0; i <= points; i++) {
      const angle = (i / points) * Math.PI * 2;
      const variance = this.rng.nextFloat(0.7, 1.0);
      const r = radius * variance;
      const x = Math.cos(angle) * r;
      const y = Math.sin(angle) * r;

      if (i === 0) {
        graphics.moveTo(x, y);
      } else {
        graphics.lineTo(x, y);
      }
    }

    graphics.closePath();
    graphics.strokePath();
  }

  fireBullet(): void {
    const now = this.time.now;
    if (now - this.lastFired < CONFIG.FIRE_RATE) return;
    this.lastFired = now;

    const bullet = this.add.graphics();
    bullet.fillStyle(0x00ff41);
    bullet.fillCircle(0, 0, 3);

    const angle = this.player.rotation;
    const x = this.player.x + Math.cos(angle) * 20;
    const y = this.player.y + Math.sin(angle) * 20;
    bullet.setPosition(x, y);

    this.physics.world.enable(bullet);
    const body = bullet.body as Phaser.Physics.Arcade.Body;
    body.setCircle(3, -3, -3);
    body.setVelocity(
      Math.cos(angle) * CONFIG.BULLET_SPEED,
      Math.sin(angle) * CONFIG.BULLET_SPEED
    );

    this.bullets.add(bullet);

    // Play shoot sound
    if (this.sounds && this.soundEnabled) {
      this.sounds.play('shoot');
    }

    // Auto-destroy after lifetime
    this.time.delayedCall(CONFIG.BULLET_LIFETIME, () => {
      bullet.destroy();
    });
  }

  bulletHitAsteroid(
    bulletObj: Phaser.GameObjects.GameObject,
    asteroidObj: Phaser.GameObjects.GameObject
  ): void {
    const bullet = bulletObj as Phaser.GameObjects.Graphics;
    const asteroid = asteroidObj as Phaser.GameObjects.Graphics;
    const size = asteroid.getData('size') as AsteroidSize;

    // Add score
    this.score += CONFIG.ASTEROID_POINTS[size];
    this.onScoreUpdate(this.score);

    // Destroy bullet
    bullet.destroy();

    // Split asteroid
    const x = asteroid.x;
    const y = asteroid.y;
    asteroid.destroy();

    // Play explosion sound
    if (this.sounds && this.soundEnabled) {
      this.sounds.play('explode');
    }

    if (size === 'large') {
      this.createAsteroid(x - 20, y, 'medium');
      this.createAsteroid(x + 20, y, 'medium');
    } else if (size === 'medium') {
      this.createAsteroid(x - 10, y, 'small');
      this.createAsteroid(x + 10, y, 'small');
    }

    // Check level complete
    if (this.asteroids.getLength() === 0) {
      this.nextLevel();
    }
  }

  nextLevel(): void {
    this.level++;
    this.levelText.setText(`LEVEL ${this.level}`);

    // Play level up sound
    if (this.sounds && this.soundEnabled) {
      this.sounds.play('levelUp');
    }

    // Brief pause then spawn new asteroids
    this.time.delayedCall(1000, () => {
      this.spawnAsteroids(
        CONFIG.STARTING_ASTEROIDS + (this.level - 1) * CONFIG.ASTEROIDS_PER_LEVEL
      );
    });
  }

  playerHitAsteroid(): void {
    if (this.isInvincible || this.gameOver) return;

    this.lives--;
    this.livesText.setText(`LIVES: ${this.lives}`);

    // Play death sound
    if (this.sounds && this.soundEnabled) {
      this.sounds.play('death');
    }

    if (this.lives <= 0) {
      this.endGame();
    } else {
      // Respawn
      this.player.setVisible(false);
      this.time.delayedCall(CONFIG.RESPAWN_TIME, () => {
        if (this.gameOver) return;
        const { width, height } = this.scale;
        this.player.setPosition(width / 2, height / 2);
        this.player.rotation = 0;
        this.playerBody.setVelocity(0, 0);
        this.player.setVisible(true);
        this.setInvincible();
      });
    }
  }

  setInvincible(): void {
    this.isInvincible = true;

    // Flicker effect
    const flicker = this.time.addEvent({
      delay: 100,
      callback: () => this.drawShip(true),
      loop: true,
    });

    this.time.delayedCall(CONFIG.INVINCIBLE_TIME, () => {
      flicker.destroy();
      this.isInvincible = false;
      this.drawShip(false);
    });
  }

  endGame(): void {
    this.gameOver = true;
    this.player.setVisible(false);

    // Show game over
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

  wrapScreen(obj: Phaser.GameObjects.Graphics): void {
    const { width, height } = this.scale;
    const body = obj.body as Phaser.Physics.Arcade.Body;

    if (obj.x < -20) obj.x = width + 20;
    if (obj.x > width + 20) obj.x = -20;
    if (obj.y < -20) obj.y = height + 20;
    if (obj.y > height + 20) obj.y = -20;
  }

  update(): void {
    if (this.gameOver) return;

    const direction = this.getDirection();
    const action = this.getAction();

    // Player rotation
    if (direction.left) {
      this.player.rotation -= CONFIG.PLAYER_ROTATION_SPEED * 0.001;
    }
    if (direction.right) {
      this.player.rotation += CONFIG.PLAYER_ROTATION_SPEED * 0.001;
    }

    // Player thrust
    if (direction.up) {
      this.playerBody.setAcceleration(
        Math.cos(this.player.rotation) * CONFIG.PLAYER_THRUST,
        Math.sin(this.player.rotation) * CONFIG.PLAYER_THRUST
      );
    } else {
      this.playerBody.setAcceleration(0, 0);
    }

    // Fire
    if (action) {
      this.fireBullet();
    }

    // Screen wrap for player
    this.wrapScreen(this.player);

    // Screen wrap and rotate asteroids
    this.asteroids.getChildren().forEach((obj) => {
      const asteroid = obj as Phaser.GameObjects.Graphics;
      this.wrapScreen(asteroid);
      asteroid.rotation += asteroid.getData('rotationSpeed') * 0.01;

      // Check collision with player
      if (
        !this.isInvincible &&
        this.player.visible &&
        Phaser.Math.Distance.Between(
          this.player.x,
          this.player.y,
          asteroid.x,
          asteroid.y
        ) < 30
      ) {
        this.playerHitAsteroid();
      }
    });
  }
}

export default SpaceRocksScene;
