import React, { useState, useCallback } from 'react';
import { FlatList, Text, StyleSheet, View, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { BloodApi } from '../../api';
import { Card, Pill, Muted, Row, EmptyState, Loader, AppButton } from '../../components/UI';
import { colors, spacing, font } from '../../theme';

const STATUS_COLOR = {
  open: colors.info, matched: colors.primary, fulfilled: colors.success,
  expired: colors.textMuted, cancelled: colors.danger,
};

export default function MyBloodRequestsScreen({ navigation }) {
  const [items, setItems] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await BloodApi.myRequests();
      setItems(data || []);
    } catch (e) {
      setItems([]);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  if (items === null) return <Loader />;

  return (
    <FlatList
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: spacing.lg, flexGrow: 1 }}
      data={items}
      keyExtractor={(i) => String(i.id)}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      ListEmptyComponent={
        <EmptyState icon="blood" title="No blood requests yet"
          subtitle="Create a request to find matching donors."
          action={<AppButton title="Request blood" color={colors.blood} onPress={() => navigation.navigate('CreateBloodRequest')} />} />
      }
      renderItem={({ item }) => (
        <Card onPress={() => navigation.navigate('BloodRequestDetail', { id: item.id })} style={styles.card}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Text style={styles.patient}>{item.patient_name}</Text>
            <Pill label={item.status} color={STATUS_COLOR[item.status] || colors.textMuted} />
          </Row>
          <Row style={{ marginTop: 8 }}>
            <Pill label={item.blood_group_required} color={colors.blood} />
            <Muted style={{ marginLeft: 8 }}>{item.units_required} unit(s) • {item.hospital_name}</Muted>
          </Row>
          <Muted style={{ marginTop: 4 }}>{item.city} • urgency: {item.urgency_level}</Muted>
        </Card>
      )}
    />
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.md },
  patient: { fontSize: font.body, fontWeight: font.bold, color: colors.text },
});
