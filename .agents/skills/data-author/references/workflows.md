# Data Authoring ワークフロー

## Content Packageから数値を作る

複数種類を同じ企画で作る場合や、combat-unit / skill / weaponの新規数値を作る場合は、先に`forge-game-content`のContent Packageを使う。

1. READY deliverableの`artifact.authoringKind`と`artifact.request`へrole、target level、tier/cost、ownerなどを記録する。
2. `npm run content:author -- <package.json>`を実行する。
3. 生成された`changes`、`artifact.authored.rationale`、`artifact.simulation`、`evidence`を確認する。
4. `npm run content:validate -- <package.json>`と通常のmaster監査を通す。

`content:author`は既存enemy / monster / skill / job / weapon gateと実BattleEngineを使う。目標帯外のWARN/FAILを手作業で消さず、役割や目標帯を見直して再生成する。job / monsterの草稿changeには検証用`id`が入るが、apply時はキーIDだけを残してmaster規約へ正規化される。

## 新しいボス戦の追加

1. **エネミー設計** (`enemies.json`):
   - `tier: "BOSS"` を設定。
   - 第1章基準では HP 90-150 / `shieldHp` + `maxShieldHp` 34-48
     （`references/schemas.md#stats-criteria` 参照。後続章は緩やかにスケール）。
   - `gimmicks` を追加（例: `{ "trigger": "HP_BELOW_50", "effect": "ENRAGE", "value": ... }`）。
   - `dropTable` を定義（例: SSR 武器 + MATERIAL）。
   - 味方化させたい場合は `necromance`（captureRate / allyCost / allyStats / skillIds）を設定。
   - `battle` の color / sprite / size を設定。

2. **ステージ設定** (`stages.json`):
   - `nodeType: "BOSS"`、エリアボスなら `isAreaBoss: true`。
   - `waves` を構成し、最終 WAVE（role: "BOSS"）にボスを配置。`waveCount` と配列長を一致させる。
   - `unlockRequires` に直前ノードの stage ID を設定。
   - `(chapter, area)` が `areas.json` に存在することを確認。
   - `position` 座標を AreaMap 上の空き位置に設定。
   - 必要なら `areaGimmick`（SLIP_DAMAGE / STATUS_AILMENT）。

3. **報酬**:
   - `dropTable` の武器・素材が `items.json` / `materials.json` に定義済みであること。

4. **ストーリー統合（任意）** (`src/data/story/ch1_scenes.json` の `scenes` 配列):
   - `trigger.type: "BOSS_CLEAR"` + 対象 stage ID を設定。
   - `lines[].speaker` は `src/data/story/characters.json` の既存 ID
     （aldo / line / demon_king / narrator）を使う。

## 新しい武器の作成

1. **アイテム定義** (`items.json`):
   - `archetype`（LOW / MID / HIGH / MYTHIC）と `rarity` = `weaponRarity`（R / SR / SSR / UR）を選ぶ。
   - `passiveA` を設定（SR 以上は `passiveB` も）。
   - `descTemplate` に `{value}%` を埋め込み、`values` 配列に共鳴ランク1-5に対応する 5 値を入れる。
   - `stats` は通常空 `{}`（rank / ilv 由来で計算される）。

2. **ドロップ配置**:
   - 新しい `itemId` を該当する `enemies.json` / `stages.json` の `dropTable` に追加。

## 新しいスキルの追加

`/skill-design` コマンドが手順化済み（power 倍率は `docs/設計書/19_スキルバランス設計書.md` に従う）。
手動で行う場合: `skills.json` に追加 → `jobs.json` の該当職業 `skills` 配列に
`{ "level": <習得Lv>, "skillId": "<id>" }` 形式で追加（文字列ではない）。

## 新しい深淵の残滓名称の追加

`residueNames.json` に `id / name / rarity / chapter / origin / tags` を追加する。
性能フィールドは追加しない。複数種類のコンテンツを同じ企画で作る場合は
`forge-game-content` スキルのcontent bundleを使う。

## 検証

- 編集後は `/validate-master`（相互参照チェック）と `npx tsc --noEmit` を必ず実行。
- すべての JSON キーが内部 `id` フィールドと一致していること
  （jobs / monsters / demonForms はキー = ID、story scenes は配列なので対象外）。
- CI が `git diff --exit-code src/data/master` をチェックする — テストが
  マスターデータを書き換えないこと。
