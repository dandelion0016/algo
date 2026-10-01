'use client';

import React, { useState } from 'react';
import { AttackLog, Player } from '../types/game';
import { getFailedNumbersForCard, formatFailedNumbersBadge } from '../lib/candidateAssist';
import { CheckCircle2, XCircle, ScrollText, ClipboardList } from 'lucide-react';

interface GameLogProps {
  logs: AttackLog[];
  players?: Player[];
  initialTab?: 'logs' | 'memo';
}

export const GameLog: React.FC<GameLogProps> = ({ logs, players = [], initialTab = 'logs' }) => {
  const [activeTab, setActiveTab] = useState<'logs' | 'memo'>(initialTab);

  // 人間以外の対戦相手プレイヤー（推理対象）
  const opponents = players.filter((p) => !p.isHuman);

  return (
    <div
      data-testid="game-log-list"
      role="region"
      aria-label="対戦ログ"
      className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm flex flex-col h-full max-h-72 lg:max-h-120"
    >
      {/* Header with Tabs */}
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
        <div className="flex items-center gap-1.5 p-1 bg-slate-100/80 rounded-2xl">
          <button
            type="button"
            data-testid="tab-game-logs"
            onClick={() => setActiveTab('logs')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs transition-all ${
              activeTab === 'logs'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <ScrollText className="w-3.5 h-3.5 text-algo-blue" />
            <span>対戦ログ</span>
            <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded-full">
              {logs.length}
            </span>
          </button>

          <button
            type="button"
            data-testid="tab-memo-board"
            onClick={() => setActiveTab('memo')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs transition-all ${
              activeTab === 'memo'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <ClipboardList className="w-3.5 h-3.5 text-emerald-600" />
            <span>推理メモ</span>
          </button>
        </div>

        <span className="text-[11px] font-bold text-slate-400">
          {activeTab === 'logs' ? `${logs.length} 件` : 'ミスアタック防止'}
        </span>
      </div>

      {/* Tab 1: 対戦ログ (Timeline) */}
      {activeTab === 'logs' && (
        <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 text-xs" tabIndex={0} aria-live="polite">
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
                        <div className="flex items-center gap-1.5">
                          {!isHit && (
                            <span className="text-[9px] font-bold text-rose-600 bg-rose-50 border border-rose-200 px-1 rounded">
                              {`#${log.targetCardIndex + 1} ${log.targetColor === 'black' ? '黒' : '白'} ✕${log.guessedNumber}`}
                            </span>
                          )}
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
      )}

      {/* Tab 2: 推理メモボード (Memo Board / Issue #43) */}
      {activeTab === 'memo' && (
        <div
          data-testid="attack-memo-board"
          className="flex-1 overflow-y-auto space-y-3.5 pr-1 text-xs"
          tabIndex={0}
        >
          {opponents.length === 0 ? (
            <div className="text-center py-10 text-slate-400 space-y-1">
              <p className="font-bold">対戦相手の情報がありません</p>
              <p className="text-[11px]">対戦開始後に推理メモが自動記録されます</p>
            </div>
          ) : (
            opponents.map((opp) => (
              <div
                key={opp.id}
                className="p-3 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-2.5"
              >
                <div className="flex items-center justify-between border-b border-slate-200/60 pb-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="font-black text-slate-800">{opp.name}</span>
                    {opp.isEliminated && (
                      <span className="text-[9px] bg-slate-200 text-slate-600 px-1.5 py-0.2 rounded font-bold">
                        脱落
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-500 font-medium">
                    手札 {opp.cards.length}枚
                  </span>
                </div>

                {/* カードごとの外れ数字一覧 */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {opp.cards.map((card, idx) => {
                    const failedNums = getFailedNumbersForCard(logs, opp.id, idx);
                    const isBlack = card.color === 'black';

                    return (
                      <div
                        key={card.id}
                        className={`p-2 rounded-xl border flex flex-col gap-1 transition-all ${
                          card.isOpen
                            ? 'bg-slate-100/60 border-slate-200 text-slate-400'
                            : 'bg-white border-slate-200 shadow-2xs'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-700 text-[11px]">
                            {`#${idx + 1}`}
                          </span>
                          <span
                            className={`px-1.5 py-0.2 rounded text-[9px] font-black border ${
                              isBlack
                                ? 'bg-zinc-800 text-white border-zinc-600'
                                : 'bg-white text-zinc-800 border-slate-300'
                            }`}
                          >
                            {isBlack ? '黒' : '白'}
                          </span>
                          {card.isOpen ? (
                            <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-1 rounded">
                              {`OPEN (${card.number})`}
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400 font-medium">
                              伏せ
                            </span>
                          )}
                        </div>

                        {/* 失敗数字表示 */}
                        <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                          <span className="text-[10px] text-slate-500">外れ履歴:</span>
                          {failedNums.length > 0 ? (
                            <span
                              data-testid={`memo-failed-${opp.id}-${idx}`}
                              className="font-black text-rose-600 bg-rose-50 border border-rose-200 px-1.5 py-0.2 rounded text-[10px]"
                            >
                              {formatFailedNumbersBadge(failedNums)}
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400 italic">なし</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
