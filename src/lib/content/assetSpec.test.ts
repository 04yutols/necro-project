import {
  buildAssetPrompt,
  standardAssetOptimizedPath,
  standardAssetOutputPath,
  validateAssetSpec,
  type AssetSpec,
} from './assetSpec';
import type { AssetRecord, ContentPackage } from './contentPackage';

const spec: AssetSpec = {
  schemaVersion: 1,
  usage: 'weapon-card',
  variant: 'default',
  width: 768,
  height: 1024,
  aspectRatio: { width: 3, height: 4 },
  transparency: 'OPAQUE',
  safeArea: { top: 64, right: 64, bottom: 64, left: 64 },
  consistencyGroup: 'ash_blade',
  style: {
    medium: '重厚なダークファンタジーのゲーム用コンセプトアート',
    palette: ['ash black', 'bone ivory', 'void purple'],
    lighting: '冷たい逆光と弱い紫の魔力光',
    mood: '滅びた王国への忠誠と静かな威圧感',
    materials: ['焼けた鋼', '灰', '古い金'],
  },
  mustInclude: ['灰で形作られた王冠型の鍔'],
  avoid: ['現代兵器'],
  maxBytes: 450_000,
};

const asset: AssetRecord = {
  id: 'ash_blade_card',
  ownerId: 'ash_blade',
  kind: 'detail-art',
  state: 'PLANNED',
  mediaType: 'image',
  format: 'webp',
  originalPath: 'content/packages/ash_package/originals/ash_blade_card.png',
  outputPath: 'public/images/generated/weapons/ash_blade/card-default.webp',
  referenceAssetRefs: [],
  spec,
};

const pkg = {
  id: 'ash_package',
  title: '灰冠の葬剣',
  brief: {
    playerExperience: '亡国の記憶から葬剣を得る。',
    themes: ['亡国', '灰'],
    mustInclude: ['第1章の意匠'],
    avoid: ['第2章設定'],
  },
  targets: [{ id: 'ash_blade', kind: 'weapon', loreRefs: ['royal_capital'] }],
} as ContentPackage;

describe('AssetSpec', () => {
  test('標準出力先を用途から固定する', () => {
    expect(standardAssetOutputPath('ash_blade', spec)).toBe('public/images/generated/weapons/ash_blade/card-default.webp');
    expect(standardAssetOptimizedPath('ash_package', 'ash_blade_card')).toBe('content/packages/ash_package/optimized/ash_blade_card.webp');
  });

  test('寸法とaspect ratioの不一致を拒否する', () => {
    const findings = validateAssetSpec({ ...spec, width: 800 });
    expect(findings).toContainEqual(expect.objectContaining({ level: 'FAIL', field: 'spec.aspectRatio' }));
  });

  test('世界観・safe area・禁止要素を生成プロンプトへ含める', () => {
    const prompt = buildAssetPrompt(pkg, asset);
    expect(prompt).toContain('亡国の記憶から葬剣を得る');
    expect(prompt).toContain('safe area top 64px');
    expect(prompt).toContain('第2章設定');
    expect(prompt).toContain('ash_blade の基準デザイン');
  });
});
