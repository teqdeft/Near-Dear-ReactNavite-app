import { useEffect, useRef } from 'react';
import { Platform, PermissionsAndroid } from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import { AmbulanceApi } from '../api';

// The backend trusts a location for 5 minutes. Pinging every 15s keeps it well
// inside that window with a wide margin for a dropped fix or a flaky network,
// without hammering the GPS the way the 5s trip tracker does — that one feeds a
// live map the patient is watching; this one only answers "roughly where are you".
const INTERVAL_MS = 15000;

async function ensureLocationPermission() {
  if (Platform.OS !== 'android') return true; // iOS prompts via Info.plist
  try {
    const res = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      {
        title: 'Share your location while on duty',
        message: 'While you are on duty, NearDear uses your location to send you emergency requests that are near you — including ones in towns you did not list.',
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
 * While the driver is on duty, tell the backend where they are.
 *
 * This is what lets a request reach a driver who is physically close but in a
 * town they never listed in their profile.
 *
 * Foreground only: the interval dies when the app is backgrounded. That is a real
 * limit, but it costs nothing today — there is no push either, so a driver already
 * has to keep the app open to see requests at all. When push lands, this needs to
 * become an Android foreground service (the "NearDear is using your location"
 * notification), which is what Uber and Ola run.
 *
 * If the driver denies location, nothing is sent and nothing breaks: the backend
 * falls back to matching them by city, exactly as before.
 */
export default function useDutyLocationPing(onDuty) {
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
          const { latitude, longitude } = pos.coords;
          AmbulanceApi.ping({ latitude, longitude }).catch(() => {}); // a hiccup shouldn't kill the loop
        },
        () => {}, // one failed fix is fine; the next tick tries again
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
      );
    };

    async function start() {
      const granted = await ensureLocationPermission();
      if (cancelled || !granted) return;
      pushOnce(); // send one immediately so the driver is matchable at once
      timerRef.current = setInterval(pushOnce, INTERVAL_MS);
    }

    if (onDuty) start();

    return () => { cancelled = true; stop(); };
  }, [onDuty]);
}
