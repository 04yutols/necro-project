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

### ✅ SEC-3: `GameManager.updateParty` が DB に保存しない（2026-05-24 完了）

**旧ファイル位置:** `src/logic/GameManager.ts:258`

**対応後:** `src/logic/GameManager.ts:238–280`

```typescript
await tx.character.update({
  where: { id: char.id },
  data: {
    partySlot0Id: slotIds[0],
    partySlot1Id: slotIds[1],
    partySlot2Id: slotIds[2],
  },
});
```

本来は `actions.ts` の `updatePartyForUser` が正しい実装を持つが、`GameManager` から直接呼ばれるパスではパーティ変更が永続化されない。

**修正:** `GameManager.updateParty()` を既存 `Character.partySlot0Id` / `partySlot1Id` / `partySlot2Id` へ保存する実装に変更した。

**対応内容:**
- 3枠固定、重複禁止、存在確認、キャラクター所有魔物のみ、コスト上限を検証。
- 検証とDB保存を1トランザクション内で実行。
- 失敗時に既存パーティを上書きしないことをテストで確認。
- `src/logic/GameManager.test.ts` で保存、重複拒否、越権魔物拒否、コスト超過拒否、3枠ルールを検証。

**設計:** `docs/設計書/53_SEC3_GameManager_updateParty永続化設計.md`

---

### ✅ SEC-4: 非暗号論的乱数によるID生成（2026-05-24 完了）

**旧ファイル位置:** `src/app/actions.ts:906`, `src/services/RewardService.ts:88`

**対応後:** `src/services/RewardService.ts`

```typescript
function generateInstanceId(prefix: string): string {
  return `${prefix}_${secureUuid()}`;
}
```

`Math.random()` は暗号論的に安全でない。高負荷時に `Date.now()` が衝突し、同一のIDが生成される可能性がある（DB の一意制約違反）。

**修正:** `RewardService` の武器、深淵の残滓、素材のインスタンスID生成を `globalThis.crypto.randomUUID()` / `getRandomValues()` ベースへ変更した。`Math.random()` へのフォールバックは行わない。

**対応内容:**
- `secureUuid()` を追加し、Web CryptoでUUID v4を生成。
- `generateInstanceId(prefix)` を追加し、既存prefixを維持したまま暗号論的IDへ移行。
- `RewardService.generateResidueId()`、武器ID、素材IDの `Date.now()` / `Math.random()` 依存を削除。
- `src/services/RewardService.test.ts` で `Date.now()` と `Math.random()` に依存しないこと、UUID形式、重複なしを確認。

**設計:** `docs/設計書/54_SEC4_暗号論的ID生成設計.md`

---

### ✅ SEC-5: ドロップ率のボーナス計算に`critRate`を誤用（2026-05-24 完了）

**旧ファイル位置:** `src/logic/GameManager.ts:139`, `src/services/RewardService.ts:134`

**対応後:** `src/logic/GameManager.ts`, `src/services/RewardService.ts`

```typescript
const rewards = this.rewardService.processDropTable(stage.rewards.dropTable);

const adjustedRate = clampDropRate(entry.rate * multiplier);
if (roll >= adjustedRate) continue;
```

`critRate` は戦闘の会心率であり、ドロップ率とは無関係。`critRate = 50` の場合、`multiplier = 1.5` となり `entry.rate = 1.0` のアイテムが必ず落ちる。`actions.ts` の正規パスでは `discoveryBonusRate` を渡さないため問題が表面化しにくい。

**修正:** 旧 `GameManager.processStageResult()` から `critRate` のドロップ補正流用を削除し、`RewardService` 側でも最終ドロップ率を `0..1` にクランプするようにした。

**対応内容:**
- `GameManager.processStageResult()` は `processDropTable(stage.rewards.dropTable)` を呼ぶ。
- `RewardService` に `clampDropRate()` を追加し、`entry.rate * multiplier` の結果を確率範囲に丸める。
- `src/logic/GameManager.test.ts` で `critRate = 100` でもドロップ率が上がらないことを確認。
- `src/services/RewardService.test.ts` で `discoveryBonusRate` が100%超の確率を作らないことを確認。

**設計:** `docs/設計書/55_SEC5_ドロップ率ボーナスcritRate分離設計.md`

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

### ✅ BUG-4: `upgradeResidue` がマテリアルスタック全体を消費する（2026-05-24 完了）

**旧ファイル位置:** `src/store/useGameStore.ts:425–446`

