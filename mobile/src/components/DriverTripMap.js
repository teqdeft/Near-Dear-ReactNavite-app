import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, Platform } from 'react-native';
import MapView, { PROVIDER_GOOGLE, Marker } from 'react-native-maps';
import { colors, radius, font, spacing } from '../theme';

const num = (v) => (v == null || v === '' ? null : Number(v));

/**
 * Driver-side trip map: shows the user's pickup point + the driver's own live
 * location (blue dot), plus a "Navigate" button that opens Google Maps
 * turn-by-turn directions to the pickup. Renders nothing if the request has no
 * pickup coordinates.
 */
export default function DriverTripMap({ pickup, height = 190 }) {
  const p = pickup && pickup.lat != null && pickup.lng != null
    ? { latitude: num(pickup.lat), longitude: num(pickup.lng) }
    : null;
  if (!p) return null;

  const navigate = () => {
    const gmaps = `https://www.google.com/maps/dir/?api=1&destination=${p.latitude},${p.longitude}&travelmode=driving`;
    const androidNav = `google.navigation:q=${p.latitude},${p.longitude}`;
    const primary = Platform.OS === 'android' ? androidNav : gmaps;
    Linking.openURL(primary).catch(() => Linking.openURL(gmaps).catch(() => {}));
  };

  return (
    <View style={styles.wrap}>
      <View style={[styles.mapWrap, { height }]}>
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
  navBtn: {
    marginTop: spacing.sm, backgroundColor: colors.ambulance,
    paddingVertical: 12, borderRadius: radius.md, alignItems: 'center',
  },
  navTxt: { color: colors.white, fontWeight: font.bold, fontSize: font.body },
});
