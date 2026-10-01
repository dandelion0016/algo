import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import {
  TutorialPromptModal,
  STORAGE_KEY_TUTORIAL_SKIP_PROMPT,
  STORAGE_KEY_TUTORIAL_COMPLETED,
  TutorialPromptModalProps,
} from '../TutorialPromptModal';

describe('TutorialPromptModal Component', () => {
  const defaultProps: TutorialPromptModalProps = {
    isOpen: true,
    onStartTutorial: vi.fn(),
    onSkip: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('基本レンダリングとアクセシビリティ', () => {
    it('isOpen が false の場合は何も描画されない', () => {
      const html = renderToString(<TutorialPromptModal {...defaultProps} isOpen={false} />);
      expect(html).toBe('');
    });

    it('isOpen が true の場合にチュートリアル案内モーダルと主要要素が描画される', () => {
      const html = renderToString(<TutorialPromptModal {...defaultProps} isOpen={true} />);

      expect(html).toContain('role="dialog"');
      expect(html).toContain('aria-modal="true"');
      expect(html).toContain('data-testid="tutorial-prompt-modal"');
      expect(html).toContain('はじめての algo ですか？');
      expect(html).toContain('体験チュートリアル（約2分）');
      expect(html).toContain('data-testid="checkbox-skip-prompt"');
      expect(html).toContain('今後この確認を表示しない');
      expect(html).toContain('data-testid="btn-start-tutorial-prompt"');
      expect(html).toContain('チュートリアルを開始する');
      expect(html).toContain('data-testid="btn-skip-tutorial-prompt"');
      expect(html).toContain('スキップして対戦へ進む');
    });
  });

  describe('定数の整合性', () => {
    it('localStorage キーが仕様通り定義されている', () => {
      expect(STORAGE_KEY_TUTORIAL_SKIP_PROMPT).toBe('algo_tutorial_skip_prompt');
      expect(STORAGE_KEY_TUTORIAL_COMPLETED).toBe('algo_tutorial_completed');
    });
  });
});
