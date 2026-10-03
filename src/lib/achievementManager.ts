import { Difficulty, TimeLimit } from '../types/game';
import { PlayerStats } from './statsManager';

export type AchievementId =
  | 'sniper'
  | 'speed_demon'
  | 'triple_strike'
  | 'logic_master'
  | 'clutch_comeback';

export interface Achievement {
  id: AchievementId;
  title: string;
  nameEn: string;
  icon: string;
  description: string;
  unlockedAt: string | null; // ISO 8601 string or null if locked
}

export const ACHIEVEMENTS_STORAGE_KEY = 'algo_player_achievements';

export const INITIAL_ACHIEVEMENTS: Achievement[] = [
  {
    id: 'sniper',
    title: '百発百中',
    nameEn: 'Sniper',
    icon: '🎯',
    description: '1ゲーム中ミスなしで完全勝利（ノーミス勝利）',
    unlockedAt: null,
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

export const getStoredAchievements = (): Achievement[] => {
  if (typeof window === 'undefined') {
    return INITIAL_ACHIEVEMENTS.map((a) => ({ ...a }));
  }
  try {
    const raw = localStorage.getItem(ACHIEVEMENTS_STORAGE_KEY);
    if (!raw) return INITIAL_ACHIEVEMENTS.map((a) => ({ ...a }));
    const parsed: Array<{ id: string; unlockedAt: string | null }> = JSON.parse(raw);
    const lookup = new Map(parsed.map((item) => [item.id, item.unlockedAt]));

    return INITIAL_ACHIEVEMENTS.map((def) => ({
      ...def,
      unlockedAt: lookup.get(def.id) ?? null,
    }));
  } catch {
    return INITIAL_ACHIEVEMENTS.map((a) => ({ ...a }));
  }
};

export const saveStoredAchievements = (achievements: Achievement[]): void => {
  if (typeof window === 'undefined') return;
  try {
    const dataToSave = achievements.map((a) => ({
      id: a.id,
      unlockedAt: a.unlockedAt,
    }));
    localStorage.setItem(ACHIEVEMENTS_STORAGE_KEY, JSON.stringify(dataToSave));
  } catch (e) {
    console.error('Failed to save achievements to localStorage', e);
  }
};

export interface MatchAchievementContext {
  isWin: boolean;
  difficulty: Difficulty;
  timeLimit: TimeLimit;
  turns: number;
  playerAttacks: number;
  playerHits: number;
  playerMisses: number;
  maxConsecutiveHitsInSingleTurn: number;
  wasInClutch: boolean;
  stats: PlayerStats;
}

export const checkAndUnlockAchievements = (
  context: MatchAchievementContext
): { updatedAchievements: Achievement[]; newlyUnlocked: Achievement[] } => {
  const currentAchievements = getStoredAchievements();
  const newlyUnlocked: Achievement[] = [];
  const now = new Date().toISOString();

  const isEligible = (id: AchievementId): boolean => {
    switch (id) {
      case 'sniper':
        // 1ゲーム中ミスなしで完全勝利（ノーミス勝利）: 人間勝利、アタック1回以上、ミス0回
        return context.isWin && context.playerAttacks > 0 && context.playerMisses === 0;

      case 'speed_demon':
        // 制限時間15秒設定で3ターン以内に勝利: 人間勝利、timeLimit === 15, ターン数1〜3
        return context.isWin && context.timeLimit === 15 && context.turns > 0 && context.turns <= 3;

      case 'triple_strike':
        // 1ターン中に3枚連続で的中: 同一ターン内で3回以上連続成功
        return context.maxConsecutiveHitsInSingleTurn >= 3;

      case 'logic_master':
        // 難易度「上級 (Hard)」で通算5勝達成
        return context.stats.byDifficulty.hard.wins >= 5;

      case 'clutch_comeback':
        // 残り手札1枚のピンチから逆転勝利: ピンチ経験あり、かつ人間勝利
        return context.isWin && context.wasInClutch;

      default:
        return false;
    }
  };

  const updatedAchievements = currentAchievements.map((item) => {
    if (!item.unlockedAt && isEligible(item.id)) {
      const unlocked = { ...item, unlockedAt: now };
      newlyUnlocked.push(unlocked);
      return unlocked;
    }
    return item;
  });

  if (newlyUnlocked.length > 0) {
    saveStoredAchievements(updatedAchievements);
  }

  return { updatedAchievements, newlyUnlocked };
};

export const resetAchievements = (): Achievement[] => {
  const reset = INITIAL_ACHIEVEMENTS.map((a) => ({ ...a, unlockedAt: null }));
  saveStoredAchievements(reset);
  return reset;
};
