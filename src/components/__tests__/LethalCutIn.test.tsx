import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, fireEvent, act } from '@testing-library/react';
import { LethalCutIn } from '../LethalCutIn';

describe('LethalCutIn (Issue #73: リーサル決着ダイナミックK.O.演出)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('isActive: false の場合、DOMに何もレンダリングされない', () => {
    const { container } = render(
      <LethalCutIn isActive={false} />
    );

    expect(container.firstChild).toBeNull();
    expect(container.querySelector('[data-testid="lethal-ko-cutin"]')).toBeNull();
  });

  it('isActive: true の場合、カットイン演出がレンダリングされ「💥 FINISH!!」が表示される', () => {
    const { getByTestId, getByText } = render(
      <LethalCutIn isActive={true} winnerName="あなた" />
    );

    const cutInElement = getByTestId('lethal-ko-cutin');
    expect(cutInElement).not.toBeNull();
    expect(cutInElement.getAttribute('role')).toBe('alert');
    expect(cutInElement.getAttribute('aria-live')).toBe('assertive');

    expect(getByText('💥 FINISH!!')).not.toBeNull();
    expect(getByText(/LETHAL HIT! K.O./i)).not.toBeNull();
    expect(getByText('あなた の完全勝利！')).not.toBeNull();
  });

  it('クリックされた場合、即座に onComplete コールバックが呼び出される（手動スキップ）', () => {
    const onCompleteMock = vi.fn();
    const { getByTestId } = render(
      <LethalCutIn isActive={true} onComplete={onCompleteMock} />
    );

    fireEvent.click(getByTestId('lethal-ko-cutin'));
    expect(onCompleteMock).toHaveBeenCalledTimes(1);
  });

  it('EscapeキーまたはEnterキー押下時にも onComplete コールバックが呼び出される', () => {
    const onCompleteMock = vi.fn();
    render(
      <LethalCutIn isActive={true} onComplete={onCompleteMock} />
    );

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onCompleteMock).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(window, { key: 'Enter' });
    expect(onCompleteMock).toHaveBeenCalledTimes(2);
  });

  it('指定ミリ秒（durationMs）経過後に自動的に onComplete コールバックが呼び出される', () => {
    const onCompleteMock = vi.fn();
    render(
      <LethalCutIn isActive={true} durationMs={1200} onComplete={onCompleteMock} />
    );

    expect(onCompleteMock).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1199);
    });
    expect(onCompleteMock).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(onCompleteMock).toHaveBeenCalledTimes(1);
  });

  it('winnerName が未指定の場合でもデフォルトの勝敗案内が表示される', () => {
    const { getByText } = render(
      <LethalCutIn isActive={true} />
    );

    expect(getByText('勝敗が決しました！')).not.toBeNull();
  });
});
