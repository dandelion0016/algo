'use client';

import React, { useState, useEffect, useRef } from 'react';
import { CardColor } from '../types/game';
import { formatCandidateRange, formatFailedNumbersBadge } from '../lib/candidateAssist';
import { Sparkles, X, Target } from 'lucide-react';

interface AttackModalProps {
  targetPlayerName: string;
  targetIndex: number;
  targetColor: CardColor;
  onConfirmGuess: (guessedNumber: number) => void;
  onCancel: () => void;
  disabledNumbers?: number[]; // 既にオープンまたは自分の手札にある数字
  possibleNumbers?: number[]; // 推理候補数字リスト (Issue #42)
  assistEnabled?: boolean;    // 初心者アシスト有効フラグ (Issue #42)
  failedNumbers?: number[];   // そのカードに対して過去に外れた数字リスト (Issue #43)
}

export const AttackModal: React.FC<AttackModalProps> = ({
  targetPlayerName,
  targetIndex,
  targetColor,
  onConfirmGuess,
  onCancel,
  disabledNumbers = [],
  possibleNumbers,
  assistEnabled = true,
  failedNumbers = [],
}) => {
  const [selectedNum, setSelectedNum] = useState<number | null>(null);
  const inputBufferRef = useRef<string>('');
  const bufferTimerRef = useRef<NodeJS.Timeout | null>(null);

  const isBlack = targetColor === 'black';

  // タイマーのアンマウント時クリーンアップ
  useEffect(() => {
    return () => {
      if (bufferTimerRef.current) {
        clearTimeout(bufferTimerRef.current);
      }
    };
  }, []);

  // キーボードアクセシビリティ: 数字キー(0〜11, 2桁バッファリング, テンキー)、矢印キー、Enter、Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (bufferTimerRef.current) {
          clearTimeout(bufferTimerRef.current);
        }
        inputBufferRef.current = '';
        onCancel();
        return;
      }

      if (e.key === 'Enter') {
        if (selectedNum !== null) {
          e.preventDefault();
          if (bufferTimerRef.current) {
            clearTimeout(bufferTimerRef.current);
          }
          inputBufferRef.current = '';
          onConfirmGuess(selectedNum);
        }
        return;
      }

      // 矢印キー操作 (ArrowLeft / ArrowRight / ArrowUp / ArrowDown)
      // グリッドは 4列 (0〜3, 4〜7, 8〜11)
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
        e.preventDefault();
        if (bufferTimerRef.current) {
          clearTimeout(bufferTimerRef.current);
        }
        inputBufferRef.current = '';

        setSelectedNum((prev) => {
          if (prev === null) {
            return 0;
          }
          switch (e.key) {
            case 'ArrowLeft':
              return Math.max(0, prev - 1);
            case 'ArrowRight':
              return Math.min(11, prev + 1);
            case 'ArrowUp':
              return prev - 4 >= 0 ? prev - 4 : prev;
            case 'ArrowDown':
              return prev + 4 <= 11 ? prev + 4 : prev;
            default:
              return prev;
          }
        });
        return;
      }

      // 数字キー (0〜9) またはテンキー (Numpad0〜Numpad9)
      let digit: number | null = null;
      if (e.key >= '0' && e.key <= '9') {
        digit = parseInt(e.key, 10);
      } else if (e.code && e.code.startsWith('Numpad') && e.code.length === 7) {
        const parsed = parseInt(e.code.slice(6), 10);
        if (!isNaN(parsed) && parsed >= 0 && parsed <= 9) {
          digit = parsed;
        }
      }

      if (digit !== null) {
        // 2桁数字入力のバッファリング
        // 直前の入力が '1' で、続いて '0' または '1' が入力された場合は「10」または「11」を選択
        if (inputBufferRef.current === '1' && (digit === 0 || digit === 1)) {
          if (bufferTimerRef.current) {
            clearTimeout(bufferTimerRef.current);
          }
          inputBufferRef.current = '';
          const num = digit === 0 ? 10 : 11;
          setSelectedNum(num);
        } else if (digit === 1) {
          // '1' が押されたらまず '1' を選択し、600ms の猶予で2桁目入力を待機
          setSelectedNum(1);
          inputBufferRef.current = '1';
          if (bufferTimerRef.current) {
            clearTimeout(bufferTimerRef.current);
          }
          bufferTimerRef.current = setTimeout(() => {
            inputBufferRef.current = '';
          }, 600);
        } else {
          // '0' または '2'〜'9' の場合、即座に選択＆バッファクリア
          if (bufferTimerRef.current) {
            clearTimeout(bufferTimerRef.current);
          }
          inputBufferRef.current = '';
          setSelectedNum(digit);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedNum, onCancel, onConfirmGuess]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="attack-modal-title"
      data-testid="attack-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4"
    >
      <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-6 text-slate-800 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-algo-blue/15 text-algo-blue flex items-center justify-center">
              <Target className="w-5 h-5 text-algo-blue" />
            </div>
            <h3 id="attack-modal-title" className="text-lg font-black text-slate-900">
              アタック（数字の推理）
            </h3>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="モーダルを閉じる"
            data-testid="btn-close-attack-modal"
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

          {/* 初心者アシスト表示 (Issue #42) */}
          {assistEnabled && possibleNumbers && (
            <div
              data-testid="attack-assist-hint"
              className="mt-2.5 py-1.5 px-3 rounded-xl bg-amber-50/90 border border-amber-200 text-amber-900 text-xs font-bold flex items-center justify-between shadow-2xs"
            >
              <span className="flex items-center gap-1.5">
                <span aria-hidden="true">🔰</span>
                <span>推理候補範囲:</span>
              </span>
              <span className="font-black text-sm text-algo-navy">
                {formatCandidateRange(possibleNumbers)}
                <span className="text-[10px] text-amber-700 ml-1.5 font-bold">
                  ({possibleNumbers.length}通り)
                </span>
              </span>
            </div>
          )}

          {/* 過去の外れ数字サマリ (Issue #43: ミスアタック再宣言防止) */}
          {failedNumbers.length > 0 && (
            <div
              data-testid="attack-failed-numbers-hint"
              className="mt-2 py-1 px-3 rounded-xl bg-rose-50/90 border border-rose-200 text-rose-900 text-xs font-bold flex items-center justify-between shadow-2xs"
            >
              <span className="flex items-center gap-1.5">
                <span aria-hidden="true" className="text-rose-500 font-black">✕</span>
                <span>過去の外れ宣言:</span>
              </span>
              <span className="font-black text-sm text-rose-600">
                {formatFailedNumbersBadge(failedNumbers)}
              </span>
            </div>
          )}
        </div>

        {/* 0〜11 の数字選択ボタン */}
        <div className="grid grid-cols-4 gap-2.5 my-5" role="group" aria-label="推理する数字の選択">
          {Array.from({ length: 12 }, (_, i) => i).map((num) => {
            const isKnown = disabledNumbers.includes(num);
            const isFailed = failedNumbers.includes(num);
            const isSelected = selectedNum === num;
            const isPossible = !possibleNumbers || possibleNumbers.includes(num);
            const isImpossible = Boolean(assistEnabled && possibleNumbers && !isPossible);

            return (
              <button
                key={num}
                type="button"
                data-testid={`btn-guess-num-${num}`}
                data-candidate-out={isImpossible ? 'true' : undefined}
                data-failed-guess={isFailed ? 'true' : undefined}
                aria-label={`数字 ${num}${isFailed ? ' (✕ハズレ済)' : isKnown ? ' (確認済)' : ''}`}
                aria-pressed={isSelected}
                onClick={() => setSelectedNum(num)}
                className={`py-3 rounded-2xl font-black text-lg transition-all flex flex-col items-center justify-center border-2 ${
                  isSelected
                    ? isFailed
                      ? 'bg-rose-100 text-rose-950 border-rose-400 ring-4 ring-rose-300/50 scale-105 shadow-md'
                      : 'bg-algo-yellow text-slate-950 border-algo-yellow-dark ring-4 ring-algo-yellow/40 scale-105 shadow-md'
                    : isFailed
                    ? 'bg-rose-50/70 text-rose-700 border-rose-300 opacity-80 hover:opacity-100 hover:border-rose-400'
                    : isImpossible
                    ? 'bg-slate-100/50 text-slate-400 border-dashed border-slate-300 opacity-60 hover:opacity-90 hover:border-slate-400'
                    : isKnown
                    ? 'bg-slate-100/70 text-slate-400 border-slate-200 hover:border-slate-300'
                    : 'bg-white text-slate-800 border-slate-200 hover:border-algo-blue hover:bg-algo-blue-light/30'
                }`}
              >
                <span
                  className={
                    isFailed
                      ? 'line-through decoration-rose-500 decoration-2 text-rose-500'
                      : isImpossible
                      ? 'line-through decoration-slate-400/80'
                      : ''
                  }
                >
                  {num}
                </span>
                {isFailed ? (
                  <span
                    className="text-[8px] text-rose-600 font-bold"
                    data-testid={`failed-badge-${num}`}
                  >
                    ✕ハズレ済
                  </span>
                ) : isImpossible ? (
                  <span className="text-[8px] text-rose-500 font-bold">候補外</span>
                ) : isKnown ? (
                  <span className="text-[8px] text-slate-400 font-bold">確認済</span>
                ) : null}
              </button>
            );
          })}
        </div>

        {/* アクションボタン */}
        <div className="flex gap-3 mt-6">
          <button
            type="button"
            onClick={onCancel}
            data-testid="btn-cancel-attack"
            aria-label="キャンセル"
            className="flex-1 py-3 rounded-2xl border border-slate-200 text-slate-600 hover:bg-slate-100 font-bold text-sm transition-colors"
          >
            キャンセル
          </button>
          <button
            type="button"
            disabled={selectedNum === null}
            data-testid="btn-confirm-attack"
            aria-label={
              selectedNum !== null
                ? `数字 ${selectedNum} でアタックを実行`
                : '数字を選んでアタックを実行'
            }
            onClick={() => {
              if (selectedNum !== null) {
                onConfirmGuess(selectedNum);
              }
            }}
            className={`flex-1 py-3 rounded-2xl font-black text-sm transition-all shadow-md ${
              selectedNum !== null
                ? failedNumbers.includes(selectedNum)
                  ? 'bg-gradient-to-r from-rose-500 to-rose-700 text-white hover:brightness-105 shadow-rose-500/30 active:scale-98'
                  : 'bg-gradient-to-r from-algo-blue to-algo-blue-dark text-white hover:brightness-105 shadow-algo-blue/30 active:scale-98'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            {selectedNum !== null
              ? failedNumbers.includes(selectedNum)
                ? `[ ${selectedNum} ] でアタック！ (⚠️ハズレ済)`
                : assistEnabled && possibleNumbers && !possibleNumbers.includes(selectedNum)
                ? `[ ${selectedNum} ] でアタック！ (⚠️候補外)`
                : `[ ${selectedNum} ] でアタック！`
              : '数字を選んでください'}
          </button>
        </div>
      </div>
    </div>
  );
};
