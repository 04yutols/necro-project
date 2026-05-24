# 52. SEC-2 fetchPlayerAction IDOR対策設計

作成日: 2026-05-24  
対象: `src/app/actions.ts` / `src/tests/sec2-fetch-player-action.integration.test.ts`  
ステータス: 実装済み

---

## 1. 背景

`fetchPlayerAction(characterId)` は、任意の `characterId` を受け取る Server Action でありながら、認証と所有者確認を行わずにハードコードされたプレイヤーデータを返していた。

現時点ではDBから他ユーザー情報を読んでいないため直接の情報漏洩は限定的だが、このActionは「ID指定でプレイヤーを取得する」API境界である。将来DB接続へ差し替えた際、`Character.id` のみで検索すると他ユーザーのキャラクターを取得できる IDOR(Insecure Direct Object Reference) になる。

---

## 2. 対応方針

### 2.1 認可境界

`fetchPlayerAction` は公開Server Actionとして、必ず `auth()` のセッションを確認する。

- 未ログイン: `{ success: false, error: 'ログインが必要です' }`
- ログイン済み: `fetchPlayerForUser(session.user, characterId)` に委譲

テスト用・サーバー内部用の `fetchPlayerForUser` も、既存の `changeJobForUser` / `processGrowthForUser` と同じく `getAuthorizedUser(user.id)` を通す。これにより、テストヘルパー経由でも「現在のセッションユーザーと引数のユーザーが一致する」前提を強制する。

### 2.2 オブジェクト所有者確認

キャラクター取得は必ず次の条件で行う。

```ts
where: {
  id: characterId,
  userId: authorizedUser.id,
}
```

`characterId` が存在しても `userId` が一致しない場合は、存在しないキャラクターと同じエラーを返す。これにより、ID推測による存在確認も避ける。

### 2.3 返却データ

旧実装の固定値 `{ id, name: 'アルド', stats: ... }` は廃止する。返却する `data` は `CharacterData` とし、`loadCharacterForUser()` と同じ `toServerGameData()` 経路で変換する。

これにより以下が揃う。

- 職業補正済みステータス
- 基礎ステータス
- 装備中武器
- 職業レベル
- 進行状況
- エネルギー情報
- 死霊術ステータス反映値

---

## 3. 実装詳細

### 3.1 共通include定義

`loadCharacterForUser()` と `fetchPlayerForUser()` のロード対象がズレると、片方だけ古いデータ形状になる。そこで `CHARACTER_GAME_DATA_INCLUDE` を定義し、両方で共有する。

含める主なリレーション:

- `jobs`
- 武器・装備スロット
- パーティ魔物と `soulShard` / `spiritCore`
- 所持魂片
- 深淵の残滓と装備中残滓

### 3.2 インベントリ取得

`fetchPlayerForUser()` はプレイヤー本体の変換に必要な所持品も安全な条件で取得する。

```ts
prisma.item.findMany({ where: { ownerId: authorizedUser.id } })
prisma.monster.findMany({ where: { characterId: character.id } })
```

`Item` はユーザー所有、`Monster` はキャラクター所有で閉じる。キャラクター自体が `userId` で検証済みなので、魔物取得も越権しない。

---

## 4. エラー設計

| ケース | 戻り値 | 理由 |
|---|---|---|
| 未ログイン | `ログインが必要です` | セッションなし |
| セッションと引数ユーザーが不一致 | `ログインが必要です` | 内部用関数の誤用防止 |
| 存在しないキャラクター | `キャラクターが見つかりません` | 通常の未発見 |
| 他ユーザーのキャラクター | `キャラクターが見つかりません` | IDOR防止のため存在を隠す |

---

## 5. テスト設計

追加テスト: `src/tests/sec2-fetch-player-action.integration.test.ts`

検証内容:

1. 未ログイン状態で `fetchPlayerAction` が失敗する。
2. ログインユーザーが自分のキャラクターを取得できる。
3. 返却値が固定モックではなく、DB更新後の実データを反映する。
4. ユーザーAがユーザーBの `characterId` を指定しても失敗する。
5. ユーザーB本人であれば同じ `characterId` を取得できる。

---

## 6. 完了条件

- `fetchPlayerAction` からハードコードされたプレイヤーモックが消えている。
- `Character.id` 単独検索がなく、`Character.userId` との複合条件で検索している。
- `fetchPlayerForUser` を含め、現在セッションとの一致を確認している。
- SEC-2専用の統合テストが通る。
- 全体テスト、TypeScriptチェック、本番ビルドが通る。
