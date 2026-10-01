import { test, expect } from '@playwright/test';

test.describe('アルゴ（algo）Web対戦システム E2E シナリオ検証', () => {
  test.beforeEach(async ({ page }) => {
    // チュートリアルプロンプトモーダルをスキップ済みに設定
    await page.addInitScript(() => {
      window.localStorage.setItem('algo_tutorial_skip_prompt', 'true');
    });
    // ページへ移動し、ロード完了を待機
    await page.goto('/');
    await expect(page.locator('[data-testid="user-id-badge"]')).toBeVisible();
  });

  test('シナリオ 1 (SCR-001): セットアップ画面の動的プレビューと設定変更', async ({ page }) => {
    // 1. ゲストIDバッジの確認
    const userIdBadge = page.locator('[data-testid="user-id-badge"]');
    await expect(userIdBadge).toBeVisible();
    await expect(userIdBadge).toContainText('ゲストID:');

    // 2. 初期対戦人数（2人）と山札枚数（16枚）の確認
    const deckCountBadge = page.locator('[data-testid="deck-count-badge"]');
    await expect(deckCountBadge).toContainText('16枚');

    // 3. 3人対戦への切り替えと動的プレビュー確認
    await page.click('[data-testid="btn-select-player-count-3"]');
    await expect(deckCountBadge).toContainText('15枚');
    await expect(page.locator('[data-testid="roster-player-cpu-1"]')).toBeVisible();
    await expect(page.locator('[data-testid="roster-player-cpu-2"]')).toBeVisible();

    // 4. 4人対戦への切り替えと動的プレビュー確認
    await page.click('[data-testid="btn-select-player-count-4"]');
    await expect(deckCountBadge).toContainText('12枚');
    await expect(page.locator('[data-testid="roster-player-cpu-3"]')).toBeVisible();

    // 5. 持ち時間と難易度の変更
    await page.click('[data-testid="btn-select-time-limit-15"]');
    await page.click('[data-testid="btn-select-difficulty-hard"]');

    // 6. 2人対戦へ戻す
    await page.click('[data-testid="btn-select-player-count-2"]');
    await expect(deckCountBadge).toContainText('16枚');

    // 7. スクリーンショット撮影 (SCR-001)
    await page.screenshot({ path: 'e2e/screenshots/01-setup-screen.png' });
  });

  test('シナリオ 2 (SCR-002): ゲーム開始・盤面表示・配札整列の確認', async ({ page }) => {
    // ゲーム開始ボタンをクリック
    await page.click('[data-testid="btn-start-game"]');

    // 盤面コンポーネントの表示待機
    await expect(page.locator('[data-testid="btn-draw-card"]')).toBeVisible();

    // プレイヤー手札の確認 (2人対戦時は4枚)
    // プレイヤーの手札エリアは cpu 以外の player-hand
    const playerHand = page.locator('section[data-testid^="player-hand-"]:not([data-testid*="cpu"])');
    await expect(playerHand).toBeVisible();
    const playerCards = playerHand.locator('[data-testid="card-element"]');
    await expect(playerCards).toHaveCount(4);

    // 対戦相手手札の確認 (2人対戦時は4枚)
    const oppHand = page.locator('[data-testid="player-hand-cpu-1"]');
    await expect(oppHand).toBeVisible();
    const oppCards = oppHand.locator('[data-testid="card-element"]');
    await expect(oppCards).toHaveCount(4);

    // スクリーンショット撮影 (SCR-002)
    await page.screenshot({ path: 'e2e/screenshots/02-game-board-init.png' });
  });

  test('シナリオ 3 (SCR-003 / SCR-004): ドロー＆アタックフローの完走', async ({ page }) => {
    // ゲーム開始
    await page.click('[data-testid="btn-start-game"]');
    const drawCardBtn = page.locator('[data-testid="btn-draw-card"]');
    await expect(drawCardBtn).toBeVisible();

    // 1. 山札をクリックしてドロー（CSSアニメーションの安定待機をバイパスするため force: true）
    await drawCardBtn.click({ force: true });

    // 2. 引いたカード領域の表示確認
    const drawnCardArea = page.locator('[data-testid="drawn-card-area"]');
    await expect(drawnCardArea).toBeVisible();
    await page.screenshot({ path: 'e2e/screenshots/04-player-drawn-card.png' });

    // 3. 相手の1枚目の伏せカードをクリック（CSSアニメーション待機をバイパスするため force: true）
    const targetCard = page.locator('[data-testid="opponent-card-0"]');
    await expect(targetCard).toBeVisible();
    await targetCard.click({ force: true });

    // 4. アタックモーダルの表示確認
    const attackModal = page.locator('[data-testid="attack-modal"]');
    await expect(attackModal).toBeVisible();
    await page.screenshot({ path: 'e2e/screenshots/05-attack-modal-opened.png' });

    // 5. 推理数字（利用可能な最初の数字ボタン）を選択
    const guessBtn = page.locator('[data-testid^="btn-guess-num-"]').first();
    await guessBtn.click();

    // 6. アタック実行
    const confirmAttackBtn = page.locator('[data-testid="btn-confirm-attack"]');
    await expect(confirmAttackBtn).toBeEnabled();
    await confirmAttackBtn.click();

    // 7. モーダルが閉じてアタック結果が反映されることを確認
    await expect(attackModal).not.toBeVisible();

    // アタック後の状態（ステイ/継続ボタン、またはペナルティオープン反映）を撮影
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'e2e/screenshots/06-attack-result.png' });
  });

  test('シナリオ 4 (SCR-007 / SCR-008): モーダル開閉とHITL操作ガード（確認・タイマー停止）', async ({ page }) => {
    // 1. セットアップ画面でルールモーダルを開く
    await page.click('[data-testid="btn-setup-rules"]');
    const ruleModal = page.locator('[data-testid="rule-guide-modal"]');
    await expect(ruleModal).toBeVisible();
    await page.screenshot({ path: 'e2e/screenshots/03-rule-guide-modal.png' });

    // ルールモーダルを閉じる
    await page.click('[data-testid="btn-close-rules"]');
    await expect(ruleModal).not.toBeVisible();

    // 2. 対戦を開始する (持ち時間15秒を設定)
    await page.click('[data-testid="btn-select-time-limit-15"]');
    await page.click('[data-testid="btn-start-game"]');
    await expect(page.locator('[data-testid="timer-display"]')).toBeVisible();

    // 3. 盤面からルールモーダルを開いて閉じる
    await page.click('[data-testid="btn-open-rules"]');
    await expect(ruleModal).toBeVisible();
    await page.click('[data-testid="btn-close-rules"]');
    await expect(ruleModal).not.toBeVisible();

    // 4. HITL操作ガード: 「設定に戻る」ボタン押下
    await page.click('[data-testid="btn-open-settings"]');
    const confirmModal = page.locator('[data-testid="modal-confirm"]');
    await expect(confirmModal).toBeVisible();

    // タイマーが一時停止状態（PAUSED）になっていることを確認
    const timerDisplay = page.locator('[data-testid="timer-display"]');
    await expect(timerDisplay).toContainText('PAUSED');
    await page.screenshot({ path: 'e2e/screenshots/13-hitl-confirm-modal.png' });

    // 5. キャンセル操作: 盤面に戻りタイマーが再開
    await page.click('[data-testid="btn-cancel-action"]');
    await expect(confirmModal).not.toBeVisible();

    // 6. 再度「設定に戻る」から確認ボタン押下でセットアップ画面へ復帰
    await page.click('[data-testid="btn-open-settings"]');
    await expect(confirmModal).toBeVisible();
    await page.click('[data-testid="btn-confirm-action"]');

    // セットアップ画面に戻ったことを確認
    await expect(page.locator('[data-testid="btn-start-game"]')).toBeVisible();
  });

  test('シナリオ 5 (RESPONSIVE): マルチデバイス・レスポンシブ検証', async ({ page }) => {
    // デスクトップ表示 (1280x800)
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.click('[data-testid="btn-start-game"]');
    await expect(page.locator('[data-testid="btn-draw-card"]')).toBeVisible();
    await page.screenshot({ path: 'e2e/screenshots/14-responsive-pc.png' });

    // モバイル表示 (375x667)
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(page.locator('[data-testid="btn-draw-card"]')).toBeVisible();
    await page.screenshot({ path: 'e2e/screenshots/16-responsive-mobile.png' });
  });

  test('シナリオ 6 (RESPONSIVE-MOBILE-SETUP): モバイル(375x667)でのSetup画面1画面完結・スクロール不要レイアウト検証 (Issue #49)', async ({ page }) => {
    // モバイルビューポート (iPhone SE: 375x667) に設定
    await page.setViewportSize({ width: 375, height: 667 });

    // セットアップ画面の主要要素がすべて表示されていることを確認
    await expect(page.locator('[data-testid="user-id-badge"]')).toBeVisible();
    await expect(page.locator('[data-testid="btn-select-player-count-2"]')).toBeVisible();
    await expect(page.locator('[data-testid="btn-select-time-limit-30"]')).toBeVisible();
    await expect(page.locator('[data-testid="btn-select-difficulty-normal"]')).toBeVisible();
    await expect(page.locator('[data-testid="btn-setup-rules"]')).toBeVisible();
    await expect(page.locator('[data-testid="btn-start-game"]')).toBeVisible();

    // 縦スクロールが発生していないことを検証 (scrollHeight <= clientHeight)
    const isScrollable = await page.evaluate(() => {
      return document.documentElement.scrollHeight > window.innerHeight;
    });
    expect(isScrollable).toBe(false);

    // モバイルセットアップ画面のスクリーンショットを保存
    await page.screenshot({ path: 'e2e/screenshots/17-mobile-setup-fit.png' });
  });
});
