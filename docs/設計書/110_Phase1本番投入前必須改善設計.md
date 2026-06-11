# 110 — Phase 1 本番投入前必須改善設計

> 作成日: 2026-06-11  
> 対象レビュー: `docs/progress/COMPREHENSIVE_REVIEW_2026-06-11.md` Phase 1  
> 対象範囲: NEW-OPS-1/2/3, NEW-SEC-3/7, NEW-ADMIN-1, NEW-IOS-1〜5, NEW-CODE-3/4/5, NEW-DATA-1/5

## 1. 目的

Phase 0 でリリースブロッカーを解消した後、本番投入前に必須となる安全性・運用性・管理ツール堅牢性・iOS Safari 表示安定性・バトル/データ整合をまとめて改善する。

本設計では以下を正本とする。

- 認証 API は IP とメール単位で試行回数を制限する。
- `/admin` は middleware と Server Action guard の二層で開発環境以外から隔離する。
- マスターデータ編集フォームは空 ID / 危険 ID を保存前に拒否する。
- Framer Motion の transform 要素と overflow clipping は分離する。
- ENRAGE は `BossGimmick.value` を正とし、マスター値は `1.5` とする。
- 武器パッシブは実データ形式の Rank1〜Rank5 配列を直接参照する。
- 会心式は `critMultiplier = 1 + critDmg / 100` を実装・テスト・ドキュメントの正本とする。
- 本番 DB 反映は `prisma migrate deploy` を使い、`db push` は本番起動経路から排除する。

## 2. 既存実装との差分

| 項目 | 既存状態 | 改善後 |
|---|---|---|
| Docker 起動 | `npx prisma db push && npm run start` | `npx prisma migrate deploy && npm run start` |
| docker-compose | DB password 平文、app に `AUTH_SECRET`/`GEMINI_API_KEY` なし | `POSTGRES_PASSWORD` 変数化、`env_file: .env.local` で秘密値を注入 |
| Cloudflare migration | 手順は存在するが npm script なし | `npm run db:migrate:deploy` を追加し手順へ明記 |
| login/signup | 試行回数制限なし | Upstash Redis REST の sliding window、未設定時は in-memory fallback |
| admin 防御 | 各 action のローカル `assertDev()` のみ | `/admin/:path*` middleware + 共通 `adminGuard` |
| 管理フォーム ID | `form.id || entryKey` で空キー保存可能 | `validateEntryId()` で trim / 文字種 / 予約語を保存前検証 |
| iOS motion | 対象6箇所で motion + overflow 同居 | motion 外側、overflow 内側 div へ分離 |
| ENRAGE | data `value=1`、Canvas fallback `1.35`、Engine 固定 `1.5` | `getEnrageMultiplier()` と data `value=1.5` へ統一 |
| WeaponPassive | `values[0]`/`values[1]` の補間 | `values[rank - 1]` の直接参照 |
| 会心式 docs | README/AGENTS/CLAUDE/skill に旧式または `critDmg/100` 記述 | 実装済み `1 + critDmg/100` に統一 |
| バランスデータ | ドレイン/呪縛/一部魔神技が基準未達 | `1.40` / `1.35` / `4.0` へ調整 |

## 3. 詳細設計

### 3.1 認証レート制限

`src/services/RateLimitService.ts` を追加する。

- key は `ratelimit:${scope}:${sha256(identifier)}` とし、メールアドレスや IP を Redis key に平文保存しない。
- Upstash Redis 設定がある場合は REST `/pipeline` で `ZREMRANGEBYSCORE` → `ZADD` → `ZCARD` → `EXPIRE` を実行し、sliding window とする。
- Redis 未設定または一時障害時はプロセス内 Map に fallback する。ローカル開発と Jest はこの経路を使う。
- login は IP 20回/10分、email 10回/10分。
- signup は IP 5回/1時間、email 3回/1時間。
- 超過時は 429 と `Retry-After` を返し、レスポンス本文は共通エラーのみ返す。

### 3.2 admin 多層防御

`src/middleware.ts` を追加し、`matcher: ['/admin/:path*']` を設定する。`NODE_ENV !== 'development'` の admin アクセスは `/` へ redirect する。

Server Action 側は `src/app/admin/adminGuard.ts` に `assertDev()` と `withDevGuard()` を集約する。現時点では既存 action の明示 `assertDev()` 呼び出しを維持しつつ、ローカル関数重複を削除して guard の正本を一箇所へ寄せる。

### 3.3 管理フォーム ID 検証

`src/components/admin/forms/shared/entryId.ts` を追加する。

- 空文字を拒否する。
- `^[a-z0-9_][a-z0-9_-]*$` のみ許可する。
- `__proto__` / `prototype` / `constructor` を拒否する。
- 対象5フォームは保存確認後、`saveEntry()` 前に必ず検証する。
- `EnemyForm` / `SkillForm` / `ItemForm` / `MaterialForm` は trim 済み ID を JSON payload の `id` にも反映する。
- `MonsterForm` は既存データ形式を維持し、保存キーのみ検証する。

### 3.4 iOS Safari motion/overflow 分離

対象:

- `NecroLab` `ResidueDetailStrip`
- `NecroLab` `EquipTab`
- `NecroLab` `EnhanceTab`
- `LegionHub` GearHub `EQUIP`
- `LegionHub` GearHub `ENHANCE`
- `JobChangeScreen` root motion

実装方針:

