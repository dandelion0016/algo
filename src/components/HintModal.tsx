'use client';

import React from 'react';
import { Lightbulb, Target, CheckCircle2, Sparkles, X } from 'lucide-react';
import { HintResult } from '../lib/hintAdvisor';

export interface HintModalProps {
  isOpen: boolean;
  onClose: () => void;
  hint: HintResult | null;
  remainingHints: number;
  onSelectTarget?: (playerId: string, cardIndex: number) => void;
  canSelectTarget?: boolean;
}

export const HintModal: React.FC<HintModalProps> = ({
  isOpen,
  onClose,
  hint,
  remainingHints,
  onSelectTarget,
  canSelectTarget = false,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-150"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="hint-modal-title"
    >
      <div
        data-testid="modal-hint"
        className="bg-white border border-amber-200 rounded-3xl max-w-md w-full overflow-hidden text-slate-800 shadow-2xl animate-in zoom-in-95 duration-150 relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* パステル調ヘッダーバー */}
        <div className="w-full h-3 bg-gradient-to-r from-amber-300 via-amber-400 to-algo-yellow border-b border-amber-200" />

        <div className="p-5 sm:p-6 space-y-4">
          {/* タイトル部 */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-amber-100 border border-amber-300 text-amber-800 flex items-center justify-center shadow-xs shrink-0">
                <Lightbulb className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h3 id="hint-modal-title" className="text-base sm:text-lg font-black text-slate-900 tracking-tight flex items-center gap-1.5">
                  AIヒント
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                    {`残り${remainingHints}回`}
                  </span>
                </h3>
                <p className="text-xs text-slate-500 font-medium">手詰まり時の次の一手・安全アタック先</p>
              </div>
            </div>
            <button
              type="button"
              data-testid="btn-close-hint-x"
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 p-1 rounded-xl hover:bg-slate-100 transition-colors"
              aria-label="閉じる"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* ヒント本文 */}
          {hint ? (
            <div className="space-y-4">
              {/* アドバイスボックス */}
              <div className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50/50 border border-amber-200 shadow-2xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded-md border border-amber-200">
                    <Sparkles className="w-3 h-3 text-amber-600" />
                    AIアドバイス
                  </span>
                  {hint.isDefinite ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-black text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-300">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      100% 確定！
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-black text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                      {`的中率 約${Math.round((1 / hint.possibleNumbers.length) * 100)}%`}
                    </span>
                  )}
                </div>

                <p data-testid="hint-advice-text" className="text-sm sm:text-base font-black text-slate-900 leading-snug">
                  {hint.adviceText}
                </p>
              </div>

              {/* カード詳細と候補数字 */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-600">推奨アタック先:</span>
                  <span className="font-black text-slate-900">
                    {`${hint.targetPlayerName} （${hint.color === 'black' ? '黒' : '白'}カード #${hint.targetCardIndex + 1}）`}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-600">取りうる候補数字:</span>
                  <div className="flex flex-wrap gap-1" data-testid="hint-possible-numbers">
                    {hint.possibleNumbers.map((num) => (
                      <span
                        key={num}
                        className={`inline-flex items-center justify-center w-6 h-6 rounded-lg font-black text-xs shadow-2xs border ${
                          hint.color === 'black'
                            ? 'bg-zinc-900 text-white border-zinc-700'
                            : 'bg-white text-zinc-900 border-slate-300'
                        }`}
                      >
                        {num}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* アクションボタン */}
              <div className="flex gap-2 pt-1">
                {canSelectTarget && onSelectTarget && (
                  <button
                    type="button"
                    data-testid="btn-hint-select-target"
                    onClick={() => {
                      onSelectTarget(hint.targetPlayerId, hint.targetCardIndex);
                      onClose();
                    }}
                    className="flex-1 py-2.5 px-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-black text-xs sm:text-sm shadow-md transition-all flex items-center justify-center gap-1.5"
                  >
                    <Target className="w-4 h-4" />
                    <span>このカードを選択する</span>
                  </button>
                )}
                <button
                  type="button"
                  data-testid="btn-close-hint"
                  onClick={onClose}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs sm:text-sm transition-all"
                >
                  閉じる
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4 py-2">
              <p className="text-sm text-slate-600 font-medium text-center">
                現在、相手の手札に推理可能な伏せカードがありません。
              </p>
              <button
                type="button"
                data-testid="btn-close-hint"
                onClick={onClose}
                className="w-full py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs sm:text-sm transition-all"
              >
                閉じる
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
