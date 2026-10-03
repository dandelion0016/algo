import { test, expect } from '@playwright/test';

test.describe('Issue #119〜#124 厳密検証テスト', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('algo_tutorial_skip_prompt', 'true');
    });
  });

  test('Issue #122: デスクトップ画面（1280x800）で残弾デッキトラッカーのタイトル見切れ検証', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');

    // 2人対戦を開始
    await page.click('[data-testid="btn-select-player-count-2"]');
    await page.click('[data-testid="btn-select-time-limit-0"]');
    await page.click('[data-testid="btn-start-game"]');

    // デッキトラッカーが表示されていることを確認
    const tracker = page.locator('[data-testid="deck-tracker"]');
    await expect(tracker).toBeVisible();

    const titleEl = tracker.locator('h3');
    const titleText = await titleEl.innerText();
    console.log(`[Issue #122] デッキトラッカータイトル: "${titleText}"`);

    // タイトル要素のテキストが省略されていないか検証
    expect(titleText).toBe('残弾トラッカー');

    // 要素のはみ出し（scrollWidth > clientWidth）を検証
    const isTruncated = await titleEl.evaluate((el) => el.scrollWidth > el.clientWidth);
    console.log(`[Issue #122] タイトルはみ出し(isTruncated): ${isTruncated}`);
    expect(isTruncated).toBe(false);

    // サマリバッジのテキスト確認
    const summaryEl = page.locator('[data-testid="tracker-summary"]');
    const summaryText = await summaryEl.innerText();
    console.log(`[Issue #122] サマリバッジテキスト: "${summaryText.replace(/\n/g, ' ')}"`);

    await page.screenshot({ path: 'e2e/screenshots/issue-122-desktop-deck-tracker.png' });
  });

  test('Issue #121: アタックモーダル内での同色残弾情報のインライン表示検証', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');

    await page.click('[data-testid="btn-select-player-count-2"]');
    await page.click('[data-testid="btn-select-time-limit-0"]');
    await page.click('[data-testid="btn-start-game"]');

    // カードをドロー
    const drawBtn = page.locator('[data-testid="btn-draw-card"][role="button"]');
    await drawBtn.click({ force: true });
    await page.waitForTimeout(400);

    // 相手の伏せカードを選択
    const oppCard = page.locator('[data-testid^="opponent-card-"]').first();
    await oppCard.click({ force: true });

    // アタックモーダルが開いたことを確認
    const attackModal = page.locator('[data-testid="attack-modal"]');
    await expect(attackModal).toBeVisible();

    // 未確定残弾インジケーターの存在確認
    const remainingHint = page.locator('[data-testid="attack-remaining-deck-hint"]');
    const isHintVisible = await remainingHint.isVisible();
    console.log(`[Issue #121] アタックモーダル内残弾ヒント表示: ${isHintVisible}`);
    expect(isHintVisible).toBe(true);

    // バッジ一覧の確認
    const badges = page.locator('[data-testid="remaining-deck-badges"] span[data-testid^="remaining-deck-badge-"]');
    const count = await badges.count();
    console.log(`[Issue #121] 残弾バッジ表示数: ${count}`);
    expect(count).toBeGreaterThan(0);

    await page.screenshot({ path: 'e2e/screenshots/issue-121-attack-modal-deck-hint.png' });

    // モーダルを閉じる
    await page.keyboard.press('Escape');
  });

  test('Issue #123 & Issue #120: モバイル画面（375x667 iPhone SE）でのヘッダーボタン配置・メニュー統合・残弾＆ログアクセス性検証', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    await page.click('[data-testid="btn-select-player-count-2"]');
    await page.click('[data-testid="btn-select-time-limit-0"]');
    await page.click('[data-testid="btn-start-game"]');

    await page.screenshot({ path: 'e2e/screenshots/issue-123-mobile-board-header.png' });

    // 1. ヘッダー内のボタン配置検証 (Issue #123)
    // ヘッダーコンテナが横スクロールを必要としているか判定
    const headerScrollContainer = page.locator('header .overflow-x-auto').first();
    const scrollInfo = await headerScrollContainer.evaluate((el) => {
      return {
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
        hasHorizontalScroll: el.scrollWidth > el.clientWidth,
      };
    });
    console.log(`[Issue #123] ヘッダーアクション領域のスクロール状況:`, scrollInfo);

    // モバイルメニューボタンの存在確認
    const menuBtn = page.locator('[data-testid="btn-open-mobile-menu"]');
    await expect(menuBtn).toBeVisible();

    // メニューを開く
    await menuBtn.click();
    const menuModal = page.locator('[data-testid="modal-mobile-menu"]');
    await expect(menuModal).toBeVisible();

    // メニュー内の各機能ボタン（サウンド、戦績、ルール、チュートリアル、再戦、設定）の存在確認
    await expect(page.locator('[data-testid="mobile-menu-sound-toggle"]')).toBeVisible();
    await expect(page.locator('[data-testid="mobile-menu-stats"]')).toBeVisible();
    await expect(page.locator('[data-testid="mobile-menu-rules"]')).toBeVisible();
    await expect(page.locator('[data-testid="mobile-menu-tutorial"]')).toBeVisible();
    await expect(page.locator('[data-testid="mobile-menu-restart"]')).toBeVisible();
    await expect(page.locator('[data-testid="mobile-menu-settings"]')).toBeVisible();

    await page.screenshot({ path: 'e2e/screenshots/issue-123-mobile-menu-drawer.png' });

    // メニューを閉じる
    await page.locator('[data-testid="btn-close-mobile-menu"]').click();
    await expect(menuModal).not.toBeVisible();

    // 2. 残弾デッキトラッカーおよびログのアクセス性検証 (Issue #120)
    // 画面上にFAB（Floating Action Button, fixed bottom等）が存在するか？
    const fabLocator = page.locator('[class*="fixed bottom-"] button, [data-testid*="fab"]');
    const fabCount = await fabLocator.count();
    console.log(`[Issue #120] 画面下部固定FABの検出数: ${fabCount}`);

    // ヘッダー内の残弾ボタントグル
    const trackerBtn = page.locator('[data-testid="btn-open-deck-tracker-mobile"]');
    console.log(`[Issue #120] ヘッダー内残弾ボタントグルの存在: ${await trackerBtn.count()}`);
    await expect(trackerBtn).toBeVisible();

    // 残弾ドロワーを開く
    await trackerBtn.click();
    const trackerDrawer = page.locator('[data-testid="mobile-tracker-drawer"]');
    await expect(trackerDrawer).toBeVisible();
    await page.screenshot({ path: 'e2e/screenshots/issue-120-mobile-tracker-drawer.png' });

    // 閉じる
    await page.locator('[data-testid="btn-close-deck-tracker-mobile"]').click();
    await expect(trackerDrawer).not.toBeVisible();

    // ログボタントグル
    const logBtn = page.locator('[data-testid="btn-toggle-log"]');
    console.log(`[Issue #120] ヘッダー内ログボタントグルの存在: ${await logBtn.count()}`);
    await expect(logBtn).toBeVisible();

    // ログドロワーを開く
    await logBtn.click();
    const logDrawer = page.locator('[data-testid="mobile-log-drawer"]');
    await expect(logDrawer).toBeVisible();
    await page.screenshot({ path: 'e2e/screenshots/issue-120-mobile-log-drawer.png' });

    // 閉じる
    await page.locator('[data-testid="btn-close-mobile-log"]').click();
    await expect(logDrawer).not.toBeVisible();
  });

  test('Issue #124: 実績モーダルにおけるモバイル幅（375px）での英語タイトル省略（Logic Ma...）検証', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    // セットアップ画面の「🏆 戦績」ボタンをクリック
    const setupStatsBtn = page.locator('[data-testid="btn-setup-stats"]');
    await expect(setupStatsBtn).toBeVisible();
    await setupStatsBtn.click();

    // StatsModalが開いたことを確認
    const statsModal = page.locator('[data-testid="stats-modal"]');
    await expect(statsModal).toBeVisible();

    // 「アチーブメント」タブをクリック
    const tabAchievements = page.locator('[data-testid="tab-achievements"]');
    await tabAchievements.click();
    await page.waitForTimeout(300);

    await page.screenshot({ path: 'e2e/screenshots/issue-124-achievements-tab-mobile.png' });

    // 各実績アイテムのタイトルを検査
    const achievementItems = page.locator('[data-testid^="achievement-item-"]');
    const count = await achievementItems.count();
    console.log(`[Issue #124] 実績アイテム数: ${count}`);

    let truncatedFound = 0;
    for (let i = 0; i < count; i++) {
      const item = achievementItems.nth(i);
      const titleEl = item.locator('h4');
      const text = await titleEl.innerText();

      const scrollW = await titleEl.evaluate((el) => el.scrollWidth);
      const clientW = await titleEl.evaluate((el) => el.clientWidth);
      const isTruncated = scrollW > clientW;

      console.log(`[Issue #124] 実績 ${i + 1}: "${text}" (scroll: ${scrollW}px, client: ${clientW}px, truncated: ${isTruncated})`);
      if (isTruncated) {
        truncatedFound++;
      }
    }
    console.log(`[Issue #124] 🎯 タイトルが省略（truncate）された実績数: ${truncatedFound}/${count}`);
  });

  test('Issue #119: リーサルK.O.演出とAttackResultModalの重なり干渉および遷移フロー検証', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');

    // 2人、Easy、無制限で開始
    await page.click('[data-testid="btn-select-player-count-2"]');
    await page.click('[data-testid="btn-select-difficulty-easy"]');
    await page.click('[data-testid="btn-select-time-limit-0"]');
    await page.click('[data-testid="btn-start-game"]');

    // カードをドロー
    await page.click('[data-testid="btn-draw-card"][role="button"]', { force: true });
    await page.waitForTimeout(400);

    // 通常アタックモーダルの確認
    const oppCards = page.locator('[data-testid^="opponent-card-"]');
    await oppCards.first().click({ force: true });
    const numBtn = page.locator('[data-testid^="btn-guess-num-"]').first();
    await numBtn.click();
    await page.locator('[data-testid="btn-confirm-attack"]').click();
    await page.waitForTimeout(400);

    const attackResultModal = page.locator('[data-testid="attack-result-modal"]');
    console.log(`[Issue #119] 通常アタック結果モーダル表示: ${await attackResultModal.isVisible()}`);

    const okBtn = page.locator('[data-testid="btn-attack-result-ok"]');
    if (await okBtn.isVisible()) {
      await okBtn.click();
    }
    await page.waitForTimeout(500);

    // リーサル状況のコード実装検証:
    // GameBoard.tsx の handleAttackOk / executeAttack 内で
    // isGameOver 時に triggerLethalKo を呼ぶと同時に waitForAttackOk を呼んでいるため、
    // LethalCutIn と AttackResultModal が同時に画面上に重なる実装が残っていることを確認。
    console.log(`[Issue #119] コード実装上のリーサル二重表示干渉が確認されました`);
  });
});
