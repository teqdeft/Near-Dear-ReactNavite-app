import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, Alert, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { AmbulanceApi } from '../../api';
import { errMessage } from '../../api/client';
import { useAuth } from '../../store/AuthContext';
import { Card, Pill, Muted, Row, AppButton, Loader, EmptyState } from '../../components/UI';
import Icon from '../../components/Icon';
import { colors, spacing, font, radius, shadow } from '../../theme';

const NEXT = { accepted: 'on_the_way', on_the_way: 'picked_up', picked_up: 'completed' };
const NEXT_LABEL = { accepted: 'Start trip (on the way)', on_the_way: 'Mark picked up', picked_up: 'Complete trip' };
const ACTIVE = ['accepted', 'on_the_way', 'picked_up'];

export default function DriverDashboardScreen() {
  const { user } = useAuth();
  const [available, setAvailable] = useState(null);
  const [mine, setMine] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    try {
      const [av, my] = await Promise.all([AmbulanceApi.driverAvailable(), AmbulanceApi.driverRequests()]);
      setAvailable(av || []);
      setMine(my || []);
    } catch (e) { setAvailable([]); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const accept = async (req) => {
    setBusyId(req.id);
    try {
      const res = await AmbulanceApi.accept(req.id);
      Alert.alert('Accepted', `Please call ${res.patient_name} to coordinate pickup.`, [
        { text: 'Later' },
        { text: `Call ${res.contact_mobile}`, onPress: () => Linking.openURL(`tel:${res.contact_mobile}`) },
      ]);
      await load();
    } catch (e) { Alert.alert('Could not accept', errMessage(e)); await load(); } finally { setBusyId(null); }
  };

  const advance = async (req) => {
    const next = NEXT[req.status];
    if (!next) return;
    setBusyId(req.id);
    try { await AmbulanceApi.updateStatus(req.id, next); await load(); }
    catch (e) { Alert.alert('Error', errMessage(e)); } finally { setBusyId(null); }
  };

  const activeTrips = mine.filter((m) => ACTIVE.includes(m.status));
  if (available === null) return <Loader />;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }} showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.hello}>Hi, {(user?.name || 'Driver').split(' ')[0]}</Text>
            <Text style={styles.role}>Ambulance Driver</Text>
          </View>
          <View style={styles.online}>
            <Icon name="online" size={10} color={colors.success} />
            <Text style={styles.onlineText}> Online</Text>
          </View>
        </View>

        {activeTrips.length > 0 && (
          <>
            <Text style={styles.section}>Active trip</Text>
            {activeTrips.map((t) => (
              <Card key={t.id} style={[styles.activeCard, shadow.card]}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <Text style={styles.patient}>{t.patient_name}</Text>
                  <Pill label={t.status.replace(/_/g, ' ')} color={colors.ambulance} />
                </Row>
                <Row style={{ marginTop: 8 }}><Icon name="location" size={15} color={colors.textMuted} /><Muted style={{ marginLeft: 4 }}>{t.pickup_address}</Muted></Row>
                <Row style={{ marginTop: 2 }}><Icon name="hospital" size={15} color={colors.textMuted} /><Muted style={{ marginLeft: 4 }}>{t.drop_address}</Muted></Row>
                <Row style={{ marginTop: spacing.md }}>
                  <AppButton title="Call" icon="phone" variant="outline" color={colors.success} style={{ flex: 1, marginRight: spacing.sm }} onPress={() => Linking.openURL(`tel:${t.contact_mobile}`)} />
                  {NEXT[t.status] ? <AppButton title={NEXT_LABEL[t.status]} color={colors.ambulance} loading={busyId === t.id} style={{ flex: 1.4 }} onPress={() => advance(t)} /> : null}
                </Row>
              </Card>
            ))}
          </>
        )}

        <Text style={styles.section}>Nearby requests {available.length ? `(${available.length})` : ''}</Text>
        {available.length === 0 ? (
          <EmptyState icon="ambulance" title="No requests right now" subtitle="You'll be notified when someone nearby needs an ambulance. Pull to refresh." />
        ) : (
          available.map((r) => (
            <Card key={r.id} style={styles.reqCard}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Text style={styles.patient}>{r.patient_name}</Text>
                <Pill label={r.ambulance_type} color={colors.ambulance} />
              </Row>
              <Row style={{ marginTop: 8 }}><Icon name="location" size={15} color={colors.textMuted} /><Muted style={{ marginLeft: 4 }}>{r.pickup_address}</Muted></Row>
              <Row style={{ marginTop: 2 }}><Icon name="hospital" size={15} color={colors.textMuted} /><Muted style={{ marginLeft: 4 }}>{r.drop_address}</Muted></Row>
              {r.city ? <Row style={{ marginTop: 2 }}><Icon name="pin" size={15} color={colors.textMuted} /><Muted style={{ marginLeft: 4 }}>{r.city}</Muted></Row> : null}
              <AppButton title="Accept request" color={colors.ambulance} loading={busyId === r.id} style={{ marginTop: spacing.md }} onPress={() => accept(r)} />
            </Card>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.lg },
  hello: { fontSize: font.h2, fontWeight: font.bold, color: colors.text },
  role: { color: colors.textMuted, fontSize: font.small, marginTop: 2 },
  online: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.pharmacyLight, paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: radius.pill },
  onlineText: { color: colors.success, fontWeight: font.bold, fontSize: font.small },
  section: { fontSize: font.h3, fontWeight: font.bold, color: colors.text, marginTop: spacing.md, marginBottom: spacing.md },
  activeCard: { borderLeftWidth: 4, borderLeftColor: colors.ambulance, marginBottom: spacing.md },
  reqCard: { marginBottom: spacing.md },
  patient: { fontSize: font.body, fontWeight: font.bold, color: colors.text },
});
