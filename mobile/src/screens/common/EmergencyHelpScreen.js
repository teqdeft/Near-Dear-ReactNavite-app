import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { Screen, Card, Muted, Row } from '../../components/UI';
import Icon from '../../components/Icon';
import { colors, spacing, font, radius } from '../../theme';

// Official Indian emergency helplines — used only as a fallback when NearDear
// can't dispatch help fast enough.
const HELPLINES = [
  { number: '112', label: 'National Emergency', sub: 'Police · Fire · Ambulance (all-in-one)', color: colors.danger },
  { number: '108', label: 'Ambulance (Medical)', sub: 'Free emergency medical ambulance', color: colors.ambulance },
  { number: '102', label: 'Ambulance', sub: 'Pregnancy & infant care ambulance', color: colors.ambulance },
  { number: '100', label: 'Police', sub: 'Police emergency', color: colors.info },
  { number: '101', label: 'Fire', sub: 'Fire brigade', color: colors.warning },
  { number: '1098', label: 'Child Helpline', sub: 'Emergency help for children', color: colors.primary },
];

const TIPS = [
  'Stay calm and speak clearly — tell them your exact location.',
  'If it’s a road accident or someone is unconscious, call 112 or 108 first.',
  'Keep the patient still; don’t move them unless there is danger.',
  'Stay on the line until help is on the way.',
];

export default function EmergencyHelpScreen() {
  const call = (n) => Linking.openURL(`tel:${n}`).catch(() => {});

  return (
    <Screen scroll edges={[]}>
      <View style={styles.hero}>
        <Text style={styles.heroTitle}>Emergency Help</Text>
        <Text style={styles.heroText}>
          NearDear connects you with nearby ambulances, blood donors and pharmacies — use the app first
          and track your request live.
        </Text>
        <Text style={[styles.heroText, { marginTop: spacing.sm, fontWeight: font.semibold }]}>
          But your safety comes first. In a critical, life-threatening emergency — or if no driver is
          available near you right now — call these official helplines directly.
        </Text>
      </View>

      <View style={{ height: spacing.lg }} />

      {HELPLINES.map((h) => (
        <TouchableOpacity key={h.number} activeOpacity={0.85} onPress={() => call(h.number)}>
          <Card style={styles.lineCard}>
            <Row style={{ alignItems: 'center' }}>
              <View style={[styles.numBadge, { backgroundColor: h.color }]}>
                <Text style={styles.numText}>{h.number}</Text>
              </View>
              <View style={{ flex: 1, marginLeft: spacing.md }}>
                <Text style={styles.lineLabel}>{h.label}</Text>
                <Muted>{h.sub}</Muted>
              </View>
              <Icon name="phone" size={22} color={colors.success} />
            </Row>
          </Card>
        </TouchableOpacity>
      ))}

      <Text style={styles.tipsTitle}>In an emergency, remember</Text>
      <Card>
        {TIPS.map((t, i) => (
          <Row key={t} style={{ alignItems: 'flex-start', marginTop: i === 0 ? 0 : spacing.sm }}>
            <Text style={styles.tipDot}>•</Text>
            <Muted style={{ flex: 1, marginLeft: 6, lineHeight: 20 }}>{t}</Muted>
          </Row>
        ))}
      </Card>

      <Muted style={{ textAlign: 'center', marginTop: spacing.lg, marginBottom: spacing.xl }}>
        Tap any number to call directly.
      </Muted>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { backgroundColor: colors.danger, borderRadius: radius.lg, padding: spacing.lg },
  heroTitle: { fontSize: font.h2, fontWeight: font.bold, color: colors.white, marginBottom: spacing.sm },
  heroText: { fontSize: font.small, color: colors.white, lineHeight: 20, opacity: 0.95 },
  lineCard: { marginBottom: spacing.sm },
  numBadge: { width: 54, height: 54, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  numText: { color: colors.white, fontWeight: font.bold, fontSize: font.body },
  lineLabel: { fontSize: font.body, fontWeight: font.bold, color: colors.text },
  tipsTitle: { fontSize: font.h3, fontWeight: font.bold, color: colors.text, marginTop: spacing.lg, marginBottom: spacing.md },
  tipDot: { color: colors.danger, fontSize: font.body, fontWeight: font.bold },
});
