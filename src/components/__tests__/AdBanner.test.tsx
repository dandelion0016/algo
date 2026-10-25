import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AdBanner } from '../AdBanner';
import { DEFAULT_ADSENSE_CLIENT_ID } from '../../lib/adsense';

describe('AdBanner Component', () => {
  it('不正なクライアントID（無効）かつ showPlaceholder=false (デフォルト) の場合は何も描画しない', () => {
    const { container } = render(<AdBanner clientId="invalid-client-id" />);
    expect(container.firstChild).toBeNull();
  });

  it('不正なクライアントID（無効）で showPlaceholder=true の場合はプレースホルダー枠を表示する', () => {
    render(<AdBanner clientId="invalid-client-id" showPlaceholder={true} />);
    expect(screen.getByTestId('ad-banner-placeholder')).toBeInTheDocument();
  });

  it('デフォルト（引数なし）の場合は DEFAULT_ADSENSE_CLIENT_ID を採用してスポンサーリンクを描画する', () => {
    render(<AdBanner />);
    expect(screen.getByTestId('ad-banner-container')).toBeInTheDocument();
    const ins = screen.getByTestId('adsbygoogle-ins');
    expect(ins).toHaveAttribute('data-ad-client', DEFAULT_ADSENSE_CLIENT_ID);
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
