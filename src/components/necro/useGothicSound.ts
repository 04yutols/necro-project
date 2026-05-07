'use client';

import { useCallback, useRef } from 'react';

// Preloaded AudioContext singleton
let audioCtx: AudioContext | null = null;

function getAudioCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    try {
      audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch {
      return null;
    }
  }
  return audioCtx;
}

/** Synthesize a stone-scrape / dark resonance sound */
function playStoneRumble(volume = 0.18) {
  const ctx = getAudioCtx();
  if (!ctx) return;

  // Resume if suspended (browser autoplay policy)
  if (ctx.state === 'suspended') ctx.resume();

  const now = ctx.currentTime;

  // Low rumble oscillator
  const osc1 = ctx.createOscillator();
  osc1.type = 'sawtooth';
  osc1.frequency.setValueAtTime(55, now);
  osc1.frequency.exponentialRampToValueAtTime(38, now + 0.18);

  // Sub boom
  const osc2 = ctx.createOscillator();
  osc2.type = 'sine';
  osc2.frequency.setValueAtTime(80, now);
  osc2.frequency.exponentialRampToValueAtTime(30, now + 0.25);

  // Noise layer via buffer
  const bufferSize = ctx.sampleRate * 0.2;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * 0.6;
  const noise = ctx.createBufferSource();
  noise.buffer = buffer;

  // Filter for noise
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 300;

  // Master gain envelope
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(volume, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

  // Connect graph
  osc1.connect(gain);
  osc2.connect(gain);
  noise.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);

  osc1.start(now);
  osc1.stop(now + 0.3);
  osc2.start(now);
  osc2.stop(now + 0.3);
  noise.start(now);
  noise.stop(now + 0.25);
}

/** Synthesize a soul-crystal chime */
function playSoulChime(volume = 0.15) {
  const ctx = getAudioCtx();
  if (!ctx) return;
  if (ctx.state === 'suspended') ctx.resume();

  const now = ctx.currentTime;
  const freqs = [440, 554, 660, 880];
  freqs.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;

    const gain = ctx.createGain();
    const delay = i * 0.06;
    gain.gain.setValueAtTime(0, now + delay);
    gain.gain.linearRampToValueAtTime(volume, now + delay + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.5);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now + delay);
    osc.stop(now + delay + 0.55);
  });
}

/** Vibration helper */
function vibrate(pattern: number | number[]) {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    navigator.vibrate(pattern);
  }
}

export interface GothicSoundHandle {
  /** Heavy stone-scrape tap */
  playTap: () => void;
  /** Soul-chain chime when equipping shard */
  playEquip: () => void;
  /** Soft rumble for menu open */
  playOpen: () => void;
  /** Pulse vibration only */
  vibratePulse: () => void;
}

export function useGothicSound(): GothicSoundHandle {
  const handle: GothicSoundHandle = {
    playTap: useCallback(() => {
      playStoneRumble(0.18);
      vibrate(18);
    }, []),

    playEquip: useCallback(() => {
      playSoulChime(0.14);
      vibrate([10, 30, 10]);
    }, []),

    playOpen: useCallback(() => {
      playStoneRumble(0.1);
      vibrate(10);
    }, []),

    vibratePulse: useCallback(() => {
      vibrate(15);
    }, []),
  };

  return handle;
}
