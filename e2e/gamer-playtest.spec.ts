import { test, expect, Page } from '@playwright/test';

test.describe('モダンゲーマー視点による実機プレイテスト＆UX/テンポ検証', () => {
  test.beforeEach(async ({ page }) => {
    // チュートリアルプロンプトをスキップ
    await page.addInitScript(() => {
      window.localStorage.setItem('algo_tutorial_skip_prompt', 'true');
    });
    await page.goto('/');
    await expect(page.locator('[data-testid="user-id-badge"]')).toBeVisible();
  });

  test('ゲーマープレイ 1: 上級(Hard) / 15秒での超高速テンポプレイと操作負荷（モーダル連打・入力テンポ）検証', async ({ page }) => {
    test.setTimeout(120000);

    // 2人、Hard、15秒（ゲーマー向け競技設定）
    await page.click('[data-testid="btn-select-player-count-2"]');
    await page.click('[data-testid="btn-select-difficulty-hard"]');
    await page.click('[data-testid="btn-select-time-limit-15"]');
    await page.click('[data-testid="btn-start-game"]');

    console.log('[Gamer Test 1] 競技的設定（2P / Hard / 15s）でプレイ開始');
    await page.screenshot({ path: 'e2e/screenshots/gamer-01-hard-15s-start.png' });

    let attackModalCount = 0;
    let attackResultCount = 0;
    const startTime = Date.now();

    for (let step = 0; step < 80; step++) {
      // 決着判定
      const resultModal = page.locator('[data-testid="result-modal"]');
      if (await resultModal.isVisible()) {
        console.log(`[Gamer Test 1] ゲーム決着！所要時間: ${(Date.now() - startTime) / 1000}s`);
        await page.screenshot({ path: 'e2e/screenshots/gamer-02-result-modal.png' });
        break;
      }

      // アタック結果モーダル（OKボタン待ち）
      const attackResultOkBtn = page.locator('[data-testid="btn-attack-result-ok"]');
      if (await attackResultOkBtn.isVisible()) {
        attackResultCount++;
        // ゲーマー目線: 結果モーダルでOKを押さないと次へ進めないため、即座にEnterまたはOKをクリック
        await attackResultOkBtn.click();
        await page.waitForTimeout(300);
        continue;
      }

      // ドロー
      const drawBtn = page.locator('[data-testid="btn-draw-card"][role="button"]');
      if (await drawBtn.isVisible()) {
        await drawBtn.click({ force: true });
        await page.waitForTimeout(400);
        continue;
      }

      // 相手カード選択 -> アタックモーダル
      const selectableOppCards = page.locator('[data-testid^="opponent-card-"]');
      const oppCount = await selectableOppCards.count();
      let clicked = false;
      for (let i = 0; i < oppCount; i++) {
        const card = selectableOppCards.nth(i);
        const text = await card.textContent().catch(() => '');
        if (!text || text.trim() === '' || text.includes('?') || !/\d/.test(text)) {
          await card.click({ force: true });
          await page.waitForTimeout(300);
          clicked = true;
          break;
        }
      }

      const attackModal = page.locator('[data-testid="attack-modal"]');
      if (await attackModal.isVisible()) {
        attackModalCount++;
        if (attackModalCount === 1) {
          await page.screenshot({ path: 'e2e/screenshots/gamer-03-attack-flow.png' });
        }
        // 数字選択
        const numBtns = page.locator('[data-testid^="btn-guess-num-"]');
        if (await numBtns.count() > 0) {
          await numBtns.first().click();
        }
        const confirmBtn = page.locator('[data-testid="btn-confirm-attack"]');
        if (await confirmBtn.isEnabled()) {
          await confirmBtn.click();
        }
        await page.waitForTimeout(400);
        continue;
      }

      // 的中後ステイ/アタック
      const stayBtn = page.locator('[data-testid="btn-stay"]');
      if (await stayBtn.isVisible()) {
        await stayBtn.click();
        await page.waitForTimeout(400);
        continue;
      }

      await page.waitForTimeout(500);
    }

    console.log(`[Gamer Test 1] アタック結果モーダルOK押下回数: ${attackResultCount} 回`);
  });

  test('ゲーマープレイ 2: 4人対戦カオス戦における「今誰が何を引いてどこに入れたか」の情報追跡性検証', async ({ page }) => {
    test.setTimeout(120000);

    // 4人、Normal、無制限
    await page.click('[data-testid="btn-select-player-count-4"]');
    await page.click('[data-testid="btn-select-difficulty-normal"]');
    await page.click('[data-testid="btn-select-time-limit-0"]');
    await page.click('[data-testid="btn-start-game"]');

    console.log('[Gamer Test 2] 4人対戦開始');
    await page.waitForTimeout(600);
    await page.screenshot({ path: 'e2e/screenshots/gamer-04-4p-tracking.png' });

    // CPUが手番のとき、ドローしたカードがどこに入ったかを注視するテスト
    // ドローを1手行う
    const drawBtn = page.locator('[data-testid="btn-draw-card"][role="button"]');
    if (await drawBtn.isVisible()) {
      await drawBtn.click({ force: true });
      await page.waitForTimeout(400);
      // わざとハズレてターンエンド
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
    }

    // 次のCPUターンの挙動を待機し画面をキャプチャ
    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'e2e/screenshots/gamer-05-cpu-acting-tracking.png' });
  });
});
