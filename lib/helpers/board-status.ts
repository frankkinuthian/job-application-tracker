/**
 * A card's `status` mirrors the column it sits in. Columns are user-visible
 * names ("Wish List"), status is a stable slug ("wish-list"), so both the seed
 * and the move logic derive one from the other through here rather than
 * hardcoding the mapping in two places.
 */
export function statusFromColumnName(columnName: string): string {
  return columnName.trim().toLowerCase().replace(/\s+/g, "-");
}

/** Cache tag for a board's assembled data, invalidated whenever a card moves. */
export function boardTag(boardId: string): string {
  return `board:${boardId}`;
}
