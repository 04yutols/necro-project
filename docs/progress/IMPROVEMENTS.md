# ゲーム改善案レポート

> 調査日: 2026-05-27  
> 対象: `src/` 全体 + マスターデータ JSON  
> 深刻度凡例: 🔴 Critical / 🟠 High / 🟡 Medium / 🟢 Low

---

## サマリー

| ID | 深刻度 | カテゴリ | タイトル | 対応状況 |
|----|--------|----------|----------|----------|
| BUG-2   | 🔴 | バトルロジック | 状態異常ダメージが現在HPをmaxHpとして計算 | 未対応 |
| IMP-1   | 🟠 | バトルロジック | AoEスキルがBattleEngineで単体攻撃になる | 未対応 |
| IMP-2   | 🟠 | バトルロジック | SUMMON_MINIONSがBattleEngineではログのみ | 未対応 |
| IMP-3   | 🟠 | コンテンツ | ボスが直前の精鋭より弱い（stat逆転） | 未対応 |
| IMP-4   | 🟡 | バトルロジック | ドレインスキルのHP回復が未実装 | 未対応 |
| IMP-5   | 🟡 | バトルロジック | 通常攻撃のattackTypeが全職業でSLASH固定 | 未対応 |
| IMP-6   | 🟡 | UX | ターン順序プレビューUI が存在しない | 未対応 |
| IMP-7   | 🟡 | ゲームデザイン | node1→node2の難易度崖（案内なし） | 未対応 |
| SEC-6   | 🟡 | セキュリティ | JWTセッションの失効不可 | 未対応 |
| SEC-7   | 🟡 | セキュリティ | パスワードポリシーが弱い | 未対応 |
| NL-1    | 🟢 | コード品質 | SynergyBonus未使用フィールド3種 | 未対応 |
| NL-2    | 🟢 | コード品質 | isAwakenedが常にfalse | 未対応 |
| L-2     | 🟢 | コード品質 | BattleEngineのWAVE進行が10ターン経過トリガー | 未対応 |
| QUALITY-2 | 🟢 | コード品質 | JobService.changeJobの引数直接変異 | 未対応 |

---

## 🔴 BUG-2: 状態異常ダメージが現在HPをmaxHpとして計算

**ファイル:** `src/logic/BattleEngine.ts:898`

```typescript
private processRuntimeStatus(...) {
  const result = processStatusEffects(
    effects,
    { maxHp: targetStats.hp },  // ← targetStats.hp は戦闘中に直接削られていく現在HP
    Math.random,
  );
}
```

**問題の詳細:**  
POISON（maxHPの3%）やBURN（maxHPの5%）のダメージ計算が、戦闘が進むにつれ小さくなっていく。  
「3ターン目にPOISON付与 → 毎ターン弱体化していく状態異常」という意図しない動作になっている。  
HP 100 → 50 に削られた後にPOISONのtickが入ると、3%の基準が50になってしまう。

**具体案:**  
プレイヤー側は `this.playerInitialMaxHp`、敵側は `this.enemyMaxHp[enemy.id]` を参照して `maxHp` に渡す。

```typescript
// プレイヤー
const result = processStatusEffects(
  effects,
  { maxHp: this.playerInitialMaxHp },
  Math.random,
);

// 敵（processEnemyStatus を追加する場合）
const maxHp = this.getEnemyMaxHp(enemy);
const result = processStatusEffects(effects, { maxHp }, Math.random);
```

**関連ファイル:**
- `src/logic/BattleEngine.ts:898` — `processRuntimeStatus()`
- `src/logic/StatusAilmentSystem.ts` — `processStatusEffects()` の `maxHp` 引数

---

## 🟠 IMP-1: AoEスキルがBattleEngineで単体攻撃になる

**ファイル:** `src/logic/BattleEngine.ts:257–420`

