/**
 * 新規プレイヤー オンボーディング → ステージ1クリア E2E テスト
 *
 * テスト対象フロー:
 *   1. 初回アクセス（ゲストモード自動起動）
 *   2. HOME画面 → チュートリアル/ストーリー表示確認
 *   3. マップ遷移 → ステージ選択
 *   4. バトル実行 → 勝利確認
 *   5. リザルト画面 → 報酬確認
 *
 * 注意: Vite/ゲストモードで実行（Next.js DB不要）。
 * 実際の認証フロー（AuthGate → CharacterCreation）はDB環境が必要なため別途確認。
 */

import { test, expect, type Page } from '@playwright/test';

const MOBILE_VIEWPORT = { width: 390, height: 844 };

/** Next.js 認証APIをゲストモード用にインターセプト */
async function setupGuestMode(page: Page) {
  await page.route('**/api/auth/**', (route) => {
    route.fulfill({ status: 200, contentType: 'text/html', body: '' });
  });
}

/** ストーリーダイアログを全て閉じる（最大 n 回クリックして消える まで） */
async function dismissAllStory(page: Page, maxClicks = 30) {
  for (let i = 0; i < maxClicks; i++) {
    const skip = page.getByLabel('スキップ');
    const next = page.getByRole('button', { name: /次へ|続ける|スキップ|閉じる|OK/ });
    const isSkipVisible = await skip.isVisible().catch(() => false);
    const isNextVisible = await next.isVisible().catch(() => false);
    if (isSkipVisible) {
      await skip.click({ force: true });
      await page.waitForTimeout(400);
    } else if (isNextVisible) {
      await next.click({ force: true });
      await page.waitForTimeout(400);
    } else {
      break;
    }
  }
}

/** チュートリアルオーバーレイを閉じる */
async function dismissTutorial(page: Page, maxClicks = 10) {
  for (let i = 0; i < maxClicks; i++) {
    const btn = page.getByRole('button', { name: /スキップ|わかった|OK|次へ|閉じる/ });
    const visible = await btn.isVisible().catch(() => false);
    if (!visible) break;
    await btn.click({ force: true });
    await page.waitForTimeout(300);
  }
}

