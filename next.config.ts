import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  async rewrites() {
    return [
      // All non-API, non-/_next paths → serve page.tsx (SPA fallback)
      {
        source: '/((?!api|_next|favicon\\.ico|robots\\.txt|sitemap\\.xml).*)',
        destination: '/',
      },
    ];
  },
};

export default nextConfig;