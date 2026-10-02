import type { NextConfig } from 'next';
import packageJson from './package.json';

const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  env: {
    NEXT_PUBLIC_APP_VERSION: process.env.NEXT_PUBLIC_APP_VERSION || ('v' + packageJson.version),
  },
};

export default nextConfig;
