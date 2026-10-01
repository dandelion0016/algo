'use client';

import React from 'react';
import { Card, PublicCard } from '../types/game';

interface CardComponentProps {
  card: PublicCard | Card;
  isOwner: boolean; // 自分（人間）のカードかどうか（自分なら伏せでも数字が見える）
  isSelected?: boolean;
  isSelectable?: boolean;
  onClick?: () => void;
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  isEliminated?: boolean;
  testId?: string;
}

export const CardComponent: React.FC<CardComponentProps> = ({
  card,
  isOwner,
  isSelected = false,
  isSelectable = false,
  onClick,
  size = 'md',
  label,
  isEliminated = false,
  testId,
}) => {
  const isBlack = card.color === 'black';

  // サイズクラス
  const sizeClasses = {
    sm: 'w-10 h-16 sm:w-12 sm:h-20 text-sm sm:text-base font-bold rounded-lg',
    md: 'w-14 h-22 sm:w-16 sm:h-26 md:w-20 md:h-30 text-lg sm:text-xl md:text-2xl font-black rounded-xl',
    lg: 'w-18 h-28 sm:w-24 sm:h-36 text-2xl sm:text-3xl font-black rounded-2xl',
  }[size];

  // カラーと背景
  // 黒カード: 深みのあるチャコール〜漆黒、洗練された立体感
  // 白カード: ピュアホワイト、上品なソフトシャドウ
  const colorClasses = isBlack
    ? 'bg-gradient-to-b from-zinc-800 via-zinc-900 to-zinc-950 text-white border-zinc-700 shadow-md shadow-zinc-900/40'
    : 'bg-gradient-to-b from-white via-slate-50 to-slate-100 text-zinc-900 border-slate-200 shadow-md shadow-slate-300/50';

  // 状態クラス
  let stateClasses = 'border-2 transition-all duration-200';
  if (isEliminated) {
    stateClasses += ' opacity-40 grayscale';
  } else if (isSelected) {
    stateClasses = 'border-4 border-algo-blue ring-4 ring-algo-blue/40 shadow-xl scale-105 z-10';
  } else if (isSelectable) {
    stateClasses += ' cursor-pointer hover:border-algo-blue hover:scale-105 hover:shadow-lg animate-attack-pulse';
  }

  // 表示判定
  // Information Hiding: card.number が null の場合は一切数字を表示せず「?」を描画
  const showNumber = card.number !== null && (card.isOpen || isOwner);
  const isSecretToOpponent = card.number !== null && !card.isOpen && isOwner;

  const isClickable = Boolean(isSelectable && !isEliminated && onClick);
  const cardTestId = testId || `card-${card.color}-${card.number ?? 'hidden'}`;

  return (
    <div className="flex flex-col items-center gap-1 select-none" data-testid="card-element">
      {label && <span className="text-[10px] sm:text-xs text-slate-500 font-semibold">{label}</span>}
      <div
        data-testid={cardTestId}
        role={isClickable ? 'button' : undefined}
        tabIndex={isClickable ? 0 : undefined}
        aria-label={`${isBlack ? '黒' : '白'}カード ${label || ''}${
          showNumber ? ` (数字: ${card.number})` : ' (伏せカード)'
        }${card.isOpen ? ' [オープン]' : ''}`}
        aria-pressed={isSelected ? true : undefined}
        onClick={isClickable ? onClick : undefined}
        onKeyDown={
          isClickable
            ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onClick?.();
                }
              }
            : undefined
        }
        className={`relative flex flex-col items-center justify-center ${sizeClasses} ${colorClasses} ${stateClasses}`}
      >
        {/* 左上の色識別丸インジケータ */}
        <div
          className={`absolute top-1.5 left-1.5 w-2 h-2 rounded-full border ${
            isBlack
              ? 'bg-zinc-700 border-zinc-500'
              : 'bg-white border-slate-300'
          }`}
        />

        {/* 右上の小さな装飾 */}
        <div
          className={`absolute top-1.5 right-1.5 text-[8px] font-bold opacity-60 ${
            isBlack ? 'text-zinc-400' : 'text-slate-400'
          }`}
        >
          {isBlack ? 'B' : 'W'}
        </div>

        {/* カード中央の数字または「?」 */}
        <div className="flex items-center justify-center">
          {showNumber ? (
            <div className="flex flex-col items-center justify-center">
              <span className="tracking-tight">{card.number}</span>
              {isSecretToOpponent && (
                <span className="text-[8px] sm:text-[9px] px-1 py-0.2 rounded bg-amber-400/20 text-amber-600 font-medium tracking-tight">
                  伏せ中
                </span>
              )}
            </div>
          ) : (
            <span className="text-slate-400 font-serif text-xl sm:text-2xl font-normal opacity-70">
              ?
            </span>
          )}
        </div>

        {/* 表向きのオープンバッジ */}
        {card.isOpen && (
          <div className="absolute bottom-1 right-1 text-[8px] px-1 bg-emerald-500/15 text-emerald-600 rounded font-bold border border-emerald-500/20">
            OPEN
          </div>
        )}
      </div>
    </div>
  );
};
