import { useGameStore } from './useGameStore';
import jobsData from '../data/master/jobs.json';
import { calculateEnergyState } from '../logic/EnergySystem';
import { levelFromTotalExp } from '../logic/ExperienceSystem';
import type { JobData } from '../types/game';

const JOBS = jobsData as Record<string, JobData>;

describe('useGameStore party formation actions', () => {
  beforeEach(() => {
    useGameStore.getState().initialize();
  });

  test('swapPartySlots swaps monster positions without changing party size', () => {
    const before = useGameStore.getState().party;
    expect(before).toHaveLength(3);
    expect(before[0]?.name).toBe('スケルトン');
    expect(before[1]?.name).toBe('ゾンビ');

    useGameStore.getState().swapPartySlots(0, 1);

    const after = useGameStore.getState().party;
    expect(after).toHaveLength(3);
    expect(after[0]?.name).toBe('ゾンビ');
    expect(after[1]?.name).toBe('スケルトン');
  });

  test('setParty replaces the three-slot formation explicitly', () => {
    const monsters = useGameStore.getState().inventoryMonsters;
    useGameStore.getState().setParty([monsters[0], null, monsters[2]]);

    const party = useGameStore.getState().party;
    expect(party).toHaveLength(3);
    expect(party[0]?.name).toBe('ゴブリン');
    expect(party[1]).toBeNull();
    expect(party[2]?.name).toBe('ゾンビ');
  });

  test('consumables stack in inventory and are consumed one by one', () => {
    const initialPotion = useGameStore.getState().inventoryItems.find(item => item.id === 'underworld_potion');
    expect(initialPotion?.quantity).toBe(3);

    useGameStore.getState().addInventoryItems([{ ...initialPotion!, quantity: 2 }]);
    expect(useGameStore.getState().inventoryItems.find(item => item.id === 'underworld_potion')?.quantity).toBe(5);

    expect(useGameStore.getState().consumeInventoryItem('underworld_potion')).toBe(true);
    expect(useGameStore.getState().inventoryItems.find(item => item.id === 'underworld_potion')?.quantity).toBe(4);
  });

  test('initializes player SP from current job energy curve', () => {
    const player = useGameStore.getState().player;

    expect(player?.currentEnergy).toBe(40);
    expect(player?.maxEnergy).toBe(100);
  });

  test('addExp uses the shared cumulative EXP level formula', () => {
    useGameStore.getState().addExp(499);
    let warrior = useGameStore.getState().player?.jobs.find(job => job.jobId === 'warrior');
    expect(warrior?.exp).toBe(499);
    expect(warrior?.level).toBe(levelFromTotalExp(499));
    expect(warrior?.level).toBe(1);

    useGameStore.getState().addExp(1);
    const player = useGameStore.getState().player;
    warrior = player?.jobs.find(job => job.jobId === 'warrior');
    const expectedEnergy = calculateEnergyState(JOBS.warrior, levelFromTotalExp(500));

    expect(warrior?.exp).toBe(500);
    expect(warrior?.level).toBe(2);
    expect(player?.maxEnergy).toBe(expectedEnergy.maxEnergy);
  });

  test('upgradeResidue consumes one material unit per selected id instead of the whole stack', () => {
    useGameStore.getState().upgradeResidue('r7', ['mat-1']);

    const state = useGameStore.getState();
    const residue = state.abyssalResidues.find(item => item.id === 'r7');
    const equipped = state.equippedResidueSlots.find(item => item?.id === 'r7');
    const material = state.residueMaterials.find(item => item.id === 'mat-1');

    expect(residue?.exp).toBe(200);
    expect(residue?.level).toBe(1);
    expect(equipped?.exp).toBe(200);
    expect(material?.quantity).toBe(7);
  });

  test('upgradeResidue bounds repeated material ids by the owned stack quantity', () => {
    useGameStore.getState().upgradeResidue('r7', ['mat-3', 'mat-3', 'mat-3']);

    const state = useGameStore.getState();
    const residue = state.abyssalResidues.find(item => item.id === 'r7');
    const material = state.residueMaterials.find(item => item.id === 'mat-3');

    expect(material).toBeUndefined();
    expect(residue?.level).toBe(3);
    expect(residue?.exp).toBe(500);
    expect(residue?.maxExp).toBe(1800);
  });
});
