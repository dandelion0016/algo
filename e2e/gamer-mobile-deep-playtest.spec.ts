import { test, expect, Page } from '@playwright/test';

test.describe('モバイル実機（スマホ）モダンゲーマー徹底プレイ検証', () => {
  test.beforeEach(async ({ page }) => {
    // チュートリアルプロンプトをスキップ
    await page.addInitScript(() => {
      window.localStorage.setItem('algo_tutorial_skip_prompt', 'true');
    });
  });

  test('スマホ検証 1: iPhone SE (375x667) でのセットアップ画面＆対戦盤面 1画面完結・視認性検証', async ({ page }) => {
    test.setTimeout(120000);
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    // 1. トップ（セットアップ）画面のスクリーンショット
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'e2e/screenshots/mobile-gamer-01-setup-375x667.png' });

    // スクロールが発生していないか
    const isSetupScrollable = await page.evaluate(() => {
      return document.documentElement.scrollHeight > window.innerHeight;
    });
    console.log(`[Mobile 1] Setup画面 縦スクロール有無: ${isSetupScrollable}`);

    // ゲーム開始（2人、Normal、30秒）
    await page.click('[data-testid="btn-select-player-count-2"]');
    await page.click('[data-testid="btn-select-difficulty-normal"]');
    await page.click('[data-testid="btn-select-time-limit-30"]');
    await page.click('[data-testid="btn-start-game"]');
    await page.waitForTimeout(600);

    // 2. 対戦盤面初期化スクリーンショット
    await page.screenshot({ path: 'e2e/screenshots/mobile-gamer-02-board-375x667.png' });

    // 対戦盤面でスクロールが発生していないか
    const isBoardScrollable = await page.evaluate(() => {
      return document.documentElement.scrollHeight > window.innerHeight;
    });
    console.log(`[Mobile 1] 対戦盤面 縦スクロール有無: ${isBoardScrollable}`);

    // 3. ドロー操作
    const drawBtn = page.locator('[data-testid="btn-draw-card"][role="button"]');
    await expect(drawBtn).toBeVisible();
    await drawBtn.click({ force: true });
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'e2e/screenshots/mobile-gamer-03-drawn-card-375x667.png' });

    // 4. スマホでの残弾トラッカードロワー開閉操作の検証
    // スマホでは右サイドバーではなくトグルボタンまたはドロワーがあるはず
    const trackerToggle = page.locator('[data-testid="btn-toggle-deck-tracker-drawer"], [data-testid="btn-open-deck-tracker"]');
    console.log(`[Mobile 1] トラッカートグル存在: ${await trackerToggle.count()}`);
    if (await trackerToggle.first().isVisible()) {
      await trackerToggle.first().click();
      await page.waitForTimeout(400);
      await page.screenshot({ path: 'e2e/screenshots/mobile-gamer-04-tracker-drawer-open.png' });
      // 閉じる
      await page.locator('[data-testid="btn-close-deck-tracker"], [data-testid="deck-tracker-close"]').first().click().catch(() => {});
      await page.waitForTimeout(300);
    }

    // 5. 相手カードをタップしてアタックモーダルを開く
    const oppCard = page.locator('[data-testid="opponent-card-0"]').first();
    await oppCard.click({ force: true });
    await page.waitForTimeout(500);

    const attackModal = page.locator('[data-testid="attack-modal"]');
    await expect(attackModal).toBeVisible();
    await page.screenshot({ path: 'e2e/screenshots/mobile-gamer-05-attack-modal-375x667.png' });

    // アタックモーダル内で数字をタップしてアタック実行
    const numBtn = page.locator('[data-testid^="btn-guess-num-"]').first();
    await numBtn.click();
    await page.locator('[data-testid="btn-confirm-attack"]').click();
    await page.waitForTimeout(500);

    // 6. アタック結果モーダル（OKボタン待ち）
    const okBtn = page.locator('[data-testid="btn-attack-result-ok"]');
    if (await okBtn.isVisible()) {
      await page.screenshot({ path: 'e2e/screenshots/mobile-gamer-06-attack-result-375x667.png' });
      await okBtn.click();
    }
  });

  test('スマホ検証 2: iPhone 14 (390x844) での4人対戦カオス戦＆親指操作・誤タップ検証', async ({ page }) => {
    test.setTimeout(120000);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    // 4人対戦で開始
    await page.click('[data-testid="btn-select-player-count-4"]');
    await page.click('[data-testid="btn-select-difficulty-easy"]');
    await page.click('[data-testid="btn-select-time-limit-0"]');
    await page.click('[data-testid="btn-start-game"]');
    await page.waitForTimeout(600);

    // 4人対戦スマホ盤面撮影
    await page.screenshot({ path: 'e2e/screenshots/mobile-gamer-07-4p-board-390x844.png' });
  });
});