**問題の詳細:**  
`processPlayerAction()` は `skillData.targetType` を一切チェックせず、常に引数の `target` 1体にのみダメージを与える。  
`skill_warrior_wind_slash`（鎌鼬: `targetType: ALL_ENEMIES`）や `skill_mage_earth`（ロックブレイク）をBattleEngineで呼ぶと単体ダメージになる。

BattleCanvasは正しく `skill.aoe ? enemies.filter(e => e.hp > 0) : [getTargetId()]` でAoEを処理している。  
→ BattleEngineのテストと実際のゲームプレイで挙動が乖離している。

**AoE対象スキル（第1章）:**
| スキルID | 名前 | 職業 |
|---|---|---|
| skill_warrior_wind_slash | 鎌鼬 | 戦士 |
| skill_mage_earth | ロックブレイク | 魔術師 |
| skill_mage_wind | エアロバースト | 魔術師 |
| skill_darkpriest_curse_bind | 呪縛 | 暗黒司祭 |
| skill_darkknight_grave_cross | 墓標十字 | 暗黒騎士 |

**具体案:**

```typescript
private processPlayerAction(
  actionType: 'PHYSICAL_ATTACK' | 'MAGIC_SKILL',
  target: MonsterData,
  skillId?: string,
  allEnemies?: MonsterData[], // 追加
): void {
  // ...
  const isAoe = skillData?.targetType === 'ALL_ENEMIES';
  const targets = isAoe && allEnemies
    ? allEnemies.filter(e => this.getEnemyRuntimeHp(e) > 0)
    : [target];

  for (const t of targets) {
    const shieldResult = this.applySpiritualShield(t, totalDamage, element);
    const hpChange = this.applyDamageToEnemy(t, shieldResult.damage);
    this.checkBossGimmicks(t, hpChange.prevHpPct, hpChange.newHpPct);
    // ログ生成...
  }
}
```

`simulateAction()` シグネチャに `allEnemies` を渡す変更と、テストを追加する。

**関連ファイル:**
- `src/logic/BattleEngine.ts:257` — `processPlayerAction()`
- `src/logic/BattleEngine.ts:104` — `simulateAction()`
- `src/data/master/skills.json` — `targetType: ALL_ENEMIES` スキル5種

---

## 🟠 IMP-2: SUMMON_MINIONSがBattleEngineではログのみ（敵が実際に増えない）

**ファイル:** `src/logic/BattleEngine.ts:688`

```typescript
case 'SUMMON_MINIONS':
  this.addLog('BOSS_SUMMON', boss.name, 'FIELD',
    `【召喚】${boss.name}が手下を呼んだ！`);
  break; // ← 実際には何も起きない
```

**問題の詳細:**  
`blood_mire_queen`（第1章ラストボス）は `ON_SHIELD_BREAK → SUMMON_MINIONS` ギミックを持つ。  
BattleCanvasには `resolveSummonMinionIds()` が実装され増援IDを解決できるが、  
BattleEngineでは「ログを出すだけ」で `state.enemies` に追加しない。  
BattleEngineのテストをすると、防壁破壊後もモンスターが増えていない。

**BossGimmickSystemには解決ロジックがある:**

```typescript
// src/logic/BossGimmickSystem.ts
export function resolveSummonMinionIds(boss: MonsterData, gimmick: BossGimmick): string[]
```

**具体案:**  
BattleEngine の `state` に `pendingSummons: string[]` フィールドを追加し、  
`applyBossGimmickEffect()` の SUMMON_MINIONS ケースで増援IDを `pendingSummons` にプッシュ。  
`simulateAction()` の呼び出し元が `pendingSummons` を読んで敵を追加する設計にする。

```typescript
case 'SUMMON_MINIONS': {
  const ids = resolveSummonMinionIds(boss, g);
  this.state.pendingSummons = [...(this.state.pendingSummons ?? []), ...ids];
  this.addLog('BOSS_SUMMON', boss.name, 'FIELD',
    `【召喚】${boss.name}が手下を呼んだ！（${ids.join(', ')}）`);
  break;
}
```

