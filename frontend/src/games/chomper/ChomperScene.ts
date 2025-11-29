import * as Phaser from 'phaser';
import { SeededRNG } from '../engine/SeededRNG';

const CONFIG = {
  TILE_SIZE: 24,
  PLAYER_SPEED: 90,
  GHOST_SPEED: 85,
  FRIGHTENED_SPEED: 60,
  PELLET_POINTS: 10,
  POWER_PELLET_POINTS: 50,
  GHOST_POINTS: 200,
  POWER_DURATION: 6000,
  LIVES: 3,
  GHOST_RELEASE_DELAY: 2000,
};

// Classic Pac-Man style maze (28x31 grid)
const MAZE = [
  '############################',
  '#............##............#',
  '#.####.#####.##.#####.####.#',
  '#o####.#####.##.#####.####o#',
  '#.####.#####.##.#####.####.#',
  '#..........................#',
  '#.####.##.########.##.####.#',
  '#.####.##.########.##.####.#',
  '#......##....##....##......#',
  '######.##### ## #####.######',
  '######.##### ## #####.######',
  '######.##          ##.######',
  '######.## ###--### ##.######',
  '######.## #      # ##.######',
  '      .   #      #   .      ',
  '######.## #      # ##.######',
  '######.## ######## ##.######',
  '######.##          ##.######',
  '######.## ######## ##.######',
  '######.## ######## ##.######',
  '#............##............#',
  '#.####.#####.##.#####.####.#',
  '#.####.#####.##.#####.####.#',
  '#o..##.......  .......##..o#',
  '###.##.##.########.##.##.###',
  '###.##.##.########.##.##.###',
  '#......##....##....##......#',
  '#.##########.##.##########.#',
  '#.##########.##.##########.#',
  '#..........................#',
  '############################',
];

const GHOST_COLORS = {
  red: 0xff0000,
  pink: 0xffb8ff,
  cyan: 0x00ffff,
  orange: 0xffb851,
};

interface Ghost {
  graphics: Phaser.GameObjects.Graphics;
  gridX: number;
  gridY: number;
  targetGridX: number;
  targetGridY: number;
  color: number;
  name: string;
  frightened: boolean;
  eaten: boolean;
  homeX: number;
  homeY: number;
  released: boolean;
}

export class ChomperScene extends Phaser.Scene {
  private onScoreUpdate: (score: number) => void;
  private onGameOver: (finalScore: number) => void;
  private getDirection: () => { up: boolean; down: boolean; left: boolean; right: boolean };
  private getAction: () => boolean;

  private rng: SeededRNG;
  private score: number = 0;
  private lives: number = CONFIG.LIVES;
  private gameOver: boolean = false;
  private paused: boolean = false;

  // Game state
  private maze: string[] = [];
  private player!: Phaser.GameObjects.Graphics;
  private playerGridX: number = 14;
  private playerGridY: number = 23;
  private playerX: number = 0;
  private playerY: number = 0;
  private playerDir: { x: number; y: number } = { x: 0, y: 0 };
  private nextDir: { x: number; y: number } = { x: 0, y: 0 };
  private mouthAngle: number = 0;

  private ghosts: Ghost[] = [];
  private powered: boolean = false;
  private powerTimer: number = 0;
  private ghostReleaseTimer: number = 0;

  private pelletsRemaining: number = 0;
  private mazeGraphics!: Phaser.GameObjects.Graphics;
  private pelletGraphics!: Phaser.GameObjects.Graphics;
  private livesText!: Phaser.GameObjects.Text;

  constructor(
    onScoreUpdate: (score: number) => void,
    onGameOver: (finalScore: number) => void,
    getDirection: () => { up: boolean; down: boolean; left: boolean; right: boolean },
    getAction: () => boolean,
    seed: number
  ) {
    super({ key: 'ChomperScene' });
    this.onScoreUpdate = onScoreUpdate;
    this.onGameOver = onGameOver;
    this.getDirection = getDirection;
    this.getAction = getAction;
    this.rng = new SeededRNG(seed);
  }

