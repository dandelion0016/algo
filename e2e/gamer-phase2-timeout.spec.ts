import { test, expect } from '@playwright/test';

test.describe('タイムアップ挙動実機検証', () => {
  test('制限時間15秒での自動ドロー・強制オープン・警告音・バナー演出', async ({ page }) => {
    test.setTimeout(60000);
    await page.addInitScript(() => {
      window.localStorage.setItem('algo_tutorial_skip_prompt', 'true');
    });
    await page.goto('/');

    // 2人、Normal、15秒
    await page.click('[data-testid="btn-select-player-count-2"]');
    await page.click('[data-testid="btn-select-difficulty-normal"]');
    await page.click('[data-testid="btn-select-time-limit-15"]');
    await page.click('[data-testid="btn-start-game"]');
    await page.waitForTimeout(500);

    // 盤面初期状態（残り15秒）
    await page.screenshot({ path: 'e2e/screenshots/audit-timeout-01-start.png' });

    // 残り5秒以下の警告演出を確認するため、残り時間ステートを5秒以下にするか、待つ
    // ここでは確実に挙動を記録するため、__algoGameStateで残り時間を3秒にセット
    await page.evaluate(() => {
      const gs = (window as any).__algoGameState;
      if (gs) {
        (window as any).__setGameState({ ...gs, remainingTime: 3 });
      }
    });

    await page.waitForTimeout(400);
    // 残り3秒の警告色（ローズレッド・パルス）キャプチャ
    await page.screenshot({ path: 'e2e/screenshots/audit-timeout-02-warning.png' });

    // タイマーが0になりタイムアップするのを待つ（約3.5秒）
    await page.waitForTimeout(3500);
    // タイムアップ後の自動ドロー＆強制オープン＆警告バナーキャプチャ
    await page.screenshot({ path: 'e2e/screenshots/audit-timeout-03-timeup.png' });
  });
});
