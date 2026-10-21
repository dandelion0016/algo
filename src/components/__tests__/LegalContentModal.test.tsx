import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LegalContentModal } from '../LegalContentModal';

describe('LegalContentModal Component', () => {
  it('isOpen=false の場合は描画されない', () => {
    const { container } = render(<LegalContentModal isOpen={false} onClose={() => {}} />);
    expect(container.firstChild).toBeNull();
  });

  it('タブ切り替えにより「アルゴ解説・攻略」「プライバシーポリシー」「利用規約」を表示できる', () => {
    const onClose = vi.fn();
    render(<LegalContentModal isOpen={true} onClose={onClose} initialTab="guide" />);

    expect(screen.getByTestId('legal-content-modal')).toBeInTheDocument();
    expect(screen.getByTestId('legal-panel-guide')).toBeInTheDocument();
    expect(screen.getByText(/算数オリンピック委員会/)).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('tab-legal-privacy'));
    expect(screen.getByTestId('legal-panel-privacy')).toBeInTheDocument();
    expect(screen.getByText(/グーグル・アドセンス/)).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('tab-legal-terms'));
    expect(screen.getByTestId('legal-panel-terms')).toBeInTheDocument();
    expect(screen.getByText(/免責事項・著作権/)).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
