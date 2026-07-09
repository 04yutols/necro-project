# 網羅的レビューレポート — Necromance Brave（2026-06-11）

> 対象: ゲーム本体 / 管理画面 / 管理画面用AIエージェント の3点構成全体
> 観点: ①セキュリティ ②ゲームコード品質 ③UI/UX・デザインシステム ④マスターデータ ⑤ドキュメント ⑥管理画面・運用
> 実施方法: 6つの専門サブエージェント（opus×1 / sonnet×3 / haiku×2）による並列監査。既存監査（PROJECT_AUDIT_2026-06-11.md / BUGS_AND_SECURITY.md / TECH_DEBT.md）の既知課題は再掲せず、**新規発見**と**解決済み項目の抜き打ち検証**に特化。
> 深刻度凡例: 🔴 Critical / 🟠 High / 🟡 Medium / 🟢 Low

---

## 0. 総評

既存の追跡文化（progress/ 3ファイル運用、決定論ゲート、テスト626件PASS）は健全だが、今回の監査で**リリースをブロックすべき Critical 級の新規問題が4件**見つかった。

| # | 問題 | 領域 |
|---|---|---|
| 1 | **NEW-SEC-1**: ステージ報酬がブラウザコンソールから無戦闘・無制限に取得可能 | セキュリティ |
| 2 | **NEW-CODE-2**: 敵→プレイヤー攻撃に DEF 軽減が未適用（DEF 投資が完全に無意味） | ゲームコード |
| 3 | **NEW-DATA-4**: 12職業すべての奥義スキルが skills.json 未登録で魔神化が機能不全 | マスターデータ |
| 4 | **NEW-MOB-1**: BottomNavBar が未マウントで統一ナビゲーションが存在しない | UI/UX |

共通する構造的弱点は3つ:

1. **サーバーがクライアントを信頼しすぎる** — リザルト処理・ランキング指標がクライアント値をそのまま受け入れる（NEW-SEC-1/2/6 の連鎖）。SEC-8 設計書のステージ開始トークンが未実装のまま「設計のみ」で止まっている。
2. **BattleEngine と BattleCanvas の二重実装の乖離が再発** — 過去の温床（TECH_DEBT C-1系）と同型の問題が、SELF_DAMAGE / DEF軽減 / ENRAGE / 状態異常ティックで再び発生している。
3. **デザイントークンが「定義されているが強制されていない」** — Tailwind トークン・設計書カラーが存在する一方、コンポーネントが直書き hex で逸脱（#00FFFF / #8A2BE2 / Inter フォント等）。iOS Safari 必須ルール違反も6箇所残存。

---

## 1. 問題一覧（深刻度マトリクス）

| 領域 | 🔴 Critical | 🟠 High | 🟡 Medium | 🟢 Low | 計 |
|---|---|---|---|---|---|
| セキュリティ (NEW-SEC) | 1 | 3 | 3 | 2 | 9 |
| ゲームコード (NEW-CODE) | 2¹ | 3 | 6 | — | 11 |
| UI/UX (NEW-DS/IOS/MOB/A11Y/UX/ANIM/AAA) | 1 | 8 | 12 | 11 | 32 |
| マスターデータ (NEW-DATA) | 1 | 2 | 2 | — | 5 |
| ドキュメント (NEW-DOC) | — | 2 | 1 | 3 | 6 |
| 管理画面・運用 (NEW-ADMIN/AGENT/OPS) | — | 2 | 9 | 4 | 15 |
| **合計** | **5** | **20** | **33** | **20** | **78** |

¹ NEW-CODE-1/2 はゲームプレイ根幹の機能不全のため Critical 扱い。

---

## 2. セキュリティ監査（sec-auditor / opus）

### 既知課題の抜き打ち検証結果

| ID | 主張 | 検証結果 |
|---|---|---|
| SEC-4 暗号論的ID | ✅完了 | **正当** — `RewardService.secureUuid()` は crypto API 使用 |
| SEC-5 critRate/drop 分離 | ✅完了 | **正当** — discoveryBonusRate=0 で呼ばれ混入経路なし |
| SEC-6 JWT 失効 | ✅完了 | **概ね正当** — ただし NEW-SEC-5（パスワード変更機能自体が無い）参照 |
| SEC-3 updateParty 永続化 | ✅完了 | **正当** — 所有検証+コスト検証+DB書込みを確認 |
| SEC-8 ステージ開始トークン | 設計のみ | **未実装** — grep ヒット0 → NEW-SEC-1 へ昇格 |

