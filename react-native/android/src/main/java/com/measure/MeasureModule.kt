package com.measure

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import sh.measure.android.Measure
import sh.measure.android.config.ClientInfo
import sh.measure.android.config.MeasureConfig
import sh.measure.android.config.ScreenshotMaskLevel

class MeasureModule(private val reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "MeasureModule"

  @ReactMethod
  fun initialize(apiKey: String, promise: Promise) {
    try {
      val context = reactContext.applicationContext
      var clientInfo = ClientInfo(apiKey = apiKey, apiUrl = "http://localhost:8080")
      val config = MeasureConfig(
        enableLogging = true,
        trackScreenshotOnCrash = true,
        screenshotMaskLevel = ScreenshotMaskLevel.SensitiveFieldsOnly,
        trackHttpHeaders = true,
        trackHttpBody = true,
        trackActivityIntentData = true,
        httpUrlBlocklist = listOf("http://localhost:8080"),
        samplingRateForErrorFreeSessions = 1f,
        autoStart = true,
        traceSamplingRate = 1.0f
      )
      Measure.init(context, measureConfig = config, clientInfo = clientInfo)
      println("📦 Measure SDK initialized with key: $apiKey")

      // Return success message to JS
      promise.resolve("Android SDK initialized with key: $apiKey")
    } catch (e: Exception) {
      promise.reject("INIT_ERROR", "Failed to initialize Measure SDK", e)
    }
  }
}