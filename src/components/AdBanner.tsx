'use client';

import React, { useEffect } from 'react';
import { getAdSenseConfig } from '../lib/adsense';

export interface AdBannerProps {
  slot?: string;
  format?: 'auto' | 'fluid' | 'rectangle' | 'horizontal';
  className?: string;
  clientId?: string;
  showPlaceholder?: boolean;
}

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

export const AdBanner: React.FC<AdBannerProps> = ({
  slot,
  format = 'auto',
  className = '',
  clientId,
  showPlaceholder = false,
}) => {
  const config = getAdSenseConfig({
    clientId,
    slotSetup: slot,
  });

  useEffect(() => {
    if (!config.enabled) return;
    try {
      if (typeof window !== 'undefined') {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      }
    } catch {
      // AdBlocker環境や重複push時のエラーを安全に無視
    }
  }, [config.enabled]);

  if (!config.enabled) {
    if (!showPlaceholder) {
      return null;
    }
    return (
      <div
        data-testid="ad-banner-placeholder"
        className={`w-full rounded-xl border border-dashed border-slate-200 bg-slate-50/70 p-2 text-center text-[10px] text-slate-400 ${className}`}
      >
        スポンサーリンク（広告枠プレースホルダー）
      </div>
    );
  }

  return (
    <aside
      aria-label="スポンサーリンク"
      data-testid="ad-banner-container"
      className={`w-full rounded-xl border border-slate-200/70 bg-slate-50/60 px-2 py-1.5 text-center overflow-hidden ${className}`}
    >
      <div className="text-[9px] text-slate-400 font-medium mb-0.5 tracking-wider">
        スポンサーリンク
      </div>
      <ins
        className="adsbygoogle block"
        style={{ display: 'block' }}
        data-testid="adsbygoogle-ins"
        data-ad-client={config.clientId}
        data-ad-slot={config.slotSetup || '0000000000'}
        data-ad-format={format}
        data-full-width-responsive="true"
      />
    </aside>
  );
};
