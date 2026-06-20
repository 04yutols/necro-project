import { GAME_STORE_STORAGE_KEY, useGameStore } from './useGameStore';
import jobsData from '../data/master/jobs.json';
import { calculateEnergyState } from '../logic/EnergySystem';
import { levelFromTotalExp } from '../logic/ExperienceSystem';
import type { JobData } from '../types/game';
import type { ServerGameData } from '../types/serverGame';

const JOBS = jobsData as Record<string, JobData>;
const RESIDUE_FIXTURE = {
  id: 'r7',
  name: '死霊の印璽',
  itemId: 'head',
  rarity: 'COMMON' as const,
  mainStat: { type: 'HP_FLAT', value: 380 },
  subOptions: [{ type: 'DEF_FLAT', value: 25 }, { type: 'ATK_FLAT', value: 12 }],
  level: 1,
  exp: 0,
  maxExp: 800,
};
const ELEMENT_RESIDUE_FIXTURE = {
  id: 'r-dark',
  name: '暗黒の帯',
  itemId: 'waist',
  rarity: 'RARE' as const,
  mainStat: { type: 'DARK_DMG_BOOST', value: 12 },
  subOptions: [{ type: 'ATK%', value: 4 }],
  level: 1,
  exp: 0,
  maxExp: 800,
};

function unlockResidueFixture() {
  const state = useGameStore.getState();
  useGameStore.getState().setPlayer({
    ...state.player!,
    clearedStages: ['area1_node3'],
  });
  useGameStore.getState().setAbyssalResidues([RESIDUE_FIXTURE]);
  useGameStore.getState().addResidueMaterials([
    { id: 'mat-1', name: '深淵の砂', quantity: 8, expValue: 200, rarity: 'COMMON' },
    { id: 'mat-3', name: '冥界の核', quantity: 1, expValue: 2500, rarity: 'EPIC' },
  ]);
}

function currentStateAsServerData(overrides: Partial<ServerGameData> = {}): ServerGameData {
  const state = useGameStore.getState();
  return {
    player: state.player!,
    necroStatus: state.necroStatus!,
    party: state.party,
    inventoryMonsters: state.inventoryMonsters,
    soulShards: state.soulShards,
    inventoryItems: state.inventoryItems,
    weaponMaterials: state.weaponMaterials,
    residueMaterials: state.residueMaterials,
    transmutationPoints: state.transmutationPoints,
    abyssalResidues: state.abyssalResidues,
    equippedResidueSlots: state.equippedResidueSlots,
    ...overrides,
  };
}

async function getPersistedGameState() {
  const storage = useGameStore.persist.getOptions().storage;
  if (!storage) throw new Error('game store persist storage is unavailable');
  const stored = await storage.getItem(GAME_STORE_STORAGE_KEY);
  return stored?.state ?? null;
}

