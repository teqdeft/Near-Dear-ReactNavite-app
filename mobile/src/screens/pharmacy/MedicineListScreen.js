import React, { useState, useCallback, useLayoutEffect, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, ActivityIndicator, Alert, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { CatalogApi } from '../../api';
import { useCart } from '../../store/CartContext';
import { useDelivery } from '../../store/DeliveryContext';
import { Card, Pill, Muted, Row, EmptyState, Loader } from '../../components/UI';
import DeliverToBar from '../../components/DeliverToBar';
import Icon from '../../components/Icon';
import { colors, spacing, font, radius } from '../../theme';

const PAGE_SIZE = 20;

export default function MedicineListScreen({ route, navigation }) {
  const params = route.params || {};
  const { addressId, address } = useDelivery();
  const [search, setSearch] = useState(params.search || '');
  const [items, setItems] = useState(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const { addItem, count, items: cartItems, setQuantity } = useCart();
  const cartQty = (id) => {
    const ci = cartItems.find((c) => c.pharmacy_medicine_id === id);
    return ci ? ci.quantity : 0;
  };

  useLayoutEffect(() => {
    if (params.title) navigation.setOptions({ title: params.title });
  }, [navigation, params.title]);

  // address_id scopes the catalog to pharmacies that can reach that address
  // (within 10 km of it, or in a matching city).
  const fetchPage = useCallback(async (pageNum, q) => {
    const data = await CatalogApi.medicines({
      search: (q ?? search) || undefined,
      category_id: params.category_id ?? undefined,
      address_id: addressId ?? undefined,
      page: pageNum,
      limit: PAGE_SIZE,
    });
    return data || [];
  }, [search, params.category_id, addressId]);

  // First page (or a fresh search/category) — replaces the list.
  const load = useCallback(async (q) => {
    setItems(null); setPage(1); setHasMore(true);
    try {
      const rows = await fetchPage(1, q);
      setItems(rows);
      setHasMore(rows.length === PAGE_SIZE);
    } catch (e) { setItems([]); setHasMore(false); }
  }, [fetchPage]);

  // Pull-to-refresh: reload the first page WITHOUT clearing the list to null
  // (which would hide the list — and the refresh spinner along with it).
  const onRefresh = async () => {
    setRefreshing(true);
    try {
      setPage(1); setHasMore(true);
      const rows = await fetchPage(1, search);
      setItems(rows);
      setHasMore(rows.length === PAGE_SIZE);
    } catch (e) { /* keep the current list on error */ }
    finally { setRefreshing(false); }
  };

  // Next page — appends as the user scrolls to the bottom.
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || items === null) return;
    setLoadingMore(true);
    try {
      const next = page + 1;
      const rows = await fetchPage(next);
      setItems((prev) => [...(prev || []), ...rows]);
      setPage(next);
      setHasMore(rows.length === PAGE_SIZE);
    } catch (e) { /* keep what we already have */ }
    finally { setLoadingMore(false); }
  }, [loadingMore, hasMore, items, page, fetchPage]);

  // Reload when the category OR the delivery address changes — a different
  // address means a different set of pharmacies, so the list must be refetched.
  useFocusEffect(useCallback(() => { load(); }, [params.category_id, addressId])); // eslint-disable-line react-hooks/exhaustive-deps

  // Live search: reload results ~300ms after the user stops typing, so
  // suggestions appear as they type — no need to press the search key.
  const debounceRef = useRef(null);
  const onChangeSearch = (text) => {
    setSearch(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => load(text), 300);
  };
  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

  const onAdd = (item) => {
    const switched = addItem({
      pharmacy_medicine_id: item.id,
      pharmacy_id: item.pharmacy_id,
      pharmacy_name: item.pharmacy_name,
      name: item.display_name,
      price: item.price,
      prescription_required: !!item.prescription_required,
    });
    if (switched) {
      Alert.alert('Cart cleared', 'Your cart can only hold items from one pharmacy, so the previous items were removed.');
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={styles.searchWrap}>
        <DeliverToBar />
        <View style={[styles.searchBar, { marginTop: spacing.sm }]}>
          <Icon name="search" size={20} color={colors.textMuted} />
          <TextInput style={styles.input} placeholder="Search medicines…" placeholderTextColor={colors.textMuted}
            value={search} onChangeText={onChangeSearch} returnKeyType="search" onSubmitEditing={() => load(search)}
            autoCorrect={false} autoCapitalize="none" />
        </View>
      </View>

      {items === null ? <Loader /> : (
        <FlatList
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: 90, flexGrow: 1 }}
          data={items}
          keyExtractor={(i) => String(i.id)}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.pharmacy} />}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          ListFooterComponent={loadingMore ? <ActivityIndicator color={colors.pharmacy} style={{ marginVertical: spacing.lg }} /> : null}
          ListEmptyComponent={
            // Distinguish "nothing matched your search" from "no pharmacy serves
            // this address" — the old copy blamed the search for both, which sent
            // people hunting for a spelling mistake that wasn't there.
            search ? (
              <EmptyState icon="pharmacy" title="No medicines found"
                subtitle="Try a different search or category." />
            ) : (
              <EmptyState icon="pharmacy" title="No pharmacies deliver here yet"
                subtitle={address
                  ? `We couldn't find a pharmacy near ${address.city}. Try another delivery address.`
                  : 'Add a delivery address to see pharmacies near you.'} />
            )
          }
          renderItem={({ item }) => (
            <Card style={styles.card} onPress={() => navigation.navigate('MedicineDetail', { id: item.id })}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.display_name}</Text>
                <Muted>{[item.strength, item.form].filter(Boolean).join(' • ')}</Muted>
                <Muted style={{ marginTop: 2 }}>
                  {item.pharmacy_name}
                  {/* null when either side isn't pinned — say nothing rather
                      than imply the shop is at zero distance. */}
                  {item.distance_km != null ? ` • ${item.distance_km} km away` : ''}
                </Muted>
                <Row style={{ marginTop: 8 }}>
                  <Text style={styles.price}>₹{Number(item.price).toFixed(0)}</Text>
                  {item.prescription_required ? <Pill label="Rx" color={colors.danger} style={{ marginLeft: 8 }} /> : null}
                  {item.stock_status !== 'in_stock' ? <Pill label="Out of stock" color={colors.textMuted} style={{ marginLeft: 8 }} /> : null}
                </Row>
              </View>
              {item.stock_status !== 'in_stock' ? (
                <View style={[styles.addBtn, { opacity: 0.4 }]}>
                  <Text style={styles.addText}>+ Add</Text>
                </View>
              ) : cartQty(item.id) > 0 ? (
                // Already in cart — show an inline quantity stepper (ecommerce style).
                <View style={styles.stepper}>
                  <TouchableOpacity style={styles.stepBtn} onPress={() => setQuantity(item.id, cartQty(item.id) - 1)}>
                    <Text style={styles.stepText}>−</Text>
                  </TouchableOpacity>
                  <Text style={styles.qtyText}>{cartQty(item.id)}</Text>
                  <TouchableOpacity style={styles.stepBtn} onPress={() => setQuantity(item.id, cartQty(item.id) + 1)}>
                    <Text style={styles.stepText}>+</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity style={styles.addBtn} onPress={() => onAdd(item)}>
                  <Text style={styles.addText}>+ Add</Text>
                </TouchableOpacity>
              )}
            </Card>
          )}
        />
      )}

      {count > 0 && (
        <TouchableOpacity style={styles.cartBar} onPress={() => navigation.navigate('Cart')} activeOpacity={0.9}>
          <Text style={styles.cartText}>{count} item(s) in cart</Text>
          <Text style={styles.cartText}>View cart ›</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  searchWrap: { padding: spacing.lg, paddingBottom: 0 },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.md, paddingHorizontal: spacing.md, height: 46, borderWidth: 1, borderColor: colors.border },
  input: { flex: 1, marginLeft: spacing.sm, fontSize: font.body, color: colors.text },
  card: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  name: { fontSize: font.body, fontWeight: font.semibold, color: colors.text },
  price: { fontSize: font.h3, fontWeight: font.bold, color: colors.pharmacy },
  addBtn: { backgroundColor: colors.pharmacyLight, paddingHorizontal: spacing.md, paddingVertical: 10, borderRadius: radius.md },
  addText: { color: colors.pharmacy, fontWeight: font.bold },
  stepper: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.pharmacyLight, borderRadius: radius.md },
  stepBtn: { paddingHorizontal: 12, paddingVertical: 8 },
  stepText: { color: colors.pharmacy, fontWeight: font.bold, fontSize: 18, lineHeight: 20 },
  qtyText: { minWidth: 22, textAlign: 'center', color: colors.pharmacy, fontWeight: font.bold, fontSize: font.body },
  cartBar: {
    position: 'absolute', left: spacing.lg, right: spacing.lg, bottom: spacing.lg, backgroundColor: colors.pharmacy,
    borderRadius: radius.md, padding: spacing.md, flexDirection: 'row', justifyContent: 'space-between',
  },
  cartText: { color: colors.white, fontWeight: font.bold },
});
