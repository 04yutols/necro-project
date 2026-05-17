'use client';

import type { ElementType, SkillAttackType } from '../types/game';

export type BGMScene =
  | 'HOME_LOBBY'
  | 'MAP_EXPLORE'
  | 'BATTLE_NORMAL'
  | 'BATTLE_BOSS'
  | 'DEMON_OVERLAY'
  | 'RESULT_WIN'
  | 'RESULT_LOSE'
  | 'NECRO_LAB'
  | 'STORY_NEUTRAL'
  | 'STORY_EMOTIONAL'
  | 'SSR_REVEAL'
  | 'UR_REVEAL';

type LoopProfile = {
  freqs: number[];
  wave: OscillatorType;
  gain: number;
  filter: number;
  q?: number;
  noise?: number;
};

type LoopChannel = {
  scene: BGMScene;
  gain: GainNode;
  sources: AudioScheduledSourceNode[];
};

type ToneOptions = {
  frequency: number;
  duration?: number;
  volume?: number;
  type?: OscillatorType;
  detune?: number;
  attack?: number;
  release?: number;
};

const LOOP_PROFILES: Record<BGMScene, LoopProfile> = {
  HOME_LOBBY: { freqs: [55, 110, 164.81], wave: 'sine', gain: 0.18, filter: 540, q: 0.7, noise: 0.012 },
  MAP_EXPLORE: { freqs: [49, 98, 146.83], wave: 'triangle', gain: 0.16, filter: 460, q: 0.8, noise: 0.018 },
  BATTLE_NORMAL: { freqs: [65.41, 98, 130.81], wave: 'sawtooth', gain: 0.19, filter: 720, q: 0.9, noise: 0.022 },
  BATTLE_BOSS: { freqs: [43.65, 87.31, 130.81], wave: 'sawtooth', gain: 0.22, filter: 620, q: 1.2, noise: 0.034 },
  DEMON_OVERLAY: { freqs: [32.7, 65.41, 92.5], wave: 'square', gain: 0.12, filter: 390, q: 1.5, noise: 0.03 },
  RESULT_WIN: { freqs: [110, 164.81, 220], wave: 'triangle', gain: 0.14, filter: 900, q: 0.6, noise: 0.006 },
  RESULT_LOSE: { freqs: [41.2, 82.41, 123.47], wave: 'sine', gain: 0.13, filter: 360, q: 0.8, noise: 0.018 },
  NECRO_LAB: { freqs: [61.74, 123.47, 185], wave: 'sine', gain: 0.15, filter: 520, q: 0.8, noise: 0.026 },
  STORY_NEUTRAL: { freqs: [73.42, 110, 146.83], wave: 'sine', gain: 0.12, filter: 520, q: 0.6, noise: 0.01 },
  STORY_EMOTIONAL: { freqs: [82.41, 123.47, 196], wave: 'triangle', gain: 0.13, filter: 780, q: 0.7, noise: 0.008 },
  SSR_REVEAL: { freqs: [146.83, 220, 329.63], wave: 'triangle', gain: 0.2, filter: 1200, q: 0.7, noise: 0.008 },
  UR_REVEAL: { freqs: [36.71, 73.42, 110], wave: 'sawtooth', gain: 0.21, filter: 500, q: 1.6, noise: 0.038 },
};

const ELEMENT_FREQ: Partial<Record<ElementType, number[]>> = {
  FIRE: [174.61, 220, 349.23],
  WATER: [146.83, 196, 293.66],
  THUNDER: [246.94, 369.99, 493.88],
  EARTH: [82.41, 123.47, 164.81],
  WIND: [196, 261.63, 392],
  ICE: [220, 329.63, 440],
  LIGHT: [261.63, 392, 523.25],
  DARK: [110, 164.81, 246.94],
  NONE: [130.81, 196],
};

class AudioServiceImpl {
  private static instance: AudioServiceImpl;
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private bgmGain: GainNode | null = null;
  private seGain: GainNode | null = null;
  private currentLoop: LoopChannel | null = null;
  private overlayLoop: LoopChannel | null = null;
  private pendingScene: BGMScene | null = null;
  private bgmVolume = 0.55;
  private seVolume = 0.8;
  private muted = false;
  private unlocked = false;

