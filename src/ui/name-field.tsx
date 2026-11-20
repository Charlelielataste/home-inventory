import { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, type TextInputProps, View } from 'react-native';

import { giveFeedback, withFeedback } from '@/lib/feedback';
import { filterByQuery } from '@/lib/text';

import { Button } from './buttons';
import { ModalFrame, modalCardStyle } from './dialogs';
import { Chip, FieldLabel, Hint, TextField } from './fields';
import { Icon, type IconName } from './icon';
import { ICON_CHOICES } from './icon-choices';
import { IconTile } from './lists';
import { colors, depth, font, fonts, radius, spacing } from './theme';

// ---------- Autocomplete dropdown ----------

type DropdownOption = { key: string; label: string; detail?: string; icon?: IconName };

const DROPDOWN_ROW_HEIGHT = 48;
const DROPDOWN_BORDER = 2;
/** Height of a dropdown showing `rows` rows (suggestion list, icon grid) */
const dropdownHeight = (rows: number) => rows * DROPDOWN_ROW_HEIGHT + DROPDOWN_BORDER * 2;

/**
 * List shown under a field while typing (rendered in the flow, not absolutely positioned).
 * FIXED height (`rows` rows) whatever the number of results, so the rest of the
 * screen does not jump on every keystroke.
 */
function SuggestionDropdown({
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
    <View style={[styles.dropdown, { height: dropdownHeight(rows) }]}>
      {visible.length === 0 && !!emptyText && (
        <View style={styles.dropdownRow}>
          <Hint>{emptyText}</Hint>
        </View>
      )}
      {visible.map((o, i) => (
        <Pressable
          key={o.key}
          onPress={withFeedback('tick', () => onSelect(o))}
          style={({ pressed }) => [
            styles.dropdownRow,
            i > 0 && styles.dropdownDivider,
            pressed && { backgroundColor: colors.background },
          ]}>
          {o.icon && <Icon name={o.icon} size={22} color={colors.textMuted} />}
          <Text style={[font.body, { flex: 1 }]} numberOfLines={1}>
            {o.label}
          </Text>
          {!!o.detail && <Hint>{o.detail}</Hint>}
        </Pressable>
      ))}
    </View>
  );
}

// ---------- Name + icon field (rooms, furniture, items) ----------

/**
 * Height of the panel opened under a NameField: suggestions and icon grid share it,
 * so switching from one to the other does not move the rest of the screen.
 */
const NAME_PANEL_ROWS = 4;

type NamePanel = 'suggest' | 'custom' | null;

type NameFieldProps = Omit<TextInputProps, 'value' | 'onChangeText' | 'style'> & {
  label?: string;
  value: string;
  onChangeText: (text: string) => void;
  /** Custom icon ("Personnalisé"), null = automatic */
  icon: IconName | null;
  onIconChange: (icon: IconName | null) => void;
  /** Automatic icon (from the typed name, the category…), shown when no custom icon is chosen */
  defaultIcon: IconName;
  /** Pastel of the preview tile: same key as in the lists (name for rooms / furniture, category for items) */
  tintKey?: string;
  /** Suggestions matching the typed text (computed by the caller) */
  options: DropdownOption[];
  /** A suggestion was picked: the caller fills the name (and the rest) and sets the icon */
  onSelectOption: (option: DropdownOption) => void;
  /** Height of the open panel, in suggestion rows (smaller in PromptModal, above the keyboard) */
  panelRows?: number;
};

/**
 * Name field with two optional helpers, always visible under it:
 * - « Une suggestion ? » opens the list of suggestions, filtered while typing;
 * - « Personnalisé » opens a grid of illustrations to choose the icon.
 * Neither is required: without them, the exact typed text and the automatic icon are kept.
 * Picking a suggestion then « Personnalisé » keeps the text and only changes the icon.
 * The tile left of the field previews the icon that will be saved.
 */
