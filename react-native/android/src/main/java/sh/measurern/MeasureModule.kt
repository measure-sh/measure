package sh.measure.rn

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.ReadableArray

import sh.measure.android.Measure
import sh.measure.android.config.ClientInfo
import sh.measure.android.config.MeasureConfig
import sh.measure.android.config.ScreenshotMaskLevel

import android.util.Log

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

  @ReactMethod
  fun trackEvent(
      data: ReadableMap,
      type: String,
      timestamp: Double,
      attributes: ReadableMap?,
      userDefinedAttrs: ReadableMap?,
      userTriggered: Boolean,
      sessionId: String?,
      threadName: String?,
      attachments: ReadableArray?, // moved to end
      promise: Promise
  ) {
      try {
          val dataMap: MutableMap<String, Any?> = MapUtils.toMutableMap(data)
          val attributesMap: MutableMap<String, Any?> = if (attributes != null) MapUtils.toMutableMap(attributes) else mutableMapOf()
          val userAttrs = MapUtils.toAttributeValueMap(userDefinedAttrs)
          val attachmentsList = MapUtils.toAttachmentList(attachments)
          val tsLong = timestamp.toLong()

          Measure.internalTrackEvent(
              data = dataMap,
              type = type,
              timestamp = tsLong,
              attributes = attributesMap,
              userDefinedAttrs = userAttrs,
              attachments = attachmentsList,
              userTriggered = userTriggered,
              sessionId = sessionId,
              threadName = threadName
          )

          promise.resolve("Event tracked successfully")
      } catch (e: Exception) {
          promise.reject("TRACK_EVENT_ERROR", "Failed to track event", e)
      }
  }
}