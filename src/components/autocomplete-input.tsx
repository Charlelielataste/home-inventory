import { useState } from 'react';
import { View } from 'react-native';

import type { KnownProduct } from '@/db/queries';
import { categoryIcon, type Suggestion, suggest } from '@/lib/catalog';
import { getUnit } from '@/lib/units';
import { SuggestionDropdown, TextField } from '@/ui/components';
import { spacing } from '@/ui/theme';

type Props = {
  label?: string;
  value: string;
  onChangeText: (text: string) => void;
  onSelect: (s: Suggestion) => void;
  history: KnownProduct[];
  autoFocus?: boolean;
};

/**
 * Text field with 100% offline suggestions:
 * the user's history first, then the built-in dictionary.
 * The suggestion area keeps a fixed height while open
 * so the screen does not jump on every keystroke.
 */
export function AutocompleteInput({ label, value, onChangeText, onSelect, history, autoFocus }: Props) {
  const [open, setOpen] = useState(false);
  const suggestions = open ? suggest(value, history) : [];

  return (
    <View style={{ gap: spacing.xs }}>
      <TextField
        label={label}
        value={value}
        onChangeText={(text) => {
          onChangeText(text);
          setOpen(true);
        }}
        placeholder="Ex : Pâtes, Piles AA, Draps…"
        autoFocus={autoFocus}
        autoCapitalize="sentences"
        autoCorrect={false}
        onFocus={() => setOpen(true)}
        // Delayed close: blur fires before the tap on a suggestion
        // (web, some Android keyboards) and would hide it before the selection.
        onBlur={() => setTimeout(() => setOpen(false), 200)}
      />
      {open && (
        <SuggestionDropdown
          options={suggestions.map((s) => ({
            key: s.name,
            label: s.name,
            detail: [s.category, getUnit(s.unit).label].filter(Boolean).join(' · '),
            icon: categoryIcon(s.category, s.subcategory),
          }))}
          onSelect={(o) => {
            const picked = suggestions.find((s) => s.name === o.key);
            if (picked) onSelect(picked);
            setOpen(false);
          }}
          emptyText={value.trim() ? 'Aucune suggestion : le nom sera gardé tel quel' : 'Commence à taper pour voir des suggestions'}
        />
      )}
    </View>
  );
}