**関連ファイル:**
- `src/logic/BattleEngine.ts:688` — `applyBossGimmickEffect()` SUMMON_MINIONS ケース
- `src/logic/BossGimmickSystem.ts` — `resolveSummonMinionIds()`
- `src/types/game.ts:BattleState` — `pendingSummons?: string[]` を追加

---

## 🟠 IMP-3: ボスが直前の精鋭より弱い（stat逆転）

**ファイル:** `src/data/master/enemies.json`

**スタット比較:**

| 敵名 | tier | HP | ATK | DEF | 出現場所 |
|------|------|-----|-----|-----|---------|
| bone_colossus（骨巨人） | ELITE | 720 | 124 | 78 | area1_node2 WAVE2 |
| ossuary_wyrm_lord（死骨竜王） | BOSS | **180** | **15** | 25 | area1_node2 WAVE3 / area1_boss WAVE3 |
| blood_mire_queen（血沼の女王） | BOSS | 1380 | 188 | 88 | area1_node3 WAVE3 |

`ossuary_wyrm_lord` は直前のエリートより HP が1/4、ATK が1/8。  
bone_colossusを倒した後に「章ボス」と戦うとあっさり終わってしまう。  
一方、`blood_mire_queen` は適切なスケールで設計されている。

**具体案:**  
`ossuary_wyrm_lord` のステータスをENRAGE前後で差をつける形に修正する。  
基礎値を引き上げ、REVIVEで第2形態に移行する演出を活かす。

```json
"ossuary_wyrm_lord": {
  "stats": { "hp": 680, "atk": 95, "def": 52, "spd": 55,
             "critRate": 10, "critDmg": 175, "effectHit": 0, "effectRes": 30 },
  "shieldHp": 160, "maxShieldHp": 160,
  ...
}
```

ENRAGE後にATK×1.5 → `680 × 0.5 HP, ATK 142` で bone_colossus を超える局面を作る。  
REVIVE時のHP回復量と合わせて、2フェーズ制の緊張感を演出する。

**関連ファイル:**
- `src/data/master/enemies.json` — `ossuary_wyrm_lord.stats`
- `src/logic/BalanceTuning.test.ts` — 期待値を更新

---

## 🟡 IMP-4: ドレインスキルのHP回復が未実装

**ファイル:** `src/data/master/skills.json:114–127`, `src/logic/BattleEngine.ts:257`

```json
"skill_darkpriest_1": {
  "name": "ドレイン",
  "description": "対象の生命力を吸収する。敵単体に魔法ダメージを与え、自身のHPを回復。"
}
```

スキルデータに `healSelf` フィールドがなく、`processPlayerAction()` にも自己回復処理がない。  
暗黒司祭のアイデンティティとなるスキルが、ただの単体魔法攻撃になっている。

**具体案:**

skills.json に `healSelfPct` フィールドを追加:

```json
"skill_darkpriest_1": {
  "healSelfPct": 30,
  "description": "敵単体に魔法ダメージを与え、与えたダメージの30%分HPを回復。"
}
```

BattleEngineで処理:

```typescript
if (skillData?.healSelfPct && totalDamage > 0) {
  const healAmount = Math.floor(totalDamage * skillData.healSelfPct / 100);
  const playerStats = this.getMutableStats(player);
  playerStats.hp = Math.min(this.playerInitialMaxHp, playerStats.hp + healAmount);
  this.addLog('HEAL', player.name, player.name,
    `ドレイン：${healAmount}HP回復。`, healAmount);
}
```

BattleCanvasでも同様にフローティングHPテキスト（緑）を表示。

**関連ファイル:**
- `src/data/master/skills.json:114` — `skill_darkpriest_1`
- `src/types/game.ts:SkillData` — `healSelfPct?: number` を追加
- `src/logic/BattleEngine.ts:257` — `processPlayerAction()` にヒール処理を追加
- `src/components/battle/BattleCanvas.tsx` — `handleSkill()` に回復float追加

