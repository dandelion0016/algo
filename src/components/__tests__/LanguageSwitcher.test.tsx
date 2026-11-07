import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LanguageSwitcher } from '../LanguageSwitcher';
import { I18nProvider, LANGUAGE_STORAGE_KEY } from '../../lib/i18n';

describe('LanguageSwitcher Component (Issue #162)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('Header variant', () => {
    it('日本語状態では "🌐 EN" と表示され、クリックで英語に切り替わり "🌐 JA" になること', () => {
      const onToggle = vi.fn();
      render(
        <I18nProvider initialLanguage="ja">
          <LanguageSwitcher variant="header" onLanguageChange={onToggle} />
        </I18nProvider>
      );

      const button = screen.getByTestId('header-language-toggle');
      expect(button).toHaveTextContent('🌐 EN');

      fireEvent.click(button);

      expect(button).toHaveTextContent('🌐 JA');
      expect(onToggle).toHaveBeenCalledWith('en');
      expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('en');

      // 再度クリックで日本語に戻る
      fireEvent.click(button);
      expect(button).toHaveTextContent('🌐 EN');
      expect(onToggle).toHaveBeenCalledWith('ja');
      expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('ja');
    });
  });

  describe('Menu variant (Mobile drawer)', () => {
    it('モバイルメニュー用バリアントで言語切り替えが正しく動作すること', () => {
      render(
        <I18nProvider initialLanguage="ja">
          <LanguageSwitcher variant="menu" />
        </I18nProvider>
      );

      const menuBtn = screen.getByTestId('mobile-menu-language-toggle');
      expect(menuBtn).toBeInTheDocument();
      expect(menuBtn).toHaveTextContent('表示言語');
      expect(menuBtn).toHaveTextContent('JA');

      fireEvent.click(menuBtn);

      expect(menuBtn).toHaveTextContent('Display Language');
      expect(menuBtn).toHaveTextContent('EN');
      expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('en');
    });
  });

  describe('Setup variant', () => {
    it('セットアップ画面用バリアントで表示・切り替えができること', () => {
      render(
        <I18nProvider initialLanguage="ja">
          <LanguageSwitcher variant="setup" />
        </I18nProvider>
      );

      const setupBtn = screen.getByTestId('setup-language-toggle');
      expect(setupBtn).toBeInTheDocument();
      expect(setupBtn).toHaveTextContent('EN');

      fireEvent.click(setupBtn);
      expect(setupBtn).toHaveTextContent('JA');
      expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('en');
    });
  });
});
