import * as Phaser from 'phaser';
import { SeededRNG } from '../engine/SeededRNG';

const CONFIG = {
  PADDLE_WIDTH: 15,
  PADDLE_HEIGHT: 80,
  PADDLE_SPEED: 400,
  BALL_SIZE: 10,
  BALL_SPEED: 350,
  BALL_SPEED_INCREASE: 20,
  CPU_DIFFICULTY: 0.85, // AI reaction speed (0-1)
  WINNING_SCORE: 11,
  SERVE_DELAY: 1000,
};

export class PaddleBattleScene extends Phaser.Scene {
  private onScoreUpdate: (score: number) => void;
  private onGameOver: (finalScore: number) => void;
  private getDirection: () => { up: boolean; down: boolean; left: boolean; right: boolean };
  private getAction: () => boolean;

  private rng: SeededRNG;
  private score: number = 0;
  private cpuScore: number = 0;
  private gameOver: boolean = false;

  private playerPaddle!: Phaser.GameObjects.Graphics;
  private cpuPaddle!: Phaser.GameObjects.Graphics;
  private ball!: Phaser.GameObjects.Graphics;
  private ballVelocity: { x: number; y: number } = { x: 0, y: 0 };

  private scoreText!: Phaser.GameObjects.Text;
  private centerLine!: Phaser.GameObjects.Graphics;
  private serving: boolean = true;

  constructor(
    onScoreUpdate: (score: number) => void,
    onGameOver: (finalScore: number) => void,
    getDirection: () => { up: boolean; down: boolean; left: boolean; right: boolean },
    getAction: () => boolean,
    seed: number
  ) {
    super({ key: 'PaddleBattleScene' });
    this.onScoreUpdate = onScoreUpdate;
    this.onGameOver = onGameOver;
    this.getDirection = getDirection;
    this.getAction = getAction;
    this.rng = new SeededRNG(seed);
  }

  create(): void {
    const { width, height } = this.scale;

    // Draw center line
    this.centerLine = this.add.graphics();
    this.centerLine.lineStyle(2, 0xffffff, 0.3);
    for (let y = 0; y < height; y += 20) {
      this.centerLine.strokeRect(width / 2 - 2, y, 4, 10);
    }

    // Create paddles
    this.playerPaddle = this.add.graphics();
    this.playerPaddle.fillStyle(0x00ff41);
    this.playerPaddle.fillRect(
      -CONFIG.PADDLE_WIDTH / 2,
      -CONFIG.PADDLE_HEIGHT / 2,
      CONFIG.PADDLE_WIDTH,
      CONFIG.PADDLE_HEIGHT
    );
    this.playerPaddle.setPosition(30, height / 2);

    this.cpuPaddle = this.add.graphics();
    this.cpuPaddle.fillStyle(0xff0040);
    this.cpuPaddle.fillRect(
      -CONFIG.PADDLE_WIDTH / 2,
      -CONFIG.PADDLE_HEIGHT / 2,
      CONFIG.PADDLE_WIDTH,
      CONFIG.PADDLE_HEIGHT
    );
    this.cpuPaddle.setPosition(width - 30, height / 2);

    // Create ball
    this.ball = this.add.graphics();
    this.ball.fillStyle(0xffffff);
    this.ball.fillCircle(0, 0, CONFIG.BALL_SIZE);
    this.ball.setPosition(width / 2, height / 2);

    // Create score display
    this.scoreText = this.add.text(width / 2, 30, `${this.score} - ${this.cpuScore}`, {
      fontFamily: '"Press Start 2P"',
      fontSize: '24px',
      color: '#ffffff',
    }).setOrigin(0.5);

    // Start first serve
    this.time.delayedCall(CONFIG.SERVE_DELAY, () => {
      this.serveBall();
    });
  }

  serveBall(): void {
    const { height } = this.scale;
    this.ball.setPosition(this.scale.width / 2, height / 2);

    // Random serve direction
    const angle = this.rng.nextFloat(-0.5, 0.5);
    const direction = this.rng.next() > 0.5 ? 1 : -1;
    const speed = CONFIG.BALL_SPEED;

    this.ballVelocity = {
      x: Math.cos(angle) * speed * direction,
      y: Math.sin(angle) * speed,
    };

    this.serving = false;
  }