---

## 🟡 IMP-5: 通常攻撃のattackTypeが全職業でSLASH固定

**ファイル:** `src/logic/BattleEngine.ts:282`, `src/components/battle/BattleCanvas.tsx:2732`

```typescript
// BattleEngine
if (actionType === 'PHYSICAL_ATTACK') {
  energyCost = 0;
  attackType = 'SLASH'; // ← 全職業一律
}

// BattleCanvas
attackType: 'SLASH', // ← ハードコード
```

**影響:**
- ローグが「STRIKE」ではなく「SLASH」で通常攻撃 → 武器パッシブ `BLEED_ON_STRIKE` が発動しない
- 魔術師が「MAGIC」ではなく「SLASH」で通常攻撃 → WEAKEN状態異常の発動トリガーがずれる
- VFXも全員が斬撃アニメーションになる

**具体案:**  
`jobs.json` に `baseAttackType` フィールドを追加:

```json
"warrior":    { "baseAttackType": "SLASH" },
"mage":       { "baseAttackType": "MAGIC" },
"dark_priest":{ "baseAttackType": "MAGIC" },
"rogue":      { "baseAttackType": "STRIKE" }
```

`processPlayerAction()` で取得:

```typescript
const currentJob = this.masterData.getJob(player.currentJobId);
if (actionType === 'PHYSICAL_ATTACK') {
  attackType = (currentJob?.baseAttackType as SkillAttackType) ?? 'SLASH';
}
```

**関連ファイル:**
- `src/data/master/jobs.json` — 全12職業に `baseAttackType` を追加
- `src/types/game.ts:JobData` — `baseAttackType?: SkillAttackType` を追加
- `src/logic/BattleEngine.ts:282` — `processPlayerAction()`
- `src/components/battle/BattleCanvas.tsx:2732` — 通常攻撃ハンドラ

---

## 🟡 IMP-6: ターン順序プレビューUIが存在しない

**ファイル:** `src/logic/TurnOrderSystem.ts`, `src/components/battle/BattleCanvas.tsx`

`TurnOrderSystem.scheduleEnemiesUntilPlayer()` は `orderPreview` を返すが、  
BattleCanvasは `formatAvOrder(schedule.orderPreview)` でテキスト変換してログに流すのみ。  
プレイヤーは「次に誰が動くか」を視覚的に把握できない。

HSR / FGOなどのターン制ゲームではターン順アイコン列が戦略の根幹になっている。

**具体案:**  
バトル画面の上部 or 右端に行動順バッジ列を表示する：

```tsx
// コンパクトな横並びアイコン（最大5件）
<div style={{ display: 'flex', gap: 4 }}>
  {orderPreview.slice(0, 5).map((actor, i) => (
    <div key={i} style={{
      width: 28, height: 28, borderRadius: 6,
      background: actor.side === 'PLAYER' ? '#8B00FF' : '#ef4444',
      opacity: i === 0 ? 1 : 0.6,
      border: i === 0 ? '1px solid rgba(255,255,255,0.5)' : 'none',
    }}>
      <span style={{ fontSize: 9 }}>
        {actor.side === 'PLAYER' ? '⚔' : actor.name.slice(0,2)}
      </span>
    </div>
  ))}
</div>
```

`battleAvRef` の状態変化ごとに `orderPreview` を再計算して表示を更新。

**関連ファイル:**
- `src/logic/TurnOrderSystem.ts` — `orderPreview` は実装済み
- `src/components/battle/BattleCanvas.tsx:2675` — `formatAvOrder()` をUIに差し替え

---

## 🟡 IMP-7: node1→node2の難易度崖（プレイヤーへの案内なし）

**データ比較:**

| ステージ | 代表敵 | HP | ATK | スターターATK=11での撃破ターン数 |
|---------|--------|----|----|--------------------------------|
| area1_node1 | grave_soldier | 15 | 3 | 2ターン |
| area1_node1 | grave_knight | 40 | 6 | 4ターン |
| area1_node2 | hollow_handmaid | **285** | **62** | **32ターン** |
| area1_node2 | bone_colossus | **720** | **124** | **80ターン+** |

