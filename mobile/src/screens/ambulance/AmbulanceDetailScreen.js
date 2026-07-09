import React, { useState, useCallback, useEffect } from 'react';
import { ScrollView, View, Text, StyleSheet, Alert, Linking, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { AmbulanceApi } from '../../api';
import { errMessage } from '../../api/client';
import { Card, Pill, Muted, Row, AppButton, Loader, EmptyState } from '../../components/UI';
import Icon from '../../components/Icon';
import LiveTrackingMap from '../../components/LiveTrackingMap';
import { formatDateTime } from '../../utils/datetime';
import { statusLabel } from '../../utils/status';
import { colors, spacing, font } from '../../theme';

// Statuses during which the trip is live and worth showing the map — from the
// moment a driver accepts (matches the driver's own "active trip" view), so the
// requester can watch the ambulance approach.
const TRACKABLE = ['accepted', 'on_the_way', 'picked_up'];

const FLOW = ['requested', 'assigned', 'accepted', 'on_the_way', 'picked_up', 'completed'];
const LABELS = {
  requested: 'Request received', assigned: 'Ambulance assigned', accepted: 'Driver accepted',
  on_the_way: 'On the way to pickup', picked_up: 'Patient picked up', completed: 'Trip completed',
};

export default function AmbulanceDetailScreen({ route }) {
  const { id } = route.params;
  const [r, setR] = useState(null);
  const [live, setLive] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);

  const load = useCallback(async () => {
    setErr(false);
    try { setR(await AmbulanceApi.requestDetail(id)); } catch (e) { setErr(true); Alert.alert('Error', errMessage(e)); }
  }, [id]);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const status = r?.status;
  const isTrackable = TRACKABLE.includes(status);

  // Poll the driver's live GPS every 5s while the ambulance is moving.
  useFocusEffect(useCallback(() => {
    if (!isTrackable) { setLive(null); return undefined; }
    let active = true;
    const poll = async () => {
      try { const t = await AmbulanceApi.track(id); if (active) setLive(t); } catch { /* keep last position */ }
    };
    poll();
    const timer = setInterval(poll, 5000);
    return () => { active = false; clearInterval(timer); };
  }, [isTrackable, id]));

  // When the trip advances/ends (e.g. picked_up → completed), refresh the timeline.
  useEffect(() => {
    if (live?.status && status && live.status !== status) load();
  }, [live?.status, status, load]);

  if (err && !r) return <EmptyState icon="alert" title="Couldn't load" subtitle="Please check your connection and try again." action={<AppButton title="Retry" onPress={load} />} />;
  if (!r) return <Loader />;

  const cancelled = r.status === 'cancelled';
  const currentIdx = FLOW.indexOf(r.status);

  const cancel = () => {
    Alert.alert('Cancel ambulance?', 'Are you sure you want to cancel this request?', [
      { text: 'No', style: 'cancel' },
      { text: 'Yes, cancel', style: 'destructive', onPress: async () => {
        setBusy(true);
        try { await AmbulanceApi.cancelRequest(id); await load(); } catch (e) { Alert.alert('Error', errMessage(e)); } finally { setBusy(false); }
      } },
    ]);
  };

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ padding: spacing.lg }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.ambulance} />}>
      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <Text style={styles.title}>{r.patient_name}</Text>
          <Pill label={statusLabel(r.status)} color={cancelled ? colors.danger : colors.ambulance} />
        </Row>
        <Row style={{ marginTop: spacing.sm }}><Icon name="location" size={15} color={colors.textMuted} /><Muted style={{ marginLeft: 6, flex: 1 }}>Pickup: {r.pickup_address}</Muted></Row>
        <Row style={{ marginTop: 2 }}><Icon name="hospital" size={15} color={colors.textMuted} /><Muted style={{ marginLeft: 6, flex: 1 }}>Drop: {r.drop_address}</Muted></Row>
        <Pill label={`Type: ${r.ambulance_type}`} color={colors.ambulance} style={{ marginTop: spacing.sm }} />
        {r.created_at ? <Muted style={{ marginTop: spacing.sm }}>Requested: {formatDateTime(r.created_at)}</Muted> : null}

        {r.driver_name && (
          <View style={styles.driver}>
            <Row><Icon name="ambulance" size={18} color={colors.ambulance} /><Text style={styles.driverTitle}>  {r.vehicle_number || 'Assigned vehicle'}</Text></Row>
            <Muted>Driver: {r.driver_name}</Muted>
            {r.driver_mobile && (
              <AppButton title="Call driver" icon="phone" variant="outline" color={colors.success}
                style={{ marginTop: spacing.sm }} onPress={() => Linking.openURL(`tel:${r.driver_mobile}`)} />
            )}
          </View>
        )}
      </Card>

      {isTrackable && (
        <View style={{ marginTop: spacing.lg }}>
          <LiveTrackingMap
            latitude={live?.current_latitude}
            longitude={live?.current_longitude}
            bearing={live?.bearing}
            pickup={{ lat: r.pickup_latitude, lng: r.pickup_longitude }}
            drop={{ lat: r.drop_latitude, lng: r.drop_longitude }}
          />
          <Muted style={{ marginTop: 6, textAlign: 'center' }}>
            {live?.current_latitude ? 'Live location · updates every few seconds' : 'Locating the ambulance…'}
          </Muted>
        </View>
      )}

      {!cancelled && (
        <Card style={{ marginTop: spacing.lg }}>
          <Text style={styles.timelineTitle}>Status</Text>
          {FLOW.map((step, i) => {
            const done = i <= currentIdx;
            const active = i === currentIdx;
            return (
              <Row key={step} style={{ alignItems: 'flex-start', marginTop: i === 0 ? spacing.sm : 0 }}>
                <View style={styles.timelineCol}>
                  <View style={[styles.dot, done && styles.dotDone, active && styles.dotActive]} />
                  {i < FLOW.length - 1 && <View style={[styles.line, done && styles.lineDone]} />}
                </View>
                <Text style={[styles.step, done && styles.stepDone]}>{LABELS[step]}</Text>
              </Row>
            );
          })}
        </Card>
      )}

      {['requested', 'assigned', 'accepted'].includes(r.status) && (
        <AppButton title="Cancel request" variant="outline" color={colors.danger} loading={busy}
          style={{ marginTop: spacing.lg }} onPress={cancel} />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: font.h3, fontWeight: font.bold, color: colors.text },
  driver: { marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  driverTitle: { fontSize: font.body, fontWeight: font.semibold, color: colors.text },
  timelineTitle: { fontSize: font.h3, fontWeight: font.bold, color: colors.text, marginBottom: spacing.sm },
  timelineCol: { width: 24, alignItems: 'center' },
  dot: { width: 14, height: 14, borderRadius: 7, backgroundColor: colors.border, marginTop: 2 },
  dotDone: { backgroundColor: colors.ambulance },
  dotActive: { borderWidth: 3, borderColor: colors.ambulanceLight },
  line: { width: 2, height: 28, backgroundColor: colors.border },
  lineDone: { backgroundColor: colors.ambulance },
  step: { flex: 1, marginLeft: spacing.sm, color: colors.textMuted, fontSize: font.body, paddingBottom: 18 },
  stepDone: { color: colors.text, fontWeight: font.medium },
});
