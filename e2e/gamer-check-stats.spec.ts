import { test, expect } from '@playwright/test';

test('戦績モーダルおよびアタック中の挙動詳細検証', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('algo_tutorial_skip_prompt', 'true');
  });
  await page.goto('/');

  // ゲーム開始
  await page.click('[data-testid="btn-start-game"]');
  await page.waitForTimeout(500);

  // 戦績ボタンをクリック
  const statsBtn = page.locator('[data-testid="btn-open-stats"]');
  await expect(statsBtn).toBeVisible();
  await statsBtn.click();
  await page.waitForTimeout(500);

  // 戦績モーダル撮影
  await page.screenshot({ path: 'e2e/screenshots/phase2-gamer-stats-modal-open.png' });

  // 閉じる
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);

  // ドローして相手カードを選択
  await page.click('[data-testid="btn-draw-card"][role="button"]', { force: true });
  await page.waitForTimeout(400);
  await page.locator('[data-testid="opponent-card-0"]').first().click({ force: true });
  await page.waitForTimeout(400);

  // アタックモーダル内で数字キーボード入力や直接決定ができるか？
  // 数字キー "3" を押してみる
  await page.keyboard.press('Digit3');
  await page.waitForTimeout(200);
  await page.screenshot({ path: 'e2e/screenshots/phase2-gamer-attack-modal-digit3.png' });
});
