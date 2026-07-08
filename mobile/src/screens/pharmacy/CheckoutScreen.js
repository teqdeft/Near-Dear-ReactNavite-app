import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import { ProfileApi, OrderApi } from '../../api';
import { errMessage } from '../../api/client';
import { useCart } from '../../store/CartContext';
import { Card, Pill, Muted, Row, AppButton, TextField, SectionTitle } from '../../components/UI';
import Icon from '../../components/Icon';
import { colors, spacing, font, radius } from '../../theme';

const PAYMENTS = [
  { key: 'cod', label: 'Cash on delivery', icon: 'cash' },
  { key: 'upi_manual', label: 'UPI (pay to pharmacy)', icon: 'cellphone' },
];

export default function CheckoutScreen({ navigation }) {
  const { items, pharmacyId, subtotal, needsPrescription, clear } = useCart();
  const [addresses, setAddresses] = useState([]);
  const [addressId, setAddressId] = useState(null);
  const [adding, setAdding] = useState(false);
  const [newAddr, setNewAddr] = useState({ name: 'Home', address_line_1: '', city: '', pincode: '' });
  const [payment, setPayment] = useState('cod');
  const [prescriptions, setPrescriptions] = useState([]);
  const [prescriptionId, setPrescriptionId] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [placing, setPlacing] = useState(false);

  const loadAddresses = useCallback(async () => {
    try {
      const list = (await ProfileApi.addresses()) || [];
      setAddresses(list);
      const def = list.find((a) => a.is_default) || list[0];
      if (def) setAddressId(def.id);
    } catch (e) { /* ignore */ }
  }, []);

  const loadPrescriptions = useCallback(async () => {
    try { setPrescriptions((await OrderApi.myPrescriptions()) || []); } catch (e) { /* ignore */ }
  }, []);

  useEffect(() => { loadAddresses(); if (needsPrescription) loadPrescriptions(); }, [loadAddresses, loadPrescriptions, needsPrescription]);

  const saveNewAddress = async () => {
    if (!newAddr.address_line_1 || !newAddr.city) return Alert.alert('Address', 'Please enter address and city.');
    try {
      const created = await ProfileApi.addAddress({ ...newAddr, address_type: 'home', is_default: addresses.length === 0 });
      setAddresses((a) => [created, ...a]);
      setAddressId(created.id);
      setAdding(false);
    } catch (e) { Alert.alert('Error', errMessage(e)); }
  };

  const uploadPrescription = async (from) => {
    const opts = { mediaType: 'photo', quality: 0.7 };
    const result = from === 'camera' ? await launchCamera(opts) : await launchImageLibrary(opts);
    if (result.didCancel) return;
    if (result.errorCode) { Alert.alert('Error', result.errorMessage || 'Could not open the camera or gallery.'); return; }
    const asset = result.assets?.[0];
    if (!asset) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', { uri: asset.uri, name: asset.fileName || 'prescription.jpg', type: asset.type || 'image/jpeg' });
      const presc = await OrderApi.uploadPrescription(form);
      setPrescriptions((p) => [presc, ...p]);
      setPrescriptionId(presc.id);
      Alert.alert('Uploaded', 'Prescription attached.');
    } catch (e) {
      Alert.alert('Upload failed', errMessage(e));
    } finally {
      setUploading(false);
    }
  };

  const choosePrescriptionSource = () => Alert.alert('Prescription photo', 'Add a photo from', [
    { text: 'Camera', onPress: () => uploadPrescription('camera') },
    { text: 'Gallery', onPress: () => uploadPrescription('gallery') },
    { text: 'Cancel', style: 'cancel' },
  ]);

  const placeOrder = async () => {
    if (!addressId) return Alert.alert('Address', 'Please select or add a delivery address.');
    if (needsPrescription && !prescriptionId) return Alert.alert('Prescription', 'This order requires a prescription. Please upload or select one.');
    setPlacing(true);
    try {
      const order = await OrderApi.place({
        pharmacy_id: pharmacyId,
        items: items.map((i) => ({ pharmacy_medicine_id: i.pharmacy_medicine_id, quantity: i.quantity })),
        delivery_address_id: addressId,
        prescription_id: prescriptionId || undefined,
        payment_method: payment,
      });
      clear();
      // Show the full-screen "Order placed" confirmation before the details.
      navigation.replace('OrderSuccess', { id: order.id });
    } catch (e) {
      Alert.alert('Could not place order', errMessage(e));
    } finally {
      setPlacing(false);
    }
  };

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}>
      <SectionTitle>Delivery address</SectionTitle>
      {addresses.map((a) => (
        <Card key={a.id} onPress={() => setAddressId(a.id)} style={[styles.opt, addressId === a.id && styles.optActive]}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Text style={styles.optTitle}>{a.name || a.address_type}</Text>
            {addressId === a.id ? <Pill label="Selected" color={colors.pharmacy} /> : null}
          </Row>
          <Muted style={{ marginTop: 2 }}>{a.address_line_1}, {a.city} {a.pincode}</Muted>
        </Card>
      ))}

      {adding ? (
        <Card style={{ marginTop: spacing.sm }}>
          <TextField label="Label" value={newAddr.name} onChangeText={(v) => setNewAddr((n) => ({ ...n, name: v }))} />
          <TextField label="Address *" value={newAddr.address_line_1} onChangeText={(v) => setNewAddr((n) => ({ ...n, address_line_1: v }))} multiline />
          <Row>
            <TextField style={{ flex: 1, marginRight: spacing.sm }} label="City *" value={newAddr.city} onChangeText={(v) => setNewAddr((n) => ({ ...n, city: v }))} />
            <TextField style={{ flex: 1 }} label="Pincode" keyboardType="number-pad" value={newAddr.pincode} onChangeText={(v) => setNewAddr((n) => ({ ...n, pincode: v }))} />
          </Row>
          <AppButton title="Save address" color={colors.pharmacy} onPress={saveNewAddress} />
        </Card>
      ) : (
        <TouchableOpacity onPress={() => setAdding(true)}><Text style={styles.link}>+ Add new address</Text></TouchableOpacity>
      )}

      {needsPrescription && (
        <>
          <SectionTitle style={{ marginTop: spacing.lg }}>Prescription</SectionTitle>
          {prescriptions.map((p) => (
            <Card key={p.id} onPress={() => setPrescriptionId(p.id)} style={[styles.opt, prescriptionId === p.id && styles.optActive]}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Text style={styles.optTitle}>Prescription #{p.id}</Text>
                {prescriptionId === p.id ? <Pill label="Selected" color={colors.pharmacy} /> : <Pill label={p.status} color={colors.textMuted} />}
              </Row>
            </Card>
          ))}
          <AppButton title={uploading ? 'Uploading…' : 'Upload prescription'} icon="upload" variant="outline" color={colors.pharmacy}
            loading={uploading} onPress={choosePrescriptionSource} style={{ marginTop: spacing.sm }} />
        </>
      )}

      <SectionTitle style={{ marginTop: spacing.lg }}>Payment</SectionTitle>
      {PAYMENTS.map((p) => (
        <Card key={p.key} onPress={() => setPayment(p.key)} style={[styles.opt, payment === p.key && styles.optActive]}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Row><Icon name={p.icon} size={20} color={colors.text} /><Text style={[styles.optTitle, { marginLeft: 8 }]}>{p.label}</Text></Row>
            {payment === p.key ? <Icon name="check" size={22} color={colors.pharmacy} /> : null}
          </Row>
        </Card>
      ))}

      <Card style={{ marginTop: spacing.lg }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Muted>Subtotal</Muted><Text style={styles.amt}>₹{subtotal.toFixed(0)}</Text>
        </Row>
        <Row style={{ justifyContent: 'space-between', marginTop: 6 }}>
          <Muted>Delivery</Muted><Text style={styles.amt}>Pharmacy decides</Text>
        </Row>
        <Row style={{ justifyContent: 'space-between', marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border }}>
          <Text style={styles.totalLabel}>Total</Text><Text style={styles.total}>₹{subtotal.toFixed(0)}</Text>
        </Row>
      </Card>

      <AppButton title="Place order" color={colors.pharmacy} loading={placing} onPress={placeOrder} style={{ marginTop: spacing.lg }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  opt: { marginBottom: spacing.sm, borderWidth: 1.5, borderColor: 'transparent' },
  optActive: { borderColor: colors.pharmacy, backgroundColor: colors.pharmacyLight },
  optTitle: { fontSize: font.body, fontWeight: font.semibold, color: colors.text },
  link: { color: colors.primary, fontWeight: font.semibold, marginTop: spacing.sm, marginBottom: spacing.sm },
  amt: { fontWeight: font.medium, color: colors.text },
  totalLabel: { fontWeight: font.bold, color: colors.text, fontSize: font.body },
  total: { fontWeight: font.bold, color: colors.pharmacy, fontSize: font.h3 },
});
