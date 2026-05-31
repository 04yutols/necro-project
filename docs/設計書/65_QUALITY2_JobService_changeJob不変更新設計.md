# 65 — QUALITY-2 JobService.changeJob 不変更新設計

> 対象: `src/services/JobService.ts`  
> 対応日: 2026-05-27  
> 関連: `docs/progress/BUGS_AND_SECURITY.md` / `docs/progress/IMPROVEMENTS.md` の `QUALITY-2`

---

## 1. 背景

`JobService.changeJob()` は2つの経路を持つ。

| 経路 | 入力 | 目的 |
|---|---|---|
| DB永続化 | `characterId: string` | Prisma transaction で `UserJob` 作成と `Character.currentJobId` 更新を行う |
| インメモリ | `character: CharacterData` | テストやクライアント寄りロジックで転職後の `CharacterData` を計算する |

QUALITY-2 はインメモリ経路が渡された `CharacterData` を直接書き換えていた問題への対応である。

---

## 2. 問題

旧実装:

```typescript
if (typeof characterOrId !== 'string') {
  const character = characterOrId;
  character.jobs.push({ jobId: nextJobId, level: 1, exp: 0 });
  character.currentJobId = nextJobId;
  character.category = jobData.category;
  character.stats = calculateJobAdjustedStats(baseStats, jobData);
  return;
}
```

問題点:

| 観点 | 問題 |
|---|---|
| 状態管理 | Zustand などの参照中オブジェクトをサービス層が直接変えると、意図しないレンダリング漏れや状態汚染が起こる。 |
| テスト容易性 | 入力と出力が同じ参照になるため、純粋な転職結果と副作用を切り分けにくい。 |
| 保守性 | `jobs.push()` のような局所変異が増えると、転職前後の差分確認が難しくなる。 |
| APIの曖昧さ | DB更新経路は `void` でよいが、インメモリ経路は更新後データを返すべきだった。 |

---

## 3. 設計方針

### 3.1 DB経路は既存互換を維持

`changeJob(characterId, jobId): Promise<void>` は既存の Server Action / GameManager / integration test から利用されているため、戻り値と永続化手順を変更しない。

### 3.2 インメモリ経路は新しい `CharacterData` を返す

overload を追加し、入力型ごとに戻り値を分ける。

```typescript
public async changeJob(character: CharacterData, nextJobId: string): Promise<CharacterData>;
public async changeJob(characterId: string, nextJobId: string): Promise<void>;
```

呼び出し側は `const next = await changeJob(character, jobId)` として、返り値をストアへ反映する。

### 3.3 参照をコピーする

インメモリ転職では以下を新しい参照として返す。

- `jobs`
- `baseStats`
- `stats`
- `passives`
- `equipment`
- `baseResistances`
- `clearedStages`
- `statusEffects`
- `elementDmgBoosts`

装備アイテムなどの実体はこの処理で変更しないため、深いマスターデータコピーは対象外とする。

---

## 4. 実装詳細

### 4.1 `buildChangedCharacter()`

`changeJob()` のインメモリ分岐を、戻り値生成専用メソッドへ分離する。

```typescript
private buildChangedCharacter(
  character: CharacterData,
  nextJobId: string,
  jobData: JobData,
): CharacterData
```

処理:

1. `character.jobs.map(job => ({ ...job }))` で職業状態をコピーする。
2. 未所持職業なら `{ jobId: nextJobId, level: 1, exp: 0 }` をコピー後配列に追加する。
3. `baseStats` は `character.baseStats ?? character.stats` をコピーする。
4. 職業補正後ステータスを `calculateJobAdjustedStats(baseStats, jobData)` で再計算する。
5. SPは既存挙動と同じく、新しい `maxEnergy` を超える場合だけ現在値を丸める。

### 4.2 解放条件

解放条件チェックは既存通り `getJobUnlockStatus(character, jobData)` を使う。ロック職業や不正職業IDの場合、入力キャラクターは変更されない。

---

## 5. テスト設計

| ケース | 期待 |
|---|---|
| 新規職業へ転職 | 返り値は新しい `CharacterData`、職業Lv1が追加される |
| 入力不変性 | `mockCharacter.currentJobId` / `jobs` / `stats` が元のまま |
| 永続パッシブ | `onLevelUp()` 後の `passives` が転職結果にも残る |
| 参照分離 | 返り値の `jobs` / `stats` / `passives` が入力と別参照 |
| DB経路 | 既存 integration test で `characterId` 経路が引き続きDB保存される |

---

## 6. 対象外

- `onLevelUp(character: CharacterData, ...)` の不変更新化。
- DB transaction 内の `any` 型削減。
- Zustand `useGameStore.changeJob()` の全面置換。
- 職業解放条件の仕様変更。

---

## 7. 完了条件

- `changeJob(CharacterData, jobId)` が入力を直接変異しない。
- `changeJob(string, jobId)` のDB保存経路が既存通り動く。
- `JobService.test.ts` と integration test が通る。
- `npx tsc --noEmit` / 全体 Jest / production build が通る。