### NEW-SEC-1 🔴 ステージ報酬の任意取得・無戦闘ファーミング
- **場所**: `src/app/actions.ts:561-833`（`processStageResultAction`）
- **問題**: 認証とステージ存在確認のみで、「解放済みか」「実際に戦って勝ったか」を一切検証しない。
- **攻撃**: ログイン済みユーザーがコンソールから `processStageResultAction('area1_boss', { totalDamage: 1, turnCount: 1 })` を任意回数実行 → EXP・ゴールド・ドロップ・ネクロマンス魔物・クリア記録・第一発見者称号を無限取得。
- **修正案**: SEC-8 設計書どおり `startStageAction(stageId)` でサーバー側解放判定＋短命トークン発行 → `processStageResultAction` で単一消費検証。暫定策としては最低限 `clearedStages` ＋隣接解放グラフ照合で未解放ステージを拒否。

### NEW-SEC-2 🟠 ランキング指標のクライアント値無検証（順位偽装）
- **場所**: `src/app/actions.ts:797-801` → `src/services/RankingService.ts:155-206`
- **問題**: `meta.totalDamage` 等を下限クランプのみで保存。`Number.MAX_SAFE_INTEGER` 送信でランキング独占・累積統計汚染が可能。
- **修正案**: バトルログのサーバー再計算（理想）、または最低限ステージ別理論上限でクランプ＋物理的に不可能な値（turnCount=0 等）の拒否。

### NEW-SEC-3 🟠 ログイン/サインアップにレート制限なし
- **場所**: `src/app/api/auth/login/route.ts`, `signup/route.ts`
- **問題**: ブルートフォース・大量アカウント生成が無制限に可能。
- **修正案**: Upstash Redis（既存依存）で IP＋メール単位のスライディングウィンドウ制限、連続失敗の指数バックオフ。

### NEW-SEC-4 🟠 ログインルートが認証情報・環境変数を平文ログ出力
- **場所**: `src/app/api/auth/login/route.ts:13-16, 27-41`
- **問題**: `console.log` でメールアドレス・パスワード長・bcrypt 成否・AUTH_URL を出力。本番ログ基盤に PII が残る。
- **修正案**: 全削除。必要なら構造化ロガー＋ `NODE_ENV !== 'production'` ガード＋マスキング。

### NEW-SEC-5 🟡 パスワード変更フロー不在でセッション失効が成立しない
- SEC-6 の `sessionVersion` 機構はあるが、それを起動するパスワード変更機能自体が未実装。実装時に `invalidateAllUserSessions()` をトランザクション内必須とし、テストで担保。

### NEW-SEC-6 🟡 リザルト二重送信レースで報酬複製
- **場所**: `src/app/actions.ts:633-819`
- **問題**: `clearedStages` チェックがトランザクション外読み取りベースで、並行リクエストが両方「未クリア」判定になり得る。
- **修正案**: NEW-SEC-1 のトークンを「`updateMany ... where consumed=false` の更新行数=1 確認」で単一消費にすれば冪等性も同時解決。

### NEW-SEC-7 🟡 admin の防御が単一層（assertDev 付け忘れ一発で破綻）
- **場所**: `src/middleware.ts`（matcher は実在しない `/api/game/:path*` のみ）、`src/app/admin/layout.tsx:13`
- **問題**: 現状は全 admin Server Action に `assertDev()` があり実害なしだが、middleware が `/admin` を未保護。
- **修正案**: (a) matcher に `/admin/:path*` 追加 (b) 管理者ロール認証の追加 (c) `assertDev` を高階関数ラッパで強制。

### NEW-SEC-8 🟢 管理AIへの間接プロンプトインジェクション → 自由記述フィールド汚染
- 決定論ゲート＋スナップショットは強固。残存リスクはバリデータ未検査の自由記述フィールド。`saveEntry` 前の許可キー whitelist と `entryKey` の `^[a-z0-9_]+$` 制限を追加。

### NEW-SEC-9 🟢 公開 API の limit クランプがサービス層依存
- `ranking`/`world-log` ルート層でも limit を明示クランプし防御を二重化。IP レートリミット付与。

---

