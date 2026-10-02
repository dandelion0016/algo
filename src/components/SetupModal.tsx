'use client';

import React from 'react';
import { PlayerCount, Difficulty, TimeLimit } from '../types/game';
import { Users, Brain, Timer, BookOpen, ArrowRight, Sparkles, GraduationCap } from 'lucide-react';
import { useUserSession } from '../hooks/useUserSession';
import { getAppVersion } from '../lib/version';

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
    <div className="w-full max-w-lg sm:max-w-2xl mx-auto bg-white rounded-2xl sm:rounded-3xl shadow-xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
      {/* Hero Banner Header (New realistic algo banner) */}
      <div className="relative w-full h-22 sm:h-44 lg:h-52 bg-slate-100 overflow-hidden border-b border-slate-200 shrink-0">
        <img
          src="/hero-banner.jpg"
          alt="algo game banner"
          className="w-full h-full object-cover object-center"
        />
        {/* バージョン表示バッジ (モバイルでも右上に一目で視認可能) */}
        <div
          data-testid="setup-banner-version-badge"
          className="absolute top-2 right-2 sm:top-3.5 sm:right-3.5 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full bg-slate-900/85 backdrop-blur-xs text-white text-[10px] sm:text-xs font-mono font-bold shadow-md z-10 flex items-center gap-1 border border-white/20"
        >
          <span className="text-[9px] text-slate-300 font-sans tracking-wide">Ver</span>
          <span>{getAppVersion()}</span>
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-white/95 via-white/25 to-transparent flex items-end p-2.5 sm:p-5 lg:p-6">
          <div className="flex items-center gap-2.5 sm:gap-3 w-full">
            <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl overflow-hidden shadow-md border-2 border-white bg-white shrink-0">
              <img src="/app-icon.jpg" alt="algo icon" className="w-full h-full object-cover" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <h2 className="text-base sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-1.5">
                  algo <span className="text-[10px] sm:text-xs px-2 py-0.5 rounded-full bg-algo-blue text-white font-bold">Web対戦</span>
                </h2>
                {/* ユーザーIDバッジ */}
                <div
                  data-testid="user-id-badge"
                  className="bg-sky-50 border border-sky-200 text-sky-800 text-[10px] sm:text-xs font-mono px-2 py-0.5 rounded-full inline-flex items-center gap-1 shadow-2xs"
                >
                  <span className="text-xs">👤</span>
                  <span>{`ゲストID: ${displayUserId}`}</span>
                </div>
              </div>
              <p className="mt-0.5 text-[10px] sm:text-xs text-slate-600 font-medium truncate sm:whitespace-normal">
                白と黒の数字を推理する、東大数学科・ピーターフランクル氏考案の頭脳派ゲーム
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Settings Form */}
      <div className="p-3 sm:p-6 space-y-2 sm:space-y-4">
        {/* 1. 対戦人数選択 (2〜4人) */}
        <div className="space-y-1.5 sm:space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-[11px] sm:text-sm font-bold text-slate-800 flex items-center gap-1 sm:gap-1.5">
              <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-algo-blue" />
              <span>対戦人数を選択 (2〜4人)</span>
            </label>
            <span className="text-[10px] sm:text-[11px] text-slate-500 font-medium">
              {playerCount === 2
                ? '初期手札 各4枚 (タイマン)'
                : playerCount === 3
                ? '初期手札 各3枚 (三つ巴)'
                : '初期手札 各3枚 (4人乱戦)'}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-1.5 sm:gap-2.5">
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
                  className={`p-1.5 sm:p-3 rounded-xl sm:rounded-2xl border-2 text-center transition-all flex flex-col items-center justify-center gap-0.5 ${
                    isSelected
                      ? 'border-algo-blue bg-algo-blue-light/50 ring-2 sm:ring-4 ring-algo-blue/20 shadow-xs font-bold text-algo-navy'
                      : 'border-slate-200 bg-white hover:border-slate-300 text-slate-700'
                  }`}
                >
                  <span className="text-xs sm:text-base font-black">{item.label}</span>
                  <span className="text-[8px] sm:text-[10px] text-slate-500">{item.sub}</span>
                </button>
              );
            })}
          </div>

          {/* 動的対戦相手プレビュー領域 */}
          <div
            data-testid="player-roster-preview"
            className="bg-slate-50/90 border border-slate-200/90 rounded-xl sm:rounded-2xl p-1.5 sm:p-3 space-y-1 sm:space-y-2"
          >
            <div className="flex items-center justify-between text-[10px] sm:text-xs">
              <span className="font-bold text-slate-700 flex items-center gap-1 sm:gap-1.5">
                <Sparkles className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-algo-blue" />
                <span>対戦相手構成</span>
              </span>
              <span
                data-testid="deck-count-badge"
                className="px-2 py-0.2 sm:px-2.5 sm:py-0.5 rounded-full bg-amber-50 text-amber-900 border border-amber-200/80 font-bold text-[10px] sm:text-[11px] inline-flex items-center gap-1"
              >
                <span>🎴 残り山札:</span>
                <span className="font-mono">{`${deckCount}枚`}</span>
              </span>
            </div>

            <div className="flex items-center justify-between gap-1 sm:gap-2">
              {rosterPlayers.map((player, idx) => (
                <React.Fragment key={player.id}>
                  {idx > 0 && (
                    <span className="text-[10px] sm:text-xs font-black text-slate-400 italic shrink-0 px-0.5">
                      vs
                    </span>
                  )}
                  <div
                    data-testid={`roster-player-${player.id}`}
                    className="flex-1 min-w-0 bg-white border border-slate-200 rounded-lg sm:rounded-xl p-1 sm:p-2.5 flex items-center gap-1 sm:gap-2 shadow-2xs transition-all"
                  >
                    <div
                      className={`w-6 h-6 sm:w-8 sm:h-8 rounded-md sm:rounded-lg bg-gradient-to-br ${player.colorGradient} flex items-center justify-center text-white text-[10px] sm:text-sm shadow-xs shrink-0`}
                    >
                      {player.avatarIcon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[10px] sm:text-xs font-bold text-slate-800 truncate">
                        {`${player.name}（手札${player.handCount}枚）`}
                      </div>
                      <div className="text-[8px] sm:text-[10px] text-slate-500 font-medium truncate">
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
        <div className="space-y-1.5 sm:space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-[11px] sm:text-sm font-bold text-slate-800 flex items-center gap-1 sm:gap-1.5">
              <Timer className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-algo-blue" />
              <span>持ち時間（ターン制限）を選択</span>
            </label>
            <span className="text-[10px] sm:text-[11px] text-slate-500 font-medium">
              {timeLimit === 0 ? '無制限（じっくり思考）' : `${timeLimit}秒 / 手番`}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-1.5 sm:gap-2.5">
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
                  className={`p-1.5 sm:p-3 rounded-xl sm:rounded-2xl border-2 text-center transition-all flex flex-col items-center justify-center gap-0.5 ${
                    isSelected
                      ? 'border-algo-yellow-dark bg-algo-yellow-light/80 ring-2 sm:ring-4 ring-algo-yellow/30 shadow-xs font-bold text-slate-900'
                      : 'border-slate-200 bg-white hover:border-slate-300 text-slate-700'
                  }`}
                >
                  <span className="text-xs sm:text-base font-black">{item.label}</span>
                  <span className="text-[8px] sm:text-[10px] text-slate-500">{item.desc}</span>
                  <span
                    className={`mt-0.5 text-[7px] sm:text-[8px] px-1 sm:px-1.5 py-0.2 rounded-full font-bold ${
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
        <div className="space-y-1.5 sm:space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-[11px] sm:text-sm font-bold text-slate-800 flex items-center gap-1 sm:gap-1.5">
              <Brain className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-algo-blue" />
              <span>CPUの難易度を選択</span>
            </label>
            <span className="text-[10px] sm:text-[11px] text-slate-500 font-medium">
              {difficulty === 'easy'
                ? '初級：気楽に推理'
                : difficulty === 'normal'
                ? '中級：論理的消去法'
                : '上級：完全消去法'}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-1.5 sm:gap-2.5">
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
                  className={`p-1.5 sm:p-2.5 rounded-xl sm:rounded-2xl border-2 text-center transition-all flex flex-col items-center justify-center ${
                    isSelected
                      ? 'border-algo-blue bg-algo-blue-light/50 ring-2 sm:ring-4 ring-algo-blue/20 shadow-xs font-bold text-slate-900'
                      : 'border-slate-200 bg-white hover:border-slate-300 text-slate-700'
                  }`}
                >
                  <span className="text-xs sm:text-sm font-black">{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 4. アクションボタン（スマホ2段・PC1行構成で視認性と操作性を両立） */}
        <div className="pt-0.5 sm:pt-2 flex flex-col sm:flex-row gap-1.5 sm:gap-3">
          <div className="grid grid-cols-2 gap-1.5 sm:flex sm:gap-3">
            <button
              type="button"
              data-testid="btn-setup-rules"
              onClick={onOpenRules}
              className="py-2 sm:py-3 px-2 sm:px-3.5 rounded-xl sm:rounded-2xl border border-slate-300 text-slate-700 hover:bg-slate-50 font-bold text-xs sm:text-sm flex items-center justify-center gap-1 sm:gap-1.5 transition-all shadow-2xs whitespace-nowrap"
            >
              <BookOpen className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-algo-blue shrink-0" />
              <span>ルールを確認</span>
            </button>

            {onOpenTutorial && (
              <button
                type="button"
                data-testid="btn-setup-tutorial"
                onClick={onOpenTutorial}
                className="py-2 sm:py-3 px-2 sm:px-3.5 rounded-xl sm:rounded-2xl border border-algo-blue/40 bg-algo-blue-light/40 text-algo-navy hover:bg-algo-blue-light/70 font-bold text-xs sm:text-sm flex items-center justify-center gap-1 sm:gap-1.5 transition-all shadow-2xs whitespace-nowrap"
              >
                <GraduationCap className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-algo-blue shrink-0" />
                <span>チュートリアル</span>
              </button>
            )}
          </div>

          <button
            type="button"
            data-testid="btn-start-game"
            onClick={onStartGame}
            className="flex-1 py-2.5 sm:py-3 px-4 sm:px-6 rounded-xl sm:rounded-2xl bg-gradient-to-r from-algo-yellow to-algo-yellow-dark hover:brightness-105 active:scale-98 text-slate-950 font-black text-sm sm:text-base shadow-md shadow-amber-300/40 flex items-center justify-center gap-1.5 sm:gap-2 transition-all border border-amber-300/60"
          >
            <span>対戦を開始する！</span>
            <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
          </button>
        </div>

        {/* バージョン表記 (下部控えめ表示) */}
        <div data-testid="setup-bottom-version" className="pt-1 sm:pt-2 text-center text-[10px] sm:text-xs text-slate-400 font-mono">
          アルゴ（algo）Web バージョン: {getAppVersion()}
        </div>
      </div>
    </div>
  );
};
