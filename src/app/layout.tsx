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

const DEFAULT_GA_MEASUREMENT_ID = 'G-38N6PN8RE6';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const jsonLd = buildJsonLd();
  const adsense = getAdSenseConfig();
  const rawGaMeasurementId = (process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || DEFAULT_GA_MEASUREMENT_ID).trim();
  const gaMeasurementId = /^G-[A-Za-z0-9]+$/.test(rawGaMeasurementId)
    ? rawGaMeasurementId
    : DEFAULT_GA_MEASUREMENT_ID;

  return (
    <html lang="ja">
      <body className="antialiased bg-algo-sand text-slate-800 min-h-screen">
        {gaMeasurementId && (
          <>
            <script
              async
              src={`https://www.googletagmanager.com/gtag/js?id=${gaMeasurementId}`}
            />
            <script
              dangerouslySetInnerHTML={{
                __html: `
                  window.dataLayer = window.dataLayer || [];
                  function gtag(){dataLayer.push(arguments);}
                  gtag('js', new Date());
                  gtag('config', '${gaMeasurementId}', {
                    page_path: window.location.pathname,
                  });
                `,
              }}
            />
          </>
        )}
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
