import React from 'react';
import { View, Text, Pressable, StyleSheet, Platform, UIManager, LayoutAnimation } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from './Icon';
import { colors, spacing, font, radius, shadow } from '../theme';

// Enable smooth layout animation on Android (used only for the tab pill).
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const CONFIG = {
  Home: { icon: 'home', label: 'Home' },
  Orders: { icon: 'orders', label: 'Orders' },
  Alerts: { icon: 'bell', label: 'Alerts' },
  Profile: { icon: 'profile', label: 'Profile' },
  DriverHome: { icon: 'dashboard', label: 'Home' },
  DriverTrips: { icon: 'trips', label: 'Trips' },
};

export default function AnimatedTabBar({ state, navigation, activeColor = colors.primary }) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 10) }]} pointerEvents="box-none">
      <View style={[styles.bar, shadow.card]}>
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const cfg = CONFIG[route.name] || { icon: 'home', label: route.name };

          const onPress = () => {
            // The ONLY animation in the app: the active tab pill expanding with its label.
            LayoutAnimation.configureNext(
              LayoutAnimation.create(230, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity)
            );
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
          };

          return (
            <Pressable key={route.key} onPress={onPress}
              style={[styles.item, focused && { backgroundColor: activeColor }]}>
              <Icon name={cfg.icon} size={22} color={focused ? colors.white : colors.textMuted} />
              {focused ? <Text style={styles.label}>{cfg.label}</Text> : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: spacing.xl, alignItems: 'center' },
  bar: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface,
    borderRadius: radius.pill, paddingVertical: 8, paddingHorizontal: 10, gap: 4,
  },
  item: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 12, paddingHorizontal: 16, borderRadius: radius.pill,
  },
  label: { color: colors.white, fontWeight: font.bold, fontSize: font.small, marginLeft: 8 },
});
