/**
 * Item form (fiche objet), pure part: the stock fields as typed text (number of items, size
 * of one item, what is left in all), how each one moves the others, and the validation that
 * turns the whole form into an `ItemInput`.
 */
import type { Item, ItemInput } from '@/db/queries';

import { type Batch, fitBatches, takeEarliest } from './batches';
import { frToIso } from './dates';
import { capitalize } from './text';
import {
  formatNumber,
  isMeasureUnit,
  type MeasureUnit,
  parseCount,
  parseNumber,
  quantityForTotal,
  stepValue,
  totalForQuantity,
} from './units';

/** Always a unit (a size without one means nothing): grams by default */
export const DEFAULT_SIZE_UNIT: MeasureUnit = 'g';

/**
 * Number of items + what is left in all, in the unit of the size
 * ('' = every item is full: follows quantity × size). Each one moves the other.
 */
export type StockText = { quantity: string; amount: string };

/**
 * Several dates (bought at different times): one batch per date, for a stock of `base`
 * items (fewer items now = taken from the earliest batch)
 */
export type Lots = { batches: Batch[]; base: number };

/** The stock fields as numbers. `total`: what is left in all (unit of the size), null without size. */
export function readStock(stock: StockText, sizeText: string) {
  const quantity = parseCount(stock.quantity);
  const size = sizeText.trim() ? parseNumber(sizeText) : null;
  const hasSize = size !== null && size > 0;
  const fullTotal = hasSize && quantity !== null ? quantity * size : null;
  const total = hasSize ? (stock.amount.trim() ? parseNumber(stock.amount) : fullTotal) : null;
  return { quantity, size, hasSize, fullTotal, total };
}

/** Fields of a saved item. */
export function initialStock(item: Pick<Item, 'quantity' | 'size' | 'size_unit' | 'amount'>) {
  const full = item.size ? item.quantity * item.size : null;
  return {
    stock: {
      quantity: formatNumber(item.quantity),
      // Something used up: shown apart; all full = follows the quantity
      amount: full !== null && item.amount !== null && item.amount < full ? formatNumber(item.amount) : '',
    },
    sizeText: item.size ? formatNumber(item.size) : '',
    sizeUnit: isMeasureUnit(item.size_unit) ? item.size_unit : DEFAULT_SIZE_UNIT,
  };
}

/**
 * New number of items: what is left follows (one more = full, one less = the started one).
 * `size`: of one item, null without size.
 */
export function withQuantity(stock: StockText, text: string, size: number | null): StockText {
  const before = parseCount(stock.quantity);
  const after = parseCount(text);
  const left = stock.amount.trim() ? parseNumber(stock.amount) : null;
  if (size === null || before === null || after === null || left === null) return { ...stock, quantity: text };
  const next = totalForQuantity(before, left, after, size);
  return { quantity: text, amount: next < after * size ? formatNumber(next) : '' };
}

/** − / + of what is left: the number of items follows (down to 500 g in packs of 500 g → 1). */
export function stepAmount(stock: StockText, size: number, step: number, direction: 1 | -1): StockText {
  const count = parseCount(stock.quantity) ?? 0;
  const left = (stock.amount.trim() ? parseNumber(stock.amount) : null) ?? count * size;
  const next = stepValue(left, step, direction);
  const nextCount = quantityForTotal(next, size);
  return { quantity: String(nextCount), amount: next < nextCount * size ? formatNumber(next) : '' };
}

/** − / + of the size, back on the grid of the step: 250 g → + gives 300 g, − gives 200 g; 0 = no size. */
export function stepSize(sizeText: string, step: number, direction: 1 | -1): string {
  const value = stepValue(parseNumber(sizeText) ?? 0, step, direction);
  return value > 0 ? formatNumber(value) : '';
}

/** Batches that fit in the stock: fewer items = the earliest batch goes first, as in the lists */
export function fitLots(lots: Lots | null, quantity: number | null): Batch[] | null {
  return lots && fitBatches(takeEarliest(lots.batches, Math.max(0, lots.base - (quantity ?? 0))), quantity ?? 0);
}

export type ItemForm = {
  name: string;
  icon: string | null;
  stock: StockText;
  sizeText: string;
  sizeUnit: MeasureUnit;
  category: string;
  subcategory: string | null;
  minText: string;
  expiresText: string;
  lots: Lots | null;
  frozenAt: string | null;
  notes: string;
  barcode: string | null;
  furnitureId: number | null;
  /** Added from the Shopping tab: out of stock, no minimum */
  toBuy: boolean;
  /** Fields shown for the category (a hidden one is not saved) */
  showExpiry: boolean;
  showFrozen: boolean;
};

/** Checks the form; the first problem found is returned as [title, message]. */
export function buildItemInput(form: ItemForm): { input: ItemInput } | { error: [string, string] } {
  const { quantity, size, hasSize, total } = readStock(form.stock, form.sizeText);
  const name = capitalize(form.name);
  const min = form.minText.trim() ? parseCount(form.minText) : null;
  const expiresIso = form.expiresText.trim() ? frToIso(form.expiresText) : null;

  if (!name) return { error: ['Nom manquant', "Donne un nom à l'objet."] };
  if (quantity === null) return { error: ['Quantité invalide', 'Saisis un nombre entier : 0, 1, 2…'] };
  if (form.sizeText.trim() && (size === null || size <= 0)) {
    return { error: ['Contenance invalide', 'Saisis un nombre positif, ex : 500.'] };
  }
  if (hasSize && (total === null || total < 0)) {
    return { error: ['Total invalide', 'Saisis ce qu’il reste en tout, ex : 800.'] };
  }
  if (form.minText.trim() && min === null) {
    return { error: ['Stock minimum invalide', 'Saisis un nombre entier : 1, 2…'] };
  }
  if (form.showExpiry && form.expiresText.trim() && !expiresIso) {
    return { error: ['Date invalide', 'Format attendu : JJ/MM/AAAA.'] };
  }
  if (!form.furnitureId) return { error: ['Emplacement manquant', 'Choisis où est rangé cet objet.'] };

  const lots = fitLots(form.lots, quantity);
  return {
    input: {
      furniture_id: form.furnitureId,
      name,
      icon: form.icon,
      // To buy: out of stock, and back in stock once one is bought (minimum 0)
      // More left than the items can hold (800 g typed for 1 pack of 500 g): 2 packs
      quantity: form.toBuy ? 0 : hasSize && total! > quantity * size! ? quantityForTotal(total!, size!) : quantity,
      size,
      size_unit: size !== null ? form.sizeUnit : null,
      amount: hasSize ? (form.toBuy ? 0 : total) : null,
      category: form.category,
      subcategory: form.subcategory,
      min_quantity: form.toBuy ? 0 : min,
      expires_at: form.showExpiry ? (lots ? (lots[0]?.expires_at ?? null) : expiresIso) : null,
      // Several dates: given per batch; one date: for the whole stock
      batches: !form.showExpiry ? [] : lots ? fitBatches(lots, form.toBuy ? 0 : quantity) : undefined,
      frozen_at: form.showFrozen ? form.frozenAt : null,
      barcode: form.barcode,
      notes: form.notes.trim() || null,
    },
  };
}
