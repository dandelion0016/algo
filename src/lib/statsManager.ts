import { Difficulty } from '../types/game';

export interface DifficultyStats {
  games: number;
  wins: number;
  winRate: number; // 0..100 (%)
}

export interface PlayerStats {
  totalGames: number;
  totalWins: number;
  winRate: number; // 0..100 (%)
  byDifficulty: Record<Difficulty, DifficultyStats>;
  currentWinStreak: number;
  bestWinStreak: number;
  totalAttacks: number;
  totalHits: number;
  hitAccuracy: number; // 0..100 (%)
  fastestWinTurns: number | null;
}

export const STATS_STORAGE_KEY = 'algo_player_stats';

export const createInitialStats = (): PlayerStats => ({
  totalGames: 0,
  totalWins: 0,
  winRate: 0,
  byDifficulty: {
    easy: { games: 0, wins: 0, winRate: 0 },
    normal: { games: 0, wins: 0, winRate: 0 },
    hard: { games: 0, wins: 0, winRate: 0 },
  },
  currentWinStreak: 0,
  bestWinStreak: 0,
  totalAttacks: 0,
  totalHits: 0,
  hitAccuracy: 0,
  fastestWinTurns: null,
});

export const calculatePercentage = (value: number, total: number): number => {
  if (total <= 0) return 0;
  return Math.round((value / total) * 100);
};

export const getStoredStats = (): PlayerStats => {
  if (typeof window === 'undefined') return createInitialStats();
  try {
    const raw = localStorage.getItem(STATS_STORAGE_KEY);
    if (!raw) return createInitialStats();
    const parsed = JSON.parse(raw);
    return {
      totalGames: typeof parsed.totalGames === 'number' ? parsed.totalGames : 0,
      totalWins: typeof parsed.totalWins === 'number' ? parsed.totalWins : 0,
      winRate: typeof parsed.winRate === 'number' ? parsed.winRate : 0,
      byDifficulty: {
        easy: {
          games: parsed.byDifficulty?.easy?.games ?? 0,
          wins: parsed.byDifficulty?.easy?.wins ?? 0,
          winRate: parsed.byDifficulty?.easy?.winRate ?? 0,
        },
        normal: {
          games: parsed.byDifficulty?.normal?.games ?? 0,
          wins: parsed.byDifficulty?.normal?.wins ?? 0,
          winRate: parsed.byDifficulty?.normal?.winRate ?? 0,
        },
        hard: {
          games: parsed.byDifficulty?.hard?.games ?? 0,
          wins: parsed.byDifficulty?.hard?.wins ?? 0,
          winRate: parsed.byDifficulty?.hard?.winRate ?? 0,
        },
      },
      currentWinStreak: typeof parsed.currentWinStreak === 'number' ? parsed.currentWinStreak : 0,
      bestWinStreak: typeof parsed.bestWinStreak === 'number' ? parsed.bestWinStreak : 0,
      totalAttacks: typeof parsed.totalAttacks === 'number' ? parsed.totalAttacks : 0,
      totalHits: typeof parsed.totalHits === 'number' ? parsed.totalHits : 0,
      hitAccuracy: typeof parsed.hitAccuracy === 'number' ? parsed.hitAccuracy : 0,
      fastestWinTurns: typeof parsed.fastestWinTurns === 'number' ? parsed.fastestWinTurns : null,
    };
  } catch {
    return createInitialStats();
  }
};

export const saveStoredStats = (stats: PlayerStats): void => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STATS_STORAGE_KEY, JSON.stringify(stats));
  } catch (e) {
    console.error('Failed to save player stats to localStorage', e);
  }
};

export interface MatchResultParam {
  isWin: boolean;
  difficulty: Difficulty;
  turns: number;
  attacks: number;
  hits: number;
}

export const recordMatchResult = (param: MatchResultParam): PlayerStats => {
  const current = getStoredStats();
  const isWin = param.isWin;
  const diff = param.difficulty;

  const newTotalGames = current.totalGames + 1;
  const newTotalWins = current.totalWins + (isWin ? 1 : 0);
  const newWinRate = calculatePercentage(newTotalWins, newTotalGames);

  const diffCurrent = current.byDifficulty[diff] || { games: 0, wins: 0, winRate: 0 };
  const newDiffGames = diffCurrent.games + 1;
  const newDiffWins = diffCurrent.wins + (isWin ? 1 : 0);
  const newDiffWinRate = calculatePercentage(newDiffWins, newDiffGames);

  const newCurrentWinStreak = isWin ? current.currentWinStreak + 1 : 0;
  const newBestWinStreak = Math.max(current.bestWinStreak, newCurrentWinStreak);

  const newTotalAttacks = current.totalAttacks + Math.max(0, param.attacks);
  const newTotalHits = current.totalHits + Math.max(0, param.hits);
  const newHitAccuracy = calculatePercentage(newTotalHits, newTotalAttacks);

  let newFastestWinTurns = current.fastestWinTurns;
  if (isWin && param.turns > 0) {
    if (newFastestWinTurns === null || param.turns < newFastestWinTurns) {
      newFastestWinTurns = param.turns;
    }
  }

  const updated: PlayerStats = {
    totalGames: newTotalGames,
    totalWins: newTotalWins,
    winRate: newWinRate,
    byDifficulty: {
      ...current.byDifficulty,
      [diff]: {
        games: newDiffGames,
        wins: newDiffWins,
        winRate: newDiffWinRate,
      },
    },
    currentWinStreak: newCurrentWinStreak,
    bestWinStreak: newBestWinStreak,
    totalAttacks: newTotalAttacks,
    totalHits: newTotalHits,
    hitAccuracy: newHitAccuracy,
    fastestWinTurns: newFastestWinTurns,
  };

  saveStoredStats(updated);
  return updated;
};

export const resetStats = (): PlayerStats => {
  const initial = createInitialStats();
  saveStoredStats(initial);
  return initial;
};
