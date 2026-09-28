'use client';

import React, { useState } from 'react';
import { CardColor } from '../types/game';
import { Sparkles, X } from 'lucide-react';

interface AttackModalProps {
  targetIndex: number;
  targetColor: CardColor;
  onConfirmGuess: (guessedNumber: number) => void;
  onCancel: () => void;
  disabledNumbers?: number[]; // 既にオープンまたは自分の手札にある数字（ヒント）
}

export const AttackModal: React.FC<AttackModalProps> = ({
  targetIndex,
  targetColor,
  onConfirmGuess,
  onCancel,
  disabledNumbers = [],
}) => {
  const [selectedNum, setSelectedNum] = useState<number | null>(null);

  const isBlack = targetColor === 'black';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl max-w-md w-full p-6 text-white shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-400" />
            <h3 className="text-lg font-bold">アタック（数字の推理）</h3>
          </div>
          <button
            onClick={onCancel}
            className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="my-4 text-center">
          <p className="text-sm text-zinc-300">
            相手の左から <span className="font-bold text-amber-400">{targetIndex + 1}</span> 番目の
            <span
              className={`inline-block mx-1 px-2 py-0.5 rounded font-bold text-xs ${
                isBlack
                  ? 'bg-zinc-800 text-white border border-zinc-600'
                  : 'bg-white text-zinc-900 border border-slate-300'
              }`}
            >
              {isBlack ? '黒' : '白'}カード
            </span>
            の数字を推理してください。
          </p>
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
                className={`py-3 rounded-xl font-bold text-lg transition-all flex flex-col items-center justify-center border ${
                  isSelected
                    ? 'bg-amber-500 text-zinc-950 border-amber-400 ring-2 ring-amber-400/50 scale-105 shadow-lg'
                    : isKnown
                    ? 'bg-zinc-800/40 text-zinc-500 border-zinc-800 hover:border-zinc-700'
                    : 'bg-zinc-800 text-zinc-100 border-zinc-700 hover:bg-zinc-700 hover:border-zinc-500'
                }`}
              >
                <span>{num}</span>
                {isKnown && (
                  <span className="text-[9px] text-zinc-500 font-normal">確認済</span>
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
            className="flex-1 py-2.5 rounded-xl border border-zinc-700 text-zinc-300 hover:bg-zinc-800 font-medium transition-colors"
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
            className={`flex-1 py-2.5 rounded-xl font-bold transition-all shadow-md ${
              selectedNum !== null
                ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-zinc-950 hover:brightness-110 shadow-amber-500/20'
                : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
            }`}
          >
            {selectedNum !== null ? `[ ${selectedNum} ] でアタック！` : '数字を選択してください'}
          </button>
        </div>
      </div>
    </div>
  );
};