describe('useGameStore party formation actions', () => {
  beforeEach(() => {
    useGameStore.persist.clearStorage();
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

  test('initializes player with full MP from current job energy curve', () => {
    const player = useGameStore.getState().player;
    const expectedEnergy = calculateEnergyState(JOBS.warrior, 1);

    expect(player?.currentEnergy).toBe(expectedEnergy.currentEnergy);
    expect(player?.maxEnergy).toBe(expectedEnergy.maxEnergy);
  });

  test('addExp uses the shared cumulative EXP level formula', () => {
    useGameStore.getState().addExp(9);
    let warrior = useGameStore.getState().player?.jobs.find(job => job.jobId === 'warrior');
    expect(warrior?.exp).toBe(9);
    expect(warrior?.level).toBe(levelFromTotalExp(9));
    expect(warrior?.level).toBe(1);

    useGameStore.getState().addExp(1);
    const player = useGameStore.getState().player;
    warrior = player?.jobs.find(job => job.jobId === 'warrior');
    const expectedEnergy = calculateEnergyState(JOBS.warrior, levelFromTotalExp(10));

    expect(warrior?.exp).toBe(10);
    expect(warrior?.level).toBe(2);
    expect(player?.maxEnergy).toBe(expectedEnergy.maxEnergy);
  });

  test('addExp refreshes derived element boosts after level recalculation', () => {
    const state = useGameStore.getState();
    useGameStore.getState().setPlayer({
      ...state.player!,
      clearedStages: ['area1_node3'],
    });
    useGameStore.getState().setAbyssalResidues([ELEMENT_RESIDUE_FIXTURE]);
    useGameStore.getState().equipResidueToSlot(3, ELEMENT_RESIDUE_FIXTURE);

    expect(useGameStore.getState().player?.elementDmgBoosts.DARK).toBe(12);

    useGameStore.getState().addExp(10);

    expect(useGameStore.getState().player?.elementDmgBoosts.DARK).toBe(12);
  });

  test('restoreEnergy fills MP to the current maximum after battle', () => {
    useGameStore.getState().updateEnergy(7);
    expect(useGameStore.getState().player?.currentEnergy).toBe(7);

    useGameStore.getState().restoreEnergy();

    expect(useGameStore.getState().player?.currentEnergy).toBe(useGameStore.getState().player?.maxEnergy);
  });

  test('starts the local guest profile without unlocked residue inventory or equipment', () => {
    expect(useGameStore.getState().equippedResidueSlots).toEqual([null, null, null, null, null]);
    expect(useGameStore.getState().abyssalResidues).toHaveLength(0);
    expect(useGameStore.getState().residueMaterials).toHaveLength(0);
  });

  test('does not equip residues before the chapter 2 unlock', () => {
    useGameStore.getState().setAbyssalResidues([RESIDUE_FIXTURE]);
    useGameStore.getState().equipResidueToSlot(0, RESIDUE_FIXTURE);

    expect(useGameStore.getState().equippedResidueSlots).toEqual([null, null, null, null, null]);
  });

  test('upgradeResidue consumes one material unit per selected id instead of the whole stack', () => {
    unlockResidueFixture();
    const initialResidue = useGameStore.getState().abyssalResidues.find(item => item.id === 'r7');
    useGameStore.getState().equipResidueToSlot(0, initialResidue!);
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
    unlockResidueFixture();
    useGameStore.getState().upgradeResidue('r7', ['mat-3', 'mat-3', 'mat-3']);

    const state = useGameStore.getState();
    const residue = state.abyssalResidues.find(item => item.id === 'r7');
    const material = state.residueMaterials.find(item => item.id === 'mat-3');

    expect(material).toBeUndefined();
    expect(residue?.level).toBe(3);
    expect(residue?.exp).toBe(500);
    expect(residue?.maxExp).toBe(1800);
  });

  test('persists guest progression without battle runtime state', async () => {
    useGameStore.getState().addClearedStage('area1_node1');
    useGameStore.getState().fillDemonGauge(40);
    useGameStore.getState().setCurrentTab('MAP');
    useGameStore.getState().addBattleLog('RUNTIME LOG');

    const persisted = await getPersistedGameState();
    const raw = persisted as Record<string, unknown>;

    expect(persisted?.player?.clearedStages).toContain('area1_node1');
    expect(persisted?.party).toHaveLength(3);
    expect(raw.cacheKind).toBe('guest-save');
    expect(raw.offlineQueue).toEqual([]);
    expect(raw.isServerBacked).toBeUndefined();
    expect(raw.currentTab).toBeUndefined();
    expect(raw.demonGauge).toBeUndefined();
    expect(raw.battleLogs).toBeUndefined();
    expect(raw.actionTrigger).toBeUndefined();
  });

  test('loadFromServer is authoritative over cached local progression', async () => {
    useGameStore.getState().addClearedStage('local_only');

    const state = useGameStore.getState();
    const serverPlayer = {
      ...state.player!,
      clearedStages: ['server_stage'],
      gold: 1234,
    };
    const serverNecroStatus = {
      ...state.necroStatus!,
      level: 7,
      exp: 321,
    };
    const serverResidueMaterials = [
      { id: 'server-mat', name: 'サーバー素材', quantity: 3, expValue: 600, rarity: 'RARE' as const },
    ];

    useGameStore.getState().loadFromServer(currentStateAsServerData({
      player: serverPlayer,
      necroStatus: serverNecroStatus,
      party: [null, null, null],
      inventoryMonsters: [],
      residueMaterials: serverResidueMaterials,
      transmutationPoints: 77,
    }));

    const current = useGameStore.getState();
    const persisted = await getPersistedGameState();
    const raw = persisted as Record<string, unknown>;

    expect(current.isServerBacked).toBe(true);
    expect(current.player?.clearedStages).toEqual(['server_stage']);
    expect(current.player?.gold).toBe(1234);
    expect(current.necroStatus?.level).toBe(7);
    expect(current.residueMaterials).toEqual(serverResidueMaterials);
    expect(current.transmutationPoints).toBe(77);
    expect(persisted?.player?.clearedStages).toEqual(['server_stage']);
    expect(persisted?.necroStatus?.level).toBe(7);
    expect(persisted?.residueMaterials).toEqual(serverResidueMaterials);
    expect(persisted?.transmutationPoints).toBe(77);
    expect(raw.cacheKind).toBe('server-snapshot');
    expect(raw.offlineQueue).toEqual([]);
    expect(raw.isServerBacked).toBeUndefined();
  });

  test('rehydrated cached data is treated as local-only', () => {
    const options = useGameStore.persist.getOptions();
    if (!options.partialize || !options.merge) {
      throw new Error('game store persist options are incomplete');
    }

    const persisted = {
      ...(options.partialize(useGameStore.getState()) as Record<string, unknown>),
      isServerBacked: true,
      currentTab: 'BATTLE',
      demonGauge: 100,
    };
    const merged = options.merge(persisted, useGameStore.getInitialState());

    expect(merged.isServerBacked).toBe(false);
    expect(merged.currentTab).toBe('HOME');
    expect(merged.demonGauge).toBe(0);
    expect(merged.battleLogs).toEqual(['LOCAL SAVE LOADED...']);
  });

  test('rehydrated server snapshots are cached views until the server reloads', () => {
    const options = useGameStore.persist.getOptions();
    if (!options.partialize || !options.merge) {
      throw new Error('game store persist options are incomplete');
    }

    useGameStore.getState().loadFromServer(currentStateAsServerData());
    const persisted = options.partialize(useGameStore.getState());
    const merged = options.merge(persisted, useGameStore.getInitialState());

    expect(merged.isServerBacked).toBe(false);
    expect(merged.player?.id).toBe(useGameStore.getState().player?.id);
    expect(merged.battleLogs).toEqual(['CACHED CLOUD SNAPSHOT LOADED...']);
  });

  test('migrates v1 persisted state into cache metadata without losing the snapshot', async () => {
    const options = useGameStore.persist.getOptions();
    if (!options.partialize || !options.migrate) {
      throw new Error('game store persist options are incomplete');
    }

    const v1Persisted = options.partialize(useGameStore.getState()) as Record<string, unknown>;
    delete v1Persisted.cacheKind;
    delete v1Persisted.cachedAt;
    delete v1Persisted.offlineQueue;

    const migrated = await options.migrate(v1Persisted, 1) as Record<string, unknown>;

    expect((migrated.player as { name?: string } | null)?.name).toBe('アルド');
    expect(migrated.cacheKind).toBe('guest-save');
    expect(migrated.offlineQueue).toEqual([]);
  });
});