  create(): void {
    this.maze = MAZE.map(row => row);

    // Count pellets
    this.pelletsRemaining = this.maze.join('').split('.').length - 1 +
                            this.maze.join('').split('o').length - 1;

    // Create graphics layers
    this.mazeGraphics = this.add.graphics();
    this.pelletGraphics = this.add.graphics();

    this.drawMaze();
    this.drawPellets();

    // Create player
    this.player = this.add.graphics();
    this.playerX = this.playerGridX * CONFIG.TILE_SIZE + CONFIG.TILE_SIZE / 2;
    this.playerY = this.playerGridY * CONFIG.TILE_SIZE + CONFIG.TILE_SIZE / 2;
    this.drawPlayer();

    // Create ghosts
    this.createGhosts();

    // UI
    this.livesText = this.add.text(8, this.scale.height - 24, `LIVES: ${this.lives}`, {
      fontFamily: '"Press Start 2P"',
      fontSize: '12px',
      color: '#ffff00',
    });

    // Add ready text
    const readyText = this.add.text(
      this.scale.width / 2,
      17 * CONFIG.TILE_SIZE,
      'READY!',
      {
        fontFamily: '"Press Start 2P"',
        fontSize: '16px',
        color: '#ffff00',
      }
    ).setOrigin(0.5);

    this.paused = true;
    this.time.delayedCall(2000, () => {
      readyText.destroy();
      this.paused = false;
    });
  }

  createGhosts(): void {
    const ghostData = [
      { name: 'red', color: GHOST_COLORS.red, gridX: 14, gridY: 11, released: true },
      { name: 'pink', color: GHOST_COLORS.pink, gridX: 14, gridY: 14, released: false },
      { name: 'cyan', color: GHOST_COLORS.cyan, gridX: 12, gridY: 14, released: false },
      { name: 'orange', color: GHOST_COLORS.orange, gridX: 16, gridY: 14, released: false },
    ];

    for (const data of ghostData) {
      const ghost = this.add.graphics();
      this.ghosts.push({
        graphics: ghost,
        gridX: data.gridX,
        gridY: data.gridY,
        targetGridX: data.gridX,
        targetGridY: data.gridY,
        color: data.color,
        name: data.name,
        frightened: false,
        eaten: false,
        homeX: data.gridX,
        homeY: data.gridY,
        released: data.released,
      });
      this.drawGhost(this.ghosts[this.ghosts.length - 1]);
    }
  }

  drawMaze(): void {
    this.mazeGraphics.clear();

    for (let y = 0; y < this.maze.length; y++) {
      for (let x = 0; x < this.maze[y].length; x++) {
        const char = this.maze[y][x];
        const px = x * CONFIG.TILE_SIZE;
        const py = y * CONFIG.TILE_SIZE;

        if (char === '#') {
          // Wall - blue rounded rectangles
          this.mazeGraphics.fillStyle(0x2121de);
          this.mazeGraphics.fillRoundedRect(
            px + 2,
            py + 2,
            CONFIG.TILE_SIZE - 4,
            CONFIG.TILE_SIZE - 4,
            3
          );
        }
      }
    }
  }

  drawPellets(): void {
    this.pelletGraphics.clear();

    for (let y = 0; y < this.maze.length; y++) {
      for (let x = 0; x < this.maze[y].length; x++) {
        const char = this.maze[y][x];
        const px = x * CONFIG.TILE_SIZE + CONFIG.TILE_SIZE / 2;
        const py = y * CONFIG.TILE_SIZE + CONFIG.TILE_SIZE / 2;

        if (char === '.') {
          // Regular pellet
          this.pelletGraphics.fillStyle(0xffb897);
          this.pelletGraphics.fillCircle(px, py, 2);
        } else if (char === 'o') {
          // Power pellet - animated
          const alpha = 0.5 + Math.sin(Date.now() / 200) * 0.5;
          this.pelletGraphics.fillStyle(0xffb897, alpha);
          this.pelletGraphics.fillCircle(px, py, 6);
        }
      }
    }
  }

