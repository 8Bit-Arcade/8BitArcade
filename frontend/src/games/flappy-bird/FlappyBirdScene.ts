import * as Phaser from 'phaser';
import { SeededRNG } from '../engine/SeededRNG';
import { RetroSounds } from '../engine/RetroSounds';

const CONFIG = {
  BIRD_X: 100,
  GRAVITY: 800,
  FLAP_VELOCITY: -300,
  PIPE_SPEED_START: 150,
  PIPE_SPEED_MAX: 280,
  PIPE_SPAWN_INTERVAL_START: 2800,
  PIPE_SPAWN_INTERVAL_MIN: 1600,
  PIPE_WIDTH: 60,
  PIPE_GAP_START: 200,
  PIPE_GAP_MIN: 110,
  PIPE_MIN_HEIGHT: 80,
  PIPE_MAX_HEIGHT: 300,
  POINTS_PER_PIPE: 1,
  DIFFICULTY_INCREASE_RATE: 0.015, // How fast difficulty increases per point
};

interface Pipe {
  topGraphics: Phaser.GameObjects.Graphics;
  bottomGraphics: Phaser.GameObjects.Graphics;
  x: number;
  gapY: number;
  gapSize: number;
  scored: boolean;
}

export class FlappyBirdScene extends Phaser.Scene {
  private onScoreUpdate: (score: number) => void;
  private onGameOver: (finalScore: number) => void;
  private getDirection: () => { up: boolean; down: boolean; left: boolean; right: boolean };
  private getAction: () => boolean;

  private rng: SeededRNG;
  private score: number = 0;
  private gameOver: boolean = false;
  private gameStarted: boolean = false;

  private bird!: Phaser.GameObjects.Graphics;
  private birdY: number = 0;
  private birdVelocity: number = 0;
  private birdAngle: number = 0;

  private pipes: Pipe[] = [];
  private pipeSpawnTimer: number = 0;

  private scoreText!: Phaser.GameObjects.Text;
  private instructionText!: Phaser.GameObjects.Text;
  private lastFlap: boolean = false;

  private backgroundGraphics!: Phaser.GameObjects.Graphics;
  private cloudGraphics!: Phaser.GameObjects.Graphics;
  private groundGraphics!: Phaser.GameObjects.Graphics;
  private groundOffset: number = 0;
  private cloudPositions: Array<{ x: number; y: number }> = [];

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
    super({ key: 'FlappyBirdScene' });
    this.onScoreUpdate = onScoreUpdate;
    this.onGameOver = onGameOver;
    this.getDirection = getDirection;
    this.getAction = getAction;
    this.rng = new SeededRNG(seed);
    this.soundEnabled = soundEnabled;

