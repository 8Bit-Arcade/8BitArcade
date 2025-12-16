import * as Phaser from 'phaser';
import { SeededRNG } from '../engine/SeededRNG';
import { ChomperSounds } from './sounds';

const CONFIG = {
  TILE_SIZE: 21,
  PLAYER_SPEED: 105, // Pixels per second (5 tiles/sec)
  GHOST_SPEED: 84, // Pixels per second (4 tiles/sec)
  FRIGHTENED_SPEED: 52.5, // Pixels per second (2.5 tiles/sec)
  PELLET_POINTS: 5,
  POWER_PELLET_POINTS: 25,
  GHOST_POINTS: 100,
  POWER_DURATION: 6000,
  LIVES: 3,
  GHOST_RELEASE_DELAY: 2000, // Release ghosts every 2 seconds
  GRID_WIDTH: 28,
  GRID_HEIGHT: 31,
};

// Tile types
const TILE = {
  EMPTY: 0,
  WALL: 1,
  DOOR: 2, // Ghost house door (blocks player, not ghosts)
};

interface MazeData {
  walls: number[][]; // Grid of tile types
  pellets: { x: number; y: number }[];
  powerPellets: { x: number; y: number }[];
  playerStart: { x: number; y: number };
  ghostHouse: { x: number; y: number };
}