## 3. ゲームコード品質（code-reviewer / sonnet）

### NEW-CODE-1 🔴 魔神化 SELF_DAMAGE リスクが HP を削らない
- **場所**: `src/components/battle/BattleCanvas.tsx:2944-2950`
- **問題**: `applyDemonRiskFeedback()` がフロート演出とログのみで HP 未更新。BattleEngine 側（457-458行）は正しく `applyDamageToPlayer` を呼ぶ。さらに表示値の意味も乖離（riskValue 直値 vs 最大HP%）。
- **修正案**: `Math.floor(playerMaxHp * riskValue / 100)` で実ダメージを適用し、死亡判定まで接続する。

### NEW-CODE-2 🔴 敵→プレイヤー攻撃が DEF を完全無視
- **場所**: `src/components/battle/BattleCanvas.tsx:2857-2858`
- **問題**: `effectiveAtk × incomingMult × enrageMult × random` のみで `1 - def/(def+200)` 未適用。**DEF 装備・パッシブ・シナジー投資がゲーム中まったく機能していない**。
- **修正案**: `defMult` を導入し BattleEngine（670-671行）と式を一本化。

### NEW-CODE-3 🟠 ENRAGE ギミックが実質無効
- **場所**: `BattleCanvas.tsx:2858` × `enemies.json`
- **問題**: 乗数として `value ?? 1.35` を使うが、全ボスデータが `value: 1` のため ×1 = 無効。BattleEngine は 1.5 ハードコードで仕様が三つ巴。
- **修正案**: 仕様を一本化（推奨: enemies.json の value を 1.5 にし、両実装とも value 参照に統一）。

### NEW-CODE-4 🟠 会心ダメージ式が CLAUDE.md と実装で乖離
- **場所**: `src/logic/BattleDamage.ts:65-66`
- **問題**: CLAUDE.md は `× critDmg/100`（150 → 1.5倍）、実装は `× (1 + critDmg/100)`（150 → 2.5倍）。
- **修正案**: どちらを正とするか明示決定（実装方式は HSR 互換で一般的だが、デフォルト150との組み合わせはバランス影響大）。決定後、CLAUDE.md・README・テストへ反映。

### NEW-CODE-5 🟠 武器パッシブのランクスケーリングが rank2 値で打ち止め
- **場所**: `src/logic/WeaponPassive.ts:29-30, 43-45, 58-60`
- **問題**: `values[0]`/`values[1]` の2点補間実装に対し、実データは5エントリ形式。rank5 武器が rank2 相当の効果しか出ない（例: 期待20 → 実際13）。テストが2エントリ形式で書かれており検出されなかった。
- **修正案**: `values[min(rank-1, len-1)]` の直接インデックス参照に変更し、テストを5エントリ形式へ更新。

### NEW-CODE-6〜11 🟡（要対応だが即時影響は限定的）
| ID | 内容 | 場所 |
|---|---|---|
| NEW-CODE-6 | BattleEngine の敵→味方モンスター攻撃が `calculateBattleDamage` 不使用（属性/会心/シナジー欠落、シミュレータ精度低下） | `BattleEngine.ts:644-665` |
| NEW-CODE-7 | BattleEngine が敵への状態異常ティックを処理せず、AIシミュレーションが状態異常を過小評価 | `BattleEngine.ts:143-156` |
| NEW-CODE-8 | `calculateNecroBaseStatsContribution` が引数を捨てて常に0を返すスタブのまま公開 | `StatSystem.ts:243-252` |
| NEW-CODE-9 | `addExp` がレベルアップ時に `withDerivedElementBoosts` 未経由（ResultScreen で一瞬誤表示） | `useGameStore.ts:557-582` |
| NEW-CODE-10 | 残滓強化素材が DB 未保存でリロード消失（Prisma テーブル不在） | `actions.ts:700-783` |
| NEW-CODE-11 | `weapon as any` の不要キャスト | `WeaponPassive.ts:28, 43, 58` |

---

## 4. UI/UX・デザインシステム（general-purpose / sonnet）

### 致命的・High（リリースブロッカー級）

