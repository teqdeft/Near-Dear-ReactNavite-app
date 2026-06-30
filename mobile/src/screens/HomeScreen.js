import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../store/AuthContext';
import { colors, spacing, font, radius, shadow } from '../theme';

const MODULES = [
  {
    key: 'BloodHome', title: 'Blood Donation', subtitle: 'Find donors or request blood',
    emoji: '🩸', color: colors.blood, light: colors.bloodLight,
  },
  {
    key: 'AmbulanceHome', title: 'Ambulance', subtitle: 'Book emergency transport',
    emoji: '🚑', color: colors.ambulance, light: colors.ambulanceLight,
  },
  {
    key: 'PharmacyHome', title: 'Medicines', subtitle: 'Order from nearby pharmacies',
    emoji: '💊', color: colors.pharmacy, light: colors.pharmacyLight,
  },
];

const QUICK = [
  { emoji: '🩸', label: 'Donate blood', to: 'BecomeDonor', tint: colors.bloodLight },
  { emoji: '🆘', label: 'Request blood', to: 'CreateBloodRequest', tint: colors.bloodLight },
  { emoji: '🧾', label: 'My orders', to: 'Orders', tint: colors.pharmacyLight },
  { emoji: '💬', label: 'Support', to: 'Support', tint: colors.primaryLight },
];

function ServiceCard({ item, onPress }) {
  return (
    <TouchableOpacity activeOpacity={0.9} onPress={onPress} style={[styles.service, { backgroundColor: item.light }, shadow.soft]}>
      <View style={[styles.serviceIcon, { backgroundColor: item.color }]}>
        <Text style={{ fontSize: 26 }}>{item.emoji}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.serviceTitle}>{item.title}</Text>
        <Text style={styles.serviceSub}>{item.subtitle}</Text>
      </View>
      <View style={[styles.serviceArrow, { backgroundColor: item.color }]}>
        <Text style={styles.serviceArrowText}>→</Text>
      </View>
    </TouchableOpacity>
  );
}

export default function HomeScreen({ navigation }) {
  const { user, aadhaarVerified } = useAuth();
  const firstName = (user?.name || 'there').split(' ')[0];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: spacing.xxl }}>
        {/* Curved gradient-style header */}
        <View style={styles.header}>
          <View style={styles.headerBlob} />
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.hello}>Hello, {firstName} 👋</Text>
              <Text style={styles.location}>📍 {user?.city || 'Set your city in Profile'}</Text>
            </View>
            <TouchableOpacity style={styles.bell} onPress={() => navigation.navigate('Alerts')}>
              <Text style={{ fontSize: 20 }}>🔔</Text>
            </TouchableOpacity>
          </View>

          {/* Emergency CTA overlapping the header */}
          <View style={[styles.emergency, shadow.card]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.emergencyTitle}>Need urgent help?</Text>
              <Text style={styles.emergencySub}>Book an ambulance in seconds</Text>
            </View>
            <TouchableOpacity style={styles.sosBtn} onPress={() => navigation.navigate('BookAmbulance')}>
              <Text style={styles.sosText}>🚑 Book</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Aadhaar banner */}
        {!aadhaarVerified && (
          <TouchableOpacity activeOpacity={0.9} onPress={() => navigation.navigate('AadhaarVerify')} style={styles.kycBanner}>
            <Text style={{ fontSize: 22 }}>🛡️</Text>
            <View style={{ flex: 1, marginLeft: spacing.md }}>
              <Text style={styles.kycTitle}>Verify your Aadhaar</Text>
              <Text style={styles.kycSub}>Build trust & unlock full access</Text>
            </View>
            <Text style={styles.kycCta}>Verify ›</Text>
          </TouchableOpacity>
        )}

        {/* Our services */}
        <Text style={styles.section}>Our services</Text>
        <View style={{ paddingHorizontal: spacing.lg }}>
          {MODULES.map((m) => (
            <ServiceCard key={m.key} item={m} onPress={() => navigation.navigate(m.key)} />
          ))}
        </View>

        {/* Quick actions */}
        <Text style={styles.section}>Quick actions</Text>
        <View style={styles.quickRow}>
          {QUICK.map((q) => (
            <TouchableOpacity key={q.label} style={styles.quick} activeOpacity={0.85} onPress={() => navigation.navigate(q.to)}>
              <View style={[styles.quickIcon, { backgroundColor: q.tint }]}><Text style={{ fontSize: 22 }}>{q.emoji}</Text></View>
              <Text style={styles.quickLabel}>{q.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { backgroundColor: colors.primary, paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: 46, borderBottomLeftRadius: 28, borderBottomRightRadius: 28, overflow: 'hidden' },
  headerBlob: { position: 'absolute', top: -50, right: -30, width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(255,255,255,0.08)' },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  hello: { fontSize: font.h2, fontWeight: font.bold, color: colors.white },
  location: { fontSize: font.small, color: '#D7F4EF', marginTop: 2 },
  bell: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  emergency: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#102A43', borderRadius: radius.lg, padding: spacing.lg, marginTop: spacing.lg, marginBottom: -36 },
  emergencyTitle: { color: colors.white, fontWeight: font.bold, fontSize: font.h3 },
  emergencySub: { color: '#B9C7D6', fontSize: font.small, marginTop: 2 },
  sosBtn: { backgroundColor: colors.blood, paddingHorizontal: spacing.lg, paddingVertical: 12, borderRadius: radius.pill },
  sosText: { color: colors.white, fontWeight: font.bold },
  kycBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF6E6', marginHorizontal: spacing.lg, marginTop: spacing.xxl + spacing.md, padding: spacing.md, borderRadius: radius.lg, borderWidth: 1, borderColor: '#F3DFB0' },
  kycTitle: { fontWeight: font.bold, color: '#8A6300', fontSize: font.body },
  kycSub: { color: '#A9802E', fontSize: font.tiny, marginTop: 2 },
  kycCta: { color: '#8A6300', fontWeight: font.bold },
  section: { fontSize: font.h3, fontWeight: font.bold, color: colors.text, marginTop: spacing.xl, marginBottom: spacing.md, marginHorizontal: spacing.lg },
  service: { flexDirection: 'row', alignItems: 'center', borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md },
  serviceIcon: { width: 56, height: 56, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', marginRight: spacing.md },
  serviceTitle: { fontSize: font.h3, fontWeight: font.bold, color: colors.text },
  serviceSub: { fontSize: font.small, color: colors.textMuted, marginTop: 2 },
  serviceArrow: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  serviceArrowText: { color: colors.white, fontSize: 18, fontWeight: font.bold },
  quickRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: spacing.lg },
  quick: { alignItems: 'center', width: '23%' },
  quickIcon: { width: 58, height: 58, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', ...shadow.soft },
  quickLabel: { fontSize: font.tiny, color: colors.text, marginTop: 6, textAlign: 'center', fontWeight: font.medium },
});
