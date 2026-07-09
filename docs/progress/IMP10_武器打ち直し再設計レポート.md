# IMP-10 武器打ち直し再設計レポート

> 実施日: 2026-06-01  
> 詳細設計: `docs/設計書/91_IMP10_武器打ち直しILv成長とサーバー永続化設計.md`

## 1. 対応概要

武器の打ち直しを `ILv.40 / 60 / 80 / 90` への段階ジャンプから、1回ごとに `ILv + 1` する育成方式へ変更した。
メインステータスの武器基礎ATKは毎ILvで必ず増加し、サブステータスは20ILvごとの節目で成長する。

共鳴、打ち直し、分解はゲストモードだけでなくログイン済みモードでも動作する。
ログイン済みモードではServer ActionとPrismaトランザクションで、素材消費と武器更新を同時に永続化する。

## 2. バランス調整

### メインATK

```
WeaponBaseATK =
  ILv
  + floor((Lv90BaseATK - 90) × (ILv - 1) / 89)
```

代表値:

| 武器 | ILv.1 | ILv.20 | ILv.40 | ILv.60 | ILv.80 | ILv.90 |
|---|---:|---:|---:|---:|---:|---:|
| R / MID | 1 | 22 | 44 | 66 | 88 | 100 |
| SR / MID | 1 | 28 | 57 | 86 | 115 | 130 |
| SSR / MID | 1 | 36 | 72 | 109 | 146 | 165 |
| UR / MYTHIC | 1 | 47 | 96 | 146 | 195 | 220 |

初期配布武器 `bone_cleaver` は `R / MID / ILv.1` のため、IMP-9で調整した序盤4〜5ダメージ帯を維持する。
ILv上昇ごとの最低 `+1` と、終盤でのレアリティ差を両立した。

### サブステータス

| ILv | 成長段階 |
|---|---:|
| 1〜19 | 0 |
| 20〜39 | 1 |
| 40〜59 | 2 |
| 60〜79 | 3 |
| 80〜90 | 4 |

| レアリティ | 1節目ごとの成長 | ILv.80以降 |
|---|---:|---:|
| R | +5.0% | 1.20x |
| SR | +7.5% | 1.30x |
| SSR | +10.0% | 1.40x |
| UR | +12.5% | 1.50x |

既存のアーキタイプ係数 `LOW 1.2 / MID 1.0 / HIGH 0.8 / MYTHIC 1.25` と乗算する。
高ATK型、標準型、サブステ特化型の役割は維持した。

### 素材

- 打ち直しは毎回、レアリティと次ILv帯に応じた深淵の黒鋼を消費する。
- `ILv.20 / 40 / 60 / 80` 到達時は、サブステ解放分として対応イデアを1個追加消費する。
- 新規キャラクターと既存アカウントへ、深淵の黒鋼10個と凡骨のイデア8個を初回付与する。
- 既存アカウント向け付与は一度だけ実行するバックフィルマイグレーションで対応した。

## 3. サーバー接続

### Prisma

`WeaponMaterial` を追加した。

| 列 | 役割 |
|---|---|
| `userId` | 素材所有ユーザー |
| `type` | イデアまたは深淵の黒鋼の種別 |
| `name` | 表示名 |
| `quantity` | スタック数 |

主キーは `(userId, type)` とし、同一素材を1行へ集約する。

### Server Action

| Action | 実装内容 |
|---|---|
| `rankUpWeaponAction` | 所有権確認、イデア減算、共鳴ランク更新 |
| `reforgeWeaponAction` | 所有権確認、黒鋼と節目イデア減算、ILvとATK更新 |
| `dismantleWeaponAction` | 所有権確認、装備中拒否、イデア加算、武器削除 |

素材減算は `quantity >= cost` を条件にした `updateMany` で行う。
複数素材の途中で不足した場合も、Prismaトランザクション全体がロールバックされる。

### UI

- ゲストモードはZustandのローカル更新を維持した。
- ログイン済みモードはサーバー成功後に `loadFromServer()` で再ロードする。
- サーバーロード済み状態をZustandの `isServerBacked` で明示し、App Routerでも保存経路を確実に選べるようにした。
- 通信中の強化連打を遮断した。
- 打ち直し画面へ「ILvを1上げてATKを必ず強化。サブステは20ILvごとに伸びる。」を表示した。

## 4. 検証結果

| コマンド | 結果 |
|---|---|
| `npx prisma generate` | PASS |
| `npx prisma migrate deploy` | PASS、2マイグレーション適用済み |
| `npx prisma migrate status` | PASS、適用時点でスキーマ最新 |
| `npx tsc --noEmit` | PASS |
| `npm test -- --runInBand src/logic/WeaponSystem.test.ts` | PASS、8 tests |
| `npm test -- --runInBand src/tests/account-progression.integration.test.ts` | PASS、DB再ロード込み |
| `npm test -- --runInBand` | PASS、37 suites / 241 tests |
| `npm run data:audit` | PASS、既存警告1件 |
| `npm run balance:progression` | PASS、進行崖なし |
| `npm run balance:drops` | PASS、既存警告3件 |
| `npm run build` | PASS |
| `PLAYWRIGHT_TEST_BASE_URL=http://localhost:4173 npx playwright test tests/item-equip.spec.ts --reporter=line` | PASS、3 tests |
| `PLAYWRIGHT_TEST_BASE_URL=http://localhost:4173 npx playwright test --workers=1 --reporter=line` | PASS、27 tests |
| `git diff --check` | PASS |

`npm run lint` スクリプトは `package.json` に存在しないため、型検査は `npx tsc --noEmit` と `npm run build` で実施した。

全Playwright回帰の過程で、現行UIとずれていたオンボーディングlocator、乱数ダメージ値に依存していた戦闘ログ期待値、残滓強化タブのclick同期も更新した。

## 5. 残存課題

### 深淵の黒鋼の恒常供給

初回パックでR武器のILv成長は試せるが、深淵の黒鋼を周回報酬へ接続するドロップ経済の全面調整は未実施。
次回はステージ難易度、期待周回数、レアリティ別育成期間を決めたうえで素材ドロップを追加する。

### 既存監査警告

- `npm run data:audit`: `grave_knight` が `ELITE` だが `shieldHp` 未設定
- `npm run balance:drops`: `area1_boss`, `area1_node3`, `area2_gate` のR武器期待数が目標 `1〜3` 未満

これらは今回変更前から存在し、今回の武器ILv成長実装とは独立している。
