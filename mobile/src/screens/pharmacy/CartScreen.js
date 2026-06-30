import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useCart } from '../../store/CartContext';
import { Card, Pill, Muted, Row, AppButton, EmptyState } from '../../components/UI';
import { colors, spacing, font, radius } from '../../theme';

export default function CartScreen({ navigation }) {
  const { items, pharmacyName, subtotal, setQuantity, removeItem, needsPrescription } = useCart();

  if (items.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <EmptyState icon="🛒" title="Your cart is empty" subtitle="Browse medicines and add items to your cart."
          action={<AppButton title="Browse medicines" color={colors.pharmacy} onPress={() => navigation.navigate('PharmacyHome')} />} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 160 }}>
        <Muted style={{ marginBottom: spacing.md }}>🏪 Items from {pharmacyName}</Muted>
        {items.map((item) => (
          <Card key={item.pharmacy_medicine_id} style={styles.card}>
            <Row style={{ justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.name}</Text>
                {item.prescription_required ? <Pill label="Rx required" color={colors.danger} style={{ marginTop: 4 }} /> : null}
              </View>
              <TouchableOpacity onPress={() => removeItem(item.pharmacy_medicine_id)}>
                <Text style={styles.remove}>Remove</Text>
              </TouchableOpacity>
            </Row>
            <Row style={{ justifyContent: 'space-between', marginTop: spacing.md }}>
              <Row style={styles.stepper}>
                <TouchableOpacity style={styles.stepBtn} onPress={() => setQuantity(item.pharmacy_medicine_id, item.quantity - 1)}>
                  <Text style={styles.stepText}>−</Text>
                </TouchableOpacity>
                <Text style={styles.qty}>{item.quantity}</Text>
                <TouchableOpacity style={styles.stepBtn} onPress={() => setQuantity(item.pharmacy_medicine_id, item.quantity + 1)}>
                  <Text style={styles.stepText}>＋</Text>
                </TouchableOpacity>
              </Row>
              <Text style={styles.price}>₹{(item.price * item.quantity).toFixed(0)}</Text>
            </Row>
          </Card>
        ))}

        {needsPrescription && (
          <Card style={styles.rxNote}>
            <Text style={styles.rxTitle}>📄 Prescription required</Text>
            <Muted style={{ marginTop: 4 }}>You'll attach a prescription at checkout for the Rx items.</Muted>
          </Card>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Row style={{ justifyContent: 'space-between', marginBottom: spacing.sm }}>
          <Muted>Subtotal</Muted>
          <Text style={styles.subtotal}>₹{subtotal.toFixed(0)}</Text>
        </Row>
        <AppButton title="Proceed to checkout" color={colors.pharmacy} onPress={() => navigation.navigate('Checkout')} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.md },
  name: { fontSize: font.body, fontWeight: font.semibold, color: colors.text },
  remove: { color: colors.danger, fontWeight: font.medium, fontSize: font.small },
  stepper: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, overflow: 'hidden' },
  stepBtn: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  stepText: { fontSize: 20, color: colors.text, fontWeight: font.bold },
  qty: { width: 40, textAlign: 'center', fontSize: font.body, fontWeight: font.bold, color: colors.text, lineHeight: 38 },
  price: { fontSize: font.h3, fontWeight: font.bold, color: colors.pharmacy },
  rxNote: { backgroundColor: '#FDECEC' },
  rxTitle: { fontWeight: font.bold, color: colors.danger },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: colors.surface, padding: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border },
  subtotal: { fontSize: font.h3, fontWeight: font.bold, color: colors.text },
});
