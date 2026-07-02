import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Platform, PermissionsAndroid, ActivityIndicator,
} from 'react-native';
import MapView, { PROVIDER_GOOGLE } from 'react-native-maps';
import Geolocation from '@react-native-community/geolocation';
import { colors, radius, font, spacing } from '../theme';

// India centroid — only used until we get a real fix or an initial value.
const FALLBACK = { latitude: 20.5937, longitude: 78.9629 };

async function ensurePermission() {
  if (Platform.OS !== 'android') return true;
  try {
    const res = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      {
        title: 'Use your location',
        message: 'NearDear uses your location to set an accurate pickup point.',
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
 * Uber-style pickup picker: a fixed centre pin sits over a draggable map.
 * Whatever point is under the pin when the map stops is the chosen location.
 * Props:
 *   value    { latitude, longitude } | null   — controlled initial point
 *   onChange (coord) => void                   — fires with the pinned coord
 *   height, label
 */
export default function LocationPicker({ value, onChange, height = 220, label = 'Move the map so the pin is on your pickup point' }) {
  const mapRef = useRef(null);
  const [locating, setLocating] = useState(false);

  const initialRegion = {
    latitude: value?.latitude ?? FALLBACK.latitude,
    longitude: value?.longitude ?? FALLBACK.longitude,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  };

  const locateMe = async () => {
    const granted = await ensurePermission();
    if (!granted) return;
    setLocating(true);
    Geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const { latitude, longitude } = pos.coords;
        mapRef.current?.animateToRegion(
          { latitude, longitude, latitudeDelta: 0.01, longitudeDelta: 0.01 },
          600,
        );
        onChange?.({ latitude, longitude });
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 },
    );
  };

  // Auto-centre on the user's location the first time (only if no value yet).
  useEffect(() => {
    if (!value) locateMe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={[styles.wrap, { height }]}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={StyleSheet.absoluteFill}
        initialRegion={initialRegion}
        onRegionChangeComplete={(r) => onChange?.({ latitude: r.latitude, longitude: r.longitude })}
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
