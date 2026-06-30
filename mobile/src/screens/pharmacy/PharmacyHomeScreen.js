import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { CatalogApi } from '../../api';
import { useCart } from '../../store/CartContext';
import { Card, Muted, Loader } from '../../components/UI';
import { colors, spacing, font, radius, shadow } from '../../theme';

const CAT_EMOJI = {
  'fever-pain-relief': '🤒', 'cough-cold': '🤧', 'diabetes-care': '🩸',
  'antibiotics': '💊', 'vitamins-supplements': '🍊', 'digestive-care': '🫃', 'first-aid': '🩹',
};

export default function PharmacyHomeScreen({ navigation }) {
  const [categories, setCategories] = useState(null);
  const [search, setSearch] = useState('');
  const { count } = useCart();

  const load = useCallback(async () => {
    try { setCategories((await CatalogApi.categories()) || []); } catch (e) { setCategories([]); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const goSearch = () => navigation.navigate('MedicineList', { search });

  if (categories === null) return <Loader />;

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ padding: spacing.lg }}>
      <View style={[styles.hero, shadow.card]}>
        <Text style={{ fontSize: 36 }}>💊</Text>
        <Text style={styles.heroTitle}>Medicines, delivered by trusted pharmacies</Text>
        <View style={styles.searchBar}>
          <Text style={{ fontSize: 16 }}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search medicines…"
            placeholderTextColor={colors.textMuted}
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
            onSubmitEditing={goSearch}
          />
        </View>
      </View>

      <View style={styles.sectionRow}>
        <Text style={styles.section}>Shop by category</Text>
        <TouchableOpacity onPress={() => navigation.navigate('MedicineList', {})}>
          <Text style={styles.link}>View all ›</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.grid}>
        {categories.map((c) => (
          <TouchableOpacity key={c.id} style={[styles.cat, shadow.soft]} activeOpacity={0.85}
            onPress={() => navigation.navigate('MedicineList', { category_id: c.id, title: c.name })}>
            <Text style={{ fontSize: 28 }}>{CAT_EMOJI[c.slug] || '💊'}</Text>
            <Text style={styles.catName}>{c.name}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Card style={styles.cartCta} onPress={() => navigation.navigate('Cart')}>
        <Text style={{ fontSize: 22 }}>🛒</Text>
        <View style={{ flex: 1, marginLeft: spacing.md }}>
          <Text style={styles.cartTitle}>Your cart</Text>
          <Muted>{count > 0 ? `${count} item(s) ready for checkout` : 'Your cart is empty'}</Muted>
        </View>
        <Text style={styles.link}>Open ›</Text>
      </Card>

      <Card style={styles.disclaimer}>
        <Text style={styles.discTitle}>ℹ️ Medicine purchase disclaimer</Text>
        <Muted style={{ marginTop: 4 }}>
          Prescription medicines require a valid prescription. Pharmacies verify prescriptions and
          fulfil/deliver orders using their own process.
        </Muted>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  hero: { backgroundColor: colors.pharmacy, borderRadius: radius.xl, padding: spacing.xl },
  heroTitle: { color: colors.white, fontSize: font.h3, fontWeight: font.bold, marginTop: spacing.sm, marginBottom: spacing.lg },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, borderRadius: radius.md, paddingHorizontal: spacing.md, height: 48 },
  searchInput: { flex: 1, marginLeft: spacing.sm, fontSize: font.body, color: colors.text },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.xl, marginBottom: spacing.md },
  section: { fontSize: font.h3, fontWeight: font.bold, color: colors.text },
  link: { color: colors.primary, fontWeight: font.semibold },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  cat: { width: '31%', backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, alignItems: 'center', marginBottom: spacing.md },
  catName: { fontSize: font.tiny, color: colors.text, textAlign: 'center', marginTop: 6, fontWeight: font.medium },
  cartCta: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm },
  cartTitle: { fontSize: font.body, fontWeight: font.semibold, color: colors.text },
  disclaimer: { backgroundColor: '#EAF6EE', marginTop: spacing.lg },
  discTitle: { fontWeight: font.bold, color: '#1E6B33' },
});
