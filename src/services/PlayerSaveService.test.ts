import { expForLevel } from '../logic/ExperienceSystem';
import { MasterDataService } from './MasterDataService';
import {
  applyJobExpGainToSave,
  applyNecroExpGainToSave,
  cleanPlayerSaveReferencesWithIds,
  emptyPlayerSave,
  migratePlayerSaveSchema,
  playerSaveToJson,
  PlayerSaveSchemaError,
  readPlayerSave,
  spendWeaponMaterialsInSave,
} from './PlayerSaveService';
import { PLAYER_SAVE_SCHEMA_VERSION } from '../types/playerSave';

describe('PlayerSaveService', () => {
  test('roundtrips playerState JSON while normalizing material stacks', () => {
    const save = emptyPlayerSave();
    save.player.name = 'アルド試験';
    save.weaponMaterials = [
      { type: 'IDEA_COMMON', name: '凡骨のイデア', quantity: 2 },
      { type: 'IDEA_COMMON', name: '凡骨のイデア', quantity: 3 },
      { type: 'ABYSSAL_OBSIDIAN', name: '深淵の黒鋼', quantity: 1 },
    ];
    save.residueMaterials = [
      { id: 'bone_chip', name: '骨片', quantity: 1, expValue: 120, rarity: 'COMMON' },
      { id: 'bone_chip', name: '骨片', quantity: 2, expValue: 120, rarity: 'COMMON' },
    ];

    const roundtrip = readPlayerSave(playerSaveToJson(save));

    expect(roundtrip.player.name).toBe('アルド試験');
    expect(roundtrip.weaponMaterials).toEqual([
      { type: 'IDEA_COMMON', name: '凡骨のイデア', quantity: 5 },
      { type: 'ABYSSAL_OBSIDIAN', name: '深淵の黒鋼', quantity: 1 },
    ]);
    expect(roundtrip.residueMaterials).toEqual([
      { id: 'bone_chip', name: '骨片', quantity: 3, expValue: 120, rarity: 'COMMON' },
    ]);
  });

  test('migrates legacy v1 playerState to the current schema without losing progress', () => {
    const save = emptyPlayerSave();
    save.player.name = '移行前アルド';
    save.player.gold = 12345;
    save.player.clearedStages = ['area1_node1'];
    const legacy = {
      ...(playerSaveToJson(save) as Record<string, unknown>),
      schemaVersion: 1,
    };

    const migrated = readPlayerSave(legacy);

    expect(migrated.schemaVersion).toBe(PLAYER_SAVE_SCHEMA_VERSION);
    expect(migrated.player.name).toBe('移行前アルド');
    expect(migrated.player.gold).toBe(12345);
    expect(migrated.player.clearedStages).toEqual(['area1_node1']);
  });

  test('rejects malformed or future playerState instead of silently resetting progress', () => {
    expect(() => migratePlayerSaveSchema({ schemaVersion: '1' })).toThrow(PlayerSaveSchemaError);
    expect(() => readPlayerSave({ schemaVersion: PLAYER_SAVE_SCHEMA_VERSION + 1 })).toThrow(PlayerSaveSchemaError);
  });

  test('spends weapon materials and rejects insufficient stock', () => {
    const save = emptyPlayerSave();
    save.weaponMaterials = [
      { type: 'IDEA_COMMON', name: '凡骨のイデア', quantity: 5 },
    ];

    const spent = spendWeaponMaterialsInSave(save, [{ type: 'IDEA_COMMON', quantity: 2 }]);

    expect(spent.weaponMaterials).toEqual([
      { type: 'IDEA_COMMON', name: '凡骨のイデア', quantity: 3 },
    ]);
    expect(() =>
      spendWeaponMaterialsInSave(spent, [{ type: 'IDEA_COMMON', quantity: 4 }]),
    ).toThrow('武器強化素材が不足しています');
  });

  test('cleans only requested reference scopes', () => {
    const save = emptyPlayerSave();
    save.player.equipmentIds.weapon = 'item-keep';
    save.player.equipmentIds.sub = 'item-missing';
    save.player.partyMonsterIds = ['monster-keep', 'monster-missing', null];
    save.player.equippedResidueIds = ['residue-keep', 'residue-missing', null, null, null];

    const equipmentOnly = cleanPlayerSaveReferencesWithIds(save, {
      scopes: ['equipment'],
      itemIds: ['item-keep'],
    });
    expect(equipmentOnly.player.equipmentIds).toMatchObject({
      weapon: 'item-keep',
      sub: null,
    });
    expect(equipmentOnly.player.partyMonsterIds).toEqual(['monster-keep', 'monster-missing', null]);
    expect(equipmentOnly.player.equippedResidueIds).toEqual(['residue-keep', 'residue-missing', null, null, null]);

    const allScopes = cleanPlayerSaveReferencesWithIds(save, {
      itemIds: ['item-keep'],
      monsterIds: ['monster-keep'],
      residueIds: ['residue-keep'],
    });
    expect(allScopes.player.partyMonsterIds).toEqual(['monster-keep', null, null]);
    expect(allScopes.player.equippedResidueIds).toEqual(['residue-keep', null, null, null, null]);
  });

  test('applies job exp using master data level bonuses', () => {
    const masterData = MasterDataService.getInstance();
    const save = emptyPlayerSave();

    const leveled = applyJobExpGainToSave(
      save,
      expForLevel(10),
      (jobId) => masterData.getJob(jobId),
    );
    const warrior = leveled.player.jobs.find((job) => job.jobId === 'warrior');

    expect(masterData.getJob('warrior')?.levelBonuses['10']).toEqual({ passiveAtkBonus: 1 });
    expect(warrior).toMatchObject({ level: 10, exp: expForLevel(10) });
    expect(leveled.player.passives.passiveAtkBonus).toBe(1);
  });

  test('applies necro exp without requiring a schema change', () => {
    const save = emptyPlayerSave();

    const leveled = applyNecroExpGainToSave(save, expForLevel(12));

    expect(leveled.player.necroStatus).toMatchObject({
      rank: 1,
      maxCost: 10,
      baseStatsBonus: 1,
      level: 12,
      exp: expForLevel(12),
    });
  });
});
