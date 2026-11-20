import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import { useEffect } from 'react';
import { Platform, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { alertCounts, useAlerts } from '@/lib/alerts';
import { REMINDER_ROUTE } from '@/lib/reminders';
import { Icon, type IconName } from '@/ui/icon';
import { colors, fonts } from '@/ui/theme';

/** Last reminder tap handled (the hook returns the same response again on remount). */
let handledResponseId: string | null = null;

/** Tapping a reminder notification opens the Péremption tab. */
function useNativeReminderTaps() {
  const response = Notifications.useLastNotificationResponse();
  useEffect(() => {
    if (!response || response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
    const id = response.notification.request.identifier;
    if (id === handledResponseId) return;
    handledResponseId = id;
    if (response.notification.request.content.data?.url === REMINDER_ROUTE) router.navigate(REMINDER_ROUTE);
  }, [response]);
}

/** No notification responses on web (browser tests only): the hook would throw. */
const useReminderTaps = Platform.OS === 'web' ? () => {} : useNativeReminderTaps;

/** Colored illustration, dimmed when inactive, on a soft pill when active. */
function TabIcon({ name, focused }: { name: IconName; focused: boolean }) {
  return (
    <View
      style={{
        width: 52,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: focused ? colors.tabActive : 'transparent',
      }}>
      <Icon name={name} size={24} opacity={focused ? 1 : 0.5} />
    </View>
  );
}

const tab = (title: string, icon: IconName, badge = 0) => ({
  title,
  // Explicit: a screen may change its header title (selection mode), not the tab label
  tabBarLabel: title,
  tabBarBadge: badge > 0 ? (badge > 99 ? '99+' : badge) : undefined,
  tabBarIcon: ({ focused }: { focused: boolean }) => <TabIcon name={icon} focused={focused} />,
});

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const counts = alertCounts(useAlerts().alerts);
  useReminderTaps();
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { fontFamily: fonts.semibold, fontSize: 11 },
        tabBarStyle: {
          backgroundColor: colors.surface,
          // Clear edge: otherwise it blends with the light cards scrolling under it
          borderTopWidth: 2,
          borderTopColor: colors.edge,
          elevation: 0,
          // Explicit height: room for the icon pill + label, above the home indicator
          height: 64 + insets.bottom,
          paddingTop: 8,
          paddingBottom: insets.bottom + 6,
        },
        tabBarItemStyle: { gap: 2 },
        tabBarBadgeStyle: {
          backgroundColor: colors.badge,
          color: colors.onBadge,
          fontFamily: fonts.semibold,
          fontSize: 11,
        },
        // Taller than the default (44 iOS / 56 Android): room around the big title
        headerStyle: { backgroundColor: colors.background, height: insets.top + 72 },
        headerTitleStyle: { fontFamily: fonts.bold, fontSize: 26, color: colors.text },
        headerShadowVisible: false,
        sceneStyle: { backgroundColor: colors.background },
      }}>
      <Tabs.Screen name="index" options={tab('Chez moi', 'home')} />
      <Tabs.Screen name="search" options={tab('Rechercher', 'search')} />
      <Tabs.Screen name="shopping" options={tab('Courses', 'cart', counts.toBuy)} />
      <Tabs.Screen name="alerts" options={tab('Péremption', 'hourglass', counts.expiry)} />
      <Tabs.Screen name="settings" options={tab('Réglages', 'settings')} />
    </Tabs>
  );
}
