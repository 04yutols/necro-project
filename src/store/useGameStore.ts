import { create } from 'zustand';
import { CharacterData, NecroStatus, MonsterData } from '../types/game';

interface GameState {
  player: CharacterData | null;
  necroStatus: NecroStatus | null;
  party: (MonsterData | null)[];
  setPlayer: (player: CharacterData) => void;
  setNecroStatus: (status: NecroStatus) => void;
  setParty: (party: (MonsterData | null)[]) => void;
  updateHP: (hp: number) => void;
  updateMP: (mp: number) => void;
}

export const useGameStore = create<GameState>((set) => ({
  player: null,
  necroStatus: null,
  party: [null, null, null],
  setPlayer: (player) => set({ player }),
  setNecroStatus: (status) => set({ necroStatus: status }),
  setParty: (party) => set({ party }),
  updateHP: (hp) => set((state) => ({
    player: state.player ? { ...state.player, stats: { ...state.player.stats, hp } } : null
  })),
  updateMP: (mp) => set((state) => ({
    player: state.player ? { ...state.player, stats: { ...state.player.stats, mp } } : null
  })),
}));
