import { buildPresetSnapshot, PersistedGamePreset, PresetName } from './presets';
import { isYomiStage } from '../logic/YomiFloors';
import { isAbyssalResidueUnlocked } from '../logic/AbyssalResidueUnlockSystem';

// partialize（partializeGameState → PersistedGameSnapshot, useGameStore.ts:350-405）の対象キー。
const PARTIALIZE_KEYS = [
  'player',
  'necroStatus',
  'party',
  'inventoryMonsters',
  'soulShards',
  'inventoryItems',
  'abyssalResidues',
  'equippedResidueSlots',
  'residueMaterials',
  'weaponMaterials',
  'transmutationPoints',
].sort();

const INJECTED_PRESETS: PresetName[] = ['ch1_mid', 'ch1_cleared', 'yomi_b5', 'endgame'];

describe('progression presets', () => {
  test('fresh injects nothing so initialize() drives the new-game state', () => {
    expect(buildPresetSnapshot('fresh')).toBeNull();
  });

  test.each(INJECTED_PRESETS)('%s snapshot carries exactly the partialize keys at version 2', (name) => {
    const snap = buildPresetSnapshot(name);
    expect(snap).not.toBeNull();
    expect(snap!.version).toBe(2);
    expect(Object.keys(snap!.state).sort()).toEqual(PARTIALIZE_KEYS);
    expect(snap!.state.player).not.toBeNull();
  });

  test('ch1_cleared clears area1_node3, unlocking LAB/YOMI gates', () => {
    const snap = buildPresetSnapshot('ch1_cleared')!;
    const cleared = snap.state.player!.clearedStages;
    expect(cleared).toContain('area1_node3');
    expect(isAbyssalResidueUnlocked(cleared)).toBe(true);
  });

  test('yomi_b5 clears exactly five yomi floors on top of chapter 1', () => {
    const snap = buildPresetSnapshot('yomi_b5')!;
    const yomiCleared = snap.state.player!.clearedStages.filter(isYomiStage);
    expect(yomiCleared).toEqual(['yomi_b01', 'yomi_b02', 'yomi_b03', 'yomi_b04', 'yomi_b05']);
    expect(yomiCleared).toHaveLength(5);
  });

  test('endgame equips the abyssal residue slots behind the cleared gate', () => {
    const snap = buildPresetSnapshot('endgame')!;
    expect(isAbyssalResidueUnlocked(snap.state.player!.clearedStages)).toBe(true);
    expect(snap.state.equippedResidueSlots.filter(Boolean)).toHaveLength(5);
    expect(snap.state.player!.equipment.weapon?.id).toBe('grudge_manifest');
  });

  test.each(INJECTED_PRESETS)('%s snapshot is JSON.stringify round-trippable', (name) => {
    const snap = buildPresetSnapshot(name)!;
    expect(() => JSON.stringify(snap)).not.toThrow();
    const roundTripped = JSON.parse(JSON.stringify(snap)) as { state: PersistedGamePreset };
    expect(roundTripped.state.player!.clearedStages).toEqual(snap.state.player!.clearedStages);
  });
});
