package sh.measure.android.tracing

fun <T> Span?.with(block: () -> T): T {
    if (this == null) {
        return block()
    }
    return makeCurrent().use { block() }
}
