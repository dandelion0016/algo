'use client';

import React, { useEffect } from 'react';
import {
  Trophy,
  RotateCcw,
  Settings2,
  Target,
  Zap,
  Shield,
  Users,
  Award,
  Clock,
  Sparkles,
  Frown,
  ChevronRight,
  Eye,
} from 'lucide-react';
import { Player, AttackLog, PlayerCount, Difficulty, TimeLimit } from '../types/game';
import { ConfettiEffect } from './ConfettiEffect';
import { CardComponent } from './CardComponent';

export interface ResultModalProps {
  isOpen: boolean;
  winner: Player | null;
  humanPlayer: Player | null;
  players: Player[];
  logs: AttackLog[];
  playerCount: PlayerCount;
  difficulty: Difficulty;
  timeLimit: TimeLimit;
  onPlayAgain?: () => void;
  onRestart?: () => void;
  onReturnSetup: () => void;
  onClose?: () => void;
}

export interface CombatStats {
  totalTurns: number;
  totalAttacks: number;
  hits: number;
  hitRate: number; // 0..100 (%)
  survivingCards: number;
  totalCards: number;
  difficultyLabel: string;
  playerCountLabel: string;
  timeLimitLabel: string;
}

export const getDifficultyLabel = (diff: Difficulty | string): string => {
  switch (diff) {
    case 'easy':
    case '初級':
      return '初級';
    case 'normal':
    case '中級':
      return '中級';
    case 'hard':
    case '上級':
      return '上級';
    default:
      return String(diff);
  }
};

export const getTimeLimitLabel = (limit: TimeLimit): string => {
  if (limit === 0) return '無制限';
  return `${limit}秒`;
};

export const calculateCombatStats = (
  logs: AttackLog[],
  humanPlayer: Player | null,
  playerCount: PlayerCount,
  difficulty: Difficulty,
  timeLimit: TimeLimit
): CombatStats => {
  const humanId = humanPlayer?.id || 'player';
  const humanName = humanPlayer?.name || 'あなた';

  // プレイヤーのアタックログ（対象プレイヤーが存在する有効アタック）
  const playerAttacks = logs.filter(
    (l) =>
      (l.attackerId === humanId || l.attackerName === humanName || l.attackerName === 'あなた') &&
      Boolean(l.targetPlayerId)
  );

  const totalAttacks = playerAttacks.length;
  const hits = playerAttacks.filter((l) => l.isHit).length;
  const hitRate = totalAttacks > 0 ? Math.round((hits / totalAttacks) * 100) : 0;

  // 対戦全体の有効アタック手数（総ターン数）
  const totalTurns = logs.filter((l) => Boolean(l.targetPlayerId)).length;

  // プレイヤーの生存手札数（伏せカード枚数）
  const survivingCards = humanPlayer
    ? humanPlayer.cards.filter((c) => !c.isOpen).length
    : 0;
  const totalCards = humanPlayer ? humanPlayer.cards.length : 0;

  return {
    totalTurns,
    totalAttacks,
    hits,
    hitRate,
    survivingCards,
    totalCards,
    difficultyLabel: getDifficultyLabel(difficulty),
    playerCountLabel: `${playerCount}人対戦`,
    timeLimitLabel: getTimeLimitLabel(timeLimit),
  };
};

