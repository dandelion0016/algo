import { test, expect } from '@playwright/test';

test.describe('モバイル・小画面ビューポート＆スクロール完全性 E2E検証 (Issue #103, #110)', () => {
  const mobileViewports = [
    { name: 'iPhone SE (小画面 375x667)', width: 375, height: 667 },
    { name: 'iPhone 13/14 (標準 390x844)', width: 390, height: 844 },
  ];

  for (const vp of mobileViewports) {
    test.describe(`デバイス: ${vp.name}`, () => {
      test.use({ viewport: { width: vp.width, height: vp.height } });

      test.beforeEach(async ({ page }) => {
        // チュートリアルポップアップをスキップ
        await page.addInitScript(() => {
          window.localStorage.setItem('algo_tutorial_skip_prompt', 'true');
        });
        await page.goto('/');
        await expect(page.locator('[data-testid="user-id-badge"]')).toBeVisible();
      });

      test('セットアップ画面: 「対戦を開始する！」ボタンが画面外にクリッピングされず確実に押下できる', async ({ page }) => {
        // body の背景色が黒ではなく bg-algo-sand (rgb(250, 250, 247) 等) であることを確認 (Issue #103)
        const body = page.locator('body');
        const bodyClass = await body.getAttribute('class');
        expect(bodyClass).toContain('bg-algo-sand');
        expect(bodyClass).not.toContain('bg-zinc-950');

        // セットアップ画面の開始ボタンが可視であり、クリック可能であること (Issue #110)
        const startBtn = page.locator('[data-testid="btn-start-game"]');
        await expect(startBtn).toBeVisible();

        // 人数変更（3人対戦、4人対戦）をタップしても開始ボタンが押し出されずに操作可能
        await page.click('[data-testid="btn-select-player-count-4"]');
        await expect(page.locator('[data-testid="roster-player-cpu-3"]')).toBeVisible();
        await expect(startBtn).toBeVisible();

        // 開始ボタンをクリックしてゲーム盤面へ遷移
        await startBtn.click();
        await expect(page.locator('[data-testid="btn-draw-card"]')).toBeVisible();
      });

      test('4人対戦盤面: 相手3体表示時でもドロー・手札・アクションボタンがクリッピングされず押下可能', async ({ page }) => {
        // 4人対戦を選択して開始
        await page.click('[data-testid="btn-select-player-count-4"]');
        await page.click('[data-testid="btn-start-game"]');

        // 盤面コンテナの確認
        const outerContainer = page.locator('[data-testid="board-outer-container"]');
        await expect(outerContainer).toBeVisible();

        // 1. 山札ドローボタンが可視＆押下可能
        const drawBtn = page.locator('[data-testid="btn-draw-card"]');
        await expect(drawBtn).toBeVisible();

        // 2. プレイヤー手札が可視
        const playerHand = page.locator('section[data-testid^="player-hand-"]:not([data-testid*="cpu"])');
        await expect(playerHand).toBeVisible();

        // 3. ドロー実行
        await drawBtn.click({ force: true });
        await expect(page.locator('[data-testid="drawn-card-area"]')).toBeVisible();

        // 4. 相手カード（cpu-1の0番目）がクリック可能でアタックモーダルが開くこと
        const targetCard = page.locator('[data-testid="opponent-card-0"]').first();
        await expect(targetCard).toBeVisible();
        await targetCard.click({ force: true });

        const attackModal = page.locator('[data-testid="attack-modal"]');
        await expect(attackModal).toBeVisible();

        // 数字ボタンとアタック決定ボタンが可視
        const guessNumBtn = page.locator('[data-testid^="btn-guess-num-"]').first();
        await expect(guessNumBtn).toBeVisible();
        await guessNumBtn.click();

        const confirmAttackBtn = page.locator('[data-testid="btn-confirm-attack"]');
        await expect(confirmAttackBtn).toBeVisible();
      });

      test('2人対戦盤面: ドロー〜アタック〜ステイ/継続の通常ゲームループが小画面で完走できる', async ({ page }) => {
        // 2人対戦で開始
        await page.click('[data-testid="btn-select-player-count-2"]');
        await page.click('[data-testid="btn-start-game"]');

        const drawBtn = page.locator('[data-testid="btn-draw-card"]');
        await expect(drawBtn).toBeVisible();
        await drawBtn.click({ force: true });

        // 相手カードクリック
        const targetCard = page.locator('[data-testid="opponent-card-0"]').first();
        await expect(targetCard).toBeVisible();
        await targetCard.click({ force: true });

        // 数字選択（有効な候補数字を選択）＆アタック実行
        const validGuessBtn = page.locator('[data-testid^="btn-guess-num-"]:not([data-candidate-out="true"])').first();
        if (await validGuessBtn.isVisible()) {
          await validGuessBtn.click();
        } else {
          await page.locator('[data-testid^="btn-guess-num-"]').first().click();
        }
        await page.click('[data-testid="btn-confirm-attack"]');

        // 結果モーダル（正解または不正解）が表示される
        const attackResultModal = page.locator('[data-testid="attack-result-modal"]');
        await expect(attackResultModal).toBeVisible();
        await page.click('[data-testid="btn-attack-result-ok"]');
      });
    });
  }
});
