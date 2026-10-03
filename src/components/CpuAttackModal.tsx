'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  Bot,
  User,
  CheckCircle2,
  XCircle,
  ArrowRight,
  ShieldAlert,
  Sparkles,
  Eye,
  FastForward,
  Play,
  Pause,
} from 'lucide-react';

export type AttackNextAction = 'CONTINUE' | 'STAY' | 'TURN_END' | 'GAME_OVER';
export type CpuAttackNextAction = AttackNextAction;

export interface AttackResultData {
  attackerName: string;
  isHuman?: boolean;
  targetPlayerName: string;
  targetCardIndex: number;
  targetColor: 'black' | 'white';
  guessedNumber: number;
  isHit: boolean;
  actualNumber?: number;
  nextAction: AttackNextAction;
  nextPlayerName?: string;
  isDeckExhausted?: boolean;
}
export type CpuAttackResultData = AttackResultData;

export interface AttackResultModalProps {
  isOpen: boolean;
  data: AttackResultData | null;
  onConfirm: () => void;
  /** 3人・4人対戦で人間プレイヤー脱落後の観戦モードフラグ (Issue #61) */
  isSpectating?: boolean;
  /** 自動観戦（一定時間で自動的に次へ進む）フラグ (Issue #61) */
  isAutoAdvance?: boolean;
  /** 自動観戦ON/OFF切り替えハンドラ */
  onToggleAutoAdvance?: () => void;
  /** 決着まで一括スキップハンドラ */
  onSkipToResult?: () => void;
  /** 自動進行ディレイ時間（ms, デフォルト1500ms） */
  autoAdvanceDelayMs?: number;
}
export type CpuAttackModalProps = AttackResultModalProps;

/**
 * 展開案内メッセージの生成
 */
export const getNextActionMessage = (
  attackerName: string,
  nextAction: AttackNextAction,
  nextPlayerName?: string,
  isHuman?: boolean,
  isDeckExhausted?: boolean
): string => {
  const isHumanPlayer = isHuman || attackerName === 'あなた';

  if (isHumanPlayer) {
    switch (nextAction) {
      case 'CONTINUE':
        return isDeckExhausted
          ? '的中！続けてアタックするか、ステイするか選択できます'
          : '的中！続けてアタックするか、手札に加えてステイするか選択できます';
      case 'STAY':
        return isDeckExhausted ? 'ステイしました' : '手札に加えてステイしました';
      case 'TURN_END':
        return `あなたのターンが終了しました。次は ${nextPlayerName || '次のプレイヤー'} の番です`;
      case 'GAME_OVER':
        return '勝敗が決しました';
      default:
        return '';
    }
  }

  switch (nextAction) {
    case 'CONTINUE':
      return `${attackerName} はさらにアタックを継続します`;
    case 'STAY':
      return isDeckExhausted
        ? `${attackerName} はステイしました`
        : `${attackerName} は手札に加えてステイしました`;
    case 'TURN_END':
      return `${attackerName} のターンが終了しました。次は ${nextPlayerName || '次のプレイヤー'} の番です`;
    case 'GAME_OVER':
      return '勝敗が決しました';
    default:
      return '';
  }
};

/**
 * 推理結果確認モーダル (CPU & プレイヤー)
 * - パステルイエロー（#FCF97A）×スカイブルー（#7BA6EF）基調のUI
 * - 盤面状況も視認できるよう backdrop-blur を配置
 * - Enter/Escape/Space キー操作でも次へ進める
 */
