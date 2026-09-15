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
  // Shrink the traced function bundle: Vercel Functions Storage keeps every
  // deployment's bundle (~was 134MB each → 11GB across retained deployments,
  // exceeding the 10GB free limit). Typescript and musl/Alpine native
  // binaries are never needed at runtime (Vercel runs glibc linux x64).
  outputFileTracingExcludes: {
    '*': [
      'node_modules/typescript/**',
      'node_modules/@img/sharp-libvips-linuxmusl-*/**',
      'node_modules/@img/sharp-linuxmusl-*/**',
      'node_modules/@libsql/*musl*/**',
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
      // NOTE: /cdn/* cache headers are set by the route handler at
      // src/app/cdn/[...path]/route.ts — next.config headers() does not
      // merge into rewrite responses, which is why the handler exists.
    ];
  },
  async rewrites() {
    return {
      // NOTE: /cdn/:path* is NO LONGER an external rewrite — it moved to a
      // real route handler (src/app/cdn/[...path]/route.ts) so responses
      // carry immutable Cache-Control and stop re-downloading every image
      // through Vercel on every page view.
      beforeFiles: [
        // Dev-only: proxy a local fake S3/R2 server for E2E of presigned
        // uploads (headless Chrome blocks cross-port loopback requests).
        // Same-origin /fake-s3/* → 127.0.0.1:3199 keeps the browser happy.
        ...(process.env.NODE_ENV === 'development' && process.env.E2E_FAKE_S3
          ? [{ source: '/fake-s3/:path*', destination: 'http://127.0.0.1:3199/:path*' }]
          : []),
      ],
      afterFiles: [],
      // SPA catch-all — only for paths with NO matching route (static OR
      // dynamic). Running this as `fallback` (instead of a plain afterFiles
      // array) is critical: afterFiles rewrites run BEFORE dynamic route
      // matching, which hijacked /s/[sellerId] and /product/[id] to the
      // landing page and broke their SSR metadata.
      fallback: [
        {
          source: '/((?!api|_next|favicon\\.ico|robots\\.txt|sitemap\\.xml|ref/|cdn/).*)',
          destination: '/',
        },
      ],
    };
  },
};

export default nextConfig;