  drawPlayer(): void {
    this.player.clear();
    this.player.fillStyle(0xffff00);

    // Animate mouth
    this.mouthAngle = Math.abs(Math.sin(Date.now() / 100)) * 45;

    // Pac-Man with mouth
    const startAngle = Phaser.Math.DegToRad(this.mouthAngle);
    const endAngle = Phaser.Math.DegToRad(360 - this.mouthAngle);

    this.player.slice(
      0, 0,
      CONFIG.TILE_SIZE / 2 - 2,
      startAngle,
      endAngle,
      false
    );
    this.player.fillPath();

    // Rotate based on direction
    let rotation = 0;
    if (this.playerDir.x === 1) rotation = 0;
    else if (this.playerDir.x === -1) rotation = Math.PI;
    else if (this.playerDir.y === 1) rotation = Math.PI / 2;
    else if (this.playerDir.y === -1) rotation = -Math.PI / 2;

    this.player.setRotation(rotation);
    this.player.setPosition(this.playerX, this.playerY);
  }

  drawGhost(ghost: Ghost): void {
    ghost.graphics.clear();

    const color = ghost.frightened
      ? (this.powerTimer < 2000 && Math.floor(Date.now() / 200) % 2 === 0 ? 0xffffff : 0x2121de)
      : ghost.color;

    ghost.graphics.fillStyle(color);

    const size = CONFIG.TILE_SIZE / 2 - 2;

    // Ghost head (semi-circle)
    ghost.graphics.beginPath();
    ghost.graphics.arc(0, 0, size, Math.PI, 0, true);
    ghost.graphics.closePath();
    ghost.graphics.fillPath();

    // Ghost body
    ghost.graphics.fillRect(-size, 0, size * 2, size);

    // Wavy bottom
    const wavePoints = 4;
    const waveWidth = (size * 2) / wavePoints;
    for (let i = 0; i < wavePoints; i++) {
      const x1 = -size + i * waveWidth;
      const x2 = x1 + waveWidth / 2;
      const x3 = x1 + waveWidth;
      ghost.graphics.fillTriangle(
        x1, size,
        x2, size + 4,
        x3, size
      );
    }

    // Eyes
    if (!ghost.eaten) {
      ghost.graphics.fillStyle(0xffffff);
      ghost.graphics.fillCircle(-size / 2, -2, 4);
      ghost.graphics.fillCircle(size / 2, -2, 4);

      if (!ghost.frightened) {
        ghost.graphics.fillStyle(0x0000ff);
        ghost.graphics.fillCircle(-size / 2, -2, 2);
        ghost.graphics.fillCircle(size / 2, -2, 2);
      }
    }

    const gx = ghost.gridX * CONFIG.TILE_SIZE + CONFIG.TILE_SIZE / 2;
    const gy = ghost.gridY * CONFIG.TILE_SIZE + CONFIG.TILE_SIZE / 2;
    ghost.graphics.setPosition(gx, gy);
  }

  update(time: number, delta: number): void {
    if (this.gameOver || this.paused) return;

    const dt = delta / 1000;

    // Update power mode
    if (this.powered) {
      this.powerTimer -= delta;
      if (this.powerTimer <= 0) {
        this.powered = false;
        this.ghosts.forEach(g => {
          g.frightened = false;
          this.drawGhost(g);
        });
      } else {
        // Redraw pellets for animation
        if (Math.floor(time / 100) % 2 === 0) {
          this.drawPellets();
        }
      }
    }

    // Release ghosts over time
    if (!this.ghosts.every(g => g.released)) {
      this.ghostReleaseTimer += delta;
      if (this.ghostReleaseTimer > CONFIG.GHOST_RELEASE_DELAY) {
        const unreleased = this.ghosts.find(g => !g.released);
        if (unreleased) {
          unreleased.released = true;
          unreleased.targetGridY = 11; // Move to exit
        }
        this.ghostReleaseTimer = 0;
      }
    }

    // Handle input
    const dir = this.getDirection();
    if (dir.up) this.nextDir = { x: 0, y: -1 };
    else if (dir.down) this.nextDir = { x: 0, y: 1 };
    else if (dir.left) this.nextDir = { x: -1, y: 0 };
    else if (dir.right) this.nextDir = { x: 1, y: 0 };

    // Move player
    this.movePlayer(dt);
    this.drawPlayer();

    // Move ghosts
    this.moveGhosts(dt);

    // Check collisions
    this.checkCollisions();

    // Check win
    if (this.pelletsRemaining === 0) {
      this.levelComplete();
    }
  }

