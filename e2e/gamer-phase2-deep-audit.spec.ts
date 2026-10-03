import { test, expect } from '@playwright/test';

test.describe('Phase 2 統合QA深層プレイテスト', () => {
  test.beforeEach(async ({ page }) => {
    // チュートリアルポップアップをスキップ
    await page.addInitScript(() => {
      window.localStorage.setItem('algo_tutorial_skip_prompt', 'true');
    });
    await page.goto('/');
  });

  test('シナリオ 1: モバイル実機 (iPhone SE: 375x667) でのUI検証＆ヘッダー・アタックモーダル・HUD確認', async ({ page }) => {
    test.setTimeout(90000);
    // ビューポートを iPhone SE サイズに設定
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    // セットアップ画面のキャプチャ
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'e2e/screenshots/audit-mobile-01-setup.png' });

    // 2人、Normal、無制限で開始
    await page.click('[data-testid="btn-select-player-count-2"]');
    await page.click('[data-testid="btn-select-difficulty-normal"]');
    await page.click('[data-testid="btn-select-time-limit-0"]');
    await page.click('[data-testid="btn-start-game"]');
    await page.waitForTimeout(600);

    // モバイル盤面初期キャプチャ
    await page.screenshot({ path: 'e2e/screenshots/audit-mobile-02-board.png' });

    // モバイルでのヘッダーボタン群の視認性チェック
    const statsBtn = page.locator('[data-testid="btn-open-stats"]');
    const soundBtn = page.locator('[data-testid="btn-sound-toggle"]');
    console.log(`[Mobile] Stats button visible: ${await statsBtn.isVisible()}`);
    console.log(`[Mobile] Sound button visible: ${await soundBtn.isVisible()}`);

    // 戦績モーダルを開く
    if (await statsBtn.isVisible()) {
      await statsBtn.click();
      await page.waitForTimeout(400);
      await page.screenshot({ path: 'e2e/screenshots/audit-mobile-03-stats-modal.png' });

      // アチーブメントタブへ切り替え
      const achievementsTab = page.locator('button:has-text("アチーブメント")');
      if (await achievementsTab.isVisible()) {
        await achievementsTab.click();
        await page.waitForTimeout(300);
        await page.screenshot({ path: 'e2e/screenshots/audit-mobile-04-achievements-tab.png' });
      }
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    }

    // モバイルでの残弾トラッカー開閉（下部またはFAB）
    const trackerToggleBtn = page.locator('[data-testid="btn-mobile-tracker-toggle"]');
    console.log(`[Mobile] Tracker toggle button count: ${await trackerToggleBtn.count()}`);
    if (await trackerToggleBtn.isVisible()) {
      await trackerToggleBtn.click();
      await page.waitForTimeout(400);
      await page.screenshot({ path: 'e2e/screenshots/audit-mobile-05-tracker-drawer.png' });
      // 閉じる
      await page.keyboard.press('Escape');
    }

    // ドローしてアタックモーダルを開く
    const drawBtn = page.locator('[data-testid="btn-draw-card"][role="button"]');
    if (await drawBtn.isVisible()) {
      await drawBtn.click({ force: true });
      await page.waitForTimeout(400);
      const oppCard = page.locator('[data-testid="opponent-card-0"]').first();
      await oppCard.click({ force: true });
      await page.waitForTimeout(400);
      await page.screenshot({ path: 'e2e/screenshots/audit-mobile-06-attack-modal.png' });
    }
  });

  test('シナリオ 2: 3人対戦でのプレイヤー脱落と自動観戦・スキップ決着検証', async ({ page }) => {
    test.setTimeout(120000);
    await page.setViewportSize({ width: 1280, height: 800 });

    // 3人、Hard、無制限
    await page.click('[data-testid="btn-select-player-count-3"]');
    await page.click('[data-testid="btn-select-difficulty-hard"]');
    await page.click('[data-testid="btn-select-time-limit-0"]');
    await page.click('[data-testid="btn-start-game"]');
    await page.waitForTimeout(600);

    // プレイヤーの全手札を強制オープンさせて脱落をシミュレート
    await page.evaluate(() => {
      const gs = (window as any).__algoGameState;
      if (gs && gs.players) {
        const human = gs.players.find((p: any) => p.isHuman);
        if (human) {
          human.cards.forEach((c: any) => { c.isOpen = true; });
          human.isEliminated = true;
        }
        (window as any).__setGameState({ ...gs, phase: 'CPU_ACTING', activePlayerIndex: 1 });
      }
    });

    await page.waitForTimeout(800);
    await page.screenshot({ path: 'e2e/screenshots/audit-elimination-01-spectate.png' });

    // 観戦コントロールや脱落バナーの確認
    const spectateNotice = page.locator('text=脱落');
    console.log(`[Elimination] 脱落メッセージ存在: ${await spectateNotice.count()}`);

    // スキップボタンが存在すればクリック
    const skipBtn = page.locator('button:has-text("決着までスキップ")');
    console.log(`[Elimination] スキップボタン存在: ${await skipBtn.count()}`);
    if (await skipBtn.isVisible()) {
      await skipBtn.click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: 'e2e/screenshots/audit-elimination-02-skipped-result.png' });
    }
  });

  test('シナリオ 3: リーサルK.O.演出と決着時全手札開示の実機検証', async ({ page }) => {
    test.setTimeout(90000);
    await page.setViewportSize({ width: 1280, height: 800 });

    // 2人、Easy、無制限
    await page.click('[data-testid="btn-select-player-count-2"]');
    await page.click('[data-testid="btn-select-difficulty-easy"]');
    await page.click('[data-testid="btn-select-time-limit-0"]');
    await page.click('[data-testid="btn-start-game"]');
    await page.waitForTimeout(500);

    // 相手のカードを残り1枚だけ伏せ状態にして、プレイヤーがそれを当てる（リーサル勝利シミュレーション）
    await page.evaluate(() => {
      const gs = (window as any).__algoGameState;
      if (gs && gs.players) {
        const cpu = gs.players.find((p: any) => !p.isHuman);
        if (cpu) {
          // 最初のカード以外をすべてオープン
          for (let i = 1; i < cpu.cards.length; i++) {
            cpu.cards[i].isOpen = true;
          }
        }
        (window as any).__setGameState({ ...gs });
      }
    });

    await page.waitForTimeout(400);
    await page.screenshot({ path: 'e2e/screenshots/audit-lethal-01-setup.png' });

    // ドロー
    const drawBtn = page.locator('[data-testid="btn-draw-card"][role="button"]');
    await drawBtn.click({ force: true });
    await page.waitForTimeout(300);

    // 相手の唯一の伏せカードを取得して当てる
    const oppFirstCard = page.locator('[data-testid="opponent-card-0"]').first();
    await oppFirstCard.click({ force: true });
    await page.waitForTimeout(300);

    // 相手の正解の数字を取得してクリック
    const targetCardNumber = await page.evaluate(() => {
      const gs = (window as any).__algoGameState;
      const cpu = gs.players.find((p: any) => !p.isHuman);
      return cpu.cards[0].number;
    });

    console.log(`[Lethal Test] Target card number is: ${targetCardNumber}`);
    const correctBtn = page.locator(`[data-testid="btn-guess-num-${targetCardNumber}"]`);
    await correctBtn.click();
    await page.locator('[data-testid="btn-confirm-attack"]').click();

    // リーサルカットイン演出や画面のキャプチャ
    await page.waitForTimeout(300);
    await page.screenshot({ path: 'e2e/screenshots/audit-lethal-02-cutin.png' });

    // 結果OKボタンを押す
    const okBtn = page.locator('[data-testid="btn-attack-result-ok"]');
    if (await okBtn.isVisible()) {
      await okBtn.click();
    }

    await page.waitForTimeout(800);
    // 勝利モーダルおよび背後の全手札開示状態キャプチャ
    await page.screenshot({ path: 'e2e/screenshots/audit-lethal-03-game-over-open-cards.png' });
  });

  test('シナリオ 4: サウンド設定の永続化とアタック時サウンド再生の確認', async ({ page }) => {
    test.setTimeout(60000);
    await page.setViewportSize({ width: 1280, height: 800 });

    // 2人開始
    await page.click('[data-testid="btn-start-game"]');
    await page.waitForTimeout(500);

    const soundBtn = page.locator('[data-testid="btn-sound-toggle"]');
    await expect(soundBtn).toBeVisible();
    const initialText = await soundBtn.innerText();
    console.log(`[Sound] Initial text: ${initialText}`);

    // クリックしてミュートに切り替え
    await soundBtn.click();
    await page.waitForTimeout(200);
    const mutedText = await soundBtn.innerText();
    console.log(`[Sound] Muted text: ${mutedText}`);
    expect(mutedText).toContain('OFF');

    await page.screenshot({ path: 'e2e/screenshots/audit-sound-01-muted.png' });

    // ページ再読み込み後も状態が維持されているか
    await page.reload();
    await page.waitForTimeout(500);
    await page.click('[data-testid="btn-start-game"]');
    await page.waitForTimeout(500);
    const reloadedText = await page.locator('[data-testid="btn-sound-toggle"]').innerText();
    console.log(`[Sound] Reloaded text: ${reloadedText}`);
    expect(reloadedText).toContain('OFF');
  });
});