export const ResultModal: React.FC<ResultModalProps> = ({
  isOpen,
  winner,
  humanPlayer,
  players,
  logs,
  playerCount,
  difficulty,
  timeLimit,
  onPlayAgain,
  onRestart,
  onReturnSetup,
  onClose,
}) => {
  const handleRestart = onRestart || onPlayAgain;

  // キーボードアクセシビリティ: Enter/Space で再戦、Escape で閉じる
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (onClose) {
          e.preventDefault();
          onClose();
        }
      } else if (e.key === 'Enter' || e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        handleRestart?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, handleRestart, onClose]);

  if (!isOpen) return null;

  const isVictory = Boolean(winner?.isHuman || (winner === null && humanPlayer && !humanPlayer.isEliminated));
  const stats = calculateCombatStats(logs, humanPlayer, playerCount, difficulty, timeLimit);

  return (
    <>
      {/* プレイヤー勝利時の紙吹雪演出 */}
      {isVictory && <ConfettiEffect />}

      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      >
        <div
          data-testid="result-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="result-title"
          className="bg-white/95 backdrop-blur-md rounded-2xl sm:rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full max-h-[92dvh] overflow-hidden text-slate-800 animate-in zoom-in-95 duration-200 flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* 北欧モダン幾何学アクセントバー */}
          <div
            className={`w-full h-2.5 sm:h-3 shrink-0 border-b border-slate-100 ${
              isVictory
                ? 'bg-gradient-to-r from-amber-300 via-algo-yellow to-algo-blue'
                : 'bg-gradient-to-r from-slate-300 via-slate-400 to-slate-500'
            }`}
          />

          <div className="p-3.5 sm:p-6 space-y-3 sm:space-y-5 overflow-y-auto max-h-full">
            {/* ヒーローバナー＆勝敗表示 */}
            <div
              data-testid="result-winner-badge"
              className={`rounded-xl sm:rounded-2xl p-3.5 sm:p-6 text-center border relative overflow-hidden transition-all shrink-0 ${
                isVictory
                  ? 'bg-gradient-to-b from-amber-50/90 to-amber-100/40 border-amber-200 shadow-sm'
                  : 'bg-gradient-to-b from-slate-50 to-slate-100/60 border-slate-200'
              }`}
            >
              {isVictory ? (
                <>
                  <div className="inline-flex items-center justify-center w-12 h-12 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl bg-gradient-to-tr from-amber-400 to-yellow-300 text-slate-950 shadow-md shadow-amber-200 mb-2 sm:mb-3 animate-bounce">
                    <Trophy className="w-7 h-7 sm:w-9 sm:h-9" />
                  </div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full bg-amber-100 border border-amber-300 text-amber-900 text-[10px] sm:text-xs font-black mb-1.5 sm:mb-2 shadow-2xs">
                    <Sparkles className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-600" />
                    <span>VICTORY</span>
                  </div>
                  <h2
                    id="result-title"
                    className="text-xl sm:text-3xl font-black text-slate-900 tracking-tight"
                  >
                    👑 あなたの完全勝利！
                  </h2>
                  <p className="mt-1 text-xs sm:text-sm text-slate-600 font-medium">
                    卓越した論理的推理で相手のカードをすべて暴き、見事に制覇しました！
                  </p>
                </>
              ) : (
                <>
                  <div className="inline-flex items-center justify-center w-12 h-12 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl bg-slate-200 text-slate-600 shadow-sm mb-2 sm:mb-3">
                    <Frown className="w-7 h-7 sm:w-9 sm:h-9" />
                  </div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full bg-slate-200 border border-slate-300 text-slate-700 text-[10px] sm:text-xs font-bold mb-1.5 sm:mb-2">
                    <span>DEFEAT</span>
                  </div>
                  <h2
                    id="result-title"
                    className="text-xl sm:text-3xl font-black text-slate-800 tracking-tight"
                  >
                    敗北… 次回リベンジ！
                  </h2>
                  <p className="mt-1 text-xs sm:text-sm text-slate-600 font-medium">
                    勝者: <span className="font-bold text-slate-800">{winner?.name || '相手'}</span>
                    。惜しくも敗れました。次こそは鋭い推理で勝利を掴みましょう！
                  </p>
                </>
              )}
            </div>

            {/* 戦績サマリセクション */}
            <div className="space-y-2 sm:space-y-2.5">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-[11px] sm:text-xs font-black text-slate-700 tracking-wider flex items-center gap-1.5">
                  <Target className="w-3.5 h-3.5 text-algo-blue" />
                  <span>対戦戦績サマリ (Combat Stats)</span>
                </h3>
                <span className="text-[10px] sm:text-[11px] font-semibold text-slate-400">
                  {stats.playerCountLabel}・{stats.difficultyLabel}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:gap-2.5">
                {/* 1. 的中率 */}
                <div
                  data-testid="stat-accuracy"
                  className="bg-slate-50/80 border border-slate-200/80 rounded-xl sm:rounded-2xl p-2.5 sm:p-3.5 flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between text-slate-500 mb-0.5 sm:mb-1">
                    <span className="text-[11px] sm:text-xs font-bold">アタック的中率</span>
                    <Target className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-500" />
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-xl sm:text-2xl font-black text-slate-900">{`${stats.hitRate}%`}</span>
                    <span className="text-[10px] sm:text-xs text-slate-500 font-medium">
                      {`(${stats.hits}/${stats.totalAttacks}的中)`}
                    </span>
                  </div>
                  {/* 的中率プログレスバー */}
                  <div className="w-full h-1 sm:h-1.5 bg-slate-200 rounded-full mt-1.5 sm:mt-2 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        stats.hitRate >= 60
                          ? 'bg-emerald-500'
                          : stats.hitRate >= 30
                          ? 'bg-amber-400'
                          : 'bg-algo-blue'
                      }`}
                      style={{ width: `${Math.min(100, stats.hitRate)}%` }}
                    />
                  </div>
                </div>

                {/* 2. アタック総数 / 経過手数 */}
                <div
                  data-testid="stat-attacks"
                  className="bg-slate-50/80 border border-slate-200/80 rounded-xl sm:rounded-2xl p-2.5 sm:p-3.5 flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between text-slate-500 mb-0.5 sm:mb-1">
                    <span className="text-[11px] sm:text-xs font-bold">あなたのアタック</span>
                    <Zap className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-500" />
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-xl sm:text-2xl font-black text-slate-900">{`${stats.totalAttacks} 回`}</span>
                    <span
                      data-testid="stat-turns"
                      className="text-[10px] sm:text-xs text-slate-500 font-medium"
                    >
                      {`(総手番: ${stats.totalTurns})`}
                    </span>
                  </div>
                  <p className="text-[9px] sm:text-[10px] text-slate-400 font-medium mt-0.5 sm:mt-1">
                    積極的な推論手数
                  </p>
                </div>

                {/* 3. 生存手札枚数 */}
                <div
                  data-testid="stat-surviving-cards"
                  className="bg-slate-50/80 border border-slate-200/80 rounded-xl sm:rounded-2xl p-2.5 sm:p-3.5 flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between text-slate-500 mb-0.5 sm:mb-1">
                    <span className="text-[11px] sm:text-xs font-bold">手札防衛（生存数）</span>
                    <Shield className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-algo-blue" />
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-xl sm:text-2xl font-black text-slate-900">
                      {`${stats.survivingCards} / ${stats.totalCards}`}
                    </span>
                    <span className="text-[10px] sm:text-xs text-slate-500 font-medium">枚伏せ</span>
                  </div>
                  <p className="text-[9px] sm:text-[10px] text-slate-400 font-medium mt-0.5 sm:mt-1">
                    {stats.survivingCards === stats.totalCards
                      ? '完璧なノーダメージ防衛！'
                      : stats.survivingCards > 0
                      ? '手札を守り抜きました'
                      : '全開示（脱落）'}
                  </p>
                </div>

                {/* 4. 対戦条件・設定 */}
                <div
                  data-testid="stat-settings"
                  className="bg-slate-50/80 border border-slate-200/80 rounded-xl sm:rounded-2xl p-2.5 sm:p-3.5 flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between text-slate-500 mb-0.5 sm:mb-1">
                    <span className="text-[11px] sm:text-xs font-bold">対戦ルール設定</span>
                    <Award className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-500" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span
                        data-testid="stat-player-count"
                        className="font-bold text-slate-800 text-[11px] sm:text-xs"
                      >
                        {stats.playerCountLabel}
                      </span>
                      <span
                        data-testid="stat-difficulty"
                        className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[9px] sm:text-[10px] font-black"
                      >
                        {stats.difficultyLabel}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-[10px] sm:text-[11px] text-slate-500">
                      <Clock className="w-3 h-3 text-slate-400" />
                      <span>{`持ち時間: ${stats.timeLimitLabel}`}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 🔍 手札の答え合わせ (Review Hands) セクション (Issue #60) */}
            <div
              data-testid="hand-review-section"
              className="bg-slate-50/90 border border-slate-200/90 rounded-xl sm:rounded-2xl p-3 sm:p-4 space-y-2.5"
            >
              <div className="flex items-center justify-between px-0.5">
                <h3 className="text-[11px] sm:text-xs font-black text-slate-700 tracking-wider flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5 text-algo-blue" />
                  <span>🔍 手札の答え合わせ (Review Hands)</span>
                </h3>
                <span className="text-[10px] sm:text-[11px] font-semibold text-slate-400">
                  全プレイヤーの最終手札
                </span>
              </div>

              <div className="space-y-2">
                {players.map((p) => {
                  const isCurrentWinner = winner?.id === p.id;
                  const openCount = p.cards.filter((c) => c.isOpen).length;
                  return (
                    <div
                      key={p.id}
                      data-testid={`review-player-${p.id}`}
                      className="bg-white rounded-lg sm:rounded-xl p-2.5 sm:p-3 border border-slate-200/70 shadow-2xs space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{
                              backgroundColor: p.avatarColor?.startsWith('from-')
                                ? undefined
                                : p.avatarColor || '#3b82f6',
                            }}
                          />
                          <span className="text-xs sm:text-sm font-bold text-slate-800 flex items-center gap-1">
                            {p.name}
                            {p.isHuman && (
                              <span className="text-[10px] text-slate-500 font-normal">(あなた)</span>
                            )}
                          </span>
                          {isCurrentWinner && (
                            <span className="px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-800 text-[9px] font-black">
                              👑 勝者
                            </span>
                          )}
                          {p.isEliminated && (
                            <span className="px-1.5 py-0.2 rounded-full bg-rose-100 text-rose-700 text-[9px] font-bold">
                              脱落
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400 font-medium">
                          {openCount}/{p.cards.length} 枚OPEN
                        </span>
                      </div>

                      {/* 手札カード一覧（全カードを表向きで開示） */}
                      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                        {p.cards.map((card, cIdx) => (
                          <CardComponent
                            key={card.id || `${p.id}-${cIdx}`}
                            card={card}
                            isOwner={false}
                            isRevealed={true}
                            size="xs"
                            testId={`review-card-${p.id}-${cIdx}`}
                            label={`#${cIdx + 1}`}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* アクションボタン */}
            <div className="space-y-2 sm:space-y-2.5 pt-0.5 sm:pt-1 shrink-0">
              <button
                type="button"
                data-testid="btn-play-again"
                onClick={handleRestart}
                className="w-full py-2.5 sm:py-3.5 px-3 sm:px-4 rounded-xl sm:rounded-2xl bg-slate-900 hover:bg-slate-800 active:scale-[0.99] text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transition-all cursor-pointer whitespace-nowrap"
              >
                <RotateCcw className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-algo-yellow" />
                <span>同じ設定でもう一度遊ぶ（再戦）</span>
              </button>

              <button
                type="button"
                data-testid="btn-return-setup"
                onClick={onReturnSetup}
                className="w-full py-2 sm:py-3 px-3 sm:px-4 rounded-xl sm:rounded-2xl bg-white hover:bg-slate-50 active:scale-[0.99] border border-slate-200 text-slate-700 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-2xs hover:border-slate-300 transition-all cursor-pointer whitespace-nowrap"
              >
                <Settings2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-500" />
                <span>設定を変更する（タイトルへ）</span>
              </button>

              {onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full py-1.5 sm:py-2 text-center text-xs text-slate-400 hover:text-slate-600 font-medium transition-colors"
                >
                  盤面を振り返る（モーダルを閉じる）
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
