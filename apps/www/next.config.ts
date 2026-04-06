import path from 'node:path';
import createNextIntlPlugin from 'next-intl/plugin';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(process.cwd(), '../..'),
  devIndicators: false,
  allowedDevOrigins: ['127.0.0.1', 'localhost'],
  images: {
    unoptimized: true,
  },
};

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

export default withNextIntl(nextConfig);
