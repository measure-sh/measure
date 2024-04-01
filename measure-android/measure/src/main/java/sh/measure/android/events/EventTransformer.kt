package sh.measure.android.events

internal interface EventTransformer {
    fun <T> transform(event: Event<T>): Event<T>?
}

internal fun <T> Event<T>.transform(transformers: List<EventTransformer>): Event<T>? =
    transformers.fold(this) { acc: Event<T>?, transformer ->
        acc?.let { transformer.transform(it) } ?: return null
    }

