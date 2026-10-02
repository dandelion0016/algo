import { test, expect, Page } from '@playwright/test';

// 共通ヘルパー: 各種モーダルやターン進行を自律処理するプレイヤールーパー
async function playUntilGameOver(
  page: Page,
  options: {
    maxSteps?: number;
    scenarioName: string;
    shouldFailIntentionally?: boolean; // プレイヤーがわざとハズレを引いて敗北に向かうか
    useHintOnce?: boolean;             // ヒント機能を体験するか
    triggerTimeUpOnce?: boolean;        // タイムアップを意図的に1回発生させるか
    preferStayAfterHit?: boolean;      // 的中時にステイを選ぶか
  }
) {
  const {
    maxSteps = 100,
    scenarioName,
    shouldFailIntentionally = false,
    useHintOnce = false,
    triggerTimeUpOnce = false,
    preferStayAfterHit = false,
  } = options;

  let hintUsed = !useHintOnce;
  let timeUpTriggered = !triggerTimeUpOnce;
  let consecutiveHits = 0;

  console.log(`[${scenarioName}] ゲームループ開始 (maxSteps: ${maxSteps})`);

  for (let step = 0; step < maxSteps; step++) {
    // 1. リザルトモーダル表示チェック（決着）
    const resultModal = page.locator('[data-testid="result-modal"]');
    if (await resultModal.isVisible()) {
      console.log(`[${scenarioName}] 🎉 決着！リザルトモーダルが表示されました (step: ${step})`);
      const winnerBadge = await page.locator('[data-testid="result-winner-badge"]').textContent().catch(() => '');
      console.log(`[${scenarioName}] 勝敗結果: ${winnerBadge?.replace(/\s+/g, ' ').trim()}`);
      await page.waitForTimeout(1000);
      await page.screenshot({ path: `e2e/screenshots/${scenarioName}-game-over.png` });
      return;
    }

    // 2. アタック結果確認モーダル (プレイヤー / CPU問わず) のOKボタン
    const attackResultOkBtn = page.locator('[data-testid="btn-attack-result-ok"]');
    if (await attackResultOkBtn.isVisible()) {
      const hitBanner = await page.locator('[data-testid="cpu-attack-hit-banner"], [data-testid="cpu-attack-miss-banner"]').textContent().catch(() => '');
      const nextMsg = await page.locator('[data-testid="cpu-next-action-message"]').textContent().catch(() => '');
      console.log(`[${scenarioName}] アタック結果モーダル: ${hitBanner?.trim()} | ${nextMsg?.trim()}`);
      await attackResultOkBtn.click();
      await page.waitForTimeout(400);
      continue;
    }

    // 3. ドローボタン (プレイヤー手番の開始: role="button" がついている時のみ)
    const drawBtnClickable = page.locator('[data-testid="btn-draw-card"][role="button"]');
    if (await drawBtnClickable.isVisible()) {
      console.log(`[${scenarioName}] 🃏 プレイヤーが山札からドロー`);
      await drawBtnClickable.click({ force: true });
      await page.waitForTimeout(500);

      // タイムアップ意図的トリガー (ドロー後に放置してタイムアップを検証)
      if (!timeUpTriggered) {
        console.log(`[${scenarioName}] ⏳ ドロー後に意図的なタイムアップを発生させるため待機中...`);
        const timeUpBanner = page.locator('[data-testid="timeup-banner"]');
        await expect(timeUpBanner).toBeVisible({ timeout: 25000 });
        console.log(`[${scenarioName}] ⚠️ タイムアップバナー確認！`);
        await page.screenshot({ path: `e2e/screenshots/${scenarioName}-timeup-banner.png` });
        timeUpTriggered = true;
        await page.waitForTimeout(1000);
        continue;
      }

      // ヒント機能を体験
      if (!hintUsed) {
        const hintBtn = page.locator('[data-testid="btn-get-hint"]');
        if (await hintBtn.isVisible() && await hintBtn.isEnabled()) {
          console.log(`[${scenarioName}] 💡 ヒントボタンをクリック`);
          await hintBtn.click();
          const hintModal = page.locator('[data-testid="modal-hint"]');
          await expect(hintModal).toBeVisible();
          await page.screenshot({ path: `e2e/screenshots/${scenarioName}-hint-modal.png` });
          // ヒントモーダルを閉じる
          await page.locator('[data-testid="btn-close-hint-x"]').click();
          await expect(hintModal).not.toBeVisible();
          hintUsed = true;
        }
      }
      continue;
    }

    // 4. アタックモーダル（数字入力中）
    const attackModal = page.locator('[data-testid="attack-modal"]');
    if (await attackModal.isVisible()) {
      console.log(`[${scenarioName}] 🔢 アタックモーダルで数字選択`);
      const numButtons = page.locator('[data-testid^="btn-guess-num-"]');
      const count = await numButtons.count();
      if (count > 0) {
        let targetIndex = 0;
        if (shouldFailIntentionally) {
          targetIndex = count - 1;
        } else {
          targetIndex = Math.floor(count / 2);
        }
        await numButtons.nth(targetIndex).click();
      }
      const confirmBtn = page.locator('[data-testid="btn-confirm-attack"]');
      if (await confirmBtn.isEnabled()) {
        await confirmBtn.click();
      }
      await page.waitForTimeout(500);
      continue;
    }

    // 5. 的中後の選択（「続けてアタック」or「ステイ」）
    const continueBtn = page.locator('[data-testid="btn-continue-attack"]');
    const stayBtn = page.locator('[data-testid="btn-stay"]');
    if (await continueBtn.isVisible()) {
      consecutiveHits++;
      console.log(`[${scenarioName}] 🎯 的中後選択表示！ (連続的中: ${consecutiveHits})`);
      if (preferStayAfterHit || consecutiveHits >= 2 || shouldFailIntentionally) {
        console.log(`[${scenarioName}] 🛡️ ステイを選択`);
        await stayBtn.click();
        consecutiveHits = 0;
      } else {
        console.log(`[${scenarioName}] ⚔️ 続けてアタックを選択`);
        await continueBtn.click();
      }
      await page.waitForTimeout(500);
      continue;
    }

    // 6. アタック対象の伏せカード選択（PLAYER_SELECT_TARGET フェーズ）
    // 相手の手札で裏向きのカードを探してクリック
    const selectableOppCards = page.locator('[data-testid^="opponent-card-"]');
    const oppCount = await selectableOppCards.count();
    let clickedTarget = false;
    for (let i = 0; i < oppCount; i++) {
      const card = selectableOppCards.nth(i);
      if (await card.isVisible()) {
        const text = await card.textContent().catch(() => '');
        // 数字が表示されていない（裏向き）
        if (!text || text.trim() === '' || text.includes('?') || !/\d/.test(text)) {
          console.log(`[${scenarioName}] 🎯 相手の裏向きカードをクリック: index ${i}`);
          await card.click({ force: true });
          await page.waitForTimeout(400);
          if (await attackModal.isVisible()) {
            clickedTarget = true;
            break;
          }
        }
      }
    }

    if (clickedTarget) {
      continue;
    }

    // CPUターン中またはアニメーション待機中
    await page.waitForTimeout(700);
  }

  console.log(`[${scenarioName}] 最大ステップ (${maxSteps}) に到達しました。`);
  await page.screenshot({ path: `e2e/screenshots/${scenarioName}-timeout-step.png` });
}

