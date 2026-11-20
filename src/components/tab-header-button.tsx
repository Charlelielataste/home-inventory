import type { ComponentProps } from 'react';
import { View } from 'react-native';

import { IconButton } from '@/ui/components';
import { spacing } from '@/ui/theme';

/** Round key on the right of a tab header (Courses: +, Péremption: settings). */
export function TabHeaderButton(props: Omit<ComponentProps<typeof IconButton>, 'boxSize'>) {
  return (
    <View style={{ marginRight: spacing.sm }}>
      <IconButton boxSize={40} {...props} />
    </View>
  );
}
