import React, { useState, useEffect, useCallback } from 'react';
import { ScrollView, View, Text, StyleSheet, Alert } from 'react-native';
import { CatalogApi } from '../../api';
import { errMessage } from '../../api/client';
import { useCart } from '../../store/CartContext';
import { Card, Pill, Muted, Row, AppButton, Loader, EmptyState } from '../../components/UI';
import { colors, spacing, font } from '../../theme';

export default function MedicineDetailScreen({ route, navigation }) {
  const { id } = route.params;
  const [m, setM] = useState(null);
  const [err, setErr] = useState(false);
  const { addItem } = useCart();

  const load = useCallback(() => {
    setErr(false);
    return CatalogApi.medicineDetail(id).then(setM).catch((e) => { setErr(true); Alert.alert('Error', errMessage(e)); });
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (err && !m) return <EmptyState icon="alert" title="Couldn't load" subtitle="Please check your connection and try again." action={<AppButton title="Retry" onPress={load} />} />;
  if (!m) return <Loader />;

  const add = (goToCart) => {
    const switched = addItem({
      pharmacy_medicine_id: m.id, pharmacy_id: m.pharmacy_id, pharmacy_name: m.pharmacy_name,
      name: m.display_name, price: m.price, prescription_required: !!m.prescription_required,
    });
    if (goToCart) navigation.navigate('Cart');
    else if (switched) {
      Alert.alert('Cart cleared', `Your cart can only hold items from one pharmacy, so it was cleared. ${m.display_name} added.`);
    } else Alert.alert('Added to cart', `${m.display_name} added.`);
  };

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ padding: spacing.lg }}>
      <Card>
        <Text style={styles.name}>{m.display_name}</Text>
        {m.brand_name ? <Muted>Brand: {m.brand_name}</Muted> : null}
        <Row style={{ marginTop: spacing.sm, flexWrap: 'wrap' }}>
          {m.strength ? <Pill label={m.strength} color={colors.primary} /> : null}
          {m.form ? <Pill label={m.form} color={colors.ambulance} style={{ marginLeft: 8 }} /> : null}
          {m.prescription_required ? <Pill label="Prescription required" color={colors.danger} style={{ marginLeft: 8 }} /> : null}
        </Row>
        {m.composition ? (
          <View style={{ marginTop: spacing.md }}>
            <Text style={styles.label}>Composition</Text>
            <Muted>{m.composition}</Muted>
          </View>
        ) : null}
      </Card>

      <Card style={{ marginTop: spacing.lg }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <View>
            <Text style={styles.label}>Sold by</Text>
            <Text style={styles.pharmacy}>{m.pharmacy_name}</Text>
            <Muted>{m.pharmacy_city}</Muted>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.price}>₹{Number(m.price).toFixed(0)}</Text>
            {m.mrp ? <Muted style={{ textDecorationLine: 'line-through' }}>₹{Number(m.mrp).toFixed(0)}</Muted> : null}
            <Pill label={m.stock_status === 'in_stock' ? 'In stock' : 'Out of stock'}
              color={m.stock_status === 'in_stock' ? colors.success : colors.textMuted} style={{ marginTop: 4 }} />
          </View>
        </Row>
      </Card>

      {m.stock_status === 'in_stock' && (
        <View style={{ marginTop: spacing.lg }}>
          <AppButton title="Add to cart" color={colors.pharmacy} onPress={() => add(false)} />
          <AppButton title="Buy now" variant="outline" color={colors.pharmacy} style={{ marginTop: spacing.sm }} onPress={() => add(true)} />
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  name: { fontSize: font.h2, fontWeight: font.bold, color: colors.text },
  label: { fontSize: font.tiny, color: colors.textMuted, textTransform: 'uppercase', fontWeight: font.semibold, marginBottom: 2 },
  pharmacy: { fontSize: font.body, fontWeight: font.semibold, color: colors.text },
  price: { fontSize: font.h2, fontWeight: font.bold, color: colors.pharmacy },
});
