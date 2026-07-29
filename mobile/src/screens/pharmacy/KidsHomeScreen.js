import React, { useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { CatalogApi } from '../../api';
import { useDelivery } from '../../store/DeliveryContext';
import { Muted, Loader, EmptyState, AppButton, IconBadge } from '../../components/UI';
import DeliverToBar from '../../components/DeliverToBar';
import Icon from '../../components/Icon';
import GradientBackground from '../../components/GradientBackground';
import { colors, spacing, font, radius, shadow } from '../../theme';

// Same slug→icon map as the main store, with kid-flavoured fallbacks cycling
// per index so unmapped categories still look intentional, not generic.
const CAT_ICON = {
  'fever-pain-relief': 'thermometer', 'cough-cold': 'weather-windy', 'diabetes-care': 'water',
  'antibiotics': 'pill', 'vitamins-supplements': 'fruit-citrus', 'digestive-care': 'stomach', 'first-aid': 'medical-bag',
};
const FALLBACK_ICONS = ['baby', 'kids', 'babyBottle', 'pill', 'medical-bag', 'fruit-citrus'];

// Same green family as the main pharmacy store.
const TINTS = [
  { bg: '#E7F6EE', fg: '#16A34A' },
  { bg: '#E9F7EF', fg: '#12833C' },
  { bg: '#ECFDF5', fg: '#059669' },
  { bg: '#E7F6EE', fg: '#16A34A' },
  { bg: '#E9F7EF', fg: '#10B981' },
  { bg: '#ECFDF5', fg: '#12833C' },
];

export default function KidsHomeScreen({ navigation }) {
  const [categories, setCategories] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [results, setResults] = useState(null); // null = no active search
  const [searching, setSearching] = useState(false);
  const { addressId } = useDelivery();

  const load = useCallback(async () => {
    // is_kids=1 → only categories that actually contain kids medicines, so no
    // card ever opens an empty list.
    try { setCategories((await CatalogApi.categories({ is_kids: 1 })) || []); } catch (e) { setCategories([]); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const openList = (extra = {}) => navigation.navigate('MedicineList', { is_kids: true, title: 'Kids Medicines', ...extra });

  // Live search — same debounced dropdown as the main store, but scoped to
  // kids listings so results never leave the Kids Care section.
  const debounceRef = useRef(null);
  const runSearch = useCallback(async (q) => {
    const term = q.trim();
    if (!term) { setResults(null); setSearching(false); return; }
    setSearching(true);
    try {
      const rows = await CatalogApi.medicines({ search: term, is_kids: 1, limit: 8, address_id: addressId ?? undefined });
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

  const goSearch = () => openList({ search });

  if (categories === null) return <Loader />;

  return (
    <GradientBackground>
      <ScrollView style={{ backgroundColor: 'transparent' }} contentContainerStyle={{ padding: spacing.lg, flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.kids} colors={[colors.kids]} />}>

        <View style={{ marginBottom: spacing.md }}>
          <DeliverToBar />
        </View>

        {/* Hero — layered translucent bubbles give it depth without needing a
            native gradient module. */}
        <View style={[styles.hero, shadow.card]}>
          <View style={[styles.bubble, { width: 130, height: 130, top: -40, right: -30 }]} />
          <View style={[styles.bubble, { width: 70, height: 70, bottom: -20, left: -14, opacity: 0.12 }]} />
          <View style={styles.heroIconWrap}>
            <Icon name="kids" size={30} color={colors.kids} />
          </View>
          <Text style={styles.heroTitle}>Kids Care Store</Text>
          <Text style={styles.heroSub}>Gentle medicines & essentials for your little ones</Text>
          <View style={styles.searchBar}>
            <Icon name="search" size={20} color={colors.textMuted} />
            <TextInput style={styles.searchInput} placeholder="Search kids medicines…" placeholderTextColor={colors.textMuted}
              value={search} onChangeText={onChangeSearch} returnKeyType="search" onSubmitEditing={goSearch}
              autoCorrect={false} autoCapitalize="none" />
            {search.length > 0 ? (
              <TouchableOpacity onPress={() => onChangeSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Icon name="close" size={18} color={colors.textMuted} />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        {/* Live search dropdown — matching kids medicines as the user types. */}
        {search.trim() !== '' ? (
          <View style={styles.dropdown}>
            {searching ? (
              <View style={styles.dropLoading}><ActivityIndicator color={colors.kids} /></View>
            ) : results && results.length > 0 ? (
              <>
                {results.map((m) => (
                  <TouchableOpacity key={m.id} style={styles.dropRow} activeOpacity={0.85}
                    onPress={() => navigation.navigate('MedicineDetail', { id: m.id })}>
                    <IconBadge name="baby" color={colors.kids} size={38} iconSize={18} />
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
              <View style={styles.dropLoading}><Muted>No kids medicines found.</Muted></View>
            )}
          </View>
        ) : null}

        {categories.length === 0 ? (
          <EmptyState icon="kids" title="Kids medicines coming soon"
            subtitle="Pharmacies near you haven't listed kids medicines yet. Please check back soon." />
        ) : (
          <>
            <View style={styles.sectionRow}>
              <Text style={styles.section}>Shop for kids by category</Text>
            </View>

            <View style={styles.grid}>
              {categories.map((c, i) => {
                const tint = TINTS[i % TINTS.length];
                return (
                  <TouchableOpacity key={c.id} activeOpacity={0.85}
                    style={[styles.cat, { backgroundColor: tint.bg }]}
                    onPress={() => openList({ category_id: c.id, title: c.name })}>
                    <View style={styles.catIconWrap}>
                      <Icon name={CAT_ICON[c.slug] || FALLBACK_ICONS[i % FALLBACK_ICONS.length]} size={24} color={tint.fg} />
                    </View>
                    <Text style={styles.catName} numberOfLines={2}>{c.name}</Text>
                    <View style={styles.catFoot}>
                      <Text style={[styles.catLink, { color: tint.fg }]}>Explore</Text>
                      <Icon name="chevronRight" size={15} color={tint.fg} />
                    </View>
                  </TouchableOpacity>
                );
              })}
              {categories.length % 2 === 1 ? <View style={styles.catSpacer} /> : null}
            </View>

            <AppButton title="View all kids medicines" color={colors.kids} icon="kids"
              style={{ marginTop: spacing.sm }} onPress={() => openList()} />
          </>
        )}

        <View style={styles.note}>
          <Icon name="baby" size={20} color={colors.kids} style={{ marginRight: spacing.sm, marginTop: 2 }} />
          <View style={{ flex: 1 }}>
            <Text style={styles.noteTitle}>A note for parents</Text>
            <Muted style={{ marginTop: 4 }}>Always consult a paediatrician before giving any medicine to children, and follow the prescribed dosage carefully.</Muted>
          </View>
        </View>
      </ScrollView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  hero: { backgroundColor: colors.kids, borderRadius: radius.xl, padding: spacing.xl, overflow: 'hidden' },
  bubble: { position: 'absolute', borderRadius: 999, backgroundColor: colors.white, opacity: 0.16 },
  heroIconWrap: {
    width: 56, height: 56, borderRadius: radius.lg, backgroundColor: colors.white,
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md,
  },
  heroTitle: { color: colors.white, fontSize: font.h2, fontWeight: font.bold },
  heroSub: { color: 'rgba(255,255,255,0.85)', fontSize: font.small, marginTop: 4, marginBottom: spacing.lg },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, borderRadius: radius.md, paddingHorizontal: spacing.md, height: 50 },
  searchInput: { flex: 1, marginLeft: spacing.sm, fontSize: font.body, color: colors.text },

  dropdown: { backgroundColor: colors.surface, borderRadius: radius.lg, marginTop: spacing.md, overflow: 'hidden', ...shadow.card },
  dropLoading: { padding: spacing.lg, alignItems: 'center' },
  dropRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  dropName: { fontSize: font.body, fontWeight: font.semibold, color: colors.text },
  dropPrice: { fontSize: font.body, fontWeight: font.bold, color: colors.kids, marginLeft: spacing.sm },
  dropAll: { paddingVertical: spacing.md, alignItems: 'center', backgroundColor: colors.kidsLight },
  dropAllText: { color: colors.kids, fontWeight: font.bold, fontSize: font.small },

  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.xl, marginBottom: spacing.md },
  section: { fontSize: font.h3, fontWeight: font.bold, color: colors.text },

  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  cat: { width: '48.5%', borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md, ...shadow.soft },
  catSpacer: { width: '48.5%' },
  catIconWrap: {
    width: 46, height: 46, borderRadius: radius.md, backgroundColor: colors.white,
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md, ...shadow.soft,
  },
  catName: { fontSize: font.body, fontWeight: font.semibold, color: colors.text, minHeight: 38 },
  catFoot: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm },
  catLink: { fontSize: font.tiny, fontWeight: font.bold, textTransform: 'uppercase', letterSpacing: 0.4, marginRight: 2 },

  note: {
    flexDirection: 'row', backgroundColor: colors.kidsLight, borderRadius: radius.lg,
    padding: spacing.lg, marginTop: spacing.lg,
  },
  noteTitle: { fontWeight: font.bold, color: '#12833C', fontSize: font.small },
});
