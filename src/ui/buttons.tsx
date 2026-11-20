import { type ReactNode, useEffect, useRef } from 'react';
import { type AccessibilityState, Pressable, StyleSheet, Text, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { type Feedback, giveFeedback, withFeedback } from '@/lib/feedback';

import { Icon, type IconName } from './icon';
import { colors, depth, fonts, radius, spacing, sunk } from './theme';

type ButtonProps = {
  title: string;
  /** Required unless `readOnly` */
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'warn';
  icon?: IconName;
  disabled?: boolean;
  /** Same look, but only shows a value: not pressable, not dimmed (e.g. a saved barcode) */
  readOnly?: boolean;
  style?: ViewStyle;
  /** Sound / vibration on press; false when the action plays its own (e.g. save → success) */
  feedback?: Feedback | false;
};

export function Button({
  title,
  onPress,
  variant = 'primary',
  icon,
  disabled,
  readOnly,
  style,
  feedback = 'tap',
}: ButtonProps) {
  const primary = variant === 'primary';
  const danger = variant === 'danger';
  const warn = variant === 'warn';
  const fg = primary || danger || warn ? colors.onPrimary : colors.text;
  const dark = primary ? colors.primaryDark : danger ? colors.dangerDark : warn ? colors.warnDark : null;
  return (
    <Pressable
      onPress={onPress && withFeedback(feedback, onPress)}
      disabled={disabled || readOnly || !onPress}
      accessibilityRole={readOnly ? 'text' : 'button'}
      style={({ pressed }) => [
        styles.button,
        primary && styles.buttonPrimary,
        danger && styles.buttonDanger,
        warn && styles.buttonWarn,
        variant === 'secondary' && styles.buttonSecondary,
        pressed && variant !== 'ghost' && sunk(4, dark ?? colors.edge),
        pressed && variant === 'ghost' && { opacity: 0.6 },
        disabled && { opacity: 0.45 },
        style,
      ]}>
      {icon && <Icon name={icon} size={20} color={fg} duo={dark ?? colors.duo} />}
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
  accessibilityState,
  children,
  feedback = 'tap',
  repeat,
  boxSize,
}: {
  icon: IconName;
  /** Side of the key, to resize a soft / light / filled one (e.g. header buttons) */
  boxSize?: number;
  onPress: () => void;
  /** Held down: repeats `onPress`, faster and faster (− / + of a quantity) */
  repeat?: boolean;
  /** Sound / vibration on press; false when the action plays its own */
  feedback?: Feedback | false;
  accessibilityState?: AccessibilityState;
  /** Custom glyph drawn in place of the icon (e.g. wrapped in an animated view) */
  children?: ReactNode;
  size?: number;
  label: string;
  /** Glyph color (defaults to the variant's) */
  color?: string;
  /** plain: no background · soft: small cream key (on cards) · light: small light key (on tinted backgrounds) · filled: lagoon key */
  variant?: 'plain' | 'soft' | 'light' | 'filled';
}) {
  const filled = variant === 'filled';
  const holdRepeat = useHoldRepeat(onPress, feedback);
  return (
    <Pressable
      onPress={withFeedback(feedback, onPress)}
      {...(repeat && holdRepeat)}
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={accessibilityState}
      hitSlop={8}
      style={({ pressed }) => [
        styles.iconButton,
        (variant === 'soft' || variant === 'light') && styles.iconButtonSoft,
        variant === 'light' && styles.iconButtonLight,
        filled && styles.iconButtonFilled,
        !!boxSize && { width: boxSize, height: boxSize },
        pressed &&
          (variant === 'plain' ? { opacity: 0.5 } : filled ? sunk(4, colors.primaryDark) : sunk(3, colors.edge)),
      ]}>
      {children ?? <Icon name={icon} size={size} color={color ?? (filled ? colors.onPrimary : colors.text)} />}
    </Pressable>
  );
}

/** First repeat delay, then each one is shorter, down to the fastest pace. */
const REPEAT_START_MS = 220;
const REPEAT_MIN_MS = 60;
const REPEAT_ACCELERATION = 0.85;
/** No more than one sound / vibration per this delay, even at full speed */
const REPEAT_FEEDBACK_MS = 90;

/**
 * Press-and-hold repeat: after the long press delay, calls `action` again and again,
 * faster and faster, until the finger is lifted. The latest `action` is always used
 * (it may read state updated by the previous call).
 */
function useHoldRepeat(action: () => void, feedback: Feedback | false) {
  const actionRef = useRef(action);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Time since the last sound / vibration, added up from the delays (no clock needed) */
  const sinceFeedback = useRef(0);
  useEffect(() => {
    actionRef.current = action;
  });
  const stop = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  useEffect(() => stop, []);

  /** `waited`: time since the previous call (Infinity on the first one) */
  const tick = (delay: number, waited: number) => {
    sinceFeedback.current += waited;
    if (feedback && sinceFeedback.current >= REPEAT_FEEDBACK_MS) {
      sinceFeedback.current = 0;
      giveFeedback(feedback);
    }
    actionRef.current();
    timer.current = setTimeout(() => tick(Math.max(REPEAT_MIN_MS, delay * REPEAT_ACCELERATION), delay), delay);
  };

  return { delayLongPress: 350, onLongPress: () => tick(REPEAT_START_MS, Infinity), onPressOut: stop };
}

/** Side of the floating buttons (main one and `secondary`). */
const FAB_SIZE = 62;

/**
 * Floating button, bottom right. `secondary` = cream button placed just left of the main
 * one (quick scan next to +).
 */
export function Fab({
  onPress,
  label,
  inTabs,
  icon,
  secondary,
}: {
  onPress: () => void;
  label: string;
  inTabs?: boolean;
  icon?: IconName;
  secondary?: boolean;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Pressable
      onPress={withFeedback('tap', onPress)}
      accessibilityLabel={label}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.fab,
        secondary && styles.fabSecondary,
        { bottom: (inTabs ? 0 : insets.bottom) + spacing.lg },
        pressed && (secondary ? sunk(5, colors.edge) : sunk(5, colors.primaryDark)),
      ]}>
      {secondary ? (
        <Icon name={icon ?? 'add'} size={30} />
      ) : (
        <Icon name={icon ?? 'add'} size={28} color={colors.onPrimary} />
      )}
    </Pressable>
  );
}

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
  buttonWarn: { backgroundColor: colors.warn, ...depth(4, colors.warnDark) },
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
  iconButtonLight: { backgroundColor: colors.surface },
  iconButtonFilled: {
    width: 48,
    height: 48,
    backgroundColor: colors.primary,
    ...depth(4, colors.primaryDark),
  },
  fab: {
    position: 'absolute',
    right: spacing.lg,
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: 22,
    backgroundColor: colors.primary,
    ...depth(5, colors.primaryDark),
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabSecondary: {
    right: spacing.lg + FAB_SIZE + spacing.md,
    backgroundColor: colors.surface,
    ...depth(5, colors.edge),
  },
});
