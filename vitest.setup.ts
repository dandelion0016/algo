import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// JSDOM環境におけるCanvas APIのモック
if (typeof HTMLCanvasElement !== 'undefined') {
  HTMLCanvasElement.prototype.getContext = vi.fn(() => null) as any;
}

// テスト環境におけるデフォルト言語設定（CIランナーのOSロケール差による日本語テスト失敗を防止）
beforeEach(() => {
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.setItem('algo_language', 'ja');
  }
});

afterEach(() => {
  cleanup();
});
