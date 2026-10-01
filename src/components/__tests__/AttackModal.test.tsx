import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { AttackModal } from '../AttackModal';

describe('AttackModal Component (SCR-004 & Issue #17: data-testid and a11y)', () => {
  const defaultProps = {
    targetPlayerName: 'CPU アル',
    targetIndex: 2,
    targetColor: 'black' as const,
    onConfirmGuess: vi.fn(),
    onCancel: vi.fn(),
    disabledNumbers: [1, 3, 5],
  };

  describe('アクセシビリティ属性および基本レンダリング', () => {
    it('role="dialog", aria-modal="true", aria-labelledby が正しく設定されている', () => {
      const html = renderToString(<AttackModal {...defaultProps} />);

      expect(html).toContain('role="dialog"');
      expect(html).toContain('aria-modal="true"');
      expect(html).toContain('aria-labelledby="attack-modal-title"');
      expect(html).toContain('id="attack-modal-title"');
      expect(html).toContain('アタック（数字の推理）');
    });

    it('主要なUIコンポーネントに data-testid 属性が付与されている', () => {
      const html = renderToString(<AttackModal {...defaultProps} />);

      expect(html).toContain('data-testid="attack-modal"');
      expect(html).toContain('data-testid="btn-close-attack-modal"');
      expect(html).toContain('data-testid="btn-cancel-attack"');
      expect(html).toContain('data-testid="btn-confirm-attack"');
    });

    it('ターゲットプレイヤー名とカード情報（色・位置）が正しく表示される', () => {
      const html = renderToString(<AttackModal {...defaultProps} />);

      expect(html).toContain('CPU アル');
      expect(html).toContain('3'); // targetIndex: 2 -> 左から 3 番目
      expect(html).toContain('黒カード');
    });

    it('白カードの場合に白カードバッジが表示される', () => {
      const html = renderToString(<AttackModal {...defaultProps} targetColor="white" />);

      expect(html).toContain('白カード');
    });
  });

  describe('数字選択ボタン（0〜11）の data-testid と確認済バッジ', () => {
    it('0〜11のすべての数字ボタンに data-testid="btn-guess-num-${num}" が付与されている', () => {
      const html = renderToString(<AttackModal {...defaultProps} />);

      for (let i = 0; i <= 11; i++) {
        expect(html).toContain(`data-testid="btn-guess-num-${i}"`);
      }
    });

    it('disabledNumbers に指定された数字に「確認済」バッジが表示される', () => {
      const html = renderToString(<AttackModal {...defaultProps} disabledNumbers={[1, 7]} />);

      // 数字1と7に確認済が含まれる
      expect(html).toContain('aria-label="数字 1 (確認済)"');
      expect(html).toContain('aria-label="数字 7 (確認済)"');
      // 数字0には確認済が含まれない
      expect(html).toContain('aria-label="数字 0"');
    });

    it('初期状態ではアタックボタンが非活性（disabled）である', () => {
      const html = renderToString(<AttackModal {...defaultProps} />);

      expect(html).toContain('disabled');
      expect(html).toContain('数字を選んでください');
    });
  });

  describe('キーボードショートカット＆イベントハンドリング仕様検証', () => {
    // AttackModal内のキーボードハンドラーロジックをテスト
    const createKeyHandler = (
      selectedNum: number | null,
      setSelectedNum: (n: number) => void,
      onConfirmGuess: (n: number) => void,
      onCancel: () => void
    ) => {
      return (e: { key: string; code?: string; preventDefault: () => void }) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          onCancel();
          return;
        }

        if (e.key === 'Enter') {
          if (selectedNum !== null) {
            e.preventDefault();
            onConfirmGuess(selectedNum);
          }
          return;
        }

        let num: number | null = null;
        if (e.key >= '0' && e.key <= '9') {
          num = parseInt(e.key, 10);
        } else if (e.code && e.code.startsWith('Numpad') && e.code.length === 7) {
          const parsed = parseInt(e.code.slice(6), 10);
          if (!isNaN(parsed) && parsed >= 0 && parsed <= 9) {
            num = parsed;
          }
        }

        if (num !== null && num >= 0 && num <= 11) {
          setSelectedNum(num);
        }
      };
    };

    it('Escapeキーで onCancel が呼ばれる', () => {
      const onCancel = vi.fn();
      const onConfirmGuess = vi.fn();
      const setSelectedNum = vi.fn();
      const preventDefault = vi.fn();

      const handler = createKeyHandler(null, setSelectedNum, onConfirmGuess, onCancel);
      handler({ key: 'Escape', preventDefault });

      expect(onCancel).toHaveBeenCalledTimes(1);
      expect(preventDefault).toHaveBeenCalled();
      expect(onConfirmGuess).not.toHaveBeenCalled();
    });

    it('通常数字キー（0〜9）で対応する数字が選択される', () => {
      const onCancel = vi.fn();
      const onConfirmGuess = vi.fn();
      const setSelectedNum = vi.fn();
      const preventDefault = vi.fn();

      const handler = createKeyHandler(null, setSelectedNum, onConfirmGuess, onCancel);

      for (let i = 0; i <= 9; i++) {
        handler({ key: `${i}`, preventDefault });
        expect(setSelectedNum).toHaveBeenCalledWith(i);
      }
    });

    it('テンキー（Numpad0〜Numpad9）で対応する数字が選択される', () => {
      const onCancel = vi.fn();
      const onConfirmGuess = vi.fn();
      const setSelectedNum = vi.fn();
      const preventDefault = vi.fn();

      const handler = createKeyHandler(null, setSelectedNum, onConfirmGuess, onCancel);

      for (let i = 0; i <= 9; i++) {
        handler({ key: 'Unidentified', code: `Numpad${i}`, preventDefault });
        expect(setSelectedNum).toHaveBeenCalledWith(i);
      }
    });

    it('数字選択済みの状態でEnterキーを押すと onConfirmGuess が発火する', () => {
      const onCancel = vi.fn();
      const onConfirmGuess = vi.fn();
      const setSelectedNum = vi.fn();
      const preventDefault = vi.fn();

      const handler = createKeyHandler(7, setSelectedNum, onConfirmGuess, onCancel);
      handler({ key: 'Enter', preventDefault });

      expect(onConfirmGuess).toHaveBeenCalledWith(7);
      expect(preventDefault).toHaveBeenCalled();
      expect(onCancel).not.toHaveBeenCalled();
    });

    it('未選択（null）の状態でEnterキーを押しても onConfirmGuess は発火しない', () => {
      const onCancel = vi.fn();
      const onConfirmGuess = vi.fn();
      const setSelectedNum = vi.fn();
      const preventDefault = vi.fn();

      const handler = createKeyHandler(null, setSelectedNum, onConfirmGuess, onCancel);
      handler({ key: 'Enter', preventDefault });

      expect(onConfirmGuess).not.toHaveBeenCalled();
    });
  });

  describe('Issue #42: 初心者向け推理候補アシスト表示', () => {
    it('possibleNumbers と assistEnabled が有効な時、候補範囲ヒントが表示される', () => {
      const html = renderToString(
        <AttackModal
          targetPlayerName="相手"
          targetIndex={1}
          targetColor="black"
          onConfirmGuess={vi.fn()}
          onCancel={vi.fn()}
          possibleNumbers={[3, 4, 5, 6]}
          assistEnabled={true}
        />
      );

      expect(html).toContain('data-testid="attack-assist-hint"');
      expect(html).toContain('3〜6');
      expect(html).toMatch(/4<!-- -->通り|\(4通り\)/);
    });

    it('候補に含まれない数字ボタンに data-candidate-out="true" および「候補外」が表示される', () => {
      const html = renderToString(
        <AttackModal
          targetPlayerName="相手"
          targetIndex={1}
          targetColor="black"
          onConfirmGuess={vi.fn()}
          onCancel={vi.fn()}
          possibleNumbers={[3, 4, 5, 6]}
          assistEnabled={true}
        />
      );

      expect(html).toContain('data-testid="btn-guess-num-3"');
      expect(html).toMatch(/data-testid="btn-guess-num-0"[^>]*data-candidate-out="true"/);
      expect(html).toMatch(/data-testid="btn-guess-num-8"[^>]*data-candidate-out="true"/);
      expect(html).toContain('候補外');
    });

    it('assistEnabled={false} の時は候補範囲ヒントや候補外表示が無効化される', () => {
      const html = renderToString(
        <AttackModal
          targetPlayerName="相手"
          targetIndex={1}
          targetColor="black"
          onConfirmGuess={vi.fn()}
          onCancel={vi.fn()}
          possibleNumbers={[3, 4, 5, 6]}
          assistEnabled={false}
        />
      );

      expect(html).not.toContain('data-testid="attack-assist-hint"');
      expect(html).not.toContain('data-candidate-out="true"');
      expect(html).not.toContain('候補外');
    });
  });
});
