# 112 — Phase 3 AAA 品質ギャップ継続改善設計

> 作成日: 2026-06-13  
> 対象: `docs/progress/COMPREHENSIVE_REVIEW_2026-06-11.md` の Phase 3 — AAA 品質ギャップ（継続）  
> 実装範囲: 画面遷移・フォント・Home プロフィール/ステータス演出・モーダル A11Y・BattleEngine シミュレーション精度・CI/Secret/衛生系

## 1. 目的

Phase 3 は「本番投入を止める欠陥」ではなく、AAA 品質との差として体感に残る項目を継続的に潰すフェーズである。今回の対応では、既存の Gothic-Morphism UI と純粋ロジック構成を維持しながら、以下を正本化する。

- タブ遷移はフェードだけでなく、アプリ内の階層方向を持つ。
- フォントは CSS `@import` を使わず、Next.js では `next/font` で管理する。
- Framer Motion の spring 値は共有定数から参照する。
- 主要モーダルは `aria-modal` と focus trap / Escape / Tab 循環を備える。
- Home プロフィールはプレイヤーの戦闘ステータスが一目で読めるカードにする。
- BattleEngine の敵攻撃・敵状態異常処理は、BattleCanvas と同じ正本ロジックへ寄せる。
- CI とデプロイ設定から、マスターデータ監査漏れと環境値ハードコードを減らす。

## 2. 対象項目と既存実装の差分

| Review ID | 既存実装 | 改善後 |
|---|---|---|
| NEW-AAA-3 | `src/app/page.tsx` のタブ切替は全て opacity のみ | `src/lib/motion.ts` にタブ順序と方向判定を置き、前後関係に応じた横スライド + blur へ変更 |
| NEW-AAA-2/4 | Home プロフィールは HP/MP と EXP 中心で、戦闘ステータスの読ませ方が弱い | HP/ATK/DEF/SPD のアイコン付きステータスタイルを追加し、値・日本語ラベル・ゲージを同じカード内に表示 |
| NEW-DS-5/6 | `globals.css` の Google Fonts `@import` と、未管理の `Inter`/`Cinzel Decorative` 参照が混在 | `layout.tsx` で `Cinzel Decorative` / `IM Fell English` / `Inter` を正式採用し、CSS/Tailwind/inline style は font variable を参照 |
| NEW-ANIM-1 | spring 値が画面ごとに分散 | `MOTION.spring.standard = { stiffness: 295, damping: 33 }` を正本化 |
| NEW-A11Y-3/4 | `ShardEquipModal` / battle retreat dialog に focus trap がなく、Home の `role="button"` div がキーボード操作に弱い | `useFocusTrap` を追加し、対象 dialog へ適用。Home の主要遷移操作は native `button` 化 |
| NEW-CODE-6 | BattleEngine の敵→味方モンスター攻撃が手計算で、会心/耐性ログが欠落 | `calculateBattleDamage` を利用し、霊核属性・耐性・会心・弱点/耐性フラグをログへ反映 |
| NEW-CODE-7 | 敵への状態異常 DoT が BattleEngine のランタイム HP に反映されない | `processEnemyRuntimeStatuses` を追加し、敵 current HP と状態異常残ターンを更新 |
| NEW-CODE-9 | `addExp` がレベル再計算後に派生属性ブーストを再計算しない | `withDerivedElementBoosts` 経由で player を返し、残滓/ネクロ由来の element boost を維持 |
| NEW-OPS-4 | CI は master data が変わっても audit を実行しない | CI に `npm run data:audit` を追加 |
| NEW-OPS-5 | `wrangler.jsonc` に `AUTH_URL` が vars として固定 | `AUTH_URL` をファイルから削除し、Cloudflare dashboard vars または `wrangler secret put AUTH_URL` へ移行 |
| NEW-ADMIN-5 | `EnemyForm.js` / `gimmickValue.js` のコンパイル済み JS が追跡対象 | 追跡ファイルを削除し、`.gitignore` に `/src/**/*.js` を追加 |
| NEW-AGENT-4 | simEval の未知 verdict が `BALANCED` にフォールバック | `coerceEvaluation` を公開し、未知 verdict は `null` として呼び出し側でエラー扱いにする |

## 3. UI / Animation 設計

### 3.1 Motion token

`src/lib/motion.ts` を追加し、画面遷移の spring と duration を一箇所に集約する。

```ts
export const MOTION = {
  spring: {
    standard: { type: 'spring', stiffness: 295, damping: 33 },
    soft: { type: 'spring', stiffness: 260, damping: 28 },
    snappy: { type: 'spring', stiffness: 330, damping: 34 },
  },
  duration: { fast: 0.16, normal: 0.22, slow: 0.38 },
} as const;
```

タブ遷移は `APP_TAB_ORDER` の index 差分で方向を決める。未知タブ・同一タブは direction 0 とし、外部入力や将来タブ追加時にも破綻しない。

### 3.2 タブ遷移

