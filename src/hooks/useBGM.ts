'use client';

import { useCallback, useEffect, useMemo } from 'react';
import { AudioService, type BGMScene } from '../services/AudioService';
import { useAudioStore } from '../store/useAudioStore';

interface UseBGMOptions {
  currentTab: string;
  isInBattle: boolean;
  activeStageId?: string | null;
  storyActive?: boolean;
}

function resolveScene({ currentTab, isInBattle, activeStageId, storyActive }: UseBGMOptions): BGMScene {
  if (storyActive) return 'STORY_NEUTRAL';
  if (isInBattle) return activeStageId?.includes('boss') ? 'BATTLE_BOSS' : 'BATTLE_NORMAL';
  if (currentTab === 'MAP') return 'MAP_EXPLORE';
  if (currentTab === 'LAB') return 'NECRO_LAB';
  if (currentTab === 'LOGS') return 'STORY_NEUTRAL';
  return 'HOME_LOBBY';
}

export function useBGM(options: UseBGMOptions) {
  const bgmVolume = useAudioStore(state => state.bgmVolume);
  const seVolume = useAudioStore(state => state.seVolume);
  const bgmEnabled = useAudioStore(state => state.bgmEnabled);
  const seEnabled = useAudioStore(state => state.seEnabled);
  const muted = useAudioStore(state => state.muted);
  const audioUnlocked = useAudioStore(state => state.audioUnlocked);
  const setAudioUnlocked = useAudioStore(state => state.setAudioUnlocked);

  const scene = useMemo(() => resolveScene(options), [options.activeStageId, options.currentTab, options.isInBattle, options.storyActive]);

  useEffect(() => {
    AudioService.setMuted(muted);
    AudioService.setVolume(bgmEnabled ? bgmVolume : 0, seEnabled ? seVolume : 0);
  }, [bgmEnabled, bgmVolume, muted, seEnabled, seVolume]);

  useEffect(() => {
    if (muted || !bgmEnabled) {
      AudioService.stopBGM(0.65);
      return;
    }
    AudioService.transitionTo(scene, options.isInBattle ? 0.75 : 1.25);
  }, [bgmEnabled, muted, options.isInBattle, scene]);

  const unlockAudio = useCallback(() => {
    if (audioUnlocked && AudioService.isUnlocked()) return;
    void AudioService.unlock().then((unlocked) => {
      setAudioUnlocked(unlocked);
      if (unlocked && bgmEnabled && !muted) {
        AudioService.transitionTo(scene, 0.85);
      }
    });
  }, [audioUnlocked, bgmEnabled, muted, scene, setAudioUnlocked]);

  return { scene, unlockAudio };
}
