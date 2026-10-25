import { afterEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_SITE_URL,
  OGP_DESCRIPTION,
  OGP_TITLE,
  SITE_DESCRIPTION,
  SITE_KEYWORDS,
  SITE_NAME,
  SITE_TITLE_DEFAULT,
  SITE_TITLE_TEMPLATE,
  buildJsonLd,
  buildMetadata,
  getSiteUrl,
} from '../seo';
import robots from '../../app/robots';
import sitemap from '../../app/sitemap';
import manifest from '../../app/manifest';

describe('seo library & metadata routes', () => {
  const originalEnv = process.env.NEXT_PUBLIC_SITE_URL;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.NEXT_PUBLIC_SITE_URL;
    } else {
      process.env.NEXT_PUBLIC_SITE_URL = originalEnv;
    }
  });

  describe('getSiteUrl', () => {
    it('引数・環境変数が未設定の場合はデフォルトURL（https://coda.puzzlecabin.jp）を返す', () => {
      delete process.env.NEXT_PUBLIC_SITE_URL;
      expect(DEFAULT_SITE_URL).toBe('https://coda.puzzlecabin.jp');
      expect(getSiteUrl()).toBe('https://coda.puzzlecabin.jp');
    });

    it('明示的な引数で指定されたURLから前後の空白と末尾のスラッシュを除去して返す', () => {
      expect(getSiteUrl('  https://algo.example.jp///  ')).toBe('https://algo.example.jp');
    });

    it('環境変数 NEXT_PUBLIC_SITE_URL が設定されている場合はそれを正規化して返す', () => {
      process.env.NEXT_PUBLIC_SITE_URL = 'https://prod.algo-game.jp/';
      expect(getSiteUrl()).toBe('https://prod.algo-game.jp');
    });

    it('空文字や不正なURLの場合はデフォルトURLにフォールバックする', () => {
      expect(getSiteUrl('')).toBe(DEFAULT_SITE_URL);
      expect(getSiteUrl('   ')).toBe(DEFAULT_SITE_URL);
      expect(getSiteUrl('ftp://invalid-protocol.example.com')).toBe(DEFAULT_SITE_URL);
      expect(getSiteUrl('not-a-valid-url')).toBe(DEFAULT_SITE_URL);
    });
  });

  describe('buildMetadata', () => {
    it('SEO・OGP・Twitter Card・robots・canonical・iconsを含む完全なMetadataを構築する', () => {
      const customUrl = 'https://algo-custom.example.com/';
      const meta = buildMetadata(customUrl);

      expect(meta.metadataBase?.toString()).toBe('https://algo-custom.example.com/');
      expect(meta.title).toEqual({
        default: SITE_TITLE_DEFAULT,
        template: SITE_TITLE_TEMPLATE,
      });
      expect(meta.description).toBe(SITE_DESCRIPTION);
      expect(meta.keywords).toEqual(SITE_KEYWORDS);
      expect(meta.applicationName).toBe(SITE_NAME);
      expect(meta.category).toBe('game');
      expect(meta.alternates).toEqual({ canonical: '/' });
      expect(meta.manifest).toBe('/manifest.webmanifest');

      expect(meta.openGraph).toEqual({
        title: OGP_TITLE,
        description: OGP_DESCRIPTION,
        url: '/',
        siteName: SITE_NAME,
        locale: 'ja_JP',
        type: 'website',
        images: [
          {
            url: '/hero-banner.jpg',
            width: 1200,
            height: 630,
            alt: OGP_TITLE,
          },
        ],
      });

      expect(meta.twitter).toEqual({
        card: 'summary_large_image',
        title: OGP_TITLE,
        description: OGP_DESCRIPTION,
        images: ['/hero-banner.jpg'],
      });

      expect(meta.icons).toEqual({
        icon: [{ url: '/app-icon.jpg', type: 'image/jpeg' }],
        apple: [{ url: '/app-icon.jpg', type: 'image/jpeg' }],
      });

      expect(meta.verification).toEqual({
        google: 'LcDNa7KHW33-g7dMwMDkIBI5L3YQsrNxP-w-M8Qr8qw',
      });

      expect(meta.robots).toEqual({
        index: true,
        follow: true,
        googleBot: {
          index: true,
          follow: true,
          'max-video-preview': -1,
          'max-image-preview': 'large',
          'max-snippet': -1,
        },
      });
    });
  });

  describe('buildJsonLd', () => {
    it('Schema.org の WebApplication と VideoGame 構造化データを生成する', () => {
      const jsonLd = buildJsonLd('https://algo-test.example.com');

      expect(jsonLd['@context']).toBe('https://schema.org');
      expect(jsonLd['@graph']).toHaveLength(2);

      const [webApp, videoGame] = jsonLd['@graph'];

      expect(webApp['@type']).toBe('WebApplication');
      expect(webApp['@id']).toBe('https://algo-test.example.com/#webapp');
      expect(webApp.name).toBe(SITE_NAME);
      expect(webApp.url).toBe('https://algo-test.example.com/');
      expect(webApp.image).toBe('https://algo-test.example.com/hero-banner.jpg');
      expect(webApp.inLanguage).toBe('ja');
      expect(webApp.applicationCategory).toBe('GameApplication');
      expect(webApp.numberOfPlayers).toEqual({
        '@type': 'QuantitativeValue',
        minValue: 2,
        maxValue: 4,
      });
      expect(webApp.offers).toEqual({
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'JPY',
        availability: 'https://schema.org/InStock',
      });

      expect(videoGame['@type']).toBe('VideoGame');
      expect(videoGame['@id']).toBe('https://algo-test.example.com/#videogame');
      expect(videoGame.genre).toEqual(['Board Game', 'Card Game', 'Logic Puzzle']);
      expect(videoGame.playMode).toEqual(['SinglePlayer', 'MultiPlayer']);
    });
  });

  describe('Metadata routes (robots, sitemap, manifest)', () => {
    it('robots() が全クローラー許可および sitemap.xml のURLを返す', () => {
      process.env.NEXT_PUBLIC_SITE_URL = 'https://algo-route.example.com';
      const result = robots();

      expect(result).toEqual({
        rules: {
          userAgent: '*',
          allow: '/',
        },
        sitemap: 'https://algo-route.example.com/sitemap.xml',
      });
    });

    it('sitemap() がトップページのサイトマップ定義配列を返す', () => {
      process.env.NEXT_PUBLIC_SITE_URL = 'https://algo-route.example.com';
      const result = sitemap();

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        url: 'https://algo-route.example.com/',
        lastModified: new Date('2026-10-21'),
        changeFrequency: 'weekly',
        priority: 1.0,
      });
    });

    it('manifest() がPWA/Web App Manifest定義を返す', () => {
      const result = manifest();

      expect(result).toEqual({
        name: SITE_NAME,
        short_name: 'アルゴ Web',
        description: SITE_DESCRIPTION,
        start_url: '/',
        display: 'standalone',
        background_color: '#fafaf7',
        theme_color: '#fafaf7',
        lang: 'ja',
        icons: [
          {
            src: '/app-icon.jpg',
            sizes: '512x512',
            type: 'image/jpeg',
          },
        ],
      });
    });
  });
});
