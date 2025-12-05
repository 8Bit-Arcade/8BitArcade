import * as Phaser from 'phaser';
import { SeededRNG } from '../engine/SeededRNG';

const CONFIG = {
  TILE_SIZE: 21,
  PLAYER_SPEED: 5, // Grid squares per second
  GHOST_SPEED: 4,
  FRIGHTENED_SPEED: 2.5,
  PELLET_POINTS: 5,
  POWER_PELLET_POINTS: 25,
  GHOST_POINTS: 100,
  POWER_DURATION: 6000,
  LIVES: 3,
  GHOST_RELEASE_DELAY: 3000,
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

  // MAZE 2: Wide corridors
  {
    walls: [
      [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
      [1,0,0,0,0,0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,1],
      [1,0,1,1,1,1,0,1,1,1,1,1,0,1,1,0,1,1,1,1,1,0,1,1,1,1,0,1],
      [1,0,1,1,1,1,0,1,1,1,1,1,0,1,1,0,1,1,1,1,1,0,1,1,1,1,0,1],
      [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
      [1,1,1,1,0,1,1,0,1,1,1,1,0,1,1,0,1,1,1,1,0,1,1,0,1,1,1,1],
      [1,1,1,1,0,1,1,0,1,1,1,1,0,1,1,0,1,1,1,1,0,1,1,0,1,1,1,1],
      [1,0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,1],
      [1,0,1,1,1,1,1,1,0,1,1,0,1,1,1,1,0,1,1,0,1,1,1,1,1,1,0,1],
      [1,0,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,0,1],
      [1,1,1,1,1,1,0,1,1,0,0,0,0,0,0,0,0,0,0,1,1,0,1,1,1,1,1,1],
      [1,1,1,1,1,1,0,1,1,0,1,1,1,2,2,1,1,1,0,1,1,0,1,1,1,1,1,1],
      [1,1,1,1,1,1,0,1,1,0,1,0,0,0,0,0,0,1,0,1,1,0,1,1,1,1,1,1],
      [0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0],
      [1,1,1,1,1,1,0,1,1,0,1,0,0,0,0,0,0,1,0,1,1,0,1,1,1,1,1,1],
      [1,1,1,1,1,1,0,1,1,0,1,1,1,1,1,1,1,1,0,1,1,0,1,1,1,1,1,1],
      [1,1,1,1,1,1,0,1,1,0,0,0,0,0,0,0,0,0,0,1,1,0,1,1,1,1,1,1],
      [1,0,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,0,1],
      [1,0,1,1,1,1,1,1,0,1,1,0,1,1,1,1,0,1,1,0,1,1,1,1,1,1,0,1],
      [1,0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,1],
      [1,1,1,1,0,1,1,0,1,1,1,1,0,1,1,0,1,1,1,1,0,1,1,0,1,1,1,1],
      [1,1,1,1,0,1,1,0,1,1,1,1,0,1,1,0,1,1,1,1,0,1,1,0,1,1,1,1],
      [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
      [1,0,1,1,1,1,0,1,1,1,1,1,0,1,1,0,1,1,1,1,1,0,1,1,1,1,0,1],
      [1,0,1,1,1,1,0,1,1,1,1,1,0,1,1,0,1,1,1,1,1,0,1,1,1,1,0,1],
      [1,0,0,0,0,0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,1],
      [1,1,1,1,0,1,1,1,1,1,1,1,0,1,1,0,1,1,1,1,1,1,1,0,1,1,1,1],
      [1,1,1,1,0,1,1,1,1,1,1,1,0,1,1,0,1,1,1,1,1,1,1,0,1,1,1,1],
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
  private mazeData!: MazeData;
  private pellets: Set<string> = new Set(); // "x,y" keys
  private powerPellets: Set<string> = new Set();

  private player!: Phaser.GameObjects.Graphics;
  private playerGridX: number = 14;
  private playerGridY: number = 23;
  private playerDir: { x: number; y: number } = { x: 0, y: 0 };
  private nextDir: { x: number; y: number } = { x: 0, y: 0 };
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
    this.loadLevel(this.level);
  }

  loadLevel(level: number): void {
    // Select maze
    const mazeIndex = (level - 1) % MAZES.length;
    this.mazeData = MAZES[mazeIndex];

    // Initialize pellet sets
    this.pellets = new Set(this.mazeData.pellets.map(p => `${p.x},${p.y}`));
    this.powerPellets = new Set(this.mazeData.powerPellets.map(p => `${p.x},${p.y}`));

    // Reset player position
    this.playerGridX = this.mazeData.playerStart.x;
    this.playerGridY = this.mazeData.playerStart.y;
    this.playerDir = { x: 0, y: 0 };
    this.nextDir = { x: 0, y: 0 };

    // Create or clear graphics
    if (!this.mazeGraphics) {
      this.mazeGraphics = this.add.graphics();
      this.pelletGraphics = this.add.graphics();
      this.player = this.add.graphics();
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
      { name: 'pink', color: GHOST_COLORS.pink, gridX: 14, gridY: 14, released: false, exitedHouse: false },
      { name: 'cyan', color: GHOST_COLORS.cyan, gridX: 12, gridY: 14, released: false, exitedHouse: false },
      { name: 'orange', color: GHOST_COLORS.orange, gridX: 16, gridY: 14, released: false, exitedHouse: false },
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
        exitedHouse: data.exitedHouse,
        dirX: 0,
        dirY: 0,
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
    if (this.playerDir.x === 1) rotation = 0;
    else if (this.playerDir.x === -1) rotation = Math.PI;
    else if (this.playerDir.y === 1) rotation = Math.PI / 2;
    else if (this.playerDir.y === -1) rotation = -Math.PI / 2;

    this.player.setRotation(rotation);
    const px = this.playerGridX * CONFIG.TILE_SIZE + CONFIG.TILE_SIZE / 2;
    const py = this.playerGridY * CONFIG.TILE_SIZE + CONFIG.TILE_SIZE / 2;
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

    const px = ghost.gridX * CONFIG.TILE_SIZE + CONFIG.TILE_SIZE / 2;
    const py = ghost.gridY * CONFIG.TILE_SIZE + CONFIG.TILE_SIZE / 2;
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
    if (dir.up) this.nextDir = { x: 0, y: -1 };
    else if (dir.down) this.nextDir = { x: 0, y: 1 };
    else if (dir.left) this.nextDir = { x: -1, y: 0 };
    else if (dir.right) this.nextDir = { x: 1, y: 0 };

    // Move
    this.movePlayer(dt);
    this.moveGhosts(dt);

    // Check
    this.checkCollisions();
    if (this.pellets.size === 0 && this.powerPellets.size === 0) {
      this.levelComplete();
    }

    // Draw
    this.drawPlayer();
    this.ghosts.forEach(g => this.drawGhost(g));
  }

  movePlayer(dt: number): void {
    // Try to turn
    const nextGridX = this.playerGridX + this.nextDir.x;
    const nextGridY = this.playerGridY + this.nextDir.y;
    if (this.canPlayerMoveTo(nextGridX, nextGridY)) {
      this.playerDir = { ...this.nextDir };
    }

    // Move
    if (this.playerDir.x !== 0 || this.playerDir.y !== 0) {
      const targetGridX = this.playerGridX + this.playerDir.x;
      const targetGridY = this.playerGridY + this.playerDir.y;

      if (this.canPlayerMoveTo(targetGridX, targetGridY)) {
        this.playerGridX = targetGridX;
        this.playerGridY = targetGridY;
        this.checkPelletCollision();
      } else {
        this.playerDir = { x: 0, y: 0 };
      }
    }

    // Tunnel wraparound
    if (this.playerGridX < 0) this.playerGridX = CONFIG.GRID_WIDTH - 1;
    if (this.playerGridX >= CONFIG.GRID_WIDTH) this.playerGridX = 0;
  }

  moveGhosts(dt: number): void {
    for (const ghost of this.ghosts) {
      if (!ghost.released) continue;

      // Determine target
      if (!ghost.exitedHouse) {
        ghost.targetGridX = 14;
        ghost.targetGridY = 11;
      } else if (ghost.eaten) {
        ghost.targetGridX = this.mazeData.ghostHouse.x;
        ghost.targetGridY = this.mazeData.ghostHouse.y;
      } else if (ghost.frightened) {
        // Flee
        const dx = ghost.gridX - this.playerGridX;
        const dy = ghost.gridY - this.playerGridY;
        ghost.targetGridX = dx > 0 ? CONFIG.GRID_WIDTH - 2 : 1;
        ghost.targetGridY = dy > 0 ? CONFIG.GRID_HEIGHT - 2 : 1;
      } else {
        // Chase player
        ghost.targetGridX = this.playerGridX;
        ghost.targetGridY = this.playerGridY;
      }

      // Choose direction
      const directions = [
        { x: 1, y: 0 },
        { x: -1, y: 0 },
        { x: 0, y: 1 },
        { x: 0, y: -1 },
      ];

      let bestDir = { x: 0, y: 0 };
      let bestDist = Infinity;

      for (const dir of directions) {
        const nextX = ghost.gridX + dir.x;
        const nextY = ghost.gridY + dir.y;

        // Skip reverse and invalid
        if (dir.x === -ghost.dirX && dir.y === -ghost.dirY) continue;
        if (!this.canGhostMoveTo(nextX, nextY, ghost.eaten)) continue;

        const dist = Math.abs(nextX - ghost.targetGridX) + Math.abs(nextY - ghost.targetGridY);
        if (dist < bestDist) {
          bestDist = dist;
          bestDir = dir;
        }
      }

      // Move
      if (bestDir.x !== 0 || bestDir.y !== 0) {
        ghost.dirX = bestDir.x;
        ghost.dirY = bestDir.y;
        ghost.gridX += bestDir.x;
        ghost.gridY += bestDir.y;

        // Check exit
        if (!ghost.exitedHouse && ghost.gridY <= 11) {
          ghost.exitedHouse = true;
        }

        // Wraparound
        if (ghost.gridX < 0) ghost.gridX = CONFIG.GRID_WIDTH - 1;
        if (ghost.gridX >= CONFIG.GRID_WIDTH) ghost.gridX = 0;
      }
    }
  }

  canPlayerMoveTo(x: number, y: number): boolean {
    if (y < 0 || y >= this.mazeData.walls.length) return false;
    if (x < 0 || x >= this.mazeData.walls[0].length) return true; // Tunnel
    const tile = this.mazeData.walls[y][x];
    return tile === TILE.EMPTY;
  }

  canGhostMoveTo(x: number, y: number, isEaten: boolean): boolean {
    if (y < 0 || y >= this.mazeData.walls.length) return false;
    if (x < 0 || x >= this.mazeData.walls[0].length) return true; // Tunnel
    const tile = this.mazeData.walls[y][x];
    return tile === TILE.EMPTY || (isEaten && tile === TILE.DOOR);
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
    }
  }

  checkCollisions(): void {
    for (const ghost of this.ghosts) {
      if (!ghost.released) continue;

      if (ghost.gridX === this.playerGridX && ghost.gridY === this.playerGridY) {
        if (ghost.frightened && !ghost.eaten) {
          // Eat ghost
          this.score += CONFIG.GHOST_POINTS;
          this.onScoreUpdate(this.score);
          ghost.eaten = true;
          ghost.frightened = false;
        } else if (!ghost.eaten) {
          // Die
          this.loseLife();
        }
      }

      // Respawn eaten ghost
      if (ghost.eaten && ghost.gridX === this.mazeData.ghostHouse.x && ghost.gridY === this.mazeData.ghostHouse.y) {
        ghost.eaten = false;
        ghost.exitedHouse = false;
      }
    }
  }

  loseLife(): void {
    this.lives--;
    this.livesText.setText(`LIVES: ${this.lives}`);

    if (this.lives <= 0) {
      this.endGame();
    } else {
      this.playerGridX = this.mazeData.playerStart.x;
      this.playerGridY = this.mazeData.playerStart.y;
      this.playerDir = { x: 0, y: 0 };
      this.powered = false;

      this.ghosts.forEach((g, i) => {
        g.gridX = g.homeX;
        g.gridY = g.homeY;
        g.released = i === 0;
        g.exitedHouse = i === 0;
        g.frightened = false;
        g.eaten = false;
        g.dirX = 0;
        g.dirY = 0;
      });

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
