'use client';

import React, { useState, useEffect } from 'react';
import { Trophy, X, Flame, Target, Zap, RotateCcw, Award, CheckCircle2, Lock, Calendar } from 'lucide-react';
import { PlayerStats } from '../lib/statsManager';
import { Achievement } from '../lib/achievementManager';

interface StatsModalProps {
  isOpen: boolean;
  onClose: () => void;
  stats: PlayerStats;
  achievements: Achievement[];
  onResetStats: () => void;
}

export const StatsModal: React.FC<StatsModalProps> = ({
  isOpen,
  onClose,
  stats,
  achievements,
  onResetStats,
}) => {
  const [activeTab, setActiveTab] = useState<'stats' | 'achievements'>('stats');
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setShowResetConfirm(false);
      return;
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const unlockedCount = achievements.filter((a) => a.unlockedAt !== null).length;
  const totalAchievements = achievements.length;
  const achievementProgress =
    totalAchievements > 0 ? Math.round((unlockedCount / totalAchievements) * 100) : 0;

  const handleConfirmReset = () => {
    onResetStats();
    setShowResetConfirm(false);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="stats-modal-title"
      data-testid="stats-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-150"
    >
      <div className="bg-white border border-slate-200 rounded-3xl max-w-lg w-full max-h-[88vh] flex flex-col text-slate-800 shadow-2xl animate-in zoom-in-95 duration-150 overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/50 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-100 border border-amber-300 flex items-center justify-center text-amber-600 shadow-xs">
              <Trophy className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h3 id="stats-modal-title" className="text-lg font-black text-slate-900 tracking-tight">
                戦績 ＆ アチーブメント
              </h3>
              <p className="text-xs text-slate-500 font-medium">通算記録とやり込み実績</p>
            </div>
          </div>
          <button
            type="button"
            data-testid="close-stats-modal"
            aria-label="閉じる"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab navigation */}
        <div className="flex border-b border-slate-200 bg-slate-100/60 p-1.5 gap-1.5 shrink-0">
          <button
            type="button"
            data-testid="tab-stats"
            onClick={() => setActiveTab('stats')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl font-bold text-xs sm:text-sm transition-all ${
              activeTab === 'stats'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            }`}
          >
            <Target className="w-4 h-4 text-algo-blue" />
            <span>通算戦績</span>
          </button>
          <button
            type="button"
            data-testid="tab-achievements"
            onClick={() => setActiveTab('achievements')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl font-bold text-xs sm:text-sm transition-all ${
              activeTab === 'achievements'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            }`}
          >
            <Award className="w-4 h-4 text-amber-500" />
            <span>アチーブメント ({unlockedCount}/{totalAchievements})</span>
          </button>
        </div>

        {/* Content area */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1 text-xs sm:text-sm">
          {activeTab === 'stats' && (
            <div className="space-y-4">
              {/* Primary Stats Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col items-center justify-center text-center">
                  <span className="text-[10px] sm:text-xs font-semibold text-slate-500 uppercase">総対戦数</span>
                  <span data-testid="stat-total-games" className="text-xl sm:text-2xl font-black text-slate-900 mt-0.5">
                    {stats.totalGames}
                  </span>
                  <span className="text-[10px] text-slate-400">試合</span>
                </div>

                <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-2xl flex flex-col items-center justify-center text-center">
                  <span className="text-[10px] sm:text-xs font-semibold text-emerald-700 uppercase">勝利数</span>
                  <span data-testid="stat-total-wins" className="text-xl sm:text-2xl font-black text-emerald-700 mt-0.5">
                    {stats.totalWins}
                  </span>
                  <span className="text-[10px] text-emerald-600 font-bold">勝率 {stats.winRate}%</span>
                </div>

                <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-2xl flex flex-col items-center justify-center text-center">
                  <div className="flex items-center gap-1 text-amber-700">
                    <Flame className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                    <span className="text-[10px] sm:text-xs font-semibold uppercase">連勝記録</span>
                  </div>
                  <span data-testid="stat-current-streak" className="text-xl sm:text-2xl font-black text-amber-800 mt-0.5">
                    {stats.currentWinStreak}
                  </span>
                  <span className="text-[10px] text-amber-700 font-medium">最高 {stats.bestWinStreak} 連勝</span>
                </div>

                <div className="p-3 bg-sky-50/70 border border-sky-200 rounded-2xl flex flex-col items-center justify-center text-center">
                  <div className="flex items-center gap-1 text-sky-700">
                    <Zap className="w-3.5 h-3.5 text-sky-600" />
                    <span className="text-[10px] sm:text-xs font-semibold uppercase">最短決着</span>
                  </div>
                  <span data-testid="stat-fastest-win" className="text-xl sm:text-2xl font-black text-sky-800 mt-0.5">
                    {stats.fastestWinTurns !== null ? `${stats.fastestWinTurns}` : '-'}
                  </span>
                  <span className="text-[10px] text-sky-600 font-medium">
                    {stats.fastestWinTurns !== null ? 'ターン' : '未勝利'}
                  </span>
                </div>
              </div>

              {/* Accuracy Card */}
              <div className="p-3.5 bg-gradient-to-r from-slate-50 to-indigo-50/40 border border-slate-200 rounded-2xl flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-slate-800 flex items-center gap-1.5 text-xs sm:text-sm">
                    <Target className="w-4 h-4 text-indigo-600" />
                    <span>推理的中率（Hit Accuracy）</span>
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    総アタック数: <span className="font-bold text-slate-700">{stats.totalAttacks}</span> 回 / 的中: <span className="font-bold text-indigo-700">{stats.totalHits}</span> 回
                  </p>
                </div>
                <div className="text-right">
                  <span data-testid="stat-hit-accuracy" className="text-2xl font-black text-indigo-700">
                    {stats.hitAccuracy}%
                  </span>
                </div>
              </div>

              {/* Difficulty Breakdown */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  難易度別戦績
                </h4>
                <div className="grid grid-cols-3 gap-2">
                  <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-center">
                    <span className="text-xs font-bold text-emerald-700 block">初級 (Easy)</span>
                    <span className="text-sm font-black text-slate-800 block mt-1">
                      {stats.byDifficulty.easy.wins} / {stats.byDifficulty.easy.games}
                    </span>
                    <span className="text-[10px] text-slate-500 font-semibold block">
                      勝率 {stats.byDifficulty.easy.winRate}%
                    </span>
                  </div>

                  <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-center">
                    <span className="text-xs font-bold text-algo-blue block">中級 (Normal)</span>
                    <span className="text-sm font-black text-slate-800 block mt-1">
                      {stats.byDifficulty.normal.wins} / {stats.byDifficulty.normal.games}
                    </span>
                    <span className="text-[10px] text-slate-500 font-semibold block">
                      勝率 {stats.byDifficulty.normal.winRate}%
                    </span>
                  </div>

                  <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-center">
                    <span className="text-xs font-bold text-rose-600 block">上級 (Hard)</span>
                    <span className="text-sm font-black text-slate-800 block mt-1">
                      {stats.byDifficulty.hard.wins} / {stats.byDifficulty.hard.games}
                    </span>
                    <span className="text-[10px] text-slate-500 font-semibold block">
                      勝率 {stats.byDifficulty.hard.winRate}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Reset Section */}
              <div className="pt-2 border-t border-slate-100 flex flex-col items-center">
                {!showResetConfirm ? (
                  <button
                    type="button"
                    data-testid="btn-reset-stats"
                    onClick={() => setShowResetConfirm(true)}
                    className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-rose-600 py-1.5 px-3 rounded-lg hover:bg-rose-50 transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>戦績データをリセット</span>
                  </button>
                ) : (
                  <div className="w-full p-3 bg-rose-50 border border-rose-200 rounded-xl space-y-2 text-center animate-in fade-in duration-150">
                    <p className="text-xs text-rose-800 font-bold">
                      本当に通算戦績をリセットしますか？この操作は取り消せません。
                    </p>
                    <div className="flex justify-center gap-2">
                      <button
                        type="button"
                        data-testid="btn-cancel-reset-stats"
                        onClick={() => setShowResetConfirm(false)}
                        className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        キャンセル
                      </button>
                      <button
                        type="button"
                        data-testid="btn-confirm-reset-stats"
                        onClick={handleConfirmReset}
                        className="px-3 py-1 bg-rose-600 text-white rounded-lg text-xs font-bold hover:bg-rose-700 shadow-2xs"
                      >
                        リセットを実行
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'achievements' && (
            <div className="space-y-3">
              {/* Progress bar */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl space-y-1.5">
                <div className="flex justify-between items-center text-xs font-bold">
                  <span className="text-slate-600">達成度</span>
                  <span className="text-amber-600 font-black">{achievementProgress}% ({unlockedCount}/{totalAchievements})</span>
                </div>
                <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-amber-400 to-amber-500 rounded-full transition-all duration-300"
                    style={{ width: `${achievementProgress}%` }}
                  />
                </div>
              </div>

              {/* Achievement List */}
              <div className="space-y-2.5">
                {achievements.map((item) => {
                  const isUnlocked = item.unlockedAt !== null;
                  return (
                    <div
                      key={item.id}
                      data-testid={`achievement-item-${item.id}`}
                      className={`p-3.5 rounded-2xl border transition-all flex items-start gap-3 ${
                        isUnlocked
                          ? 'border-amber-300 bg-amber-50/50 shadow-2xs'
                          : 'border-slate-200 bg-slate-50/60 opacity-60'
                      }`}
                    >
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0 ${
                          isUnlocked
                            ? 'bg-amber-100 border border-amber-300 shadow-2xs'
                            : 'bg-slate-200 border border-slate-300 grayscale'
                        }`}
                      >
                        {item.icon}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <h4
                            className={`font-black text-sm truncate ${
                              isUnlocked ? 'text-slate-900' : 'text-slate-600'
                            }`}
                          >
                            {item.title}{' '}
                            <span className="text-[11px] font-normal text-slate-500">
                              ({item.nameEn})
                            </span>
                          </h4>
                          {isUnlocked ? (
                            <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full shrink-0">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>解除済</span>
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-[10px] font-bold text-slate-500 bg-slate-200/80 px-2 py-0.5 rounded-full shrink-0">
                              <Lock className="w-3 h-3 text-slate-400" />
                              <span>未解除</span>
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-slate-600 mt-0.5 font-medium leading-relaxed">
                          {item.description}
                        </p>

                        {isUnlocked && item.unlockedAt && (
                          <div className="flex items-center gap-1 text-[10px] text-slate-400 mt-1 font-semibold">
                            <Calendar className="w-3 h-3" />
                            <span>{new Date(item.unlockedAt).toLocaleDateString()} 解除</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
