import { formatMeasure, formatNumber, type MeasureUnit, MEASURE_UNITS, unitDef } from '@/lib/units';
import { Chip, ChipRow, StepperField } from '@/ui/components';

import type { StockFields } from './use-stock-fields';

/**
 * Quantity (number of items), optional size of one item and what is left in all.
 * Siblings (fragment): the form's gap applies between them.
 * To buy (Shopping tab): only the size, to find it in the shop.
 */
export function StockSection({ fields: f, toBuy }: { fields: StockFields; toBuy: boolean }) {
  const symbol = unitDef(f.sizeUnit).symbol;
  return (
    <>
      {!toBuy && (
        <StepperField
          label="Quantité"
          value={f.stock.quantity}
          onChangeText={f.changeQuantity}
          onStep={f.stepQuantity}
          keyboardType="number-pad"
          accessibilityLabel="Quantité"
          decreaseLabel="Moins"
          increaseLabel="Plus"
          hint="Le nombre d’exemplaires : c’est lui qui fait le stock et la liste de courses."
        />
      )}

      <StepperField
        label="Contenance (optionnel)"
        value={f.sizeText}
        onChangeText={f.changeSize}
        onStep={f.stepSize}
        placeholder="Ex : 500"
        keyboardType="decimal-pad"
        accessibilityLabel="Contenance"
        hint={sizeHint(toBuy ? 1 : f.quantity, f.size, f.sizeUnit)}>
        <ChipRow>
          {MEASURE_UNITS.map((u) => (
            <Chip
              key={u.key}
              label={u.symbol}
              selected={f.sizeUnit === u.key}
              onPress={() => f.changeSizeUnit(u.key)}
            />
          ))}
        </ChipRow>
      </StepperField>

      {/* What is left in all, changed apart from the number of items (a pack started) */}
      {f.hasSize && !toBuy && (
        <StepperField
          label={`Reste au total (${symbol})`}
          value={f.stock.amount || (f.fullTotal !== null ? formatNumber(f.fullTotal) : '')}
          onChangeText={f.changeAmount}
          onStep={f.stepAmount}
          keyboardType="decimal-pad"
          accessibilityLabel={`Reste au total, en ${symbol}`}
          decreaseLabel="Reste au total : moins"
          increaseLabel="Reste au total : plus"
          hint={totalHint(f.total, f.fullTotal, f.sizeUnit)}
        />
      )}
    </>
  );
}

/** What the size means: "Un exemplaire plein contient 500 g." */
function sizeHint(quantity: number | null, size: number | null, unit: MeasureUnit): string {
  if (size === null || size <= 0) {
    return 'Ce que contient un exemplaire plein, ex : un paquet de 500 g. Laisse vide si ça ne compte pas.';
  }
  const one = formatMeasure(size, unit);
  if (quantity === null || quantity < 2) return `Un exemplaire plein contient ${one}.`;
  return `Un exemplaire plein contient ${one} : ${formatMeasure(quantity * size, unit)} quand tout est plein.`;
}

/** What is left compared to all full: "Il reste 800 g sur 1 kg : 200 g déjà utilisés." */
function totalHint(total: number | null, full: number | null, unit: MeasureUnit): string {
  if (total === null || full === null || total >= full) {
    return 'Tout est plein. Entamé un paquet ? Baisse le total : la quantité suit toute seule.';
  }
  return `Il reste ${formatMeasure(total, unit)} sur ${formatMeasure(full, unit)} : ${formatMeasure(full - total, unit)} déjà utilisés.`;
}