  update(time: number, delta: number): void {
    if (this.gameOver || this.serving) return;

    const dt = delta / 1000;
    const { width, height } = this.scale;

    // Player paddle controls
    const dir = this.getDirection();
    if (dir.up) {
      this.playerPaddle.y = Math.max(
        CONFIG.PADDLE_HEIGHT / 2,
        this.playerPaddle.y - CONFIG.PADDLE_SPEED * dt
      );
    }
    if (dir.down) {
      this.playerPaddle.y = Math.min(
        height - CONFIG.PADDLE_HEIGHT / 2,
        this.playerPaddle.y + CONFIG.PADDLE_SPEED * dt
      );
    }

    // CPU AI
    const cpuTarget = this.ball.y;
    const cpuCenter = this.cpuPaddle.y;
    const diff = cpuTarget - cpuCenter;

    if (Math.abs(diff) > 5) {
      const moveSpeed = CONFIG.PADDLE_SPEED * CONFIG.CPU_DIFFICULTY * dt;
      this.cpuPaddle.y = Math.max(
        CONFIG.PADDLE_HEIGHT / 2,
        Math.min(
          height - CONFIG.PADDLE_HEIGHT / 2,
          cpuCenter + Math.sign(diff) * moveSpeed
        )
      );
    }

    // Move ball
    this.ball.x += this.ballVelocity.x * dt;
    this.ball.y += this.ballVelocity.y * dt;

    // Ball collision with top/bottom
    if (this.ball.y - CONFIG.BALL_SIZE < 0 || this.ball.y + CONFIG.BALL_SIZE > height) {
      this.ballVelocity.y *= -1;
      this.ball.y = Math.max(CONFIG.BALL_SIZE, Math.min(height - CONFIG.BALL_SIZE, this.ball.y));
    }

    // Paddle collisions
    this.checkPaddleCollision(this.playerPaddle, true);
    this.checkPaddleCollision(this.cpuPaddle, false);

    // Score points
    if (this.ball.x < 0) {
      // CPU scores
      this.cpuScore++;
      this.updateScoreDisplay();
      this.resetBall();
    } else if (this.ball.x > width) {
      // Player scores
      this.score++;
      this.onScoreUpdate(this.score);
      this.updateScoreDisplay();
      this.resetBall();
    }

    // Check game over
    if (this.score >= CONFIG.WINNING_SCORE || this.cpuScore >= CONFIG.WINNING_SCORE) {
      this.endGame();
    }
  }

  checkPaddleCollision(paddle: Phaser.GameObjects.Graphics, isPlayer: boolean): void {
    const ballLeft = this.ball.x - CONFIG.BALL_SIZE;
    const ballRight = this.ball.x + CONFIG.BALL_SIZE;
    const ballTop = this.ball.y - CONFIG.BALL_SIZE;
    const ballBottom = this.ball.y + CONFIG.BALL_SIZE;

    const paddleLeft = paddle.x - CONFIG.PADDLE_WIDTH / 2;
    const paddleRight = paddle.x + CONFIG.PADDLE_WIDTH / 2;
    const paddleTop = paddle.y - CONFIG.PADDLE_HEIGHT / 2;
    const paddleBottom = paddle.y + CONFIG.PADDLE_HEIGHT / 2;

    if (
      ballRight > paddleLeft &&
      ballLeft < paddleRight &&
      ballBottom > paddleTop &&
      ballTop < paddleBottom
    ) {
      // Hit paddle
      this.ballVelocity.x *= -1;

      // Add angle based on hit position
      const hitPos = (this.ball.y - paddle.y) / (CONFIG.PADDLE_HEIGHT / 2);
      this.ballVelocity.y += hitPos * 100;

      // Increase speed slightly
      const speed = Math.sqrt(this.ballVelocity.x ** 2 + this.ballVelocity.y ** 2);
      const newSpeed = Math.min(speed + CONFIG.BALL_SPEED_INCREASE, CONFIG.BALL_SPEED * 2);
      const angle = Math.atan2(this.ballVelocity.y, this.ballVelocity.x);
      this.ballVelocity.x = Math.cos(angle) * newSpeed;
      this.ballVelocity.y = Math.sin(angle) * newSpeed;

      // Move ball out of paddle
      this.ball.x = isPlayer ? paddleRight + CONFIG.BALL_SIZE : paddleLeft - CONFIG.BALL_SIZE;
    }
  }

  resetBall(): void {
    this.serving = true;
    this.time.delayedCall(CONFIG.SERVE_DELAY, () => {
      this.serveBall();
    });
  }

  updateScoreDisplay(): void {
    this.scoreText.setText(`${this.score} - ${this.cpuScore}`);
  }

  endGame(): void {
    this.gameOver = true;

    const wonGame = this.score >= CONFIG.WINNING_SCORE;
    const finalScore = wonGame ? this.score * 100 : 0; // Only count if player wins

    this.add.text(this.scale.width / 2, this.scale.height / 2,
      wonGame ? 'YOU WIN!' : 'CPU WINS!', {
      fontFamily: '"Press Start 2P"',
      fontSize: '32px',
      color: wonGame ? '#00ff41' : '#ff0040',
    }).setOrigin(0.5);

    this.time.delayedCall(2000, () => {
      this.onGameOver(finalScore);
    });
  }
}