**対応後:** `src/store/useGameStore.ts`, `src/components/legion/LegionHub.tsx`, `src/components/necro/NecroLab.tsx`

```typescript
const spent = spendResidueMaterials(state.residueMaterials, matIds);
if (spent.expGain <= 0) return state;
```

`matIds` に1つのIDを渡しても、そのマテリアルが `quantity: 5` を持っていれば EXP は5倍得られ、スタック全体が消える。「1個だけ使う」操作ができない。

**修正:** `matIds` の1要素を「素材1個の消費リクエスト」として扱い、消費できた個数ぶんだけEXPを付与するようにした。

**対応内容:**
- `spendResidueMaterials()` を追加し、素材IDの出現回数と所持数から消費数を決定。
- 1回選択では `quantity` を1だけ減らし、0になった場合のみスタックを削除。
- 同じIDを複数回渡しても、所持数を超えるEXPは付与しない。
- `LegionHub` / `NecroLab` の強化プレビューと一括選択を「1カード=1個消費」に合わせた。
- `src/store/useGameStore.party.test.ts` で1個消費、装備中残滓同期、過剰要求時の上限制御を確認。

**設計:** `docs/設計書/56_BUG4_残滓強化素材スタック消費設計.md`

---

### ✅ BUG-5: BURN の免疫チェックが欠落

**ファイル:** `src/logic/StatusAilmentSystem.ts:199`

```typescript
if (effect.type === 'POISON') {
  damage = isImmune ? 0 : Math.floor(target.maxHp * 0.03);
}
if (effect.type === 'BURN') damage = isImmune ? 0 : Math.floor(target.maxHp * 0.05);
```

既存実装では BLEED と POISON には `immuneTypes` チェックがあるが、BURN にはなかった。BURN 免疫を持つシナジーや装備がある場合、意図通りに機能しない。

**修正:** 各状態異常処理の先頭で `effect.type` 基準の `isImmune` を算出し、BLEED / POISON / BURN のDoTダメージ判定を共通化した。

**対応内容:**
- BURN の持続ダメージが `immuneTypes: ['BURN']` で0になるよう修正。
- 免疫時も残りターンは通常通り減らし、状態異常の自然経過を維持。
- ダメージ0の tick は出さず、UI側に不要な0ダメージ演出を流さない。
- `StatusAilmentSystem.test.ts` にBURN免疫とDoT免疫一貫性の回帰テストを追加。

**設計:** `docs/設計書/57_BUG5_BURN免疫チェック設計.md`

---

### ✅ BUG-6: 敵HP が共有オブジェクトを直接書き換える

**ファイル:** `src/logic/BattleEngine.ts`

```typescript
const hpChange = this.applyDamageToEnemy(target, shieldResult.damage);
```

`target` は `MonsterData` オブジェクトへの参照であり、Zustand ストアや React コンポーネントと共有されている可能性がある。直接書き換えると参照を持つ全体に副作用が生じ、レンダリング問題やバトル終了後のHPリセット忘れを引き起こす。

**修正:** 敵HPを `enemyCurrentHp` / `enemyMaxHp` のランタイムマップに分離し、`MonsterData.stats.hp` は最大HPスナップショットとして維持する。

**対応内容:**
- `BattleState` に `enemyCurrentHp` / `enemyMaxHp` を追加。
- プレイヤー攻撃、魔神技、味方魔物追撃、武器パッシブ追加ダメージを `applyDamageToEnemy()` に統一。
- `REVIVE` は `boss.stats.hp` を書き換えず、ランタイム現在HPだけを回復する。
- `BattleEngine.test.ts` で敵HP非破壊、連続攻撃のランタイムHP継続、REVIVE挙動を確認。

**設計:** `docs/設計書/58_BUG6_敵HPランタイム分離設計.md`

---

### ✅ BUG-7: `getMutableStats` の不正なキャスト

**ファイル:** `src/logic/BattleEngine.ts:826`

```typescript
private getMutableStats(player: CharacterData): BaseStats {
  return player.stats;
}
```

`any` キャストで TypeScript の型安全を回避している。`player.stats` は `BaseStats` 型として宣言されており、直接 `player.stats` を参照すれば十分。不要な `as any` は将来的なバグの温床になる。

**修正:** BattleEngineの入力契約を正規化済み `CharacterData` に固定し、プレイヤーのランタイムHP更新対象を `stats` に一本化した。

