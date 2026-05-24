# 49_SEC1_認証付きServerActions設計

## 目的

`docs/progress/BUGS_AND_SECURITY.md` の `SEC-1: 認証なしのスタブ Server Actions` を解消する。

対象は以下の3つ。

| Action | 旧状態 | 新状態 |
|---|---|---|
| `processGrowthAction` | 認証なしで `{ success: true }` を返す | セッション確認、キャラクター所有者確認、ランクアップDB更新 |
| `soulStoneAction` | `Math.random()` IDと固定 Goblin 欠片を返す | セッション確認、魔物所有者確認、SoulShard作成、元魔物削除 |
| `equipShardAction` | 認証なしの no-op | セッション確認、魔物と魂片の同一所有者確認、Monster.soulShardId 更新 |

## セキュリティ方針

Server Action は必ず `auth()` でセッションを取得し、`session.user.id` を信頼境界にする。

クライアントから渡される `characterId` / `monsterId` / `shardId` は所有権を示す情報として扱わない。DB参照時に必ず以下を満たす。

- `Character.userId === session.user.id`
- `Monster.character.userId === session.user.id`
- `SoulShard.characterId === Monster.characterId`

これにより、他プレイヤーの魔物を魂石化する、他プレイヤーの魂片を装備する、他プレイヤーのランクを操作する、といった IDOR を防ぐ。

## SoulShard 所有モデル

従来スキーマでは `SoulShard` に所有者列がなく、魂石化で `Monster` を削除すると欠片の所有者をDB上で検証できなかった。

SEC-1対応では `SoulShard.characterId` を追加し、欠片インベントリはキャラクターに属するものとして扱う。

```prisma
model Character {
  soulShards SoulShard[] @relation("CharacterSoulShards")
}

model SoulShard {
  characterId String?
  character   Character? @relation("CharacterSoulShards", fields: [characterId], references: [id], onDelete: SetNull)
}
```

`onDelete: SetNull` にしているのは、既存データや管理作業でキャラクターが消えた場合にも外部キー違反で削除不能にしないため。通常のゲーム操作では `characterId` がある SoulShard のみを所有アイテムとして扱う。

## Action 詳細

### processGrowthAction

`type = RANK_UP` のみを実行対象にする。

1. `auth()` でログイン確認。
2. `characterId` と `session.user.id` でキャラクター所有者を確認。
3. `NecroService.performRankUp(characterId, true)` を呼ぶ。
4. `loadCharacterForUser()` で最新状態を返す。

`type = CHANGE_JOB` は `jobId` が引数にない旧APIなので、成功扱いにはしない。既存の `changeJobAction(characterId, jobId)` を使用するようエラーを返す。

### soulStoneAction

1. `auth()` でログイン確認。
2. `monsterId` と `Monster.character.userId` で所有者を確認。
3. transaction 内で `SoulShard` を作成する。
4. `SoulShard.characterId` へ元魔物の `characterId` を保存する。
5. 元 `Monster` を削除する。
6. 作成した `SoulShardData` を返す。

効果値は既存の死霊術設計に合わせる。

```text
atkBonus = floor(monster.atk * 0.1)
elementDmgBoost = floor(monster.effectHit * 0.1)
specialAbility = tribe から派生
```

### equipShardAction

1. `auth()` でログイン確認。
2. 装備先 `Monster` がログインユーザーのキャラクター配下であることを確認。
3. `SoulShard.characterId === Monster.characterId` を確認。
4. `Monster.soulShardId` を更新する。
5. 最新の `ServerGameData` を返す。

## 返却仕様

| Action | 成功時 | 失敗時 |
|---|---|---|
| `processGrowthAction` | `{ success: true, data: ServerGameData }` | `{ success: false, error }` |
| `soulStoneAction` | `{ success: true, data: SoulShardData }` | `{ success: false, error }` |
| `equipShardAction` | `{ success: true, data: ServerGameData }` | `{ success: false, error }` |

## テスト方針

`src/tests/sec1-server-actions.integration.test.ts` で以下を保証する。

- 未ログインでは `soulStoneAction` が拒否される。
- 自分の魔物だけ魂石化でき、DB上に `characterId` 付き SoulShard が作成され、元魔物は削除される。
- 作成した魂片は `loadCharacterForUser()` の `soulShards` に出る。
- 所有魂片を自分の別魔物へ装備できる。
- 他ユーザーの魔物の魂石化、他ユーザーの魂片装備は拒否される。
- `processGrowthAction(RANK_UP)` は所有キャラクターだけ更新し、`CHANGE_JOB` 旧APIは成功扱いにしない。

## 今回の非対象

`fetchPlayerAction` の IDOR リスクは `SEC-2` として別項目化し、`52_SEC2_fetchPlayerAction_IDOR設計.md` で対応済み。
