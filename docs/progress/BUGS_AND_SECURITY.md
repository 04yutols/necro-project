# バグ & セキュリティリスク 監査レポート

> 調査対象: `src/` 以下の全ソースファイル  
> 調査日: 2026-05-24  
> 深刻度凡例: 🔴 Critical / 🟠 High / 🟡 Medium / 🟢 Low

---

## セキュリティリスク

### ✅ SEC-1: 認証なしのスタブ Server Actions（2026-05-24 完了）

**旧ファイル位置:** `src/app/actions.ts:901–918`
**対応後:** `src/app/actions.ts:930–1044`

以下の Server Action が認証チェックを持たず、ダミー実装のまま公開されていた。

```typescript
// soulStoneAction — 認証なし、DB 非接続、固定値を返す
export async function soulStoneAction(monsterId: string) {
  const id = `shard-${Math.random().toString(36).substr(2, 9)}`;
  return { success: true, data: { id, originMonsterName: 'Goblin', effect: {...} } };
}

// equipShardAction — 認証なし、何もしない
export async function equipShardAction(monsterId: string, shardId: string) {
  return { success: true };
}

// processGrowthAction — 認証なし、何もしない
export async function processGrowthAction(characterId: string, type: ...) {
  return { success: true, message: `${type} completed.` };
}
```

**影響:** 任意のユーザーがこれらのエンドポイントを呼び出してクライアント側の状態を書き換えられる。`soulStoneAction` は `monsterId` を検証せず、`originMonsterName` が常に `'Goblin'` になるため実装と乖離している。

**修正:** 各 Action に `auth()` セッション確認を追加し、DB 操作を実装した。

**対応内容:**
- `processGrowthAction` を `processGrowthForUser` 経由の認証・所有者確認つきランクアップ処理へ変更。
- `soulStoneAction` を認証・所有者確認つきの `SoulShard` 作成 + 元 `Monster` 削除処理へ変更。
- `equipShardAction` を認証・所有者確認つきの `Monster.soulShardId` 更新処理へ変更。
- `SoulShard.characterId` を追加し、魂片の所有権をDBで検証できるようにした。
- `src/tests/sec1-server-actions.integration.test.ts` で未ログイン拒否、越権拒否、魂石化、魂片装備、ランクアップを確認。

**設計:** `docs/設計書/49_SEC1_認証付きServerActions設計.md`

---

### ✅ SEC-2: `fetchPlayerAction` の IDOR リスク（2026-05-24 完了）

**旧ファイル位置:** `src/app/actions.ts:908–919`

**対応後:** `src/app/actions.ts:896–947`

```typescript
export async function fetchPlayerAction(characterId: string) {
  const session = await auth().catch(() => null);
  if (!session?.user?.id) return { success: false, error: 'ログインが必要です' };
  return fetchPlayerForUser(toServerUser(session.user), characterId);
}
```

任意の `characterId` を渡してもハードコードされたデータを返す。現在はスタブだが、将来 DB 参照を追加する際に認証チェックを忘れると他ユーザーのデータが取得できる IDOR 脆弱性になる。

**修正:** `auth()` と `Character.userId` による所有者確認を追加し、ハードコードのプレイヤーモックをDB由来の `CharacterData` へ置換した。

**対応内容:**
- `fetchPlayerAction` を認証必須に変更。
- `fetchPlayerForUser` を追加し、既存Action群と同じ `getAuthorizedUser(user.id)` でセッション一致を検証。
- `prisma.character.findFirst({ where: { id: characterId, userId: authorizedUser.id } })` により、他ユーザーのキャラクター取得を拒否。
- `loadCharacterForUser` と同じ `CHARACTER_GAME_DATA_INCLUDE` / `toServerGameData` 経路で実データを返却。
- `src/tests/sec2-fetch-player-action.integration.test.ts` で未ログイン拒否、自キャラ取得、越権拒否、DB実データ反映を確認。

**設計:** `docs/設計書/52_SEC2_fetchPlayerAction_IDOR設計.md`

---

### 🟠 SEC-3: `GameManager.updateParty` が DB に保存しない

**ファイル:** `src/logic/GameManager.ts:258`

```typescript
// コスト計算後、実際の保存は行われない
console.log(`Party updated for ${characterId}: ${monsterIds.join(', ')}`);
```

本来は `actions.ts` の `updatePartyForUser` が正しい実装を持つが、`GameManager` から直接呼ばれるパスではパーティ変更が永続化されない。

---

### 🟠 SEC-4: 非暗号論的乱数によるID生成

**ファイル:** `src/app/actions.ts:906`, `src/services/RewardService.ts:88`

