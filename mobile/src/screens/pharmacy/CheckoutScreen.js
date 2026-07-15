import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import { OrderApi } from '../../api';
import { errMessage } from '../../api/client';
import { useCart } from '../../store/CartContext';
import { useDelivery } from '../../store/DeliveryContext';
import { Card, Pill, Muted, Row, AppButton, TextField, SectionTitle, Screen } from '../../components/UI';
import LocationPicker from '../../components/LocationPicker';
import CityPicker from '../../components/CityPicker';
import Icon from '../../components/Icon';
import { cityCoords } from '../../constants/cities';
import { colors, spacing, font, radius } from '../../theme';

const PAYMENTS = [
  { key: 'cod', label: 'Cash on delivery', icon: 'cash' },
  { key: 'upi_manual', label: 'UPI (pay to pharmacy)', icon: 'cellphone' },
];

const EMPTY_ADDR = { name: 'Home', address_line_1: '', city: '', pincode: '', latitude: null, longitude: null };
const ADDR_HIT = { top: 8, bottom: 8, left: 8, right: 8 };

export default function CheckoutScreen({ navigation }) {
  const { items, pharmacyId, subtotal, needsPrescription, clear } = useCart();
  // Shared with the catalog on purpose: the backend only lets you order from a
  // pharmacy that reaches the delivery address, so if this screen had its own
  // address the user could be refused at checkout for a cart the catalog had
  // just told them was fine.
  const { addresses, addressId, setAddressId, add: addAddress, update: updateAddress, remove: removeAddress } = useDelivery();
  const [adding, setAdding] = useState(false);
  const [newAddr, setNewAddr] = useState(EMPTY_ADDR);
  // null = adding a new address; an id = editing that one.
  const [editingAddrId, setEditingAddrId] = useState(null);
  const [payment, setPayment] = useState('cod');
  const [prescriptions, setPrescriptions] = useState([]);
  const [prescriptionId, setPrescriptionId] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [placing, setPlacing] = useState(false);

  const loadPrescriptions = useCallback(async () => {
    try { setPrescriptions((await OrderApi.myPrescriptions()) || []); } catch (e) { /* ignore */ }
  }, []);

  useEffect(() => { if (needsPrescription) loadPrescriptions(); }, [loadPrescriptions, needsPrescription]);

  const resetAddrForm = () => { setNewAddr(EMPTY_ADDR); setEditingAddrId(null); setAdding(false); };

  const saveNewAddress = async () => {
    if (!newAddr.address_line_1 || !newAddr.city) return Alert.alert('Address', 'Please enter address and city.');
    try {
      if (editingAddrId) {
        await updateAddress(editingAddrId, { ...newAddr, address_type: 'home' });
      } else {
        await addAddress({ ...newAddr, address_type: 'home', is_default: addresses.length === 0 });
      }
      resetAddrForm();
    } catch (e) { Alert.alert('Error', errMessage(e)); }
  };

  // lat/lng come back from MySQL as strings — coerce so the map maths work.
  const startEditAddress = (a) => {
    setNewAddr({
      name: a.name || 'Home',
      address_line_1: a.address_line_1 || '',
      city: a.city || '',
      pincode: a.pincode || '',
      latitude: a.latitude != null ? Number(a.latitude) : null,
      longitude: a.longitude != null ? Number(a.longitude) : null,
    });
    setEditingAddrId(a.id);
    setAdding(true);
  };

  const confirmDeleteAddress = (a) => {
    Alert.alert('Delete address', `Remove "${a.name || a.address_type}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await removeAddress(a.id);
            if (editingAddrId === a.id) resetAddrForm();
          } catch (e) { Alert.alert('Error', errMessage(e)); }
        },
      },
    ]);
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
    <Screen scroll edges={[]} style={{ paddingBottom: spacing.xxl }}>
      <SectionTitle>Delivery address</SectionTitle>
      {addresses.map((a) => (
        <Card key={a.id} onPress={() => setAddressId(a.id)} style={[styles.opt, addressId === a.id && styles.optActive]}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Text style={styles.optTitle}>{a.name || a.address_type}</Text>
            {addressId === a.id ? <Pill label="Selected" color={colors.pharmacy} /> : null}
          </Row>
          <Muted style={{ marginTop: 2 }}>{a.address_line_1}, {a.city} {a.pincode}</Muted>
          <Row style={styles.cardActions}>
            <TouchableOpacity onPress={() => startEditAddress(a)} hitSlop={ADDR_HIT}>
              <Text style={styles.editLink}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => confirmDeleteAddress(a)} hitSlop={ADDR_HIT} style={{ marginLeft: spacing.lg }}>
              <Text style={styles.deleteLink}>Delete</Text>
            </TouchableOpacity>
          </Row>
        </Card>
      ))}

      {adding ? (
        <Card style={{ marginTop: spacing.sm }}>
          <TextField label="Label" value={newAddr.name} onChangeText={(v) => setNewAddr((n) => ({ ...n, name: v }))} />
          <TextField label="Address *" value={newAddr.address_line_1} onChangeText={(v) => setNewAddr((n) => ({ ...n, address_line_1: v }))} multiline />
          <CityPicker
            label="City *"
            value={newAddr.city}
            // Changing the city invalidates any pin already dropped — see DeliverToBar.
            onChange={(v) => setNewAddr((n) => ({ ...n, city: v, latitude: null, longitude: null }))}
            color={colors.pharmacy}
            hint="Pick your city and the map below jumps there."
          />
          <TextField label="Pincode" keyboardType="number-pad" maxLength={6}
            value={newAddr.pincode} onChangeText={(v) => setNewAddr((n) => ({ ...n, pincode: v }))} />

          {/* No coordinates for this town -> no map to show. The pin stays null and
              pharmacies are matched on the city name instead of distance. */}
          {cityCoords(newAddr.city) ? (
            // autoLocate off, city-centred instead — see DeliverToBar: the phone's
            // position is not the delivery point when ordering for another city.
            <LocationPicker
              autoLocate={false}
              center={cityCoords(newAddr.city)}
              label="Move the map so the pin is on the delivery point"
              value={newAddr.latitude != null ? { latitude: newAddr.latitude, longitude: newAddr.longitude } : null}
              onChange={(c) => setNewAddr((n) => ({ ...n, latitude: c.latitude, longitude: c.longitude }))}
            />
          ) : newAddr.city.trim() ? (
            <Muted style={{ marginBottom: spacing.md }}>
              We don’t have {newAddr.city.trim()} on our map yet, so there’s nothing to pin.
              Your address still works — we’ll find pharmacies in {newAddr.city.trim()} by name.
            </Muted>
          ) : null}

          <AppButton title={editingAddrId ? 'Update address' : 'Save address'} color={colors.pharmacy} onPress={saveNewAddress} />
          <AppButton title="Cancel" variant="ghost" color={colors.textMuted} onPress={resetAddrForm} style={{ marginTop: spacing.sm }} />
        </Card>
      ) : (
        <TouchableOpacity onPress={() => { setNewAddr(EMPTY_ADDR); setEditingAddrId(null); setAdding(true); }}>
          <Text style={styles.link}>+ Add new address</Text>
        </TouchableOpacity>
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
    </Screen>
  );
}

const styles = StyleSheet.create({
  opt: { marginBottom: spacing.sm, borderWidth: 1.5, borderColor: 'transparent' },
  optActive: { borderColor: colors.pharmacy, backgroundColor: colors.pharmacyLight },
  optTitle: { fontSize: font.body, fontWeight: font.semibold, color: colors.text },
  cardActions: { marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  editLink: { fontSize: font.small, fontWeight: font.semibold, color: colors.pharmacy },
  deleteLink: { fontSize: font.small, fontWeight: font.semibold, color: colors.danger },
  link: { color: colors.primary, fontWeight: font.semibold, marginTop: spacing.sm, marginBottom: spacing.sm },
  amt: { fontWeight: font.medium, color: colors.text },
  totalLabel: { fontWeight: font.bold, color: colors.text, fontSize: font.body },
  total: { fontWeight: font.bold, color: colors.pharmacy, fontSize: font.h3 },
});
