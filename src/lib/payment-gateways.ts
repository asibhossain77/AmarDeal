/**
 * Payment gateway footer badges — shared between:
 *   - public /api/site-settings (serves the list to the footer)
 *   - admin /api/admin/settings (stores raw JSON under platformSetting key
 *     `payment_gateway_icons`)
 *   - admin SettingsPanel (editing UI)
 *   - landing Footer (rendering)
 *
 * Storage shape: JSON array of { id, name, icon, enabled }
 *   - id: stable slug; when it matches a BUILTIN_ICONS key and `icon` is
 *     empty, the bundled /payment/<id>.png is used (default bKash + Nagad).
 *   - icon: uploaded CDN/R2 URL (wins over builtin) — custom gateways MUST
 *     provide one.
 * Absent/invalid DB value falls back to DEFAULT_GATEWAYS.
 */

export interface PaymentGateway {
  /** Stable slug; also the key for bundled default icons. */
  id: string;
  /** Display name (alt text, admin list). */
  name: string;
  /** Uploaded icon URL; empty = use builtin icon when available. */
  icon: string;
  /** Toggled off gateways are hidden from the footer. */
  enabled: boolean;
}

export const PAYMENT_ICONS_SETTING_KEY = 'payment_gateway_icons';

/** Bundled default icons shipped in /public/payment/ */
export const BUILTIN_ICONS: Record<string, string> = {
  bkash: '/payment/bkash.png',
  nagad: '/payment/nagad.png',
};

export const DEFAULT_GATEWAYS: PaymentGateway[] = [
  { id: 'bkash', name: 'bKash', icon: '', enabled: true },
  { id: 'nagad', name: 'Nagad', icon: '', enabled: true },
];

/** Icon URL for rendering — uploaded icon wins, else bundled default. */
export function resolveGatewayIcon(g: PaymentGateway): string {
  if (g.icon) return g.icon;
  return BUILTIN_ICONS[g.id] || '';
}

function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || `gw-${Date.now().toString(36)}`
  );
}

/**
 * Parse the stored JSON string into a validated gateway list.
 * Never throws — falls back to DEFAULT_GATEWAYS on any problem.
 */
export function parseGatewayList(raw: string | null | undefined): PaymentGateway[] {
  if (!raw || typeof raw !== 'string') return DEFAULT_GATEWAYS;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_GATEWAYS;
    const seen = new Set<string>();
    const list: PaymentGateway[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== 'object') continue;
      const g = item as Partial<PaymentGateway>;
      const name = typeof g.name === 'string' ? g.name.trim().slice(0, 30) : '';
      if (!name) continue;
      const id = slugify(typeof g.id === 'string' && g.id ? g.id : name);
      if (seen.has(id)) continue;
      seen.add(id);
      list.push({
        id,
        name,
        icon: typeof g.icon === 'string' ? g.icon : '',
        enabled: g.enabled !== false,
      });
      if (list.length >= 12) break; // sane cap
    }
    return list.length ? list : DEFAULT_GATEWAYS;
  } catch {
    return DEFAULT_GATEWAYS;
  }
}
