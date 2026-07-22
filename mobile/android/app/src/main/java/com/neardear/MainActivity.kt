package com.neardear

import android.os.Bundle
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

class MainActivity : ReactActivity() {

  override fun onCreate(savedInstanceState: Bundle?) {
    // The manifest launches this activity with LaunchTheme, whose window
    // background is the splash drawable — that's what shows during cold start.
    // Swap back to the normal AppTheme BEFORE the first draw, otherwise the
    // splash stays as the window background for the app's entire life and
    // bleeds through behind every screen (transitions, transparent areas).
    setTheme(R.style.AppTheme)
    // react-native-screens: pass null so Android doesn't try to restore
    // fragment state it can't reconstruct.
    super.onCreate(null)
  }

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "NearDear"

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)
}
