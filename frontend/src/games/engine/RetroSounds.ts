/**
 * Generic Retro Sound Generator
 * Procedurally generates authentic 8-bit arcade sounds using Web Audio API
 * Can be used across all games
 */

export class RetroSounds {
  private audioContext: AudioContext;
  private masterGain: GainNode;
  private sounds: Map<string, AudioBuffer> = new Map();
  private loopingSources: Map<string, AudioBufferSourceNode> = new Map();

  constructor(volume: number = 0.7) {
    this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    this.masterGain = this.audioContext.createGain();
    this.masterGain.gain.value = volume;
    this.masterGain.connect(this.audioContext.destination);
  }

  setVolume(volume: number): void {
    this.masterGain.gain.value = Math.max(0, Math.min(1, volume));
  }

  /**
   * Generate a simple beep/blip sound
   */
  generateBeep(frequency: number, duration: number): AudioBuffer {
    const sampleRate = this.audioContext.sampleRate;
    const length = sampleRate * duration;
    const buffer = this.audioContext.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;
      const wave = Math.sin(2 * Math.PI * frequency * t) > 0 ? 1 : -1;
      const envelope = Math.max(0, 1 - (t / duration));
      data[i] = wave * envelope * 0.3;
    }

    return buffer;
  }

  /**
   * Generate explosion sound (white noise with decay)
   */
  generateExplosion(duration: number = 0.5): AudioBuffer {
    const sampleRate = this.audioContext.sampleRate;
    const length = sampleRate * duration;
    const buffer = this.audioContext.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;
      const noise = Math.random() * 2 - 1;
      const envelope = Math.max(0, 1 - (t / duration));
      data[i] = noise * envelope * 0.4;
    }

    return buffer;
  }

  /**
   * Generate laser/shoot sound (descending pitch)
   */
  generateLaser(startFreq: number = 800, endFreq: number = 200, duration: number = 0.15): AudioBuffer {
    const sampleRate = this.audioContext.sampleRate;
    const length = sampleRate * duration;
    const buffer = this.audioContext.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;
      const progress = t / duration;
      const freq = startFreq + (endFreq - startFreq) * progress;
      const wave = Math.sin(2 * Math.PI * freq * t) > 0 ? 1 : -1;
      const envelope = Math.max(0, 1 - progress);
      data[i] = wave * envelope * 0.3;
    }

    return buffer;
  }

  /**
   * Generate power-up sound (ascending arpeggio)
   */
  generatePowerUp(): AudioBuffer {
    const sampleRate = this.audioContext.sampleRate;
    const duration = 0.4;
    const length = sampleRate * duration;
    const buffer = this.audioContext.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);

    const notes = [262, 330, 392, 523]; // C-E-G-C
    const noteLength = sampleRate * 0.08;

    for (let i = 0; i < length; i++) {
      const noteIndex = Math.floor(i / noteLength);
      if (noteIndex >= notes.length) break;

      const freq = notes[noteIndex];
      const notetime = (i % noteLength) / sampleRate;
      const wave = Math.sin(2 * Math.PI * freq * notetime);
      const envelope = Math.max(0, 1 - notetime / 0.08);
      data[i] = wave * envelope * 0.3;
    }

    return buffer;
  }

  /**
   * Generate hit/damage sound (low frequency thud)
   */
  generateHit(): AudioBuffer {
    const sampleRate = this.audioContext.sampleRate;
    const duration = 0.1;
    const length = sampleRate * duration;
    const buffer = this.audioContext.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;
      const freq = 100 * (1 - t / duration); // Descending thud
      const wave = Math.sin(2 * Math.PI * freq * t);
      const envelope = Math.max(0, 1 - (t / duration) * 2);
      data[i] = wave * envelope * 0.5;
    }

    return buffer;
  }

  /**
   * Generate jump sound (quick rising pitch)
   */
  generateJump(): AudioBuffer {
    const sampleRate = this.audioContext.sampleRate;
    const duration = 0.1;
    const length = sampleRate * duration;
    const buffer = this.audioContext.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;
      const freq = 300 + (t / duration) * 400; // Rising pitch
      const wave = Math.sin(2 * Math.PI * freq * t);
      const envelope = Math.max(0, 1 - t / duration);
      data[i] = wave * envelope * 0.3;
    }

    return buffer;
  }

  /**
   * Generate coin/collect sound
   */
  generateCoin(): AudioBuffer {
    const sampleRate = this.audioContext.sampleRate;
    const duration = 0.15;
    const length = sampleRate * duration;
    const buffer = this.audioContext.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);

    // Two quick tones
    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;
      const freq = i < length / 2 ? 800 : 1200;
      const wave = Math.sin(2 * Math.PI * freq * t);
      const envelope = Math.max(0, 1 - (t / duration) * 3);
      data[i] = wave * envelope * 0.3;
    }

    return buffer;
  }

  /**
   * Generate game over sound (sad descending tones)
   */
  generateGameOver(): AudioBuffer {
    const sampleRate = this.audioContext.sampleRate;
    const duration = 1.2;
    const length = sampleRate * duration;
    const buffer = this.audioContext.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);

    const notes = [440, 392, 349, 294]; // A-G-F-D (descending)
    const noteLength = sampleRate * 0.25;

    for (let i = 0; i < length; i++) {
      const noteIndex = Math.floor(i / noteLength);
      if (noteIndex >= notes.length) break;

      const freq = notes[noteIndex];
      const notetime = (i % noteLength) / sampleRate;
      const wave = Math.sin(2 * Math.PI * freq * notetime);
      const envelope = Math.max(0, 1 - notetime / 0.25);
      data[i] = wave * envelope * 0.3;
    }

    return buffer;
  }

  /**
   * Register a custom sound
   */
  registerSound(name: string, buffer: AudioBuffer): void {
    this.sounds.set(name, buffer);
  }

  /**
   * Play a one-shot sound effect
   */
  play(soundName: string): void {
    const buffer = this.sounds.get(soundName);
    if (!buffer) return;

    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(this.masterGain);
    source.start(0);
  }

  /**
   * Start looping a sound
   */
  startLoop(soundName: string): void {
    this.stopLoop(soundName);

    const buffer = this.sounds.get(soundName);
    if (!buffer) return;

    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.connect(this.masterGain);
    source.start(0);

    this.loopingSources.set(soundName, source);
  }

  /**
   * Stop a looping sound
   */
  stopLoop(soundName: string): void {
    const source = this.loopingSources.get(soundName);
    if (source) {
      try {
        source.stop();
      } catch (e) {
        // Ignore errors
      }
      this.loopingSources.delete(soundName);
    }
  }

  /**
   * Stop all sounds
   */
  stopAll(): void {
    this.loopingSources.forEach((source) => {
      try {
        source.stop();
      } catch (e) {
        // Ignore errors
      }
    });
    this.loopingSources.clear();
  }

  /**
   * Clean up audio context
   */
  destroy(): void {
    this.stopAll();
    this.audioContext.close();
  }
}
