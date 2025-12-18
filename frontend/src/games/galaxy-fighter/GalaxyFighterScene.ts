import * as Phaser from 'phaser';
import { SeededRNG } from '../engine/SeededRNG';
import { RetroSounds } from '../engine/RetroSounds';

const CONFIG = {
  PLAYER_SPEED: 300,
  BULLET_SPEED: 400,
  ENEMY_SPEED: 80,
  FIRE_RATE: 200,
  ENEMY_FIRE_RATE: 1500,
  ENEMY_SPAWN_RATE: 2000,
  WAVE_SIZE: 8,
  LIVES: 3,
  ENEMY_POINTS: 100,
  BOSS_POINTS: 1000,
};

interface Enemy {
  graphics: Phaser.GameObjects.Graphics;
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  isBoss: boolean;
}

export class GalaxyFighterScene extends Phaser.Scene {
  private onScoreUpdate: (score: number) => void;
  private onGameOver: (finalScore: number) => void;
  private getDirection: () => { up: boolean; down: boolean; left: boolean; right: boolean };
  private getAction: () => boolean;

  private rng: SeededRNG;
  private score: number = 0;
  private lives: number = CONFIG.LIVES;
  private wave: number = 1;
  private gameOver: boolean = false;

  private player!: Phaser.GameObjects.Graphics;
  private playerX: number = 400;
  private playerY: number = 500;
  private lastFired: number = 0;

  private bullets: Array<{ graphics: Phaser.GameObjects.Graphics; x: number; y: number; vy: number }> = [];
  private enemies: Enemy[] = [];
  private enemyBullets: Array<{ graphics: Phaser.GameObjects.Graphics; x: number; y: number; vy: number }> = [];

  private spawnTimer: number = 0;
  private enemiesSpawned: number = 0;

  private livesText!: Phaser.GameObjects.Text;
  private waveText!: Phaser.GameObjects.Text;
  private stars!: Phaser.GameObjects.Graphics;

  private sounds: RetroSounds | null = null;
  private soundEnabled: boolean = true;

  constructor(
    onScoreUpdate: (score: number) => void,
    onGameOver: (finalScore: number) => void,
    getDirection: () => { up: boolean; down: boolean; left: boolean; right: boolean },
    getAction: () => boolean,
    seed: number
  ) {
    super({ key: 'GalaxyFighterScene' });
    this.onScoreUpdate = onScoreUpdate;
    this.onGameOver = onGameOver;
    this.getDirection = getDirection;
    this.getAction = getAction;
    this.rng = new SeededRNG(seed);
  }

  create(): void {
    const { width, height } = this.scale;

    this.events.on('shutdown', this.onShutdown, this);

    // Starfield background
    this.stars = this.add.graphics();
    for (let i = 0; i < 100; i++) {
      const x = this.rng.nextFloat(0, width);
      const y = this.rng.nextFloat(0, height);
      const size = this.rng.nextFloat(1, 3);
      this.stars.fillStyle(0xffffff, this.rng.nextFloat(0.3, 0.8));
      this.stars.fillCircle(x, y, size);
    }

    // Create player
    this.player = this.add.graphics();
    this.drawPlayer();

    // UI
    this.livesText = this.add.text(16, 16, `LIVES: ${this.lives}`, {
      fontFamily: '"Press Start 2P"',
      fontSize: '12px',
      color: '#00ff41',
    });

    this.waveText = this.add.text(width - 16, 16, `WAVE ${this.wave}`, {
      fontFamily: '"Press Start 2P"',
      fontSize: '12px',
      color: '#00f5ff',
    }).setOrigin(1, 0);
  }

  drawPlayer(): void {
    this.player.clear();
    this.player.fillStyle(0x00ff41);

    // Ship triangle
    this.player.beginPath();
    this.player.moveTo(0, -20);
    this.player.lineTo(-15, 15);
    this.player.lineTo(0, 10);
    this.player.lineTo(15, 15);
    this.player.closePath();
    this.player.fillPath();

    // Wings
    this.player.fillStyle(0x00f5ff);
    this.player.fillTriangle(-15, 10, -20, 15, -15, 15);
    this.player.fillTriangle(15, 10, 20, 15, 15, 15);

    this.player.setPosition(this.playerX, this.playerY);
  }

  update(time: number, delta: number): void {
    if (this.gameOver) return;

    const dt = delta / 1000;
    const { width, height } = this.scale;

    // Player movement
    const dir = this.getDirection();
    if (dir.left) {
      this.playerX = Math.max(20, this.playerX - CONFIG.PLAYER_SPEED * dt);
    }
    if (dir.right) {
      this.playerX = Math.min(width - 20, this.playerX + CONFIG.PLAYER_SPEED * dt);
    }
    if (dir.up) {
      this.playerY = Math.max(20, this.playerY - CONFIG.PLAYER_SPEED * dt);
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
      bullet.y += bullet.vy * dt;
      bullet.graphics.setPosition(bullet.x, bullet.y);

      if (bullet.y < 0) {
        bullet.graphics.destroy();
        this.bullets.splice(i, 1);
      }
    }

    // Update enemy bullets
    for (let i = this.enemyBullets.length - 1; i >= 0; i--) {
      const bullet = this.enemyBullets[i];
      bullet.y += bullet.vy * dt;
      bullet.graphics.setPosition(bullet.x, bullet.y);

      if (bullet.y > height) {
        bullet.graphics.destroy();
        this.enemyBullets.splice(i, 1);
      }

      // Check player hit
      if (Math.abs(bullet.x - this.playerX) < 15 && Math.abs(bullet.y - this.playerY) < 15) {
        bullet.graphics.destroy();
        this.enemyBullets.splice(i, 1);
        this.loseLife();
      }
    }

    // Spawn enemies
    this.spawnTimer += delta;
    if (this.spawnTimer > CONFIG.ENEMY_SPAWN_RATE && this.enemiesSpawned < CONFIG.WAVE_SIZE) {
      this.spawnTimer = 0;
      this.spawnEnemy();
    }

    // Update enemies
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];
      enemy.x += enemy.vx * dt;
      enemy.y += enemy.vy * dt;