`src/app/page.tsx` は `useTabTransitionDirection()` で前回タブを保持し、`AnimatePresence` 内の各タブ root に同じ `tabMotionProps` を渡す。

- enter: `x = direction * 28`, opacity 0, blur 8px
- center: `x = 0`, opacity 1, blur 0
- exit: `x = direction * -28`, opacity 0, blur 8px

BATTLE active overlay は iOS Safari の `overflow + transform` 問題を避けるため、既存の opacity 中心の扱いを維持する。

### 3.3 Home プロフィールカード

`HomeHero` は既存の player / necroStatus / party 参照を維持し、カード内に以下を追加する。

- ローカル画像がない場合の外部 avatar fallback を廃止し、プレイヤー名先頭文字の Gothic crest を表示。
- HP/ATK/DEF/SPD の `ProfileStatTile` を追加。
- 各 tile は lucide icon、英字ラベル、日本語ラベル、数値、相対ゲージを持つ。
- 主要遷移操作は `motion.button` / `button` に変更し、Enter/Space 操作と disabled 状態をブラウザ標準へ任せる。
- motion 親と `overflow: hidden` は同一要素に置かない。clip が必要な箇所は内側の静的 layer に移す。

## 4. Font 設計

`globals.css` の Google Fonts `@import` は削除し、Next.js 側では `src/app/layout.tsx` の `next/font/google` を正本とする。

採用フォント:

| 変数 | 用途 |
|---|---|
| `--font-cinzel` | 見出し・英字装飾 |
| `--font-cinzel-decorative` | ロゴ/章題/儀式的な強調 |
| `--font-im-fell-english` | 古文書風の短文 |
| `--font-inter` | 小さな英字 UI / status label |
| `--font-noto-sans-jp` | 日本語本文 |
| `--font-space-grotesk` | 全体 UI のベース英字 |

Vite dev 互換のため、CSS root には同名 fallback 変数を残す。Next production では `html` の font variable class が上書きする。

## 5. A11Y 設計

`src/hooks/useFocusTrap.ts` を追加する。

動作:

- active 時に dialog 内の最初の focusable 要素へ focus する。
- Tab / Shift+Tab を dialog 内で循環する。
- focusable がない場合は root に focus する。
- Escape は任意の `onEscape` callback を呼ぶ。
- cleanup 時に以前の active element へ focus を戻す。

適用先:

- `ShardEquipModal`
- `BattleCanvas` の retreat confirm dialog

Home の主要カード操作は `role="button"` を廃止し、native button とすることでキーボード/スクリーンリーダーの基本挙動をブラウザ標準に寄せる。

## 6. BattleEngine 設計

### 6.1 敵→味方モンスター攻撃

旧実装:

```ts
rawDmg = enemy.atk * (1 - monster.def / (monster.def + 200))
```

改善後:

```ts
const result = calculateBattleDamage({
  attackerStats: enemy.stats,
  defenderStats: monsterTarget.stats,
  defenderResistances: monsterTarget.resistances,
  element: enemy.spiritCore?.element ?? 'NONE',
});
```

`calculateBattleDamage` の result を使うため、以下がログと HP へ反映される。

- enemy critRate / critDmg
- defender resistance
- `isWeakness` / `isResisted`
- attack element

既存の種族シナジー `absorbDmgPct` は incoming damage 側の軽減として維持する。`synergyBonus` を attacker として渡すと味方側の攻撃シナジーを敵に付けてしまうため、ここでは渡さない。

### 6.2 敵状態異常ティック

`processEnemyRuntimeStatuses(enemies)` を追加し、プレイヤー行動・味方モンスター行動の後に対象敵へ適用する。

- enemy id で重複を排除する。
- HP 0 以下の敵は処理しない。
- `processStatusEffects` は `maxHp = getEnemyMaxHp(enemy)` を渡す。
- DoT は `applyDamageToEnemy` を通し、`enemy.stats.hp` は変更しない。
- tick / clear ログは `AILMENT_TICK` / `AILMENT_CLEAR` として残す。

## 7. Store / Agent / Ops 設計

### 7.1 addExp 派生値

`useGameStore.addExp()` は job level と base stats を再計算したあと、`withDerivedElementBoosts(nextPlayer, equippedResidueSlots, necroStatus)` で返す。これにより、レベルアップ直後も残滓やネクロ進行由来の element damage boost が一瞬 0 になる表示ブレを避ける。

### 7.2 simEval verdict

`coerceEvaluation` を export し、テスト可能にする。未知 verdict は `BALANCED` に丸めず `null` を返す。AI レスポンスの schema drift を「安全な成功」に見せないためである。

### 7.3 CI / Secret / compiled JS

- `.github/workflows/ci.yml`: `npm run data:audit` を CI に追加。
- `wrangler.jsonc`: `AUTH_URL` vars を削除し、Secret/環境変数運用コメントへ置換。
- `.gitignore`: `/src/**/*.js` を追加。
- `src/components/admin/forms/EnemyForm.js` と `src/components/admin/forms/shared/gimmickValue.js` を削除。

