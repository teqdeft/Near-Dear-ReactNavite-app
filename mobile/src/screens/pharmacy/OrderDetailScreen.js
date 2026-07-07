import React, { useState, useCallback } from 'react';
import { ScrollView, View, Text, StyleSheet, Alert, Linking } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { OrderApi } from '../../api';
import { errMessage } from '../../api/client';
import { useCart } from '../../store/CartContext';
import { Card, Pill, Muted, Row, AppButton, Loader, SectionTitle, EmptyState } from '../../components/UI';
import { formatDateTime } from '../../utils/datetime';
import { colors, spacing, font } from '../../theme';

const TERMINAL = ['delivered', 'cancelled', 'rejected'];

const STATUS_COLOR = {
  placed: colors.info, accepted: colors.primary, preparing: colors.primary,
  out_for_delivery: colors.warning, delivered: colors.success, rejected: colors.danger, cancelled: colors.danger,
};

export default function OrderDetailScreen({ route, navigation }) {
  const { id } = route.params;
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);
  const { replaceCart } = useCart();

  const load = useCallback(async () => {
    setErr(false);
    try { setData(await OrderApi.orderDetail(id)); } catch (e) { setErr(true); Alert.alert('Error', errMessage(e)); }
  }, [id]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (err && !data) return <EmptyState icon="alert" title="Couldn't load" subtitle="Please check your connection and try again." action={<AppButton title="Retry" onPress={load} />} />;
  if (!data) return <Loader />;
  const { order, items, history } = data;

  // Re-add this order's items to the cart (one tap to reorder the same medicines).
  // Skips items that are no longer available (removed / out of stock).
  const reorder = () => {
    const available = items.filter(
      (it) => it.pharmacy_medicine_id && it.listing_status === 'active' && it.stock_status === 'in_stock',
    );
    const skipped = items.length - available.length;
    if (available.length === 0) {
      Alert.alert('Not available', 'None of these medicines are available to order right now.');
      return;
    }
    const cartItems = available.map((it) => ({
      pharmacy_medicine_id: it.pharmacy_medicine_id,
      pharmacy_id: order.pharmacy_id,
      pharmacy_name: order.pharmacy_name,
      name: it.medicine_name_snapshot,
      price: it.price_snapshot ?? it.total_price / it.quantity,
      prescription_required: !!it.prescription_required,
      quantity: it.quantity,
    }));
    replaceCart(cartItems, order.pharmacy_id, order.pharmacy_name);
    const msg = skipped > 0
      ? `${available.length} item(s) added to cart. ${skipped} item(s) are unavailable and were skipped.`
      : 'Items added to your cart.';
    Alert.alert('Added to cart', msg, [
      { text: 'Keep browsing' },
      { text: 'View cart', onPress: () => navigation.navigate('Cart') },
    ]);
  };

  const cancel = () => {
    Alert.alert('Cancel order?', 'You can only cancel before the pharmacy accepts.', [
      { text: 'No', style: 'cancel' },
      { text: 'Yes, cancel', style: 'destructive', onPress: async () => {
        setBusy(true);
        try { await OrderApi.cancel(id, 'Cancelled by user'); await load(); } catch (e) { Alert.alert('Error', errMessage(e)); } finally { setBusy(false); }
      } },
    ]);
  };

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ padding: spacing.lg }}>
      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <Text style={styles.num}>{order.order_number}</Text>
          <Pill label={order.order_status.replace(/_/g, ' ')} color={STATUS_COLOR[order.order_status] || colors.textMuted} />
        </Row>
        <Muted style={{ marginTop: 4 }}>{order.pharmacy_name}</Muted>
        {order.created_at ? <Muted style={{ marginTop: 2 }}>Placed: {formatDateTime(order.created_at)}</Muted> : null}
        {order.delivered_at ? <Muted style={{ marginTop: 2, color: colors.success }}>Delivered: {formatDateTime(order.delivered_at)}</Muted> : null}
        {order.rejection_reason ? <Muted style={{ color: colors.danger, marginTop: 4 }}>Rejected: {order.rejection_reason}</Muted> : null}
        {order.pharmacy_mobile ? (
          <AppButton title="Call pharmacy" icon="phone" variant="outline" color={colors.primary} style={{ marginTop: spacing.md }}
            onPress={() => Linking.openURL(`tel:${order.pharmacy_mobile}`)} />
        ) : null}
      </Card>

      <SectionTitle style={{ marginTop: spacing.lg }}>Items</SectionTitle>
      <Card>
        {items.map((it, idx) => (
          <Row key={it.id} style={[styles.itemRow, idx > 0 && styles.itemBorder]}>
            <Text style={styles.itemName}>{it.medicine_name_snapshot}</Text>
            <Muted>x{it.quantity}</Muted>
            <Text style={styles.itemPrice}>₹{Number(it.total_price).toFixed(0)}</Text>
          </Row>
        ))}
        <Row style={[styles.itemRow, styles.itemBorder]}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.total}>₹{Number(order.total_amount).toFixed(0)}</Text>
        </Row>
      </Card>

      <SectionTitle style={{ marginTop: spacing.lg }}>Order timeline</SectionTitle>
      <Card>
        {history.map((h, idx) => (
          <Row key={h.id} style={[styles.histRow, idx > 0 && styles.itemBorder]}>
            <View style={styles.histDot} />
            <View style={{ flex: 1 }}>
              <Text style={styles.histStatus}>{h.status.replace(/_/g, ' ')}</Text>
              {h.note ? <Muted style={{ marginTop: 2 }}>{h.note}</Muted> : null}
            </View>
            {h.created_at ? <Muted style={{ marginLeft: 8 }}>{formatDateTime(h.created_at)}</Muted> : null}
          </Row>
        ))}
      </Card>

      {order.order_status === 'placed' && (
        <AppButton title="Cancel order" variant="outline" color={colors.danger} loading={busy}
          style={{ marginTop: spacing.lg }} onPress={cancel} />
      )}

      {TERMINAL.includes(order.order_status) && (
        <AppButton title="Order again" icon="cart" color={colors.pharmacy}
          style={{ marginTop: spacing.lg }} onPress={reorder} />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  num: { fontSize: font.h3, fontWeight: font.bold, color: colors.text },
  itemRow: { justifyContent: 'space-between', paddingVertical: spacing.sm },
  itemBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  itemName: { flex: 1, color: colors.text, fontSize: font.body },
  itemPrice: { width: 70, textAlign: 'right', color: colors.text, fontWeight: font.semibold },
  totalLabel: { flex: 1, fontWeight: font.bold, color: colors.text },
  total: { fontWeight: font.bold, color: colors.pharmacy, fontSize: font.h3 },
  histRow: { paddingVertical: spacing.sm, alignItems: 'center' },
  histDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary, marginRight: spacing.sm },
  histStatus: { color: colors.text, fontWeight: font.medium, textTransform: 'capitalize' },
});
