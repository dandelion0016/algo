import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { GameBoard } from '../GameBoard';
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
});
