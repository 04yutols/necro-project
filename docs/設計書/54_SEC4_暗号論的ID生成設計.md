# 54. SEC-4 暗号論的ID生成設計

作成日: 2026-05-24
対象: `src/services/RewardService.ts` / `src/services/RewardService.test.ts`
ステータス: 実装済み

---

## 1. 背景

ドロップ報酬のインスタンスID生成に `Date.now()` と `Math.random()` が使われていた。

```ts
return `res_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
id: `${master.id}_${Date.now()}_${Math.floor(rng() * 1e5)}`;
id: `${mat.id}_${Date.now()}`;
```

`Math.random()` は暗号論的に安全ではなく、`Date.now()` は高負荷時に同一ミリ秒で衝突する可能性がある。ドロップ武器や深淵の残滓はDB保存されるため、ID衝突は一意制約違反や報酬消失につながる。

---

## 2. 対応方針

### 2.1 ID生成と抽選乱数の分離

`RewardService.processDropTable()` の `rng` はドロップ率、残滓ステータス、サブオプションなどゲーム抽選のために残す。インスタンスIDはゲーム抽選とは別の暗号論的乱数で生成する。

これにより、テスト用の決定論的 `rng` を使っても、永続IDだけは衝突耐性を保つ。

### 2.2 Web Crypto優先

サーバーとiOSブラウザの両方で動作させるため、Node専用の `crypto` import ではなく `globalThis.crypto` を使う。

優先順:

1. `globalThis.crypto.randomUUID()`
2. `globalThis.crypto.getRandomValues()` によるUUID v4生成
3. どちらもない場合は明示的にエラー

`Math.random()` へのフォールバックは行わない。

---

## 3. ID形式

既存のUIやテストがアイテム種別のprefixを見ているため、prefixは維持する。

| 種別 | 新形式 |
|---|---|
| 武器 | `${master.id}_${uuid}` |
| 深淵の残滓 | `res_${uuid}` |
| 残滓素材 | `${material.id}_${uuid}` |

UUIDは標準的な36文字のUUID v4形式。

---

## 4. 実装詳細

### 4.1 `secureUuid()`

```ts
function secureUuid(): string {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  const getRandomValues = globalThis.crypto?.getRandomValues?.bind(globalThis.crypto);
  if (!getRandomValues) {
    throw new Error('Secure random ID generation requires Web Crypto API.');
  }

  const bytes = new Uint8Array(16);
  getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  ...
}
```

`randomUUID()` 非対応環境でも、`getRandomValues()` があればUUID v4のversion/variant bitを設定して生成する。

### 4.2 `generateInstanceId(prefix)`

```ts
function generateInstanceId(prefix: string): string {
  return `${prefix}_${secureUuid()}`;
}
```

`RewardService` 内の武器、残滓、素材IDはすべてこの関数を通す。

---

## 5. 非対象

以下の `Math.random()` はゲーム抽選・戦闘・VFX用途であり、SEC-4の永続ID生成リスクとは別扱い。

- `BattleEngine` / `BattleDamage` の命中・会心・ターゲット抽選
- `StatusAilmentSystem` の状態異常付与判定
- Pixi / Canvas / Audio の演出粒子ノイズ
- テストメール suffix 生成

これらは「予測されても所有資産やDB主キーを直接作らない」用途のため、本対応では変更しない。

---

## 6. テスト設計

追加・更新テスト: `src/services/RewardService.test.ts`

検証内容:

1. 武器、残滓、素材のIDがprefixを維持する。
2. 生成IDがUUID形式を含む。
3. `Date.now()` を固定してもIDに時刻が入らない。
4. `Math.random()` を固定・監視してもID生成に呼ばれない。
5. 同一ドロップ内の複数IDが重複しない。

---

## 7. 完了条件

- `RewardService` の永続報酬ID生成から `Date.now()` と `Math.random()` が消えている。
- `Math.random()` へのフォールバックがない。
- iOSブラウザ互換のWeb Crypto経路がある。
- 専用テスト、全体テスト、TypeScriptチェック、本番ビルドが通る。
