import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { ProfileApi } from '../../api';
import { errMessage } from '../../api/client';
import { useAuth } from '../../store/AuthContext';
import { Screen, AppButton, TextField, SectionTitle, Chip, Muted } from '../../components/UI';
import CityChipsInput from '../../components/CityChipsInput';
import { colors, spacing, font, BLOOD_GROUPS } from '../../theme';

export default function ProfileSetupScreen({ navigation }) {
  const { user, refreshUser, logout, isDriver } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [city, setCity] = useState('');
  const [bloodGroup, setBloodGroup] = useState(null);
  const [emergency, setEmergency] = useState('');
  const [loading, setLoading] = useState(false);

  const save = async () => {
    if (!name.trim() || !city.trim()) {
      Alert.alert('Almost there', isDriver
        ? 'Please enter your name and add at least one city you can serve.'
        : 'Please enter your name and city.');
      return;
    }
    setLoading(true);
    try {
      await ProfileApi.update({
        name: name.trim(),
        city: city.trim(),
        blood_group: bloodGroup,
        emergency_contact_mobile: emergency || undefined,
      });
      await refreshUser(); // profileComplete becomes true -> app moves to Home
    } catch (e) {
      Alert.alert('Could not save', errMessage(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen scroll>
      <Text style={styles.heading}>Tell us about you</Text>
      <Muted style={{ marginBottom: spacing.lg }}>This helps us match donors and deliver care faster.</Muted>

      <TextField label="Full name *" placeholder="Your name" value={name} onChangeText={setName} />
      {isDriver ? (
        // A driver covers an area, not a single city — list every one they serve.
        <CityChipsInput label="Service cities *" value={city} onChange={setCity} color={colors.ambulance} />
      ) : (
        <TextField label="City *" placeholder="Your city" value={city} onChangeText={setCity} />
      )}

      {!isDriver && (
        <>
          <SectionTitle style={{ marginTop: spacing.sm }}>Blood group (optional)</SectionTitle>
          <View style={styles.chips}>
            {BLOOD_GROUPS.map((g) => (
              <Chip key={g} label={g} active={bloodGroup === g} color={colors.blood} onPress={() => setBloodGroup(g === bloodGroup ? null : g)} />
            ))}
          </View>

          <TextField
            label="Emergency contact (optional)"
            placeholder="Mobile number"
            keyboardType="number-pad"
            maxLength={10}
            value={emergency}
            onChangeText={setEmergency}
            style={{ marginTop: spacing.sm }}
          />
        </>
      )}

      <AppButton title="Save & Continue" onPress={save} loading={loading} style={{ marginTop: spacing.md }} />
      <AppButton title="Log out" variant="ghost" color={colors.textMuted} onPress={logout} style={{ marginTop: spacing.sm }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { fontSize: font.h2, fontWeight: font.bold, color: colors.text, marginTop: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.md },
});
