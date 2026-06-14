import { RewardService, shuffleFisherYates } from './RewardService';
import { DropEntry } from '../types/game';

// 決定論的な乱数生成器（シーケンス指定）
function makeSeqRng(values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length];
}

const svc = new RewardService();

describe('shuffleFisherYates', () => {
  test('入力配列を変更せず、注入rngで決定論的な順列を返す', () => {
    const source = ['A', 'B', 'C', 'D'];
    const shuffled = shuffleFisherYates(source, makeSeqRng([0, 0, 0]));

    expect(shuffled).toEqual(['B', 'C', 'D', 'A']);
    expect(source).toEqual(['A', 'B', 'C', 'D']);
  });

  test('長さnの配列に対してrngをn-1回だけ呼ぶ', () => {
    const rng = jest.fn(() => 0);

    shuffleFisherYates([1, 2, 3, 4, 5], rng);

    expect(rng).toHaveBeenCalledTimes(4);
  });
});

describe('RewardService.processDropTable', () => {
  // 1. WEAPON rate=1.0 → 必ずドロップ、新規インスタンス ID を持つ
  test('WEAPON rate=1.0 → weapons.length=1, id≠master.id, rank=0', () => {
    const table: DropEntry[] = [
      { type: 'WEAPON', itemId: 'bone_cleaver', rate: 1.0 },
    ];
    // rng 1回目=0.0 (roll < 1.0 → 命中), 2回目=0.5 (ID生成用)
    const result = svc.processDropTable(table, 0, makeSeqRng([0.0, 0.5]));
    expect(result.weapons).toHaveLength(1);
    expect(result.weapons[0].id).not.toBe('bone_cleaver');
    expect(result.weapons[0].rank).toBe(0);
    expect(result.weapons[0].name).toBe('骨砕きの短剣');
  });

  // 2. WEAPON rate=0.0 → roll < 0 は成立しないので常にスキップ
  test('WEAPON rate=0.0 → weapons.length=0', () => {
    const table: DropEntry[] = [
      { type: 'WEAPON', itemId: 'bone_cleaver', rate: 0.0 },
    ];
    const result = svc.processDropTable(table, 0, makeSeqRng([0.0]));
    expect(result.weapons).toHaveLength(0);
  });

  // 3. RESIDUE RARE 生成 — rarity/subCount/level/maxExp の確認
  test('RESIDUE RARE → rarity=RARE, subOptions.length∈[2,3], level=1, maxExp=2500', () => {
    const table: DropEntry[] = [
      { type: 'RESIDUE', rarity: 'RARE', rate: 1.0 },
    ];
    // rng=0.0 以外で RESIDUE 生成が走るように roll < 1.0
    const rng = () => 0.1;
    const result = svc.processDropTable(table, 0, rng);
    expect(result.residues).toHaveLength(1);
    const r = result.residues[0];
    expect(r.rarity).toBe('RARE');
    expect(r.subOptions.length).toBeGreaterThanOrEqual(2);
    expect(r.subOptions.length).toBeLessThanOrEqual(3);
    expect(r.level).toBe(1);
    expect(r.maxExp).toBe(2500);
  });

  // 4. RESIDUE EPIC → subOptions.length∈[3,4]
  test('RESIDUE EPIC → subOptions.length∈[3,4]', () => {
    const table: DropEntry[] = [
      { type: 'RESIDUE', rarity: 'EPIC', rate: 1.0 },
    ];
    const rng = () => 0.2;
    const result = svc.processDropTable(table, 0, rng);
    expect(result.residues[0].subOptions.length).toBeGreaterThanOrEqual(3);
    expect(result.residues[0].subOptions.length).toBeLessThanOrEqual(4);
  });

  // 5. MATERIAL ドロップ → id が bone_chip_ で始まる, expValue=120
  test('MATERIAL bone_chip → id starts with bone_chip_, expValue=120', () => {
    const table: DropEntry[] = [
      { type: 'MATERIAL', itemId: 'bone_chip', rate: 1.0 },
    ];
    const result = svc.processDropTable(table, 0, makeSeqRng([0.0]));
    expect(result.materials).toHaveLength(1);
    expect(result.materials[0].id).toMatch(/^bone_chip_/);
    expect(result.materials[0].expValue).toBe(120);
  });

  test('generated instance ids do not depend on Date.now or Math.random', () => {
    const table: DropEntry[] = [
      { type: 'WEAPON', itemId: 'bone_cleaver', rate: 1.0 },
      { type: 'RESIDUE', rarity: 'RARE', rate: 1.0 },
      { type: 'MATERIAL', itemId: 'bone_chip', rate: 1.0 },
    ];
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(123456789);
    const mathRandomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.1234);

    try {
      const result = svc.processDropTable(table, 0, makeSeqRng([
        0.0,
        0.0,
        0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7,
        0.0,
      ]));
      const ids = [
        result.weapons[0].id,
        result.residues[0].id,
        result.materials[0].id,
      ];

      expect(ids).toHaveLength(3);
      expect(new Set(ids).size).toBe(3);
      ids.forEach((id) => {
        expect(id).not.toContain('123456789');
        expect(id).toMatch(/_[0-9a-f-]{36}$/);
      });
      expect(mathRandomSpy).not.toHaveBeenCalled();
      expect(nowSpy).not.toHaveBeenCalled();
    } finally {
      mathRandomSpy.mockRestore();
      nowSpy.mockRestore();
    }
  });

  test('CONSUMABLE underworld_potion → consumables に数量付きで入る', () => {
    const table: DropEntry[] = [
      { type: 'CONSUMABLE', itemId: 'underworld_potion', quantity: 2, rate: 1.0 },
    ];
    const result = svc.processDropTable(table, 0, makeSeqRng([0.0]));
    expect(result.consumables).toHaveLength(1);
    expect(result.consumables[0].type).toBe('CONSUMABLE');
    expect(result.consumables[0].name).toBe('冥界薬');
    expect(result.consumables[0].quantity).toBe(2);
    expect(result.consumables[0].battleEffect?.type).toBe('HEAL_HP');
  });

  // 6. isHidden=true → UR/ユニークの秘匿ドロップも抽選対象
  test('isHidden=true → hidden unique weapon can drop when roll succeeds', () => {
    const table: DropEntry[] = [
      { type: 'WEAPON', itemId: 'grudge_manifest', rate: 1.0, isHidden: true },
    ];
    const result = svc.processDropTable(table, 0, makeSeqRng([0.0, 0.0]));
    expect(result.weapons).toHaveLength(1);
    expect(result.weapons[0].name).toBe('怨嗟顕現・喰魂');
    expect(result.weapons[0].isUnique).toBe(true);
  });

  // 7. discoveryBonusRate=50 → rate×1.5 に補正しつつ、最終確率は100%で打ち止め
  test('discoveryBonusRate=50 で rate=0.68 → roll=0.99 で命中', () => {
    const table: DropEntry[] = [
      { type: 'RESIDUE', rarity: 'RARE', rate: 0.68 },
    ];
    // adjustedRate は min(1, 0.68×1.5) = 1 → roll=0.99 で命中
    const result = svc.processDropTable(table, 50, makeSeqRng([0.99, 0.1]));
    expect(result.residues).toHaveLength(1);
  });

  test('discoveryBonusRate cannot raise the effective drop rate above 100%', () => {
    const table: DropEntry[] = [
      { type: 'WEAPON', itemId: 'bone_cleaver', rate: 0.9 },
    ];
    const result = svc.processDropTable(table, 50, makeSeqRng([1.0]));
    expect(result.weapons).toHaveLength(0);
  });

  // 8. 同一 rng で決定論的に同じ結果
  test('同一 rng seed → 2回呼び出し結果が一致', () => {
    const table: DropEntry[] = [
      { type: 'RESIDUE', rarity: 'EPIC', rate: 1.0 },
    ];
    const seq = [0.1, 0.3, 0.7, 0.2, 0.5, 0.9, 0.4, 0.6, 0.8, 0.15, 0.05];
    const r1 = svc.processDropTable(table, 0, makeSeqRng(seq));
    const r2 = svc.processDropTable(table, 0, makeSeqRng(seq));
    // mainStat と subOptions の構造が一致する（id は Date.now() に依存するため除外）
    expect(r1.residues[0].mainStat).toEqual(r2.residues[0].mainStat);
    expect(r1.residues[0].subOptions).toEqual(r2.residues[0].subOptions);
    expect(r1.residues[0].rarity).toEqual(r2.residues[0].rarity);
  });

  // 9. RESIDUE のメインとサブに型重複なし
  test('RESIDUE mainStat.type ∉ subOptions の type リスト', () => {
    const table: DropEntry[] = [
      { type: 'RESIDUE', rarity: 'EPIC', rate: 1.0 },
    ];
    // 複数パターンを試す
    for (let seed = 0; seed < 10; seed++) {
      const rng = makeSeqRng([seed * 0.1, 0.1, 0.3, 0.6, 0.9, 0.05, 0.45, 0.75, 0.15, 0.55, 0.85]);
      const result = svc.processDropTable(table, 0, rng);
      const r = result.residues[0];
      const subTypes = r.subOptions.map(s => s.type);
      expect(subTypes).not.toContain(r.mainStat.type);
    }
  });

  // 10. calculateExp — MAGICAL カテゴリ 1.1× 補正
  test('calculateExp: MAGICAL category → 1.1× multiplier applied', () => {
    const player: any = {
      category: 'MAGICAL',
      currentJobId: 'mage',
      jobs: [{ jobId: 'mage', level: 10, exp: 0 }],
    };
    // levelFactor = 1 + 10/100 = 1.1, categoryMultiplier = 1.1
    // result = floor(1000 * 1.1 * 1.1) = floor(1210) = 1210
    expect(svc.calculateExp(1000, player)).toBe(1210);
  });
});

