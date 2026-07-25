import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === 'production';

const securityHeaders = [
  // ClickJacking — only in production (dev preview needs iframe)
  ...(isProd ? [{ key: 'X-Frame-Options', value: 'DENY' as const }] : []),
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https: http:",
      "font-src 'self' https://fonts.gstatic.com",
      "connect-src 'self' wss: ws:",
      "object-src 'none'",
      "base-uri 'self'",
      // frame-ancestors only in production
      ...(isProd ? ["frame-ancestors 'none'"] : []),
      "form-action 'self'",
    ].join('; '),
  },
];

const nextConfig: NextConfig = {
  output: 'standalone',
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  async headers() {
    return [{
      source: '/(.*)',
      headers: securityHeaders,
    }];
  },
  async rewrites() {
    return [
      {
        source: '/((?!api|_next|favicon\\.ico|robots\\.txt|sitemap\\.xml).*)',
        destination: '/',
      },
    ];
  },
};

export default nextConfig;