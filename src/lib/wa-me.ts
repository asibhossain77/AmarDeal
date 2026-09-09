/**
 * Build a wa.me deep link from a stored WhatsApp number.
 * Handles: 8801712345678, +8801712345678, 01712345678 (BD local), and other
 * country codes stored with/without '+'. Optional prefilled message text.
 */
export function waMeLink(number: string | null | undefined, text?: string): string | null {
  if (!number) return null;
  const digits = number.replace(/[^0-9]/g, '');
  if (digits.length < 10) return null;
  let full = digits;
  if (full.startsWith('01') && full.length === 11) full = '88' + full;
  else if (!full.startsWith('880') && full.length === 10) full = '880' + full;
  const q = text ? `?text=${encodeURIComponent(text)}` : '';
  return `https://wa.me/${full}${q}`;
}