    // Initialize sound system
    if (this.soundEnabled) {
      try {
        this.sounds = new RetroSounds(soundVolume);
        // Register sounds
        this.sounds.registerSound('flap', this.sounds.generateJump());
        this.sounds.registerSound('score', this.sounds.generateCoin());
        this.sounds.registerSound('hit', this.sounds.generateHit());
        this.sounds.registerSound('gameOver', this.sounds.generateGameOver());
      } catch (e) {
        console.warn('Failed to initialize audio:', e);
        this.sounds = null;
      }
    }
  }

  create(): void {
    // Initialize bird position
    this.birdY = this.scale.height / 2;

    // Setup cleanup handler
    this.events.on('shutdown', this.onShutdown, this);

    // Draw background (sky)
    this.backgroundGraphics = this.add.graphics();
    this.drawBackground();

    // Create static cloud positions
    this.cloudPositions = [
      { x: 60, y: 80 },
      { x: 200, y: 120 },
      { x: 340, y: 60 },
      { x: 120, y: 180 },
      { x: 280, y: 150 },
    ];

    // Draw clouds (once, static)
    this.cloudGraphics = this.add.graphics();
    this.drawClouds();

    // Draw ground
    this.groundGraphics = this.add.graphics();
    this.drawGround();

    // Create bird
    this.bird = this.add.graphics();
    this.drawBird();

    // Score text
    this.scoreText = this.add.text(this.scale.width / 2, 50, '0', {
      fontFamily: 'monospace',
      fontSize: '48px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 4,
    });
    this.scoreText.setOrigin(0.5, 0.5);
    this.scoreText.setDepth(10);

    // Instruction text
    this.instructionText = this.add.text(
      this.scale.width / 2,
      this.scale.height / 2 + 80,
      'TAP TO START',
      {
        fontFamily: 'monospace',
        fontSize: '20px',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 3,
      }
    );
    this.instructionText.setOrigin(0.5, 0.5);
    this.instructionText.setDepth(10);
  }

  drawBackground(): void {
    this.backgroundGraphics.clear();

    // Sky gradient (light blue to darker blue)
    this.backgroundGraphics.fillStyle(0x4ec0ca, 1);
    this.backgroundGraphics.fillRect(0, 0, this.scale.width, this.scale.height);
  }

  drawClouds(): void {
    this.cloudGraphics.clear();

    // Draw static clouds
    for (const pos of this.cloudPositions) {
      this.drawCloud(this.cloudGraphics, pos.x, pos.y);
    }
  }

  drawCloud(graphics: Phaser.GameObjects.Graphics, x: number, y: number): void {
    graphics.fillStyle(0xffffff, 0.6);
    graphics.fillCircle(x, y, 20);
    graphics.fillCircle(x + 20, y, 25);
    graphics.fillCircle(x + 40, y, 20);
    graphics.fillCircle(x + 20, y - 15, 18);
  }

  drawGround(): void {
    const groundY = this.scale.height - 80;
    this.groundGraphics.clear();

    // Ground (dirt)
    this.groundGraphics.fillStyle(0xded895, 1);
    this.groundGraphics.fillRect(0, groundY, this.scale.width, 80);

    // Grass on top
    this.groundGraphics.fillStyle(0x7ec850, 1);
    this.groundGraphics.fillRect(0, groundY, this.scale.width, 20);

    // Grass blades pattern
    for (let i = 0; i < this.scale.width / 10; i++) {
      const x = (i * 10 + this.groundOffset) % this.scale.width;
      this.groundGraphics.fillStyle(0x66aa44, 1);
      this.groundGraphics.fillTriangle(
        x, groundY + 20,
        x + 3, groundY + 5,
        x + 6, groundY + 20
      );
    }
  }

  drawBird(): void {
    this.bird.clear();

    const x = CONFIG.BIRD_X;
    const y = this.birdY;

    // Rotate based on velocity
    this.birdAngle = Math.max(-30, Math.min(45, this.birdVelocity / 10));

    this.bird.save();
    this.bird.translateCanvas(x, y);
    this.bird.rotateCanvas((this.birdAngle * Math.PI) / 180);

    // Body (yellow circle)
    this.bird.fillStyle(0xffdc5a, 1);
    this.bird.fillCircle(0, 0, 15);

    // Wing
    this.bird.fillStyle(0xffa500, 1);
    const wingY = Math.sin(Date.now() / 100) * 3;
    this.bird.fillEllipse(-5, wingY, 12, 8);

    // Eye (white)
    this.bird.fillStyle(0xffffff, 1);
    this.bird.fillCircle(8, -5, 5);

    // Pupil (black)
    this.bird.fillStyle(0x000000, 1);
    this.bird.fillCircle(10, -5, 3);

    // Beak (orange)
    this.bird.fillStyle(0xff8c00, 1);
    this.bird.fillTriangle(
      12, 0,
      22, -2,
      22, 2
    );

    this.bird.restore();
  }

  getCurrentPipeGap(): number {
    // Gradually decrease gap size based on score
    const progress = Math.min(1, this.score * CONFIG.DIFFICULTY_INCREASE_RATE);
    return CONFIG.PIPE_GAP_START - (CONFIG.PIPE_GAP_START - CONFIG.PIPE_GAP_MIN) * progress;
  }

  getCurrentSpawnInterval(): number {
    // Gradually decrease spawn interval based on score
    const progress = Math.min(1, this.score * CONFIG.DIFFICULTY_INCREASE_RATE);
    return CONFIG.PIPE_SPAWN_INTERVAL_START - (CONFIG.PIPE_SPAWN_INTERVAL_START - CONFIG.PIPE_SPAWN_INTERVAL_MIN) * progress;
  }

  getCurrentPipeSpeed(): number {
    // Gradually increase pipe speed based on score
    const progress = Math.min(1, this.score * CONFIG.DIFFICULTY_INCREASE_RATE);
    return CONFIG.PIPE_SPEED_START + (CONFIG.PIPE_SPEED_MAX - CONFIG.PIPE_SPEED_START) * progress;
  }

  spawnPipe(): void {
    const currentGap = this.getCurrentPipeGap();
    const minGapY = CONFIG.PIPE_MIN_HEIGHT + currentGap / 2;
    const maxGapY = this.scale.height - 80 - CONFIG.PIPE_MIN_HEIGHT - currentGap / 2;
    const gapY = minGapY + this.rng.next() * (maxGapY - minGapY);

    const topGraphics = this.add.graphics();
    const bottomGraphics = this.add.graphics();

    this.pipes.push({
      topGraphics,
      bottomGraphics,
      x: this.scale.width,
      gapY,
      gapSize: currentGap,
      scored: false,
    });

    this.drawPipe(this.pipes[this.pipes.length - 1]);
  }

  drawPipe(pipe: Pipe): void {
    pipe.topGraphics.clear();
    pipe.bottomGraphics.clear();

    const groundY = this.scale.height - 80;
    const topHeight = pipe.gapY - pipe.gapSize / 2;
    const bottomY = pipe.gapY + pipe.gapSize / 2;
    const bottomHeight = groundY - bottomY;

    // Top pipe
    // Pipe body (green)
    pipe.topGraphics.fillStyle(0x5cbd65, 1);
    pipe.topGraphics.fillRect(pipe.x, 0, CONFIG.PIPE_WIDTH, topHeight);

    // Pipe rim (darker green)
    pipe.topGraphics.fillStyle(0x4a9d52, 1);
    pipe.topGraphics.fillRect(pipe.x - 5, topHeight - 30, CONFIG.PIPE_WIDTH + 10, 30);

    // Pipe outline
    pipe.topGraphics.lineStyle(3, 0x3d7a42, 1);
    pipe.topGraphics.strokeRect(pipe.x, 0, CONFIG.PIPE_WIDTH, topHeight);
    pipe.topGraphics.strokeRect(pipe.x - 5, topHeight - 30, CONFIG.PIPE_WIDTH + 10, 30);

    // Highlights
    pipe.topGraphics.fillStyle(0x78d67f, 1);
    pipe.topGraphics.fillRect(pipe.x + 5, 0, 8, topHeight);

    // Bottom pipe
    // Pipe rim (darker green)
    pipe.bottomGraphics.fillStyle(0x4a9d52, 1);
    pipe.bottomGraphics.fillRect(pipe.x - 5, bottomY, CONFIG.PIPE_WIDTH + 10, 30);

    // Pipe body (green)
    pipe.bottomGraphics.fillStyle(0x5cbd65, 1);
    pipe.bottomGraphics.fillRect(pipe.x, bottomY + 30, CONFIG.PIPE_WIDTH, bottomHeight - 30);

    // Pipe outline
    pipe.bottomGraphics.lineStyle(3, 0x3d7a42, 1);
    pipe.bottomGraphics.strokeRect(pipe.x - 5, bottomY, CONFIG.PIPE_WIDTH + 10, 30);
    pipe.bottomGraphics.strokeRect(pipe.x, bottomY + 30, CONFIG.PIPE_WIDTH, bottomHeight - 30);

    // Highlights
    pipe.bottomGraphics.fillStyle(0x78d67f, 1);
    pipe.bottomGraphics.fillRect(pipe.x + 5, bottomY + 30, 8, bottomHeight - 30);
  }

  flap(): void {
    if (!this.gameStarted) {
      this.gameStarted = true;
      this.instructionText.setVisible(false);
      this.pipeSpawnTimer = CONFIG.PIPE_SPAWN_INTERVAL_START;
    }
    this.birdVelocity = CONFIG.FLAP_VELOCITY;

    // Play flap sound
    if (this.sounds && this.soundEnabled) {
      this.sounds.play('flap');
    }
  }

  onShutdown(): void {
    if (this.sounds) {
      this.sounds.destroy();
      this.sounds = null;
    }
  }

  checkCollision(): boolean {
    const groundY = this.scale.height - 80;

    // Check ground collision
    if (this.birdY + 15 >= groundY || this.birdY - 15 <= 0) {
      return true;
    }

    // Check pipe collision
    const birdLeft = CONFIG.BIRD_X - 15;
    const birdRight = CONFIG.BIRD_X + 15;
    const birdTop = this.birdY - 15;
    const birdBottom = this.birdY + 15;

    for (const pipe of this.pipes) {
      const pipeLeft = pipe.x;
      const pipeRight = pipe.x + CONFIG.PIPE_WIDTH;

      // Check if bird is horizontally aligned with pipe
      if (birdRight > pipeLeft && birdLeft < pipeRight) {
        const topPipeBottom = pipe.gapY - pipe.gapSize / 2;
        const bottomPipeTop = pipe.gapY + pipe.gapSize / 2;

        // Check if bird hit top or bottom pipe
        if (birdTop < topPipeBottom || birdBottom > bottomPipeTop) {
          return true;
        }
      }
    }

    return false;
  }

  getMedalType(score: number): string {
    if (score >= 40) return 'platinum';
    if (score >= 30) return 'gold';
    if (score >= 20) return 'silver';
    if (score >= 10) return 'bronze';
    return 'none';
  }

  update(time: number, delta: number): void {
    if (this.gameOver) return;

    const dt = delta / 1000;
    const action = this.getAction();

    // Handle flap input (detect button press, not hold)
    if (action && !this.lastFlap) {
      this.flap();
    }
    this.lastFlap = action;

    if (this.gameStarted) {
      // Apply gravity
      this.birdVelocity += CONFIG.GRAVITY * dt;
      this.birdY += this.birdVelocity * dt;

      // Get current speed for progressive difficulty
      const currentSpeed = this.getCurrentPipeSpeed();

      // Animate ground scrolling
      this.groundOffset += currentSpeed * dt;
      if (this.groundOffset >= 10) {
        this.groundOffset = 0;
      }
      this.drawGround();

      // Spawn pipes with progressive difficulty
      this.pipeSpawnTimer -= delta;
      if (this.pipeSpawnTimer <= 0) {
        this.spawnPipe();
        this.pipeSpawnTimer = this.getCurrentSpawnInterval();
      }

      // Update pipes
      for (let i = this.pipes.length - 1; i >= 0; i--) {
        const pipe = this.pipes[i];
        pipe.x -= currentSpeed * dt;

        // Score when bird passes pipe
        if (!pipe.scored && pipe.x + CONFIG.PIPE_WIDTH < CONFIG.BIRD_X) {
          pipe.scored = true;
          this.score += CONFIG.POINTS_PER_PIPE;
          this.scoreText.setText(this.score.toString());
          this.onScoreUpdate(this.score);

          // Play score sound
          if (this.sounds && this.soundEnabled) {
            this.sounds.play('score');
          }
        }

        // Remove off-screen pipes
        if (pipe.x + CONFIG.PIPE_WIDTH < -10) {
          pipe.topGraphics.destroy();
          pipe.bottomGraphics.destroy();
          this.pipes.splice(i, 1);
        } else {
          this.drawPipe(pipe);
        }
      }

      // Check collision
      if (this.checkCollision()) {
        this.gameOver = true;

        // Play hit and game over sounds
        if (this.sounds && this.soundEnabled) {
          this.sounds.play('hit');
          setTimeout(() => {
            if (this.sounds && this.soundEnabled) {
              this.sounds.play('gameOver');
            }
          }, 200);
        }

        this.onGameOver(this.score);
      }
    }

    // Always update bird animation
    this.drawBird();
  }
}
