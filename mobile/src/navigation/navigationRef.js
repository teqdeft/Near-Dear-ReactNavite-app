import { createNavigationContainerRef } from '@react-navigation/native';

/**
 * Navigation handle for code that lives OUTSIDE the navigator.
 *
 * NotificationProvider sits above NavigationContainer in App.js — it has to, since
 * the badge count is app-wide state the navigator itself reads — so it cannot use
 * useNavigation(). A push arriving there still needs to be able to open a screen.
 *
 * navigateWhenReady() guards the one case that actually bites: a notification that
 * cold-starts the app fires before the navigator has mounted, and navigating then
 * is a silent no-op — the app opens on Home and the user never sees what they
 * tapped. So the target is held and replayed once the container reports ready.
 */
export const navigationRef = createNavigationContainerRef();

let pending = null;

export function navigateWhenReady(screen, params) {
  if (navigationRef.isReady()) {
    navigationRef.navigate(screen, params);
  } else {
    pending = { screen, params };
  }
}

// Called from NavigationContainer's onReady.
export function flushPendingNavigation() {
  if (!pending) return;
  const { screen, params } = pending;
  pending = null;
  navigationRef.navigate(screen, params);
}
