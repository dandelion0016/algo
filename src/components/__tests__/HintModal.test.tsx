import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { HintModal, HintModalProps } from '../HintModal';
import { HintResult } from '../../lib/hintAdvisor';

describe('HintModal Component (Issue #44: AIヒント機能)', () => {
  const mockDefiniteHint: HintResult = {
    targetPlayerId: 'cpu-1',
    targetPlayerName: 'CPU 1',
    targetCardIndex: 1,
    color: 'black',
    possibleNumbers: [3],
    isDefinite: true,
    adviceText: 'CPU 1の左から2枚目の黒カードは [3] に確定しています！',
  };

  const mockNonDefiniteHint: HintResult = {
    targetPlayerId: 'cpu-2',
    targetPlayerName: 'CPU 2',
    targetCardIndex: 3,
    color: 'white',
    possibleNumbers: [10, 11],
    isDefinite: false,
    adviceText: 'CPU 2の右端の白カードは [10, 11] の2択に絞り込まれています！',
  };

  const defaultProps: HintModalProps = {
    isOpen: true,
    onClose: vi.fn(),
    hint: mockDefiniteHint,
    remainingHints: 2,
    canSelectTarget: false,
  };

  it('isOpen が false の場合、何もレンダリングされない', () => {
    const html = renderToString(<HintModal {...defaultProps} isOpen={false} />);
    expect(html).toBe('');
  });

  it('確定ヒントの場合、確定バッジ・アドバイス文・候補数字が表示される', () => {
    const html = renderToString(<HintModal {...defaultProps} />);

    expect(html).toContain('data-testid="modal-hint"');
    expect(html).toContain('残り2回');
    expect(html).toContain('100% 確定！');
    expect(html).toContain('CPU 1の左から2枚目の黒カードは [3] に確定しています！');
    expect(html).toContain('data-testid="hint-possible-numbers"');
    expect(html).toContain('3');
    expect(html).toContain('data-testid="btn-close-hint"');
  });

  it('非確定ヒントの場合、的中率バッジと複数の候補数字が表示される', () => {
    const html = renderToString(
      <HintModal
        {...defaultProps}
        hint={mockNonDefiniteHint}
        remainingHints={1}
      />
    );

    expect(html).toContain('的中率 約50%');
    expect(html).toContain('2択に絞り込まれています！');
    expect(html).toContain('10');
    expect(html).toContain('11');
  });

  it('canSelectTarget が true かつ onSelectTarget がある場合、「このカードを選択する」ボタンが表示される', () => {
    const html = renderToString(
      <HintModal
        {...defaultProps}
        canSelectTarget={true}
        onSelectTarget={vi.fn()}
      />
    );

    expect(html).toContain('data-testid="btn-hint-select-target"');
    expect(html).toContain('このカードを選択する');
  });

  it('canSelectTarget が false の場合、「このカードを選択する」ボタンは表示されない', () => {
    const html = renderToString(
      <HintModal
        {...defaultProps}
        canSelectTarget={false}
      />
    );

    expect(html).not.toContain('data-testid="btn-hint-select-target"');
  });

  it('hint が null の場合、伏せカードがない旨の案内が表示される', () => {
    const html = renderToString(
      <HintModal
        {...defaultProps}
        hint={null}
        remainingHints={0}
      />
    );

    expect(html).toContain('現在、相手の手札に推理可能な伏せカードがありません。');
    expect(html).toContain('data-testid="btn-close-hint"');
  });
});
