import { useEffect, useRef } from 'react';
import { Platform, PermissionsAndroid } from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import { AmbulanceApi } from '../api';

// The backend trusts a driver's location for 15 minutes (LOCATION_FRESH_SECONDS).
// Pinging every 5 minutes keeps it comfortably fresh across ~3 cycles, tolerating
// a dropped fix or a flaky network, while sparing the battery — unlike the 5s trip
// tracker, which feeds a live map the patient is watching. This one only answers
// "roughly where are you" for dispatch matching.
const INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

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
  const retryRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    const stop = () => {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      if (retryRef.current) { clearTimeout(retryRef.current); retryRef.current = null; }
    };

    // Send one location fix. `retriesLeft` makes the FIRST ping reliable against
    // two flaky cases — critical now that a lost ping means 5 minutes unmatchable:
    //   1) the duty-toggle race — the switch sets on-duty optimistically, so this
    //      ping can reach the backend a beat before "on duty" is committed, which
    //      it rejects ("go on duty first");
    //   2) a slow or failed first GPS fix.
    // On failure we retry shortly instead of silently waiting for the next tick.
    const pushOnce = (retriesLeft) => {
      if (cancelled) return;
      const retry = () => {
        if (cancelled || retriesLeft <= 0) return;
        retryRef.current = setTimeout(() => pushOnce(retriesLeft - 1), 3000);
      };
      Geolocation.getCurrentPosition(
        (pos) => {
          if (cancelled) return;
          const { latitude, longitude } = pos.coords;
          AmbulanceApi.ping({ latitude, longitude }).catch(retry); // rejected (race) / network hiccup -> retry
        },
        retry, // no fix this time -> retry shortly
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
      );
    };

    async function start() {
      const granted = await ensureLocationPermission();
      if (cancelled || !granted) return;
      pushOnce(3); // initial ping — retries so it reliably lands right after going on duty
      timerRef.current = setInterval(() => pushOnce(1), INTERVAL_MS); // every 5 min; one retry covers a dropped fix
    }

    if (onDuty) start();

    return () => { cancelled = true; stop(); };
  }, [onDuty]);
}
