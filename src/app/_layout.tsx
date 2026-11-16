import {
  Fredoka_400Regular,
  Fredoka_500Medium,
  Fredoka_600SemiBold,
  Fredoka_700Bold,
  useFonts,
} from '@expo-google-fonts/fredoka';
import { DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { migrate } from '@/db/schema';
import { AlertsProvider } from '@/lib/alerts';
import { DialogHost } from '@/ui/components';
import { colors, fonts } from '@/ui/theme';

SplashScreen.preventAutoHideAsync();

const theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.primary,
    background: colors.background,
    card: colors.background,
    text: colors.text,
    border: colors.line,
  },
};

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Fredoka_400Regular,
    Fredoka_500Medium,
    Fredoka_600SemiBold,
    Fredoka_700Bold,
  });
  const ready = fontsLoaded || !!fontError;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return (
    <SQLiteProvider databaseName="inventaire.db" onInit={migrate} options={{ enableChangeListener: true }}>
      <AlertsProvider>
        <ThemeProvider value={theme}>
          <StatusBar style="dark" />
          <Stack
            screenOptions={{
              headerTintColor: colors.text,
              headerTitleStyle: { fontFamily: fonts.bold, fontSize: 20 },
              headerShadowVisible: false,
              // Opaque header everywhere (iOS 26 makes it transparent + blurred by default)
              headerTransparent: false,
              headerStyle: { backgroundColor: colors.background },
              headerBackButtonDisplayMode: 'minimal',
              contentStyle: { backgroundColor: colors.background },
            }}>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="room/[id]" options={{ title: '' }} />
            <Stack.Screen name="furniture/[id]" options={{ title: '' }} />
            <Stack.Screen name="item/[id]" options={{ presentation: 'modal', title: '' }} />
            <Stack.Screen name="privacy" options={{ title: 'Confidentialité' }} />
          </Stack>
          <DialogHost />
        </ThemeProvider>
      </AlertsProvider>
    </SQLiteProvider>
  );
}
