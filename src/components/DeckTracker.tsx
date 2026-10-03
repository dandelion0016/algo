'use client';

import React, { useState } from 'react';
import { Player, Card, CardColor } from '../types/game';
import { calculateDeckTrackerState, TrackedCard } from '../lib/deckTracker';
import { Target, ChevronDown, ChevronUp, Layers, Sparkles } from 'lucide-react';

export interface DeckTrackerProps {
  players: Player[];
  drawnCard?: Card | null;
  highlightedNumbers?: number[];
  highlightColor?: CardColor | null;
  isCollapsible?: boolean;
  defaultCollapsed?: boolean;
  className?: string;
  hideHeader?: boolean;
}

export const DeckTracker: React.FC<DeckTrackerProps> = ({
  players,
  drawnCard,
  highlightedNumbers = [],
  highlightColor = null,
  isCollapsible = true,
  defaultCollapsed = false,
  className = '',
  hideHeader = false,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);

  const trackerState = calculateDeckTrackerState({
    players,
    drawnCard,
    highlightedNumbers,
    highlightColor,
  });

  const { blackCards, whiteCards, summary } = trackerState;

  const renderCardBadge = (card: TrackedCard) => {
    const isBlack = card.color === 'black';

    let badgeClass = '';
    let label = '';

    if (card.isConfirmed) {
      // 確定済み（既に場に出ている）
      label = `${isBlack ? '黒' : '白'}${card.number} (確定済み)`;
      badgeClass = isBlack
        ? 'bg-slate-800/40 text-slate-500 border border-slate-700/40 line-through opacity-30 select-none'
        : 'bg-slate-200/50 text-slate-400 border border-slate-300/40 line-through opacity-30 select-none';
    } else if (card.isHighlighted) {
      // 未確定かつ相手カードの推理候補アシストでハイライト
      label = `${isBlack ? '黒' : '白'}${card.number} (推理候補)`;
      badgeClass = isBlack
        ? 'bg-slate-900 text-amber-300 border-2 border-amber-400 ring-2 ring-amber-400/50 font-black scale-110 shadow-sm animate-pulse z-10'
        : 'bg-amber-100 text-amber-950 border-2 border-amber-400 ring-2 ring-amber-400/50 font-black scale-110 shadow-sm animate-pulse z-10';
    } else {
      // 未確定（残弾）
      label = `${isBlack ? '黒' : '白'}${card.number} (未確定)`;
      badgeClass = isBlack
        ? 'bg-slate-900 text-white border border-slate-700 shadow-2xs hover:scale-105 transition-transform'
        : 'bg-white text-slate-900 border border-slate-300 shadow-2xs hover:scale-105 transition-transform';
    }

    return (
      <div
        key={`${card.color}-${card.number}`}
        data-testid={`tracker-card-${card.color}-${card.number}`}
        data-status={card.isConfirmed ? 'confirmed' : 'remaining'}
        data-highlighted={card.isHighlighted ? 'true' : 'false'}
        title={label}
        aria-label={label}
        className={`flex items-center justify-center rounded text-[10px] sm:text-xs font-mono h-6 sm:h-7 min-w-[18px] sm:min-w-[22px] transition-all ${badgeClass}`}
      >
        {card.number}
      </div>
    );
  };

  return (
    <div
      data-testid="deck-tracker"
      className={`bg-white rounded-xl sm:rounded-2xl border border-slate-200 shadow-xs p-2 sm:p-3 transition-all ${className}`}
    >
      {!hideHeader && (
        <div className="flex items-center justify-between gap-1 mb-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <Target className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-algo-blue shrink-0" />
            <h3 className="text-xs sm:text-sm font-bold text-slate-800 whitespace-nowrap">
              残弾トラッカー
            </h3>
            {highlightedNumbers.length > 0 && (
              <span
                data-testid="tracker-assist-active"
                className="flex items-center gap-0.5 px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-800 text-[9px] font-bold shrink-0 animate-fade-in"
                title="推理候補ハイライト中"
              >
                <Sparkles className="w-2.5 h-2.5" />
                <span>候補連動</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* サマリバッジ */}
            <div
              data-testid="tracker-summary"
              className="flex items-center gap-1 px-1.5 py-0.5 rounded-lg bg-slate-100 text-[10px] sm:text-xs font-semibold text-slate-700 shrink-0"
              title={`未確定: 黒${summary.blackRemaining}枚 / 白${summary.whiteRemaining}枚 (確定: ${summary.totalConfirmed}枚)`}
            >
              <span>残弾:</span>
              <span className="font-mono font-bold text-algo-blue">
                {summary.totalRemaining}
              </span>
              <span className="text-[9px] text-slate-400">/ 24</span>
              <span className="hidden xl:inline text-slate-300">|</span>
              <span className="hidden xl:inline font-mono text-[10px] text-slate-600">
                黒{summary.blackRemaining} 白{summary.whiteRemaining}
              </span>
            </div>

            {isCollapsible && (
              <button
                type="button"
                data-testid="tracker-toggle-btn"
                onClick={() => setIsCollapsed((prev) => !prev)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                aria-label={isCollapsed ? 'トラッカーを展開' : 'トラッカーを折りたたむ'}
              >
                {isCollapsed ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronUp className="w-4 h-4" />
                )}
              </button>
            )}
          </div>
        </div>
      )}

      {/* 開閉コンテンツ */}
      {!isCollapsed && (
        <div data-testid="tracker-content" className="space-y-1.5 sm:space-y-2">
          {/* 黒カード行 */}
          <div className="flex items-center gap-1">
            <span className="w-4 sm:w-5 text-[10px] sm:text-xs font-bold text-slate-900 shrink-0 text-center">
              黒
            </span>
            <div className="flex-1 grid grid-cols-12 gap-0.5 sm:gap-1">
              {blackCards.map((card) => renderCardBadge(card))}
            </div>
            <span className="w-4 text-[9px] sm:text-[10px] font-mono text-slate-400 shrink-0 text-right">
              {summary.blackRemaining}
            </span>
          </div>

          {/* 白カード行 */}
          <div className="flex items-center gap-1">
            <span className="w-4 sm:w-5 text-[10px] sm:text-xs font-bold text-slate-500 shrink-0 text-center">
              白
            </span>
            <div className="flex-1 grid grid-cols-12 gap-0.5 sm:gap-1">
              {whiteCards.map((card) => renderCardBadge(card))}
            </div>
            <span className="w-4 text-[9px] sm:text-[10px] font-mono text-slate-400 shrink-0 text-right">
              {summary.whiteRemaining}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
