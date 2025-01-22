package sh.measure.android

import android.util.Log
import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger

/**
 * Listener interface for receiving ANR detection events.
 */
internal interface AnrListener {
    /**
     * Called when an ANR is detected.
     *
     * @param timestamp the timestamp when the ANR was detected.
     */
    fun onAnrDetected(timestamp: Long)
}

internal interface NativeBridge {
    fun enableAnrReporting(anrListener: AnrListener): Boolean
    fun disableAnrReporting()
}

/**
 * A bridge between Kotlin and native code.
 */
internal class NativeBridgeImpl(private val logger: Logger) : NativeBridge {
    companion object {
        init {
            try {
                System.loadLibrary("measure-ndk")
            } catch (e: UnsatisfiedLinkError) {
                Log.e("Measure", "Failed to load measure-ndk, ANR detection will not work.", e)
            } catch (e: SecurityException) {
                Log.e("Measure", "Failed to load measure-ndk, ANR detection will not work.", e)
            } catch (e: NullPointerException) {
                Log.e("Measure", "Failed to load measure-ndk, ANR detection will not work.", e)
            }
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
        if (this.anrListener != null) {
            logger.log(
                LogLevel.Warning,
                "Attempt to enable ANR reporting when it's already enabled",
            )
            return true
        }
        val success = try {
            enableAnrReportingInternal()
        } catch (e: Throwable) {
            // Catch all exceptions to prevent the app from crashing if the native code fails
            // or the native library fails to load.
            logger.log(
                LogLevel.Error,
                "Failed to enable ANR reporting, ANR detection will not work.",
                e,
            )
            false
        }

        if (success) {
            this.anrListener = anrListener
        }
        return success
    }

    /**
     * Disables ANR reporting and unregisters the [AnrListener].
     */
    override fun disableAnrReporting() {
        if (anrListener == null) {
            logger.log(
                LogLevel.Warning,
                "Attempt to disable ANR reporting when it's already disabled",
            )
            return
        }
        anrListener = null
        disableAnrReportingInternal()
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
