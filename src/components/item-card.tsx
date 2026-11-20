import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { Extrapolation, interpolate, useAnimatedStyle } from 'react-native-reanimated';

import { adjustAmount, adjustQuantity, emptyItem, getItem, type Item, itemBatches } from '@/db/queries';
import { itemBadges } from '@/lib/badges';
import { isSingleDate, undatedCount } from '@/lib/batches';
import { categoryIcon, itemIcon } from '@/lib/catalog';
import { daysUntil, expiryWarningDays, isoToFr, monthsSince, shortExpiry } from '@/lib/dates';
import { giveFeedback, withFeedback } from '@/lib/feedback';
import { describeStock, formatMeasure, formatPieces, formatSize, formatStock, totalOf, unitDef } from '@/lib/units';
import { BadgeRow, Button, Chip, IconTile, SelectionMark, Stepper } from '@/ui/components';
import { FoldChevron, useFold } from '@/ui/fold';
import { card, colors, depth, font, fonts, radius, spacing, tones } from '@/ui/theme';

/**
 * After a change of the stock, the list is reloaded only once the − / + keys rest for this
 * long: a held key no longer reloads the whole list at each step (the card shows its own
 * fresh value meanwhile).
 */
const RELOAD_DELAY_MS = 150;

type Props = {
  item: Item;
  /** Where the item is (search results), shown in the details. */
  location?: string;
  /** Called after quantity changes (e.g. reload), at most once per burst of steps. */
  onChanged: () => void;
  /** Long press (e.g. start selecting several items). */
  onLongPress?: () => void;
  /** Selection mode: the card stays folded, a tap toggles the item. */
  selection?: { selected: boolean; onToggle: () => void };
};

/**
 * Foldable item card, in the spirit of the rooms of the home screen.
 * Folded: name (2 lines), status badges, read-only quantity.
 * Unfolded: − / + on the quantity, useful details, "Modifier" button at the bottom
 * (the card itself no longer opens the form: a tap folds / unfolds it).
 */
