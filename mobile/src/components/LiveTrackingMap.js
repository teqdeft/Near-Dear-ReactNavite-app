import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, useWindowDimensions } from 'react-native';
import MapView, {
  PROVIDER_GOOGLE,
  Marker,
  MarkerAnimated,
  AnimatedRegion,
  Polyline,
} from 'react-native-maps';
import { colors, radius, font, spacing } from '../theme';

const num = (v) => (v == null || v === '' ? null : Number(v));
// India centroid — only used as a last-resort fallback before any coords exist.
const FALLBACK = { latitude: 20.5937, longitude: 78.9629 };
const ANIM_MS = 1000;
// Leaves room for the pins and the overlay/button chrome when auto-fitting.
const EDGE_PADDING = { top: 80, right: 60, bottom: 80, left: 60 };
// Zoom used when the ambulance is the only point we can frame.
const SOLO_ZOOM = 15;
// The map is the point of this screen, so it takes a big share of the viewport.
// Clamped so it neither swallows a small phone nor floats on a tablet.
const HEIGHT_RATIO = 0.45;
const MIN_HEIGHT = 320;
const MAX_HEIGHT = 460;

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/**
 * Live ambulance map. The ambulance marker animates (interpolates) smoothly
 * between the 5-second location updates instead of jumping.
 *
 * The camera auto-fits the ambulance + pickup (+ drop) so both stay on screen
 * as the ambulance approaches. Once the user pans or pinches, auto-fit stops so
 * we don't fight their gesture; a "Recenter" button brings it back.
 *
 * Props: latitude, longitude, bearing (live ambulance position),
 *        pickup {lat,lng}, drop {lat,lng}, height (defaults to a share of the screen).
 */
export default function LiveTrackingMap({ latitude, longitude, bearing, pickup, drop, height }) {
  const { height: screenH } = useWindowDimensions();
  const mapH = height ?? clamp(Math.round(screenH * HEIGHT_RATIO), MIN_HEIGHT, MAX_HEIGHT);

  const lat = num(latitude);
  const lng = num(longitude);
  const hasLive = lat != null && lng != null;

  // Memoised so they stay referentially stable across the 5s re-renders,
  // otherwise the auto-fit effect below would re-run on every render.
  const pick = useMemo(
    () => (pickup?.lat != null ? { latitude: num(pickup.lat), longitude: num(pickup.lng) } : null),
    [pickup?.lat, pickup?.lng],
  );
  const dropC = useMemo(
    () => (drop?.lat != null ? { latitude: num(drop.lat), longitude: num(drop.lng) } : null),
    [drop?.lat, drop?.lng],
  );

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

  // True while the camera follows the ambulance; a user gesture turns it off.
  const [following, setFollowing] = useState(true);

  const fit = useCallback((coords) => {
    if (!coords.length) return;
    if (coords.length === 1) {
      mapRef.current?.animateCamera({ center: coords[0], zoom: SOLO_ZOOM }, { duration: ANIM_MS });
      return;
    }
    mapRef.current?.fitToCoordinates(coords, { edgePadding: EDGE_PADDING, animated: true });
  }, []);

  // Animate the marker to each new live position, and re-frame the route.
  useEffect(() => {
    if (!hasLive) return;
    const next = { latitude: lat, longitude: lng };
    coord.timing({ ...next, duration: ANIM_MS, useNativeDriver: false }).start();
    if (following) fit([next, pick, dropC].filter(Boolean));
  }, [lat, lng, hasLive, coord, following, fit, pick, dropC]);

  const recenter = () => {
    setFollowing(true);
    fit([hasLive ? { latitude: lat, longitude: lng } : null, pick, dropC].filter(Boolean));
  };

  return (
    <View style={[styles.wrap, { height: mapH }]}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={StyleSheet.absoluteFill}
        initialRegion={initialRegion}
        showsUserLocation={false}
        showsMyLocationButton={false}
        toolbarEnabled={false}
        loadingEnabled
        onRegionChangeComplete={(_, details) => {
          if (details?.isGesture) setFollowing(false);
        }}
      >
        {hasLive && pick && (
          <Polyline
            coordinates={[{ latitude: lat, longitude: lng }, pick]}
            strokeColor={colors.ambulance}
            strokeWidth={3}
            lineDashPattern={[12, 8]}
            lineCap="butt"
          />
        )}

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

      {!following && (
        <TouchableOpacity style={styles.recenterBtn} onPress={recenter} activeOpacity={0.85}>
          <Text style={styles.recenterTxt}>◎  Recenter</Text>
        </TouchableOpacity>
      )}

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
  recenterBtn: {
    position: 'absolute', right: spacing.sm, top: spacing.sm,
    backgroundColor: colors.surface, paddingHorizontal: spacing.md, paddingVertical: 8,
    borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, minWidth: 44, alignItems: 'center',
  },
  recenterTxt: { color: colors.ambulance, fontWeight: font.bold, fontSize: font.small },
  overlay: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    paddingVertical: spacing.sm, backgroundColor: colors.overlay, alignItems: 'center',
  },
  overlayText: { color: colors.white, fontSize: font.small, fontWeight: font.medium },
});
