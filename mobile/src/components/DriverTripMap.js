import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, Platform, useWindowDimensions } from 'react-native';
import MapView, { PROVIDER_GOOGLE, Marker } from 'react-native-maps';
import { colors, radius, font, spacing } from '../theme';

const num = (v) => (v == null || v === '' ? null : Number(v));

// The map sits inside a trip card with buttons below it, so it takes a smaller
// share of the screen than the patient's full-screen tracking map.
const HEIGHT_RATIO = 0.34;
const MIN_HEIGHT = 240;
const MAX_HEIGHT = 340;

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/**
 * Driver-side trip map: shows the user's pickup point + the driver's own live
 * location (blue dot), plus a "Navigate" button that opens Google Maps
 * turn-by-turn directions to the pickup. Renders nothing if the request has no
 * pickup coordinates.
 */
export default function DriverTripMap({ pickup, address, height }) {
  const { height: screenH } = useWindowDimensions();
  const mapH = height ?? clamp(Math.round(screenH * HEIGHT_RATIO), MIN_HEIGHT, MAX_HEIGHT);

  const p = pickup && pickup.lat != null && pickup.lng != null
    ? { latitude: num(pickup.lat), longitude: num(pickup.lng) }
    : null;

  const navigate = () => {
    const dest = p ? `${p.latitude},${p.longitude}` : (address ? encodeURIComponent(address) : null);
    if (!dest) return;
    const gmaps = `https://www.google.com/maps/dir/?api=1&destination=${dest}&travelmode=driving`;
    const androidNav = `google.navigation:q=${dest}`;
    const primary = Platform.OS === 'android' ? androidNav : gmaps;
    Linking.openURL(primary).catch(() => Linking.openURL(gmaps).catch(() => {}));
  };

  // No pinned coordinates — still let the driver navigate by the typed address.
  if (!p) {
    if (!address) return null;
    return (
      <View style={styles.wrap}>
        <View style={styles.noPin}>
          <Text style={styles.noPinText}>📍 Patient didn’t pin a map location. Navigate using their address:</Text>
          <Text style={styles.noPinAddr}>{address}</Text>
        </View>
        <TouchableOpacity style={styles.navBtn} onPress={navigate} activeOpacity={0.85}>
          <Text style={styles.navTxt}>🧭  Navigate to pickup</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <View style={[styles.mapWrap, { height: mapH }]}>
        <MapView
          provider={PROVIDER_GOOGLE}
          style={StyleSheet.absoluteFill}
          initialRegion={{ ...p, latitudeDelta: 0.02, longitudeDelta: 0.02 }}
          showsUserLocation
          showsMyLocationButton={false}
          toolbarEnabled={false}
          loadingEnabled
        >
          <Marker coordinate={p} title="Pickup" description="Patient pickup point" pinColor={colors.ambulance} />
        </MapView>
      </View>
      <TouchableOpacity style={styles.navBtn} onPress={navigate} activeOpacity={0.85}>
        <Text style={styles.navTxt}>🧭  Navigate to pickup</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: spacing.md },
  mapWrap: { borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.surfaceAlt },
  noPin: { backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: spacing.md },
  noPinText: { color: colors.textMuted, fontSize: font.small },
  noPinAddr: { color: colors.text, fontWeight: font.semibold, fontSize: font.body, marginTop: 4 },
  navBtn: {
    marginTop: spacing.sm, backgroundColor: colors.ambulance,
    paddingVertical: 12, borderRadius: radius.md, alignItems: 'center',
  },
  navTxt: { color: colors.white, fontWeight: font.bold, fontSize: font.body },
});
