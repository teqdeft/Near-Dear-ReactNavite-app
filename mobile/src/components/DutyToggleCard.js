import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing, TouchableOpacity } from 'react-native';
import Icon from './Icon';
import { parseCities } from './CityChipsInput';
import { colors, spacing, font, shadow } from '../theme';

/**
 * The driver's on/off duty switch — the most consequential control on their
 * screen. Kept COMPACT: a single header row (status dot • label • toggle) plus one
 * caption line that spells out the one thing the two states differ in. The earlier
 * version stacked a big status light, a divider, two explainer rows and a footer,
 * which ate half the screen; the same information now fits in a third of the height.
 *
 * The caption names the driver's OWN cities rather than "your cities", because the
 * whole point is the difference between the two states and a driver skimming this at
 * 3am shouldn't have to reason about it. Off duty is not a dead end — city calls keep
 * coming — and saying so is what stops a driver leaving the switch on all night and
 * blaming us for the battery.
 */
export default function DutyToggleCard({ onDuty, busy, onChange, cities, radiusKm = 10 }) {
  // A slow halo behind the dot — the "live" heartbeat a driver reads as "the system
  // can see me". A gentler ring breathes around it so the dot doesn't just blink.
  const pulse = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;
  // Starts at 1, NOT 0: this scale applies in both states, so a 0 would shrink the
  // off-duty dot to nothing and leave a blank hole where the status light should be.
  const dotScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!onDuty) {
      pulse.setValue(0);
      glow.setValue(0);
      dotScale.setValue(1); // visible, just grey and still
      return undefined;
    }

    dotScale.setValue(0.5);
    Animated.spring(dotScale, { toValue: 1, friction: 4, tension: 110, useNativeDriver: true }).start();

    const pulseLoop = Animated.loop(
      Animated.timing(pulse, {
        toValue: 1, duration: 2400, easing: Easing.out(Easing.ease), useNativeDriver: true,
      }),
    );
    const glowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    pulseLoop.start();
    glowLoop.start();
    return () => { pulseLoop.stop(); glowLoop.stop(); };
  }, [onDuty, pulse, glow, dotScale]);

  const haloStyle = {
    transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 2.6] }) }],
    opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] }),
  };
  const glowStyle = { opacity: glow.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.85] }) };
  const dotStyle = { transform: [{ scale: dotScale }] };

  // "Mohali, Kharar and Chandigarh" — naming them beats "your cities".
  const list = parseCities(cities);
  const cityText = list.length === 0 ? null
    : list.length === 1 ? list[0]
      : `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`;

  const caption = onDuty
    ? (cityText
      ? `Getting calls from ${cityText} + any within ${radiusKm} km of you. Location shared while on duty.`
      : `Getting calls from your cities + any within ${radiusKm} km of you. Location shared while on duty.`)
    : (cityText
      ? `Only calls from ${cityText}. Turn on to also get calls within ${radiusKm} km of you.`
      : `Only calls from your cities. Turn on to also get nearby calls within ${radiusKm} km.`);

  return (
    <View style={[styles.card, onDuty ? styles.cardOn : styles.cardOff, onDuty && shadow.soft]}>
      <View style={styles.head}>
        <View style={styles.dotWrap}>
          {onDuty ? (
            <>
              <Animated.View style={[styles.glowRing, glowStyle]} />
              <Animated.View style={[styles.halo, haloStyle]} />
            </>
          ) : null}
          <Animated.View
            style={[styles.dot, dotStyle, { backgroundColor: onDuty ? colors.ambulance : colors.textMuted }]}
          />
        </View>

        <View style={styles.titleWrap}>
          <Text style={[styles.title, { color: onDuty ? colors.text : colors.textMuted }]}>
            {onDuty ? 'You’re on duty' : 'You’re off duty'}
          </Text>
          <Text style={styles.subtitle}>
            {onDuty ? 'Receiving nearby calls' : 'Nearby calls are off'}
          </Text>
        </View>

        <ModernToggle value={onDuty} disabled={busy} onValueChange={onChange} />
      </View>

      <View style={styles.captionRow}>
        <Icon name={onDuty ? 'pin' : 'info'} size={13} color={onDuty ? colors.ambulance : colors.textMuted} />
        <Text style={styles.caption}>{caption}</Text>
      </View>
    </View>
  );
}

// Modern animated toggle button
function ModernToggle({ value, disabled, onValueChange }) {
  const thumbPosition = useRef(new Animated.Value(value ? 30 : 2)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(thumbPosition, {
      toValue: value ? 30 : 2,
      duration: 300,
      easing: Easing.bezier(0.34, 1.56, 0.64, 1),
      useNativeDriver: false,
    }).start();
  }, [value, thumbPosition]);

  const handlePress = () => {
    if (disabled) return;
    scaleAnim.setValue(0.9);
    Animated.spring(scaleAnim, { toValue: 1, friction: 4, tension: 120, useNativeDriver: true }).start();
    onValueChange(!value);
  };

  return (
    <TouchableOpacity onPress={handlePress} disabled={disabled} activeOpacity={0.7}>
      <Animated.View
        style={[
          styles.toggleContainer,
          value ? styles.toggleContainerOn : styles.toggleContainerOff,
          { transform: [{ scale: scaleAnim }] },
        ]}
      >
        <Animated.View style={[styles.toggleThumb, { transform: [{ translateX: thumbPosition }] }]}>
          <Icon name={value ? 'check' : 'close'} size={14} color={value ? colors.ambulance : colors.border} />
        </Animated.View>
      </Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  cardOn: {
    backgroundColor: '#FFF5F5',
    borderWidth: 1.5,
    borderColor: colors.ambulance + '20',
  },
  cardOff: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border + '40',
  },

  head: { flexDirection: 'row', alignItems: 'center' },

  // Sized to hold the halo at full expansion (14 * 2.6 ≈ 36) without clipping.
  dotWrap: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  dot: {
    width: 14, height: 14, borderRadius: 7, zIndex: 3,
    shadowColor: colors.ambulance, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4, shadowRadius: 6, elevation: 3,
  },
  glowRing: {
    position: 'absolute', width: 26, height: 26, borderRadius: 13,
    borderWidth: 2, borderColor: colors.ambulance, zIndex: 2,
  },
  halo: {
    position: 'absolute', width: 14, height: 14, borderRadius: 7,
    backgroundColor: colors.ambulance, zIndex: 1,
  },

  titleWrap: { flex: 1, marginLeft: spacing.sm },
  title: { fontSize: font.body, fontWeight: '700', letterSpacing: -0.3 },
  subtitle: { fontSize: font.tiny, color: colors.textMuted, marginTop: 2, fontWeight: '500' },

  captionRow: { flexDirection: 'row', alignItems: 'flex-start', marginTop: spacing.sm, gap: 6 },
  caption: { flex: 1, fontSize: font.tiny, color: colors.textMuted, lineHeight: 17, fontWeight: '500' },

  // Modern toggle
  toggleContainer: {
    width: 60,
    height: 32,
    borderRadius: 16,
    padding: 2,
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  toggleContainerOn: { backgroundColor: colors.ambulance },
  toggleContainerOff: { backgroundColor: colors.border },
  toggleThumb: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
});
