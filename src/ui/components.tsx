import { type ReactNode, useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { filterByQuery } from '@/lib/text';

import { Icon, type IconName } from './icon';
import { card, colors, depth, font, fonts, radius, spacing, sunk, tintFor, type Tone, tones } from './theme';

export { Icon, type IconName };

// ---------- Buttons ----------

type ButtonProps = {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  icon?: IconName;
  disabled?: boolean;
  style?: ViewStyle;
};

export function Button({ title, onPress, variant = 'primary', icon, disabled, style }: ButtonProps) {
  const primary = variant === 'primary';
  const danger = variant === 'danger';
  const fg = primary || danger ? colors.onPrimary : colors.text;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        primary && styles.buttonPrimary,
        danger && styles.buttonDanger,
        variant === 'secondary' && styles.buttonSecondary,
        pressed &&
          variant !== 'ghost' &&
          sunk(4, primary ? colors.primaryDark : danger ? colors.dangerDark : colors.edge),
        pressed && variant === 'ghost' && { opacity: 0.6 },
        disabled && { opacity: 0.45 },
        style,
      ]}>
      {icon && (
        <Icon
          name={icon}
          size={20}
          color={fg}
          duo={primary ? colors.primaryDark : danger ? colors.dangerDark : colors.duo}
        />
      )}
      <Text style={[styles.buttonText, { color: fg }]}>{title}</Text>
    </Pressable>
  );
}

export function IconButton({
  icon,
  onPress,
  size = 22,
  label,
  variant = 'plain',
  color,
}: {
  icon: IconName;
  onPress: () => void;
  size?: number;
  label: string;
  /** Glyph color (defaults to the variant's) */
  color?: string;
  /** plain: no background · soft: small cream key · filled: lagoon key */
  variant?: 'plain' | 'soft' | 'filled';
}) {
  const filled = variant === 'filled';
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={label}
      hitSlop={8}
      style={({ pressed }) => [
        styles.iconButton,
        variant === 'soft' && styles.iconButtonSoft,
        filled && styles.iconButtonFilled,
        pressed &&
          (variant === 'plain' ? { opacity: 0.5 } : filled ? sunk(4, colors.primaryDark) : sunk(3, colors.edge)),
      ]}>
      <Icon name={icon} size={size} color={color ?? (filled ? colors.onPrimary : colors.text)} />
    </Pressable>
  );
}

/** Floating "+" button, bottom right. */
export function Fab({ onPress, label, inTabs }: { onPress: () => void; label: string; inTabs?: boolean }) {
  const insets = useSafeAreaInsets();
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.fab,
        { bottom: (inTabs ? 0 : insets.bottom) + spacing.lg },
        pressed && sunk(5, colors.primaryDark),
      ]}>
      <Icon name="add" size={28} color={colors.onPrimary} />
    </Pressable>
  );
}

// ---------- Fields ----------

export function TextField({ label, style, ...props }: TextInputProps & { label?: string }) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: spacing.xs }}>
      {label && <Text style={font.label}>{label}</Text>}
      <TextInput
        placeholderTextColor={colors.textMuted}
        cursorColor={colors.primary}
        selectionColor={colors.duo}
        {...props}
        onFocus={(e) => {
          setFocused(true);
          props.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          props.onBlur?.(e);
        }}
        style={[styles.input, focused && { borderColor: colors.primary }, style]}
      />
    </View>
  );
}

export function Chip({
  label,
  icon,
  selected,
  onPress,
}: {
  label: string;
  icon?: IconName;
  selected?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.chip, selected && styles.chipSelected, pressed && { opacity: 0.7 }]}>
      {icon && <Icon name={icon} size={18} />}
      <Text style={[styles.chipText, selected && { color: colors.onPrimary }]}>{label}</Text>
    </Pressable>
  );
}

export function Checkbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <Pressable
      onPress={() => onChange(!checked)}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      hitSlop={8}
      style={({ pressed }) => [
        { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
        pressed && { opacity: 0.6 },
      ]}>
      <CheckMark checked={checked} />
      <Text style={font.body}>{label}</Text>
    </Pressable>
  );
}

/** The checkbox square alone (e.g. selection mode of a list). */
export function CheckMark({ checked }: { checked: boolean }) {
  return (
    <View style={[styles.checkbox, checked && styles.checkboxOn]}>
      {checked && <Icon name="check" size={16} color={colors.onPrimary} />}
    </View>
  );
}

