/**
 * @format
 */

import { AppRegistry } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import Geolocation from '@react-native-community/geolocation';
import App from './App';
import { name as appName } from './app.json';

// Use the Google Play Services (fused) location provider on Android instead of the
// legacy LocationManager. The fused provider is far more reliable for continuous
// tracking — it honours the watchPosition interval and returns fixes indoors/with
// weak GPS — which is what keeps the patient's live ambulance map from stalling on
// "Waiting for the driver's live location…". `auto` falls back to the legacy
// provider if Play Services is somehow unavailable.
Geolocation.setRNConfiguration({
  skipPermissionRequests: false,
  authorizationLevel: 'whenInUse',
  locationProvider: 'auto',
});

// Runs when a push arrives while the app is backgrounded or killed. Android draws
// the tray notification itself from the payload's `notification` block, so there
// is nothing to do here — but the handler must be registered at module scope, and
// before AppRegistry, or Firebase logs a "no task registered" warning each time.
//
// The badge is not updated from here: this runs in a headless JS context with no
// React tree to update. NotificationContext re-reads the count when the app next
// opens, which is the only moment a badge could be seen anyway.
messaging().setBackgroundMessageHandler(async () => {});

AppRegistry.registerComponent(appName, () => App);
