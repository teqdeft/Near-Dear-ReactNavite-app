import React, { useState, useCallback } from 'react';
import { ScrollView, View, Text, StyleSheet, Alert, Linking } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { BloodApi } from '../../api';
import { errMessage } from '../../api/client';
import { Card, Pill, Muted, Row, AppButton, Loader, SectionTitle, EmptyState } from '../../components/UI';
import Icon from '../../components/Icon';
import { formatDateTime } from '../../utils/datetime';
import { colors, spacing, font } from '../../theme';

const RESP_COLOR = { accepted: colors.success, declined: colors.danger, pending: colors.warning, no_response: colors.textMuted };

export default function BloodRequestDetailScreen({ route, navigation }) {
  const { id } = route.params;
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);

  const load = useCallback(async () => {
    setErr(false);
    try { setData(await BloodApi.requestDetail(id)); } catch (e) { setErr(true); Alert.alert('Error', errMessage(e)); }
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (err && !data) return <EmptyState icon="alert" title="Couldn't load" subtitle="Please check your connection and try again." action={<AppButton title="Retry" onPress={load} />} />;
  if (!data) return <Loader />;
  const { request, matches } = data;

  const act = async (fn, confirmMsg) => {
    Alert.alert('Please confirm', confirmMsg, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Yes', onPress: async () => {
        setBusy(true);
        try { await fn(); await load(); } catch (e) { Alert.alert('Error', errMessage(e)); } finally { setBusy(false); }
      } },
    ]);
  };

  const accepted = matches.filter((m) => m.response_status === 'accepted');

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ padding: spacing.lg }}>
      <Card style={styles.head}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Text style={styles.title}>{request.patient_name}</Text>
          <Pill label={request.status} color={colors.primary} />
        </Row>
        <Row style={{ marginTop: spacing.sm }}>
          <Pill label={request.blood_group_required} color={colors.blood} />
          <Muted style={{ marginLeft: 8 }}>{request.units_required} unit(s) • {request.urgency_level}</Muted>
        </Row>
        <Row style={{ marginTop: spacing.sm }}><Icon name="hospital" size={15} color={colors.textMuted} /><Muted style={{ marginLeft: 6 }}>{request.hospital_name}</Muted></Row>
        <Row style={{ marginTop: 2 }}><Icon name="location" size={15} color={colors.textMuted} /><Muted style={{ marginLeft: 6, flex: 1 }}>{request.hospital_address}, {request.city}</Muted></Row>
        {request.required_at ? <Muted style={{ marginTop: spacing.sm }}>Needed by: {formatDateTime(request.required_at)}</Muted> : null}
        {request.created_at ? <Muted style={{ marginTop: 2 }}>Requested: {formatDateTime(request.created_at)}</Muted> : null}
      </Card>

      <SectionTitle style={{ marginTop: spacing.lg }}>Matched donors ({matches.length})</SectionTitle>
      {matches.length === 0 ? (
        <Card><Muted>No matching donors found yet. Donors are notified automatically when available.</Muted></Card>
      ) : (
        matches.map((m) => (
          <Card key={m.id} style={styles.donor}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Text style={styles.donorName}>{m.donor_name || 'Donor'}</Text>
              <Pill label={m.response_status.replace('_', ' ')} color={RESP_COLOR[m.response_status]} />
            </Row>
            <Muted style={{ marginTop: 4 }}>{m.blood_group} • {m.city}</Muted>
            {m.contact_shared && m.donor_mobile ? (
              <AppButton title={`Call ${m.donor_mobile}`} icon="phone" variant="outline" color={colors.success}
                onPress={() => Linking.openURL(`tel:${m.donor_mobile}`)} style={{ marginTop: spacing.sm }} />
            ) : (
              <Muted style={{ marginTop: 4, fontStyle: 'italic' }}>Contact shared once the donor accepts.</Muted>
            )}
          </Card>
        ))
      )}

      {['open', 'matched'].includes(request.status) && (
        <View style={{ marginTop: spacing.lg }}>
          <AppButton title="Mark as fulfilled" color={colors.success}
            loading={busy} disabled={busy} onPress={() => act(() => BloodApi.fulfillRequest(id), 'Mark this request as fulfilled?')} />
          <AppButton title="Cancel request" variant="outline" color={colors.danger} style={{ marginTop: spacing.sm }}
            loading={busy} disabled={busy} onPress={() => act(() => BloodApi.cancelRequest(id, 'Cancelled by user'), 'Cancel this request?')} />
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  head: {},
  title: { fontSize: font.h3, fontWeight: font.bold, color: colors.text },
  donor: { marginTop: spacing.md },
  donorName: { fontSize: font.body, fontWeight: font.semibold, color: colors.text },
});
