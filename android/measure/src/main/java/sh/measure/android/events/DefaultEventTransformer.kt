package sh.measure.android.events

import sh.measure.android.applaunch.ColdLaunchData
import sh.measure.android.applaunch.HotLaunchData
import sh.measure.android.applaunch.WarmLaunchData
import sh.measure.android.config.ConfigProvider
import sh.measure.android.lifecycle.ActivityLifecycleData
import sh.measure.android.okhttp.HttpData

/**
 * Allows modifying events before they are stored on disk. Applies transformations based on the
 * configuration provided by the [ConfigProvider].
 */
internal class DefaultEventTransformer(
    private val configProvider: ConfigProvider,
) : EventTransformer {
    override fun <T> transform(event: Event<T>): Event<T>? {
        when (event.type) {
            EventType.LIFECYCLE_ACTIVITY -> {
                if (!configProvider.trackActivityIntentData) {
                    (event.data as ActivityLifecycleData).intent = null
                }
            }

            EventType.COLD_LAUNCH -> {
                if (!configProvider.trackActivityIntentData) {
                    (event.data as ColdLaunchData).intent_data = null
                }
            }

            EventType.WARM_LAUNCH -> {
                if (!configProvider.trackActivityIntentData) {
                    (event.data as WarmLaunchData).intent_data = null
                }
            }

            EventType.HOT_LAUNCH -> {
                if (!configProvider.trackActivityIntentData) {
                    (event.data as HotLaunchData).intent_data = null
                }
            }

            EventType.HTTP -> {
                val http = event.data as HttpData
                if (!configProvider.shouldTrackHttpUrl(http.url)) {
                    return null
                }

                val requestContentType = http.request_headers?.let { getContentTypeHeader(it) }
                if (!configProvider.shouldTrackHttpBody(http.url, requestContentType)) {
                    http.request_body = null
                }

                val responseContentType = http.response_headers?.let { getContentTypeHeader(it) }
                if (!configProvider.shouldTrackHttpBody(http.url, responseContentType)) {
                    http.response_body = null
                }

                if (!configProvider.trackHttpHeaders) {
                    http.request_headers = null
                    http.response_headers = null
                }

                http.request_headers = http.request_headers?.filterKeys { key ->
                    configProvider.shouldTrackHttpHeader(key)
                }

                http.response_headers = http.response_headers?.filterKeys { key ->
                    configProvider.shouldTrackHttpHeader(key)
                }
            }

            else -> return event
        }
        return event
    }

    private fun getContentTypeHeader(headers: Map<String, String>): String? {
        return headers["Content-Type"] ?: headers["content-type"]
    }
}
