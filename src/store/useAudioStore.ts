import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { AudioService } from '../services/AudioService';

interface AudioStoreState {
  bgmVolume: number;
  seVolume: number;
  bgmEnabled: boolean;
  seEnabled: boolean;
  muted: boolean;
  audioUnlocked: boolean;
  setBgmVolume: (volume: number) => void;
  setSeVolume: (volume: number) => void;
  setBgmEnabled: (enabled: boolean) => void;
  setSeEnabled: (enabled: boolean) => void;
  setMuted: (muted: boolean) => void;
  setAudioUnlocked: (unlocked: boolean) => void;
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

export const useAudioStore = create<AudioStoreState>()(
  persist(
    (set, get) => ({
      bgmVolume: 0.55,
      seVolume: 0.8,
      bgmEnabled: true,
      seEnabled: true,
      muted: false,
      audioUnlocked: false,

      setBgmVolume: (volume) => {
        const next = clamp01(volume);
        set({ bgmVolume: next });
        const state = get();
        AudioService.setVolume(state.bgmEnabled ? next : 0, state.seEnabled ? state.seVolume : 0);
      },
      setSeVolume: (volume) => {
        const next = clamp01(volume);
        set({ seVolume: next });
        const state = get();
        AudioService.setVolume(state.bgmEnabled ? state.bgmVolume : 0, state.seEnabled ? next : 0);
      },
      setBgmEnabled: (enabled) => {
        set({ bgmEnabled: enabled });
        const state = get();
        AudioService.setVolume(enabled ? state.bgmVolume : 0, state.seEnabled ? state.seVolume : 0);
      },
      setSeEnabled: (enabled) => {
        set({ seEnabled: enabled });
        const state = get();
        AudioService.setVolume(state.bgmEnabled ? state.bgmVolume : 0, enabled ? state.seVolume : 0);
      },
      setMuted: (muted) => {
        set({ muted });
        AudioService.setMuted(muted);
      },
      setAudioUnlocked: (audioUnlocked) => set({ audioUnlocked }),
    }),
    {
      name: 'necro-audio-settings',
      partialize: (state) => ({
        bgmVolume: state.bgmVolume,
        seVolume: state.seVolume,
        bgmEnabled: state.bgmEnabled,
        seEnabled: state.seEnabled,
        muted: state.muted,
      }),
    },
  ),
);