export const AttackResultModal: React.FC<AttackResultModalProps> = ({
  isOpen,
  data,
  onConfirm,
  isSpectating = false,
  isAutoAdvance = false,
  onToggleAutoAdvance,
  onSkipToResult,
  autoAdvanceDelayMs = 1500,
}) => {
  useEffect(() => {
    if (!isOpen || !data) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === 'Escape' || e.key === ' ') {
        e.preventDefault();
        onConfirm();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, data, onConfirm]);

  // 観戦モード時の自動進行タイマー (Issue #61)
  useEffect(() => {
    if (!isOpen || !data || !isSpectating || !isAutoAdvance) return;

    const timer = setTimeout(() => {
      onConfirm();
    }, autoAdvanceDelayMs);

    return () => clearTimeout(timer);
  }, [isOpen, data, isSpectating, isAutoAdvance, autoAdvanceDelayMs, onConfirm]);

  if (!isOpen || !data) return null;

  const isHumanPlayer = Boolean(data.isHuman || data.attackerName === 'あなた');

  const nextActionMessage = getNextActionMessage(
    data.attackerName,
    data.nextAction,
    data.nextPlayerName,
    data.isHuman,
    data.isDeckExhausted
  );

  const isTargetBlack = data.targetColor === 'black';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="cpu-attack-modal-title"
      data-testid="cpu-attack-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-3 sm:p-4 animate-fade-in"
    >
      <div
        data-testid="attack-result-modal"
        className="relative w-full max-w-sm sm:max-w-md bg-white/95 backdrop-blur-md rounded-2xl sm:rounded-3xl shadow-2xl border-2 border-[#7BA6EF]/40 overflow-hidden animate-scale-up max-h-[92dvh] flex flex-col"
      >
        {/* パステルイエローとスカイブルーのアクセントヘッダーライン */}
        <div className="h-2.5 w-full bg-gradient-to-r from-[#FCF97A] via-[#7BA6EF] to-[#FCF97A] shrink-0" />

        <div className="p-4 sm:p-6 flex flex-col items-center text-center overflow-y-auto max-h-full">
          {/* アタッカー表示＆観戦中バッジ */}
          <div className="flex items-center gap-2 mb-2 flex-wrap justify-center">
            {isSpectating && (
              <div
                data-testid="spectator-badge"
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-100 border border-purple-300 text-purple-800 text-xs font-black animate-pulse"
              >
                <Eye className="w-3.5 h-3.5 text-purple-600" />
                <span>観戦モード</span>
              </div>
            )}
            <div
              data-testid="attack-result-badge"
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#7BA6EF]/15 border border-[#7BA6EF]/30 text-algo-navy text-xs font-black"
            >
              {isHumanPlayer ? (
                <>
                  <User className="w-3.5 h-3.5 text-[#355ea7]" />
                  <span>あなたのアタック</span>
                </>
              ) : (
                <>
                  <Bot className="w-3.5 h-3.5 text-[#355ea7]" />
                  <span>{`${data.attackerName} のアタック`}</span>
                </>
              )}
            </div>
          </div>

          <h2
            id="cpu-attack-modal-title"
            className="text-lg sm:text-xl font-black text-slate-800 tracking-tight"
          >
            推理結果の確認
          </h2>

          {/* ターゲット情報 */}
          <div className="mt-3 w-full bg-slate-50/80 border border-slate-200/80 rounded-xl p-3 text-xs sm:text-sm text-slate-700">
            <div className="text-slate-500 font-medium mb-1">アタック対象</div>
            <div className="font-bold flex items-center justify-center gap-1.5 flex-wrap">
              <span className="text-slate-900 font-black">{data.targetPlayerName}</span>
              <span>の左から</span>
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-slate-200 text-slate-800 font-black text-xs">
                {data.targetCardIndex + 1}
              </span>
              <span>番目の</span>
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-black text-xs ${
                  isTargetBlack
                    ? 'bg-slate-900 text-white'
                    : 'bg-white text-slate-900 border border-slate-300'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    isTargetBlack ? 'bg-white' : 'bg-slate-900'
                  }`}
                />
                {`${isTargetBlack ? '黒' : '白'}カード`}
              </span>
            </div>
          </div>

          {/* 推理した数字（カード風ビジュアル表示） */}
          <div className="my-4 flex flex-col items-center">
            <div className="text-[11px] font-bold text-slate-500 mb-1.5">予想した数字</div>
            <div
              data-testid="cpu-guessed-card"
              className={`w-16 h-22 sm:w-18 sm:h-24 rounded-xl flex flex-col items-center justify-center shadow-lg border-2 transition-transform select-none ${
                isTargetBlack
                  ? 'bg-slate-900 text-white border-slate-700'
                  : 'bg-white text-slate-900 border-slate-300'
              }`}
            >
              <span className="text-[10px] font-bold tracking-widest uppercase opacity-70">
                {isTargetBlack ? 'BLACK' : 'WHITE'}
              </span>
              <span className="text-3xl sm:text-4xl font-black my-0.5">
                {data.guessedNumber}
              </span>
              <div
                className={`w-4 h-1 rounded-full ${
                  isTargetBlack ? 'bg-white/40' : 'bg-slate-300'
                }`}
              />
            </div>
          </div>

          {/* 判定結果バナー */}
          <div className="w-full mb-4">
            {data.isHit ? (
              <div
                data-testid="cpu-attack-hit-banner"
                className="bg-emerald-50 border-2 border-emerald-300 text-emerald-800 rounded-xl p-3 flex items-center justify-center gap-2 shadow-xs"
              >
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <div className="text-left">
                  <div className="font-black text-base sm:text-lg text-emerald-700 leading-tight flex items-center gap-1">
                    🎯 的中！（成功）
                    {data.nextAction === 'GAME_OVER' && (
                      <Sparkles className="w-4 h-4 text-amber-500 animate-spin" />
                    )}
                  </div>
                  <div className="text-[11px] sm:text-xs text-emerald-600 font-medium">
                    対象のカードがオープンされました
                  </div>
                </div>
              </div>
            ) : (
              <div
                data-testid="cpu-attack-miss-banner"
                className="bg-rose-50 border-2 border-rose-300 text-rose-800 rounded-xl p-3 flex items-center justify-center gap-2 shadow-xs"
              >
                <XCircle className="w-5 h-5 text-rose-600 shrink-0" />
                <div className="text-left">
                  <div className="font-black text-base sm:text-lg text-rose-700 leading-tight">
                    ❌ ハズレ（失敗）
                  </div>
                  <div className="text-[11px] sm:text-xs text-rose-600 font-medium">
                    {data.isDeckExhausted
                      ? '山札がないため、手札の伏せカードがオープンされました'
                      : isHumanPlayer
                      ? 'あなたの引いたカードがオープンされました'
                      : `${data.attackerName} の引いたカードがオープンされました`}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* その後の展開案内 */}
          <div
            data-testid="cpu-next-action-message"
            className="w-full bg-[#FCF97A]/35 border border-[#e3df59] rounded-xl p-3 text-xs sm:text-sm font-black text-slate-800 mb-5 flex items-center justify-center gap-2"
          >
            {data.nextAction === 'GAME_OVER' ? (
              <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
            ) : (
              <ArrowRight className="w-4 h-4 text-slate-600 shrink-0" />
            )}
            <span>{nextActionMessage}</span>
          </div>

          {/* 観戦モード用コントロール (自動進行トグル & スキップ) (Issue #61) */}
          {isSpectating && (
            <div
              data-testid="spectate-controls"
              className="w-full flex items-center justify-between gap-2 mb-3 bg-purple-50/80 border border-purple-200/80 rounded-xl p-2"
            >
              {onToggleAutoAdvance ? (
                <button
                  type="button"
                  data-testid="toggle-auto-advance"
                  onClick={onToggleAutoAdvance}
                  className={`flex-1 py-1.5 px-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    isAutoAdvance
                      ? 'bg-purple-600 text-white shadow-xs'
                      : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {isAutoAdvance ? (
                    <>
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>自動観戦: ON</span>
                    </>
                  ) : (
                    <>
                      <Pause className="w-3.5 h-3.5 text-slate-500" />
                      <span>自動観戦: OFF</span>
                    </>
                  )}
                </button>
              ) : null}

              {onSkipToResult ? (
                <button
                  type="button"
                  data-testid="btn-skip-to-result"
                  onClick={onSkipToResult}
                  className="flex-1 py-1.5 px-2.5 rounded-lg text-xs font-black bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white shadow-xs flex items-center justify-center gap-1 transition-all active:scale-95 cursor-pointer"
                >
                  <FastForward className="w-3.5 h-3.5" />
                  <span>決着までスキップ</span>
                </button>
              ) : null}
            </div>
          )}

          {/* OKボタン */}
          <button
            type="button"
            data-testid="btn-attack-result-ok"
            onClick={onConfirm}
            className="w-full py-3 px-4 rounded-xl font-black text-sm sm:text-base text-white bg-[#7BA6EF] hover:bg-[#6894dd] active:scale-[0.98] shadow-md shadow-[#7BA6EF]/25 hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-[#7BA6EF] focus:ring-offset-2 relative overflow-hidden"
          >
            <span data-testid="btn-cpu-attack-ok" className="sr-only" aria-hidden="true" />
            <span>{isSpectating && isAutoAdvance ? 'OK (自動進行中...)' : 'OK (次へ)'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export const CpuAttackModal = AttackResultModal;
