import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, screen, act, fireEvent } from '@testing-library/react';
import {
  detectInitialLanguage,
  getStoredLanguage,
  setStoredLanguage,
  translations,
  I18nProvider,
  useI18n,
  LANGUAGE_STORAGE_KEY,
  Language,
} from '../i18n';

describe('i18n module (Issue #162)', () => {
  const originalLanguage = navigator.language;
  const originalLanguages = navigator.languages;
  const originalDateTimeFormat = Intl.DateTimeFormat;

  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
    Object.defineProperty(navigator, 'language', {
      value: originalLanguage,
      configurable: true,
    });
    Object.defineProperty(navigator, 'languages', {
      value: originalLanguages,
      configurable: true,
    });
    Intl.DateTimeFormat = originalDateTimeFormat;
  });

  describe('detectInitialLanguage()', () => {
    it('localStorage に algo_language = en が設定されている場合、en を返す', () => {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, 'en');
      expect(detectInitialLanguage()).toBe('en');
    });

    it('localStorage に algo_language = ja が設定されている場合、ja を返す', () => {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, 'ja');
      expect(detectInitialLanguage()).toBe('ja');
    });

    it('localStorage 未設定時、navigator.language が ja-JP の場合、ja を返す', () => {
      Object.defineProperty(navigator, 'language', {
        value: 'ja-JP',
        configurable: true,
      });
      Object.defineProperty(navigator, 'languages', {
        value: ['ja-JP', 'ja'],
        configurable: true,
      });

      expect(detectInitialLanguage()).toBe('ja');
    });

    it('localStorage 未設定時、navigator.language が en-US であってもタイムゾーンが Asia/Tokyo の場合、ja を返す', () => {
      Object.defineProperty(navigator, 'language', {
        value: 'en-US',
        configurable: true,
      });
      Object.defineProperty(navigator, 'languages', {
        value: ['en-US', 'en'],
        configurable: true,
      });

      const mockResolvedOptions = vi.fn().mockReturnValue({ timeZone: 'Asia/Tokyo' });
      const mockDateTimeFormat = vi.fn().mockImplementation(() => ({
        resolvedOptions: mockResolvedOptions,
      })) as any;
      Intl.DateTimeFormat = mockDateTimeFormat;

      expect(detectInitialLanguage()).toBe('ja');
    });

    it('localStorage 未設定、ブラウザ言語が en-US、タイムゾーンが海外 (America/New_York) の場合、デフォルト en を返す', () => {
      Object.defineProperty(navigator, 'language', {
        value: 'en-US',
        configurable: true,
      });
      Object.defineProperty(navigator, 'languages', {
        value: ['en-US', 'en'],
        configurable: true,
      });

      const mockResolvedOptions = vi.fn().mockReturnValue({ timeZone: 'America/New_York' });
      const mockDateTimeFormat = vi.fn().mockImplementation(() => ({
        resolvedOptions: mockResolvedOptions,
      })) as any;
      Intl.DateTimeFormat = mockDateTimeFormat;

      expect(detectInitialLanguage()).toBe('en');
    });

    it('ヨーロッパロケール (fr-FR / Europe/Paris) の場合もデフォルト en を返す', () => {
      Object.defineProperty(navigator, 'language', {
        value: 'fr-FR',
        configurable: true,
      });
      Object.defineProperty(navigator, 'languages', {
        value: ['fr-FR', 'fr'],
        configurable: true,
      });

      const mockResolvedOptions = vi.fn().mockReturnValue({ timeZone: 'Europe/Paris' });
      const mockDateTimeFormat = vi.fn().mockImplementation(() => ({
        resolvedOptions: mockResolvedOptions,
      })) as any;
      Intl.DateTimeFormat = mockDateTimeFormat;

      expect(detectInitialLanguage()).toBe('en');
    });
  });

  describe('setStoredLanguage() & getStoredLanguage()', () => {
    it('setStoredLanguage で言語を保存し、getStoredLanguage で取得できること', () => {
      expect(getStoredLanguage()).toBeNull();

      setStoredLanguage('en');
      expect(getStoredLanguage()).toBe('en');
      expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('en');
      expect(document.documentElement.lang).toBe('en');

      setStoredLanguage('ja');
      expect(getStoredLanguage()).toBe('ja');
      expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('ja');
      expect(document.documentElement.lang).toBe('ja');
    });
  });

  describe('translations dictionary symmetry', () => {
    it('ja と en で同等のトップレベルカテゴリが存在すること', () => {
      const jaKeys = Object.keys(translations.ja).sort();
      const enKeys = Object.keys(translations.en).sort();
      expect(jaKeys).toEqual(enKeys);
    });

    it('ja と en の各カテゴリ内のキーが完全に一致していること', () => {
      const categories = Object.keys(translations.ja) as Array<keyof typeof translations.ja>;
      for (const cat of categories) {
        const jaSubKeys = Object.keys(translations.ja[cat]).sort();
        const enSubKeys = Object.keys(translations.en[cat]).sort();
        expect(jaSubKeys, `Category: ${cat}`).toEqual(enSubKeys);
      }
    });

    it('主要なゲーミング英語表現が自然かつ適切に定義されていること', () => {
      expect(translations.en.board.drawFromDeck).toBe('Draw a card from the deck');
      expect(translations.en.board.attackPrompt).toBe("Select an opponent's hidden card and attack!");
      expect(translations.en.deckTracker.title).toBe('Card Tracker');
      expect(translations.en.result.handReveal).toBe('Hand Reveal & Review');
      expect(translations.en.attackResult.hit).toBe('HIT! Deduction Correct!');
      expect(translations.en.setup.startMatch).toBe('Start Battle');
    });
  });

  describe('I18nProvider & useI18n() React Hook', () => {
    const TestConsumer: React.FC = () => {
      const { language, setLanguage, t } = useI18n();
      return React.createElement(
        'div',
        null,
        React.createElement('span', { 'data-testid': 'current-lang' }, language),
        React.createElement('span', { 'data-testid': 'app-title' }, t.setup.startMatch),
        React.createElement('span', { 'data-testid': 'tracker-title' }, t.deckTracker.title),
        React.createElement(
          'button',
          {
            type: 'button',
            'data-testid': 'switch-to-en',
            onClick: () => setLanguage('en'),
          },
          'To EN'
        ),
        React.createElement(
          'button',
          {
            type: 'button',
            'data-testid': 'switch-to-ja',
            onClick: () => setLanguage('ja'),
          },
          'To JA'
        )
      );
    };

    it('Provider 配下で言語の初期値と切り替えが正しく反映されること', () => {
      render(
        React.createElement(
          I18nProvider,
          { initialLanguage: 'ja' },
          React.createElement(TestConsumer, null)
        )
      );

      expect(screen.getByTestId('current-lang')).toHaveTextContent('ja');
      expect(screen.getByTestId('app-title')).toHaveTextContent('対戦開始');
      expect(screen.getByTestId('tracker-title')).toHaveTextContent('残弾トラッカー');

      // ENに切り替え
      fireEvent.click(screen.getByTestId('switch-to-en'));

      expect(screen.getByTestId('current-lang')).toHaveTextContent('en');
      expect(screen.getByTestId('app-title')).toHaveTextContent('Start Battle');
      expect(screen.getByTestId('tracker-title')).toHaveTextContent('Card Tracker');
      expect(getStoredLanguage()).toBe('en');

      // JAに戻す
      fireEvent.click(screen.getByTestId('switch-to-ja'));

      expect(screen.getByTestId('current-lang')).toHaveTextContent('ja');
      expect(screen.getByTestId('app-title')).toHaveTextContent('対戦開始');
      expect(screen.getByTestId('tracker-title')).toHaveTextContent('残弾トラッカー');
      expect(getStoredLanguage()).toBe('ja');
    });

    it('Provider 外でも useI18n が安全にフォールバックしてクラッシュしないこと', () => {
      render(React.createElement(TestConsumer, null));
      // デフォルトまたは環境判定結果が取得できる
      expect(screen.getByTestId('current-lang')).toBeInTheDocument();
      expect(screen.getByTestId('app-title')).toBeInTheDocument();
    });
  });
});
