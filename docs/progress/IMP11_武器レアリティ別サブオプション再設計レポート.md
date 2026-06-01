# IMP-11 武器レアリティ別サブオプション再設計レポート

> 実施日: 2026-06-01  
> 詳細設計: `docs/設計書/92_IMP11_武器レアリティ別サブオプション再設計.md`

## 1. 対応概要

IMP-10のILv毎ATK成長、20ILv節目成長、Server Action永続化を維持したまま、武器レアリティごとのサブオプションを再設計した。

SRは単一枠の倍率を高くし、SSRは通常枠倍率をSRより抑える代わりに固定属性ダメージ枠を持つ。
URは高倍率の通常枠と固定属性ダメージ枠を併せ持つ最終装備とした。

## 2. バランス

| レアリティ | サブオプション | 基準倍率 | 20ILvごとの成長 | ILv.80以降 |
|---|---|---:|---:|---:|
| R | 通常枠1 | 1.00x | +5% | 1.20x |
| SR | 通常枠1 | 1.25x | +6% | 1.55x |
| SSR | 通常枠1 + 固定属性枠1 | 1.10x | +5% | 1.32x |
| UR | 通常枠1 + 固定属性枠1 | 1.40x | +6% | 1.736x |

SSRは属性不一致時にSRの単一特化を必ずしも越えない。
属性一致時は追加の属性ダメージ枠によってSRを越え、編成に応じた選択が生まれる。

URは基礎ATK、MYTHIC係数、パッシブも強いため、`怨嗟顕現・喰魂` のマスター値を `ATK% 12 / DARK_DMG_BOOST 7.5` に抑えた。

## 3. 実装

### ロジック

`WeaponSystem.ts` に `WEAPON_SUBOPTION_RULES` を追加した。
`getWeaponEffectiveSubOptions()` はアーキタイプ係数、レアリティ基準倍率、20ILv節目成長率を乗算する。

`validateWeaponSubOptions()` はR / SRの単一通常枠と、SSR / URの通常枠 + 固定属性枠を検証する。

### マスターデータ

- Rの第1章武器4本を単一通常枠へ整理した。
- SSR `霊銀の斬骨刀` を `CRIT_DMG + DARK_DMG_BOOST` とした。
- UR `怨嗟顕現・喰魂` を `ATK% + DARK_DMG_BOOST` とした。
- 既存アカウントの所持武器JSONも `20260601100000_weapon_suboption_rarity_rebalance` で同じ値へ移行した。
- CLI監査と管理画面監査へ枠数、属性枠数のFAIL判定を追加した。

### UI

武器詳細へ次を表示した。

- 実効サブステータス
- サブオプション枠数
- 20ILvごとの成長
- SSR / URの `属性特化` バッジ

## 4. 検証結果

| コマンド | 結果 |
|---|---|
| `npm test -- --runInBand src/logic/WeaponSystem.test.ts` | PASS、10 tests |
| `npm test -- --runInBand` | PASS、37 suites / 243 tests |
| `npx tsc --noEmit` | PASS |
| `npm run data:audit -- --strict` | PASS、既存警告1件 |
| `npm run balance:progression` | PASS、進行崖なし |
| `npm run balance:drops` | PASS、既存警告3件 |
| `npm run build` | PASS |
| `npx prisma migrate deploy` | PASS、既存所持武器JSON移行を適用 |
| `npx prisma migrate status` | PASS、8 migrations適用済み |
| `PLAYWRIGHT_TEST_BASE_URL=http://localhost:4174 npx playwright test tests/item-equip.spec.ts --workers=1 --reporter=line` | PASS、3 tests |
| `PLAYWRIGHT_TEST_BASE_URL=http://localhost:4174 npx playwright test --workers=1 --reporter=line` | PASS、27 tests |
| `git diff --check` | PASS |

## 5. 残存課題

- 第1章に登場するSSR / URは闇属性武器のみ。炎、水、雷などの属性特化武器は後続章のマスターデータ追加時に同じ制約で制作する。
- `grave_knight` の防壁未設定警告と、3ステージのR武器期待数警告はIMP-10以前から残る独立課題である。
