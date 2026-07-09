# オープンソースツール・ライブラリ推薦

> 作成日: 2026-05-27  
> Necromance Brave の技術スタック（Next.js 15 / React 19 / PixiJS 8 / Framer Motion / Zustand 5 / Jest / Playwright）を前提とした選定。

---

## 1. ゲームロジック特化

### XState v5
- **パッケージ:** `xstate` `@xstate/react`
- **ライセンス:** MIT
- **GitHub Stars:** ~27k
- **概要:** 有限状態マシン（FSM）とステートチャートライブラリ。バトルフローの状態管理に最適。
- **Necromance Brave への活用例:**
  ```typescript
  // バトル状態マシン
  const battleMachine = createMachine({
    id: 'battle',
    initial: 'idle',
    states: {
      idle: { on: { START: 'playerTurn' } },
      playerTurn: { on: { ACTION: 'resolving', FLEE: 'fled' } },
      resolving: { on: { DONE: 'enemyTurn' } },
      enemyTurn: { on: { DONE: 'playerTurn', DEAD: 'result' } },
      result: { type: 'final' },
      fled: { type: 'final' },
    },
  });
  ```
  現在の `BattleEngine.ts` の暗黙的な状態遷移（`isPlayerTurn`, `currentWave` フラグ）を明示的な FSM に置き換えることで、バグの温床になるフラグ競合を排除できる。
- **導入コスト:** 中（BattleEngine のリファクタが必要だが段階的に移行可能）

---

### boardgame.io
- **パッケージ:** `boardgame.io`
- **ライセンス:** MIT
- **GitHub Stars:** ~10k
- **概要:** ターン制ゲームロジックのフレームワーク。ターン管理・フェーズ・手番検証をサーバー/クライアント両側で実行できる。
- **Necromance Brave への活用例:**
  - バトルを boardgame.io の「Game」として定義すると、サーバー側でターン進行を再現検証できる
  - SEC-8 で設計したステージトークンの代わりに boardgame.io のマルチプレイヤー検証機能を流用できる
  - ただし現在の PixiJS ベースのバトル画面との統合には設計変更が必要
- **導入コスト:** 高（アーキテクチャ変更を伴う。将来の選択肢として記録）

---

### rot.js
- **パッケージ:** `rot-js`
- **ライセンス:** BSD-3-Clause
- **GitHub Stars:** ~2.3k
- **概要:** Roguelike 開発に特化したゲームロジックライブラリ。マップ生成・FOV・経路探索・ダイスなどのゲーム用アルゴリズム集。
- **Necromance Brave への活用例:**
  ```typescript
  import { RNG } from 'rot-js';
  
  // 現在 Math.random() に依存しているドロップ抽選をシード付き乱数に置き換え
  // → テストで再現性が得られる
  RNG.setSeed(12345);
  const roll = RNG.getUniform(); // 0.0 〜 1.0
  ```
  - ダンジョンマップの手続き生成（第2章以降で MapCanvas に組み込み可能）
  - シード付き乱数で RewardService のドロップテストが確定的になる
- **導入コスト:** 低（RNG 部分のみ部分採用できる）

---

## 2. UI 特化

### @floating-ui/react
- **パッケージ:** `@floating-ui/react`
- **ライセンス:** MIT
- **GitHub Stars:** ~30k（floating-ui モノレポ）
- **概要:** ツールチップ・ポップオーバー・ドロップダウンの位置計算エンジン。iOS Safari のビューポート対応が堅牢。
- **Necromance Brave への活用例:**
  ```tsx
  // スキル説明ツールチップ（タッチデバイスでも正しく表示される）
  const { refs, floatingStyles } = useFloating({
    placement: 'top',
    middleware: [flip(), shift({ padding: 8 })],
  });
  ```
  - BubbleHint.tsx（チュートリアル）のツールチップ位置計算に活用
  - 残滓サブオプション詳細のポップオーバーに活用
  - Framer Motion の `AnimatePresence` と組み合わせ可能
- **導入コスト:** 低

---

### vaul
- **パッケージ:** `vaul`
- **ライセンス:** MIT
- **GitHub Stars:** ~4k
- **概要:** モバイルネイティブ品質のドロワー（下からスライドするシート）コンポーネント。iOS の自然なスワイプ感を再現。
- **Necromance Brave への活用例:**
  - ShardEquipModal.tsx や MonsterViewer.tsx の装備詳細表示
  - 現在の `motion.div` ベースのモーダルをより自然なスワイプUXに置き換え
  - ボトムシートで「奥義詳細」「魔神化説明」を表示
