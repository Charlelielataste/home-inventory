import { View } from 'react-native';

import { CATEGORIES, categoryIcon, SUBCATEGORIES } from '@/lib/catalog';
import { Chip, FieldLabel } from '@/ui/components';
import { spacing } from '@/ui/theme';

/**
 * Category (required) then, when it has some, its optional subcategory.
 * Siblings (fragment): the form's gap applies between them.
 */
export function CategoryPicker({
  category,
  subcategory,
  onChange,
}: {
  category: string;
  subcategory: string | null;
  onChange: (category: string, subcategory: string | null) => void;
}) {
  const subcategories = SUBCATEGORIES[category] ?? [];
  return (
    <>
      <View style={{ gap: spacing.sm }}>
        <FieldLabel>Catégorie</FieldLabel>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {CATEGORIES.map((c) => (
            <Chip
              key={c}
              label={c}
              icon={categoryIcon(c, null)}
              selected={category === c}
              // Required: tapping the selected one keeps it; another one resets the subcategory
              onPress={() => category !== c && onChange(c, null)}
            />
          ))}
        </View>
      </View>

      {subcategories.length > 0 && (
        <View style={{ gap: spacing.sm }}>
          <FieldLabel>Sous-catégorie (optionnel)</FieldLabel>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {subcategories.map((sc) => (
              <Chip
                key={sc}
                label={sc}
                icon={categoryIcon(category, sc)}
                selected={subcategory === sc}
                onPress={() => onChange(category, subcategory === sc ? null : sc)}
              />
            ))}
          </View>
        </View>
      )}
    </>
  );
}