| ID | 深刻度 | 内容 | 場所 |
|---|---|---|---|
| NEW-MOB-1 | 🔴 | **BottomNavBar が未マウント** — ファイルは存在するが page.tsx / ResponsiveFrame.tsx のどこからも render されず、統一ナビが存在しない。戻る導線が各画面アドホック | `BottomNavBar.tsx` / `page.tsx` |
| NEW-IOS-1 | 🟠 | NecroLab ResidueDetailStrip: motion + overflow-hidden 同居（必須ルール違反） | `NecroLab.tsx:186-193` |
| NEW-IOS-2 | 🟠 | NecroLab EquipTab/EnhanceTab の x スライド + overflow-hidden 同居 ×2 | `NecroLab.tsx:416-422, 695-701` |
| NEW-IOS-4 | 🟠 | LegionHub GearHub タブ切替で同違反 ×2（最高頻度画面） | `LegionHub.tsx:2506, 2581` |
| NEW-IOS-5 | 🟠 | JobChangeScreen ルート motion.div に overflow:hidden 直書き | `JobChangeScreen.tsx:193-198` |
| NEW-DS-1 | 🟠 | HomeHero THEME が設計トークン完全無視（secondary=シアン #00FFFF、設計は Cursed Gold #D4AF37） | `HomeHero.tsx:11-24` |
| NEW-A11Y-1 | 🟠 | `#6b5f7a`(2.31:1) / `#4a3a5a`(1.55:1) テキストが WCAG AA 大幅未達 | 複数コンポーネント |
| NEW-A11Y-2 | 🟠 | `#8B00FF`(1.34:1) / `#8A2BE2`(1.58:1) のテキスト直接使用 | HomeHero / AreaMap / BattleCanvas |
| NEW-AAA-1 | 🟠 | ShardEquipModal が初期実装のレガシークラス（bg-dark/border-necro/font-mono）のまま Gothic-Morphism 未適用 | `ShardEquipModal.tsx:35-45` |

### Medium / Low（抜粋）

- **NEW-DS-3** 🟡: 第三の紫 `#8A2BE2`（BlueViolet）がタイトル/マップ/WAVE ラベルに混在 → `#8B00FF` 系へ一括置換
- **NEW-DS-5/6** 🟢/🟡: 未定義フォント `Inter` が25箇所、`Cinzel Decorative` が CSS @import で FOUT 発生 → next/font 管理へ
- **NEW-IOS-3** 🟡: ResidueGridCard の whileTap scale + overflow-hidden 同居
- **NEW-IOS-6 / NEW-MOB-3** 🟢: noise overlay の 100vh、page.tsx `case 'MAP'` 到達不能デッドコード
- **NEW-A11Y-3/4** 🟡: モーダルに aria-modal / focus trap なし、`role="button"` div がキーボード非対応
- **NEW-UX-1〜5** 🟡/🟢: 装備解除の確認なし、装備アクションの成功/失敗フィードバックなし（エラーは console に捨てる）、戻る導線の不統一、**戦闘中断ボタンが存在しない**（誤選択で詰む）、ストーリー待機中のローディング表示なし
- **NEW-ANIM-1〜3** 🟢: spring パラメータ不統一（標準 295/33 から逸脱）、AnimatePresence mode="wait" の黒画面、infinite アニメーションの合成レイヤー増加
- **NEW-AAA-2〜5** 🟡/🟢: プロフィールカードの無機質デザイン、画面遷移に階層方向感なし（全タブフェードのみ）、ステータス表示のフレーバー欠如、body::before の z-index 競合リスク

---

## 5. マスターデータ検証（master-data-validator / haiku）

| ID | 深刻度 | 内容 | 修正案 |
|---|---|---|---|
| NEW-DATA-4 | 🔴 | **12職業全ての奥義スキル ID（ult_warrior 等）が skills.json に不在** — 魔神化機能が参照断で機能停止、ランタイム null 参照リスク | 設計書19 §6 の12本の奥義 JSON を skills.json へ追加 |
| NEW-DATA-1 | 🟠 | ドレイン(power1.20)・呪縛(1.32)が機会コスト閾値 `1.0+mpCost/40` 未達 | 1.40 / 1.35 へ引き上げ |
| NEW-DATA-5 | 🟠 | sorcerer(3.8)/trickster(3.9) の Tier2 魔神技が基準 4.0–5.5 未達 | 両者 4.0 へ |
| NEW-DATA-2 | 🟡 | 4ステージ（area1_node1/node2/boss, area2_gate）の dropTable 合計が 118〜152% | ドロップ方式（単一/複数）を明確化のうえ正規化。ドロップロジック実装の確認が先 |
| NEW-DATA-3 | 🟡 | dropType と itemId の整合確認プロセスが不完全（現データは有効） | バリデータに dropType×参照先テーブルのクロスチェック追加 |

