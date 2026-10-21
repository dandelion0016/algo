import type { MetadataRoute } from 'next';
import { SITE_DESCRIPTION, SITE_NAME } from '@/lib/seo';

export const dynamic = 'force-static';

export default function manifest(): MetadataRoute.Manifest {
  return {
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
  };
}
