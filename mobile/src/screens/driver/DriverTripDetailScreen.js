import React from 'react';
import { ScrollView, View, Text, StyleSheet, Linking } from 'react-native';
import { Card, Pill, Muted, Row, AppButton, SectionTitle } from '../../components/UI';
import Icon from '../../components/Icon';
import { formatDateTime } from '../../utils/datetime';
import { statusLabel } from '../../utils/status';
import { colors, spacing, font } from '../../theme';

const STATUS_COLOR = {
  requested: colors.info, assigned: colors.info, accepted: colors.primary,
  on_the_way: colors.primary, picked_up: colors.primary,
  completed: colors.success, cancelled: colors.danger,
};

// Read-only progress of the trip's stages.
const FLOW = ['requested', 'assigned', 'accepted', 'on_the_way', 'picked_up', 'completed'];
const LABELS = {
  requested: 'Request received', assigned: 'Ambulance assigned', accepted: 'Trip accepted',
  on_the_way: 'On the way to pickup', picked_up: 'Patient picked up', completed: 'Trip completed',
};
// The field on the trip that holds WHEN each stage happened, so the timeline can
// show a real time next to every step. ('requested' is the trip's created_at.)
const STAGE_AT = {
  requested: 'created_at', assigned: 'assigned_at', accepted: 'accepted_at',
  on_the_way: 'on_the_way_at', picked_up: 'picked_up_at', completed: 'completed_at',
};

export default function DriverTripDetailScreen({ route }) {
  const trip = route.params?.trip || {};
  const status = trip.status;
  const cancelled = status === 'cancelled';
  const completed = status === 'completed';
  const currentIdx = FLOW.indexOf(status);

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ padding: spacing.lg }}>
      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <Text style={styles.title}>{trip.patient_name}</Text>
          <Pill label={statusLabel(status)} color={STATUS_COLOR[status] || colors.textMuted} />
        </Row>
        <Row style={{ marginTop: spacing.sm }}>
          <Icon name="user" size={15} color={colors.textMuted} />
          <Muted style={{ marginLeft: 6 }}>Patient: {trip.patient_name}</Muted>
        </Row>
        {trip.contact_mobile ? (
          <Row style={{ marginTop: 4 }}>
            <Icon name="phone" size={15} color={colors.textMuted} />
            <Muted style={{ marginLeft: 6 }}>Contact: {trip.contact_mobile}</Muted>
          </Row>
        ) : null}
        <Pill label={`Type: ${statusLabel(trip.ambulance_type)}`} color={colors.ambulance} style={{ marginTop: spacing.sm }} />
        {trip.contact_mobile ? (
          <AppButton title={`Call ${trip.contact_mobile}`} icon="phone" variant="outline" color={colors.success}
            style={{ marginTop: spacing.md }} onPress={() => Linking.openURL(`tel:${trip.contact_mobile}`)} />
        ) : null}
      </Card>

      <SectionTitle style={{ marginTop: spacing.lg }}>Trip route</SectionTitle>
      <Card>
        <Row style={{ alignItems: 'flex-start' }}>
          <Icon name="location" size={16} color={colors.ambulance} />
          <View style={{ flex: 1, marginLeft: 8 }}>
            <Text style={styles.routeLabel}>Pickup (from)</Text>
            <Muted>{trip.pickup_address}</Muted>
          </View>
        </Row>
        <Row style={{ alignItems: 'flex-start', marginTop: spacing.md }}>
          <Icon name="hospital" size={16} color={colors.danger} />
          <View style={{ flex: 1, marginLeft: 8 }}>
            <Text style={styles.routeLabel}>Drop (hospital)</Text>
            <Muted>{trip.drop_address}</Muted>
          </View>
        </Row>
        {trip.city ? <Muted style={{ marginTop: spacing.md }}>City: {trip.city}</Muted> : null}
        {trip.notes ? <Muted style={{ marginTop: 4 }}>Notes: {trip.notes}</Muted> : null}
      </Card>

      <SectionTitle style={{ marginTop: spacing.lg }}>Timing</SectionTitle>
      <Card>
        {trip.created_at ? <Muted>Requested: {formatDateTime(trip.created_at)}</Muted> : null}
        {trip.updated_at ? (
          <Muted style={{ marginTop: 4, color: completed ? colors.success : colors.textMuted }}>
            {completed ? 'Completed' : cancelled ? 'Cancelled' : 'Last updated'}: {formatDateTime(trip.updated_at)}
          </Muted>
        ) : null}
      </Card>

      {!cancelled && (
        <>
          <SectionTitle style={{ marginTop: spacing.lg }}>Status</SectionTitle>
          <Card>
            {FLOW.map((step, i) => {
              const done = i <= currentIdx;
              const active = i === currentIdx;
              const at = trip[STAGE_AT[step]];
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
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: font.h3, fontWeight: font.bold, color: colors.text },
  routeLabel: { fontSize: font.small, fontWeight: font.semibold, color: colors.text },
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
