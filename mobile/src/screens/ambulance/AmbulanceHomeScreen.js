import React, { useState, useCallback } from 'react';
import { FlatList, View, Text, StyleSheet, RefreshControl, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { AmbulanceApi } from '../../api';
import { Card, Pill, Muted, Row, Loader } from '../../components/UI';
import Icon from '../../components/Icon';
import GradientBackground from '../../components/GradientBackground';
import { formatDateTime } from '../../utils/datetime';
import { statusLabel } from '../../utils/status';
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
    <GradientBackground>
    <FlatList
      style={{ backgroundColor: 'transparent' }}
      contentContainerStyle={{ padding: spacing.lg }}
      data={items}
      keyExtractor={(i) => String(i.id)}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      ListHeaderComponent={
        <View>
          <View style={[styles.hero, shadow.card]}>
            <Icon name="ambulance" size={40} color={colors.white} />
            <Text style={styles.heroTitle}>Emergency ambulance</Text>
            <Text style={styles.heroSub}>Nearby drivers get notified and one accepts to pick you up.</Text>
            <TouchableOpacity style={styles.heroBtn} onPress={() => navigation.navigate('BookAmbulance')}>
              <Icon name="ambulance" size={18} color={colors.white} />
              <Text style={styles.heroBtnText}>  Book an ambulance</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigation.navigate('EmergencyHelp')} style={{ marginTop: spacing.md, alignItems: 'center' }}>
              <Text style={styles.heroLink}>No driver nearby? Emergency helplines →</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.section}>Your requests</Text>
        </View>
      }
      ListEmptyComponent={<Muted style={{ textAlign: 'center', marginTop: spacing.lg }}>No ambulance requests yet.</Muted>}
      renderItem={({ item }) => (
        <Card onPress={() => navigation.navigate('AmbulanceDetail', { id: item.id })} style={styles.card}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Text style={styles.patient}>{item.patient_name}</Text>
            <Pill label={statusLabel(item.status)} color={STATUS_COLOR[item.status] || colors.textMuted} />
          </Row>
          <Row style={{ marginTop: 8 }}><Icon name="location" size={15} color={colors.textMuted} /><Muted style={{ marginLeft: 4 }}>{item.pickup_address}</Muted></Row>
          <Row style={{ marginTop: 2 }}><Icon name="hospital" size={15} color={colors.textMuted} /><Muted style={{ marginLeft: 4 }}>{item.drop_address}</Muted></Row>
          <Pill label={item.ambulance_type} color={colors.ambulance} style={{ marginTop: 8 }} />
          {item.created_at ? <Muted style={{ marginTop: 6 }}>Requested: {formatDateTime(item.created_at)}</Muted> : null}
        </Card>
      )}
    />
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  hero: { backgroundColor: colors.ambulance, borderRadius: radius.lg, padding: spacing.xl, marginBottom: spacing.lg },
  heroTitle: { color: colors.white, fontSize: font.h2, fontWeight: font.bold, marginTop: spacing.sm },
  heroSub: { color: '#DCE8FE', fontSize: font.small, marginTop: 4, marginBottom: spacing.lg },
  heroBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.18)', height: 48, borderRadius: radius.md },
  heroBtnText: { color: colors.white, fontWeight: font.bold, fontSize: font.body },
  heroLink: { color: '#DCE8FE', fontSize: font.small, fontWeight: font.semibold, textDecorationLine: 'underline' },
  section: { fontSize: font.h3, fontWeight: font.bold, color: colors.text, marginBottom: spacing.md },
  card: { marginBottom: spacing.md },
  patient: { fontSize: font.body, fontWeight: font.bold, color: colors.text },
});
