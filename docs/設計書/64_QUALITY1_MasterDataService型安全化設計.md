# 64 — QUALITY-1 MasterDataService 型安全化設計

> 対象: `src/services/MasterDataService.ts`  
> 対応日: 2026-05-26  
> 関連: `docs/progress/BUGS_AND_SECURITY.md` の `QUALITY-1`

---

## 1. 背景

`MasterDataService` は `src/data/master/*.json` を読む唯一のサービス境界である。職業、敵、武器、ステージ、スキルなどは `src/types/game.ts` の正典型を前提に、バトル、報酬、ログイン登録、ステージ進行で参照される。

QUALITY-1 では、このサービスの getter が `any` を返していたため、マスターデータの型誤りが呼び出し側へ伝播する問題を解消する。

---

## 2. 問題

旧実装:

```typescript
public getJob(id: string) {
  return (jobs as any)[id];
}
```

問題点:

| 観点 | 問題 |
|---|---|
| 型安全性 | `getJob()` などの戻り値が `any` になり、存在しないプロパティ参照もコンパイルで検出できない。 |
| 呼び出し側の防御 | `undefined` の可能性が型に出ないため、未定義データの扱いが曖昧になる。 |
| 保守性 | 新しいマスター項目を追加した際、`src/types/game.ts` との不整合が見えにくい。 |
| キャスト拡散 | `as JobData` / `as ItemData` が呼び出し側に散らばり、サービス境界の責務が薄い。 |

---

## 3. 設計方針

### 3.1 サービス境界で正典型へ寄せる

JSON import は `resolveJsonModule` により構造推論されるが、アプリの正典は `src/types/game.ts` である。`MasterDataService` 内で `Record<string, T>` に集約し、public method は明示的な戻り値型を持つ。

### 3.2 単体取得は `T | undefined`

キー指定の getter は存在しないIDを渡される可能性があるため、以下の形に統一する。

```typescript
public getJob(id: string): JobData | undefined;
public getStage(id: string): StageData | undefined;
```

呼び出し側は `if (!stage)` や fallback job で明示的に扱う。

### 3.3 全件取得は `Record<string, T>`

一覧 getter はマスターデータ全体を返すため、以下の形に統一する。

```typescript
public getAllSkills(): Record<string, SkillData>;
```

### 3.4 `monsters.json` のID補完

`monsters.json` はキーがIDで、値オブジェクトには `id` がない。`MonsterData` は `id` 必須なので、サービス境界でキーを `id` として補完する。

```typescript
function withMonsterId(id: string, monster: MonsterMasterEntry): MonsterData {
  return { ...monster, id: monster.id ?? id };
}
```

---

## 4. 実装詳細

### 4.1 型付きRecord

`MasterDataService.ts` に以下を追加する。

- `MasterRecord<T> = Record<string, T>`
- `JOBS: MasterRecord<JobData>`
- `ENEMIES: MasterRecord<EnemyData>`
- `ITEMS: MasterRecord<ItemData>`
- `STAGES: MasterRecord<StageData>`
- `SKILLS: MasterRecord<SkillData>`
- `DEMON_FORMS: MasterRecord<DemonFormData>`
- `MATERIALS: MasterRecord<ResidueMatData>`
- `MONSTERS: MasterRecord<MonsterMasterEntry>`

`MonsterMasterEntry` は `id` が省略可能なマスターJSON用内部型とする。

### 4.2 public API

全 getter に戻り値型を付ける。

| メソッド | 戻り値 |
|---|---|
| `getJob(id)` | `JobData | undefined` |
| `getMonster(id)` | `MonsterData | undefined` |
| `getEnemy(id)` | `EnemyData | undefined` |
| `getItem(id)` | `ItemData | undefined` |
| `getStage(id)` | `StageData | undefined` |
| `getSkill(id)` | `SkillData | undefined` |
| `getDemonForm(jobId)` | `DemonFormData | undefined` |
| `getMaterial(id)` | `ResidueMatData | undefined` |
| `getAllXxx()` | `Record<string, XxxData>` |

### 4.3 呼び出し側のキャスト削減

型付き getter にしたことで、以下の不要キャストを削除する。

- `RewardService` の `getItem()` 結果に対する `as ItemData | undefined`
- `actions.ts` の `getJob()` / `getItem()` 結果に対する `as JobData` / `as ItemData`
- `GameManager` の職業カテゴリ fallback に対する `as any`

---

## 5. テスト設計

### 5.1 コンパイル時テスト

`MasterDataService.test.ts` に `IsAny<T>` 型を置き、各getterの `ReturnType` が `any` ではないことをコンパイル時に検証する。

```typescript
type IsAny<T> = 0 extends (1 & T) ? true : false;
type AssertFalse<T extends false> = T;
type _GetJobIsNotAny = AssertFalse<IsAny<ReturnType<MasterDataService['getJob']>>>;
```

### 5.2 ランタイムテスト

| ケース | 期待 |
|---|---|
| 単体 getter | 代表IDで正しい型のデータが返る |
| 欠損ID | `undefined` が返る |
| `getMonster()` | JSONキーが `MonsterData.id` として補完される |
| `getAllXxx()` | `Record<string, XxxData>` として参照できる |

---

## 6. 対象外

- JSON Schema / Zod による実行時バリデーション。
- マスターデータのDB移行。
- `actions.ts` や `GameManager.ts` に残るDB由来データの `any` 排除。
- `MasterDataService` のキャッシュ更新・ホットリロード対応。

---

## 7. 完了条件

- `MasterDataService` の public getter が `any` を返さない。
- `MasterDataService.test.ts` が通る。
- `npx tsc --noEmit` が通る。
- 全体 Jest と production build が通る。
