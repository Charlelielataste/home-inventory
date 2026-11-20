import { router, useFocusEffect } from 'expo-router';
import type { PermissionResponse } from 'expo-notifications';
import { useCallback, useState } from 'react';
import { Linking, ScrollView, Switch, Text, View } from 'react-native';

import { forgetKnownProducts, getStats, wipeAll } from '@/db/queries';
import { exportBackup, pickBackup, restoreBackup } from '@/lib/backup';
import { useAlerts } from '@/lib/alerts';
import { isoToFr, REMINDER_HOUR } from '@/lib/dates';
import { type FeedbackPrefs, giveFeedback, setFeedbackPref, useFeedbackPrefs } from '@/lib/feedback';
import { describeExpiryDelay, useReminderPrefs } from '@/lib/reminder-prefs';
import { getReminderPermission, requestReminderPermission } from '@/lib/reminders';
import { plural } from '@/lib/text';
import { useQuery } from '@/lib/use-query';
import {
  Button,
  confirm,
  Hint,
  Icon,
  type IconName,
  SectionTitle,
  showDialog,
  showError,
  showMessage,
} from '@/ui/components';
import { card, colors, font, spacing } from '@/ui/theme';

/** Demo data: development builds only, left out of the release bundle (`__DEV__` is folded by Metro). */
const seedDemoData: typeof import('@/db/seed').seedDemoData | undefined = __DEV__
  ? // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('@/db/seed').seedDemoData
  : undefined;

const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));

export default function SettingsScreen() {
  const { data: stats, reload, db } = useQuery(getStats);
  const { refresh: refreshAlerts } = useAlerts();
  const feedbackPrefs = useFeedbackPrefs();
  const reminderPrefs = useReminderPrefs();

  const toggleFeedback = (key: keyof FeedbackPrefs, value: boolean) => {
    setFeedbackPref(key, value);
    // Preview of what was just switched on
    if (value) giveFeedback('tick');
  };

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
      showError('Export impossible', errorText(e));
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
          // Run from the dialog: not covered by the try / catch around it
          try {
            const res = await restoreBackup(db, backup);
            reload();
            // DELETE without WHERE does not trigger the SQLite change listener
            refreshAlerts();
            giveFeedback('success');
            showMessage('Import terminé', `${res.rooms} pièces, ${res.furniture} rangements, ${res.items} objets.`);
          } catch (e) {
            // In a transaction: nothing was changed
            showError('Import impossible', errorText(e));
          }
        },
      );
    } catch (e) {
      showError('Import impossible', errorText(e));
    }
  };

  const onWipe = () =>
    showDialog({
      title: 'Tout effacer ?',
      message: 'Pièces, rangements et objets seront supprimés définitivement.',
      buttons: [
        // Not destructive (silent): it only opens the real confirmation
        {
          text: 'Continuer',
          style: 'primary',
          onPress: () =>
            confirm(
              'Vraiment ?',
              'Pense à exporter une sauvegarde avant. Cette action est irréversible.',
              'Tout effacer',
              async () => {
                try {
                  await wipeAll(db);
                  giveFeedback('delete');
                  reload();
                  // DELETE without WHERE does not trigger the SQLite change listener
                  refreshAlerts();
                } catch (e) {
                  showError('Effacement impossible', errorText(e));
                }
              },
            ),
        },
        { text: 'Annuler', style: 'cancel' },
      ],
    });

  /** Development builds only: demo items for the Péremption and Courses tabs. */
  const onSeed = async () => {
    if (!seedDemoData) return;
    try {
      await seedDemoData(db);
      giveFeedback('success');
      reload();
      refreshAlerts();
    } catch (e) {
      showError('Données de démo impossibles', errorText(e));
    }
  };

  const onForget = () =>
    confirm(
      "Vider l'historique de saisie ?",
      "Les suggestions basées sur tes saisies précédentes et les codes-barres mémorisés seront oubliés. L'inventaire n'est pas touché.",
      'Vider',
      async () => {
        try {
          await forgetKnownProducts(db);
          giveFeedback('delete');
          reload();
        } catch (e) {
          showError('Historique non vidé', errorText(e));
        }
      },
    );

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: spacing.xl * 2 }}>
      <SectionTitle first>Inventaire</SectionTitle>
      <View style={{ flexDirection: 'row', paddingHorizontal: spacing.lg, gap: spacing.sm }}>
        <Stat icon="home" value={stats?.rooms} label="pièces" />
        <Stat icon="file-box" value={stats?.furniture} label="rangements" />
        <Stat icon="box" value={stats?.items} label="objets" />
      </View>

      <SectionTitle>Sons et vibrations</SectionTitle>
      <View style={{ ...card, marginHorizontal: spacing.lg, paddingHorizontal: spacing.md }}>
        <SwitchRow
          label="Sons"
          detail="Coupés quand le téléphone est en silencieux"
          value={feedbackPrefs.sounds}
          onChange={(v) => toggleFeedback('sounds', v)}
        />
        <View style={{ height: 1, backgroundColor: colors.line }} />
        <SwitchRow
          label="Vibrations"
          detail="Petit retour au toucher des boutons"
          value={feedbackPrefs.haptics}
          onChange={(v) => toggleFeedback('haptics', v)}
        />
      </View>

      <SectionTitle>Rappels</SectionTitle>
      <View style={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}>
        <Hint>
          {`Une notification à ${REMINDER_HOUR} h ${describeExpiryDelay(reminderPrefs.expiryDays)} de chaque date de péremption, et quand un produit est au congélateur depuis ${reminderPrefs.freezerMonths} mois (délais réglables dans l’onglet Péremption).`}
          {permission?.granted ? ' Activés sur ce téléphone.' : ''}
        </Hint>
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
        <Hint>
          Tes données sont enregistrées uniquement sur ce téléphone. Exporte régulièrement une sauvegarde (Drive, mail…)
          pour ne rien perdre en cas de changement d’appareil.
        </Hint>
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
        {__DEV__ && (
          <Button title="Ajouter des données de démo (dev)" variant="secondary" feedback={false} onPress={onSeed} />
        )}
      </View>

      <SectionTitle>À propos</SectionTitle>
      <View style={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}>
        <Button title="Confidentialité" icon="shield" variant="secondary" onPress={() => router.push('/privacy')} />
      </View>
    </ScrollView>
  );
}

function Stat({ icon, value, label }: { icon: IconName; value?: number; label: string }) {
  return (
    <View style={{ ...card, flex: 1, padding: spacing.md, alignItems: 'center', gap: 2 }}>
      <Icon name={icon} size={30} />
      <Text style={font.title}>{value ?? '–'}</Text>
      <Hint>{label}</Hint>
    </View>
  );
}

function SwitchRow({
  label,
  detail,
  value,
  onChange,
}: {
  label: string;
  detail: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md }}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={font.bodyStrong}>{label}</Text>
        <Hint>{detail}</Hint>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        accessibilityLabel={label}
        trackColor={{ false: colors.edge, true: colors.primary }}
        thumbColor={colors.surface}
        ios_backgroundColor={colors.edge}
      />
    </View>
  );
}