### 7.4 E2E 専用バトルブースト

Playwright のオンボーディング E2E は「バトル導線が victory result / appraisal まで到達すること」を見るため、localhost/dev 限定の sessionStorage hook を追加する。

- key: `necro-e2e-battle-boost`
- 有効条件: `window.location.hostname` が `localhost` / `127.0.0.1` / `::1`
- 本番ホストの production build では無効
- 効果: 初期 warrior stats を E2E 導線確認に十分な HP/ATK/DEF/SPD へ底上げ

これは既存の `necro-e2e-cleared-stages` と同じテスト補助層であり、通常プレイの初期バランスには影響しない。

## 8. 主要変更ファイル

- `src/lib/motion.ts`
- `src/lib/motion.test.ts`
- `src/hooks/useFocusTrap.ts`
- `src/app/layout.tsx`
- `src/app/globals.css`
- `tailwind.config.ts`
- `src/app/page.tsx`
- `src/components/home/HomeHero.tsx`
- `src/components/necro/ShardEquipModal.tsx`
- `src/components/battle/BattleCanvas.tsx`
- `src/logic/BattleEngine.ts`
- `src/logic/BattleEngine.test.ts`
- `src/store/useGameStore.ts`
- `src/store/useGameStore.party.test.ts`
- `src/lib/agent/simEvalAgent.ts`
- `src/lib/agent/simEvalAgent.test.ts`
- `.github/workflows/ci.yml`
- `wrangler.jsonc`
- `.gitignore`

## 9. テスト計画

| 種別 | コマンド | 目的 |
|---|---|---|
| 型 | `npx tsc --noEmit` | next/font、motion props、store/BattleEngine 型整合 |
| 対象 Jest | `npm test -- --runTestsByPath src/store/useGameStore.party.test.ts src/logic/BattleEngine.test.ts src/lib/motion.test.ts src/lib/agent/simEvalAgent.test.ts` | Phase 3 追加/変更ロジックの検証 |
| 全 Jest | `npm test` | 既存ユニット回帰 |
| データ監査 | `npm run data:audit` | CI 追加ゲートと同じ監査 |
| ドロップ監査 | `npm run balance:drops` | Phase 2 由来のドロップ期待値に破壊がないこと |
| 差分検査 | `git diff --check` | 空白・改行事故検出 |
| Build | `npm run build` | Next production build / next/font / app router 検証 |
| E2E | `PLAYWRIGHT_TEST_BASE_URL=http://localhost:3080 npx playwright test tests/item-equip.spec.ts tests/necro-lab.spec.ts tests/necro-shard.spec.ts tests/new-player-onboarding.spec.ts --workers=1` | Home/装備/LAB/新規導線の回帰確認 |

## 10. 検証結果

2026-06-13 実行:

| 種別 | 結果 |
|---|---|
| 型 | `npx tsc --noEmit`: PASS |
| 対象 Jest | `src/store/useGameStore.party.test.ts` / `src/logic/BattleEngine.test.ts` / `src/lib/motion.test.ts` / `src/lib/agent/simEvalAgent.test.ts`: PASS（4 suites / 59 tests）。Jest の open handle 注意は既存 |
| 全 Jest | `npm test`: PASS（74 suites / 653 tests）。Jest の open handle 注意は既存 |
| データ監査 | `npm run data:audit`: PASS（0 fail / 1 warn）。既存 WARN: `enemies/grave_knight: ELITE has no shieldHp` |
| ドロップ監査 | `npm run balance:drops`: exit 0（3 warnings）。既存 WARN: `R_WEAPON expected count is low` |
| 差分検査 | `git diff --check`: PASS |
| Font/JS衛生 | Google Fonts `@import` なし、フォント名直書きは Vite fallback 変数のみ、`src/**/*.js` 残存なし |
| Build | `npm run build`: PASS |
| E2E | `PLAYWRIGHT_TEST_BASE_URL=http://localhost:3080 npx playwright test tests/item-equip.spec.ts tests/necro-lab.spec.ts tests/necro-shard.spec.ts tests/new-player-onboarding.spec.ts --workers=1`: PASS（17 tests） |

## 11. 残リスクと次フェーズ候補

- NEW-CODE-8 の `calculateNecroBaseStatsContribution` は、現行 `calculateNecromanceLevelBonus` と役割が重なる。今回の範囲では public stub の仕様変更は行わず、後続で API 廃止または実装統合を判断する。
- NEW-CODE-10 の残滓強化素材 DB 永続化は Prisma schema と migration を伴うため、Phase 3 小粒衛生系ではなく DB 永続化タスクとして分離する。
- NEW-UX-1/3/5、NEW-ANIM-2/3、NEW-AAA-5、NEW-SEC-8/9 は今回の変更対象外。既存実装への影響が広いものは、個別設計と E2E を付けて順次対応する。
- BattleCanvas と BattleEngine の完全共通化はまだ途中。今回、敵→味方モンスター攻撃と敵 DoT は寄せたが、敵 AI 行動全体の共通 domain 化は継続課題。
