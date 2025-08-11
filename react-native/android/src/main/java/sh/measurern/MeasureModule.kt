package sh.measure.rn

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import org.json.JSONObject
import sh.measure.android.Measure
import sh.measure.android.config.ClientInfo
import sh.measure.android.config.MeasureConfig
import sh.measure.android.config.ScreenshotMaskLevel
import sh.measure.rn.MapUtil

class MeasureModule(private val reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "MeasureModule"

  @ReactMethod
  fun initialize(clientMap: ReadableMap, configMap: ReadableMap, promise: Promise) {
    try {
        val context = reactContext.applicationContext

        val clientJson = MapUtil.toJSONObject(clientMap)
        val configJson = MapUtil.toJSONObject(configMap)

        val clientInfoMap = MapUtil.toStringMap(clientJson)
        val configMapParsed = MapUtil.toMap(configJson)

        val clientInfo = ClientInfo.fromJson(clientInfoMap)
        val config = MeasureConfig.fromJson(configMapParsed)

        Measure.init(context, measureConfig = config, clientInfo = clientInfo)
        promise.resolve("Android SDK initialized with key: ${clientInfo.apiKey}")
    } catch (e: Exception) {
        promise.reject("INIT_ERROR", "Failed to initialize Measure SDK", e)
    }
  }

  @ReactMethod
  fun start() {
    Measure.start()
  }

  @ReactMethod
  fun stop() {
    Measure.stop()
  }
}