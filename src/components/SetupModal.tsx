'use client';

import React from 'react';
import { PlayerCount, Difficulty, TimeLimit } from '../types/game';
import { Users, Brain, Timer, BookOpen, ArrowRight, Sparkles, GraduationCap } from 'lucide-react';
import { useUserSession } from '../hooks/useUserSession';

export interface SetupModalProps {
  playerCount: PlayerCount;
  difficulty: Difficulty;
  timeLimit: TimeLimit;
  onSelectPlayerCount: (count: PlayerCount) => void;
  onSelectDifficulty: (diff: Difficulty) => void;
  onSelectTimeLimit: (limit: TimeLimit) => void;
  onStartGame: () => void;
  onOpenRules: () => void;
  onOpenTutorial?: () => void;
  userId?: string;
}

export interface RosterPlayer {
  id: string;
  name: string;
  isHuman: boolean;
  avatarIcon: string;
  colorGradient: string;
  handCount: number;
}

const CPU_ROSTER_DEFS = [
  { name: 'CPU アル', color: 'from-blue-400 to-indigo-500' },
  { name: 'CPU ゴオ', color: 'from-amber-300 to-yellow-500' },
  { name: 'CPU ルウ', color: 'from-emerald-400 to-teal-600' },
];

/**
 * 人数選択に応じた対戦相手構成と山札残り枚数を計算
 * 2人: 各4枚 (計8枚) -> 山札 16枚
 * 3人: 各3枚 (計9枚) -> 山札 15枚
 * 4人: 各3枚 (計12枚) -> 山札 12枚
 */
export function getPlayerRoster(count: PlayerCount): {
  players: RosterPlayer[];
  deckCount: number;
} {
  const handCount = count === 2 ? 4 : 3;
  const totalCards = 24;
  const deckCount = totalCards - count * handCount;

  const players: RosterPlayer[] = [
    {
      id: 'human',
      name: 'あなた',
      isHuman: true,
      avatarIcon: '👤',
      colorGradient: 'from-sky-400 to-blue-600',
      handCount,
    },
    ...CPU_ROSTER_DEFS.slice(0, count - 1).map((cpu, idx) => ({
      id: `cpu-${idx + 1}`,
      name: cpu.name,
      isHuman: false,
      avatarIcon: '🤖',
      colorGradient: cpu.color,
      handCount,
    })),
  ];

  return { players, deckCount };
}

