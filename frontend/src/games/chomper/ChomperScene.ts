import * as Phaser from 'phaser';
import { SeededRNG } from '../engine/SeededRNG';

const CONFIG = {
  TILE_SIZE: 21,
  PLAYER_SPEED: 105,
  GHOST_SPEED: 85,
  FRIGHTENED_SPEED: 60,
  PELLET_POINTS: 5,
  POWER_PELLET_POINTS: 25,
  GHOST_POINTS: 100,
  POWER_DURATION: 6000,
  LIVES: 3,
  GHOST_RELEASE_DELAY: 2000,
  SPEED_INCREASE_PER_LEVEL: 5,
  POWER_DECREASE_PER_LEVEL: 500,
};

// Multiple maze layouts (28x30 grid) - cycles through levels
const MAZES = [
  // Maze 1: Classic Pac-Man style
  [
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
  ],

  // Maze 2: Variation with different wall patterns
  [
    '############################',
    '#............##............#',
    '#.####.#####.##.#####.####.#',
    '#o####.#####.##.#####.####o#',
    '#..........................#',
    '##.##.##.##.####.##.##.##.##',
    '##.##.##.##.####.##.##.##.##',
    '#.........##.##.##.........#',
    '#.#######.##.##.##.#######.#',
    '#.#######..........#######.#',
    '######.##          ##.######',
    '######.## ###--### ##.######',
    '######.## #      # ##.######',
    '      .   #      #   .      ',
    '######.## #      # ##.######',
    '######.## ######## ##.######',
    '######.##          ##.######',
    '#.#######..........#######.#',
    '#.#######.##.##.##.#######.#',
    '#.........##.##.##.........#',
    '##.##.##.##.####.##.##.##.##',
    '##.##.##.##.####.##.##.##.##',
    '#..........................#',
    '#.####.#####.##.#####.####.#',
    '#.####.#####.##.#####.####.#',
    '#o............##..........o#',
    '###.########.##.########.###',
    '###.########.##.########.###',
    '#..........................#',
    '############################',
  ],

  // Maze 3: Zigzag tunnels
  [
    '############################',
    '#............##............#',
    '#.##.######.####.######.##.#',
    '#o##.######.####.######.##o#',
    '#....######..##..######....#',
    '####.##..............##.####',
    '####.##.############.##.####',
    '#.......############.......#',
    '#.####.##..........##.####.#',
    '#.####.##.########.##.####.#',
    '######.##          ##.######',
    '######.## ###--### ##.######',
    '######.## #      # ##.######',
    '      .   #      #   .      ',
    '######.## #      # ##.######',
    '######.## ######## ##.######',
    '######.##          ##.######',
    '#.####.##.########.##.####.#',
    '#.####.##..........##.####.#',
    '#.......############.......#',
    '####.##.############.##.####',
    '####.##..............##.####',
    '#....######..##..######....#',
    '#.##.######.####.######.##.#',
    '#.##.######.####.######.##.#',
    '#o..........####..........o#',
    '##########.######.##########',
    '##########.######.##########',
    '#..........................#',
    '############################',
  ],

  // Maze 4: T-junctions and split paths
  [
    '############################',
    '#o........................o#',
    '#.####.##########.####.###.#',
    '#.####.##########.####.###.#',
    '#.......##........##.......#',
    '######.##.######.##.######.#',
    '######.##.######.##.######.#',
    '#..........######..........#',
    '#.#####.##.######.##.#####.#',
    '#.#####.##........##.#####.#',
    '######.##          ##.######',
    '######.## ###--### ##.######',
    '######.## #      # ##.######',
    '      .   #      #   .      ',
    '######.## #      # ##.######',
    '######.## ######## ##.######',
    '######.##          ##.######',
    '#.#####.##........##.#####.#',
    '#.#####.##.######.##.#####.#',
    '#..........######..........#',
    '######.##.######.##.######.#',
    '######.##.######.##.######.#',
    '#.......##........##.......#',
    '#.#####.##.######.##.#####.#',
    '#.#####.##.######.##.#####.#',
    '#o...........##...........o#',
    '#.##########.##.##########.#',
    '#.##########.##.##########.#',
    '#..........................#',
    '############################',
  ],

  // Maze 5: Cross pattern with chambers
  [
    '############################',
    '#............##............#',
    '#.####.#####.##.#####.####.#',
    '#o####.#####.##.#####.####o#',
    '#.......####....####.......#',
    '######.####.##.####.######.#',
    '######......##......######.#',
    '#........##.####.##........#',
    '#.######.##.####.##.######.#',
    '#.######.##......##.######.#',
    '######.##          ##.######',
    '######.## ###--### ##.######',
    '######.## #      # ##.######',
    '      .   #      #   .      ',
    '######.## #      # ##.######',
    '######.## ######## ##.######',
    '######.##          ##.######',
    '#.######.##......##.######.#',
    '#.######.##.####.##.######.#',
    '#........##.####.##........#',
    '######......##......######.#',
    '######.####.##.####.######.#',
    '#.......####....####.......#',
    '#.####.#####.##.#####.####.#',
    '#.####.#####.##.#####.####.#',
    '#o...........##...........o#',
    '##########.####.##########.#',
    '##########.####.##########.#',
    '#..........................#',
    '############################',
  ],
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
  x: number;
  y: number;
  targetGridX: number;
  targetGridY: number;
  color: number;
  name: string;
  frightened: boolean;
  eaten: boolean;
  homeX: number;
  homeY: number;
  released: boolean;
  exitedHouse: boolean;
  dirX: number;
  dirY: number;
}

