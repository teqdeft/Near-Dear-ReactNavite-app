import React, { useState, useCallback } from 'react';
import { FlatList, View, Text, StyleSheet, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { OrderApi } from '../../api';
import { Card, Pill, Muted, Row, EmptyState, Loader, AppButton } from '../../components/UI';
import { colors, spacing, font } from '../../theme';

const STATUS_COLOR = {
  placed: colors.info, accepted: colors.primary, preparing: colors.primary,
  out_for_delivery: colors.warning, delivered: colors.success, rejected: colors.danger, cancelled: colors.danger,
};

export default function OrdersScreen({ navigation }) {
  const [items, setItems] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try { setItems((await OrderApi.myOrders()) || []); } catch (e) { setItems([]); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <Text style={styles.header}>My Orders</Text>
      {items === null ? <Loader /> : (
        <FlatList
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120, flexGrow: 1 }}
          data={items}
          keyExtractor={(i) => String(i.id)}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <EmptyState icon="orders" title="No orders yet" subtitle="Your medicine orders will appear here."
              action={<AppButton title="Order medicines" color={colors.pharmacy} onPress={() => navigation.navigate('PharmacyHome')} />} />
          }
          renderItem={({ item }) => (
            <Card onPress={() => navigation.navigate('OrderDetail', { id: item.id })} style={styles.card}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Text style={styles.num}>{item.order_number}</Text>
                <Pill label={item.order_status.replace(/_/g, ' ')} color={STATUS_COLOR[item.order_status] || colors.textMuted} />
              </Row>
              <Muted style={{ marginTop: 4 }}>{item.pharmacy_name}</Muted>
              <Row style={{ justifyContent: 'space-between', marginTop: 6 }}>
                <Muted>{item.payment_method?.toUpperCase()}</Muted>
                <Text style={styles.total}>₹{Number(item.total_amount).toFixed(0)}</Text>
              </Row>
            </Card>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { fontSize: font.h2, fontWeight: font.bold, color: colors.text, paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  card: { marginBottom: spacing.md },
  num: { fontSize: font.body, fontWeight: font.bold, color: colors.text },
  total: { fontSize: font.h3, fontWeight: font.bold, color: colors.pharmacy },
});