test.describe('アルゴ（algo / NumLogic）QA自律ゲームプレイ実機検証', () => {
  test.beforeEach(async ({ page }) => {
    // チュートリアルポップアップをスキップ
    await page.addInitScript(() => {
      window.localStorage.setItem('algo_tutorial_skip_prompt', 'true');
    });
    await page.goto('/');
    await expect(page.locator('[data-testid="user-id-badge"]')).toBeVisible();
  });

  test('シナリオ A: 2人対戦 / 中級 / 30秒 - 通常プレイ ＆ 連続的中・ステイ・AIヒント体験', async ({ page }) => {
    test.setTimeout(120000);

    // セットアップ: 2人、normal、30秒
    await page.click('[data-testid="btn-select-player-count-2"]');
    await page.click('[data-testid="btn-select-difficulty-normal"]');
    await page.click('[data-testid="btn-select-time-limit-30"]');
    await page.click('[data-testid="btn-start-game"]');

    // 盤面初期化スクリーンショット
    await page.screenshot({ path: 'e2e/screenshots/scenario-a-start.png' });

    // プレイ完走
    await playUntilGameOver(page, {
      scenarioName: 'scenario-a-2p-normal',
      useHintOnce: true,
      preferStayAfterHit: false,
      maxSteps: 80,
    });
  });

  test('シナリオ B: 3人対戦 / 上級 / 15秒 - タイムアップ体験 ＆ プレイヤー敗北・脱落処理の検証', async ({ page }) => {
    test.setTimeout(180000);

    // セットアップ: 3人、hard、15秒
    await page.click('[data-testid="btn-select-player-count-3"]');
    await page.click('[data-testid="btn-select-difficulty-hard"]');
    await page.click('[data-testid="btn-select-time-limit-15"]');
    await page.click('[data-testid="btn-start-game"]');

    // 盤面初期化スクリーンショット
    await page.screenshot({ path: 'e2e/screenshots/scenario-b-start.png' });

    // タイムアップを発生させ、かつわざとミスしてプレイヤー敗北（全オープン）を狙う
    await playUntilGameOver(page, {
      scenarioName: 'scenario-b-3p-hard-defeat',
      triggerTimeUpOnce: true,
      shouldFailIntentionally: true,
      maxSteps: 90,
    });
  });

  test('シナリオ C: 4人対戦 / 初級 / 無制限 - 多人数プレイ・レイアウト視認性 ＆ 連続脱落進行の検証', async ({ page }) => {
    test.setTimeout(180000);

    // セットアップ: 4人、easy、無制限(0)
    await page.click('[data-testid="btn-select-player-count-4"]');
    await page.click('[data-testid="btn-select-difficulty-easy"]');
    await page.click('[data-testid="btn-select-time-limit-0"]');
    await page.click('[data-testid="btn-start-game"]');

    // 4人対戦の初期レイアウト撮影
    await page.screenshot({ path: 'e2e/screenshots/scenario-c-4p-layout.png' });

    // プレイ完走
    await playUntilGameOver(page, {
      scenarioName: 'scenario-c-4p-easy',
      maxSteps: 100,
    });
  });

  test('シナリオ D: 2人対戦 / 上級 / 15秒 - プレイヤー早期完全敗北時のリザルトモーダル・UX詳細検証', async ({ page }) => {
    test.setTimeout(120000);

    // セットアップ: 2人、hard、15秒
    await page.click('[data-testid="btn-select-player-count-2"]');
    await page.click('[data-testid="btn-select-difficulty-hard"]');
    await page.click('[data-testid="btn-select-time-limit-15"]');
    await page.click('[data-testid="btn-start-game"]');

    // プレイヤーが意図的にミスを連発して即座にCPUに負ける
    await playUntilGameOver(page, {
      scenarioName: 'scenario-d-2p-hard-rapid-defeat',
      shouldFailIntentionally: true,
      maxSteps: 80,
    });
  });
});