```typescript
// actions.ts — Math.random() によるシャードID
const id = `shard-${Math.random().toString(36).substr(2, 9)}`;

// RewardService.ts — Date.now() + Math.random() による残滓ID
return `res_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
```

`Math.random()` は暗号論的に安全でない。高負荷時に `Date.now()` が衝突し、同一のIDが生成される可能性がある（DB の一意制約違反）。

**修正:** `crypto.randomUUID()` または `nanoid` を使用する。

---

### 🟠 SEC-5: ドロップ率のボーナス計算に`critRate`を誤用

**ファイル:** `src/logic/GameManager.ts:139`, `src/services/RewardService.ts:134`

```typescript
// GameManager — char.critRate をドロップボーナスとして渡している
const rewards = this.rewardService.processDropTable(stage.rewards.dropTable, char.critRate ?? 5);

// RewardService — multiplier > 1 になるとドロップ率が 100% を超える
const multiplier = 1 + discoveryBonusRate / 100;
if (roll >= entry.rate * multiplier) continue; // entry.rate * multiplier > 1 → 必ずドロップ
```

`critRate` は戦闘の会心率であり、ドロップ率とは無関係。`critRate = 50` の場合、`multiplier = 1.5` となり `entry.rate = 1.0` のアイテムが必ず落ちる。`actions.ts` の正規パスでは `discoveryBonusRate` を渡さないため問題が表面化しにくい。

---

### 🟡 SEC-6: JWT セッションの失効不可

**ファイル:** `src/auth.ts:33`

```typescript
session: { strategy: 'jwt', maxAge: 60 * 60 * 24 },
```

JWT セッションはサーバー側でブラックリスト管理をしない限り無効化できない。パスワード変更やアカウント削除後も 24時間はトークンが有効なまま残る。

**修正:** 重要操作時は再認証を要求するか、Redis によるセッション管理に移行する。

---

### 🟡 SEC-7: パスワードポリシーが弱い

**ファイル:** `src/services/AuthService.ts:30`

```typescript
if (password.length < 8) {
  return { success: false, error: 'パスワードは8文字以上にしてください' };
}
```

8文字最低限のみで、大文字・数字・記号の要件がない。ブルートフォース攻撃への耐性が低い。

**修正:** 最低12文字、または数字・記号を含む複合要件を追加する。

---

## ロジックバグ

### ✅ BUG-1: プレイヤーが絶対に死なない（2026-05-24 完了）

**旧ファイル位置:** `src/logic/BattleEngine.ts:535`
**対応後:** `src/logic/BattleEngine.ts:106–143`, `src/logic/BattleEngine.ts:350–356`, `src/logic/BattleEngine.ts:552–561`, `src/logic/BattleEngine.ts:754–767`, `src/logic/BattleEngine.ts:803–834`

```typescript
// モンスター全滅時にアルドが直接攻撃を受けるが...
ms.hp = Math.max(1, ms.hp - rawDmg);  // ← HPが1未満にならない
```

`PlayerDefeat.ts` に `applyPlayerDamage()` と `isPlayerDead()` が実装されているにも関わらず、`BattleEngine` は `Math.max(1, ...)` でHP下限を1に固定している。プレイヤーは永遠に死なないためゲームオーバーが発生しない。

**修正:** `BattleEngine` のプレイヤーHP減算を `PlayerDefeat.applyPlayerDamage()` に統一し、HP 0 到達時に `PLAYER_DEFEATED` ログを出して後続フェーズを停止するようにした。

**対応内容:**
- 敵の直接攻撃、魔神化反動、状態異常ダメージ、エリアスリップダメージを敗北判定へ接続。
- `Math.max(1, ...)` による不死化を削除し、HP は 0 まで減る。
- 敗北ログは1ターン中1回だけ出るよう `playerDefeatLogged` で制御。
- `BattleEngine.test.ts` に「敵直接攻撃で死亡」「状態異常で死亡して行動停止」のテストを追加。

**設計:** `docs/設計書/50_BUG1_BattleEngine敗北判定設計.md`

---

### 🔴 BUG-2: ステータス異常ダメージが「現在HP」を maxHp として計算する

**ファイル:** `src/logic/BattleEngine.ts:773–775`

```typescript
const result = processStatusEffects(
  effects,
  { maxHp: targetStats.hp },  // ← targetStats.hp は現在HPであり最大HPではない
  Math.random,
```

`targetStats.hp` はバトル中に直接書き換えられているため（例: `targetStats.hp -= damage`）、POISON（最大HPの3%）や BURN（最大HPの5%）のダメージ計算が戦闘の進行とともに小さくなっていく。序盤は重いが後半は軽くなる意図しない挙動になる。

**修正:** `playerInitialMaxHp` をプレイヤー用として使い、敵には別途 `this.enemyMaxHp[target.id]` を参照する。

---

### ✅ BUG-3: EXP→レベル計算式がクライアントとサーバーで異なる（2026-05-24 完了）

**旧ファイル A (クライアント):** `src/store/useGameStore.ts:524`

```typescript
const newLevel = Math.floor(newExp / 100) + 1; // 簡易式
```

**旧ファイル B (サーバー):** `src/app/actions.ts:91–99`

```typescript
function expForLevel(n: number): number {
  return 50 * (n - 1) * (n + 8); // 正式な累積EXP式
}
function levelFromTotalExp(totalExp: number): number { ... }
```

**旧ファイル C (旧 GameManager):** `src/logic/GameManager.ts:147`

```typescript
const newLevel = Math.floor(newExp / 100) + 1; // 簡易式（サーバーとも不一致）
```

EXP=500 の場合、簡易式では Lv.6、正式式では Lv.2 になる。DB のレベルとクライアント表示が著しく乖離する。

**修正:** `src/logic/ExperienceSystem.ts` を追加し、`levelFromTotalExp()` を Server Actions / Zustand / 旧 GameManager で共有するようにした。

**対応内容:**
- `expForLevel()` / `levelFromTotalExp()` / `getJobLevelProgress()` を `ExperienceSystem` に集約。
- `src/app/actions.ts` のローカルEXP式を削除し、共通関数へ差し替え。
- `src/store/useGameStore.ts` の `addExp()` を正式な累積EXP式へ差し替え。
- `src/logic/GameManager.ts` の旧 `processStageResult()` も共通関数へ差し替え。
- `ExperienceSystem.test.ts` / `useGameStore.party.test.ts` / `account-progression.integration.test.ts` で共通式を検証。

**設計:** `docs/設計書/51_BUG3_EXPレベル計算統一設計.md`

---

### 🟠 BUG-4: `upgradeResidue` がマテリアルスタック全体を消費する

**ファイル:** `src/store/useGameStore.ts:425–446`

```typescript
// EXP計算: mat.quantity 分まとめて計算される
const expGain = matIds.reduce((acc, id) => {
  const mat = state.residueMaterials.find(m => m.id === id);
  return acc + (mat ? mat.expValue * mat.quantity : 0);
}, 0);

// 削除: IDが一致するスタック全体を削除
const remainingMaterials = state.residueMaterials.filter(m => !matIds.includes(m.id));
```

`matIds` に1つのIDを渡しても、そのマテリアルが `quantity: 5` を持っていれば EXP は5倍得られ、スタック全体が消える。「1個だけ使う」操作ができない。

---

### 🟠 BUG-5: BURN の免疫チェックが欠落

**ファイル:** `src/logic/StatusAilmentSystem.ts:201`

```typescript
if (effect.type === 'POISON') {
  damage = options?.immuneTypes?.includes('POISON') ? 0 : Math.floor(target.maxHp * 0.03);
}
if (effect.type === 'BURN') damage = Math.floor(target.maxHp * 0.05); // ← 免疫チェックなし
```

BLEED と POISON には `immuneTypes` チェックがあるが、BURN にはない。BURN 免疫を持つシナジーや装備がある場合、意図通りに機能しない。

---

### 🟠 BUG-6: 敵HP が共有オブジェクトを直接書き換える

**ファイル:** `src/logic/BattleEngine.ts:335, 489`

```typescript
target.stats.hp = Math.max(0, target.stats.hp - shieldResult.damage);
```

`target` は `MonsterData` オブジェクトへの参照であり、Zustand ストアや React コンポーネントと共有されている可能性がある。直接書き換えると参照を持つ全体に副作用が生じ、レンダリング問題やバトル終了後のHPリセット忘れを引き起こす。

**修正:** BattleEngine 内で `target` をコピーしてから書き換えるか、HPを `monsterCurrentHp` に一元管理する。

---

### 🟡 BUG-7: `getMutableStats` の不正なキャスト

**ファイル:** `src/logic/BattleEngine.ts:756`

```typescript
private getMutableStats(player: CharacterData): BaseStats {
  return ((player as any).stats ?? (player as any).baseStats) as BaseStats;
}
```

`any` キャストで TypeScript の型安全を回避している。`player.stats` は `BaseStats` 型として宣言されており、直接 `player.stats` を参照すれば十分。不要な `as any` は将来的なバグの温床になる。

---

### 🟡 BUG-8: プレイヤーが麻痺しても `skipAction` が上位で無視される可能性

**ファイル:** `src/logic/BattleEngine.ts:116–123`

```typescript
const playerStatus = this.processRuntimeStatus(player.name, player.stats, player.statusEffects);
player.statusEffects = playerStatus.effects;
if (playerStatus.skipAction) {
  this.addLog('STATUS_SKIP', ...);
  this.updateState();
  return this.logs;
}
```

プレイヤーが行動スキップになると `return this.logs` で早期終了するが、この後の「モンスターの追撃フェーズ」と「敵の反撃フェーズ」が実行されない。ゲームデザインによっては敵の反撃は発生すべきかもしれない。

---

### 🟡 BUG-9: `NecroStatus.exp` がテストモックから欠落

**ファイル:** `src/services/NecroService.test.ts:16–22`

```typescript
const mockNecroStatus: NecroStatus = {
  level: 1,
  rank: 1,
  maxCost: 10,
  baseStatsBonus: 1.0
  // exp フィールドが欠落（NecroStatus 型では必須）
};
```

`NecroStatus` 型に `exp: number` が追加されているが、テストのモックが更新されておらず TypeScript エラーになる。

---

### 🟡 BUG-10: 同一ターゲットへの全モンスター追撃

**ファイル:** `src/logic/BattleEngine.ts:471–495`

```typescript
private processMonsterActions(target: MonsterData): void {
  const { player, monsters } = this.state;
  monsters.forEach(monster => {
    // 全モンスターが同じ `target` を攻撃する
    target.stats.hp = Math.max(0, target.stats.hp - shieldResult.damage);
  });
}
```

複数の敵が存在するWAVEでも、プレイヤーが選択したターゲット以外には追撃が飛ばない。WAVE構成が複数敵になった場合に問題となる。

---

## パフォーマンス・品質上の懸念

### 🟢 PERF-1: 残滓シャッフルの Fisher-Yates 非準拠

**ファイル:** `src/services/RewardService.ts:105`

```typescript
const shuffled = [...available].sort(() => rng() - 0.5);
```

`Array.sort` による疑似シャッフルは分布が偏る（非 Fisher-Yates）。サブオプションの選出に偏りが生じる可能性がある。ゲームバランスへの影響は限定的だが公平性に関わる。

---

### 🟢 QUALITY-1: `MasterDataService` の全メソッドが `any` を返す

**ファイル:** `src/services/MasterDataService.ts:23–44`

```typescript
public getJob(id: string) {
  return (jobs as any)[id]; // 型情報なし
}
```

全ての `get*` メソッドが `any` を返すため、呼び出し側での型誤りがコンパイル時に検出されない。

---

### 🟢 QUALITY-2: `JobService.changeJob` のキャラクター直接変異

**ファイル:** `src/services/JobService.ts:32–44`

```typescript
if (typeof characterOrId !== 'string') {
  const character = characterOrId;
  character.jobs.push(...);     // 引数を直接変異
  character.currentJobId = ...; // 引数を直接変異
  return;
}
```

`CharacterData` オブジェクトを直接書き換えることで、Zustand ストアなど外部参照先のオブジェクトが予期しないタイミングで変化する可能性がある。

---

## 優先対応サマリー

| ID | 深刻度 | ファイル | 概要 |
|----|--------|----------|------|
| SEC-1 | ✅ | `actions.ts` | 2026-05-24 完了。認証・所有者確認・DB更新を実装 |
| BUG-1 | ✅ | `BattleEngine.ts` | 2026-05-24 完了。HP 0 到達と `PLAYER_DEFEATED` ログを実装 |
| BUG-2 | 🔴 | `BattleEngine.ts:773` | 状態異常ダメージが現在HP を maxHp として計算 |
| BUG-3 | ✅ | `ExperienceSystem.ts` | 2026-05-24 完了。EXP→レベル式を共通化 |
| SEC-2 | ✅ | `actions.ts` | 2026-05-24 完了。認証・所有者確認・DB実データ取得を実装 |
| SEC-3 | 🟠 | `GameManager.ts:258` | パーティ更新が DB に保存されない |
| SEC-4 | 🟠 | `actions.ts:906` | 非暗号乱数によるID生成 |
| SEC-5 | 🟠 | `GameManager.ts:139` | critRate をドロップボーナスに誤用 |
| BUG-4 | 🟠 | `useGameStore.ts:445` | 残滓強化でマテリアルスタック全消費 |
| BUG-5 | 🟠 | `StatusAilmentSystem.ts:201` | BURN の免疫チェック欠落 |
| BUG-6 | 🟠 | `BattleEngine.ts:335` | 敵HPオブジェクトの直接書き換え |
