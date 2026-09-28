'use client';

import React from 'react';
import { AttackLog } from '../types/game';
import { CheckCircle2, XCircle, ScrollText } from 'lucide-react';

interface GameLogProps {
  logs: AttackLog[];
}

export const GameLog: React.FC<GameLogProps> = ({ logs }) => {
  return (
    <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-4 flex flex-col h-full max-h-72 sm:max-h-96">
      <div className="flex items-center gap-2 pb-3 mb-2 border-b border-zinc-800">
        <ScrollText className="w-4 h-4 text-amber-400" />
        <h4 className="text-sm font-bold text-zinc-200">対戦ログ</h4>
        <span className="text-xs text-zinc-500 ml-auto">{logs.length} 件</span>
      </div>

      <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 text-xs">
        {logs.length === 0 ? (
          <p className="text-zinc-500 text-center py-8">まだアタック履歴はありません</p>
        ) : (
          logs.map((log) => {
            const isPlayer = log.attacker === 'player';
            const isHit = log.isHit;

            return (
              <div
                key={log.id}
                className={`p-2.5 rounded-xl border flex items-start gap-2.5 transition-colors ${
                  isHit
                    ? 'bg-emerald-950/20 border-emerald-800/40 text-emerald-200'
                    : 'bg-zinc-800/40 border-zinc-800 text-zinc-300'
                }`}
              >
                <div className="mt-0.5">
                  {isHit ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <XCircle className="w-4 h-4 text-rose-400" />
                  )}
                </div>

                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between">
                    <span
                      className={`font-bold px-1.5 py-0.5 rounded text-[10px] ${
                        isPlayer
                          ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                          : 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                      }`}
                    >
                      {isPlayer ? 'あなた' : 'CPU'}
                    </span>
                    <span className="text-[10px] text-zinc-500">
                      {isHit ? '的中！' : 'ハズレ'}
                    </span>
                  </div>
                  <p className="text-zinc-200 leading-relaxed">{log.message}</p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
