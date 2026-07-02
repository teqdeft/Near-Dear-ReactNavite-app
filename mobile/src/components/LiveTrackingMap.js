import React, { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View, Text, Platform } from 'react-native';
import MapView, {
  PROVIDER_GOOGLE,
  Marker,
  MarkerAnimated,
  AnimatedRegion,
} from 'react-native-maps';
import { colors, radius, font, spacing } from '../theme';

const num = (v) => (v == null || v === '' ? null : Number(v));
// India centroid — only used as a last-resort fallback before any coords exist.
const FALLBACK = { latitude: 20.5937, longitude: 78.9629 };
const ANIM_MS = 1000;

/**
 * Live ambulance map. The ambulance marker animates (interpolates) smoothly
 * between the 5-second location updates instead of jumping.
 *
 * Props: latitude, longitude, bearing (live ambulance position),
 *        pickup {lat,lng}, drop {lat,lng}, height.
 */
export default function LiveTrackingMap({ latitude, longitude, bearing, pickup, drop, height = 260 }) {
  const lat = num(latitude);
  const lng = num(longitude);
  const hasLive = lat != null && lng != null;

  const pick = pickup && pickup.lat != null ? { latitude: num(pickup.lat), longitude: num(pickup.lng) } : null;
  const dropC = drop && drop.lat != null ? { latitude: num(drop.lat), longitude: num(drop.lng) } : null;

  // Initial region: computed once from the best coordinate we have on first render.
  const initialRegion = useMemo(() => {
    const c = (hasLive && { latitude: lat, longitude: lng }) || pick || dropC || FALLBACK;
    return { ...c, latitudeDelta: 0.02, longitudeDelta: 0.02 };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const mapRef = useRef(null);
  const coord = useRef(
    new AnimatedRegion({
      latitude: initialRegion.latitude,
      longitude: initialRegion.longitude,
      latitudeDelta: 0,
      longitudeDelta: 0,
    }),
  ).current;

  // Animate the marker + camera to each new live position.
  useEffect(() => {
    if (!hasLive) return;
    const next = { latitude: lat, longitude: lng };
    coord.timing({ ...next, duration: ANIM_MS, useNativeDriver: false }).start();
    mapRef.current?.animateCamera({ center: next }, { duration: ANIM_MS });
  }, [lat, lng, hasLive, coord]);

  return (
    <View style={[styles.wrap, { height }]}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={StyleSheet.absoluteFill}
        initialRegion={initialRegion}
        showsUserLocation={false}
        showsMyLocationButton={false}
        toolbarEnabled={false}
        loadingEnabled
      >
        {hasLive && (
          <MarkerAnimated
            coordinate={coord}
            anchor={{ x: 0.5, y: 0.5 }}
            rotation={bearing != null ? Number(bearing) : 0}
            flat
            title="Ambulance"
          >
            <View style={styles.ambPin}>
              <Text style={styles.ambEmoji}>🚑</Text>
            </View>
          </MarkerAnimated>
        )}
        {pick && <Marker coordinate={pick} title="Pickup" pinColor={colors.ambulance} />}
        {dropC && <Marker coordinate={dropC} title="Drop" pinColor={colors.danger} />}
      </MapView>

      {!hasLive && (
        <View style={styles.overlay} pointerEvents="none">
          <Text style={styles.overlayText}>Waiting for the driver’s live location…</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.surfaceAlt },
  ambPin: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: colors.surface,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: colors.ambulance,
  },
  ambEmoji: { fontSize: 18 },
  overlay: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    paddingVertical: spacing.sm, backgroundColor: colors.overlay, alignItems: 'center',
  },
  overlayText: { color: colors.white, fontSize: font.small, fontWeight: font.medium },
});
