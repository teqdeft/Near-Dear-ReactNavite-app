import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, Alert, Linking, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { AmbulanceApi } from '../../api';
import { errMessage } from '../../api/client';
import { useAuth } from '../../store/AuthContext';
import useDriverLocationTracker from '../../hooks/useDriverLocationTracker';
import useDutyLocationPing from '../../hooks/useDutyLocationPing';
import DutyToggleCard from '../../components/DutyToggleCard';
import DriverTripMap from '../../components/DriverTripMap';
import ProfileAvatar from '../../components/ProfileAvatar';
import ProfilePreviewModal from '../../components/ProfilePreviewModal';
import { Card, Pill, Muted, Row, AppButton, Loader, EmptyState, IconBadge } from '../../components/UI';
import KycGate from '../../components/KycGate';
import Icon from '../../components/Icon';
import { parseCities } from '../../components/CityChipsInput';
import { statusLabel } from '../../utils/status';
import { colors, spacing, font, radius, shadow } from '../../theme';

const NEXT = { accepted: 'on_the_way', on_the_way: 'picked_up', picked_up: 'completed' };
const NEXT_LABEL = { accepted: 'Start trip (on the way)', on_the_way: 'Mark picked up', picked_up: 'Complete trip' };
const ACTIVE = ['accepted', 'on_the_way', 'picked_up'];
// A trip can be cancelled (re-opened for others) only before the patient is picked up.
const RELEASABLE = ['accepted', 'on_the_way'];

