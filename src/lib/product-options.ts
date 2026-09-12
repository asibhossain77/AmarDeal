// Shared server-side validation for multi-price product options.
// Used by product create/update APIs AND by the order (deal) creation API —
// the order path never trusts client prices; it re-reads them from the DB.

export const PRODUCT_TYPES = ['single', 'multi'] as const;
export type ProductType = (typeof PRODUCT_TYPES)[number];

export const MAX_OPTIONS = 50;
export const MAX_OPTION_NAME_LENGTH = 100;
export const MAX_OPTION_PRICE = 99_999_999;

export interface RawOptionInput {
  name?: unknown;
  price?: unknown;
  isAvailable?: unknown;
}

export interface ValidatedOption {
  name: string;
  price: number;
  isAvailable: boolean;
  sortOrder: number;
}

type ValidateResult =
  | { ok: true; options: ValidatedOption[] }
  | { ok: false; error: string };

// Validates a raw options array coming from the client (seller form).
// Enforces: at least 1 option, non-empty unique names, price > 0, sane bounds.
export function validateOptions(raw: unknown): ValidateResult {
  if (!Array.isArray(raw)) {
    return { ok: false, error: 'অপশন লিস্ট অবৈধ' };
  }
  if (raw.length === 0) {
    return { ok: false, error: 'অন্তত একটি অপশন যোগ করুন' };
  }
  if (raw.length > MAX_OPTIONS) {
    return { ok: false, error: `সর্বোচ্চ ${MAX_OPTIONS}টি অপশন যোগ করা যাবে` };
  }

  const seenNames = new Set<string>();
  const options: ValidatedOption[] = [];

  for (let i = 0; i < raw.length; i++) {
    const item = (raw[i] ?? {}) as RawOptionInput;

    const name = typeof item.name === 'string' ? item.name.trim() : '';
    if (!name) {
      return { ok: false, error: `অপশন ${i + 1}: নাম প্রয়োজন` };
    }
    if (name.length > MAX_OPTION_NAME_LENGTH) {
      return { ok: false, error: `অপশন ${i + 1}: নামটি খুব দীর্ঘ (সর্বোচ্চ ${MAX_OPTION_NAME_LENGTH} অক্ষর)` };
    }

    const price = Number(item.price);
    if (!Number.isFinite(price) || price <= 0) {
      return { ok: false, error: `অপশন "${name}": মূল্য অবশ্যই শূন্যের বেশি হতে হবে` };
    }
    if (price > MAX_OPTION_PRICE) {
      return { ok: false, error: `অপশন "${name}": মূল্য অত্যধিক` };
    }

    const key = name.toLowerCase();
    if (seenNames.has(key)) {
      return { ok: false, error: `ডুপ্লিকেট অপশন নাম: "${name}" — প্রতিটি অপশনের নাম আলাদা হতে হবে` };
    }
    seenNames.add(key);

    options.push({
      name,
      price: Math.round(price * 100) / 100, // kill float dust (0.1+0.2 style)
      isAvailable: item.isAvailable === undefined ? true : Boolean(item.isAvailable),
      sortOrder: i,
    });
  }

  return { ok: true, options };
}

// Normalizes the productType value coming from the client.
export function normalizeProductType(raw: unknown): ProductType {
  return raw === 'multi' ? 'multi' : 'single';
}

// Computes the display price range from a list of prices.
export function priceRangeFromPrices(prices: number[]): { min: number; max: number } {
  return { min: Math.min(...prices), max: Math.max(...prices) };
}
