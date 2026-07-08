import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { enableScreens } from 'react-native-screens';

import { AuthProvider } from './src/store/AuthContext';
import { NotificationProvider } from './src/store/NotificationContext';
import { CartProvider } from './src/store/CartContext';
import RootNavigator from './src/navigation/RootNavigator';
import { colors } from './src/theme';

enableScreens();

// Base on RN Navigation's DefaultTheme so `theme.fonts` (required by
// native-stack v7 headers) is present, then override just the colors.
const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.primary,
    background: colors.bg,
    card: colors.surface,
    text: colors.text,
    border: colors.border,
    notification: colors.blood,
  },
};

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <NotificationProvider>
          <CartProvider>
            <NavigationContainer theme={navTheme}>
              <RootNavigator />
            </NavigationContainer>
          </CartProvider>
        </NotificationProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