スターター装備（ATK=11）でnode2へ進むと、プレイヤーはbone_colossusに1撃（118ダメージ）で倒される。  
HP=60の初期プレイヤーに対してATK=124は即死。  
しかしマップ上でのロック表示がなく、「ステージが解放された＝行ける」と誤解される可能性がある。

**具体案1（推奨）: 推奨レベル表示をマップノードに追加**

```json
// stages.json
"area1_node2": {
  "recommendedLevel": 5,
  "recommendedWeapon": "SR"
}
```

マップノードのツールチップに「推奨Lv.5 / 推奨武器:SR以上」を表示。  
低レベルで挑もうとすると「このステージは難易度が高い。本当に挑戦する？」の確認ダイアログを出す。

**具体案2: スターターパックの追加**  
area1_node1クリア時に確定でSR武器残滓をドロップする「初回クリアボーナス」を設ける。  
`dropTable` に `"firstClearOnly": true` フラグを追加して対応。

**関連ファイル:**
- `src/data/master/stages.json` — `recommendedLevel` フィールドを追加
- `src/types/game.ts:StageData` — 型拡張
- `src/components/map/AreaMap.tsx` — ノードツールチップに推奨情報表示

---

## 🟡 SEC-6: JWTセッションの失効不可

**ファイル:** `src/auth.ts:33`

```typescript
session: { strategy: 'jwt', maxAge: 60 * 60 * 24 }
```

パスワード変更やアカウント削除後も最大24時間、トークンが有効なまま残る。  
Upstash Redis はすでにランキング用に導入済みなので、セッション無効化リストに転用できる。

**具体案:**  
Next-Auth の `jwt` コールバックで Redis に `jti`（JWT ID）を保存し、  
毎リクエストで `auth()` を呼ぶ Server Action の冒頭でブラックリストを確認する。

```typescript
// src/lib/sessionBlacklist.ts
export async function invalidateSession(jti: string): Promise<void> {
  await redis.set(`session:blacklist:${jti}`, '1', { ex: 86400 });
}
export async function isSessionBlacklisted(jti: string): Promise<boolean> {
  return (await redis.get(`session:blacklist:${jti}`)) === '1';
}
```

パスワード変更・アカウント削除時に `invalidateSession(session.jti)` を呼ぶ。

**関連ファイル:**
- `src/auth.ts` — `jwt` コールバックで `jti` を付与
- `src/lib/redis.ts` — Upstash クライアント（既存）
- `src/app/actions.ts` — 認証要求アクションの冒頭に blacklist チェックを追加

---

## 🟡 SEC-7: パスワードポリシーが弱い

**ファイル:** `src/services/AuthService.ts:30`

```typescript
if (password.length < 8) {
  return { success: false, error: 'パスワードは8文字以上にしてください' };
}
```

**具体案:**  
最低12文字、または「数字＋英字混合8文字以上」のいずれかを要件とする。

```typescript
const MIN_LENGTH = 12;
const MIXED_PATTERN = /^(?=.*[a-zA-Z])(?=.*\d).{8,}$/;

if (password.length < MIN_LENGTH && !MIXED_PATTERN.test(password)) {
  return {
    success: false,
    error: 'パスワードは12文字以上、または英数字を含む8文字以上にしてください'
  };
}
```

あわせてサインアップUIにパスワード強度インジケーター（色帯）を追加するとUX向上。

---

## 🟢 NL-1: SynergyBonusの未使用フィールド3種

**ファイル:** `src/logic/TribeSynergySystem.ts`, `src/logic/BattleDamage.ts`

```typescript
// SynergyBonus に定義あり、使用箇所なし
atkBonus?: number;    // HUMANOID 3体: ATK +12 のはず？
defBonus?: number;    // ORC クロス共鳴用？
avBonus?: number;     // DRAGON クロス共鳴用？
```

