import React, { useState, useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import Icon from './Icon';
import CitySuggestList from './CitySuggestList';
import { useKeyboardAwareFocus } from './UI';
import { suggestCities } from '../constants/cities';
import { colors, spacing, font, radius } from '../theme';

// The API stores the cities as one comma-separated string (see
// backend/src/utils/cityMatch.js) — these convert between that and the chip list.
export function parseCities(value) {
  if (Array.isArray(value)) return value;
  return String(value || '')
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean);
}

export function formatCities(cities) {
  return cities.join(', ');
}

const MAX_CITIES = 8;

/**
 * Multi-city picker for ambulance drivers: type a city, tap Add (or the
 * keyboard's return key), and it becomes a removable chip. A driver serves a
 * whole area — Mohali, Kharar, Chandigarh — and gets requests from any of them.
 *
 * `value` / `onChange` speak the comma-separated string the profile API uses,
 * so this drops into the same slot as a plain TextField.
 */
export default function CityChipsInput({
  value,
  onChange,
  label = 'Service cities',
  placeholder = 'e.g. Mohali',
  color = colors.primary,
  max = MAX_CITIES,
  hint = "Add every city you can reach — you'll get requests from all of them.",
  style,
}) {
  const cities = parseCities(value);
  const [draft, setDraft] = useState('');
  const { inputRef, onFocus } = useKeyboardAwareFocus();
  const full = cities.length >= max;

  // Suggest canonical spellings, minus the ones already added. Matching is by
  // city name, so "Mohaali" would quietly reach nobody. Keyed off `value` (a
  // string) rather than the `cities` array, which is rebuilt on every render.
  const suggestions = useMemo(
    () => (full ? [] : suggestCities(draft, { exclude: parseCities(value) })),
    [draft, value, full]
  );

  const add = (name) => {
    const city = String(name ?? draft).trim().replace(/\s+/g, ' ');
    if (!city || full) return;
    // Same city twice adds nothing to the matcher, so quietly ignore it.
    if (cities.some((c) => c.toLowerCase() === city.toLowerCase())) { setDraft(''); return; }
    onChange(formatCities(cities.concat(city)));
    setDraft('');
  };

  const remove = (city) => onChange(formatCities(cities.filter((c) => c !== city)));

  return (
    <View style={[{ marginBottom: spacing.md }, style]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}

      <View style={styles.inputRow}>
        <View style={styles.inputWrap}>
          <Icon name="location" size={19} color={colors.textMuted} style={{ marginRight: 8 }} />
          <TextInput
            ref={inputRef}
            value={draft}
            onChangeText={setDraft}
            onFocus={onFocus}
            // Wrapped: both handlers pass an event, which add() would take as the city.
            onSubmitEditing={() => add()}
            placeholder={full ? `Up to ${max} cities` : placeholder}
            placeholderTextColor={colors.textMuted}
            autoCorrect={false}
            editable={!full}
            returnKeyType="done"
            blurOnSubmit={false}
            style={styles.input}
          />
        </View>
        <TouchableOpacity
          onPress={() => add()}
          activeOpacity={0.85}
          disabled={!draft.trim() || full}
          style={[styles.addBtn, { backgroundColor: color }, (!draft.trim() || full) && { opacity: 0.4 }]}>
          <Icon name="plus" size={20} color={colors.white} />
          <Text style={styles.addText}>Add</Text>
        </TouchableOpacity>
      </View>

      <CitySuggestList suggestions={suggestions} onSelect={add} color={color} />

      {cities.length ? (
        <View style={styles.chips}>
          {cities.map((city) => (
            <View key={city} style={[styles.chip, { borderColor: color, backgroundColor: color + '14' }]}>
              <Text style={[styles.chipText, { color }]}>{city}</Text>
              <TouchableOpacity
                onPress={() => remove(city)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={{ marginLeft: 6 }}>
                <Icon name="close" size={15} color={color} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      ) : (
        <Text style={styles.hint}>{hint}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: font.small, color: colors.text, marginBottom: 7, fontWeight: font.semibold },
  inputRow: { flexDirection: 'row', alignItems: 'center' },
  inputWrap: {
    flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, height: 52,
  },
  input: { flex: 1, fontSize: font.body, color: colors.text, ...(Platform.OS === 'android' ? { paddingVertical: 8 } : {}) },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    height: 52, paddingHorizontal: spacing.md, borderRadius: radius.md, marginLeft: spacing.sm,
  },
  addText: { color: colors.white, fontSize: font.small, fontWeight: font.semibold, marginLeft: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginTop: spacing.sm },
  chip: {
    flexDirection: 'row', alignItems: 'center', paddingLeft: spacing.md, paddingRight: 10,
    paddingVertical: 8, borderRadius: radius.pill, borderWidth: 1.5, marginRight: spacing.sm, marginBottom: spacing.sm,
  },
  chipText: { fontSize: font.small, fontWeight: font.semibold },
  hint: { fontSize: font.tiny, color: colors.textMuted, marginTop: 6 },
});