export default function DriverDashboardScreen({ navigation }) {
  const { user, profile, aadhaarVerified } = useAuth();
  // The towns this driver serves (from their profile), shown under the role.
  const driverCities = parseCities(profile?.city).join(', ');
  const [preview, setPreview] = useState(false);
  const [available, setAvailable] = useState(null);
  const [mine, setMine] = useState([]);
  const [vehicle, setVehicle] = useState(undefined); // undefined=loading, null=none, obj={vehicle,documents}
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [onDuty, setOnDuty] = useState(false);
  const [dutyBusy, setDutyBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [av, my, veh, duty] = await Promise.all([
        AmbulanceApi.driverAvailable(),
        AmbulanceApi.driverRequests(),
        AmbulanceApi.myVehicle().catch(() => null),
        AmbulanceApi.duty().catch(() => null),
      ]);
      setAvailable(av || []);
      setMine(my || []);
      setVehicle(veh);
      setOnDuty(!!duty?.is_on_duty);
    } catch (e) { setAvailable([]); }
  }, []);

  // Going on duty starts sharing the driver's location, which is what lets a
  // request reach them when it is close by but in a town they never listed.
  const toggleDuty = async (next) => {
    setDutyBusy(true);
    setOnDuty(next); // optimistic: the switch must feel instant
    try {
      await AmbulanceApi.setDuty(next);
      await load(); // the available list changes with duty — refetch it
    } catch (e) {
      setOnDuty(!next); // roll back rather than lie about the driver's state
      Alert.alert('Could not change duty status', errMessage(e));
    } finally {
      setDutyBusy(false);
    }
  };
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
    } catch (e) {
      const msg = errMessage(e);
      // The common race: someone else grabbed it a moment before this tap. Say so
      // warmly and point the driver at the refreshed list, instead of a bare error.
      const takenByOther = /another driver/i.test(msg);
      Alert.alert(
        takenByOther ? '🚑 Just taken by another driver' : 'Couldn’t accept this request',
        takenByOther
          ? 'Another nearby driver accepted this one a moment before you. Your list is refreshed — go ahead and pick another request below.'
          : msg,
      );
      await load();
    } finally { setBusyId(null); }
  };

  const advance = async (req) => {
    const next = NEXT[req.status];
    if (!next) return;
    setBusyId(req.id);
    try { await AmbulanceApi.updateStatus(req.id, next); await load(); }
    catch (e) { Alert.alert('Error', errMessage(e)); } finally { setBusyId(null); }
  };

  // Drop an accepted trip (e.g. accepted by mistake) — it re-opens for other
  // nearby drivers instead of cancelling the patient's request.
  const release = (req) => {
    Alert.alert(
      'Cancel this trip?',
      'The request will be re-opened for other nearby drivers. Do this only if you can’t make the trip.',
      [
        { text: 'Keep trip', style: 'cancel' },
        { text: 'Cancel trip', style: 'destructive', onPress: async () => {
          setBusyId(req.id);
          try { await AmbulanceApi.release(req.id); await load(); }
          catch (e) { Alert.alert('Error', errMessage(e)); } finally { setBusyId(null); }
        } },
      ],
    );
  };

  const activeTrips = mine.filter((m) => ACTIVE.includes(m.status));
  // At-a-glance driver stats from their own trip history (mine = all trips assigned
  // to this driver, any status).
  const completedCount = mine.filter((m) => m.status === 'completed').length;
  const cancelledCount = mine.filter((m) => m.status === 'cancelled').length;

  // Tapping a stat tile opens a full page listing that bucket of trips.
  const openTrips = (title, statuses, accent) => navigation.navigate('DriverTripList', { title, statuses, accent });

  // Auto-share GPS for the whole live trip. Starts at 'accepted' — the same moment
  // the patient's screen opens the tracking map — so the ambulance marker appears
  // right away instead of only once the driver taps "Start trip (on the way)".
  const trackingTrip = mine.find((m) => ['accepted', 'on_the_way', 'picked_up'].includes(m.status));
  useDriverLocationTracker(trackingTrip?.id, !!trackingTrip);

  // And while on duty, so requests near this driver find them at all.
  useDutyLocationPing(onDuty);

  if (available === null) return <Loader />;
  if (!aadhaarVerified) return <KycGate navigation={navigation} action="accept ambulance rides" accent={colors.ambulance} />;

  // Vehicle must be admin-approved before the driver can work.
  const veh = vehicle?.vehicle;
  if (!veh || veh.approval_status !== 'approved') {
    const pending = veh && veh.approval_status === 'pending';
    const rejected = veh && veh.approval_status === 'rejected';
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.gateWrap}>
          <IconBadge name="ambulance" color={colors.ambulance} size={72} iconSize={36} />
          <Text style={styles.gateTitle}>
            {!veh ? 'Register your ambulance' : pending ? 'Vehicle under review' : 'Vehicle rejected'}
          </Text>
          <Text style={styles.gateSub}>
            {!veh
              ? 'Add your vehicle details & documents. Once an admin approves them, you can start accepting rides.'
              : pending
                ? 'Your ambulance is awaiting admin approval. You’ll be able to accept rides once it’s approved.'
                : `Your ambulance was rejected. ${veh.rejection_reason || ''} Please update your details and re-submit.`.trim()}
          </Text>
          <AppButton title={veh ? 'Manage ambulance' : 'Register ambulance'} icon="ambulance" color={colors.ambulance}
            onPress={() => navigation.navigate('DriverVehicle')} style={{ marginTop: spacing.xl, alignSelf: 'stretch' }} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }} showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.ambulance} colors={[colors.ambulance]} />}>
        {/* Top row — profile picture with the KYC badge attached, and online status. */}
        <View style={styles.topRow}>
          <View style={styles.profileSection}>
            <TouchableOpacity activeOpacity={0.85} onPress={() => setPreview(true)} style={styles.avatarWrap}>
              <ProfileAvatar path={profile?.profile_image} name={user?.name} size={78} color={colors.ambulance} />
            </TouchableOpacity>
            {aadhaarVerified ? (
              <View style={[styles.statusPill, { backgroundColor: colors.ambulance }]}>
                <Icon name="check-decagram" size={13} color={colors.white} />
                <Text style={styles.verifiedText}>Verified</Text>
              </View>
            ) : null}
          </View>

        </View>

        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.hello}>Hi, {(user?.name || 'Driver').split(' ')[0]}</Text>
            <Text style={styles.role}>Ambulance Driver</Text>
            {/* The cities this driver serves — the towns their calls come from. */}
            {driverCities ? (
              <Row style={{ alignItems: 'center', marginTop: 3 }}>
                <Icon name="pin" size={13} color={colors.ambulance} />
                <Text style={styles.cities}>{driverCities}</Text>
              </Row>
            ) : null}
          </View>
        </View>

        {/* Replaces a hardcoded "Online" pill that said Online no matter what.
            This one is the real switch, and it is what decides whether a call in
            the next town can reach this driver — so it gets the room to say so. */}
        <DutyToggleCard
          onDuty={onDuty}
          busy={dutyBusy}
          onChange={toggleDuty}
          // Naming the driver's own cities makes the off-duty state unambiguous:
          // "calls from Mohali and Kharar" instead of a vague "your cities".
          cities={profile?.city}
        />

        {/* At-a-glance stats — completed trips are the number a driver cares about,
            alongside what's live right now and what fell through. Tap one to open
            that list of trips on its own page. */}
        <View style={styles.statsRow}>
          <StatTile label="Completed" value={completedCount} icon="check" color={colors.success}
            onPress={() => openTrips('Completed trips', ['completed'], colors.success)} />
          <StatTile label="Active" value={activeTrips.length} icon="ambulance" color={colors.ambulance}
            onPress={() => openTrips('Active trips', ACTIVE, colors.ambulance)} />
          <StatTile label="Cancelled" value={cancelledCount} icon="close" color={colors.danger}
            onPress={() => openTrips('Cancelled trips', ['cancelled'], colors.danger)} />
        </View>

        {activeTrips.length > 0 && (
          <>
            <Text style={styles.section}>Active trip</Text>
            {activeTrips.map((t) => (
              <Card key={t.id} style={[styles.activeCard, shadow.card]}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <Text style={styles.patient}>{t.patient_name}</Text>
                  <Pill label={statusLabel(t.status)} color={colors.ambulance} />
                </Row>
                <Row style={{ marginTop: 8 }}><Icon name="location" size={15} color={colors.textMuted} /><Muted style={{ marginLeft: 4 }}>{t.pickup_address}</Muted></Row>
                <Row style={{ marginTop: 2 }}><Icon name="hospital" size={15} color={colors.textMuted} /><Muted style={{ marginLeft: 4 }}>{t.drop_address}</Muted></Row>
                {/* User's pickup location on the map + turn-by-turn navigation. */}
                <DriverTripMap pickup={{ lat: t.pickup_latitude, lng: t.pickup_longitude }} address={t.pickup_address} />
                <Row style={{ marginTop: spacing.md }}>
                  <AppButton title="Call" icon="phone" variant="outline" color={colors.success} style={{ flex: 1, marginRight: spacing.sm }} onPress={() => Linking.openURL(`tel:${t.contact_mobile}`)} />
                  {NEXT[t.status] ? <AppButton title={NEXT_LABEL[t.status]} color={colors.ambulance} loading={busyId === t.id} style={{ flex: 1.4 }} onPress={() => advance(t)} /> : null}
                </Row>
                {RELEASABLE.includes(t.status) ? (
                  <AppButton title="Cancel trip" variant="outline" color={colors.danger}
                    loading={busyId === t.id} style={{ marginTop: spacing.sm }} onPress={() => release(t)} />
                ) : null}
              </Card>
            ))}
          </>
        )}

        <Text style={styles.section}>Nearby requests {available.length ? `(${available.length})` : ''}</Text>
        {activeTrips.length > 0 ? (
          // One ambulance carries one patient at a time — no new requests can be
          // accepted while a trip is live. Finish the current trip first.
          <EmptyState icon="ambulance" title="Finish your active trip first" subtitle="You can accept a new request once your current trip is completed or cancelled." />
        ) : available.length === 0 ? (
          <EmptyState icon="ambulance" title="No requests right now" subtitle="You'll be notified when someone nearby needs an ambulance. Pull to refresh." />
        ) : (
          available.map((r) => (
            <Card key={r.id} style={styles.reqCard}>
              {/* Header — this is a new incoming request, with the ambulance type. */}
              <Row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={styles.reqHeading}>New request</Text>
                <Pill label={r.ambulance_type} color={colors.ambulance} />
              </Row>

              {/* Every detail the driver needs, laid out in two columns so the
                  card stays short and the right half isn't left empty. */}
              <View style={styles.infoGrid}>
                <ReqInfoRow icon="user" label="Patient name" value={r.patient_name} />
                <ReqInfoRow icon="location" label="Pickup address" value={r.pickup_address} />
                <ReqInfoRow icon="hospital" label="Destination hospital" value={r.drop_address} />
                {r.city ? (
                  <ReqInfoRow icon="pin" label="Nearby city" value={r.city} />
                ) : null}
                {/* null unless the driver is on duty AND the pickup was pinned —
                    never a made-up zero. */}
                {r.distance_km != null ? (
                  <ReqInfoRow icon="map-marker-distance" label="Distance from you" value={`${r.distance_km} km away`} />
                ) : null}
              </View>

              <AppButton title="Accept request" color={colors.ambulance} loading={busyId === r.id} disabled={!!busyId} style={{ marginTop: spacing.lg }} onPress={() => accept(r)} />
            </Card>
          ))
        )}
      </ScrollView>

      <ProfilePreviewModal
        visible={preview}
        onClose={() => setPreview(false)}
        path={profile?.profile_image}
        name={user?.name}
      />
    </SafeAreaView>
  );
}

