package com.neardear

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.os.Build
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost

class MainApplication : Application(), ReactApplication {

  override val reactHost: ReactHost by lazy {
    getDefaultReactHost(
      context = applicationContext,
      packageList =
        PackageList(this).packages.apply {
          // Packages that cannot be autolinked yet can be added manually here, for example:
          // add(MyReactNativePackage())
        },
    )
  }

  override fun onCreate() {
    super.onCreate()
    loadReactNative(this)
    createNotificationChannel()
  }

  /**
   * Creates the channel the backend addresses its pushes to (see pushService.js).
   *
   * On Android 8+ a notification naming a channel that does not exist is dropped
   * in silence — no error, no tray entry. It has to exist before any push can
   * arrive, which is why this runs in Application.onCreate and not in JS: a push
   * can wake the process while the React context is still starting.
   *
   * IMPORTANCE_HIGH is the point of the feature, not a preference. These are
   * ambulance dispatches and blood requests; at DEFAULT importance Android may
   * deliver them silently and hold them under Doze until the phone next wakes,
   * which for an emergency is much the same as not sending them.
   *
   * Importance is fixed when the channel is first created — Android ignores it on
   * later calls, and the user's own override always wins. Raising it after release
   * would need a new channel id (and a matching change in pushService.js).
   */
  private fun createNotificationChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return

    val channel = NotificationChannel(
      "neardear_alerts",
      "Alerts",
      NotificationManager.IMPORTANCE_HIGH,
    ).apply {
      description = "Blood requests, ambulance updates and order alerts"
      enableVibration(true)
    }

    getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
  }
}
