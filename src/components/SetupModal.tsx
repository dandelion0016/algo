'use client';

import React from 'react';
import { PlayerCount, Difficulty, TimeLimit } from '../types/game';
import { Users, Brain, Timer, BookOpen, ArrowRight, Sparkles } from 'lucide-react';

interface SetupModalProps {
  playerCount: PlayerCount;
  difficulty: Difficulty;
  timeLimit: TimeLimit;
  onSelectPlayerCount: (count: PlayerCount) => void;
  onSelectDifficulty: (diff: Difficulty) => void;
  onSelectTimeLimit: (limit: TimeLimit) => void;
  onStartGame: () => void;
  onOpenRules: () => void;
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
}) => {
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
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                algo <span className="text-xs px-2.5 py-0.5 rounded-full bg-algo-blue text-white font-bold">Web対戦</span>
              </h2>
              <p className="text-xs text-slate-600 font-medium">
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
                : '初期手札 各2枚 (4人乱戦)'}
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
              { limit: 30 as TimeLimit, label: '30秒', desc: '標準テンポ', badge: 'おすすめ' },
              { limit: 15 as TimeLimit, label: '15秒', desc: '早指しスピーディ', badge: 'スリリング' },
              { limit: 0 as TimeLimit, label: '無制限', desc: 'じっくり長考', badge: 'マイペース' },
            ].map((item) => {
              const isSelected = timeLimit === item.limit;
              return (
                <button
                  key={item.limit}
                  type="button"
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
        <div className="pt-2 flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={onOpenRules}
            className="sm:w-1/3 py-3 px-4 rounded-2xl border border-slate-300 text-slate-700 hover:bg-slate-50 font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all shadow-2xs"
          >
            <BookOpen className="w-4 h-4 text-algo-blue" />
            <span>ルールを確認</span>
          </button>

          <button
            type="button"
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
