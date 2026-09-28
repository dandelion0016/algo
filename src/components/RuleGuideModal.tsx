'use client';

import React from 'react';
import { BookOpen, X, ArrowRight, ShieldAlert, Award } from 'lucide-react';

interface RuleGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RuleGuideModal: React.FC<RuleGuideModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl max-w-lg w-full max-h-[85vh] flex flex-col text-white shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-amber-400" />
            <h3 className="text-lg font-bold">アルゴ（algo）の遊び方・ルール</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 text-sm text-zinc-300 leading-relaxed">
          {/* Section 1 */}
          <div className="space-y-2">
            <h4 className="font-bold text-amber-400 flex items-center gap-1.5">
              <span>1. カードの並び順（基本ルール）</span>
            </h4>
            <p>
              すべてのカードは、左から右に向かって以下の順序で厳密に並べられます：
            </p>
            <ul className="list-disc list-inside space-y-1 pl-2 text-zinc-200">
              <li>
                <span className="font-semibold text-white">小さい数字が左</span>、
                <span className="font-semibold text-white">大きい数字が右</span>
              </li>
              <li>
                同じ数字がある場合は、
                <span className="font-semibold text-zinc-100">「黒」が左</span>、
                <span className="font-semibold text-zinc-100">「白」が右</span>（黒 ＜ 白）
              </li>
            </ul>
            <div className="p-3 bg-zinc-800/80 rounded-xl border border-zinc-700 text-xs text-center text-zinc-300">
              例: [黒0] → [白0] → [黒1] → [白1] → ... → [黒11] → [白11]
            </div>
          </div>

          {/* Section 2 */}
          <div className="space-y-2">
            <h4 className="font-bold text-amber-400 flex items-center gap-1.5">
              <span>2. ターンの流れ</span>
            </h4>
            <div className="space-y-2 text-xs">
              <div className="flex items-start gap-2 p-2.5 bg-zinc-800/40 rounded-lg border border-zinc-800">
                <span className="bg-amber-500/20 text-amber-400 font-bold px-1.5 py-0.5 rounded text-[11px]">
                  STEP 1
                </span>
                <div>
                  <strong className="text-zinc-100">山札から1枚引く:</strong>{' '}
                  引いたカードは自分だけが数字を確認できます。
                </div>
              </div>
              <div className="flex items-start gap-2 p-2.5 bg-zinc-800/40 rounded-lg border border-zinc-800">
                <span className="bg-amber-500/20 text-amber-400 font-bold px-1.5 py-0.5 rounded text-[11px]">
                  STEP 2
                </span>
                <div>
                  <strong className="text-zinc-100">相手のカードをアタック:</strong>{' '}
                  相手の伏せカードを1枚選び、数字（0〜11）を推理して宣言します。
                </div>
              </div>
              <div className="flex items-start gap-2 p-2.5 bg-zinc-800/40 rounded-lg border border-zinc-800">
                <span className="bg-amber-500/20 text-amber-400 font-bold px-1.5 py-0.5 rounded text-[11px]">
                  STEP 3
                </span>
                <div>
                  <strong className="text-zinc-100">判定と結果:</strong>
                  <ul className="list-disc list-inside mt-1 space-y-1 text-zinc-300">
                    <li>
                      <span className="text-emerald-400 font-semibold">的中！</span>:
                      相手のカードが表向きになります。続けて別カードにアタックするか、ステイ（手札に裏向きで加えて手番終了）するか選べます。
                    </li>
                    <li>
                      <span className="text-rose-400 font-semibold">ハズレ…</span>:
                      引いたカードを表向きにして自分の手札の正しい位置に加えます（相手にヒントがバレるペナルティ）。手番は相手に移ります。
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Section 3 */}
          <div className="space-y-2">
            <h4 className="font-bold text-amber-400 flex items-center gap-1.5">
              <Award className="w-4 h-4" />
              <span>3. 勝利条件</span>
            </h4>
            <p className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-200 text-xs">
              相手の伏せカードをすべて表向き（OPEN）にしたプレイヤーの勝利となります！
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-800 bg-zinc-900/50">
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-zinc-950 font-bold hover:brightness-110 transition-all"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};
