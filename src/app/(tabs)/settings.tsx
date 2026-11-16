import { router, useFocusEffect } from 'expo-router';
import type { PermissionResponse } from 'expo-notifications';
import { useCallback, useState } from 'react';
import { Linking, ScrollView, Text, View } from 'react-native';

import { forgetKnownProducts, getStats, wipeAll } from '@/db/queries';
import { exportBackup, pickBackup, restoreBackup } from '@/lib/backup';
import { useAlerts } from '@/lib/alerts';
import { FREEZER_WARNING_MONTHS, isoToFr, REMINDER_HOUR } from '@/lib/dates';
import { getReminderPermission, requestReminderPermission } from '@/lib/reminders';
import { plural } from '@/lib/text';
import { useQuery } from '@/lib/use-query';
import { Button, confirm, Icon, type IconName, SectionTitle, showMessage } from '@/ui/components';
import { card, colors, font, spacing } from '@/ui/theme';

export default function SettingsScreen() {
  const { data: stats, reload, db } = useQuery(getStats);
  const { refresh: refreshAlerts } = useAlerts();

  // Notification permission, re-read on focus (it can be changed in the system settings)
  const [permission, setPermission] = useState<PermissionResponse>();
  useFocusEffect(
    useCallback(() => {
      getReminderPermission().then(setPermission, () => {});
    }, []),
  );

  const onEnableReminders = async () => {
    const res = await requestReminderPermission();
    setPermission(res);
    if (res.granted) refreshAlerts();
  };

  const onExport = async () => {
    try {
      await exportBackup(db);
    } catch (e) {
      showMessage('Export impossible', e instanceof Error ? e.message : String(e));
    }
  };

  const onImport = async () => {
    try {
      const backup = await pickBackup();
      if (!backup) return;
      confirm(
        'Remplacer les données ?',
        `La sauvegarde du ${isoToFr(backup.exported_at.slice(0, 10))} contient ${plural(backup.items.length, 'objet')}. Toutes les données actuelles seront remplacées.`,
        'Remplacer',
        async () => {
          const res = await restoreBackup(db, backup);
          reload();
          refreshAlerts();
          showMessage('Import terminé', `${res.rooms} pièces, ${res.furniture} rangements, ${res.items} objets.`);
        },
      );
    } catch (e) {
      showMessage('Import impossible', e instanceof Error ? e.message : String(e));
    }
  };

  const onWipe = () =>
    confirm('Tout effacer ?', 'Pièces, rangements et objets seront supprimés définitivement.', 'Continuer', () =>
      confirm('Vraiment ?', 'Pense à exporter une sauvegarde avant. Cette action est irréversible.', 'Tout effacer', async () => {
        await wipeAll(db);
        reload();
        refreshAlerts();
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

      <SectionTitle>Rappels</SectionTitle>
      <View style={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}>
        <Text style={[font.small, { color: colors.textMuted }]}>
          {`Une notification à ${REMINDER_HOUR} h la veille de chaque date de péremption, et quand un produit est au congélateur depuis ${FREEZER_WARNING_MONTHS} mois.`}
          {permission?.granted ? ' Activés sur ce téléphone.' : ''}
        </Text>
        {permission && !permission.granted && permission.canAskAgain && (
          <Button title="Activer les rappels" icon="bell" onPress={onEnableReminders} />
        )}
        {permission && (permission.granted || !permission.canAskAgain) && (
          <Button
            title={permission.granted ? 'Gérer les notifications' : 'Autoriser dans les réglages'}
            icon="bell"
            variant="secondary"
            onPress={() => Linking.openSettings()}
          />
        )}
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

      <SectionTitle>À propos</SectionTitle>
      <View style={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}>
        <Button
          title="Confidentialité"
          icon="shield"
          variant="secondary"
          onPress={() => router.push('/privacy')}
        />
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
