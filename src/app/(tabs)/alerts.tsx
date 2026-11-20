import { Tabs } from 'expo-router/js-tabs';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { SectionList, View } from 'react-native';

import { ItemRow } from '@/components/item-row';
import { ReminderSettingsModal } from '@/components/reminder-settings';
import { DeleteSelectedButton, SelectionBar, useSelection } from '@/components/selection';
import { TabHeaderButton } from '@/components/tab-header-button';
import { itemBatches, type ItemWithLocation, snoozeFrozen } from '@/db/queries';
import { useAlerts } from '@/lib/alerts';
import { describeExpiry, describeExpiryWindow, isoToFr, monthsSince } from '@/lib/dates';
import { giveFeedback } from '@/lib/feedback';
import { useReminderPrefs } from '@/lib/reminder-prefs';
import { Button, EmptyState, Hint, SectionTitle, Separator } from '@/ui/components';
import { spacing } from '@/ui/theme';

/** Expired / expiring soon / frozen for a long time (low stock lives in the Shopping tab). */
export default function AlertsScreen() {
  const { expiryDays, freezerMonths } = useReminderPrefs();
  const [settingsOpen, setSettingsOpen] = useState(false);
  // Already loaded by AlertsProvider (tab badge), recomputed on every database change and
  // when a delay changes; `reload` right after a write so the list does not wait for it
  const db = useSQLiteContext();
  const { alerts: data, refresh: reload } = useAlerts();
  const { expired = [], expiringSoon = [], frozenLong = [] } = data ?? {};
  const all = [...expired, ...expiringSoon, ...frozenLong];
  const { selected, chosen, done, headerOptions, rowProps } = useSelection(all, reload);
  const chosenFrozen = chosen.filter((i) => frozenLong.includes(i));

  // Rendered in every branch: the header must leave selection mode even if the list empties
  const screen = (
    <>
      <Tabs.Screen
        options={
          headerOptions ?? {
            title: 'Péremption',
            headerLeft: undefined,
            headerRight: () => (
              <TabHeaderButton
                icon="settings"
                size={24}
                // Light key: the header is already cream
                variant="light"
                label="Réglages de l’onglet et des rappels"
                onPress={() => setSettingsOpen(true)}
              />
            ),
          }
        }
      />
      <ReminderSettingsModal visible={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  );
  if (!data) return screen;

  const sections = [
    { key: 'expired', title: `Périmés (${expired.length})`, data: expired },
    {
      key: 'soon',
      title: `Périment ${describeExpiryWindow(expiryDays)} (${expiringSoon.length})`,
      data: expiringSoon,
    },
    {
      key: 'frozen',
      title: `Congelés depuis plus de ${freezerMonths} mois (${frozenLong.length})`,
      data: frozenLong,
    },
  ].filter((s) => s.data.length > 0);

  if (sections.length === 0) {
    return (
      <>
        {screen}
        <EmptyState
          icon="check-mark"
          title="Rien à signaler"
          text={`Les produits périmés, qui périment ${describeExpiryWindow(expiryDays)} ou congelés depuis plus de ${freezerMonths} mois apparaîtront ici.`}
        />
      </>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {screen}
      <SectionList
        sections={sections}
        extraData={selected}
        keyExtractor={(i) => String(i.id)}
        ItemSeparatorComponent={Separator}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={{ paddingBottom: selected ? 100 : spacing.xl }}
        renderSectionHeader={({ section }) => (
          <View>
            <SectionTitle first={section === sections[0]}>{section.title}</SectionTitle>
            {section.key === 'frozen' && (
              <Hint style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.sm }}>
                {`Toujours bon ? « Ignorer » le masque pendant ${freezerMonths} mois.`}
              </Hint>
            )}
          </View>
        )}
        renderItem={({ item, section }) =>
          section.key === 'frozen' ? (
            <ItemRow
              item={item}
              subtitle={`Congelé le ${isoToFr(item.frozen_at)} (${item.frozen_at ? monthsSince(item.frozen_at) : 0} mois)`}
              showLocation
              action={{
                label: 'Ignorer',
                variant: 'warn',
                onPress: async () => {
                  await snoozeFrozen(db, [item.id]);
                  giveFeedback('success');
                  reload();
                },
              }}
              {...rowProps(item.id)}
            />
          ) : (
            <ItemRow item={item} subtitle={expirySubtitle(item)} showLocation {...rowProps(item.id)} />
          )
        }
      />
      {selected && (
        <SelectionBar inTabs>
          {chosenFrozen.length > 0 && (
            <Button
              title={`Ignorer (${chosenFrozen.length})`}
              variant="secondary"
              feedback={false}
              onPress={async () => {
                await snoozeFrozen(
                  db,
                  chosenFrozen.map((i) => i.id),
                );
                giveFeedback('success');
                done();
              }}
              style={{ flex: 1 }}
            />
          )}
          <DeleteSelectedButton items={chosen} onDone={done} noIcon={chosenFrozen.length > 0} />
        </SelectionBar>
      )}
    </View>
  );
}

/**
 * "Périme demain", and how many when only part of the stock is concerned (bought at
 * different times): "Périmé depuis 2 jours : 1 sur 3".
 */
function expirySubtitle(item: ItemWithLocation) {
  if (!item.expires_at) return undefined;
  const first = itemBatches(item)[0];
  const when = describeExpiry(item.expires_at);
  return first && first.quantity < item.quantity ? `${when} : ${first.quantity} sur ${item.quantity}` : when;
}