export function ItemCard({ item: listed, location, onChanged, onLongPress, selection }: Props) {
  const db = useSQLiteContext();
  const [expanded, setExpanded] = useState(false);
  // Selection starts: the card folds, and stays folded once the selection is over
  const selecting = !!selection;
  const [wasSelecting, setWasSelecting] = useState(selecting);
  if (selecting !== wasSelecting) {
    setWasSelecting(selecting);
    if (selecting) setExpanded(false);
  }
  const isOpen = expanded && !selection;
  const selected = !!selection?.selected;
  const fold = useFold({ expanded: isOpen, squashScale: 0.99, glideMs: 220, selected });

  // Item read back right after a change, shown until the reloaded list brings it
  const [fresh, setFresh] = useState<Item | null>(null);
  const [lastListed, setLastListed] = useState(listed);
  if (listed !== lastListed) {
    setLastListed(listed);
    setFresh(null);
  }
  const item = fresh ?? listed;

  const reloadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (reloadTimer.current) clearTimeout(reloadTimer.current);
    },
    [],
  );
  /** Writes, shows the new value at once, reloads the list once the keys rest. */
  const change = async (write: () => Promise<unknown>) => {
    await write();
    const updated = await getItem(db, listed.id);
    if (updated) setFresh(updated);
    if (reloadTimer.current) clearTimeout(reloadTimer.current);
    reloadTimer.current = setTimeout(() => {
      reloadTimer.current = null;
      onChanged();
    }, RELOAD_DELAY_MS);
  };

  const toggle = () => {
    fold.press();
    giveFeedback(isOpen ? 'close' : 'open');
    setExpanded(!isOpen);
  };

  // Only the shared value goes into the worklets (not the whole `fold` object)
  const open = fold.open;
  const bodyContentStyle = useAnimatedStyle(() => ({
    opacity: interpolate(open.get(), [0.3, 1], [0, 1], Extrapolation.CLAMP),
    transform: [{ translateY: (1 - open.get()) * -8 }],
  }));
  // The read-only quantity of the header gives way to the − / + of the details
  const quantityStyle = useAnimatedStyle(() => ({ opacity: 1 - Math.min(1, Math.max(0, open.get())) }));

  const quantity = formatStock(item, { pieces: true });
  const total = totalOf(item);
  const unit = total !== null && item.size_unit ? unitDef(item.size_unit) : null;
  const badges = itemBadges(item);

  return (
    <Animated.View style={[styles.card, selected && styles.cardSelected, fold.containerStyle]}>
      <Pressable
        onPress={selection ? withFeedback('tick', selection.onToggle) : toggle}
        onLongPress={
          selection ? withFeedback('tick', selection.onToggle) : onLongPress && withFeedback('hold', onLongPress)
        }
        accessibilityRole="button"
        accessibilityLabel={`${item.name}, ${describeStock(item)}${badges.length ? `, ${badges.map((b) => b.label.toLowerCase()).join(', ')}` : ''}`}
        accessibilityState={selection ? { selected: selection.selected } : { expanded: isOpen }}
        accessibilityHint={selection ? undefined : `${isOpen ? 'Masque' : 'Affiche'} les détails et la quantité.`}
        style={styles.header}>
        <View style={styles.headerRow}>
          {/* Always at the top, like the item rows */}
          <View style={{ alignSelf: 'flex-start' }}>
            <IconTile icon={itemIcon(item)} tintKey={item.category ?? undefined} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={font.bodyStrong} numberOfLines={2}>
              {item.name}
            </Text>
          </View>
          {selection ? (
            <SelectionMark checked={selection.selected} text={quantity} />
          ) : (
            <>
              <Animated.Text
                style={[styles.quantity, item.quantity === 0 && { color: colors.textMuted }, quantityStyle]}
                numberOfLines={1}>
                {quantity}
              </Animated.Text>
              {/* Same key as the rooms of the home screen */}
              <FoldChevron open={open} expanded={isOpen} name={item.name} onPress={toggle} />
            </>
          )}
        </View>
        {!!badges.length && <BadgeRow badges={badges} indent />}
      </Pressable>

      {/* Folded: details neither touchable nor read by screen readers (iOS + Android props) */}
      <Animated.View style={[styles.bodyClip, fold.bodyStyle, { pointerEvents: isOpen ? 'auto' : 'none' }]}>
        <Animated.View
          onLayout={fold.onBodyLayout}
          style={[styles.body, bodyContentStyle]}
          accessibilityElementsHidden={!isOpen}
          importantForAccessibility={isOpen ? 'auto' : 'no-hide-descendants'}>
          {/* Same chips as the item form (icon on a light background), read-only */}
          {!!item.category && (
            <View style={styles.chips}>
              <Chip label={item.category} icon={categoryIcon(item.category, null)} style={styles.chip} />
              {!!item.subcategory && (
                <Chip
                  label={item.subcategory}
                  icon={categoryIcon(item.category, item.subcategory)}
                  style={styles.chip}
                />
              )}
            </View>
          )}

          {/* Light inset list: label on the left, value on the right, one line each */}
          <View style={styles.list}>
            <View style={styles.listRow}>
              <Text style={font.label}>Quantité</Text>
              <Stepper
                value={formatPieces(item.quantity)}
                muted={item.quantity === 0}
                decreaseLabel={`Retirer 1 ${item.name}`}
                increaseLabel={`Ajouter 1 ${item.name}`}
                onStep={(d) => change(() => adjustQuantity(db, item.id, d))}
              />
            </View>
            {/* What is left in all, apart from the number of items: 200 g eaten out of 2 × 500 g */}
            {total !== null && unit && (
              <View style={[styles.listRow, styles.listRowDivider]}>
                <Text style={font.label}>Reste</Text>
                <Stepper
                  value={formatMeasure(total, unit.key)}
                  muted={total === 0}
                  decreaseLabel={`Retirer ${formatMeasure(unit.step, unit.key)} de ${item.name}`}
                  increaseLabel={`Ajouter ${formatMeasure(unit.step, unit.key)} de ${item.name}`}
                  onStep={(d) => change(() => adjustAmount(db, item.id, d * unit.step))}
                />
              </View>
            )}
            {details(item, location).map((line) =>
              'expiry' in line ? (
                <ExpiryDetail key="expiry" lines={line.expiry} />
              ) : (
                <View key={line.label} style={[styles.listRow, styles.listRowDivider]}>
                  <Text style={font.label}>{line.label}</Text>
                  <Text style={styles.value}>{line.value}</Text>
                </View>
              ),
            )}
          </View>

          <View style={styles.actions}>
            <Button
              title="Modifier"
              onPress={() => router.push({ pathname: '/item/[id]', params: { id: item.id } })}
              style={styles.actionButton}
            />
            {/* « Épuisé »: all used up in one tap (0, nothing left) */}
            <Button
              title="Épuisé"
              variant="warn"
              disabled={item.quantity === 0 && !total}
              onPress={() => change(() => emptyItem(db, item.id))}
              style={styles.actionButton}
            />
          </View>
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
}

/** One expiry line: a batch (« 2 pcs », date, « dans 3 j ») or the undated items (no date). */
type ExpiryLine = {
  count: string | null;
  date: string | null;
  status: string | null;
  urgent: 'expired' | 'soon' | null;
};

type DetailLine = { label: string; value: string } | { expiry: ExpiryLine[] };

