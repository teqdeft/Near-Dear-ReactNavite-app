import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Switch, Alert, ActivityIndicator } from 'react-native';
import { BloodApi } from '../../api';
import { errMessage } from '../../api/client';
import { useAuth } from '../../store/AuthContext';
import { Screen, AppButton, TextField, SectionTitle, Chip, Card, Muted, Row, Pill, IconBadge } from '../../components/UI';
import KycGate from '../../components/KycGate';
import { colors, spacing, font, BLOOD_GROUPS } from '../../theme';

export default function BecomeDonorScreen({ navigation }) {
  const { user, profile, aadhaarVerified } = useAuth();
  const [bloodGroup, setBloodGroup] = useState(profile?.blood_group || null);
  const [city, setCity] = useState(profile?.city || user?.city || '');
  const [pincode, setPincode] = useState('');
  const [lastDonation, setLastDonation] = useState('');
  const [available, setAvailable] = useState(true);
  const [health, setHealth] = useState(false);
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);   // fetching existing donor profile
  const [existingDonor, setExistingDonor] = useState(null);
  const [showForm, setShowForm] = useState(false);   // set once the user chooses to edit

  useEffect(() => {
    BloodApi.myDonor().then((d) => {
      if (d) {
        setExistingDonor(d);
        setBloodGroup(d.blood_group);
        setCity(d.city);
        setPincode(d.pincode || '');
        setLastDonation(d.last_donation_date || '');
        setAvailable(!!d.is_available);
        setHealth(!!d.health_declaration);
        setConsent(!!d.consent_accepted);
      } else {
        // Not a donor yet — go straight to the registration form.
        setShowForm(true);
      }
    }).catch(() => { setShowForm(true); })
      .finally(() => setChecking(false));
  }, []);

  const submit = async () => {
    if (!bloodGroup) return Alert.alert('Blood group', 'Please select your blood group.');
    if (!city.trim()) return Alert.alert('City', 'Please enter your city.');
    if (!health || !consent) return Alert.alert('Consent required', 'Please accept the health self-declaration and donor consent.');
    setLoading(true);
    try {
      await BloodApi.becomeDonor({
        blood_group: bloodGroup, city: city.trim(), pincode: pincode || undefined,
        last_donation_date: lastDonation || undefined, is_available: available,
        health_declaration: health, consent_accepted: consent,
      });
      Alert.alert('Saved ✅', 'You are now a registered donor.');
      navigation.goBack();
    } catch (e) {
      Alert.alert('Error', errMessage(e));
    } finally {
      setLoading(false);
    }
  };

  if (!aadhaarVerified) return <KycGate navigation={navigation} action="register as a blood donor" />;

  if (checking) {
    return <Screen><View style={styles.centre}><ActivityIndicator color={colors.blood} /></View></Screen>;
  }

  // Already a donor → show a confirmation screen first; the form only opens when
  // the user taps "Update your donor profile".
  if (existingDonor && !showForm) {
    return (
      <Screen>
        <Card style={styles.doneCard}>
          <IconBadge name="donor" color={colors.blood} size={82} iconSize={40} />
          <Text style={styles.doneTitle}>You're already a donor</Text>
          <Pill label={`${existingDonor.blood_group}  •  ${existingDonor.is_available ? 'Available' : 'Unavailable'}`} color={colors.blood} />
          <Muted style={{ textAlign: 'center', marginTop: spacing.md }}>
            Thank you for registering as a blood donor. You can update your details or availability anytime.
          </Muted>
          <AppButton title="Update your donor profile" color={colors.blood} onPress={() => setShowForm(true)}
            style={{ marginTop: spacing.xl, alignSelf: 'stretch' }} />
          <AppButton title="Back to home" variant="ghost" color={colors.blood} onPress={() => navigation.goBack()}
            style={{ marginTop: spacing.sm, alignSelf: 'stretch' }} />
        </Card>
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <SectionTitle>Blood group *</SectionTitle>
      <View style={styles.chips}>
        {BLOOD_GROUPS.map((g) => (
          <Chip key={g} label={g} active={bloodGroup === g} color={colors.blood} onPress={() => setBloodGroup(g)} />
        ))}
      </View>

      <TextField label="City *" value={city} onChangeText={setCity} placeholder="Your city" />
      <TextField label="Pincode (optional)" value={pincode} onChangeText={setPincode} keyboardType="number-pad" maxLength={6} />
      <TextField label="Last donation date (optional)" value={lastDonation} onChangeText={setLastDonation} placeholder="YYYY-MM-DD" />

      <Card style={{ marginVertical: spacing.sm }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Text style={styles.switchLabel}>Available for requests now</Text>
          <Switch value={available} onValueChange={setAvailable} trackColor={{ true: colors.blood }} />
        </Row>
      </Card>

      <ConsentRow value={health} onChange={setHealth}
        text="I declare I am in good health and eligible to donate blood (self-declaration)." />
      <ConsentRow value={consent} onChange={setConsent}
        text="I consent to be contacted by receivers after I accept a request." />

      <AppButton title="Save donor profile" color={colors.blood} onPress={submit} loading={loading} style={{ marginTop: spacing.md }} />
    </Screen>
  );
}

function ConsentRow({ value, onChange, text }) {
  return (
    <Row style={styles.consent}>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: colors.primary }} />
      <Muted style={{ flex: 1, marginLeft: spacing.md }}>{text}</Muted>
    </Row>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.sm },
  switchLabel: { fontSize: font.body, color: colors.text, fontWeight: font.medium },
  consent: { alignItems: 'flex-start', marginBottom: spacing.md },
  centre: { paddingVertical: spacing.xxl, alignItems: 'center' },
  doneCard: { alignItems: 'center', paddingVertical: spacing.xxl },
  doneTitle: { fontSize: font.h2, fontWeight: font.bold, color: colors.text, marginVertical: spacing.sm },
});
