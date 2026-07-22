import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Platform, PermissionsAndroid, ActivityIndicator, Alert,
} from 'react-native';
import MapView, { PROVIDER_GOOGLE } from 'react-native-maps';
import Geolocation from '@react-native-community/geolocation';
import { colors, radius, font, spacing } from '../theme';
import { LIGHT_MAP_STYLE } from '../constants/mapStyle';

// India centroid — only used until we get a real fix or an initial value.
const FALLBACK = { latitude: 20.5937, longitude: 78.9629 };

async function ensurePermission() {
  if (Platform.OS !== 'android') return true;
  try {
    const res = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      {
        title: 'Use your location',
        message: 'NearDear uses your location to place the pin accurately on the map.',
        buttonPositive: 'Allow',
        buttonNegative: 'Deny',
      },
    );
    return res === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
}

/**
 * Uber-style location picker: a fixed centre pin sits over a draggable map.
 * Whatever point is under the pin when the map stops is the chosen location.
 * Props:
 *   value      { latitude, longitude } | null  — controlled initial point
 *   onChange   (coord) => void                  — fires with the pinned coord
 *   autoLocate boolean                          — jump to the phone's GPS on open
 *   height, label
 *
 * autoLocate is right for an ambulance pickup (you are standing at it) and WRONG
 * for a delivery address: someone in Delhi saving their family's Mohali address
 * would silently have Delhi pinned under a "Mohali" label, and every pharmacy
 * actually near that home would then be filtered out as too far away.
 */
export default function LocationPicker({
  value, onChange, height = 220, autoLocate = true, center,
  label = 'Move the map so the pin is on your pickup point',
}) {
  const mapRef = useRef(null);
  const [locating, setLocating] = useState(false);

  /**
   * Has the user actually chosen a place yet?
   *
   * The map has to open SOMEWHERE, and with no value and no city it opens on the
   * centre of India. react-native-maps fires onRegionChangeComplete once on
   * mount, so without this guard that arbitrary fallback would be emitted as the
   * user's pin — an address in the middle of Madhya Pradesh that nobody chose,
   * silently, for anyone whose city we don't have coordinates for.
   *
   * We only trust a coordinate once the user has done one of: dragged the map,
   * tapped "My location", or picked a city (which the caller passes as `center`).
   * Until then we emit nothing, and a null pin correctly falls back to matching
   * by city name.
   */
  const armed = useRef(!!value);

  // Open the map on the right spot from the very first frame instead of relying
  // on animateToRegion after mount. On a fresh mount react-native-maps ignores
  // animateToRegion until the native view is ready, so a city picked BEFORE the
  // picker exists (the delivery-address flow) would leave the map stuck on the
  // India-centroid fallback and never jump to the city. Prefer the saved pin,
  // then the picked city centre, then the fallback.
  const start = value ?? center ?? FALLBACK;
  const startDelta = value ? 0.01 : center ? 0.08 : 0.01;
  const initialRegion = {
    latitude: start.latitude,
    longitude: start.longitude,
    latitudeDelta: startDelta,
    longitudeDelta: startDelta,
  };

  const locateMe = async () => {
    const granted = await ensurePermission();
    if (!granted) {
      Alert.alert('Location permission needed', 'Please allow location access to use “My location”, or drag the map to your spot.');
      return;
    }
    setLocating(true);

    const onSuccess = (pos) => {
      setLocating(false);
      const { latitude, longitude } = pos.coords;
      armed.current = true;
      mapRef.current?.animateToRegion(
        { latitude, longitude, latitudeDelta: 0.01, longitudeDelta: 0.01 },
        600,
      );
      onChange?.({ latitude, longitude });
    };

    // Two stages: first a precise GPS fix, but GPS often can't lock indoors or on
    // a weak signal and times out. Rather than silently give up, fall back to the
    // faster network/fused location (lower accuracy, but it actually returns),
    // and only if THAT fails do we tell the user.
    Geolocation.getCurrentPosition(
      onSuccess,
      () => {
        Geolocation.getCurrentPosition(
          onSuccess,
          () => {
            setLocating(false);
            Alert.alert(
              'Couldn’t get your location',
              'Make sure location/GPS is turned on and try again — or just drag the map so the pin is on your spot.',
            );
          },
          // Network/fused location: no GPS lock required, so it works indoors.
          { enableHighAccuracy: false, timeout: 20000, maximumAge: 60000 },
        );
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 10000 },
    );
  };

  // Centre on the phone's location the first time — but only where "here" is
  // actually the point being pinned. The "My location" button stays either way,
  // so a user who IS at the address can still one-tap it.
  useEffect(() => {
    if (autoLocate && !value) locateMe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Jump to `center` when the caller changes it — the address forms pass the
   * centre of the city the user just picked, so someone in Delhi saving their
   * Mohali address lands in Mohali and drags a few hundred metres, instead of
   * dragging across the country.
   *
   * Zoomed out (0.08 ≈ city-wide) on purpose: this is a rough anchor, and the
   * wide view invites the user to find their own street rather than trusting a
   * pin that only knows the city. Picking a city IS a choice, so this arms the
   * picker: settling then emits the city centre as a provisional pin, which the
   * user refines by dragging.
   */
  const centerKey = center ? `${center.latitude},${center.longitude}` : null;
  useEffect(() => {
    if (!center) return;
    armed.current = true;
    mapRef.current?.animateToRegion(
      { latitude: center.latitude, longitude: center.longitude, latitudeDelta: 0.08, longitudeDelta: 0.08 },
      600,
    );
    // Keyed on the coordinates, not the object: the parent rebuilds it each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centerKey]);

  return (
    <View style={[styles.wrap, { height }]}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        customMapStyle={LIGHT_MAP_STYLE}
        style={StyleSheet.absoluteFill}
        initialRegion={initialRegion}
        // Dragging the map is the user choosing a point — from here on, trust it.
        onPanDrag={() => { armed.current = true; }}
        onRegionChangeComplete={(r) => {
          if (!armed.current) return; // the opening fallback view — nobody picked it
          onChange?.({ latitude: r.latitude, longitude: r.longitude });
        }}
        showsUserLocation
        showsMyLocationButton={false}
        toolbarEnabled={false}
        loadingEnabled
      />

      {/* Fixed centre pin (the map moves under it). */}
      <View style={styles.pinWrap} pointerEvents="none">
        <Text style={styles.pin}>📍</Text>
      </View>

      <TouchableOpacity style={styles.myBtn} onPress={locateMe} activeOpacity={0.85}>
        {locating ? <ActivityIndicator size="small" color={colors.ambulance} />
          : <Text style={styles.myTxt}>◎  My location</Text>}
      </TouchableOpacity>

      <View style={styles.hint} pointerEvents="none">
        <Text style={styles.hintTxt}>{label}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.surfaceAlt, marginBottom: spacing.md },
  pinWrap: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 18, alignItems: 'center', justifyContent: 'center' },
  pin: { fontSize: 30 },
  myBtn: {
    position: 'absolute', right: spacing.sm, bottom: spacing.sm,
    backgroundColor: colors.surface, paddingHorizontal: spacing.md, paddingVertical: 8,
    borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, minWidth: 44, alignItems: 'center',
  },
  myTxt: { color: colors.ambulance, fontWeight: font.bold, fontSize: font.small },
  hint: {
    position: 'absolute', left: spacing.sm, top: spacing.sm, right: 90,
    backgroundColor: colors.overlay, paddingHorizontal: spacing.sm, paddingVertical: 6, borderRadius: radius.sm,
  },
  hintTxt: { color: colors.white, fontSize: font.tiny, fontWeight: font.medium },
});