export function NameField({
  label,
  value,
  onChangeText,
  icon,
  onIconChange,
  defaultIcon,
  tintKey,
  options,
  onSelectOption,
  panelRows = NAME_PANEL_ROWS,
  ...inputProps
}: NameFieldProps) {
  const [panel, setPanel] = useState<NamePanel>(null);
  const toggle = (p: Exclude<NamePanel, null>) => setPanel((current) => (current === p ? null : p));
  const shown = icon ?? defaultIcon;

  return (
    // flexShrink: lets the panel shrink in a height-constrained parent (PromptModal above the keyboard)
    <View style={{ gap: spacing.sm, flexShrink: 1 }}>
      {label && <FieldLabel>{label}</FieldLabel>}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Pressable
          onPress={withFeedback('tick', () => toggle('custom'))}
          accessibilityRole="button"
          accessibilityLabel={icon ? 'Icône personnalisée, changer' : 'Icône automatique, personnaliser'}
          style={({ pressed }) => pressed && { opacity: 0.7 }}>
          <IconTile icon={shown} size={52} tintKey={tintKey} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <TextField
            autoCapitalize="sentences"
            autoCorrect={false}
            {...inputProps}
            value={value}
            onChangeText={onChangeText}
          />
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <Chip
          label="Une suggestion ?"
          icon="thinking-face"
          selected={panel === 'suggest'}
          onPress={() => toggle('suggest')}
          style={styles.nameFieldButton}
        />
        <Chip
          label="Personnalisé"
          icon="palette"
          selected={panel === 'custom'}
          onPress={() => toggle('custom')}
          style={styles.nameFieldButton}
        />
      </View>
      {panel === 'suggest' && (
        <SuggestionDropdown
          rows={panelRows}
          options={options}
          onSelect={(o) => {
            onSelectOption(o);
            setPanel(null);
          }}
          emptyText={
            value.trim()
              ? 'Aucune suggestion : le nom sera gardé tel quel'
              : 'Commence à taper pour voir des suggestions'
          }
        />
      )}
      {panel === 'custom' && (
        <IconGrid selected={icon} defaultIcon={defaultIcon} onSelect={onIconChange} rows={panelRows} />
      )}
    </View>
  );
}

const ICON_CELL_MIN = 52;

/**
 * Grid of illustrations, same height as the suggestion list (scrolls inside).
 * First cell = automatic icon (« Auto »); tapping the selected icon again also goes back to it.
 */
