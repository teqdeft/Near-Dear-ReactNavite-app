import React, { useEffect, useRef } from 'react';
import {
  Animated, Text, StyleSheet, TouchableOpacity, View, PanResponder, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from './Icon';
import { colors, spacing, font, radius } from '../theme';

/**
 * The heads-up alert shown when a push arrives while the app is OPEN.
 *
 * Android deliberately draws no tray notification in the foreground — it assumes
 * the user is already looking at whatever the app has to say. That assumption is
 * wrong here: a driver browsing their past trips, or a donor editing their profile,
 * would otherwise learn about an ambulance dispatch only from a small number
 * changing on a tab badge. In an emergency app the alert has to interrupt.
 *
 * It auto-dismisses (this must not block the screen underneath), can be swiped up
 * to dismiss early, and tapping it opens the same screen the tray notification
 * would have — see notificationTarget.
 */

const VISIBLE_MS = 5000;
// Far enough up to clear the status bar and the banner's own height.
const HIDDEN_Y = -200;

// The left rail's colour and glyph, keyed by notification type — the same mapping
// the Alerts list uses, so an ambulance alert looks like an ambulance alert
// wherever the user meets it.
const TYPE_STYLE = {
  blood: { icon: 'blood', color: colors.blood },
  blood_accepted: { icon: 'blood', color: colors.blood },
  medicine_order: { icon: 'pharmacy', color: colors.pharmacy },
  ambulance: { icon: 'ambulance', color: colors.ambulance },
  admin: { icon: 'bell', color: colors.primary },
  support: { icon: 'support', color: colors.info },
};

export default function NotificationBanner({ notification, onPress, onDismiss }) {
  const insets = useSafeAreaInsets();
  const y = useRef(new Animated.Value(HIDDEN_Y)).current;
  const timer = useRef(null);

  // Held in a ref, not in state: the pan responder is created once and would
  // otherwise close over the first render's onDismiss forever.
  const dismissRef = useRef(onDismiss);
  dismissRef.current = onDismiss;

  const hide = (cb) => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    Animated.timing(y, { toValue: HIDDEN_Y, duration: 200, useNativeDriver: true })
      .start(() => cb && cb());
  };

  // Swipe up to dismiss. Claims the gesture only on a clear upward drag, so a tap
  // still registers as a tap and a downward pull is left to whatever is behind.
  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dy < -6 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_, g) => { if (g.dy < 0) y.setValue(g.dy); },
      onPanResponderRelease: (_, g) => {
        if (g.dy < -40) {
          Animated.timing(y, { toValue: HIDDEN_Y, duration: 150, useNativeDriver: true })
            .start(() => dismissRef.current && dismissRef.current());
        } else {
          Animated.spring(y, { toValue: 0, useNativeDriver: true }).start();
        }
      },
    }),
  ).current;

  useEffect(() => {
    if (!notification) return undefined;

    y.setValue(HIDDEN_Y);
    Animated.spring(y, {
      toValue: 0, useNativeDriver: true, friction: 9, tension: 60,
    }).start();

    timer.current = setTimeout(() => hide(onDismiss), VISIBLE_MS);
    return () => { if (timer.current) clearTimeout(timer.current); };
    // Re-runs per notification id so a second alert arriving while the first is up
    // replays the entrance animation rather than sitting there silently replaced.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notification?.key]);

  if (!notification) return null;

  const t = TYPE_STYLE[notification.type] || { icon: 'bell', color: colors.primary };

  return (
    <Animated.View
      {...pan.panHandlers}
      style={[
        styles.wrap,
        { top: insets.top + spacing.sm, transform: [{ translateY: y }] },
      ]}
    >
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => hide(onPress)}
        style={styles.card}
      >
        {/* Colour rail — the fastest read of "which part of the app is this". */}
        <View style={[styles.rail, { backgroundColor: t.color }]} />

        <View style={[styles.iconWrap, { backgroundColor: `${t.color}1A` }]}>
          <Icon name={t.icon} size={20} color={t.color} />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={styles.title} numberOfLines={1}>{notification.title}</Text>
          <Text style={styles.body} numberOfLines={2}>{notification.message}</Text>
        </View>

        <Icon name="next" size={18} color={colors.textMuted} />
      </TouchableOpacity>

      <View style={styles.grabber} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    // Above every screen, and above the tab bar, but below nothing else.
    zIndex: 9999,
    elevation: 24,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    paddingLeft: spacing.md + 4,
    paddingRight: spacing.md,
    overflow: 'hidden',
    // Elevation alone is flat on Android; the shadow is what lifts it off the
    // screen behind it so it reads as an overlay rather than part of the page.
    ...Platform.select({
      android: { elevation: 8 },
      ios: {
        shadowColor: '#0B1220',
        shadowOpacity: 0.18,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 6 },
      },
    }),
  },
  rail: {
    position: 'absolute', left: 0, top: 0, bottom: 0, width: 4,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  title: { fontSize: font.body, fontWeight: font.bold, color: colors.text },
  body: { fontSize: font.small, color: colors.textMuted, marginTop: 2, lineHeight: 18 },
  // The affordance for swipe-to-dismiss. Without it the gesture is undiscoverable.
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginTop: 6,
  },
});