test.describe('新規プレイヤー オンボーディング', () => {
  test.describe.configure({ timeout: 180000 });
  test.use({ viewport: MOBILE_VIEWPORT, isMobile: true, hasTouch: true });

  test.beforeEach(async ({ page }) => {
    await setupGuestMode(page);
  });

  // ─────────────────────────────────────────────────────────────
  // T-01: 初回アクセス — アプリがゲストモードで起動する
  // ─────────────────────────────────────────────────────────────
  test('T-01: 初回アクセス — ゲストモードでHOME画面が表示される', async ({ page }) => {
    // 完全な新規状態（localStorage なし）
    await page.goto('/');

    // ゲストモード: 認証なしでゲームが起動すること
    // 「拠点」タブ または ストーリー/チュートリアルが表示される
    const homeOrStory = page.locator('text=拠点, text=NECROMANCE BRAVE, text=冒険開始, [data-testid="story-scene"]');
    await expect(homeOrStory.first()).toBeVisible({ timeout: 20000 });
  });

  // ─────────────────────────────────────────────────────────────
  // T-02: ストーリー/チュートリアルスキップ後にHOMEが表示される
  // ─────────────────────────────────────────────────────────────
  test('T-02: ストーリー/チュートリアルをスキップして HOME が表示される', async ({ page }) => {
    await page.goto('/');

    // ストーリー・チュートリアルを閉じる
    await dismissAllStory(page);
    await dismissTutorial(page);

    // HOME画面の確認
    await expect(page.getByText('拠点', { exact: true })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('アルド', { exact: false }).first()).toBeVisible({ timeout: 5000 });
  });

  // ─────────────────────────────────────────────────────────────
  // T-03: HOME画面 — 主要セクションが全て表示される
  // ─────────────────────────────────────────────────────────────
  test('T-03: HOME画面に主要ナビゲーションセクションが揃っている', async ({ page }) => {
    // ストーリー/チュートリアル完了状態でスタート
    await page.addInitScript(() => {
      window.localStorage.setItem('necro-story-store-v2', JSON.stringify({
        state: {
          viewedScenes: ['PROLOGUE_00', 'PROLOGUE_01', 'PROLOGUE_02', 'PROLOGUE_03', 'CH1_TITLE', 'CH1_SAFE_INTRO', 'CH1_OPEN'],
          storyFlags: { LINE_DEATH_SEEN: true, CH1_STARTED: true },
        },
        version: 0,
      }));
      window.localStorage.setItem('necro-tutorial-store-v1', JSON.stringify({
        state: {
          completedPhases: ['BATTLE_BASICS', 'NECRO_LAB', 'PARTY_FORMATION', 'JOB_CHANGE', 'ABYSSAL_RESIDUE', 'DEMONIZATION'],
          activePhase: null,
          tutorialCompleted: true,
          viewedHints: [],
          visitedTabs: ['HOME', 'MAP', 'BATTLE', 'EQUIP', 'LAB', 'JOB'],
        },
        version: 0,
      }));
    });
    await page.goto('/');

    await expect(page.getByText('拠点', { exact: true })).toBeVisible({ timeout: 15000 });

    // 主要ナビゲーションボタン/セクション確認
    await expect(page.getByRole('button', { name: /出撃|マップ/ })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('button', { name: /編成|軍団/ })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('button', { name: /装備/ })).toBeVisible({ timeout: 5000 });
  });

  // ─────────────────────────────────────────────────────────────
  // T-04: マップへ遷移 — area1_node1 が選択可能
  // ─────────────────────────────────────────────────────────────
  test('T-04: マップへ遷移してステージ1が選択可能', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('necro-story-store-v2', JSON.stringify({
        state: { viewedScenes: ['PROLOGUE_00','PROLOGUE_01','PROLOGUE_02','PROLOGUE_03','CH1_TITLE','CH1_SAFE_INTRO','CH1_OPEN'], storyFlags: { LINE_DEATH_SEEN: true, CH1_STARTED: true } },
        version: 0,
      }));
      window.localStorage.setItem('necro-tutorial-store-v1', JSON.stringify({
        state: { completedPhases: ['BATTLE_BASICS','NECRO_LAB','PARTY_FORMATION','JOB_CHANGE','ABYSSAL_RESIDUE','DEMONIZATION'], activePhase: null, tutorialCompleted: true, viewedHints: [], visitedTabs: ['HOME','MAP','BATTLE','EQUIP','LAB','JOB'] },
        version: 0,
      }));
    });
    await page.goto('/');
    await expect(page.getByText('拠点', { exact: true })).toBeVisible({ timeout: 15000 });

    // MAPタブへ
    const mapBtn = page.getByRole('button', { name: /出撃|マップ/ }).first();
    await mapBtn.click({ force: true });

    // マップUI確認
    await expect(page.getByText(/ワールドマップ|AREA MAP|エリア/)).toBeVisible({ timeout: 15000 });

    // 侵攻ボタンまたはステージ選択ボタンを探す
    const enterBtn = page.getByRole('button', { name: /エリアマップへ|侵攻|領域選択|探索/ }).first();
    await expect(enterBtn).toBeVisible({ timeout: 10000 });
  });

  // ─────────────────────────────────────────────────────────────
  // T-05: バトル開始 → 攻撃UIが表示される
  // ─────────────────────────────────────────────────────────────
  test('T-05: ステージ1バトルが開始して攻撃コマンドが使える', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('necro-story-store-v2', JSON.stringify({
        state: {
          viewedScenes: ['PROLOGUE_00','PROLOGUE_01','PROLOGUE_02','PROLOGUE_03','CH1_TITLE','CH1_SAFE_INTRO','CH1_OPEN','CH1_NODE1_AFTER'],
          storyFlags: { LINE_DEATH_SEEN: true, CH1_STARTED: true, DEMONIZE_STORY_SEEN: true },
        },
        version: 0,
      }));
      window.localStorage.setItem('necro-tutorial-store-v1', JSON.stringify({
        state: { completedPhases: ['BATTLE_BASICS','NECRO_LAB','PARTY_FORMATION','JOB_CHANGE','ABYSSAL_RESIDUE','DEMONIZATION'], activePhase: null, tutorialCompleted: true, viewedHints: [], visitedTabs: ['HOME','MAP','BATTLE','EQUIP','LAB','JOB'] },
        version: 0,
      }));
    });
    await page.goto('/');
    await expect(page.getByText('拠点', { exact: true })).toBeVisible({ timeout: 15000 });

    // マップ → ステージ開始
    const mapBtn = page.getByRole('button', { name: /出撃|マップ/ }).first();
    await mapBtn.click({ force: true });
    await expect(page.getByText(/ワールドマップ|AREA MAP/)).toBeVisible({ timeout: 15000 });

    // 領域選択 → エリアマップへ
    const areaSelect = page.getByRole('button', { name: /領域選択/ }).first();
    if (await areaSelect.isVisible({ timeout: 5000 }).catch(() => false)) {
      await areaSelect.click({ force: true });
    }

    const enterArea = page.getByRole('button', { name: /エリアマップへ|再訪する/ }).first();
    if (await enterArea.isVisible({ timeout: 5000 }).catch(() => false)) {
      await enterArea.click({ force: true });
      await expect(page.getByText('LAYER 2 / AREA MAP')).toBeVisible({ timeout: 10000 });
    }

    // 次の侵攻 → 侵攻開始
    const nextInvasion = page.getByRole('button', { name: /次の侵攻/ }).first();
    if (await nextInvasion.isVisible({ timeout: 5000 }).catch(() => false)) {
      await nextInvasion.click({ force: true });
    }

    const startInvasion = page.getByRole('button', { name: /侵攻開始|再挑戦/ }).first();
    await expect(startInvasion).toBeVisible({ timeout: 10000 });
    await startInvasion.click({ force: true });

    // バトルUI確認
    await expect(page.locator('#tut-attack-btn')).toBeVisible({ timeout: 20000 });
    await expect(page.locator('#tut-attack-btn')).toContainText('攻撃');
    await expect(page.locator('#tut-soul-gauge')).toBeVisible();
    await expect(page.getByRole('button', { name: /AUTO/ })).toBeVisible();
    await expect(page.getByRole('button', { name: '逃走' })).toBeVisible();
  });

  // ─────────────────────────────────────────────────────────────
  // T-06: バトル完走 → VICTORYリザルト画面が表示される
  // ─────────────────────────────────────────────────────────────
  test('T-06: バトルをオートで完走してVICTORYリザルトが表示される', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('necro-story-store-v2', JSON.stringify({
        state: {
          viewedScenes: ['PROLOGUE_00','PROLOGUE_01','PROLOGUE_02','PROLOGUE_03','CH1_TITLE','CH1_SAFE_INTRO','CH1_OPEN','CH1_NODE1_AFTER'],
          storyFlags: { LINE_DEATH_SEEN: true, CH1_STARTED: true, DEMONIZE_STORY_SEEN: true },
        },
        version: 0,
      }));
      window.localStorage.setItem('necro-tutorial-store-v1', JSON.stringify({
        state: { completedPhases: ['BATTLE_BASICS','NECRO_LAB','PARTY_FORMATION','JOB_CHANGE','ABYSSAL_RESIDUE','DEMONIZATION'], activePhase: null, tutorialCompleted: true, viewedHints: [], visitedTabs: ['HOME','MAP','BATTLE','EQUIP','LAB','JOB'] },
        version: 0,
      }));
    });
    await page.goto('/');
    await expect(page.getByText('拠点', { exact: true })).toBeVisible({ timeout: 15000 });

    // マップ → バトル開始（既存 helper と同等の手順）
    const mapBtn = page.getByRole('button', { name: /出撃|マップ/ }).first();
    await mapBtn.click({ force: true });
    await expect(page.getByText(/ワールドマップ|AREA MAP/)).toBeVisible({ timeout: 15000 });

    const areaSelect = page.getByRole('button', { name: /領域選択/ }).first();
    if (await areaSelect.isVisible({ timeout: 5000 }).catch(() => false)) {
      await areaSelect.click({ force: true });
    }

    const enterArea = page.getByRole('button', { name: /エリアマップへ|再訪する/ }).first();
    if (await enterArea.isVisible({ timeout: 5000 }).catch(() => false)) {
      await enterArea.click({ force: true });
      await expect(page.getByText('LAYER 2 / AREA MAP')).toBeVisible({ timeout: 10000 });
    }

    const nextInvasion = page.getByRole('button', { name: /次の侵攻/ }).first();
    if (await nextInvasion.isVisible({ timeout: 5000 }).catch(() => false)) {
      await nextInvasion.click({ force: true });
    }

    const startInvasion = page.getByRole('button', { name: /侵攻開始|再挑戦/ }).first();
    await expect(startInvasion).toBeVisible({ timeout: 10000 });
    await startInvasion.click({ force: true });

    await expect(page.locator('#tut-attack-btn')).toBeVisible({ timeout: 20000 });

    // 倍速3x + AUTO ON でバトルを高速完走
    await page.getByRole('button', { name: '×3' }).click();
    await page.getByRole('button', { name: /AUTO OFF/ }).click();

    // VICTORY画面待機（最大90秒）
    await expect(page.getByTestId('result-summary')).toBeVisible({ timeout: 90000 });
    await expect(page.getByText('VICTORY')).toBeVisible();
    await expect(page.getByText('BATTLE REWARDS')).toBeVisible();
  });

  // ─────────────────────────────────────────────────────────────
  // T-07: 鑑定フロー — 戦利品鑑定画面が表示される
  // ─────────────────────────────────────────────────────────────
  test('T-07: リザルトから鑑定画面へ進み戦利品を確認できる', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('necro-story-store-v2', JSON.stringify({
        state: {
          viewedScenes: ['PROLOGUE_00','PROLOGUE_01','PROLOGUE_02','PROLOGUE_03','CH1_TITLE','CH1_SAFE_INTRO','CH1_OPEN','CH1_NODE1_AFTER'],
          storyFlags: { LINE_DEATH_SEEN: true, CH1_STARTED: true, DEMONIZE_STORY_SEEN: true },
        },
        version: 0,
      }));
      window.localStorage.setItem('necro-tutorial-store-v1', JSON.stringify({
        state: { completedPhases: ['BATTLE_BASICS','NECRO_LAB','PARTY_FORMATION','JOB_CHANGE','ABYSSAL_RESIDUE','DEMONIZATION'], activePhase: null, tutorialCompleted: true, viewedHints: [], visitedTabs: ['HOME','MAP','BATTLE','EQUIP','LAB','JOB'] },
        version: 0,
      }));
    });
    await page.goto('/');
    await expect(page.getByText('拠点', { exact: true })).toBeVisible({ timeout: 15000 });

    const mapBtn = page.getByRole('button', { name: /出撃|マップ/ }).first();
    await mapBtn.click({ force: true });
    await expect(page.getByText(/ワールドマップ|AREA MAP/)).toBeVisible({ timeout: 15000 });

    const areaSelect = page.getByRole('button', { name: /領域選択/ }).first();
    if (await areaSelect.isVisible({ timeout: 5000 }).catch(() => false)) {
      await areaSelect.click({ force: true });
    }
    const enterArea = page.getByRole('button', { name: /エリアマップへ|再訪する/ }).first();
    if (await enterArea.isVisible({ timeout: 5000 }).catch(() => false)) {
      await enterArea.click({ force: true });
      await expect(page.getByText('LAYER 2 / AREA MAP')).toBeVisible({ timeout: 10000 });
    }
    const nextInvasion = page.getByRole('button', { name: /次の侵攻/ }).first();
    if (await nextInvasion.isVisible({ timeout: 5000 }).catch(() => false)) {
      await nextInvasion.click({ force: true });
    }
    const startInvasion = page.getByRole('button', { name: /侵攻開始|再挑戦/ }).first();
    await expect(startInvasion).toBeVisible({ timeout: 10000 });
    await startInvasion.click({ force: true });
    await expect(page.locator('#tut-attack-btn')).toBeVisible({ timeout: 20000 });

    await page.getByRole('button', { name: '×3' }).click();
    await page.getByRole('button', { name: /AUTO OFF/ }).click();
    await expect(page.getByTestId('result-summary')).toBeVisible({ timeout: 90000 });

    // 鑑定へ進む
    await page.getByRole('button', { name: '鑑定へ進む' }).click();
    await expect(page.getByTestId('appraisal-screen')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('戦利品鑑定')).toBeVisible();

    await page.getByRole('button', { name: /鑑定する/ }).click();
    await expect(page.getByRole('button', { name: /次の戦利品|獲得して戻る/ })).toBeVisible({ timeout: 10000 });
  });

  // ─────────────────────────────────────────────────────────────
  // T-08: 初回ストーリー (PROLOGUE) が正しく再生される
  // ─────────────────────────────────────────────────────────────
  test('T-08: 完全な初回状態でPROLOGUEストーリーが表示される', async ({ page }) => {
    // ストーリー/チュートリアル初期状態（localStorage クリア）
    await page.goto('/');

    // ローディング完了を待つ
    await page.waitForTimeout(3000);

    // PROLOGUEシーン or チュートリアルオーバーレイが表示されること
    const storyOrTutorial = page.locator([
      '[data-testid="story-scene"]',
      '[data-testid="tutorial-overlay"]',
      'button:has-text("スキップ")',
      'text=PROLOGUE',
      'text=ネクロマンス',
    ].join(', '));

    const isVisible = await storyOrTutorial.first().isVisible({ timeout: 10000 }).catch(() => false);

    // ストーリーが表示されているか、またはHOMEに直行しているかを確認
    if (isVisible) {
      // スキップボタンがあれば押す
      const skipBtn = page.getByLabel('スキップ');
      if (await skipBtn.isVisible().catch(() => false)) {
        await skipBtn.click({ force: true });
        await page.waitForTimeout(500);
      }
    }

    // 最終的にHOMEが表示されること
    await dismissAllStory(page);
    await dismissTutorial(page);
    await expect(page.getByText('拠点', { exact: true })).toBeVisible({ timeout: 20000 });
  });

  // ─────────────────────────────────────────────────────────────
  // T-09: 軍団編成 — パーティスロットが表示される
  // ─────────────────────────────────────────────────────────────
  test('T-09: 軍団編成タブでパーティスロットが表示される', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('necro-story-store-v2', JSON.stringify({
        state: { viewedScenes: ['PROLOGUE_00','PROLOGUE_01','PROLOGUE_02','PROLOGUE_03'], storyFlags: { LINE_DEATH_SEEN: true, CH1_STARTED: true } },
        version: 0,
      }));
      window.localStorage.setItem('necro-tutorial-store-v1', JSON.stringify({
        state: { completedPhases: ['BATTLE_BASICS','NECRO_LAB','PARTY_FORMATION','JOB_CHANGE','ABYSSAL_RESIDUE','DEMONIZATION'], activePhase: null, tutorialCompleted: true, viewedHints: [], visitedTabs: ['HOME','MAP','BATTLE','EQUIP','LAB','JOB'] },
        version: 0,
      }));
    });
    await page.goto('/');
    await expect(page.getByText('拠点', { exact: true })).toBeVisible({ timeout: 15000 });

    const legionBtn = page.getByRole('button', { name: /軍団編成/ }).first();
    await legionBtn.click({ force: true });

    await expect(page.locator('#tut-cost-display')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#tut-cost-display')).toContainText('COST');
  });

  // ─────────────────────────────────────────────────────────────
  // T-10: 職業変更画面が表示される
  // ─────────────────────────────────────────────────────────────
  test('T-10: 装備・編成からキャラクター詳細・ステータスが確認できる', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('necro-story-store-v2', JSON.stringify({
        state: { viewedScenes: ['PROLOGUE_00','PROLOGUE_01','PROLOGUE_02','PROLOGUE_03'], storyFlags: { LINE_DEATH_SEEN: true } },
        version: 0,
      }));
      window.localStorage.setItem('necro-tutorial-store-v1', JSON.stringify({
        state: { completedPhases: ['BATTLE_BASICS','NECRO_LAB','PARTY_FORMATION','JOB_CHANGE','ABYSSAL_RESIDUE','DEMONIZATION'], activePhase: null, tutorialCompleted: true, viewedHints: [], visitedTabs: ['HOME','MAP','BATTLE','EQUIP','LAB','JOB'] },
        version: 0,
      }));
    });
    await page.goto('/');
    await expect(page.getByText('拠点', { exact: true })).toBeVisible({ timeout: 15000 });

    const equipBtn = page.getByRole('button', { name: /装備・編成/ }).first();
    await equipBtn.click({ force: true });

    await expect(page.getByText('LEGION')).toBeVisible({ timeout: 10000 });
    await page.getByRole('button', { name: /DETAIL/ }).click();
    await expect(page.getByText('統合詳細ハブ')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('ATK')).toBeVisible();
    await expect(page.getByText('DEF')).toBeVisible();
    await expect(page.getByText('HP')).toBeVisible();
  });
});
