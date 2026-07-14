import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { enableScreens } from 'react-native-screens';

import { AuthProvider } from './src/store/AuthContext';
import { NotificationProvider } from './src/store/NotificationContext';
import { CartProvider } from './src/store/CartContext';
import { DeliveryProvider } from './src/store/DeliveryContext';
import RootNavigator from './src/navigation/RootNavigator';
import { navigationRef, flushPendingNavigation } from './src/navigation/navigationRef';
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
            {/* Inside AuthProvider: the delivery address list is per-user. */}
            <DeliveryProvider>
              {/* ref + onReady let NotificationProvider — which sits above this
                  container and so has no useNavigation() — open the screen a
                  tapped push points at, including one that cold-started the app
                  before this mounted. */}
              <NavigationContainer
                ref={navigationRef}
                theme={navTheme}
                onReady={flushPendingNavigation}
              >
                <RootNavigator />
              </NavigationContainer>
            </DeliveryProvider>
          </CartProvider>
        </NotificationProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