`BattleDamage.ts` にも `BattleCanvas` にも参照がない。

**具体案A（削除）:** これらのボーナスタイプをシナジー設計から外す場合、型から削除して明確化する。  
**具体案B（接続）:** `BattleDamage.ts` でATKに加算する:

```typescript
const effectiveAtk = attackerStats.atk + (synergyBonus?.atkBonus ?? 0);
```

DEF/AVも同様。どちらを採用するか設計書 `18_種族シナジーシステム.md` を確認の上決定する。

---

## 🟢 NL-2: isAwakenedが常にfalseでBattleCanvasに未接続

**ファイル:** `src/logic/BattleEngine.ts:503`, `src/components/battle/BattleCanvas.tsx`

`BattleEngine.processMonsterActions()` は `monster.isAwakened` チェックで ATK×1.5 になるが、  
BattleCanvas は `calculateMonsterAttackProfile()` に `{ awakened: player.isAwakened }` を渡しており、  
`player.isAwakened` は常に `false`（DBスキーマにも `isAwakened` フィールドはある）。

第2章以降で「覚醒」を実装する際の伏線として残すか、今章で死に値を削除するか判断が必要。

---

## 🟢 L-2: BattleEngineのWAVE進行が「10ターン経過」トリガー

**ファイル:** `src/logic/BattleEngine.ts:883`

```typescript
private updateState(): void {
  this.state.turn++;
  if (this.state.turn > 10) {
    this.state.wave = Math.min(3, this.state.wave + 1);
    this.state.turn = 1;
  }
}
```

BattleCanvasは「敵全滅でWAVE進行」を実装している。両者が同じ挙動にならない。  
BattleEngineを本番バトルに完全接続する際に衝突する。

**具体案:** `updateState()` のWAVE進行ロジックを削除し、呼び出し元から明示的に `advanceWave()` を呼ぶ設計に変更する。

```typescript
public advanceWave(): void {
  this.state.wave = Math.min(3, this.state.wave + 1);
  this.state.turn = 1;
}
```

---

## 🟢 QUALITY-2: JobService.changeJobの引数直接変異

**ファイル:** `src/services/JobService.ts:32–44`

```typescript
if (typeof characterOrId !== 'string') {
  const character = characterOrId;
  character.jobs.push(...);     // 引数を直接書き換え
  character.currentJobId = ...; // 引数を直接書き換え
  return;
}
```

Zustandストアから渡された `CharacterData` を直接変異させているため、Immerを使わないパスで予期しないレンダリングや状態の汚染が起こり得る。

**具体案:** 変異ではなく新しいオブジェクトを返す純粋関数化する。

```typescript
function changeJobImmutable(
  character: CharacterData,
  jobId: string,
): CharacterData {
  return {
    ...character,
    currentJobId: jobId,
    jobs: [...character.jobs, newJobEntry],
  };
}
```

呼び出し側で返り値を `set()` する。

---

## 実装推奨順

| 優先度 | 項目 | 理由 |
|--------|------|------|
| 1位 | BUG-2 | ゲームバランスに直結、数行修正 |
| 2位 | IMP-3 | ボス戦の達成感に直結、マスターデータ変更のみ |
| 3位 | IMP-4 | 職業の個性に直結、スキルデータ+数行修正 |
| 4位 | IMP-1 | BattleEngineとBattleCanvasの分岐解消 |
| 5位 | IMP-5 | 武器パッシブとVFXの一貫性に直結 |
| 6位 | IMP-6 | ゲームプレイの戦略深度向上 |
| 7位 | IMP-7 | 新規ユーザーの離脱防止 |
| 8位 | IMP-2 | blood_mire_queenのギミック完成 |
| 9位 | SEC-6, SEC-7 | セキュリティ強化 |
| 10位 | NL-1, NL-2, L-2, QUALITY-2 | 技術負債整理 |
