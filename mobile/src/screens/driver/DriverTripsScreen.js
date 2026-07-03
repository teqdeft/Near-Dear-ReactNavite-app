import React, { useState, useCallback } from 'react';
import { FlatList, Text, StyleSheet, RefreshControl, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { AmbulanceApi } from '../../api';
import { Card, Pill, Muted, Row, AppButton, EmptyState, Loader } from '../../components/UI';
import { formatDateTime } from '../../utils/datetime';
import { colors, spacing, font } from '../../theme';

const STATUS_COLOR = {
  accepted: colors.info, on_the_way: colors.primary, picked_up: colors.primary,
  completed: colors.success, cancelled: colors.danger,
};

export default function DriverTripsScreen() {
  const [items, setItems] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try { setItems((await AmbulanceApi.driverRequests()) || []); } catch (e) { setItems([]); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  if (items === null) return <Loader />;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <Text style={styles.header}>My Trips</Text>
      <FlatList
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120, flexGrow: 1 }}
        data={items}
        keyExtractor={(i) => String(i.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={<EmptyState icon="ambulance" title="No trips yet" subtitle="Accepted requests show up here." />}
        renderItem={({ item }) => (
          <Card style={styles.card}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Text style={styles.patient}>{item.patient_name}</Text>
              <Pill label={item.status.replace(/_/g, ' ')} color={STATUS_COLOR[item.status] || colors.textMuted} />
            </Row>
            <Muted style={{ marginTop: 6 }}>{item.pickup_address}</Muted>
            <Muted>{item.drop_address}</Muted>
            {item.created_at ? <Muted style={{ marginTop: 4 }}>Requested: {formatDateTime(item.created_at)}</Muted> : null}
            {['accepted', 'on_the_way', 'picked_up'].includes(item.status) && (
              <AppButton title={`Call ${item.contact_mobile}`} icon="phone" variant="outline" color={colors.success}
                style={{ marginTop: spacing.sm }} onPress={() => Linking.openURL(`tel:${item.contact_mobile}`)} />
            )}
          </Card>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { fontSize: font.h2, fontWeight: font.bold, color: colors.text, paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  card: { marginBottom: spacing.md },
  patient: { fontSize: font.body, fontWeight: font.bold, color: colors.text },
});
