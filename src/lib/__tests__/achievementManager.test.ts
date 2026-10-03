import { describe, it, expect, beforeEach } from 'vitest';
import {
  getStoredAchievements,
  saveStoredAchievements,
  checkAndUnlockAchievements,
  resetAchievements,
  INITIAL_ACHIEVEMENTS,
  ACHIEVEMENTS_STORAGE_KEY,
} from '../achievementManager';
import { createInitialStats } from '../statsManager';

describe('achievementManager', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('getStoredAchievements & resetAchievements', () => {
    it('returns all initial achievements as locked', () => {
      const list = getStoredAchievements();
      expect(list).toHaveLength(5);
      expect(list.every((a) => a.unlockedAt === null)).toBe(true);
      expect(list.map((a) => a.id)).toEqual([
        'sniper',
        'speed_demon',
        'triple_strike',
        'logic_master',
        'clutch_comeback',
      ]);
    });

    it('resetAchievements locks all achievements', () => {
      const achievements = getStoredAchievements();
      achievements[0].unlockedAt = '2026-10-03T00:00:00.000Z';
      saveStoredAchievements(achievements);

      const afterSave = getStoredAchievements();
      expect(afterSave[0].unlockedAt).not.toBeNull();

      const afterReset = resetAchievements();
      expect(afterReset.every((a) => a.unlockedAt === null)).toBe(true);
    });
  });

  describe('checkAndUnlockAchievements', () => {
    const baseStats = createInitialStats();

    it('unlocks sniper when won with no misses and at least 1 attack', () => {
      const result = checkAndUnlockAchievements({
        isWin: true,
        difficulty: 'normal',
        timeLimit: 30,
        turns: 5,
        playerAttacks: 3,
        playerHits: 3,
        playerMisses: 0,
        maxConsecutiveHitsInSingleTurn: 1,
        wasInClutch: false,
        stats: baseStats,
      });

      const sniperUnlocked = result.newlyUnlocked.find((a) => a.id === 'sniper');
      expect(sniperUnlocked).toBeDefined();
      expect(sniperUnlocked?.title).toBe('百発百中');
    });

    it('does not unlock sniper if player had a miss', () => {
      const result = checkAndUnlockAchievements({
        isWin: true,
        difficulty: 'normal',
        timeLimit: 30,
        turns: 5,
        playerAttacks: 3,
        playerHits: 2,
        playerMisses: 1,
        maxConsecutiveHitsInSingleTurn: 1,
        wasInClutch: false,
        stats: baseStats,
      });

      const sniperUnlocked = result.newlyUnlocked.find((a) => a.id === 'sniper');
      expect(sniperUnlocked).toBeUndefined();
    });

    it('unlocks speed_demon when won within 3 turns with 15s limit', () => {
      const result = checkAndUnlockAchievements({
        isWin: true,
        difficulty: 'normal',
        timeLimit: 15,
        turns: 3,
        playerAttacks: 3,
        playerHits: 2,
        playerMisses: 1,
        maxConsecutiveHitsInSingleTurn: 1,
        wasInClutch: false,
        stats: baseStats,
      });

      const speedDemon = result.newlyUnlocked.find((a) => a.id === 'speed_demon');
      expect(speedDemon).toBeDefined();
    });

    it('does not unlock speed_demon when turns > 3 or timeLimit != 15', () => {
      const result1 = checkAndUnlockAchievements({
        isWin: true,
        difficulty: 'normal',
        timeLimit: 15,
        turns: 4,
        playerAttacks: 3,
        playerHits: 2,
        playerMisses: 1,
        maxConsecutiveHitsInSingleTurn: 1,
        wasInClutch: false,
        stats: baseStats,
      });
      expect(result1.newlyUnlocked.find((a) => a.id === 'speed_demon')).toBeUndefined();

      const result2 = checkAndUnlockAchievements({
        isWin: true,
        difficulty: 'normal',
        timeLimit: 30,
        turns: 2,
        playerAttacks: 2,
        playerHits: 2,
        playerMisses: 0,
        maxConsecutiveHitsInSingleTurn: 1,
        wasInClutch: false,
        stats: baseStats,
      });
      expect(result2.newlyUnlocked.find((a) => a.id === 'speed_demon')).toBeUndefined();
    });

    it('unlocks triple_strike when maxConsecutiveHitsInSingleTurn >= 3', () => {
      const result = checkAndUnlockAchievements({
        isWin: false,
        difficulty: 'normal',
        timeLimit: 30,
        turns: 2,
        playerAttacks: 4,
        playerHits: 3,
        playerMisses: 1,
        maxConsecutiveHitsInSingleTurn: 3,
        wasInClutch: false,
        stats: baseStats,
      });

      const strike = result.newlyUnlocked.find((a) => a.id === 'triple_strike');
      expect(strike).toBeDefined();
    });

    it('unlocks logic_master when hard wins reaches 5', () => {
      const statsWith5HardWins = {
        ...baseStats,
        byDifficulty: {
          ...baseStats.byDifficulty,
          hard: { games: 8, wins: 5, winRate: 63 },
        },
      };

      const result = checkAndUnlockAchievements({
        isWin: true,
        difficulty: 'hard',
        timeLimit: 30,
        turns: 6,
        playerAttacks: 5,
        playerHits: 3,
        playerMisses: 2,
        maxConsecutiveHitsInSingleTurn: 1,
        wasInClutch: false,
        stats: statsWith5HardWins,
      });

      const logicMaster = result.newlyUnlocked.find((a) => a.id === 'logic_master');
      expect(logicMaster).toBeDefined();
    });

    it('unlocks clutch_comeback when won after experiencing clutch pinch', () => {
      const result = checkAndUnlockAchievements({
        isWin: true,
        difficulty: 'normal',
        timeLimit: 30,
        turns: 7,
        playerAttacks: 5,
        playerHits: 3,
        playerMisses: 2,
        maxConsecutiveHitsInSingleTurn: 1,
        wasInClutch: true,
        stats: baseStats,
      });

      const comeback = result.newlyUnlocked.find((a) => a.id === 'clutch_comeback');
      expect(comeback).toBeDefined();
    });

    it('does not re-unlock already unlocked achievements', () => {
      // 1回目のアンロック
      const firstResult = checkAndUnlockAchievements({
        isWin: true,
        difficulty: 'normal',
        timeLimit: 30,
        turns: 5,
        playerAttacks: 2,
        playerHits: 2,
        playerMisses: 0,
        maxConsecutiveHitsInSingleTurn: 1,
        wasInClutch: false,
        stats: baseStats,
      });
      expect(firstResult.newlyUnlocked.some((a) => a.id === 'sniper')).toBe(true);

      // 2回目の同一条件
      const secondResult = checkAndUnlockAchievements({
        isWin: true,
        difficulty: 'normal',
        timeLimit: 30,
        turns: 5,
        playerAttacks: 2,
        playerHits: 2,
        playerMisses: 0,
        maxConsecutiveHitsInSingleTurn: 1,
        wasInClutch: false,
        stats: baseStats,
      });
      expect(secondResult.newlyUnlocked).toHaveLength(0);
    });
  });
});
