export type UnitKey = 'pcs' | 'portion' | 'paquet' | 'g' | 'kg' | 'ml' | 'l' | 'cm' | 'm';

type UnitDef = {
  key: UnitKey;
  /** Label shown in the picker */
  label: string;
  /** Countable units: pluralized ("3 pièces") */
  singular?: string;
  plural?: string;
  /** Measurement units: symbol after the number ("500 g") */
  symbol?: string;
  /** Step used by the − / + buttons */
  step: number;
};

export const UNITS: UnitDef[] = [
  { key: 'pcs', label: 'Pièce', singular: 'pièce', plural: 'pièces', step: 1 },
  { key: 'portion', label: 'Portion', singular: 'portion', plural: 'portions', step: 1 },
  { key: 'paquet', label: 'Paquet', singular: 'paquet', plural: 'paquets', step: 1 },
  { key: 'g', label: 'g', symbol: 'g', step: 100 },
  { key: 'kg', label: 'kg', symbol: 'kg', step: 0.5 },
  { key: 'ml', label: 'mL', symbol: 'mL', step: 100 },
  { key: 'l', label: 'L', symbol: 'L', step: 0.5 },
  { key: 'cm', label: 'cm', symbol: 'cm', step: 10 },
  { key: 'm', label: 'm', symbol: 'm', step: 1 },
];

export function getUnit(key: string): UnitDef {
  return UNITS.find((u) => u.key === key) ?? UNITS[0];
}

export function isUnitKey(key: unknown): key is UnitKey {
  return typeof key === 'string' && UNITS.some((u) => u.key === key);
}

/** 1.5 -> "1,5"; 2 -> "2" */
export function formatNumber(n: number): string {
  const rounded = Math.round(n * 100) / 100;
  return String(rounded).replace('.', ',');
}

/** "3 pièces", "1 portion", "500 g", "1,5 L" */
export function formatQuantity(quantity: number, unitKey: string): string {
  const unit = getUnit(unitKey);
  const n = formatNumber(quantity);
  if (unit.symbol) return `${n} ${unit.symbol}`;
  return `${n} ${quantity > 1 ? unit.plural : unit.singular}`;
}

/** Accepts "1,5" or "1.5". Returns null if invalid. */
export function parseNumber(text: string): number | null {
  const cleaned = text.replace(',', '.').replace(/\s/g, '');
  if (cleaned === '') return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}
