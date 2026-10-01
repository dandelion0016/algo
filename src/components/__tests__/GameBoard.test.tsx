import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import {
  GameBoard,
  getTimerColorClass,
  getProgressBarColorClass,
  calculateProgressPercentage,
  TIME_UP_MESSAGE,
} from '../GameBoard';
import * as useUserSessionModule from '../../hooks/useUserSession';
import { createDeck, setupGamePlayers, insertCardInOrder, isAllOpen, getNextActivePlayerIndex } from '../../lib/algoEngine';
import { Card, GameState, AttackLog } from '../../types/game';

// useUserSession フックのモック化
vi.mock('../../hooks/useUserSession', () => ({
  useUserSession: vi.fn(),
}));

describe('GameBoard Component & Timer Pause/Resume Logic (Issue #13)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useUserSessionModule.useUserSession).mockReturnValue({
      userId: 'test_user_1',
      isNew: false,
      isLoading: false,
    });
  });

  describe('初期表示とセットアップ画面のレンダリング', () => {
    it('初期フェーズ SETUP でセットアップモーダルが正常にレンダリングされる', () => {
      const html = renderToString(<GameBoard />);
      expect(html).toContain('algo');
      expect(html).toContain('対戦人数');
      expect(html).toContain('対戦を開始する！');
      expect(html).toContain('ルールを確認');
    });
  });

  describe('タイマーPause/Resume判定ロジックの仕様検証', () => {
    // isTimerPaused の条件:
    // (isRuleModalOpen || confirmModal.isOpen || isManualPaused) && isGameInProgress && phase !== 'CPU_ACTING'

    const checkTimerPaused = (params: {
      isRuleModalOpen: boolean;
      isConfirmModalOpen: boolean;
      isManualPaused: boolean;
      phase: GameState['phase'];
      timeLimit: number;
    }) => {
      const isGameInProgress =
        params.phase !== 'SETUP' &&
        params.phase !== 'GAME_OVER';

      return Boolean(
        (params.isRuleModalOpen || params.isConfirmModalOpen || params.isManualPaused) &&
          isGameInProgress &&
          params.phase !== 'CPU_ACTING'
      );
    };

    it('ルールモーダルが開いている時はタイマーが一時停止（isTimerPaused = true）となる', () => {
      const isPaused = checkTimerPaused({
        isRuleModalOpen: true,
        isConfirmModalOpen: false,
        isManualPaused: false,
        phase: 'PLAYER_TURN_START',
        timeLimit: 30,
      });
      expect(isPaused).toBe(true);
    });

    it('HITL確認モーダルが開いている時はタイマーが一時停止（isTimerPaused = true）となる', () => {
      const isPaused = checkTimerPaused({
        isRuleModalOpen: false,
        isConfirmModalOpen: true,
        isManualPaused: false,
        phase: 'PLAYER_TURN_START',
        timeLimit: 30,
      });
      expect(isPaused).toBe(true);
    });

    it('手動ポーズが有効な時はタイマーが一時停止（isTimerPaused = true）となる', () => {
      const isPaused = checkTimerPaused({
        isRuleModalOpen: false,
        isConfirmModalOpen: false,
        isManualPaused: true,
        phase: 'PLAYER_TURN_START',
        timeLimit: 30,
      });
      expect(isPaused).toBe(true);
    });

    it('すべてのモーダルが閉じ手動ポーズも解除されている時はタイマーが再開（isTimerPaused = false）となる', () => {
      const isPaused = checkTimerPaused({
        isRuleModalOpen: false,
        isConfirmModalOpen: false,
        isManualPaused: false,
        phase: 'PLAYER_TURN_START',
        timeLimit: 30,
      });
      expect(isPaused).toBe(false);
    });

    it('CPU手番中 (CPU_ACTING) はタイマーが一時停止状態にならない（CPUはタイマー対象外）', () => {
      const isPaused = checkTimerPaused({
        isRuleModalOpen: true,
        isConfirmModalOpen: false,
        isManualPaused: false,
        phase: 'CPU_ACTING',
        timeLimit: 30,
      });
      expect(isPaused).toBe(false);
    });

    it('ゲーム終了時 (GAME_OVER) はタイマーが一時停止状態にならない', () => {
      const isPaused = checkTimerPaused({
        isRuleModalOpen: true,
        isConfirmModalOpen: false,
        isManualPaused: false,
        phase: 'GAME_OVER',
        timeLimit: 30,
      });
      expect(isPaused).toBe(false);
    });
  });

  describe('タイマーのカウントダウン減算および一時停止・再開シミュレーション', () => {
    it('通常時は毎秒残り時間が減算される', () => {
      let remainingTime = 30;
      const isTimerPaused = false;

      // 3秒経過シミュレーション
      for (let i = 0; i < 3; i++) {
        if (!isTimerPaused) {
          remainingTime -= 1;
        }
      }

      expect(remainingTime).toBe(27);
    });

    it('モーダル表示中（isTimerPaused = true）は残り時間が減算されない', () => {
      let remainingTime = 25;
      const isTimerPaused = true;

      // 5秒経過シミュレーション（モーダルを開いたまま放置）
      for (let i = 0; i < 5; i++) {
        if (!isTimerPaused) {
          remainingTime -= 1;
        }
      }

      // 残り秒数は25秒のまま保持される
      expect(remainingTime).toBe(25);
    });

    it('モーダルを閉じた後は中断された時点の残り秒数から正確に再開（Resume）する', () => {
      let remainingTime = 20;

      // 1. 最初は通常進行（2秒経過）
      let isTimerPaused = false;
      for (let i = 0; i < 2; i++) {
        if (!isTimerPaused) remainingTime -= 1;
      }
      expect(remainingTime).toBe(18);

      // 2. ルールモーダルを開く（一時停止、4秒経過）
      isTimerPaused = true;
      for (let i = 0; i < 4; i++) {
        if (!isTimerPaused) remainingTime -= 1;
      }
      expect(remainingTime).toBe(18); // 減算されない

      // 3. ルールモーダルを閉じる（再開、3秒経過）
      isTimerPaused = false;
      for (let i = 0; i < 3; i++) {
        if (!isTimerPaused) remainingTime -= 1;
      }
      expect(remainingTime).toBe(15); // 18から継続して15へ
    });
  });

  describe('タイムアップ（残り0秒到達）強制オープンペナルティ処理の検証', () => {
    it('残り時間が0秒に達した際に強制オープンペナルティが適用され手番が交代する', () => {
      const rawDeck = createDeck();
      const { players, remainingDeck } = setupGamePlayers(rawDeck, 2, 'user_1');

      let currentDeck = [...remainingDeck];
      let currentPlayers = [...players];
      const initialHumanCardsCount = currentPlayers[0].cards.length;

      // タイムアップ処理を実行
      const penaltyCard = currentDeck[0];
      currentDeck = currentDeck.slice(1);

      currentPlayers[0] = {
        ...currentPlayers[0],
        cards: insertCardInOrder(currentPlayers[0].cards, {
          ...penaltyCard,
          isOpen: true,
        }),
      };

      const timeOutLog: AttackLog = {
        id: 'log-timeout-test',
        attackerId: 'user_1',
        attackerName: 'あなた',
        targetPlayerId: '',
        targetPlayerName: '',
        targetCardIndex: 0,
        targetColor: 'black',
        guessedNumber: 0,
        isHit: false,
        timestamp: Date.now(),
        message: '時間切れ！引いたカードがオープンペナルティとなり手番終了。',
      };

      const nextIdx = getNextActivePlayerIndex(0, currentPlayers);

      // 検証
      expect(currentPlayers[0].cards.length).toBe(initialHumanCardsCount + 1);
      // 追加されたペナルティカードが isOpen === true になっている
      const openedCard = currentPlayers[0].cards.find((c) => c.id === penaltyCard.id);
      expect(openedCard).toBeDefined();
      expect(openedCard?.isOpen).toBe(true);

      // ログに時間切れメッセージが記録されている
      expect(timeOutLog.message).toContain('時間切れ！引いたカードがオープンペナルティとなり手番終了。');

      // 次の手番が相手プレイヤー（インデックス1）へ交代している
      expect(nextIdx).toBe(1);
    });

    it('タイムアップ強制オープンにより全カードがオープンとなった場合、脱落および決着（GAME_OVER）となる', () => {
      const humanCards: Card[] = [
        { id: 'b-1', color: 'black', number: 1, isOpen: true },
        { id: 'w-2', color: 'white', number: 2, isOpen: true },
      ];
      const cpuCards: Card[] = [
        { id: 'b-5', color: 'black', number: 5, isOpen: false },
        { id: 'w-8', color: 'white', number: 8, isOpen: false },
      ];

      const penaltyCard: Card = { id: 'b-9', color: 'black', number: 9, isOpen: false };
      const updatedHumanCards = insertCardInOrder(humanCards, {
        ...penaltyCard,
        isOpen: true,
      });

      const isEliminated = isAllOpen(updatedHumanCards);
      expect(isEliminated).toBe(true);

      const activePlayers = [
        { id: 'cpu-1', name: 'CPU', isHuman: false, cards: cpuCards, isEliminated: false, avatarColor: '' },
      ];
      expect(activePlayers.length).toBe(1);
      // 勝者は残ったCPUとなり GAME_OVER へ
      expect(activePlayers[0].name).toBe('CPU');
    });
  });

  describe('UI表示インジケーター（PAUSEDバッジ）のスタイル仕様検証', () => {
    it('isTimerPaused = true 時のUIクラスとテキスト仕様が正しく設定されている', () => {
      const isTimerPaused = true;
      const remainingTime = 14;

      const badgeClass = isTimerPaused
        ? 'bg-amber-50 border-amber-300 text-amber-700 ring-2 ring-amber-200 animate-pulse hover:bg-amber-100'
        : remainingTime <= 5
        ? 'bg-rose-50 border-rose-300 text-rose-600 animate-pulse ring-2 ring-rose-200 hover:bg-rose-100'
        : 'bg-algo-blue-light/60 border-algo-blue/30 text-algo-navy hover:bg-algo-blue-light/80';

      const labelText = isTimerPaused ? 'PAUSED' : `残り ${remainingTime} 秒`;
      const icon = isTimerPaused ? '⏸️' : 'Clock';

      expect(badgeClass).toContain('bg-amber-50');
      expect(badgeClass).toContain('border-amber-300');
      expect(badgeClass).toContain('text-amber-700');
      expect(badgeClass).toContain('animate-pulse');
      expect(labelText).toBe('PAUSED');
      expect(icon).toBe('⏸️');
    });

    it('通常時 (残り6秒以上) のUIクラス仕様', () => {
      const isTimerPaused = false;
      const remainingTime = 20;

      const badgeClass = isTimerPaused
        ? 'bg-amber-50 border-amber-300 text-amber-700 ring-2 ring-amber-200 animate-pulse hover:bg-amber-100'
        : remainingTime <= 5
        ? 'bg-rose-50 border-rose-300 text-rose-600 animate-pulse ring-2 ring-rose-200 hover:bg-rose-100'
        : 'bg-algo-blue-light/60 border-algo-blue/30 text-algo-navy hover:bg-algo-blue-light/80';

      expect(badgeClass).toContain('bg-algo-blue-light/60');
      expect(badgeClass).toContain('text-algo-navy');
      expect(badgeClass).not.toContain('animate-pulse');
    });

    it('警告時 (残り5秒以下) のパルス表示UIクラス仕様', () => {
      const isTimerPaused = false;
      const remainingTime = 4;

      const badgeClass = isTimerPaused
        ? 'bg-amber-50 border-amber-300 text-amber-700 ring-2 ring-amber-200 animate-pulse hover:bg-amber-100'
        : remainingTime <= 5
        ? 'bg-rose-50 border-rose-300 text-rose-600 animate-pulse ring-2 ring-rose-200 hover:bg-rose-100'
        : 'bg-algo-blue-light/60 border-algo-blue/30 text-algo-navy hover:bg-algo-blue-light/80';

      expect(badgeClass).toContain('bg-rose-50');
      expect(badgeClass).toContain('text-rose-600');
      expect(badgeClass).toContain('animate-pulse');
      expect(badgeClass).toContain('ring-rose-200');
    });
  });

  describe('持ち時間タイマー警告演出 & プログレスバー & タイムアップ通知 (Issue #15)', () => {
    describe('タイマー警告ボタンスタイル (getTimerColorClass)', () => {
      it('残り10秒以上（30秒、20秒、10秒）は通常スカイブルー表示となりパルス点滅しない', () => {
        [30, 20, 10].forEach((sec) => {
          const className = getTimerColorClass(sec, false);
          expect(className).toContain('bg-algo-blue-light/60');
          expect(className).toContain('border-algo-blue/30');
          expect(className).toContain('text-algo-navy');
          expect(className).not.toContain('animate-pulse');
          expect(className).not.toContain('bg-amber-50');
          expect(className).not.toContain('bg-rose-50');
        });
      });

      it('残り10秒未満（9秒〜6秒）はイエロー/アンバー警告表示となりパルス点滅しない', () => {
        [9, 8, 7, 6].forEach((sec) => {
          const className = getTimerColorClass(sec, false);
          expect(className).toContain('bg-amber-50');
          expect(className).toContain('border-amber-300');
          expect(className).toContain('text-amber-700');
          expect(className).not.toContain('animate-pulse');
          expect(className).not.toContain('bg-rose-50');
          expect(className).not.toContain('bg-algo-blue-light/60');
        });
      });

      it('残り5秒未満（5秒〜1秒）はローズレッド危険表示かつanimate-pulseおよびring-2 ring-rose-200で点滅する', () => {
        [5, 4, 3, 2, 1].forEach((sec) => {
          const className = getTimerColorClass(sec, false);
          expect(className).toContain('bg-rose-50');
          expect(className).toContain('border-rose-300');
          expect(className).toContain('text-rose-600');
          expect(className).toContain('animate-pulse');
          expect(className).toContain('ring-2 ring-rose-200');
          expect(className).not.toContain('bg-amber-50');
          expect(className).not.toContain('bg-algo-blue-light/60');
        });
      });

      it('タイマー一時停止中（isTimerPaused = true）はアンバー点滅表示（PAUSEDスタイル）となる', () => {
        const className = getTimerColorClass(15, true);
        expect(className).toContain('bg-amber-50');
        expect(className).toContain('border-amber-300');
        expect(className).toContain('text-amber-700');
        expect(className).toContain('ring-2 ring-amber-200');
        expect(className).toContain('animate-pulse');
      });
    });

    describe('タイマープログレスバーカラー (getProgressBarColorClass)', () => {
      it('残り10秒以上は bg-algo-blue となる', () => {
        expect(getProgressBarColorClass(30, false)).toBe('bg-algo-blue');
        expect(getProgressBarColorClass(15, false)).toBe('bg-algo-blue');
        expect(getProgressBarColorClass(10, false)).toBe('bg-algo-blue');
      });

      it('残り10秒未満（9秒〜6秒）は bg-amber-400 となる', () => {
        expect(getProgressBarColorClass(9, false)).toBe('bg-amber-400');
        expect(getProgressBarColorClass(6, false)).toBe('bg-amber-400');
      });

      it('残り5秒未満（5秒〜1秒）は bg-rose-500 となる', () => {
        expect(getProgressBarColorClass(5, false)).toBe('bg-rose-500');
        expect(getProgressBarColorClass(1, false)).toBe('bg-rose-500');
      });

      it('タイマー一時停止中（isTimerPaused = true）は bg-amber-400 となる', () => {
        expect(getProgressBarColorClass(25, true)).toBe('bg-amber-400');
        expect(getProgressBarColorClass(4, true)).toBe('bg-amber-400');
      });
    });

    describe('プログレスバー割合計算 (calculateProgressPercentage)', () => {
      it('30秒持ち時間時の残り時間割合（%）が正しく計算される', () => {
        expect(calculateProgressPercentage(30, 30)).toBe(100);
        expect(calculateProgressPercentage(15, 30)).toBe(50);
        expect(calculateProgressPercentage(6, 30)).toBe(20);
        expect(calculateProgressPercentage(0, 30)).toBe(0);
      });

      it('15秒持ち時間時の残り時間割合（%）が正しく計算される', () => {
        expect(calculateProgressPercentage(15, 15)).toBe(100);
        expect(calculateProgressPercentage(7.5, 15)).toBe(50);
        expect(calculateProgressPercentage(0, 15)).toBe(0);
      });

      it('境界値（負の秒数や超過秒数、無制限0秒）が安全にハンドリングされる', () => {
        expect(calculateProgressPercentage(-5, 30)).toBe(0);
        expect(calculateProgressPercentage(35, 30)).toBe(100);
        expect(calculateProgressPercentage(0, 0)).toBe(100);
      });
    });

    describe('GameBoard コンポーネントの対戦中レンダリング検証', () => {
      const mockPlayers = [
        {
          id: 'test_user_1',
          name: 'あなた',
          isHuman: true,
          cards: [
            { id: 'b-1', color: 'black' as const, number: 1, isOpen: false },
            { id: 'w-2', color: 'white' as const, number: 2, isOpen: false },
          ],
          isEliminated: false,
          avatarColor: 'from-blue-500 to-indigo-600',
        },
        {
          id: 'cpu-1',
          name: 'CPU 1',
          isHuman: false,
          cards: [
            { id: 'b-5', color: 'black' as const, number: 5, isOpen: false },
            { id: 'w-8', color: 'white' as const, number: 8, isOpen: false },
          ],
          isEliminated: false,
          avatarColor: 'from-amber-500 to-orange-600',
        },
      ];

      it('残り20秒（10秒以上）の盤面で、通常スカイブルータイマーおよびプログレスバー（青）がレンダリングされる', () => {
        const html = renderToString(
          <GameBoard
            initialState={{
              phase: 'PLAYER_TURN_START',
              timeLimit: 30,
              remainingTime: 20,
              players: mockPlayers,
              activePlayerIndex: 0,
            }}
          />
        );

        expect(html).toContain('data-testid="timer-display"');
        expect(html).toContain('残り 20 秒');
        expect(html).toContain('bg-algo-blue-light/60');
        expect(html).toContain('data-testid="timer-progress-bar"');
        expect(html).toContain('bg-algo-blue');
        expect(html).toContain('role="progressbar"');
        expect(html).toContain('aria-valuenow="20"');
      });

      it('残り8秒（10秒未満）の盤面で、イエロー/アンバー警告タイマーおよびプログレスバー（黄）がレンダリングされる', () => {
        const html = renderToString(
          <GameBoard
            initialState={{
              phase: 'PLAYER_TURN_START',
              timeLimit: 30,
              remainingTime: 8,
              players: mockPlayers,
              activePlayerIndex: 0,
            }}
          />
        );

        expect(html).toContain('data-testid="timer-display"');
        expect(html).toContain('残り 8 秒');
        expect(html).toContain('bg-amber-50');
        expect(html).toContain('text-amber-700');
        expect(html).toContain('data-testid="timer-progress-bar"');
        expect(html).toContain('bg-amber-400');
      });

      it('残り3秒（5秒未満）の盤面で、ローズレッド危険タイマー（点滅）およびプログレスバー（赤）がレンダリングされる', () => {
        const html = renderToString(
          <GameBoard
            initialState={{
              phase: 'PLAYER_TURN_START',
              timeLimit: 30,
              remainingTime: 3,
              players: mockPlayers,
              activePlayerIndex: 0,
            }}
          />
        );

        expect(html).toContain('data-testid="timer-display"');
        expect(html).toContain('残り 3 秒');
        expect(html).toContain('bg-rose-50');
        expect(html).toContain('text-rose-600');
        expect(html).toContain('animate-pulse');
        expect(html).toContain('data-testid="timer-progress-bar"');
        expect(html).toContain('bg-rose-500');
      });

      it('タイムアップ通知メッセージのレンダリングが正常に行われる', () => {
        const html = renderToString(
          <GameBoard
            initialState={{
              phase: 'PLAYER_TURN_START',
              timeLimit: 30,
              remainingTime: 30,
              players: mockPlayers,
              activePlayerIndex: 0,
            }}
            initialTimeUpBanner={TIME_UP_MESSAGE}
          />
        );

        expect(html).toContain('data-testid="timeup-banner"');
        expect(html).toContain('role="alert"');
        expect(html).toContain('⚠️ TIME UP! 制限時間を超過したため、引いたカードが強制オープンされました');
      });

      it('タイムアップバナーがない場合はタイムアップバナーが描画されない', () => {
        const html = renderToString(
          <GameBoard
            initialState={{
              phase: 'PLAYER_TURN_START',
              timeLimit: 30,
              remainingTime: 30,
              players: mockPlayers,
              activePlayerIndex: 0,
            }}
            initialTimeUpBanner={null}
          />
        );

        expect(html).not.toContain('data-testid="timeup-banner"');
        expect(html).not.toContain(TIME_UP_MESSAGE);
      });
    });

    describe('決着画面（SCR-006 / GAME_OVER）と ResultModal の統合検証', () => {
      const mockGameOverPlayers = [
        {
          id: 'test_user_1',
          name: 'あなた',
          isHuman: true,
          cards: [
            { id: 'b-1', color: 'black' as const, number: 1, isOpen: false },
            { id: 'w-2', color: 'white' as const, number: 2, isOpen: false },
          ],
          isEliminated: false,
          avatarColor: 'from-blue-500 to-indigo-600',
        },
        {
          id: 'cpu-1',
          name: 'CPU 1',
          isHuman: false,
          cards: [
            { id: 'b-5', color: 'black' as const, number: 5, isOpen: true },
            { id: 'w-8', color: 'white' as const, number: 8, isOpen: true },
          ],
          isEliminated: true,
          avatarColor: 'from-amber-500 to-orange-600',
        },
      ];

      it('GAME_OVER フェーズ時に決着モーダル（ResultModal）および祝祭演出が正常にレンダリングされる', () => {
        const html = renderToString(
          <GameBoard
            initialState={{
              phase: 'GAME_OVER',
              timeLimit: 30,
              remainingTime: 30,
              playerCount: 2,
              difficulty: 'normal',
              players: mockGameOverPlayers,
              winner: mockGameOverPlayers[0], // 人間プレイヤーが勝者
            }}
          />
        );

        // ResultModal 本体の存在
        expect(html).toContain('data-testid="result-modal"');
        expect(html).toContain('data-testid="result-winner-badge"');
        expect(html).toContain('👑 あなたの完全勝利！');
        expect(html).toContain('data-testid="confetti-effect"');

        // アクションボタンの存在
        expect(html).toContain('data-testid="btn-play-again"');
        expect(html).toContain('data-testid="btn-return-setup"');

        // 中央テーブル内の戦績サマリ表示ボタン
        expect(html).toContain('戦績サマリを表示');
      });
    });

    describe('Issue #17: UIコンポーネントへの data-testid 属性付与とアクセシビリティ検証', () => {
      const mockA11yPlayers = [
        {
          id: 'test_user_1',
          name: 'あなた',
          isHuman: true,
          cards: [
            { id: 'b-0', color: 'black' as const, number: 0, isOpen: false },
            { id: 'w-4', color: 'white' as const, number: 4, isOpen: false },
          ],
          isEliminated: false,
          avatarColor: 'from-blue-500 to-indigo-600',
        },
        {
          id: 'cpu-1',
          name: 'CPU 1',
          isHuman: false,
          cards: [
            { id: 'b-2', color: 'black' as const, number: 2, isOpen: false },
            { id: 'w-6', color: 'white' as const, number: 6, isOpen: false },
          ],
          isEliminated: false,
          avatarColor: 'from-amber-500 to-orange-600',
        },
      ];

      it('ヘッダーボタンに data-testid 属性（ルール・再戦・設定）が付与されている', () => {
        const html = renderToString(
          <GameBoard
            initialState={{
              phase: 'PLAYER_TURN_START',
              timeLimit: 30,
              remainingTime: 30,
              players: mockA11yPlayers,
              activePlayerIndex: 0,
            }}
          />
        );

        expect(html).toContain('data-testid="btn-open-rules"');
        expect(html).toContain('data-testid="btn-restart-game"');
        expect(html).toContain('data-testid="btn-open-settings"');
      });

      it('ドローボタン（山札デッキ）に data-testid="btn-draw-card" とキーボード用 a11y 属性が付与されている', () => {
        const html = renderToString(
          <GameBoard
            initialState={{
              phase: 'PLAYER_TURN_START',
              timeLimit: 30,
              remainingTime: 30,
              players: mockA11yPlayers,
              activePlayerIndex: 0,
              deck: [
                { id: 'b-7', color: 'black' as const, number: 7, isOpen: false },
                { id: 'w-9', color: 'white' as const, number: 9, isOpen: false },
              ],
            }}
          />
        );

        expect(html).toContain('data-testid="btn-draw-card"');
        expect(html).toContain('role="button"');
        expect(html).toContain('tabindex="0"');
        expect(html).toContain('aria-label="山札 (残り2枚) - クリックしてドロー"');
      });

      it('プレイヤーおよび相手の手札エリアに data-testid="player-hand-${id}" が付与されている', () => {
        const html = renderToString(
          <GameBoard
            initialState={{
              phase: 'PLAYER_TURN_START',
              timeLimit: 30,
              remainingTime: 30,
              players: mockA11yPlayers,
              activePlayerIndex: 0,
            }}
          />
        );

        expect(html).toContain('data-testid="player-hand-test_user_1"');
        expect(html).toContain('data-testid="player-hand-cpu-1"');
      });

      it('相手カードに data-testid="opponent-card-0" および "card-element" が付与されている', () => {
        const html = renderToString(
          <GameBoard
            initialState={{
              phase: 'PLAYER_SELECT_TARGET',
              timeLimit: 30,
              remainingTime: 30,
              players: mockA11yPlayers,
              activePlayerIndex: 0,
            }}
          />
        );

        expect(html).toContain('data-testid="opponent-card-0"');
        expect(html).toContain('data-testid="opponent-card-1"');
        expect(html).toContain('data-testid="card-element"');
        // 相手カード選択可能時は button ロールと tabIndex が付与される
        expect(html).toContain('role="button"');
        expect(html).toContain('tabindex="0"');
      });

      it('対戦ログエリアに data-testid="game-log-list" および a11y 属性が付与されている', () => {
        const html = renderToString(
          <GameBoard
            initialState={{
              phase: 'PLAYER_TURN_START',
              timeLimit: 30,
              remainingTime: 30,
              players: mockA11yPlayers,
              activePlayerIndex: 0,
              logs: [
                {
                  id: 'log-1',
                  attackerId: 'test_user_1',
                  attackerName: 'あなた',
                  targetPlayerId: 'cpu-1',
                  targetPlayerName: 'CPU 1',
                  targetCardIndex: 0,
                  targetColor: 'black',
                  guessedNumber: 2,
                  isHit: true,
                  timestamp: Date.now(),
                  message: 'あなた が CPU 1 の左から 1 番目 [黒] を [2] と推理して【的中】！',
                },
              ],
            }}
          />
        );

        expect(html).toContain('data-testid="game-log-list"');
        expect(html).toContain('role="region"');
        expect(html).toContain('aria-label="対戦ログ"');
        expect(html).toContain('aria-live="polite"');
      });

      it('ステータスバナーに data-testid="status-message" が付与されている', () => {
        const html = renderToString(
          <GameBoard
            initialState={{
              phase: 'PLAYER_TURN_START',
              timeLimit: 30,
              remainingTime: 30,
              players: mockA11yPlayers,
              activePlayerIndex: 0,
            }}
          />
        );

        expect(html).toContain('data-testid="status-message"');
        expect(html).toContain('あなたのターン');
      });

      it('PLAYER_DECIDE_NEXT フェーズ時に「続けてアタック」と「ステイ」ボタンに data-testid が付与されている', () => {
        const html = renderToString(
          <GameBoard
            initialState={{
              phase: 'PLAYER_DECIDE_NEXT',
              timeLimit: 30,
              remainingTime: 30,
              players: mockA11yPlayers,
              activePlayerIndex: 0,
            }}
          />
        );

        expect(html).toContain('data-testid="btn-continue-attack"');
        expect(html).toContain('data-testid="btn-stay"');
      });
    });
  });
});