- **導入コスト:** 低（既存モーダルの置き換え）

---

### sonner
- **パッケージ:** `sonner`
- **ライセンス:** MIT
- **GitHub Stars:** ~9k
- **概要:** Next.js / React 公式推奨のトーストライブラリ。軽量で Framer Motion と相性が良い。
- **Necromance Brave への活用例:**
  ```tsx
  import { Toaster, toast } from 'sonner';
  
  // SEC-8 のエラー表示
  toast.error('バトルセッションが切れました。もう一度出撃してください');
  
  // 報酬取得時の通知
  toast.success('深淵の残滓 [SR] を入手！');
  ```
  - `globals.css` の Gothic-Morphism カラーでスタイルオーバーライド可能
- **導入コスト:** 低

---

### @tanstack/react-virtual
- **パッケージ:** `@tanstack/react-virtual`
- **ライセンス:** MIT
- **GitHub Stars:** ~5k（TanStack Virtual）
- **概要:** 仮想スクロールライブラリ。長いリストを DOM 効率化して描画。
- **Necromance Brave への活用例:**
  - NecroLab のモンスター一覧（将来的に100体以上になる）
  - 残滓一覧の大量アイテム表示
  - WorldLog の無限スクロール
- **導入コスト:** 低（リスト系コンポーネントへの局所的な適用）

---

## 3. テスト特化

### msw v2（Mock Service Worker）
- **パッケージ:** `msw`
- **ライセンス:** MIT
- **GitHub Stars:** ~15k
- **概要:** Service Worker / Node.js で HTTP リクエストをインターセプトするモックライブラリ。Next.js Server Actions のテストに対応。
- **Necromance Brave への活用例:**
  ```typescript
  // Server Actions のテストでPrismaをモックする代わりにMSWを使う
  const server = setupServer(
    http.post('/api/processStageResult', () =>
      HttpResponse.json({ success: true, rewards: [] })
    ),
  );
  ```
  - 現在 Jest の `jest.mock` で直接モックしているPrismaの代わりに使用
  - E2E テストで外部サービス（Upstash Redis, Pusher）を差し替え
- **導入コスト:** 低〜中

---

### @faker-js/faker
- **パッケージ:** `@faker-js/faker`
- **ライセンス:** MIT
- **GitHub Stars:** ~13k
- **概要:** テストデータ自動生成ライブラリ。ゲームのモックデータ生成に便利。
- **Necromance Brave への活用例:**
  ```typescript
  import { faker } from '@faker-js/faker';
  
  function createMockMonster(overrides = {}): MonsterData {
    return {
      id: faker.string.uuid(),
      name: faker.lorem.word(),
      tribe: faker.helpers.arrayElement(['UNDEAD', 'DEMON', 'BEAST']),
      stats: {
        hp: faker.number.int({ min: 100, max: 1000 }),
        atk: faker.number.int({ min: 10, max: 200 }),
        // ...
      },
      ...overrides,
    };
  }
  ```
  - BattleEngine テストのモックデータを1行で生成
  - BUG-9 のような「モックに必須フィールドが欠落」問題を型安全に防げる
- **導入コスト:** 低

---

### Storybook
- **パッケージ:** `storybook` `@storybook/nextjs`
- **ライセンス:** MIT
- **GitHub Stars:** ~85k
- **概要:** UIコンポーネントのカタログ・単体テストツール。
- **Necromance Brave への活用例:**
  - Gothic-Morphism デザインシステムのコンポーネントカタログ
  - BattleCanvas を除く全UIコンポーネントのビジュアルリグレッションテスト
  - FuchsiaButton, CapsuleStatBar, ArmySlot などのスタイル確認
- **導入コスト:** 中（設定ファイル + Story 追加が必要）

---

### Vitest
- **パッケージ:** `vitest`
- **ライセンス:** MIT
- **GitHub Stars:** ~13k
- **概要:** Vite ベースの Jest 互換テストランナー。実行速度が Jest の3〜5倍。
- **Necromance Brave への活用例:**
  - 現在の Jest をそのまま置き換え可能（API がほぼ同じ）
  - `vite.config.ts` が既に存在するため設定が容易
  - BattleEngine のような純粋ロジックの単体テストが高速化
