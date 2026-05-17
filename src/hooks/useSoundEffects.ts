'use client';

import { useCallback, useMemo } from 'react';
import { AudioService } from '../services/AudioService';
import { useAudioStore } from '../store/useAudioStore';
import type { ElementType, SkillAttackType } from '../types/game';

type DropRevealKind = 'COMMON' | 'SR' | 'SSR' | 'UR';

export function useSoundEffects() {
  const muted = useAudioStore(state => state.muted);
  const seEnabled = useAudioStore(state => state.seEnabled);
  const bgmEnabled = useAudioStore(state => state.bgmEnabled);
  const bgmVolume = useAudioStore(state => state.bgmVolume);
  const seVolume = useAudioStore(state => state.seVolume);
  const setAudioUnlocked = useAudioStore(state => state.setAudioUnlocked);

  const run = useCallback((fn: () => void) => {
    if (muted || !seEnabled) return;
    AudioService.setVolume(bgmEnabled ? bgmVolume : 0, seVolume);
    void AudioService.unlock().then((unlocked) => setAudioUnlocked(unlocked));
    fn();
  }, [bgmEnabled, bgmVolume, muted, seEnabled, seVolume, setAudioUnlocked]);

  return useMemo(() => ({
    tap: () => run(() => {
      AudioService.playNoise(0.12, 0.045, 1200, 'highpass');
      AudioService.playTone({ frequency: 196, duration: 0.08, volume: 0.045, type: 'triangle' });
    }),
    equip: () => run(() => {
      AudioService.playChord([220, 329.63, 440], 0.09, 0.38);
    }),
    battleAttack: (mode: 'physical' | 'demon' = 'physical') => run(() => AudioService.playAttack(mode === 'demon')),
    skillCast: (element: ElementType = 'NONE', attackType: SkillAttackType = 'MAGIC') => run(() => AudioService.playSkill(element, attackType)),
    demonActivate: () => run(() => AudioService.playDemonActivation()),
    demonUltimate: () => run(() => AudioService.playDemonUltimate()),
    setDemonOverlay: (active: boolean) => {
      if (muted || !bgmEnabled) {
        AudioService.stopOverlay(0.35);
        return;
      }
      if (active) AudioService.startOverlay('DEMON_OVERLAY', 0.25);
      else AudioService.stopOverlay(0.5);
    },
    waveClear: (kind: 'wave' | 'boss' = 'wave') => run(() => AudioService.playWaveClear(kind === 'boss')),
    resultOpen: (kind: DropRevealKind = 'COMMON') => run(() => {
      if (kind === 'UR') AudioService.playDropReveal('UR');
      else if (kind === 'SSR') AudioService.playDropReveal('SSR');
      else AudioService.playChord([164.81, 220, 329.63], 0.09, 0.42);
    }),
    dropReveal: (kind: DropRevealKind = 'COMMON') => run(() => AudioService.playDropReveal(kind)),
    residueEnhance: (levelUp = false) => run(() => AudioService.playResidueEnhance(levelUp)),
  }), [bgmEnabled, muted, run]);
}
