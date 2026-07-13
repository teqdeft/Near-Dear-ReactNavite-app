import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Switch, Animated, Easing } from 'react-native';
import Icon from './Icon';
import { parseCities } from './CityChipsInput';
import { colors, spacing, font, radius, shadow } from '../theme';

/**
 * The driver's on/off duty switch — the most consequential control on their
 * screen, so it gets the room to say what it actually does.
 *
 * The copy names the driver's OWN cities rather than saying "your cities",
 * because the whole point is the difference between the two states, and a driver
 * skimming this at 3am should not have to reason about it. Off duty is not a dead
 * end — city calls keep coming — and saying so is what stops a driver leaving the
 * switch on all night and blaming us for the battery.
 */
export default function DutyToggleCard({ onDuty, busy, onChange, cities, radiusKm = 10 }) {
  // A slow halo behind the dot — the "live" heartbeat a driver already reads as
  // "the system can see me" everywhere else.
  const pulse = useRef(new Animated.Value(0)).current;
  // A second, gentler breath on a ring around it, so the dot doesn't just blink.
  const glow = useRef(new Animated.Value(0)).current;
  // The dot pops in when duty starts. Starts at 1, NOT 0: this scale is applied
  // to the dot in both states, so a 0 here would shrink the off-duty dot to
  // nothing and leave a blank hole where the status indicator should be.
  const dotScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!onDuty) {
      pulse.setValue(0);
      glow.setValue(0);
      dotScale.setValue(1); // visible, just grey and still
      return undefined;
    }

    dotScale.setValue(0.6);
    Animated.spring(dotScale, { toValue: 1, friction: 5, tension: 90, useNativeDriver: true }).start();

    const pulseLoop = Animated.loop(
      Animated.timing(pulse, {
        toValue: 1, duration: 2200, easing: Easing.out(Easing.ease), useNativeDriver: true,
      }),
    );
    const glowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0, duration: 1100, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    pulseLoop.start();
    glowLoop.start();
    return () => { pulseLoop.stop(); glowLoop.stop(); };
  }, [onDuty, pulse, glow, dotScale]);

  const haloStyle = {
    transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 2.8] }) }],
    opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] }),
  };
  const glowStyle = { opacity: glow.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.85] }) };
  const dotStyle = { transform: [{ scale: dotScale }] };

  // "Mohali, Kharar and Chandigarh" — naming them beats "your cities", which a
  // driver has to stop and translate.
  const list = parseCities(cities);
  const cityText = list.length === 0 ? null
    : list.length === 1 ? list[0]
      : `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`;

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
          {/* No emoji in the title to say the same thing: this dot IS the status
              light, and an emoji would render differently on every Android skin
              and never match colors.ambulance. */}
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

        <Switch
          value={onDuty}
          disabled={busy}
          onValueChange={onChange}
          trackColor={{ true: colors.ambulance, false: colors.border }}
          thumbColor={colors.white}
        />
      </View>

      <View style={styles.divider} />

      {/* What you get, spelled out — the two states differ in exactly one way and
          this is it. */}
      <View style={styles.lines}>
        <Line
          on
          icon="pin"
          text={cityText
            ? `Calls from ${cityText}`
            : 'Calls from the cities on your profile'}
          hint="Always — on duty or off"
        />
        <Line
          on={onDuty}
          icon="ambulance"
          text={`Calls within ${radiusKm} km of you`}
          hint={onDuty
            ? 'Even in towns you don’t cover'
            : 'Turn on duty to get these'}
        />
      </View>

      {onDuty ? (
        <View style={styles.footer}>
          <Icon name="location" size={12} color={colors.ambulance} />
          <Text style={styles.footerText}>
            Sharing your location every 15 seconds. It stops the moment you go off duty.
          </Text>
        </View>
      ) : null}
    </View>
  );
}

// One "you do / you don't get this" row. A tick when it's active, the plain icon
// when it isn't — so the difference between the two states reads at a glance.
function Line({ on, icon, text, hint }) {
  const scale = useRef(new Animated.Value(1)).current;
  const first = useRef(true);

  // Pop the badge when the row flips. Reset to 0.7 first — springing from 1 to 1
  // (which is what happens if you only call spring on change) animates nothing at
  // all, so the toggle would look dead.
  useEffect(() => {
    if (first.current) { first.current = false; return; } // no pop on mount
    scale.setValue(0.7);
    Animated.spring(scale, { toValue: 1, friction: 5, tension: 120, useNativeDriver: true }).start();
  }, [on, scale]);

  return (
    <View style={styles.line}>
      <Animated.View style={[
        styles.lineIcon,
        { backgroundColor: on ? colors.ambulance : colors.border, transform: [{ scale }] },
      ]}>
        <Icon name={on ? 'check' : icon} size={12} color={on ? colors.white : colors.textMuted} />
      </Animated.View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.lineText, !on && { color: colors.textMuted }]}>{text}</Text>
        <Text style={styles.lineHint}>{hint}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1.5, marginBottom: spacing.lg },
  cardOn: { backgroundColor: colors.ambulanceLight, borderColor: colors.ambulance },
  cardOff: { backgroundColor: colors.surface, borderColor: colors.border },

  head: { flexDirection: 'row', alignItems: 'center' },

  // Sized to hold the halo at full expansion (18 * 2.8 ≈ 50) — a smaller box and
  // the pulse would be clipped mid-breath.
  dotWrap: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 16, height: 16, borderRadius: 8, zIndex: 3 },
  glowRing: {
    position: 'absolute', width: 28, height: 28, borderRadius: 14,
    borderWidth: 2, borderColor: colors.ambulance, zIndex: 2,
  },
  halo: {
    position: 'absolute', width: 16, height: 16, borderRadius: 8,
    backgroundColor: colors.ambulance, zIndex: 1,
  },

  titleWrap: { flex: 1, marginLeft: spacing.xs },
  title: { fontSize: font.h3, fontWeight: font.bold },
  subtitle: { fontSize: font.tiny, color: colors.textMuted, marginTop: 2, fontWeight: font.medium },

  divider: { height: 1, backgroundColor: colors.border, marginTop: spacing.md },

  lines: { marginTop: spacing.sm },
  line: { flexDirection: 'row', alignItems: 'flex-start', marginTop: spacing.md },
  lineIcon: {
    width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
    marginRight: spacing.md, marginTop: 1,
  },
  lineText: { fontSize: font.small, fontWeight: font.semibold, color: colors.text },
  lineHint: { fontSize: font.tiny, color: colors.textMuted, marginTop: 2 },

  footer: {
    flexDirection: 'row', alignItems: 'flex-start', marginTop: spacing.lg,
    paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.ambulance + '33',
  },
  footerText: {
    flex: 1, fontSize: font.tiny, color: colors.ambulance, marginLeft: 6,
    lineHeight: 16, fontWeight: font.medium,
  },
});
