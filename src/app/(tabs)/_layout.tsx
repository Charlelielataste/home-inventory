import { Tabs } from 'expo-router/js-tabs';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@/ui/icon';
import { colors, fonts } from '@/ui/theme';

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

const tab = (title: string, icon: IconName) => ({
  title,
  tabBarIcon: ({ focused }: { focused: boolean }) => <TabIcon name={icon} focused={focused} />,
});

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { fontFamily: fonts.semibold, fontSize: 11 },
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopWidth: 0,
          elevation: 0,
          // Explicit height: room for the icon pill + label, above the home indicator
          height: 64 + insets.bottom,
          paddingTop: 8,
          paddingBottom: insets.bottom + 6,
        },
        tabBarItemStyle: { gap: 2 },
        headerStyle: { backgroundColor: colors.background },
        headerTitleStyle: { fontFamily: fonts.bold, fontSize: 26, color: colors.text },
        headerShadowVisible: false,
        sceneStyle: { backgroundColor: colors.background },
      }}>
      <Tabs.Screen name="index" options={tab('Chez moi', 'home')} />
      <Tabs.Screen name="search" options={tab('Rechercher', 'search')} />
      <Tabs.Screen name="shopping" options={tab('Courses', 'cart')} />
      <Tabs.Screen name="alerts" options={tab('Péremption', 'hourglass')} />
      <Tabs.Screen name="settings" options={tab('Réglages', 'settings')} />
    </Tabs>
  );
}
