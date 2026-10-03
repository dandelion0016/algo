'use client';

import React, { useEffect, useCallback } from 'react';
import { Sparkles, Trophy } from 'lucide-react';

export interface LethalCutInProps {
  isActive: boolean;
  winnerName?: string;
  onComplete?: () => void;
  durationMs?: number;
}

/**
 * リーサル（決着ヒット）時のダイナミックK.O.演出カットイン (Issue #73)
 * - 相手プレイヤーの最後の伏せカードを的中させてゲームセットとなった瞬間にバースト表示
 * - スタイリッシュな「💥 FINISH!!」演出とパーティクル・光彩表現
 * - クリックまたはキー入力によるスキップ対応
 */
export const LethalCutIn: React.FC<LethalCutInProps> = ({
  isActive,
  winnerName,
  onComplete,
  durationMs = 1200,
}) => {
  const handleDismiss = useCallback(() => {
    onComplete?.();
  }, [onComplete]);

  // 指定ミリ秒（デフォルト1.2秒）後に自動消去
  useEffect(() => {
    if (!isActive) return;

    const timer = setTimeout(() => {
      handleDismiss();
    }, durationMs);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleDismiss();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isActive, durationMs, handleDismiss]);

  if (!isActive) return null;

  return (
    <div
      data-testid="lethal-ko-cutin"
      role="alert"
      aria-live="assertive"
      aria-label="決着フィニッシュ演出"
      onClick={handleDismiss}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs select-none cursor-pointer transition-opacity duration-200"
    >
      {/* 集中線＆背景グロー演出 */}
      <div className="absolute inset-0 bg-radial from-rose-500/20 via-amber-500/10 to-transparent pointer-events-none" />

      {/* メインバーストコンテナ */}
      <div className="relative flex flex-col items-center justify-center p-6 sm:p-10 mx-4 max-w-lg w-full text-center animate-finish-burst pointer-events-none">
        {/* 背景の装飾光芒 */}
        <div className="absolute -inset-4 bg-gradient-to-r from-amber-500/30 via-rose-500/30 to-amber-500/30 rounded-3xl blur-xl opacity-75" />

        <div className="relative z-10 flex flex-col items-center gap-2 sm:gap-3 bg-slate-900/90 border-2 border-amber-400/80 rounded-2xl sm:rounded-3xl p-6 sm:p-8 shadow-[0_0_50px_rgba(245,158,11,0.5)]">
          {/* 上部サブヘッダーバッジ */}
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/20 border border-rose-400/40 text-rose-300 text-xs sm:text-sm font-black tracking-widest uppercase">
            <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-rose-400 animate-spin" />
            <span>LETHAL HIT! K.O.</span>
            <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-rose-400 animate-spin" />
          </div>

          {/* メイン「💥 FINISH!!」テキスト */}
          <div className="py-1">
            <h1 className="text-4xl sm:text-6xl md:text-7xl font-black italic tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-rose-400 to-amber-200 drop-shadow-[0_4px_16px_rgba(244,63,94,0.8)] filter">
              💥 FINISH!!
            </h1>
          </div>

          {/* 勝者案内 */}
          <div className="flex items-center gap-2 text-slate-200 text-sm sm:text-lg font-bold">
            <Trophy className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400 shrink-0" />
            <span>
              {winnerName ? `${winnerName} の完全勝利！` : '勝敗が決しました！'}
            </span>
          </div>

          {/* スキップ案内ヒント */}
          <p className="text-[10px] sm:text-xs text-slate-400 font-medium tracking-tight mt-1 opacity-80">
            タップまたはキー入力で結果画面へ
          </p>
        </div>
      </div>
    </div>
  );
};
