import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

test.describe('Issue #131: 2人・3人・4人対戦レイアウト実機スクリーンショット検証', () => {
  const outputDir = path.resolve('docs/screenshots/issue-131');

  test.beforeAll(() => {
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
  });

  const testCases = [
    { playerCount: 2, name: '2players' },
    { playerCount: 3, name: '3players' },
    { playerCount: 4, name: '4players' },
  ];

  const viewports = [
    { name: 'desktop', width: 1280, height: 720 },
    { name: 'mobile', width: 375, height: 667 },
  ];

  for (const vp of viewports) {
    for (const tc of testCases) {
      test(`${tc.playerCount}人対戦 (${vp.name}: ${vp.width}x${vp.height}) 盤面スクリーンショット撮影`, async ({ page }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height });

        // チュートリアルモーダルをスキップ
        await page.addInitScript(() => {
          window.localStorage.setItem('algo_tutorial_skip_prompt', 'true');
        });

        await page.goto('/');
        await expect(page.locator('[data-testid="user-id-badge"]')).toBeVisible();

        // プレイヤー人数を選択
        await page.click(`[data-testid="btn-select-player-count-${tc.playerCount}"]`);

        // 対戦開始
        const startBtn = page.locator('[data-testid="btn-start-game"]');
        await expect(startBtn).toBeVisible();
        await startBtn.click();

        // 盤面表示待機
        const drawBtn = page.locator('[data-testid="btn-draw-card"]');
        await expect(drawBtn).toBeVisible();
        const deckBar = page.locator('[data-testid="deck-action-bar"]');
        await expect(deckBar).toBeVisible();

        // スクリーンショット撮影
        const filename = `${tc.name}-${vp.name}.png`;
        const filePath = path.join(outputDir, filename);
        await page.screenshot({ path: filePath, fullPage: false });

        expect(fs.existsSync(filePath)).toBe(true);
      });
    }
  }
});
