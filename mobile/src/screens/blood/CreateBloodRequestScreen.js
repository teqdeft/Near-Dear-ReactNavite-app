import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { BloodApi } from '../../api';
import { errMessage } from '../../api/client';
import { useAuth } from '../../store/AuthContext';
import { Screen, AppButton, TextField, SectionTitle, Chip } from '../../components/UI';
import { colors, spacing, BLOOD_GROUPS } from '../../theme';

const URGENCY = [
  { key: 'normal', label: 'Normal' },
  { key: 'urgent', label: 'Urgent' },
  { key: 'critical', label: 'Critical' },
];

export default function CreateBloodRequestScreen({ navigation }) {
  const { user } = useAuth();
  const [form, setForm] = useState({
    patient_name: '', patient_age: '', blood_group_required: null, units_required: '1',
    hospital_name: '', hospital_address: '', city: user?.city || '',
    contact_person_name: user?.name || '', contact_person_mobile: user?.mobile || '',
    urgency_level: 'urgent', notes: '',
  });
  const [loading, setLoading] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    const required = ['patient_name', 'blood_group_required', 'hospital_name', 'hospital_address', 'city', 'contact_person_name', 'contact_person_mobile'];
    for (const k of required) {
      if (!form[k]) return Alert.alert('Missing info', 'Please fill all required (*) fields.');
    }
    setLoading(true);
    try {
      const res = await BloodApi.createRequest({
        ...form,
        patient_age: form.patient_age ? Number(form.patient_age) : undefined,
        units_required: Number(form.units_required) || 1,
      });
      Alert.alert('Request created 🩸', `${res.matchedDonors} donor(s) notified nearby.`);
      navigation.replace('BloodRequestDetail', { id: res.request.id });
    } catch (e) {
      Alert.alert('Error', errMessage(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen scroll>
      <SectionTitle>Patient & blood needed</SectionTitle>
      <TextField label="Patient name *" value={form.patient_name} onChangeText={(v) => set('patient_name', v)} />
      <View style={styles.row}>
        <TextField style={{ flex: 1, marginRight: spacing.sm }} label="Age" keyboardType="number-pad" value={form.patient_age} onChangeText={(v) => set('patient_age', v)} />
        <TextField style={{ flex: 1 }} label="Units *" keyboardType="number-pad" value={form.units_required} onChangeText={(v) => set('units_required', v)} />
      </View>

      <Text style={styles.label}>Blood group required *</Text>
      <View style={styles.chips}>
        {BLOOD_GROUPS.map((g) => (
          <Chip key={g} label={g} active={form.blood_group_required === g} color={colors.blood} onPress={() => set('blood_group_required', g)} />
        ))}
      </View>

      <Text style={styles.label}>Urgency</Text>
      <View style={styles.chips}>
        {URGENCY.map((u) => (
          <Chip key={u.key} label={u.label} active={form.urgency_level === u.key} color={colors.warning} onPress={() => set('urgency_level', u.key)} />
        ))}
      </View>

      <SectionTitle style={{ marginTop: spacing.md }}>Hospital</SectionTitle>
      <TextField label="Hospital name *" value={form.hospital_name} onChangeText={(v) => set('hospital_name', v)} />
      <TextField label="Hospital address *" value={form.hospital_address} onChangeText={(v) => set('hospital_address', v)} multiline />
      <TextField label="City *" value={form.city} onChangeText={(v) => set('city', v)} />

      <SectionTitle style={{ marginTop: spacing.md }}>Contact person</SectionTitle>
      <TextField label="Name *" value={form.contact_person_name} onChangeText={(v) => set('contact_person_name', v)} />
      <TextField label="Mobile *" keyboardType="number-pad" maxLength={10} value={form.contact_person_mobile} onChangeText={(v) => set('contact_person_mobile', v)} />
      <TextField label="Notes (optional)" value={form.notes} onChangeText={(v) => set('notes', v)} multiline />

      <AppButton title="Create request & notify donors" color={colors.blood} onPress={submit} loading={loading} style={{ marginTop: spacing.sm }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.md },
  label: { fontSize: 13, color: colors.textMuted, marginBottom: 6, fontWeight: '500' },
});