- `motion.div` は transform / opacity / position だけを持つ。
- `overflow-hidden` / scroll / padding / flex layout は子 div へ移す。
- 近縁リスクとして `NecroLab` の `motion.button` 3箇所からも `overflow-hidden` を外す。

### 3.5 バトル係数とデータ整合

ENRAGE:

- `BossGimmickSystem.getEnrageMultiplier()` を追加。
- `BattleEngine` は `boss.stats.atk *= getEnrageMultiplier(gimmick)`。
- `BattleCanvas` は敵攻撃時の `enrageMultiplier` に同 helper を使う。
- `enemies.json` の ENRAGE は `value: 1.5`。

WeaponPassive:

- `getWeaponRank()` で rank を整数化。
- `getRankedPassiveValue()` で `values[Math.max(rank, 1) - 1]` を直接参照。
- rank 0 / rank 欠損は Rank1 相当として扱う。
- rank が values 長を超える場合は最後の値へ clamp する。

会心式:

```ts
isCritical = rng() * 100 < critRate
critMultiplier = 1 + critDmg / 100
```

この式を `BattleDamage.ts` の現行実装、`BattleDamage.test.ts`、README、AGENTS、CLAUDE、project-arch skill にそろえた。

### 3.6 運用手順

- Docker image の production 起動は migration 履歴を使う。
- compose は `.env.local` を取り込み、`AUTH_SECRET` / `GEMINI_API_KEY` などの秘密値を app コンテナへ注入する。`DATABASE_URL` は compose DB へ接続する値で app 側上書きする。
- Cloudflare Pages は DB migration を直接実行しない前提のため、deploy 前にローカルまたは CI の安全な実行環境で `DATABASE_URL="..." npm run db:migrate:deploy` を実行する。

## 4. 変更ファイル

主要な変更:

- `src/services/RateLimitService.ts`
- `src/app/api/auth/login/route.ts`
- `src/app/api/auth/signup/route.ts`
- `src/middleware.ts`
- `src/app/admin/adminGuard.ts`
- `src/components/admin/forms/shared/entryId.ts`
- `src/components/admin/forms/{Enemy,Skill,Item,Material,Monster}Form.tsx`
- `src/logic/BossGimmickSystem.ts`
- `src/logic/WeaponPassive.ts`
- `src/components/battle/BattleCanvas.tsx`
- `src/components/necro/NecroLab.tsx`
- `src/components/legion/LegionHub.tsx`
- `src/components/job/JobChangeScreen.tsx`
- `src/data/master/{enemies,skills,demonForms}.json`
- `Dockerfile`, `docker-compose.yml`, `package.json`, `README.md`, `AGENTS.md`, `CLAUDE.md`

## 5. テスト計画

| 種別 | コマンド | 目的 |
|---|---|---|
| 対象 Jest | `npm test -- --runTestsByPath src/services/RateLimitService.test.ts src/components/admin/forms/shared/entryId.test.ts src/logic/WeaponPassive.test.ts src/logic/BossGimmickSystem.test.ts` | 新規/変更ロジックの即時検証 |
| 型チェック | `npx tsc --noEmit` | Next/API/UI/JSON型の破綻検出 |
| 全 Jest | `npm test` | 既存626件以上の回帰確認 |
| データ監査 | `npm run data:audit` | master data の FAIL 検出 |
| バランス確認 | `npm run balance:skills` | NEW-DATA-1/5 の倍率変更確認 |
| Build | `npm run build` | Next production build / middleware / server action 互換確認 |
| E2E | `npx playwright test tests/necro-lab.spec.ts` | iOS分離対象に近い LAB 主要導線の回帰確認 |
| Compose | `docker compose config` | compose env_file / password 変数化の構文確認 |

## 6. 検証結果

2026-06-11 時点:

- `npm test -- --runTestsByPath src/services/RateLimitService.test.ts src/components/admin/forms/shared/entryId.test.ts src/logic/WeaponPassive.test.ts src/logic/BossGimmickSystem.test.ts`: PASS（4 suites / 18 tests）
- `npx tsc --noEmit`: PASS
- `npm test`: PASS（71 suites / 639 tests）
- `npm run data:audit`: PASS（0 fail / 1 warn）
  - 既存 WARN: `enemies/grave_knight: ELITE has no shieldHp`
- `npm run balance:skills`: PASS 相当（0 fail / 6 warnings）
  - Phase 1 対象だった `skill_darkpriest_1` / `skill_darkpriest_curse_bind` / sorcerer / trickster は警告対象外。
  - 残 WARN は既存の `skill_trickster_lucky_knife` と一部 ult の状態異常 budget。
- `npm run build`: PASS
- `PLAYWRIGHT_TEST_BASE_URL=http://localhost:3080 npx playwright test tests/necro-lab.spec.ts`: PASS（2 tests）
  - 初回は dev server cold compile が 39.2s かかり beforeEach 30s timeout。compile 完了後の再実行で 2 passed。
- `docker compose config`: PASS

## 7. 残リスク

- Redis 未設定時の in-memory fallback は単一プロセス内の防御であり、本番の多インスタンス環境では Upstash 設定が必須。
- `/admin` は現行方針どおり開発環境専用。将来 production admin を作る場合は role-based auth を `adminGuard` と middleware に追加する。
- BattleCanvas/BattleEngine の二重実装は今回 ENRAGE を helper 化したが、長期的には敵攻撃・状態異常処理も共通化が必要。