enemies / jobs / items / monsters / areas / story / tutorial は問題なし。型チェック PASS。

---

## 6. ドキュメント整合性（Explore / haiku）

| ID | 深刻度 | 内容 | 修正案 |
|---|---|---|---|
| NEW-DOC-1 | 🟠 | README.md L110-114 のダメージ式が旧仕様（stat²/(stat+counterStat)、MATK/MDEF、TEC） | CLAUDE.md の HSR 簡易版へ置換 |
| NEW-DOC-2 | 🟠 | AGENTS.md L66-71 も同じ旧式 — AIエージェントが誤式で実装するリスク | 同上 |
| NEW-DOC-3 | 🟡 | CLAUDE.md L69-70 の story/ tutorial/ が「Phase B 実装予定」のまま（実際は計12ファイル実装済み） | 実装済み一覧へ更新 |
| NEW-DOC-4 | 🟢 | 00_INDEX.md に約37冊の設計書（100番台・84-90・97-99等）が未記載 | INDEX へ追記 |
| NEW-DOC-5 | 🟢 | 設計書03 §4 のスキル表が古い可能性 | skills.json と突合して更新 |
| NEW-DOC-6 | 🟢 | 設計書09 の初期ステータス値の実装確認チェックが CH1_TODO に不在 | チェック項目追加 |

相対リンク破損なし。progress ファイル間の明白な矛盾なし。

> 注: NEW-DOC-1/2 と NEW-CODE-4 は同根 — 「ダメージ式・会心式の正本」を1箇所に決め、CLAUDE.md / README / AGENTS.md / 実装 / テストを同時に揃えるべき。

---

## 7. 管理画面・AIエージェント・運用（general-purpose / sonnet）

### 管理画面（NEW-ADMIN）

| ID | 深刻度 | 内容 | 場所 / 修正案 |
|---|---|---|---|
| NEW-ADMIN-1 | 🟠 | **ID 未入力で空キー `""` のエントリがマスターデータに書き込まれる** — `saveEntry('enemies', '' \|\| '', ...)` が成立。監査は WARN 止まりで気づきにくい | `EnemyForm.tsx:268`（同パターンが SkillForm/ItemForm/MaterialForm/MonsterForm にも）。保存前に `form.id.trim()` 必須チェックを5フォームへ追加 |
| NEW-ADMIN-2 | 🟡 | `saveEntry`/`deleteEntry` が非アトミック書き込み — 並行リクエストで部分書き込み・ラストライト消失リスク | `admin/actions.ts:750, 780, 813, 943`。temp ファイル → `fs.renameSync` 方式へ |
| NEW-ADMIN-3 | 🟡 | `monsters.json` が `auditMasterData` の ID 整合チェック対象外 | `admin/actions.ts:182-189`。`scopesWithId` に追加＋`validateMonsterDraft` ルール追加 |
| NEW-ADMIN-4 | 🟡 | `saveStoryCharacter` に ID 検証なし（空キー/`__proto__` 入力窓口）、`deleteStoryCharacter` も不在 | `admin/actions.ts:942`。trim 検証＋delete 関数追加 |
| NEW-ADMIN-5 | 🟡 | コンパイル済み `EnemyForm.js`（488行）が `.tsx` と並行して git 追跡されている | 削除＋ .gitignore 追加 |
| NEW-ADMIN-6 | 🟡 | BulkAgent が空フィルター `filter: []` を警告なしで「全件変更」として通す（LLM 翻訳ミスの典型） | `bulkSpec.ts:64`。`filter.length === 0` で WARN 追加 |

### AIエージェント（NEW-AGENT）

