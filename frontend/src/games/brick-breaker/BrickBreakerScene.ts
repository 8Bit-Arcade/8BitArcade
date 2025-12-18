import * as Phaser from 'phaser';
import { SeededRNG } from '../engine/SeededRNG';
import { RetroSounds } from '../engine/RetroSounds';

const CONFIG = {
  PADDLE_WIDTH: 100,
  PADDLE_HEIGHT: 15,
  PADDLE_SPEED: 500,
  BALL_SIZE: 10,
  BALL_SPEED: 400,
  BALL_SPEED_INCREASE: 20,
  BRICK_WIDTH: 70,
  BRICK_HEIGHT: 25,
  BRICK_ROWS: 6,
  BRICK_COLS: 10,
  BRICK_POINTS: [100, 80, 60, 50, 40, 30],
  BRICK_COLORS: [0xff0040, 0xff6600, 0xffff00, 0x00ff41, 0x00f5ff, 0xff00ff],
  LIVES: 3,
};

export class BrickBreakerScene extends Phaser.Scene {
  private onScoreUpdate: (score: number) => void;
  private onGameOver: (finalScore: number) => void;
  private getDirection: () => { up: boolean; down: boolean; left: boolean; right: boolean };
  private getAction: () => boolean;

  private rng: SeededRNG;
  private score: number = 0;
  private lives: number = CONFIG.LIVES;
  private level: number = 1;
  private gameOver: boolean = false;
  private ballLaunched: boolean = false;

  private paddle!: Phaser.GameObjects.Graphics;
  private ball!: Phaser.GameObjects.Graphics;
  private ballVelocity: { x: number; y: number } = { x: 0, y: 0 };
  private bricks: Phaser.GameObjects.Graphics[] = [];

