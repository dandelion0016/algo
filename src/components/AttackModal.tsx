'use client';

import React, { useState } from 'react';
import { CardColor } from '../types/game';
import { Sparkles, X, Target } from 'lucide-react';

interface AttackModalProps {
  targetPlayerName: string;
  targetIndex: number;
  targetColor: CardColor;
  onConfirmGuess: (guessedNumber: number) => void;
  onCancel: () => void;
  disabledNumbers?: number[]; // 既にオープンまたは自分の手札にある数字
}

export const AttackModal: React.FC<AttackModalProps> = ({
  targetPlayerName,
  targetIndex,
  targetColor,
  onConfirmGuess,
  onCancel,
  disabledNumbers = [],
}) => {
  const [selectedNum, setSelectedNum] = useState<number | null>(null);

  const isBlack = targetColor === 'black';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-6 text-slate-800 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-algo-blue/15 text-algo-blue flex items-center justify-center">
              <Target className="w-5 h-5 text-algo-blue" />
            </div>
            <h3 className="text-lg font-black text-slate-900">アタック（数字の推理）</h3>
          </div>
          <button
            onClick={onCancel}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Target Info */}
        <div className="my-4 text-center p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl">
          <p className="text-xs text-slate-600 font-semibold mb-1">
            ターゲット: <span className="text-slate-900 font-black">{targetPlayerName}</span>
          </p>
          <div className="flex items-center justify-center gap-2">
            <span className="text-sm font-bold text-slate-700">
              左から <strong className="text-algo-blue text-base">{targetIndex + 1}</strong> 番目の
            </span>
            <span
              className={`px-2.5 py-0.5 rounded-lg font-black text-xs border ${
                isBlack
                  ? 'bg-zinc-900 text-white border-zinc-700'
                  : 'bg-white text-zinc-900 border-slate-300'
              }`}
            >
              {isBlack ? '黒カード' : '白カード'}
            </span>
          </div>
        </div>

        {/* 0〜11 の数字選択ボタン */}
        <div className="grid grid-cols-4 gap-2.5 my-5">
          {Array.from({ length: 12 }, (_, i) => i).map((num) => {
            const isKnown = disabledNumbers.includes(num);
            const isSelected = selectedNum === num;

            return (
              <button
                key={num}
                type="button"
                onClick={() => setSelectedNum(num)}
                className={`py-3 rounded-2xl font-black text-lg transition-all flex flex-col items-center justify-center border-2 ${
                  isSelected
                    ? 'bg-algo-yellow text-slate-950 border-algo-yellow-dark ring-4 ring-algo-yellow/40 scale-105 shadow-md'
                    : isKnown
                    ? 'bg-slate-100/70 text-slate-400 border-slate-200 hover:border-slate-300'
                    : 'bg-white text-slate-800 border-slate-200 hover:border-algo-blue hover:bg-algo-blue-light/30'
                }`}
              >
                <span>{num}</span>
                {isKnown && (
                  <span className="text-[8px] text-slate-400 font-bold">確認済</span>
                )}
              </button>
            );
          })}
        </div>

        {/* アクションボタン */}
        <div className="flex gap-3 mt-6">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-3 rounded-2xl border border-slate-200 text-slate-600 hover:bg-slate-100 font-bold text-sm transition-colors"
          >
            キャンセル
          </button>
          <button
            type="button"
            disabled={selectedNum === null}
            onClick={() => {
              if (selectedNum !== null) {
                onConfirmGuess(selectedNum);
              }
            }}
            className={`flex-1 py-3 rounded-2xl font-black text-sm transition-all shadow-md ${
              selectedNum !== null
                ? 'bg-gradient-to-r from-algo-blue to-algo-blue-dark text-white hover:brightness-105 shadow-algo-blue/30 active:scale-98'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            {selectedNum !== null ? `[ ${selectedNum} ] でアタック！` : '数字を選んでください'}
          </button>
        </div>
      </div>
    </div>
  );
};