| ID | 深刻度 | 内容 | 場所 / 修正案 |
|---|---|---|---|
| NEW-AGENT-1 | 🟡 | LangGraph グラフがモジュールロード時にコンパイル＋ LLM 呼び出しに AbortSignal なし（orphaned request の温床） | 全エージェント共通（`enemyAgent.ts:253` 等）。遅延初期化＋`AbortSignal.timeout(60000)` |
| NEW-AGENT-2 | 🟡 | Agent B（監査修正）の適用にスナップショット（undo）がない — BulkAgent には整備済みなのに非対称 | `AuditFixModal.tsx:50-62`。bulk の `writeSnapshot` を流用 |
| NEW-AGENT-3 | 🟢 | story スコープが `SCOPE_REGISTRY` 未登録で Agent B の自動修正対象外 | story 監査追加時の登録を DEFERRED に記録 |
| NEW-AGENT-4 | 🟢 | simEval の未知 verdict がサイレントに `BALANCED` へフォールバックし問題が隠れる | `simEvalAgent.ts:74`。null へ倒してエラー表示 |

### 運用・インフラ（NEW-OPS）

| ID | 深刻度 | 内容 | 場所 / 修正案 |
|---|---|---|---|
| NEW-OPS-1 | 🟠 | **Dockerfile が本番アンチパターンの `prisma db push` を使用** — マイグレーション履歴を記録せず破壊的変更を警告なし適用。`prisma/migrations/` の9本が使われていない | `Dockerfile:35`。`npx prisma migrate deploy && npm run start` へ（1行修正） |
| NEW-OPS-2 | 🟡 | docker-compose の app に `AUTH_SECRET`/`GEMINI_API_KEY` 未設定（起動しても認証・AI不動作）＋ `POSTGRES_PASSWORD` 平文ハードコード | `docker-compose.yml:19-26`。`env_file: .env.local` 化＋パスワード変数化 |
| NEW-OPS-3 | 🟡 | Cloudflare Workers デプロイに DB マイグレーション手順が存在しない（完全手動・手順書なし） | デプロイ手順書の作成 or deploy スクリプトへ `migrate deploy` 組込み |
| NEW-OPS-4 | 🟢 | CI が「意図的なマスターデータ変更」を無検査で通す（audit FAIL のまま main にマージ可能） | `ci.yml:41`。変更検知時に `data:audit` 実行＋ FAIL>0 で CI 失敗 |
| NEW-OPS-5 | 🟢 | `wrangler.jsonc` に `AUTH_URL` ハードコード（環境切替困難＋本番URL露出） | Cloudflare Secret 管理 or env 分岐へ |

---

## 8. 改善計画

### Phase 0 — リリースブロッカー（即時・〜2日）

優先度順。各項目は独立して着手可能。

1. **NEW-SEC-1 + NEW-SEC-2 + NEW-SEC-6 を一括解決**: SEC-8 設計書のステージ開始トークンを実装（`startStageAction` → DB短命トークン → `processStageResultAction` で単一消費）。ランキング指標に理論上限クランプ追加。担当想定: battle-engine-dev + db-expert。
2. **NEW-CODE-2**: 敵攻撃への DEF 軽減適用（BattleCanvas 1行修正＋テスト）。バランスへの影響が大きいため、修正後に balance-designer で第1章の被ダメ曲線を再検証。
3. **NEW-DATA-4**: 奥義スキル12本を skills.json へ追加（設計書19 §6 のJSONをそのまま投入）→ master-data-validator で再検証。
4. **NEW-CODE-1**: SELF_DAMAGE の実ダメージ接続（魔神化 Tier2 のリスク/リワード設計の根幹）。
5. **NEW-SEC-4**: ログインルートの console.log 全削除（5分で終わる・本番ログ汚染防止）。
6. **NEW-MOB-1**: BottomNavBar のマウント（ResponsiveFrame へ追加、isFullscreen 時非表示）。

### Phase 1 — 本番投入前必須（〜1週間）

7. **NEW-OPS-1**: Dockerfile を `prisma migrate deploy` へ（1行・本番DB破壊リスクの除去）。B-2（Prisma バージョン整合）と同時に検証。
8. **NEW-SEC-3**: Upstash Redis でログイン/サインアップのレート制限。
9. **NEW-SEC-7**: middleware matcher に `/admin/:path*` 追加＋ assertDev の高階関数化（多層防御）。
10. **NEW-ADMIN-1**: 5フォームの ID 必須バリデーション（空キー書き込み防止）。
11. **NEW-IOS-1〜5**: iOS Safari ルール違反6箇所の層分離修正 → `/ios-audit` で全画面再検証。
12. **NEW-CODE-3**: ENRAGE 仕様の一本化（enemies.json value=1.5 ＋両実装の参照統一）。
13. **NEW-CODE-5**: WeaponPassive のランク参照修正＋テストを実データ形式へ。
14. **NEW-CODE-4 + NEW-DOC-1/2**: 会心式の正本決定 → CLAUDE.md / README / AGENTS.md / 実装 / テストを同時更新。
15. **NEW-DATA-1/5**: スキル・魔神技の倍率調整（balance-designer 検証付き）。
16. **NEW-OPS-2/3**: docker-compose の env_file 化、デプロイ時マイグレーション手順の文書化。

