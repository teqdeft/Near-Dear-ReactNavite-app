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
 * backend every 5 seconds (REST short-polling). Stops and cleans up when the
 * trip ends, the screen unmounts, or `active` becomes false.
 */
export default function useDriverLocationTracker(requestId, active) {
  const timerRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    const stop = () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };

    const pushOnce = () => {
      Geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude, heading } = pos.coords;
          AmbulanceApi.updateLocation({
            requestId,
            latitude,
            longitude,
            // heading is -1/NaN when unavailable (e.g. stationary) — send null then.
            bearing: heading != null && heading >= 0 ? Number(heading.toFixed(2)) : null,
          }).catch(() => {}); // network hiccups shouldn't crash the tracker
        },
        () => {}, // ignore a single failed fix; the next tick tries again
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
      );
    };

    async function start() {
      const granted = await ensureLocationPermission();
      if (cancelled || !granted) return;
      pushOnce(); // send an immediate fix so the user sees the marker fast
      timerRef.current = setInterval(pushOnce, INTERVAL_MS);
    }

    if (active && requestId) start();

    return () => {
      cancelled = true;
      stop();
    };
  }, [requestId, active]);
}
