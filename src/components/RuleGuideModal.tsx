'use client';

import React from 'react';
import { BookOpen, X, Award, CheckCircle2, AlertCircle } from 'lucide-react';

interface RuleGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RuleGuideModal: React.FC<RuleGuideModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="bg-white border border-slate-200 rounded-3xl max-w-lg w-full max-h-[85vh] flex flex-col text-slate-800 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-algo-yellow/60 flex items-center justify-center text-slate-900 shadow-sm">
              <BookOpen className="w-5 h-5 text-slate-900" />
            </div>
            <h3 className="text-lg font-black text-slate-900">アルゴ（algo）の公式ルール</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs sm:text-sm text-slate-600 leading-relaxed">
          {/* Section 1 */}
          <div className="space-y-2">
            <h4 className="font-black text-slate-900 text-sm flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-algo-blue" />
              <span>1. カードの並び順（鉄則ルール）</span>
            </h4>
            <p>
              すべてのプレイヤーのカードは、左から右へ以下のルールで整列されています：
            </p>
            <ul className="space-y-1.5 pl-2 text-slate-700">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-algo-blue shrink-0" />
                <span><strong>小さい数字が左</strong>、<strong>大きい数字が右</strong></span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-algo-blue shrink-0" />
                <span>同じ数字の場合は<strong>「黒」が左</strong>、<strong>「白」が右</strong>（黒 ＜ 白）</span>
              </li>
            </ul>
            <div className="p-3 bg-algo-yellow-light/60 border border-algo-yellow-dark/30 rounded-2xl text-xs font-bold text-center text-slate-800">
              例: [黒0] → [白0] → [黒1] → [白1] → ... → [黒11] → [白11]
            </div>
          </div>

          {/* Section 2 */}
          <div className="space-y-2">
            <h4 className="font-black text-slate-900 text-sm flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-algo-yellow-dark" />
              <span>2. 人数別の初期手札枚数</span>
            </h4>
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                <span className="font-bold text-slate-800 block">2人対戦</span>
                <span className="text-algo-blue font-black text-base">各 4枚</span>
                <span className="text-[10px] text-slate-500 block">山札16枚</span>
              </div>
              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                <span className="font-bold text-slate-800 block">3人対戦</span>
                <span className="text-algo-blue font-black text-base">各 3枚</span>
                <span className="text-[10px] text-slate-500 block">山札15枚</span>
              </div>
              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                <span className="font-bold text-slate-800 block">4人対戦</span>
                <span className="text-algo-blue font-black text-base">各 2枚</span>
                <span className="text-[10px] text-slate-500 block">山札16枚</span>
              </div>
            </div>
          </div>

          {/* Section 3 */}
          <div className="space-y-2">
            <h4 className="font-black text-slate-900 text-sm flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-algo-blue" />
              <span>3. 手番の流れ（ドロー ➔ アタック ➔ 判定）</span>
            </h4>
            <div className="space-y-2 text-xs">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                <strong className="text-slate-900 font-bold block">① 山札から1枚引く</strong>
                <p>引いたカードは自分だけが数字を確認できます。</p>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                <strong className="text-slate-900 font-bold block">② 相手カードを推理してアタック！</strong>
                <p>相手の伏せカードを1枚選び、数字（0〜11）を宣言します。</p>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                <strong className="text-slate-900 font-bold block">③ 判定</strong>
                <div className="flex items-start gap-1.5 text-emerald-700">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span><strong>的中！:</strong> 相手のカードがOPEN！続けて別カードにアタックするか、ステイ（裏向きで手札に加える）するか選べます。</span>
                </div>
                <div className="flex items-start gap-1.5 text-rose-600">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span><strong>ハズレ:</strong> 引いたカードをOPENにして自分の手札の正しい位置に加えます（相手にヒントがバレるペナルティ）。</span>
                </div>
              </div>
            </div>
          </div>

          {/* Section 4 */}
          <div className="space-y-2">
            <h4 className="font-black text-slate-900 text-sm flex items-center gap-1.5">
              <Award className="w-4 h-4 text-amber-500" />
              <span>4. 勝利条件</span>
            </h4>
            <p className="p-3.5 bg-algo-yellow/20 border border-algo-yellow-dark/40 rounded-2xl text-slate-800 text-xs font-medium">
              伏せカードがすべてOPENになったプレイヤーは脱落します。最後まで伏せカードを残して生き残ったプレイヤーの勝利です！
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/80">
          <button
            onClick={onClose}
            className="w-full py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-bold transition-all text-sm shadow-md"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};
