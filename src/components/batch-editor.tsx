import { useState } from 'react';
import { View } from 'react-native';

import { type Batch, cleanBatches, undatedCount } from '@/lib/batches';
import { addToToday, describeExpiry, frToIso, isoToFr } from '@/lib/dates';
import { giveFeedback } from '@/lib/feedback';
import { formatNumber } from '@/lib/units';
import { Button, Chip, ChipRow, Hint, ListRow, ModalCard, showError, Stepper, TextField } from '@/ui/components';
import { spacing } from '@/ui/theme';

export const EXPIRY_SHORTCUTS: [string, Parameters<typeof addToToday>[0]][] = [
  ['+3 j', { days: 3 }],
  ['+1 sem.', { days: 7 }],
  ['+1 mois', { months: 1 }],
  ['+6 mois', { months: 6 }],
  ['+1 an', { years: 1 }],
];

/**
 * Expiry date typed as JJ/MM/AAAA, with shortcuts (+3 j, +1 mois…) and, once valid, what it
 * means (« Périme dans 3 jours »). Rendered as siblings (fragment): the parent's gap applies.
 * The text is the caller's: parse it with `frToIso()` (null = empty or invalid).
 */
export function ExpiryDateField({
  value,
  onChange,
  label = 'Date de péremption (optionnel)',
  showDescription = true,
  clearable,
}: {
  value: string;
  onChange: (text: string) => void;
  label?: string;
  /** Shows « Périme dans N jours » under a valid date (false: frozen, the date no longer counts down) */
  showDescription?: boolean;
  /** Adds an « Aucune » chip that empties the field, once something is typed */
  clearable?: boolean;
}) {
  const iso = value.trim() ? frToIso(value) : null;
  return (
    <>
      <TextField
        label={label}
        value={value}
        onChangeText={onChange}
        placeholder="JJ/MM/AAAA"
        keyboardType="numbers-and-punctuation"
      />
      <ChipRow>
        {EXPIRY_SHORTCUTS.map(([shortcut, amount]) => (
          <Chip key={shortcut} label={shortcut} onPress={() => onChange(isoToFr(addToToday(amount)))} />
        ))}
        {clearable && !!value && <Chip label="Aucune" onPress={() => onChange('')} />}
      </ChipRow>
      {iso && showDescription && <Hint>{describeExpiry(iso)}</Hint>}
    </>
  );
}

/** « Leur date de péremption ? Les 2 déjà en stock gardent la leur. », worded for the counts */
function restockDateQuestion(bought: number, inStock: number): string {
  const question = bought > 1 ? 'Leur date de péremption ?' : 'Sa date de péremption ?';
  if (inStock <= 0) return question;
  const kept = inStock > 1 ? `Les ${inStock} déjà en stock gardent la leur.` : 'Celui déjà en stock garde la sienne.';
  return `${question} ${kept}`;
}

/**
 * Bought again (Courses): asks the expiry date of what was just bought, optional.
 * `onDone(null)` = no date.
 */
export function RestockDateModal({
  visible,
  title,
  bought,
  inStock,
  onDone,
  onClose,
}: {
  visible: boolean;
  title: string;
  /** Number of items just bought */
  bought: number;
  /** Number of items already in stock: they keep their own dates */
  inStock: number;
  onDone: (expiresAt: string | null) => void;
  onClose: () => void;
}) {
  const [dateText, setDateText] = useState('');
  // Empty on every open, even after « Annuler » (adjusted during render, no effect)
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) setDateText('');
  }
  const iso = dateText.trim() ? frToIso(dateText) : null;
  return (
    <ModalCard
      visible={visible}
      title={title}
      subtitle={restockDateQuestion(bought, inStock)}
      onClose={onClose}
      avoidKeyboard>
      <ExpiryDateField value={dateText} onChange={setDateText} />
      <Button
        title="Ajouter au stock"
        icon="cart-add"
        feedback={false}
        onPress={() => {
          if (dateText.trim() && !iso) return showError('Date invalide', 'Format attendu : JJ/MM/AAAA.');
          onDone(iso);
        }}
      />
      <Button title="Sans date" variant="secondary" feedback={false} onPress={() => onDone(null)} />
      <Button title="Annuler" variant="ghost" feedback="close" onPress={onClose} />
    </ModalCard>
  );
}