export function ChipRow({ children }: { children: ReactNode }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ gap: spacing.sm, paddingVertical: 2 }}>
      {children}
    </ScrollView>
  );
}

// ---------- Lists ----------

export type BadgeSpec = { label: string; tone: Tone };

/** Illustration on a pastel square (color derived from `tintKey`). */
export function IconTile({ icon, size = 44, tintKey }: { icon: IconName; size?: number; tintKey?: string }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.34,
        backgroundColor: tintFor(tintKey ?? icon),
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <Icon name={icon} size={Math.round(size * 0.62)} />
    </View>
  );
}

type ListRowProps = {
  title: string;
  subtitle?: string;
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
};

export function ListRow({
  title,
  subtitle,
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
}: ListRowProps) {
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={!onPress && !onLongPress}
      accessibilityState={selected === undefined ? undefined : { selected }}
      style={({ pressed }) => [
        styles.row,
        inset && { marginHorizontal: spacing.lg },
        selected && styles.rowSelected,
        pressed && sunk(3, selected ? colors.selectedEdge : colors.edge),
      ]}>
      <View style={styles.rowMain}>
        {icon && <IconTile icon={icon} tintKey={tintKey} />}
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={font.bodyStrong} numberOfLines={1}>
            {title}
          </Text>
          {!!subtitle && (
            <Text style={[font.small, { color: colors.textMuted }]} numberOfLines={1}>
              {subtitle}
            </Text>
          )}
          {!!badges?.length && (
            <View style={{ flexDirection: 'row', gap: spacing.xs, marginTop: 2, flexWrap: 'wrap' }}>
              {badges.map((b) => (
                <Badge key={b.label} label={b.label} tone={b.tone} />
              ))}
            </View>
          )}
        </View>
        {right}
        {chevron && <Icon name="chevron-forward" size={16} color={colors.textMuted} />}
      </View>
      {footer && <View style={styles.rowFooter}>{footer}</View>}
    </Pressable>
  );
}