  private livesText!: Phaser.GameObjects.Text;
  private levelText!: Phaser.GameObjects.Text;
  private instructionText!: Phaser.GameObjects.Text;

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
    super({ key: 'BrickBreakerScene' });
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
        this.sounds.registerSound('launch', this.sounds.generateBeep(600, 0.1));
        this.sounds.registerSound('paddleHit', this.sounds.generateBeep(440, 0.08));
        this.sounds.registerSound('wallBounce', this.sounds.generateBeep(330, 0.06));
        this.sounds.registerSound('brickBreak', this.sounds.generateCoin());
        this.sounds.registerSound('nextLevel', this.sounds.generatePowerUp());
        this.sounds.registerSound('loseLife', this.sounds.generateHit());
        this.sounds.registerSound('gameOver', this.sounds.generateGameOver());
      } catch (e) {
        console.warn('Failed to initialize audio:', e);
        this.sounds = null;
      }
    }
  }

  create(): void {
    const { width, height } = this.scale;

    // Setup cleanup handler
    this.events.on('shutdown', this.onShutdown, this);

    // Create paddle
    this.paddle = this.add.graphics();
    this.paddle.fillStyle(0x00ff41);
    this.paddle.fillRect(
      -CONFIG.PADDLE_WIDTH / 2,
      -CONFIG.PADDLE_HEIGHT / 2,
      CONFIG.PADDLE_WIDTH,
      CONFIG.PADDLE_HEIGHT
    );
    this.paddle.setPosition(width / 2, height - 40);
    this.paddle.setDepth(1); // Paddle renders above bricks

    // Create ball
    this.ball = this.add.graphics();
    this.ball.fillStyle(0xffffff);
    this.ball.fillCircle(0, 0, CONFIG.BALL_SIZE);
    this.ball.setDepth(1); // Ball renders above bricks
    this.resetBall();

    // Create bricks
    this.createBricks();

    // UI
    this.livesText = this.add.text(16, height - 25, `LIVES: ${this.lives}`, {
      fontFamily: '"Press Start 2P"',
      fontSize: '10px',
      color: '#00ff41',
    });
    this.livesText.setDepth(2); // UI renders on top

    this.levelText = this.add.text(width - 16, height - 25, `LEVEL ${this.level}`, {
      fontFamily: '"Press Start 2P"',
      fontSize: '10px',
      color: '#00f5ff',
    }).setOrigin(1, 0);
    this.levelText.setDepth(2); // UI renders on top

    this.instructionText = this.add.text(width / 2, height / 2 + 100, 'PRESS FIRE TO LAUNCH', {
      fontFamily: '"Press Start 2P"',
      fontSize: '12px',
      color: '#ffffff',
    }).setOrigin(0.5);
    this.instructionText.setDepth(2); // UI renders on top
  }

  createBricks(): void {
    const { width } = this.scale;
    const startX = (width - CONFIG.BRICK_COLS * (CONFIG.BRICK_WIDTH + 5)) / 2 + CONFIG.BRICK_WIDTH / 2;
    const startY = 60;

    for (let row = 0; row < CONFIG.BRICK_ROWS; row++) {
      for (let col = 0; col < CONFIG.BRICK_COLS; col++) {
        const brick = this.add.graphics();
        brick.fillStyle(CONFIG.BRICK_COLORS[row]);
        brick.fillRect(
          -CONFIG.BRICK_WIDTH / 2,
          -CONFIG.BRICK_HEIGHT / 2,
          CONFIG.BRICK_WIDTH,
          CONFIG.BRICK_HEIGHT
        );
        brick.lineStyle(2, 0xffffff, 0.3);
        brick.strokeRect(
          -CONFIG.BRICK_WIDTH / 2,
          -CONFIG.BRICK_HEIGHT / 2,
          CONFIG.BRICK_WIDTH,
          CONFIG.BRICK_HEIGHT
        );

        const x = startX + col * (CONFIG.BRICK_WIDTH + 5);
        const y = startY + row * (CONFIG.BRICK_HEIGHT + 5);
        brick.setPosition(x, y);
        brick.setDepth(0); // Bricks render below ball and paddle
        brick.setData('row', row);
        brick.setData('active', true);

        this.bricks.push(brick);
      }
    }
  }

  resetBall(): void {
    this.ball.setPosition(this.paddle.x, this.paddle.y - 20);
    this.ballVelocity = { x: 0, y: 0 };
    this.ballLaunched = false;
  }

  launchBall(): void {
    if (this.ballLaunched) return;

    this.ballLaunched = true;
    this.instructionText.setVisible(false);

    // Play launch sound
    if (this.sounds && this.soundEnabled) {
      this.sounds.play('launch');
    }

    // Random angle between -45 and 45 degrees upward
    const angle = this.rng.nextFloat(-0.7, 0.7) - Math.PI / 2;
    const speed = CONFIG.BALL_SPEED + (this.level - 1) * CONFIG.BALL_SPEED_INCREASE;
    this.ballVelocity = {
      x: Math.cos(angle) * speed,
      y: Math.sin(angle) * speed,
    };
  }

  loseLife(): void {
    this.lives--;
    this.livesText.setText(`LIVES: ${this.lives}`);

    // Play lose life sound
    if (this.sounds && this.soundEnabled) {
      this.sounds.play('loseLife');
    }

    if (this.lives <= 0) {
      this.endGame();
    } else {
      this.resetBall();
      this.instructionText.setVisible(true);
    }
  }

  checkBrickCollision(): void {
    const ballX = this.ball.x;
    const ballY = this.ball.y;

    for (const brick of this.bricks) {
      if (!brick.getData('active')) continue;

      const brickX = brick.x;
      const brickY = brick.y;

      // Simple AABB collision
      if (
        ballX + CONFIG.BALL_SIZE > brickX - CONFIG.BRICK_WIDTH / 2 &&
        ballX - CONFIG.BALL_SIZE < brickX + CONFIG.BRICK_WIDTH / 2 &&
        ballY + CONFIG.BALL_SIZE > brickY - CONFIG.BRICK_HEIGHT / 2 &&
        ballY - CONFIG.BALL_SIZE < brickY + CONFIG.BRICK_HEIGHT / 2
      ) {
        // Hit brick
        brick.setData('active', false);
        brick.setVisible(false);

        // Play brick break sound
        if (this.sounds && this.soundEnabled) {
          this.sounds.play('brickBreak');
        }

        // Score
        const row = brick.getData('row');
        this.score += CONFIG.BRICK_POINTS[row];
        this.onScoreUpdate(this.score);

        // Bounce (determine direction)
        const overlapLeft = ballX + CONFIG.BALL_SIZE - (brickX - CONFIG.BRICK_WIDTH / 2);
        const overlapRight = brickX + CONFIG.BRICK_WIDTH / 2 - (ballX - CONFIG.BALL_SIZE);
        const overlapTop = ballY + CONFIG.BALL_SIZE - (brickY - CONFIG.BRICK_HEIGHT / 2);
        const overlapBottom = brickY + CONFIG.BRICK_HEIGHT / 2 - (ballY - CONFIG.BALL_SIZE);

        const minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom);

        if (minOverlap === overlapTop || minOverlap === overlapBottom) {
          this.ballVelocity.y *= -1;
        } else {
          this.ballVelocity.x *= -1;
        }

        // Check level complete
        const activeBricks = this.bricks.filter((b) => b.getData('active'));
        if (activeBricks.length === 0) {
          this.nextLevel();
        }

        return;
      }
    }
  }

  nextLevel(): void {
    this.level++;
    this.levelText.setText(`LEVEL ${this.level}`);

    // Play next level sound
    if (this.sounds && this.soundEnabled) {
      this.sounds.play('nextLevel');
    }

    // Reset bricks
    this.bricks.forEach((brick) => {
      brick.setData('active', true);
      brick.setVisible(true);
    });

    this.resetBall();
    this.instructionText.setVisible(true);
  }

  endGame(): void {
    this.gameOver = true;

    // Play game over sound
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

  onShutdown(): void {
    if (this.sounds) {
      this.sounds.destroy();
      this.sounds = null;
    }
  }

  update(time: number, delta: number): void {
    if (this.gameOver) return;

    const { width, height } = this.scale;
    const direction = this.getDirection();
    const action = this.getAction();

    // Move paddle
    if (direction.left) {
      this.paddle.x -= CONFIG.PADDLE_SPEED * (delta / 1000);
    }
    if (direction.right) {
      this.paddle.x += CONFIG.PADDLE_SPEED * (delta / 1000);
    }

    // Clamp paddle
    this.paddle.x = Phaser.Math.Clamp(
      this.paddle.x,
      CONFIG.PADDLE_WIDTH / 2,
      width - CONFIG.PADDLE_WIDTH / 2
    );

    // Launch ball
    if (action && !this.ballLaunched) {
      this.launchBall();
    }

    // Ball follows paddle before launch
    if (!this.ballLaunched) {
      this.ball.x = this.paddle.x;
      return;
    }

    // Move ball
    this.ball.x += this.ballVelocity.x * (delta / 1000);
    this.ball.y += this.ballVelocity.y * (delta / 1000);

    // Wall collisions
    if (this.ball.x <= CONFIG.BALL_SIZE || this.ball.x >= width - CONFIG.BALL_SIZE) {
      this.ballVelocity.x *= -1;
      this.ball.x = Phaser.Math.Clamp(this.ball.x, CONFIG.BALL_SIZE, width - CONFIG.BALL_SIZE);

      // Play wall bounce sound
      if (this.sounds && this.soundEnabled) {
        this.sounds.play('wallBounce');
      }
    }
    if (this.ball.y <= CONFIG.BALL_SIZE) {
      this.ballVelocity.y *= -1;
      this.ball.y = CONFIG.BALL_SIZE;

      // Play wall bounce sound
      if (this.sounds && this.soundEnabled) {
        this.sounds.play('wallBounce');
      }
    }

    // Bottom - lose life
    if (this.ball.y >= height) {
      this.loseLife();
      return;
    }

    // Paddle collision
    if (
      this.ball.y + CONFIG.BALL_SIZE >= this.paddle.y - CONFIG.PADDLE_HEIGHT / 2 &&
      this.ball.y < this.paddle.y &&
      this.ball.x >= this.paddle.x - CONFIG.PADDLE_WIDTH / 2 &&
      this.ball.x <= this.paddle.x + CONFIG.PADDLE_WIDTH / 2
    ) {
      // Play paddle hit sound
      if (this.sounds && this.soundEnabled) {
        this.sounds.play('paddleHit');
      }

      // Bounce angle based on where ball hit paddle
      const hitPos = (this.ball.x - this.paddle.x) / (CONFIG.PADDLE_WIDTH / 2);
      const angle = hitPos * 0.7 - Math.PI / 2;
      const speed = Math.sqrt(
        this.ballVelocity.x ** 2 + this.ballVelocity.y ** 2
      );

      this.ballVelocity.x = Math.cos(angle) * speed;
      this.ballVelocity.y = Math.sin(angle) * speed;

      this.ball.y = this.paddle.y - CONFIG.PADDLE_HEIGHT / 2 - CONFIG.BALL_SIZE;
    }

    // Brick collisions
    this.checkBrickCollision();
  }
}

export default BrickBreakerScene;
