/** Smallest bulk (wholesale) quantity when the seller hasn't set one for a product */
export const DEFAULT_MIN_BULK_QTY = 10;

export function effectiveMinBulkQty(minBulkQty: number | null | undefined): number {
  return minBulkQty && minBulkQty > 0 ? minBulkQty : DEFAULT_MIN_BULK_QTY;
}
