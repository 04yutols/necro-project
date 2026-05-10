import { RewardService, StageDropResult } from './RewardService';
import { DropEntry } from '../types/game';

// 決定論的な乱数生成器（シーケンス指定）
function makeSeqRng(values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length];
}

const svc = new RewardService();

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

  // 6. isHidden=true → rate=1.0 でもスキップ
  test('isHidden=true → weapons.length=0 even with rate=1.0', () => {
    const table: DropEntry[] = [
      { type: 'WEAPON', itemId: 'grudge_manifest', rate: 1.0, isHidden: true },
    ];
    const result = svc.processDropTable(table, 0, makeSeqRng([0.0]));
    expect(result.weapons).toHaveLength(0);
  });

  // 7. discoveryBonusRate=50 → rate×1.5 に補正 (rate=0.68 → 0.68×1.5=1.02、roll=0.99 → 命中)
  test('discoveryBonusRate=50 で rate=0.68 → roll=0.99 で命中', () => {
    const table: DropEntry[] = [
      { type: 'RESIDUE', rarity: 'RARE', rate: 0.68 },
    ];
    // roll=0.99 < 0.68×1.5=1.02 → 命中
    const result = svc.processDropTable(table, 50, makeSeqRng([0.99, 0.1]));
    expect(result.residues).toHaveLength(1);
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
