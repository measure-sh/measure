package sh.measure.android.attachments

import android.os.Debug
import sh.measure.android.utils.TimeProvider

/**
 * Names for the method traces. It is recommended to end the name with `.trace`.
 */
internal object TraceName {
    const val COLD_LAUNCH = "cold_launch.trace"
}

/**
 * An abstraction over [Debug.startMethodTracing]. It handles the creation of the method trace file
 * and storing it along with metadata.
 */
internal interface MethodTrace {
    /**
     * Starts a method trace for a cold launch.
     */
    fun startColdLaunch()

    /**
     * Stops any started method trace.
     */
    fun stop()
}

internal class MethodTraceImpl(
    private val attachmentProcessor: AttachmentProcessor, private val timeProvider: TimeProvider
) : MethodTrace {
    override fun startColdLaunch() {
        val bufferSize = 3 * 1024 * 1024 // 3MB
        val intervalUs = 1000 * 1 // 1ms
        startTrace(bufferSize, intervalUs, TraceName.COLD_LAUNCH)
    }

    override fun stop() {
        stopTrace()
    }

    /**
     * Creates a file to store the method trace in along with the metadata, and then starts
     * method tracing.
     */
    @Suppress("SameParameterValue")
    private fun startTrace(bufferSize: Int, intervalUs: Int, traceName: String) {
        attachmentProcessor.createMethodTrace(
            AttachmentInfo(
                name = traceName,
                extension = "trace",
                type = AttachmentType.METHOD_TRACE,
                timestamp = timeProvider.currentTimeSinceEpochInMillis
            )
        )?.let {
            Debug.startMethodTracingSampling(it, bufferSize, intervalUs)
        }
    }

    private fun stopTrace() {
        Debug.stopMethodTracing()
    }
}
