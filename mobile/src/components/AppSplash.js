import React, { useEffect, useRef } from 'react';
import { View, Text, Image, StyleSheet, Animated, Easing } from 'react-native';
import { colors, spacing, font } from '../theme';

const LOGO_MARK = require('../assets/logo_mark.png');
const BOTTOM_ART = require('../assets/splash_bottom.png');
const BOTTOM_ART_RATIO = 1024 / 736; // width / height of the cropped source art

// Three dots that pulse in sequence — a lighter-weight, more polished
// alternative to a spinning ActivityIndicator for a splash screen.
function PulsingDots() {
  const dots = useRef([0, 1, 2].map(() => new Animated.Value(0.35))).current;

  useEffect(() => {
    const loops = dots.map((v, i) => Animated.loop(
      Animated.sequence([
        Animated.delay(i * 160),
        Animated.timing(v, { toValue: 1, duration: 380, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(v, { toValue: 0.35, duration: 380, easing: Easing.in(Easing.quad), useNativeDriver: true }),
        Animated.delay((2 - i) * 160),
      ]),
    ));
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [dots]);

  return (
    <View style={styles.dotsRow}>
      {dots.map((v, i) => (
        <Animated.View key={i} style={[styles.dot, { opacity: v, transform: [{ scale: v }] }]} />
      ))}
    </View>
  );
}

/**
 * Full-screen branded splash shown while the app restores a session (see
 * RootNavigator's `booting` check). Mirrors the brand's cold-start artwork —
 * cream background, the heart+drop mark, wordmark and skyline/wave art — so
 * the in-app splash and the native launch screen feel like one continuous
 * moment instead of a plain spinner.
 */
export default function AppSplash({ text }) {
  const scale = useRef(new Animated.Value(0.6)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const textLift = useRef(new Animated.Value(10)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.spring(scale, { toValue: 1, friction: 6, tension: 80, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 260, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(textOpacity, { toValue: 1, duration: 260, useNativeDriver: true }),
        Animated.timing(textLift, { toValue: 0, duration: 260, useNativeDriver: true }),
      ]),
    ]).start();
  }, [scale, opacity, textOpacity, textLift]);

  return (
    <View style={styles.wrap}>
      {/* Decorative skyline + wave art, pinned to the bottom edge. Sized by its
          own aspect ratio (not stretched/cropped) so it looks right on any
          screen width. */}
      <Image source={BOTTOM_ART} resizeMode="stretch" style={[styles.bottomArt, { aspectRatio: BOTTOM_ART_RATIO }]} />

      <View style={styles.center}>
        <Animated.View style={{ opacity, transform: [{ scale }] }}>
          <Image source={LOGO_MARK} resizeMode="contain" style={styles.logo} />
        </Animated.View>

        <Animated.View style={{ opacity: textOpacity, transform: [{ translateY: textLift }], alignItems: 'center' }}>
          <Text style={styles.brand}>Near dear</Text>
          <Text style={styles.tagline}>Near to you, dear to life.</Text>
        </Animated.View>
      </View>

      <Animated.View style={[styles.bottom, { opacity: textOpacity }]}>
        <PulsingDots />
        {text ? <Text style={styles.statusText}>{text}</Text> : null}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#FBFDF7', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  bottomArt: { position: 'absolute', left: 0, right: 0, bottom: 0, width: '100%' },
  center: { alignItems: 'center' },
  logo: { width: 168, height: 126, marginBottom: spacing.sm },
  brand: { fontSize: font.h1, fontWeight: font.bold, color: colors.primaryDark, letterSpacing: 0.3 },
  tagline: { fontSize: font.small, color: colors.textMuted, marginTop: 4 },
  bottom: { position: 'absolute', bottom: spacing.xxl * 1.6, alignItems: 'center' },
  dotsRow: { flexDirection: 'row', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
  statusText: { marginTop: spacing.md, color: colors.textMuted, fontSize: font.small },
});
