'use client';

import React from 'react';
import Image from 'next/image';
import { PlayerCount, Difficulty } from '../types/game';
import { Users, Brain, Sparkles, BookOpen, ArrowRight } from 'lucide-react';

interface SetupModalProps {
  playerCount: PlayerCount;
  difficulty: Difficulty;
  onSelectPlayerCount: (count: PlayerCount) => void;
  onSelectDifficulty: (diff: Difficulty) => void;
  onStartGame: () => void;
  onOpenRules: () => void;
}

export const SetupModal: React.FC<SetupModalProps> = ({
  playerCount,
  difficulty,
  onSelectPlayerCount,
  onSelectDifficulty,
  onStartGame,
  onOpenRules,
}) => {
  return (
    <div className="max-w-2xl mx-auto bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
      {/* Hero Banner Header */}
      <div className="relative w-full h-44 sm:h-56 bg-gradient-to-r from-algo-yellow/30 via-algo-blue/20 to-algo-yellow/20 overflow-hidden border-b border-slate-200">
        <div className="absolute inset-0 flex items-center justify-center">
          <img
            src="/hero-banner.jpg"
            alt="algo banner"
            className="w-full h-full object-cover object-center"
          />
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-white/90 via-transparent to-transparent flex items-end p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl overflow-hidden shadow-md border-2 border-white bg-white">
              <img src="/app-icon.jpg" alt="algo icon" className="w-full h-full object-cover" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                algo <span className="text-xs px-2.5 py-0.5 rounded-full bg-algo-blue text-white font-bold">Web対戦</span>
              </h2>
              <p className="text-xs text-slate-600 font-medium">
                算数オリンピック・ピーターフランクル氏ら開発の頭脳派推理ゲーム
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Settings Form */}
      <div className="p-6 sm:p-8 space-y-6">
        {/* 1. 参加人数選択 (2〜4人) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Users className="w-4 h-4 text-algo-blue" />
              <span>対戦人数を選択 (2〜4人)</span>
            </label>
            <span className="text-xs text-slate-500 font-medium">
              {playerCount === 2
                ? '初期手札 各4枚 (タイマン勝負)'
                : playerCount === 3
                ? '初期手札 各3枚 (三つ巴)'
                : '初期手札 各2枚 (4人乱戦)'}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-3">
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
                  className={`p-4 rounded-2xl border-2 text-center transition-all flex flex-col items-center justify-center gap-1 ${
                    isSelected
                      ? 'border-algo-blue bg-algo-blue-light/50 ring-4 ring-algo-blue/20 shadow-sm scale-102 font-bold text-algo-navy'
                      : 'border-slate-200 bg-white hover:border-slate-300 text-slate-700'
                  }`}
                >
                  <span className="text-base sm:text-lg font-black">{item.label}</span>
                  <span className="text-[10px] sm:text-xs text-slate-500">{item.sub}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. CPU難易度選択 (初級・中級・上級) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Brain className="w-4 h-4 text-algo-blue" />
              <span>CPUの難易度を選択</span>
            </label>
            <span className="text-xs text-slate-500 font-medium">
              {difficulty === 'easy'
                ? '初級：気楽に推理を楽しみたい方向け'
                : difficulty === 'normal'
                ? '中級：公式ルール通りの論理推理'
                : '上級：完全消去法・極限の思考戦'}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {[
              { diff: 'easy' as Difficulty, label: '初級 (Easy)', badge: 'おすすめ' },
              { diff: 'normal' as Difficulty, label: '中級 (Normal)', badge: '標準' },
              { diff: 'hard' as Difficulty, label: '上級 (Hard)', badge: '挑戦' },
            ].map((item) => {
              const isSelected = difficulty === item.diff;
              return (
                <button
                  key={item.diff}
                  type="button"
                  onClick={() => onSelectDifficulty(item.diff)}
                  className={`p-3.5 rounded-2xl border-2 text-center transition-all flex flex-col items-center justify-center gap-1 relative ${
                    isSelected
                      ? 'border-algo-yellow-dark bg-algo-yellow-light/60 ring-4 ring-algo-yellow/30 shadow-sm scale-102 font-bold text-slate-900'
                      : 'border-slate-200 bg-white hover:border-slate-300 text-slate-700'
                  }`}
                >
                  <span className="text-sm sm:text-base font-black">{item.label}</span>
                  <span
                    className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${
                      isSelected
                        ? 'bg-amber-400 text-slate-950'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {item.badge}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 3. アクションボタン */}
        <div className="pt-2 flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={onOpenRules}
            className="sm:w-1/3 py-3.5 px-4 rounded-2xl border border-slate-300 text-slate-700 hover:bg-slate-50 font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-sm"
          >
            <BookOpen className="w-4 h-4 text-algo-blue" />
            <span>ルールを確認</span>
          </button>

          <button
            type="button"
            onClick={onStartGame}
            className="flex-1 py-3.5 px-6 rounded-2xl bg-gradient-to-r from-algo-yellow to-algo-yellow-dark hover:brightness-105 active:scale-98 text-slate-950 font-black text-base shadow-lg shadow-amber-300/40 flex items-center justify-center gap-2 transition-all border border-amber-300/60"
          >
            <span>対戦を開始する！</span>
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};
