/**
 * Stock = `quantity`, a whole number of items (2 packs of chicken).
 * Optional size of ONE full item = `size` + `size_unit` (500 g), and what is really
 * left in all = `amount` (800 g once 200 g are eaten), shown "2 · 800 g".
 */
export type MeasureUnit = 'g' | 'kg' | 'ml' | 'l' | 'cm' | 'm';

type UnitDef = {
  key: MeasureUnit;
  /** Label shown in the picker and after numbers */
  symbol: string;
  /** Base unit and factor to it (kg = 1000 g), to show totals in the best unit */
  base: 'g' | 'ml' | 'cm';
  factor: number;
  /** − / + of the size field in the item form */
  step: number;
};

export const MEASURE_UNITS: UnitDef[] = [
  { key: 'g', symbol: 'g', base: 'g', factor: 1, step: 100 },
  { key: 'kg', symbol: 'kg', base: 'g', factor: 1000, step: 0.5 },
  { key: 'ml', symbol: 'mL', base: 'ml', factor: 1, step: 100 },
  { key: 'l', symbol: 'L', base: 'ml', factor: 1000, step: 0.5 },
  { key: 'cm', symbol: 'cm', base: 'cm', factor: 1, step: 10 },
  { key: 'm', symbol: 'm', base: 'cm', factor: 100, step: 1 },
];

export function isMeasureUnit(key: unknown): key is MeasureUnit {
  return typeof key === 'string' && MEASURE_UNITS.some((u) => u.key === key);
}

export function unitDef(key: MeasureUnit): UnitDef {
  return MEASURE_UNITS.find((u) => u.key === key) ?? MEASURE_UNITS[0];
}

/** 1.5 -> "1,5"; 2 -> "2" */
export function formatNumber(n: number): string {
  const rounded = Math.round(n * 100) / 100;
  return String(rounded).replace('.', ',');
}

/** Accepts "1,5" or "1.5". Returns null if invalid. */
export function parseNumber(text: string): number | null {
  const cleaned = text.replace(',', '.').replace(/\s/g, '');
  if (cleaned === '') return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/** Whole number ≥ 0 (stock, minimum stock). Returns null if invalid. */
export function parseCount(text: string): number | null {
  const n = parseNumber(text);
  return n !== null && n >= 0 && Number.isInteger(n) ? n : null;
}

/** A measure in the most readable unit: 1500 g → "1,5 kg", 0,5 kg → "500 g", 250 cm → "2,5 m". */
export function formatMeasure(value: number, unit: MeasureUnit): string {
  const { base, factor } = unitDef(unit);
  const inBase = value * factor;
  const big = MEASURE_UNITS.find((u) => u.base === base && u.factor > 1)!;
  const small = MEASURE_UNITS.find((u) => u.base === base && u.factor === 1)!;
  return inBase >= big.factor
    ? `${formatNumber(inBase / big.factor)} ${big.symbol}`
    : `${formatNumber(inBase)} ${small.symbol}`;
}

type Stock = { quantity: number; size: number | null; size_unit: string | null; amount?: number | null };

/** What is left in all, in the unit of the size (null without size). Amount unknown = all full. */
export function totalOf(item: Stock): number | null {
  if (!item.size || !isMeasureUnit(item.size_unit)) return null;
  return item.amount ?? item.quantity * item.size;
}

/** Number of items for a total: 800 g in packs of 500 g = 2 (one started). */
export function quantityForTotal(total: number, size: number): number {
  return Math.max(0, Math.ceil(total / size - 1e-9));
}

/**
 * Total after changing the number of items: one more = one more full item;
 * one less = the started one is gone (2 × 500 g with 800 g left, −1 → 500 g).
 * Also used by `adjustQuantity()` in queries.ts.
 */
export function totalForQuantity(oldQuantity: number, oldTotal: number, quantity: number, size: number): number {
  return addToTotal(
    quantity > oldQuantity ? oldTotal + (quantity - oldQuantity) * size : Math.min(oldTotal, quantity * size),
    0,
  );
}

/** Total after adding (or eating, negative) `delta` in the unit of the size; never below 0. */
export function addToTotal(total: number, delta: number): number {
  return Math.max(0, Math.round((total + delta) * 1000) / 1000);
}

/** Size of one item ("500 g"), null if none. */
export function formatSize(item: Pick<Stock, 'size' | 'size_unit'>): string | null {
  return item.size && isMeasureUnit(item.size_unit) ? formatMeasure(item.size, item.size_unit) : null;
}

/** Number of items with its unit: "2 pcs" (item cards). */
export function formatPieces(quantity: number): string {
  return `${formatNumber(quantity)} pcs`;
}

/** "2 · 800 g" (number of items · what is left), "2" without size, "0" when out of stock. */
export function formatStock(item: Stock, options?: { pieces?: boolean }): string {
  const n = options?.pieces ? formatPieces(item.quantity) : formatNumber(item.quantity);
  const total = totalOf(item);
  if (!item.quantity || total === null) return n;
  return `${n} · ${formatMeasure(total, item.size_unit as MeasureUnit)}`;
}

/** Screen reader version: "2, 800 g au total". */
export function describeStock(item: Stock): string {
  const n = formatNumber(item.quantity);
  const total = totalOf(item);
  if (!item.quantity || total === null) return n;
  return `${n}, ${formatMeasure(total, item.size_unit as MeasureUnit)} au total`;
}

/** − / + on the grid of the step: 250 g, + → 300 g, − → 200 g (never below 0). */
export function stepValue(value: number, step: number, direction: 1 | -1): number {
  const next = direction > 0 ? Math.floor(value / step + 1e-9) + 1 : Math.ceil(value / step - 1e-9) - 1;
  return Math.max(0, Math.round(next * step * 1000) / 1000);
}
