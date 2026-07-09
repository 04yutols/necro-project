# 53. SEC-3 GameManager.updateParty 永続化設計

作成日: 2026-05-24
対象: `src/logic/GameManager.ts` / `src/logic/GameManager.test.ts`
ステータス: 実装済み

---

## 1. 背景

`GameManager.updateParty(characterId, monsterIds)` は、3枠固定とコスト上限の検証だけを行い、最終的な編成をDBへ保存していなかった。

```ts
console.log(`Party updated for ${characterId}: ${monsterIds.join(', ')}`);
```

現在のUI正規経路では `src/app/actions.ts` の `updatePartyForUser()` が `Character.partySlot0Id` / `partySlot1Id` / `partySlot2Id` を保存している。一方で、旧GameManager経路を直接使う処理や将来のサーバー側自動編成処理では、`updateParty()` が成功しても再ロード後に編成が消える。

---

## 2. 対応方針

### 2.1 保存先

専用のPartyテーブルは作らず、既存の `Character` モデルの3スロットを正とする。

```prisma
partySlot0Id String?
partySlot1Id String?
partySlot2Id String?
partySlot0   Monster? @relation("PartySlot0", ...)
partySlot1   Monster? @relation("PartySlot1", ...)
partySlot2   Monster? @relation("PartySlot2", ...)
```

これは既存の `loadCharacterForUser()` / `toServerGameData()` / `updatePartyForUser()` と同じ保存形式であり、UIとGameManagerの状態解釈を一致させる。

### 2.2 GameManagerの責務

`GameManager` はサーバーサイド内部クラスであり、ユーザーセッション認証は Server Action などの呼び出し元が担う。ただし、`characterId` に紐づかない `monsterId` を編成できるとデータ破壊になるため、オブジェクト所有関係は `GameManager.updateParty()` 内でも検証する。

---

## 3. バリデーション

`updateParty()` はDB更新前に以下を満たす必要がある。

| 条件 | エラー |
|---|---|
| 配列長が3ではない | `Party must have 3 slots.` |
| 同じ魔物IDが複数スロットに入る | `Duplicate monsters cannot be assigned...` |
| キャラクターが存在しない | `Character not found.` |
| 指定魔物がそのキャラクターの所有ではない | `Party contains monsters not owned by character.` |
| 合計コストが `Character.necroMaxCost` を超える | `Cost limit exceeded: x / y` |

空スロットは `null` として許可する。

---

## 4. DB更新

検証と保存は1つのトランザクションで行う。

```ts
await prisma.$transaction(async (tx) => {
  const char = await tx.character.findUnique({
    where: { id: characterId },
    select: { id: true, necroMaxCost: true },
  });

  const monsters = await tx.monster.findMany({
    where: { id: { in: selectedIds }, characterId: char.id },
    select: { id: true, cost: true },
  });

  await tx.character.update({
    where: { id: char.id },
    data: {
      partySlot0Id: slotIds[0],
      partySlot1Id: slotIds[1],
      partySlot2Id: slotIds[2],
    },
  });
});
```

トランザクション内で所有確認とコスト確認を行うため、失敗時は既存のパーティ編成を上書きしない。

---

## 5. 正規Actionとの差分

`updatePartyForUser()` はログインセッションと `Character.userId` を検証したうえで同じ3スロットを保存する。`GameManager.updateParty()` はセッションを受け取らないためユーザー認証は行わないが、`Monster.characterId === Character.id` を必須にして、他キャラクターの魔物混入を防ぐ。

将来的に `GameManager.updateParty()` を外部公開する場合は、直接公開せず必ず認証済みServer Actionでラップする。

---

## 6. テスト設計

追加テスト: `src/logic/GameManager.test.ts`

検証内容:

1. 所有魔物2体と空スロットの編成が `Character.partySlot0Id` / `partySlot1Id` / `partySlot2Id` に保存される。
2. 重複魔物は拒否される。
3. 他キャラクター所有の魔物は拒否される。
4. コスト上限超過は拒否される。
5. 3枠以外の入力は拒否される。
6. 失敗時に既存の保存済みパーティが上書きされない。

---

## 7. 完了条件

- `GameManager.updateParty()` が `console.log` だけで終了しない。
- 成功時に `Character.partySlot0Id` / `partySlot1Id` / `partySlot2Id` がDB更新される。
- 失敗時にDBが更新されない。
- 所有していない魔物を編成できない。
- 専用テスト、全体テスト、TypeScriptチェック、本番ビルドが通る。
