/**
 * Speak-to-book: the caller describes the emergency in one sentence and the
 * form fills itself.
 *
 * There is no speech library here on purpose. Android's keyboard already has a
 * microphone, so tapping the box and holding the keyboard's mic dictates into
 * it — that costs no dependency, works on every phone, and keeps this feature
 * to a file you can delete.
 *
 * The AI only pre-fills. The caller still reviews every field and presses the
 * booking button themselves — a wrong hospital read out of a panicked sentence
 * must not become a dispatched ambulance.
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert, ActivityIndicator, Platform, PermissionsAndroid } from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import { AiApi } from '../api/ai';
import { errMessage } from '../api/client';
import { TextField, AppButton, Muted } from './UI';
import { colors, spacing } from '../theme';

const EXAMPLE = 'Papa ko saans nahi aa raha, main Sector 22 Gurgaon mein hoon, City Hospital le jaana hai, naam Ramesh Kumar';

const FIELD_LABELS = { city: 'City' };

/**
 * The caller is standing at the pickup point, so their GPS *is* the pickup pin —
 * dropping it for them is one less thing to do during an emergency. Best-effort:
 * a denied permission or a cold GPS fix resolves to null and the map pin simply
 * stays unset, exactly as it would have without this feature.
 */
async function currentCoords() {
  if (Platform.OS === 'android') {
    try {
      const res = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        {
          title: 'Use your location',
          message: 'NearDear pins your pickup point so the driver can reach you.',
          buttonPositive: 'Allow',
          buttonNegative: 'Deny',
        },
      );
      if (res !== PermissionsAndroid.RESULTS.GRANTED) return null;
    } catch {
      return null;
    }
  }
  return new Promise((resolve) => {
    Geolocation.getCurrentPosition(
      (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  });
}

export default function VoiceBookingCard({ onParsed }) {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);

  const fill = async () => {
    const transcript = text.trim();
    if (!transcript) return;

    setLoading(true);
    try {
      // The GPS fix and the AI call are independent — run them together so the
      // caller waits for the slower one, not for both.
      const [res, coords] = await Promise.all([
        AiApi.parseAmbulance(transcript),
        currentCoords(),
      ]);

      const fields = { ...(res?.fields || {}) };
      const inferred = res?.inferred || [];
      const count = Object.keys(fields).length;

      if (coords) {
        fields.pickup_latitude = coords.latitude;
        fields.pickup_longitude = coords.longitude;
      }

      if (!count && !coords) {
        Alert.alert(
          'Could not understand',
          'Please fill the form below yourself — it will be just as fast.',
        );
        return;
      }

      onParsed(fields);

      const lines = [`Filled ${count} field${count === 1 ? '' : 's'}.`];
      if (coords) lines.push('Pickup pinned to your current location.');
      if (inferred.length) {
        const guessed = inferred.map((k) => `${FIELD_LABELS[k] || k} (${fields[k]})`).join(', ');
        lines.push(`You did not say the ${guessed} — we worked it out. Please check it.`);
      }
      lines.push('Review everything before booking.');

      Alert.alert('Form filled', lines.join('\n\n'));
    } catch (e) {
      // Never block the booking on the AI. The form below still works.
      Alert.alert('AI unavailable', `${errMessage(e)}\n\nPlease fill the form below instead.`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>🎤 Speak or type what happened</Text>
      <Muted style={{ marginBottom: spacing.sm }}>
        Tap the box, then press the mic on your keyboard and speak. We will fill the form for you.
      </Muted>

      <TextField
        placeholder={EXAMPLE}
        value={text}
        onChangeText={setText}
        multiline
        numberOfLines={3}
        inputStyle={styles.input}
      />

      <AppButton
        title={loading ? 'Reading...' : 'Fill the form'}
        color={colors.ambulance}
        onPress={fill}
        loading={loading}
        disabled={loading || !text.trim()}
      />

      {loading ? (
        <View style={styles.row}>
          <ActivityIndicator size="small" color={colors.ambulance} />
          <Muted style={{ marginLeft: 8 }}>Understanding what you said…</Muted>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 4 },
  input: { minHeight: 72, textAlignVertical: 'top' },
  row: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm },
});