describe('RewardService.processStageDropTable', () => {
  test('初回クリア時だけ firstClearGuaranteed の武器を確定付与する', () => {
    const stage: Parameters<RewardService['processStageDropTable']>[0] = {
      id: 'area1_node2',
      chapter: 1,
      rewards: {
        baseExp: 0,
        baseGold: 0,
        dropTable: [],
        firstClearGuaranteed: [
          { type: 'WEAPON', itemId: 'bone_cleaver', rarity: 'R', rate: 1 },
        ],
      },
    };

    const first = svc.processStageDropTable(stage, [], 0, makeSeqRng([0.99]));
    const repeat = svc.processStageDropTable(stage, ['area1_node2'], 0, makeSeqRng([0.0]));

    expect(first.weapons).toHaveLength(1);
    expect(first.weapons[0].name).toBe('骨砕きの短剣');
    expect(repeat.weapons).toHaveLength(0);
  });

  test('firstClearGuaranteed の MONSTER は既所持 masterId をスキップする', () => {
    const result = svc.processStageDropTable({
      id: 'area1_node1',
      chapter: 1,
      rewards: {
        baseExp: 0,
        baseGold: 0,
        dropTable: [],
        firstClearGuaranteed: [
          { type: 'MONSTER', monsterId: 'grave_soldier', rate: 1 },
          { type: 'MONSTER', monsterId: 'rot_hound', rate: 1 },
        ],
      },
    }, [], 0, makeSeqRng([0.0]), ['grave_soldier']);

    expect(result.monsters.map(monster => monster.masterId)).toEqual(['rot_hound']);
  });

  test('firstClearGuaranteed の WEAPON_MATERIAL は weaponMaterials に入る', () => {
    const result = svc.processStageDropTable({
      id: 'area1_boss',
      chapter: 1,
      rewards: {
        baseExp: 0,
        baseGold: 0,
        dropTable: [],
        firstClearGuaranteed: [
          { type: 'WEAPON_MATERIAL', weaponMaterialType: 'ABYSSAL_OBSIDIAN', quantity: 2, rate: 1 },
        ],
      },
    }, [], 0, makeSeqRng([0.0]));

    expect(result.weaponMaterials).toEqual([
      { type: 'ABYSSAL_OBSIDIAN', name: '深淵の黒鋼', quantity: 2 },
    ]);
  });

  test('第1章ステージではRESIDUEがドロップテーブルにあっても生成しない', () => {
    const result = svc.processStageDropTable({
      chapter: 1,
      rewards: {
        baseExp: 0,
        baseGold: 0,
        dropTable: [
          { type: 'WEAPON', itemId: 'bone_cleaver', rate: 1 },
          { type: 'RESIDUE', rarity: 'RARE', rate: 1 },
        ],
      },
    }, ['area1_node3'], 0, makeSeqRng([0.0, 0.0]));

    expect(result.weapons).toHaveLength(1);
    expect(result.residues).toHaveLength(0);
  });

  test('第2章ステージではarea1_node3クリア後にRESIDUEを生成する', () => {
    const result = svc.processStageDropTable({
      chapter: 2,
      rewards: {
        baseExp: 0,
        baseGold: 0,
        dropTable: [
          { type: 'RESIDUE', rarity: 'EPIC', rate: 1 },
        ],
      },
    }, ['area1_node3'], 0, makeSeqRng([0.0, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2]));

    expect(result.residues).toHaveLength(1);
    expect(result.residues[0].rarity).toBe('EPIC');
  });
});

