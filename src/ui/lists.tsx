import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { type Feedback, withFeedback } from '@/lib/feedback';

import { Icon, type IconName } from './icon';
import { card, colors, depth, font, fonts, radius, spacing, sunk, tintFor, type Tone, tones } from './theme';

export type BadgeSpec = { label: string; tone: Tone };

/** Illustration on a pastel square (color derived from `tintKey`). */
const ICON_TILE_SIZE = 44;

export function IconTile({
  icon,
  size = ICON_TILE_SIZE,
  tintKey,
  bordered,
}: {
  icon: IconName;
  size?: number;
  tintKey?: string;
  /** Light outline, to stand out on a tinted background */
  bordered?: boolean;
}) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.34,
        backgroundColor: tintFor(tintKey ?? icon),
        ...(bordered && { borderWidth: 2, borderColor: colors.surface }),
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <Icon name={icon} size={Math.round(size * 0.62)} />
    </View>
  );
}

type ListRowProps = {
  title: string;
  /** Secondary text; an array = one line each */
  subtitle?: string | string[];
  /**
   * Line of its own between the row and the footer, value in bold
   * (e.g. the location on the shopping list: "Rangé dans : Cuisine › Frigo")
   */
  note?: { label: string; value: string };
  icon?: IconName;
  /** Key used to pick the pastel behind the icon (defaults to the icon) */
  tintKey?: string;
  right?: ReactNode;
  badges?: BadgeSpec[];
  onPress?: () => void;
  onLongPress?: () => void;
  chevron?: boolean;
  /** Horizontal margin of the card (false when the parent already pads) */
  inset?: boolean;
  /** Highlighted (selection mode) */
  selected?: boolean;
  /** Full-width content under the row, inside the card (e.g. shopping controls) */
  footer?: ReactNode;
  /** Sound / vibration on press (a long press always vibrates) */
  feedback?: Feedback | false;
};

export function ListRow({
  title,
  subtitle,
  note,
  icon,
  tintKey,
  right,
  badges,
  onPress,
  onLongPress,
  chevron,
  inset = true,
  selected,
  footer,
  feedback = 'tap',
}: ListRowProps) {
  return (
    <Pressable
      onPress={onPress && withFeedback(feedback, onPress)}
      onLongPress={onLongPress && withFeedback('hold', onLongPress)}
      disabled={!onPress && !onLongPress}
      accessibilityState={selected === undefined ? undefined : { selected }}
      style={({ pressed }) => [
        styles.row,
        inset && { marginHorizontal: spacing.lg },
        selected && styles.rowSelected,
        (!!footer || !!note) && { paddingBottom: spacing.md + 2 },
        pressed && sunk(3, selected ? colors.selectedEdge : colors.edge),
      ]}>
      <View style={styles.rowMain}>
        {/* Always at the top, however many lines the text takes */}
        {icon && (
          <View style={{ alignSelf: 'flex-start' }}>
            <IconTile icon={icon} tintKey={tintKey} />
          </View>
        )}
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={font.bodyStrong} numberOfLines={1}>
            {title}
          </Text>
          {(Array.isArray(subtitle) ? subtitle : subtitle ? [subtitle] : []).map((line) => (
            <Text key={line} style={[font.small, { color: colors.textMuted }]} numberOfLines={1}>
              {line}
            </Text>
          ))}
        </View>
        {right}
        {chevron && <Icon name="chevron-forward" size={16} color={colors.textMuted} />}
      </View>
      {!!badges?.length && <BadgeRow badges={badges} indent={!!icon} />}
      {!!note && (
        <View style={styles.rowFooter}>
          <Text style={[font.small, { flex: 1, color: colors.textMuted }]} numberOfLines={1}>
            {note.label} <Text style={{ fontFamily: fonts.semibold }}>{note.value}</Text>
          </Text>
        </View>
      )}
      {footer && <View style={styles.rowFooter}>{footer}</View>}
    </Pressable>
  );
}

/** Stack header title with a smaller line under it (e.g. the room of a piece of furniture). */
export function HeaderTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <View style={{ alignItems: 'center' }}>
      <Text style={styles.headerTitle} numberOfLines={1}>
        {title}
      </Text>
      <Text style={[font.small, { color: colors.textMuted, fontSize: 12 }]} numberOfLines={1}>
        {subtitle}
      </Text>
    </View>
  );
}

/** Dashed "+ label" cell closing a list, to add one more element. */
export function AddTile({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={withFeedback('tap', onPress)}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.addTile, pressed && { opacity: 0.6 }]}>
      <Icon name="add" size={20} color={colors.textMuted} />
      <Text style={[font.bodyStrong, { color: colors.textMuted, fontSize: 15 }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

function Badge({ label, tone = 'neutral' }: { label: string; tone?: Tone }) {
  return (
    <View style={[styles.badge, { backgroundColor: tones[tone].bg }]}>
      <Text style={[styles.badgeText, { color: tones[tone].fg }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

/**
 * Status badges of a row, on one line under it: the whole width of the card, past the
 * quantity on the right. `indent`: aligned with the title, after the icon tile.
 */
export function BadgeRow({ badges, indent }: { badges: BadgeSpec[]; indent?: boolean }) {
  return (
    <View style={[styles.badgeRow, indent && { marginLeft: ICON_TILE_SIZE + spacing.md }]}>
      {badges.map((b) => (
        <Badge key={b.label} label={b.label} tone={b.tone} />
      ))}
    </View>
  );
}

/**
 * Transparent by default: an opaque title would hide the thickness (shadow) of the
 * element above it. `sticky`: opaque, for sticky section list headers.
 */
export function SectionTitle({
  children,
  right,
  sticky,
  first,
}: {
  children: string;
  right?: ReactNode;
  sticky?: boolean;
  /** First thing on the page: the tall tab header already leaves room above */
  first?: boolean;
}) {
  return (
    <View
      style={[
        styles.sectionTitle,
        sticky && { backgroundColor: colors.background },
        first && { paddingTop: spacing.xs },
      ]}>
      <Text style={font.label}>{children}</Text>
      {right}
    </View>
  );
}

/** Space between list cards. */
export function Separator() {
  return <View style={{ height: spacing.sm }} />;
}

export function EmptyState({
  icon,
  title,
  text,
  children,
}: {
  icon: IconName;
  title: string;
  text?: string;
  children?: ReactNode;
}) {
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={styles.empty}>
      <View style={styles.emptyBubble}>
        <Icon name={icon} size={64} />
      </View>
      <Text style={[font.title, { textAlign: 'center' }]}>{title}</Text>
      {text && <Text style={[font.body, { color: colors.textMuted, textAlign: 'center' }]}>{text}</Text>}
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  /** Same as the Stack's headerTitleStyle (_layout.tsx) */
  headerTitle: { fontFamily: fonts.bold, fontSize: 20, color: colors.text },
  rowSelected: { backgroundColor: colors.selected, ...depth(3, colors.selectedEdge) },
  row: {
    ...card,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    minHeight: 64,
  },
  rowMain: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  rowFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm + 2,
    paddingTop: spacing.sm + 2,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  addTile: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.edge,
  },
  badgeRow: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.xs },
  // Badges stay on one line: a badge too long for the room left shrinks with an ellipsis
  badge: {
    flexShrink: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeText: { fontFamily: fonts.semibold, fontSize: 11, letterSpacing: 0.3 },
  sectionTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg + 4,
    paddingTop: spacing.xl,
    paddingBottom: spacing.sm,
  },
  empty: { alignItems: 'center', gap: spacing.md, padding: spacing.xl, paddingTop: 64 },
  emptyBubble: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
});
