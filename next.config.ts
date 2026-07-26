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

const nextConfig = {
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
