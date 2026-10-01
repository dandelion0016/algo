'use client';

import React, { useState } from 'react';
import { Sparkles, GraduationCap, ArrowRight, X } from 'lucide-react';

export interface TutorialPromptModalProps {
  isOpen: boolean;
  onStartTutorial: () => void;
  onSkip: (dontShowAgain: boolean) => void;
}

export const STORAGE_KEY_TUTORIAL_COMPLETED = 'algo_tutorial_completed';
export const STORAGE_KEY_TUTORIAL_SKIP_PROMPT = 'algo_tutorial_skip_prompt';

export const TutorialPromptModal: React.FC<TutorialPromptModalProps> = ({
  isOpen,
  onStartTutorial,
  onSkip,
}) => {
  const [dontShowAgain, setDontShowAgain] = useState(false);

  if (!isOpen) return null;

  const handleStart = () => {
    if (dontShowAgain) {
      try {
        localStorage.setItem(STORAGE_KEY_TUTORIAL_SKIP_PROMPT, 'true');
      } catch (e) {
        // localStorage unavailable
      }
    }
    onStartTutorial();
  };

  const handleSkip = () => {
    if (dontShowAgain) {
      try {
        localStorage.setItem(STORAGE_KEY_TUTORIAL_SKIP_PROMPT, 'true');
      } catch (e) {
        // localStorage unavailable
      }
    }
    onSkip(dontShowAgain);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="tutorial-prompt-title"
      data-testid="tutorial-prompt-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden transform animate-in zoom-in-95 duration-200">
        {/* 装飾ヘッダーバー */}
        <div className="h-2 bg-gradient-to-r from-algo-blue via-algo-yellow to-algo-blue" />

        <div className="p-6 sm:p-7 text-center">
          {/* アイコン */}
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-algo-blue-light to-blue-100 border-2 border-algo-blue/30 flex items-center justify-center text-algo-navy shadow-sm">
            <GraduationCap className="w-8 h-8 text-algo-blue" />
          </div>

          {/* タイトル */}
          <h2
            id="tutorial-prompt-title"
            className="text-lg sm:text-xl font-black text-slate-900 mb-2 flex items-center justify-center gap-1.5"
          >
            <span>はじめての algo ですか？</span>
            <Sparkles className="w-4 h-4 text-algo-yellow-dark" />
          </h2>

          {/* 説明 */}
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed mb-6">
            カードの並び順ルールや推理の基本を、実際に手を動かしながら楽しく学べる
            <strong className="text-algo-navy font-bold">「体験チュートリアル（約2分）」</strong>
            を用意しています。
          </p>

          {/* 今後表示しないチェックボックス */}
          <div className="mb-6 flex items-center justify-center gap-2">
            <label className="inline-flex items-center gap-2 cursor-pointer select-none text-xs text-slate-500 hover:text-slate-700">
              <input
                type="checkbox"
                data-testid="checkbox-skip-prompt"
                checked={dontShowAgain}
                onChange={(e) => setDontShowAgain(e.target.checked)}
                className="w-4 h-4 text-algo-blue rounded border-slate-300 focus:ring-algo-blue"
              />
              <span>今後この確認を表示しない</span>
            </label>
          </div>

          {/* アクションボタン */}
          <div className="space-y-2.5">
            <button
              type="button"
              data-testid="btn-start-tutorial-prompt"
              onClick={handleStart}
              className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-algo-yellow to-algo-yellow-dark hover:brightness-105 active:scale-98 text-slate-950 font-black text-sm shadow-md shadow-amber-300/40 flex items-center justify-center gap-2 transition-all border border-amber-300/60"
            >
              <GraduationCap className="w-4 h-4" />
              <span>チュートリアルを開始する</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              type="button"
              data-testid="btn-skip-tutorial-prompt"
              onClick={handleSkip}
              className="w-full py-2.5 px-4 rounded-xl border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50 font-bold text-xs transition-all"
            >
              スキップして対戦へ進む
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
