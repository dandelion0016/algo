'use client';

import React from 'react';
import { Globe, Languages } from 'lucide-react';
import { useI18n, Language } from '../lib/i18n';

export interface LanguageSwitcherProps {
  /**
   * 表示バリエーション
   * - 'header': デスクトップヘッダー用コンパクトボタン
   * - 'menu': モバイルメニュー内カード行
   * - 'setup': セットアップ画面用バッジトグル
   */
  variant?: 'header' | 'menu' | 'setup';
  className?: string;
  onLanguageChange?: (newLang: Language) => void;
}

export const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({
  variant = 'header',
  className = '',
  onLanguageChange,
}) => {
  const { language, setLanguage, t } = useI18n();

  const toggleLanguage = () => {
    const nextLang: Language = language === 'ja' ? 'en' : 'ja';
    setLanguage(nextLang);
    onLanguageChange?.(nextLang);
  };

  if (variant === 'menu') {
    return (
      <button
        type="button"
        data-testid="mobile-menu-language-toggle"
        onClick={toggleLanguage}
        className={`w-full flex items-center justify-between p-3 rounded-2xl border text-sm font-bold transition-all text-left ${
          language === 'en'
            ? 'border-indigo-300 bg-indigo-50/60 text-indigo-900 hover:bg-indigo-100/70'
            : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
        } ${className}`}
        aria-label={t.header.languageTitle}
      >
        <div className="flex items-center gap-3">
          <Languages className="w-5 h-5 text-algo-blue shrink-0" />
          <div>
            <span className="block font-black text-slate-800">
              {t.mobileMenu.languageTitle}
            </span>
            <span className="text-xs font-medium text-slate-500">
              {language === 'ja' ? '現在: 日本語 (Japanese)' : 'Current: English (英語)'}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span
            className={`px-2 py-0.5 rounded-full text-xs font-black transition-colors ${
              language === 'ja'
                ? 'bg-algo-blue text-white shadow-2xs'
                : 'bg-slate-200 text-slate-600'
            }`}
          >
            JA
          </span>
          <span className="text-xs text-slate-400 font-bold">/</span>
          <span
            className={`px-2 py-0.5 rounded-full text-xs font-black transition-colors ${
              language === 'en'
                ? 'bg-algo-blue text-white shadow-2xs'
                : 'bg-slate-200 text-slate-600'
            }`}
          >
            EN
          </span>
        </div>
      </button>
    );
  }

  if (variant === 'setup') {
    return (
      <button
        type="button"
        data-testid="setup-language-toggle"
        onClick={toggleLanguage}
        className={`inline-flex items-center gap-1 px-2 py-1 sm:px-2.5 sm:py-1 rounded-full border text-[10px] sm:text-xs font-bold transition-all shadow-2xs cursor-pointer ${
          language === 'en'
            ? 'border-indigo-300 bg-indigo-50 text-indigo-900 hover:bg-indigo-100 ring-1 ring-indigo-200'
            : 'border-slate-200 bg-white/90 text-slate-700 hover:bg-slate-50 hover:border-slate-300'
        } ${className}`}
        aria-label={t.header.languageTitle}
        title={language === 'ja' ? 'Switch to English' : '日本語に切り替え'}
      >
        <Globe className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-algo-blue shrink-0" />
        <span className="font-mono font-black">{language === 'ja' ? 'EN' : 'JA'}</span>
      </button>
    );
  }

  // デフォルト: header 用
  return (
    <button
      type="button"
      data-testid="header-language-toggle"
      onClick={toggleLanguage}
      className={`hidden lg:flex items-center gap-1 px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-lg sm:rounded-xl border text-[10px] sm:text-xs font-bold transition-all shadow-2xs whitespace-nowrap shrink-0 cursor-pointer ${
        language === 'en'
          ? 'border-indigo-300 bg-indigo-50 text-indigo-900 hover:bg-indigo-100 ring-1 ring-indigo-200'
          : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
      } ${className}`}
      aria-label={t.header.languageTitle}
      title={language === 'ja' ? 'Switch language to English' : '日本語に切り替える'}
    >
      <Globe className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-algo-blue shrink-0" />
      <span className="font-mono font-black">{language === 'ja' ? '🌐 EN' : '🌐 JA'}</span>
    </button>
  );
};
