import type { MetadataRoute } from 'next';

const SITE_URL = 'https://xn--94b8cubil3ej.xn--54b7fta0cc';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: 'Googlebot',
        allow: '/',
        disallow: ['/api/', '/dashboard/', '/admin/', '/auth/'],
      },
      {
        userAgent: 'Bingbot',
        allow: '/',
        disallow: ['/api/', '/dashboard/', '/admin/', '/auth/'],
      },
      {
        userAgent: 'Slurp',
        allow: '/',
        disallow: ['/api/', '/dashboard/', '/admin/', '/auth/'],
      },
      {
        userAgent: 'DuckDuckBot',
        allow: '/',
        disallow: ['/api/', '/dashboard/', '/admin/', '/auth/'],
      },
      {
        userAgent: 'Baiduspider',
        allow: '/',
        disallow: ['/api/', '/dashboard/', '/admin/', '/auth/'],
      },
      {
        userAgent: 'YandexBot',
        allow: '/',
        disallow: ['/api/', '/dashboard/', '/admin/', '/auth/'],
      },
      {
        userAgent: 'facebookexternalhit',
        allow: '/',
        disallow: ['/api/'],
      },
      {
        userAgent: 'Twitterbot',
        allow: '/',
        disallow: ['/api/'],
      },
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/dashboard/', '/admin/', '/auth/'],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}