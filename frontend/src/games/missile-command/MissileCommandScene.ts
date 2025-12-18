import * as Phaser from 'phaser';
import { SeededRNG } from '../engine/SeededRNG';
import { RetroSounds } from '../engine/RetroSounds';

const CONFIG = {
  CROSSHAIR_SPEED: 200,
  MISSILE_SPEED: 300,
  ENEMY_MISSILE_SPEED: 35,
  ENEMY_SPEED_INCREASE: 3,
  EXPLOSION_DURATION: 800,
  EXPLOSION_MAX_RADIUS: 50,
  BATTERY_RELOAD_TIME: 5000,
  MISSILES_PER_BATTERY: 10,
  WAVE_DELAY: 3000,
  INITIAL_ENEMY_COUNT: 2,
  ENEMY_COUNT_INCREASE: 1,
  CITIES: 6,
  LIVES: 3,
  POINTS_PER_MISSILE: 25,
  POINTS_PER_CITY: 100,
  POINTS_PER_BATTERY: 50,
};

interface City {
  x: number;
  y: number;
  alive: boolean;
  graphics: Phaser.GameObjects.Graphics;
}

interface Battery {
  x: number;
  y: number;
  missiles: number;
  alive: boolean;
  graphics: Phaser.GameObjects.Graphics;
}

interface Missile {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  vx: number;
  vy: number;
  graphics: Phaser.GameObjects.Graphics;
  trail: Array<{ x: number; y: number }>;
}

interface EnemyMissile {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  vx: number;
  vy: number;
  graphics: Phaser.GameObjects.Graphics;
  trail: Array<{ x: number; y: number }>;
}

interface Explosion {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  expanding: boolean;
  timer: number;
  graphics: Phaser.GameObjects.Graphics;
}

export class MissileCommandScene extends Phaser.Scene {
  private onScoreUpdate: (score: number) => void;
  private onGameOver: (finalScore: number) => void;
  private getDirection: () => { up: boolean; down: boolean; left: boolean; right: boolean };
  private getAction: () => boolean;

  private rng: SeededRNG;
  private score: number = 0;
  private wave: number = 1;
  private gameOver: boolean = false;
  private waveActive: boolean = false;

  private crosshairX: number = 320;
  private crosshairY: number = 300;
  private lastFire: boolean = false;

  private cities: City[] = [];
  private batteries: Battery[] = [];
  private missiles: Missile[] = [];
  private enemyMissiles: EnemyMissile[] = [];
  private explosions: Explosion[] = [];

  private graphics!: Phaser.GameObjects.Graphics;
  private crosshairGraphics!: Phaser.GameObjects.Graphics;
  private scoreText!: Phaser.GameObjects.Text;
  private waveText!: Phaser.GameObjects.Text;
  private ammoText!: Phaser.GameObjects.Text;

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
    super({ key: 'MissileCommandScene' });
    this.onScoreUpdate = onScoreUpdate;
    this.onGameOver = onGameOver;
    this.getDirection = getDirection;
    this.getAction = getAction;
    this.rng = new SeededRNG(seed);
    this.soundEnabled = soundEnabled;

