export interface Sortable {
  id: string;
  sortOrder: number;
}

/** Where an item sitting at `index` in the given, already-sorted list would
 * land after a move, and the {id, sortOrder} pair to write for every row —
 * null at either end (nothing to move past). Pure and unit-tested on its
 * own: a caller only has to persist whatever this returns.
 *
 * Always renumbers the *whole* list 0..n-1 by its new array position after
 * the move, rather than swapping just the two moved rows' own values. A
 * plain two-value swap can land on a *third*, untouched row's existing
 * `sortOrder` even when the swapped pair's own values already differ (e.g.
 * ranks `(b,0) (c,0) (a,1)`: moving "c" down would swap c→1/a→0, giving "a"
 * the same rank 0 "b" already has — a tie the swap itself just created).
 * Always renumbering by array position is unconditionally correct for any
 * input, tied or not, and the extra writes (one per item, not two) cost
 * nothing worth optimising away for an admin-sized list.
 *
 * Generic over any `{id, sortOrder}`-shaped row so every admin list that
 * needs up/down reordering (products, photo sets, photos within a set)
 * shares this one implementation instead of re-deriving the same
 * self-healing logic per domain. */
export function reorderSwap<T extends Sortable>(
  items: T[],
  id: string,
  direction: "up" | "down"
): { id: string; sortOrder: number }[] | null {
  const index = items.findIndex((item) => item.id === id);
  if (index === -1) return null;
  const neighbourIndex = direction === "up" ? index - 1 : index + 1;
  if (neighbourIndex < 0 || neighbourIndex >= items.length) return null;

  const reordered = [...items];
  [reordered[index], reordered[neighbourIndex]] = [reordered[neighbourIndex], reordered[index]];
  return reordered.map((item, i) => ({ id: item.id, sortOrder: i }));
}