**対応内容:**
- `getMutableStats()` から `as any` と `baseStats` フォールバックを削除。
- `baseStats` は職業変更・成長計算元として維持し、BattleEngineでは更新対象にしないことを設計化。
- `BattleEngine.test.ts` に `stats.hp` のみが戦闘で減り、`baseStats.hp` が維持される回帰テストを追加。

**設計:** `docs/設計書/59_BUG7_getMutableStats型安全化設計.md`

---

### ✅ BUG-8: プレイヤーが麻痺しても `skipAction` が上位で無視される可能性

**ファイル:** `src/logic/BattleEngine.ts:116–145`

```typescript
const playerStatus = this.processRuntimeStatus(player.name, player.stats, player.statusEffects);
player.statusEffects = playerStatus.effects;
if (playerStatus.skipAction) {
  this.addLog('STATUS_SKIP', ...);
  playerActionSkipped = true;
}
```

プレイヤーが行動スキップになると `return this.logs` で早期終了するが、この後の「モンスターの追撃フェーズ」と「敵の反撃フェーズ」が実行されない。ゲームデザインによっては敵の反撃は発生すべきかもしれない。

**修正:** `skipAction` はプレイヤー行動と行動後追撃だけを止め、敵の反撃フェーズとターン進行は継続するようにした。

**対応内容:**
- `simulateAction()` に `playerActionSkipped` フラグを追加。
- 麻痺/凍結などで行動不能の場合、`processPlayerAction()` と `processMonsterActions()` をスキップ。
- 敵反撃 `processEnemyCounterAttack()` は通常通り実行。
- `BattleEngine.test.ts` に麻痺時の `STATUS_SKIP`、攻撃なし、追撃なし、敵反撃あり、SP増加なしの回帰テストを追加。

**設計:** `docs/設計書/60_BUG8_状態異常行動スキップターン進行設計.md`

---

### ✅ BUG-9: `NecroStatus.exp` がテストモックから欠落

**ファイル:** `src/services/NecroService.test.ts:16–22`

```typescript
const createNecroStatus = (overrides: Partial<NecroStatus> = {}): NecroStatus => ({
  level: 1,
  rank: 1,
  maxCost: 10,
  baseStatsBonus: 1.0,
  exp: 0,
  ...overrides,
});
```

`NecroStatus` 型に `exp: number` が追加されているが、テストのモックが更新されておらず TypeScript エラーになる。

**修正:** `NecroService.test.ts` の `NecroStatus` モックを `createNecroStatus()` ファクトリへ集約し、全モックに `exp` を含めた。

**対応内容:**
- `mockNecroStatus` とRankUp用ステータスを `createNecroStatus()` で生成。
- RankUp成功テストで `exp: 999` が `exp: 0` にリセットされることを確認。
- `docs/設計書/04_データモデル.md` / `05_死霊術システム.md` / `08_テスト戦略.md` の `NecroStatus` 例を `exp` ありに更新。

**設計:** `docs/設計書/61_BUG9_NecroStatus_expテストモック整合設計.md`

---

### ✅ BUG-10: 同一ターゲットへの全モンスター追撃

**ファイル:** `src/logic/BattleEngine.ts:491–545`, `src/components/battle/BattleCanvas.tsx`

```typescript
private processMonsterActions(preferredTarget: MonsterData, enemyCandidates: MonsterData[]): void {
  // 生存敵を preferredTarget 起点で並べ、followUpIndex でローテーションする
  const target = this.selectFollowUpTarget(preferredTarget, enemyCandidates, followUpIndex);
}
```

複数の敵が存在するWAVEでも、プレイヤーが選択したターゲット以外には追撃が飛ばない。WAVE構成が複数敵になった場合に問題となる。

**修正:** 追撃対象候補 `enemyCandidates` を導入し、複数敵が生存している場合は追撃ごとに対象をローテーションするようにした。

**対応内容:**
- `BattleEngine.simulateAction()` に任意の `enemyCandidates` を追加し、既存単体敵呼び出しは互換維持。
- `resolveEnemyCandidates()` / `selectFollowUpTarget()` を追加。
- プレイヤー選択敵を先頭優先にしつつ、生存敵へ追撃を A/B/C の順で分散。
- 選択敵がプレイヤー攻撃で倒れた場合、生存敵へ追撃を再選択。
- UI側 `BattleCanvas.runPartyFollowUps()` も同じローテーションルールへ更新。
- `BattleEngine.test.ts` に複数敵分散と選択敵撃破後リターゲットの回帰テストを追加。

