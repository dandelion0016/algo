import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import {
  TutorialModal,
  STORAGE_KEY_TUTORIAL_COMPLETED,
  TutorialModalProps,
} from '../TutorialModal';

describe('TutorialModal Component (Issue #41: インタラクティブチュートリアル)', () => {
  const defaultProps: TutorialModalProps = {
    isOpen: true,
    onClose: vi.fn(),
    onComplete: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('基本レンダリングとアクセシビリティ', () => {
    it('isOpen が false の場合は何も描画されない', () => {
      const html = renderToString(<TutorialModal {...defaultProps} isOpen={false} />);
      expect(html).toBe('');
    });

    it('isOpen が true の場合にモーダル本体、閉じるボタン、プログレスバーが描画される', () => {
      const html = renderToString(<TutorialModal {...defaultProps} isOpen={true} />);

      expect(html).toContain('role="dialog"');
      expect(html).toContain('aria-modal="true"');
      expect(html).toContain('aria-labelledby="tutorial-modal-title"');
      expect(html).toContain('data-testid="tutorial-modal"');
      expect(html).toContain('data-testid="btn-close-tutorial"');
      expect(html).toContain('algo 体験チュートリアル');
    });
  });

  describe('Step 1: 基本ルール（カード並び順）', () => {
    it('基本ルール説明とプレイヤーの手札4枚（黒2, 白5, 黒8, 白10）が正しく描画される', () => {
      const html = renderToString(<TutorialModal {...defaultProps} initialStep={1} />);

      expect(html).toContain('基本ルール：カードの並び順');
      expect(html).toContain('左から小さい順');
      expect(html).toContain('黒が左・白が右');
      expect(html).toContain('data-testid="tutorial-player-hand-step1"');
      expect(html).toContain('[黒2] &lt; [白5] &lt; [黒8] &lt; [白10]');
      expect(html).toContain('data-testid="btn-tutorial-next-1"');
      expect(html).toContain('次へ進む');
    });
  });

  describe('Step 2: ドローと消去法', () => {
    it('山札ドロー操作ボタンと消去法ガイダンスが描画される', () => {
      const html = renderToString(<TutorialModal {...defaultProps} initialStep={2} />);

      expect(html).toContain('ドローと「消去法」の基本');
      expect(html).toContain('data-testid="btn-tutorial-draw"');
      expect(html).toContain('山札');
      expect(html).toContain('引く！');
      expect(html).toContain('data-testid="btn-tutorial-prev"');
      expect(html).toContain('data-testid="btn-tutorial-next-2"');
    });
  });

  describe('Step 3: 不等号・範囲の絞り込み', () => {
    it('相手カードの不等号プレビューと範囲絞り込みの解説が描画される', () => {
      const html = renderToString(<TutorialModal {...defaultProps} initialStep={3} />);

      expect(html).toContain('相手カードの範囲を絞り込む');
      expect(html).toContain('相手の伏せカード（3枚）');
      expect(html).toContain('&lt;');
      expect(html).toContain('左端の「黒カード（#1）」に注目');
      expect(html).toContain('0 または 1');
      expect(html).toContain('data-testid="btn-tutorial-next-3"');
    });
  });

  describe('Step 4: アタック実践', () => {
    it('相手カードのターゲット指定とアタック用カード要素が描画される', () => {
      const html = renderToString(<TutorialModal {...defaultProps} initialStep={4} />);

      expect(html).toContain('アタック実践！数字を当てよう');
      expect(html).toContain('data-testid="tutorial-target-card-0"');
      expect(html).toContain('data-testid="tutorial-target-card-1"');
      expect(html).toContain('data-testid="tutorial-target-card-2"');
      expect(html).toContain('data-testid="btn-tutorial-next-4"');
    });
  });

  describe('Step 5: 連続アタックとステイ', () => {
    it('ステイボタンおよび手札収納ガイダンスが描画される', () => {
      const html = renderToString(<TutorialModal {...defaultProps} initialStep={5} />);

      expect(html).toContain('アタック成功後の選択：「ステイ」');
      expect(html).toContain('data-testid="btn-tutorial-stay"');
      expect(html).toContain('ステイ（手番終了）する');
      expect(html).toContain('data-testid="btn-tutorial-next-5"');
    });
  });

  describe('Step 6: チュートリアル修了画面', () => {
    it('修了トロフィー、重要ポイント復習、対戦開始ボタンが描画される', () => {
      const html = renderToString(<TutorialModal {...defaultProps} initialStep={6} />);

      expect(html).toContain('チュートリアル修了！');
      expect(html).toContain('覚えたポイント復習');
      expect(html).toContain('カードは左から小さい順、同じ数字は黒が左');
      expect(html).toContain('自分の手札にある数字は相手は絶対に持っていない（消去法）');
      expect(html).toContain('data-testid="btn-tutorial-finish"');
      expect(html).toContain('対戦を開始する！');
    });
  });

  describe('定数の定義', () => {
    it('STORAGE_KEY_TUTORIAL_COMPLETED が仕様通りのキー名であること', () => {
      expect(STORAGE_KEY_TUTORIAL_COMPLETED).toBe('algo_tutorial_completed');
    });
  });
});
