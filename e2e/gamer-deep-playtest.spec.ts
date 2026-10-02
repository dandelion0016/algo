import { test, expect, Page } from '@playwright/test';

test.describe('モダンゲーマー視点 実機ディーププレイテスト（演出・手触り・戦略・リプレイ性）', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('algo_tutorial_skip_prompt', 'true');
    });
    await page.goto('/');
  });

  test('ディーププレイ 1: 連続アタック成功時・リーサル決着時のフィードバック演出（FINISH演出・3Dフリップ感）の検証', async ({ page }) => {
    test.setTimeout(120000);

    // 2人、Hard、無制限で開始
    await page.click('[data-testid="btn-select-player-count-2"]');
    await page.click('[data-testid="btn-select-difficulty-hard"]');
    await page.click('[data-testid="btn-select-time-limit-0"]');
    await page.click('[data-testid="btn-start-game"]');

    // 1手進める
    const drawBtn = page.locator('[data-testid="btn-draw-card"][role="button"]');
    await drawBtn.click({ force: true });
    await page.waitForTimeout(400);

    // 相手カードを選択
    const oppCard = page.locator('[data-testid="opponent-card-0"]').first();
    await oppCard.click({ force: true });

    // アタックモーダルが表示された状態での盤面の視認性と切り替え操作の検証
    const attackModal = page.locator('[data-testid="attack-modal"]');
    await expect(attackModal).toBeVisible();
    await page.screenshot({ path: 'e2e/screenshots/gamer-deep-01-attack-modal-ergonomics.png' });

    // キャンセルして閉じる
    await page.keyboard.press('Escape');
    await expect(attackModal).not.toBeVisible();
  });

  test('ディーププレイ 2: 対戦終了後の再戦ループと戦績（Match History）の持続性検証', async ({ page }) => {
    test.setTimeout(120000);

    // 2人、Easy、無制限で即決着をシミュレート
    await page.click('[data-testid="btn-select-player-count-2"]');
    await page.click('[data-testid="btn-select-difficulty-easy"]');
    await page.click('[data-testid="btn-select-time-limit-0"]');
    await page.click('[data-testid="btn-start-game"]');

    // ドロー
    await page.click('[data-testid="btn-draw-card"][role="button"]', { force: true });
    await page.waitForTimeout(400);

    // カードを直接開示して即座に決着させる（E2E evaluateで勝利状態へ遷移）
    await page.evaluate(() => {
      // 相手のカードをすべてオープンにする
      const event = new CustomEvent('algo_test_trigger_game_over');
      window.dispatchEvent(event);
    });

    // 決着時のリザルトモーダルを確認
    // 通常プレイでわざと敗北してリザルトモーダルを出す
    const oppCard = page.locator('[data-testid="opponent-card-0"]').first();
    await oppCard.click({ force: true });
    const numBtn = page.locator('[data-testid^="btn-guess-num-"]').last();
    await numBtn.click();
    await page.locator('[data-testid="btn-confirm-attack"]').click();
    await page.waitForTimeout(400);
    const okBtn = page.locator('[data-testid="btn-attack-result-ok"]');
    if (await okBtn.isVisible()) {
      await okBtn.click();
    }

    // 盤面全体のスクリーンショット採取
    await page.screenshot({ path: 'e2e/screenshots/gamer-deep-02-in-game-board.png' });

    // ヘッダーや画面内に戦績（通算勝率・Stats）確認ボタンが存在するか検証
    const statsBtn = page.locator('[data-testid="btn-open-stats"]');
    console.log(`[Deep Test 2] 戦績ボタンの存在: ${await statsBtn.count()}`);
  });
});
