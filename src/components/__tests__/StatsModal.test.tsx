import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StatsModal } from '../StatsModal';
import { createInitialStats, PlayerStats } from '../../lib/statsManager';
import { INITIAL_ACHIEVEMENTS, Achievement } from '../../lib/achievementManager';

describe('StatsModal', () => {
  const dummyStats: PlayerStats = {
    totalGames: 10,
    totalWins: 7,
    winRate: 70,
    byDifficulty: {
      easy: { games: 3, wins: 3, winRate: 100 },
      normal: { games: 5, wins: 3, winRate: 60 },
      hard: { games: 2, wins: 1, winRate: 50 },
    },
    currentWinStreak: 3,
    bestWinStreak: 5,
    totalAttacks: 25,
    totalHits: 18,
    hitAccuracy: 72,
    fastestWinTurns: 4,
  };

  const dummyAchievements: Achievement[] = [
    {
      id: 'sniper',
      title: '百発百中',
      nameEn: 'Sniper',
      icon: '🎯',
      description: '1ゲーム中ミスなしで完全勝利（ノーミス勝利）',
      unlockedAt: '2026-10-02T12:00:00.000Z',
    },
    {
      id: 'speed_demon',
      title: '電光石火',
      nameEn: 'Speed Demon',
      icon: '⚡',
      description: '制限時間15秒設定で3ターン以内に勝利',
      unlockedAt: null,
    },
    {
      id: 'triple_strike',
      title: '連続推理',
      nameEn: 'Triple Strike',
      icon: '⚔️',
      description: '1ターン中に3枚連続で的中',
      unlockedAt: null,
    },
    {
      id: 'logic_master',
      title: '論理の支配者',
      nameEn: 'Logic Master',
      icon: '👑',
      description: '難易度「上級 (Hard)」で通算5勝達成',
      unlockedAt: null,
    },
    {
      id: 'clutch_comeback',
      title: '九死に一生',
      nameEn: 'Clutch Comeback',
      icon: '🛡️',
      description: '残り手札1枚のピンチから逆転勝利',
      unlockedAt: null,
    },
  ];

  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <StatsModal
        isOpen={false}
        onClose={vi.fn()}
        stats={dummyStats}
        achievements={dummyAchievements}
        onResetStats={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders stats modal content correctly when isOpen is true', () => {
    render(
      <StatsModal
        isOpen={true}
        onClose={vi.fn()}
        stats={dummyStats}
        achievements={dummyAchievements}
        onResetStats={vi.fn()}
      />
    );

    expect(screen.getByTestId('stats-modal')).toBeInTheDocument();
    expect(screen.getByTestId('stat-total-games')).toHaveTextContent('10');
    expect(screen.getByTestId('stat-total-wins')).toHaveTextContent('7');
    expect(screen.getByTestId('stat-current-streak')).toHaveTextContent('3');
    expect(screen.getByTestId('stat-hit-accuracy')).toHaveTextContent('72%');
    expect(screen.getByTestId('stat-fastest-win')).toHaveTextContent('4');
  });

  it('calls onClose when close button is clicked or Escape key is pressed', () => {
    const onClose = vi.fn();
    render(
      <StatsModal
        isOpen={true}
        onClose={onClose}
        stats={dummyStats}
        achievements={dummyAchievements}
        onResetStats={vi.fn()}
      />
    );

    fireEvent.click(screen.getByTestId('close-stats-modal'));
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('switches between stats tab and achievements tab', () => {
    render(
      <StatsModal
        isOpen={true}
        onClose={vi.fn()}
        stats={dummyStats}
        achievements={dummyAchievements}
        onResetStats={vi.fn()}
      />
    );

    // デフォルトは通算戦績タブ
    expect(screen.getByTestId('stat-total-games')).toBeInTheDocument();

    // アチーブメントタブへ切り替え
    fireEvent.click(screen.getByTestId('tab-achievements'));
    expect(screen.getByTestId('achievement-item-sniper')).toBeInTheDocument();
    expect(screen.getByTestId('achievement-item-speed_demon')).toBeInTheDocument();
    expect(screen.queryByTestId('stat-total-games')).not.toBeInTheDocument();

    // 再度通算戦績タブへ切り替え
    fireEvent.click(screen.getByTestId('tab-stats'));
    expect(screen.getByTestId('stat-total-games')).toBeInTheDocument();
  });

  it('displays unlocked and locked achievement badges accurately', () => {
    render(
      <StatsModal
        isOpen={true}
        onClose={vi.fn()}
        stats={dummyStats}
        achievements={dummyAchievements}
        onResetStats={vi.fn()}
      />
    );

    fireEvent.click(screen.getByTestId('tab-achievements'));

    const sniperItem = screen.getByTestId('achievement-item-sniper');
    expect(sniperItem).toHaveTextContent('解除済');
    expect(sniperItem).toHaveTextContent('百発百中');

    const speedDemonItem = screen.getByTestId('achievement-item-speed_demon');
    expect(speedDemonItem).toHaveTextContent('未解除');
    expect(speedDemonItem).toHaveTextContent('電光石火');
  });

  it('confirms and calls onResetStats when reset button flow is executed', () => {
    const onResetStats = vi.fn();
    render(
      <StatsModal
        isOpen={true}
        onClose={vi.fn()}
        stats={dummyStats}
        achievements={dummyAchievements}
        onResetStats={onResetStats}
      />
    );

    // 最初はリセットボタンが表示されている
    const resetBtn = screen.getByTestId('btn-reset-stats');
    fireEvent.click(resetBtn);

    // 確認ボタンが表示される
    expect(screen.getByText(/本当に通算戦績をリセットしますか/)).toBeInTheDocument();

    // キャンセルボタンを押すと確認が閉じる
    fireEvent.click(screen.getByTestId('btn-cancel-reset-stats'));
    expect(screen.queryByText(/本当に通算戦績をリセットしますか/)).not.toBeInTheDocument();
    expect(onResetStats).not.toHaveBeenCalled();

    // 再度押して確定
    fireEvent.click(screen.getByTestId('btn-reset-stats'));
    fireEvent.click(screen.getByTestId('btn-confirm-reset-stats'));
    expect(onResetStats).toHaveBeenCalledTimes(1);
  });
});
