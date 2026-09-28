'use client';

import React from 'react';
import { AttackLog } from '../types/game';
import { CheckCircle2, XCircle, ScrollText } from 'lucide-react';

interface GameLogProps {
  logs: AttackLog[];
}

export const GameLog: React.FC<GameLogProps> = ({ logs }) => {
  return (
    <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm flex flex-col h-full max-h-72 lg:max-h-120">
      <div className="flex items-center gap-2 pb-3 mb-3 border-b border-slate-100">
        <div className="w-7 h-7 rounded-xl bg-algo-blue/15 text-algo-blue flex items-center justify-center">
          <ScrollText className="w-4 h-4 text-algo-blue" />
        </div>
        <h4 className="text-sm font-black text-slate-800">対戦ログ</h4>
        <span className="text-xs font-bold text-slate-400 ml-auto">{logs.length} 件</span>
      </div>

      <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 text-xs">
        {logs.length === 0 ? (
          <div className="text-center py-10 text-slate-400 space-y-1">
            <p className="font-bold">まだアタック履歴はありません</p>
            <p className="text-[11px]">手番が進むとここに履歴が表示されます</p>
          </div>
        ) : (
          logs.map((log) => {
            const isHit = log.isHit;
            const isPlayerAttacker = log.attackerId === 'player';

            return (
              <div
                key={log.id}
                className={`p-3 rounded-2xl border transition-all ${
                  isHit
                    ? 'bg-emerald-50/70 border-emerald-200/80 text-emerald-950'
                    : 'bg-slate-50 border-slate-200/60 text-slate-700'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <div className="mt-0.5">
                    {isHit ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <XCircle className="w-4 h-4 text-rose-500 shrink-0" />
                    )}
                  </div>

                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <span
                        className={`font-black px-2 py-0.5 rounded-md text-[10px] ${
                          isPlayerAttacker
                            ? 'bg-algo-blue text-white'
                            : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {log.attackerName}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          isHit
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-rose-100 text-rose-700'
                        }`}
                      >
                        {isHit ? '的中！' : 'ハズレ'}
                      </span>
                    </div>
                    <p className="text-slate-800 font-medium leading-relaxed">
                      {log.message}
                    </p>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
