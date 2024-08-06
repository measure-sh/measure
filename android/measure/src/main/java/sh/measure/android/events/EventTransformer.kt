package sh.measure.android.events

internal interface EventTransformer {
    fun <T> transform(event: Event<T>): Event<T>?
}