describe('RewardService.processStageNecromance', () => {
  test('ステージ出現敵をネクロマンス成功モンスターとして生成する', () => {
    const result = svc.processStageNecromance({
      waves: [
        { label: 'WAVE 1', role: 'WARMUP', enemyIds: ['grave_soldier', 'rot_hound'], intent: '' },
      ],
    }, [], makeSeqRng([0.0, 0.0]));

    expect(result.map(monster => monster.masterId)).toEqual(['grave_soldier', 'rot_hound']);
    expect(result[0]).toMatchObject({
      name: '霊体騎士',
      cost: 1,
      tier: 'MINION',
      skillIds: ['skill_necromancer_1'],
    });
  });

  test('所有済みmasterIdはネクロマンス候補から除外する', () => {
    const result = svc.processStageNecromance({
      waves: [
        { label: 'WAVE 1', role: 'WARMUP', enemyIds: ['grave_soldier', 'rot_hound'], intent: '' },
      ],
    }, ['grave_soldier'], makeSeqRng([0.0]));

    expect(result.map(monster => monster.masterId)).toEqual(['rot_hound']);
  });

  test('BOSSは0.1%未満のrollでのみ成功する', () => {
    const miss = svc.processStageNecromance({
      waves: [
        { label: 'WAVE 1', role: 'BOSS', enemyIds: ['ossuary_wyrm_lord'], intent: '' },
      ],
    }, [], makeSeqRng([0.001]));
    const hit = svc.processStageNecromance({
      waves: [
        { label: 'WAVE 1', role: 'BOSS', enemyIds: ['ossuary_wyrm_lord'], intent: '' },
      ],
    }, [], makeSeqRng([0.0009]));

    expect(miss).toHaveLength(0);
    expect(hit).toHaveLength(1);
    expect(hit[0]).toMatchObject({ masterId: 'ossuary_wyrm_lord', cost: 4, tier: 'BOSS' });
  });
});
