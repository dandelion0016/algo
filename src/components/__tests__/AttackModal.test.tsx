import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { render, screen, fireEvent, act } from '@testing-library/react';
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

  describe('キーボードショートカット＆イベントハンドリング仕様検証 (Issue #70: 2桁数字「10」「11」、矢印キー、Enter/Escape)', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('Escapeキーで onCancel が呼ばれる', () => {
      const onCancel = vi.fn();
      render(<AttackModal {...defaultProps} disabledNumbers={[]} onCancel={onCancel} />);

      fireEvent.keyDown(window, { key: 'Escape' });

      expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it('通常数字キー（0〜9）で対応する数字が選択される', () => {
      render(<AttackModal {...defaultProps} disabledNumbers={[]} />);

      for (let i = 2; i <= 9; i++) {
        fireEvent.keyDown(window, { key: `${i}` });
        const btn = screen.getByTestId(`btn-guess-num-${i}`);
        expect(btn).toHaveAttribute('aria-pressed', 'true');
      }
    });

    it('テンキー（Numpad0〜Numpad9）で対応する数字が選択される', () => {
      render(<AttackModal {...defaultProps} disabledNumbers={[]} />);

      fireEvent.keyDown(window, { key: 'Unidentified', code: 'Numpad3' });
      const btn = screen.getByTestId('btn-guess-num-3');
      expect(btn).toHaveAttribute('aria-pressed', 'true');
    });

    it('キーボード「1」→「0」の連続入力で数字「10」が選択される (Issue #70)', () => {
      render(<AttackModal {...defaultProps} disabledNumbers={[]} />);

      // 「1」を押下
      fireEvent.keyDown(window, { key: '1' });
      expect(screen.getByTestId('btn-guess-num-1')).toHaveAttribute('aria-pressed', 'true');

      // 600ms 以内に「0」を押下
      fireEvent.keyDown(window, { key: '0' });
      expect(screen.getByTestId('btn-guess-num-10')).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByTestId('btn-guess-num-1')).toHaveAttribute('aria-pressed', 'false');
    });

    it('キーボード「1」→「1」の連続入力で数字「11」が選択される (Issue #70)', () => {
      render(<AttackModal {...defaultProps} disabledNumbers={[]} />);

      // 「1」を押下
      fireEvent.keyDown(window, { key: '1' });
      expect(screen.getByTestId('btn-guess-num-1')).toHaveAttribute('aria-pressed', 'true');

      // 600ms 以内に「1」を押下
      fireEvent.keyDown(window, { key: '1' });
      expect(screen.getByTestId('btn-guess-num-11')).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByTestId('btn-guess-num-1')).toHaveAttribute('aria-pressed', 'false');
    });

    it('「1」入力後に600ms待機時間が経過した場合、バッファが破棄されて次の数字が単独選択される (Issue #70)', () => {
      render(<AttackModal {...defaultProps} disabledNumbers={[]} />);

      fireEvent.keyDown(window, { key: '1' });
      expect(screen.getByTestId('btn-guess-num-1')).toHaveAttribute('aria-pressed', 'true');

      // 600ms 経過
      act(() => {
        vi.advanceTimersByTime(600);
      });

      // その後「0」を押下 -> 「10」ではなく「0」が選択される
      fireEvent.keyDown(window, { key: '0' });
      expect(screen.getByTestId('btn-guess-num-0')).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByTestId('btn-guess-num-10')).toHaveAttribute('aria-pressed', 'false');
    });

    it('矢印キー（ArrowLeft / ArrowRight / ArrowUp / ArrowDown）で選択数字が移動する (Issue #70)', () => {
      render(<AttackModal {...defaultProps} disabledNumbers={[]} />);

      // 初期未選択から ArrowRight を押すと 0 が選択される
      fireEvent.keyDown(window, { key: 'ArrowRight' });
      expect(screen.getByTestId('btn-guess-num-0')).toHaveAttribute('aria-pressed', 'true');

      // 0 から ArrowRight で 1 に移動
      fireEvent.keyDown(window, { key: 'ArrowRight' });
      expect(screen.getByTestId('btn-guess-num-1')).toHaveAttribute('aria-pressed', 'true');

      // 1 から ArrowDown で 5 に移動 (4列グリッド)
      fireEvent.keyDown(window, { key: 'ArrowDown' });
      expect(screen.getByTestId('btn-guess-num-5')).toHaveAttribute('aria-pressed', 'true');

      // 5 から ArrowUp で 1 に戻る
      fireEvent.keyDown(window, { key: 'ArrowUp' });
      expect(screen.getByTestId('btn-guess-num-1')).toHaveAttribute('aria-pressed', 'true');

      // 1 から ArrowLeft で 0 に戻る
      fireEvent.keyDown(window, { key: 'ArrowLeft' });
      expect(screen.getByTestId('btn-guess-num-0')).toHaveAttribute('aria-pressed', 'true');

      // 0 で ArrowLeft を押しても 0 に留まる（下限ガード）
      fireEvent.keyDown(window, { key: 'ArrowLeft' });
      expect(screen.getByTestId('btn-guess-num-0')).toHaveAttribute('aria-pressed', 'true');

      // 11 まで移動して ArrowRight を押しても 11 に留まる（上限ガード）
      fireEvent.keyDown(window, { key: '1' });
      fireEvent.keyDown(window, { key: '1' });
      expect(screen.getByTestId('btn-guess-num-11')).toHaveAttribute('aria-pressed', 'true');

      fireEvent.keyDown(window, { key: 'ArrowRight' });
      expect(screen.getByTestId('btn-guess-num-11')).toHaveAttribute('aria-pressed', 'true');
    });

    it('矢印キーで数字選択後、Enterキーでアタックが実行される (Issue #70)', () => {
      const onConfirmGuess = vi.fn();
      render(<AttackModal {...defaultProps} disabledNumbers={[]} onConfirmGuess={onConfirmGuess} />);

      // ArrowRight で 0 を選択
      fireEvent.keyDown(window, { key: 'ArrowRight' });
      // ArrowRight で 1 を選択
      fireEvent.keyDown(window, { key: 'ArrowRight' });
      // Enter で決定
      fireEvent.keyDown(window, { key: 'Enter' });

      expect(onConfirmGuess).toHaveBeenCalledTimes(1);
      expect(onConfirmGuess).toHaveBeenCalledWith(1);
    });

    it('数字未選択（null）の状態でEnterキーを押しても onConfirmGuess は発火しない', () => {
      const onConfirmGuess = vi.fn();
      render(<AttackModal {...defaultProps} disabledNumbers={[]} onConfirmGuess={onConfirmGuess} />);

      fireEvent.keyDown(window, { key: 'Enter' });

      expect(onConfirmGuess).not.toHaveBeenCalled();
    });
  });

  describe('Issue #85: disabledNumbers に対するキーボード操作および確定送信のバリデーション', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('通常数字キーで disabledNumbers に含まれる数字を押しても選択状態にならない', () => {
      render(<AttackModal {...defaultProps} disabledNumbers={[3, 5, 8]} />);

      // 数字「3」を押下
      fireEvent.keyDown(window, { key: '3' });
      expect(screen.getByTestId('btn-guess-num-3')).toHaveAttribute('aria-pressed', 'false');

      // 数字「5」を押下
      fireEvent.keyDown(window, { key: '5' });
      expect(screen.getByTestId('btn-guess-num-5')).toHaveAttribute('aria-pressed', 'false');

      // 有効な数字「4」を押下すると正常に選択される
      fireEvent.keyDown(window, { key: '4' });
      expect(screen.getByTestId('btn-guess-num-4')).toHaveAttribute('aria-pressed', 'true');
    });

    it('テンキー（Numpad）で disabledNumbers に含まれる数字を押しても選択状態にならない', () => {
      render(<AttackModal {...defaultProps} disabledNumbers={[3, 5]} />);

      // テンキー「3」を押下
      fireEvent.keyDown(window, { key: 'Unidentified', code: 'Numpad3' });
      expect(screen.getByTestId('btn-guess-num-3')).toHaveAttribute('aria-pressed', 'false');

      // テンキー「2」を押下すると正常に選択される
      fireEvent.keyDown(window, { key: 'Unidentified', code: 'Numpad2' });
      expect(screen.getByTestId('btn-guess-num-2')).toHaveAttribute('aria-pressed', 'true');
    });

    it('矢印キー移動時、disabledNumbers に含まれる数字が自動的にスキップされる', () => {
      // 1 と 2 が disabled
      render(<AttackModal {...defaultProps} disabledNumbers={[1, 2]} />);

      // 初期未選択から ArrowRight を押すと 0 が選択される
      fireEvent.keyDown(window, { key: 'ArrowRight' });
      expect(screen.getByTestId('btn-guess-num-0')).toHaveAttribute('aria-pressed', 'true');

      // 0 から ArrowRight を押すと、1 と 2 をスキップして 3 が選択される
      fireEvent.keyDown(window, { key: 'ArrowRight' });
      expect(screen.getByTestId('btn-guess-num-3')).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByTestId('btn-guess-num-1')).toHaveAttribute('aria-pressed', 'false');
      expect(screen.getByTestId('btn-guess-num-2')).toHaveAttribute('aria-pressed', 'false');

      // 3 から ArrowLeft を押すと、2 と 1 をスキップして 0 に戻る
      fireEvent.keyDown(window, { key: 'ArrowLeft' });
      expect(screen.getByTestId('btn-guess-num-0')).toHaveAttribute('aria-pressed', 'true');
    });

    it('矢印キー上・下移動時、disabledNumbers に含まれる数字が縦方向でもスキップされる', () => {
      // 4列グリッド: 1の4つ下は5
      render(<AttackModal {...defaultProps} disabledNumbers={[5]} />);

      // 1 を選択
      fireEvent.keyDown(window, { key: '1' });
      expect(screen.getByTestId('btn-guess-num-1')).toHaveAttribute('aria-pressed', 'true');

      // ArrowDown で 5 をスキップして 9 に移動
      fireEvent.keyDown(window, { key: 'ArrowDown' });
      expect(screen.getByTestId('btn-guess-num-9')).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByTestId('btn-guess-num-5')).toHaveAttribute('aria-pressed', 'false');

      // ArrowUp で 5 をスキップして 1 に戻る
      fireEvent.keyDown(window, { key: 'ArrowUp' });
      expect(screen.getByTestId('btn-guess-num-1')).toHaveAttribute('aria-pressed', 'true');
    });

    it('未選択状態で矢印キーを押した際、「0」が disabledNumbers の場合はスキップして有効な最小数字が選択される', () => {
      render(<AttackModal {...defaultProps} disabledNumbers={[0, 1]} />);

      fireEvent.keyDown(window, { key: 'ArrowRight' });
      // 0 と 1 がスキップされ 2 が選択される
      expect(screen.getByTestId('btn-guess-num-2')).toHaveAttribute('aria-pressed', 'true');
    });

    it('数字「1」が disabledNumbers でもバッファリングは動作し、有効な「10」が入力できる', () => {
      render(<AttackModal {...defaultProps} disabledNumbers={[1]} />);

      // 「1」を押下 -> 1 は disabledNumbers なので選択されない
      fireEvent.keyDown(window, { key: '1' });
      expect(screen.getByTestId('btn-guess-num-1')).toHaveAttribute('aria-pressed', 'false');

      // 続いて「0」を押下 -> 10 は有効なので 10 が選択される
      fireEvent.keyDown(window, { key: '0' });
      expect(screen.getByTestId('btn-guess-num-10')).toHaveAttribute('aria-pressed', 'true');
    });

    it('2桁数字「10」または「11」が disabledNumbers の場合、2桁入力しても選択されない', () => {
      render(<AttackModal {...defaultProps} disabledNumbers={[10, 11]} />);

      // 「1」を押下 -> 1 は有効なので一旦 1 が選択される
      fireEvent.keyDown(window, { key: '1' });
      expect(screen.getByTestId('btn-guess-num-1')).toHaveAttribute('aria-pressed', 'true');

      // 続いて「0」を押下 -> 10 は disabledNumbers なので 10 は選択されず、1のまま
      fireEvent.keyDown(window, { key: '0' });
      expect(screen.getByTestId('btn-guess-num-10')).toHaveAttribute('aria-pressed', 'false');
    });

    it('Enterキー押下時、選択数字が disabledNumbers の場合は onConfirmGuess が呼ばれない', () => {
      const onConfirmGuess = vi.fn();
      const { rerender } = render(
        <AttackModal {...defaultProps} disabledNumbers={[]} onConfirmGuess={onConfirmGuess} />
      );

      // 有効な状態で「3」を選択
      fireEvent.keyDown(window, { key: '3' });
      expect(screen.getByTestId('btn-guess-num-3')).toHaveAttribute('aria-pressed', 'true');

      // 途中で props の disabledNumbers が更新され 3 が含まれた状況をシミュレート
      rerender(
        <AttackModal {...defaultProps} disabledNumbers={[3]} onConfirmGuess={onConfirmGuess} />
      );

      // Enterキーを押下
      fireEvent.keyDown(window, { key: 'Enter' });

      // onConfirmGuess は呼び出されないこと
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

  describe('過去の外れ宣言・失敗数字の視覚化 (Issue #43)', () => {
    it('failedNumbers が渡された場合、過去の外れ宣言サマリが表示される', () => {
      const html = renderToString(
        <AttackModal
          {...defaultProps}
          failedNumbers={[3, 7]}
        />
      );

      expect(html).toContain('data-testid="attack-failed-numbers-hint"');
      expect(html).toContain('過去の外れ宣言:');
      expect(html).toContain('✕3,7');
    });

    it('外れた数字ボタンに data-failed-guess="true", ✕ハズレ済バッジ, aria-label が付与される', () => {
      const html = renderToString(
        <AttackModal
          {...defaultProps}
          failedNumbers={[3, 7]}
        />
      );

      // ボタン属性
      expect(html).toMatch(/data-testid="btn-guess-num-3"[^>]*data-failed-guess="true"/);
      expect(html).toMatch(/data-testid="btn-guess-num-7"[^>]*data-failed-guess="true"/);

      // バッジ
      expect(html).toContain('data-testid="failed-badge-3"');
      expect(html).toContain('data-testid="failed-badge-7"');
      expect(html).toContain('✕ハズレ済');

      // aria-label
      expect(html).toContain('aria-label="数字 3 (✕ハズレ済)"');
      expect(html).toContain('aria-label="数字 7 (✕ハズレ済)"');

      // 外れていない数字には付与されない
      expect(html).not.toMatch(/data-testid="btn-guess-num-2"[^>]*data-failed-guess="true"/);
    });

    it('failedNumbers が空の場合は過去の外れ宣言サマリは表示されない', () => {
      const html = renderToString(
        <AttackModal
          {...defaultProps}
          failedNumbers={[]}
        />
      );

      expect(html).not.toContain('data-testid="attack-failed-numbers-hint"');
    });
  });
});