### Phase 2 — 品質向上（〜2週間）

17. **NEW-AAA-1**: ShardEquipModal の Gothic-Morphism 全面書き直し（necro-ui-builder）。
18. **NEW-DS-1/2/3**: カラートークン逸脱の一括是正（#00FFFF / #8A2BE2 / 独自HP色）→ tailwind トークン経由へ。NEW-DS-4 の borderRadius トークン整備を同時に。
19. **NEW-A11Y-1/2**: コントラスト未達色の置換（#6b5f7a→#8b7da8、テキスト用紫→#D580FF/#BC00FB）。
20. **NEW-UX-2/4**: 装備アクションのトースト/エラー表示、戦闘中断（撤退）ボタン。
21. **NEW-DATA-2**: ドロップ方式の意図確定 → 正規化 → ドロップ率表示UIとの整合。
22. **NEW-SEC-5**: パスワード変更フロー実装（invalidateAllUserSessions をトランザクション内必須化）。
23. **NEW-DOC-3〜6**: CLAUDE.md / INDEX / 設計書03/09 の鮮度回復。
24. **NEW-ADMIN-2/3/4/6**: 管理画面の堅牢化（アトミック書き込み、monsters 監査対象化、story キャラ検証＋削除、空フィルター WARN）。
25. **NEW-AGENT-1/2**: エージェントの遅延初期化＋タイムアウト、Agent B へのスナップショット適用。

### Phase 3 — AAA 品質ギャップ（継続）

26. **NEW-AAA-3**: タブ遷移の方向性スライド（親→子の階層表現）。
27. **NEW-AAA-2/4**: プロフィールカードのリッチ化、ステータス表示のゲーム的演出。
28. **NEW-DS-5/6**: フォント管理の next/font 統一（Inter 排除 or 正式採用、Cinzel Decorative の FOUT 解消）。
29. **NEW-ANIM-1**: spring パラメータの定数化（`MOTION.spring.standard = { stiffness: 295, damping: 33 }`）。
30. **NEW-A11Y-3/4**: モーダルの focus trap / aria 整備、キーボード操作対応。
31. **NEW-CODE-6/7**: BattleEngine の敵攻撃・状態異常ティックを calculateBattleDamage / 共通処理へ統一（AIシミュレータ Agent E の精度向上）。
32. **NEW-OPS-4/5**: CI のマスターデータ変更時 audit ゲート、wrangler.jsonc の AUTH_URL Secret 化。
33. **NEW-CODE-8〜11 / NEW-UX-1/3/5 / NEW-ANIM-2/3 / NEW-AAA-5 / NEW-SEC-8/9 / NEW-ADMIN-5 / NEW-AGENT-3/4**: 衛生系の逐次消化。

### 検証ゲート（各 Phase 共通）

- `npx tsc --noEmit` / `npx jest` / `next build` / `git diff --exit-code src/data/master`
- バランス変更（NEW-CODE-2/3, NEW-DATA-1/5）は balance-designer の読み取り検証を挟む
- UI 変更は `/ios-audit` ＋ iPhone 実機（リリースゲート C-4 と統合）
- セキュリティ修正は sec-auditor の再監査でクローズ判定

---

## 9. 監査体制（参考）

| 領域 | エージェント | モデル | 根拠 |
|---|---|---|---|
| セキュリティ | sec-auditor | **opus** | 攻撃経路の連鎖推論が必要で最高難度 |
| ゲームコード | code-reviewer | sonnet | 二重実装の突合・式検証 |
| 管理画面・運用 | general-purpose | sonnet | 設計書5冊との乖離確認 |
| UI/UX | general-purpose | sonnet | トークン照合＋WCAG計算 |
| マスターデータ | master-data-validator | **haiku** | 機械的クロスチェック |
| ドキュメント | Explore | **haiku** | 記載と実体の突合 |
