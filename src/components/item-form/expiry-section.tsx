import { View } from 'react-native';

import { BatchEditor, ExpiryDateField } from '@/components/batch-editor';
import type { Batch } from '@/lib/batches';
import { daysUntil, freezerWarningMonths, frToIso, isoToFr } from '@/lib/dates';
import { thawNote } from '@/lib/freezer';
import type { Lots } from '@/lib/stock-form';
import { Button, Checkbox, FieldLabel, Hint, showError } from '@/ui/components';
import { spacing } from '@/ui/theme';

/**
 * Expiry (one date for all, or one per batch) and « Congelé », each only when the category
 * has it. `onLotsChange`: switched to / edited the batches (more dated items than the stock =
 * bought more: the form raises its quantity).
 */
export function ExpirySection({
  showExpiry,
  showFrozen,
  quantity,
  expiresText,
  onExpiresChange,
  lots,
  onLotsChange,
  frozenAt,
  onFrozenChange,
  thawedUntil,
}: {
  showExpiry: boolean;
  showFrozen: boolean;
  quantity: number | null;
  expiresText: string;
  onExpiresChange: (text: string) => void;
  /** Batches that fit in the stock, null = one date for all */
  lots: Batch[] | null;
  onLotsChange: (lots: Lots) => void;
  frozenAt: string | null;
  onFrozenChange: (frozen: boolean) => void;
  /** Taken out of the freezer in this form: the expiry date it was given */
  thawedUntil: string | null;
}) {
  if (!showExpiry && !showFrozen) return null;
  const count = quantity ?? 0;
  const frozen = showFrozen && !!frozenAt;

  const splitDates = () => {
    const iso = expiresText.trim() ? frToIso(expiresText) : null;
    if (expiresText.trim() && !iso) return showError('Date invalide', 'Format attendu : JJ/MM/AAAA.');
    onLotsChange({ batches: iso ? [{ quantity: count, expires_at: iso }] : [], base: count });
  };

  return (
    <View style={{ gap: spacing.sm }}>
      {showExpiry && lots && (
        <>
          <FieldLabel>Dates de péremption</FieldLabel>
          <BatchEditor
            batches={lots}
            quantity={count}
            frozen={frozen}
            onChange={(batches) => onLotsChange({ batches, base: count })}
          />
          <Hint>
            Racheté plus tard ? Chaque achat garde sa date. Quand tu en retires, la date la plus proche part en premier.
          </Hint>
        </>
      )}
      {showExpiry && !lots && (
        <>
          <ExpiryDateField value={expiresText} onChange={onExpiresChange} clearable showDescription={!frozen} />
          {count >= 2 && (
            <Button title="Pas tous la même date ?" icon="calendar" variant="secondary" onPress={splitDates} />
          )}
        </>
      )}
      {showFrozen && (
        <>
          <Checkbox label="Congelé" checked={!!frozenAt} onChange={onFrozenChange} />
          <Hint>
            {frozenAt
              ? frozenHint(frozenAt)
              : `À cocher si tu l’as mis toi-même au congélateur : la péremption n’est plus surveillée et tu seras prévenu après ${freezerWarningMonths()} mois. Acheté déjà surgelé ? Choisis plutôt la catégorie « Surgelés ».`}
          </Hint>
        </>
      )}
      {!!thawedUntil && <Hint>{thawNote(thawedUntil)}</Hint>}
    </View>
  );
}

/** "Congelé le 12/11/2026 (il y a 3 j) · …" */
function frozenHint(frozenAt: string): string {
  const days = -daysUntil(frozenAt);
  const since = days <= 0 ? 'aujourd’hui' : `il y a ${days} j`;
  return `Congelé le ${isoToFr(frozenAt)} (${since}). La date de péremption n’est plus surveillée ; tu seras prévenu après ${freezerWarningMonths()} mois.`;
}
