import React, { useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { CatalogApi } from '../../api';
import { useCart } from '../../store/CartContext';
import { useDelivery } from '../../store/DeliveryContext';
import { Card, Muted, Loader, IconBadge } from '../../components/UI';
import DeliverToBar from '../../components/DeliverToBar';
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
  const [results, setResults] = useState(null); // null = no active search
  const [searching, setSearching] = useState(false);
  const { count } = useCart();
  const { addressId } = useDelivery();

  const load = useCallback(async () => {
    try { setCategories((await CatalogApi.categories()) || []); } catch (e) { setCategories([]); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Live search: as the user types, fetch matching medicines ~300ms after they
  // stop and show them in a dropdown below the search bar — no search key needed.
  const debounceRef = useRef(null);
  const runSearch = useCallback(async (q) => {
    const term = q.trim();
    if (!term) { setResults(null); setSearching(false); return; }
    setSearching(true);
    try {
      // Same scoping as the full list — otherwise the dropdown would offer
      // medicines from pharmacies that can't deliver to the chosen address.
      const rows = await CatalogApi.medicines({ search: term, limit: 8, address_id: addressId ?? undefined });
      setResults(rows || []);
    } catch (e) { setResults([]); }
    finally { setSearching(false); }
  }, [addressId]);

  const onChangeSearch = (text) => {
    setSearch(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!text.trim()) { setResults(null); setSearching(false); return; }
    setSearching(true);
    debounceRef.current = setTimeout(() => runSearch(text), 300);
  };
  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

  const goSearch = () => navigation.navigate('MedicineList', { search });
  if (categories === null) return <Loader />;

  return (
    <GradientBackground>
    <ScrollView style={{ backgroundColor: 'transparent' }} contentContainerStyle={{ padding: spacing.lg }} showsVerticalScrollIndicator={false}>
      {/* The delivery address decides which pharmacies exist for this user, so
          it sits above the search rather than hidden away in checkout. */}
      <View style={{ marginBottom: spacing.md }}>
        <DeliverToBar />
      </View>

      <View style={[styles.hero, shadow.card]}>
        <Icon name="pharmacy" size={34} color={colors.white} />
        <Text style={styles.heroTitle}>Medicines from trusted pharmacies</Text>
        <View style={styles.searchBar}>
          <Icon name="search" size={20} color={colors.textMuted} />
          <TextInput style={styles.searchInput} placeholder="Search medicines…" placeholderTextColor={colors.textMuted}
            value={search} onChangeText={onChangeSearch} returnKeyType="search" onSubmitEditing={goSearch}
            autoCorrect={false} autoCapitalize="none" />
          {search.length > 0 ? (
            <TouchableOpacity onPress={() => onChangeSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Icon name="close" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* Live search dropdown — shows matching medicines as the user types. */}
      {search.trim() !== '' ? (
        <View style={styles.dropdown}>
          {searching ? (
            <View style={styles.dropLoading}><ActivityIndicator color={colors.pharmacy} /></View>
          ) : results && results.length > 0 ? (
            <>
              {results.map((m) => (
                <TouchableOpacity key={m.id} style={styles.dropRow} activeOpacity={0.85}
                  onPress={() => navigation.navigate('MedicineDetail', { id: m.id })}>
                  <IconBadge name="pill" color={colors.pharmacy} size={38} iconSize={18} />
                  <View style={{ flex: 1, marginLeft: spacing.sm }}>
                    <Text style={styles.dropName} numberOfLines={1}>{m.display_name}</Text>
                    <Muted style={{ fontSize: font.tiny }} numberOfLines={1}>
                      {[m.strength, m.form].filter(Boolean).join(' • ')}{m.pharmacy_name ? ` · ${m.pharmacy_name}` : ''}
                    </Muted>
                  </View>
                  <Text style={styles.dropPrice}>₹{Number(m.price).toFixed(0)}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity style={styles.dropAll} onPress={goSearch}>
                <Text style={styles.dropAllText}>View all results for “{search.trim()}”</Text>
              </TouchableOpacity>
            </>
          ) : (
            <View style={styles.dropLoading}><Muted>No medicines found.</Muted></View>
          )}
        </View>
      ) : null}

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
        {/* Fill the last row so space-between doesn't spread a lone pair to the edges. */}
        {Array.from({ length: (3 - (categories.length % 3)) % 3 }).map((_, i) => (
          <View key={`spacer-${i}`} style={styles.catSpacer} />
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
  dropdown: { backgroundColor: colors.surface, borderRadius: radius.lg, marginTop: spacing.md, overflow: 'hidden', ...shadow.card },
  dropLoading: { padding: spacing.lg, alignItems: 'center' },
  dropRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  dropName: { fontSize: font.body, fontWeight: font.semibold, color: colors.text },
  dropPrice: { fontSize: font.body, fontWeight: font.bold, color: colors.pharmacy, marginLeft: spacing.sm },
  dropAll: { paddingVertical: spacing.md, alignItems: 'center', backgroundColor: colors.pharmacyLight },
  dropAllText: { color: colors.pharmacy, fontWeight: font.bold, fontSize: font.small },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.xl, marginBottom: spacing.md },
  section: { fontSize: font.h3, fontWeight: font.bold, color: colors.text },
  link: { color: colors.primary, fontWeight: font.semibold },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  cat: { width: '31%', backgroundColor: colors.surface, borderRadius: radius.lg, paddingVertical: spacing.md, alignItems: 'center', marginBottom: spacing.md, ...shadow.soft },
  catSpacer: { width: '31%' },
  catName: { fontSize: font.tiny, color: colors.text, textAlign: 'center', marginTop: 8, fontWeight: font.medium, paddingHorizontal: 4 },
  cartCta: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm },
  cartTitle: { fontSize: font.body, fontWeight: font.semibold, color: colors.text },
  disclaimer: { backgroundColor: colors.pharmacyLight, marginTop: spacing.lg },
  discTitle: { fontWeight: font.bold, color: '#1E6B4A' },
});
