'use client';

import React, { useEffect, useState } from 'react';
import { BookOpen, ShieldCheck, FileText, X } from 'lucide-react';

export type LegalTabType = 'guide' | 'privacy' | 'terms';

export interface LegalContentModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: LegalTabType;
}

export const LegalContentModal: React.FC<LegalContentModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'guide',
}) => {
  const [activeTab, setActiveTab] = useState<LegalTabType>(initialTab);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="legal-modal-title"
      data-testid="legal-content-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="bg-white border border-slate-200 rounded-2xl sm:rounded-3xl max-w-2xl w-full max-h-[88dvh] flex flex-col shadow-2xl overflow-hidden text-slate-800"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-slate-100 bg-slate-50/80 shrink-0">
          <h3 id="legal-modal-title" className="text-sm sm:text-base font-black text-slate-900">
            アルゴ（algo）Web 攻略解説・プライバシーポリシー・利用規約
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="モーダルを閉じる"
            data-testid="btn-close-legal-x"
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div
          role="tablist"
          aria-label="情報カテゴリ選択"
          className="grid grid-cols-3 gap-1 px-3 sm:px-6 pt-2.5 pb-2 bg-slate-50/50 border-b border-slate-200/80 shrink-0"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'guide'}
            data-testid="tab-legal-guide"
            onClick={() => setActiveTab('guide')}
            className={`py-2 px-2 rounded-xl text-[11px] sm:text-xs font-bold flex items-center justify-center gap-1 transition-all ${
              activeTab === 'guide'
                ? 'bg-algo-blue text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5 shrink-0" />
            <span>アルゴ解説・攻略</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'privacy'}
            data-testid="tab-legal-privacy"
            onClick={() => setActiveTab('privacy')}
            className={`py-2 px-2 rounded-xl text-[11px] sm:text-xs font-bold flex items-center justify-center gap-1 transition-all ${
              activeTab === 'privacy'
                ? 'bg-algo-blue text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
            <span>プライバシーポリシー</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'terms'}
            data-testid="tab-legal-terms"
            onClick={() => setActiveTab('terms')}
            className={`py-2 px-2 rounded-xl text-[11px] sm:text-xs font-bold flex items-center justify-center gap-1 transition-all ${
              activeTab === 'terms'
                ? 'bg-algo-blue text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-800 hover:bg-slate-100'
            }`}
          >
            <FileText className="w-3.5 h-3.5 shrink-0" />
            <span>利用規約・免責事項</span>
          </button>
        </div>

        {/* Content Body */}
        <div
          className="p-4 sm:p-6 overflow-y-auto overscroll-contain space-y-4 text-xs sm:text-sm leading-relaxed text-slate-700 flex-1"
          data-testid={`legal-panel-${activeTab}`}
        >
          {activeTab === 'guide' && (
            <article className="space-y-4">
              <section className="space-y-1.5">
                <h4 className="font-black text-slate-900 text-sm sm:text-base border-l-4 border-algo-blue pl-2.5">
                  1. 頭脳派推理カードゲーム「アルゴ（algo）」とは
                </h4>
                <p>
                  「アルゴ（algo）」は、算数オリンピック委員会、数学者ピーター・フランクル氏、東京大学数学科の学生らが共同開発した論理推理カードゲームです。「子どもから大人まで誰もが簡単にルールを覚えられ、かつ奥深い論理的思考力・記憶力・集中力を養えるゲーム」として設計され、教育現場やボードゲーム愛好家の間で長年親しまれています。
                </p>
              </section>

              <section className="space-y-1.5">
                <h4 className="font-black text-slate-900 text-sm sm:text-base border-l-4 border-algo-blue pl-2.5">
                  2. 鉄壁の基本ルールと並び順の法則
                </h4>
                <p>
                  使用するカードは黒の「0〜11」が12枚、白の「0〜11」が12枚の合計24枚です。各プレイヤーに配られた手札は、相手から見て<strong>「左から右へ数字の小さい順」</strong>に伏せて並べます。もし同じ数字の黒カードと白カードがある場合は、<strong>「黒が左、白が右」</strong>に配置されます（例：黒0 ＜ 白0 ＜ 黒1 ＜ 白1 … ＜ 黒11 ＜ 白11）。
                </p>
                <p>
                  自分の手番では山札から1枚カードを引き、相手の伏せカードを1枚指名して数字を宣言（アタック）します。的中すればそのカードは表向き（オープン）になり、続けてアタックするか、引いたカードを自分の手札に伏せて加えて手番を終える（ステイ）かを選べます。外れた場合は、自分が今引いたカードを表向きにして自分の手札に加えなければなりません。
                </p>
              </section>

              <section className="space-y-1.5">
                <h4 className="font-black text-slate-900 text-sm sm:text-base border-l-4 border-algo-blue pl-2.5">
                  3. 勝率を劇的に高める3つの上級戦術・攻略法
                </h4>
                <ul className="list-disc pl-5 space-y-1.5">
                  <li>
                    <strong>境界値からの挟み撃ち推論（絞り込み）</strong>：相手のカードが1枚でもオープンになると、その左右にあるカードの上限・下限が一気に確定します。さらに自分の手札にある数字や既に盤面に出ている数字を除外（消去法）することで、候補が1〜2通りに絞られる「確定マス」が生まれます。
                  </li>
                  <li>
                    <strong>残弾トラッカーと過去ログの徹底活用</strong>：相手が以前アタックして外した数字や、引いたカードが手札のどの位置に挿入されたかを観察しましょう。例えば相手がステイした際、オープン済みの「黒5」と「白7」の間に白カードが挿入されたなら、そのカードは「白5」または「白6」に限定されます。
                  </li>
                  <li>
                    <strong>連続アタックとステイのリスク管理</strong>：引いたカードが「0」や「11」などの端の数字、あるいは自分の手札と連続する数字である場合、外れてオープンになると自分の他の手札まで芋づる式に特定される危険があります。確信度が高い時だけ連続アタックを仕掛け、不確定な場面では早めにステイして自分の手札の枚数（ライフ）を増やす戦略が有効です。
                  </li>
                </ul>
              </section>

              <section className="space-y-1.5">
                <h4 className="font-black text-slate-900 text-sm sm:text-base border-l-4 border-algo-blue pl-2.5">
                  4. よくある質問（FAQ）
                </h4>
                <div className="space-y-2 bg-slate-50 p-3 rounded-xl border border-slate-200/80">
                  <div>
                    <p className="font-bold text-slate-900">Q. 山札が0枚になったらどうなりますか？</p>
                    <p className="text-slate-600">
                      A. 山札がなくなった後はドローを行わず、手番開始時にすぐ相手の伏せカードへアタックします。その際アタックに失敗すると、自分の手札の伏せカードが左から1枚オープンになります。
                    </p>
                  </div>
                  <div>
                    <p className="font-bold text-slate-900">Q. 3人・4人対戦での勝利条件は？</p>
                    <p className="text-slate-600">
                      A. すべての手札がオープンになったプレイヤーから順次脱落し、最後まで伏せカードを1枚以上残して生き残った1名が勝者（サバイバル方式）となります。
                    </p>
                  </div>
                </div>
              </section>
            </article>
          )}

          {activeTab === 'privacy' && (
            <article className="space-y-4">
              <section className="space-y-1.5">
                <h4 className="font-black text-slate-900 text-sm sm:text-base border-l-4 border-algo-blue pl-2.5">
                  1. 広告配信（Google AdSense）について
                </h4>
                <p>
                  当サイト（アルゴ（algo）Web）では、第三者配信の広告サービス「Google AdSense（グーグル・アドセンス）」を利用しています。Googleなどの第三者配信事業者は、ユーザーの興味に応じたパーソナライズ広告を表示するために Cookie（クッキー）を使用することがあります。
                </p>
                <p>
                  Cookieを使用することで、当サイトや他のサイトへの過去のアクセス情報に基づいて広告を配信することが可能になります。ユーザーは{' '}
                  <a
                    href="https://www.google.com/settings/ads"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-algo-blue underline font-bold hover:text-algo-navy"
                  >
                    Googleの広告設定ページ
                  </a>{' '}
                  にアクセスして、パーソナライズ広告をいつでも無効にすることができます（また、www.aboutads.info にアクセスすれば、第三者配信事業者がパーソナライズ広告の掲載で使用する Cookie を無効にできます）。
                </p>
              </section>

              <section className="space-y-1.5">
                <h4 className="font-black text-slate-900 text-sm sm:text-base border-l-4 border-algo-blue pl-2.5">
                  2. ブラウザ保存データ（LocalStorage / Cookie）の利用目的
                </h4>
                <p>
                  当サイトでは、プレイヤーの利便性向上およびゲーム体験の維持のため、お使いのブラウザの LocalStorage および Cookie に以下の情報を保存します。これらの情報には個人を特定できる情報（氏名・住所・メールアドレス等）は一切含まれません。
                </p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>ゲスト識別用ランダムID（`algo_user_id`）および任意のニックネーム設定</li>
                  <li>通算戦績・勝率・アチーブメント達成状況（`algo_player_stats`, `algo_player_achievements`）</li>
                  <li>サウンドON/OFF、初心者アシスト表示、チュートリアル完了状態などの環境設定</li>
                </ul>
              </section>

              <section className="space-y-1.5">
                <h4 className="font-black text-slate-900 text-sm sm:text-base border-l-4 border-algo-blue pl-2.5">
                  3. 個人情報の管理・第三者への開示禁止
                </h4>
                <p>
                  当サイトは、法令に基づく開示請求があった場合を除き、利用者の同意なく個人情報を第三者に開示・提供することはありません。
                </p>
              </section>
            </article>
          )}

          {activeTab === 'terms' && (
            <article className="space-y-4">
              <section className="space-y-1.5">
                <h4 className="font-black text-slate-900 text-sm sm:text-base border-l-4 border-algo-blue pl-2.5">
                  1. 利用規約・サービス内容
                </h4>
                <p>
                  「アルゴ（algo）Web」（以下「本サービス」）は、ブラウザ上で無料で遊べる論理カードゲーム対戦システムです。本サービスを利用されるすべての方は、本規約に同意したものとみなします。
                </p>
              </section>

              <section className="space-y-1.5">
                <h4 className="font-black text-slate-900 text-sm sm:text-base border-l-4 border-algo-blue pl-2.5">
                  2. 禁止事項
                </h4>
                <ul className="list-disc pl-5 space-y-1">
                  <li>本サービスのサーバーやネットワークに過度な負荷をかける行為、不正アクセス行為</li>
                  <li>自動化ツール等による広告の不正クリックや不正インプレッション発生行為</li>
                  <li>その他、運営者が不適切と判断する行為</li>
                </ul>
              </section>

              <section className="space-y-1.5">
                <h4 className="font-black text-slate-900 text-sm sm:text-base border-l-4 border-algo-blue pl-2.5">
                  3. 免責事項・著作権
                </h4>
                <p>
                  本サービスは細心の注意を払って開発・運営しておりますが、動作の完全性・正確性・継続性を保証するものではありません。本サービスの利用により生じたいかなる損害やデータ消失（ブラウザキャッシュ消去等による戦績リセットを含む）についても、運営者（algo Web Project）は一切の責任を負いません。また、予告なく仕様変更や提供の停止を行う場合があります。
                </p>
              </section>

              <section className="space-y-1">
                <h4 className="font-black text-slate-900 text-sm sm:text-base border-l-4 border-algo-blue pl-2.5">
                  4. 運営者情報・策定日
                </h4>
                <p>運営: algo Web Project ／ 制定・改定日: 2026年10月21日</p>
              </section>
            </article>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-6 py-3 border-t border-slate-100 bg-slate-50/80 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            data-testid="btn-close-legal-bottom"
            className="py-2 px-5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs sm:text-sm transition-colors"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};
