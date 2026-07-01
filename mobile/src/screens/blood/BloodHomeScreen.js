import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Switch, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { BloodApi } from '../../api';
import { errMessage } from '../../api/client';
import { Card, Pill, Muted, Row, IconBadge } from '../../components/UI';
import Icon from '../../components/Icon';
import GradientBackground from '../../components/GradientBackground';
import { colors, spacing, font, radius, shadow } from '../../theme';

function ActionCard({ icon, title, subtitle, onPress, color = colors.blood }) {
  return (
    <Card onPress={onPress} style={styles.action}>
      <IconBadge name={icon} color={color} size={46} iconSize={24} />
      <View style={{ flex: 1, marginLeft: spacing.md }}>
        <Text style={styles.actionTitle}>{title}</Text>
        <Muted>{subtitle}</Muted>
      </View>
      <Icon name="chevronRight" size={22} color={colors.textMuted} />
    </Card>
  );
}

export default function BloodHomeScreen({ navigation }) {
  const [donor, setDonor] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try { setDonor(await BloodApi.myDonor()); } catch (e) { /* ignore */ }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const toggleAvailability = async (value) => {
    setBusy(true);
    try {
      await BloodApi.setAvailability(value);
      setDonor((d) => ({ ...d, is_available: value }));
    } catch (e) { Alert.alert('Error', errMessage(e)); } finally { setBusy(false); }
  };

  return (
    <GradientBackground>
    <ScrollView style={{ backgroundColor: 'transparent' }} contentContainerStyle={{ padding: spacing.lg }} showsVerticalScrollIndicator={false}>
      <View style={[styles.hero, shadow.card]}>
        <Icon name="blood" size={40} color={colors.white} />
        <Text style={styles.heroTitle}>Give blood, save lives</Text>
        <Text style={styles.heroSub}>Connect with nearby donors and receivers in real time.</Text>
      </View>

      {donor && (
        <Card style={styles.donorCard}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Row>
              <IconBadge name="donor" color={colors.blood} size={42} iconSize={22} />
              <View style={{ marginLeft: spacing.md }}>
                <Text style={styles.donorTitle}>Registered donor</Text>
                <Row style={{ marginTop: 4 }}>
                  <Pill label={donor.blood_group} color={colors.blood} />
                  <Pill label={donor.city} color={colors.primary} style={{ marginLeft: 6 }} icon="location" />
                </Row>
              </View>
            </Row>
          </Row>
          <Row style={{ justifyContent: 'space-between', marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border }}>
            <Text style={styles.availLabel}>{donor.is_available ? 'Available for requests' : 'Availability paused'}</Text>
            <Switch value={!!donor.is_available} disabled={busy} onValueChange={toggleAvailability} trackColor={{ true: colors.blood }} thumbColor={colors.white} />
          </Row>
        </Card>
      )}

      <ActionCard icon="donor" title={donor ? 'Update donor profile' : 'Become a donor'} subtitle="Set blood group & availability" onPress={() => navigation.navigate('BecomeDonor')} />
      <ActionCard icon="request" title="Request blood" subtitle="Create a request & notify donors" color={colors.primary} onPress={() => navigation.navigate('CreateBloodRequest')} />
      <ActionCard icon="orders" title="My blood requests" subtitle="Track requests you created" color={colors.info} onPress={() => navigation.navigate('MyBloodRequests')} />
      <ActionCard icon="bell" title="Requests for me" subtitle="Respond to matching requests" color={colors.pharmacy} onPress={() => navigation.navigate('DonorRequests')} />

      <Card style={styles.disclaimer}>
        <Row><Icon name="alert" size={18} color="#8A6300" /><Text style={styles.discTitle}>  Blood donation disclaimer</Text></Row>
        <Muted style={{ marginTop: 6 }}>NearDear only connects donors and receivers. We do not certify eligibility. Please follow medical advice and hospital screening before donating.</Muted>
      </Card>
    </ScrollView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  hero: { backgroundColor: colors.blood, borderRadius: radius.lg, padding: spacing.xl, marginBottom: spacing.lg },
  heroTitle: { color: colors.white, fontSize: font.h2, fontWeight: font.bold, marginTop: spacing.sm },
  heroSub: { color: '#FFE1E7', fontSize: font.small, marginTop: 4 },
  donorCard: { marginBottom: spacing.lg },
  donorTitle: { fontSize: font.body, fontWeight: font.bold, color: colors.text },
  availLabel: { fontSize: font.small, color: colors.text, fontWeight: font.medium },
  action: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  actionTitle: { fontSize: font.body, fontWeight: font.semibold, color: colors.text },
  disclaimer: { backgroundColor: '#FFF7E8', marginTop: spacing.sm },
  discTitle: { fontWeight: font.bold, color: '#8A6300' },
});