  movePlayer(dt: number): void {
    const speed = CONFIG.PLAYER_SPEED;

    // Try to change direction
    const nextGridX = this.playerGridX + this.nextDir.x;
    const nextGridY = this.playerGridY + this.nextDir.y;

    if (this.canMoveTo(nextGridX, nextGridY)) {
      this.playerDir = { ...this.nextDir };
    }

    // Move in current direction
    const targetGridX = this.playerGridX + this.playerDir.x;
    const targetGridY = this.playerGridY + this.playerDir.y;

    if (this.canMoveTo(targetGridX, targetGridY)) {
      this.playerX += this.playerDir.x * speed * dt;
      this.playerY += this.playerDir.y * speed * dt;

      // Update grid position when crossing tile center
      const centerX = this.playerGridX * CONFIG.TILE_SIZE + CONFIG.TILE_SIZE / 2;
      const centerY = this.playerGridY * CONFIG.TILE_SIZE + CONFIG.TILE_SIZE / 2;

      if (this.playerDir.x > 0 && this.playerX >= centerX + CONFIG.TILE_SIZE) {
        this.playerGridX++;
        this.checkPelletCollision();
      } else if (this.playerDir.x < 0 && this.playerX <= centerX - CONFIG.TILE_SIZE) {
        this.playerGridX--;
        this.checkPelletCollision();
      } else if (this.playerDir.y > 0 && this.playerY >= centerY + CONFIG.TILE_SIZE) {
        this.playerGridY++;
        this.checkPelletCollision();
      } else if (this.playerDir.y < 0 && this.playerY <= centerY - CONFIG.TILE_SIZE) {
        this.playerGridY--;
        this.checkPelletCollision();
      }
    }

    // Tunnel wraparound
    if (this.playerGridX < 0) {
      this.playerGridX = this.maze[0].length - 1;
      this.playerX = this.playerGridX * CONFIG.TILE_SIZE + CONFIG.TILE_SIZE / 2;
    } else if (this.playerGridX >= this.maze[0].length) {
      this.playerGridX = 0;
      this.playerX = CONFIG.TILE_SIZE / 2;
    }
  }

  moveGhosts(dt: number): void {
    for (const ghost of this.ghosts) {
      if (!ghost.released) continue;

      const speed = ghost.frightened ? CONFIG.FRIGHTENED_SPEED : CONFIG.GHOST_SPEED;

      // Simple AI - chase player or scatter
      if (ghost.gridX === ghost.targetGridX && ghost.gridY === ghost.targetGridY) {
        this.chooseGhostTarget(ghost);
      }

      // Move toward target
      const dx = ghost.targetGridX - ghost.gridX;
      const dy = ghost.targetGridY - ghost.gridY;

      const currentX = ghost.gridX * CONFIG.TILE_SIZE + CONFIG.TILE_SIZE / 2;
      const currentY = ghost.gridY * CONFIG.TILE_SIZE + CONFIG.TILE_SIZE / 2;

      if (Math.abs(dx) > 0) {
        const newX = currentX + Math.sign(dx) * speed * dt;
        const newGridX = Math.round((newX - CONFIG.TILE_SIZE / 2) / CONFIG.TILE_SIZE);
        if (this.canMoveTo(newGridX, ghost.gridY)) {
          ghost.gridX = newGridX;
        }
      } else if (Math.abs(dy) > 0) {
        const newY = currentY + Math.sign(dy) * speed * dt;
        const newGridY = Math.round((newY - CONFIG.TILE_SIZE / 2) / CONFIG.TILE_SIZE);
        if (this.canMoveTo(ghost.gridX, newGridY)) {
          ghost.gridY = newGridY;
        }
      }

      this.drawGhost(ghost);
    }
  }

  chooseGhostTarget(ghost: Ghost): void {
    if (ghost.frightened) {
      // Random movement when frightened
      const dirs = [
        { x: 0, y: -1 },
        { x: 0, y: 1 },
        { x: -1, y: 0 },
        { x: 1, y: 0 },
      ].filter(d => this.canMoveTo(ghost.gridX + d.x, ghost.gridY + d.y));

      if (dirs.length > 0) {
        const dir = dirs[Math.floor(this.rng.next() * dirs.length)];
        ghost.targetGridX = ghost.gridX + dir.x;
        ghost.targetGridY = ghost.gridY + dir.y;
      }
    } else {
      // Chase player
      ghost.targetGridX = this.playerGridX;
      ghost.targetGridY = this.playerGridY;
    }
  }

