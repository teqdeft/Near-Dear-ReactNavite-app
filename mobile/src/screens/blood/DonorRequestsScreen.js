import React, { useState, useCallback } from 'react';
import { FlatList, View, Text, StyleSheet, Alert, Linking, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { BloodApi } from '../../api';
import { errMessage } from '../../api/client';
import { Card, Pill, Muted, Row, AppButton, EmptyState, Loader } from '../../components/UI';
import Icon from '../../components/Icon';
import { formatDateTime } from '../../utils/datetime';
import { colors, spacing, font } from '../../theme';

const CLOSED_STATUSES = ['fulfilled', 'cancelled', 'expired'];

export default function DonorRequestsScreen() {
  const [items, setItems] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    try { setItems((await BloodApi.incomingRequests()) || []); } catch (e) { setItems([]); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const respond = async (matchId, action) => {
    setBusyId(matchId);
    try {
      const res = await BloodApi.respondToMatch(matchId, action);
      if (action === 'accept') {
        Alert.alert('Accepted ❤️', 'Contact details are now shared. Thank you for helping!');
      }
      await load();
    } catch (e) {
      Alert.alert('Error', errMessage(e));
    } finally {
      setBusyId(null);
    }
  };

  if (items === null) return <Loader />;

  return (
    <FlatList
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: spacing.lg, flexGrow: 1 }}
      data={items}
      keyExtractor={(i) => String(i.match_id)}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      ListEmptyComponent={<EmptyState icon="bell" title="No requests for you yet"
        subtitle="When someone nearby needs your blood group, it'll appear here." />}
      renderItem={({ item }) => (
        <Card style={styles.card}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Text style={styles.patient}>{item.patient_name}</Text>
            <Pill label={item.urgency_level} color={colors.warning} />
          </Row>
          <Row style={{ marginTop: 8 }}>
            <Pill label={item.blood_group_required} color={colors.blood} />
            <Muted style={{ marginLeft: 8 }}>{item.units_required} unit(s)</Muted>
          </Row>
          {/* Where to go — the donor's most important detail, so it's called
              out in its own block with the hospital name and full address. */}
          <View style={styles.locBox}>
            <Text style={styles.locLabel}>WHERE TO DONATE</Text>
            <Row style={{ marginTop: 4 }}>
              <Icon name="hospital" size={17} color={colors.blood} />
              <Text style={styles.hospital}>{item.hospital_name}</Text>
            </Row>
            {(item.hospital_address || item.city) ? (
              <Row style={{ marginTop: 4, alignItems: 'flex-start' }}>
                <Icon name="location" size={15} color={colors.textMuted} style={{ marginTop: 2 }} />
                <Muted style={styles.addr}>{[item.hospital_address, item.city].filter(Boolean).join(', ')}</Muted>
              </Row>
            ) : null}
          </View>
          {item.required_at ? <Muted style={{ marginTop: spacing.sm }}>Needed by: {formatDateTime(item.required_at)}</Muted> : null}
          {item.created_at ? <Muted style={{ marginTop: 2 }}>Requested: {formatDateTime(item.created_at)}</Muted> : null}

          {CLOSED_STATUSES.includes(item.status) ? (
            <Pill
              label={item.status === 'fulfilled' ? 'Fulfilled ❤️' : `Request ${item.status}`}
              color={item.status === 'fulfilled' ? colors.success : colors.textMuted}
              style={{ marginTop: spacing.md }} />
          ) : item.response_status === 'pending' ? (
            <Row style={{ marginTop: spacing.md }}>
              <AppButton title="Accept" color={colors.success} loading={busyId === item.match_id} disabled={busyId === item.match_id}
                style={{ flex: 1, marginRight: spacing.sm }} onPress={() => respond(item.match_id, 'accept')} />
              <AppButton title="Decline" variant="outline" color={colors.danger} loading={busyId === item.match_id} disabled={busyId === item.match_id}
                style={{ flex: 1 }} onPress={() => respond(item.match_id, 'decline')} />
            </Row>
          ) : item.contact_shared && item.contact_person_mobile ? (
            <AppButton title={`Call ${item.contact_person_name} • ${item.contact_person_mobile}`} icon="phone" variant="outline" color={colors.success}
              style={{ marginTop: spacing.md }} onPress={() => Linking.openURL(`tel:${item.contact_person_mobile}`)} />
          ) : (
            <Pill label={item.response_status} color={colors.textMuted} style={{ marginTop: spacing.md }} />
          )}
        </Card>
      )}
    />
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.md },
  patient: { fontSize: font.body, fontWeight: font.bold, color: colors.text },
  locBox: {
    marginTop: spacing.md, backgroundColor: colors.bg, borderRadius: 10,
    padding: spacing.md, borderWidth: 1, borderColor: colors.border,
  },
  locLabel: { fontSize: font.tiny, fontWeight: font.bold, color: colors.textMuted, letterSpacing: 0.5 },
  hospital: { marginLeft: 6, flex: 1, fontSize: font.body, fontWeight: font.bold, color: colors.text },
  addr: { marginLeft: 6, flex: 1 },
});
