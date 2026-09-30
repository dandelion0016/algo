'use client';

import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

export interface ConfirmModalProps {
  isOpen: boolean;
  title?: string;
  message?: string;
  actionType: 'RESTART' | 'SETUP' | 'CUSTOM';
  gameStatus?: {
    playerCount: number;
    difficulty: string;
    remainingHiddenCards: number;
    logCount: number;
  };
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const getDifficultyLabel = (diff: string): string => {
  switch (diff) {
    case 'easy':
    case '初級':
      return '初級';
    case 'normal':
    case '中級':
      return '中級';
    case 'hard':
    case '上級':
      return '上級';
    default:
      return diff;
  }
};

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  actionType,
  gameStatus,
  confirmLabel,
  cancelLabel = 'ゲームに戻る (キャンセル)',
  isDestructive,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  // デフォルトタイトルの決定
  const resolvedTitle =
    title ||
    (actionType === 'RESTART'
      ? '対戦の中断・再戦の確認'
      : actionType === 'SETUP'
      ? '対戦の中断・設定変更の確認'
      : '対戦の中断・リセット確認');

  // デフォルト警告メッセージの決定
  const resolvedMessage =
    message ||
    (actionType === 'RESTART'
      ? '現在の対戦状況は破棄されます。同じ設定で最初からやり直しますか？'
      : actionType === 'SETUP'
      ? '現在の対戦状況は破棄されます。人数や難易度の設定画面に戻りますか？'
      : 'この操作を実行すると、現在の対戦状況（手札、オープン情報、対戦ログ）はすべて破棄されます。本当に操作を続行しますか？');

  // 破壊的アクションフラグの決定 (RESTARTはデフォルトtrue、SETUPはfalse、CUSTOMはtrue)
  const resolvedIsDestructive =
    isDestructive !== undefined
      ? isDestructive
      : actionType === 'RESTART' || actionType === 'CUSTOM';

  // 承認ボタンラベルの決定
  const resolvedConfirmLabel =
    confirmLabel ||
    (actionType === 'RESTART'
      ? '対戦を破棄して再戦'
      : actionType === 'SETUP'
      ? '対戦を終了して設定へ'
      : '破棄して実行');

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-150"
      onClick={onCancel}
    >
      <div
        data-testid="modal-confirm"
        className="bg-white border border-slate-200 rounded-3xl max-w-md w-full overflow-hidden text-slate-800 shadow-2xl animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* パステル調ヘッダーバー */}
        <div className="w-full h-3 bg-gradient-to-r from-algo-yellow-light via-algo-blue-light to-white border-b border-slate-100" />

        <div className="p-5 sm:p-6 space-y-4">
          {/* モーダルヘッダー */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div
                className={`w-9 h-9 rounded-2xl flex items-center justify-center shrink-0 shadow-xs border ${
                  resolvedIsDestructive
                    ? 'bg-rose-50 text-rose-600 border-rose-200/80'
                    : 'bg-amber-50 text-amber-600 border-amber-200/80'
                }`}
              >
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight leading-snug">
                {resolvedTitle}
              </h3>
            </div>
            <button
              type="button"
              data-testid="btn-close-modal"
              onClick={onCancel}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              aria-label="閉じる"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* 警告文 */}
          <div className="space-y-1.5">
            <p className="text-xs sm:text-sm font-bold text-rose-600 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
              現在ゲームが進行中です！
            </p>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-medium">
              {resolvedMessage}
            </p>
          </div>

          {/* 対戦ステータス情報カード */}
          {gameStatus && (
            <div
              data-testid="confirm-modal-status"
              className="p-3.5 bg-slate-50/90 border border-slate-200/80 rounded-2xl space-y-2 text-xs"
            >
              <div className="font-bold text-slate-700 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <span>現在の対戦ステータス</span>
              </div>
              <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-200/60 text-center">
                <div className="bg-white p-2 rounded-xl border border-slate-200/60 shadow-2xs">
                  <span className="text-[10px] text-slate-400 font-bold block">対戦形式</span>
                  <span className="font-black text-slate-800 text-[11px] sm:text-xs">
                    {`${gameStatus.playerCount}人 (CPU:${getDifficultyLabel(gameStatus.difficulty)})`}
                  </span>
                </div>
                <div className="bg-white p-2 rounded-xl border border-slate-200/60 shadow-2xs">
                  <span className="text-[10px] text-slate-400 font-bold block">残り伏せ</span>
                  <span className="font-black text-algo-blue text-[11px] sm:text-xs">
                    {`${gameStatus.remainingHiddenCards}枚`}
                  </span>
                </div>
                <div className="bg-white p-2 rounded-xl border border-slate-200/60 shadow-2xs">
                  <span className="text-[10px] text-slate-400 font-bold block">経過ログ</span>
                  <span className="font-black text-slate-800 text-[11px] sm:text-xs">
                    {`${gameStatus.logCount}手番`}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* アクションボタン */}
          <div className="flex flex-col-reverse sm:flex-row gap-2.5 pt-2">
            <button
              type="button"
              data-testid="btn-cancel-action"
              onClick={onCancel}
              className="flex-1 px-4 py-3 rounded-2xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs sm:text-sm transition-all shadow-2xs text-center"
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              data-testid="btn-confirm-action"
              data-confirm-reset-btn="true"
              onClick={onConfirm}
              className={`flex-1 px-4 py-3 rounded-2xl font-black text-xs sm:text-sm transition-all shadow-md text-center text-white ${
                resolvedIsDestructive
                  ? 'bg-rose-600 hover:bg-rose-700 ring-2 ring-rose-200'
                  : 'bg-slate-900 hover:bg-slate-800 ring-2 ring-slate-200'
              }`}
            >
              {resolvedConfirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
