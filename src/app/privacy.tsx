import { Linking, ScrollView, Text, View } from 'react-native';

import { PRIVACY_INTRO, PRIVACY_SECTIONS, PRIVACY_UPDATED, PRIVACY_URL } from '@/lib/privacy';
import { Button } from '@/ui/components';
import { card, colors, font, spacing } from '@/ui/theme';

/** Privacy policy (same text as the public page linked from Google Play). */
export default function PrivacyScreen() {
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xl * 2 }}>
      <Text style={[font.small, { color: colors.textMuted }]}>{`Mise à jour le ${PRIVACY_UPDATED}`}</Text>
      <Text style={font.body}>{PRIVACY_INTRO}</Text>
      {PRIVACY_SECTIONS.map((s) => (
        <View key={s.title} style={{ ...card, padding: spacing.md, gap: spacing.sm }}>
          <Text style={font.heading}>{s.title}</Text>
          {s.body.map((p) => (
            <Text key={p} style={font.body}>
              {p}
            </Text>
          ))}
        </View>
      ))}
      <Button title="Voir la version en ligne" variant="ghost" onPress={() => Linking.openURL(PRIVACY_URL)} />
    </ScrollView>
  );
}
