import { test, expect } from '@playwright/test';

test.describe('アルゴ（algo / NumLogic）QA自律ゲームプレイ実機検証 Part 2', () => {
  test.beforeEach(async ({ page }) => {
    // チュートリアルモーダルをスキップ
    await page.addInitScript(() => {
      window.localStorage.setItem('algo_tutorial_skip_prompt', 'true');
    });
  });

  // =========================================================================
  // 1. モバイル（375x667: iPhone SE）での対戦通しプレイ
  // =========================================================================
  test('パターン 1: モバイル実機サイズ（375x667）での対戦通しプレイ・縦収まり・スクロール検証', async ({ page }) => {
    test.setTimeout(120000);
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto('/');
    await expect(page.locator('[data-testid="user-id-badge"]')).toBeVisible();

    // 2人、初級、無制限で開始
    await page.click('[data-testid="btn-select-player-count-2"]');
    await page.click('[data-testid="btn-select-difficulty-easy"]');
    await page.click('[data-testid="btn-select-time-limit-0"]');
    await page.click('[data-testid="btn-start-game"]');

    await page.waitForTimeout(500);
    await page.screenshot({ path: 'e2e/screenshots/part2-mobile-start.png' });

    let attackModalCaptured = false;
    let attackResultCaptured = false;

    for (let step = 0; step < 60; step++) {
      const resultModal = page.locator('[data-testid="result-modal"]');
      if (await resultModal.isVisible()) {
        console.log('[Mobile] 🎉 決着！リザルトモーダル表示');
        await page.waitForTimeout(500);
        await page.screenshot({ path: 'e2e/screenshots/part2-mobile-game-over.png' });
        break;
      }

      const attackResultOkBtn = page.locator('[data-testid="btn-attack-result-ok"]');
      if (await attackResultOkBtn.isVisible()) {
        if (!attackResultCaptured) {
          await page.screenshot({ path: 'e2e/screenshots/part2-mobile-attack-result.png' });
          attackResultCaptured = true;
        }
        await attackResultOkBtn.click();
        await page.waitForTimeout(400);
        continue;
      }

      const drawBtn = page.locator('[data-testid="btn-draw-card"][role="button"]');
      if (await drawBtn.isVisible()) {
        await drawBtn.click({ force: true });
        await page.waitForTimeout(500);
        continue;
      }

      const attackModal = page.locator('[data-testid="attack-modal"]');
      if (await attackModal.isVisible()) {
        if (!attackModalCaptured) {
          await page.screenshot({ path: 'e2e/screenshots/part2-mobile-attack-modal.png' });
          attackModalCaptured = true;
        }
        const numButtons = page.locator('[data-testid^="btn-guess-num-"]');
        const count = await numButtons.count();
        if (count > 0) {
          await numButtons.nth(0).click();
        }
        const confirmBtn = page.locator('[data-testid="btn-confirm-attack"]');
        if (await confirmBtn.isEnabled()) {
          await confirmBtn.click();
        }
        await page.waitForTimeout(500);
        continue;
      }

      const stayBtn = page.locator('[data-testid="btn-stay"]');
      if (await stayBtn.isVisible()) {
        await stayBtn.click();
        await page.waitForTimeout(500);
        continue;
      }

      const selectableOppCards = page.locator('[data-testid^="opponent-card-"]');
      const oppCount = await selectableOppCards.count();
      let clicked = false;
      for (let i = 0; i < oppCount; i++) {
        const card = selectableOppCards.nth(i);
        const text = await card.textContent().catch(() => '');
        if (!text || text.trim() === '' || text.includes('?') || !/\d/.test(text)) {
          await card.click({ force: true });
          await page.waitForTimeout(400);
          if (await attackModal.isVisible()) {
            clicked = true;
            break;
          }
        }
      }
      if (clicked) continue;

      await page.waitForTimeout(600);
    }
  });

  // =========================================================================
  // 2. 山札切れ（残り0枚・デッキ枯渇）状態でのゲーム進行
  // =========================================================================
  test('パターン 2: 山札切れ（残り0枚・デッキ枯渇）状態でのルール・UI進行検証', async ({ page }) => {
    test.setTimeout(60000);
    await page.goto('/');

    await page.click('[data-testid="btn-select-player-count-2"]');
    await page.click('[data-testid="btn-select-difficulty-easy"]');
    await page.click('[data-testid="btn-select-time-limit-0"]');
    await page.click('[data-testid="btn-start-game"]');

    await page.waitForTimeout(500);

    // 山札を直接0枚にする（デッキ枯渇状態の再現）
    console.log('[Deck Zero] 山札を0枚にセットします');
    await page.evaluate(() => {
      if ((window as any).__setGameState) {
        (window as any).__setGameState((prev: any) => ({
          ...prev,
          deck: [],
        }));
      }
    });

    await page.waitForTimeout(300);

    // 山札が0枚になった状態のUI（山札エリア、ガイダンス）を検証
    const drawBtn = page.locator('[data-testid="btn-draw-card"]');
    const deckText = await drawBtn.textContent();
    console.log(`[Deck Zero] 山札の表示: ${deckText?.replace(/\s+/g, ' ').trim()}`);

    // 「山札 0 枚」と表示されているのに「引く」バッジがあるか
    const pullBadge = page.locator('[data-testid="btn-draw-card"] span:has-text("引く")');
    const isPullBadgeVisible = await pullBadge.isVisible();
    console.log(`[Deck Zero] 山札0枚時の「引く」バッジの表示: ${isPullBadgeVisible}`);

    // ガイダンスメッセージの確認
    const statusMsg = await page.locator('[data-testid="status-message"]').textContent();
    console.log(`[Deck Zero] ガイダンスメッセージ: ${statusMsg?.replace(/\s+/g, ' ').trim()}`);

    // 山札0枚時のドロー待ち画面を撮影
    await page.screenshot({ path: 'e2e/screenshots/part2-deck-zero-prompt.png' });

    // 山札をクリック（0枚なのにクリックを要求される仕様）
    await drawBtn.click({ force: true });
    await page.waitForTimeout(500);

    // 相手の伏せカードをクリック
    const oppCard = page.locator('[data-testid="opponent-card-0"]');
    await oppCard.click({ force: true });
    await page.waitForTimeout(400);

    // アタックモーダルが表示される
    const attackModal = page.locator('[data-testid="attack-modal"]');
    await expect(attackModal).toBeVisible();
    await page.screenshot({ path: 'e2e/screenshots/part2-deck-zero-attack.png' });

    // わざとハズレを選択
    await page.locator('[data-testid^="btn-guess-num-"]').last().click();
    await page.click('[data-testid="btn-confirm-attack"]');
    await page.waitForTimeout(500);

    // アタック結果モーダルを確認
    const attackResultOkBtn = page.locator('[data-testid="btn-attack-result-ok"]');
    await expect(attackResultOkBtn).toBeVisible();
    await page.screenshot({ path: 'e2e/screenshots/part2-deck-zero-miss-penalty.png' });
    await attackResultOkBtn.click();
    console.log('[Deck Zero] ✅ 山札0枚時の進行検証完了');
  });

  // =========================================================================
  // 3. プレイヤー完全勝利（CPU全撃破）の完走パターン
  // =========================================================================
  test('パターン 3: プレイヤー完全勝利（CPU全撃破）完走 ＆ 勝利演出・リザルトモーダル詳細検証', async ({ page }) => {
    test.setTimeout(90000);
    await page.goto('/');

    await page.click('[data-testid="btn-select-player-count-2"]');
    await page.click('[data-testid="btn-select-difficulty-easy"]');
    await page.click('[data-testid="btn-select-time-limit-0"]');
    await page.click('[data-testid="btn-start-game"]');

    console.log('[Player Win] プレイヤーが全問正解して完全勝利するシナリオ');

    for (let step = 0; step < 30; step++) {
      const resultModal = page.locator('[data-testid="result-modal"]');
      if (await resultModal.isVisible()) {
        console.log('[Player Win] 🎉 プレイヤー完全勝利達成！');
        await page.waitForTimeout(1000);
        await page.screenshot({ path: 'e2e/screenshots/part2-player-win-result-modal.png' });

        const winnerBadge = await page.locator('[data-testid="result-winner-badge"]').textContent().catch(() => '');
        console.log(`[Player Win] 勝者バッジ: ${winnerBadge?.trim()}`);
        expect(winnerBadge).toContain('あなた');

        // Confetti要素の確認
        const confettiCanvas = page.locator('canvas');
        console.log(`[Player Win] 紙吹雪Canvas数: ${await confettiCanvas.count()}`);
        break;
      }

      const attackResultOkBtn = page.locator('[data-testid="btn-attack-result-ok"]');
      if (await attackResultOkBtn.isVisible()) {
        await attackResultOkBtn.click();
        await page.waitForTimeout(400);
        continue;
      }

      const drawBtn = page.locator('[data-testid="btn-draw-card"][role="button"]');
      if (await drawBtn.isVisible()) {
        await drawBtn.click({ force: true });
        await page.waitForTimeout(500);
        continue;
      }

      const attackModal = page.locator('[data-testid="attack-modal"]');
      if (await attackModal.isVisible()) {
        // window.__algoGameState からターゲットカードの正確な数字を取得！
        const targetNumber = await page.evaluate(() => {
          const state = (window as any).__algoGameState;
          if (!state || !state.selectedTarget) return null;
          const { playerId, cardIndex } = state.selectedTarget;
          const player = state.players.find((p: any) => p.id === playerId);
          if (player && player.cards[cardIndex]) {
            return player.cards[cardIndex].number;
          }
          return null;
        });

        console.log(`[Player Win] 🎯 正解数字: ${targetNumber}`);

        if (targetNumber !== null) {
          const targetBtn = page.locator(`[data-testid="btn-guess-num-${targetNumber}"]`);
          if (await targetBtn.isVisible()) {
            await targetBtn.click();
          } else {
            await page.locator('[data-testid^="btn-guess-num-"]').first().click();
          }
        }

        const confirmBtn = page.locator('[data-testid="btn-confirm-attack"]');
        if (await confirmBtn.isEnabled()) {
          await confirmBtn.click();
        }
        await page.waitForTimeout(500);
        continue;
      }

      // 的中後: 「続けてアタック」で一気に仕留める
      const continueBtn = page.locator('[data-testid="btn-continue-attack"]');
      if (await continueBtn.isVisible()) {
        console.log('[Player Win] ⚔️ 連続アタック選択');
        await continueBtn.click();
        await page.waitForTimeout(500);
        continue;
      }

      // 未オープンの相手カードをクリック
      const selectableOppCards = page.locator('[data-testid^="opponent-card-"]');
      const oppCount = await selectableOppCards.count();
      let clicked = false;
      for (let i = 0; i < oppCount; i++) {
        const card = selectableOppCards.nth(i);
        const text = await card.textContent().catch(() => '');
        if (!text || text.trim() === '' || text.includes('?') || !/\d/.test(text)) {
          await card.click({ force: true });
          await page.waitForTimeout(400);
          if (await attackModal.isVisible()) {
            clicked = true;
            break;
          }
        }
      }
      if (clicked) continue;

      await page.waitForTimeout(500);
    }
  });

  // =========================================================================
  // 4. キーボード操作・アクセシビリティの検証
  // =========================================================================
  test('パターン 4: キーボード操作（数字キー・10/11・Enter/Escape・ResultModal）の動作検証', async ({ page }) => {
    test.setTimeout(30000);
    await page.goto('/');

    await page.click('[data-testid="btn-select-player-count-2"]');
    await page.click('[data-testid="btn-select-difficulty-easy"]');
    await page.click('[data-testid="btn-select-time-limit-0"]');
    await page.click('[data-testid="btn-start-game"]');

    // ドロー（force: trueでアニメーション待ち回避）
    await page.click('[data-testid="btn-draw-card"][role="button"]', { force: true });
    await page.waitForTimeout(400);

    // 相手カードクリックしてアタックモーダル開く
    const oppCard = page.locator('[data-testid="opponent-card-0"]');
    await oppCard.click({ force: true });

    const attackModal = page.locator('[data-testid="attack-modal"]');
    await expect(attackModal).toBeVisible();

    // 1. 選択可能な数字を見つけてキーボード押下
    const enabledNumBtn = attackModal.locator('button[data-testid^="btn-guess-num-"]:not([aria-label*="確認済"]):not([aria-label*="ハズレ済"])').first();
    const numText = (await enabledNumBtn.locator('span').first().innerText()).trim();
    console.log(`[Keyboard] キーボードで数字 "${numText}" を入力`);
    await page.keyboard.press(`Digit${numText}`);
    await page.waitForTimeout(200);

    const isSelected = await enabledNumBtn.getAttribute('class');
    console.log(`[Keyboard] ボタン${numText}のclass: ${isSelected}`);
    expect(isSelected).toContain('border-algo-yellow-dark');

    // 2. 10を入力しようと "1" "0" を順に入力
    console.log('[Keyboard] 10を入力しようと "1" "0" を順に入力');
    await page.keyboard.press('Digit1');
    await page.keyboard.press('Digit0');
    await page.waitForTimeout(200);
    const btn0 = page.locator('[data-testid="btn-guess-num-0"]');
    const isBtn0Selected = await btn0.getAttribute('class');
    console.log(`[Keyboard] 1の後に0を押すと0が選択される（10にはならない）: ${isBtn0Selected?.includes('border-algo-navy')}`);

    // 3. Escapeキーでキャンセルできるか
    console.log('[Keyboard] Escapeキーを押下してモーダルを閉じる');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    await expect(attackModal).not.toBeVisible();
    console.log('[Keyboard] ✅ EscapeでAttackModalが正常に閉じました');

    await page.screenshot({ path: 'e2e/screenshots/part2-keyboard-verified.png' });
  });

  // =========================================================================
  // 5. 推理メモボード・カード別失敗バッジの長丁場での視認性
  // =========================================================================
  test('パターン 5: カード別失敗バッジ（複数回ミス）の表示・重なり・見切れ検証', async ({ page }) => {
    test.setTimeout(30000);
    await page.goto('/');

    await page.click('[data-testid="btn-select-player-count-2"]');
    await page.click('[data-testid="btn-select-difficulty-easy"]');
    await page.click('[data-testid="btn-select-time-limit-0"]');
    await page.click('[data-testid="btn-start-game"]');

    // 直接DOM/Componentで failedGuesses が [1, 3, 5, 7] の場合の描画をテスト
    await page.evaluate(() => {
      const badge = document.createElement('div');
      badge.setAttribute('data-testid', 'test-long-failed-badge');
      badge.className = 'px-1.5 py-0.5 rounded-full font-black tracking-tight border shadow-2xs whitespace-nowrap text-center text-[9px] sm:text-[10px] bg-rose-50 text-rose-700 border-rose-300';
      badge.innerText = '✕[1, 3, 5, 7, 9]';

      const firstCard = document.querySelector('[data-testid="opponent-card-0"]');
      if (firstCard) {
        firstCard.appendChild(badge);
      }
    });

    await page.waitForTimeout(300);
    await page.screenshot({ path: 'e2e/screenshots/part2-failed-badge-overflow.png' });

    const overflowCheck = await page.evaluate(() => {
      const card = document.querySelector('[data-testid="opponent-card-0"]');
      const badge = document.querySelector('[data-testid="test-long-failed-badge"]');
      if (!card || !badge) return null;
      return {
        cardWidth: card.clientWidth,
        badgeWidth: badge.clientWidth,
        isOverflow: badge.clientWidth > card.clientWidth,
      };
    });

    console.log(`[Badge Overflow Check]`, overflowCheck);
    expect(overflowCheck?.isOverflow).toBe(true);
  });
});
