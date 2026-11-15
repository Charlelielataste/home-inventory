import { Tabs } from 'expo-router/js-tabs';
import { SectionList, Text, View } from 'react-native';

import { ItemRow } from '@/components/item-row';
import { confirmDeleteItems, SelectionBar, useSelection } from '@/components/selection';
import { getAlerts, type ItemWithLocation, snoozeFrozen } from '@/db/queries';
import { describeExpiry, EXPIRY_WARNING_DAYS, FREEZER_WARNING_MONTHS, isoToFr, monthsSince } from '@/lib/dates';
import { formatLocation } from '@/lib/text';
import { useQuery } from '@/lib/use-query';
import { Button, EmptyState, SectionTitle, Separator } from '@/ui/components';
import { colors, font, spacing } from '@/ui/theme';

/** Expired / expiring soon / frozen for a long time (low stock lives in the Shopping tab). */
export default function AlertsScreen() {
  const { data, reload, db } = useQuery(getAlerts);
  const { expired = [], expiringSoon = [], frozenLong = [] } = data ?? {};
  const all = [...expired, ...expiringSoon, ...frozenLong];
  const { selected, clear, headerOptions, rowProps } = useSelection(all.map((i) => i.id));
  const chosen = selected ? all.filter((i) => selected.has(i.id)) : [];
  const chosenFrozen = chosen.filter((i) => frozenLong.includes(i));

  const done = () => {
    clear();
    reload();
  };

  // Rendered in every branch: the header must leave selection mode even if the list empties
  const screen = (
    <Tabs.Screen
      options={
        headerOptions ?? {
          title: 'Péremption',
          headerLeft: undefined,
          headerRight: undefined,
        }
      }
    />
  );
  if (!data) return screen;

  const sections = [
    { key: 'expired', title: `Périmés (${expired.length})`, data: expired },
    {
      key: 'soon',
      title: `Périment sous ${EXPIRY_WARNING_DAYS} jours (${expiringSoon.length})`,
      data: expiringSoon,
    },
    {
      key: 'frozen',
      title: `Congelés depuis plus de ${FREEZER_WARNING_MONTHS} mois (${frozenLong.length})`,
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
          text={`Les produits périmés, qui périment sous ${EXPIRY_WARNING_DAYS} jours ou congelés depuis plus de ${FREEZER_WARNING_MONTHS} mois apparaîtront ici.`}
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
            <SectionTitle>{section.title}</SectionTitle>
            {section.key === 'frozen' && (
              <Text
                style={[
                  font.small,
                  {
                    color: colors.textMuted,
                    paddingHorizontal: spacing.lg,
                    paddingBottom: spacing.sm,
                  },
                ]}>
                {`Toujours bon ? « Ignorer » le masque pendant ${FREEZER_WARNING_MONTHS} mois.`}
              </Text>
            )}
          </View>
        )}
        renderItem={({ item, section }) =>
          section.key === 'frozen' ? (
            <ItemRow
              item={item}
              subtitle={`Congelé le ${isoToFr(item.frozen_at)} (${item.frozen_at ? monthsSince(item.frozen_at) : 0} mois) · ${formatLocation(item)}`}
              action={{
                label: 'Ignorer',
                onPress: async () => {
                  await snoozeFrozen(db, [item.id]);
                  reload();
                },
              }}
              {...rowProps(item.id)}
            />
          ) : (
            <ItemRow item={item} subtitle={subtitleFor(item)} {...rowProps(item.id)} />
          )
        }
      />
      {selected && (
        <SelectionBar inTabs>
          {chosenFrozen.length > 0 && (
            <Button
              title={`Ignorer (${chosenFrozen.length})`}
              variant="secondary"
              onPress={async () => {
                await snoozeFrozen(
                  db,
                  chosenFrozen.map((i) => i.id),
                );
                done();
              }}
              style={{ flex: 1 }}
            />
          )}
          <Button
            title={`Supprimer (${chosen.length})`}
            icon={chosenFrozen.length ? undefined : 'trash'}
            variant="danger"
            onPress={() => confirmDeleteItems(db, chosen, done)}
            style={{ flex: 1 }}
          />
        </SelectionBar>
      )}
    </View>
  );
}

function subtitleFor(item: ItemWithLocation) {
  const where = formatLocation(item);
  return item.expires_at ? `${describeExpiry(item.expires_at)} · ${where}` : where;
}
