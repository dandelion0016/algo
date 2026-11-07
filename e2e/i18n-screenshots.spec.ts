import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

test.describe('Issue #162: i18n 英語UI・言語切り替え・レスポンシブ実機スクリーンショット検証', () => {
  const outputDir = path.resolve('e2e/screenshots/issue-162');

  test.beforeAll(() => {
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
  });

  test('デスクトップ (1280x800): 日本語から英語へ切り替え、セットアップ画面と盤面レイアウトを撮影', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    await page.addInitScript(() => {
      window.localStorage.setItem('algo_tutorial_skip_prompt', 'true');
    });

    await page.goto('/');
    await expect(page.locator('[data-testid="user-id-badge"]')).toBeVisible();

    // 1. 初期状態 (JA) セットアップ画面のスクリーンショット
    await page.screenshot({ path: path.join(outputDir, 'desktop-setup-ja.png') });

    // 2. 英語へ切り替え (EN)
    const setupLangToggle = page.locator('[data-testid="setup-language-toggle"]');
    await expect(setupLangToggle).toBeVisible();
    await setupLangToggle.click();

    // 英語ボタンが表示されることを確認
    await expect(page.locator('[data-testid="btn-start-game"]')).toContainText('Start Battle!');
    await page.screenshot({ path: path.join(outputDir, 'desktop-setup-en.png') });

    // 3. 対戦開始
    await page.click('[data-testid="btn-start-game"]');

    // 盤面表示待機
    const drawBtn = page.locator('[data-testid="btn-draw-card"]');
    await expect(drawBtn).toBeVisible();
    const deckBar = page.locator('[data-testid="deck-action-bar"]');
    await expect(deckBar).toBeVisible();

    // 英語ヘッダーボタンの表示確認
    await expect(page.locator('[data-testid="btn-header-tutorial"]')).toContainText('Tutorial');
    await expect(page.locator('[data-testid="btn-open-rules"]')).toContainText('Rules');
    await expect(page.locator('[data-testid="btn-open-stats"]')).toContainText('Stats');

    // 4. デスクトップ英語盤面スクリーンショット
    await page.screenshot({ path: path.join(outputDir, 'desktop-board-en.png') });

    // 5. ヘッダーのスイッチで日本語に戻す
    const headerLangToggle = page.locator('[data-testid="header-language-toggle"]');
    await expect(headerLangToggle).toBeVisible();
    await headerLangToggle.click();

    await expect(page.locator('[data-testid="btn-open-rules"]')).toContainText('ルール');
    await page.screenshot({ path: path.join(outputDir, 'desktop-board-ja.png') });
  });

  test('モバイル (375x667): 英語モードでの1画面収まり、モバイルメニュー内での言語切り替えを撮影', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    await page.addInitScript(() => {
      window.localStorage.setItem('algo_tutorial_skip_prompt', 'true');
      window.localStorage.setItem('algo_language', 'en'); // 英語を初期設定
    });

    await page.goto('/');
    await expect(page.locator('[data-testid="user-id-badge"]')).toBeVisible();

    // モバイル英語セットアップ画面
    await page.screenshot({ path: path.join(outputDir, 'mobile-setup-en.png') });

    // 対戦開始
    await page.click('[data-testid="btn-start-game"]');

    // 盤面表示待機
    const drawBtn = page.locator('[data-testid="btn-draw-card"]');
    await expect(drawBtn).toBeVisible();
    await page.screenshot({ path: path.join(outputDir, 'mobile-board-en.png') });

    // メニューを開く
    const menuBtn = page.locator('[data-testid="btn-open-mobile-menu"]');
    await expect(menuBtn).toBeVisible();
    await menuBtn.click();

    const mobileMenu = page.locator('[data-testid="modal-mobile-menu"]');
    await expect(mobileMenu).toBeVisible();

    // モバイルメニュー（英語）スクリーンショット
    await page.screenshot({ path: path.join(outputDir, 'mobile-menu-en.png') });

    // メニュー内で日本語に切り替え
    const menuLangToggle = mobileMenu.locator('[data-testid="mobile-menu-language-toggle"]');
    await expect(menuLangToggle).toBeVisible();
    await menuLangToggle.click();

    // メニュー内が日本語に切り替わったことを確認
    await expect(mobileMenu.locator('[data-testid="mobile-menu-rules"]')).toContainText('ルール');
    await page.screenshot({ path: path.join(outputDir, 'mobile-menu-ja.png') });

    // メニューを閉じる
    await page.click('[data-testid="btn-close-mobile-menu"]');
    await expect(mobileMenu).not.toBeVisible();

    // 盤面が日本語に戻っていることを確認
    await page.screenshot({ path: path.join(outputDir, 'mobile-board-ja.png') });
  });
});
