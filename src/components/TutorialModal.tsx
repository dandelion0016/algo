'use client';

import React, { useState } from 'react';
import {
  Sparkles,
  GraduationCap,
  ArrowRight,
  ArrowLeft,
  X,
  CheckCircle2,
  Trophy,
  Layers,
  HelpCircle,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { CardComponent } from './CardComponent';
import { Card } from '../types/game';

export interface TutorialModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete?: () => void;
  initialStep?: number;
}

export const STORAGE_KEY_TUTORIAL_COMPLETED = 'algo_tutorial_completed';

export const TutorialModal: React.FC<TutorialModalProps> = ({
  isOpen,
  onClose,
  onComplete,
  initialStep = 1,
}) => {
  // ステップ状態: 1〜5, または 6 (修了画面)
  const [step, setStep] = useState<number>(initialStep);

  // Step 2 状態: ドローしたかどうか
  const [hasDrawn, setHasDrawn] = useState<boolean>(false);

  // Step 4 状態: アタック対象選択、推測数字、的中したかどうか
  const [selectedTargetIndex, setSelectedTargetIndex] = useState<number | null>(null);
  const [guessedNumber, setGuessedNumber] = useState<number | null>(null);
  const [isHit, setIsHit] = useState<boolean>(false);
  const [attackFeedback, setAttackFeedback] = useState<string | null>(null);

  // Step 5 状態: ステイしたかどうか（手札にカードが収納されたか）
  const [hasStayed, setHasStayed] = useState<boolean>(false);

  if (!isOpen) return null;

  // Step 1 & 2 用のプレイヤー初期手札
  const initialHand: Card[] = [
    { id: 't-card-1', color: 'black', number: 2, isOpen: false },
    { id: 't-card-2', color: 'white', number: 5, isOpen: false },
    { id: 't-card-3', color: 'black', number: 8, isOpen: false },
    { id: 't-card-4', color: 'white', number: 10, isOpen: false },
  ];

  // ドローするカード
  const drawnCard: Card = {
    id: 't-card-draw',
    color: 'black',
    number: 5,
    isOpen: false,
  };

  // Step 5 で収納後の手札 (黒2, 黒5, 白5, 黒8, 白10)
  const stayedHand: Card[] = [
    { id: 't-card-1', color: 'black', number: 2, isOpen: false },
    { id: 't-card-draw', color: 'black', number: 5, isOpen: false },
    { id: 't-card-2', color: 'white', number: 5, isOpen: false },
    { id: 't-card-3', color: 'black', number: 8, isOpen: false },
    { id: 't-card-4', color: 'white', number: 10, isOpen: false },
  ];

  // 相手の手札
  // Step 4 で左端 [黒 1] がオープンされる
  const opponentCards: Card[] = [
    {
      id: 'opp-1',
      color: 'black',
      number: 1,
      isOpen: isHit || step >= 5,
    },
    {
      id: 'opp-2',
      color: 'white',
      number: 3,
      isOpen: false,
    },
    {
      id: 'opp-3',
      color: 'black',
      number: 7,
      isOpen: false,
    },
  ];

  // ドロー操作
  const handleDraw = () => {
    setHasDrawn(true);
  };

  // アタック確定操作
  const handleAttack = () => {
    if (guessedNumber === null) {
      setAttackFeedback('推理する数字を選択してください！');
      return;
    }
    if (guessedNumber === 1) {
      setIsHit(true);
      setAttackFeedback('🎉 的中！相手の左端カードは「黒の 1」でした！');
    } else {
      setAttackFeedback(`残念！「${guessedNumber}」ではありません。ヒント：0か1ですが、今回は「1」を推理してみましょう！`);
    }
  };

  // ステイ操作
  const handleStay = () => {
    setHasStayed(true);
  };

  // 完了して対戦へ進む
  const handleFinish = () => {
    try {
      localStorage.setItem(STORAGE_KEY_TUTORIAL_COMPLETED, 'true');
    } catch (e) {
      // localStorage error fallback
    }
    if (onComplete) {
      onComplete();
    } else {
      onClose();
    }
  };

  const handleNextStep = () => {
    if (step < 6) {
      setStep((prev) => prev + 1);
    }
  };

  const handlePrevStep = () => {
    if (step > 1) {
      setStep((prev) => prev - 1);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="tutorial-modal-title"
      data-testid="tutorial-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto"
    >
      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[95dvh] sm:max-h-[90dvh] animate-in zoom-in-95 duration-200">
        {/* 装飾プログレスヘッダー */}
        <div className="bg-slate-900 px-4 py-3 sm:px-6 sm:py-3.5 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-algo-blue/30 border border-algo-blue flex items-center justify-center text-algo-yellow">
              <GraduationCap className="w-4 h-4" />
            </div>
            <div>
              <h2 id="tutorial-modal-title" className="text-xs sm:text-sm font-black tracking-tight flex items-center gap-2">
                <span>algo 体験チュートリアル</span>
                <span className="text-[10px] px-2 py-0.2 rounded-full bg-algo-yellow text-slate-950 font-bold">
                  {step <= 5 ? `Step ${step} / 5` : '修了'}
                </span>
              </h2>
            </div>
          </div>

          <button
            type="button"
            data-testid="btn-close-tutorial"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            aria-label="チュートリアルを閉じる"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 5ステップ進捗バー */}
        <div className="h-1.5 bg-slate-100 flex shrink-0">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className={`flex-1 transition-all duration-300 ${
                i <= step ? 'bg-algo-blue' : 'bg-slate-200'
              }`}
            />
          ))}
        </div>

        {/* モーダルコンテンツ本体 (スクロール可能) */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4 text-slate-800">
          {/* STEP 1: 基本ルール（並び順） */}
          {step === 1 && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="bg-sky-50 border border-sky-200/80 rounded-2xl p-3.5 sm:p-4 text-xs sm:text-sm text-sky-900 leading-relaxed">
                <h3 className="font-black text-sm sm:text-base text-sky-950 mb-1 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-algo-blue" />
                  <span>基本ルール：カードの並び順</span>
                </h3>
                <p>
                  algoのカードは<strong>黒0〜11・白0〜11の計24枚</strong>です。
                  手札は常に<strong>「左から小さい順」</strong>に自動で整列されます。
                  同じ数字の場合は<strong>「黒が左・白が右」</strong>になります。
                </p>
              </div>

              {/* 手札の可視化 */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-center space-y-2">
                <span className="text-xs font-bold text-slate-500">あなたの手札（4枚）</span>
                <div
                  data-testid="tutorial-player-hand-step1"
                  className="flex items-center justify-center gap-2 sm:gap-3 py-2 flex-wrap"
                >
                  {initialHand.map((card, idx) => (
                    <div key={card.id} className="flex flex-col items-center gap-1">
                      <CardComponent card={card} isOwner={true} size="sm" />
                      <span className="text-[10px] text-slate-400 font-bold">#{idx + 1}</span>
                    </div>
                  ))}
                </div>
                <div className="inline-flex items-center gap-2 text-[11px] sm:text-xs font-bold text-slate-600 bg-white px-3 py-1.5 rounded-full border border-slate-200 shadow-2xs">
                  <span>並び順:</span>
                  <span className="text-algo-navy">[黒2] &lt; [白5] &lt; [黒8] &lt; [白10]</span>
                </div>
              </div>

              <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-3 text-[11px] sm:text-xs text-amber-900 font-medium">
                💡 相手からはあなたのカードの数字は見えず、すべて伏せカード（?）に見えています。
              </div>
            </div>
          )}

          {/* STEP 2: ドローと消去法 */}
          {step === 2 && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="bg-sky-50 border border-sky-200/80 rounded-2xl p-3.5 sm:p-4 text-xs sm:text-sm text-sky-900 leading-relaxed">
                <h3 className="font-black text-sm sm:text-base text-sky-950 mb-1 flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-algo-blue" />
                  <span>ドローと「消去法」の基本</span>
                </h3>
                <p>
                  自分のターンが来たら、まず山札からカードを1枚引きます（ドロー）。
                  引いたカードは自分だけが見ることができ、アタックの武器になります。
                </p>
              </div>

              {/* ドロー操作インタラクション */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col items-center justify-center gap-3">
                {!hasDrawn ? (
                  <div className="text-center space-y-3">
                    <p className="text-xs sm:text-sm font-bold text-slate-700">
                      下の「山札」をクリックしてカードを引いてみましょう！
                    </p>
                    <button
                      type="button"
                      data-testid="btn-tutorial-draw"
                      onClick={handleDraw}
                      className="w-20 h-28 sm:w-24 sm:h-32 mx-auto rounded-2xl border-2 border-algo-yellow-dark bg-algo-yellow-light/90 shadow-lg shadow-amber-200/60 flex flex-col items-center justify-center gap-1 cursor-pointer hover:scale-105 active:scale-98 transition-all animate-bounce"
                    >
                      <Layers className="w-7 h-7 text-algo-blue" />
                      <span className="text-[10px] font-bold text-slate-600">山札</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-algo-yellow text-slate-950 font-black">
                        引く！
                      </span>
                    </button>
                  </div>
                ) : (
                  <div className="text-center space-y-3 animate-in zoom-in-90 duration-300">
                    <span className="text-xs font-bold text-algo-navy block">
                      ✨ [黒 5] をドローしました！
                    </span>
                    <div className="flex justify-center">
                      <CardComponent card={drawnCard} isOwner={true} size="md" />
                    </div>
                    <div className="p-3 bg-white rounded-xl border border-slate-200 text-xs text-slate-700 leading-relaxed text-left max-w-md mx-auto shadow-2xs">
                      <strong className="text-algo-navy font-bold flex items-center gap-1 mb-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                        <span>消去法のポイント:</span>
                      </strong>
                      カードは世界に1枚ずつしかありません。
                      あなたの手札と引いたカード（黒2, 白5, 黒8, 白10, そして今引いた<strong className="text-algo-navy">黒5</strong>）は、
                      <strong>相手は絶対に持っていません！</strong>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 3: 不等号・範囲の絞り込み */}
          {step === 3 && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="bg-sky-50 border border-sky-200/80 rounded-2xl p-3.5 sm:p-4 text-xs sm:text-sm text-sky-900 leading-relaxed">
                <h3 className="font-black text-sm sm:text-base text-sky-950 mb-1 flex items-center gap-1.5">
                  <HelpCircle className="w-4 h-4 text-algo-blue" />
                  <span>相手カードの範囲を絞り込む</span>
                </h3>
                <p>
                  相手のカードも、あなたと同じルール（左から小さい順、同じ数字は黒が左）で並んでいます。
                  並び順から候補を不等号で絞り込みましょう！
                </p>
              </div>

              {/* 相手カードの並びプレビュー */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-center space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-slate-500 px-2">
                  <span>相手の伏せカード（3枚）</span>
                  <span className="text-algo-blue">左から小さい順</span>
                </div>

                <div className="flex items-center justify-center gap-2 sm:gap-4 py-2">
                  <div className="flex flex-col items-center gap-1">
                    <CardComponent
                      card={{ id: 'opp-t1', color: 'black', number: null, isOpen: false }}
                      isOwner={false}
                      size="sm"
                      label="#1"
                    />
                    <span className="text-[10px] font-bold text-slate-600">黒カード</span>
                  </div>

                  <span className="text-sm font-black text-algo-blue">&lt;</span>

                  <div className="flex flex-col items-center gap-1">
                    <CardComponent
                      card={{ id: 'opp-t2', color: 'white', number: null, isOpen: false }}
                      isOwner={false}
                      size="sm"
                      label="#2"
                    />
                    <span className="text-[10px] font-bold text-slate-600">白カード</span>
                  </div>

                  <span className="text-sm font-black text-algo-blue">&lt;</span>

                  <div className="flex flex-col items-center gap-1">
                    <CardComponent
                      card={{ id: 'opp-t3', color: 'black', number: null, isOpen: false }}
                      isOwner={false}
                      size="sm"
                      label="#3"
                    />
                    <span className="text-[10px] font-bold text-slate-600">黒カード</span>
                  </div>
                </div>

                <div className="bg-white p-3 rounded-xl border border-slate-200 text-left text-xs space-y-1.5 shadow-2xs">
                  <div className="font-bold text-slate-800">🔍 左端の「黒カード（#1）」に注目：</div>
                  <ul className="list-disc pl-4 space-y-1 text-slate-600">
                    <li>全体の最小値は「0」からです。</li>
                    <li>自分はすでに「黒2」を持っているので、相手のカードは黒2ではありません。</li>
                    <li>したがって、左端の黒カードの候補は <strong>0 または 1</strong> に絞り込まれます！</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: アタック実践！ */}
          {step === 4 && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="bg-sky-50 border border-sky-200/80 rounded-2xl p-3.5 sm:p-4 text-xs sm:text-sm text-sky-900 leading-relaxed">
                <h3 className="font-black text-sm sm:text-base text-sky-950 mb-1 flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-algo-blue" />
                  <span>アタック実践！数字を当てよう</span>
                </h3>
                <p>
                  相手のカードをクリックしてアタック対象に指定し、推理した数字を宣言します。
                  相手の左端カード（黒?）をクリックして、<strong>「1」</strong>をアタックしてみましょう！
                </p>
              </div>

              {/* 相手カード選択 */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-slate-500">
                  <span>相手カードをクリックして選択</span>
                  {selectedTargetIndex !== null && (
                    <span className="text-algo-blue">#{selectedTargetIndex + 1} 選択中</span>
                  )}
                </div>

                <div className="flex items-center justify-center gap-3 py-1">
                  {opponentCards.map((card, idx) => (
                    <div key={card.id} className="flex flex-col items-center gap-1">
                      <CardComponent
                        card={card}
                        isOwner={false}
                        size="sm"
                        label={`#${idx + 1}`}
                        isSelected={selectedTargetIndex === idx}
                        isSelectable={idx === 0 && !isHit}
                        onClick={() => setSelectedTargetIndex(idx)}
                        testId={`tutorial-target-card-${idx}`}
                      />
                    </div>
                  ))}
                </div>

                {/* 数字選択パレット */}
                {selectedTargetIndex !== null && !isHit && (
                  <div className="space-y-2 pt-2 border-t border-slate-200 animate-in fade-in duration-150">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700">推理する数字を選択:</span>
                      <span className="text-xs font-mono font-bold text-algo-blue">
                        {guessedNumber !== null ? `選択中: ${guessedNumber}` : '未選択'}
                      </span>
                    </div>

                    <div className="grid grid-cols-6 gap-1.5">
                      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((num) => {
                        const isSelected = guessedNumber === num;
                        // 自分の手札にある黒2, 白5, 黒8, 白10, 黒5 は disabled 演出
                        const isKnown = [2, 5, 8, 10].includes(num);
                        return (
                          <button
                            key={num}
                            type="button"
                            data-testid={`tutorial-guess-btn-${num}`}
                            disabled={isKnown}
                            onClick={() => setGuessedNumber(num)}
                            className={`py-2 rounded-xl font-black text-xs sm:text-sm border transition-all ${
                              isSelected
                                ? 'bg-algo-blue text-white border-algo-blue shadow-md scale-105'
                                : isKnown
                                ? 'bg-slate-100 text-slate-300 border-slate-200 cursor-not-allowed line-through'
                                : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                            }`}
                          >
                            {num}
                          </button>
                        );
                      })}
                    </div>

                    <div className="pt-2 flex justify-center">
                      <button
                        type="button"
                        data-testid="tutorial-btn-attack"
                        onClick={handleAttack}
                        className="py-2.5 px-6 rounded-xl bg-algo-blue hover:bg-blue-600 text-white font-black text-xs sm:text-sm shadow-md transition-all flex items-center gap-1.5"
                      >
                        <Zap className="w-4 h-4 text-algo-yellow" />
                        <span>アタック！</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* フィードバック表示 */}
                {attackFeedback && (
                  <div
                    data-testid="tutorial-attack-feedback"
                    className={`p-3 rounded-xl text-xs sm:text-sm font-bold text-center animate-in zoom-in-95 duration-200 ${
                      isHit
                        ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                        : 'bg-rose-50 border border-rose-200 text-rose-800'
                    }`}
                  >
                    {attackFeedback}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 5: 連続アタックとステイ */}
          {step === 5 && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="bg-sky-50 border border-sky-200/80 rounded-2xl p-3.5 sm:p-4 text-xs sm:text-sm text-sky-900 leading-relaxed">
                <h3 className="font-black text-sm sm:text-base text-sky-950 mb-1 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-algo-blue" />
                  <span>アタック成功後の選択：「ステイ」</span>
                </h3>
                <p>
                  アタックが的中した場合、<strong>「続けて別カードをアタック」</strong>するか、
                  <strong>「手番を終了（ステイ）」</strong>するかを選べます。
                  もし失敗すると引いたカードがオープンペナルティになるため、手堅く「ステイ」するのも大切です！
                </p>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3 text-center">
                {!hasStayed ? (
                  <div className="space-y-3">
                    <p className="text-xs sm:text-sm font-bold text-slate-700">
                      「ステイ」を押して、引いた [黒5] を手札に安全に収納しましょう！
                    </p>
                    <div className="flex justify-center">
                      <button
                        type="button"
                        data-testid="btn-tutorial-stay"
                        onClick={handleStay}
                        className="py-3 px-8 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:brightness-105 active:scale-98 text-white font-black text-sm shadow-md shadow-emerald-400/30 flex items-center gap-2 transition-all border border-emerald-400/50"
                      >
                        <ShieldCheck className="w-5 h-5" />
                        <span>ステイ（手番終了）する</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3 animate-in zoom-in-95 duration-300">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>[黒 5] が手札に自動収納されました！</span>
                    </div>

                    <div
                      data-testid="tutorial-player-hand-step5"
                      className="flex items-center justify-center gap-2 sm:gap-3 py-2 flex-wrap"
                    >
                      {stayedHand.map((card, idx) => (
                        <div key={card.id} className="flex flex-col items-center gap-1">
                          <CardComponent card={card} isOwner={true} size="sm" />
                          <span className="text-[10px] text-slate-400 font-bold">#{idx + 1}</span>
                        </div>
                      ))}
                    </div>

                    <div className="bg-white p-3 rounded-xl border border-slate-200 text-xs text-slate-700 leading-relaxed max-w-md mx-auto text-left shadow-2xs">
                      <p>
                        手札が5枚になり、<strong>[黒2] &lt; [黒5] &lt; [白5] &lt; [黒8] &lt; [白10]</strong> の順に正しく並びました！
                        同数の「5」は<strong>黒が左・白が右</strong>に配置されています。
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 6: チュートリアル修了画面 */}
          {step === 6 && (
            <div className="py-4 text-center space-y-5 animate-in zoom-in-95 duration-200">
              <div className="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-br from-amber-300 via-amber-400 to-yellow-500 border-2 border-amber-200 flex items-center justify-center shadow-lg shadow-amber-300/40 animate-bounce">
                <Trophy className="w-10 h-10 text-slate-950" />
              </div>

              <div>
                <h3 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center justify-center gap-2">
                  <span>チュートリアル修了！</span>
                  <Sparkles className="w-5 h-5 text-algo-yellow-dark" />
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 mt-2 max-w-md mx-auto leading-relaxed">
                  おめでとうございます！並び順ルール・ドロー・消去法・アタック・ステイの流れがマスターできました。
                  さっそくCPUとの本番対戦へ挑みましょう！
                </p>
              </div>

              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl max-w-md mx-auto text-left text-xs space-y-2">
                <div className="font-bold text-slate-800">🎓 覚えたポイント復習：</div>
                <div className="flex items-center gap-2 text-slate-600">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>カードは左から小さい順、同じ数字は黒が左</span>
                </div>
                <div className="flex items-center gap-2 text-slate-600">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>自分の手札にある数字は相手は絶対に持っていない（消去法）</span>
                </div>
                <div className="flex items-center gap-2 text-slate-600">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>アタック的中後は、深追いせずステイする勇気も勝利の鍵</span>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  data-testid="btn-tutorial-finish"
                  onClick={handleFinish}
                  className="w-full sm:w-2/3 py-4 px-6 mx-auto rounded-2xl bg-gradient-to-r from-algo-yellow to-algo-yellow-dark hover:brightness-105 active:scale-98 text-slate-950 font-black text-base shadow-lg shadow-amber-300/50 flex items-center justify-center gap-2 transition-all border border-amber-300/60"
                >
                  <span>対戦を開始する！</span>
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 下部ナビゲーションバー（Step 1〜5） */}
        {step <= 5 && (
          <div className="bg-slate-50 border-t border-slate-200 px-4 py-3 sm:px-6 sm:py-3.5 flex items-center justify-between shrink-0">
            {step > 1 ? (
              <button
                type="button"
                data-testid="btn-tutorial-prev"
                onClick={handlePrevStep}
                className="py-2 px-3 sm:px-4 rounded-xl border border-slate-200 bg-white text-slate-700 font-bold text-xs sm:text-sm hover:bg-slate-100 flex items-center gap-1.5 transition-all"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>前へ</span>
              </button>
            ) : (
              <div />
            )}

            <button
              type="button"
              data-testid={`btn-tutorial-next-${step}`}
              onClick={handleNextStep}
              className="py-2.5 px-5 sm:px-6 rounded-xl bg-algo-blue hover:bg-blue-600 active:scale-98 text-white font-bold text-xs sm:text-sm flex items-center gap-1.5 shadow-sm transition-all"
            >
              <span>{step === 5 ? '修了へ' : '次へ進む'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