**設計:** `docs/設計書/62_BUG10_軍団追撃ターゲット分散設計.md`

---

## パフォーマンス・品質上の懸念

### ✅ PERF-1: 残滓シャッフルの Fisher-Yates 非準拠（2026-05-26 完了）

**旧ファイル位置:** `src/services/RewardService.ts:105`
**対応後:** `src/services/RewardService.ts`

```typescript
const shuffled = shuffleFisherYates(available, rng);
```

`Array.sort` による疑似シャッフルは分布が偏る（非 Fisher-Yates）。サブオプションの選出に偏りが生じる可能性がある。ゲームバランスへの影響は限定的だが公平性に関わる。

**修正:** 残滓サブオプション候補の並べ替えを Fisher-Yates に変更した。

**対応内容:**
- `shuffleFisherYates<T>()` を追加し、入力配列を破壊しないコピー上でシャッフルするようにした。
- `processDropTable()` から注入された `rng` をそのまま使い、`Math.random()` へ依存しない決定論的抽選を維持。
- 長さ `n` の候補配列で `rng` 呼び出しが常に `n-1` 回になるため、テストとリプレイ検証の再現性が向上。
- `RewardService.test.ts` に Fisher-Yates の順列、非破壊性、rng 消費回数のテストを追加。

**設計:** `docs/設計書/63_PERF1_残滓シャッフルFisherYates設計.md`

---

### ✅ QUALITY-1: `MasterDataService` の全メソッドが `any` を返す（2026-05-26 完了）

**旧ファイル位置:** `src/services/MasterDataService.ts:23–44`
**対応後:** `src/services/MasterDataService.ts`

```typescript
public getJob(id: string): JobData | undefined {
  return JOBS[id];
}
```

全ての `get*` メソッドが `any` を返すため、呼び出し側での型誤りがコンパイル時に検出されない。

**修正:** `MasterDataService` のJSON境界を `src/types/game.ts` の正典型へ集約し、全 public getter に明示的な戻り値型を付けた。

**対応内容:**
- `JobData` / `MonsterData` / `EnemyData` / `ItemData` / `StageData` / `SkillData` / `DemonFormData` / `ResidueMatData` の型付き `Record<string, T>` を導入。
- 単体 getter は `T | undefined`、全件 getter は `Record<string, T>` に統一。
- `monsters.json` はキーがIDで値に `id` がないため、`getMonster()` / `getAllMonsters()` で `MonsterData.id` を補完。
- `RewardService` / `actions.ts` / `GameManager` の不要な型キャストを削減。
- `MasterDataService.test.ts` に getter 戻り値が `any` ではないことのコンパイル時テストと、代表マスターデータのランタイムテストを追加。

**設計:** `docs/設計書/64_QUALITY1_MasterDataService型安全化設計.md`

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
| SEC-3 | ✅ | `GameManager.ts` | 2026-05-24 完了。パーティ3スロットのDB保存を実装 |
| SEC-4 | ✅ | `RewardService.ts` | 2026-05-24 完了。Web CryptoベースのID生成へ移行 |
| SEC-5 | ✅ | `GameManager.ts` / `RewardService.ts` | 2026-05-24 完了。critRate とドロップ補正を分離 |
| BUG-4 | ✅ | `useGameStore.ts` | 2026-05-24 完了。残滓強化素材を1個単位で消費 |
| BUG-5 | ✅ | `StatusAilmentSystem.ts:199` | BURN の免疫チェック欠落 |
| BUG-6 | ✅ | `BattleEngine.ts` | 敵HPオブジェクトの直接書き換え |
| BUG-7 | ✅ | `BattleEngine.ts:826` | getMutableStats の any キャスト削除 |
| BUG-8 | ✅ | `BattleEngine.ts:116` | 状態異常行動スキップ時も敵反撃を継続 |
| BUG-9 | ✅ | `NecroService.test.ts` | NecroStatus.exp をテストモックへ追加 |
| BUG-10 | ✅ | `BattleEngine.ts` / `BattleCanvas.tsx` | 軍団追撃を複数敵へ分散 |
| PERF-1 | ✅ | `RewardService.ts` | 残滓サブオプション抽選を Fisher-Yates に変更 |
| QUALITY-1 | ✅ | `MasterDataService.ts` | 全getterを正典型の戻り値へ変更 |
