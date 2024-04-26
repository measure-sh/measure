package sh.measure.android.fakes

import sh.measure.android.events.Attachment
import sh.measure.android.events.EventProcessor

internal data class TrackedEvent<T>(
    val data: T,
    val timestamp: Long,
    val type: String,
    val attributes: MutableMap<String, Any?> = mutableMapOf(),
    val attachments: List<Attachment>? = null,
    val sessionId: String? = null,
)

@Suppress("MemberVisibilityCanBePrivate")
internal class FakeEventProcessor : EventProcessor {
    val trackedEventsMap: MutableMap<String, MutableList<TrackedEvent<*>>> = mutableMapOf()

    fun getTrackedEventsByType(type: String): MutableList<TrackedEvent<*>> {
        return trackedEventsMap[type] ?: mutableListOf()
    }

    override fun <T> track(data: T, timestamp: Long, type: String) {
        track(
            data, timestamp, type, attributes = mutableMapOf(), attachments = null, sessionId = null
        )
    }

    override fun <T> track(data: T, timestamp: Long, type: String, sessionId: String) {
        track(
            data,
            timestamp,
            type,
            attributes = mutableMapOf(),
            attachments = null,
            sessionId = sessionId
        )
    }

    override fun <T> track(
        data: T,
        timestamp: Long,
        type: String,
        attributes: MutableMap<String, Any?>,
        attachments: List<Attachment>?,
    ) {
        track(
            data,
            timestamp,
            type,
            attributes = attributes,
            attachments = attachments,
            sessionId = null
        )
    }

    private fun <T> track(
        data: T,
        timestamp: Long,
        type: String,
        attributes: MutableMap<String, Any?>,
        attachments: List<Attachment>?,
        sessionId: String? = null,
    ) {
        val trackedEvents = trackedEventsMap.getOrPut(type) { mutableListOf() }
        trackedEvents.add(
            TrackedEvent(
                data = data,
                timestamp = timestamp,
                type = type,
                attributes = attributes,
                attachments = attachments,
                sessionId = sessionId
            )
        )
    }
}
