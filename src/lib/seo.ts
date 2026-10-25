import type { Metadata } from 'next';

export const DEFAULT_SITE_URL = 'https://coda.puzzlecabin.jp';

export const SITE_NAME = 'アルゴ（algo）Web';
export const SITE_TITLE_DEFAULT = 'アルゴ（algo）Web - 頭脳派推理カードゲーム | 無料ブラウザCPU対戦';
export const SITE_TITLE_TEMPLATE = '%s | アルゴ（algo）Web';
export const SITE_DESCRIPTION =
  '算数オリンピック委員会・ピーター・フランクル氏らが開発した頭脳派推理カードゲーム「アルゴ（algo）」をWebブラウザで無料プレイ！2〜4人対戦、3段階の思考AI（初級・中級・上級）、残弾トラッカーや戦績システムを搭載した本格論理パズルゲームです。';
export const OGP_TITLE = 'アルゴ（algo）Web - 頭脳派推理カードゲーム';
export const OGP_DESCRIPTION =
  '伏せられた数字を論理と記憶で暴け！2〜4人対応・思考AI搭載のWeb版「アルゴ（algo）」で今すぐ頭脳戦をプレイ。';

export const SITE_KEYWORDS = [
  'アルゴ',
  'algo',
  'カードゲーム',
  '推理ゲーム',
  'ボードゲーム',
  '算数オリンピック',
  'ピーター・フランクル',
  '論理パズル',
  'ブラウザゲーム',
  '無料ゲーム',
  'CPU対戦',
  '頭脳ゲーム',
];

/**
 * サイトベースURLを安全に正規化して返却する
 * - 引数または NEXT_PUBLIC_SITE_URL を参照
 * - 前後の空白および末尾のスラッシュを除去
 * - http:// または https:// で始まらない不正なURLや未設定時は DEFAULT_SITE_URL にフォールバック
 */
export function getSiteUrl(envUrl?: string): string {
  const raw = (envUrl ?? process.env.NEXT_PUBLIC_SITE_URL ?? '').trim().replace(/\/+$/, '');
  if (!raw || !/^https?:\/\/[^/\s]+/i.test(raw)) {
    return DEFAULT_SITE_URL;
  }
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return DEFAULT_SITE_URL;
    }
    return raw;
  } catch {
    return DEFAULT_SITE_URL;
  }
}

/**
 * Next.js Metadata オブジェクトを生成する
 */
export function buildMetadata(envUrl?: string): Metadata {
  const siteUrl = getSiteUrl(envUrl);

  return {
    metadataBase: new URL(siteUrl),
    title: {
      default: SITE_TITLE_DEFAULT,
      template: SITE_TITLE_TEMPLATE,
    },
    description: SITE_DESCRIPTION,
    keywords: SITE_KEYWORDS,
    applicationName: SITE_NAME,
    authors: [{ name: 'algo Web Project' }],
    creator: 'algo Web Project',
    publisher: 'algo Web Project',
    category: 'game',
    alternates: {
      canonical: '/',
    },
    openGraph: {
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
    },
    twitter: {
      card: 'summary_large_image',
      title: OGP_TITLE,
      description: OGP_DESCRIPTION,
      images: ['/hero-banner.jpg'],
    },
    icons: {
      icon: [{ url: '/app-icon.jpg', type: 'image/jpeg' }],
      apple: [{ url: '/app-icon.jpg', type: 'image/jpeg' }],
    },
    manifest: '/manifest.webmanifest',
    verification: {
      google: 'LcDNa7KHW33-g7dMwMDkIBI5L3YQsrNxP-w-M8Qr8qw',
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-video-preview': -1,
        'max-image-preview': 'large',
        'max-snippet': -1,
      },
    },
  };
}

export interface JsonLdGraphItem {
  '@type': 'WebApplication' | 'VideoGame';
  '@id': string;
  name: string;
  alternateName: string;
  description: string;
  url: string;
  image: string;
  inLanguage: string;
  applicationCategory?: string;
  genre: string[];
  operatingSystem: string;
  GamePlatform?: string[];
  playMode?: string[];
  numberOfPlayers: {
    '@type': 'QuantitativeValue';
    minValue: number;
    maxValue: number;
  };
  author: {
    '@type': 'Organization';
    name: string;
  };
  offers: {
    '@type': 'Offer';
    price: string;
    priceCurrency: string;
    availability: string;
  };
}

export interface JsonLdDocument {
  '@context': 'https://schema.org';
  '@graph': JsonLdGraphItem[];
}

/**
 * Schema.org 準拠の JSON-LD 構造化データ（WebApplication & VideoGame）を生成する
 */
export function buildJsonLd(envUrl?: string): JsonLdDocument {
  const siteUrl = getSiteUrl(envUrl);
  const imageUrl = `${siteUrl}/hero-banner.jpg`;

  const commonProps = {
    name: SITE_NAME,
    alternateName: 'algo Web',
    description: SITE_DESCRIPTION,
    url: `${siteUrl}/`,
    image: imageUrl,
    inLanguage: 'ja',
    genre: ['Board Game', 'Card Game', 'Logic Puzzle'],
    operatingSystem: 'Web Browser',
    numberOfPlayers: {
      '@type': 'QuantitativeValue' as const,
      minValue: 2,
      maxValue: 4,
    },
    author: {
      '@type': 'Organization' as const,
      name: 'algo Web Project',
    },
    offers: {
      '@type': 'Offer' as const,
      price: '0',
      priceCurrency: 'JPY',
      availability: 'https://schema.org/InStock',
    },
  };

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebApplication',
        '@id': `${siteUrl}/#webapp`,
        ...commonProps,
        applicationCategory: 'GameApplication',
      },
      {
        '@type': 'VideoGame',
        '@id': `${siteUrl}/#videogame`,
        ...commonProps,
        applicationCategory: 'GameApplication',
        GamePlatform: ['Web Browser'],
        playMode: ['SinglePlayer', 'MultiPlayer'],
      },
    ],
  };
}
