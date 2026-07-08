import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from '../../components/Icon';
import { AppButton } from '../../components/UI';
import { colors, spacing, font } from '../../theme';

// Full-screen confirmation shown right after an order is placed, before the
// order detail page. A tick pops in, then the text + button fade up.
export default function OrderSuccessScreen({ route, navigation }) {
  const { id } = route.params || {};
  const scale = useRef(new Animated.Value(0)).current;
  const ring = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(0)).current;
  const lift = useRef(new Animated.Value(16)).current;
  const navigated = useRef(false);

  const goToDetail = () => {
    if (navigated.current) return;
    navigated.current = true;
    navigation.replace('OrderDetail', { id });
  };

  useEffect(() => {
    Animated.sequence([
      Animated.timing(ring, { toValue: 1, duration: 260, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 5, tension: 90, useNativeDriver: true }),
      Animated.parallel([
        Animated.timing(fade, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(lift, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]),
    ]).start();
    // Auto-continue to the order details so the user isn't stuck here.
    const t = setTimeout(goToDetail, 8400);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <SafeAreaView style={styles.wrap}>
      <View style={styles.center}>
        <Animated.View style={[styles.halo, { opacity: ring.interpolate({ inputRange: [0, 1], outputRange: [0, 1] }), transform: [{ scale: ring }] }]} />
        <Animated.View style={[styles.circle, { transform: [{ scale }] }]}>
          <Icon name="check-bold" size={72} color={colors.white} />
        </Animated.View>

        <Animated.View style={{ opacity: fade, transform: [{ translateY: lift }], alignItems: 'center' }}>
          <Text style={styles.title}>Order placed!</Text>
          <Text style={styles.sub}>
            Your order has been sent to the pharmacy. You'll be notified as it's accepted and prepared.
          </Text>
        </Animated.View>
      </View>

      <Animated.View style={{ opacity: fade, width: '100%' }}>
        <AppButton title="View order details" color={colors.pharmacy} onPress={goToDetail} />
      </Animated.View>
    </SafeAreaView>
  );
}

const CIRCLE = 132;
const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg, padding: spacing.xl, justifyContent: 'space-between' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  // halo: {
  //   position: 'absolute', width: CIRCLE + 46, height: CIRCLE + 46, borderRadius: (CIRCLE + 46) / 2,
  //   backgroundColor: colors.pharmacyLight,
  // },
  circle: {
    width: CIRCLE, height: CIRCLE, borderRadius: CIRCLE / 2, backgroundColor: colors.pharmacy,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: colors.pharmacy, shadowOpacity: 0.4, shadowRadius: 20, shadowOffset: { width: 0, height: 10 }, elevation: 8,
  },
  title: { fontSize: font.h1, fontWeight: font.bold, color: colors.text, marginTop: spacing.xl },
  sub: { fontSize: font.body, color: colors.textMuted, textAlign: 'center', marginTop: spacing.sm, lineHeight: 21, paddingHorizontal: spacing.md },
});
