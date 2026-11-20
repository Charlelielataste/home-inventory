/**
 * Batches (« lots »): the items of a stock that share an expiry date. Bought again later,
 * the same product gets a second batch with its own date: 1 × 22/11 + 2 × 28/11.
 *
 * - The stock (`items.quantity`) is the total; items without a known date are the rest
 *   (quantity − sum of the batches), never stored.
 * - Removing items takes the earliest batch first (eaten first).
 * - `items.expires_at` = date of the earliest batch, kept in sync by queries.ts: badges,
 *   Péremption tab and sorting keep reading that single column.
 */
export type Batch = { quantity: number; expires_at: string };

/** One batch per date, whole positive quantities, earliest first. */
export function cleanBatches(batches: Batch[]): Batch[] {
  const byDate = new Map<string, number>();
  for (const b of batches) {
    const quantity = Math.round(b.quantity);
    if (quantity > 0 && b.expires_at) byDate.set(b.expires_at, (byDate.get(b.expires_at) ?? 0) + quantity);
  }
  return [...byDate].sort(([a], [b]) => a.localeCompare(b)).map(([expires_at, quantity]) => ({ quantity, expires_at }));
}

export function batchesTotal(batches: Batch[]): number {
  return batches.reduce((sum, b) => sum + b.quantity, 0);
}

/**
 * Batches that fit in a stock of `quantity` items: when there are more dated items than
 * items left, the earliest batches are the ones gone.
 */
export function fitBatches(batches: Batch[], quantity: number): Batch[] {
  const clean = cleanBatches(batches);
  let excess = batchesTotal(clean) - Math.max(0, Math.round(quantity));
  const kept: Batch[] = [];
  for (const b of clean) {
    if (excess >= b.quantity) excess -= b.quantity;
    else {
      kept.push({ ...b, quantity: b.quantity - Math.max(0, excess) });
      excess = 0;
    }
  }
  return kept;
}

/**
 * `count` items taken out of the stock (eaten, thrown away): the earliest batch goes first,
 * the items without a date only once every batch is gone.
 */
export function takeEarliest(batches: Batch[], count: number): Batch[] {
  let left = Math.max(0, Math.round(count));
  const kept: Batch[] = [];
  for (const b of cleanBatches(batches)) {
    const taken = Math.min(left, b.quantity);
    left -= taken;
    if (b.quantity > taken) kept.push({ ...b, quantity: b.quantity - taken });
  }
  return kept;
}

/** Items of the stock without a known date. */
export function undatedCount(batches: Batch[], quantity: number): number {
  return Math.max(0, Math.round(quantity) - batchesTotal(batches));
}

/** Batches read from SQL (`json_group_array(json_array(quantity, expires_at))`), earliest first. */
export function parseBatches(json: string | null | undefined): Batch[] {
  if (!json) return [];
  try {
    const rows = JSON.parse(json) as [number, string][];
    return cleanBatches(rows.map(([quantity, expires_at]) => ({ quantity, expires_at })));
  } catch {
    return [];
  }
}

/** Only one date, for the whole stock: shown as a single date, like before batches. */
export function isSingleDate(batches: Batch[], quantity: number): boolean {
  return batches.length === 0 || (batches.length === 1 && batches[0].quantity === quantity);
}