    if (this.soundEnabled) {
      try {
        this.sounds = new RetroSounds(soundVolume);
        this.sounds.registerSound('launch', this.sounds.generateLaser(600, 800, 0.15));
        this.sounds.registerSound('explode', this.sounds.generateExplosion(0.3));
        this.sounds.registerSound('baseHit', this.sounds.generateExplosion(0.6));
        this.sounds.registerSound('nextWave', this.sounds.generatePowerUp());
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

    this.graphics = this.add.graphics();
    this.crosshairGraphics = this.add.graphics();

    // Create cities (6 cities)
    const cityY = height - 30;
    const cityPositions = [100, 150, 200, 440, 490, 540];

    cityPositions.forEach(x => {
      const graphics = this.add.graphics();
      this.cities.push({
        x,
        y: cityY,
        alive: true,
        graphics,
      });
    });

    // Create batteries (3 batteries - left, center, right)
    const batteryY = height - 30;
    const batteryPositions = [60, 320, 580];

    batteryPositions.forEach(x => {
      const graphics = this.add.graphics();
      this.batteries.push({
        x,
        y: batteryY,
        missiles: CONFIG.MISSILES_PER_BATTERY,
        alive: true,
        graphics,
      });
    });

    // UI
    this.scoreText = this.add.text(16, 16, `SCORE: ${this.score}`, {
      fontFamily: '"Press Start 2P"',
      fontSize: '14px',
      color: '#00ff00',
    });

    this.waveText = this.add.text(width / 2, 16, `WAVE ${this.wave}`, {
      fontFamily: '"Press Start 2P"',
      fontSize: '14px',
      color: '#ffff00',
    }).setOrigin(0.5, 0);

    this.ammoText = this.add.text(width - 16, 16, '', {
      fontFamily: '"Press Start 2P"',
      fontSize: '12px',
      color: '#00ffff',
    }).setOrigin(1, 0);

    // Start first wave
    this.startWave();
  }

  startWave(): void {
    this.waveActive = true;
    this.waveText.setText(`WAVE ${this.wave}`);

    // Spawn enemy missiles
    const enemyCount = CONFIG.INITIAL_ENEMY_COUNT + (this.wave - 1) * CONFIG.ENEMY_COUNT_INCREASE;

    for (let i = 0; i < enemyCount; i++) {
      this.time.delayedCall(i * 200, () => {
        this.spawnEnemyMissile();
      });
    }
  }

  spawnEnemyMissile(): void {
    const startX = 50 + this.rng.next() * (this.scale.width - 100);
    const startY = 0;

    // Target cities or batteries
    let targetX: number;
    let targetY: number;

    if (this.rng.next() < 0.7) {
      // Target city
      const aliveCities = this.cities.filter(c => c.alive);
      if (aliveCities.length > 0) {
        const city = aliveCities[Math.floor(this.rng.next() * aliveCities.length)];
        targetX = city.x;
        targetY = city.y;
      } else {
        targetX = this.scale.width / 2;
        targetY = this.scale.height - 30;
      }
    } else {
      // Target battery
      const aliveBatteries = this.batteries.filter(b => b.alive);
      if (aliveBatteries.length > 0) {
        const battery = aliveBatteries[Math.floor(this.rng.next() * aliveBatteries.length)];
        targetX = battery.x;
        targetY = battery.y;
      } else {
        targetX = this.scale.width / 2;
        targetY = this.scale.height - 30;
      }
    }

    const dx = targetX - startX;
    const dy = targetY - startY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Calculate speed based on wave (starts slow, gets faster)
    const speed = CONFIG.ENEMY_MISSILE_SPEED + (this.wave - 1) * CONFIG.ENEMY_SPEED_INCREASE;

    const graphics = this.add.graphics();

    this.enemyMissiles.push({
      x: startX,
      y: startY,
      targetX,
      targetY,
      vx: (dx / dist) * speed,
      vy: (dy / dist) * speed,
      graphics,
      trail: [],
    });
  }

  update(time: number, delta: number): void {
    if (this.gameOver) return;

    const dt = delta / 1000;
    const dir = this.getDirection();
    const action = this.getAction();

    // Move crosshair
    if (dir.left) this.crosshairX -= CONFIG.CROSSHAIR_SPEED * dt;
    if (dir.right) this.crosshairX += CONFIG.CROSSHAIR_SPEED * dt;
    if (dir.up) this.crosshairY -= CONFIG.CROSSHAIR_SPEED * dt;
    if (dir.down) this.crosshairY += CONFIG.CROSSHAIR_SPEED * dt;

    // Constrain crosshair
    this.crosshairX = Math.max(10, Math.min(this.scale.width - 10, this.crosshairX));
    this.crosshairY = Math.max(10, Math.min(this.scale.height - 50, this.crosshairY));

    // Fire missile
    if (action && !this.lastFire) {
      this.fireMissile();
      this.lastFire = true;
    } else if (!action) {
      this.lastFire = false;
    }

    // Update missiles
    for (let i = this.missiles.length - 1; i >= 0; i--) {
      const missile = this.missiles[i];

      missile.trail.push({ x: missile.x, y: missile.y });
      if (missile.trail.length > 15) missile.trail.shift();

      missile.x += missile.vx * dt;
      missile.y += missile.vy * dt;

      // Check if reached target
      const dist = Math.sqrt(
        Math.pow(missile.targetX - missile.x, 2) +
        Math.pow(missile.targetY - missile.y, 2)
      );

      if (dist < 5) {
        this.createExplosion(missile.targetX, missile.targetY);
        missile.graphics.destroy();
        this.missiles.splice(i, 1);
      }
    }

    // Update enemy missiles
    for (let i = this.enemyMissiles.length - 1; i >= 0; i--) {
      const missile = this.enemyMissiles[i];

      missile.trail.push({ x: missile.x, y: missile.y });
      if (missile.trail.length > 20) missile.trail.shift();

      missile.x += missile.vx * dt;
      missile.y += missile.vy * dt;

      // Check if hit target
      const dist = Math.sqrt(
        Math.pow(missile.targetX - missile.x, 2) +
        Math.pow(missile.targetY - missile.y, 2)
      );

      if (dist < 10) {
        this.hitTarget(missile.targetX, missile.targetY);
        missile.graphics.destroy();
        this.enemyMissiles.splice(i, 1);
      }

      // Check collision with explosions
      for (const explosion of this.explosions) {
        const distToExplosion = Math.sqrt(
          Math.pow(explosion.x - missile.x, 2) +
          Math.pow(explosion.y - missile.y, 2)
        );

        if (distToExplosion < explosion.radius) {
          this.score += CONFIG.POINTS_PER_MISSILE;
          this.onScoreUpdate(this.score);
          this.scoreText.setText(`SCORE: ${this.score}`);
          missile.graphics.destroy();
          this.enemyMissiles.splice(i, 1);
          break;
        }
      }
    }

    // Update explosions
    for (let i = this.explosions.length - 1; i >= 0; i--) {
      const explosion = this.explosions[i];

      explosion.timer += delta;

      if (explosion.expanding) {
        explosion.radius += 80 * dt;
        if (explosion.radius >= explosion.maxRadius) {
          explosion.expanding = false;
        }
      } else {
        explosion.radius -= 80 * dt;
      }

      if (explosion.timer > CONFIG.EXPLOSION_DURATION || explosion.radius <= 0) {
        explosion.graphics.destroy();
        this.explosions.splice(i, 1);
      }
    }

    // Check wave complete
    if (this.waveActive && this.enemyMissiles.length === 0) {
      this.waveComplete();
    }

    this.draw();
    this.updateAmmoDisplay();
  }

  fireMissile(): void {
    // Find battery with ammo closest to crosshair
    let closestBattery: Battery | null = null;
    let closestDist = Infinity;

    for (const battery of this.batteries) {
      if (battery.alive && battery.missiles > 0) {
        const dist = Math.abs(battery.x - this.crosshairX);
        if (dist < closestDist) {
          closestDist = dist;
          closestBattery = battery;
        }
      }
    }

    if (!closestBattery) return;

    closestBattery.missiles--;

    if (this.sounds && this.soundEnabled) {
      this.sounds.play('launch');
    }

    const dx = this.crosshairX - closestBattery.x;
    const dy = this.crosshairY - closestBattery.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    const graphics = this.add.graphics();

    this.missiles.push({
      x: closestBattery.x,
      y: closestBattery.y,
      targetX: this.crosshairX,
      targetY: this.crosshairY,
      vx: (dx / dist) * CONFIG.MISSILE_SPEED,
      vy: (dy / dist) * CONFIG.MISSILE_SPEED,
      graphics,
      trail: [],
    });
  }

  createExplosion(x: number, y: number): void {
    if (this.sounds && this.soundEnabled) {
      this.sounds.play('explode');
    }

    const graphics = this.add.graphics();

    this.explosions.push({
      x,
      y,
      radius: 0,
      maxRadius: CONFIG.EXPLOSION_MAX_RADIUS,
      expanding: true,
      timer: 0,
      graphics,
    });
  }

  hitTarget(x: number, y: number): void {
    // Check if city hit
    for (const city of this.cities) {
      if (city.alive && Math.abs(city.x - x) < 20 && Math.abs(city.y - y) < 20) {
        city.alive = false;
        if (this.sounds && this.soundEnabled) {
          this.sounds.play('baseHit');
        }
        this.createExplosion(x, y);
        return;
      }
    }

    // Check if battery hit
    for (const battery of this.batteries) {
      if (battery.alive && Math.abs(battery.x - x) < 20 && Math.abs(battery.y - y) < 20) {
        battery.alive = false;
        if (this.sounds && this.soundEnabled) {
          this.sounds.play('baseHit');
        }
        this.createExplosion(x, y);
        return;
      }
    }

    // Just create explosion if nothing hit
    this.createExplosion(x, y);
  }

  waveComplete(): void {
    this.waveActive = false;

    if (this.sounds && this.soundEnabled) {
      this.sounds.play('nextWave');
    }

    // Bonus points for surviving cities and batteries
    const aliveCities = this.cities.filter(c => c.alive).length;
    const aliveBatteries = this.batteries.filter(b => b.alive).length;

    const bonus = aliveCities * CONFIG.POINTS_PER_CITY + aliveBatteries * CONFIG.POINTS_PER_BATTERY;
    this.score += bonus;
    this.onScoreUpdate(this.score);
    this.scoreText.setText(`SCORE: ${this.score}`);

    // Check game over
    if (aliveCities === 0) {
      this.endGame();
      return;
    }

    // Reload batteries
    for (const battery of this.batteries) {
      if (battery.alive) {
        battery.missiles = CONFIG.MISSILES_PER_BATTERY;
      }
    }

    // Next wave
    this.wave++;
    this.time.delayedCall(CONFIG.WAVE_DELAY, () => {
      this.startWave();
    });
  }

  updateAmmoDisplay(): void {
    const ammo = this.batteries
      .filter(b => b.alive)
      .map((b, i) => `B${i + 1}:${b.missiles}`)
      .join('  ');
    this.ammoText.setText(ammo);
  }

  draw(): void {
    this.graphics.clear();

    // Draw ground
    this.graphics.fillStyle(0x654321);
    this.graphics.fillRect(0, this.scale.height - 20, this.scale.width, 20);

    // Draw cities
    for (const city of this.cities) {
      if (city.alive) {
        this.drawCity(city);
      }
    }

    // Draw batteries
    for (const battery of this.batteries) {
      if (battery.alive) {
        this.drawBattery(battery);
      }
    }

    // Draw missiles
    for (const missile of this.missiles) {
      this.drawMissile(missile, 0x00ff00);
    }

    // Draw enemy missiles
    for (const missile of this.enemyMissiles) {
      this.drawMissile(missile, 0xff0000);
    }

    // Draw explosions
    for (const explosion of this.explosions) {
      this.drawExplosion(explosion);
    }

    // Draw crosshair
    this.drawCrosshair();
  }

  drawCity(city: City): void {
    city.graphics.clear();

    // Simple city skyline
    city.graphics.fillStyle(0x00ffff);

    // Buildings
    city.graphics.fillRect(-12, -15, 8, 15);
    city.graphics.fillRect(-4, -20, 8, 20);
    city.graphics.fillRect(4, -12, 8, 12);

    // Windows
    city.graphics.fillStyle(0xffff00);
    city.graphics.fillRect(-10, -13, 2, 2);
    city.graphics.fillRect(-6, -13, 2, 2);
    city.graphics.fillRect(-10, -8, 2, 2);
    city.graphics.fillRect(-6, -8, 2, 2);

    city.graphics.fillRect(-2, -16, 2, 2);
    city.graphics.fillRect(2, -16, 2, 2);
    city.graphics.fillRect(-2, -11, 2, 2);
    city.graphics.fillRect(2, -11, 2, 2);

    city.graphics.fillRect(6, -9, 2, 2);
    city.graphics.fillRect(10, -9, 2, 2);

    city.graphics.setPosition(city.x, city.y);
  }

  drawBattery(battery: Battery): void {
    battery.graphics.clear();

    // Missile silo
    battery.graphics.fillStyle(0x00ff00);
    battery.graphics.fillRect(-10, -8, 20, 8);

    // Barrel/launcher
    battery.graphics.fillStyle(0x00cc00);
    battery.graphics.fillRect(-3, -15, 6, 8);

    battery.graphics.setPosition(battery.x, battery.y);
  }

  drawMissile(missile: Missile | EnemyMissile, color: number): void {
    missile.graphics.clear();

    // Draw trail
    missile.graphics.lineStyle(2, color, 0.5);
    for (let i = 0; i < missile.trail.length - 1; i++) {
      missile.graphics.lineBetween(
        missile.trail[i].x,
        missile.trail[i].y,
        missile.trail[i + 1].x,
        missile.trail[i + 1].y
      );
    }

    // Draw missile head
    missile.graphics.fillStyle(color);
    missile.graphics.fillCircle(missile.x, missile.y, 3);

    missile.graphics.setPosition(0, 0);
  }

  drawExplosion(explosion: Explosion): void {
    explosion.graphics.clear();

    // Colorful explosion
    const alpha = 1 - (explosion.timer / CONFIG.EXPLOSION_DURATION);

    explosion.graphics.fillStyle(0xffff00, alpha);
    explosion.graphics.fillCircle(0, 0, explosion.radius);

    explosion.graphics.fillStyle(0xff6600, alpha * 0.8);
    explosion.graphics.fillCircle(0, 0, explosion.radius * 0.7);

    explosion.graphics.fillStyle(0xff0000, alpha * 0.6);
    explosion.graphics.fillCircle(0, 0, explosion.radius * 0.4);

    explosion.graphics.setPosition(explosion.x, explosion.y);
  }

  drawCrosshair(): void {
    this.crosshairGraphics.clear();

    // White crosshair
    this.crosshairGraphics.lineStyle(2, 0xffffff);
    this.crosshairGraphics.strokeCircle(0, 0, 10);
    this.crosshairGraphics.lineBetween(-15, 0, -5, 0);
    this.crosshairGraphics.lineBetween(5, 0, 15, 0);
    this.crosshairGraphics.lineBetween(0, -15, 0, -5);
    this.crosshairGraphics.lineBetween(0, 5, 0, 15);

    this.crosshairGraphics.setPosition(this.crosshairX, this.crosshairY);
  }

  endGame(): void {
    this.gameOver = true;

    if (this.sounds && this.soundEnabled) {
      this.sounds.play('gameOver');
    }

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

    this.add.text(
      this.scale.width / 2,
      this.scale.height / 2 + 50,
      `WAVES SURVIVED: ${this.wave - 1}`,
      {
        fontFamily: '"Press Start 2P"',
        fontSize: '14px',
        color: '#00ffff',
      }
    ).setOrigin(0.5);

    this.time.delayedCall(3000, () => {
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
