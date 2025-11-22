/**
 * Input Recorder for Anti-Cheat System
 * Records all player inputs with timestamps for server-side replay verification
 */

export interface GameInput {
  t: number; // Timestamp (ms from game start)
  type: string; // Input type: 'move', 'shoot', 'action', etc.
  data?: Record<string, unknown>; // Additional data
}

export class InputRecorder {
  public readonly sessionId: string;
  private inputs: GameInput[] = [];
  private startTime: number = 0;
  private isRecording: boolean = false;

  constructor(sessionId: string) {
    this.sessionId = sessionId;
  }

  /**
   * Start recording inputs
   */
  start(): void {
    this.inputs = [];
    this.startTime = Date.now();
    this.isRecording = true;
  }

  /**
   * Stop recording
   */
  stop(): void {
    this.isRecording = false;
  }

  /**
   * Record an input event
   */
  record(type: string, data?: Record<string, unknown>): void {
    if (!this.isRecording) return;

    this.inputs.push({
      t: Date.now() - this.startTime,
      type,
      data,
    });
  }

  /**
   * Get all recorded inputs
   */
  getInputs(): GameInput[] {
    return [...this.inputs];
  }

  /**
   * Get total duration in ms
   */
  getDuration(): number {
    if (this.inputs.length === 0) return 0;
    return this.inputs[this.inputs.length - 1].t;
  }

  /**
   * Get input count
   */
  getInputCount(): number {
    return this.inputs.length;
  }

  /**
   * Generate checksum for verification
   */
  async getChecksum(): Promise<string> {
    const data = JSON.stringify(this.inputs);
    const msgBuffer = new TextEncoder().encode(data);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Export game data for submission
   */
  async exportGameData(
    gameId: string,
    seed: number,
    finalScore: number
  ): Promise<{
    sessionId: string;
    gameId: string;
    seed: number;
    inputs: GameInput[];
    finalScore: number;
    checksum: string;
    duration: number;
  }> {
    return {
      sessionId: this.sessionId,
      gameId,
      seed,
      inputs: this.getInputs(),
      finalScore,
      checksum: await this.getChecksum(),
      duration: this.getDuration(),
    };
  }

  /**
   * Clear all inputs
   */
  clear(): void {
    this.inputs = [];
    this.startTime = 0;
    this.isRecording = false;
  }
}

export default InputRecorder;