/** Lines of the unfolded card (category apart, as chips); empty fields are left out. */
function details(item: Item, location?: string): DetailLine[] {
  const lines: DetailLine[] = [];
  const push = (label: string, value: string) => lines.push({ label, value });
  if (location) push('Rangé dans', location);
  const size = formatSize(item);
  if (size) push('Contenance', `${size} chacun`);
  if (item.quantity === 0) push('Stock', 'Épuisé');
  if (item.min_quantity !== null) {
    const low = item.quantity <= item.min_quantity;
    push('Stock minimum', `${formatPieces(item.min_quantity)}${low ? ' · à racheter' : ''}`);
  }
  if (item.frozen_at) {
    const months = monthsSince(item.frozen_at);
    push('Congelé le', `${isoToFr(item.frozen_at)}${months > 0 ? ` · depuis ${months} mois` : ''}`);
  }
  // Frozen: the dates are kept but no longer count down
  const dated = (iso: string, count: string | null): ExpiryLine => {
    if (item.frozen_at) return { count, date: isoToFr(iso), status: null, urgent: null };
    const days = daysUntil(iso);
    const urgent = days < 0 ? 'expired' : days <= expiryWarningDays() ? 'soon' : null;
    return { count, date: isoToFr(iso), status: shortExpiry(iso), urgent };
  };
  const batches = itemBatches(item);
  if (!isSingleDate(batches, item.quantity)) {
    // Bought at different times: one line per date, earliest first, then the undated ones
    const expiry = batches.map((b) => dated(b.expires_at, formatPieces(b.quantity)));
    const undated = undatedCount(batches, item.quantity);
    if (undated > 0) expiry.push({ count: formatPieces(undated), date: null, status: null, urgent: null });
    lines.push({ expiry });
  } else if (item.expires_at) {
    lines.push({ expiry: [dated(item.expires_at, null)] });
  }
  if (item.notes) push('Notes', item.notes);
  return lines;
}

/**
 * « Péremption » of the unfolded card. One date: label on the left, date and delay on the right.
 * Several (batches): label on top, then one line per batch in columns (count, date, delay), so
 * that a long list stays readable.
 */
function ExpiryDetail({ lines }: { lines: ExpiryLine[] }) {
  const statusColor = (l: ExpiryLine) => (l.urgent ? tones[l.urgent].fg : colors.textMuted);
  if (lines.length === 1 && !lines[0].count) {
    const l = lines[0];
    return (
      <View style={[styles.listRow, styles.listRowDivider]}>
        <Text style={font.label}>Péremption</Text>
        <View style={{ flex: 1, alignItems: 'flex-end' }}>
          <Text style={styles.value}>{l.date}</Text>
          {!!l.status && <Text style={[styles.status, { color: statusColor(l) }]}>{l.status}</Text>}
        </View>
      </View>
    );
  }
  return (
    <View style={[styles.listRowDivider, styles.expiryBlock]}>
      <Text style={font.label}>Péremption</Text>
      {lines.map((l) => (
        <View key={l.date ?? 'undated'} style={styles.batchLine}>
          <Text style={styles.batchCount}>{l.count}</Text>
          <Text style={[styles.batchDate, !l.date && { color: colors.textMuted }]}>{l.date ?? 'sans date'}</Text>
          {!!l.status && <Text style={[styles.status, { color: statusColor(l) }]}>{l.status}</Text>}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  // Same outline as the rooms of the home screen
  card: { ...card, marginHorizontal: spacing.lg, borderWidth: 2, borderColor: colors.edge },
  chip: { paddingVertical: 4, paddingHorizontal: spacing.sm + 2 },
  // Background: animated (useFold `selected`)
  cardSelected: { borderColor: colors.selectedEdge, ...depth(3, colors.selectedEdge) },
  header: {
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    minHeight: 64,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  quantity: { fontFamily: fonts.bold, fontSize: 14, color: colors.text, textAlign: 'right' },
  // Clip of the details: its height (measured × open) only reveals the content,
  // which stays out of the flow with its natural height
  bodyClip: { overflow: 'hidden', borderBottomLeftRadius: radius.lg, borderBottomRightRadius: radius.lg },
  body: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    paddingBottom: spacing.md,
    gap: spacing.md,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  list: { backgroundColor: colors.surface, borderRadius: radius.md, paddingHorizontal: spacing.md },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    minHeight: 48,
    paddingVertical: spacing.sm,
  },
  listRowDivider: { borderTopWidth: 1, borderTopColor: colors.line },
  value: { flex: 1, textAlign: 'right', fontFamily: fonts.medium, fontSize: 14, color: colors.text },
  status: { fontFamily: fonts.medium, fontSize: 13, textAlign: 'right' },
  expiryBlock: { paddingVertical: spacing.sm + 2, gap: spacing.xs + 2 },
  batchLine: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  // Fixed width: the dates line up from one batch to the next
  batchCount: { width: 56, fontFamily: fonts.semibold, fontSize: 14, color: colors.text },
  batchDate: { flex: 1, fontFamily: fonts.medium, fontSize: 14, color: colors.text },
  actions: { flexDirection: 'row', gap: spacing.sm },
  actionButton: { flex: 1, minHeight: 44, paddingVertical: 8, paddingHorizontal: spacing.sm },
});
