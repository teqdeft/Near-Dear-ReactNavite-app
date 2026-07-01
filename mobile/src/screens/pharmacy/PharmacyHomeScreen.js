import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { CatalogApi } from '../../api';
import { useCart } from '../../store/CartContext';
import { Card, Muted, Loader, IconBadge } from '../../components/UI';
import Icon from '../../components/Icon';
import GradientBackground from '../../components/GradientBackground';
import { colors, spacing, font, radius, shadow } from '../../theme';

const CAT_ICON = {
  'fever-pain-relief': 'thermometer', 'cough-cold': 'weather-windy', 'diabetes-care': 'water',
  'antibiotics': 'pill', 'vitamins-supplements': 'fruit-citrus', 'digestive-care': 'stomach', 'first-aid': 'medical-bag',
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
    <GradientBackground>
    <ScrollView style={{ backgroundColor: 'transparent' }} contentContainerStyle={{ padding: spacing.lg }} showsVerticalScrollIndicator={false}>
      <View style={[styles.hero, shadow.card]}>
        <Icon name="pharmacy" size={34} color={colors.white} />
        <Text style={styles.heroTitle}>Medicines from trusted pharmacies</Text>
        <View style={styles.searchBar}>
          <Icon name="search" size={20} color={colors.textMuted} />
          <TextInput style={styles.searchInput} placeholder="Search medicines…" placeholderTextColor={colors.textMuted}
            value={search} onChangeText={setSearch} returnKeyType="search" onSubmitEditing={goSearch} />
        </View>
      </View>

      <View style={styles.sectionRow}>
        <Text style={styles.section}>Shop by category</Text>
        <TouchableOpacity onPress={() => navigation.navigate('MedicineList', {})}><Text style={styles.link}>View all</Text></TouchableOpacity>
      </View>

      <View style={styles.grid}>
        {categories.map((c) => (
          <TouchableOpacity key={c.id} style={styles.cat} activeOpacity={0.85}
            onPress={() => navigation.navigate('MedicineList', { category_id: c.id, title: c.name })}>
            <IconBadge name={CAT_ICON[c.slug] || 'pill'} color={colors.pharmacy} size={54} iconSize={26} />
            <Text style={styles.catName}>{c.name}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Card style={styles.cartCta} onPress={() => navigation.navigate('Cart')}>
        <IconBadge name="cart" color={colors.primary} size={44} iconSize={22} />
        <View style={{ flex: 1, marginLeft: spacing.md }}>
          <Text style={styles.cartTitle}>Your cart</Text>
          <Muted>{count > 0 ? `${count} item(s) ready for checkout` : 'Your cart is empty'}</Muted>
        </View>
        <Icon name="chevronRight" size={22} color={colors.textMuted} />
      </Card>

      <Card style={styles.disclaimer}>
        <Text style={styles.discTitle}>Medicine purchase disclaimer</Text>
        <Muted style={{ marginTop: 6 }}>Prescription medicines require a valid prescription. Pharmacies verify prescriptions and fulfil/deliver orders using their own process.</Muted>
      </Card>
    </ScrollView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  hero: { backgroundColor: colors.pharmacy, borderRadius: radius.lg, padding: spacing.xl },
  heroTitle: { color: colors.white, fontSize: font.h3, fontWeight: font.bold, marginTop: spacing.sm, marginBottom: spacing.lg },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, borderRadius: radius.md, paddingHorizontal: spacing.md, height: 50 },
  searchInput: { flex: 1, marginLeft: spacing.sm, fontSize: font.body, color: colors.text },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.xl, marginBottom: spacing.md },
  section: { fontSize: font.h3, fontWeight: font.bold, color: colors.text },
  link: { color: colors.primary, fontWeight: font.semibold },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  cat: { width: '31%', backgroundColor: colors.surface, borderRadius: radius.lg, paddingVertical: spacing.md, alignItems: 'center', marginBottom: spacing.md, ...shadow.soft },
  catName: { fontSize: font.tiny, color: colors.text, textAlign: 'center', marginTop: 8, fontWeight: font.medium, paddingHorizontal: 4 },
  cartCta: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm },
  cartTitle: { fontSize: font.body, fontWeight: font.semibold, color: colors.text },
  disclaimer: { backgroundColor: colors.pharmacyLight, marginTop: spacing.lg },
  discTitle: { fontWeight: font.bold, color: '#1E6B4A' },
});
