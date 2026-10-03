import { describe, it, expect, beforeEach } from 'vitest';
import {
  getStoredStats,
  saveStoredStats,
  recordMatchResult,
  resetStats,
  calculatePercentage,
  createInitialStats,
  STATS_STORAGE_KEY,
} from '../statsManager';

describe('statsManager', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('calculatePercentage', () => {
    it('returns 0 when total is 0 or negative', () => {
      expect(calculatePercentage(5, 0)).toBe(0);
      expect(calculatePercentage(5, -1)).toBe(0);
    });

    it('calculates rounded percentage correctly', () => {
      expect(calculatePercentage(1, 3)).toBe(33);
      expect(calculatePercentage(2, 3)).toBe(67);
      expect(calculatePercentage(5, 10)).toBe(50);
      expect(calculatePercentage(10, 10)).toBe(100);
    });
  });

  describe('getStoredStats & createInitialStats', () => {
    it('returns default initial stats when storage is empty', () => {
      const stats = getStoredStats();
      expect(stats.totalGames).toBe(0);
      expect(stats.totalWins).toBe(0);
      expect(stats.winRate).toBe(0);
      expect(stats.currentWinStreak).toBe(0);
      expect(stats.bestWinStreak).toBe(0);
      expect(stats.totalAttacks).toBe(0);
      expect(stats.totalHits).toBe(0);
      expect(stats.hitAccuracy).toBe(0);
      expect(stats.fastestWinTurns).toBeNull();
      expect(stats.byDifficulty.easy).toEqual({ games: 0, wins: 0, winRate: 0 });
      expect(stats.byDifficulty.normal).toEqual({ games: 0, wins: 0, winRate: 0 });
      expect(stats.byDifficulty.hard).toEqual({ games: 0, wins: 0, winRate: 0 });
    });

    it('handles corrupted json safely without throwing', () => {
      localStorage.setItem(STATS_STORAGE_KEY, 'invalid-json{{{');
      const stats = getStoredStats();
      expect(stats.totalGames).toBe(0);
      expect(stats.totalWins).toBe(0);
    });
  });

  describe('recordMatchResult', () => {
    it('records a win correctly and updates streak, accuracy, and difficulty', () => {
      const updated = recordMatchResult({
        isWin: true,
        difficulty: 'normal',
        turns: 5,
        attacks: 4,
        hits: 3,
      });

      expect(updated.totalGames).toBe(1);
      expect(updated.totalWins).toBe(1);
      expect(updated.winRate).toBe(100);
      expect(updated.currentWinStreak).toBe(1);
      expect(updated.bestWinStreak).toBe(1);
      expect(updated.totalAttacks).toBe(4);
      expect(updated.totalHits).toBe(3);
      expect(updated.hitAccuracy).toBe(75);
      expect(updated.fastestWinTurns).toBe(5);
      expect(updated.byDifficulty.normal).toEqual({ games: 1, wins: 1, winRate: 100 });
      expect(updated.byDifficulty.easy.games).toBe(0);
    });

    it('records a loss correctly and resets current win streak while preserving best streak', () => {
      // 1試合目: 勝利
      recordMatchResult({
        isWin: true,
        difficulty: 'easy',
        turns: 4,
        attacks: 2,
        hits: 2,
      });

      // 2試合目: 勝利
      recordMatchResult({
        isWin: true,
        difficulty: 'easy',
        turns: 6,
        attacks: 3,
        hits: 2,
      });

      // 3試合目: 敗北
      const afterLoss = recordMatchResult({
        isWin: false,
        difficulty: 'hard',
        turns: 8,
        attacks: 5,
        hits: 1,
      });

      expect(afterLoss.totalGames).toBe(3);
      expect(afterLoss.totalWins).toBe(2);
      expect(afterLoss.winRate).toBe(67);
      expect(afterLoss.currentWinStreak).toBe(0);
      expect(afterLoss.bestWinStreak).toBe(2);
      expect(afterLoss.totalAttacks).toBe(10);
      expect(afterLoss.totalHits).toBe(5);
      expect(afterLoss.hitAccuracy).toBe(50);
      // Fastest win は 4ターンが維持される
      expect(afterLoss.fastestWinTurns).toBe(4);
      expect(afterLoss.byDifficulty.easy).toEqual({ games: 2, wins: 2, winRate: 100 });
      expect(afterLoss.byDifficulty.hard).toEqual({ games: 1, wins: 0, winRate: 0 });
    });

    it('updates fastestWinTurns when a shorter win occurs', () => {
      recordMatchResult({
        isWin: true,
        difficulty: 'normal',
        turns: 7,
        attacks: 3,
        hits: 3,
      });
      const state2 = recordMatchResult({
        isWin: true,
        difficulty: 'normal',
        turns: 3,
        attacks: 3,
        hits: 3,
      });
      expect(state2.fastestWinTurns).toBe(3);

      const state3 = recordMatchResult({
        isWin: true,
        difficulty: 'normal',
        turns: 5,
        attacks: 3,
        hits: 3,
      });
      // 5ターンは3ターンより長いため更新されない
      expect(state3.fastestWinTurns).toBe(3);
    });
  });

  describe('resetStats', () => {
    it('resets all statistics back to initial zeros', () => {
      recordMatchResult({
        isWin: true,
        difficulty: 'hard',
        turns: 4,
        attacks: 5,
        hits: 4,
      });

      const reset = resetStats();
      expect(reset.totalGames).toBe(0);
      expect(reset.totalWins).toBe(0);
      expect(reset.bestWinStreak).toBe(0);
      expect(reset.fastestWinTurns).toBeNull();

      const stored = getStoredStats();
      expect(stored.totalGames).toBe(0);
    });
  });
});
