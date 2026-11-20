import type { ReactNode } from 'react';
import { Text, type TextInputProps, View, type ViewStyle } from 'react-native';

import { IconButton } from './buttons';
import { FieldLabel, Hint, TextField } from './fields';
import { colors, font, spacing } from './theme';

type StepperProps = {
  /** Value shown between − and +, already formatted ("2 pcs", "800 g", "La veille") */
  value: string;
  /** − (−1) or + (+1). Use the functional form of setState: a held key calls it many times in a row */
  onStep: (direction: -1 | 1) => void;
  /** Screen reader labels of the keys ("Retirer 1 Riz" / "Ajouter 1 Riz") */
  decreaseLabel: string;
  increaseLabel: string;
  /** Screen reader label of the value, when the shown text is too terse */
  valueLabel?: string;
  /** sm: small cream keys (cards, rows, settings) · lg: lagoon keys, big value taking the width (modals) */
  size?: 'sm' | 'lg';
  /** sm: minimum width of the value, so the keys do not move when it changes */
  valueWidth?: number;
  /** Value in the muted color (e.g. nothing left) */
  muted?: boolean;
  /** At a bound: the key plays `error` and does nothing (no repeat then) */
  atMin?: boolean;
  atMax?: boolean;
  /** Held down: repeats the step, faster and faster (default true) */
  repeat?: boolean;
  /** Extra style of the row (e.g. a wider gap) */
  style?: ViewStyle;
};

/**
 * − value + : steps a number by one (quantities, delays). Keys play `tick`; held down,
 * they repeat. The caller formats the value and keeps it within its bounds.
 */
export function Stepper({
  value,
  onStep,
  decreaseLabel,
  increaseLabel,
  valueLabel,
  size = 'sm',
  valueWidth = 72,
  muted,
  atMin,
  atMax,
  repeat = true,
  style,
}: StepperProps) {
  const large = size === 'lg';
  const key = (direction: -1 | 1, label: string, blocked: boolean | undefined) => (
    <IconButton
      icon={direction < 0 ? 'remove' : 'add'}
      size={large ? undefined : 16}
      variant={large ? 'filled' : 'soft'}
      label={label}
      feedback={blocked ? 'error' : 'tick'}
      accessibilityState={atMin !== undefined || atMax !== undefined ? { disabled: !!blocked } : undefined}
      repeat={repeat && !blocked}
      onPress={() => !blocked && onStep(direction)}
    />
  );
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', gap: large ? spacing.sm : spacing.xs }, style]}>
      {key(-1, decreaseLabel, atMin)}
      <Text
        accessibilityLabel={valueLabel}
        style={[
          large ? font.numberLarge : font.number,
          large ? { flex: 1 } : { minWidth: valueWidth },
          { textAlign: 'center' },
          muted && { color: colors.textMuted },
        ]}>
        {value}
      </Text>
      {key(1, increaseLabel, atMax)}
    </View>
  );
}

type StepperFieldProps = Omit<TextInputProps, 'value' | 'onChangeText' | 'style'> & {
  /** Label above (uppercase, muted) */
  label?: string;
  value: string;
  onChangeText: (text: string) => void;
  /** − (−1) or + (+1). Use the functional form of setState: a held key calls it many times in a row */
  onStep: (direction: -1 | 1) => void;
  /** Screen reader label of the field; the keys default to "<label> : moins / plus" */
  accessibilityLabel: string;
  decreaseLabel?: string;
  increaseLabel?: string;
  /** Muted explanation under the field */
  hint?: ReactNode;
  /** Extra content between the field and the hint (e.g. unit chips) */
  children?: ReactNode;
};

/**
 * Like Stepper (lg), with an editable number in the middle (item form): − field +.
 * The text is the caller's (it parses it); − / + call `onStep`. Selects all on focus.
 */
export function StepperField({
  label,
  value,
  onChangeText,
  onStep,
  accessibilityLabel,
  decreaseLabel = `${accessibilityLabel} : moins`,
  increaseLabel = `${accessibilityLabel} : plus`,
  hint,
  children,
  ...inputProps
}: StepperFieldProps) {
  return (
    <View style={{ gap: spacing.sm }}>
      {!!label && <FieldLabel>{label}</FieldLabel>}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <IconButton
          icon="remove"
          label={decreaseLabel}
          variant="filled"
          feedback="tick"
          repeat
          onPress={() => onStep(-1)}
        />
        <View style={{ flex: 1 }}>
          <TextField
            selectTextOnFocus
            {...inputProps}
            value={value}
            onChangeText={onChangeText}
            accessibilityLabel={accessibilityLabel}
            style={[font.numberLarge, { textAlign: 'center' }]}
          />
        </View>
        <IconButton
          icon="add"
          label={increaseLabel}
          variant="filled"
          feedback="tick"
          repeat
          onPress={() => onStep(1)}
        />
      </View>
      {children}
      {!!hint && <Hint>{hint}</Hint>}
    </View>
  );
}
