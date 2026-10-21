import type { Metadata, Viewport } from 'next';
import { buildJsonLd, buildMetadata } from '@/lib/seo';
import { getAdSenseConfig } from '@/lib/adsense';
import './globals.css';

export const metadata: Metadata = buildMetadata();

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#fafaf7',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const jsonLd = buildJsonLd();
  const adsense = getAdSenseConfig();

  return (
    <html lang="ja">
      <body className="antialiased bg-algo-sand text-slate-800 min-h-screen">
        {adsense.enabled && adsense.scriptSrc && (
          <script
            async
            src={adsense.scriptSrc}
            crossOrigin="anonymous"
          />
        )}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        {children}
      </body>
    </html>
  );
}