// One labelled line inside an incoming request card — a coloured icon, the
// field label (e.g. "Patient name") and its value stacked beneath it, so the
// driver can read every detail at a glance.
function ReqInfoRow({ icon, label, value }) {
  return (
    <View style={styles.infoCell}>
      <Row style={{ alignItems: 'center', marginBottom: 2 }}>
        <Icon name={icon} size={13} color={colors.textMuted} />
        <Text style={styles.infoLabel}>{label}</Text>
      </Row>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

// One compact stat tile in the driver's at-a-glance row. Tapping it opens that
// status's trips on their own page.
function StatTile({ label, value, icon, color, onPress }) {
  return (
    <TouchableOpacity style={styles.statTile} activeOpacity={0.7} onPress={onPress}>
      <View style={[styles.statIcon, { backgroundColor: color + '18' }]}>
        <Icon name={icon} size={16} color={color} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  statsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  statTile: {
    flex: 1, backgroundColor: colors.surface, borderRadius: radius.lg,
    paddingVertical: spacing.md, alignItems: 'center',
    borderWidth: 1, borderColor: colors.border + '40',
  },
  statIcon: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center', marginBottom: 6,
  },
  statValue: { fontSize: font.h2, fontWeight: font.bold, color: colors.text },
  statLabel: { fontSize: font.tiny, color: colors.textMuted, marginTop: 2, fontWeight: font.medium },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  profileSection: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  avatarWrap: { borderRadius: 43, padding: 2, backgroundColor: colors.white },
  statusPill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.sm, paddingVertical: 5, borderRadius: radius.pill, ...shadow.soft },
  verifiedText: { marginLeft: 4, color: colors.white, fontWeight: font.bold, fontSize: font.tiny },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.lg },
  hello: { fontSize: font.h2, fontWeight: font.bold, color: colors.text },
  role: { color: colors.textMuted, fontSize: font.small, marginTop: 2 },
  cities: { color: colors.ambulance, fontSize: font.small, fontWeight: font.semibold, marginLeft: 3 },
  section: { fontSize: font.h3, fontWeight: font.bold, color: colors.text, marginTop: spacing.md, marginBottom: spacing.md },
  activeCard: { borderLeftWidth: 4, borderLeftColor: colors.ambulance, marginBottom: spacing.md },
  reqCard: { marginBottom: spacing.md, borderLeftWidth: 4, borderLeftColor: colors.ambulance },
  reqHeading: { fontSize: font.body, fontWeight: font.bold, color: colors.text },
  patient: { fontSize: font.body, fontWeight: font.bold, color: colors.text },
  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: spacing.xs },
  infoCell: { width: '48%', marginTop: spacing.md },
  infoLabel: { fontSize: font.tiny, color: colors.textMuted, fontWeight: font.bold, letterSpacing: 0.3, textTransform: 'uppercase', marginLeft: 4 },
  infoValue: { fontSize: font.small, color: colors.text, fontWeight: font.semibold, lineHeight: 18 },
  gateWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  gateTitle: { fontSize: font.h2, fontWeight: font.bold, color: colors.text, marginTop: spacing.lg, textAlign: 'center' },
  gateSub: { fontSize: font.body, color: colors.textMuted, textAlign: 'center', marginTop: spacing.sm, lineHeight: 22 },
});