export const SetupModal: React.FC<SetupModalProps> = ({
  playerCount,
  difficulty,
  timeLimit,
  onSelectPlayerCount,
  onSelectDifficulty,
  onSelectTimeLimit,
  onStartGame,
  onOpenRules,
  onOpenTutorial,
  userId: propUserId,
}) => {
  const session = useUserSession();
  const displayUserId = propUserId || session.userId || 'usr_xxxxxxxx';
  const { players: rosterPlayers, deckCount } = getPlayerRoster(playerCount);

  return (
    <div className="max-w-2xl mx-auto bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
      {/* Hero Banner Header (New realistic algo banner) */}
      <div className="relative w-full h-48 sm:h-60 bg-slate-100 overflow-hidden border-b border-slate-200">
        <img
          src="/hero-banner.jpg"
          alt="algo game banner"
          className="w-full h-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-white/95 via-white/20 to-transparent flex items-end p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl overflow-hidden shadow-md border-2 border-white bg-white shrink-0">
              <img src="/app-icon.jpg" alt="algo icon" className="w-full h-full object-cover" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                  algo <span className="text-xs px-2.5 py-0.5 rounded-full bg-algo-blue text-white font-bold">Web対戦</span>
                </h2>
              </div>
              {/* ユーザーIDバッジ */}
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <div
                  data-testid="user-id-badge"
                  className="bg-sky-50 border border-sky-200 text-sky-800 text-xs font-mono px-2.5 py-1 rounded-full inline-flex items-center gap-1.5 shadow-2xs"
                >
                  <span className="text-xs">👤</span>
                  <span>{`ゲストID: ${displayUserId}`}</span>
                </div>
              </div>
              <p className="mt-1 text-xs text-slate-600 font-medium">
                白と黒の数字を推理する、東大数学科・ピーターフランクル氏考案の頭脳派ゲーム
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Settings Form */}
      <div className="p-6 sm:p-7 space-y-5">
        {/* 1. 対戦人数選択 (2〜4人) */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <label className="text-xs sm:text-sm font-bold text-slate-800 flex items-center gap-1.5">
              <Users className="w-4 h-4 text-algo-blue" />
              <span>対戦人数を選択 (2〜4人)</span>
            </label>
            <span className="text-[11px] text-slate-500 font-medium">
              {playerCount === 2
                ? '初期手札 各4枚 (タイマン)'
                : playerCount === 3
                ? '初期手札 各3枚 (三つ巴)'
                : '初期手札 各3枚 (4人乱戦)'}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            {[
              { count: 2 as PlayerCount, label: '2人対戦', sub: 'あなた vs CPU 1体' },
              { count: 3 as PlayerCount, label: '3人対戦', sub: 'あなた vs CPU 2体' },
              { count: 4 as PlayerCount, label: '4人対戦', sub: 'あなた vs CPU 3体' },
            ].map((item) => {
              const isSelected = playerCount === item.count;
              return (
                <button
                  key={item.count}
                  type="button"
                  data-testid={`btn-select-player-count-${item.count}`}
                  onClick={() => onSelectPlayerCount(item.count)}
                  className={`p-3 rounded-2xl border-2 text-center transition-all flex flex-col items-center justify-center gap-0.5 ${
                    isSelected
                      ? 'border-algo-blue bg-algo-blue-light/50 ring-4 ring-algo-blue/20 shadow-xs scale-102 font-bold text-algo-navy'
                      : 'border-slate-200 bg-white hover:border-slate-300 text-slate-700'
                  }`}
                >
                  <span className="text-sm sm:text-base font-black">{item.label}</span>
                  <span className="text-[9px] sm:text-[10px] text-slate-500">{item.sub}</span>
                </button>
              );
            })}
          </div>

          {/* 動的対戦相手プレビュー領域 */}
          <div
            data-testid="player-roster-preview"
            className="bg-slate-50/90 border border-slate-200/90 rounded-2xl p-3 sm:p-3.5 space-y-2.5"
          >
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-700 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-algo-blue" />
                <span>対戦相手構成</span>
              </span>
              <span
                data-testid="deck-count-badge"
                className="px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-900 border border-amber-200/80 font-bold text-[11px] inline-flex items-center gap-1"
              >
                <span>🎴 残り山札:</span>
                <span className="font-mono">{`${deckCount}枚`}</span>
              </span>
            </div>

            <div className="flex items-center justify-between gap-1.5 sm:gap-2 flex-wrap sm:flex-nowrap">
              {rosterPlayers.map((player, idx) => (
                <React.Fragment key={player.id}>
                  {idx > 0 && (
                    <span className="text-xs font-black text-slate-400 italic shrink-0 px-0.5">
                      vs
                    </span>
                  )}
                  <div
                    data-testid={`roster-player-${player.id}`}
                    className="flex-1 min-w-[110px] bg-white border border-slate-200 rounded-xl p-2 sm:p-2.5 flex items-center gap-2 shadow-2xs transition-all"
                  >
                    <div
                      className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-gradient-to-br ${player.colorGradient} flex items-center justify-center text-white text-xs sm:text-sm shadow-xs shrink-0`}
                    >
                      {player.avatarIcon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-slate-800 truncate">
                        {`${player.name}（手札${player.handCount}枚）`}
                      </div>
                      <div className="text-[10px] text-slate-500 font-medium">
                        {player.isHuman ? 'プレイヤー' : 'AI対戦相手'}
                      </div>
                    </div>
                  </div>
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>

        {/* 2. 持ち時間選択（三択） */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <label className="text-xs sm:text-sm font-bold text-slate-800 flex items-center gap-1.5">
              <Timer className="w-4 h-4 text-algo-blue" />
              <span>持ち時間（ターン制限）を選択</span>
            </label>
            <span className="text-[11px] text-slate-500 font-medium">
              {timeLimit === 0 ? '無制限（じっくり思考）' : `${timeLimit}秒 / 手番`}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            {[
              { limit: 30 as TimeLimit, label: '30秒', desc: '標準テンポ', badge: '標準テンポ' },
              { limit: 15 as TimeLimit, label: '15秒', desc: '早指しスピーディ', badge: 'スリリング' },
              { limit: 0 as TimeLimit, label: '無制限', desc: 'じっくり長考', badge: 'おすすめ（初心者向け）' },
            ].map((item) => {
              const isSelected = timeLimit === item.limit;
              return (
                <button
                  key={item.limit}
                  type="button"
                  data-testid={`btn-select-time-limit-${item.limit}`}
                  onClick={() => onSelectTimeLimit(item.limit)}
                  className={`p-3 rounded-2xl border-2 text-center transition-all flex flex-col items-center justify-center gap-0.5 ${
                    isSelected
                      ? 'border-algo-yellow-dark bg-algo-yellow-light/80 ring-4 ring-algo-yellow/30 shadow-xs scale-102 font-bold text-slate-900'
                      : 'border-slate-200 bg-white hover:border-slate-300 text-slate-700'
                  }`}
                >
                  <span className="text-sm sm:text-base font-black">{item.label}</span>
                  <span className="text-[9px] sm:text-[10px] text-slate-500">{item.desc}</span>
                  <span
                    className={`mt-0.5 text-[8px] px-1.5 py-0.2 rounded-full font-bold ${
                      isSelected ? 'bg-amber-400 text-slate-950' : 'bg-slate-100 text-slate-400'
                    }`}
                  >
                    {item.badge}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 3. CPU難易度選択 */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <label className="text-xs sm:text-sm font-bold text-slate-800 flex items-center gap-1.5">
              <Brain className="w-4 h-4 text-algo-blue" />
              <span>CPUの難易度を選択</span>
            </label>
            <span className="text-[11px] text-slate-500 font-medium">
              {difficulty === 'easy'
                ? '初級：気楽に推理'
                : difficulty === 'normal'
                ? '中級：論理的消去法'
                : '上級：完全消去法'}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            {[
              { diff: 'easy' as Difficulty, label: '初級 (Easy)' },
              { diff: 'normal' as Difficulty, label: '中級 (Normal)' },
              { diff: 'hard' as Difficulty, label: '上級 (Hard)' },
            ].map((item) => {
              const isSelected = difficulty === item.diff;
              return (
                <button
                  key={item.diff}
                  type="button"
                  data-testid={`btn-select-difficulty-${item.diff}`}
                  onClick={() => onSelectDifficulty(item.diff)}
                  className={`p-2.5 rounded-2xl border-2 text-center transition-all flex flex-col items-center justify-center ${
                    isSelected
                      ? 'border-algo-blue bg-algo-blue-light/50 ring-4 ring-algo-blue/20 shadow-xs font-bold text-slate-900'
                      : 'border-slate-200 bg-white hover:border-slate-300 text-slate-700'
                  }`}
                >
                  <span className="text-xs sm:text-sm font-black">{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 4. アクションボタン */}
        <div className="pt-2 flex flex-col sm:flex-row gap-2.5 sm:gap-3">
          <button
            type="button"
            data-testid="btn-setup-rules"
            onClick={onOpenRules}
            className="sm:w-auto py-3 px-3.5 rounded-2xl border border-slate-300 text-slate-700 hover:bg-slate-50 font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all shadow-2xs"
          >
            <BookOpen className="w-4 h-4 text-algo-blue" />
            <span>ルールを確認</span>
          </button>

          {onOpenTutorial && (
            <button
              type="button"
              data-testid="btn-setup-tutorial"
              onClick={onOpenTutorial}
              className="sm:w-auto py-3 px-3.5 rounded-2xl border border-algo-blue/40 bg-algo-blue-light/40 text-algo-navy hover:bg-algo-blue-light/70 font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all shadow-2xs"
            >
              <GraduationCap className="w-4 h-4 text-algo-blue" />
              <span>チュートリアル</span>
            </button>
          )}

          <button
            type="button"
            data-testid="btn-start-game"
            onClick={onStartGame}
            className="flex-1 py-3 px-6 rounded-2xl bg-gradient-to-r from-algo-yellow to-algo-yellow-dark hover:brightness-105 active:scale-98 text-slate-950 font-black text-sm sm:text-base shadow-md shadow-amber-300/40 flex items-center justify-center gap-2 transition-all border border-amber-300/60"
          >
            <span>対戦を開始する！</span>
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};