/** Batch being edited: its index in the list, or 'new'; `max` = items it can cover (its own + the undated ones) */
type Editing = { index: number | 'new'; count: number; max: number; dateText: string };

/**
 * Expiry dates of a stock bought at different times (see lib/batches.ts): one row per date,
 * « N sans date » for the rest, a tap edits a batch (how many, which date).
 * `batches` must already fit in `quantity`; a batch never covers more than its own items plus
 * the undated ones (more stock = the quantity of the form first).
 */
export function BatchEditor({
  batches,
  quantity,
  frozen,
  onChange,
}: {
  batches: Batch[];
  quantity: number;
  /** Frozen: dates kept but no longer counting down */
  frozen: boolean;
  onChange: (batches: Batch[]) => void;
}) {
  const [editing, setEditing] = useState<Editing | null>(null);
  const undated = undatedCount(batches, quantity);

  const open = (index: number | 'new') =>
    setEditing(
      index === 'new'
        ? { index, count: undated, max: undated, dateText: '' }
        : {
            index,
            count: batches[index].quantity,
            max: batches[index].quantity + undated,
            dateText: isoToFr(batches[index].expires_at),
          },
    );

  const save = () => {
    if (!editing) return;
    const iso = frToIso(editing.dateText);
    if (!iso) return showError('Date invalide', 'Format attendu : JJ/MM/AAAA.');
    const others = batches.filter((_, i) => i !== editing.index);
    onChange(cleanBatches([...others, { quantity: editing.count, expires_at: iso }]));
    giveFeedback('success');
    setEditing(null);
  };

  const remove = () => {
    if (!editing || editing.index === 'new') return;
    onChange(batches.filter((_, i) => i !== editing.index));
    giveFeedback('delete');
    setEditing(null);
  };

  return (
    <View style={{ gap: spacing.sm }}>
      {batches.map((b, index) => (
        <ListRow
          key={b.expires_at}
          title={`${formatNumber(b.quantity)} × ${isoToFr(b.expires_at)}`}
          subtitle={frozen ? undefined : describeExpiry(b.expires_at)}
          icon="calendar"
          inset={false}
          chevron
          onPress={() => open(index)}
        />
      ))}
      {undated > 0 ? (
        <>
          <Hint>{`${formatNumber(undated)} sans date`}</Hint>
          <Button title="Ajouter une date" icon="add" variant="secondary" onPress={() => open('new')} />
        </>
      ) : (
        <Hint>Tous les exemplaires ont une date. Augmente la quantité pour en ajouter d’autres.</Hint>
      )}

      <ModalCard
        visible={!!editing}
        title={editing?.index === 'new' ? 'Nouvelle date' : 'Modifier la date'}
        subtitle="Combien d’exemplaires périment à cette date ?"
        onClose={() => setEditing(null)}
        avoidKeyboard>
        {editing && (
          <>
            <Stepper
              size="lg"
              value={formatNumber(editing.count)}
              decreaseLabel="Moins"
              increaseLabel="Plus"
              atMin={editing.count <= 1}
              atMax={editing.count >= editing.max}
              onStep={(d) => setEditing((e) => e && { ...e, count: Math.min(e.max, Math.max(1, e.count + d)) })}
            />
            <ExpiryDateField
              label="Date de péremption"
              value={editing.dateText}
              onChange={(dateText) => setEditing((e) => e && { ...e, dateText })}
              showDescription={!frozen}
            />
            <Button title="Enregistrer" feedback={false} onPress={save} />
            {editing.index !== 'new' && (
              <Button title="Retirer cette date" variant="danger" feedback={false} onPress={remove} />
            )}
            <Button title="Annuler" variant="ghost" feedback="close" onPress={() => setEditing(null)} />
          </>
        )}
      </ModalCard>
    </View>
  );
}
