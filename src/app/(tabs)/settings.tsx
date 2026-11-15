import { Alert, ScrollView, Text, View } from 'react-native';

import { forgetKnownProducts, getStats, wipeAll } from '@/db/queries';
import { exportBackup, pickBackup, restoreBackup } from '@/lib/backup';
import { isoToFr } from '@/lib/dates';
import { useQuery } from '@/lib/use-query';
import { Button, confirm, Icon, type IconName, SectionTitle } from '@/ui/components';
import { card, colors, font, spacing } from '@/ui/theme';

export default function SettingsScreen() {
  const { data: stats, reload, db } = useQuery(getStats);

  const onExport = async () => {
    try {
      await exportBackup(db);
    } catch (e) {
      Alert.alert('Export impossible', e instanceof Error ? e.message : String(e));
    }
  };

  const onImport = async () => {
    try {
      const backup = await pickBackup();
      if (!backup) return;
      confirm(
        'Remplacer les données ?',
        `La sauvegarde du ${isoToFr(backup.exported_at.slice(0, 10))} contient ${backup.items.length} objets. Toutes les données actuelles seront remplacées.`,
        'Remplacer',
        async () => {
          const res = await restoreBackup(db, backup);
          reload();
          Alert.alert('Import terminé', `${res.rooms} pièces, ${res.furniture} rangements, ${res.items} objets.`);
        },
      );
    } catch (e) {
      Alert.alert('Import impossible', e instanceof Error ? e.message : String(e));
    }
  };

  const onWipe = () =>
    confirm('Tout effacer ?', 'Pièces, rangements et objets seront supprimés définitivement.', 'Continuer', () =>
      confirm('Vraiment ?', 'Pense à exporter une sauvegarde avant. Cette action est irréversible.', 'Tout effacer', async () => {
        await wipeAll(db);
        reload();
      }),
    );

  const onForget = () =>
    confirm(
      "Vider l'historique de saisie ?",
      "Les suggestions basées sur tes saisies précédentes et les codes-barres mémorisés seront oubliés. L'inventaire n'est pas touché.",
      'Vider',
      async () => {
        await forgetKnownProducts(db);
        reload();
      },
    );

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: spacing.xl * 2 }}>
      <SectionTitle>Inventaire</SectionTitle>
      <View style={{ flexDirection: 'row', paddingHorizontal: spacing.lg, gap: spacing.sm }}>
        <Stat icon="home" value={stats?.rooms} label="pièces" />
        <Stat icon="file-box" value={stats?.furniture} label="rangements" />
        <Stat icon="box" value={stats?.items} label="objets" />
      </View>

      <SectionTitle>Sauvegarde</SectionTitle>
      <View style={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}>
        <Text style={[font.small, { color: colors.textMuted }]}>
          Tes données sont enregistrées uniquement sur ce téléphone. Exporte régulièrement une sauvegarde (Drive, mail…)
          pour ne rien perdre en cas de changement d’appareil.
        </Text>
        <Button title="Exporter une sauvegarde" icon="download" onPress={onExport} />
        <Button title="Importer une sauvegarde" icon="upload" variant="secondary" onPress={onImport} />
      </View>

      <SectionTitle>Données</SectionTitle>
      <View style={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}>
        <Button
          title={`Vider l'historique de saisie (${stats?.known ?? 0})`}
          icon="eraser"
          variant="secondary"
          onPress={onForget}
        />
        <Button title="Tout effacer" icon="trash" variant="secondary" onPress={onWipe} />
      </View>
    </ScrollView>
  );
}

function Stat({ icon, value, label }: { icon: IconName; value?: number; label: string }) {
  return (
    <View style={{ ...card, flex: 1, padding: spacing.md, alignItems: 'center', gap: 2 }}>
      <Icon name={icon} size={30} />
      <Text style={font.title}>{value ?? '–'}</Text>
      <Text style={[font.small, { color: colors.textMuted }]}>{label}</Text>
    </View>
  );
}
