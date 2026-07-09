# 63 — PERF-1 残滓シャッフル Fisher-Yates 準拠設計

> 対象: `src/services/RewardService.ts`  
> 対応日: 2026-05-26  
> 関連: `docs/progress/BUGS_AND_SECURITY.md` の `PERF-1`

---

## 1. 背景

深淵の残滓はドロップ時に以下の順で生成される。

1. 残滓スロットを抽選する。
2. スロットごとのメインステータスを抽選する。
3. レアリティごとのサブオプション数を抽選する。
4. メインステータスと同じ型を除外したサブオプション候補から、必要数を重複なしで選ぶ。
5. 各サブオプションの値をロールする。

PERF-1 は 4 の候補並べ替えが `Array.sort(() => rng() - 0.5)` だったことに対する修正である。

---

## 2. 問題

`Array.sort` にランダム比較関数を渡す疑似シャッフルには以下の問題がある。

| 観点 | 問題 |
|---|---|
| 公平性 | 全ての順列が等確率にならず、サブオプション候補の位置に偏りが出る。 |
| 実装依存 | sort の比較回数と比較順は JavaScript エンジンの実装に依存する。 |
| 再現性 | `rng` を注入しても消費回数が配列長や実行環境で読みづらく、決定論的テストが脆くなる。 |
| 意図の明確さ | シャッフルというゲーム仕様に対して sort comparator の副作用に依存している。 |

残滓サブオプションは装備厳選の中心要素であり、低優先度の品質課題であっても抽選公平性は保証する。

---

## 3. 設計方針

### 3.1 Fisher-Yates を使う

候補配列の末尾から先頭へ向かって、各 index `i` に対し `0..i` の交換先 `j` を1回だけ抽選する。

```typescript
export function shuffleFisherYates<T>(items: readonly T[], rng: () => number): T[] {
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}
```

### 3.2 入力配列は変更しない

`SUB_OPTION_POOL` はマスターデータ相当の定数であり、呼び出し側で破壊的に並べ替えない。`readonly T[]` を受け取り、内部でコピーを作る。

### 3.3 乱数注入を維持する

`RewardService.processDropTable()` はテストとリプレイ検証のために `rng` を受け取れる。Fisher-Yates も同じ `rng` を使用し、`Math.random()` を直接参照しない。

### 3.4 RNG 契約

`rng()` は `Math.random()` と同じく `0 <= value < 1` を返す前提とする。既存のドロップ率、スロット選択、値ロールと同じ契約に揃え、今回の修正では乱数値のクランプは追加しない。

---

## 4. 実装詳細

### 4.1 `RewardService.ts`

追加:

- `shuffleFisherYates<T>(items, rng)` を export する。
- 配列コピー上で Fisher-Yates を実行する。
- 長さ `n` の配列に対して `rng` 消費回数は常に `n - 1`。

変更:

```typescript
const available = SUB_OPTION_POOL.filter(s => s.type !== mainDef.type);
const shuffled = shuffleFisherYates(available, rng);
const subOptions = shuffled.slice(0, subCount).map(s => ({
  type: s.type,
  value: rollValue(s.range, rng),
}));
```

### 4.2 既存仕様との互換

| 仕様 | 変更有無 |
|---|---|
| メインステータスとサブオプションの型重複禁止 | 変更なし |
| レアリティごとのサブオプション数 | 変更なし |
| サブオプション値の range | 変更なし |
| `processDropTable()` の戻り値型 | 変更なし |
| ID生成の Web Crypto 方針 | 変更なし |

---

## 5. テスト設計

### 5.1 新規ユニットテスト

| ケース | 期待 |
|---|---|
| `shuffleFisherYates` が入力配列を変更しない | 元配列の順序が保持される |
| 注入 `rng` による決定論的順列 | 固定シーケンスで期待順序になる |
| RNG 消費回数 | 長さ `n` の配列で `n - 1` 回 |

### 5.2 既存回帰テスト

| ケース | 期待 |
|---|---|
| RARE / EPIC 残滓生成 | サブオプション数が設計範囲内 |
| 同一 rng seed | mainStat / subOptions が一致 |
| メインとサブの型重複なし | `mainStat.type` が subOptions に含まれない |
| `Math.random` 非依存 | ID以外の抽選も注入 rng で進む |

---

## 6. 対象外

- 暗号論的乱数によるドロップ抽選化。
- サブオプションの重み付き抽選。
- レアリティ別サブオプション pool の分離。
- 既存プレイヤー所持残滓の再抽選。

---

## 7. 完了条件

- `sort(() => rng() - 0.5)` が残滓抽選から消えている。
- Fisher-Yates helper の単体テストが通る。
- `RewardService.test.ts` の既存ドロップ回帰テストが通る。
- `npx tsc --noEmit` が通る。
