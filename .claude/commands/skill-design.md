新しいスキルをマスターデータに追加します: $ARGUMENTS

## 引数フォーマット

`/skill-design <jobId> <スキル名> <属性> <targetType>`

例:
- `/skill-design dark_knight 冥府斬 DARK SINGLE`
- `/skill-design necromancer 骸の嵐 NONE ALL_ENEMIES`
- `/skill-design paladin 聖光破 LIGHT SINGLE`

引数が不足している場合はユーザーに確認する。

## Step 1: 設計書とマスターデータの確認

以下を Read する:
1. `docs/設計書/19_スキルバランス設計書.md` — power 倍率ガイドライン
2. `src/data/master/jobs.json` — 対象 jobId の Tier を確認
3. `src/data/master/skills.json` — 既存スキルとのバランス確認

## Step 2: スキル仕様の決定

以下の設計書ガイドラインに従って数値を決める:

**power 倍率の基準（設計書19 §2.2）:**
| 分類 | コスト帯 | Tier1 | Tier2 |
|------|---------|-------|-------|
| PHYS_SINGLE | 低(4-8EN) | 1.20-1.55 | 1.40-1.80 |
| PHYS_SINGLE | 中(9-14EN) | 1.45-1.80 | 1.65-2.10 |
| MAGIC_SINGLE | 低(8-12EN) | 1.40-1.70 | 1.55-1.90 |
| MAGIC_SINGLE | 中(13-18EN) | 1.60-2.00 | 1.80-2.25 |
| PHYS_AOE | 低(4-8EN) | 0.90-1.30 | 1.10-1.50 |
| MAGIC_AOE | 低(8-12EN) | 1.10-1.45 | 1.25-1.60 |

**mpCost（エネルギーコスト）の目安:**
- 低コスト単体: 4〜8 EN
- 中コスト単体: 9〜14 EN
- 高コスト/AoE: 15〜20 EN
- 奥義（ULTIMATE）: maxEnergy 全消費

**effectKey の命名規則:** `<element>_<attackType>` 例: `dark_slash`, `none_strike`, `light_magic`

## Step 3: skills.json に追加

以下の形式で `src/data/master/skills.json` に追記する:

```json
"<jobId>_<snake_case_name>": {
  "id": "<jobId>_<snake_case_name>",
  "name": "<スキル名>",
  "mpCost": <エネルギーコスト>,
  "power": <倍率>,
  "type": "PHYSICAL | MAGICAL | HEAL",
  "element": "<FIRE|WATER|THUNDER|EARTH|WIND|ICE|LIGHT|DARK|NONE>",
  "attackType": "SLASH | STRIKE | PROJECTILE | MAGIC | SUMMON | HEAL",
  "targetType": "SINGLE | ALL_ENEMIES | SELF",
  "effectKey": "<element>_<attackType>",
  "description": "<スキル説明文（30文字以内推奨）>"
}
```

## Step 4: jobs.json に追加

`src/data/master/jobs.json` の該当 `jobId` の `skills` 配列に新スキルIDを追加する:

```json
{
  "id": "<jobId>",
  "skills": ["existing_skill_1", "existing_skill_2", "<新スキルID>"]
}
```

## Step 5: 型チェック

```bash
npx tsc --noEmit
```

## Step 6: BattleEngine でのスキル動作確認

```bash
npm test -- --testPathPattern="BattleEngine" 2>&1 | tail -20
```

## 完了報告

```
## スキル追加完了: <スキル名>

スキルID: <id>
分類: <PHYS_SINGLE / MAGIC_AOE / ...>
コスト: <N> EN
power: <X.XX>（ガイドライン: <range>）
追加先: skills.json + jobs.json (<jobId>)

バランス評価: ✅ ガイドライン範囲内 / ⚠️ <備考>
```