  canMoveTo(gridX: number, gridY: number): boolean {
    if (gridY < 0 || gridY >= this.maze.length || gridX < 0 || gridX >= this.maze[0].length) {
      return true; // Allow tunnel
    }
    const char = this.maze[gridY][gridX];
    return char !== '#' && char !== '-';
  }

  checkPelletCollision(): void {
    const char = this.maze[this.playerGridY][this.playerGridX];

    if (char === '.') {
      this.score += CONFIG.PELLET_POINTS;
      this.onScoreUpdate(this.score);
      this.maze[this.playerGridY] =
        this.maze[this.playerGridY].substring(0, this.playerGridX) +
        ' ' +
        this.maze[this.playerGridY].substring(this.playerGridX + 1);
      this.pelletsRemaining--;
      this.drawPellets();
    } else if (char === 'o') {
      this.score += CONFIG.POWER_PELLET_POINTS;
      this.onScoreUpdate(this.score);
      this.maze[this.playerGridY] =
        this.maze[this.playerGridY].substring(0, this.playerGridX) +
        ' ' +
        this.maze[this.playerGridY].substring(this.playerGridX + 1);
      this.pelletsRemaining--;
      this.powered = true;
      this.powerTimer = CONFIG.POWER_DURATION;
      this.ghosts.forEach(g => {
        if (!g.eaten) {
          g.frightened = true;
          this.drawGhost(g);
        }
      });
      this.drawPellets();
    }
  }

  checkCollisions(): void {
    for (const ghost of this.ghosts) {
      if (!ghost.released) continue;

      const dist = Math.abs(ghost.gridX - this.playerGridX) + Math.abs(ghost.gridY - this.playerGridY);

      if (dist < 1) {
        if (ghost.frightened && !ghost.eaten) {
          // Eat ghost
          this.score += CONFIG.GHOST_POINTS;
          this.onScoreUpdate(this.score);
          ghost.eaten = true;
          ghost.frightened = false;
          ghost.targetGridX = ghost.homeX;
          ghost.targetGridY = ghost.homeY;

          this.time.delayedCall(3000, () => {
            ghost.eaten = false;
            this.drawGhost(ghost);
          });
        } else if (!ghost.eaten) {
          // Player dies
          this.loseLife();
        }
      }
    }
  }

  loseLife(): void {
    this.lives--;
    this.livesText.setText(`LIVES: ${this.lives}`);

    if (this.lives <= 0) {
      this.endGame();
    } else {
      this.paused = true;
      this.playerGridX = 14;
      this.playerGridY = 23;
      this.playerX = this.playerGridX * CONFIG.TILE_SIZE + CONFIG.TILE_SIZE / 2;
      this.playerY = this.playerGridY * CONFIG.TILE_SIZE + CONFIG.TILE_SIZE / 2;
      this.playerDir = { x: 0, y: 0 };
      this.powered = false;

      this.ghosts.forEach((g, i) => {
        g.gridX = g.homeX;
        g.gridY = g.homeY;
        g.released = i === 0;
        g.frightened = false;
        g.eaten = false;
        this.drawGhost(g);
      });

      this.time.delayedCall(2000, () => {
        this.paused = false;
      });
    }
  }

  levelComplete(): void {
    this.score += 1000;
    this.onScoreUpdate(this.score);

    // Reset maze
    this.maze = MAZE.map(row => row);
    this.pelletsRemaining = this.maze.join('').split('.').length - 1 +
                            this.maze.join('').split('o').length - 1;
    this.drawPellets();

    this.paused = true;
    this.time.delayedCall(2000, () => {
      this.paused = false;
    });
  }

  endGame(): void {
    this.gameOver = true;
    this.add.text(this.scale.width / 2, this.scale.height / 2, 'GAME OVER', {
      fontFamily: '"Press Start 2P"',
      fontSize: '24px',
      color: '#ff0000',
    }).setOrigin(0.5);

    this.time.delayedCall(2000, () => {
      this.onGameOver(this.score);
    });
  }
}
