import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { BloodApi } from '../../api';
import { errMessage } from '../../api/client';
import { useAuth } from '../../store/AuthContext';
import { Screen, AppButton, TextField, SectionTitle, Chip, Muted, Row } from '../../components/UI';
import Icon from '../../components/Icon';
import KycGate from '../../components/KycGate';
import CityPicker from '../../components/CityPicker';
import { parseCities } from '../../components/CityChipsInput';
import { colors, spacing, radius, BLOOD_GROUPS } from '../../theme';

const URGENCY = [
  { key: 'normal', label: 'Normal' },
  { key: 'urgent', label: 'Urgent' },
  { key: 'critical', label: 'Critical' },
];

export default function CreateBloodRequestScreen({ navigation }) {
  const { user, profile, aadhaarVerified } = useAuth();
  const [form, setForm] = useState({
    patient_name: '', patient_age: '', blood_group_required: null, units_required: '1',
    // A request names one hospital in one city, so seed it with the first city on
    // the profile (a donor's profile may list several) — the user can change it.
    hospital_name: '', hospital_address: '', city: parseCities(profile?.city)[0] || '',
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
      Alert.alert('Request created', `${res.matchedDonors} donor(s) notified nearby.`);
      navigation.replace('BloodRequestDetail', { id: res.request.id });
    } catch (e) {
      Alert.alert('Error', errMessage(e));
    } finally {
      setLoading(false);
    }
  };

  if (!aadhaarVerified) return <KycGate navigation={navigation} action="request blood" />;

  return (
    <Screen scroll edges={[]}>
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

      {/* Donors are matched on city alone, so this is the field that decides who
          gets notified — call that out instead of leaving it as a plain "City". */}
      <CityPicker
        label="City where blood is needed *"
        value={form.city}
        onChange={(v) => set('city', v)}
        color={colors.blood}
        style={styles.cityField}
      />
      <Row style={styles.cityNote}>
        <Icon name="donor" size={16} color={colors.blood} />
        <Muted style={styles.cityNoteText}>
          This is how we find donors. Every available donor who covers this city is
          notified — so enter the hospital's city, not the patient's home town.
        </Muted>
      </Row>

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
  cityField: { marginBottom: spacing.sm },
  cityNote: {
    alignItems: 'flex-start', backgroundColor: colors.blood + '12', borderRadius: radius.md,
    padding: spacing.md, marginBottom: spacing.md,
  },
  cityNoteText: { flex: 1, marginLeft: spacing.sm, lineHeight: 18 },
});
