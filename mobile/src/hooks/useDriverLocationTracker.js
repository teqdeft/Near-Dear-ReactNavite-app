import { useEffect, useRef } from 'react';
import { Platform, PermissionsAndroid } from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import { AmbulanceApi } from '../api';

const INTERVAL_MS = 5000;

// Ask for foreground location once; returns true if granted.
async function ensureLocationPermission() {
  if (Platform.OS !== 'android') return true; // iOS handled via Info.plist prompt
  try {
    const res = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      {
        title: 'Share live location',
        message: 'NearDear shares your location with the patient while a trip is active so they can track the ambulance.',
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
 * While `active` is true and `requestId` is set, push the driver's GPS to the
 * backend every 5 seconds so the patient's map can follow the ambulance.
 *
 * Three cooperating pieces make this reliable — the earlier versions each failed a
 * real case:
 *
 *   1. A one-shot getCurrentPosition SEED on start. This gives us a position within
 *      a second or two (using a slightly cached fix, maximumAge below), so the
 *      patient's map fills almost immediately instead of waiting on the first GPS
 *      lock. A getCurrentPosition-on-a-5s-timer alone (the original) kept asking for
 *      a brand-new fix and timed out constantly — most ticks sent nothing.
 *
 *   2. A continuous watchPosition STREAM that keeps the latest fix fresh as the
 *      ambulance moves. A watch alone (the second attempt) went silent whenever the
 *      driver was stationary at a light — the patient then saw nothing at all.
 *
 *   3. A steady 5s TIMER that pushes whatever the newest fix is. Because it re-sends
 *      the last known position even when no new fix has arrived (stationary, or a
 *      dropped fix), the map never falls back to "Waiting…" once we've had one fix.
 *
 * Stops and cleans up when the trip ends, the screen unmounts, or `active` is false.
 */
export default function useDriverLocationTracker(requestId, active) {
  // Newest fix; refreshed by the seed + the watch, sent on the interval below.
  const latest = useRef(null);

  useEffect(() => {
    let cancelled = false;
    let watchId = null;
    let timer = null;

    const stop = () => {
      if (watchId != null) { Geolocation.clearWatch(watchId); watchId = null; }
      if (timer) { clearInterval(timer); timer = null; }
    };

    const remember = (pos) => {
      const { latitude, longitude, heading } = pos.coords;
      latest.current = {
        latitude,
        longitude,
        // heading is -1/NaN when unavailable (e.g. stationary) — send null then.
        bearing: heading != null && heading >= 0 ? Number(heading.toFixed(2)) : null,
      };
    };

    const send = () => {
      const c = latest.current;
      if (!c) return; // no fix yet — nothing to send this tick
      AmbulanceApi.updateLocation({
        requestId,
        latitude: c.latitude,
        longitude: c.longitude,
        bearing: c.bearing,
      }).catch(() => {}); // network hiccups shouldn't crash the tracker
    };

    async function start() {
      const granted = await ensureLocationPermission();
      if (cancelled || !granted) return;

      // 1) Seed a position fast (accepts a fix up to 10s old so it returns at once).
      Geolocation.getCurrentPosition(
        (pos) => { if (!cancelled) { remember(pos); send(); } },
        () => {}, // the watch below will fill it in shortly
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 },
      );

      // 2) Keep it fresh as the ambulance moves.
      watchId = Geolocation.watchPosition(
        (pos) => { if (!cancelled) remember(pos); },
        () => {}, // keep the watch alive; a single failed fix is fine, more will come
        {
          enableHighAccuracy: true,
          distanceFilter: 0, // report even small movements — the map should feel live
          interval: INTERVAL_MS, // Android (fused provider) desired update cadence
          fastestInterval: 2000,
          maximumAge: 1000,
        },
      );

      // 3) Steady 5s push of whatever the newest fix is.
      timer = setInterval(send, INTERVAL_MS);
    }

    if (active && requestId) start();

    return () => {
      cancelled = true;
      stop();
    };
  }, [requestId, active]);
}
