// Detects Prisma "column does not exist" (P2022-style) errors for a column.
// Used to keep APIs alive when a new column (e.g. DigitalProduct.quantity)
// has not been migrated yet in the production database — fallback paths
// omit the column and use DEFAULT_PRODUCT_QUANTITY instead.
export const DEFAULT_PRODUCT_QUANTITY = 10;

export function isMissingColumnError(err: unknown, column: string): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes('does not exist') && msg.includes(column);
}
