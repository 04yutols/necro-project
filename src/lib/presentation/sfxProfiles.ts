export type PresentationSfxProfile = {
  key: string;
  tone?: {
    frequencies: number[];
    duration: number;
    volume: number;
    wave: OscillatorType;
  };
  noise?: {
    duration: number;
    volume: number;
    filterFrequency: number;
    filterType: BiquadFilterType;
  };
};

export const PRESENTATION_SFX_PROFILES: Record<string, PresentationSfxProfile> = {
  rune_cast: {
    key: 'rune_cast',
    tone: { frequencies: [146.83, 220, 329.63], duration: 0.42, volume: 0.09, wave: 'triangle' },
    noise: { duration: 0.24, volume: 0.055, filterFrequency: 760, filterType: 'bandpass' },
  },
  blade_cut: {
    key: 'blade_cut',
    tone: { frequencies: [220, 440], duration: 0.16, volume: 0.08, wave: 'square' },
    noise: { duration: 0.2, volume: 0.12, filterFrequency: 1900, filterType: 'highpass' },
  },
  bone_impact: {
    key: 'bone_impact',
    tone: { frequencies: [65.41, 98], duration: 0.3, volume: 0.13, wave: 'sawtooth' },
    noise: { duration: 0.3, volume: 0.15, filterFrequency: 480, filterType: 'lowpass' },
  },
  spectral_flight: {
    key: 'spectral_flight',
    tone: { frequencies: [196, 293.66, 392], duration: 0.28, volume: 0.075, wave: 'sine' },
    noise: { duration: 0.3, volume: 0.06, filterFrequency: 1250, filterType: 'bandpass' },
  },
  abyss_impact: {
    key: 'abyss_impact',
    tone: { frequencies: [43.65, 87.31, 174.61], duration: 0.54, volume: 0.13, wave: 'sawtooth' },
    noise: { duration: 0.45, volume: 0.17, filterFrequency: 420, filterType: 'bandpass' },
  },
  abyss_gate: {
    key: 'abyss_gate',
    tone: { frequencies: [32.7, 65.41, 130.81], duration: 0.7, volume: 0.12, wave: 'sawtooth' },
    noise: { duration: 0.65, volume: 0.13, filterFrequency: 340, filterType: 'lowpass' },
  },
  soul_mend: {
    key: 'soul_mend',
    tone: { frequencies: [196, 293.66, 440], duration: 0.52, volume: 0.08, wave: 'sine' },
  },
  soul_bloom: {
    key: 'soul_bloom',
    tone: { frequencies: [261.63, 392, 523.25, 659.25], duration: 0.58, volume: 0.09, wave: 'triangle' },
    noise: { duration: 0.24, volume: 0.035, filterFrequency: 1500, filterType: 'highpass' },
  },
};

export function getPresentationSfxProfile(profileKey: string): PresentationSfxProfile {
  return PRESENTATION_SFX_PROFILES[profileKey] ?? PRESENTATION_SFX_PROFILES.rune_cast;
}
