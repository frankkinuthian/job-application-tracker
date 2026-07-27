/**
 * Fractional ordering for kanban cards.
 *
 * A card's position is a sort key, not an index. Inserting between two cards
 * means writing the midpoint of their keys, so only the moved card is written.
 * The value is absolute rather than relative, which makes the write idempotent
 * and safe to retry.
 */

/** Gap used when appending or seeding. Leaves room to insert between. */
export const ORDER_STEP = 1000;

/**
 * Below this gap, halving starts running out of float64 precision (~50
 * consecutive inserts into the same slot). Columns that get this tight are
 * renormalized back to clean ORDER_STEP spacing.
 */
export const MIN_ORDER_GAP = 0.0001;

/**
 * Sort key that places a card between `prev` and `next`.
 * Pass undefined for either side to place at the start or end of a column.
 */
export function orderBetween(prev?: number, next?: number): number {
  if (prev === undefined && next === undefined) return ORDER_STEP;
  if (prev === undefined) return next! / 2;
  if (next === undefined) return prev + ORDER_STEP;

  return (prev + next) / 2;
}

/** True when the gap between neighbours is too small to split again. */
export function needsRenormalize(prev?: number, next?: number): boolean {
  if (prev === undefined || next === undefined) return false;

  return next - prev < MIN_ORDER_GAP;
}
