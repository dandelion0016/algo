'use client';

import React from 'react';
import { Card } from '../types/game';

interface CardComponentProps {
  card: Card;
  isOwner: boolean; // プレイヤー自身のカードかどうか（自分なら裏向きでも数字が見える）
  isSelected?: boolean;
  isSelectable?: boolean;
  onClick?: () => void;
  size?: 'sm' | 'md' | 'lg';
  label?: string;
}

export const CardComponent: React.FC<CardComponentProps> = ({
  card,
  isOwner,
  isSelected = false,
  isSelectable = false,
  onClick,
  size = 'md',
  label,
}) => {
  const isBlack = card.color === 'black';

  // サイズクラス
  const sizeClasses = {
    sm: 'w-12 h-18 text-base font-bold rounded-md',
    md: 'w-16 h-24 sm:w-20 sm:h-28 text-xl sm:text-2xl font-extrabold rounded-lg',
    lg: 'w-20 h-30 sm:w-24 sm:h-34 text-2xl sm:text-3xl font-black rounded-xl',
  }[size];

  // カラーと背景
  const colorClasses = isBlack
    ? 'bg-gradient-to-br from-zinc-800 to-zinc-950 text-white border-zinc-600 shadow-zinc-900/50'
    : 'bg-gradient-to-br from-white to-slate-100 text-zinc-900 border-slate-300 shadow-slate-300/50';

  // 選択時・選択可能時の枠線スタイル
  let stateClasses = 'border-2';
  if (isSelected) {
    stateClasses = 'border-4 border-amber-400 ring-4 ring-amber-400/40 shadow-xl scale-105';
  } else if (isSelectable) {
    stateClasses += ' cursor-pointer hover:border-amber-400 hover:scale-105 transition-all duration-150 hover:shadow-lg animate-pulse';
  }

  // 表示する数字の決定
  // 1. 表向き(isOpen): 全員に数字が見える
  // 2. 裏向き(!isOpen) かつ 自分(isOwner): 自分には数字が見える（ただし伏せ中表示）
  // 3. 裏向き(!isOpen) かつ 相手(!isOwner): 「?」表示
  const showNumber = card.isOpen || isOwner;
  const isSecretToOpponent = !card.isOpen && isOwner;

  return (
    <div className="flex flex-col items-center gap-1 select-none">
      {label && <span className="text-xs text-zinc-400 font-medium">{label}</span>}
      <div
        onClick={isSelectable ? onClick : undefined}
        className={`relative flex flex-col items-center justify-center shadow-md transition-transform ${sizeClasses} ${colorClasses} ${stateClasses}`}
      >
        {/* カード左上の色インジケータ */}
        <div
          className={`absolute top-1.5 left-1.5 w-2 h-2 rounded-full ${
            isBlack ? 'bg-zinc-400' : 'bg-slate-400'
          }`}
        />

        {/* カード中央の数字または「?」 */}
        <div className="flex items-center justify-center">
          {showNumber ? (
            <div className="flex flex-col items-center">
              <span>{card.number}</span>
              {isSecretToOpponent && (
                <span className="text-[10px] tracking-tight text-amber-500 font-normal">
                  (伏せ)
                </span>
              )}
            </div>
          ) : (
            <span className="text-zinc-500 font-serif text-2xl">?</span>
          )}
        </div>

        {/* 表向きのオープンバッジ */}
        {card.isOpen && (
          <div className="absolute bottom-1 right-1 text-[9px] px-1 bg-emerald-500/20 text-emerald-400 rounded border border-emerald-500/30">
            OPEN
          </div>
        )}
      </div>
    </div>
  );
};
