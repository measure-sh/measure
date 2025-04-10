package sh.measure.android.storage

import kotlinx.serialization.builtins.MapSerializer
import kotlinx.serialization.builtins.serializer
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.modules.SerializersModule
import sh.measure.android.appexit.AppExit
import sh.measure.android.applaunch.ColdLaunchData
import sh.measure.android.applaunch.HotLaunchData
import sh.measure.android.applaunch.WarmLaunchData
import sh.measure.android.attributes.AttributeValue
import sh.measure.android.attributes.AttributeValueSerializer
import sh.measure.android.attributes.serializer
import sh.measure.android.bugreport.BugReportData
import sh.measure.android.events.CustomEventData
import sh.measure.android.events.Event
import sh.measure.android.events.EventType
import sh.measure.android.exceptions.ExceptionData
import sh.measure.android.gestures.ClickData
import sh.measure.android.gestures.LongClickData
import sh.measure.android.gestures.ScrollData
import sh.measure.android.lifecycle.ActivityLifecycleData
import sh.measure.android.lifecycle.ApplicationLifecycleData
import sh.measure.android.lifecycle.FragmentLifecycleData
import sh.measure.android.navigation.ScreenViewData
import sh.measure.android.networkchange.NetworkChangeData
import sh.measure.android.okhttp.HttpData
import sh.measure.android.performance.CpuUsageData
import sh.measure.android.performance.MemoryUsageData
import sh.measure.android.performance.TrimMemoryData
import sh.measure.android.utils.toJsonElement

private val json by lazy(LazyThreadSafetyMode.SYNCHRONIZED) {
    Json {
        serializersModule = SerializersModule {
            contextual(AttributeValue::class, AttributeValueSerializer)
        }
    }
}

/**
 * Serializes the attributes of the event to a JSON string.
 */
internal fun <T> Event<T>.serializeAttributes(): String? {
    if (attributes.isEmpty()) {
        return null
    }
    val result = json.encodeToString(
        JsonElement.serializer(),
        attributes.toJsonElement(),
    )
    return result
}

/**
 *
 */
internal fun <T> Event<T>.serializeUserDefinedAttributes(): String? {
    if (userDefinedAttributes.isEmpty()) {
        return null
    }
    val result = json.encodeToString(
        MapSerializer(String.serializer(), AttributeValue.serializer()),
        userDefinedAttributes,
    )
    return result
}

/**
 * Serializes the event data to a JSON string.
 */
internal fun <T> Event<T>.serializeDataToString(): String {
    return when (type) {
        EventType.EXCEPTION -> {
            json.encodeToString(ExceptionData.serializer(), data as ExceptionData)
        }

        EventType.ANR -> {
            json.encodeToString(ExceptionData.serializer(), data as ExceptionData)
        }

        EventType.APP_EXIT -> {
            json.encodeToString(AppExit.serializer(), data as AppExit)
        }

        EventType.CLICK -> {
            json.encodeToString(ClickData.serializer(), data as ClickData)
        }

        EventType.LONG_CLICK -> {
            json.encodeToString(LongClickData.serializer(), data as LongClickData)
        }

        EventType.SCROLL -> {
            json.encodeToString(ScrollData.serializer(), data as ScrollData)
        }

        EventType.LIFECYCLE_ACTIVITY -> {
            json.encodeToString(
                ActivityLifecycleData.serializer(),
                data as ActivityLifecycleData,
            )
        }

        EventType.LIFECYCLE_FRAGMENT -> {
            json.encodeToString(
                FragmentLifecycleData.serializer(),
                data as FragmentLifecycleData,
            )
        }

        EventType.LIFECYCLE_APP -> {
            json.encodeToString(
                ApplicationLifecycleData.serializer(),
                data as ApplicationLifecycleData,
            )
        }

        EventType.COLD_LAUNCH -> {
            json.encodeToString(ColdLaunchData.serializer(), data as ColdLaunchData)
        }

        EventType.WARM_LAUNCH -> {
            json.encodeToString(WarmLaunchData.serializer(), data as WarmLaunchData)
        }

        EventType.HOT_LAUNCH -> {
            json.encodeToString(HotLaunchData.serializer(), data as HotLaunchData)
        }

        EventType.NETWORK_CHANGE -> {
            json.encodeToString(NetworkChangeData.serializer(), data as NetworkChangeData)
        }

        EventType.HTTP -> {
            json.encodeToString(HttpData.serializer(), data as HttpData)
        }

        EventType.MEMORY_USAGE -> {
            json.encodeToString(MemoryUsageData.serializer(), data as MemoryUsageData)
        }

        EventType.TRIM_MEMORY -> {
            json.encodeToString(TrimMemoryData.serializer(), data as TrimMemoryData)
        }

        EventType.CPU_USAGE -> {
            json.encodeToString(CpuUsageData.serializer(), data as CpuUsageData)
        }

        EventType.CUSTOM -> {
            json.encodeToString(CustomEventData.serializer(), data as CustomEventData)
        }

        EventType.SCREEN_VIEW -> {
            json.encodeToString(ScreenViewData.serializer(), data as ScreenViewData)
        }

        EventType.BUG_REPORT -> {
            json.encodeToString(BugReportData.serializer(), data as BugReportData)
        }

        EventType.STRING -> {
            json.encodeToString(String.serializer(), data as String)
        }
    }
}
