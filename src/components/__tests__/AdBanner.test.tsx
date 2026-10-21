import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AdBanner } from '../AdBanner';

describe('AdBanner Component', () => {
  it('クライアントID未設定かつ showPlaceholder=false (デフォルト) の場合は何も描画しない', () => {
    const { container } = render(<AdBanner clientId="" />);
    expect(container.firstChild).toBeNull();
  });

  it('クライアントID未設定で showPlaceholder=true の場合はプレースホルダー枠を表示する', () => {
    render(<AdBanner clientId="" showPlaceholder={true} />);
    expect(screen.getByTestId('ad-banner-placeholder')).toBeInTheDocument();
  });

  it('有効なクライアントIDが指定された場合はスポンサーリンクと ins.adsbygoogle を描画する', () => {
    render(<AdBanner clientId="ca-pub-1234567890123456" slot="5556667778" format="rectangle" />);
    expect(screen.getByTestId('ad-banner-container')).toBeInTheDocument();
    const ins = screen.getByTestId('adsbygoogle-ins');
    expect(ins).toHaveAttribute('data-ad-client', 'ca-pub-1234567890123456');
    expect(ins).toHaveAttribute('data-ad-slot', '5556667778');
    expect(ins).toHaveAttribute('data-ad-format', 'rectangle');
  });
});
