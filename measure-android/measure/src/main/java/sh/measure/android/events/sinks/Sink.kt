package sh.measure.android.events.sinks

import sh.measure.android.events.MeasureEvent

/**
 * A sink that writes events to a destination.
 */
internal interface Sink {
    /**
     * Offers an event to the sink.
     *
     * @param event The event to offer.
     * @param immediate Whether the event needs to be precessed immediately.
     */
    fun offer(event: MeasureEvent, immediate: Boolean)
}