package sh.measure.android.exceptions

/**
 * The maximum number of threads to include in the exception.
 */
internal const val MAX_THREADS_IN_EXCEPTION = 16

/**
 * The maximum number of frames to include in a stacktrace.
 */
private const val MAX_FRAMES_IN_STACKTRACE = 64

/**
 * The maximum number of consecutive repeats of a frame allowed in a stacktrace.
 */
private const val MAX_CONSECUTIVE_FRAME_REPEATS = 5

/**
 * Trims stacktrace to remove consecutive repeats and reduce the size of the stacktrace.
 *
 * @param maxRepeats The maximum number of consecutive repeats allowed.
 * @param maxSize The maximum size of the stacktrace allowed.
 */
internal fun Array<StackTraceElement>.trimStackTrace(
    maxRepeats: Int = MAX_CONSECUTIVE_FRAME_REPEATS,
    maxSize: Int = MAX_FRAMES_IN_STACKTRACE,
): Array<StackTraceElement> {
    val result = mutableListOf<StackTraceElement>()
    var currentElement: StackTraceElement? = null
    var currentCount = 0

    for (element in this) {
        if (element == currentElement) {
            currentCount++
            if (currentCount <= maxRepeats) {
                result.add(element)
            }
        } else {
            currentElement = element
            currentCount = 1
            result.add(element)
        }
    }

    // Check if the result list is larger than maxSize
    if (result.size > maxSize) {
        val middleIndex = result.size / 2
        val startIndex = middleIndex - maxSize / 2
        val endIndex = middleIndex + maxSize / 2
        result.subList(startIndex, endIndex).clear()
    }

    return result.toTypedArray()
}