  static getInstance(): AudioServiceImpl {
    if (!AudioServiceImpl.instance) {
      AudioServiceImpl.instance = new AudioServiceImpl();
    }
    return AudioServiceImpl.instance;
  }

  isUnlocked(): boolean {
    return this.unlocked;
  }

  getContext(): AudioContext | null {
    return this.ensureContext();
  }

  async unlock(): Promise<boolean> {
    const ctx = this.ensureContext();
    if (!ctx) return false;
    try {
      if (ctx.state === 'suspended') await ctx.resume();
      this.unlocked = ctx.state === 'running';
      if (this.unlocked && this.pendingScene) {
        const next = this.pendingScene;
        this.pendingScene = null;
        this.transitionTo(next, 0.8);
      }
      return this.unlocked;
    } catch {
      return false;
    }
  }

  setVolume(bgmVolume: number, seVolume: number): void {
    this.bgmVolume = this.clamp01(bgmVolume);
    this.seVolume = this.clamp01(seVolume);
    const ctx = this.ctx;
    if (!ctx) return;
    this.bgmGain?.gain.setTargetAtTime(this.bgmVolume, ctx.currentTime, 0.04);
    this.seGain?.gain.setTargetAtTime(this.seVolume, ctx.currentTime, 0.02);
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    const ctx = this.ctx;
    if (!ctx || !this.masterGain) return;
    this.masterGain.gain.setTargetAtTime(muted ? 0 : 1, ctx.currentTime, 0.03);
  }

  transitionTo(scene: BGMScene, fadeDuration = 1.2): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    this.pendingScene = scene;
    if (!this.unlocked && ctx.state !== 'running') return;
    this.pendingScene = null;
    if (this.currentLoop?.scene === scene) return;
    const oldLoop = this.currentLoop;
    const nextLoop = this.createLoop(scene, this.bgmGain ?? ctx.destination);
    const now = ctx.currentTime;
    const fade = Math.max(0.08, fadeDuration);
    this.currentLoop = nextLoop;

    nextLoop.gain.gain.cancelScheduledValues(now);
    nextLoop.gain.gain.setValueAtTime(0.0001, now);
    nextLoop.gain.gain.exponentialRampToValueAtTime(LOOP_PROFILES[scene].gain, now + fade);

