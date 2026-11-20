import type { KnownProduct } from '@/db/queries';
import { categoryIcon, type Suggestion, suggest } from '@/lib/catalog';
import { formatSize } from '@/lib/units';
import { type IconName, NameField } from '@/ui/components';

type Props = {
  label?: string;
  value: string;
  onChangeText: (text: string) => void;
  /** Custom icon (null = from the category) */
  icon: IconName | null;
  onIconChange: (icon: IconName | null) => void;
  /** Automatic icon, from the current category */
  defaultIcon: IconName;
  tintKey?: string;
  onSelect: (s: Suggestion) => void;
  history: KnownProduct[];
  autoFocus?: boolean;
};

/**
 * Item name: NameField with 100% offline suggestions (the user's history first,
 * then the built-in dictionary), shown only on « Une suggestion ? ».
 */
export function AutocompleteInput({ history, onSelect, ...props }: Props) {
  const suggestions = suggest(props.value, history);
  return (
    <NameField
      {...props}
      placeholder="Ex : Pâtes, Piles AA, Draps…"
      options={suggestions.map((s) => ({
        key: s.name,
        label: s.name,
        detail: [s.category, formatSize(s)].filter(Boolean).join(' · '),
        icon: s.icon ?? categoryIcon(s.category, s.subcategory),
      }))}
      onSelectOption={(o) => {
        const picked = suggestions.find((s) => s.name === o.key);
        if (picked) onSelect(picked);
      }}
    />
  );
}
