import path from 'node:path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(process.cwd(), '../..'),
  devIndicators: false,
  images: {
    unoptimized: true,
  },
  async redirects() {
    return [
      { source: '/agents', destination: '/lab', permanent: true },
      { source: '/agents/:name', destination: '/lab/agents/:name', permanent: true },
    ];
  },
};

export default nextConfig;
