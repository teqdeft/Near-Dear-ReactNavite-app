import React, { useState, useCallback } from 'react';
import { FlatList, View, Text, StyleSheet, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { AmbulanceApi } from '../../api';
import { Card, Pill, Muted, Row, AppButton, Loader } from '../../components/UI';
import { colors, spacing, font, radius, shadow } from '../../theme';

const STATUS_COLOR = {
  requested: colors.warning, assigned: colors.info, accepted: colors.info,
  on_the_way: colors.primary, picked_up: colors.primary, completed: colors.success, cancelled: colors.danger,
};

export default function AmbulanceHomeScreen({ navigation }) {
  const [items, setItems] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try { setItems((await AmbulanceApi.myRequests()) || []); } catch (e) { setItems([]); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  if (items === null) return <Loader />;

  return (
    <FlatList
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: spacing.lg }}
      data={items}
      keyExtractor={(i) => String(i.id)}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      ListHeaderComponent={
        <View>
          <View style={[styles.hero, shadow.card]}>
            <Text style={{ fontSize: 40 }}>🚑</Text>
            <Text style={styles.heroTitle}>Emergency ambulance</Text>
            <Text style={styles.heroSub}>Request transport from pickup to hospital. Our team assigns the nearest vehicle.</Text>
            <AppButton title="🚑  Book an ambulance" variant="outline" color={colors.white} style={styles.heroBtn}
              onPress={() => navigation.navigate('BookAmbulance')} />
          </View>
          <Text style={styles.section}>Your requests</Text>
        </View>
      }
      ListEmptyComponent={<Muted style={{ textAlign: 'center', marginTop: spacing.lg }}>No ambulance requests yet.</Muted>}
      renderItem={({ item }) => (
        <Card onPress={() => navigation.navigate('AmbulanceDetail', { id: item.id })} style={styles.card}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Text style={styles.patient}>{item.patient_name}</Text>
            <Pill label={item.status.replace(/_/g, ' ')} color={STATUS_COLOR[item.status] || colors.textMuted} />
          </Row>
          <Muted style={{ marginTop: 6 }}>📍 {item.pickup_address}</Muted>
          <Muted>🏥 {item.drop_address}</Muted>
          <Pill label={item.ambulance_type} color={colors.ambulance} style={{ marginTop: 8 }} />
        </Card>
      )}
    />
  );
}

const styles = StyleSheet.create({
  hero: { backgroundColor: colors.ambulance, borderRadius: radius.xl, padding: spacing.xl, marginBottom: spacing.lg },
  heroTitle: { color: colors.white, fontSize: font.h2, fontWeight: font.bold, marginTop: spacing.sm },
  heroSub: { color: '#D5E5F5', fontSize: font.small, marginTop: 4, marginBottom: spacing.lg },
  heroBtn: { backgroundColor: 'rgba(255,255,255,0.14)' },
  section: { fontSize: font.h3, fontWeight: font.bold, color: colors.text, marginBottom: spacing.md },
  card: { marginBottom: spacing.md },
  patient: { fontSize: font.body, fontWeight: font.bold, color: colors.text },
});
