import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Switch, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { BloodApi } from '../../api';
import { errMessage } from '../../api/client';
import { Card, Pill, Muted, Row } from '../../components/UI';
import { colors, spacing, font, radius, shadow } from '../../theme';

function ActionCard({ emoji, title, subtitle, onPress, color = colors.blood }) {
  return (
    <Card onPress={onPress} style={styles.action}>
      <View style={[styles.actionIcon, { backgroundColor: color + '18' }]}>
        <Text style={{ fontSize: 26 }}>{emoji}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.actionTitle}>{title}</Text>
        <Muted>{subtitle}</Muted>
      </View>
      <Text style={styles.chev}>›</Text>
    </Card>
  );
}

export default function BloodHomeScreen({ navigation }) {
  const [donor, setDonor] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await BloodApi.myDonor();
      setDonor(d);
    } catch (e) {
      /* ignore */
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const toggleAvailability = async (value) => {
    setBusy(true);
    try {
      await BloodApi.setAvailability(value);
      setDonor((d) => ({ ...d, is_available: value }));
    } catch (e) {
      Alert.alert('Error', errMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ padding: spacing.lg }}>
      <View style={[styles.hero, shadow.card]}>
        <Text style={styles.heroEmoji}>🩸</Text>
        <Text style={styles.heroTitle}>Give blood, save lives</Text>
        <Text style={styles.heroSub}>Connect with nearby donors and receivers in real time.</Text>
      </View>

      {donor && (
        <Card style={styles.donorCard}>
          <Row style={{ justifyContent: 'space-between' }}>
            <View>
              <Text style={styles.donorTitle}>You are a registered donor</Text>
              <Row style={{ marginTop: 6 }}>
                <Pill label={donor.blood_group} color={colors.blood} />
                <Pill label={donor.city} color={colors.primary} style={{ marginLeft: 6 }} />
              </Row>
            </View>
          </Row>
          <Row style={{ justifyContent: 'space-between', marginTop: spacing.md }}>
            <Text style={styles.availLabel}>
              {donor.is_available ? '🟢 Available for requests' : '⚪ Availability paused'}
            </Text>
            <Switch
              value={!!donor.is_available}
              disabled={busy}
              onValueChange={toggleAvailability}
              trackColor={{ true: colors.blood }}
            />
          </Row>
        </Card>
      )}

      <ActionCard emoji="❤️" title={donor ? 'Update donor profile' : 'Become a donor'}
        subtitle="Set your blood group & availability" onPress={() => navigation.navigate('BecomeDonor')} />
      <ActionCard emoji="🆘" title="Request blood" subtitle="Create a request & notify donors"
        onPress={() => navigation.navigate('CreateBloodRequest')} />
      <ActionCard emoji="📋" title="My blood requests" subtitle="Track requests you created"
        color={colors.primary} onPress={() => navigation.navigate('MyBloodRequests')} />
      <ActionCard emoji="🔔" title="Requests for me" subtitle="Respond to matching requests"
        color={colors.ambulance} onPress={() => navigation.navigate('DonorRequests')} />

      <Card style={styles.disclaimer}>
        <Text style={styles.discTitle}>⚠️ Blood donation disclaimer</Text>
        <Muted style={{ marginTop: 4 }}>
          NearDear only connects donors and receivers. We do not certify eligibility. Please follow
          medical advice and hospital screening before donating.
        </Muted>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  hero: { backgroundColor: colors.blood, borderRadius: radius.xl, padding: spacing.xl, marginBottom: spacing.lg },
  heroEmoji: { fontSize: 40 },
  heroTitle: { color: colors.white, fontSize: font.h2, fontWeight: font.bold, marginTop: spacing.sm },
  heroSub: { color: '#FBD9DD', fontSize: font.small, marginTop: 4 },
  donorCard: { marginBottom: spacing.lg, borderLeftWidth: 4, borderLeftColor: colors.blood },
  donorTitle: { fontSize: font.body, fontWeight: font.bold, color: colors.text },
  availLabel: { fontSize: font.small, color: colors.text, fontWeight: font.medium },
  action: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  actionIcon: { width: 50, height: 50, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', marginRight: spacing.md },
  actionTitle: { fontSize: font.body, fontWeight: font.semibold, color: colors.text },
  chev: { fontSize: 26, color: colors.textMuted },
  disclaimer: { backgroundColor: '#FFF6E6', marginTop: spacing.sm },
  discTitle: { fontWeight: font.bold, color: '#8A6300' },
});
