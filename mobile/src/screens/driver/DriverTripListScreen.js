import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, Linking } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { AmbulanceApi } from '../../api';
import { Card, Pill, Muted, Row, AppButton, EmptyState, Loader } from '../../components/UI';
import Icon from '../../components/Icon';
import { formatDateTime } from '../../utils/datetime';
import { statusLabel } from '../../utils/status';
import { colors, spacing, font } from '../../theme';

const STATUS_COLOR = {
  accepted: colors.info, on_the_way: colors.primary, picked_up: colors.primary,
  completed: colors.success, cancelled: colors.danger,
};

const ACTIVE_STATUSES = ['accepted', 'on_the_way', 'picked_up'];

/**
 * A full page listing the driver's trips filtered to one bucket (completed /
 * active / cancelled). Opened from the stat tiles on the dashboard; the title and
 * which statuses to show come in via route params. Tapping a trip opens its detail.
 */
export default function DriverTripListScreen({ route, navigation }) {
  const { statuses = [], accent = colors.ambulance } = route.params || {};
  const statusKey = statuses.join(',');
  const [items, setItems] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const all = (await AmbulanceApi.driverRequests()) || [];
      setItems(all.filter((t) => statuses.includes(t.status)));
    } catch (e) { setItems([]); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusKey]);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  if (items === null) return <Loader />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <FlatList
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40, flexGrow: 1 }}
        data={items}
        keyExtractor={(i) => String(i.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={accent} colors={[accent]} />}
        ListHeaderComponent={
          items.length ? (
            <Text style={styles.count}>{items.length} {items.length === 1 ? 'trip' : 'trips'}</Text>
          ) : null
        }
        ListEmptyComponent={<EmptyState icon="ambulance" title="Nothing here yet" subtitle="Trips will show up here as they happen." />}
        renderItem={({ item }) => (
          <Card style={styles.card} onPress={() => navigation.navigate('DriverTripDetail', { trip: item })}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Text style={styles.patient}>{item.patient_name}</Text>
              <Pill label={statusLabel(item.status)} color={STATUS_COLOR[item.status] || colors.textMuted} />
            </Row>
            <Row style={{ marginTop: 6 }}><Icon name="location" size={14} color={colors.textMuted} /><Muted style={{ marginLeft: 4, flex: 1 }}>{item.pickup_address}</Muted></Row>
            <Row style={{ marginTop: 2 }}><Icon name="hospital" size={14} color={colors.textMuted} /><Muted style={{ marginLeft: 4, flex: 1 }}>{item.drop_address}</Muted></Row>
            {item.created_at ? <Muted style={{ marginTop: 4 }}>{formatDateTime(item.created_at)}</Muted> : null}
            {ACTIVE_STATUSES.includes(item.status) && item.contact_mobile ? (
              <AppButton title={`Call ${item.contact_mobile}`} icon="phone" variant="outline" color={colors.success}
                style={{ marginTop: spacing.sm }} onPress={() => Linking.openURL(`tel:${item.contact_mobile}`)} />
            ) : null}
            <Row style={{ marginTop: 8, alignItems: 'center' }}>
              <Icon name="next" size={15} color={colors.ambulance} />
              <Text style={styles.viewHint}>Tap for full details</Text>
            </Row>
          </Card>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  count: { color: colors.textMuted, fontSize: font.small, fontWeight: font.medium, marginBottom: spacing.md },
  card: { marginBottom: spacing.md },
  patient: { fontSize: font.body, fontWeight: font.bold, color: colors.text },
  viewHint: { color: colors.ambulance, fontWeight: font.semibold, fontSize: font.tiny, marginLeft: 4 },
});
