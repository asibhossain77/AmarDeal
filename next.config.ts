import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === 'production';

const securityHeaders = [
  // ClickJacking — only in production (dev preview needs iframe)
  ...(isProd ? [{ key: 'X-Frame-Options', value: 'DENY' as const }] : []),
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  // NOTE: Content-Security-Policy is now set PER-REQUEST in src/proxy.ts with a
  // cryptographic nonce, replacing the previous static 'unsafe-inline' policy.
  // See buildCsp() in proxy.ts for the directive list.
];

const nextConfig: NextConfig = {
  output: 'standalone',
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  compiler: {
    // Strip console.log in production for smaller bundle
    removeConsole: isProd ? {
      exclude: ['warn', 'error'],
    } : false,
  },
  // Tree-shake heavy packages so only imported sub-paths are bundled
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      'recharts',
      'framer-motion',
      'date-fns',
      '@radix-ui/react-icons',
      'react-syntax-highlighter',
    ],
  },
  async headers() {
    return [{
      source: '/(.*)',
      headers: securityHeaders,
    }];
  },
  async rewrites() {
    return [
      // Proxy CDN images through same origin (fixes Brave browser Shields blocking)
      {
        source: '/cdn/:path*',
        destination: 'https://cdn.midman.bd/:path*',
      },
      // SPA catch-all — skip api, _next, static assets, and cdn proxy
      {
        source: '/((?!api|_next|favicon\\.ico|robots\\.txt|sitemap\\.xml|ref/|cdn/).*)',
        destination: '/',
      },
    ];
  },
};

export default nextConfig;
