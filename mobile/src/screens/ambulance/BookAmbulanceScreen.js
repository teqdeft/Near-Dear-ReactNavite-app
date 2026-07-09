import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { AmbulanceApi } from '../../api';
import { errMessage } from '../../api/client';
import { useAuth } from '../../store/AuthContext';
import { Screen, AppButton, TextField, SectionTitle, Chip } from '../../components/UI';
import LocationPicker from '../../components/LocationPicker';
import KycGate from '../../components/KycGate';
import { colors, spacing } from '../../theme';

const TYPES = [
  { key: 'any', label: 'Any' },
  { key: 'basic', label: 'Basic' },
  { key: 'oxygen', label: 'Oxygen' },
  { key: 'icu', label: 'ICU' },
];

export default function BookAmbulanceScreen({ navigation }) {
  const { user, aadhaarVerified } = useAuth();
  const [form, setForm] = useState({
    patient_name: user?.name || '', contact_mobile: user?.mobile || '',
    pickup_address: '', drop_address: '', city: user?.city || '', ambulance_type: 'any', notes: '',
    pickup_latitude: null, pickup_longitude: null,
  });
  const [loading, setLoading] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  if (!aadhaarVerified) return <KycGate navigation={navigation} action="book an ambulance" accent={colors.ambulance} />;

  const submit = async () => {
    for (const k of ['patient_name', 'contact_mobile', 'pickup_address', 'drop_address', 'city']) {
      if (!form[k]) return Alert.alert('Missing info', 'Please fill all required (*) fields.');
    }
    setLoading(true);
    try {
      const res = await AmbulanceApi.createRequest(form);
      Alert.alert('Request sent', `Nearby drivers have been notified${res?.notifiedDrivers ? ` (${res.notifiedDrivers})` : ''}. A driver will accept and call you shortly.`);
      navigation.replace('AmbulanceDetail', { id: res.id });
    } catch (e) {
      Alert.alert('Error', errMessage(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen scroll edges={[]}>
      <SectionTitle>Patient & contact</SectionTitle>
      <TextField label="Patient name *" value={form.patient_name} onChangeText={(v) => set('patient_name', v)} />
      <TextField label="Contact mobile *" keyboardType="number-pad" maxLength={10} value={form.contact_mobile} onChangeText={(v) => set('contact_mobile', v)} />

      <SectionTitle style={{ marginTop: spacing.md }}>Trip</SectionTitle>
      <TextField label="Pickup address *" value={form.pickup_address} onChangeText={(v) => set('pickup_address', v)} multiline />
      <Text style={styles.label}>
        Pin pickup on map {form.pickup_latitude ? '✓' : '(so the driver can navigate to you)'}
      </Text>
      <LocationPicker
        value={form.pickup_latitude != null ? { latitude: Number(form.pickup_latitude), longitude: Number(form.pickup_longitude) } : null}
        onChange={(c) => setForm((f) => ({ ...f, pickup_latitude: c.latitude, pickup_longitude: c.longitude }))}
      />
      <TextField label="Drop / hospital address *" value={form.drop_address} onChangeText={(v) => set('drop_address', v)} multiline />
      <TextField label="City *" placeholder="Used to find nearby drivers" value={form.city} onChangeText={(v) => set('city', v)} />

      <Text style={styles.label}>Ambulance type</Text>
      <View style={styles.chips}>
        {TYPES.map((t) => (
          <Chip key={t.key} label={t.label} active={form.ambulance_type === t.key} color={colors.ambulance} onPress={() => set('ambulance_type', t.key)} />
        ))}
      </View>

      <TextField label="Notes (optional)" value={form.notes} onChangeText={(v) => set('notes', v)} multiline />

      <AppButton title="Request ambulance" color={colors.ambulance} onPress={submit} loading={loading} style={{ marginTop: spacing.sm }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.md },
  label: { fontSize: 13, color: colors.textMuted, marginBottom: 6, fontWeight: '500' },
});
