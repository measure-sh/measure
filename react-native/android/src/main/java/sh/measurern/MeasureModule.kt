package sh.measure.rn

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap

import sh.measure.android.Measure
import sh.measure.android.config.ClientInfo
import sh.measure.android.config.MeasureConfig
import sh.measure.android.config.ScreenshotMaskLevel

import sh.measure.rn.MapUtils

class MeasureModule(private val reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = ModuleConstants.MODULE_NAME

  @ReactMethod
  fun initialize(clientMap: ReadableMap, configMap: ReadableMap, promise: Promise) {
    try {
        val context = reactContext.applicationContext

        val clientJson = MapUtils.toStringMap(clientMap)
        val configJson = MapUtils.toMap(configMap)

        val clientInfo = ClientInfo.fromJson(clientJson)
        val config = MeasureConfig.fromJson(configJson)

        Measure.init(context, measureConfig = config, clientInfo = clientInfo)
        promise.resolve("Native Measure SDK initialized successfully")
    } catch (e: Exception) {
        promise.reject(ErrorCode.INIT_ERROR, "Failed to initialize Measure SDK", e)
    }
  }

  @ReactMethod
  fun start(promise: Promise) {
    Measure.start()
    promise.resolve("Measure SDK started successfully")
  }

  @ReactMethod
  fun stop(promise: Promise) {
    Measure.stop()
    promise.resolve("Measure SDK stopped successfully")
  }
}