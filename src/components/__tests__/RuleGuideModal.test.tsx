import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { RuleGuideModal } from '../RuleGuideModal';

describe('RuleGuideModal Component', () => {
  it('isOpen=true のときモーダルおよびバージョン表記が正しく描画される', () => {
    const html = renderToString(<RuleGuideModal isOpen={true} onClose={vi.fn()} />);
    expect(html).toContain('アルゴ（algo）の公式ルール');
    expect(html).toContain('data-testid="rule-modal-version"');
    expect(html).toContain('アルゴ（algo）Web バージョン:');
  });

  it('isOpen=false のときは何も描画されない', () => {
    const html = renderToString(<RuleGuideModal isOpen={false} onClose={vi.fn()} />);
    expect(html).toBe('');
  });
});
