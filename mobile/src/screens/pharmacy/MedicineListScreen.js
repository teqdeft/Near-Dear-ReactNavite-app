import React, { useState, useCallback, useLayoutEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { CatalogApi } from '../../api';
import { useCart } from '../../store/CartContext';
import { Card, Pill, Muted, Row, EmptyState, Loader } from '../../components/UI';
import Icon from '../../components/Icon';
import { colors, spacing, font, radius } from '../../theme';

export default function MedicineListScreen({ route, navigation }) {
  const params = route.params || {};
  const [search, setSearch] = useState(params.search || '');
  const [items, setItems] = useState(null);
  const { addItem, count } = useCart();

  useLayoutEffect(() => {
    if (params.title) navigation.setOptions({ title: params.title });
  }, [navigation, params.title]);

  const load = useCallback(async (q) => {
    setItems(null);
    try {
      const data = await CatalogApi.medicines({
        search: q ?? search ?? undefined,
        category_id: params.category_id ?? undefined,
      });
      setItems(data || []);
    } catch (e) { setItems([]); }
  }, [search, params.category_id]);

  useFocusEffect(useCallback(() => { load(); }, [params.category_id])); // eslint-disable-line react-hooks/exhaustive-deps

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
      // Cart switched pharmacies — quietly informative.
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={styles.searchWrap}>
        <View style={styles.searchBar}>
          <Icon name="search" size={20} color={colors.textMuted} />
          <TextInput style={styles.input} placeholder="Search medicines…" placeholderTextColor={colors.textMuted}
            value={search} onChangeText={setSearch} returnKeyType="search" onSubmitEditing={() => load(search)} />
        </View>
      </View>

      {items === null ? <Loader /> : (
        <FlatList
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: 90, flexGrow: 1 }}
          data={items}
          keyExtractor={(i) => String(i.id)}
          ListEmptyComponent={<EmptyState icon="pharmacy" title="No medicines found" subtitle="Try a different search or category." />}
          renderItem={({ item }) => (
            <Card style={styles.card} onPress={() => navigation.navigate('MedicineDetail', { id: item.id })}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.display_name}</Text>
                <Muted>{[item.strength, item.form].filter(Boolean).join(' • ')}</Muted>
                <Muted style={{ marginTop: 2 }}>{item.pharmacy_name}</Muted>
                <Row style={{ marginTop: 8 }}>
                  <Text style={styles.price}>₹{Number(item.price).toFixed(0)}</Text>
                  {item.prescription_required ? <Pill label="Rx" color={colors.danger} style={{ marginLeft: 8 }} /> : null}
                  {item.stock_status !== 'in_stock' ? <Pill label="Out of stock" color={colors.textMuted} style={{ marginLeft: 8 }} /> : null}
                </Row>
              </View>
              <TouchableOpacity style={[styles.addBtn, item.stock_status !== 'in_stock' && { opacity: 0.4 }]}
                disabled={item.stock_status !== 'in_stock'} onPress={() => onAdd(item)}>
                <Text style={styles.addText}>+ Add</Text>
              </TouchableOpacity>
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
  cartBar: {
    position: 'absolute', left: spacing.lg, right: spacing.lg, bottom: spacing.lg, backgroundColor: colors.pharmacy,
    borderRadius: radius.md, padding: spacing.md, flexDirection: 'row', justifyContent: 'space-between',
  },
  cartText: { color: colors.white, fontWeight: font.bold },
});