- **移行コスト:** 低（`jest.config.ts` → `vitest.config.ts`、`@types/jest` → `vitest/globals`）
- **注意:** Playwright（E2E）はそのまま維持。Unit/Integration のみ移行対象。

---

## 4. アニメーション特化

### anime.js v4
- **パッケージ:** `animejs`
- **ライセンス:** MIT
- **GitHub Stars:** ~50k
- **概要:** 軽量 (~14kb) アニメーションライブラリ。タイムライン制御・SVG・CSS 変数に対応。
- **Necromance Brave への活用例:**
  ```typescript
  import anime from 'animejs';
  
  // ダメージ数字のポップアニメーション（PixiJS 外のDOM要素）
  anime({
    targets: '#damage-number',
    translateY: [0, -60],
    opacity: [1, 0],
    duration: 800,
    easing: 'easeOutExpo',
  });
  
  // 魔神化ゲージの充填アニメーション
  anime({
    targets: '.demonization-bar',
    width: [`${prev}%`, `${next}%`],
    duration: 300,
    easing: 'easeInOutQuart',
  });
  ```
  - Framer Motion はレイアウト/スプリングが得意、anime.js はタイムライン制御が得意
  - **使い分け:** 画面遷移・スプリング → Framer Motion、シーケンシャルな演出 → anime.js
- **導入コスト:** 低

---

### lottie-web
- **パッケージ:** `lottie-web`
- **ライセンス:** MIT
- **GitHub Stars:** ~30k
- **概要:** Adobe After Effects から書き出した JSON アニメーション（Lottie）を再生するライブラリ。
- **Necromance Brave への活用例:**
  - ローディング画面の魔法陣アニメーション
  - 鑑定VFXのキラキラ演出
  - 霧解除演出（BattleResult 画面の特定エフェクト）
  - LottieFiles.com から無料のゴシック/魔法系アニメーション素材を入手可能
- **導入コスト:** 低（JSON ファイルを public/ に置いて `lottie.loadAnimation()` するだけ）

---

### Theatre.js
- **パッケージ:** `@theatre/core` `@theatre/studio`
- **ライセンス:** Apache-2.0（Studio は非商用のみ無料）
- **GitHub Stars:** ~11k
- **概要:** プロ向けアニメーションエディター。ブラウザ上でタイムラインを編集してゲームアニメーションを調整できる。
- **Necromance Brave への活用例:**
  - PixiJS の BoosVFX / スキルVFX のタイミング調整
  - バトル演出のカットシーン制作
  - ノンエンジニアのゲームデザイナーがアニメーションを調整できる
- **注意:** Studio（エディター機能）は非商用プロジェクトのみ無料。商用利用は Pro ライセンスが必要。
- **導入コスト:** 中

---

## 5. VFX特化

### pixi-filters v6
- **パッケージ:** `pixi-filters`
- **ライセンス:** MIT
- **GitHub Stars:** ~1.6k
- **概要:** PixiJS 8 対応のシェーダーフィルター集（20種以上）。
- **Necromance Brave への活用例:**
  ```typescript
  import { GlowFilter, BloomFilter, MotionBlurFilter } from 'pixi-filters';
  
  // 魔神化エフェクト：紫のグロウ
  monsterSprite.filters = [
    new GlowFilter({ distance: 20, outerStrength: 2, color: 0x8B00FF }),
    new BloomFilter({ strength: 1.5 }),
  ];
  
  // 高速移動時のモーションブラー
  attackSprite.filters = [
    new MotionBlurFilter([velocityX, velocityY], 15),
  ];
  ```
  - **重要:** PixiJS 8 対応は `pixi-filters@6.x` 以上。`@5.x` は PixiJS 7 用なので注意。
  - 現在の BattleCanvas.tsx の VFX は手動描画のみ。filters を追加するだけで品質が大幅向上。
- **導入コスト:** 低

---

