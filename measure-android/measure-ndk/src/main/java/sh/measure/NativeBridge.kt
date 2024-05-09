package sh.measure

/**
 * Listener interface for receiving ANR detection events.
 */
interface AnrListener {
    /**
     * Called when an ANR is detected.
     *
     * @param timestamp the timestamp when the ANR was detected.
     */
    fun onAnrDetected(timestamp: Long)
}

interface NativeBridge {
    fun enableAnrReporting(anrListener: AnrListener): Boolean
    fun disableAnrReporting()
}

/**
 * A bridge between Kotlin and native code.
 */
class NativeBridgeImpl : NativeBridge {
    companion object {
        init {
            System.loadLibrary("measure-ndk")
        }
    }

    private var anrListener: AnrListener? = null

    /**
     * Registers an [AnrListener] to receive ANR detection events.
     *
     * @param anrListener the ANR listener to register.
     * @return true if ANR reporting was enabled successfully, false otherwise.
     */
    override fun enableAnrReporting(anrListener: AnrListener): Boolean {
        val success = enableAnrReportingInternal()
        if (success) {
            this.anrListener = anrListener
        }
        return success
    }

    /**
     * Disables ANR reporting and unregisters the [AnrListener].
     */
    override fun disableAnrReporting() {
        anrListener = null
    }

    private external fun enableAnrReportingInternal(): Boolean
    private external fun disableAnrReportingInternal()

    /**
     * **IMPORTANT**: This method is called from the native code when an ANR is detected.
     * Do not change the method signature or the method name without updating the native code
     * at `anr_handler.c`.
     *
     * @param timestamp the timestamp when the ANR was detected
     */
    private fun notifyAnrDetected(timestamp: Long) {
        anrListener?.onAnrDetected(timestamp)
    }
}