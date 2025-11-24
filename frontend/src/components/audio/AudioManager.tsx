'use client';

import { useEffect, useRef, useCallback } from 'react';
import { Howl, Howler } from 'howler';
import { useAudioStore } from '@/stores/audioStore';

// Sound effect types
type SoundEffect =
  | 'click'
  | 'success'
  | 'error'
  | 'coin'
  | 'gameOver'
  | 'levelUp'
  | 'shoot'
  | 'explosion'
  | 'powerUp';

// Sound effect paths (will be loaded from public/assets/audio/sfx/)
const SOUND_EFFECTS: Record<SoundEffect, string> = {
  click: '/assets/audio/sfx/click.mp3',
  success: '/assets/audio/sfx/success.mp3',
  error: '/assets/audio/sfx/error.mp3',
  coin: '/assets/audio/sfx/coin.mp3',
  gameOver: '/assets/audio/sfx/game-over.mp3',
  levelUp: '/assets/audio/sfx/level-up.mp3',
  shoot: '/assets/audio/sfx/shoot.mp3',
  explosion: '/assets/audio/sfx/explosion.mp3',
  powerUp: '/assets/audio/sfx/power-up.mp3',
};

// Background music tracks
const MUSIC_TRACKS: Record<string, string> = {
  menu: '/assets/audio/music/menu.mp3',
  game: '/assets/audio/music/game.mp3',
  boss: '/assets/audio/music/boss.mp3',
};

// Global audio manager instance
class AudioManagerClass {
  private sounds: Map<string, Howl> = new Map();
  private music: Howl | null = null;
  private currentTrack: string | null = null;

  constructor() {
    // Preload sound effects
    if (typeof window !== 'undefined') {
      this.preloadSounds();
    }
  }

  private preloadSounds() {
    Object.entries(SOUND_EFFECTS).forEach(([name, src]) => {
      const sound = new Howl({
        src: [src],
        preload: true,
        volume: 0.7,
      });
      this.sounds.set(name, sound);
    });
  }

  playSound(name: SoundEffect, volume?: number) {
    const sound = this.sounds.get(name);
    if (sound) {
      if (volume !== undefined) {
        sound.volume(volume);
      }
      sound.play();
    }
  }

  playMusic(track: string, volume = 0.5) {
    // Stop current music
    if (this.music) {
      this.music.fade(this.music.volume(), 0, 500);
      setTimeout(() => {
        this.music?.stop();
        this.music?.unload();
      }, 500);
    }

    const src = MUSIC_TRACKS[track];
    if (!src) return;

    this.music = new Howl({
      src: [src],
      loop: true,
      volume: 0,
      preload: true,
    });

    this.music.play();
    this.music.fade(0, volume, 1000);
    this.currentTrack = track;
  }

  stopMusic() {
    if (this.music) {
      this.music.fade(this.music.volume(), 0, 500);
      setTimeout(() => {
        this.music?.stop();
      }, 500);
    }
    this.currentTrack = null;
  }

  setMusicVolume(volume: number) {
    if (this.music) {
      this.music.volume(volume);
    }
  }

  setSoundVolume(volume: number) {
    this.sounds.forEach((sound) => {
      sound.volume(volume);
    });
  }

  setMuted(muted: boolean) {
    Howler.mute(muted);
  }

  getCurrentTrack(): string | null {
    return this.currentTrack;
  }
}

// Singleton instance
let audioManager: AudioManagerClass | null = null;

export function getAudioManager(): AudioManagerClass {
  if (!audioManager && typeof window !== 'undefined') {
    audioManager = new AudioManagerClass();
  }
  return audioManager!;
}

// React hook for using audio
export function useAudio() {
  const { musicEnabled, soundEnabled, musicVolume, soundVolume } = useAudioStore();
  const managerRef = useRef<AudioManagerClass | null>(null);

  useEffect(() => {
    managerRef.current = getAudioManager();
  }, []);

  useEffect(() => {
    if (managerRef.current) {
      managerRef.current.setMusicVolume(musicEnabled ? musicVolume : 0);
    }
  }, [musicEnabled, musicVolume]);

  useEffect(() => {
    if (managerRef.current) {
      managerRef.current.setSoundVolume(soundEnabled ? soundVolume : 0);
    }
  }, [soundEnabled, soundVolume]);

  const playSound = useCallback(
    (name: SoundEffect) => {
      if (soundEnabled && managerRef.current) {
        managerRef.current.playSound(name);
      }
    },
    [soundEnabled]
  );

  const playMusic = useCallback(
    (track: string) => {
      if (musicEnabled && managerRef.current) {
        managerRef.current.playMusic(track, musicVolume);
      }
    },
    [musicEnabled, musicVolume]
  );

  const stopMusic = useCallback(() => {
    if (managerRef.current) {
      managerRef.current.stopMusic();
    }
  }, []);

  return { playSound, playMusic, stopMusic };
}

// Audio provider component (for initialization)
export default function AudioManager({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Initialize audio manager
    getAudioManager();
  }, []);

  return <>{children}</>;
}