      // Bounce off walls
      if (enemy.x < 30 || enemy.x > width - 30) {
        enemy.vx *= -1;
      }

      // Remove if off screen
      if (enemy.y > height + 50) {
        enemy.graphics.destroy();
        this.enemies.splice(i, 1);
        continue;
      }

      enemy.graphics.setPosition(enemy.x, enemy.y);

      // Enemy fire
      if (this.rng.next() < 0.001) {
        this.enemyFire(enemy.x, enemy.y);
      }
    }

    // Check collisions
    this.checkCollisions();

    // Check wave complete
    if (this.enemies.length === 0 && this.enemiesSpawned >= CONFIG.WAVE_SIZE) {
      this.nextWave();
    }
  }

  fireBullet(): void {
    if (this.sounds && this.soundEnabled) {
      this.sounds.play('shoot');
    }

    const bullet = this.add.graphics();
    bullet.fillStyle(0x00ff41);
    bullet.fillRect(-2, -8, 4, 8);

    this.bullets.push({
      graphics: bullet,
      x: this.playerX,
      y: this.playerY - 20,
      vy: -CONFIG.BULLET_SPEED,
    });
  }

  enemyFire(x: number, y: number): void {
    const bullet = this.add.graphics();
    bullet.fillStyle(0xff0040);
    bullet.fillCircle(0, 0, 3);

    this.enemyBullets.push({
      graphics: bullet,
      x,
      y,
      vy: 200,
    });
  }

  spawnEnemy(): void {
    const isBoss = this.enemiesSpawned === CONFIG.WAVE_SIZE - 1 && this.wave % 3 === 0;
    const enemy = this.add.graphics();

    if (isBoss) {
      // Boss enemy
      enemy.fillStyle(0xff0040);
      enemy.fillRect(-30, -30, 60, 60);
      enemy.fillStyle(0xff6600);
      enemy.fillRect(-25, -25, 50, 50);
    } else {
      // Regular enemy
      enemy.fillStyle(0xff0040);
      enemy.fillTriangle(0, -15, -12, 12, 12, 12);
      enemy.fillStyle(0xff6600);
      enemy.fillCircle(0, 0, 8);
    }

    const x = this.rng.nextFloat(50, this.scale.width - 50);
    const vx = this.rng.nextFloat(-100, 100);

    this.enemies.push({
      graphics: enemy,
      x,
      y: -30,
      vx,
      vy: CONFIG.ENEMY_SPEED + this.wave * 10,
      hp: isBoss ? 5 : 1,
      isBoss,
    });

    this.enemiesSpawned++;
  }

  checkCollisions(): void {
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const bullet = this.bullets[i];

      for (let j = this.enemies.length - 1; j >= 0; j--) {
        const enemy = this.enemies[j];
        const dist = Math.sqrt(
          Math.pow(bullet.x - enemy.x, 2) + Math.pow(bullet.y - enemy.y, 2)
        );

        if (dist < 20) {
          // Hit!
          bullet.graphics.destroy();
          this.bullets.splice(i, 1);

          enemy.hp--;
          if (enemy.hp <= 0) {
            if (this.sounds && this.soundEnabled) {
              this.sounds.play('explode');
            }
            const points = enemy.isBoss ? CONFIG.BOSS_POINTS : CONFIG.ENEMY_POINTS;
            this.score += points;
            this.onScoreUpdate(this.score);
            enemy.graphics.destroy();
            this.enemies.splice(j, 1);
          }
          break;
        }
      }
    }

    // Check player-enemy collision
    for (const enemy of this.enemies) {
      const dist = Math.sqrt(
        Math.pow(this.playerX - enemy.x, 2) + Math.pow(this.playerY - enemy.y, 2)
      );

      if (dist < 25) {
        this.loseLife();
        break;
      }
    }
  }

  nextWave(): void {
    this.wave++;
    this.waveText.setText(`WAVE ${this.wave}`);
    this.enemiesSpawned = 0;
    this.spawnTimer = 1000; // Delay before next wave
    if (this.sounds && this.soundEnabled) {
      this.sounds.play('nextWave');
    }
  }

  loseLife(): void {
    this.lives--;
    this.livesText.setText(`LIVES: ${this.lives}`);
    if (this.sounds && this.soundEnabled) {
      this.sounds.play('hit');
    }

    // Clear bullets
    this.enemyBullets.forEach(b => b.graphics.destroy());
    this.enemyBullets = [];

    if (this.lives <= 0) {
      this.endGame();
    } else {
      // Brief invincibility
      this.playerX = this.scale.width / 2;
      this.playerY = this.scale.height - 50;
      this.drawPlayer();
    }
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
