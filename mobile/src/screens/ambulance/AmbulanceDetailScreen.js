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
// The field holding WHEN each stage happened, so each step shows a real time.
const STAGE_AT = {
  requested: 'created_at', assigned: 'assigned_at', accepted: 'accepted_at',
  on_the_way: 'on_the_way_at', picked_up: 'picked_up_at', completed: 'completed_at',
};

// One clearly-tagged detail cell — icon + label on top, value beneath — laid out
// two per row so the card stays compact and the right half isn't left empty.
function InfoCell({ icon, label, value }) {
  return (
    <View style={styles.infoCell}>
      <Row style={{ alignItems: 'center', marginBottom: 3 }}>
        <Icon name={icon} size={14} color={colors.ambulance} />
        <Text style={styles.infoLabel}>{label}</Text>
      </Row>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

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
        <Row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={styles.cardHeading}>Trip details</Text>
          <Pill label={statusLabel(r.status)} color={cancelled ? colors.danger : colors.ambulance} />
        </Row>

        {/* Every detail clearly tagged, two per row: who, from where, to where, how. */}
        <View style={styles.infoGrid}>
          <InfoCell icon="user" label="Patient name" value={r.patient_name} />
          <InfoCell icon="location" label="From (pickup)" value={r.pickup_address} />
          <InfoCell icon="hospital" label="To (hospital)" value={r.drop_address} />
          <InfoCell icon="ambulance" label="Ambulance type" value={statusLabel(r.ambulance_type)} />
          {r.city ? <InfoCell icon="pin" label="City" value={r.city} /> : null}
          {r.created_at ? <InfoCell icon="clock" label="Requested at" value={formatDateTime(r.created_at)} /> : null}
        </View>

        {r.driver_name && (
          <View style={styles.driver}>
            <View style={styles.infoGrid}>
              <InfoCell icon="ambulance" label="Vehicle" value={r.vehicle_number || 'Assigned vehicle'} />
              <InfoCell icon="user" label="Driver" value={r.driver_name} />
            </View>
            {r.driver_mobile && (
              <AppButton title="Call driver" icon="phone" variant="outline" color={colors.success}
                style={{ marginTop: spacing.md }} onPress={() => Linking.openURL(`tel:${r.driver_mobile}`)} />
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
            const at = r[STAGE_AT[step]];
            return (
              <Row key={step} style={{ alignItems: 'flex-start', marginTop: i === 0 ? spacing.sm : 0 }}>
                <View style={styles.timelineCol}>
                  <View style={[styles.dot, done && styles.dotDone, active && styles.dotActive]} />
                  {i < FLOW.length - 1 && <View style={[styles.line, done && styles.lineDone]} />}
                </View>
                <View style={styles.stepBody}>
                  <Text style={[styles.step, done && styles.stepDone]}>{LABELS[step]}</Text>
                  {at ? <Text style={styles.stepTime}>{formatDateTime(at)}</Text> : null}
                </View>
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
  cardHeading: { fontSize: font.h3, fontWeight: font.bold, color: colors.text },
  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: spacing.xs },
  infoCell: { width: '48%', marginTop: spacing.md },
  infoLabel: { fontSize: font.tiny, color: colors.textMuted, fontWeight: font.bold, letterSpacing: 0.3, textTransform: 'uppercase', marginLeft: 4 },
  infoValue: { fontSize: font.small, color: colors.text, fontWeight: font.semibold, lineHeight: 18 },
  driver: { marginTop: spacing.md, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  timelineTitle: { fontSize: font.h3, fontWeight: font.bold, color: colors.text, marginBottom: spacing.sm },
  timelineCol: { width: 24, alignItems: 'center' },
  dot: { width: 14, height: 14, borderRadius: 7, backgroundColor: colors.border, marginTop: 2 },
  dotDone: { backgroundColor: colors.ambulance },
  dotActive: { borderWidth: 3, borderColor: colors.ambulanceLight },
  line: { width: 2, height: 32, backgroundColor: colors.border },
  lineDone: { backgroundColor: colors.ambulance },
  stepBody: { flex: 1, marginLeft: spacing.sm, paddingBottom: 18 },
  step: { color: colors.textMuted, fontSize: font.body },
  stepDone: { color: colors.text, fontWeight: font.medium },
  stepTime: { color: colors.textMuted, fontSize: font.tiny, marginTop: 2 },
});