/** Big square card (2-column grids). */
export function Tile({
  title,
  subtitle,
  icon,
  onPress,
  onLongPress,
}: {
  title: string;
  subtitle?: string;
  icon: IconName;
  onPress?: () => void;
  onLongPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => [styles.tile, pressed && sunk(3, colors.edge)]}>
      <IconTile icon={icon} size={56} tintKey={title} />
      <View style={{ gap: 2 }}>
        <Text style={[font.heading, { fontSize: 17 }]} numberOfLines={1}>
          {title}
        </Text>
        {!!subtitle && (
          <Text style={[font.small, { color: colors.textMuted, fontSize: 12 }]} numberOfLines={2}>
            {subtitle}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

export function Badge({ label, tone = 'neutral' }: { label: string; tone?: Tone }) {
  return (
    <View style={[styles.badge, { backgroundColor: tones[tone].bg }]}>
      <Text style={[styles.badgeText, { color: tones[tone].fg }]}>{label}</Text>
    </View>
  );
}

/**
 * Transparent by default: an opaque title would hide the thickness (shadow) of the
 * element above it. `sticky`: opaque, for sticky section list headers.
 */
export function SectionTitle({ children, right, sticky }: { children: string; right?: ReactNode; sticky?: boolean }) {
  return (
    <View style={[styles.sectionTitle, sticky && { backgroundColor: colors.background }]}>
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

// ---------- Autocomplete dropdown ----------

export type DropdownOption = { key: string; label: string; detail?: string; icon?: IconName };

const DROPDOWN_ROW_HEIGHT = 48;
const DROPDOWN_BORDER = 2;

/**
 * List shown under a field while typing (rendered in the flow, not absolutely positioned).
 * FIXED height (`rows` rows) whatever the number of results, so the rest of the
 * screen does not jump on every keystroke.
 */
export function SuggestionDropdown({
  options,
  onSelect,
  rows = 4,
  emptyText,
}: {
  options: DropdownOption[];
  onSelect: (option: DropdownOption) => void;
  rows?: number;
  /** Text shown when there is no suggestion */
  emptyText?: string;
}) {
  const visible = options.slice(0, rows);
  return (
    <View style={[styles.dropdown, { height: rows * DROPDOWN_ROW_HEIGHT + DROPDOWN_BORDER * 2 }]}>
      {visible.length === 0 && !!emptyText && (
        <View style={styles.dropdownRow}>
          <Text style={[font.small, { color: colors.textMuted }]}>{emptyText}</Text>
        </View>
      )}
      {visible.map((o, i) => (
        <Pressable
          key={o.key}
          onPress={() => onSelect(o)}
          style={({ pressed }) => [
            styles.dropdownRow,
            i > 0 && styles.dropdownDivider,
            pressed && { backgroundColor: colors.background },
          ]}>
          {o.icon && <Icon name={o.icon} size={22} color={colors.textMuted} />}
          <Text style={[font.body, { flex: 1 }]} numberOfLines={1}>
            {o.label}
          </Text>
          {!!o.detail && <Text style={[font.small, { color: colors.textMuted }]}>{o.detail}</Text>}
        </Pressable>
      ))}
    </View>
  );
}

// ---------- Name input modal (room, furniture) ----------

type PromptModalProps = {
  visible: boolean;
  title: string;
  placeholder?: string;
  initialValue?: string;
  /** Names suggested while typing */
  suggestions?: string[];
  /** Icon shown before each suggestion */
  suggestionIcon?: (name: string) => IconName;
  submitLabel?: string;
  onSubmit: (value: string) => void;
  onClose: () => void;
};

export function PromptModal({
  visible,
  title,
  placeholder,
  initialValue = '',
  suggestions = [],
  suggestionIcon,
  submitLabel = 'Valider',
  onSubmit,
  onClose,
}: PromptModalProps) {
  const [value, setValue] = useState(initialValue);
  // Reset the input on every open (adjusted during render, no effect)
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) setValue(initialValue);
  }

  const submit = () => {
    const v = value.trim();
    if (!v) return;
    onSubmit(v);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView behavior="padding" style={styles.modalBackdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.modalCard}>
          <Text style={font.title}>{title}</Text>
          <TextField
            value={value}
            onChangeText={setValue}
            placeholder={placeholder}
            autoFocus
            autoCapitalize="sentences"
            autoCorrect={false}
            returnKeyType="done"
            onSubmitEditing={submit}
          />
          {suggestions.length > 0 && (
            <SuggestionDropdown
              options={filterByQuery(value, suggestions).map((name) => ({
                key: name,
                label: name,
                icon: suggestionIcon?.(name),
              }))}
              onSelect={(o) => setValue(o.label)}
              emptyText={value.trim() ? 'Aucune suggestion' : 'Commence à taper pour voir des suggestions'}
            />
          )}
          <View style={{ flexDirection: 'row', gap: spacing.sm, justifyContent: 'flex-end' }}>
            <Button title="Annuler" variant="ghost" onPress={onClose} />
            <Button title={submitLabel} onPress={submit} disabled={!value.trim()} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ---------- Dialogs ----------
// Themed replacement for the native Alert.alert (never use it in the app):
// showDialog() from anywhere, rendered by the single <DialogHost /> of the root layout.

export type DialogButton = {
  text: string;
  /** cancel: ghost, at the bottom, also used by the back button / backdrop · destructive: red · primary: lagoon · default: cream */
  style?: 'default' | 'primary' | 'cancel' | 'destructive';
  onPress?: () => void;
};
export type DialogSpec = { title: string; message?: string; buttons?: DialogButton[] };

/** Mounted hosts, the last one shows the dialogs (see DialogHost). */
const dialogHosts: ((spec: DialogSpec) => void)[] = [];

export function showDialog(spec: DialogSpec) {
  const host = dialogHosts[dialogHosts.length - 1];
  if (!host) console.warn('[dialog] <DialogHost /> is not mounted');
  host?.(spec);
}

/** Information message with a single "OK". */
export function showMessage(title: string, message?: string) {
  showDialog({ title, message });
}

export function confirm(title: string, message: string, confirmLabel: string, onConfirm: () => void) {
  showDialog({
    title,
    message,
    buttons: [
      { text: confirmLabel, style: 'destructive', onPress: onConfirm },
      { text: 'Annuler', style: 'cancel' },
    ],
  });
}

/** "Rename / Delete" menu. */
export function showRenameDeleteMenu(name: string, onRename: () => void, onDelete: () => void) {
  showDialog({
    title: name,
    buttons: [
      { text: 'Renommer', onPress: onRename },
      { text: 'Supprimer', style: 'destructive', onPress: onDelete },
      { text: 'Annuler', style: 'cancel' },
    ],
  });
}

const DIALOG_VARIANTS = { default: 'secondary', primary: 'primary', destructive: 'danger', cancel: 'ghost' } as const;

/**
 * Renders the dialogs. One in the root layout; screens presented as a native modal
 * (item form) mount their own, because on iOS a root <Modal> cannot appear above them.
 */
export function DialogHost() {
  const [dialog, setDialog] = useState<DialogSpec | null>(null);
  // iOS cannot present a modal while another one is closing: run the action once closed
  const pending = useRef<(() => void) | null>(null);
  // False once a button was pressed: a fast double tap must not run the action twice
  const open = useRef(false);
  useEffect(() => {
    const show = (spec: DialogSpec) => {
      open.current = true;
      setDialog(spec);
    };
    dialogHosts.push(show);
    return () => {
      dialogHosts.splice(dialogHosts.lastIndexOf(show), 1);
    };
  }, []);

  const buttons: DialogButton[] = dialog?.buttons?.length ? dialog.buttons : [{ text: 'OK', style: 'primary' }];
  // Cancel last, whatever the order given
  const sorted = [...buttons.filter((b) => b.style !== 'cancel'), ...buttons.filter((b) => b.style === 'cancel')];
  const press = (button?: DialogButton) => {
    if (!open.current) return;
    open.current = false;
    // Close first: the action may open another dialog or modal
    setDialog(null);
    if (!button?.onPress) return;
    if (Platform.OS === 'ios') pending.current = button.onPress;
    else button.onPress();
  };
  const onDismiss = () => {
    const action = pending.current;
    pending.current = null;
    action?.();
  };
  const dismiss = () => press(buttons.find((b) => b.style === 'cancel'));

  return (
    <Modal
      visible={!!dialog}
      transparent
      animationType="fade"
      onRequestClose={dismiss}
      onDismiss={onDismiss}
      statusBarTranslucent>
      <View style={styles.modalBackdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={dismiss} accessibilityLabel="Fermer" />
        {dialog && (
          <View style={styles.modalCard} accessibilityViewIsModal>
            <Text style={font.title}>{dialog.title}</Text>
            {!!dialog.message && <Text style={[font.body, { color: colors.textMuted }]}>{dialog.message}</Text>}
            <View style={{ gap: spacing.sm, marginTop: spacing.xs }}>
              {sorted.map((b) => (
                <Button
                  key={b.text}
                  title={b.text}
                  variant={DIALOG_VARIANTS[b.style ?? 'default']}
                  onPress={() => press(b)}
                />
              ))}
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}

// ---------- Styles ----------

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    minHeight: 50,
  },
  buttonPrimary: { backgroundColor: colors.primary, ...depth(4, colors.primaryDark) },
  buttonSecondary: { backgroundColor: colors.surface, ...depth(4, colors.edge) },
  buttonDanger: { backgroundColor: colors.danger, ...depth(4, colors.dangerDark) },
  buttonText: { fontFamily: fonts.semibold, fontSize: 16 },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: radius.sm + 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonSoft: {
    width: 34,
    height: 34,
    borderRadius: radius.sm + 2,
    backgroundColor: colors.background,
    ...depth(3, colors.edge),
  },
  iconButtonFilled: {
    width: 48,
    height: 48,
    backgroundColor: colors.primary,
    ...depth(4, colors.primaryDark),
  },
  fab: {
    position: 'absolute',
    right: spacing.lg,
    width: 62,
    height: 62,
    borderRadius: 22,
    backgroundColor: colors.primary,
    ...depth(5, colors.primaryDark),
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    borderWidth: 2,
    borderColor: colors.edge,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontFamily: fonts.regular,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: colors.edge,
    backgroundColor: colors.surface,
  },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontFamily: fonts.medium, fontSize: 14, color: colors.text },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: colors.edge,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
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
  tile: {
    ...card,
    flex: 1,
    padding: spacing.md,
    gap: spacing.sm,
  },
  badge: {
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
  dropdown: {
    borderWidth: DROPDOWN_BORDER,
    borderColor: colors.edge,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  dropdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    height: DROPDOWN_ROW_HEIGHT,
  },
  dropdownDivider: { borderTopWidth: 1, borderTopColor: colors.line },
  modalBackdrop: {
    flex: 1,
    backgroundColor: colors.backdrop,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalCard: {
    backgroundColor: colors.background,
    borderRadius: radius.lg + 4,
    padding: spacing.lg + 4,
    gap: spacing.md,
  },
});
