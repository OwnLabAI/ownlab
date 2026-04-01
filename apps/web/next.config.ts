import type { NextConfig } from 'next';

const SERVER_URL = process.env.OWNLAB_SERVER_URL ?? 'http://localhost:3100';

const nextConfig: NextConfig = {
  devIndicators: false,
  async redirects() {
    return [
      { source: '/agents', destination: '/lab', permanent: true },
      { source: '/agents/:name', destination: '/lab/agents/:name', permanent: true },
    ];
  },
  async rewrites() {
    return [
      {
        source: '/api/agents/:path*',
        destination: `${SERVER_URL}/api/agents/:path*`,
      },
      {
        source: '/api/teams/:path*',
        destination: `${SERVER_URL}/api/teams/:path*`,
      },
      {
        source: '/api/chat/threads/:path*',
        destination: `${SERVER_URL}/api/chat/threads/:path*`,
      },
      {
        source: '/api/chat/messages',
        destination: `${SERVER_URL}/api/chat/messages`,
      },
      {
        source: '/api/channels/:path*',
        destination: `${SERVER_URL}/api/channels/:path*`,
      },
      {
        source: '/api/workspace/:path*',
        destination: `${SERVER_URL}/api/workspace/:path*`,
      },
      {
        source: '/api/workspaces/:path*',
        destination: `${SERVER_URL}/api/workspaces/:path*`,
      },
      {
        source: '/api/taskboards/:path*',
        destination: `${SERVER_URL}/api/taskboards/:path*`,
      },
      {
        source: '/api/tasks/:path*',
        destination: `${SERVER_URL}/api/tasks/:path*`,
      },
      {
        source: '/api/channel-chat',
        destination: `${SERVER_URL}/api/channel-chat`,
      },
      {
        source: '/api/heartbeat/:path*',
        destination: `${SERVER_URL}/api/heartbeat/:path*`,
      },
      {
        source: '/api/search/:path*',
        destination: `${SERVER_URL}/api/search/:path*`,
      },
      {
        source: '/api/plugins/:path*',
        destination: `${SERVER_URL}/api/plugins/:path*`,
      },
    ];
  },
};

export default nextConfig;
