import { test, expect, Page } from '@playwright/test';

test.describe('Phase 2 刷新後 モダンゲーマー実機徹底プレイ検証', () => {
  test.beforeEach(async ({ page }) => {
    // チュートリアルプロンプトをスキップ
    await page.addInitScript(() => {
      window.localStorage.setItem('algo_tutorial_skip_prompt', 'true');
    });
    await page.goto('/');
  });

  test('プレイ 1: デッキトラッカーHUDとアタックモーダル重なり＆情報アクセシビリティ検証', async ({ page }) => {
    test.setTimeout(120000);

    // 2人、Normal、無制限で開始
    await page.click('[data-testid="btn-select-player-count-2"]');
    await page.click('[data-testid="btn-select-difficulty-normal"]');
    await page.click('[data-testid="btn-select-time-limit-0"]');
    await page.click('[data-testid="btn-start-game"]');

    // 盤面初期表示スクリーンショット（デッキトラッカーHUD表示状態）
    await page.waitForTimeout(600);
    await page.screenshot({ path: 'e2e/screenshots/phase2-gamer-01-board-init.png' });

    // デッキトラッカーHUDの存在確認
    const deckTracker = page.locator('[data-testid="deck-tracker"]');
    console.log(`[Play 1] デッキトラッカー表示: ${await deckTracker.count()}`);

    // ドロー
    const drawBtn = page.locator('[data-testid="btn-draw-card"][role="button"]');
    await drawBtn.click({ force: true });
    await page.waitForTimeout(400);

    // 相手の伏せカードをクリックしてアタックモーダルを開く
    const oppCard = page.locator('[data-testid="opponent-card-0"]').first();
    await oppCard.click({ force: true });
    await page.waitForTimeout(400);

    const attackModal = page.locator('[data-testid="attack-modal"]');
    await expect(attackModal).toBeVisible();

    // アタックモーダルが開いている最中に、デッキトラッカーHUDが見えているか？
    // スクリーンショット撮影
    await page.screenshot({ path: 'e2e/screenshots/phase2-gamer-02-attack-modal-tracker-overlap.png' });

    // アタックモーダル内で数字を選択してアタック
    const numBtn = page.locator('[data-testid^="btn-guess-num-"]').first();
    await numBtn.click();
    await page.locator('[data-testid="btn-confirm-attack"]').click();
    await page.waitForTimeout(500);

    // 結果モーダル（OKボタン）
    const okBtn = page.locator('[data-testid="btn-attack-result-ok"]');
    if (await okBtn.isVisible()) {
      await page.screenshot({ path: 'e2e/screenshots/phase2-gamer-03-attack-result.png' });
      await okBtn.click();
    }
  });

  test('プレイ 2: 通算戦績（Stats）モーダルおよび実績解除（Achievements）のUI・ゲーミフィケーション検証', async ({ page }) => {
    test.setTimeout(120000);

    // ヘッダーの戦績ボタンをクリック
    const statsBtn = page.locator('[data-testid="btn-open-stats"]');
    console.log(`[Play 2] 戦績ボタンカウント: ${await statsBtn.count()}`);
    if (await statsBtn.isVisible()) {
      await statsBtn.click();
      await page.waitForTimeout(400);
      const statsModal = page.locator('[data-testid="modal-stats"]');
      await expect(statsModal).toBeVisible();
      await page.screenshot({ path: 'e2e/screenshots/phase2-gamer-04-stats-modal.png' });

      // 実績タブまたはセクションの確認
      const achievementSection = page.locator('[data-testid="achievement-item"]');
      console.log(`[Play 2] 実績項目数: ${await achievementSection.count()}`);

      // 閉じる
      await page.keyboard.press('Escape');
    }
  });

  test('プレイ 3: 4人対戦でのCPUドロー色表示・挿入ハイライト（NEW!）および脱落自動観戦の通し検証', async ({ page }) => {
    test.setTimeout(180000);

    // 4人、Hard、無制限
    await page.click('[data-testid="btn-select-player-count-4"]');
    await page.click('[data-testid="btn-select-difficulty-hard"]');
    await page.click('[data-testid="btn-select-time-limit-0"]');
    await page.click('[data-testid="btn-start-game"]');

    console.log('[Play 3] 4人対戦開始');
    await page.waitForTimeout(600);
    await page.screenshot({ path: 'e2e/screenshots/phase2-gamer-05-4p-start.png' });

    // プレイヤーが意図的にハズレてCPU手番へ回す
    const drawBtn = page.locator('[data-testid="btn-draw-card"][role="button"]');
    if (await drawBtn.isVisible()) {
      await drawBtn.click({ force: true });
      await page.waitForTimeout(400);
      const oppCard = page.locator('[data-testid="opponent-card-0"]').first();
      await oppCard.click({ force: true });
      await page.locator('[data-testid^="btn-guess-num-"]').last().click();
      await page.locator('[data-testid="btn-confirm-attack"]').click();
      await page.waitForTimeout(400);
      const okBtn = page.locator('[data-testid="btn-attack-result-ok"]');
      if (await okBtn.isVisible()) {
        await okBtn.click();
      }
    }

    // CPUの行動中の画面キャプチャ（ドロー表示・挿入NEWバッジ等）
    await page.waitForTimeout(1800);
    await page.screenshot({ path: 'e2e/screenshots/phase2-gamer-06-cpu-acting-new-badge.png' });
  });

  test('プレイ 4: 音響システム（サウンド設定・ミュート・BGM/SEバランス）の検証', async ({ page }) => {
    test.setTimeout(60000);

    // ヘッダーのサウンドトグルボタン
    const soundToggle = page.locator('[data-testid="btn-toggle-sound"]');
    console.log(`[Play 4] サウンドトグル存在: ${await soundToggle.count()}`);
    if (await soundToggle.isVisible()) {
      await page.screenshot({ path: 'e2e/screenshots/phase2-gamer-07-sound-controls.png' });
    }
  });
});