export class ChomperScene extends Phaser.Scene {
  private onScoreUpdate: (score: number) => void;
  private onGameOver: (finalScore: number) => void;
  private getDirection: () => { up: boolean; down: boolean; left: boolean; right: boolean };
  private getAction: () => boolean;

  private rng: SeededRNG;
  private score: number = 0;
  private lives: number = CONFIG.LIVES;
  private level: number = 1;
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
  private powerPelletVisible: boolean = true;
  private powerPelletTimer: number = 0;

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
    // Select maze based on level (cycles through available mazes)
    const mazeIndex = (this.level - 1) % MAZES.length;
    this.maze = MAZES[mazeIndex].map(row => row);

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
      { name: 'red', color: GHOST_COLORS.red, gridX: 14, gridY: 11, released: true, exitedHouse: true },
      { name: 'pink', color: GHOST_COLORS.pink, gridX: 14, gridY: 14, released: false, exitedHouse: false },
      { name: 'cyan', color: GHOST_COLORS.cyan, gridX: 12, gridY: 14, released: false, exitedHouse: false },
      { name: 'orange', color: GHOST_COLORS.orange, gridX: 16, gridY: 14, released: false, exitedHouse: false },
    ];

    for (const data of ghostData) {
      const ghost = this.add.graphics();
      const x = data.gridX * CONFIG.TILE_SIZE + CONFIG.TILE_SIZE / 2;
      const y = data.gridY * CONFIG.TILE_SIZE + CONFIG.TILE_SIZE / 2;
      this.ghosts.push({
        graphics: ghost,
        gridX: data.gridX,
        gridY: data.gridY,
        x: x,
        y: y,
        targetGridX: data.gridX,
        targetGridY: data.gridY,
        color: data.color,
        name: data.name,
        frightened: false,
        eaten: false,
        homeX: data.gridX,
        homeY: data.gridY,
        released: data.released,
        exitedHouse: data.exitedHouse,
        dirX: 0,
        dirY: 0,
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
          this.pelletGraphics.fillStyle(0xffb897, 1);
          this.pelletGraphics.fillCircle(px, py, 2);
        } else if (char === 'o') {
          // Power pellet - flash on/off
          if (this.powerPelletVisible) {
            this.pelletGraphics.fillStyle(0xffb897, 1);
            this.pelletGraphics.fillCircle(px, py, 6);
          }
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

    const size = CONFIG.TILE_SIZE / 2 - 2;

    if (ghost.eaten) {
      // Just show eyes when eaten (returning home)
      ghost.graphics.fillStyle(0xffffff);
      ghost.graphics.fillCircle(-size / 2, 0, 4);
      ghost.graphics.fillCircle(size / 2, 0, 4);
      ghost.graphics.fillStyle(0x0000ff);
      ghost.graphics.fillCircle(-size / 2, 0, 2);
      ghost.graphics.fillCircle(size / 2, 0, 2);
    } else {
      // Normal ghost or frightened
      const color = ghost.frightened
        ? (this.powerTimer < 2000 && Math.floor(Date.now() / 200) % 2 === 0 ? 0xffffff : 0x2121de)
        : ghost.color;

      ghost.graphics.fillStyle(color);

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
      ghost.graphics.fillStyle(0xffffff);
      ghost.graphics.fillCircle(-size / 2, -2, 4);
      ghost.graphics.fillCircle(size / 2, -2, 4);

      if (!ghost.frightened) {
        ghost.graphics.fillStyle(0x0000ff);
        ghost.graphics.fillCircle(-size / 2, -2, 2);
        ghost.graphics.fillCircle(size / 2, -2, 2);
      }
    }

    ghost.graphics.setPosition(ghost.x, ghost.y);
  }

  update(time: number, delta: number): void {
    if (this.gameOver || this.paused) return;

    const dt = delta / 1000;

    // Animate power pellets (flash every 250ms)
    this.powerPelletTimer += delta;
    if (this.powerPelletTimer > 250) {
      this.powerPelletVisible = !this.powerPelletVisible;
      this.powerPelletTimer = 0;
      this.drawPellets();
    }

    // Update power mode
    if (this.powered) {
      this.powerTimer -= delta;
      if (this.powerTimer <= 0) {
        this.powered = false;
        this.ghosts.forEach(g => {
          // Only un-frighten ghosts that aren't eaten
          if (!g.eaten) {
            g.frightened = false;
            this.drawGhost(g);
          }
        });
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

    if (this.canPlayerMoveTo(nextGridX, nextGridY)) {
      this.playerDir = { ...this.nextDir };
    }

    // Move in current direction
    if (this.playerDir.x !== 0 || this.playerDir.y !== 0) {
      const targetGridX = this.playerGridX + this.playerDir.x;
      const targetGridY = this.playerGridY + this.playerDir.y;

      if (this.canPlayerMoveTo(targetGridX, targetGridY)) {
        // Move in pixel coordinates
        this.playerX += this.playerDir.x * speed * dt;
        this.playerY += this.playerDir.y * speed * dt;

        // Update grid position when crossing tile boundaries
        const centerX = this.playerGridX * CONFIG.TILE_SIZE + CONFIG.TILE_SIZE / 2;
        const centerY = this.playerGridY * CONFIG.TILE_SIZE + CONFIG.TILE_SIZE / 2;

        if (this.playerDir.x > 0 && this.playerX >= centerX + CONFIG.TILE_SIZE) {
          this.playerGridX++;
          this.playerX = this.playerGridX * CONFIG.TILE_SIZE + CONFIG.TILE_SIZE / 2;
          this.checkPelletCollision();
        } else if (this.playerDir.x < 0 && this.playerX <= centerX - CONFIG.TILE_SIZE) {
          this.playerGridX--;
          this.playerX = this.playerGridX * CONFIG.TILE_SIZE + CONFIG.TILE_SIZE / 2;
          this.checkPelletCollision();
        } else if (this.playerDir.y > 0 && this.playerY >= centerY + CONFIG.TILE_SIZE) {
          this.playerGridY++;
          this.playerY = this.playerGridY * CONFIG.TILE_SIZE + CONFIG.TILE_SIZE / 2;
          this.checkPelletCollision();
        } else if (this.playerDir.y < 0 && this.playerY <= centerY - CONFIG.TILE_SIZE) {
          this.playerGridY--;
          this.playerY = this.playerGridY * CONFIG.TILE_SIZE + CONFIG.TILE_SIZE / 2;
          this.checkPelletCollision();
        }
      } else {
        // Can't move forward, snap to grid center
        this.playerX = this.playerGridX * CONFIG.TILE_SIZE + CONFIG.TILE_SIZE / 2;
        this.playerY = this.playerGridY * CONFIG.TILE_SIZE + CONFIG.TILE_SIZE / 2;
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

      const levelSpeedBonus = (this.level - 1) * CONFIG.SPEED_INCREASE_PER_LEVEL;
      const speed = ghost.frightened ? CONFIG.FRIGHTENED_SPEED : CONFIG.GHOST_SPEED + levelSpeedBonus;

      // Check if we're at a grid center (for decision making)
      const atCenter =
        Math.abs(ghost.x - (ghost.gridX * CONFIG.TILE_SIZE + CONFIG.TILE_SIZE / 2)) < 2 &&
        Math.abs(ghost.y - (ghost.gridY * CONFIG.TILE_SIZE + CONFIG.TILE_SIZE / 2)) < 2;

      // Determine target position based on ghost state
      if (!ghost.exitedHouse) {
        // Exiting house - each ghost takes slightly different path
        const exitCenterX = 14;
        const exitY = 11;

        // First move to exit level
        if (ghost.gridY > exitY) {
          ghost.targetGridX = exitCenterX;
          ghost.targetGridY = exitY;
        } else {
          // Then move to unique position based on ghost
          if (ghost.name === 'red') {
            ghost.targetGridX = exitCenterX;
            ghost.targetGridY = 9;
            if (ghost.gridY <= 9) {
              ghost.exitedHouse = true;
            }
          } else if (ghost.name === 'pink') {
            ghost.targetGridX = exitCenterX - 3;
            ghost.targetGridY = 9;
            if (ghost.gridY <= 9 && Math.abs(ghost.gridX - (exitCenterX - 3)) < 2) {
              ghost.exitedHouse = true;
            }
          } else if (ghost.name === 'cyan') {
            ghost.targetGridX = exitCenterX + 3;
            ghost.targetGridY = 9;
            if (ghost.gridY <= 9 && Math.abs(ghost.gridX - (exitCenterX + 3)) < 2) {
              ghost.exitedHouse = true;
            }
          } else if (ghost.name === 'orange') {
            // Orange exits: first move to center, then up
            if (ghost.gridY > 11) {
              // First move to exit row
              ghost.targetGridX = exitCenterX;
              ghost.targetGridY = 11;
            } else if (ghost.gridY === 11) {
              // At exit row, move up
              ghost.targetGridX = exitCenterX;
              ghost.targetGridY = 9;
            } else {
              // Above exit row, continue up and mark as exited
              ghost.targetGridX = exitCenterX;
              ghost.targetGridY = 9;
              if (ghost.gridY <= 9) {
                ghost.exitedHouse = true;
              }
            }
          }
        }
      } else if (ghost.eaten) {
        // Return home when eaten - can pass through walls
        ghost.targetGridX = ghost.homeX;
        ghost.targetGridY = ghost.homeY;
      } else if (ghost.frightened) {
        // Flee from player - move to opposite corner
        const dx = ghost.gridX - this.playerGridX;
        const dy = ghost.gridY - this.playerGridY;

        // Target a corner far from player
        if (dx > 0 && dy > 0) {
          // Player is to the left and above - flee to bottom-right
          ghost.targetGridX = this.maze[0].length - 2;
          ghost.targetGridY = this.maze.length - 2;
        } else if (dx < 0 && dy > 0) {
          // Player is to the right and above - flee to bottom-left
          ghost.targetGridX = 1;
          ghost.targetGridY = this.maze.length - 2;
        } else if (dx > 0 && dy < 0) {
          // Player is to the left and below - flee to top-right
          ghost.targetGridX = this.maze[0].length - 2;
          ghost.targetGridY = 1;
        } else {
          // Player is to the right and below - flee to top-left
          ghost.targetGridX = 1;
          ghost.targetGridY = 1;
        }
      } else {
        // Normal mode: each ghost has authentic Pac-Man targeting behavior
        if (ghost.name === 'red') {
          // Blinky (Red): "Shadow" - Direct chase, always targets player's current position
          ghost.targetGridX = this.playerGridX;
          ghost.targetGridY = this.playerGridY;
        } else if (ghost.name === 'pink') {
          // Pinky (Pink): "Speedy" - Ambush strategy, targets 4 tiles ahead
          // Includes the famous "up bug" from original Pac-Man
          let targetX = this.playerGridX;
          let targetY = this.playerGridY;

          if (this.playerDir.x !== 0 || this.playerDir.y !== 0) {
            // When facing up, original bug causes offset to be 4 up AND 4 left
            if (this.playerDir.y < 0) {
              targetX += -4; // 4 tiles left (the bug)
              targetY += -4; // 4 tiles up
            } else {
              // Normal: just 4 tiles ahead in current direction
              targetX += this.playerDir.x * 4;
              targetY += this.playerDir.y * 4;
            }
          }

          ghost.targetGridX = Math.max(1, Math.min(this.maze[0].length - 2, targetX));
          ghost.targetGridY = Math.max(1, Math.min(this.maze.length - 2, targetY));
        } else if (ghost.name === 'cyan') {
          // Inky (Cyan): "Bashful" - Uses vector between Blinky and player
          // Most complex AI: takes point 2 tiles ahead of player, then doubles vector from Blinky
          const blinky = this.ghosts.find(g => g.name === 'red');

          if (blinky) {
            // Get point 2 tiles ahead of player (with "up bug" like Pinky)
            let pivotX = this.playerGridX;
            let pivotY = this.playerGridY;

            if (this.playerDir.y < 0) {
              pivotX += -2; // 2 tiles left when facing up (bug)
              pivotY += -2; // 2 tiles up
            } else {
              pivotX += this.playerDir.x * 2;
              pivotY += this.playerDir.y * 2;
            }

            // Calculate vector from Blinky to pivot point
            const vectorX = pivotX - blinky.gridX;
            const vectorY = pivotY - blinky.gridY;

            // Double the vector to get target (creates unpredictable behavior)
            ghost.targetGridX = pivotX + vectorX;
            ghost.targetGridY = pivotY + vectorY;

            // Clamp to maze bounds
            ghost.targetGridX = Math.max(1, Math.min(this.maze[0].length - 2, ghost.targetGridX));
            ghost.targetGridY = Math.max(1, Math.min(this.maze.length - 2, ghost.targetGridY));
          } else {
            // Fallback if Blinky not found
            ghost.targetGridX = this.playerGridX;
            ghost.targetGridY = this.playerGridY;
          }
        } else if (ghost.name === 'orange') {
          // Clyde (Orange): "Pokey" - Alternates between chase and scatter
          // When close (8 tiles), heads to bottom-left scatter corner
          const dist = Math.abs(ghost.gridX - this.playerGridX) + Math.abs(ghost.gridY - this.playerGridY);

          if (dist > 8) {
            // Far away - chase player directly
            ghost.targetGridX = this.playerGridX;
            ghost.targetGridY = this.playerGridY;
          } else {
            // Close - scatter to bottom-left corner (his home corner)
            ghost.targetGridX = 1;
            ghost.targetGridY = this.maze.length - 2;
          }
        }
      }

      // Calculate direction to target
      const dx = ghost.targetGridX - ghost.gridX;
      const dy = ghost.targetGridY - ghost.gridY;

      // Choose best direction
      let moveDir = { x: 0, y: 0 };

      // Eaten ghosts can move through walls, others use normal pathfinding
      const canMove = (gx: number, gy: number) => {
        if (ghost.eaten) {
          // Eaten ghosts can pass through everything except map boundaries
          return gy >= 0 && gy < this.maze.length && gx >= 0 && gx < this.maze[0].length;
        }
        return this.canMoveTo(gx, gy);
      };

      // Only choose new direction at grid centers to prevent oscillation
      if (atCenter || ghost.dirX === 0 && ghost.dirY === 0) {
        // Only apply randomness at grid centers for non-exiting ghosts (reduced to 5%)
        const useRandom = atCenter && ghost.exitedHouse && !ghost.eaten && !ghost.frightened && this.rng.next() < 0.05;

        if (useRandom) {
          // 5% chance for slight path variation at intersections
          const dirs = [
            { x: 1, y: 0 },
            { x: -1, y: 0 },
            { x: 0, y: 1 },
            { x: 0, y: -1 },
          ];
          // Filter out reverse direction and invalid moves
          const validDirs = dirs.filter(d =>
            canMove(ghost.gridX + d.x, ghost.gridY + d.y) &&
            !(d.x === -ghost.dirX && d.y === -ghost.dirY) // Prevent 180-degree turns
          );
          if (validDirs.length > 0) {
            moveDir = validDirs[Math.floor(this.rng.next() * validDirs.length)];
          }
        } else {
          // Normal pathfinding towards target
          const directions = [];

          // Prioritize based on distance to target, preferring horizontal when equal
          const absDx = Math.abs(dx);
          const absDy = Math.abs(dy);

          if (absDx > absDy) {
            // Horizontal is more important
            if (dx !== 0) directions.push({ x: Math.sign(dx), y: 0 });
            if (dy !== 0) directions.push({ x: 0, y: Math.sign(dy) });
          } else if (absDy > absDx) {
            // Vertical is more important
            if (dy !== 0) directions.push({ x: 0, y: Math.sign(dy) });
            if (dx !== 0) directions.push({ x: Math.sign(dx), y: 0 });
          } else {
            // Equal distance - prefer horizontal movement
            if (dx !== 0) directions.push({ x: Math.sign(dx), y: 0 });
            if (dy !== 0) directions.push({ x: 0, y: Math.sign(dy) });
          }

          // Also consider perpendicular directions as fallbacks
          if (dx !== 0) directions.push({ x: 0, y: 1 }, { x: 0, y: -1 });
          if (dy !== 0) directions.push({ x: 1, y: 0 }, { x: -1, y: 0 });

          // Choose first valid direction that's not a 180-degree turn
          for (const dir of directions) {
            const isReverse = dir.x === -ghost.dirX && dir.y === -ghost.dirY;
            if (!isReverse && canMove(ghost.gridX + dir.x, ghost.gridY + dir.y)) {
              moveDir = dir;
              break;
            }
          }

          // If no direction found (shouldn't happen), allow reverse as last resort
          if (moveDir.x === 0 && moveDir.y === 0) {
            for (const dir of directions) {
              if (canMove(ghost.gridX + dir.x, ghost.gridY + dir.y)) {
                moveDir = dir;
                break;
              }
            }
          }
        }
      } else {
        // Not at center, continue current direction
        moveDir.x = ghost.dirX;
        moveDir.y = ghost.dirY;
      }

      // Move ghost
      if (moveDir.x !== 0 || moveDir.y !== 0) {
        // Store current direction
        ghost.dirX = moveDir.x;
        ghost.dirY = moveDir.y;

        ghost.x += moveDir.x * speed * dt;
        ghost.y += moveDir.y * speed * dt;

        // Update grid position when crossing tile boundaries
        const centerX = ghost.gridX * CONFIG.TILE_SIZE + CONFIG.TILE_SIZE / 2;
        const centerY = ghost.gridY * CONFIG.TILE_SIZE + CONFIG.TILE_SIZE / 2;

        if (moveDir.x > 0 && ghost.x >= centerX + CONFIG.TILE_SIZE) {
          ghost.gridX++;
          ghost.x = ghost.gridX * CONFIG.TILE_SIZE + CONFIG.TILE_SIZE / 2;
        } else if (moveDir.x < 0 && ghost.x <= centerX - CONFIG.TILE_SIZE) {
          ghost.gridX--;
          ghost.x = ghost.gridX * CONFIG.TILE_SIZE + CONFIG.TILE_SIZE / 2;
        }

        if (moveDir.y > 0 && ghost.y >= centerY + CONFIG.TILE_SIZE) {
          ghost.gridY++;
          ghost.y = ghost.gridY * CONFIG.TILE_SIZE + CONFIG.TILE_SIZE / 2;
        } else if (moveDir.y < 0 && ghost.y <= centerY - CONFIG.TILE_SIZE) {
          ghost.gridY--;
          ghost.y = ghost.gridY * CONFIG.TILE_SIZE + CONFIG.TILE_SIZE / 2;
        }
      }

      // Tunnel wraparound for ghosts (prevent escaping map)
      if (ghost.gridX < 0) {
        ghost.gridX = this.maze[0].length - 1;
        ghost.x = ghost.gridX * CONFIG.TILE_SIZE + CONFIG.TILE_SIZE / 2;
      } else if (ghost.gridX >= this.maze[0].length) {
        ghost.gridX = 0;
        ghost.x = CONFIG.TILE_SIZE / 2;
      }

      // Clamp vertical position to maze bounds (no vertical tunnels)
      if (ghost.gridY < 0) {
        ghost.gridY = 0;
        ghost.y = CONFIG.TILE_SIZE / 2;
      } else if (ghost.gridY >= this.maze.length) {
        ghost.gridY = this.maze.length - 1;
        ghost.y = (this.maze.length - 1) * CONFIG.TILE_SIZE + CONFIG.TILE_SIZE / 2;
      }

      this.drawGhost(ghost);
    }
  }

  canMoveTo(gridX: number, gridY: number): boolean {
    if (gridY < 0 || gridY >= this.maze.length || gridX < 0 || gridX >= this.maze[0].length) {
      return true; // Allow tunnel
    }
    const char = this.maze[gridY][gridX];
    return char !== '#';
  }

  canPlayerMoveTo(gridX: number, gridY: number): boolean {
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
      // Decrease power duration with each level (minimum 2 seconds)
      const levelPenalty = (this.level - 1) * CONFIG.POWER_DECREASE_PER_LEVEL;
      this.powerTimer = Math.max(2000, CONFIG.POWER_DURATION - levelPenalty);
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
        } else if (!ghost.eaten) {
          // Player dies
          this.loseLife();
        }
      }

      // Check if eaten ghost reached home
      if (ghost.eaten && ghost.gridX === ghost.homeX && ghost.gridY === ghost.homeY) {
        // Mark as not eaten immediately to stop trying to go home
        ghost.eaten = false;
        ghost.exitedHouse = false; // Reset so ghost exits again
        ghost.released = true; // Keep released so it will exit again
        ghost.dirX = 0; // Reset direction
        ghost.dirY = 0;
        this.drawGhost(ghost);
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
        g.x = g.homeX * CONFIG.TILE_SIZE + CONFIG.TILE_SIZE / 2;
        g.y = g.homeY * CONFIG.TILE_SIZE + CONFIG.TILE_SIZE / 2;
        g.released = i === 0;
        g.exitedHouse = i === 0;
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
    this.level++;
    this.score += 500;
    this.onScoreUpdate(this.score);

    // Load next maze (cycles through available mazes)
    const mazeIndex = (this.level - 1) % MAZES.length;
    this.maze = MAZES[mazeIndex].map(row => row);
    this.pelletsRemaining = this.maze.join('').split('.').length - 1 +
                            this.maze.join('').split('o').length - 1;
    this.drawPellets();

    // Show level text
    const levelText = this.add.text(
      this.scale.width / 2,
      17 * CONFIG.TILE_SIZE,
      `LEVEL ${this.level}`,
      {
        fontFamily: '"Press Start 2P"',
        fontSize: '16px',
        color: '#00ff00',
      }
    ).setOrigin(0.5);

    // Reset player and ghosts
    this.playerGridX = 14;
    this.playerGridY = 23;
    this.playerX = this.playerGridX * CONFIG.TILE_SIZE + CONFIG.TILE_SIZE / 2;
    this.playerY = this.playerGridY * CONFIG.TILE_SIZE + CONFIG.TILE_SIZE / 2;
    this.playerDir = { x: 0, y: 0 };

    this.ghosts.forEach((g, i) => {
      g.gridX = g.homeX;
      g.gridY = g.homeY;
      g.x = g.homeX * CONFIG.TILE_SIZE + CONFIG.TILE_SIZE / 2;
      g.y = g.homeY * CONFIG.TILE_SIZE + CONFIG.TILE_SIZE / 2;
      g.targetGridX = g.homeX;
      g.targetGridY = g.homeY;
      g.released = i === 0;
      g.exitedHouse = i === 0;
      g.frightened = false;
      g.eaten = false;
      this.drawGhost(g);
    });

    this.ghostReleaseTimer = 0;

    this.paused = true;
    this.time.delayedCall(2000, () => {
      levelText.destroy();
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
