import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  ResultModal,
  ResultModalProps,
  calculateCombatStats,
  getDifficultyLabel,
  getTimeLimitLabel,
} from '../ResultModal';
import { Player, AttackLog } from '../../types/game';

describe('ResultModal Component (SCR-006: 決着画面・祝祭演出・戦績サマリ)', () => {
  const mockHumanPlayer: Player = {
    id: 'user_1',
    name: 'あなた',
    isHuman: true,
    avatarColor: 'from-blue-500 to-indigo-600',
    isEliminated: false,
    cards: [
      { id: 'b-1', color: 'black', number: 1, isOpen: false },
      { id: 'w-3', color: 'white', number: 3, isOpen: false },
      { id: 'b-5', color: 'black', number: 5, isOpen: true },
      { id: 'w-8', color: 'white', number: 8, isOpen: false },
    ],
  };

  const mockCpuPlayer: Player = {
    id: 'cpu_1',
    name: 'CPU 1',
    isHuman: false,
    avatarColor: 'from-emerald-500 to-teal-600',
    isEliminated: true,
    cards: [
      { id: 'b-2', color: 'black', number: 2, isOpen: true },
      { id: 'w-4', color: 'white', number: 4, isOpen: true },
    ],
  };

  const mockLogs: AttackLog[] = [
    {
      id: 'log-1',
      attackerId: 'user_1',
      attackerName: 'あなた',
      targetPlayerId: 'cpu_1',
      targetPlayerName: 'CPU 1',
      targetCardIndex: 0,
      targetColor: 'black',
      guessedNumber: 2,
      isHit: true,
      timestamp: 1000,
      message: '的中ログ1',
    },
    {
      id: 'log-2',
      attackerId: 'user_1',
      attackerName: 'あなた',
      targetPlayerId: 'cpu_1',
      targetPlayerName: 'CPU 1',
      targetCardIndex: 1,
      targetColor: 'white',
      guessedNumber: 9,
      isHit: false,
      timestamp: 2000,
      message: 'ハズレログ1',
    },
    {
      id: 'log-3',
      attackerId: 'user_1',
      attackerName: 'あなた',
      targetPlayerId: 'cpu_1',
      targetPlayerName: 'CPU 1',
      targetCardIndex: 1,
      targetColor: 'white',
      guessedNumber: 4,
      isHit: true,
      timestamp: 3000,
      message: '的中ログ2',
    },
    {
      id: 'log-4',
      attackerId: 'cpu_1',
      attackerName: 'CPU 1',
      targetPlayerId: 'user_1',
      targetPlayerName: 'あなた',
      targetCardIndex: 2,
      targetColor: 'black',
      guessedNumber: 5,
      isHit: true,
      timestamp: 4000,
      message: 'CPU攻撃ログ',
    },
  ];

  const defaultProps: ResultModalProps = {
    isOpen: true,
    winner: mockHumanPlayer,
    humanPlayer: mockHumanPlayer,
    players: [mockHumanPlayer, mockCpuPlayer],
    logs: mockLogs,
    playerCount: 2,
    difficulty: 'normal',
    timeLimit: 30,
    onPlayAgain: vi.fn(),
    onReturnSetup: vi.fn(),
  };

  describe('表示・非表示の制御 (Visibility)', () => {
    it('isOpenがfalseの場合は何もレンダリングされない', () => {
      const html = renderToString(<ResultModal {...defaultProps} isOpen={false} />);
      expect(html).toBe('');
    });

    it('isOpenがtrueの場合は決着モーダルがレンダリングされる', () => {
      const html = renderToString(<ResultModal {...defaultProps} isOpen={true} />);
      expect(html).toContain('data-testid="result-modal"');
      expect(html).toContain('backdrop-blur-md');
    });
  });

  describe('勝敗バナー表示（勝利時・敗北時）', () => {
    it('プレイヤー勝利時、完全勝利メッセージと紙吹雪演出が表示される', () => {
      const html = renderToString(<ResultModal {...defaultProps} winner={mockHumanPlayer} />);

      expect(html).toContain('data-testid="result-winner-badge"');
      expect(html).toContain('👑 あなたの完全勝利！');
      expect(html).toContain('VICTORY');
      expect(html).toContain('data-testid="confetti-effect"');
    });

    it('プレイヤー敗北時、敗北バナーが表示され紙吹雪演出は発動しない', () => {
      const defeatedHuman: Player = { ...mockHumanPlayer, isEliminated: true };
      const winningCpu: Player = { ...mockCpuPlayer, isEliminated: false };

      const html = renderToString(
        <ResultModal
          {...defaultProps}
          winner={winningCpu}
          humanPlayer={defeatedHuman}
        />
      );

      expect(html).toContain('data-testid="result-winner-badge"');
      expect(html).toContain('敗北… 次回リベンジ！');
      expect(html).toContain('DEFEAT');
      expect(html).toContain('勝者: <span class="font-bold text-slate-800">CPU 1</span>');
      // 敗北時は紙吹雪はレンダリングされない
      expect(html).not.toContain('data-testid="confetti-effect"');
    });
  });

  describe('対戦戦績サマリの計算と表示 (Combat Stats)', () => {
    it('アタック的中率が正しく計算されてレンダリングされる（3回中2回的中で67%）', () => {
      const html = renderToString(<ResultModal {...defaultProps} />);

      expect(html).toContain('data-testid="stat-accuracy"');
      expect(html).toContain('67%');
      expect(html).toContain('(2/3的中)');
    });

    it('あなたのアタック総数と総手番数が正しくレンダリングされる', () => {
      const html = renderToString(<ResultModal {...defaultProps} />);

      expect(html).toContain('data-testid="stat-attacks"');
      expect(html).toContain('3 回');
      expect(html).toContain('data-testid="stat-turns"');
      expect(html).toContain('(総手番: 4)');
    });

    it('生存手札（伏せ枚数）が正しく表示される（4枚中3枚伏せ）', () => {
      const html = renderToString(<ResultModal {...defaultProps} />);

      expect(html).toContain('data-testid="stat-surviving-cards"');
      expect(html).toContain('3 / 4');
      expect(html).toContain('手札を守り抜きました');
    });

    it('ルール設定情報（人数、難易度、持ち時間）が正しく表示される', () => {
      const html = renderToString(
        <ResultModal
          {...defaultProps}
          playerCount={3}
          difficulty="hard"
          timeLimit={15}
        />
      );

      expect(html).toContain('data-testid="stat-settings"');
      expect(html).toContain('data-testid="stat-player-count"');
      expect(html).toContain('3人対戦');
      expect(html).toContain('data-testid="stat-difficulty"');
      expect(html).toContain('上級');
      expect(html).toContain('持ち時間: 15秒');
    });
  });

  describe('calculateCombatStats ヘルパー関数の単体検証', () => {
    it('アタックが0回の場合は的中率0%を返す', () => {
      const stats = calculateCombatStats([], mockHumanPlayer, 2, 'easy', 0);
      expect(stats.totalAttacks).toBe(0);
      expect(stats.hits).toBe(0);
      expect(stats.hitRate).toBe(0);
      expect(stats.difficultyLabel).toBe('初級');
      expect(stats.timeLimitLabel).toBe('無制限');
    });

    it('全弾的中時は100%を返す', () => {
      const perfectLogs: AttackLog[] = [
        {
          id: 'log-1',
          attackerId: 'user_1',
          attackerName: 'あなた',
          targetPlayerId: 'cpu_1',
          targetPlayerName: 'CPU 1',
          targetCardIndex: 0,
          targetColor: 'black',
          guessedNumber: 2,
          isHit: true,
          timestamp: 1000,
          message: '的中',
        },
      ];
      const stats = calculateCombatStats(perfectLogs, mockHumanPlayer, 4, 'hard', 30);
      expect(stats.totalAttacks).toBe(1);
      expect(stats.hits).toBe(1);
      expect(stats.hitRate).toBe(100);
      expect(stats.survivingCards).toBe(3);
      expect(stats.totalCards).toBe(4);
    });

    it('getDifficultyLabel と getTimeLimitLabel の変換が仕様どおり', () => {
      expect(getDifficultyLabel('easy')).toBe('初級');
      expect(getDifficultyLabel('normal')).toBe('中級');
      expect(getDifficultyLabel('hard')).toBe('上級');
      expect(getTimeLimitLabel(0)).toBe('無制限');
      expect(getTimeLimitLabel(15)).toBe('15秒');
      expect(getTimeLimitLabel(30)).toBe('30秒');
    });
  });

  describe('アクションボタンの属性検証', () => {
    it('「同じ設定でもう一度遊ぶ（再戦）」ボタンが存在し、重複する絵文字を含まない', () => {
      const html = renderToString(<ResultModal {...defaultProps} />);
      expect(html).toContain('data-testid="btn-play-again"');
      expect(html).toContain('同じ設定でもう一度遊ぶ（再戦）');
      expect(html).not.toContain('🔄');
    });

    it('「設定を変更する（タイトルへ）」ボタンが存在し、重複する絵文字を含まない', () => {
      const html = renderToString(<ResultModal {...defaultProps} />);
      expect(html).toContain('data-testid="btn-return-setup"');
      expect(html).toContain('設定を変更する（タイトルへ）');
      expect(html).not.toContain('⚙');
    });

    it('モバイル画面（375x667等）での下部見切れ防止のため max-h-[92dvh] および overflow-y-auto が付与されている (Issue #67)', () => {
      const html = renderToString(<ResultModal {...defaultProps} onClose={vi.fn()} />);
      expect(html).toContain('max-h-[92dvh]');
      expect(html).toContain('overflow-y-auto');
      expect(html).toContain('盤面を振り返る（モーダルを閉じる）');
    });
  });

  describe('キーボードアクセシビリティ仕様検証 (Issue #70: Enter/Space/Escape)', () => {
    it('Enterキー押下で onRestart が呼ばれる', () => {
      const onRestart = vi.fn();
      render(<ResultModal {...defaultProps} onRestart={onRestart} />);

      fireEvent.keyDown(window, { key: 'Enter' });

      expect(onRestart).toHaveBeenCalledTimes(1);
    });

    it('Spaceキー押下でも onRestart (onPlayAgain) が呼ばれる', () => {
      const onPlayAgain = vi.fn();
      render(<ResultModal {...defaultProps} onPlayAgain={onPlayAgain} />);

      fireEvent.keyDown(window, { key: ' ' });

      expect(onPlayAgain).toHaveBeenCalledTimes(1);
    });

    it('Escapeキー押下で onClose が呼ばれる', () => {
      const onClose = vi.fn();
      render(<ResultModal {...defaultProps} onClose={onClose} />);

      fireEvent.keyDown(window, { key: 'Escape' });

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('onClose が指定されていない場合に Escapeキーを押してもエラーが発生しない', () => {
      expect(() => {
        render(<ResultModal {...defaultProps} onClose={undefined} />);
        fireEvent.keyDown(window, { key: 'Escape' });
      }).not.toThrow();
    });

    it('モーダルが非表示（isOpen=false）の時はキーイベントが発火しない', () => {
      const onRestart = vi.fn();
      const onClose = vi.fn();
      render(<ResultModal {...defaultProps} isOpen={false} onRestart={onRestart} onClose={onClose} />);

      fireEvent.keyDown(window, { key: 'Enter' });
      fireEvent.keyDown(window, { key: 'Escape' });

      expect(onRestart).not.toHaveBeenCalled();
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe('Issue #60: 🔍 手札の答え合わせ (Review Hands) セクション', () => {
    it('リザルトモーダル内に手札の答え合わせセクション（hand-review-section）が表示される', () => {
      render(<ResultModal {...defaultProps} />);

      const reviewSection = screen.getByTestId('hand-review-section');
      expect(reviewSection).toBeInTheDocument();
      expect(reviewSection.textContent).toContain('手札の答え合わせ (Review Hands)');
      expect(reviewSection.textContent).toContain('全プレイヤーの最終手札');
    });

    it('全プレイヤーの手札（人間・CPU）がプレイヤーごとに描画される', () => {
      render(<ResultModal {...defaultProps} />);

      // 1. 各プレイヤーコンテナ
      const humanReview = screen.getByTestId('review-player-user_1');
      const cpuReview = screen.getByTestId('review-player-cpu_1');
      expect(humanReview).toBeInTheDocument();
      expect(cpuReview).toBeInTheDocument();

      // 2. プレイヤー名とラベル
      expect(humanReview.textContent).toContain('あなた');
      expect(humanReview.textContent).toContain('👑 勝者');
      expect(cpuReview.textContent).toContain('CPU 1');
      expect(cpuReview.textContent).toContain('脱落');
    });

    it('各プレイヤーの全手札の数字・色が完全に開示（Reveal）され、未オープンだったカードに「開示」バッジが表示される', () => {
      render(<ResultModal {...defaultProps} />);

      // 人間プレイヤーの手札4枚:
      // card 0: b-1 (isOpen: false) -> 数字 1, 開示
      // card 1: w-3 (isOpen: false) -> 数字 3, 開示
      // card 2: b-5 (isOpen: true)  -> 数字 5, OPEN
      // card 3: w-8 (isOpen: false) -> 数字 8, 開示
      const humanCard0 = screen.getByTestId('review-card-user_1-0');
      const humanCard1 = screen.getByTestId('review-card-user_1-1');
      const humanCard2 = screen.getByTestId('review-card-user_1-2');
      const humanCard3 = screen.getByTestId('review-card-user_1-3');

      expect(humanCard0.textContent).toContain('1');
      expect(humanCard0.textContent).toContain('開示');

      expect(humanCard1.textContent).toContain('3');
      expect(humanCard1.textContent).toContain('開示');

      expect(humanCard2.textContent).toContain('5');
      expect(humanCard2.textContent).toContain('OPEN');

      expect(humanCard3.textContent).toContain('8');
      expect(humanCard3.textContent).toContain('開示');

      // CPUの手札2枚:
      // card 0: b-2 (isOpen: true) -> 数字 2, OPEN
      // card 1: w-4 (isOpen: true) -> 数字 4, OPEN
      const cpuCard0 = screen.getByTestId('review-card-cpu_1-0');
      const cpuCard1 = screen.getByTestId('review-card-cpu_1-1');

      expect(cpuCard0.textContent).toContain('2');
      expect(cpuCard0.textContent).toContain('OPEN');

      expect(cpuCard1.textContent).toContain('4');
      expect(cpuCard1.textContent).toContain('OPEN');
    });

    it('3〜4人対戦時でも全参加プレイヤーの手札が漏れなく描画される', () => {
      const mock4Players: Player[] = [
        mockHumanPlayer,
        mockCpuPlayer,
        {
          id: 'cpu_2',
          name: 'CPU 2',
          isHuman: false,
          avatarColor: 'from-purple-500 to-indigo-600',
          isEliminated: true,
          cards: [
            { id: 'b-0', color: 'black', number: 0, isOpen: false },
            { id: 'w-7', color: 'white', number: 7, isOpen: false },
          ],
        },
        {
          id: 'cpu_3',
          name: 'CPU 3',
          isHuman: false,
          avatarColor: 'from-rose-500 to-pink-600',
          isEliminated: false,
          cards: [
            { id: 'b-9', color: 'black', number: 9, isOpen: true },
            { id: 'w-11', color: 'white', number: 11, isOpen: false },
          ],
        },
      ];

      render(
        <ResultModal
          {...defaultProps}
          players={mock4Players}
          playerCount={4}
        />
      );

      expect(screen.getByTestId('review-player-user_1')).toBeInTheDocument();
      expect(screen.getByTestId('review-player-cpu_1')).toBeInTheDocument();
      expect(screen.getByTestId('review-player-cpu_2')).toBeInTheDocument();
      expect(screen.getByTestId('review-player-cpu_3')).toBeInTheDocument();

      // CPU 2 の未オープンカードが数字とともに開示されていること
      const cpu2Card0 = screen.getByTestId('review-card-cpu_2-0');
      expect(cpu2Card0.textContent).toContain('0');
      expect(cpu2Card0.textContent).toContain('開示');
    });
  });
});
