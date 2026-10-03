import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { RuleGuideModal } from '../RuleGuideModal';

describe('RuleGuideModal Component (Issue #86)', () => {
  it('isOpen が false の場合、何もレンダリングされない', () => {
    const html = renderToString(<RuleGuideModal isOpen={false} onClose={vi.fn()} />);
    expect(html).toBe('');
  });

  it('isOpen が true の場合、公式ルールモーダルが表示される', () => {
    const html = renderToString(<RuleGuideModal isOpen={true} onClose={vi.fn()} />);
    expect(html).toContain('data-testid="rule-guide-modal"');
    expect(html).toContain('アルゴ（algo）の公式ルール');
    expect(html).toContain('data-testid="btn-close-rules-x"');
  });

  it('isTimedMatch が true の場合、持ち時間対戦中のタイマー進行警告バナーが表示される (Issue #86)', () => {
    const html = renderToString(
      <RuleGuideModal isOpen={true} onClose={vi.fn()} isTimedMatch={true} />
    );
    expect(html).toContain('data-testid="timed-match-warning"');
    expect(html).toContain('持ち時間対戦中のためタイマーは進行しています');
  });

  it('isTimedMatch が false または未指定の場合、タイマー進行警告バナーは表示されない', () => {
    const html = renderToString(
      <RuleGuideModal isOpen={true} onClose={vi.fn()} isTimedMatch={false} />
    );
    expect(html).not.toContain('data-testid="timed-match-warning"');
  });
});