### @pixi/particle-emitter（旧 pixi-particles）
- **パッケージ:** `@pixi/particle-emitter`
- **ライセンス:** MIT
- **GitHub Stars:** ~1.8k（pixi-particles）
- **概要:** PixiJS 向けパーティクルエミッター。JSON 設定ファイルでパーティクル挙動を定義できる。
- **Necromance Brave への活用例:**
  ```typescript
  import { Emitter } from '@pixi/particle-emitter';
  
  // 炎魔法エフェクト（FIRE属性スキル使用時）
  const fireEmitter = new Emitter(container, {
    lifetime: { min: 0.5, max: 0.8 },
    frequency: 0.008,
    spawnChance: 1,
    particlesPerWave: 1,
    emitterLifetime: 0.6,
    pos: { x: targetX, y: targetY },
    addAtBack: false,
    behaviors: [
      { type: 'alpha', config: { alpha: { list: [{ value: 1, time: 0 }, { value: 0, time: 1 }] } } },
      { type: 'scale', config: { scale: { list: [{ value: 0.3, time: 0 }, { value: 1, time: 1 }] } } },
      { type: 'color', config: { color: { list: [{ value: 'ff4400', time: 0 }, { value: 'ffaa00', time: 1 }] } } },
    ],
  });
  ```
  - 各属性（FIRE/ICE/THUNDER/DARK...）のヒットエフェクトを JSON で差し替えるだけで作成可能
  - Pixi Particle Emitter Editor（無料Webツール）で JSON を視覚的に編集できる
- **導入コスト:** 低〜中

---

### tsParticles
- **パッケージ:** `@tsparticles/engine` `@tsparticles/react`
- **ライセンス:** MIT
- **GitHub Stars:** ~8k
- **概要:** React コンポーネントとして使えるパーティクルシステム。Canvas/CSS/SVG/PixiJS に対応。
- **Necromance Brave への活用例:**
  ```tsx
  import Particles from '@tsparticles/react';
  
  // 報酬画面の輝きエフェクト（PixiJS 外の DOM レイヤー）
  <Particles
    id="result-particles"
    options={{
      particles: {
        color: { value: '#8B00FF' },
        shape: { type: 'star' },
        opacity: { value: 0.7, random: true },
        size: { value: 3, random: true },
        move: { enable: true, speed: 2, direction: 'top', outModes: 'out' },
      },
    }}
  />
  ```
  - ResultScreen.tsx の SR/UR 報酬獲得時の豪華演出
  - BattleCanvas（PixiJS）の外の DOM レイヤーに重ねる形で使用
- **導入コスト:** 低

---

## 採用優先度まとめ

| ライブラリ | カテゴリ | 優先度 | 理由 |
|-----------|---------|-------|------|
| `sonner` | UI | ★★★ 高 | トースト通知が未実装。SEC-8 エラー表示に即必要 |
| `pixi-filters` | VFX | ★★★ 高 | 既存 PixiJS に後付けするだけ。品質向上が大きい |
| `@pixi/particle-emitter` | VFX | ★★★ 高 | 属性ヒットエフェクトが現在ほぼない |
| `@floating-ui/react` | UI | ★★☆ 中 | チュートリアル BubbleHint 実装時に必要 |
| `lottie-web` | アニメーション | ★★☆ 中 | 鑑定VFX・霧解除演出（Phase C/D） |
| `@faker-js/faker` | テスト | ★★☆ 中 | モックデータ生成を型安全に。テスト品質向上 |
| `rot-js` | ゲームロジック | ★★☆ 中 | シード付き乱数でドロップテストが確定的に |
| `anime.js` | アニメーション | ★★☆ 中 | タイムライン演出（魔神化ゲージ等） |
| `vaul` | UI | ★☆☆ 低 | 装備詳細UI改善。現状で動いているので後回し |
| `msw` | テスト | ★☆☆ 低 | 統合テスト強化。現状 Jest で十分 |
| `XState` | ゲームロジック | ★☆☆ 低 | BattleEngine リファクタに価値あり。影響大きい |
| `vitest` | テスト | ★☆☆ 低 | Jest 置き換え。移行コスト低いが緊急性なし |
| `tsParticles` | VFX | ★☆☆ 低 | ResultScreen 演出。`@pixi/particle-emitter` と競合 |
| `@tanstack/react-virtual` | UI | ★☆☆ 低 | アイテム100件超えてから検討 |
| `Storybook` | テスト | ★☆☆ 低 | UIカタログ。第1章完成後に価値が出る |
| `boardgame.io` | ゲームロジック | ★☆☆ 低 | アーキテクチャ変更を伴う。第2章以降で検討 |
| `Theatre.js` | アニメーション | ★☆☆ 低 | 商用ライセンス要確認。カットシーン制作向け |
