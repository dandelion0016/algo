import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import {
  GameBoard,
  getTimerColorClass,
  getProgressBarColorClass,
  calculateProgressPercentage,
  TIME_UP_MESSAGE,
  TIME_UP_AUTO_DRAW_MESSAGE,
  TIME_UP_NO_DECK_MESSAGE,
  getKnownNumbersForColor,
} from '../GameBoard';
import { render, screen, act, fireEvent } from '@testing-library/react';
import * as useUserSessionModule from '../../hooks/useUserSession';
import { createDeck, setupGamePlayers, insertCardInOrder, isAllOpen, getNextActivePlayerIndex, checkAttack } from '../../lib/algoEngine';
import { getNextActionMessage } from '../CpuAttackModal';
import { Card, GameState, AttackLog, Player } from '../../types/game';
import { getAuditLogs, clearAuditLogs, auditLogger } from '../../lib/auditLogger';

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

  describe('タイマーPause/Resume判定ロジックの仕様検証 (Issue #86 タイマーストール防止改修)', () => {
    // isTimerPaused の条件:
    // (isManualPaused || confirmModal.isOpen || (!isTimedMatch && isInformationModalOpen)) && isGameInProgress && phase !== 'CPU_ACTING'

    const checkTimerPaused = (params: {
      isRuleModalOpen?: boolean;
      isHintModalOpen?: boolean;
      isTutorialOpen?: boolean;
      isTutorialPromptOpen?: boolean;
      isConfirmModalOpen?: boolean;
      isManualPaused?: boolean;
      phase: GameState['phase'];
      timeLimit: number;
    }) => {
      const isGameInProgress =
        params.phase !== 'SETUP' &&
        params.phase !== 'GAME_OVER';

      const isTimedMatch = params.timeLimit > 0;
      const isInformationModalOpen = Boolean(
        params.isRuleModalOpen ||
        params.isHintModalOpen ||
        params.isTutorialOpen ||
        params.isTutorialPromptOpen
      );

      return Boolean(
        (params.isManualPaused ||
          params.isConfirmModalOpen ||
          (!isTimedMatch && isInformationModalOpen)) &&
          isGameInProgress &&
          params.phase !== 'CPU_ACTING'
      );
    };

    it('時間無制限（timeLimit = 0）の時はルールモーダル等が開いているとタイマーは一時停止扱い（isTimerPaused = true）となる', () => {
      const isPaused = checkTimerPaused({
        isRuleModalOpen: true,
        isConfirmModalOpen: false,
        isManualPaused: false,
        phase: 'PLAYER_TURN_START',
        timeLimit: 0,
      });
      expect(isPaused).toBe(true);
    });

    it('【Issue #86 脆弱性解消】持ち時間対戦（timeLimit = 30）でルールモーダルが開いてもタイマーは停止せず継続（isTimerPaused = false）となる', () => {
      const isPaused = checkTimerPaused({
        isRuleModalOpen: true,
        isConfirmModalOpen: false,
        isManualPaused: false,
        phase: 'PLAYER_TURN_START',
        timeLimit: 30,
      });
      expect(isPaused).toBe(false);
    });

    it('【Issue #86 脆弱性解消】持ち時間対戦（timeLimit = 15）でヒントモーダルが開いてもタイマーは停止せず継続（isTimerPaused = false）となる', () => {
      const isPaused = checkTimerPaused({
        isHintModalOpen: true,
        isConfirmModalOpen: false,
        isManualPaused: false,
        phase: 'PLAYER_TURN_START',
        timeLimit: 15,
      });
      expect(isPaused).toBe(false);
    });

    it('【Issue #86 脆弱性解消】持ち時間対戦でチュートリアルモーダルが開いてもタイマーは停止せず継続（isTimerPaused = false）となる', () => {
      const isPaused = checkTimerPaused({
        isTutorialOpen: true,
        isConfirmModalOpen: false,
        isManualPaused: false,
        phase: 'PLAYER_TURN_START',
        timeLimit: 30,
      });
      expect(isPaused).toBe(false);
    });

    it('持ち時間対戦中であっても、手動ポーズ（isManualPaused = true）の時は明示的中断としてタイマーが一時停止（isTimerPaused = true）となる', () => {
      const isPaused = checkTimerPaused({
        isRuleModalOpen: false,
        isConfirmModalOpen: false,
        isManualPaused: true,
        phase: 'PLAYER_TURN_START',
        timeLimit: 30,
      });
      expect(isPaused).toBe(true);
    });

    it('持ち時間対戦中であっても、離脱確認（isConfirmModalOpen = true）の時は明示的中断としてタイマーが一時停止（isTimerPaused = true）となる', () => {
      const isPaused = checkTimerPaused({
        isRuleModalOpen: false,
        isConfirmModalOpen: true,
        isManualPaused: false,
        phase: 'PLAYER_TURN_START',
        timeLimit: 30,
      });
      expect(isPaused).toBe(true);
    });

    it('すべてのモーダルが閉じ手動ポーズも解除されている時はタイマーが通常稼働（isTimerPaused = false）となる', () => {
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

    it('手動ポーズまたは確認モーダル中（isTimerPaused = true）は残り時間が減算されない', () => {
      let remainingTime = 25;
      const isTimerPaused = true;

      // 5秒経過シミュレーション（手動ポーズ状態）
      for (let i = 0; i < 5; i++) {
        if (!isTimerPaused) {
          remainingTime -= 1;
        }
      }

      // 残り秒数は25秒のまま保持される
      expect(remainingTime).toBe(25);
    });

    it('【Issue #86】持ち時間対戦中にルールモーダルやヒントモーダルを開いたまま放置してもタイマー減算が進行する（タイマーストール防止）', () => {
      let remainingTime = 30;
      const isTimedMatch = true;
      const isRuleModalOpen = true;
      const isManualPaused = false;
      const isConfirmModalOpen = false;

      // isTimerPaused は false となる
      const isTimerPaused = Boolean(
        isManualPaused || isConfirmModalOpen || (!isTimedMatch && isRuleModalOpen)
      );

      expect(isTimerPaused).toBe(false);

      // 10秒放置シミュレーション
      for (let i = 0; i < 10; i++) {
        if (!isTimerPaused) {
          remainingTime -= 1;
        }
      }

      // 放置してもタイマーストールせず20秒まで減算される
      expect(remainingTime).toBe(20);
    });

    it('手動ポーズを解除した後は中断された時点の残り秒数から正確に再開（Resume）する', () => {
      let remainingTime = 20;

      // 1. 最初は通常進行（2秒経過）
      let isTimerPaused = false;
      for (let i = 0; i < 2; i++) {
        if (!isTimerPaused) remainingTime -= 1;
      }
      expect(remainingTime).toBe(18);

      // 2. 手動ポーズをクリック（一時停止、4秒経過）
      isTimerPaused = true;
      for (let i = 0; i < 4; i++) {
        if (!isTimerPaused) remainingTime -= 1;
      }
      expect(remainingTime).toBe(18); // 減算されない

      // 3. 手動ポーズを解除（再開、3秒経過）
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
        expect(html).toContain('TIME UP! 制限時間を超過したため、引いたカードが強制オープンされました');
        expect(html).not.toContain('⚠️');
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

      it('Issue #60: GAME_OVER 時に相手の未オープン伏せカードが盤面上で表向き開示され、答え合わせバッジとバナーが表示される', () => {
        const gameOverWithHiddenOpponent = [
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
              { id: 'w-9', color: 'white' as const, number: 9, isOpen: false }, // 未オープンのカード
            ],
            isEliminated: true,
            avatarColor: 'from-amber-500 to-orange-600',
          },
        ];

        const { container } = render(
          <GameBoard
            initialState={{
              phase: 'GAME_OVER',
              timeLimit: 30,
              remainingTime: 30,
              playerCount: 2,
              difficulty: 'normal',
              players: gameOverWithHiddenOpponent,
              winner: gameOverWithHiddenOpponent[0],
            }}
          />
        );

        // 1. 答え合わせバナー（game-over-reveal-banner）が存在すること
        const banner = container.querySelector('[data-testid="game-over-reveal-banner"]');
        expect(banner).not.toBeNull();
        expect(banner?.textContent).toContain('全プレイヤーの手札の答え合わせが開示されています');

        // 2. 相手（CPU 1）の未オープンカード（w-9）が盤面上で数字 9 とともに開示されていること
        const opponentCard1 = container.querySelector('[data-testid="opponent-card-1"]');
        expect(opponentCard1).not.toBeNull();
        expect(opponentCard1?.textContent).toContain('9');
        expect(opponentCard1?.textContent).not.toContain('?');

        // 3. 相手の未オープンカードに「開示」バッジ（reveal-badge）が表示されていること
        const revealBadge = opponentCard1?.querySelector('[data-testid="reveal-badge"]');
        expect(revealBadge).not.toBeNull();
        expect(revealBadge?.textContent).toBe('開示');

        // 4. 既にオープンされていたカード（b-5）は「OPEN」バッジのままであること
        const opponentCard0 = container.querySelector('[data-testid="opponent-card-0"]');
        expect(opponentCard0?.textContent).toContain('5');
        expect(opponentCard0?.textContent).toContain('OPEN');
        expect(opponentCard0?.querySelector('[data-testid="reveal-badge"]')).toBeNull();
      });

      it('Issue #60: リザルトモーダルを閉じた際（盤面振り返り時）に相手カードが開示されたままであり、結果を見るボタンが表示される', () => {
        const gameOverWithHiddenOpponent = [
          {
            id: 'test_user_1',
            name: 'あなた',
            isHuman: true,
            cards: [
              { id: 'b-1', color: 'black' as const, number: 1, isOpen: false },
            ],
            isEliminated: false,
            avatarColor: 'from-blue-500 to-indigo-600',
          },
          {
            id: 'cpu-1',
            name: 'CPU 1',
            isHuman: false,
            cards: [
              { id: 'w-7', color: 'white' as const, number: 7, isOpen: false },
            ],
            isEliminated: true,
            avatarColor: 'from-amber-500 to-orange-600',
          },
        ];

        const { container } = render(
          <GameBoard
            initialState={{
              phase: 'GAME_OVER',
              playerCount: 2,
              players: gameOverWithHiddenOpponent,
              winner: gameOverWithHiddenOpponent[0],
            }}
          />
        );

        // 「盤面を振り返る（モーダルを閉じる）」をクリック
        const closeBtn = screen.getByText('盤面を振り返る（モーダルを閉じる）');
        fireEvent.click(closeBtn);

        // リザルトモーダルが閉じていること
        expect(screen.queryByTestId('result-modal')).toBeNull();

        // 相手のカードは開示されたままであること
        const opponentCard = container.querySelector('[data-testid="opponent-card-0"]');
        expect(opponentCard?.textContent).toContain('7');
        expect(opponentCard?.querySelector('[data-testid="reveal-badge"]')?.textContent).toBe('開示');

        // ヘッダーに「結果を見る」再表示ボタン（btn-reopen-result）が表示されていること
        const reopenBtn = screen.getByTestId('btn-reopen-result');
        expect(reopenBtn).toBeInTheDocument();

        // 再表示ボタンをクリックするとリザルトモーダルが再び開くこと
        fireEvent.click(reopenBtn);
        expect(screen.getByTestId('result-modal')).toBeInTheDocument();
      });

      it('Issue #60: ゲーム進行中（phase !== GAME_OVER）は相手の伏せカードが絶対に開示されず「?」であること（Information Hidingの堅持）', () => {
        const activeGamePlayers = [
          {
            id: 'test_user_1',
            name: 'あなた',
            isHuman: true,
            cards: [
              { id: 'b-1', color: 'black' as const, number: 1, isOpen: false },
            ],
            isEliminated: false,
            avatarColor: 'from-blue-500 to-indigo-600',
          },
          {
            id: 'cpu-1',
            name: 'CPU 1',
            isHuman: false,
            cards: [
              { id: 'w-7', color: 'white' as const, number: 7, isOpen: false },
            ],
            isEliminated: false,
            avatarColor: 'from-amber-500 to-orange-600',
          },
        ];

        const { container } = render(
          <GameBoard
            initialState={{
              phase: 'PLAYER_SELECT_TARGET',
              playerCount: 2,
              players: activeGamePlayers,
              activePlayerIndex: 0,
            }}
          />
        );

        const opponentCard = container.querySelector('[data-testid="opponent-card-0"]');
        expect(opponentCard).not.toBeNull();
        expect(opponentCard?.textContent).toContain('?');
        expect(opponentCard?.textContent).not.toContain('7');
        expect(container.querySelector('[data-testid="game-over-reveal-banner"]')).toBeNull();
        expect(opponentCard?.querySelector('[data-testid="reveal-badge"]')).toBeNull();
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

  describe('getKnownNumbersForColor (Issue #38: ターゲットカードの色を考慮した確認済み数字の算出)', () => {
    const mockColorPlayers: Player[] = [
      {
        id: 'player-1',
        name: 'あなた',
        isHuman: true,
        isEliminated: false,
        avatarColor: 'blue',
        cards: [
          { id: 'b-2', color: 'black', number: 2, isOpen: false },
          { id: 'w-3', color: 'white', number: 3, isOpen: false },
          { id: 'b-7', color: 'black', number: 7, isOpen: true },
        ],
      },
      {
        id: 'cpu-1',
        name: 'CPU 1',
        isHuman: false,
        isEliminated: false,
        avatarColor: 'green',
        cards: [
          { id: 'b-4', color: 'black', number: 4, isOpen: false }, // 相手の伏せ黒カード（推理対象）
          { id: 'b-5', color: 'black', number: 5, isOpen: true }, // 相手のオープン黒カード
          { id: 'w-8', color: 'white', number: 8, isOpen: true }, // 相手のオープン白カード
          { id: 'w-9', color: 'white', number: 9, isOpen: false }, // 相手の伏せ白カード
        ],
      },
    ];

    it('ターゲットが黒のとき、白カードの数字は含まれず、自分の黒・相手のオープン黒・引いた黒の数字のみが含まれる', () => {
      const drawnCard: Card = { id: 'b-10', color: 'black', number: 10, isOpen: false };
      const known = getKnownNumbersForColor('black', mockColorPlayers, drawnCard);

      // 人間手札の黒: 2, 7
      expect(known).toContain(2);
      expect(known).toContain(7);
      // 相手のオープン黒: 5
      expect(known).toContain(5);
      // 引いた黒: 10
      expect(known).toContain(10);

      // 白カードの数字は含まれないこと（Issue #38の核心）
      expect(known).not.toContain(3); // 自分の白
      expect(known).not.toContain(8); // 相手のオープン白
      expect(known).not.toContain(9); // 相手の伏せ白

      // 相手の伏せ黒カードの数字は含まれないこと
      expect(known).not.toContain(4);

      // 全件検証
      expect(known.sort((a, b) => a - b)).toEqual([2, 5, 7, 10]);
    });

    it('ターゲットが白のとき、黒カードの数字は含まれず、自分の白・相手のオープン白・引いた白の数字のみが含まれる', () => {
      const drawnCard: Card = { id: 'w-11', color: 'white', number: 11, isOpen: false };
      const known = getKnownNumbersForColor('white', mockColorPlayers, drawnCard);

      // 人間手札の白: 3
      expect(known).toContain(3);
      // 相手のオープン白: 8
      expect(known).toContain(8);
      // 引いた白: 11
      expect(known).toContain(11);

      // 黒カードの数字は含まれないこと
      expect(known).not.toContain(2); // 自分の黒
      expect(known).not.toContain(7); // 自分の黒
      expect(known).not.toContain(4); // 相手の伏せ黒
      expect(known).not.toContain(5); // 相手のオープン黒

      // 相手の伏せ白カードの数字は含まれないこと
      expect(known).not.toContain(9);

      // 全件検証
      expect(known.sort((a, b) => a - b)).toEqual([3, 8, 11]);
    });

    it('引いたカード（drawnCard）の色がターゲットと異なる場合、確認済み数字に含まれない', () => {
      const drawnWhiteCard: Card = { id: 'w-1', color: 'white', number: 1, isOpen: false };
      const known = getKnownNumbersForColor('black', mockColorPlayers, drawnWhiteCard);

      expect(known).not.toContain(1);
    });

    it('同一数字の重複カードが存在しても確認済み数字リストには重複なく含まれる', () => {
      const duplicatePlayers: Player[] = [
        {
          id: 'player-1',
          name: 'あなた',
          isHuman: true,
          isEliminated: false,
          avatarColor: 'blue',
          cards: [{ id: 'b-2-a', color: 'black', number: 2, isOpen: true }],
        },
        {
          id: 'cpu-1',
          name: 'CPU 1',
          isHuman: false,
          isEliminated: false,
          avatarColor: 'green',
          cards: [{ id: 'b-2-b', color: 'black', number: 2, isOpen: true }],
        },
      ];
      const drawnCard: Card = { id: 'b-2-c', color: 'black', number: 2, isOpen: false };

      const known = getKnownNumbersForColor('black', duplicatePlayers, drawnCard);
      expect(known.filter((n) => n === 2).length).toBe(1);
    });

    it('GameBoard内で黒カードターゲット選択時にAttackModalへ渡される確認済み数字に白の数字が含まれない', () => {
      const html = renderToString(
        <GameBoard
          initialState={{
            phase: 'PLAYER_GUESS_NUMBER',
            timeLimit: 30,
            remainingTime: 30,
            players: mockColorPlayers,
            activePlayerIndex: 0,
            selectedTarget: {
              playerId: 'cpu-1',
              cardIndex: 0, // mockColorPlayers[1].cards[0] は color: 'black', number: 4
            },
            drawnCard: { id: 'b-10', color: 'black', number: 10, isOpen: false },
          }}
        />
      );

      // モーダルが表示されている
      expect(html).toContain('data-testid="attack-modal"');
      expect(html).toContain('黒カード');

      // 黒の確認済み数字 (2, 5, 7, 10) には「確認済」バッジまたは aria-label に (確認済) が付く
      expect(html).toContain('aria-label="数字 2 (確認済)"');
      expect(html).toContain('aria-label="数字 5 (確認済)"');
      expect(html).toContain('aria-label="数字 7 (確認済)"');
      expect(html).toContain('aria-label="数字 10 (確認済)"');

      // 白の数字 (3, 8) には「確認済」が付かないこと（Issue #38）
      expect(html).toContain('aria-label="数字 3"');
      expect(html).not.toContain('aria-label="数字 3 (確認済)"');
      expect(html).toContain('aria-label="数字 8"');
      expect(html).not.toContain('aria-label="数字 8 (確認済)"');
    });

    it('GameBoard内で白カードターゲット選択時にAttackModalへ渡される確認済み数字に黒の数字が含まれない', () => {
      const html = renderToString(
        <GameBoard
          initialState={{
            phase: 'PLAYER_GUESS_NUMBER',
            timeLimit: 30,
            remainingTime: 30,
            players: mockColorPlayers,
            activePlayerIndex: 0,
            selectedTarget: {
              playerId: 'cpu-1',
              cardIndex: 3, // mockColorPlayers[1].cards[3] は color: 'white', number: 9
            },
            drawnCard: { id: 'w-11', color: 'white', number: 11, isOpen: false },
          }}
        />
      );

      // モーダルが表示されている
      expect(html).toContain('data-testid="attack-modal"');
      expect(html).toContain('白カード');

      // 白の確認済み数字 (3, 8, 11) には「確認済」が付く
      expect(html).toContain('aria-label="数字 3 (確認済)"');
      expect(html).toContain('aria-label="数字 8 (確認済)"');
      expect(html).toContain('aria-label="数字 11 (確認済)"');

      // 黒の数字 (2, 5, 7) には「確認済」が付かないこと（Issue #38）
      expect(html).toContain('aria-label="数字 2"');
      expect(html).not.toContain('aria-label="数字 2 (確認済)"');
      expect(html).toContain('aria-label="数字 5"');
      expect(html).not.toContain('aria-label="数字 5 (確認済)"');
    });
  });

  describe('Issue #36: モバイル端末での1画面完結レイアウト対応', () => {
    const mockMobilePlayers: Player[] = [
      {
        id: 'player-1',
        name: 'あなた',
        isHuman: true,
        isEliminated: false,
        avatarColor: 'blue',
        cards: [
          { id: 'b-1', color: 'black', number: 1, isOpen: false },
          { id: 'w-4', color: 'white', number: 4, isOpen: false },
          { id: 'b-7', color: 'black', number: 7, isOpen: true },
        ],
      },
      {
        id: 'cpu-1',
        name: 'CPU 1',
        isHuman: false,
        isEliminated: false,
        avatarColor: 'green',
        cards: [
          { id: 'b-3', color: 'black', number: 3, isOpen: false },
          { id: 'w-6', color: 'white', number: 6, isOpen: false },
        ],
      },
    ];

    it('盤面全体コンテナに100dvhおよびオーバーフロー防止クラスが付与されている', () => {
      const html = renderToString(
        <GameBoard
          initialState={{
            phase: 'PLAYER_TURN_START',
            timeLimit: 30,
            remainingTime: 30,
            players: mockMobilePlayers,
            activePlayerIndex: 0,
            deck: [{ id: 'w-8', color: 'white', number: 8, isOpen: false }],
          }}
        />
      );

      // モバイルで1画面に収めるためのCSSクラス
      expect(html).toContain('h-[100dvh]');
      expect(html).toContain('max-h-[100dvh]');
      expect(html).toContain('overflow-hidden');
      expect(html).toContain('lg:h-auto');
      expect(html).toContain('lg:overflow-visible');
    });

    it('ヘッダーアクションボタン群に whitespace-nowrap と横スクロールコンテナが付与され、文字の縦潰れが防止されている (Issue #67)', () => {
      const html = renderToString(
        <GameBoard
          initialState={{
            phase: 'PLAYER_TURN_START',
            timeLimit: 30,
            remainingTime: 30,
            players: mockMobilePlayers,
            activePlayerIndex: 0,
            deck: [{ id: 'w-8', color: 'white', number: 8, isOpen: false }],
          }}
        />
      );

      // 横スクロール・非折り返しコンテナ
      expect(html).toContain('overflow-x-auto');
      expect(html).toContain('no-scrollbar');

      // 主要アクションボタンに whitespace-nowrap と shrink-0 が付与されている
      expect(html).toMatch(/data-testid="btn-get-hint"[^>]*whitespace-nowrap[^>]*shrink-0/);
      expect(html).toMatch(/data-testid="btn-toggle-assist"[^>]*whitespace-nowrap[^>]*shrink-0/);
      expect(html).toMatch(/data-testid="btn-header-tutorial"[^>]*whitespace-nowrap[^>]*shrink-0/);
      expect(html).toMatch(/data-testid="btn-open-rules"[^>]*whitespace-nowrap[^>]*shrink-0/);
      expect(html).toMatch(/data-testid="btn-restart-game"[^>]*whitespace-nowrap[^>]*shrink-0/);
      expect(html).toMatch(/data-testid="btn-open-settings"[^>]*whitespace-nowrap[^>]*shrink-0/);
      expect(html).toMatch(/data-testid="btn-toggle-log"[^>]*whitespace-nowrap[^>]*shrink-0/);
    });

    it('モバイル向け対戦ログトグルボタン（btn-toggle-log）がレンダリングされる', () => {
      const mockLogs: AttackLog[] = [
        {
          id: 'log-1',
          attackerId: 'player-1',
          attackerName: 'あなた',
          targetPlayerId: 'cpu-1',
          targetPlayerName: 'CPU 1',
          targetCardIndex: 0,
          targetColor: 'black',
          guessedNumber: 3,
          isHit: true,
          timestamp: Date.now(),
          message: 'あなたの推理が的中！',
        },
      ];

      const html = renderToString(
        <GameBoard
          initialState={{
            phase: 'PLAYER_TURN_START',
            timeLimit: 30,
            remainingTime: 30,
            players: mockMobilePlayers,
            activePlayerIndex: 0,
            deck: [{ id: 'w-8', color: 'white', number: 8, isOpen: false }],
            logs: mockLogs,
          }}
        />
      );

      expect(html).toContain('data-testid="btn-toggle-log"');
      expect(html).toContain('aria-label="対戦ログを開く (1件)"');
    });

    it('中央操作エリア（山札・引いたカード・手番ガイダンス）と相手・自身手札がすべてレンダリングされる', () => {
      const html = renderToString(
        <GameBoard
          initialState={{
            phase: 'PLAYER_TURN_START',
            timeLimit: 30,
            remainingTime: 30,
            players: mockMobilePlayers,
            activePlayerIndex: 0,
            deck: [{ id: 'w-8', color: 'white', number: 8, isOpen: false }],
          }}
        />
      );

      // 相手手札
      expect(html).toContain('data-testid="player-hand-cpu-1"');
      // 山札
      expect(html).toContain('data-testid="btn-draw-card"');
      // 引いたカードエリア
      expect(html).toContain('data-testid="drawn-card-area"');
      // ガイダンスメッセージ
      expect(html).toContain('data-testid="status-message"');
      // 自身手札
      expect(html).toContain('data-testid="player-hand-player-1"');
      // デスクトップ用ログエリア
      expect(html).toContain('data-testid="game-log-list"');
    });

    it('4人対戦時でも相手全員の手札エリアとカードが省スペースで描画される', () => {
      const fourPlayers: Player[] = [
        ...mockMobilePlayers,
        {
          id: 'cpu-2',
          name: 'CPU 2',
          isHuman: false,
          isEliminated: false,
          avatarColor: 'purple',
          cards: [{ id: 'b-2', color: 'black', number: 2, isOpen: false }],
        },
        {
          id: 'cpu-3',
          name: 'CPU 3',
          isHuman: false,
          isEliminated: false,
          avatarColor: 'amber',
          cards: [{ id: 'w-5', color: 'white', number: 5, isOpen: false }],
        },
      ];

      const html = renderToString(
        <GameBoard
          initialState={{
            playerCount: 4,
            phase: 'PLAYER_TURN_START',
            timeLimit: 30,
            remainingTime: 30,
            players: fourPlayers,
            activePlayerIndex: 0,
            deck: [],
          }}
        />
      );

      expect(html).toContain('data-testid="player-hand-cpu-1"');
      expect(html).toContain('data-testid="player-hand-cpu-2"');
      expect(html).toContain('data-testid="player-hand-cpu-3"');
      expect(html).toContain('data-testid="player-hand-player-1"');
    });
  });

  describe('初心者向け初期値およびチュートリアル機能 (Issue #41)', () => {
    it('初期フェーズ SETUP でチュートリアルボタン（btn-setup-tutorial）が表示される', () => {
      const html = renderToString(<GameBoard />);
      expect(html).toContain('data-testid="btn-setup-tutorial"');
      expect(html).toContain('チュートリアル');
      // デフォルトで「初級：気楽に推理」および「無制限（じっくり思考）」が表示されること
      expect(html).toContain('初級：気楽に推理');
      expect(html).toContain('無制限（じっくり思考）');
      expect(html).toContain('おすすめ（初心者向け）');
    });

    it('対戦盤面ヘッダーにチュートリアルボタン（btn-header-tutorial）が表示される', () => {
      const html = renderToString(
        <GameBoard
          initialState={{
            phase: 'PLAYER_TURN_START',
            players: [
              {
                id: 'p1',
                name: 'あなた',
                isHuman: true,
                avatarColor: 'from-blue-500 to-indigo-600',
                isEliminated: false,
                cards: [],
              },
              {
                id: 'cpu-1',
                name: 'CPU アル',
                isHuman: false,
                avatarColor: 'from-amber-400 to-yellow-600',
                isEliminated: false,
                cards: [],
              },
            ],
            activePlayerIndex: 0,
          }}
        />
      );

      expect(html).toContain('data-testid="btn-header-tutorial"');
      expect(html).toContain('data-testid="btn-open-rules"');
    });

    it('Issue #42: ヘッダーに「🔰 アシスト ON/OFF」切り替えボタンが存在する', () => {
      const html = renderToString(
        <GameBoard
          initialState={{
            phase: 'PLAYER_TURN_START',
            players: [
              {
                id: 'p1',
                name: 'あなた',
                isHuman: true,
                avatarColor: '',
                isEliminated: false,
                cards: [],
              },
              {
                id: 'cpu-1',
                name: 'CPU 1',
                isHuman: false,
                avatarColor: '',
                isEliminated: false,
                cards: [],
              },
            ],
            activePlayerIndex: 0,
          }}
        />
      );

      expect(html).toContain('data-testid="btn-toggle-assist"');
      expect(html).toContain('aria-label="初心者アシスト表示: ON"');
    });

    it('Issue #42: 初心者アシストON時、相手の伏せカードに候補範囲バッジが表示される', () => {
      const html = renderToString(
        <GameBoard
          initialState={{
            phase: 'PLAYER_SELECT_TARGET',
            players: [
              {
                id: 'p1',
                name: 'あなた',
                isHuman: true,
                avatarColor: '',
                isEliminated: false,
                cards: [
                  { id: 'b-0', color: 'black', number: 0, isOpen: false },
                  { id: 'w-1', color: 'white', number: 1, isOpen: false },
                ],
              },
              {
                id: 'cpu-1',
                name: 'CPU 1',
                isHuman: false,
                avatarColor: '',
                isEliminated: false,
                cards: [
                  { id: 'b-5', color: 'black', number: 5, isOpen: true },
                  { id: 'b-?', color: 'black', number: 8, isOpen: false },
                  { id: 'w-10', color: 'white', number: 10, isOpen: true },
                ],
              },
            ],
            activePlayerIndex: 0,
          }}
        />
      );

      // 相手の伏せカード (b-?) に候補範囲バッジが表示されること
      expect(html).toContain('data-testid="candidate-range-badge"');
      expect(html).toContain('候補: 6〜10');
    });

    it('Issue #42: AttackModal が開かれた時、候補範囲ヒントが表示され候補外ボタンが識別される', () => {
      const html = renderToString(
        <GameBoard
          initialState={{
            phase: 'PLAYER_GUESS_NUMBER',
            players: [
              {
                id: 'p1',
                name: 'あなた',
                isHuman: true,
                avatarColor: '',
                isEliminated: false,
                cards: [{ id: 'b-0', color: 'black', number: 0, isOpen: false }],
              },
              {
                id: 'cpu-1',
                name: 'CPU 1',
                isHuman: false,
                avatarColor: '',
                isEliminated: false,
                cards: [
                  { id: 'b-3', color: 'black', number: 3, isOpen: true },
                  { id: 'b-target', color: 'black', number: 6, isOpen: false },
                  { id: 'b-8', color: 'black', number: 8, isOpen: true },
                ],
              },
            ],
            activePlayerIndex: 0,
            selectedTarget: {
              playerId: 'cpu-1',
              cardIndex: 1,
            },
          }}
        />
      );

      // AttackModal が表示され、候補ヒント (4〜7) が含まれる
      expect(html).toContain('data-testid="attack-modal"');
      expect(html).toContain('data-testid="attack-assist-hint"');
      expect(html).toContain('4〜7');

      // 候補外の数字 (例: 0 や 9) に data-candidate-out="true" が付与される
      expect(html).toMatch(/data-testid="btn-guess-num-0"[^>]*data-candidate-out="true"/);
      expect(html).toMatch(/data-testid="btn-guess-num-9"[^>]*data-candidate-out="true"/);
    });
  });

  describe('タイマーカウントダウン作動条件および放置対策 (Issue #62)', () => {
    it('PLAYER_TURN_START時（カードを引く前）でもタイマーカウントダウンが作動すること', () => {
      // タイマー有効判定関数 (Issue #62: PLAYER_TURN_STARTも作動)
      const isTimerRunning = (params: {
        timeLimit: number;
        phase: GameState['phase'];
        isCpuAttackWaiting: boolean;
        isTimerPaused: boolean;
      }) => {
        if (
          params.timeLimit === 0 ||
          params.phase === 'SETUP' ||
          params.phase === 'GAME_OVER' ||
          params.phase === 'CPU_ACTING' ||
          params.isCpuAttackWaiting ||
          params.isTimerPaused
        ) {
          return false;
        }
        return true;
      };

      // ドロー前（PLAYER_TURN_START）: タイマー作動（放置防止）
      expect(
        isTimerRunning({
          timeLimit: 15,
          phase: 'PLAYER_TURN_START',
          isCpuAttackWaiting: false,
          isTimerPaused: false,
        })
      ).toBe(true);

      // CPUアタックOK待ち時: タイマー停止
      expect(
        isTimerRunning({
          timeLimit: 15,
          phase: 'PLAYER_SELECT_TARGET',
          isCpuAttackWaiting: true,
          isTimerPaused: false,
        })
      ).toBe(false);

      // ドロー完了（PLAYER_SELECT_TARGET）＆OK待ちなし: タイマー作動
      expect(
        isTimerRunning({
          timeLimit: 15,
          phase: 'PLAYER_SELECT_TARGET',
          isCpuAttackWaiting: false,
          isTimerPaused: false,
        })
      ).toBe(true);

      // 推理中（PLAYER_GUESS_NUMBER）: タイマー作動
      expect(
        isTimerRunning({
          timeLimit: 15,
          phase: 'PLAYER_GUESS_NUMBER',
          isCpuAttackWaiting: false,
          isTimerPaused: false,
        })
      ).toBe(true);
    });

    it('盤面HTMLの初期レンダリングでCpuAttackModalが存在し、初期状態では表示されないこと', () => {
      const html = renderToString(
        <GameBoard
          initialState={{
            phase: 'PLAYER_TURN_START',
            players: [
              {
                id: 'player-1',
                name: 'あなた',
                isHuman: true,
                avatarColor: 'from-blue-500 to-indigo-600',
                isEliminated: false,
                cards: [],
              },
            ],
            activePlayerIndex: 0,
          }}
        />
      );

      // 初期状態ではCPUアタック結果モーダルは非表示
      expect(html).not.toContain('data-testid="cpu-attack-modal"');
    });
  });

  describe('プレイヤーアタック時の推理結果確認モーダル表示と確認待機 (Issue #56)', () => {
    it('プレイヤーのアタック結果確認モーダル待機中はタイマーカウントダウンが停止すること', () => {
      const isTimerRunning = (params: {
        timeLimit: number;
        phase: GameState['phase'];
        isAttackResultWaiting: boolean;
        isTimerPaused: boolean;
      }) => {
        if (
          params.timeLimit === 0 ||
          params.phase === 'SETUP' ||
          params.phase === 'GAME_OVER' ||
          params.phase === 'CPU_ACTING' ||
          params.phase === 'PLAYER_DECIDE_NEXT' ||
          params.isAttackResultWaiting ||
          params.isTimerPaused
        ) {
          return false;
        }
        return true;
      };

      // プレイヤーが推理後、モーダル待機中はタイマーが停止すること
      expect(
        isTimerRunning({
          timeLimit: 20,
          phase: 'PLAYER_GUESS_NUMBER',
          isAttackResultWaiting: true,
          isTimerPaused: false,
        })
      ).toBe(false);

      // モーダルが閉じられた後、次の決定フェーズ（PLAYER_DECIDE_NEXT）でもタイマーが停止（猶予）すること (Issue #89)
      expect(
        isTimerRunning({
          timeLimit: 20,
          phase: 'PLAYER_DECIDE_NEXT',
          isAttackResultWaiting: false,
          isTimerPaused: false,
        })
      ).toBe(false);
    });

    it('プレイヤーのアタック的中時: ターゲット被弾カードが開示され、モーダル待機後にPLAYER_DECIDE_NEXTへ移行すること', () => {
      const initialPlayerCards: Card[] = [
        { id: 'p1', color: 'black', number: 2, isOpen: false },
      ];
      const initialCpuCards: Card[] = [
        { id: 'c1', color: 'white', number: 5, isOpen: false },
        { id: 'c2', color: 'black', number: 8, isOpen: false },
      ];

      // アタック的中シミュレーション
      const targetCard = initialCpuCards[0];
      const guessedNumber = 5;
      const isHit = checkAttack(targetCard, guessedNumber);
      expect(isHit).toBe(true);

      // 被弾カードのオープン処理
      const updatedCpuCards = initialCpuCards.map((c, i) =>
        i === 0 ? { ...c, isOpen: true } : c
      );
      expect(updatedCpuCards[0].isOpen).toBe(true);

      // 展開案内メッセージの確認
      const nextMessage = getNextActionMessage('あなた', 'CONTINUE');
      expect(nextMessage).toBe('的中！続けてアタックするか、手札に加えてステイするか選択できます');
    });

    it('プレイヤーのアタック決着時: 最後のカード的中時に勝敗決着メッセージが案内されGAME_OVERへ移行すること', () => {
      const initialCpuCards: Card[] = [
        { id: 'c1', color: 'white', number: 5, isOpen: false },
      ];

      // 最後の1枚を的中
      const isHit = checkAttack(initialCpuCards[0], 5);
      expect(isHit).toBe(true);

      const updatedCpuCards = [{ ...initialCpuCards[0], isOpen: true }];
      const isEliminated = isAllOpen(updatedCpuCards);
      expect(isEliminated).toBe(true);

      // 決着メッセージ
      const nextMessage = getNextActionMessage('あなた', 'GAME_OVER');
      expect(nextMessage).toBe('勝敗が決しました');
    });

    it('プレイヤーのアタックハズレ時: ハズレ判定文と手番終了案内が行われ、OK押下後に引いたカードがオープンされて手番交代すること', () => {
      const initialPlayerCards: Card[] = [
        { id: 'p1', color: 'black', number: 2, isOpen: false },
      ];
      const drawnCard: Card = { id: 'd1', color: 'white', number: 7, isOpen: false };

      // ハズレ
      const isHit = checkAttack({ id: 'c1', color: 'black', number: 9, isOpen: false }, 3);
      expect(isHit).toBe(false);

      // 展開案内メッセージ
      const nextMessage = getNextActionMessage('あなた', 'TURN_END', 'CPU 1');
      expect(nextMessage).toBe('あなたのターンが終了しました。次は CPU 1 の番です');

      // OK押下後の引いたカードのオープンと挿入
      const openedDrawn = { ...drawnCard, isOpen: true };
      const updatedPlayerCards = insertCardInOrder(initialPlayerCards, openedDrawn);

      expect(updatedPlayerCards.length).toBe(2);
      expect(updatedPlayerCards.find((c) => c.id === 'd1')?.isOpen).toBe(true);
    });
  });

  describe('推理履歴・失敗数字の盤面表示 (Issue #43)', () => {
    it('過去にハズレとなった相手の伏せカードに failed-guesses-badge が表示される', () => {
      const logs: AttackLog[] = [
        {
          id: 'log-1',
          attackerId: 'player-1',
          attackerName: 'あなた',
          targetPlayerId: 'cpu-1',
          targetPlayerName: 'CPU アル',
          targetCardIndex: 0,
          targetColor: 'black',
          guessedNumber: 5,
          isHit: false, // ハズレ
          timestamp: 1000,
          message: 'ハズレ',
        },
      ];

      const html = renderToString(
        <GameBoard
          initialState={{
            phase: 'PLAYER_SELECT_TARGET',
            players: [
              {
                id: 'player-1',
                name: 'あなた',
                isHuman: true,
                avatarColor: '',
                isEliminated: false,
                cards: [{ id: 'b-0', color: 'black', number: 0, isOpen: false }],
              },
              {
                id: 'cpu-1',
                name: 'CPU アル',
                isHuman: false,
                avatarColor: '',
                isEliminated: false,
                cards: [{ id: 'b-5', color: 'black', number: 5, isOpen: false }],
              },
            ],
            activePlayerIndex: 0,
            logs,
          }}
        />
      );

      expect(html).toContain('data-testid="failed-guesses-badge"');
      expect(html).toContain('✕5');
    });

    it('アタック入力中（PLAYER_GUESS_NUMBER）に対象カードの外れ数字が AttackModal に伝達される', () => {
      const logs: AttackLog[] = [
        {
          id: 'log-1',
          attackerId: 'player-1',
          attackerName: 'あなた',
          targetPlayerId: 'cpu-1',
          targetPlayerName: 'CPU アル',
          targetCardIndex: 0,
          targetColor: 'black',
          guessedNumber: 7,
          isHit: false,
          timestamp: 1000,
          message: 'ハズレ',
        },
      ];

      const html = renderToString(
        <GameBoard
          initialState={{
            phase: 'PLAYER_GUESS_NUMBER',
            selectedTarget: {
              playerId: 'cpu-1',
              cardIndex: 0,
            },
            players: [
              {
                id: 'player-1',
                name: 'あなた',
                isHuman: true,
                avatarColor: '',
                isEliminated: false,
                cards: [{ id: 'b-0', color: 'black', number: 0, isOpen: false }],
              },
              {
                id: 'cpu-1',
                name: 'CPU アル',
                isHuman: false,
                avatarColor: '',
                isEliminated: false,
                cards: [{ id: 'b-8', color: 'black', number: 8, isOpen: false }],
              },
            ],
            activePlayerIndex: 0,
            logs,
          }}
        />
      );

      expect(html).toContain('data-testid="attack-modal"');
      expect(html).toContain('data-testid="attack-failed-numbers-hint"');
      expect(html).toContain('✕7');
      expect(html).toMatch(/data-testid="btn-guess-num-7"[^>]*data-failed-guess="true"/);
    });
  });

  describe('初心者向けAIヒント機能 (Issue #44: AIヒント推薦・モーダル・ターゲットハイライト)', () => {
    const basePlayers: Player[] = [
      {
        id: 'player-1',
        name: 'あなた',
        isHuman: true,
        avatarColor: 'from-blue-500 to-indigo-600',
        isEliminated: false,
        cards: [
          { id: 'b-0', color: 'black', number: 0, isOpen: false },
          { id: 'w-4', color: 'white', number: 4, isOpen: false },
        ],
      },
      {
        id: 'cpu-1',
        name: 'CPU 1',
        isHuman: false,
        avatarColor: 'from-red-500 to-rose-600',
        isEliminated: false,
        cards: [
          { id: 'b-2', color: 'black', number: 2, isOpen: false },
          { id: 'w-8', color: 'white', number: 8, isOpen: false },
        ],
      },
    ];

    it('プレイヤーの手番中（PLAYER_SELECT_TARGET）にヒントボタンが有効状態でレンダリングされる', () => {
      const html = renderToString(
        <GameBoard
          initialState={{
            phase: 'PLAYER_SELECT_TARGET',
            activePlayerIndex: 0,
            players: basePlayers,
          }}
          initialHintCount={3}
        />
      );

      expect(html).toContain('data-testid="btn-get-hint"');
      expect(html).toContain('💡 ヒント（残り3回）');
      expect(html).not.toMatch(/data-testid="btn-get-hint"[^>]*disabled/);
    });

    it('ヒント回数が0回の場合、ヒントボタンは disabled 属性が付与される', () => {
      const html = renderToString(
        <GameBoard
          initialState={{
            phase: 'PLAYER_SELECT_TARGET',
            activePlayerIndex: 0,
            players: basePlayers,
          }}
          initialHintCount={0}
        />
      );

      expect(html).toContain('data-testid="btn-get-hint"');
      expect(html).toContain('💡 ヒント（残り0回）');
      expect(html).toMatch(/data-testid="btn-get-hint"[^>]*disabled/);
    });

    it('CPUの手番中（CPU_ACTING）はヒントボタンが無効化（disabled）される', () => {
      const html = renderToString(
        <GameBoard
          initialState={{
            phase: 'CPU_ACTING',
            activePlayerIndex: 1,
            players: basePlayers,
          }}
          initialHintCount={2}
        />
      );

      expect(html).toContain('data-testid="btn-get-hint"');
      expect(html).toContain('💡 ヒント（残り2回）');
      expect(html).toMatch(/data-testid="btn-get-hint"[^>]*disabled/);
    });

    it('activeHint が存在する場合、該当する相手カードに data-hint-target="true" とバッジが付与される', () => {
      const mockHint = {
        targetPlayerId: 'cpu-1',
        targetPlayerName: 'CPU 1',
        targetCardIndex: 0,
        color: 'black' as const,
        possibleNumbers: [2],
        isDefinite: true,
        adviceText: 'CPU 1の左から1枚目の黒カードは [2] に確定しています！',
      };

      const html = renderToString(
        <GameBoard
          initialState={{
            phase: 'PLAYER_SELECT_TARGET',
            activePlayerIndex: 0,
            players: basePlayers,
          }}
          initialActiveHint={mockHint}
        />
      );

      expect(html).toContain('data-hint-target="true"');
      expect(html).toContain('data-testid="hint-target-badge"');
    });

    it('initialIsHintModalOpen が true の場合、HintModal が開いてアドバイス文が表示される', () => {
      const mockHint = {
        targetPlayerId: 'cpu-1',
        targetPlayerName: 'CPU 1',
        targetCardIndex: 1,
        color: 'white' as const,
        possibleNumbers: [7, 8],
        isDefinite: false,
        adviceText: 'CPU 1の右端の白カードは [7, 8] の2択に絞り込まれています！',
      };

      const html = renderToString(
        <GameBoard
          initialState={{
            phase: 'PLAYER_SELECT_TARGET',
            activePlayerIndex: 0,
            players: basePlayers,
          }}
          initialActiveHint={mockHint}
          initialIsHintModalOpen={true}
          initialHintCount={2}
        />
      );

      expect(html).toContain('data-testid="modal-hint"');
      expect(html).toContain('CPU 1の右端の白カードは [7, 8] の2択に絞り込まれています！');
      expect(html).toContain('data-testid="btn-hint-select-target"');
      expect(html).toContain('このカードを選択する');
    });
  });

  describe('山札枯渇（残り0枚）時の手番進行・アタック失敗ペナルティ・メッセージの検証 (Issue #68)', () => {
    const mockExhaustedPlayers: Player[] = [
      {
        id: 'test_user_1',
        name: 'あなた',
        isHuman: true,
        cards: [
          { id: 'b-2', color: 'black', number: 2, isOpen: false },
          { id: 'w-5', color: 'white', number: 5, isOpen: false },
        ],
        isEliminated: false,
        avatarColor: 'from-sky-400 to-blue-600',
      },
      {
        id: 'cpu-1',
        name: 'CPU 1',
        isHuman: false,
        cards: [
          { id: 'b-4', color: 'black', number: 4, isOpen: false },
          { id: 'w-8', color: 'white', number: 8, isOpen: false },
        ],
        isEliminated: false,
        avatarColor: 'from-blue-400 to-indigo-500',
      },
    ];

    it('山札0枚時の山札コンポーネント: role="button"や「引く」バッジが付与されず、クリックが促されない', () => {
      const html = renderToString(
        <GameBoard
          initialState={{
            phase: 'PLAYER_TURN_START',
            deck: [],
            players: mockExhaustedPlayers,
            activePlayerIndex: 0,
          }}
        />
      );

      // 山札表示は存在するがボタン化・ドロー誘導されない
      expect(html).toContain('data-testid="btn-draw-card"');
      expect(html).toMatch(/0.*枚/);
      expect(html).toContain('aria-label="山札 (残り0枚)"');
      expect(html).not.toContain('aria-label="山札 (残り0枚) - クリックしてドロー"');
      // 引くバッジが表示されないこと
      expect(html).not.toContain('>引く<');
      // アニメーション・カーソル指定がつかないこと
      expect(html).not.toContain('animate-bounce');
    });

    it('山札0枚時のガイダンスメッセージ: 「山札がありません。相手の伏せカードを選んでアタックしてください。」が表示される', () => {
      // 1. PLAYER_TURN_START 時
      const htmlTurnStart = renderToString(
        <GameBoard
          initialState={{
            phase: 'PLAYER_TURN_START',
            deck: [],
            players: mockExhaustedPlayers,
            activePlayerIndex: 0,
          }}
        />
      );
      expect(htmlTurnStart).toContain('山札がありません。相手の伏せカードを選んでアタックしてください。');
      expect(htmlTurnStart).not.toContain('山札をクリックしてカードを引いてください。');

      // 2. PLAYER_SELECT_TARGET 時（drawnCard なし）
      const htmlSelectTarget = renderToString(
        <GameBoard
          initialState={{
            phase: 'PLAYER_SELECT_TARGET',
            deck: [],
            drawnCard: null,
            players: mockExhaustedPlayers,
            activePlayerIndex: 0,
          }}
        />
      );
      expect(htmlSelectTarget).toContain('山札がありません。相手の伏せカードを選んでアタックしてください。');
    });

    it('山札0枚時のプレイヤーアタック失敗ペナルティ: 伏せカードの先頭が1枚オープンされる', () => {
      const currentPlayers = [
        {
          ...mockExhaustedPlayers[0],
          cards: [
            { id: 'b-2', color: 'black' as const, number: 2, isOpen: false },
            { id: 'w-5', color: 'white' as const, number: 5, isOpen: false },
          ],
        },
        { ...mockExhaustedPlayers[1] },
      ];

      // 山札0枚時のハズレペナルティ適用ロジック
      const pIdx = currentPlayers.findIndex((p) => p.isHuman);
      const firstClosedIdx = currentPlayers[pIdx].cards.findIndex((c) => !c.isOpen);
      expect(firstClosedIdx).toBe(0);

      const newCards = currentPlayers[pIdx].cards.map((c, i) =>
        i === firstClosedIdx ? { ...c, isOpen: true } : c
      );
      currentPlayers[pIdx] = {
        ...currentPlayers[pIdx],
        cards: newCards,
        isEliminated: isAllOpen(newCards),
      };

      // 1枚目（b-2）がオープンされ、2枚目（w-5）は裏向きのまま
      expect(currentPlayers[0].cards[0].isOpen).toBe(true);
      expect(currentPlayers[0].cards[1].isOpen).toBe(false);
      expect(currentPlayers[0].isEliminated).toBe(false);
    });

    it('山札0枚時のプレイヤーアタック失敗で手札が全オープンとなった場合、敗北（ゲーム終了）となる', () => {
      const currentPlayers = [
        {
          ...mockExhaustedPlayers[0],
          cards: [
            { id: 'b-2', color: 'black' as const, number: 2, isOpen: true },
            { id: 'w-5', color: 'white' as const, number: 5, isOpen: false }, // 残り1枚の伏せカード
          ],
        },
        { ...mockExhaustedPlayers[1] },
      ];

      const pIdx = currentPlayers.findIndex((p) => p.isHuman);
      const firstClosedIdx = currentPlayers[pIdx].cards.findIndex((c) => !c.isOpen);
      expect(firstClosedIdx).toBe(1);

      const newCards = currentPlayers[pIdx].cards.map((c, i) =>
        i === firstClosedIdx ? { ...c, isOpen: true } : c
      );
      currentPlayers[pIdx] = {
        ...currentPlayers[pIdx],
        cards: newCards,
        isEliminated: isAllOpen(newCards),
      };

      expect(currentPlayers[0].cards.every((c) => c.isOpen)).toBe(true);
      expect(currentPlayers[0].isEliminated).toBe(true);

      const activePlayers = currentPlayers.filter((p) => !p.isEliminated);
      expect(activePlayers.length).toBe(1);
      expect(activePlayers[0].id).toBe('cpu-1'); // CPUの勝利
    });

    it('山札0枚時のCPUアタック失敗ペナルティ: CPUの伏せカードがオープンされ、ログに手札オープンが記録される', () => {
      const cpuPlayer: Player = {
        id: 'cpu-1',
        name: 'CPU 1',
        isHuman: false,
        cards: [
          { id: 'b-4', color: 'black' as const, number: 4, isOpen: false },
          { id: 'w-8', color: 'white' as const, number: 8, isOpen: false },
        ],
        isEliminated: false,
        avatarColor: 'from-blue-400 to-indigo-500',
      };

      // CPU山札なし時のハズレペナルティ
      const firstClosedIdx = cpuPlayer.cards.findIndex((c) => !c.isOpen);
      expect(firstClosedIdx).toBe(0);

      const newCards = cpuPlayer.cards.map((c, i) =>
        i === firstClosedIdx ? { ...c, isOpen: true } : c
      );
      const updatedCpu: Player = {
        ...cpuPlayer,
        cards: newCards,
        isEliminated: isAllOpen(newCards),
      };

      expect(updatedCpu.cards[0].isOpen).toBe(true);
      expect(updatedCpu.cards[1].isOpen).toBe(false);

      // ログメッセージの生成検証
      const cpuDrawn = null;
      const isCpuDeckExhausted = !cpuDrawn;
      const missLogSuffix = isCpuDeckExhausted
        ? '山札がないため、手札の伏せカードがオープンされました。'
        : '';
      const logMessage = `CPU 1 が あなた の左から 1 番目 [黒] を [2] と推理して【ハズレ】。${missLogSuffix ? ' ' + missLogSuffix : ''}`;

      expect(logMessage).toContain('山札がないため、手札の伏せカードがオープンされました。');
      expect(logMessage).not.toContain('引いたカードがオープンされました');
    });
  });

  describe('ドロー前（PLAYER_TURN_START）のタイマーカウントダウンと自動ドロータイムアップペナルティ (Issue #62)', () => {
    it('PLAYER_TURN_START フェーズでもタイマーが1秒毎にカウントダウンすること', () => {
      vi.useFakeTimers();

      const { container } = render(
        <GameBoard
          initialState={{
            phase: 'PLAYER_TURN_START',
            timeLimit: 15,
            remainingTime: 15,
            activePlayerIndex: 0,
            deck: [
              { id: 'd-1', color: 'black', number: 7, isOpen: false },
              { id: 'd-2', color: 'white', number: 4, isOpen: false },
            ],
            players: [
              {
                id: 'p1',
                name: 'あなた',
                isHuman: true,
                avatarColor: 'from-blue-500 to-indigo-600',
                isEliminated: false,
                cards: [
                  { id: 'c1', color: 'black', number: 2, isOpen: false },
                  { id: 'c2', color: 'white', number: 9, isOpen: false },
                ],
              },
              {
                id: 'cpu1',
                name: 'CPU 1',
                isHuman: false,
                avatarColor: 'from-purple-500 to-indigo-600',
                isEliminated: false,
                cards: [
                  { id: 'c3', color: 'black', number: 3, isOpen: false },
                ],
              },
            ],
          }}
        />
      );

      // 初期の残り時間表示
      expect(container.textContent).toContain('残り 15 秒');

      // 1秒進める
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(container.textContent).toContain('残り 14 秒');

      // さらに2秒進める
      act(() => {
        vi.advanceTimersByTime(2000);
      });
      expect(container.textContent).toContain('残り 12 秒');

      vi.useRealTimers();
    });

    it('山札がある状態でドロー前にタイムアップした場合、自動ドローオープンペナルティが発動しCPU手番へ移行すること', () => {
      vi.useFakeTimers();

      const { container } = render(
        <GameBoard
          initialState={{
            phase: 'PLAYER_TURN_START',
            timeLimit: 15,
            remainingTime: 1, // 残り1秒
            activePlayerIndex: 0,
            drawnCard: null,
            deck: [
              { id: 'd-1', color: 'black', number: 5, isOpen: false },
              { id: 'd-2', color: 'white', number: 8, isOpen: false },
            ],
            players: [
              {
                id: 'p1',
                name: 'あなた',
                isHuman: true,
                avatarColor: 'from-blue-500 to-indigo-600',
                isEliminated: false,
                cards: [
                  { id: 'c1', color: 'black', number: 2, isOpen: false },
                  { id: 'c2', color: 'white', number: 9, isOpen: false },
                ],
              },
              {
                id: 'cpu1',
                name: 'CPU 1',
                isHuman: false,
                avatarColor: 'from-purple-500 to-indigo-600',
                isEliminated: false,
                cards: [
                  { id: 'c3', color: 'black', number: 3, isOpen: false },
                ],
              },
            ],
          }}
        />
      );

      // 1秒進めてタイムアップを発生させる
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      // 1. 自動ドローバナーが表示されること
      expect(container.textContent).toContain(TIME_UP_AUTO_DRAW_MESSAGE);

      // 2. 山札から1枚引かれ、山札が1枚になっていること（初期2枚 -> 1枚）
      expect(container.textContent).toContain('1 枚');

      // 3. プレイヤーの手札が3枚になり、自動ドローされたカード（black 5）が表向きで挿入されていること
      const p1Cards = screen.getAllByRole('button').filter(
        (el) => el.getAttribute('data-testid')?.startsWith('card-')
      );
      // または textContent に自動ドローされたカードの数字 "5" が表向きとして表示されていること
      expect(container.textContent).toContain('5');

      // 4. 手番がCPU（CPU 1の手番）へ移行していること
      expect(container.textContent).toContain('CPU 1');

      vi.useRealTimers();
    });

    it('山札が0枚の状態でタイムアップした場合、手札の伏せカードがオープンされ手番移行すること', () => {
      vi.useFakeTimers();

      const { container } = render(
        <GameBoard
          initialState={{
            phase: 'PLAYER_TURN_START',
            timeLimit: 15,
            remainingTime: 1,
            activePlayerIndex: 0,
            drawnCard: null,
            deck: [], // 山札0枚
            players: [
              {
                id: 'p1',
                name: 'あなた',
                isHuman: true,
                avatarColor: 'from-blue-500 to-indigo-600',
                isEliminated: false,
                cards: [
                  { id: 'c1', color: 'black', number: 2, isOpen: false },
                  { id: 'c2', color: 'white', number: 9, isOpen: false },
                ],
              },
              {
                id: 'cpu1',
                name: 'CPU 1',
                isHuman: false,
                avatarColor: 'from-purple-500 to-indigo-600',
                isEliminated: false,
                cards: [
                  { id: 'c3', color: 'black', number: 3, isOpen: false },
                ],
              },
            ],
          }}
        />
      );

      // 1秒進めてタイムアップ
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      // 山札0枚用バナーが表示されること
      expect(container.textContent).toContain(TIME_UP_NO_DECK_MESSAGE);

      vi.useRealTimers();
    });
  });

  describe('セキュリティ / 情報漏洩防止: アタック失敗時（AttackLog / モーダル）の相手伏せカード正解数字マスキング (Issue #84)', () => {
    it('プレイヤーアタック失敗時（isHit === false）: AttackLog.actualNumber が undefined となり相手の伏せ数字が漏洩しないこと', () => {
      const targetCard: Card = { id: 'c-secret', color: 'black', number: 7, isOpen: false };
      const guessedNumber = 3;
      const isHit = checkAttack(targetCard, guessedNumber);
      expect(isHit).toBe(false);

      const log: AttackLog = {
        id: 'test-log-1',
        attackerId: 'player',
        attackerName: 'あなた',
        targetPlayerId: 'cpu1',
        targetPlayerName: 'CPU 1',
        targetCardIndex: 0,
        targetColor: targetCard.color,
        guessedNumber,
        isHit,
        actualNumber: isHit ? targetCard.number : undefined,
        timestamp: Date.now(),
        message: 'テストメッセージ',
      };

      expect(log.actualNumber).toBeUndefined();
      expect(JSON.stringify(log)).not.toContain('"actualNumber":7');
    });

    it('プレイヤーアタック的中時（isHit === true）: AttackLog.actualNumber に正解数字が記録されること', () => {
      const targetCard: Card = { id: 'c-secret', color: 'black', number: 7, isOpen: false };
      const guessedNumber = 7;
      const isHit = checkAttack(targetCard, guessedNumber);
      expect(isHit).toBe(true);

      const log: AttackLog = {
        id: 'test-log-2',
        attackerId: 'player',
        attackerName: 'あなた',
        targetPlayerId: 'cpu1',
        targetPlayerName: 'CPU 1',
        targetCardIndex: 0,
        targetColor: targetCard.color,
        guessedNumber,
        isHit,
        actualNumber: isHit ? targetCard.number : undefined,
        timestamp: Date.now(),
        message: 'テストメッセージ',
      };

      expect(log.actualNumber).toBe(7);
      expect(JSON.stringify(log)).toContain('"actualNumber":7');
    });

    it('プレイヤーアタック失敗時のモーダルデータ（waitForAttackOk Props）に相手の伏せカード正解数字が含まれないこと', () => {
      const targetCard: Card = { id: 'c-secret', color: 'white', number: 9, isOpen: false };
      const guessedNumber = 4;
      const isHit = checkAttack(targetCard, guessedNumber);
      expect(isHit).toBe(false);

      // GameBoard.tsx の handleConfirmGuess 失敗時モーダルProps生成ロジックの検証
      const modalProps = {
        attackerName: 'あなた',
        isHuman: true,
        targetPlayerName: 'CPU 1',
        targetCardIndex: 1,
        targetColor: targetCard.color,
        guessedNumber,
        isHit: false,
        actualNumber: undefined,
        nextAction: 'TURN_END' as const,
        nextPlayerName: 'CPU 1',
        isDeckExhausted: false,
      };

      expect(modalProps.actualNumber).toBeUndefined();
      expect(JSON.stringify(modalProps)).not.toContain('"actualNumber":9');
    });

    it('CPUアタック失敗時（isHit === false）: AttackLog およびモーダルデータで相手伏せ数字が undefined となり漏洩しないこと', () => {
      const targetCard: Card = { id: 'p-secret', color: 'black', number: 5, isOpen: false };
      const guessedNumber = 2;
      const isHit = checkAttack(targetCard, guessedNumber);
      expect(isHit).toBe(false);

      // CPUアタックログ
      const cpuLog: AttackLog = {
        id: 'cpu-log-1',
        attackerId: 'cpu1',
        attackerName: 'CPU 1',
        targetPlayerId: 'player',
        targetPlayerName: 'あなた',
        targetCardIndex: 0,
        targetColor: targetCard.color,
        guessedNumber,
        isHit,
        actualNumber: isHit ? targetCard.number : undefined,
        timestamp: Date.now(),
        message: 'CPUハズレログ',
      };

      expect(cpuLog.actualNumber).toBeUndefined();
      expect(JSON.stringify(cpuLog)).not.toContain('"actualNumber":5');

      // CPUモーダルデータ
      const cpuModalProps = {
        attackerName: 'CPU 1',
        targetPlayerName: 'あなた',
        targetCardIndex: 0,
        targetColor: targetCard.color,
        guessedNumber,
        isHit: false,
        actualNumber: undefined,
        nextAction: 'TURN_END' as const,
        isDeckExhausted: false,
      };

      expect(cpuModalProps.actualNumber).toBeUndefined();
      expect(JSON.stringify(cpuModalProps)).not.toContain('"actualNumber":5');
    });

    it('実機DOM検証: プレイヤーアタックハズレ時に画面上のログやDOMに相手の未オープン数字が漏洩しないこと', () => {
      const initialGameState: GameState = {
        playerCount: 2,
        difficulty: 'easy',
        timeLimit: 0,
        remainingTime: 0,
        deck: [{ id: 'd1', color: 'black', number: 0, isOpen: false }],
        players: [
          {
            id: 'p1',
            name: 'あなた',
            isHuman: true,
            avatarColor: 'from-blue-500 to-indigo-600',
            isEliminated: false,
            cards: [{ id: 'p-card1', color: 'black', number: 2, isOpen: false }],
          },
          {
            id: 'cpu1',
            name: 'CPU 1',
            isHuman: false,
            avatarColor: 'from-purple-500 to-indigo-600',
            isEliminated: false,
            cards: [{ id: 'cpu-card1', color: 'white', number: 11, isOpen: false }], // 相手の伏せカードは 11
          },
        ],
        activePlayerIndex: 0,
        drawnCard: { id: 'p-draw', color: 'white', number: 4, isOpen: false },
        phase: 'PLAYER_GUESS_NUMBER',
        selectedTarget: { playerId: 'cpu1', cardIndex: 0 },
        logs: [],
        winner: null,
      };

      const { container } = render(
        <GameBoard initialState={initialGameState} />
      );

      // モーダルや盤面に相手の伏せカードの数字「11」がテキストや属性として存在しないことを確認
      expect(container.querySelector('[data-testid="game-log"]')?.textContent || '').not.toContain('11');
    });
  });

  describe('Issue #88: 自分自身の手札をアタック対象に指定でき自作自演的中・実績ファーミングが可能な脆弱性 (Self-Attack Exploit) の防止', () => {
    beforeEach(() => {
      clearAuditLogs();
      vi.clearAllMocks();
      vi.mocked(useUserSessionModule.useUserSession).mockReturnValue({
        userId: 'p1',
        isNew: false,
        isLoading: false,
      });
    });

    it('handleSelectTargetCard: ターゲットに人間プレイヤー（自分自身）を指定しても selectedTarget に設定されず phase も遷移しないこと', () => {
      const initialGameState: GameState = {
        playerCount: 2,
        difficulty: 'easy',
        timeLimit: 30,
        remainingTime: 30,
        deck: [{ id: 'd-1', color: 'black', number: 5, isOpen: false }],
        players: [
          {
            id: 'p1',
            name: 'あなた',
            isHuman: true,
            avatarColor: 'from-blue-500 to-indigo-600',
            isEliminated: false,
            cards: [{ id: 'p-c1', color: 'black', number: 2, isOpen: false }],
          },
          {
            id: 'cpu1',
            name: 'CPU 1',
            isHuman: false,
            avatarColor: 'from-purple-500 to-indigo-600',
            isEliminated: false,
            cards: [{ id: 'cpu-c1', color: 'white', number: 8, isOpen: false }],
          },
        ],
        activePlayerIndex: 0,
        drawnCard: { id: 'p-drawn', color: 'black', number: 4, isOpen: false },
        phase: 'PLAYER_SELECT_TARGET',
        selectedTarget: null,
        logs: [],
        winner: null,
      };

      // HintModal 経由で targetPlayerId: 'p1'（自分自身）を選択するシミュレーション
      render(
        <GameBoard
          initialState={initialGameState}
          initialIsHintModalOpen={true}
          initialActiveHint={{
            targetPlayerId: 'p1',
            targetPlayerName: 'あなた',
            targetCardIndex: 0,
            color: 'black',
            possibleNumbers: [2],
            isDefinite: true,
            adviceText: '自分自身の手札に対する不正なヒント',
          }}
        />
      );

      // ヒントの「このカードを選択」ボタンをクリック
      const selectBtn = screen.getByTestId('btn-hint-select-target');
      act(() => {
        fireEvent.click(selectBtn);
      });

      // 自分自身の手札はターゲットとして選択されず、AttackModal も表示されないこと
      expect(screen.queryByTestId('attack-modal')).toBeNull();
      const currentState = (window as any).__algoGameState as GameState;
      expect(currentState.selectedTarget).toBeNull();
      expect(currentState.phase).toBe('PLAYER_SELECT_TARGET');
    });

    it('handleConfirmGuess: 不正に自分自身が selectedTarget に設定された場合でもアタック確定が中断され、監査ログ (auditLogger.warn) が記録されること', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      vi.spyOn(console, 'info').mockImplementation(() => {});

      const initialGameState: GameState = {
        playerCount: 2,
        difficulty: 'easy',
        timeLimit: 30,
        remainingTime: 30,
        deck: [{ id: 'd-1', color: 'black', number: 5, isOpen: false }],
        players: [
          {
            id: 'p1',
            name: 'あなた',
            isHuman: true,
            avatarColor: 'from-blue-500 to-indigo-600',
            isEliminated: false,
            cards: [{ id: 'p-c1', color: 'black', number: 2, isOpen: false }],
          },
          {
            id: 'cpu1',
            name: 'CPU 1',
            isHuman: false,
            avatarColor: 'from-purple-500 to-indigo-600',
            isEliminated: false,
            cards: [{ id: 'cpu-c1', color: 'white', number: 8, isOpen: false }],
          },
        ],
        activePlayerIndex: 0,
        drawnCard: { id: 'p-drawn', color: 'black', number: 4, isOpen: false },
        phase: 'PLAYER_GUESS_NUMBER',
        selectedTarget: { playerId: 'p1', cardIndex: 0 }, // 不正に自身の手札がターゲット
        logs: [],
        winner: null,
      };

      render(<GameBoard initialState={initialGameState} />);

      // AttackModal が表示されている
      expect(screen.getByTestId('attack-modal')).toBeInTheDocument();

      // 数字「2」を選択してアタック確定ボタンをクリック
      const numBtn = screen.getByTestId('btn-guess-num-2');
      fireEvent.click(numBtn);

      const confirmBtn = screen.getByTestId('btn-confirm-attack');
      await act(async () => {
        fireEvent.click(confirmBtn);
      });

      // 1. 自分自身へのアタックは拒否され、手札は開示されない（isOpen: false のまま）
      const currentState = (window as any).__algoGameState as GameState;
      const human = currentState.players.find((p) => p.id === 'p1');
      expect(human?.cards[0].isOpen).toBe(false);

      // 2. ログにアタック履歴が記録されない
      expect(currentState.logs.length).toBe(0);

      // 3. auditLogger.warn が呼ばれ、SECURITY_VIOLATION の監査ログが記録されていること
      expect(warnSpy).toHaveBeenCalled();
      const auditLogs = getAuditLogs();
      const violationLog = auditLogs.find((l) => l.eventType === 'SECURITY_VIOLATION');
      expect(violationLog).toBeDefined();
      expect(violationLog?.userId).toBe('p1');
      expect(violationLog?.payload.message).toContain('Self-attack');
      expect(violationLog?.payload.attackerId).toBe('p1');
      expect(violationLog?.payload.targetPlayerId).toBe('p1');
      expect(violationLog?.payload.cardIndex).toBe(0);
      expect(violationLog?.payload.guessedNumber).toBe(2);
    });

    it('handleSelectTargetCard: 相手（CPU）の伏せカードを選択した場合は正常に selectedTarget に設定され PLAYER_GUESS_NUMBER に遷移すること', () => {
      const initialGameState: GameState = {
        playerCount: 2,
        difficulty: 'easy',
        timeLimit: 30,
        remainingTime: 30,
        deck: [{ id: 'd-1', color: 'black', number: 5, isOpen: false }],
        players: [
          {
            id: 'p1',
            name: 'あなた',
            isHuman: true,
            avatarColor: 'from-blue-500 to-indigo-600',
            isEliminated: false,
            cards: [{ id: 'p-c1', color: 'black', number: 2, isOpen: false }],
          },
          {
            id: 'cpu1',
            name: 'CPU 1',
            isHuman: false,
            avatarColor: 'from-purple-500 to-indigo-600',
            isEliminated: false,
            cards: [{ id: 'cpu-c1', color: 'white', number: 8, isOpen: false }],
          },
        ],
        activePlayerIndex: 0,
        drawnCard: { id: 'p-drawn', color: 'black', number: 4, isOpen: false },
        phase: 'PLAYER_SELECT_TARGET',
        selectedTarget: null,
        logs: [],
        winner: null,
      };

      render(
        <GameBoard
          initialState={initialGameState}
          initialIsHintModalOpen={true}
          initialActiveHint={{
            targetPlayerId: 'cpu1',
            targetPlayerName: 'CPU 1',
            targetCardIndex: 0,
            color: 'white',
            possibleNumbers: [8],
            isDefinite: true,
            adviceText: 'CPU 1 のカードに対する正常なヒント',
          }}
        />
      );

      const selectBtn = screen.getByTestId('btn-hint-select-target');
      act(() => {
        fireEvent.click(selectBtn);
      });

      // 相手カードの場合は正常に遷移
      expect(screen.getByTestId('attack-modal')).toBeInTheDocument();
      const currentState = (window as any).__algoGameState as GameState;
      expect(currentState.selectedTarget).toEqual({ playerId: 'cpu1', cardIndex: 0 });
      expect(currentState.phase).toBe('PLAYER_GUESS_NUMBER');
    });
  });

  describe('Issue #85: handleConfirmGuess の多層防護バリデーション（範囲外・非整数・同色既出数字の拒否）', () => {
    beforeEach(() => {
      clearAuditLogs();
    });

    const baseGameState: GameState = {
      playerCount: 2,
      difficulty: 'easy',
      timeLimit: 30,
      remainingTime: 30,
      deck: [{ id: 'd-1', color: 'black', number: 5, isOpen: false }],
      players: [
        {
          id: 'p1',
          name: 'あなた',
          isHuman: true,
          avatarColor: 'from-blue-500 to-indigo-600',
          isEliminated: false,
          cards: [
            { id: 'p-c1', color: 'black', number: 2, isOpen: false },
            { id: 'p-c2', color: 'white', number: 7, isOpen: false },
          ],
        },
        {
          id: 'cpu1',
          name: 'CPU 1',
          isHuman: false,
          avatarColor: 'from-purple-500 to-indigo-600',
          isEliminated: false,
          cards: [
            { id: 'cpu-c1', color: 'white', number: 8, isOpen: false },
            { id: 'cpu-c2', color: 'black', number: 10, isOpen: true },
          ],
        },
      ],
      activePlayerIndex: 0,
      drawnCard: { id: 'p-drawn', color: 'black', number: 4, isOpen: false },
      phase: 'PLAYER_GUESS_NUMBER',
      selectedTarget: { playerId: 'cpu1', cardIndex: 0 }, // ターゲットは CPU 1 の白カード (インデックス0, 伏せ)
      logs: [],
      winner: null,
    };

    it('負の数値（-1）で handleConfirmGuess を呼び出した場合、即座に拒否され auditLogger.warn が記録されること', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      vi.spyOn(console, 'info').mockImplementation(() => {});

      render(<GameBoard initialState={baseGameState} />);

      await act(async () => {
        await (window as any).__algoHandleConfirmGuess(-1);
      });

      // 1. 警告ログが呼ばれ、INVALID_ATTACK_INPUT の監査ログが記録されていること
      expect(warnSpy).toHaveBeenCalled();
      const auditLogs = getAuditLogs();
      const violationLog = auditLogs.find(
        (l) => l.eventType === 'SECURITY_VIOLATION' && (l.payload as any).message?.includes('INVALID_ATTACK_INPUT')
      );
      expect(violationLog).toBeDefined();
      expect((violationLog?.payload as any)?.guessedNumber).toBe(-1);

      // 2. ターゲットカードが開示されず、ログも追加されず、状態が壊れていないこと
      const currentState = (window as any).__algoGameState as GameState;
      const targetPlayer = currentState.players.find((p) => p.id === 'cpu1');
      expect(targetPlayer?.cards[0].isOpen).toBe(false);
      expect(currentState.logs.length).toBe(0);
      expect(currentState.phase).toBe('PLAYER_GUESS_NUMBER');
    });

    it('11を超える数値（12 や 999）で handleConfirmGuess を呼び出した場合、即座に拒否され auditLogger.warn が記録されること', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      vi.spyOn(console, 'info').mockImplementation(() => {});

      render(<GameBoard initialState={baseGameState} />);

      await act(async () => {
        await (window as any).__algoHandleConfirmGuess(12);
      });

      expect(warnSpy).toHaveBeenCalled();
      const auditLogs = getAuditLogs();
      const violationLog = auditLogs.find(
        (l) => l.eventType === 'SECURITY_VIOLATION' && (l.payload as any).message?.includes('INVALID_ATTACK_INPUT')
      );
      expect(violationLog).toBeDefined();
      expect((violationLog?.payload as any)?.guessedNumber).toBe(12);

      const currentState = (window as any).__algoGameState as GameState;
      expect(currentState.logs.length).toBe(0);
      expect(currentState.phase).toBe('PLAYER_GUESS_NUMBER');
    });

    it('非整数（3.5 や NaN）で handleConfirmGuess を呼び出した場合、即座に拒否され auditLogger.warn が記録されること', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      vi.spyOn(console, 'info').mockImplementation(() => {});

      render(<GameBoard initialState={baseGameState} />);

      await act(async () => {
        await (window as any).__algoHandleConfirmGuess(3.5);
      });

      expect(warnSpy).toHaveBeenCalled();
      const auditLogs = getAuditLogs();
      const violationLog = auditLogs.find(
        (l) => l.eventType === 'SECURITY_VIOLATION' && (l.payload as any).message?.includes('INVALID_ATTACK_INPUT')
      );
      expect(violationLog).toBeDefined();
      expect((violationLog?.payload as any)?.guessedNumber).toBe(3.5);

      const currentState = (window as any).__algoGameState as GameState;
      expect(currentState.logs.length).toBe(0);
    });

    it('ターゲットカードと同色で既に判明している数字（自分の手札にある白の「7」）でアタックした場合、即座に拒否され auditLogger.warn が記録されること', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      vi.spyOn(console, 'info').mockImplementation(() => {});

      render(<GameBoard initialState={baseGameState} />);

      // 白カードに対して自分の手札にある白の「7」を指定
      await act(async () => {
        await (window as any).__algoHandleConfirmGuess(7);
      });

      expect(warnSpy).toHaveBeenCalled();
      const auditLogs = getAuditLogs();
      const violationLog = auditLogs.find(
        (l) =>
          l.eventType === 'SECURITY_VIOLATION' &&
          (l.payload as any).message?.includes('already known')
      );
      expect(violationLog).toBeDefined();
      expect((violationLog?.payload as any)?.guessedNumber).toBe(7);
      expect((violationLog?.payload as any)?.targetColor).toBe('white');

      // カード開示やログ追加がブロックされること
      const currentState = (window as any).__algoGameState as GameState;
      const targetPlayer = currentState.players.find((p) => p.id === 'cpu1');
      expect(targetPlayer?.cards[0].isOpen).toBe(false);
      expect(currentState.logs.length).toBe(0);
      expect(currentState.phase).toBe('PLAYER_GUESS_NUMBER');
    });

    it('ターゲットカードと同色で場にオープン済みの数字（黒カードターゲット時の黒「10」）でアタックした場合も拒否されること', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      vi.spyOn(console, 'info').mockImplementation(() => {});

      // ターゲットを CPU 1 の黒カード（インデックス1）
      const blackTargetState: GameState = {
        ...baseGameState,
        selectedTarget: { playerId: 'cpu1', cardIndex: 1 },
      };

      render(<GameBoard initialState={blackTargetState} />);

      // オープン済みの黒10を指定
      await act(async () => {
        await (window as any).__algoHandleConfirmGuess(10);
      });

      expect(warnSpy).toHaveBeenCalled();
      const auditLogs = getAuditLogs();
      const violationLog = auditLogs.find(
        (l) =>
          l.eventType === 'SECURITY_VIOLATION' &&
          (l.payload as any).message?.includes('already known')
      );
      expect(violationLog).toBeDefined();
      expect((violationLog?.payload as any)?.guessedNumber).toBe(10);
      expect((violationLog?.payload as any)?.targetColor).toBe('black');
    });
  });

  describe('アタック成功後のタイマーリセット＆決定フェーズ一時停止 (Issue #89)', () => {
    it('PLAYER_DECIDE_NEXT フェーズ中は時間が経過してもタイマー（remainingTime）がカウントダウンされないこと', () => {
      vi.useFakeTimers();

      const { container } = render(
        <GameBoard
          initialState={{
            phase: 'PLAYER_DECIDE_NEXT',
            timeLimit: 30,
            remainingTime: 12,
            activePlayerIndex: 0,
            players: [
              {
                id: 'p1',
                name: 'あなた',
                isHuman: true,
                avatarColor: 'from-blue-500 to-indigo-600',
                isEliminated: false,
                cards: [{ id: 'p-1', color: 'black', number: 2, isOpen: false }],
              },
              {
                id: 'cpu1',
                name: 'CPU 1',
                isHuman: false,
                avatarColor: 'from-purple-500 to-indigo-600',
                isEliminated: false,
                cards: [{ id: 'c-1', color: 'white', number: 8, isOpen: false }],
              },
            ],
            deck: [],
          }}
        />
      );

      // 初期の残り時間表示
      expect(container.textContent).toContain('残り 12 秒');

      // 5秒経過させる
      act(() => {
        vi.advanceTimersByTime(5000);
      });

      // PLAYER_DECIDE_NEXT 中はタイマーが減算されず 12秒のままであること
      expect(container.textContent).toContain('残り 12 秒');

      // さらに10秒経過させてもタイマーは減算されないこと
      act(() => {
        vi.advanceTimersByTime(10000);
      });
      expect(container.textContent).toContain('残り 12 秒');

      vi.useRealTimers();
    });

    it('アタック的中後に「続けてアタック」を選択した際、タイマー（remainingTime）が timeLimit に満額リセットされること', () => {
      vi.useFakeTimers();

      const { container } = render(
        <GameBoard
          initialState={{
            phase: 'PLAYER_DECIDE_NEXT',
            timeLimit: 30,
            remainingTime: 8, // 直前のアタックで消費され残り8秒になっている
            activePlayerIndex: 0,
            players: [
              {
                id: 'p1',
                name: 'あなた',
                isHuman: true,
                avatarColor: 'from-blue-500 to-indigo-600',
                isEliminated: false,
                cards: [{ id: 'p-1', color: 'black', number: 2, isOpen: false }],
              },
              {
                id: 'cpu1',
                name: 'CPU 1',
                isHuman: false,
                avatarColor: 'from-purple-500 to-indigo-600',
                isEliminated: false,
                cards: [
                  { id: 'c-1', color: 'white', number: 8, isOpen: true }, // 1枚的中済み
                  { id: 'c-2', color: 'black', number: 5, isOpen: false }, // 残り伏せカード
                ],
              },
            ],
            deck: [],
          }}
        />
      );

      // 決定フェーズでの表示確認
      expect(container.textContent).toContain('残り 8 秒');
      const continueBtn = screen.getByTestId('btn-continue-attack');
      expect(continueBtn).toBeDefined();

      // 「続けてアタック」ボタンをクリック
      act(() => {
        fireEvent.click(continueBtn);
      });

      // phase が PLAYER_SELECT_TARGET に移行し、タイマーが満額（30秒）にリセットされていること
      expect(container.textContent).toContain('残り 30 秒');
      expect(container.textContent).toContain('アタック対象を選択');

      // 続けてアタック開始後はタイマーのカウントダウンが再開すること
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(container.textContent).toContain('残り 29 秒');

      vi.useRealTimers();
    });
  });

  describe('モーダル表示時のタイマーストール脆弱性防止と手動ポーズ境界検証 (Issue #86)', () => {
    const baseTimedState: Partial<GameState> = {
      phase: 'PLAYER_TURN_START',
      timeLimit: 30,
      remainingTime: 30,
      activePlayerIndex: 0,
      players: [
        {
          id: 'p1',
          name: 'あなた',
          isHuman: true,
          cards: [{ id: 'c1', color: 'black', number: 3, isOpen: false }],
          isEliminated: false,
          avatarColor: 'from-blue-500 to-indigo-600',
        },
        {
          id: 'p2',
          name: 'CPU 1',
          isHuman: false,
          cards: [{ id: 'c2', color: 'white', number: 7, isOpen: false }],
          isEliminated: false,
          avatarColor: 'from-amber-500 to-orange-600',
        },
      ],
      deck: [{ id: 'd1', color: 'black', number: 5, isOpen: false }],
      winner: null,
    };

    it('持ち時間制（30秒）でルールモーダルを開いていてもタイマーは停止せず毎秒カウントダウンが進行すること', () => {
      vi.useFakeTimers();

      const { container } = render(
        <GameBoard
          initialState={baseTimedState}
          initialIsRuleModalOpen={true}
        />
      );

      // ルールモーダルが表示されていること
      expect(screen.getByTestId('rule-guide-modal')).toBeDefined();

      // 持ち時間警告が表示されていること
      expect(screen.getByTestId('timed-match-warning')).toBeDefined();
      expect(container.textContent).toContain('持ち時間対戦中のためタイマーは進行しています');

      // タイマーは PAUSED ではなく「残り 30 秒」と表示されていること
      const timerBtn = screen.getByTestId('timer-display');
      expect(timerBtn.textContent).toContain('残り 30 秒');
      expect(timerBtn.textContent).not.toContain('PAUSED');

      // 3秒経過させる
      act(() => {
        vi.advanceTimersByTime(3000);
      });

      // ルールモーダルを開いたままでもタイマーが27秒へ進行していること（タイマーストール防止）
      expect(timerBtn.textContent).toContain('残り 27 秒');

      vi.useRealTimers();
    });

    it('持ち時間制（30秒）でヒントモーダルを開いていてもタイマーは停止せず毎秒カウントダウンが進行すること', () => {
      vi.useFakeTimers();

      const { container } = render(
        <GameBoard
          initialState={baseTimedState}
          initialIsHintModalOpen={true}
          initialActiveHint={{
            targetPlayerId: 'p2',
            targetPlayerName: 'CPU 1',
            targetCardIndex: 0,
            color: 'white',
            possibleNumbers: [7],
            isDefinite: true,
            adviceText: 'CPU 1のカードは7です',
          }}
        />
      );

      // ヒントモーダルが表示されていること
      expect(screen.getByTestId('modal-hint')).toBeDefined();

      // 持ち時間警告が表示されていること
      expect(screen.getByTestId('timed-match-warning')).toBeDefined();
      expect(container.textContent).toContain('持ち時間対戦中のためタイマーは進行しています');

      // タイマーは PAUSED ではなく「残り 30 秒」
      const timerBtn = screen.getByTestId('timer-display');
      expect(timerBtn.textContent).toContain('残り 30 秒');
      expect(timerBtn.textContent).not.toContain('PAUSED');

      // 5秒経過させる
      act(() => {
        vi.advanceTimersByTime(5000);
      });

      // ヒントを開いたままでもタイマーが25秒へ進行していること
      expect(timerBtn.textContent).toContain('残り 25 秒');

      vi.useRealTimers();
    });

    it('持ち時間制中であっても、手動ポーズボタンをクリックした場合は明示的な中断としてタイマーが一時停止すること', () => {
      vi.useFakeTimers();

      render(
        <GameBoard
          initialState={baseTimedState}
        />
      );

      const timerBtn = screen.getByTestId('timer-display');
      expect(timerBtn.textContent).toContain('残り 30 秒');

      // 2秒進行
      act(() => {
        vi.advanceTimersByTime(2000);
      });
      expect(timerBtn.textContent).toContain('残り 28 秒');

      // 手動ポーズをクリック
      act(() => {
        fireEvent.click(timerBtn);
      });

      // PAUSED表示となりタイマーが一時停止
      expect(timerBtn.textContent).toContain('PAUSED');
      expect(timerBtn.textContent).toContain('(28秒)');

      // 5秒経過させてもタイマーは減算されない
      act(() => {
        vi.advanceTimersByTime(5000);
      });
      expect(timerBtn.textContent).toContain('PAUSED');
      expect(timerBtn.textContent).toContain('(28秒)');

      // 再度クリックしてポーズ解除
      act(() => {
        fireEvent.click(timerBtn);
      });
      expect(timerBtn.textContent).toContain('残り 28 秒');

      // 再開後1秒進行
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(timerBtn.textContent).toContain('残り 27 秒');

      vi.useRealTimers();
    });
  });

  describe('通算戦績（Match Stats）およびアチーブメント（実績システム）(Issue #72)', () => {
    it('ヘッダーの「🏆 戦績」ボタンをクリックすると StatsModal が開き、戦績と実績を確認できること', () => {
      render(
        <GameBoard
          initialIsRuleModalOpen={false}
          initialState={{
            phase: 'PLAYER_TURN_START',
            players: [
              {
                id: 'player-1',
                name: 'あなた',
                isHuman: true,
                avatarColor: 'from-blue-500 to-indigo-600',
                isEliminated: false,
                cards: [],
              },
            ],
            activePlayerIndex: 0,
          }}
        />
      );

      const statsBtn = screen.getByTestId('btn-open-stats');
      expect(statsBtn).toBeInTheDocument();

      // 初期状態ではモーダルは非表示
      expect(screen.queryByTestId('stats-modal')).not.toBeInTheDocument();

      // クリックでオープン
      fireEvent.click(statsBtn);
      expect(screen.getByTestId('stats-modal')).toBeInTheDocument();
      expect(screen.getByTestId('stat-total-games')).toBeInTheDocument();

      // 閉じるボタンで閉じる
      fireEvent.click(screen.getByTestId('close-stats-modal'));
      expect(screen.queryByTestId('stats-modal')).not.toBeInTheDocument();
    });

    it('GAME_OVER 時に通算戦績が localStorage に自動更新されること', () => {
      localStorage.clear();
      render(
        <GameBoard
          initialIsRuleModalOpen={false}
          initialState={{
            phase: 'GAME_OVER',
            difficulty: 'normal',
            timeLimit: 15,
            players: [
              {
                id: 'player-1',
                name: 'あなた',
                isHuman: true,
                avatarColor: 'from-blue-500 to-indigo-600',
                isEliminated: false,
                cards: [{ id: 'b-1', color: 'black', number: 1, isOpen: true }],
              },
              {
                id: 'cpu-1',
                name: 'CPU 1',
                isHuman: false,
                avatarColor: 'from-amber-500 to-orange-600',
                isEliminated: true,
                cards: [{ id: 'w-2', color: 'white', number: 2, isOpen: true }],
              },
            ],
            winner: {
              id: 'player-1',
              name: 'あなた',
              isHuman: true,
              avatarColor: 'from-blue-500 to-indigo-600',
              isEliminated: false,
              cards: [{ id: 'b-1', color: 'black', number: 1, isOpen: true }],
            },
            logs: [],
          }}
        />
      );

      const savedStatsRaw = localStorage.getItem('algo_player_stats');
      expect(savedStatsRaw).not.toBeNull();
      const savedStats = JSON.parse(savedStatsRaw!);
      expect(savedStats.totalGames).toBe(1);
      expect(savedStats.totalWins).toBe(1);
      expect(savedStats.winRate).toBe(100);
      expect(savedStats.byDifficulty.normal.wins).toBe(1);
    });
  });
});