// Create 5 distinct mazes with explicit control
const MAZES: MazeData[] = [
  // MAZE 1: Classic Pac-Man style
  {
    walls: [
      [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
      [1,0,0,0,0,0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,1],
      [1,0,1,1,1,1,0,1,1,1,1,1,0,1,1,0,1,1,1,1,1,0,1,1,1,1,0,1],
      [1,0,1,1,1,1,0,1,1,1,1,1,0,1,1,0,1,1,1,1,1,0,1,1,1,1,0,1],
      [1,0,1,1,1,1,0,1,1,1,1,1,0,1,1,0,1,1,1,1,1,0,1,1,1,1,0,1],
      [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
      [1,0,1,1,1,1,0,1,1,0,1,1,1,1,1,1,1,1,0,1,1,0,1,1,1,1,0,1],
      [1,0,1,1,1,1,0,1,1,0,1,1,1,1,1,1,1,1,0,1,1,0,1,1,1,1,0,1],
      [1,0,0,0,0,0,0,1,1,0,0,0,0,1,1,0,0,0,0,1,1,0,0,0,0,0,0,1],
      [1,1,1,1,1,1,0,1,1,1,1,1,0,1,1,0,1,1,1,1,1,0,1,1,1,1,1,1],
      [1,1,1,1,1,1,0,1,1,1,1,1,0,1,1,0,1,1,1,1,1,0,1,1,1,1,1,1],
      [1,1,1,1,1,1,0,1,1,0,0,0,0,0,0,0,0,0,0,1,1,0,1,1,1,1,1,1],
      [1,1,1,1,1,1,0,1,1,0,1,1,1,2,2,1,1,1,0,1,1,0,1,1,1,1,1,1],
      [1,1,1,1,1,1,0,1,1,0,1,0,0,0,0,0,0,1,0,1,1,0,1,1,1,1,1,1],
      [0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0],
      [1,1,1,1,1,1,0,1,1,0,1,0,0,0,0,0,0,1,0,1,1,0,1,1,1,1,1,1],
      [1,1,1,1,1,1,0,1,1,0,1,1,1,1,1,1,1,1,0,1,1,0,1,1,1,1,1,1],
      [1,1,1,1,1,1,0,1,1,0,0,0,0,0,0,0,0,0,0,1,1,0,1,1,1,1,1,1],
      [1,1,1,1,1,1,0,1,1,0,1,1,1,1,1,1,1,1,0,1,1,0,1,1,1,1,1,1],
      [1,1,1,1,1,1,0,1,1,0,1,1,1,1,1,1,1,1,0,1,1,0,1,1,1,1,1,1],
      [1,0,0,0,0,0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,1],
      [1,0,1,1,1,1,0,1,1,1,1,1,0,1,1,0,1,1,1,1,1,0,1,1,1,1,0,1],
      [1,0,1,1,1,1,0,1,1,1,1,1,0,1,1,0,1,1,1,1,1,0,1,1,1,1,0,1],
      [1,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,0,0,0,1],
      [1,1,1,0,1,1,0,1,1,0,1,1,1,1,1,1,1,1,0,1,1,0,1,1,0,1,1,1],
      [1,1,1,0,1,1,0,1,1,0,1,1,1,1,1,1,1,1,0,1,1,0,1,1,0,1,1,1],
      [1,0,0,0,0,0,0,1,1,0,0,0,0,1,1,0,0,0,0,1,1,0,0,0,0,0,0,1],
      [1,0,1,1,1,1,1,1,1,1,1,1,0,1,1,0,1,1,1,1,1,1,1,1,1,1,0,1],
      [1,0,1,1,1,1,1,1,1,1,1,1,0,1,1,0,1,1,1,1,1,1,1,1,1,1,0,1],
      [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
      [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    ],
    pellets: [],
    powerPellets: [
      { x: 1, y: 3 },
      { x: 26, y: 3 },
      { x: 1, y: 23 },
      { x: 26, y: 23 },
    ],
    playerStart: { x: 14, y: 23 },
    ghostHouse: { x: 14, y: 14 },
  },

  // MAZE 2: Open corridors (no dead ends)
  {
    walls: [
      [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
      [1,0,0,0,0,0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,1],
      [1,0,1,1,1,1,0,1,1,1,1,1,0,1,1,0,1,1,1,1,1,0,1,1,1,1,0,1],
      [1,0,1,1,1,1,0,1,1,1,1,1,0,1,1,0,1,1,1,1,1,0,1,1,1,1,0,1],
      [1,0,1,1,1,1,0,1,1,1,1,1,0,1,1,0,1,1,1,1,1,0,1,1,1,1,0,1],
      [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
      [1,0,1,1,1,1,0,1,1,0,1,1,1,1,1,1,1,1,0,1,1,0,1,1,1,1,0,1],
      [1,0,1,1,1,1,0,1,1,0,1,1,1,1,1,1,1,1,0,1,1,0,1,1,1,1,0,1],
      [1,0,0,0,0,0,0,1,1,0,0,0,0,1,1,0,0,0,0,1,1,0,0,0,0,0,0,1],
      [1,1,1,1,1,1,0,1,1,1,1,1,0,1,1,0,1,1,1,1,1,0,1,1,1,1,1,1],
      [1,1,1,1,1,1,0,1,1,1,1,1,0,1,1,0,1,1,1,1,1,0,1,1,1,1,1,1],
      [1,1,1,1,1,1,0,1,1,0,0,0,0,0,0,0,0,0,0,1,1,0,1,1,1,1,1,1],
      [1,1,1,1,1,1,0,1,1,0,1,1,1,2,2,1,1,1,0,1,1,0,1,1,1,1,1,1],
      [1,1,1,1,1,1,0,1,1,0,1,0,0,0,0,0,0,1,0,1,1,0,1,1,1,1,1,1],
      [0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0],
      [1,1,1,1,1,1,0,1,1,0,1,0,0,0,0,0,0,1,0,1,1,0,1,1,1,1,1,1],
      [1,1,1,1,1,1,0,1,1,0,1,1,1,1,1,1,1,1,0,1,1,0,1,1,1,1,1,1],
      [1,1,1,1,1,1,0,1,1,0,0,0,0,0,0,0,0,0,0,1,1,0,1,1,1,1,1,1],
      [1,1,1,1,1,1,0,1,1,0,1,1,1,1,1,1,1,1,0,1,1,0,1,1,1,1,1,1],
      [1,1,1,1,1,1,0,1,1,0,1,1,1,1,1,1,1,1,0,1,1,0,1,1,1,1,1,1],
      [1,0,0,0,0,0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,1],
      [1,0,1,1,1,1,0,1,1,1,1,1,0,1,1,0,1,1,1,1,1,0,1,1,1,1,0,1],
      [1,0,1,1,1,1,0,1,1,1,1,1,0,1,1,0,1,1,1,1,1,0,1,1,1,1,0,1],
      [1,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,0,0,0,1],
      [1,1,1,0,1,1,0,1,1,0,1,1,1,1,1,1,1,1,0,1,1,0,1,1,0,1,1,1],
      [1,1,1,0,1,1,0,1,1,0,1,1,1,1,1,1,1,1,0,1,1,0,1,1,0,1,1,1],
      [1,0,0,0,0,0,0,1,1,0,0,0,0,1,1,0,0,0,0,1,1,0,0,0,0,0,0,1],
      [1,0,1,1,1,1,1,1,1,1,1,1,0,1,1,0,1,1,1,1,1,1,1,1,1,1,0,1],
      [1,0,1,1,1,1,1,1,1,1,1,1,0,1,1,0,1,1,1,1,1,1,1,1,1,1,0,1],
      [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
      [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    ],
    pellets: [],
    powerPellets: [
      { x: 1, y: 3 },
      { x: 26, y: 3 },
      { x: 1, y: 25 },
      { x: 26, y: 25 },
    ],
    playerStart: { x: 14, y: 23 },
    ghostHouse: { x: 14, y: 14 },
  },

  // MAZE 3: Zigzag pattern
  {
    walls: [
      [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
      [1,0,0,0,0,0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,1],
      [1,0,1,1,0,1,1,1,1,1,1,0,1,1,1,1,0,1,1,1,1,1,1,0,1,1,0,1],
      [1,0,1,1,0,1,1,1,1,1,1,0,1,1,1,1,0,1,1,1,1,1,1,0,1,1,0,1],
      [1,0,0,0,0,1,1,1,1,1,1,0,0,1,1,0,0,1,1,1,1,1,1,0,0,0,0,1],
      [1,1,1,1,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,0,1,1,1,1],
      [1,1,1,1,0,1,1,0,1,1,1,1,1,1,1,1,1,1,1,1,0,1,1,0,1,1,1,1],
      [1,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,1],
      [1,0,1,1,1,1,0,1,1,0,0,0,0,0,0,0,0,0,0,1,1,0,1,1,1,1,0,1],
      [1,0,1,1,1,1,0,1,1,0,1,1,1,1,1,1,1,1,0,1,1,0,1,1,1,1,0,1],
      [1,1,1,1,1,1,0,1,1,0,0,0,0,0,0,0,0,0,0,1,1,0,1,1,1,1,1,1],
      [1,1,1,1,1,1,0,1,1,0,1,1,1,2,2,1,1,1,0,1,1,0,1,1,1,1,1,1],
      [1,1,1,1,1,1,0,1,1,0,1,0,0,0,0,0,0,1,0,1,1,0,1,1,1,1,1,1],
      [0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0],
      [1,1,1,1,1,1,0,1,1,0,1,0,0,0,0,0,0,1,0,1,1,0,1,1,1,1,1,1],
      [1,1,1,1,1,1,0,1,1,0,1,1,1,1,1,1,1,1,0,1,1,0,1,1,1,1,1,1],
      [1,1,1,1,1,1,0,1,1,0,0,0,0,0,0,0,0,0,0,1,1,0,1,1,1,1,1,1],
      [1,0,1,1,1,1,0,1,1,0,1,1,1,1,1,1,1,1,0,1,1,0,1,1,1,1,0,1],
      [1,0,1,1,1,1,0,1,1,0,0,0,0,0,0,0,0,0,0,1,1,0,1,1,1,1,0,1],
      [1,0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,1],
      [1,1,1,1,0,1,1,0,1,1,1,1,1,1,1,1,1,1,1,1,0,1,1,0,1,1,1,1],
      [1,1,1,1,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,0,1,1,1,1],
      [1,0,0,0,0,1,1,1,1,1,1,0,0,1,1,0,0,1,1,1,1,1,1,0,0,0,0,1],
      [1,0,1,1,0,1,1,1,1,1,1,0,1,1,1,1,0,1,1,1,1,1,1,0,1,1,0,1],
      [1,0,1,1,0,1,1,1,1,1,1,0,1,1,1,1,0,1,1,1,1,1,1,0,1,1,0,1],
      [1,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,1],
      [1,1,1,1,1,1,1,1,1,1,0,1,1,1,1,1,1,0,1,1,1,1,1,1,1,1,1,1],
      [1,1,1,1,1,1,1,1,1,1,0,1,1,1,1,1,1,0,1,1,1,1,1,1,1,1,1,1],
      [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
      [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    ],
    pellets: [],
    powerPellets: [
      { x: 1, y: 3 },
      { x: 26, y: 3 },
      { x: 1, y: 25 },
      { x: 26, y: 25 },
    ],
    playerStart: { x: 14, y: 23 },
    ghostHouse: { x: 14, y: 14 },
  },

  // MAZE 4: Chambers
  {
    walls: [
      [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
      [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
      [1,0,1,1,1,1,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,1,1,1,1,0,1],
      [1,0,1,1,1,1,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,1,1,1,1,0,1],
      [1,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,1],
      [1,1,1,1,1,1,0,1,1,0,1,1,1,1,1,1,1,1,0,1,1,0,1,1,1,1,1,1],
      [1,1,1,1,1,1,0,1,1,0,1,1,1,1,1,1,1,1,0,1,1,0,1,1,1,1,1,1],
      [1,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,1],
      [1,0,1,1,1,1,1,0,1,1,0,1,1,1,1,1,1,0,1,1,0,1,1,1,1,1,0,1],
      [1,0,1,1,1,1,1,0,1,1,0,0,0,0,0,0,0,0,1,1,0,1,1,1,1,1,0,1],
      [1,1,1,1,1,1,0,1,1,0,0,0,0,0,0,0,0,0,0,1,1,0,1,1,1,1,1,1],
      [1,1,1,1,1,1,0,1,1,0,1,1,1,2,2,1,1,1,0,1,1,0,1,1,1,1,1,1],
      [1,1,1,1,1,1,0,1,1,0,1,0,0,0,0,0,0,1,0,1,1,0,1,1,1,1,1,1],
      [0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0],
      [1,1,1,1,1,1,0,1,1,0,1,0,0,0,0,0,0,1,0,1,1,0,1,1,1,1,1,1],
      [1,1,1,1,1,1,0,1,1,0,1,1,1,1,1,1,1,1,0,1,1,0,1,1,1,1,1,1],
      [1,1,1,1,1,1,0,1,1,0,0,0,0,0,0,0,0,0,0,1,1,0,1,1,1,1,1,1],
      [1,0,1,1,1,1,1,0,1,1,0,0,0,0,0,0,0,0,1,1,0,1,1,1,1,1,0,1],
      [1,0,1,1,1,1,1,0,1,1,0,1,1,1,1,1,1,0,1,1,0,1,1,1,1,1,0,1],
      [1,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,1],
      [1,1,1,1,1,1,0,1,1,0,1,1,1,1,1,1,1,1,0,1,1,0,1,1,1,1,1,1],
      [1,1,1,1,1,1,0,1,1,0,1,1,1,1,1,1,1,1,0,1,1,0,1,1,1,1,1,1],
      [1,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,1],
      [1,0,1,1,1,1,1,0,1,1,0,1,1,1,1,1,1,0,1,1,0,1,1,1,1,1,0,1],
      [1,0,1,1,1,1,1,0,1,1,0,1,1,1,1,1,1,0,1,1,0,1,1,1,1,1,0,1],
      [1,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,1],
      [1,0,1,1,1,1,1,1,1,1,0,1,1,1,1,1,1,0,1,1,1,1,1,1,1,1,0,1],
      [1,0,1,1,1,1,1,1,1,1,0,1,1,1,1,1,1,0,1,1,1,1,1,1,1,1,0,1],
      [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
      [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    ],
    pellets: [],
    powerPellets: [
      { x: 1, y: 1 },
      { x: 26, y: 1 },
      { x: 1, y: 25 },
      { x: 26, y: 25 },
    ],
    playerStart: { x: 14, y: 23 },
    ghostHouse: { x: 14, y: 14 },
  },

  // MAZE 5: Cross pattern
  {
    walls: [
      [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
      [1,0,0,0,0,0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,1],
      [1,0,1,1,1,1,0,1,1,1,1,1,0,1,1,0,1,1,1,1,1,0,1,1,1,1,0,1],
      [1,0,1,1,1,1,0,1,1,1,1,1,0,1,1,0,1,1,1,1,1,0,1,1,1,1,0,1],
      [1,0,0,0,0,0,0,1,1,1,1,0,0,0,0,0,0,1,1,1,1,0,0,0,0,0,0,1],
      [1,1,1,1,1,1,0,1,1,1,1,0,1,1,1,1,0,1,1,1,1,0,1,1,1,1,1,1],
      [1,1,1,1,1,1,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,1,1,1,1,1,1],
      [1,0,0,0,0,0,0,0,1,1,0,1,1,1,1,1,1,0,1,1,0,0,0,0,0,0,0,1],
      [1,0,1,1,1,1,1,1,0,1,1,0,1,1,1,1,0,1,1,0,1,1,1,1,1,1,0,1],
      [1,0,1,1,1,1,1,1,0,1,1,0,0,0,0,0,0,1,1,0,1,1,1,1,1,1,0,1],
      [1,1,1,1,1,1,0,1,1,0,0,0,0,0,0,0,0,0,0,1,1,0,1,1,1,1,1,1],
      [1,1,1,1,1,1,0,1,1,0,1,1,1,2,2,1,1,1,0,1,1,0,1,1,1,1,1,1],
      [1,1,1,1,1,1,0,1,1,0,1,0,0,0,0,0,0,1,0,1,1,0,1,1,1,1,1,1],
      [0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0],
      [1,1,1,1,1,1,0,1,1,0,1,0,0,0,0,0,0,1,0,1,1,0,1,1,1,1,1,1],
      [1,1,1,1,1,1,0,1,1,0,1,1,1,1,1,1,1,1,0,1,1,0,1,1,1,1,1,1],
      [1,1,1,1,1,1,0,1,1,0,0,0,0,0,0,0,0,0,0,1,1,0,1,1,1,1,1,1],
      [1,0,1,1,1,1,1,1,0,1,1,0,0,0,0,0,0,1,1,0,1,1,1,1,1,1,0,1],
      [1,0,1,1,1,1,1,1,0,1,1,0,1,1,1,1,0,1,1,0,1,1,1,1,1,1,0,1],
      [1,0,0,0,0,0,0,0,1,1,0,1,1,1,1,1,1,0,1,1,0,0,0,0,0,0,0,1],
      [1,1,1,1,1,1,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,1,1,1,1,1,1],
      [1,1,1,1,1,1,0,1,1,1,1,0,1,1,1,1,0,1,1,1,1,0,1,1,1,1,1,1],
      [1,0,0,0,0,0,0,1,1,1,1,0,0,0,0,0,0,1,1,1,1,0,0,0,0,0,0,1],
      [1,0,1,1,1,1,0,1,1,1,1,1,0,1,1,0,1,1,1,1,1,0,1,1,1,1,0,1],
      [1,0,1,1,1,1,0,1,1,1,1,1,0,1,1,0,1,1,1,1,1,0,1,1,1,1,0,1],
      [1,0,0,0,0,0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,1],
      [1,1,1,1,1,1,1,1,1,1,0,1,1,1,1,1,1,0,1,1,1,1,1,1,1,1,1,1],
      [1,1,1,1,1,1,1,1,1,1,0,1,1,1,1,1,1,0,1,1,1,1,1,1,1,1,1,1],
      [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
      [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    ],
    pellets: [],
    powerPellets: [
      { x: 1, y: 3 },
      { x: 26, y: 3 },
      { x: 1, y: 25 },
      { x: 26, y: 25 },
    ],
    playerStart: { x: 14, y: 23 },
    ghostHouse: { x: 14, y: 14 },
  },
];

// Auto-generate pellets for all empty corridor spaces
for (const maze of MAZES) {
  for (let y = 0; y < maze.walls.length; y++) {
    for (let x = 0; x < maze.walls[y].length; x++) {
      if (maze.walls[y][x] === TILE.EMPTY) {
        // Skip if it's a power pellet location
        const isPowerPellet = maze.powerPellets.some(p => p.x === x && p.y === y);
        // Skip if it's near ghost house (y 11-17, x 11-17)
        const isNearGhostHouse = y >= 11 && y <= 17 && x >= 11 && x <= 17;
        // Skip tunnel row (y 14)
        const isTunnel = y === 14 && (x < 6 || x > 21);

        if (!isPowerPellet && !isNearGhostHouse && !isTunnel) {
          maze.pellets.push({ x, y });
        }
      }
    }
  }
}

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
  pixelX: number;
  pixelY: number;
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
  nextDirX: number;
  nextDirY: number;
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
  private mazeData!: MazeData;
  private pellets: Set<string> = new Set(); // "x,y" keys
  private powerPellets: Set<string> = new Set();

  private player!: Phaser.GameObjects.Graphics;
  private playerGridX: number = 14;
  private playerGridY: number = 23;
  private playerPixelX: number = 14 * CONFIG.TILE_SIZE;
  private playerPixelY: number = 23 * CONFIG.TILE_SIZE;
  private playerDirX: number = 0;
  private playerDirY: number = 0;
  private playerNextDirX: number = 0;
  private playerNextDirY: number = 0;
  private mouthAngle: number = 0;

  private ghosts: Ghost[] = [];
  private powered: boolean = false;
  private powerTimer: number = 0;
  private ghostReleaseTimer: number = 0;

  private mazeGraphics!: Phaser.GameObjects.Graphics;
  private pelletGraphics!: Phaser.GameObjects.Graphics;
  private livesText!: Phaser.GameObjects.Text;
  private powerPelletVisible: boolean = true;
  private powerPelletTimer: number = 0;

  // Audio
  private sounds: ChomperSounds | null = null;
  private soundEnabled: boolean = true;
  private wakaToggle: boolean = false; // Alternate between waka1 and waka2
  private wakaTimer: number = 0;

  constructor(
    onScoreUpdate: (score: number) => void,
    onGameOver: (finalScore: number) => void,
    getDirection: () => { up: boolean; down: boolean; left: boolean; right: boolean },
    getAction: () => boolean,
    seed: number,
    soundEnabled: boolean = true,
    soundVolume: number = 0.7
  ) {
    super({ key: 'ChomperScene' });
    this.onScoreUpdate = onScoreUpdate;
    this.onGameOver = onGameOver;
    this.getDirection = getDirection;
    this.getAction = getAction;
    this.rng = new SeededRNG(seed);
    this.soundEnabled = soundEnabled;

    // Initialize sounds if enabled
    if (this.soundEnabled) {
      try {
        this.sounds = new ChomperSounds(soundVolume);
      } catch (e) {
        console.warn('Failed to initialize audio:', e);
        this.sounds = null;
      }
    }
  }

  create(): void {
    this.loadLevel(this.level);

    // Play level start sound
    if (this.sounds && this.soundEnabled) {
      this.sounds.play('levelStart');
    }

    // Register shutdown handler for cleanup
    this.events.on('shutdown', this.onShutdown, this);
  }

  onShutdown(): void {
    // Clean up audio
    if (this.sounds) {
      this.sounds.destroy();
      this.sounds = null;
    }
  }

  loadLevel(level: number): void {
    // Select maze (in classic Pac-Man, all levels use same maze layout)
    const mazeIndex = (level - 1) % MAZES.length;
    this.mazeData = MAZES[mazeIndex];

    // Initialize pellet sets
    this.pellets = new Set(this.mazeData.pellets.map(p => `${p.x},${p.y}`));
    this.powerPellets = new Set(this.mazeData.powerPellets.map(p => `${p.x},${p.y}`));

    // Reset player position
    this.playerGridX = this.mazeData.playerStart.x;
    this.playerGridY = this.mazeData.playerStart.y;
    this.playerPixelX = this.playerGridX * CONFIG.TILE_SIZE;
    this.playerPixelY = this.playerGridY * CONFIG.TILE_SIZE;
    this.playerDirX = 0;
    this.playerDirY = 0;
    this.playerNextDirX = 0;
    this.playerNextDirY = 0;

    // Reset ghost release timer
    this.ghostReleaseTimer = 0;

    // Create or clear graphics
    if (!this.mazeGraphics) {
      this.mazeGraphics = this.add.graphics();
      this.pelletGraphics = this.add.graphics();
      this.player = this.add.graphics();

      // Set depths to control rendering order
      this.pelletGraphics.setDepth(0);  // Pellets on bottom
      this.mazeGraphics.setDepth(1);     // Walls on top of pellets
      this.player.setDepth(2);           // Player on top of everything
    } else {
      this.mazeGraphics.clear();
      this.pelletGraphics.clear();
      this.player.clear();
      this.ghosts.forEach(g => g.graphics.destroy());
      this.ghosts = [];
    }

    this.drawMaze();
    this.drawPellets();

    // Create ghosts
    this.createGhosts();

    // UI
    if (!this.livesText) {
      this.livesText = this.add.text(8, this.scale.height - 24, `LIVES: ${this.lives}`, {
        fontFamily: '"Press Start 2P"',
        fontSize: '12px',
        color: '#ffff00',
      });
    } else {
      this.livesText.setText(`LIVES: ${this.lives}`);
    }

    // Ready message
    const readyText = this.add.text(
      this.scale.width / 2,
      this.mazeData.ghostHouse.y * CONFIG.TILE_SIZE,
      level === 1 ? 'READY!' : `LEVEL ${level}`,
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
      { name: 'pink', color: GHOST_COLORS.pink, gridX: 14, gridY: 14, released: true, exitedHouse: false }, // Pink starts ready to leave
      { name: 'cyan', color: GHOST_COLORS.cyan, gridX: 13, gridY: 15, released: false, exitedHouse: false },
      { name: 'orange', color: GHOST_COLORS.orange, gridX: 15, gridY: 15, released: false, exitedHouse: false },
    ];

    for (const data of ghostData) {
      const ghost = this.add.graphics();
      ghost.setDepth(2); // Ghosts render on top with player
      this.ghosts.push({
        graphics: ghost,
        gridX: data.gridX,
        gridY: data.gridY,
        pixelX: data.gridX * CONFIG.TILE_SIZE,
        pixelY: data.gridY * CONFIG.TILE_SIZE,
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
        nextDirX: 0,
        nextDirY: 0,
      });
    }

    this.ghosts.forEach(g => this.drawGhost(g));
  }

  drawMaze(): void {
    this.mazeGraphics.clear();

    for (let y = 0; y < this.mazeData.walls.length; y++) {
      for (let x = 0; x < this.mazeData.walls[y].length; x++) {
        const tile = this.mazeData.walls[y][x];
        const px = x * CONFIG.TILE_SIZE;
        const py = y * CONFIG.TILE_SIZE;

        if (tile === TILE.WALL) {
          // Wall - blue rounded rectangles
          this.mazeGraphics.fillStyle(0x2121de);
          this.mazeGraphics.fillRoundedRect(
            px + 2,
            py + 2,
            CONFIG.TILE_SIZE - 4,
            CONFIG.TILE_SIZE - 4,
            3
          );
        } else if (tile === TILE.DOOR) {
          // Ghost house door - pink line
          this.mazeGraphics.lineStyle(2, 0xffb8ff);
          this.mazeGraphics.lineBetween(px, py + CONFIG.TILE_SIZE / 2, px + CONFIG.TILE_SIZE, py + CONFIG.TILE_SIZE / 2);
        }
      }
    }
  }

  drawPellets(): void {
    this.pelletGraphics.clear();

    // Draw regular pellets
    this.pellets.forEach(key => {
      const [x, y] = key.split(',').map(Number);
      const px = x * CONFIG.TILE_SIZE + CONFIG.TILE_SIZE / 2;
      const py = y * CONFIG.TILE_SIZE + CONFIG.TILE_SIZE / 2;
      this.pelletGraphics.fillStyle(0xffb897);
      this.pelletGraphics.fillCircle(px, py, 2);
    });

    // Draw power pellets (flashing)
    if (this.powerPelletVisible) {
      this.powerPellets.forEach(key => {
        const [x, y] = key.split(',').map(Number);
        const px = x * CONFIG.TILE_SIZE + CONFIG.TILE_SIZE / 2;
        const py = y * CONFIG.TILE_SIZE + CONFIG.TILE_SIZE / 2;
        this.pelletGraphics.fillStyle(0xffb897);
        this.pelletGraphics.fillCircle(px, py, 6);
      });
    }
  }

  drawPlayer(): void {
    this.player.clear();
    this.player.fillStyle(0xffff00);

    // Animate mouth
    this.mouthAngle = Math.abs(Math.sin(Date.now() / 100)) * 45;

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
    if (this.playerDirX === 1) rotation = 0;
    else if (this.playerDirX === -1) rotation = Math.PI;
    else if (this.playerDirY === 1) rotation = Math.PI / 2;
    else if (this.playerDirY === -1) rotation = -Math.PI / 2;

    this.player.setRotation(rotation);
    const px = this.playerPixelX + CONFIG.TILE_SIZE / 2;
    const py = this.playerPixelY + CONFIG.TILE_SIZE / 2;
    this.player.setPosition(px, py);
  }

  drawGhost(ghost: Ghost): void {
    ghost.graphics.clear();
    const size = CONFIG.TILE_SIZE / 2 - 2;

    if (ghost.eaten) {
      // Eyes only
      ghost.graphics.fillStyle(0xffffff);
      ghost.graphics.fillCircle(-size / 2, 0, 4);
      ghost.graphics.fillCircle(size / 2, 0, 4);
      ghost.graphics.fillStyle(0x0000ff);
      ghost.graphics.fillCircle(-size / 2, 0, 2);
      ghost.graphics.fillCircle(size / 2, 0, 2);
    } else {
      const color = ghost.frightened
        ? (this.powerTimer < 2000 && Math.floor(Date.now() / 200) % 2 === 0 ? 0xffffff : 0x2121de)
        : ghost.color;

      ghost.graphics.fillStyle(color);

      // Head
      ghost.graphics.beginPath();
      ghost.graphics.arc(0, 0, size, Math.PI, 0, true);
      ghost.graphics.closePath();
      ghost.graphics.fillPath();

      // Body
      ghost.graphics.fillRect(-size, 0, size * 2, size);

      // Wavy bottom
      const wavePoints = 4;
      const waveWidth = (size * 2) / wavePoints;
      for (let i = 0; i < wavePoints; i++) {
        const x1 = -size + i * waveWidth;
        const x2 = x1 + waveWidth / 2;
        const x3 = x1 + waveWidth;
        ghost.graphics.fillTriangle(x1, size, x2, size + 4, x3, size);
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

    const px = ghost.pixelX + CONFIG.TILE_SIZE / 2;
    const py = ghost.pixelY + CONFIG.TILE_SIZE / 2;
    ghost.graphics.setPosition(px, py);
  }

  update(time: number, delta: number): void {
    if (this.gameOver || this.paused) return;

    const dt = delta / 1000;

    // Flash power pellets
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
          if (!g.eaten) g.frightened = false;
        });
        // Stop siren sound
        if (this.sounds && this.soundEnabled) {
          this.sounds.stopLoop('siren');
        }
      }
    }

    // Play waka-waka sound when moving
    if ((this.playerDirX !== 0 || this.playerDirY !== 0) && !this.gameOver && !this.paused) {
      this.wakaTimer += delta;
      if (this.wakaTimer > 150) {
        this.wakaTimer = 0;
        if (this.sounds && this.soundEnabled) {
          this.sounds.play(this.wakaToggle ? 'waka1' : 'waka2');
          this.wakaToggle = !this.wakaToggle;
        }
      }
    }

    // Release ghosts
    if (!this.ghosts.every(g => g.released)) {
      this.ghostReleaseTimer += delta;
      if (this.ghostReleaseTimer > CONFIG.GHOST_RELEASE_DELAY) {
        const unreleased = this.ghosts.find(g => !g.released);
        if (unreleased) unreleased.released = true;
        this.ghostReleaseTimer = 0;
      }
    }

    // Handle input
    const dir = this.getDirection();
    if (dir.up) {
      this.playerNextDirX = 0;
      this.playerNextDirY = -1;
    } else if (dir.down) {
      this.playerNextDirX = 0;
      this.playerNextDirY = 1;
    } else if (dir.left) {
      this.playerNextDirX = -1;
      this.playerNextDirY = 0;
    } else if (dir.right) {
      this.playerNextDirX = 1;
      this.playerNextDirY = 0;
    }

    // Move
    this.movePlayer(dt);
    this.moveGhosts(dt);

    // Check
    this.checkCollisions();
    if (this.pellets.size === 0 && this.powerPellets.size === 0) {
      this.levelComplete();
    } else if (this.pellets.size + this.powerPellets.size <= 5) {
      // Debug: log remaining pellets when only a few left
      console.log(`Remaining: ${this.pellets.size} pellets, ${this.powerPellets.size} power pellets`);
      if (this.pellets.size > 0) {
        console.log('Remaining pellet locations:', Array.from(this.pellets));
      }
      if (this.powerPellets.size > 0) {
        console.log('Remaining power pellet locations:', Array.from(this.powerPellets));
      }
    }

    // Draw
    this.drawPlayer();
    this.ghosts.forEach(g => this.drawGhost(g));
  }

  movePlayer(dt: number): void {
    // Calculate distance from current tile center
    const centerX = this.playerGridX * CONFIG.TILE_SIZE + CONFIG.TILE_SIZE / 2;
    const centerY = this.playerGridY * CONFIG.TILE_SIZE + CONFIG.TILE_SIZE / 2;
    const distFromCenterX = Math.abs(this.playerPixelX + CONFIG.TILE_SIZE / 2 - centerX);
    const distFromCenterY = Math.abs(this.playerPixelY + CONFIG.TILE_SIZE / 2 - centerY);

    // Only process direction changes if the queued direction is DIFFERENT from current
    // or if player is stopped (both directions are 0)
    const isStopped = this.playerDirX === 0 && this.playerDirY === 0;
    const isDifferentDirection = this.playerNextDirX !== this.playerDirX || this.playerNextDirY !== this.playerDirY;

    if ((this.playerNextDirX !== 0 || this.playerNextDirY !== 0) && (isStopped || isDifferentDirection)) {
      const is180Turn = (this.playerNextDirX === -this.playerDirX && this.playerNextDirY === -this.playerDirY);

      // 180-degree turns: allow immediately (classic Pac-Man behavior)
      if (is180Turn) {
        this.playerDirX = this.playerNextDirX;
        this.playerDirY = this.playerNextDirY;
      }
      // 90-degree turns or starting from stopped: only when close to tile center
      else if (distFromCenterX < 8 && distFromCenterY < 8) {
        const nextGridX = this.playerGridX + this.playerNextDirX;
        const nextGridY = this.playerGridY + this.playerNextDirY;

        if (this.canPlayerMoveTo(nextGridX, nextGridY)) {
          this.playerDirX = this.playerNextDirX;
          this.playerDirY = this.playerNextDirY;
          // Snap to tile center for clean 90-degree turns
          this.playerPixelX = this.playerGridX * CONFIG.TILE_SIZE;
          this.playerPixelY = this.playerGridY * CONFIG.TILE_SIZE;
        }
      }
    }

    // Move in current direction
    if (this.playerDirX !== 0 || this.playerDirY !== 0) {
      // Calculate movement
      const speed = CONFIG.PLAYER_SPEED * dt;
      this.playerPixelX += this.playerDirX * speed;
      this.playerPixelY += this.playerDirY * speed;

      // Update grid position based on pixel position
      this.playerGridX = Math.floor((this.playerPixelX + CONFIG.TILE_SIZE / 2) / CONFIG.TILE_SIZE);
      this.playerGridY = Math.floor((this.playerPixelY + CONFIG.TILE_SIZE / 2) / CONFIG.TILE_SIZE);

      // Tunnel wraparound
      if (this.playerGridX < 0) {
        this.playerGridX = CONFIG.GRID_WIDTH - 1;
        this.playerPixelX = this.playerGridX * CONFIG.TILE_SIZE;
      }
      if (this.playerGridX >= CONFIG.GRID_WIDTH) {
        this.playerGridX = 0;
        this.playerPixelX = 0;
      }

      // Check for wall collision ahead
      const nextGridX = this.playerGridX + this.playerDirX;
      const nextGridY = this.playerGridY + this.playerDirY;
      if (!this.canPlayerMoveTo(nextGridX, nextGridY)) {
        // Stop at grid position but KEEP direction (classic Pac-Man behavior)
        this.playerPixelX = this.playerGridX * CONFIG.TILE_SIZE;
        this.playerPixelY = this.playerGridY * CONFIG.TILE_SIZE;
        // Don't reset direction - player should keep facing this way
      }
    }

    // ALWAYS check pellet collision (not just when entering new tile)
    // This prevents missing pellets due to timing issues
    this.checkPelletCollision();
  }

  moveGhosts(dt: number): void {
    for (const ghost of this.ghosts) {
      if (!ghost.released) continue;

      // Check if we're at a grid center (decision point)
      const centerX = ghost.gridX * CONFIG.TILE_SIZE + CONFIG.TILE_SIZE / 2;
      const centerY = ghost.gridY * CONFIG.TILE_SIZE + CONFIG.TILE_SIZE / 2;
      const atCenterX = Math.abs(ghost.pixelX + CONFIG.TILE_SIZE / 2 - centerX) < 2;
      const atCenterY = Math.abs(ghost.pixelY + CONFIG.TILE_SIZE / 2 - centerY) < 2;

      if (atCenterX && atCenterY) {
        // Determine target based on state
        let targetGridX: number;
        let targetGridY: number;

        if (!ghost.exitedHouse) {
          // Exit ghost house: first move to center x, then move up
          if (ghost.gridX !== 14) {
            targetGridX = 14; // Move to center horizontally first
            targetGridY = ghost.gridY; // Stay at current y
          } else {
            targetGridX = 14; // Already centered, move up
            targetGridY = 11; // Exit position
          }
        } else if (ghost.eaten) {
          targetGridX = this.mazeData.ghostHouse.x;
          targetGridY = this.mazeData.ghostHouse.y;
        } else if (ghost.frightened) {
          // Flee from player
          const dx = ghost.gridX - this.playerGridX;
          const dy = ghost.gridY - this.playerGridY;
          targetGridX = dx > 0 ? CONFIG.GRID_WIDTH - 2 : 1;
          targetGridY = dy > 0 ? CONFIG.GRID_HEIGHT - 2 : 1;
        } else {
          // Chase player
          targetGridX = this.playerGridX;
          targetGridY = this.playerGridY;
        }

        // Choose best direction
        const directions = [
          { x: 1, y: 0 },
          { x: -1, y: 0 },
          { x: 0, y: 1 },
          { x: 0, y: -1 },
        ];

        let bestDir = { x: ghost.dirX, y: ghost.dirY };
        let bestDist = Infinity;

        for (const dir of directions) {
          const nextX = ghost.gridX + dir.x;
          const nextY = ghost.gridY + dir.y;

          // Skip reverse direction (unless ghost is stuck)
          if (dir.x === -ghost.dirX && dir.y === -ghost.dirY && (ghost.dirX !== 0 || ghost.dirY !== 0)) continue;
          if (!this.canGhostMoveTo(nextX, nextY, ghost)) continue;

          const dist = Math.abs(nextX - targetGridX) + Math.abs(nextY - targetGridY);
          if (dist < bestDist) {
            bestDist = dist;
            bestDir = dir;
          }
        }

        // Update direction
        ghost.dirX = bestDir.x;
        ghost.dirY = bestDir.y;

        // Snap to grid center for clean turns
        ghost.pixelX = ghost.gridX * CONFIG.TILE_SIZE;
        ghost.pixelY = ghost.gridY * CONFIG.TILE_SIZE;
      }

      // Move in current direction
      if (ghost.dirX !== 0 || ghost.dirY !== 0) {
        // Calculate speed based on state (eaten ghosts move faster to get home)
        const speed = ghost.eaten ? CONFIG.GHOST_SPEED * 2 :
                      ghost.frightened ? CONFIG.FRIGHTENED_SPEED :
                      CONFIG.GHOST_SPEED;

        // Move
        ghost.pixelX += ghost.dirX * speed * dt;
        ghost.pixelY += ghost.dirY * speed * dt;

        // Update grid position
        ghost.gridX = Math.floor((ghost.pixelX + CONFIG.TILE_SIZE / 2) / CONFIG.TILE_SIZE);
        ghost.gridY = Math.floor((ghost.pixelY + CONFIG.TILE_SIZE / 2) / CONFIG.TILE_SIZE);

        // Tunnel wraparound
        if (ghost.gridX < 0) {
          ghost.gridX = CONFIG.GRID_WIDTH - 1;
          ghost.pixelX = ghost.gridX * CONFIG.TILE_SIZE;
        }
        if (ghost.gridX >= CONFIG.GRID_WIDTH) {
          ghost.gridX = 0;
          ghost.pixelX = 0;
        }

        // Check if exited house
        if (!ghost.exitedHouse && ghost.gridY <= 11) {
          ghost.exitedHouse = true;
        }
      }
    }
  }

  canPlayerMoveTo(x: number, y: number): boolean {
    if (y < 0 || y >= this.mazeData.walls.length) return false;
    if (x < 0 || x >= this.mazeData.walls[0].length) return true; // Tunnel
    const tile = this.mazeData.walls[y][x];
    return tile === TILE.EMPTY;
  }

  canGhostMoveTo(x: number, y: number, ghost: Ghost): boolean {
    if (y < 0 || y >= this.mazeData.walls.length) return false;
    if (x < 0 || x >= this.mazeData.walls[0].length) return true; // Tunnel
    const tile = this.mazeData.walls[y][x];
    // Ghosts can go through doors when eaten OR when leaving/entering house
    return tile === TILE.EMPTY || tile === TILE.DOOR;
  }

  checkPelletCollision(): void {
    const key = `${this.playerGridX},${this.playerGridY}`;

    if (this.pellets.has(key)) {
      this.pellets.delete(key);
      this.score += CONFIG.PELLET_POINTS;
      this.onScoreUpdate(this.score);
      this.drawPellets();
    }

    if (this.powerPellets.has(key)) {
      this.powerPellets.delete(key);
      this.score += CONFIG.POWER_PELLET_POINTS;
      this.onScoreUpdate(this.score);
      this.powered = true;
      this.powerTimer = CONFIG.POWER_DURATION;
      this.ghosts.forEach(g => {
        if (!g.eaten) g.frightened = true;
      });
      this.drawPellets();

      // Start power pellet siren
      if (this.sounds && this.soundEnabled) {
        this.sounds.startLoop('siren');
      }
    }
  }

  checkCollisions(): void {
    for (const ghost of this.ghosts) {
      if (!ghost.released) continue;

      // Check collision with player using distance (more reliable than grid position)
      const dx = Math.abs(ghost.pixelX - this.playerPixelX);
      const dy = Math.abs(ghost.pixelY - this.playerPixelY);
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < CONFIG.TILE_SIZE * 0.6) {
        if (ghost.frightened && !ghost.eaten) {
          // Eat ghost
          this.score += CONFIG.GHOST_POINTS;
          this.onScoreUpdate(this.score);
          ghost.eaten = true;
          ghost.frightened = false;

          // Play eat ghost sound
          if (this.sounds && this.soundEnabled) {
            this.sounds.play('eatGhost');
          }
        } else if (!ghost.eaten) {
          // Die
          this.loseLife();
          return; // Exit early to prevent multiple deaths
        }
      }

      // Respawn eaten ghost when close to ghost house (use distance check)
      if (ghost.eaten) {
        const houseX = this.mazeData.ghostHouse.x * CONFIG.TILE_SIZE;
        const houseY = this.mazeData.ghostHouse.y * CONFIG.TILE_SIZE;
        const houseDx = Math.abs(ghost.pixelX - houseX);
        const houseDy = Math.abs(ghost.pixelY - houseY);

        if (houseDx < CONFIG.TILE_SIZE / 2 && houseDy < CONFIG.TILE_SIZE / 2) {
          ghost.eaten = false;
          ghost.exitedHouse = false;
          ghost.gridX = this.mazeData.ghostHouse.x;
          ghost.gridY = this.mazeData.ghostHouse.y;
          ghost.pixelX = ghost.gridX * CONFIG.TILE_SIZE;
          ghost.pixelY = ghost.gridY * CONFIG.TILE_SIZE;
          ghost.dirX = 0;
          ghost.dirY = 0;
        }
      }
    }
  }

  loseLife(): void {
    this.lives--;
    this.livesText.setText(`LIVES: ${this.lives}`);

    // Stop all sounds and play death sound
    if (this.sounds && this.soundEnabled) {
      this.sounds.stopAll();
      this.sounds.play('death');
    }

    if (this.lives <= 0) {
      this.endGame();
    } else {
      // Reset player
      this.playerGridX = this.mazeData.playerStart.x;
      this.playerGridY = this.mazeData.playerStart.y;
      this.playerPixelX = this.playerGridX * CONFIG.TILE_SIZE;
      this.playerPixelY = this.playerGridY * CONFIG.TILE_SIZE;
      this.playerDirX = 0;
      this.playerDirY = 0;
      this.playerNextDirX = 0;
      this.playerNextDirY = 0;
      this.powered = false;

      // Reset ghosts (red and pink start released, like real Pac-Man)
      this.ghosts.forEach((g, i) => {
        g.gridX = g.homeX;
        g.gridY = g.homeY;
        g.pixelX = g.gridX * CONFIG.TILE_SIZE;
        g.pixelY = g.gridY * CONFIG.TILE_SIZE;
        g.released = i <= 1; // Red (0) and pink (1) start released
        g.exitedHouse = i === 0; // Only red starts outside
        g.frightened = false;
        g.eaten = false;
        g.dirX = 0;
        g.dirY = 0;
        g.nextDirX = 0;
        g.nextDirY = 0;
      });

      this.ghostReleaseTimer = 0;
      this.paused = true;
      this.time.delayedCall(2000, () => {
        this.paused = false;
      });
    }
  }

  levelComplete(): void {
    this.level++;
    this.score += 500;
    this.onScoreUpdate(this.score);

    // Stop all sounds and play level complete sound
    if (this.sounds && this.soundEnabled) {
      this.sounds.stopAll();
      this.sounds.play('levelStart'); // Reuse level start for level complete
    }

    this.loadLevel(this.level);
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
