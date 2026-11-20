import { type ReactNode, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  type TextStyle,
  View,
  type ViewStyle,
} from 'react-native';

import { withFeedback } from '@/lib/feedback';

import { Icon, type IconName } from './icon';
import { colors, font, fonts, radius, spacing } from './theme';

/** Uppercase muted label above a field or a group of chips. */
export function FieldLabel({ children }: { children: ReactNode }) {
  return <Text style={font.label}>{children}</Text>;
}

/** Small muted explanation (under a field, a list, a section title…). */
export function Hint({ children, style }: { children: ReactNode; style?: TextStyle }) {
  return <Text style={[font.small, { color: colors.textMuted }, style]}>{children}</Text>;
}

export function TextField({ label, style, ...props }: TextInputProps & { label?: string }) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: spacing.xs }}>
      {label && <FieldLabel>{label}</FieldLabel>}
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
  style,
}: {
  label: string;
  icon?: IconName;
  selected?: boolean;
  /** Omitted: read-only chip (e.g. category of an item card) */
  onPress?: () => void;
  style?: ViewStyle;
}) {
  if (!onPress) {
    return (
      <View style={[styles.chip, selected && styles.chipSelected, style]}>
        {icon && <Icon name={icon} size={18} />}
        <Text style={[styles.chipText, selected && { color: colors.onPrimary }]}>{label}</Text>
      </View>
    );
  }
  return (
    <Pressable
      onPress={withFeedback('tick', onPress)}
      accessibilityRole="button"
      accessibilityState={selected === undefined ? undefined : { selected }}
      style={({ pressed }) => [styles.chip, selected && styles.chipSelected, pressed && { opacity: 0.7 }, style]}>
      {icon && <Icon name={icon} size={18} />}
      <Text style={[styles.chipText, selected && { color: colors.onPrimary }]}>{label}</Text>
    </Pressable>
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
      onPress={withFeedback('tick', () => onChange(!checked))}
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

/**
 * Right side of an item in selection mode: the checkbox above a short text (its stock).
 * `muted`: text in the muted color.
 */
export function SelectionMark({ checked, text, muted }: { checked: boolean; text: string; muted?: boolean }) {
  return (
    <View style={styles.selectionMark}>
      <CheckMark checked={checked} />
      <Text style={[styles.selectionText, muted && { color: colors.textMuted }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
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
  selectionMark: { alignItems: 'center', gap: 6, minWidth: 74 },
  selectionText: { fontFamily: fonts.bold, fontSize: 14, color: colors.text, textAlign: 'right' },
});
