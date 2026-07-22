import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Animated, Easing, RefreshControl, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import { useAuth } from '../store/AuthContext';
import { useNotifications } from '../store/NotificationContext';
import { useCart } from '../store/CartContext';
import { OrderApi, AmbulanceApi, BloodApi } from '../api';
import { statusLabel } from '../utils/status';
import Icon from '../components/Icon';
import ProfileAvatar from '../components/ProfileAvatar';
import ProfilePreviewModal from '../components/ProfilePreviewModal';
import GradientBackground from '../components/GradientBackground';
import { colors, spacing, font, radius, shadow } from '../theme';

function VerifyNowPill({ onPress }) {
  const pulse = useRef(new Animated.Value(0)).current;
  const isFocused = useIsFocused();

  useEffect(() => {
    if (!isFocused) return undefined; // don't animate while the screen is in the background
    pulse.setValue(0); // restart cleanly after a stop
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, isFocused]);

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

// Quick access to the pharmacy cart, sitting next to the bell in the header.
// Always visible; the count badge shows only when the cart has items. Opens the
// Cart stack screen (same target the pharmacy screens navigate to).
function CartButton({ count, onPress }) {
  return (
    <TouchableOpacity style={styles.bell} onPress={onPress} activeOpacity={0.85}>
      <Icon name="cart" size={20} color={colors.text} />
      {count > 0 ? (
        <View style={styles.cartBadge}>
          <Text style={styles.cartBadgeText}>{count > 99 ? '99+' : count}</Text>
        </View>
      ) : null}
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

// A small "24×7" pill that gently blinks, to signal the emergency line is always
// live. Same Animated.loop pattern as VerifyNowPill above.
function LiveBadge() {
  const blink = useRef(new Animated.Value(1)).current;
  const isFocused = useIsFocused();
  useEffect(() => {
    if (!isFocused) return undefined; // pause the blink when off-screen
    blink.setValue(1); // restart from fully visible after a stop
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(blink, { toValue: 0.25, duration: 650, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(blink, { toValue: 1, duration: 650, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [blink, isFocused]);

  return (
    <Animated.View style={[styles.liveBadge, { opacity: blink }]}>
      <View style={styles.liveDot} />
      <Text style={styles.liveText}>24×7</Text>
    </Animated.View>
  );
}

// The ambulance in the emergency card drives across a little road: it travels
// left → right, slips off the right edge (clipped by the circle), then re-enters
// from the left and repeats — a continuous "on the way" loop.
function RunningAmbulance() {
  const drive = useRef(new Animated.Value(0)).current;
  const isFocused = useIsFocused();
  useEffect(() => {
    if (!isFocused) return undefined; // stop driving when the user leaves Home
    // stop() freezes the value wherever it was (often off the right edge). Reset
    // to the left before looping, else it re-runs 1→1 and the ambulance stays hidden.
    drive.setValue(0);
    const loop = Animated.loop(
      Animated.timing(drive, { toValue: 1, duration: 2800, easing: Easing.linear, useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, [drive, isFocused]);

  // Start fully off the left edge, end fully off the right edge; the reset back to
  // the left happens while it's hidden, so the loop looks seamless.
  const translateX = drive.interpolate({ inputRange: [0, 1], outputRange: [-40, 40] });

  return (
    <View style={styles.sosIcon}>
      {/* the road */}
      <View style={styles.sosRoad}>
        {[0, 1, 2, 3].map((i) => <View key={i} style={styles.sosRoadDash} />)}
      </View>
      {/* the ambulance driving on it */}
      <Animated.View style={{ transform: [{ translateX }, { translateY: 3 }] }}>
        <Icon name="ambulance" size={24} color={colors.white} />
      </Animated.View>
    </View>
  );
}

const SERVICES_SMALL = [
  { key: 'AmbulanceHome', title: 'Ambulance', subtitle: 'Book emergency transport', icon: 'ambulance', color: colors.ambulance, tint: colors.ambulanceLight },
  { key: 'PharmacyHome', title: 'Medicines', subtitle: 'Order from nearby pharmacies', icon: 'pharmacy', color: colors.pharmacy, tint: colors.pharmacyLight },
];

// `badge` marks a tile that shows a live count.
const QUICK = [
  { icon: 'water', label: 'Donate blood', sub: 'Save a life', to: 'BecomeDonor', color: colors.blood },
  { icon: 'hand-heart-outline', label: 'Request blood', sub: 'Find donors', to: 'CreateBloodRequest', color: colors.orange },
  { icon: 'clipboard-list-outline', label: 'My orders', sub: 'Track status', to: 'Orders', color: colors.pharmacy, badge: 'orders' },
  { icon: 'message-text-outline', label: 'Support', sub: "We're here 24/7", to: 'Support', color: colors.ambulance },
];

// A medicine order is "live" (worth tracking on Home) until it reaches one of
// these. Field is order_status — matching the Orders screens.
const ORDER_TERMINAL = ['delivered', 'cancelled', 'rejected'];
// The 4 stages the home tracker shows, in order. The raw status maps onto these:
// placed -> nothing lit yet, accepted -> Confirmed, preparing -> Packed,
// out_for_delivery -> On the way, delivered -> Delivered (card is gone by then).
const ORDER_FLOW = [
  { key: 'accepted', label: 'Confirmed' },
  { key: 'preparing', label: 'Packed' },
  { key: 'out_for_delivery', label: 'On the way' },
  { key: 'delivered', label: 'Delivered' },
];
const ORDER_STATUS_COLOR = {
  placed: colors.info, accepted: colors.primary, preparing: colors.primary,
  out_for_delivery: colors.warning, delivered: colors.success,
};

// An ambulance request is "active" (worth a live banner) until it's completed or
// cancelled. Each stage gets a plain-language headline for the banner.
const AMB_ACTIVE = ['requested', 'assigned', 'accepted', 'on_the_way', 'picked_up'];
const AMB_TITLE = {
  requested: 'Finding an ambulance',
  assigned: 'Ambulance assigned',
  accepted: 'Driver is on the way',
  on_the_way: 'Ambulance on the way',
  picked_up: 'On the way to hospital',
};

// A small blinking "LIVE" dot — signals the ride is being tracked in real time.
// Focus-gated so it stops (and stops drawing battery) when Home isn't visible.
function LiveDot({ style }) {
  const pulse = useRef(new Animated.Value(1)).current;
  const isFocused = useIsFocused();
  useEffect(() => {
    if (!isFocused) return undefined;
    pulse.setValue(1);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.3, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, isFocused]);
  return <Animated.View style={[styles.rideLiveDot, style, { opacity: pulse }]} />;
}

// Section heading above whatever is live right now (ambulance trip, active
// orders, incoming blood requests) — a pulsing red dot + "Happening now" +
// a count chip, so the user instantly reads this block as live activity.
function LiveNowHeader({ count }) {
  return (
    <View style={styles.liveHead}>
      <LiveDot style={styles.liveHeadDot} />
      <Text style={styles.liveHeadTitle}>Your live activity</Text>
      {count > 1 ? (
        <View style={styles.liveHeadCount}><Text style={styles.liveHeadCountText}>{count}</Text></View>
      ) : null}
    </View>
  );
}

// A flashing color layer that sits BEHIND a card's content and rhythmically
// tints the whole card — so an active ambulance ride or an urgent blood request
// visibly "flickers" and pulls the eye, while the text/icons on top stay crisp.
// Drop it as the first child inside the card. Focus-gated so it stops animating
// (and drawing battery) when Home isn't on screen.
function LiveFlash({ color, radius: r = radius.lg, max = 0.5, min = 0.06 }) {
  const pulse = useRef(new Animated.Value(0)).current;
  const isFocused = useIsFocused();
  useEffect(() => {
    if (!isFocused) return undefined;
    pulse.setValue(0);
    // Slower, symmetric ease in/out = a smooth breathing flicker rather than a
    // hard blink; it never fully turns off (min floor) so the pulse feels fluid.
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 950, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 950, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, isFocused]);

  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [min, max] });
  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { borderRadius: r, backgroundColor: color, opacity }]}
    />
  );
}

// Live banner for the user's in-progress ambulance ride. Takes the emergency
// card's spot on Home (which is hidden while a ride is active) so the user sees
// tracking, not a redundant "book" prompt. Tap to open the full tracking screen.
function AmbulanceRideBanner({ ride, onPress }) {
  return (
    <TouchableOpacity activeOpacity={0.92} onPress={onPress} style={[styles.ride, shadow.card]}>
      {/* whole-card flicker — a brighter blue that pulses over the base */}
      <LiveFlash color="#60A5FA" radius={radius.lg} max={0.55} />
      {/* same driving ambulance as the emergency card — the trip is in motion */}
      <RunningAmbulance />
      <View style={{ flex: 1 }}>
        <View style={styles.rideLabelRow}>
          {/* A red "LIVE" pill with a blinking dot — pops on the blue card and
              reads as an emergency in progress. "TRACKING" trails it, muted. */}
          <View style={styles.livePill}>
            <LiveDot />
            <Text style={styles.livePillText}>LIVE</Text>
          </View>
          <Text style={styles.rideLabel}>TRACKING</Text>
        </View>
        <Text style={styles.rideTitle} numberOfLines={1}>{AMB_TITLE[ride.status] || 'Ambulance booked'}</Text>
        {/* Route — where the ambulance is taking the patient (from → to) */}
        <Text style={styles.rideSub} numberOfLines={1}>{ride.pickup_address}  →  {ride.drop_address}</Text>
      </View>
      <View style={styles.rideArrow}><Icon name="arrowUpRight" size={18} color={colors.ambulance} /></View>
    </TouchableOpacity>
  );
}

// Live tracker for the user's current medicine order — shown on Home, below the
// emergency card, until the order is delivered. The progress bar + stage labels
// reflect the order's real status, so it stays in step as the order advances.
function OrderTrackerCard({ order, onPress }) {
  const idx = ORDER_FLOW.findIndex((s) => s.key === order.order_status); // -1 while still 'placed'
  const pct = Math.max(0, (idx + 1) / ORDER_FLOW.length) * 100;
  const accent = ORDER_STATUS_COLOR[order.order_status] || colors.textMuted;
  // Pharmacy shown with its city; delivery address built from line + city.
  const pharmacyLine = order.pharmacy_city
    ? `${order.pharmacy_name}, ${order.pharmacy_city}`
    : (order.pharmacy_name || 'Medicines');
  const deliverTo = [order.delivery_line1, order.delivery_city].filter(Boolean).join(', ');
  return (
    <TouchableOpacity activeOpacity={0.9} onPress={onPress} style={[styles.tracker, shadow.soft]}>
      <View style={styles.trackTop}>
        <View style={styles.trackIcon}><Icon name="truck" size={18} color={colors.pharmacy} /></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.trackTitle} numberOfLines={1}>Order {order.order_number}</Text>
          <Text style={styles.trackSub} numberOfLines={1}>{pharmacyLine}</Text>
        </View>
        <View style={[styles.trackPill, { backgroundColor: accent + '18' }]}>
          <Text style={[styles.trackPillText, { color: accent }]}>{statusLabel(order.order_status)}</Text>
        </View>
      </View>

      {/* Where it's headed */}
      {deliverTo ? (
        <View style={styles.trackInfo}>
          <Icon name="location" size={13} color={colors.textMuted} />
          <Text style={styles.trackInfoText} numberOfLines={1}>Deliver to: {deliverTo}</Text>
        </View>
      ) : null}

      <View style={styles.trackBar}><View style={[styles.trackBarFill, { width: `${pct}%` }]} /></View>
      <View style={styles.trackSteps}>
        {ORDER_FLOW.map((s, i) => (
          <Text key={s.key} style={[styles.trackStep, i <= idx && styles.trackStepDone]}>{s.label}</Text>
        ))}
      </View>
    </TouchableOpacity>
  );
}

// Shows the user's live orders on Home. One order -> a single full-width card.
// More than one -> a smooth, snapping carousel where the next card peeks on the
// right (so it clearly reads as swipeable), with page dots beneath.
function OrderTracker({ orders, onOpen }) {
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(0);

  const GAP = spacing.md;
  const contentW = width - spacing.lg * 2;        // Home content sits inside lg padding
  const cardW = contentW - 36;                    // leave ~36px so the next card peeks
  const interval = cardW + GAP;
  // Snap points, clamped to how far the list can actually scroll. Unclamped,
  // the LAST card's offset lands past the scrollable end — the snap engine
  // targets an unreachable point and the list settles stuck between cards.
  const maxScroll = Math.max(0, orders.length * cardW + (orders.length - 1) * GAP + spacing.lg - contentW);
  const snapOffsets = orders.map((_, i) => Math.min(i * interval, maxScroll));
  const scrollRef = useRef(null);

  const onScrollEnd = (e) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / interval);
    if (i !== index) setIndex(i);
  };

  // Android: a drag released slowly (near-zero velocity) never enters the
  // momentum phase, and native snapping only runs WITH momentum — the list
  // just freezes mid-way. Finish the snap ourselves in that case.
  const onDragEnd = (e) => {
    const vx = e.nativeEvent.velocity?.x ?? 0;
    if (Math.abs(vx) > 0.1) return; // real fling — native snap handles it
    const x = e.nativeEvent.contentOffset.x;
    const i = Math.min(orders.length - 1, Math.max(0, Math.round(x / interval)));
    scrollRef.current?.scrollTo({ x: Math.min(i * interval, maxScroll), animated: true });
    if (i !== index) setIndex(i);
  };

  if (orders.length <= 1) {
    return (
      <View style={styles.trackerWrap}>
        {orders[0] ? <OrderTrackerCard order={orders[0]} onPress={() => onOpen(orders[0])} /> : null}
      </View>
    );
  }

  return (
    <View style={styles.trackerWrap}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"        // crisp, phone-native snap feel
        // Explicit per-card snap points (clamped to the scrollable end) — more
        // reliable than snapToInterval on Android, and without the interval-
        // momentum lock a small flick is enough to advance to the next card.
        snapToOffsets={snapOffsets}
        onScrollEndDrag={onDragEnd}
        onMomentumScrollEnd={onScrollEnd}
        contentContainerStyle={{ paddingRight: spacing.lg }}
      >
        {orders.map((o, i) => (
          <View key={o.id} style={{ width: cardW, marginRight: i < orders.length - 1 ? GAP : 0 }}>
            <OrderTrackerCard order={o} onPress={() => onOpen(o)} />
          </View>
        ))}
      </ScrollView>
      <View style={styles.dots}>
        {orders.map((o, i) => (
          <View key={o.id} style={[styles.dot, i === index && styles.dotActive]} />
        ))}
      </View>
    </View>
  );
}

// A blood request the donor hasn't acted on yet, and whose request is still open.
const BLOOD_CLOSED = ['fulfilled', 'cancelled', 'expired'];
// Higher = more urgent; used to float the most urgent requests into the carousel.
const URGENCY_RANK = { critical: 2, urgent: 1, normal: 0 };

// One compact blood-request card for the home carousel: a blood-drop chip, a
// bold headline (urgency + group), the hospital line, and a red "Help" pill.
// Tapping opens the donor's requests screen to accept or decline with context.
function BloodRequestMini({ req, onPress }) {
  const label = req.urgency_level === 'critical' ? 'Critical'
    : req.urgency_level === 'urgent' ? 'Urgent' : null;
  const title = label
    ? `${label}: ${req.blood_group_required} needed nearby`
    : `${req.blood_group_required} blood needed nearby`;
  const sub = [req.hospital_name, req.city].filter(Boolean).join(', ');
  return (
    <TouchableOpacity activeOpacity={0.9} onPress={onPress} style={styles.blood}>
      {/* whole-card flicker — a red pulse over the soft pink base */}
      <LiveFlash color={colors.blood} radius={radius.lg} max={0.28} />
      <View style={styles.bloodIcon}><Icon name="blood" size={20} color={colors.blood} /></View>
      <View style={{ flex: 1, marginHorizontal: spacing.sm }}>
        <Text style={styles.bloodTitle} numberOfLines={2}>{title}</Text>
        {sub ? <Text style={styles.bloodSub} numberOfLines={2}>{sub}</Text> : null}
      </View>
      <View style={styles.bloodBtn}><Text style={styles.bloodBtnText}>Help</Text></View>
    </TouchableOpacity>
  );
}

// "Blood needed near you" — up to 3 most-urgent requests as a swipeable carousel,
// with a "+N more" link to the full donor-requests list for the rest.
function BloodAlert({ requests, moreCount, onOpen, onSeeAll }) {
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const GAP = spacing.md;
  const contentW = width - spacing.lg * 2;
  const single = requests.length <= 1;
  const cardW = single ? contentW : contentW - 36;
  const interval = cardW + GAP;
  // Same fixes as OrderTracker: clamp snap points to the real scrollable end
  // (an unreachable last offset leaves the list stuck between cards), and
  // hand-finish the snap when a slow drag ends with no momentum (Android).
  const maxScroll = Math.max(0, requests.length * cardW + (requests.length - 1) * GAP + spacing.lg - contentW);
  const snapOffsets = requests.map((_, i) => Math.min(i * interval, maxScroll));
  const scrollRef = useRef(null);
  const onScrollEnd = (e) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / interval);
    if (i !== index) setIndex(i);
  };
  const onDragEnd = (e) => {
    const vx = e.nativeEvent.velocity?.x ?? 0;
    if (Math.abs(vx) > 0.1) return; // real fling — native snap handles it
    const x = e.nativeEvent.contentOffset.x;
    const i = Math.min(requests.length - 1, Math.max(0, Math.round(x / interval)));
    scrollRef.current?.scrollTo({ x: Math.min(i * interval, maxScroll), animated: true });
    if (i !== index) setIndex(i);
  };

  return (
    <View style={styles.bloodWrap}>
      <View style={styles.bloodHead}>
        <Text style={styles.bloodHeadTitle}>Blood needed near you</Text>
        {moreCount > 0 ? (
          <TouchableOpacity onPress={onSeeAll}><Text style={styles.bloodMore}>+{moreCount} more</Text></TouchableOpacity>
        ) : null}
      </View>

      {single ? (
        <BloodRequestMini req={requests[0]} onPress={() => onOpen(requests[0])} />
      ) : (
        <>
          <ScrollView
            ref={scrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            decelerationRate="fast"
            // Per-card snap points (clamped): reliable on Android and a light
            // flick moves one card — no sticking mid-way.
            snapToOffsets={snapOffsets}
            onScrollEndDrag={onDragEnd}
            onMomentumScrollEnd={onScrollEnd}
            contentContainerStyle={{ paddingRight: spacing.lg }}
          >
            {requests.map((r, i) => (
              <View key={r.match_id} style={{ width: cardW, marginRight: i < requests.length - 1 ? GAP : 0 }}>
                <BloodRequestMini req={r} onPress={() => onOpen(r)} />
              </View>
            ))}
          </ScrollView>
          <View style={styles.dots}>
            {requests.map((r, i) => (
              <View key={r.match_id} style={[styles.dot, i === index && styles.dotActiveBlood]} />
            ))}
          </View>
        </>
      )}
    </View>
  );
}

export default function HomeScreen({ navigation }) {
  const { user, profile, aadhaarVerified, refreshUser } = useAuth();
  const { unread, refresh: refreshNotifications } = useNotifications();
  const { count: cartCount } = useCart(); // total items in the pharmacy cart
  const firstName = (user?.name || 'there').split(' ')[0];
  const city = profile?.city;
  // Greet by time of day — warmer than a static "Welcome back".
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const [preview, setPreview] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [orders, setOrders] = useState([]);
  const [rides, setRides] = useState([]);
  const [bloodReqs, setBloodReqs] = useState([]);
  // KYC is pending while a manual Aadhaar submission is awaiting admin review.
  const aadhaarPending = user?.aadhaar_kyc_status === 'pending';

  // Pull the user's live orders, ambulance rides, and incoming blood requests
  // together, each guarded so one failing never blocks the others or the screen.
  const loadActive = useCallback(async () => {
    const [o, r, b] = await Promise.all([
      OrderApi.myOrders().catch(() => []),
      AmbulanceApi.myRequests().catch(() => []),
      BloodApi.incomingRequests().catch(() => []),
    ]);
    setOrders(o || []);
    setRides(r || []);
    setBloodReqs(b || []);
  }, []);
  // Re-fetch every time Home comes into focus, so the trackers reflect the latest
  // status (e.g. after the pharmacy dispatches, or the ambulance is accepted).
  useFocusEffect(useCallback(() => { loadActive(); }, [loadActive]));

  // Orders still in flight — drive both the "My orders" badge and the live
  // tracker cards. `orders` arrives newest-first from the API, so the latest
  // order is the first card the user sees.
  const activeOrders = orders.filter((o) => !ORDER_TERMINAL.includes(o.order_status));
  // The user's in-progress ambulance ride, if any (newest-first, so [0] wins).
  const activeRide = rides.find((r) => AMB_ACTIVE.includes(r.status));

  // Blood requests this donor can still act on, most urgent first. The carousel
  // shows the top 3; the rest fall to a "+N more" link into the requests screen.
  const bloodActionable = bloodReqs
    .filter((r) => r.response_status === 'pending' && !BLOOD_CLOSED.includes(r.status))
    .sort((a, b) => {
      const u = (URGENCY_RANK[b.urgency_level] || 0) - (URGENCY_RANK[a.urgency_level] || 0);
      if (u !== 0) return u;                                  // urgent/critical first
      const ra = a.required_at || '9999';                     // then soonest-needed
      const rb = b.required_at || '9999';
      if (ra !== rb) return ra < rb ? -1 : 1;
      return b.request_id - a.request_id;                     // then newest
    });
  const bloodTop = bloodActionable.slice(0, 3);
  const bloodMore = bloodActionable.length - bloodTop.length;

  // The live number shown on a quick-action tile, or 0 when it has no badge.
  const badgeFor = (q) => (q.badge === 'orders' ? activeOrders.length : 0);

  // Everything currently "live" on Home — drives the "Happening now" heading.
  const liveCount = (activeRide ? 1 : 0) + activeOrders.length + bloodTop.length;

  const onRefresh = async () => {
    setRefreshing(true);
    try { await Promise.all([refreshUser(), refreshNotifications(), loadActive()]); } catch (e) { /* ignore */ }
    finally { setRefreshing(false); }
  };

  return (
    <GradientBackground>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />}>
          {/* Header — avatar, time-based greeting, name + verified badge, city, bell */}
          <View style={styles.header}>
            <TouchableOpacity activeOpacity={0.85} onPress={() => setPreview(true)}>
              <ProfileAvatar path={profile?.profile_image} name={user?.name} size={60} />
            </TouchableOpacity>

            <View style={styles.headerMid}>
              <Text style={styles.greeting}>{greeting}</Text>
              <View style={styles.nameRow}>
                <Text style={styles.name} numberOfLines={1}>{firstName}</Text>
                {/* Verified tick / Under review / Verify now — right after the name */}
                {aadhaarVerified ? (
                  <Icon name="check-decagram" size={16} color={colors.primary} style={{ marginLeft: 6 }} />
                ) : aadhaarPending ? (
                  <TouchableOpacity style={[styles.statusPill, styles.reviewPill, { marginLeft: 6 }]} onPress={() => navigation.navigate('AadhaarUpload')}>
                    <Icon name="clock" size={12} color={colors.warning} />
                    <Text style={styles.reviewText}>Under review</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={{ marginLeft: 6 }}>
                    <VerifyNowPill onPress={() => navigation.navigate('AadhaarUpload')} />
                  </View>
                )}
              </View>
              {city ? (
                <View style={styles.cityRow}>
                  <Icon name="location" size={14} color={colors.primaryDark} />
                  <Text style={styles.city} numberOfLines={1}>{city}</Text>
                </View>
              ) : null}
            </View>

            <View style={styles.headerActions}>
              <CartButton count={cartCount} onPress={() => navigation.navigate('Cart')} />
              <NotificationBell hasUnread={unread > 0} onPress={() => navigation.navigate('Alerts')} />
            </View>
          </View>

          {/* A live ambulance ride replaces the "book" card — no point offering to
              book when one is already on the way. The "Happening now" heading
              tops the ride banner; without a ride it appears further down, above
              the order/blood blocks (so it never crowns the static book-CTA). */}
          {activeRide ? (
            <>
              <LiveNowHeader count={liveCount} />
              <AmbulanceRideBanner ride={activeRide} onPress={() => navigation.navigate('AmbulanceDetail', { id: activeRide.id })} />
            </>
          ) : (
            <TouchableOpacity activeOpacity={0.92} onPress={() => navigation.navigate('BookAmbulance')} style={[styles.sos, shadow.card]}>
              <RunningAmbulance />
              <View style={{ flex: 1 }}>
                <View style={styles.sosLabelRow}>
                  <Text style={styles.sosLabel}>EMERGENCY</Text>
                  <LiveBadge />
                </View>
                <Text style={styles.sosTitle}>Need urgent help?</Text>
                <Text style={styles.sosSub}>Book an ambulance in seconds</Text>
              </View>
              <ArrowBadge color={colors.blood} />
            </TouchableOpacity>
          )}

          {/* No ride banner above? The live heading sits here instead, ahead of
              the order/blood trackers. */}
          {!activeRide && liveCount > 0 ? <LiveNowHeader count={liveCount} /> : null}

          {/* Live order tracker(s) — a swipeable carousel when there's more than one */}
          {activeOrders.length > 0 ? (
            <OrderTracker orders={activeOrders} onOpen={(o) => navigation.navigate('OrderDetail', { id: o.id })} />
          ) : null}

          {/* Blood needed near you — urgent-first carousel of donor requests */}
          {bloodTop.length > 0 ? (
            <BloodAlert
              requests={bloodTop}
              moreCount={bloodMore}
              onOpen={() => navigation.navigate('DonorRequests')}
              onSeeAll={() => navigation.navigate('DonorRequests')}
            />
          ) : null}

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
            {QUICK.map((q) => {
              const badge = badgeFor(q);
              return (
                <TouchableOpacity key={q.label} activeOpacity={0.9} onPress={() => navigation.navigate(q.to)} style={[styles.quickCard, shadow.soft]}>
                  <View style={[styles.quickIcon, { backgroundColor: q.color }]}>
                    <Icon name={q.icon} size={20} color={colors.white} />
                    {badge > 0 ? (
                      <View style={styles.quickBadge}>
                        <Text style={styles.quickBadgeText}>{badge > 9 ? '9+' : badge}</Text>
                      </View>
                    ) : null}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.quickTitle}>{q.label}</Text>
                    <Text style={styles.quickSub}>{q.sub}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
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
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.lg },
  headerMid: { flex: 1, marginLeft: spacing.md },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  cartBadge: {
    position: 'absolute', top: -4, right: -4, minWidth: 18, height: 18, borderRadius: 9,
    backgroundColor: colors.pharmacy, borderWidth: 2, borderColor: colors.white,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4,
  },
  cartBadgeText: { color: colors.white, fontSize: 10, fontWeight: font.bold },
  greeting: { fontSize: font.small, color: colors.textMuted, fontWeight: font.medium, lineHeight: 17 },
  nameRow: { flexDirection: 'row', alignItems: 'center', marginTop: 1 },
  cityRow: { flexDirection: 'row', alignItems: 'center', marginTop: 3 },
  city: { fontSize: font.small, color: colors.primaryDark, fontWeight: font.semibold, marginLeft: 3, lineHeight: 16 },
  statusPill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.sm, paddingVertical: 5, borderRadius: radius.pill, ...shadow.soft },
  unverifiedPill: { backgroundColor: colors.white, borderWidth: 1, borderColor: '#F6E3B8' },
  unverifiedText: { marginLeft: 4, color: '#8A6300', fontWeight: font.bold, fontSize: font.tiny },
  reviewPill: { backgroundColor: '#FFF4E0', borderWidth: 1, borderColor: '#F6E3B8' },
  reviewText: { marginLeft: 4, color: '#8A6300', fontWeight: font.bold, fontSize: font.tiny },
  bell: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', ...shadow.soft },
  bellDot: {
    position: 'absolute', top: -2, right: -2, width: 11, height: 11, borderRadius: 6,
    backgroundColor: colors.blood, borderWidth: 2, borderColor: colors.white,
  },

  name: { flexShrink: 1, fontSize: 22, fontWeight: font.bold, color: colors.text, lineHeight: 26 },

  ride: { flexDirection: 'row', alignItems: 'center', borderRadius: radius.lg, padding: spacing.lg, backgroundColor: colors.ambulance },
  rideLabelRow: { flexDirection: 'row', alignItems: 'center' },
  rideLiveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.white, marginRight: 6 },
  livePill: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.blood,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill, marginRight: spacing.sm,
  },
  livePillText: { color: colors.white, fontSize: 10, fontWeight: font.bold, letterSpacing: 0.8 },
  rideLabel: { color: 'rgba(255,255,255,0.9)', fontSize: font.tiny, fontWeight: font.bold, letterSpacing: 1.2 },
  rideTitle: { color: colors.white, fontWeight: font.bold, fontSize: font.h3, marginTop: 3 },
  rideSub: { color: 'rgba(255,255,255,0.9)', fontSize: font.small, marginTop: 2 },
  rideArrow: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },

  sos: { flexDirection: 'row', alignItems: 'center', borderRadius: radius.lg, padding: spacing.lg, backgroundColor: colors.blood },
  sosIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center', marginRight: spacing.md, overflow: 'hidden' },
  sosRoad: { position: 'absolute', left: 0, right: 0, bottom: 12, flexDirection: 'row', justifyContent: 'center' },
  sosRoadDash: { width: 5, height: 2, borderRadius: 1, backgroundColor: 'rgba(255,255,255,0.55)', marginHorizontal: 2 },
  sosLabelRow: { flexDirection: 'row', alignItems: 'center' },
  sosLabel: { color: 'rgba(255,255,255,0.85)', fontSize: font.tiny, fontWeight: font.bold, letterSpacing: 1.2 },
  liveBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.22)', paddingHorizontal: 7, paddingVertical: 2, borderRadius: radius.pill, marginLeft: spacing.sm },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.white, marginRight: 4 },
  liveText: { color: colors.white, fontSize: 10, fontWeight: font.bold, letterSpacing: 0.5 },
  sosTitle: { color: colors.white, fontWeight: font.bold, fontSize: font.h3, marginTop: 2 },
  sosSub: { color: 'rgba(255,255,255,0.9)', fontSize: font.small, marginTop: 2 },
  arrowBadge: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },

  // "Happening now" — the live-activity section heading.
  liveHead: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.md, marginBottom: spacing.sm },
  liveHeadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.blood },
  liveHeadTitle: { fontSize: font.h3, fontWeight: font.bold, color: colors.text },
  liveHeadCount: {
    minWidth: 20, height: 20, borderRadius: 10, backgroundColor: colors.blood,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6, marginLeft: spacing.sm,
  },
  liveHeadCountText: { color: colors.white, fontSize: font.tiny, fontWeight: font.bold },

  trackerWrap: { marginTop: spacing.md },
  tracker: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md },
  dots: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: spacing.sm },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.border, marginHorizontal: 3 },
  dotActive: { width: 18, backgroundColor: colors.pharmacy },
  dotActiveBlood: { width: 18, backgroundColor: colors.blood },

  bloodWrap: { marginTop: spacing.md },
  bloodHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  bloodHeadTitle: { fontSize: font.h3, fontWeight: font.bold, color: colors.text },
  bloodMore: { fontSize: font.small, fontWeight: font.bold, color: colors.blood },
  blood: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bloodLight,
    borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: '#F8D7D7',
  },
  bloodIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  bloodTitle: { fontSize: font.body, fontWeight: font.bold, color: colors.text, lineHeight: 19 },
  bloodSub: { fontSize: font.tiny, color: colors.textMuted, marginTop: 3, lineHeight: 15 },
  bloodBtn: { backgroundColor: colors.blood, paddingHorizontal: 16, paddingVertical: 8, borderRadius: radius.pill },
  bloodBtnText: { color: colors.white, fontSize: font.small, fontWeight: font.bold },
  trackTop: { flexDirection: 'row', alignItems: 'center' },
  trackIcon: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.pharmacyLight, alignItems: 'center', justifyContent: 'center', marginRight: spacing.sm },
  trackTitle: { fontSize: font.small, fontWeight: font.bold, color: colors.text },
  trackSub: { fontSize: font.tiny, color: colors.textMuted, marginTop: 1 },
  trackPill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.pill },
  trackPillText: { fontSize: font.tiny, fontWeight: font.bold },
  trackInfo: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  trackInfoText: { flex: 1, marginLeft: 5, fontSize: font.tiny, color: colors.textMuted },
  trackBar: { height: 6, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt, marginTop: spacing.md, overflow: 'hidden' },
  trackBarFill: { height: '100%', borderRadius: radius.pill, backgroundColor: colors.primary },
  trackSteps: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  trackStep: { fontSize: font.tiny, color: colors.textMuted, fontWeight: font.medium },
  trackStepDone: { color: colors.primaryDark, fontWeight: font.bold },

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
  quickBadge: {
    position: 'absolute', top: -5, right: -5, minWidth: 18, height: 18, borderRadius: 9,
    backgroundColor: colors.blood, borderWidth: 2, borderColor: colors.surface,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3,
  },
  quickBadgeText: { color: colors.white, fontSize: 10, fontWeight: font.bold },
  quickTitle: { fontSize: font.small, fontWeight: font.bold, color: colors.text },
  quickSub: { fontSize: font.tiny, color: colors.textMuted, marginTop: 2 },
});
