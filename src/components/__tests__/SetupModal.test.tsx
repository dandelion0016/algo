import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { SetupModal, getPlayerRoster, SetupModalProps } from '../SetupModal';
import * as useUserSessionModule from '../../hooks/useUserSession';

// useUserSession フックのモック化
vi.mock('../../hooks/useUserSession', () => ({
  useUserSession: vi.fn(),
}));

describe('SetupModal Component', () => {
  const defaultProps: SetupModalProps = {
    playerCount: 2,
    difficulty: 'normal',
    timeLimit: 30,
    onSelectPlayerCount: vi.fn(),
    onSelectDifficulty: vi.fn(),
    onSelectTimeLimit: vi.fn(),
    onStartGame: vi.fn(),
    onOpenRules: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useUserSessionModule.useUserSession).mockReturnValue({
      userId: 'usr_mock1234',
      isNew: false,
      isLoading: false,
    });
  });

  describe('ユーザーIDバッジの表示 (User ID Badge)', () => {
    it('useUserSessionから取得したゲストユーザーIDがバッジに正しく表示される', () => {
      const html = renderToString(<SetupModal {...defaultProps} />);

      // 「👤 ゲストID: usr_mock1234」の表示を確認
      expect(html).toContain('ゲストID: usr_mock1234');
      expect(html).toContain('👤');
      // パステル調のスタイリングクラスが含まれることを確認
      expect(html).toContain('bg-sky-50');
      expect(html).toContain('border-sky-200');
      expect(html).toContain('text-sky-800');
      expect(html).toContain('rounded-full');
      expect(html).toContain('font-mono');
      expect(html).toContain('data-testid="user-id-badge"');
    });

    it('props経由でuserIdが渡された場合はそのIDが優先して表示される', () => {
      const html = renderToString(<SetupModal {...defaultProps} userId="usr_override99" />);

      expect(html).toContain('ゲストID: usr_override99');
      expect(html).not.toContain('usr_mock1234');
    });

    it('userIdが空の場合でもフォールバック表示される', () => {
      vi.mocked(useUserSessionModule.useUserSession).mockReturnValue({
        userId: '',
        isNew: false,
        isLoading: true,
      });

      const html = renderToString(<SetupModal {...defaultProps} />);
      expect(html).toContain('ゲストID: usr_xxxxxxxx');
    });
  });

  describe('対戦人数選択と動的プレビュー領域 (Player Roster Preview)', () => {
    it('2人選択時: あなた（手札4枚）vs CPU アル（手札4枚）、残り山札16枚が表示される', () => {
      const html = renderToString(<SetupModal {...defaultProps} playerCount={2} />);

      // ヘッダー情報
      expect(html).toContain('対戦相手構成');
      expect(html).toContain('残り山札:');
      expect(html).toContain('16枚');

      // プレイヤーカード構成
      expect(html).toContain('あなた（手札4枚）');
      expect(html).toContain('CPU アル（手札4枚）');
      expect(html).not.toContain('CPU ゴオ');
      expect(html).not.toContain('CPU ルウ');

      // アバターアイコン表示（あなた: 👤、CPU: 🤖）
      expect(html).toContain('👤');
      expect(html).toContain('🤖');

      // テーマカラークラスが含まれること
      expect(html).toContain('from-sky-400 to-blue-600');
      expect(html).toContain('from-blue-400 to-indigo-500');
    });

    it('3人選択時: あなた（手札3枚）vs CPU アル（手札3枚）vs CPU ゴオ（手札3枚）、残り山札15枚が表示される', () => {
      const html = renderToString(<SetupModal {...defaultProps} playerCount={3} />);

      // ヘッダー情報
      expect(html).toContain('対戦相手構成');
      expect(html).toContain('残り山札:');
      expect(html).toContain('15枚');

      // プレイヤーカード構成
      expect(html).toContain('あなた（手札3枚）');
      expect(html).toContain('CPU アル（手札3枚）');
      expect(html).toContain('CPU ゴオ（手札3枚）');
      expect(html).not.toContain('CPU ルウ');

      // テーマカラークラスが含まれること
      expect(html).toContain('from-amber-300 to-yellow-500');
    });

    it('4人選択時: あなた（手札3枚）vs CPU アル（手札3枚）vs CPU ゴオ（手札3枚）vs CPU ルウ（手札3枚）、残り山札12枚が表示される', () => {
      const html = renderToString(<SetupModal {...defaultProps} playerCount={4} />);

      // ヘッダー情報
      expect(html).toContain('対戦相手構成');
      expect(html).toContain('残り山札:');
      expect(html).toContain('12枚');

      // プレイヤーカード構成
      expect(html).toContain('あなた（手札3枚）');
      expect(html).toContain('CPU アル（手札3枚）');
      expect(html).toContain('CPU ゴオ（手札3枚）');
      expect(html).toContain('CPU ルウ（手札3枚）');

      // テーマカラークラスが含まれること
      expect(html).toContain('from-emerald-400 to-teal-600');
    });
  });

  describe('getPlayerRoster ロジック関数単体テスト', () => {
    it('2人の構成と山札枚数を正しく算出する', () => {
      const roster = getPlayerRoster(2);
      expect(roster.deckCount).toBe(16);
      expect(roster.players).toHaveLength(2);
      expect(roster.players[0]).toEqual({
        id: 'human',
        name: 'あなた',
        isHuman: true,
        avatarIcon: '👤',
        colorGradient: 'from-sky-400 to-blue-600',
        handCount: 4,
      });
      expect(roster.players[1]).toEqual({
        id: 'cpu-1',
        name: 'CPU アル',
        isHuman: false,
        avatarIcon: '🤖',
        colorGradient: 'from-blue-400 to-indigo-500',
        handCount: 4,
      });
    });

    it('3人の構成と山札枚数を正しく算出する', () => {
      const roster = getPlayerRoster(3);
      expect(roster.deckCount).toBe(15);
      expect(roster.players).toHaveLength(3);
      expect(roster.players[0].handCount).toBe(3);
      expect(roster.players[1].name).toBe('CPU アル');
      expect(roster.players[1].handCount).toBe(3);
      expect(roster.players[2].name).toBe('CPU ゴオ');
      expect(roster.players[2].handCount).toBe(3);
    });

    it('4人の構成と山札枚数を正しく算出する', () => {
      const roster = getPlayerRoster(4);
      expect(roster.deckCount).toBe(12);
      expect(roster.players).toHaveLength(4);
      expect(roster.players.every((p) => p.handCount === 3)).toBe(true);
      expect(roster.players[1].name).toBe('CPU アル');
      expect(roster.players[2].name).toBe('CPU ゴオ');
      expect(roster.players[3].name).toBe('CPU ルウ');
    });
  });

  describe('インタラクションとボタン描画', () => {
    it('ルール確認ボタンおよびゲーム開始ボタンが正しく描画されている', () => {
      const html = renderToString(<SetupModal {...defaultProps} />);
      expect(html).toContain('ルールを確認');
      expect(html).toContain('対戦を開始する！');
    });

    it('難易度および持ち時間の選択肢が正しく描画されている', () => {
      const html = renderToString(<SetupModal {...defaultProps} />);
      expect(html).toContain('初級 (Easy)');
      expect(html).toContain('中級 (Normal)');
      expect(html).toContain('上級 (Hard)');
      expect(html).toContain('30秒');
      expect(html).toContain('15秒');
      expect(html).toContain('無制限');
      // 初心者向けバッジ「おすすめ（初心者向け）」と「標準テンポ」の表示確認
      expect(html).toContain('おすすめ（初心者向け）');
      expect(html).toContain('標準テンポ');
    });

    it('onOpenTutorialが渡された場合、チュートリアルボタン（btn-setup-tutorial）が表示される', () => {
      const onOpenTutorial = vi.fn();
      const html = renderToString(
        <SetupModal {...defaultProps} onOpenTutorial={onOpenTutorial} />
      );
      expect(html).toContain('data-testid="btn-setup-tutorial"');
      expect(html).toContain('チュートリアル');
    });

    it('難易度初級（easy）および持ち時間無制限（0）が正しく選択スタイルで描画される', () => {
      const html = renderToString(
        <SetupModal {...defaultProps} difficulty="easy" timeLimit={0} />
      );
      expect(html).toContain('初級：気楽に推理');
      expect(html).toContain('無制限（じっくり思考）');
    });

    it('onOpenStatsが渡された場合、戦績・実績ボタン（btn-setup-stats）が表示される', () => {
      const onOpenStats = vi.fn();
      const html = renderToString(
        <SetupModal {...defaultProps} onOpenStats={onOpenStats} />
      );
      expect(html).toContain('data-testid="btn-setup-stats"');
      expect(html).toContain('戦績・実績');
    });
  });
});
