package sh.measure.android.anr

internal class AnrError(val thread: Thread, val timestamp: Long, message: String) : RuntimeException(message) {
    init {
        stackTrace = thread.stackTrace
    }
}
