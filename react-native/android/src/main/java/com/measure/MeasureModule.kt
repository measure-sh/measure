package com.measure

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise

class MeasureModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "MeasureModule"

  @ReactMethod
  fun initialize(apiKey: String, promise: Promise) {
    try {
      // TODO: Call your actual SDK init method here if you have one
      println("📦 Measure SDK initialized with key: $apiKey")

      // Return success message to JS
      promise.resolve("Android SDK initialized with key: $apiKey")
    } catch (e: Exception) {
      promise.reject("INIT_ERROR", "Failed to initialize Measure SDK", e)
    }
  }
}