import React, { useState, useMemo } from 'react';
import { View, Text, TextInput, StyleSheet, Platform } from 'react-native';
import Icon from './Icon';
import CitySuggestList from './CitySuggestList';
import { suggestCities, isKnownCity } from '../constants/cities';
import { colors, spacing, font, radius } from '../theme';

/**
 * Single-city autocomplete (blood request: the one city the hospital is in).
 *
 * Matching runs on the city name, so a typo silently reaches nobody. Suggestions
 * steer people onto a consistent spelling. A city outside the list is normal —
 * the list is far from exhaustive — so it is accepted without complaint; we only
 * nudge the user to re-read what they typed.
 */
export default function CityPicker({
  label,
  value,
  onChange,
  placeholder = 'Start typing a city…',
  color = colors.primary,
  hint,
  style,
}) {
  // Suggestions only after the user types — not while showing a prefilled value.
  const [touched, setTouched] = useState(false);
  const query = (value || '').trim();
  const known = isKnownCity(query);

  // Picking a suggestion makes the value an exact city, which closes the list —
  // so there's no blur/press race to handle here.
  const suggestions = useMemo(
    () => (touched && query && !known ? suggestCities(query) : []),
    [touched, query, known]
  );

  const change = (text) => { setTouched(true); onChange(text); };

  return (
    <View style={[{ marginBottom: spacing.md }, style]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}

      <View style={[styles.inputWrap, known && { borderColor: color }]}>
        <Icon name="location" size={19} color={known ? color : colors.textMuted} style={styles.leftIcon} />
        <TextInput
          value={value}
          onChangeText={change}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          autoCorrect={false}
          style={styles.input}
        />
        {known ? <Icon name="check" size={18} color={color} /> : null}
      </View>

      <CitySuggestList suggestions={suggestions} onSelect={(c) => onChange(c)} color={color} />

      {/* A city outside our list is perfectly valid — plenty of towns aren't in
          it. Just nudge on spelling, since that's what matching turns on. */}
      {query && !known ? (
        <Text style={styles.hint}>Please double-check the city.</Text>
      ) : hint ? (
        <Text style={styles.hint}>{hint}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: font.small, color: colors.text, marginBottom: 7, fontWeight: font.semibold },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    paddingHorizontal: spacing.md, height: 52,
  },
  leftIcon: { marginRight: 8 },
  input: { flex: 1, fontSize: font.body, color: colors.text, ...(Platform.OS === 'android' ? { paddingVertical: 8 } : {}) },
  hint: { fontSize: font.tiny, color: colors.textMuted, marginTop: 6 },
});
