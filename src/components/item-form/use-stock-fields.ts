import { useState } from 'react';

import type { Item } from '@/db/queries';
import {
  DEFAULT_SIZE_UNIT,
  initialStock,
  readStock,
  stepAmount,
  stepSize,
  type StockText,
  withQuantity,
} from '@/lib/stock-form';
import { formatNumber, type MeasureUnit, parseCount, parseNumber, unitDef } from '@/lib/units';

/**
 * Stock fields of the item form: number of items, optional size of one item (« Contenance »)
 * and what is left in all. Actions use the updater form: − / + held down call them in a row.
 */
export function useStockFields() {
  const [stock, setStock] = useState<StockText>({ quantity: '1', amount: '' });
  const [sizeText, setSizeText] = useState('');
  const [sizeUnit, setSizeUnit] = useState<MeasureUnit>(DEFAULT_SIZE_UNIT);

  const values = readStock(stock, sizeText);
  /** Size of one item, null without size */
  const perItem = values.hasSize ? values.size : null;
  /** − / + of the size and of the total: one step of the chosen unit */
  const sizeStep = unitDef(sizeUnit).step;
  // A new size (or unit): the used-up part no longer means anything, back to all full
  const allFull = () => setStock((s) => ({ ...s, amount: '' }));

  return {
    stock,
    sizeText,
    sizeUnit,
    ...values,

    /** Fields of a saved item */
    load(item: Pick<Item, 'quantity' | 'size' | 'size_unit' | 'amount'>) {
      const init = initialStock(item);
      setStock(init.stock);
      setSizeText(init.sizeText);
      setSizeUnit(init.sizeUnit);
    },
    /** Number of items typed (or set): what is left follows */
    changeQuantity(text: string) {
      setStock((s) => withQuantity(s, text, perItem));
    },
    stepQuantity(delta: -1 | 1) {
      setStock((s) => withQuantity(s, String(Math.max(0, Math.round(parseNumber(s.quantity) ?? 0) + delta)), perItem));
    },
    /** `count` more items (a pack scanned again) */
    addItems(count: number) {
      setStock((s) => withQuantity(s, String((parseCount(s.quantity) ?? 0) + count), perItem));
    },
    /** A new stock of `count` full items (another product scanned) */
    resetQuantity(count: number) {
      setStock({ quantity: formatNumber(count), amount: '' });
    },
    changeSize(text: string) {
      setSizeText(text);
      allFull();
    },
    stepSize(direction: -1 | 1) {
      setSizeText((text) => stepSize(text, sizeStep, direction));
      allFull();
    },
    changeSizeUnit(unit: MeasureUnit) {
      setSizeUnit(unit);
      allFull();
    },
    /** Size of a product (suggestion, scan): null = no size */
    setSize(size: number | null | undefined, unit: MeasureUnit | null) {
      setSizeUnit(unit ?? DEFAULT_SIZE_UNIT);
      setSizeText(size ? formatNumber(size) : '');
      allFull();
    },
    changeAmount(text: string) {
      setStock((s) => ({ ...s, amount: text }));
    },
    stepAmount(direction: -1 | 1) {
      if (perItem === null) return;
      setStock((s) => stepAmount(s, perItem, sizeStep, direction));
    },
  };
}

export type StockFields = ReturnType<typeof useStockFields>;