function IconGrid({
  selected,
  defaultIcon,
  onSelect,
  rows = NAME_PANEL_ROWS,
}: {
  selected: IconName | null;
  defaultIcon: IconName;
  onSelect: (icon: IconName | null) => void;
  /** Height, in suggestion rows (same as the suggestion list) */
  rows?: number;
}) {
  const [width, setWidth] = useState(0);
  const inner = width - spacing.sm * 2;
  const columns = Math.max(4, Math.floor((inner + spacing.xs) / (ICON_CELL_MIN + spacing.xs)));
  const cell = Math.floor((inner - spacing.xs * (columns - 1)) / columns);

  return (
    <View
      style={[styles.dropdown, { height: dropdownHeight(rows) }]}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width - DROPDOWN_BORDER * 2)}>
      {width > 0 && (
        <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" contentContainerStyle={styles.iconGrid}>
          <IconCell
            icon={defaultIcon}
            size={cell}
            selected={selected === null}
            caption="Auto"
            label="Icône automatique"
            onPress={() => onSelect(null)}
          />
          {ICON_CHOICES.map(([name, label]) => (
            <IconCell
              key={name}
              icon={name}
              size={cell}
              selected={selected === name}
              label={label}
              onPress={() => onSelect(selected === name ? null : name)}
            />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

function IconCell({
  icon,
  size,
  selected,
  caption,
  label,
  onPress,
}: {
  icon: IconName;
  size: number;
  selected: boolean;
  caption?: string;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={withFeedback('tick', onPress)}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        styles.iconCell,
        { width: size, height: size, borderRadius: size * 0.34 },
        selected && styles.iconCellSelected,
        pressed && { opacity: 0.6 },
      ]}>
      <Icon name={icon} size={Math.round(size * (caption ? 0.46 : 0.6))} />
      {caption && <Text style={styles.iconCellCaption}>{caption}</Text>}
    </Pressable>
  );
}

// ---------- Name input modal (room, furniture) ----------

type PromptModalProps = {
  visible: boolean;
  title: string;
  /** Smaller line under the title (e.g. the room of a new piece of furniture) */
  subtitle?: string;
  placeholder?: string;
  initialValue?: string;
  /** Custom icon when opening (editing), null = automatic */
  initialIcon?: IconName | null;
  /** Automatic icon of a name (also shown before each suggestion) */
  defaultIcon: (name: string) => IconName;
  /** Names suggested while typing */
  suggestions?: string[];
  submitLabel?: string;
  /** May be async: no second submit is taken until it has settled */
  onSubmit: (value: string, icon: IconName | null) => void | Promise<void>;
  onClose: () => void;
  /** iOS: called once the modal is fully closed (to open another one after it) */
  onDismiss?: () => void;
};

export function PromptModal({
  visible,
  title,
  subtitle,
  placeholder,
  initialValue = '',
  initialIcon = null,
  defaultIcon,
  suggestions = [],
  submitLabel = 'Valider',
  onSubmit,
  onClose,
  onDismiss,
}: PromptModalProps) {
  const [value, setValue] = useState(initialValue);
  const [icon, setIcon] = useState<IconName | null>(initialIcon);
  // Reset the input on every open (adjusted during render, no effect)
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) {
      setValue(initialValue);
      setIcon(initialIcon);
    }
  }
  // True while `onSubmit` runs: a double tap (button + keyboard "done") must not create twice
  const busy = useRef(false);

  const submit = async () => {
    const v = value.trim();
    if (!v || busy.current) return;
    busy.current = true;
    giveFeedback('success');
    try {
      await onSubmit(v, icon);
    } finally {
      busy.current = false;
    }
  };

  return (
    <ModalFrame visible={visible} onClose={withFeedback('close', onClose)} onDismiss={onDismiss} avoidKeyboard>
      {/* flexShrink: if the keyboard leaves too little room, the open panel shrinks instead of overflowing */}
      <View style={[modalCardStyle, { flexShrink: 1 }]} accessibilityViewIsModal>
        <View style={{ gap: 2 }}>
          <Text style={font.title}>{title}</Text>
          {!!subtitle && <Text style={[font.body, { color: colors.textMuted }]}>{subtitle}</Text>}
        </View>
        <NameField
          value={value}
          onChangeText={setValue}
          icon={icon}
          onIconChange={setIcon}
          defaultIcon={defaultIcon(value)}
          tintKey={value.trim() || undefined}
          options={filterByQuery(value, suggestions).map((name) => ({
            key: name,
            label: name,
            icon: defaultIcon(name),
          }))}
          onSelectOption={(o) => {
            setValue(o.label);
            // The suggestion brings its own icon (the one shown in the list)
            setIcon(null);
          }}
          placeholder={placeholder}
          panelRows={3}
          autoFocus
          returnKeyType="done"
          onSubmitEditing={submit}
        />
        <View style={{ flexDirection: 'row', gap: spacing.sm, justifyContent: 'flex-end' }}>
          <Button title="Annuler" variant="ghost" feedback="close" onPress={onClose} />
          <Button title={submitLabel} feedback={false} onPress={submit} disabled={!value.trim()} />
        </View>
      </View>
    </ModalFrame>
  );
}

const styles = StyleSheet.create({
  dropdown: {
    // Fixed height, but may shrink (down to one row) when space is lacking: PromptModal above the keyboard
    flexShrink: 1,
    minHeight: dropdownHeight(1),
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
  iconGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    padding: spacing.sm,
  },
  nameFieldButton: { flex: 1, justifyContent: 'center' },
  // Plain cream cells on the light panel: the illustrations' own colors stand out
  iconCell: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.edge,
    backgroundColor: colors.background,
  },
  // Selected: lagoon outline, light surface, a soft thin thickness
  iconCellSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.surface,
    ...depth(2, colors.selectedEdge),
  },
  iconCellCaption: {
    fontFamily: fonts.bold,
    fontSize: 10,
    lineHeight: 12,
    color: colors.text,
  },
});
