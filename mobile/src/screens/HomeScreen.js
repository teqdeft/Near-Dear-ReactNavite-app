import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Animated, Easing, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../store/AuthContext';
import { useNotifications } from '../store/NotificationContext';
import Icon from '../components/Icon';
import ProfileAvatar from '../components/ProfileAvatar';
import ProfilePreviewModal from '../components/ProfilePreviewModal';
import GradientBackground from '../components/GradientBackground';
import { colors, spacing, font, radius, shadow } from '../theme';

function VerifyNowPill({ onPress }) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] });
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 0.55] });

  return (
    <Animated.View style={{ transform: [{ scale }], opacity }}>
      <TouchableOpacity style={[styles.statusPill, styles.unverifiedPill]} onPress={onPress}>
        <Icon name="shield-alert-outline" size={13} color={colors.warning} />
        <Text style={styles.unverifiedText}>Verify now</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

function NotificationBell({ hasUnread, onPress }) {
  return (
    <TouchableOpacity style={styles.bell} onPress={onPress} activeOpacity={0.85}>
      <Icon name="bell" size={20} color={colors.text} />
      {hasUnread ? <View style={styles.bellDot} pointerEvents="none" /> : null}
    </TouchableOpacity>
  );
}

function ArrowBadge({ color = colors.text, bg = colors.white }) {
  return (
    <View style={[styles.arrowBadge, { backgroundColor: bg }]}>
      <Icon name="arrowUpRight" size={18} color={color} />
    </View>
  );
}

const SERVICES_SMALL = [
  { key: 'AmbulanceHome', title: 'Ambulance', subtitle: 'Book emergency transport', icon: 'ambulance', color: colors.ambulance, tint: colors.ambulanceLight },
  { key: 'PharmacyHome', title: 'Medicines', subtitle: 'Order from nearby pharmacies', icon: 'pharmacy', color: colors.pharmacy, tint: colors.pharmacyLight },
];

const QUICK = [
  { icon: 'water', label: 'Donate blood', sub: 'Save a life', to: 'BecomeDonor', color: colors.blood },
  { icon: 'hand-heart-outline', label: 'Request blood', sub: 'Find donors', to: 'CreateBloodRequest', color: colors.orange },
  { icon: 'clipboard-list-outline', label: 'My orders', sub: 'Track status', to: 'Orders', color: colors.pharmacy },
  { icon: 'message-text-outline', label: 'Support', sub: "We're here 24/7", to: 'Support', color: colors.ambulance },
];

export default function HomeScreen({ navigation }) {
  const { user, profile, aadhaarVerified, refreshUser } = useAuth();
  const { unread, refresh: refreshNotifications } = useNotifications();
  const firstName = (user?.name || 'there').split(' ')[0];
  const [preview, setPreview] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  // KYC is pending while a manual Aadhaar submission is awaiting admin review.
  const aadhaarPending = user?.aadhaar_kyc_status === 'pending';

  const onRefresh = async () => {
    setRefreshing(true);
    try { await Promise.all([refreshUser(), refreshNotifications()]); } catch (e) { /* ignore */ }
    finally { setRefreshing(false); }
  };

  return (
    <GradientBackground>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />}>
          {/* Top row - Profile, Verify Badge, and Bell */}
          <View style={styles.topRow}>
            <View style={styles.profileSection}>
              {/* Profile Avatar */}
              <TouchableOpacity activeOpacity={0.85} onPress={() => setPreview(true)} style={styles.avatarWrap}>
                <ProfileAvatar path={profile?.profile_image} name={user?.name} size={78} />
              </TouchableOpacity>
              
              {/* Verified / Under review / Verify now badge */}
              {aadhaarVerified ? (
                <View style={[styles.statusPill, { backgroundColor: colors.primary }]}>
                  <Icon name="check-decagram" size={13} color={colors.white} />
                  <Text style={styles.verifiedText}>Verified</Text>
                </View>
              ) : aadhaarPending ? (
                <TouchableOpacity style={[styles.statusPill, styles.reviewPill]} onPress={() => navigation.navigate('AadhaarUpload')}>
                  <Icon name="clock" size={13} color={colors.warning} />
                  <Text style={styles.reviewText}>Under review</Text>
                </TouchableOpacity>
              ) : (
                <VerifyNowPill onPress={() => navigation.navigate('AadhaarUpload')} />
              )}
            </View>
            
            <NotificationBell hasUnread={unread > 0} onPress={() => navigation.navigate('Alerts')} />
          </View>

          {/* Greeting */}
          <View style={styles.greetRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.welcome}>WELCOME BACK</Text>
              <Text style={styles.hello}>Hello,</Text>
              <Text style={styles.name}>{firstName}.</Text>
            </View>
          </View>
          <Text style={styles.tagline}>Your health, one tap away. What do you need help with today?</Text>

          {/* Emergency card */}
          <TouchableOpacity activeOpacity={0.92} onPress={() => navigation.navigate('BookAmbulance')} style={[styles.sos, shadow.card]}>
            <View style={styles.sosIcon}><Icon name="ambulance" size={26} color={colors.white} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.sosLabel}>EMERGENCY</Text>
              <Text style={styles.sosTitle}>Need urgent help?</Text>
              <Text style={styles.sosSub}>Book an ambulance in seconds</Text>
            </View>
            <ArrowBadge color={colors.blood} />
          </TouchableOpacity>

          {/* Services header */}
          <View style={styles.svcHeader}>
            <View>
              <Text style={styles.section}>Our services</Text>
              <Text style={styles.sectionSub}>Care that reaches you fast</Text>
            </View>
            <TouchableOpacity onPress={() => navigation.navigate('BloodHome')}>
              <Text style={styles.seeAll}>See all</Text>
            </TouchableOpacity>
          </View>

          {/* Big blood card */}
          <TouchableOpacity activeOpacity={0.9} onPress={() => navigation.navigate('BloodHome')} style={[styles.bigCard, { backgroundColor: colors.bloodLight }]}>
            <View style={styles.cardTop}>
              <View style={[styles.circle, { backgroundColor: colors.blood }]}><Icon name="blood" size={26} color={colors.white} /></View>
              <ArrowBadge />
            </View>
            <Text style={styles.bigTitle}>Blood Donation</Text>
            <Text style={styles.bigSub}>Find donors or request blood near you</Text>
          </TouchableOpacity>

          {/* Two small service cards */}
          <View style={styles.smallRow}>
            {SERVICES_SMALL.map((s) => (
              <TouchableOpacity key={s.key} activeOpacity={0.9} onPress={() => navigation.navigate(s.key)} style={[styles.smallCard, { backgroundColor: s.tint }]}>
                <View style={styles.cardTop}>
                  <View style={[styles.circle, { backgroundColor: s.color }]}><Icon name={s.icon} size={22} color={colors.white} /></View>
                  <ArrowBadge />
                </View>
                <Text style={styles.smallTitle}>{s.title}</Text>
                <Text style={styles.smallSub}>{s.subtitle}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Quick actions */}
          <Text style={[styles.section, { marginTop: spacing.xl, marginBottom: spacing.md }]}>Quick actions</Text>
          <View style={styles.quickGrid}>
            {QUICK.map((q) => (
              <TouchableOpacity key={q.label} activeOpacity={0.9} onPress={() => navigation.navigate(q.to)} style={[styles.quickCard, shadow.soft]}>
                <View style={[styles.quickIcon, { backgroundColor: q.color }]}><Icon name={q.icon} size={20} color={colors.white} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.quickTitle}>{q.label}</Text>
                  <Text style={styles.quickSub}>{q.sub}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        <ProfilePreviewModal
          visible={preview}
          onClose={() => setPreview(false)}
          path={profile?.profile_image}
          name={user?.name}
        />
      </SafeAreaView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.xl },
  profileSection: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  statusPill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.sm, paddingVertical: 5, borderRadius: radius.pill, ...shadow.soft },
  verifiedText: { marginLeft: 4, color: colors.white, fontWeight: font.bold, fontSize: font.tiny },
  unverifiedPill: { backgroundColor: colors.white, borderWidth: 1, borderColor: '#F6E3B8' },
  unverifiedText: { marginLeft: 4, color: '#8A6300', fontWeight: font.bold, fontSize: font.tiny },
  reviewPill: { backgroundColor: '#FFF4E0', borderWidth: 1, borderColor: '#F6E3B8' },
  reviewText: { marginLeft: 4, color: '#8A6300', fontWeight: font.bold, fontSize: font.tiny },
  bell: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', ...shadow.soft },
  bellDot: {
    position: 'absolute', top: -2, right: -2, width: 11, height: 11, borderRadius: 6,
    backgroundColor: colors.blood, borderWidth: 2, borderColor: colors.white,
  },

  greetRow: { flexDirection: 'row', alignItems: 'flex-start' },
  avatarWrap: { borderRadius: 43, padding: 2, backgroundColor: colors.white, marginRight: 0 },
  welcome: { color: colors.textMuted, fontSize: font.tiny, fontWeight: font.bold, letterSpacing: 1.5 },
  hello: { fontSize: 30, fontWeight: font.bold, color: colors.text, marginTop: 4, lineHeight: 36 },
  name: { fontSize: 36, fontWeight: font.bold, color: colors.primary, lineHeight: 30 },
  tagline: { color: colors.textMuted, fontSize: font.body, marginTop: spacing.md, marginBottom: spacing.xl, lineHeight: 21 },

  sos: { flexDirection: 'row', alignItems: 'center', borderRadius: radius.lg, padding: spacing.lg, backgroundColor: colors.blood },
  sosIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center', marginRight: spacing.md },
  sosLabel: { color: 'rgba(255,255,255,0.85)', fontSize: font.tiny, fontWeight: font.bold, letterSpacing: 1.2 },
  sosTitle: { color: colors.white, fontWeight: font.bold, fontSize: font.h3, marginTop: 2 },
  sosSub: { color: 'rgba(255,255,255,0.9)', fontSize: font.small, marginTop: 2 },
  arrowBadge: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },

  svcHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginTop: spacing.xl, marginBottom: spacing.md },
  section: { fontSize: font.h2, fontWeight: font.bold, color: colors.text },
  sectionSub: { color: colors.textMuted, fontSize: font.small, marginTop: 2 },
  seeAll: { color: colors.primary, fontWeight: font.bold, fontSize: font.body, marginTop: 4 },

  bigCard: { borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xl },
  circle: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  bigTitle: { fontSize: font.h2, fontWeight: font.bold, color: colors.text },
  bigSub: { color: colors.textMuted, fontSize: font.small, marginTop: 4 },

  smallRow: { flexDirection: 'row', justifyContent: 'space-between' },
  smallCard: { width: '48.5%', borderRadius: radius.lg, padding: spacing.lg },
  smallTitle: { fontSize: font.body, fontWeight: font.bold, color: colors.text },
  smallSub: { color: colors.textMuted, fontSize: font.tiny, marginTop: 3 },

  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  quickCard: { width: '48.5%', flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md },
  quickIcon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  quickTitle: { fontSize: font.small, fontWeight: font.bold, color: colors.text },
  quickSub: { fontSize: font.tiny, color: colors.textMuted, marginTop: 2 },
});
