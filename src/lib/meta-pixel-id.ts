/**
 * The site's Meta Pixel / Dataset ID.
 *
 * Baked in as the default so the pixel is active on every deploy with zero
 * extra configuration — a Pixel ID is public data (it ships in the rendered
 * page HTML regardless), so this is not a secret. Environment variables
 * NEXT_PUBLIC_META_PIXEL_ID (browser) / META_PIXEL_ID (server) override it
 * when set.
 *
 * There must be exactly ONE pixel on the site — do not add another fbq('init')
 * anywhere else.
 */
export const DEFAULT_META_PIXEL_ID = '966267646515236';
