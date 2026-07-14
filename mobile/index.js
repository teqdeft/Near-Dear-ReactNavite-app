/**
 * @format
 */

import { AppRegistry } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import App from './App';
import { name as appName } from './app.json';

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