    if (oldLoop) {
      oldLoop.gain.gain.cancelScheduledValues(now);
      oldLoop.gain.gain.setValueAtTime(Math.max(0.0001, oldLoop.gain.gain.value || LOOP_PROFILES[oldLoop.scene].gain), now);
      oldLoop.gain.gain.exponentialRampToValueAtTime(0.0001, now + fade);
      window.setTimeout(() => this.destroyLoop(oldLoop), (fade + 0.12) * 1000);
    }
  }

  stopBGM(fadeDuration = 0.8): void {
    const ctx = this.ctx;
    if (!ctx || !this.currentLoop) return;
    const oldLoop = this.currentLoop;
    this.currentLoop = null;
    oldLoop.gain.gain.cancelScheduledValues(ctx.currentTime);
    oldLoop.gain.gain.setTargetAtTime(0.0001, ctx.currentTime, fadeDuration / 4);
    window.setTimeout(() => this.destroyLoop(oldLoop), (fadeDuration + 0.16) * 1000);
  }

  startOverlay(scene: Extract<BGMScene, 'DEMON_OVERLAY'> = 'DEMON_OVERLAY', fadeDuration = 0.35): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    if (!this.unlocked && ctx.state !== 'running') return;
    if (this.overlayLoop?.scene === scene) return;
    this.stopOverlay(0.18);
    const loop = this.createLoop(scene, this.bgmGain ?? ctx.destination);
    this.overlayLoop = loop;
    const now = ctx.currentTime;
    loop.gain.gain.setValueAtTime(0.0001, now);
    loop.gain.gain.exponentialRampToValueAtTime(LOOP_PROFILES[scene].gain, now + Math.max(0.08, fadeDuration));
  }

  stopOverlay(fadeDuration = 0.5): void {
    const ctx = this.ctx;
    if (!ctx || !this.overlayLoop) return;
    const loop = this.overlayLoop;
    this.overlayLoop = null;
    loop.gain.gain.cancelScheduledValues(ctx.currentTime);
    loop.gain.gain.setTargetAtTime(0.0001, ctx.currentTime, fadeDuration / 4);
    window.setTimeout(() => this.destroyLoop(loop), (fadeDuration + 0.12) * 1000);
  }

  playTone(options: ToneOptions): void {
    const ctx = this.prepareSE();
    if (!ctx || this.muted) return;
    const now = ctx.currentTime;
    const duration = options.duration ?? 0.34;
    const attack = options.attack ?? 0.012;
    const release = options.release ?? 0.18;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = options.type ?? 'sine';
    osc.frequency.setValueAtTime(options.frequency, now);
    if (options.detune) osc.detune.setValueAtTime(options.detune, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.001, options.volume ?? 0.18), now + attack);
    gain.gain.setTargetAtTime(0.0001, now + Math.max(attack, duration - release), release / 3);
    osc.connect(gain);
    gain.connect(this.seGain ?? ctx.destination);
    osc.start(now);
    osc.stop(now + duration + release);
  }

  playNoise(duration = 0.25, volume = 0.12, filterFrequency = 700, type: BiquadFilterType = 'lowpass'): void {
    const ctx = this.prepareSE();
    if (!ctx || this.muted) return;
    const now = ctx.currentTime;
    const source = ctx.createBufferSource();
    source.buffer = this.createNoiseBuffer(ctx, Math.max(0.08, duration));
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(filterFrequency, now);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(Math.max(0.001, volume), now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.seGain ?? ctx.destination);
    source.start(now);
    source.stop(now + duration + 0.02);
  }

  playChord(freqs: number[], volume = 0.12, duration = 0.7, type: OscillatorType = 'triangle'): void {
    freqs.forEach((frequency, index) => {
      window.setTimeout(() => this.playTone({
        frequency,
        duration,
        volume: volume * (1 - index * 0.08),
        type,
        detune: index % 2 === 0 ? 0 : -5,
      }), index * 45);
    });
  }

  playAttack(demon = false): void {
    this.playNoise(demon ? 0.42 : 0.2, demon ? 0.18 : 0.1, demon ? 520 : 1100, demon ? 'bandpass' : 'highpass');
    this.playTone({ frequency: demon ? 98 : 220, duration: demon ? 0.34 : 0.16, volume: demon ? 0.16 : 0.1, type: demon ? 'sawtooth' : 'triangle' });
  }

  playSkill(element: ElementType = 'NONE', attackType: SkillAttackType = 'MAGIC'): void {
    const freqs = ELEMENT_FREQ[element] ?? ELEMENT_FREQ.NONE ?? [130.81, 196];
    const isSharp = attackType === 'SLASH' || element === 'THUNDER';
    this.playNoise(isSharp ? 0.22 : 0.34, isSharp ? 0.12 : 0.09, isSharp ? 1800 : 700, isSharp ? 'highpass' : 'bandpass');
    this.playChord(freqs, element === 'THUNDER' ? 0.14 : 0.1, isSharp ? 0.28 : 0.5, isSharp ? 'square' : 'triangle');
  }

  playDemonActivation(): void {
    this.startOverlay('DEMON_OVERLAY', 0.24);
    this.playNoise(0.75, 0.2, 360, 'bandpass');
    this.playChord([43.65, 65.41, 130.81, 261.63], 0.14, 0.9, 'sawtooth');
  }

  playDemonUltimate(): void {
    this.playNoise(0.9, 0.24, 420, 'bandpass');
    this.playChord([32.7, 65.41, 98, 196, 392], 0.16, 1.05, 'sawtooth');
  }

  playWaveClear(boss = false): void {
    this.playChord(boss ? [146.83, 220, 329.63, 493.88] : [196, 261.63, 392], boss ? 0.16 : 0.11, boss ? 0.82 : 0.46);
  }

  playDropReveal(kind: 'COMMON' | 'SR' | 'SSR' | 'UR'): void {
    if (kind === 'UR') {
      this.transitionTo('UR_REVEAL', 0.08);
      this.playNoise(1.05, 0.24, 390, 'bandpass');
      window.setTimeout(() => this.playChord([55, 82.41, 123.47, 246.94, 493.88], 0.2, 1.2, 'sawtooth'), 360);
      return;
    }
    if (kind === 'SSR') {
      this.transitionTo('SSR_REVEAL', 0.12);
      window.setTimeout(() => this.playChord([220, 329.63, 440, 659.25], 0.18, 0.9), 240);
      return;
    }
    this.playChord(kind === 'SR' ? [196, 293.66, 392] : [146.83, 220], kind === 'SR' ? 0.12 : 0.07, 0.36);
  }

  playResidueEnhance(levelUp = false): void {
    this.playNoise(levelUp ? 0.42 : 0.22, levelUp ? 0.14 : 0.08, levelUp ? 840 : 620, 'bandpass');
    this.playChord(levelUp ? [196, 293.66, 440, 659.25] : [164.81, 246.94, 329.63], levelUp ? 0.16 : 0.1, levelUp ? 0.72 : 0.4);
  }

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (this.ctx) return this.ctx;
    const AudioContextCtor = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) return null;
    try {
      this.ctx = new AudioContextCtor();
      this.masterGain = this.ctx.createGain();
      this.bgmGain = this.ctx.createGain();
      this.seGain = this.ctx.createGain();
      this.masterGain.gain.value = this.muted ? 0 : 1;
      this.bgmGain.gain.value = this.bgmVolume;
      this.seGain.gain.value = this.seVolume;
      this.bgmGain.connect(this.masterGain);
      this.seGain.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);
      this.unlocked = this.ctx.state === 'running';
      return this.ctx;
    } catch {
      return null;
    }
  }

  private prepareSE(): AudioContext | null {
    const ctx = this.ensureContext();
    if (!ctx) return null;
    if (ctx.state === 'suspended') void ctx.resume().then(() => { this.unlocked = ctx.state === 'running'; });
    return ctx;
  }

  private createLoop(scene: BGMScene, destination: AudioNode): LoopChannel {
    const ctx = this.ensureContext();
    if (!ctx) throw new Error('AudioContext unavailable');
    const profile = LOOP_PROFILES[scene];
    const gain = ctx.createGain();
    gain.gain.value = 0.0001;
    gain.connect(destination);
    const tonalFilter = ctx.createBiquadFilter();
    tonalFilter.type = 'lowpass';
    tonalFilter.frequency.value = profile.filter;
    tonalFilter.Q.value = profile.q ?? 0.8;
    tonalFilter.connect(gain);

    const sources: AudioScheduledSourceNode[] = [];
    profile.freqs.forEach((frequency, index) => {
      const osc = ctx.createOscillator();
      osc.type = profile.wave;
      osc.frequency.value = frequency;
      osc.detune.value = index === 0 ? -5 : index === 1 ? 0 : 7;
      osc.connect(tonalFilter);
      osc.start();
      sources.push(osc);
    });

    if (profile.noise) {
      const noise = ctx.createBufferSource();
      noise.buffer = this.createNoiseBuffer(ctx, 2);
      noise.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = profile.filter * 0.75;
      const noiseGain = ctx.createGain();
      noiseGain.gain.value = profile.noise;
      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(gain);
      noise.start();
      sources.push(noise);
    }

    return { scene, gain, sources };
  }

  private destroyLoop(loop: LoopChannel): void {
    loop.sources.forEach(source => {
      try {
        source.stop();
      } catch {
        // Already stopped.
      }
      try {
        source.disconnect();
      } catch {
        // Already disconnected.
      }
    });
    try {
      loop.gain.disconnect();
    } catch {
      // Already disconnected.
    }
  }

  private createNoiseBuffer(ctx: AudioContext, duration: number): AudioBuffer {
    const length = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / length * 0.35);
    }
    return buffer;
  }

  private clamp01(value: number): number {
    return Math.max(0, Math.min(1, value));
  }
}

export const AudioService = AudioServiceImpl.getInstance();
