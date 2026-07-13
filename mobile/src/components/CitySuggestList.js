import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Icon from './Icon';
import { colors, spacing, font, radius } from '../theme';

/**
 * The autocomplete dropdown shared by CityPicker (single city) and
 * CityChipsInput (many cities). Plain Views, not a FlatList — these lists are
 * capped at a handful of rows and both parents already sit inside a ScrollView,
 * where a nested VirtualizedList warns and scrolls badly.
 */
export default function CitySuggestList({ suggestions, onSelect, color = colors.primary }) {
  if (!suggestions.length) return null;
  return (
    <View style={styles.list}>
      {suggestions.map((city, i) => (
        <TouchableOpacity
          key={city}
          activeOpacity={0.7}
          onPress={() => onSelect(city)}
          style={[styles.row, i === suggestions.length - 1 && styles.rowLast]}>
          <Icon name="location" size={16} color={color} />
          <Text style={styles.text}>{city}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, marginTop: 6, overflow: 'hidden',
  },
  row: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 12,
    paddingHorizontal: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  rowLast: { borderBottomWidth: 0 },
  text: { fontSize: font.body, color: colors.text, marginLeft: spacing.sm },
});
