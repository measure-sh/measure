package sh.measure.android.fakes

import sh.measure.android.events.Attachment
import sh.measure.android.events.EventProcessor

@Suppress("MemberVisibilityCanBePrivate")
internal class FakeEventProcessor : EventProcessor {
    data class TrackedEvent<T>(
        val data: T,
        val timestamp: Long,
        val type: String,
        val attributes: MutableMap<String, Any?> = mutableMapOf(),
        val attachments: List<Attachment>? = null,
    )

    val trackedEvents = mutableListOf<TrackedEvent<*>>()

    override fun <T> track(data: T, timestamp: Long, type: String) {
        trackedEvents.add(TrackedEvent(data, timestamp, type))
    }

    override fun <T> track(
        data: T,
        timestamp: Long,
        type: String,
        attributes: MutableMap<String, Any?>,
        attachments: List<Attachment>?,
    ) {
        trackedEvents.add(TrackedEvent(data, timestamp, type, attributes, attachments))
    }
}
