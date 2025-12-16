/**
 * Chomper Sound System
 * Generates authentic 8-bit arcade sounds using Web Audio API
 */

export class ChomperSounds {
  private audioContext: AudioContext;
  private masterGain: GainNode;
  private sounds: Map<string, AudioBuffer> = new Map();
  private loopingSources: Map<string, AudioBufferSourceNode> = new Map();

  constructor(volume: number = 0.7) {
    this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    this.masterGain = this.audioContext.createGain();
    this.masterGain.gain.value = volume;
    this.masterGain.connect(this.audioContext.destination);

    this.generateSounds();
  }

  setVolume(volume: number): void {
    this.masterGain.gain.value = Math.max(0, Math.min(1, volume));
  }

  private generateSounds(): void {
    // Waka waka (eating pellets) - two alternating tones
    this.sounds.set('waka1', this.generateWaka(440, 0.08));
    this.sounds.set('waka2', this.generateWaka(330, 0.08));

    // Power pellet siren (looping)
    this.sounds.set('siren', this.generateSiren());

    // Eat ghost
    this.sounds.set('eatGhost', this.generateEatGhost());

    // Death sound
    this.sounds.set('death', this.generateDeath());

    // Level start/complete
    this.sounds.set('levelStart', this.generateLevelStart());

    // Extra life (not used yet but available)
    this.sounds.set('extraLife', this.generateExtraLife());
  }

  /**
   * Generate waka-waka sound (pellet eating)
   */
  private generateWaka(frequency: number, duration: number): AudioBuffer {
    const sampleRate = this.audioContext.sampleRate;
    const length = sampleRate * duration;
    const buffer = this.audioContext.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;
      // Square wave with quick fade out
      const wave = Math.sin(2 * Math.PI * frequency * t) > 0 ? 1 : -1;
      const envelope = Math.max(0, 1 - (t / duration) * 4); // Quick fade
      data[i] = wave * envelope * 0.3;
    }

    return buffer;
  }

  /**
   * Generate power pellet siren (looping background)
   */
  private generateSiren(): AudioBuffer {
    const sampleRate = this.audioContext.sampleRate;
    const duration = 0.5; // Half second loop
    const length = sampleRate * duration;
    const buffer = this.audioContext.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;
      // Oscillating frequency between 200-400Hz
      const freq = 200 + 200 * Math.sin(2 * Math.PI * 2 * t);
      const wave = Math.sin(2 * Math.PI * freq * t) > 0 ? 1 : -1;
      data[i] = wave * 0.15; // Quieter background sound
    }

    return buffer;
  }

  /**
   * Generate ghost eating sound
   */
  private generateEatGhost(): AudioBuffer {
    const sampleRate = this.audioContext.sampleRate;
    const duration = 0.4;
    const length = sampleRate * duration;
    const buffer = this.audioContext.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;
      // Rising pitch sequence
      const freq = 200 + (t / duration) * 800;
      const wave = Math.sin(2 * Math.PI * freq * t);
      const envelope = Math.sin(Math.PI * (t / duration)); // Bell curve
      data[i] = wave * envelope * 0.4;
    }

    return buffer;
  }

  /**
   * Generate death sound (descending pitch)
   */
  private generateDeath(): AudioBuffer {
    const sampleRate = this.audioContext.sampleRate;
    const duration = 1.5;
    const length = sampleRate * duration;
    const buffer = this.audioContext.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;
      // Descending chromatic scale
      const freq = 660 * Math.pow(0.5, t / duration * 2);
      const wave = Math.sin(2 * Math.PI * freq * t);
      const envelope = Math.max(0, 1 - t / duration);
      data[i] = wave * envelope * 0.4;
    }

    return buffer;
  }

  /**
   * Generate level start jingle
   */
  private generateLevelStart(): AudioBuffer {
    const sampleRate = this.audioContext.sampleRate;
    const duration = 1.0;
    const length = sampleRate * duration;
    const buffer = this.audioContext.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);

    // Simple ascending arpeggio
    const notes = [262, 330, 392, 523]; // C-E-G-C
    const noteLength = sampleRate * 0.2;

    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;
      const noteIndex = Math.floor(i / noteLength);
      if (noteIndex >= notes.length) break;

      const freq = notes[noteIndex];
      const notetime = (i % noteLength) / sampleRate;
      const wave = Math.sin(2 * Math.PI * freq * notetime);
      const envelope = Math.max(0, 1 - notetime / 0.2);
      data[i] = wave * envelope * 0.3;
    }

    return buffer;
  }

  /**
   * Generate extra life sound
   */
  private generateExtraLife(): AudioBuffer {
    const sampleRate = this.audioContext.sampleRate;
    const duration = 0.8;
    const length = sampleRate * duration;
    const buffer = this.audioContext.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);

    // Upward arpeggio
    const notes = [523, 659, 784, 1047]; // C-E-G-C (octave higher)
    const noteLength = sampleRate * 0.15;

    for (let i = 0; i < length; i++) {
      const noteIndex = Math.floor(i / noteLength);
      if (noteIndex >= notes.length) break;

      const freq = notes[noteIndex];
      const notetime = (i % noteLength) / sampleRate;
      const wave = Math.sin(2 * Math.PI * freq * notetime);
      const envelope = Math.max(0, 1 - notetime / 0.15);
      data[i] = wave * envelope * 0.35;
    }

    return buffer;
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
   * Start looping a sound (like siren)
   */
  startLoop(soundName: string): void {
    // Stop if already playing
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
        // Ignore errors if already stopped
      }
      this.loopingSources.delete(soundName);
    }
  }

  /**
   * Stop all sounds
   */
  stopAll(): void {
    this.loopingSources.forEach((source, name) => {
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
