import React, { useState, useCallback } from 'react';
import { FlatList, Text, StyleSheet, Alert, Linking, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { BloodApi } from '../../api';
import { errMessage } from '../../api/client';
import { Card, Pill, Muted, Row, AppButton, EmptyState, Loader } from '../../components/UI';
import { colors, spacing, font } from '../../theme';

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
          <Muted style={{ marginTop: 4 }}>{item.hospital_name}, {item.city}</Muted>

          {item.response_status === 'pending' ? (
            <Row style={{ marginTop: spacing.md }}>
              <AppButton title="Accept" color={colors.success} loading={busyId === item.match_id}
                style={{ flex: 1, marginRight: spacing.sm }} onPress={() => respond(item.match_id, 'accept')} />
              <AppButton title="Decline" variant="outline" color={colors.danger}
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
});
