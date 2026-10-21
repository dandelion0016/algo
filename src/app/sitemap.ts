import type { MetadataRoute } from 'next';
import { getSiteUrl } from '@/lib/seo';

export const dynamic = 'force-static';

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = getSiteUrl();
  return [
    {
      url: `${siteUrl}/`,
      lastModified: new Date('2026-10-21'),
      changeFrequency: 'weekly',
      priority: 1.0,
    },
  ];
}
