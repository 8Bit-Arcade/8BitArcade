/**
 * Seeded Random Number Generator
 * Uses Mulberry32 algorithm for deterministic randomness
 * Same seed + same sequence of calls = same results (critical for anti-cheat)
 */
export class SeededRNG {
  private state: number;
  public readonly seed: number;

  constructor(seed?: number) {
    this.seed = seed ?? Math.floor(Math.random() * 2147483647);
    this.state = this.seed;
  }

  /**
   * Generate next random number between 0 and 1
   * Mulberry32 algorithm - fast and deterministic
   */
  next(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /**
   * Random integer between min and max (inclusive)
   */
  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  /**
   * Random float between min and max
   */
  nextFloat(min: number, max: number): number {
    return this.next() * (max - min) + min;
  }

  /**
   * Random boolean with optional probability
   */
  nextBool(probability = 0.5): boolean {
    return this.next() < probability;
  }

  /**
   * Pick random element from array
   */
  pick<T>(array: T[]): T {
    return array[this.nextInt(0, array.length - 1)];
  }

  /**
   * Shuffle array in place
   */
  shuffle<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
      const j = this.nextInt(0, i);
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  /**
   * Random angle in radians
   */
  nextAngle(): number {
    return this.next() * Math.PI * 2;
  }

  /**
   * Random point within a circle
   */
  nextPointInCircle(radius: number): { x: number; y: number } {
    const angle = this.nextAngle();
    const r = Math.sqrt(this.next()) * radius;
    return {
      x: Math.cos(angle) * r,
      y: Math.sin(angle) * r,
    };
  }

  /**
   * Reset to initial seed
   */
  reset(): void {
    this.state = this.seed;
  }
}

export default SeededRNG;
